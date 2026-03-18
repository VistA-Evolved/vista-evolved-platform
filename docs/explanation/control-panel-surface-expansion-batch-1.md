# Control-Panel Surface Expansion — Batch 1

> **Artifact:** `docs/explanation/control-panel-surface-expansion-batch-1.md`
> **Repo:** `vista-evolved-platform`
> **Namespace:** VE-PLAT
> **Type:** Explanation — planning-stage surface expansion rationale
> **Status:** Draft — pending human review
> **Date:** 2025-07-22

---

## 1. Purpose and scope

### 1.1 What this document is

This document explains **why the existing four control-plane surfaces are insufficient to represent the operator-facing capabilities already contracted in the repo**, and defines the first bounded batch of four additional surfaces that close the gap.

It is a **planning-stage explanation artifact** that:

- Identifies specific gaps between contracted API/event operations and inventoried operator surfaces.
- Proposes four new surface IDs with full field-level justification.
- Binds each surface to exact OpenAPI operations, AsyncAPI events, and governing specification sections.
- Produces inputs consumed by the screen inventory, permissions matrix, and pack visibility rules.

### 1.2 What this document is NOT

| Not this | Why not |
|----------|---------|
| Implementation authorization | No code, no routes, no UI wireframes, no schema changes. This document authorizes planning artifacts only. |
| Screen-contract JSON instance generator | Screen-contract instances are a separate downstream artifact. |
| OpenAPI or AsyncAPI mutation | The existing contracts are not modified. This document reads them. |
| Tenant-admin, clinical, IT, or ancillary surface expansion | Only control-plane workspace surfaces are in scope. |
| Public self-service signup, billing, support, audit-trail, ops-center surfaces | Explicitly excluded per scoping rules. |

### 1.3 Position in the handoff chain

| Predecessor | What it provides |
|------------|-----------------|
| Screen inventory (§9, 4 existing control-plane surfaces) | Existing surface IDs, field patterns, inventory structure |
| Permissions matrix (§7A, 4 existing surfaces) | Existing PO-only permission posture, action-class structure |
| Pack visibility rules (§8.1, 4 existing surfaces) | Existing base-visible posture, visibility model |
| OpenAPI: control-plane-operator-bootstrap-and-provisioning (6 operations) | API operations that serve surfaces not yet inventoried |
| AsyncAPI: control-plane-provisioning-events (7 events) | Lifecycle events consumed by operator surfaces not yet inventoried |
| Contract map: control-plane-operator-bootstrap-and-provisioning-contract-map (8 sections) | Operator action → API/event binding that implies surfaces |
| Workspace map §11 | Control-plane workspace definition, role mapping |
| Legal-market-profile instance PH.json | Concrete market data that the markets.detail surface would display |
| Effective-tenant-configuration-plan instance PH-single-clinic-core.json | Concrete plan data that the bootstrap surface would display |

| Successor | What it consumes |
|----------|-----------------|
| Screen inventory update | 4 new surface entries (§9.5–§9.8) |
| Permissions matrix update | 4 new rows in §7A.1–§7A.6 |
| Pack visibility rules update | 4 new rows in §8.1 |
| Source-of-truth index update | 1 new row for this explanation doc |
| Screen-contract instances (future) | Surface IDs, field values, API/event bindings |

---

## 2. Plane distinctions

Per the global system architecture spec and workspace map:

- **Control plane** manages the enterprise: tenants, markets, packs, system configuration, provisioning lifecycle. Audience: platform operators only.
- **Tenant-admin plane** manages one tenant's operational configuration: users, facilities, modules, content. Audience: tenant administrators with limited platform-operator and IT cross-access.
- **Clinical plane** delivers patient care surfaces: terminal sessions, clinical functional surfaces. Audience: clinicians and ancillary staff.

The four surfaces in this batch are **control-plane only**. They do not extend into tenant-admin, clinical, or IT workspaces. The bootstrap and provisioning surfaces serve the operator who creates and provisions tenants — they do not serve the tenant administrator who later configures the provisioned tenant.

---

## 3. Why current artifacts are insufficient

### 3.1 The gap

The repo currently contains:

