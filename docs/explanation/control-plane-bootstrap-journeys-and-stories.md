# Control-Plane Bootstrap — Journeys and Stories

> **Artifact type:** Explanation / planning research — NOT implementation authorization.
> **Repo:** `vista-evolved-platform`
> **Date:** 2026-03-18
> **Status:** Draft — pending human review.
> **Scope:** Persona definitions, golden bootstrap journey, topology presets, exception journeys, and user stories for the control-plane bootstrap flow.
> **Does NOT:** Create screen-contract instances, define API endpoints, authorize code, produce UI.

---

## 1. Purpose

This document defines the user journeys and stories that the control-plane bootstrap flow must serve. It translates the architecture specs and subsystem-pattern-scan into concrete operator workflows.

### 1.1 Position in the planning sequence

| Predecessor | What it provides |
|------------|-----------------|
| Subsystem pattern scan | Concern areas, build/borrow/avoid decisions, external-system classifications |
| Screen inventory §9 | 4 CP surfaces inventoried |
| Workspace map §11 | CP workspace definition, operator-only audience |
| Organization/facility model §15 | Provisioning implications |

| Successor | What it consumes from this doc |
|----------|-------------------------------|
| UX/IA and wireframes | Journey steps map to screens and navigation flows |
| Design handoff brief | Stories define acceptance criteria for design review |
| Future screen-contract instances | Stories inform surface scope and data requirements |

### 1.2 Non-goals

- No prescriptive UI design. Journeys describe what the operator does and sees, not exact layouts.
- No API specification. API contracts are a downstream artifact.
- No implementation authorization. Stories are planning artifacts, not sprint tickets.

---

## 2. Personas

### 2.1 Primary persona: Platform operator (PO)

**Name:** Alex (Platform Operator)
**Role category:** `platform-operator` (per screen contract schema `roleCategoryEnum`)
**Scope:** Platform-wide — not bound to any tenant
**Authorization:** Full access to all 4 control-plane surfaces (per permissions matrix §7A)

**Context:**

- Alex manages a VistA Evolved deployment. They are responsible for creating tenants, configuring legal markets, managing packs, and ensuring the platform is operational.
- Alex has deep operational knowledge but is not a software developer. They work through admin interfaces, not code or APIs.
- Alex may manage 1–50+ tenants depending on deployment scale (solo clinic operator to regional health system).

**Key needs:**

- Create a tenant quickly for a new customer without needing to understand every architecture concept.
- See honest readiness states — know what works, what's pending, and what's not available.
- Understand what's mandatory (market-mandated packs) vs optional (payer, specialty).
- Troubleshoot provisioning failures with clear error messages.

### 2.2 Secondary persona: First-run operator (FRO)

**Name:** Sam (First-Run Operator)
**Role category:** `platform-operator`
**Scope:** Platform-wide — first-ever operator on a fresh deployment

**Context:**

- Sam is deploying VistA Evolved for the first time. There are no existing tenants, no configured markets, no activated packs.
- Sam needs guided setup that establishes the platform's baseline configuration before any tenant can be created.
- Sam may or may not have VistA experience. They have access to a running VistA instance and platform credentials.

**Key needs:**

- Guided first-run flow that validates basic platform health (VistA connectivity, database, etc.).
- Clear indication of what must be configured before tenant creation is possible.
- Minimal friction to reach "first tenant operational."

### 2.3 Non-persona: Tenant administrator

Tenant administrators use the tenant-admin workspace, NOT the control-plane. They are explicitly excluded from control-plane personas per global system architecture §13 and permissions matrix §7A. Tenant-admin journeys are a separate future artifact.

---

## 3. Golden bootstrap journey — first tenant creation

This is the primary happy-path journey from fresh deployment to first operational tenant.

### 3.1 Journey map

