# Country and Payer Readiness Registry — Architecture and Governance Specification

> **Artifact:** `docs/explanation/country-and-payer-readiness-registry-spec.md`
> **Repo:** `vista-evolved-platform`
> **Namespace:** VE-PLAT
> **Status:** Accepted — architecture and governance specification (no implementation)
> **Date:** 2025-07-19

---

## 1. Purpose and position in the architecture sequence

This specification defines how VistA Evolved represents, tracks, and governs
**country / legal-market readiness** and **per-payer readiness** as structured,
evidence-backed registry concepts within the platform's architecture.

### 1.1 Position in the sequence

This is the **fifth** artifact in the global system architecture sequence defined
in the Global System Architecture Specification, Section 20:

1. Global System Architecture Specification — accepted
2. Organization, Facility, Network, and Service Model — accepted
3. Pack and Adapter Architecture Governance — accepted
4. Capability Truth and Claim-Gating Specification — accepted
5. **Country and Payer Readiness Registry Specification — this document**
6. Specialty, Content, and Analytics Architecture — next

### 1.2 What this specification does

- Defines the canonical model for country / legal-market readiness as a
  **composite of dimensional readiness**, never a single boolean flag.
- Defines the canonical model for payer readiness as a **per-payer concept**,
  scoped within a legal market but not reducible to market readiness.
- Defines the **launch-tier model** that translates readiness assessments into
  safe external claims about what the system supports.
- Defines how these registry concepts integrate with the readiness-state model,
  evidence classes, claim surfaces, and claim-gating rules established in the
  Capability Truth and Claim-Gating Specification.
- Establishes the safety and anti-drift constraints that prevent overclaiming.

### 1.3 What this specification does NOT do

- Define schemas, APIs, database tables, or UI wireframes (those are future
  implementation artifacts governed by this spec).
- Replace or duplicate the capability truth model — it extends and applies that
  model to the market/payer domain.
- Create new readiness states or evidence classes — it uses the existing ones
  from the Capability Truth spec.

---

## 2. Relationship to parent specifications

This specification is a direct child of four parent artifacts:

| Parent | What this spec inherits |
|--------|------------------------|
| Global System Architecture Specification | Country readiness as composite dimensions (Section 9), pack taxonomy (Section 10), control-plane vs tenant-admin boundary (Section 12), launch tiers (Section 13) |
| Organization, Facility, Network, and Service Model | Payer/program/sponsor entity relationships (Section 11), legal entity to facility chain, provisioning implications (Section 15) |
| Pack and Adapter Architecture Governance | Pack categories feeding readiness (Section 6), pack eligibility evaluation (Section 11), pack lifecycle states (Section 12), adapter selection (Section 16) |
| Capability Truth and Claim-Gating Specification | 9-state readiness model (Section 5), 10 scope dimensions (Section 9), evidence classes (Section 8), claim surfaces (Section 11), claim-gating rules (Section 11), partial-support labels (Section 14), handoff items 1–7 (Section 21) |

### 2.1 Handoff items from Capability Truth Section 21

This specification fulfills all seven handoff items:

| # | Handoff item | Addressed in |
|---|-------------|-------------|
| 1 | Registry structure for country / legal-market readiness dimensions | Section 7 |
| 2 | Per-payer readiness tracking | Section 8 |
| 3 | Language readiness (distro → platform) feeding | Section 11 |
| 4 | Regulatory / standards pack → market readiness mapping | Sections 7, 9 |
| 5 | Launch-tier assignment criteria | Section 12 |
| 6 | Partial readiness reporting per dimension / market | Section 13 |
| 7 | Registry → control-plane provisioning / onboarding integration | Section 15 |

---

## 3. Goals

1. **Decompose market readiness into governed dimensions.** A market is never
   "ready" or "not ready" as a whole. Each dimension (language, regulatory,
   standards/terminology, payer connectivity, provisioning) has its own
   readiness state, evidence, and lifecycle.

2. **Separate payer readiness from market readiness.** Payer readiness is
   per-payer, scoped within a legal market. A market can have partial payer
   coverage — some payers connected and verified, others pending.

3. **Ground launch tiers in dimensional evidence.** A launch tier (e.g.,
   "general availability" versus "limited pilot") is assigned based on
   which dimensions are verified, not by assertion.

4. **Integrate with the existing readiness-state model.** Each dimension
   uses the same 9-state lifecycle (declared → retired) and the same
   evidence classes defined in the Capability Truth spec. No new state
   machines or evidence types.

