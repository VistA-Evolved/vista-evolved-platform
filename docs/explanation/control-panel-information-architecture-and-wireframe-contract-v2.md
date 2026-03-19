# Control Panel Information Architecture and Wireframe Contract v2

> **Status:** Canonical architecture specification.
> **Date:** 2026-03-20.
> **Type:** Explanation — surface-to-service binding, IA model, and wireframe contract.
> **Scope:** Defines how the provider operator console, customer self-service onboarding
> surface, and tenant-admin workspace map to underlying control-plane services.
> Establishes the information architecture (navigation, layout, data flow) for each
> surface type without prescribing visual design.
> **Governed by:** AGENTS.md, control-plane-service-map-and-operator-console-architecture.md,
> information-architecture-workspace-map.md.
> **Supersedes:** This document replaces the earlier `control-panel-design-contract.md`
> layout model where it conflicts. The design contract remains valid for individual
> surface field-level specifications; this document provides the authoritative IA model.

---

## 1. Three distinct surface categories

The control-plane architecture defines three surface categories, each with different
audiences, navigation models, data scopes, and trust boundaries.

| Category | Audience | Scope | Trust level | Navigation model |
|----------|---------|-------|-------------|-----------------|
| **Provider operator console** | Platform operators only | Platform-wide — all tenants, all markets, all infrastructure | Full platform authority (subject to RBAC) | Single workspace with 7+ surfaces |
| **Customer self-service onboarding** | Prospective tenant admins and onboarding contacts | Own onboarding request only — no cross-tenant visibility | Constrained: pre-tenant, no platform authority | Linear wizard (4 steps) |
| **Tenant-admin workspace** | Tenant administrators | Own tenant only — no cross-tenant visibility | Tenant-scoped authority (subject to RBAC) | Part of the 7-workspace-family runtime plane |

### 1.1 These are not the same application

A provider operator console shows all tenants globally. A self-service onboarding
surface shows zero tenants (it creates one). A tenant-admin workspace shows exactly
one tenant. Sharing navigation or data models between them is an error.

---

## 2. Provider operator console — information architecture

### 2.1 Navigation structure

The operator console uses a single-level primary navigation. Each navigation item
corresponds to a service domain from the service map (§2 of the service-map doc).
Items are grouped by operational concern, not by technical domain.

```
┌─────────────────────────────────────────────────────────┐
│  Provider Operator Console                               │
├──────────┬──────────┬──────────┬──────────┬─────────────┤
│ Tenants  │ Markets  │  Fleet   │ Commerce │  Platform   │
└──────────┴──────────┴──────────┴──────────┴─────────────┘
```

| Nav item | Surfaces | Primary backing service | Secondary services |
|----------|----------|------------------------|-------------------|
| **Tenants** | Tenant Registry, Tenant Detail, Tenant Bootstrap, Provisioning Runs | Tenant Portfolio, Bootstrap Orchestrator | Composition, Fleet, Commercial, Support |
| **Markets** | Market Management, Market Detail, Pack Catalog | Composition & Eligibility | Governance (readiness, launch tiers) |
| **Fleet** | Fleet Overview, Environment Detail, Release Channels | Runtime Fleet & Release | Tenant Portfolio (binding), Governance (health gates) |
| **Commerce** | Subscription Overview, Billing Accounts, Usage Dashboard | Commercial | Tenant Portfolio (tenant binding) |
| **Platform** | System Config, Governance Dashboard, Audit Trail, Support Cases | Governance, Support/Incident/Audit | All services (feature flags, audit events) |

### 2.2 Surface hierarchy

Within each navigation item, surfaces follow a list → detail → action hierarchy:

```
Level 1: List view (e.g., Tenant Registry — all tenants)
  └─ Level 2: Detail view (e.g., Tenant Detail — single tenant)
       └─ Level 3: Action context (e.g., Bootstrap form, Provisioning run view)
```

**Breadcrumb rule:** Every surface at Level 2+ displays a breadcrumb trail back to its
Level 1 parent. No dead ends.

### 2.3 Surface-to-service data flow

Each surface on the operator console:

1. **Reads from** one or more service APIs (query aggregation).
2. **Writes to** exactly one service API per action (command ownership).
3. **Never writes to multiple services in a single user action.** Multi-service
   writes are orchestrated by the backend (saga pattern), not by the frontend.

Example — Tenant Detail surface:

