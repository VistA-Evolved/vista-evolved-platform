# Control-Panel Design Contract — v2

> **Status:** Draft
> **Scope:** 21 canonical control-plane surfaces across 7 shell domain groups
> **Audience:** Design reviewers, implementation engineers, QA
> **Not authorized:** This document defines design constraints and review criteria; it does not authorize runtime implementation or UI code.
> **Supersedes:** Batch-1 design contract (`control-panel-design-contract-and-static-review-prototype-batch-1.md`) for per-surface layout regions. Batch-1 §4 cross-surface rules remain valid and are extended here.

---

## 1. Purpose and position in handoff chain

This document is the **design contract** for all 21 control-plane operator-console surfaces. It bridges:

- **Upstream inputs:** Page specs v2, action semantics v2, service-map architecture, IA/wireframe v2, screen-contract instances, OpenAPI/AsyncAPI contracts
- **Downstream consumers:** Shell implementation (app.js), screen-contract Batch A+ authoring, QA reviewers

For each surface, this document specifies:

1. **Layout regions** — named zones with data-binding references
2. **Reject/ready review checklists** — pass/fail criteria for design review
3. **Interaction patterns** — how operator actions map to UI affordances
4. **Data freshness contracts** — when and how data refreshes

### 1.1 Governing references

| Reference | Location |
|-----------|----------|
| Page specs v2 (21 surfaces) | `docs/explanation/control-panel-page-specs-v2.md` |
| Action semantics v2 (21 surfaces) | `docs/explanation/control-panel-action-semantics-v2.md` |
| Service-map architecture | `docs/explanation/control-plane-service-map-and-operator-console-architecture.md` |
| Tenant lifecycle model | `docs/explanation/control-plane-tenant-lifecycle-and-orchestration-model.md` |
| IA/wireframe v2 | `docs/explanation/control-panel-information-architecture-and-wireframe-contract-v2.md` |
| Screen-contract instances | `packages/contracts/screen-contracts/control-plane.*.json` |
| OpenAPI contract | `packages/contracts/openapi/control-plane-operator-bootstrap-and-provisioning.openapi.yaml` |
| AsyncAPI contract | `packages/contracts/asyncapi/control-plane-provisioning-events.asyncapi.yaml` |
| Screen inventory §9 | `docs/reference/screen-inventory.md` §9.1–§9.21 |
| Permissions matrix §7A | `docs/reference/permissions-matrix.md` §7A.1–§7A.7 |

### 1.2 What this document does NOT do

- Does not prescribe pixel-level design (spacing, color, typography)
- Does not authorize runtime implementation or UI code
- Does not modify screen-contract instances, OpenAPI specs, or JSON schemas
- Does not replace the page specs — it adds design-review specificity on top of them
- Does not clone any vendor console design (no AWS/Azure/GCP visual patterns)
- Does not imply capability that does not exist

---

## 2. Shell domain groups and surface ID alignment

### 2.1 Seven shell domain groups

The operator console shell organizes 21 surfaces into 7 domain groups. This grouping is the shell's navigation model and is defined in the running app.js:

| # | Shell domain group | Surfaces |
|---|-------------------|----------|
| 1 | **Overview** | operations.center |
| 2 | **Tenants** | tenants.list, tenants.detail, tenants.bootstrap, provisioning.runs, identity.invitations |
| 3 | **Markets & Readiness** | markets.management, markets.detail, packs.catalog, markets.payer-readiness, markets.eligibility-sim |
| 4 | **Operations** | ops.alerts, ops.backup-dr, ops.environments |
| 5 | **Commercial** | commercial.billing, commercial.usage |
| 6 | **Platform** | system.config, platform.support, platform.audit, platform.templates, platform.runbooks |

### 2.2 Surface ID alignment note

The page-specs-v2 document uses 5 nav groups with slightly different surface IDs than the shell implementation. This table maps canonical spec IDs to shell IDs where they differ:

| Page-specs-v2 canonical ID | Shell implementation ID | Difference |
|---------------------------|------------------------|------------|
| `control-plane.platform.operations-center` | `control-plane.operations.center` | Domain group / hyphenation |
| `control-plane.tenants.identity` | `control-plane.identity.invitations` | Group assignment / name |
| `control-plane.commerce.billing` | `control-plane.commercial.billing` | commerce vs commercial |
| `control-plane.commerce.usage` | `control-plane.commercial.usage` | commerce vs commercial |
| `control-plane.fleet.environments` | `control-plane.ops.environments` | fleet vs ops |
| `control-plane.fleet.backup-dr` | `control-plane.ops.backup-dr` | fleet vs ops |
| `control-plane.platform.alerts` | `control-plane.ops.alerts` | platform vs ops |
| `control-plane.packs.eligibility-simulator` | `control-plane.markets.eligibility-sim` | Full name vs abbreviated |