5. **Prevent overclaiming.** No external claim surface (marketing, sales
   dashboard, system-of-record badge, provisioning eligibility) may assert
   readiness that exceeds verified evidence. The registry enforces this
   through gating rules.

6. **Feed provisioning and onboarding.** The control plane uses registry
   data to determine which packs to offer, which adapters to wire, and
   which tenant configurations to pre-populate during onboarding for a
   given legal market.

---

## 4. Anti-goals and forbidden drift

1. **No single "country-ready" flag.** Any design that reduces market
   readiness to a single boolean violates this spec. Readiness is always
   dimensional.

2. **No payer readiness inherited from market readiness.** A market being
   "language-ready" does not make any payer in that market "payer-ready."
   They are separate registrations with separate evidence.

3. **No readiness by assertion.** Readiness is never declared by a
   product manager editing a marketing page. It is declared (state:
   `declared`) and then must progress through the state machine with
   evidence at each transition.

4. **No readiness without runtime truth.** A dimension cannot reach
   `verified` without evidence that includes runtime proof from a live
   Docker lane (for distro-owned dimensions) or live API proof (for
   platform-owned dimensions).

5. **No conflation of language readiness with country readiness.**
   Korean language support at L2 does not mean "South Korea market ready."
   Language is one dimension of market readiness.

6. **No speculative market entries.** Do not register a market (legal
   market + dimensions) in the registry until at least one dimension
   has reached `declared` state with a named owner.

7. **No implementation in this document.** Schemas, APIs, and UI for
   the registry are future artifacts. This spec governs their design.

8. **No new readiness states or evidence classes.** Use the 9 states
   and the evidence class hierarchy from the Capability Truth spec.

---

## 5. Canonical definitions

| Term | Definition |
|------|-----------|
| **Legal market** | A jurisdiction or regulatory boundary within which a specific set of laws, standards, payer systems, and clinical conventions apply. Examples: United States, Republic of Korea, Republic of the Philippines. A legal market is identified by ISO 3166-1 alpha-2 code. |
| **Market readiness** | The composite state of dimensional readiness for a specific legal market. It is never a single value — it is always the vector of all dimension readiness states for that market. |
| **Market-readiness dimension** | One axis of readiness for a legal market. Each dimension has an independent readiness state, an assigned owner (distro or platform), and evidence requirements. See Section 7.2 for the full table. |
| **Payer readiness** | The readiness state of the platform's integration with a specific payer or payer-like entity within a legal market. Scoped per-payer, never per-market. |
| **Payer** | An entity that adjudicates and pays claims within a legal market. May be a commercial insurer, a government program (e.g., PhilHealth, Medicare), an HMO, or a self-funded employer plan. |
| **Launch tier** | A named level of external readiness assertion for a legal market. Assigned based on which dimensions meet threshold criteria. See Section 12.1. |
| **Readiness state** | One of the 9 states from the Capability Truth spec: declared, specified, implemented, validated, verified, claimable, production-eligible, deprecated, retired. Applied per-dimension or per-payer. |
| **Evidence class** | A type of proof used to justify readiness-state transitions. Hierarchy from the Capability Truth spec: runtime-proof > integration-test > configuration-verified > spec-reviewed > declared-intent. |
| **Registry** | The structured, versioned data store that records all market-readiness dimensions, payer-readiness entries, and their states. Implementation deferred; this spec governs its architecture. |
| **Country pack** | Informal shorthand for the bundle of packs (language, regulatory, locale, national-standards, payer) that collectively address a legal market. Not a single artifact — it is a composition. |
| **Bounded product language** | A language that has active pack development and is part of the product's language commitment. Currently: English (baseline), Korean, Spanish (per VE-DISTRO-ADR-0003). |
| **Language readiness** | The readiness state of language support for a specific language code (ISO 639-1). Owned by the distro for runtime execution; governed by the platform for registry and claim purposes. Measured by the L0–L5 level scale from the distro's PACK-SPEC. |
| **Partial readiness** | A state in which some dimensions of market readiness or some aspects of payer readiness have reached `verified` or higher while others have not. Governed by the partial-support labels from the Capability Truth spec. |
| **Provisioning eligibility** | Whether the control plane may offer a legal market as a selectable option during tenant onboarding. Gated by launch-tier thresholds. |
| **Dimensional evidence** | Evidence scoped to a specific readiness dimension (e.g., "regulatory compliance reviewed by legal" or "payer connector integration-tested with sandbox"). |

---

## 6. What the registry is and is not

### 6.1 What it is

