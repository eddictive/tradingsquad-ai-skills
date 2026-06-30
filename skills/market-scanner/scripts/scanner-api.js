const { StockbitClient } = require('../../../core/stockbit-auth.js');

class ScannerAPIClient extends StockbitClient {
  /**
   * Fetch Market Mover
   * mover_type: MOVER_TYPE_TOP_GAINER, MOVER_TYPE_TOP_LOSER, MOVER_TYPE_TOP_VALUE, MOVER_TYPE_TOP_VOLUME, MOVER_TYPE_NET_FOREIGN_BUY, MOVER_TYPE_NET_FOREIGN_SELL, etc.
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
        filters: "[{\"type\":\"basic\",\"item1\":14400,\"item1name\":\"Bandar Accum/Dist\",\"operator\":\">\",\"item2\":\"20\",\"item2name\":\"\",\"multiplier\":\"0\"},{\"type\":\"basic\",\"item1\":13620,\"item1name\":\"Value\",\"operator\":\">\",\"item2\":\"3000000000\",\"item2name\":\"\",\"multiplier\":\"0\"},{\"type\":\"basic\",\"item1\":2661,\"item1name\":\"Price\",\"operator\":\">=\",\"item2\":\"100\",\"item2name\":\"\",\"multiplier\":\"0\"}]",
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

  /**
   * Get Top Broker
   */
  async getTopBroker(period = 'TB_PERIOD_LAST_1_DAY') {
    const params = {
      sort: 'TB_SORT_BY_TOTAL_VALUE',
      order: 'ORDER_BY_DESC',
      period,
      market_type: 'MARKET_TYPE_REGULER'
    };
    const response = await this._getExodus('/order-trade/broker/top', params);
    if (!response.data || !response.data.list) return [];
    
    return response.data.list.slice(0, 10).map(b => ({
      broker_code: b.code,
      name: b.name,
      total_value: b.total_value,
      net_value: b.net_value,
      group: b.group
    }));
  }

  /**
   * Get Whale Activity (Broker Market Detector)
   */
  async getWhaleActivity(brokerCode) {
    const params = {
      limit: 50,
      transaction_type: 'TRANSACTION_TYPE_NET',
      market_board: 'MARKET_BOARD_REGULER',
      investor_type: 'INVESTOR_TYPE_ALL'
    };
    const response = await this._getExodus(`/findata-view/marketdetectors/activity/${brokerCode}/detail`, params);
    if (!response.data || !response.data.broker_summary) return { buy: [], sell: [] };
    
    const summary = response.data.broker_summary;
    const formatNetbs = (arr) => arr.map(i => ({
      ticker: i.netbs_stock_code,
      avg_price: i.netbs_buy_avg_price || i.netbs_sell_avg_price,
      value: i.bval || i.sval
    })).sort((a, b) => Math.abs(parseFloat(b.value)) - Math.abs(parseFloat(a.value))).slice(0, 10);

    return {
      bandar_detector: response.data.bandar_detector || {},
      top_buy: formatNetbs(summary.brokers_buy || []),
      top_sell: formatNetbs(summary.brokers_sell || [])
    };
  }

  /**
   * Get Trending Stocks (Crowd Sentiment)
   */
  async getTrending() {
    const response = await this._getExodus('/emitten/trending');
    if (!response.data || !response.data.list) return [];
    return response.data.list.slice(0, 15).map(t => ({
      ticker: t.code,
      company_name: t.name,
      rank_change: t.rank_change
    }));
  }

  /**
   * Get Symbol Detector (Bandar Detector & Broker Summary for a specific stock)
   */
  async getSymbolDetector(ticker, period = 'BROKER_SUMMARY_PERIOD_LATEST') {
    const params = {
      transaction_type: 'TRANSACTION_TYPE_NET',
      market_board: 'MARKET_BOARD_REGULER',
      investor_type: 'INVESTOR_TYPE_ALL',
      limit: 25,
      period: period
    };
    const response = await this._getExodus(`/marketdetectors/${ticker}`, params);
    if (!response.data) return null;
    return response.data;
  }

  /**
   * Get Running Trade for specific symbols
   * @param {string[]} symbols Array of tickers, e.g. ['CUAN', 'BREN']
   */
  async getRunningTrade(symbols, limit = 50) {
    // Manually construct query params because of array brackets like symbols[]=A&symbols[]=B
    let queryString = `action_type=RUNNING_TRADE_ACTION_TYPE_ALL&sort=DESC&limit=${limit}&order_by=RUNNING_TRADE_ORDER_BY_TIME`;
    if (symbols && symbols.length > 0) {
      symbols.forEach(s => {
        queryString += `&symbols[]=${s}`;
      });
    }
    const response = await this._getExodus(`/order-trade/running-trade?${queryString}`);
    if (!response.data || !response.data.running_trade) return [];
    
    return response.data.running_trade.map(rt => ({
      time: rt.time,
      action: rt.action,
      ticker: rt.code,
      price: rt.price,
      lot: rt.lot,
      buyer: rt.buyer,
      seller: rt.seller,
      market_board: rt.market_board
    }));
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
      } else if (action === 'topbroker') {
        const period = process.argv[3] || 'TB_PERIOD_LAST_1_DAY';
        const data = await api.getTopBroker(period);
        console.log(`Top Brokers [${period}]:`, JSON.stringify(data, null, 2));
      } else if (action === 'whale') {
        const broker = process.argv[3];
        if (!broker) throw new Error('Provide broker code, e.g. node scanner-api.js whale AK');
        const data = await api.getWhaleActivity(broker);
        console.log(`Whale Activity [${broker}]:`, JSON.stringify(data, null, 2));
      } else if (action === 'trending') {
        const data = await api.getTrending();
        console.log(`Trending Stocks:`, JSON.stringify(data, null, 2));
      } else if (action === 'detector') {
        const ticker = process.argv[3];
        if (!ticker) throw new Error('Provide ticker code, e.g. node scanner-api.js detector CUAN');
        const period = process.argv[4] || 'BROKER_SUMMARY_PERIOD_LATEST';
        const data = await api.getSymbolDetector(ticker, period);
        console.log(`Symbol Detector [${ticker}]:`, JSON.stringify(data, null, 2));
      } else if (action === 'tape') {
        const symbolsArg = process.argv[3]; // e.g. "CUAN,BREN"
        const symbols = symbolsArg ? symbolsArg.split(',') : [];
        const limit = parseInt(process.argv[4] || '20', 10);
        const data = await api.getRunningTrade(symbols, limit);
        console.log(`Running Trade Tape:`, JSON.stringify(data, null, 2));
      }
    } catch (e) {
      console.error(e.message);
    }
  })();
}

module.exports = { ScannerAPIClient };
