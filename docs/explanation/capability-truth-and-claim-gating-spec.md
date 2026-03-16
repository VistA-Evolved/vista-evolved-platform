# Capability Truth and Claim-Gating Specification — VistA Evolved

> **Status:** Accepted architecture specification.
> **Date:** 2026-03-16.
> **Scope:** Capability readiness model, evidence classes, claim surfaces, gating rules, and anti-drift governance.
> **Owner:** vista-evolved-platform (this repo).
> **Parent specifications:**
>
> - `docs/explanation/global-system-architecture-spec.md` — architecture backbone (Section 18)
> - `docs/explanation/pack-and-adapter-architecture-governance.md` — pack readiness integration (Sections 18, 19, 23)
> - `docs/explanation/organization-facility-network-service-model.md` — entity model (scope entities)

---

## 1. Document purpose and status

### 1.1 What this document is

This is the **authoritative specification for capability truth, readiness state governance, and claim gating** in VistA Evolved. It defines what it means for a capability to be declared, built, validated, verified, claimable, and production-eligible. It defines what evidence is required at each state transition, what scope dimensions affect truth, what surfaces consume capability claims, and what rules prevent overclaiming.

It fulfills the handoff from:

- Global system architecture spec Section 20, item 3 ("Capability truth and claim gating spec").
- Pack and adapter architecture governance Section 23 ("Next artifact handoff") and Section 21.2 ("Detailed capability truth state machine").

### 1.2 What this document is not

- Not a capability manifest JSON Schema (deferred to `packages/contracts/schemas/`).
- Not a readiness registry database schema (deferred to future schema work).
- Not an API specification for capability or readiness endpoints (deferred to OpenAPI contract work).
- Not a dashboard or UI specification (UI is not authorized per global architecture Section 19).
- Not a website implementation plan.
- Not a signup flow or provisioning logic implementation.
- Not authorization to build automated state-transition machinery.
- Not a country-readiness claim for any specific market.

### 1.3 Current phase

VistA Evolved is in **architecture planning and terminal-first proof** phase. This document defines the architecture for capability truth and claim gating. Implementation of readiness registries, claim-gating APIs, and downstream surfaces follows the governed build protocol: one slice at a time, with proof, after explicit authorization.

---

## 2. Relationship to parent specifications

### 2.1 What the global system architecture spec established

| Section | Established position | This spec's role |
|---------|---------------------|------------------|
| 18 | Capability truth pipeline: declared → built → tested → verified → claimable. No public claim without verified proof. Claim surfaces include website, signup, module activation, provisioning. | Defines the full state model, evidence requirements, scope dimensions, and gating rules that operationalize this position. |
| 4 | Anti-goal: marketing overclaims — no public claim without matching capability proof. | Defines the specific rules and surfaces where this anti-goal is enforced. |
| 9 | Country/payer/language readiness are separate dimensions tracked independently. | Defines scope dimensions and how scoped truth prevents false broadening. |
| 10 | Pack taxonomy and governance role. | Defines how pack states feed into capability readiness. |
| 13 | Control plane governs provisioning and launch tiers. | Defines how capability truth constrains provisioning and onboarding. |
| 19 | Broad UI implementation not authorized. | This spec does not authorize UI. It defines the truth model that future UI must consume. |
| 20 | Item 3 mandates this spec. | This document fulfills that mandate. |

### 2.2 What the pack-and-adapter governance spec established

| Section | Established position | This spec's role |
|---------|---------------------|------------------|
| 18 | Pack readiness feeds into capability truth pipeline: pack draft → validated → tested → published → activated, parallel to capability declared → built → tested → verified → claimable. | Defines how pack state is consumed as an input to capability readiness evaluation. |
| 19 | Pack-to-capability mapping model. Capabilities depend on packs. Partial capability is reportable. No overclaiming. | Defines the full evaluation logic, including partial-support rules and degradation. |
| 23 | Handoff: 7 items this spec must address. | All 7 are addressed (see Section 20 cross-reference). |

### 2.3 What the organization/facility/network/service model established

The entity model defines the scope entities (tenant, facility, department, service line, specialty, legal market) against which capability truth is evaluated. A capability is never unscoped — it is always assessed relative to a specific organizational context.

### 2.4 What the distro repo is canonical for

The `vista-evolved-vista-distro` repo is canonical for:

- **Runtime lane truth:** UTF-8 lane is primary planned operator lane; M-mode is rollback/reference/safety (VE-DISTRO-ADR-0003).
- **Language pack implementation and coverage:** `overlay/l10n/PACK-SPEC.md` defines the format; language packs are assessed for maturity by distro-owned verification.
- **Build lane health:** 5-level readiness checks (container, network, service, terminal, RPC) are distro-owned.
- **VistA global/clinical data ownership:** VistA owns clinical and operational data.

This spec **consumes** distro runtime truth as an input to capability readiness evaluation. It does **not** re-decide lane designation, language coverage levels, or build health criteria. Those remain distro-canonical.

---

## 3. Goals

The capability truth and claim-gating model must support:

