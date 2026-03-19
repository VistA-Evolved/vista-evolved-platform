# Control-Panel Design Contract and Static-Review Prototype — Batch 1

> **⚠️ PARTIALLY SUPERSEDED.** Page specs and action semantics are now covered by v2 documents (`control-panel-page-specs-v2.md`, `control-panel-action-semantics-v2.md`). This design contract's layout regions and review checklists remain valid for the 8 batch-1 surfaces. A v2 design contract covering all 21 surfaces has not yet been authored.

> **Status:** Partially superseded  
> **Scope:** 8 canonical control-plane surfaces
> **Audience:** Design reviewers, implementation engineers, QA
> **Not authorized:** This document defines design constraints and review criteria; it does not authorize runtime implementation or UI code.

---

## 1. Purpose and position in handoff chain

This document is the **design contract** for all 8 control-plane surfaces. It bridges:

- **Upstream inputs:** Page specs (operator manual), action-semantics binding, screen-contract instances, OpenAPI/AsyncAPI contracts
- **Downstream consumers:** Implementation engineers (when implementation is authorized), QA reviewers

For each surface, this document specifies:

1. **Layout regions** — named zones with data-binding references
2. **Reject/ready review checklists** — pass/fail criteria for design review
3. **Static review prototype criteria** — what a non-functional prototype must show
4. **Interaction patterns** — how operator actions map to UI affordances
5. **Data freshness contracts** — when and how data refreshes

### Governing references

| Reference | Location |
|-----------|----------|
| Page specs (operator manual) | `docs/explanation/control-panel-page-specs-and-operator-manual-batch-1.md` |
| Action semantics binding | `docs/explanation/control-panel-action-semantics-and-source-of-truth-binding-batch-1.md` |
| Screen-contract instances | `packages/contracts/screen-contracts/control-plane.*.json` |
| OpenAPI contract | `packages/contracts/openapi/control-plane-operator-bootstrap-and-provisioning.openapi.yaml` |
| AsyncAPI contract | `packages/contracts/asyncapi/control-plane-provisioning-events.asyncapi.yaml` |
| Screen inventory §9 | `docs/reference/screen-inventory.md` §9.1–§9.8 |

### What this document does NOT do

- Does not prescribe pixel-level design (spacing, color, typography)
- Does not authorize runtime implementation or UI code
- Does not modify screen-contract instances, OpenAPI specs, or JSON schemas
- Does not replace the page specs — it adds design-review specificity on top of them

---

## 2. Shared design principles

### 2.1 Terminal-first constraint

Per governance, the control plane is **terminal-first**. All surfaces must be usable as structured data views with operator-initiated actions. No decorative chrome, no marketing UI, no speculative features.

### 2.2 Truthful state display

Every surface must display the **actual current state** from its source of truth. No optimistic state, no placeholder "coming soon" badges that imply capability exists. When a capability or integration is pending, the surface shows explicit `integration-pending` state with the specific dependency.

### 2.3 Claim surface pattern

Surfaces with claim surfaces (tenants.bootstrap, provisioning.runs, markets.management, packs.catalog) must make readiness and eligibility constraints visible. Operators must understand **why** something is available, pending, or blocked — not just that it is.

### 2.4 Pagination pattern

All list surfaces (`listTenants`, `listLegalMarketProfiles`, `listTenantBootstrapRequests`, `listProvisioningRuns`) use server-side pagination with:

- Page/pageSize controls visible when totalItems > pageSize
- Current page indicator and total-items count always visible
- Filtering resets to page 1

### 2.5 Data freshness model

| Pattern | Used by | Mechanism |
|---------|---------|-----------|
| On-demand (operator-initiated refresh) | tenants.list, markets.management, packs.catalog, system.config | Manual refresh button |
| Event-driven + polling | provisioning.runs | AsyncAPI events trigger update; fallback polling every 30s |
| Load-on-navigate | tenants.detail, markets.detail, tenants.bootstrap | Fetch on surface entry with context params |

---

## 3. Surface design specifications

### 3.1 Tenant Registry (`control-plane.tenants.list`)

**Layout regions:**

