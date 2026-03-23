# Bootstrap report — Three-repo start

> **Historical snapshot.** This report captures the initial three-repo bootstrap state.
> `apps/admin-console/` referenced below was a placeholder that has since been deleted (2026-03-22).
> The active tenant-admin runtime is `apps/tenant-admin/`.

> **Scope:** Archive the old repo, create vista-evolved-platform and vista-evolved-vista-distro, bootstrap structure and contracts only. No product features, no WorldVistA fetch, no Docker build, no app migration.

---

## 1. Exact folders created

### Parent directory

`c:\Users\kmoul\OneDrive\Documents\GitHub\`

- **VistA-Evolved** — Preserved as archive (existing). Added `ARCHIVE-STATUS.md` only.
- **vista-evolved-platform** — New. Git initialized.
- **vista-evolved-vista-distro** — New. Git initialized.

### vista-evolved-platform

```
apps/control-plane/
apps/admin-console/
packages/contracts/capability-manifests/
packages/contracts/openapi/
packages/contracts/asyncapi/
packages/contracts/schemas/
packages/config/ports/
packages/config/modules/
packages/config/tenants/
packages/domain/admin/
packages/domain/tenancy/
packages/ui/design-system/
docs/tutorials/
docs/how-to/
docs/reference/
docs/explanation/
docs/adrs/
docs/runbooks/
prompts/active/
prompts/templates/
.github/
artifacts/
migrated-process-assets/
```

### vista-evolved-vista-distro

```
upstream/
overlay/routines/
overlay/install/
overlay/patches/
docker/local-vista/
scripts/fetch/
scripts/pin/
scripts/build/
scripts/verify/
docs/tutorials/
docs/how-to/
docs/reference/
docs/explanation/
docs/adrs/
docs/runbooks/
artifacts/
migrated-process-assets/upstream/
migrated-process-assets/runtime/
migrated-process-assets/docs/
```

---

## 2. Exact files created

### Archive (VistA-Evolved)

| File | Purpose |
|------|---------|
| `ARCHIVE-STATUS.md` | Marks repo frozen; no canonical product work; reusable assets may be copied to new repos. |

### vista-evolved-platform

| File | Purpose |
|------|---------|
| `README.md` | Repo overview, layout. |
| `AGENTS.md` | Contract-first, persistence, docs policy, boundaries. |
| `.github/CODEOWNERS` | Owners by bounded context. |
| `.gitignore` | node_modules, artifacts, env, IDE, OS. |
| `docs/reference/source-of-truth-index.md` | Canonical locations. |
| `docs/explanation/governed-build-protocol.md` | Contract-first, config, docs, persistence, proof. |
| `docs/reference/port-registry.md` | Ports and endpoints (TBD). |
| `docs/reference/contract-system.md` | OpenAPI, AsyncAPI, schemas. |
| `docs/reference/data-ownership-matrix.md` | Who owns what data. |
| `docs/reference/boundary-policy.md` | Bounded contexts, cross-boundary via contracts. |
| `docs/reference/contract-policy.md` | OpenAPI/AsyncAPI/schemas, no ad-hoc clients. |
| `docs/reference/docs-policy.md` | Allowed doc categories only. |
| `docs/reference/persistence-policy.md` | No SQLite/in-memory for persistent state; VistA SoT; platform DB scope. |
| `docs/reference/nx-adoption-plan.md` | Nx adoption steps when ready. |
| `docs/adrs/VE-PLAT-ADR-0001-three-repo-architecture.md` | Archive, platform, distro. |
| `docs/adrs/VE-PLAT-ADR-0002-contract-first-architecture.md` | Specs first, generated clients. |
| `docs/adrs/VE-PLAT-ADR-0003-control-plane-vs-tenant-admin.md` | Control plane vs tenant admin. |
| `apps/control-plane/README.md` | Placeholder. |
| `apps/admin-console/README.md` | Placeholder. |
| `packages/contracts/capability-manifests/.gitkeep` | Placeholder. |
| `packages/contracts/openapi/.gitkeep` | Placeholder. |
| `packages/contracts/asyncapi/.gitkeep` | Placeholder. |
| `packages/contracts/schemas/.gitkeep` | Placeholder. |
| `packages/contracts/schemas/tenant.schema.json` | Tenant seed schema. |
| `packages/contracts/schemas/facility.schema.json` | Facility seed schema. |
| `packages/contracts/schemas/facility-type.schema.json` | Facility-type seed. |
| `packages/contracts/schemas/capability-pack.schema.json` | Capability-pack seed. |
| `packages/contracts/schemas/module.schema.json` | Module seed. |
| `packages/contracts/schemas/deployment-profile.schema.json` | Deployment-profile seed. |
| `packages/contracts/schemas/data-ownership.schema.json` | Data-ownership reference. |
| `packages/contracts/schemas/offline-policy.schema.json` | Offline-policy seed. |
| `packages/contracts/schemas/mobile-policy.schema.json` | Mobile-policy seed. |
| `packages/config/ports/.gitkeep` | Placeholder. |
| `packages/config/modules/.gitkeep` | Placeholder. |
| `packages/config/tenants/.gitkeep` | Placeholder. |
| `packages/domain/admin/.gitkeep` | Placeholder. |
| `packages/domain/tenancy/.gitkeep` | Placeholder. |
| `packages/ui/design-system/.gitkeep` | Placeholder. |
| `docs/tutorials/.gitkeep` | Placeholder. |
| `docs/how-to/.gitkeep` | Placeholder. |
| `docs/runbooks/.gitkeep` | Placeholder. |
| `prompts/active/.gitkeep` | Placeholder. |
| `prompts/templates/.gitkeep` | Placeholder. |
| `artifacts/.gitkeep` | Placeholder. |
| `migrated-process-assets/README.md` | Index of archive assets to normalize. |
| `migrated-process-assets/verification-standard.md` | Proof/evidence bar (from archive). |

### vista-evolved-vista-distro

| File | Purpose |
|------|---------|
| `README.md` | Repo overview, layout. |
| `AGENTS.md` | Upstream/overlay, no fetch in bootstrap. |
| `.gitignore` | Upstream clones, artifacts, locks. |
| `docs/reference/upstream-source-strategy.md` | Fetch/pin, overlay, no fetch in bootstrap. |
| `docs/reference/runtime-truth.md` | Local VistA runtime as reference. |
| `docs/reference/customization-policy.md` | All customizations in overlay. |
| `docs/adrs/VE-DISTRO-ADR-0001-upstream-overlay-policy.md` | Upstream read-only, overlay for customizations. |
| `docs/adrs/VE-DISTRO-ADR-0002-local-source-first-builds.md` | Build from local upstream + overlay. |
| `upstream/.gitkeep` | Placeholder. |
| `overlay/routines/.gitkeep` | Placeholder. |
| `overlay/install/.gitkeep` | Placeholder. |
| `overlay/patches/.gitkeep` | Placeholder. |
| `docker/local-vista/.gitkeep` | Placeholder. |
| `scripts/fetch/.gitkeep` | Placeholder. |
| `scripts/pin/.gitkeep` | Placeholder. |
| `scripts/build/.gitkeep` | Placeholder. |
| `scripts/verify/.gitkeep` | Placeholder. |
| `docs/tutorials/.gitkeep` | Placeholder. |
| `docs/how-to/.gitkeep` | Placeholder. |
| `docs/reference/.gitkeep` | Placeholder. |
| `docs/explanation/.gitkeep` | Placeholder. |
| `docs/adrs/.gitkeep` | Placeholder. |
| `docs/runbooks/.gitkeep` | Placeholder. |
| `artifacts/.gitkeep` | Placeholder. |
| `migrated-process-assets/README.md` | What was copied and how to normalize. |
| `migrated-process-assets/upstream/fetch-worldvista-sources.ps1` | From archive (paths: vendor/upstream, vendor/locks). |
| `migrated-process-assets/upstream/pin-worldvista-sources.ps1` | From archive. |
| `migrated-process-assets/upstream/worldvista-sources.config.json` | From archive. |
| `migrated-process-assets/runtime/healthcheck-local-vista.ps1` | From archive. |
| `migrated-process-assets/docs/runtime-readiness-levels.md` | From archive (short). |

---

## 3. Exact files copied from archive

| From (archive) | To |
|----------------|-----|
| `scripts/upstream/fetch-worldvista-sources.ps1` | `vista-evolved-vista-distro/migrated-process-assets/upstream/fetch-worldvista-sources.ps1` |
| `scripts/upstream/pin-worldvista-sources.ps1` | `vista-evolved-vista-distro/migrated-process-assets/upstream/pin-worldvista-sources.ps1` |
| `scripts/upstream/worldvista-sources.config.json` | `vista-evolved-vista-distro/migrated-process-assets/upstream/worldvista-sources.config.json` |
| `scripts/runtime/healthcheck-local-vista.ps1` | `vista-evolved-vista-distro/migrated-process-assets/runtime/healthcheck-local-vista.ps1` |
| `docs/canonical/runtime/runtime-readiness-levels.md` | `vista-evolved-vista-distro/migrated-process-assets/docs/runtime-readiness-levels.md` (short) |
| `docs/canonical/verification-standard.md` | `vista-evolved-platform/migrated-process-assets/verification-standard.md` (short) |

Governance, POLICY, source-of-truth, and governed-build-protocol are **referenced** in platform `migrated-process-assets/README.md`; not duplicated in full.

---

## 4. Unresolved questions

- **CODEOWNERS** — `@vista-evolved/platform` is a placeholder team; create or replace with real team/user.
- **Port registry** — Ports are TBD; fill when control plane and admin console are implemented.
- **Distro script paths** — Fetch/pin scripts still use `vendor/upstream` and `vendor/locks`. When normalizing into `scripts/fetch` and `scripts/pin`, set RepoRoot to distro and switch to `upstream/` and e.g. `artifacts/locks/` or `locks/`.
- **Nx** — Not installed; layout is Nx-friendly. See `docs/reference/nx-adoption-plan.md` for next steps.

---

## 5. What should be the very next prompt

- **Option A (platform):** Add a minimal Nx workspace (nx.json, workspace package.json) and one empty app target so that `nx build control-plane` runs without application code.
- **Option B (distro):** Normalize migrated-process-assets: move fetch/pin scripts into `scripts/fetch` and `scripts/pin`, adapt paths to `upstream/` and `locks/`; move healthcheck into `scripts/verify`; move runtime-readiness and terminal docs into `docs/reference` or `docs/runbooks`.
- **Option C (both):** First commit on both new repos (initial commit with bootstrap only), then push to GitHub as new remotes.

Do **not** fetch WorldVistA, build Docker, build terminal, or build admin UI in the next step unless explicitly requested.
