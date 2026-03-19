# Control-Panel Action Semantics and Source-of-Truth Binding — Batch 1

> **Status:** Draft  
> **Scope:** 8 canonical control-plane surfaces  
> **Audience:** Implementation engineers, contract reviewers, QA  
> **Not authorized:** This document specifies action binding; it does not authorize runtime implementation.

---

## 1. Purpose

This document is the **master action matrix** binding every operator action across the 8 control-plane surfaces to:

1. **API operation** — the OpenAPI or AsyncAPI operation that fulfills the action
2. **Source of truth** — the authoritative data store or registry
3. **Permission** — the required RBAC permission claim
4. **Precondition** — what must be true before the action is available
5. **Outcome** — what changes in the system after the action completes
6. **Audit event** — what gets logged

### Position in handoff chain

```
Screen contracts → Screen inventory → Page specs → THIS DOCUMENT → Design contract → Implementation
                                                    ↓
                                              OpenAPI / AsyncAPI contracts
```

### Governing references

| Reference | Location |
|-----------|----------|
| Page specifications | `docs/explanation/control-panel-page-specs-and-operator-manual-batch-1.md` |
| OpenAPI contract | `packages/contracts/openapi/control-plane-operator-bootstrap-and-provisioning.openapi.yaml` |
| AsyncAPI contract | `packages/contracts/asyncapi/control-plane-provisioning-events.asyncapi.yaml` |
| Bootstrap/provisioning contract map | `docs/explanation/control-plane-operator-bootstrap-and-provisioning-contract-map.md` |
| Permissions matrix | `docs/reference/permissions-matrix.md` |
| Capability truth | `docs/explanation/capability-truth-and-claim-gating-spec.md` |

---

## 2. Permission model

All 8 control-plane surfaces are restricted to the `platform-operator` role. The permission model is flat for Batch 1:

| Permission claim | Grants | Surfaces |
|-----------------|--------|----------|
| `control-plane:read` | View any control-plane surface | All 8 surfaces |
| `control-plane:tenant:bootstrap` | Initiate bootstrap requests | `tenants.bootstrap` |
| `control-plane:provisioning:manage` | Create/retry/cancel provisioning runs | `provisioning.runs` |
| `control-plane:tenant:lifecycle` | Suspend/reactivate/archive tenants | `tenants.detail` |
| `control-plane:config:write` | Modify system configuration | `system.config` |
| `control-plane:packs:write` | Modify pack catalog | `packs.catalog` |
| `control-plane:markets:write` | Modify market profiles | `markets.management` |

**Note:** Write permissions for config, packs, and markets are contracted in the Batch 3 OpenAPI (W9–W16).

---

## 3. Master action matrix

### 3.1 Read actions (data fetching)

| # | Action | Surface | API Operation | HTTP | Source of Truth | Permission | Status |
|---|--------|---------|---------------|------|-----------------|------------|--------|
| R1 | List tenants | `tenants.list` | `listTenants` | `GET /tenants` | platform-tenant-registry | `control-plane:read` | Exists |
| R2 | Get tenant detail | `tenants.detail` | `getTenant` | `GET /tenants/{tenantId}` | platform-tenant-registry | `control-plane:read` | Exists |
| R3 | List bootstrap requests for tenant | `tenants.detail` | `listTenantBootstrapRequests` | `GET /tenant-bootstrap-requests?tenantId={id}` | platform-governance | `control-plane:read` | Exists |
| R4 | Get bootstrap request status | `tenants.bootstrap` | `getTenantBootstrapRequest` | `GET /tenant-bootstrap-requests/{id}` | platform-governance | `control-plane:read` | Exists |
| R5 | Get provisioning run status | `provisioning.runs` | `getProvisioningRun` | `GET /provisioning-runs/{id}` | platform-governance | `control-plane:read` | Exists |
| R6 | List provisioning runs | `provisioning.runs` | `listProvisioningRuns` | `GET /provisioning-runs?bootstrapRequestId={id}` | platform-governance | `control-plane:read` | Exists |
| R7 | Get legal-market profile | `markets.detail` | `getLegalMarketProfile` | `GET /legal-market-profiles/{id}` | claim-readiness-registry | `control-plane:read` | Exists |
| R8 | List legal-market profiles | `markets.management` | `listLegalMarketProfiles` | `GET /legal-market-profiles` | claim-readiness-registry | `control-plane:read` | Exists |
| R9 | List packs | `packs.catalog` | `listPacks` | `GET /packs` | platform-pack-catalog | `control-plane:read` | Exists |
| R10 | Get system config | `system.config` | `getSystemConfig` | `GET /system-config` | platform-system-configuration | `control-plane:read` | Exists |

