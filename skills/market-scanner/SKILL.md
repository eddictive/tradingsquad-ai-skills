---
name: market-scanner
description: Evaluates market-wide movements, top gainers, foreign flows, and runs advanced screeners to detect money flow across the entire stock exchange (IDX).
---

# Market Scanner Agent (The "Radar")

This skill gives you the ability to zoom out and scan the entire market (IDX) for macro trends, foreign flows, and hidden accumulation. Instead of analyzing a single ticker, you analyze the entire stock exchange to find which tickers are currently being accumulated by institutions or are poised for a breakout.

## WHAT YOU CAN DETECT

1.  **Whale / Smart Money Tracker (Broker Activity)**: Track exactly which stocks the top Foreign/Local Brokers (e.g. AK, ZP, YU) are accumulating or dumping *real-time*.
2.  **Top Brokers of the Day/Week**: Find out which brokers hold the biggest transaction volume today.
3.  **Crowd Sentiment (Trending Stocks)**: See which tickers are actively searched and discussed by retail traders right now.
4.  **Top Foreign Buy/Sell**: Discover which stocks are being accumulated by Foreign Institutions over a specific date range (e.g. 1 week, 1 month).
5.  **Market Movers**: Find today's top gainers, top losers, top values, top volumes, top net foreign buys, and top net foreign sells.
6.  **Big Accumulation Screener**: Run a custom Screener Template that filters the entire IHSG for stocks experiencing massive Bandar Accumulation.
7.  **Rebound Hunter Screener**: Find fundamentally healthy stocks (positive PE) whose price has crossed above MA50 with strong momentum.
8.  **Symbol Detector (Deep Dive)**: Check the detailed Bandar Accumulation/Distribution status and detailed Broker Net Buy/Sell average prices for a specific stock.
9.  **Live Tape Reading (Running Trade)**: Track tick-by-tick execution (buy/sell flow) of multiple stocks simultaneously to catch real-time FOMO or panic.

---

# ⚠️ STEP 0 — MANDATORY TRADING DAY GATE

**Before doing ANYTHING else, you MUST verify today is an active IDX trading day.**

Run the following check script first:
```bash
node scripts/trading-day-check.js
# OR
python3 scripts/trading-day-check.py
```

### Decision Table

| Script Output | Your Action |
| :--- | :--- |
| `✅ MARKET OPEN` | Proceed with the scan below. |
| `📅 WEEKEND — Market Closed` | STOP. Tell the user IDX is closed (weekend), then offer to analyze the last trading session. |
| `🎌 PUBLIC HOLIDAY — Market Closed: [Holiday Name]` | STOP. Tell the user IDX is closed (holiday), then offer to analyze the last trading session. |

### Response Template When Market is Closed
```
⛔ The IDX market is **closed today** — [Day, DD MMM YYYY] is a [weekend / public holiday: Holiday Name].
Bursa Efek Indonesia only operates Monday–Friday on non-holiday working days.

📊 I can instead analyze the **most recent trading session** data from **[Last Trading Day, DD MMM YYYY]**.
Would you like me to proceed with that?
```

---

# TOOL / FUNCTION MODE
For market data, utilize either `scanner-api.py` or `scanner-api.js` in the `scripts/` directory to retrieve live data. 
*Note: The scripts handle Stockbit authentication and token caching automatically via `.stockbit_token.json` and `.env`, so you do not need to manually authenticate unless a fresh login is required.*

**CRITICAL RULES FOR SCRIPT USAGE**:
1. **DO NOT write your own Stockbit API wrappers or scraping scripts from scratch.** It wastes time and breaks BYOT authentication.
2. You MUST use the existing `scanner-api.js` or `scanner-api.py` located in this skill's `scripts/` directory (e.g. `.agents/skills/market-scanner/scripts/`).
3. **Execution Example**: Use the `run_command` tool to execute a one-liner to fetch what you need.

