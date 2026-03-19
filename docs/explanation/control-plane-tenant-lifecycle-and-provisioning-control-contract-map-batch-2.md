# Control-Plane Tenant Lifecycle and Provisioning Control — Contract Map (Batch 2)

> **Type:** Explanation — architecture rationale and contract binding documentation.
>
> **Batch:** 2 (extends Batch 1 contract map and planning docs).
>
> **Scope:** Write-side contract operations for tenant lifecycle state transitions
> (suspend, reactivate, archive) and provisioning run control (cancel). These
> actions were declared as deferred in Batch 1 planning docs and are now
> formally contracted in OpenAPI and AsyncAPI.
>
> **Out of scope:** Market writes, pack writes, system-config writes, provisioning
> engine implementation, authorization implementation, runtime code, UI code.
> Provisioning retry binds to the existing `createProvisioningRun` operation (W4)
> and requires no new endpoint.

---

## 1. Relationship to Batch 1

This document extends the following Batch 1 artifacts:

| Batch 1 artifact | What it declared | What Batch 2 contracts |
|-------------------|-----------------|------------------------|
| `control-plane-operator-bootstrap-and-provisioning-contract-map.md` | Action binding table rows 1–6 (reads + bootstrap + provisioning) | Adds rows 7–10 (lifecycle writes + cancel) |
| `control-panel-page-specs-and-operator-manual-batch-1.md` | §3.2.4 suspend/reactivate/archive as deferred; §3.4 cancel as deferred | Resolves deferred status for W5–W8 |
| `control-panel-action-semantics-and-source-of-truth-binding-batch-1.md` | W5–W8 marked ❌ Deferred | Resolves to ✅ Contracted |
| `control-panel-design-contract-and-static-review-prototype-batch-1.md` | §6 deferred elements table lists lifecycle + cancel | Resolves deferred status for lifecycle + cancel rows |

Actions that **remain deferred** after Batch 2:

| Action | Why still deferred |
|--------|--------------------|
| W9 — Toggle feature flag | Requires dedicated system-config write API (different concern boundary) |
| W10 — Update system parameter | Requires dedicated system-config write API |
| Market write ops | Governance-gated: market authoring rules not yet finalized |
| Pack write ops | Governance-gated: pack lifecycle management rules not yet finalized |

---

## 2. Action Binding Table — Batch 2 Additions

| # | Operator Action | Control-Panel Surface | API operationId | HTTP | Source of Truth | Emitted Event(s) | Sync/Async |
|---|-----------------|----------------------|-----------------|------|-----------------|-------------------|------------|
| 7 | Suspend tenant | tenants.detail | `suspendTenant` | `POST /tenants/{tenantId}/suspend` | platform-tenant-registry | `tenant.lifecycle.suspended` | Synchronous (200 OK) |
| 8 | Reactivate tenant | tenants.detail | `reactivateTenant` | `POST /tenants/{tenantId}/reactivate` | platform-tenant-registry | `tenant.lifecycle.reactivated` | Synchronous (200 OK) |
| 9 | Archive tenant | tenants.detail | `archiveTenant` | `POST /tenants/{tenantId}/archive` | platform-tenant-registry | `tenant.lifecycle.archived` | Synchronous (200 OK) |
| 10 | Cancel provisioning run | provisioning.runs | `cancelProvisioningRun` | `POST /provisioning-runs/{provisioningRunId}/cancel` | platform-governance | `provisioning.run.cancel.requested` (immediate), `provisioning.run.cancelled` (eventual) | 202 Accepted (async) |

---

## 3. Preconditions and Postconditions

### 3.1 Tenant Lifecycle State Machine

```
                         ┌─────────────┐
         bootstrap ──►   │   active    │
                         └──────┬──────┘
                                │ suspend
                                ▼
                         ┌─────────────┐
                    ┌──► │  suspended  │ ◄──┐
                    │    └──────┬──────┘    │
                    │           │           │
               reactivate      │ archive   │
                    │           ▼           │
                    │    ┌─────────────┐    │
                    │    │  archived   │    │
                    │    │ (terminal)  │    │
                    │    └─────────────┘    │
                    │                       │
                    └───────────────────────┘
```