**Resolution rule:** Screen-contract instances use the page-specs-v2 canonical IDs as their `surfaceId` (the specification is authoritative). The shell implementation maps these to its own route keys. Design review uses the canonical IDs. The shell README documents the mapping.

---

## 3. Shared design principles

### 3.1 Terminal-first constraint

Per governance, the control plane is **terminal-first**. All surfaces must be usable as structured data views with operator-initiated actions. No decorative chrome, no marketing UI, no speculative features.

### 3.2 No vendor-console cloning

The operator console is not a cloud provider console. Design must not clone AWS Console, Azure Portal, GCP Console, or any vendor dashboard layout. The design is governed by the operator's workflow, not by an industry visual convention. Every region, card, and control exists because the page-specs-v2 document specifies it, not because "consoles usually have this."

### 3.3 Truthful state display

Every surface must display the **actual current state** from its source of truth. No optimistic state, no placeholder "coming soon" badges that imply capability exists. When a capability or integration is pending, the surface shows explicit `integration-pending` state with the specific dependency.

### 3.4 No fake success states

- A surface that has no data source wired shows `integration-pending`, never an empty success state
- A write action that is not yet implemented shows `action-contracted` or `review-only`, never a silent no-op
- A readiness dimension that has not been verified is `declared` or `specified`, never `verified`
- A metric that has no telemetry source shows `telemetry-pending`, never zero

### 3.5 Honest posture labels

Every surface and action displays its current implementation posture using these labels, and only these labels:

| Label | Meaning | Visual treatment |
|-------|---------|-----------------|
| `contract-backed` | Data from a live API route bound to an OpenAPI/AsyncAPI operation | Normal rendering |
| `fixture-backed` | Data from local fixture files loaded at boot | Amber indicator |
| `static` | Surface renders only client-side content; no API call | Muted indicator |
| `review-only` | Write action simulated locally; no persistence, no real execution | Amber badge on action button |
| `integration-pending` | Data source or write target contracted but not yet wired | Distinct pending badge |
| `action-contracted` | Write action specified in action-semantics; API route not yet available | Grey badge on action button |

Surfaces MUST NOT use: "coming soon", "beta", "preview", "under construction", "placeholder", "N/A", or any label that obscures whether something is wired or not.

### 3.6 Local review runtime wording

The operator console is a **Local Review Runtime**. This phrase appears in:

- The shell banner: "LOCAL REVIEW RUNTIME — no remote execution, no persistence"
- The page header subtitle for every surface
- The write action confirmation dialogs ("This is a REVIEW-ONLY action")

No surface may omit the local review runtime indicator. The banner is always visible — it is not dismissible.

---

## 4. Page header rules

Every surface in the operator console renders a header bar following this structure:

```
┌─────────────────────────────────────────────────────────────┐
│  [Domain Group] › [Surface Title]            [Posture Badge]│
│  [Subtitle: operator question from page-specs]              │
│  ──────────────────────────────────────────────────────────  │
│  [Breadcrumb trail]  [Refresh] [Timestamp: last fetched]    │
└─────────────────────────────────────────────────────────────┘
```

**Header rules:**

1. **Domain group label** appears as the first breadcrumb segment
2. **Surface title** matches the `title` field in the screen-contract instance
3. **Posture badge** shows the current sourcing tier (`contract-backed`, `fixture-backed`, or `static`)
4. **Subtitle** is the operator question from the page-specs-v2 document for this surface
5. **Breadcrumb trail** follows the Level 1 → Level 2 → Level 3 hierarchy from IA v2 §2.2
6. **Refresh button** is present on every non-static surface
7. **Timestamp** shows when data was last fetched (ISO 8601, operator-local timezone)

---

## 5. Filter and summary rail

List surfaces (any surface with a table of items) include a filter rail:

```
┌──────────────────────────────────────────────────────────────┐
│  [Status filter ▼]  [Entity filter ▼]  [Search ____]  [⟳]  │
│  Showing X of Y results                                      │
└──────────────────────────────────────────────────────────────┘
```

