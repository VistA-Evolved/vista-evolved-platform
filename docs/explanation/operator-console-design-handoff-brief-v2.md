# Operator Console — Design Handoff Brief v2

> **Artifact type:** Explanation / design handoff — NOT implementation authorization.
> **Repo:** `vista-evolved-platform`
> **Date:** 2026-03-22
> **Status:** Draft — pending human review.
> **Scope:** Full design brief for the 22-surface operator console under the 8-domain model.
> Figma Make primary brief, Stitch secondary brief, design tokens, component specs,
> and review/rejection criteria.
> **Supersedes:** `control-plane-bootstrap-design-handoff-brief.md` (v1, bootstrap-scoped, 8 screens).
> **Does NOT:** Produce final designs, authorize code, create screen-contract instances.

---

## 1. Purpose

This document provides the information a designer (human or AI-assisted) needs to produce
visual designs for the **entire operator console** — all 22 surfaces across 8 domains.

It replaces the v1 handoff brief which scoped only 8 bootstrap screens under the old IA.
This v2 aligns with the 8-domain model, shell anatomy, content-slot registry, badge systems,
and persona model established in Tasks 1–4 of the UX/IA Reset.

### 1.1 Position in handoff chain

| Predecessor | What it provides |
|-------------|-----------------|
| UX/IA reset and journey pack | 8-domain model, migration map, Home-as-action-center rules |
| Personas, jobs, and service map | 2 personas (Operator, Governance Lead), 12-job catalog |
| Page priority and content model | P0/P1/P2 tiers, per-domain content rules |
| Design contract v3 | Shell anatomy, region rules, badge systems, state families |
| Shell content model | Per-surface content slots, drill map, validation rules |
| Shell rewrite (Task 4) | Live runtime: 8-domain nav, renderHome, CSS tokens |

This document is the **terminal artifact** in the planning sequence. Its output feeds
into the design phase (outside this repo).

### 1.2 Audience

| Audience | Use case |
|----------|----------|
| **Primary:** Designer (human) | Produce screen mockups in Figma (or equivalent) |
| **Secondary:** AI design tools | Figma Make, v0, Vercel AI — accept structured briefs |
| **Tertiary:** Implementation engineers | Code the operator console surfaces |
| **QA reviewers** | Verify designs against acceptance criteria before hand-off |

---

## 2. Design scope — what to produce

### 2.1 Shell (required before any surface)

| # | Deliverable | Source reference |
|---|-------------|-----------------|
| S1 | Full shell layout (review banner + left nav + content area + status bar) | Design contract v3 §2 |
| S2 | 8-domain left nav with domain dividers, surface links, count badges | Design contract v3 §3 |
| S3 | Page header template (domain, title, subtitle, source badge, breadcrumb, refresh, timestamp) | Design contract v3 §4 |
| S4 | Filter + summary rail template (for list surfaces) | Design contract v3 §5 |
| S5 | Context rail template (for detail surfaces) | Design contract v3 §6 |

### 2.2 Surfaces to design

| # | Surface | Domain | Tier | Layout type | Source |
|---|---------|--------|------|-------------|--------|
| 1 | Home | Home | P0 | Card grid | Content model §3.1 |
| 2 | Bootstrap Requests | Requests & Onboarding | P0 | List + filter | Content model §3.2 |
| 3 | Provisioning Runs | Requests & Onboarding | P0 | List + filter | Content model §3.3 |
| 4 | Identity & Invitations | Requests & Onboarding | P2 | List + filter | Content model §3.4 |
| 5 | Tenant Registry | Tenants | P0 | List + filter | Content model §3.5 |
| 6 | Tenant Detail | Tenants | P0 | Detail + context | Content model §3.6 |
| 7 | Operations Center | Operations | P1 | Card grid | Content model §3.7 |
| 8 | Alert Center | Operations | P1 | List + filter | Content model §3.8 |
| 9 | Backup & DR | Operations | P2 | Detail + context | Content model §3.9 |
| 10 | Environments & Flags | Operations | P2 | List + filter | Content model §3.10 |
| 11 | Support Console | Support | P1 | List + filter | Content model §3.11 |
| 12 | Billing & Entitlements | Commercial | P1 | List + filter | Content model §3.12 |
| 13 | Usage & Metering | Commercial | P2 | List + filter | Content model §3.13 |
| 14 | Market Management | Catalogs & Governance | P2 | List + filter | Content model §3.14 |
| 15 | Market Detail | Catalogs & Governance | P2 | Detail + context | Content model §3.15 |
| 16 | Pack Catalog | Catalogs & Governance | P2 | List + filter | Content model §3.16 |
| 17 | Payer Readiness | Catalogs & Governance | P2 | List + filter | Content model §3.17 |
| 18 | Eligibility Simulator | Catalogs & Governance | P2 | Form + result | Content model §3.18 |
| 19 | System Configuration | Platform | P2 | List + filter | Content model §3.19 |
| 20 | Audit Trail | Platform | P2 | List + filter | Content model §3.20 |
| 21 | Templates & Presets | Platform | P2 | List + filter | Content model §3.21 |
| 22 | Runbooks Hub | Platform | P2 | List + search | Content model §3.22 |

### 2.3 States to cover per surface

Each surface design must include all 4 states:

| State | Description |
|-------|-------------|
| Default (populated) | Normal state with representative data |
| Empty state | No data yet — message + next-safe-action (per design contract v3 §11) |
| Loading | Skeleton rows matching column structure, 10s timeout to error |
| Error | Inline error bar (red border), preserve stale data, retry affordance |

