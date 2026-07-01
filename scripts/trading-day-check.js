#!/usr/bin/env node
/**
 * Workspace shim → skills/market-scanner/scripts/trading-day-check.js
 * Works in cloned repo and post-install layouts (.agents, .grok, .claude, .codex).
 */
const { resolveSkillScript } = require('./_resolve-skill-script');

const target = resolveSkillScript('market-scanner', 'trading-day-check.js');
if (!target) {
  console.error('❌ Could not find trading-day-check.js. Run install-skills.js first.');
  process.exit(1);
}

require(target);