| Operation | Precondition | Postcondition | Reversible? |
|-----------|-------------|---------------|-------------|
| `suspendTenant` | tenant.status = `active` | tenant.status = `suspended`; `updatedAt` refreshed | Yes — reactivate restores `active` |
| `reactivateTenant` | tenant.status = `suspended` | tenant.status = `active`; `updatedAt` refreshed | Yes — suspend returns to `suspended` |
| `archiveTenant` | tenant.status = `suspended`; `confirmArchive` = true in body | tenant.status = `archived` | **No — irreversible.** Archived tenants cannot be reactivated. |

### 3.2 Provisioning Run Status Extension

Batch 2 adds two new statuses to the provisioning run lifecycle:

```
  queued ──► in-progress ──► completed
    │            │
    │            │ (cancel requested)
    │            ▼
    │      cancel-requested ──► cancelled
    │
    └──────► cancel-requested ──► cancelled
                 
  failed (terminal — no cancel path)
```

| Operation | Precondition | Postcondition | Response |
|-----------|-------------|---------------|----------|
| `cancelProvisioningRun` | run.status ∈ {`queued`, `in-progress`} | run.status → `cancel-requested` (intermediate); eventually → `cancelled` (terminal via orchestrator) | 202 Accepted |

---

## 4. Error Model

All operations reuse the existing `ErrorResponse` schema with appropriate error codes.

### 4.1 Tenant Lifecycle Errors

| Operation | HTTP Status | Error Code | When |
|-----------|-------------|------------|------|
| `suspendTenant` | 404 | `ARTIFACT_NOT_FOUND` | Tenant does not exist |
| `suspendTenant` | 409 | `CONFLICT` | Tenant is not in `active` status |
| `reactivateTenant` | 404 | `ARTIFACT_NOT_FOUND` | Tenant does not exist |
| `reactivateTenant` | 409 | `CONFLICT` | Tenant is not in `suspended` status |
| `archiveTenant` | 404 | `ARTIFACT_NOT_FOUND` | Tenant does not exist |
| `archiveTenant` | 409 | `CONFLICT` | Tenant is not in `suspended` status |
| `archiveTenant` | 422 | `VALIDATION_FAILED` | `confirmArchive` is missing or not `true` |
| All | 401 | `UNAUTHORIZED` | No valid operator token |
| All | 403 | `FORBIDDEN` | Operator lacks `control-plane:tenant:lifecycle` permission |

### 4.2 Provisioning Cancel Errors

| Operation | HTTP Status | Error Code | When |
|-----------|-------------|------------|------|
| `cancelProvisioningRun` | 404 | `ARTIFACT_NOT_FOUND` | Run does not exist |
| `cancelProvisioningRun` | 409 | `CONFLICT` | Run is in terminal state (`completed`, `failed`, `cancelled`) or already `cancel-requested` |
| `cancelProvisioningRun` | 401 | `UNAUTHORIZED` | No valid operator token |
| `cancelProvisioningRun` | 403 | `FORBIDDEN` | Operator lacks `control-plane:provisioning:manage` permission |

---

## 5. Event Catalog — Batch 2 Additions

Five new events are added to the AsyncAPI contract:

### 5.1 Tenant Lifecycle Events

| Event Address | Message Name | Producer | Consumers | When |
|--------------|-------------|----------|-----------|------|
| `tenant.lifecycle.suspended` | `TenantLifecycleSuspended` | Tenant lifecycle service | Control panel (status refresh), audit subsystem | After `suspendTenant` completes |
| `tenant.lifecycle.reactivated` | `TenantLifecycleReactivated` | Tenant lifecycle service | Control panel (status refresh), audit subsystem | After `reactivateTenant` completes |
| `tenant.lifecycle.archived` | `TenantLifecycleArchived` | Tenant lifecycle service | Control panel (status refresh), audit subsystem, data retention service | After `archiveTenant` completes |

### 5.2 Provisioning Control Events

| Event Address | Message Name | Producer | Consumers | When |
|--------------|-------------|----------|-----------|------|
| `provisioning.run.cancel.requested` | `ProvisioningRunCancelRequested` | Cancel endpoint | Provisioning orchestrator (signals graceful stop), audit subsystem | Immediately when cancel request accepted |
| `provisioning.run.cancelled` | `ProvisioningRunCancelled` | Provisioning orchestrator | Control panel (terminal status), bootstrap request updater, audit subsystem | After orchestrator completes graceful wind-down |

