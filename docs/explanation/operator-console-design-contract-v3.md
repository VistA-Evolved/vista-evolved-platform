# Operator Console Design Contract v3

> **DESIGN TARGET (2026-03-22):** This is a design specification, not implementation status. The copilot subsystem has been removed from the current codebase.

> **Status:** Canonical — supersedes design-contract-v2 for shell regions, badge system, and layout rules.
> **Date:** 2026-03-20.
> **Type:** Explanation — design contract for all operator console surfaces under the 8-domain model.
>
> **Supersedes:** `control-panel-design-contract-v2.md` (7-group shell).
> Retains all v2 principles that remain valid; updates IA grouping, adds Home-as-action-center,
> formalizes content-slot model, and aligns reject/ready checklists to the 8-domain model.
>
> **Upstream inputs:**
> - `operator-console-ux-ia-reset-and-journey-pack.md` — 8-domain model, personas, language rules
> - `operator-console-personas-jobs-and-service-map.md` — 12-job catalog, service binding
> - `operator-console-page-priority-and-content-model.md` — P0/P1/P2 tiers, per-domain content
> - `control-plane-service-map-and-operator-console-architecture.md` — service domains, state families
> - `control-panel-page-specs-v2.md` — surface-level field specs (carried forward)
> - `control-panel-action-semantics-v2.md` — action matrix (carried forward)
>
> **Downstream consumers:**
> - Shell implementation (`apps/control-plane/public/index.html`, `app.js`, `styles.css`)
> - Screen-contract instances (`packages/contracts/schemas/`)
> - QA reviewers, design hand-off (Figma Make / Stitch)

---

## 1. Scope

This contract defines:

- Shell anatomy (regions every surface inherits)
- Left-nav rules (8-domain model)
- Page header rules
- Filter/summary rail rules (list surfaces)
- Context rail rules (detail surfaces)
- Home-as-action-center layout
- Source-posture badge system
- State-badge system
- Stale-data signaling
- Empty / error / loading state rules
- Copy and language rules
- Per-surface reject/ready checklists (updated for 8-domain model)
- Review-runtime banner rules

This contract does **not** define:

- API contracts (see OpenAPI/AsyncAPI specs in `packages/contracts/`)
- Data schemas (see JSON Schema in `packages/contracts/schemas/`)
- Wire-level sourcing mechanics (see `app.js` implementation)
- Persona or job definitions (see personas-jobs doc)
- Content model field inventory (see shell-content-model doc)

---

## 2. Shell Anatomy

Every page in the operator console inherits a fixed shell with these regions:

