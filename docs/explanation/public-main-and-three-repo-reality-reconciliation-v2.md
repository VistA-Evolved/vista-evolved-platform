# Public Main and Three-Repo Reality Reconciliation v2

> **Status:** Canonical reconciliation — supersedes `public-main-reality-reconciliation.md`.
> **Date:** 2026-03-21 (initial), updated 2026-03-22 (tenant-admin VistA-only rewrite).
> **Scope:** Reconciles all three public repos against actual `origin/main` truth and all prior task-report claims.
> **Pass class:** PASS-DOC.
> **Governed by:** AGENTS.md §5 task-execution format, §0.6 repo files are source of truth.

---

## 1. Reconciliation method

On 2026-03-21, all three repos were inspected:

- Local worktree vs `origin/main`: **identical** (no uncommitted changes, `HEAD == origin/main` in all three repos).
- Actual file system contents: directory listings, `git log`, `package.json` contents, `README` contents, fixture inventories, and runtime code all inspected.

### Commit SHAs (current public main)

| Repo | SHA | Verified local = remote |
|------|-----|------------------------|
| `vista-evolved-platform` | `ba6ef27` | Yes |
| `vista-evolved-vista-distro` | `df7346e` | Yes |
| `VistA-Evolved` | `03f436bc` | Yes |

---

## 2. What is publicly real now

### 2.1 vista-evolved-platform

| Artifact | Path | Status |
|----------|------|--------|
| Operator console (SPA) | `apps/control-plane/` | **Present.** 22-surface SPA on port 4500. Real-backend reads (via `control-plane-api`) + contract-backed reads. Lifecycle proxy for real writes. ~~Fixtures, review-only write routes, and copilot subsystem removed 2026-03-22.~~ |
| Control-plane real backend API | `apps/control-plane-api/` | **Present.** PG-backed state engine on port 4510. Tenant CRUD, bootstrap requests, provisioning runs. 4 route files, DB migration, pool. Docker compose for PG. |
| Tenant admin operational shell | `apps/tenant-admin/` | **Present.** Fastify + SPA on port 4520. **70+ VistA-only API routes** across 7 domains (users, facilities, clinical, billing, system, HL7, monitoring). XWB broker adapter (`lib/xwb-client.mjs`). Custom ZVE* M routines for user CRUD, clinic/ward management, and FileMan audit. **No fixture files, no JSON fallbacks** — all routes read/write live VistA exclusively. Full user lifecycle: create, rename, deactivate, reactivate, terminate. 44 Playwright E2E tests verified against running VistA Docker. Session auth with Bearer token and RBAC via VistA security keys. |
| ~~Admin console placeholder~~ | ~~`apps/admin-console/`~~ | **DELETED 2026-03-22.** Empty placeholder removed. `apps/tenant-admin/` is the sole tenant-admin runtime. |
| Terminal proof-of-concept | `apps/terminal-proof/` | **Present.** Minimal scaffold with `src/` and `public/`. |
| Contracts (OpenAPI, AsyncAPI, schemas) | `packages/contracts/` | **Present.** OpenAPI (control-plane), AsyncAPI (provisioning events), JSON Schema (screen-contract, legal-market, pack-manifest, capability-manifest, effective-tenant-config). Pack-manifest, legal-market-profile, screen-contract, capability-manifest instances. |
| Explanation docs | `docs/explanation/` | **Present.** 72 files covering architecture, governance, VistA truth discovery, tenant-admin design, operator console specs, coverage audits, broker canonical path, verification proofs, and reconciliation. |
| ADRs | `docs/adrs/` | **Present.** VE-PLAT-ADR-0001 through 0003. |
| Governance scripts | `scripts/governance/` | **Present.** |
| CI gates | `.github/workflows/governance-gates.yml` | **Present.** |

### 2.2 vista-evolved-vista-distro

| Artifact | Path | Status |
|----------|------|--------|
| Upstream VistA sources | `upstream/` | **Present.** Pinned WorldVistA sources (read-only). |
| Overlay customizations | `overlay/` | **Present.** Custom routines, install, patches, l10n. |
| Docker build lanes | `docker/local-vista/`, `docker/local-vista-utf8/` | **Present.** M-mode and UTF-8 Dockerfiles. |
| Build/verify scripts | `scripts/` | **Present.** Fetch, pin, build, verify, governance. |
| Lock files | `locks/` | **Present.** `worldvista-sources.lock.json`. |
| Runtime truth docs | `docs/reference/runtime-truth.md` | **Present.** |
| ADRs | `docs/adrs/` | **Present.** VE-DISTRO-ADR-0001 through 0003. |
| UTF-8 runtime proof | Verified in commit `6affcd6` and `df7346e` | **Present.** Sign-on, browser terminal, multilingual proof. |

### 2.3 VistA-Evolved (archive)

| Artifact | Status |
|----------|--------|
| Archive marker | `ARCHIVE-STATUS.md` present. Repo frozen. |
| Historical full-stack prototype | Present as reference. 585+ phases of historical development. |
| Bug tracker, AGENTS.md, MUMPS patterns | Present as reference material only. |

---

## 3. What is still prototype/shell only

| Item | Current form | What makes it prototype |
|------|-------------|------------------------|
| Control-plane operator console | 22-surface SPA | Real-backend reads (via `control-plane-api`) + contract-backed reads. Lifecycle proxy for writes. ~~Fixtures and review routes removed 2026-03-22.~~ No VistA integration (not expected — CP is platform-owned). |
| Control-plane-api backend | PG-backed state engine | Functionally server code exists. No public proof of running successfully. Docker compose for PG exists. |