| Command | Description | Example |
| :--- | :--- | :--- |
| `node scripts/scanner-api.js topbroker [PERIOD]` | Gets top brokers by transaction value. Period defaults to `TB_PERIOD_LAST_1_DAY` | `node scripts/scanner-api.js topbroker TB_PERIOD_LAST_1_DAY` |
| `node scripts/scanner-api.js whale [BROKER_CODE]` | Gets stocks actively accumulated/distributed by a specific broker | `node scripts/scanner-api.js whale AK` |
| `node scripts/scanner-api.js trending` | Gets current crowd sentiment (trending stocks) | `node scripts/scanner-api.js trending` |
| `node scripts/scanner-api.js mover [TYPE]` | Gets top movers (e.g. MOVER_TYPE_TOP_VALUE). **Note: Foreign flow here is delayed by 1 day! DO NOT use for live intraday.** | `node scripts/scanner-api.js mover MOVER_TYPE_TOP_VALUE` |
| `node scripts/scanner-api.js topstock [START] [END]` | Retrieves top stocks by foreign flow over a date range. **Note: If queried during live intraday, this returns YESTERDAY'S EOD data.** | `node scripts/scanner-api.js topstock 2026-07-01 2026-07-01` |
| `node scripts/scanner-api.js screener [TYPE]` | Runs custom template screener (ACCUMULATION/REBOUND) | `node scripts/scanner-api.js screener ACCUMULATION` |
| `node scripts/scanner-api.js livedraggers [GROUP]` | Scans specific groups from `core/emitens.json` to find live intraday draggers. If `[GROUP]` is omitted, it defaults to `giants` (Big Caps). Other available groups include `prajogo`, `salim`, `sinarmas`, `saratoga`, `djarum`, `thohir`, `lippo`, `bakrie`, `energi`, and `banking`. | `node scripts/scanner-api.js livedraggers energi` |
| `node scripts/scanner-api.js detector [TICKER]` | Gets specific symbol detector (Bandar Detector & Broker Summary) | `node scripts/scanner-api.js detector CUAN` |
| `node scripts/scanner-api.js tape [TICKERS] [LIMIT]` | Tracks the tick-by-tick Running Trade of one or multiple tickers | `node scripts/scanner-api.js tape CUAN,BREN 50` |
| `node ../sentiment-analyst/scripts/sentiment-api.js official MACRO 3` | **LIVE INTRADAY FOREIGN FLOW (Sesi 1/2):** Fetches official @Stockbit stream. If you see a PDF attachment for "Foreign Transaction Midday Data", download and read it using `view_file` to get real live foreign flow! | `node ../sentiment-analyst/scripts/sentiment-api.js official MACRO 3` |

## 2. Market Mover Types
- **Live Intraday Warning:** Data `topstock` dan `mover` (Foreign Flow) di-censor oleh IDX dan akan *delay* (direkap *End of Day* / hari sebelumnya). **JANGAN PERNAH** melaporkan data dari `topstock` saat jam live trading sebagai "Data Sesi 1 Hari Ini". Labeli dengan jujur: *"Berdasarkan data EOD kemarin..."*
- **Sesi 1 / Midday Foreign Flow:** Untuk mendapatkan data *foreign flow* asli di tengah hari, selalu gunakan `sentiment-api.js official MACRO` untuk mengekstrak tabel PDF *Midday Data* dari Stockbit. Jika PDF belum rilis, gunakan logika *price action* (VWAP & `livedraggers`).

---

# FINAL OUTPUT FORMAT

When the user asks you to scan the market or find potential stocks, reply strictly in this markdown format:

```markdown
# 📡 MARKET SCANNER REPORT — [Date]
**Trend & Flow Radar**

## 1. Whale Tracker & Foreign Flow
> **DATA SOURCE:** [MANDATORY: State exactly where you got this data. "Midday PDF from @Stockbit", "Yesterday's EOD Data (Delayed)", or "Livedraggers Proxy (Price Action)"]
*(Analyze Top Broker Activity! If AK or ZP is the Top Broker, what exactly are they accumulating? List the top 5-10 stocks being accumulated by foreign/smart money and mention their average buying price. Why are they buying these specific sectors?)*
- **[TICKER]**: ...

## 2. Big Accumulation Screener Results
*(List the top results from the ACCUMULATION screener. These are stocks with Bandar Accum/Dist score > 20.)*
- **[TICKER]**: (Briefly explain if this is a breakout setup or markdown accumulation).

## 3. Crowd Sentiment (Trending) & Rebound Hunters
*(List results from the Trending API and REBOUND screener. Cross-reference them: Is there a fundamental stock that is suddenly trending on retail radar? Discuss if these are worth a swing trade).*

## 4. Strategic Conclusion
*(Synthesize the data. Where is the "Smart Money" flowing? E.g. "Foreign broker AK is dumping banking but heavily accumulating energy. Meanwhile, retail FOMO is focused on tech.")*
```
