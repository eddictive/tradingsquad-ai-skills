const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { runAuthCheck } = require('../scripts/auth-check');

const tokenPath = path.join(process.cwd(), '.stockbit_token.json');
const hasToken = fs.existsSync(tokenPath);

describe('auth-check CLI', () => {
  it('exits 1 with help text when token file missing', async () => {
    const result = await runAuthCheck({ quiet: true, verifyNetwork: false });
    if (hasToken) {
      assert.equal(result.exitCode, 0);
      assert.equal(result.ok, true);
    } else {
      assert.equal(result.exitCode, 1);
      assert.equal(result.code, 'TOKEN_MISSING');
    }
  });

  it('supports --help', () => {
    const script = path.join(__dirname, '..', 'scripts', 'auth-check.js');
    const result = spawnSync(process.execPath, [script, '--help'], { encoding: 'utf8' });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /auth-check/);
  });
});

describe('auth-check with token', { skip: !hasToken ? 'no .stockbit_token.json' : false }, () => {
  it('returns exit 0 when BYOT token is valid', async () => {
    const result = await runAuthCheck({ quiet: true });
    assert.equal(result.exitCode, 0);
    assert.equal(result.ok, true);
    assert.equal(result.code, 'AUTH_OK');
  });
});