# Permissions Matrix

> **Status:** DRAFT — first governed pass.
> **Document type:** Reference artifact (planning-stage).
> **Governed by:** AGENTS.md, doc-governance.md, governed-build-protocol.md.
> **Consumes:** screen-inventory.md, information-architecture-workspace-map.md §8, screen-contract.schema.json (roleCategoryEnum, scopePostureEnum), organization-facility-network-service-model.md §5/§17, ai-assist-safety-spec.md §6/§9/§10, global-system-architecture-spec.md §12/§13.
> **Enables:** Pack visibility rules, screen-contract JSON instances, access-control specification.
> **Does NOT authorize:** RBAC implementation, authentication code, IdP/SSO integration, VistA security-key implementation, pack visibility rules, screen-contract JSON instances, UI routes, API routes.

---

## 1. Purpose

This document defines the first governed role × surface × action × entity-context permissions matrix for all surfaces inventoried in `docs/reference/screen-inventory.md`.

It answers: **for each inventoried surface, which role categories may perform which action classes, under what entity-context scope, and what is the decision status?**

This is a planning artifact. Its outputs feed downstream artifacts (pack visibility rules, screen-contract instances, access-control specification). It does NOT implement authorization logic, generate code, or prescribe enforcement mechanisms.

---

## 2. Inputs consumed

| Input | Location | What this matrix uses from it |
|-------|----------|-------------------------------|
| Screen inventory | `docs/reference/screen-inventory.md` | Surface IDs (29 concrete + 33 deferred families), role audiences, scope postures, read/write postures |
| Workspace map §8 | `docs/explanation/information-architecture-workspace-map.md` §8 | Role-to-workspace alignment table — workspace-level entitlements per role category |
| Screen contract schema | `packages/contracts/schemas/screen-contract.schema.json` | `roleCategoryEnum` (7 roles), `scopePostureEnum` (4 scopes), `workspaceFamilyEnum` (7 families) |
| Organization/facility model §5/§17 | `docs/explanation/organization-facility-network-service-model.md` | Entity hierarchy, tenant-scoping model, facility/department/clinic structures |
| AI assist safety spec §6/§9/§10 | `docs/explanation/ai-assist-safety-spec.md` | Assist class taxonomy, human review model, write-back rules — needed for `ai-review` and `ai-approve-insert` action classes |
| Global system architecture §12/§13 | `docs/explanation/global-system-architecture-spec.md` | Workspace family definitions, control-plane vs tenant-admin audience separation |

---

## 3. Non-goals

This document does **NOT**:

1. **Implement RBAC or authorization code.** No enforcement logic, no middleware, no guards.
2. **Define VistA security-key mappings.** VistA keys are inside-VistA authorization. This matrix operates at the platform permission layer.
3. **Produce pack visibility rules.** Pack visibility is a separate downstream artifact that consumes this matrix.
4. **Generate screen-contract JSON instances.** Screen contracts are a separate downstream artifact.
5. **Design authentication flows.** IdP, SSO, MFA, OIDC are authentication concerns outside this scope.
6. **Prescribe UI components or routes.** This matrix governs access policy, not presentation.
7. **Override or replicate inside-VistA authorization.** When a user accesses a terminal-native surface, VistA's own menu-option, security-key, and person-class authorization applies in addition to platform permission. This matrix does not model that interior layer.

---

## 4. Permission-model principles

### 4.1 Five critical separations

| # | Principle | Explanation |
|---|-----------|-------------|
| 1 | **Permission ≠ visibility** | A role may have permission to access a surface, but the surface may be invisible because the tenant's active packs do not include it. Visibility is governed by pack configuration, not by this matrix. |
| 2 | **Permission ≠ readiness** | A role may have permission to access a surface, but the surface may be non-functional because underlying capabilities are not yet at `claimable` readiness state. Readiness is governed by `capability-truth-and-claim-gating-spec.md`, not by this matrix. |
| 3 | **Permission ≠ inside-VistA authorization** | For terminal-native and VistA-backed surfaces, VistA has its own authorization layer: menu options, security keys, person class, provider class, electronic signature. Platform permission grants access to the surface; VistA authorization governs what happens inside. |
| 4 | **Permission ≠ pack activation** | Pack enablement/disablement is a tenant-admin operational decision. A role's permissions are role-intrinsic; pack activation is tenant configuration. They are orthogonal. |
| 5 | **Permission governs action on surface, not data ownership** | Data ownership is governed by `data-ownership-matrix.md`. This matrix governs who may perform what action on which surface, not who owns the underlying data. |

### 4.2 Platform permission layer vs VistA authorization layer

```
User request
  │
  ├─ Platform permission layer (this matrix)
  │    ├─ Role category check
  │    ├─ Entity-context scope check (tenant, facility, patient)
  │    └─ Action class check (view, configure, create, etc.)
  │
  └─ If surface is VistA-backed:
       └─ VistA authorization layer (NOT this matrix)
            ├─ Menu option access (File 101)
            ├─ Security key holding (File 8989.3)
            ├─ Person class / provider class
            └─ Electronic signature code
```

### 4.3 Default-deny posture

All permissions are default-deny. A role has no access to a surface unless explicitly granted by this matrix. The absence of a role from a surface's permitted list means `prohibited`.

### 4.4 Tenant-scoping invariant

Per workspace map §8.2: all workspace access except control-plane and system-level IT/integration is tenant-scoped. A user authenticated in Tenant A cannot access surfaces showing Tenant B data, regardless of role category.

---

## 5. Vocabulary and matrix conventions

### 5.1 Role categories (from `roleCategoryEnum`)

| Abbreviation | Full role category | Schema value |
|---|---|---|
| **PO** | Platform operator / super-admin | `platform-operator` |
| **TA** | Tenant administrator | `tenant-admin` |
| **CL** | Clinician (physician, nurse, pharmacist, therapist) | `clinician` |
| **AS** | Ancillary staff (scheduling, HIM, intake) | `ancillary-staff` |
| **RC** | Revenue cycle staff (billing, coding, claims) | `revenue-cycle-staff` |
| **AN** | Analyst / quality officer | `analyst` |
| **IT** | IT / integration engineer | `it-integration` |

### 5.2 Action classes

| Action class | Meaning |
|---|---|
| **view** | Read/view the surface and its data. No mutation. |
| **launch/open** | Navigate to and open the surface. Distinct from `view` for terminal-native surfaces where launching establishes a VistA session context. |
| **configure/administer** | Change settings, preferences, or configuration for the surface or its governed area. |
| **create/update** | Create new records or modify existing records through the surface. Write operation. |
| **approve/publish/activate** | Approve, sign, publish, release, or activate content or records. Elevated write authority. |
| **export** | Export data from the surface (reports, downloads, data extracts). |
| **ai-review** | Submit data from this surface context for AI-assisted review, summarization, or suggestion. Per ai-assist-safety-spec.md §6. |
| **ai-approve-insert** | Approve an AI-generated suggestion for insertion into the record through this surface. Per ai-assist-safety-spec.md §9/§10. Requires affirmative clinician act. |

