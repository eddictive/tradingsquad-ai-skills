const { StockbitClient } = require('../../../core/stockbit-auth.js');

class ScannerAPIClient extends StockbitClient {
  /**
   * Fetch Market Mover
   * mover_type: MOVER_TYPE_TOP_GAINER, MOVER_TYPE_NET_FOREIGN_BUY, etc.
   */
  async getMarketMover(moverType = 'MOVER_TYPE_NET_FOREIGN_BUY') {
    const params = {
      mover_type: moverType,
      filter_stocks: [
        'FILTER_STOCKS_TYPE_MAIN_BOARD',
        'FILTER_STOCKS_TYPE_DEVELOPMENT_BOARD'
      ]
    };
    const response = await this._getExodus('/order-trade/market-mover', params);
    if (!response.data || !response.data.mover_list) return [];
    
    return response.data.mover_list.slice(0, 10).map(m => ({
      ticker: m.stock_detail.code,
      price: m.price,
      change_percent: m.change.percentage.toFixed(2) + '%',
      foreign_buy: m.net_foreign_buy ? m.net_foreign_buy.formatted : '-',
      value: m.value.formatted
    }));
  }

  /**
   * Fetch Top Stocks by Order Trade
   */
  async getTopStock(startDate, endDate, investorType = 'INVESTOR_TYPE_FOREIGN') {
    const params = {
      start: startDate,
      end: endDate,
      investor_type: investorType,
      market_type: 'MARKET_TYPE_REGULER',
      value_type: 'VALUE_TYPE_NET',
      page: 1
    };
    const response = await this._getExodus('/order-trade/top-stock', params);
    if (!response.data || !response.data.top_buy) return { buy: [], sell: [] };
    
    const topBuy = response.data.top_buy.slice(0, 10).map(b => ({
      ticker: b.code,
      value: b.value.formatted,
      avg_price: b.average.formatted
    }));
    
    const topSell = (response.data.top_sell || []).slice(0, 10).map(s => ({
      ticker: s.code,
      value: s.value.formatted,
      avg_price: s.average.formatted
    }));

    return { topBuy, topSell };
  }

  /**
   * Run custom Screener Templates
   * @param {string} template 'ACCUMULATION' or 'REBOUND'
   */
  async runScreener(template = 'ACCUMULATION') {
    let payload = {};
    if (template === 'ACCUMULATION') {
      payload = {
        name: "ISSI - Big Accumulation",
        description: "",
        save: "0",
        ordertype: "DESC",
        ordercol: 3,
        page: 1,
        universe: "{\"scope\":\"idx\",\"scopeID\":\"558\",\"name\":\"IHSG\"}",
        filters: "[{\"type\":\"basic\",\"item1\":14400,\"item1name\":\"Bandar Accum/Dist\",\"operator\":\">\",\"item2\":\"20\",\"item2name\":\"\",\"multiplier\":\"0\"},{\"type\":\"basic\",\"item1\":13620,\"item1name\":\"Value\",\"operator\":\">\",\"item2\":\"3000000000\",\"item2name\":\"\",\"multiplier\":\"0\"},{\"type\":\"basic\",\"item1\":2661,\"item1name\":\"Price\",\"operator\":\">=\",\"item2\":\"50\",\"item2name\":\"\",\"multiplier\":\"0\"}]",
        sequence: "14400,13620,2661",
        screenerid: "0",
        type: "TEMPLATE_TYPE_CUSTOM"
      };
    } else if (template === 'REBOUND') {
      payload = {
        name: "Price Momentum (Rebound Hunter)",
        description: "",
        save: "0",
        ordertype: "DESC",
        ordercol: 2,
        page: 1,
        universe: "{\"scope\":\"idx\",\"scopeID\":\"558\",\"name\":\"ISSI\"}",
        filters: "[{\"type\":\"basic\",\"item1\":16454,\"item1name\":\"Value MA 20\",\"operator\":\">\",\"item2\":\"1000000000\",\"item2name\":\"\",\"multiplier\":\"0\"},{\"type\":\"compare\",\"item1\":2661,\"item1name\":\"Price\",\"operator\":\">=\",\"multiplier\":\"1\",\"item2\":12460,\"item2name\":\"Price MA 50\"},{\"type\":\"basic\",\"item1\":12148,\"item1name\":\"Current PE Ratio (Annualised)\",\"operator\":\">\",\"item2\":\"0\",\"multiplier\":\"\"}]",
        sequence: "16454,2661,12460,12148",
        screenerid: "0",
        type: "TEMPLATE_TYPE_CUSTOM"
      };
    }

    const response = await this._postExodus('/screener/templates', payload);
    if (!response.data || !response.data.calcs) return [];

    return response.data.calcs.slice(0, 10).map(c => {
      let resultObj = { ticker: c.company.symbol };
      c.results.forEach(r => {
        resultObj[r.item] = r.display;
      });
      return resultObj;
    });
  }

