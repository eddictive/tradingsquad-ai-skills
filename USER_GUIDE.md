# User Guide: TradingSquad AI Skills

TradingSquad utilizes a powerful **Multi-Agent Collaborative Architecture**. The **`institutional-analyst` (The Brain/Orchestrator)** and **`technical-analyst` (The Sniper)** are designed to talk to each other, delegate workloads, and synthesize data just like a real proprietary trading desk. The **`fundamental-analyst` (The Valuator)** and **`sentiment-analyst` (The Narrative Checker)** provide vital valuation and news confirmation, while the **`market-scanner` (The Radar)** tracks macro flow.

---

## The Collaborative Workflow (Recommended)

When you request an Institutional Analysis, the AI framework automatically chains multiple skills and API scripts together to generate a comprehensive report.

### Supported Trading Modes & Intent Mapping

To get the most accurate analysis, your prompt should imply or explicitly state your trading timeframe. The AI will automatically orchestrate its tools based on the following classification:

- **Intraday / Scalping (1-3 Days)**
  - *Context*: Focuses on VWAP, 1H/15m timeframe, fast momentum, and live tape reading.
  - *Example Prompts*: "Analisis ADRO untuk scalping hari ini", "Cek momentum BBCA buat day trade", "Apakah BREN kuat naik sampai penutupan sesi 2?"
  - *Action*: The AI fetches 1-day or 5-day broker summary and intraday technicals.

- **Short Swing (1-3 Weeks)**
  - *Context*: Focuses on Daily (1D) chart, MA10/MA20, and short-term accumulation.
  - *Example Prompts*: "Analisis swing pendek TINS", "Gimana prospek BUMI buat 2 minggu ke depan?", "Cek bandarmologi GOTO bulan ini."
  - *Action*: The AI fetches 1-week or 1-month broker summary and daily trend technicals.

- **Swing / Medium Term (1-3 Months)**
  - *Context*: Focuses on Daily/Weekly (1W) chart, MA50, and 3-month Fibonacci.
  - *Example Prompts*: "Analisis swing medium term AMMN", "Proyeksi harga BRPT 3 bulan ke depan", "Apakah aman hold ASII sampai kuartal depan?"
  - *Action*: The AI fetches 1-month or 3-month broker summary and medium-term technicals.

- **Long Term / Investing (6 Months - Years)**
  - *Context*: Focuses on Weekly/Monthly chart, MA200, fundamental fair value, and macro trends.
  - *Example Prompts*: "Analisis long term BBRI buat nabung saham", "Fundamental check INDF untuk hold 2 tahun", "Proyeksi profitabilitas PTBA FY 2026."
  - *Action*: The AI fetches 3-month or 6-month broker summary and delegates heavily to the fundamental-analyst for valuation.

### How to Prompt
Start your CLI inside the project directory and simply ask the lead analyst:

> *"Act as the Institutional Analyst. Analyze the BBCA ticker. Determine the Wyckoff phase based on order flow, and grab the Quant Score from the technical analyst."*

### What Happens Under The Hood?
1. The **`institutional-analyst`** reads your prompt and sees it requires OHLCV metrics, Quant Scores, Fundamental data, and news validation.
2. It **delegates** tasks using the `invoke_subagent` tool: Technical charting to **`technical-analyst`**, valuation to **`fundamental-analyst`**, and news/catalysts to **`sentiment-analyst`**.
3. The `technical-analyst` runs `technical-api.js` to fetch Intraday/Daily candlestick data and groups the data into technical buckets (e.g., MA20 crossing MA50, RSI values).
4. The `fundamental-analyst` runs `fundamental-api.js` to fetch KeyStats (PBV, PE) and calculates the exact **Intrinsic Value (Nilai Wajar)** and **Margin of Safety**.
5. The `sentiment-analyst` parses macro news and insider trading flows to check if the retail crowd is being trapped by orchestrated hype.
6. Simultaneously, the `institutional-analyst` runs `institutional-api.js` to fetch Orderbook balance, Foreign Flow, and Top Brokers using a **Multi-Timeframe approach** (e.g., comparing Intraday vs 1-Month) strictly adhering to the **Rule of 5**.
7. The Agent synthesizes the data to find **SMC Sniper Confluence** (e.g., matching a Bullish FVG detected by the technical agent with massive accumulation by the Top 1 Broker and positive Fair Value).
8. The final output is delivered as a structured Probability Report with an exact Entry Zone and Invalidation Stop Loss.

