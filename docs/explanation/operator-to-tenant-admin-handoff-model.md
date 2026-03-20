# Operator-to-Tenant-Admin Handoff Model

> **Status:** Foundation specification.
> **Type:** Explanation — cross-workspace transition rules.
> **Scope:** Defines how platform operators hand off from the control-plane operator
> console to the tenant-admin workspace, what context transfers, and what does not.
> **Governed by:** AGENTS.md, VE-PLAT-ADR-0003,
> information-architecture-workspace-map.md §10 (cross-workspace transitions).

---

## 1. Purpose

When a platform operator provisions a new tenant, the next step is tenant-admin
setup (users, roles, facilities, VistA connections). This document defines the
handoff boundary between the operator console and the tenant-admin workspace:
what triggers the handoff, what context carries across, and what the receiving
workspace needs to bootstrap itself.

---

## 2. Handoff trigger points

The operator-to-tenant-admin handoff occurs at three natural points in the
tenant lifecycle:

| # | Trigger | Context | Source surface |
|---|---------|---------|---------------|
| 1 | **Post-provisioning completion** | Provisioning run completes successfully → tenant exists and is active | Bootstrap page (post-provisioning card) |
| 2 | **Operator drills into tenant detail** | Operator wants to inspect or configure a specific tenant's internal state | Tenant Detail page (handoff card) |
| 3 | **Operator returns to home** | Operator sees tenant summary and needs to set up a specific tenant | Home page (handoff card) |

---

## 3. Context transfer contract

When the operator transitions from control plane to tenant admin, the following
context must be transferred:

### 3.1 Required context (must be present)

| Field | Source | Purpose |
|-------|--------|---------|
| `tenantId` | Control-plane tenant registry | Scopes the entire tenant-admin session |
| `operatorId` | Control-plane session | Audit trail — who initiated the handoff |

### 3.2 Recommended context (should be present)

| Field | Source | Purpose |
|-------|--------|---------|
| `tenantDisplayName` | Tenant registry | Human-readable label for the session |
| `tenantStatus` | Tenant lifecycle state | Determines available actions |
| `legalMarket` | Effective configuration plan | Constrains locale, regulatory, payer options |
| `effectivePlanId` | Composition service | Links to the resolved pack configuration |
| `provisioningRunId` | Bootstrap service | Reference to the provisioning that created the tenant |

### 3.3 Context that does NOT transfer

| What | Why |
|------|-----|
| Platform operator session | Tenant admin requires its own auth session |
| System-config access | Tenant admin cannot access system-wide settings |
| Other tenant data | Tenant admin is single-tenant scoped |
| Provisioning authority | Cannot initiate or modify provisioning runs |
| Pack authoring access | Cannot create or modify pack definitions |

---

## 4. Handoff mechanism

### 4.1 Current state (planned)

The handoff button in the operator console currently shows "planned" status. When
implemented, the mechanism will be:

```
Operator Console                          Tenant Admin
┌─────────────────┐                      ┌─────────────────┐
│ Tenant Detail    │ ──── handoff URL ──► │ Tenant Dashboard │
│                  │     with tenantId    │                  │
│ [Open Tenant     │                      │ Session scoped   │
│  Admin ↗]        │                      │ to tenantId      │
└─────────────────┘                      └─────────────────┘
```

**URL pattern:** `{tenant-admin-base}/#/dashboard?tenantId={tenantId}`

### 4.2 Auth flow at handoff

1. Operator clicks "Open Tenant Admin" in the operator console.
2. Browser navigates to tenant-admin URL with `tenantId` in the URL.
3. Tenant-admin app checks for existing tenant-admin session.
4. If no session: redirects to tenant-admin auth (operator may need to re-auth with tenant-admin role).
5. If session exists: validates that session's tenant scope matches the `tenantId`.
6. Dashboard loads for the target tenant.

### 4.3 Return path

The tenant-admin workspace should provide a return link to the operator console
for users who also hold the operator role:

```
Tenant Admin → "Back to Operator Console" → Control plane home
```

This is a navigation convenience, not a required architectural component.

---

## 5. Handoff surface implementations (current)

Task 0 implemented handoff signals in three operator console surfaces:

| Surface | Implementation | Status |
|---------|---------------|--------|
| **Home** | Full-width handoff card at bottom of action grid | Implemented (Task 0, `7dd6c72`) |
| **Tenant Detail** | Handoff card with scope list above Actions bar | Implemented (Task 0, `7dd6c72`) |
| **Bootstrap** | "After Provisioning" handoff card below Actions bar | Implemented (Task 0, `7dd6c72`) |

All three buttons currently show `cursor: default; opacity: 0.7` (not clickable)
with title text "Tenant Admin workspace — not yet available". They will become
active links when `apps/tenant-admin/` has a running server.

---

## 6. Safety constraints

1. **Handoff must not leak operator context.** The tenant-admin workspace must
   not inherit the operator's platform-wide access. Tenant admin is always
   single-tenant scoped.
2. **Handoff must not bypass auth.** Even if the operator is already authenticated,
   the tenant-admin workspace must validate that the user has tenant-admin role
   for the specific tenant.
3. **Handoff must be auditable.** Both the operator console (source) and tenant
   admin (destination) must log the cross-workspace transition.
4. **Handoff URL must not contain sensitive data.** Only `tenantId` (a UUID) is
   passed. No credentials, no session tokens, no PHI.

---

## 7. References

| Document | Relevance |
|----------|-----------|
| VE-PLAT-ADR-0003 | Control plane vs tenant admin separation |
| information-architecture-workspace-map.md §10 | Cross-workspace transition rules |
| tenant-admin-architecture-and-boundaries.md | Architecture and boundary rules |
| tenant-admin-personas-jobs-and-first-slice-journeys.md | Who uses tenant admin and how |
