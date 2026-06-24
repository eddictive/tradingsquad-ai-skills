# User Guide: TradingSquad AI Skills

TradingSquad utilizes a powerful **Multi-Agent Collaborative Architecture**. The `institutional-analyst` and `technical-analyst` are designed to talk to each other, delegate workloads, and synthesize data just like a real proprietary trading desk.

---

## The Collaborative Workflow (Recommended)

When you request an Institutional Analysis, the AI framework automatically chains multiple skills and API scripts together to generate a comprehensive report.

### How to Prompt
Start your CLI inside the project directory and simply ask the lead analyst:

> *"Act as the Institutional Analyst. Analyze the BBCA ticker. Determine the Wyckoff phase based on order flow, and grab the Quant Score from the technical analyst."*

### What Happens Under The Hood?
1. The **`institutional-analyst`** reads your prompt and sees it requires OHLCV metrics and Quant Scores.
2. It **delegates** the charting task by invoking the **`technical-analyst`**.
3. The `technical-analyst` runs `technical-api.js` to fetch Intraday/Daily candlestick data and groups the data into technical buckets (e.g., MA20 crossing MA50, RSI values).
4. The `technical-analyst` returns a standardized **Quant Score** back to the `institutional-analyst`.
5. Simultaneously, the `institutional-analyst` runs `institutional-api.js` to fetch Orderbook balance, Foreign Flow, and Top Brokers (Bandarmologi).
6. The Agent synthesizes the data and delivers the final Probability Report with an exact Entry Zone and Invalidation Stop Loss.

---

## Authentication & Core Module

Because multiple agents run parallel scripts, Authentication is managed globally by the **`core/`** module.

You **do not** need to ask the AI to log in. The moment an Agent runs `institutional-api` or `technical-api`, the script will ping the `core/stockbit-auth` module. 
- If you are authenticated, it uses the cached `.stockbit_token.json`.
- If the token is expired, it uses your `.env` to silently fetch a new one without interrupting the AI's workflow.

### Manual Authentication
If you wish to log in manually to seed the token before starting an AI session, you can run the core module independently in your terminal:

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