1. **Truthful internal classification.** Every capability has a governed readiness state that reflects what has actually been built, tested, and verified — not what was planned or assumed.
2. **Truthful public claims.** Every claim on a public surface (website, documentation, sales deck) traces to a governed readiness state with evidence. No claim outpaces verification.
3. **Truthful onboarding and provisioning.** Signup flows, legal-market selection, and tenant provisioning offer only what is eligible and verified for the requested scope.
4. **Truthful country/legal-market positioning.** Country readiness is decomposed into independently tracked dimensions (language, regulatory, payer, standards). No blanket "country-ready" label without dimensional proof.
5. **Truthful payer readiness.** Payer integrations are tracked per-payer, not as a market-wide flag.
6. **Truthful specialty and content readiness.** Specialty content is tracked per-specialty, per-scope, with explicit coverage bounds.
7. **Truthful runtime and language readiness.** Runtime lane status and language coverage feed into capability truth through governed inputs, not assumptions.
8. **Bounded proof without overclaiming.** A capability may be verified for a narrow scope (one pilot, one facility type, one payer) without that proof being silently widened to cover broader claims.
9. **Future automation without losing human review.** The model supports future automated state transitions while preserving mandatory human review gates at critical points.

---

## 4. Anti-goals and forbidden drift

| Anti-goal | Why forbidden |
|-----------|---------------|
| "It exists in code, so market it" | Code existence is not verification. Implemented ≠ verified ≠ claimable. |
| "It worked once, so mark it production-ready" | A single test pass is not production readiness. Environment, scope, and sustained operation matter. |
| "One pilot equals global support" | Pilot-scope proof must remain pilot-scoped in truth statements. Silent widening is prohibited. |
| Mixing roadmap intent with verified truth | Roadmap items ("planned," "in development") must never appear as if they are verified or claimable capabilities. |
| Hiding unverified gaps behind broad labels | "Country-ready" must not conceal that payer integrations are untested or that only one specialty is content-complete. |
| Using website copy or sales pressure as truth source | Truth flows from evidence through the governed pipeline to claim surfaces. It never flows backward from marketing copy to truth state. |
| Allowing activation of uneligible capabilities | Tenant activation must be gated by eligibility and verification status. No operator override of truth. |
| Silent widening from partial to full support | If a capability is verified for one facility type or one payer, the truth state must reflect that bound. Upgrading to "full" requires additional proof. |
| Treating readiness as binary | Readiness is multidimensional and scoped. A single pass/fail flag is insufficient. |
| Confusing activated with claimable | A capability may be activated (turned on in config) but not independently claimable (verified to the level required for public claims). |

---

## 5. Canonical definitions

These terms have precise meanings in VistA Evolved. All specs, code, documentation, and claim surfaces must use them consistently.

### Canonical definitions table

| Term | Definition | What it is NOT | Primary owner |
|------|-----------|----------------|---------------|
| **Capability** | A discrete, verifiable unit of system functionality that may be truthfully described to operators, tenants, or the public. Examples: "Philippine billing," "Korean terminal localization," "cardiology order sets." | Not a feature flag. Not a line of code. Not a marketing label. | Platform (governance) |
| **Capability class** | A named grouping of related capabilities that share a readiness domain. Examples: "clinical," "billing," "scheduling," "localization," "regulatory compliance." | Not a module ID. Not a UI tab. Not a pack category (though pack categories may map to capability classes). | Platform (governance) |
| **Readiness** | The governed state of a capability's progression from idea through production. Readiness is multidimensional and scoped. | Not a binary flag. Not an opinion. Not a roadmap marker. | Platform (governance) |
| **Declared** | A capability has been identified and described in a capability manifest. No implementation exists. Intent only. | Not "started." Not "in progress." | Platform |
| **Specified** | A capability has a contract-level specification (OpenAPI, schema, pack manifest) that defines its interface and behavior. | Not "implemented." A spec is not code. | Platform |
| **Implemented** | Code or configuration exists that realizes the capability. It may or may not work correctly. | Not "tested." Not "verified." Code existence alone says nothing about correctness. | Platform or distro (depending on capability) |
| **Validated** | The capability has been tested in a controlled environment against live infrastructure (not mocks) and passed defined acceptance criteria. | Not "verified." Validation is pre-production. | Platform or distro |
| **Verified** | The capability has been independently confirmed to work correctly in a representative environment with evidence recorded. Verification is the minimum bar for claims. | Not "production-eligible." Verification says "it works here, with this scope." Production eligibility says "it is ready for real use at scale." | Platform (governance) + distro (runtime evidence) |
| **Claimable** | The capability's verified state, scope, and evidence are sufficient to make truthful public statements about it. | Not "production-eligible." Claimable means "we may truthfully say this works for scope X." It does not mean "it is deployed and supported in production." | Platform (governance) |
| **Production-eligible** | The capability has passed all verification, operational readiness, support, and compliance gates required for real-world use with real patients or real financial transactions. | Not "deployed." Production-eligible means the gates are passed. Deployment is a separate operational action. | Platform (governance) + distro (runtime) |
| **Applicable** | A capability is relevant to a specific organizational scope (tenant, facility, market). Determined by eligibility evaluation against entity model attributes. | Not "activated." A capability may be applicable but not yet activated. | Derived (entity model + pack eligibility) |
| **Eligible** | A capability meets all preconditions for activation at a given scope: required packs available, dependencies satisfied, infrastructure healthy. | Not "active." Eligibility is a gate check, not a state. | Derived (packs + adapters + runtime) |
| **Activated** | A capability has been explicitly turned on for a specific scope by an authorized operator. Config takes effect. | Not "verified." Not "claimable." A capability may be activated before full verification (e.g., in a pilot). Activation does not grant claimability. | Platform (operator action) |
| **Bounded proof** | Evidence that a capability works within explicitly stated limits (one facility type, one payer, one language, one runtime lane). The bounds are part of the truth statement. | Not proof of universal support. Bounded proof must never be silently widened. | Platform (governance) |
| **Evidence** | Recorded artifacts that demonstrate a capability's state: test results, runtime logs, screenshots, operator confirmations, certification documents. Evidence is stored in `artifacts/`, not in docs. | Not an opinion. Not a code review comment. Not "it looks right." | Platform or distro (depending on artifact) |
| **Launch tier** | A governed stage of deployment readiness: internal-only, sandbox, pilot, limited-availability, general-availability. Each tier has defined criteria. | Not a marketing label. Not a feature flag. | Platform (governance) |
| **Support tier** | The level of operational support committed for a capability: unsupported (experimental), best-effort, standard, premium. | Not a readiness state. A capability may be verified but unsupported (e.g., community-contributed content). | Platform (governance) |
| **Market readiness** | The composite readiness of all capabilities required to operate in a specific legal market (country/region). Decomposed into language, regulatory, standards, payer, and provisioning readiness dimensions. | Not a single boolean. Not claimed without dimensional proof. | Derived (multiple capability states) |
| **Payer readiness** | The readiness of capabilities required to interact with a specific payer: claim submission, eligibility check, remittance processing, connector health. | Not country readiness. Payer readiness is per-payer. | Derived (payer pack + adapter state) |
| **Language readiness** | The readiness of language capabilities for a specific language: terminal localization level, UI string coverage, clinical content translation depth. Assessed against distro L0–L5 maturity model. | Not just "translated some strings." Language readiness has levels. | Distro (implementation) + platform (governance) |
| **Runtime truth** | The verified state of VistA infrastructure: lane health, build status, service readiness, RPC availability. Canonical source is the distro repo's `docs/reference/runtime-truth.md`. | Not an assumption. Not a build timestamp. Runtime truth is verified by distro scripts. | Distro |

