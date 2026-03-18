# Legal-Market Composition and Effective-Configuration Resolver Specification

> **Status:** Accepted — planning-stage specification.
> **Artifact type:** Explanation (architecture rationale).
> **Location:** `docs/explanation/legal-market-composition-and-effective-configuration-resolver-spec.md`
> **Registered in:** `docs/reference/source-of-truth-index.md`

---

## 1. Purpose

This specification defines how focused, independently governed packs compose into legal-market profiles and how those profiles resolve into effective tenant configuration plans at provisioning time.

It fills a specific gap: the pack-and-adapter architecture governance spec defines 7 focused pack families and their lifecycle. The country-and-payer-readiness registry spec defines 8 market-readiness dimensions. The capability-truth spec defines readiness states and claim gating. But no artifact defines the **composition algorithm** that answers:

> "For legal market X, which packs are mandated, which are default-on, which are available, and what is the effective configuration plan for a new tenant selecting that market?"

This specification provides that answer.

---

## 2. Relationship to other specifications

### 2.1 Upstream specifications consumed

| Spec | What this spec consumes from it |
|------|---------------------------------|
| Global system architecture (§9, §10, §13) | Pack composition model, control-plane scope, one-truth principle |
| Pack and adapter architecture governance (§6, §9, §10, §11) | Pack taxonomy (7 families), attachment matrix (mandated vs selectable), precedence rules, eligibility evaluation |
| Country and payer readiness registry (§5, §7, §12, §15) | "Country pack" = composition shorthand, 8 readiness dimensions, launch tiers (T0–T3), provisioning implications |
| Capability truth and claim gating (§7, §9, §11, §14, §15) | 9-state readiness model, scope dimensions, gating rules, pack/adapter dependency, provisioning constraints |
| Organization-facility-network-service model (§7) | Tenant and legal-entity definitions, provisioning implications |
| Information architecture workspace map (§11) | Control-plane workspace includes legal-market selection |

### 2.2 What this spec contributes downstream

| Consumer | What this spec provides |
|----------|------------------------|
| Control-plane provisioning (future) | Legal-market profile as the input, effective-tenant-configuration-plan as the output, 7-step resolution algorithm as the logic |
| Onboarding/signup flow (future) | Eligible legal markets filtered by launch tier and readiness |
| Tenant-admin enablement (future) | Effective configuration as the baseline for what tenants may activate/deactivate within their entitlement |
| Capability manifest evaluation | Which packs are active feeds into capability readiness aggregation |
| Screen contract instances | `readinessDependencies` on provisioning surfaces reference the profile and plan schemas |

### 2.3 What this spec does NOT do

- Does not authorize building control-plane UI, tenant-admin UI, or onboarding flows.
- Does not create capability manifests or readiness registry database schemas.
- Does not modify the tenant schema, the pack schema, or any existing schema.
- Does not claim any market is production-ready. All readiness states are evaluated, not asserted.
- Does not replace or override any upstream specification. Composition rules derive from, not supersede, pack governance.

---

## 3. Terminology

