# Operator Console Page Priority and Content Model

> **Status:** Canonical — page priority tiers and per-domain content model.
> **Date:** 2026-03-20.
> **Type:** Explanation — content model, page priority, domain content rules.
> **Scope:** Defines what content appears on each surface and how surfaces are
> prioritized for implementation and attention.
> **Governed by:** AGENTS.md, operator-console-ux-ia-reset-and-journey-pack.md,
> operator-console-personas-jobs-and-service-map.md.
> **Does NOT authorize:** Runtime implementation or UI code.

---

## 1. Purpose

This document defines:

1. **Page priority tiers** (P0/P1/P2) with rationale
2. **Per-domain content model** — what objects, views, KPIs, and actions belong to each domain
3. **Content rules** — what is forbidden on each surface
4. **First drill-down** — where the operator goes after landing on a surface
5. **Relationship map** — how domains connect to each other

---

## 2. Page priority tiers

### 2.1 P0 — Operator daily essentials

These surfaces are used every day and must be functional, honest, and action-oriented.

| Surface | Domain | Why P0 |
|---------|--------|--------|
| Home | Home | Entry point — answers "what needs attention?" |
| Bootstrap Requests | Requests & Onboarding | Primary inbound workflow |
| Provisioning Runs | Requests & Onboarding | Monitors the result of onboarding |
| Tenant Registry | Tenants | Portfolio overview — health at a glance |
| Tenant Detail | Tenants | Single-tenant dossier — the operator's main investigation surface |

### 2.2 P1 — Important for routine operations

Used weekly or on-demand for recurring operational tasks.

| Surface | Domain | Why P1 |
|---------|--------|--------|
| Operations Center | Operations | Platform health check |
| Alert Center | Operations | Incident response entry point |
| Support Console | Support | Escalation handling |
| Billing & Entitlements | Commercial | Billing review cycle |

### 2.3 P2 — Specialized or governance

Used rarely or by the senior operator / governance lead.

| Surface | Domain | Why P2 |
|---------|--------|--------|
| Backup & DR | Operations | Rare but critical operations |
| Environments & Flags | Operations | Configuration management |
| Identity & Invitations | Requests & Onboarding | Future onboarding identity |
| Usage & Metering | Commercial | Detailed usage analysis |
| Market Management | Catalogs & Governance | Market authoring |
| Market Detail | Catalogs & Governance | Market review |
| Pack Catalog | Catalogs & Governance | Pack governance |
| Payer Readiness | Catalogs & Governance | Market research |
| Eligibility Simulator | Catalogs & Governance | What-if analysis |
| System Configuration | Platform | Rare config changes |
| Audit Trail | Platform | Compliance and investigation |
| Templates & Presets | Platform | Template management |
| Runbooks Hub | Platform | Operational reference |

---

## 3. Per-domain content model

### 3.1 Home

| Aspect | Definition |
|--------|-----------|
| **Primary user goal** | Know what needs attention right now |
| **Main object types** | Aggregated counts, action links, status summaries |
| **Primary view** | Action card grid — each card is a pending-work category with count and link |
| **Top KPIs allowed** | Pending request count, active provisioning count, failed provisioning count, unresolved alert count, tenant count by state |
| **Forbidden KPIs** | Pack readiness %, capability truth %, market composition stats, resolver output, audit event volume |
| **First drill-down** | Click a card → navigates to the relevant domain (e.g., "3 pending requests" → Requests & Onboarding) |
| **Next safe actions** | "Review pending requests", "Check failed provisioning", "View alerts" |
| **Relationships** | Links out to every domain based on pending-work signals |

### 3.2 Requests & Onboarding

| Aspect | Definition |
|--------|-----------|
| **Primary user goal** | Process onboarding requests and monitor provisioning |
| **Main object types** | Bootstrap Request, Provisioning Run, Provisioning Step |
| **Primary table/list views** | Bootstrap request list (filterable by state), Provisioning run list (filterable by state) |
| **Primary card/summary views** | Request summary card (market, tenant name, state, submitted date), Provisioning run summary card (step count, current step, state) |
| **Top KPIs allowed** | Requests by state (pending/approved/rejected), Provisioning runs by state (active/completed/failed) |
| **Forbidden KPIs** | Pack readiness scores, resolver complexity metrics, composition engine stats |
| **First drill-down** | Request list → Request detail → Approve/Reject OR Provisioning run → Step detail |
| **Next safe actions** | "Approve this request", "Reject with reason", "Retry failed step", "Cancel provisioning", "View resulting tenant" |
| **Relationships** | Approved request → creates Provisioning Run. Completed provisioning → creates Tenant (link to Tenants). |

