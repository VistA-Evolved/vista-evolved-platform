# Specialty, Content, and Analytics Architecture — VistA Evolved

> **Artifact:** `docs/explanation/specialty-content-and-analytics-architecture-spec.md`
> **Repo:** `vista-evolved-platform`
> **Namespace:** VE-PLAT
> **Status:** Accepted — architecture and governance specification (no implementation)
> **Date:** 2026-03-16

---

## 1. Purpose and position in the architecture sequence

This specification defines how VistA Evolved governs **specialty variation**,
**clinical and business content**, and **analytics / read-model boundaries** as
architecture-level concepts. It establishes the canonical vocabulary, ownership
boundaries, lifecycle model, readiness interactions, and safety constraints
that all future schemas, registries, analytics contracts, dashboards, and
workspace designs must obey.

### 1.1 Position in the sequence

This is the **sixth** artifact in the global system architecture sequence
defined in the Global System Architecture Specification, Section 20:

1. Global System Architecture Specification — accepted
2. Organization, Facility, Network, and Service Model — accepted
3. Pack and Adapter Architecture Governance — accepted
4. Capability Truth and Claim-Gating Specification — accepted
5. Country and Payer Readiness Registry Specification — accepted
6. **Specialty, Content, and Analytics Architecture Specification — this document**

### 1.2 What this specification does

- Defines **specialty** as a clinical-domain context that shapes workflows,
  documentation, orders, and content — not an application fork or product
  variant.
- Defines a governed **content taxonomy** covering templates, questionnaires,
  order sets, calculators, protocols, documentation helpers, and business
  forms.
- Defines the **content lifecycle** from drafting through verification to
  retirement, aligned with the existing pack lifecycle model.
- Defines how **specialty readiness** interacts with capability truth,
  market readiness, payer readiness, and runtime truth without conflation.
- Defines the **analytics / read-model boundary**: analytics is a derived,
  read-only consumption layer that must never become a shadow clinical
  system of record.
- Defines **PHI safety** constraints for analytics surfaces.
- Establishes **ownership boundaries** for specialty and content artifacts
  across repos.

### 1.3 What this specification does NOT do

- Define schemas, APIs, database tables, ETL pipelines, dashboard
  implementations, or UI wireframes.
- Define the rendering engine for templates, questionnaires, or calculators.
- Authorize broad analytics or dashboard implementation.
- Create new readiness states, evidence classes, or claim surfaces beyond
  those defined in the Capability Truth spec.
- Replace VistA as the clinical/operational source of truth.
- Replace distro as the canonical authority for runtime truth and language
  packs.

---

## 2. Relationship to parent specifications

This specification is a direct child of five parent artifacts plus
cross-repo truth from the distro:

| Parent | What this spec inherits |
|--------|------------------------|
| Global System Architecture Specification | Specialty/content strategy (Section 14), analytics boundary (Section 15), pack taxonomy (Section 10), workspace separation (Section 12), capability truth pipeline (Section 18), sequence mandate (Section 20 item 5) |
| Organization, Facility, Network, and Service Model | Specialty and service-line entity definitions (Section 5.3), department → specialty relationships, facility topology for scoping |
| Pack and Adapter Architecture Governance | Specialty/content pack category (Section 6.7), tenant overlay packs (Section 6.8), pack lifecycle states (Section 12), pack-to-capability mapping (Section 19) |
| Capability Truth and Claim-Gating Specification | 9-state readiness model (Section 5), specialty/content scope dimension (Section 9), evidence classes (Section 8), claim surfaces (Section 10), gating rules (Section 11) |
| Country and Payer Readiness Registry Specification | Clinical-workflow dimension (Section 7.2), specialty → market readiness feeding (Section 20 items 1, 2, 4), content lifecycle → readiness (Section 20 item 5), analytics consumption (Section 20 item 3) |

### 2.1 Handoff items from Country-Payer-Readiness Section 20

This specification fulfills all five handoff items:

| # | Handoff item | Addressed in |
|---|-------------|-------------|
| 1 | Specialty readiness as a dimension interacting with market readiness | Section 10 |
| 2 | Clinical-content pack → readiness feeding | Sections 8, 9, 10 |
| 3 | Analytics consumption of readiness data without PHI leakage risk | Sections 11, 12 |
| 4 | Cross-specialty market coverage → market readiness feeding | Section 10.2 |
| 5 | Content versioning and lifecycle affecting market readiness | Section 9 |

### 2.2 What the distro repo is canonical for

The `vista-evolved-vista-distro` repo is canonical for:

- **Runtime lane truth:** UTF-8 is primary planned operator lane; M-mode
  is rollback/reference/safety (VE-DISTRO-ADR-0003).
- **Language pack format and maturity levels:** L0–L5 per `overlay/l10n/PACK-SPEC.md`.
- **VistA clinical/operational data:** VistA globals remain the single
  source of truth for patient, clinical, and operational data.
- **Build verification:** 5-level readiness checks are distro-owned.

This spec **consumes** distro truth as input. It does **not** re-decide lane
designation, language coverage levels, or clinical data ownership. Specialty
content that resides in VistA (order entry, note templates stored in VistA
TIU) remains VistA-owned; the platform governs metadata, lifecycle, and
readiness claims about that content.

---

## 3. Goals

The specialty, content, and analytics architecture must support:

