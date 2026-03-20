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
| **Control-panel design contract v2** | `docs/explanation/control-panel-design-contract-v2.md` | **Superseded by v3.** Design contract for all 21 surfaces: layout regions, reject/ready checklists, shared design principles, state-badge system. Retained as reference for per-surface field specs. |
| **Operator console design contract v3** | `docs/explanation/operator-console-design-contract-v3.md` | Design contract for 22 surfaces under 8-domain model: shell anatomy, left-nav rules, page header rules, filter/context rail rules, source-posture badge system, state-badge system, stale-data signaling, empty/error/loading rules, Home-as-action-center layout, reject/ready checklists. Supersedes design-contract-v2. |
| **Operator console shell content model** | `docs/explanation/operator-console-shell-content-model.md` | Per-surface content-slot bindings for the 8-domain shell: named slots, data sources, drill targets, actions with posture badges, cross-domain drill map, content-slot validation rules |
| Control-plane static-review prototype implementation batch 2 | `docs/explanation/control-plane-static-review-prototype-implementation-batch-2.md` | **Superseded.** Implementation record for original 8-surface prototype. Runtime now has 21 surfaces. Retained as historical reference. |
| Control-plane local write review runtime batch 3 | `docs/explanation/control-plane-local-write-review-runtime-batch-3.md` | **Expanded.** Review-only write simulation for all 15 contracted write actions. Patterns and ReviewEnvelope contract remain current; surface count expanded from 8 to 21. |
| AI assist safety | `docs/explanation/ai-assist-safety-spec.md` | Assist taxonomy, input/output governance, review model, write-back rules, PHI handling, provider posture, audit, claim boundaries |
| **Control-plane service map and operator console architecture** | `docs/explanation/control-plane-service-map-and-operator-console-architecture.md` | 7 canonical service domains, 4-layer model (services / operator console / self-service / tenant runtime), canonical object model, state families, service-to-surface binding, AI overlay rules, command/event ownership |
| **Control-plane tenant lifecycle and orchestration model** | `docs/explanation/control-plane-tenant-lifecycle-and-orchestration-model.md` | Detailed state machine transition guards, side effects, orchestration flow choreography, full onboarding saga, failure/rollback scenarios, cross-service event choreography |
| **Control panel information architecture and wireframe contract v2** | `docs/explanation/control-panel-information-architecture-and-wireframe-contract-v2.md` | **Superseded by UX/IA reset.** Surface-to-service binding, operator console navigation IA, self-service onboarding IA, tenant-admin boundary, wireframe contract rules, disambiguation guide. Retained as reference for original 5-group model. |
| **Operator console UX/IA reset and journey pack** | `docs/explanation/operator-console-ux-ia-reset-and-journey-pack.md` | Approved 8-domain IA model, migration map from 7-group to 8-domain, Home-as-action-center rules, P0/P1/P2 priority tiers, language/copy rules, state-display rules, source-posture badge rules. Supersedes IA-wireframe-v2 navigation model. |
| **Operator console personas, jobs, and service map** | `docs/explanation/operator-console-personas-jobs-and-service-map.md` | Operator persona model, 12-job catalog (J1–J12) with step-by-step workflows, service-map binding per domain, API contract alignment, anti-patterns |
| **Operator console page priority and content model** | `docs/explanation/operator-console-page-priority-and-content-model.md` | P0/P1/P2 page priority tiers, per-domain content models for all 8 domains (main objects, views, KPIs, first drill-down, next-safe-actions, relationships), cross-domain content rules |
| Control-plane bootstrap design handoff brief | `docs/explanation/control-plane-bootstrap-design-handoff-brief.md` | **Superseded by v2.** Design brief for 8 bootstrap screens under old IA. Retained as reference for v1 component specs. |
| **Operator console design handoff brief v2** | `docs/explanation/operator-console-design-handoff-brief-v2.md` | Full design handoff brief for 22 surfaces under 8-domain model: Figma Make primary brief, Stitch secondary brief, live CSS token reference, component specs (9 components), per-surface design notes, cross-domain drill map, acceptance criteria (15 gates), rejection triggers (12 triggers). Supersedes v1 bootstrap handoff brief. |
| **Tenant admin architecture and boundaries** | `docs/explanation/tenant-admin-architecture-and-boundaries.md` | Workspace identity (family #2), separation from CP, 8 concern areas with VistA grounding, boundary constraints, data flow model, implementation posture |
| **Tenant admin VistA truth map** | `docs/explanation/tenant-admin-vista-truth-map.md` | Maps tenant-admin concerns to VistA files, globals, RPCs: Facility (File 4/44), User (File 200), Role (File 19.1/19), Site Params (File 8989.3), research priorities |
| **Tenant admin VistA admin truth discovery pack** | `docs/explanation/tenant-admin-vista-admin-truth-discovery-pack.md` | Comprehensive discovery: 7 object families (Files 200, 19.1, 4, 40.8, 44, 42, 8989.3), RPC availability with IENs, confidence classifications, safe read paths, guided-write boundaries |
| **Tenant admin VistA users & security keys map** | `docs/explanation/tenant-admin-vista-users-and-security-keys-map.md` | Deep map: File 200 nodes, display-safe vs security-sensitive fields, ORWU NEWPERS/USERINFO/HASKEY patterns, ZVECREUSER.m evidence, File 19.1 key inventory |
| **Tenant admin VistA facility/division/clinic map** | `docs/explanation/tenant-admin-vista-facility-division-clinic-map.md` | Deep map: Files 4/40.8/44 hierarchy, XUS DIVISION GET/ORWU CLINLOC patterns, topology assembly, first-slice simplification |
| **Tenant admin VistA ward & room-bed map** | `docs/explanation/tenant-admin-vista-ward-bed-map.md` | Deep map: Files 42/405.4 structure, patient-oriented vs admin-oriented RPCs, global read paths, P3 priority assessment |
| **Tenant admin personas, jobs, and first-slice journeys** | `docs/explanation/tenant-admin-personas-jobs-and-first-slice-journeys.md` | 3 primary personas (TA-1/2/3), 10-job catalog, 3 first-slice journeys, 6-surface first-slice inventory |
| **Operator-to-tenant-admin handoff model** | `docs/explanation/operator-to-tenant-admin-handoff-model.md` | 3 trigger points, context transfer contract, handoff mechanism, safety constraints, references Task 0 implementations |
| **Tenant admin design contract v1** | `docs/explanation/tenant-admin-design-contract-v1.md` | Shell anatomy, concern-area nav, page header rules, VistA grounding display, per-surface reject/ready checklists, review checklist (15 gates) |
| **VistA admin corpus discovery pack** | `docs/explanation/vista-admin-corpus-discovery-pack.md` | Externally-sourced master reference: 14 admin domains, file/global/RPC tables, confidence classifications (EXT-CONFIRMED, VIVIAN-LOCAL, NEEDS-LIVE-PROOF), 2,510 admin-relevant RPCs, source provenance |
| **VistA admin domain map** | `docs/explanation/vista-admin-domain-map.md` | Quick-reference: concern→package→file→global→RPC family mapping for 12 domains (D1–D12 + D-DDR), global-to-file lookup |
| **VistA admin source manual index** | `docs/explanation/vista-admin-source-manual-index.md` | Bibliography: 12 external sources (Wikipedia, WorldVistA GitHub), 3 local sources (Vivian), 4 failed sources, reliability assessments, research date |

## Runtime apps

| Concern | Canonical location | Notes |
|---------|-------------------|-------|
| Operator console (SPA + review runtime) | `apps/control-plane/` | 22-surface SPA on port 4500 (8 domains). Hybrid reads (real-backend + fixture fallback), review-only writes, lifecycle proxy, copilot routes |
| Operator console README | `apps/control-plane/README.md` | Route inventory, 22-surface table (8 domains), data sourcing tiers, copilot and lifecycle proxy docs |
| Control-plane real backend API | `apps/control-plane-api/` | PG-backed state engine on port 4510. Tenant CRUD, bootstrap requests, provisioning runs. Optional — console falls back to fixtures when unavailable |
| Control-plane API README | `apps/control-plane-api/README.md` | Backend architecture, PG schema, Docker compose, API routes |
| P0 lifecycle proxy routes | `apps/control-plane/routes/lifecycle.mjs` | Proxies tenant/bootstrap/provisioning write mutations to the real backend |
| AI Operator Copilot subsystem | `apps/control-plane/copilot/` | Provider-neutral copilot with 8 bounded tools, operator-role enforcement, full audit. Disabled by default (`COPILOT_ENABLED=false`) |
| Copilot API routes | `apps/control-plane/routes/copilot-routes.mjs` | Status, chat, audit endpoints at `/api/copilot/v1/*` |
| Terminal proof-of-concept | `apps/terminal-proof/` | Terminal-first development scaffold |
| **Tenant admin workspace** | `apps/tenant-admin/` | Dual-mode prototype shell on port 4520. 7 surfaces (dashboard, users, roles, facilities, guided tasks). VistA adapter wired (ORWU NEWPERS, XUS DIVISION GET, ORWU CLINLOC) with fixture fallback. Not yet proven against live VistA. See `apps/tenant-admin/README.md` |
| Admin console shell | `apps/admin-console/` | Future admin console (README placeholder) |
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
