# Contract Mutation and Implementation Governance Protocol

> **Status:** Accepted.
> **Date:** 2026-03-17.
> **Type:** Reference / governance protocol.
> **Repo:** `vista-evolved-platform`.
> **Owner:** This file is governed by AGENTS.md §0 and registered in `docs/reference/source-of-truth-index.md`.

---

## 1. Purpose

This document defines the **operating protocol for how changes flow from planning artifacts through contracts to implementation** in VistA Evolved Platform.

It answers three questions:

1. **Before I write code, which upstream artifacts must I update?**
2. **What is the exact order of operations for a governed change?**
3. **What stops me from merging if I skip a step?**

It applies to all contributors — AI coding agents (VS Code Copilot, Cursor, Claude Code, ChatGPT) and human developers alike.

---

## 2. Inputs consumed

This protocol consumes and enforces rules from the following canonical files:

| # | Input | Location | What this protocol enforces from it |
|---|-------|----------|-------------------------------------|
| 1 | Root governance | `AGENTS.md` | Non-negotiable rules §0: one slice, proof-first, repo files are SoT, no silent mocks |
| 2 | AI coding SDLC | `docs/explanation/ai-coding-governance-and-sdlc.md` | Read-before-write, one-slice, proof, no scope creep, contract-first |
| 3 | Build protocol | `docs/explanation/governed-build-protocol.md` | Contract-first, config as code, docs policy, persistence, proof artifacts |
| 4 | Contract system | `docs/reference/contract-system.md` | 5 contract layers, breaking-change ADR rule |
| 5 | Contract policy | `docs/reference/contract-policy.md` | OpenAPI, AsyncAPI, JSON Schema, no ad-hoc clients |
| 6 | Boundary policy | `docs/reference/boundary-policy.md` | Bounded contexts, cross-boundary via contracts only |
| 7 | Persistence policy | `docs/reference/persistence-policy.md` | No SQLite, no in-memory persist, VistA is clinical SoT |
| 8 | Data ownership matrix | `docs/reference/data-ownership-matrix.md` | Clinical → VistA, governance → platform |
| 9 | Documentation governance | `docs/reference/doc-governance.md` | 6 approved doc categories, forbidden paths, evidence in /artifacts |
| 10 | Architecture backbone | `docs/explanation/global-system-architecture-spec.md` | 10 anti-goals (§4), planes (§7), one-truth-bearing runtime (§6) |
| 11 | Workspace map | `docs/explanation/information-architecture-workspace-map.md` | 7 workspace families, boundary rules, screen-contract implications |
| 12 | Screen inventory | `docs/reference/screen-inventory.md` | Surface enumeration, planning-only fields, evidence postures |
| 13 | Permissions matrix | `docs/reference/permissions-matrix.md` | Role × surface × action decisions |
| 14 | Pack visibility rules | `docs/reference/pack-visibility-rules.md` | Visibility postures, resolution order, pack-family dependencies |
| 15 | Screen contract schema | `packages/contracts/schemas/screen-contract.schema.json` | Machine-readable surface contract format |
| 16 | Decision index | `docs/reference/decision-index.yaml` | ADR registry |

---

## 3. Non-goals

This document does **NOT**:

1. **Authorize implementation.** This protocol governs how changes must flow. It does not authorize building product UI, routes, APIs, or features.
2. **Redefine architecture.** It does not amend, override, or restate the global system architecture spec, workspace map, or any other accepted spec.
3. **Replace contract-system.md.** The contract system defines the 5 contract layers and their formats. This protocol defines the mutation workflow that uses those layers.
4. **Replace planning artifacts.** The screen inventory, permissions matrix, and pack visibility rules are separate canonical documents. This protocol defines when they must be updated — it does not contain their content.
5. **Implement CI gates or code.** This protocol is human-readable governance. It identifies where future CI gates should exist (§14) but does not implement them.
6. **Introduce new product scope.** No new surfaces, APIs, events, or features are defined or implied by this document.

---

## 4. Governing principles

