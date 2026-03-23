# VE-PLAT-ADR-0008: IT Support System Integration Strategy

**Status:** proposed
**Date:** 2026-03-23
**Deciders:** Platform team (pending review)

## Context

VistA Evolved deployments generate operational events that require human
follow-up: failed migrations, broken RPC connections, tenant provisioning
failures, billing sync errors, and user access issues. Today there is no
structured path from a platform alert to a tracked support ticket.

Operator staff currently:
- Discover problems by reading server logs manually.
- Communicate via informal channels (email, Teams) with no ticket trail.
- Have no SLA visibility or escalation path.

This is a gap for:
- **Internal teams** deploying VistA Evolved at VA facilities.
- **SaaS operators** managing multiple tenants who need a ticket-based
  support queue for tenant issues.
- **Enterprise customers** who require ATO (Authority to Operate)
  documentation, which expects an auditable support trail.

## Decision

### Phase 1 (current): Structured alert surfacing (no external dependency)

The `apps/admin-ui` Platform Operations console exposes a **Support** page
(`/operator/support`) that:

1. Queries `/posture/*` endpoints and the immutable audit trail to surface
   open alerts and degraded gates.
2. Renders actionable runbook links next to each alert (linking to
   `docs/runbooks/`).
3. Provides a copy-to-clipboard summary block for pasting into any external
   ticket system.

This phase requires no external ITSM dependency and is deployable immediately.

### Phase 2 (future): ITSM webhook integration

When a customer requires native ticket creation, an adapter is added to
`apps/control-plane-api` that:

1. Subscribes to alert events from the internal event bus (or polls
   `/posture/*` on a schedule).
2. On threshold breach (e.g., VistA circuit breaker open > 5 min, migration
   failure, tenant provisioning stuck), creates a ticket via the configured
   ITSM webhook.

**Supported ITSM targets (Phase 2, not yet implemented):**

| System | Integration method | Notes |
|--------|--------------------|-------|
| ServiceNow | REST API (`/api/now/table/incident`) | VA standard; requires OAuth 2.0 client credential |
| Jira Service Management | REST API (`/rest/servicedeskapi/request`) | Common for commercial SaaS tenants |
| Freshdesk | REST API (`/api/v2/tickets`) | Lightweight option for smaller deployments |
| Generic webhook | HTTP POST with JSON payload | Fallback for any system |

The adapter is selected via `SUPPORT_ITSM_ADAPTER` env var. If not set,
Phase 1 (local alert surfacing only) remains active.

### Phase 3 (future): Tenant self-service portal

When tenant customers need to submit their own support requests, a limited
self-service flow is added to the patient/provider portal layer. Out of scope
for this ADR.

## Consequences

- Phase 1 is implemented and available now. No new code required beyond
  the existing `apps/admin-ui` `/operator/support` page.
- Phase 2 is deferred pending customer demand. No ITSM adapter code exists
  yet; this ADR authorises its future development.
- ITSM webhook secrets must be stored as environment variables (never in
  code or version control). The `apps/control-plane-api/.env.example`
  documents the required vars when Phase 2 is implemented.
- This ADR does not prescribe which ITSM system VA facilities must use.
  The adapter pattern keeps the platform agnostic.
- ATO evidence requirement: when Phase 2 is implemented, a ticket creation
  audit entry must be written to the immutable audit trail per Phase 35 rules.
