# Control-Panel Page Specifications and Operator Manual — v2

> **Status:** Draft
> **Scope:** 21 canonical control-plane surfaces (supersedes batch-1 which covered 8)
> **Audience:** Platform operators, implementation engineers, design reviewers
> **Not authorized:** This document specifies surface behavior; it does not authorize runtime or UI implementation.
> **Supersedes:** `control-panel-page-specs-and-operator-manual-batch-1.md` (8 surfaces → 21 surfaces)

---

## 1. Purpose and position in handoff chain

This document is the **page-by-page operator manual** for all 21 control-plane surfaces defined in screen-inventory §9.1–§9.21. It bridges the gap between:

- **Upstream inputs:** Screen-inventory §9 binding table, service-map architecture doc (7 services, 29 objects, 8 state families), tenant-lifecycle doc (state machines), IA v2 doc (5 nav groups), permissions-matrix §7A, pack-visibility-rules §8.1, OpenAPI/AsyncAPI contracts
- **Downstream consumers:** Design contract (wireframes, review checklists), implementation engineers, QA reviewers

For each surface, this document specifies:

1. What the operator sees (visible data, fields, layout regions)
2. What the operator can do (actions, transitions, writes)
3. Where data comes from (API operations, events, registries)
4. What constraints apply (readiness gating, claim surfaces)
5. How the operator navigates between surfaces
6. What operator question the surface answers
7. What audit consequence each state-changing action produces

### Governing references

| Reference | Location |
|-----------|----------|
| Service-map architecture | `docs/explanation/control-plane-service-map-and-operator-console-architecture.md` |
| Tenant lifecycle model | `docs/explanation/control-plane-tenant-lifecycle-and-orchestration-model.md` |
| Information architecture v2 | `docs/explanation/control-panel-information-architecture-and-wireframe-contract-v2.md` |
| Screen inventory §9 | `docs/reference/screen-inventory.md` §9.1–§9.21 |
| Permissions matrix §7A | `docs/reference/permissions-matrix.md` §7A.1–§7A.7 |
| Pack visibility rules §8.1 | `docs/reference/pack-visibility-rules.md` §8.1 |
| OpenAPI contract | `packages/contracts/openapi/control-plane-operator-bootstrap-and-provisioning.openapi.yaml` |
| AsyncAPI contract | `packages/contracts/asyncapi/control-plane-provisioning-events.asyncapi.yaml` |

### What this document does NOT do

- Does not modify screen-inventory entries, screen-contract instances, or JSON schemas
- Does not authorize runtime implementation or UI code
- Does not prescribe visual design (spacing, color, typography) — that is the design contract's role
- Does not define new data models — all data comes from existing or future contracts

---

## 2. Navigation model

The 21 control-plane surfaces are organized into 5 navigation groups (per IA v2 §2). The shell navigation presents group headers; surfaces within each group form a local navigation graph.

```
OPERATOR CONSOLE SHELL
├── Tenants (Nav Group)
│   ├── control-plane.tenants.list [primary]
│   │   └── [drill] → control-plane.tenants.detail (context: tenantId)
│   │       ├── [action] → control-plane.tenants.bootstrap (context: tenantId)
│   │       │   └── [outcome] → control-plane.provisioning.runs (context: bootstrapRequestId)
│   │       └── [transition] → tenant-admin workspace (context: tenantId)
│   └── control-plane.tenants.identity [primary]
│
├── Markets (Nav Group)
│   ├── control-plane.markets.management [primary]
│   │   └── [drill] → control-plane.markets.detail (context: legalMarketId)
│   │       ├── [action] → control-plane.tenants.bootstrap (context: legalMarketId)
│   │       └── [drill] → control-plane.markets.payer-readiness (context: legalMarketId)
│   ├── control-plane.packs.catalog [primary]
│   │   └── [drill] → control-plane.packs.eligibility-simulator (context: packSelections)
│   └── control-plane.markets.payer-readiness [primary]
│
├── Fleet (Nav Group)
│   ├── control-plane.fleet.environments [primary]
│   └── control-plane.fleet.backup-dr [primary]
│
├── Commerce (Nav Group)
│   ├── control-plane.commerce.billing [primary]
│   │   └── [drill] → control-plane.tenants.detail (context: tenantId)
│   └── control-plane.commerce.usage [primary]
│
└── Platform (Nav Group)
    ├── control-plane.platform.operations-center [primary, landing]
    │   └── [drill] → any service domain surface
    ├── control-plane.system.config [primary]
    ├── control-plane.platform.templates [primary]
    ├── control-plane.platform.support [primary]
    ├── control-plane.platform.audit [primary]
    ├── control-plane.platform.alerts [primary]
    │   └── [action] → control-plane.platform.support (escalate to case)
    └── control-plane.platform.runbooks [primary]
```

**Navigation rules:**
- Primary surfaces are always accessible from the operator console shell sidebar
- Local surfaces require entity context passed from a parent surface
- Cross-workspace transitions (to tenant-admin) require access re-evaluation
- Cross-group navigation (e.g., alerts → support) preserves the operator session
- Operations Center is the default landing page for the operator console

---

## 3. Surface specifications — Tenants nav group

### 3.1 Tenant Registry (`control-plane.tenants.list`)

**Carried forward from batch-1 §3.1.** No changes to data sources, visible data regions, or actions.

