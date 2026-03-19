# Control-Plane Tenant Lifecycle and Orchestration Model

> **Status:** Canonical architecture specification.
> **Date:** 2026-03-20.
> **Type:** Explanation — canonical object model with state machines and orchestration flows.
> **Scope:** Detailed state machine semantics, transition guards, orchestration flow
> choreography, and event timelines for the 8 state families defined in the service-map doc.
> **Governed by:** AGENTS.md, control-plane-service-map-and-operator-console-architecture.md.
> **Companion to:** The service-map doc defines WHAT the state families are.
> This doc defines HOW they behave, WHEN transitions fire, and WHAT orchestration
> coordinates them.

---

## 1. Purpose

The service-map doc (§4) lists 8 state families and their state graphs. This document
adds the operational detail that orchestration code, operators, and audit reviewers
need:

- **Transition guards** — what conditions must be true before a transition can fire
- **Side effects** — what events are emitted, what downstream actions are triggered
- **Orchestration flows** — how multi-service sagas coordinate state changes across domains
- **Invariants** — what must always be true regardless of state
- **Failure modes** — what happens when a transition fails or a guard is unmet

---

## 2. Tenant lifecycle — full specification

**Owning service:** Tenant Portfolio Service.
**Source document:** Service-map §4.1.

### 2.1 State graph

```
           createTenantDraft
                 │
                 ▼
              ┌──────┐       activateTenant
              │ draft │──────────────────────────▶┌────────┐
              └──────┘                            │ active │
                                        ┌────────│        │◄──────────┐
                                        │        └────────┘           │
                                        │           │                 │
                               suspendTenant        │        reactivateTenant
                                        │           │                 │
                                        ▼           │                 │
                                   ┌───────────┐   │                 │
                                   │ suspended  │───┘                 │
                                   │           ├──────────────────────┘
                                   └───────────┘
                                        │
                              archiveTenant (also from active)
                                        │
                                        ▼
                                   ┌──────────┐
                                   │ archived  │
                                   └──────────┘
```

### 2.2 Transition specifications

#### `createTenantDraft`

| Aspect | Value |
|--------|-------|
| Pre-state | None (new object) |
| Post-state | `draft` |
| Guards | Legal entity must exist (or be created inline). Market must be a valid ISO 3166-1 code with a legal-market profile (any lifecycle stage). |
| Side effects | Emits `tenant.created`. Creates audit event. |
| Failure modes | Invalid market code → reject with `INVALID_MARKET`. Missing legal entity → reject with `LEGAL_ENTITY_REQUIRED`. |

#### `activateTenant`

| Aspect | Value |
|--------|-------|
| Pre-state | `draft` |
| Post-state | `active` |
| Guards | Provisioning run for this tenant must be in `completed` state. Effective configuration plan must exist. Environment binding must exist. |
| Side effects | Emits `tenant.activated`. Triggers Commercial (start billing), Fleet (confirm binding), Support (create welcome case). |
| Failure modes | Provisioning incomplete → reject with `PROVISIONING_INCOMPLETE`. No effective plan → reject with `NO_EFFECTIVE_PLAN`. |

#### `suspendTenant`

| Aspect | Value |
|--------|-------|
| Pre-state | `active` |
| Post-state | `suspended` |
| Guards | Must include reason (`operator-action`, `commercial-suspension`, `security-incident`, `compliance-hold`). |
| Side effects | Emits `tenant.suspended` with reason. Revokes all tenant-scoped access tokens. Tenant-admin and clinical workspaces return 403 for all operations. |
| Failure modes | Already suspended → idempotent (no-op, returns current state). |

#### `reactivateTenant`

| Aspect | Value |
|--------|-------|
| Pre-state | `suspended` |
| Post-state | `active` |
| Guards | If suspension was `commercial-suspension`, payment must be current. If `compliance-hold`, compliance clearance must be documented. Operator must confirm reactivation. |
| Side effects | Emits `tenant.reactivated`. Restores access. |
| Failure modes | Payment still outstanding → reject with `PAYMENT_REQUIRED`. Compliance not cleared → reject with `COMPLIANCE_HOLD_ACTIVE`. |

#### `archiveTenant`

