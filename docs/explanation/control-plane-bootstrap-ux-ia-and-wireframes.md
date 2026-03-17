# Control-Plane Bootstrap — UX / IA and Wireframes

> **Artifact type:** Explanation / planning research — NOT implementation authorization.
> **Repo:** `vista-evolved-platform`
> **Date:** 2026-03-18
> **Status:** Draft — pending human review.
> **Scope:** Navigation architecture, component vocabulary, ASCII wireframes for control-plane bootstrap screens.
> **Does NOT:** Create screen-contract instances, define API endpoints, authorize code, produce production UI.

---

## 1. Purpose

This document translates the journeys and stories into structural information architecture (IA), a reusable component vocabulary, and ASCII wireframes for the control-plane bootstrap surfaces. It is the primary input to the design handoff brief.

### 1.1 Position in the planning sequence

| Predecessor | What it provides |
|------------|-----------------|
| Subsystem pattern scan | Concern areas, build/borrow/avoid decisions |
| Journeys and stories | Personas, golden journey, topology presets, exception paths, user stories |
| Screen inventory §9 | 4 canonical CP surface definitions |
| Workspace map §11 | CP workspace shell definition, left-nav model |

| Successor | What it consumes from this doc |
|----------|-------------------------------|
| Design handoff brief | Wireframes drive Figma/Stitch scope; component vocabulary drives token mapping |
| Future screen-contract instances | Layout sections map to surface zones |

### 1.2 Non-goals

- No pixel-level design. Wireframes are structural, not visual.
- No color, typography, or icon specification. Those are design-handoff scope.
- No implementation. These wireframes are planning artifacts.

---

## 2. Information architecture — control-plane navigation

### 2.1 Navigation tree

```
Control Plane (CP workspace shell)
├── Dashboard                    ← first-run banner lives here
├── Tenants                      ← control-plane.tenants.list
│   ├── [Tenant Registry]        ← list view (default)
│   └── [Create Tenant]          ← provisioning flow (multi-step)
├── Markets                      ← control-plane.markets.management
│   ├── [Market Registry]        ← list view (default)
│   └── [Market Detail]          ← drill-into readiness dimensions
├── Packs                        ← control-plane.packs.catalog
│   ├── [Pack Catalog]           ← grouped by family (default)
│   └── [Pack Detail]            ← dependency chain, lifecycle
└── System                       ← control-plane.system.config (proposed)
    ├── [Health]                  ← platform health dashboard
    ├── [Feature Flags]           ← platform-wide flags
    └── [Audit Trail]            ← immutable audit viewer
```

### 2.2 Navigation model

Per workspace map §11, the control-plane uses a **left-nav + content area** model:

- **Left nav:** Persistent sidebar with top-level sections (Dashboard, Tenants, Markets, Packs, System).
- **Content area:** Right pane, fills remaining width. Contains the active surface.
- **No tabs within surfaces.** Surfaces may have sub-views (list → detail) but not tabbed panels. This differentiates CP from the densely tabbed clinical workspace.
- **Breadcrumbs:** Shown above content area for drill-into views (e.g., Markets → Philippines → Readiness).

### 2.3 Workspace shell

The CP workspace shell wraps all CP surfaces and provides:

- Left nav with section icons and labels.
- Top bar with: platform name, deployment version, logged-in operator identity, logout.
- First-run banner (conditional): shown when no markets are configured (story CP-FR1).
- Role gate: only `platform-operator` role reaches this workspace.

---

## 3. Component vocabulary

These are reusable structural components referenced in the wireframes. They are platform-generic and not specific to any vendor or design system.