| Term | Definition | Source |
|------|-----------|--------|
| **Legal market** | A jurisdiction or composite jurisdiction that defines the regulatory, standards, payer, and language context for healthcare delivery. Examples: US, PH, KR, US-VA (US Department of Veterans Affairs). Not necessarily 1:1 with ISO 3166 country codes. | Country-payer-readiness §5 |
| **Legal-market profile** | A machine-readable composition artifact that declares, for a specific legal market, which packs are mandated, default-on, and eligible, along with readiness dimension snapshots. Reifies the informal "country pack" concept into a governed, composable structure. | **This spec (new)** |
| **Effective-tenant-configuration plan** | The resolved output of applying a legal-market profile to a specific tenant's selections, constraints, and overrides. Contains the concrete list of packs to activate, deferred items, pending dependencies, and the resulting launch tier. | **This spec (new)** |
| **Composition** | The process of assembling focused packs into a market-appropriate set. Composition is declarative (profiles declare what composes) and algorithmic (the resolver evaluates eligibility and readiness). | Pack-and-adapter §9, country-payer-readiness §5 |
| **Resolution** | The process of evaluating a legal-market profile against a tenant's scope, selections, and current infrastructure state to produce an effective configuration plan. | **This spec (new)** |
| **Mandated pack** | A pack that is required for a legal market and cannot be deactivated by operators or tenant admins. Regulatory and national-standards packs are always mandated for their respective market. | Pack-and-adapter §9 |
| **Default-on pack** | A pack that is activated by default for a legal market but may be deactivated by a tenant admin within their entitlement (e.g., the default locale, the dominant-market language, the national-payer connector). | **This spec (new)** |
| **Eligible pack** | A pack that is available for activation in a legal market but is not activated by default. Operator or tenant admin must explicitly enable it. (e.g., additional payer connectors, specialty content packs). | **This spec (new)** derived from pack-and-adapter §11 |
| **Ineligible pack** | A pack that fails eligibility evaluation for the tenant's scope. Not shown in provisioning UI. Not activatable. | Pack-and-adapter §11 |
| **Readiness dimension snapshot** | A point-in-time capture of a legal market's readiness across the 8 dimensions defined in country-payer-readiness §7.2, including state, evidence reference, and verification timestamp. | Country-payer-readiness §7.2, **this spec** |

---

## 4. The composition problem

### 4.1 What operators face today (motivation)

An operator provisioning a new tenant for the Philippines must answer:

1. Which regulatory pack is required? (`regulatory-philhealth-doh`)
2. Which national-standards pack is required? (`standards-ph`)
3. Which locale is appropriate? (`locale-ph`)
4. Which language packs should be active? (`lang-en` baseline + `lang-fil` if available)
5. Which payer connectors are available? (PhilHealth, 14 HMOs — each at different readiness)
6. Which specialty packs are relevant? (Depends on facility type)
7. What readiness gates apply? (PhilHealth eClaims at what state? DOH reporting at what state?)

Without a composition layer, the operator must manually discover this from 3+ specs and multiple pack manifests. That is error-prone and does not scale.

### 4.2 What the composition layer provides

A **legal-market profile** for `PH` declares all of items 1–7 in one machine-readable artifact. The **effective-tenant-configuration-plan** resolver takes the profile plus the operator's selections and produces a concrete activation plan.

### 4.3 Anti-goals

| Anti-goal | Explanation |
|-----------|-------------|
| Monolithic country pack | The profile is a **composition of focused pack references**, not a single artifact containing all resources. Each referenced pack retains its own lifecycle, versioning, and governance. |
| Pack-internal logic | The profile does not contain pack contents, adapter code, or clinical data. It contains references and constraints. |
| Runtime configuration store | The profile and plan are planning/provisioning artifacts. They are not the runtime config format consumed by the API at request time. Runtime config is derived from the plan by the provisioning pipeline (future). |
| Replacing eligibility evaluation | The profile declares eligibility constraints. The resolver evaluates them. The profile does not bypass the eligibility rules in pack-and-adapter §11. |

---

## 5. Legal-market profile structure

### 5.1 Identity

Each legal-market profile has:

- **`legalMarketId`**: A unique identifier. Format: ISO 3166-1 alpha-2 for country-level markets (e.g., `PH`, `US`, `KR`), or a qualified identifier for sub-jurisdictional markets (e.g., `US-VA` for US Department of Veterans Affairs). Must be unique across all profiles.
- **`version`**: Semver. Profile changes are versioned because mandated-pack additions or eligibility changes affect existing tenants.
- **`displayName`**: Human-readable name (e.g., "Philippines", "United States", "Korea (Republic of)").
- **`status`**: Profile lifecycle status: `draft`, `active`, `deprecated`, `retired`.

### 5.2 Mandated packs

The `mandatedPacks` array lists packs that are **required and non-deactivatable** for this market. Per pack-and-adapter §9, regulatory and national-standards packs are always mandated for their respective market.

Each entry contains:

- **`packId`**: Reference to a pack in the pack registry.
- **`packFamily`**: One of the 7 pack families. Expected values for mandated packs: `regulatory`, `national-standards`.
- **`rationale`**: Why this pack is mandated (e.g., "PhilHealth eClaims compliance required by DOH", "PH national diagnosis coding standards").
- **`minimumPackState`**: The minimum pack lifecycle state (per pack-and-adapter §12) required for this mandate to be actionable. If the referenced pack has not reached this state, the legal-market profile is not activatable.

