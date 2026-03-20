# Operator Console UX/IA Reset and Journey Pack

> **Status:** Canonical — approved IA reset specification.
> **Date:** 2026-03-20.
> **Type:** Explanation — UX/IA reset, operator journeys, canonical navigation model.
> **Scope:** Redefines the top-level information architecture, navigation hierarchy,
> and operator journey model for the provider operator console.
> **Governed by:** AGENTS.md, control-plane-service-map-and-operator-console-architecture.md.
> **Supersedes:** The 5-group Fleet-era navigation model from IA v2 and page-specs v2.
> The 7-group model defined in design-contract v2 and the runtime shell is closer but
> also superseded by the 8-domain model defined here.
> **Does NOT authorize:** Runtime implementation or UI code. That is Task 4.

---

## 1. Purpose

### 1.1 What this document is

This document resets the top-level information architecture of the provider operator
console from an architecture-centered model to a **job-centered model**. It defines:

- The 8 canonical top-level IA domains
- Operator personas and jobs
- Navigation hierarchy rules
- Journey definitions connecting operator goals to surfaces
- Migration map from the current 7-domain shell to the new 8-domain model

### 1.2 What this document is NOT

- Not a visual design spec (no pixel/color/spacing decisions)
- Not a runtime implementation (no code, no routes, no app.js changes)
- Not a backend redesign (no new services, no new persistence)
- Not a general product expansion (no new capabilities beyond current 21 surfaces)

### 1.3 Position in handoff chain

