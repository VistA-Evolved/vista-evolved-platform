# Global System Architecture Specification — VistA Evolved

> **Status:** Accepted architecture backbone.
> **Date:** 2026-03-16.
> **Scope:** Enterprise-wide architectural positions governing all three VistA Evolved repos.
> **Owner:** vista-evolved-platform (this repo). Cross-repo visibility only; does not override distro-canonical truth.

---

## 1. Document purpose and status

### What this document is

This is the **authoritative architecture backbone** for VistA Evolved. It defines the structural positions, planes, boundaries, and constraints that govern all future specifications, coding, and product decisions across the VistA Evolved ecosystem.

It is detailed enough to constrain later specs and later coding. Future dedicated specs (see Section 20) will elaborate specific domains but must not contradict this document.

### What this document is not

- Not a product requirements document.
- Not a UI specification.
- Not an implementation plan or sprint backlog.
- Not a marketing document or readiness claim.
- Not authorization to begin broad implementation (see Section 19).

### Current phase

VistA Evolved is in **architecture planning and terminal-first proof** phase.

- Architecture planning may proceed ahead of broad implementation.
- Browser-hosted VistA-backed terminal is the first major product surface.
- Terminal overall is not yet fully signed off under the UTF-8 lane (see Section 2).
- Broad control-plane, tenant-admin, and clinician GUI implementation remains unauthorized until explicitly instructed.

---

## 2. Truth hierarchy and current phase

### Governing principle

**Repo files are the source of truth, not model memory.**

AI agents, developers, and planning artifacts must align to repo files — `AGENTS.md`, `docs/reference/source-of-truth-index.md`, `docs/reference/decision-index.yaml`, and the governing policies indexed there. Training data, prior conversation context, and assumptions must yield to what the repo actually says.

### Contract-first, proof-first

- API shapes are defined in contracts (OpenAPI, AsyncAPI, JSON Schema) before implementation.
- Every claim of "done" requires proof: exact files changed, commands run, outputs, pass/fail.
- No next slice without proof and explicit human review.

See `docs/explanation/ai-coding-governance-and-sdlc.md` and `docs/explanation/governed-build-protocol.md`.

### Current verified truth

| Concern | Status | Authority |
|---------|--------|-----------|
| Three-repo architecture | Accepted | VE-PLAT-ADR-0001 |
| Contract-first architecture | Accepted | VE-PLAT-ADR-0002 |
| Control plane vs tenant admin | Accepted | VE-PLAT-ADR-0003 |
| UTF-8 as primary planned operator lane | Accepted | VE-DISTRO-ADR-0003 (distro-canonical) |
| M-mode as rollback/reference/safety lane | Accepted | VE-DISTRO-ADR-0003 (distro-canonical) |
| UTF-8 Docker build + 5/5 readiness | Verified | Distro `docs/reference/runtime-truth.md` |
| Browser terminal under UTF-8 | **Not yet verified** | Sign-on, terminal behavior, multilingual input pending |
| English baseline language | Accepted | VE-DISTRO-ADR-0003 |
| Korean and Spanish bounded product languages | Accepted | VE-DISTRO-ADR-0003 |
| Broader language expansion | **Not authorized** | Requires explicit decision |

Platform does not own lane truth. The distro repo is canonical for VistA runtime lane designation, build lanes, and multilingual readiness. Platform cross-references distro truth; it does not re-decide it.

---

## 3. Architecture goals

1. **Modernize VistA delivery** without replacing VistA as the clinical source of truth.
2. **Terminal-first product strategy:** the browser-hosted, VistA-backed roll-and-scroll terminal is the first shipping product surface. All architecture must support this path before expanding to richer GUI.
3. **One-truth-bearing runtime:** VistA globals remain the canonical store for clinical and operational data. The platform layer is governance, workflow, and configuration — never a shadow EHR.
4. **Contract-driven development:** APIs, events, config, and capabilities are defined in machine-readable contracts before implementation.
5. **Pack-based extensibility:** country, regulatory, payer, specialty, and tenant variation is handled through composable packs — not forks, not flag-explosion, not one-repo-per-country.
6. **Governed, proof-first delivery:** every slice is verified against live infrastructure before the next begins.
7. **Multi-market readiness by design:** architecture supports multiple countries, legal markets, and payer ecosystems from the start, without requiring all to be implemented simultaneously.
8. **Workspace separation:** unlike concerns (clinical, administrative, financial, analytics, IT) stay in distinct workspaces with clear boundaries.

