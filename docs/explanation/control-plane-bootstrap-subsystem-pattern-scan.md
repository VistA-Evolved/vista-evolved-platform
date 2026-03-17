# Control-Plane Bootstrap — Subsystem Pattern Scan

> **Artifact type:** Explanation / planning research — NOT implementation authorization.
> **Repo:** `vista-evolved-platform`
> **Date:** 2026-03-18
> **Status:** Draft — pending human review.
> **Scope:** Build/borrow/avoid matrix for the 13+ concern areas a control-plane bootstrap flow must address, with external system pattern classification.
> **Does NOT:** Create screen-contract instances, define API endpoints, authorize code, define database schemas, produce UI.

---

## 1. Purpose

The control-plane workspace has four inventoried surfaces (`control-plane.tenants.list`, `control-plane.markets.management`, `control-plane.packs.catalog`, `control-plane.system.config`) and three screen-contract instances (no instance yet for `system.config`). Architecture specs define **what** these surfaces govern. This document asks: **how should each subsystem concern be addressed?**

For each concern area, the scan classifies external systems as `integrate`, `inspiration`, `later`, or `not-now`, and recommends whether to `build`, `borrow`, or `avoid` a given pattern.

### 1.1 Position in the planning sequence

This document is consumed by:

- `control-plane-bootstrap-journeys-and-stories.md` — user stories reference subsystem choices.
- `control-plane-bootstrap-ux-ia-and-wireframes.md` — wireframes show subsystem surfaces.
- `control-plane-bootstrap-design-handoff-brief.md` — Figma brief references pattern decisions.

It consumes and aligns to:

| Input | Location |
|-------|----------|
| Global system architecture | `docs/explanation/global-system-architecture-spec.md` §4, §7, §13 |
| Organization/facility model | `docs/explanation/organization-facility-network-service-model.md` §5–§7, §15 |
| Pack/adapter governance | `docs/explanation/pack-and-adapter-architecture-governance.md` §6, §9, §12, §14 |
| Capability truth / claim-gating | `docs/explanation/capability-truth-and-claim-gating-spec.md` §7, §10–§11, §15 |
| Country/payer readiness | `docs/explanation/country-and-payer-readiness-registry-spec.md` §7–§8, §12, §15 |
| Workspace map | `docs/explanation/information-architecture-workspace-map.md` §7–§11 |
| Screen inventory §9 | `docs/reference/screen-inventory.md` §9 (4 CP surfaces) |
| Permissions matrix §7A | `docs/reference/permissions-matrix.md` §7A |
| Pack visibility rules §6–§7 | `docs/reference/pack-visibility-rules.md` §6–§7 |

### 1.2 Non-goals

- No vendor UI cloning. External systems are classified for pattern learning, not visual reproduction.
- No speculative feature ideation. Concern areas come from the architecture specs, not from "what would be nice."
- No endorsement of specific open-source projects. Named projects are examples of pattern categories.

---

## 2. Stop-and-reconcile: current truth vs gaps

Before scanning subsystem patterns, this section reconciles what the platform repo already owns against what the bootstrap flow needs.

### 2.1 What current truth provides

| Artifact | What it governs | Status |
|----------|----------------|--------|
| Global system architecture | Planes, CP vs TA separation, anti-goals | Accepted |
| Organization/facility model | Entity types, tenant hierarchy, provisioning implications | Accepted |
| Pack/adapter governance | 7 pack families, lifecycle, eligibility, activation | Accepted |
| Capability truth | 9 readiness states, claim surfaces, gating rules | Accepted |
| Country/payer readiness | Market dimensions, launch tiers, payer readiness | Accepted |
| Workspace map | 7 families, CP workspace definition, role alignment, nav model | Accepted |
| Screen inventory §9 | 4 CP surfaces inventoried (tenants, markets, packs, system.config) | Accepted |
| Permissions matrix §7A | PO-only permissions for 4 CP surfaces | Draft |
| Pack visibility §6–7 | CP surfaces: base-visible, no pack gating | Draft |
| Screen contracts (3 of 4) | `tenants.list`, `markets.management`, `packs.catalog` | Draft JSON |

### 2.2 What is NOT yet defined

