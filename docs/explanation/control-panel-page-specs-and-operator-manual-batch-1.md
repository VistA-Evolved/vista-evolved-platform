# Control-Panel Page Specifications and Operator Manual — Batch 1

> **⚠️ SUPERSEDED** by `control-panel-page-specs-v2.md` (21 surfaces). This batch-1 document (8 surfaces) is retained as reference. The v2 document carries forward all 8 batch-1 surface specs by reference and adds 13 new surface specs.

> **Status:** Superseded  
> **Scope:** 8 canonical control-plane surfaces (see v2 for full 21-surface coverage)  
> **Audience:** Platform operators, implementation engineers, design reviewers  
> **Not authorized:** This document specifies surface behavior; it does not authorize runtime or UI implementation.

---

## 1. Purpose and position in handoff chain

This document is the **page-by-page operator manual** for all 8 control-plane surfaces defined in screen-inventory §9.1–§9.8. It bridges the gap between:

- **Upstream inputs:** Screen-contract instances, OpenAPI/AsyncAPI contracts, screen-inventory fields, permissions matrix, pack-visibility rules, workspace map §11
- **Downstream consumers:** Design contract (wireframes, review checklists), implementation engineers, QA reviewers

For each surface, this document specifies:

1. What the operator sees (visible data, fields, layout regions)
2. What the operator can do (actions, transitions, writes)
3. Where data comes from (API operations, events, registries)
4. What constraints apply (PH truth, readiness gating, claim surfaces)
5. How the operator navigates between surfaces

### Governing references

| Reference | Location |
|-----------|----------|
| Screen-contract schema | `packages/contracts/schemas/screen-contract.schema.json` |
| Screen-contract instances | `packages/contracts/screen-contracts/control-plane.*.json` |
| OpenAPI contract | `packages/contracts/openapi/control-plane-operator-bootstrap-and-provisioning.openapi.yaml` |
| AsyncAPI contract | `packages/contracts/asyncapi/control-plane-provisioning-events.asyncapi.yaml` |
| Screen inventory §9 | `docs/reference/screen-inventory.md` §9.1–§9.8 |
| Permissions matrix | `docs/reference/permissions-matrix.md` |
| Pack visibility rules | `docs/reference/pack-visibility-rules.md` |
| Workspace map | `docs/explanation/information-architecture-workspace-map.md` §11 |
| Surface expansion batch 1 | `docs/explanation/control-panel-surface-expansion-batch-1.md` |
| Bootstrap/provisioning contract map | `docs/explanation/control-plane-operator-bootstrap-and-provisioning-contract-map.md` |
| PH legal-market profile | `packages/contracts/legal-market-profiles/PH.json` |
| PH effective plan | `packages/contracts/effective-tenant-configuration-plans/PH-single-clinic-core.json` |

### What this document does NOT do

- Does not modify screen-inventory entries, screen-contract instances, or JSON schemas
- Does not authorize runtime implementation or UI code
- Does not prescribe visual design (spacing, color, typography) — that is the design contract's role
- Does not define new data models — all data comes from existing contracts

---

## 2. Navigation model

The 8 control-plane surfaces form a coherent navigation graph:

```
PRIMARY SURFACES (top-level navigation)
├── control-plane.tenants.list
│   └── [drill] → control-plane.tenants.detail (context: tenantId)
│       ├── [action] → control-plane.tenants.bootstrap (context: tenantId)
│       │   └── [outcome] → control-plane.provisioning.runs (context: bootstrapRequestId)
│       └── [transition] → tenant-admin workspace (context: tenantId)
├── control-plane.markets.management
│   └── [drill] → control-plane.markets.detail (context: legalMarketId)
│       └── [action] → control-plane.tenants.bootstrap (context: legalMarketId → tenantId)
├── control-plane.packs.catalog
└── control-plane.system.config
```

**Navigation rules:**
- Primary surfaces are always accessible from the control-plane shell navigation
- Local surfaces require entity context passed from a parent surface
- Cross-workspace transitions (to tenant-admin) require access re-evaluation
- Same-workspace transitions preserve the operator session

---

## 3. Surface specifications

### 3.1 Tenant Registry (`control-plane.tenants.list`)

**Screen contract:** `control-plane.tenants.list.json`  
**Inventory entry:** §9.1  
**Navigation level:** Primary  
**Read/write posture:** Mixed (reads from registry; actions are indirect writes via bootstrap/provisioning workflow)

#### 3.1.1 Purpose

The tenant registry is the platform operator's entry point for managing all tenants in the system. It presents a paginated, filterable list of every tenant, their lifecycle status, associated legal market, and most recent provisioning state. From here, operators drill into individual tenants or initiate new tenant creation.

#### 3.1.2 Data source

| Source | API operation | Contract |
|--------|--------------|----------|
| Tenant list | `GET /tenants` | OpenAPI (`listTenants`) |

**Source of truth:** `platform-tenant-registry` (platform-governance domain class).

#### 3.1.3 Visible data regions

**Region A — Filter bar:**

| Control | Type | Behavior |
|---------|------|----------|
| Status filter | Multi-select dropdown | Values: `active`, `suspended`, `archived`, `provisioning`, `pending` |
| Market filter | Dropdown | Values: legal-market IDs (e.g., `PH`, `US`) |
| Search | Text input | Searches on `tenantDisplayName`, `tenantId` |

