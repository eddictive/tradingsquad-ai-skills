# TradingSquad AI Architecture

This document outlines the core architecture and design decisions behind the TradingSquad AI Skills framework. It serves as a blueprint for developers seeking to extend or integrate this system into other Agentic LLM frameworks.

## 1. Multi-Agent Paradigm & Orchestration

TradingSquad adopts a **Master Orchestrator** pattern rather than isolated standalone bots. 

- **The Brain/Orchestrator (`institutional-analyst`)**: Acts as the central nervous system. It handles tape reading and broker flow logic natively but lacks charting, financial statement, and news capabilities.
- **The Sub-Agents (The Squad)**: 
  - **`technical-analyst` (The Sniper)**: Autonomous sub-agent specialized in executing exact mathematical SMC and geometrical charting.
  - **`fundamental-analyst` (The Valuator)**: Specialized in calculating exact **Intrinsic Value (Nilai Wajar)** and **Margin of Safety** from complex financial ratios.
  - **`sentiment-analyst` (The Narrative Checker)**: Parses global macro events, corporate actions, and insider flows to validate if a catalyst is genuine or manipulative noise.
  - **`market-scanner` (The Radar)**: Specialized in market-wide flow, real-time Symbol Detection, and tick-by-tick Live Tape reading.

When the user queries the `institutional-analyst`, it explicitly delegates the heavy lifting using the `invoke_subagent` tool. This prevents the main agent's LLM context from being bloated with raw arrays (OHLCV, KeyStats, News feeds), saving tokens and vastly improving reasoning accuracy.

## 2. Hybrid Confluence Engine (SMC + Broker Flow)

The crowning jewel of the TradingSquad architecture is the **Hybrid Confluence Engine**, combining western Smart Money Concepts (SMC) with Indonesian Bandarmology.

### Technical Side (SMC Mathematics)
The `technical-api` executes a deterministic algorithm to identify:
- **Fractals & Market Structure**: A 5-bar ZigZag algorithm identifies Swing Highs and Swing Lows to objectively state if a Break of Structure (BoS) or Change of Character (CHoCH) has occurred.
- **Fair Value Gaps (FVG)**: Scans for 3-candle momentum imbalances and actively filters out mitigated (filled) zones, returning only the most recent *Unmitigated FVGs*.

### Institutional Side (Bandarmology)
The `institutional-api` fetches the Orderbook and Broker Summaries. 

### The Confluence
Instead of performing complex math, the LLM inside `institutional-analyst` simply pattern-matches the mathematical output from the Technical Agent with the Flow output from the Institutional Agent. 
**Example**: If the technical API returns an Unmitigated Bullish FVG at `Rp 5000-5100`, and the institutional API returns Top 1 Broker Accumulation averaging at `Rp 5050`, the AI immediately flags a **Sniper Entry** with a very high probability score.

## 3. The "Rule of 5" Token Optimization

To prevent LLM hallucination and "Dilution of Attention", the Bandarmology scripts and AI instructions strictly adhere to the **Rule of 5**. 
- API defaults enforce `limit=5` via `core/rule-of-five.js` / `rule_of_five.py` (`RULE_OF_FIVE`, `clampLimit()` / `trimToRuleOfFive()`).
- Documented exceptions (e.g. `tape` running-trade) may use higher limits for velocity analysis.
- The AI's Markdown report template forces exactly 5 output rows for Net Buyers and Net Sellers.

**Why?** In Indonesian markets, the Top 5 brokers usually account for 70%-80% of institutional liquidity. Passing Top 10 or Top 20 brokers into the LLM context introduces retail noise, causing the AI to over-analyze insignificant players and skewing the Smart Money Score.

## 4. Technical Indicators & Data Integrity

- **RSI Calculation**: Built using Wilder's Smoothing (RMA) rather than simple moving averages (SMA). The engine dynamically warms up data using the first 14 periods as an SMA baseline, then shifts to RMA, ensuring 1-to-1 parity with TradingView.
- **Intraday Windowing**: To prevent lagging EOD anomalies, Intraday mode forces VWAP and High/Low arrays to strictly slice data from `09:00 WIB` onwards. However, momentum indicators (MA, RSI) bypass this slice and fetch multi-day historical data to prevent curve breakage at the market open.
- **Real-Time Data Bypassing**: Stockbit official endpoints for Foreign Flow are delayed EOD. To bypass this, the architecture employs:
  - **Live Draggers**: Monitors 16 Free-Float Big Cap stocks minute-by-minute to calculate live index weights.
  - **Live Tape Reading (`running-trade`)**: Tracks tick-by-tick executions of multiple symbols simultaneously to catch FOMO/Panic velocity.
  - **Symbol Detector (`market-detector`)**: Dives deep into a specific ticker's *real-time* Bandar Accumulation and Broker Summary without waiting for EOD closure.

## 5. Dual-Language Execution Environment

All API connectors in the `scripts/` directory are written in both **JavaScript** (Node.js/Bun) and **Python**.
- **Why?** Agentic CLI environments differ (some are TS/JS native, some are Python native). By providing both, the AI can choose the fastest execution path without installing external dependencies like `npm` packages or heavy `pip` libraries (using native `fetch` and `requests`).

## 6. Shared Core Authentication (`core/`)

A centralized `StockbitClient` handles all session management.
- Bypasses traditional credential prompts by utilizing a session-based `.stockbit_token.json`.
- Implements XSRF-TOKEN extraction and automatic JWT Refresh Token logic.
- When any agent (Technical or Institutional) executes a script, it inherits from this single core client, ensuring no rate-limit bans or duplicate logins occur.


---

&copy; Copyright (c) 2026 - MasEDI.Net