| Region | Content | Data source |
|--------|---------|-------------|
| Header bar | Surface title, total count badge, refresh button | `listTenants` pagination.totalItems |
| Filter bar | Status filter (dropdown), market filter (dropdown), search input | Local state → query params |
| Tenant table | Rows: tenantId, displayName, status, legalMarketId, launchTier, createdAt | `listTenants` items[] |
| Pagination bar | Page controls, pageSize selector, "Showing X of Y" | `listTenants` pagination |

**Interaction patterns:**

| Operator action | UI affordance | Target |
|----------------|---------------|--------|
| View tenant details | Click row → navigate | `control-plane.tenants.detail` with tenantId |
| Filter by status | Dropdown selection | Re-fetch listTenants with status param |
| Filter by market | Dropdown selection | Re-fetch listTenants with legalMarketId param |
| Search | Text input → debounced | Re-fetch listTenants with search param |
| Refresh | Button click | Re-fetch listTenants with current filters |

**Reject/ready checklist:**

- [ ] Table displays all 6 fields from TenantSummary schema
- [ ] Status values rendered with distinct visual treatment per enum value
- [ ] Pagination controls visible when totalItems > pageSize
- [ ] Empty state shows "No tenants match the current filters"
- [ ] Row click navigates to tenant detail (no dead clicks)
- [ ] Filter controls are functional or explicitly disabled with reason
- [ ] Refresh button is always visible and functional
- [ ] No fabricated tenant data — uses listTenants API or shows integration-pending

---

### 3.2 Tenant Detail (`control-plane.tenants.detail`)

**Layout regions:**

| Region | Content | Data source |
|--------|---------|-------------|
| Header bar | Tenant displayName, status badge, back-to-list link | `getTenant` response |
| Identity section | tenantId, legalMarketId, launchTier, createdAt, updatedAt | `getTenant` response fields |
| Bootstrap section | bootstrapRequestId (link), effectivePlanId, bootstrap status | `getTenant` + `getTenantBootstrapRequest` |
| Provisioning section | Latest run status, step progress, link to runs surface | `getTenant`.latestProvisioningRunId → `getProvisioningRun` |
| Active packs section | List of active pack references with family and state | `getTenant`.activePacks[] |
| Actions bar | "Initiate Bootstrap" button, "View in Tenant Admin" link | Action triggers |

**Interaction patterns:**

| Operator action | UI affordance | Target |
|----------------|---------------|--------|
| Return to list | Back link in header | `control-plane.tenants.list` |
| Initiate bootstrap | Button (enabled when tenant has no active bootstrap) | Navigate to `control-plane.tenants.bootstrap` with tenantId |
| View bootstrap request | Link on bootstrapRequestId | Navigate to `control-plane.tenants.bootstrap` with bootstrapRequestId |
| View provisioning runs | Link on provisioningRunId | Navigate to `control-plane.provisioning.runs` with filter |
| Open tenant admin | External link | Cross-workspace transition with access re-evaluation |

**Reject/ready checklist:**

- [ ] All TenantDetail schema fields rendered
- [ ] bootstrapRequestId is a clickable link, not plain text
- [ ] "Initiate Bootstrap" button disabled with tooltip when bootstrap already active
- [ ] Active packs show packFamily and lifecycleState
- [ ] Cross-workspace link to tenant admin clearly labeled as workspace transition
- [ ] Empty provisioning section shows "No provisioning runs" not blank space
- [ ] Back-to-list navigation always works

---

### 3.3 Tenant Bootstrap (`control-plane.tenants.bootstrap`)

**Layout regions:**

| Region | Content | Data source |
|--------|---------|-------------|
| Header bar | "Bootstrap Tenant" title, breadcrumb (list → detail → bootstrap) | Navigation context |
| Market selection | Legal market dropdown, profile summary card | `listLegalMarketProfiles` → `getLegalMarketProfile` |
| Plan resolution | Resolved packs list, deferred items list, readiness posture | `resolveEffectiveConfigurationPlan` result |
| Pack selections | Interactive pack toggles (opt-in/opt-out within constraints) | Local state → PlanResolutionRequest |
| Readiness posture | Dimension-by-dimension readiness display, gating blockers | PlanResolutionResult.readinessPosture |
| Claim surface | Capability claims, market claims, pack-eligibility claims | Per claim-surface binding table |
| Actions bar | "Resolve Plan" button, "Submit Bootstrap Request" button | Action triggers |

**Interaction patterns:**

