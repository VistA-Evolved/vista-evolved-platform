# Control Plane — Local Review Runtime

> **Local dev server serving read-only API routes and review-only write simulation routes.**
> 4 read routes are contract-backed (loaded from `packages/contracts/`); the rest are fixture-backed.
> No external services required. Review routes validate inputs and return honest envelopes — no persistence, no mutation, no fake success.

## What it is

A local Fastify dev server that:

1. Serves a vanilla HTML/CSS/JS single-page UI from `public/`
2. Exposes **12 read-only API routes** at `/api/control-plane/v1/*` — 4 contract-backed, 8 fixture-backed
3. Exposes **15 review-only write simulation routes** at `/api/control-plane-review/v1/*` plus a discovery endpoint
4. Renders all 8 canonical control-plane surfaces with functional review dialogs for all 15 contracted write actions

Route names and response shapes align with the authoritative OpenAPI contract:
`packages/contracts/openapi/control-plane-operator-bootstrap-and-provisioning.openapi.yaml`

## How to run

```bash
cd apps/control-plane
npm install   # first time only
npm start     # starts on http://127.0.0.1:4500
```

For file-watching during development:

```bash
npm run dev
```

## API routes

| # | Operation | Route | Source |
|---|-----------|-------|--------|
| R1 | listTenants | `GET /api/control-plane/v1/tenants` | Fixture: `fixtures/tenants.json` |
| R2 | getTenant | `GET /api/control-plane/v1/tenants/:tenantId` | Fixture: `fixtures/tenants.json` |
| R3 | listLegalMarketProfiles | `GET /api/control-plane/v1/legal-market-profiles` | **Contract:** `packages/contracts/legal-market-profiles/` |
| R4 | getLegalMarketProfile | `GET /api/control-plane/v1/legal-market-profiles/:id` | **Contract:** `packages/contracts/legal-market-profiles/` |
| R5 | listBootstrapRequests | `GET /api/control-plane/v1/tenant-bootstrap-requests` | Fixture: `fixtures/bootstrap-requests.json` |
| R6 | getBootstrapRequest | `GET /api/control-plane/v1/tenant-bootstrap-requests/:id` | Fixture: `fixtures/bootstrap-requests.json` |
| R7 | listProvisioningRuns | `GET /api/control-plane/v1/provisioning-runs` | Fixture: `fixtures/provisioning-runs.json` |
| R8 | getProvisioningRun | `GET /api/control-plane/v1/provisioning-runs/:id` | Fixture: `fixtures/provisioning-runs.json` |
| R9 | listPacks | `GET /api/control-plane/v1/packs` | Fixture: `fixtures/packs.json` |
| R10 | getSystemConfig | `GET /api/control-plane/v1/system-config` | Fixture: `fixtures/system-config.json` |
| — | listCapabilities | `GET /api/control-plane/v1/capabilities` | **Contract:** `packages/contracts/capability-manifests/` |
| — | listEffectivePlans | `GET /api/control-plane/v1/effective-plans` | **Contract:** `packages/contracts/effective-tenant-configuration-plans/` |

Unknown IDs return 404. Fixture `_provenance` metadata is stripped from fixture-backed API responses.
Contract-backed routes load data from `packages/contracts/` via `lib/contract-loader.mjs` at startup.

## Review-only write simulation routes

All 15 contracted write actions from the OpenAPI specification are exposed as **local review-only routes** at `/api/control-plane-review/v1/*`. These routes:

- Validate input fields against required/optional schemas
- Return an honest `ReviewEnvelope` with `mode: "local-review"`, `executed: false`, `persistence: "none"`
- Project which AsyncAPI events *would* be emitted
- Include audit preview, guardrails, and notes
- **Never persist anything, never modify fixtures, never fake success**

