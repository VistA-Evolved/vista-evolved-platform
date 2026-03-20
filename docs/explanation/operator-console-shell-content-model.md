# Operator Console Shell Content Model

> **Status:** Canonical — per-surface content-slot bindings for the 8-domain shell.
> **Date:** 2026-03-20.
> **Type:** Explanation — content-slot registry, region-to-field binding, surface-level data contracts.
>
> **Upstream inputs:**
> - `operator-console-design-contract-v3.md` — shell anatomy, region rules, badge systems
> - `operator-console-ux-ia-reset-and-journey-pack.md` — 8-domain model, surface assignments
> - `operator-console-page-priority-and-content-model.md` — P0/P1/P2 tiers, per-domain content
> - `control-panel-page-specs-v2.md` — surface-level field specs (field source of truth)
> - `control-panel-action-semantics-v2.md` — action matrix per surface
> - `control-plane-service-map-and-operator-console-architecture.md` — service binding
>
> **Downstream consumers:**
> - Shell implementation (`apps/control-plane/public/app.js` — render functions)
> - QA reviewers — verify every content slot is populated or honestly empty
> - Design hand-off — Figma Make / Stitch mapping

---

## 1. What This Document Defines

For each surface in the operator console, this document specifies:

1. **Domain assignment** — which of the 8 nav domains this surface belongs to.
2. **Priority tier** — P0 (daily), P1 (weekly), P2 (rare).
3. **Layout type** — which shell region pattern applies (card grid, list+filter, detail+context).
4. **Content slots** — named regions within the surface, what data fills each, and its source.
5. **Actions** — what the operator can do, with posture badge.
6. **Drill targets** — where links go (same-domain or cross-domain).

This does **not** redefine shell anatomy or badge rules — those live in design-contract-v3.

---

## 2. Surface Inventory (22 Surfaces)

| # | Surface | ID | Domain | Tier | Layout |
|---|---------|-----|--------|------|--------|
| 1 | Home | `control-plane.home` | Home | P0 | Card grid |
| 2 | Bootstrap Requests | `control-plane.tenants.bootstrap` | Requests & Onboarding | P0 | List + filter |
| 3 | Provisioning Runs | `control-plane.provisioning.runs` | Requests & Onboarding | P0 | List + filter |
| 4 | Identity & Invitations | `control-plane.identity.invitations` | Requests & Onboarding | P2 | List + filter |
| 5 | Tenant Registry | `control-plane.tenants.list` | Tenants | P0 | List + filter |
| 6 | Tenant Detail | `control-plane.tenants.detail` | Tenants | P0 | Detail + context |
| 7 | Operations Center | `control-plane.operations.center` | Operations | P1 | Card grid |
| 8 | Alert Center | `control-plane.ops.alerts` | Operations | P1 | List + filter |
| 9 | Backup & DR | `control-plane.ops.backup-dr` | Operations | P2 | Detail + context |
| 10 | Environments & Flags | `control-plane.ops.environments` | Operations | P2 | List + filter |
| 11 | Support Console | `control-plane.platform.support` | Support | P1 | List + filter |
| 12 | Billing & Entitlements | `control-plane.commercial.billing` | Commercial | P1 | List + filter |
| 13 | Usage & Metering | `control-plane.commercial.usage` | Commercial | P2 | List + filter |
| 14 | Market Management | `control-plane.markets.management` | Catalogs & Governance | P2 | List + filter |
| 15 | Market Detail | `control-plane.markets.detail` | Catalogs & Governance | P2 | Detail + context |
| 16 | Pack Catalog | `control-plane.packs.catalog` | Catalogs & Governance | P2 | List + filter |
| 17 | Payer Readiness | `control-plane.markets.payer-readiness` | Catalogs & Governance | P2 | List + filter |
| 18 | Eligibility Simulator | `control-plane.markets.eligibility-sim` | Catalogs & Governance | P2 | Form + result |
| 19 | System Configuration | `control-plane.system.config` | Platform | P2 | List + filter |
| 20 | Audit Trail | `control-plane.platform.audit` | Platform | P2 | List + filter |
| 21 | Templates & Presets | `control-plane.platform.templates` | Platform | P2 | List + filter |
| 22 | Runbooks Hub | `control-plane.platform.runbooks` | Platform | P2 | List + search |

