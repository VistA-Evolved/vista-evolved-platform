# Control-Plane Service Map and Operator Console Architecture

> **Status:** Canonical architecture specification.
> **Date:** 2026-03-20.
> **Type:** Explanation — architecture rationale and service decomposition.
> **Scope:** Defines the service-first architecture of the VistA Evolved control plane,
> the operator console, customer self-service onboarding, and how they relate to the
> tenant runtime plane.
> **Governed by:** AGENTS.md, global-system-architecture-spec.md, doc-governance.md.
> **Supersedes:** This document replaces the implicit service model that was previously
> scattered across the bootstrap/provisioning contract maps and workspace map.
> The contract maps remain valid for their API operation details; this document provides
> the authoritative service-domain decomposition that the contract maps implement.

---

## 1. Four architectural layers

The VistA Evolved platform separates into four distinct architectural layers. Each has
a different audience, scope, and runtime boundary. Conflating them is a recurring source
of architectural confusion.

| Layer | What it is | Audience | Scope | Runtime posture |
|-------|-----------|----------|-------|-----------------|
| **Provider control-plane services** | Backend service domains that manage tenant portfolio, composition, provisioning, fleet, commercial, support, and governance concerns | Platform operators (via console), automation, CI/CD | Platform-wide — all tenants, all markets | Persistent, event-driven, database-backed (PostgreSQL). Source of truth for platform-governance data. |
| **Provider operator console** | The operator-facing UI/terminal surface where platform operators interact with control-plane services | Platform operators only | Platform-wide | Thin client consuming control-plane APIs. No independent business logic. No separate database. |
| **Customer self-service onboarding surface** | The surface where prospective customers (or their designated admins) initiate onboarding, select their legal market, review pack eligibility, and submit bootstrap requests | Prospective tenant admins, designated onboarding contacts | Pre-tenant (no tenant context yet) → transitions to tenant-scoped | Thin client consuming a governed subset of control-plane APIs. Heavily constrained: no platform-wide visibility, no provisioning authority. |
| **Tenant runtime plane** | The per-tenant operational environment where tenants access VistA, clinical workspaces, ancillary tools, analytics, and tenant-admin configuration | Tenant admins, clinicians, ancillary staff, analysts, IT staff | Tenant-scoped only | Multi-workspace (7 workspace families per info-arch). VistA is source of clinical truth. Platform PG for tenant governance data. |

### 1.1 Why this separation matters

**Provider control-plane services** are the backend. They process commands, emit events,
maintain state, enforce business rules. They exist whether or not any UI is looking.

**Provider operator console** is the frontend. It is one of potentially several clients
that call the control-plane API. It has no state of its own. Replace it with a CLI,
a Notion integration, or a mobile app and the control-plane services are unaffected.

**Customer self-service onboarding surface** is a public-facing client with a restricted
API surface. It cannot list all tenants, cannot modify system config, cannot force
provisioning. It can only initiate and track its own onboarding request.

**Tenant runtime plane** is where tenants live after provisioning. It consumes the
outputs of the control-plane services (effective configuration plans, pack activations,
capability posture) but does not call control-plane APIs directly except for tenant-admin
operations on its own tenant.

### 1.2 Current implementation status

| Layer | Current state |
|-------|--------------|
| Provider control-plane services | **Not yet implemented as live services.** Contracts defined in OpenAPI/AsyncAPI. Resolution algorithm implemented as a local library (`apps/control-plane/lib/plan-resolver.mjs`). No persistent backend, no event bus, no production database wiring. |
| Provider operator console | **Local review runtime only.** `apps/control-plane/` runs a Fastify dev server with fixture/contract-backed read routes and review-only write simulation. It is not a production console. See `apps/control-plane/README.md`. |
| Customer self-service onboarding surface | **Not started.** No code, no contracts, no design. Architecturally defined here. |
| Tenant runtime plane | **Partially implemented in archive repo.** The VistA-Evolved archive contains prototype clinical routes and CPRS panel code. Active repos have terminal-proof (terminal-first VistA access) and distro lane builds. No production tenant-admin UI. |

---

## 2. Provider control-plane services — the 7 canonical service domains

The control plane decomposes into seven focused service domains. Each domain owns a
defined set of objects, commands, events, and state machines. Service boundaries are
enforced by contract (OpenAPI operations, AsyncAPI events) — no shared mutable state
between domains.

### 2.1 Service domain table

