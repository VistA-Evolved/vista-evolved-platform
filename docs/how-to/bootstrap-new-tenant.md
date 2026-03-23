# Bootstrap a New Tenant

!!! warning "Integration Pending"
    Full automated tenant bootstrap is not yet implemented. This guide describes the manual steps and planned automation.

## Planned Automated Flow (Future)

1. Operator navigates to `/operator/bootstrap`
2. Guided wizard collects: tenant name, market, tier, admin user
3. Platform provisions VistA distro container
4. Installs ZVE* routines via `scripts/install-vista-routines.ps1`
5. Creates Lago subscription
6. Issues admin credentials

## Manual Bootstrap (Current)

### Step 1: Provision VistA Distro

```powershell
# Build local VistA distro
docker build --progress=plain `
  -f vista-evolved-vista-distro/docker/local-vista-utf8/Dockerfile `
  -t vista-distro:local-utf8 vista-evolved-vista-distro
```

### Step 2: Start VistA Container

```powershell
docker compose -f services/vista/docker-compose.yml --profile vehu up -d
# Wait for healthy status (~30s)
docker ps --format "table {{.Names}}\t{{.Status}}"
```

### Step 3: Install Custom Routines

```powershell
.\scripts\install-vista-routines.ps1 -ContainerName vehu -VistaUser vehu
```

### Step 4: Configure Billing

See [Configure Billing](configure-billing.md) for Lago setup.

### Step 5: Register Tenant in Platform DB

```powershell
# Via operator API
$tenant = @{
  tenantId = "tenant-001"
  displayName = "Regional Medical Center"
  legalMarketId = "us"
  launchTier = "clinic"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://127.0.0.1:4510/api/control-plane/v1/tenants" `
  -Method POST -ContentType "application/json" -Body $tenant `
  -Headers @{"Authorization"="Bearer $token"} -UseBasicParsing
```

## Tenant ID Conventions

- Format: `{region}-{type}-{sequential}` e.g., `us-clinic-001`
- Must be URL-safe (lowercase, hyphens only)
- Immutable after creation

## Required Infrastructure

Before bootstrapping a tenant, verify:

- [ ] VistA Docker is running and healthy
- [ ] Platform PostgreSQL is running
- [ ] Lago billing is configured and reachable
- [ ] Custom ZVE* routines are installed in VistA
