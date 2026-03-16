# Pack and Adapter Architecture Governance — VistA Evolved

> **Status:** Accepted architecture specification.
> **Date:** 2026-03-17.
> **Scope:** Pack lifecycle, adapter contracts, dependency resolution, eligibility, composition, and governance gates.
> **Owner:** vista-evolved-platform (this repo).
> **Parent specifications:**
>
> - `docs/explanation/global-system-architecture-spec.md` — architecture backbone (Sections 7.3, 9, 10, 11, 18)
> - `docs/explanation/organization-facility-network-service-model.md` — entity model (Sections 16, 20)

---

## 1. Document purpose and status

### What this document is

This is the **authoritative specification for pack and adapter architecture governance** in VistA Evolved. It defines what packs are, how they are categorized, how they attach to organizational entities, how they are versioned, how they progress through lifecycle states, how adapters mediate between VistA and external systems, and what governance gates control all of this.

It fulfills the handoff from:

- Global system architecture spec Section 20, item 2 ("Pack and adapter architecture governance").
- Organization, facility, network, and service model Section 20 ("What the next spec must address").

### What this document is not

- Not a JSON Schema or relational schema for pack manifests (deferred to contract work).
- Not an API specification for pack management endpoints (deferred to OpenAPI contract work).
- Not a UI design for pack administration screens (UI is not authorized per global architecture Section 19).
- Not a country-readiness claim for any specific market.
- Not authorization to begin broad pack implementation.

### Current phase

VistA Evolved is in **architecture planning and terminal-first proof** phase. This document defines the architecture for packs and adapters. Implementation of pack management infrastructure follows the governed build protocol: one slice at a time, with proof, after explicit authorization.

---

## 2. Relationship to parent specifications

### What the global system architecture spec established

| Section | Established position | This spec's role |
|---------|---------------------|------------------|
| 7.3 | Pack plane is the primary mechanism for variation | Defines the full taxonomy, lifecycle, and governance of that plane |
| 9 | Country/legal-market/payer variation through packs, not forks | Defines eligibility, dependency, and composition rules that implement this position |
| 10 | Pack taxonomy table (7 categories) with ownership boundaries | Expands each category with detailed attributes, dependency rules, and lifecycle |
| 11 | Adapter integration pattern and adapter types | Defines adapter contracts, selection logic, and swap mechanics |
| 18 | Capability truth and claim gating | Defines how pack readiness integrates with the capability truth pipeline |

### What the organization/facility/network/service model established

| Section | Established position | This spec's role |
|---------|---------------------|------------------|
| 16.1 | Pack attachment points (which entity types packs attach to) | Formalizes attachment rules, scoping rules, and inheritance |
| 16.2 | Pack eligibility depends on entity model (legal market, facility type, specialty) | Defines eligibility evaluation logic |
| 16.3 | Defers pack lifecycle and adapter contracts to this document | This document fulfills that deferral |
| 20 | Seven items this spec must address | All seven are addressed (see Section 22 cross-reference) |

### What the distro repo owns

The `vista-evolved-vista-distro` repo owns:

- **Language pack implementation**: `overlay/l10n/PACK-SPEC.md` defines the distro-side format for language packs (manifest, formatting routines, dialog routines, menu translations). This is distro-canonical.
- **Overlay routines**: Custom MUMPS routines (`overlay/routines/`) that implement VistA-side pack loading (e.g., `ZVELPACK.m`).
- **Build and verification**: Scripts that build and verify VistA with pack overlays applied.

This document does **not** override distro-canonical pack format or build decisions. It governs the platform-side lifecycle, eligibility, and governance of packs. Where distro packs have platform-visible metadata (language, coverage level, readiness), that metadata flows through capability manifests governed by this spec.

---

## 3. Architecture goals for packs and adapters

1. **Variation without forking.** Country, regulatory, payer, specialty, and tenant differences are handled by composing packs, not by forking repos, instances, or codebases.
2. **Explicit eligibility.** Every pack declares what organizational context it requires (legal market, facility type, specialty, etc.). Activation is evaluated against the entity model, not by assumption.
3. **Composability.** Multiple packs from different categories can be active simultaneously for a tenant/facility. The composition rules prevent conflict.
4. **Governed lifecycle.** Packs progress through defined states (draft → validated → tested → published → activated → deactivated → retired). No pack reaches production without passing governance gates.
5. **Adapter contract clarity.** Every adapter type has a defined contract. Adapters are swappable without changing the consuming code.
6. **Distro-platform boundary respect.** Language packs and VistA overlay routines are distro-owned. Capability manifests and lifecycle governance are platform-owned. Neither side overrides the other.
7. **Claim-gating integration.** Pack readiness feeds into the capability truth pipeline (global architecture Section 18). No capability is claimable until its supporting packs reach verified status.

---

## 4. Architecture anti-goals and forbidden patterns

| Anti-goal | Why forbidden |
|-----------|---------------|
| Pack as code deployment vehicle | Packs configure and extend; they do not deploy arbitrary application code. VistA routines go through the distro overlay process, not through platform pack activation. |
| Implicit pack activation | No pack activates silently based on ambient context. All activation requires explicit configuration by an authorized operator through a governed path. |
| Country readiness by pack count | Having packs for a country does not mean the country is "ready." Readiness requires proof against the capability truth pipeline. |
| Adapter that bypasses VistA write path | Per global architecture Section 11, all clinical writes must go `External → Adapter → Gateway/Queue → Approved VistA Write Path → Globals`. No adapter may write directly to VistA globals or bypass the approved write path. |
| Pack that creates shadow data | A pack may add configuration, translations, regulatory rules, and payer mappings. It must not create a parallel clinical data store. |
| One pack to rule all | No single "country pack" that bundles everything. Country variation is composed from multiple focused packs (language + locale + regulatory + payer + ...). |
| Speculative pack infrastructure | Do not build pack management UI, pack marketplace, or pack distribution pipeline ahead of terminal-first proof and explicit authorization. |