---

## 🕒 The Multi-Timeframe Bandarmology Matrix

To get the most accurate institutional reading, you should explicitly prompt the AI to compare different timeframes based on the stock's current phase:

- **For Bottoming Stocks (Long-term Sideways)**:
  > *"Analyze ADRO. Compare the broker summary for the last 3 months against the last 7 days."*
- **For Swing Trading (Uptrending/Correction)**:
  > *"Analyze BBCA. Compare the 1-month accumulation with today's intraday broker flow to spot shakeouts."*

By providing these prompts, the `institutional-analyst` will seamlessly pass the correct `period` arguments to the API and reveal hidden "Cornering" or "Fakeout" operations by massive institutions!

---

## 🚨 Market Scanner: Live Intraday Draggers & Lifters

Stockbit's official Net Foreign Flow and Market Mover endpoints are heavily delayed until End of Day (EOD). To analyze what is driving the IHSG composite index *during active trading hours* (09:00 - 16:00 WIB), **DO NOT** ask for EOD data.

Instead, ask the agent to run the **Live Draggers** scan:

> *"Act as the Market Scanner. IHSG is dropping hard in Session 1 right now. Run the livedraggers script to find out which of the 16 Big Caps are pulling the index down, and which ones are acting as lifters."*

1. The **`market-scanner`** agent will invoke the `livedraggers` action.
2. The script computes the real-time percent change of 16 heavily-weighted Free Float Giants (BBCA, BMRI, BBNI, AMMN, BREN, etc.) starting exactly from today's opening bell.
3. It cleanly separates the output into **The Lifters 🚀** (Green Zone) and **The Draggers 🩸** (Red Zone), giving you the exact cause of intraday IHSG volatility.

### Tracking Foreign Flow Market-Wide
You can also ask the scanner to find which stocks foreigners are accumulating heavily across the entire exchange:
> *"Act as the Market Scanner. Find the Top Net Foreign Buy and Sell for the entire IHSG today."*
The scanner will utilize `getMarketMover` or `getTopStock` to fetch exactly where the offshore money is flowing.

### Deep Dive: Symbol Detector & Live Tape
If you want to zoom in on a specific ticker's accumulation status or read its real-time order flow speed, you can ask the scanner:
> *"Act as the Market Scanner. Run the detector for CUAN to check the Bandar Accumulation status, then open the live tape for CUAN and BREN."*

---

## 🔐 Authentication & Core Module

Because multiple agents run parallel scripts, Authentication is managed globally by the **`core/`** module.

You **do not** need to ask the AI to log in. The moment an Agent runs `institutional-api` or `technical-api`, the script will automatically read your `.stockbit_token.json` file.
- **Auto-Rotation Built-in**: If your `access_token` naturally expires during a session, the background API Client will seamlessly use your `refresh_token` to fetch a new one and overwrite your `.stockbit_token.json` automatically! It will only explicitly instruct you to re-login if the 7-day refresh token dies.

### Manual Verification
If you want to test if your pasted token works before starting an AI session, you can run the core module independently in your terminal:

**Python Runtime:**
```bash
python core/stockbit_auth.py
```

**Node.js/Bun Runtime:**
```bash
node core/stockbit-auth.js
```

*(You will receive a success message confirming the token is cached).*

---

## Manual Input Mode (Screenshots)

If you are analyzing charts not covered by the Stockbit endpoints (e.g., TradingView crypto charts, or proprietary RTI broker flow screens), you can bypass the API completely using Vision Mode.

### How to Prompt
Attach your screenshot(s) to the CLI chat and provide the ticker:

> *"Act as the Institutional Analyst. Attached is the daily chart of BREN with Volume and MACD, along with the 20-day Broker Summary from RTI. Give me your Wyckoff and Bandarmologi analysis."*

The Vision Model will visually scan the Chart structure, read the Broker tables, and output the exact same standardized Trading Plan without hitting any APIs.


---

&copy; Copyright (c) 2026 - MasEDI.Net