### 3.3 Tenants

| Aspect | Definition |
|--------|-----------|
| **Primary user goal** | Understand the health and status of each tenant |
| **Main object types** | Tenant, Legal Entity, Organization |
| **Primary table/list views** | Tenant registry table (name, state, market, creation date, environment) |
| **Primary card/summary views** | Tenant Detail dossier: identity section, lifecycle state, environment binding, pack configuration summary, recent events timeline |
| **Top KPIs allowed** | Tenant count by lifecycle state, tenants per market |
| **Forbidden KPIs** | Clinical metrics, patient counts, VistA usage stats, pack readiness per tenant |
| **First drill-down** | Tenant registry → Tenant Detail (single tenant dossier) |
| **Next safe actions** | "Suspend tenant" (if active), "Reactivate tenant" (if suspended), "View provisioning history", "View environment" |
| **Relationships** | Tenant Detail links to: Provisioning history (Requests & Onboarding), Environment (Operations), Billing (Commercial), Support cases (Support) |

### 3.4 Operations

| Aspect | Definition |
|--------|-----------|
| **Primary user goal** | Confirm the platform is healthy and environments are running |
| **Main object types** | Environment, Alert, Backup Schedule, Feature Flag |
| **Primary table/list views** | Environment table (name, health status, tenant binding, version), Alert table (severity, message, timestamp, entity), Backup schedule table |
| **Primary card/summary views** | Operations Center: environment health summary cards, alert severity breakdown |
| **Top KPIs allowed** | Environment count by health state, alert count by severity, last backup timestamp |
| **Forbidden KPIs** | Pack readiness, capability truth, market stats, billing totals |
| **First drill-down** | Operations Center → Environment detail or Alert detail |
| **Next safe actions** | "Acknowledge alert", "View affected tenant", "Initiate backup", "Toggle feature flag" |
| **Relationships** | Environments link to Tenants (binding). Alerts link to Tenants and Environments. |

### 3.5 Support

| Aspect | Definition |
|--------|-----------|
| **Primary user goal** | Handle support escalations and track resolution |
| **Main object types** | Support Case, Incident Record |
| **Primary table/list views** | Support case table (case ID, tenant, severity, status, assigned, last update) |
| **Primary card/summary views** | Case detail: tenant context, timeline, assigned operator, resolution status |
| **Top KPIs allowed** | Open cases count, cases by severity, average resolution time |
| **Forbidden KPIs** | Clinical incident details, patient-level information |
| **First drill-down** | Case list → Case detail |
| **Next safe actions** | "Assign case", "Escalate", "Resolve", "View tenant detail", "View audit trail" |
| **Relationships** | Cases link to Tenants, Audit Trail (Platform), and Operations (if infrastructure-related) |

### 3.6 Commercial

| Aspect | Definition |
|--------|-----------|
| **Primary user goal** | Understand billing and usage posture across tenants |
| **Main object types** | Billing Account, Subscription, Usage Record, Invoice |
| **Primary table/list views** | Billing summary table (tenant, plan, status, last payment), Usage table (tenant, metric, period, value) |
| **Primary card/summary views** | Billing overview cards (total accounts, active subscriptions, outstanding invoices) |
| **Top KPIs allowed** | Active subscription count, total revenue (if backed by real data), overdue invoice count |
| **Forbidden KPIs** | Any billing number not backed by real data — source badge must be visible |
| **First drill-down** | Billing overview → Tenant billing detail |
| **Next safe actions** | "View tenant billing", "Generate invoice", "Review usage spike" |
| **Relationships** | Each billing record links to a Tenant. Usage links to Environments. |

### 3.7 Catalogs & Governance