### 5.3 Default-on packs

The `defaultOnPacks` array lists packs that are **activated by default** but **may be deactivated** by a tenant admin within their entitlement.

Each entry contains:

- **`packId`**: Reference to a pack in the pack registry.
- **`packFamily`**: Expected values: `locale`, `language`, `payer`.
- **`rationale`**: Why this pack is default-on (e.g., "Filipino is the dominant non-English language for PH market", "PhilHealth is the universal coverage payer").
- **`deactivationConstraints`**: Conditions under which deactivation is blocked. Empty array means freely deactivatable within entitlement.

### 5.4 Eligible packs

The `eligiblePacks` array lists packs that are **available for activation** but **not activated by default**. These represent the full catalog of packs that pass market-level eligibility for this legal market.

Each entry contains:

- **`packId`**: Reference to a pack.
- **`packFamily`**: Any of the 7 families.
- **`eligibilityConditions`**: Array of conditions that must be true for this pack to be activatable for a specific tenant (e.g., facility-type match, specialty match, adapter availability).

### 5.5 Excluded packs

The `excludedPacks` array lists packs that are **explicitly ineligible** for this market, with rationale. This is the negative-space declaration: it makes ineligibility explicit rather than implicit.

Each entry contains:

- **`packId`**: Reference to a pack.
- **`packFamily`**: Any of the 7 families.
- **`exclusionRationale`**: Why this pack is ineligible (e.g., "US payer connectors not applicable to PH market").

### 5.6 Readiness dimension snapshot

The `readinessDimensions` object contains the market's current readiness across the 8 dimensions from country-payer-readiness §7.2:

1. **Language readiness**: Per-language maturity level within this market.
2. **Regulatory readiness**: Regulatory framework coverage state.
3. **Payer readiness**: Per-payer readiness within this market.
4. **National standards readiness**: Standards compliance state.
5. **Locale readiness**: Locale configuration state.
6. **Clinical content readiness**: Specialty content availability.
7. **Infrastructure readiness**: Runtime infrastructure state for this market.
8. **Operational readiness**: Support, monitoring, SLA readiness.

Each dimension carries:

- **`state`**: One of the 9 readiness states (declared → retired) per capability-truth §7.
- **`evidenceRef`**: Pointer to evidence artifact(s) in `artifacts/`.
- **`lastVerified`**: ISO 8601 timestamp of last verification.
- **`scopeBounds`**: What scope this readiness was verified against (e.g., "pilot-only", "single-payer").
- **`notes`**: Free-text notes for operators.

### 5.7 Launch tier

The `launchTier` field declares the market's current launch tier per country-payer-readiness §12:

- **T0 — Exploratory**: Internal only. Not offered externally.
- **T1 — Limited pilot**: Available to specific partners by arrangement.
- **T2 — Controlled availability**: Available to vetted tenants meeting criteria.
- **T3 — General availability**: Broadly offered.

The launch tier is an **output** of dimensional readiness, not an independent assertion. The tier assignment must be justified by the dimension states.

### 5.8 Standards and regulatory metadata

The `standards` object carries regulatory and standards metadata specific to this market:

- **`regulatoryBody`**: Primary regulatory authority (e.g., "DOH" for Philippines, "CMS" for US).
- **`complianceFrameworks`**: Array of compliance framework identifiers relevant to this market (e.g., `["PH-UHC-Act-2019", "PH-Data-Privacy-Act-2012"]` for PH, `["HIPAA", "21st-Century-Cures"]` for US).
- **`codingSystems`**: Array of required coding system identifiers (e.g., `["ICD-10-CM", "CPT-HCPCS"]` for US, `["ICD-10-CM", "RVS"]` for PH).

### 5.9 Profile immutability rules

