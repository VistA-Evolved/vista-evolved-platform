# VE-PLAT-ADR-0003: Control plane vs tenant admin

> **Legacy ID:** ADR-0003 (compatibility reference only)

## Status

Accepted.

## Context

We need to distinguish platform-level control (tenants, deployments, system config) from tenant-scoped admin (facility config, users within a tenant, module enablement for a tenant).

## Decision

- **Control plane:** Manages tenants, deployment profiles, capability packs, system-wide config. Lives in `apps/control-plane/`. Not tenant-scoped; operators/super-admins only.
- **Tenant admin:** Per-tenant configuration, facility linkage, module enablement, tenant users. The bounded runtime path is `apps/tenant-admin/`. All operations are scoped to a tenant context.

## Consequences

- Clear separation of who can change what. Control plane and tenant-admin may share domain packages but have different auth and scope.
- The existence of a bounded tenant-admin prototype does not authorize broad GUI claims or imply live VistA verification; proof remains required per governed build rules.
