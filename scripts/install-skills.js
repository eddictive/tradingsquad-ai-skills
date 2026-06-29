#!/usr/bin/env node

/**
 * TradingSquad AI Installer
 * Automatically configures and deploys the Analyst skills for:
 * 1. Antigravity CLI (.agents/skills/)
 * 2. Claude Code (.claude/skills/)
 * 3. OpenAI Codex CLI (AGENTS.md)
 * 4. Grok XAi CLI (.grok/skills/)
 * 5. Generic agent platforms (.skills/)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const https = require('https');
const { execSync } = require('child_process');

const userProjectDir = process.cwd();

// Detect if we have local source files
let skillsSrcDir = '';
let coreSrcDir = '';
let isLocalSource = false;

try {
  const localPath = path.join(__dirname, '..', 'skills');
  const localCore = path.join(__dirname, '..', 'core');
  if (fs.existsSync(localPath)) {
    skillsSrcDir = localPath;
    coreSrcDir = localCore;
    isLocalSource = true;
  }
} catch (e) {
  // __dirname might not be defined when piped into node
}

if (!isLocalSource) {
  const cwdPath = path.join(userProjectDir, 'skills');
  const cwdCore = path.join(userProjectDir, 'core');
  if (fs.existsSync(cwdPath)) {
    skillsSrcDir = cwdPath;
    coreSrcDir = cwdCore;
    isLocalSource = true;
  }
}

const analysts = [
  'institutional-analyst',
  'technical-analyst',
  'fundamental-analyst',
  'market-scanner',
  'sentiment-analyst'
];

// Target Paths
const targets = {
  antigravity: {
    local: path.join(userProjectDir, '.agents', 'skills'),
    global: path.join(os.homedir(), '.gemini', 'config', 'skills')
  },
  claude: {
    local: path.join(userProjectDir, '.claude', 'skills'),
    global: path.join(os.homedir(), '.claude', 'skills')
  },
  codex: {
    local: path.join(userProjectDir, '.codex', 'skills'),
    global: null
  },
  grok: {
    local: path.join(userProjectDir, '.grok', 'skills'),
    global: path.join(os.homedir(), '.grok', 'skills')
  },
  other: {
    local: path.join(userProjectDir, '.skills'),
    global: path.join(os.homedir(), '.tradingsquad-ai')
  }
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyFolderSync(from, to) {
  ensureDir(to);
  const files = fs.readdirSync(from);
  for (const file of files) {
    if (file.endsWith('.skill')) continue;

    const fromPath = path.join(from, file);
    const toPath = path.join(to, file);
    
    if (fs.lstatSync(fromPath).isDirectory()) {
      copyFolderSync(fromPath, toPath);
    } else {
      fs.copyFileSync(fromPath, toPath);
    }
  }
}

function installAgentsMd(destDir) {
  const rootAgentsMd = path.join(__dirname, '..', 'AGENTS.md');
  const targetAgentsMd = path.join(destDir, 'AGENTS.md');
  
  // Also check userProjectDir if not running from local clone
  const fallbackAgentsMd = path.join(userProjectDir, 'AGENTS.md');
  
  let sourceMd = null;
  if (fs.existsSync(rootAgentsMd)) sourceMd = rootAgentsMd;
  else if (fs.existsSync(fallbackAgentsMd)) sourceMd = fallbackAgentsMd;

  if (sourceMd) {
    // Prevent copying to itself
    if (path.resolve(sourceMd) !== path.resolve(targetAgentsMd)) {
      ensureDir(destDir);
      fs.copyFileSync(sourceMd, targetAgentsMd);
      console.log(`   ✅ Copied master AGENTS.md rules`);
    }
  }
}

function installSkillsJson(destDir) {
  const rootSkillsJson = path.join(__dirname, '..', 'skills.json');
  const targetSkillsJson = path.join(destDir, 'skills.json');
  
  const fallbackSkillsJson = path.join(userProjectDir, 'skills.json');
  
  let sourceJson = null;
  if (fs.existsSync(rootSkillsJson)) sourceJson = rootSkillsJson;
  else if (fs.existsSync(fallbackSkillsJson)) sourceJson = fallbackSkillsJson;

  if (sourceJson) {
    if (path.resolve(sourceJson) !== path.resolve(targetSkillsJson)) {
      ensureDir(destDir);
      fs.copyFileSync(sourceJson, targetSkillsJson);
      console.log(`   ✅ Copied skills.json config`);
    }
  }
}

function downloadAndExtractTarball(url, destDir) {
  return new Promise((resolve, reject) => {
    const tarballPath = path.join(os.tmpdir(), 'tradingsquad-ai-skills-master.tar.gz');
    const file = fs.createWriteStream(tarballPath);
    console.log(`📡 Downloading skill assets from ${url}...`);
    
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        downloadAndExtractTarball(response.headers.location, destDir).then(resolve).catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: Status Code ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          console.log(`📦 Extracting archive...`);
          try {
            ensureDir(destDir);
            execSync(`tar -xzf "${tarballPath}" -C "${destDir}"`);
            fs.unlinkSync(tarballPath);
            resolve();
          } catch (err) {
            reject(err);
          }
        });
      });
    }).on('error', (err) => {
      if (fs.existsSync(tarballPath)) {
        try { fs.unlinkSync(tarballPath); } catch (e) {}
      }
      reject(err);
    });
  });
}

async function ensureSkillsSrc() {
  if (isLocalSource) {
    return skillsSrcDir;
  }

  console.log(`ℹ️  Local skills source not found. Fetching from GitHub...`);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tradingsquad-skills-'));
  const tarballUrl = 'https://github.com/eddictive/tradingsquad-ai-skills/archive/refs/heads/master.tar.gz';
  
  await downloadAndExtractTarball(tarballUrl, tempDir);
  
  const files = fs.readdirSync(tempDir);
  const repoDirName = files.find(f => f.startsWith('tradingsquad-ai-skills-'));
  if (!repoDirName) {
    throw new Error('Could not find extracted repository folder in temporary directory.');
  }
  
  skillsSrcDir = path.join(tempDir, repoDirName, 'skills');
  coreSrcDir = path.join(tempDir, repoDirName, 'core');
  
  process.on('exit', () => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {}
  });
  
  return skillsSrcDir;
}

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function installSkillsFor(clis, isGlobal) {
  const scopeStr = isGlobal ? 'GLOBAL' : 'LOCAL';
  console.log(`\n🚀 Installing TradingSquad AI in ${scopeStr} mode...\n`);

  const srcDir = await ensureSkillsSrc();

  if (clis.includes('antigravity')) {
    const agDest = isGlobal ? targets.antigravity.global : targets.antigravity.local;
    console.log(`🤖 Deploying for Antigravity CLI -> ${agDest}`);
    ensureDir(agDest);
    if (!isGlobal) {
      ensureDir(path.join(userProjectDir, '.agents', 'state'));
      console.log(`   📂 Pre-created local state directory: .agents/state/`);
    }
    for (const arch of analysts) {
      const src = path.join(srcDir, arch);
      const dest = path.join(agDest, arch);
      if (fs.existsSync(src)) {
        copyFolderSync(src, dest);
        console.log(`   ✅ Loaded ${arch}`);
      }
    }
    
    // Copy Core Module
    if (coreSrcDir && fs.existsSync(coreSrcDir)) {
      const coreDest = isGlobal ? path.join(os.homedir(), '.gemini', 'config', 'core') : path.join(userProjectDir, '.agents', 'core');
      ensureDir(coreDest);
      copyFolderSync(coreSrcDir, coreDest);
      console.log(`   ✅ Loaded core module`);
    }
    
    // Copy Master Rules & Config
    const configDest = isGlobal ? path.join(os.homedir(), '.gemini', 'config') : path.join(userProjectDir, '.agents');
    installAgentsMd(configDest);
    installSkillsJson(configDest);
  }

  if (clis.includes('claude')) {
    const claudeDest = isGlobal ? targets.claude.global : targets.claude.local;
    console.log(`🧊 Deploying for Claude Code -> ${claudeDest}`);
    ensureDir(claudeDest);
    if (!isGlobal) {
      ensureDir(path.join(userProjectDir, '.claude', 'state'));
      console.log(`   📂 Pre-created local state directory: .claude/state/`);
    }
    for (const arch of analysts) {
      const src = path.join(srcDir, arch);
      const dest = path.join(claudeDest, arch);
      if (fs.existsSync(src)) {
        copyFolderSync(src, dest);
        console.log(`   ✅ Loaded /${arch}`);
      }
    }

    // Copy Core Module
    if (coreSrcDir && fs.existsSync(coreSrcDir)) {
      const coreDest = isGlobal ? path.join(os.homedir(), '.claude', 'core') : path.join(userProjectDir, '.claude', 'core');
      ensureDir(coreDest);
      copyFolderSync(coreSrcDir, coreDest);
      console.log(`   ✅ Loaded core module`);
    }

    // Copy Master Rules
    installAgentsMd(isGlobal ? path.join(os.homedir(), '.claude') : path.join(userProjectDir, '.claude'));
  }

  if (clis.includes('codex')) {
    if (isGlobal) {
      console.log(`⚠️  Codex CLI only supports workspace-level configuration. Skipping global setup for Codex.`);
    } else {
      console.log(`💻 Configuring for OpenAI Codex CLI...`);
      const codexConfigDir = path.join(userProjectDir, '.codex');
      const codexDest = targets.codex.local;
      ensureDir(codexConfigDir);
      ensureDir(codexDest);
      ensureDir(path.join(userProjectDir, '.codex', 'state'));
      console.log(`   📂 Pre-created local state directory: .codex/state/`);

      for (const arch of analysts) {
        const src = path.join(srcDir, arch);
        const dest = path.join(codexDest, arch);
        if (fs.existsSync(src)) {
          copyFolderSync(src, dest);
          console.log(`   ✅ Loaded ${arch}`);
        }
      }

      // Copy Core Module
      if (coreSrcDir && fs.existsSync(coreSrcDir)) {
        const coreDest = path.join(userProjectDir, '.codex', 'core');
        ensureDir(coreDest);
        copyFolderSync(coreSrcDir, coreDest);
        console.log(`   ✅ Loaded core module`);
      }

      const configPath = path.join(codexConfigDir, 'config.toml');
      if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, `# OpenAI Codex Config\n[agent]\nname = "Codex Suite"\n`, 'utf8');
        console.log(`   ✅ Created .codex/config.toml`);
      }

      const agentsMdPath = path.join(userProjectDir, 'AGENTS.md');
      const agentsContent = `\n\n# Project Agents & Guidelines (Codex CLI) 🤖

This file registers the active AI Analyst guidelines for the OpenAI Codex CLI.

## Active Analysts

*   **Institutional Analyst:** Focuses on quantitative analysis, Wyckoff market structure, tape reading, order flow, and broker summary. Guided by [SKILL.md](file://./skills/institutional-analyst/SKILL.md).
*   **Technical Analyst:** Focuses on charts and indicators. Guided by [SKILL.md](file://./skills/technical-analyst/SKILL.md).
*   **Fundamental Analyst:** Focuses on intrinsic asset values. Guided by [SKILL.md](file://./skills/fundamental-analyst/SKILL.md).

## Operational Standards
All analysis must respect the specifications detailed under the respective \`SKILL.md\` and \`scripts/\` directories.
`;
      if (fs.existsSync(agentsMdPath)) {
        const existing = fs.readFileSync(agentsMdPath, 'utf8');
        if (!existing.includes('Project Agents & Guidelines (Codex CLI)')) {
          fs.appendFileSync(agentsMdPath, agentsContent, 'utf8');
          console.log(`   ✅ Appended Codex rules to root AGENTS.md`);
        }
      } else {
        fs.writeFileSync(agentsMdPath, agentsContent.trim(), 'utf8');
        console.log(`   ✅ Created root AGENTS.md for Codex`);
      }
    }
  }

  if (clis.includes('grok')) {
    const grokDest = isGlobal ? targets.grok.global : targets.grok.local;
    console.log(`🧠 Deploying for Grok XAi CLI -> ${grokDest}`);
    ensureDir(grokDest);
    for (const arch of analysts) {
      const src = path.join(srcDir, arch);
      const dest = path.join(grokDest, arch);
      if (fs.existsSync(src)) {
        copyFolderSync(src, dest);
        console.log(`   ✅ Loaded ${arch}`);
      }
    }

    // Copy Core Module
    if (coreSrcDir && fs.existsSync(coreSrcDir)) {
      const coreDest = isGlobal ? path.join(os.homedir(), '.grok', 'core') : path.join(userProjectDir, '.grok', 'core');
      ensureDir(coreDest);
      copyFolderSync(coreSrcDir, coreDest);
      console.log(`   ✅ Loaded core module`);
    }
    
    // Copy Master Rules
    installAgentsMd(isGlobal ? path.join(os.homedir(), '.grok') : path.join(userProjectDir, '.grok'));

    if (!isGlobal) {
      console.log(`🧠 Configuring for Grok XAi CLI...`);
      const grokConfigDir = path.join(userProjectDir, '.grok');
      ensureDir(grokConfigDir);
      ensureDir(path.join(userProjectDir, '.grok', 'state'));
      console.log(`   📂 Pre-created local state directory: .grok/state/`);

      const grokMdPath = path.join(grokConfigDir, 'grok.md');
      const grokContent = `# Grok Analyst Instructions 🧠

This file defines the project instructions for the Grok XAi CLI.

## Available Specialized Skills

*   **Institutional Analyst:** Focuses on Wyckoff, tape reading, order flow. Setup in [skills/institutional-analyst/SKILL.md](file://./skills/institutional-analyst/SKILL.md).
*   **Technical Analyst:** Focuses on indicators, chart patterns. Setup in [skills/technical-analyst/SKILL.md](file://./skills/technical-analyst/SKILL.md).
*   **Fundamental Analyst:** Focuses on value and financials. Setup in [skills/fundamental-analyst/SKILL.md](file://./skills/fundamental-analyst/SKILL.md).

## Usage Standard
When asked to act as one of these analysts, read and apply the standards, rules, and scripts specified in the corresponding folder.
`;
      fs.writeFileSync(grokMdPath, grokContent, 'utf8');
      console.log(`   ✅ Created .grok/grok.md`);
    }
  }

  if (clis.includes('other')) {
    const genericDest = isGlobal ? targets.other.global : targets.other.local;
    console.log(`🤖 Deploying for Generic Agent Environment -> ${genericDest}`);
    ensureDir(genericDest);
    for (const arch of analysts) {
      const src = path.join(srcDir, arch);
      const dest = path.join(genericDest, arch);
      if (fs.existsSync(src)) {
        copyFolderSync(src, dest);
        console.log(`   ✅ Loaded ${arch}`);
      }
    }

    // Copy Core Module
    if (coreSrcDir && fs.existsSync(coreSrcDir)) {
      const coreDest = isGlobal ? path.join(os.homedir(), '.tradingsquad-ai', 'core') : path.join(userProjectDir, '.skills', '..', 'core'); // Places it next to .skills in generic
      ensureDir(coreDest);
      copyFolderSync(coreSrcDir, coreDest);
      console.log(`   ✅ Loaded core module`);
    }
  }

  console.log(`\n🎉 Installation complete!`);
}

async function runInteractive() {
  console.log(`==========================================`);
  console.log(`🏛️  TradingSquad AI Installer`);
  console.log(`==========================================\n`);

  console.log(`Select the Agent CLI(s) you wish to install skills for:`);
  console.log(`  [1] Antigravity CLI`);
  console.log(`  [2] Claude Code CLI`);
  console.log(`  [3] OpenAI Codex CLI`);
  console.log(`  [4] Grok Build CLI`);
  console.log(`  [5] Other (Generic .skills/ folder)`);
  console.log(`  [6] All of the above`);
  console.log(`  [7] Exit`);
  
  const choice = await askQuestion(`\nEnter choice (e.g. 1, 2, or 6): `);
  if (choice === '7' || !choice) {
    console.log('❌ Installation cancelled.');
    process.exit(0);
  }

  let selectedCLIs = [];
  if (choice === '6') {
    selectedCLIs = ['antigravity', 'claude', 'codex', 'grok', 'other'];
  } else {
    const choices = choice.split(',').map(c => c.trim());
    for (const c of choices) {
      if (c === '1') selectedCLIs.push('antigravity');
      else if (c === '2') selectedCLIs.push('claude');
      else if (c === '3') selectedCLIs.push('codex');
      else if (c === '4') selectedCLIs.push('grok');
      else if (c === '5') selectedCLIs.push('other');
    }
  }

  if (selectedCLIs.length === 0) {
    console.log('❌ Invalid selection. Exiting.');
    process.exit(1);
  }

  console.log(`\nSelect Scope:`);
  console.log(`  [1] Local Workspace scope (Recommended)`);
  console.log(`  [2] Global User scope`);
  const scopeChoice = await askQuestion(`\nEnter choice (1-2): `);
  const isGlobal = scopeChoice === '2';

  await installSkillsFor(selectedCLIs, isGlobal);
}

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`🏛️  TradingSquad AI Installer`);
  console.log(`Usage: node install-skills.js [options]`);
  console.log(`\nOptions:`);
  console.log(`  --local          Install locally in workspace (default)`);
  console.log(`  --global         Install globally in home directory`);
  console.log(`  --antigravity    Only install for Antigravity CLI`);
  console.log(`  --claude         Only install for Claude Code CLI`);
  console.log(`  --codex          Only install for OpenAI Codex CLI`);
  console.log(`  --grok           Only install for Grok Build CLI`);
  console.log(`  --other          Only install generic .skills/ folder`);
  console.log(`  --all            Install for all CLIs (default)`);
  process.exit(0);
}

(async () => {
  if (args.length > 0) {
    const isGlobal = args.includes('--global');
    let selectedCLIs = [];
    if (args.includes('--antigravity')) selectedCLIs.push('antigravity');
    if (args.includes('--claude')) selectedCLIs.push('claude');
    if (args.includes('--codex')) selectedCLIs.push('codex');
    if (args.includes('--grok')) selectedCLIs.push('grok');
    if (args.includes('--other')) selectedCLIs.push('other');
    
    if (selectedCLIs.length === 0 || args.includes('--all')) {
      selectedCLIs = ['antigravity', 'claude', 'codex', 'grok', 'other'];
    }
    
    await installSkillsFor(selectedCLIs, isGlobal);
  } else {
    await runInteractive();
  }
})().catch(err => {
  console.error('❌ Installation failed:', err);
  process.exit(1);
});