**Region B — Tenant table:**

| Column | Source field | Notes |
|--------|-------------|-------|
| Tenant Name | `tenantDisplayName` | Primary display text |
| Tenant ID | `tenantId` | Monospace, copyable |
| Status | `status` | Badge: active=green, suspended=amber, archived=gray, provisioning=blue, pending=yellow |
| Legal Market | `legalMarketId` | Display name with flag icon |
| Launch Tier | `launchTier` | T0/T1/T2/T3 badge |
| Created | `createdAt` | Relative time (e.g., "3 days ago") |
| Last Activity | `updatedAt` | Relative time |

**Region C — Pagination:**

Standard server-side pagination with page size selector (10, 25, 50, 100).

#### 3.1.4 Operator actions

| Action | Type | Target | Precondition |
|--------|------|--------|-------------|
| View tenant detail | Drill (row click) | `control-plane.tenants.detail` | Row selected; passes `tenantId` |
| Create new tenant | Navigate | `control-plane.tenants.bootstrap` | — (no precondition) |
| Refresh list | Button | Re-fetches `GET /tenants` | — |

**No direct write actions.** `directWriteAllowed: false`. Tenant mutation happens through the bootstrap/provisioning workflow.

#### 3.1.5 PH truth constraints

With PH market in draft/T0 status, any PH tenant rows will display:
- Launch tier badge: `T0` (informational only)
- Status: reflects actual lifecycle state (pending, provisioning, etc.)
- No degradation of list functionality — PH truth affects content of individual tenants, not the list surface itself

#### 3.1.6 Cross-workspace transitions

| Target | Context | Access re-evaluation |
|--------|---------|---------------------|
| `tenant-admin` workspace | `tenantId` | Yes — operator must have tenant-admin access for the specific tenant |

---

### 3.2 Tenant Detail (`control-plane.tenants.detail`)

**Screen contract:** `control-plane.tenants.detail.json`  
**Inventory entry:** §9.5  
**Navigation level:** Local (drill from `tenants.list`)  
**Entity context required:** `tenantId`  
**Read/write posture:** Mixed

#### 3.2.1 Purpose

Single-tenant summary surface. Shows the complete picture of one tenant: identity, configuration, bootstrap history, provisioning state, and available actions. This is the operator's decision point for what to do with a tenant.

#### 3.2.2 Data sources

| Source | API operation | Contract |
|--------|--------------|----------|
| Tenant record | `GET /tenants/{tenantId}` | OpenAPI (`getTenant`) |
| Bootstrap history | `GET /tenant-bootstrap-requests?tenantId={tenantId}` | OpenAPI (`listTenantBootstrapRequests` with tenantId filter) |
| Provisioning status | `getProvisioningRun` | OpenAPI (existing) |

#### 3.2.3 Visible data regions

**Region A — Tenant identity header:**

| Field | Source | Notes |
|-------|--------|-------|
| Tenant Display Name | `tenantDisplayName` | H1 heading |
| Tenant ID | `tenantId` | Monospace, copyable |
| Status | `status` | Badge with lifecycle state |
| Legal Market | `legalMarketId` | Flag + display name |
| Launch Tier | `launchTier` | T0/T1/T2/T3 badge |
| Created | `createdAt` | Full ISO 8601 |

**Region B — Configuration summary:**

Key-value display of tenant configuration (market, facility type, active packs, feature flags). Read-only — configuration changes happen through bootstrap/provisioning workflow.

**Region C — Bootstrap history:**

| Column | Source | Notes |
|--------|--------|-------|
| Bootstrap Request ID | `bootstrapRequestId` | UUID, drillable |
| Status | `status` | pending/approved/provisioning/completed/failed/cancelled |
| Plan | `effectivePlanId` | UUID link |
| Requested At | `createdAt` | Timestamp |
| Completed At | `updatedAt` | Timestamp or "—" |

**Region D — Active provisioning status:**

If a provisioning run is in progress, this region shows live status:
- Run ID, overall status (queued/in-progress/completed/failed)
- Step progress bar with per-step status
- Blocker/failure display if applicable
- Last event timestamp (from event-driven refresh)

If no active run, this region shows "No active provisioning run" with the most recent completed/failed run summary.

#### 3.2.4 Operator actions

| Action | Type | Target | Precondition |
|--------|------|--------|-------------|
| Launch bootstrap | Same-workspace nav | `control-plane.tenants.bootstrap` | Tenant not archived; passes `tenantId` |
| View provisioning run | Same-workspace nav | `control-plane.provisioning.runs` | Run exists; passes `provisioningRunId` |
| Open tenant admin | Cross-workspace transition | `tenant-admin` workspace | Passes `tenantId`; access re-evaluation |
| Suspend tenant | Controlled write | `POST /tenants/{tenantId}/suspend` | Tenant is `active` |
| Reactivate tenant | Controlled write | `POST /tenants/{tenantId}/reactivate` | Tenant is `suspended` |
| Archive tenant | Controlled write | `POST /tenants/{tenantId}/archive` | Tenant is `suspended`; confirmation required |