| # | Service domain | Owns | Consumes from |
|---|---------------|------|---------------|
| 1 | **Tenant Portfolio Service** | Tenant, legal entity, organization, facility bindings, tenant lifecycle state | Composition service (effective plans), commercial service (subscription status) |
| 2 | **Composition & Eligibility Service** | Legal-market profiles, pack manifests, effective-configuration plans, eligibility resolution, composition algorithm | Tenant portfolio (tenant context), governance (readiness state) |
| 3 | **Bootstrap & Provisioning Orchestrator** | Bootstrap drafts/requests, provisioning runs, step execution, rollback, environment binding | Tenant portfolio (create/bind), composition (effective plan), fleet (environment allocation) |
| 4 | **Runtime Fleet & Release Service** | Runtime environments, VistA lane bindings, release channels, rollout policies, health probes | Tenant portfolio (which tenants exist), governance (readiness gates) |
| 5 | **Commercial Service** | Subscriptions, billing accounts, invoices, usage metering, payment status | Tenant portfolio (tenant identity), governance (launch-tier constraints) |
| 6 | **Support / Incident / Audit Service** | Support cases, incident records, audit events (platform-level), SLA tracking | All services (audit event producers), tenant portfolio (case binding) |
| 7 | **Governance & Readiness Service** | Capability manifests, readiness assessments, claim-gating rules, launch-tier management, pack lifecycle governance | All services (readiness consumers), composition (readiness dimension snapshots) |

### 2.2 Service domain details

#### 2.2.1 Tenant Portfolio Service

**Purpose:** Owns the tenant as a first-class entity — its identity, legal-entity binding,
organizational structure, lifecycle state, and cross-service references.

**Canonical objects owned:**

| Object | Description |
|--------|-------------|
| Tenant | The primary multi-tenant unit. Has a lifecycle (draft → active → suspended → archived). Bound to exactly one legal market. |
| Legal Entity | The legal organization behind a tenant. May own multiple tenants (e.g., hospital system with multiple facility tenants). |
| Organization | The business/clinical organization structure within a tenant. Maps to VistA institution hierarchy. |
| Tenant–Facility Binding | Links a tenant to its VistA facility configuration. Tenant-scoped. |

**Commands (writes):**
- `createTenantDraft` — create a new tenant in draft state
- `activateTenant` — transition draft → active (requires provisioning run completion)
- `suspendTenant` — active → suspended (operator action, with reason)
- `reactivateTenant` — suspended → active (operator action)
- `archiveTenant` — active/suspended → archived (irreversible after grace period)
- `bindLegalEntity` — associate tenant with legal entity
- `updateTenantMetadata` — update display name, contacts, notes

**Events emitted:**
- `tenant.created`, `tenant.activated`, `tenant.suspended`, `tenant.reactivated`, `tenant.archived`
- `tenant.legal-entity.bound`, `tenant.metadata.updated`

**State machine:** See §3 (Tenant Lifecycle and Orchestration Model).

#### 2.2.2 Composition & Eligibility Service

**Purpose:** Owns the pack composition model — legal-market profiles, pack manifests,
eligibility evaluation, and the deterministic resolver that produces effective configuration
plans.

**Canonical objects owned:**

| Object | Description |
|--------|-------------|
| Legal-Market Profile | Defines mandated, default-on, eligible, and excluded packs for a legal market. Versioned. |
| Pack Manifest | Identity, lifecycle, family, dependencies, eligibility conditions, capability contributions for a single pack. |
| Effective Configuration Plan | Resolved output: which packs are active, which are deferred, readiness posture. Per-tenant. |
| Eligibility Assessment | Per-pack evaluation: does pack X apply to tenant Y given their market, selections, and pack state? |

**Commands:**
- `resolveEffectiveConfigPlan` — run the 7-step resolver for a tenant + market + selections
- `createMarketProfileDraft` — create a new legal-market profile draft
- `updateMarketProfileDraft` — modify draft profile (mandated/default-on/eligible/excluded lists)
- `submitMarketProfileForReview` — draft → review → active lifecycle
- `createPackManifestDraft` — create a new pack manifest draft
- `updatePackManifestDraft` — modify draft pack manifest
- `submitPackManifestForReview` — draft → review → published lifecycle

**Events emitted:**
- `composition.plan.resolved`, `composition.plan.drift-detected`
- `market-profile.created`, `market-profile.updated`, `market-profile.activated`
- `pack-manifest.created`, `pack-manifest.updated`, `pack-manifest.published`

**Key constraint:** The resolver is deterministic and stateless — given the same inputs
(profile + selections + pack registry + readiness state), it always produces the same
effective plan. The service stores resolved plans but can re-derive them at any time.

#### 2.2.3 Bootstrap & Provisioning Orchestrator

**Purpose:** Manages the full lifecycle of bringing a new tenant from initial request
through to a running, configured environment. Orchestrates steps across other services.

**Canonical objects owned:**

| Object | Description |
|--------|-------------|
| Bootstrap Draft | Pre-submission workspace: operator or self-service user assembles market, selections, org info. Not yet a formal request. |
| Bootstrap Request | Submitted request with all required fields validated. Awaiting operator review/approval. |
| Provisioning Run | Ordered sequence of steps that execute against live infrastructure: create tenant, resolve plan, allocate environment, activate packs, configure VistA, run health checks. |
| Provisioning Step | Individual step within a run. Has own status (pending → running → completed/failed/skipped). |