```
┌─────────────────────────────────────────────────────────────────────┐
│  REVIEW BANNER  (always visible, not dismissible)                   │
├──────────┬──────────────────────────────────────────────────────────┤
│          │  PAGE HEADER                                             │
│  LEFT    │  ─────────────────────────────────────────────────────── │
│  NAV     │  CONTENT AREA (surface-specific)                        │
│          │    ┌──────────────────────────────┬────────────────────┐ │
│  8 domain│    │  PRIMARY REGION              │  CONTEXT RAIL      │ │
│  groups  │    │  (table / card grid / form)  │  (detail only)     │ │
│          │    │                              │                    │ │
│          │    └──────────────────────────────┴────────────────────┘ │
│          │  ─────────────────────────────────────────────────────── │
│          │  STATUS BAR  (optional — copilot drawer trigger)        │
├──────────┴──────────────────────────────────────────────────────────┤
│  COPILOT DRAWER  (collapsed by default)                             │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.1 Region Inventory

| Region | Present on | Purpose |
|--------|-----------|---------|
| Review Banner | Every page | "LOCAL REVIEW RUNTIME — no remote execution, no persistence" |
| Left Nav | Every page | 8-domain navigation, domain group labels, surface links, role badge |
| Page Header | Every page | Domain breadcrumb, surface title, posture badge, subtitle, refresh, timestamp |
| Filter/Summary Rail | List surfaces | Status filter, entity filter, search, result count |
| Primary Region | Every page | Surface-specific content (tables, cards, forms, timeline) |
| Context Rail | Detail surfaces | Entity identity, status badge, available actions, navigation links |
| Status Bar | Every page | Role indicator, copilot drawer toggle |
| Copilot Drawer | Every page (collapsed) | AI-assist overlay — read-only analysis, never write |

### 2.2 Region Nesting Rules

1. Review Banner is **above** the nav/content split. It spans full width.
2. Left Nav is a fixed-width column (220px). Never collapses on desktop.
3. Page Header is the first child of the content column. Always rendered.
4. Filter/Summary Rail appears **between** Page Header and Primary Region on list surfaces.
5. Context Rail appears **beside** Primary Region on detail surfaces (right side, 280px).
6. Copilot Drawer slides up from bottom, overlaying Status Bar area.

---

## 3. Left-Nav Rules

### 3.1 Eight Domain Groups

The left nav displays exactly 8 domain groups in this order:

| # | Domain group label | Surface links |
|---|-------------------|---------------|
| 1 | **Home** | Home |
| 2 | **Requests & Onboarding** | Bootstrap Requests, Provisioning Runs, Identity & Invitations |
| 3 | **Tenants** | Tenant Registry, Tenant Detail† |
| 4 | **Operations** | Operations Center, Alert Center, Backup & DR, Environments & Flags |
| 5 | **Support** | Support Console |
| 6 | **Commercial** | Billing & Entitlements, Usage & Metering |
| 7 | **Catalogs & Governance** | Market Management, Market Detail†, Pack Catalog, Payer Readiness, Eligibility Simulator |
| 8 | **Platform** | System Configuration, Audit Trail, Templates & Presets, Runbooks Hub |

† Detail surfaces are drill targets, not primary nav links. They appear in the nav
as a nested item only when the operator is actively viewing them (breadcrumb-aware highlighting).

### 3.2 Nav Rendering Rules

1. Domain group labels are uppercase, non-clickable dividers.
2. Surface links are indented under their domain group.
3. Active surface is highlighted with left-border accent.
4. Domain groups with zero visible surfaces for the current role are **hidden entirely** (not greyed).
5. Home is always first. It has no group divider label — it appears as a standalone link above the first divider.
6. Runbooks Hub link appears at bottom of Platform group, not as a separate sidebar item.
7. Role badge appears at bottom of nav: `[Role: Platform Operator]` or `[Role: Governance Lead]`.
8. Nav links use display labels from §8 Language Rules (e.g., "Onboarding Requests" not "Bootstrap Requests" in nav).

### 3.3 Nav State Indicators

| Indicator | Meaning | Visual |
|-----------|---------|--------|
| Count badge | Pending-work count for this surface | Numeric pill (e.g., "3") on the nav link — P0 surfaces only |
| Dot indicator | Unresolved items exist | Small dot — P1 surfaces |
| No indicator | No pending work or P2 surface | Clean link |

Count badges are driven by Home aggregation data. If Home data is unavailable, badges are hidden (not zero).

---

## 4. Page Header Rules

Every surface renders a page header with this structure:

```
┌──────────────────────────────────────────────────────────────────┐
│  [Domain Group] › [Surface Title]               [Source Badge]   │
│  [Subtitle: operator question]                                   │
│  ────────────────────────────────────────────────────────────── │
│  [Breadcrumb]  [View as: Role ▼]     [⟳ Refresh]  [Last: HH:MM] │
└──────────────────────────────────────────────────────────────────┘
```

### 4.1 Header Field Rules

| Field | Rule |
|-------|------|
| Domain Group | First breadcrumb segment. Matches nav group label. |
| Surface Title | Matches `title` field in screen-contract or nav display label. |
| Source Badge | Current data-source posture for this surface (see §7). |
| Subtitle | The operator question this surface answers (from page-specs-v2 or content model). |
| Breadcrumb | Domain Group › Surface Title. Detail surfaces add entity ID as third segment. |
| Role selector | "View as:" dropdown for role switching (review runtime only). |
| Refresh button | Present on every non-static surface. Triggers re-fetch. |
| Timestamp | ISO 8601, operator-local timezone. Shows when data was last fetched. |

### 4.2 Header Consistency Rules

1. All 7 fields are present on every surface (static surfaces show "Static" badge and omit refresh/timestamp).
2. Subtitle never empty — if page-specs-v2 doesn't define an operator question, use the domain's operator question from §3.1 of the IA reset doc.
3. Breadcrumb segments are navigable links (except the current segment, which is plain text).
4. Timestamp updates on every successful fetch. On fetch failure, timestamp holds last successful value and turns amber.

---

## 5. Filter and Summary Rail (List Surfaces)

```
┌──────────────────────────────────────────────────────────────────┐
│  [Status ▼]  [Entity ▼]  [Search ____________]  [⟳]            │
│  Showing X of Y results                              [< 1 2 >]  │
└──────────────────────────────────────────────────────────────────┘
```

### 5.1 Filter Rail Rules

| Rule | Spec |
|------|------|
| Status filter | Matches status enum for the entity type (lifecycle states from §9). |
| Entity filter | Surface-specific secondary filter (e.g., market filter on tenants, severity on alerts). |
| Search | Client-side text input. Debounce 300ms. |
| Result count | Always visible: "Showing X of Y". Y from total; X from visible after filter. |
| Pagination | Appears below table when `totalItems > pageSize`. Page size default: 25. |
| Filter reset | Filtering resets pagination to page 1. |
| URL state | Filter state preserved in URL hash for browser back/forward. |
| Empty filter result | "No {entity_plural} match the current filters." — not empty-state, which is different (see §11). |

### 5.2 Surfaces That Use Filter Rail

All list surfaces: Bootstrap Requests, Provisioning Runs, Tenant Registry, Alert Center,
Support Console, Billing & Entitlements, Usage & Metering, Market Management, Pack Catalog,
Payer Readiness, Audit Trail, Templates & Presets.

Home and Operations Center use a **card grid** instead — no filter rail.

---

## 6. Context Rail (Detail Surfaces)

```
┌──────────────────────────────┐
│  CONTEXT                     │
│  Entity ID: xxxxxxxx         │
│  Status: [badge]             │
│  Created: YYYY-MM-DD         │
│  Market: [name]              │
│  ─────────────────────────── │
│  ACTIONS                     │
│  [Approve] [review-only]     │
│  [Reject]  [review-only]     │
│  [Suspend] [integration-     │
│             pending]         │
│  ─────────────────────────── │
│  NAVIGATION                  │
│  ← Back to [parent list]     │
│  → [Related surface]         │
│  → [Related surface]         │
└──────────────────────────────┘
```

### 6.1 Context Rail Rules

| Rule | Spec |
|------|------|
| Entity identity | Top fields: ID, name, type — always visible. |
| Status badge | Uses state-badge system (§9). |
| Key metadata | Surface-specific: created date, market, environment, etc. |
| Actions section | Lists all applicable actions with posture badge per action. |
| Navigation section | Backward link to parent list. Forward links to related drill targets. |
| Cross-domain links | Links to surfaces in other domains labeled with target domain name. |
| Action confirmation | Write actions require explicit confirmation dialog (review-runtime: simulation dialog). |

### 6.2 Surfaces That Use Context Rail

All detail surfaces: Tenant Detail, Market Detail, and any surface reached via drill-down
from a list (request detail, provisioning step detail, case detail, etc.).

---

## 7. Source-Posture Badge System

### 7.1 Badge Definitions

| Badge label | Internal key | Color | Meaning |
|-------------|-------------|-------|---------|
| **Live** | `real-backend` | Green pill | Data from PG-backed real API |
| **Fixture** | `fixture-fallback` | Amber pill | Backend unreachable, loaded from fixture files |
| **Contract** | `contract-backed` | Blue pill | Loaded from contract artifacts at startup |
| **Static** | `static` | Gray pill | No data source — IA structure only |

### 7.2 Badge Placement Rules

1. Source badge appears in page header of every surface — right-aligned, same row as title.
2. For mixed-source surfaces, badge shows the actual source of the **last fetch** (not the theoretical best case).
3. Source badges are **never hidden** from the operator. This is part of honest posture.
4. Backend state change (reachable → unreachable) updates badge on next data fetch without page reload.
5. On Home, each action card shows its own source badge (aggregated from the source surface).

### 7.3 Implementation Posture Badges (Action-Level)

These appear on individual action buttons, not in the page header:

| Badge label | Internal key | Color | Meaning |
|-------------|-------------|-------|---------|
| *(no badge)* | `contract-backed` | — | Action wired to real API — default rendering |
| **Review Only** | `review-only` | Amber filled | Write simulated locally, no persistence |
| **Pending** | `integration-pending` | Red outlined | Data source contracted but not yet wired |
| **Contracted** | `action-contracted` | Gray filled | Action specified in contract but API route unavailable |

### 7.4 Forbidden Posture Labels

Never use: "coming soon", "beta", "preview", "under construction", "placeholder", "N/A", "TBD".

---

## 8. Language and Copy Rules

### 8.1 Product Language (User-Facing)

| Instead of (architecture) | Say (product) |
|--------------------------|---------------|
| Bootstrap Request | Onboarding Request |
| Provisioning Run | Setup Progress / Provisioning |
| Legal Market Profile | Market / Market Profile |
| Pack Manifest | Module / Pack |
| Effective Configuration Plan | Tenant Configuration / Resolved Configuration |
| Composition Engine | *(never user-facing)* |
| Eligibility Resolution | Eligibility Check / Pack Eligibility |
| Capability Truth | Readiness / Capability Status |
| Claim Gating | Readiness Requirements |
| Fleet health | Platform Health / Environment Health |
| DFN, IEN, RPC | *(never user-facing)* |

### 8.2 Copy Constraints

1. No raw internal IDs without a label (display "Tenant ID: abc123", not just "abc123").
2. No RPC names, VistA file numbers, or MUMPS references in any user-visible text.
3. No TODO / FIXME / implementation-pending in user-visible text.
4. State labels use human terms: Active, Suspended, Archived, Draft, Pending Review, In Progress, Completed, Failed, Cancelled.
5. Source badges use operator-friendly terms: "Live", "Fixture", "Contract", "Static".
6. Empty states explain what would appear and suggest the next safe action.

### 8.3 Review Runtime Wording

The text **"LOCAL REVIEW RUNTIME — no remote execution, no persistence"** appears in:

- Review Banner (always visible, not dismissible)
- Page header subtitle area — appended after the operator question
- Write action confirmation dialogs

---

## 9. State-Badge System

### 9.1 Badge Color Rules

| Color | Used for | Never used for |
|-------|---------|----------------|
| **Green** | Active, Completed, Healthy, Published, Verified | Draft, Pending, Static |
| **Yellow / Amber** | Pending Review, In Progress, Degraded, Warning, Declared, Specified | Completed, Active |
| **Red** | Failed, Suspended, Critical, Unreachable | Draft, Active |
| **Gray** | Draft, Archived, Static, Deferred, Deprecated, Retired, Cancelled | Active, Healthy |
| **Blue** | Queued, Info, Under Review | Active, Failed |
| **Blue pulsing** | Provisioning in flight, rolling-back | Completed, Static |

### 9.2 State Families

| Family | States | Surfaces |
|--------|--------|----------|
| Tenant lifecycle | draft, active, suspended, archived | Tenant Registry, Tenant Detail, Home |
| Bootstrap lifecycle | draft, submitted, under-review, approved, rejected | Bootstrap Requests |
| Provisioning lifecycle | queued, in-progress, completed, failed, cancelled, rolling-back | Provisioning Runs |
| Market lifecycle | draft, under-review, active, deprecated | Market Management, Market Detail |
| Pack lifecycle | draft, under-review, published, deprecated, retired | Pack Catalog |
| Alert severity | info, warning, critical | Alert Center, Operations Center, Home |
| Environment health | healthy, degraded, unreachable, maintenance | Operations Center, Environments & Flags |
| Case status | open, in-progress, escalated, resolved | Support Console |
| Readiness (9-state) | declared, specified, implemented, validated, verified, claimable, production-eligible, deprecated, retired | Payer Readiness, Pack Catalog |

### 9.3 Badge Rendering Spec

- Shape: rounded pill (`border-radius: 12px`, `padding: 2px 10px`).
- Font: system monospace for status text, 12px.
- Background: color from §9.1 at 15% opacity. Border: same color at 60% opacity.
- Pulsing: CSS `@keyframes pulse` for in-flight states (blue pulsing).
- No icons inside badges — text-only.

---

## 10. Stale-Data Signaling

| Condition | Visual | Threshold |
|-----------|--------|-----------|
| Fresh | Timestamp in default color | < 5 minutes since last fetch |
| Warning | Timestamp turns amber | 5–30 minutes since last fetch |
| Critical | Timestamp turns red + "Data may be stale — refresh recommended" | > 30 minutes since last fetch |
| Refresh failure | Preserve stale data, show inline error, timestamp holds last success value | Any fetch error |

### 10.1 Signaling Rules

1. Every non-static surface tracks data freshness.
2. Auto-refresh: event-driven surfaces update on event; polling surfaces poll per contract.
3. Manual refresh: every non-static surface has a visible refresh button.
4. On refresh failure, previously loaded data is preserved — never cleared.
5. Static surfaces show no timestamp and no refresh button.

---

## 11. Empty, Error, and Loading State Rules

### 11.1 Empty States

| Context | Display |
|---------|---------|
| List / table with no data | "No {entity_plural} found." + next-safe-action suggestion |
| Filtered list with no matches | "No {entity_plural} match the current filters." |
| Detail section with no data | "No {detail_name} available." |
| Integration-pending region | "{Region_name}: integration-pending — requires [{dependency}]" |

### 11.2 Error States

1. Errors display inline in the affected region — never a global modal.
2. Previously loaded data is preserved (no clear-on-failure).
3. Retry affordance always present (refresh button stays functional).
4. Error message includes the machine-readable error code from API `ErrorResponse` schema.
5. Error visual is distinct from loaded state (red border or inline alert bar).

### 11.3 Loading States

1. List surfaces: skeleton/placeholder rows during initial load.
2. Detail surfaces: skeleton placeholders for each region.
3. Action buttons: disabled during execution; re-enabled on completion/failure.
4. Loading never indefinite — timeout at 10 seconds, then show error state.
5. Skeleton rows match the column structure of the target table.

---

## 12. Home-as-Action-Center Layout

Home uses a **distinct layout** — card grid, not filter-rail + table.

```
┌──────────────────────────────────────────────────────────────────┐
│  PAGE HEADER: Home | "What needs my attention right now?"        │
├──────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Pending Requests │  │ Active Provisi- │  │ Recent Alerts   │  │
│  │ [3]              │  │ oning  [1]      │  │ [2 unresolved]  │  │
│  │ Review 3 pending │  │ 1 in progress   │  │ 1 critical      │  │
│  │ requests →       │  │ View details →  │  │ View alerts →   │  │
│  │ [Source: Live]   │  │ [Source: Live]   │  │ [Source: Static]│  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│  ┌─────────────────┐  ┌─────────────────┐                       │
│  │ Tenant Summary  │  │ Next Actions    │                       │
│  │ 12 active       │  │ • Review 3 req  │                       │
│  │ 1 suspended     │  │ • Check failed  │                       │
│  │ 0 provisioning  │  │   provisioning  │                       │
│  │ View tenants →  │  │ • View alerts   │                       │
│  │ [Source: Live]   │  │                 │                       │
│  └─────────────────┘  └─────────────────┘                       │
└──────────────────────────────────────────────────────────────────┘
```

### 12.1 Home Card Rules

| Rule | Spec |
|------|------|
| Card types | Pending Requests, Active Provisioning, Recent Alerts, Tenant Summary, Next Actions |
| Card content | Count + summary + drill link + source badge |
| Card source | Each card has its own source badge (may differ per card) |
| Empty card | Shows "None" + "(all clear)" — not hidden |
| Failed fetch card | Shows last-known value (amber) or "Unavailable" (red) |
| Card order | Fixed: Requests, Provisioning, Alerts, Tenants, Next Actions |
| Click behavior | Drill link navigates to the relevant domain surface |

### 12.2 What Never Appears on Home

- Pack readiness scores or capability truth percentages
- Market composition details or eligibility simulation
- Raw audit event streams
- System configuration parameters
- Architecture diagrams or service-domain maps
- KPIs not backed by real data source

---

## 13. Per-Surface Reject/Ready Checklists

Each surface has a checklist that a reviewer uses to assess conformance.
Surfaces not listed here carry forward their v2 checklist unchanged.

### 13.1 Home (`control-plane.home`)

| Gate | Ready | Reject |
|------|-------|--------|
| Card grid | 5 cards rendered in fixed order | Cards missing or reordered |
| Pending counts | Counts reflect real or honestly-badged source | Counts fabricated or show zero without source badge |
| Drill links | Each card navigates to correct domain surface | Broken links or wrong target |
| Source badges | Per-card source badge visible | Any card missing source badge |
| Empty state | "None (all clear)" for zero-count cards | Card hidden when count is zero |
| Forbidden content | No pack readiness, capability truth, resolver stats | Architecture metrics visible on Home |

### 13.2 Bootstrap Requests (`control-plane.tenants.bootstrap`)

Carried forward from v2 — now lives in **Requests & Onboarding** domain.
No content change to checklist; domain assignment changes only.

### 13.3 Provisioning Runs (`control-plane.provisioning.runs`)

Carried forward from v2 — now lives in **Requests & Onboarding** domain.

### 13.4 Identity & Invitations (`control-plane.identity.invitations`)

Carried forward from v2 — now lives in **Requests & Onboarding** domain.

### 13.5 Support Console (`control-plane.platform.support`)

Carried forward from v2 — now lives in **Support** domain (promoted).

### 13.6 Operations Center (`control-plane.operations.center`)

| Gate | Ready | Reject |
|------|-------|--------|
| Domain assignment | Renders inside Operations domain | Renders as standalone "Overview" |
| Health cards | Environment health summary cards visible | No health cards or fabricated health |
| Alert summary | Alert severity breakdown visible | Alert data fabricated |
| Source badges | Health + alert badges show actual source | Source badges hidden |
| Drill links | Cards drill to correct Operations sub-surfaces | Dead links |

### 13.7 Catalogs & Governance Surfaces

All surfaces carried forward from v2 (Markets & Readiness group) — domain label changes only.
Market Management, Market Detail, Pack Catalog, Payer Readiness, Eligibility Simulator
all retain their v2 checklists. They now render under **Catalogs & Governance** domain.

### 13.8 All Other Surfaces

Tenant Registry, Tenant Detail, Alert Center, Backup & DR, Environments & Flags,
Billing & Entitlements, Usage & Metering, System Configuration, Audit Trail,
Templates & Presets, Runbooks Hub — all retain their v2 checklists with no content change.
Domain assignment updates per §3.1.

---

## 14. Review Checklist — Entire Operator Console (v3)

| # | Gate | Pass criteria |
|---|------|--------------|
| 1 | 8-domain left nav | Exactly 8 domain groups in correct order |
| 2 | Home as action center | Card grid layout, not metrics dashboard |
| 3 | 22 surfaces rendered | All surfaces accessible (21 from v2 + Home) |
| 4 | Page header on every surface | Domain, title, posture badge, subtitle, breadcrumb, timestamp |
| 5 | Filter rail on all list surfaces | Status + entity + search + count + pagination |
| 6 | Context rail on all detail surfaces | Entity identity + status + actions + navigation |
| 7 | Source badges visible everywhere | No surface without a source badge in header |
| 8 | State badges consistent | All status values use correct color from §9 |
| 9 | Stale-data signaling active | Timestamp + amber/red thresholds on non-static surfaces |
| 10 | Empty/error/loading handled | All three states implemented per §11 |
| 11 | Language rules followed | No architecture vocabulary in UI (§8) |
| 12 | Review banner visible | "LOCAL REVIEW RUNTIME" text always present |
| 13 | No fabricated data | No fake KPIs, counts, or timestamps |
| 14 | Role-based nav filtering | Hidden domains for non-applicable roles |
| 15 | Honest posture throughout | No "coming soon", no "beta", no silent no-ops |

---

## 15. Versioning and Supersession

| Version | Document | Status |
|---------|----------|--------|
| v1 (batch-1) | `control-panel-design-contract-and-static-review-prototype-batch-1.md` | Superseded — retained as field-spec reference |
| v2 | `control-panel-design-contract-v2.md` | Superseded by this doc for shell/layout/badge rules; per-surface field specs carried forward |
| **v3** | **This document** | **Canonical** — shell regions, 8-domain nav, badge systems, layout rules |

See `docs/reference/source-of-truth-index.md` for the official registry.