These principles are not new — they are collected from existing governance files for operational convenience. The originating file is authoritative if any wording diverges.

| # | Principle | Origin |
|---|-----------|--------|
| P1 | **Repo files are the source of truth, not model memory.** AI agents must read repo files before acting and must not rely on training data for repo-specific rules. | AGENTS.md §0.6 |
| P2 | **One slice at a time.** Complete verification and human review before the next slice. | AGENTS.md §0.1 |
| P3 | **Proof-first.** Every claim of "done" requires exact files changed, commands run, outputs, pass/fail. No unproven claims. | AGENTS.md §0.2 |
| P4 | **No silent fallbacks.** If infrastructure is unavailable, return explicit `integration-pending`. Never fake success. | AGENTS.md §0.3 |
| P5 | **Contract-first.** APIs, events, config, and surfaces are defined in machine-readable contracts before implementation. | VE-PLAT-ADR-0002, contract-system.md |
| P6 | **No shadow clinical persistence.** Platform must not replicate VistA-owned clinical data as a system of record. | persistence-policy.md, global-arch §6 |
| P7 | **No boundary crossing without contract.** Cross-boundary access is via OpenAPI, AsyncAPI, or JSON Schema contracts. No direct imports between bounded contexts. | boundary-policy.md |
| P8 | **No implementation of a new thing before its owning artifact is updated.** The planning/contract artifact that governs the new thing must be updated and reviewed before any code implementing that thing is written. | **This protocol (new rule, derived from P1 + P2 + P5)** |
| P9 | **No documentation sprawl.** Only approved doc categories (tutorials, how-to, reference, explanation, ADRs, runbooks). Evidence goes in `/artifacts`. | doc-governance.md |
| P10 | **Breaking changes require an ADR.** Any change that breaks an existing contract, removes a surface, changes a boundary, or alters data ownership must have an accepted ADR before implementation. | contract-system.md, decision-index.yaml |

---

## 5. Change-classification matrix

Every change to the VistA Evolved Platform must be classified into one or more of the following change types. Each change type requires specific upstream artifacts to be updated **before code is written.**

### 5.1 The matrix

| # | Change type | Required upstream artifact updates (before code) | Contract layer affected |
|---|-------------|--------------------------------------------------|------------------------|
| C1 | **New screen or surface** | Screen inventory → permissions matrix → pack visibility rules (if pack-sensitive) → screen-contract JSON instance | Screen contract |
| C2 | **Changed screen or surface** (scope, roles, write-posture, data classification, workspace affiliation) | Screen inventory → permissions matrix (if role/action changes) → pack visibility rules (if visibility changes) → screen-contract JSON instance | Screen contract |
| C3 | **New HTTP API route or changed API shape** | OpenAPI spec in `packages/contracts/openapi/` | API contract |
| C4 | **New async event or WebSocket message** | AsyncAPI spec in `packages/contracts/asyncapi/` | Event/Async contract |
| C5 | **New config shape, manifest shape, or module schema** | JSON Schema in `packages/contracts/schemas/` | Config/Runtime contract |
| C6 | **New capability pack or pack-family shape** | Capability manifest schema → pack visibility rules (if visibility affected) | Capability contract |
| C7 | **New adapter boundary or changed adapter interface** | Adapter interface type definition → boundary-policy alignment check → OpenAPI or AsyncAPI if the adapter exposes an API surface | API + Capability contract |
| C8 | **New persistence or data-ownership implication** | Data-ownership-matrix → persistence-policy alignment check → ADR if a new persistent store is introduced or if data ownership shifts | N/A (governance) |
| C9 | **Workspace-boundary change** (new workspace, merged workspaces, changed workspace affiliation) | Workspace map amendment → screen inventory (affected surfaces) → permissions matrix → pack visibility rules → ADR required | Screen contract + governance |
| C10 | **Breaking change to existing contract** | ADR (accepted before code) → affected contract specs updated → version bump → downstream contract consumers identified | Any |
| C11 | **New decision requiring architectural record** | ADR authored → registered in decision-index.yaml → human review before any implementation | N/A (governance) |
| C12 | **New tenant or deployment-topology implication** | Data-ownership-matrix check → persistence-policy check → relevant config schema update | Config/Runtime contract |
| C13 | **Planning-artifact correction** (fixing a contradiction or gap in an existing planning artifact) | Identify the contradiction → fix the upstream artifact(s) → re-check all downstream artifacts that consume the corrected input → validate affected contracts | Depends on artifact |

