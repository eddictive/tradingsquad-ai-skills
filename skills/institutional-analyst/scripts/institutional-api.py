import sys
import os

# Import the Shared Core Authentication Module
sys.path.append(os.path.join(os.path.dirname(__file__), '../../../core'))
from stockbit_auth import StockbitClient

class InstitutionalAPIClient(StockbitClient):
    """
    Institutional Analysis Client.
    Inherits from StockbitClient for seamless background authentication.
    Handles Orderbook, Broker Summary, and Foreign Flow logic.
    """
    def get_orderbook(self, ticker):
        """Retrieve Bid/Ask volume, spread, Bid/Ask imbalance, and queue strength."""
        return self._get_exodus(f"/orderbook/companies/{ticker}").get("data", {})

    def get_broker_summary(self, ticker, limit=25):
        """Analyze top buyer/seller brokers, average accumulation price, net accumulation."""
        params = {
            "transaction_type": "TRANSACTION_TYPE_NET",
            "market_board": "MARKET_BOARD_REGULER",
            "investor_type": "INVESTOR_TYPE_ALL",
            "limit": limit
        }
        return self._get_exodus(f"/marketdetectors/{ticker}", params=params).get("data", {})

    def get_foreign_flow(self, ticker, limit=25):
        """Analyze foreign net buy/sell and institutional participation."""
        params = {
            "transaction_type": "TRANSACTION_TYPE_NET",
            "market_board": "MARKET_BOARD_REGULER",
            "investor_type": "INVESTOR_TYPE_FOREIGN",
            "limit": limit
        }
        return self._get_exodus(f"/marketdetectors/{ticker}", params=params).get("data", {})

    def get_financial_data(self, ticker, year_limit=5):
        """Retrieve revenue growth, EPS, ROE, debt ratio, and valuation."""
        params = {"year_limit": year_limit}
        return self._get_exodus(f"/keystats/ratio/v1/{ticker}", params=params).get("data", {})

if __name__ == "__main__":
    api = InstitutionalAPIClient()
    api.login()
    print("Institutional Data Example (BBCA Broker Summary):")
    print(api.get_broker_summary("BBCA", limit=5))
