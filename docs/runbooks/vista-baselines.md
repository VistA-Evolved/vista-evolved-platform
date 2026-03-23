# VistA Baseline Lanes Runbook

VistA Evolved supports multiple VistA runtime lanes. This runbook describes each lane and when to use it.

## Lane Comparison

| Lane | Image | Port | Profile | Patients | Use Case |
|------|-------|------|---------|----------|---------|
| VEHU (**recommended**) | `worldvista/vehu` | 9431 | `vehu` | Rich VEHU data | All new development |
| Legacy WorldVistA | `worldvista/worldvista-ehr` | 9430 | (default) | Minimal | Reference only |
| Distro Build | `vista-distro:local-utf8` | 9433 | `distro` | Minimal | Custom distro testing |

## VEHU Lane (Recommended)

The VEHU (Veterans EHR Heritage Use) image has richer clinical data and is the primary development lane.

```powershell
cd services\vista
docker compose --profile vehu up -d

# Verify
docker ps --format "table {{.Names}}\t{{.Status}}" | Select-String vehu
```

**Credentials**: Access `PRO1234` / Verify `PRO1234!!` (DUZ 1, PROGRAMMER,ONE)

**Test Patients**: DFN 46, 47, 49, 53–93 (use DFN=46 for standard tests)

## Legacy Lane

!!! warning "Legacy Use Only"
    The legacy `worldvista-ehr` image is 7+ years old with minimal synthetic patients and no SDES scheduling data. Use VEHU instead.

```powershell
cd services\vista
docker compose up -d  # Default profile = legacy
```

## Switching Lanes

Update `.env.local` in `apps/tenant-admin`:

```bash
# For VEHU (recommended)
VISTA_PORT=9431
VISTA_ACCESS_CODE=PRO1234
VISTA_VERIFY_CODE=PRO1234!!

# For legacy
VISTA_PORT=9430
VISTA_ACCESS_CODE=PROV123
VISTA_VERIFY_CODE=PROV123!!
```

Then restart the tenant-admin server.

## Baseline Probe Script

```powershell
# Run the baseline probe (VistA must be running)
.\scripts\vista-baseline-probe.ps1

# Skip Docker check (structure-only)
.\scripts\vista-baseline-probe.ps1 -SkipDocker
```

The probe checks 9 gates:
1. Docker running and healthy
2. TCP connectivity to XWB port
3. VistA ping via `/ping` endpoint
4. Authentication with test credentials
5. User list returns real data
6. Facilities list returns real data
7. Clinics list returns real data
8. ZVE* routines installed
9. RPC registry matches installed routines

## Evidence Output

The probe writes evidence to:
```
evidence/vista-baselines/baseline-probe.json
```