**Note on suspend/reactivate/archive:** These are lifecycle mutations on the tenant itself. Their API operations (`suspendTenant`, `reactivateTenant`, `archiveTenant`) are **contracted** in the control-plane OpenAPI (Batch 2). Implementation wiring is pending — until then, the page will show these action buttons in a disabled state with "integration-pending" tooltip.

#### 3.2.5 PH truth constraints

For a PH tenant:
- Launch tier badge: `T0`
- Bootstrap history shows PH-specific plan with deferred items (e.g., `lang-fil` with reason `eligibility-failed`)
- Configuration summary shows PH-resolved packs (lang-en, locale-ph, regulatory-philhealth-doh, standards-ph, payer-philhealth)
- No functional degradation — all actions available

---

### 3.3 Tenant Bootstrap (`control-plane.tenants.bootstrap`)

**Screen contract:** `control-plane.tenants.bootstrap.json`  
**Inventory entry:** §9.6  
**Navigation level:** Local (from `tenants.detail` or `markets.detail`)  
**Entity context required:** `tenantId`  
**Read/write posture:** Controlled-write  
**Claim surface:** Yes — `control-plane-provisioning` with domains `[capability, market, pack-eligibility]`

#### 3.3.1 Purpose

The bootstrap surface is where the operator constructs and submits a tenant bootstrap request. The workflow:

1. **Select market** → calls `resolveEffectiveConfigurationPlan` with operator selections
2. **Review plan** → operator sees resolved packs, deferred items, gating blockers, readiness posture
3. **Adjust selections** → operator can modify pack selections and re-resolve
4. **Submit bootstrap request** → calls `createTenantBootstrapRequest`
5. **Monitor status** → polls `getTenantBootstrapRequest` or receives `tenant.bootstrap.requested` event

**Interaction model** (wizard, multi-step, or single-page review-and-submit) is a **rendering choice**, not specified here per screen-contract design principles.

#### 3.3.2 Data sources

| Source | API operation | Direction | Contract |
|--------|--------------|-----------|----------|
| Plan resolution | `resolveEffectiveConfigurationPlan` | POST (write) | OpenAPI |
| Bootstrap submission | `createTenantBootstrapRequest` | POST (write) | OpenAPI |
| Bootstrap status | `getTenantBootstrapRequest` | GET (read) | OpenAPI |
| Bootstrap event | `tenant.bootstrap.requested` | Event (inbound) | AsyncAPI |
| Plan resolved event | `effective-plan.resolved` | Event (inbound) | AsyncAPI |

#### 3.3.3 Visible data regions

**Region A — Market selection and operator inputs:**

| Control | Type | Source | Notes |
|---------|------|--------|-------|
| Legal Market | Dropdown | `GET /legal-market-profiles` (list) | Pre-populated if context includes `legalMarketId` |
| Tenant Display Name | Text input | Operator-entered | Required. 1–256 chars. |
| Facility Type | Dropdown | Enum: single-clinic, hospital, multi-facility | Affects pack eligibility |
| Operator Notes | Text area | Optional | Max 2048 chars |

**Region B — Resolved plan review:**

Populated after calling `resolveEffectiveConfigurationPlan`. Displays the `PlanResolutionResult`:

**Resolved packs table:**

| Column | Source field | Notes |
|--------|-------------|-------|
| Pack Name | `packId` → display name | Primary text |
| Pack Family | `packFamily` | Badge: language, locale, regulatory, etc. |
| Activation Source | `activationSource` | Badge: mandated, default-on, operator-selected, etc. |
| Lifecycle State | `packState` | draft/validated/tested/published/activated |
| Readiness | `readinessState` | declared/specified/implemented/... |

**Deferred items table:**

| Column | Source field | Notes |
|--------|-------------|-------|
| Pack ID | `packId` | |
| Pack Family | `packFamily` | Badge |
| Reason | `reason` | Human-readable: pack-not-published, adapter-unavailable, etc. |
| Migration Path | `migrationPath` | What must change for this pack to become resolvable |
| Target State | `targetState` | Required readiness state |

**Readiness posture summary:**

| Field | Source | Notes |
|-------|--------|-------|
| Effective Launch Tier | `readinessPosture.effectiveLaunchTier` | T0/T1/T2/T3 badge |
| Readiness Dimensions | `readinessPosture.dimensions[]` | Per-dimension state display |
| Gating Blockers | `readinessPosture.gatingBlockers[]` | Warning/error cards with dimension, blocker type, description |

**Region C — Pack selection adjustment:**

| Control | Type | Behavior |
|---------|------|----------|
| Add eligible pack | Checkbox list | Shows `eligiblePacks` from market profile. Selecting adds to `selectedPacks` |
| Remove default pack | Checkbox toggle | Shows `defaultOnPacks`. Deselecting adds to `deselectedDefaults` |
| Re-resolve | Button | Calls `resolveEffectiveConfigurationPlan` with updated selections |

**Region D — Submission controls:**

| Control | Behavior |
|---------|----------|
| Submit Bootstrap Request | Calls `createTenantBootstrapRequest` with the effectivePlanId. Disabled if plan has critical gating blockers. |
| Cancel | Returns to `tenants.detail` |

**Region E — Submitted status:**

