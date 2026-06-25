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

    def get_financial_report(self, ticker: str, report_type: str = "yearly", limit: int = 5):
        """
        Fetch Financial Reports
        """
        params = {"type": report_type, "limit": limit}
        res = self._get_exodus(f"/financials/report/v1/{ticker}", params=params)
        return res.get("data", {})

if __name__ == "__main__":
    api = FundamentalAPIClient()
    try:
        api.login()
        data = api.get_keystats("BBCA", 1)
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