---

## 6. Capability model vs pack/adapter model

### What they are

| Concept | What it represents | Governed by |
|---------|-------------------|-------------|
| Capability | What the system can truthfully do for a given scope | This spec |
| Pack | A composable unit of configuration/content/integration that contributes to capabilities | Pack and adapter architecture governance |
| Adapter | A typed integration component that mediates between VistA Evolved and external/internal systems | Pack and adapter architecture governance |
| Runtime truth | The verified state of VistA infrastructure | Distro runtime truth |

### How they relate

```
Runtime truth (distro-canonical)
  + Pack states (activated, published, validated...)
    + Adapter states (available, stub, circuit-breaker...)
      = Inputs to capability readiness evaluation
        → Capability readiness state (this spec)
          → Claim surfaces (this spec)
```

A capability is an **aggregation and governance layer** over underlying truths. It does not replace pack states, adapter states, or runtime truth. It consumes them as inputs and produces governed readiness states that downstream surfaces may safely consume.

### Key distinctions

1. **A capability may depend on zero, one, or many packs.** Some capabilities are purely platform-native (e.g., "tenant provisioning"). Others depend on multiple packs (e.g., "Philippine billing" depends on regulatory, standards, payer, and locale packs).
2. **A capability may depend on adapter states.** If the required adapter is in stub/integration-pending mode, the capability's readiness cannot exceed "implemented" regardless of pack state.
3. **A capability may depend on runtime truth.** If the required runtime lane is not verified, capabilities that depend on that lane cannot be verified.
4. **Pack activation is necessary but not sufficient for capability claimability.** A pack being activated means its configuration takes effect. Whether the resulting capability is claimable requires independent verification evidence.
5. **Adapter availability is necessary but not sufficient.** A VistA adapter being connected does not mean the capability it supports is verified. The adapter may be connected but untested for the specific workflow.

---

## 7. Readiness-state model

### 7.1 State definitions

| State | Meaning | Entry criteria |
|-------|---------|----------------|
| **Declared** | Capability identified and described in a manifest. Intent only, no work started. | Capability manifest entry exists with ID, description, class, scope. |
| **Specified** | Contract-level definition exists (OpenAPI, schema, pack manifest). Interface is defined. | Spec artifact exists in `packages/contracts/` or equivalent. |
| **Implemented** | Code, configuration, or pack content exists that realizes the capability. | Code/config exists in repo. Build succeeds. No runtime test yet. |
| **Validated** | Tested against live infrastructure in a controlled environment. Acceptance criteria passed. | Test evidence recorded. Tests ran against live VistA/infrastructure (not mocks). Pass/fail documented. |
| **Verified** | Independently confirmed in a representative environment. Evidence recorded. Minimum bar for any claim. | Independent verification evidence. Scope bounds documented. No known blocking defects for stated scope. |
| **Claimable** | Verified state and evidence are sufficient for truthful public statements within the stated scope. | Verified + scope fully documented + no gaps in evidence for the claimed scope + human governance review. |
| **Production-eligible** | All verification, operational, support, and compliance gates passed for real-world use. | Claimable + operational readiness (monitoring, support, SLA) + compliance (regulatory pack if applicable) + launch-tier approval. |
| **Deprecated** | Capability is being phased out. Still functional but no longer promoted or expanded. | Deprecation decision recorded. Migration path documented. |
| **Retired** | Capability is no longer available. Removed from all surfaces. | All active instances deactivated. Retirement record filed. |

