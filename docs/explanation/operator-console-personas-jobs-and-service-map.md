# Operator Console Personas, Jobs, and Service Map

> **Status:** Canonical — operator persona and job model.
> **Date:** 2026-03-20.
> **Type:** Explanation — persona definitions, job catalog, service-map binding.
> **Scope:** Defines who uses the operator console, what work they do, and how their
> jobs map to the control-plane service domains.
> **Governed by:** AGENTS.md, operator-console-ux-ia-reset-and-journey-pack.md,
> control-plane-service-map-and-operator-console-architecture.md.
> **Does NOT authorize:** Runtime implementation or UI code.

---

## 1. Purpose

This document provides the detailed persona model, job catalog, and service-map binding
for the provider operator console. It is the reference that design, implementation,
and review work consumes when answering: "Who is this surface for, what are they trying
to do, and what backend is involved?"

---

## 2. Persona model

### 2.1 Primary: Platform Operator

The platform operator is the daily user of the operator console. They manage the
lifecycle of tenants from initial onboarding request through active operation to
eventual archival.

**Characteristics:**

- Works for the provider organization (the entity operating VistA Evolved)
- Has platform-wide scope — can see all tenants, all markets, all environments
- Not a clinician — never touches patient data or clinical workflows
- Not a developer — uses the console, not the codebase
- Comfortable with operational concepts but not VistA internals

**Daily workflow:**

```
Morning check-in
  └─ Home: what needs attention?
      ├─ Pending requests → process onboarding
      ├─ Failed provisioning → investigate and retry
      ├─ Active alerts → triage
      └─ Nothing pending → review tenant health
```

**Key metrics they care about:**

| Metric | Why | Where |
|--------|-----|-------|
| Pending request count | Backlog visibility | Home |
| Active/failed provisioning count | Progress tracking | Home, Requests & Onboarding |
| Tenant count by state | Portfolio health | Tenants |
| Alert count by severity | Risk awareness | Operations, Home |
| Environment health summary | Platform stability | Operations |

**Metrics they do NOT care about:**

- Pack readiness percentages
- Capability truth scores
- Market composition details
- Eligibility simulation results
- Audit event volume
- System parameter values (unless troubleshooting)

### 2.2 Secondary: Senior Operator / Governance Lead

A more experienced operator who handles governance workflows in addition to daily operations.

**Unique responsibilities:**

| Responsibility | Domain | Frequency |
|---------------|--------|-----------|
| Review and approve market profile drafts | Catalogs & Governance | As-needed |
| Review and approve pack manifest drafts | Catalogs & Governance | As-needed |
| Manage feature flags | Platform | Rare |
| Review audit trail for compliance | Platform | Weekly or on-demand |
| Set system parameters | Platform | Rare |
| Manage launch-tier readiness | Catalogs & Governance | Per-market |

**When they appear:** The standard operator escalates to the governance lead when:
- A market profile needs approval
- A pack lifecycle state change is needed
- A system-wide feature flag change is requested
- An audit investigation is required

### 2.3 Boundary personas (explicitly excluded)

These personas use different applications. They never see the operator console navigation.

| Persona | Application | Why excluded |
|---------|------------|-------------|
| Tenant Administrator | Tenant-admin workspace | Tenant-scoped only, no platform visibility |
| Onboarding Contact | Self-service onboarding wizard | Pre-tenant, constrained API |
| Clinician | Clinical workspace (CPRS model) | Patient-scoped, VistA-driven |
| Nurse / Ancillary | Ancillary workspace | Task-scoped, VistA-driven |
| Revenue Cycle Staff | Revenue cycle workspace | Tenant billing/claims, not platform billing |
| Analyst | Analytics workspace | Read-only derived data |
| IT Integration Staff | IT-integration workspace | Channel management, not platform operations |

---

## 3. Job catalog — detailed

### J1: Check what needs my attention

**Trigger:** Operator opens the console or returns from a break.
**Domain:** Home.
**Steps:**

1. Land on Home
2. Scan pending request count
3. Scan active/failed provisioning count
4. Scan alert summary
5. Click the most urgent item to navigate to the relevant domain

