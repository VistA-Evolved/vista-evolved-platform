# Operator Console — Control Plane Runtime

> Local dev server serving the operator console SPA.
> Read data is sourced from: **real-backend** (PG-backed via `apps/control-plane-api/` on port 4510) and **contract-backed** (from `packages/contracts/`).
> P0 graduated surfaces (Tenants, Bootstrap, Provisioning) read and write against the real backend.
> When the backend is unavailable, proxy routes return `{ ok: false, source: "unavailable" }`.

## What it is

A local Fastify dev server that:

1. Serves a vanilla HTML/CSS/JS single-page UI from `public/`
2. Exposes **read-only API routes** at `/api/control-plane/v1/*` — contract-backed and real-backend proxy
3. Exposes **lifecycle proxy routes** at `/api/control-plane-lifecycle/v1/*` — real writes to control-plane-api
4. Renders **22 operator-console surfaces** across 8 domains

Route names and response shapes align with:
`packages/contracts/openapi/control-plane-operator-bootstrap-and-provisioning.openapi.yaml`

## How to run

```bash
cd apps/control-plane
npm install   # first time only
npm start     # starts on http://127.0.0.1:4500
```

### Required: real backend for data

The operator console requires `apps/control-plane-api` running on port 4510 for tenant, bootstrap, and provisioning data.

```bash
cd apps/control-plane-api
cp .env.example .env      # first time only — configure PLATFORM_PG_URL
npm install
npm start                 # starts on http://127.0.0.1:4510
```

The backend URL is configurable via `REAL_BACKEND_URL` (default: `http://127.0.0.1:4510`).

## API routes

| # | Operation | Route | Source |
|---|-----------|-------|--------|
| R1 | listTenants | `GET /api/control-plane/v1/tenants` | Real-backend |
| R2 | getTenant | `GET /api/control-plane/v1/tenants/:tenantId` | Real-backend |
| R3 | listLegalMarketProfiles | `GET /api/control-plane/v1/legal-market-profiles` | Contract |
| R4 | getLegalMarketProfile | `GET /api/control-plane/v1/legal-market-profiles/:id` | Contract |
| R5 | listBootstrapRequests | `GET /api/control-plane/v1/tenant-bootstrap-requests` | Real-backend |
| R6 | getBootstrapRequest | `GET /api/control-plane/v1/tenant-bootstrap-requests/:id` | Real-backend |
| R7 | listProvisioningRuns | `GET /api/control-plane/v1/provisioning-runs` | Real-backend |
| R8 | getProvisioningRun | `GET /api/control-plane/v1/provisioning-runs/:id` | Real-backend |
| R9 | listPacks | `GET /api/control-plane/v1/packs` | Contract |
| R9b | getPack | `GET /api/control-plane/v1/packs/:packId` | Contract |
| R10 | getSystemConfig | `GET /api/control-plane/v1/system-config` | Unavailable (no backend yet) |
| — | listCapabilities | `GET /api/control-plane/v1/capabilities` | Contract |
| — | listEffectivePlans | `GET /api/control-plane/v1/effective-plans` | Contract |

## Lifecycle proxy routes

| # | Action | HTTP | Route |
|---|--------|------|-------|
| L1 | createTenant | POST | `/api/control-plane-lifecycle/v1/tenants` |
| L2 | suspendTenant | POST | `/api/control-plane-lifecycle/v1/tenants/:id/suspend` |
| L3 | reactivateTenant | POST | `/api/control-plane-lifecycle/v1/tenants/:id/reactivate` |
| L4 | archiveTenant | POST | `/api/control-plane-lifecycle/v1/tenants/:id/archive` |
| L5 | createBootstrapRequest | POST | `/api/control-plane-lifecycle/v1/bootstrap-requests` |
| L6 | approveBootstrapRequest | POST | `/api/control-plane-lifecycle/v1/bootstrap-requests/:id/approve` |
| L7 | rejectBootstrapRequest | POST | `/api/control-plane-lifecycle/v1/bootstrap-requests/:id/reject` |
| L8 | startProvisioningRun | POST | `/api/control-plane-lifecycle/v1/provisioning-runs` |
| L9 | cancelProvisioningRun | POST | `/api/control-plane-lifecycle/v1/provisioning-runs/:id/cancel` |
| L10 | retryProvisioningRun | POST | `/api/control-plane-lifecycle/v1/provisioning-runs/:id/retry` |

## Data sourcing

| Tier | Description | Surfaces |
|------|-------------|----------|
| **Real-backend** | PG-backed via `control-plane-api` (port 4510) | Tenants, Bootstrap, Provisioning, Audit, Operator data |
| **Contract-backed** | From `packages/contracts/` at startup | Markets, Packs, Capabilities, Effective Plans |
| **Static** | Contracted IA only — no API route | Identity, Payer Readiness, Eligibility Sim, Alerts, Backup & DR, Environments, Usage, Support, Audit, Templates, Runbooks |

## What this is NOT

- Not a production runtime — development/review environment only
- Not a design mockup — layout follows the screen-contract spec
- Not auth — role switcher is local operator-access enforcement, not a real IAM system
