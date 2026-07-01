/**
 * Shared CLI helpers for skill API scripts.
 */

function wantsHelp(argv) {
  return argv.includes('--help') || argv.includes('-h');
}

function printHelp(scriptName, description, commands) {
  console.log(`${scriptName}`);
  if (description) console.log(`${description}\n`);
  console.log('Usage:');
  for (const cmd of commands) {
    const aliases = cmd.aliases ? ` (aliases: ${cmd.aliases.join(', ')})` : '';
    console.log(`  ${cmd.usage}${aliases}`);
    if (cmd.detail) console.log(`    ${cmd.detail}`);
  }
  console.log('\nOptions:');
  console.log('  --help, -h    Show this help');
}

module.exports = { wantsHelp, printHelp };