| # | Action | HTTP | Review Route | Surface |
|---|--------|------|-------------|---------|
| W1 | suspendTenant | POST | `/tenants/:tenantId/suspend` | Tenant Detail |
| W2 | reactivateTenant | POST | `/tenants/:tenantId/reactivate` | Tenant Detail |
| W3 | archiveTenant | POST | `/tenants/:tenantId/archive` | Tenant Detail |
| W4 | resolveEffConfigPlan | POST | `/effective-configuration-plans/resolve` | Tenant Registry, Bootstrap |
| W5 | createBootstrapRequest | POST | `/tenant-bootstrap-requests` | Bootstrap |
| W6 | createProvisioningRun | POST | `/provisioning-runs` | Provisioning |
| W7 | cancelProvisioningRun | POST | `/provisioning-runs/:provisioningRunId/cancel` | Provisioning |
| W8 | createMarketDraft | POST | `/legal-market-profiles` | Markets |
| W9 | updateMarketDraft | PUT | `/legal-market-profiles/:legalMarketId` | Market Detail |
| W10 | submitMarketForReview | POST | `/legal-market-profiles/:legalMarketId/submit-review` | Market Detail |
| W11 | createPackDraft | POST | `/packs` | Pack Catalog |
| W12 | updatePackDraft | PUT | `/packs/:packId` | Pack Catalog |
| W13 | submitPackForReview | POST | `/packs/:packId/submit-review` | Pack Catalog |
| W14 | updateFeatureFlag | PUT | `/system-config/feature-flags/:flagKey` | System Config |
| W15 | updateSystemParameter | PUT | `/system-config/parameters/:paramKey` | System Config |
| — | listReviewActions | GET | `/actions` | Discovery |

All review routes are prefixed with `/api/control-plane-review/v1`.

## 8 Surfaces

| # | Surface | Route | Source Contract |
|---|---------|-------|-----------------|
| 1 | Tenant Registry | `#/tenants` | `control-plane.tenants.list` |
| 2 | Tenant Detail | `#/tenants/detail` | `control-plane.tenants.detail` |
| 3 | Tenant Bootstrap | `#/tenants/bootstrap` | `control-plane.tenants.bootstrap` |
| 4 | Provisioning Runs | `#/provisioning` | `control-plane.provisioning.runs` |
| 5 | Market Management | `#/markets` | `control-plane.markets.management` |
| 6 | Market Detail | `#/markets/detail` | `control-plane.markets.detail` |
| 7 | Pack Catalog | `#/packs` | `control-plane.packs.catalog` |
| 8 | System Config | `#/system-config` | `control-plane.system.config` |

## Write control posture

- **Batch 1 reads (R1-R10 + capabilities + effective-plans):** R3, R4, capabilities, effective-plans are contract-backed; all others are fixture-backed.
- **Batch 1 writes (W1-W4):** Review-only simulation via `/api/control-plane-review/v1/*`. UI opens review dialogs.
- **Batch 2 writes (W5-W7):** Review-only simulation via `/api/control-plane-review/v1/*`. UI opens review dialogs.
- **Batch 3 writes (W8-W15):** Review-only simulation via `/api/control-plane-review/v1/*`. UI opens review dialogs.

All 15 write actions have review routes and UI dialogs. No write action persists data, modifies fixtures, or fakes success. Every review response includes `executed: false` and `persistence: "none"`.

### Review envelope structure

```json
{
  "mode": "local-review",
  "executed": false,
  "persistence": "none",
  "canonicalOperationId": "suspendTenant",
  "validation": { "valid": true, "errors": [] },
  "projectedEvents": ["tenant.lifecycle.suspended"],
  "auditPreview": { "who": "local-reviewer", "what": "Reviewed: suspend tenant ph-demo-clinic-001" },
  "guardrails": ["Requires active tenant status"],
  "notes": ["Review-only: no state was mutated"]
}
```

## Fixture provenance

All fixture JSON files in `fixtures/` include `_provenance` metadata tracing each
value back to its source contract artifact. The `_provenance` key is stripped from
API responses so clients see clean data matching the OpenAPI response schemas.

## What this is NOT

- Not a production runtime — hybrid contract/fixture-backed, no real data store.
- Not a design mockup — layout follows the screen-contract spec, not visual design.
- Not persistent — form inputs reset on navigation. Write routes are review-only (local simulation, no persistence).