1. **4 concrete control-plane surfaces** in the screen inventory (§9.1–§9.4): tenants.list, markets.management, packs.catalog, system.config.
2. **6 OpenAPI operations** in the bootstrap/provisioning contract: getLegalMarketProfile, resolveEffectiveConfigurationPlan, createTenantBootstrapRequest, getTenantBootstrapRequest, createProvisioningRun, getProvisioningRunStatus.
3. **7 AsyncAPI events** in the provisioning events contract: tenant.bootstrap.requested, effective-plan.resolved, provisioning.run.requested, provisioning.run.started, provisioning.step.changed, provisioning.run.completed, provisioning.run.failed.
4. **A contract map** (8 sections) that binds operator actions to API operations and events.
5. **Concrete JSON instances** for PH legal-market profile and PH-single-clinic-core effective plan.

The gap: the OpenAPI/AsyncAPI contracts define operations that serve **surfaces not yet inventoried**. Specifically:

| Contracted operation | Implies surface | Currently inventoried? |
|---------------------|----------------|----------------------|
| getLegalMarketProfile | A surface to view a single market's readiness/profile | No — only `markets.management` (list/management) exists |
| resolveEffectiveConfigurationPlan | A surface to initiate and review plan resolution | No — no bootstrap surface exists |
| createTenantBootstrapRequest | A surface to submit and track bootstrap requests | No — only `tenants.list` (lifecycle) exists |
| getTenantBootstrapRequest | A surface to view bootstrap request status | No — same gap |
| createProvisioningRun | A surface to initiate and monitor provisioning runs | No — no provisioning surface exists |
| getProvisioningRunStatus | A surface to view provisioning run status/progress | No — same gap |

Additionally, the contract map §3 describes an operator action ("Review a legal-market profile for one specific market") that implies a single-market detail surface distinct from the market management list. And the tenant lifecycle model implies a single-tenant detail surface as the drill target from the tenant list.

### 3.2 Why the gap matters

Without these surfaces being inventoried, the permissions matrix and pack visibility rules cannot cover the operator workflows that the contracts define. The planning artifacts are incomplete relative to the contracted truth.

---

## 4. Stop-and-reconcile table

This table maps each contracted resource/operation/event to either an existing surface or a gap that Batch 1 closes.

| Contract element | Type | Existing surface | Gap? | Batch 1 resolution |
|-----------------|------|-----------------|------|-------------------|
| Tenant list / lifecycle | Implied by workspace map §11 | `control-plane.tenants.list` (§9.1) | No | — |
| Single tenant detail / action launch | Implied by tenants.list drill target | — | **Yes** | `control-plane.tenants.detail` |
| getLegalMarketProfile | OpenAPI GET | — | **Yes** | `control-plane.markets.detail` |
| Market list / management | Implied by workspace map §11 | `control-plane.markets.management` (§9.2) | No | — |
| resolveEffectiveConfigurationPlan | OpenAPI POST | — | **Yes** | `control-plane.tenants.bootstrap` |
| createTenantBootstrapRequest | OpenAPI POST | — | **Yes** | `control-plane.tenants.bootstrap` |
| getTenantBootstrapRequest | OpenAPI GET | — | **Yes** | `control-plane.tenants.bootstrap` |
| createProvisioningRun | OpenAPI POST | — | **Yes** | `control-plane.provisioning.runs` |
| getProvisioningRunStatus | OpenAPI GET | — | **Yes** | `control-plane.provisioning.runs` |
| tenant.bootstrap.requested | AsyncAPI event | — | **Yes** | Consumed by `control-plane.tenants.bootstrap` |
| effective-plan.resolved | AsyncAPI event | — | **Yes** | Consumed by `control-plane.tenants.bootstrap` |
| provisioning.run.requested | AsyncAPI event | — | **Yes** | Consumed by `control-plane.provisioning.runs` |
| provisioning.run.started | AsyncAPI event | — | **Yes** | Consumed by `control-plane.provisioning.runs` |
| provisioning.step.changed | AsyncAPI event | — | **Yes** | Consumed by `control-plane.provisioning.runs` |
| provisioning.run.completed | AsyncAPI event | — | **Yes** | Consumed by `control-plane.provisioning.runs` |
| provisioning.run.failed | AsyncAPI event | — | **Yes** | Consumed by `control-plane.provisioning.runs` |
| Pack catalog / eligibility | Implied by workspace map §11 | `control-plane.packs.catalog` (§9.3) | No | — |
| System configuration | Implied by workspace map §11 | `control-plane.system.config` (§9.4) | No | — |

