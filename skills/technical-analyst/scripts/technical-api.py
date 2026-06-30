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
            
        sum_gain = 0.0
        sum_loss = 0.0
        
        # 1. Calculate initial SMA for the first 'period' bars
        for i in range(1, period + 1):
            diff = float(data[i].get(key, 0)) - float(data[i-1].get(key, 0))
            if diff >= 0:
                sum_gain += diff
            else:
                sum_loss -= diff
                
        avg_gain = sum_gain / period
        avg_loss = sum_loss / period
        
        # 2. Calculate Smoothed Moving Average (RMA) for the rest of the historical dataset
        for i in range(period + 1, len(data)):
            diff = float(data[i].get(key, 0)) - float(data[i-1].get(key, 0))
            gain = diff if diff >= 0 else 0.0
            loss = -diff if diff < 0 else 0.0
            
            avg_gain = ((avg_gain * (period - 1)) + gain) / period
            avg_loss = ((avg_loss * (period - 1)) + loss) / period
            
        if avg_loss == 0:
            return 100.0
            
        rs = avg_gain / avg_loss
        return 100.0 - (100.0 / (1.0 + rs))

    def _calc_bollinger_bands(self, data, period=20, std_dev=2, key="close"):
        if len(data) < period:
            return None
        slice_data = data[-period:]
        vals = [float(c.get(key, 0)) for c in slice_data]
        sma = sum(vals) / period
        variance = sum((v - sma) ** 2 for v in vals) / period
        sd = math.sqrt(variance)
        return {
            "upper": sma + (std_dev * sd),
            "middle": sma,
            "lower": sma - (std_dev * sd)
        }

    def _calc_macd(self, data, fast=12, slow=26, signal=9, key="close"):
        if len(data) < slow + signal:
            return None
            
        k_fast = 2.0 / (fast + 1)
        k_slow = 2.0 / (slow + 1)
        
        ema_fast_arr = [None] * len(data)
        ema_slow_arr = [None] * len(data)
        
        sum_f = sum(float(data[i].get(key, 0)) for i in range(fast))
        ema_fast_arr[fast-1] = sum_f / fast
        for i in range(fast, len(data)):
            val = float(data[i].get(key, 0))
            ema_fast_arr[i] = (val - ema_fast_arr[i-1]) * k_fast + ema_fast_arr[i-1]
            
        sum_s = sum(float(data[i].get(key, 0)) for i in range(slow))
        ema_slow_arr[slow-1] = sum_s / slow
        for i in range(slow, len(data)):
            val = float(data[i].get(key, 0))
            ema_slow_arr[i] = (val - ema_slow_arr[i-1]) * k_slow + ema_slow_arr[i-1]
            
        macd_line_arr = []
        for i in range(slow-1, len(data)):
            macd_line_arr.append(ema_fast_arr[i] - ema_slow_arr[i])
            
        sum_sig = sum(macd_line_arr[:signal])
        ema_sig = sum_sig / signal
        for i in range(signal, len(macd_line_arr)):
            ema_sig = (macd_line_arr[i] - ema_sig) * (2.0 / (signal + 1)) + ema_sig
            
        macd_line = macd_line_arr[-1]
        signal_line = ema_sig
        histogram = macd_line - signal_line
        
        return {"MACD": macd_line, "Signal": signal_line, "Histogram": histogram}

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

    def _calc_smc(self, data):
        if len(data) < 5:
            return None
            
        swing_highs = []
        swing_lows = []
        
        for i in range(2, len(data) - 2):
            h_cur = float(data[i].get("high", 0))
            h_prev1 = float(data[i-1].get("high", 0))
            h_prev2 = float(data[i-2].get("high", 0))
            h_next1 = float(data[i+1].get("high", 0))
            h_next2 = float(data[i+2].get("high", 0))
            
            if h_cur > h_prev1 and h_cur > h_prev2 and h_cur > h_next1 and h_cur > h_next2:
                swing_highs.append(h_cur)
                
            l_cur = float(data[i].get("low", 0))
            l_prev1 = float(data[i-1].get("low", 0))
            l_prev2 = float(data[i-2].get("low", 0))
            l_next1 = float(data[i+1].get("low", 0))
            l_next2 = float(data[i+2].get("low", 0))
            
            if l_cur < l_prev1 and l_cur < l_prev2 and l_cur < l_next1 and l_cur < l_next2:
                swing_lows.append(l_cur)
                
        last_swing_high = swing_highs[-1] if swing_highs else None
        last_swing_low = swing_lows[-1] if swing_lows else None
        
        current_price = float(data[-1].get("close", 0))
        structure = "Consolidation"
        if last_swing_high and current_price > last_swing_high:
            structure = "Bullish BoS / CHoCH"
        elif last_swing_low and current_price < last_swing_low:
            structure = "Bearish BoS / CHoCH"
        elif last_swing_high and last_swing_low:
            if current_price > (last_swing_high + last_swing_low) / 2.0:
                structure = "Premium (Bearish Bias)"
            else:
                structure = "Discount (Bullish Bias)"
                
        fvgs = []
        for i in range(2, len(data)):
            l_cur = float(data[i].get("low", 0))
            h_prev2 = float(data[i-2].get("high", 0))
            
            h_cur = float(data[i].get("high", 0))
            l_prev2 = float(data[i-2].get("low", 0))
            
            if l_cur > h_prev2:
                fvgs.append({"type": "Bullish", "top": l_cur, "bottom": h_prev2, "age": len(data) - 1 - i})
            elif h_cur < l_prev2:
                fvgs.append({"type": "Bearish", "top": h_cur, "bottom": l_prev2, "age": len(data) - 1 - i})
                
        unmitigated_fvgs = []
        for fvg in fvgs:
            is_mitigated = False
            start_idx = len(data) - fvg["age"]
            for j in range(start_idx, len(data)):
                if fvg["type"] == "Bullish" and float(data[j].get("low", 0)) <= fvg["top"]:
                    is_mitigated = True
                if fvg["type"] == "Bearish" and float(data[j].get("high", 0)) >= fvg["bottom"]:
                    is_mitigated = True
            if not is_mitigated:
                unmitigated_fvgs.append(fvg)
                
        recent_fvgs = [f"{f['type']} FVG: {f['bottom']} - {f['top']}" for f in unmitigated_fvgs[-3:]]
        
        return {
            "lastSwingHigh": last_swing_high,
            "lastSwingLow": last_swing_low,
            "structure": structure,
            "unmitigatedFVGs": recent_fvgs
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

    def _calc_atr(self, data, period=14):
        if not data or len(data) < period: return None
        trs = []
        for i in range(1, len(data)):
            high = float(data[i].get("high", 0))
            low = float(data[i].get("low", 0))
            prev_close = float(data[i-1].get("close", 0))
            tr = max(high - low, abs(high - prev_close), abs(low - prev_close))
            trs.append(tr)
        return sum(trs[-period:]) / period

    def _calc_volume_profile(self, data, bins=10):
        if not data: return None
        max_p = -float('inf')
        min_p = float('inf')
        for c in data:
            h, l = float(c.get("high", 0)), float(c.get("low", 0))
            if h > max_p: max_p = h
            if l < min_p: min_p = l
        
        step = (max_p - min_p) / bins
        if step == 0: return {"poc": float(data[0].get("close",0)), "supportArea": f"{min_p} - {max_p}"}
        
        profile = [{"priceStart": min_p + i*step, "priceEnd": min_p + (i+1)*step, "volume": 0} for i in range(bins)]
        for c in data:
            typ_price = (float(c.get("high", 0)) + float(c.get("low", 0)) + float(c.get("close", 0))) / 3
            vol = float(c.get("volume", 0))
            idx = int((typ_price - min_p) // step)
            if idx >= bins: idx = bins - 1
            if idx < 0: idx = 0
            profile[idx]["volume"] += vol
            
        poc = max(profile, key=lambda x: x["volume"])
        return {
            "poc": (poc["priceStart"] + poc["priceEnd"]) / 2,
            "supportArea": f"{poc['priceStart']:.0f} - {poc['priceEnd']:.0f}"
        }

    def get_analysis(self, ticker, mode="swing"):
        daily_data = self.get_historical_price(ticker, 365)
        
        def get_weekly_data(daily):
            weekly = []
            current_week = -1
            agg = None
            for c in daily:
                date_str = c.get("date") or c.get("datetime")
                if not date_str: continue
                try:
                    d = datetime.strptime(date_str.split("T")[0], "%Y-%m-%d")
                except:
                    continue
                week_id = d.isocalendar()[0] * 100 + d.isocalendar()[1]
                if week_id != current_week:
                    if agg: weekly.append(agg)
                    current_week = week_id
                    agg = c.copy()
                    agg["high"] = float(c["high"])
                    agg["low"] = float(c["low"])
                    agg["close"] = float(c["close"])
                else:
                    agg["high"] = max(agg["high"], float(c["high"]))
                    agg["low"] = min(agg["low"], float(c["low"]))
                    agg["close"] = float(c["close"])
            if agg: weekly.append(agg)
            return weekly

        if mode == "intraday":
            data = self.get_intraday_price(ticker, "5m", 3)
            h1_data = self.get_intraday_price(ticker, "1h", 7)
            if not data:
                return {"error": "No intraday data found"}
                
            last_price = float(data[-1].get("close", 0))
            today_str = datetime.now().strftime("%Y-%m-%d")
            today_data = [c for c in data if str(c.get("date") or c.get("datetime") or "").startswith(today_str)]
            active_data = today_data if today_data else data
            hl = self._get_high_low(active_data)
            
            return {
                "mode": "INTRADAY_MTF",
                "timeframe": "Edge(5m) / Structural(1h) / Macro(D1)",
                "lastPrice": last_price,
                "atr14": self._calc_atr(data, 14),
                "volumeProfilePOC": self._calc_volume_profile(data, 10),
                "vwap": self._calc_vwap(active_data),
                "ma9": self._calc_sma(data, 9),
                "ma21": self._calc_sma(data, 21),
                "macd": self._calc_macd(data),
                "bollingerBands": self._calc_bollinger_bands(data),
                "SMC_Macro_D1": self._calc_smc(daily_data) if daily_data else None,
                "SMC_Structural_H1": self._calc_smc(h1_data) if h1_data else None,
                "SMC_Edge_M5": self._calc_smc(data),
                "dayHighLow": hl,
                "fibonacci": self._calc_fibonacci(hl["high"], hl["low"])
            }
            
        elif mode == "short_swing":
            data = self.get_intraday_price(ticker, "15m", 7)
            h1_data = self.get_intraday_price(ticker, "1h", 7)
            if not data:
                return {"error": "No short_swing data found"}
                
            last_price = float(data[-1].get("close", 0))
            hl = self._get_high_low(data)
            
            today_str = datetime.now().strftime("%Y-%m-%d")
            today_data = [c for c in data if str(c.get("date") or c.get("datetime") or "").startswith(today_str)]
            active_data = today_data if today_data else data[-28:]
            
            return {
                "mode": "SHORT_SWING_MTF",
                "timeframe": "Edge(15m) / Structural(1h) / Macro(D1)",
                "lastPrice": last_price,
                "atr14": self._calc_atr(data, 14),
                "volumeProfilePOC": self._calc_volume_profile(data, 10),
                "vwap": self._calc_vwap(active_data),
                "ma10": self._calc_sma(data, 10),
                "ma20": self._calc_sma(data, 20),
                "ma50": self._calc_sma(data, 50),
                "rsi14": self._calc_rsi(data, 14),
                "macd": self._calc_macd(data),
                "bollingerBands": self._calc_bollinger_bands(data),
                "SMC_Macro_D1": self._calc_smc(daily_data) if daily_data else None,
                "SMC_Structural_H1": self._calc_smc(h1_data) if h1_data else None,
                "SMC_Edge_M15": self._calc_smc(data),
                "swingHighLow": hl,
                "fibonacci": self._calc_fibonacci(hl["high"], hl["low"])
            }
            
        elif mode == "swing":
            data = self.get_historical_price(ticker, 90)
            h4_data = self.get_intraday_price(ticker, "4h", 30)
            weekly_data = get_weekly_data(daily_data)
            
            if not data:
                return {"error": "No historical data found"}
                
            last_price = float(data[-1].get("close", 0))
            hl = self._get_high_low(data)
            
            return {
                "mode": "SWING_MTF",
                "timeframe": "Edge(4h) / Structural(D1) / Macro(W1)",
                "lastPrice": last_price,
                "atr14": self._calc_atr(data, 14),
                "volumeProfilePOC": self._calc_volume_profile(data, 10),
                "ma10": self._calc_sma(data, 10),
                "ma20": self._calc_sma(data, 20),
                "ma50": self._calc_sma(data, 50),
                "rsi14": self._calc_rsi(data, 14),
                "macd": self._calc_macd(data),
                "bollingerBands": self._calc_bollinger_bands(data),
                "SMC_Macro_W1": self._calc_smc(weekly_data) if weekly_data else None,
                "SMC_Structural_D1": self._calc_smc(data),
                "SMC_Edge_H4": self._calc_smc(h4_data) if h4_data else None,
                "swingHighLow": hl,
                "fibonacci": self._calc_fibonacci(hl["high"], hl["low"])
            }
            
        elif mode == "longterm":
            data = self.get_historical_price(ticker, 365)
            weekly_data = get_weekly_data(daily_data)
            if not data:
                return {"error": "No historical data found"}
                
            last_price = float(data[-1].get("close", 0))
            hl = self._get_high_low(data)
            
            return {
                "mode": "LONGTERM_MTF",
                "timeframe": "Edge(D1) / Structural(W1) / Macro(M1)",
                "lastPrice": last_price,
                "atr14": self._calc_atr(data, 14),
                "volumeProfilePOC": self._calc_volume_profile(data, 10),
                "ma50": self._calc_sma(data, 50),
                "ma200": self._calc_sma(data, 200),
                "rsi14": self._calc_rsi(data, 14),
                "macd": self._calc_macd(data),
                "bollingerBands": self._calc_bollinger_bands(data),
                "SMC_Macro_W1": self._calc_smc(weekly_data) if weekly_data else None,
                "SMC_Structural_W1": self._calc_smc(weekly_data) if weekly_data else None,
                "SMC_Edge_D1": self._calc_smc(data),
                "yearHighLow": hl,
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
