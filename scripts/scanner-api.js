#!/usr/bin/env node
/**
 * Workspace shim → skills/market-scanner/scripts/scanner-api.js
 */
const { runSkillScript } = require('./_resolve-skill-script');
runSkillScript('market-scanner', 'scanner-api.js');