**Summary:** 4 existing surfaces cover 4 of the 18 contract elements. 14 contract elements have no surface. Batch 1 introduces 4 surfaces that cover all 14 gaps.

---

## 5. Batch 1 surface list with rationale

### 5.1 `control-plane.tenants.detail`

**Rationale:** The existing `tenants.list` surface provides a tenant registry (list view). Standard operator workflow requires drilling into a single tenant to see its configuration summary, bootstrap history, provisioning status, and available actions (launch bootstrap, view runs, transition to tenant-admin). The contract map §3 and workspace map §11.2 imply this drill target. Without it, the operator has no single-tenant context surface.

**API binding:** This surface reads platform-native tenant state (tenant registry data). It does not directly call bootstrap/provisioning API operations — it is the launch point for surfaces that do.

**Evidence posture:** `evidenced-in-current-repo-truth` — workspace map §11.2 defines control-plane drill patterns, contract map §3 describes single-tenant context.

### 5.2 `control-plane.tenants.bootstrap`

**Rationale:** The bootstrap/provisioning OpenAPI contract defines three directly bound operations: `resolveEffectiveConfigurationPlan` (resolve a plan from market + operator selections), `createTenantBootstrapRequest` (submit a bootstrap request referencing a resolved plan), and `getTenantBootstrapRequest` (check bootstrap request status). The AsyncAPI contract defines two directly consumed events: `tenant.bootstrap.requested` and `effective-plan.resolved`. Contract map §4–§5 describe the operator actions that these operations serve: reviewing the resolved plan (including deferred items and gating blockers), confirming or adjusting selections, and submitting the bootstrap request.

**Naming:** Outcome-oriented (`bootstrap`), not layout-opinionated. The interaction model (wizard, multi-step form, review-and-submit) is a rendering choice, not a surface identity.

**API binding:** 3 OpenAPI operations + 2 AsyncAPI events.

**Evidence posture:** `evidenced-in-current-repo-truth` — directly bound to contracted operations.

### 5.3 `control-plane.provisioning.runs`

**Rationale:** The OpenAPI contract defines two directly bound operations: `createProvisioningRun` (initiate an async provisioning run) and `getProvisioningRunStatus` (check run status). The AsyncAPI contract defines five directly consumed events: `provisioning.run.requested`, `provisioning.run.started`, `provisioning.step.changed`, `provisioning.run.completed`, `provisioning.run.failed`. Contract map §6 describes the operator actions: monitoring step progress, diagnosing blockers, retrying failed runs.

**API binding:** 2 OpenAPI operations + 5 AsyncAPI events. The provisioning model is fully asynchronous — no OpenAPI endpoint returns synchronous provisioning success.

**Evidence posture:** `evidenced-in-current-repo-truth` — directly bound to contracted operations and events.

### 5.4 `control-plane.markets.detail`

**Rationale:** The existing `markets.management` surface provides a list/management view of all legal markets. The OpenAPI contract defines `getLegalMarketProfile` which returns a single market's readiness summary (mandated/default-on/eligible/excluded packs, readiness dimensions, launch tier). The contract map §3 describes the operator action of reviewing a specific market's profile before initiating bootstrap. The PH.json instance provides concrete evidence of what this surface would display.

**API binding:** 1 OpenAPI operation (`getLegalMarketProfile`).

**Evidence posture:** `evidenced-in-current-repo-truth` — directly bound to a contracted operation with a concrete instance (PH.json).

---

## 6. Surface-to-service/API/event binding table

