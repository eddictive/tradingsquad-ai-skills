const { StockbitClient } = require('../../../core/stockbit-auth.js');

class TechnicalAPIClient extends StockbitClient {
  
  // ==========================================
  // RAW DATA FETCHERS
  // ==========================================
  
  async getStockPrice(ticker) {
    const data = await this._getExodus(`/emitten/${ticker}/info`);
    return data.data || {};
  }

  async getHistoricalPrice(ticker, days = 365) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    const params = {
      from: endDate.toISOString().split('T')[0],
      to: startDate.toISOString().split('T')[0],
      limit: 0
    };
    const response = await this._getExodus(`/chartbit/${ticker}/price/daily`, params);
    let candles = response.data?.chartbit || [];
    // Ensure chronological order (oldest first)
    candles.sort((a, b) => new Date(a.date || a.datetime).getTime() - new Date(b.date || b.datetime).getTime());
    return candles;
  }

  async getIntradayPrice(ticker, timeframe = "5m", days = 1) {
    const tfMap = { "1m": 1, "5m": 5, "15m": 15, "1h": 60, "4h": 240 };
    const targetMinutes = tfMap[timeframe.toLowerCase()];
    if (!targetMinutes) throw new Error(`Unsupported timeframe: ${timeframe}`);

    const endTs = Math.floor(Date.now() / 1000);
    const startTs = endTs - (days * 24 * 60 * 60);
    const params = { from: endTs, to: startTs, limit: 0, minutes_multiplier: 1 };
    
    const rawData = await this._getExodus(`/chartbit/${ticker}/price/intraday`, params);
    let candles = rawData.data?.chartbit || [];
    candles.sort((a, b) => (a.time || a.datetime || 0) - (b.time || b.datetime || 0));
    
    if (targetMinutes === 1) return candles;
    return this._resampleOhlcv(candles, targetMinutes);
  }

  _resampleOhlcv(candles, targetMinutes) {
    if (!candles || candles.length === 0) return [];
    const getTs = (c) => {
      const val = c.datetime || c.time || 0;
      if (typeof val === 'number') return val;
      try { return Math.floor(new Date(val.replace("Z", "+00:00")).getTime() / 1000); }
      catch (e) { return 0; }
    };

    const sorted = [...candles].sort((a, b) => getTs(a) - getTs(b));
    const resampled = [];
    let currentBucket = null;
    let agg = { open: null, high: -Infinity, low: Infinity, close: null, volume: 0 };

    for (const candle of sorted) {
      const ts = getTs(candle);
      if (ts === 0) continue;
      const intervalSecs = targetMinutes * 60;
      const bucketStartTs = Math.floor(ts / intervalSecs) * intervalSecs;

      if (currentBucket !== null && bucketStartTs !== currentBucket) {
        resampled.push({ timestamp: currentBucket, ...agg });
        agg = { open: null, high: -Infinity, low: Infinity, close: null, volume: 0 };
      }
      currentBucket = bucketStartTs;
      agg.open = agg.open === null ? parseFloat(candle.open) : agg.open;
      agg.high = Math.max(agg.high, parseFloat(candle.high));
      agg.low = Math.min(agg.low, parseFloat(candle.low));
      agg.close = parseFloat(candle.close);
      agg.volume += parseFloat(candle.volume);
    }
    if (currentBucket !== null) resampled.push({ timestamp: currentBucket, ...agg });
    return resampled;
  }

  // ==========================================
  // INDICATOR CALCULATORS
  // ==========================================

  _calcSMA(data, period, key = 'close') {
    if (data.length < period) return null;
    const slice = data.slice(data.length - period);
    const sum = slice.reduce((acc, val) => acc + (val[key] || 0), 0);
    return sum / period;
  }

  _calcRSI(data, period = 14, key = 'close') {
    if (data.length <= period) return null;
    
    let sumGain = 0, sumLoss = 0;
    
    // 1. Calculate initial SMA for the first 'period' bars
    for (let i = 1; i <= period; i++) {
      const diff = data[i][key] - data[i-1][key];
      if (diff >= 0) sumGain += diff;
      else sumLoss -= diff;
    }
    
    let avgGain = sumGain / period;
    let avgLoss = sumLoss / period;
    
    // 2. Calculate Smoothed Moving Average (RMA) for the rest of the historical dataset
    for (let i = period + 1; i < data.length; i++) {
      const diff = data[i][key] - data[i-1][key];
      const gain = diff >= 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;
      
      avgGain = ((avgGain * (period - 1)) + gain) / period;
      avgLoss = ((avgLoss * (period - 1)) + loss) / period;
    }
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  _calcBollingerBands(data, period = 20, stdDev = 2, key = 'close') {
    if (data.length < period) return null;
    const slice = data.slice(data.length - period);
    const sum = slice.reduce((acc, val) => acc + (parseFloat(val[key]) || 0), 0);
    const sma = sum / period;
    
    const variance = slice.reduce((acc, val) => acc + Math.pow((parseFloat(val[key]) || 0) - sma, 2), 0) / period;
    const sd = Math.sqrt(variance);
    
    return {
      upper: sma + (stdDev * sd),
      middle: sma,
      lower: sma - (stdDev * sd)
    };
  }

  _calcMACD(data, fast = 12, slow = 26, signal = 9, key = 'close') {
    if (data.length < slow + signal) return null;
    
    const kFast = 2 / (fast + 1);
    const kSlow = 2 / (slow + 1);
    const emaFastArr = new Array(data.length).fill(null);
    const emaSlowArr = new Array(data.length).fill(null);
    
    let sumF = 0; for(let i=0; i<fast; i++) sumF += (parseFloat(data[i][key]) || 0);
    emaFastArr[fast-1] = sumF / fast;
    for(let i=fast; i<data.length; i++) {
      emaFastArr[i] = ((parseFloat(data[i][key]) || 0) - emaFastArr[i-1]) * kFast + emaFastArr[i-1];
    }
    
    let sumS = 0; for(let i=0; i<slow; i++) sumS += (parseFloat(data[i][key]) || 0);
    emaSlowArr[slow-1] = sumS / slow;
    for(let i=slow; i<data.length; i++) {
      emaSlowArr[i] = ((parseFloat(data[i][key]) || 0) - emaSlowArr[i-1]) * kSlow + emaSlowArr[i-1];
    }
    
    const macdLineArr = [];
    for(let i=slow-1; i<data.length; i++) {
      macdLineArr.push(emaFastArr[i] - emaSlowArr[i]);
    }
    
    let sumSig = 0; for(let i=0; i<signal; i++) sumSig += macdLineArr[i];
    let emaSig = sumSig / signal;
    for(let i=signal; i<macdLineArr.length; i++) {
      emaSig = (macdLineArr[i] - emaSig) * (2 / (signal + 1)) + emaSig;
    }
    
    return { 
      MACD: macdLineArr[macdLineArr.length - 1], 
      Signal: emaSig, 
      Histogram: macdLineArr[macdLineArr.length - 1] - emaSig 
    };
  }

  _calcVWAP(data) {
    if (!data || data.length === 0) return null;
    let cumPriceVol = 0;
    let cumVol = 0;
    for (const c of data) {
      const typicalPrice = (c.high + c.low + c.close) / 3;
      cumPriceVol += typicalPrice * c.volume;
      cumVol += c.volume;
    }
    if (cumVol === 0) return null;
    return cumPriceVol / cumVol;
  }

  _calcFibonacci(high, low) {
    const diff = high - low;
    return {
      "High (0.0)": high,
      "Fibo 0.236": high - (diff * 0.236),
      "Fibo 0.382": high - (diff * 0.382),
      "Fibo 0.500": high - (diff * 0.5),
      "Fibo 0.618 (Golden)": high - (diff * 0.618),
      "Fibo 0.786": high - (diff * 0.786),
      "Low (1.0)": low,
      "Ext 1.618 (Target)": high + (diff * 0.618)
    };
  }

  _calcSMC(data) {
    if (data.length < 5) return null;
    
    let swingHighs = [];
    let swingLows = [];
    
    for (let i = 2; i < data.length - 2; i++) {
      let isHigh = data[i].high > data[i-1].high && data[i].high > data[i-2].high && 
                   data[i].high > data[i+1].high && data[i].high > data[i+2].high;
      if (isHigh) swingHighs.push({ index: i, price: data[i].high });
      
      let isLow = data[i].low < data[i-1].low && data[i].low < data[i-2].low && 
                  data[i].low < data[i+1].low && data[i].low < data[i+2].low;
      if (isLow) swingLows.push({ index: i, price: data[i].low });
    }
    
    let lastSwingHigh = swingHighs.length > 0 ? swingHighs[swingHighs.length - 1].price : null;
    let lastSwingLow = swingLows.length > 0 ? swingLows[swingLows.length - 1].price : null;
    
    let currentPrice = data[data.length - 1].close;
    let structureState = "Consolidation";
    if (lastSwingHigh && currentPrice > lastSwingHigh) structureState = "Bullish BoS / CHoCH";
    else if (lastSwingLow && currentPrice < lastSwingLow) structureState = "Bearish BoS / CHoCH";
    else if (lastSwingHigh && lastSwingLow) {
        if (currentPrice > (lastSwingHigh + lastSwingLow)/2) structureState = "Premium (Bearish Bias)";
        else structureState = "Discount (Bullish Bias)";
    }

    let fvgs = [];
    for (let i = 2; i < data.length; i++) {
      if (data[i].low > data[i-2].high) {
         fvgs.push({ type: 'Bullish', top: data[i].low, bottom: data[i-2].high, age: data.length - 1 - i });
      }
      else if (data[i].high < data[i-2].low) {
         fvgs.push({ type: 'Bearish', top: data[i-2].low, bottom: data[i].high, age: data.length - 1 - i });
      }
    }
    
    let unmitigatedFVGs = [];
    for (let fvg of fvgs) {
      let isMitigated = false;
      for(let j = data.length - fvg.age; j < data.length; j++) {
         if (fvg.type === 'Bullish' && data[j].low <= fvg.top) isMitigated = true;
         if (fvg.type === 'Bearish' && data[j].high >= fvg.bottom) isMitigated = true;
      }
      if (!isMitigated) unmitigatedFVGs.push(fvg);
    }
    
    let recentFVGs = unmitigatedFVGs.slice(-3).map(f => `${f.type} FVG: ${f.bottom} - ${f.top}`);
    
    return {
      lastSwingHigh: lastSwingHigh,
      lastSwingLow: lastSwingLow,
      structure: structureState,
      unmitigatedFVGs: recentFVGs
    };
  }

  _getHighLow(data) {
    if (!data || data.length === 0) return { high: 0, low: 0 };
    let high = -Infinity, low = Infinity;
    data.forEach(c => {
      if (c.high > high) high = c.high;
      if (c.low < low) low = c.low;
    });
    return { high, low };
  }

  // ==========================================
  // CONTEXT-AWARE ANALYSIS
  // ==========================================

  _calcATR(data, period = 14) {
    if (!data || data.length < period) return null;
    let trs = [];
    for (let i = 1; i < data.length; i++) {
        let high = parseFloat(data[i].high);
        let low = parseFloat(data[i].low);
        let prevClose = parseFloat(data[i-1].close);
        let tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
        trs.push(tr);
    }
    return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
  }

  _calcVolumeProfile(data, bins = 10) {
    if (!data || data.length === 0) return null;
    let max = -Infinity, min = Infinity;
    for (let c of data) {
        let h = parseFloat(c.high), l = parseFloat(c.low);
        if (h > max) max = h;
        if (l < min) min = l;
    }
    let step = (max - min) / bins;
    if (step === 0) return { poc: data[0].close, supportArea: `${min} - ${max}` };
    
    let profile = Array(bins).fill(0).map((_, i) => ({ priceStart: min + i*step, priceEnd: min + (i+1)*step, volume: 0 }));
    for (let c of data) {
        let typPrice = (parseFloat(c.high) + parseFloat(c.low) + parseFloat(c.close)) / 3;
        let vol = parseFloat(c.volume) || 0;
        let idx = Math.floor((typPrice - min) / step);
        if (idx >= bins) idx = bins - 1;
        if (idx < 0) idx = 0;
        profile[idx].volume += vol;
    }
    let poc = profile.reduce((prev, curr) => (prev.volume > curr.volume) ? prev : curr);
    return {
        poc: (poc.priceStart + poc.priceEnd) / 2,
        supportArea: `${poc.priceStart.toFixed(0)} - ${poc.priceEnd.toFixed(0)}`
    };
  }

  async getAnalysis(ticker, mode = 'swing') {
    let dailyData = [];
    if (['intraday', 'short_swing', 'swing', 'longterm'].includes(mode)) {
        dailyData = await this.getHistoricalPrice(ticker, 365);
    }
    
    const getWeeklyData = (daily) => {
        let weekly = [];
        let currentWeek = -1;
        let agg = null;
        for (let c of daily) {
            let d = new Date(c.date || c.datetime);
            let year = d.getFullYear();
            let start = new Date(year, 0, 1);
            let week = Math.ceil((((d - start) / 86400000) + start.getDay() + 1) / 7);
            let weekId = year * 100 + week;
            if (weekId !== currentWeek) {
                if (agg) weekly.push(agg);
                currentWeek = weekId;
                agg = { ...c, high: parseFloat(c.high), low: parseFloat(c.low), close: parseFloat(c.close), open: parseFloat(c.open) };
            } else {
                agg.high = Math.max(agg.high, parseFloat(c.high));
                agg.low = Math.min(agg.low, parseFloat(c.low));
                agg.close = parseFloat(c.close);
            }
        }
        if (agg) weekly.push(agg);
        return weekly;
    };

    if (mode === 'intraday') {
      const data = await this.getIntradayPrice(ticker, '5m', 3);
      const h1Data = await this.getIntradayPrice(ticker, '1h', 7);
      if (data.length === 0) return { error: "No intraday data found" };
      
      const lastPrice = data[data.length - 1].close;
      const todayStr = new Date().toISOString().split('T')[0];
      const todayData = data.filter(c => (c.time || c.datetime || '').startsWith(todayStr));
      const activeData = todayData.length > 0 ? todayData : data;
      const hl = this._getHighLow(activeData);
      
      return {
        mode: 'INTRADAY_MTF',
        timeframe: 'Edge(5m) / Structural(1h) / Macro(D1)',
        lastPrice,
        atr14: this._calcATR(data, 14),
        volumeProfilePOC: this._calcVolumeProfile(data, 10),
        vwap: this._calcVWAP(activeData),
        ma9: this._calcSMA(data, 9),
        ma21: this._calcSMA(data, 21),
        macd: this._calcMACD(data),
        bollingerBands: this._calcBollingerBands(data),
        SMC_Macro_D1: dailyData.length > 0 ? this._calcSMC(dailyData) : null,
        SMC_Structural_H1: h1Data.length > 0 ? this._calcSMC(h1Data) : null,
        SMC_Edge_M5: this._calcSMC(data),
        dayHighLow: hl,
        fibonacci: this._calcFibonacci(hl.high, hl.low)
      };
    } 
    else if (mode === 'short_swing') {
      const data = await this.getIntradayPrice(ticker, '15m', 7);
      const h1Data = await this.getIntradayPrice(ticker, '1h', 7);
      if (data.length === 0) return { error: "No short_swing data found" };
      
      const lastPrice = data[data.length - 1].close;
      const todayStr = new Date().toISOString().split('T')[0];
      const todayData = data.filter(c => (c.time || c.datetime || '').startsWith(todayStr));
      const activeData = todayData.length > 0 ? todayData : data.slice(-28);
      const hl = this._getHighLow(data);
      
      return {
        mode: 'SHORT_SWING_MTF',
        timeframe: 'Edge(15m) / Structural(1h) / Macro(D1)',
        lastPrice,
        atr14: this._calcATR(data, 14),
        volumeProfilePOC: this._calcVolumeProfile(data, 10),
        vwap: this._calcVWAP(activeData),
        ma10: this._calcSMA(data, 10),
        ma20: this._calcSMA(data, 20),
        ma50: this._calcSMA(data, 50),
        rsi14: this._calcRSI(data, 14),
        macd: this._calcMACD(data),
        bollingerBands: this._calcBollingerBands(data),
        SMC_Macro_D1: dailyData.length > 0 ? this._calcSMC(dailyData) : null,
        SMC_Structural_H1: h1Data.length > 0 ? this._calcSMC(h1Data) : null,
        SMC_Edge_M15: this._calcSMC(data),
        swingHighLow: hl,
        fibonacci: this._calcFibonacci(hl.high, hl.low)
      };
    }
    else if (mode === 'swing') {
      const data = await this.getHistoricalPrice(ticker, 90);
      const h4Data = await this.getIntradayPrice(ticker, '4h', 30);
      const weeklyData = getWeeklyData(dailyData);
      
      if (data.length === 0) return { error: "No historical data found" };
      
      const lastPrice = data[data.length - 1].close;
      const hl = this._getHighLow(data);
      
      return {
        mode: 'SWING_MTF',
        timeframe: 'Edge(4h) / Structural(D1) / Macro(W1)',
        lastPrice,
        atr14: this._calcATR(data, 14),
        volumeProfilePOC: this._calcVolumeProfile(data, 10),
        ma10: this._calcSMA(data, 10),
        ma20: this._calcSMA(data, 20),
        ma50: this._calcSMA(data, 50),
        rsi14: this._calcRSI(data, 14),
        macd: this._calcMACD(data),
        bollingerBands: this._calcBollingerBands(data),
        SMC_Macro_W1: weeklyData.length > 0 ? this._calcSMC(weeklyData) : null,
        SMC_Structural_D1: this._calcSMC(data),
        SMC_Edge_H4: h4Data.length > 0 ? this._calcSMC(h4Data) : null,
        swingHighLow: hl,
        fibonacci: this._calcFibonacci(hl.high, hl.low)
      };
    }
    else if (mode === 'longterm') {
      const data = await this.getHistoricalPrice(ticker, 365);
      const weeklyData = getWeeklyData(dailyData);
      
      if (data.length === 0) return { error: "No historical data found" };
      
      const lastPrice = data[data.length - 1].close;
      const hl = this._getHighLow(data);
      
      return {
        mode: 'LONGTERM_MTF',
        timeframe: 'Edge(D1) / Structural(W1) / Macro(M1)',
        lastPrice,
        atr14: this._calcATR(data, 14),
        volumeProfilePOC: this._calcVolumeProfile(data, 10),
        ma50: this._calcSMA(data, 50),
        ma200: this._calcSMA(data, 200),
        rsi14: this._calcRSI(data, 14),
        macd: this._calcMACD(data),
        bollingerBands: this._calcBollingerBands(data),
        SMC_Macro_W1: weeklyData.length > 0 ? this._calcSMC(weeklyData) : null,
        SMC_Structural_W1: weeklyData.length > 0 ? this._calcSMC(weeklyData) : null,
        SMC_Edge_D1: this._calcSMC(data),
        yearHighLow: hl,
        fibonacci: this._calcFibonacci(hl.high, hl.low)
      };
    }
  }
}


if (require.main === module) {
  (async () => {
    const api = new TechnicalAPIClient();
    try {
      await api.login();
      const ticker = process.argv[2] || "BBCA";
      const mode = process.argv[3] || "swing";
      const data = await api.getAnalysis(ticker, mode);
      console.log(`Technical Analysis [${mode.toUpperCase()}] for ${ticker}:`);
      console.log(JSON.stringify(data, null, 2));
    } catch (e) {
      console.error(e.message);
    }
  })();
}
module.exports = { TechnicalAPIClient };