The country and payer readiness registry is a **governed data structure** that:

- Records the readiness state of every active market-readiness dimension for
  every registered legal market.
- Records the readiness state of every registered payer within each legal
  market.
- Tracks evidence references (not evidence itself) for each state transition.
- Feeds launch-tier assignment logic.
- Feeds control-plane provisioning and onboarding workflows.
- Is queryable by both control-plane admin tooling and governance automation.

### 6.2 What it is not

- Not a product catalog. It does not list features or capabilities.
- Not a pricing or licensing construct. Launch tiers are readiness tiers,
  not commercial tiers.
- Not a deployment manifest. It informs provisioning but does not perform it.
- Not a duplicate of the capability truth registry. The capability registry
  tracks individual capabilities; this registry tracks the composite readiness
  of markets and payers that depend on those capabilities.

### 6.3 Ownership

The registry data is platform-owned (per the data ownership matrix). The
control plane is the authoritative writer. The tenant admin is a reader
(it can display readiness status but cannot modify registry entries).

---

## 7. Country / legal-market readiness model

### 7.1 Why country readiness is composite, not a flag

The Global System Architecture Specification (Section 9) establishes that
country readiness is decomposed into independent dimensions:

> "Country readiness is decomposed into language, regulatory, payer, and
> provisioning dimensions. It is not a single flag."

The reason is structural: the artifacts required to serve a legal market span
multiple repos, multiple pack categories, multiple adapter types, and multiple
evidence chains. A language pack reaching L2 in Korean does not prove regulatory
compliance for South Korea. A regulatory review passing does not prove payer
connectivity. Each dimension progresses independently.

### 7.2 Market-readiness dimensions

| Dimension | Description | Owner | Evidence type | Pack/adapter dependency |
|-----------|------------|-------|---------------|----------------------|
| **Language** | Terminal and UI can operate in the market's required language(s). Measured by the L0–L5 scale. | Distro (runtime) / Platform (registry) | Runtime proof: dialog display, formatting output, menu translation in live container | Language pack (distro `overlay/l10n/<iso2>/`) |
| **Locale** | Date, time, number, currency, and ordinal formatting follow local conventions. | Distro (runtime) / Platform (registry) | Runtime proof: formatting node output matches locale rules | Locale pack (part of language pack in distro, potentially separate in platform) |
| **Regulatory** | Clinical, billing, and operational rules comply with the market's regulatory framework. | Platform | Spec-reviewed (legal/compliance review) + configuration-verified (rules engine configuration) | Regulatory pack |
| **National standards** | Terminology (ICD, CPT, SNOMED, local equivalents), data exchange formats (HL7 country profile, FHIR profile), and coding systems are supported. | Platform | Configuration-verified (terminology loaded) + integration-test (round-trip encoding) | National-standards pack |
| **Payer connectivity** | At least one payer in the market has reached `verified` payer readiness. This is a derived dimension — see Section 8. | Platform | Derived from payer-readiness entries | Payer pack(s) + clearinghouse/payer adapter(s) |
| **Provisioning** | The control plane can onboard a tenant in this market: correct pack composition, adapter wiring, default configuration. | Platform | Integration-test (onboarding flow exercised end-to-end in staging) | Control-plane provisioning logic |
| **Data residency** | Data storage and processing comply with the market's data sovereignty requirements. | Platform | Configuration-verified (infrastructure audit) | Infrastructure configuration (not a pack) |
| **Clinical workflow** | Clinical workflows (orders, notes, medications, scheduling) function correctly under the market's conventions. | Platform | Integration-test (clinical workflows exercised with market-specific data) | Clinical-engine adapter + market-specific configuration |

### 7.3 Dimension interactions

Dimensions are independently tracked but not fully independent in practice:

- **Language depends on runtime lane.** Language readiness at L1+ requires
  that the distro's UTF-8 lane (VE-DISTRO-ADR-0003) is operational. This is
  a prerequisite, not a dimension itself.
- **Payer connectivity is derived.** It reflects whether at least one payer in
  the market has reached `verified`. It is not independently set.
- **Regulatory may gate other dimensions.** In some markets, clinical workflows
  or national standards cannot be `claimable` until regulatory compliance
  reaches at least `specified`.
- **Provisioning depends on all other dimensions.** A market cannot reach
  provisioning `verified` unless every other dimension has reached at least
  `implemented`.

---

## 8. Payer readiness model

### 8.1 Why payer readiness is per-payer, not per-market

The Global System Architecture Specification (Section 9) and the Organization,
Facility, Network, and Service Model (Section 11) establish that:

- Payers are entities, not attributes of a country.
- A legal market contains zero or more payers.
- Each payer has its own integration requirements, API contracts, credential
  requirements, test environments, and certification timelines.
- A market can have partial payer coverage: some payers connected and verified,
  others not yet integrated.

Therefore, payer readiness is tracked per payer (identified by a payer
registry key), scoped within a legal market (identified by ISO 3166-1).

### 8.2 Payer-readiness scope

| Scope | Description | Owner | Evidence type |
|-------|-------------|-------|---------------|
| **Connector** | A payer adapter/connector exists and can communicate with the payer's system (API, EDI gateway, portal). | Platform | Integration-test (round-trip message exchange with payer sandbox/test environment) |
| **Eligibility** | The platform can verify patient eligibility with this payer. | Platform | Integration-test (270/271 or equivalent verified) |
| **Claims submission** | The platform can submit claims to this payer and receive acknowledgment. | Platform | Integration-test (837 or equivalent submitted and 999/TA1 received) |
| **Remittance** | The platform can receive and parse remittance/EOB from this payer. | Platform | Integration-test (835 or equivalent received and parsed correctly) |
| **Prior authorization** | The platform can submit and track prior-auth requests with this payer. | Platform | Integration-test (278 or equivalent round-trip) |
| **Real-time adjudication** | The platform can receive real-time adjudication responses (where the payer supports it). | Platform | Integration-test (real-time response received and parsed) |

Each scope progresses independently through the 9-state readiness lifecycle.
A payer may have claims submission at `verified` while prior-authorization
is still at `declared`.

### 8.3 Payer lifecycle

A payer registration progresses through these effective states (mapped to
the readiness-state model):

| Effective state | Readiness states | Meaning |
|----------------|-----------------|---------|
| **Registered** | At least one scope is `declared` | Payer is known; integration work is planned |
| **In development** | At least one scope is `implemented` | Connector code exists; not yet tested against payer |
| **Sandbox-verified** | At least one scope is `verified` | Tested against payer's sandbox/test environment |
| **Production-eligible** | At least one scope is `production-eligible` | Passed all payer certification requirements |
| **Active** | At least one scope is `production-eligible` AND the payer's legal market has launch tier ≥ `limited-ga` | Claims are flowing in production |

---

## 9. Readiness dimensions per market

### 9.1 How dimensions compose

For a given legal market, the registry holds one readiness-state entry per
dimension from the Section 7.2 table. The market's overall readiness is the
**vector** of these entries — there is no rollup into a single state.

Example for a hypothetical "Republic of Korea" registry entry:

| Dimension | Readiness state | Evidence | Notes |
|-----------|----------------|----------|-------|
| Language | verified | Runtime proof: Korean L2 dialogs, L2 formatting in UTF-8 container | Korean language pack at L2 |
| Locale | verified | Runtime proof: YYYY-MM-DD dates, Korean ordinals | Part of Korean language pack |
| Regulatory | specified | Spec-reviewed: MOHW regulatory gap analysis completed | Regulatory pack not yet implemented |
| National standards | declared | Declared-intent: KCD-8, EDI standards scoped | Standards pack not yet started |
| Payer connectivity | none | No payers registered for this market | — |
| Provisioning | declared | Declared-intent: onboarding flow scoped | — |
| Data residency | declared | Declared-intent: KR data residency requirements documented | — |
| Clinical workflow | declared | Declared-intent: KR clinical conventions scoped | — |

This market's launch tier (Section 12) would be `exploratory` because no
dimension has reached `production-eligible` and most are at `declared`.

### 9.2 Dimension precedence and dependency

No dimension blocks another from independently advancing through the state
machine, except:

1. **Provisioning cannot reach `verified`** unless all other dimensions
   have reached at least `implemented`.
2. **Payer connectivity is derived** from payer-readiness entries — it
   cannot be manually set.
