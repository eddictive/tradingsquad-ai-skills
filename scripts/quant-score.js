#!/usr/bin/env node
/**
 * Workspace shim → core/quant-score.js
 */
const path = require('path');
const { spawnSync } = require('child_process');

const target = path.join(__dirname, '../core/quant-score.js');
const result = spawnSync(process.execPath, [target, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(result.status ?? 1);