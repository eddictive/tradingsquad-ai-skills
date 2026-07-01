/**
 * WIB (Western Indonesian Time, UTC+7) utilities for IDX session windowing.
 * Active trading session: 09:00–16:00 WIB.
 */

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const MARKET_OPEN_HOUR = 9;
const MARKET_CLOSE_HOUR = 16;

function getWIBNow(referenceDate = new Date()) {
  return new Date(referenceDate.getTime() + WIB_OFFSET_MS);
}

function getWIBDateString(referenceDate = new Date()) {
  const wib = getWIBNow(referenceDate);
  const y = wib.getUTCFullYear();
  const m = String(wib.getUTCMonth() + 1).padStart(2, '0');
  const d = String(wib.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getCandleTimestampMs(candle) {
  const val = candle.datetime || candle.time || candle.unix_timestamp;
  if (typeof val === 'number') {
    return val < 1e12 ? val * 1000 : val;
  }
  if (typeof val === 'string' && val.length > 0) {
    const normalized = val.replace('Z', '+00:00');
    const parsed = Date.parse(normalized);
    if (!Number.isNaN(parsed)) return parsed;
    if (val.length >= 10) {
      const dateOnly = Date.parse(`${val.slice(0, 10)}T00:00:00+07:00`);
      if (!Number.isNaN(dateOnly)) return dateOnly;
    }
  }
  return null;
}

function getCandleWIBDateString(candle) {
  const ts = getCandleTimestampMs(candle);
  if (ts !== null) return getWIBDateString(new Date(ts));
  const dt = String(candle.datetime || candle.date || '');
  return dt.length >= 10 ? dt.slice(0, 10) : '';
}

function getCandleWIBHour(candle) {
  const dt = String(candle.datetime || candle.date || '');
  const match = dt.match(/T(\d{2}):(\d{2})/);
  if (match) return parseInt(match[1], 10);
  const ts = getCandleTimestampMs(candle);
  if (ts !== null) return getWIBNow(new Date(ts)).getUTCHours();
  return null;
}

/**
 * Keep candles from 09:00–16:00 WIB on the current (or reference) trading day.
 */
function filterFromMarketOpen(candles, referenceDate = new Date()) {
  if (!candles || candles.length === 0) return [];
  const todayStr = getWIBDateString(referenceDate);

  const session = candles.filter((c) => {
    const candleDate = getCandleWIBDateString(c);
    if (candleDate !== todayStr) return false;
    const hour = getCandleWIBHour(c);
    if (hour === null) return true;
    return hour >= MARKET_OPEN_HOUR && hour <= MARKET_CLOSE_HOUR;
  });

  if (session.length > 0) return session;

  return candles.filter((c) => getCandleWIBDateString(c) === todayStr);
}

/**
 * All candles on the current WIB trading day (used as fallback when session filter is empty).
 */
function filterTodayWIB(candles, referenceDate = new Date()) {
  if (!candles || candles.length === 0) return [];
  const todayStr = getWIBDateString(referenceDate);
  return candles.filter((c) => getCandleWIBDateString(c) === todayStr);
}

module.exports = {
  WIB_OFFSET_MS,
  MARKET_OPEN_HOUR,
  MARKET_CLOSE_HOUR,
  getWIBNow,
  getWIBDateString,
  getCandleTimestampMs,
  getCandleWIBDateString,
  filterFromMarketOpen,
  filterTodayWIB,
};