---

## 5. Canonical definitions

These terms have precise meanings in VistA Evolved. All specs, code, and documentation must use them consistently.

### 5.1 Pack

A **pack** is a composable unit of configuration, content, or integration logic that extends VistA Evolved for a specific variation dimension (language, locale, regulation, payer, specialty, or tenant).

A pack is **not** a deployable application, a service, a database, a fork, or a code module. It is a governed configuration artifact with declared dependencies, eligibility rules, and lifecycle state.

### 5.2 Pack manifest

A **pack manifest** is the machine-readable declaration of a pack's identity, version, category, dependencies, eligibility criteria, and contents. Pack manifests are JSON documents validated against the pack manifest JSON Schema (to be defined in `packages/contracts/schemas/`).

### 5.3 Pack instance

A **pack instance** is a specific activation of a pack for a specific organizational scope (tenant, facility, department). The same pack definition may have multiple instances across different scopes.

### 5.4 Adapter

An **adapter** is a typed integration component that mediates between VistA Evolved and an external system, VistA subsystem, or stub behavior. Adapters implement a defined contract interface and are swappable without changing consuming code.

### 5.5 Capability

A **capability** is a discrete, verifiable unit of system functionality. Capabilities are declared in capability manifests, implemented through code and packs, and progress through the readiness pipeline (declared → built → tested → verified → claimable). See global architecture Section 18.

### 5.6 Adapter contract

An **adapter contract** is the typed interface that all adapters of a given type must implement. It defines input shapes, output shapes, error semantics, and behavioral guarantees. Adapter contracts are defined in `packages/contracts/` and may be expressed as TypeScript interfaces, OpenAPI operation sets, or JSON Schema.

---

## 6. Pack taxonomy

This section expands the pack taxonomy table from global architecture Section 10 with detailed attributes for each category.

### 6.1 Taxonomy overview

| Category | Purpose | Scope | Owner | Cardinality per scope |
|----------|---------|-------|-------|----------------------|
| Language | UI strings, VistA dialog translations, terminal prompts | Tenant or VistA instance | Distro (implementation), Platform (lifecycle) | 1 primary + 0–N secondary per scope |
| Locale | Date/time/currency/address/number formatting, measurement units | Tenant | Platform | Exactly 1 per tenant |
| Regulatory | Compliance rules, consent workflows, documentation requirements | Tenant (legal-market-scoped) | Platform | 1–N per tenant (one per applicable regulation) |
| National standards | Country-specific code sets, form templates, identifier formats | Tenant (legal-market-scoped) | Platform | 0–N per tenant |
| Payer | Payer-specific claim formats, eligibility rules, connector config | Tenant or facility | Platform | 0–N per scope (one per active payer) |
| Specialty / content | Clinical content, order sets, documentation templates, decision support | Department or service line | Platform | 0–N per scope |
| Tenant overlay | Tenant-specific branding, defaults, feature flags, custom config | Tenant | Platform | 0–1 per tenant |

### 6.2 Language pack

| Attribute | Detail |
|-----------|--------|
| What it contains | Dialog translations (DIALOG file .84), formatting routines (LANGUAGE file .85), terminal prompt overrides, menu translations |
| Distro-side spec | `overlay/l10n/PACK-SPEC.md` in vista-evolved-vista-distro |
| Maturity model | 6 levels: L0 (UTF-8 safe) → L1 (formatting applied) → L2 (core prompts translated) → L3 (menus translated) → L4 (clinical content translated) → L5 (package localized) |
| Current implementations | Korean (L2), Spanish (L2) — per VE-DISTRO-ADR-0003 |
| Platform visibility | Language selection, coverage level, readiness state (via capability manifest) |
| Activation | Site default via `VISTA_SITE_LANG` env var; per-user via `DUZ("LANG")` dispatch; runtime via `BOOT^ZVELPACK` |
| Dependency | Requires UTF-8 build lane (VE-DISTRO-ADR-0003) |

### 6.3 Locale pack

| Attribute | Detail |
|-----------|--------|
| What it contains | Date format pattern, time format pattern (12h/24h), currency symbol and position, decimal/thousands separators, address format template, measurement unit system (metric/imperial), phone number format |
| Scope | Tenant-level; affects all facilities within the tenant unless overridden |
| Dependency | May depend on a language pack for localized format labels |
| Examples | `locale-us` (MM/DD/YYYY, 12h, USD, imperial), `locale-ph` (MM/DD/YYYY, 12h, PHP, metric), `locale-kr` (YYYY-MM-DD, 24h, KRW, metric) |

### 6.4 Regulatory pack

| Attribute | Detail |
|-----------|--------|
| What it contains | Compliance rule definitions, consent form requirements, mandatory documentation checklists, retention policies, reporting obligations, audit trail requirements specific to a regulatory framework |
| Scope | Tenant-level, scoped by legal market |
| Examples | `regulatory-hipaa` (US HIPAA), `regulatory-philhealth-doh` (PH DOH/PhilHealth rules), `regulatory-kdpa` (Korean data protection) |
| Dependency | May require national-standards pack for the same market |
| Activation constraint | A facility operating in a regulated market must have the applicable regulatory pack active. The system must not allow a facility in a regulated market to operate without its regulatory pack. |