  /**
   * Calculate Live Intraday Draggers from Top Big Caps
   */
  async getLiveDraggers() {
    const giants = ['BBCA', 'BBRI', 'BMRI', 'BBNI', 'TLKM', 'ASII', 'AMMN', 'BREN', 'TPIA', 'BYAN', 'DSSA', 'KLBF', 'UNVR', 'ICBP', 'GOTO', 'ADRO'];
    const results = [];
    const endTs = Math.floor(Date.now() / 1000);
    const startTs = endTs - (24 * 60 * 60);
    
    // Konversi ke format string YYYY-MM-DD sesuai zona waktu lokal bursa (WIB)
    // Date.now() di server mungkin UTC, maka sesuaikan ke UTC+7 (25200 detik)
    const wibDate = new Date(Date.now() + 25200000);
    const todayStr = wibDate.toISOString().split('T')[0];

    for (const ticker of giants) {
      try {
        const rawData = await this._getExodus(`/chartbit/${ticker}/price/intraday`, {
          from: endTs,
          to: startTs,
          limit: 0,
          minutes_multiplier: 1
        });
        const candles = rawData?.data?.chartbit || [];
        const todayCandles = candles.filter(c => (c.datetime || '').startsWith(todayStr));
        
        if (todayCandles.length > 0) {
          todayCandles.sort((a,b) => a.unix_timestamp - b.unix_timestamp);
          const open = todayCandles[0].open;
          const close = todayCandles[todayCandles.length - 1].close;
          const change = ((close - open) / open) * 100;
          results.push({ ticker, open, close, changePercent: change.toFixed(2) + '%' });
        }
      } catch (e) {}
    }
    const lifters = results.filter(r => parseFloat(r.changePercent) >= 0)
                           .sort((a, b) => parseFloat(b.changePercent) - parseFloat(a.changePercent));
    const draggers = results.filter(r => parseFloat(r.changePercent) < 0)
                            .sort((a, b) => parseFloat(a.changePercent) - parseFloat(b.changePercent));
    
    return { lifters, draggers };
  }
}

if (require.main === module) {
  (async () => {
    const api = new ScannerAPIClient();
    try {
      await api.login();
      const action = process.argv[2] || 'mover';
      
      if (action === 'mover') {
        const type = process.argv[3] || 'MOVER_TYPE_NET_FOREIGN_BUY';
        const data = await api.getMarketMover(type);
        console.log(`Top Movers [${type}]:`, JSON.stringify(data, null, 2));
      } else if (action === 'topstock') {
        const start = process.argv[3] || '2026-06-26';
        const end = process.argv[4] || '2026-06-26';
        const data = await api.getTopStock(start, end);
        console.log(`Top Foreign Stock (${start} to ${end}):`, JSON.stringify(data, null, 2));
      } else if (action === 'screener') {
        const type = process.argv[3] || 'ACCUMULATION';
        const data = await api.runScreener(type);
        console.log(`Screener [${type}]:`, JSON.stringify(data, null, 2));
      } else if (action === 'livedraggers') {
        const data = await api.getLiveDraggers();
        console.log(`Live Big Caps Draggers:`, JSON.stringify(data, null, 2));
      }
    } catch (e) {
      console.error(e.message);
    }
  })();
}

module.exports = { ScannerAPIClient };
