# Documentation

Human-facing guides and development references. These files are **not** deployed to agent skill directories by the installer — agents use `AGENTS.md`, `ORCHESTRATION.md`, and `skills/*/SKILL.md` at the project root.

| Guide | Audience | Description |
|-------|----------|-------------|
| [INSTALLATION.md](INSTALLATION.md) | Users | BYOT setup, installer CLI, per-agent integration |
| [USER_GUIDE.md](USER_GUIDE.md) | Users | Prompting, multi-agent workflow, trading modes |
| [ORCHESTRATION.md](../ORCHESTRATION.md) | Agents & users | Portable delegation patterns (lives at repo root) |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Developers | System design, Rule of 5, data integrity |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Developers | Contribution standards, dual-runtime rules |
| [ROADMAP.md](ROADMAP.md) | Developers | Improvement history and audit verification |
| [CHANGELOG.md](CHANGELOG.md) | Developers | Release notes |

**Agent runtime references** (installed / used by skills):

- `../AGENTS.md` — master trading rules
- `../ORCHESTRATION.md` — multi-agent orchestration
- `../core/TRADING_MODES.md` — trading mode table
- `../core/trading-modes.json` — machine-readable modes

---

&copy; Copyright (c) 2026 - MasEDI.Net