### 5.3 Decision values

| Value | Symbol | Meaning |
|---|---|---|
| **allowed** | `A` | The role may perform this action on this surface. May still be subject to entity-context scoping. |
| **conditional** | `C` | The role may perform this action under specific conditions (documented in notes). |
| **prohibited** | `—` | The role may NOT perform this action on this surface. |
| **deferred** | `D` | The surface or action is architecturally defined but permission decision is deferred pending further design work. |
| **research-required** | `R` | Insufficient information to make a decision. Specific research gap noted. |

### 5.4 Entity-context scope (from `scopePostureEnum`)

| Scope | Meaning |
|---|---|
| **platform-wide** | No entity-context restriction. User sees all tenants/facilities. |
| **tenantId** | Scoped to the user's authenticated tenant. |
| **facilityId** | Scoped to a specific facility within the tenant. |
| **patientDfn** | Scoped to a specific patient record. |

### 5.5 Reading the matrices

Each matrix section below uses a compact table format:

- **Rows** = surfaces (by surfaceId or family name)
- **Columns** = role abbreviations (PO, TA, CL, AS, RC, AN, IT)
- **Cell values** = decision symbols (A, C, —, D, R) for the action class being described
- **Scope column** = the entity-context scope that applies to the surface

Where a surface has different decisions per action class, multiple tables are provided (one per action class grouping). Where decisions are uniform across action classes, a single summary table is used.

---

## 6. Methodology

### 6.1 Derivation process

1. **Start from workspace map §8 alignment table.** The workspace-level entitlement (Full / Limited / —) establishes the ceiling for surface-level permissions within that workspace.
2. **Refine per surface using screen inventory fields.** Each surface's `roleAudience`, `scopePosture`, and `readWritePosture` narrow the workspace-level ceiling.
3. **Apply action class granularity.** A role may have `view` permission but not `create/update` on the same surface (e.g., ancillary staff reading clinical data).
4. **Apply AI action rules.** `ai-review` and `ai-approve-insert` follow the assist safety spec: mandatory human review, no direct AI-to-VistA writes, approval is per-record affirmative act by authorized role.
5. **Mark honest gaps.** Where VistA authorization details or specific workflow requirements are unknown, mark `deferred` or `research-required` rather than guessing.

### 6.2 Inheritance rules

- A role with `configure/administer` on a surface implicitly has `view` on that surface.
- A role with `create/update` implicitly has `view`.
- A role with `approve/publish/activate` implicitly has `view`.
- `ai-approve-insert` requires the role to also have `create/update` on the surface.
- `export` is independent of `create/update` — a role may export without write permission.

---

## 7. Workspace-level matrices

### 7A. Control-plane surfaces

**Workspace family:** `control-plane`
**Scope:** `platform-wide`
**Governing reference:** Workspace map §7 row 1, §8 row "Platform operator."

Control-plane surfaces are exclusively for platform operators. No tenant-scoped role has standard access.

#### 7A.1 View / launch

| Surface | Scope | PO | TA | CL | AS | RC | AN | IT |
|---------|-------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `control-plane.tenants.list` | platform-wide | A | — | — | — | — | — | — |
| `control-plane.tenants.detail` | platform-wide | A | — | — | — | — | — | — |
| `control-plane.tenants.bootstrap` | platform-wide | A | — | — | — | — | — | — |
| `control-plane.markets.management` | platform-wide | A | — | — | — | — | — | — |
| `control-plane.markets.detail` | platform-wide | A | — | — | — | — | — | — |
| `control-plane.packs.catalog` | platform-wide | A | — | — | — | — | — | — |
| `control-plane.provisioning.runs` | platform-wide | A | — | — | — | — | — | — |
| `control-plane.system.config` | platform-wide | A | — | — | — | — | — | — |

#### 7A.2 Configure / administer

| Surface | Scope | PO | TA | CL | AS | RC | AN | IT |
|---------|-------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `control-plane.tenants.list` | platform-wide | A | — | — | — | — | — | — |
| `control-plane.tenants.detail` | platform-wide | A | — | — | — | — | — | — |
| `control-plane.tenants.bootstrap` | platform-wide | A | — | — | — | — | — | — |
| `control-plane.markets.management` | platform-wide | A | — | — | — | — | — | — |
| `control-plane.markets.detail` | platform-wide | A | — | — | — | — | — | — |
| `control-plane.packs.catalog` | platform-wide | A | — | — | — | — | — | — |
| `control-plane.provisioning.runs` | platform-wide | A | — | — | — | — | — | — |
| `control-plane.system.config` | platform-wide | A | — | — | — | — | — | — |

#### 7A.3 Create / update

| Surface | Scope | PO | TA | CL | AS | RC | AN | IT |
|---------|-------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `control-plane.tenants.list` | platform-wide | A | — | — | — | — | — | — |
| `control-plane.tenants.detail` | platform-wide | A | — | — | — | — | — | — |
| `control-plane.tenants.bootstrap` | platform-wide | A | — | — | — | — | — | — |
| `control-plane.markets.management` | platform-wide | A | — | — | — | — | — | — |
| `control-plane.markets.detail` | platform-wide | A | — | — | — | — | — | — |
| `control-plane.packs.catalog` | platform-wide | A | — | — | — | — | — | — |
| `control-plane.provisioning.runs` | platform-wide | A | — | — | — | — | — | — |
| `control-plane.system.config` | platform-wide | A | — | — | — | — | — | — |

#### 7A.4 Approve / publish / activate

| Surface | Scope | PO | TA | CL | AS | RC | AN | IT |
|---------|-------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `control-plane.tenants.list` | platform-wide | A | — | — | — | — | — | — |
| `control-plane.tenants.detail` | platform-wide | A | — | — | — | — | — | — |
| `control-plane.tenants.bootstrap` | platform-wide | A | — | — | — | — | — | — |
| `control-plane.markets.management` | platform-wide | A | — | — | — | — | — | — |
| `control-plane.markets.detail` | platform-wide | A | — | — | — | — | — | — |
| `control-plane.packs.catalog` | platform-wide | A | — | — | — | — | — | — |
| `control-plane.provisioning.runs` | platform-wide | A | — | — | — | — | — | — |
| `control-plane.system.config` | platform-wide | A | — | — | — | — | — | — |

#### 7A.5 Export