3. **Language requires distro UTF-8 lane** — the dimension cannot advance
   past `declared` if the distro's UTF-8 lane is not at least runtime-ready
   (5/5 healthcheck pass per distro's runtime-readiness-levels model).

These are structural constraints, not policy preferences. They reflect
genuine technical dependencies.

---

## 10. Evidence and readiness-state integration

### 10.1 How the 9-state readiness model applies

Each market-readiness dimension and each payer-readiness scope uses the
same 9-state lifecycle from the Capability Truth spec:

```
declared → specified → implemented → validated → verified → claimable → production-eligible → deprecated → retired
```

The transition rules from the Capability Truth spec (Section 7.3) apply
without modification:

- Forward transitions require evidence of the appropriate class.
- Backward transitions (regression) require explicit reasoning and
  create an audit entry.
- Skip transitions are forbidden (cannot jump from `declared` to
  `verified`).
- `deprecated` and `retired` are terminal-path states.

### 10.2 Evidence classes per dimension

| Dimension | Minimum evidence for `verified` | Minimum evidence for `production-eligible` |
|-----------|-------------------------------|------------------------------------------|
| Language | Runtime proof: L2+ dialog/formatting test output from live UTF-8 container | Runtime proof + integration-test: full L3+ menu translation verified in staging |
| Locale | Runtime proof: formatting output matches locale rules in live container | Runtime proof: verified in staging with real patient/date data flowing |
| Regulatory | Spec-reviewed: legal/compliance sign-off on regulatory gap analysis | Spec-reviewed: legal sign-off on no remaining gaps |
| National standards | Integration-test: terminology round-trip encoding verified | Integration-test + runtime proof: clinical data flows use correct codes in staging |
| Payer connectivity | (Derived from payer entries) | (Derived from payer entries) |
| Provisioning | Integration-test: onboarding flow exercised end-to-end in staging | Integration-test: onboarding exercised with real tenant in pre-production |
| Data residency | Configuration-verified: infrastructure audit confirms compliance | Configuration-verified: production infrastructure audit |
| Clinical workflow | Integration-test: clinical workflows pass with market-specific test data | Integration-test + runtime proof: clinical workflows verified in staging |

---

## 11. Country vs payer vs language vs runtime-lane relationships

### 11.1 Why language readiness ≠ country readiness

Language readiness and country readiness exist at different levels of
abstraction:

- **Language readiness** is per-language (ISO 639-1). Korean (ko) is a
  language. It has a readiness state measured by the L0–L5 scale.
- **Country readiness** is per-legal-market (ISO 3166-1). Republic of Korea
  (KR) is a legal market. It has eight readiness dimensions, of which language
  is one.

The same language may serve multiple markets (Spanish serves US, PH, ES, MX,
etc.). The same market may require multiple languages (Philippines may need
English and Filipino).

A language reaching L5 contributes to the language dimension of every market
that uses that language. But it does not advance any other dimension.

### 11.2 How distro L0–L5 feeds platform readiness

The distro repo owns runtime language execution. The platform repo owns
the readiness registry. The feeding relationship is:

| Distro state | Platform language-dimension state | Evidence required at boundary |
|-------------|--------------------------------|------------------------------|
| L0 (UTF-8 Safe) | `implemented` at most | UTF-8 lane passes healthcheck |
| L1 (Locale-Formatted) | `validated` at most | Formatting node output verified in test |
| L2 (Core Prompt Translated) | `verified` | Runtime proof: dialog display + formatting in live container |
| L3 (Menu Translated) | `verified` (higher coverage) | Runtime proof: menu translation verified in live container |
| L4 (FileMan Localized) | `verified` (comprehensive) | Runtime proof: field labels, help text verified |
| L5 (Package Localized) | `production-eligible` candidate | Runtime proof + integration-test: package-level text verified |

The platform never asserts a language dimension state higher than what the
distro's runtime evidence supports. The distro's PACK-SPEC manifest
(`coverage` field) is the authoritative input.

### 11.3 Runtime lane dependencies

Language readiness at L1+ requires the distro's UTF-8 lane to be
operational. Specifically:

- **VE-DISTRO-ADR-0003** establishes UTF-8 as the primary planned operator
  lane.
- The distro's runtime-readiness model (5 levels: CONTAINER_STARTED through
  RPC_READY) must show full pass for the UTF-8 lane.
- If the UTF-8 lane regresses (e.g., a healthcheck fails after an upstream
  update), the language dimension for all languages that require UTF-8
  encoding must be reviewed for potential state regression.

This is a cross-repo dependency. The platform's registry records the
dependency but cannot enforce it — the distro's healthcheck scripts are
the enforcement mechanism.

---

## 12. Launch-tier model

### 12.1 Launch-tier definitions

