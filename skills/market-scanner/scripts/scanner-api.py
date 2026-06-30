import sys
import json
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../core")))
from stockbit_auth import StockbitClient

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
        for m in data[:10]:
            result.append({
                "ticker": m["stock_detail"]["code"],
                "price": m["price"],
                "change_percent": f"{m['change']['percentage']:.2f}%",
                "foreign_buy": m.get("net_foreign_buy", {}).get("formatted", "-"),
                "value": m["value"]["formatted"]
            })
        return result

    def get_top_stock(self, start_date, end_date, investor_type="INVESTOR_TYPE_FOREIGN"):
        params = {
            "start": start_date,
            "end": end_date,
            "investor_type": investor_type,
            "market_type": "MARKET_TYPE_REGULER",
            "value_type": "VALUE_TYPE_NET",
            "page": 1
        }
        response = self._get_exodus("/order-trade/top-stock", params)
        
        top_buy = response.get("data", {}).get("top_buy", [])[:10]
        top_sell = response.get("data", {}).get("top_sell", [])[:10]
        
        return {
            "topBuy": [{"ticker": b["code"], "value": b["value"]["formatted"], "avg_price": b["average"]["formatted"]} for b in top_buy],
            "topSell": [{"ticker": s["code"], "value": s["value"]["formatted"], "avg_price": s["average"]["formatted"]} for s in top_sell]
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

    def get_live_draggers(self):
        import time
        from datetime import datetime, timezone, timedelta
        
        giants = ['BBCA', 'BBRI', 'BMRI', 'BBNI', 'TLKM', 'ASII', 'AMMN', 'BREN', 'TPIA', 'BYAN', 'DSSA', 'KLBF', 'UNVR', 'ICBP', 'GOTO', 'ADRO']
        results = []
        
        end_ts = int(time.time())
        start_ts = end_ts - (24 * 60 * 60)
        
        # WIB is UTC+7
        wib_tz = timezone(timedelta(hours=7))
        wib_date = datetime.now(wib_tz)
        today_str = wib_date.strftime('%Y-%m-%d')
        
        for ticker in giants:
            try:
                params = {
                    "from": end_ts,
                    "to": start_ts,
                    "limit": 0,
                    "minutes_multiplier": 1
                }
                raw_data = self._get_exodus(f"/chartbit/{ticker}/price/intraday", params)
                candles = raw_data.get("data", {}).get("chartbit", [])
                
                today_candles = [c for c in candles if c.get("datetime", "").startswith(today_str)]
                
                if today_candles:
                    today_candles.sort(key=lambda x: x["unix_timestamp"])
                    open_price = today_candles[0]["open"]
                    close_price = today_candles[-1]["close"]
                    change = ((close_price - open_price) / open_price) * 100
                    results.append({
                        "ticker": ticker,
                        "open": open_price,
                        "close": close_price,
                        "changePercent": f"{change:.2f}%"
                    })
            except Exception:
                pass
                
        lifters = sorted([r for r in results if float(r["changePercent"].replace('%', '')) >= 0], key=lambda x: float(x["changePercent"].replace('%', '')), reverse=True)
        draggers = sorted([r for r in results if float(r["changePercent"].replace('%', '')) < 0], key=lambda x: float(x["changePercent"].replace('%', '')))
        
        return {"lifters": lifters, "draggers": draggers}

    def get_top_broker(self, period="TB_PERIOD_LAST_1_DAY"):
        params = {
            "sort": "TB_SORT_BY_TOTAL_VALUE",
            "order": "ORDER_BY_DESC",
            "period": period,
            "market_type": "MARKET_TYPE_REGULER"
        }
        response = self._get_exodus("/order-trade/broker/top", params)
        data = response.get("data", {}).get("list", [])[:10]
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
            return res[:10]

        return {
            "bandar_detector": bandar_detector,
            "top_buy": format_netbs(summary.get("brokers_buy", [])),
            "top_sell": format_netbs(summary.get("brokers_sell", []))
        }

    def get_trending(self):
        response = self._get_exodus("/emitten/trending")
        data = response.get("data", {}).get("list", [])[:15]
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
            "limit": 25,
            "period": period
        }
        response = self._get_exodus(f"/marketdetectors/{ticker}", params)
        return response.get("data", None)

    def get_running_trade(self, symbols, limit=50):
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

if __name__ == "__main__":
    api = ScannerAPIClient()
    action = sys.argv[1] if len(sys.argv) > 1 else "mover"
    
    if action == "mover":
        data = api.get_market_mover()
        print("Top Net Foreign Buy:", json.dumps(data, indent=2))
    elif action == "topstock":
        data = api.get_top_stock("2026-06-01", "2026-06-25")
        print("Top Foreign Stock:", json.dumps(data, indent=2))
    elif action == "screener":
        template = sys.argv[2] if len(sys.argv) > 2 else "ACCUMULATION"
        data = api.run_screener(template)
        print(f"Screener [{template}]:", json.dumps(data, indent=2))
    elif action == "livedraggers":
        data = api.get_live_draggers()
        print("Live Big Caps Draggers:", json.dumps(data, indent=2))
    elif action == "topbroker":
        period = sys.argv[2] if len(sys.argv) > 2 else "TB_PERIOD_LAST_1_DAY"
        data = api.get_top_broker(period)
        print(f"Top Brokers [{period}]:", json.dumps(data, indent=2))
    elif action == "whale":
        if len(sys.argv) < 3:
            print("Provide broker code, e.g. python scanner-api.py whale AK")
            sys.exit(1)
        broker = sys.argv[2]
        data = api.get_whale_activity(broker)
        print(f"Whale Activity [{broker}]:", json.dumps(data, indent=2))
    elif action == "trending":
        data = api.get_trending()
        print("Trending Stocks:", json.dumps(data, indent=2))
    elif action == "detector":
        if len(sys.argv) < 3:
            print("Provide ticker code, e.g. python scanner-api.py detector CUAN")
            sys.exit(1)
        ticker = sys.argv[2]
        period = sys.argv[3] if len(sys.argv) > 3 else "BROKER_SUMMARY_PERIOD_LATEST"
        data = api.get_symbol_detector(ticker, period)
        print(f"Symbol Detector [{ticker}]:", json.dumps(data, indent=2))
    elif action == "tape":
        symbols_arg = sys.argv[2] if len(sys.argv) > 2 else ""
        symbols = symbols_arg.split(',') if symbols_arg else []
        limit = int(sys.argv[3]) if len(sys.argv) > 3 else 20
        data = api.get_running_trade(symbols, limit)
        print("Running Trade Tape:", json.dumps(data, indent=2))

