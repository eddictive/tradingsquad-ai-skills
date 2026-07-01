const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { formatOrderbook, ORDERBOOK_DEPTH, sharesToLots } = require('../core/orderbook-format');

describe('orderbook-format', () => {
  it('converts shares to lots (1 lot = 100 shares)', () => {
    assert.equal(sharesToLots(376900), 3769);
    assert.equal(sharesToLots(0), 0);
  });

  it('formats all 10 bid and offer levels', () => {
    const raw = {
      symbol: 'BBCA',
      lastprice: 5600,
      bid: {
        price1: '5625',
        volume1: '376900',
        que_num1: '201',
        price10: '5400',
        volume10: '5919400',
        que_num10: '894',
      },
      offer: {
        price1: '5650',
        volume1: '1609900',
        que_num1: '90',
        price10: '5875',
        volume10: '914600',
        que_num10: '162',
      },
    };

    // Fill missing levels 2-9 for a realistic fixture
    for (let i = 2; i <= 9; i++) {
      raw.bid[`price${i}`] = String(5625 - i * 25);
      raw.bid[`volume${i}`] = String(i * 100000);
      raw.bid[`que_num${i}`] = String(i * 10);
      raw.offer[`price${i}`] = String(5650 + i * 25);
      raw.offer[`volume${i}`] = String(i * 200000);
      raw.offer[`que_num${i}`] = String(i * 5);
    }

    const out = formatOrderbook(raw);
    assert.equal(out.depth, ORDERBOOK_DEPTH);
    assert.equal(out.bid.length, ORDERBOOK_DEPTH);
    assert.equal(out.offer.length, ORDERBOOK_DEPTH);
    assert.equal(out.bid[0].volumeLots, 3769);
    assert.ok(out.totals.bidLots > 0);
    assert.ok(out.totals.offerLots > 0);
    assert.ok(out.totals.bidOfferRatio > 0);
  });

  it('handles sparse API rows without padding empty levels', () => {
    const out = formatOrderbook({
      bid: { price1: '100', volume1: '500' },
      offer: { price1: '105', volume1: '300' },
    });
    assert.equal(out.bid.length, 1);
    assert.equal(out.offer.length, 1);
    assert.equal(out.bid[0].volumeLots, 5);
  });
});