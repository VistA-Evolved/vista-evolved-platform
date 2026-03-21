# Tenant Admin Happy-Path Source Map

> **Scope:** Every tenant-admin and relevant control-plane surface, with explicit current and target data sources.
>
> **Date:** 2026-03-21
>
> **Purpose:** Define the current happy-path data source for each surface and identify surfaces that must be corrected.

## Source legend

| Code | Meaning |
|------|---------|
| **V** | VistA-first (live RPC via XWB broker) |
| **F** | Fixture-first (JSON file loaded at startup) |
| **C** | Contract-backed (derived from `packages/contracts/`) |
| **R** | Real-backend proxy (control-plane-api at port 4510) |
| **S** | Static/hardcoded server data |
| **T** | Terminal-driven (user executes in VistA terminal, not API-served) |

## Tenant-admin surfaces

### Summary

| # | Surface | Current primary | Current fallback | Acceptable? | Target primary |
|---|---------|----------------|-----------------|-------------|---------------|
| 1 | Dashboard counts | V | F | **Yes** | V (already correct) |
| 2 | VistA connection status | V | — | **Yes** | V (already correct) |
| 3 | User list | V | F | **Yes** | V (already correct) |
| 4 | User detail | V (by IEN) | F | **Yes** | V → F (corrected) |
| 5 | Role assignment | F | — | **Yes** | F + `integration-pending` (corrected) |
| 6 | Key inventory | F (cross-ref) | — | **Yes** | F + `integration-pending` (corrected) |
| 7 | E-sig status | F | — | **Yes** | F + `integration-pending` (corrected) |
| 8 | Facility list | V | F | **Yes** | V (already correct) |
| 9 | Facility detail | V (by IEN) | F | **Yes** | V → F (corrected) |
| 10 | Clinic list | V | F | **Yes** | V (already correct) |
| 11 | Ward list | V | F | **Yes** | V (already correct) |
| 12 | Topology | V | F | **Yes** | V (assembled from divs+clinics+wards) → F (corrected) |
| 13 | Guided write workflows | S | — | **Yes** | S (platform catalog, correct) |

**All 13 surfaces now have correct source labeling.** ✓
**Previously requiring correction: 6 — all fixed.**

---

### Detailed surface map

#### 1. Dashboard (`/api/tenant-admin/v1/dashboard`)

- **Current primary:** VistA — probes connection, then `Promise.all([fetchVistaUsers, fetchVistaClinics, fetchVistaWards])` to compute counts
- **Current fallback:** Fixture — recursive count from `facilities.json` hierarchy + `users.json` extraction
- **Honest labeling:** `source: 'vista'` or `source: 'fixture'`
- **Acceptable:** Yes
- **Required correction:** None

#### 2. VistA Status (`/api/tenant-admin/v1/vista-status`)

- **Current primary:** VistA — TCP probe + `fetchVistaCurrentUser()` for session context
- **Current fallback:** Returns `ok: false` with error details
- **Acceptable:** Yes
- **Required correction:** None

#### 3. User List (`/api/tenant-admin/v1/users`)

- **Current primary:** VistA — `fetchVistaUsers(search)` via RPC
- **Current fallback:** Fixture — `fixtures/users.json` with `source: 'fixture'` label
- **Honest labeling:** `source: 'vista'` or `source: 'fixture'` + `vistaStatus` in fallback
- **Acceptable:** Yes
- **Required correction:** None

#### 4. User Detail (`/api/tenant-admin/v1/users/:userId`)

- **Current primary:** VistA — tries `fetchVistaUsers('')` then filters by IEN
- **Current fallback:** Fixture — searches `fixtures/users.json` by synthetic ID (`user-001`)
- **Honest labeling:** `source: 'vista'` or `source: 'fixture'`
- **Acceptable:** **Yes — corrected.** VistA-first lookup by IEN, fixture fallback with honest labeling.
- **Required correction:** ~~Invert to VistA-first.~~ Done.

#### 5. Role Assignment (`/api/tenant-admin/v1/roles`)

- **Current primary:** Fixture — `fixtures/roles.json` enriched with user count from `fixtures/users.json`
- **Current fallback:** None
- **Honest labeling:** `source: 'fixture'`, `sourceStatus: 'integration-pending'`, `integrationNote` explaining the blocker
- **Acceptable:** **Yes — corrected.** Explicit integration-pending labeling with technical justification.
- **Required correction:** ~~Mark as integration-pending.~~ Done.
- **Blocker note:** No single RPC enumerates all security keys from File 19.1. Requires either DDR global read or a custom M routine. Marked integration-pending.

#### 6. Key Inventory (`/api/tenant-admin/v1/key-inventory`)

- **Current primary:** Fixture cross-reference — roles from `fixtures/roles.json` mapped to user holders from `fixtures/users.json`
- **Current fallback:** None
- **Honest labeling:** `source: 'fixture'`, `sourceStatus: 'integration-pending'`, `integrationNote` explaining the blocker
- **Acceptable:** **Yes — corrected.** Explicit integration-pending labeling.
- **Required correction:** ~~Mark as integration-pending.~~ Done.

#### 7. E-Sig Status (`/api/tenant-admin/v1/esig-status`)

