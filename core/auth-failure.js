/**
 * Shared auth-failure messaging for auth-check and agent instructions.
 */

const AUTH_SETUP_STEPS = [
  'Log in to stockbit.com in your browser',
  'Open DevTools (F12) → Application → Cookies → https://stockbit.com',
  'Copy the credentialStorage value',
  'Paste it into .stockbit_token.json in your workspace root',
];

const FORBIDDEN_ON_AUTH_FAILURE = [
  'Run any *-api scripts or delegate to sub-agents',
  'Use web search, scraping, or third-party sites as Stockbit substitutes',
  'Use cached .data/temp/ files or prior session outputs',
  'Try alternate auth paths, env workarounds, or custom fetchers',
  'Produce partial, synthetic, or "best effort" analysis reports',
];

function isAuthRelatedError(message = '') {
  return /401|403|unauthorized|authentication required|token refresh|refresh token|invalid token|expired token|failed to load or refresh token/i.test(
    message
  );
}

function buildAuthFailurePayload({ code, message, tokenFile, help }) {
  return {
    ok: false,
    code,
    action: 'STOP_PIPELINE',
    message,
    tokenFile,
    help: help || 'See docs/INSTALLATION.md — refresh credentialStorage from Stockbit browser',
    userAction: AUTH_SETUP_STEPS,
    forbidden: FORBIDDEN_ON_AUTH_FAILURE,
  };
}

function printAuthFailureBanner(payload) {
  console.error('⛔ PIPELINE HALTED — STOCKBIT AUTH REQUIRED');
  console.error('');
  console.error(`Reason : ${payload.message}`);
  if (payload.tokenFile) console.error(`Token  : ${payload.tokenFile}`);
  console.error('');
  console.error('Fix (required before any analysis):');
  payload.userAction.forEach((step, i) => console.error(`  ${i + 1}. ${step}`));
  console.error(`  → Full guide: ${payload.help}`);
  console.error('');
  console.error('Agent instruction: STOP immediately. Do NOT:');
  payload.forbidden.forEach((item) => console.error(`  • ${item}`));
}

module.exports = {
  AUTH_SETUP_STEPS,
  FORBIDDEN_ON_AUTH_FAILURE,
  isAuthRelatedError,
  buildAuthFailurePayload,
  printAuthFailureBanner,
};