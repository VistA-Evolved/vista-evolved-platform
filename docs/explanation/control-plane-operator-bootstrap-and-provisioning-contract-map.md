# Control-Plane Operator Bootstrap and Provisioning — Contract Map

> Binds operator control-panel actions to control-plane API operations and provisioning lifecycle events.
>
> **Scope:** Operator-initiated tenant bootstrap and provisioning only.
> This document does NOT cover public self-service signup, billing, metering, support, backup, clinical APIs, or tenant-admin flows.

---

## 1. Plane Definitions for This Workflow

| Plane | Role in this workflow | Canonical spec reference |
|-------|----------------------|--------------------------|
| **Control plane** | Executes the bootstrap/provisioning API. Resolves effective-tenant-configuration plans, accepts bootstrap requests, orchestrates asynchronous provisioning runs, and emits lifecycle events. | global-system-architecture-spec.md §7.4 |
| **Control panel** | Operator-facing UI that calls the control-plane API. Displays legal-market profiles, plan resolution results (including deferred items and gating blockers), bootstrap request status, and provisioning run progress. The control panel is a consumer of the control-plane API — it does not contain business logic. | information-architecture-workspace-map.md §11 |
| **Tenant runtime plane** | The downstream target of provisioning. Once a provisioning run completes, the tenant runtime plane has a configured VistA instance, activated packs, and initialized adapters. This plane is NOT directly mutated by the control-panel UI — all mutations flow through the control-plane orchestration. | global-system-architecture-spec.md §7.1–§7.2 |

---

## 2. Explicit Scope Exclusions

The following are **out of scope** for this contract map and its associated API/event contracts:

- Public self-service signup or onboarding website
- Billing, metering, or subscription management
- Support center, alert center, or backup/restore
- Tenant-admin configuration (self-service pack activation, facility setup, user management)
- Clinical APIs (patient data, orders, notes, VistA RPC calls)
- Control-panel UI implementation (screens, components, state management)
- Provisioning engine implementation (orchestrator, step executors, infrastructure automation)
- Resolver implementation (the algorithm that produces effective-tenant-configuration plans)

---

## 3. Workflow Sequence

```
Operator opens control panel
  │
  ├─1─► GET /legal-market-profiles/{legalMarketId}
  │     (reads market profile for operator review)
  │
  ├─2─► POST /effective-configuration-plans:resolve
  │     (resolves a plan from market profile + operator selections)
  │     ◄── emits: effective-plan.resolved
  │
  ├─3─► POST /tenant-bootstrap-requests
  │     (submits operator-approved bootstrap request referencing resolved plan)
  │     ◄── emits: tenant.bootstrap.requested
  │
  ├─4─► GET /tenant-bootstrap-requests/{bootstrapRequestId}
  │     (polls bootstrap request status)
  │
  ├─5─► POST /provisioning-runs
  │     (initiates asynchronous provisioning for an approved bootstrap request)
  │     ◄── emits: provisioning.run.requested
  │
  └─6─► GET /provisioning-runs/{provisioningRunId}
        (polls provisioning run status, steps, blockers, failures)
        ◄── events observed:
             provisioning.run.started
             provisioning.step.changed
             provisioning.run.completed
             provisioning.run.failed
```

**Key invariant:** Provisioning is asynchronous. The POST operations return 202 Accepted with a resource ID for status polling. No endpoint returns synchronous provisioning success.

---

## 4. Operator Action Binding Table

| # | Operator action | Control-panel surface concept | Control-plane API operationId | Source-of-truth artifact(s) read | Emitted event(s) | Affected downstream concern | Audit/security note | Sync response vs async outcome |
|---|----------------|-------------------------------|-------------------------------|----------------------------------|-------------------|-----------------------------|--------------------|---------------------------------|
| 1 | Review available legal markets | Market selection surface | `getLegalMarketProfile` | `legal-market-profiles/{id}.json` | None | None (read-only) | Read-audit logged; no mutation | Synchronous: returns profile summary |
| 2 | Select market + packs and resolve plan | Plan resolution surface | `resolveEffectiveConfigurationPlan` | `legal-market-profiles/{id}.json`, all referenced pack manifests, capability manifests | `effective-plan.resolved` | None (plan is a snapshot, not a mutation) | Operator identity from auth context; plan snapshot is immutable once generated | Synchronous response with resolved plan; event emitted after plan stored |
| 3 | Approve and submit bootstrap request | Bootstrap submission surface | `createTenantBootstrapRequest` | Resolved effective-tenant-configuration plan (by effectivePlanId) | `tenant.bootstrap.requested` | Queues provisioning eligibility check | Operator must have `control-plane:tenant:bootstrap` permission; request is immutable once created | 202 Accepted; async processing begins downstream |
| 4 | Check bootstrap request status | Bootstrap status surface | `getTenantBootstrapRequest` | Bootstrap request record | None | None (read-only) | Read-audit logged | Synchronous: returns current status |
| 5 | Start provisioning run | Provisioning surface | `createProvisioningRun` | Bootstrap request record, referenced effective plan | `provisioning.run.requested` | Initiates async provisioning orchestration targeting tenant runtime plane | Operator must have `control-plane:provisioning:execute` permission; provisioningRunId is the primary correlator | 202 Accepted; provisioning is fully asynchronous |
| 6 | Monitor provisioning progress | Provisioning status surface | `getProvisioningRun` | Provisioning run record (steps, status, blockers) | None (events are push-side; this is pull-side) | None (read-only) | Read-audit logged | Synchronous: returns current run state |

