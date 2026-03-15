# ADR-0003: Control plane vs tenant admin

> **Enterprise ID:** VE-PLAT-ADR-0003

## Status

Accepted.

## Context

We need to distinguish platform-level control (tenants, deployments, system config) from tenant-scoped admin (facility config, users within a tenant, module enablement for a tenant).

## Decision

- **Control plane:** Manages tenants, deployment profiles, capability packs, system-wide config. Lives in `apps/control-plane/`. Not tenant-scoped; operators/super-admins only.
- **Tenant admin:** Per-tenant configuration, facility linkage, module enablement, tenant users. Exposed via **admin console** (`apps/admin-console/`) or APIs consumed by tenant admins. All operations are scoped to a tenant context.

## Consequences

- Clear separation of who can change what. Control plane and admin console may share domain packages but have different auth and scope.