| Aspect | Value |
|--------|-------|
| Pre-state | `active` or `suspended` |
| Post-state | `archived` |
| Guards | Operator must confirm with explicit acknowledgement. Grace period starts (configurable, default 90 days). |
| Side effects | Emits `tenant.archived`. Triggers Commercial (terminate subscription), Fleet (schedule environment release after grace period), Support (close all cases). |
| Irreversibility | Reversible during grace period (restore to `suspended`). Irreversible after grace period (data purged per retention policy). |

### 2.3 Invariants

1. A tenant always has exactly one lifecycle state.
2. A tenant always belongs to exactly one legal market.
3. A tenant in `draft` state has no runtime environment and no active workspaces.
4. A tenant in `archived` state cannot transition to `active` directly.
5. Commercial state and tenant lifecycle state are correlated but not identical — commercial suspension triggers tenant suspension, but operator suspension does not affect billing state.

---

## 3. Provisioning run lifecycle — full specification

**Owning service:** Bootstrap & Provisioning Orchestrator.

### 3.1 Provisioning run state graph

```
     startProvisioningRun
             │
             ▼
        ┌─────────┐
        │ pending  │
        └────┬────┘
             │ first step starts
             ▼
        ┌─────────┐          all steps done         ┌───────────┐
        │ running  │───────────────────────────────▶│ completed  │
        └────┬────┘                                 └───────────┘
             │
        step fails
             │
             ▼
        ┌─────────┐        retryProvisioningStep     ┌──────────┐
        │ failed   │───────────────────────────────▶│ retrying  │──▶ running
        └────┬────┘                                  └──────────┘
             │                                            │
             │ rollbackProvisioningRun               fails again
             ▼                                            │
        ┌──────────────┐                                  ▼
        │ rolling-back │                              failed
        └──────┬───────┘
               │ all compensations done
               ▼
        ┌─────────────┐
        │ rolled-back  │
        └─────────────┘

   (cancelProvisioningRun can fire from pending or running → cancelled)
```

### 3.2 Canonical provisioning step sequence

A provisioning run consists of an ordered set of steps. Steps execute sequentially.
Each step has a compensating action for rollback.

| Order | Step name | Service called | Compensating action |
|-------|----------|---------------|-------------------|
| 1 | `validate-bootstrap-request` | Bootstrap Orchestrator (self) | None — validation is read-only |
| 2 | `create-tenant-draft` | Tenant Portfolio | Delete tenant draft |
| 3 | `resolve-effective-plan` | Composition & Eligibility | None — resolution is idempotent |
| 4 | `allocate-environment` | Runtime Fleet & Release | Release environment allocation |
| 5 | `bind-tenant-to-environment` | Runtime Fleet & Release | Unbind tenant from environment |
| 6 | `activate-packs` | Composition & Eligibility | Deactivate packs (if possible) |
| 7 | `configure-vista-lane` | Runtime Fleet & Release | Revert VistA configuration (best-effort) |
| 8 | `run-health-checks` | Runtime Fleet & Release | None — health check is read-only |
| 9 | `activate-tenant` | Tenant Portfolio | Suspend tenant (if already activated) |
| 10 | `initialize-billing` | Commercial | Void subscription (if created) |

### 3.3 Step state machine

Each step within a provisioning run has its own mini-state machine:

```
pending → running → completed
                  → failed
                  → skipped (operator marks non-critical step as skippable)
```

### 3.4 Failure handling rules

1. **Step failure halts the run.** No subsequent steps execute.
2. **Operator may retry.** Only the failed step is retried, not the entire run.
3. **Retry limit:** Configurable per step type. Default: 3 attempts.
4. **Rollback is sequential and reverse-order.** Steps are rolled back from the last completed step backward to step 1.
5. **Compensating actions are best-effort.** A compensating action failure is logged but does not block the rollback of earlier steps.
6. **After rollback, the run is terminal.** Operator must create a new provisioning run.

---

## 4. Bootstrap request lifecycle

**Owning service:** Bootstrap & Provisioning Orchestrator.

### 4.1 State graph

