const { StockbitClient } = require('../../../core/stockbit-auth.js');

class FundamentalAPIClient extends StockbitClient {
  /**
   * Fetch KeyStats (Valuation Ratios, Profitability, Liquidity)
   */
  async getKeyStats(ticker, yearLimit = 10) {
    const params = { year_limit: yearLimit };
    const res = await this._getExodus(`/keystats/ratio/v1/${ticker}`, params);
    return res.data || {};
  }

  /**
   * Fetch Financial Reports
   * type can be 'yearly' or 'quarterly'
   */
  async getFinancialReport(ticker, type = 'yearly', limit = 5) {
    const params = { type, limit };
    const res = await this._getExodus(`/financials/report/v1/${ticker}`, params);
    return res.data || {};
  }
}

if (require.main === module) {
  (async () => {
    const api = new FundamentalAPIClient();
    try {
      await api.login();
      const data = await api.getKeyStats("BBCA", 10);
      // Example of extracting PBV and PE
      let pbv = null;
      let pe = null;
      
      if (data.closure_fin_items_results) {
         data.closure_fin_items_results.forEach(group => {
            group.fin_name_results.forEach(item => {
               if (item.fitem.name.includes("Price to Book")) pbv = item.fitem.value;
               if (item.fitem.name.includes("Current PE Ratio (TTM)")) pe = item.fitem.value;
            });
         });
      }
      
      console.log(`Fundamental Data Example (BBCA): PBV = ${pbv}, PE = ${pe}`);
    } catch (e) {
      console.error(e.message);
    }
  })();
}
module.exports = { FundamentalAPIClient };
