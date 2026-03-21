# Fixture Purge Inventory and Happy-Path Red-Line

> **Status:** Canonical fixture audit and purge/conversion plan.
> **Date:** 2026-03-21.
> **Pass class:** PASS-DOC.
> **Governed by:** AGENTS.md, VE-PLAT-ADR-0003.
>
> **Purpose:** Classifies every fixture, static JSON, and seed data file in both active
> repos into purge classes (A–D). Identifies which can be removed, which must convert to
> live data sources, which are canonical contract data, and which need red-line notices.

---

## 1. Classification system

| Class | Label | Definition | Action |
|-------|-------|-----------|--------|
| **A** | Canonical contract data | Real, validated contract artifacts (schemas, manifests, plans, market profiles). Not fixtures — they ARE the source of truth. | **KEEP.** No change needed. |
| **B** | Honest degraded-mode fallback | Fixture data that exists only for degraded-mode display when VistA is unavailable. Properly classified with `_provenance` or `_fixture-manifest`. VistA is the declared truth owner. | **KEEP with red-line.** Must display `source: "fixture"` in UI. Convert to live data when VistA path is proven. |
| **C** | Fabricated prototype data | Invented data that supports review-mode UI demos but has no grounded truth source. Provenance says "fabricated." | **RED-LINE.** Mark clearly as fabricated. Convert to real backend data or remove when backend exists. |
| **D** | Dead / duplicate / misleading | Data that should not exist: duplicates of contract data, orphaned files, data that could be mistaken for truth. | **PURGE.** Remove or archive. |

---

## 2. Complete file inventory with classification

### 2.1 Tenant-admin fixtures (4 files)

| # | File | Lines | Class | Rationale | Action |
|---|------|-------|-------|-----------|--------|
| 1 | `apps/tenant-admin/fixtures/_fixture-manifest.json` | 27 | **B** | Manifest correctly declares all siblings as "class C — degraded-mode test fixture" with VistA truth owner | KEEP — governance metadata |
| 2 | `apps/tenant-admin/fixtures/users.json` | 188 | **B** | 6 fabricated user records with `vistaGrounding` metadata. Truth owner: VistA File 200. Server labels responses `source: "fixture"` | KEEP with red-line. Convert to ORWU NEWPERS live data. Blocker: B-PROOF-001 |
| 3 | `apps/tenant-admin/fixtures/roles.json` | 107 | **B** | 7 fabricated security key records with `vistaGrounding`. Truth owner: VistA File 19.1 | KEEP with red-line. Convert to XUS ALLKEYS live data. Blocker: B-RPC-001, B-FIXTURE-002 |
| 4 | `apps/tenant-admin/fixtures/facilities.json` | 251 | **B** | 1 institution hierarchy. Truth owner: VistA Files 4, 40.8, 44, 42 | KEEP with red-line. Convert to XUS DIVISION GET + ORWU CLINLOC + ORQPT WARDS live data. Blocker: B-PROOF-001 |

**Verdict:** All 4 tenant-admin fixtures are class B — honest degraded-mode fallback. The server.mjs already labels responses with `source: "fixture"` when VistA is unavailable. No purge needed. Red-line: UI must show degraded-mode badge when source is fixture.

### 2.2 Control-plane fixtures (8 files)

| # | File | Lines | Class | Rationale | Action |
|---|------|-------|-------|-----------|--------|
| 5 | `apps/control-plane/fixtures/tenants.json` | 53 | **C** | 2 fabricated tenants. No real backend produces these — provenance says "Fabricated from OpenAPI schemas" | RED-LINE. Already served with provenance. Convert to control-plane-api PG data when tenant CRUD is live |
| 6 | `apps/control-plane/fixtures/capabilities.json` | 79 | **A** | Provenance: "All capability data is real contract data" derived verbatim from capability manifests | KEEP. This is a denormalized view of real contract data, not a fixture |
| 7 | `apps/control-plane/fixtures/packs.json` | 197 | **B/C** | First 8 packs: real contract data (verbatim from pack-manifests). Last 1 pack: "fabricated" (specialty-cardiology) | RED-LINE the fabricated pack. Keep 8 real ones. Or split into real + demo |
| 8 | `apps/control-plane/fixtures/system-config.json` | 28 | **C** | Fabricated deployment config. No real backend produces this | RED-LINE. Convert to real system config from control-plane-api |
| 9 | `apps/control-plane/fixtures/legal-market-profiles.json` | 80 | **A** | Provenance: "derived VERBATIM from packages/contracts/legal-market-profiles/" | KEEP. Denormalized view of canonical contract data |
| 10 | `apps/control-plane/fixtures/effective-plans.json` | 183 | **A** | Provenance: "derived VERBATIM from packages/contracts/effective-tenant-configuration-plans/" | KEEP. Denormalized view of canonical contract data |
| 11 | `apps/control-plane/fixtures/bootstrap-requests.json` | 39 | **C** | Fabricated bootstrap statuses. No real backend produces these | RED-LINE. Convert to control-plane-api bootstrap status endpoint |
| 12 | `apps/control-plane/fixtures/provisioning-runs.json` | 60 | **C** | Fabricated provisioning run data with invented step details | RED-LINE. Convert to control-plane-api provisioning endpoint |

**Verdict:** 3 files are class A (real contract data), 1 file is class B/C (mixed real + fabricated), 4 files are class C (fabricated prototype data). No class D (dead/orphaned).

### 2.3 Contract artifacts (72 files)

