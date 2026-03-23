# VistA Provisioning Runbook

This runbook covers the unified VistA routine installation process and the `/vista/provision/status` health endpoint.

## Unified Installer

The `scripts/install-vista-routines.ps1` script installs all custom ZVE* routines into a VistA container in a single idempotent operation.

```powershell
# Full installation (VEHU container)
.\scripts\install-vista-routines.ps1 -ContainerName vehu -VistaUser vehu

# With optional scheduling seed data
.\scripts\install-vista-routines.ps1 -ContainerName vehu -VistaUser vehu -Seed
```

### What It Installs

| Routine | Purpose |
|---------|---------|
| `ZVECLNM.m` | Clinical name/user lookups |
| `ZVECLAVL.m` | Clinic availability probe |
| `ZVECTXTA.m` | Clinical text adapter |
| `ZVEDEV.m` | Device registry probe |
| `ZVEFLDS.m` | FileMan field reader |
| `ZVEHLFIL.m` | HL7 file reader |
| `ZVEHSCOMP.m` | Health summary components |
| `ZVEMGRP.m` | Group management |
| `ZVEPROBE.m` | RPC availability probe |
| `ZVETMCTL.m` | TaskMan control |
| `ZVEUCLONE.m` | User clone utility |
| `ZVEUSMG.m` | User security management |
| `ZVEWRDM.m` | Ward/bed management |

## Provision Status Endpoint

The `/vista/provision/status` endpoint (admin-only) returns live provisioning health:

```powershell
# With authentication
Invoke-WebRequest -Uri "http://127.0.0.1:4520/provision/status" `
  -WebSession $s -UseBasicParsing | Select-Object -ExpandProperty Content
```

Example response:
```json
{
  "ok": true,
  "health": "fully-provisioned",
  "routines": {
    "ZVECLAVL": "installed",
    "ZVECLNM": "installed",
    "ZVEPROBE": "installed"
  }
}
```

### Health States

| State | Meaning |
|-------|---------|
| `fully-provisioned` | All required routines installed |
| `partially-provisioned` | Some routines missing |
| `unprovisioned` | No custom routines found |

## Post-Restart Verification

After a Docker container restart, verify routines are still present:

```powershell
# Quick health check
.\scripts\install-vista-routines.ps1 -ContainerName vehu -VistaUser vehu -CheckOnly

# Or via API
Invoke-WebRequest -Uri http://127.0.0.1:4520/provision/status `
  -WebSession $s -UseBasicParsing
```

!!! warning "Volume Destruction"
    `docker compose down -v` or `docker system prune --volumes` destroys all installed routines. Re-run the installer after volume recreation.

## Idempotency Guarantee

The installer checks `$O(^XWB(8994,"B",NAME,""))` before inserting any RPC. It never KILLs existing VistA globals. Running the installer multiple times is safe.