### 3.2 Write actions (mutations)

| # | Action | Surface | API Operation | HTTP | Source of Truth | Permission | Precondition | Outcome | Status |
|---|--------|---------|---------------|------|-----------------|------------|-------------|---------|--------|
| W1 | Resolve effective plan | `tenants.bootstrap` | `resolveEffectiveConfigurationPlan` | `POST /effective-configuration-plans:resolve` | platform-governance | `control-plane:tenant:bootstrap` | Market selected | Returns PlanResolutionResult with resolvedPacks, deferredItems, readinessPosture | Exists |
| W2 | Submit bootstrap request | `tenants.bootstrap` | `createTenantBootstrapRequest` | `POST /tenant-bootstrap-requests` | platform-governance | `control-plane:tenant:bootstrap` | Plan resolved; effectivePlanId valid and not expired | 202 Accepted; creates bootstrapRequestId; emits `tenant.bootstrap.requested` | Exists |
| W3 | Initiate provisioning run | `provisioning.runs` | `createProvisioningRun` | `POST /provisioning-runs` | platform-governance | `control-plane:provisioning:manage` | Bootstrap request approved; no run in progress for this request | 202 Accepted; creates provisioningRunId; emits `provisioning.run.requested` | Exists |
| W4 | Retry provisioning run | `provisioning.runs` | `createProvisioningRun` | `POST /provisioning-runs` | platform-governance | `control-plane:provisioning:manage` | Previous run is `failed`; same bootstrapRequestId | Creates new provisioningRunId; same semantics as W3 | Exists (reuse) |
| W5 | Cancel provisioning run | `provisioning.runs` | `cancelProvisioningRun` | `POST /provisioning-runs/{id}/cancel` | platform-governance | `control-plane:provisioning:manage` | Run is `queued` or `in-progress` | Run transitions to `cancelled` | Contracted |
| W6 | Suspend tenant | `tenants.detail` | `suspendTenant` | `POST /tenants/{id}/suspend` | platform-tenant-registry | `control-plane:tenant:lifecycle` | Tenant is `active` | Tenant status → `suspended` | Contracted |
| W7 | Reactivate tenant | `tenants.detail` | `reactivateTenant` | `POST /tenants/{id}/reactivate` | platform-tenant-registry | `control-plane:tenant:lifecycle` | Tenant is `suspended` | Tenant status → `active` | Contracted |
| W8 | Archive tenant | `tenants.detail` | `archiveTenant` | `POST /tenants/{id}/archive` | platform-tenant-registry | `control-plane:tenant:lifecycle` | Tenant is `suspended`; operator confirms | Tenant status → `archived`; irreversible | Contracted |
| W9 | Toggle feature flag | `system.config` | `updateFeatureFlag` | `PUT /system-config/feature-flags/{flagKey}` | platform-system-configuration | `control-plane:config:write` | Flag exists | Flag toggled; emits `system.config.feature-flag.updated` | Contracted |
| W10 | Update system parameter | `system.config` | `updateSystemParameter` | `PUT /system-config/parameters/{paramKey}` | platform-system-configuration | `control-plane:config:write` | Parameter is editable | Parameter updated; emits `system.config.parameter.updated` | Contracted |
| W11 | Create market profile draft | `markets.management` | `createLegalMarketProfileDraft` | `POST /legal-market-profiles` | claim-readiness-registry | `control-plane:markets:write` | Operator has write permission | Draft profile created; emits `market.profile.draft.created` | Contracted |
| W12 | Update market profile draft | `markets.management` | `updateLegalMarketProfileDraft` | `PUT /legal-market-profiles/{legalMarketId}` | claim-readiness-registry | `control-plane:markets:write` | Profile is `draft` | Draft profile updated; emits `market.profile.draft.updated` | Contracted |
| W13 | Submit market profile for review | `markets.management` | `submitLegalMarketProfileForReview` | `POST /legal-market-profiles/{legalMarketId}:submit-review` | claim-readiness-registry | `control-plane:markets:write` | Profile is `draft` | Status → `review-pending`; emits `market.profile.review.submitted` | Contracted |
| W14 | Create pack manifest draft | `packs.catalog` | `createPackManifestDraft` | `POST /packs` | platform-pack-catalog | `control-plane:packs:write` | Operator has write permission | Draft manifest created; emits `pack.manifest.draft.created` | Contracted |
| W15 | Update pack manifest draft | `packs.catalog` | `updatePackManifestDraft` | `PUT /packs/{packId}` | platform-pack-catalog | `control-plane:packs:write` | Pack is `draft` | Draft manifest updated; emits `pack.manifest.draft.updated` | Contracted |
| W16 | Submit pack manifest for review | `packs.catalog` | `submitPackManifestForReview` | `POST /packs/{packId}:submit-review` | platform-pack-catalog | `control-plane:packs:write` | Pack is `draft` | lifecycleState → `review-pending`; emits `pack.manifest.review.submitted` | Contracted |