**Success:** Operator knows what to work on next within 10 seconds.
**Failure mode:** Home shows no actionable information, or shows fake metrics.

### J2: Process an onboarding request

**Trigger:** New bootstrap request appears (from self-service or operator-initiated).
**Domain:** Requests & Onboarding.
**Steps:**

1. Navigate to Requests & Onboarding → Bootstrap Requests
2. Select the pending request
3. Review tenant details, selected market, pack selections
4. Verify eligibility and resolver output
5. Approve or reject with reason
6. If approved, monitor resulting provisioning run

**Success:** Request moves through submitted → approved → provisioning.
**Failure mode:** Operator cannot find the request, or approval triggers no provisioning.

### J3: Monitor a provisioning run

**Trigger:** Provisioning run is active or has failed.
**Domain:** Requests & Onboarding.
**Steps:**

1. Navigate to Requests & Onboarding → Provisioning Runs
2. Select the run
3. Review step-by-step progress
4. If failed: check step detail, decide retry or rollback
5. If completed: verify tenant state transitions

**Success:** Provisioning completes, or operator successfully retries/rolls back.
**Failure mode:** Steps are unclear, no retry/rollback action available.

### J4: Review tenant health

**Trigger:** Routine daily check or investigation after alert.
**Domain:** Tenants.
**Steps:**

1. Navigate to Tenants → Tenant Registry
2. Scan tenant list — check lifecycle state badges
3. Select a tenant to open the Tenant Detail dossier
4. Review: lifecycle state, environment binding, pack configuration, recent events

**Success:** Operator has a complete picture of a tenant's health.
**Failure mode:** Tenant detail shows raw IDs or architecture concepts instead of ops info.

### J5: Manage tenant lifecycle

**Trigger:** Business decision to suspend, reactivate, or archive a tenant.
**Domain:** Tenants.
**Steps:**

1. Navigate to Tenant Detail for the target tenant
2. Select the lifecycle action (suspend / reactivate / archive)
3. Provide reason (required for suspend and archive)
4. Confirm action
5. Verify state transition

**Success:** Tenant state changes and is reflected in registry.
**Failure mode:** Action button is missing, reason is not required, state does not change.

### J6: Respond to an alert

**Trigger:** Alert notification or Home indicates unresolved alerts.
**Domain:** Operations.
**Steps:**

1. Navigate to Operations → Alert Center
2. Review alerts by severity
3. Select an alert to see details
4. Navigate to affected tenant or environment
5. Take corrective action

**Success:** Alert is triaged, affected entity is identified, corrective action is taken.
**Failure mode:** Alert has no context, cannot navigate to affected entity.

### J7: Check system operations

**Trigger:** Routine daily check.
**Domain:** Operations.
**Steps:**

1. Navigate to Operations → Operations Center
2. Review environment health summary
3. Check backup status in Backup & DR
4. Review feature flag state in Environments & Flags

**Success:** Operator confirms platform is healthy.
**Failure mode:** Operations surfaces show no data or fake health metrics.

### J8: Handle support escalation

**Trigger:** Tenant requests help or incident is reported.
**Domain:** Support.
**Steps:**

1. Navigate to Support → Support Console
2. Find or create support case
3. Review tenant context (linked from case)
4. Check audit trail for relevant events
5. Resolve or escalate

**Success:** Case is logged, tenant context is accessible, resolution is tracked.
**Failure mode:** Support console is disconnected from tenant data.

### J9: Review billing and entitlements

**Trigger:** Monthly billing review or tenant billing inquiry.
**Domain:** Commercial.
**Steps:**

1. Navigate to Commercial → Billing & Entitlements
2. Review billing summary across tenants
3. Drill into specific tenant billing detail
4. Check usage data in Usage & Metering

**Success:** Billing posture is clear.
**Failure mode:** Fake billing numbers displayed without source badge.

### J10: Review or approve a market/pack draft

**Trigger:** Draft market profile or pack manifest ready for review.
**Domain:** Catalogs & Governance.
**Steps:**

1. Navigate to Catalogs & Governance → Market Management or Pack Catalog
2. Filter by "under review" status
3. Open the draft
4. Review fields, eligibility rules, readiness dimensions
5. Approve or return with feedback

