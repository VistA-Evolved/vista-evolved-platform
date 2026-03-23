# Tenant Admin Blocker Ledger

> **Status:** Canonical blocker ledger for tenant-admin PASS-LIVE readiness.
> **Date:** 2026-03-21 (initial), updated 2026-03-22 (post-VistA-only rewrite).
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

## Resolved blockers (detail)

> All original blockers are resolved as of 2026-03-22. No active blockers remain.

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

### B-AUTH-001: No tenant-scoped session auth — **RESOLVED**

- **Severity:** ~~BLOCKER for production readiness.~~ **RESOLVED 2026-03-22.**
- **Description:** ~~`tenantId` is passed as a query parameter, not enforced by an authenticated tenant-scoped session.~~
- **Resolution:** Tenant-admin now uses Bearer token session auth. Login validates access/verify codes against VistA broker credentials. Session is bound to `tenantId` at login time; subsequent requests validate `tenantId` from session. VistA security keys drive RBAC-based navigation group filtering (10 nav groups gated by key presence). 401 on expired/missing tokens.
- **Source:** `apps/tenant-admin/server.mjs` auth routes and `onRequest` hook.

### B-RPC-001: No bulk key/role enumeration RPC — **RESOLVED**

- **Severity:** ~~BLOCKER for role/key-inventory surfaces to move off fixtures.~~ **RESOLVED 2026-03-22.**
- **Description:** ~~No single VistA RPC enumerates all security keys from File 19.1.~~
- **Resolution:** DDR LISTER reads File 19.1 (Security Key) in bulk. Per-user key assignment reads via DDR GETS ENTRY DATA on File 200 subfile 200.051. Key add/remove via `ZVE USMG KEYS` RPC. Roles list page and key inventory page now live VistA-only with zero fixtures.
- **Source:** `apps/tenant-admin/server.mjs` roles/keys routes.

### B-RPC-002: No bulk e-sig status RPC — **RESOLVED**

- **Severity:** ~~BLOCKER for e-sig status surface to move off fixtures.~~ **RESOLVED 2026-03-22.**
- **Description:** ~~`ORWU VALIDSIG` validates one e-signature per call but cannot enumerate all users' e-sig status in bulk.~~
- **Resolution:** E-signature active count read from File 200 ELECTRONIC SIGNATURE CODE field (field 20.4) via DDR LISTER with a screen for non-empty values. Per-user e-sig detail available on user detail page. Dashboard shows aggregate e-sig active count.
- **Source:** `apps/tenant-admin/server.mjs` dashboard and user-detail routes.

### B-RPC-003: No site parameter read path — **RESOLVED**

- **Severity:** ~~BLOCKER for site-parameter surface.~~ **RESOLVED 2026-03-22.**
- **Description:** ~~File 8989.3 (Kernel Site Parameters) not yet wired.~~
- **Resolution:** File 8989.3 reads via DDR LISTER and DDR GETS ENTRY DATA. The `#/settings/params` route returns site parameters including site name, domain, production switch, default institution, and more. TaskMan status and error trap also live-wired.
- **Source:** `apps/tenant-admin/server.mjs` system parameter routes.

### B-PERSIST-001: Broker connection not proven restart-safe — **RESOLVED**

- **Severity:** ~~BLOCKER for PASS-LIVE canonicalization.~~ **RESOLVED 2026-03-21.**
- **Description:** The XWB broker connection is configured via env vars in `.env.local` (gitignored). The connection path is documented in `live-broker-canonical-path.md` but no proof exists that it survives a Docker container restart or rebuild without manual intervention.
- **Resolution:** Proven in Task 4. Container restarted, broker reconnected, 6 RPCs returned real data. Root cause found: stale entrypoint in Docker image had broken xinetd config (`-direct -run XWBTCPL`). Fixed to correct entry point (`-run GTMLNX^XWBTCPM`). See `docs/explanation/broker-canonicalization-proof.md`.
- **Source:** Task 4 requirement.

### B-FIXTURE-001: Roles surface uses fixture as happy path — **RESOLVED**

