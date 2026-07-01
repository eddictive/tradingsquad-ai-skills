const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { calculateQuantScore } = require('../core/quant-score');
const { validateWithNamedSchema } = require('../core/schema-validate');

describe('schema-validate', () => {
  it('validates quant-score output', () => {
    const output = calculateQuantScore({
      ticker: 'BBCA',
      technical: { score: 15 },
      fundamental: { score: 14 },
      sentiment: { score: 11 },
      bandarmologi: { score: 32 },
    });
    const result = validateWithNamedSchema(output, 'quant-score-output');
    assert.equal(result.valid, true, result.errors?.join('; '));
  });

  it('validates live-draggers shape', () => {
    const sample = {
      lifters: [{
        ticker: 'BBCA',
        open: 10000,
        prevClose: 9900,
        close: 10100,
        changePercent: '2.02%',
      }],
      draggers: [],
    };
    const result = validateWithNamedSchema(sample, 'live-draggers');
    assert.equal(result.valid, true, result.errors?.join('; '));
  });

  it('rejects invalid quant-score rating', () => {
    const result = validateWithNamedSchema({
      totalQuantScore: 50,
      quantScore: 50,
      maxScore: 100,
      rating: 'MAYBE',
      weights: { technical: 20, fundamental: 20, sentiment: 20, bandarmologi: 40 },
      breakdown: {},
    }, 'quant-score-output');
    assert.equal(result.valid, false);
  });
});