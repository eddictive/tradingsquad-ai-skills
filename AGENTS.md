# General AI Rules for TradingSquad-AI Workspace

### IHSG (Indonesian Stock Exchange) Trading Context & Data Integrity

1. **Trading Hours (Time Context):** Always consider the current local time (WIB / UTC+7). Active trading hours are 09:00 - 16:00 WIB. Adjust the urgency and tone of your analysis based on whether the market is Pre-Open, Session 1, Session 2, or Closed.
2. **The End-of-Day (EOD) Data Illusion:** Official "Net Foreign Buy/Sell" and "Market Movers" data from exchanges/brokers (like Stockbit) are generally batch-processed at the End of the Day. DO NOT use this lagging data to analyze what is dragging the index down *while the market is still actively trading*. Instead, use alternative real-time approaches (e.g., the `livedraggers` function in `market-scanner`) which tracks the live intraday price shifts of 16 Big Caps.
3. **Intraday Windowing Logic:** When calculating daily VWAP or intraday High/Low limits, ensure the data array strictly starts from 09:00 WIB of the *current trading day*. However, for momentum indicators (like MA or RSI), you are required to fetch historical data spanning a few previous days to prevent broken curves at the opening bell.
4. **Big Caps Index Weighting (Free Float):** Remember that the IHSG uses a *Free-Float Adjusted* methodology. Traditional giants like BBCA, BBRI, BMRI, BBNI, ASII, and TLKM have massive index-dragging power due to their huge public liquidity (Free Float). Do not blindly rely on raw Total Market Cap, as newer mega-caps (like DCII, BREN, BYAN) often have enormous valuations but very thin free floats, dampening their actual mathematical impact on the index compared to the traditional Big Banks.
5. **Trading Day Verification (Market Holiday Guard):** 
   Before executing scans or analysis, verify if today is an active trading day using `node scripts/trading-day-check.js` (which checks against the official `core/idx-holidays.json`).
   - **If the request requires LIVE / INTRADAY data (e.g. scalping, "scan hari ini") and the market is CLOSED:** Do NOT attempt to run live scans. Inform the user that the market is closed and ask for permission to use the last trading day's data.
   - **If the request is for SWING, LONG-TERM, or General Analysis and the market is CLOSED:** Do NOT block or ask for permission. Automatically fall back to using the data from the **last active trading day** and simply state in your report (e.g., *"Using EOD data from Friday, 26 June as the market is closed today"*). Proceed with the full analysis seamlessly.
   - **If market is OPEN**: Proceed normally while respecting session-time rules (Rule 1).

### Workspace Cleanliness & Temporary Files

6. **Temporary File Management**: NEVER create temporary files (e.g., `.temp.json`, `.macro.json`, etc.) in the root directory of the workspace. If you need to pipe the output of a terminal command to a file for reading, you MUST create a `.data/temp/` directory (e.g., `mkdir -p .data/temp`) and place all temporary files inside it (e.g., `.data/temp/adro_macro.json`). This ensures the user's workspace remains clean and uncluttered.

### Report Generation

7. **Save Final Reports**: Whenever you generate a final analysis report for a specific ticker (whether it is Institutional, Fundamental, Sentiment, or Technical), you MUST also save a copy of the report as a markdown file in the `report/` directory in addition to outputting it to the terminal. 
   - Ensure the directory exists (`mkdir -p report`).
   - Use the naming convention `report/[TICKER]_[analysis_type]_analysis_[date].md` (e.g., `report/ADRO_institutional_analysis_2026-06-29.md` or `report/BBCA_sentiment_analysis_2026-06-29.md`). 
   - This ensures the user has a persistent historical record of your analysis.

### Built-in Skill Scripts vs Custom Scripts

8. **Use Provided Skill Scripts (No Custom Fetchers)**: Do NOT write custom fetching/scraping scripts. Use the pre-built API scripts in `skills/[skill_name]/scripts/` (or installed paths like `.agents/skills/`) via **CLI subcommands** (e.g. `node skills/institutional-analyst/scripts/institutional-api.js broker BBCA`). Every API script supports `--help`. For multi-agent workflows see `ORCHESTRATION.md`. The `.data/temp/` directory is for piping JSON output only — not executable code.

### Supported Trading Modes & Intent Mapping

9. **Trading Mode Classification**: When a user requests an analysis, infer the trading timeframe based on their prompt and orchestrate your sub-agents (e.g., `technical-analyst`, `institutional-analyst`) accordingly. **Canonical mapping:** `core/trading-modes.json` and `core/TRADING_MODES.md` — always pass the `technical_api_mode` value to `technical-api`. Short Swing uses `short_swing`, not `swing`.


---

&copy; Copyright (c) 2026 - MasEDI.Net