---

## 5. Canonical Identifiers and Correlation

| Identifier | Source | Scope | Purpose |
|-----------|--------|-------|---------|
| `legalMarketId` | Legal-market profile schema (`^[A-Z]{2}(-[A-Z0-9]{1,8})?$`) | Market | Selects the legal-market profile for composition |
| `tenantId` | Generated at bootstrap request creation | Tenant | Unique tenant identity throughout lifecycle |
| `effectivePlanId` | Generated at plan resolution | Plan snapshot | References a specific immutable plan resolution result |
| `bootstrapRequestId` | Generated at bootstrap request creation | Bootstrap | Correlates the bootstrap request through approval and provisioning |
| `provisioningRunId` | Generated at provisioning run creation | Provisioning | Correlates a single provisioning execution through all steps |
| `correlationId` | Generated at first API call in the workflow, propagated through all events | Cross-workflow | End-to-end tracing across API calls and events |
| `requestedBy` | Extracted from authenticated operator session (auth context) | Audit | Operator identity; NOT a user-supplied field |

---

## 6. Contract Artifact References

| Artifact | Canonical home | Purpose |
|----------|---------------|---------|
| OpenAPI contract | `packages/contracts/openapi/control-plane-operator-bootstrap-and-provisioning.openapi.yaml` | HTTP API contract for control-plane bootstrap/provisioning operations |
| AsyncAPI contract | `packages/contracts/asyncapi/control-plane-provisioning-events.asyncapi.yaml` | Event contract for provisioning lifecycle events |
| Legal-market profile schema | `packages/contracts/schemas/legal-market-profile.schema.json` | Input schema for market data |
| Effective-tenant-configuration-plan schema | `packages/contracts/schemas/effective-tenant-configuration-plan.schema.json` | Output schema for resolved plans |
| Pack manifest schema | `packages/contracts/schemas/pack-manifest.schema.json` | Pack identity and metadata |
| Capability manifest schema | `packages/contracts/schemas/capability-manifest.schema.json` | Capability identity and readiness |

---

## 7. Current PH Truth Constraints

These constraints apply to any control-plane interaction involving the PH market:

| Constraint | Current value | Implication for API responses |
|-----------|---------------|-------------------------------|
| PH profile status | `draft` | Profile is viewable but not production-ready; responses must surface `draft` status |
| PH launch tier | `T0` (exploratory) | No production provisioning; provisioning runs targeting PH will reflect T0 constraints |
| lang-fil | Deferred (`eligibility-failed`) | Must appear in deferredItems of any PH plan resolution |
| payer-philhealth adapter | `integration-pending` | Must appear as a constraining factor; billing capability is blocked |
| All PH packs | Lifecycle `draft` | No pack has reached `published`; mandated packs (regulatory, standards) have `minimumPackState: published` not yet met |
| All PH capabilities | Readiness `declared` or `specified` | No capability is claimable or production-eligible |

---

## 8. Asynchronous Provisioning Model

Provisioning is modeled as an asynchronous, multi-step workflow:

1. **Request acceptance** — `POST /provisioning-runs` returns 202 with `provisioningRunId`. No steps have executed.
2. **Run initiation** — The provisioning orchestrator (not part of this contract) picks up the run and emits `provisioning.run.started`.
3. **Step progression** — Each provisioning step (e.g., VistA tenant setup, pack activation, adapter initialization) emits `provisioning.step.changed` with step status.
4. **Completion or failure** — The run ends with either `provisioning.run.completed` (all steps succeeded) or `provisioning.run.failed` (step failure, dependency blocker, or infrastructure error).

**Explicitly not modeled in this contract:**
- Step executor implementation
- Infrastructure automation scripts
- VistA mutation commands
- Retry/compensation orchestration (future contract extension)