| Surface | Scope | PO | TA | CL | AS | RC | AN | IT |
|---------|-------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `control-plane.tenants.list` | platform-wide | A | — | — | — | — | — | — |
| `control-plane.tenants.detail` | platform-wide | A | — | — | — | — | — | — |
| `control-plane.tenants.bootstrap` | platform-wide | A | — | — | — | — | — | — |
| `control-plane.markets.management` | platform-wide | A | — | — | — | — | — | — |
| `control-plane.markets.detail` | platform-wide | A | — | — | — | — | — | — |
| `control-plane.packs.catalog` | platform-wide | A | — | — | — | — | — | — |
| `control-plane.provisioning.runs` | platform-wide | A | — | — | — | — | — | — |
| `control-plane.system.config` | platform-wide | A | — | — | — | — | — | — |

#### 7A.6 AI action classes

| Surface | Scope | ai-review | ai-approve-insert | Notes |
|---------|-------|:---------:|:------------------:|-------|
| `control-plane.tenants.list` | platform-wide | — | — | Platform governance data; no AI assist surface. |
| `control-plane.tenants.detail` | platform-wide | — | — | Single-tenant summary; no AI assist surface. |
| `control-plane.tenants.bootstrap` | platform-wide | — | — | Bootstrap orchestration; no AI assist surface. |
| `control-plane.markets.management` | platform-wide | — | — | Market configuration; no AI assist surface. |
| `control-plane.markets.detail` | platform-wide | — | — | Market readiness detail; no AI assist surface. |
| `control-plane.packs.catalog` | platform-wide | — | — | Pack catalog; no AI assist surface. |
| `control-plane.provisioning.runs` | platform-wide | — | — | Provisioning lifecycle; no AI assist surface. |
| `control-plane.system.config` | platform-wide | — | — | System config; no AI assist surface. |

#### 7A.7 Control-plane notes

- All control-plane surfaces are `platform-wide` scope — not tenant-scoped.
- Platform operator is the sole role with any access. The workspace map §8 gives all other roles a dash for control plane.
- `control-plane.tenants.list` is the tenant lifecycle surface — provisioning, suspension, decommissioning. Write operations here affect the entire tenant's existence.
- `control-plane.tenants.detail` is a drill-target from `tenants.list`. It shows a single-tenant summary with action-launch affordances for bootstrap and provisioning. It does not duplicate fields already visible in the list; it provides depth context.
- `control-plane.tenants.bootstrap` manages bootstrap request submission, plan review, and queue launch. Three OpenAPI operations and two AsyncAPI events bind to this surface. The `country-regulatory` packVariation means that bootstrap plans vary by legal-market (e.g., PhilHealth payer seed for PH tenants) but the surface itself is always visible.
- `control-plane.markets.detail` is read-only. It displays a single legal-market readiness profile including regulatory requirements, payer readiness, and pack eligibility. `country-regulatory` packVariation means content varies by market but the surface is always visible.
- `control-plane.provisioning.runs` tracks provisioning run lifecycle: queued → in-progress → completed/failed/rolled-back. Two OpenAPI operations and five AsyncAPI events bind to this surface. The operator can retry failed runs and inspect blockers.
- `control-plane.packs.catalog` manages pack eligibility across markets. This is distinct from `tenant-admin.content.catalog` which manages pack enablement within a single tenant.
- AI action classes are all prohibited because control-plane surfaces manage platform governance, not clinical or content data.

---

### 7B. Tenant-admin surfaces

**Workspace family:** `tenant-admin`
**Scope:** `tenantId` (all tenant-admin surfaces are tenant-scoped per workspace map §8.2)
**Governing reference:** Workspace map §7 row 2, §8 row "Tenant administrator."

Tenant-admin is primarily for tenant administrators with limited access for IT/integration (delegated IT admin) and platform operators (cross-tenant view).

#### 7B.1 View / launch

| Surface | Scope | PO | TA | CL | AS | RC | AN | IT |
|---------|-------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `tenant-admin.users.list` | tenantId | C | A | — | — | — | — | C |
| `tenant-admin.users.detail` | tenantId | C | A | — | — | — | — | C |
| `tenant-admin.users.roles-keys` | tenantId | C | A | — | — | — | — | — |
| `tenant-admin.facilities.list` | tenantId | C | A | — | — | — | — | C |
| `tenant-admin.clinics.list` | tenantId | C | A | — | — | — | — | C |
| `tenant-admin.wards.list` | tenantId | C | A | — | — | — | — | C |
| `tenant-admin.devices.list` | tenantId | C | A | — | — | — | — | C |
| `tenant-admin.site-params.overview` | tenantId | C | A | — | — | — | — | C |
| `tenant-admin.modules.enablement` | tenantId | C | A | — | — | — | — | — |
| `tenant-admin.content.catalog` | tenantId | C | A | — | — | — | — | — |

**PO conditions:** Platform operator can view any tenant's admin surfaces for support/troubleshooting purposes (cross-tenant view per workspace map §8). Access is audited.

**IT conditions:** IT/integration has delegated IT admin view per workspace map §8. Restricted to infrastructure-relevant surfaces (users, facilities, clinics, wards, devices, site-params). No access to roles-keys (security-sensitive), modules, or content catalog (operational decisions).

#### 7B.2 Configure / administer

| Surface | Scope | PO | TA | CL | AS | RC | AN | IT |
|---------|-------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `tenant-admin.users.list` | tenantId | — | A | — | — | — | — | — |
| `tenant-admin.users.detail` | tenantId | — | A | — | — | — | — | — |
| `tenant-admin.users.roles-keys` | tenantId | — | A | — | — | — | — | R |
| `tenant-admin.facilities.list` | tenantId | — | A | — | — | — | — | — |
| `tenant-admin.clinics.list` | tenantId | — | A | — | — | — | — | — |
| `tenant-admin.wards.list` | tenantId | — | A | — | — | — | — | — |
| `tenant-admin.devices.list` | tenantId | — | R | — | — | — | — | R |
| `tenant-admin.site-params.overview` | tenantId | — | R | — | — | — | — | R |
| `tenant-admin.modules.enablement` | tenantId | — | A | — | — | — | — | — |
| `tenant-admin.content.catalog` | tenantId | — | A | — | — | — | — | — |

**PO configure note:** Platform operators do NOT configure individual tenant settings directly. They operate at control-plane level. Tenant-specific config changes require the tenant admin role.

**IT conditions:**
- `devices.list`: Research required — screen inventory declares this surface `read-only` (VistA File 3.5 write posture is unresearched). Whether IT can configure device/printer settings through the platform depends on resolving the VistA write path. See screen inventory §7.7 notes.
- `site-params.overview`: Research required — screen inventory declares this surface `read-only` (VistA File 8989.3/8989.5 write posture is unresearched). Whether IT can configure infrastructure-related site parameters through the platform depends on resolving the VistA write path. See screen inventory §7.8 notes.
- `roles-keys`: Research required — whether IT should have any role in VistA key management is an open question (see §10 research gaps).

