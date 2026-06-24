const { StockbitClient } = require('../../../core/stockbit-auth.js');

class TechnicalAPIClient extends StockbitClient {
  async getStockPrice(ticker) {
    const data = await this._getExodus(`/emitten/${ticker}/info`);
    return data.data || {};
  }

  async getHistoricalPrice(ticker, days = 30) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    const params = {
      from: startDate.toISOString().split('T')[0],
      to: endDate.toISOString().split('T')[0],
      limit: 0
    };
    const data = await this._getExodus(`/chartbit/${ticker}/price/daily`, params);
    return data.data || [];
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
        const dt = new Date(currentBucket * 1000).toISOString().replace('T', ' ').substring(0, 19);
        resampled.push({ timestamp: currentBucket, datetime: dt, ...agg });
        agg = { open: null, high: -Infinity, low: Infinity, close: null, volume: 0 };
      }
      currentBucket = bucketStartTs;
      const cOpen = candle.open ? parseFloat(candle.open) : 0;
      const cHigh = candle.high ? parseFloat(candle.high) : 0;
      const cLow = candle.low ? parseFloat(candle.low) : 0;
      const cClose = candle.close ? parseFloat(candle.close) : 0;
      const cVol = candle.volume ? parseFloat(candle.volume) : 0;

      if (agg.open === null) agg.open = cOpen;
      agg.high = Math.max(agg.high, cHigh);
      agg.low = Math.min(agg.low, cLow);
      agg.close = cClose;
      agg.volume += cVol;
    }
    if (currentBucket !== null) {
      const dt = new Date(currentBucket * 1000).toISOString().replace('T', ' ').substring(0, 19);
      resampled.push({ timestamp: currentBucket, datetime: dt, ...agg });
    }
    return resampled;
  }

  async getIntradayPrice(ticker, timeframe = "15m", days = 3) {
    const tfMap = { "1m": 1, "5m": 5, "15m": 15, "1h": 60, "4h": 240, "12h": 720 };
    const targetMinutes = tfMap[timeframe.toLowerCase()];
    if (!targetMinutes) throw new Error(`Unsupported timeframe: ${timeframe}`);

    const endTs = Math.floor(Date.now() / 1000);
    const startTs = endTs - (days * 24 * 60 * 60);
    const params = { from: startTs, to: endTs, limit: 0, minutes_multiplier: 1 };
    
    const rawData = await this._getExodus(`/chartbit/${ticker}/price/intraday`, params);
    const candles = rawData.data || [];
    if (targetMinutes === 1) return candles;
    return this._resampleOhlcv(candles, targetMinutes);
  }
}

if (require.main === module) {
  (async () => {
    const api = new TechnicalAPIClient();
    try {
      await api.login();
      const data = await api.getHistoricalPrice("BBCA", 5);
      console.log("Technical Data Example (BBCA 1D):", data.slice(0, 3));
    } catch (e) {
      console.error(e.message);
    }
  })();
}
module.exports = { TechnicalAPIClient };
