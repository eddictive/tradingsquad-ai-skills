import sys
import json
import os
import math
from datetime import datetime, timedelta

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../core")))
from stockbit_auth import StockbitClient

class TechnicalAPIClient(StockbitClient):

    # ==========================================
    # RAW DATA FETCHERS
    # ==========================================

    def get_stock_price(self, ticker):
        response = self._get_exodus(f"/emitten/{ticker}/info")
        return response.get("data", {})

    def get_historical_price(self, ticker, days=365):
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        params = {
            "from": end_date.strftime("%Y-%m-%d"),
            "to": start_date.strftime("%Y-%m-%d"),
            "limit": 0
        }
        response = self._get_exodus(f"/chartbit/{ticker}/price/daily", params)
        candles = response.get("data", {}).get("chartbit", [])
        # Ensure chronological order (oldest first)
        def parse_date(c):
            dt = c.get("date") or c.get("datetime", "")
            try: return datetime.strptime(dt[:10], "%Y-%m-%d").timestamp()
            except: return 0
        candles.sort(key=parse_date)
        return candles

    def _get_ts(self, c):
        val = c.get("datetime") or c.get("time") or 0
        if isinstance(val, (int, float)):
            return val
        try:
            val_clean = val.replace("Z", "+00:00")
            dt = datetime.fromisoformat(val_clean)
            return int(dt.timestamp())
        except Exception:
            return 0

    def _resample_ohlcv(self, candles, target_minutes):
        if not candles:
            return []
            
        sorted_candles = sorted(candles, key=self._get_ts)
        resampled = []
        current_bucket = None
        agg = {"open": None, "high": -float('inf'), "low": float('inf'), "close": None, "volume": 0}

        interval_secs = target_minutes * 60

        for candle in sorted_candles:
            ts = self._get_ts(candle)
            if ts == 0:
                continue
                
            bucket_start_ts = (ts // interval_secs) * interval_secs

            if current_bucket is not None and bucket_start_ts != current_bucket:
                resampled.append({"timestamp": current_bucket, **agg})
                agg = {"open": None, "high": -float('inf'), "low": float('inf'), "close": None, "volume": 0}
            
            current_bucket = bucket_start_ts
            
            c_open = float(candle.get("open", 0))
            c_high = float(candle.get("high", 0))
            c_low = float(candle.get("low", 0))
            c_close = float(candle.get("close", 0))
            c_vol = float(candle.get("volume", 0))

            if agg["open"] is None:
                agg["open"] = c_open
            agg["high"] = max(agg["high"], c_high)
            agg["low"] = min(agg["low"], c_low)
            agg["close"] = c_close
            agg["volume"] += c_vol

        if current_bucket is not None:
            resampled.append({"timestamp": current_bucket, **agg})
            
        return resampled

    def get_intraday_price(self, ticker, timeframe="5m", days=1):
        tf_map = {"1m": 1, "5m": 5, "15m": 15, "1h": 60, "4h": 240}
        target_minutes = tf_map.get(timeframe.lower())
        if not target_minutes:
            raise ValueError(f"Unsupported timeframe: {timeframe}")

        end_ts = int(datetime.now().timestamp())
        start_ts = end_ts - (days * 24 * 60 * 60)
        params = {"from": end_ts, "to": start_ts, "limit": 0, "minutes_multiplier": 1}
        
        response = self._get_exodus(f"/chartbit/{ticker}/price/intraday", params)
        candles = response.get("data", {}).get("chartbit", [])
        
        candles.sort(key=self._get_ts)
        
        if target_minutes == 1:
            return candles
        return self._resample_ohlcv(candles, target_minutes)

    # ==========================================
    # INDICATOR CALCULATORS
    # ==========================================

    def _calc_sma(self, data, period, key="close"):
        if len(data) < period:
            return None
        slice_data = data[-period:]
        total = sum(float(val.get(key, 0)) for val in slice_data)
        return total / period

    def _calc_rsi(self, data, period=14, key="close"):
        if len(data) <= period:
            return None
        gains = 0.0
        losses = 0.0
        for i in range(len(data) - period, len(data)):
            diff = float(data[i].get(key, 0)) - float(data[i-1].get(key, 0))
            if diff >= 0:
                gains += diff
            else:
                losses -= diff
                
        avg_gain = gains / period
        avg_loss = losses / period
        
        if avg_loss == 0:
            return 100.0
            
        rs = avg_gain / avg_loss
        return 100.0 - (100.0 / (1.0 + rs))

    def _calc_vwap(self, data):
        if not data:
            return None
        cum_price_vol = 0.0
        cum_vol = 0.0
        for c in data:
            c_high = float(c.get("high", 0))
            c_low = float(c.get("low", 0))
            c_close = float(c.get("close", 0))
            c_vol = float(c.get("volume", 0))
            
            typical_price = (c_high + c_low + c_close) / 3.0
            cum_price_vol += typical_price * c_vol
            cum_vol += c_vol
            
        if cum_vol == 0:
            return None
        return cum_price_vol / cum_vol

    def _calc_fibonacci(self, high, low):
        diff = high - low
        return {
            "High (0.0)": high,
            "Fibo 0.236": high - (diff * 0.236),
            "Fibo 0.382": high - (diff * 0.382),
            "Fibo 0.500": high - (diff * 0.5),
            "Fibo 0.618 (Golden)": high - (diff * 0.618),
            "Fibo 0.786": high - (diff * 0.786),
            "Low (1.0)": low,
            "Ext 1.618 (Target)": high + (diff * 0.618)
        }

    def _get_high_low(self, data):
        if not data:
            return {"high": 0, "low": 0}
        high = -float('inf')
        low = float('inf')
        for c in data:
            c_high = float(c.get("high", 0))
            c_low = float(c.get("low", 0))
            if c_high > high:
                high = c_high
            if c_low < low:
                low = c_low
        return {"high": high, "low": low}

    # ==========================================
    # CONTEXT-AWARE ANALYSIS
    # ==========================================

    def get_analysis(self, ticker, mode="swing"):
        if mode == "intraday":
            data = self.get_intraday_price(ticker, "5m", 3)
            if not data:
                return {"error": "No intraday data found"}
                
            last_price = float(data[-1].get("close", 0))
            
            today_str = datetime.now().strftime("%Y-%m-%d")
            today_data = [c for c in data if str(c.get("date") or c.get("datetime") or "").startswith(today_str)]
            active_data = today_data if today_data else data
            hl = self._get_high_low(active_data)
            
            return {
                "mode": "INTRADAY",
                "timeframe": "5m",
                "lastPrice": last_price,
                "vwap": self._calc_vwap(active_data),
                "ma9": self._calc_sma(data, 9),
                "ma21": self._calc_sma(data, 21),
                "dayHighLow": hl,
                "fibonacci": self._calc_fibonacci(hl["high"], hl["low"])
            }
            
        elif mode == "swing":
            data = self.get_historical_price(ticker, 90)
            if not data:
                return {"error": "No historical data found"}
                
            last_price = float(data[-1].get("close", 0))
            hl = self._get_high_low(data)
            
            return {
                "mode": "SWING",
                "timeframe": "Daily",
                "period": "3 Months",
                "lastPrice": last_price,
                "ma10": self._calc_sma(data, 10),
                "ma20": self._calc_sma(data, 20),
                "ma50": self._calc_sma(data, 50),
                "rsi14": self._calc_rsi(data, 14),
                "swingHighLow": hl,
                "fibonacci": self._calc_fibonacci(hl["high"], hl["low"])
            }
            
        elif mode == "longterm":
            data = self.get_historical_price(ticker, 365)
            if not data:
                return {"error": "No historical data found"}
                
            last_price = float(data[-1].get("close", 0))
            hl = self._get_high_low(data)
            
            return {
                "mode": "LONG-TERM",
                "timeframe": "Daily",
                "period": "1 Year",
                "lastPrice": last_price,
                "ma50": self._calc_sma(data, 50),
                "ma200": self._calc_sma(data, 200),
                "rsi14": self._calc_rsi(data, 14),
                "yearHighLow": hl,
                "fibonacci": self._calc_fibonacci(hl["high"], hl["low"])
            }
        elif mode == "short_swing":
            data = self.get_intraday_price(ticker, "1h", 7)
            if not data:
                return {"error": "No short_swing data found"}
                
            last_price = float(data[-1].get("close", 0))
            hl = self._get_high_low(data)
            
            return {
                "mode": "SHORT_SWING",
                "timeframe": "1h",
                "period": "7 Days",
                "lastPrice": last_price,
                "vwap": self._calc_vwap(data),
                "ma10": self._calc_sma(data, 10),
                "ma20": self._calc_sma(data, 20),
                "ma50": self._calc_sma(data, 50),
                "rsi14": self._calc_rsi(data, 14),
                "swingHighLow": hl,
                "fibonacci": self._calc_fibonacci(hl["high"], hl["low"])
            }
        else:
            raise ValueError("Invalid mode. Use 'intraday', 'short_swing', 'swing', or 'longterm'.")

if __name__ == "__main__":
    api = TechnicalAPIClient()
    try:
        api.login()
        ticker = sys.argv[1] if len(sys.argv) > 1 else "BBCA"
        mode = sys.argv[2] if len(sys.argv) > 2 else "swing"
        
        data = api.get_analysis(ticker, mode)
        print(f"Technical Analysis [{mode.upper()}] for {ticker}:")
        print(json.dumps(data, indent=2))
    except Exception as e:
        print(f"Error: {e}")