#### 7B.3 Create / update

| Surface | Scope | PO | TA | CL | AS | RC | AN | IT |
|---------|-------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `tenant-admin.users.list` | tenantId | — | A | — | — | — | — | — |
| `tenant-admin.users.detail` | tenantId | — | A | — | — | — | — | — |
| `tenant-admin.users.roles-keys` | tenantId | — | A | — | — | — | — | — |
| `tenant-admin.facilities.list` | tenantId | — | R | — | — | — | — | — |
| `tenant-admin.clinics.list` | tenantId | — | R | — | — | — | — | — |
| `tenant-admin.wards.list` | tenantId | — | R | — | — | — | — | — |
| `tenant-admin.devices.list` | tenantId | — | R | — | — | — | — | R |
| `tenant-admin.site-params.overview` | tenantId | — | R | — | — | — | — | — |
| `tenant-admin.modules.enablement` | tenantId | — | A | — | — | — | — | — |
| `tenant-admin.content.catalog` | tenantId | — | A | — | — | — | — | — |

**Research-required notes:**
- `facilities.list` create/update: Whether the platform supports creating new facilities or only displays VistA-sourced facility data is a research gap. VistA owns File 4 (INSTITUTION). See screen inventory §9.1 evidence posture `inferred-from-architecture`.
- `clinics.list` and `wards.list` create/update: Same VistA-ownership question — VistA owns File 44 (HOSPITAL LOCATION). Platform may only read and display.
- `devices.list` create/update: Research required — screen inventory declares this surface `read-only` with `directWriteAllowed: false`. VistA File 3.5 write posture is unresearched. Upgrading to Allowed requires resolving the VistA write path first. See screen inventory §7.7.
- `site-params.overview` create/update: Research required — same pattern. VistA File 8989.3/8989.5 write posture is unresearched. See screen inventory §7.8.

#### 7B.4 Approve / publish / activate

| Surface | Scope | PO | TA | CL | AS | RC | AN | IT |
|---------|-------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `tenant-admin.modules.enablement` | tenantId | — | A | — | — | — | — | — |
| `tenant-admin.content.catalog` | tenantId | — | A | — | — | — | — | — |

Only `modules.enablement` and `content.catalog` have meaningful approve/activate semantics (enabling a module, activating a pack). All other tenant-admin surfaces have no approval workflow — their create/update operations take effect immediately.

#### 7B.5 Export

| Surface | Scope | PO | TA | CL | AS | RC | AN | IT |
|---------|-------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `tenant-admin.users.list` | tenantId | C | A | — | — | — | — | — |
| `tenant-admin.facilities.list` | tenantId | C | A | — | — | — | — | — |
| `tenant-admin.devices.list` | tenantId | C | A | — | — | — | — | C |

Export is relevant for list surfaces. Detail surfaces export through their parent list. PO export is conditional (audit-logged cross-tenant access). IT export is conditional (limited to infrastructure data).

#### 7B.6 AI action classes

| Surface | ai-review | ai-approve-insert | Notes |
|---------|:---------:|:------------------:|-------|
| All tenant-admin surfaces | — | — | Tenant-admin surfaces manage configuration and governance data, not clinical content. AI assist is not applicable. |

#### 7B.7 Tenant-admin notes

- Workspace map §8 grants clinicians, ancillary staff, revenue-cycle staff, and analysts no access to tenant-admin surfaces. These roles consume the configurations that tenant-admin surfaces produce, but do not administer them.
- The `roles-keys` surface is the most security-sensitive tenant-admin surface. It governs who has what VistA keys and role assignments. Only tenant-admin has configure/write access. The IT research gap is noted in §10.
- `modules.enablement` and `content.catalog` have significant operational impact — enabling/disabling packs or modules changes what surfaces are visible to other roles. Tenant-admin is the sole authorized role for these operations.

---

### 7C. Clinical / terminal surfaces

**Workspace family:** `clinical`
**Scope:** Varies — `tenantId` for session management, `patientDfn` for patient-context surfaces.
**Governing reference:** Workspace map §7 row 3, §8 row "Clinician."

These are the Priority Group A terminal-native surfaces. They establish VistA terminal sessions and patient context. Platform permission grants access to the surface; VistA's own authorization layer (menu options, security keys, person class) governs what happens inside the terminal.

#### 7C.1 View / launch

| Surface | Scope | PO | TA | CL | AS | RC | AN | IT |
|---------|-------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `clinical.terminal.shell` | tenantId | — | — | A | C | — | — | C |
| `clinical.terminal.signon` | tenantId | — | — | A | C | — | — | C |
| `clinical.terminal.disconnect` | tenantId | — | — | A | C | — | — | C |
| `clinical.terminal.patient-select` | patientDfn | — | — | A | C | — | — | — |

**Clinician:** Full access per workspace map §8.

**Ancillary staff conditions:** Workspace map §8 grants ancillary staff "Limited (read-only where authorized)" clinical access. Terminal launch is permitted for ancillary staff who need to view clinical data (e.g., scheduling staff checking appointment notes, HIM staff reviewing records). Inside VistA, their menu options and security keys restrict what they can do.

**IT conditions:** IT/integration may launch terminal for system administration purposes (TaskMan, MailMan, FileMan). They do NOT select patients — their terminal use is infrastructure-focused, not clinical. VistA menu options enforce this inside the terminal.

**Other roles prohibited:** Platform operators administer through control-plane, not terminal. Tenant-admin administers through admin console. Revenue-cycle and analyst roles do not use the clinical terminal.

#### 7C.2 Configure / administer

| Surface | Scope | PO | TA | CL | AS | RC | AN | IT |
|---------|-------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `clinical.terminal.shell` | tenantId | — | — | — | — | — | — | C |
| `clinical.terminal.signon` | tenantId | — | — | — | — | — | — | — |
| `clinical.terminal.disconnect` | tenantId | — | — | — | — | — | — | — |
| `clinical.terminal.patient-select` | patientDfn | — | — | — | — | — | — | — |

Terminal surfaces are not configurable through the platform layer. Configuration of terminal behavior is a VistA-internal concern (Kernel parameters, terminal type settings). IT has conditional configure on the shell surface only for infrastructure settings (terminal type, connection parameters) — not clinical configuration.

#### 7C.3 Create / update

| Surface | Scope | PO | TA | CL | AS | RC | AN | IT |
|---------|-------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `clinical.terminal.shell` | tenantId | — | — | — | — | — | — | — |
| `clinical.terminal.signon` | tenantId | — | — | — | — | — | — | — |
| `clinical.terminal.disconnect` | tenantId | — | — | — | — | — | — | — |
| `clinical.terminal.patient-select` | patientDfn | — | — | — | — | — | — | — |

Terminal session management surfaces (shell, signon, disconnect, patient-select) are not write surfaces at the platform layer. They establish context; writes happen through clinical functional surfaces (orders, notes, etc.) which are in the deferred families (§8).