| Tier | Name | Criteria | Claim scope |
|------|------|----------|-------------|
| **T0** | Exploratory | At least one dimension is `declared` or `specified`. No dimension is `verified`. | Internal only. No external claims. Not visible in sales/marketing. |
| **T1** | Limited pilot | At least language and one other dimension are `verified`. No payer is `production-eligible`. | Named-pilot customers only. "Early access" label permitted. Not in general sales materials. |
| **T2** | Limited GA | Language, locale, and regulatory are `verified`. At least one payer is `production-eligible`. Provisioning is `verified`. | General availability with geographic scope qualifier. "Available in [market] with [payer list]" claim permitted. |
| **T3** | General availability | All dimensions except data residency are `verified` or `production-eligible`. Multiple payers are `production-eligible`. | Unrestricted market claim. "[Market] fully supported" claim permitted. |

### 12.2 Launch-tier assignment criteria

Launch tiers are **assigned**, not self-declared:

1. The control plane evaluates the dimension vector for each registered
   legal market.
2. The highest tier whose criteria are fully met is the assigned tier.
3. Tier assignment is recalculated whenever any dimension state changes.
4. Tier assignment is recorded in the registry with a timestamp and the
   dimension snapshot that justified it.

Tiers are monotonically non-decreasing in normal operation. A tier can
regress only if a dimension regresses (which requires explicit reasoning
per the state-transition rules).

### 12.3 Launch-tier → claim-surface mapping

| Tier | System-of-record badge | Sales dashboard | Marketing page | Provisioning eligible | Tenant admin visible |
|------|----------------------|-----------------|----------------|----------------------|---------------------|
| T0 | No | No | No | No | No |
| T1 | "Pilot" | "Early access" | No | Named tenants only | "Pilot" label |
| T2 | "Available" | "Available in [market]" | Yes, with scope qualifier | Yes | "Available" label |
| T3 | "GA" | "GA" | Yes, unrestricted | Yes | "Supported" label |

---

## 13. Partial readiness and bounded-support rules

### 13.1 Bounded-support examples

| Market | Dimension that is ready | Dimension that is NOT ready | Partial-support label | External claim |
|--------|------------------------|----------------------------|----------------------|----------------|
| Philippines (PH) | Language (en, L5), Payer (PhilHealth verified) | Regulatory (specified), Data residency (declared) | `market-partial-regulatory-pending` | "PhilHealth claims supported. Regulatory review in progress." |
| Republic of Korea (KR) | Language (ko, L2), Locale (ko, verified) | All others (declared or specified) | `market-partial-language-only` | No external claim. Internal pilot only. |
| United States (US) | Language (en, L5), Regulatory (verified), Standards (verified) | Payer (3 of 12 target payers verified) | `market-partial-payer-coverage` | "Available for [3 named payers]. Additional payer integrations in progress." |
| US — specific payer | Connector (verified), Eligibility (verified) | Claims (implemented), Remittance (declared) | `payer-partial-eligibility-only` | "Eligibility verification available. Claims submission in development." |
| Philippines — HMO | Connector (implemented) | All other scopes (declared) | `payer-partial-connector-dev` | No external claim. |
| South Korea — NHIS | No scopes beyond declared | — | `payer-registered-only` | No external claim. |

### 13.2 How partial readiness affects claims

The claim-gating rules from the Capability Truth spec (Section 11) apply:

1. **No claim without verified evidence.** A market cannot be claimed as
   "supported" on any claim surface unless the launch tier is at least T2.
2. **Partial claims must be scoped.** If payer coverage is partial, the
   claim must name the specific payers that are verified. "All payers in
   [market] supported" requires all registered payers at `production-eligible`.
3. **Dimension-level claims must match dimension state.** "Korean language
   supported" requires the language dimension for KR to be at least `verified`
   (Korean L2+ with runtime proof).
4. **Payer-level claims must match payer scope states.** "Claims submission
   with [payer]" requires the claims-submission scope for that payer to be
   at least `verified`.
5. **No implicit readiness.** If a dimension or payer scope has no entry in
   the registry, its state is `undeclared` (not even `declared`) and no
   claim of any kind is permitted.

---

## 14. Claim surfaces and gating for market / payer

### 14.1 Which claim surfaces apply

The eight claim surfaces from the Capability Truth spec all apply to market
and payer readiness:

| Claim surface | Market/payer applicability |
|--------------|--------------------------|
| **Capability registry** | Reflects dimensional readiness per market and per-payer readiness |
| **System-of-record badge** | Displays launch tier per market |
| **Sales dashboard** | Shows market list filtered by launch tier ≥ T1 |
| **Marketing / public site** | Shows market list filtered by launch tier ≥ T2 |
| **Provisioning eligibility** | Control plane uses launch tier to gate market selection during onboarding |
| **Tenant admin config** | Displays available markets and payers for the tenant's legal market |
| **API / contract surface** | Capability endpoint includes market and payer readiness data |
| **Roadmap / public roadmap** | May show markets at T0 with "planned" label only |

