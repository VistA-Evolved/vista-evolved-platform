# VistA Evolved Platform

Control plane, tenant-admin APIs, and unified web UI for the VistA Evolved rebuild.

## Quick start

```powershell
# 1. Start Docker Desktop, then:
docker start local-vista-utf8                                          # VistA broker on :9434
docker compose -f apps/control-plane-api/docker-compose.yml up -d      # Postgres on :5433

# 2. Start backend APIs
cd apps/tenant-admin   && node --env-file=.env server.mjs &            # :4520
cd apps/control-plane-api && node --env-file=.env src/server.mjs &     # :4510
cd apps/control-plane  && node server.mjs &                            # :4500

# 3. Start the web UI
cd apps/web && npm run dev                                             # :3000
```

Open **http://localhost:3000** to access the UI.

## Repo layout

| Path | Purpose | Status |
|------|---------|--------|
| **`apps/web/`** | React + Vite + Tailwind unified UI (port 3000) | **Active — current frontend** |
| `apps/tenant-admin/` | VistA XWB broker API — 70+ routes, 7 domains (port 4520) | Active backend |
| `apps/control-plane-api/` | PG-backed tenant lifecycle, billing, provisioning (port 4510) | Active backend |
| `apps/control-plane/` | Operator console review runtime (port 4500) | Active backend |
| `apps/terminal-proof/` | SSH terminal proxy for browser terminal | Active |
| `packages/` | Contracts (OpenAPI, AsyncAPI, schemas), config, domain, UI design-system | Active |
| `docs/` | Tutorials, how-to, reference, explanation, ADRs, runbooks | Active |
| `prompts/` | Active prompts, templates | Active |
| `_archived/` | Archived frontends (admin-ui, old SPAs) — reference only, gitignored | **Archived** |

### Archived frontends (do not use for new work)

The following old UIs have been moved to `_archived/`:

- `_archived/apps/admin-ui/` — Next.js 15 unified admin (port 4530) — archived 2026-04-04
- `_archived/apps/control-plane/public/` — vanilla JS operator SPA
- `_archived/apps/tenant-admin/public/` — vanilla JS tenant admin SPA

The replacement frontend is **`apps/web/`** (React + Vite + Tailwind on port 3000).
It proxies API calls to the backend services (tenant-admin :4520, control-plane-api :4510).

## Related repos

| Repo | Purpose |
|------|---------|
| **vista-evolved-vista-distro** | VistA Docker runtime (UTF-8 lane), upstream pins, overlay routines |
| VistA-Evolved | **Frozen/archived** — original monorepo, reference only |

See `docs/reference/source-of-truth-index.md` and `AGENTS.md` for full governance.