**Service domain:** Tenant Portfolio
**Operator question:** "What tenants exist, and what is their lifecycle state?"
**Audit events:** None (read-only list surface; drill and create actions navigate, they don't mutate)
**Inventory entry:** §9.1

See batch-1 §3.1 for full specification including data sources (`GET /tenants`), visible regions (filter bar, tenant table, pagination), operator actions (drill to detail, create tenant, refresh), and PH truth constraints.

---

### 3.2 Tenant Detail (`control-plane.tenants.detail`)

**Carried forward from batch-1 §3.2.** No changes to data sources, visible data regions, or actions.

**Service domain:** Tenant Portfolio
**Operator question:** "What is the complete picture of this one tenant — identity, status, bootstrap history, and available actions?"
**Audit events:** `tenant.suspended`, `tenant.reactivated`, `tenant.archived` (all lifecycle mutations)
**Inventory entry:** §9.5

See batch-1 §3.2 for full specification including data sources (`GET /tenants/{tenantId}`, bootstrap history, provisioning status), visible regions (identity header, configuration summary, bootstrap history, active provisioning status), operator actions (launch bootstrap, view run, open admin, suspend, reactivate, archive), and PH truth constraints.

---

### 3.3 New Tenant Bootstrap Wizard (`control-plane.tenants.bootstrap`)

**Carried forward from batch-1 §3.3.** No changes to data sources, visible data regions, or actions.

**Service domain:** Bootstrap & Provisioning Orchestrator
**Operator question:** "What will the effective configuration plan be for this tenant, and is it safe to submit for provisioning?"
**Audit events:** `bootstrap.request.created`, `effective-plan.resolved`
**Inventory entry:** §9.6

See batch-1 §3.3 for full specification including data sources (plan resolution, bootstrap submission, events), visible regions (market selection, resolved plan review, pack selection adjustment, submission controls), claim surface behavior, and PH truth constraints.

---

### 3.4 Provisioning Runs (`control-plane.provisioning.runs`)

**Carried forward from batch-1 §3.4.** No changes to data sources, visible data regions, or actions.

**Service domain:** Bootstrap & Provisioning Orchestrator
**Operator question:** "What is happening with this provisioning run right now, and if it failed, why?"
**Audit events:** `provisioning.run.retried`, `provisioning.run.cancelled`
**Inventory entry:** §9.7

See batch-1 §3.4 for full specification including data sources (run status, 5 AsyncAPI events), visible regions (run header, step progress, blockers, failures, actions), event-driven refresh model, and PH truth constraints.

---

### 3.5 Identity & Invitations (`control-plane.tenants.identity`)

**New in v2.** Service domain: Tenant Portfolio.
**Inventory entry:** §9.9
**Navigation level:** Primary (Tenants nav group)
**Read/write posture:** Mixed
**Claim surface:** None

#### 3.5.1 Purpose

Platform-wide identity directory and invitation lifecycle manager. Operators view all user identities across tenants, manage pending invitations, and monitor acceptance status. This is the single surface for answering "who has access to what tenant and how did they get it."

**Operator question:** "Who has been invited to access tenants, and what is the acceptance status across all tenants?"

#### 3.5.2 Data sources

| Source | API operation | Contract status |
|--------|--------------|----------------|
| Identity list | `GET /identities` | Future contract |
| Invitation list | `GET /invitations` | Future contract |
| Send invitation | `POST /invitations` | Future contract |
| Revoke invitation | `POST /invitations/{id}/revoke` | Future contract |

**Source of truth:** `platform-identity-registry` (Tenant Portfolio service).

#### 3.5.3 Visible data regions

**Region A — Filter bar:**

| Control | Type | Behavior |
|---------|------|----------|
| Tenant filter | Dropdown | Filter identities by tenant |
| Status filter | Multi-select | invited, accepted, active, revoked, expired |
| Search | Text input | Search on name, email |

**Region B — Active identities table:**

| Column | Source field | Notes |
|--------|-------------|-------|
| Name | `displayName` | Primary text |
| Email | `email` | Contact info |
| Tenant | `tenantId` | Which tenant this identity belongs to |
| Role | `roleCategory` | Badge: PO, TA, CL, etc. |
| Status | `status` | Badge: active=green, suspended=amber, revoked=red |
| Last Login | `lastLoginAt` | Relative time |

**Region C — Pending invitations table:**

| Column | Source field | Notes |
|--------|-------------|-------|
| Invitee | `email` | Target email |
| Tenant | `tenantId` | Target tenant |
| Role | `roleCategory` | Assigned role |
| Sent | `sentAt` | Timestamp |
| Expires | `expiresAt` | Timestamp with urgency coloring |
| Status | `status` | invited, expired, accepted, revoked |

#### 3.5.4 Operator actions

| Action | Type | Audit event | Precondition |
|--------|------|-------------|-------------|
| Send invitation | Controlled write | `invitation.sent` | Valid email, tenant selected, role selected |
| Resend invitation | Controlled write | `invitation.resent` | Invitation is expired or pending |
| Revoke invitation | Controlled write | `invitation.revoked` | Invitation is pending or accepted |
| Revoke access | Controlled write | `member.revoked` | Identity is active |
| Drill to tenant detail | Navigate | — | Row selected; passes `tenantId` |

---

## 4. Surface specifications — Markets nav group

### 4.1 Markets Registry (`control-plane.markets.management`)

**Carried forward from batch-1 §3.5.** No changes.

**Service domain:** Composition & Eligibility
**Operator question:** "What legal markets are configured, and at what readiness level?"
**Audit events:** `market.created`, `market.updated`, `market.submitted-for-review` (all contracted Batch 3)
**Inventory entry:** §9.2

See batch-1 §3.5 for full specification.

---

### 4.2 Market Detail / Readiness Vector (`control-plane.markets.detail`)

**Carried forward from batch-1 §3.6.** Enhanced with navigation to payer-readiness surface.

**Service domain:** Composition & Eligibility + Governance & Readiness
**Operator question:** "What is the complete readiness picture for this legal market?"
**Audit events:** None (read-only)
**Inventory entry:** §9.8

See batch-1 §3.6 for full specification. **Addition in v2:** New drill action to `control-plane.markets.payer-readiness` passing `legalMarketId` context, giving the operator a focused view of payer readiness for this specific market.

---

### 4.3 Payer Readiness Registry (`control-plane.markets.payer-readiness`)

**New in v2.** Service domain: Composition & Eligibility + Governance & Readiness.
**Inventory entry:** §9.10
**Navigation level:** Primary (Markets nav group), also reachable as drill from markets.detail
**Read/write posture:** Mixed
**Claim surface:** Yes — `control-plane-provisioning` with domain `[payer, readiness]`

#### 4.3.1 Purpose

Platform-wide payer readiness registry. Shows all payers across all markets with their readiness state, adapter availability, and testing status. Operators use this to answer the question "which payers can we actually integrate with" before launching tenants in a market.

**Operator question:** "Which payers are available in each market, and at what integration readiness level?"

#### 4.3.2 Data sources

| Source | API operation | Contract status |
|--------|--------------|----------------|
| Payer list | `GET /payer-readiness` | Future contract |
| Payer detail | `GET /payer-readiness/{payerId}` | Future contract |

**Source of truth:** `claim-readiness-registry` (Governance & Readiness service).

#### 4.3.3 Visible data regions

**Region A — Filter bar:**

| Control | Type | Behavior |
|---------|------|----------|
| Market filter | Dropdown | Filter by legal market |
| Readiness filter | Multi-select | declared, specified, implemented, validated, etc. |
| Search | Text input | Payer name, payer ID |

**Region B — Payer table:**

| Column | Source field | Notes |
|--------|-------------|-------|
| Payer Name | `displayName` | Primary text |
| Payer ID | `payerId` | Monospace |
| Market | `legalMarketId` | Flag + name |
| Readiness | `readinessState` | Badge with 9-state coloring |
| Adapter | `adapterStatus` | connected/pending/unavailable indicator |
| Test Status | `testStatus` | passed/failed/untested |
| Last Verified | `lastVerifiedAt` | Timestamp |

#### 4.3.4 Operator actions

| Action | Type | Audit event | Precondition |
|--------|------|-------------|-------------|
| View payer detail | Drill | — | Row selected |
| Flag readiness issue | Controlled write | `payer.readiness.issue-flagged` | Payer selected |
| Drill to market detail | Navigate | — | Market column click; passes `legalMarketId` |

---

### 4.4 Pack Catalog (`control-plane.packs.catalog`)

**Carried forward from batch-1 §3.7.** No changes.

**Service domain:** Composition & Eligibility
**Operator question:** "What packs exist, what is their lifecycle state, and where are they eligible?"
**Audit events:** `pack.created`, `pack.updated`, `pack.submitted-for-review` (all contracted Batch 3)
**Inventory entry:** §9.3

See batch-1 §3.7 for full specification.

---

### 4.5 Pack Eligibility Simulator (`control-plane.packs.eligibility-simulator`)

**New in v2.** Service domain: Composition & Eligibility.
**Inventory entry:** §9.11
**Navigation level:** Primary (Markets nav group), also reachable from packs.catalog
**Read/write posture:** Read-only (stateless simulation — no persistent writes)
**Claim surface:** Yes — `control-plane-provisioning` with domain `[pack-eligibility]`, informationalOnly: true

#### 4.5.1 Purpose

Interactive simulation tool. The operator selects a market, facility type, and optional pack overrides, then calls the plan resolver to see what effective configuration plan would result. No state is persisted — this is a "what-if" analysis tool.

**Operator question:** "If I activate this set of selections for this market, what effective configuration plan would the resolver produce?"

#### 4.5.2 Data sources

| Source | API operation | Contract status |
|--------|--------------|----------------|
| Plan resolution | `resolveEffectiveConfigurationPlan` | Existing OpenAPI |
| Market profiles | `GET /legal-market-profiles` | Existing OpenAPI |
| Pack catalog | `GET /packs` | Existing OpenAPI |

#### 4.5.3 Visible data regions

**Region A — Simulation inputs:**

| Control | Type | Behavior |
|---------|------|----------|
| Legal Market | Dropdown | Select market to simulate |
| Facility Type | Dropdown | single-clinic, hospital, multi-facility |
| Pack overrides | Checkbox list | Add/remove packs from default resolution |
| Simulate | Button | Calls `resolveEffectiveConfigurationPlan` |

**Region B — Simulation results:**

Same structure as bootstrap §3.3 Region B (resolved plan review): resolved packs table, deferred items table, readiness posture summary. Displayed after simulation runs.

**Region C — Comparison (optional enhancement):**

Side-by-side comparison of two simulation runs for the same market with different selections.

#### 4.5.4 Operator actions

| Action | Type | Audit event | Precondition |
|--------|------|-------------|-------------|
| Run simulation | Read (POST but idempotent) | — | Market and facility type selected |
| Export results | Export | — | Simulation results available |
| Save as template | Navigate | — | Navigate to `platform.templates` with context |

**No persistent writes.** Simulation results are ephemeral and exist only in the current browser session.

---

## 5. Surface specifications — Fleet nav group

### 5.1 Feature Flags / Environments (`control-plane.fleet.environments`)

**New in v2.** Service domain: Runtime Fleet & Release.
**Inventory entry:** §9.12
**Navigation level:** Primary (Fleet nav group)
**Read/write posture:** Controlled-write
**Claim surface:** None

#### 5.1.1 Purpose

Manages feature flags across environments and release channels. Provides the operator with visibility into what flags are active where, with audit-traced toggle operations.

**Operator question:** "What feature flags are active per environment, and which release channels are assigned to which tenants?"

**Note:** This surface partially overlaps with the feature-flags section of `control-plane.system.config` (batch-1 §3.8). The system.config surface remains the platform-wide settings view; this Fleet surface provides a richer environment-centric view with release channel management.

#### 5.1.2 Data sources

| Source | API operation | Contract status |
|--------|--------------|----------------|
| Environment list | `GET /fleet/environments` | Future contract |
| Feature flags | `GET /fleet/feature-flags` | Future contract |
| Release channels | `GET /fleet/release-channels` | Future contract |
| Toggle flag | `PUT /fleet/feature-flags/{key}` | Future contract |
| Assign channel | `PUT /fleet/release-channels/{channelId}/tenants` | Future contract |

**Source of truth:** `fleet-environment-registry` (Runtime Fleet & Release service).

#### 5.1.3 Visible data regions

**Region A — Environment overview:**

| Column | Source field | Notes |
|--------|-------------|-------|
| Environment | `name` | dev, staging, production, etc. |
| Release Channel | `releaseChannel` | stable, canary, beta |
| Tenant Count | `tenantCount` | How many tenants in this env |
| Flag Overrides | `overrideCount` | Number of non-default flags |
| Health | `healthStatus` | healthy/degraded/offline |

**Region B — Feature flag matrix:**

Rows = flags, Columns = environments. Cell = on/off/override with toggle control.

**Region C — Release channel assignment:**

| Column | Source field | Notes |
|--------|-------------|-------|
| Tenant | `tenantDisplayName` | |
| Current Channel | `releaseChannel` | Badge |
| Target Channel | Dropdown | Reassignment control |

#### 5.1.4 Operator actions

| Action | Type | Audit event | Precondition |
|--------|------|-------------|-------------|
| Toggle feature flag | Controlled write | `flag.toggled` | Flag exists; environment specified |
| Assign release channel | Controlled write | `release-channel.assigned` | Tenant exists; channel valid |
| View environment health | Drill | — | Environment selected |

---

### 5.2 Backup / Restore / DR (`control-plane.fleet.backup-dr`)

**New in v2.** Service domain: Runtime Fleet & Release.
**Inventory entry:** §9.13
**Navigation level:** Primary (Fleet nav group)
**Read/write posture:** Controlled-write (restore requires second-approval)
**Claim surface:** None

#### 5.2.1 Purpose

Backup status dashboard, restore initiation, and disaster recovery test tracking. Restore operations are the most destructive action available to a platform operator and require explicit confirmation with justification.

**Operator question:** "What is the backup status of each managed environment, and when was disaster recovery last tested?"

#### 5.2.2 Data sources

| Source | API operation | Contract status |
|--------|--------------|----------------|
| Backup status | `GET /fleet/backups` | Future contract |
| Trigger backup | `POST /fleet/backups` | Future contract |
| Initiate restore | `POST /fleet/restores` | Future contract (requires reason + confirmation) |
| DR test results | `GET /fleet/dr-tests` | Future contract |

#### 5.2.3 Visible data regions

**Region A — Backup status per environment:**

| Column | Source field | Notes |
|--------|-------------|-------|
| Environment | `environmentName` | |
| Last Backup | `lastBackupAt` | Timestamp with freshness indicator |
| Backup Size | `backupSizeBytes` | Human-readable |
| Status | `backupStatus` | succeeded/failed/in-progress |
| Retention | `retentionDays` | Policy days remaining |

**Region B — Recent restore operations:**

| Column | Source field | Notes |
|--------|-------------|-------|
| Restore ID | `restoreId` | UUID |
| Environment | `targetEnvironment` | |
| Initiated By | `initiatedBy` | Operator identity |
| Reason | `reason` | Required justification text |
| Status | `status` | pending-approval/in-progress/completed/failed |

**Region C — DR test history:**

| Column | Source field | Notes |
|--------|-------------|-------|
| Test Date | `testDate` | |
| Environment | `environment` | |
| Result | `result` | passed/failed |
| RTO Achieved | `rtoMinutes` | Recovery time in minutes |
| RPO Achieved | `rpoMinutes` | Recovery point in minutes |

#### 5.2.4 Operator actions

| Action | Type | Audit event | Precondition |
|--------|------|-------------|-------------|
| Trigger backup | Controlled write | `backup.triggered` | Environment selected |
| Initiate restore | **Second-approval write** | `restore.initiated` | Backup selected; reason required; confirmation dialog |
| Record DR test | Controlled write | `dr-test.recorded` | Test results available |

**Restore is the highest-risk action in the operator console.** The initiate-restore action requires: (1) a written justification, (2) explicit "I understand this is destructive" confirmation, and (3) audit trail entry before execution begins.

---

## 6. Surface specifications — Commerce nav group

### 6.1 Billing & Entitlements Snapshot (`control-plane.commerce.billing`)

**New in v2.** Service domain: Commercial.
**Inventory entry:** §9.14
**Navigation level:** Primary (Commerce nav group)
**Read/write posture:** Mixed
**Claim surface:** None

#### 6.1.1 Purpose

Overview of tenant billing status, subscription tiers, entitlements, and payment state. The operator uses this to identify past-due accounts, manage subscription changes, and trigger commercial lifecycle events (suspension for non-payment, reactivation after payment).

**Operator question:** "What is the billing status of each tenant's subscription, and are any past-due or suspended?"

#### 6.1.2 Data sources

| Source | API operation | Contract status |
|--------|--------------|----------------|
| Billing summary | `GET /commerce/billing` | Future contract |
| Subscription detail | `GET /commerce/subscriptions/{tenantId}` | Future contract |
| Record payment | `POST /commerce/payments` | Future contract |
| Trigger suspension | `POST /commerce/subscriptions/{tenantId}/suspend` | Future contract |

**Source of truth:** `commercial-subscription-registry` (Commercial service). Note: commercial suspension triggers tenant suspension in the Tenant Portfolio service (per service-map §2.2.5).

#### 6.1.3 Visible data regions

**Region A — Billing overview:**

| Column | Source field | Notes |
|--------|-------------|-------|
| Tenant | `tenantDisplayName` | Drillable to tenant detail |
| Subscription Tier | `subscriptionTier` | Badge |
| Status | `billingStatus` | current/past-due/suspended/grace-period |
| Last Payment | `lastPaymentAt` | Timestamp |
| Next Due | `nextDueAt` | Timestamp with urgency coloring |
| Balance | `balanceDue` | Currency formatted |

**Region B — Subscription detail (drill):**

Per-tenant subscription detail: tier, entitlements, module entitlements, usage limits, payment history.

#### 6.1.4 Operator actions

| Action | Type | Audit event | Precondition |
|--------|------|-------------|-------------|
| View subscription detail | Drill | — | Tenant selected |
| Record payment | Controlled write | `payment.recorded` | Tenant selected; amount entered |
| Trigger suspension | Controlled write | `subscription.suspended` | Tenant is past-due; confirmation required |
| Reactivate subscription | Controlled write | `subscription.reactivated` | Tenant is suspended; payment recorded |
| Drill to tenant detail | Navigate | — | Passes `tenantId` |

---

### 6.2 Usage & Metering Explorer (`control-plane.commerce.usage`)

**New in v2.** Service domain: Commercial.
**Inventory entry:** §9.15
**Navigation level:** Primary (Commerce nav group)
**Read/write posture:** Read-only
**Claim surface:** None

#### 6.2.1 Purpose

Resource usage and metering data viewer. Shows consumption metrics per tenant compared to subscription tier limits. Operators use this to identify tenants approaching or exceeding limits, and to export usage reports for billing reconciliation.

**Operator question:** "How much resource usage has each tenant consumed, and how does it compare to their subscription tier?"

#### 6.2.2 Data sources

| Source | API operation | Contract status |
|--------|--------------|----------------|
| Usage summary | `GET /commerce/usage` | Future contract |
| Usage detail | `GET /commerce/usage/{tenantId}` | Future contract |
| Export usage report | `GET /commerce/usage/export` | Future contract |

#### 6.2.3 Visible data regions

**Region A — Usage summary table:**

| Column | Source field | Notes |
|--------|-------------|-------|
| Tenant | `tenantDisplayName` | |
| Active Users | `activeUsers` / `userLimit` | Progress bar |
| API Calls | `apiCallCount` / `apiCallLimit` | Period total |
| Storage | `storageBytes` / `storageLimit` | Human-readable |
| Tier | `subscriptionTier` | Badge |
| Overage | computed | Flag if any metric exceeds limit |

**Region B — Time-series chart (drill to tenant):**

Per-tenant usage over time. Metric selector: API calls, active users, storage, bandwidth.

#### 6.2.4 Operator actions

| Action | Type | Audit event | Precondition |
|--------|------|-------------|-------------|
| View tenant usage detail | Drill | — | Tenant selected |
| Export usage report | Export | `usage.report.exported` | Date range selected |
| Flag overage | Navigate | — | Navigate to billing surface |

---

## 7. Surface specifications — Platform nav group

### 7.1 Operations Center (`control-plane.platform.operations-center`)

**New in v2.** Service domain: Cross-cutting (all 7 service domains).
**Inventory entry:** §9.16
**Navigation level:** Primary (Platform nav group) — **default landing page**
**Read/write posture:** Mixed (view + acknowledge actions)
**Claim surface:** None

#### 7.1.1 Purpose

The platform health dashboard and operator attention router. Aggregates status signals from all 7 service domains into a single view. The operator starts here and drills into specific surfaces based on what needs attention.

**Operator question:** "What is the overall platform health right now, and what needs my attention?"

#### 7.1.2 Data sources

| Source | API operation | Contract status |
|--------|--------------|----------------|
| Platform health | `GET /platform/health` | Future contract |
| Active alerts | `GET /alerts?status=active` | Future contract |
| Recent events | `GET /platform/events?limit=20` | Future contract |

#### 7.1.3 Visible data regions

**Region A — Service domain health cards:**

One card per service domain (7 total):

| Field | Source | Notes |
|-------|--------|-------|
| Domain Name | Tenant Portfolio, Composition, Bootstrap, Fleet, Commercial, Support, Governance | Static labels |
| Health | `healthStatus` | green/amber/red indicator |
| Active Alerts | `alertCount` | Count with drill |
| Key Metric | domain-specific | e.g., active tenants, pending runs, open cases |

**Region B — Attention queue:**

Prioritized list of items requiring operator action:

| Column | Source field | Notes |
|--------|-------------|-------|
| Priority | `priority` | critical/high/medium/low |
| Category | `category` | provisioning-failure, billing-past-due, alert-unacknowledged, etc. |
| Summary | `summary` | One-line description |
| Age | `createdAt` | Time since created |
| Action | — | Drill link to relevant surface |

**Region C — Recent platform events timeline:**

Chronological feed of significant platform events (tenant created, provisioning completed, alert fired, etc.).

#### 7.1.4 Operator actions

| Action | Type | Audit event | Precondition |
|--------|------|-------------|-------------|
| Acknowledge attention item | Controlled write | `attention.acknowledged` | Item selected |
| Drill to service domain | Navigate | — | Card or item clicked; passes context |
| Refresh | Button | — | — |

---

### 7.2 System Configuration (`control-plane.system.config`)

**Carried forward from batch-1 §3.8.** No changes.

**Service domain:** Governance & Readiness
**Operator question:** "What are the current platform-wide settings, and which feature flags are active?"
**Audit events:** `flag.toggled`, `parameter.updated` (contracted Batch 3)
**Inventory entry:** §9.4

See batch-1 §3.8 for full specification.

---

### 7.3 Templates & Presets (`control-plane.platform.templates`)

**New in v2.** Service domain: Governance & Readiness.
**Inventory entry:** §9.17
**Navigation level:** Primary (Platform nav group)
**Read/write posture:** Controlled-write
**Claim surface:** None

#### 7.3.1 Purpose

Repository of shared bootstrap templates, configuration presets, and governance templates. Operators create templates from successful bootstrap configurations and apply them to accelerate future tenant onboarding.

**Operator question:** "What shared bootstrap templates, configuration presets, and governance templates exist?"

#### 7.3.2 Data sources

| Source | API operation | Contract status |
|--------|--------------|----------------|
| Template list | `GET /templates` | Future contract |
| Template detail | `GET /templates/{id}` | Future contract |
| Create template | `POST /templates` | Future contract |
| Update template | `PUT /templates/{id}` | Future contract |
| Publish template | `POST /templates/{id}/publish` | Future contract |

#### 7.3.3 Visible data regions

**Region A — Template catalog:**

| Column | Source field | Notes |
|--------|-------------|-------|
| Name | `displayName` | Primary text |
| Type | `templateType` | bootstrap, configuration, governance |
| Market Scope | `legalMarketIds` | Which markets this template targets |
| Status | `status` | draft/published/deprecated |
| Created By | `createdBy` | Operator identity |
| Last Modified | `updatedAt` | Timestamp |
| Usage Count | `usageCount` | Times applied |

**Region B — Template detail (drill):**

Full template content: pack selections, configuration values, governance settings. Read-only display with edit action.

#### 7.3.4 Operator actions

| Action | Type | Audit event | Precondition |
|--------|------|-------------|-------------|
| Create template | Controlled write | `template.created` | — |
| Edit template | Controlled write | `template.updated` | Template is draft |
| Publish template | Controlled write | `template.published` | Template is draft; validation passes |
| Deprecate template | Controlled write | `template.deprecated` | Template is published |
| Apply to bootstrap | Navigate | — | Navigate to bootstrap surface with template context |

---

### 7.4 Support Console (`control-plane.platform.support`)

**New in v2.** Service domain: Support / Incident / Audit.
**Inventory entry:** §9.18
**Navigation level:** Primary (Platform nav group)
**Read/write posture:** Mixed
**Claim surface:** None

#### 7.4.1 Purpose

Cross-tenant support case and incident management. Operators create, triage, and resolve support cases. Critical cases can be escalated to incidents which have their own lifecycle. The support console is append-only for context — entries once created cannot be deleted or modified, only supplemented.

**Operator question:** "What support cases and incidents are open across all tenants?"

#### 7.4.2 Data sources

| Source | API operation | Contract status |
|--------|--------------|----------------|
| Case list | `GET /support/cases` | Future contract |
| Case detail | `GET /support/cases/{id}` | Future contract |
| Create case | `POST /support/cases` | Future contract |
| Update case | `PUT /support/cases/{id}` | Future contract |
| Escalate to incident | `POST /support/incidents` | Future contract |
| Resolve case | `POST /support/cases/{id}/resolve` | Future contract |

**Source of truth:** `support-incident-store` (Support/Incident/Audit service).

#### 7.4.3 Visible data regions

**Region A — Case queue:**

| Column | Source field | Notes |
|--------|-------------|-------|
| Case ID | `caseId` | UUID |
| Tenant | `tenantId` | Which tenant is affected |
| Priority | `priority` | critical/high/medium/low Badge |
| Category | `category` | billing, provisioning, integration, clinical, etc. |
| Summary | `summary` | One-line description |
| Status | `status` | open/in-progress/escalated/resolved |
| Age | `createdAt` | Time since opened |
| Assignee | `assignedTo` | Operator name or "unassigned" |

**Region B — Case detail (drill):**

Full case timeline with entries, notes, attachments. Append-only.

#### 7.4.4 Operator actions

| Action | Type | Audit event | Precondition |
|--------|------|-------------|-------------|
| Create case | Controlled write | `case.created` | Summary and category required |
| Update case status | Controlled write | `case.updated` | Case is open or in-progress |
| Assign case | Controlled write | `case.assigned` | Case is open or in-progress |
| Escalate to incident | Controlled write | `incident.created` | Case is critical or high priority |
| Resolve case | Controlled write | `case.resolved` | Case is open or in-progress; resolution notes required |

---

### 7.5 Audit Trail (`control-plane.platform.audit`)

**New in v2.** Service domain: Support / Incident / Audit.
**Inventory entry:** §9.19
**Navigation level:** Primary (Platform nav group)
**Read/write posture:** Read-only
**Claim surface:** None

#### 7.5.1 Purpose

Platform-wide audit event viewer. Shows all audited actions across all services with search, filter, and chain verification. The audit trail is append-only and hash-chained per the service-map §2.2.6 specification.

**Operator question:** "What actions have been taken across the platform, and is the audit chain intact?"

#### 7.5.2 Data sources

| Source | API operation | Contract status |
|--------|--------------|----------------|
| Audit events | `GET /audit/events` | Future contract |
| Chain verification | `GET /audit/verify` | Future contract |
| Export audit | `GET /audit/export` | Future contract |

**Source of truth:** `audit-event-store` (Support/Incident/Audit service). Hash-chained, append-only.

#### 7.5.3 Visible data regions

**Region A — Audit search and filter:**

| Control | Type | Behavior |
|---------|------|----------|
| Date range | Date picker pair | Start/end |
| Actor filter | Text input | Operator identity |
| Action filter | Multi-select | From audit event type taxonomy |
| Service domain filter | Multi-select | 7 service domains |
| Search | Text input | Full-text search on event details |

**Region B — Audit event table:**

| Column | Source field | Notes |
|--------|-------------|-------|
| Timestamp | `timestamp` | Full ISO 8601 |
| Actor | `actorId` | Who performed the action |
| Action | `action` | e.g., `tenant.suspended`, `flag.toggled` |
| Target | `targetId` | What was acted on |
| Service | `serviceDomain` | Which service domain |
| Detail | `detail` | Expandable JSON |
| Chain Hash | `hash` | Truncated SHA-256 |

**Region C — Chain integrity:**

| Field | Source | Notes |
|-------|--------|-------|
| Chain Status | `chainValid` | Valid/Broken indicator |
| Total Events | `eventCount` | Total audited events |
| Last Verified | `lastVerifiedAt` | When chain was last verified |
| Chain Length | `chainLength` | Number of entries in chain |

#### 7.5.4 Operator actions

| Action | Type | Audit event | Precondition |
|--------|------|-------------|-------------|
| Search audit events | Read | `audit.searched` (meta-audit) | — |
| Verify chain integrity | Read | `audit.chain-verified` (meta-audit) | — |
| Export audit report | Export | `audit.exported` (meta-audit) | Date range selected; export format selected |

**Note:** Audit trail access is itself audited (meta-audit). The audit viewer cannot modify audit entries.

---

### 7.6 Alert Center (`control-plane.platform.alerts`)

**New in v2.** Service domain: Support / Incident / Audit.
**Inventory entry:** §9.20
**Navigation level:** Primary (Platform nav group)
**Read/write posture:** Mixed (view + acknowledge/silence)
**Claim surface:** None

#### 7.6.1 Purpose

Active alert viewer and management surface. Shows system alerts, governance warnings, and SLA threshold breaches. Operators acknowledge alerts, silence recurring known-issue alerts (with justification), or escalate to the support console.

**Operator question:** "What system alerts and governance warnings are currently active?"

#### 7.6.2 Data sources

| Source | API operation | Contract status |
|--------|--------------|----------------|
| Alert list | `GET /alerts` | Future contract |
| Acknowledge alert | `POST /alerts/{id}/acknowledge` | Future contract |
| Silence alert | `POST /alerts/{id}/silence` | Future contract |
| Escalate to incident | `POST /support/incidents` | Future contract (same as support console) |

#### 7.6.3 Visible data regions

**Region A — Active alerts:**

| Column | Source field | Notes |
|--------|-------------|-------|
| Severity | `severity` | critical/warning/info Badge |
| Category | `category` | infrastructure, compliance, billing, performance, security |
| Summary | `summary` | One-line description |
| Source | `sourceDomain` | Which service domain originated |
| Fired At | `firedAt` | Timestamp |
| Acknowledged | `acknowledgedAt` | Timestamp or "—" |

**Region B — Alert detail (drill):**

Full alert detail: description, affected resources, recommended action, related alerts.

**Region C — Silenced alerts (collapsible):**

List of alerts currently silenced with justification and expiry time.

#### 7.6.4 Operator actions

| Action | Type | Audit event | Precondition |
|--------|------|-------------|-------------|
| Acknowledge alert | Controlled write | `alert.acknowledged` | Alert is active |
| Silence alert | Controlled write | `alert.silenced` | Alert is active; justification required; duration set |
| Escalate to incident | Navigate + write | `incident.created` | Navigate to support console with alert context |

---

### 7.7 Operator Runbooks & Internal Docs Hub (`control-plane.platform.runbooks`)

**New in v2.** Service domain: Governance & Readiness.
**Inventory entry:** §9.21
**Navigation level:** Primary (Platform nav group)
**Read/write posture:** Read-only
**Claim surface:** None

#### 7.7.1 Purpose

Index and viewer for operational runbooks, internal documentation, and platform reference material. Operators search and browse runbooks for operational procedures. Optional workflow tracking allows marking procedures as started/completed for operational coordination.

**Operator question:** "What runbooks and internal documentation resources are available for this platform operation?"

#### 7.7.2 Data sources

| Source | API operation | Contract status |
|--------|--------------|----------------|
| Runbook index | `GET /runbooks` | Future contract |
| Runbook content | `GET /runbooks/{id}` | Future contract |

**Source of truth:** Governance & Readiness service. Content may be sourced from the repo's `/docs/runbooks/` directory or an external documentation system.

#### 7.7.3 Visible data regions

**Region A — Runbook catalog:**

| Column | Source field | Notes |
|--------|-------------|-------|
| Title | `title` | Primary text |
| Category | `category` | provisioning, incident-response, billing, DR, etc. |
| Last Updated | `updatedAt` | Timestamp |
| Tags | `tags` | Filterable tags |

**Region B — Runbook content viewer:**

Markdown-rendered runbook content with table of contents navigation.

**Region C — Search:**

Full-text search across all runbook content.

#### 7.7.4 Operator actions

| Action | Type | Audit event | Precondition |
|--------|------|-------------|-------------|
| View runbook | Read | `runbook.accessed` | Runbook selected |
| Search runbooks | Read | — | — |

---

## 8. Cross-surface navigation summary

### 8.1 Intra-group navigation

| From surface | To surface | Trigger | Context passed |
|-------------|-----------|---------|----------------|
| `tenants.list` | `tenants.detail` | Row click | `tenantId` |
| `tenants.list` | `tenants.bootstrap` | "Create tenant" action | — |
| `tenants.detail` | `tenants.bootstrap` | "Launch bootstrap" | `tenantId` |
| `tenants.detail` | `provisioning.runs` | "View run" link | `provisioningRunId` |
| `markets.management` | `markets.detail` | Row click | `legalMarketId` |
| `markets.detail` | `markets.payer-readiness` | "View payer readiness" | `legalMarketId` |
| `packs.catalog` | `packs.eligibility-simulator` | "Simulate" action | `packSelections` |
| `alerts` | `support` | "Escalate" action | Alert context |

### 8.2 Cross-group navigation

| From surface | To surface | Trigger | Context passed |
|-------------|-----------|---------|----------------|
| `operations-center` | Any service domain surface | Card/item drill | Varies |
| `markets.detail` | `tenants.bootstrap` | "Bootstrap for market" | `legalMarketId` |
| `commerce.billing` | `tenants.detail` | Tenant drill | `tenantId` |
| `tenants.detail` | `commerce.billing` detail | "View billing" | `tenantId` |
| `templates` | `tenants.bootstrap` | "Apply template" | Template context |
| `eligibility-simulator` | `templates` | "Save as template" | Simulation config |

### 8.3 Cross-workspace navigation

| From surface | To surface | Trigger | Context | Access re-evaluation |
|-------------|-----------|---------|---------|---------------------|
| `tenants.detail` | tenant-admin workspace | "Open admin" | `tenantId` | Yes |

---

## 9. Deferred API contracts summary

All 13 new surfaces require future API contracts. The following operations are identified as needed:

| Surface | Read operations | Write operations | Event subscriptions |
|---------|----------------|-----------------|---------------------|
| `tenants.identity` | `GET /identities`, `GET /invitations` | `POST /invitations`, `POST /invitations/{id}/revoke` | `invitation.accepted` |
| `markets.payer-readiness` | `GET /payer-readiness` | `POST /payer-readiness/{id}/flag-issue` | — |
| `packs.eligibility-simulator` | Uses existing `resolveEffectiveConfigurationPlan` | — (stateless) | — |
| `fleet.environments` | `GET /fleet/environments`, `GET /fleet/feature-flags`, `GET /fleet/release-channels` | `PUT /fleet/feature-flags/{key}`, `PUT /fleet/release-channels/{id}/tenants` | `flag.toggled` |
| `fleet.backup-dr` | `GET /fleet/backups`, `GET /fleet/dr-tests` | `POST /fleet/backups`, `POST /fleet/restores` | `backup.completed`, `restore.completed` |
| `commerce.billing` | `GET /commerce/billing`, `GET /commerce/subscriptions/{id}` | `POST /commerce/payments`, `POST /commerce/subscriptions/{id}/suspend` | `payment.received` |
| `commerce.usage` | `GET /commerce/usage`, `GET /commerce/usage/{id}`, `GET /commerce/usage/export` | — (read-only) | — |
| `platform.operations-center` | `GET /platform/health`, `GET /alerts?status=active`, `GET /platform/events` | — (acknowledge only) | Platform-wide events |
| `platform.templates` | `GET /templates`, `GET /templates/{id}` | `POST /templates`, `PUT /templates/{id}`, `POST /templates/{id}/publish` | — |
| `platform.support` | `GET /support/cases`, `GET /support/cases/{id}` | `POST /support/cases`, `PUT /support/cases/{id}`, `POST /support/incidents`, `POST /support/cases/{id}/resolve` | `case.created` |
| `platform.audit` | `GET /audit/events`, `GET /audit/verify`, `GET /audit/export` | — (read-only) | — |
| `platform.alerts` | `GET /alerts` | `POST /alerts/{id}/acknowledge`, `POST /alerts/{id}/silence` | `alert.fired` |
| `platform.runbooks` | `GET /runbooks`, `GET /runbooks/{id}` | — (read-only) | — |

---

## 10. Verification checklist

- [ ] Every surface in §9.1–§9.21 has a corresponding page spec in this document
- [ ] Every data source traces to an existing API operation or a clearly identified future contract
- [ ] Every operator action traces to an API operation (existing or future)
- [ ] Every state-changing action documents its audit event
- [ ] Navigation graph is consistent with screen-inventory `crossWorkspaceTransitions` and IA v2 nav groups
- [ ] No screen-inventory fields were modified
- [ ] No screen-contract JSON instances were modified
- [ ] No JSON schemas were modified
- [ ] No runtime or UI code was produced
- [ ] Read-only surfaces (audit, usage, eligibility-simulator, runbooks) have no create/update or approve actions
- [ ] Second-approval operations (restore) are explicitly flagged with confirmation requirements
- [ ] 21 surfaces × 5 nav groups cross-references match screen-inventory §9 binding table