### 7.2 State diagram

```
declared → specified → implemented → validated → verified → claimable → production-eligible
                                                                              ↓
                                                                         deprecated → retired
```

### 7.3 Forward-only vs reversible transitions

| Transition type | Rule |
|----------------|------|
| Forward (declared → specified → ... → production-eligible) | Requires passing the gate for the target state. Gates cannot be skipped. |
| Degradation (verified → validated, or claimable → verified) | Triggered by evidence invalidation: failing test, infrastructure change, pack deactivation, adapter failure. Automatic or human-triggered. |
| Deprecation | Human decision. Requires migration path documentation. |
| Retirement | Human decision. Requires all active instances deactivated first. |

### 7.4 State transition rules

1. **No state skip.** A capability at "declared" cannot jump to "verified" without passing through specified, implemented, and validated.
2. **Evidence required at each gate.** The evidence class and quantity required depend on the target state (see Section 8).
3. **Degradation is immediate.** If conditions that supported a state are no longer met (pack deactivated, adapter down, test failing), the capability state degrades. There is no "grace period" for invalid states.
4. **Scope is part of the state.** A capability's readiness state always includes the scope for which it is verified. "Verified for Facility Type A" and "verified for all facility types" are different states.
5. **Human review gates.** Transitions to "claimable" and "production-eligible" require explicit human governance review. Automated pipelines may advance capabilities to "verified" but not beyond.
6. **One capability, multiple scoped states.** The same capability may be "verified" for scope A and "implemented" for scope B simultaneously. The most restrictive scope applies to claims about scope B.

---

## 8. Evidence classes

### 8.1 Evidence class table

| Evidence class | Description | Typical artifacts | Strength |
|---------------|-------------|-------------------|----------|
| **Code/artifact existence** | Source code, config file, pack manifest, or contract spec exists in the repo. | Git commit SHA, file path, line count. | Weakest. Proves intent and effort, not correctness. |
| **Local build success** | Code compiles, lints, and builds without errors in a development environment. | Build log, lint output. | Proves structural validity, not runtime behavior. |
| **Runtime readiness check** | Infrastructure probe passes (container up, service reachable, RPC available). | Health check output (5-level distro model). | Proves infrastructure is available, not that the capability works end-to-end. |
| **Automated test result** | Automated tests pass against live infrastructure (not mocks). | Test runner output, pass/fail counts, coverage. | Strong for repeated validation. Scope limited to what tests cover. |
| **Manual operator proof** | A human operator executed the workflow against live infrastructure and recorded the result. | Step-by-step runbook execution with screenshots or terminal output. | Strong for complex workflows. Not repeatable without re-execution. |
| **Browser/terminal proof** | A human verified the capability through a browser or terminal session against a live VistA container. | Session recording, screenshots, terminal transcript. | Strong for end-user-visible behavior. Scope-specific. |
| **Regulatory/partner certification** | External authority has reviewed and certified compliance (e.g., clearinghouse certification, government portal approval). | Certification document, approval letter, test-transaction confirmation. | Strongest for external compliance claims. Scope-specific and time-limited. |
| **Production observation** | Capability has been observed working correctly in a production or production-equivalent environment over a defined period. | Monitoring data, incident reports (absence of), usage metrics. | Strongest for production-eligible status. Requires sustained operation. |

### 8.2 Evidence requirements per state transition

| Transition | Minimum evidence required |
|------------|--------------------------|
| declared → specified | Spec artifact exists (OpenAPI, schema, or manifest). |
| specified → implemented | Code/config exists. Local build succeeds. |
| implemented → validated | Automated test result against live infrastructure OR manual operator proof against live infrastructure. Not mocks. |
| validated → verified | Independent verification: either a different person confirms, or an automated pipeline runs in a representative environment. Scope bounds explicitly documented. |
| verified → claimable | Human governance review of: verification evidence, scope documentation, gap assessment. No known blocking defects for the claimed scope. |
| claimable → production-eligible | Operational readiness evidence (monitoring, alerting, support plan). Compliance evidence if regulatory pack applies. Launch-tier approval by governance. |

### 8.3 Evidence is not equal

The evidence classes form a rough hierarchy of strength. Lower-strength evidence cannot substitute for higher-strength requirements:

- Code existence does not satisfy "validated." You need a test against live infrastructure.
- A passing automated test does not satisfy "regulatory certification." You need the external authority's approval.
- A one-time manual proof does not satisfy "production observation." You need sustained monitoring data.

Evidence must match the transition gate's requirements. There is no "close enough."

---

## 9. Scope dimensions

### 9.1 Scope dimension table

| Dimension | What it scopes | Examples | Owner of truth |
|-----------|---------------|----------|----------------|
| **Runtime lane** | Which VistA build lane the capability is verified against | UTF-8, M-mode | Distro |
| **Language** | Which language the capability is verified in | English, Korean, Spanish | Distro (implementation) + platform (governance) |
| **Locale** | Which locale formatting is verified | US, PH, KR | Platform |
| **Legal market** | Which country/regulatory jurisdiction | United States, Philippines, South Korea | Platform |
| **Payer** | Which specific payer integration is verified | PhilHealth, BCBS, Medicare | Platform |
| **Specialty/content** | Which clinical specialty the capability covers | Cardiology, primary care, emergency | Platform |
| **Facility type** | Which facility topology is verified | Single clinic, multi-hospital, enterprise | Platform |
| **Tenant type** | What kind of tenant/deployment | Single-tenant, multi-tenant | Platform |
| **Environment** | What deployment environment | Sandbox, pilot, staging, production | Platform |
| **Launch tier** | What level of release | Internal-only, sandbox, pilot, limited-availability, general-availability | Platform |

