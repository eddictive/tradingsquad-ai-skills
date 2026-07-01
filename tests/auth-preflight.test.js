const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { runAuthCheck } = require('../scripts/auth-check');
const { isPreflightValid, getStampPath } = require('../core/auth-preflight');

describe('auth-preflight session stamp', () => {
  let tmpDir;
  let origCwd;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-auth-preflight-'));
    origCwd = process.cwd();
    process.chdir(tmpDir);
    fs.mkdirSync(path.join(tmpDir, '.data', 'temp'), { recursive: true });
  });

  after(() => {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('skipIfValid returns cached when stamp is fresh', async () => {
    const tokenPath = path.join(process.cwd(), '.stockbit_token.json');
    fs.writeFileSync(tokenPath, '{"state":{"access":{"token":"test"}}}', 'utf8');

    fs.writeFileSync(getStampPath(), JSON.stringify({
      ok: true,
      checkedAt: Date.now(),
      tokenFile: tokenPath,
      tokenMtime: fs.statSync(tokenPath).mtimeMs,
    }), 'utf8');

    assert.equal(isPreflightValid(tokenPath), true);

    const cached = await runAuthCheck({ quiet: true, verifyNetwork: false, skipIfValid: true });
    assert.equal(cached.exitCode, 0);
    assert.equal(cached.code, 'AUTH_OK_CACHED');
    assert.equal(cached.skipped, true);
  });

  it('invalidates stamp when token file changes', () => {
    const tokenPath = path.join(tmpDir, '.stockbit_token.json');
    fs.writeFileSync(getStampPath(), JSON.stringify({
      ok: true,
      checkedAt: Date.now(),
      tokenFile: tokenPath,
      tokenMtime: 1,
    }), 'utf8');
    assert.equal(isPreflightValid(tokenPath), false);
  });
});