### 6.5 National standards pack

| Attribute | Detail |
|-----------|--------|
| What it contains | Country-specific code set mappings (ICD variants, local drug codes, procedure codes), national identifier formats (SSN, PhilHealth PIN, Korean resident registration number format rules), standard form templates mandated by national health authorities |
| Scope | Tenant-level, scoped by legal market |
| Examples | `standards-us` (ICD-10-CM, CPT/HCPCS, NPI format), `standards-ph` (PhilHealth code sets, CF1-CF4 form structures), `standards-kr` (Korean HIRA code sets, Korean national ID formats) |
| Dependency | Requires regulatory pack for the same market (regulatory rules determine which standards apply) |

### 6.6 Payer pack

| Attribute | Detail |
|-----------|--------|
| What it contains | Payer-specific claim submission rules, eligibility check configuration, remittance parsing rules, connector configuration (endpoint, auth, format), payer-specific code requirements or modifiers |
| Scope | Tenant-level or facility-level (payer contracts may be facility-specific) |
| Examples | `payer-bcbs` (Blue Cross Blue Shield), `payer-philhealth` (PhilHealth government payer), `payer-medicare-us` (US Medicare) |
| Dependency | Requires national-standards pack for the corresponding market |
| Activation note | Payer readiness is independent of country readiness. A country may have language and regulatory packs active before any payer pack is ready. |

### 6.7 Specialty / content pack

| Attribute | Detail |
|-----------|--------|
| What it contains | Clinical content relevant to a specific specialty: order set templates, documentation templates, clinical decision support rules, specialty-specific workflow configuration, reference data |
| Scope | Department-level or service-line-level |
| Examples | `specialty-cardiology`, `specialty-orthopedics`, `specialty-primary-care`, `specialty-emergency` |
| Dependency | Depends on base clinical capability being present; may depend on regulatory pack (some specialties have specific regulatory requirements) |
| Content boundary | Content packs configure VistA-mediated workflow; they do not create parallel clinical databases. Clinical data remains in VistA globals. |

### 6.8 Tenant overlay pack

| Attribute | Detail |
|-----------|--------|
| What it contains | Tenant-specific branding (logo, color scheme, terminology preferences), default configuration values, tenant-specific feature flags, custom field labels, organization-specific workflow tweaks |
| Scope | Tenant-level |
| Cardinality | At most one per tenant |
| Dependency | No mandatory dependencies; overlays are applied on top of all other active packs |
| Precedence | Tenant overlay has the highest precedence in configuration resolution (see Section 12) |

---

## 7. Adapter taxonomy

This section expands the adapter types from global architecture Section 11.

### 7.1 Adapter type overview

| Adapter type | Purpose | Data flow | Contract location |
|-------------|---------|-----------|-------------------|
| VistA adapter | Mediates between platform components and VistA subsystems via approved RPC/HL7 paths | Platform → Adapter → VistA RPC/HL7 → VistA Globals | `packages/contracts/` |
| Stub adapter | Returns explicit `integration-pending` state when the real adapter's infrastructure is unavailable | Platform → Adapter → `{ok: false, pending: true}` | Same contract as VistA or external adapter |
| External system adapter | Mediates between VistA Evolved and external systems (clearinghouses, government portals, labs, pharmacies, imaging systems) | External ↔ Adapter ↔ Gateway/Queue ↔ VistA | `packages/contracts/` |
| Standards adapter | Translates between VistA-native formats and interoperability standards (HL7 FHIR, HL7v2, X12, CDA) | VistA data → Adapter → Standard format (and reverse) | `packages/contracts/` |

### 7.2 VistA adapter

| Attribute | Detail |
|-----------|--------|
| Purpose | Provides typed access to VistA subsystems (clinical, scheduling, billing, pharmacy, etc.) |
| Communication | VistA RPC Broker protocol or HL7/HLO pathway |
| Contract shape | TypeScript interface defining available operations, input types, output types, and error cases |
| Selection | Default adapter type when VistA infrastructure is available |
| Examples | ClinicalEngineAdapter (problems, allergies, vitals, meds), SchedulingAdapter (SDES RPCs), BillingAdapter (IB/AR RPCs) |

### 7.3 Stub adapter

| Attribute | Detail |
|-----------|--------|
| Purpose | Placeholder when VistA adapter infrastructure is unavailable or when pack-required RPCs are missing |
| Behavior | Returns `{ok: false, pending: true, reason: "integration-pending"}` for all operations |
| Contract shape | Implements the same interface as the VistA adapter it replaces |
| Selection | Automatic fallback when VistA adapter fails to load or when required RPC is missing |
| Rule | Must never return fake success. Must never silently substitute mock data. |

### 7.4 External system adapter

| Attribute | Detail |
|-----------|--------|
| Purpose | Integrates with systems outside VistA (payer portals, clearinghouses, government APIs, lab systems, pharmacy networks) |
| Communication | HTTP/REST, SOAP, SFTP, HL7v2 MLLP, or other protocol as required by the external system |
| Contract shape | Defined per integration; must include error handling, retry policy, and timeout configuration |
| Pack relationship | Payer packs configure external system adapters (endpoint, auth, format). The adapter is the mechanism; the payer pack provides the configuration. |
| Examples | ClearinghouseConnector (US EDI), PhilHealthConnector (PH government portal), LabInterfaceAdapter |

### 7.5 Standards adapter

