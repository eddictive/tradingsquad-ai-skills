---
name: market-scanner
description: Evaluates market-wide movements, top gainers, foreign flows, and runs advanced screeners to detect money flow across the entire stock exchange (IDX).
---

# Market Scanner Agent (The "Radar")

This skill gives you the ability to zoom out and scan the entire market (IDX) for macro trends, foreign flows, and hidden accumulation. Instead of analyzing a single ticker, you analyze the entire stock exchange to find which tickers are currently being accumulated by institutions or are poised for a breakout.

## WHAT YOU CAN DETECT

1.  **Top Foreign Buy/Sell**: Discover which stocks are being accumulated by Foreign Institutions over a specific date range (e.g. 1 week, 1 month).
2.  **Market Movers**: Find today's top gainers and top net foreign buys.
3.  **Big Accumulation Screener**: Run a custom Screener Template that filters the entire IHSG for stocks experiencing massive Bandar Accumulation.
4.  **Rebound Hunter Screener**: Find fundamentally healthy stocks (positive PE) whose price has crossed above MA50 with strong momentum.

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
| `node scripts/scanner-api.js mover [TYPE]` | Gets top movers (e.g. MOVER_TYPE_NET_FOREIGN_BUY) | `node scripts/scanner-api.js mover MOVER_TYPE_NET_FOREIGN_BUY` |
| `node scripts/scanner-api.js topstock [START] [END]` | Gets top foreign buy/sell flow over a date range | `node scripts/scanner-api.js topstock 2026-06-01 2026-06-25` |
| `node scripts/scanner-api.js screener [TYPE]` | Runs custom template screener (ACCUMULATION/REBOUND) | `node scripts/scanner-api.js screener ACCUMULATION` |
| `node scripts/scanner-api.js livedraggers` | Scans 16 Big Caps (including BBNI, GOTO) to find live intraday draggers | `node scripts/scanner-api.js livedraggers` |

## 2. Market Mover Types
- **Live Intraday Warning:** Data `topstock` dan `mover` (Foreign Flow) seringkali mengalami *delay* (direkap *End of Day*). Jika diminta menganalisis penggerak bursa saat jam perdagangan sedang berlangsung (Sesi 1 atau Sesi 2), WAJIB gunakan `node scripts/scanner-api.js livedraggers` untuk menarik pergerakan *real-time* dari 16 Saham Raksasa penentu IHSG (termasuk BBCA, BBRI, BMRI, BBNI, TLKM, AMMN, BREN, TPIA, BYAN, ASII, DSSA, GOTO).

---

# FINAL OUTPUT FORMAT

When the user asks you to scan the market or find potential stocks, reply strictly in this markdown format:

```markdown
# 📡 MARKET SCANNER REPORT — [Date]
**Trend & Flow Radar**

## 1. Foreign Flow Highlights (Top Accumulation)
(List the top 3-5 stocks being accumulated by foreign money and mention their average buying price. Why are they buying these specific sectors?)
- **BBCA**: ...
- **BMRI**: ...

## 2. Big Accumulation Screener Results
(List the top results from the ACCUMULATION screener. These are stocks with Bandar Accum/Dist score > 20.)
- **TLKM**: (Briefly explain if this is a breakout setup or markdown accumulation).

## 3. Rebound Hunters (Momentum Play)
(List results from the REBOUND screener. Discuss if these are worth a swing trade).

## 4. Strategic Conclusion
(Synthesize the data. Where is the "Smart Money" flowing? E.g. "Foreigners are dumping banking but heavily accumulating energy.")
```