```
┌─────────────────────────────────────────────────────────┐
│ Tenant Detail: tnt-abc123                                │
├─────────────────────────────────────────────────────────┤
│ Lifecycle: active          │ Subscription: active        │
│ Market: PH                 │ Billing: current            │
│ Legal Entity: LE Corp      │ Environment: env-xyz        │
│ Effective Plan: v3         │ Release Channel: stable     │
├─────────────────────────────────────────────────────────┤
│ Data sources:                                            │
│   Tenant Portfolio → lifecycle, market, legal entity     │
│   Composition      → effective plan summary              │
│   Commercial       → subscription, billing status        │
│   Fleet            → environment, release channel        │
│   Support          → open case count                     │
├─────────────────────────────────────────────────────────┤
│ Actions (each writes to ONE service):                    │
│   [Suspend Tenant]     → Tenant Portfolio                │
│   [View Plan Detail]   → navigates to Composition view   │
│   [View Environment]   → navigates to Fleet detail       │
│   [Create Support Case]→ Support/Incident/Audit          │
└─────────────────────────────────────────────────────────┘
```

### 2.4 Existing surface alignment

The 8 surfaces currently defined in the screen inventory map to the operator console
navigation as follows:

| Existing surface ID | Existing surface name | Operator console nav item | Service binding |
|----|------|-------|---------|
| `control-plane.tenants.list` | Tenant Registry | Tenants | Tenant Portfolio (primary) |
| `control-plane.tenants.detail` | Tenant Detail | Tenants | Tenant Portfolio + cross-service |
| `control-plane.tenants.bootstrap` | Tenant Bootstrap | Tenants | Bootstrap Orchestrator (primary) |
| `control-plane.provisioning.runs` | Provisioning Runs | Tenants | Bootstrap Orchestrator (primary) |
| `control-plane.markets.management` | Market Management | Markets | Composition (primary) |
| `control-plane.markets.detail` | Market Detail | Markets | Composition + Governance |
| `control-plane.packs.catalog` | Pack Catalog | Markets | Composition + Governance |
| `control-plane.system.config` | System Config | Platform | Governance (primary) |

These surface IDs remain unchanged. The operator console navigation is a grouping
layer on top of the existing surface model, not a replacement.

### 2.5 Candidate new surfaces (not yet in screen inventory)

The service-map architecture implies surfaces that do not yet appear in the screen
inventory. These are candidates — they are NOT authorized for implementation by this
document. They require screen-contract authoring and screen-inventory registration.

| Candidate surface ID | Nav item | Backing service | Why needed |
|---------------------|----------|----------------|-----------|
| `control-plane.fleet.overview` | Fleet | Fleet & Release | No fleet-level view exists today |
| `control-plane.fleet.environment-detail` | Fleet | Fleet & Release | Per-environment deep view |
| `control-plane.fleet.release-channels` | Fleet | Fleet & Release | Release channel management |
| `control-plane.commerce.subscriptions` | Commerce | Commercial | No commercial view exists today |
| `control-plane.commerce.billing` | Commerce | Commercial | Billing account management |
| `control-plane.platform.governance` | Platform | Governance | Readiness dashboard |
| `control-plane.platform.audit` | Platform | Support/Incident/Audit | Platform audit trail viewer |
| `control-plane.platform.support` | Platform | Support/Incident/Audit | Support case management |

---

## 3. Customer self-service onboarding — information architecture

### 3.1 Navigation structure: linear wizard

Self-service onboarding is NOT a free-navigation workspace. It is a guided linear
flow with 4 steps:

```
Step 1: Market Selection
  │
  ▼
Step 2: Pack Eligibility Review
  │
  ▼
Step 3: Organization & Contact Information
  │
  ▼
Step 4: Review & Submit
  │
  ▼
Confirmation: Request Submitted → Status Tracker
```

**Back navigation:** Users can go back to any previous step. Going back does not
discard entered data (form state is preserved in local session, not on server).

**No side navigation.** There is no dashboard, no menu, no access to platform-wide data.

### 3.2 Step-to-service mapping