**Filter rail rules:**

1. **Status filter** matches the status enum for the entity type (e.g., tenant status, case status)
2. **Entity filter** is surface-specific (market filter on tenants, tenant filter on identities, etc.)
3. **Search** text input debounces (300ms), triggers re-fetch
4. **Item count** always visible: "Showing X of Y"
5. **Pagination** appears below the table when totalItems > pageSize
6. Filtering resets pagination to page 1
7. Filter state is preserved in the URL hash (so browser back works)

---

## 6. Context rail and detail drawer

Detail surfaces (any surface showing a single entity) include a context rail:

```
┌──────────────────────────────────────────────────────────────┐
│  CONTEXT                                                      │
│  Entity ID: xxxxxxxx                                          │
│  Status: [badge]                                              │
│  Created: YYYY-MM-DD                                          │
│  ─────────────────── │                                        │
│  ACTIONS                                                      │
│  [Action 1]  [posture]                                        │
│  [Action 2]  [posture]                                        │
│  ─────────────────── │                                        │
│  NAVIGATION                                                   │
│  ← Back to [parent list]                                      │
│  → Drill to [related surface]                                 │
└──────────────────────────────────────────────────────────────┘
```

**Context rail rules:**

1. Entity identifier fields always visible at the top
2. Status badge uses the state-badge system from §7
3. Available actions listed with posture labels
4. Navigation links show both backward (to parent) and forward (to children/drill targets)
5. Cross-workspace transitions (e.g., to tenant-admin) are visually distinct and labeled "workspace transition"

---

## 7. State-badge system

All surfaces use consistent visual treatment for status enums. Each status family has a defined badge palette:

### 7.1 Tenant lifecycle

| Value | Semantic | Treatment |
|-------|----------|-----------|
| `active` | Healthy | Green |
| `suspended` | Paused — recoverable | Amber |
| `archived` | Terminal — read-only | Grey |
| `provisioning` | In flight | Blue pulsing |
| `bootstrap-pending` | Awaiting bootstrap | Yellow |

### 7.2 Bootstrap request

| Value | Semantic | Treatment |
|-------|----------|-----------|
| `pending` | Submitted, awaiting approval | Yellow |
| `approved` | Ready for provisioning | Green |
| `provisioning` | In flight | Blue pulsing |
| `completed` | Done | Green solid |
| `failed` | Terminal failure | Red |
| `cancelled` | Operator-cancelled | Grey |

### 7.3 Provisioning run

| Value | Semantic | Treatment |
|-------|----------|-----------|
| `queued` | Waiting | Yellow |
| `in-progress` | Running | Blue pulsing |
| `completed` | Finished successfully | Green solid |
| `failed` | Terminal or step failure | Red |

### 7.4 Market and pack lifecycle

| Value | Semantic | Treatment |
|-------|----------|-----------|
| `draft` | Not yet validated | Muted/grey |
| `active` / `validated` / `published` / `activated` | Progression: increasingly live | Gradient: yellow → green |
| `deprecated` | Sunsetting | Amber |
| `retired` | Terminal — no new use | Grey strikethrough |

### 7.5 Readiness state (9-state)

| Value | Semantic | Treatment |
|-------|----------|-----------|
| `declared` | Exists in registry | Muted grey |
| `specified` | Spec written | Light grey |
| `implemented` | Code exists | Yellow |
| `validated` | Unit/integration passed | Yellow-green |
| `verified` | Full verification passed | Green |
| `claimable` | May be presented to external parties | Green bold |
| `production-eligible` | Cleared for production | Green solid |
| `deprecated` | Sunsetting | Amber |
| `retired` | Terminal | Grey strikethrough |

### 7.6 Implementation posture (review runtime)

| Label | Treatment |
|-------|----------|
| `contract-backed` | No special badge (default rendering) |
| `fixture-backed` | Amber outlined badge |
| `static` | Grey outlined badge |
| `review-only` | Amber filled badge on action buttons |
| `integration-pending` | Red outlined badge |
| `action-contracted` | Grey filled badge on action buttons |

---

## 8. Stale-data signaling

Every non-static surface tracks data freshness:

