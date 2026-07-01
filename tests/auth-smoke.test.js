const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const tokenPath = path.join(process.cwd(), '.stockbit_token.json');
const hasToken = fs.existsSync(tokenPath);

describe('auth-smoke', { skip: !hasToken ? 'no .stockbit_token.json — skipping network auth test' : false }, () => {
  it('loads BYOT token via StockbitClient.login()', async () => {
    const { StockbitClient } = require('../core/stockbit-auth');
    const client = new StockbitClient();
    const ok = await client.login();
    assert.equal(ok, true);
    assert.ok(client.accessToken);
  });
});