**Commands:**
- `createBootstrapDraft` — start a new draft (operator or self-service)
- `submitBootstrapRequest` — finalize draft into a reviewable request
- `approveBootstrapRequest` — operator approval → triggers provisioning
- `rejectBootstrapRequest` — operator rejects with reason
- `startProvisioningRun` — begin executing provisioning steps
- `cancelProvisioningRun` — abort in-progress provisioning
- `retryProvisioningStep` — retry a failed step
- `rollbackProvisioningRun` — undo completed steps (best-effort)

**Events emitted:**
- `bootstrap.draft.created`, `bootstrap.request.submitted`, `bootstrap.request.approved`, `bootstrap.request.rejected`
- `provisioning.run.started`, `provisioning.step.completed`, `provisioning.step.failed`, `provisioning.run.completed`, `provisioning.run.cancelled`, `provisioning.run.rollback-started`

**Orchestration pattern:** The provisioning run is a saga — each step has a compensating
action. Steps execute sequentially with explicit checkpoints. Failure at any step halts
the run (no silent continuation). The operator may retry, skip (if non-critical), or
rollback.

#### 2.2.4 Runtime Fleet & Release Service

**Purpose:** Manages the infrastructure binding between tenants and their runtime
environments — VistA lane assignment, release-channel tracking, rollout policies,
and fleet health.

**Canonical objects owned:**

| Object | Description |
|--------|-------------|
| Runtime Environment | A deployed environment: VistA instance + platform services + configuration. Identified by environment ID. |
| Environment Binding | Links a tenant to a specific runtime environment. Tenant-scoped. |
| Release Channel | Named release track (stable, canary, beta). Environments are assigned to channels. |
| Rollout Policy | Rules governing how updates propagate: percentage rollout, canary gates, rollback triggers. |
| Fleet Health Snapshot | Point-in-time health of all managed environments: VistA reachability, version, adapter status. |

**Commands:**
- `allocateEnvironment` — assign a tenant to an environment (during provisioning)
- `bindTenantToEnvironment` — create the tenant↔environment link
- `assignReleaseChannel` — set a tenant's environment to a release channel
- `updateRolloutPolicy` — modify rollout rules
- `captureFleetHealthSnapshot` — trigger a health probe across managed environments

**Events emitted:**
- `fleet.environment.allocated`, `fleet.environment.released`
- `fleet.tenant.bound`, `fleet.tenant.unbound`
- `fleet.release-channel.assigned`, `fleet.health.snapshot-captured`

**Current implementation status:** Not started. The distro repo (`vista-evolved-vista-distro`)
manages VistA build lanes and Docker composition. This service will coordinate with
distro-produced artifacts but does not own the VistA build process itself.

#### 2.2.5 Commercial Service

**Purpose:** Manages the commercial relationship — subscriptions, billing accounts,
invoices, payment tracking, and usage metering. This is the platform's own commercial
governance, not clinical billing (which is VistA-owned RCM).

**Canonical objects owned:**

| Object | Description |
|--------|-------------|
| Subscription | Commercial agreement: SKU, term, pricing tier, renewal date, entitlements. |
| Billing Account | Payment entity. May span multiple tenants under one legal entity. |
| Invoice | Periodic billing record. Generated from usage + subscription terms. |
| Usage Record | Metered usage event (active users, API calls, storage, etc.). |
| Payment Status | Current payment state per billing account. |

**Commands:**
- `createSubscription` — bind a subscription to a tenant/legal-entity
- `updateSubscriptionTier` — change SKU/pricing (with proration rules)
- `suspendForNonPayment` — commercial suspension (triggers tenant suspension)
- `recordUsage` — log a metered event
- `generateInvoice` — produce invoice for a billing period

**Events emitted:**
- `commercial.subscription.created`, `commercial.subscription.updated`
- `commercial.payment.received`, `commercial.payment.overdue`
- `commercial.suspension.triggered`

**Key constraint:** Commercial suspension triggers tenant suspension via the Tenant
Portfolio Service. The commercial service does not directly modify tenant lifecycle
state — it emits an event, and the tenant portfolio service decides what to do.

**Current implementation status:** Not started. No contracts, no code.

#### 2.2.6 Support / Incident / Audit Service

**Purpose:** Manages support cases, incident tracking, and the platform-level audit
trail. All operator and system actions across all services are logged here.

**Canonical objects owned:**

| Object | Description |
|--------|-------------|
| Support Case | Issue reported by tenant or operator. Has lifecycle (open → in-progress → resolved → closed). |
| Incident Record | System-detected or operator-escalated incident. Linked to affected tenants/environments. |
| Audit Event | Immutable record of an action: who, what, when, where, outcome. Every command across all services emits audit events. |
| SLA Record | Service-level tracking per tenant/subscription tier. |

