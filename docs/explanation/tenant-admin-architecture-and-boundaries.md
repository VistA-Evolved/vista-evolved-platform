# Tenant Admin Architecture and Boundaries

> **Status:** Foundation specification.
> **Type:** Explanation — architecture rationale.
> **Scope:** Defines the tenant-admin workspace architecture, its boundaries with the control plane
> and clinical workspaces, and the structural rules governing its implementation.
> **Governed by:** AGENTS.md, VE-PLAT-ADR-0003, information-architecture-workspace-map.md §12,
> global-system-architecture-spec.md §13.

---

## 1. Purpose

This document establishes the architectural blueprint for the tenant-admin workspace
(`apps/tenant-admin/`). It converts the governance constraints from VE-PLAT-ADR-0003
and the workspace map (§12) into actionable boundaries, data-flow rules, and
implementation constraints.

---

## 2. Workspace identity

| Property | Value |
|----------|-------|
| **Workspace family** | Tenant operational admin (family #2 in workspace map §7) |
| **App location** | `apps/tenant-admin/` |
| **Runtime** | Standalone app — separate from `apps/control-plane/` |
| **Audience** | Tenant administrators, delegated IT staff |
| **Scope** | Always tenant-scoped; single tenant context per session |
| **Auth model** | Tenant-scoped session — user must have tenant-admin role for the target tenant |
| **Data plane** | Platform PG (tenant governance) + VistA (clinical config reads) |

---

## 3. Separation from control plane

Per VE-PLAT-ADR-0003:

| Concern | Control plane | Tenant admin |
|---------|--------------|--------------|
| **Scope** | Platform-wide — all tenants, all markets | Single-tenant — own tenant only |
| **Audience** | Platform operators, super-admins | Tenant administrators |
| **Data visibility** | All tenants, all provisioning, all markets | Own tenant's config, facilities, users |
| **Write authority** | System config, pack catalog, market profiles, tenant lifecycle | Facility config, user management, module enablement, site parameters |
| **App location** | `apps/control-plane/` | `apps/tenant-admin/` |
| **API surface** | Control-plane operator API (port 4500/4510) | Tenant-admin API (TBD port) |

**Hard boundary rules:**

1. Tenant admin cannot list or modify other tenants.
2. Tenant admin cannot modify platform-wide settings (system config, markets, packs).
3. Control plane does not expose tenant-internal configuration surfaces.
4. Cross-boundary access is via contracts only (OpenAPI). No direct imports.

---

## 4. Concern areas and VistA grounding

| Concern area | Description | VistA grounding | Platform PG |
|-------------|-------------|-----------------|-------------|
| **Facility management** | Register and configure facilities within the tenant | File 4 (Institution), File 44 (Hospital Location) | `facility`, `facility_location` |
| **User management** | Create, assign, manage user accounts | File 200 (New Person) | `tenant_user`, `user_role_assignment` |
| **Role assignment** | Map users to roles and permission sets | File 200.01 (Security Key) | `role`, `permission` |
| **Module enablement** | Enable/disable modules within entitlement | — (platform-only concern) | `tenant_module`, `tenant_feature_flag` |
| **Site parameters** | Facility-level operational parameters | File 8989.3 (Package Parameters), File 4.3 (Division) | `site_parameter` |
| **VistA connections** | Manage VistA instance bindings per facility | — (infrastructure) | `vista_instance`, `facility_vista_binding` |
| **Device defaults** | Printers, scanners, DICOM devices | File 3.5 (Device) | `device_config` |
| **Content administration** | Pack content lifecycle within tenant scope | — (specialty-content spec) | Pack activation records |

---

## 5. Boundary constraints

### 5.1 What tenant admin must NOT do

- **No patient data.** Tenant admin never renders or processes PHI/patient-identifiable data. Cross-workspace transition to clinical workspace required for clinical verification.
- **No platform-wide visibility.** Cannot see other tenants, markets they don't belong to, or system configuration.
- **No pack authoring.** Pack creation and lifecycle management is a control-plane concern. Tenant admin can only enable/disable packs within their entitlement.
- **No readiness truth.** Tenant admin activates capabilities but does not set readiness state. Readiness is determined by the governance/readiness service.
- **No provisioning.** Provisioning runs are initiated and managed from the control plane. Tenant admin sees provisioning status but cannot initiate or modify runs.

### 5.2 What tenant admin MUST do

- **VistA-grounded configuration.** Facility and user configuration must reflect VistA truth where VistA owns the data. Platform PG stores tenant-governance data only.
- **Integration-pending states.** When a VistA adapter or connection is unavailable, show explicit `integration-pending` status — never silently fake success.
- **Audit all writes.** Every configuration change must be logged to the tenant-scoped audit trail with actor, action, before/after state, and timestamp.
- **Respect entitlements.** Only show modules and capabilities that the tenant's effective configuration plan includes.

---

## 6. Data flow model

```
Control Plane (platform-wide)
  │
  ├── Effective configuration plan ──► Tenant Admin (tenant-scoped)
  ├── Pack activations                     │
  ├── Capability posture                   ├── Reads: VistA (clinical config, files)
  └── Tenant identity                      ├── Reads: Platform PG (tenant governance)
                                           ├── Writes: Platform PG (facility, user, config)
                                           └── Writes: VistA (site parameters, user setup)
                                                └── via VistA adapter contracts only
```

**Input from control plane:**
- Tenant identity and status (from tenant portfolio service)
- Effective configuration plan (from composition service)
- Pack and capability entitlements (from governance service)

**Tenant admin's own data:**
- Facility topology and location hierarchy
- User accounts and role assignments
- Module enablement and feature flags
- Site parameters and device configuration
- VistA instance connection configuration

---

## 7. Implementation posture

| Aspect | Current state | Target state |
|--------|--------------|--------------|
| App shell | Not started | `apps/tenant-admin/` — standalone app |
| API | Not started | Tenant-admin API routes (tenant-scoped auth) |
| Auth | Not started | Tenant-scoped session; user must have tenant-admin role |
| VistA integration | Not started | Read VistA files via adapter; write site params via VistA RPCs |
| Platform PG | Schema exists for modules, feature flags | Extend for facility, user, site params |
| Design | Not started | Follows operator console design system (shared `packages/ui/`) |

---

## 8. References

| Document | Relevance |
|----------|-----------|
| VE-PLAT-ADR-0003 | Control plane vs tenant admin separation decision |
| Information architecture workspace map §12 | Tenant-admin workspace definition |
| Global system architecture §13 | CP vs TA audience rules |
| Control-plane service map §1 | Four-layer model (tenant runtime plane) |
| Organization-facility-network-service model | Entity model for facilities, users, roles |
| Boundary policy | Cross-boundary access rules |
