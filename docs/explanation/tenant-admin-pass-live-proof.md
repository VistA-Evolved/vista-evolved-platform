# Tenant-Admin First PASS-LIVE Proof — Task 5

> **Pass class:** PASS-LIVE
> **Date:** 2026-03-21
> **Evidence:** `artifacts/tenant-admin-pass-live-evidence.json`
> **Prerequisite:** Task 4 (broker canonicalization) — PASS-LIVE

## Objective

Prove that the tenant-admin server's VistA-first routing works end-to-end:
server starts, connects to the live UTF-8 VistA broker, and returns real
VistA data with honest `source: "vista"` labeling across all wired endpoints.

## Infrastructure

| Component | Detail |
|-----------|--------|
| Container | `local-vista-utf8` (healthy) |
| Broker port | 9434 → 9430 (XWB entry: `-run GTMLNX^XWBTCPM`) |
| Authentication | PRO1234 / PRO1234!! → DUZ=1, PROGRAMMER,ONE |
| Context | OR CPRS GUI CHART |
| Server | `apps/tenant-admin/server.mjs` on port 4520 |

## Evidence Table

| # | Endpoint | Source | Data Count | RPCs Used | Verdict |
|---|----------|--------|------------|-----------|---------|
| 1 | `/vista-status` | probe | — | XUS SIGNON SETUP, XUS AV CODE, XWB CREATE CONTEXT | **PASS** |
| 2 | `/users?search=PRO` | **vista** | 44 | ORWU NEWPERS | **PASS** |
| 3 | `/clinics?search=A` | **vista** | 44 | ORWU CLINLOC | **PASS** |
| 4 | `/wards` | **vista** | 29 | ORQPT WARDS | **PASS** |
| 5 | `/facilities` | **vista** | 44 | XUS DIVISION GET, ORWU CLINLOC | **PASS** |
| 6 | `/topology` | **vista** | 1 site (44 clinics + 29 wards) | XUS DIVISION GET, ORWU CLINLOC, ORQPT WARDS | **PASS** |
| 7 | `/dashboard` | **vista** | 118 users, 44 clinics, 29 wards | ORWU NEWPERS, ORWU CLINLOC, ORQPT WARDS | **PASS** |
| 8 | `/vista/ddr-probe` | **vista** / integration | DDR family probe | DDR GETS, VALIDATOR, LISTER | **PASS** (replaces retired `/guided-tasks` catalog) |
| 9 | `/roles` | fixture | 7 | — | PASS (fixture, integration-pending) |
| 10 | `/key-inventory` | fixture | 7 | — | PASS (fixture, integration-pending) |
| 11 | `/esig-status` | fixture | 6 | — | PASS (fixture, integration-pending) |

**Summary:** 6 of 11 endpoints return `source: "vista"` with real VistA data.
3 endpoints return `source: "fixture"` with honest `integration-pending` labeling.
DDR probe endpoint replaces the old guided-task catalog (`#/vista-tools` in the SPA).
1 endpoint is a probe (no `source` field — returns connection status).

## RPCs Exercised

| RPC | VistA File | Purpose | Data Quality |
|-----|-----------|---------|--------------|
| ORWU NEWPERS | File 200 (NEW PERSON) | User search | 118 users via empty search, 44 via "PRO" |
| XUS DIVISION GET | File 40.8 (MEDICAL CENTER DIVISION) | Division list | 1 division (single-division site) |
| ORWU CLINLOC | File 44 (HOSPITAL LOCATION) type C | Clinic search | 44 clinics, names match expected VEHU data |
| ORQPT WARDS | File 42 (WARD LOCATION) | Ward list | 29 wards with IENs and clean names |
| XUS GET USER INFO | File 200 | Current user info | DUZ=1, PROGRAMMER,ONE confirmed |
| ORWU HASKEY | File 200.051 (KEYS subfile) | Key check | Returns "1" for XUPROG on DUZ=1 |

## VistA Data Quality

All returned data:
- Contains valid IENs (integer identifiers matching File 8994 entries)
- Has clean UTF-8 names (no encoding artifacts)
- Returns no MUMPS errors (`%YDB-E-*`)
- Matches VEHU reference data counts (44 clinics, 29 wards documented in Task 4 proof)

## Source Labeling Honesty

The server correctly implements the max-truth protocol:
- Routes with working VistA adapters return `source: "vista"` — no fake labeling
- Routes without VistA wiring return `source: "fixture"` with `sourceStatus: "integration-pending"` — no silent mocking
- The catalog route returns `source: "catalog"` — honest separate category
- No route returns `source: "vista"` when actually serving fixture data

## Dual-Mode Pattern Verification

The server's VistA-first dual-mode pattern works correctly:
1. Server starts → connects broker → authenticates as DUZ=1
2. Route receives request → calls `fetchVista*()` adapter
3. Adapter calls RPC via singleton `getBroker()`
4. On success → returns `{ ok: true, source: "vista", data: [...] }`
5. On failure → falls through to fixture with `{ ok: true, source: "fixture", ... }`

This session exercised path (4) — all 6 VistA-first routes returned live data.

## Code Files Involved (No Changes Made)

| File | Role |
|------|------|
| `apps/tenant-admin/server.mjs` | Fastify server, 13 API routes |
| `apps/tenant-admin/lib/xwb-client.mjs` | XWB broker client (TCP + cipher) |
| `apps/tenant-admin/lib/vista-adapter.mjs` | RPC adapter wrappers |

**No code changes were required.** The existing VistA-first routing works
correctly when the broker is accessible and the env vars are set.

## Blocker Ledger Update

| Blocker | Previous Status | New Status |
|---------|----------------|------------|
| B-LIVE-001 (no live proof of VistA-first routing) | BLOCKER | **RESOLVED** |
| B-FIXTURE-001 (fixture fallback not exercised) | — | Not tested this slice (VistA was up) |

## Conditions for PASS-LIVE

| Gate | Requirement | Status |
|------|------------|--------|
| A | Docker container running and healthy | **PASS** |
| B | Broker port 9434 reachable | **PASS** |
| C | Server starts without errors | **PASS** |
| D | VistA-first routes return `source: "vista"` | **PASS** (6/6) |
| E | Real VistA data in responses | **PASS** |
| F | No MUMPS errors | **PASS** |
| G | Honest source labeling on non-vista routes | **PASS** |
| H | Sequential RPC calls (no socket corruption) | **PASS** |
| I | Evidence captured | **PASS** |

## Verdict: PASS-LIVE

All 6 VistA-first endpoints return live VistA data. Source labeling is honest.
No code changes were required — the wiring was already correct.
