# Getting Started with VistA Evolved Platform

This tutorial walks you through setting up the development environment and running the platform for the first time.

## Prerequisites

- **Docker Desktop** — required for VistA runtime and PostgreSQL
- **Node.js 20+** — for the API servers
- **PowerShell** — for VistA provisioning scripts (Windows)

## Step 1: Start Infrastructure

```bash
# Start the platform PostgreSQL database
docker compose -f apps/control-plane-api/docker-compose.yml up -d

# Verify it's healthy
docker ps --format "table {{.Names}}\t{{.Status}}" | grep ve-platform-db
```

## Step 2: Start the VistA Runtime

The platform connects to a VistA instance via the XWB RPC broker protocol.

```bash
# Option A: VEHU sandbox (recommended for development)
cd services/vista
docker compose --profile vehu up -d

# Option B: Local distro (from vista-evolved-vista-distro repo)
# See the distro repo's README for build and run instructions.
```

Wait ~15 seconds for VistA to initialize, then verify:

```bash
# Check VistA is responding on the broker port
docker exec vehu bash -c "echo 'VistA is up'"
```

## Step 3: Configure Environment

```bash
# Copy environment templates
cp apps/tenant-admin/.env.example apps/tenant-admin/.env
cp apps/control-plane-api/.env.example apps/control-plane-api/.env
```

Edit the `.env` files to match your VistA instance:

| Variable | Default | Description |
|----------|---------|-------------|
| `VISTA_HOST` | `127.0.0.1` | VistA broker host |
| `VISTA_PORT` | `9431` | VistA broker port (VEHU) |
| `VISTA_ACCESS_CODE` | `PRO1234` | VEHU sandbox access code |
| `VISTA_VERIFY_CODE` | `PRO1234!!` | VEHU sandbox verify code |

## Step 4: Run Migrations

```bash
cd apps/control-plane-api
node --env-file=.env src/server.mjs
# Migrations run automatically on startup
# You should see: "[boot] Migrations complete."
```

## Step 5: Start the Applications

Open separate terminals for each service:

```bash
# Terminal 1: Platform Operations API (port 4510)
cd apps/control-plane-api
node --env-file=.env src/server.mjs

# Terminal 2: Platform Operations Console (port 4500)
cd apps/control-plane
node --env-file=.env server.mjs

# Terminal 3: Site Administration Console (port 4520)
cd apps/tenant-admin
node --env-file=.env server.mjs
```

## Step 6: Verify

Open your browser:

- **Platform Operations Console**: [http://localhost:4500](http://localhost:4500)
- **Site Administration Console**: [http://localhost:4520](http://localhost:4520)

For the Site Administration Console, log in with the VEHU sandbox credentials shown on the login page.

## Architecture Overview

```
┌─────────────────────────┐     ┌──────────────────────┐
│  Platform Operations    │     │  Site Administration  │
│  Console (:4500)        │     │  Console (:4600)      │
│  SaaS business mgmt     │     │  VistA admin (tenant) │
└──────────┬──────────────┘     └──────────┬───────────┘
           │                               │
           ▼                               ▼
┌──────────────────────┐        ┌────────────────────┐
│  Platform Operations │        │  Tenant Admin API  │
│  API (:4510)         │        │  (embedded :4600)  │
│  PG-backed lifecycle │        │  XWB broker → VistA│
└──────────┬───────────┘        └──────────┬─────────┘
           │                               │
           ▼                               ▼
    ┌──────────────┐              ┌──────────────────┐
    │  PostgreSQL   │              │  VistA (VEHU)    │
    │  (:5433)      │              │  (:9431)         │
    └──────────────┘              └──────────────────┘
```

## Next Steps

- Read [AGENTS.md](../../AGENTS.md) for governance rules
- Review [Source of Truth Index](../reference/source-of-truth-index.md) for canonical file locations
- Check [Port Registry](../reference/port-registry.md) for all service ports
