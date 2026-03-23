# VE-PLAT-ADR-0005: Rename ve-control-plane-db to ve-platform-db

**Status:** accepted
**Date:** 2026-03-22
**Deciders:** Platform team

## Context

The PostgreSQL container for the operator console backend was named
`ve-control-plane-db`. This name was confusing because:

1. "Control plane" is an infrastructure term that doesn't align with
   how senior SaaS professionals describe the operator/business layer.
2. The database serves the entire platform's operator-side persistence,
   not just a narrow "control plane" component.
3. In Docker Desktop, `ve-control-plane-db` appeared alongside
   `local-vista-utf8`, creating the impression of two unrelated systems
   rather than parts of one platform.

## Decision

Rename the Docker service from `control-plane-db` to `platform-db` and
the container from `ve-control-plane-db` to `ve-platform-db`. The volume
name changes from `cp-pgdata` to `platform-pgdata`.

The internal database name (`control_plane`) and credentials (`cp_admin`)
are unchanged to avoid breaking existing migration history and connection
strings.

## Consequences

- Docker Desktop now shows `ve-platform-db` — clearer for operators.
- The volume rename means a fresh database on first `docker compose up`.
  Migrations re-apply cleanly (idempotent, forward-only).
- Existing `.env` files with `CONTROL_PLANE_PG_URL` continue to work
  unchanged since the connection string targets `127.0.0.1:5433`, not
  the container name.
