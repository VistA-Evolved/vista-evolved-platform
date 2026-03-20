# Control-Plane Bootstrap — Design Handoff Brief

> **Artifact type:** Explanation / planning research — NOT implementation authorization.
> **Repo:** `vista-evolved-platform`
> **Date:** 2026-03-18
> **Status:** **Superseded by `operator-console-design-handoff-brief-v2.md`** — retained as reference for v1 component specs (8 bootstrap screens under old IA).
> **Scope:** Design brief for translating UX/IA wireframes into production-quality visual designs. Figma Make primary brief, Stitch secondary brief, design tokens, and review/rejection criteria.
> **Does NOT:** Produce final designs, authorize code, create screen-contract instances.

---

## 1. Purpose

This document provides the information a designer (human or AI-assisted) needs to produce visual designs for the control-plane bootstrap surfaces. It defines scope, constraints, token guidance, and acceptance criteria.

### 1.1 Position in the planning sequence

| Predecessor | What it provides |
|------------|-----------------|
| Subsystem pattern scan | Build/borrow/avoid decisions, concern areas |
| Journeys and stories | Personas, golden journey, user stories |
| UX/IA and wireframes | Navigation tree, component vocabulary, ASCII wireframes for 7 screens |

This document is the **terminal artifact** in the planning sequence. Its output feeds into the design phase (outside this repo).

### 1.2 Audience

- **Primary:** Designer using Figma (or equivalent) to produce CP screen mockups.
- **Secondary:** AI design tools (Figma Make, v0, etc.) that accept structured briefs.
- **Tertiary:** Implementation engineers who will code the CP surfaces.

---

## 2. Design scope — what to produce

### 2.1 Screens to design

| # | Screen | Source wireframe | Priority | Story IDs |
|---|--------|-----------------|----------|-----------|
| 1 | CP workspace shell (left-nav + top bar) | UX/IA §2.3 | P0 (required for all) | — |
| 2 | Tenant registry (list view) | UX/IA §4.1 | P0 | CP-T1 |
| 3 | Tenant creation wizard (6 steps) | UX/IA §4.2 | P0 | CP-T2, CP-P4, CP-F1, CP-F2 |
| 4 | Market registry (list view) | UX/IA §4.3 | P0 | CP-M1 |
| 5 | Market detail (readiness dimensions) | UX/IA §4.4 | P1 | CP-M2 |
| 6 | Pack catalog (grouped list) | UX/IA §4.5 | P1 | CP-P1, CP-P2 |
| 7 | System health dashboard | UX/IA §4.6 | P1 | CP-S1 |
| 8 | First-run banner (Dashboard) | UX/IA §4.7 | P1 | CP-FR1 |

**P0:** Must be designed before implementation can begin.
**P1:** Can be designed after P0, but needed before full CP implementation.

### 2.2 States to cover per screen

Each screen design should include:

| State | Description |
|-------|-------------|
| Default (populated) | Normal state with representative data |
| Empty state | No data yet (e.g., 0 tenants, 0 markets) |
| Loading | Content area loading indicator |
| Error | System error or connection failure |

### 2.3 Not in scope

- Tenant-admin workspace screens. Separate design brief.
- Clinical workspace screens. Separate design system.
- Login/authentication screens. Separate flow.
- Mobile or responsive breakpoints below 1024px.

---

## 3. Design token guidance

### 3.1 Color palette direction

The control-plane uses an **operator/infrastructure** visual register:

| Token category | Direction | Anti-pattern |
|---------------|-----------|-------------|
| **Background** | Neutral, low-contrast. Light gray or off-white content area. White cards/panels. | Not clinical white (#FFF everywhere). Not dark mode. |
| **Primary action** | Confident, not alarming. Blue-family for primary CTAs. | Not VistA classic bright blue. Not Epic's purple or Cerner's teal. |
| **Status: healthy** | Green-family badge. Subdued, not neon. | Not lime green. |
| **Status: warning/pending** | Amber/yellow-family badge. | Not red (that's error). |
| **Status: error/unreachable** | Red-family badge. Used sparingly. | Not as background fill. Badge/text only. |
| **Status: not started/inactive** | Gray badge. | Not invisible. Must be distinguishable from background. |
| **Text** | Near-black for body. Gray for secondary. | Not pure #000. Not low-contrast gray-on-gray. |
| **Borders/dividers** | Light gray. Cards have subtle border or shadow. | Not heavy borders. Not colored borders except for status. |

### 3.2 Typography direction

| Element | Direction |
|---------|-----------|
| **System font stack** | Use system fonts (Inter, -apple-system, Segoe UI). No custom web fonts for now. |
| **Body** | 14–16px for table content and form labels. |
| **Headers** | 18–24px for section headers. Semibold, not bold. |
| **Badges** | 11–12px, uppercase or sentence case. |
| **Monospace** | For technical values (port numbers, version strings, IENs). |

### 3.3 Spacing and density

| Element | Direction |
|---------|-----------|
| **Grid** | 8px base unit. |
| **Table row height** | 40–48px. Not compact. |
| **Card padding** | 16–24px. |
| **Left nav width** | 200–240px collapsed labels, expandable. |
| **Content area min-width** | ~780px (1024 − 240 nav). |

### 3.4 Iconography

- **Status icons:** Filled circle (●) for active/connected, half-fill (◐) for partial, empty circle (○) for inactive/not started.
- **Navigation icons:** Simple line icons. Tenants (building), Markets (globe), Packs (package/box), System (gear).
- **Action icons:** Plus (+) for create, ellipsis (⋯) for row menu, arrow (→) for navigation.
- **No custom illustrations** for MVP. Icons only.

---

## 4. Component design specifications

These map to the component vocabulary from the UX/IA document.

### 4.1 RegistryTable

- Sortable columns (click header to sort).
- Filter bar above table: text search input + dropdown filters.
- Row hover state with subtle background highlight.
- Row action menu (⋯) opens dropdown with 2–4 actions.
- Pagination bar below table: "Showing N of M" + page controls.
- Empty state: centered message with guidance ("No tenants yet. Create your first tenant.").

### 4.2 WizardFlow

- Step indicator at top: numbered circles connected by line. Active step = filled + bold. Completed = filled. Upcoming = outlined.
- One content section per step. Vertically scrollable if needed.
- Footer: `[Cancel]` (left-aligned), `[← Back]` and `[Next →]` (right-aligned). Final step: `[Create Tenant]` replaces `[Next →]`.
- Step content: form fields with labels above inputs. Validation errors inline below fields.

### 4.3 StatusBadge

- Pill shape with colored background and contrasting text.
- Sizes: small (inline in tables), medium (in headers/cards).
- States: `ready` (green), `pending` (amber), `archived` (gray), `error` (red), `draft` (blue-gray).

### 4.4 HealthCard

- Card with border. Status color as left border accent (4px).
- Content: component name (bold), status text, detail line (version, count, port).
- Size: ~200×120px. Grid layout, 2–3 per row.

### 4.5 FirstRunBanner

- Full-width, inside content area (not above the top bar).
- Background: light blue or light amber (informational, not alarming).
- Content: welcome message, numbered steps with action links.
- Dismissable: disappears after condition is met (market configured), not via close button.

### 4.6 ProbeResult

- Inline indicator next to the VistA endpoint input.
- States: `probing...` (spinner), `connected` (green check + detail), `failed` (red x + error message).
- Appears after operator enters endpoint and clicks `[Test Connection]`.

---

## 5. Figma Make — primary brief

If using Figma Make or similar AI-to-design tools, input the following structured brief:

```
Design system: Admin dashboard for enterprise healthcare platform.
Audience: Technical operators (not patients, not clinicians).
Mood: Professional, trustworthy, operational. Not clinical, not consumer.
Layout: Fixed left sidebar navigation (200-240px) + content area.
Minimum viewport: 1024px wide.
Screens to generate:
  1. Registry table (tenant list) with filter bar, status badges, row actions, create button.
  2. Multi-step wizard (6 steps) with step indicator, form fields, back/next navigation.
  3. Card grid dashboard (5 health status cards) with status accents.
  4. Registry table grouped by category (pack catalog) with collapsible sections.
  5. Detail view with dimension sections (market readiness) and breadcrumb navigation.
  6. Dashboard with welcome banner and quick stats.
Color tokens: Blue primary, green/amber/red/gray status, neutral backgrounds.
Typography: System font stack, 14-16px body, 18-24px headers.
Icons: Line icons for navigation, filled circles for status.
Do NOT: Copy Epic, Cerner, or any healthcare vendor's admin UI. Use standard admin dashboard patterns.
```

---

## 6. Stitch — secondary brief

If using Stitch (or similar code-generation tools) for rapid prototyping:

```
Framework: React + Tailwind CSS.
Component library: shadcn/ui (or equivalent headless components).
Layout: Sidebar layout with collapsible navigation.
Data: Use sample JSON data (tenants, markets, packs arrays) — no API integration.
Routing: File-based (Next.js app router pattern).
Pages:
  /control-plane/tenants — Table with filter, badges, create button.
  /control-plane/tenants/create — Multi-step form wizard.
  /control-plane/markets — Table with tier and dimension columns.
  /control-plane/markets/[id] — Readiness detail with dimension sections.
  /control-plane/packs — Grouped table with collapsible family sections.
  /control-plane/system — Health card grid.
Do NOT: Add authentication, API calls, or state management beyond local component state.
Do NOT: Import from any proprietary or licensed design system.
```

---

## 7. Review and rejection criteria

### 7.1 Acceptance criteria

A design deliverable is accepted when ALL of the following are true:

| # | Criterion | How to verify |
|---|-----------|--------------|
| 1 | All 8 screens from §2.1 are designed (P0 and P1). | Visual checklist. |
| 2 | Each screen covers all 4 states from §2.2 (default, empty, loading, error). | State matrix review. |
| 3 | Left-nav + content-area layout matches IA from UX/IA §2.1. | Compare nav tree. |
| 4 | Component visual design matches specifications from §4. | Component-by-component review. |
| 5 | Color tokens are within the direction guidance from §3.1. | Token audit. |
| 6 | No vendor UI cloning (clean-room rules from UX/IA §7). | Visual similarity check. |
| 7 | Wizard has exactly 6 steps matching journey §3.1 step definitions. | Step count and content match. |
| 8 | Status badges cover all lifecycle states used in wireframes. | Badge inventory. |
| 9 | No features, surfaces, or data fields not present in wireframes or stories. | Scope audit. |
| 10 | Minimum viewport 1024px, no mobile breakpoints. | Viewport check. |

### 7.2 Rejection triggers

A design deliverable is rejected if ANY of the following are true:

| # | Trigger | Why |
|---|---------|-----|
| R1 | Visual similarity to Epic MyChart admin, Cerner admin, or CPRS preference editor. | Clean-room violation. |
| R2 | Screens or features not traceable to a wireframe or user story. | Scope creep. |
| R3 | Tabbed layout within CP surfaces (not matching IA). | Architectural violation — CP uses list→detail, not tabs. |
| R4 | Patient data or clinical content visible in any CP screen. | CP is platform-operator scope, not clinical. |
| R5 | Color or typography that doesn't follow token guidance. | Brand inconsistency. |
| R6 | Wizard steps don't match the 6-step provisioning journey. | Journey mismatch. |
| R7 | Auto-play animations, confetti, or gamification elements. | Not appropriate for operator tooling. |

---

## 8. Design-to-implementation handoff

After designs are reviewed and accepted:

1. **Figma export:** Export all screens as PNG/SVG for reference in screen-contract instances.
2. **Token extraction:** Extract final color, typography, spacing, and icon tokens as a JSON or CSS custom properties file.
3. **Component inventory:** List all components used across screens as input to the platform UI package (`packages/ui/`).
4. **Screen-contract alignment:** For each designed screen, verify it maps to an existing or newly proposed screen-contract instance. Update screen-contract `layout.zones` and `columns` fields if needed.
5. **Implementation tickets:** Create implementation tickets referencing: (a) the design screen, (b) the user story ID, (c) the screen-contract instance, (d) the API contract (when available).

> **This step (design-to-implementation handoff) is NOT authorized by this document.** This document is a planning artifact. Implementation requires separate authorization, API contracts, and screen-contract instances.

---

## 9. Governing references

| Reference | Location |
|-----------|----------|
| UX/IA and wireframes | `docs/explanation/control-plane-bootstrap-ux-ia-and-wireframes.md` |
| Journeys and stories | `docs/explanation/control-plane-bootstrap-journeys-and-stories.md` |
| Subsystem pattern scan | `docs/explanation/control-plane-bootstrap-subsystem-pattern-scan.md` |
| Screen inventory | `docs/reference/screen-inventory.md` |
| Workspace map | `docs/explanation/information-architecture-workspace-map.md` |
| Pack/adapter governance | `docs/explanation/pack-and-adapter-architecture-governance.md` |