### 5.2 Reading the matrix

- **Arrows (→)** indicate order: the artifact on the left must be updated before the artifact on the right.
- If a change spans multiple types (e.g., a new surface that also introduces a new API), apply all applicable rows. The union of required upstream artifacts must be satisfied.
- If a required upstream artifact does not yet exist for the repo (e.g., no OpenAPI spec yet for a new API domain), creating the spec is part of the required upstream work — not something to defer.

### 5.3 Planning-artifact chain

The following artifacts form the canonical planning chain. Each artifact consumes its predecessors:

```
Global system architecture spec
  └── Workspace map (information architecture)
        └── Screen inventory
              ├── Permissions matrix
              ├── Pack visibility rules
              └── Screen-contract JSON instances
```

When a change requires updating an artifact in this chain, all downstream artifacts that consume it must be re-checked for alignment. This is not optional.

---

## 6. Required upstream-artifact detail per change type

### C1 — New screen or surface

**Before writing any code for a new surface:**

1. Add the surface to `docs/reference/screen-inventory.md` in the correct workspace family section.
2. Add the surface to `docs/reference/permissions-matrix.md` with role × action decisions for all 7 role categories.
3. If the surface has `packVariationSensitivity` other than `none`, add it to `docs/reference/pack-visibility-rules.md`.
4. Author a screen-contract JSON instance in `packages/contracts/screen-contracts/{surfaceId}.json` conforming to the schema.
5. Validate the contract against the schema: `npx ajv-cli validate -s packages/contracts/schemas/screen-contract.schema.json -d "packages/contracts/screen-contracts/{surfaceId}.json" --spec=draft2020`.
6. Cross-check the contract against the inventory, permissions matrix, and pack visibility rules for consistency.

**Only after steps 1–6 pass** may implementation code be written.

### C3 — New HTTP API route or changed API shape

**Before writing any route handler or controller:**

1. Define or update the OpenAPI spec in `packages/contracts/openapi/`.
2. If the API serves a surface governed by a screen contract, verify the screen contract's `dataSources` declarations align.
3. If this is a breaking change, follow C10 (ADR required first).

### C4 — New async event or WebSocket message

**Before writing any event publisher or subscriber:**

1. Define or update the AsyncAPI spec in `packages/contracts/asyncapi/`.
2. If the event crosses a bounded-context boundary, verify boundary-policy alignment.
3. If this is a breaking change, follow C10 (ADR required first).

### C5 — New config shape

**Before writing any code that reads or writes the new config:**

1. Define or update the JSON Schema in `packages/contracts/schemas/`.
2. If the config shape affects capability manifests, verify capability-manifest schema alignment.

### C8 — New persistence or data-ownership implication

**Before writing any persistence code:**

1. Check `docs/reference/data-ownership-matrix.md` — does the new entity fit an existing ownership row, or does it require a new row?
2. Check `docs/reference/persistence-policy.md` — does the proposed storage mechanism comply (no SQLite, no in-memory for persistent state, no clinical data in platform PG)?
3. If a new persistent store is introduced or data ownership shifts, author an ADR first (C11).

### C9 — Workspace-boundary change

Any change to the 7-workspace-family model is a high-impact architectural change.

1. Author an ADR (C11) justifying the boundary change.
2. Amend the workspace map.
3. Update the screen inventory for all affected surfaces.
4. Update the permissions matrix for all affected role × surface decisions.
5. Update pack visibility rules for all affected visibility postures.
6. Re-validate all affected screen-contract JSON instances.

### C10 — Breaking change