| Step | What the operator does | What the system does | Surface(s) | Concern area(s) |
|------|----------------------|---------------------|------------|-----------------|
| **1. Platform health check** | Opens the control-plane workspace | Displays platform health: DB status, VistA connectivity, system version | `system.config` (proposed) | Adapter health (4.9) |
| **2. Market configuration** | Navigates to markets management; reviews available markets and launch tiers | Displays market readiness matrix with 7 dimensions per market. Shows which markets are ≥ T1 (available for provisioning) | `markets.management` | Legal-market (4.2), Capability readiness (4.10) |
| **3. Pack catalog review** | Navigates to pack catalog; reviews available packs by family | Displays pack catalog grouped by family, filterable by lifecycle state. Shows eligibility rules and dependency chains | `packs.catalog` | Pack catalog (4.3) |
| **4. Initiate tenant creation** | Clicks "Create Tenant" on the tenant registry surface | Opens provisioning flow (multi-step) | `tenants.list` → provisioning flow | Tenant provisioning (4.1) |
| **5. Basic tenant info** | Enters tenant name, primary contact email, notes | Validates uniqueness of tenant name | Provisioning step 1 | Tenant provisioning (4.1) |
| **6. Legal-market selection** | Selects the legal market for the tenant (e.g., "Philippines" or "United States") | Constrains all downstream options: mandatory packs auto-selected, available payers filtered, language defaults set | Provisioning step 2 | Legal-market (4.2) |
| **7. Topology preset** | Selects deployment topology: Solo clinic / Multi-clinic / Hospital / Enterprise | Pre-fills entity hierarchy template with suggested structure | Provisioning step 3 | Topology presets (4.7) |
| **8. Pack composition** | Reviews auto-selected packs (mandatory) and selects optional packs (payer, specialty, language override) | Validates dependency DAG. Shows unmet dependencies as blocking warnings. Highlights mandatory packs as locked. | Provisioning step 4 | Pack composition (4.8) |
| **9. Primary facility binding** | Enters VistA endpoint (host + port) for the primary facility | Probes VistA RPC broker. Reports connectivity status. If reachable, reads File 4 institution name. | Provisioning step 5 | Facility binding (4.5) |
| **10. Review and create** | Reviews all selections on a summary screen | Creates tenant, activates packs, binds facility. Logs all actions to audit trail. | Provisioning summary | Audit (4.11) |
| **11. Post-creation handoff** | Sees confirmation with next steps: "Set up users" → link to tenant-admin workspace | Outgoing cross-workspace transition to tenant-admin for tenant-scoped setup | `tenants.list` → tenant-admin | Tenant lifecycle (4.1) |

### 3.2 Success criteria

- Operator completes tenant creation in ≤ 15 interactions (excluding review/confirmation steps).
- All mandatory packs are auto-selected without operator intervention.
- VistA endpoint is validated (connectivity probe) before tenant creation completes.
- Audit trail captures every provisioning decision.
- Operator sees honest readiness state — no capability inflation.

---

## 4. Topology presets

| Preset | Entity hierarchy template | Default pack suggestions | Typical use case |
|--------|--------------------------|-------------------------|-----------------|
| **Solo clinic** | 1 legal entity → 1 organization → 1 facility → 1 department | Language, locale, regulatory, standards (market-mandated). No payer pack by default. | Independent physician practice, small clinic. |
| **Multi-clinic group** | 1 legal entity → 1 organization → N facilities (2–10) → departments per facility | Same as solo + suggest payer pack for primary payer. | Multi-site group practice, community health center. |
| **Hospital** | 1 legal entity → 1 organization → 1 facility → departments + wards + beds | Same as multi-clinic + suggest specialty content packs. | Single hospital deployment. |
| **Health system / enterprise** | 1 enterprise → N legal entities → N organizations → N facilities | Full pack suite suggested. Multi-VistA-instance awareness flagged. | Regional or national health system. |

**Preset behavior:**

- Presets pre-fill the entity hierarchy template in provisioning step 7 (topology selection).
- All pre-filled values are editable. Presets are convenience, not constraints.
- Presets do NOT override market-mandated pack selections.
- The "Enterprise" preset displays a notice that multi-VistA-instance management is available after initial setup (concern area 4.12 — deferred).

---

## 5. Exception journeys

### 5.1 Market not available (below T1)

| Step | What happens |
|------|-------------|
| Operator selects legal market during provisioning | System checks launch tier |
| Market is T0 (exploratory) | Market is not shown in the selection list. Operator cannot select it. |
| Operator asks why market is not listed | Markets management surface shows the market at T0 with dimension-by-dimension readiness. Clear reason for T0 classification. |

**Governing rule:** Capability truth §11 rule 2 — no provisioning without eligibility. Country/payer readiness §12 — T0 markets are not provisionable.

### 5.2 VistA endpoint unreachable at bind time

