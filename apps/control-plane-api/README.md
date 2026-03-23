# Control Plane Admin API

Postgres-backed operator-state engine for tenant lifecycle, bootstrap,
provisioning, and audit. This is the write-side backend for the
operator console at `apps/control-plane`.

## Quick Start

```bash
# 1. Start PostgreSQL
docker compose -f apps/control-plane-api/docker-compose.yml up -d

# 2. Configure environment
cd apps/control-plane-api
cp .env.example .env
# Edit .env — set CONTROL_PLANE_PG_URL:
#   CONTROL_PLANE_PG_URL=postgresql://cp_admin:cp_admin_dev@127.0.0.1:5433/control_plane

# 3. Run migrations
npm run migrate

# 4. Start the API
npm start
# → Listening on 127.0.0.1:4510
```

## Architecture

```
src/
  domain/types.mjs       — State enums, transition maps, validation
  db/pool.mjs            — PG connection pool
  db/migrate.mjs         — Forward-only idempotent migrations (10 versions)
  repos/                 — Direct SQL persistence (no ORM)
    tenant-repo.mjs      — Tenant CRUD + transactional status transitions
    bootstrap-repo.mjs   — Bootstrap draft + request persistence
    provisioning-repo.mjs — Provisioning run + canonical steps
    audit-repo.mjs       — Append-only audit trail + outbox
    operator-surface-repo.mjs — Invitations, alerts, usage, entitlements, flags
  services/              — Guarded commands with audit + outbox
    tenant-service.mjs   — Tenant lifecycle (create, activate, suspend, reactivate, archive)
    bootstrap-service.mjs — Draft editing, validation, submission, approval
    provisioning-service.mjs — Run creation, queueing, cancellation
    billing-adapter.mjs  — Lago REST API wrapper (customers, subscriptions, events, invoices)
  routes/                — HTTP handlers
    tenant-routes.mjs    — /api/control-plane-admin/v1/tenants/*
    bootstrap-routes.mjs — /api/control-plane-admin/v1/bootstrap/*
    provisioning-routes.mjs — /api/control-plane-admin/v1/provisioning/*
    audit-routes.mjs     — /api/control-plane-admin/v1/audit/*
    operator-surface-routes.mjs — /api/control-plane-admin/v1/operator/*
    billing-routes.mjs   — /api/control-plane/v1/billing/*
  server.mjs             — Fastify server entry point (port 4510)
```

## API Endpoints

### Tenants
| Method | Path | Description |
|--------|------|-------------|
| POST   | `/api/control-plane-admin/v1/tenants` | Create tenant draft |
| GET    | `/api/control-plane-admin/v1/tenants` | List tenants |
| GET    | `/api/control-plane-admin/v1/tenants/:id` | Get tenant |
| POST   | `/api/control-plane-admin/v1/tenants/:id/activate` | Activate tenant |
| POST   | `/api/control-plane-admin/v1/tenants/:id/suspend` | Suspend tenant |
| POST   | `/api/control-plane-admin/v1/tenants/:id/reactivate` | Reactivate |
| POST   | `/api/control-plane-admin/v1/tenants/:id/archive` | Archive tenant |
| GET    | `/api/control-plane-admin/v1/tenants/:id/transitions` | Transition history |

### Bootstrap
| Method | Path | Description |
|--------|------|-------------|
| POST   | `/api/control-plane-admin/v1/bootstrap/drafts` | Create draft |
| GET    | `/api/control-plane-admin/v1/bootstrap/drafts/:id` | Get draft |
| PATCH  | `/api/control-plane-admin/v1/bootstrap/drafts/:id` | Update draft |
| POST   | `/api/control-plane-admin/v1/bootstrap/drafts/:id/validate` | Validate draft |
| POST   | `/api/control-plane-admin/v1/bootstrap/drafts/:id/submit` | Submit for approval |
| GET    | `/api/control-plane-admin/v1/bootstrap/requests` | List requests |
| GET    | `/api/control-plane-admin/v1/bootstrap/requests/:id` | Get request |
| POST   | `/api/control-plane-admin/v1/bootstrap/requests/:id/approve` | Approve |
| POST   | `/api/control-plane-admin/v1/bootstrap/requests/:id/cancel` | Cancel |

### Provisioning
| Method | Path | Description |
|--------|------|-------------|
| POST   | `/api/control-plane-admin/v1/provisioning/runs` | Create run |
| GET    | `/api/control-plane-admin/v1/provisioning/runs` | List runs |
| GET    | `/api/control-plane-admin/v1/provisioning/runs/:id` | Get run |
| GET    | `/api/control-plane-admin/v1/provisioning/runs/:id/steps` | Get run + steps |
| POST   | `/api/control-plane-admin/v1/provisioning/runs/:id/queue` | Queue run |
| POST   | `/api/control-plane-admin/v1/provisioning/runs/:id/cancel` | Cancel run |

### Audit
| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/control-plane-admin/v1/audit/events` | List audit events |

### Operator Surfaces
| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/control-plane-admin/v1/operator/invitations` | List invitations |
| POST   | `/api/control-plane-admin/v1/operator/invitations` | Create invitation |
| GET    | `/api/control-plane-admin/v1/operator/alerts` | List alerts |
| POST   | `/api/control-plane-admin/v1/operator/alerts` | Create alert |
| POST   | `/api/control-plane-admin/v1/operator/alerts/:id/ack` | Acknowledge alert |
| GET    | `/api/control-plane-admin/v1/operator/usage-events` | List usage events |
| POST   | `/api/control-plane-admin/v1/operator/usage-events` | Record usage event |
| GET    | `/api/control-plane-admin/v1/operator/entitlements` | List entitlements |
| POST   | `/api/control-plane-admin/v1/operator/entitlements` | Create entitlement |
| GET    | `/api/control-plane-admin/v1/operator/feature-flags` | List feature flags |
| PUT    | `/api/control-plane-admin/v1/operator/feature-flags` | Update feature flags |

### Billing (Lago)
| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/control-plane/v1/billing/status` | Billing engine status |
| GET    | `/api/control-plane/v1/billing/customers/:tenantId` | Get Lago customer |
| POST   | `/api/control-plane/v1/billing/customers` | Create Lago customer |
| POST   | `/api/control-plane/v1/billing/subscriptions` | Create subscription |
| DELETE | `/api/control-plane/v1/billing/subscriptions/:externalId` | Terminate subscription |
| POST   | `/api/control-plane/v1/billing/events` | Send usage event |
| GET    | `/api/control-plane/v1/billing/invoices` | List invoices |
| GET    | `/api/control-plane/v1/billing/invoices/:invoiceId` | Get invoice |

Requires `LAGO_API_URL` and `LAGO_API_KEY` env vars. Returns `{ok:false, pending:true}` when unconfigured.

## State Machines

### Tenant: `draft → active → suspended ↔ active; active|suspended → archived`
### Bootstrap Draft: `draft → validated → approval_required → approved → queued → superseded`
### Provisioning Run: `draft → queued → running → completed|failed|waiting_on_dependency`

All transitions are guarded by the domain transition map in `domain/types.mjs`.
Invalid transitions return `{ ok: false, reason: "..." }`.

## Persistence

- PostgreSQL only (per `docs/reference/persistence-policy.md`)
- No ORM — explicit SQL via `pg` library
- Transactional status transitions with `SELECT FOR UPDATE` row locks
- Forward-only migrations tracked in `_migrations` table
- Audit events are append-only (no UPDATE/DELETE)
- Outbox events support future reliable event delivery

## Port

4510 — registered in `docs/reference/port-registry.md`