#### 7C.4 AI action classes

| Surface | ai-review | ai-approve-insert | Notes |
|---------|:---------:|:------------------:|-------|
| `clinical.terminal.shell` | — | — | Session management surface, not clinical content. |
| `clinical.terminal.signon` | — | — | Authentication surface. |
| `clinical.terminal.disconnect` | — | — | Session teardown surface. |
| `clinical.terminal.patient-select` | — | — | Context selection surface. |

AI action classes are not applicable to terminal session management surfaces. AI assist will apply to clinical functional surfaces (notes, orders, medications) — those are in deferred families (§8).

#### 7C.5 Clinical terminal notes

- **Two-layer authorization:** Platform permission (this matrix) grants access to launch the terminal. VistA authorization (menu options, keys, person class) governs what the user can do inside. A clinician with platform `allowed` who lacks the VistA `ORES` key cannot sign orders — that is VistA-internal, not a platform permission concern.
- **Patient-select scope:** `clinical.terminal.patient-select` is the only Priority A surface with `patientDfn` scope. It transitions the terminal session into a patient context. All subsequent clinical operations within that terminal session are patient-scoped.
- **Ancillary terminal use:** Ancillary staff accessing the terminal is a real workflow need (e.g., HIM reviewing charts). The `conditional` decision reflects that their access is constrained by VistA-internal authorization, not just platform permission.
- **IT terminal use:** IT staff use the terminal for VistA system administration (FileMan, TaskMan, MailMan, Kernel), not clinical care. They do not select patients. VistA menu assignments enforce this separation.

---

### 7D. IT / integration surfaces

**Workspace family:** `it-integration`
**Scope:** Varies — most are `tenantId`, some may be `platform-wide` for system-level IT.
**Governing reference:** Workspace map §7 row 7, §8 row "IT / integration engineer."

#### 7D.1 View / launch

| Surface | Scope | PO | TA | CL | AS | RC | AN | IT |
|---------|-------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `it-integration.fileman.dd-browser` | tenantId | C | — | — | — | — | — | A |
| `it-integration.fileman.file-maint` | tenantId | C | — | — | — | — | — | A |
| `it-integration.mailman.inbox` | tenantId | — | — | — | — | — | — | A |
| `it-integration.taskman.status` | tenantId | C | — | — | — | — | — | A |
| `it-integration.system.environment` | tenantId | C | — | — | — | — | — | A |
| `it-integration.interfaces.queue-monitor` | tenantId | C | — | — | — | — | — | A |
| `it-integration.audit.viewer` | tenantId | A | C | — | — | — | — | A |

**IT/integration:** Full access per workspace map §8 ("Full (per scope)").

**Platform operator conditions:** PO has view access for cross-tenant support/troubleshooting. Not the primary audience for these surfaces.

**Tenant-admin audit viewer condition:** TA has conditional view of the audit viewer for tenant-level audit review (compliance, operational auditing). TA does not access other IT surfaces.

#### 7D.2 Configure / administer

| Surface | Scope | PO | TA | CL | AS | RC | AN | IT |
|---------|-------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `it-integration.fileman.dd-browser` | tenantId | — | — | — | — | — | — | — |
| `it-integration.fileman.file-maint` | tenantId | — | — | — | — | — | — | A |
| `it-integration.mailman.inbox` | tenantId | — | — | — | — | — | — | A |
| `it-integration.taskman.status` | tenantId | — | — | — | — | — | — | C |
| `it-integration.system.environment` | tenantId | — | — | — | — | — | — | — |
| `it-integration.interfaces.queue-monitor` | tenantId | — | — | — | — | — | — | C |
| `it-integration.audit.viewer` | tenantId | — | — | — | — | — | — | — |

**Configuration notes:**
- `fileman.dd-browser` is read-only (Data Dictionary browsing). No configure action.
- `fileman.file-maint` allows IT to configure FileMan entries — this is a VistA-standard admin operation.
- `mailman.inbox` allows IT to configure message routing and distribution lists.
- `taskman.status`: Conditional — IT may configure TaskMan job scheduling but some operations require elevated VistA authorization (ZTMQ key). Research required on exact scope.
- `system.environment`: Read-only display of system information. No configure action.
- `interfaces.queue-monitor`: Conditional — IT may configure interface queue parameters within platform-governed bounds.
- `audit.viewer`: Read-only audit surface. No configure action.

#### 7D.3 Create / update

| Surface | Scope | PO | TA | CL | AS | RC | AN | IT |
|---------|-------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `it-integration.fileman.dd-browser` | tenantId | — | — | — | — | — | — | — |
| `it-integration.fileman.file-maint` | tenantId | — | — | — | — | — | — | R |
| `it-integration.mailman.inbox` | tenantId | — | — | — | — | — | — | A |
| `it-integration.taskman.status` | tenantId | — | — | — | — | — | — | R |
| `it-integration.system.environment` | tenantId | — | — | — | — | — | — | — |
| `it-integration.interfaces.queue-monitor` | tenantId | — | — | — | — | — | — | R |
| `it-integration.audit.viewer` | tenantId | — | — | — | — | — | — | — |

**Research-required notes:**
- `fileman.file-maint` create/update: Whether the platform should permit FileMan data entry through the platform layer or require terminal-native access is a design decision. VistA owns all FileMan data. The write path must go through governed VistA adapter routes if permitted at the platform level.
- `taskman.status` create/update: Whether the platform should permit creating/modifying TaskMan jobs through a platform surface or require terminal access. Safety-critical — incorrect job scheduling can destabilize VistA.
- `interfaces.queue-monitor` create/update: Whether interface queue entries can be created/modified through the platform surface. Depends on the HL7/HLO integration architecture.

#### 7D.4 Export

| Surface | Scope | PO | TA | CL | AS | RC | AN | IT |
|---------|-------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `it-integration.fileman.dd-browser` | tenantId | C | — | — | — | — | — | A |
| `it-integration.system.environment` | tenantId | C | — | — | — | — | — | A |
| `it-integration.audit.viewer` | tenantId | A | C | — | — | — | — | A |

Export is relevant for reference/documentation surfaces. PO export is conditional (cross-tenant access audit). TA export of audit data is conditional (tenant-level compliance extracts).

#### 7D.5 AI action classes

| Surface | ai-review | ai-approve-insert | Notes |
|---------|:---------:|:------------------:|-------|
| All IT/integration surfaces | — | — | Infrastructure and system administration surfaces. AI assist is not applicable to configuration/infrastructure data. |

#### 7D.6 IT/integration notes

