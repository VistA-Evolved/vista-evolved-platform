# Documentation Governance

> Canonical doc model for the `vista-evolved-platform` repo.
> Referenced by AGENTS.md, Cursor rules, Copilot instructions, and CI governance gates.

## Approved doc categories

All documentation lives under `/docs` in exactly these categories:

| Category | Purpose | Example |
|----------|---------|---------|
| `tutorials/` | Step-by-step learning paths | "Set up your dev environment" |
| `how-to/` | Task-oriented guides | "How to add an ADR" |
| `reference/` | Technical references, policies, registries, indexes | Port registry, contract system |
| `explanation/` | Architecture rationale, governance protocols | Governed build protocol |
| `adrs/` | Architecture decision records (enterprise-namespaced) | VE-PLAT-ADR-0001 |
| `runbooks/` | Operational procedures and reports | Bootstrap report |

## Approved support paths outside /docs

| Path | Purpose |
|------|---------|
| `/artifacts` | Evidence, verification outputs, build artifacts (gitignored where transient) |
| `/prompts` | Active prompts and reusable templates |
| `/.github` | Workflows, CODEOWNERS, tool instructions |
| `/.cursor` | Cursor rules |
| `/scripts` | Governance checks, Notion sync, automation |

## Forbidden

- `/reports` or `/docs/reports` — never create these.
- Random audit folders, ad-hoc scratch docs, duplicate summaries.
- Committing verification outputs to `/docs` — they belong in `/artifacts`.
- Duplicating prompt content in docs.
- Creating speculative feature documentation for unbuilt features.
- Marketing fluff or sales copy in docs.

## ADR rules

- Enterprise-namespaced IDs: `VE-PLAT-ADR-NNNN` for this repo.
- Cross-repo namespaces: `VE-GOV-` (governance), `VE-ARCH-` (architecture), `VE-PLAT-` (platform), `VE-DISTRO-` (distro).
- Every ADR must be registered in `docs/reference/decision-index.yaml`.
- ADR files in `/docs/adrs/` retain their original filename but include the enterprise ID in the document header.

## Evidence and proof

- Proof = exact files changed + exact commands run + exact outputs + pass/fail.
- Evidence outputs go in `/artifacts`, never in `/docs`.
- See `migrated-process-assets/verification-standard.md` for the full standard.
