# Operator Console — Hybrid Operator Runtime

> **Local dev server serving the operator console as a 22-surface SPA across 8 domains.**
> Read data is sourced from four tiers: **real-backend** (PG-backed via `apps/control-plane-api/` on port 4510, with fixture fallback), **contract-backed** (from `packages/contracts/`), **fixture-backed** (from `fixtures/`), and **static** (contracted IA only, no API).
> P0 graduated surfaces (Tenants, Bootstrap, Provisioning) use real-backend reads and writes when `control-plane-api` is running; they fall back to fixtures transparently when it is not.
> Review routes validate inputs and return honest envelopes — no persistence, no mutation, no fake success.
> An AI Operator Copilot subsystem is included but **disabled by default** (`COPILOT_ENABLED=false`).

## What it is

A local Fastify dev server that:

1. Serves a vanilla HTML/CSS/JS single-page UI from `public/`
2. Exposes **13 read-only API routes** at `/api/control-plane/v1/*` — 6 contract-backed, 7 hybrid (real-backend with fixture fallback)
3. Exposes **15 review-only write simulation routes** at `/api/control-plane-review/v1/*` plus a discovery endpoint
4. Exposes **P0 lifecycle proxy routes** at `/api/control-plane-lifecycle/v1/*` — real-backend writes for graduated surfaces (Tenants, Bootstrap, Provisioning)
5. Exposes **AI copilot routes** at `/api/copilot/v1/*` — status, chat, and audit (disabled by default)
6. Renders **22 operator-console surfaces** across 8 domains with functional review dialogs for all 15 contracted write actions

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

### Optional: real backend for P0 surfaces

When `apps/control-plane-api` is running on port 4510, the P0 graduated surfaces
(Tenants, Bootstrap, Provisioning) read and write against the PG-backed real backend.
When it is not running, they fall back to fixture data transparently.

```bash
# In a separate terminal:
cd apps/control-plane-api
cp .env.example .env      # first time only — configure PLATFORM_PG_URL
npm install
npm start                 # starts on http://127.0.0.1:4510
```

The real backend URL is configurable via `REAL_BACKEND_URL` (default: `http://127.0.0.1:4510`).

## Local operator-access enforcement

All API routes enforce a **local operator-access layer** (not real authentication).
The active role is read from the `X-Local-Role` request header.

| Behavior | Detail |
|----------|--------|
| Default role | `platform-operator` (when no header is sent) |
| Allowed role | `platform-operator` — full access to all control-plane routes |
| Denied roles | `tenant-admin`, `clinician`, `ancillary-staff`, `revenue-cycle-staff`, `analyst`, `it-integration` |
| Invalid role | Returns 400 with valid role list |
| Denied response | 403 with `{ error: "access_denied", activeRole, requiredRole }` |

The UI includes a role switcher in the top banner. Selecting a non-operator role triggers
403 responses and displays an access-denied state. This is a local review-only simulation
derived from `docs/reference/permissions-matrix.md` — not a real auth subsystem.

Static assets (HTML/CSS/JS) are always served regardless of role, so the UI can render
the access-denied state and role switcher.

The explicit route-to-surface-to-action mapping is maintained in `lib/access-map.mjs`.
See `docs/explanation/control-plane-local-operator-access-foundation-wave-1.md` for full rationale.

## API routes