1. Author an ADR before any code. Register in `docs/reference/decision-index.yaml`.
2. Explicitly identify all downstream consumers of the broken contract.
3. Update the contract spec with the breaking change and bump the version.
4. Update all consuming artifacts (screen contracts, planning docs, config schemas, etc.).
5. Human review is mandatory before merge.

### C13 — Planning-artifact correction

When a contradiction or gap is found in an existing planning artifact:

1. Identify the contradiction and the affected chain of artifacts.
2. Fix the upstream artifact first (the one that other artifacts consume).
3. Re-check all downstream artifacts that reference the corrected artifact.
4. Re-validate any screen-contract JSON instances affected by the correction.
5. Commit the corrected artifacts together in one atomic commit — do not land a correction that leaves downstream artifacts inconsistent.

---

## 7. Stop-and-escalate rules

These rules define hard stops. When a stop rule fires, the developer or AI agent must halt the current task and address the stop condition before continuing.

### 7.1 Stop rules

| # | Condition | Required action |
|---|-----------|-----------------|
| S1 | **Missing upstream artifact.** The change requires an upstream artifact (per §5 matrix) that does not exist yet. | Stop. Create the upstream artifact first. Do not write implementation code until the artifact exists, is reviewed, and passes validation. |
| S2 | **Contradiction in planning chain.** The change reveals a contradiction between two planning artifacts (e.g., screen inventory says X, permissions matrix says not-X). | Stop. Fix the contradiction in the upstream artifacts first (per C13). Do not paper over the contradiction in code. |
| S3 | **Boundary violation.** The change requires importing code across a bounded-context boundary without a contract. | Stop. Define the contract first (per C3, C4, or C5). Do not bypass the boundary with a direct import. |
| S4 | **Persistence policy violation.** The change introduces SQLite, in-memory persistent state, JSON-file mutable store, or clinical data in platform PG. | Stop. Redesign to comply with persistence-policy.md. If the architecture genuinely requires an exception, author an ADR first. |
| S5 | **Data-ownership violation.** The change stores data in a location that contradicts data-ownership-matrix.md. | Stop. Check whether the data-ownership-matrix needs updating (requires ADR) or whether the code needs redesigning. |
| S6 | **Breaking change without ADR.** The change modifies an existing contract in a backward-incompatible way without an accepted ADR. | Stop. Author the ADR first. Do not ship the breaking change without the ADR accepted and registered. |
| S7 | **Scope exceeds the current slice.** While implementing one slice, the developer discovers work that belongs to a different slice. | Stop. Report the discovered work in the task report's "Next step" section. Do not fold it into the current slice. |
| S8 | **Screen or surface without contract.** Code implementing a user-facing surface has no corresponding screen-contract JSON instance. | Stop. Author the screen contract first (per C1). |
| S9 | **AI agent discovers stale model memory.** The AI agent's behavior or output contradicts what repo files say. | Stop. Re-read the governing repo files. Align to repo truth. Report the discrepancy in the task report. |
| S10 | **Human review required.** The current slice is complete and needs human review before the next slice can begin. | Stop. Produce the task report. Do not proceed to the next slice until the human explicitly approves. |

### 7.2 Escalation path

When a stop rule fires:

1. **Document the stop** in the task report: which rule fired, what the condition was, what action was taken.
2. **Fix forward when possible.** If the stop can be resolved by updating upstream artifacts within the current slice's scope (e.g., adding one missing row to the permissions matrix), do so.
3. **Report and wait when fix-forward exceeds scope.** If the fix requires a separate slice (e.g., authoring a new ADR, designing a new contract layer), report the discovery and stop.

---

## 8. Order of operations — artifact-first, code, proof

Every governed change follows this order:

### Phase A — Artifact update

1. Classify the change (§5 matrix).
2. Identify all required upstream artifacts.
3. Update the upstream artifacts in dependency order (upstream → downstream in the planning chain, §5.3).
4. Validate updated artifacts (schema validation, cross-check, human review where required).

### Phase B — Implementation

5. Write implementation code that aligns to the updated artifacts.
6. Do not introduce scope beyond what the artifacts declare.

### Phase C — Self-audit and proof