### 3.3 Navigation actions (no API call)

| # | Action | From surface | To surface | Context passed | Mechanism |
|---|--------|-------------|-----------|----------------|-----------|
| N1 | Drill to tenant | `tenants.list` | `tenants.detail` | `tenantId` | Same-workspace nav (row click) |
| N2 | Create new tenant | `tenants.list` | `tenants.bootstrap` | — | Same-workspace nav (button) |
| N3 | Launch bootstrap | `tenants.detail` | `tenants.bootstrap` | `tenantId` | Same-workspace nav (action button) |
| N4 | View provisioning run | `tenants.detail` | `provisioning.runs` | `provisioningRunId` | Same-workspace nav (link) |
| N5 | Open tenant admin | `tenants.detail` | tenant-admin workspace | `tenantId` | Cross-workspace transition; access re-evaluation |
| N6 | Navigate to provisioning | `tenants.bootstrap` | `provisioning.runs` | `bootstrapRequestId` | Same-workspace nav (post-submission link) |
| N7 | Drill to market | `markets.management` | `markets.detail` | `legalMarketId` | Same-workspace nav (row click) |
| N8 | Bootstrap for market | `markets.detail` | `tenants.bootstrap` | `legalMarketId` | Same-workspace nav (action button) |
| N9 | Back to market list | `markets.detail` | `markets.management` | — | Breadcrumb nav |

---

## 4. Event bindings

### 4.1 Events produced by write actions

| Write action | Event emitted | AsyncAPI channel | Key payload fields |
|-------------|---------------|-------------------|-------------------|
| W1 (resolve plan) | `effective-plan.resolved` | `effectivePlanResolved` | effectivePlanId, legalMarketId, resolvedPackCount, deferredItemCount, effectiveLaunchTier |
| W2 (submit bootstrap) | `tenant.bootstrap.requested` | `tenantBootstrapRequested` | bootstrapRequestId, tenantId, effectivePlanId, legalMarketId, requestedBy |
| W3 (initiate run) | `provisioning.run.requested` | `provisioningRunRequested` | provisioningRunId, bootstrapRequestId, tenantId, effectivePlanId, legalMarketId |
| W9 (toggle flag) | `system.config.feature-flag.updated` | `systemConfigFeatureFlagUpdated` | flagKey, enabled, previousEnabled, updatedBy |
| W10 (update param) | `system.config.parameter.updated` | `systemConfigParameterUpdated` | paramKey, value, previousValue, updatedBy |
| W11 (create market) | `market.profile.draft.created` | `marketProfileDraftCreated` | legalMarketId, displayName, launchTier, requestedBy |
| W12 (update market) | `market.profile.draft.updated` | `marketProfileDraftUpdated` | legalMarketId, updatedFields, requestedBy |
| W13 (submit market) | `market.profile.review.submitted` | `marketProfileReviewSubmitted` | legalMarketId, submittedBy, justification |
| W14 (create pack) | `pack.manifest.draft.created` | `packManifestDraftCreated` | packId, packFamily, displayName, requestedBy |
| W15 (update pack) | `pack.manifest.draft.updated` | `packManifestDraftUpdated` | packId, updatedFields, requestedBy |
| W16 (submit pack) | `pack.manifest.review.submitted` | `packManifestReviewSubmitted` | packId, packFamily, submittedBy, justification |

### 4.2 Events consumed by surfaces

| Surface | Consumed events | UI behavior |
|---------|----------------|-------------|
| `tenants.bootstrap` | `tenant.bootstrap.requested`, `effective-plan.resolved` | Updates submission status region; refreshes plan review after re-resolution |
| `provisioning.runs` | All 5 provisioning events | Updates run status, step progress, blocker/failure display in real time |

### 4.3 Events not consumed by any Batch 1 surface

