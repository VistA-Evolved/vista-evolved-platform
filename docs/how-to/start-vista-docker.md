# Start VistA Docker

## Quick Start (VEHU Lane — Recommended)

```powershell
# Start VistA VEHU sandbox (port 9431)
cd services\vista
docker compose --profile vehu up -d

# Verify healthy
docker ps --format "table {{.Names}}\t{{.Status}}" | Select-String vehu
```

## Start Platform Database

```powershell
# Start PostgreSQL for platform control plane (port 5433)
cd services\platform-db
docker compose up -d

docker ps --format "table {{.Names}}\t{{.Status}}" | Select-String "ve-platform"
```

## Full Stack Startup Order

1. VistA VEHU (`services/vista` — profile `vehu`)
2. Platform DB (`services/platform-db`)
3. Lago billing (`services/lago`)
4. `apps/tenant-admin/server.mjs` (port 4520)
5. `apps/control-plane-api/src/server.mjs` (port 4510)
6. `apps/admin-ui` Next.js dev server (port 4530) — optional

## Stop Everything

```powershell
docker compose -f services/vista/docker-compose.yml --profile vehu down
docker compose -f services/platform-db/docker-compose.yml down
docker compose -f services/lago/docker-compose.yml down
```

!!! tip "Port conflicts"
    If ports are already in use, check `netstat -an | findstr "9431 9430 4520 4510 5433"` before starting.

## Lane Reference

| Lane | Port | Container | Use Case |
|------|------|-----------|----------|
| VEHU (recommended) | 9431 | `vehu` | All new development |
| Legacy WorldVistA | 9430 | `wv` | Reference only |
| Distro build | 9433 | `local-vista` | Custom distro testing |