| Gap | What's missing | Which concern area(s) |
|-----|---------------|----------------------|
| **Bootstrap workflow definition** | Step-by-step provisioning flow from first-run to operational tenant | Tenant provisioning, legal-market selection |
| **Entity-creation APIs** | How tenants, facilities, legal entities are created | Tenant lifecycle, facility binding |
| **Pack activation UX** | How operators select and activate packs during provisioning | Pack eligibility, composition |
| **Market → pack wiring** | How legal-market selection constrains pack activation | Market readiness, pack eligibility |
| **Capability readiness display** | How operators see and act on capability readiness states | Readiness gating, claim surfaces |
| **Topology preset patterns** | How different deployment sizes (single-clinic vs enterprise) affect setup | Provisioning, facility hierarchy |
| **Audit trail for provisioning** | How provisioning actions are logged and governed | Audit, governance |
| **system.config screen contract** | Fourth CP surface has no JSON instance yet | System configuration |

### 2.3 How this slice addresses the gaps

This planning pack does NOT close the gaps. It produces the design research needed for future bounded slices to close them: subsystem patterns (this document), user journeys/stories, UX/IA/wireframes, and a design-handoff brief. The next implementation slice after human review would produce screen-contract instances and/or API contracts.

---

## 3. External system classification vocabulary

| Classification | Meaning | Action |
|----------------|---------|--------|
| **integrate** | This system's pattern or protocol is directly consumed by VistA Evolved (e.g., VistA RPC, FHIR spec, X12 format). | Study the integration protocol; design adapters. |
| **inspiration** | This system's UX or workflow patterns are worth studying for design ideas, but neither its code, brand, nor pixel-level design should be reproduced. | Study the pattern; apply the principle in clean-room design. |
| **later** | This system is relevant but the concern area it addresses is deferred beyond the bootstrap phase. | Document for future slices; do not design for it now. |
| **not-now** | This system is irrelevant to the bootstrap phase or contradicts architecture anti-goals. | Ignore; do not reference in wireframes or stories. |

---

## 4. Concern-area matrix

### 4.1 Tenant provisioning and lifecycle

**What it is:** Creating, configuring, suspending, and archiving tenants. The `control-plane.tenants.list` surface owns this.

**Architecture anchor:** Organization/facility model §15 (provisioning implications), workspace map §11 (CP workspace definition), global system architecture §13 (CP owns tenant lifecycle).

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Build/borrow/avoid** | **Build** — platform-native | No VistA equivalent. Tenant is a platform concept. |
| Data source | Platform PG (governance tables) | Per persistence policy: platform PG for control-plane concerns. |
| Complexity model | Minimal first-run: name + legal-market + primary contact → full config later | Avoid heavyweight wizard; let topology presets handle complexity. |

**External systems:**

| System | Classification | Pattern learned |
|--------|---------------|----------------|
| Stripe Dashboard (tenant/subscription) | **inspiration** | Clean table-to-detail drill-down, status badges, creation flow. |
| AWS Organizations | **inspiration** | Account-as-tenant model, service control policies, organizational hierarchy. |
| Keycloak admin (realm management) | **inspiration** | Realm-as-tenant, attribute-based configuration, realm creation wizard. |
| FHIR Organization resource | **later** | Potential FHIR alignment for tenant/org modeling in interoperability phase. |
| VistA Kernel Site Parameters | **not-now** | Inside-VistA per-facility parameters, not platform tenant concept. |

### 4.2 Legal-market selection and launch-tier gating

**What it is:** Selecting the legal jurisdiction for a tenant and enforcing launch-tier constraints on what can be provisioned. The `control-plane.markets.management` surface owns market configuration; tenant provisioning flow consumes market selection.

**Architecture anchor:** Country/payer readiness §7 (market dimensions), §12 (launch tiers), §15 (provisioning integration). Capability truth §11 (gating rules).

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Build/borrow/avoid** | **Build** — registry-driven | Market readiness registry is platform-native. No existing system models VistA market readiness dimensions. |
| Source of truth | Country/payer readiness registry (platform PG) | Canonical per architecture spec. |
| Gating enforcement | Hard-gate at provisioning: only markets ≥ T1 available for tenant creation | Per capability truth §11 rule 2: no provisioning without eligibility. |
| Dimension display | Show all 7 dimensions per market with honest readiness state | Operators see internal states (T0 = exploratory). No claim inflation per §11 rule 1. |

**External systems:**

| System | Classification | Pattern learned |
|--------|---------------|----------------|
| LaunchDarkly (feature flagging, % rollout) | **inspiration** | Feature-flag gating with progressive enablement; not market readiness, but similar gating concept. |
| AWS Region/compliance selection | **inspiration** | Compliance selection at onboarding constraining downstream options. |
| PhilHealth eClaims portal | **later** | Payer-specific integration; relevant for T2+ markets, not bootstrap. |
| FHIR Jurisdiction resource | **later** | Potential alignment for market modeling in interoperability phase. |