---

## 3. Per-Surface Content Slots

### 3.1 Home

| Slot | Content | Source | Drill target |
|------|---------|--------|-------------|
| Card: Pending Requests | Count of bootstrap requests in pending/submitted/under-review state | Bootstrap API or fixture | `#bootstrap` (Requests & Onboarding) |
| Card: Active Provisioning | Count of provisioning runs in queued/in-progress/failed state | Provisioning API or fixture | `#provisioning` (Requests & Onboarding) |
| Card: Recent Alerts | Count of unresolved alerts + top severity | Alert source (static until wired) | `#alerts` (Operations) |
| Card: Tenant Summary | Count of tenants by lifecycle state (active / suspended / draft) | Tenant API or fixture | `#tenants` (Tenants) |
| Card: Next Actions | Computed list of contextual action links | Aggregation of above cards | Various domain surfaces |

**Page header:**
- Title: "Home"
- Subtitle: "What needs my attention right now?"
- Source badge: Per-card (not page-level)

**Actions:** None — Home is read + navigate only.

---

### 3.2 Bootstrap Requests

| Slot | Content | Source | Notes |
|------|---------|--------|-------|
| Filter rail | Status: pending, submitted, under-review, approved, rejected, all | — | |
| Table: Request ID | Request identifier | API / fixture | |
| Table: Tenant Name | Proposed tenant name | API / fixture | |
| Table: Market | Target market | API / fixture | |
| Table: Status | Lifecycle badge (bootstrap lifecycle family) | API / fixture | |
| Table: Submitted | Date submitted (ISO 8601) | API / fixture | |
| Table: Requested By | Actor name | API / fixture | |
| Detail drill | Click row → Request detail view | — | Inline expansion or sub-route |

**Page header:**
- Title: "Onboarding Requests"
- Subtitle: "What onboarding requests are pending and what is their status?"
- Source badge: Surface-level (Live / Fixture / Static)

**Actions (on detail):**
- Approve → `review-only`
- Reject with reason → `review-only`
- Cancel → `review-only`
- View resulting provisioning run → navigation (to Provisioning Runs)

---

### 3.3 Provisioning Runs

| Slot | Content | Source | Notes |
|------|---------|--------|-------|
| Filter rail | Status: queued, in-progress, completed, failed, cancelled, rolling-back, all | — | |
| Table: Run ID | Run identifier | API / fixture | |
| Table: Tenant Name | Target tenant | API / fixture | |
| Table: Status | Lifecycle badge (provisioning lifecycle family) | API / fixture | |
| Table: Started | Start timestamp | API / fixture | |
| Table: Steps | Step progress (e.g., "3/7") | API / fixture | |
| Detail drill | Click row → Step detail view | — | Shows step-by-step progress |

**Page header:**
- Title: "Provisioning Runs"
- Subtitle: "What is the status of each provisioning run?"
- Source badge: Surface-level

**Actions (on detail):**
- Retry failed step → `review-only`
- Cancel run → `review-only`
- Rollback → `review-only`
- View resulting tenant → navigation (to Tenant Detail)

---

### 3.4 Identity & Invitations

| Slot | Content | Source | Notes |
|------|---------|--------|-------|
| Filter rail | Tenant filter, Status: invited, accepted, active, revoked, expired | — | |
| Table: Active Identities | Identity list (name, email, role, tenant, status) | Static | |
| Table: Pending Invitations | Invitation list (email, role, tenant, expires, status) | Static | |

**Page header:**
- Title: "Identity & Invitations"
- Subtitle: "Who has been invited and what is their access status?"
- Source badge: Static

**Actions:**
- Invite user → `integration-pending`
- Revoke access → `integration-pending`
- Resend invitation → `integration-pending`

---

### 3.5 Tenant Registry

| Slot | Content | Source | Notes |
|------|---------|--------|-------|
| Filter rail | Status: draft, active, suspended, archived, all. Market filter. Search. | — | |
| Table: Tenant ID | Tenant identifier (labeled) | API / fixture | |
| Table: Tenant Name | Display name | API / fixture | |
| Table: Status | Lifecycle badge (tenant lifecycle family) | API / fixture | |
| Table: Market | Assigned market | API / fixture | |
| Table: Created | Creation date | API / fixture | |
| Table: Environment | Bound environment name | API / fixture | |
| Row click | → Tenant Detail | — | |