| Surface ID | OpenAPI operations consumed | AsyncAPI events consumed | Contract map sections | Other governing references |
|-----------|---------------------------|-------------------------|----------------------|---------------------------|
| `control-plane.tenants.detail` | — (platform-native tenant read) | — | §3 (review market profile context) | Workspace map §11.2, VE-PLAT-ADR-0003 |
| `control-plane.tenants.bootstrap` | `resolveEffectiveConfigurationPlan`, `createTenantBootstrapRequest`, `getTenantBootstrapRequest` | `tenant.bootstrap.requested`, `effective-plan.resolved` | §4 (plan resolution), §5 (bootstrap request) | Workspace map §11.2, legal-market composition spec |
| `control-plane.provisioning.runs` | `createProvisioningRun`, `getProvisioningRunStatus` | `provisioning.run.requested`, `provisioning.run.started`, `provisioning.step.changed`, `provisioning.run.completed`, `provisioning.run.failed` | §6 (provisioning lifecycle) | Workspace map §11.2 |
| `control-plane.markets.detail` | `getLegalMarketProfile` | — (may consume `effective-plan.resolved` for context) | §3 (market profile review) | Workspace map §11.2, country-payer readiness spec, capability truth spec |

---

## 7. Field-level explanation

Each new surface's field values are documented in the screen inventory entries (§9.5–§9.8). This section explains non-obvious field decisions.

### 7.1 Scope posture

All four surfaces use `platform-wide` scope posture. This is consistent with all existing control-plane surfaces. The `entityContextRequired` field varies:

| Surface | entityContextRequired | Why |
|---------|---------------------|-----|
| tenants.detail | `tenantId` | Displays a single tenant's state |
| tenants.bootstrap | `tenantId` | Bootstrap is for a specific tenant (new or existing) |
| provisioning.runs | `provisioningRunId` | Tracks a specific provisioning run |
| markets.detail | `legalMarketId` | Displays a single legal market's profile |

`platform-wide` scope means the operator accesses these surfaces through the control-plane workspace, not through a tenant-scoped workspace. The `entityContextRequired` field specifies what entity identifier the surface needs in its URL/route context — it does not change the scope posture.

### 7.2 readWritePosture

| Surface | readWritePosture | Justification |
|---------|-----------------|---------------|
| tenants.detail | `mixed` | Reads tenant state + launches actions (bootstrap, transition to tenant-admin) |
| tenants.bootstrap | `controlled-write` | Writes: plan resolution, bootstrap request submission. All writes governed by API validation + plan constraints. |
| provisioning.runs | `mixed` | Reads run status + writes: initiate run, retry failed runs. |
| markets.detail | `read-only` | getLegalMarketProfile is a pure read operation. Market definitions are controlled via markets.management, not here. |

### 7.3 claimSurface

| Surface | claimSurface | Justification |
|---------|-------------|---------------|
| tenants.detail | null | Governance/navigation surface. No readiness claims. |
| tenants.bootstrap | `{ claimSurfaceType: "control-plane-provisioning", claimDomains: ["bootstrap", "plan-resolution"], informationalOnly: false }` | Displays plan resolution results including deferred items and gating blockers. These are first-class claim-adjacent data per the contract map. |
| provisioning.runs | `{ claimSurfaceType: "control-plane-provisioning", claimDomains: ["provisioning-lifecycle"], informationalOnly: false }` | Displays provisioning step status including blockers. Provisioning lifecycle is a claim-adjacent concern. |
| markets.detail | `{ claimSurfaceType: "control-plane-provisioning", claimDomains: ["market", "readiness"], informationalOnly: true }` | Displays market readiness dimensions including internal-only states. Informational — shows readiness, does not modify it. |

### 7.4 packVariationSensitivity and visibility posture

| Surface | packVariationSensitivity | Visibility posture | Justification |
|---------|-------------------------|-------------------|---------------|
| tenants.detail | `none` | `base-visible` | Tenant detail is a governance view. No pack gates it. |
| tenants.bootstrap | `country-regulatory` | `base-visible` | Bootstrap plan resolution is market-dependent (resolved packs vary by legal market). But the surface itself is always visible to platform operators — they must be able to bootstrap for any market. Content variation, not visibility gating. |
| provisioning.runs | `none` | `base-visible` | Provisioning lifecycle tracking is pack-independent. Steps may involve pack activation, but the monitoring surface is infrastructure governance. |
| markets.detail | `country-regulatory` | `base-visible` | Same reasoning as existing `control-plane.markets.management` — operators must see all markets. Content varies by market; visibility does not. |

