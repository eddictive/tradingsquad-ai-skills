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
    let gains = 0, losses = 0;
    for (let i = data.length - period; i < data.length; i++) {
      const diff = data[i][key] - data[i-1][key];
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
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

  async getAnalysis(ticker, mode = 'swing') {
    if (mode === 'intraday') {
      const data = await this.getIntradayPrice(ticker, '5m', 3);
      if (data.length === 0) return { error: "No intraday data found" };
      
      const lastPrice = data[data.length - 1].close;
      
      const todayStr = new Date().toISOString().split('T')[0];
      const todayData = data.filter(c => (c.time || c.datetime || '').startsWith(todayStr));
      const activeData = todayData.length > 0 ? todayData : data;
      const hl = this._getHighLow(activeData);
      
      return {
        mode: 'INTRADAY',
        timeframe: '5m',
        lastPrice,
        vwap: this._calcVWAP(activeData),
        ma9: this._calcSMA(data, 9),
        ma21: this._calcSMA(data, 21),
        dayHighLow: hl,
        fibonacci: this._calcFibonacci(hl.high, hl.low)
      };
    } 
    else if (mode === 'swing') {
      const data = await this.getHistoricalPrice(ticker, 90);
      if (data.length === 0) return { error: "No historical data found" };
      
      const lastPrice = data[data.length - 1].close;
      const hl = this._getHighLow(data);
      
      return {
        mode: 'SWING',
        timeframe: 'Daily',
        period: '3 Months',
        lastPrice,
        ma10: this._calcSMA(data, 10),
        ma20: this._calcSMA(data, 20),
        ma50: this._calcSMA(data, 50),
        rsi14: this._calcRSI(data, 14),
        swingHighLow: hl,
        fibonacci: this._calcFibonacci(hl.high, hl.low)
      };
    }
    else if (mode === 'longterm') {
      const data = await this.getHistoricalPrice(ticker, 365);
      if (data.length === 0) return { error: "No historical data found" };
      
      const lastPrice = data[data.length - 1].close;
      const hl = this._getHighLow(data);
      
      return {
        mode: 'LONG-TERM',
        timeframe: 'Daily',
        period: '1 Year',
        lastPrice,
        ma50: this._calcSMA(data, 50),
        ma200: this._calcSMA(data, 200),
        rsi14: this._calcRSI(data, 14),
        yearHighLow: hl,
        fibonacci: this._calcFibonacci(hl.high, hl.low)
      };
    }
    else if (mode === 'short_swing') {
      const data = await this.getIntradayPrice(ticker, '1h', 7);
      if (data.length === 0) return { error: "No short_swing data found" };
      
      const lastPrice = data[data.length - 1].close;
      const hl = this._getHighLow(data);
      
      return {
        mode: 'SHORT_SWING',
        timeframe: '1h',
        period: '7 Days',
        lastPrice,
        vwap: this._calcVWAP(data),
        ma10: this._calcSMA(data, 10),
        ma20: this._calcSMA(data, 20),
        ma50: this._calcSMA(data, 50),
        rsi14: this._calcRSI(data, 14),
        swingHighLow: hl,
        fibonacci: this._calcFibonacci(hl.high, hl.low)
      };
    }
    else {
      throw new Error("Invalid mode. Use 'intraday', 'short_swing', 'swing', or 'longterm'.");
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