```
     createBootstrapDraft
             │
             ▼
        ┌────────┐     submitBootstrapRequest     ┌───────────┐
        │ draft  │──────────────────────────────▶│ submitted  │
        └────────┘                                └─────┬─────┘
                                                        │
                                                        ▼
                                                  ┌──────────────┐
                                              ┌──│ under-review  │──┐
                                              │  └──────────────┘  │
                                   approveBootstrapRequest    rejectBootstrapRequest
                                              │                    │
                                              ▼                    ▼
                                       ┌──────────┐         ┌──────────┐
                                       │ approved  │         │ rejected │
                                       └────┬─────┘         └──────────┘
                                            │
                               startProvisioningRun
                                            │
                                            ▼
                                   ┌──────────────────────┐
                                   │ provisioning-started  │
                                   └──────────────────────┘

         (withdrawBootstrapRequest can fire from submitted or under-review → withdrawn)
```

### 4.2 Draft vs submitted

| Concern | Draft | Submitted |
|---------|-------|-----------|
| Who can edit? | Creator (operator or self-service user) | No one — locked for review |
| Validation | Partial — fields may be incomplete | Full — all required fields validated |
| Visibility to reviewers | Not visible | Visible in review queue |
| Deletable? | Yes — no audit trail beyond creation event | No — withdrawal creates audit trail |

### 4.3 Self-service vs operator-initiated bootstrap

| Concern | Self-service | Operator-initiated |
|---------|-------------|-------------------|
| Who creates draft? | Self-service user (pre-tenant identity) | Platform operator |
| Who submits? | Self-service user | Operator |
| Who reviews? | Platform operator (mandatory) | Another operator (may be same, configurable) |
| Who approves? | Platform operator only | Platform operator only |
| Available markets | T2 (controlled) and T3 (GA) only | All tiers including T0 and T1 |
| Pack selection authority | Eligible packs for selected market only | Any pack (with justification for non-standard) |

---

## 5. Commercial lifecycle — full specification

**Owning service:** Commercial Service.

### 5.1 Subscription state transitions

| Transition | Guard | Side effects |
|-----------|-------|-------------|
| `trial → active` | Payment method verified. Trial conversion criteria met. | Emits `commercial.subscription.activated`. Billing period starts. |
| `trial → terminated` | Trial period expired without conversion. | Emits `commercial.subscription.terminated`. Triggers tenant archival after grace period. |
| `active → past-due` | Payment deadline passed without payment. | Emits `commercial.payment.overdue`. Generates dunning notice. Does NOT suspend tenant yet. |
| `past-due → active` | Payment received. | Emits `commercial.payment.received`. Clears past-due flag. |
| `past-due → suspended` | Grace period (configurable, default 30 days) expired. | Emits `commercial.suspension.triggered`. Tenant Portfolio subscribes and suspends tenant. |
| `suspended → active` | Full payment received including any penalties. | Emits `commercial.payment.received` + `commercial.suspension.lifted`. |
| `suspended → terminated` | Operator terminates subscription. | Emits `commercial.subscription.terminated`. Triggers tenant archival. |

### 5.2 Billing isolation

Commercial state does not contaminate tenant-operational state beyond suspension.
A tenant with `past-due` billing is still fully operational. Suspension only triggers
at grace-period expiry. This prevents brief payment delays from disrupting clinical
operations.

---

## 6. Invitation lifecycle

**Owning service:** Tenant Portfolio Service (identity binding aspect).

### 6.1 Transition specifications

| Transition | Guard | Side effects |
|-----------|-------|-------------|
| `invited → accepted` | Valid invitation token. Identity verification passed. | Emits `tenant.invitation.accepted`. User identity recorded. |
| `accepted → active` | Role(s) assigned by tenant admin. | Emits `tenant.member.activated`. Access provisioned. |
| `active → revoked` | Tenant admin or platform operator action. | Emits `tenant.member.revoked`. Access tokens invalidated. |
| `invited → expired` | Invitation TTL (configurable, default 7 days) elapsed. | Emits `tenant.invitation.expired`. Token invalidated. |

### 6.2 Invitation constraints

1. Invitation tokens are single-use and time-limited.
2. Expired invitations cannot be resurrected — a new invitation must be created.
3. Revocation is immediate and irreversible (a new invitation can be issued).
4. An identity may have memberships in multiple tenants (e.g., an admin managing several facilities). Each membership is independent.

---

## 7. Market launch-tier lifecycle

**Owning service:** Governance & Readiness Service.

### 7.1 Eight readiness dimensions