Batch 3 write events (W9–W16) are produced but their consumption by specific surfaces is implementation-deferred. All 7 original AsyncAPI events are consumed by at least one surface.

---

## 5. Source-of-truth binding matrix

| Source of Truth | Domain class | Surfaces that read | Surfaces that write | Data classification |
|----------------|-------------|-------------------|--------------------|--------------------|
| `platform-tenant-registry` | platform-governance | `tenants.list`, `tenants.detail` | `tenants.detail` (lifecycle ops — contracted) | configuration |
| `platform-governance` (bootstrap/provisioning) | platform-governance | `tenants.bootstrap`, `provisioning.runs`, `tenants.detail` | `tenants.bootstrap` (resolve, submit), `provisioning.runs` (create) | configuration / operational |
| `claim-readiness-registry` | claim-readiness-registry | `markets.management`, `markets.detail` | `markets.management` (W11–W13, contracted) | configuration |
| `platform-pack-catalog` | platform-governance | `packs.catalog` | `packs.catalog` (W14–W16, contracted) | configuration |
| `platform-system-configuration` | platform-governance | `system.config` | `system.config` (W9–W10, contracted) | configuration |

---

## 6. Claim surface binding

| Surface | claimSurfaceType | claimDomains | informationalOnly | gatingRuleRef | minimumReadinessState |
|---------|-----------------|-------------|-------------------|---------------|----------------------|
| `tenants.bootstrap` | control-plane-provisioning | capability, market, pack-eligibility | false | capability-truth-§11 | declared |
| `provisioning.runs` | control-plane-provisioning | provisioning-lifecycle | false | capability-truth-§11 | declared |
| `markets.management` | control-plane-provisioning | market, capability | false | capability-truth-§11 | — |
| `markets.detail` | control-plane-provisioning | market, readiness | **true** | capability-truth-§11 | declared |
| `packs.catalog` | control-plane-provisioning | pack-eligibility, capability | false | capability-truth-§11 | — |
| `tenants.list` | — | — | — | — | — |
| `tenants.detail` | — | — | — | — | — |
| `system.config` | — | — | — | — | — |

**Claim surface rules:**
- Surfaces with `informationalOnly: false` can enforce gating — operator actions are blocked when readiness is insufficient
- Surfaces with `informationalOnly: true` display claim state but do not block actions
- Surfaces without claim surface (`null`) are not governed by claim-readiness constraints
- `minimumReadinessState: declared` means states below `declared` are not displayed

---

## 7. Audit trail requirements

Every write action (W1–W16) must produce an audit entry:

| Field | Source |
|-------|--------|
| `eventType` | Action identifier (e.g., `tenant.bootstrap.requested`) |
| `occurredAt` | ISO 8601 timestamp |
| `correlationId` | End-to-end workflow correlation ID |
| `requestedBy` | Operator identity from auth context |
| `tenantId` | Target tenant (where applicable) |
| `detail` | Action-specific payload (no PHI in control-plane events) |

Audit entries are immutable and append-only. The control-plane audit trail is separate from clinical audit (no PHI ever flows through control-plane events).

---

## 8. Integration status summary

| Category | Count | Details |
|----------|-------|---------|
| Read actions with existing API | 10 | R1–R10 |
| Read actions needing new API | 0 | — |
| Write actions with existing API | 4 | W1, W2, W3, W4 |
| Write actions contracted (Batch 2) | 4 | W5, W6, W7, W8 |
| Write actions contracted (Batch 3) | 8 | W9–W16 (system-config, markets, packs) |
| Write actions deferred | 0 | — |
| Navigation actions | 9 | N1–N9 (no API needed) |
| Events produced | 11 | 3 original + 8 Batch 3 (market, pack, system-config) |
| Events consumed | 7 | Original AsyncAPI events (Batch 3 event consumption is implementation-deferred) |

---

## 9. Verification checklist

- [ ] Every action in the page specs (GATE 2) appears in this matrix
- [ ] Every API operation reference matches the OpenAPI contract (existing) or is explicitly deferred
- [ ] Every event reference matches the AsyncAPI contract
- [ ] Every source-of-truth reference matches a screen-contract `dataSources[]` entry
- [ ] Permission claims are consistent with the permissions matrix
- [ ] Claim surface bindings match screen-contract `claimSurface` fields
- [ ] Deferred actions are explicitly marked and not presented as available
- [ ] Audit requirements cover all write actions
- [ ] No new data models invented — all fields trace to existing schemas
