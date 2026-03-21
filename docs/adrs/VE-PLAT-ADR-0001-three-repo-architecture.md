# VE-PLAT-ADR-0001: Three-repo architecture

> **Legacy ID:** ADR-0001 (compatibility reference only)

## Status

Accepted.

## Context

The original VistA-Evolved monorepo mixed control plane, admin UI, VistA distro tooling, and product features in one repository. We need a clear separation for rebuild: platform (control plane, contracts, config), VistA distro (upstream/overlay, build, verify), and archive (frozen reference).

## Decision

- **VistA-Evolved (archive)** — Frozen prototype/salvage/reference. No new canonical product work. Reusable process assets may be copied out.
- **vista-evolved-platform** - Control plane, tenant-admin prototype shell, admin-console placeholder, contracts (OpenAPI, AsyncAPI, schemas), config (ports, modules, tenants), domain, UI design system. No VistA runtime or distro build.
- **vista-evolved-vista-distro** — VistA upstream fetch/pin, overlay (routines, install, patches), docker (e.g. local-vista), build/verify scripts. No platform app code.

## Consequences

- Clear ownership and boundaries. Platform and distro can evolve independently. Archive remains stable reference.