| Operator action | UI affordance | Target |
|----------------|---------------|--------|
| Select market | Dropdown → triggers plan resolution | `resolveEffectiveConfigurationPlan` |
| Toggle optional pack | Checkbox/toggle (constrained by eligibility) | Re-resolve plan with updated selections |
| Review readiness | Expand dimension rows | Inline readiness detail |
| Submit bootstrap request | Button (enabled only when plan is resolved and posture permits) | `createTenantBootstrapRequest` → navigate to provisioning.runs |

**Claim surface design:**

The claim surface on this screen spans 3 domains: capability, market, pack-eligibility. Each domain must show:

- Current readiness state per dimension
- Whether the claim is satisfied, pending, or blocked
- The specific dependency preventing satisfaction (when blocked)

**PH truth constraint display:**

For PH market specifically, the surface must show:

- status: `draft`, launchTier: `T0` — prominently displayed
- All packs lifecycle: `draft` — each pack row shows this
- lang-fil: `deferred (eligibility-failed)` — shown in deferred items
- payer-philhealth: `integration-pending` — shown in deferred items with migrationPath

**Reject/ready checklist:**

- [ ] Market dropdown populated from listLegalMarketProfiles
- [ ] Plan resolution triggers on market selection (not on page load)
- [ ] Resolved packs show packFamily, activationSource, packState, readinessState
- [ ] Deferred items show packId, reason, migrationPath
- [ ] Readiness posture shows all dimensions with current state
- [ ] Gating blockers rendered as distinct warning items
- [ ] "Submit Bootstrap Request" disabled until plan is resolved
- [ ] "Submit Bootstrap Request" disabled if readiness posture has blocking gates
- [ ] Claim surface shows per-domain claim status
- [ ] PH draft/T0 status clearly visible without requiring expansion
- [ ] No pack toggle allows activating a pack that is eligibility-failed
- [ ] Breadcrumb navigation back to detail and list always works

---

### 3.4 Provisioning Runs (`control-plane.provisioning.runs`)

**Layout regions:**

| Region | Content | Data source |
|--------|---------|-------------|
| Header bar | Title, filter controls, refresh button | Navigation context |
| Filter bar | Bootstrap request filter, status filter | Local state → query params |
| Runs table | Rows: provisioningRunId, bootstrapRequestId, tenantId, status, createdAt | `listProvisioningRuns` items[] |
| Run detail panel | Steps, blockers, failures, timestamps (expandable or drill-in) | `getProvisioningRun` by selected runId |
| Pagination bar | Page controls | `listProvisioningRuns` pagination |

**Event-driven refresh model:**

This surface consumes 5 AsyncAPI events:

| Event | UI effect |
|-------|-----------|
| `provisioning.run.requested` | New row appears in runs table (status: queued) |
| `provisioning.run.started` | Status updates to in-progress |
| `provisioning.step.changed` | Step detail updates in detail panel |
| `provisioning.run.completed` | Status updates to completed, completedAt populated |
| `provisioning.run.failed` | Status updates to failed, failures array populated |

Fallback: If event delivery is unavailable, polling every 30s via `listProvisioningRuns`.

**Interaction patterns:**

| Operator action | UI affordance | Target |
|----------------|---------------|--------|
| View run details | Click row → expand or navigate | Show `getProvisioningRun` detail |
| Filter by bootstrap request | Dropdown or text input | Re-fetch with bootstrapRequestId filter |
| Filter by status | Dropdown | Re-fetch with status filter |
| Refresh | Button click | Re-fetch with current filters |

**Reject/ready checklist:**

- [ ] Runs table shows all ProvisioningRunStatus fields visible at summary level
- [ ] Status enum values have distinct visual treatment (queued, in-progress, completed, failed)
- [ ] Step detail shows ordered step list with per-step status
- [ ] Blockers rendered as warning-level items with blockerType and description
- [ ] Failures rendered as error-level items with failureType, stepId, description
- [ ] Event-driven updates described in design (even if not implemented in prototype)
- [ ] Empty state: "No provisioning runs match the current filters"
- [ ] Pagination functional
- [ ] Timestamps displayed in operator-local timezone with ISO source value accessible

---

### 3.5 Market Management (`control-plane.markets.management`)

**Layout regions:**

