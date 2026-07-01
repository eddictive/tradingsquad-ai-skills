const { StockbitClient } = require('../../../core/stockbit-auth.js');
const { RULE_OF_FIVE, clampLimit } = require('../../../core/rule-of-five.js');
const { formatOrderbook } = require('../../../core/orderbook-format.js');

class InstitutionalAPIClient extends StockbitClient {
  async getOrderbook(ticker) {
    const data = await this._getExodus(`/orderbook/companies/${ticker}`);
    return formatOrderbook(data.data || {});
  }

  async getBrokerSummary(ticker, limit = RULE_OF_FIVE, options = {}) {
    const params = {
      transaction_type: "TRANSACTION_TYPE_NET",
      market_board: "MARKET_BOARD_REGULER",
      investor_type: "INVESTOR_TYPE_ALL",
      limit: clampLimit(limit),
      ...options
    };
    const data = await this._getExodus(`/marketdetectors/${ticker}`, params);
    return data.data || {};
  }

  async getForeignFlow(ticker, limit = RULE_OF_FIVE, options = {}) {
    const params = {
      transaction_type: "TRANSACTION_TYPE_NET",
      market_board: "MARKET_BOARD_REGULER",
      investor_type: "INVESTOR_TYPE_FOREIGN",
      limit: clampLimit(limit),
      ...options
    };
    const data = await this._getExodus(`/marketdetectors/${ticker}`, params);
    return data.data || {};
  }

  async getBrokerDistribution(ticker, options = {}) {
    const params = {
      symbol: ticker,
      investor_type: "INVESTOR_TYPE_ALL",
      market_board: "MARKET_TYPE_REGULER",
      data_type: "BROKER_DISTRIBUTION_DATA_TYPE_VALUE",
      period: "TB_PERIOD_LAST_1_DAY",
      date: "",
      ...options
    };
    const data = await this._getExodus(`/order-trade/broker/distribution`, params);
    return data.data || {};
  }
}

const CLI_COMMANDS = [
  { usage: 'broker <TICKER> [PERIOD]', detail: 'Broker summary (Rule of 5). PERIOD e.g. BROKER_SUMMARY_PERIOD_LAST_1_MONTH' },
  { usage: 'foreign <TICKER> [PERIOD]', detail: 'Foreign flow summary (Rule of 5)' },
  { usage: 'orderbook <TICKER>', detail: 'Live orderbook — 10 BID + 10 OFFER levels (BEI/Stockbit depth)' },
  { usage: 'distribution <TICKER>', detail: 'Broker distribution network (who sold to whom)' },
];

function printInstitutionalHelp() {
  const { printHelp } = require('../../../core/cli-help.js');
  printHelp('institutional-api.js', 'Institutional bandarmology & order flow API', CLI_COMMANDS);
}

async function runInstitutionalCLI(argv) {
  const { wantsHelp } = require('../../../core/cli-help.js');
  if (wantsHelp(argv) || argv.length === 0) {
    printInstitutionalHelp();
    process.exit(argv.length === 0 ? 1 : 0);
  }

  const api = new InstitutionalAPIClient();
  await api.login();

  const [command, ticker, periodOrExtra] = argv;
  const periodOpt = periodOrExtra && periodOrExtra.startsWith('BROKER_')
    ? { period: periodOrExtra }
    : {};

  switch (command) {
    case 'broker':
      if (!ticker) throw new Error('Usage: institutional-api.js broker <TICKER> [PERIOD]');
      console.log(JSON.stringify(await api.getBrokerSummary(ticker, undefined, periodOpt), null, 2));
      break;
    case 'foreign':
      if (!ticker) throw new Error('Usage: institutional-api.js foreign <TICKER> [PERIOD]');
      console.log(JSON.stringify(await api.getForeignFlow(ticker, undefined, periodOpt), null, 2));
      break;
    case 'orderbook':
      if (!ticker) throw new Error('Usage: institutional-api.js orderbook <TICKER>');
      console.log(JSON.stringify(await api.getOrderbook(ticker), null, 2));
      break;
    case 'distribution':
      if (!ticker) throw new Error('Usage: institutional-api.js distribution <TICKER>');
      console.log(JSON.stringify(await api.getBrokerDistribution(ticker), null, 2));
      break;
    default:
      throw new Error(`Unknown command: ${command}. Run with --help.`);
  }
}

if (require.main === module) {
  runInstitutionalCLI(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}

module.exports = { InstitutionalAPIClient, printInstitutionalHelp };