**Commands:**
- `createSupportCase` — open a new case
- `updateSupportCase` — add notes, change priority, reassign
- `resolveSupportCase` — mark as resolved
- `createIncident` — escalate to incident
- `acknowledgeIncident` — operator acknowledges
- `resolveIncident` — mark incident resolved

**Events emitted:**
- `support.case.created`, `support.case.resolved`
- `incident.created`, `incident.acknowledged`, `incident.resolved`
- `audit.event.recorded` (firehose — every action across all services)

**Key constraint:** Audit events are append-only and immutable. No delete, no update.
Hash-chained for integrity verification (same pattern as the archive repo's
immutable-audit.ts).

#### 2.2.7 Governance & Readiness Service

**Purpose:** Owns the capability readiness model, launch-tier management, claim-gating
enforcement, and pack lifecycle governance. This is the truth authority for "what is
the system actually capable of?"

**Canonical objects owned:**

| Object | Description |
|--------|-------------|
| Capability Manifest | Declares a named capability: readiness state, scope, pack/adapter dependencies, claim posture. |
| Readiness Assessment | Evaluated state of a capability at a given scope: evidence class, last verified date, blockers. |
| Launch Tier | Market-level maturity designation (T0 internal → T1 pilot → T2 controlled → T3 GA). Derived from readiness dimensions. |
| Pack Lifecycle State | Governs pack progression: draft → review → published → deprecated → retired. |
| Claim Gate | Rule that prevents a capability from being claimed on a claim surface until readiness evidence is provided. |

**Commands:**
- `assessCapabilityReadiness` — evaluate a capability against its readiness criteria
- `updateLaunchTier` — promote or demote a market's launch tier (evidence-gated)
- `advancePackLifecycle` — move a pack through its lifecycle stages
- `createClaimGate` — define a new claim-gating rule
- `overrideClaimGate` — operator override with documented justification (audit-logged)

**Events emitted:**
- `governance.capability.assessed`, `governance.capability.readiness-changed`
- `governance.launch-tier.changed`
- `governance.pack-lifecycle.advanced`
- `governance.claim-gate.overridden`

---

## 3. Canonical control-plane object model

All objects are organized by their owning service. No object is shared owned. Other
services reference objects by ID through contract-defined APIs.

### 3.1 Object registry

| Object | Owning service | Identifier pattern | Persistence |
|--------|---------------|-------------------|-------------|
| Tenant | Tenant Portfolio | `tnt-{uuid}` | Platform PG |
| Legal Entity | Tenant Portfolio | `le-{uuid}` | Platform PG |
| Organization | Tenant Portfolio | `org-{uuid}` | Platform PG |
| Tenant–Facility Binding | Tenant Portfolio | `tfb-{uuid}` | Platform PG |
| Legal-Market Profile | Composition | `{ISO-3166-1-alpha2}` (e.g., `PH`, `US`) | Platform PG + contract JSON files (seed) |
| Pack Manifest | Composition | `{packId}` (e.g., `lang-en`, `regulatory-hipaa`) | Platform PG + contract JSON files (seed) |
| Effective Configuration Plan | Composition | `ecp-{tenantId}-{version}` | Platform PG |
| Eligibility Assessment | Composition | Ephemeral (computed on demand) | Not persisted — derived |
| Bootstrap Draft | Bootstrap Orchestrator | `bsd-{uuid}` | Platform PG |
| Bootstrap Request | Bootstrap Orchestrator | `bsr-{uuid}` | Platform PG |
| Provisioning Run | Bootstrap Orchestrator | `pr-{uuid}` | Platform PG |
| Provisioning Step | Bootstrap Orchestrator | `prs-{uuid}` | Platform PG (child of run) |
| Runtime Environment | Fleet & Release | `env-{uuid}` | Platform PG |
| Environment Binding | Fleet & Release | `eb-{tenantId}-{envId}` | Platform PG |
| Release Channel | Fleet & Release | `rc-{name}` (e.g., `rc-stable`) | Platform PG |
| Rollout Policy | Fleet & Release | `rp-{uuid}` | Platform PG |
| Fleet Health Snapshot | Fleet & Release | `fhs-{timestamp}` | Platform PG (time-series) |
| Subscription | Commercial | `sub-{uuid}` | Platform PG |
| Billing Account | Commercial | `ba-{uuid}` | Platform PG |
| Invoice | Commercial | `inv-{uuid}` | Platform PG |
| Usage Record | Commercial | `ur-{uuid}` | Platform PG (append-only) |
| Payment Status | Commercial | Per billing account | Platform PG |
| Support Case | Support/Incident/Audit | `sc-{uuid}` | Platform PG |
| Incident Record | Support/Incident/Audit | `inc-{uuid}` | Platform PG |
| Audit Event | Support/Incident/Audit | `ae-{uuid}` | Platform PG (append-only, hash-chained) |
| SLA Record | Support/Incident/Audit | Per tenant + subscription | Platform PG |
| Capability Manifest | Governance | `{capabilityClass}.{capabilityName}` | Platform PG + contract JSON files (seed) |
| Readiness Assessment | Governance | Per capability + scope | Platform PG |
| Launch Tier | Governance | Per legal market | Platform PG |
| Pack Lifecycle State | Governance | Per pack manifest | Platform PG |
| Claim Gate | Governance | `cg-{uuid}` | Platform PG |