| Region | Content | Data source |
|--------|---------|-------------|
| Header bar | Title, total markets count, refresh button | `listLegalMarketProfiles` pagination.totalItems |
| Filter bar | Status filter, launch tier filter | Local state → query params |
| Markets table | Rows: legalMarketId, displayName, status, launchTier, pack counts, dimension summary | `listLegalMarketProfiles` items[] |
| Claim surface sidebar | Readiness claims across markets | Aggregate from profile data |

**Interaction patterns:**

| Operator action | UI affordance | Target |
|----------------|---------------|--------|
| View market details | Click row → navigate | `control-plane.markets.detail` with legalMarketId |
| Filter by status | Dropdown | Re-fetch with status filter |
| Filter by launch tier | Dropdown | Re-fetch with launchTier filter |
| Refresh | Button click | Re-fetch |

**Claim surface design:**

The market management claim surface spans 2 domains: market readiness and capability. Each market row should surface:

- Aggregate readiness: how many dimensions are at each state level
- Whether the market is bootstrap-eligible (has at least one non-draft, non-retired pack)
- Pack counts by category (mandated, defaultOn, eligible, excluded)

**Reject/ready checklist:**

- [ ] Markets table shows all LegalMarketProfileSummary fields
- [ ] Status and launchTier filters functional
- [ ] Pack counts visible per market row
- [ ] Readiness dimension summary visible (possibly as mini-badges or counts)
- [ ] Row click navigates to market detail
- [ ] Claim surface shows per-market readiness aggregate
- [ ] Empty state: "No legal-market profiles configured"
- [ ] Write operations (create/edit market) contracted (Batch 3) — controls enabled when implementation is wired; show "integration-pending" until then

---

### 3.6 Market Detail (`control-plane.markets.detail`)

**Layout regions:**

| Region | Content | Data source |
|--------|---------|-------------|
| Header bar | Market displayName, status badge, launchTier badge, back link | `getLegalMarketProfile` |
| Profile summary | Version, pack counts (mandated, defaultOn, eligible, excluded) | `getLegalMarketProfile` |
| Readiness dimensions | Per-dimension row: dimension name, state, scope bounds | `getLegalMarketProfile`.readinessDimensions[] |
| Mandated packs | Pack list with family and lifecycle state | `getLegalMarketProfile`.mandatedPacks[] |
| Default-on packs | Pack list | `getLegalMarketProfile`.defaultOnPacks[] |
| Eligible packs | Pack list | `getLegalMarketProfile`.eligiblePacks[] |
| Claim surface | Informational: readiness claims for this specific market | `informationalOnly: true` per screen-contract |

**Interaction patterns:**

| Operator action | UI affordance | Target |
|----------------|---------------|--------|
| Return to market management | Back link | `control-plane.markets.management` |
| Initiate bootstrap for this market | Action link | Navigate to `control-plane.tenants.bootstrap` with legalMarketId pre-selected |

**PH-specific truth display:**

When viewing the PH market detail:

- Header clearly shows: `status: draft`, `launchTier: T0`
- Readiness dimensions show actual PH states (e.g., regulatory: specified, payer: declared, language: specified)
- Pack lists show all PH packs with `lifecycleState: draft`
- Informational claim surface shows: "This market is not bootstrap-eligible. Status: draft, tier: T0."

**Reject/ready checklist:**

- [ ] All LegalMarketProfileSummary fields rendered
- [ ] Readiness dimensions displayed as expandable rows with dimension, state, scopeBounds
- [ ] Pack lists grouped by category (mandated, defaultOn, eligible)
- [ ] Each pack shows packId, packFamily, displayName, lifecycleState
- [ ] Informational claim surface present (not interactive, read-only)
- [ ] Back navigation to market management works
- [ ] No edit capabilities present (read-only surface per screen-contract)
- [ ] PH draft/T0 prominently visible

---

### 3.7 Pack Catalog (`control-plane.packs.catalog`)

**Layout regions:**

| Region | Content | Data source |
|--------|---------|-------------|
| Header bar | Title, total packs count, refresh button | Pack catalog data source |
| Filter bar | Family filter, lifecycle filter, market eligibility filter | Local state |
| Pack table | Rows: packId, packFamily, displayName, lifecycleState, eligible markets | Pack catalog |
| Pack detail panel | Expandable: full pack metadata, capabilities, dependencies | Pack catalog detail |
| Claim surface | Pack eligibility claims across markets | Multi-dimensional packVariation |

