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
| **Web UI (React + Vite)** | **3000** | HTTP | platform | — (node/vite) |
| ~~Admin UI (Next.js)~~ | ~~4530~~ | ~~HTTP~~ | ~~platform~~ | **ARCHIVED — moved to `_archived/apps/admin-ui/`** |
| Operator console API | 4500 | HTTP | platform | — (node) |
| Platform API (admin backend) | 4510 | HTTP | platform | — (node) |
| Tenant admin API | 4520 | HTTP | platform | — (node) |
| Platform PostgreSQL | 5433 | TCP | platform | ve-platform-db |
| Events / WebSocket | TBD | WS | platform | — |
| Lago billing API | 3040 | HTTP | platform | ve-lago-api |
| Lago billing UI (admin) | 3041 | HTTP | platform | ve-lago-front |

> **Web UI (port 3000)** is the active unified frontend (React + Vite + Tailwind).
> It proxies `/api/ta/v1/*` to tenant admin API on port 4520 and `/api/op/v1/*`
> to the platform API on port 4510.
>
> The old Admin UI (Next.js, port 4530) and the old vanilla SPAs served from
> ports 4500 and 4520 have been archived to `_archived/`. Do not use them.

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