| # | Operation | Route | Source |
|---|-----------|-------|--------|
| R1 | listTenants | `GET /api/control-plane/v1/tenants` | **Hybrid:** real-backend → fixture fallback |
| R2 | getTenant | `GET /api/control-plane/v1/tenants/:tenantId` | **Hybrid:** real-backend → fixture fallback |
| R3 | listLegalMarketProfiles | `GET /api/control-plane/v1/legal-market-profiles` | **Contract:** `packages/contracts/legal-market-profiles/` |
| R4 | getLegalMarketProfile | `GET /api/control-plane/v1/legal-market-profiles/:id` | **Contract:** `packages/contracts/legal-market-profiles/` |
| R5 | listBootstrapRequests | `GET /api/control-plane/v1/tenant-bootstrap-requests` | **Hybrid:** real-backend → fixture fallback |
| R6 | getBootstrapRequest | `GET /api/control-plane/v1/tenant-bootstrap-requests/:id` | **Hybrid:** real-backend → fixture fallback |
| R7 | listProvisioningRuns | `GET /api/control-plane/v1/provisioning-runs` | **Hybrid:** real-backend → fixture fallback |
| R8 | getProvisioningRun | `GET /api/control-plane/v1/provisioning-runs/:id` | **Hybrid:** real-backend → fixture fallback |
| R9 | listPacks | `GET /api/control-plane/v1/packs` | **Contract:** `packages/contracts/pack-manifests/` + 1 fabricated demo |
| R9b | getPack | `GET /api/control-plane/v1/packs/:packId` | **Contract:** `packages/contracts/pack-manifests/` + 1 fabricated demo |
| R10 | getSystemConfig | `GET /api/control-plane/v1/system-config` | Fixture: `fixtures/system-config.json` |
| — | listCapabilities | `GET /api/control-plane/v1/capabilities` | **Contract:** `packages/contracts/capability-manifests/` |
| — | listEffectivePlans | `GET /api/control-plane/v1/effective-plans` | **Contract:** `packages/contracts/effective-tenant-configuration-plans/` |

Unknown IDs return 404. Fixture `_provenance` metadata is stripped from fixture-backed API responses.
Contract-backed routes load data from `packages/contracts/` via `lib/contract-loader.mjs` at startup.

## P0 lifecycle proxy routes (real backend)

When `control-plane-api` is running, the following routes proxy write mutations to the real backend.
The UI uses these routes for the graduated P0 surfaces (Tenants, Bootstrap, Provisioning).

| # | Action | HTTP | Route | Backend endpoint |
|---|--------|------|-------|------------------|
| L1 | createTenant | POST | `/api/control-plane-lifecycle/v1/tenants` | `POST /api/v1/tenants` |
| L2 | suspendTenant | POST | `/api/control-plane-lifecycle/v1/tenants/:id/suspend` | `POST /api/v1/tenants/:id/suspend` |
| L3 | reactivateTenant | POST | `/api/control-plane-lifecycle/v1/tenants/:id/reactivate` | `POST /api/v1/tenants/:id/reactivate` |
| L4 | archiveTenant | POST | `/api/control-plane-lifecycle/v1/tenants/:id/archive` | `POST /api/v1/tenants/:id/archive` |
| L5 | createBootstrapRequest | POST | `/api/control-plane-lifecycle/v1/bootstrap-requests` | `POST /api/v1/bootstrap-requests` |
| L6 | approveBootstrapRequest | POST | `/api/control-plane-lifecycle/v1/bootstrap-requests/:id/approve` | `POST /api/v1/bootstrap-requests/:id/approve` |
| L7 | rejectBootstrapRequest | POST | `/api/control-plane-lifecycle/v1/bootstrap-requests/:id/reject` | `POST /api/v1/bootstrap-requests/:id/reject` |
| L8 | startProvisioningRun | POST | `/api/control-plane-lifecycle/v1/provisioning-runs` | `POST /api/v1/provisioning-runs` |
| L9 | cancelProvisioningRun | POST | `/api/control-plane-lifecycle/v1/provisioning-runs/:id/cancel` | `POST /api/v1/provisioning-runs/:id/cancel` |
| L10 | retryProvisioningRun | POST | `/api/control-plane-lifecycle/v1/provisioning-runs/:id/retry` | `POST /api/v1/provisioning-runs/:id/retry` |

When the backend is unreachable, the UI shows a `fixture-fallback` source badge.
Responses from the real backend include `_source: "real-backend"`.