### 2.4 Priority sequencing

Design deliverables should be produced in tier order:

1. **Shell (S1–S5)** — all surfaces depend on the shell.
2. **P0 surfaces (1, 2, 3, 5, 6)** — daily operator essentials.
3. **P1 surfaces (7, 8, 11, 12)** — routine operations.
4. **P2 surfaces (4, 9, 10, 13–22)** — specialized/governance.

### 2.5 Not in scope

- Tenant-admin workspace screens (separate design brief)
- Clinical workspace screens (separate design system)
- Patient-portal screens (separate design system)
- Login/authentication screens (separate flow)
- Mobile or responsive breakpoints below 1024px

---

## 3. Persona context for designers

Designers need persona context to make correct layout, density, and copy decisions.

### 3.1 Primary persona: Platform Operator

- Works for the provider organization operating VistA Evolved
- Platform-wide scope — sees all tenants, markets, environments
- **Not** a clinician — never sees patient data
- **Not** a developer — uses the console, does not edit code
- Thinks in terms of **work to do**, not architecture domains
- Daily workflow: morning check-in → process pending items → monitor provisioning → triage alerts

### 3.2 Secondary persona: Governance Lead

- Senior operator who additionally handles market/pack governance
- Reviews draft market profiles and pack manifests (Catalogs & Governance domain)
- Manages feature flags and system parameters (Platform domain)
- Reviews audit trail for compliance investigations

### 3.3 Implications for design

| Principle | Design implication |
|-----------|-------------------|
| Operator thinks in jobs, not services | Nav labels are work-oriented (see §8.1) |
| Home answers "What needs attention?" | Card grid with counts, not metrics dashboard |
| Operator is comfortable with ops concepts | Dense tables are fine — not oversimplified |
| Operator is NOT a clinician | No clinical UI patterns (medication lists, flowsheets, etc.) |
| Governance Lead uses P2 surfaces rarely | P2 surfaces can be less polished but must be functional |

---

## 4. Design tokens — live runtime reference

The operator console has an existing CSS custom property system in `styles.css`.
Designs **must** align with these tokens. New tokens may be proposed but must not
conflict with existing values.

### 4.1 Color palette (from `:root`)

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#f8f9fa` | Page background |
| `--surface` | `#ffffff` | Card/panel background |
| `--border` | `#dee2e6` | Borders, dividers |
| `--text` | `#212529` | Primary text |
| `--text-muted` | `#6c757d` | Secondary text, labels |
| `--primary` | `#0d6efd` | Primary actions, active states |
| `--danger` | `#dc3545` | Errors, destructive actions |
| `--warning` | `#ffc107` | Warnings, pending states |
| `--success` | `#198754` | Healthy, completed, active |
| `--info` | `#0dcaf0` | Informational, provisioning |
| `--nav-bg` | `#1e293b` | Left nav background (dark slate) |
| `--nav-text` | `#e2e8f0` | Left nav text color |
| `--nav-active` | `#3b82f6` | Left nav active highlight |
| `--banner-bg` | `#fff3cd` | Review banner background |
| `--banner-border` | `#ffc107` | Review banner border |

### 4.2 Status badge tokens

| Token | Value | Used for |
|-------|-------|----------|
| `--badge-draft` | `#6c757d` (gray) | Draft state |
| `--badge-active` | `#198754` (green) | Active, healthy, completed |
| `--badge-pending` | `#ffc107` (amber) | Pending review, warning |
| `--badge-provisioning` | `#0dcaf0` (cyan) | Provisioning in-flight |
| `--badge-archived` | `#6c757d` (gray) | Archived state |
| `--badge-suspended` | `#dc3545` (red) | Suspended, error |
| `--badge-failed` | `#dc3545` (red) | Failed state |
| `--badge-completed` | `#198754` (green) | Completed state |
| `--badge-queued` | `#6c757d` (gray) | Queued state |
| `--badge-in-progress` | `#0d6efd` (blue) | In-progress state |

### 4.3 Typography (from `body` rule)

| Element | Value |
|---------|-------|
| Font stack | `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` |
| Body text | 14px, `var(--text)` |
| Nav group headers | 14px, uppercase, `letter-spacing: 1px` |
| Section headers | 18–20px, semibold |
| Page titles | 20–24px, semibold |
| Badge text | 11–12px |
| Monospace (technical values) | System monospace, 12px |

### 4.4 Spacing

| Element | Value |
|---------|-------|
| Base grid unit | 8px |
| Nav sidebar width | 220px |
| Nav link padding | `8px 16px` |
| Card padding | `16px` (content model cards), `20px` (home cards) |
| Table row height | 40–48px |
| Content area min-width | ~804px (1024 − 220 nav) |
| Content area padding | `24px` |

### 4.5 Iconography

| Use | Style | Examples |
|-----|-------|---------|
| Nav domain icons | Emoji glyphs (current runtime) | 🏠 Home, 📋 Requests, 🏢 Tenants, ⚙️ Operations, 🎧 Support, 💰 Commercial, 📦 Catalogs, 🔧 Platform |
| Status indicators | Filled circle (●) active, half-fill (◐) partial, empty (○) inactive | In badge pill |
| Actions | Plus (+) create, ⋯ row menu, → navigation, ⟳ refresh | In buttons and links |
| Nav count badges | Numeric pill on P0 nav links | e.g., "3" next to Bootstrap Requests |
| Source posture | Colored pill text (Live/Fixture/Contract/Static) | In page header |