- **Severity:** ~~SOFT BLOCKER.~~ **RESOLVED 2026-03-22.**
- **Description:** ~~`#/roles` surface returns fixture data.~~
- **Resolution:** Roles now read from VistA File 19.1 via DDR LISTER. No fixtures exist in tenant-admin. B-RPC-001 resolved.

### B-FIXTURE-002: Key inventory surface uses fixture as happy path — **RESOLVED**

- **Severity:** ~~SOFT BLOCKER.~~ **RESOLVED 2026-03-22.**
- **Description:** ~~`#/key-inventory` is fixture-backed.~~
- **Resolution:** Key inventory reads from VistA File 19.1 + per-user key subfiles via DDR. No fixtures.

### B-FIXTURE-003: E-sig status surface uses fixture as happy path — **RESOLVED**

- **Severity:** ~~SOFT BLOCKER.~~ **RESOLVED 2026-03-22.**
- **Description:** ~~`#/esig-status` is fixture-backed.~~
- **Resolution:** E-sig status reads from VistA File 200 field 20.4 via DDR LISTER. No fixtures.

### B-DOC-001: admin-console path not explicitly deprecated — **RESOLVED**

- **Severity:** ~~LOW — cosmetic/clarity.~~ **RESOLVED 2026-03-22.**
- **Description:** ~~`apps/admin-console/` exists as a placeholder README.~~
- **Resolution:** `apps/admin-console/` directory deleted entirely. All 16 documentation files referencing it updated to point to `apps/tenant-admin/`. AGENTS.md boundaries, ADR-0001, ADR-0003, source-of-truth index, screen inventory, global architecture spec, information architecture workspace map, and bootstrap report all updated.

---

## Resolved blockers (from prior task reports)

| ID | Description | Resolution | Date |
|----|-------------|------------|------|
| B-PERSIST-001 | Broker connection not restart-safe | Hot-patched entrypoint template + proved restart persistence (Task 4) | 2026-03-21 |
| B-PROOF-001 | No public live proof package | 6/11 endpoints proved live via tenant-admin server against UTF-8 VistA (Task 5), expanded to 70+ routes + 44 E2E tests | 2026-03-22 |
| B-WRITE-001 | No write path exists | DDR + ZVE* direct writes + full CRUD user lifecycle (create, rename, deactivate, reactivate, terminate) | 2026-03-22 |
| B-AUTH-001 | No tenant-scoped session auth | Bearer token auth + VistA security key RBAC + nav group filtering | 2026-03-22 |
| B-RPC-001 | No bulk key/role enumeration | DDR LISTER on File 19.1 + per-user key subfile reads | 2026-03-22 |
| B-RPC-002 | No bulk e-sig status | DDR LISTER on File 200 field 20.4 | 2026-03-22 |
| B-RPC-003 | No site parameter read path | DDR LISTER + DDR GETS on File 8989.3 | 2026-03-22 |
| B-FIXTURE-001 | Roles surface fixture-backed | VistA-only via DDR; all fixtures removed | 2026-03-22 |
| B-FIXTURE-002 | Key inventory fixture-backed | VistA-only via DDR; all fixtures removed | 2026-03-22 |
| B-FIXTURE-003 | E-sig status fixture-backed | VistA-only via DDR; all fixtures removed | 2026-03-22 |
| B-DOC-001 | admin-console path not deprecated | Directory deleted, all 16 docs updated to `apps/tenant-admin/` | 2026-03-22 |

---

## Blocker-to-task mapping

| Blocker | Status |
|---------|--------|
| B-PROOF-001 | **RESOLVED 2026-03-22** |
| B-WRITE-001 | **RESOLVED 2026-03-22** |
| B-AUTH-001 | **RESOLVED 2026-03-22** |
| B-RPC-001 | **RESOLVED 2026-03-22** |
| B-RPC-002 | **RESOLVED 2026-03-22** |
| B-RPC-003 | **RESOLVED 2026-03-22** |
| B-PERSIST-001 | **RESOLVED 2026-03-21** |
| B-FIXTURE-001–003 | **RESOLVED 2026-03-22** |
| B-DOC-001 | **RESOLVED 2026-03-22** — directory deleted, all docs updated |

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
