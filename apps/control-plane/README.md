# Control Plane — Local Review Runtime

> **Local dev server serving fixture-backed read-only API routes.**
> All data comes from checked-in fixture JSON; no external services required.
> Read-only. No persistence. No authentication. No writes.

## What it is

A local Fastify dev server that:

1. Serves a vanilla HTML/CSS/JS single-page UI from `public/`
2. Exposes **12 read-only API routes** at `/api/control-plane/v1/*` backed by fixture JSON
3. Renders all 8 canonical control-plane surfaces

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

| # | Operation | Route | Source Fixture |
|---|-----------|-------|----------------|
| R1 | listTenants | `GET /api/control-plane/v1/tenants` | `fixtures/tenants.json` |
| R2 | getTenant | `GET /api/control-plane/v1/tenants/:tenantId` | `fixtures/tenants.json` |
| R3 | listLegalMarketProfiles | `GET /api/control-plane/v1/legal-market-profiles` | `fixtures/legal-market-profiles.json` |
| R4 | getLegalMarketProfile | `GET /api/control-plane/v1/legal-market-profiles/:id` | `fixtures/legal-market-profiles.json` |
| R5 | listBootstrapRequests | `GET /api/control-plane/v1/tenant-bootstrap-requests` | `fixtures/bootstrap-requests.json` |
| R6 | getBootstrapRequest | `GET /api/control-plane/v1/tenant-bootstrap-requests/:id` | `fixtures/bootstrap-requests.json` |
| R7 | listProvisioningRuns | `GET /api/control-plane/v1/provisioning-runs` | `fixtures/provisioning-runs.json` |
| R8 | getProvisioningRun | `GET /api/control-plane/v1/provisioning-runs/:id` | `fixtures/provisioning-runs.json` |
| R9 | listPacks | `GET /api/control-plane/v1/packs` | `fixtures/packs.json` |
| R10 | getSystemConfig | `GET /api/control-plane/v1/system-config` | `fixtures/system-config.json` |
| — | listCapabilities | `GET /api/control-plane/v1/capabilities` | `fixtures/capabilities.json` |
| — | listEffectivePlans | `GET /api/control-plane/v1/effective-plans` | `fixtures/effective-plans.json` |

Unknown IDs return 404. Fixture `_provenance` metadata is stripped from API responses.

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

- **Batch 1 reads (R1-R10):** Served from local API routes, fixture-backed.
- **Batch 1 writes (W1-W2):** Shown as functional controls with non-persistent disclaimer.
- **Batch 2 writes (W5-W8):** Disabled with "integration-pending" tooltip.
- **Batch 3 writes (W9-W16):** Disabled with "integration-pending" tooltip.

No write API routes are implemented. All mutation is blocked at the UI level.

## Fixture provenance

All fixture JSON files in `fixtures/` include `_provenance` metadata tracing each
value back to its source contract artifact. The `_provenance` key is stripped from
API responses so clients see clean data matching the OpenAPI response schemas.

## What this is NOT

- Not a production runtime — fixture-backed, no real data store.
- Not a design mockup — layout follows the screen-contract spec, not visual design.
- Not persistent — form inputs reset on navigation. No write routes exist.
