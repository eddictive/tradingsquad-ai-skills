# Installation & Setup 🛠️

To use the **TradingSquad AI Skills**, you need an AI agent capable of executing complex, multi-step tasks and following technical instructions. 

This guide covers setup and integration instructions for the standard CLI-based AI agents: **Antigravity CLI**, **Claude Code CLI**, and **OpenAI Codex CLI**.

---

## 1. Prerequisites & Dependencies

The `institutional-api` and `technical-api` scripts are built to run universally across different environments. You only need to fulfill **one** of the following runtime options:

- **Option A (Python):** `Python 3.9+` and run `pip install requests`
- **Option B (JavaScript):** `Node.js 18+` or `Bun` (Zero external dependencies. It uses native `fetch` and built-in `.env` parsing).

### Environment Variables & Authentication
Stockbit heavily protects its login endpoints. To bypass CAPTCHAs and bot protection, this framework uses a **"Bring Your Own Token" (BYOT)** architecture.

1. Log into your Stockbit account on your web browser (e.g., `stockbit.com/stream`).
2. Open Developer Tools (F12) -> Go to the **Application** tab.
3. On the left sidebar, expand **Cookies** and click on `https://stockbit.com`.
4. In the table, look for the row where the Name is **`credentialStorage`**.
5. Copy the entire raw text from the **Value** column (it usually starts with `%22state%22...` or `{"state"...`).
6. Create a `.stockbit_token.json` file in the root of your project directory and paste the exact copied string as-is:

```json
{"state":{"access":{"token":"eyJhbGci...
```

*(Note: Do not worry if the copied text is URL-encoded. The internal API Client will automatically intercept it on the first run, extract both the `access_token` and `refresh_token`, and cleanly format the file to support Auto-Rotation!)*

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
*Note: The installer automatically appends the Codex-specific instructions to the Master `AGENTS.md` rules without overwriting the core trading context.*
- **Install:** Consult OpenAI Codex official documentation for the latest release.
- **Invoke:** The Codex Agent automatically parses `AGENTS.md` at the project root. Mention `@institutional-analyst` or `@technical-analyst` in your prompt.

### Grok XAi CLI (Grok Build) 🧠
Grok reads project-specific configurations mapped heavily in `.grok/grok.md` and `.grok/AGENTS.md`.
- **Install:** `curl -fsSL https://x.ai/cli/install.sh | bash`
- **Invoke:** `grok inspect` to load skills, then ask natively in chat.


---

&copy; Copyright (c) 2026 - MasEDI.Net