- **VistA-native surfaces:** `fileman.dd-browser`, `fileman.file-maint`, `mailman.inbox`, `taskman.status`, and `system.environment` wrap VistA-native administration utilities. Platform permission grants access; VistA authorization (especially XUPROGMODE and DBA security keys) governs internal capabilities.
- **Audit viewer isolation:** The audit viewer is the one IT surface where tenant-admin has conditional access. This reflects the compliance requirement for tenant administrators to review audit trails within their tenant scope.
- **System-level vs tenant-level IT:** Workspace map §8 shows platform operator with "Full" IT/integration access (system-level) and IT/integration with "Full (per scope)" (tenant-scoped). In practice, most IT surfaces are tenant-scoped. System-level IT operations are performed through control-plane surfaces or direct infrastructure access, not through these surfaces.

---

## 8. Deferred workspace family matrices

These matrices cover the 33 deferred surface families from screen inventory §10. Decisions are at the family level because individual surfaces within each family are not yet inventoried.

### 8.1 Deferred clinical surface families (14 families)

**Workspace family:** `clinical`
**Scope:** `patientDfn` (all clinical functional surfaces are patient-scoped)
**Status:** Deferred pending terminal proof, clinical sub-workspace taxonomy, and VistA RPC verification.

#### 8.1.1 View

| Surface family | Scope | PO | TA | CL | AS | RC | AN | IT |
|---------------|-------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Cover sheet / patient summary | patientDfn | — | — | A | C | — | — | — |
| Problems list | patientDfn | — | — | A | C | — | — | — |
| Allergies | patientDfn | — | — | A | C | — | — | — |
| Medications / active meds | patientDfn | — | — | A | C | — | — | — |
| Orders / CPOE | patientDfn | — | — | A | C | — | — | — |
| Clinical notes / TIU | patientDfn | — | — | A | C | — | — | — |
| Vitals | patientDfn | — | — | A | C | — | — | — |
| Lab results | patientDfn | — | — | A | C | — | — | — |
| Consults | patientDfn | — | — | A | C | — | — | — |
| Reports | patientDfn | — | — | A | C | — | — | — |
| Surgery | patientDfn | — | — | A | R | — | — | — |
| Immunizations | patientDfn | — | — | A | C | — | — | — |
| Encounters / PCE | patientDfn | — | — | A | C | — | — | — |
| Clinical reminders | patientDfn | — | — | A | R | — | — | — |

**Clinician:** Full view per workspace map §8.

**Ancillary staff conditions:** "Limited (read-only where authorized)" per workspace map §8. Most clinical families are viewable by authorized ancillary staff (scheduling, HIM, intake) for operational purposes. Surgery and clinical reminders are `research-required` — whether ancillary staff should view these is context-dependent.

#### 8.1.2 Create / update

| Surface family | Scope | PO | TA | CL | AS | RC | AN | IT |
|---------------|-------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Cover sheet / patient summary | patientDfn | — | — | — | — | — | — | — |
| Problems list | patientDfn | — | — | A | — | — | — | — |
| Allergies | patientDfn | — | — | A | — | — | — | — |
| Medications / active meds | patientDfn | — | — | R | — | — | — | — |
| Orders / CPOE | patientDfn | — | — | A | — | — | — | — |
| Clinical notes / TIU | patientDfn | — | — | A | — | — | — | — |
| Vitals | patientDfn | — | — | A | C | — | — | — |
| Lab results | patientDfn | — | — | — | — | — | — | — |
| Consults | patientDfn | — | — | A | — | — | — | — |
| Reports | patientDfn | — | — | — | — | — | — | — |
| Surgery | patientDfn | — | — | R | — | — | — | — |
| Immunizations | patientDfn | — | — | A | R | — | — | — |
| Encounters / PCE | patientDfn | — | — | A | R | — | — | — |
| Clinical reminders | patientDfn | — | — | R | — | — | — | — |

**Notes:**
- Cover sheet and lab results are read-only display surfaces. Reports are read-only.
- Medications create/update is `research-required` for clinicians: medication ordering is through Orders/CPOE, but medication reconciliation and administration involve distinct workflows. The exact write model depends on the medication surface's scope (pharmacy verification, nursing administration).
- Vitals create/update: Ancillary staff (specifically nurses who may be classified as ancillary) may enter vitals. This is `conditional` — depends on VistA person class and departmental authorization.
- Surgery and clinical reminders create/update: `research-required` — complex, safety-critical workflows that need detailed VistA authorization mapping.
- Immunizations and encounters/PCE create/update for ancillary staff: `research-required` — some ancillary roles (e.g., immunization nurses) may have write access.

#### 8.1.3 Approve / publish / activate

| Surface family | Scope | PO | TA | CL | AS | RC | AN | IT |
|---------------|-------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Orders / CPOE | patientDfn | — | — | A | — | — | — | — |
| Clinical notes / TIU | patientDfn | — | — | A | — | — | — | — |
| Consults | patientDfn | — | — | A | — | — | — | — |

Only orders, notes, and consults have approve semantics (order signing, note signing/cosigning, consult completion). Clinician is the sole role. VistA electronic signature code is required — this is inside-VistA authorization that platform permission does not model.

#### 8.1.4 AI action classes (deferred clinical families)

| Surface family | ai-review | ai-approve-insert | Notes |
|---------------|:---------:|:------------------:|-------|
| Cover sheet / patient summary | D | — | AI summarization of clinical data is a candidate per ai-assist §6. Deferred pending clinical workspace design. |
| Problems list | D | D | AI-assisted problem identification. Deferred. |
| Allergies | D | D | AI-assisted allergy reconciliation. Deferred. |
| Medications / active meds | D | D | AI-assisted medication review. Deferred. Safety-critical. |
| Orders / CPOE | D | D | AI-assisted order suggestions. Deferred. Safety-critical. |
| Clinical notes / TIU | D | D | AI-assisted note drafting (scribe/draft assist class per ai-assist §6). Primary AI surface candidate. Deferred. |
| Vitals | — | — | Vitals entry is structured numeric data; AI assist is not a primary use case. |
| Lab results | D | — | AI-assisted lab result interpretation. Read-only surface, so no approve-insert. Deferred. |
| Consults | D | D | AI-assisted consult request drafting. Deferred. |
| Reports | D | — | AI-assisted report summarization. Read-only surface. Deferred. |
| Surgery | D | D | Deferred — complex, safety-critical domain. |
| Immunizations | — | — | Structured entry; AI assist not primary use case. |
| Encounters / PCE | D | D | AI-assisted encounter documentation. Deferred. |
| Clinical reminders | R | R | Research required on whether AI-assisted reminder processing is appropriate. |

**AI governance rules (per ai-assist-safety-spec.md §9/§10):**
- All `ai-approve-insert` requires `create/update` permission on the surface.
- AI-generated content requires mandatory human review before record entry.
- No direct AI-to-VistA writes. Clinician approval → platform API → VistA adapter → VistA.
- Approval is a per-record affirmative act, not a batch acceptance.

