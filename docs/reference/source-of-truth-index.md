# Source of Truth Index

> Canonical reference for where authoritative definitions live in this repo.
> If information exists in multiple places, the location listed here is the source of truth.
>
> **Multi-root workspace:** When this file references `/AGENTS.md`, it means this repo's
> AGENTS.md. Each repo in the workspace is self-governing. Sibling repos
> (`VistA-Evolved` archive, `vista-evolved-vista-distro`) have their own governance files.

## Governance and instructions

| Concern | Canonical location | Notes |
|---------|-------------------|-------|
| Cross-tool AI agent rules | `/AGENTS.md` | Root law for all tools |
| Claude Code shim | `/CLAUDE.md` | Points to AGENTS.md |
| Cursor rules | `/.cursor/rules/*.mdc` | Scoped, point to AGENTS.md |
| GitHub Copilot instructions | `/.github/copilot-instructions.md` | Repo-specific |
| Copilot scoped instructions | `/.github/instructions/*.instructions.md` | Path-scoped |
| Code ownership | `/.github/CODEOWNERS` | Bounded contexts |
| Documentation model | `docs/reference/doc-governance.md` | Approved categories and rules |
| Docs policy (short) | `docs/reference/docs-policy.md` | Quick reference |
| AI coding SDLC | `docs/explanation/ai-coding-governance-and-sdlc.md` | Operating rules for AI agents |
| Build protocol | `docs/explanation/governed-build-protocol.md` | Contract-first, proof-first |
| Verification standard | `migrated-process-assets/verification-standard.md` | Evidence bar |
| Mutation & implementation governance | `docs/reference/contract-mutation-and-implementation-governance-protocol.md` | Change classification, stop rules, definition of done, merge-blocking conditions |
| Notion sync policy | `docs/reference/notion-sync-policy.md` | Repo canonical, Notion is mirror |

## Architecture and decisions

| Concern | Canonical location | Notes |
|---------|-------------------|-------|
| **Global system architecture** | `docs/explanation/global-system-architecture-spec.md` | Architecture backbone — planes, boundaries, packs, topology, governance |
| Organization/facility/network/service model | `docs/explanation/organization-facility-network-service-model.md` | Canonical entity model for enterprise/business topology |
| Pack and adapter architecture governance | `docs/explanation/pack-and-adapter-architecture-governance.md` | Pack taxonomy, lifecycle, adapter contracts, composition, claim-gating |
| Capability truth and claim gating | `docs/explanation/capability-truth-and-claim-gating-spec.md` | Readiness states, evidence classes, scope dimensions, claim surfaces, gating rules |
| Country and payer readiness registry | `docs/explanation/country-and-payer-readiness-registry-spec.md` | Market-readiness dimensions, payer readiness model, launch tiers, claim gating for markets/payers |
| Specialty, content, and analytics architecture | `docs/explanation/specialty-content-and-analytics-architecture-spec.md` | Specialty variation model, content taxonomy/lifecycle, analytics boundary, readiness interaction |
| Information architecture and workspace map | `docs/explanation/information-architecture-workspace-map.md` | Workspace families, boundaries, role-to-workspace mapping, navigation model, claim-surface placement, screen-contract implications |
| Screen inventory | `docs/reference/screen-inventory.md` | Planning inventory of surfaces by workspace, bridging workspace map and screen contract schema to permissions, pack visibility, and screen-contract instances |
| Permissions matrix | `docs/reference/permissions-matrix.md` | Role × surface × action × entity-context permissions matrix. Planning-stage reference consuming screen inventory and workspace map §8 |
| Pack visibility rules | `docs/reference/pack-visibility-rules.md` | Planning-stage rules for how pack variation affects surface visibility. Consumes screen inventory, permissions matrix, pack-and-adapter governance. Produces visibility postures for downstream screen-contract instances. |
| Legal-market composition and effective-configuration resolver | `docs/explanation/legal-market-composition-and-effective-configuration-resolver-spec.md` | Legal-market profiles, pack composition algorithm, effective-tenant-configuration plans, resolution guarantees, precedence rules |
| AI assist safety | `docs/explanation/ai-assist-safety-spec.md` | Assist taxonomy, input/output governance, review model, write-back rules, PHI handling, provider posture, audit, claim boundaries |
| Architecture decisions | `docs/adrs/` | Enterprise-namespaced VE-PLAT-ADR-NNNN |
| Decision registry | `docs/reference/decision-index.yaml` | Cross-repo ADR index |
| Boundaries | `docs/reference/boundary-policy.md` | Bounded contexts, cross-boundary rules |
| Persistence | `docs/reference/persistence-policy.md` | No SQLite, VistA SoT |
| Data ownership | `docs/reference/data-ownership-matrix.md` | Who owns what |

## Contracts and configuration

| Concern | Canonical location | Notes |
|---------|-------------------|-------|
| HTTP API contracts | `packages/contracts/openapi/` | OpenAPI 3.x specs |
| Event/WebSocket contracts | `packages/contracts/asyncapi/` | AsyncAPI specs |
| Config schemas | `packages/contracts/schemas/` | JSON Schema |
| Screen contract schema | `packages/contracts/schemas/screen-contract.schema.json` | Workspace placement, boundary enforcement, claim/analytics surface governance (artifact #7) |
| Legal-market profile schema | `packages/contracts/schemas/legal-market-profile.schema.json` | Market-level pack composition: mandated, default-on, eligible, excluded packs; readiness dimensions; launch tier |
| Effective-tenant-configuration-plan schema | `packages/contracts/schemas/effective-tenant-configuration-plan.schema.json` | Resolved tenant config: activated packs, deferred items, readiness posture, tenant selections |
| Screen contract instances | `packages/contracts/screen-contracts/` | Schema-valid JSON instances per surface. Named `{surfaceId}.json`. |
| Capability manifests | `packages/contracts/capability-manifests/` | Module/capability config |
| Contract policy | `docs/reference/contract-policy.md` | Rules for contract usage |
| Contract system | `docs/reference/contract-system.md` | Contract layer architecture |
| Ports / endpoints | `docs/reference/port-registry.md`, `packages/config/ports/` | Single config source |

## Cross-repo truth references

| Concern | Canonical repo | Canonical location | Notes |
|---------|---------------|-------------------|-------|
| VistA lane designation | vista-evolved-vista-distro | `docs/adrs/VE-DISTRO-ADR-0003-utf8-primary-lane.md` | UTF-8 = primary planned operator lane; M-mode = rollback/reference/safety (VE-DISTRO-ADR-0003) |
| VistA runtime truth | vista-evolved-vista-distro | `docs/reference/runtime-truth.md` | Lane readiness, verified/unverified status |
| VistA port registry | vista-evolved-vista-distro | `docs/reference/port-registry.md` | Distro lane ports (9433/2225 M-mode, 9434/2226 UTF-8) |

> Platform does not own lane truth. The distro repo is canonical for VistA runtime lane designation,
> build lanes, and multilingual readiness. Platform references distro truth; it does not re-decide it.

---

## Operational

| Concern | Canonical location | Notes |
|---------|-------------------|-------|
| Runbooks | `docs/runbooks/` | Operational procedures |
| CI governance | `.github/workflows/governance-gates.yml` | Anti-drift checks |
| Governance scripts | `scripts/governance/` | Check scripts for CI |
| Notion sync | `scripts/notion/` | Export-only scaffold |
| Nx adoption plan | `docs/reference/nx-adoption-plan.md` | Future Nx boundary enforcement |
| Project context | `.github/vista_evolved_project_context_master.md` | Durable AI context |