- **Mandated pack additions** to an active profile require a new version. Existing tenants on the previous version must be evaluated for impact.
- **Mandated pack removals** are not permitted for active profiles. The pack mandate can only be deprecated (status change to `deprecated` on the pack entry, with migration path).
- **Eligible pack additions** to an active profile are non-breaking (new options) and require version increment.
- **Eligible pack removals** from an active profile require impact analysis on tenants that activated the pack.
- **Readiness dimension updates** are frequent and expected. They do not require a new profile version — the snapshot is a point-in-time reading, not a versioned declaration.
- **Launch tier changes** are governed by readiness dimension evidence and require human review (per capability-truth §18).

---

## 6. Effective-tenant-configuration-plan structure

### 6.1 Purpose

The effective-tenant-configuration-plan is the **resolved output** of the composition algorithm. It is tenant-specific: it represents what a particular tenant's configuration looks like after applying the legal-market profile, operator selections, and tenant overrides.

### 6.2 Identity

- **`tenantId`**: Reference to the tenant.
- **`legalMarketId`**: The legal-market profile that was resolved.
- **`profileVersion`**: The version of the legal-market profile used.
- **`generatedAt`**: ISO 8601 timestamp of when this plan was generated.
- **`resolverVersion`**: Version of the resolution algorithm used.

### 6.3 Resolved packs

The `resolvedPacks` array is the concrete output: the list of packs that should be activated for this tenant.

Each entry contains:

- **`packId`**: The pack identifier.
- **`packFamily`**: The pack family.
- **`activationSource`**: Why this pack is activated. One of:
  - `mandated` — required by legal-market profile, non-deactivatable.
  - `default-on` — activated by default per profile; deactivatable within entitlement.
  - `operator-selected` — explicitly selected by the operator during provisioning.
  - `dependency-required` — pulled in as a dependency of another activated pack (per pack-and-adapter §9 dependency rules).
  - `tenant-override` — activated by a tenant-admin override post-provisioning.
- **`packState`**: The current lifecycle state of the pack (per pack-and-adapter §12).
- **`readinessState`**: The current readiness state of the pack in this tenant's scope (per capability-truth §7).
- **`constraints`**: Any activation constraints or conditions.

### 6.4 Deferred items

The `deferredItems` array lists packs or capabilities that the operator or profile requested but could not be resolved:

- **`packId`**: The pack that could not be activated.
- **`reason`**: Why it was deferred. One of:
  - `pack-not-published` — pack has not reached the minimum lifecycle state.
  - `adapter-unavailable` — required adapter is not available (stub fallback).
  - `dependency-missing` — a required dependency pack is not available.
  - `eligibility-failed` — pack failed eligibility evaluation for this tenant's scope.
  - `readiness-insufficient` — readiness state below the required minimum for the provisioning context.
  - `infrastructure-pending` — required infrastructure (runtime lane, VistA subsystem) not available.
- **`migrationPath`**: What needs to happen for this item to become resolvable.
- **`targetState`**: What readiness state the item needs to reach.

### 6.5 Resolved readiness posture

The `readinessPosture` object summarizes the tenant's effective readiness across all 8 dimensions, computed from the resolved pack states and the legal-market profile's readiness snapshot:

- Per-dimension: state, scope bounds, constraining factors.
- **`effectiveLaunchTier`**: The launch tier that the resolved configuration supports. This may be lower than the profile's declared tier if deferred items or degraded packs constrain it.
- **`gatingBlockers`**: Array of items that prevent the tenant from reaching a higher launch tier.

### 6.6 Tenant selections record

The `tenantSelections` object records what the operator selected during provisioning — distinct from the resolved output. This provides audit trail and supports re-resolution if the profile or pack states change.

- **`selectedPacks`**: Pack IDs explicitly selected by the operator.
- **`deselectedDefaults`**: Default-on packs the operator explicitly deactivated.
- **`facilityType`**: Selected facility type (affects eligibility).
- **`selectedPayers`**: Payer packs explicitly selected.
- **`selectedSpecialties`**: Specialty packs explicitly selected.

### 6.7 Plan immutability and re-resolution

- The plan is a **snapshot**, not a live configuration. It represents the resolved state at `generatedAt`.
- Plans may be **re-resolved** when: the legal-market profile version changes, a pack state changes, an adapter becomes available, or the operator requests re-evaluation.
- Re-resolution produces a **new plan** with a new `generatedAt`. The previous plan is retained for audit.
- The plan does not self-mutate. Changes flow through re-resolution, not in-place edits.