| Component | Description | Used in |
|-----------|-------------|---------|
| **RegistryTable** | Sortable, filterable data table with row actions. Columns, filters, and actions defined per surface. | Tenant list, market list, pack catalog, audit trail |
| **StatusBadge** | Inline badge showing entity status with color-coded state. | Tenant status, market tier, pack lifecycle, capability readiness |
| **WizardFlow** | Multi-step guided form with step indicator, back/next, and summary-before-submit. | Tenant creation provisioning flow |
| **DetailPanel** | Read-only drill view showing entity details. Includes sections with headers. | Market detail, pack detail |
| **DimensionGrid** | Grid of key-value pairs organized into labeled groups. For showing multi-dimensional data. | Market readiness, capability readiness |
| **DependencyTree** | Visual tree or list showing parent→child dependencies. | Pack dependency chains |
| **HealthCard** | Card showing a system component's health status (connected, unreachable, pending). | System health dashboard |
| **FirstRunBanner** | Prominent banner at top of content area, dismissable after action taken. | Dashboard first-run experience |
| **ProbeResult** | Inline status indicator showing real-time probe result (success, failure, pending). | VistA endpoint binding |
| **AuditRow** | Compact log entry with timestamp, actor, action, target, and detail expandable. | Audit trail viewer |

---

## 4. ASCII wireframes

### 4.1 Tenant registry (default view of `tenants.list`)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ┌──────────┐  VistA Evolved Control Plane      v0.1.0    Alex ▾  [⎋]  │
│ │          │──────────────────────────────────────────────────────────── │
│ │ Dashboard│  Tenants > Registry                                       │
│ │          │                                                           │
│ │ Tenants ◀│  ┌─────────────────────────────────────────────────────┐  │
│ │          │  │ [🔍 Filter: ________]  [Status: All ▾]  [+ Create] │  │
│ │ Markets  │  ├────────┬──────────┬─────────┬──────────┬───────────┤  │
│ │          │  │ Name   │ Market   │ Status  │ Created  │ Actions   │  │
│ │ Packs    │  ├────────┼──────────┼─────────┼──────────┼───────────┤  │
│ │          │  │ Clinic │ PH       │ ● READY │ 2026-03  │ [⋯]      │  │
│ │ System   │  │ Hosp A │ US       │ ● PEND  │ 2026-02  │ [⋯]      │  │
│ │          │  │ Demo   │ PH       │ ○ ARCH  │ 2025-12  │ [⋯]      │  │
│ │          │  └────────┴──────────┴─────────┴──────────┴───────────┘  │
│ │          │                                                           │
│ │          │  Showing 3 of 3 tenants                                   │
│ └──────────┘                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

**Key elements:**

- RegistryTable with columns: Name, Market, Status (StatusBadge), Created, Actions
- Filter bar with text search and status dropdown
- `[+ Create]` button triggers provisioning flow (WizardFlow)
- Row action menu `[⋯]`: View details, Suspend, Archive, Open tenant-admin

### 4.2 Tenant creation — provisioning wizard

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ┌──────────┐  VistA Evolved Control Plane                              │
│ │          │──────────────────────────────────────────────────────────── │
│ │ Dashboard│  Tenants > Create Tenant                                  │
│ │          │                                                           │
│ │ Tenants ◀│  ┌─────────────────────────────────────────────────────┐  │
│ │          │  │  Step: (1)─(2)─(3)─(4)─(5)─(6)                     │  │
│ │ Markets  │  │        ●───○───○───○───○───○                        │  │
│ │          │  │                                                     │  │
│ │ Packs    │  │  1. Basic Information                               │  │
│ │          │  │  ─────────────────────                              │  │
│ │ System   │  │                                                     │  │
│ │          │  │  Tenant name:  [________________________]           │  │
│ │          │  │  Contact email: [________________________]          │  │
│ │          │  │  Notes:         [________________________]          │  │
│ │          │  │                 [________________________]          │  │
│ │          │  │                                                     │  │
│ │          │  │                            [Cancel]  [Next →]       │  │
│ │          │  └─────────────────────────────────────────────────────┘  │
│ └──────────┘                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

**Wizard steps:**

