# Control-Plane Static-Review Prototype — Implementation Record (Batch 2)

> **⚠️ SUPERSEDED.** The 8-surface prototype described here was replaced by the 21-surface operator console rewrite (see `apps/control-plane/README.md` and `control-panel-design-contract-v2.md`). This document is retained as a historical implementation record.

> **Category:** explanation
>
> **Status:** superseded-implementation-record (describes what was originally built; runtime now has 21 surfaces)

## 1. What was built

A zero-dependency, vanilla HTML/CSS/JS single-page application in `apps/control-plane/`
that renders all 8 canonical control-plane surfaces using checked-in fixture JSON data.

| File | Purpose |
|------|---------|
| `apps/control-plane/index.html` | Single-page app shell with "STATIC REVIEW — NOT RUNTIME" banner, left-nav sidebar, hash-based navigation |
| `apps/control-plane/styles.css` | Minimal CSS covering layout, badges (all enum values), tables, cards, disabled buttons with tooltips, dimension grids, blocker lists |
| `apps/control-plane/app.js` | Hash-based router, fixture loader, 8 surface renderer functions, badge/tooltip/date helpers |
| `apps/control-plane/fixtures/*.json` | 8 fixture JSON files with `_provenance` metadata tracing values to source contract artifacts |
| `apps/control-plane/README.md` | Honest description of what the prototype is, how to open it, and what it is not |

## 2. The 8 surfaces

| # | Surface ID | Route | Contract Instance |
|---|-----------|-------|-------------------|
| 1 | control-plane.tenants.list | `#/tenants` | Tenant Registry — table of tenants with status/market/tier badges |
| 2 | control-plane.tenants.detail | `#/tenants/detail` | Tenant Detail — identity, bootstrap, provisioning, active packs, lifecycle actions |
| 3 | control-plane.tenants.bootstrap | `#/tenants/bootstrap` | Tenant Bootstrap — market selection, plan resolution, readiness posture, gating blockers |
| 4 | control-plane.provisioning.runs | `#/provisioning` | Provisioning Runs — runs table, per-run step detail, blockers, failures |
| 5 | control-plane.markets.management | `#/markets` | Market Management — markets table with pack counts and readiness badges |
| 6 | control-plane.markets.detail | `#/markets/detail` | Market Detail — profile, readiness dimensions, mandated/default-on/eligible pack groups, claim surface |
| 7 | control-plane.packs.catalog | `#/packs` | Pack Catalog — pack table, detail panel with dependencies/adapters/capabilities |
| 8 | control-plane.system.config | `#/system-config` | System Configuration — deployment profile, feature flags, system parameters by category |

## 3. Why vanilla HTML/CSS/JS

- `apps/control-plane/` had no existing toolchain, package.json, or framework.
- Adding a framework for static fixture rendering would violate the "no uncontrolled feature generation" rule.
- The prototype is a review artifact, not a product surface. It will be replaced by runtime implementation.
- Zero dependencies means zero build step — open `index.html` directly in any browser.

## 4. Fixture provenance

Every fixture JSON file includes a `_provenance` object recording:
- **source**: Which contract artifact the data derives from (verbatim for PH data, fabricated with schema reference for others)
- **generatedFor**: "Static review prototype — not real tenant data" (or similar)
- **schemaRef**: Which OpenAPI schema the fixture conforms to

| Fixture | Source |
|---------|--------|
| `tenants.json` | Fabricated from OpenAPI TenantSummary+TenantDetail; PH tenant uses real legalMarketId from PH.json |
| `bootstrap-requests.json` | Fabricated from OpenAPI TenantBootstrapRequestStatus schema |
| `provisioning-runs.json` | Fabricated from OpenAPI ProvisioningRunStatus+ProvisioningStep schemas |
| `legal-market-profiles.json` | PH: verbatim from `packages/contracts/legal-market-profiles/PH.json`; US: fabricated |
| `effective-plans.json` | Verbatim from `packages/contracts/effective-tenant-configuration-plans/PH-single-clinic-core.json` |
| `packs.json` | 5 real packs from `packages/contracts/pack-manifests/*.json`; 2 fabricated (US regulatory, specialty) |
| `capabilities.json` | Real from `packages/contracts/capability-manifests/*.json` |
| `system-config.json` | Fabricated from OpenAPI SystemConfigSnapshot schemas |

## 5. Write control posture

The design contract defines 3 batches of write actions. The prototype implements them as follows:

| Batch | Actions | Prototype Behavior |
|-------|---------|-------------------|
| Batch 1 reads (R1–R10) | All read operations | Rendered from fixture data |
| Batch 1 writes (W1 resolve, W2 submit bootstrap) | Plan resolution, bootstrap submit | Controls shown but non-persistent. Banner warns "STATIC REVIEW — NOT RUNTIME" |
| Batch 2 writes (W5–W8) | Cancel, suspend, reactivate, archive | Buttons disabled with "integration-pending" tooltip |
| Batch 3 writes (W9–W16) | Market/pack CRUD, system config toggles | Buttons disabled with "integration-pending" tooltip |

## 6. What "Batch 2" means

This explanation doc is named "Batch 2" to distinguish it from the existing Batch 1
design contract doc (`control-panel-design-contract-and-static-review-prototype-batch-1.md`),
which specifies the design contract and review criteria. This doc records the actual
implementation of the prototype that the design contract governs.

## 7. Implementation matrix

| Requirement | Status |
|------------|--------|
| All 8 surfaces rendered | Done — all 8 hash routes render |
| PH draft/T0 visible on ≥1 surface | Done — PH market + effective plan display "draft" and "T0" |
| Empty state on ≥1 surface | Done — empty state helper exists; tenant detail shows empty state for missing bootstrap |
| Error state on ≥1 surface | Done — error state helper rendered in provisioning runs |
| Disabled write controls with "integration-pending" tooltip | Done — Batch 2 and Batch 3 actions all disabled |
| Fixture provenance metadata | Done — all 8 fixtures have `_provenance` |
| "STATIC REVIEW — NOT RUNTIME" banner | Done — persistent banner in index.html |
| No framework, no build, no package.json | Done — vanilla HTML/CSS/JS |
| No files outside apps/control-plane/ except this doc | Done — only this explanation doc added |

## 8. How to review

1. Open `apps/control-plane/index.html` in a browser.
2. Click each of the 8 left-nav links.
3. For each surface, verify:
   - Data matches the contract schema fields (check against OpenAPI spec).
   - Badge colors/labels match enum values.
   - Disabled buttons show tooltips on hover.
   - Navigation between surfaces works (breadcrumbs, row clicks, cross-links).
4. Check the PH market detail — all values should match `PH.json` verbatim.
5. Check the effective plan — all values should match `PH-single-clinic-core.json` verbatim.

## 9. Files changed (complete list)

**Created:**
- `apps/control-plane/index.html`
- `apps/control-plane/styles.css`
- `apps/control-plane/app.js`
- `apps/control-plane/fixtures/tenants.json`
- `apps/control-plane/fixtures/bootstrap-requests.json`
- `apps/control-plane/fixtures/provisioning-runs.json`
- `apps/control-plane/fixtures/legal-market-profiles.json`
- `apps/control-plane/fixtures/effective-plans.json`
- `apps/control-plane/fixtures/packs.json`
- `apps/control-plane/fixtures/capabilities.json`
- `apps/control-plane/fixtures/system-config.json`
- `docs/explanation/control-plane-static-review-prototype-implementation-batch-2.md` (this file)

**Modified:**
- `apps/control-plane/README.md` (replaced placeholder with prototype description)
- `docs/reference/source-of-truth-index.md` (registered this explanation doc)
