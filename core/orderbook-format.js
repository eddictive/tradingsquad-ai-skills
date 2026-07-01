/**
 * Normalize Stockbit orderbook to 10-level BID/OFFER boards (matches BEI / Stockbit app).
 * Rule of 5 does NOT apply here — full depth is required for queue intelligence.
 */

const ORDERBOOK_DEPTH = 10;
const SHARES_PER_LOT = 100;

function sharesToLots(shares) {
  const n = Number(shares);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n / SHARES_PER_LOT);
}

function parseSide(side = {}, prefix) {
  const rows = [];
  for (let i = 1; i <= ORDERBOOK_DEPTH; i++) {
    const price = side[`price${i}`];
    if (price == null || price === '') continue;
    const volumeShares = Number(side[`volume${i}`] || 0);
    rows.push({
      level: i,
      price: Number(price),
      volumeShares,
      volumeLots: sharesToLots(volumeShares),
      queueCount: Number(side[`que_num${i}`] || 0),
    });
  }
  return rows;
}

function formatOrderbook(data = {}) {
  const bid = parseSide(data.bid, 'bid');
  const offer = parseSide(data.offer, 'offer');
  const totalBidLots = bid.reduce((sum, row) => sum + row.volumeLots, 0);
  const totalOfferLots = offer.reduce((sum, row) => sum + row.volumeLots, 0);
  const bidOfferRatio =
    totalOfferLots > 0 ? Number((totalBidLots / totalOfferLots).toFixed(2)) : null;

  return {
    symbol: data.symbol || data.symbol_2 || null,
    lastPrice: Number(data.lastprice || data.close || 0) || null,
    depth: ORDERBOOK_DEPTH,
    bid,
    offer,
    totals: {
      bidLots: totalBidLots,
      offerLots: totalOfferLots,
      bidOfferRatio,
    },
  };
}

module.exports = { ORDERBOOK_DEPTH, SHARES_PER_LOT, sharesToLots, formatOrderbook };