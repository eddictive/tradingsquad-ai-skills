/**
 * Resolve a skill script path across cloned-repo and installed CLI layouts.
 */
const fs = require('fs');
const path = require('path');

function resolveSkillScript(skillName, scriptName) {
  const roots = [
    path.join(__dirname, '..', 'skills', skillName, 'scripts', scriptName),
    path.join(__dirname, '..', '.agents', 'skills', skillName, 'scripts', scriptName),
    path.join(__dirname, '..', '.grok', 'skills', skillName, 'scripts', scriptName),
    path.join(__dirname, '..', '.claude', 'skills', skillName, 'scripts', scriptName),
    path.join(__dirname, '..', '.codex', 'skills', skillName, 'scripts', scriptName),
    path.join(__dirname, '..', '.skills', skillName, 'scripts', scriptName),
  ];

  for (const candidate of roots) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function runSkillScript(skillName, scriptName) {
  const target = resolveSkillScript(skillName, scriptName);
  if (!target) {
    console.error(`❌ Could not find ${skillName}/scripts/${scriptName}. Run install-skills.js first.`);
    process.exit(1);
  }

  const { spawnSync } = require('child_process');
  const result = spawnSync(process.execPath, [target, ...process.argv.slice(2)], {
    stdio: 'inherit',
  });
  process.exit(result.status ?? 1);
}

module.exports = { resolveSkillScript, runSkillScript };