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
   * reportType: 1 (Income Statement), 2 (Balance Sheet), 3 (Cash Flow)
   * statementType: 1 (Quarterly), 2 (Annual)
   */
  async getFinancialReport(ticker, reportType = 1, statementType = 2) {
    const params = { symbol: ticker, data_type: 1, report_type: reportType, statement_type: statementType };
    const res = await this._getExodus(`/findata-view/company/financial`, params);
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
