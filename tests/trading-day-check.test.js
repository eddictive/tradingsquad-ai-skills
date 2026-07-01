const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const script = path.join(__dirname, '..', 'skills', 'market-scanner', 'scripts', 'trading-day-check.js');

function run(date) {
  const args = date ? [script, date] : [script];
  return spawnSync(process.execPath, args, { encoding: 'utf8' });
}

describe('trading-day-check', () => {
  it('exits 0 on a regular weekday', () => {
    const result = run('2026-07-02');
    assert.equal(result.status, 0);
    assert.match(result.stdout, /MARKET OPEN/);
  });

  it('exits 1 on weekend', () => {
    const result = run('2026-07-05');
    assert.equal(result.status, 1);
    assert.match(result.stdout, /WEEKEND/);
  });

  it('exits 1 on IDX public holiday', () => {
    const result = run('2026-08-17');
    assert.equal(result.status, 1);
    assert.match(result.stdout, /PUBLIC HOLIDAY/);
  });
});