**Page header:**
- Title: "Tenant Registry"
- Subtitle: "What is the health and status of each tenant?"
- Source badge: Surface-level

**Actions:** None on list — all actions on Tenant Detail.

---

### 3.6 Tenant Detail

| Slot | Content | Source | Notes |
|------|---------|--------|-------|
| Context rail: Identity | Tenant ID, name, legal entity, market | API / fixture | |
| Context rail: Status | Tenant lifecycle badge | API / fixture | |
| Context rail: Actions | Suspend, Reactivate, Archive | Posture-badged | |
| Context rail: Navigation | ← Tenant Registry, → Provisioning history, → Environment, → Billing, → Support cases | — | Cross-domain links labeled |
| Primary: Config summary | Pack configuration, effective plan summary | API / fixture | |
| Primary: Recent events | Timeline of lifecycle events | API / fixture | |
| Primary: Environment binding | Environment name, health, version | API / fixture | |

**Page header:**
- Title: "Tenant Detail — {Tenant Name}"
- Subtitle: "What is the full profile and history of this tenant?"
- Source badge: Surface-level

**Actions:**
- Suspend → `review-only` (if active)
- Reactivate → `review-only` (if suspended)
- Archive → `review-only` (confirmation required — terminal action)

---

### 3.7 Operations Center

| Slot | Content | Source | Notes |
|------|---------|--------|-------|
| Card: Environment Health | Per-environment health card (name, status badge, tenant count) | Static | |
| Card: Alert Summary | Severity breakdown (critical / warning / info) | Static | |
| Card: Provisioning Health | Active and failed provisioning counts | API / fixture | |
| Card: Backup Status | Last backup timestamp, DR posture summary | Static | |

**Page header:**
- Title: "Operations Center"
- Subtitle: "Is the platform healthy and are environments running?"
- Source badge: Per-card

**Actions:** None — Ops Center is read + navigate only.
**Drill targets:** Environment detail (→ Environments & Flags), Alert list (→ Alert Center), Backup detail (→ Backup & DR).

---

### 3.8 Alert Center

| Slot | Content | Source | Notes |
|------|---------|--------|-------|
| Filter rail | Severity: critical, high, medium, low. Status: active, acknowledged, resolved. Category filter. Date range. | — | |
| Table: Alert ID | Alert identifier | Static | |
| Table: Severity | Severity badge (alert severity family) | Static | |
| Table: Message | Alert message text | Static | |
| Table: Entity | Affected entity (tenant, environment) | Static | |
| Table: Timestamp | When alert was raised | Static | |
| Table: Status | Active / Acknowledged / Resolved | Static | |
| Detail drill | Click row → Alert detail | — | |

**Page header:**
- Title: "Alert Center"
- Subtitle: "Are there active alerts requiring attention?"
- Source badge: Static

**Actions (on detail):**
- Acknowledge → `integration-pending`
- Resolve → `integration-pending`
- Escalate to case → navigation (→ Support Console) with alert context

---

### 3.9 Backup & DR

| Slot | Content | Source | Notes |
|------|---------|--------|-------|
| Context rail: DR Posture | RPO value, RTO value | Static | |
| Context rail: Actions | Initiate backup, Test restore | `integration-pending` | |
| Primary: Schedule | Backup schedule table (type, frequency, next run) | Static | |
| Primary: History | Backup history table (timestamp, type, status, size) | Static | |

**Page header:**
- Title: "Backup & DR"
- Subtitle: "What is the backup and disaster-recovery posture?"
- Source badge: Static

---

### 3.10 Environments & Flags

| Slot | Content | Source | Notes |
|------|---------|--------|-------|
| Filter rail | Type: environment, feature-flag, release-channel | — | |
| Table: Environments | Name, health badge, tenant binding, version | Static | |
| Table: Feature Flags | Key, state (on/off), scope | Static | |
| Table: Release Channels | Channel name, rollout %, version | Static | |

**Page header:**
- Title: "Environments & Feature Flags"
- Subtitle: "What environments exist and what flags are active?"
- Source badge: Static

**Actions:**
- Toggle feature flag → `review-only`

---

### 3.11 Support Console

