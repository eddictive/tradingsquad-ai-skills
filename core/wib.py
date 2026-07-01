"""
WIB (Western Indonesian Time, UTC+7) utilities for IDX session windowing.
Active trading session: 09:00–16:00 WIB.
"""

from datetime import datetime, timedelta, timezone

WIB = timezone(timedelta(hours=7))
MARKET_OPEN_HOUR = 9
MARKET_CLOSE_HOUR = 16


def get_wib_now(reference=None):
    ref = reference or datetime.now(timezone.utc)
    if ref.tzinfo is None:
        ref = ref.replace(tzinfo=timezone.utc)
    return ref.astimezone(WIB)


def get_wib_date_string(reference=None):
    return get_wib_now(reference).strftime("%Y-%m-%d")


def _get_candle_timestamp(candle):
    val = candle.get("datetime") or candle.get("time") or candle.get("unix_timestamp")
    if isinstance(val, (int, float)):
        ts = float(val)
        if ts < 1e12:
            ts *= 1000
        return datetime.fromtimestamp(ts / 1000, tz=timezone.utc)
    if isinstance(val, str) and val:
        try:
            clean = val.replace("Z", "+00:00")
            return datetime.fromisoformat(clean)
        except ValueError:
            if len(val) >= 10:
                return datetime.strptime(val[:10], "%Y-%m-%d").replace(tzinfo=WIB)
    return None


def get_candle_wib_date_string(candle):
    ts = _get_candle_timestamp(candle)
    if ts is not None:
        return ts.astimezone(WIB).strftime("%Y-%m-%d")
    dt = str(candle.get("datetime") or candle.get("date") or "")
    return dt[:10] if len(dt) >= 10 else ""


def _get_candle_wib_hour(candle):
    dt = str(candle.get("datetime") or candle.get("date") or "")
    if "T" in dt and len(dt) >= 13:
        try:
            return int(dt.split("T")[1][:2])
        except ValueError:
            pass
    ts = _get_candle_timestamp(candle)
    if ts is not None:
        return ts.astimezone(WIB).hour
    return None


def filter_from_market_open(candles, reference=None):
    if not candles:
        return []
    today_str = get_wib_date_string(reference)

    session = [
        c for c in candles
        if get_candle_wib_date_string(c) == today_str
        and (_get_candle_wib_hour(c) is None or MARKET_OPEN_HOUR <= _get_candle_wib_hour(c) <= MARKET_CLOSE_HOUR)
    ]
    if session:
        return session
    return [c for c in candles if get_candle_wib_date_string(c) == today_str]


def filter_today_wib(candles, reference=None):
    if not candles:
        return []
    today_str = get_wib_date_string(reference)
    return [c for c in candles if get_candle_wib_date_string(c) == today_str]