1. **Basic information:** Tenant name, contact email, notes.
2. **Legal market:** Market selection dropdown (gated: only ≥ T1 markets shown).
3. **Topology preset:** Radio selection: Solo clinic / Multi-clinic / Hospital / Enterprise. Brief description per option.
4. **Pack composition:** Mandatory packs shown as locked selections. Optional packs as checkboxes grouped by family.
5. **Facility binding:** VistA endpoint entry (host + port) with live ProbeResult indicator. Option to skip (`integration-pending`).
6. **Review and create:** Summary of all selections. `[Create Tenant]` button.

### 4.3 Market registry (default view of `markets.management`)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ┌──────────┐  VistA Evolved Control Plane                              │
│ │          │──────────────────────────────────────────────────────────── │
│ │ Dashboard│  Markets > Registry                                       │
│ │          │                                                           │
│ │ Tenants  │  ┌─────────────────────────────────────────────────────┐  │
│ │          │  │ [🔍 Filter: ________]  [Tier: All ▾]               │  │
│ │ Markets ◀│  ├────────────┬──────┬──────┬──────┬──────┬───────────┤  │
│ │          │  │ Market     │ Tier │ Lang │ Reg  │ Payr │ Actions   │  │
│ │ Packs    │  ├────────────┼──────┼──────┼──────┼──────┼───────────┤  │
│ │          │  │ Philippines│ T2   │ ● ✓  │ ● ✓  │ ◐ P  │ [Detail]  │  │
│ │ System   │  │ United Sta │ T3   │ ● ✓  │ ● ✓  │ ● ✓  │ [Detail]  │  │
│ │          │  │ Saudi Arab │ T0   │ ○ ✗  │ ○ ✗  │ ○ ✗  │ [Detail]  │  │
│ │          │  └────────────┴──────┴──────┴──────┴──────┴───────────┘  │
│ │          │                                                           │
│ │          │  Legend: ● ✓ verified  ◐ P partial  ○ ✗ not started       │
│ └──────────┘                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

**Key elements:**

- RegistryTable with columns: Market name, Launch tier (StatusBadge), dimension summary columns (Lang, Reg, Payr show readiness state icons), Actions
- `[Detail]` drills into market-specific readiness view (DimensionGrid)
- Markets at T0 are visible but cannot be used for provisioning

### 4.4 Market detail — readiness dimensions

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ┌──────────┐  VistA Evolved Control Plane                              │
│ │          │──────────────────────────────────────────────────────────── │
│ │ Dashboard│  Markets > Philippines > Readiness                        │
│ │          │                                                           │
│ │ Tenants  │  ┌─────────────────────────────────────────────────────┐  │
│ │          │  │  Philippines               Launch Tier: [T2 ●]     │  │
│ │ Markets ◀│  │                                                     │  │
│ │          │  │  ┌─ Language ──────────────────── ● Verified ─────┐ │  │
│ │ Packs    │  │  │  Filipino (fil): published                    │ │  │
│ │          │  │  │  English (en): published                      │ │  │
│ │ System   │  │  └──────────────────────────────────────────────┘ │  │
│ │          │  │                                                     │  │
│ │          │  │  ┌─ Regulatory ────────────────── ● Verified ─────┐ │  │
│ │          │  │  │  PhilHealth integration: configured            │ │  │
│ │          │  │  │  DOH reporting: pending                        │ │  │
│ │          │  │  └──────────────────────────────────────────────┘ │  │
│ │          │  │                                                     │  │
│ │          │  │  ┌─ Payer ─────────────────────── ◐ Partial ──────┐ │  │
│ │          │  │  │  PhilHealth: active                            │ │  │
│ │          │  │  │  MaxiCare: draft                               │ │  │
│ │          │  │  │  MediCard: not started                         │ │  │
│ │          │  │  └──────────────────────────────────────────────┘ │  │
│ │          │  │                                                     │  │
│ │          │  │  [← Back to Markets]                                │  │
│ │          │  └─────────────────────────────────────────────────────┘  │
│ └──────────┘                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

**Key elements:**

- DetailPanel header with market name and launch tier badge.
- DimensionGrid sections for each readiness dimension (language, locale, regulatory, standards, payer, provisioning, data residency, clinical workflow).
- Each dimension shows overall state badge + line-item detail.
- Breadcrumb navigation back to market registry.

