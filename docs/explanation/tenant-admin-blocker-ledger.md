# Tenant Admin Blocker Ledger

> **Status:** Canonical blocker ledger for tenant-admin PASS-LIVE readiness.
> **Date:** 2026-03-21.
> **Scope:** Consolidated from all prior task reports in the current VS Code queue session,
> plus the three-repo reconciliation v2.
> **Governed by:** AGENTS.md §5 task-execution format.

---

## Purpose

This ledger tracks every unresolved issue that must be cleared before any tenant-admin
slice may be classified as **PASS-LIVE**. Items are sourced from:

- Public-main-and-three-repo-reality-reconciliation-v2.md (this session)
- Prior reconciliation v1 (`public-main-reality-reconciliation.md`)
- Existing tenant-admin docs (README, fixture audit, happy-path source map, broker path)
- Direct code inspection of `apps/tenant-admin/`

---

## Blocker categories

- **B-PROOF** — Missing live proof package (terminal → API → browser end-to-end evidence).
- **B-WRITE** — ~~Missing write path~~ **Superseded:** direct API writes (DDR + `ZVE*` overlay RPCs); proof via `scripts/ddr-tenant-admin-proof.mjs`.
- **B-AUTH** — Missing session/auth enforcement.
- **B-RPC** — Missing VistA RPC or custom routine needed for a surface.
- **B-PERSIST** — Missing restart-safe configuration or canonical runtime setup.
- **B-DOC** — Documentation drift or mismatch with runtime truth.
- **B-FIXTURE** — Fixture still serving as happy-path source for VistA-owned data.

---

## Active blockers

### B-PROOF-001: No public live proof package for tenant-admin — **RESOLVED**

- **Severity:** ~~BLOCKER for any PASS-LIVE claim.~~ **RESOLVED 2026-03-21.**
- **Description:** No evidence artifact exists showing the tenant-admin shell running against a live VistA Docker container with real RPC responses captured end-to-end. The README claims VistA-first with 118 users / 44 clinics / 29 wards, but no public proof package (screenshots, terminal output, API response captures) is committed.
- **Resolution path:** Run tenant-admin against live VistA Docker. Capture terminal truth, API responses, and browser rendering. Commit evidence to `artifacts/`.
- **Resolution:** Task 5 exercised all 11 tenant-admin API endpoints against the live UTF-8 VistA broker. 6 endpoints returned `source: "vista"` with real data (118 users, 44 clinics, 29 wards). Evidence committed to `artifacts/tenant-admin-pass-live-evidence.json`. Proof document at `docs/explanation/tenant-admin-pass-live-proof.md`.
- **Source:** v2 reconciliation §6, v1 reconciliation §8.

### B-WRITE-001: No write path exists — **RESOLVED**

- **Severity:** ~~BLOCKER for any write-side PASS-LIVE claim.~~ **RESOLVED 2026-03-21.**
- **Description:** ~~No tenant-admin surface performed a VistA write.~~ **Superseded:** Mode B guided terminal routes removed. Writes are **direct API**: DDR VALIDATOR/FILER for allow-listed fields and distro RPCs `ZVE USMG *` / `ZVE CLNM *` / `ZVE WRDM *` when installed (`overlay/routines/`).
- **Resolution path:** Run `INSTALL^ZVEUSMG` (etc.) on target VistA; use `scripts/ddr-tenant-admin-proof.mjs` and tenant-admin UI forms for evidence.
- **Resolution:** Direct-write path implemented in `apps/tenant-admin/server.mjs` (`PUT /users/:ien`, `POST/DELETE .../keys`, `POST .../esig`, `PUT .../credentials`, deactivate/reactivate, clinics/wards/devices/params). OpenAPI: `packages/contracts/openapi/tenant-admin.openapi.yaml`. Proof harness: `scripts/ddr-tenant-admin-proof.mjs`. Historical guided-write artifacts are **not** the current contract.
- **Source:** v2 reconciliation §6, tenant-admin README "Known limitations".

### B-AUTH-001: No tenant-scoped session auth

- **Severity:** BLOCKER for production readiness. Not a blocker for dev/proof PASS-LIVE if explicitly noted.
- **Description:** `tenantId` is passed as a query parameter, not enforced by an authenticated tenant-scoped session. Any request can claim any tenant ID.
- **Resolution path:** Implement tenant-scoped session authentication. May require integration with platform IAM or a bounded session mechanism.
- **Source:** Tenant-admin README "Known limitations".

### B-RPC-001: No bulk key/role enumeration RPC

- **Severity:** BLOCKER for role/key-inventory surfaces to move off fixtures.
- **Description:** No single VistA RPC enumerates all security keys from File 19.1 or all key holders. `ORWU HASKEY` checks one user+key pair. Bulk enumeration requires `DDR FILE ENTRIES` or a custom M routine scanning `^DIC(19.1)`.
- **Resolution path:** (a) Probe `DDR FILE ENTRIES` availability in the target VistA lane. (b) If unavailable, write a custom VE* M routine for key enumeration. (c) Deploy to VistA distro overlay.
- **Source:** Tenant-admin README, fixture-inventory-and-truth-ownership-audit.md.

### B-RPC-002: No bulk e-sig status RPC

- **Severity:** BLOCKER for e-sig status surface to move off fixtures.
- **Description:** `ORWU VALIDSIG` validates one e-signature per call but cannot enumerate all users' e-sig status in bulk.
- **Resolution path:** Write a custom VE* M routine for bulk e-sig probing, or accept per-user checking with pagination.
- **Source:** Tenant-admin README.

