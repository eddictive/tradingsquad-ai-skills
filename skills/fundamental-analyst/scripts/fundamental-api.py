import sys
import os

# Ensure the core module can be imported
sys.path.append(os.path.join(os.path.dirname(__file__), "../../../core"))
from stockbit_auth import StockbitClient

class FundamentalAPIClient(StockbitClient):
    
    def get_keystats(self, ticker: str, year_limit: int = 10):
        """
        Fetch KeyStats (Valuation Ratios, Profitability, Liquidity)
        """
        params = {"year_limit": year_limit}
        res = self._get_exodus(f"/keystats/ratio/v1/{ticker}", params=params)
        return res.get("data", {})

    def get_financial_report(self, ticker: str, report_type: int = 1, statement_type: int = 2):
        """
        Fetch Financial Reports
        report_type: 1 (Income Statement), 2 (Balance Sheet), 3 (Cash Flow)
        statement_type: 1 (Quarterly), 2 (Annual)
        """
        params = {"symbol": ticker, "data_type": 1, "report_type": report_type, "statement_type": statement_type}
        res = self._get_exodus("/findata-view/company/financial", params=params)
        return res.get("data", {})

FUND_CLI_COMMANDS = [
    {"usage": "keystats <TICKER>", "detail": "Valuation ratios (PE, PBV, ROE, DER, FCF, etc.)"},
    {"usage": "report <TICKER> [REPORT_TYPE] [STATEMENT_TYPE]", "detail": "Financial report. Types: 1=Income, 2=Balance, 3=Cash Flow"},
]


def print_fundamental_help():
    from cli_help import print_help
    print_help("fundamental-api.py", "Fundamental valuation & financial reports API", FUND_CLI_COMMANDS)


if __name__ == "__main__":
    import json
    from cli_help import wants_help

    argv = sys.argv[1:]
    if wants_help(argv) or not argv:
        print_fundamental_help()
        sys.exit(1 if not argv else 0)

    api = FundamentalAPIClient()
    try:
        api.login()

        action = argv[0]
        ticker = argv[1] if len(argv) > 1 else "BBCA"

        if action == "keystats":
            data = api.get_keystats(ticker, 10)
            results = {}
            
            for group in data.get("closure_fin_items_results", []):
                for item in group.get("fin_name_results", []):
                    name = item.get("fitem", {}).get("name", "")
                    val = item.get("fitem", {}).get("value", "")
                    
                    if "Current PE Ratio (TTM)" in name: results["PE_Ratio_TTM"] = val
                    if "Price to Book" in name: results["PBV"] = val
                    if "Return on Equity (TTM)" in name: results["ROE_TTM"] = val
                    if "Net Profit Margin (Quarter)" in name: results["NPM_Quarter"] = val
                    if "Debt to Equity Ratio (Quarter)" in name: results["DER_Quarter"] = val
                    if "Current Ratio (Quarter)" in name: results["Current_Ratio_Quarter"] = val
                    if "Free cash flow (TTM)" in name: results["FCF_TTM"] = val
                    if "Dividend Yield" in name: results["Dividend_Yield"] = val
                    if "EV to EBITDA (TTM)" in name: results["EV_to_EBITDA"] = val
                    if "Current Price To Free Cashflow" in name: results["Price_to_FCF"] = val
                        
            print(json.dumps(results, indent=2))

        elif action == "report":
            report_type = int(argv[2]) if len(argv) > 2 else 1
            statement_type = int(argv[3]) if len(argv) > 3 else 2
            data = api.get_financial_report(ticker, report_type, statement_type)
            if "report" in data and len(data["report"]) > 5:
                data["report"] = data["report"][:5]
            print(json.dumps(data, indent=2))
        else:
            raise ValueError(f"Unknown command: {action}. Run with --help.")

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
