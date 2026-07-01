# TradingSquad AI Skills

**TradingSquad AI Skills** is a collaborative, multi-agent framework delivering institutional-grade trading intelligence for Indonesian equities (IDX). This project is designed to be natively loaded into Agentic AI CLIs such as **Antigravity CLI**, **Claude Code CLI**, **OpenAI Codex CLI**, and **Grok xAI CLI**.

By equipping your AI agents with these skills, you enable them to perform high-level market analysis typically reserved for proprietary trading desks.

## 🚀 Features

- **Multi-Agent Collaboration**: Skills autonomously delegate tasks to each other. For example, the `institutional-analyst` seamlessly queries all four analytical engines to build a unified **Master Quant Score (360°)**.
- **Dual Language Runtimes**: Every API workflow is natively written in **Python** (via `requests`) and **JavaScript** (via native `fetch`), supporting Node.js and Bun environments with zero npm dependencies.
- **Shared Core Authentication**: A centralized `core/` module handles all Stockbit API logins, `XSRF-TOKEN` tracking, and secure `.stockbit_token.json` caching globally across all agents.
- **Institutional Analyst (The Brain/Orchestrator)**: Performs Wyckoff market structure evaluation, tape reading, order book intelligence, and **Multi-Timeframe Bandarmology** (comparing Intraday vs 1-Month broker flow to detect cornering and shakeouts). Employs the **Rule of 5** to filter retail noise and maintain optimal LLM signal-to-noise ratios. Acts as the Master Orchestrator, automatically delegating tasks to sub-agents.
- **Hybrid Confluence Engine**: The `institutional-analyst` requests **Smart Money Concepts (SMC)** data from the technical side (Unmitigated FVGs, BoS/CHoCH structure) and aligns it with Top Broker Accumulation to identify high-probability **Sniper Entries**.
- **Market Scanner (The Radar)**: Scans the market for accumulation/rebound patterns and tracks **Top Foreign Flow**. Features the **Symbol Detector & Live Tape** for deep dive accumulation analysis and real-time order flow tracking, as well as the **Live Intraday Draggers** (`livedraggers`) engine to bypass End-of-Day API delays.
- **Technical Analyst (The Sniper)**: Processes raw OHLCV data using a **Hybrid Windowing** approach. Calculates industry-standard indicators (RSI with RMA smoothing matching TradingView, MACD, Bollinger Bands) and scans for geometrical **SMC Fractals** (Swing Highs/Lows) while strictly isolating current-day data (09:00 - 16:00 WIB) for accurate daily VWAP.
- **Fundamental Analyst (The Valuator)**: Fetches Stockbit KeyStats & Financial Reports to calculate a concrete **Valuation Score** and determine the exact **Intrinsic Value (Nilai Wajar)** and **Margin of Safety** for detecting deep value setups vs value traps.
- **Sentiment Analyst (The Narrative Checker)**: Scans macro-economic global news, corporate actions, insider trading, and retail sentiment to identify genuine catalysts versus institutional manipulative noise (shakeouts or FOMO traps).

## 📂 Project Structure

```text
tradingsquad-ai-skills/
├── README.md
├── AGENTS.md              # Master trading rules (installed for agents)
├── ORCHESTRATION.md       # Multi-agent delegation (installed for agents)
├── skills.json            # Skill manifest for installer / auto-discovery
├── docs/                  # User & developer documentation
├── scripts/               # Installer + workspace shims
├── core/                  # Shared auth, WIB, quant-score, schemas
└── skills/                # Analyst skills (SKILL.md + API scripts)
    ├── institutional-analyst/
    ├── technical-analyst/
    ├── fundamental-analyst/
    ├── sentiment-analyst/
    └── market-scanner/
```

## 📖 Documentation

| Guide | Link |
|-------|------|
| Installation & BYOT setup | [docs/INSTALLATION.md](docs/INSTALLATION.md) |
| User guide & prompting | [docs/USER_GUIDE.md](docs/USER_GUIDE.md) |
| Orchestration (agents) | [ORCHESTRATION.md](ORCHESTRATION.md) |
| Architecture | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Contributing | [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) |
| Roadmap & audit | [docs/ROADMAP.md](docs/ROADMAP.md) |
| Changelog | [docs/CHANGELOG.md](docs/CHANGELOG.md) |

## ⚙️ Core Philosophy

These skills force the LLM to output probability-based scenarios rather than certainties. Every analysis relies on the **Master Quant Score (360°)**—a 100-point metric across four engines: Technical Momentum (20%), Fundamental & Value (20%), Catalyst & Sentiment (20%), and Bandarmologi Flow (40%). Ratings: STRONG BUY / BUY / HOLD / SELL / STRONG SELL. See `core/quant-score-spec.json`.


---

&copy; Copyright (c) 2026 - MasEDI.Net