# Guided-Write First PASS-LIVE Proof — Task 6

> **Pass class:** PASS-LIVE
> **Date:** 2026-03-21
> **Evidence:** `artifacts/guided-write-proof-evidence.json`
> **Prerequisites:** Task 4 (broker), Task 5 (first PASS-LIVE slice)

## Objective

Prove the first honest VistA write-path for tenant-admin: the GW-KEY-01
guided-write workflow for security key allocation. Mode B (API validates +
generates M command → operator executes → API reads back and verifies).

## Infrastructure

| Component | Detail |
|-----------|--------|
| Container | `local-vista-utf8` (healthy) |
| Broker port | 9434 → 9430 (XWB entry: `-run GTMLNX^XWBTCPM`) |
| Authentication | PRO1234 / PRO1234!! → DUZ=1, PROGRAMMER,ONE |
| Context | OR CPRS GUI CHART |
| Server | `apps/tenant-admin/server.mjs` on port 4520 |
| Proof script | `scripts/guided-write-proof.mjs` |
| Test key | XUAUDIT (Kernel audit key — DUZ=1 does not hold it) |

## Guided-Write Cycle

### Mode B: Validate → Generate → Execute → Read-Back

1. **API pre-checks** the current state via `ORWU HASKEY` (read-only RPC)
2. **API generates** the exact M command: `S ^XUSEC("XUAUDIT",1)=""`
3. **Operator executes** the command in the VistA container (via docker exec)
4. **API reads back** the state via `ORWU HASKEY` and confirms the write took effect
5. **Operator undoes** with the API-provided undo command: `K ^XUSEC("XUAUDIT",1)`
6. **API confirms** the restore via `ORWU HASKEY`

This is terminal-first, VistA-first — the API never directly writes to VistA.
It validates, generates, and verifies. The operator (or automation) executes.

## Evidence Table — 7/7 PASS

| Step | Description | Verdict | Detail |
|------|-------------|---------|--------|
| 1 | Pre-check: DUZ=1 does NOT hold XUAUDIT | **PASS** | `ORWU HASKEY` → `hasKey: false` |
| 2 | Clean state verified | **PASS** | No prior allocation to clear |
| 3 | API generated M command | **PASS** | `S ^XUSEC("XUAUDIT",1)=""` |
| 4 | M command executed in container | **PASS** | Output: `ALLOCATED` |
| 5 | Read-back: DUZ=1 NOW holds XUAUDIT | **PASS** | `ORWU HASKEY` → `hasKey: true, verified: true` |
| 6 | Undo: key deallocated | **PASS** | Output: `UNDONE` |
| 7 | Restore: DUZ=1 no longer holds XUAUDIT | **PASS** | `ORWU HASKEY` → `hasKey: false, verified: true` |

## RPCs Exercised

| RPC | File/Global | Direction | Purpose |
|-----|-------------|-----------|---------|
| `ORWU HASKEY` | File 19.1 / ^XUSEC | Read | Check if authenticated user holds a security key |

## M Globals Written (and Undone)

| Global | Operation | Scope |
|--------|-----------|-------|
| `^XUSEC("XUAUDIT",1)` | SET then KILL | Single DUZ, single key — fully reversible |

## Routes Added

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/tenant-admin/v1/guided-write/key-check` | Pre-check + generate M command |
| POST | `/api/tenant-admin/v1/guided-write/key-verify` | Read-back verification |

Both routes include:
- Input sanitization (uppercase alphanumeric + spaces only)
- Broker health check before RPC call
- Honest `source: "vista"` labeling
- `integration-pending` fallback when broker is unavailable

## Bugs Found and Fixed

### BUG: `su -c` nested double-quote quoting breaks `ydb_routines`

- **Symptom:** Step 4 "passed" (exit code 0) but write didn't take effect. Step 5 failed.
- **Root cause:** `dockerMumps()` used `docker exec ... su -s /bin/bash vista -c "${env} yottadb ..."`.
  The `ydb_routines` value contains spaces, requiring inner double-quotes. These inner quotes
  terminate the outer `su -c "..."` argument, causing the M process to start with wrong `ydb_routines`.
- **Fix:** Replaced with `docker exec -u vista -e VAR=VAL ...` — Docker's native `-u`/`-e` flags
  bypass shell quoting entirely.

### BUG: Windows cmd.exe eats `^` (caret) in `execSync`

- **Symptom:** `execSync("docker exec ... yottadb -run ALLOC^ZVEGWP")` → YDB looks for `ALLOCZVEGWP.m`
- **Root cause:** `execSync` on Windows uses `cmd.exe /c` which treats `^` as escape character.
- **Fix:** Replaced with `execFileSync('docker', args)` — bypasses shell entirely, array args
  are passed directly to the process.

## Gate Verification

| Gate | Criterion | Result |
|------|-----------|--------|
| A (Inventory) | Files listed before edit | **PASS** |
| B (Contract) | Key name sanitization, integration-pending fallback | **PASS** |
| C (No-Claim) | 7-step proof script with live evidence | **PASS** |
| D (Source-Label) | `source: "vista"`, `rpcUsed: "ORWU HASKEY"` | **PASS** |
| E (Blocker) | B-WRITE-001 resolved | **PASS** |
| F (Proof) | Terminal evidence captured in JSON | **PASS** |
| G (No-Sprawl) | Evidence in `artifacts/`, proof in `docs/explanation/` | **PASS** |

## Files Changed

| File | Change |
|------|--------|
| `apps/tenant-admin/server.mjs` | Added `checkVistaKey` import + 2 guided-write routes (~80 lines) |
| `scripts/guided-write-proof.mjs` | Created: 7-step proof script with `dockerMumps()` helper |
| `artifacts/guided-write-proof-evidence.json` | Created: evidence JSON from proof run |
| `docs/explanation/guided-write-pass-live-proof.md` | This document |
| `docs/explanation/tenant-admin-blocker-ledger.md` | B-WRITE-001 → RESOLVED |
| `docs/reference/source-of-truth-index.md` | Added guided-write proof entry |