## AI Operator Copilot routes

Disabled by default (`COPILOT_ENABLED=false`). Set `COPILOT_ENABLED=true` and configure
a provider via `COPILOT_PROVIDER` (default: `openai`) to activate.

| # | Operation | HTTP | Route | Notes |
|---|-----------|------|-------|-------|
| C1 | copilotStatus | GET | `/api/copilot/v1/status` | Always returns copilot health (works even when disabled) |
| C2 | copilotChat | POST | `/api/copilot/v1/chat` | Governed chat — returns 503 when copilot is disabled |
| C3 | copilotAudit | GET | `/api/copilot/v1/audit` | Interaction audit trail |

The copilot uses 8 bounded tools with operator-role enforcement and full audit logging.
See `docs/explanation/ai-assist-safety-spec.md` for governance details.

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

## 22 Surfaces (8 domains)

### Home

| # | Surface | Hash Route | Surface ID | Data Source |
|---|---------|-----------|------------|-------------|
| 1 | Home | `#/home` | `control-plane.home` | Semi-live (fixture aggregation) |

### Requests & Onboarding

| # | Surface | Hash Route | Surface ID | Data Source |
|---|---------|-----------|------------|-------------|
| 2 | Onboarding Requests | `#/bootstrap` | `control-plane.tenants.bootstrap` | **Hybrid** (real-backend / fixture fallback) |
| 3 | Provisioning Runs | `#/provisioning` | `control-plane.provisioning.runs` | **Hybrid** (real-backend / fixture fallback) |
| 4 | Identity & Invitations | `#/identity` | `control-plane.identity.invitations` | Static |

### Tenants

| # | Surface | Hash Route | Surface ID | Data Source |
|---|---------|-----------|------------|-------------|
| 5 | Tenant Registry | `#/tenants` | `control-plane.tenants.list` | **Hybrid** (real-backend / fixture fallback) |
| 6 | Tenant Detail | `#/tenants/detail` | `control-plane.tenants.detail` | **Hybrid** (real-backend / fixture fallback) |

### Operations

| # | Surface | Hash Route | Surface ID | Data Source |
|---|---------|-----------|------------|-------------|
| 7 | Operations Center | `#/operations` | `control-plane.operations.center` | Semi-live (fixture) |
| 8 | Alert Center | `#/alerts` | `control-plane.ops.alerts` | Static |
| 9 | Backup & DR | `#/backup-dr` | `control-plane.ops.backup-dr` | Static |
| 10 | Environments & Flags | `#/environments` | `control-plane.ops.environments` | Static |

### Support

| # | Surface | Hash Route | Surface ID | Data Source |
|---|---------|-----------|------------|-------------|
| 11 | Support Console | `#/support` | `control-plane.support.console` | Static |

### Commercial

| # | Surface | Hash Route | Surface ID | Data Source |
|---|---------|-----------|------------|-------------|
| 12 | Billing & Entitlements | `#/billing` | `control-plane.commercial.billing` | Semi-live (fixture) |
| 13 | Usage Metering | `#/usage` | `control-plane.commercial.usage` | Static |

### Catalogs & Governance

| # | Surface | Hash Route | Surface ID | Data Source |
|---|---------|-----------|------------|-------------|
| 14 | Market Management | `#/markets` | `control-plane.markets.management` | Contract |
| 15 | Market Detail | `#/markets/detail` | `control-plane.markets.detail` | Contract |
| 16 | Pack Catalog | `#/packs` | `control-plane.packs.catalog` | Contract |
| 17 | Payer Readiness | `#/payer-readiness` | `control-plane.markets.payer-readiness` | Static |
| 18 | Eligibility Simulator | `#/eligibility-sim` | `control-plane.markets.eligibility-sim` | Static |

### Platform