| Attribute | Detail |
|-----------|--------|
| Purpose | Translates between VistA-native data formats and healthcare interoperability standards |
| Standards covered | HL7 FHIR (R4+), HL7v2, X12 5010 (837/835/270-278), CDA, potentially HL7v3/CDS Hooks in future |
| Direction | Bidirectional where applicable (VistA → standard for export/sharing, standard → VistA for inbound data) |
| Pack relationship | National standards packs may configure which standard versions and profiles apply. Regulatory packs may mandate certain standards compliance. |

### 7.6 Adapter selection rules

1. **Default to VistA adapter** when VistA infrastructure is available and the required RPCs exist.
2. **Fall back to stub adapter** if VistA adapter fails to load or required RPC is confirmed missing. Stub returns `integration-pending`.
3. **External and standards adapters** are selected based on pack configuration (payer pack selects its connector, regulatory pack mandates its standards adapter).
4. **Adapter selection is deterministic.** Given the same pack configuration and infrastructure state, the same adapter must be selected every time.
5. **Adapter selection is logged.** Every adapter selection decision is recorded for audit and debugging.

---

## 8. Repo ownership boundaries for packs and adapters

### 8.1 What lives where

| Artifact | Owner repo | Owner path | Notes |
|----------|-----------|------------|-------|
| Pack manifest JSON Schema | Platform | `packages/contracts/schemas/` | Defines the shape of all pack manifests |
| Capability manifest definitions | Platform | `packages/contracts/capability-manifests/` | Defines capabilities that packs contribute to |
| Pack lifecycle state machine | Platform | This document + future implementation code | Governs transitions and gates |
| Pack eligibility rules | Platform | Config + future implementation | Evaluates against entity model |
| Adapter contract interfaces | Platform | `packages/contracts/` | TypeScript interfaces or OpenAPI specs |
| Adapter implementations (platform-side) | Platform | `apps/control-plane/` or `packages/domain/` | Platform adapters for external systems |
| Language pack content | Distro | `overlay/l10n/<iso2>/` | Manifest, formatting, dialogs, menus |
| Language pack format spec | Distro | `overlay/l10n/PACK-SPEC.md` | Distro-canonical format definition |
| Language pack loader (MUMPS) | Distro | `overlay/routines/ZVELPACK.m` | VistA-side pack installation and verification |
| VistA overlay routines | Distro | `overlay/routines/` | Custom MUMPS routines |
| VistA build/verify scripts | Distro | `scripts/` | Build lanes and health checks |

### 8.2 Cross-repo contract

The platform-distro boundary for packs is governed by these rules:

1. **Distro publishes pack metadata.** Each distro-side pack (language, overlay) has a `manifest.json` that follows a schema defined by the platform.
2. **Platform reads pack metadata.** The platform reads distro-published manifests to determine available packs, their coverage levels, and readiness states.
3. **Platform does not modify distro packs.** The platform may activate, deactivate, or configure the use of a distro pack, but it does not edit the pack's content.
4. **Distro does not read platform config.** The distro applies packs based on VistA-level configuration (env vars, globals). Platform-level tenant/facility config is resolved by the platform and communicated to VistA through approved paths.
5. **Manifest schema is the contract.** The platform defines the manifest JSON Schema. The distro produces manifests conforming to it. Schema changes require coordination (ADR if breaking).

---

## 9. Pack attachment points

Packs attach to organizational entities defined in the organization/facility/network/service model. This section formalizes the attachment rules.

### 9.1 Attachment matrix

| Pack category | Primary attachment | Can be overridden at | Inheritance direction |
|---------------|--------------------|---------------------|----------------------|
| Language | Tenant | Facility, User | Top-down (tenant default, facility/user override) |
| Locale | Tenant | Facility | Top-down |
| Regulatory | Tenant (legal-market) | — (not overridable; market-mandated) | — |
| National standards | Tenant (legal-market) | — (not overridable; market-mandated) | — |
| Payer | Tenant or Facility | Facility (within tenant contract) | Tenant defines available; facility activates specific payers |
| Specialty / content | Department or Service line | — | Inherits base clinical capability from facility |
| Tenant overlay | Tenant | — | Applied globally within tenant, highest precedence |

### 9.2 Attachment rules

1. **Regulatory and national-standards packs are market-mandated and not overridable.** If a tenant operates in a legal market that requires a regulatory pack, that pack must be active. Individual facilities cannot opt out.
2. **Language packs support hierarchical override.** Tenant sets the default language. A facility or individual user may override to a different supported language.
3. **Payer packs may be tenant-wide or facility-specific.** An enterprise-negotiated payer contract may be a tenant-wide payer pack. A facility-specific payer contract is a facility-scoped payer pack.
4. **Specialty packs attach below the facility level.** They configure care delivery at the department or service-line level, not at the enterprise level.
5. **Tenant overlay is always tenant-scoped.** It cannot be applied at a sub-tenant scope.

### 9.3 Scope inheritance

When a pack is activated at a higher scope, it applies to all contained entities unless overridden:

```
Tenant (language: Korean, locale: locale-kr)
  └── Facility A (inherits Korean, locale-kr)
  └── Facility B (language override: English → uses English for this facility)
        └── Department Cardiology (specialty: specialty-cardiology)
```

Inheritance follows the containment hierarchy defined in the entity model Section 6.1. Non-hierarchical network relationships (affiliations, referrals) do **not** propagate pack activation.

---

## 10. Pack dependency and precedence

### 10.1 Dependency model

Packs declare dependencies in their manifests. A dependency is a prerequisite that must be active before the dependent pack can activate.

