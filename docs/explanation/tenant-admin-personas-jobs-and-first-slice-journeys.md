# Tenant Admin Personas, Jobs, and First-Slice Journeys

> **Status:** Foundation specification.
> **Type:** Explanation — persona model and first-slice journey definitions.
> **Scope:** Defines who uses the tenant-admin workspace, what jobs they perform,
> and the step-by-step journeys for the first implementation slice.
> **Governed by:** AGENTS.md, tenant-admin-architecture-and-boundaries.md,
> operator-console-personas-jobs-and-service-map.md (operator-side reference).

---

## 1. Purpose

This document defines the persona model for the tenant-admin workspace and the
concrete user journeys that drive the first implementation slice. It mirrors the
operator-console personas doc but is scoped to tenant-admin audiences.

---

## 2. Persona model

### 2.1 Primary personas

| ID | Persona | Role | Context | Frequency |
|----|---------|------|---------|-----------|
| **TA-1** | Tenant administrator | Facility IT lead or practice manager | Manages all operational config for their tenant | Daily |
| **TA-2** | Delegated user manager | HR or credentialing coordinator | Manages user accounts and role assignments | Weekly |
| **TA-3** | Delegated IT integrator | IT staff responsible for VistA connections | Manages VistA instance bindings and connection health | Ad-hoc |

### 2.2 Secondary personas (future)

| ID | Persona | Role | Context |
|----|---------|------|---------|
| **TA-4** | Content administrator | Manages specialty content and pack activation | Content lifecycle within tenant |
| **TA-5** | Compliance officer | Reviews audit trails and configuration changes | Compliance and governance |
| **TA-6** | Department manager | Manages department-specific parameters | Clinic/ward operational settings |

### 2.3 Non-personas (who does NOT use tenant admin)

| Who | Why not |
|-----|---------|
| Platform operator | Uses control plane, not tenant admin |
| Clinician | Uses clinical workspace for patient care |
| Patient | Uses patient portal |
| Billing analyst | Uses revenue cycle workspace |

---

## 3. Job catalog

| ID | Job | Persona | Steps | VistA involvement |
|----|-----|---------|-------|-------------------|
| **TA-J1** | Add a user to the tenant | TA-1, TA-2 | Search VistA for existing person, create/link account, assign roles, assign facility access | Read File 200, write platform PG |
| **TA-J2** | Assign roles to a user | TA-1, TA-2 | Select user, view current roles, add/remove roles, confirm change | Read/write platform PG, map to VistA keys |
| **TA-J3** | Register a new facility | TA-1 | Enter facility details, link to VistA institution (File 4), configure division | Read File 4, write platform PG |
| **TA-J4** | Configure facility location hierarchy | TA-1 | Select facility, add clinics/wards/rooms from VistA (File 44), set parent-child relationships | Read File 44, write platform PG |
| **TA-J5** | Bind VistA instance to facility | TA-1, TA-3 | Enter VistA host/port, test connection (TCP probe + login), save binding | Platform PG only |
| **TA-J6** | Enable/disable a module | TA-1 | View entitled modules, toggle module state, see dependency warnings | Platform PG only |
| **TA-J7** | Manage feature flags | TA-1 | View feature flags for tenant, toggle flag, set value | Platform PG only |
| **TA-J8** | Set site parameters | TA-1 | Select facility, select parameter category, modify values | Read/write VistA parameters |
| **TA-J9** | Review configuration audit trail | TA-1, TA-5 | Query audit log by date/actor/entity, review change details | Platform PG audit tables |
| **TA-J10** | View tenant dashboard | TA-1 | See tenant health, active modules, user count, facility count, recent changes | Platform PG reads |

---

## 4. First-slice journeys (Task 4 targets)

The first implementation slice targets the highest-priority, most self-contained jobs
that establish the tenant-admin workspace as a real operational tool.

### 4.1 Journey: View tenant users (TA-J1 read path)

**Persona:** TA-1 (Tenant administrator)
**Precondition:** Tenant exists, user has tenant-admin role, session is tenant-scoped.

| Step | User action | System response |
|------|------------|-----------------|
| 1 | Navigate to Users section | Display user list (name, role, status, last login) |
| 2 | — | Data sourced from platform PG (`tenant_user`, `user_role_assignment`) |
| 3 | Click a user row | Show user detail: identity, roles, facility access, VistA keys |
| 4 | — | If VistA connection available: show DUZ, person class, security keys from File 200 |
| 5 | — | If VistA unavailable: show `integration-pending` for VistA fields |

### 4.2 Journey: Assign a role to a user (TA-J2)

**Persona:** TA-1 (Tenant administrator)
**Precondition:** User exists in tenant, user has user-management permission.

| Step | User action | System response |
|------|------------|-----------------|
| 1 | Open user detail | Show current roles with descriptions |
| 2 | Click "Add Role" | Show available roles (from platform role definitions) |
| 3 | Select role, confirm | Platform PG: insert `user_role_assignment` |
| 4 | — | Audit log: record role assignment with actor, timestamp, before/after |
| 5 | — | Future: trigger VistA key assignment if role maps to VistA key |

### 4.3 Journey: View facility topology (TA-J3/J4 read path)

**Persona:** TA-1 (Tenant administrator)
**Precondition:** Tenant exists, facilities have been registered.

| Step | User action | System response |
|------|------------|-----------------|
| 1 | Navigate to Facilities section | Display facility tree (institution → division → locations) |
| 2 | — | Data: platform PG for structure, VistA File 4 + 44 for grounding |
| 3 | Expand a facility | Show child locations (clinics, wards, rooms) with VistA IEN references |
| 4 | Click a location | Show detail: name, type, service, stop codes, VistA grounding status |
| 5 | — | If VistA unavailable: structure from PG with `integration-pending` for VistA fields |

---

## 5. First-slice surface inventory

Based on the journeys above, the first slice requires these surfaces:

| Surface | Jobs served | Data source | Priority |
|---------|-------------|-------------|----------|
| **Tenant Dashboard** | TA-J10 | Platform PG | P0 |
| **User List** | TA-J1 (read) | Platform PG + VistA File 200 | P0 |
| **User Detail** | TA-J1 (read), TA-J2 | Platform PG + VistA File 200 | P0 |
| **Role Assignment** | TA-J2 | Platform PG | P0 |
| **Facility List** | TA-J3 (read) | Platform PG + VistA File 4 | P0 |
| **Facility Detail** | TA-J4 (read) | Platform PG + VistA File 4, 44 | P1 |

---

## 6. References

| Document | Relevance |
|----------|-----------|
| tenant-admin-architecture-and-boundaries.md | Architecture rules |
| tenant-admin-vista-truth-map.md | VistA file/RPC grounding |
| operator-console-personas-jobs-and-service-map.md | Operator-side persona model (reference) |
| information-architecture-workspace-map.md §12 | Tenant-admin workspace definition |
| organization-facility-network-service-model.md | Entity model for facilities, users, roles |
