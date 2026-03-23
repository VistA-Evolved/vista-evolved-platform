# Lago Billing Setup Runbook

## Overview

VistA Evolved uses [Lago](https://getlago.com) (v1.44.0) as its self-hosted billing engine.
Lago provides usage-based billing, subscription management, invoicing, and customer management.

## Prerequisites

- Docker and Docker Compose installed
- `openssl` available (or Docker for key generation)
- Port 3040 (Lago API) and 3041 (Lago UI) available

## Initial Setup

### 1. Generate the RSA Private Key

Lago requires an RSA private key for JWT signing. Generate it once:

```powershell
# From repo root
docker run --rm -v "${PWD}/services/lago:/out" alpine/openssl genrsa -out /out/lago-rsa.pem 2048
```

The key is gitignored. It lives at `services/lago/lago-rsa.pem`.

> **PRODUCTION**: Use at least 4096 bits. Rotate annually. Store in a secrets manager.

### 2. Start Lago Services

```powershell
docker compose -f services/lago/docker-compose.yml up -d
```

The startup sequence:
1. `lago-db` (PostgreSQL with pg_partman) — starts and becomes healthy
2. `lago-redis` — starts and becomes healthy
3. `lago-migrate` — runs DB migrations (exits 0 when done)
4. `lago-api`, `lago-worker` — start after migration completes
5. `lago-front` — starts after API becomes healthy

### 3. Verify the Org Was Created

The `LAGO_CREATE_ORG=true` env var auto-creates the organization on first boot.

```powershell
$key = "ve-lago-api-key-change-in-production"
Invoke-WebRequest -UseBasicParsing `
  -Uri "http://127.0.0.1:3040/api/v1/organizations" `
  -Headers @{Authorization="Bearer $key"} | Select-Object -ExpandProperty Content
```

Expected: `{"organization":{"name":"VistA Evolved",...}}`

### 4. Wire API Key into Control-Plane API

The API key is configured in `apps/control-plane-api/.env`:

```
LAGO_API_URL=http://127.0.0.1:3040/api/v1
LAGO_API_KEY=ve-lago-api-key-change-in-production
```

Restart the API to pick up changes:
```powershell
# Find process on port 4510 and restart
$pid = (Get-NetTCPConnection -LocalPort 4510 -State Listen).OwningProcess
Stop-Process -Id $pid -Force
Start-Sleep 1
node --env-file=apps/control-plane-api/.env apps/control-plane-api/src/server.mjs
```

### 5. Verify Billing Connection

```powershell
Invoke-WebRequest -UseBasicParsing `
  -Uri "http://127.0.0.1:4510/api/control-plane/v1/billing/status" | 
  Select-Object -ExpandProperty Content
```

Expected: `{"ok":true,"billing":{"configured":true,"provider":"lago",...}}`

## Default Credentials

| Setting | Dev Value | Production |
|---------|-----------|------------|
| Organization | VistA Evolved | Set via LAGO_ORG_NAME |
| Admin Email | admin@vista-evolved.io | Set via LAGO_ORG_USER_EMAIL |
| Admin Password | VeAdmin2026!! | Set via LAGO_ORG_USER_PASSWORD |
| API Key | ve-lago-api-key-change-in-production | Set via LAGO_ORG_API_KEY |
| UI URL | http://127.0.0.1:3041 | Configure behind reverse proxy |

## Lago UI Access

Navigate to **http://127.0.0.1:3041** and sign in with:
- Email: `admin@vista-evolved.io`
- Password: `VeAdmin2026!!`

From the UI you can:
- Create billing plans
- View customer (tenant) subscriptions
- Review invoices
- Configure webhooks

## API Reference

All Lago API calls use Bearer token auth:

```
Authorization: Bearer ve-lago-api-key-change-in-production
```

Key endpoints via control-plane-api proxy (`http://127.0.0.1:4510`):

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/control-plane/v1/billing/status` | GET | Check Lago connection |
| `/api/control-plane/v1/billing/customers` | POST | Create tenant customer |
| `/api/control-plane/v1/billing/customers/:id` | GET | Get customer details |
| `/api/control-plane/v1/billing/subscriptions` | POST | Assign plan |
| `/api/control-plane/v1/billing/events` | POST | Submit usage event |
| `/api/control-plane/v1/billing/invoices/:id` | GET | Get invoice |

## Production Secrets

Replace ALL dev placeholder values before production deployment:

```yaml
# services/lago/docker-compose.yml
SECRET_KEY_BASE: $(openssl rand -hex 64)
LAGO_ENCRYPTION_PRIMARY_KEY: $(openssl rand -hex 32)
LAGO_ENCRYPTION_DETERMINISTIC_KEY: $(openssl rand -hex 32)
LAGO_ENCRYPTION_KEY_DERIVATION_SALT: $(openssl rand -hex 32)
LAGO_ORG_API_KEY: $(openssl rand -hex 32)
LAGO_ORG_USER_PASSWORD: <strong-password>
```

Also update `lago-rsa.pem` with a 4096-bit key:
```bash
openssl genrsa -out lago-rsa.pem 4096
```

## Troubleshooting

### API returns `configured: false`

Check env vars are loaded:
```powershell
# Verify API has the right env
Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:4510/api/control-plane/v1/billing/status"
```

If `configured: false`, restart control-plane-api with `--env-file=apps/control-plane-api/.env`.

### Lago containers not starting

1. Check if `services/lago/lago-rsa.pem` exists — if not, run step 1 above.
2. Check migration logs: `docker logs ve-lago-migrate`
3. Check API logs: `docker logs ve-lago-api`

### `pg_partman` extension error

If using plain `postgres:14-alpine` instead of `getlago/postgres-partman:15.0-alpine`:
```
ERROR: could not open extension control file ".../pg_partman.control": No such file
```
Fix: Use `getlago/postgres-partman:15.0-alpine` as the DB image (already configured).

### After `docker compose down -v`

All data is lost. Lago auto-recreates the org on next startup via `LAGO_CREATE_ORG=true`.
The RSA key file persists (it's on the host filesystem, not in a volume).
