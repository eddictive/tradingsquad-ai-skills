# Changelog

All notable changes to TradingSquad AI Skills are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [1.0.3] - 2026-07-02

### Added
- `core/orderbook-format.js` / `orderbook_format.py` — normalize Stockbit orderbook to 10-level BID/OFFER boards with lots and ratio
- `tests/orderbook-format.test.js`

### Changed
- `institutional-api orderbook` returns formatted `bid[]` / `offer[]` (10 levels each, BEI/Stockbit depth)
- `institutional-analyst` SKILL.md §5 Order Book Intelligence — require all 10 levels (Rule of 5 exception)
- `ARCHITECTURE.md` — document orderbook as Rule-of-5 exception

## [1.0.2] - 2026-07-01

### Added
- `core/auth-failure.js` / `auth_failure.py` — shared STOP_PIPELINE banner and forbidden-fallback list
- Auth-check tests for expired refresh token and `STOP_PIPELINE` JSON action

### Changed
- `auth-check` now prints `⛔ PIPELINE HALTED` banner with explicit agent stop instructions on exit 1
- `auth-check` JSON output includes `action: STOP_PIPELINE` and `forbidden` list for agents
- AGENTS.md Rule 6 HARD STOP: no web search, cached data, or partial reports on auth failure
- All five `SKILL.md` files, `ORCHESTRATION.md`, `INSTALLATION.md` — auth failure zero-fallback policy

## [1.0.1] - 2026-07-01

### Added
- `scripts/auth-check.js` / `auth-check.py` — BYOT preflight after trading-day-check, before API scripts
- `core/auth-preflight.js` / `auth_preflight.py` — session stamp (30 min TTL) for single pipeline auth gate
- AGENTS.md Rule 6 (auth gate) and orchestration pipeline step 2
- `core/SKILL_TEMPLATE.md` — canonical SKILL.md layout (role → preflight gates → instructions)
- Tests: `auth-check.test.js`, `auth-preflight.test.js`

### Changed
- Standardized all five `skills/*/SKILL.md` files: `ROLE & PERSONA` → `PREFLIGHT GATES` (Gate 1 trading day, Gate 2 auth) → detailed instructions
- Auth preflight: orchestrator runs once; sub-agents skip; standalone runs once (`sentiment`: `macro-news` RSS exempt from both gates)
- Moved user/developer docs to `docs/` (INSTALLATION, USER_GUIDE, ARCHITECTURE, CONTRIBUTING, ROADMAP, CHANGELOG)
- Consolidated Python workspace shims via `scripts/_resolve_skill_script.py`
- Installer deploys `ORCHESTRATION.md` to workspace root on local install
- Removed unused `ide-dev.md`

## [1.0.0] - 2026-07-01

### Added
- Multi-agent skill framework: institutional, technical, fundamental, sentiment, market-scanner
- BYOT Stockbit auth with auto token refresh (`core/stockbit-auth`)
- CLI subcommands on all API scripts with `--help`
- Deterministic Quant Score 360° (20/20/20/40 engines)
- Workspace script shims (`scripts/trading-day-check`, `scanner-api`, `quant-score`)
- Portable orchestration guide (`ORCHESTRATION.md`)
- Installer hardening: `--tag`, `--verify`, `--check-updates`, `.tradingsquad-version`
- Parallel livedraggers with concurrency cap + HTTP retry/cache layer
- Test suite (`npm test`) and GitHub Actions CI
- JSON Schema contracts (`core/schemas/`) and lightweight validators
- Enriched `skills.json` manifest with triggers and CLI aliases
- Holiday calendar maintenance check (`scripts/check-holiday-calendar.js`)

### Changed
- Trading modes unified in `core/trading-modes.json` and `core/TRADING_MODES.md`
- Rule of 5 enforced in API defaults
- WIB 09:00 intraday windowing in technical/scanner APIs

### Security
- `.stockbit_token.json` excluded from npm package and git
- Installer warns when BYOT token file is present (never overwritten)

[1.0.3]: https://github.com/eddictive/tradingsquad-ai-skills/releases/tag/v1.0.3
[1.0.2]: https://github.com/eddictive/tradingsquad-ai-skills/releases/tag/v1.0.2
[1.0.1]: https://github.com/eddictive/tradingsquad-ai-skills/releases/tag/v1.0.1
[1.0.0]: https://github.com/eddictive/tradingsquad-ai-skills/releases/tag/v1.0.0