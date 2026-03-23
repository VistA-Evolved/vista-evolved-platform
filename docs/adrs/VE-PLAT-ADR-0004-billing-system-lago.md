# VE-PLAT-ADR-0004: Lago as the billing and metering engine

**Status:** accepted
**Date:** 2026-03-22
**Deciders:** Platform team

## Context

VistA Evolved operates as a multi-tenant SaaS platform. The operator console
needs a billing and metering subsystem to track tenant usage, generate invoices,
manage subscription plans, and handle commercial holds. The platform requires:

- Usage-based metering (active users, API calls, storage, connected facilities)
- Subscription plan management with tiered pricing
- Invoice generation, payment tracking, and dunning
- Webhook-driven event integration with the operator console
- Multi-currency support for international markets (US, PH, and future)
- Self-hostable to maintain data sovereignty and HIPAA compliance

## Decision

**Selected: Lago** (https://github.com/getlago/lago — Go/Ruby, AGPL-3.0)

Lago is adopted as the billing and metering engine for the following reasons:

1. **Usage-based metering native** — built-in event ingestion, aggregation,
   and billing-period rollup. No custom metering pipeline needed.
2. **Self-hostable** — Docker Compose deployment, keeping billing data
   within the platform's infrastructure boundary. Critical for HIPAA.
3. **API-first** — REST + webhook-driven, aligns with our contract-first
   architecture (VE-PLAT-ADR-0002).
4. **Multi-currency** — native support for USD, PHP, and other currencies.
5. **Active open-source project** — well-maintained, production-grade,
   used by companies at scale.
6. **Plan flexibility** — supports subscription + usage hybrid models,
   tiered pricing, graduated pricing, and package pricing.

## Alternatives Considered

| System | Why not selected |
|--------|-----------------|
| Kill Bill (Java) | Subscription-focused, weaker usage-based metering. Heavier JVM stack. |
| Stripe Billing | SaaS-only, cannot self-host. HIPAA data sovereignty concern. |
| Chargebee | SaaS-only, commercial. Same data sovereignty concern. |
| Custom-built | Months of engineering for a solved problem. |

## Integration Plan

1. Lago runs as a Docker service alongside `ve-platform-db`.
2. The operator console's Billing & Entitlements surface reads from Lago's API.
3. Tenant provisioning emits metering events to Lago on lifecycle transitions.
4. Lago webhooks drive commercial state changes (holds, suspensions) back
   into the platform's tenant lifecycle state machine.
5. No direct frontend-to-Lago communication; all access via platform API proxy.

## Consequences

- Lago's AGPL-3.0 license requires careful boundary: we consume Lago's API
  but do not modify or distribute its source code.
- The operator console's billing surface wraps Lago's API, not replaces it.
- Lago's admin UI is available for operator debugging but is not the primary
  interface; the operator console is.
- Future: usage event schema defined in `packages/contracts/asyncapi/`.
