import sys
import json
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../core")))
from stockbit_auth import StockbitClient
from rule_of_five import RULE_OF_FIVE, trim_to_rule_of_five
from wib import get_wib_date_string
from concurrency import map_pool

class ScannerAPIClient(StockbitClient):
    
    def get_market_mover(self, mover_type="MOVER_TYPE_NET_FOREIGN_BUY"):
        params = {
            "mover_type": mover_type,
            "filter_stocks": [
                "FILTER_STOCKS_TYPE_MAIN_BOARD",
                "FILTER_STOCKS_TYPE_DEVELOPMENT_BOARD"
            ]
        }
        response = self._get_exodus("/order-trade/market-mover", params)
        data = response.get("data", {}).get("mover_list", [])
        
        result = []
        for m in trim_to_rule_of_five(data):
            result.append({
                "ticker": m["stock_detail"]["code"],
                "price": m["price"],
                "change_percent": f"{m['change']['percentage']:.2f}%",
                "foreign_buy": m.get("net_foreign_buy", {}).get("formatted", "-"),
                "value": m["value"]["formatted"]
            })
        return result

    def get_top_stock(self, start_date, end_date, investor_type="INVESTOR_TYPE_FOREIGN", max_pages=3):
        all_top_buy = []
        all_top_sell = []
        
        for page in range(1, max_pages + 1):
            params = {
                "start": start_date,
                "end": end_date,
                "investor_type": investor_type,
                "market_type": "MARKET_TYPE_REGULER",
                "value_type": "VALUE_TYPE_NET",
                "page": page
            }
            response = self._get_exodus("/order-trade/top-stock", params)
            data = response.get("data", {})
            if not data:
                break
                
            top_buy_page = data.get("top_buy", [])
            top_sell_page = data.get("top_sell", [])
            
            if top_buy_page: all_top_buy.extend(top_buy_page)
            if top_sell_page: all_top_sell.extend(top_sell_page)
            
            if not top_buy_page and not top_sell_page:
                break
                
        return {
            "topBuy": [{"ticker": b["code"], "value": b["value"]["formatted"], "avg_price": b["average"]["formatted"]} for b in trim_to_rule_of_five(all_top_buy)],
            "topSell": [{"ticker": s["code"], "value": s["value"]["formatted"], "avg_price": s["average"]["formatted"]} for s in trim_to_rule_of_five(all_top_sell)]
        }

    def run_screener(self, template="ACCUMULATION"):
        if template == "ACCUMULATION":
            payload = {
                "name": "ISSI - Big Accumulation",
                "description": "",
                "save": "0",
                "ordertype": "DESC",
                "ordercol": 3,
                "page": 1,
                "universe": '{"scope":"idx","scopeID":"558","name":"IHSG"}',
                "filters": '[{"type":"basic","item1":14400,"item1name":"Bandar Accum/Dist","operator":">","item2":"20","item2name":"","multiplier":"0"},{"type":"basic","item1":13620,"item1name":"Value","operator":">","item2":"3000000000","item2name":"","multiplier":"0"},{"type":"basic","item1":2661,"item1name":"Price","operator":">=","item2":"100","item2name":"","multiplier":"0"}]',
                "sequence": "14400,13620,2661",
                "screenerid": "0",
                "type": "TEMPLATE_TYPE_CUSTOM"
            }
        else:
            payload = {
                "name": "Price Momentum (Rebound Hunter)",
                "description": "",
                "save": "0",
                "ordertype": "DESC",
                "ordercol": 2,
                "page": 1,
                "universe": '{"scope":"idx","scopeID":"558","name":"ISSI"}',
                "filters": '[{"type":"basic","item1":16454,"item1name":"Value MA 20","operator":">","item2":"1000000000","item2name":"","multiplier":"0"},{"type":"compare","item1":2661,"item1name":"Price","operator":">=","multiplier":"1","item2":12460,"item2name":"Price MA 50"},{"type":"basic","item1":12148,"item1name":"Current PE Ratio (Annualised)","operator":">","item2":"0","multiplier":""}]',
                "sequence": "16454,2661,12460,12148",
                "screenerid": "0",
                "type": "TEMPLATE_TYPE_CUSTOM"
            }

        response = self._post_exodus("/screener/templates", payload)
        calcs = response.get("data", {}).get("calcs", [])[:10]
        
        result = []
        for c in calcs:
            res_obj = {"ticker": c["company"]["symbol"]}
            for r in c["results"]:
                res_obj[r["item"]] = r["display"]
            result.append(res_obj)
            
        return result

    def get_live_draggers(self, group_name="giants"):
        import time

        try:
            emitens_path = os.path.join(os.path.dirname(__file__), "../../../core/emitens.json")
            with open(emitens_path, "r") as f:
                emitens_data = json.load(f)
            giants = emitens_data.get(group_name)
            if not giants:
                raise ValueError(f"Group '{group_name}' not found in emitens.json")
        except Exception as e:
            print(f"[WARN] Falling back to default giants. Error: {e}")
            giants = ['BBCA', 'BBRI', 'BMRI', 'BBNI', 'TLKM', 'ASII', 'AMMN', 'BREN', 'TPIA', 'BYAN', 'DSSA', 'KLBF', 'UNVR', 'ICBP', 'GOTO', 'ADRO']

        end_ts = int(time.time())
        start_ts = end_ts - (5 * 24 * 60 * 60)
        today_str = get_wib_date_string()

        def fetch_ticker(ticker):
            params = {
                "from": end_ts,
                "to": start_ts,
                "limit": 0,
                "minutes_multiplier": 1
            }
            raw_data = self._get_exodus(f"/chartbit/{ticker}/price/intraday", params)
            candles = raw_data.get("data", {}).get("chartbit", [])

            today_candles = [c for c in candles if c.get("datetime", "").startswith(today_str)]
            prev_candles = [c for c in candles if not c.get("datetime", "").startswith(today_str)]

            if not today_candles or not prev_candles:
                return None

            today_candles.sort(key=lambda x: x["unix_timestamp"])
            prev_candles.sort(key=lambda x: x["unix_timestamp"])

            open_price = today_candles[0]["open"]
            prev_close = prev_candles[-1]["close"]
            close_price = today_candles[-1]["close"]
            change = ((close_price - prev_close) / prev_close) * 100
            return {
                "ticker": ticker,
                "open": open_price,
                "prevClose": prev_close,
                "close": close_price,
                "changePercent": f"{change:.2f}%"
            }

        results = map_pool(giants, 4, fetch_ticker)

        lifters = sorted(
            [r for r in results if float(r["changePercent"].replace('%', '')) >= 0],
            key=lambda x: float(x["changePercent"].replace('%', '')),
            reverse=True
        )
        draggers = sorted(
            [r for r in results if float(r["changePercent"].replace('%', '')) < 0],
            key=lambda x: float(x["changePercent"].replace('%', ''))
        )

        return {"lifters": lifters, "draggers": draggers}

    def get_top_broker(self, period="TB_PERIOD_LAST_1_DAY"):
        params = {
            "sort": "TB_SORT_BY_TOTAL_VALUE",
            "order": "ORDER_BY_DESC",
            "period": period,
            "market_type": "MARKET_TYPE_REGULER"
        }
        response = self._get_exodus("/order-trade/broker/top", params)
        data = trim_to_rule_of_five(response.get("data", {}).get("list", []))
        return [{
            "broker_code": b.get("code"),
            "name": b.get("name"),
            "total_value": b.get("total_value"),
            "net_value": b.get("net_value"),
            "group": b.get("group")
        } for b in data]

    def get_whale_activity(self, broker_code):
        params = {
            "limit": 50,
            "transaction_type": "TRANSACTION_TYPE_NET",
            "market_board": "MARKET_BOARD_REGULER",
            "investor_type": "INVESTOR_TYPE_ALL"
        }
        response = self._get_exodus(f"/findata-view/marketdetectors/activity/{broker_code}/detail", params)
        summary = response.get("data", {}).get("broker_summary", {})
        bandar_detector = response.get("data", {}).get("bandar_detector", {})
        
        def format_netbs(arr):
            res = []
            for i in arr:
                val = i.get("bval") or i.get("sval", "0")
                avg = i.get("netbs_buy_avg_price") or i.get("netbs_sell_avg_price", "0")
                res.append({
                    "ticker": i.get("netbs_stock_code"),
                    "avg_price": avg,
                    "value": val
                })
            res.sort(key=lambda x: abs(float(x["value"])), reverse=True)
            return trim_to_rule_of_five(res)

        return {
            "bandar_detector": bandar_detector,
            "top_buy": format_netbs(summary.get("brokers_buy", [])),
            "top_sell": format_netbs(summary.get("brokers_sell", []))
        }

    def get_trending(self):
        response = self._get_exodus("/emitten/trending")
        data = trim_to_rule_of_five(response.get("data", {}).get("list", []))
        return [{
            "ticker": t.get("code"),
            "company_name": t.get("name"),
            "rank_change": t.get("rank_change")
        } for t in data]

    def get_symbol_detector(self, ticker, period="BROKER_SUMMARY_PERIOD_LATEST"):
        params = {
            "transaction_type": "TRANSACTION_TYPE_NET",
            "market_board": "MARKET_BOARD_REGULER",
            "investor_type": "INVESTOR_TYPE_ALL",
            "limit": RULE_OF_FIVE,
            "period": period
        }
        response = self._get_exodus(f"/marketdetectors/{ticker}", params)
        return response.get("data", None)

    def get_running_trade(self, symbols, limit=20):
        query_string = f"action_type=RUNNING_TRADE_ACTION_TYPE_ALL&sort=DESC&limit={limit}&order_by=RUNNING_TRADE_ORDER_BY_TIME"
        if symbols:
            for s in symbols:
                query_string += f"&symbols[]={s}"
        
        response = self._get_exodus(f"/order-trade/running-trade?{query_string}")
        running_trade = response.get("data", {}).get("running_trade", [])
        
        return [{
            "time": rt.get("time"),
            "action": rt.get("action"),
            "ticker": rt.get("code"),
            "price": rt.get("price"),
            "lot": rt.get("lot"),
            "buyer": rt.get("buyer"),
            "seller": rt.get("seller"),
            "market_board": rt.get("market_board")
        } for rt in running_trade]