---

## 7. Resolution algorithm

### 7.1 Inputs

1. **Legal-market profile** for the selected market.
2. **Operator selections** (selected packs, deselected defaults, facility type, payer selections, specialty selections).
3. **Pack registry** (current state of all packs: lifecycle state, eligibility rules, dependencies).
4. **Adapter registry** (current state of all adapters: available, stub, degraded).
5. **Runtime health** (VistA lane status, infrastructure state — consumed from distro runtime truth, not re-verified).
6. **Tenant scope** (tenant type, facility type, deployment topology).

### 7.2 Algorithm steps

**Step 1 — Profile validation.** Verify the legal-market profile is `active` (not `draft`, `deprecated`, or `retired`). If not active, resolution fails with a profile-status error.

**Step 2 — Mandated pack resolution.** For each pack in `mandatedPacks`:

- Verify the pack exists in the pack registry and has reached the `minimumPackState` declared in the profile.
- If the pack exists and meets the state requirement, add it to `resolvedPacks` with `activationSource: "mandated"`.
- If the pack does not meet the state requirement, add it to `deferredItems` with the appropriate reason. **Resolution does not fail** — it continues with the remaining packs but records the gap.

**Step 3 — Default-on pack resolution.** For each pack in `defaultOnPacks`:

- If the operator explicitly deselected this pack (present in `deselectedDefaults`), skip it. Record the deselection in `tenantSelections`.
- Otherwise, verify the pack exists and passes eligibility evaluation (per pack-and-adapter §11) for the tenant's scope.
- If eligible, add to `resolvedPacks` with `activationSource: "default-on"`.
- If not eligible, add to `deferredItems`.

**Step 4 — Operator-selected pack resolution.** For each pack in the operator's `selectedPacks`:

- Verify the pack is in `eligiblePacks` for this market (not in `excludedPacks` and present in `eligiblePacks`).
- Evaluate eligibility conditions for the tenant's scope.
- If eligible, add to `resolvedPacks` with `activationSource: "operator-selected"`.
- If not eligible, add to `deferredItems` with `eligibility-failed`.

**Step 5 — Dependency resolution.** For each pack already in `resolvedPacks`, evaluate its declared dependencies (per pack-and-adapter §9):

- If a dependency pack is not yet in `resolvedPacks`, attempt to resolve it. If resolvable, add with `activationSource: "dependency-required"`.
- If a dependency is unresolvable (not published, not eligible, adapter unavailable), add to `deferredItems` with `dependency-missing`. Mark the dependent pack's entry in `resolvedPacks` with a constraint noting the unsatisfied dependency.

**Step 6 — Readiness posture computation.** For each of the 8 readiness dimensions:

- Aggregate the readiness states of all resolved packs that contribute to that dimension.
- Apply the degradation rules from capability-truth §7.3: if any contributing pack is below the profile's declared dimension state, degrade the effective dimension state to the lowest contributor.
- Compute the `effectiveLaunchTier` as the minimum tier supported by the combined dimension states. (T3 requires all dimensions at verified or higher; T2 requires most dimensions at validated or higher; T1 requires language + regulatory at implemented or higher; T0 has no minimum.)
- Record `gatingBlockers` for any dimensions preventing a higher tier.

**Step 7 — Plan assembly.** Assemble the effective-tenant-configuration-plan from the resolved packs, deferred items, readiness posture, and tenant selections. Set `generatedAt` to the current timestamp.

### 7.3 Resolution guarantees

| Guarantee | Explanation |
|-----------|-------------|
| **Resolution always completes.** | The algorithm never fails entirely. It produces a plan even if packs are deferred. The plan accurately reflects what is available and what is pending. |
| **Mandated packs are never silently dropped.** | If a mandated pack cannot be resolved, it appears in `deferredItems` and the effective launch tier is constrained. |
| **No silent mocks.** | If a required adapter is in stub mode, the dependent pack's readiness is degraded to `implemented` at best. The plan reflects `integration-pending`, not fake success. |
| **Precedence is enforced.** | Tenant overrides have highest precedence (per pack-and-adapter §10), but they cannot override mandated packs. Operator selections override defaults but cannot activate excluded packs. |
| **Idempotent.** | Given the same inputs, the algorithm produces the same output. No randomness, no non-deterministic ordering. |