1. **Last-fetched timestamp** visible in the page header (§4)
2. **Staleness threshold:** If data is older than 5 minutes, the timestamp turns amber
3. **Staleness threshold (critical):** If data is older than 30 minutes, the timestamp turns red with "Data may be stale — refresh recommended"
4. **Auto-refresh:** Event-driven surfaces (provisioning.runs) auto-refresh on event receipt; polling surfaces poll per their contract
5. **Manual refresh:** Every non-static surface has a visible refresh button
6. **Refresh failure:** If refresh fails, preserve stale data and show inline error with stale timestamp

---

## 9. Per-surface layout regions

### 9.1 Operations Center (`control-plane.operations.center`)

> Screen-contract ID: `control-plane.platform.operations-center` (see §2.2)

**Domain group:** Overview | **Data tier:** Static (future: contract-backed)

| Region | Content | Source |
|--------|---------|--------|
| Service domain health cards | 7 cards, one per service domain: health status, alert count, key metric | Future: `GET /platform/health` |
| Attention queue | Prioritized items needing operator action | Future: `GET /alerts?status=active` |
| Recent events timeline | Chronological platform event feed | Future: `GET /platform/events` |

**Reject/ready checklist:**
- [ ] 7 service-domain cards rendered (Tenant Portfolio, Composition, Bootstrap, Fleet, Commercial, Support, Governance)
- [ ] Each card shows domain name, health indicator, alert count, key metric
- [ ] Attention queue shows priority, category, summary, age, drill link
- [ ] Events timeline shows recent entries chronologically
- [ ] Drill from card/item navigates to correct domain surface
- [ ] Landing page: default route loads this surface
- [ ] No fabricated health data — shows `integration-pending` per card until wired

---

### 9.2 Tenant Registry (`control-plane.tenants.list`)

**Domain group:** Tenants | **Data tier:** Contract-backed

Carried forward from batch-1 §3.1. Layout regions, interaction patterns, and checklist unchanged.

---

### 9.3 Tenant Detail (`control-plane.tenants.detail`)

**Domain group:** Tenants | **Data tier:** Contract-backed

Carried forward from batch-1 §3.2. Layout regions, interaction patterns, and checklist unchanged.

---

### 9.4 Tenant Bootstrap (`control-plane.tenants.bootstrap`)

**Domain group:** Tenants | **Data tier:** Contract-backed

Carried forward from batch-1 §3.3. Layout regions, interaction patterns, and checklist unchanged.

---

### 9.5 Provisioning Runs (`control-plane.provisioning.runs`)

**Domain group:** Tenants | **Data tier:** Contract-backed

Carried forward from batch-1 §3.4. Layout regions, interaction patterns, and checklist unchanged.

---

### 9.6 Identity & Invitations (`control-plane.identity.invitations`)

> Screen-contract ID: `control-plane.tenants.identity` (see §2.2)

**Domain group:** Tenants | **Data tier:** Static (future: contract-backed)

| Region | Content | Source |
|--------|---------|--------|
| Filter bar | Tenant filter, status multi-select, search | Local state → query params |
| Active identities table | Name, email, tenant, role badge, status badge, last login | Future: `GET /identities` |
| Pending invitations table | Invitee email, tenant, role, sent date, expires, status | Future: `GET /invitations` |
| Actions bar | Send invitation, resend, revoke | Future: `POST /invitations`, `POST /invitations/{id}/revoke` |

**Reject/ready checklist:**
- [ ] Two distinct tables: identities and invitations
- [ ] Tenant filter populates from known tenants
- [ ] Status filter covers: invited, accepted, active, revoked, expired
- [ ] Role badges use consistent role-category labels (PO, TA, CL)
- [ ] Invitation expiry shows urgency coloring when near expiration
- [ ] Write actions show `integration-pending` posture (APIs not yet contracted)
- [ ] No fabricated identity data — explicit `integration-pending` until wired
- [ ] Drill from identity row navigates to tenant detail with tenantId

---

### 9.7 Markets Registry (`control-plane.markets.management`)

**Domain group:** Markets & Readiness | **Data tier:** Contract-backed

Carried forward from batch-1 §3.5. Layout regions, interaction patterns, and checklist unchanged.

---

### 9.8 Market Detail (`control-plane.markets.detail`)

**Domain group:** Markets & Readiness | **Data tier:** Contract-backed

Carried forward from batch-1 §3.6. Layout regions, interaction patterns, and checklist unchanged.

---

### 9.9 Pack Catalog (`control-plane.packs.catalog`)

**Domain group:** Markets & Readiness | **Data tier:** Contract-backed