### 4.5 Pack catalog (default view of `packs.catalog`)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ┌──────────┐  VistA Evolved Control Plane                              │
│ │          │──────────────────────────────────────────────────────────── │
│ │ Dashboard│  Packs > Catalog                                          │
│ │          │                                                           │
│ │ Tenants  │  ┌─────────────────────────────────────────────────────┐  │
│ │          │  │ [🔍 Filter: ________]  [Family: All ▾] [State: ▾]  │  │
│ │ Markets  │  │                                                     │  │
│ │          │  │  ── Language ──────────────────────────────────────  │  │
│ │ Packs ◀  │  │  │ Filipino (fil)    │ published │ 0 deps  │ [⋯]│  │
│ │          │  │  │ English (en)      │ published │ 0 deps  │ [⋯]│  │
│ │ System   │  │  │ Korean (ko)       │ draft     │ 0 deps  │ [⋯]│  │
│ │          │  │                                                     │  │
│ │          │  │  ── Regulatory ─────────────────────────────────── │  │
│ │          │  │  │ PH Regulatory     │ published │ 1 dep   │ [⋯]│  │
│ │          │  │  │ US Regulatory     │ published │ 1 dep   │ [⋯]│  │
│ │          │  │                                                     │  │
│ │          │  │  ── Payer ──────────────────────────────────────── │  │
│ │          │  │  │ PhilHealth        │ active    │ 2 deps  │ [⋯]│  │
│ │          │  │  │ US Medicaid       │ validated │ 2 deps  │ [⋯]│  │
│ │          │  │                                                     │  │
│ │          │  │  Showing 7 packs across 3 families                  │  │
│ └──────────┘  └─────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

**Key elements:**

- RegistryTable grouped by pack family with collapsible family headers.
- Columns: Pack name, Lifecycle state (StatusBadge), Dependency count, Actions.
- Filter by family dropdown, lifecycle state dropdown, text search.
- `[⋯]` menu: View details, Dependency chain, Eligibility rules.

### 4.6 System health (proposed surface: `system.config`)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ┌──────────┐  VistA Evolved Control Plane                              │
│ │          │──────────────────────────────────────────────────────────── │
│ │ Dashboard│  System > Health                                          │
│ │          │                                                           │
│ │ Tenants  │  ┌─────────────────────────────────────────────────────┐  │
│ │          │  │                                                     │  │
│ │ Markets  │  │  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │  │
│ │          │  │  │ Platform DB │  │ VistA Broker│  │ API Server │  │  │
│ │ Packs    │  │  │ ● Connected │  │ ● Reachable │  │ ● Running  │  │  │
│ │          │  │  │ PG 16       │  │ Port 9431   │  │ v0.1.0     │  │  │
│ │ System ◀ │  │  │ 21 tables   │  │ 87 RPCs ok  │  │ 3001       │  │  │
│ │          │  │  └─────────────┘  └─────────────┘  └────────────┘  │  │
│ │          │  │                                                     │  │
│ │          │  │  ┌─────────────┐  ┌─────────────┐                   │  │
│ │          │  │  │ Audit Trail │  │ Redis       │                   │  │
│ │          │  │  │ ● Active    │  │ ○ Not conf. │                   │  │
│ │          │  │  │ 1,247 entries│ │             │                   │  │
│ │          │  │  └─────────────┘  └─────────────┘                   │  │
│ │          │  │                                                     │  │
│ │          │  │  Last checked: 2026-03-18 14:32:01 UTC  [Refresh]   │  │
│ │          │  └─────────────────────────────────────────────────────┘  │
│ └──────────┘                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

**Key elements:**

- HealthCard grid showing each infrastructure component.
- Each card: component name, status badge (connected/unreachable/not configured), version or count info.
- Manual `[Refresh]` button (no auto-polling to avoid noise).
- Sub-nav within System: Health (default), Feature Flags, Audit Trail.

