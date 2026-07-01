#!/usr/bin/env node
/**
 * BYOT auth preflight — run ONCE per pipeline/session (orchestrator), not per sub-skill.
 * Exit 0 = token loaded/refreshed; 1 = missing or invalid token.
 */
const fs = require('fs');
const path = require('path');
const { StockbitClient } = require('../core/stockbit-auth');
const { isPreflightValid, writePreflightStamp, PREFLIGHT_TTL_MS } = require('../core/auth-preflight');
const {
  buildAuthFailurePayload,
  printAuthFailureBanner,
  isAuthRelatedError,
} = require('../core/auth-failure');

const SETUP_HELP = 'docs/INSTALLATION.md — paste credentialStorage from Stockbit browser DevTools into .stockbit_token.json';

function emitAuthFailure(payload, { json = false, quiet = false } = {}) {
  if (!quiet) {
    if (json) console.log(JSON.stringify(payload, null, 2));
    else printAuthFailureBanner(payload);
  }
  return { ...payload, exitCode: 1 };
}

async function runAuthCheck(options = {}) {
  const { json = false, quiet = false, verifyNetwork = true, skipIfValid = false } = options;
  const tokenPath = path.join(process.cwd(), '.stockbit_token.json');

  if (!fs.existsSync(tokenPath)) {
    return emitAuthFailure(
      buildAuthFailurePayload({
        code: 'TOKEN_MISSING',
        message: 'No .stockbit_token.json in workspace.',
        tokenFile: tokenPath,
        help: SETUP_HELP,
      }),
      { json, quiet }
    );
  }

  if (skipIfValid && isPreflightValid(tokenPath)) {
    const cached = {
      ok: true,
      code: 'AUTH_OK_CACHED',
      skipped: true,
      message: 'Preflight already valid for this session (orchestrator ran auth-check).',
      tokenFile: tokenPath,
      ttlMs: PREFLIGHT_TTL_MS,
    };
    if (!quiet) {
      if (json) console.log(JSON.stringify(cached, null, 2));
      else console.log('✅ STOCKBIT AUTH OK (cached preflight — skip re-check in same pipeline)');
    }
    return { ...cached, exitCode: 0 };
  }

  const client = new StockbitClient();
  try {
    await client.login();
    const result = {
      ok: true,
      code: 'AUTH_OK',
      tokenFile: client.tokenFile,
      username: client.username || null,
      accessExpiresAt: client.accessExpiredAt || null,
    };

    if (verifyNetwork) {
      try {
        const profile = await client.getProfile();
        const p = profile?.data?.profile;
        result.username = p?.username || result.username;
        result.networkVerified = true;
      } catch (e) {
        if (isAuthRelatedError(e.message)) {
          return emitAuthFailure(
            buildAuthFailurePayload({
              code: 'TOKEN_INVALID',
              message: e.message,
              tokenFile: client.tokenFile,
              help: SETUP_HELP,
            }),
            { json, quiet }
          );
        }
        result.networkVerified = false;
        result.networkWarning = e.message;
      }
    }

    writePreflightStamp(tokenPath, { username: result.username });

    if (!quiet) {
      if (json) console.log(JSON.stringify(result, null, 2));
      else {
        console.log('✅ STOCKBIT AUTH OK');
        console.log(`   Token file : ${result.tokenFile}`);
        if (result.username) console.log(`   User       : @${result.username}`);
        if (result.networkVerified) console.log('   API check  : profile verified');
        else if (result.networkWarning) {
          console.log(`   API check  : token loaded; profile skipped (${result.networkWarning})`);
        }
        console.log('   Note       : sub-agents should NOT re-run auth-check in the same pipeline');
      }
    }

    return { ...result, exitCode: 0 };
  } catch (e) {
    return emitAuthFailure(
      buildAuthFailurePayload({
        code: 'TOKEN_INVALID',
        message: e.message,
        tokenFile: client.tokenFile,
        help: SETUP_HELP,
      }),
      { json, quiet }
    );
  }
}

function printAuthCheckHelp() {
  console.log('auth-check.js — BYOT token preflight (once per pipeline, not per sub-skill)');
  console.log('\nUsage:');
  console.log('  node scripts/auth-check.js                  # orchestrator: full check');
  console.log('  node scripts/auth-check.js --skip-if-valid  # sub-agent: use session stamp');
  console.log('  node scripts/auth-check.js --json');
  console.log('  node scripts/auth-check.js --no-network');
  console.log('\nPipeline: trading-day-check → auth-check (1×) → all *-api.js scripts');
  console.log('\nExit codes: 0 = auth OK · 1 = missing or invalid token');
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printAuthCheckHelp();
    process.exit(0);
  }

  runAuthCheck({
    json: args.includes('--json'),
    quiet: args.includes('--quiet'),
    verifyNetwork: !args.includes('--no-network'),
    skipIfValid: args.includes('--skip-if-valid'),
  }).then((r) => process.exit(r.exitCode));
}

module.exports = { runAuthCheck, printAuthCheckHelp };