---

## 4. Architecture anti-goals and forbidden drift

These patterns are **explicitly prohibited** across all VistA Evolved repos:

| Anti-goal | Why forbidden |
|-----------|---------------|
| Shadow clinical database | Platform must not replicate VistA-owned clinical data as a separate system of record. |
| Uncontrolled feature generation | AI and human developers must work one slice at a time with proof before the next. |
| Fork per country | Country variation is handled by packs and config, not repo or instance forks. |
| Speculative microservice sprawl | Services are added only when the bounded context, contract, and proof justify them. |
| Broad GUI buildout ahead of terminal | Terminal-first. Rich GUI is not authorized until terminal proof is complete and explicit authorization is given. |
| AI drift without review gates | AI-assisted features (clinical or coding) must have declared inputs, outputs, contracts, and human review. |
| Documentation sprawl | Only approved doc categories (tutorials, how-to, reference, explanation, ADRs, runbooks). No ad-hoc folders. |
| Silent mocks or stubs | If infrastructure is unavailable, the system must return explicit `integration-pending` state, never fake success. |
| Phantom features | Code that was written but never tested against live infrastructure is not done. |
| Marketing overclaims | No public claim of country-ready, specialty-complete, or production-ready without matching capability proof. |

---

## 5. Three-repo model and repo responsibilities

Per VE-PLAT-ADR-0001:

### VistA-Evolved (archive)

- **Role:** Frozen prototype/salvage/reference.
- **Status:** No new canonical product work. Reusable process assets and VistA RPC protocol knowledge may be extracted.
- **Boundary:** Read-only reference. Do not develop in this repo.

### vista-evolved-vista-distro

- **Role:** VistA runtime, upstream source management, overlays, multilingual support, Docker build/verify, terminal proof.
- **Owns:** VistA upstream fetch/pin/lock, overlay routines and install scripts, build lanes (UTF-8 primary, M-mode rollback), runtime truth, readiness verification, language packs (overlay/l10n), port assignments for VistA services.
- **Does not own:** Platform app code, control-plane logic, tenant management, capability manifests, API contracts.
- **Governing ADRs:** VE-DISTRO-ADR-0001 (upstream overlay), VE-DISTRO-ADR-0002 (local-source builds), VE-DISTRO-ADR-0003 (UTF-8 primary lane).

### vista-evolved-platform

- **Role:** Platform governance, control plane, admin console, contracts, config, domain, design system, capability manifests, architecture specs.
- **Owns:** OpenAPI/AsyncAPI/JSON Schema contracts, capability manifests, module/tenant config, platform database schema (for control-plane concerns only), architecture documentation, governance CI, design system.
- **Does not own:** VistA runtime, VistA source code, build lanes, VistA overlays, MUMPS routines, VistA port assignments, lane truth.
- **Governing ADRs:** VE-PLAT-ADR-0001 (three-repo), VE-PLAT-ADR-0002 (contract-first), VE-PLAT-ADR-0003 (control plane vs tenant admin).

### Cross-repo rules

- Cross-boundary access is via contracts (OpenAPI, AsyncAPI, schemas) only.
- No direct code imports between repos.
- Platform references distro runtime truth; it does not re-decide it.
- Distro does not contain platform app code.
- Both repos share the enterprise-namespaced ADR registry (`docs/reference/decision-index.yaml` in each, with cross-repo visibility entries).

---

## 6. One-truth-bearing runtime boundary

### VistA is clinical/operational source of truth

VistA globals own:

- Patient demographics, encounters, visits
- Problems, allergies, vitals, medications
- Orders, results, notes, documents
- Facility configuration (File 4, File 44, etc.)
- User/provider records (File 200)
- Scheduling, admission/discharge/transfer
- Billing/revenue cycle data where VistA IB/AR/PCE subsystems own it

### Platform is governance/config/workflow layer only

Platform databases may store:

- Tenant definitions and deployment profiles
- Capability pack/module configuration
- User identity and integration metadata (IdP bridge)
- Platform operational config (ports, feature flags, audit)
- Offline/mobile policy config

Platform databases **must not** store:

