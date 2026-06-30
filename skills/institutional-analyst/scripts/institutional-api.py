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

    def get_broker_summary(self, ticker, limit=25, **kwargs):
        """Analyze top buyer/seller brokers, average accumulation price, net accumulation."""
        params = {
            "transaction_type": "TRANSACTION_TYPE_NET",
            "market_board": "MARKET_BOARD_REGULER",
            "investor_type": "INVESTOR_TYPE_ALL",
            "limit": limit
        }
        params.update(kwargs)
        return self._get_exodus(f"/marketdetectors/{ticker}", params=params).get("data", {})

    def get_foreign_flow(self, ticker, limit=25, **kwargs):
        """Analyze foreign net buy/sell and institutional participation."""
        params = {
            "transaction_type": "TRANSACTION_TYPE_NET",
            "market_board": "MARKET_BOARD_REGULER",
            "investor_type": "INVESTOR_TYPE_FOREIGN",
            "limit": limit
        }
        params.update(kwargs)
        return self._get_exodus(f"/marketdetectors/{ticker}", params=params).get("data", {})
    def get_broker_distribution(self, ticker, **kwargs):
        """Analyze who sold to whom and detect cornering/absorption."""
        params = {
            "symbol": ticker,
            "investor_type": "INVESTOR_TYPE_ALL",
            "market_board": "MARKET_TYPE_REGULER",
            "data_type": "BROKER_DISTRIBUTION_DATA_TYPE_VALUE",
            "period": "TB_PERIOD_LAST_1_DAY",
            "date": ""
        }
        params.update(kwargs)
        return self._get_exodus("/order-trade/broker/distribution", params=params).get("data", {})
if __name__ == "__main__":
    api = InstitutionalAPIClient()
    api.login()
    print("Institutional Data Example (BBCA Broker Summary):")
    print(api.get_broker_summary("BBCA", limit=5))
