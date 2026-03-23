# Control-Plane Effective-Configuration Composition Engine — Wave 2

> **HISTORICAL (2026-03-22):** Review routes referenced here have been removed. The composition engine (plan-resolver) remains active for contract data resolution.

> **Category:** explanation
> **Scope:** `apps/control-plane/` local review runtime only
> **Status:** historical

## What the composition engine does

The composition engine (resolver) is a deterministic library in
`apps/control-plane/lib/plan-resolver.mjs` that computes which configuration
packs apply to a tenant given a legal market profile and optional tenant
selections. It operates entirely from contract-backed data loaded at startup —
no database, no external services, no runtime infrastructure.

## Why this exists

Effective-configuration plans in `packages/contracts/effective-tenant-configuration-plans/`
are hand-authored seed artifacts. They represent the *expected* outcome of configuration
resolution for a specific market and tenant scenario. As the pack catalog and market
profiles evolve, these seeds can drift. The resolver makes composition
**computable and auditable** rather than manually maintained.

## Resolution algorithm

Given inputs `{ legalMarketId, selectedPacks[], deselectedDefaults[], facilityType }`:

1. **Market lookup** — Find the legal market profile by ID
2. **Pack index** — Build a lookup from the pack catalog
3. **Exclusion set** — Collect all pack IDs from the market's `excludedPacks`
4. **Mandated packs** — Always resolve if the manifest exists and is not excluded
5. **Default-on packs** — Resolve unless the tenant deselects (honoring `deactivationConstraints`)
6. **Eligible packs** — Resolve only if the tenant explicitly selects them
7. **Dependency resolution** — For each resolved pack, check `dependencies[]` and auto-resolve required ones
8. **Readiness posture** — Seed dimensions from resolved packs, carry forward market profile dimensions, compute gating blockers from mandated draft packs and adapter requirements

Each deferred pack gets an explicit reason from a controlled vocabulary:
`pack-not-found`, `pack-not-published`, `eligibility-not-selected`,
`eligibility-failed`, `tenant-deselected`, `market-excluded`,
`dependency-unresolvable`.

## Startup drift audit

At startup, `lib/drift-audit.mjs` re-resolves each seed effective plan using
the same inputs (market + tenant selections) and compares the output against
the seed's static `resolvedPacks`, `deferredItems`, and `readinessPosture`.

Expected drift patterns:
- **PH market:** `lang-fil` deferred as `pack-not-found` by resolver (no manifest exists)
  vs. seed reason which may differ in wording
- **US market:** `lang-es` deferred as `eligibility-not-selected` by resolver (manifest
  exists as draft but tenant didn't select it in the seed's empty `selectedPacks[]`)
  vs. seed reason `pack-not-published`

Drift is informational — it helps operators notice when seeds have gone stale.

## Resolver-backed review routes

Three of the 15 review routes are resolver-backed:

| Route | Enhancement |
|-------|-------------|
| **W4** `POST .../effective-configuration-plans/resolve` | Runs full resolver; adds `resolutionPreview` to envelope |
| **W5** `POST .../tenant-bootstrap-requests` | Adds `resolverPreflight` summary (pack counts by source tier) |
| **W6** `POST .../provisioning-runs` | Adds `resolverPreflight` note about dependency on bootstrap |

The remaining 12 routes continue to use the generic review handler. All routes
still return `executed: false`, `persistence: "none"` — the resolver outputs
are previews only.

## UI integration

The `renderReviewResult()` function in `public/app.js` detects the presence
of `resolutionPreview` or `resolverPreflight` in review responses and renders:
- A resolved packs table (pack ID, family, source tier, lifecycle state, readiness)
- A deferred items table with reasons
- Dependency issue warnings
- Gating blockers preventing launch

The W4 review dialog (`reviewResolvePlan()`) dynamically renders eligible
pack checkboxes based on the selected market, allowing operators to preview
what would change if they selected optional packs.

## Language pack truth

This wave authored `packages/contracts/pack-manifests/lang-es.json` (Spanish)
as a bounded product language per VE-DISTRO-ADR-0003 in the distro repo.
Filipino (`lang-fil`) was NOT authored — Filipino is not a bounded product
language and the PH market profile's eligibility conditions for `lang-fil`
correctly note the requirement for a future distro ADR.

## Pack integrity audit enhancement

`lib/contract-loader.mjs` now classifies missing pack warnings:
- **mandated/default-on** packs missing a manifest → genuine issue
- **eligible** packs missing a manifest → policy-deferred (eligibility conditions not met)

This distinction prevents false alarm when `lang-fil` correctly lacks a manifest.

## Files in this wave

| File | Purpose |
|------|---------|
| `apps/control-plane/lib/plan-resolver.mjs` | Deterministic composition engine |
| `apps/control-plane/lib/drift-audit.mjs` | Startup drift audit |
| `apps/control-plane/lib/contract-loader.mjs` | Enhanced pack integrity classification |
| `apps/control-plane/routes/review.mjs` | W4/W5/W6 resolver-backed |
| `apps/control-plane/server.mjs` | Drift audit wiring |
| `apps/control-plane/public/app.js` | Resolution preview rendering |
| `packages/contracts/pack-manifests/lang-es.json` | Spanish language pack manifest |
| `packages/contracts/legal-market-profiles/US.json` | Updated eligibility + readiness |
| `packages/contracts/effective-tenant-configuration-plans/US-staging-hospital-core.json` | Updated deferred reason |
