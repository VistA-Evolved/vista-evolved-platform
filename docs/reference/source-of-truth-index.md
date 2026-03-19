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
| Control-plane operator bootstrap and provisioning contract map | `docs/explanation/control-plane-operator-bootstrap-and-provisioning-contract-map.md` | Binds operator actions to API operations, events, canonical IDs, and PH truth constraints |
| Control-plane tenant lifecycle and provisioning control contract map (Batch 2) | `docs/explanation/control-plane-tenant-lifecycle-and-provisioning-control-contract-map-batch-2.md` | Batch 2: tenant suspend/reactivate/archive and provisioning cancel write actions, events, error model |
| Control-plane market, pack, and system-config write contract map (Batch 3) | `docs/explanation/control-plane-market-pack-and-system-write-contract-map-batch-3.md` | Batch 3: market/pack authoring and system-config write actions (W9–W16), events, error model |
| Control-panel surface expansion batch 1 | `docs/explanation/control-panel-surface-expansion-batch-1.md` | Batch 1 surface expansion: rationale, stop-and-reconcile, surface-to-service binding, field-level explanation for 4 new control-plane surfaces |
| Control-panel page specs and operator manual batch 1 | `docs/explanation/control-panel-page-specs-and-operator-manual-batch-1.md` | **Superseded by v2.** Page-by-page operator manual for 8 surfaces. Retained as reference. |
| **Control-panel page specs v2** | `docs/explanation/control-panel-page-specs-v2.md` | Page-by-page operator manual for all 21 control-plane surfaces: visible data regions, operator actions, navigation, audit events. Supersedes batch-1 page specs. |
| Control-panel action semantics and source-of-truth binding batch 1 | `docs/explanation/control-panel-action-semantics-and-source-of-truth-binding-batch-1.md` | **Superseded by v2.** Master action matrix for 8 surfaces. Retained as reference. |
| **Control-panel action semantics v2** | `docs/explanation/control-panel-action-semantics-v2.md` | Master action matrix for all 21 surfaces: 36 read actions, 41 write actions, 19 navigation actions, 15 permission claims, 15 sources of truth, audit enrichment rules. Supersedes batch-1 action semantics. |
| Control-panel design contract and static-review prototype batch 1 | `docs/explanation/control-panel-design-contract-and-static-review-prototype-batch-1.md` | **Superseded by v2.** Design contract: layout regions, reject/ready checklists for 8 surfaces. Retained as reference for detailed field specs. |
| **Control-panel design contract v2** | `docs/explanation/control-panel-design-contract-v2.md` | Design contract for all 21 surfaces: layout regions, reject/ready checklists, shared design principles, state-badge system, stale-data signaling, posture labels, page header rules, filter/context rail rules. Supersedes batch-1 design contract. |
| Control-plane static-review prototype implementation batch 2 | `docs/explanation/control-plane-static-review-prototype-implementation-batch-2.md` | Implementation record: vanilla HTML/CSS/JS prototype rendering all 8 surfaces from fixture data, write control posture, fixture provenance |
| Control-plane local write review runtime batch 3 | `docs/explanation/control-plane-local-write-review-runtime-batch-3.md` | Review-only write simulation for all 15 contracted write actions: route architecture, ReviewEnvelope contract, safety posture, UI integration |
| AI assist safety | `docs/explanation/ai-assist-safety-spec.md` | Assist taxonomy, input/output governance, review model, write-back rules, PHI handling, provider posture, audit, claim boundaries |
| **Control-plane service map and operator console architecture** | `docs/explanation/control-plane-service-map-and-operator-console-architecture.md` | 7 canonical service domains, 4-layer model (services / operator console / self-service / tenant runtime), canonical object model, state families, service-to-surface binding, AI overlay rules, command/event ownership |
| **Control-plane tenant lifecycle and orchestration model** | `docs/explanation/control-plane-tenant-lifecycle-and-orchestration-model.md` | Detailed state machine transition guards, side effects, orchestration flow choreography, full onboarding saga, failure/rollback scenarios, cross-service event choreography |
| **Control panel information architecture and wireframe contract v2** | `docs/explanation/control-panel-information-architecture-and-wireframe-contract-v2.md` | Surface-to-service binding, operator console navigation IA, self-service onboarding IA, tenant-admin boundary, wireframe contract rules, disambiguation guide |
| Architecture decisions | `docs/adrs/` | Enterprise-namespaced VE-PLAT-ADR-NNNN |
| Decision registry | `docs/reference/decision-index.yaml` | Cross-repo ADR index |
| Boundaries | `docs/reference/boundary-policy.md` | Bounded contexts, cross-boundary rules |
| Persistence | `docs/reference/persistence-policy.md` | No SQLite, VistA SoT |
| Data ownership | `docs/reference/data-ownership-matrix.md` | Who owns what |

## Contracts and configuration

| Concern | Canonical location | Notes |
|---------|-------------------|-------|
| HTTP API contracts | `packages/contracts/openapi/` | OpenAPI 3.x specs |
| Control-plane bootstrap/provisioning API | `packages/contracts/openapi/control-plane-operator-bootstrap-and-provisioning.openapi.yaml` | Operator-facing control-plane reads (tenants, markets, packs, system-config), bootstrap, provisioning, tenant lifecycle, provisioning control, market/pack authoring, and system-config write HTTP contract (26 operations) |
| Event/WebSocket contracts | `packages/contracts/asyncapi/` | AsyncAPI specs |
| Control-plane provisioning events | `packages/contracts/asyncapi/control-plane-provisioning-events.asyncapi.yaml` | Bootstrap, provisioning lifecycle, market/pack authoring, and system-config event contract (20 operations) |
| Config schemas | `packages/contracts/schemas/` | JSON Schema |
| Screen contract schema | `packages/contracts/schemas/screen-contract.schema.json` | Workspace placement, boundary enforcement, claim/analytics surface governance (artifact #7) |
| Legal-market profile schema | `packages/contracts/schemas/legal-market-profile.schema.json` | Market-level pack composition: mandated, default-on, eligible, excluded packs; readiness dimensions; launch tier |
| Effective-tenant-configuration-plan schema | `packages/contracts/schemas/effective-tenant-configuration-plan.schema.json` | Resolved tenant config: activated packs, deferred items, readiness posture, tenant selections |
| Pack manifest schema | `packages/contracts/schemas/pack-manifest.schema.json` | Focused pack identity, lifecycle, attachment, dependencies, eligibility, content summary, adapter requirements, configuration keys, capability contributions |
| Capability manifest schema | `packages/contracts/schemas/capability-manifest.schema.json` | Canonical capability identity, readiness (9-state), scope, pack/adapter dependencies, claim posture, activation semantics |
| Pack manifest instances | `packages/contracts/pack-manifests/` | Schema-valid JSON instances per pack. Named `{packId}.json`. |
| Legal-market profile instances | `packages/contracts/legal-market-profiles/` | Schema-valid JSON instances per legal market. Named `{legalMarketId}.json` (uppercase ISO 3166-1 alpha-2). |
| Effective-tenant-configuration-plan instances | `packages/contracts/effective-tenant-configuration-plans/` | Schema-valid JSON instances per tenant scenario. Named `{legalMarketId}-{scenario}.json`. |
| Screen contract instances | `packages/contracts/screen-contracts/` | Schema-valid JSON instances per surface. Named `{surfaceId}.json`. |
| Capability manifest instances | `packages/contracts/capability-manifests/` | Schema-valid JSON instances per capability. Named `{capabilityClass}.{capabilityName}.json`. |
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