Carried forward from batch-1 §3.7. Layout regions, interaction patterns, and checklist unchanged.

---

### 9.10 Payer Readiness (`control-plane.markets.payer-readiness`)

**Domain group:** Markets & Readiness | **Data tier:** Static (future: contract-backed)

| Region | Content | Source |
|--------|---------|--------|
| Market selector | Legal market dropdown | `listLegalMarketProfiles` market list |
| Payer readiness table | Payer name, readiness dimensions, connectivity status, claim support | Future: per-market payer readiness registry |
| Readiness dimension summary | Aggregate readiness across payers for selected market | Computed from payer rows |

**Reject/ready checklist:**
- [ ] Market dropdown populates from contract-backed market list
- [ ] Payer table shows per-payer readiness dimensions
- [ ] Readiness states use the 9-state badge system (§7.5)
- [ ] Connectivity status shows actual integration state, not assumed
- [ ] No fabricated payer data — shows `integration-pending` until payer registry API wired
- [ ] Aggregate summary computes from visible rows, not from a separate API

---

### 9.11 Eligibility Simulator (`control-plane.markets.eligibility-sim`)

**Domain group:** Markets & Readiness | **Data tier:** Static (future: contract-backed)

| Region | Content | Source |
|--------|---------|--------|
| Input form | Market selector, pack selection toggles, tenant profile inputs | Local state |
| Resolution result | Resolved packs, deferred items, readiness posture | Future: plan resolution API |
| Comparison view | Side-by-side market/pack combinations | Computed from multiple resolutions |

**Reject/ready checklist:**
- [ ] Market and pack inputs populate from contract-backed sources
- [ ] Resolution result matches the effective-tenant-configuration-plan schema
- [ ] Deferred items show reason and migration path
- [ ] Readiness posture uses the 9-state badge system
- [ ] No simulation executes without explicit operator action
- [ ] Shows `integration-pending` until resolution API wired for interactive mode

---

### 9.12 Alert Center (`control-plane.ops.alerts`)

**Domain group:** Operations | **Data tier:** Static (future: contract-backed)

| Region | Content | Source |
|--------|---------|--------|
| Filter bar | Severity filter, category filter, status filter, date range | Local state → query params |
| Alert queue | Priority, category, summary, source, age, status badge | Future: `GET /alerts` |
| Alert detail | Full alert payload, related entity links, acknowledgment history | Future: `GET /alerts/{alertId}` |

**Reject/ready checklist:**
- [ ] Severity badges: critical=red, high=orange, medium=yellow, low=grey
- [ ] Status: active, acknowledged, resolved — distinct badges
- [ ] Alert items drill to detail view
- [ ] Acknowledge action shows `integration-pending` posture until wired
- [ ] Escalate-to-case navigates to support console with alert context
- [ ] No fabricated alert data — shows `integration-pending` with empty queue

---

### 9.13 Backup / Restore / DR (`control-plane.ops.backup-dr`)

**Domain group:** Operations | **Data tier:** Static (future: contract-backed)

| Region | Content | Source |
|--------|---------|--------|
| Backup schedule | Last backup timestamp, next scheduled, schedule configuration | Future: backup schedule API |
| Backup history | Table of past backups: timestamp, type, size, status, retention | Future: backup history API |
| DR posture | DR readiness status, RPO/RTO targets vs actual, replication status | Future: DR status API |
| Restore actions | Restore-from-backup form (environment, point-in-time) | Future: restore action API |

**Reject/ready checklist:**
- [ ] Backup history shows type (full/incremental), status (succeeded/failed), size
- [ ] DR posture shows RPO and RTO as concrete values, not abstract
- [ ] Restore action requires explicit confirmation dialog
- [ ] All regions show `integration-pending` until backup/DR APIs wired
- [ ] No fabricated backup timestamps or DR metrics

---

### 9.14 Environments & Feature Flags (`control-plane.ops.environments`)

**Domain group:** Operations | **Data tier:** Static (future: contract-backed)

| Region | Content | Source |
|--------|---------|--------|
| Environment list | Name, type (dev/staging/prod), status, version, tenant count | Future: environment registry API |
| Feature flags | Flag key, current value, scope (global/tenant/environment), description | Partial: `getSystemConfig` for global flags |
| Release channels | Channel name, current version, target environments, rollout status | Future: release management API |