- Clinical data as a system of record
- Patient demographics replicated from VistA
- Orders, results, notes, allergies, vitals, medications
- Facility clinical configuration that VistA already owns

See `docs/reference/data-ownership-matrix.md` and `docs/reference/persistence-policy.md`.

### Prohibited storage patterns

| Pattern | Why prohibited |
|---------|---------------|
| SQLite for persistent platform state | Not production-grade for multi-tenant control plane |
| In-memory Maps for persistent state | Lost on restart; acceptable only for documented caches/ephemeral buffers |
| JSON files as mutable application store | Not transactional; acceptable only for config, manifests, fixtures, evidence |
| Clinical data in platform PostgreSQL | Creates shadow EHR; violates one-truth-bearing principle |

---

## 7. Core architecture planes

The VistA Evolved architecture is organized into nine planes. Each plane has a clear responsibility boundary and communicates with others through contracts.

### 7.1 Core truth plane (VistA)

The VistA instance is the clinical and operational source of truth. It runs MUMPS/YottaDB globals, exposes RPC broker endpoints, and owns the canonical patient record.

- **Runtime:** Distro-managed Docker container (UTF-8 lane primary, M-mode rollback).
- **Access:** RPC broker protocol (TCP, authenticated, XWB framing).
- **Boundary:** Nothing writes to VistA globals except through approved VistA write paths (RPCs, FileMan, approved M routines). No browser, no platform service, and no external system writes directly to globals.

### 7.2 Integration plane (adapters, gateways, queues)

External systems, devices, and services connect to VistA Evolved through the integration plane.

- **Pattern:** Adapter → gateway/queue → approved VistA write path.
- **No direct writes:** Browser clients, external APIs, and devices never write directly to VistA globals. All writes flow through authenticated RPC calls or approved M entry points.
- **Adapters:** Typed interfaces with VistA and stub implementations. VistA adapter is canonical; stub adapter returns explicit `integration-pending`.
- **External integrations:** HL7v2, FHIR, DICOM, X12/EDI, and market-specific interfaces (e.g., PhilHealth eClaims) each have dedicated adapter contracts.
- **Reliability:** Queues and buffers provide retry, ordering, and delivery guarantees where synchronous RPC is insufficient.

### 7.3 Pack plane (composable extension units)

Packs are the primary mechanism for variation — country, regulatory, payer, specialty, and tenant customization without forking.

- Packs are first-class architecture concepts with declared contracts, eligibility rules, and governance.
- Pack taxonomy is defined in Section 10.
- Pack lifecycle (authoring, validation, versioning, activation, deactivation) will be governed by a dedicated spec (see Section 20, item 2).

### 7.4 Control-plane plane

The operator-facing control plane manages system-wide concerns that are above any single tenant.

- **Scope:** Signup/onboarding, legal-market selection, tenant provisioning, pack eligibility resolution, launch-tier management, operator support/billing, system health and audit.
- **Lives in:** `apps/control-plane/` in the platform repo.
- **Auth:** Operator/super-admin only. Not tenant-scoped.
- **Status:** Architecture defined (VE-PLAT-ADR-0003). Broad implementation not yet authorized.

### 7.5 Tenant operational admin plane

Per-tenant administrative configuration managed by the tenant's own administrators.

- **Scope:** Facility structure (departments, wards, beds), user management, printer/device defaults, site parameters, module enablement within tenant's entitlement.
- **Lives in:** `apps/admin-console/` in the platform repo.
- **Auth:** Tenant-admin scoped. Cannot affect other tenants or system-wide config.
- **Status:** Architecture defined (VE-PLAT-ADR-0003). Broad implementation not yet authorized.

### 7.6 Workspace plane (separated operational surfaces)

Workspaces are distinct user-facing environments for unlike operational concerns. They share a common runtime and identity layer but do not collapse into a single mixed UI surface.

- Workspace taxonomy is defined in Section 12.
- Each workspace has its own screen contracts, navigation, and role requirements.
- Cross-workspace data access is via APIs and contracts, not shared UI state.

### 7.7 Content plane (specialty packs, templates, clinical content)

Clinical content — order sets, templates, questionnaires, calculators, documentation helpers, drug interaction databases — is managed as content rather than hard-coded application logic.

- Content scales through specialty content packs, not per-specialty application rewrites.
- Content strategy is defined in Section 14.
- Content packs are a subset of the pack taxonomy (Section 10).