7. **Self-audit.** Re-read all changed files. Check for alignment drift against governing artifacts (planning chain, contracts, policies). Fix any discovered inconsistencies immediately if they are within the current slice’s scope. If out of scope, document in the task report and flag for a separate slice.
8. **UI hygiene check.** If the slice touches user-visible surfaces, bring the surface up in a browser or terminal when feasible. Inspect it for user-visible developer leakage: TODO/FIXME markers, placeholder text, raw RPC names, raw internal IDs, stack traces, developer comments rendered in UI, or obviously broken states. Fix before proceeding.
9. Run validation (schema checks, lint, type checks).
10. Run relevant existing verification scripts.
11. Produce runtime proof where applicable (live tests, browser proof, terminal proof).
12. Produce the task report (§10).

### Phase D — Commit, push, and review

13. If the slice is bounded, passes all validation and self-audit, has no unresolved stop rules (§7), and does not cross into ADR / major governance / architecture territory, commit and push in the same task.
14. Stop for explicit human approval only when: the user explicitly asked for a pause, a stop rule remains unresolved, the change is materially risky or exceeds the approved bounded slice, or the change crosses into ADR / major governance / architecture territory.
15. Do not start the next slice until the human explicitly instructs.

---

## 9. Definition of done for a governed slice

A slice is **done** when ALL of the following are true:

| # | Requirement | Verification method |
|---|-------------|-------------------|
| D1 | All required upstream artifacts are updated (per §5 matrix). | Reviewer checks the change-classification and artifact list. |
| D2 | Updated artifacts are internally consistent (no contradictions in the planning chain). | Cross-check between inventory, permissions matrix, pack visibility, and screen contracts. |
| D3 | Any new or modified screen contracts pass schema validation. | `npx ajv-cli validate` against the schema. |
| D4 | Any new or modified OpenAPI/AsyncAPI/JSON Schema specs are syntactically valid. | Standard linting/validation tools for those formats. |
| D5 | Implementation code aligns to the updated artifacts (no drift). | Reviewer cross-checks code against contracts. |
| D6 | No stop rules (§7) are unresolved. | Task report explicitly lists stop rules checked. |
| D7 | Runtime proof is produced where applicable (live test, browser test, terminal test). | Proof artifacts in `/artifacts` or shown in task report. |
| D8 | Task report is produced with all required sections (per AGENTS.md §5). | Reviewer checks report completeness. |
| D9 | Human review is complete and approval is explicit. | Approval in review comments or conversation. |
| D10 | No unresolved contract drift (implementation matches contracts). | Reviewer spot-checks. |
| D11 | No user-visible developer leakage: no TODO/FIXME/placeholder text, no raw RPC names, no raw internal IDs or debug labels, no stack traces in any user-facing surface. | Self-audit + browser/terminal proof where applicable (A13, A15, A16). |
| D12 | Self-audit completed: all changed files re-read, alignment checked against governing artifacts, inconsistencies fixed within scope. | Coder/agent confirms in task report. |
| D13 | For slices that touch user-visible UI: browser or terminal proof captured showing no developer leakage, broken states, or placeholder text. | Screenshot, terminal output, or explicit confirmation in task report. |
| D14 | No ad-hoc verifier scripts created when existing checks sufficed. Any new script is justified as a durable anti-drift control. | Reviewer checks for unnecessary new scripts (A14). |

A slice is **NOT done** if:

- Upstream artifacts were not updated but should have been.
- Schema validation was not run.
- The task report is missing.
- Proof was required but not produced.
- A stop rule fired and was not resolved.
- The slice was expanded beyond its approved scope.
- User-visible surfaces contain developer leakage (TODO/FIXME, raw RPC names, internal IDs, stack traces, placeholder text).
- Self-audit was not performed (changed files not re-read, alignment not checked).
- Browser/terminal proof was required (UI-touched slice) but not captured.
- An ad-hoc verifier script was created when existing checks sufficed.

---

## 10. Proof-package requirements

Every task report (per AGENTS.md §5) must include:

