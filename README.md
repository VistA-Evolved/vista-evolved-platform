# VistA Evolved Platform

Control plane, admin console, contracts, config, and domain for the VistA Evolved rebuild.

## Repo layout

- **apps/** — control-plane, admin-console
- **packages/** — contracts (OpenAPI, AsyncAPI, schemas), config (ports, modules, tenants), domain (admin, tenancy), ui (design-system)
- **docs/** — tutorials, how-to, reference, explanation, ADRs, runbooks
- **prompts/** — active prompts, templates
- **.github/** — CODEOWNERS, workflows
- **artifacts/** — build/verification outputs (gitignored where appropriate)

## Bootstrapped

No product features yet. Contract-first, Nx-compatible workspace planned. See `docs/reference/source-of-truth-index.md` and `docs/explanation/governed-build-protocol.md`.