| Category | Count | Class | Action |
|----------|-------|-------|--------|
| Screen contracts (`packages/contracts/screen-contracts/`) | 38 | **A** | KEEP. These are the canonical UI surface contract definitions |
| JSON Schemas (`packages/contracts/schemas/`) | 14 | **A** | KEEP. These are the canonical structural schemas |
| Pack manifests (`packages/contracts/pack-manifests/`) | 9 | **A** | KEEP. These are canonical pack definitions |
| Capability manifests (`packages/contracts/capability-manifests/`) | 7 | **A** | KEEP. These are canonical capability definitions |
| Legal market profiles (`packages/contracts/legal-market-profiles/`) | 2 | **A** | KEEP. These are canonical market governance rules |
| Effective plans (`packages/contracts/effective-tenant-configuration-plans/`) | 2 | **A** | KEEP. These are canonical resolved tenant plans |

**Verdict:** All 72 contract files are class A. These are real contract artifacts, not fixtures. No action needed.

### 2.4 Distro repo check

| Directory | Content | Class | Action |
|-----------|---------|-------|--------|
| `upstream/` | Pinned upstream VistA sources (read-only) | N/A (upstream) | No fixture concern |
| `overlay/` | Custom MUMPS routines | N/A (code) | No fixture concern |
| `locks/` | Lock files | N/A (infrastructure) | No fixture concern |

**Verdict:** The distro repo has no fixture/seed data files. It is code + upstream + config only.

---

## 3. Summary by class

| Class | Count | % of 84 | Action |
|-------|-------|---------|--------|
| **A** Canonical contract data | 75 | 89% | KEEP — no change |
| **B** Honest degraded-mode fallback | 4 | 5% | KEEP with red-line |
| **C** Fabricated prototype data | 5 | 6% | RED-LINE + conversion plan |
| **D** Dead / duplicate / misleading | 0 | 0% | None found |

---

## 4. Conversion plan for class B and C files

### 4.1 Class B → Live VistA data (tenant-admin)

| File | Current source | Target live source | Blocking RPC(s) | Blocker ID | Priority |
|------|---------------|-------------------|------------------|------------|----------|
| `users.json` | 6 fabricated users | VistA File 200 via ORWU NEWPERS | ORWU NEWPERS (VEHU ✅) | B-PROOF-001 | P0 — first PASS-LIVE slice |
| `roles.json` | 7 fabricated keys | VistA File 19.1 via XUS ALLKEYS | XUS ALLKEYS (Vivian ⚡) | B-RPC-001, B-FIXTURE-002 | P1 — after XUS ALLKEYS probe |
| `facilities.json` | 1 fabricated hierarchy | VistA Files 4/40.8/44/42 | XUS DIVISION GET ✅, ORWU CLINLOC ✅, ORQPT WARDS ✅ | B-PROOF-001 | P0 — first PASS-LIVE slice |

**Conversion workflow per file:**
1. Prove the live RPC returns data (Task 4/5 scope).
2. Wire the adapter to call the platform API (not fixture).
3. Fixture becomes dead-letter fallback only (server.mjs already handles this).
4. Test: API returns `source: "vista"`, not `source: "fixture"`.

### 4.2 Class C → Real backend data (control-plane)

| File | Current source | Target live source | Backend needed | Priority |
|------|---------------|-------------------|----------------|----------|
| `tenants.json` | 2 fabricated tenants | control-plane-api PG `tenants` table | Tenant CRUD API (exists at port 4510) | P1 |
| `packs.json` (last pack) | 1 fabricated pack (specialty-cardiology) | Either remove or add to real pack-manifests | Decision: remove or promote | P3 |
| `system-config.json` | Fabricated config | control-plane-api system config endpoint | Needs new endpoint | P2 |
| `bootstrap-requests.json` | Fabricated bootstrap states | control-plane-api bootstrap-routes.mjs | Bootstrap API exists but may not have GET list | P2 |
| `provisioning-runs.json` | Fabricated run data | control-plane-api provisioning-routes.mjs | Provisioning API exists but may not have GET list | P2 |

**Conversion workflow per file:**
1. Verify the control-plane-api endpoint exists and returns the same shape.
2. Wire the control-plane SPA `review-action-map.mjs` to call the API (not fixture).
3. Fixture becomes dead-letter fallback.
4. Test: API returns real PG data, not fixture data.

---

## 5. Red-line requirements

For every surface that currently shows fixture data, the UI MUST:

1. **Display a `source` badge:** "VistA" (green) or "Fixture" (amber) or "Fabricated" (red).
2. **Never present fixture data as VistA truth.** The tenant-admin already does this correctly. The control-plane should match.
3. **Log source in audit:** Every API response includes `source` field in the response body.

### Current red-line compliance

| App | Source badge | Source in response | Compliant? |
|-----|------------|-------------------|------------|
| Tenant-admin | ✅ `Dual-mode badge` shown | ✅ `source: "fixture"` or `source: "vista"` | Yes |
| Control-plane | ⚠️ Has `_provenance` in fixture files | ❌ Server does not return `source` in API responses | Partial — needs server-side source labeling |

---

## 6. Files that do NOT need purging

Despite the "purge" framing, the audit found **zero class D files** and only 5 class C files that need red-line notices. The repos are clean:

- Every fixture file has explicit provenance metadata.
- The tenant-admin server already implements honest source labeling.
- Contract artifacts are real, validated data — not fixtures at all.
- The distro repo has no fixture data.
- No orphaned, duplicate, or misleading files were found.

---

## 7. Cross-references

| Doc | Purpose |
|-----|---------|
| `vista-admin-coverage-ledger-and-gap-map.md` | Coverage tracking (what blocks live conversion) |
| `tenant-admin-blocker-ledger.md` | Active blockers referenced by ID |
| `public-main-and-three-repo-reality-reconciliation-v2.md` | What is fixture-backed across all repos |
| `apps/tenant-admin/fixtures/_fixture-manifest.json` | Canonical fixture classification for tenant-admin |
