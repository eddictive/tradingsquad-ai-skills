# TradingSquad AI Skills

**TradingSquad AI Skills** is a collaborative, multi-agent framework delivering institutional-grade trading intelligence for Indonesian equities (IDX). This project is designed to be natively loaded into Agentic AI CLIs such as **Antigravity CLI**, **Claude Code CLI**, **OpenAI Codex CLI**, and **Grok xAI CLI**.

By equipping your AI agents with these skills, you enable them to perform high-level market analysis typically reserved for proprietary trading desks.

## 🚀 Features

- **Multi-Agent Collaboration**: Skills autonomously delegate tasks to each other. For example, the `institutional-analyst` seamlessly queries the `technical-analyst` for Quant Scores and Chart OHLCV.
- **Dual Language Runtimes**: Every API workflow is natively written in **Python** (via `requests`) and **JavaScript** (via native `fetch`), supporting Node.js and Bun environments with zero npm dependencies.
- **Shared Core Authentication**: A centralized `core/` module handles all Stockbit API logins, `XSRF-TOKEN` tracking, and secure `.stockbit_token.json` caching globally across all agents.
- **Institutional Analyst**: Performs Wyckoff market structure evaluation, tape reading, broker flow/bandarmology, and order book intelligence.
- **Technical Analyst**: Processes raw OHLCV intraday/daily data, creates O(N) timeframe resampled groupings (5m, 15m, 1h), and outputs Trend and Momentum Quant Scores.
- **Fundamental Analyst**: Evaluates intrinsic asset values using financial statements, macroeconomic indicators, and market sentiment.

## 📂 Project Structure

```text
tradingsquad-ai-skills/
├── README.md           
├── INSTALLATION.md     # Automated CLI installation instructions
├── USER_GUIDE.md       # Multi-agent workflow and prompting guide
├── skills.json         # Skill registry mapping for Antigravity
├── core/
│   ├── stockbit_auth.py    # Shared Auth client (Python)
│   └── stockbit-auth.js    # Shared Auth client (JS/Node)
└── skills/
    ├── fundamental-analyst/  
    ├── institutional-analyst/
    │   ├── SKILL.md
    │   └── scripts/
    │       ├── institutional-api.py 
    │       └── institutional-api.js 
    └── technical-analyst/    
        ├── SKILL.md
        └── scripts/
            ├── technical-api.py
            └── technical-api.js
```

## 📖 Documentation

To get started with configuring and using TradingSquad AI Skills, please refer to the following guides:

- **[Installation Guide](INSTALLATION.md)**: Steps to run the automated installer, set up environment variables for the Stockbit API, and configure your CLI.
- **[User Guide](USER_GUIDE.md)**: Detailed instructions on how to prompt the agent, utilize Multi-Agent cross-delegation, and authenticate the Shared Core.

## ⚙️ Core Philosophy

These skills force the LLM to output probability-based scenarios rather than certainties. Every analysis provides an **Entry Zone**, **Stop Loss**, **Risk-Reward Ratio**, and a clear **Invalidation Level**.