| Dependency type | Meaning | Example |
|-----------------|---------|---------|
| Required | Must be active at the same or higher scope | `standards-ph` requires `regulatory-philhealth-doh` |
| Recommended | Should be active for full functionality; not blocking | `specialty-cardiology` recommends `standards-us` for US AHA guideline codes |
| Conflicts | Cannot be active simultaneously | `locale-us` conflicts with `locale-kr` at the same scope (exactly one locale per scope) |

### 10.2 Dependency resolution

1. **Resolve dependencies before activation.** When a pack is requested for activation, the system checks all declared `required` dependencies. If any required dependency is not active at the appropriate scope, activation is blocked with a clear error listing the missing dependencies.
2. **Warn on missing recommended.** If recommended dependencies are missing, activation proceeds but a warning is surfaced to the operator.
3. **Block on conflicts.** If a conflicting pack is already active at the same scope, activation is blocked. The operator must deactivate the conflicting pack first.
4. **Dependency cycles are forbidden.** The dependency graph must be a DAG (directed acyclic graph). Pack manifests that would create a cycle are rejected at validation time.
5. **Cross-category dependencies are allowed.** A payer pack may depend on a national-standards pack. A specialty pack may depend on a regulatory pack. Dependencies cross category boundaries.

### 10.3 Precedence rules

When multiple active packs provide configuration for the same concern, precedence resolves conflicts:

| Precedence rank | Source | Rationale |
|-----------------|--------|-----------|
| 1 (highest) | Tenant overlay | Tenant-specific customization always wins |
| 2 | Specialty / content pack | More specific than market-level packs |
| 3 | Payer pack | Payer-specific rules override general national standards |
| 4 | National standards pack | Country-specific standards |
| 5 | Regulatory pack | Compliance baseline |
| 6 | Locale pack | Formatting defaults |
| 7 (lowest) | Language pack | String translations (lowest precedence, widest impact) |

**Precedence applies only to overlapping configuration keys.** Most packs operate in non-overlapping domains and precedence is irrelevant. Precedence matters when, for example, a payer pack and a national-standards pack both define a code-set mapping for the same procedure category.

---

## 11. Pack eligibility and applicability

### 11.1 Eligibility evaluation

Before a pack can be activated for a scope, the system evaluates eligibility:

| Eligibility criterion | Checked against | Example |
|----------------------|-----------------|---------|
| Legal market | Tenant's legal-market selection | `regulatory-hipaa` is eligible only for US-market tenants |
| Facility type | Facility entity attributes | `specialty-inpatient-pharmacy` is eligible only for facilities with inpatient capability |
| Service line / specialty | Department or service-line entity | `specialty-cardiology` is eligible only where cardiology service line exists |
| Infrastructure availability | Runtime probe of VistA/external systems | `payer-philhealth` is eligible only when PhilHealth API endpoint is reachable (or stub mode accepted) |
| License / entitlement | Tenant's module entitlements | Pack may require a specific module entitlement (e.g., RCM module for payer packs) |

### 11.2 Eligibility is evaluated, not assumed

The system must not assume eligibility based on ambient context (e.g., "this looks like a US deployment, so activate HIPAA"). Eligibility evaluation must:

1. Read the pack's declared eligibility criteria from its manifest.
2. Read the entity model attributes for the target scope.
3. Compare criteria against attributes.
4. Return a pass/fail with explanation for each criterion.

### 11.3 Applicability vs eligibility

| Term | Meaning |
|------|---------|
| Eligible | The pack's criteria match the scope's attributes. It **can** be activated. |
| Applicable | The pack is eligible **and** has been explicitly activated by an authorized operator. |

Eligibility alone does not activate a pack. An explicit activation action is required (see Section 14).

---

## 12. Pack lifecycle states

### 12.1 State machine

Every pack progresses through these states:

```
draft → validated → tested → published → [activated ↔ deactivated] → retired
```

| State | Meaning | Who transitions | Gate |
|-------|---------|-----------------|------|
| **draft** | Pack manifest and content are being authored | Pack author | — |
| **validated** | Manifest passes schema validation; dependencies are resolvable; no conflicts with existing packs | Automated validation | Schema + dependency check |
| **tested** | Pack has been tested in a non-production environment against live VistA infrastructure | Pack author + QA | Test evidence required |
| **published** | Pack is available for activation. Has passed all quality gates. | Governance review | Human approval + test evidence |
| **activated** | Pack is live for a specific scope (tenant/facility/department) | Authorized operator | Eligibility check + dependency check |
| **deactivated** | Pack was active but has been turned off. Configuration preserved for possible reactivation. | Authorized operator | Impact assessment |
| **retired** | Pack is permanently removed from availability. Cannot be reactivated. | Governance decision | Migration plan for any active instances |

### 12.2 State transition rules

1. **Forward progression requires gates.** Each gate must be passed to move forward. Gates cannot be skipped.
2. **Activation and deactivation are reversible.** A pack can move between activated and deactivated without re-publishing.
3. **Retirement is irreversible.** Once retired, a pack cannot be reactivated. If the same functionality is needed, a new pack version must be created.
4. **Draft packs are not visible to operators.** Only validated-or-later packs appear in the pack catalog.
5. **Multiple versions of the same pack may coexist** in the catalog (e.g., `regulatory-hipaa` v1.0 published, v2.0 in testing). But only one version may be activated per scope at a time.

### 12.3 Governance gates detail