### 3.2 Persistence policy alignment

All control-plane objects persist in Platform PostgreSQL. This aligns with the
persistence policy (`docs/reference/persistence-policy.md`):

- No SQLite for persistent state
- No in-memory for persistent state
- VistA is source of truth where VistA owns the data
- Platform PG for control-plane and integration concerns only

Control-plane objects are **platform-governance data**, not clinical data. VistA does
not own tenant portfolio, composition, provisioning, fleet, commercial, or audit data.
Platform PG is the correct persistence target.

### 3.3 Seed data vs runtime data

Several objects have a dual lifecycle:

- **Seed instances** exist as JSON files in `packages/contracts/` (pack manifests,
  legal-market profiles, capability manifests, effective plans). These are the contract
  source of truth during design and local review.
- **Runtime instances** will exist in Platform PG when the live backend is implemented.
  The seed data is the initial load; runtime mutations are persisted to PG and the
  contract JSON files serve as version-controlled snapshots.

The current `apps/control-plane/` review runtime loads from contract JSON files.
The future live backend will load from PG with contract files as seed/migration source.

---

## 4. Canonical state families

Each state family below is a finite state machine owned by exactly one service.
State transitions are commands; transitions emit events. No state is modified except
through its owning service's command API.

### 4.1 Tenant lifecycle

**Owner:** Tenant Portfolio Service

```
draft → active → suspended → archived
                ↗ reactivated
         active ← suspended
```

| State | Entry condition | Exit transitions | Notes |
|-------|---------------|-----------------|-------|
| `draft` | `createTenantDraft` | → `active` (via `activateTenant` after provisioning completes) | Pre-provisioning. Metadata only, no runtime. |
| `active` | Provisioning run completed successfully | → `suspended` (operator or commercial trigger) | Fully operational. All tenant-scoped workspaces available. |
| `suspended` | `suspendTenant` (operator), `commercial.suspension.triggered` (event) | → `active` (via `reactivateTenant`), → `archived` (via `archiveTenant`) | Access revoked. Data preserved. Reversible. |
| `archived` | `archiveTenant` | Terminal state | Data retained per policy, then purged. Irreversible after grace period. |

### 4.2 Provisioning run

**Owner:** Bootstrap & Provisioning Orchestrator

```
pending → running → completed
                  → failed → retrying → completed/failed
                  → cancelled
                  → rolling-back → rolled-back
```

| State | Entry condition | Exit transitions |
|-------|---------------|-----------------|
| `pending` | `startProvisioningRun` | → `running` |
| `running` | First step begins execution | → `completed`, → `failed`, → `cancelled` |
| `completed` | All steps completed successfully | Terminal (success) |
| `failed` | Any step failed | → `retrying` (via `retryProvisioningStep`), → `rolling-back` |
| `retrying` | Operator retries a failed step | → `running` (step succeeds), → `failed` (step fails again) |
| `cancelled` | `cancelProvisioningRun` | Terminal |
| `rolling-back` | `rollbackProvisioningRun` | → `rolled-back` |
| `rolled-back` | All compensating actions completed | Terminal |

### 4.3 Billing / account

**Owner:** Commercial Service

```
trial → active → past-due → suspended → terminated
                          ↗ reactivated
                   active ← past-due (payment received)
```

| State | Entry condition | Exit transitions |
|-------|---------------|-----------------|
| `trial` | Subscription created with trial period | → `active` (trial converts), → `terminated` (trial expires without conversion) |
| `active` | Subscription active, payment current | → `past-due` (payment missed) |
| `past-due` | Payment deadline missed | → `active` (payment received), → `suspended` (grace period expired) |
| `suspended` | Grace period expired without payment | → `active` (payment received), → `terminated` (operator action) |
| `terminated` | Operator termination or contract end | Terminal. Triggers tenant archival flow. |

### 4.4 Invitation / identity binding

**Owner:** Tenant Portfolio Service (identity binding aspect)

```
invited → accepted → active → revoked
                            → expired (unused invitation)
```

| State | Description |
|-------|-------------|
| `invited` | Invitation sent to email/identity. Token issued, not yet accepted. |
| `accepted` | User accepted invitation. Identity verified. Pending role assignment. |
| `active` | User is an active member of the tenant with assigned role(s). |
| `revoked` | Access revoked by tenant admin or platform operator. |
| `expired` | Invitation expired without acceptance. |