**Reject/ready checklist:**
- [ ] Environment rows show distinct visual treatment per type (dev=blue, staging=amber, prod=green)
- [ ] Feature flags show scope (global, tenant, environment) as badge
- [ ] Flag toggle action shows `review-only` posture
- [ ] Release channels show rollout progress as percentage or stage
- [ ] Global feature flags from `getSystemConfig` are contract-backed; all other regions show `integration-pending`

---

### 9.15 Billing & Entitlements Snapshot (`control-plane.commercial.billing`)

> Screen-contract ID: `control-plane.commerce.billing` (see §2.2)

**Domain group:** Commercial | **Data tier:** Static (future: contract-backed)

| Region | Content | Source |
|--------|---------|--------|
| Billing overview table | Tenant, subscription tier, billing status, last payment, next due, balance | Future: `GET /commerce/billing` |
| Subscription detail (drill) | Tier, entitlements, module entitlements, usage limits, payment history | Future: `GET /commerce/subscriptions/{tenantId}` |
| Actions bar | Record payment, trigger suspension, reactivate subscription | Future: commerce write APIs |

**Reject/ready checklist:**
- [ ] Billing status badges: current=green, past-due=red, suspended=grey, grace-period=amber
- [ ] Balance column formatted with currency symbol
- [ ] Next-due column shows urgency coloring when within 7 days
- [ ] Drill to subscription detail shows per-tenant breakdown
- [ ] Drill to tenant detail navigates with tenantId context
- [ ] Write actions show `integration-pending` posture until commerce APIs wired
- [ ] No fabricated billing data — explicit `integration-pending` state per region

---

### 9.16 Usage & Metering (`control-plane.commercial.usage`)

**Domain group:** Commercial | **Data tier:** Static (future: contract-backed)

| Region | Content | Source |
|--------|---------|--------|
| Usage summary table | Tenant, active users/limit, API calls/limit, storage/limit, tier, overage flag | Future: `GET /commerce/usage` |
| Time-series chart (drill) | Per-tenant usage over time with metric selector | Future: `GET /commerce/usage/{tenantId}` |
| Export action | Date range picker, export format selector | Future: `GET /commerce/usage/export` |

**Reject/ready checklist:**
- [ ] Usage metrics show progress-bar representation (used/limit)
- [ ] Overage flag visible when any metric exceeds limit
- [ ] Export action shows `integration-pending` posture until wired
- [ ] Time-series chart is a design placeholder (no real telemetry data)
- [ ] No fabricated usage numbers — shows `integration-pending` state

---

### 9.17 System Configuration (`control-plane.system.config`)

**Domain group:** Platform | **Data tier:** Contract-backed

Carried forward from batch-1 §3.8. Layout regions, interaction patterns, and checklist unchanged.

---

### 9.18 Support Console (`control-plane.platform.support`)

**Domain group:** Platform | **Data tier:** Static (future: contract-backed)

| Region | Content | Source |
|--------|---------|--------|
| Filter bar | Status filter, priority filter, category filter, assignee filter, search | Local state → query params |
| Case queue table | Case ID, tenant, priority badge, category, summary, status badge, age, assignee | Future: `GET /support/cases` |
| Case detail (drill) | Full timeline with entries, notes. Append-only. | Future: `GET /support/cases/{id}` |
| Actions bar | Create case, update status, assign, escalate to incident, resolve | Future: support write APIs |

**Reject/ready checklist:**
- [ ] Priority badges: critical=red, high=orange, medium=yellow, low=grey
- [ ] Status badges: open=yellow, in-progress=blue, escalated=red, resolved=green
- [ ] Case timeline is append-only — no edit or delete affordances
- [ ] Escalate-to-incident requires critical or high priority precondition
- [ ] Resolve requires resolution notes (non-empty)
- [ ] Write actions show `integration-pending` posture until support APIs wired
- [ ] No fabricated case data — explicit `integration-pending` with empty queue

---

### 9.19 Audit Trail (`control-plane.platform.audit`)

**Domain group:** Platform | **Data tier:** Static (future: contract-backed)

| Region | Content | Source |
|--------|---------|--------|
| Filter bar | Date range, actor filter, action type filter, entity filter, search | Local state → query params |
| Audit event table | Timestamp, actor, action, entity type, entity ID, outcome (success/fail) | Future: `GET /audit/events` |
| Chain verification | Hash-chain integrity status, last verified block, verification action | Future: `GET /audit/verify` |

