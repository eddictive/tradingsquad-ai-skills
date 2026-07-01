const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
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

describe('auth-check expired token', () => {
  it('exits 1 with STOP_PIPELINE banner for expired refresh token', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-auth-'));
    const expiredToken = {
      state: {
        access: { token: 'expired-access', expired_at: '2020-01-01T00:00:00.000Z' },
        refresh: { token: 'expired-refresh', expired_at: '2020-01-01T00:00:00.000Z' },
      },
      version: 0,
    };
    fs.writeFileSync(path.join(tmpDir, '.stockbit_token.json'), JSON.stringify(expiredToken));

    const script = path.join(__dirname, '..', 'scripts', 'auth-check.js');
    const result = spawnSync(process.execPath, [script], { cwd: tmpDir, encoding: 'utf8' });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /PIPELINE HALTED/);
    assert.match(result.stderr, /STOP immediately/);
    assert.match(result.stderr, /web search/i);
    assert.match(result.stderr, /INSTALLATION\.md/);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns STOP_PIPELINE action in JSON output', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-auth-json-'));
    const expiredToken = {
      state: {
        access: { token: 'expired-access', expired_at: '2020-01-01T00:00:00.000Z' },
        refresh: { token: 'expired-refresh', expired_at: '2020-01-01T00:00:00.000Z' },
      },
      version: 0,
    };
    fs.writeFileSync(path.join(tmpDir, '.stockbit_token.json'), JSON.stringify(expiredToken));

    const script = path.join(__dirname, '..', 'scripts', 'auth-check.js');
    const result = spawnSync(process.execPath, [script, '--json'], { cwd: tmpDir, encoding: 'utf8' });

    assert.equal(result.status, 1);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.action, 'STOP_PIPELINE');
    assert.equal(payload.ok, false);
    assert.ok(Array.isArray(payload.forbidden));

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});