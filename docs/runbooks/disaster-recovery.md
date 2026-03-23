# Disaster Recovery Runbook

**Related ADR:** [VE-PLAT-ADR-0006 — Offline-Capable Architecture](../adrs/VE-PLAT-ADR-0006-offline-capable-architecture.md)

This runbook covers recovery procedures for each failure tier defined in ADR-0006.

---

## Tier 0 Failure: VistA Docker Down

VistA is the source of truth for all clinical and administrative data. When it
is unreachable, the tenant-admin console returns `{ok:false, source:"error"}`
on every route. The platform-db and operator console continue to function.

### Symptoms

- Tenant admin dashboard shows "VistA Unreachable"
- All VistA data routes return `{"ok":false,"source":"error"}`
- `GET /api/ta/v1/vista-status` returns `vistaReachable: false`

### Recovery Steps

```powershell
# 1. Check container status
docker ps --filter name=local-vista-utf8

# 2. If stopped, restart
docker compose -f services/vista-distro/docker-compose.yml up -d

# 3. Wait for health check (up to 60s)
Start-Sleep 60
docker ps --filter name=local-vista-utf8

# 4. Verify RPC port is open
Test-NetConnection -ComputerName 127.0.0.1 -Port 9434

# 5. Verify via API
curl.exe -s http://127.0.0.1:4520/api/tenant-admin/v1/vista-status?tenantId=default-tenant
# Expected: {"ok":true,"vista":{"vistaReachable":true,...}}
```

### If Container Fails to Start

```powershell
# Check container logs
docker logs local-vista-utf8 --tail 50

# If volume corrupt, rebuild (DATA LOSS — confirm with site admin first)
docker compose -f services/vista-distro/docker-compose.yml down -v
docker compose -f services/vista-distro/docker-compose.yml up -d
```

### RTO: 5–15 minutes (restart) | 30–60 minutes (rebuild from backup)

---

## Tier 1 Failure: Platform DB (ve-platform-db) Down

PostgreSQL is used for operator-side control plane data (tenant registry, module
entitlements, RCM, etc.). VistA data continues to be accessible through the
tenant-admin API.

### Symptoms

- Operator console returns 500 errors on tenant/billing/module routes
- `GET /posture/data-plane` shows degraded gates
- Module entitlements fall back to SKU defaults from `config/skus.json`

### Recovery Steps

```powershell
# 1. Check container status
docker ps --filter name=ve-platform-db

# 2. If stopped, restart
docker compose -f services/platform-db/docker-compose.yml up -d

# 3. Wait for health check
Start-Sleep 10
docker ps --filter name=ve-platform-db

# 4. Verify connectivity
$env:PGPASSWORD = "ve_platform_pass"
psql -h 127.0.0.1 -p 5433 -U ve_platform -d control_plane -c "SELECT 1;"

# 5. Run pending migrations if needed
cd apps/control-plane-api
node --env-file=.env server.mjs
# Migrations run automatically on startup
```

### Backup and Restore

```powershell
# Create backup
node scripts/backup-restore.mjs backup --target pg

# Restore from backup (requires --yes flag)
node scripts/backup-restore.mjs restore --target pg --file backup/pg-TIMESTAMP.dump --yes
```

### RTO: 2–5 minutes (restart) | 15–30 minutes (restore from backup)

---

## Tier 2 Failure: Remote Services Down (Lago, S3, OIDC, OTel)

These are optional services. The platform degrades gracefully when they are
unavailable. No data is lost. When services come back online, normal operation
resumes automatically.

### Lago Billing Down

- **Impact**: Billing status shows `configured: false`; subscription data unavailable
- **Tenant impact**: None — VistA clinical operations continue
- **Recovery**: Restart Lago containers

```powershell
docker compose -f services/lago/docker-compose.yml restart
```

### S3 Audit Shipping Down

- **Impact**: Audit entries accumulate in local JSONL file only
- **Recovery**: Automatic — shipper retries on next interval (default 5 min)
- **Manual flush**:

```powershell
curl.exe -s -X POST http://127.0.0.1:4510/audit-shipping/trigger \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### OIDC Identity Provider Down

- **Dev mode**: No impact — VistA RPC auth is the only auth path in dev
- **rc/prod mode**: Existing sessions remain valid until TTL expires (typically 8h)
- **Recovery**: Sessions auto-renew when IdP comes back

### OTel Collector Down

- **Impact**: Traces and metrics not exported; no data loss
- **Recovery**: Automatic — SDK queues spans and flushes on reconnect

---

## Offline Mode for Remote/Low-Connectivity Sites

VistA Evolved supports offline operation at sites with intermittent connectivity.

### What continues to work offline

| Component | Offline behavior |
|-----------|-----------------|
| VistA (local Docker) | Fully functional — all clinical and admin operations |
| Tenant admin console | Fully functional |
| Audit logging | Writes to local JSONL file |
| Session auth (dev) | VistA RPC auth — no external dependency |

### What stops working offline

| Component | Offline behavior |
|-----------|-----------------|
| Lago billing sync | Deferred until connectivity restored |
| S3 audit shipping | Deferred — local JSONL is the buffer |
| OIDC login (rc/prod) | Blocked — existing sessions only |
| OTel telemetry | Queued locally up to SDK buffer limit |

### Sync on reconnect

When connectivity is restored:

1. Audit shipper job automatically resumes and flushes accumulated JSONL entries
2. Lago billing sync resumes on next API call
3. OTel exporter flushes queued spans

No manual intervention required for audit shipping or OTel. Lago may require
manual reconciliation if usage events were missed — see `docs/runbooks/lago-billing-setup.md`.

---

## Backup Schedule

| Target | Frequency | Retention | Script |
|--------|-----------|-----------|--------|
| PostgreSQL (ve-platform-db) | Daily | 30 days | `node scripts/backup-restore.mjs backup --target pg` |
| Audit JSONL | Continuous (S3) | Per S3 policy | Auto via shipper |
| VistA YottaDB volume | Weekly | 7 copies | Manual: `docker run --rm -v local-vista-utf8_data:/data alpine tar czf /backup/vista-$(date +%Y%m%d).tar.gz /data` |
| Lago PostgreSQL | Daily | 30 days | `docker exec ve-lago-db pg_dump -U lago lago > backup/lago-$(date +%Y%m%d).sql` |

---

## Escalation Path

1. **Level 1 (Site IT)**: Restart Docker containers, check port connectivity
2. **Level 2 (Platform Ops)**: Database recovery, volume restore, Lago re-provisioning
3. **Level 3 (VistA Evolved Engineering)**: M-routine reinstall, RPC broker debugging, multi-tenant incident coordination

Contact Platform Operations via the operator console Support page (`/operator/support`) or by creating a ticket in your configured ITSM system (see ADR-0008).
