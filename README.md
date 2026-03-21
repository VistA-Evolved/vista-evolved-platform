# VistA Evolved Platform

Control plane, tenant-admin prototype shell, contracts, config, and domain for the VistA Evolved rebuild.

## Repo layout

- **apps/** - control-plane, control-plane-api, tenant-admin, admin-console placeholder
- **packages/** — contracts (OpenAPI, AsyncAPI, schemas), config (ports, modules, tenants), domain (admin, tenancy), ui (design-system)
- **docs/** — tutorials, how-to, reference, explanation, ADRs, runbooks
- **prompts/** — active prompts, templates
- **.github/** — CODEOWNERS, workflows
- **artifacts/** — build/verification outputs (gitignored where appropriate)

## Current public-main posture

Public `main` is not a blank scaffold. It currently contains:

- `apps/control-plane/` - operator console review runtime
- `apps/control-plane-api/` - PG-backed control-plane backend
- `apps/tenant-admin/` - dual-mode tenant-admin prototype shell with VistA adapter wiring and honest fixture fallback
- `apps/admin-console/` - placeholder only

What it does **not** yet contain is a live-proven tenant-admin happy path against running VistA. See `docs/reference/source-of-truth-index.md`, `docs/explanation/public-main-reality-reconciliation.md`, and `docs/explanation/governed-build-protocol.md`.
