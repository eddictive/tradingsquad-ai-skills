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
const { execSync, spawnSync } = require('child_process');

const userProjectDir = process.cwd();
const PKG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const REPO_BASE = 'https://github.com/eddictive/tradingsquad-ai-skills/archive/refs';

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

const DEFAULT_ANALYSTS = [
  'institutional-analyst',
  'technical-analyst',
  'fundamental-analyst',
  'market-scanner',
  'sentiment-analyst',
];

function loadSkillIds() {
  const candidates = [
    path.join(__dirname, '..', 'skills.json'),
    path.join(userProjectDir, 'skills.json'),
  ];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      const ids = (data.entries || [])
        .map((e) => e.id || path.basename((e.path || '').replace(/\\/g, '/')))
        .filter(Boolean);
      if (ids.length > 0) return ids;
    } catch (e) {
      console.warn(`⚠️  Could not parse ${p}: ${e.message}`);
    }
  }
  return DEFAULT_ANALYSTS;
}

function resolveTarballUrl(tag) {
  if (!tag || tag === 'master' || tag === 'main') {
    return `${REPO_BASE}/heads/master.tar.gz`;
  }
  const normalized = tag.startsWith('v') ? tag : `v${tag}`;
  return `${REPO_BASE}/tags/${normalized}.tar.gz`;
}

function getTagFromArgs(args) {
  const tagIdx = args.indexOf('--tag');
  if (tagIdx !== -1 && args[tagIdx + 1]) return args[tagIdx + 1];
  return PKG.version;
}

function writeVersionStamp(tag) {
  const stampPath = path.join(userProjectDir, '.tradingsquad-version');
  const payload = {
    version: PKG.version,
    tag: tag || PKG.version,
    installedAt: new Date().toISOString(),
    package: PKG.name,
  };
  fs.writeFileSync(stampPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`   ✅ Wrote version stamp → .tradingsquad-version (${payload.version})`);
}

function fetchUrlJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        fetchUrlJson(response.headers.location).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode} fetching ${url}`));
        return;
      }
      let body = '';
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function fetchRemotePackageVersion(tag) {
  const ref = (!tag || tag === 'master' || tag === 'main') ? 'master' : (tag.startsWith('v') ? tag : `v${tag}`);
  const url = `https://raw.githubusercontent.com/eddictive/tradingsquad-ai-skills/${ref}/package.json`;
  return fetchUrlJson(url).then((pkg) => pkg.version);
}

async function checkForUpdates(tag) {
  const stampPath = path.join(userProjectDir, '.tradingsquad-version');
  const localVersion = fs.existsSync(stampPath)
    ? JSON.parse(fs.readFileSync(stampPath, 'utf8')).version
    : null;

  console.log(`📦 Installed: ${localVersion || 'unknown'} · Package: ${PKG.version}`);
  try {
    const remoteVersion = await fetchRemotePackageVersion(tag);
    console.log(`🌐 Remote (${tag || 'master'}): ${remoteVersion}`);
    if (localVersion && localVersion !== remoteVersion) {
      console.log(`⬆️  Update available: ${localVersion} → ${remoteVersion}`);
      console.log(`   Run: npx tradingsquad-ai-skills --tag ${remoteVersion}`);
      return { updateAvailable: true, localVersion, remoteVersion };
    }
    if (localVersion === remoteVersion) {
      console.log(`✅ You are on the latest version (${remoteVersion}).`);
    }
    return { updateAvailable: false, localVersion, remoteVersion };
  } catch (e) {
    console.warn(`⚠️  Could not check remote version: ${e.message}`);
    return { updateAvailable: false, error: e.message };
  }
}

