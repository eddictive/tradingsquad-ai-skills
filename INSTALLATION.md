# Installation & Setup 🛠️

To use the **TradingSquad AI Skills**, you need an AI agent capable of executing complex, multi-step tasks and following technical instructions. 

This guide covers setup and integration instructions for the standard CLI-based AI agents: **Antigravity CLI**, **Claude Code CLI**, and **OpenAI Codex CLI**.

---

## 1. Prerequisites & Dependencies

The `institutional-api` and `technical-api` scripts are built to run universally across different environments. You only need to fulfill **one** of the following runtime options:

- **Option A (Python):** `Python 3.9+` and run `pip install requests`
- **Option B (JavaScript):** `Node.js 18+` or `Bun` (Zero external dependencies. It uses native `fetch` and built-in `.env` parsing).

### Environment Variables
For the API mode to fetch OHLCV, Orderbooks, and Broker flows, you must configure your Stockbit credentials. Create a `.env` file in the root directory (you can duplicate the `.env.example` file):

```env
STOCKBIT_USERNAME=your_email@domain.com
STOCKBIT_PASSWORD=your_password
```

*(Note: Auth is automatically managed by the `core/stockbit_auth` module which will intelligently save a `.stockbit_token.json` file on success).*

---

## 2. Automated Installer

We provide an interactive helper script to automate copying and linking the skills into the correct config folders for your chosen CLI agents. You can run this installer **with or without cloning** the repository.

### A. Zero-Clone Installation (Recommended) 🚀
If you do not want to clone this repository, you can execute the installer directly from your project folder:

#### Method 1: Using `bunx` or `npx`
```bash
# Install locally inside your project workspace (Bun)
bunx github:eddictive/tradingsquad-ai-skills --local

# Install locally inside your project workspace (Node)
npx -y git+https://github.com/eddictive/tradingsquad-ai-skills.git --local

# Install globally in your home user scope (Bun)
bunx github:eddictive/tradingsquad-ai-skills --global
```

### B. Standard Installation (Cloned Repo)
If you have already cloned the repository, navigate to the folder and run:
```bash
# Interactive setup menu (Bun or Node)
bun scripts/install-skills.js

# Silent setup for all CLIs locally
bun scripts/install-skills.js --local --all
```

---

## 3. Agent Integration Guides

### Antigravity CLI (Recommended) 🚀
The **Antigravity CLI** automatically indexes skills, supports semantic matches, and explicitly tracks background tasks.
- **Install:** `npm install -g @google/antigravity-cli`
- **Invoke:** `@institutional-analyst Analyze BBCA's Wyckoff phase and invoke the technical agent for the Quant score.`

### Claude Code CLI (Anthropic) 🧊
Claude Code supports modular custom commands via slash mapping.
- **Install:** `npm install -g @anthropic-ai/claude-code`
- **Invoke:** `/institutional-analyst what is the broker flow summary for BMRI?`

### OpenAI Codex CLI 🤖
The automated installer will seamlessly create the `.codex/config.toml`, write the `AGENTS.md` manifest, and automatically copy all skill directories into `.codex/skills/`.
- **Install:** Consult OpenAI Codex official documentation for the latest release.
- **Invoke:** The Codex Agent automatically parses `AGENTS.md` on startup. Mention `@institutional-analyst` or `@technical-analyst` in your prompt.

### Grok XAi CLI (Grok Build) 🧠
Grok reads project-specific configurations mapped heavily in `.grok/grok.md`.
- **Install:** `curl -fsSL https://x.ai/cli/install.sh | bash`
- **Invoke:** `grok inspect` to load skills, then ask natively in chat.
