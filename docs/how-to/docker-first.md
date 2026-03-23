# Docker-First Workflow

!!! warning "Mandatory Policy"
    Before writing **any** backend code, verify Docker is running and VistA is reachable. Code that was never executed against the running VistA Docker is **NOT done**.

## Why This Rule Exists

AI coding agents repeatedly wrote code that compiled and "looked correct" but was never tested against the running VistA Docker. When finally tested live, ~30% returned MUMPS errors and ~10% returned 404s because routes weren't registered.

This policy prevents that failure mode permanently.

## Before Writing Any Backend Code

```powershell
# 1. Verify VistA Docker is running
docker ps --format "table {{.Names}}\t{{.Status}}" | Select-String "vehu|ve-platform"

# MUST see: vehu (healthy), ve-platform-db (healthy)

# 2. If not running, start them:
docker compose -f services/vista/docker-compose.yml --profile vehu up -d
docker compose -f services/platform-db/docker-compose.yml up -d

# 3. Start the tenant-admin server (port 4520)
cd apps/tenant-admin
node --env-file=.env.local server.mjs

# 4. Verify VistA is reachable
Invoke-WebRequest -Uri http://127.0.0.1:4520/ping -UseBasicParsing
# Must return: {"ok":true,"source":"vista-live"}
```

## After Writing Any Backend Route

```powershell
# Login
$body = '{"accessCode":"PRO1234","verifyCode":"PRO1234!!"}'
Invoke-WebRequest -Uri http://127.0.0.1:4520/auth/login -Method POST `
  -ContentType "application/json" -Body $body -SessionVariable s -UseBasicParsing

# Test the specific route
Invoke-WebRequest -Uri "http://127.0.0.1:4520/users?limit=10" `
  -WebSession $s -UseBasicParsing | Select-Object -ExpandProperty Content
```

## Verification Checklist

Before marking any task complete:

- [ ] Docker containers are running and healthy
- [ ] API starts with no errors
- [ ] VistA `/ping` returns `{"ok":true}`
- [ ] Route returns real VistA data (not empty `{}`)
- [ ] Response has `"source":"vista-live"` or equivalent
- [ ] No MUMPS errors (`%YDB-E-*`) in the response
- [ ] Test was run against LIVE Docker, not assumed

## VEHU Test Data

| Field | Value |
|-------|-------|
| Access Code | `PRO1234` |
| Verify Code | `PRO1234!!` |
| Valid Patient DFNs | 46, 47, 49, 53–93 |
| DFN 46 Has | 2 allergies, 5 vitals, 2 problems, 1 note |

!!! danger "Never use DFN=1, 2, or 3"
    These patients do not exist in VEHU and will cause MUMPS null subscript errors.

## Ports Reference

| Service | Port | Purpose |
|---------|------|---------|
| VistA VEHU (XWB RPC) | 9431 | Primary dev sandbox |
| tenant-admin API | 4520 | Site administration |
| control-plane-api | 4510 | Operator console |
| admin-ui (Next.js) | 4530 | New enterprise UI |
| Platform PostgreSQL | 5433 | Platform database |
| Lago API | 3040 | Billing engine |
| Lago UI | 3041 | Billing UI |