| Gate | Input | Check | Output |
|------|-------|-------|--------|
| draft → validated | Pack manifest | JSON Schema validation, dependency DAG check, conflict detection, required fields present | Validation report (pass/fail with details) |
| validated → tested | Validation report + test plan | Test execution against live infrastructure; no MUMPS errors; correct data flow; adapter functions | Test evidence (commands, outputs, pass/fail) |
| tested → published | Test evidence | Human review of test evidence; governance approval | Publication record with approver and date |
| published → activated | Eligibility evaluation | All eligibility criteria pass; all required dependencies active; no conflicts at scope | Activation record with scope, operator, timestamp |
| activated → deactivated | Deactivation request | Impact assessment: what capabilities are affected; what dependent packs must also deactivate | Deactivation record with reason and impact |
| any → retired | Retirement request | No active instances; migration plan for any facilities that were using it | Retirement record |

---

## 13. Pack versioning

### 13.1 Version format

Pack versions use **semantic versioning** (MAJOR.MINOR.PATCH):

| Component | Increment when |
|-----------|---------------|
| MAJOR | Breaking change: removed configuration keys, changed eligibility requirements, incompatible dependency changes |
| MINOR | Backward-compatible addition: new configuration keys, new content, expanded coverage |
| PATCH | Bug fix: corrected translation, fixed rule logic, updated reference data |

### 13.2 Version coexistence

- Multiple versions of the same pack may exist in the catalog simultaneously (e.g., `standards-ph` v1.2.0 active, v2.0.0 in testing).
- Only one version of a pack may be activated per scope at a time.
- Major version upgrades require explicit operator action and may require a migration path.

### 13.3 Version compatibility with dependencies

- A pack's dependency declaration specifies compatible version ranges (e.g., `requires regulatory-hipaa >=1.0.0 <3.0.0`).
- If an active dependency is upgraded to a version outside the compatible range, the dependent pack is flagged for review.

---

## 14. Pack activation and deactivation

### 14.1 Activation workflow

1. **Operator requests activation** of a specific pack version for a specific scope (tenant, facility, or department).
2. **System evaluates eligibility** (Section 11) against the entity model attributes of the target scope.
3. **System resolves dependencies** (Section 10). If any required dependency is missing, activation is blocked.
4. **System checks for conflicts** (Section 10). If a conflicting pack is active at the same scope, activation is blocked.
5. **Activation is recorded** with: pack ID, version, scope, operator identity, timestamp, eligibility evaluation result.
6. **Configuration takes effect.** The pack's configuration is merged into the active configuration for the scope according to precedence rules (Section 10.3).

### 14.2 Deactivation workflow

1. **Operator requests deactivation** of an active pack at a specific scope.
2. **System evaluates impact.** What other packs depend on this pack? What capabilities are affected?
3. **If dependent packs exist**, the system blocks deactivation unless the operator also deactivates the dependents (cascade deactivation with explicit confirmation).
4. **Deactivation is recorded** with: pack ID, version, scope, operator identity, timestamp, reason.
5. **Configuration is removed.** The pack's configuration is removed from the active configuration for the scope.

### 14.3 Activation scope examples

| Action | Description |
|--------|-------------|
| Activate `locale-ph` for Tenant T1 | All facilities under T1 use Philippine locale formatting |
| Activate `payer-bcbs` for Facility F3 | Only Facility F3 can process BCBS claims; other facilities under the same tenant are unaffected |
| Activate `specialty-cardiology` for Department D7 | Cardiology content is available in Department D7 |
| Deactivate `standards-us` for Tenant T1 | Blocked if any payer pack with a dependency on `standards-us` is still active |

---

## 15. Adapter contract model

### 15.1 Contract structure

Every adapter type has a contract that defines:

| Contract element | Purpose |
|-----------------|---------|
| Operations | Named methods the adapter must implement (e.g., `getPatientAllergies`, `submitClaim`) |
| Input types | Typed input parameters for each operation |
| Output types | Typed output shapes for each operation, including success and error variants |
| Error semantics | How errors are classified (infrastructure error, data error, authorization error, not-available) |
| Behavioral guarantees | Idempotency requirements, retry safety, timeout expectations |
| Integration-pending contract | What the stub adapter returns for each operation |

### 15.2 Contract evolution

1. **Non-breaking additions** (new optional operation, new optional field) require a minor version bump of the contract.
2. **Breaking changes** (removed operation, changed required field type, changed error semantics) require a major version bump and an ADR.
3. **Contract versions are tracked** in `packages/contracts/`. Consuming code declares which contract version it expects.

### 15.3 Contract validation

Adapter implementations are validated against their contracts:

- At build time: type checking ensures the adapter implements all required operations with correct types.
- At test time: integration tests verify the adapter behaves according to the contract (correct outputs, correct error classification, correct integration-pending behavior for stub).
- At runtime: the adapter selection mechanism verifies the loaded adapter matches the expected contract version.

---

## 16. Adapter selection and swap mechanics

### 16.1 Selection flow

```
Request arrives
  → Determine adapter type needed (from route/capability)
  → Read pack configuration for the scope (which adapter, which config)
  → Check adapter availability:
      If VistA adapter available and configured → use VistA adapter
      If external adapter configured by payer/integration pack → use external adapter
      If adapter unavailable → fall back to stub adapter
  → Execute operation through selected adapter
  → Return result (including adapter identity for audit)
```

### 16.2 Swap mechanics

Adapter swaps occur when:

| Trigger | From | To | Governance requirement |
|---------|------|-----|----------------------|
| Infrastructure becomes available | Stub | VistA or External | Automated (on next probe success) |
| Infrastructure becomes unavailable | VistA or External | Stub | Automated (circuit breaker triggers) |
| Pack activation changes adapter config | Current adapter | New adapter per pack config | Operator-initiated; eligibility + dependency check |
| Contract version upgrade | Old version adapter | New version adapter | ADR if breaking; controlled rollout |