**Reject/ready checklist:**
- [ ] Audit events are read-only — no delete, no edit
- [ ] Hash-chain verification shows integrity badge (intact/broken)
- [ ] Date range filter works with ISO 8601 date picker
- [ ] Actor filter shows operator identities from identity registry
- [ ] Export action for compliance reporting shows `integration-pending`
- [ ] No fabricated audit events — explicit `integration-pending` state

---

### 9.20 Templates & Presets (`control-plane.platform.templates`)

**Domain group:** Platform | **Data tier:** Static (future: contract-backed)

| Region | Content | Source |
|--------|---------|--------|
| Template catalog | Template name, type (bootstrap/config/governance), version, usage count | Future: template registry API |
| Template detail (drill) | Full template definition, parameters, history, linked tenants | Future: template detail API |
| Actions bar | Create template, clone, deprecate | Future: template write APIs |

**Reject/ready checklist:**
- [ ] Template type badges distinguish bootstrap, configuration, and governance templates
- [ ] Version history shows semver with changelog
- [ ] Usage count shows how many tenants used this template
- [ ] Write actions show `integration-pending` posture until template APIs wired
- [ ] No fabricated template data — explicit `integration-pending` state

---

### 9.21 Runbooks Hub (`control-plane.platform.runbooks`)

**Domain group:** Platform | **Data tier:** Static

| Region | Content | Source |
|--------|---------|--------|
| Runbook index | Runbook name, category, last updated, status (current/outdated) | Static: from `docs/runbooks/` file listing |
| Runbook viewer | Rendered runbook content | Static: local markdown rendering |
| Runbook search | Full-text search across runbook content | Static: client-side search |

**Reject/ready checklist:**
- [ ] Runbook index populated from actual `docs/runbooks/` content
- [ ] Categories match operational domains (provisioning, integration, DR, observability)
- [ ] Status badge shows whether runbook has been updated within 90 days
- [ ] Search is client-side (no API dependency)
- [ ] Runbook content rendered from markdown, not fabricated
- [ ] This is a purely static surface — no API dependency, no `integration-pending`

---

## 10. Cross-surface design consistency rules

### 10.1 Empty state handling

Every data region handles the empty case explicitly:

| Region type | Empty message pattern |
|-------------|----------------------|
| List/table | "No {entity_plural} match the current filters" |
| Detail section | "No {detail_name} available" |
| Claim surface | "No claims applicable" with specific reason |
| Integration-pending | "{Region_name}: integration-pending — requires [{dependency}]" |

Never render blank space. Every region has either data or an explicit state message.

### 10.2 Error state handling

When an API call fails:

1. Show the error inline in the affected region, not as a global modal
2. Preserve any previously loaded data (do not clear on refresh failure)
3. Show retry affordance (refresh button remains functional)
4. Error message includes the machine-readable error code from ErrorResponse
5. Error state does not imply success — the region is visually distinct from loaded state

### 10.3 Loading state handling

- List surfaces: Skeleton/placeholder rows during initial load
- Detail surfaces: Skeleton/placeholder for each region during load
- Action buttons: Disabled during action execution; re-enabled on completion or failure
- Never show a "loading" state that lasts indefinitely — timeout at 10s and show error

---

## 11. Review checklist — entire operator console

- [ ] All 21 surfaces have layout region tables in §9
- [ ] All 21 surfaces have reject/ready checklists in §9
- [ ] Shared design principles (§3) consistently applied: terminal-first, no vendor cloning, truthful state, no fake success
- [ ] Honest posture labels (§3.5) used consistently across all surfaces
- [ ] Page header rules (§4) followed by every surface
- [ ] Filter rail (§5) present on all list surfaces
- [ ] Context rail (§6) present on all detail surfaces
- [ ] State-badge system (§7) covers all status families
- [ ] Stale-data signaling (§8) active on all non-static surfaces
- [ ] Empty/error/loading states (§10) handled consistently
- [ ] Surface ID alignment (§2.2) documented for all spec-vs-shell discrepancies
- [ ] No schema modifications — all data references point to existing or future contracts
- [ ] No screen-contract modifications (those are separate artifacts)
- [ ] PH truth constraints visible on bootstrap and market surfaces
- [ ] Batch-1 surfaces (§9.2–§9.5, §9.7–§9.9, §9.17) carry forward unchanged
- [ ] New surfaces (§9.1, §9.6, §9.10–§9.16, §9.18–§9.21) fully specified