| Step | What happens |
|------|-------------|
| Operator enters VistA endpoint (host + port) | System probes TCP + RPC broker |
| Probe fails (connection refused, timeout, auth error) | Error displayed with specific failure reason (TCP unreachable, RPC handshake failed, auth rejected) |
| Operator options | (a) Retry with corrected endpoint, (b) Skip binding and mark facility as `integration-pending`, (c) Cancel provisioning |

**Governing rule:** Architecture anti-goals §4 — no silent mocks. Subsystem pattern scan §4.5 — if unreachable, mark `integration-pending`.

### 5.3 Pack dependency not met

| Step | What happens |
|------|-------------|
| Operator selects a payer pack (e.g., PhilHealth) | System evaluates dependency DAG |
| Payer pack requires regulatory pack that is not yet published | Dependency shown as blocking warning: "PhilHealth payer pack requires Philippines Regulatory pack (currently: draft). Publish the regulatory pack first." |
| Operator options | (a) Navigate to pack catalog to check regulatory pack status, (b) Remove payer pack selection and proceed without it |

**Governing rule:** Pack/adapter governance §10 — required dependencies block activation.

### 5.4 First-run: no markets configured

| Step | What happens |
|------|-------------|
| Sam (first-run operator) opens control-plane for the first time | System detects no markets are configured |
| Guided first-run banner | "No legal markets configured. Tenant creation requires at least one market at T1 or above. → Go to Markets Management" |
| Sam navigates to markets management | Markets management shows country list with readiness dimensions. Sam can set up a market's readiness state and assign a launch tier. |

**Governing rule:** Country/payer readiness §15.1 — signup/onboarding presents only eligible markets.

### 5.5 Provisioning audit failure

| Step | What happens |
|------|-------------|
| Provisioning completes but audit write fails | System rolls back tenant creation. Provisioning actions without audit trail are rejected. |
| Error displayed | "Tenant creation failed: audit trail unavailable. Contact platform support." |

**Governing rule:** Provisioning actions must be auditable. No unaudited state changes in the governance plane.

---

## 6. User stories

Stories follow the format: **As a [persona], I want to [action], so that [outcome].**

All stories are planning artifacts. They are NOT sprint-ready tickets. They require screen-contract instances, API contracts, and implementation authorization before they become implementable.

### 6.1 Tenant lifecycle stories

| ID | Story | Priority | Concern area |
|----|-------|----------|--------------|
| CP-T1 | As a platform operator, I want to see a list of all tenants with their status (active, suspended, archived) so that I can manage the tenant portfolio. | High | 4.1 Tenant provisioning |
| CP-T2 | As a platform operator, I want to create a new tenant with minimal required information (name, legal-market, topology preset) so that onboarding is fast. | High | 4.1, 4.2, 4.7 |
| CP-T3 | As a platform operator, I want to suspend a tenant so that their access is revoked while preserving their data and configuration. | Medium | 4.1 |
| CP-T4 | As a platform operator, I want to archive a tenant so that their configuration is preserved as read-only historical record. | Low | 4.1 |
| CP-T5 | As a platform operator, I want to drill from the tenant list into a tenant's admin workspace so that I can support the tenant admin. | Medium | 4.1, 4.13 |

### 6.2 Legal-market stories

| ID | Story | Priority | Concern area |
|----|-------|----------|--------------|
| CP-M1 | As a platform operator, I want to see all legal markets with their launch tier and readiness dimensions so that I know which markets are available for provisioning. | High | 4.2, 4.10 |
| CP-M2 | As a platform operator, I want to see per-dimension readiness detail for a market (language, locale, regulatory, standards, payer, provisioning, data residency, clinical workflow) so that I understand what's verified and what's pending. | High | 4.2 |
| CP-M3 | As a platform operator, I want the market selection during tenant creation to be gated by launch tier so that I cannot provision a tenant in a market that is not ready. | High | 4.2 |

### 6.3 Pack management stories

