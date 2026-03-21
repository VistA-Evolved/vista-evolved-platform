# Public Main Reality Reconciliation

> **Status:** Accepted reconciliation note for current public `main`.
> **Date:** 2026-03-21.
> **Scope:** Reconciles Task 0 claims against actual public repo state in `vista-evolved-platform`, `vista-evolved-vista-distro`, and `VistA-Evolved`.

---

## 1. Why this note exists

Public-facing repo files were telling two different stories at once:

- some platform docs still described a starter scaffold centered on `apps/admin-console/`
- the actual public repo already contained `apps/control-plane/`, `apps/control-plane-api/`, and `apps/tenant-admin/`
- the archive repo still documented a larger Docker-first VistA-backed system, but as frozen reference only

This note makes the current public truth explicit and stops overclaiming.

---

## 2. Reconciliation method

The following comparisons were performed on 2026-03-21:

- local worktree vs `origin/main` for all three repos
- platform source-of-truth docs vs platform README and ADR text
- actual app paths under `vista-evolved-platform/apps/`
- actual contract paths under `vista-evolved-platform/packages/contracts/`
- archive repo posture as read-only reference

After `git fetch origin main --quiet`, each repo still had `HEAD == origin/main`:

- `vista-evolved-platform`: `5c0b756bff2b189f872f3a14045b89f3a9d9f614`
- `vista-evolved-vista-distro`: `ea4289bce92d04a67e63e09985806790d3b920a2`
- `VistA-Evolved`: `03f436bc0536d2613f142adac3cf8a58be2dd573`

That means this reconciliation describes current public `main`, not a local-only branch state.

---

## 3. Truths that agree

The following are present on current public `main` and are consistently supported by repo contents:

1. `vista-evolved-platform` publicly contains `apps/control-plane/`.
2. `vista-evolved-platform` publicly contains `apps/control-plane-api/`.
3. `vista-evolved-platform` publicly contains `apps/tenant-admin/`.
4. `vista-evolved-platform` publicly contains tenant-admin design and grounding docs under `docs/explanation/`.
5. `vista-evolved-platform` publicly contains tenant-admin screen contracts under `packages/contracts/screen-contracts/`.
6. `vista-evolved-platform` publicly contains `apps/admin-console/`, but only as a placeholder.
7. `vista-evolved-vista-distro` publicly contains real distro/runtime material and verification-oriented docs.
8. `VistA-Evolved` publicly remains an archive/frozen reference repo, not the active implementation repo.

---

## 4. Truths that differed before this reconciliation

The following mismatches existed in public repo files before Task 0 repair:

1. The platform README said there were no product features yet, while public `main` already contained working bounded runtimes.
2. The platform README described `apps/` as `control-plane, admin-console`, omitting `control-plane-api` and `tenant-admin`.
3. The architecture backbone and ADR-0003 still pointed tenant admin to `apps/admin-console/`, while the actual public runtime path is `apps/tenant-admin/`.
4. Some planning/reference docs still spoke as if tenant admin were only conceptual, while the source-of-truth index already described a bounded dual-mode prototype.

These were documentation drift problems, not hidden local implementation.

---

## 5. What exists publicly on main

### 5.1 Platform repo

Public `main` in `vista-evolved-platform` contains:

- `apps/control-plane/` - operator console review runtime
- `apps/control-plane-api/` - PG-backed control-plane backend
- `apps/tenant-admin/` - dual-mode prototype shell on port 4520
- `apps/admin-console/` - placeholder only
- tenant-admin explanation docs and grounded discovery docs
- tenant-admin screen-contract JSON files

### 5.2 What the tenant-admin runtime honestly is

The current public tenant-admin runtime is a **bounded prototype**, not a completed live product slice.

It has:

- a runnable Fastify + SPA shell
- VistA adapter wiring for selected read paths
- honest fixture fallback and source labeling
- user, facility, clinic, ward, role, and guided-task surfaces in prototype form

It does **not** yet have public proof of:

- a live VistA-validated happy path for tenant admin
- a complete live read-back chain from terminal truth to API to browser
- a real write path or live guided-write proof package

### 5.3 Distro repo

Public `main` in `vista-evolved-vista-distro` contains the active runtime/build/verify lane material and remains the canonical runtime-truth repo.

### 5.4 Archive repo

Public `main` in `VistA-Evolved` contains the historic full-stack prototype/reference material only. It is not the governing implementation repo for new work.

---

## 6. What exists only locally

None was found for this slice.

After refreshing `origin/main`, the local worktree matched public `main` in all three repos.

---

## 7. What exists only on origin/main

None was found for this slice.

Local `HEAD` matched refreshed `origin/main` in all three repos.

---

## 8. What is missing from both local and public main

The following are still missing from both local and public `main` and must not be overclaimed:

1. A public proof package showing tenant-admin working against live running VistA end-to-end.
2. A public proof package showing the first tenant-admin write or guided-write path with read-back verification.
3. A non-placeholder implementation in `apps/admin-console/`.
4. Public evidence that the current tenant-admin prototype has passed browser plus live-runtime validation.

---

## 9. Decision

The truthful public-main statement is:

- the platform repo is **not** just a starter scaffold
- it **does** publicly contain tenant-admin docs, contracts, a prototype shell, and a control-plane backend
- but the current tenant-admin runtime remains **prototype-grade and not yet live-proven against VistA**
- `apps/admin-console/` is placeholder-only and must not be described as the active tenant-admin runtime

This note is the reconciliation baseline for the next queue steps. Task 1 may proceed from this truth.