### 7.8 AI assist plane

AI-assisted features — clinical decision support, documentation assist, translation, coding assistance — operate under strict governance.

- Declared inputs, outputs, review gates, storage boundaries, failure modes, and audit trails.
- No autonomous clinical writes without clinician review and signature.
- AI features are governed by contracts and manifests, same as any other capability.
- Safety spec is a future dedicated document (Section 20, item 8).

### 7.9 Governance plane (contracts, manifests, proof, CI gates)

The governance plane is the cross-cutting discipline layer that prevents architectural drift.

- **Contracts:** OpenAPI, AsyncAPI, JSON Schema — defined before implementation.
- **Manifests:** Capability manifests declare what modules/tenants can do.
- **Proof:** Every task produces evidence (files changed, commands run, outputs, pass/fail).
- **CI gates:** Governance scripts enforce doc roots, ADR index, SoT file presence, artifact placement, port registry consistency.
- **ADR registry:** Enterprise-namespaced, cross-repo visible, registered in `docs/reference/decision-index.yaml`.

---

## 8. Enterprise and business topology

This section defines the **conceptual entity model** for VistA Evolved's business topology. A dedicated data model specification will follow (Section 20, item 1).

### Entity hierarchy

```
Legal Entity
  └── Organization
        └── Facility
              ├── Location (building, floor, wing)
              │     ├── Department
              │     │     ├── Ward (inpatient)
              │     │     │     └── Bed
              │     │     └── Clinic (outpatient -- File 44 in VistA)
              │     └── Service Line
              └── Specialty (clinical specialty assignment)
```

### Deployment topologies

| Topology | Description |
|----------|-------------|
| **Single clinic** | One legal entity, one facility, one or few locations. Simplest case. |
| **Clinic network** | One legal entity (or group), multiple outpatient facilities under shared governance. |
| **Single hospital** | One legal entity, one facility with inpatient + outpatient, multiple departments/wards/clinics. |
| **Multi-hospital enterprise** | One legal entity owning multiple hospitals and clinics. Shared governance, shared formularies, enterprise reporting. |
| **Mixed network** | Hospitals and clinics under one enterprise umbrella. May span multiple legal entities in complex markets. |

### Practitioners and roles

- **Practitioner:** A clinical or administrative user with identity in VistA (File 200) and/or the platform IdP.
- **Practitioner role:** Maps to VistA person classes, keys, and menu assignments. Roles include (not exhaustive): physician, nurse, pharmacist, technician, clerk, administrator.
- **Role governance:** VistA owns clinical role truth (keys, person classes). Platform manages platform-level identity and access mapping. Neither overwrites the other.

### Payer relationships

- Facilities and patients have payer relationships (insurance, government program, self-pay).
- Payer data ownership depends on the VistA subsystem: VistA IB/AR/PCE own billing/encounter data; platform manages payer registry metadata and integration config.
- Payer model details are deferred to the country/payer readiness spec (Section 20, item 4).

!!! note "Scope boundary"
    This section defines the conceptual model only. Field-level data models, database schemas, and FHIR resource mappings are deferred to the organization-facility-network-service model spec (Section 20, item 1).

---

## 9. Country, legal-market, and payer variation model

### Country support is more than language

A country-specific deployment requires:

- **Language packs:** UI and terminal strings, date/number/currency formatting.
- **Locale packs:** Address formats, phone formats, national ID formats, cultural defaults.
- **Regulatory packs:** Consent requirements, data residency, retention rules, audit mandates, professional scope rules.
- **National-standards packs:** ICD coding edition, drug formulary source, lab reference ranges, HL7 country profile.
- **Payer packs:** Per-payer integration (claim format, eligibility check, remittance), which vary within a country.

Deploying "in country X" means activating and verifying all applicable packs, not just translating strings.

### No fork per country

Country variation is handled through **pack composition**, not repository forks, instance forks, or massive configuration flags. The same codebase and the same VistA distro serve all markets; packs configure the differences.

### Legal-market affects architecture, not just config

Legal-market choice — the decision of which country/region to support — affects:

| Concern | Impact |
|---------|--------|
| Pack eligibility | Which packs are required, optional, or inapplicable |
| Launch tier | Whether the market is at proof-of-concept, pilot, or production |
| Payer readiness | Which payers have tested integrations vs placeholders |
| Provisioning | What facility/user/role setup is needed for that market |
| Data residency | Where data must physically reside |
| Regulatory compliance | What audit, consent, and reporting rules apply |

Legal-market selection happens during control-plane onboarding and cannot be casually toggled later without re-evaluating all dependent packs.

### Payer readiness is separate from country readiness

A country may be "language-ready" (strings translated) but not "payer-ready" (no tested payer integrations). These dimensions are tracked independently:

- **Language readiness:** Governed by distro language packs and terminal proof.
- **Regulatory readiness:** Governed by regulatory and national-standards packs.
- **Payer readiness:** Governed per-payer within a country, not as a blanket country flag.
- **Provisioning readiness:** Governed by control-plane onboarding workflows and facility setup.

### Current language position

- **English:** Baseline. All paths must work in English first.
- **Korean, Spanish:** Bounded product languages (VE-DISTRO-ADR-0003). Active language pack work exists in distro. Not yet production-verified.
- **All other languages:** Not authorized without an explicit decision and corresponding pack/proof work.

---

## 10. Pack taxonomy and governance role

### Pack categories

| Pack type | Purpose | Typical owner | Example |
|-----------|---------|---------------|---------|
| **Language** | UI/terminal string translations, pluralization rules | Distro (overlay/l10n) + platform (UI strings) | `lang-ko`, `lang-es` |
| **Locale** | Date/number/currency/address/phone formatting, national ID patterns | Platform (config) | `locale-ph`, `locale-us` |
| **Regulatory** | Consent, retention, data residency, audit, professional scope | Platform (governance) | `reg-hipaa`, `reg-dpa-ph` |
| **National standards** | ICD edition, drug formulary source, lab ranges, HL7 country profile | Platform (config) + distro (if VistA-native) | `std-icd10-cm`, `std-mims-ph` |
| **Payer** | Per-payer claim format, eligibility, remittance, integration mode | Platform (config + connector) | `payer-philhealth`, `payer-bcbs` |
| **Specialty/Content** | Order sets, templates, questionnaires, calculators, doc helpers | Platform (content) | `specialty-cardiology`, `specialty-ob-gyn` |
| **Tenant overlay** | Per-tenant configuration, branding, defaults, feature flags | Platform (config) | `tenant-acme-clinic` |

### What belongs where

| Belongs in... | Examples |
|---------------|----------|
| **Distro (VistA-native)** | MUMPS routines, VistA FileMan dictionaries, RPC definitions, VistA-native language packs (overlay/l10n), VistA global structure changes |
| **Platform (config/contracts)** | Capability manifests, module definitions, pack metadata, API contracts, locale config, payer integration config, UI string catalogs |
| **Platform (content)** | Specialty templates, order set definitions, questionnaire schemas, calculator rules, documentation helpers |
| **Packs (composed at deploy/activation)** | Country-specific bundles of language + locale + regulatory + standards + payer selections, assembled from the above sources |

### Pack governance

- Packs are declared in capability manifests with version, eligibility rules, dependencies, and activation requirements.
- Pack activation is validated against the manifest before enabling.
- Pack changes follow the same contract-first, proof-first protocol as any other change.
- Dedicated pack governance spec: Section 20, item 2.

---

## 11. Adapter and integration plane

### Integration pattern

All device and external-system integration flows through typed adapters:

```
External System / Device
  → Adapter (typed interface)
    → Gateway / Queue (reliability, auth, routing)
      → Approved VistA Write Path (RPC, FileMan, approved M routine)
        → VistA Globals (source of truth)
```

### Explicitly rejected patterns

| Rejected pattern | Why |
|------------------|-----|
| Browser → VistA globals (direct write) | Bypasses all auth, validation, and audit. Violates one-truth-bearing boundary. |
| External API → VistA globals (direct write) | Same as above. All external writes must traverse an approved adapter. |
| Platform DB as clinical write target | Creates shadow EHR. Clinical writes must target VistA. |
| Untyped/ad-hoc integration | Must use declared adapter interface with VistA and stub implementations. |

### Adapter types

