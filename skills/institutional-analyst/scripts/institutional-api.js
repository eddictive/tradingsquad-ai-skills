const { StockbitClient } = require('../../../core/stockbit-auth.js');

class InstitutionalAPIClient extends StockbitClient {
  async getOrderbook(ticker) {
    const data = await this._getExodus(`/orderbook/companies/${ticker}`);
    return data.data || {};
  }

  async getBrokerSummary(ticker, limit = 25, options = {}) {
    const params = {
      transaction_type: "TRANSACTION_TYPE_NET",
      market_board: "MARKET_BOARD_REGULER",
      investor_type: "INVESTOR_TYPE_ALL",
      limit,
      ...options
    };
    const data = await this._getExodus(`/marketdetectors/${ticker}`, params);
    return data.data || {};
  }

  async getForeignFlow(ticker, limit = 25, options = {}) {
    const params = {
      transaction_type: "TRANSACTION_TYPE_NET",
      market_board: "MARKET_BOARD_REGULER",
      investor_type: "INVESTOR_TYPE_FOREIGN",
      limit,
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

if (require.main === module) {
  (async () => {
    const api = new InstitutionalAPIClient();
    try {
      await api.login();
      const data = await api.getBrokerSummary("BBCA", 5);
      console.log("Institutional Data Example (BBCA Broker Flow):", data);
    } catch (e) {
      console.error(e.message);
    }
  })();
}
module.exports = { InstitutionalAPIClient };