- **Current primary:** Fixture — extracts `vistaGrounding.electronicSignature` from `fixtures/users.json`
- **Current fallback:** None
- **Honest labeling:** `source: 'fixture'`, `sourceStatus: 'integration-pending'`, `integrationNote` explaining the blocker
- **Acceptable:** **Yes — corrected.** Explicit integration-pending labeling.
- **Required correction:** ~~Mark as integration-pending.~~ Done.
- **Blocker note:** RPC-based bulk e-sig status checking is not straightforward. Marked integration-pending.

#### 8. Facility List (`/api/tenant-admin/v1/facilities`)

- **Current primary:** VistA — assembles topology from `fetchVistaDivisions()` + `fetchVistaClinics()` + `fetchVistaWards()`
- **Current fallback:** Fixture — `fixtures/facilities.json` hierarchy
- **Honest labeling:** `source: 'vista'` or `source: 'fixture'`
- **Acceptable:** Yes
- **Required correction:** None

#### 9. Facility Detail (`/api/tenant-admin/v1/facilities/:facilityId`)

- **Current primary:** VistA — matches `loc-{ien}` IDs against ORWU CLINLOC and ORQPT WARDS results
- **Current fallback:** Fixture — recursive tree search in `fixtures/facilities.json`
- **Acceptable:** **Yes — corrected.** VistA-first lookup, fixture fallback.
- **Required correction:** ~~Add VistA lookup.~~ Done.

#### 10. Clinic List (`/api/tenant-admin/v1/clinics`)

- **Current primary:** VistA — `fetchVistaClinics(search)`
- **Current fallback:** Fixture — extracts clinics from `fixtures/facilities.json` hierarchy
- **Acceptable:** Yes
- **Required correction:** None

#### 11. Ward List (`/api/tenant-admin/v1/wards`)

- **Current primary:** VistA — `fetchVistaWards()` with computed bed stats
- **Current fallback:** Fixture — extracts wards from `fixtures/facilities.json` hierarchy
- **Acceptable:** Yes
- **Required correction:** None

#### 12. Topology (`/api/tenant-admin/v1/topology`)

- **Current primary:** VistA — assembles hierarchy from `XUS DIVISION GET` + `ORWU CLINLOC` + `ORQPT WARDS`
- **Current fallback:** Fixture — recursive hierarchy from `fixtures/facilities.json`
- **Honest labeling:** `source: 'vista'` or `source: 'fixture'` with `integrationNote`
- **Acceptable:** **Yes — corrected.** VistA-first assembly, fixture fallback.
- **Required correction:** ~~Build topology from VistA data.~~ Done.

#### 13. VistA tools — DDR probe (`GET /api/tenant-admin/v1/vista/ddr-probe`)

- **Current primary:** Live XWB calls probing **DDR GETS ENTRY DATA**, **DDR VALIDATOR**, **DDR LISTER**, **DDR FIND1** (plus `not_probed` placeholders for filer/delete/lock family members that need real file context)
- **Current fallback:** Returns `integration-pending` when VistA is unreachable
- **Acceptable:** **Yes.** Replaces the retired `/guided-tasks` catalog; surfaces real RPC availability for direct-write architecture.
- **Required correction:** None (re-audit when expanding write coverage)

---

## Control-plane surfaces

### Summary — all acceptable

| # | Surface | Current primary | Acceptable? | Notes |
|---|---------|----------------|-------------|-------|
| 1 | Tenant list/detail | R (real-backend) | Yes | Proxy to control-plane-api, fixture fallback |
| 2 | Bootstrap requests | R (real-backend) | Yes | Proxy to control-plane-api, fixture fallback |
| 3 | Provisioning runs | R (real-backend) | Yes | Proxy to control-plane-api, fixture fallback |
| 4 | Legal market profiles | C (contracts) | Yes | 100% contract-derived |
| 5 | Packs | C (contracts) | Yes | 8 from contracts, 1 demo |
| 6 | Capabilities | C (contracts) | Yes | 100% contract-derived |
| 7 | Effective plans | C (contracts) | Yes | Contract resolution output |
| 8 | System config | F (fixture) | Yes | Platform-owned config, not VistA data |
| 9 | Review writes (15 actions) | Local review | Yes | No persistence, `mode: 'local-review'` |
| 10 | Lifecycle writes (15 actions) | R (real-backend) | Yes | Proxied to control-plane-api, 503 if down |

**No control-plane surface claims VistA data ownership.** All control-plane fixtures are platform-owned or contract-derived. No corrections needed.

---

## Correction plan summary

### All corrections completed ✓

All 6 surfaces that previously required correction have been fixed:

| Priority | Surface | Was | Fix Applied | Status |
|----------|---------|-----|-------------|--------|
| P0 | User detail | F→V | Inverted to V→F | ✓ Done |
| P0 | Facility detail | F only | Added VistA lookup → F fallback | ✓ Done |
| P1 | Topology | F only | Assembled from VistA div/clinic/ward → F fallback | ✓ Done |
| P1 | E-sig status | F only | Marked `integration-pending` with `integrationNote` | ✓ Done |
| P2 | Role assignment | F only | Marked `integration-pending` with `integrationNote` | ✓ Done |
| P2 | Key inventory | F cross-ref | Marked `integration-pending` with `integrationNote` | ✓ Done |

### Surfaces already correct — no changes needed

Dashboard, VistA status, user list, facility list, clinic list, ward list, VistA tools (DDR probe), devices/kernel params where wired, and all control-plane surfaces.
