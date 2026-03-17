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

### 7. Self-audit before completion

After coding and before claiming a slice is done, the AI must:

1. Re-read all changed files in full.
2. Check each changed file for alignment drift against governing artifacts (AGENTS.md, contracts, planning chain, policies).
3. Fix any discovered inconsistencies immediately if they are within the current slice’s scope. If out of scope, document in the task report and flag for a separate slice.
4. Run existing validation/checks (schema validation, lint, governance gates).
5. If the slice touches user-visible UI: bring it up in the browser or terminal when feasible, inspect it for developer leakage / placeholder text / broken states, and capture proof.
6. Confirm in the task report that self-audit was performed.

Do not skip self-audit because the code "looks right" or "compiled fine."

### 8. No user-visible developer leakage

User-visible surfaces must never contain:

- `TODO`, `FIXME`, `implementation pending`, or similar unfinished markers
- Placeholder scaffolding text
- Developer comments accidentally rendered in UI
- Raw RPC names (e.g., `ORWPS ACTIVE`)
- Raw internal IDs, debug labels, or VistA file references (e.g., `File 200`)
- Raw stack traces or internal exception text
- Any obviously developer-facing language that should not appear to users

Internal identifiers may appear in developer/admin consoles, logs, and audit trails. They must never appear in clinical, patient-facing, or general user-facing surfaces.

If a feature is incomplete, return explicit `integration-pending` state through the governed API—do not render unfinished markers as UI text.

### 9. No ad-hoc verifier-script sprawl

Do not create one-off per-task verification scripts when existing checks, direct self-review, schema validation, linting, browser proof, or existing governance scripts are sufficient.

A new persistent verifier script is allowed only when it is:
- reusable across multiple slices,
- canonical (belongs in `scripts/governance/` or the repo’s checking model),
- justified as a durable anti-drift control rather than a task-local convenience artifact.

### 10. Approved tool instruction files

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
| User-visible developer leakage (TODO, raw RPCs, stack traces in UI) | Self-audit + browser proof + A13/A15/A16 in mutation protocol |
| Ad-hoc verifier-script sprawl | Rule 9 above; A14 in mutation protocol |
| Placeholder/unfinished text shipped in UI | Rule 8 above; A15 in mutation protocol |