**Success:** Draft advances through its lifecycle.
**Failure mode:** Cannot distinguish between draft, review, and active items.

### J11: Configure system parameters

**Trigger:** Rare system-level configuration change.
**Domain:** Platform.
**Steps:**

1. Navigate to Platform → System Configuration
2. Find the parameter or feature flag
3. Review current value and impact description
4. Update with confirmation

**Success:** Parameter is updated, change is audited.
**Failure mode:** Parameter change has no audit trail or confirmation.

### J12: Review audit trail

**Trigger:** Compliance check or incident investigation.
**Domain:** Platform.
**Steps:**

1. Navigate to Platform → Audit Trail
2. Filter by time range, event type, entity, or actor
3. Review event details
4. Export if needed

**Success:** Relevant audit events are found and reviewed.
**Failure mode:** Audit trail is empty or unfilterable.

---

## 4. Service-map binding

### 4.1 Domain-to-service mapping

| Operator console domain | Primary backing service | Secondary services consumed | Primary data objects |
|------------------------|------------------------|---------------------------|---------------------|
| Home | Cross-cutting aggregation | All 7 services | Counts, summaries, action links |
| Requests & Onboarding | Bootstrap & Provisioning Orchestrator | Tenant Portfolio, Composition | Bootstrap requests, provisioning runs, steps |
| Tenants | Tenant Portfolio Service | Composition (effective plans), Fleet (environment binding) | Tenants, legal entities, organizations |
| Operations | Runtime Fleet & Release Service | Governance (health gates), Support (alerts) | Environments, release channels, health snapshots |
| Support | Support / Incident / Audit Service | Tenant Portfolio (case binding) | Support cases, incident records |
| Commercial | Commercial Service | Tenant Portfolio (tenant binding) | Subscriptions, billing accounts, usage records |
| Catalogs & Governance | Composition & Eligibility Service, Governance & Readiness Service | — | Markets, packs, capabilities, readiness assessments |
| Platform | Governance & Readiness Service, Support / Incident / Audit Service | — | System config, feature flags, audit events, templates |

### 4.2 API contract alignment

The OpenAPI contract (`packages/contracts/openapi/control-plane-operator-bootstrap-and-provisioning.openapi.yaml`)
defines 26 operations. These map to operator console domains as follows:

| API operation group | Operator console domain |
|--------------------|------------------------|
| listTenants, getTenant | Tenants |
| listBootstrapRequests, getBootstrapRequest, createBootstrapRequest, approveBootstrapRequest, rejectBootstrapRequest | Requests & Onboarding |
| listProvisioningRuns, getProvisioningRun, startProvisioningRun, cancelProvisioningRun, retryProvisioningRun | Requests & Onboarding |
| listLegalMarketProfiles, getLegalMarketProfile, createMarketDraft, updateMarketDraft, submitMarketForReview | Catalogs & Governance |
| listPacks, getPack, createPackDraft, updatePackDraft, submitPackForReview | Catalogs & Governance |
| getSystemConfig, updateFeatureFlag, updateSystemParameter | Platform |
| suspendTenant, reactivateTenant, archiveTenant | Tenants |
| resolveEffectiveConfigPlan | Catalogs & Governance (via Requests & Onboarding drill-down) |

---

## 5. Anti-patterns to avoid

| Anti-pattern | Why it fails | What to do instead |
|-------------|-------------|-------------------|
| Architecture-first navigation | Operators don't think in "Composition & Eligibility Service" | Use job-centered domain names |
| Fake KPI dashboards | Numbers without real data erode trust | Show real counts or honest "Static Preview" badge |
| Pack readiness on Home | Not actionable for daily operations | Put in Catalogs & Governance |
| Raw IDs visible | Operators don't need `tenant-id: abc-123-def` without context | Show display name, put ID in detail/drawer |
| Vendor console cloning | AWS Console IA does not fit a health-sector tenant operator | Design for VistA Evolved operator jobs |
| Deep nesting | 3+ levels before actionable content | List → Detail → Action (max 3 levels) |