### 4.5 Market launch tier

**Owner:** Governance & Readiness Service

```
T0 (internal) → T1 (pilot) → T2 (controlled) → T3 (GA)
                                               ← downgrade possible
```

| Tier | Description | Visibility |
|------|-------------|------------|
| `T0` | Internal use only. R&D, testing. | Platform operators only. |
| `T1` | Named pilot partners. | Operator-invited tenants only. |
| `T2` | Controlled availability. Vetted applicants. | Self-service with approval gate. |
| `T3` | General availability. Open enrollment. | Self-service, no approval gate. |

Tier advancement requires evidence across all 8 readiness dimensions. Tier demotion
is immediate when evidence degrades. No grace period.

### 4.6 Pack eligibility

**Owner:** Composition & Eligibility Service

```
not-evaluated → eligible → activated → deactivated
                         → ineligible
                         → deferred (dependency unmet)
```

| State | Description |
|-------|-------------|
| `not-evaluated` | Pack has not been assessed for this tenant/scope. |
| `eligible` | Pack meets eligibility conditions but is not yet activated. |
| `activated` | Pack is active in the tenant's effective configuration. |
| `deactivated` | Pack was activated but tenant-admin or operator deactivated it. |
| `ineligible` | Pack does not meet eligibility conditions for this tenant/scope. |
| `deferred` | Pack is eligible but a dependency is unmet. Will activate when dependency resolves. |

### 4.7 Support / incident

**Owner:** Support / Incident / Audit Service

```
Support case: open → in-progress → resolved → closed
                                 → escalated (to incident)
Incident:     detected → acknowledged → investigating → resolved → post-mortem
```

### 4.8 Bootstrap request

**Owner:** Bootstrap & Provisioning Orchestrator

```
draft → submitted → under-review → approved → provisioning-started
                                 → rejected
                                 → withdrawn (by submitter)
```

---

## 5. Service-to-surface binding

Each surface belongs to exactly one architectural layer and is served by specific
control-plane services. This table binds the 8 current control-plane surfaces
(from screen-inventory.md) to their backing service domains.

### 5.1 Operator console surfaces

These surfaces appear in the **provider operator console**. They are platform-wide,
operator-only surfaces consuming control-plane service APIs.

| Surface ID | Surface name | Primary service | Secondary services | Notes |
|-----------|-------------|----------------|-------------------|-------|
| `control-plane.tenants.list` | Tenant Registry | Tenant Portfolio | Commercial (subscription status), Support (open cases) | Lists all tenants with lifecycle state and commercial status. |
| `control-plane.tenants.detail` | Tenant Detail | Tenant Portfolio | Composition (effective plan), Fleet (environment), Commercial (subscription) | Single-tenant deep view. Cross-service aggregation. |
| `control-plane.tenants.bootstrap` | Tenant Bootstrap | Bootstrap Orchestrator | Composition (resolver preview), Tenant Portfolio (tenant creation) | Bootstrap request submission and tracking. |
| `control-plane.provisioning.runs` | Provisioning Runs | Bootstrap Orchestrator | Fleet (environment allocation), Composition (plan execution) | Run monitoring, step status, retry/rollback controls. |
| `control-plane.markets.management` | Market Management | Composition | Governance (readiness, launch tier) | Legal-market profile listing with readiness dimensions. |
| `control-plane.markets.detail` | Market Detail | Composition | Governance (readiness), Tenant Portfolio (affected tenants) | Single-market deep view with pack composition details. |
| `control-plane.packs.catalog` | Pack Catalog | Composition | Governance (pack lifecycle, readiness) | All pack manifests with lifecycle state and eligibility. |
| `control-plane.system.config` | System Config | Governance | All services (feature flags affect all) | Platform-wide configuration and feature flags. |

### 5.2 Self-service onboarding surfaces (future)

These surfaces would appear in the **customer self-service onboarding** layer. They
consume a restricted subset of control-plane APIs — no platform-wide visibility.

| Surface ID (candidate) | Surface name | Primary service | Constraints |
|------------------------|-------------|----------------|-------------|
| `onboarding.market-selection` | Market Selection | Composition | Can only see markets at T2+ (controlled availability) or T3 (GA). No T0/T1 markets visible. |
| `onboarding.pack-review` | Pack Eligibility Review | Composition | Can only see packs eligible for the selected market. No cross-market visibility. |
| `onboarding.bootstrap-form` | Bootstrap Request Form | Bootstrap Orchestrator | Can only create drafts and submit. Cannot approve. Cannot start provisioning. |
| `onboarding.request-tracker` | Request Status Tracker | Bootstrap Orchestrator | Can only see own request status. No other tenant visibility. |