### 4.3 Pack catalog and eligibility management

**What it is:** Managing the platform-wide pack catalog, setting eligibility rules, and mapping packs to capabilities. The `control-plane.packs.catalog` surface owns this.

**Architecture anchor:** Pack/adapter governance §6 (7 families), §9 (attachment points), §11 (eligibility), §12 (lifecycle), §14 (activation workflow).

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Build/borrow/avoid** | **Build** — platform-native, schema-driven | Pack model is unique to VistA Evolved. No external system models the same 7-family taxonomy. |
| Pack display | Catalog view grouped by family, filterable by lifecycle state | Per §12: operators manage lifecycle progression (draft → validated → published). |
| Eligibility rules | Declarative rule editor or config (not code) | Per §11: eligibility evaluation checks entity-model attributes. Rules should be data, not hardcoded logic. |
| Dependency visualization | DAG display showing required/recommended/conflicting dependencies | Per §10: dependency resolution is critical for activation safety. |

**External systems:**

| System | Classification | Pattern learned |
|--------|---------------|----------------|
| npm/PyPI package registry | **inspiration** | Package-as-pack metaphor: versioning, dependency resolution, publish lifecycle. |
| Terraform module registry | **inspiration** | Module catalog with dependency declarations, version constraints, compatibility matrices. |
| WordPress plugin directory | **inspiration** | Plugin activation/deactivation lifecycle, dependency checking, conflict detection. |
| VistA KIDS (Kernel Installation/Distribution System) | **integrate** | VistA's own package/patch distribution system. Packs that include VistA routines must eventually be installable via KIDS or overlay builds. |

### 4.4 System configuration and feature flags

**What it is:** Platform-wide settings, deployment profiles, and feature flags. The `control-plane.system.config` surface owns this (inventoried but no screen-contract instance yet).