### 4.7 First-run banner (Dashboard)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ┌──────────┐  VistA Evolved Control Plane            v0.1.0  Sam ▾     │
│ │          │──────────────────────────────────────────────────────────── │
│ │ Dashboard│  Dashboard                                                │
│ │ ◀        │                                                           │
│ │ Tenants  │  ╔═════════════════════════════════════════════════════╗  │
│ │          │  ║  ℹ️  Welcome to VistA Evolved                       ║  │
│ │ Markets  │  ║  No legal markets configured. Tenant creation       ║  │
│ │          │  ║  requires at least one market at launch tier T1.     ║  │
│ │ Packs    │  ║                                                     ║  │
│ │          │  ║  Recommended first steps:                           ║  │
│ │ System   │  ║  1. Check system health     → [Go to System]       ║  │
│ │          │  ║  2. Configure a market       → [Go to Markets]      ║  │
│ │          │  ║  3. Review the pack catalog  → [Go to Packs]        ║  │
│ │          │  ╚═════════════════════════════════════════════════════╝  │
│ │          │                                                           │
│ │          │  ┌─ Quick Stats ───────────────────────────────────────┐  │
│ │          │  │  Tenants: 0  │  Markets (≥T1): 0  │  Packs: 7     │  │
│ │          │  └─────────────────────────────────────────────────────┘  │
│ └──────────┘                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

**Key elements:**

- FirstRunBanner: prominent, informational (not alarm/error), dismissable after first market is configured.
- Quick stats row below banner.
- Links navigate to the appropriate CP surface.

---

## 5. Cross-workspace transitions

Per the workspace map, control-plane surfaces have outgoing transitions to tenant-admin. These transitions are:

| From (CP surface) | Trigger | To (workspace) | Context passed |
|-------------------|---------|----------------|---------------|
| Tenant registry row action | "Open tenant-admin" | tenant-admin workspace | Tenant ID |
| Post-provisioning confirmation | "Set up users →" | tenant-admin.users | Tenant ID |

**Transition UX:** Transitions between workspaces should be clearly indicated (e.g., badge: "Leaving control-plane → Tenant Admin"). The operator's CP session is preserved; this is navigation, not logout/login.

---

## 6. Responsive and density notes

- **Minimum viewport:** 1024px wide. CP is an operator tool, not a patient-facing responsive app.
- **Table density:** Default density (not compact). Operators manage ≤50 tenants, not thousands. Pagination at 25 rows, not infinite scroll.
- **Wizard density:** One concern per step. Do not pack multiple concerns into one step to save clicks.
- **No mobile target.** CP is desktop/laptop only.

---

## 7. Clean-room design rules

These rules apply to any designer or AI agent producing visuals from these wireframes.

1. **No vendor UI cloning.** Do not copy layouts from Epic MyChart admin, Cerner admin portals, CPRS preference editors, or any other vendor product. Use the wireframes in this document and the component vocabulary as the structural starting point.
2. **Structural reference allowed.** Standard patterns (registry tables, wizard flows, health dashboards) are industry-generic and not proprietary. Drawing structural inspiration from any admin panel that uses these patterns is acceptable.
3. **Platform typography and color tokens.** Use the design tokens defined in the design handoff brief. Do not adopt VistA classic styling (blue/white Win32), Epic brand colors, or any other vendor's visual identity.
4. **Wireframes are minimum scope.** Designers may add navigational polish (breadcrumbs, hover states, transitions) but must NOT add features, surfaces, or data fields not present in the wireframes or user stories.

---

## 8. Governing references

| Reference | Location |
|-----------|----------|
| Journeys and stories | `docs/explanation/control-plane-bootstrap-journeys-and-stories.md` |
| Subsystem pattern scan | `docs/explanation/control-plane-bootstrap-subsystem-pattern-scan.md` |
| Workspace map | `docs/explanation/information-architecture-workspace-map.md` |
| Screen inventory §9 | `docs/reference/screen-inventory.md` |
| Permissions matrix §7A | `docs/reference/permissions-matrix.md` |
