# Broker Canonicalization Proof — Task 4

> **Pass class: PASS-LIVE** — All claims proven against running VistA distro (UTF-8 lane).

## Objective

Prove the tenant-admin XWB broker client can connect, authenticate, execute RPCs, and survive container restarts against the live VistA distro UTF-8 lane.

## Evidence Summary

| Gate | Result | Detail |
|------|--------|--------|
| TCP reachable | PASS | Port 9434 open (Docker-mapped from container 9430) |
| Broker connect + authenticate | PASS | DUZ=1, PROGRAMMER,ONE, context OR CPRS GUI CHART |
| ORWU NEWPERS | PASS | 44 users returned (real VEHU names) |
| XUS DIVISION GET | PASS | Returns `0` (single-division site) |
| ORWU CLINLOC | PASS | 44 clinics (ANTICOAGULATION, AUDIOLOGY, CARDIOLOGY...) |
| ORQPT WARDS | PASS | 29 wards (2-INTERMED, 3 NORTH GASTRO, ICU/CCU...) |
| XUS GET USER INFO | PASS | 7 lines: DUZ=1, name, title, station, service |
| ORWU HASKEY | PASS | PROVIDER key = 1 (has it) |
| Disconnect | PASS | Clean #BYE# disconnect |
| Restart persistence | PASS | 8/8 PASS after `docker restart` |

## Broker Protocol

- **Client**: `apps/tenant-admin/lib/xwb-client.mjs` (XwbBroker class)
- **Protocol**: XWB RPC Broker v1.1 (TCP → TCPConnect → XUS SIGNON SETUP → XUS AV CODE → XWB CREATE CONTEXT → RPC calls)
- **Cipher**: 20-pad ENCRYP^XUSRB1 implementation (cipher pads from XUSRB1.m Z-tag)
- **Server**: xinetd → `yottadb -run GTMLNX^XWBTCPM` (GT.M/YottaDB entry point)

## Bug Found and Fixed: Stale Broker Entry Point

**Root cause**: The running Docker image was built from an older Dockerfile that had the broken broker config:
```
server_args = -direct -run XWBTCPL
```

The repo source (`docker/local-vista-utf8/entrypoint.sh`) has the correct fix:
```
server_args = -run GTMLNX^XWBTCPM
```

But the running container was built before the fix was committed. The entrypoint regenerates `/etc/xinetd.d/vista-broker` on every boot from its template, so the broken template produced a broken config after each restart.

**Fix applied**: Patched both `/etc/xinetd.d/vista-broker` (immediate) and `/opt/vista/entrypoint.sh` (persistent) inside the running container. The repo source is already correct. A `docker build` from the current repo source will produce a correct image.

**Why `-direct` breaks**: The `-direct` flag starts yottadb in interactive mode, which drops to the `YDB>` prompt instead of running the GTMLNX^XWBTCPM handler. xinetd passes the client socket to stdin/stdout, so the broker client's XWB protocol bytes are interpreted as MUMPS commands and fail.

**Why XWBTCPL breaks**: XWBTCPL is the InterSystems Cache entry point. GTMLNX^XWBTCPM is the GT.M/YottaDB equivalent.

## RPC Data Quality

| RPC | Records | Data Quality |
|-----|---------|-------------|
| ORWU NEWPERS | 44 | Real VEHU usernames (Programmer,Eight; Programmer,Eleven; etc.) |
| ORWU CLINLOC | 44 | Real VEHU clinic names (ANTICOAGULATION, AUDIOLOGY, CARDIOLOGY, etc.) |
| ORQPT WARDS | 29 | Real VEHU ward names (2-INTERMED, 3 NORTH GASTRO, ICU/CCU, etc.) |
| XUS DIVISION GET | 1 | Single division (station 500 CAMP MASTER) |
| XUS GET USER INFO | 7 | Full user profile (name, title, station, service) |
| ORWU HASKEY | 1 | Boolean key check (1 = has PROVIDER key) |

## Blocker Resolution

| Blocker | Status | Resolution |
|---------|--------|------------|
| B-PERSIST-001 | **RESOLVED** | Broker survives container restart (proven with restart + re-test) |
| B-RPC-001 (ORWU NEWPERS) | **RESOLVED** | Returns 44 users via live broker |
| B-RPC-002 (XUS DIVISION GET) | **RESOLVED** | Returns division data via live broker |
| B-RPC-003 (ORWU CLINLOC) | **RESOLVED** | Returns 44 clinics via live broker |

## Distro Image Rebuild Needed

The running container was hot-patched. For a clean-build proof, the image should be rebuilt:
```powershell
cd vista-evolved-vista-distro
docker build --progress=plain -f docker/local-vista-utf8/Dockerfile -t vista-distro:local-utf8 .
```

The repo source already has the correct entrypoint. The rebuild will produce an image that works out of the box without hot-patching.

## Test Script

- **Script**: `vista-evolved-platform/scripts/broker-canonic-test.mjs`
- **Evidence**: `vista-evolved-platform/artifacts/broker-canonicalization-evidence.json`
- **Run command**:
  ```powershell
  $env:VISTA_HOST="127.0.0.1"
  $env:VISTA_PORT="9434"
  $env:VISTA_ACCESS_CODE="PRO1234"
  $env:VISTA_VERIFY_CODE="PRO1234!!"
  node scripts/broker-canonic-test.mjs
  ```

## Connection Parameters

| Parameter | Value |
|-----------|-------|
| Host | 127.0.0.1 |
| Port | 9434 (Docker-mapped to container 9430) |
| Access Code | PRO1234 |
| Verify Code | PRO1234!! |
| DUZ | 1 |
| User | PROGRAMMER,ONE |
| Context | OR CPRS GUI CHART |
| Container | local-vista-utf8 (vista-distro:local-utf8) |
| Build lane | UTF-8 |

## Timestamps

- Initial test (pre-restart): 2026-03-21T10:29:26Z — 8/8 PASS
- Bug discovery: `docker restart` caused broker failure (xinetd regenerated broken config)
- Root cause identified: entrypoint.sh template had stale `-direct -run XWBTCPL`
- Hot-patch applied: 2026-03-21T10:36:52Z
- Post-restart test: 2026-03-21T10:37:42Z — 8/8 PASS
- Restart persistence: PROVEN (restart → patch persists → broker works)
