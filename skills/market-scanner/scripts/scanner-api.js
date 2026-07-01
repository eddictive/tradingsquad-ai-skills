const { StockbitClient } = require('../../../core/stockbit-auth.js');
const { RULE_OF_FIVE, trimToRuleOfFive } = require('../../../core/rule-of-five.js');
const { getWIBDateString } = require('../../../core/wib.js');
const { mapPool } = require('../../../core/concurrency.js');
const fs = require('fs');
const path = require('path');

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
    
    return trimToRuleOfFive(response.data.mover_list).map(m => ({
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
  async getTopStock(startDate, endDate, investorType = 'INVESTOR_TYPE_FOREIGN', maxPages = 3) {
    let allTopBuy = [];
    let allTopSell = [];
    
    for (let page = 1; page <= maxPages; page++) {
        const params = {
          start: startDate,
          end: endDate,
          investor_type: investorType,
          market_type: 'MARKET_TYPE_REGULER',
          value_type: 'VALUE_TYPE_NET',
          page: page
        };
        const response = await this._getExodus('/order-trade/top-stock', params);
        if (!response.data) break;
        
        if (response.data.top_buy) {
            allTopBuy = allTopBuy.concat(response.data.top_buy);
        }
        if (response.data.top_sell) {
            allTopSell = allTopSell.concat(response.data.top_sell);
        }
        
        if (!response.data.top_buy && !response.data.top_sell) break;
    }
    
    const topBuy = trimToRuleOfFive(allTopBuy).map(b => ({
      ticker: b.code,
      value: b.value.formatted,
      avg_price: b.average.formatted
    }));
    
    const topSell = trimToRuleOfFive(allTopSell).map(s => ({
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
   * Calculate Live Intraday Draggers from a specific group
   */
  async getLiveDraggers(groupName = 'giants') {
    let giants = [];
    try {
      const emitensPath = path.join(__dirname, '../../../core/emitens.json');
      const emitensData = JSON.parse(fs.readFileSync(emitensPath, 'utf8'));
      giants = emitensData[groupName];
      if (!giants) throw new Error(`Group '${groupName}' not found in emitens.json`);
    } catch (e) {
      console.warn(`[WARN] Falling back to default giants. Error: ${e.message}`);
      giants = ['BBCA', 'BBRI', 'BMRI', 'BBNI', 'TLKM', 'ASII', 'AMMN', 'BREN', 'TPIA', 'BYAN', 'DSSA', 'KLBF', 'UNVR', 'ICBP', 'GOTO', 'ADRO'];
    }
    const endTs = Math.floor(Date.now() / 1000);
    const startTs = endTs - (5 * 24 * 60 * 60);
    const todayStr = getWIBDateString();

    const results = await mapPool(giants, 4, async (ticker) => {
      const rawData = await this._getExodus(`/chartbit/${ticker}/price/intraday`, {
        from: endTs,
        to: startTs,
        limit: 0,
        minutes_multiplier: 1,
      });
      const candles = rawData?.data?.chartbit || [];
      const todayCandles = candles.filter((c) => (c.datetime || '').startsWith(todayStr));
      const prevCandles = candles.filter((c) => !(c.datetime || '').startsWith(todayStr));

      if (todayCandles.length === 0 || prevCandles.length === 0) return null;

      todayCandles.sort((a, b) => a.unix_timestamp - b.unix_timestamp);
      prevCandles.sort((a, b) => a.unix_timestamp - b.unix_timestamp);

      const open = todayCandles[0].open;
      const prevClose = prevCandles[prevCandles.length - 1].close;
      const close = todayCandles[todayCandles.length - 1].close;
      const change = ((close - prevClose) / prevClose) * 100;
      return { ticker, open, prevClose, close, changePercent: change.toFixed(2) + '%' };
    });
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
    
    return trimToRuleOfFive(response.data.list).map(b => ({
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
    })).sort((a, b) => Math.abs(parseFloat(b.value)) - Math.abs(parseFloat(a.value)));
    const topBuy = trimToRuleOfFive(formatNetbs(summary.brokers_buy || []));
    const topSell = trimToRuleOfFive(formatNetbs(summary.brokers_sell || []));

    return {
      bandar_detector: response.data.bandar_detector || {},
      top_buy: topBuy,
      top_sell: topSell
    };
  }

  /**
   * Get Trending Stocks (Crowd Sentiment)
   */
  async getTrending() {
    const response = await this._getExodus('/emitten/trending');
    if (!response.data || !response.data.list) return [];
    return trimToRuleOfFive(response.data.list).map(t => ({
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
      limit: RULE_OF_FIVE,
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
  /**
   * Rule-of-5 exception: tape reading needs more ticks for velocity analysis.
   */
  async getRunningTrade(symbols, limit = 20) {
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

const SCANNER_CLI_COMMANDS = [
  { usage: 'livedraggers [GROUP]', detail: 'Live intraday draggers/lifters (default group: giants)' },
  { usage: 'detector <TICKER> [PERIOD]', detail: 'Symbol bandar detector & broker summary' },
  { usage: 'tape <TICKERS> [LIMIT]', detail: 'Running trade tape (Rule-of-5 exception, default 20)' },
  { usage: 'whale <BROKER>', detail: 'Stocks accumulated by a specific broker' },
  { usage: 'topbroker [PERIOD]', detail: 'Top brokers by transaction value' },
  { usage: 'trending', detail: 'Crowd sentiment / trending stocks' },
  { usage: 'mover [TYPE]', detail: 'Market movers (EOD-delayed foreign flow)' },
  { usage: 'topstock <START> <END>', detail: 'Top foreign buy/sell by date range' },
  { usage: 'screener [ACCUMULATION|REBOUND]', detail: 'Custom screener template' },
];

function printScannerHelp() {
  const { printHelp } = require('../../../core/cli-help.js');
  printHelp('scanner-api.js', 'Market-wide scanner & live tape API', SCANNER_CLI_COMMANDS);
}

async function runScannerCLI(argv) {
  const { wantsHelp } = require('../../../core/cli-help.js');
  if (wantsHelp(argv) || argv.length === 0) {
    printScannerHelp();
    process.exit(argv.length === 0 ? 1 : 0);
  }

  const api = new ScannerAPIClient();
  await api.login();
  const action = argv[0] || 'mover';

  if (action === 'mover') {
    const type = argv[1] || 'MOVER_TYPE_NET_FOREIGN_BUY';
    console.log(JSON.stringify(await api.getMarketMover(type), null, 2));
  } else if (action === 'topstock') {
    const start = argv[1] || '2026-06-26';
    const end = argv[2] || '2026-06-26';
    console.log(JSON.stringify(await api.getTopStock(start, end), null, 2));
  } else if (action === 'screener') {
    const type = argv[1] || 'ACCUMULATION';
    console.log(JSON.stringify(await api.runScreener(type), null, 2));
  } else if (action === 'livedraggers') {
    const group = argv[1] || 'giants';
    console.log(JSON.stringify(await api.getLiveDraggers(group), null, 2));
  } else if (action === 'topbroker') {
    const period = argv[1] || 'TB_PERIOD_LAST_1_DAY';
    console.log(JSON.stringify(await api.getTopBroker(period), null, 2));
  } else if (action === 'whale') {
    const broker = argv[1];
    if (!broker) throw new Error('Usage: scanner-api.js whale <BROKER>');
    console.log(JSON.stringify(await api.getWhaleActivity(broker), null, 2));
  } else if (action === 'trending') {
    console.log(JSON.stringify(await api.getTrending(), null, 2));
  } else if (action === 'detector') {
    const ticker = argv[1];
    if (!ticker) throw new Error('Usage: scanner-api.js detector <TICKER>');
    const period = argv[2] || 'BROKER_SUMMARY_PERIOD_LATEST';
    console.log(JSON.stringify(await api.getSymbolDetector(ticker, period), null, 2));
  } else if (action === 'tape') {
    const symbols = argv[1] ? argv[1].split(',') : [];
    const limit = parseInt(argv[2] || '20', 10);
    console.log(JSON.stringify(await api.getRunningTrade(symbols, limit), null, 2));
  } else {
    throw new Error(`Unknown command: ${action}. Run with --help.`);
  }
}

if (require.main === module) {
  runScannerCLI(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}

module.exports = { ScannerAPIClient, printScannerHelp };