| Slot | Content | Source | Notes |
|------|---------|--------|-------|
| Filter rail | Status: open, in-progress, escalated, resolved. Priority: critical, high, medium, low. Category. Assignee. Search. | — | |
| Table: Case ID | Case identifier | Static | |
| Table: Tenant | Associated tenant | Static | |
| Table: Priority | Priority badge | Static | |
| Table: Status | Status badge (case status family) | Static | |
| Table: Assigned | Assigned operator | Static | |
| Table: Last Update | Timestamp | Static | |
| Detail drill | Click row → Case detail | — | |

**Page header:**
- Title: "Support Console"
- Subtitle: "Are there open support cases or incidents?"
- Source badge: Static

**Actions (on detail):**
- Assign → `integration-pending`
- Escalate → `integration-pending`
- Resolve (requires notes) → `integration-pending`
- View tenant detail → navigation (→ Tenants)
- View audit trail → navigation (→ Platform)

---

### 3.12 Billing & Entitlements

| Slot | Content | Source | Notes |
|------|---------|--------|-------|
| Filter rail | Status: current, past-due, suspended, grace-period. Search. | — | |
| Table: Tenant | Tenant name | Semi-live fixture | |
| Table: Plan | Subscription plan name | Semi-live fixture | |
| Table: Status | Status badge (current=green, past-due=red, suspended=gray, grace-period=amber) | Semi-live fixture | |
| Table: Balance | Formatted with currency | Semi-live fixture | |
| Table: Next Due | Date with urgency indicator | Semi-live fixture | |
| Detail drill | Click row → Per-tenant billing detail | — | |

**Page header:**
- Title: "Billing & Entitlements"
- Subtitle: "What is the billing and usage posture?"
- Source badge: Surface-level

**Actions (on detail):**
- Generate invoice → `integration-pending`
- Adjust entitlement → `integration-pending`

---

### 3.13 Usage & Metering

| Slot | Content | Source | Notes |
|------|---------|--------|-------|
| Filter rail | Tenant filter. Metric filter. Period filter. | — | |
| Table: Tenant | Tenant name | Static | |
| Table: Metric | Metric name | Static | |
| Table: Period | Reporting period | Static | |
| Table: Value | Usage value with progress bar | Static | |
| Table: Limit | Entitlement limit | Static | |
| Table: Overage | Overage flag (visible when > limit) | Static | |
| Detail drill | Click row → Time-series chart (design placeholder) | — | |

**Page header:**
- Title: "Usage & Metering"
- Subtitle: "How much are tenants using and are there overages?"
- Source badge: Static

**Actions:**
- Export → `integration-pending`

---

### 3.14 Market Management

| Slot | Content | Source | Notes |
|------|---------|--------|-------|
| Filter rail | Status: draft, under-review, active, deprecated. Country filter. Search. | — | |
| Table: Market Name | Market display name | Contract-backed | |
| Table: Country | ISO country code / name | Contract-backed | |
| Table: Status | Lifecycle badge (market lifecycle family) | Contract-backed | |
| Table: Launch Tier | Launch tier indicator | Contract-backed | |
| Row click | → Market Detail | — | |

**Page header:**
- Title: "Market Management"
- Subtitle: "What markets are defined and what is their readiness?"
- Source badge: Surface-level (Contract)

**Actions:**
- Create market draft → `review-only`
- Submit for review → `review-only`

---

### 3.15 Market Detail

| Slot | Content | Source | Notes |
|------|---------|--------|-------|
| Context rail: Identity | Market ID, name, country, status badge | Contract-backed | |
| Context rail: Actions | Approve, Deprecate | review-only | |
| Context rail: Navigation | ← Market Management, → Pack Catalog, → Payer Readiness, → Eligibility Simulator | — | |
| Primary: Mandated packs | Table: packs mandated for this market | Contract-backed | |
| Primary: Default packs | Table: default packs | Contract-backed | |
| Primary: Eligible packs | Table: eligible packs | Contract-backed | |
| Primary: Readiness dimensions | Per-dimension readiness badges (9-state) | Contract-backed | |

**Page header:**
- Title: "Market Detail — {Market Name}"
- Subtitle: "What is the full profile and readiness of this market?"
- Source badge: Surface-level (Contract)

---

### 3.16 Pack Catalog