---

## 8. Precedence and override rules

Per pack-and-adapter §10, the precedence order (highest to lowest) is:

1. **Tenant overlay** — tenant-specific overrides applied post-provisioning.
2. **Specialty/content** — specialty-specific packs.
3. **Payer** — payer-specific connectors and rules.
4. **Regulatory** — market-mandated regulatory packs.
5. **National standards** — market-mandated standards.
6. **Locale** — market-specific locale conventions.
7. **Language** — language-specific content.

### 8.1 Override constraints

| Override | Constraint |
|----------|-----------|
| Tenant overlay cannot deactivate mandated packs | Mandated packs are immune to tenant-level deactivation. |
| Tenant overlay can deactivate default-on packs | If not constrained by `deactivationConstraints` on the default-on entry. |
| Operator cannot activate excluded packs | Excluded packs fail eligibility by definition. |
| Operator cannot force a pack beyond its lifecycle state | A `draft` pack cannot be activated in a non-pilot tenant even if the operator selects it. |
| Specialty packs may introduce additional requirements | A specialty pack may depend on specific coding-system support from the national-standards pack. These are resolved in Step 5 (dependency resolution). |

---

## 9. Interaction with readiness and claim gating

### 9.1 Legal-market profiles are gated by readiness

A legal-market profile with `status: "active"` is not automatically offered to all operators. The offering is gated by the profile's `launchTier`:

| Tier | Who sees this market | Capability-truth §11 gating rule |
|------|---------------------|--------------------------------|
| T0 — Exploratory | Internal only. Not in onboarding flows. | "No provisioning option without eligibility." |
| T1 — Limited pilot | Named partners only. Partner arrangement on file. | "No public claim without verified evidence." |
| T2 — Controlled availability | Vetted tenants meeting published criteria. | "No country claim without dimensional proof." |
| T3 — General availability | All tenants. Broadly offered in onboarding. | All gating rules satisfied. |

### 9.2 Effective plans are gated by readiness

The effective-tenant-configuration-plan's `effectiveLaunchTier` constrains what the tenant may do:

- If `effectiveLaunchTier` is T0, the tenant is internal/experimental. No public-facing capability claims.
- If deferred items include mandated packs, the tenant is not fully provisioned. Affected capabilities are marked as `integration-pending`, not silently omitted.

### 9.3 Readiness degradation flows through plans

If a pack is deactivated or degrades (per capability-truth §7.3), any effective-tenant-configuration-plan that includes that pack must be re-evaluated. Degradation is immediate (per capability-truth §18): there is no grace period.

---

## 10. Interaction with control-plane provisioning

This section is conceptual. It does not authorize building control-plane implementation.

### 10.1 Provisioning flow (conceptual)

```
Operator selects legal market
  → Control-plane loads legal-market profile for that market
    → Operator makes selections (payers, specialties, facility type)
      → Resolver runs 7-step algorithm
        → Effective-tenant-configuration-plan generated
          → Operator reviews plan (resolved + deferred + readiness posture)
            → On confirmation: plan is stored, pack activation begins
```

### 10.2 What the control-plane consumes

| Artifact | When consumed | By whom |
|----------|-------------|---------|
| All active legal-market profiles | Legal-market selection UI (list available markets filtered by launch tier) | Control-plane onboarding surface |
| Single legal-market profile | After market selection (to populate pack selection options) | Control-plane provisioning surface |
| Effective-tenant-configuration-plan | After resolution (to display resolved + deferred) | Control-plane provisioning review surface |

### 10.3 What the control-plane stores

The provisioning pipeline (future) stores:

1. The `tenantId` → `legalMarketId` binding.
2. The effective-tenant-configuration-plan snapshot.
3. The tenant selections record (for re-resolution and audit).

Storage is in the platform database (PostgreSQL), per persistence-policy. Not SQLite, not in-memory.

---

## 11. Interaction with tenant-admin enablement

This section is conceptual. It does not authorize building tenant-admin implementation.