| Section | Content |
|---------|---------|
| **Objective** | What was requested. |
| **Files inspected** | Full list of files read before editing. |
| **Files changed** | Full list of files created or modified. |
| **Commands run** | Exact commands with exact outputs (truncated only for length, never omitted). |
| **Results** | Pass/fail per step. |
| **Verified truth** | What was proven by evidence. |
| **Unverified areas** | What remains unproven and why. |
| **Risks** | Known risks. |
| **Next step** | What should happen next. |

For governance/planning slices (artifact authoring, contract writing), the proof package must also include:

| Additional item | Content |
|-----------------|---------|
| **Change classification** | Which rows from §5 apply. |
| **Upstream artifacts updated** | Which planning/contract artifacts were modified. |
| **Cross-check results** | Confirmation that downstream artifacts consuming the modified artifacts were re-checked. |
| **Schema validation output** | If contracts were created or modified, the exact validation command and output. |
| **KEEP-SAFE audit** | Confirmation that no unauthorized scope was added (UI code, API code, runtime code, sibling-repo edits, etc.). |

---

## 11. Merge-blocking conditions

A change **must not be merged or pushed** to `main` if any of the following conditions are true:

| # | Blocking condition |
|---|-------------------|
| M1 | A required upstream artifact (per §5 matrix) was not updated. |
| M2 | A screen-contract JSON instance fails schema validation. |
| M3 | A planning-artifact contradiction was introduced or left unresolved. |
| M4 | A breaking change has no accepted ADR. |
| M5 | The task report is missing or incomplete. |
| M6 | Human review has not been completed for slices that require explicit approval (ADR territory, materially risky changes, user-requested pause, unresolved stop rules). |
| M7 | A stop rule (§7) fired and was not resolved. |
| M8 | Evidence of proof (runtime, validation, cross-check) is absent. |
| M9 | The change introduces documentation outside approved categories (doc-governance.md). |
| M10 | The change modifies a sibling repo that the current task was not authorized to edit. |

---

## 12. Known anti-patterns

These anti-patterns are explicitly prohibited. Each corresponds to real failure modes observed in VistA Evolved development.