After submission, this region shows:
- Bootstrap Request ID (copyable)
- Status (pending → approved → provisioning → completed/failed/cancelled)
- Correlation ID for tracing
- Link to provisioning run (when available)

#### 3.3.4 Operator actions

| Action | API operation | Precondition | Outcome |
|--------|-------------|-------------|---------|
| Resolve plan | `resolveEffectiveConfigurationPlan` | Market selected | Plan displayed in Region B |
| Adjust selections | (local state change) | Plan resolved | Region C updated; re-resolve available |
| Re-resolve plan | `resolveEffectiveConfigurationPlan` | Selections modified | Region B updated with new plan |
| Submit bootstrap | `createTenantBootstrapRequest` | Plan resolved, no critical blockers | 202 Accepted; Region E shows status |
| View provisioning | Navigate to `provisioning.runs` | Bootstrap has provisioningRunId | Context: bootstrapRequestId |

#### 3.3.5 PH truth constraints

For the PH market:
- `resolveEffectiveConfigurationPlan` with `legalMarketId: "PH"` returns:
  - **resolvedPacks:** lang-en, locale-ph, regulatory-philhealth-doh, standards-ph, payer-philhealth (all draft/declared)
  - **deferredItems:** lang-fil (reason: eligibility-failed), any packs dependent on unpublished adapters
  - **readinessPosture:** effectiveLaunchTier=T0, all dimensions at declared/specified
  - **gatingBlockers:** payer-philhealth adapter integration-pending
- The deferred items and gating blockers are **first-class visible elements**, not hidden validation notes
- The operator can submit a T0 bootstrap despite deferred items — T0 is a valid launch tier

#### 3.3.6 Claim surface behavior

The bootstrap surface is a **claim surface** (`informationalOnly: false`). This means:
- It shows readiness states that may include internal-only claim detail
- Gating rules from `capability-truth-§11-no-provisioning-without-eligibility` are enforced
- The minimum readiness state for display is `declared`
- States below `declared` are not shown (no "unknown" or pre-governance states leak to the surface)

---

### 3.4 Provisioning Runs (`control-plane.provisioning.runs`)

**Screen contract:** `control-plane.provisioning.runs.json`  
**Inventory entry:** §9.7  
**Navigation level:** Local (from `tenants.bootstrap`)  
**Entity context required:** `provisioningRunId`  
**Read/write posture:** Mixed  
**Claim surface:** Yes — `control-plane-provisioning` with domain `[provisioning-lifecycle]`  
**Refresh behavior:** Event-driven

#### 3.4.1 Purpose

Live-monitoring surface for asynchronous provisioning runs. Shows step-by-step progress, blocker diagnosis, and failure details. The operator can retry failed runs or cancel in-progress runs from this surface.

This is the only event-driven surface among the 8 — it refreshes based on AsyncAPI events rather than requiring manual refresh or polling.

#### 3.4.2 Data sources

| Source | API operation | Direction | Contract |
|--------|--------------|-----------|----------|
| Initiate run | `createProvisioningRun` | POST (write) | OpenAPI |
| Run status | `getProvisioningRun` | GET (read) | OpenAPI |
| Run list | `GET /provisioning-runs?bootstrapRequestId={id}` | GET (read) | OpenAPI (`listProvisioningRuns`) |
| Run requested | `provisioning.run.requested` | Event (inbound) | AsyncAPI |
| Run started | `provisioning.run.started` | Event (inbound) | AsyncAPI |
| Step changed | `provisioning.step.changed` | Event (inbound) | AsyncAPI |
| Run completed | `provisioning.run.completed` | Event (inbound) | AsyncAPI |
| Run failed | `provisioning.run.failed` | Event (inbound) | AsyncAPI |

#### 3.4.3 Visible data regions

**Region A — Run header:**

| Field | Source | Notes |
|-------|--------|-------|
| Provisioning Run ID | `provisioningRunId` | UUID, copyable |
| Status | `status` | Badge: queued=gray, in-progress=blue, completed=green, failed=red |
| Bootstrap Request | `bootstrapRequestId` | UUID link back to bootstrap surface |
| Tenant | `tenantId` | Link to tenant detail |
| Legal Market | `legalMarketId` | Flag + name |
| Plan | `effectivePlanId` | UUID reference |
| Correlation ID | `correlationId` | For tracing, copyable |
| Started | `startedAt` | Timestamp or "queued" |
| Duration | computed from `startedAt` to `completedAt` | Live counter if in-progress |

**Region B — Step progress:**

Ordered list of provisioning steps from `ProvisioningRunStatus.steps[]`:

| Column | Source | Notes |
|--------|--------|-------|
| Step | `stepName` | e.g., "tenant-database-init", "pack-activation", "adapter-initialization" |
| Status | `status` | Icon: pending=circle, in-progress=spinner, completed=check, failed=x, skipped=skip |
| Started | `startedAt` | Timestamp per step |
| Completed | `completedAt` | Timestamp or "—" |
| Detail | `detail` | Expandable text |

Visual: progress bar showing `completedStepCount / totalStepCount`.

**Region C — Blockers:**

If `blockers[]` is non-empty:

| Column | Source | Notes |
|--------|--------|-------|
| Blocker Type | `blockerType` | Badge: dependency-unavailable, adapter-integration-pending, etc. |
| Description | `description` | Human-readable explanation |
| Affected Step | `affectedStep` | Step ID reference |

**Region D — Failures:**

If `failures[]` is non-empty (run status is `failed`):

| Column | Source | Notes |
|--------|--------|-------|
| Failed Step | `stepId` | Step name reference |
| Failure Type | `failureType` | Badge: infrastructure-error, adapter-error, dependency-error, timeout, unknown |
| Description | `description` | Detailed failure message |
| Occurred At | `occurredAt` | Timestamp |

**Region E — Actions:**

| Action | Precondition | Behavior |
|--------|-------------|----------|
| Retry | Run is `failed` | Calls `createProvisioningRun` with the same `bootstrapRequestId` |
| Cancel | Run is `queued` or `in-progress` | Calls cancel operation (to be defined) |
| Refresh | — | Re-fetches `getProvisioningRun` |

#### 3.4.4 Event-driven refresh model

The provisioning runs surface subscribes to 5 AsyncAPI events. On each event:

| Event | UI update |
|-------|-----------|
| `provisioning.run.requested` | Region A status → "queued" |
| `provisioning.run.started` | Region A status → "in-progress"; `startedAt` populated; `totalStepCount` set |
| `provisioning.step.changed` | Region B step row updates; progress bar advances |
| `provisioning.run.completed` | Region A status → "completed"; `completedAt` populated; duration finalized |
| `provisioning.run.failed` | Region A status → "failed"; Region D populated with failure details |

**Fallback:** If event subscription is disconnected, the surface falls back to polling `getProvisioningRun` every 10 seconds until reconnected.

#### 3.4.5 PH truth constraints

For a PH provisioning run:
- Steps may include pack-activation steps for PH-specific packs (regulatory-philhealth-doh, payer-philhealth)
- Blockers may include: adapter-integration-pending for payer-philhealth
- Multiple deferred items from the plan do not block provisioning of non-deferred packs
- The operator sees exactly which steps succeeded versus which are blocked by PH readiness gaps

---

### 3.5 Legal Market and Launch Tier Management (`control-plane.markets.management`)

**Screen contract:** `control-plane.markets.management.json`  
**Inventory entry:** §9.2  
**Navigation level:** Primary  
**Read/write posture:** Controlled-write  
**Claim surface:** Yes — `control-plane-provisioning` with domains `[market, capability]`  
**Implementation posture:** Deferred

#### 3.5.1 Purpose

Platform-wide market registry. Operators view all configured legal markets, their readiness dimensions, launch tiers, and pack composition at a glance. Drill into individual markets for detail. Market write operations (create/update/submit-for-review) are contracted in Batch 3; implementation wiring is pending.

#### 3.5.2 Data sources

| Source | API operation | Contract |
|--------|--------------|----------|
| Market list | `GET /legal-market-profiles` | OpenAPI (`listLegalMarketProfiles`) |

**Source of truth:** `claim-readiness-registry`.

#### 3.5.3 Visible data regions

**Region A — Market table:**

| Column | Source | Notes |
|--------|--------|-------|
| Market | `displayName` | Flag icon + country name |
| Market ID | `legalMarketId` | ISO 3166-1 alpha-2, monospace |
| Status | `status` | Badge: draft=amber, active=green, deprecated=gray, retired=red |
| Launch Tier | `launchTier` | T0/T1/T2/T3 badge |
| Mandated Packs | `mandatedPackCount` | Integer count |
| Default-On Packs | `defaultOnPackCount` | Integer count |
| Eligible Packs | `eligiblePackCount` | Integer count |
| Readiness Summary | computed from `readinessDimensions` | Aggregate indicator (e.g., "6/8 specified") |

**Region B — Filter/sort:**

| Control | Type | Behavior |
|---------|------|----------|
| Status filter | Multi-select | draft, active, deprecated, retired |
| Launch tier filter | Multi-select | T0, T1, T2, T3 |
| Sort | Column header click | Sortable on Market, Status, Launch Tier |

#### 3.5.4 Operator actions

| Action | Type | Target | Precondition |
|--------|------|--------|-------------|
| View market detail | Drill (row click) | `control-plane.markets.detail` | Passes `legalMarketId` |
| Create market profile draft | Controlled write | `POST /legal-market-profiles` | Operator has `control-plane:markets:write` — **contracted (Batch 3), implementation pending** |
| Update market profile draft | Controlled write | `PUT /legal-market-profiles/{legalMarketId}` | Profile is `draft` — **contracted (Batch 3), implementation pending** |
| Submit market for review | Controlled write | `POST /legal-market-profiles/{legalMarketId}:submit-review` | Profile is `draft` — **contracted (Batch 3), implementation pending** |
| Refresh | Button | Re-fetches market list | — |

**Write actions are contracted (Batch 3).** Market profile create, update, and submit-for-review API operations are defined in the OpenAPI contract (v0.3.0). Until implementation is wired, the surface will show these controls in a disabled state with "integration-pending" indicator.

#### 3.5.5 PH truth constraints

The PH row in the market table:
- Status: `draft`
- Launch Tier: `T0`
- Mandated: 2 (regulatory-philhealth-doh, standards-ph)
- Default-On: 3 (lang-en, locale-ph, payer-philhealth)
- Eligible: 1 (lang-fil)
- Readiness: "8/8 declared" (all dimensions at declared or specified)

