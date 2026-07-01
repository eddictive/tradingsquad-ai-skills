# Trading Modes — Canonical Reference

> **Machine-readable source:** `core/trading-modes.json`  
> Referenced by `AGENTS.md`, `docs/USER_GUIDE.md`, and skill `SKILL.md` files.

When a user requests analysis, infer their trading timeframe from the prompt and pass the matching `technical_api_mode` to `technical-api`.

| Mode | Timeframe | `technical_api_mode` | Broker Summary |
|------|-----------|----------------------|----------------|
| Intraday / Scalping | 1–3 days | `intraday` | 5D |
| Short Swing | 1–3 weeks | `short_swing` | 1M |
| Swing / Medium Term | 1–3 months | `swing` | 3M |
| Long Term / Investing | 6 months+ | `longterm` | 6M |

## Mode Details

### Intraday / Scalping (`intraday`)
- VWAP (09:00–16:00 WIB window), 1H/15m momentum, live tape
- Example: *"Analisis ADRO untuk scalping hari ini"*

### Short Swing (`short_swing`)
- 15m/1h structure + daily trend, MA10/MA20
- Example: *"Analisis swing pendek TINS"*
- **Important:** Pass `short_swing` — not `swing`

### Swing / Medium Term (`swing`)
- Daily/Weekly chart, MA50, 3-month Fibonacci
- Example: *"Analisis swing medium term AMMN"*

### Long Term / Investing (`longterm`)
- MA200, intrinsic value, macro; delegate heavily to `fundamental-analyst`
- Example: *"Analisis long term BBRI buat nabung saham"*

## CLI Invocation

```bash
node skills/technical-analyst/scripts/technical-api.js BBCA short_swing
node skills/institutional-analyst/scripts/institutional-api.js broker BBCA
```

---

&copy; Copyright (c) 2026 - MasEDI.Net