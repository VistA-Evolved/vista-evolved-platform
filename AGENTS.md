# Agent and Developer Onboarding — VistA Evolved Platform

> **This file is the cross-tool root law for all AI coding agents and developers.**
> It applies to VS Code, Cursor, Claude Code, GitHub Copilot, ChatGPT, and any other tool.
> Tool-specific instruction files (CLAUDE.md, .cursor/rules/, .github/copilot-instructions.md)
> are thin shims that point back here. If they conflict with this file, this file wins.

> **Multi-root workspace note:** This AGENTS.md governs the `vista-evolved-platform` repo only.
> In a multi-root workspace, each repo has its own AGENTS.md. When you see `/AGENTS.md`
> references in this repo's files, they mean **this file**, not a sibling repo's AGENTS.md.
> The sibling repos (`VistA-Evolved` archive and `vista-evolved-vista-distro`) are self-governing.
> The archive repo's AGENTS.md is **reference material only** — it does not govern this repo.
>
> **Path disambiguation:** In task reports and all operator-facing outputs, use repo-prefixed
> paths (e.g., `vista-evolved-platform/AGENTS.md`) instead of bare paths (e.g., `/AGENTS.md`)
> to eliminate ambiguity when multiple repos are open in the same workspace.

---

## 0. NON-NEGOTIABLE RULES

1. **No uncontrolled feature generation.** Work one slice at a time. Complete verification and human review before the next slice.
2. **No claiming done without proof.** Proof = exact files changed + exact commands run + exact outputs + pass/fail. See `docs/reference/doc-governance.md` and `migrated-process-assets/verification-standard.md`.
3. **No silent mocks or stubs.** If real infrastructure is unavailable, return explicit `integration-pending` state. Never silently fake success.
4. **Commit, push, and report for passing bounded slices.** After each slice, produce the required proof package. If the slice is bounded, passes all validation, has no unresolved stop rules, and does not cross into ADR / major governance / architecture territory, the default is to commit and push in the same task, then report. Stop for explicit human approval only when: the user explicitly asked for a pause, a stop rule (§7 in the mutation protocol) remains unresolved, the change is materially risky or exceeds the approved bounded slice, or the change crosses into ADR / major governance / architecture territory. Do not proceed to the *next* slice until explicitly instructed.
5. **Terminal-first.** VistA Evolved is terminal-first. Do not build broad control-plane GUI or speculative product UI unless explicitly instructed.
6. **Repo files are the source of truth, not model memory.** Force alignment through files, contracts, CI, and merge gates.
7. **No documentation sprawl.** Only approved doc categories. See rule 2 below.
8. **VistA-only data and runtime truth for tenant-admin.** Every tenant-admin route reads from and writes to the live VistA system exclusively. No fixture files, no JSON fallbacks, no alternate data sources. If VistA is unreachable, return `{ok: false, source: "error"}`. Every route MUST be verified against the running VistA Docker container — reads must return real data, writes must be proven with read-back, edits must show the value changed, deletes must confirm removal. Code that was never tested against the live system is NOT done. See `.cursor/rules/40-vista-only-data-source.mdc`.

---

## 1. CORE POLICIES (by reference)

| Policy | Canonical location |
|--------|-------------------|
| Contract-first architecture | `docs/reference/contract-system.md`, `docs/reference/contract-policy.md` |
| Documentation model | `docs/reference/doc-governance.md`, `docs/reference/docs-policy.md` |
| Persistence | `docs/reference/persistence-policy.md` |
| Boundaries | `docs/reference/boundary-policy.md` |
| Ports | `docs/reference/port-registry.md` |
| Data ownership | `docs/reference/data-ownership-matrix.md` |
| Source of truth index | `docs/reference/source-of-truth-index.md` |
| Decision records | `docs/reference/decision-index.yaml`, `docs/adrs/` |
| Build protocol | `docs/explanation/governed-build-protocol.md` |
| AI governance & SDLC | `docs/explanation/ai-coding-governance-and-sdlc.md` |
| Notion sync policy | `docs/reference/notion-sync-policy.md` |

---

## 2. DOCUMENTATION MODEL

Approved top-level doc categories under `/docs`:
- **tutorials/** — Step-by-step learning paths
- **how-to/** — Task-oriented guides
- **reference/** — Technical references (policies, registries, indexes)
- **explanation/** — Architecture rationale, governance
- **adrs/** — Architecture decision records (enterprise-namespaced)
- **runbooks/** — Operational procedures

Approved support paths outside `/docs`:
- `/artifacts` — Evidence and verification outputs (gitignored where transient)
- `/prompts` — Active prompts and templates
- `/.github` — Workflows, CODEOWNERS, instructions
- `/.cursor` — Cursor rules
- `/scripts` — Governance checks, Notion sync, automation

**Forbidden:** `/reports`, `/docs/reports`, random audit folders, ad-hoc scratch docs, duplicate summaries. Evidence goes in `/artifacts`, not in `/docs`.

---

## 3. CONTRACT-FIRST DEVELOPMENT

- OpenAPI for HTTP APIs. Specs in `packages/contracts/openapi/`.
- AsyncAPI for events/WebSockets. Specs in `packages/contracts/asyncapi/`.
- JSON Schema for config and manifests. Specs in `packages/contracts/schemas/`.
- Generated SDKs preferred over hand-written HTTP calls.
- Breaking changes require an ADR and version bump.

---

## 4. PERSISTENCE

- No SQLite for persistent state.
- No in-memory for persistent state (caches and ephemeral state allowed where documented).
- VistA is source of truth where VistA owns the data.
- Platform database (PostgreSQL) for control-plane and integration concerns only.
- See `docs/reference/persistence-policy.md`.

---

## 5. TASK EXECUTION FORMAT

Every AI task response MUST include:

```
## Task Report
- **Objective:** what was requested
- **Files inspected:** list
- **Files changed:** list
- **Commands run:** list with outputs
- **Results:** pass/fail per step
- **Verified truth:** what was proven
- **Unverified areas:** what remains unproven
- **Risks:** known risks
- **Next step:** what comes next
```

> **Multi-root path rule:** All file paths in task reports must be repo-prefixed
> (e.g., `vista-evolved-platform/docs/adrs/VE-PLAT-ADR-0001-three-repo-architecture.md`)
> to avoid ambiguity when multiple repos are open in the same workspace.

---

## 6. ADR GOVERNANCE

- ADR IDs are enterprise-namespaced: `VE-PLAT-ADR-NNNN` for this repo.
- All ADRs must be registered in `docs/reference/decision-index.yaml`.
- See `docs/reference/decision-index.yaml` for the full registry.
- Cross-repo ADR namespaces: `VE-GOV-` (governance), `VE-ARCH-` (architecture), `VE-PLAT-` (platform), `VE-DISTRO-` (distro).

---

## 7. BOUNDARIES

- Bounded contexts in CODEOWNERS: `apps/control-plane/`, `apps/admin-console/`, `packages/contracts/`, `packages/config/`, `packages/domain/`, `packages/ui/`.
- Cross-boundary access via contracts only (OpenAPI, AsyncAPI, schemas). No direct imports between apps.
- Domain packages do not depend on apps or infrastructure.