---

### 3.6 Legal Market Detail (`control-plane.markets.detail`)

**Screen contract:** `control-plane.markets.detail.json`  
**Inventory entry:** §9.8  
**Navigation level:** Local (drill from `markets.management`)  
**Entity context required:** `legalMarketId`  
**Read/write posture:** Read-only  
**Claim surface:** Yes — `control-plane-provisioning` with domains `[market, readiness]`, **informationalOnly: true**

#### 3.6.1 Purpose

Deep-dive into a single legal market. Shows all readiness dimensions with their states, the full pack breakdown (mandated, default-on, eligible, excluded), and provides an entry point for bootstrapping a tenant in this market.

This surface is the most well-bound of the 8 — it maps directly to `getLegalMarketProfile` with a 1:1 display of the `LegalMarketProfileSummary` response.

#### 3.6.2 Data sources

| Source | API operation | Contract |
|--------|--------------|----------|
| Market profile | `getLegalMarketProfile` | OpenAPI (existing) |

#### 3.6.3 Visible data regions

**Region A — Market header:**

| Field | Source | Notes |
|-------|--------|-------|
| Display Name | `displayName` | H1 heading with flag |
| Market ID | `legalMarketId` | Monospace, copyable |
| Status | `status` | Badge |
| Launch Tier | `launchTier` | Badge |
| Profile Version | `version` | Semver |

**Region B — Readiness dimensions:**

Table or card grid showing each dimension from `readinessDimensions[]`:

| Column | Source | Notes |
|--------|--------|-------|
| Dimension | `dimension` | e.g., language, regulatory, payer, standards, locale, adapter, data-migration, operational |
| State | `state` | Badge with 9-state readiness coloring |
| Scope Bounds | `scopeBounds` | Where this readiness state applies |

**Region C — Pack breakdown:**

Four sections, one per pack category:

**Mandated packs** (from `mandatedPacks[]`):

| Column | Source | Notes |
|--------|--------|-------|
| Pack ID | `packId` | |
| Pack Family | `packFamily` | Badge |
| Display Name | `displayName` | |
| Lifecycle | `lifecycleState` | Badge |

**Default-on packs** (from `defaultOnPacks[]`):
Same columns as mandated.

**Eligible packs** (from `eligiblePacks[]`):
Same columns as mandated. These are packs an operator can optionally select during bootstrap.

**Excluded packs** (informational):
The excluded pack count is shown from the summary. Individual excluded packs are listed if the API response includes them (not in current schema — deferred).

**Region D — Actions:**

| Action | Type | Target | Notes |
|--------|------|--------|-------|
| Bootstrap tenant for this market | Same-workspace nav | `control-plane.tenants.bootstrap` | Passes `legalMarketId` as context |
| Back to market list | Navigation | `control-plane.markets.management` | Breadcrumb |

#### 3.6.4 PH truth example

For `legalMarketId: "PH"`:
- **Header:** Philippines, PH, draft, T0, v0.1.0
- **Readiness:** 8 dimensions, all at declared or specified
- **Mandated:** regulatory-philhealth-doh (regulatory), standards-ph (national-standards)
- **Default-on:** lang-en (language), locale-ph (locale), payer-philhealth (payer)
- **Eligible:** lang-fil (language) — note: lang-fil will appear in deferred items at plan resolution time with reason `eligibility-failed`
- **Excluded count:** 1 (regulatory-hipaa)

#### 3.6.5 Claim surface behavior

This surface's claim is **informational only** (`informationalOnly: true`). It displays readiness detail including internal-only states for operator awareness but does not modify market definitions. The operator cannot change readiness states from this surface.

---

### 3.7 Pack Catalog and Eligibility (`control-plane.packs.catalog`)

**Screen contract:** `control-plane.packs.catalog.json`  
**Inventory entry:** §9.3  
**Navigation level:** Primary  
**Read/write posture:** Controlled-write  
**Claim surface:** Yes — `control-plane-provisioning` with domains `[pack-eligibility, capability]`  
**Implementation posture:** Deferred

#### 3.7.1 Purpose

The pack catalog is the platform operator's view of all registered packs, their lifecycle states, eligibility rules, capability contributions, and adapter requirements. This is a platform-wide surface — distinct from `tenant-admin.content.catalog` which manages pack enablement within a single tenant.

#### 3.7.2 Data sources

| Source | API operation | Contract |
|--------|--------------|----------|
| Pack list | `GET /packs` | OpenAPI (`listPacks`) |

**Source of truth:** `platform-pack-catalog` (platform-governance domain class).

#### 3.7.3 Visible data regions

**Region A — Filter bar:**

| Control | Type | Behavior |
|---------|------|----------|
| Pack Family filter | Multi-select dropdown | language, locale, regulatory, national-standards, payer, specialty, tenant-overlay |
| Lifecycle filter | Multi-select dropdown | draft, validated, tested, published, activated, deactivated, retired |
| Search | Text input | Searches on `packId`, display name |

**Region B — Pack table:**