### 16.3 Swap safety rules

1. **No in-flight disruption.** Swaps take effect on the next request, not mid-operation.
2. **Swap is logged.** Every adapter swap is recorded in the audit trail with: old adapter, new adapter, trigger reason, timestamp.
3. **Stub fallback is always available.** Even if all adapters fail, the stub adapter is always loadable and returns explicit `integration-pending`.
4. **No silent fallback.** Falling back to a stub adapter is observable: the response includes an indicator that the result is `integration-pending`, not real data.

---

## 17. Pack composition and conflict resolution

### 17.1 Composition model

At any given scope (tenant, facility, department), multiple packs from different categories are typically active simultaneously. The effective configuration is the **composition** of all active packs' configurations, resolved by precedence.

### 17.2 Composition example

For a Philippine-market cardiology department at Facility F3 within Tenant T1:

| Active pack | Category | Scope | Precedence |
|-------------|----------|-------|------------|
| `overlay-acme` | Tenant overlay | T1 | 1 (highest) |
| `specialty-cardiology` | Specialty/content | Dept D7 | 2 |
| `payer-philhealth` | Payer | T1 | 3 |
| `standards-ph` | National standards | T1 | 4 |
| `regulatory-philhealth-doh` | Regulatory | T1 | 5 |
| `locale-ph` | Locale | T1 | 6 |
| `lang-ko` | Language | T1 | 7 (lowest) |

### 17.3 Conflict detection

Conflicts are detected at two points:

1. **At activation time.** When a new pack is activated, the system checks whether it declares conflicts with any already-active pack at the same scope.
2. **At validation time.** When a pack manifest is validated, the system checks whether its configuration keys overlap with other packs' keys in a way that precedence cannot resolve (e.g., two packs in the same category providing contradictory rules).

### 17.4 Conflict resolution strategies

| Situation | Resolution |
|-----------|-----------|
| Two packs in the same category at the same scope | Blocked at activation (e.g., cannot have two locale packs active for the same tenant) |
| Two packs in different categories overlapping on a config key | Resolved by precedence (Section 10.3) |
| A higher-scope pack and a lower-scope pack | Lower scope overrides higher scope (per Section 9.3 inheritance) |
| Contradictory rules from different packs | Higher-precedence pack wins; conflict is logged for operator review |

---

## 18. Validation, proof, and readiness

### 18.1 Validation layers

| Layer | What is validated | When | Tool |
|-------|-------------------|------|------|
| Schema validation | Manifest JSON conforms to pack manifest schema | Draft → validated transition | JSON Schema validator |
| Dependency validation | All declared dependencies exist and are resolvable in a DAG | Draft → validated transition | Dependency resolver |
| Content validation | Pack content is well-formed (translations parse, rules compile, templates render) | Validated → tested transition | Category-specific validators |
| Integration validation | Pack functions correctly against live VistA/external infrastructure | Validated → tested transition | Integration test harness |
| Eligibility validation | Pack can be activated for a given scope | Published → activated transition | Eligibility evaluator |

### 18.2 Proof requirements

Per the governed build protocol, every pack state transition requires proof:

- **Files changed:** pack manifest, content files, test files.
- **Commands run:** validation command, test command, with exact outputs.
- **Pass/fail:** each validation gate's result.
- **Evidence location:** `artifacts/` (not committed to docs).

### 18.3 Readiness integration

Pack readiness feeds into the capability truth pipeline (global architecture Section 18):

```
Pack draft → Pack validated → Pack tested → Pack published → Pack activated
                                                                    ↓
                                        Capability: declared → built → tested → verified → claimable
```

A capability that depends on a pack is not claimable until:

1. The pack is published (has passed all quality gates).
2. The pack is activated for the relevant scope.
3. The capability's own tests pass with the pack active.

---

## 19. Capability truth and claim-gating integration

### 19.1 How packs contribute to capabilities

A capability manifest declares which packs it requires:

```
Capability: "Philippines billing"
  Requires packs:
    - regulatory-philhealth-doh (active for tenant)
    - standards-ph (active for tenant)
    - payer-philhealth (active for tenant or facility)
    - locale-ph (active for tenant)
  Requires adapters:
    - PhilHealthConnector (external system adapter, configured)
```

### 19.2 Claim-gating rules

1. **Capability is not claimable until all required packs are active and verified.** Having the packs published but not activated is insufficient.
2. **Capability degradation is explicit.** If a required pack is deactivated, the capability state downgrades from `claimable` to `verified` or `tested` and the operator is notified.
3. **Partial capability is reportable.** A capability with 3 of 4 required packs active can report its partial state (e.g., "Philippines billing: regulatory ✓, standards ✓, payer ✓, locale ✗").
4. **No overclaiming.** The system must not claim a capability as ready unless all required packs and adapters are verified. Marketing or operator-facing surfaces must reflect the actual capability state.

---

## 20. Safety constraints and prohibited patterns

These constraints are non-negotiable and apply to all pack and adapter work.

| Constraint | Rationale |
|------------|-----------|
| Packs must not create shadow clinical data stores | VistA globals are the clinical source of truth (global architecture Section 6) |
| Packs must not deploy arbitrary code to VistA | VistA routine changes go through the distro overlay process, not through platform pack activation |
| Adapters must not bypass the approved VistA write path | Global architecture Section 11 mandates: External → Adapter → Gateway/Queue → Approved Write Path → Globals |
| Stub adapters must never return fake success | Stubs return `integration-pending` only (global architecture anti-goal) |
| Pack activation must not be silent or automatic | All activation requires explicit operator action through a governed path |
| Regulatory packs cannot be deactivated while the legal market applies | Compliance obligations are not optional |
| Pack retirement must not leave orphaned dependents | All dependent packs must be migrated or deactivated before retirement |
| Adapter selection must be deterministic and logged | No random or context-guessed adapter selection |
| Pack manifests must not contain credentials or secrets | Secrets are managed through secure configuration, not pack content |
| Pack content must not contain patient data or PHI | Packs contain configuration, content, and rules — not clinical records |

