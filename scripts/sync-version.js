#!/usr/bin/env node
/**
 * Compare package.json version with the latest git tag (if any).
 * Exit 0 when in sync or no tags; exit 1 when mismatched.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

function getLatestGitTag() {
  try {
    const tag = execSync('git describe --tags --abbrev=0', {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return tag || null;
  } catch {
    return null;
  }
}

function normalizeVersion(v) {
  return (v || '').replace(/^v/, '');
}

if (require.main === module) {
  const tag = getLatestGitTag();
  const pkgVersion = pkg.version;
  const tagVersion = tag ? normalizeVersion(tag) : null;

  console.log(`📦 package.json: ${pkgVersion}`);
  if (!tag) {
    console.log('ℹ️  No git tags found — skipping tag comparison.');
    process.exit(0);
  }

  console.log(`🏷️  latest git tag: ${tag}`);
  if (pkgVersion !== tagVersion) {
    console.error(`❌ Version mismatch: package.json (${pkgVersion}) ≠ tag (${tagVersion})`);
    console.error('   Align with: git tag v' + pkgVersion);
    process.exit(1);
  }

  console.log('✅ package.json and git tag are in sync.');
  process.exit(0);
}

module.exports = { getLatestGitTag, normalizeVersion };