| Column | Source field | Notes |
|--------|-------------|-------|
| Pack Name | `displayName` or `packId` | Primary text |
| Pack ID | `packId` | Monospace |
| Family | `packFamily` | Badge with family-specific color |
| Lifecycle | `lifecycleState` | Badge |
| Version | `version` | Semver |
| Capabilities | count of contributed capabilities | Integer with drill to detail |
| Markets | count of markets where this pack is mandated/default-on/eligible | Integer |
| Adapter | adapter requirement indicator | Check/X for adapter availability |

**Region C — Pagination:**

Server-side pagination with page size selector.

#### 3.7.4 Operator actions

| Action | Type | Target | Precondition |
|--------|------|--------|-------------|
| View pack detail | Drill (row click) | Pack detail view (sub-surface) | Passes `packId` |
| Create pack manifest draft | Controlled write | `POST /packs` | Operator has `control-plane:packs:write` — **contracted (Batch 3), implementation pending** |
| Update pack manifest draft | Controlled write | `PUT /packs/{packId}` | Pack is `draft` — **contracted (Batch 3), implementation pending** |
| Submit pack for review | Controlled write | `POST /packs/{packId}:submit-review` | Pack is `draft` — **contracted (Batch 3), implementation pending** |
| Refresh | Button | Re-fetches pack list | — |

**Write actions are contracted (Batch 3).** Pack create, update, and submit-for-review API operations are defined in the OpenAPI contract (v0.3.0). Until implementation is wired, controls show as disabled with "integration-pending" indicator.

#### 3.7.5 Pack variation sensitivity

This surface has `packVariationSensitivity: multi-dimensional`. This means:
- Pack content varies across multiple dimensions (language, market, specialty)
- The catalog surface shows packs from ALL dimensions — it is not filtered by one market
- Pack eligibility rules may reference specific markets (e.g., payer-philhealth is eligible only in PH)
- The operator sees the full catalog with eligibility scope annotated per pack

#### 3.7.6 PH truth constraints

PH-specific packs in the catalog:
- `regulatory-philhealth-doh`: regulatory family, draft lifecycle
- `standards-ph`: national-standards family, draft lifecycle
- `payer-philhealth`: payer family, draft lifecycle
- `lang-fil`: language family, draft lifecycle (eligible for PH but not currently resolvable due to eligibility-failed)
- `locale-ph`: locale family, draft lifecycle

All PH packs are at draft lifecycle — the catalog truthfully displays this state.

---

### 3.8 Platform System Configuration (`control-plane.system.config`)

**Screen contract:** `control-plane.system.config.json`  
**Inventory entry:** §9.4  
**Navigation level:** Primary  
**Read/write posture:** Controlled-write  
**Claim surface:** None  
**Implementation posture:** Full-replacement (platform-native, no VistA equivalent)

#### 3.8.1 Purpose

Platform-wide settings surface. Operators view and manage deployment profiles, feature flags, system parameters, and runtime configuration. This surface is completely pack-independent — no pack variation affects content or visibility.

#### 3.8.2 Data sources

| Source | API operation | Contract |
|--------|--------------|----------|
| System config | `GET /system-config` | OpenAPI (`getSystemConfig`) |

**Source of truth:** `platform-system-configuration` (platform-governance domain class). Write operations (`updateFeatureFlag`, `updateSystemParameter`) are contracted in the Batch 3 OpenAPI (v0.3.0).

#### 3.8.3 Visible data regions

**Region A — Deployment profile:**

| Field | Source | Notes |
|-------|--------|-------|
| Current Profile | `deploymentProfile` | e.g., development, staging, production |
| Runtime Mode | `runtimeMode` | dev, test, rc, prod |
| API Version | `apiVersion` | Current API version |
| Platform Version | `platformVersion` | Semver |

**Region B — Feature flags:**

| Column | Source | Notes |
|--------|--------|-------|
| Flag Key | `flagKey` | Monospace |
| Display Name | `displayName` | Human-readable |
| Status | `enabled` | Toggle (true/false) |
| Scope | `scope` | platform-wide, per-tenant, etc. |
| Last Modified | `updatedAt` | Timestamp |

**Region C — System parameters:**

Key-value table of configurable system parameters grouped by category (security, performance, integration, observability).

| Column | Source | Notes |
|--------|--------|-------|
| Category | `category` | Section header |
| Parameter | `paramKey` | Key name |
| Current Value | `value` | Displayed value |
| Default | `defaultValue` | For comparison |
| Description | `description` | Help text |

#### 3.8.4 Operator actions

| Action | Precondition | Behavior |
|--------|-------------|----------|
| Toggle feature flag | Flag exists | Calls `PUT /system-config/feature-flags/{flagKey}` — **contracted (Batch 3), implementation pending** |
| Update parameter | Parameter is editable | Calls `PUT /system-config/parameters/{paramKey}` — **contracted (Batch 3), implementation pending** |
| Refresh | — | Re-fetches `GET /system-config` |

**Write actions are contracted (Batch 3).** Feature flag toggle and parameter update API operations are defined in the OpenAPI contract (v0.3.0). Until implementation is wired, write controls show as disabled with "integration-pending" indicator.

#### 3.8.5 PH truth constraints

System configuration is market-independent. No PH-specific constraints apply — this surface shows the same content regardless of which markets are configured.