Launch-tier advancement requires evidence across all 8 dimensions:

| Dimension | What it measures | Example evidence |
|-----------|-----------------|-----------------|
| Pack completeness | Are all mandated packs published? | All mandated pack manifest.status = `published` |
| Regulatory compliance | Are regulatory packs verified by counsel? | Legal sign-off artifact on file |
| Adapter coverage | Do required VistA adapters exist and pass health checks? | Adapter health probe returns green |
| Localization quality | Are L10n packs reviewed by native speakers? | L10n review sign-off |
| Infrastructure readiness | Is the target deployment infrastructure provisioned? | Environment allocation confirmed |
| Documentation | Are operator runbooks and tenant onboarding guides complete? | Runbook checklist complete |
| Testing | Have integration and acceptance tests passed for this market config? | Test results artifact |
| Support readiness | Is support staffing and SLA defined for this market? | SLA document and staffing plan |

### 7.2 Tier transition rules

| Transition | Guard | Who can authorize? |
|-----------|-------|--------------------|
| `T0 → T1` | ≥6/8 dimensions at minimum viable | Platform operator |
| `T1 → T2` | ≥7/8 dimensions at mature, pilot feedback incorporated | Platform operator + stakeholder sign-off |
| `T2 → T3` | 8/8 dimensions at production-grade, no critical open issues | Platform operator + compliance sign-off |
| Any → lower tier | Any dimension drops below minimum threshold | Automatic (governance service detects) or operator |

### 7.3 Tier demotion is immediate

If a readiness dimension degrades below its required threshold for the current tier,
the market is **immediately** demoted to the highest tier whose requirements are still
met. No grace period. This ensures no tenant is onboarded at a tier level that the
platform cannot currently support.

Active tenants in a demoted market are not affected — they continue operating. But
new self-service onboarding for that market is paused until the tier is restored.

---

## 8. Pack eligibility lifecycle

**Owning service:** Composition & Eligibility Service.

### 8.1 State transitions

| Transition | Guard | Side effects |
|-----------|-------|-------------|
| `not-evaluated → eligible` | Pack eligibility conditions met for tenant's market + selections | Recorded in eligibility assessment |
| `not-evaluated → ineligible` | Pack eligibility conditions NOT met | Recorded in eligibility assessment |
| `eligible → activated` | Tenant-admin or operator selects pack, or pack is mandated/default-on | Added to effective configuration plan |
| `eligible → deferred` | Pack eligibility met but a dependency pack is not yet activated | Deferred resolution recorded |
| `deferred → activated` | Dependency activated | Cascading activation in next plan resolution |
| `activated → deactivated` | Tenant-admin or operator deactivates (only for optional packs, not mandated) | Removed from effective configuration plan |
| `ineligible → eligible` | Conditions change (e.g., tenant adds required prerequisite) | Eligibility reassessed |

### 8.2 Mandated packs cannot be deactivated

If a pack is mandated by the tenant's legal-market profile, the `deactivated` state
is unreachable. The resolver enforces a guarantee: mandated packs are never dropped
from the effective plan.

---

## 9. Orchestration flow: full tenant onboarding

This section traces a complete tenant onboarding from self-service request to active
operations, showing which services participate at each stage.

### 9.1 Flow timeline

