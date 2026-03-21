# Fixture Inventory and Truth Ownership Audit

> **Scope:** All JSON fixture/example/static data files in `vista-evolved-platform` that serve control-plane or tenant-admin surfaces.
>
> **Date:** 2026-03-21
>
> **Purpose:** Classify every fixture as legitimate or illegitimate relative to VistA truth ownership, and determine which may remain on happy paths vs degraded-mode-only.

## Classification key

| Class | Label | Meaning |
|-------|-------|---------|
| A | Contract / example fixture | Derived verbatim from `packages/contracts/` — legitimate |
| B | Platform-owned metadata fixture | Control-plane lifecycle / config data that VistA does not own — legitimate |
| C | Degraded-mode test fixture | VistA-owned data used only as fallback when VistA is unreachable — acceptable in fallback path only |
| D | Illegitimate VistA-owned runtime truth | VistA-owned data served as the primary/happy-path source — must be removed from happy path |

## Summary

| Fixture file | Class | Owner | Acceptable on happy path? |
|-------------|-------|-------|--------------------------|
| **Tenant-admin fixtures** | | | |
| `apps/tenant-admin/fixtures/users.json` | C | VistA (File 200) | **No** — fallback only |
| `apps/tenant-admin/fixtures/roles.json` | C / D | VistA (File 19.1) | **No** — fallback only; currently ONLY source for `/roles` |
| `apps/tenant-admin/fixtures/facilities.json` | C | VistA (Files 4, 40.8, 44, 42) | **No** — fallback only |
| **Control-plane fixtures** | | | |
| `apps/control-plane/fixtures/tenants.json` | B | Platform | Yes — platform lifecycle metadata |
| `apps/control-plane/fixtures/system-config.json` | B | Platform | Yes — platform configuration |
| `apps/control-plane/fixtures/provisioning-runs.json` | B | Platform | Yes — platform provisioning state |
| `apps/control-plane/fixtures/packs.json` | A | Platform (contracts) | Yes — 8/9 from contracts, 1 demo |
| `apps/control-plane/fixtures/legal-market-profiles.json` | A | Platform (contracts) | Yes — 100% contract-derived |
| `apps/control-plane/fixtures/effective-plans.json` | A | Platform (contracts) | Yes — contract-derived resolution |
| `apps/control-plane/fixtures/capabilities.json` | A | Platform (contracts) | Yes — contract-derived manifests |
| `apps/control-plane/fixtures/bootstrap-requests.json` | B | Platform | Yes — platform bootstrap lifecycle |

**Total files:** 11 (3 tenant-admin, 8 control-plane)

---

## Detailed inventory

### Tenant-admin fixtures (3 files)

#### 1. `apps/tenant-admin/fixtures/users.json`

- **Class:** C (degraded-mode test fixture)
- **Contents:** 6 fabricated VistA user records modeled on File 200 fields (PROVIDER,CLYDE WV DUZ 87; PHARMACIST,LINDA WV DUZ 88; NURSE,HELEN WV DUZ 89; ADMIN,TENANT WV DUZ null; PROGRAMMER,ONE DUZ 1; DISABLED,FORMER WV DUZ 92)
- **Truth owner:** VistA File 200 — user identity, person class, service section, electronic signature, DISUSER flag, division assignment, primary menu option
- **Happy-path acceptable?** No. The live VistA broker can return user lists via `ORWU NEWPERS` and user details via `XUS GET USER INFO`. The fixture must only serve as fallback when VistA is unreachable.
- **Current server behavior:** `/api/tenant-admin/v1/users` is VistA-first with fixture fallback (correct). `/api/tenant-admin/v1/users/:userId` is VistA-first by IEN with fixture fallback (corrected in Task 3).
- **Required correction:** ~~Invert user detail endpoint to VistA-first.~~ Done.

#### 2. `apps/tenant-admin/fixtures/roles.json`

