import sys
import os
from datetime import datetime, timedelta

# Import the Shared Core Authentication Module
sys.path.append(os.path.join(os.path.dirname(__file__), '../../../core'))
from stockbit_auth import StockbitClient

class TechnicalAPIClient(StockbitClient):
    """
    Technical Analysis Client.
    Inherits from StockbitClient for seamless background authentication.
    """
    def get_stock_price(self, ticker):
        """Current Price and Daily Change."""
        return self._get_exodus(f"/emitten/{ticker}/info").get("data", {})

    def get_historical_price(self, ticker, days=90):
        """Daily OHLCV Data."""
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        params = {"from": end_date.strftime("%Y-%m-%d"), "to": start_date.strftime("%Y-%m-%d"), "limit": 0}
        return self._get_exodus(f"/chartbit/{ticker}/price/daily", params=params).get("data", {}).get("chartbit", [])

    def _resample_ohlcv(self, candles: list, target_minutes: int) -> list:
        if not candles: return []
        def get_ts(c):
            ts_val = c.get("datetime") or c.get("time") or 0
            if isinstance(ts_val, int): return ts_val
            try: return int(datetime.fromisoformat(str(ts_val).replace("Z", "+00:00")).timestamp())
            except: return 0

        sorted_candles = sorted(candles, key=get_ts)
        resampled_data = []
        current_bucket = None
        agg = {"open": None, "high": float('-inf'), "low": float('inf'), "close": None, "volume": 0}

        def pfloat(v): return float(v) if v is not None else 0.0

        for candle in sorted_candles:
            ts = get_ts(candle)
            if ts == 0: continue
            
            interval_secs = target_minutes * 60
            bucket_start_ts = (ts // interval_secs) * interval_secs
            
            if current_bucket is not None and bucket_start_ts != current_bucket:
                resampled_data.append({
                    "timestamp": current_bucket,
                    "datetime": datetime.fromtimestamp(current_bucket).strftime("%Y-%m-%d %H:%M:%S"),
                    **agg
                })
                agg = {"open": None, "high": float('-inf'), "low": float('inf'), "close": None, "volume": 0}
            
            current_bucket = bucket_start_ts
            if agg["open"] is None: agg["open"] = pfloat(candle.get('open'))
            agg["high"] = max(agg["high"], pfloat(candle.get('high')))
            agg["low"] = min(agg["low"], pfloat(candle.get('low')))
            agg["close"] = pfloat(candle.get('close'))
            agg["volume"] += pfloat(candle.get('volume'))
            
        if current_bucket is not None:
             resampled_data.append({
                "timestamp": current_bucket,
                "datetime": datetime.fromtimestamp(current_bucket).strftime("%Y-%m-%d %H:%M:%S"),
                **agg
            })
        return resampled_data

    def get_intraday_price(self, ticker, timeframe="15m", days=3):
        """Intraday OHLCV Data Resampled."""
        tf_map = {"1m": 1, "5m": 5, "15m": 15, "1h": 60, "4h": 240, "12h": 720}
        target_minutes = tf_map.get(timeframe.lower())
        if not target_minutes: raise ValueError(f"Unsupported timeframe: {timeframe}")
        
        end_ts = int(datetime.now().timestamp())
        start_ts = int((datetime.now() - timedelta(days=days)).timestamp())
        
        params = {"from": end_ts, "to": start_ts, "limit": 0, "minutes_multiplier": 1}
        candles = self._get_exodus(f"/chartbit/{ticker}/price/intraday", params=params).get("data", {}).get("chartbit", [])
        
        if target_minutes == 1: return candles
        return self._resample_ohlcv(candles, target_minutes)

if __name__ == "__main__":
    api = TechnicalAPIClient()
    api.login()
    print("Technical Data Example (BBCA 1D):")
    print(api.get_historical_price("BBCA", days=5))