async function runVerify() {
  console.log(`\n🔍 Running post-install verification...\n`);
  let ok = true;

  const tradingDayScript = path.join(userProjectDir, 'scripts', 'trading-day-check.js');
  const tradingDayFallback = path.join(__dirname, 'trading-day-check.js');
  const tdScript = fs.existsSync(tradingDayScript) ? tradingDayScript : tradingDayFallback;

  const openDay = spawnSync(process.execPath, [tdScript, '2026-07-02'], { encoding: 'utf8' });
  if (openDay.status === 0) {
    console.log(`   ✅ trading-day-check: weekday open day (2026-07-02)`);
  } else {
    console.log(`   ❌ trading-day-check: expected open day exit 0, got ${openDay.status}`);
    ok = false;
  }

  const holiday = spawnSync(process.execPath, [tdScript, '2026-08-17'], { encoding: 'utf8' });
  if (holiday.status === 1) {
    console.log(`   ✅ trading-day-check: holiday closed (2026-08-17)`);
  } else {
    console.log(`   ❌ trading-day-check: expected holiday exit 1, got ${holiday.status}`);
    ok = false;
  }

  const tokenPath = path.join(userProjectDir, '.stockbit_token.json');
  if (!fs.existsSync(tokenPath)) {
    console.log(`   ⚠️  auth-smoke: skipped (no .stockbit_token.json in workspace)`);
  } else {
    try {
      const { StockbitClient } = require(path.join(__dirname, '..', 'core', 'stockbit-auth.js'));
      const client = new StockbitClient();
      await client.login();
      console.log(`   ✅ auth-smoke: BYOT token loaded successfully`);
    } catch (e) {
      console.log(`   ❌ auth-smoke: ${e.message}`);
      ok = false;
    }
  }

  if (ok) {
    console.log(`\n✅ Verification passed.`);
  } else {
    console.log(`\n❌ Verification failed — see messages above.`);
    process.exit(1);
  }
}

function buildCodexAgentsAppendix() {
  const skills = loadSkillIds();
  const lines = skills.map((id) => {
    const label = id.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return `*   **${label}:** Guided by [SKILL.md](.codex/skills/${id}/SKILL.md).`;
  });
  return `

# Project Agents & Guidelines (Codex CLI) 🤖

This file registers the active AI Analyst guidelines for the OpenAI Codex CLI.

## Active Analysts

${lines.join('\n')}

## Operational Standards
All analysis must respect the specifications detailed under \`.codex/skills/\` and workspace \`scripts/\`.
`;
}

function buildGrokMdContent() {
  const skills = loadSkillIds();
  const lines = skills.map((id) => {
    const label = id.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return `*   **${label}:** Setup in [.grok/skills/${id}/SKILL.md](.grok/skills/${id}/SKILL.md).`;
  });
  return `# Grok Analyst Instructions 🧠

This file defines the project instructions for the Grok XAi CLI.

## 📜 Master Rules (CRITICAL)
Before executing any analysis, you MUST strictly adhere to the project-wide Master Rules defined in:
*   [Master Rules](AGENTS.md)

## Available Specialized Skills

${lines.join('\n')}

## Usage Standard
When asked to act as one of these analysts, read and apply the standards, rules, and scripts specified in the corresponding folder.
`;
}

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

const WORKSPACE_SHIMS = [
  '_resolve-skill-script.js',
  '_resolve_skill_script.py',
  'trading-day-check.js',
  'trading-day-check.py',
  'scanner-api.js',
  'scanner-api.py',
  'quant-score.js',
  'quant-score.py',
];

const WORKSPACE_AGENT_DOCS = ['ORCHESTRATION.md'];

function deployWorkspaceShims() {
  const destScriptsDir = path.join(userProjectDir, 'scripts');
  ensureDir(destScriptsDir);

  for (const shim of WORKSPACE_SHIMS) {
    const src = path.join(__dirname, shim);
    const dest = path.join(destScriptsDir, shim);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      try { fs.chmodSync(dest, 0o755); } catch (e) {}
    }
  }
  console.log(`   ✅ Deployed workspace script shims to scripts/`);
}