---

## 4. Cross-surface navigation summary

| From surface | To surface | Trigger | Context passed |
|-------------|-----------|---------|----------------|
| `tenants.list` | `tenants.detail` | Row click | `tenantId` |
| `tenants.list` | `tenants.bootstrap` | "Create tenant" action | — |
| `tenants.detail` | `tenants.bootstrap` | "Launch bootstrap" action | `tenantId` |
| `tenants.detail` | `provisioning.runs` | "View run" link | `provisioningRunId` |
| `tenants.detail` | tenant-admin workspace | "Open admin" action | `tenantId` (cross-workspace) |
| `tenants.bootstrap` | `provisioning.runs` | After submission; link | `bootstrapRequestId` |
| `markets.management` | `markets.detail` | Row click | `legalMarketId` |
| `markets.detail` | `tenants.bootstrap` | "Bootstrap for market" action | `legalMarketId` |

---

## 5. Deferred controls inventory

Controls specified above that require API operations not yet defined:

| Control | Surface | Required API | Status |
|---------|---------|-------------|--------|
| Tenant list fetch | `tenants.list` | `GET /tenants` | Added (`listTenants`) |
| Tenant detail fetch | `tenants.detail` | `GET /tenants/{tenantId}` | Added (`getTenant`) |
| Tenant suspend | `tenants.detail` | `POST /tenants/{tenantId}/suspend` | Contracted (Batch 2 — `suspendTenant`) |
| Tenant reactivate | `tenants.detail` | `POST /tenants/{tenantId}/reactivate` | Contracted (Batch 2 — `reactivateTenant`) |
| Tenant archive | `tenants.detail` | `POST /tenants/{tenantId}/archive` | Contracted (Batch 2 — `archiveTenant`) |
| Market list fetch | `markets.management` | `GET /legal-market-profiles` | Added (`listLegalMarketProfiles`) |
| Market write ops | `markets.management` | `POST /legal-market-profiles`, `PUT /legal-market-profiles/{id}`, `POST .../submit-review` | Contracted (Batch 3 — `createLegalMarketProfileDraft`, `updateLegalMarketProfileDraft`, `submitLegalMarketProfileForReview`) |
| Pack list fetch | `packs.catalog` | `GET /packs` | Added (`listPacks`) |
| Pack write ops | `packs.catalog` | `POST /packs`, `PUT /packs/{id}`, `POST .../submit-review` | Contracted (Batch 3 — `createPackManifestDraft`, `updatePackManifestDraft`, `submitPackManifestForReview`) |
| Provisioning run list | `provisioning.runs` | `GET /provisioning-runs` | Added (`listProvisioningRuns`) |
| Provisioning cancel | `provisioning.runs` | `POST /provisioning-runs/{id}/cancel` | Contracted (Batch 2 — `cancelProvisioningRun`) |
| System config fetch | `system.config` | `GET /system-config` | Added (`getSystemConfig`) |
| Feature flag toggle | `system.config` | `PUT /system-config/feature-flags/{flagKey}` | Contracted (Batch 3 — `updateFeatureFlag`) |
| Parameter update | `system.config` | `PUT /system-config/parameters/{paramKey}` | Contracted (Batch 3 — `updateSystemParameter`) |

---

## 6. API operations required — summary

New read-side operations this page-spec requires:

1. `GET /tenants` — list tenants with pagination and filters (status, market, search) — **added** (`listTenants`)
2. `GET /tenants/{tenantId}` — single tenant detail — **added** (`getTenant`)
3. `GET /legal-market-profiles` — list all legal-market profile summaries — **added** (`listLegalMarketProfiles`)
4. `GET /provisioning-runs` — list provisioning runs with `bootstrapRequestId` filter — **added** (`listProvisioningRuns`)
5. `GET /tenant-bootstrap-requests` — list bootstrap requests with filters — **added** (`listTenantBootstrapRequests`)
6. `GET /packs` — list packs with filters (family, lifecycle, market eligibility, search) — **added** (`listPacks`)
7. `GET /system-config` — read current platform system configuration — **added** (`getSystemConfig`)

Existing operations that are sufficient:
- `getLegalMarketProfile` — used by `markets.detail`
- `resolveEffectiveConfigurationPlan` — used by `tenants.bootstrap`
- `createTenantBootstrapRequest` — used by `tenants.bootstrap`
- `getTenantBootstrapRequest` — used by `tenants.bootstrap` and `tenants.detail`
- `createProvisioningRun` — used by `provisioning.runs`
- `getProvisioningRun` — used by `provisioning.runs` and `tenants.detail`

---

## 7. Verification checklist

- [ ] Every surface in §9.1–§9.8 has a corresponding page spec in this document
- [ ] Every data source in page specs traces to a screen-contract `dataSources[]` entry or an identified API gap
- [ ] Every operator action traces to an API operation (existing or deferred)
- [ ] PH truth constraints are documented for every surface where market affects content
- [ ] Navigation graph is consistent with screen-contract `crossWorkspaceTransitions` and `navigationLevel`
- [ ] No screen-inventory fields were modified
- [ ] No screen-contract JSON instances were modified
- [ ] No JSON schemas were modified
- [ ] No runtime or UI code was produced
