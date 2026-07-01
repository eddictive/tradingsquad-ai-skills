const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateQuantScore,
  resolveRating,
  WEIGHTS,
} = require('../core/quant-score');

describe('quant-score', () => {
  it('sums explicit engine scores to total', () => {
    const result = calculateQuantScore({
      ticker: 'BBCA',
      technical: { score: 15 },
      fundamental: { score: 14 },
      sentiment: { score: 11 },
      bandarmologi: { score: 32 },
    });
    assert.equal(result.totalQuantScore, 72);
    assert.equal(result.rating, 'BUY');
    assert.equal(result.ticker, 'BBCA');
  });

  it('accepts bandarmology alias for backward compatibility', () => {
    const result = calculateQuantScore({
      technical: { score: 10 },
      fundamental: { score: 10 },
      sentiment: { score: 10 },
      bandarmology: { score: 20 },
    });
    assert.equal(result.totalQuantScore, 50);
    assert.equal(result.rating, 'HOLD');
  });

  it('resolves rating bands', () => {
    assert.equal(resolveRating(80), 'STRONG BUY');
    assert.equal(resolveRating(65), 'BUY');
    assert.equal(resolveRating(45), 'HOLD');
    assert.equal(resolveRating(30), 'SELL');
    assert.equal(resolveRating(10), 'STRONG SELL');
  });

  it('uses 20/20/20/40 weight caps', () => {
    assert.equal(WEIGHTS.technical, 20);
    assert.equal(WEIGHTS.fundamental, 20);
    assert.equal(WEIGHTS.sentiment, 20);
    assert.equal(WEIGHTS.bandarmologi, 40);
  });
});