- **VistA adapter:** Connects to VistA RPC broker. Canonical implementation.
- **Stub adapter:** Returns `{ok: false, pending: true}` for all operations. Used when VistA adapter cannot load or infrastructure is unavailable. Never returns fake success.
- **External adapters:** HL7v2, FHIR, DICOM, X12/EDI, market-specific (e.g., PhilHealth eClaims). Each has a declared contract and connector interface.

### Adapter selection

Adapters are selected at runtime based on configuration (environment variables, tenant config, or capability manifests). The architecture supports swapping adapters per subsystem (clinical, scheduling, billing, imaging, messaging) without changing route code.

---

## 12. Workspace separation model

Distinct operational concerns live in separate workspaces. Each workspace has its own navigation structure, role requirements, and screen contracts.

| Workspace | Purpose | Primary users |
|-----------|---------|---------------|
| **Control plane** | System-wide operator functions: tenants, deployments, packs, system health | Operators, super-admins |
| **Tenant operational admin** | Per-tenant configuration: facilities, departments, users, printers, defaults | Tenant admins, IT |
| **Clinical** | Patient care: chart, orders, notes, meds, problems, allergies, vitals | Physicians, nurses, pharmacists |
| **Ancillary** | Lab, radiology, pharmacy operations, pathology | Lab techs, radiologists, pharmacists |
| **Revenue cycle** | Billing, claims, coding, payer management, remittance | Billers, coders, revenue cycle managers |
| **Analytics / BI** | Reporting, dashboards, executive metrics, population health | Analysts, quality officers, executives |
| **IT / Integration ops** | Integration status, adapter health, RPC console, audit trails | IT staff, integration engineers |

### Separation rules

- Unlike concerns **must not** collapse into one large UI surface. A billing screen must not share a tab bar with a clinical chart.
- Cross-workspace data access is via APIs and contracts, not shared in-memory state or shared UI components.
- Common infrastructure (auth, identity, audit, telemetry) is shared via platform packages, not by merging workspaces.
- Workspace boundaries will be enforced by screen contracts and navigation manifests (see Section 20, items 6 and 7).

---

## 13. Control plane vs tenant operational admin

Per VE-PLAT-ADR-0003:

### Control plane

| Concern | Description |
|---------|-------------|
| Tenant lifecycle | Create, activate, suspend, decommission tenants |
| Legal-market selection | Choose country/market during onboarding; resolves applicable packs |
| Provisioning | Deploy tenant infrastructure, activate packs, configure VistA instance binding |
| Pack eligibility | Resolve which packs are required, optional, or inapplicable for a tenant's market |
| Launch tiers | Track tenant readiness (proof-of-concept → pilot → production) |
| Operator support | System health, cross-tenant diagnostics, billing/subscription management |
| System config | Platform-wide settings, feature flags, infrastructure config |

### Tenant operational admin

| Concern | Description |
|---------|-------------|
| Facility structure | Organizations, facilities, locations, departments, wards, beds |
| User management | Tenant users, roles, access assignments (bridged to VistA File 200 and platform IdP) |
| Device/printer defaults | Printer assignments, device registration, AE Titles |
| Site parameters | Tenant-specific VistA site parameters, defaults, and preferences |
| Module enablement | Enable/disable modules within the tenant's pack entitlement |
| Operational config | Shift schedules, notification preferences, escalation rules |

### Boundary

Control-plane operations are **not tenant-scoped** — they operate across or above tenants. Tenant-admin operations are **always tenant-scoped** — they cannot affect other tenants or system-wide configuration. These share domain packages (`packages/domain/`) but have different auth models and UI surfaces.

---

## 14. Specialty and content strategy

### Scaling through common primitives

VistA Evolved does **not** redesign every medical specialty from scratch. Instead, specialties scale through reusable building blocks:

| Primitive | Examples |
|-----------|----------|
| **Templates** | Note templates, assessment templates, procedure templates |
| **Questionnaires** | Intake forms, screening instruments, patient-reported outcomes |
| **Order sets** | Specialty-specific order bundles (admission, pre-op, post-op, chemotherapy) |
| **Calculators** | Clinical scoring tools (APACHE, Glasgow, BMI, eGFR, CHA₂DS₂-VASc) |
| **Documentation helpers** | Structured data entry forms, coding assist, auto-population |
| **Reference data** | Drug databases, lab reference ranges, procedure catalogs, diagnosis sets |

### Pack-based specialty scaling