| Aspect | Definition |
|--------|-----------|
| **Primary user goal** | Review and manage markets, packs, readiness, and eligibility |
| **Main object types** | Legal-Market Profile, Pack Manifest, Capability Manifest, Payer Readiness Record |
| **Primary table/list views** | Market table (name, country, state, launch tier), Pack table (name, family, state, version), Payer table |
| **Primary card/summary views** | Market detail: mandated/default/eligible packs, readiness dimensions. Pack detail: dependencies, capabilities contributed, eligibility rules |
| **Top KPIs allowed** | Markets by state, packs by state, packs by family |
| **Forbidden KPIs** | Any readiness percentage passed off as a production metric |
| **First drill-down** | Market list → Market detail → Pack eligibility. Pack list → Pack detail |
| **Next safe actions** | "Create market draft", "Submit for review", "Create pack draft", "Run eligibility simulator" |
| **Relationships** | Markets reference Packs. Packs contribute Capabilities. Eligibility Simulator consumes Markets + Packs. |

### 3.8 Platform

| Aspect | Definition |
|--------|-----------|
| **Primary user goal** | Manage system-level configuration, view audit trail, access templates and runbooks |
| **Main object types** | System Parameter, Feature Flag, Audit Event, Template, Runbook |
| **Primary table/list views** | System config parameter table (key, current value, last changed), Feature flag table (key, state, scope), Audit event table (timestamp, actor, action, entity) |
| **Primary card/summary views** | System config summary (parameter counts, last change timestamp), Audit summary (event count by type, time range) |
| **Top KPIs allowed** | Active feature flags count, audit events in last 24h (if real) |
| **Forbidden KPIs** | Fake audit counts, fake configuration change counts |
| **First drill-down** | Config list → Parameter detail. Audit list → Event detail. |
| **Next safe actions** | "Update parameter", "Toggle feature flag", "Filter audit trail", "View runbook" |
| **Relationships** | Audit Trail records events from all domains. Templates may reference Markets and Packs. |

---

## 4. Content rules (cross-domain)

### 4.1 What never appears in user-facing UI

| Forbidden | Reason |
|-----------|--------|
| Raw RPC names (e.g., `ORWPS ACTIVE`) | Internal VistA protocol detail |
| Raw file numbers (e.g., `File 8994`) | Internal VistA schema detail |
| MUMPS references | Internal implementation detail |
| DFN, DUZ, IEN values without context label | Internal identifiers |
| TODO / FIXME / implementation-pending | Development artifact |
| Console.log output | Development artifact |
| Architecture service-domain names as nav labels | Internal architecture vocabulary |
| Composition engine resolver details | Internal algorithm |
| Capability truth scores as product KPIs | Governance metric, not operator metric |

### 4.2 What is allowed when honestly labeled

| Allowed | Condition |
|---------|-----------|
| Fixture-backed data | Source badge visible: "Fixture" |
| Contract-backed data | Source badge visible: "Contract" |
| Static/empty surfaces | Source badge visible: "Static Preview" |
| Review-only write simulation | Review banner visible at all times |
| Tenant IDs | Labeled as "Tenant ID" in detail views |
| Pack IDs / Market IDs | Labeled in detail views, not in primary navigation |

---

## 5. Domain relationship map

```
                           ┌──────────┐
                           │   Home   │ (aggregates signals from all domains)
                           └────┬─────┘
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
     ┌──────▼──────┐    ┌──────▼──────┐    ┌───────▼───────┐
     │  Requests & │    │   Tenants   │    │  Operations   │
     │  Onboarding │    │             │    │               │
     └──────┬──────┘    └──────┬──────┘    └───────┬───────┘
            │                   │                   │
            │    ┌──────────────┤                   │
            │    │              │                   │
     ┌──────▼──┐ │     ┌───────▼───────┐   ┌──────▼──────┐
     │ Support │ │     │  Commercial   │   │  Catalogs & │
     │         │ │     │               │   │  Governance  │
     └─────────┘ │     └───────────────┘   └─────────────┘
                 │
          ┌──────▼──────┐
          │  Platform   │ (audit trail, config — foundational)
          └─────────────┘
```

**Key relationships:**
- Home links to all domains (aggregation)
- Requests & Onboarding creates Tenants (approved request → provisioning → tenant)
- Tenants links to Operations (environment binding), Commercial (billing), Support (cases)
- Operations and Support are peer domains for incident response
- Catalogs & Governance feeds into Requests & Onboarding (market/pack definitions used during bootstrap)
- Platform (audit, config) is foundational — consumed by all domains