| Step | What the user sees | Service called | API scope constraints |
|------|-------------------|---------------|---------------------|
| 1. Market Selection | List of available legal markets (T2+ only) | Composition (read) | Only markets at T2 or T3 launch tier returned. No T0/T1 markets. |
| 2. Pack Review | Eligible packs for selected market. Mandated shown as locked. Default-on shown as pre-selected. Optional shown as selectable. | Composition (read) | Only packs in the selected market's profile. No cross-market data. |
| 3. Org Info | Form: organization name, legal entity, primary contact, facility details | None (local form only) | Validated client-side. Server validation at submission. |
| 4. Review & Submit | Summary of all selections. Submit button. | Bootstrap Orchestrator (write) | Creates bootstrap draft → submits as request. Single API call. |
| Tracker | Status of submitted request (submitted → approved/rejected → provisioning status) | Bootstrap Orchestrator (read) | Own request only. No other requests visible. |

### 3.3 Security boundary

The self-service surface operates without a tenant context (the tenant does not exist
yet). Authentication is via email-verified invite link or public registration
(configurable per market launch tier). The API gate enforces:

1. No platform-wide list operations
2. No tenant-scoped operations (no tenant exists)
3. No write operations except bootstrap draft creation and submission
4. No administrative operations
5. Read operations return only data relevant to the selected market

---

## 4. Tenant-admin workspace — reference architecture

The tenant-admin workspace is part of the **tenant runtime plane**, not the control
plane. This section provides the interface boundary between the two.

### 4.1 What tenant-admin sees from the control plane

| Data visible | Source service | How delivered |
|-------------|---------------|-------------|
| Effective configuration plan (which packs are active) | Composition | Read-only. Tenant-admin cannot modify mandated packs. |
| Capability readiness flags (which features are available) | Governance | Read-only. Drives surface visibility in tenant workspaces. |
| Subscription status | Commercial | Read-only. Tenant-admin sees current plan, usage, renewal date. |
| Support case status (own tenant) | Support/Incident/Audit | Read/write for own cases only. |

### 4.2 What tenant-admin can request from the control plane

| Action | Target service | Constraint |
|--------|---------------|-----------|
| Toggle optional pack (on/off) | Composition | Only non-mandated packs. Triggers plan re-resolution. |
| Request pack activation (where approval required) | Composition → Governance | Enters governance review queue. Not instant. |
| Create support case | Support/Incident/Audit | Own tenant only. |
| Invite users to tenant | Tenant Portfolio (identity binding) | Own tenant only. |
| View provisioning history | Bootstrap Orchestrator (read) | Own tenant's runs only. |

### 4.3 What tenant-admin CANNOT do

1. List or access other tenants
2. Modify market-mandated packs
3. Change the tenant's legal market
4. Modify platform-wide configuration
5. Access infrastructure details (environments, fleet)
6. View platform-level audit trail
7. Manage billing (that is legal-entity admin or operator scope)

### 4.4 Navigation cross-boundary

From the workspace map (`information-architecture-workspace-map.md` §T5), tenant-admin
workspace transitions:

- **Inbound:** User navigates from clinical/ancillary workspace → tenant-admin settings
- **Outbound:** User navigates from tenant-admin → back to their clinical/ancillary workspace
- **No outbound to operator console.** Tenant-admin cannot navigate to operator surfaces.
- **No outbound to self-service onboarding.** Onboarding is complete; the onboarding surface is not accessible from inside the tenant.

---

## 5. Wireframe contract rules

### 5.1 What a wireframe contract specifies

A wireframe contract (screen contract) for a control-plane surface must include:

| Field | Description | Example |
|-------|------------|---------|
| `surfaceId` | Unique identifier from screen inventory | `control-plane.tenants.list` |
| `backingService` | Primary service domain | `tenant-portfolio` |
| `dataQueries` | Read operations performed on surface load | `[listTenants, getSubscriptionSummaries]` |
| `actions` | Available write operations, each with target service | `[{action: suspendTenant, service: tenant-portfolio}]` |
| `navigationIn` | How users arrive at this surface | `[nav-item: Tenants, breadcrumb: Tenant Registry]` |
| `navigationOut` | Where users can navigate from this surface | `[tenant-detail: via row click, bootstrap: via action button]` |
| `roleGate` | Which roles can access this surface | `[platform-operator]` |
| `packDependencies` | Pack activation conditions for surface visibility | (none for operator surfaces — always visible) |

### 5.2 What a wireframe contract does NOT specify

1. Visual design (colors, typography, spacing)
2. Component library choice
3. Client-side state management approach
4. Error handling UI patterns (governed by shared UX standards, not per-surface)
5. Responsive breakpoints

### 5.3 Contract authoring process

New surfaces follow this process:

1. Define the surface in this document or the service-map doc (architecture scope)
2. Register the surface ID in `docs/reference/screen-inventory.md`
3. Author a screen-contract JSON in `packages/contracts/screen-contracts/`
4. Wire the surface into the navigation model
5. Implementation (deferred — this is docs-only)

---

## 6. Operator console vs tenant-admin: disambiguation guide

| Question | Operator console answer | Tenant-admin answer |
|---------|------------------------|-------------------|
| Who uses it? | Platform operators | Tenant administrators |
| How many tenants visible? | All | One (own tenant) |
| Can it create tenants? | Yes (via bootstrap) | No |
| Can it modify market profiles? | Yes | No |
| Can it manage infrastructure? | Yes (fleet, environments) | No |
| Can it manage billing? | Yes (subscriptions, accounts) | Read-only (own subscription) |
| Can it manage packs? | Yes (full catalog, any tenant) | Toggle optional packs for own tenant |
| Can it manage users? | Platform-wide user management | Invite/revoke within own tenant |
| Where does it live? | Standalone workspace (control-plane family) | Within the tenant's workspace family set |
| What control-plane services does it call? | All 7 | Subset: Composition (read/toggle), Support (own cases), Tenant Portfolio (invitations) |

---

## 7. Surface data-loading patterns

### 7.1 List surfaces

All list surfaces in the operator console follow a consistent data-loading pattern:

```
1. Surface mounts
2. Call primary service list API with pagination params
3. Optionally call secondary service APIs for summary badges
4. Render table with row-level actions
5. Row click → navigate to detail surface
```

### 7.2 Detail surfaces

Detail surfaces aggregate data from multiple services:

```
1. Surface mounts with entity ID from route params
2. Call primary service detail API
3. In parallel: call secondary service APIs for related data
4. Render composite view with labeled data sections
5. Action buttons → call owning service command API (single service per action)
```

### 7.3 Form/wizard surfaces

Form surfaces (bootstrap, market profile editing) follow:

```
1. Surface mounts (new or existing entity)
2. If existing: load current state from owning service
3. User fills fields (client-side validation)
4. Submit → single API call to owning service
5. Server-side validation → success or error response
6. On success: navigate to confirmation or detail surface
```

### 7.4 No multi-service writes from the frontend

This is a critical architectural rule. If a user action requires changes in multiple
services (e.g., approve bootstrap request → create tenant + resolve plan + allocate
environment), the frontend calls **one** API endpoint on the orchestrating service, and
the backend saga handles the multi-service coordination. The frontend never calls
multiple write APIs in sequence.

---

## 8. Implementation status and current `apps/control-plane/`

### 8.1 Current state

`apps/control-plane/` is a **local review runtime** (Fastify dev server, not a
production backend). It currently:

- Serves 13 read routes: 6 contract-backed (reading JSON files from `packages/contracts/`),
  7 fixture-backed (reading from `fixtures/`)
- Serves 15 review-only write simulation routes (log intent + return draft response,
  no persistent mutation)
- Hosts 8 surfaces corresponding to the operator console surfaces listed in §2.4
- Runs the composition engine (`lib/plan-resolver.mjs`) as a local library
- Performs drift audit (comparing resolved plans against stored plans)
- Performs pack integrity audit

### 8.2 What this document means for `apps/control-plane/`

This document does NOT change the current behavior of `apps/control-plane/`. It adds:

1. **Service-domain labels** on existing routes and surfaces (documentation only)
2. **Architectural context** for why the surfaces are organized as they are
3. **Future guidance** for when the local review runtime evolves into a production
   backend (or is replaced by one)

### 8.3 Migration path (deferred — not this document's scope)

When the platform moves from local review to production backend:

1. Service domains become distinct Fastify plugins or microservices
2. Contract JSON files become seed data for PostgreSQL tables
3. Review-only write simulations become real commands with PG persistence
4. The composition engine library becomes the Composition service's core
5. Event emission replaces fire-and-forget simulation
6. The local review runtime may persist as a dev/staging tool

This migration is a future wave. This document establishes the target architecture;
it does not implement it.

---

## 9. Out of scope

This document does NOT:

1. Prescribe visual design for any surface
2. Author screen-contract JSON instances
3. Define API request/response schemas (OpenAPI)
4. Define event schemas (AsyncAPI)
5. Implement any surface, route, or database table
6. Change existing `apps/control-plane/` behavior
7. Define the tenant-admin workspace internal IA (that is info-arch-workspace-map territory)
8. Make decisions about frontend framework or component library