### 8.2 Deferred ancillary/operational surface families (3 families)

**Workspace family:** `ancillary-ops`
**Scope:** Varies by surface — `tenantId` or `facilityId`.

#### 8.2.1 Combined matrix

| Surface family | Scope | Action | PO | TA | CL | AS | RC | AN | IT |
|---------------|-------|--------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Scheduling / appointments | facilityId | view | — | C | C | A | — | — | — |
| Scheduling / appointments | facilityId | create/update | — | — | C | A | — | — | — |
| Patient registration / demographics | facilityId | view | — | C | C | A | — | — | — |
| Patient registration / demographics | facilityId | create/update | — | — | — | R | — | — | — |
| Health information management | facilityId | view | — | — | — | A | — | — | — |
| Health information management | facilityId | create/update | — | — | — | R | — | — | — |

**Notes:**
- Ancillary staff has full access per workspace map §8 ("Full (per scope)").
- Clinicians have conditional scheduling access (own appointments) per workspace map §8 ("Scheduling (own)").
- Tenant-admin has conditional view for operational configuration per workspace map §8.
- Patient registration create/update: `research-required` — VistA owns File 2 (PATIENT). Whether the platform permits direct writes to patient demographics or only supports read + governed update paths needs design.
- HIM create/update: `research-required` — complex regulatory domain (record requests, release of information, coding).

### 8.3 Deferred revenue-cycle surface families (4 families)

**Workspace family:** `revenue-cycle`
**Scope:** `tenantId`

#### 8.3.1 Combined matrix

| Surface family | Scope | Action | PO | TA | CL | AS | RC | AN | IT |
|---------------|-------|--------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Claims management | tenantId | view | — | C | — | — | A | — | — |
| Claims management | tenantId | create/update | — | — | — | — | A | — | — |
| Payer management | tenantId | view | — | C | — | — | A | — | — |
| Payer management | tenantId | create/update | — | — | — | — | A | — | — |
| Coding workbench | tenantId | view | — | — | — | — | A | — | — |
| Coding workbench | tenantId | create/update | — | — | — | — | A | — | — |
| EDI pipeline status | tenantId | view | — | C | — | — | A | — | C |
| EDI pipeline status | tenantId | configure | — | — | — | — | A | — | C |

**Notes:**
- Revenue-cycle staff has full access per workspace map §8 ("Full (per scope)").
- Tenant-admin has conditional view for financial config per workspace map §8.
- IT has conditional access to EDI pipeline (integration concern) per workspace map §8.
- AI action classes for revenue-cycle: Deferred. AI-assisted coding and claims review are candidates per ai-assist §6 (coding/documentation assist class) but require detailed safety analysis.

### 8.4 Deferred analytics/BI surface families (4 families)

**Workspace family:** `analytics-bi`
**Scope:** `tenantId` for tenant-level, `platform-wide` for system-level.

#### 8.4.1 Combined matrix

| Surface family | Scope | Action | PO | TA | CL | AS | RC | AN | IT |
|---------------|-------|--------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Clinical quality metrics | tenantId | view | — | — | C | — | — | A | — |
| Clinical quality metrics | tenantId | export | — | — | C | — | — | A | — |
| Operational analytics | tenantId | view | — | C | — | C | — | A | — |
| Operational analytics | tenantId | export | — | C | — | C | — | A | — |
| Financial analytics | tenantId | view | — | C | — | — | C | A | — |
| Financial analytics | tenantId | export | — | C | — | — | C | A | — |
| Executive dashboards | tenantId | view | — | A | — | — | — | A | — |
| Executive dashboards | tenantId | export | — | A | — | — | — | A | — |

**Notes:**
- Analyst has full access per workspace map §8 ("Full (per scope)").
- Workspace map §8 alignment: clinician → "Clinical quality", ancillary staff → "Operational", revenue-cycle staff → "Financial", tenant-admin → "Tenant-level".
- Platform operator has system-level analytics access (workspace map §8) but those would be separate system-level surfaces, not the tenant-scoped families listed here.
- IT has system-level analytics access per workspace map §8 but not tenant-scoped analytics.
- All analytics surfaces are read-only with export capability. No create/update or AI actions.
- PHI boundary: Analytics surfaces consume de-identified or aggregate data per specialty-content-analytics §12. They do not display PHI.

### 8.5 Deferred additional surface families (8 families)

These span multiple workspace families and are the most speculative.

| Surface family | Workspace | Scope | Primary roles | Decision | Notes |
|---------------|-----------|-------|--------------|----------|-------|
| Clinical — imaging | clinical | patientDfn | CL: D, IT: D | D | VistA Imaging (MAG package). Requires VistA Rad/Nuc Med research. |
| Clinical — telehealth | clinical | patientDfn | CL: D | D | Platform-side concern. VistA anchors minimal. |
| Clinical — e-prescribing | clinical | patientDfn | CL: D | D | Complex regulatory domain (EPCS). |
| Clinical — nursing (eMAR, assessments) | clinical | patientDfn | CL: D, AS: D | D | PSB/NURS packages. RPC availability limited. |
| Clinical — ADT | clinical | patientDfn | CL: D, AS: D | D | DGPM RPCs not registered in sandbox. |
| Ancillary — intake | ancillary-ops | facilityId | AS: D, CL: D | D | VistA anchors need verification. |
| IT — connector health | it-integration | tenantId | IT: A, PO: C | D | Platform-native monitoring. Partially addressed by existing IT surfaces. |
| IT — VistA connectivity dashboard | it-integration | tenantId | IT: A, PO: C | D | RPC broker health, capability probe. Archive has prototypes. |

All 8 families are fully deferred. Permissions will be determined when these families are promoted to concrete surface entries.

---

## 9. Cross-cutting rules

### 9.1 Break-glass access

Break-glass is an emergency access pattern where a user accesses a surface outside their normal permissions. This matrix does NOT define break-glass rules. Break-glass is a future access-control specification concern that:

- Requires explicit invocation (not silent elevation).
- Is time-limited and patient-scoped.
- Is fully audited in the immutable audit trail.
- Does not modify the permission matrix — it creates a temporary exception.

### 9.2 Delegation

Delegation (one role temporarily granting another role access to specific surfaces) is not modeled in this matrix. It is a future access-control specification concern.

### 9.3 Multi-role users

A single user may hold multiple role categories (e.g., a clinician who is also a tenant-admin). Permissions are the union of all held role categories. If a user is both CL and TA, they have the combined permissions of both columns.

### 9.4 Facility-scoped vs tenant-scoped permission refinement

Many surfaces marked `tenantId` scope may be further refined to `facilityId` scope in the access-control specification. The screen inventory's `scopePosture` field defines the surface's native scope. The access-control specification may implement narrower scoping within that ceiling.

