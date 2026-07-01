# Multi-Agent Orchestration Guide

> How to run a full institutional analysis across **Antigravity**, **Grok**, **Claude Code**, and **Codex** — without relying on a single proprietary tool.

The `institutional-analyst` is the **Master Orchestrator**. It coordinates four analytical engines and merges results into a **Master Quant Score (360°)** report.

---

## Standard Analysis Pipeline

For a complete ticker evaluation (e.g. BBCA swing trade):

```
1. trading-day-check     → verify market is open (if intraday / live scan)
2. auth-check            → **once** — orchestrator only (STOP if exit 1)
3. technical-api         → getAnalysis(TICKER, MODE)
4. fundamental-api       → keystats TICKER
5. sentiment-api         → aggregate TICKER
6. institutional-api     → broker + foreign flow (multi-timeframe)
7. quant-score           → merge 4 engine scores (20+20+20+40) into 100-point rating
8. Write report          → report/[TICKER]_institutional_analysis_[date].md
```

**Preflight (orchestrator runs once before step 3):**
```bash
node scripts/trading-day-check.js    # skip or adapt for swing/EOD-only requests per AGENTS.md Rule 5
node scripts/auth-check.js           # 1× per pipeline — NOT per sub-skill
```

### Auth gate — who runs it?

| Scenario | Runs `auth-check`? | Times |
|----------|-------------------|-------|
| Full pipeline via `institutional-analyst` | **Orchestrator only** (step 2) | **1×** |
| Sub-agents (technical, fundamental, sentiment, scanner) when delegated | **No** — skip; trust orchestrator preflight | **0×** |
| User invokes a **single** skill standalone | That skill, before its `*-api` | **1×** |
| All 5 skills read naively (bug) | Each skill runs gate | **5×** — **wrong**; sub-agents must not |

Successful `auth-check` writes `.data/temp/.auth-preflight.json` (30 min, invalidated if token file changes).

### Auth failure — HARD STOP

If `auth-check` exits **1** (missing token, expired access/refresh, refresh failed, or API 401/403):

1. **Stop the pipeline** — do not run steps 3–8.
2. **Relay the banner** printed by `auth-check` (starts with `⛔ PIPELINE HALTED`).
3. **Tell the user** to paste a fresh `credentialStorage` value into `.stockbit_token.json` per `docs/INSTALLATION.md`.

**Forbidden after auth failure:** web search or scraping for market data; cached `.data/temp/` files; alternate auth paths; custom fetchers; partial reports; sub-agent delegation.

Mode mapping: see `core/trading-modes.json`.

---

## CLI-Specific Delegation Patterns

### Antigravity CLI

Use native `invoke_subagent` when available:

```
@institutional-analyst Analyze BBCA for short swing.
Delegate technical, fundamental, and sentiment to sub-agents.
```

The orchestrator skill may also call scripts directly via terminal.

### Grok Build CLI

Grok does not expose `invoke_subagent`. Use **sequential skill reads + terminal scripts**:

1. Read `skills/institutional-analyst/SKILL.md` (or `.grok/skills/...` after install).
2. For each sub-task, read the sub-skill `SKILL.md` and run its CLI script.
3. Pipe JSON outputs to `.data/temp/` if needed.
4. Run `node scripts/quant-score.js --input .data/temp/bbca_scores.json`.
5. Synthesize the final report per `institutional-analyst` output template.

**Example script chain (short swing BBCA):**
```bash
node scripts/trading-day-check.js
node scripts/auth-check.js
node skills/technical-analyst/scripts/technical-api.js BBCA short_swing
node skills/fundamental-analyst/scripts/fundamental-api.js keystats BBCA
node skills/sentiment-analyst/scripts/sentiment-api.js aggregate BBCA
node skills/institutional-analyst/scripts/institutional-api.js broker BBCA BROKER_SUMMARY_PERIOD_LAST_1_MONTH
node scripts/quant-score.js --technical 14 --fundamental 11 --sentiment 12 --bandarmologi 28 --ticker BBCA
```

### Claude Code CLI

Use slash commands or explicit skill invocation:

```
/institutional-analyst Analyze BMRI — run technical, fundamental, sentiment scripts, then quant-score.
```

Workflow:
1. Load `AGENTS.md` master rules.
2. Read each sub-skill `SKILL.md` from `.claude/skills/`.
3. Execute CLI scripts in the pipeline above.
4. Merge JSON into quant-score input file.

### OpenAI Codex CLI

Codex reads root `AGENTS.md` automatically. Skills live in `.codex/skills/`.

1. Parse user intent and trading mode from `AGENTS.md` Rule 9.
2. Run scripts from `.codex/skills/[skill]/scripts/`.
3. Follow the same pipeline; save report to `report/`.

---

## Master Quant Score 360° (Deterministic)

Do **not** invent the composite score in prose. Use the calculator (`core/quant-score-spec.json`):

```bash
node scripts/quant-score.js --technical 15 --fundamental 14 --sentiment 11 --bandarmologi 32 --ticker BBCA
node scripts/quant-score.js --input .data/temp/bbca_quant_input.json
```

**Input JSON format:**
```json
{
  "ticker": "BBCA",
  "technical": { "score": 15 },
  "fundamental": { "score": 14, "fairValue": 9500, "marginOfSafetyPct": 12 },
  "sentiment": { "score": 11, "insiderBuying": true },
  "bandarmologi": { "score": 32, "netFlow": "accumulation", "foreignFlow": "net_foreign_buy" }
}
```

| Engine | Weight | Max |
|--------|--------|-----|
| Technical Momentum | 20% | 20 |
| Fundamental & Value | 20% | 20 |
| Catalyst & Sentiment | 20% | 20 |
| Bandarmologi Flow | 40% | 40 |

**Ratings:** STRONG BUY (≥80) · BUY (≥65) · HOLD (≥45) · SELL (≥30) · STRONG SELL (<30)

---

## Workspace Script Paths

| Script | Workspace shim | Skill path (direct) |
|--------|----------------|---------------------|
| Trading day check | `node scripts/trading-day-check.js` | `skills/market-scanner/scripts/` |
| Auth preflight | `node scripts/auth-check.js` | `core/stockbit-auth.js` (via shim) |
| Market scanner | `node scripts/scanner-api.js livedraggers` | `skills/market-scanner/scripts/` |
| Quant score | `node scripts/quant-score.js --help` | `core/quant-score.js` |
| Institutional | `skills/institutional-analyst/scripts/institutional-api.js broker BBCA` | — |
| Technical | `skills/technical-analyst/scripts/technical-api.js BBCA swing` | — |

All API scripts support `--help`.

---

## Sample Multi-Agent Prompt

> Act as the Institutional Analyst. Analyze **BBCA** for **short swing** (1–3 weeks).
> 1. Run `trading-day-check` (adapt for swing/EOD if market closed per AGENTS.md).
> 2. Run `auth-check` — if exit 1, HARD STOP (no web search, cached data, or partial reports). Relay banner; user must refresh `.stockbit_token.json` per `docs/INSTALLATION.md`.
> 3. Fetch technical analysis (`short_swing`), fundamental keystats, sentiment aggregate, and 1-month broker summary.
> 4. Compute Master Quant Score via `quant-score.js` (4 engines: 20+20+20+40).
> 5. Produce the full institutional report and save to `report/`.

---

&copy; Copyright (c) 2026 - MasEDI.Net