| # | Anti-pattern | Why it fails | Prevention |
|---|-------------|-------------|------------|
| A1 | **Fake success payloads.** Returning `{ok: true}` with fabricated or placeholder data when the real data source is unavailable. | Users and downstream consumers believe the data is real. Masks integration gaps. | Return explicit `integration-pending` state (AGENTS.md §0.3). |
| A2 | **Fallback default data on backend failure.** Silently substituting canned data when an API call or VistA RPC fails. | Same as A1 — silent mocks create false confidence. | Fail visibly. Return error or pending state. Never silently substitute. |
| A3 | **Duplicate truth sources without declared migration.** Creating a new store for data that VistA already owns, without an ADR and migration plan. | Creates shadow clinical database. Violates one-truth-bearing principle. | Check data-ownership-matrix.md before introducing any persistent store (S5). |
| A4 | **Hardcoded config instead of schema/config source.** Embedding configuration values (ports, URLs, feature flags, tenant settings) directly in application code instead of reading from governed config schemas. | Config becomes invisible and unreviewable. Drift between environments is silent. | Config values come from `packages/config/` or environment variables documented in `packages/contracts/schemas/`. |
| A5 | **UI wired to nonexistent endpoints.** Building a frontend surface that calls API routes that do not exist yet. | UI appears functional but does nothing. Creates phantom features. | Screen contract`dataSources` must reference existing or explicitly-pending API contracts (C3 must precede or accompany C1). |
| A6 | **Broad file/blob edits that exceed safe reviewability.** Changing dozens of files across multiple concerns in one commit, making human review impractical. | Review fatigue leads to undetected drift. Contradictions slip through. | One slice at a time (P2). Bounded scope. Reviewer must be able to verify every changed file. |
| A7 | **Untracked cross-surface coupling.** One surface silently depending on another surface's data, state, or behavior without a declared `crossWorkspaceTransitions` or API contract. | Invisible coupling. Breaking one surface breaks the other with no traceability. | Cross-workspace transitions declared in screen contracts. Cross-surface data flows through APIs with contracts. |
| A8 | **"Integration pending" in user-visible paths without plan.** Displaying "integration pending" indefinitely with no grounded plan for resolution. | Perpetual placeholders erode trust and mask missing design work. | Every `integration-pending` state must have a `vistaGrounding` or equivalent reference identifying what must be resolved and where the resolution path lives. |
| A9 | **Code without contract.** Writing implementation code for a surface, API, event, or config shape that has no corresponding contract or planning-artifact entry. | No governance anchor. No way to verify alignment. Drift is undetectable. | Stop rule S8 (screen/surface) or the relevant §5 row for APIs/events/config. |
| A10 | **Artifact updated but downstream not re-checked.** Fixing a planning artifact but not verifying that all artifacts consuming it are still consistent. | Partial fix leaves the chain inconsistent. The next developer inherits a contradiction. | C13 requires re-checking all downstream artifacts after any upstream correction. |
| A11 | **AI agent acting on stale memory.** An AI agent using training data or prior conversation context instead of reading current repo files. | Model memory diverges from repo truth. Generates code that contradicts current governance. | P1 (repo files are SoT) + S9 (stop and re-read). |
| A12 | **Claiming done without proof.** Marking a task complete without producing the proof package (§10). | Unverified claims accumulate. Problems surface late. | D7 (runtime proof), D8 (task report), M8 (merge-blocking). |
| A13 | **User-visible developer leakage.** Shipping or demoing a user-visible surface that contains TODO, FIXME, `implementation pending`, placeholder scaffolding text, developer comments accidentally rendered in UI, raw RPC names, raw internal IDs or debug labels, raw stack traces or internal exception text, or any obviously unfinished-marker language visible to the user. | Users see developer internals. Erodes trust. Signals unfinished work. Leaks system architecture. | Self-audit step (Phase C-2). Browser/terminal proof for UI-touched slices. Surface must present only governed, user-appropriate content. |
| A14 | **Ad-hoc verifier-script sprawl.** Creating a one-off per-task verification script when existing checks, direct self-review, schema validation, linting, browser proof, or existing governance scripts are sufficient. | Repo accumulates disposable scripts. Maintenance burden grows. Governance model fragments. | A new persistent verifier script is allowed only when it is reusable, canonical, belongs in the repo’s governance/checking model, and is justified as a durable anti-drift control rather than a task-local convenience artifact. |
| A15 | **Placeholder or TODO text in product surfaces.** Leaving `TODO`, `FIXME`, `implementation pending`, `not yet implemented`, or similar unfinished markers in user-facing UI text, labels, messages, or dialogs. | Users encounter developer-facing language. Signals the product is unfinished. Masks missing design work. | Every user-visible string must be final or the surface must not ship. If the feature is incomplete, return explicit `integration-pending` state through the governed API—do not render it as UI text. |
| A16 | **Raw internal identifiers in user-visible UI.** Displaying raw RPC names (e.g., `ORWPS ACTIVE`), raw VistA file references (e.g., `File 200`), internal route paths, debug log labels, MUMPS error codes, or stack traces in any surface visible to end users. | Leaks system internals. Confuses users. Potential security concern. | Internal identifiers may appear in developer/admin consoles, logs, and audit trails. They must never appear in clinical, patient-facing, or general user-facing surfaces. |

---

## 13. Relationship between planning artifacts and implementation artifacts

### 13.1 Planning artifacts

Planning artifacts define the architecture, constraints, and governance rules. They are updated **before** implementation.

| Artifact type | Examples | Location |
|--------------|---------|----------|
| Architecture specs | Global system architecture, workspace map, pack-adapter governance, capability truth, country-payer, specialty-content-analytics, AI-assist safety | `docs/explanation/` |
| Planning references | Screen inventory, permissions matrix, pack visibility rules, data-ownership matrix, persistence policy, boundary policy | `docs/reference/` |
| Decision records | ADRs (VE-PLAT-ADR-NNNN) | `docs/adrs/` |
| Governance protocols | This document, AI coding governance, governed build protocol, doc governance | `docs/reference/`, `docs/explanation/` |

