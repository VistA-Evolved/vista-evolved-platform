# Tenant Admin Design Contract v1

> **Status:** Canonical — first version of the tenant-admin workspace design contract.
> **Date:** 2026-03-21.
> **Type:** Explanation — design contract for all tenant-admin surfaces.
>
> **Upstream inputs:**
> - `tenant-admin-architecture-and-boundaries.md` — workspace identity, concern areas, boundaries
> - `tenant-admin-vista-truth-map.md` — VistA file/RPC grounding per concern area
> - `tenant-admin-personas-jobs-and-first-slice-journeys.md` — personas, jobs, first-slice surfaces
> - `operator-to-tenant-admin-handoff-model.md` — cross-workspace transition contract
> - `operator-console-design-contract-v3.md` — reference design system (shell regions, badge system)
>
> **Downstream consumers:**
> - Shell implementation (`apps/tenant-admin/`)
> - Screen-contract instances (`packages/contracts/screen-contracts/tenant-admin.*.json`)
> - QA reviewers, design hand-off

---

## 1. Scope

This contract defines:

- Shell anatomy (regions every tenant-admin surface inherits)
- Left-nav rules (concern-area grouping)
- Page header rules
- Source-posture badge system (inherits operator console badge vocabulary)
- State-badge system (inherits operator console badge vocabulary)
- VistA-grounding display rules
- Empty / error / loading state rules
- Copy and language rules
- Per-surface reject/ready checklists
- Cross-workspace transition rules (inbound from operator console)

This contract does **not** define:

- API contracts (see OpenAPI specs in `packages/contracts/`)
- Data schemas (see JSON Schema in `packages/contracts/schemas/`)
- Operator console surfaces (see `operator-console-design-contract-v3.md`)
- Clinical workspace surfaces (separate workspace family)

---

## 2. Shell Anatomy

Every page in the tenant-admin workspace inherits a fixed shell:

```
┌─────────────────────────────────────────────────────────────────────┐
│  TENANT BANNER  (tenant name + status, always visible)              │
├──────────┬──────────────────────────────────────────────────────────┤
│          │  PAGE HEADER                                             │
│  LEFT    │  ─────────────────────────────────────────────────────── │
│  NAV     │  CONTENT AREA (surface-specific)                        │
│          │    ┌──────────────────────────────┬────────────────────┐ │
│  concern │    │  PRIMARY REGION              │  CONTEXT RAIL      │ │
│  area    │    │  (table / card grid / form)  │  (detail only)     │ │
│  groups  │    │                              │                    │ │
│          │    └──────────────────────────────┴────────────────────┘ │
│          │  ─────────────────────────────────────────────────────── │
│          │  STATUS BAR  (tenant ID + return link)                   │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.1 Region inventory

| Region | Present on | Purpose |
|--------|-----------|---------|
| Tenant Banner | Every page | Tenant identity, lifecycle status, tenant-scoped context |
| Left Nav | Every page | Concern-area navigation, surface links, role badge |
| Page Header | Every page | Breadcrumb, surface title, posture badge, subtitle |
| Filter Rail | List surfaces | Status filter, search, result count |
| Primary Region | Every page | Surface-specific content (tables, cards, forms) |
| Context Rail | Detail surfaces | Entity identity, status badge, available actions |
| Status Bar | Every page | Tenant ID, return-to-operator link |

### 2.2 Region differences from operator console

| Region | Operator console | Tenant admin |
|--------|-----------------|--------------|
| Top banner | Review runtime banner | Tenant identity banner |
| Nav grouping | 8 platform domains | Concern-area groups (§3) |
| Status bar | Copilot drawer trigger | Return-to-operator link |
| Scope indicator | Platform-wide | Tenant-scoped (tenantId in every request) |

---

## 3. Left-Nav Rules

### 3.1 Concern-area groups

The left nav displays concern-area groups in this order:

| # | Group label | Surface links | Priority |
|---|-------------|---------------|----------|
| 1 | **Dashboard** | Tenant Dashboard | P0 |
| 2 | **Users & Roles** | User List, Role Assignment | P0 |
| 3 | **Facilities** | Facility List | P0 |
| 4 | **Modules** | Module Entitlements | P1 |
| 5 | **VistA Connections** | Connection Management | P1 |
| 6 | **Site Parameters** | Site Parameters | P2 |

Detail surfaces (User Detail, Facility Detail) are drill targets, not primary nav links.
They appear as breadcrumb-aware highlighted items when the tenant admin is viewing them.

### 3.2 Nav rendering rules

1. Group labels are uppercase, non-clickable dividers (same pattern as operator console §3.2).
2. Surface links are indented under their group.
3. Active surface is highlighted with left-border accent.
4. Groups with zero implemented surfaces are hidden entirely (not greyed, not muted).
5. Dashboard is always first — standalone link above the first divider.
6. Role badge appears at bottom: `[Role: Tenant Admin]` or `[Role: User Manager]`.
7. Display labels use operational vocabulary, not architecture vocabulary (§7).

### 3.3 Nav state indicators

Inherits the operator console badge vocabulary (§3.3 of design-contract-v3):

| Indicator | Meaning | Visual |
|-----------|---------|--------|
| Count badge | Actionable items | Numeric pill on nav link — P0 surfaces only |
| Dot indicator | Attention items exist | Small dot — P1 surfaces |
| No indicator | No pending work or P2 surface | Clean link |

---

## 4. Page Header Rules

Every surface renders a page header:

```
┌──────────────────────────────────────────────────────────────────┐
│  [Group] › [Surface Title]                       [Source Badge]   │
│  [Subtitle: admin question]                                      │
│  ────────────────────────────────────────────────────────────── │
│  [Breadcrumb]  [← Return to Operator Console]  [⟳]  [Last: HH:MM]│
└──────────────────────────────────────────────────────────────────┘
```

### 4.1 Header field rules

| Field | Rule |
|-------|------|
| Group | First breadcrumb segment. Matches nav group label. |
| Surface Title | Matches `title` in screen contract. |
| Source Badge | Data-source posture for this surface (§5). |
| Subtitle | The admin question this surface answers. |
| Breadcrumb | Group › Surface Title. Detail surfaces add entity ID as third segment. |
| Return link | Navigates back to operator console tenant detail. Only visible when entered via handoff. |
| Refresh | Triggers re-fetch. Present on every non-static surface. |
| Timestamp | ISO 8601, operator-local timezone. Shows last data fetch time. |

### 4.2 Header consistency rules

1. All fields present on every surface. Static surfaces omit refresh/timestamp.
2. Subtitle is never empty — each surface has a defined admin question.
3. Breadcrumb segments are navigable links except the current segment.
4. Return link carries `tenantId` context back to operator console.

---

## 5. Source-Posture Badge System

Inherits the operator console source-posture badge vocabulary:

| Badge | Color | Meaning |
|-------|-------|---------|
| `REAL` | green | Data sourced from platform PG or VistA via live connection |
| `FIXTURE` | amber | Data sourced from local fixture files (review/dev mode) |
| `MIXED` | teal | Some fields real, some fixture |
| `PENDING` | grey | Data source not yet connected — returns `integration-pending` |

### 5.1 VistA-grounding posture

Tenant-admin surfaces frequently display data that should be grounded in VistA.
Each such field has a grounding posture:

| Posture | Meaning | Display |
|---------|---------|---------|
| `GROUNDED` | Field value confirmed via VistA RPC | No indicator (normal state) |
| `UNGROUNDED` | Field value from platform PG, VistA not yet queried | Subtle dashed underline |
| `INTEGRATION_PENDING` | VistA connection not available | Inline `(VistA pending)` tag |

### 5.2 Grounding display rules

1. Grounded fields display normally — no visual noise.
2. Ungrounded fields have a subtle dashed underline to signal "platform value, not yet verified against VistA."
3. Integration-pending fields show inline tag. The tag is informational, not a blocker.
4. A surface with all fields ungrounded shows `PENDING` source badge.
5. A surface with mixed grounded/ungrounded shows `MIXED` source badge.

---

## 6. State-Badge System

Inherits the operator console state-badge vocabulary for lifecycle states:

### 6.1 User states

| State | Color | Meaning |
|-------|-------|---------|
| `ACTIVE` | green | User is active and can authenticate |
| `INACTIVE` | grey | User account disabled |
| `PENDING` | amber | User invited but not yet confirmed |

### 6.2 Facility states

| State | Color | Meaning |
|-------|-------|---------|
| `ACTIVE` | green | Facility operational |
| `INACTIVE` | grey | Facility not operational |
| `PENDING` | amber | Facility registered but not yet configured in VistA |

### 6.3 Module states

| State | Color | Meaning |
|-------|-------|---------|
| `ENABLED` | green | Module active for this tenant |
| `DISABLED` | grey | Module not enabled |
| `PENDING` | amber | Module enabled but adapter not connected |

---

## 7. Language and Copy Rules

### 7.1 Vocabulary mapping

| Architecture term | Display label |
|-------------------|--------------|
| File 200 | Users |
| File 19.1 / Security Key | Roles / Permissions |
| File 4 / Institution | Facilities |
| File 44 / Hospital Location | Locations / Clinics |
| Module entitlement | Module settings |
| VistA connection | System connection |
| Site parameter | Site settings |
| DUZ | (never shown to user) |
| IEN | (never shown to user — use display name) |
| tenantId | (never shown to user — use tenant name) |

### 7.2 Copy rules

1. Operator question subtitles answer "What does this admin need to know?"
2. Never reveal VistA file numbers, RPC names, or IEN values in the UI.
3. VistA grounding tags use plain language: "VistA pending" not "RPC unavailable."
4. Action labels use imperative verb + noun: "Add user", "Assign role", "View details."
5. Empty states use helpful language: "No users yet. Users will appear after provisioning."
6. Error states explain what happened and suggest retry: "Could not load users. Check VistA connection status."

---

## 8. Empty, Error, and Loading State Rules

Inherits the operator console three-state model:

### 8.1 Loading state

- Skeleton placeholders matching content layout dimensions.
- Loading spinner in page header only (not inline).
- "Loading [entity]..." accessible label.

### 8.2 Empty state

- Centered illustration placeholder (optional, not required for first slice).
- Primary message: "No [entity_plural] found."
- Secondary message: context-specific guidance (e.g., "Users will appear after VistA user provisioning.").
- Primary action button if applicable (e.g., "Add user" on empty user list).

### 8.3 Error state

- Amber background card.
- Error message: "Could not load [entity_plural]."
- Detail: source-specific (e.g., "VistA connection timed out" or "Platform database unavailable").
- Retry button.
- Timestamp of failure.

---

## 9. Cross-Workspace Transition Rules

### 9.1 Inbound from operator console

The tenant-admin workspace receives context from the operator console via URL parameters:

| Parameter | Required | Source |
|-----------|----------|--------|
| `tenantId` | Yes | Operator console tenant registry |
| `operatorId` | Yes | Operator session |
| `returnUrl` | No | Operator console URL for return navigation |

### 9.2 Inbound handling rules

1. On landing, validate `tenantId` exists and the admin has access.
2. If `tenantId` is invalid or unauthorized, show "Tenant not found" error page — not a redirect.
3. Store `tenantId` in session context for all subsequent requests.
4. Show return link in status bar if `returnUrl` is provided.

### 9.3 Outbound transitions

The tenant-admin workspace does **not** initiate transitions to:
- Operator console (return link, not a transition)
- Clinical workspace (separate workspace family, no direct link)
- Other tenant-admin workspaces (scoped to one tenant)

---

## 10. Per-Surface Reject/Ready Checklists

### 10.1 Tenant Dashboard (`tenant-admin.dashboard`)

| Gate | Ready | Reject |
|------|-------|--------|
| Tenant identity | Tenant name + status displayed | Missing tenant context |
| Summary cards | User count, facility count, module count | Cards fabricated or hardcoded |
| Source badges | Per-card source badge visible | Any card missing source badge |
| VistA grounding | Grounding status indicated per concern area | No grounding indication |
| Drill links | Each card navigates to correct list surface | Dead links |
| Return link | Return-to-operator link functional | Return link broken or missing |

### 10.2 User List (`tenant-admin.users.list`)

| Gate | Ready | Reject |
|------|-------|--------|
| User table | Columns: name, role, status, VistA DUZ grounding | Missing columns |
| Source badge | Shows REAL/FIXTURE/PENDING | Source badge hidden |
| Filter rail | Status filter + search functional | No filtering |
| Empty state | Helpful message when no users | Blank page or error |
| Drill to detail | Row click navigates to user detail | No drill target |
| Pagination | Visible when users > page size | Pagination missing |

### 10.3 User Detail (`tenant-admin.users.detail`)

| Gate | Ready | Reject |
|------|-------|--------|
| User identity | Name, username, title, status | Missing identity fields |
| VistA grounding | DUZ reference, File 200 grounding status | No grounding indicator |
| Role display | Assigned roles listed | Roles missing |
| Context rail | User identity + status + available actions | No context rail |
| Breadcrumb | Users & Roles › User List › [User Name] | Incorrect breadcrumb |
| Edit posture | Edit actions governed by write contract | Uncontrolled writes |

### 10.4 Role Assignment (`tenant-admin.roles.assignment`)

| Gate | Ready | Reject |
|------|-------|--------|
| Role list | Available roles with descriptions | Roles hardcoded |
| Assignment view | Users assigned to each role | No user association |
| VistA grounding | Security key references (File 19.1) | No VistA grounding |
| Source badge | Shows actual source posture | Badge hidden |
| Write contract | Role changes require confirmation | Unconfirmed writes |

### 10.5 Facility List (`tenant-admin.facilities.list`)

| Gate | Ready | Reject |
|------|-------|--------|
| Facility table | Columns: name, type, status, VistA IEN grounding | Missing columns |
| Hierarchy | Institution → Division → Location tree visible | Flat list only |
| Source badge | REAL/FIXTURE/PENDING | Badge hidden |
| Filter rail | Type filter + search functional | No filtering |
| Empty state | Helpful message when no facilities | Blank page |
| Drill to detail | Row click navigates to facility detail | No drill target |

### 10.6 Facility Detail (`tenant-admin.facilities.detail`)

| Gate | Ready | Reject |
|------|-------|--------|
| Facility identity | Name, type, parent facility, status | Missing fields |
| VistA grounding | File 4/44 IEN reference, grounding status | No grounding indicator |
| Child locations | Child clinics/wards listed | No hierarchy display |
| Context rail | Facility identity + status + actions | No context rail |
| Breadcrumb | Facilities › Facility List › [Facility Name] | Incorrect breadcrumb |

---

## 11. Review Checklist — Entire Tenant Admin Workspace (v1)

| # | Gate | Pass criteria |
|---|------|--------------|
| 1 | Concern-area left nav | Groups in correct order per §3.1 |
| 2 | Tenant banner | Tenant name + status always visible |
| 3 | All P0 surfaces rendered | Dashboard, User List, User Detail, Role Assignment, Facility List accessible |
| 4 | Page header on every surface | Group, title, source badge, subtitle, breadcrumb |
| 5 | Filter rail on list surfaces | Status filter + search + count |
| 6 | Context rail on detail surfaces | Entity identity + status + actions |
| 7 | Source badges visible everywhere | No surface without a source badge |
| 8 | State badges consistent | All status values use correct color |
| 9 | VistA grounding displayed | Grounding posture visible on all VistA-sourced fields |
| 10 | Empty/error/loading handled | All three states per surface |
| 11 | Language rules followed | No architecture vocabulary in UI |
| 12 | Cross-workspace transition | Inbound from operator console works with tenantId |
| 13 | Return link functional | Navigates back to operator console |
| 14 | No fabricated data | No fake counts, names, or statuses |
| 15 | Tenant-scoped context | Every request includes tenantId |

---

## 12. Versioning

| Version | Document | Status |
|---------|----------|--------|
| **v1** | **This document** | **Canonical** — first version |

See `docs/reference/source-of-truth-index.md` for the official registry.
