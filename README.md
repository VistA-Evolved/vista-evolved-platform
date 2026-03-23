# VistA Evolved Platform

Control plane, tenant-admin operational shell, contracts, config, and domain for the VistA Evolved rebuild.

## Repo layout

- **apps/** - control-plane, control-plane-api, tenant-admin
- **packages/** — contracts (OpenAPI, AsyncAPI, schemas), config (ports, modules, tenants), domain (admin, tenancy), ui (design-system)
- **docs/** — tutorials, how-to, reference, explanation, ADRs, runbooks
- **prompts/** — active prompts, templates
- **.github/** — CODEOWNERS, workflows
- **artifacts/** — build/verification outputs (gitignored where appropriate)

## Current public-main posture

Public `main` is not a blank scaffold. It currently contains:

- `apps/control-plane/` - operator console review runtime
- `apps/control-plane-api/` - PG-backed control-plane backend
- `apps/tenant-admin/` - VistA-only tenant-admin operational shell with live XWB broker adapter. All routes read from and write to the live VistA system exclusively — no fixture files, no JSON fallbacks, no alternate data sources. If VistA is unreachable, routes return `{ok: false, error: ...}`.

Tenant-admin covers 7 domains (70+ routes): users, facilities, clinical config, billing, system params, HL7 interfaces, and monitoring/audit. Full CRUD lifecycle for users (create, rename, deactivate, reactivate, terminate) is live-verified against the UTF-8 VistA distro. See `docs/reference/source-of-truth-index.md` and `docs/explanation/governed-build-protocol.md`.