1. **Multiple specialties without forking the product.** Adding cardiology
   does not require a separate codebase, instance, or tenant configuration
   fork. Specialty variation is handled through composable content packs.

2. **Specialty-specific content without one-off chaos.** Each specialty has
   governed content artifacts (order sets, templates, protocols) that follow
   a common taxonomy and lifecycle, not ad-hoc per-specialty custom code.

3. **Content versioning and lifecycle control.** Content progresses through
   governed states (draft → reviewed → validated → verified → published →
   deprecated → retired). No content reaches production without passing
   governance gates.

4. **Specialty readiness as a bounded dimension.** A specialty is supportable
   with explicit scope. "Cardiology is supported" is never a blanket claim
   — it is scoped by market, payer, facility type, and content coverage.

5. **Analytics and BI surfaces without duplicating transactional truth.**
   Analytics consumes derived, read-optimized data. It never becomes a
   parallel clinical system of record.

6. **Future dashboards and workspaces aligned to governed truth.** Dashboard
   design, workspace composition, and screen contracts inherit the boundary
   and ownership rules defined here.

7. **Incremental specialty rollout.** Specialties can be rolled out one at
   a time, in one market at a time, without blocking other specialties or
   markets.

8. **Content reuse across markets and specialties.** Where clinically
   appropriate, content artifacts (e.g., a BMI calculator) may be shared
   across specialties and markets rather than duplicated.

---

## 4. Anti-goals and forbidden drift

| Anti-goal | Why forbidden |
|-----------|---------------|
| Redesign every specialty from scratch in one pass | Specialties scale incrementally through content packs. Attempting all specialties simultaneously violates one-slice-at-a-time governance. |
| Treating every specialty as a separate product fork | Specialty variation is content and configuration, not application forks. No per-specialty codebase or per-specialty instance. |
| Storing shadow clinical truth in analytics stores | Analytics is a derived consumption layer. Clinical truth lives in VistA. Copying operational data into analytics stores for convenience creates a shadow EHR. |
| Undocumented content overrides | All content modifications (activation, deactivation, version upgrades) must be recorded in the content lifecycle trail. Silent overrides are forbidden. |
| Letting dashboards become a parallel source of truth | Dashboards display derived data. They must never accept writes that bypass VistA or the platform's governed data path. |
| Using analytics needs to justify duplicating PHI-rich operational data | Analytics must operate on minimum-necessary data with governed redaction. "We need it for reporting" is not justification for broad PHI replication. |
| Conflating specialty readiness with global market readiness | A market may be generally available while certain specialties remain pilot-only. Specialty readiness is per-specialty, per-scope; it does not automatically inherit from or contribute to market readiness without explicit rules. |
| Conflating content existence with content readiness or claimability | Having authored an order set is not the same as having validated, verified, and published it. Content lifecycle state governs claimability, not file existence. |
| Letting content packs bypass VistA write paths | Content packs configure VistA-mediated clinical workflows. They must never create parallel clinical data stores or bypass VistA's approved write path. |
| Building analytics pipeline or dashboard UI in this spec | This is architecture/governance. Implementation is deferred and requires explicit authorization. |

---

## 5. Canonical definitions

### 5.1 Specialty and service-line terms