- **Class:** C / D (currently D — the ONLY source for `/roles` endpoint)
- **Contents:** 7 fabricated VistA security key records modeled on File 19.1 (PROVIDER, ORES, ORELSE, PSJ RPHARM, XUMGR, XUPROGMODE, SD SCHEDULING). Each includes `vistaGrounding` with File 19.1 IEN, XUSEC global path, RPC check method.
- **Truth owner:** VistA File 19.1 (security keys), `^XUSEC` global (key holder index). Key inventory is queryable via `ORWU HASKEY` (per-user check) or global read.
- **Happy-path acceptable?** No. The `/api/tenant-admin/v1/roles` endpoint currently serves fixture data with zero VistA contact. This is class D — illegitimate on the happy path.
- **Current server behavior:** Fixture with `sourceStatus: "integration-pending"` and `integrationNote` explaining the VistA RPC blocker (corrected in Task 3).
- **Required correction:** ~~Mark as integration-pending.~~ Done. No bulk key enumeration RPC exists.

#### 3. `apps/tenant-admin/fixtures/facilities.json`

- **Class:** C (degraded-mode test fixture)
- **Contents:** 1 institution hierarchy: WorldVistA Medical Center (File 4 IEN 1, station 660) → Main Division (File 40.8 IEN 1) → 5 clinics (File 44, IENs 1-5 with stop codes) → 3 wards (File 42, IENs 1-3 with specialties) → 10 beds.
- **Truth owner:** VistA Files 4 (Institution), 40.8 (Division), 44 (Hospital Location / Clinic), 42 (Ward). Queryable via `XUS DIVISION GET`, `ORWU CLINLOC`, `ORQPT WARDS`.
- **Happy-path acceptable?** No. The live VistA broker can return divisions, clinics, and wards. The fixture must only serve as fallback.
- **Current server behavior:** `/api/tenant-admin/v1/facilities` is VistA-first with fixture fallback (correct). `/api/tenant-admin/v1/facilities/:facilityId` is VistA-first by IEN with fixture fallback (corrected in Task 3). `/api/tenant-admin/v1/topology` is VistA-first assembled from divisions + clinics + wards (corrected in Task 3).
- **Required correction:** ~~Facility detail and topology endpoints need VistA-first paths.~~ Done.

---

### Control-plane fixtures (8 files)

#### 4. `apps/control-plane/fixtures/tenants.json`

- **Class:** B (platform-owned metadata)
- **Contents:** 3 tenant records (ph-demo-clinic-001, us-staging-hospital-001, test-bootstrap-pending-001) with lifecycle status, legal market, active packs, bootstrap/provisioning cross-references.
- **Truth owner:** Platform control-plane database. Tenants are platform-managed entities. VistA does not own tenant lifecycle.
- **Happy-path acceptable?** Yes. This is platform metadata. The real backend (`control-plane-api`) is the primary source; fixtures serve as local dev/review fallback.
- **Required correction:** None.

#### 5. `apps/control-plane/fixtures/system-config.json`

- **Class:** B (platform-owned metadata)
- **Contents:** Deployment profile (dev mode, API version), 4 feature flags, 6 system parameters (session timeout, auth mode, RPC pool size, rate limit, VistA instance ID, OTel toggle).
- **Truth owner:** Platform configuration. Self-owned.
- **Happy-path acceptable?** Yes.
- **Required correction:** None.

#### 6. `apps/control-plane/fixtures/provisioning-runs.json`

- **Class:** B (platform-owned metadata)
- **Contents:** 2 provisioning run records with step-by-step state tracking, blockers, and failure counts.
- **Truth owner:** Platform provisioning state machine. Self-owned.
- **Happy-path acceptable?** Yes. Real backend is primary; fixture is review/dev fallback.
- **Required correction:** None.

#### 7. `apps/control-plane/fixtures/packs.json`

- **Class:** A (contract-derived)
- **Contents:** 9 pack records (8 derived verbatim from `packages/contracts/pack-manifests/`, 1 demo fabricated: specialty-cardiology).
- **Truth owner:** Platform contracts (`packages/contracts/pack-manifests/`). The fixture has explicit provenance noting contract derivation.
- **Happy-path acceptable?** Yes. Contract data is legitimate. The 1 demo pack is clearly labeled.
- **Required correction:** None.

#### 8. `apps/control-plane/fixtures/legal-market-profiles.json`

- **Class:** A (contract-derived)
- **Contents:** 2 legal market profiles (PH, US) with pack composition, readiness dimensions, scope bounds.
- **Truth owner:** Platform contracts (`packages/contracts/legal-market-profiles/`). 100% verbatim from contract sources.
- **Happy-path acceptable?** Yes.
- **Required correction:** None.