| Slot | Content | Source | Notes |
|------|---------|--------|-------|
| Filter rail | Status: draft, under-review, published, deprecated, retired. Family filter. Search. | — | |
| Table: Pack Name | Pack display name | Contract-backed | |
| Table: Family | Pack family (clinical, billing, scheduling, etc.) | Contract-backed | |
| Table: Status | Lifecycle badge (pack lifecycle family) | Contract-backed | |
| Table: Version | Semantic version | Contract-backed | |
| Detail drill | Click row → Pack detail (inline expansion) | — | |

**Page header:**
- Title: "Pack Catalog"
- Subtitle: "What packs are available and what is their lifecycle status?"
- Source badge: Surface-level (Contract)

**Actions:**
- Create pack draft → `review-only`
- Submit for review → `review-only`

---

### 3.17 Payer Readiness

| Slot | Content | Source | Notes |
|------|---------|--------|-------|
| Filter rail | Market selector dropdown. Search. | — | |
| Table: Payer Name | Payer display name | Static | |
| Table: Per-dimension readiness | Readiness badge per dimension (9-state) | Static | |
| Table: Connectivity | Integration state | Static | |
| Summary | Aggregate readiness computed from visible rows | Static | |

**Page header:**
- Title: "Payer Readiness"
- Subtitle: "What is the readiness status of payers in each market?"
- Source badge: Static

**Actions:** None — read-only surface.

---

### 3.18 Eligibility Simulator

| Slot | Content | Source | Notes |
|------|---------|--------|-------|
| Form: Market selector | Dropdown from contract-backed list | Contract-backed | |
| Form: Pack toggles | Multi-select from pack catalog | Contract-backed | |
| Form: Tenant inputs | Optional tenant context fields | Manual input | |
| Result: Resolution | Effective-tenant-configuration-plan schema output | Computed | |
| Result: Deferred items | Items deferred with reason and migration path | Computed | |
| Result: Readiness badges | Per-item readiness (9-state) | Computed | |

**Page header:**
- Title: "Eligibility Simulator"
- Subtitle: "What would the resolved configuration be for a given market and pack selection?"
- Source badge: Surface-level (shows after simulation runs)

**Actions:**
- Run simulation → client-side (no API, uses contract data)
- Compare → side-by-side view of two simulation results

---

### 3.19 System Configuration

| Slot | Content | Source | Notes |
|------|---------|--------|-------|
| Filter rail | Category filter. Search. | — | |
| Table: Parameter Key | Configuration key | Fixture | |
| Table: Current Value | Value display | Fixture | |
| Table: Category | Grouping category | Fixture | |
| Table: Last Changed | Timestamp | Fixture | |
| Detail drill | Click row → Parameter detail (inline edit) | — | |

**Page header:**
- Title: "System Configuration"
- Subtitle: "What are the current system-level configuration parameters?"
- Source badge: Fixture

**Actions:**
- Update parameter → `review-only`

---

### 3.20 Audit Trail

| Slot | Content | Source | Notes |
|------|---------|--------|-------|
| Filter rail | Date range (ISO 8601). Actor filter. Action filter. Entity filter. Search. | — | |
| Table: Timestamp | Event timestamp | Static | |
| Table: Actor | Who performed the action | Static | |
| Table: Action | What was done | Static | |
| Table: Entity | Affected entity (type + ID) | Static | |
| Table: Detail | Event detail (expandable) | Static | |
| Chain verification | Integrity badge (hash-chain status) | Static | |

**Page header:**
- Title: "Audit Trail"
- Subtitle: "What actions have been taken and by whom?"
- Source badge: Static

**Actions:**
- Export → `integration-pending`
- Verify chain integrity → client-side check

---

### 3.21 Templates & Presets

| Slot | Content | Source | Notes |
|------|---------|--------|-------|
| Filter rail | Type: bootstrap, config, governance. Search. | — | |
| Table: Template Name | Display name | Static | |
| Table: Type | Type badge (bootstrap / config / governance) | Static | |
| Table: Version | Semver | Static | |
| Table: Usage Count | Tenant usage count | Static | |
| Detail drill | Click row → Template detail | — | |

**Page header:**
- Title: "Templates & Presets"
- Subtitle: "What templates are available for bootstrapping and configuration?"
- Source badge: Static

**Actions:**
- Create template → `integration-pending`
- Edit template → `integration-pending`

