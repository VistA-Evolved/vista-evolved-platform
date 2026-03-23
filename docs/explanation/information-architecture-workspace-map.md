# Information Architecture and Workspace Map

> **Artifact #6** in the global system architecture sequence (see global-system-architecture-spec.md §20).
>
> This specification operationalizes workspace separation from global-system-architecture-spec.md §12.
> It defines the canonical workspace model, workspace boundaries, role-to-workspace alignment,
> navigation structures, cross-workspace transition rules, claim-surface placement, analytics-surface
> placement, content-administration workspace, and screen-contract implications.
>
> **Status:** Proposed.
>
> **Handoff source:** specialty-content-and-analytics-architecture-spec.md §20 (5 items).
>
> **Handoff target:** Screen Contract Schema (`packages/contracts/schemas/screen-contract-schema`) — artifact #7.

---

## 1. Purpose and scope

This document is the seventh architecture specification in the VistA Evolved platform governance sequence. It is positioned as artifact #6 in the global system architecture spec §20 table:

> **Information architecture workspace map — Navigation structures, workspace boundaries, role-to-workspace mapping.**

### 1.1 What this document establishes

1. **Canonical definitions** for workspace, navigation, surface, and boundary terms used across all subsequent specs, contracts, and implementations.
2. **The workspace-family model** — seven workspace families, their boundaries, and their separation rules.
3. **Role-to-workspace alignment** — which role categories access which workspaces.
4. **A navigation model** — how users navigate within and between workspaces.
5. **Cross-workspace transition rules** — the governance contract for boundary crossings.
6. **Individual workspace definitions** — control plane, tenant admin, clinical, ancillary/ops/integration, analytics/BI, and content administration.
7. **Claim-surface placement rules** — where claim surfaces appear and what gating applies.
8. **Dashboard and analytics surface placement** — how analytics surfaces relate to workspace boundaries and PHI rules.
9. **Screen-contract implications** — the structural requirements that the next artifact (screen contract schema) must satisfy to implement this model.
10. **Safety and anti-drift constraints** — architectural guardrails that prevent workspace boundary erosion.

### 1.2 What this document does NOT do