### 7.5 navigationLevel

All four surfaces are `local` — they are drill targets from existing primary surfaces (tenants.list, markets.management) or from sibling local surfaces (tenants.detail → tenants.bootstrap → provisioning.runs). The workspace map §9.1 defines two surface-level navigation tiers: `primary` and `local`. These surfaces are `local` because they are sub-areas and detail views within a functional area.

### 7.6 initialImplementationPosture

| Surface | initialImplementationPosture | Justification |
|---------|------------------------------|---------------|
| tenants.detail | `full-replacement` | Platform-native surface with no VistA counterpart. Same posture as tenants.list. |
| tenants.bootstrap | `deferred` | Bootstrap workflow requires API implementation, plan resolution engine, and bootstrap request processing. All are future implementation. |
| provisioning.runs | `deferred` | Provisioning orchestration is a future implementation concern. |
| markets.detail | `deferred` | Depends on legal-market profile API implementation. |

---

## 8. Deferred items

The following items are architecturally implied but not part of Batch 1:

| Deferred item | Why deferred | Future trigger |
|--------------|-------------|---------------|
| `control-plane.provisioning.steps` (detail of individual provisioning steps) | Step-level detail is available via getProvisioningRunStatus response. A separate surface may not be needed — the provisioning.runs surface can display step detail inline. | Reassess when provisioning orchestrator is implemented. |
| `control-plane.bootstrap-requests.list` (list of all bootstrap requests across tenants) | Currently, bootstrap request access is via tenants.detail or tenants.bootstrap. A cross-tenant list may be needed for operational reporting. | Reassess when bootstrap volume justifies a dedicated list surface. |
| `control-plane.plans.list` (list of resolved effective plans) | Plans are accessed through bootstrap workflow context. A standalone plan browser may be needed for operational auditing. | Reassess when plan retention and auditing policies are defined. |
| `control-plane.markets.readiness-dashboard` (aggregate market readiness across all markets) | The markets.management surface already provides list view. A specialized readiness dashboard depends on readiness infrastructure that does not yet exist. | Reassess when country-payer readiness registry infrastructure is built. |
| Billing, support, audit-trail, ops-center, public-signup surfaces | Explicitly excluded from control-plane surface planning per scoping rules. | Governed by separate architecture decisions. |

---

## 9. No implementation authorization

This document expands **planning-layer artifacts only**:

- Screen inventory entries (surface IDs, field values, governing references)
- Permissions matrix rows (role × surface × action decisions)
- Pack visibility rules (visibility postures per surface)

It does **not** authorize:

- Code generation (routes, handlers, resolvers, UI components)
- Screen-contract JSON instances
- OpenAPI or AsyncAPI contract mutations
- Database schema changes
- Infrastructure provisioning

Each of those requires a separate bounded slice with its own task authorization, implementation, and verification.

---

## 10. Downstream handoff

### 10.1 Immediate consumers (this batch)

| Consumer artifact | What it receives | Action |
|------------------|-----------------|--------|
| Screen inventory (§9) | 4 new surface entries (§9.5–§9.8) | Add entries after existing §9.4 |
| Permissions matrix (§7A) | 4 new rows per action-class table | Add rows to §7A.1–§7A.6, update §7A.7 notes |
| Pack visibility rules (§8.1) | 4 new visibility posture entries | Add rows to §8.1 table, update workspace A summary |
| Source-of-truth index | 1 new row | Register this explanation doc |

### 10.2 Future consumers (not authorized in this batch)

| Future artifact | What it would consume | Dependency |
|----------------|----------------------|------------|
| Screen-contract JSON instances | Surface IDs, field values, API/event bindings | Requires task authorization + schema validation |
| UI wireframes / layout planning | Surface inventory + permissions + visibility + contracts | Requires design authorization |
| Implementation routes / handlers | Screen contracts + OpenAPI operations | Requires implementation authorization |
| Provisioning orchestrator design | provisioning.runs surface definition + AsyncAPI events | Requires architecture decision |