### 9.5 VistA security key mapping

This matrix does NOT map VistA security keys to platform permissions. The mapping between:
- Platform role categories → VistA person class / provider class
- Platform role categories → VistA security keys (ORES, ORELSE, PROVIDER, etc.)
- Platform role categories → VistA menu options

...is a separate specification that must be developed when the authentication and authorization architecture is designed. This matrix establishes what the platform layer permits; VistA authorization governs what happens inside VistA-backed surfaces.

### 9.6 Audit requirements

All permission decisions (allowed, conditional, prohibited) must be auditable:
- Access grants are logged to the immutable audit trail.
- Access denials are logged to the immutable audit trail.
- Conditional access must log which condition was evaluated and whether it was satisfied.
- Cross-tenant access (PO viewing a tenant's surfaces) must be explicitly logged.

### 9.7 AI governance integration

Per ai-assist-safety-spec.md §9/§10:
- `ai-review` requires the user to have at minimum `view` permission on the surface.
- `ai-approve-insert` requires the user to have `create/update` permission on the surface AND the affirmative approval act is per-record, not batch.
- No AI action class is available on a surface where the role has `prohibited` or `—` for the base action classes.
- AI decisions deferred in this matrix (marked `D`) must be resolved before any AI assist feature is activated on that surface.

---

## 10. Open research gaps

| # | Gap | Surfaces affected | What needs resolution | Priority |
|---|-----|-------------------|----------------------|----------|
| 1 | **IT role in VistA key management** | `tenant-admin.users.roles-keys` | Whether IT/integration should have any configure or view access to VistA security key assignments. Security-sensitive. | High |
| 2 | **Facility/clinic/ward write ownership** | `tenant-admin.facilities.list`, `.clinics.list`, `.wards.list` | VistA owns File 4 (INSTITUTION) and File 44 (HOSPITAL LOCATION). Whether the platform permits creating/modifying these entities or only reads from VistA. | High |
| 3 | **FileMan write path** | `it-integration.fileman.file-maint` | Whether FileMan data entry should be permitted through a platform surface or require terminal-native access. Safety and data integrity implications. | Medium |
| 4 | **TaskMan job management** | `it-integration.taskman.status` | Whether TaskMan job creation/modification should be permitted through a platform surface. Stability implications. | Medium |
| 5 | **Interface queue writes** | `it-integration.interfaces.queue-monitor` | Whether interface queue entries can be created/modified through the platform surface. | Medium |
| 6 | **Medication write model** | Medications / active meds (deferred family) | How medication ordering (CPOE), reconciliation, and administration map to distinct permission models. Pharmacy verification vs nursing administration. | High |
| 7 | **Surgery permissions** | Surgery (deferred family) | Complex, safety-critical workflow. Which ancillary roles (if any) should view surgical data. | Medium |
| 8 | **Clinical reminders AI** | Clinical reminders (deferred family) | Whether AI-assisted reminder processing is appropriate or whether reminders should be strictly rule-based. | Low |
| 9 | **Patient registration write path** | Patient registration / demographics (deferred family) | VistA owns File 2 (PATIENT). Platform write path design for demographics updates. | High |
| 10 | **HIM workflow permissions** | Health information management (deferred family) | Complex regulatory domain. Release of information, record amendment, coding workflow authorization. | Medium |
| 11 | **Revenue-cycle AI actions** | All revenue-cycle families | AI-assisted coding and claims review safety analysis. | Low |
| 12 | **Clinical sub-workspace scope model** | All deferred clinical families | Inpatient vs outpatient vs emergency sub-workspace scoping affects whether scope is `patientDfn` or `patientDfn + encounterContext`. | Medium |
| 13 | **Ancillary staff clinical view granularity** | Deferred clinical families | Which specific clinical families ancillary staff should view (all vs a defined subset). Currently marked `conditional` as a conservative default. | Medium |

---

## 11. Handoff — next artifacts

This matrix enables and constrains the following downstream artifacts. **None are authorized by this document.**

| Next artifact | What it consumes from this matrix | Scope |
|--------------|-----------------------------------|-------|
| **Pack visibility rules** | Surface IDs, role permissions, conditional decisions | Defines which packs show/hide/modify which surfaces. Consumes this matrix to ensure pack visibility does not grant access that this matrix prohibits. |
| **Screen-contract JSON instances (small batch)** | Surface permissions → `accessRequirements.allowedRoles` values in JSON | Populates the `allowedRoles` array in screen-contract instances. Starts with Priority A + B surfaces. |
| **Access-control specification** | Full matrix → RBAC/ABAC design | Translates this planning matrix into an authorization architecture specification (enforcement mechanisms, middleware design, VistA key mapping). |
| **VistA security key mapping** | Research gaps #1, #2, #3, #5, #6, #9 | Maps platform role categories to VistA security keys, menu options, and person class requirements. |
| **AI assist feature gating** | AI action class decisions (D, R values) | Resolves deferred AI action decisions before AI features can be activated on specific surfaces. |

The recommended next bounded prompt targets (unchanged from screen inventory §13):

1. **Pack visibility rules** — consumes this matrix + pack taxonomy.
2. Then **small batch of screen-contract JSON instances** — converts Priority A + B surfaces with their now-resolved permissions.
3. Then **access-control specification** — when authorization architecture work is authorized.

---

## 12. Matrix summary

| Category | Surfaces | Decisions made | Deferred | Research-required |
|----------|----------|:---:|:---:|:---:|
| Control-plane (§7A) | 8 concrete | 280 | 0 | 0 |
| Tenant-admin (§7B) | 10 concrete | 308 | 0 | 14 |
| Clinical/terminal (§7C) | 4 concrete | 124 | 0 | 0 |
| IT/integration (§7D) | 7 concrete | 200 | 0 | 14 |
| Deferred clinical (§8.1) | 14 families | 232 | 74 | 18 |
| Deferred ancillary (§8.2) | 3 families | 30 | 0 | 6 |
| Deferred revenue-cycle (§8.3) | 4 families | 40 | 0 | 0 |
| Deferred analytics (§8.4) | 4 families | 48 | 0 | 0 |
| Deferred additional (§8.5) | 8 families | 0 | 40 | 0 |
| **Totals** | **29 concrete + 33 families** | **1262** | **114** | **52** |

Decision breakdown across all cells:
- **allowed (A):** Explicit grants where the workspace map, surface characteristics, and governing references clearly support access.
- **conditional (C):** Grants with documented conditions — cross-tenant auditing, limited scope, VistA-internal constraints.
- **prohibited (—):** Default-deny for roles not aligned to the workspace per §8 alignment table.
- **deferred (D):** Surface or action not yet detailed enough for a permission decision. Primarily AI actions on deferred clinical families.
- **research-required (R):** Specific research gap blocks the decision. Each instance traces to §10.
