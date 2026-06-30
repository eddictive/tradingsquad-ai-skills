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

if __name__ == "__main__":
    api = FundamentalAPIClient()
    try:
        api.login()
        data = api.get_keystats("BBCA", 10)
        pbv = None
        pe = None
        
        for group in data.get("closure_fin_items_results", []):
            for item in group.get("fin_name_results", []):
                name = item.get("fitem", {}).get("name", "")
                val = item.get("fitem", {}).get("value", "")
                if "Price to Book" in name:
                    pbv = val
                if "Current PE Ratio (TTM)" in name:
                    pe = val
                    
        print(f"Fundamental Data Example (BBCA): PBV = {pbv}, PE = {pe}")
    except Exception as e:
        print(f"Error: {e}")