SCANNER_CLI_COMMANDS = [
    {"usage": "livedraggers [GROUP]", "detail": "Live intraday draggers/lifters (default group: giants)"},
    {"usage": "detector <TICKER> [PERIOD]", "detail": "Symbol bandar detector & broker summary"},
    {"usage": "tape <TICKERS> [LIMIT]", "detail": "Running trade tape (Rule-of-5 exception, default 20)"},
    {"usage": "whale <BROKER>", "detail": "Stocks accumulated by a specific broker"},
    {"usage": "topbroker [PERIOD]", "detail": "Top brokers by transaction value"},
    {"usage": "trending", "detail": "Crowd sentiment / trending stocks"},
    {"usage": "mover [TYPE]", "detail": "Market movers (EOD-delayed foreign flow)"},
    {"usage": "topstock <START> <END>", "detail": "Top foreign buy/sell by date range"},
    {"usage": "screener [ACCUMULATION|REBOUND]", "detail": "Custom screener template"},
]


def print_scanner_help():
    from cli_help import print_help
    print_help("scanner-api.py", "Market-wide scanner & live tape API", SCANNER_CLI_COMMANDS)


if __name__ == "__main__":
    from cli_help import wants_help

    argv = sys.argv[1:]
    if wants_help(argv) or not argv:
        print_scanner_help()
        sys.exit(1 if not argv else 0)

    api = ScannerAPIClient()
    api.login()
    action = argv[0]

    try:
        if action == "mover":
            mover_type = argv[1] if len(argv) > 1 else "MOVER_TYPE_NET_FOREIGN_BUY"
            print(json.dumps(api.get_market_mover(mover_type), indent=2))
        elif action == "topstock":
            start = argv[1] if len(argv) > 1 else "2026-06-26"
            end = argv[2] if len(argv) > 2 else start
            print(json.dumps(api.get_top_stock(start, end), indent=2))
        elif action == "screener":
            template = argv[1] if len(argv) > 1 else "ACCUMULATION"
            print(json.dumps(api.run_screener(template), indent=2))
        elif action == "livedraggers":
            group = argv[1] if len(argv) > 1 else "giants"
            print(json.dumps(api.get_live_draggers(group), indent=2))
        elif action == "topbroker":
            period = argv[1] if len(argv) > 1 else "TB_PERIOD_LAST_1_DAY"
            print(json.dumps(api.get_top_broker(period), indent=2))
        elif action == "whale":
            if len(argv) < 2:
                raise ValueError("Usage: scanner-api.py whale <BROKER>")
            print(json.dumps(api.get_whale_activity(argv[1]), indent=2))
        elif action == "trending":
            print(json.dumps(api.get_trending(), indent=2))
        elif action == "detector":
            if len(argv) < 2:
                raise ValueError("Usage: scanner-api.py detector <TICKER>")
            period = argv[2] if len(argv) > 2 else "BROKER_SUMMARY_PERIOD_LATEST"
            print(json.dumps(api.get_symbol_detector(argv[1], period), indent=2))
        elif action == "tape":
            symbols = argv[1].split(",") if len(argv) > 1 and argv[1] else []
            limit = int(argv[2]) if len(argv) > 2 else 20
            print(json.dumps(api.get_running_trade(symbols, limit), indent=2))
        else:
            raise ValueError(f"Unknown command: {action}. Run with --help.")
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