| # | Surface | Hash Route | Surface ID | Data Source |
|---|---------|-----------|------------|-------------|
| 19 | System Config | `#/system-config` | `control-plane.system.config` | Fixture |
| 20 | Audit Trail | `#/audit` | `control-plane.platform.audit` | Static |
| 21 | Templates & Presets | `#/templates` | `control-plane.platform.templates` | Static |
| 22 | Runbooks Hub | `#/runbooks` | `control-plane.platform.runbooks` | Static |

### Data sourcing tiers

| Tier | Description | Surfaces |
|------|-------------|----------|
| **Real-backend (hybrid)** | PG-backed reads/writes via `control-plane-api` (port 4510), with transparent fixture fallback when backend is unavailable | Tenants (#5-6), Bootstrap (#2), Provisioning (#3) |
| **Contract-backed** | Live data loaded from `packages/contracts/` at startup | Markets, Market Detail, Packs, Capabilities, Effective Plans |
| **Fixture-backed** | Static JSON from `fixtures/` | System Config |
| **Semi-live** | Aggregates from existing fixture/contract data | Home, Operations Center, Billing & Entitlements |
| **Static** | Contracted IA only — no API route, no data | 13 surfaces (Identity, Payer Readiness, Eligibility Sim, Alerts, Backup & DR, Environments, Usage, Support, Audit, Templates, Runbooks) |

## Write control posture

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

## Composition engine (resolver)

The control plane includes a **deterministic effective-configuration composition engine**
in `lib/plan-resolver.mjs`. This resolver computes which packs apply to a given
market + tenant configuration without any runtime infrastructure.

### How it works

Given a legal market ID and optional tenant selections (selected packs, deselected defaults),
the resolver:

1. Looks up the legal market profile (mandated, default-on, eligible, excluded packs)
2. Builds an exclusion set from the market's `excludedPacks`
3. Resolves mandated packs (required by law — always included if the manifest exists)
4. Resolves default-on packs (included unless the tenant deselects, honoring deactivation constraints)
5. Resolves eligible packs (included only if the tenant explicitly selects them)
6. Runs a dependency resolution pass (adds any required dependencies not already resolved)
7. Computes a readiness posture with gating blockers

The output is a `resolution` object containing `resolvedPacks`, `deferredItems`,
`dependencyIssues`, and `readinessPosture`.

### Resolver-backed review routes

- **W4** (`POST .../effective-configuration-plans/resolve`) — runs the full resolver and returns
  a `resolutionPreview` in the review envelope
- **W5** (`POST .../tenant-bootstrap-requests`) — includes a `resolverPreflight` summary
  showing how many packs would resolve for the specified market
- **W6** (`POST .../provisioning-runs`) — includes a `resolverPreflight` note

### Startup drift audit

At startup, `lib/drift-audit.mjs` re-resolves each seed effective plan and compares
the output to the seed's static data. Drift categories include `resolver-version-stale`,
`deferred-reason-changed`, `pack-count-changed`, etc. Drift is reported as startup
warnings — it does not block the server.

### Pack integrity audit

At startup, `lib/contract-loader.mjs` validates that all pack IDs referenced by market
profiles, capabilities, and effective plans resolve to actual manifests. Warnings distinguish:
- **mandated/default-on** packs missing a manifest — genuine issue
- **eligible** packs missing a manifest — policy-deferred (eligibility conditions not yet met)

## What this is NOT

- Not a production runtime — graduated hybrid posture: P0 lifecycle surfaces backed by real PG backend; remaining surfaces contract/fixture/static-backed.
- Not a design mockup — layout follows the screen-contract spec, not visual design.
- Not fully persistent — form inputs reset on navigation. Review write routes are simulation-only (no persistence). Lifecycle writes are real backend mutations when reachable.
- Not auth — role switcher is local operator-access enforcement only, not a real IAM system.
- Not real authentication — the local operator-access layer simulates role enforcement via request header, not SSO/OIDC/JWT.
