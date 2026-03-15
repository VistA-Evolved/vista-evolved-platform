# VistA Evolved Platform — Copilot Instructions

## Root law

Read `/AGENTS.md` before any task. It is the canonical cross-tool governance file.

## Key rules

1. **Terminal-first.** VistA Evolved starts from VistA truth, not broad GUI surfaces.
2. **Contract-first.** HTTP APIs in OpenAPI (`packages/contracts/openapi/`), events in AsyncAPI, config in JSON Schema. Use generated SDKs.
3. **No documentation sprawl.** Only: tutorials, how-to, reference, explanation, adrs, runbooks under `/docs`. Evidence in `/artifacts`.
4. **No silent mocks.** Return explicit `integration-pending` when infrastructure is unavailable.
5. **One slice at a time.** Verify each slice before starting the next.
6. **Proof required.** Every task must report: files changed, commands run, outputs, pass/fail.
7. **ADRs are enterprise-namespaced.** `VE-PLAT-ADR-NNNN` for this repo. Register in `docs/reference/decision-index.yaml`.

## Key references

| What | Where |
|------|-------|
| Source of truth index | `docs/reference/source-of-truth-index.md` |
| Doc governance | `docs/reference/doc-governance.md` |
| Contract system | `docs/reference/contract-system.md` |
| Decision index | `docs/reference/decision-index.yaml` |
| Boundary policy | `docs/reference/boundary-policy.md` |
| Persistence policy | `docs/reference/persistence-policy.md` |

## Task response format

Every task must end with: Objective, Files inspected, Files changed, Commands run, Results, Verified truth, Unverified areas, Risks, Next step.