| ID | Story | Priority | Concern area |
|----|-------|----------|--------------|
| CP-P1 | As a platform operator, I want to see the pack catalog grouped by family (language, locale, regulatory, standards, payer, specialty, tenant-overlay) so that I can manage packs by category. | High | 4.3 |
| CP-P2 | As a platform operator, I want to see each pack's lifecycle state (draft, validated, tested, published, activated, deactivated, retired) so that I know what's available for activation. | High | 4.3 |
| CP-P3 | As a platform operator, I want to see pack dependency chains so that I know what other packs must be active before this pack can be activated. | Medium | 4.3, 4.8 |
| CP-P4 | As a platform operator, I want the provisioning flow to auto-select market-mandated packs and let me choose optional packs so that mandatory compliance is ensured while optional features are operator-chosen. | High | 4.8 |

### 6.4 System configuration stories

| ID | Story | Priority | Concern area |
|----|-------|----------|--------------|
| CP-S1 | As a platform operator, I want to see platform health status (database, VistA connectivity, adapter health) so that I can diagnose operational issues. | High | 4.4, 4.9 |
| CP-S2 | As a platform operator, I want to manage platform-wide feature flags so that I can enable or disable features across all tenants. | Medium | 4.4 |
| CP-S3 | As a platform operator, I want all configuration changes to be logged in an immutable audit trail so that I can review who changed what and when. | High | 4.11 |

### 6.5 Facility binding stories

| ID | Story | Priority | Concern area |
|----|-------|----------|--------------|
| CP-F1 | As a platform operator, I want to bind a facility to a VistA endpoint (host + port) during provisioning so that the facility is connected to its VistA instance. | High | 4.5 |
| CP-F2 | As a platform operator, I want the system to probe the VistA endpoint at bind time so that I know the connection is valid before completing provisioning. | High | 4.5 |
| CP-F3 | As a platform operator, I want to mark a facility as `integration-pending` if VistA is not yet available so that provisioning can complete without blocking on VistA connectivity. | Medium | 4.5 |

### 6.6 First-run stories

| ID | Story | Priority | Concern area |
|----|-------|----------|--------------|
| CP-FR1 | As a first-run operator, I want the platform to show a guided setup banner when no markets are configured so that I know what to do first. | High | 5.4 |
| CP-FR2 | As a first-run operator, I want to validate platform health (database, VistA) before creating the first tenant so that I know infrastructure is operational. | High | 4.9 |
| CP-FR3 | As a first-run operator, I want to complete first-tenant creation in ≤ 15 interactions so that onboarding is not a burden. | Medium | 4.1 |

---

## 7. Story-to-surface mapping

| Story ID(s) | Primary surface | Notes |
|-------------|----------------|-------|
| CP-T1, CP-T5 | `control-plane.tenants.list` | Existing screen contract |
| CP-T2, CP-T3, CP-T4 | `control-plane.tenants.list` + provisioning flow (proposed) | Provisioning flow is proposed, not yet inventoried |
| CP-M1, CP-M2, CP-M3 | `control-plane.markets.management` | Existing screen contract |
| CP-P1, CP-P2, CP-P3 | `control-plane.packs.catalog` | Existing screen contract |
| CP-P4 | Provisioning flow step 4 (proposed) | Part of provisioning wizard |
| CP-S1, CP-S2, CP-S3 | `control-plane.system.config` | Inventoried, no screen contract yet |
| CP-F1, CP-F2, CP-F3 | Provisioning flow step 5 (proposed) | Part of provisioning wizard |
| CP-FR1, CP-FR2, CP-FR3 | CP workspace shell + first-run banner (proposed) | First-run experience layered over existing surfaces |

> **"Proposed" surfaces are non-canonical candidates.** They are not inventoried, not screen-contracted, and not authorized for implementation.

---

## 8. Governing references

| Reference | Location |
|-----------|----------|
| Global system architecture | `docs/explanation/global-system-architecture-spec.md` |
| Organization/facility model | `docs/explanation/organization-facility-network-service-model.md` |
| Pack/adapter governance | `docs/explanation/pack-and-adapter-architecture-governance.md` |
| Capability truth / claim-gating | `docs/explanation/capability-truth-and-claim-gating-spec.md` |
| Country/payer readiness | `docs/explanation/country-and-payer-readiness-registry-spec.md` |
| Workspace map | `docs/explanation/information-architecture-workspace-map.md` |
| Screen inventory | `docs/reference/screen-inventory.md` |
| Permissions matrix | `docs/reference/permissions-matrix.md` |
| Subsystem pattern scan | `docs/explanation/control-plane-bootstrap-subsystem-pattern-scan.md` |