### 5.3 Event Payload Conventions

All event payloads follow existing conventions:

- Required envelope: `eventId` (UUID), `eventType` (const string), `occurredAt` (ISO 8601), `correlationId` (UUID)
- Domain identifiers: `tenantId`, `provisioningRunId`, `bootstrapRequestId` as appropriate
- `requestedBy`: operator identity from auth context (present on all operator-initiated events)
- **No PHI**: only operational/infrastructure identifiers

---

## 6. Audit Requirements

All Batch 2 actions produce audit trail entries consistent with the conventions established in the Batch 1 contract map (§8):

| Field | Source |
|-------|--------|
| `eventType` | From emitted event's `eventType` constant |
| `occurredAt` | Server-generated ISO 8601 timestamp |
| `correlationId` | Per-request UUID, propagated across all events in the workflow |
| `requestedBy` | Derived from authenticated operator session (auth context), NOT user-supplied |
| `tenantId` | From path parameter or run's linked tenant |
| `detail` | Operation-specific: reason, previous status, new status, confirmation flag |

Archive operations additionally require:

- Reason recorded in audit detail
- `confirmArchive` flag recorded to prove explicit operator confirmation

Cancel operations additionally require:

- Reason recorded in audit detail
- Previous run status recorded
- Eventual `cancelled` event includes count of completed vs. skipped steps

---

## 7. PH Truth Constraints

**No change from Batch 1.** These write operations do not affect PH truth:

- PH legal market remains `draft` / `T0`
- All PH packs remain lifecycle `draft`
- No PH capability becomes claimable or production-eligible
- Tenant lifecycle operations (suspend/reactivate/archive) are market-independent — they apply equally to any tenant regardless of legal market
- Provisioning cancel is run-scoped, not market-scoped

---

## 8. Compensation and Recovery Expectations

### 8.1 Tenant Lifecycle

Suspend and reactivate are **reversible complements** — an operator can toggle between active and suspended. No automated compensation is needed.

Archive is **irreversible by design**. The two-step path (active → suspended → archived) with explicit `confirmArchive` flag provides the safety net. There is no "unarchive" operation.

### 8.2 Provisioning Cancel

Cancel is a **control request**, not a magical undo. The orchestrator is expected to:

1. Receive the `provisioning.run.cancel.requested` event
2. Stop initiating new steps
3. Allow the currently in-flight step (if any) to complete or fail naturally
4. Mark remaining pending steps as `skipped`
5. Transition the run to `cancelled` status
6. Emit `provisioning.run.cancelled` with final step counts

**Cancel does NOT roll back completed steps.** If 3 of 5 steps completed before cancel, those 3 remain completed. The orchestrator does not attempt to undo tenant-database-init, pack-activation, or other completed work. Rollback semantics, if needed, are a separate future concern outside this contract.

---

## 9. Verification Checklist

- [ ] OpenAPI has 4 new operations: `suspendTenant`, `reactivateTenant`, `archiveTenant`, `cancelProvisioningRun`
- [ ] OpenAPI operation count: 18 (was 14)
- [ ] OpenAPI version bumped from `0.1.0` to `0.2.0`
- [ ] Provisioning run status enum includes `cancel-requested` and `cancelled`
- [ ] Provisioning run list filter includes `cancel-requested` and `cancelled`
- [ ] AsyncAPI has 5 new channels: tenant.lifecycle.suspended, .reactivated, .archived, provisioning.run.cancel.requested, provisioning.run.cancelled
- [ ] AsyncAPI event count: 12 (was 7)
- [ ] AsyncAPI version bumped from `0.1.0` to `0.2.0`
- [ ] Batch 1 page-specs no longer says "deferred" for suspend/reactivate/archive/cancel
- [ ] Batch 1 action-semantics W5–W8 changed from ❌ Deferred to ✅ Contracted
- [ ] Batch 1 design-contract deferred elements updated for lifecycle + cancel
- [ ] Source-of-truth-index updated with Batch 2 doc and operation count
- [ ] PH truth unchanged: draft/T0, no capability escalation
- [ ] No screen-contract changes
- [ ] No JSON Schema changes
- [ ] No runtime code changes
