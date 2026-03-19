# Control-Plane Fixture Truth Alignment and Second Market Seed (Batch 4)

> **Explanation:** Rationale and scope for the fixture reconciliation wave that
> adds the US market as a second seed legal-market corpus and upgrades all
> fixture data from fabricated to canonically-backed where possible.

## Context

After Batch 3, the control-plane local runtime had 12 read routes, 15
review-only write routes, and 8 fixture JSON files. The **Philippines (PH)**
market was fully backed by canonical contract artifacts (pack manifests,
capability manifests, legal-market profile, effective plan). However, the
**United States (US)** market existed in fixture files as fabricated placeholder
data with no backing contract artifacts.

Specifically:
- `legal-market-profiles.json` had a US entry marked `v0.0.1` with only 4
  readiness dimensions — fabricated, not contract-backed.
- `packs.json` listed `regulatory-hipaa` and `specialty-cardiology` as
  fabricated pack entries with no backing pack manifests.
- `capabilities.json` had no US capabilities.
- `effective-plans.json` had no US plan.
- `bootstrap-requests.json` referenced a US `effectivePlanId` that did not
  exist as a contract artifact.

## Goals

1. **Author a second seed legal-market corpus (US)** with minimum supporting
   pack, capability, profile, and plan artifacts — all at draft lifecycle and
   T0 launch tier, matching the conservatism of the PH corpus.
2. **Reconcile every fixture file** so that each data item is either
   canonically backed (traceable to a contract artifact) or honestly marked
   fabricated in provenance metadata.
3. **Fix stale documentation** that contradicted the Batch 3 write-route
   additions.

## Design decisions

### Why US as the second market

- Fixture files already referenced `legalMarketId: "US"` — the data gap was real.
- VistA is a US Department of Veterans Affairs system; US is the natural home market.
- English baseline means no new language packs required for minimum viability.
- US healthcare regulatory (HIPAA) and standards (ICD-10-CM, CPT, HCPCS, X12 5010)
  are well-defined and documentable at draft/declared level.

### What was NOT done

- No readiness inflation. All US dimensions are either `declared` or `specified`.
  No dimension is `implemented` or higher.
- No new fabricated data. The only remaining fabricated pack is
  `specialty-cardiology` (a generic demo pack not backed by any market-specific
  contract artifact — honest about its nature).
- No US payer packs. Medicare/Medicaid/commercial payer integration is a
  distinct future concern. The US profile has `payer` readiness at `declared`.
- No state-level privacy laws. HIPAA is federal only. CCPA, SHIELD Act, etc.
  are explicitly noted as out of scope.
- No CPT licensing resolution. CPT is identified as a coding system but the
  AMA licensing constraint is documented as a gating blocker.

## Contract artifacts created

| Artifact | Path | Type |
|----------|------|------|
| US HIPAA Regulatory Pack | `packages/contracts/pack-manifests/regulatory-hipaa.json` | pack-manifest |
| US National Standards Pack | `packages/contracts/pack-manifests/standards-us.json` | pack-manifest |
| US Locale Pack | `packages/contracts/pack-manifests/locale-us.json` | pack-manifest |
| US Regulatory Compliance Capability | `packages/contracts/capability-manifests/regulatory.us-compliance.json` | capability-manifest |
| US Locale Support Capability | `packages/contracts/capability-manifests/platform.us-locale-support.json` | capability-manifest |
| US Legal Market Profile | `packages/contracts/legal-market-profiles/US.json` | legal-market-profile |
| US Effective Tenant Configuration Plan | `packages/contracts/effective-tenant-configuration-plans/US-staging-hospital-core.json` | effective-tenant-configuration-plan |

All artifacts follow the same schema patterns as their PH equivalents.

## Fixture reconciliation summary

| Fixture | Before | After |
|---------|--------|-------|
| `legal-market-profiles.json` | US fabricated v0.0.1, 4 dimensions | US canonically backed v0.1.0, 8 dimensions |
| `packs.json` | 5 real + 2 fabricated, 7 total | 8 real + 1 fabricated, 9 total |
| `capabilities.json` | 5 PH items only | 5 PH + 2 US items (7 total) |
| `effective-plans.json` | 1 PH plan only | 1 PH + 1 US plan (2 total) |
| `bootstrap-requests.json` | US provenance incomplete | US provenance corrected |
| `tenants.json` | No change needed | Unchanged (fabricated tenant data, honest provenance) |
| `provisioning-runs.json` | No change needed | Unchanged |
| `system-config.json` | No change needed | Unchanged |

## Remaining fabricated data

- **`specialty-cardiology` pack** in `packs.json`: Generic demo pack, not
  market-specific. Honestly marked fabricated. No backing contract artifact
  needed — it exists to demonstrate the pack-catalog surface with a
  non-regulatory pack family.
- **Tenant data** in `tenants.json`: Fabricated tenant identities (names,
  timestamps). Honest provenance. Real tenant data would come from an actual
  provisioning flow.
- **Bootstrap/provisioning data** in `bootstrap-requests.json` and
  `provisioning-runs.json`: Fabricated workflow data. Honest provenance.

## Cross-market pack reuse

The `lang-en` pack (English Language Pack Baseline) has empty
`eligibility.legalMarkets`, making it eligible for all markets. Both PH and US
default-on configurations reference it. This is intentional cross-market reuse,
not duplication.

## Dependency DAG

```
US market:
  regulatory-hipaa  (mandated)
    └── standards-us  (mandated, depends on regulatory-hipaa)
  locale-us  (default-on)
  lang-en  (default-on, cross-market)
  lang-es  (eligible, deferred: pack-not-published)

PH market:
  regulatory-philhealth-doh  (mandated)
    └── standards-ph  (mandated, depends on regulatory-philhealth-doh)
  locale-ph  (default-on)
  lang-en  (default-on, cross-market)
  payer-philhealth  (default-on, depends on regulatory + standards)
  lang-fil  (eligible, deferred: eligibility-failed)
```

## README fix

The `apps/control-plane/README.md` "What this is NOT" section previously
stated "No write routes exist" — a leftover from before Batch 3 added
15 review-only write routes. Updated to accurately reflect the current state.
