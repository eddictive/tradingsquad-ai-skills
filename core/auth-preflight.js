/**
 * Session auth-preflight stamp — avoids redundant auth-check in multi-agent pipelines.
 * Stamp: .data/temp/.auth-preflight.json
 */
const fs = require('fs');
const path = require('path');

const PREFLIGHT_TTL_MS = 30 * 60 * 1000;

function getStampPath(cwd = process.cwd()) {
  return path.join(cwd, '.data/temp/.auth-preflight.json');
}

function readPreflightStamp(cwd = process.cwd()) {
  const stampPath = getStampPath(cwd);
  if (!fs.existsSync(stampPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(stampPath, 'utf8'));
  } catch {
    return null;
  }
}

function writePreflightStamp(tokenPath, extra = {}) {
  const stampPath = getStampPath();
  fs.mkdirSync(path.dirname(stampPath), { recursive: true });
  const payload = {
    ok: true,
    checkedAt: Date.now(),
    tokenFile: tokenPath,
    tokenMtime: fs.statSync(tokenPath).mtimeMs,
    ...extra,
  };
  fs.writeFileSync(stampPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return payload;
}

function resolvePathSafe(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

function isPreflightValid(tokenPath, cwd = process.cwd()) {
  const stamp = readPreflightStamp(cwd);
  if (!stamp?.ok) return false;
  if (Date.now() - stamp.checkedAt > PREFLIGHT_TTL_MS) return false;
  if (!fs.existsSync(tokenPath)) return false;
  if (resolvePathSafe(stamp.tokenFile) !== resolvePathSafe(tokenPath)) return false;
  const mtime = fs.statSync(tokenPath).mtimeMs;
  if (stamp.tokenMtime !== mtime) return false;
  return true;
}

module.exports = {
  PREFLIGHT_TTL_MS,
  getStampPath,
  readPreflightStamp,
  writePreflightStamp,
  isPreflightValid,
};