### 11.1 What tenant-admin sees

A tenant admin sees their tenant's effective configuration as the baseline:

- **Activated packs**: the `resolvedPacks` from the plan.
- **Available but inactive packs**: eligible packs from the profile that were not activated.
- **Mandated packs**: visually labeled as non-deactivatable.
- **Deferred items**: visually labeled with reason and migration path.
- **Readiness posture**: per-dimension summary.

### 11.2 What tenant-admin may change

- Activate eligible packs that were not selected during provisioning.
- Deactivate default-on packs (subject to `deactivationConstraints`).
- **NOT** deactivate mandated packs.
- **NOT** activate excluded packs.
- **NOT** change the legal-market selection (requires re-provisioning through control-plane).

Each change triggers plan re-resolution.

---

## 12. Profile governance

### 12.1 Who creates profiles

Legal-market profiles are created by **platform operators** (control-plane role), not by tenants. They represent platform-level knowledge about markets.

### 12.2 Profile lifecycle

| State | Meaning |
|-------|---------|
| `draft` | Profile is being authored. Not visible in provisioning flows. |
| `active` | Profile is available for provisioning, gated by launch tier. |
| `deprecated` | Profile is being phased out. Existing tenants continue; new tenants cannot select this market. Migration path required. |
| `retired` | Profile is no longer usable. All tenants have been migrated. Retained for audit. |

### 12.3 Versioning

Profiles use semver:

- **Patch** (0.0.x): Readiness snapshot updates, editorial corrections.
- **Minor** (0.x.0): Eligible pack additions, non-breaking constraint changes.
- **Major** (x.0.0): Mandated pack changes, eligibility rule changes, structural schema changes.

Existing tenants on a previous version are evaluated for compatibility when a new major version is published. The platform does not auto-migrate tenants to new major versions without review.

---

## 13. Schema cross-references

This specification defines two JSON schemas:

| Schema | Location | Purpose |
|--------|----------|---------|
| Legal-market profile | `packages/contracts/schemas/legal-market-profile.schema.json` | Validates legal-market profile instances |
| Effective-tenant-configuration plan | `packages/contracts/schemas/effective-tenant-configuration-plan.schema.json` | Validates resolved configuration plan instances |

Both schemas use JSON Schema 2020-12 and reference enums and definitions from sibling schemas (readiness states, pack families, launch tiers) where applicable.

### 13.1 Relationship to existing schemas

| Existing schema | Relationship |
|----------------|-------------|
| `capability-pack.schema.json` | Legal-market profiles reference pack IDs defined in capability-pack instances. |
| `tenant.schema.json` | Effective-tenant-configuration plans reference tenant IDs. The tenant schema is not modified. |
| `deployment-profile.schema.json` | Deployment profiles and legal-market profiles are complementary. Deployment profiles define infrastructure/SKU shape. Legal-market profiles define market-specific pack composition. Both feed into the effective plan. |
| `screen-contract.schema.json` | Screen contracts for provisioning surfaces reference legal-market profiles as data sources. |

---

## 14. Safety and anti-drift constraints

| Constraint | Source |
|------------|--------|
| **Profiles derive from evidence, not intent.** A legal-market profile's readiness snapshot must be backed by evidence in `artifacts/`. Intent or roadmap does not populate readiness dimensions. | Capability-truth §18 |
| **No market claimed without dimensional proof.** A profile with `launchTier: "T3"` must have all 8 dimensions at verified or higher. Partial dimensions = bounded tier. | Country-payer-readiness §12, capability-truth §11 |
| **Composition is evaluated, not assumed.** The resolver evaluates eligibility for every pack. Profile declaration does not bypass evaluation. | Pack-and-adapter §11 |
| **No silent degradation.** If a mandated pack degrades, the plan reflects it immediately. No "it was working yesterday" grace period. | Capability-truth §18 |
| **Repo files govern profiles.** Legal-market profile instances are JSON files in the contracts directory, governed by the same version control and review as all contracts. Not in a database-only store. | Contract-first governance |
| **One slice at a time.** Profile creation, pack-state advancement, and provisioning implementation are separate slices with separate proof. | Governed-build-protocol |