---

### 3.22 Runbooks Hub

| Slot | Content | Source | Notes |
|------|---------|--------|-------|
| Search | Client-side text search across runbook titles and content | — | |
| Index: Runbook titles | From actual `docs/runbooks/` | Static (file-derived) | |
| Index: Categories | Domain-aligned categories | Static | |
| Index: Freshness | Updated-within-90-days indicator | Static | |
| Viewer | Markdown content rendered inline | Static | |

**Page header:**
- Title: "Runbooks Hub"
- Subtitle: "What operational runbooks are available?"
- Source badge: Static

**Actions:** None — purely static reference surface.

---

## 4. Content-Slot Validation Rules

These rules apply across all surfaces:

| # | Rule | Consequence of violation |
|---|------|------------------------|
| 1 | Every named slot must be populated or show empty state from design-contract-v3 §11 | Reject: slot renders nothing, no skeleton, no empty text |
| 2 | Every table column has a header label | Reject: unlabeled column |
| 3 | Every status value uses the correct state-badge family and color | Reject: wrong color or missing badge |
| 4 | Every action button shows posture badge from design-contract-v3 §7.3 | Reject: action with no posture indicator |
| 5 | Every drill link navigates to the correct target surface | Reject: broken or wrong-target link |
| 6 | Cross-domain drill links are labeled with target domain name | Reject: unlabeled cross-domain navigation |
| 7 | Source badge in page header matches actual data source | Reject: badge disagrees with fetch source |
| 8 | No slot displays architecture vocabulary (RPC, IEN, VistA file, resolver, etc.) | Reject: internal terms visible |
| 9 | Empty filter results use "No {entity} match the current filters" pattern | Reject: generic empty or blank table |
| 10 | Detail surface context rail shows all identity fields for the entity | Reject: missing entity ID or name |

---

## 5. Cross-Domain Drill Map

| From surface | Drill target | Target domain | Link label |
|-------------|-------------|---------------|------------|
| Home → Pending Requests card | Bootstrap Requests | Requests & Onboarding | "Review {n} pending requests" |
| Home → Active Provisioning card | Provisioning Runs | Requests & Onboarding | "View provisioning" |
| Home → Recent Alerts card | Alert Center | Operations | "View alerts" |
| Home → Tenant Summary card | Tenant Registry | Tenants | "View tenants" |
| Bootstrap Requests → row | Request Detail (inline) | Requests & Onboarding | Row click |
| Bootstrap Requests detail → approve result | Provisioning Runs | Requests & Onboarding | "View provisioning run" |
| Provisioning Runs → completed run | Tenant Detail | Tenants | "View resulting tenant" |
| Tenant Registry → row | Tenant Detail | Tenants | Row click |
| Tenant Detail → provisioning history | Provisioning Runs | Requests & Onboarding | "Provisioning history" |
| Tenant Detail → environment | Environments & Flags | Operations | "View environment" |
| Tenant Detail → billing | Billing & Entitlements | Commercial | "View billing" |
| Tenant Detail → support cases | Support Console | Support | "Support cases" |
| Operations Center → health card | Environments & Flags | Operations | Card click |
| Operations Center → alert card | Alert Center | Operations | Card click |
| Operations Center → backup card | Backup & DR | Operations | Card click |
| Alert Center → escalate | Support Console | Support | "Escalate to case" |
| Alert Center → affected entity | Tenant Detail | Tenants | "View affected tenant" |
| Support Console → tenant | Tenant Detail | Tenants | "View tenant" |
| Support Console → audit | Audit Trail | Platform | "View audit trail" |
| Market Management → row | Market Detail | Catalogs & Governance | Row click |
| Market Detail → packs | Pack Catalog | Catalogs & Governance | "View packs" |
| Market Detail → payer readiness | Payer Readiness | Catalogs & Governance | "View payer readiness" |
| Market Detail → eligibility | Eligibility Simulator | Catalogs & Governance | "Run eligibility check" |
| Billing & Entitlements → tenant | Tenant Detail | Tenants | "View tenant" |

---

## 6. Versioning

| Version | Document | Status |
|---------|----------|--------|
| **v1** | **This document** | **Canonical** — shell content model |

See `docs/reference/source-of-truth-index.md` for the official registry.