**Implementation status:** Not started. These surface IDs are candidates only.
Formal screen-contract instances are not authored by this document.

### 5.3 Tenant-admin surfaces (reference only — not this document's scope)

Tenant-admin surfaces are in the **tenant runtime plane**, not the control plane.
For reference, tenant-admin surfaces consume control-plane outputs (effective plans,
pack activations) but interact via tenant-scoped APIs. The tenant-admin workspace map
is defined in `information-architecture-workspace-map.md` §12.

---

## 6. Command and event ownership

### 6.1 Command ownership rule

Every write command is owned by exactly one service. No command has two owners.
The owning service is the only service that may modify the object's state.

Other services may **request** state changes by emitting events that the owning
service subscribes to. Example: Commercial Service emits `commercial.suspension.triggered`;
Tenant Portfolio Service subscribes and decides whether to execute `suspendTenant`.

### 6.2 Event flow patterns

| Pattern | Example | Notes |
|---------|---------|-------|
| **Command → owner → event** | Operator clicks "Suspend Tenant" → Tenant Portfolio `suspendTenant` → emits `tenant.suspended` | Standard flow. UI calls API, service processes, event emitted. |
| **Event → subscriber → command** | `commercial.suspension.triggered` → Tenant Portfolio subscribes → executes `suspendTenant` | Cross-service coordination via events, not direct API calls. |
| **Orchestration saga** | Provisioning run → step 1 (create tenant) → step 2 (resolve plan) → step 3 (allocate env) → ... | Sequential steps, each calling different service commands. Orchestrator owns the sequence. |
| **Query aggregation** | Tenant Detail surface → calls Tenant Portfolio + Composition + Fleet + Commercial → renders composite view | Read path only. No state mutation. Console aggregates from multiple services. |

### 6.3 Cross-service event subscriptions

| Event | Producer | Subscribers | Action on receipt |
|-------|---------|-------------|------------------|
| `commercial.suspension.triggered` | Commercial | Tenant Portfolio | May suspend tenant |
| `tenant.activated` | Tenant Portfolio | Commercial (start billing), Fleet (confirm binding), Support (open welcome case) | Service-specific reactions |
| `tenant.archived` | Tenant Portfolio | Commercial (terminate subscription), Fleet (release environment), Support (close cases) | Cleanup |
| `governance.capability.readiness-changed` | Governance | Composition (re-resolve affected plans) | Plan drift detection |
| `governance.launch-tier.changed` | Governance | Composition (update profile visibility) | Market visibility update |
| `provisioning.run.completed` | Bootstrap Orchestrator | Tenant Portfolio (activate tenant) | Tenant lifecycle transition |

---

## 7. AI overlay rules

AI assistance is governed by `docs/explanation/ai-assist-safety-spec.md`. Within the
control-plane service architecture, AI operates under strict constraints organized
into four assist categories.

### 7.1 Four AI assist categories for the control plane

| Category | What AI may do | What AI may NOT do | Surfaces where this applies |
|---------|---------------|-------------------|---------------------------|
| **Read-only copilot** | Summarize tenant status, explain readiness dimensions, describe pack composition, answer "what would happen if" queries using the resolver | Modify any state, call any write command, access PHI | All operator console surfaces, all self-service surfaces |
| **Draft-only copilot** | Pre-populate bootstrap draft fields, suggest pack selections based on market profile, generate draft configuration values | Submit requests, approve anything, bypass review, write to persistent state | Bootstrap, pack authoring, market profile editing |
| **Runbook / SOP copilot** | Walk operator through multi-step procedures (provisioning, incident response, rollback), explain what each step does, highlight risks and prerequisites | Execute steps autonomously, skip steps, bypass approval gates, directly invoke infrastructure commands | Provisioning runs, incident response, fleet management |
| **Supervised low-risk actions** | Execute operator-confirmed read-only queries, format data exports, generate audit reports | Initiate any state change without explicit operator confirmation per action, batch-execute multiple writes, access other tenants' data | Audit viewers, report generation, data exports |

### 7.2 Non-negotiable AI constraints

1. **AI never writes to VistA.** The control plane does not write to VistA directly;
   that constraint is inherited and absolute.
2. **AI never approves.** Bootstrap approval, provisioning start, tenant activation —
   all require human operator action. AI may suggest; a human must confirm.
3. **AI suggestions are ephemeral.** AI-generated content (drafts, suggestions, summaries)
   is not persisted as source of truth. It must be reviewed and committed by a human.
4. **AI does not see PHI.** Control-plane services do not handle PHI. AI operating in
   the control-plane context has no access to clinical data, patient records, or
   PHI-bearing audit trails.
5. **AI actions are audit-logged.** Every AI-assisted action (read, draft, suggestion)
   is recorded in the audit trail with `assist-type` classification.
6. **AI does not have platform-operator authority.** AI operates under a constrained
   service identity, not under the operator's full permissions. It cannot escalate.