### 14.2 Market/payer-specific gating rules

In addition to the eight general claim-gating rules from the Capability Truth
spec, the following market/payer-specific rules apply:

1. **Market claim requires launch tier.** No market may appear on any external
   claim surface without an assigned launch tier ≥ T1.
2. **Payer claim requires payer state.** No payer may be named on any external
   claim surface unless at least one payer-readiness scope is `verified`.
3. **Geographic qualifier required below T3.** Markets at T1 or T2 must include
   a geographic scope qualifier in all external claims (e.g., "Available in
   the Philippines for PhilHealth").
4. **Payer list required for partial coverage.** If not all payers in a market
   are `production-eligible`, external claims must enumerate the verified payers.
5. **Language claim requires runtime proof.** A claim that the system supports
   a language in a market requires the language dimension to be `verified` with
   runtime proof from the distro.
6. **Regulatory claim requires legal sign-off.** Any claim about regulatory
   compliance in a market requires the regulatory dimension to have evidence
   of class `spec-reviewed` with legal/compliance attribution.

---

## 15. Control-plane and provisioning implications

### 15.1 Market selection during onboarding

When the control plane provisions a new tenant, it must:

1. Present only markets at launch tier ≥ T2 as generally available options.
2. Present markets at T1 only if the tenant is in the named-pilot list.
3. Not present markets at T0 at all.
4. For the selected market, auto-resolve the pack composition:
   - Language pack(s) for the market's language(s)
   - Locale pack for the market's formatting conventions
   - Regulatory pack for the market's regulatory framework
   - National-standards pack for the market's terminology
   - Payer pack(s) for each `production-eligible` payer in the market

### 15.2 Adapter wiring

The control plane uses registry data to wire adapters during provisioning:

- If the market has a clearinghouse adapter for payer connectivity, wire it.
- If the market uses a direct-payer adapter (e.g., PhilHealth eClaims API),
  wire the market-specific connector.
- If no payer adapter is available, wire the stub adapter and mark the
  payer-connectivity dimension as `integration-pending`.

### 15.3 Ongoing registry reads

After provisioning, the tenant admin reads registry data to display:

- Which payers the tenant can use for claims submission.
- Which language options are available for the tenant's market.
- Which dimensions are pending (with `integration-pending` labels visible
  to the admin, not to end users).

---

## 16. Tenant-admin implications

### 16.1 What the tenant admin can see

- The readiness state of each dimension for the tenant's legal market.
- The list of payers available in the tenant's market, with their
  payer-readiness states per scope.
- The launch tier of the tenant's market.
- Labels indicating which capabilities are `integration-pending` (partial
  readiness).

### 16.2 What the tenant admin cannot do

- Modify registry entries. The registry is control-plane-owned.
- Override payer readiness. A tenant cannot claim a payer is "verified" if
  the registry says otherwise.
- Select a market that is below the launch-tier threshold for their
  tenant type.

### 16.3 Tenant-specific overrides

The control-plane may grant tenant-specific overrides (e.g., a pilot tenant
accessing a T0 market). These overrides are:

- Recorded in the registry as explicit exceptions with named authorization.
- Time-bounded (expiration date required).
- Visible in the tenant admin with an "override" label.
- Subject to audit trail.

---

## 17. Safety constraints and anti-drift

The following constraints are non-negotiable and supplement the eight
anti-drift rules from the Capability Truth spec (Section 18):

1. **Repo files govern, not memory.** Market and payer readiness must be
   recorded in structured registry data under version control or in the
   platform database. No readiness assertion exists solely in human memory,
   meeting notes, or chat transcripts.

2. **Evidence must be traceable.** Every readiness-state transition must
   reference a specific evidence artifact (test output, review document,
   runtime proof log). "We verified it last month" without a reference is
   not evidence.

3. **Cross-repo dependencies must be explicit.** The language dimension
   depends on the distro's UTF-8 lane and language pack. This dependency
   must be recorded in the registry entry and checked whenever the distro's
   runtime truth changes.

4. **No forward-dating.** A dimension cannot be set to `production-eligible`
   based on a planned future event (e.g., "regulatory review scheduled for
   Q3"). It must reflect current proven state.

5. **Regression requires audit.** If any dimension or payer scope regresses
   (e.g., from `verified` back to `implemented` due to a breaking change),
   the regression must be recorded with reasoning, and any affected launch
   tiers must be recalculated.

6. **No marketing-driven tier assignment.** Launch tiers are computed from
   dimensional evidence, not set by product management to meet a launch
   deadline.

7. **Payer seed data is not payer readiness.** Having payer records loaded
   from `data/payers/*.json` (per the archived repo's Phase 38) does not
   constitute payer readiness. Those are seed records for development. Payer
   readiness requires integration evidence.

8. **Bounded product languages are a governance constraint.** English, Korean,
   and Spanish are the only languages with active pack development (per
   VE-DISTRO-ADR-0003). Adding a new bounded product language requires an
   explicit distro ADR.

---

## 18. Resolved now vs deferred

| Decision | Status | Notes |
|----------|--------|-------|
| Market readiness is composite, never a single flag | **Resolved** | This spec, Section 7 |
| Eight market-readiness dimensions defined | **Resolved** | Section 7.2 |
| Payer readiness is per-payer with six scope areas | **Resolved** | Section 8.2 |
| Payer lifecycle maps to 9-state readiness model | **Resolved** | Section 8.3 |
| Four launch tiers defined with criteria | **Resolved** | Section 12.1 |
| Launch-tier → claim-surface mapping defined | **Resolved** | Section 12.3 |
| Distro L0–L5 → platform readiness feeding defined | **Resolved** | Section 11.2 |
| Cross-repo language dependency model | **Resolved** | Section 11.3 |
| ------ | ------ | ------ |
| Registry schema (database tables, JSON structure) | **Deferred** | Implementation artifact; governed by this spec |
| Registry API (OpenAPI contract) | **Deferred** | Contract artifact; governed by this spec and contract-first policy |
| Control-plane UI for registry management | **Deferred** | UI artifact; governed by this spec and terminal-first rule |
| Automated launch-tier recalculation logic | **Deferred** | Implementation; Section 12.2 defines the rules |
| Distro → platform readiness sync mechanism | **Deferred** | Cross-repo integration; Section 11 defines the contract |
| Market-specific regulatory pack content | **Deferred** | Per-market; governed by pack-and-adapter spec |
| Payer certification workflow automation | **Deferred** | Implementation; Section 8 defines the model |
| Multi-language market support (e.g., PH needs en + fil) | **Deferred** | Model supports it; no market currently requires it |
| Data residency enforcement mechanism | **Deferred** | Section 7.2 defines the dimension; enforcement is infrastructure |

---

## 19. Out-of-scope

The following are explicitly out of scope for this specification:

1. **Implementation artifacts.** No schemas, APIs, database tables, or UI
   code. Those are downstream artifacts governed by this spec.
2. **Specific regulatory content.** This spec defines the regulatory
   dimension and its evidence requirements but does not enumerate specific
   regulations for any market.
3. **Payer contract negotiation.** This spec defines payer readiness tracking
   but does not govern the business process of engaging payers.
4. **Pricing or commercial tiers.** Launch tiers are readiness tiers, not
   pricing constructs.
5. **Clinical content per specialty.** Specialty-specific readiness is
   addressed by the next artifact (Specialty, Content, and Analytics
   Architecture).
6. **Analytics and reporting architecture.** How readiness data feeds
   analytics dashboards is out of scope. Addressed by the next artifact.
7. **AI-assisted onboarding.** How AI might assist in market onboarding
   is out of scope for this governance specification.

---

## 20. Next artifact handoff

The next artifact in the global system architecture sequence is:

> **Specialty, Content, and Analytics Architecture Specification**
> (`docs/explanation/specialty-content-and-analytics-architecture-spec.md`)

This specification hands off the following items to that artifact:

1. **Specialty readiness as a dimension.** This spec defines market-level
   and payer-level readiness. The next spec must define how specialty-specific
   readiness (e.g., radiology order workflows, pharmacy dispensing) interacts
   with market readiness.
2. **Clinical-content pack → readiness feeding.** This spec establishes
   the pattern of pack → dimension → readiness. The next spec must apply it
   to specialty and content packs.
3. **Analytics consumption of readiness data.** This spec defines the
   registry as a governed data structure. The next spec must define how
   analytics dashboards consume and display readiness data without creating
   PHI leakage risk.
4. **Cross-specialty market coverage.** A market's clinical-workflow dimension
   (Section 7.2) depends on which specialties are supported. The next spec
   must define how specialty coverage feeds back into market readiness.
5. **Content versioning and lifecycle.** Order sets, protocols, and clinical
   decision support content have their own lifecycle that may affect market
   readiness. The next spec must define this.
