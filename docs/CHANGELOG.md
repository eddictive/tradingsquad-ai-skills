# Changelog

All notable changes to TradingSquad AI Skills are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed
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

[1.0.0]: https://github.com/eddictive/tradingsquad-ai-skills/releases/tag/v1.0.0