| Step | Actor | Action | Service | State change |
|------|-------|--------|---------|-------------|
| 1 | Self-service user | Selects legal market | Self-service → Composition | (read only — market info retrieved) |
| 2 | Self-service user | Reviews eligible packs, makes optional selections | Self-service → Composition | (read only — eligibility previewed) |
| 3 | Self-service user | Fills bootstrap form, submits request | Self-service → Bootstrap Orchestrator | Bootstrap request: `draft → submitted` |
| 4 | System | Bootstrap request enters review queue | Bootstrap Orchestrator | Bootstrap request: `submitted → under-review` |
| 5 | Platform operator | Reviews request, validates legal entity | Operator console → Bootstrap Orchestrator + Tenant Portfolio | (read only — review) |
| 6 | Platform operator | Approves request | Operator console → Bootstrap Orchestrator | Bootstrap request: `under-review → approved` |
| 7 | Platform operator | Starts provisioning | Operator console → Bootstrap Orchestrator | Provisioning run: created, `pending → running` |
| 8 | System | Step 1: validate request | Bootstrap Orchestrator | Step 1: `pending → completed` |
| 9 | System | Step 2: create tenant draft | Bootstrap Orchestrator → Tenant Portfolio | Tenant: created in `draft`. Step 2: completed. |
| 10 | System | Step 3: resolve effective plan | Bootstrap Orchestrator → Composition | Effective plan created. Step 3: completed. |
| 11 | System | Step 4: allocate environment | Bootstrap Orchestrator → Fleet | Environment allocated. Step 4: completed. |
| 12 | System | Step 5: bind tenant to environment | Bootstrap Orchestrator → Fleet | Binding created. Step 5: completed. |
| 13 | System | Step 6: activate packs | Bootstrap Orchestrator → Composition | Packs activated per plan. Step 6: completed. |
| 14 | System | Step 7: configure VistA lane | Bootstrap Orchestrator → Fleet | VistA configured. Step 7: completed. |
| 15 | System | Step 8: health checks | Bootstrap Orchestrator → Fleet | Health verified. Step 8: completed. |
| 16 | System | Step 9: activate tenant | Bootstrap Orchestrator → Tenant Portfolio | Tenant: `draft → active`. Step 9: completed. |
| 17 | System | Step 10: initialize billing | Bootstrap Orchestrator → Commercial | Subscription created. Step 10: completed. |
| 18 | System | Provisioning run completes | Bootstrap Orchestrator | Provisioning run: `running → completed` |
| 19 | System | Events propagate | All subscribers | Commercial starts billing, Fleet confirms, Support creates welcome case |
| 20 | Tenant admin | Logs in for the first time | Tenant runtime plane | First access. Role-specific workspaces appear. |

### 9.2 Failure scenario: step 7 fails (VistA configuration)

| Recovery step | Action | Service |
|--------------|--------|---------|
| 1 | Run halts at step 7. Status: `failed`. | Bootstrap Orchestrator |
| 2 | Operator investigates VistA configuration error. | (Manual) |
| 3 | Operator retries step 7. | Operator console → Bootstrap Orchestrator |
| 4a | If retry succeeds: run resumes from step 8. | Bootstrap Orchestrator |
| 4b | If retry fails again: operator may rollback. | Operator console → Bootstrap Orchestrator |
| 5 | Rollback executes compensating actions: unbind (step 5), release env (step 4), delete tenant draft (step 2). Step 3 (resolve plan) has no compensation needed. | Bootstrap Orchestrator → Fleet, Tenant Portfolio |
| 6 | Run state: `rolled-back`. Bootstrap request returns to `approved` state. | Bootstrap Orchestrator |
| 7 | Operator may fix the VistA issue and create a new provisioning run. | Bootstrap Orchestrator |

---

## 10. Cross-service event choreography

### 10.1 Event ordering guarantees

1. **Within a service:** Events are emitted in causal order. `tenant.created` always
   precedes `tenant.activated` for the same tenant.
2. **Across services:** No global ordering guarantee. Subscribers must be idempotent
   and tolerate out-of-order delivery.
3. **At-least-once delivery.** Subscribers must handle duplicate events gracefully.

### 10.2 Critical event chains

#### Commercial suspension chain

```
Commercial: paymentOverdue → (grace period) → commercial.suspension.triggered
  → Tenant Portfolio subscribes → suspendTenant → tenant.suspended
    → Fleet subscribes → marks environment as suspended (no resource release)
    → Support subscribes → creates incident record
```

#### Readiness degradation chain

```
Governance: assessCapabilityReadiness → readiness drops below threshold
  → governance.capability.readiness-changed
    → Composition subscribes → re-resolves affected effective plans
      → composition.plan.drift-detected (if plans change)
  → governance.launch-tier.changed (if tier demotion triggered)
    → Composition subscribes → updates market visibility for self-service
```

---

## 11. Out of scope

This document does NOT:

1. Define database schemas — those are implementation artifacts
2. Define API request/response formats — those belong in OpenAPI contracts
3. Define event payload schemas — those belong in AsyncAPI contracts
4. Specify retry/backoff parameters — those are operational configuration
5. Specify grace period durations — those are business configuration
6. Implement any code — this is architecture, not implementation