### 9.2 Scoped truth, not flat truth

Capability truth is **never flat**. Every truth statement must include its scope:

- ✅ "Philippine billing is **verified** for PhilHealth claims in a **single-clinic** topology on the **UTF-8 lane**."
- ❌ "Philippine billing is verified." (Missing: which payer? which topology? which lane?)
- ❌ "Multilingual support is ready." (Missing: which languages? to what level? on which lane?)

A capability that is verified in one scope dimension is **not** verified in another unless independent evidence exists for that scope.

### 9.3 Partial scope and bounded proof

When a capability is verified for only a subset of a scope dimension, the truth statement must include the bounds:

- "Verified for PhilHealth only (1 of 15 PH payers)"
- "Verified for single-clinic topology only"
- "Verified for English and Korean only (L2 maturity per distro PACK-SPEC)"
- "Verified on UTF-8 lane; M-mode untested"

Bounded proof is legitimate and valuable. It becomes dangerous only when the bounds are omitted or silently widened.

---

## 10. Claim surfaces

### 10.1 Claim surface table

| Surface | Audience | What it claims | Gating requirement |
|---------|----------|---------------|-------------------|
| **Public website** | Prospects, partners, regulators | Feature availability, country support, language support, standards compliance | Claimable or higher. Scope bounds visible. |
| **Sales/partnership decks** | Prospective partners, investors | Market coverage, payer coverage, specialty coverage | Claimable or higher. Bounded proof labeled. Roadmap items marked "planned." |
| **Onboarding/signup flow** | New tenants | Available legal markets, available modules, provisioning options | Eligible and claimable for the selected scope. Non-eligible options not shown. |
| **Control-plane provisioning** | Operators | Pack activation, module enablement, launch-tier assignment | Eligible. Activated capabilities need not be claimable (pilot activations are valid). |
| **Tenant-admin enablement** | Tenant admins | Module on/off, feature configuration within entitlement | Activated and eligible for the tenant's scope. Partial support visibly labeled. |
| **Internal roadmap/status** | Engineering, product, leadership | Readiness state per capability per scope | Governed readiness state. Roadmap items labeled "declared" or "specified," not "verified." |
| **Support documentation** | Support staff, operators | What is supported, known limitations, scope bounds | Verified or higher. Known limitations documented alongside claims. |
| **Notion/project mirrors** | Team collaboration | Status tracking, task progress | Governed readiness state. Repo is source of truth; Notion is mirror (per `docs/reference/notion-sync-policy.md`). |

### 10.2 All surfaces downstream of governed truth

Every claim surface listed above must derive its content from the governed capability readiness state. No surface may independently assert a readiness level that the governed pipeline has not reached.

```
Evidence → State transition → Governed readiness state → Claim surfaces
```

The arrow is one-directional. Information flows from evidence to surfaces. It never flows backward (a marketing request does not modify readiness state).

---

## 11. Claim-gating rules

These rules are non-negotiable.

| Rule | Enforcement |
|------|-------------|
| **No public claim without verified evidence.** A capability must be at "verified" or higher before any public-facing surface (website, documentation, sales material) may state that it is available. | Governance review at verified → claimable transition. |
| **No provisioning option without eligibility.** Signup and provisioning flows must not offer capabilities, legal markets, or pack configurations that are not eligible for the tenant's scope. | Eligibility evaluation at provisioning time. |
| **No tenant activation without supported scope.** A tenant admin must not be able to activate a capability for a scope where it has not been verified (unless explicitly enabled as pilot/experimental with visible labeling). | Activation gate checks readiness state and scope. |
| **No country claim without dimensional proof.** "Country-ready" requires proof across language readiness, regulatory readiness, and at minimum one payer readiness for that market. Missing dimensions must be disclosed. | Market readiness is decomposed, not a single flag. |
| **No "multilingual" claim broader than verified language readiness.** If two languages are at L2 maturity and one is baseline, the claim is "3 supported languages (2 at intermediate localization level)" — not "multilingual platform." | Language readiness tracked per-language per-level. |
| **No "production ready" label if core proof gaps remain.** Production-eligible requires operational readiness evidence (monitoring, support, SLA), not just functional verification. | Production-eligible gate is separate from verified gate. |
| **No roadmap items presented as available capabilities.** "Planned," "in development," "declared," and "specified" capabilities must be clearly labeled as such on all surfaces. They must never appear alongside verified capabilities without visual distinction. | Surface design must distinguish readiness states visually. |
| **No pilot-scope proof presented as general availability.** If a capability was verified in a pilot with one facility and one payer, the claim must reflect that scope. "Generally available" requires broader proof. | Scope bounds are part of the readiness state. |

---

## 12. Activation vs claimability vs production eligibility

### 12.1 Five-level distinction

These five levels must not collapse into one status:

| Level | Meaning | Example |
|-------|---------|---------|
| **Present in code** | Code/config exists in the repo. | A VistA adapter for scheduling exists in `apps/control-plane/`. |
| **Technically activatable** | The code can be turned on in configuration without compilation errors. | An env var enables the scheduling module. |
| **Eligible for a given scope** | The capability passes eligibility checks for a specific tenant/facility/market. | Scheduling is eligible for US-market tenants with the scheduling module entitlement. |
| **Claimable** | The capability has been verified with evidence and governance review. Truthful public statements are authorized. | "VistA Evolved supports appointment scheduling via SDES RPCs for single-clinic US deployments." |
| **Production-eligible** | All functional, operational, compliance, and support gates are passed. Real-world deployment is authorized. | Scheduling has monitoring, alerting, support procedures, and has been approved for general availability. |

### 12.2 Collapse prevention

The following conflations are explicitly prohibited:

| Conflation | Why wrong |
|------------|-----------|
| "It's in the code, so list it on the website" | Present-in-code ≠ verified ≠ claimable |
| "We can turn it on, so offer it in onboarding" | Activatable ≠ eligible ≠ claimable |
| "It's eligible for one tenant, so offer it globally" | Eligibility is scoped, not universal |
| "We claimed it publicly, so it must be production-ready" | Claimable ≠ production-eligible |
| "It passed our dev test, so mark it verified" | Validated ≠ verified (verification requires representative environment and independent confirmation) |

---

## 13. Partial support and bounded proof rules

### 13.1 Supported partial-support labels

| Label | Meaning | Appropriate use |
|-------|---------|-----------------|
| **Pilot-only** | Verified for a specific pilot deployment with known boundaries. | Capability works for one known tenant/facility but has not been tested broadly. |
| **Single-payer** | Verified for one payer within a market. | "Philippine billing: PhilHealth verified. 14 other PH payers pending." |
| **Single-facility-type** | Verified for one facility topology. | "Appointment scheduling verified for single-clinic deployments." |
| **Single-lane** | Verified on one runtime lane only. | "Verified on UTF-8 lane. M-mode untested." |
| **Bounded-language** | Language support at a specific maturity level. | "Korean at L2 (core prompts translated); clinical content not yet translated." |
| **Partner-only** | Available to specific partners by arrangement. Not generally offered. | Early integrations with pre-selected deployment partners. |
| **Sandbox-only** | Available in sandbox/demo environments only. | Capabilities that work against test data but have no production evidence. |
| **Internal-only** | Not offered externally. Used for internal testing and development. | Pre-verification capabilities being exercised by the team. |

### 13.2 Bounded proof widening

Moving from a bounded scope to a broader scope requires **additional evidence for the broader scope**. The existing bounded proof does not automatically extend:

| Current state | Target state | Required for transition |
|--------------|-------------|------------------------|
| Verified for pilot (1 facility) | Verified for single-clinic topology | Additional facility verification |
| Verified for single-payer | Verified for multi-payer market | Additional per-payer verification evidence |
| Verified for UTF-8 lane | Verified for UTF-8 + M-mode | M-mode verification evidence from distro |
| Verified for English | Verified for English + Korean | Korean language readiness evidence at target maturity level |

Each widening step is an independent verification event with its own evidence requirements.

---

## 14. Dependency on packs, adapters, and runtime truth

### 14.1 Pack dependency

Some capabilities depend on one or more packs being in a specific state:

| Capability example | Required pack states |
|-------------------|---------------------|
| Philippine billing | `regulatory-philhealth-doh` (activated), `standards-ph` (activated), `payer-philhealth` (activated), `locale-ph` (activated) |
| Korean terminal localization | `lang-ko` (activated, distro L2+ maturity) |
| Cardiology order sets | `specialty-cardiology` (activated) |

If a required pack is deactivated or degrades in state, the capability's readiness degrades correspondingly (see Section 7.3).

### 14.2 Adapter dependency

Some capabilities depend on specific adapter availability:

| Capability example | Required adapter state |
|-------------------|----------------------|
| Philippine billing | PhilHealthConnector (external adapter, connected or sandbox mode) |
| VistA clinical reads | ClinicalEngineAdapter (VistA adapter, connected) |
| Lab results | LabInterfaceAdapter (external adapter, depends on lab system availability) |

If the required adapter falls back to stub (integration-pending), the capability's readiness cannot exceed "implemented" for that scope.

### 14.3 Runtime truth dependency

Some capabilities depend on runtime infrastructure states:

| Capability example | Required runtime truth |
|-------------------|----------------------|
| Terminal-based workflows | VistA container healthy + RPC broker reachable (5/5 readiness) |
| UTF-8 multilingual terminal | UTF-8 lane health verified by distro |
| Order entry | VistA RPC broker + relevant RPCs available in File 8994 |

Runtime truth is consumed from the distro repo's verified state. This spec does not re-verify runtime truth — it references it as an input.

### 14.4 Aggregation, not replacement

Capability readiness evaluation **aggregates** pack states + adapter states + runtime truth. It does not replace any of them. Each underlying truth source maintains its own governance:

- Pack states are governed by the pack-and-adapter spec.
- Adapter states are governed by the adapter contract model.
- Runtime truth is governed by the distro repo.

This spec governs the **aggregation logic** and the **resulting readiness state**.

---

## 15. Control-plane and provisioning implications

This section is conceptual. It defines what capability truth constrains in future control-plane implementation. It does not authorize building control-plane UI.

### 15.1 Signup and onboarding

When a prospective tenant initiates onboarding:

1. **Legal-market selection** presents only markets where at minimum language and regulatory readiness exist (even if payer readiness is partial).
2. **Module selection** presents only modules that are eligible and at minimum "validated" for the selected market and topology.
3. **Payer selection** (if applicable) presents only payers that are at minimum "validated" for the selected market. Unverified payers are labeled with their actual state.
4. **Non-eligible options are not shown.** The signup flow does not present capabilities that fail eligibility evaluation for the selected scope.

### 15.2 Tenant provisioning

When an operator provisions a new tenant:

1. **Pack activation** follows the pack governance spec's eligibility and dependency rules.
2. **Capability state for the new tenant** starts at the baseline readiness state for the activated pack configuration. It does not automatically inherit the proof from a different tenant or scope.
3. **Launch-tier assignment** reflects the actual readiness of the provisioned capability set. A newly provisioned tenant with pilot-verified capabilities starts at pilot tier, not general availability.

### 15.3 Legal-market constraints

Legal-market selection at onboarding time constrains all downstream pack and capability eligibility:

- Market-mandated packs (regulatory, national standards) are required and cannot be deactivated.
- Payer packs are filtered by market.
- Language packs are filtered by market relevance.
- Changing legal market after provisioning requires re-evaluation of all pack eligibility and capability readiness.

---

## 16. Tenant-admin implications

This section is conceptual. It does not authorize building tenant-admin UI.

### 16.1 Visibility rules

- Tenant admins see only capabilities that are eligible for their tenant's scope.
- Capabilities that are activated but partially supported are visibly labeled as partial (e.g., "1 of 3 payers active").
- Capabilities that are not eligible for the tenant's scope are not shown — they do not appear as "disabled" or "coming soon" options.

### 16.2 Activation constraints

- Tenant admins may activate/deactivate capabilities within their tenant's entitlement.
- Activation is gated by eligibility (Section 11 of the pack spec) and readiness (this spec).
- Tenant admins cannot activate a capability that has not reached "validated" for their scope, unless the tenant is explicitly designated as a pilot with appropriate labeling.

### 16.3 Tenant-admin does not set truth

Tenant-admin actions (activation, deactivation, configuration) change the **operational state** of a capability for that tenant. They do not change the **readiness state** of the capability itself. Readiness is governed by evidence, not by operator preference.

---

## 17. Public website, sales, and roadmap implications

This section is conceptual. It does not authorize building website features.

### 17.1 Website claim rules

- Feature pages list only capabilities at "claimable" or higher.
- Country pages decompose readiness by dimension (language, regulatory, payer, standards). No single "country-ready" badge without dimensional proof.
- Payer pages list payers with their actual readiness state (verified, validated, pilot-only, planned).
- Specialty pages list specialties at their actual content coverage level.

### 17.2 Sales and partnership materials

- Decks must distinguish "verified and available" from "planned and in development."
- Pilot-only capabilities must be labeled as pilot-only, not generalized.
- Partner-specific capabilities must be labeled as partner-specific.
- Roadmap items must be visually distinct from verified capabilities.

### 17.3 Roadmap is not truth

Internal and external roadmaps describe intent and planning. They are valuable for communication but have zero weight in capability readiness evaluation. A capability on the roadmap is "declared" at best. Roadmap presence does not advance readiness state.

---

## 18. Safety and anti-drift constraints

| Constraint | Rationale |
|------------|-----------|
| **Repo files and evidence govern truth, not memory.** Readiness state is determined by evidence recorded in `artifacts/` and governed state in capability manifests. Not by what someone remembers or believes. | Prevent drift between what is real and what is claimed. |
| **No hidden upgrades of readiness state.** Every state transition must be recorded with evidence, timestamp, scope, and actor. Silent transitions are prohibited. | Audit trail for governance. |
| **No manual doc drift away from evidence.** Documentation (including website copy) that asserts a readiness level must be traceable to the governed readiness state. Free-form edits that outpace evidence are prohibited. | Prevent marketing-driven truth inflation. |
| **No extra verification scripts unless explicitly authorized.** New verification machinery requires governance review. Ad-hoc scripts that assert readiness without governance integration are not valid evidence sources. | Prevent shadow verification processes. |
| **One slice at a time.** Readiness advancement follows the governed build protocol: one capability, one scope, one state transition at a time, with proof and review. | Prevent batch-optimism where multiple capabilities are batch-advanced without individual proof. |
| **Human review at critical gates.** Transitions to "claimable" and to "production-eligible" require explicit human review. Automated pipelines may advance to "verified" but not beyond. | Prevent automation from outpacing governance. |
| **Degradation is immediate, not deferred.** If evidence is invalidated (test failure, pack deactivation, infrastructure change), the readiness state degrades immediately. There is no "let's discuss it later" state. | Prevent stale claims during outages or regressions. |
| **Scope is immutable in historical evidence.** Past verification evidence retains its original scope bounds. Reinterpretation of historical evidence to claim a broader scope is prohibited. New scope requires new evidence. | Prevent retroactive scope widening. |

---

## 19. Resolved now vs deferred later

### 19.1 Resolved by this document

