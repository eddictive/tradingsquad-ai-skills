/**
 * Bounded-concurrency async pool for parallel API fetches.
 */

async function mapPool(items, concurrency, workerFn) {
  if (!items || items.length === 0) return [];

  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      try {
        results[current] = await workerFn(items[current], current);
      } catch (err) {
        results[current] = null;
      }
    }
  }

  await Promise.all(Array.from({ length: limit }, () => runWorker()));
  return results.filter((r) => r != null);
}

module.exports = { mapPool };