function deployWorkspaceAgentDocs() {
  for (const doc of WORKSPACE_AGENT_DOCS) {
    const src = path.join(__dirname, '..', doc);
    const dest = path.join(userProjectDir, doc);
    if (fs.existsSync(src) && path.resolve(src) !== path.resolve(dest)) {
      fs.copyFileSync(src, dest);
    }
  }
  console.log(`   ✅ Deployed agent docs (${WORKSPACE_AGENT_DOCS.join(', ')}) to workspace root`);
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

async function ensureSkillsSrc(tag) {
  if (isLocalSource) {
    return skillsSrcDir;
  }

  const tarballUrl = resolveTarballUrl(tag);
  console.log(`ℹ️  Local skills source not found. Fetching from GitHub (${tag || 'master'})...`);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tradingsquad-skills-'));

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

function warnIfTokenPresent() {
  const tokenPath = path.join(userProjectDir, '.stockbit_token.json');
  if (!fs.existsSync(tokenPath)) return;
  console.log(`🔐 BYOT token detected at .stockbit_token.json`);
  console.log(`   The installer will NOT overwrite your credentials.`);
  console.log(`   Never commit this file — it is listed in .gitignore and excluded from npm publish.\n`);
}

async function installSkillsFor(clis, isGlobal, options = {}) {
  const { tag = PKG.version, verify = false } = options;
  const scopeStr = isGlobal ? 'GLOBAL' : 'LOCAL';
  console.log(`\n🚀 Installing TradingSquad AI in ${scopeStr} mode...\n`);

  if (!isGlobal) warnIfTokenPresent();

  const analysts = loadSkillIds();
  const srcDir = await ensureSkillsSrc(tag);

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

    // Copy Master Rules & Config
    const claudeConfigDest = isGlobal ? path.join(os.homedir(), '.claude') : path.join(userProjectDir, '.claude');
    installAgentsMd(claudeConfigDest);
    installSkillsJson(claudeConfigDest);
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

      installAgentsMd(codexConfigDir);
      installSkillsJson(codexConfigDir);

      const agentsMdPath = path.join(userProjectDir, 'AGENTS.md');
      const agentsContent = buildCodexAgentsAppendix();
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
    
    const grokConfigDest = isGlobal ? path.join(os.homedir(), '.grok') : path.join(userProjectDir, '.grok');
    installAgentsMd(grokConfigDest);
    installSkillsJson(grokConfigDest);

    if (!isGlobal) {
      console.log(`🧠 Configuring for Grok XAi CLI...`);
      const grokConfigDir = path.join(userProjectDir, '.grok');
      ensureDir(grokConfigDir);
      ensureDir(path.join(userProjectDir, '.grok', 'state'));
      console.log(`   📂 Pre-created local state directory: .grok/state/`);

      const grokMdPath = path.join(grokConfigDir, 'grok.md');
      fs.writeFileSync(grokMdPath, buildGrokMdContent(), 'utf8');
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

    installAgentsMd(isGlobal ? path.join(os.homedir(), '.tradingsquad-ai') : userProjectDir);
    installSkillsJson(isGlobal ? path.join(os.homedir(), '.tradingsquad-ai') : userProjectDir);
  }

  if (!isGlobal) {
    deployWorkspaceShims();
    deployWorkspaceAgentDocs();
    writeVersionStamp(tag);
  }

  console.log(`\n🎉 Installation complete!`);

  if (verify) {
    await runVerify();
  }
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

  await installSkillsFor(selectedCLIs, isGlobal, { tag: PKG.version });
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
  console.log(`  --tag <version>  Git tag or version for remote tarball (default: package.json version)`);
  console.log(`  --verify         Run auth smoke + trading-day-check after install`);
  console.log(`  --check-updates  Compare installed version with remote (no install)`);
  process.exit(0);
}

(async () => {
  const tag = getTagFromArgs(args);

  if (args.includes('--check-updates')) {
    await checkForUpdates(tag);
    process.exit(0);
  }

  if (args.includes('--verify') && !args.some((a) => ['--local', '--global', '--all', '--antigravity', '--claude', '--codex', '--grok', '--other'].includes(a))) {
    await runVerify();
    process.exit(0);
  }

  if (args.length > 0) {
    const isGlobal = args.includes('--global');
    const verify = args.includes('--verify');
    let selectedCLIs = [];
    if (args.includes('--antigravity')) selectedCLIs.push('antigravity');
    if (args.includes('--claude')) selectedCLIs.push('claude');
    if (args.includes('--codex')) selectedCLIs.push('codex');
    if (args.includes('--grok')) selectedCLIs.push('grok');
    if (args.includes('--other')) selectedCLIs.push('other');

    if (selectedCLIs.length === 0 || args.includes('--all')) {
      selectedCLIs = ['antigravity', 'claude', 'codex', 'grok', 'other'];
    }

    await installSkillsFor(selectedCLIs, isGlobal, { tag, verify });
  } else {
    await runInteractive();
  }
})().catch(err => {
  console.error('❌ Installation failed:', err);
  process.exit(1);
});