**Tenant-admin is no longer prototype.** As of 2026-03-22, tenant-admin has 70+ VistA-only routes, full CRUD user lifecycle, DDR-based reads across 7 domains, session auth with RBAC, and 44 passing E2E tests against the live VistA Docker container. See `docs/explanation/vista-admin-coverage-ledger-and-gap-map.md` for the full coverage map.

---

## 4. Data sourcing posture

**Tenant-admin has zero fixture-backed surfaces.** All routes are VistA-only. Roles (`#/roles`) and security keys (`#/key-inventory`) are now read from VistA File 200 subfiles and File 19.1 via DDR LISTER. E-signature status is read per-user from `XUSESIG` fields.

**Control-plane fixtures were removed 2026-03-22.** When `control-plane-api` is not running, proxy routes return `{ ok: false, source: "unavailable" }`. Contract-backed routes (markets, packs, capabilities, effective plans) always work.

~~The following fixture table is historical — these files no longer exist:~~

| Surface | Fixture file(s) | Status |
|---------|-----------------|--------|
| Control-plane: tenants list | `fixtures/tenants.json` | CP read surfaces use fixture when `control-plane-api` is not running. |
| Control-plane: capabilities | `fixtures/capabilities.json` | Fixture-backed review state. |
| Control-plane: packs | `fixtures/packs.json` | Fixture-backed review state. |
| Control-plane: legal-market profiles | `fixtures/legal-market-profiles.json` | Fixture-backed review state. |
| Control-plane: effective plans | `fixtures/effective-plans.json` | Fixture-backed review state. |
| Control-plane: bootstrap requests | `fixtures/bootstrap-requests.json` | Fixture-backed review state. |
| Control-plane: provisioning runs | `fixtures/provisioning-runs.json` | Fixture-backed review state. |
| Control-plane: system config | `fixtures/system-config.json` | Fixture-backed review state. |

---

## 5. What is still only locally implied

Nothing is only locally implied. Local worktrees match `origin/main` in all three repos.

---

## 6. What is still missing entirely

Items marked ~~strikethrough~~ have been resolved since the initial v2 reconciliation.

| Missing item | Status |
|-------------|--------|
| ~~Public live proof package for tenant-admin~~ | **RESOLVED.** 44 Playwright E2E tests verified against live VistA Docker. API curl tests documented. |
| ~~Any tenant-admin write path~~ | **RESOLVED.** Full user CRUD: create (POST), rename (PUT), deactivate/reactivate/terminate (POST). Key assignment (PUT/DELETE). |
| ~~Tenant-admin session auth~~ | **RESOLVED.** Bearer token session auth with VistA security key-based RBAC and nav filtering. |
| ~~Site parameter reads~~ | **RESOLVED.** File 8989.3 (Kernel Site Params) wired via DDR LISTER and DDR GETS ENTRY DATA. |
| ~~Bulk key/role enumeration from VistA~~ | **RESOLVED.** File 19.1 (Security Key) enumeration via DDR LISTER. Per-user key subfile reads. |
| ~~Bulk e-sig status from VistA~~ | **RESOLVED.** E-sig active count read from File 200 ELECTRONIC SIGNATURE CODE field. |
| ~~**Non-placeholder `apps/admin-console/`**~~ | **RESOLVED 2026-03-22.** Directory deleted. `apps/tenant-admin/` is the sole path. |
| **Public proof that control-plane-api PG backend runs** | Docker compose exists but no verification artifact. |
| **Real write paths in control-plane** | Lifecycle proxy routes exist but writes are review-only (they proxy to control-plane-api if running). |

---

## 7. Reconciliation with prior task reports (v1)

The v1 reconciliation document (`public-main-reality-reconciliation.md`) was accurate as of 2026-03-21. The following v1 claims have been superseded:

| v1 claim | Still true? |
|----------|-------------|
| "Platform repo is not just a starter scaffold" | Yes |
| "Tenant-admin runtime remains prototype-grade and not yet live-proven" | **No — resolved.** Tenant-admin is now a VistA-only operational shell with 70+ routes, full CRUD, and 44 E2E tests. |
| "`apps/admin-console/` is placeholder-only" | **No — resolved.** Directory deleted 2026-03-22. |
| "No public proof of first write or guided-write path" | **No — resolved.** User create, rename, deactivate, reactivate, and terminate are all write paths verified against live VistA. |

---

## 8. Decision

This document supersedes `public-main-reality-reconciliation.md` as the canonical three-repo reality statement. The blocker items that must be cleared before any slice may be called PASS-LIVE are enumerated in the companion document `tenant-admin-blocker-ledger.md`.

---

## 9. Cross-references

| Doc | Path |
|-----|------|
| This document | `docs/explanation/public-main-and-three-repo-reality-reconciliation-v2.md` |
| Blocker ledger | `docs/explanation/tenant-admin-blocker-ledger.md` |
| Previous reconciliation (v1) | `docs/explanation/public-main-reality-reconciliation.md` |
| Source-of-truth index | `docs/reference/source-of-truth-index.md` |
| Fixture inventory | `docs/explanation/fixture-inventory-and-truth-ownership-audit.md` |
| Happy-path source map | `docs/explanation/tenant-admin-happy-path-source-map.md` |
| Live broker canonical path | `docs/explanation/live-broker-canonical-path.md` |