Each medical specialty (cardiology, OB/GYN, orthopedics, oncology, etc.) is a **content pack** that bundles the above primitives. Adding a new specialty means authoring a pack, not rewriting application code.

### What this means for implementation

- **Core platform** provides the rendering engine for templates, questionnaires, order sets, calculators, and documentation helpers.
- **Specialty packs** provide the clinical content consumed by those engines.
- **No specialty-specific application code** unless a specialty has genuinely unique workflow requirements that cannot be expressed as content.
- Specialty rollout is incremental: packs can be authored, validated, and activated independently.

---

## 15. Analytics and read-model boundary

### Architectural position

Analytics and executive/business intelligence are important strategic capabilities. They must be architecturally distinct from the transactional clinical truth plane.

### Constraints

| Constraint | Detail |
|------------|--------|
| Analytics does not replace VistA truth | Aggregated metrics are derived from VistA data; they do not become a second clinical SoT. |
| Read-model separation | Analytics operates on read-optimized projections (materialized views, ETL outputs, aggregation results), not directly on VistA transactional globals. |
| No random dashboard sprawl | Every analytics surface must be governed by screen contracts and role-based access. Ad-hoc dashboards do not ship without review. |
| PHI safety | Analytics stores must never contain patient-identifiable data unless explicitly governed by consent and audit. PHI is redacted or hashed at the analytics boundary. |
| Population health vs individual care | Population health and quality metrics are analytics-plane concerns. Individual patient care decisions belong in the clinical workspace. |

### Deferred

Implementation details — ETL pipelines, specific BI tools, data warehouse schema, dashboards — are deferred to the analytics architecture spec (Section 20, item 5). This section establishes the boundary only.

---

## 16. AI assist plane and safety boundary

### Governed AI assistance

AI-assisted features in VistA Evolved operate under strict governance:

| Rule | Detail |
|------|--------|
| **Declared I/O** | Every AI feature must declare its inputs, outputs, and side effects in a contract or manifest. |
| **Review gate** | No autonomous clinical action. AI may suggest, rank, draft, or flag — but a clinician must review and approve before write-back to VistA. |
| **Storage boundary** | AI intermediate results (embeddings, model outputs, conversation history) are stored separately from clinical truth. They do not contaminate VistA globals. |
| **Failure mode** | AI features must degrade gracefully. If the AI service is unavailable, the clinical workflow continues without AI assist. AI is never load-bearing for basic patient care. |
| **Audit trail** | All AI decisions, suggestions, and clinician overrides are logged in the audit system with clear provenance. |
| **No PHI in training** | Patient data must never be used for model training without explicit consent and governance review. |

### Examples of governed AI features (future)

- Clinical documentation assist (draft notes for clinician review and signature)
- Order suggestion (rank order sets for clinician selection)
- Translation assist (augment language packs — but all translations must be reviewed before activation)
- Intake triage (suggest next question — but from an approved question registry, not invented by the model)

### Dedicated spec

A dedicated AI assist safety specification will define the full safety model (Section 20, item 8). This section establishes the architectural position and boundary only.

---

## 17. AI coding governance and anti-drift boundary

### Problem

AI coding tools generate code faster than humans verify it. Without governance, this produces surface area faster than truth. The following rules prevent architectural drift during AI-assisted development.

### Rules

1. **Repo files are the source of truth, not model memory.** AI agents must read `AGENTS.md`, governing policies, and relevant source files before acting.
2. **Contract-first.** API changes start with spec updates in `packages/contracts/`. Implementation follows the spec.
3. **One slice at a time.** No batching multiple features. Complete one slice, verify, report, stop, and wait.
4. **Proof required.** Every task response includes: objective, files changed, commands run, outputs, pass/fail, verified truth, unverified areas, risks, next step.
5. **No silent fallbacks.** If infrastructure is unavailable, return explicit `integration-pending`. Never silently substitute mocks.
6. **No scope creep.** Do not refactor unrelated code, add unrequested features, or create speculative APIs.
7. **Human review before next slice.** AI stops and reports after each slice. No autonomous multi-slice execution.

### Enforcement mechanisms