#### 9. `apps/control-plane/fixtures/effective-plans.json`

- **Class:** A (contract-derived)
- **Contents:** 2 effective tenant configuration plans (PH, US) with resolved packs, deferred items, readiness posture, gating blockers.
- **Truth owner:** Platform contracts (`packages/contracts/effective-tenant-configuration-plans/`). Resolution algorithm output.
- **Happy-path acceptable?** Yes.
- **Required correction:** None.

#### 10. `apps/control-plane/fixtures/capabilities.json`

- **Class:** A (contract-derived)
- **Contents:** 7 capability manifests (billing, clinical, platform, regulatory) with readiness states and claim postures.
- **Truth owner:** Platform contracts (`packages/contracts/capability-manifests/`). 100% contract-derived.
- **Happy-path acceptable?** Yes.
- **Required correction:** None.

#### 11. `apps/control-plane/fixtures/bootstrap-requests.json`

- **Class:** B (platform-owned metadata)
- **Contents:** 2 bootstrap request records with lifecycle status and cross-references.
- **Truth owner:** Platform bootstrap state machine. Self-owned.
- **Happy-path acceptable?** Yes. Real backend is primary; fixture is review/dev fallback.
- **Required correction:** None.

---

## Other data sources (non-fixture)

### Hardcoded server data

| Location | Data | Owner | Acceptable? |
|----------|------|-------|-------------|
| `server.mjs` guided-tasks handler | 20-item workflow catalog (GW-USR-01 through GW-PCMM-01) | Platform (workflow definitions) | Yes — platform defines the guided-write catalog; VistA targets are metadata, not runtime data |

### Contract files (canonical, not fixtures)

All files under `packages/contracts/` (pack-manifests, legal-market-profiles, capability-manifests, etc.) are canonical contract definitions. The control-plane fixtures that reference them are either verbatim copies or resolver outputs. These are legitimate.

---

## Verdict

### Class D issues — all corrected ✓

The following 6 surfaces had illegitimate fixture-only happy paths. All have been
corrected as of Task 3 (FIXTURE PURGE + LIVE TRUTH CANONICALIZATION).

| Surface | Was | Fix applied | Status |
|---------|-----|-------------|--------|
| `/api/tenant-admin/v1/users/:userId` | Fixture-first | Inverted to VistA-first (ORWU NEWPERS by IEN) | ✓ VistA-first |
| `/api/tenant-admin/v1/facilities/:facilityId` | Fixture-only | Added VistA detail lookup (ORWU CLINLOC / ORQPT WARDS by IEN) | ✓ VistA-first |
| `/api/tenant-admin/v1/topology` | Fixture-only | Assembled from XUS DIVISION GET + ORWU CLINLOC + ORQPT WARDS | ✓ VistA-first |
| `/api/tenant-admin/v1/roles` | Fixture-only, no VistA adapter | Marked `integration-pending` with `integrationNote` | ✓ Honest labeling |
| `/api/tenant-admin/v1/key-inventory` | Fixture cross-ref | Marked `integration-pending` with `integrationNote` | ✓ Honest labeling |
| `/api/tenant-admin/v1/esig-status` | Fixture-only | Marked `integration-pending` with `integrationNote` | ✓ Honest labeling |

### VistA-first with honest fallback

| Surface | Status |
|---------|--------|
| `/api/tenant-admin/v1/users` (list) | VistA-first, fixture fallback with `source` label |
| `/api/tenant-admin/v1/facilities` (list) | VistA-first, fixture fallback with `source` label |
| `/api/tenant-admin/v1/clinics` | VistA-first, fixture fallback |
| `/api/tenant-admin/v1/wards` | VistA-first, fixture fallback |
| `/api/tenant-admin/v1/dashboard` | VistA-first, fixture fallback with `source` label |
| `/api/tenant-admin/v1/vista-status` | VistA-direct |

### Legitimate and acceptable

All 8 control-plane fixtures (tenants, system-config, provisioning-runs, packs, legal-market-profiles, effective-plans, capabilities, bootstrap-requests) are platform-owned or contract-derived. They are acceptable on their current paths.