---

## 21. Resolved now vs deferred later

### 21.1 Resolved by this document

| Question | Resolution | Section |
|----------|-----------|---------|
| What is a pack? What categories exist? | 7 categories with detailed attributes | 5, 6 |
| What are the adapter types? | 4 types with contract structures | 7 |
| Where do pack artifacts live across repos? | Ownership matrix and cross-repo contract | 8 |
| What entities do packs attach to? | Attachment matrix with scope and inheritance | 9 |
| How do pack dependencies and precedence work? | Dependency DAG, precedence ranking, conflict rules | 10 |
| How is pack eligibility evaluated? | Criteria-based evaluation against entity model | 11 |
| What are the pack lifecycle states? | 7 states with governance gates | 12 |
| How are packs versioned? | Semantic versioning with coexistence rules | 13 |
| How are packs activated and deactivated? | Explicit workflows with eligibility + dependency checks | 14 |
| What is the adapter contract model? | Contract structure, evolution, and validation | 15 |
| How are adapters selected and swapped? | Selection flow, swap triggers, safety rules | 16 |
| How do multiple active packs compose? | Precedence-based composition with conflict detection | 17 |
| How does pack readiness integrate with capability truth? | State progression parallel to capability pipeline | 18, 19 |
| What safety constraints apply? | 10 non-negotiable constraints | 20 |

### 21.2 Deferred to subsequent artifacts

| Question | Deferred to |
|----------|-------------|
| What is the pack manifest JSON Schema? | Contract work in `packages/contracts/schemas/` |
| What are the API endpoints for pack management? | OpenAPI contract work |
| What screens exist for pack administration? | Information architecture workspace map (UI not authorized) |
| What is the detailed capability truth state machine? | Capability truth and claim-gating spec (global architecture Section 20, item 3) |
| What is the country/payer readiness registry structure? | Country and payer readiness registry spec (global architecture Section 20, item 4) |
| What is the detailed specialty content model? | Specialty content and analytics architecture spec |
| How are pack tests structured and automated? | Testing framework specification |
| How is the cross-repo manifest contract versioned? | Cross-repo contract governance ADR when needed |

---

## 22. Parent handoff cross-reference

The organization/facility/network/service model Section 20 specified seven items this spec must address:

| Required item | Where addressed |
|---------------|----------------|
| 1. Pack lifecycle: authoring, versioning, validation, activation, deactivation | Sections 12, 13, 14 |
| 2. Adapter contract model: VistA adapter, stub adapter, external adapters | Sections 7, 15 |
| 3. Pack dependency resolution: how packs declare and resolve prerequisites | Section 10 |
| 4. Pack eligibility evaluation: how entity context determines applicable packs | Section 11 |
| 5. Pack composition: how multiple active packs combine without conflict | Section 17 |
| 6. Adapter swap mechanics: how adapters are selected and swapped at runtime | Section 16 |
| 7. Governance gates: how pack changes are reviewed, tested, and promoted | Sections 12.3, 18 |

---

## 23. Next artifact handoff

### What this spec resolves for the next artifact

The next planned artifact is **Capability Truth and Claim-Gating Specification** (`docs/explanation/capability-truth-and-claim-gating-spec.md`), as specified in the global architecture backbone Section 20, item 3.

This current document provides:

- **Pack lifecycle states** that feed into capability readiness (Section 18).
- **Pack-to-capability mapping** model (Section 19).
- **Validation layers** that produce evidence consumed by the capability truth pipeline (Section 18).
- **Claim-gating rules** that connect pack activation to capability claims (Section 19).

### What the next spec must address

The capability truth and claim-gating spec must define:

1. Capability manifest schema and structure.
2. Capability state machine: declared → built → tested → verified → claimable.
3. Evidence model: what constitutes proof at each state transition.
4. Claim-gating evaluation logic: when is a capability claimable for a scope.
5. Capability degradation: how capability state responds to pack/adapter status changes.
6. Capability registry and reporting: how operators see capability status across scopes.
7. Integration with the governed build protocol: how capability truth aligns with one-slice-at-a-time delivery.

!!! warning "Sequencing discipline"
    The next artifact must be authored, reviewed, and accepted before subsequent artifacts begin. Do not batch-generate the full specification sequence.

---

## 24. Explicit out-of-scope — not authorized by this document

| Item | Status |
|------|--------|
| Pack manifest JSON Schema (concrete schema definition) | Deferred to `packages/contracts/schemas/` |
| Pack management REST API endpoints | Deferred to OpenAPI contract work |
| Pack administration UI/screens | Not authorized (global architecture Section 19) |
| Pack marketplace or distribution pipeline | Not authorized |
| Language pack content authoring for additional languages | Not authorized (requires VE-DISTRO scope decision) |
| Adapter implementation code | Deferred to implementation slices |
| Capability manifest schema | Deferred to capability truth spec |
| Country readiness claims for any market | Not authorized (requires proof through capability pipeline) |
| Cross-tenant pack sharing | Not yet defined |
| Production deployment of any pack management feature | Not authorized |
