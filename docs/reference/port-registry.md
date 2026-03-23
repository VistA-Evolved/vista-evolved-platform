# Port Registry — VistA Evolved Platform

> Canonical port assignments for **platform** services. Do not use ports
> outside this registry without updating this file.
>
> **VistA runtime ports** (RPC broker, SSH) are managed by the distro repo:
> `vista-evolved-vista-distro/docs/reference/port-registry.md`.

---

## Platform service ports

| Service / component | Port (default) | Protocol | Owner | Docker container |
|---------------------|----------------|----------|--------|-----------------|
| **Admin UI (Next.js)** | **4530** | HTTP | platform | — (node) |
| Operator console (legacy SPA) | 4500 | HTTP | platform | — (node) |
| Platform API (admin backend) | 4510 | HTTP | platform | — (node) |
| Tenant admin API | 4520 | HTTP | platform | — (node) |
| Platform PostgreSQL | 5433 | TCP | platform | ve-platform-db |
| Events / WebSocket | TBD | WS | platform | — |
| Lago billing API | 3040 | HTTP | platform | ve-lago-api |
| Lago billing UI (admin) | 3041 | HTTP | platform | ve-lago-front |

> **Admin UI (port 4530)** is the primary UI serving both `/tenant/*` (site admin) and `/operator/*` (platform ops) via Next.js route namespacing. It proxies API calls to port 4520 (`/api/ta/v1/*`) and port 4510 (`/api/op/v1/*`). The tenant admin SPA on 4520 also serves its own static UI as a lightweight fallback. The operator console on 4500 is the legacy SPA for platform operations.
>
> Set `NEXT_PUBLIC_TENANT_ID` env var to override the default tenant (`default-tenant`) for multi-tenant deployments.

Port assignments are documented in this file and enforced by convention. Override via environment variables or deployment config. Future: `packages/config/ports/` for programmatic port resolution.

---

## Cross-repo port coordination

These ports are assigned in sibling repos. Listed here to prevent collisions.

| Repo | Service | Port | Notes |
|------|---------|------|-------|
| vista-evolved-vista-distro | M-mode RPC broker | 9433 | Distro M-mode lane |
| vista-evolved-vista-distro | M-mode SSH | 2225 | Terminal access |
| vista-evolved-vista-distro | UTF-8 RPC broker | 9434 | Distro UTF-8 lane (primary) |
| vista-evolved-vista-distro | UTF-8 SSH | 2226 | Terminal access |
| VistA-Evolved (archive) | VEHU RPC broker | 9431 | Dev sandbox |
| VistA-Evolved (archive) | Legacy RPC broker | 9430 | Legacy WorldVistA |
| VistA-Evolved (archive) | API server | 3001 | Fastify API |