> **Note for production designs:** If migrating from emoji to proper line icons, use a
> single icon family (e.g., Lucide, Heroicons). Do not mix icon families. The emoji
> system is the baseline for the review runtime; production design may replace them.

---

## 5. Shell anatomy specification

The overall shell layout (from design contract v3 §2):

```
┌──────────────────────────────────────────────────────────────────────────┐
│  REVIEW BANNER — "LOCAL REVIEW RUNTIME — no remote, no persistence"     │
├────────────┬─────────────────────────────────────────────────────────────┤
│            │  PAGE HEADER                                                │
│            │  [Domain] > [Surface Title]        [Source Badge]           │
│            │  [Subtitle: operator question]                              │
│            │  [Breadcrumb]  [View as: Role]     [Refresh]  [Last: HH:MM]│
│  LEFT NAV  ├─────────────────────────────────────────────────────────────┤
│            │                                                             │
│  8 domain  │  PRIMARY REGION                                            │
│  groups    │  (Card grid, List+filter, Detail+context, or Form+result)  │
│            │                                                             │
│  22 links  │                                                             │
│            │                                                             │
│            │                                                             │
├────────────┴─────────────────────────────────────────────────────────────┤
│  STATUS BAR — surface count, domain count, runtime posture              │
└──────────────────────────────────────────────────────────────────────────┘
```

### 5.1 Region-specific design notes

| Region | Design notes for Figma |
|--------|----------------------|
| **Review Banner** | Full-width, amber `--banner-bg`, not dismissible. Text: `--text`. 2px bottom border `--banner-border`. |
| **Left Nav** | Dark background `--nav-bg`. 220px fixed width. Domain group labels: 14px uppercase, non-clickable. Surface links: 14px, `--nav-text`, hover → `--nav-active`. Active link: left-border accent `--nav-active` 3px. Home is standalone above first divider. |
| **Page Header** | White surface card. Domain > Title as breadcrumb. Source badge right-aligned. Subtitle on second line in `--text-muted`. Refresh button and timestamp on third line. |
| **Primary Region** | Background `--bg`. Contains the surface-specific layout (card grid OR list+filter OR detail+context OR form+result). |
| **Status Bar** | Bottom bar, `--bg` background. Shows: "22 surfaces, 8 domains — Review Runtime v{X}". |

### 5.2 Four layout patterns

The designer must create **one Figma component variant** for each pattern:

| Pattern | Used by | Key elements |
|---------|---------|-------------|
| **Card grid** | Home, Operations Center | 3-column card grid, each card has: title, count/summary, description, source badge, drill link |
| **List + filter** | 16 list surfaces | Filter rail (status dropdown, entity dropdown, search, count, pagination) + table with sortable columns |
| **Detail + context** | Tenant Detail, Market Detail, Backup & DR | Context rail (right side: identity, status, actions, navigation) + primary content area (left side) |
| **Form + result** | Eligibility Simulator | Input form (dropdowns, toggles, text) + result panel (resolution output, deferred items, badges) |

---

## 6. Source-posture badge system

Designs must include the following badge variations (from design contract v3 §7):

### 6.1 Page-level source badges

| Badge | Color | Shape | Meaning |
|-------|-------|-------|---------|
| **Live** | Green pill (`--success` bg at 15%, border at 60%) | Rounded pill | Real PG-backed API data |
| **Fixture** | Amber pill (`--warning` bg at 15%) | Rounded pill | Backend unreachable, fixture fallback |
| **Contract** | Blue pill (`--primary` bg at 15%) | Rounded pill | Loaded from contract artifacts |
| **Static** | Gray pill (`--badge-draft` bg at 15%) | Rounded pill | No data source, IA structure only |

### 6.2 Action-level posture badges

| Badge | Color | Meaning |
|-------|-------|---------|
| *(no badge)* | — | Action wired to real API (default) |
| **Review Only** | Amber filled | Write simulated locally, no persistence |
| **Pending** | Red outlined | Data source contracted but not yet wired |
| **Contracted** | Gray filled | Action specified in contract, API route unavailable |

### 6.3 Forbidden labels

Never use in designs: "Coming soon", "Beta", "Preview", "Under construction", "Placeholder", "N/A", "TBD".

---

## 7. State-badge system

All lifecycle state values use consistent color mapping (from design contract v3 §9):

### 7.1 Color rules

| Color | Used for |
|-------|---------|
| Green | Active, Completed, Healthy, Published, Verified |
| Amber | Pending Review, In Progress, Degraded, Warning, Declared, Specified |
| Red | Failed, Suspended, Critical, Unreachable |
| Gray | Draft, Archived, Static, Deferred, Deprecated, Retired, Cancelled |
| Blue | Queued, Info, Under Review |
| Blue pulsing | Provisioning in-flight, rolling-back |

### 7.2 Badge rendering spec

- Shape: rounded pill (`border-radius: 12px`, `padding: 2px 10px`)
- Font: 12px monospace
- Background: color at 15% opacity
- Border: same color at 60% opacity
- Pulsing: CSS `@keyframes pulse` for in-flight states
- Text-only — no icons inside badges

### 7.3 State families per domain

| Domain | State family | States |
|--------|-------------|--------|
| Tenants | Tenant lifecycle | draft, active, suspended, archived |
| Requests & Onboarding | Bootstrap lifecycle | draft, submitted, under-review, approved, rejected |
| Requests & Onboarding | Provisioning lifecycle | queued, in-progress, completed, failed, cancelled, rolling-back |
| Operations | Alert severity | info, warning, critical |
| Operations | Environment health | healthy, degraded, unreachable, maintenance |
| Support | Case status | open, in-progress, escalated, resolved |
| Catalogs & Governance | Market lifecycle | draft, under-review, active, deprecated |
| Catalogs & Governance | Pack lifecycle | draft, under-review, published, deprecated, retired |
| Catalogs & Governance | Readiness (9-state) | declared, specified, implemented, validated, verified, claimable, production-eligible, deprecated, retired |