**Data source note:**

The pack catalog surface reads from `platform-pack-catalog` (source of truth). The `GET /packs` list API and `GET /packs/{packId}` detail API are defined in the bootstrap/provisioning OpenAPI contract (`listPacks`, `getPack`). Write operations (create/edit pack) remain deferred to a future pack-catalog write API.

**packVariation display:**

The screen-contract declares `packVariation.axes: ["packId", "legalMarketId"]` and `packVariation.dimensionCount: 2`. This means the pack catalog must show:

- Per-pack, per-market eligibility status
- Multi-dimensional filtering (select a market → see which packs apply)

**Reject/ready checklist:**

- [ ] Pack table shows packId, packFamily, displayName, lifecycleState at minimum
- [ ] Family filter covers all 7 packFamily enum values
- [ ] Lifecycle filter covers all 7 lifecycleState enum values
- [ ] Pack-market multi-dimensional view is structurally present
- [ ] Claim surface shows eligibility claims per pack-market combination
- [ ] Write operations (create/edit pack) contracted (Batch 3) — controls enabled when implementation is wired; show "integration-pending" until then
- [ ] When no packs match filters, surface shows explicit empty state

---

### 3.8 System Configuration (`control-plane.system.config`)

**Layout regions:**

| Region | Content | Data source |
|--------|---------|-------------|
| Header bar | Title, refresh button | System configuration |
| Config sections | Grouped configuration values by category | `platform-system-configuration` SoT |
| Section detail | Key-value pairs with current values, types, descriptions | System configuration detail |

**Data source note:**

The system configuration surface reads from `platform-system-configuration` (source of truth). The `GET /system-config` API is defined in the bootstrap/provisioning OpenAPI contract (`getSystemConfig`). Write operations (toggle feature flags, update parameters) remain deferred to a future system-configuration write API.

**Reject/ready checklist:**

- [ ] Config sections are grouped logically (not a flat key-value dump)
- [ ] Each config value shows: key, current value, type, description
- [ ] No write capabilities present (controlled-write contracted in Batch 3; show "integration-pending" until implementation wired)
- [ ] No claim surface present (per screen-contract: no claimSurface)
- [ ] When no parameters or flags exist, surface shows explicit empty state

---

## 4. Cross-surface design consistency rules

### 4.1 Status badge patterns

All surfaces must use consistent visual treatment for status enums:

| Status family | Values | Treatment |
|---------------|--------|-----------|
| Tenant status | active, suspended, archived, provisioning, bootstrap-pending | Distinct per value |
| Bootstrap request status | pending, approved, provisioning, completed, failed, cancelled | Distinct per value |
| Provisioning run status | queued, in-progress, completed, failed | Distinct per value |
| Market status | draft, active, deprecated, retired | Distinct per value |
| Pack lifecycle | draft, validated, tested, published, activated, deactivated, retired | Distinct per value |
| Readiness state | declared, specified, implemented, validated, verified, claimable, production-eligible, deprecated, retired | Progression-aware (early states are muted, later states are emphasized) |

### 4.2 Empty state handling

Every data region must handle the empty case explicitly:

- Tables: "No {entity} match the current filters" or "No {entity} exist"
- Detail sections: "No {detail} available" (not blank space)
- Claim surfaces: "No claims applicable" or specific reason

### 4.3 Error state handling

When an API call fails:

- Show the error inline in the affected region, not as a global modal
- Preserve any previously loaded data (do not clear the table on refresh failure)
- Show retry affordance (refresh button remains functional)
- Error message includes the machine-readable error code from ErrorResponse

### 4.4 Loading state handling

- List surfaces: Show skeleton/placeholder rows during initial load
- Detail surfaces: Show skeleton/placeholder for each region during load
- Action buttons: Disable during action execution, re-enable on completion or failure

---

## 5. Static review prototype criteria

A **static review prototype** is a non-functional representation of each surface sufficient for design review. It does NOT execute API calls, event subscriptions, or navigation. Its purpose is to validate layout, data completeness, and operator comprehension before implementation is authorized.

### 5.1 What the prototype MUST show

For each of the 8 surfaces:

1. **All layout regions** from §3 rendered with representative data
2. **All fields** from the relevant schema populated with realistic (but fabricated-for-review) values
3. **Status badges** using the consistent treatment from §4.1
4. **Claim surface regions** (where applicable) with representative claim states
5. **Action buttons** present in correct enabled/disabled states
6. **Pagination controls** visible on list surfaces
7. **Filter controls** visible and labeled (need not be functional)
8. **Empty states** demonstrated for at least one surface
9. **Error states** demonstrated for at least one surface
10. **PH truth state** — at least one surface showing PH draft/T0 constraints

### 5.2 What the prototype MUST NOT show

- No real API calls (all data is static)
- No navigation between surfaces (each surface is reviewed independently)
- No event subscriptions
- No authentication flow
- No speculative features not in the screen-contract instances

### 5.3 Representative data requirements

The prototype must include realistic data that exercises edge cases:

| Scenario | Surface | What it shows |
|----------|---------|---------------|
| PH draft market | markets.detail | All dimensions at early readiness, all packs draft |
| Tenant with bootstrap in progress | tenants.detail | bootstrapRequestId present, provisioning status in-progress |
| Plan with deferred items | tenants.bootstrap | resolvedPacks and deferredItems both populated |
| Failed provisioning run | provisioning.runs | Run with status=failed, failures array populated, steps showing partial completion |
| Multi-market tenant list | tenants.list | Multiple tenants across PH and US markets |
| Pack catalog with mixed eligibility | packs.catalog | Packs showing different lifecycle states and market eligibility |

### 5.4 Review acceptance criteria

A static review prototype **passes** when:

1. Every layout region from §3 is present and populated
2. Every field from the relevant OpenAPI schema is visible
3. Status badges are visually distinct per §4.1
4. Claim surfaces show claim states (not blank)
5. PH truth constraints are visible without operator discovery
6. Empty and error states are demonstrated
7. No dead regions (every visible element has either data or an explicit empty/pending state)
8. No fabricated capability — nothing implies a feature exists that does not

A static review prototype **fails** if:

1. Any layout region from §3 is missing
2. Any required schema field is absent
3. Status badges are indistinguishable
4. Claim surfaces are blank or hidden
5. PH draft/T0 state is not visible on relevant surfaces
6. Any region shows blank space instead of an explicit empty state
7. Any element implies capability that does not exist

---

## 6. Deferred design elements

The following design elements are **not included** in batch 1 because their underlying APIs or data sources are not yet available:

| Element | Surface(s) | Dependency | Status |
|---------|-----------|------------|--------|
| Tenant suspend/reactivate/archive | tenants.detail | Tenant-lifecycle API (contracted, Batch 2) | Contracted |
| Market create/edit | markets.management | Market-management write API (contracted, Batch 3) | Contracted |
| Pack create/edit | packs.catalog | Pack-catalog write API (contracted, Batch 3) | Contracted |
| System config edit | system.config | System-config write API (contracted, Batch 3) | Contracted |
| Provisioning cancel/retry | provisioning.runs | Provisioning-management API (contracted, Batch 2) | Contracted |
| Pack catalog data feed | packs.catalog | `listPacks` / `getPack` in OpenAPI | Available (read-only) |
| System config data feed | system.config | `getSystemConfig` in OpenAPI | Available (read-only) |
| Real-time event updates | provisioning.runs | AsyncAPI event subscription wiring | Design-specified, implementation deferred |

---

## 7. Verification checklist

- [ ] All 8 surfaces have layout region tables in §3
- [ ] All 8 surfaces have interaction pattern tables in §3
- [ ] All 8 surfaces have reject/ready checklists in §3
- [ ] Shared design principles (§2) are consistent with governance (terminal-first, truthful state)
- [ ] Cross-surface consistency rules (§4) cover status, empty, error, loading states
- [ ] Static review prototype criteria (§5) define pass/fail unambiguously
- [ ] Deferred elements (§6) match the deferred inventory in the page-specs doc
- [ ] No schema modifications — all data references point to existing OpenAPI/AsyncAPI schemas
- [ ] No screen-contract modifications
- [ ] PH truth constraints visible in design specs for bootstrap and market surfaces
- [ ] Claim surface design specified for all surfaces that have claim surfaces
- [ ] Pack-catalog and system-config surfaces show available read API; write operations are contracted (Batch 3) with implementation pending
