# TradingSquad AI Skills

**TradingSquad AI Skills** is a collaborative, multi-agent framework delivering institutional-grade trading intelligence for Indonesian equities (IDX). This project is designed to be natively loaded into Agentic AI CLIs such as **Antigravity CLI**, **Claude Code CLI**, **OpenAI Codex CLI**, and **Grok xAI CLI**.

By equipping your AI agents with these skills, you enable them to perform high-level market analysis typically reserved for proprietary trading desks.

## 🚀 Features

- **Multi-Agent Collaboration**: Skills autonomously delegate tasks to each other. For example, the `institutional-analyst` seamlessly queries the `technical-analyst` and `fundamental-analyst` to build a unified **Quant Score 2.0**.
- **Dual Language Runtimes**: Every API workflow is natively written in **Python** (via `requests`) and **JavaScript** (via native `fetch`), supporting Node.js and Bun environments with zero npm dependencies.
- **Shared Core Authentication**: A centralized `core/` module handles all Stockbit API logins, `XSRF-TOKEN` tracking, and secure `.stockbit_token.json` caching globally across all agents.
- **Institutional Analyst**: Performs Wyckoff market structure evaluation, tape reading, order book intelligence, and **Multi-Timeframe Bandarmology** (comparing Intraday vs 1-Month broker flow to detect cornering and shakeouts). Employs the **Rule of 5** to filter retail noise and maintain optimal LLM signal-to-noise ratios.
- **Hybrid Confluence Engine**: The `institutional-analyst` acts as the Master Orchestrator, automatically requesting **Smart Money Concepts (SMC)** data from the technical side (Unmitigated FVGs, BoS/CHoCH structure) and aligning it with Top Broker Accumulation to identify high-probability **Sniper Entries**.
- **Market Scanner**: Scans the market for accumulation/rebound patterns and tracks **Top Foreign Flow**. Features the powerful **Live Intraday Draggers** (`livedraggers`) engine which bypasses End-of-Day API delays by tracking real-time price shifts of 16 specific Free-Float Big Caps (Lifters & Draggers).
- **Technical Analyst**: Processes raw OHLCV data using a **Hybrid Windowing** approach. Calculates industry-standard indicators (RSI with RMA smoothing matching TradingView, MACD, Bollinger Bands) and scans for geometrical **SMC Fractals** (Swing Highs/Lows) while strictly isolating current-day data (09:00 - 16:00 WIB) for accurate daily VWAP.
- **Fundamental Analyst**: Fetches Stockbit KeyStats & Financial Reports to calculate a concrete **Valuation Score** (PBV, PE, Yield) for detecting deep value setups vs value traps.

## 📂 Project Structure

```text
tradingsquad-ai-skills/
├── README.md           
├── INSTALLATION.md     # Automated CLI installation instructions
├── USER_GUIDE.md       # Multi-agent workflow and prompting guide
├── AGENTS.md           # Master Trading Context & Data Integrity Rules
├── skills.json         # Skill registry mapping for AI auto-discovery
├── core/
│   ├── stockbit_auth.py    # Shared Auth client (Python)
│   └── stockbit-auth.js    # Shared Auth client (JS/Node)
└── skills/
    ├── fundamental-analyst/  
    ├── institutional-analyst/
    ├── market-scanner/       # Real-time intraday draggers & lifters
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

These skills force the LLM to output probability-based scenarios rather than certainties. Every analysis relies on **Quant Score 2.0**—a 100-point robust metric scoring Technicals (50%), Fundamentals (20%), and Bandarmology (30%). Finally, every output provides an exact **Entry Zone**, **Stop Loss**, **Risk-Reward Ratio**, and a clear **Invalidation Level**.


---

&copy; Copyright (c) 2026 - MasEDI.Net