**Architecture anchor:** Workspace map §11 (CP workspace definition), global system architecture §7.9 (governance plane).

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Build/borrow/avoid** | **Build** — minimal first pass | Feature flags and system config are platform concerns. Start with simple key-value config surface, evolve as complexity grows. |
| Scope | Platform-wide only (not tenant-scoped — that's tenant-admin) | Per CP vs TA separation: system config is platform-wide. |
| Audit | All config changes logged to immutable audit trail | Configuration changes are governed operations. |
| Complexity | Initially flat key-value with typed values, grouped by concern | Avoid premature config-management infrastructure. |

**External systems:**

| System | Classification | Pattern learned |
|--------|---------------|----------------|
| LaunchDarkly / Unleash | **inspiration** | Feature-flag lifecycle: create, target, evaluate, archive. Progressive rollout patterns. |
| Consul KV | **inspiration** | Hierarchical key-value config with watch/change-notification. |
| VistA Parameter (File 8989.5) | **later** | VistA's native parameter system. Relevant when platform config must propagate to VistA. |

### 4.5 Facility binding and VistA endpoint wiring

**What it is:** Connecting a platform facility reference to a VistA Institution (File 4) and RPC broker endpoint. This is part of the tenant provisioning flow but distinct enough to be its own concern.

**Architecture anchor:** Organization/facility model §15 (facility binding), §5.2 (facility entity). Workspace map §11 (CP provisioning concern).

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Build/borrow/avoid** | **Build** — platform-native with VistA probe | Platform must validate that the VistA endpoint is reachable and the institution exists in File 4. |
| Validation | TCP probe + `XWB IM HERE` or `ORWU NEWPERS` to confirm RPC broker is alive | Per runtime-truth: verify against live Docker, not assumptions. |
| Binding model | One facility → one VistA endpoint. One tenant may have multiple VistA endpoints across facilities. | Per org/facility model: facility is the VistA-binding unit. |
| Error handling | If VistA endpoint is unreachable at bind time, mark facility as `integration-pending` | Per architecture anti-goals: no silent mocks. |

**External systems:**

| System | Classification | Pattern learned |
|--------|---------------|----------------|
| VistA RPC Broker (XWB protocol) | **integrate** | Direct integration target. The probe validates endpoint reachability. |
| VistA Institution File (File 4) | **integrate** | Source of truth for facility identity. File 4 IEN is the binding key. |
| Kubernetes service discovery | **later** | When multiple VistA instances run as containers, service discovery replaces static endpoint config. |

### 4.6 User identity bridge (platform ↔ VistA)

**What it is:** Mapping platform user identities (OIDC/IdP) to VistA user identities (File 200 / DUZ). This is part of tenant setup but has deep security implications.

**Architecture anchor:** Organization/facility model §5.4 (practitioner entity). Permissions matrix §4.2 (platform vs VistA authorization layers).

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Build/borrow/avoid** | **Build** — bridge table in platform PG | Platform must maintain the mapping; VistA doesn't know about OIDC subjects. |
| Ownership | Platform owns the mapping. VistA owns the DUZ and security keys. | Per data-ownership-matrix: platform does not replicate VistA user data; it references it. |
| Provisioning flow | During user setup: admin provides VistA DUZ or triggers a lookup against File 200. | The bridge cannot be auto-populated without VistA access. |
| Security | DUZ mapping is sensitive — audit trail mandatory. No bulk exposure of DUZ values in API responses. | Per single-DUZ-problem documentation and security posture. |

**External systems:**

| System | Classification | Pattern learned |
|--------|---------------|----------------|
| Keycloak (OIDC IdP) | **integrate** | Authentication provider. OIDC `sub` claim is the platform-side identity key. |
| VistA New Person File (File 200) | **integrate** | VistA-side identity. DUZ is the binding key. |
| SCIM 2.0 (user provisioning) | **later** | Automated user provisioning protocol. Relevant when IdP-to-platform sync is needed at scale. |

### 4.7 Topology presets (deployment size)

**What it is:** Pre-configured provisioning templates for common deployment topologies. Architecture specs reference "single-clinic" through "enterprise" as topology endpoints.

**Architecture anchor:** Organization/facility model §3 (single-clinic as simplest topology), capability truth §9 (facility-type and tenant-type scope dimensions).

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Build/borrow/avoid** | **Build** — simple preset selector in provisioning flow | Presets reduce cognitive load for operators. Not a complex engine; just bundled defaults. |
| Preset categories | (1) Solo clinic, (2) Multi-clinic group, (3) Hospital, (4) Health system / enterprise | Maps to org/facility model complexity levels. |
| Preset behavior | Pre-fill entity hierarchy template + default pack suggestions. Operator can override. | Presets are convenience, not constraints. All fields remain editable. |
| Extensibility | New presets added as data (JSON/config), not code | Avoids code changes for new topology patterns. |

**External systems:**

| System | Classification | Pattern learned |
|--------|---------------|----------------|
| Terraform workspace templates | **inspiration** | Template-based provisioning with sensible defaults, overridable. |
| Salesforce org types | **inspiration** | Different org types (developer, enterprise, unlimited) with different default configurations. |
| VistA Kernel Installation | **not-now** | VistA doesn't have a concept of topology presets; it's configured per-instance. |

### 4.8 Pack composition at provisioning

**What it is:** During tenant creation, selecting which packs to activate based on legal-market selection and topology. This is the provisioning-time application of pack eligibility rules.

**Architecture anchor:** Pack/adapter governance §11 (eligibility), §14 (activation workflow). Country/payer readiness §15.1 (signup workflow), §15.2 (tenant provisioning).

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Build/borrow/avoid** | **Build** — rule-driven, not manual | Market-mandated packs (regulatory, national-standards) are auto-selected. Language/locale suggested by market. Payer/specialty are operator-selected. |
| Mandatory vs optional | Regulatory + national-standards: auto-activated (non-deactivatable). Language + locale: suggested, overridable. Payer + specialty + tenant-overlay: opt-in. | Per pack/adapter governance §9.2: market-mandated packs are non-deactivatable. |
| Dependency resolution | Validate dependency DAG before activation. Show unmet dependencies as blocking warnings. | Per §10: dependency resolution before activation. |
| UX model | Checklist grouped by pack family, with auto-selections highlighted and mandatory items locked | Operator sees what's automatic vs what they're choosing. |

**External systems:**

| System | Classification | Pattern learned |
|--------|---------------|----------------|
| npm install with peer dependencies | **inspiration** | Auto-install required + suggest optional. Show conflicts pre-install. |
| Salesforce managed package installer | **inspiration** | License-gated package activation with dependency checking. |

### 4.9 Adapter wiring and health

**What it is:** Configuring which adapters are active for each subsystem (clinical, scheduling, billing, imaging, messaging) and monitoring their health.

**Architecture anchor:** Pack/adapter governance §7 (adapter types), §8 (repo boundaries — adapters live in distro or platform depending on type).

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Build/borrow/avoid** | **Build** — config-driven adapter selection | Per archive repo pattern: `ADAPTER_<TYPE>` env vars select `vista` or `stub`. Elevate to platform config surface. |
| Health display | Per-adapter health status (connected, degraded, disconnected, integration-pending) | Operators need to know which VistA subsystems are reachable. |
| Stub visibility | If an adapter is `stub`, display explicit `integration-pending` with target subsystem | Per anti-goals: no silent mocks. |

**External systems:**

| System | Classification | Pattern learned |
|--------|---------------|----------------|
| Spring Boot Actuator health endpoints | **inspiration** | Per-subsystem health with aggregated status. |
| Kubernetes readiness/liveness probes | **inspiration** | Health as a first-class operational concern, not a debug feature. |
| VistA RPC Broker health | **integrate** | RPC connection pool health is adapter health. |

### 4.10 Capability readiness visualization

**What it is:** Displaying capability readiness states to platform operators so they can make informed provisioning and go-live decisions.

**Architecture anchor:** Capability truth §7 (readiness states), §10 (claim surfaces), §15 (CP integration).

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Build/borrow/avoid** | **Build** — registry-backed dashboard | CP operators are the primary claim surface audience per §10. They need honest readiness data. |
| Readiness display | Per-capability row with: state, scope dimensions, evidence class, last transition date | Per §7: readiness is never flat — always includes scope. |
| Filtering | By module, by market, by pack, by readiness state | Operators need to slice capability data multiple ways. |
| Claim-surface enforcement | Display gating rule violations as warnings (e.g., "cannot provision for market X: regulatory pack not verified") | Per §11: claim-gating rules are enforcement, not suggestions. |

**External systems:**

| System | Classification | Pattern learned |
|--------|---------------|----------------|
| GovReady/OSCAL compliance dashboards | **inspiration** | Compliance-status matrices with requirement-to-evidence mapping. |
| GitHub Actions workflow status boards | **inspiration** | Per-step status with pass/fail, log drill-down. |

### 4.11 Audit trail for provisioning actions

**What it is:** Immutable logging of all provisioning actions (tenant creation, market selection, pack activation, facility binding, user setup).

**Architecture anchor:** Global system architecture §7.9 (governance plane). Archive repo established hash-chained audit pattern.

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Build/borrow/avoid** | **Build** — reuse existing hash-chained audit pattern | Archive repo has proven SHA-256 hash-chained audit. Adapt for provisioning events. |
| Storage | Platform PG | Per persistence policy: no in-memory for persistent state. Audit is persistent. |
| PHI posture | No PHI in provisioning audit | CP surfaces are `configuration` classification — no patient data. |

**External systems:**

| System | Classification | Pattern learned |
|--------|---------------|----------------|
| AWS CloudTrail | **inspiration** | Every management-plane action logged; immutable; queryable. |
| Archive repo `immutable-audit.ts` | **integrate** | Existing pattern to reuse (hash-chain, sanitization, verification endpoint). |

### 4.12 Multi-VistA-instance management

**What it is:** For enterprise deployments, a tenant may have multiple VistA instances (e.g., one per hospital). The control plane must track which facility maps to which VistA endpoint.

**Architecture anchor:** Organization/facility model §6.1 (facility hierarchy), §15 (facility binding). Screen inventory §9.1 notes.

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Build/borrow/avoid** | **Later** — design now, build after single-instance bootstrap | Single-instance is the MVP. Multi-instance is enterprise-tier. Data model supports it from day 1 (facility → endpoint is 1:1, tenant → facility is 1:many). |
| Data model | Facility-to-endpoint mapping table in platform PG. Already designed in org/facility model. | No new schema needed for single-instance. Multi-instance adds rows, not tables. |

**External systems:**

| System | Classification | Pattern learned |
|--------|---------------|----------------|
| VistA HealthConnect (multi-site) | **later** | VA's multi-site VistA architecture. Relevant for inter-facility data sharing. |
| Cerner (Oracle Health) multi-domain | **later** | Multi-domain configuration in centralized EHR. |

### 4.13 Operator support and cross-tenant troubleshooting

**What it is:** Platform operators need to view tenant configuration, diagnose issues, and potentially switch into a tenant's admin context for support.

**Architecture anchor:** Workspace map §8 (operator gets "Cross-tenant" access to TA workspace), §11 (operator support concern).

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Build/borrow/avoid** | **Later** — bootstrap phase focuses on tenant creation, not support tooling | Support tooling is important but not first-run critical. |
| Key constraint | Cross-tenant access must be audited and time-limited | Per permissions-matrix: operator accessing TA context requires explicit logging. |

**External systems:**

| System | Classification | Pattern learned |
|--------|---------------|----------------|
| Stripe support "as-customer" mode | **later** | Impersonation with audit trail. Relevant for support phase. |
| Zendesk admin view | **not-now** | Customer-support platform, not healthcare admin. Different concerns. |

---

## 5. Consolidated pattern-decision summary

| # | Concern area | Build / borrow / avoid | Timing | Candidate screen(s) |
|---|-------------|----------------------|--------|---------------------|
| 4.1 | Tenant provisioning | Build | Bootstrap | `control-plane.tenants.list` (existing) + provisioning wizard (proposed) |
| 4.2 | Legal-market / launch-tier | Build | Bootstrap | `control-plane.markets.management` (existing) |
| 4.3 | Pack catalog / eligibility | Build | Bootstrap | `control-plane.packs.catalog` (existing) |
| 4.4 | System config / feature flags | Build | Bootstrap | `control-plane.system.config` (inventoried, no contract) |
| 4.5 | Facility binding | Build | Bootstrap | Embedded in provisioning wizard (proposed) |
| 4.6 | User identity bridge | Build | Bootstrap | Embedded in provisioning wizard or separate admin surface (proposed) |
| 4.7 | Topology presets | Build | Bootstrap | Embedded in provisioning wizard (proposed) |
| 4.8 | Pack composition at provisioning | Build | Bootstrap | Embedded in provisioning wizard (proposed) |
| 4.9 | Adapter wiring / health | Build | Bootstrap | Embedded in `system.config` or separate health surface (proposed) |
| 4.10 | Capability readiness display | Build | Near-term | Possible sub-surface of `packs.catalog` or `markets.management` (proposed) |
| 4.11 | Audit trail | Build (reuse) | Bootstrap | Embedded in CP shell or dedicated audit surface (proposed) |
| 4.12 | Multi-VistA-instance | Later | Post-bootstrap | Data model supports it; UI deferred |
| 4.13 | Operator support | Later | Post-bootstrap | Deferred |

> **"Proposed" surfaces are non-canonical candidates.** They appear in the journeys-and-stories and wireframes documents as design exploration. They are NOT inventoried, NOT screen-contracted, and NOT authorized for implementation. They require a future screen-inventory update and screen-contract authoring slice before any code is written.

---

## 6. Clean-room rules for external-system inspiration

When studying external system patterns for design inspiration:

1. **Do not copy UI layouts, component designs, color palettes, icons, or brand elements.** The output must be original VistA Evolved design.
2. **Do not copy data models or API shapes.** Study the pattern principle (e.g., "progressive disclosure in provisioning") and apply it with VistA Evolved's entity model and persistence policy.
3. **Do not reference proprietary documentation, code, or screenshots.** Study publicly visible behavior patterns only.
4. **Attribution is for pattern principles only.** "Inspired by the progressive-disclosure pattern seen in cloud provisioning flows" — not "inspired by AWS Console."
5. **VistA Evolved's architecture specs are the design constraint, not external systems.** If an external pattern contradicts the architecture (e.g., embedding PHI in config surfaces), reject the pattern.

---

## 7. Governing references

| Reference | Location |
|-----------|----------|
| Global system architecture | `docs/explanation/global-system-architecture-spec.md` |
| Organization/facility model | `docs/explanation/organization-facility-network-service-model.md` |
| Pack/adapter governance | `docs/explanation/pack-and-adapter-architecture-governance.md` |
| Capability truth / claim-gating | `docs/explanation/capability-truth-and-claim-gating-spec.md` |
| Country/payer readiness | `docs/explanation/country-and-payer-readiness-registry-spec.md` |
| Workspace map | `docs/explanation/information-architecture-workspace-map.md` |
| Screen inventory | `docs/reference/screen-inventory.md` |
| Permissions matrix | `docs/reference/permissions-matrix.md` |
| Pack visibility rules | `docs/reference/pack-visibility-rules.md` |
| Screen contract schema | `packages/contracts/schemas/screen-contract.schema.json` |
| Persistence policy | `docs/reference/persistence-policy.md` |
| Data ownership matrix | `docs/reference/data-ownership-matrix.md` |
| VistA runtime truth (distro repo) | `vista-evolved-vista-distro/docs/reference/runtime-truth.md` |