| Question | Resolution | Section |
|----------|-----------|---------|
| What readiness states exist? | 9 states: declared → specified → implemented → validated → verified → claimable → production-eligible → deprecated → retired | 7 |
| What evidence is required for each transition? | 8 evidence classes with per-transition requirements | 8 |
| What scope dimensions affect truth? | 10 dimensions: runtime lane, language, locale, legal market, payer, specialty, facility type, tenant type, environment, launch tier | 9 |
| What surfaces consume capability claims? | 8 surfaces: website, sales, onboarding, control-plane, tenant-admin, roadmap, support docs, Notion | 10 |
| What gating rules prevent overclaiming? | 8 non-negotiable rules | 11 |
| How are activation, claimability, and production eligibility distinguished? | 5-level model with explicit collapse prevention | 12 |
| How is partial support represented? | 8 bounded-proof labels with widening rules | 13 |
| How do packs, adapters, and runtime truth feed into capability readiness? | Aggregation model with per-source dependency rules | 14 |
| How does this constrain control-plane, tenant-admin, and public surfaces? | Conceptual constraints defined for each (Sections 15, 16, 17) |
| What safety constraints prevent drift? | 8 anti-drift constraints | 18 |

### 19.2 Deferred to subsequent artifacts

| Question | Deferred to |
|----------|-------------|
| What is the capability manifest JSON Schema? | Contract work in `packages/contracts/schemas/` |
| What is the readiness registry database schema? | Future schema specification |
| What are the API endpoints for readiness queries? | OpenAPI contract work |
| What dashboards display readiness state? | Future UI work (not authorized) |
| How is the website populated from readiness state? | Future website implementation |
| How does the signup flow consume eligibility? | Future control-plane implementation |
| How does tenant-admin UI display partial support? | Future admin-console implementation |
| How are state transitions automated in CI/CD? | Future pipeline implementation |
| How is the country/payer readiness registry structured? | Country and payer readiness registry spec (global architecture Section 20, item 4) |
| How does partner certification evidence feed into the pipeline? | Future process specification |

---

## 20. Parent handoff cross-reference

The pack-and-adapter architecture governance spec Section 23 specified seven items this spec must address:

| Required item | Where addressed |
|---------------|----------------|
| 1. Capability manifest schema and structure | Conceptual model in Sections 5, 6, 7. Concrete schema deferred to `packages/contracts/schemas/`. |
| 2. Capability state machine: declared → built → tested → verified → claimable | Section 7 (9-state model, refined from the 5-state handoff). |
| 3. Evidence model: what constitutes proof at each state transition | Section 8 (8 evidence classes + per-transition requirements). |
| 4. Claim-gating evaluation logic: when is a capability claimable for a scope | Sections 9, 11, 12 (scope dimensions + gating rules + 5-level distinction). |
| 5. Capability degradation: how capability state responds to pack/adapter status changes | Section 7.3 (reversible transitions), Section 14 (dependency-driven degradation). |
| 6. Capability registry and reporting: how operators see capability status across scopes | Section 10 (claim surfaces), Sections 15–17 (surface-specific implications). Concrete registry deferred to schema/API work. |
| 7. Integration with the governed build protocol: how capability truth aligns with one-slice-at-a-time delivery | Section 18 (one-slice-at-a-time constraint), Section 7.4 (human review gates at critical transitions). |

---

## 21. Next artifact handoff

### What this spec resolves for the next artifact

The next planned artifact is **Country and Payer Readiness Registry Specification** (`docs/explanation/country-and-payer-readiness-registry-spec.md`), as specified in the global architecture backbone Section 20, item 4.

This current document provides:

- **Readiness state model** that country and payer readiness entries must conform to (Section 7).
- **Scope dimensions** that decompose country readiness into independently tracked dimensions (Section 9).
- **Evidence requirements** that readiness claims must satisfy (Section 8).
- **Claim-gating rules** that connect readiness state to public surfaces (Section 11).
- **Market readiness definition** as a composite of dimensional readiness, not a single flag (Section 5).
- **Payer readiness definition** as per-payer, not per-market (Section 5).
- **Partial-support rules** that govern how bounded readiness is represented (Section 13).

### What the next spec must address

The country and payer readiness registry spec must define:

1. Registry structure for tracking country/legal-market readiness dimensions.
2. Per-payer readiness tracking within each market.
3. How language readiness (distro-canonical) feeds into market readiness (platform-governed).
4. How regulatory and standards pack states map to market readiness dimensions.
5. Launch-tier assignment criteria for each market.
6. How partial readiness is reported per dimension and per market.
7. How the registry integrates with control-plane provisioning and onboarding.

!!! warning "Sequencing discipline"
    The next artifact must be authored, reviewed, and accepted before subsequent artifacts begin. Do not batch-generate the full specification sequence.

---

## 22. Explicit out-of-scope — not authorized by this document

| Item | Status |
|------|--------|
| Capability manifest JSON Schema | Deferred to `packages/contracts/schemas/` |
| Readiness registry database schema | Deferred to future schema specification |
| Readiness query API endpoints | Deferred to OpenAPI contract work |
| Readiness dashboard UI | Not authorized (global architecture Section 19) |
| Public website implementation | Not authorized |
| Signup flow implementation | Not authorized |
| Control-plane UI implementation | Not authorized (global architecture Section 19) |
| Tenant-admin UI implementation | Not authorized (global architecture Section 19) |
| Automated state-transition pipelines | Not authorized |
| Partner certification workflow | Not authorized |
| Country-readiness claims for any specific market | Not authorized (requires proof through capability pipeline) |
| Production deployment of readiness-management features | Not authorized |