---

## 8. Language and copy rules for design

### 8.1 Product language (user-facing labels)

| Architecture term (never show) | Product term (use in designs) |
|-------------------------------|------------------------------|
| Bootstrap Request | Onboarding Request |
| Provisioning Run | Setup Progress / Provisioning |
| Legal Market Profile | Market / Market Profile |
| Pack Manifest | Module / Pack |
| Effective Configuration Plan | Tenant Configuration |
| Composition Engine | *(never user-facing)* |
| Eligibility Resolution | Eligibility Check |
| Capability Truth | Readiness / Capability Status |
| Fleet health | Platform Health |
| DFN, IEN, RPC | *(never user-facing)* |

### 8.2 Page titles and subtitles (per surface)

| Surface | Title | Subtitle (operator question) |
|---------|-------|------------------------------|
| Home | Home | What needs my attention right now? |
| Bootstrap Requests | Onboarding Requests | What onboarding requests are pending and what is their status? |
| Provisioning Runs | Provisioning Runs | What is the status of each provisioning run? |
| Identity & Invitations | Identity & Invitations | Who has been invited and what is their access status? |
| Tenant Registry | Tenant Registry | What is the health and status of each tenant? |
| Tenant Detail | Tenant Detail — {Name} | What is the full profile and history of this tenant? |
| Operations Center | Operations Center | Is the platform healthy and are environments running? |
| Alert Center | Alert Center | Are there active alerts requiring attention? |
| Backup & DR | Backup & DR | What is the backup and disaster-recovery posture? |
| Environments & Flags | Environments & Feature Flags | What environments exist and what flags are active? |
| Support Console | Support Console | Are there open support cases or incidents? |
| Billing & Entitlements | Billing & Entitlements | What is the billing and usage posture? |
| Usage & Metering | Usage & Metering | How much are tenants using and are there overages? |
| Market Management | Market Management | What markets are defined and what is their readiness? |
| Market Detail | Market Detail — {Name} | What is the full profile and readiness of this market? |
| Pack Catalog | Pack Catalog | What packs are available and what is their lifecycle status? |
| Payer Readiness | Payer Readiness | What is the readiness status of payers in each market? |
| Eligibility Simulator | Eligibility Simulator | What would the resolved config be for this market + pack? |
| System Configuration | System Configuration | What are the current system-level configuration parameters? |
| Audit Trail | Audit Trail | What actions have been taken and by whom? |
| Templates & Presets | Templates & Presets | What templates are available for bootstrapping and configuration? |
| Runbooks Hub | Runbooks Hub | What operational runbooks are available? |

### 8.3 Copy constraints

1. No raw internal IDs without a label (display "Tenant ID: abc123", not just "abc123").
2. No RPC names, VistA file numbers, or MUMPS references in any user-visible text.
3. No TODO / FIXME / implementation-pending in user-visible text.
4. State labels use human terms: Active, Suspended, Archived, Draft, Pending Review, etc.
5. Source badges use operator-friendly terms: Live, Fixture, Contract, Static.
6. Empty states explain what would appear and suggest the next safe action.
7. "LOCAL REVIEW RUNTIME — no remote execution, no persistence" text in review banner.

---

## 9. Component design specifications

These components are the building blocks for all 22 surfaces. Each must be designed as
a reusable Figma component with variants.

### 9.1 RegistryTable (used by 16 list surfaces)

- Sortable columns (click header to sort, arrow indicator).
- Filter rail above table: status dropdown + entity dropdown + text search + result count.
- Row hover state with subtle `--bg` background.
- Row action menu (⋯) opens dropdown with 2–4 actions.
- Pagination bar below: "Showing X of Y" + page controls. Default page size 25.
- Empty state: centered message — "No {entity_plural} found." + next-safe-action.
- Error state: inline red alert bar above table, preserve stale data below.
- Loading state: skeleton rows matching column count and widths.

### 9.2 HomeCard (used by Home and Operations Center)

- Card with `--surface` background and `--border` border.
- Header: title (bold) + count pill (numeric, background from badge token family).
- Body: 1–2 line description/summary.
- Footer: source badge (per card) + drill link ("View details →").
- Size: flexible grid, 3 columns on wide viewport, 2 on narrower.
- Count pill alert state: `--badge-failed` background when count represents failures.
- Empty count: "None" with "(all clear)" — card is never hidden.

### 9.3 ContextRail (used by 3 detail surfaces)

- Right-side panel, ~300px width.
- Sections separated by horizontal rule:
  - **Identity:** Entity ID, name, type — always visible.
  - **Status:** State badge from appropriate lifecycle family.
  - **Actions:** List of action buttons, each with posture badge.
  - **Navigation:** ← Back link + → related surface links.
- Cross-domain navigation links labeled with target domain name.
- Action buttons: confirmation dialog for write actions.

### 9.4 FilterRail (used by 16 list surfaces)

- Horizontal bar above table content.
- Left side: status dropdown + entity-specific secondary dropdown + search text input.
- Right side: refresh button.
- Below: "Showing X of Y results" + pagination (when total > page size).
- Filter state preserved in URL hash.
- Search: client-side, 300ms debounce.

