# Tenant Admin Happy-Path Source Map

> **Scope:** Every tenant-admin and relevant control-plane surface, with explicit current and target data sources.
>
> **Date:** 2026-03-21
>
> **Purpose:** Define the current happy-path data source for each surface and identify surfaces that must be corrected.

## Source legend

| Code | Meaning |
|------|---------|
| **V** | VistA-only (live RPC via XWB broker — DDR + ZVE* overlay RPCs) |
| **C** | Contract-backed (derived from `packages/contracts/`) |
| **R** | Real-backend proxy (control-plane-api at port 4510) |

## Tenant-admin surfaces

### Summary (updated 2026-03-22 — post-VistA-only rewrite)

> **All fixtures removed.** Every surface reads from and writes to live VistA exclusively.
> No JSON fallback files exist. If VistA is unreachable, routes return `{ok: false, source: "error"}`.

| # | Surface | Source | Verified? | Notes |
|---|---------|--------|-----------|-------|
| 1 | Dashboard counts | V | **PASS-LIVE** | Probes VistA for user/clinic/ward counts |
| 2 | VistA connection status | V | **PASS-LIVE** | TCP probe + `XUS GET USER INFO` |
| 3 | User list | V | **PASS-LIVE** | `ORWU NEWPERS` + DDR LISTER File 200 (118 users) |
| 4 | User detail | V | **PASS-LIVE** | DDR GETS File 200 (30+ fields) |
| 5 | Role assignment / keys | V | **PASS-LIVE** | DDR LISTER File 19.1 (688 keys) |
| 6 | Key inventory | V | **PASS-LIVE** | DDR LISTER File 19.1 + per-user subfile 200.051 |
| 7 | E-sig status | V | **PASS-LIVE** | DDR LISTER File 200 field 20.4 (118 users) |
| 8 | Facility list | V | **PASS-LIVE** | `XUS DIVISION GET` + `ORWU CLINLOC` |
| 9 | Facility detail | V | **PASS-LIVE** | DDR GETS on matched IEN |
| 10 | Clinic list | V | **PASS-LIVE** | DDR LISTER File 44 (937 clinics) |
| 11 | Ward list | V | **PASS-LIVE** | DDR LISTER File 42 (62 wards) |
| 12 | Topology | V | **PASS-LIVE** | Assembled from div/clinic/ward VistA reads |
| 13 | DDR probe | V | **PASS-LIVE** | Live probes DDR GETS/LISTER/VALIDATOR/FIND1 |

**All 13 surfaces are VistA-only. Zero fixtures. Zero integration-pending.**

---

### Detailed surface map

#### 1. Dashboard (`/api/tenant-admin/v1/dashboard`)

- **Source:** VistA — probes connection, then DDR LISTER for user/clinic/ward counts
- **Fallback:** Returns `{ok: false, source: "error"}` if VistA unreachable
- **Status:** PASS-LIVE

#### 2–13. All remaining surfaces

All surfaces follow the same pattern: **VistA-only source, no fixture fallback.**
If VistA is unreachable, the route returns `{ok: false, source: "error"}`.

| Surface | VistA mechanism | Key data |
|---------|----------------|----------|
| VistA Status | TCP probe + `XUS GET USER INFO` | Connection health |
| User List | `ORWU NEWPERS` + DDR LISTER File 200 | 118 users |
| User Detail | DDR GETS File 200 (30+ fields) | Full user record |
| Roles / Keys | DDR LISTER File 19.1 | 688 security keys |
| Key Inventory | DDR LISTER File 19.1 + subfile 200.051 | Key-to-holder cross-ref |
| E-Sig Status | DDR LISTER File 200 field 20.4 | Bulk e-sig check |
| Facilities | `XUS DIVISION GET` + `ORWU CLINLOC` | 3 divisions + 44 clinics |
| Facility Detail | DDR GETS on matched IEN | Single-record deep read |
| Clinics | DDR LISTER File 44 | 937 clinics |
| Wards | DDR LISTER File 42 | 62 wards |
| Topology | Assembled from div/clinic/ward reads | Hierarchical view |
| DDR Probe | Live probes DDR GETS/LISTER/VALIDATOR/FIND1 | Capability check |

---

## Control-plane surfaces

### Summary — all acceptable

| # | Surface | Current primary | Acceptable? | Notes |
|---|---------|----------------|-------------|-------|
| 1 | Tenant list/detail | R (real-backend) | Yes | Proxy to control-plane-api |
| 2 | Bootstrap requests | R (real-backend) | Yes | Proxy to control-plane-api |
| 3 | Provisioning runs | R (real-backend) | Yes | Proxy to control-plane-api |
| 4 | Legal market profiles | C (contracts) | Yes | 100% contract-derived |
| 5 | Packs | C (contracts) | Yes | 8 from contracts, 1 demo |
| 6 | Capabilities | C (contracts) | Yes | 100% contract-derived |
| 7 | Effective plans | C (contracts) | Yes | Contract resolution output |
| 8 | System config | C (config) | Yes | Platform-owned config, not VistA data |
| 9 | Review writes (15 actions) | Local review | Yes | No persistence, `mode: 'local-review'` |
| 10 | Lifecycle writes (15 actions) | R (real-backend) | Yes | Proxied to control-plane-api, 503 if down |

**No control-plane surface claims VistA data ownership.** All control-plane data is platform-owned or contract-derived. No corrections needed.

---

## Correction history

All 6 originally-identified corrections were completed 2026-03-22. The tenant-admin rewrite eliminated all fixtures and fixture fallbacks. See `tenant-admin-blocker-ledger.md` for the full resolution record.