---

## 15. Resolved now vs deferred later

### 15.1 Resolved by this document

| Question | Resolution | Section |
|----------|-----------|---------|
| What is a legal-market profile? | Composable, versioned artifact declaring mandated/default-on/eligible/excluded packs and readiness dimensions for a legal market. | 5 |
| What is an effective-tenant-configuration-plan? | Tenant-specific resolved output: concrete pack activation list, deferred items, readiness posture, tenant selections. | 6 |
| What is the resolution algorithm? | 7-step algorithm: profile validation → mandated → default-on → operator-selected → dependency → readiness → assembly. | 7 |
| How do overrides and precedence work? | Pack-and-adapter §10 precedence enforced. Mandated packs immune to override. Excluded packs immune to activation. | 8 |
| How do profiles interact with readiness gating? | Profile launch tier gates visibility. Plan effective tier gates tenant capabilities. | 9 |
| How does this feed control-plane and tenant-admin? | Conceptual constraints defined. Not implementation. | 10, 11 |
| What are the profile governance rules? | Lifecycle (draft → active → deprecated → retired), semver versioning, immutability rules. | 12 |
| What JSON schemas are needed? | Two: `legal-market-profile.schema.json`, `effective-tenant-configuration-plan.schema.json`. | 13 |

### 15.2 Deferred to subsequent work

| Question | Deferred to |
|----------|-------------|
| Concrete legal-market profile instances (PH, US, KR) | Profile authoring work after schema acceptance |
| Control-plane provisioning API endpoints | OpenAPI contract work |
| Control-plane provisioning UI | Not authorized (global architecture §19) |
| Tenant-admin configuration UI | Not authorized (global architecture §19) |
| Re-resolution trigger automation | Future pipeline implementation |
| Migration tooling for profile version upgrades | Future operational tooling |
| Database schema for plan storage | Future schema specification |
| Runtime config derivation from plans | Future implementation |

---

## 16. Parent handoff cross-reference

### 16.1 This spec satisfies the following upstream handoffs

| Source spec | Handoff requirement | Where addressed |
|-------------|-------------------|-----------------|
| Country-payer-readiness §15 | "Auto-resolve the pack composition during onboarding" | Section 7 (resolution algorithm) |
| Country-payer-readiness §5 | "Country pack is informal shorthand for a composition" | Section 5 (legal-market profile reifies the composition) |
| Pack-and-adapter §9 | Market-mandated vs operator-selectable distinction needs per-market declaration | Section 5.2–5.5 (mandated/default-on/eligible/excluded) |
| Capability-truth §15.3 | "Legal-market selection constrains all downstream pack and capability eligibility" — needs structural definition | Section 5 (profile structure), Section 7 (algorithm), Section 8 (precedence) |
| Global architecture §13 | Control-plane scope includes "legal-market selection, tenant provisioning, pack eligibility resolution" — needs artifact shapes | Sections 5, 6, 10 |

### 16.2 What subsequent artifacts should consume from this spec

| Subsequent artifact | What to consume |
|--------------------|----------------|
| Legal-market profile instances | Schema, governance rules, readiness dimension structure |
| Control-plane provisioning API | Profile listing, resolution endpoint, plan storage |
| Capability manifest evaluation | resolved packs feed capability readiness aggregation |
| Screen contract instances for provisioning surfaces | Data source references to profiles and plans |

---

## 17. Explicit out-of-scope — not authorized by this document

| Item | Status |
|------|--------|
| Control-plane provisioning UI implementation | Not authorized (global architecture §19) |
| Tenant-admin configuration UI implementation | Not authorized (global architecture §19) |
| Concrete legal-market profile instances | Deferred to profile authoring work |
| Concrete effective-tenant-configuration-plan instances | Produced by resolver, not hand-authored |
| Readiness registry database schema | Deferred |
| Onboarding flow implementation | Not authorized |
| Pack content authoring | Governed by pack-and-adapter spec |
| Adapter implementation | Governed by pack-and-adapter spec |
| Runtime configuration format | Derived artifact, not defined here |
| Migration from monolithic to composed packs | Operational, not architectural |
| Production deployment of any provisioning features | Not authorized |