| Predecessor | What it provides |
|-------------|-----------------|
| Service-map architecture | 7 service domains, 4 layers, canonical object model |
| Screen inventory | 21 concrete surfaces + deferred families |
| Design contract v2 | 7-group shell domain model (superseded by this doc's 8-domain model) |
| Page specs v2 | Per-surface operator manual (surface assignment updated by this doc) |
| Permissions matrix | Role × surface × action matrix |

| Successor | What it consumes from this doc |
|-----------|-------------------------------|
| Design contract v3 (Task 3) | Approved IA domains, surface assignments, content model |
| Shell rewrite (Task 4) | Left-nav structure, surface routing, page header rules |
| Figma/Stitch handoff (Task 5) | Persona context, IA structure, journey definitions |

---

## 2. Design principles for the reset

### 2.1 Job-centered, not architecture-centered

Every primary navigation item must answer a question an operator asks during their daily work.
The old model surfaced internal architecture concepts (Fleet, Commerce, Markets & Readiness)
as first-class nav items. Operators do not think in service-domain terms. They think in terms
of work they need to do.

### 2.2 Action-centered Home

Home is not a dashboard of system metrics. Home answers: "What needs my attention right now?"
It surfaces pending requests, recent provisioning failures, active alerts, and next safe actions.

### 2.3 Demote architecture vocabulary

Pack readiness, capability truth, market composition, eligibility simulation — these are
important but specialized. They belong inside **Catalogs & Governance**, not on the primary
navigation path. An operator checking on a tenant onboarding request should not navigate
through pack catalogs and readiness registries.

### 2.4 First-class Requests & Onboarding

Bootstrap requests and onboarding are the primary inbound workflow for the operator console.
They deserve their own top-level domain, not burial inside the "Tenants" group alongside
infrastructure detail.

### 2.5 Honest posture

Every surface must display its data-source posture honestly. No fake KPIs. No pretend-live
dashboards. Source badges (real-backend, fixture-fallback, contract-backed, static) remain.

---

## 3. Operator personas

### 3.1 Platform Operator (primary)

The day-to-day operator of the VistA Evolved provider control plane.

| Attribute | Description |
|-----------|-------------|
| **Role** | `platform-operator` |
| **Scope** | Platform-wide: all tenants, all markets, all environments |
| **Primary jobs** | Process onboarding requests, monitor provisioning, manage tenant lifecycle, respond to alerts, maintain system configuration |
| **Secondary jobs** | Review pack/market drafts, manage governance posture, track billing/entitlements, handle support escalations |
| **Not their job** | Clinical workflow, patient data, VistA terminal operation, tenant-admin configuration |
| **Daily rhythm** | Check Home for action items → process requests → check operations → review tenant health → handle exceptions |

### 3.2 Senior Platform Operator / Governance Lead

A senior operator responsible for market readiness, pack governance, and system-level decisions.

| Attribute | Description |
|-----------|-------------|
| **Role** | `platform-operator` (same role, elevated responsibilities) |
| **Scope** | Platform-wide with emphasis on governance and readiness |
| **Primary jobs** | Review and approve market profiles, manage pack lifecycle, set feature flags, review audit trail, manage launch tiers |
| **Trigger** | Works in Catalogs & Governance and Platform domains when the standard operator escalates |

### 3.3 Boundary personas (NOT served by operator console)

| Persona | Where they work | Why not here |
|---------|----------------|--------------|
| **Tenant Administrator** | Tenant-admin workspace (separate boundary) | Tenant-scoped, no platform-wide visibility |
| **Customer Self-Service Onboarding Contact** | Self-service onboarding surface (separate boundary) | Pre-tenant, constrained API subset |
| **Clinician / Ancillary Staff** | Clinical and ancillary workspaces | Patient-scoped, VistA-driven |
| **Revenue Cycle Staff** | Revenue cycle workspace | Tenant-scoped billing/claims |

---

## 4. Operator jobs

### 4.1 Job catalog

| # | Job | Frequency | Starting domain | Key surfaces touched |
|---|-----|-----------|----------------|---------------------|
| J1 | **Check what needs my attention** | Multiple times daily | Home | Home → any surface with pending items |
| J2 | **Process an onboarding request** | Daily | Requests & Onboarding | Request list → request detail → approve/reject → provisioning |
| J3 | **Monitor a provisioning run** | Per-request | Requests & Onboarding | Provisioning run → step detail → retry/rollback |
| J4 | **Review tenant health** | Daily | Tenants | Tenant registry → tenant detail → operations/config context |
| J5 | **Manage tenant lifecycle** | As-needed | Tenants | Tenant detail → suspend/reactivate/archive |
| J6 | **Respond to an alert** | As-needed | Operations | Alert center → affected tenant/environment |
| J7 | **Check system operations** | Daily | Operations | Operations center → backup/DR → environments |
| J8 | **Handle support escalation** | As-needed | Support | Support console → tenant context → audit trail |
| J9 | **Review billing/entitlements** | Weekly/monthly | Commercial | Billing → usage → tenant entitlement detail |
| J10 | **Review/approve a market or pack draft** | As-needed | Catalogs & Governance | Market management → market detail → approve |
| J11 | **Configure system parameters** | Rare | Platform | System config → feature flags → parameters |
| J12 | **Review audit trail** | As-needed | Platform | Audit trail → filter by event/entity/time |

### 4.2 Job-to-domain mapping

| Job | Primary domain | Secondary domains |
|-----|---------------|-------------------|
| J1 | Home | (all — links out) |
| J2 | Requests & Onboarding | Tenants |
| J3 | Requests & Onboarding | Operations |
| J4 | Tenants | Operations |
| J5 | Tenants | — |
| J6 | Operations | Tenants, Support |
| J7 | Operations | Platform |
| J8 | Support | Tenants, Platform |
| J9 | Commercial | Tenants |
| J10 | Catalogs & Governance | — |
| J11 | Platform | — |
| J12 | Platform | — |

---

## 5. Approved top-level IA — 8 domains

### 5.1 Domain table

| # | Domain | Shell label | Primary operator question | Backing service domains |
|---|--------|------------|--------------------------|------------------------|
| 1 | **Home** | Home | What needs my attention right now? | Cross-cutting: aggregates from all services |
| 2 | **Requests & Onboarding** | Requests & Onboarding | What onboarding requests are pending and what is their status? | Bootstrap & Provisioning Orchestrator |
| 3 | **Tenants** | Tenants | What is the health and status of each tenant? | Tenant Portfolio Service |
| 4 | **Operations** | Operations | Is the platform healthy and are environments running? | Runtime Fleet & Release Service |
| 5 | **Support** | Support | Are there open support cases or incidents? | Support / Incident / Audit Service |
| 6 | **Commercial** | Commercial | What is the billing and usage posture? | Commercial Service |
| 7 | **Catalogs & Governance** | Catalogs & Governance | What markets, packs, and readiness rules are defined? | Composition & Eligibility Service, Governance & Readiness Service |
| 8 | **Platform** | Platform | What is the system-level configuration and audit state? | Governance & Readiness Service, Support / Incident / Audit Service |

### 5.2 Surface assignments per domain

#### Home
| Surface | Surface ID | Data source | Notes |
|---------|-----------|-------------|-------|
| Home | `control-plane.home` | Semi-live (aggregation) | Action center — not a metrics dashboard |

#### Requests & Onboarding
| Surface | Surface ID | Data source | Notes |
|---------|-----------|-------------|-------|
| Bootstrap Requests | `control-plane.tenants.bootstrap` | Hybrid (real-backend → fixture) | Promoted from Tenants group |
| Provisioning Runs | `control-plane.provisioning.runs` | Hybrid (real-backend → fixture) | Promoted from Tenants group |
| Identity & Invitations | `control-plane.identity.invitations` | Static | Onboarding-related identity setup |

#### Tenants
| Surface | Surface ID | Data source | Notes |
|---------|-----------|-------------|-------|
| Tenant Registry | `control-plane.tenants.list` | Hybrid (real-backend → fixture) | |
| Tenant Detail | `control-plane.tenants.detail` | Hybrid (real-backend → fixture) | Operator dossier for a single tenant |

#### Operations
| Surface | Surface ID | Data source | Notes |
|---------|-----------|-------------|-------|
| Operations Center | `control-plane.operations.center` | Semi-live (fixture aggregation) | Renamed from Overview. Fleet health view |
| Alert Center | `control-plane.ops.alerts` | Static | |
| Backup & DR | `control-plane.ops.backup-dr` | Static | |
| Environments & Flags | `control-plane.ops.environments` | Static | |

#### Support
| Surface | Surface ID | Data source | Notes |
|---------|-----------|-------------|-------|
| Support Console | `control-plane.platform.support` | Static | Promoted to top-level domain |

#### Commercial
| Surface | Surface ID | Data source | Notes |
|---------|-----------|-------------|-------|
| Billing & Entitlements | `control-plane.commercial.billing` | Semi-live (fixture) | |
| Usage & Metering | `control-plane.commercial.usage` | Static | |

#### Catalogs & Governance
| Surface | Surface ID | Data source | Notes |
|---------|-----------|-------------|-------|
| Market Management | `control-plane.markets.management` | Contract-backed | Demoted from top-level Markets |
| Market Detail | `control-plane.markets.detail` | Contract-backed | |
| Pack Catalog | `control-plane.packs.catalog` | Contract-backed | |
| Payer Readiness | `control-plane.markets.payer-readiness` | Static | |
| Eligibility Simulator | `control-plane.markets.eligibility-sim` | Static | |

#### Platform
| Surface | Surface ID | Data source | Notes |
|---------|-----------|-------------|-------|
| System Configuration | `control-plane.system.config` | Fixture | |
| Audit Trail | `control-plane.platform.audit` | Static | |
| Templates & Presets | `control-plane.platform.templates` | Static | |
| Runbooks Hub | `control-plane.platform.runbooks` | Static | |

### 5.3 Migration from current 7-group model

| Current group | Surfaces | New domain | Change type |
|--------------|----------|-----------|-------------|
| Overview | Overview | **Home** | Renamed, repurposed from dashboard to action center |
| Tenants | Tenant Registry, Tenant Detail | **Tenants** | Retained (reduced — bootstrap/provisioning removed) |
| Tenants | Bootstrap Wizard, Provisioning Runs, Identity & Invitations | **Requests & Onboarding** | Promoted to own top-level domain |
| Markets & Readiness | Markets, Market Detail, Pack Catalog, Payer Readiness, Eligibility Simulator | **Catalogs & Governance** | Demoted: architecture concepts grouped under governance |
| Operations | Operations Center, Alert Center, Backup & DR, Environments & Flags | **Operations** | Retained (Operations Center moved to domain) |
| Commercial | Billing & Entitlements, Usage & Metering | **Commercial** | Retained |
| Platform | System Config, Support Console, Audit Trail, Templates & Presets, Runbooks Hub | Split: **Support** + **Platform** | Support Console promoted to its own top-level domain |

### 5.4 What changed and why

| Change | Why |
|--------|-----|
| Overview → Home (action center) | Operators need actionable queue, not a metrics overview |
| Bootstrap/Provisioning → Requests & Onboarding | Onboarding is the #1 daily workflow — deserves its own entry point |
| Markets & Readiness → Catalogs & Governance | Pack/market/readiness are governance concerns, not daily operator navigation |
| Support Console → top-level Support domain | Support escalation is a distinct operator job, not a sub-item of Platform |
| Tenants slimmed to registry + detail | Tenant dossier focus: who are the tenants and what is their status? |

---

## 6. Home rules

### 6.1 What appears on Home

| Section | Content | Source |
|---------|---------|--------|
| **Pending Requests** | Count and list of bootstrap requests awaiting review | Bootstrap & Provisioning Orchestrator |
| **Active Provisioning** | Count and list of provisioning runs in progress or failed | Bootstrap & Provisioning Orchestrator |
| **Recent Alerts** | Unresolved alert count and top items | Support / Incident / Audit Service |
| **Tenant Summary** | Total tenants by lifecycle state (active/suspended/draft) | Tenant Portfolio Service |
| **Next Safe Actions** | Contextual action links (e.g., "Review 3 pending requests", "Retry failed provisioning") | Cross-cutting |

### 6.2 What never appears on Home

- Pack readiness scores or capability truth percentages
- Market composition details or eligibility simulation results
- Raw audit event streams
- System configuration parameters
- Architecture diagrams or service-domain maps
- KPIs that are not backed by real data (no fake dashboards)

---

## 7. Page priority model

### P0 — Must-have for operator daily work

| Surface | Domain | Justification |
|---------|--------|--------------|
| Home | Home | Entry point, action queue |
| Bootstrap Requests | Requests & Onboarding | Primary inbound workflow |
| Provisioning Runs | Requests & Onboarding | Provisioning monitoring |
| Tenant Registry | Tenants | Tenant health overview |
| Tenant Detail | Tenants | Single-tenant dossier |

### P1 — Important for weekly/routine operations

| Surface | Domain | Justification |
|---------|--------|--------------|
| Operations Center | Operations | Platform health |
| Alert Center | Operations | Incident response |
| Support Console | Support | Escalation handling |
| Billing & Entitlements | Commercial | Billing review |

### P2 — Specialized or governance workflows

| Surface | Domain | Justification |
|---------|--------|--------------|
| Backup & DR | Operations | Rare but critical |
| Environments & Flags | Operations | Configuration management |
| Identity & Invitations | Requests & Onboarding | Future identity setup |
| Usage & Metering | Commercial | Detailed usage |
| Market Management | Catalogs & Governance | Market authoring |
| Market Detail | Catalogs & Governance | Market review |
| Pack Catalog | Catalogs & Governance | Pack review |
| Payer Readiness | Catalogs & Governance | Market research |
| Eligibility Simulator | Catalogs & Governance | What-if analysis |
| System Configuration | Platform | Rare config changes |
| Audit Trail | Platform | Audit review |
| Templates & Presets | Platform | Template management |
| Runbooks Hub | Platform | Operational guides |

---

## 8. Language and copy rules

### 8.1 Use product language, not architecture language

| Instead of | Say |
|-----------|-----|
| "Bootstrap Request" | "Onboarding Request" (on Home and in navigation) |
| "Provisioning Run" | "Setup Progress" or "Provisioning" (context-dependent) |
| "Legal Market Profile" | "Market" or "Market Profile" |
| "Pack Manifest" | "Module" or "Pack" (context-dependent) |
| "Effective Configuration Plan" | "Tenant Configuration" or "Resolved Configuration" |
| "Composition Engine" | (never user-facing — internal only) |
| "Eligibility Resolution" | "Eligibility Check" or "Pack Eligibility" |
| "Capability Truth" | "Readiness" or "Capability Status" |
| "Claim Gating" | "Readiness Requirements" |
| "Fleet health" | "Platform Health" or "Environment Health" |
| "DFN", "IEN", "RPC" | (never user-facing) |

### 8.2 Copy rules

1. **No raw internal IDs** in user-facing text. Tenant IDs are displayed but labeled "Tenant ID."
2. **No RPC names, VistA file numbers, or MUMPS references** in the operator console.
3. **No TODO, FIXME, or implementation-pending** text visible to the operator.
4. **State labels use human terms:** Active, Suspended, Archived, Draft, Pending Review, In Progress, Completed, Failed, Cancelled.
5. **Source badges are always visible** but use operator-friendly terms: "Live Data", "Fixture Fallback", "Contract Data", "Static Preview."
6. **Empty states explain what would be here** and suggest the next action, not just "No data."

---

## 9. State-display rules

### 9.1 State families (from service-map architecture)

| Family | States | Used by |
|--------|--------|---------|
| Tenant lifecycle | draft, active, suspended, archived | Tenant Registry, Tenant Detail |
| Bootstrap lifecycle | draft, submitted, under-review, approved, rejected | Bootstrap Requests |
| Provisioning lifecycle | queued, in-progress, completed, failed, cancelled, rolling-back | Provisioning Runs |
| Market lifecycle | draft, under-review, active, deprecated | Market Management |
| Pack lifecycle | draft, under-review, published, deprecated, retired | Pack Catalog |
| Alert severity | info, warning, critical | Alert Center |
| Environment health | healthy, degraded, unreachable, maintenance | Operations Center |

### 9.2 Badge color rules

| Color | Used for | Never used for |
|-------|---------|---------------|
| Green | Active, Completed, Healthy, Published | Draft, Pending, Static |
| Yellow/Amber | Pending Review, In Progress, Degraded, Warning | Completed, Active |
| Red | Failed, Suspended, Critical, Unreachable | Draft, Active |
| Gray | Draft, Archived, Static, Deferred, Deprecated | Active, Healthy |
| Blue | Queued, Info, Under Review | Active, Failed |

---

## 10. Source-posture badge rules

### 10.1 Badge types

| Badge | Meaning | Display |
|-------|---------|---------|
| **Live Data** | Data from real PG-backed backend (`_source: "real-backend"`) | Green pill: "Live" |
| **Fixture Fallback** | Backend unreachable, using fixture data (`_source: "fixture-fallback"`) | Amber pill: "Fixture" |
| **Contract Data** | Loaded from contract artifacts at startup | Blue pill: "Contract" |
| **Static Preview** | No data — IA structure only | Gray pill: "Static" |

### 10.2 Rules

1. Source badge appears in the page header of every surface.
2. If a surface has mixed sources (e.g., hybrid read), the badge shows the **actual** source of the last fetch, not the theoretical best case.
3. Source badges are never hidden from the operator. They are part of the honest posture.
4. When backend transitions from reachable to unreachable, the badge updates in the UI without page reload (on next data fetch).

---

## 11. Boundaries

### 11.1 Provider Operator Console (this document's scope)

The 8-domain model defined here. Platform-wide scope. Operator-only audience.

### 11.2 Customer Self-Service Onboarding (separate boundary)

A public-facing surface where prospective customers initiate onboarding.
It shares the Bootstrap & Provisioning Orchestrator service but has a completely
different navigation model (linear wizard), different scope (pre-tenant), and
different audience. It is NOT a tab or sub-surface of the operator console.

### 11.3 Tenant Runtime Plane (separate boundary)

Where tenants operate after provisioning. 7 workspace families (clinical, ancillary,
revenue-cycle, analytics, tenant-admin, IT-integration, content-admin). No overlap
with operator console navigation.

### 11.4 Tenant Operational Admin (inside Tenant Runtime Plane)

A workspace within the tenant runtime plane where tenant administrators manage their
own tenant configuration. It consumes outputs from the control plane (effective plans,
capability posture) but does not call operator-level APIs. Not part of the operator console.

---

## 12. Governance

### 12.1 This document is registered in source-of-truth-index

See `docs/reference/source-of-truth-index.md`.

### 12.2 Supersession

This document supersedes the 5-group model in IA v2 and page-specs v2, and the 7-group
model in design-contract v2, for the purpose of top-level navigation. Per-surface field
specifications in those documents remain valid unless explicitly contradicted here.

### 12.3 Future extensions

Adding a new top-level domain requires an ADR. Adding surfaces within existing domains
follows the governed-build-protocol (one slice at a time, verify before proceeding).