### B-RPC-003: No site parameter read path

- **Severity:** BLOCKER for site-parameter surface.
- **Description:** File 8989.3 (Kernel Site Parameters) not yet wired. No RPC or adapter call exists.
- **Resolution path:** Probe `ORWU PARAM` or `XWB GET VARIABLE VALUE` or `DDR` reads for File 8989.3 access. May require custom M routine.
- **Source:** Tenant-admin README "Known limitations".

### B-PERSIST-001: Broker connection not proven restart-safe — **RESOLVED**

- **Severity:** ~~BLOCKER for PASS-LIVE canonicalization.~~ **RESOLVED 2026-03-21.**
- **Description:** The XWB broker connection is configured via env vars in `.env.local` (gitignored). The connection path is documented in `live-broker-canonical-path.md` but no proof exists that it survives a Docker container restart or rebuild without manual intervention.
- **Resolution:** Proven in Task 4. Container restarted, broker reconnected, 6 RPCs returned real data. Root cause found: stale entrypoint in Docker image had broken xinetd config (`-direct -run XWBTCPL`). Fixed to correct entry point (`-run GTMLNX^XWBTCPM`). See `docs/explanation/broker-canonicalization-proof.md`.
- **Source:** Task 4 requirement.

### B-FIXTURE-001: Roles surface uses fixture as happy path

- **Severity:** SOFT BLOCKER — acceptable only if explicitly labeled `integration-pending`.
- **Description:** `#/roles` surface returns fixture data because no bulk key enumeration RPC exists (see B-RPC-001). Currently correctly labeled `source: "fixture", sourceStatus: "integration-pending"`.
- **Resolution path:** Blocked by B-RPC-001. Acceptable as integration-pending if honestly labeled.
- **Source:** Fixture inventory audit.

### B-FIXTURE-002: Key inventory surface uses fixture as happy path

- **Severity:** SOFT BLOCKER — same as B-FIXTURE-001.
- **Description:** `#/key-inventory` is fixture-backed. Correctly labeled.
- **Resolution path:** Blocked by B-RPC-001.
- **Source:** Fixture inventory audit.

### B-FIXTURE-003: E-sig status surface uses fixture as happy path

- **Severity:** SOFT BLOCKER — same as B-FIXTURE-001.
- **Description:** `#/esig-status` is fixture-backed. Correctly labeled.
- **Resolution path:** Blocked by B-RPC-002.
- **Source:** Fixture inventory audit.

### B-DOC-001: admin-console path not explicitly deprecated

- **Severity:** LOW — cosmetic/clarity.
- **Description:** `apps/admin-console/` exists as a placeholder README. Not explicitly deprecated or removed. Could confuse future contributors.
- **Resolution path:** Add explicit deprecation note to `apps/admin-console/README.md` or remove directory.
- **Source:** v2 reconciliation §6.

---

## Resolved blockers (from prior task reports)

| ID | Description | Resolution | Date |
|----|-------------|------------|------|
| B-PERSIST-001 | Broker connection not restart-safe | Hot-patched entrypoint template + proved restart persistence (Task 4) | 2026-03-21 |
| B-PROOF-001 | No public live proof package | 6/11 endpoints proved live via tenant-admin server against UTF-8 VistA (Task 5) | 2026-03-21 |
| B-WRITE-001 | No write path exists | DDR + ZVE* direct writes + proof script `ddr-tenant-admin-proof.mjs` (Mode B retired) | 2026-03-21 |

---

## Blocker-to-task mapping

| Blocker | Required before task |
|---------|---------------------|
| B-PROOF-001 | Task 5 (first PASS-LIVE slice) — **RESOLVED 2026-03-21** |
| B-WRITE-001 | Task 6 (first **direct** write path: DDR + ZVE*) — **RESOLVED 2026-03-21** |
| B-AUTH-001 | Not blocking dev/proof PASS-LIVE; blocking production readiness |
| B-RPC-001 | Unblocking role/key surfaces beyond integration-pending |
| B-RPC-002 | Unblocking e-sig surface beyond integration-pending |
| B-RPC-003 | Site parameter surface |
| B-PERSIST-001 | Task 4 (broker canonicalization) — **RESOLVED 2026-03-21** |
| B-FIXTURE-001–003 | Acceptable as integration-pending if labeled; full resolution blocked by B-RPC-001/002 |
| B-DOC-001 | Task 0 or any cleanup pass |

---

## Cross-references

| Doc | Path |
|-----|------|
| This document | `docs/explanation/tenant-admin-blocker-ledger.md` |
| Three-repo reconciliation v2 | `docs/explanation/public-main-and-three-repo-reality-reconciliation-v2.md` |
| Fixture inventory audit | `docs/explanation/fixture-inventory-and-truth-ownership-audit.md` |
| Happy-path source map | `docs/explanation/tenant-admin-happy-path-source-map.md` |
| Live broker canonical path | `docs/explanation/live-broker-canonical-path.md` |
| Broker canonicalization proof | `docs/explanation/broker-canonicalization-proof.md` |
| DDR / direct-write proof (tenant-admin) | `docs/explanation/guided-write-pass-live-proof.md` (filename retained; content is DDR path) |
| Tenant-admin README | `apps/tenant-admin/README.md` |