- **No UI implementation.** This spec defines architecture and governance. It does not authorize building screens, components, or navigation code. All implementation requires the screen contract schema (artifact #7) and explicit task authorization.
- **No schema or API definitions.** Contract schemas are defined in `packages/contracts/`. This spec defines the requirements those schemas must satisfy.
- **No modification of prior accepted specs.** Parent specs are referenced, not amended.

### 1.3 Fulfillment of handoff items

This spec fulfills all five handoff items from specialty-content-and-analytics-architecture-spec.md §20:

| # | Handoff item | Addressed in |
|---|-------------|-------------|
| 1 | Workspace composition per domain | §7 (primary workspace set), §11–16 (individual workspace definitions) |
| 2 | Screen contracts for analytics surfaces | §15 (analytics/BI workspace), §18 (dashboard/analytics placement), §19 (screen-contract implications) |
| 3 | Content administration workspace | §16 (content administration workspace) |
| 4 | Cross-workspace navigation | §9 (navigation model), §10 (cross-workspace transition rules) |
| 5 | Claim-surface presentation | §17 (claim-surface placement) |

---

## 2. Relationship to global system architecture

This specification is governed by and builds upon the six accepted architecture specifications.

### 2.1 Parent spec dependencies

| Parent spec | Key sections consumed | This spec's role |
|------------|----------------------|-----------------|
| Global system architecture | §7.4–7.7 (planes), §12 (workspace separation), §13 (CP vs TA), §19 (out-of-scope), §20 (artifact table) | Operationalizes the 7-workspace model from §12 into enforceable workspace definitions with navigation and boundary rules |
| Organization, facility, network, service model | §5.4 (role entities), §15 (provisioning implications), §17 (access/governance), §18.2 (deferred screen inventory) | Consumes role entity definitions; defines how entity context scopes workspace access |
| Pack and adapter architecture governance | §6.7–6.8 (pack types), §19 (claim-gating), §21.2 (deferred pack admin screens) | Defines the content administration workspace that manages pack lifecycle |
| Capability truth and claim-gating | §10 (claim surfaces), §11 (claim-gating rules), §15–16 (CP/TA implications), §22 (out-of-scope UI) | Defines where claim surfaces are placed within workspaces and what gating rules apply |
| Country and payer readiness registry | §6.3 (ownership), §12.3 (launch-tier claim mapping), §14–16 (CP/TA/claim implications) | Defines how market/payer readiness information surfaces in control-plane and tenant-admin workspaces |
| Specialty, content, and analytics architecture | §11 (analytics boundary), §12 (PHI safety), §14–15 (CP/TA implications), §20 (5 handoff items) | Primary handoff source; this spec fulfills all five handoff items |

### 2.2 Architectural backbone references

| Backbone concept | Source | Section in this spec |
|-----------------|--------|---------------------|
| Workspace separation model (7 families) | Global architecture §12 | §7 |
| Control plane vs tenant admin | VE-PLAT-ADR-0003, global architecture §13 | §11, §12 |
| Contract-first architecture | VE-PLAT-ADR-0002 | §19 (screen-contract implications) |
| Three-repo architecture | VE-PLAT-ADR-0001 | §6 (boundary principles) |
| Analytics boundary rules | Specialty-content-analytics §11 | §15, §18 |
| Claim-gating rules | Capability-truth §11 | §17 |
| Entity model for roles | Org-facility-network-service §5.4, §17 | §8 |

### 2.3 What this spec does NOT change

This specification does not amend, override, or redefine any position established in the six parent specs. Where this spec elaborates on a parent position, the elaboration is consistent with and subordinate to the parent. If a contradiction is discovered, the parent spec governs until an explicit amendment ADR is recorded.

---

## 3. Goals

1. **Canonical workspace vocabulary.** Establish a single set of defined terms for workspace, shell, navigation domain, surface, and boundary that all subsequent specs and implementations must use.
2. **Enforceable workspace boundaries.** Define boundaries such that screen contracts, navigation manifests, and access control implementations can enforce them at build time and runtime.
3. **Role-based workspace access model.** Map role categories to workspace entitlements so that access control designs have a governance anchor.
4. **Governed navigation model.** Define how navigation works within workspaces and across workspace boundaries, preventing ad-hoc shortcuts that erode separation.
5. **Claim-surface governance.** Place claim surfaces within the workspace model so that claim-gating rules (capability-truth §11) have a concrete enforcement point.
6. **Analytics surface governance.** Define where analytics surfaces appear and how they enforce the analytics boundary rules (specialty-content-analytics §11).
7. **Content administration clarity.** Define the content administration workspace so that content lifecycle management (specialty-content-analytics §8) has a home.
8. **Screen-contract readiness.** Produce requirements that the screen contract schema (artifact #7) must satisfy, enabling the schema to be authored without re-reading this entire spec.
9. **Safety over speed.** Workspace boundary enforcement must be designed to prevent silent erosion even when implementation pressure is high.

---

## 4. Anti-goals

1. **No screen inventory.** This spec defines workspace-level boundaries and navigation patterns. Enumerating individual screens, panels, tabs, or components within a workspace is the responsibility of screen contracts, not this spec.
2. **No UI component library.** Widget kits, design tokens, and component libraries are implementation concerns. This spec does not define them.
3. **No implementation timeline.** This spec defines architecture. It does not authorize or schedule implementation.
4. **No permission matrix.** Fine-grained permission matrices (role × action × entity-context) depend on this spec's workspace model but are defined in a separate access-control specification (future artifact). This spec defines workspace-level entitlements, not row-level permissions.
5. **No dashboard design.** Analytics dashboards are governed by screen contracts. This spec defines where dashboards live and what boundary rules apply, not what they look like or what metrics they display.
6. **No VistA menu mapping.** VistA CPRS menu trees, option hierarchies, and context-area assignments are VistA-internal concerns. This spec defines the platform workspace model that VistA clinical workspaces align to, not a 1:1 mapping of VistA menus.

---

## 5. Canonical definitions

All architecture specs, screen contracts, ADRs, and implementations must use these terms as defined here. Ad-hoc redefinition is forbidden.

| Term | Definition |
|------|-----------|
| **Workspace** | A bounded information environment scoped to a coherent set of concerns, a defined audience, and a governed set of available actions. A workspace is the primary unit of navigation hierarchy and access control. Workspaces are not tabs, panels, or pages — they are the top-level organizational unit that contains pages, panels, and navigation structures. |
| **Workspace family** | A grouping of related workspaces that share a common concern domain (e.g., clinical, analytics). Workspace families are the seven top-level divisions defined in §7 (derived from global architecture §12). A family may contain one or more concrete workspaces. |
| **Shell** | The outermost application frame that hosts a workspace. A shell provides the workspace chrome (top-level navigation, identity display, workspace switcher) but does not own the workspace content. Different workspace families may share a shell or use distinct shells depending on deployment topology and access requirements. |
| **Navigation domain** | The set of navigation targets available within a single workspace. Each workspace has exactly one navigation domain. Navigation targets are pages, panels, or views within the workspace. Navigation within a domain does not cross workspace boundaries. |
| **Primary navigation** | The top-level navigation structure within a workspace that provides access to the workspace's major functional areas. Rendered by the shell as the main navigation element (sidebar, top bar, or equivalent). |
| **Local navigation** | Secondary navigation within a functional area of a workspace. Subordinate to primary navigation. Examples: tab sets within a clinical panel, sub-pages within an admin section. |
| **Cross-workspace transition** | A navigation action that leaves one workspace and enters another. Cross-workspace transitions are explicit, governed by transition rules (§10), and must be distinguishable from within-workspace navigation. They are never disguised as local navigation. |
| **Surface** | A user-facing display area within a workspace that presents data, accepts input, or both. Surfaces are the atomic units governed by screen contracts. A surface may be a page, a panel, a modal, a sidebar section, or any other bounded display area. |
| **Claim surface** | A surface (in any workspace or external channel) where the platform presents capability or readiness claims to an audience. Subject to claim-gating rules (capability-truth §11). See §17. |
| **Admin surface** | A surface within the control-plane or tenant-admin workspace that exposes configuration, management, or operational functions. Not a clinical surface. |
| **Analytics surface** | A surface that presents analytics, aggregate metrics, trend data, or BI visualizations. Subject to analytics boundary rules (specialty-content-analytics §11). See §15, §18. |
| **Content-admin surface** | A surface within the content administration workspace that provides content lifecycle management actions (authoring, review, publishing, versioning). See §16. |
| **Screen contract** | A machine-readable specification that defines a surface's data sources, access requirements, data-classification level, refresh behavior, and placement within a workspace. Screen contracts are the enforcement mechanism for workspace governance. Defined in `packages/contracts/schemas/` (artifact #7). |
| **Role-to-workspace mapping** | The governed assignment of role categories to workspace entitlements. Defines which role categories may access which workspaces. Not the same as fine-grained permissions (which are per-action, per-entity). See §8. |
| **Boundary breach** | Any violation of workspace separation rules: rendering content from one workspace's domain inside another workspace without a governed cross-workspace transition, sharing mutable UI state across workspace boundaries, or bypassing access controls through navigation shortcuts. Boundary breaches are architecture violations. |

---

## 6. Workspace model and boundary principles

### 6.1 Derivation from global architecture

The workspace model is derived from global-system-architecture-spec.md §12, which establishes:

> Unlike concerns must not collapse into a single surface. Cross-workspace interaction is via APIs, not shared UI state. Common infrastructure is shared via packages, not merged workspaces. Boundaries are enforced by screen contracts and navigation manifests.

This spec operationalizes that position into concrete workspace definitions, boundary rules, and enforcement mechanisms.

### 6.2 Boundary principles

1. **Each workspace has one navigation domain.** A workspace's navigable content is its navigation domain. Content from another workspace's domain must never be rendered inline within a workspace — it requires a cross-workspace transition.
2. **No shared mutable UI state across workspaces.** Workspaces communicate through APIs, events, and shared read-only references (e.g., a patient DFN passed in a transition URL). They do not share form state, selection state, or draft data.
3. **Common infrastructure via packages.** Shared UI components (design-system primitives, layout utilities) live in `packages/ui/`. These are not workspace content — they are building materials used by all workspaces. Sharing a button component does not merge workspaces.
4. **Screen contracts enforce boundaries.** Every surface within a workspace must have a screen contract that declares its workspace affiliation, data sources, and access requirements. Surfaces without screen contracts are unauthorized.
5. **Cross-workspace transitions are explicit.** A navigation action that crosses a workspace boundary must be visually and programmatically distinguishable from within-workspace navigation. Users must know when they are leaving one workspace and entering another.
6. **Repo alignment.** Per VE-PLAT-ADR-0001, platform workspaces live in this repo. VistA runtime workspaces are consumed from the distro repo through APIs. Clinical workspace content that originates in VistA is accessed through the platform's API contracts, not by embedding distro code in platform apps.

### 6.3 Boundary enforcement layers

| Layer | Mechanism | Status |
|-------|----------|--------|
| **Architecture** | This spec — workspace definitions and boundary rules | Established (this document) |
| **Contracts** | Screen contracts — machine-readable surface declarations | Next artifact (#7) |
| **Code** | Nx module boundaries, CODEOWNERS, import restrictions | Planned (see `docs/reference/nx-adoption-plan.md`) |
| **Runtime** | Access control, navigation guards, workspace-scoped sessions | Future implementation |
| **CI** | Governance gates validating screen contract compliance | Future implementation |

---

## 7. Primary workspace set

The following seven workspace families are the canonical top-level divisions of the VistA Evolved platform. They are derived from global-system-architecture-spec.md §12.

| # | Workspace family | Audience | Primary concern domain | Bounded context | Separation rationale |
|---|-----------------|----------|----------------------|----------------|---------------------|
| 1 | **Control plane** | Platform operators, super-admins | Tenant lifecycle, legal-market selection, provisioning, system-wide configuration, pack eligibility, launch tiers | `apps/control-plane/` | Not tenant-scoped. Operates across all tenants. Different auth model from tenant workspaces. |
| 2 | **Tenant operational admin** | Tenant administrators | Facility management, user management, module enablement, device/printer defaults, site parameters, operational configuration | `apps/tenant-admin/` | Always tenant-scoped. Different concerns from both control plane (system-wide) and clinical (patient care). |
| 3 | **Clinical** | Clinicians (physicians, nurses, pharmacists, therapists) | Patient care — encounters, orders, medications, notes, vitals, allergies, problems, results | Platform API / clinical workspace (future app) | Patient-scoped within tenant context. Real-time VistA data. PHI-intensive. Safety-critical. |
| 4 | **Ancillary, operational, and integration** | Scheduling staff, billing/revenue cycle staff, IT operations, integration engineers | Scheduling, revenue cycle management, health information exchange, system integration, device management | Platform API / ancillary workspace (future app) | Operational but not direct patient care. May be PHI-adjacent. Cross-cuts multiple VistA packages. |
| 5 | **Revenue cycle** | Billing specialists, coders, claims analysts, financial officers | Claims lifecycle, payer management, EDI pipeline, coding, charge capture, remittance | Platform API / RCM workspace (future app) | Financial data with PHI linkage. Regulatory compliance. Distinct from clinical care workflow. |
| 6 | **Analytics and BI** | Analysts, quality officers, executives, BI tool users | Aggregate metrics, trend analysis, quality reporting, population health, executive dashboards | Platform API / analytics workspace (future app) | Aggregate and historical data. No real-time clinical decisions. PHI boundary enforced (specialty-content-analytics §12). |
| 7 | **IT and integration ops** | IT administrators, integration engineers, DevOps | System health, integration monitoring, telemetry, infrastructure management, VistA connectivity | Platform API / IT-ops workspace (future app) | Infrastructure-level. No clinical or financial data in normal operation. Sensitive operational data. |

### 7.1 Workspace family notes

- **Revenue cycle** is listed separately from "ancillary/operational" because global-arch §12 lists it as a distinct workspace. It has distinct regulatory, compliance, and workflow requirements that justify separation.
- **Clinical workspace family** will likely contain sub-workspaces (e.g., inpatient vs outpatient, per-specialty). The sub-workspace model is deferred to screen contract design.
- **Content administration** is defined in §16 as a functional area within the tenant-admin workspace, not as a separate family. See §16 for rationale.

---

## 8. Role-to-workspace alignment

Role categories are derived from organization-facility-network-service-model.md §5.4 (practitioner roles) and global-system-architecture-spec.md §13 (control-plane vs tenant-admin audiences).

| Role category | Control plane | Tenant admin | Clinical | Ancillary/ops | Revenue cycle | Analytics/BI | IT/Integration |
|--------------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Platform operator / super-admin** | Full | Cross-tenant view | — | — | — | System-level | Full |
| **Tenant administrator** | — | Full (own tenant) | — | Operational config | Financial config | Tenant-level | Tenant IT config |
| **Clinician (physician, nurse, pharmacist)** | — | — | Full (per scope) | Scheduling (own) | — | Clinical quality | — |
| **Ancillary staff (scheduling, HIM, intake)** | — | — | Limited (read-only where authorized) | Full (per scope) | — | Operational | — |
| **Revenue cycle staff (billing, coding, claims)** | — | — | — | — | Full (per scope) | Financial | — |
| **Analyst / quality officer** | — | — | — | — | — | Full (per scope) | — |
| **IT / integration engineer** | — | Delegated IT admin | — | — | — | System-level | Full (per scope) |

### 8.1 Reading the table

- **Full** means the role category has access to the workspace for its intended use cases.
- **Limited** or qualifier text means the role has constrained access (read-only, specific functional areas, or specific entity scopes).
- A dash (**—**) means the role category has no standard access to that workspace. Exceptional access (e.g., break-glass clinical access for IT staff) is governed by the access-control specification (future artifact), not this table.
- **Per scope** means access is further constrained by the entity context model (facility, department, service line) defined in org-facility-network-service §17.
- This table defines workspace-level entitlements, not fine-grained permissions. A clinician with "Full" clinical access still has per-patient, per-facility, and per-action permissions governed by VistA keys, person class, and platform access control.

### 8.2 Tenant-scoping rule

All workspace access except **control plane** and **system-level IT/integration** is tenant-scoped. A user authenticated in Tenant A cannot see data from Tenant B in any workspace. This is a platform-level invariant, not a per-workspace configuration.

---

## 9. Navigation model

### 9.1 Navigation hierarchy

Navigation in VistA Evolved follows a three-level hierarchy:

1. **Workspace level.** The user's current workspace determines the navigation domain. The workspace switcher (if rendered by the shell) allows cross-workspace transitions (§10).
2. **Primary navigation level.** Within a workspace, the primary navigation provides access to the workspace's major functional areas. Examples: "Patients" / "Orders" / "Notes" in the clinical workspace; "Facilities" / "Users" / "Modules" in the tenant-admin workspace.
3. **Local navigation level.** Within a functional area, local navigation provides access to sub-areas, detail views, or tab sets. Examples: "Active Orders" / "Completed Orders" / "Flagged Orders" within an orders functional area.

### 9.2 Navigation ownership

| Level | Governed by | Defined in |
|-------|-----------|-----------|
| Workspace selection | This spec (§7, §10) | Navigation manifest (future, part of screen contracts) |
| Primary navigation | Screen contracts per workspace | `packages/contracts/schemas/` (artifact #7) |
| Local navigation | Screen contracts per surface | `packages/contracts/schemas/` (artifact #7) |

### 9.3 Navigation constraints

1. **No deep-linking across boundaries without transition.** A URL or navigation action that targets a specific surface in another workspace must invoke a cross-workspace transition (§10). Deep-linking into another workspace's surface while remaining in the current workspace's shell is a boundary breach.
2. **No hidden workspaces.** Every workspace that a user has access to must be discoverable through the workspace switcher or a governed cross-workspace transition. Workspaces must not be accessible only through undocumented URLs or secret navigation paths.
3. **Consistent navigation patterns.** All workspaces must use the three-level navigation hierarchy. A workspace may not invent a fourth level or collapse the hierarchy in ways that obscure workspace boundaries.
4. **Context preservation across transition.** When a cross-workspace transition occurs, the source workspace must document what context it passes to the target workspace (e.g., patient DFN, facility IEN, tenant ID). Context passing is via URL parameters, not shared state.

---

## 10. Cross-workspace transition rules

A cross-workspace transition is any navigation action that takes the user from one workspace family to another. Transitions are governed by the following rules.

### 10.1 Transition rule table

| Rule | Description | Enforcement |
|------|-----------|-------------|
| **T1: Explicit indicator** | The user must be informed that they are transitioning to a different workspace. The target workspace name must be visible before the transition completes. | Shell / navigation component |
| **T2: Context declaration** | Every transition must declare what context is passed to the target workspace (e.g., patientDfn, facilityIen, tenantId). Undeclared context passing is forbidden. | Screen contract — transition declarations |
| **T3: Access re-evaluation** | When entering the target workspace, the user's access must be re-evaluated for that workspace. Holding a session in the source workspace does not automatically grant access to the target. | Access control middleware |
| **T4: No back-channel state** | The source workspace must not retain a handle to control or mutate state in the target workspace after transition. Navigation back to the source workspace re-enters it through the source's own entry point. | Architecture review |
| **T5: Audit trail** | Cross-workspace transitions must be auditable. The transition event (source workspace, target workspace, user, timestamp, context passed) must be loggable. | Audit middleware |
| **T6: PHI boundary respect** | Transitions from a non-PHI workspace (e.g., analytics with de-identified data) to a PHI workspace (e.g., clinical) must re-establish PHI access authorization. Transitions must not smuggle PHI context from clinical into non-PHI workspaces. | Access control + screen contracts |

### 10.2 Common transition patterns

| Source workspace | Target workspace | Typical context | Notes |
|-----------------|-----------------|----------------|-------|
| Control plane | Tenant admin | tenantId | Operator drills into tenant configuration |
| Tenant admin | Clinical | — | Tenant admin does not typically enter clinical workspace; if needed, separate clinical session required |
| Clinical | Analytics/BI | — (or aggregated context) | Clinician accessing quality dashboards; no patient context carries to analytics unless analytics surface is patient-scoped and PHI-governed |
| Revenue cycle | Clinical | patientDfn, encounterRef | Claims staff viewing encounter details; clinical access required |
| IT/Integration | Tenant admin | tenantId | IT staff managing tenant infrastructure config |
| Tenant admin | Content admin (§16) | — | Within tenant-admin workspace; this is local navigation, not a cross-workspace transition |

---

## 11. Control-plane workspace

### 11.1 Scope and audience

The control-plane workspace is the platform-operator environment for managing system-wide concerns that are not scoped to any single tenant. Per VE-PLAT-ADR-0003 and global-architecture §13:

> Control plane manages tenants, deployment profiles, capability packs, system-wide config. Lives in `apps/control-plane/`. Not tenant-scoped; operators/super-admins only.

### 11.2 Primary concern areas

| Concern area | Description | Key data sources |
|-------------|------------|-----------------|
| **Tenant lifecycle** | Create, configure, suspend, archive tenants | Platform DB (tenant registry) |
| **Legal-market selection** | Assign legal markets to tenants; gate by launch tier (country-payer §12) | Country-payer readiness registry |
| **Provisioning** | Wire packs, adapters, modules for a tenant; resolve eligibility (pack-adapter §11) | Capability pack manifests, adapter registry |
| **Pack eligibility and catalog** | View, manage, and gate capability packs across the platform | Pack registry (pack-adapter §6) |
| **Launch-tier management** | Set and enforce launch tiers per market (country-payer §12) | Country-payer readiness registry |
| **System configuration** | Platform-wide settings, feature flags, deployment profiles | Platform config |
| **Operator support** | Cross-tenant troubleshooting, system health overview | Platform telemetry, audit trails |

### 11.3 Claim surfaces in control plane

The control-plane workspace surfaces capability and readiness claims to operators and super-admins. Per capability-truth §10 and §15:

- **Full readiness detail** — operators see all readiness states including internal-only states (T0, not-assessed).
- **No claim inflation** — the control plane displays governed readiness state, not marketing language.
- **Provisioning is gated** — signup/onboarding surfaces present only eligible configurations per customer's market and launch tier.

### 11.4 Boundaries

- The control-plane workspace is **not tenant-scoped**. It operates across all tenants.
- It must **not render clinical, patient, or PHI data**. If an operator needs to view patient data for support purposes, a cross-workspace transition to the clinical workspace (with appropriate authorization) is required.
- Content displayed in the control plane may reference tenant names, facility names, and configuration details, but not patient-identifiable information.

---

## 12. Tenant-admin workspace

### 12.1 Scope and audience

The tenant-admin workspace is the per-tenant environment for tenant administrators to configure and manage their tenant's operational settings. Per VE-PLAT-ADR-0003 and global-architecture §13:

> Tenant admin: per-tenant configuration, facility linkage, module enablement, tenant users. Exposed via tenant-admin app (`apps/tenant-admin/`) or APIs. All operations scoped to a tenant context.

### 12.2 Primary concern areas

| Concern area | Description | Key data sources |
|-------------|------------|-----------------|
| **Facility management** | Register, configure, and manage facilities within the tenant | Org-facility model (org-facility §5.1) |
| **User management** | Create, assign, and manage user accounts within the tenant | Platform identity, VistA user bridge |
| **Module enablement** | Enable/disable modules and capabilities within the tenant's entitlement | Module registry, capability manifests |
| **Device and printer defaults** | Configure site-specific hardware defaults | Tenant config |
| **Site parameters** | Facility-level and department-level operational parameters | Tenant config, VistA site parameters |
| **Operational configuration** | Scheduling rules, workflow defaults, integration settings | Tenant config |
| **Content administration** (§16) | Content lifecycle management — a functional area within the tenant-admin workspace | Content registry (specialty-content-analytics §8) |

### 12.3 Claim surfaces in tenant admin

Per capability-truth §16:

- **Only eligible and activated capabilities** are visible to tenant admins.
- **Integration-pending** labels are shown when capabilities have stub adapters or unverified packs.
- **Tenant admin does not set readiness truth** — activation changes operational state, not readiness state.
- **Payer information** is scoped to the tenant's legal market (country-payer §16.1).

### 12.4 Boundaries

- The tenant-admin workspace is **always tenant-scoped**. A tenant admin sees only their own tenant's data.
- It must **not render clinical or patient data**. If a tenant admin needs to verify clinical data flow, a cross-workspace transition to the clinical workspace (with appropriate authorization) is required.
- Tenant admins **cannot access other tenants' data** and **cannot modify platform-wide settings** (those are control-plane concerns).

---

## 13. Clinical workspace family

### 13.1 Scope and audience

The clinical workspace family serves clinicians performing direct patient care. This is the most safety-critical workspace family — errors here can directly affect patient outcomes.

### 13.2 Primary concern areas

| Concern area | Description | VistA grounding |
|-------------|------------|-----------------|
| **Patient context** | Patient selection, demographics, care team assignment | DPT (File 2), VistA patient lookup RPCs |
| **Encounter management** | Visit creation, encounter data entry | PCE (V-files), ORWPCE RPCs |
| **Orders / CPOE** | Medication, lab, radiology, consult orders | OE/RR (File 100), ORWDX RPCs |
| **Medications** | Active meds, administration, pharmacy review | Pharmacy packages, ORWPS/PSB RPCs |
| **Clinical notes** | Progress notes, discharge summaries, consult responses | TIU (File 8925), TIU RPCs |
| **Vitals and measurements** | Vital signs, I/O, measurements | GMRV RPCs |
| **Allergies** | Allergy list, allergy entry | GMRA, ORQQAL RPCs |
| **Problems** | Problem list management | GMPL, Problem RPCs |
| **Results** | Lab results, radiology reports, pathology | Lab (File 63), ORWLRR RPCs |
| **Clinical decision support** | Drug interaction checks, order alerts, clinical reminders | ORWDXC, Clinical Reminders RPCs |

### 13.3 Boundaries

- The clinical workspace is **always patient-scoped within a tenant context**. Clinical surfaces display data for a selected patient.
- **VistA is the source of truth** for all clinical data (data-ownership-matrix.md). The clinical workspace reads from and writes to VistA through the platform's API contracts.
- **PHI is pervasive.** Every surface in the clinical workspace handles patient-identifiable data. Access is governed by VistA keys, person class, and platform access control.
- **Real-time data.** Clinical surfaces must display current VistA data, not cached or aggregated data. The analytics workspace handles historical and aggregate analysis.
- **Safety-critical.** Clinical workspace changes (orders, notes, allergy entries) can directly affect patient care. Write operations must be audited, ordered through governed CPOE flows, and subject to clinical decision support checks.

### 13.4 Sub-workspace model (deferred)

The clinical workspace will likely be divided into sub-workspaces (e.g., inpatient, outpatient, emergency, surgical). The sub-workspace taxonomy and its mapping to VistA location types and clinical contexts is deferred to the screen contract schema (artifact #7).

---

## 14. Ancillary, operational, and integration workspace family

### 14.1 Scope and audience

This workspace family serves staff who support clinical and operational workflows without directly providing patient care. Includes scheduling staff, health information management (HIM), intake coordinators, and operational managers.

### 14.2 Primary concern areas

| Concern area | Description |
|-------------|------------|
| **Scheduling** | Appointment management, clinic resource scheduling, patient flow |
| **Health information management** | Record management, coding, release of information |
| **Intake and registration** | Patient registration, insurance verification, demographic updates |
| **Operational reporting** | Workload statistics, operational metrics, utilization reports |
| **Device and integration management** | DICOM device registry, HL7 interface status, integration monitoring |

### 14.3 Boundaries

- **PHI-adjacent.** Ancillary staff may see patient demographics, appointment data, and clinical summaries relevant to their function, but do not have full clinical data access.
- **Tenant-scoped.** All operations are within the user's tenant and facility context.
- **Distinct from clinical.** Scheduling a patient is ancillary; treating a patient is clinical. The boundary is the nature of the action, not the data proximity.

---

## 15. Analytics and BI workspace family

### 15.1 Scope and audience

The analytics workspace serves analysts, quality officers, executives, and BI tool users who need aggregate metrics, trend data, and reporting capabilities.

### 15.2 Primary concern areas

| Concern area | Description |
|-------------|------------|
| **Quality metrics** | Clinical quality measures, safety indicators, outcome tracking |
| **Operational analytics** | Throughput, utilization, wait times, efficiency metrics |
| **Financial analytics** | Revenue cycle metrics, claim denial rates, reimbursement trends |
| **Population health** | Aggregate population metrics, risk stratification summaries |
| **Executive dashboards** | High-level summary dashboards for leadership |

### 15.3 Analytics boundary rules (from specialty-content-analytics §11)

These rules govern all analytics surfaces in the analytics workspace:

1. **Analytics does not replace VistA truth.** Aggregated metrics are derived from VistA data through governed ETL or event projections.
2. **No hidden write paths.** No analytics surface may accept user input that modifies operational data.
3. **No uncontrolled dashboard sprawl.** Every analytics surface must have a screen contract and role-based access.
4. **PHI safety at the boundary.** Analytics stores must not contain patient-identifiable data unless explicitly governed by consent frameworks, access controls, and audit (specialty-content-analytics §12).
5. **Population vs individual.** Population health metrics are analytics concerns. Individual patient care decisions belong in the clinical workspace.
6. **Analytics contracts required.** The schema, refresh cadence, access controls, and data-classification level of every analytics read model must be documented in a contract before implementation.
7. **Dashboard creation requires architectural review.** No team may ship a new analytics surface without review against the boundary rules.

### 15.4 Boundaries

- **De-identified by default.** Analytics surfaces present aggregate and de-identified data unless a specific surface has PHI governance (consent, access controls, audit trail) documented in its screen contract.
- **No clinical decision-making from analytics.** Analytics surfaces present historical and aggregate data. Clinical decisions use the clinical workspace with real-time VistA data.
- **Read-only.** Analytics surfaces display data. They do not provide write paths to operational systems.
- **Readiness claims on dashboards follow claim-gating rules** (specialty-content-analytics §11.4, capability-truth §11). If a dashboard displays readiness or capability information, it must show the governed readiness state.

---

## 16. Content administration workspace

### 16.1 Placement decision

Content administration is a **functional area within the tenant-admin workspace** (§12), not a separate workspace family. Rationale:

1. Content lifecycle management (authoring, review, publishing, versioning) is a tenant-scoped administrative activity.
2. Content admins are typically a subset of tenant admins or users explicitly delegated content management authority by tenant admins.
3. Creating a separate workspace family would fragment the administrative experience without adding boundary value — content admin shares the same tenant-scoping, the same access model, and the same data ownership as other tenant-admin concerns.
4. The navigation model (§9) accommodates this as primary navigation within the tenant-admin workspace (e.g., a "Content" section alongside "Facilities," "Users," "Modules").

### 16.2 Scope and concern areas

Per specialty-content-and-analytics-architecture-spec.md §8 (content lifecycle):

| Concern area | Description |
|-------------|------------|
| **Content catalog** | View available content packs, their status, versioning, and applicability to the tenant's specialties and market |
| **Activation and configuration** | Activate content packs within the tenant's entitlement; configure tenant-specific content overlays |
| **Review and approval** | Review content changes before publishing; approve updated content packs for tenant adoption |
| **Version management** | View version history, roll back to previous versions, compare versions |
| **Audit trail** | View content change history, who approved what, when |

### 16.3 Boundaries

- **Tenant-scoped.** Content admins manage content within their tenant's entitlement.
- **No direct VistA content editing.** Content packs define what VistA configuration and clinical content is active, but the content administration workspace does not provide a MUMPS editor or direct global modification. VistA content changes flow through the pack lifecycle.
- **No content creation from scratch.** Content creation (authoring new clinical templates, order sets, clinical reminders) is a VistA-side or specialty-pack-development activity, not a tenant-admin activity. Tenant admins configure and activate, not author.

### 16.4 Fulfillment of handoff item #3

This section fulfills specialty-content-analytics §20 handoff item #3: "Content administration workspace — This spec defines content lifecycle and ownership. The next spec must define how content administrators interact with the content lifecycle — what they see, what actions they can take, and how the workspace enforces governance."

The content administration functional area within tenant-admin provides:
- **What they see:** Content catalog, pack status, version history, audit trail.
- **What actions they can take:** Activate, deactivate, configure overlays, approve updates, roll back.
- **How workspace enforces governance:** Tenant-scoping, entitlement gating, audit trail, content pack lifecycle state machine (only published packs can be activated).

---

## 17. Claim-surface placement

Claim surfaces display capability and readiness claims to various audiences. The claim-surface model is defined in capability-truth-and-claim-gating-spec.md §10. This section defines where each claim surface type is placed within the workspace model.

### 17.1 Claim-surface placement table

| Claim surface | Workspace placement | Audience | Gating requirement | Key governance source |
|--------------|-------------------|---------|-------------------|--------------------|
| **Public website** | External (not a platform workspace) | External visitors, prospects | Must show only claimable-or-higher in the claimed scope | Capability-truth §10, §11 |
| **Sales / partnership decks** | External (not a platform workspace) | Partners, prospects | Only verified-or-higher; pilot-only must be labeled | Capability-truth §10, §11 |
| **Onboarding / signup** | Control-plane workspace (§11) | New customers | Only eligible and claimable capabilities per customer's market | Capability-truth §15, country-payer §15 |
| **Control-plane provisioning** | Control-plane workspace (§11) | Operators, super-admins | Full readiness detail; operators see all states | Capability-truth §15 |
| **Tenant-admin enablement** | Tenant-admin workspace (§12) | Tenant admins | Only eligible + activated capabilities; pending shown as pending | Capability-truth §16 |
| **Internal roadmap** | Control-plane workspace (§11) or external tool | Internal team | Clearly separate planned from verified | Capability-truth §10 |
| **Support documentation** | IT/integration workspace (§7 row 7) or external knowledge base | Support engineers | Full transparency on partial support and known gaps | Capability-truth §10 |
| **Notion mirrors** | External tool (Notion) | Internal stakeholders | Must reflect governed state, not optimistic summary | Capability-truth §10, Notion sync policy |

### 17.2 Claim-surface placement rules

1. **Every claim surface has a workspace home (or is explicitly external).** No claim surface exists in an ambiguous location.
2. **Claim-gating rules apply regardless of workspace.** The gating requirements from capability-truth §11 are not relaxed by workspace placement.
3. **External surfaces are governed by the same truth.** The fact that a surface is outside the platform workspace model (e.g., public website, Notion) does not exempt it from claim-gating governance.
4. **Launch-tier mapping applies.** Per country-payer §12.3, claim surfaces respect the launch-tier → visibility mapping (T0 = internal only, T1 = named pilot, T2 = limited, T3 = general availability).

### 17.3 Fulfillment of handoff item #5

This section fulfills specialty-content-analytics §20 handoff item #5: "Claim-surface presentation — The capability truth and country-payer specs define claim surfaces. The next spec must define how those surfaces are presented in control-plane and tenant-admin workspaces."

The placement table (§17.1) and rules (§17.2) define:
- Which workspace each claim surface belongs to.
- What gating applies at each placement point.
- That control plane shows full readiness detail while tenant admin shows only eligible + activated capabilities.

---

## 18. Dashboard and analytics surface placement

### 18.1 Guiding principles

Analytics surfaces are subject to both workspace boundary rules (this spec) and analytics boundary rules (specialty-content-analytics §11). The intersection produces the following placement principles.

1. **Analytics surfaces live in the analytics workspace (§15) by default.** This is the governed home for aggregate metrics, trend data, quality reports, and executive dashboards.
2. **Tenant-scoped analytics.** Analytics surfaces are tenant-scoped. A tenant's analysts see only their tenant's aggregated data. Platform operators may see cross-tenant system-level metrics in the IT/integration workspace.
3. **Clinical quality metrics in analytics, not clinical.** Even though clinicians may be the audience for clinical quality metrics, those surfaces belong in the analytics workspace because they present aggregate/historical data, not real-time clinical decision data.
4. **Inline operational metrics are allowed within their home workspace** when the metric is directly relevant to the workspace's primary concern. Example: a claims-processing throughput gauge in the revenue cycle workspace is an operational metric within its home workspace, not an analytics-workspace surface. The distinction is:
   - **Analytics workspace surface:** Standalone report, dashboard, or visualization designed for analysis and trending.
   - **Inline operational metric:** A small, focused indicator embedded in an operational surface to support the surface's primary workflow.
5. **Inline operational metrics must still have screen contracts.** Even small metric indicators must declare their data source, data classification, and access requirements.

### 18.2 Fulfillment of handoff item #2

This section (combined with §15 and §19) fulfills specialty-content-analytics §20 handoff item #2: "Screen contracts for analytics surfaces — This spec defines analytics boundary rules and dashboard governance principles. The next spec must define the screen contract format and review process for individual BI surfaces."

This spec defines:
- Where analytics surfaces are placed (§15, §18).
- What boundary rules apply (§15.3).
- That every analytics surface must have a screen contract (§15.3 rule 3, §18.1 principle 5).

The **screen contract format and review process** is delegated to artifact #7 (screen contract schema), which will define the machine-readable format for analytics surface contracts, including required fields for data classification, PHI governance, refresh cadence, and access requirements.

---

## 19. Screen-contract implications

This section defines the requirements that the screen contract schema (artifact #7 in global-arch §20) must satisfy to implement the workspace model defined in this spec.

### 19.1 Required screen contract fields

Every screen contract must include at minimum:

| Field | Purpose | Derived from |
|-------|---------|-------------|
| **surfaceId** | Unique identifier for the surface | Standard practice |
| **workspaceFamily** | Which of the 7 workspace families (§7) this surface belongs to | This spec §7 |
| **workspaceName** | Specific workspace within the family (for families with sub-workspaces) | This spec §7, §13.4 |
| **navigationLevel** | Primary or local (§9) | This spec §9 |
| **dataSources** | What data the surface consumes (VistA RPCs, platform APIs, analytics read models) | Contract-first (VE-PLAT-ADR-0002) |
| **dataClassification** | PHI / de-identified / aggregate / operational / configuration | Specialty-content-analytics §12, this spec §15.3 |
| **accessRequirements** | Role categories (§8) plus any entity-context scoping required | This spec §8, org-facility §17 |
| **crossWorkspaceTransitions** | Declared transitions from this surface to surfaces in other workspaces, with context parameters | This spec §10 |
| **claimSurfaceType** | If this surface is a claim surface, which type (§17.1); null otherwise | Capability-truth §10, this spec §17 |
| **refreshBehavior** | Real-time / polling / on-demand / event-driven / static | Standard practice |

### 19.2 Screen contract validation rules

The screen contract schema must enforce:

1. **Workspace affiliation is mandatory.** A surface without a declared workspace family is rejected.
2. **Data classification is mandatory.** No surface may omit its data classification.
3. **PHI surfaces require explicit access requirements.** A surface with `dataClassification: PHI` must declare specific role and entity-context access requirements. "Any authenticated user" is not a valid access requirement for PHI surfaces.
4. **Analytics surfaces require analytics boundary compliance.** A surface in the analytics workspace must declare refresh cadence, data classification, and that it does not contain undisclosed PHI.
5. **Claim surfaces require claim-gating compliance.** A surface declared as a claim surface must reference the claim-gating rule that governs it.
6. **Cross-workspace transitions require context declarations.** If a surface declares cross-workspace transitions, each transition must specify the target workspace and the context parameters passed.

### 19.3 Fulfillment of handoff item #4

This section (combined with §9 and §10) fulfills specialty-content-analytics §20 handoff item #4: "Cross-workspace navigation — The global architecture (Section 12) defines workspace separation rules. The next spec must define the navigation model that connects workspaces while maintaining boundaries."

This spec defines:
- The navigation hierarchy (§9.1) — workspace, primary, local.
- Navigation ownership and constraints (§9.2–9.3).
- Cross-workspace transition rules (§10).
- Screen contract fields for navigation and transition declarations (§19.1).

The screen contract schema (artifact #7) will provide the machine-readable format.

---

## 20. Safety and anti-drift constraints

### 20.1 Architectural invariants

The following constraints are non-negotiable. They are not "best practices" or "guidelines" — they are hard rules that implementations must enforce.

1. **No workspace collapse.** Two workspace families must never be merged into a single navigation domain. If implementation pressure argues for merging (e.g., "clinicians want billing info in the clinical view"), the correct response is a governed cross-workspace transition, not a boundary collapse.
2. **No inline rendering across boundaries.** Embedding a surface from workspace A inside workspace B's layout (iframe, micro-frontend embed, or server-side include) is a boundary breach. Cross-workspace data is accessed through APIs and displayed in the target workspace's own surfaces.
3. **No shared mutable state.** Workspaces do not share form state, selection state, draft records, or any mutable UI state. Read-only shared references (e.g., a patient identifier) are passed as context parameters in cross-workspace transitions.
4. **No ad-hoc navigation paths.** Every navigation path (within workspace and cross-workspace) must be declared in a screen contract or navigation manifest. Undeclared paths are boundary breaches.
5. **No PHI in non-PHI workspaces.** Analytics surfaces are de-identified by default (§15.4). Control plane surfaces do not contain patient data (§11.4). If a legitimate need arises for PHI in a non-PHI workspace, it requires an architecture review, an explicit screen contract with PHI governance, and access control enforcement.
6. **No claim inflation across surfaces.** A claim surface must not present a capability state higher than its governed readiness level. This applies regardless of which workspace hosts the claim surface.

### 20.2 Drift detection mechanisms

| Mechanism | What it catches | Implementation status |
|-----------|----------------|---------------------|
| **Screen contract validation** | Surfaces with missing workspace affiliation, missing data classification, undeclared transitions | Requires artifact #7 |
| **Nx module boundaries** | Code imports that cross bounded-context boundaries (e.g., tenant-admin importing from control-plane internals) | Planned (see nx-adoption-plan.md) |
| **CI governance gates** | Structural checks on screen contracts, navigation manifests, and workspace declarations | Future (extends existing `scripts/governance/` pattern) |
| **Architecture review** | New surfaces, new dashboards, new workspace transitions | Process-level (manual review) |

---

## 21. Resolved now vs deferred later

| Decision | Status | Notes |
|----------|--------|-------|
| 7 workspace families identified | **Resolved** | Derived from global-arch §12 |
| Role-to-workspace alignment defined | **Resolved** | §8 — workspace-level entitlements, not fine-grained permissions |
| Navigation hierarchy (3 levels) | **Resolved** | §9 — workspace, primary, local |
| Cross-workspace transition rules (6 rules) | **Resolved** | §10 — T1 through T6 |
| Control-plane workspace scope | **Resolved** | §11 — not tenant-scoped, full readiness detail |
| Tenant-admin workspace scope | **Resolved** | §12 — tenant-scoped, includes content admin |
| Content admin is within tenant-admin | **Resolved** | §16 — functional area, not separate family |
| Claim-surface placement | **Resolved** | §17 — each surface assigned a workspace home |
| Analytics boundary rules adopted | **Resolved** | §15.3 — rules from specialty-content-analytics §11 |
| Screen contract field requirements | **Resolved** | §19.1 — minimum required fields defined |
| Clinical sub-workspace taxonomy | **Deferred** | Screen contract schema (artifact #7) |
| Fine-grained permission matrix | **Deferred** | Future access-control specification |
| Screen inventory (individual screens/panels) | **Deferred** | Screen contract schema (artifact #7) |
| Dashboard-specific screen contracts | **Deferred** | Screen contract schema (artifact #7) |
| Navigation manifest format | **Deferred** | Screen contract schema (artifact #7) |
| Shell design (chrome, layout, workspace switcher) | **Deferred** | Future UI implementation (not authorized) |
| VistA menu-to-workspace mapping | **Deferred** | Future clinical workspace detailed design |
| Nx module boundary enforcement | **Deferred** | Planned (see nx-adoption-plan.md) |
| CI governance gates for screen contracts | **Deferred** | Requires screen contract schema first |

---

## 22. Explicit out-of-scope

| Item | Status | Reason |
|------|--------|--------|
| Screen implementation (HTML, components, layouts) | Not authorized | Global architecture §19 — no broad UI implementation |
| Dashboard design (metrics, layout, visual design) | Not authorized | This spec places dashboards; it does not design them |
| Component library / design system implementation | Not authorized | `packages/ui/` concern, not architecture spec concern |
| Fine-grained RBAC / permission matrices | Deferred, not in scope for this spec | Requires workspace model (this spec) + entity model (org-facility) + access-control spec (future) |
| Mobile / offline workspace behavior | Not in scope | Future mobile-strategy concern |
| Notification / alert routing across workspaces | Not in scope | Future notification-architecture concern |
| VistA CPRS menu hierarchy mapping | Not in scope | VistA-internal concern; platform defines workspace model, not VistA menu layout |
| External portal / patient-facing workspace | Not in scope | Patient portal is a separate concern not addressed by the 7-family model; would require its own workspace family definition if authorized |

---

## 23. Next artifact handoff

The next artifact in the global system architecture sequence is:

> **Screen Contract Schema** (`packages/contracts/schemas/screen-contract-schema`) — artifact #7.

This specification hands off the following items to that artifact:

1. **Screen contract field schema.** §19.1 defines the minimum required fields for every screen contract. Artifact #7 must define the machine-readable JSON Schema that implements these fields, including validation rules, enums for workspace families and data classifications, and the transition declaration format.

2. **Clinical sub-workspace taxonomy.** §13.4 defers the clinical sub-workspace model (inpatient, outpatient, emergency, etc.) to the screen contract schema. Artifact #7 must define how sub-workspaces are declared within a workspace family and how they relate to VistA location types.

3. **Analytics surface contract format.** §18.2 and §19.2 define the governance requirements for analytics surface contracts. Artifact #7 must define the specific schema fields for analytics surfaces: refresh cadence, de-identification proof, data-classification declaration, and architectural review reference.

4. **Navigation manifest format.** §9.2 establishes that primary and local navigation are defined in screen contracts. Artifact #7 must define the navigation manifest format that declares a workspace's primary navigation entries, their ordering, and their screen contract references.

5. **Cross-workspace transition declaration format.** §10 and §19.1 define transition rules and required fields. Artifact #7 must define the machine-readable format for transition declarations: source surface, target workspace, context parameters, and access re-evaluation requirements.

6. **Screen contract validation rules.** §19.2 defines six validation rules that the schema must enforce. Artifact #7 must define how these rules are expressed in the schema (required fields, conditional requirements, reference validation) and how CI gates consume them.

7. **Claim-surface contract extension.** §17 defines claim-surface types and gating requirements. Artifact #7 must define how claim surfaces are declared in screen contracts and how claim-gating rules are referenced.
