const { StockbitClient } = require('../../../core/stockbit-auth.js');

class InstitutionalAPIClient extends StockbitClient {
  async getOrderbook(ticker) {
    const data = await this._getExodus(`/orderbook/companies/${ticker}`);
    return data.data || {};
  }

  async getBrokerSummary(ticker, limit = 25) {
    const params = {
      transaction_type: "TRANSACTION_TYPE_NET",
      market_board: "MARKET_BOARD_REGULER",
      investor_type: "INVESTOR_TYPE_ALL",
      limit
    };
    const data = await this._getExodus(`/marketdetectors/${ticker}`, params);
    return data.data || {};
  }

  async getForeignFlow(ticker, limit = 25) {
    const params = {
      transaction_type: "TRANSACTION_TYPE_NET",
      market_board: "MARKET_BOARD_REGULER",
      investor_type: "INVESTOR_TYPE_FOREIGN",
      limit
    };
    const data = await this._getExodus(`/marketdetectors/${ticker}`, params);
    return data.data || {};
  }

  async getFinancialData(ticker, yearLimit = 5) {
    const params = { year_limit: yearLimit };
    const data = await this._getExodus(`/keystats/ratio/v1/${ticker}`, params);
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