| Term | Canonical definition | What it is NOT | Primary owner |
|------|---------------------|----------------|---------------|
| **Specialty** | A clinical discipline (cardiology, orthopedics, psychiatry, family medicine) that defines scope of practice, credentialing requirements, and clinical content needs. Specialties attach to practitioners, departments, and content packs. | Not a department (organizational). Not a service line (broader grouping). Not a product fork or tenant variant. | Shared: VistA (person class, File 40.8) / Platform (content governance, readiness) |
| **Service line** | A cross-location organizational grouping of related clinical or operational services (e.g., surgical services, women's health, behavioral health). A service line may span multiple departments and facilities. | Not a department (location-scoped). Not a specialty (a service line groups specialties). Not a billing concept. | Platform (governance); may map to VistA Service/Section (File 40.8) |

### 5.2 Content terms

| Term | Canonical definition | What it is NOT | Primary owner |
|------|---------------------|----------------|---------------|
| **Clinical content** | Governed artifacts that shape clinical workflows, documentation, ordering, and decision-making. Includes templates, questionnaires, order sets, protocols, calculators, and documentation helpers. | Not application code. Not VistA source routines. Not runtime configuration (locale, feature flags). | Platform (governance, lifecycle) / VistA (storage where VistA-native) |
| **Administrative / business content** | Governed artifacts that shape non-clinical workflows: intake forms, coding aids, billing worksheet templates, administrative questionnaires. | Not clinical decision support. Not payer-connector configuration (that is a payer pack). | Platform (governance, lifecycle) |
| **Content pack** | A composable unit that bundles clinical or business content for a specific specialty, market, or cross-cutting concern. Part of the pack taxonomy (global-arch Section 10). | Not an application module. Not a deployable service. Not a database. | Platform (lifecycle governance) |
| **Template** | A structured pattern for clinical documentation: note templates, assessment templates, procedure documentation templates. Consumed by a rendering engine. | Not a note itself. Not a form (templates produce documents; forms collect input). | Platform (governance) / VistA (TIU templates where VistA-native) |
| **Questionnaire** | A structured set of questions for data collection: intake forms, screening instruments, patient-reported outcome measures, risk assessments. | Not a template (questionnaires collect input; templates produce output). Not a calculator (no scoring logic embedded in the questionnaire definition). | Platform (governance) |
| **Note aid / documentation helper** | A structured data-entry assist that helps clinicians complete documentation: auto-population rules, coding suggestions, structured phrase libraries. | Not a template (aids assist entry; templates define structure). Not application logic. | Platform (governance) |
| **Order set** | A specialty-specific bundle of orders (medications, labs, imaging, consults) designed for a clinical scenario (admission, pre-op, chemotherapy cycle). | Not a single order. Not a protocol (order sets are bundles; protocols are workflows). | Platform (governance) / VistA (order entry where VistA-native) |
| **Protocol** | A governed clinical workflow sequence: step-by-step care pathway, triage algorithm, treatment escalation path. | Not an order set (protocols are sequential workflows; order sets are bundles). Not a guideline (protocols are operational; guidelines are advisory). | Platform (governance) |
| **Rules content** | Clinical decision support rules: drug interaction alerts, allergy cross-sensitivity checks, order appropriateness checks, dosing rules. | Not business rules (billing, eligibility). Not application logic compiled into the codebase. | Platform (governance) / VistA (where VistA-native, e.g., pharmacy checks) |
| **Calculator** | A clinical scoring or computation tool: APACHE, Glasgow, BMI, eGFR, CHA₂DS₂-VASc, MELD, Wells score. Input → formula → output with interpretation. | Not a questionnaire (calculators compute; questionnaires collect). Not a protocol. | Platform (governance) |

### 5.3 Analytics terms

| Term | Canonical definition | What it is NOT | Primary owner |
|------|---------------------|----------------|---------------|
| **Analytics read model** | A read-optimized data projection derived from operational truth for the purpose of reporting, aggregation, and business intelligence. Populated by governed ETL, materialized views, or event projections. | Not the transactional system of record. Not a write path. Not a copy of VistA globals. | Platform (governance, pipeline design) |
| **Operational reporting** | Reports that reflect current or near-real-time operational state: census, bed availability, pending orders, appointment schedules. Operates on live operational data or short-lived caches. | Not analytics (operational reporting is real-time; analytics is derived and historical). Not a dashboard (reporting may be tabular or printed). | Shared: VistA (source data) / Platform (report rendering) |
| **BI surface** | Any user-facing interface that presents analytics data: dashboards, executive scorecards, quality metric displays, population health views, financial performance summaries. | Not a clinical workspace (BI is analysis, not care delivery). Not a data pipeline (BI is the consumption endpoint). | Platform (governance, screen contracts) |
| **Derived metric** | A computed value produced by aggregation, calculation, or transformation of operational data: average length of stay, readmission rate, cost per encounter, quality scores. | Not raw operational data. Not a VistA global value. Not patient-identifiable unless explicitly governed. | Platform (analytics pipeline) |
| **PHI boundary** | The governance perimeter that separates patient-identifiable health information from de-identified, aggregated, or redacted data suitable for analytics. Crossing the PHI boundary requires explicit justification, consent governance, access controls, and audit. | Not a network boundary (PHI boundary is a data-classification concern, not a firewall). Not optional. | Platform (governance, audit) |

---

## 6. Three-model distinction: specialty vs content vs analytics

### 6.1 Why they are separate models

These three concepts interact but are architecturally distinct:

| Model | What it represents | Concern |
|-------|--------------------|---------|
| **Specialty model** | Clinical/business domain context — how a clinical discipline shapes workflows, documentation needs, ordering patterns, and readiness scope. | Which discipline, and how ready is it? |
| **Content model** | Governed artifacts (templates, order sets, protocols, etc.) that operationalize specialty requirements and cross-cutting concerns. | What artifacts exist, what state are they in? |
| **Analytics model** | Derived, read-only consumption layer that summarizes and presents operational truth for reporting and business intelligence. | How is truth consumed without creating a shadow SoT? |

### 6.2 How they interact

```
Specialty defines what content is needed.
Content packs supply that content with governed lifecycle.
Content readiness feeds specialty readiness.
Specialty readiness feeds market readiness (per country-payer spec).

Operational truth (VistA) is the source.
Analytics read models derive from operational truth.
BI surfaces consume analytics read models.
BI surfaces never write back to operational truth.
```

Collapsing these into a single model loses critical distinctions:

- A specialty can be partially supported (content gaps) without that
  invaliding the content that does exist.
- Content can exist without being analytics-ready (not yet included in
  read-model projections).
- Analytics can operate across specialties (aggregated metrics) without
  requiring specialty-specific pipeline code for each.

---

## 7. Specialty variation model

### 7.1 How specialties vary

Specialties differ across the following dimensions. Each dimension may require
specialty-specific content or configuration:

| Variation dimension | What varies | Example |
|--------------------|-------------|---------|
| **Workflow shape** | The sequence and nature of clinical encounters, handoffs, and care stages. | Oncology has multi-cycle chemotherapy workflows; primary care has episodic visits. |
| **Documentation prompts** | Which templates, note structures, and assessment forms are relevant. | Psych uses structured mental status exam; surgery uses operative note templates. |
| **Order/protocol needs** | Which order sets, standing orders, and care pathways are meaningful. | Cardiology has post-MI order sets; OB/GYN has prenatal visit protocols. |
| **Payer/regulatory implications** | Which payer requirements and regulatory mandates are specialty-specific. | Behavioral health has additional consent requirements; radiology has specific accreditation. |
| **Ancillary dependencies** | Which ancillary services (lab, imaging, pharmacy) are heavily used. | Ortho depends on imaging; oncology depends on lab and pharmacy. |
| **Readiness scope differences** | Which capabilities must be verified for this specialty to be claimable. | Emergency requires fast turnaround vitals and order entry; surgical requires scheduling and anesthesia support. |

### 7.2 Partial specialty support

A specialty may be partially supported. Partial support must be explicit:

- A specialty is never "supported" as a blanket statement. Support is
  scoped by which content is verified, in which market, for which payer
  ecosystem, and on which runtime lane.
- Partial specialty support may differ by market: cardiology may be
  content-complete for the US but lack market-specific regulatory content
  for Korea.
- Partial specialty support must be reflected in the capability truth
  registry with bounded proof, not hidden behind a positive label.

### 7.3 Specialty is not a fork

Adding a specialty does **not** mean:

- A separate tenant instance.
- A separate application codebase or feature branch.
- A separate database or data partition.
- A separate API surface.

It means:

- Authoring and activating a content pack for that specialty.
- Verifying the content against clinical workflows.
- Recording the readiness state in the capability registry.
- Making the specialty available through governed provisioning.

The core platform provides rendering engines, workflow orchestration, and
infrastructure. Specialties supply content consumed by those engines.

---

## 8. Clinical and business content taxonomy

### 8.1 Content type catalog

| Content type | What it affects | What it must NOT affect | Where it lives | Pack/readiness relationship |
|-------------|-----------------|------------------------|----------------|----------------------------|
| **Templates** | Documentation structure for clinical notes, assessments, procedures. | Application routing, database schema, API contracts. | Platform (governance); VistA (TIU storage where VistA-native). | Part of specialty content pack. Template verification feeds specialty readiness. |
| **Questionnaires** | Data collection for intake, screening, patient-reported outcomes. | Clinical decision logic directly (feeds data, not decisions). | Platform (governance). | Part of specialty or cross-cutting content pack. |
| **Note aids / documentation helpers** | Data-entry assistance: auto-population, phrase libraries, coding suggestions. | Clinical decision-making (aids assist entry, not diagnosis). | Platform (governance). | Part of specialty content pack. |
| **Order sets** | Bundled orders for clinical scenarios (admission, pre-op, chemotherapy). | Individual order logic or pharmacy rules (those are VistA-native). | Platform (governance); VistA (order entry where VistA-native). | Part of specialty content pack. Order-set verification feeds specialty readiness. |
| **Protocols** | Sequential clinical workflows, care pathways, triage algorithms. | Scheduling or administrative workflows (those are tenant config). | Platform (governance). | Part of specialty content pack. |
| **Rules content** | Clinical decision support: drug interactions, dosing, allergy cross-checks. | Application control flow (rules inform, not bypass). | Platform (governance); VistA (pharmacy checks where VistA-native). | Part of specialty or cross-cutting content pack. Rules verification is prerequisite for specialty readiness in affected areas. |
| **Calculators** | Clinical scoring: APACHE, BMI, eGFR, CHA₂DS₂-VASc. | Diagnosis or treatment decisions directly (tools, not agents). | Platform (governance). | May be cross-cutting (shared across specialties) or specialty-specific. |
| **Business/admin forms** | Intake registration, insurance verification, administrative questionnaires. | Clinical workflows or clinical documentation. | Platform (governance). | Part of administrative content or payer pack. |
| **Coding/billing aids** | Procedure code suggestions, diagnosis code lookups, claim preparation helpers. | Clinical documentation content (coding aids are downstream of clinical content). | Platform (governance). | Part of payer pack or revenue-cycle content. |
| **Reference data** | Drug databases, lab reference ranges, procedure catalogs, diagnosis sets. | Application logic directly (reference data is consumed, not executable). | Platform (governance); VistA (drug file, lab file where VistA-native). | May be shared infrastructure or part of national-standards pack. |

### 8.2 Content type governance rules

1. **Content does not replace application code.** Content configures and
   extends; it does not rewrite platform or VistA behavior.
2. **Content does not create parallel data stores.** Content artifacts are
   configuration that shapes VistA-mediated workflows. Patient data
   generated by those workflows remains in VistA.
3. **Content must declare its scope.** Every content artifact must declare
   which specialty, market, payer, and facility types it applies to.
4. **Content must follow the lifecycle model.** No content reaches
   production activation without progressing through governed lifecycle
   states (Section 9).

---

## 9. Content lifecycle and versioning

### 9.1 Content lifecycle states

Content progresses through a governed lifecycle that mirrors the principles of
the pack lifecycle model (Pack and Adapter Architecture Governance spec) but
defines content-specific states. Content states are distinct from pack states
because content artifacts (clinical templates, order sets) have review and
deprecation needs that packs do not:

| Content state | Definition | Transition criteria |
|--------------|-----------|---------------------|
| **Draft** | Content has been authored but not yet reviewed. May be incomplete or experimental. | Authoring started; no review yet. |
| **Reviewed** | Content has been reviewed for clinical accuracy, completeness, and alignment with specialty requirements. | Clinical review completed; reviewer attribution recorded. |
| **Validated** | Content has been tested in a controlled environment against representative data and workflows. | Validation test results recorded as evidence. |
| **Verified** | Content has been independently confirmed to work correctly in a representative environment with evidence. Minimum bar for activation in pilot scopes. | Independent verification with evidence per Capability Truth spec. |
| **Published** | Content is approved for general activation. Available for provisioning and tenant activation. | Governance review; launch-scope declared. |
| **Deprecated** | Content is being phased out. Still available but no longer promoted for new activations. | Successor content identified or clinical rationale recorded. |
| **Retired** | Content is no longer available for activation. Historical records remain for audit. | All active instances deactivated; retirement recorded. |

### 9.2 Versioning rules

1. **Content is versioned.** Every content artifact has an explicit version
   identifier. Changes to content produce a new version, not an in-place
   mutation.
2. **Active content instances pin to a version.** A tenant/facility
   activating a content artifact receives a specific version. Upgrades
   require explicit action.
3. **Version compatibility must be declared.** Each content version declares
   which specialty scope, market scope, payer scope, and runtime lane it
   is compatible with.
4. **Breaking changes require a new version.** Modifications that alter
   clinical behavior, remove fields, or change interpretation must produce
   a new major version, not a patch.

### 9.3 Compatibility scoping

Content compatibility is multi-dimensional, following the scope dimensions
from the Capability Truth spec:

- **Specialty scope:** Which specialty does this content serve?
- **Market scope:** Which legal market(s) is this content validated for?
- **Payer scope:** Does this content have payer-specific requirements?
- **Runtime scope:** Which VistA lane is this content verified against?
- **Facility-type scope:** Is this content applicable to all facility types
  or restricted (e.g., inpatient-only order sets)?

Content verified for one scope is not automatically valid for another.
Scope widening requires additional evidence.

### 9.4 Silent drift forbidden

- Content must not be modified in place without a version change.
- Content must not be activated outside its declared scope without
  explicit re-verification.
- Content overrides (tenant-specific modifications to shared content) must
  be recorded in the lifecycle trail and declared as overrides, not
  presented as standard content.
- "It was always configured that way" is not evidence. Only versioned,
  attributed changes count.

### 9.5 Retired and deprecated content traceability

- Deprecated content must list its successor or the clinical rationale
  for deprecation.
- Retired content records must remain queryable for audit and compliance
  purposes.
- Active instances using deprecated content must be flagged for
  operator attention.
- No content silently disappears from a tenant's active configuration.
  Retirement requires explicit deactivation.

---

## 10. Specialty readiness interaction

### 10.1 With capability truth

Specialty readiness is a **scoped capability readiness assessment** within the
framework defined by the Capability Truth spec. It uses the same 9-state
readiness model (declared → retired), the same evidence classes, and the
same claim-gating rules.

A specialty is not a single capability. It is a **bundle of capabilities**
scoped by clinical discipline:

- Clinical content coverage (templates, order sets, protocols)
- Workflow support (the platform renders the specialty's workflow patterns)
- Ancillary integrations (lab, imaging, pharmacy interoperability)
- Regulatory compliance (specialty-specific consent, accreditation)

The specialty readiness state is the **composite** of these constituent
capability states, following the weakest-link rule: the specialty's overall
readiness cannot exceed the lowest state of its required constituents.

### 10.2 With market and payer readiness

Specialty readiness feeds into market readiness through the
**clinical-workflow dimension** defined in the Country and Payer Readiness
Registry (Section 7.2):

- A market's clinical-workflow dimension depends on which specialties are
  supported in that market.
- A market may be generally available (T2/T3) while specific specialties
  remain pilot-only or unsupported in that market.
- Specialty readiness is per-specialty per-market. Cardiology may be
  verified in the US and declared in Korea.
- **Specialty readiness does not automatically inherit from market
  readiness.** A market being at T3 does not make all specialties in
  that market verified.
- **Specialty readiness does not automatically elevate market readiness.**
  One specialty reaching verified status does not change the market's
  launch tier unless the dimensional criteria are met.

Payer implications:

- Some specialties have payer-specific content (e.g., behavioral health
  billing codes differ by payer). Specialty readiness for such content
  is scoped to the payer as well as the market.
- A specialty may be payer-ready for one payer and not another within the
  same market.

### 10.3 With pack and adapter readiness

Specialty readiness depends on the underlying pack and adapter states:

- The specialty content pack must be at least **published** for the
  specialty to be considered **verified** in a given scope.
- The clinical-engine adapter must be functional for the specialty's
  workflow patterns.
- If the specialty requires a payer adapter (e.g., specialty-specific
  claim formats), that adapter must be verified for the relevant payer.
- Pack regression (e.g., a content pack rolled back from published to
  validated) triggers specialty readiness re-evaluation.

### 10.4 With runtime lane truth

Specialty content must be verified against the runtime lane it will operate
on:

- Content verified on the UTF-8 lane is not automatically verified on the
  M-mode lane, and vice versa.
- The distro repo owns lane verification. The platform consumes the
  result as input to specialty readiness.
- If the UTF-8 lane is the primary planned operator lane (per
  VE-DISTRO-ADR-0003), specialty verification effort should prioritize
  that lane.

### 10.5 Specialty readiness does not inherit

To be explicit:

- Specialty readiness does **not** inherit from market readiness.
- Market readiness does **not** inherit from specialty readiness.
- Specialty readiness in one market does **not** transfer to another market.
- Specialty readiness for one payer does **not** transfer to another payer.
- Specialty readiness on one runtime lane does **not** transfer to another
  lane.

Each scope combination requires its own evidence.

---

## 11. Analytics and read-model boundary

### 11.1 Architectural position

Analytics and business intelligence are governed by a strict boundary:
**analytics is a derived, read-only consumption layer that consumes
operational truth — it never creates, modifies, or replaces operational
truth.**

This boundary applies equally to executive dashboards, quality metrics,
population health analytics, financial performance summaries, and any
future BI surface.

### 11.2 Analytics boundary rules

| Rule | Constraint |
|------|-----------|
| **Analytics does not replace VistA truth** | Aggregated metrics are derived from VistA data through governed ETL or event projections. The analytics store is never the system of record for any clinical or operational datum. |
| **Read-model separation** | Analytics operates on read-optimized projections (materialized views, ETL outputs, aggregation results), not directly on VistA transactional globals or the platform database's operational tables. |
| **No hidden write paths** | No dashboard, metric display, or BI surface may accept user input that modifies operational data. Write operations go through governed API routes, not through analytics pipelines. |
| **No uncontrolled dashboard sprawl** | Every analytics surface must be governed by screen contracts and role-based access. Ad-hoc dashboards are not shipped without architectural review. |
| **PHI safety at the boundary** | Analytics stores must not contain patient-identifiable data unless explicitly governed by consent frameworks, access controls, and audit (see Section 12). |
| **Population vs individual** | Population health and quality metrics are analytics-plane concerns. Individual patient care decisions belong in the clinical workspace. |
| **Latency tolerance** | Analytics read models may have seconds-to-hours lag behind operational truth. This is acceptable. What is not acceptable is presenting stale analytics data as if it were real-time clinical data. |
| **Analytics contracts required** | The schema, refresh cadence, access controls, and data-classification level of every analytics read model must be documented in a contract before implementation. |

### 11.3 Read-model vs transactional truth

| Concern | Transactional truth (VistA + platform ops) | Analytics read model |
|---------|--------------------------------------------|---------------------|
| Purpose | Patient care, operational workflow, real-time decisions | Reporting, aggregation, trend analysis, executive insight |
| Freshness | Real-time | Minutes to hours lag acceptable |
| Writability | Read + write via governed paths | Read-only; populated by ETL or event projection |
| Data granularity | Individual patient, encounter, order | Aggregated, de-identified, or redacted where possible |
| PHI presence | Yes (governing access controls) | Minimized; governed by Section 12 rules |
| Source of truth | Yes | No — derived from transactional truth |
| Appropriate consumers | Clinicians, operations staff, platform services | Analysts, executives, quality officers, BI tools |

### 11.4 Dashboard governance

Future dashboards and BI surfaces must follow these principles:

1. **Governed by screen contracts.** Each dashboard has a screen contract
   defining its data sources, access controls, refresh behavior, and
   data-classification level.
2. **Role-gated access.** Analytics workspace access is role-based. Not
   every user sees every dashboard.
3. **No clinical decision-making from dashboards.** Dashboards present
   historical and aggregate data. Clinical decisions use the clinical
   workspace with real-time VistA data.
4. **Readiness data on dashboards follows claim-gating rules.** If a
   dashboard displays readiness/capability information, it must show the
   governed readiness state, not an optimistic summary.
5. **Dashboard creation requires architectural review.** No team may ship
   a new analytics surface without review against the boundary rules in
   this section.

---

## 12. PHI and operational safety boundary for analytics

### 12.1 PHI safety rules

1. **No casual PHI duplication.** Analytics stores must not contain raw
   patient-identifiable data unless a specific, documented justification
   exists (e.g., a governed quality-reporting requirement with consent).
2. **De-identification by default.** Analytics read models should operate
   on de-identified or aggregated data wherever possible. Patient-level
   analytics requires explicit opt-in governance.
3. **Minimum-necessary exposure.** When patient-level data is required in
   analytics, only the minimum fields necessary for the analytic purpose
   are included. Full chart data replication into analytics is forbidden.
4. **No PHI in metric labels or dimension keys.** Patient names, MRNs,
   SSNs, dates of birth, and other identifiers must not appear as
   dimension keys, metric labels, or log fields in analytics systems.

### 12.2 Derived metrics over raw replication

- Population health metrics (readmission rate, average LOS, quality
  scores) should be computed from aggregated event streams, not by
  copying entire patient records into analytics stores.
- Where individual encounter data is needed for drill-down, the analytics
  layer should reference encounter identifiers that resolve to VistA data
  through governed APIs at query time — not by caching the full encounter.
- This pattern preserves VistA as the source of truth while enabling
  analytics use cases.

### 12.3 Auditability

- All analytics data access must be auditable: who accessed what data,
  when, for what purpose.
- ETL pipelines that populate analytics read models must log their sources,
  transformation logic, and output destinations.
- Analytics stores that contain any patient-adjacent data must be included
  in the platform's audit framework.

---

## 13. Content ownership and repo boundaries

### 13.1 Ownership boundary table

| What | Where it belongs | Why |
|------|-----------------|-----|
| **VistA-native clinical content** (TIU templates, order dialogs, pharmacy tables) | VistA (distro-owned globals and files) | VistA is the clinical SoT. These are operational artifacts within VistA. |
| **Language packs** (translations, dialog overlays, formatting routines) | Distro (`overlay/l10n/`) | Language packs modify VistA runtime behavior. Distro owns the build and verification. |
| **Content governance metadata** (lifecycle state, versioning, authorship, scope declarations, readiness state) | Platform | Platform governs content lifecycle, readiness, and claim-gating. |
| **Content pack manifests** (declaring what content a pack contains) | Platform (`packages/contracts/schemas/`) | Pack manifests are governance artifacts, not clinical data. |
| **Specialty readiness records** | Platform (capability registry) | Specialty readiness is a governance concern, not a clinical-data concern. |
| **Analytics read-model schemas** | Platform (`packages/contracts/`) | Analytics schemas are contracts governing derived data. |
| **Analytics pipeline code** (ETL, aggregation logic) | Platform (when implemented) | Analytics is a platform concern, not a VistA concern. |
| **Reference data** (drug databases, lab ranges, procedure catalogs) | Shared: VistA (canonical drug/lab files) / Platform (supplemental reference) | VistA files are SoT for VistA-native reference data. Platform may manage supplemental reference data (e.g., market-specific code sets not in VistA). |
| **Tenant-specific content overrides** | Platform (tenant config) | Overrides are governance artifacts that modify how standard content is applied for a tenant. |

### 13.2 What belongs in neither repo

- **Payer-proprietary content** (payer-specific claim adjudication rules,
  proprietary fee schedules) is external to both repos. The platform may
  reference it through payer adapters but does not store or govern it.
- **Third-party clinical content** (commercial drug databases, licensed
  clinical decision support) is licensed external content. The platform
  may integrate it through adapters but does not own it.

### 13.3 Shadow-EHR prevention

The platform must not accumulate clinical data stores that duplicate VistA:

- No platform table for "patient problems" separate from VistA Problem
  List.
- No platform table for "active medications" separate from VistA
  Pharmacy files.
- No platform table for "lab results" separate from VistA Lab files.

Where the platform needs clinical data for a legitimate purpose (e.g.,
displaying problems in a clinical workspace), it queries VistA at
request time through governed APIs — it does not maintain a synchronized
copy.

---

## 14. Control-plane implications

The control plane may use specialty and content readiness in the following
ways:

1. **Pack eligibility during provisioning.** When provisioning a tenant,
   the control plane resolves which specialty content packs are eligible
   and available for the tenant's legal market, facility type, and
   specialty configuration.

2. **Capability reporting.** The control plane may present operators with
   a view of specialty readiness across tenants and markets, showing
   which specialties are verified, pilot, or pending.

3. **Upgrade orchestration.** When a new content version is published,
   the control plane may coordinate the upgrade path for tenants using
   the previous version.

4. **Analytics provisioning.** The control plane may configure which
   analytics read models and BI surfaces are available for a tenant
   based on their module entitlements and specialty configuration.

These are conceptual implications. None authorize control-plane UI
implementation in this spec.

---

## 15. Tenant-admin implications

Tenant admins may interact with specialty and content in the following
ways:

1. **Viewing eligible specialties.** Tenant admins see which specialties
   are available for activation in their context (market, facility type,
   entitlement).

2. **Viewing content status.** Tenant admins see which content packs are
   active, their versions, and whether updates are available.

3. **Partial visibility.** If a specialty is partially supported, the
   tenant admin sees explicitly which capabilities are available and
   which are `integration-pending`.

4. **Content overrides.** Tenant admins may activate tenant-specific
   overlays (per tenant-overlay pack rules) but cannot override
   published content without recording the override.

5. **Analytics surface access.** Tenant admins may configure which users
   have access to analytics/BI surfaces within their tenant, subject to
   role-based access controls.

Tenant admins **cannot**:

- Override content lifecycle state (force-publish unverified content).
- Activate specialties that are below the readiness threshold for their
  market/tenant type.
- Create shadow clinical data stores to work around content gaps.
- Access analytics data outside their tenant boundary.

---

## 16. Claim-gating and readiness implications

### 16.1 Content existence is not claimability

Having authored an order set, a template, or a protocol does not make
the corresponding specialty claimable. Claimability requires:

1. Content reaching at least **verified** lifecycle state.
2. The specialty's constituent capabilities all meeting their minimum
   readiness thresholds.
3. The scope (market, payer, facility type, lane) being explicitly
   declared and matched.

### 16.2 Specialty pilots are not general readiness

If a specialty is piloted at one facility or in one market, the
readiness claim is bounded to that pilot scope. Moving from pilot to
general availability requires additional evidence at the broader scope.

This aligns with the bounded-proof rules from the Capability Truth spec
(Section 9.3) and the launch-tier model from the Country and Payer
Readiness Registry (Section 12).

### 16.3 Dashboards and marketing must not overstate

Claim surfaces (marketing pages, sales dashboards, system-of-record
badges) must reflect governed specialty readiness:

- A specialty at "pilot" readiness in one market cannot be presented
  as "generally available" on a marketing page.
- "X specialties supported" requires each named specialty to be at
  least verified in the claimed scope.
- Analytics dashboards displaying specialty coverage must show governed
  readiness states, not optimistic summaries.

### 16.4 Specialty readiness feeds market readiness carefully

A specialty reaching verified status in a market contributes to that
market's clinical-workflow dimension (per country-payer-readiness spec
Section 7.2), but:

- The contribution is recorded as evidence, not as an automatic
  state transition.
- Market launch-tier recalculation considers the clinical-workflow
  dimension alongside all other dimensions.
- No automatic tier promotion from a single specialty verification.

---

## 17. Safety and anti-drift constraints

The following constraints supplement the anti-drift rules from preceding
specs:

1. **Repo files and evidence govern truth, not memory.** All specialty
   readiness, content lifecycle state, and analytics boundaries must be
   recorded in structured governance data. No readiness assertion exists
   solely in human memory, meeting notes, or chat transcripts.

2. **No hidden content overrides.** Every content modification (a tenant
   override, a version upgrade, a scope change) must be recorded in the
   lifecycle trail with attribution and timestamp.

3. **No undocumented specialty-specific hacks.** If a specialty requires a
   workaround or exception to general platform behavior, it must be
   documented and governed, not buried in code comments.

4. **Analytics must not become back-channel writes.** No analytics surface,
   report, or dashboard may modify operational data, trigger clinical
   workflows, or create records in VistA.

5. **Content lifecycle cannot be bypassed.** No fast-track from draft to
   production activation. Content must progress through governed states
   with evidence at each transition.

6. **Specialty readiness cannot be asserted by marketing.** Readiness
   flows from evidence through the governed pipeline to claim surfaces.
   Marketing deadlines do not set readiness states.

7. **One slice at a time.** Specialty rollout, content authoring, and
   analytics surface creation follow the governed build protocol.

8. **Analytics contract-first.** No analytics read model is populated
   before its schema, classification, access controls, and refresh
   cadence are defined in a contract.

---

## 18. Resolved now vs deferred

| Decision | Status | Notes |
|----------|--------|-------|
| Specialty = content + configuration, not application fork | **Resolved** | Section 7.3 |
| Six specialty variation dimensions defined | **Resolved** | Section 7.1 |
| Content taxonomy with 10 content types | **Resolved** | Section 8.1 |
| Content lifecycle states aligned with pack lifecycle | **Resolved** | Section 9.1 |
| Content versioning rules and compatibility scoping | **Resolved** | Sections 9.2, 9.3 |
| Specialty readiness interaction with market/payer/runtime | **Resolved** | Section 10 |
| Analytics is derived read-only consumption, never SoT | **Resolved** | Section 11 |
| PHI safety boundary for analytics defined | **Resolved** | Section 12 |
| Content ownership across repos defined | **Resolved** | Section 13 |
| Claim-gating rules for specialty/content | **Resolved** | Section 16 |
| ------ | ------ | ------ |
| Content pack manifest JSON Schema | **Deferred** | Future `packages/contracts/schemas/` work |
| Content registry database schema | **Deferred** | Implementation artifact governed by this spec |
| Analytics read-model schemas | **Deferred** | Contract artifact; requires analytics implementation authorization |
| ETL pipeline implementation | **Deferred** | Implementation; governed by Section 11 boundary rules |
| Dashboard screen contracts | **Deferred** | Future workspace/screen-contract spec |
| Content rendering engine design | **Deferred** | Implementation; platform engine, not this spec |
| Automated specialty readiness calculation | **Deferred** | Implementation; Section 10 defines the rules |
| BI tool selection | **Deferred** | Infrastructure decision; no tool commitment in this spec |
| Content marketplace or distribution system | **Deferred** | Not authorized; speculative infrastructure |

---

## 19. Out-of-scope / not authorized

The following are explicitly out of scope for this specification:

1. **Implementation artifacts.** No schemas, APIs, ETL code, dashboard
   code, or UI code. Those are downstream artifacts governed by this spec.
2. **Content rendering engine.** How templates, questionnaires, or
   calculators are rendered is an implementation concern, not an
   architecture concern for this document.
3. **Specific specialty content.** This spec defines the model for
   specialty content. It does not author any specific order set, template,
   protocol, or calculator.
4. **BI tool or data warehouse selection.** This spec defines governance
   constraints. It does not prescribe specific analytics infrastructure.
5. **Analytics pipeline implementation.** ETL design, materialized view
   definitions, and aggregation logic are implementation deferred behind
   this spec's governance.
6. **Dashboard UI.** Workspace layouts, screen designs, and dashboard
   component libraries are future information-architecture concerns.
7. **AI-assisted content authoring.** How AI may assist in creating or
   reviewing clinical content is not governed by this architecture spec.
8. **Content pricing or marketplace.** Commercial models for content
   packaging are business concerns, not architecture concerns.

---

## 20. Next artifact handoff

The next artifact in the global system architecture sequence is:

> **Information Architecture and Workspace Map**
> (`docs/explanation/information-architecture-workspace-map.md`)

This specification hands off the following items to that artifact:

1. **Workspace composition per domain.** This spec defines the specialty,
   content, and analytics models. The next spec must define how workspaces
   present these models to users — which screens, navigation patterns,
   and information flows serve clinicians, admins, analysts, and operators.

2. **Screen contracts for analytics surfaces.** This spec defines
   analytics boundary rules and dashboard governance principles. The next
   spec must define the screen contract format and review process for
   individual BI surfaces.

3. **Content administration workspace.** This spec defines content
   lifecycle and ownership. The next spec must define how content
   administrators interact with the content lifecycle — what they see,
   what actions they can take, and how the workspace enforces governance.

4. **Cross-workspace navigation.** The global architecture (Section 12)
   defines workspace separation rules. The next spec must define the
   navigation model that connects workspaces while maintaining boundaries.

5. **Claim-surface presentation.** The capability truth and country-payer
   specs define claim surfaces. The next spec must define how those
   surfaces are presented in control-plane and tenant-admin workspaces.
