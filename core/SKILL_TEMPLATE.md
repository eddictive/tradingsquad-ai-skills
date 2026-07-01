# SKILL.md Template

Canonical layout for all TradingSquad skills. Copy when adding or refactoring a skill.

```markdown
---
name: skill-slug
description: One-line description for skill discovery (used in frontmatter).
---

# SKILL PROMPT — [Display Title] ([Codename])

## ROLE & PERSONA
You are a [role] for Indonesian stocks (IDX).
Your mission:
[1–3 bullet points or short paragraphs on scope and collaboration with other skills.]

[Optional: CRITICAL PHILOSOPHY or constraints.]

## PREFLIGHT GATES

Run gates **in order** before Stockbit `*-api` CLIs. Canonical rules: `AGENTS.md` Rules 5–6, `ORCHESTRATION.md`.

### Gate 1 — Trading Day

```bash
node scripts/trading-day-check.js
```

| Invocation | Run Gate 1? |
| :--- | :--- |
| **Orchestrator** (`institutional-analyst` owns pipeline) | **Yes — once** at pipeline start |
| **Sub-agent** (delegated) | **No** — orchestrator already ran it |
| **Standalone** (user invoked only this skill) | **Yes — once** before `*-api` |
| **[skill-specific exempt path]** | **No** — [reason] |

Apply **AGENTS.md Rule 5**: live/intraday when closed → stop and offer last session; swing/EOD → auto-fallback and note in report.

### Gate 2 — Auth (Stockbit BYOT)

```bash
node scripts/auth-check.js
```

| Invocation | Run Gate 2? |
| :--- | :--- |
| **Orchestrator** | **Yes — exactly once** per pipeline (after Gate 1) |
| **Sub-agent** | **No** — go straight to `*-api` |
| **Standalone** | **Yes — once** after Gate 1 |
| **[skill-specific exempt path]** | **No** — [reason, e.g. RSS-only] |

Exit **1** → STOP; direct user to `docs/INSTALLATION.md`. Success writes `.data/temp/.auth-preflight.json` (30 min TTL).

---

# TOOL / FUNCTION MODE
[CLI examples, script rules, method docs.]

# ANALYSIS FRAMEWORK
[Skill-specific logic.]

# FINAL OUTPUT FORMAT
[Rigid markdown template.]
```

## Invocation matrix (reference)

| Scenario | Gate 1 | Gate 2 | Who runs |
|----------|--------|--------|----------|
| Full pipeline via `institutional-analyst` | 1× | 1× | Orchestrator only |
| Sub-agents when delegated | 0× | 0× | Skip both |
| Single skill standalone | 1× | 1× | That skill |
| RSS / non-Stockbit paths | 0× | 0× | Per skill SKILL.md |

See `ORCHESTRATION.md` for the full pipeline and `AGENTS.md` for runtime workspace rules.