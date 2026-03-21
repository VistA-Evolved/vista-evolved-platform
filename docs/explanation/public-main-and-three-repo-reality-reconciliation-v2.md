# Public Main and Three-Repo Reality Reconciliation v2

> **Status:** Canonical reconciliation — supersedes `public-main-reality-reconciliation.md`.
> **Date:** 2026-03-21.
> **Scope:** Reconciles all three public repos against actual `origin/main` truth and all prior task-report claims from the current VS Code chat session.
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
| Operator console (SPA + review runtime) | `apps/control-plane/` | **Present.** 22-surface SPA on port 4500. Hybrid reads (real-backend + fixture fallback). Review-only writes. Copilot subsystem. |
| Control-plane real backend API | `apps/control-plane-api/` | **Present.** PG-backed state engine on port 4510. Tenant CRUD, bootstrap requests, provisioning runs. 4 route files, DB migration, pool. Docker compose for PG. |
| Tenant admin prototype shell | `apps/tenant-admin/` | **Present.** Fastify + SPA on port 4520. 13 API surfaces. XWB broker adapter (`lib/xwb-client.mjs`, `lib/vista-adapter.mjs`). Fixture fallback with honest source labeling. |
| Admin console placeholder | `apps/admin-console/` | **Present.** README-only placeholder. No runtime code. |
| Terminal proof-of-concept | `apps/terminal-proof/` | **Present.** Minimal scaffold with `src/` and `public/`. |
| Contracts (OpenAPI, AsyncAPI, schemas) | `packages/contracts/` | **Present.** OpenAPI (control-plane), AsyncAPI (provisioning events), JSON Schema (screen-contract, legal-market, pack-manifest, capability-manifest, effective-tenant-config). Pack-manifest, legal-market-profile, screen-contract, capability-manifest instances. |
| Explanation docs | `docs/explanation/` | **Present.** 62 files covering architecture, governance, VistA truth discovery, tenant-admin design, operator console specs, fixture audit, broker canonical path, and more. |
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

These items exist on public main but are **not yet live-proven against running VistA**:

| Item | Current form | What makes it prototype |
|------|-------------|------------------------|
| Tenant-admin user list (`#/users`) | VistA-first adapter wired to `ORWU NEWPERS` | Adapter code exists and claims VistA-first. **No public proof package** showing live end-to-end browser → API → VistA → browser read-back cycle. |
| Tenant-admin facility/clinic/ward lists | VistA-first adapter wired to `XUS DIVISION GET`, `ORWU CLINLOC`, `ORQPT WARDS` | Same. Adapter code exists. No public proof package. |
| Tenant-admin topology (`#/topology`) | Assembles divisions + clinics + wards from VistA adapter calls | Same. No public proof package. |
| Tenant-admin dashboard (`#/dashboard`) | Aggregates VistA counts if broker is available | Fallback to fixture counts. No public proof. |
| Control-plane operator console | 22-surface SPA | Hybrid reads. Many surfaces serve fixture data as happy path. Review-only writes proxy to `control-plane-api`. No VistA integration (not expected — CP is platform-owned). |
| Control-plane-api backend | PG-backed state engine | Functionally server code exists. No public proof of running successfully. Docker compose for PG exists. |

---

## 4. What is still fixture-backed

| Surface | Fixture file(s) | Status |
|---------|-----------------|--------|
| Tenant-admin role assignment (`#/roles`) | `fixtures/roles.json` | **Integration-pending.** No bulk RPC for File 19.1 enumeration. |
| Tenant-admin key inventory (`#/key-inventory`) | `fixtures/roles.json` + `fixtures/users.json` | **Integration-pending.** Same File 19.1 blocker. |
| Tenant-admin e-sig status (`#/esig-status`) | `fixtures/users.json` | **Integration-pending.** `ORWU VALIDSIG` is per-user only; no bulk RPC. |
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

| Missing item | Why it matters |
|-------------|----------------|
| **Public live proof package for tenant-admin** | No evidence artifact shows the tenant-admin shell running against a live VistA Docker container with real RPC responses captured end-to-end (terminal → API → browser). |
| **Any tenant-admin write path (real or guided)** | No write or guided-write path exists in tenant-admin. Guided tasks are informational cards only. |
| **Tenant-admin session auth** | `tenantId` is passed as a query parameter, not enforced by authenticated session. |
| **Site parameter reads** | File 8989.3 (Kernel Site Parameters) not wired. |
| **Bulk key/role enumeration from VistA** | No RPC or custom routine for enumerating File 19.1 security keys. |
| **Bulk e-sig status from VistA** | No bulk RPC for e-sig validation. |
| **Non-placeholder `apps/admin-console/`** | Only a README. If this path is dead, it should be explicitly deprecated or removed. |
| **Public proof that control-plane-api PG backend runs** | Docker compose exists but no verification artifact. |
| **Real write paths in control-plane** | Lifecycle proxy routes exist but writes are review-only (they proxy to control-plane-api if running). |

---

## 7. Reconciliation with prior task reports (v1)

The v1 reconciliation document (`public-main-reality-reconciliation.md`) was accurate as of its date (2026-03-21 earlier commit). Since then, commit `d17ac86` and `ba6ef27` added the VistA-first operational shell and audit fixes. The following items from v1 remain true:

| v1 claim | Still true in v2? |
|----------|-------------------|
| "Platform repo is not just a starter scaffold" | Yes |
| "Tenant-admin runtime remains prototype-grade and not yet live-proven" | **Yes — still true.** No public proof package yet. |
| "`apps/admin-console/` is placeholder-only" | Yes |
| "No public proof of first write or guided-write path" | Yes |

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