### 13.2 Contract artifacts

Contract artifacts are machine-readable specifications that implementation code must conform to.

| Artifact type | Examples | Location |
|--------------|---------|----------|
| API contracts | OpenAPI specs | `packages/contracts/openapi/` |
| Event contracts | AsyncAPI specs | `packages/contracts/asyncapi/` |
| Config/manifest schemas | JSON Schema specs | `packages/contracts/schemas/` |
| Screen contracts | Per-surface JSON instances | `packages/contracts/screen-contracts/` |
| Capability manifests | Module/capability config | `packages/contracts/capability-manifests/` |

### 13.3 Implementation artifacts

Implementation artifacts are code, components, and runtime configuration.

| Artifact type | Examples | Location |
|--------------|---------|----------|
| Applications | Control plane, admin console, terminal proof | `apps/` |
| Domain packages | Admin, tenancy types and rules | `packages/domain/` |
| Config packages | Port config, module config | `packages/config/` |
| UI package | Shared components | `packages/ui/` |

### 13.4 The flow

```
Planning artifacts   →   Contract artifacts   →   Implementation artifacts
  (human-readable)         (machine-readable)         (code)

  Updated first.           Updated second.            Written last.
  Reviewed first.          Validated by schema.       Verified against contracts.
```

Changes flow left-to-right. Planning artifacts are never backfilled from implementation — they lead, not follow.

---

## 14. Handoff to future CI enforcement

The following governance rules from this protocol are candidates for automated CI gate enforcement. This section identifies them; it does **not** implement them.

| # | Rule | CI gate candidate | Current enforcement |
|---|------|-------------------|-------------------|
| G1 | Screen contract schema validation | `ajv-cli validate` in CI on PR | Manual (developer runs command) |
| G2 | New surface has entry in screen inventory | Grep screen-contract surfaceId against screen-inventory.md | Manual (reviewer cross-checks) |
| G3 | New surface has entry in permissions matrix | Grep surfaceId against permissions-matrix.md | Manual (reviewer cross-checks) |
| G4 | OpenAPI spec exists for new API routes | Scan route files for undeclared endpoints | Manual (reviewer cross-checks) |
| G5 | ADR exists for breaking changes | Check decision-index.yaml against changed contract files | Manual (reviewer checks) |
| G6 | No forbidden doc paths | Check for `/reports`, `/docs/reports`, etc. | Existing CI gate (`governance-gates.yml`) |
| G7 | SoT index references new artifacts | Check source-of-truth-index.md for new canonical files | Manual (reviewer checks) |
| G8 | No cross-boundary imports without contract | Nx module boundary rules when adopted | Manual (reviewer checks) |
| G9 | Planning-artifact chain consistency | Automated cross-reference between inventory, permissions, pack-visibility, and contracts | Not yet feasible (complex) |

Implementation of these CI gates is a future bounded slice. This protocol provides the rule definitions they will enforce.

---

## 15. Scope of this document

### 15.1 What this document governs

- The mutation workflow for all change types in `vista-evolved-platform`.
- The stop rules and order of operations for AI and human developers.
- The definition of done and merge-blocking conditions.

### 15.2 What this document does not govern

- VistA runtime, MUMPS routines, or distro build/verify (governed by `vista-evolved-vista-distro/AGENTS.md`).
- Archive repo content (read-only reference).
- Product roadmap or feature authorization.
- Inside-VistA authorization (menu options, security keys, person classes).
- CI/CD pipeline implementation details.

---

## 16. Document maintenance

This document should be reviewed and updated when:

- A new contract layer is added to the contract system.
- A new planning artifact is introduced to the planning chain.
- A new workspace family is added to the workspace map.
- CI gates are implemented that enforce rules from §14.
- A governance gap is discovered during a task that this protocol should have caught.

Amendments follow the standard governed-build protocol: propose the change, review, approve, commit.
