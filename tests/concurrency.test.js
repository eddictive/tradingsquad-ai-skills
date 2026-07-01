const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { mapPool } = require('../core/concurrency');

describe('concurrency mapPool', () => {
  it('runs workers with bounded concurrency and filters nulls', async () => {
    const order = [];
    const results = await mapPool([1, 2, 3, 4, 5], 2, async (n) => {
      order.push(n);
      if (n === 3) return null;
      return n * 2;
    });
    assert.deepEqual(results.sort((a, b) => a - b), [2, 4, 8, 10]);
    assert.equal(order.length, 5);
  });

  it('returns empty array for empty input', async () => {
    assert.deepEqual(await mapPool([], 4, async () => 1), []);
  });
});