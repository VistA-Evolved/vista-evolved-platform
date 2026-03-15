# AI Coding Governance and SDLC

> How AI coding agents must operate inside the VistA Evolved Platform repo.

## Why this exists

AI coding tools (VS Code Copilot, Cursor, Claude Code, ChatGPT) can generate code faster than humans can verify it. Without governance, this produces surface area faster than truth. This document defines the operating rules that prevent drift.

## Governing principle

**Repo files are the source of truth, not model memory.**

AI agents must read repo files (AGENTS.md, doc-governance.md, decision-index.yaml, source-of-truth-index.md) before acting. They must not rely on training data or prior conversation context for repo-specific rules.

## Operating rules

### 1. Read before write

Before any task, the AI must:
1. Read `/AGENTS.md` for root governance.
2. Read relevant policy files from `/docs/reference/`.
3. Inventory files that will be affected.
4. List planned changes before executing.

### 2. One slice at a time

Do not batch multiple features. Complete one slice, verify it, report it, and stop. Wait for human review before the next slice.

### 3. Proof required

Every AI task response must include:
- Objective
- Files inspected
- Files changed
- Commands run (with outputs)
- Results (pass/fail per step)
- Verified truth
- Unverified areas
- Risks
- Next step

### 4. No silent fallbacks

If infrastructure is unavailable, return explicit `integration-pending`. Never silently substitute mocks, stubs, or fake data.

### 5. No scope creep

- Do not refactor unrelated code.
- Do not add features that were not requested.
- Do not create new doc categories.
- Do not create speculative APIs or UI.
- If a request seems ambiguous, ask for clarification rather than guessing broadly.

### 6. Contract-first

API changes must start with spec updates in `packages/contracts/`. Implementation follows the spec. Breaking changes require an ADR.

### 7. Approved tool instruction files

| Tool | Instruction file | Role |
|------|-----------------|------|
| All tools | `/AGENTS.md` | Root law |
| Claude Code | `/CLAUDE.md` | Thin shim → AGENTS.md |
| Cursor | `/.cursor/rules/*.mdc` | Scoped rules → AGENTS.md |
| GitHub Copilot | `/.github/copilot-instructions.md` | Repo-specific → AGENTS.md |
| Copilot (scoped) | `/.github/instructions/*.instructions.md` | Path-scoped rules |

If any tool-specific file conflicts with AGENTS.md, AGENTS.md wins.

## Anti-patterns to prevent

| Anti-pattern | Prevention |
|-------------|-----------|
| Documentation sprawl | CI gate checks doc roots |
| ADR ID collision | Enterprise-namespaced IDs + decision-index.yaml |
| Phantom features (code that was never run) | Proof required in task reports |
| Model memory drift | Repo files are source of truth |
| Broad GUI generation | Terminal-first rule in AGENTS.md |
| Evidence mixed into docs | CI gate checks artifact placement |
