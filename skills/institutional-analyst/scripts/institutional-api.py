import sys
import os

# Import the Shared Core Authentication Module
sys.path.append(os.path.join(os.path.dirname(__file__), '../../../core'))
from stockbit_auth import StockbitClient
from rule_of_five import RULE_OF_FIVE, clamp_limit

class InstitutionalAPIClient(StockbitClient):
    """
    Institutional Analysis Client.
    Inherits from StockbitClient for seamless background authentication.
    Handles Orderbook, Broker Summary, and Foreign Flow logic.
    """
    def get_orderbook(self, ticker):
        """Retrieve Bid/Ask volume, spread, Bid/Ask imbalance, and queue strength."""
        return self._get_exodus(f"/orderbook/companies/{ticker}").get("data", {})

    def get_broker_summary(self, ticker, limit=RULE_OF_FIVE, **kwargs):
        """Analyze top buyer/seller brokers, average accumulation price, net accumulation."""
        params = {
            "transaction_type": "TRANSACTION_TYPE_NET",
            "market_board": "MARKET_BOARD_REGULER",
            "investor_type": "INVESTOR_TYPE_ALL",
            "limit": clamp_limit(limit)
        }
        params.update(kwargs)
        return self._get_exodus(f"/marketdetectors/{ticker}", params=params).get("data", {})

    def get_foreign_flow(self, ticker, limit=RULE_OF_FIVE, **kwargs):
        """Analyze foreign net buy/sell and institutional participation."""
        params = {
            "transaction_type": "TRANSACTION_TYPE_NET",
            "market_board": "MARKET_BOARD_REGULER",
            "investor_type": "INVESTOR_TYPE_FOREIGN",
            "limit": clamp_limit(limit)
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
CLI_COMMANDS = [
    {"usage": "broker <TICKER> [PERIOD]", "detail": "Broker summary (Rule of 5). PERIOD e.g. BROKER_SUMMARY_PERIOD_LAST_1_MONTH"},
    {"usage": "foreign <TICKER> [PERIOD]", "detail": "Foreign flow summary (Rule of 5)"},
    {"usage": "orderbook <TICKER>", "detail": "Live orderbook bid/ask"},
    {"usage": "distribution <TICKER>", "detail": "Broker distribution network (who sold to whom)"},
]


def print_institutional_help():
    from cli_help import print_help
    print_help("institutional-api.py", "Institutional bandarmology & order flow API", CLI_COMMANDS)


if __name__ == "__main__":
    import json
    from cli_help import wants_help

    argv = sys.argv[1:]
    if wants_help(argv) or not argv:
        print_institutional_help()
        sys.exit(1 if not argv else 0)

    api = InstitutionalAPIClient()
    api.login()

    command = argv[0]
    ticker = argv[1] if len(argv) > 1 else None
    period = argv[2] if len(argv) > 2 and argv[2].startswith("BROKER_") else None
    period_kw = {"period": period} if period else {}

    try:
        if command == "broker":
            if not ticker:
                raise ValueError("Usage: institutional-api.py broker <TICKER> [PERIOD]")
            print(json.dumps(api.get_broker_summary(ticker, **period_kw), indent=2))
        elif command == "foreign":
            if not ticker:
                raise ValueError("Usage: institutional-api.py foreign <TICKER> [PERIOD]")
            print(json.dumps(api.get_foreign_flow(ticker, **period_kw), indent=2))
        elif command == "orderbook":
            if not ticker:
                raise ValueError("Usage: institutional-api.py orderbook <TICKER>")
            print(json.dumps(api.get_orderbook(ticker), indent=2))
        elif command == "distribution":
            if not ticker:
                raise ValueError("Usage: institutional-api.py distribution <TICKER>")
            print(json.dumps(api.get_broker_distribution(ticker), indent=2))
        else:
            raise ValueError(f"Unknown command: {command}. Run with --help.")
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