### 9.5 StatusBadge (used everywhere)

- Pill shape: `border-radius: 12px`, `padding: 2px 10px`.
- Background: state color at 15% opacity. Border: state color at 60%.
- Text: 12px monospace, state color at full.
- Sizes: small (inline in table cells), medium (in headers/cards).
- Pulsing variant for in-flight states (blue pulsing).

### 9.6 PageHeader (used on every surface)

- Full-width white bar.
- Row 1: `[Domain Group] › [Surface Title]` (breadcrumb) + `[Source Badge]` (right-aligned).
- Row 2: Subtitle in `--text-muted`.
- Row 3: Breadcrumb links + `[View as: Role ▼]` + `[⟳ Refresh]` + `[Last: HH:MM]`.
- Breadcrumb segments are links (except current = plain text).
- Timestamp: default color (< 5 min), amber (5–30 min), red (> 30 min).
- Static surfaces: no refresh button, no timestamp.

### 9.7 ReviewBanner (always visible)

- Full-width, above everything.
- Background: `--banner-bg` (#fff3cd). Border-bottom: 2px solid `--banner-border`.
- Text: "LOCAL REVIEW RUNTIME — no remote execution, no persistence".
- Font: 13px, `--text`.
- Not dismissible.

### 9.8 WizardFlow (used by Bootstrap Request creation)

- Step indicator at top: numbered circles connected by line.
- Active step: filled + bold. Completed: filled. Upcoming: outlined.
- One content section per step, vertically scrollable.
- Footer: `[Cancel]` (left), `[← Back]` + `[Next →]` (right). Final: `[Create]` replaces Next.
- Step content: form fields with labels above inputs. Validation errors inline below fields.

### 9.9 StaleDataIndicator (used on non-static surfaces)

- Part of PageHeader timestamp.
- Fresh (< 5 min): default text color.
- Warning (5–30 min): amber text.
- Critical (> 30 min): red text + "Data may be stale — refresh recommended".

---

## 10. Per-surface design notes

### 10.1 Home (P0, Card grid)

**Layout:** 5 cards in grid (3 + 2 rows).
**Cards:**
1. Pending Requests — count of bootstrap requests in pending/submitted/under-review state. Drill: `#bootstrap`.
2. Active Provisioning — count of runs in queued/in-progress/failed. Drill: `#provisioning`.
3. Recent Alerts — unresolved count + top severity. Drill: `#alerts`.
4. Tenant Summary — count by lifecycle state (active / suspended / draft). Drill: `#tenants`.
5. Next Actions — computed contextual action link list. Drill: various.

Each card has its own source badge. Page header has no single page-level source badge.
Home is read + navigate only — no write actions.

**What never appears on Home:**
Pack readiness scores, capability truth percentages, market composition details,
eligibility simulation results, raw audit streams, system config parameters,
architecture diagrams, KPIs not backed by real data.

### 10.2 Bootstrap Requests (P0, List + filter)

**Filter rail:** Status: pending, submitted, under-review, approved, rejected, all.
**Table columns:** Request ID, Tenant Name, Market, Status (badge), Submitted (date), Requested By.
**Row click:** Opens request detail (inline expansion or sub-route).
**Detail actions:** Approve → `review-only`, Reject with reason → `review-only`, Cancel → `review-only`.
**Cross-domain link:** View resulting provisioning run → Provisioning Runs.

### 10.3 Provisioning Runs (P0, List + filter)

**Filter rail:** Status: queued, in-progress, completed, failed, cancelled, rolling-back, all.
**Table columns:** Run ID, Tenant Name, Status (badge), Started (date), Steps (e.g., "3/7").
**Row click:** Opens step detail view.
**Detail actions:** Retry failed step → `review-only`, Cancel run → `review-only`, Rollback → `review-only`.
**Cross-domain link:** View resulting tenant → Tenant Detail.

### 10.4 Identity & Invitations (P2, List + filter)

**Filter rail:** Tenant filter, Status: invited, accepted, active, revoked, expired.
**Tables:** Active Identities (name, email, role, tenant, status), Pending Invitations (email, role, tenant, expires).
**Actions:** Invite user → `integration-pending`, Revoke → `integration-pending`, Resend → `integration-pending`.

### 10.5 Tenant Registry (P0, List + filter)

**Filter rail:** Status: draft, active, suspended, archived, all. Market filter. Search.
**Table columns:** Tenant ID, Name, Status (badge), Market, Created (date), Environment.
**Row click:** → Tenant Detail.
**Actions:** None on list — all on Tenant Detail.

### 10.6 Tenant Detail (P0, Detail + context)

**Context rail:** Identity (ID, name, legal entity, market), Status badge, Actions (Suspend/Reactivate/Archive with posture badges), Navigation (← Tenant Registry, → Provisioning, → Environment, → Billing, → Support).
**Primary content:** Config summary, Recent events timeline, Environment binding.
**Actions:** Suspend → `review-only` (if active), Reactivate → `review-only` (if suspended), Archive → `review-only` (terminal, requires confirmation).

### 10.7 Operations Center (P1, Card grid)

**Cards:** Environment Health (per-env health cards), Alert Summary (severity breakdown), Provisioning Health (active/failed counts), Backup Status (last timestamp, DR posture).
Each card has its own source badge. Read + navigate only.
**Drill targets:** Environments & Flags, Alert Center, Backup & DR.

### 10.8 Alert Center (P1, List + filter)

**Filter rail:** Severity: critical, high, medium, low. Status: active, acknowledged, resolved.
**Table columns:** Alert ID, Severity (badge), Message, Entity, Timestamp, Status.
**Detail actions:** Acknowledge → `integration-pending`, Resolve → `integration-pending`.
**Cross-domain link:** Escalate to case → Support Console.

### 10.9 Backup & DR (P2, Detail + context)

**Context rail:** DR Posture (RPO, RTO). Actions: Initiate backup, Test restore → `integration-pending`.
**Primary:** Schedule table (type, frequency, next run), History table (timestamp, type, status, size).

### 10.10 Environments & Flags (P2, List + filter)

**Filter rail:** Type: environment, feature-flag, release-channel.
**Tables:** Environments (name, health, tenant binding, version), Feature Flags (key, state, scope), Release Channels.
**Actions:** Toggle feature flag → `review-only`.

### 10.11 Support Console (P1, List + filter)

**Filter rail:** Status: open, in-progress, escalated, resolved. Priority. Assignee. Category. Search.
**Table columns:** Case ID, Tenant, Priority (badge), Status (badge), Assigned, Last Update.
**Detail actions:** Assign, Escalate, Resolve → `integration-pending`.
**Cross-domain links:** View tenant → Tenant Detail. View audit → Audit Trail.

### 10.12 Billing & Entitlements (P1, List + filter)

**Filter rail:** Status: current, past-due, suspended, grace-period. Search.
**Table columns:** Tenant, Plan, Status (badge), Balance (currency), Next Due.
**Detail actions:** Generate invoice, Adjust entitlement → `integration-pending`.

### 10.13 Usage & Metering (P2, List + filter)

**Filter rail:** Tenant, Metric, Period.
**Table columns:** Tenant, Metric, Period, Value, Limit, Overage flag.
**Actions:** Export → `integration-pending`.

### 10.14 Market Management (P2, List + filter)

**Filter rail:** Status: draft, under-review, active, deprecated. Country. Search.
**Table columns:** Market Name, Country, Status (badge), Launch Tier.
**Row click:** → Market Detail.
**Actions:** Create market draft → `review-only`, Submit for review → `review-only`.

### 10.15 Market Detail (P2, Detail + context)

**Context rail:** Identity (ID, name, country, status), Actions (Approve, Deprecate → `review-only`), Navigation (← Markets, → Packs, → Payer Readiness, → Eligibility Simulator).
**Primary:** Mandated packs table, Default packs table, Eligible packs table, Readiness dimensions (9-state badges).

### 10.16 Pack Catalog (P2, List + filter)

**Filter rail:** Status: draft, under-review, published, deprecated, retired. Family. Search.
**Table columns:** Pack Name, Family, Status (badge), Version.
**Detail drill:** Inline expansion.
**Actions:** Create pack draft, Submit for review → `review-only`.

### 10.17 Payer Readiness (P2, List + filter)

**Filter rail:** Market selector. Search.
**Table columns:** Payer Name, Per-dimension readiness badges (9-state), Connectivity.
**Actions:** None — read-only.

### 10.18 Eligibility Simulator (P2, Form + result)

**Form:** Market selector dropdown, Pack toggles (multi-select), Tenant context fields (optional).
**Result:** Resolution output, Deferred items with reasons, Readiness badges per item.
**Actions:** Run simulation (client-side), Compare (side-by-side).

### 10.19 System Configuration (P2, List + filter)

**Filter rail:** Category. Search.
**Table columns:** Parameter Key, Current Value, Category, Last Changed.
**Actions:** Update parameter → `review-only`.

### 10.20 Audit Trail (P2, List + filter)

**Filter rail:** Date range, Actor, Action, Entity. Search.
**Table columns:** Timestamp, Actor, Action, Entity, Detail (expandable).
**Chain verification badge** (hash-chain integrity status).
**Actions:** Export → `integration-pending`. Verify chain → client-side.

### 10.21 Templates & Presets (P2, List + filter)

**Filter rail:** Type: bootstrap, config, governance. Search.
**Table columns:** Template Name, Type (badge), Version, Usage Count.
**Actions:** Create template, Edit → `integration-pending`.

### 10.22 Runbooks Hub (P2, List + search)

**Search:** Client-side text search across titles and content.
**Index:** Runbook titles, domain-aligned categories, freshness indicator (updated < 90 days).
**Viewer:** Markdown rendered inline.
**Actions:** None — purely static reference.

---

## 11. Figma Make — primary brief

Structured input for Figma Make or equivalent AI-to-design tools:

```
Design system: Admin dashboard for enterprise healthcare platform operator console.
Audience: Technical platform operators (not patients, not clinicians, not developers).
Mood: Professional, trustworthy, operational. Not clinical, not consumer.
Minimum viewport: 1024px wide.

Shell:
  - Review banner: full-width amber bar, always visible, text "LOCAL REVIEW RUNTIME"
  - Fixed left sidebar navigation: 220px, dark slate background (#1e293b)
  - 8 domain groups (divider labels, uppercase): Home, Requests & Onboarding, Tenants,
    Operations, Support, Commercial, Catalogs & Governance, Platform
  - 22 surface links under domain groups
  - Active link: 3px left-border accent (#3b82f6)
  - Count badge pills on P0 nav links
  - Status bar at bottom: "22 surfaces, 8 domains"

Page header (every surface):
  - Breadcrumb: Domain > Surface Title
  - Source badge (pill): Live (green), Fixture (amber), Contract (blue), Static (gray)
  - Subtitle: operator question for this surface
  - Refresh button + timestamp (with amber/red stale-data coloring)

Layout patterns to generate:
  1. Card grid (Home): 5 action cards with count, description, source badge, drill link.
     Cards: Pending Requests, Active Provisioning, Recent Alerts, Tenant Summary, Next Actions.
  2. List + filter: Filter rail (status dropdown, search, count) + sortable table + pagination.
     Example: Tenant Registry with columns: ID, Name, Status badge, Market, Created, Environment.
  3. Detail + context: Right-side context rail (identity, status badge, actions with posture
     badges, navigation links) + left-side primary content area.
     Example: Tenant Detail with lifecycle timeline and config summary.
  4. Form + result: Left-side input form + right-side result panel with badges.
     Example: Eligibility Simulator.
  5. Card grid (Operations Center): 4 health cards with status accents and drill links.

States per surface: Default (populated), Empty state, Loading (skeleton), Error (inline bar).

Color tokens: Blue primary (#0d6efd), green success (#198754), amber warning (#ffc107),
  red danger (#dc3545), gray neutral (#6c757d), cyan info (#0dcaf0).
  Dark nav: #1e293b, nav text: #e2e8f0, nav active: #3b82f6.
Typography: System font stack, 14px body, 20px headers, 12px badges.
Icons: Emoji for nav (replaceable), line icons for actions.

Badge system: Rounded pills, background at 15% opacity, border at 60%, 12px monospace text.
  State badges: green=Active/Healthy, amber=Pending/Warning, red=Failed/Suspended,
  gray=Draft/Archived, blue=Queued/Info, blue-pulsing=In-flight.
  Source badges: Live(green), Fixture(amber), Contract(blue), Static(gray).
  Action badges: Review Only(amber), Pending(red outline), Contracted(gray).

Do NOT: Copy Epic, Cerner, or any healthcare vendor's admin UI.
Do NOT: Include patient data, clinical content, CPRS-like layouts, or mobile breakpoints.
Do NOT: Use "coming soon", "beta", "preview" labels anywhere.
```

---

## 12. Stitch — secondary brief

For code-generation tools (Stitch, v0, Bolt) producing a rapid prototype:

```
Framework: Vanilla HTML + CSS + JavaScript (no build tooling).
  Or alternatively: React + Tailwind CSS with shadcn/ui headless components.

Layout: Fixed sidebar (220px) + content area. Amber review banner at top.
Data: Use sample JSON arrays — no API integration.
Routing: Hash-based (#/home, #/tenants, #/bootstrap, etc.) — 22 routes total.

Shell components:
  - Review banner (amber, not dismissible)
  - Left nav with 8 domain groups (uppercase dividers) + 22 surface links
  - Page header (breadcrumb, source badge, subtitle, refresh, timestamp)
  - Status bar (bottom)

Page patterns:
  /home — 5-card action grid (pending requests, provisioning, alerts, tenants, next actions)
  /bootstrap — Filter rail + table (request ID, tenant, market, status badge, date, actor)
  /provisioning — Filter rail + table (run ID, tenant, status, started, steps)
  /tenants — Filter rail + table (ID, name, status, market, created, environment)
  /tenants/:id — Context rail (right) + primary content (left). Lifecycle actions.
  /operations — 4 health cards (environment, alerts, provisioning, backup)
  /alerts — Filter rail + table (severity, message, entity, timestamp, status)
  /support — Filter rail + table (case ID, tenant, priority, status, assigned, updated)
  /billing — Filter rail + table (tenant, plan, status, balance, next due)
  /markets — Filter rail + table (market, country, status, launch tier)
  /markets/:id — Context rail + mandated/default/eligible packs tables + readiness badges
  /packs — Filter rail + table (name, family, status, version)
  /payer-readiness — Filter rail + table (payer, dimension badges, connectivity)
  /eligibility — Form (market, pack toggles) + result panel
  /config — Filter rail + table (key, value, category, changed)
  /audit — Filter rail + table (timestamp, actor, action, entity, detail)
  /templates — Filter rail + table (name, type, version, usage)
  /runbooks — Search + categorized index + inline viewer

CSS custom properties: Use the exact token values from §4.1 and §4.2 of this document.

Badges: Pill-shaped, 12px, background at 15% opacity of state color.

Do NOT: Add authentication, API calls, external dependencies, or server-side rendering.
Do NOT: Import from any proprietary or licensed design system.
Do NOT: Include patient data, clinical workflows, or EHR-like layouts.
```

---

## 13. Cross-domain drill map (for design linking)

Designers should ensure that clickable links navigate correctly between surfaces.
The full drill map from the shell content model:

| From | Drill target | Target domain |
|------|-------------|---------------|
| Home → Pending Requests card | Bootstrap Requests | Requests & Onboarding |
| Home → Active Provisioning card | Provisioning Runs | Requests & Onboarding |
| Home → Recent Alerts card | Alert Center | Operations |
| Home → Tenant Summary card | Tenant Registry | Tenants |
| Bootstrap detail → approve result | Provisioning Runs | Requests & Onboarding |
| Provisioning → completed run | Tenant Detail | Tenants |
| Tenant Registry → row | Tenant Detail | Tenants |
| Tenant Detail → provisioning | Provisioning Runs | Requests & Onboarding |
| Tenant Detail → environment | Environments & Flags | Operations |
| Tenant Detail → billing | Billing & Entitlements | Commercial |
| Tenant Detail → support | Support Console | Support |
| Ops Center → health card | Environments & Flags | Operations |
| Ops Center → alert card | Alert Center | Operations |
| Ops Center → backup card | Backup & DR | Operations |
| Alert Center → escalate | Support Console | Support |
| Alert Center → affected entity | Tenant Detail | Tenants |
| Support → tenant | Tenant Detail | Tenants |
| Support → audit | Audit Trail | Platform |
| Market Management → row | Market Detail | Catalogs & Governance |
| Market Detail → packs | Pack Catalog | Catalogs & Governance |
| Market Detail → payer readiness | Payer Readiness | Catalogs & Governance |
| Market Detail → eligibility | Eligibility Simulator | Catalogs & Governance |
| Billing → tenant | Tenant Detail | Tenants |

---

## 14. Review and rejection criteria

### 14.1 Acceptance criteria

A design deliverable is accepted when ALL of the following are true:

| # | Criterion | How to verify |
|---|-----------|--------------|
| 1 | Shell layout designed (S1–S5 from §2.1). | Visual checklist. |
| 2 | All 22 surfaces from §2.2 are designed. | Surface count audit. |
| 3 | Each surface covers all 4 states from §2.3. | State matrix: 22 surfaces × 4 states = 88 frames. |
| 4 | 8-domain left nav with correct order and grouping from §5.1. | Compare against domain table. |
| 5 | Page header on every surface with all 7 fields from design contract v3 §4. | Field-by-field check. |
| 6 | Source-posture badges visible on every surface page header. | Badge audit. |
| 7 | State badges cover all lifecycle state families from §7.3. | Badge inventory vs. state families. |
| 8 | Color tokens match runtime values from §4.1 and §4.2. | Token audit vs. CSS custom properties. |
| 9 | No vendor UI cloning. | Visual similarity check. |
| 10 | Language rules from §8 followed (no architecture vocabulary). | Copy audit. |
| 11 | All cross-domain drill links from §13 present and correct. | Link audit. |
| 12 | 4 layout patterns (card grid, list+filter, detail+context, form+result) as components. | Component inventory. |
| 13 | Home shows 5 action cards, not metrics dashboard. | Visual check. |
| 14 | Review banner visible on all screens. | Frame audit. |
| 15 | Minimum viewport 1024px, no mobile breakpoints. | Viewport check. |

### 14.2 Rejection triggers

A design deliverable is rejected if ANY of the following are true:

| # | Trigger | Why |
|---|---------|-----|
| R1 | Visual similarity to Epic MyChart admin, Cerner admin, or CPRS preference editor. | Clean-room violation. |
| R2 | Fewer than 22 surfaces designed. | Incomplete scope. |
| R3 | Nav does not show 8 domains in correct order. | IA violation. |
| R4 | Home is a metrics dashboard instead of action card grid. | Violates Home-as-action-center. |
| R5 | Patient data or clinical content visible anywhere. | CP is platform-operator scope. |
| R6 | Architecture vocabulary in any user-visible text. | Language rule violation. |
| R7 | Source or posture badges missing from any surface. | Honest-posture violation. |
| R8 | Auto-play animations, confetti, or gamification elements. | Not appropriate for operator tooling. |
| R9 | Tabs within surfaces (CP uses list→detail pattern, not tabs). | Architectural violation. |
| R10 | "Coming soon", "Beta", "Preview", "TBD" labels. | Forbidden posture labels. |
| R11 | Mobile breakpoints or responsive layout below 1024px. | Out of scope. |
| R12 | Colors or typography conflicting with live CSS tokens in §4. | Token mismatch. |

---

## 15. Design-to-implementation handoff

After designs are reviewed and accepted:

1. **Figma export:** Export all 22 surface screens (× 4 states each, 88+ frames) as PNG/SVG.
2. **Token extraction:** Extract final color, typography, spacing, and icon tokens. Compare against `styles.css` `:root` — propose diffs, do not silently override.
3. **Component inventory:** List all reusable Figma components, map each to a code component in `apps/control-plane/`.
4. **Surface mapping:** Verify each designed surface maps to a surface ID in `access-map.mjs` (22 surfaces documented).
5. **Content-slot alignment:** For each surface, verify designed content slots match the shell content model (§3 of that doc).
6. **Implementation tickets:** Create tickets referencing: (a) Figma frame, (b) surface ID, (c) content model section, (d) API contract (when available).

> **This step (design-to-implementation handoff) is NOT authorized by this document.**
> This document is a planning artifact. Implementation requires separate authorization,
> API contracts, and screen-contract instances.

---

## 16. Versioning and supersession

| Version | Document | Status |
|---------|----------|--------|
| v1 | `control-plane-bootstrap-design-handoff-brief.md` | **Superseded by this document.** Covered 8 bootstrap screens under old IA. Retained as reference for v1 component specs. |
| **v2** | **This document** | **Canonical.** Covers all 22 surfaces under 8-domain model. |

---

## 17. Governing references

| Reference | Location |
|-----------|----------|
| UX/IA reset and journey pack | `docs/explanation/operator-console-ux-ia-reset-and-journey-pack.md` |
| Personas, jobs, and service map | `docs/explanation/operator-console-personas-jobs-and-service-map.md` |
| Page priority and content model | `docs/explanation/operator-console-page-priority-and-content-model.md` |
| Design contract v3 | `docs/explanation/operator-console-design-contract-v3.md` |
| Shell content model | `docs/explanation/operator-console-shell-content-model.md` |
| v1 design handoff brief (superseded) | `docs/explanation/control-plane-bootstrap-design-handoff-brief.md` |
| Live CSS tokens | `apps/control-plane/public/styles.css` |
| Surface access map | `apps/control-plane/lib/access-map.mjs` |
| Source of truth index | `docs/reference/source-of-truth-index.md` |