### 7.3 AI is not backend truth

AI assists with the **interpretation** of control-plane data, not the **production**
of it. The control-plane services are the source of truth. AI may help operators
understand what the services report, but AI does not replace the services' authority.

This is analogous to the clinical boundary: VistA is the source of clinical truth,
and AI may summarize or explain but never author clinical records. In the control-plane
context: the 7 services are the source of governance truth, and AI may summarize or
suggest but never directly mutate governance state.

---

## 8. Relationship to existing architecture documents

This document does not replace the global system architecture spec, the workspace map,
or the composition resolver spec. It adds a service-domain decomposition layer that
those documents described implicitly but never made explicit.

### 8.1 What this document adds that was missing

| Gap | Resolution in this document |
|-----|----------------------------|
| No service decomposition | §2 defines 7 canonical service domains with ownership boundaries |
| No explicit object model | §3 enumerates all control-plane objects with owning service and persistence |
| No state families | §4 defines 8 finite state machines |
| No service-to-surface binding | §5 maps surfaces to their backing services |
| No command/event ownership | §6 defines ownership rules and cross-service event patterns |
| No self-service onboarding layer | §1 and §5.2 define the self-service architectural layer |
| No commercial service | §2.2.5 defines subscription/billing as a control-plane concern |
| No fleet/release service | §2.2.4 defines runtime environment management |
| AI rules scattered | §7 consolidates AI overlay rules per category |
| Control plane vs console conflated | §1 explicitly separates services from console from self-service from runtime |

### 8.2 What this document does NOT change

| Existing truth | Status |
|---------------|--------|
| VistA is source of clinical truth | Unchanged. Reinforced in §3.2. |
| Terminal-first product strategy | Unchanged. Not addressed by this document — control-plane services are API-first, not terminal-native. |
| 7 workspace families | Unchanged. This document adds service backing to the control-plane workspace. |
| Pack composition algorithm (7-step resolver) | Unchanged. Owned by Composition & Eligibility Service. |
| Screen inventory (29 concrete + 33 deferred) | Unchanged. Surface-to-service binding added, no new surfaces authorized. |
| Permissions matrix | Unchanged. Role × surface × action decisions are not modified. |
| `apps/control-plane/` is a local review runtime | Unchanged. Explicitly stated in §1.2. |
| ADR governance (VE-PLAT-ADR-NNNN namespace) | Unchanged. |

---

## 9. Out of scope

This document does NOT:

1. Author screen-contract JSON instances
2. Generate OpenAPI or AsyncAPI contract changes
3. Define tenant-admin workspace internals
4. Define clinical, ancillary, revenue-cycle, analytics, or IT workspace internals
5. Implement any service, API route, database schema, or event bus
6. Prescribe specific technology choices for event bus, API gateway, or service mesh
7. Design the operator console UI (that is a future wireframe/prototype concern)
8. Design the self-service onboarding UI
9. Define inside-VistA authorization or security-key mapping
10. Make market, payer, or capability readiness claims
11. Change the `apps/control-plane/` review runtime behavior

---

## 10. Resolved vs deferred

### 10.1 Resolved by this document

| # | Question | Answer |
|---|---------|--------|
| 1 | How many control-plane service domains exist? | 7 (§2.1) |
| 2 | What objects does the control plane own? | 29 named objects across 7 services (§3.1) |
| 3 | What state machines exist? | 8 state families (§4) |
| 4 | Which service backs which surface? | 8 operator console surfaces mapped at time of writing (§5.1); now expanded to 21 surfaces — see `control-panel-page-specs-v2.md` |
| 5 | Is there a self-service onboarding layer? | Yes, architecturally defined (§1, §5.2) |
| 6 | Is control plane the same as the operator console? | No. Four distinct layers (§1). |
| 7 | How does AI participate? | 4 assist categories, 6 non-negotiable constraints (§7) |
| 8 | Is there a commercial service? | Yes, explicitly defined (§2.2.5) |
| 9 | Is there a fleet/release service? | Yes, explicitly defined (§2.2.4) |

### 10.2 Deferred to next artifacts

| # | Deferred item | Target artifact |
|---|--------------|----------------|
| 1 | OpenAPI operations for new service domains (Fleet, Commercial, Support, Governance) | `packages/contracts/openapi/` |
| 2 | AsyncAPI event definitions for cross-service coordination | `packages/contracts/asyncapi/` |
| 3 | Database schema for all 29 objects | PG migration scripts |
| 4 | Self-service onboarding screen contracts | `packages/contracts/screen-contracts/` |
| 5 | Operator console wireframes and interaction design | Design artifact |
| 6 | Specific event-bus technology selection | ADR |
| 7 | Service deployment topology (monolith-first vs microservices) | ADR |
| 8 | Authentication and identity-provider integration for self-service | ADR + how-to |
