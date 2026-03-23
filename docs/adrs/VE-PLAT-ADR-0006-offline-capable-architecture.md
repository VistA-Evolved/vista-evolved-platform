# VE-PLAT-ADR-0006: Offline-Capable Architecture for Site Administration

**Status:** accepted
**Date:** 2026-03-23
**Deciders:** Platform team

## Context

VistA Evolved is deployed at VA medical centers and community-based outpatient
clinics (CBOCs) where network connectivity to cloud services or even the parent
facility may be intermittent or absent. Clinical operations must continue
regardless of WAN availability.

Three distinct failure scenarios are in scope:

1. **Internet/cloud down** — S3 audit shipping, Lago billing sync, OIDC identity
   provider, and analytics aggregation all become unreachable.
2. **Platform DB (ve-platform-db) down** — PostgreSQL unavailable; operator-side
   persistence and RLS-protected tables unreachable.
3. **VistA Docker down** — The local YottaDB/VistA container itself fails.

The existing architecture does not document its offline posture or define recovery
boundaries, making it impossible to reason about resilience during on-call incidents.

## Decision

### 1. Layered dependency classification

Every service dependency is classified into one of three tiers:

| Tier | Definition | Offline behaviour |
|------|-----------|-------------------|
| **Tier 0 — Local-essential** | VistA Docker (RPC broker) | All clinical routes blocked; tenant-admin shows `{ok:false, source:"error"}`. No silent fallback. |
| **Tier 1 — Local-important** | Platform DB (PostgreSQL) | Control-plane write routes degrade gracefully. In-memory stores serve reads. Module entitlement falls back to SKU defaults. Posture endpoints report degraded. |
| **Tier 2 — Remote-optional** | Lago, S3 audit shipper, OIDC IdP, OTel collector, Prometheus | Disabled or deferred silently. Posture gates report warnings, not hard failures. |

### 2. Tenant-admin is VistA-only; no offline data cache

The `apps/tenant-admin` service reads from and writes to live VistA exclusively.
There is no local cache of FileMan data. If VistA is unreachable, every route
returns `{ok:false, source:"error"}`. This is intentional: stale cached data
creates patient safety risks greater than a brief service interruption.

### 3. Audit shipping is async and buffered

`immutable-audit.ts` writes to a local JSONL file before attempting S3 shipping.
The shipper job (Phase 157) only transmits when S3 credentials and connectivity
are available. The local JSONL file persists across restarts and acts as the
durability buffer, ensuring no audit entries are lost during Tier 2 outages.

### 4. Session auth survives IdP outage

VistA RPC auth (XWB broker challenge-response) is the primary auth path and
requires no external IdP. OIDC is required only in `rc`/`prod` runtime mode
(VE-PLAT rule 146). In `dev` mode, VistA auth is the only path. Existing
sessions cached in Redis (Phase 574) or in-memory remain valid during IdP
outages until session TTL expires.

### 5. Documentation and posture gates

- `/posture/data-plane` (Phase 125+153) includes a connectivity check for each
  Tier 2 dependency and reports the offline posture without causing a hard failure.
- This ADR is referenced in `docs/runbooks/disaster-recovery.md` (to be created
  per operational runbook schedule).

## Consequences

- Developers and operators have a clear mental model of which failures are
  hard stops (Tier 0) vs. graceful degradation (Tier 1) vs. silent deferral (Tier 2).
- No new code is required by this ADR; it ratifies the existing behaviour and
  makes it explicit so it can be tested and verified.
- Future enhancements (offline queue for scheduling writes, local caching of
  reference data) require a separate ADR before implementation.
- Disaster recovery runbook and recovery-time objective (RTO) definitions are
  out of scope for this ADR and are tracked separately.
