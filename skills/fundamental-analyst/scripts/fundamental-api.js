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

const FUND_CLI_COMMANDS = [
  { usage: 'keystats <TICKER>', detail: 'Valuation ratios (PE, PBV, ROE, DER, FCF, etc.)' },
  { usage: 'report <TICKER> [REPORT_TYPE] [STATEMENT_TYPE]', detail: 'Financial report. Types: 1=Income, 2=Balance, 3=Cash Flow' },
];

function printFundamentalHelp() {
  const { printHelp } = require('../../../core/cli-help.js');
  printHelp('fundamental-api.js', 'Fundamental valuation & financial reports API', FUND_CLI_COMMANDS);
}

async function runFundamentalCLI(argv) {
  const { wantsHelp } = require('../../../core/cli-help.js');
  if (wantsHelp(argv) || argv.length === 0) {
    printFundamentalHelp();
    process.exit(argv.length === 0 ? 1 : 0);
  }

  const api = new FundamentalAPIClient();
  await api.login();

  const action = argv[0] || 'keystats';
  const ticker = argv[1] || 'BBCA';

  if (action === 'keystats') {
        const data = await api.getKeyStats(ticker, 10);
        
        let results = {};
        if (data.closure_fin_items_results) {
           data.closure_fin_items_results.forEach(group => {
              group.fin_name_results.forEach(item => {
                 const name = item.fitem.name;
                 const val = item.fitem.value;
                 // Extract essential LLM data
                 if (name.includes("Current PE Ratio (TTM)")) results["PE_Ratio_TTM"] = val;
                 if (name.includes("Price to Book")) results["PBV"] = val;
                 if (name.includes("Return on Equity (TTM)")) results["ROE_TTM"] = val;
                 if (name.includes("Net Profit Margin (Quarter)")) results["NPM_Quarter"] = val;
                 if (name.includes("Debt to Equity Ratio (Quarter)")) results["DER_Quarter"] = val;
                 if (name.includes("Current Ratio (Quarter)")) results["Current_Ratio_Quarter"] = val;
                 if (name.includes("Free cash flow (TTM)")) results["FCF_TTM"] = val;
                 if (name.includes("Dividend Yield")) results["Dividend_Yield"] = val;
                 if (name.includes("EV to EBITDA (TTM)")) results["EV_to_EBITDA"] = val;
                 if (name.includes("Current Price To Free Cashflow")) results["Price_to_FCF"] = val;
              });
           });
        }
        
    console.log(JSON.stringify(results, null, 2));
  } else if (action === 'report') {
    const reportType = parseInt(argv[2] || '1', 10);
    const statementType = parseInt(argv[3] || '2', 10);
    const data = await api.getFinancialReport(ticker, reportType, statementType);
    if (data.report && data.report.length > 5) data.report = data.report.slice(0, 5);
    console.log(JSON.stringify(data, null, 2));
  } else {
    throw new Error(`Unknown command: ${action}. Run with --help.`);
  }
}

if (require.main === module) {
  runFundamentalCLI(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}

module.exports = { FundamentalAPIClient, printFundamentalHelp };