| Mechanism | Location |
|-----------|----------|
| Agent governance file | `/AGENTS.md` (root law for all tools) |
| AI SDLC doc | `docs/explanation/ai-coding-governance-and-sdlc.md` |
| CI governance gates | `scripts/governance/` + `.github/workflows/governance-gates.yml` |
| ADR registry | `docs/reference/decision-index.yaml` |
| Contract validation | `packages/contracts/` with schema validation at load time |
| Capability manifests | `packages/contracts/capability-manifests/` |
| Task report format | Mandatory in AGENTS.md Section 5 |

---

## 18. Capability truth, claim gating, and readiness

### Architectural position

The system must never publicly claim capabilities it has not verified. This is the **claim-gating** principle.

### How it works

```
Capability Manifest (declared)
  → Implementation (built)
    → Proof (tested against live infrastructure)
      → Readiness State (verified | partial | pending | missing)
        → Claim Gate (what the system may publicly offer)
```

### What is gated

| Surface | Gated by |
|---------|----------|
| Public website feature pages | Verified capability state |
| Country/market pages | Country readiness registry (language + regulatory + payer readiness) |
| Signup / onboarding choices | Pack eligibility resolved against tenant's legal-market |
| Module activation | Capability manifest + adapter availability + infrastructure health |
| Provisioning options | Launch tier + verified pack status |

### Current state

Capability manifest schema exists in `packages/contracts/capability-manifests/`. The full claim-gating spec — linking manifests to public surfaces, signup flows, and provisioning — is deferred to Section 20, item 3.

### Key constraint

A capability claimed on any public surface (website, documentation, onboarding flow) must trace to a verified capability manifest entry with proof artifacts. Unverified capabilities must not appear as available options.

---

## 19. Explicit out-of-scope — not authorized by this document

This architecture specification does **not** authorize:

| Item | Status |
|------|--------|
| Broad control-plane UI implementation | Architecture planned (VE-PLAT-ADR-0003). Implementation waits for explicit authorization. |
| Broad tenant-admin UI implementation | Architecture planned (VE-PLAT-ADR-0003). Implementation waits for explicit authorization. |
| Clinician GUI buildout | Terminal-first. Rich GUI waits for terminal sign-off and explicit authorization. |
| Country-complete readiness claims | No country is production-verified. Korean and Spanish are bounded product languages with pending terminal proof under UTF-8. |
| Package-complete localization claims | Language packs exist in distro overlay; completeness is not claimed. |
| New language expansion | Only English (baseline), Korean, and Spanish (bounded) are authorized. Others require an explicit decision. |
| Shadow clinical databases | Prohibited by one-truth-bearing principle (Section 6). |
| Speculative microservice sprawl | Services added only with bounded context, contract, and proof. |
| Production deployment | No deployment to real patients or production environments is authorized by this architecture spec. |
| Automated AI clinical decision-making | AI may assist; clinician review is mandatory before any write-back. |

---

## 20. Next artifact sequence after this spec

The following documents are the planned next artifacts, in priority order. Each will be a dedicated spec within the approved doc model. They must not contradict this architecture backbone.

| # | Artifact | Purpose | Planned location |
|---|----------|---------|-----------------|
| 1 | Organization-facility-network-service model | Entity model: legal entity, org, facility, location, department, ward, bed, service line, specialty, practitioner, role | `docs/explanation/` |
| 2 | Pack and adapter architecture governance | Pack lifecycle, adapter contracts, versioning, eligibility, activation, validation | `docs/explanation/` |
| 3 | Capability truth and claim gating spec | Link manifests to public surfaces, signup, provisioning, readiness gates | `docs/explanation/` |
| 4 | Country and payer readiness registry spec | Per-country readiness dimensions, payer integration status, launch tiers | `docs/explanation/` or `docs/reference/` |
| 5 | Specialty content and analytics architecture | Content pack rendering engines, analytics ETL boundary, BI surface governance | `docs/explanation/` |
| 6 | Information architecture workspace map | Navigation structures, workspace boundaries, role-to-workspace mapping | `docs/explanation/` |
| 7 | Screen contract schema | Machine-readable screen/surface contracts for workspace composition | `packages/contracts/schemas/` |
| 8 | AI assist safety spec | Full safety model: inputs, outputs, review gates, storage, failure, audit, consent | `docs/explanation/` |

!!! warning "Sequencing discipline"
    These artifacts are authored one at a time, in order, with proof and review between each. Do not batch-generate the entire sequence. Each artifact must be verified as consistent with this backbone before the next begins.
