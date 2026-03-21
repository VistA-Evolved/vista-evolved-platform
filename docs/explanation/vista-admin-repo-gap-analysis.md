# VistA Admin — Repo Gap Analysis Against the Domain Map and Translation Matrix

> **Status:** Canonical gap analysis
> **Date:** 2026-03-21
> **Type:** Audit / gap analysis
> **Scope:** vista-evolved-platform (primary), vista-evolved-vista-distro (read-only reference)
>
> **Parent:** [Terminal-to-UI Translation Matrix](vista-admin-terminal-to-ui-translation-matrix.md)
>
> **See also:**
> - [VistA Admin Domain Map](vista-admin-domain-map.md) — D1–D10 domain reference
> - [Slice Ranking and Mode Selection](vista-admin-slice-ranking-and-mode-selection.md) — prioritized candidates
> - [VistA Admin Corpus Discovery Pack](vista-admin-corpus-discovery-pack.md) — RPC evidence base
> - [Grounded Domain: Users, Keys, Signatures](vista-admin-grounded-domain-users-keys-signatures.md) — Slice 1/2 reference
> - [Grounded Domain: Institution, Division, Clinic](vista-admin-grounded-domain-institution-division-clinic.md) — Slice 3 reference
> - [Guided Write Workflows](vista-admin-guided-write-workflows.md) — **Historical** terminal workflow catalog (tenant-admin uses DDR + `ZVE*` direct writes now)

---

## 0. Posture update (2026-03-21)

Tenant-admin implements **direct writes** (`PUT/POST/DELETE` routes in `apps/tenant-admin/server.mjs`, OpenAPI `packages/contracts/openapi/tenant-admin.openapi.yaml`). Distro overlay supplies `ZVEUSMG` / `ZVECLNM` / `ZVEWRDM`. Sections below that still say “Mode B” or “guided write” describe the **pre-change** gap state unless explicitly refreshed.

---

## 1. Purpose

This document audits the current state of the `vista-evolved-platform` and `vista-evolved-vista-distro` repos against the VistA Admin Domain Map (D1–D10) and the Terminal-to-UI Translation Matrix (49 functions, modes A–E). It identifies what is grounded, what is fixture-only, what is missing, and groups the gaps into actionable tiers.

---

## 2. Repo Inventory Summary

### 2.1 Platform Repo — What Exists

| Component | Location | Grounding Level | Evidence |
|-----------|----------|-----------------|----------|
| Tenant-admin UI shell | `apps/tenant-admin/` | Fixture-backed with VistA adapter conditional | 6 surfaces, dual-mode badges, honest source labeling |
| Vista adapter (HTTP client) | `apps/tenant-admin/lib/vista-adapter.mjs` | Wired but never proven live | Signatures correct: ORWU NEWPERS, XUS DIVISION GET, ORWU CLINLOC, XUS GET USER INFO |
| Fixture data | `apps/tenant-admin/fixtures/` | Static seed data | 4 users, 1 institution hierarchy (3 clinics), 6 security keys |
| Screen contracts | `packages/contracts/screen-contracts/tenant-admin.*.json` | Define VistA targets, not wired to live data | 12 contracts reference Files 200, 19.1, 4, 40.8, 44, 42 |
| Config schemas | `packages/contracts/schemas/` | Structural definitions only | facility, tenant, module, capability schemas exist |
| Domain entities | `packages/domain/admin/` | Empty | `.gitkeep` only — no TypeScript/JS models |
| Control-plane app | `apps/control-plane/` | Fixture + PG backed, zero VistA | 22-surface operator dashboard for governance concerns |
| Research documentation | `docs/explanation/vista-admin-*.md` | Complete reference corpus | 8 docs: corpus discovery, domain map, matrix, slice ranking, 2 grounded domains, guided writes, source index |
| Tenant-admin documentation | `docs/explanation/tenant-admin-*.md` | Complete design references | 9 docs: architecture, truth maps, personas, design contract, handoff model |

### 2.2 Distro Repo — What Exists

| Component | Location | Admin Relevance |
|-----------|----------|-----------------|
| Custom MUMPS routines | `overlay/routines/ZVE*.m` | ZVECREUSER.m (user creation), ZVECHECK.m (system checks), ZVEINIT.m (runtime init) |
| Two Docker build lanes | `docker/local-vista/`, `docker/local-vista-utf8/` | M-mode (9433) and UTF-8 (9434) VistA instances available |
| Upstream VistA sources | `upstream/` (read-only) | Pinned WorldVistA and VEHU sources |
| Health check scripts | `scripts/verify/` | TCP probe for broker ports |

### 2.3 Archive Repo — Reference Only (Frozen)

| Component | Admin Relevance | Status |
|-----------|-----------------|--------|
| Full XWB RPC broker client | `apps/api/src/vista/rpcBrokerClient.ts` | Production-tested RPC client with cipher pads, LIST params, resilience. Frozen. |
| RPC registry (137+ RPCs) | `apps/api/src/vista/rpcRegistry.ts` | Comprehensive registry with domains and tags. Reference material. |
| Admin-relevant routes | Various `/vista/*` routes | User list, divisions, clinics, current-user. Reference for re-implementation. |
| Custom VistA routines | `services/vista/ZVE*.m` | ZVEUSER.m, ZVEFAC.m, ZVEBILR.m, etc. Reference for distro overlay. |

---

## 3. Domain-by-Domain Gap Matrix

### Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Grounded — live data path exists and is proven or correctly wired |
| ⚡ | Wired — adapter/route exists but never proven against live VistA |
| 📄 | Documented — research, screen contract, or grounded domain doc exists |
| 🔧 | Fixture — static seed data exists, no VistA path |
| ❌ | Missing — no implementation, no contract, no fixture |

### D1: Users & Access (File 200)

| Function | Matrix ID | Mode | Screen Contract | Adapter | Fixture | Grounded Doc | Backend API | Status |
|----------|-----------|------|-----------------|---------|---------|--------------|-------------|--------|
| List/search users | TM-USR-03 | A | ⚡ `tenant-admin.users.list` | ⚡ `fetchVistaUsers()` | 🔧 4 users | 📄 grounded domain | ❌ No platform API | ⚡ Wired, not proven |
| View user detail | TM-USR-03b | A | 📄 `tenant-admin.users.detail` | ❌ | 🔧 fixture lookup | 📄 grounded domain | ❌ | 🔧 Fixture only |
| Create user | TM-USR-01 | B | ❌ | ❌ | ❌ | 📄 grounded + GW-USR-01 | ❌ | 📄 Documented only |
| Edit user | TM-USR-02 | B | ❌ | ❌ | ❌ | 📄 grounded + GW-USR-02 | ❌ | 📄 Documented only |
| Deactivate user | TM-USR-04 | B | ❌ | ❌ | ❌ | 📄 grounded + GW-USR-04 | ❌ | 📄 Documented only |

### D2: Security Keys & Menus (Files 19.1, 19)

| Function | Matrix ID | Mode | Screen Contract | Adapter | Fixture | Grounded Doc | Backend API | Status |
|----------|-----------|------|-----------------|---------|---------|--------------|-------------|--------|
| List security keys | TM-KEY-01 | A | ⚡ `tenant-admin.users.roles-keys` | ❌ | 🔧 6 keys | 📄 grounded domain | ❌ | 🔧 Fixture only |
| Check user keys | TM-KEY-04 | A | 📄 (same contract) | ❌ | ❌ | 📄 grounded domain | ❌ | 📄 Documented only |
| Assign key | TM-KEY-02 | B | ❌ | ❌ | ❌ | 📄 GW-KEY-01 | ❌ | 📄 Documented only |
| Remove key | TM-KEY-03 | B | ❌ | ❌ | ❌ | 📄 GW-KEY-02 | ❌ | 📄 Documented only |
| View menu trees | TM-MENU-01 | C | ❌ | ❌ | ❌ | 📄 domain map | ❌ | 📄 Documented only |

### D3: Institutions & Divisions (Files 4, 40.8)

| Function | Matrix ID | Mode | Screen Contract | Adapter | Fixture | Grounded Doc | Backend API | Status |
|----------|-----------|------|-----------------|---------|---------|--------------|-------------|--------|
| View institution | TM-INST-01 | A | ⚡ `tenant-admin.facilities.list` | ⚡ via divisions | 🔧 1 institution | 📄 grounded domain | ❌ | ⚡ Partially wired |
| View divisions | TM-INST-02 | A | ⚡ (same contract) | ⚡ `fetchVistaDivisions()` | 🔧 1 division | 📄 grounded domain | ❌ | ⚡ Wired, not proven |
| Manage services | TM-INST-03 | B | ❌ | ❌ | ❌ | 📄 domain map | ❌ | 📄 Documented only |

### D4: Clinics & Hospital Locations (File 44)

| Function | Matrix ID | Mode | Screen Contract | Adapter | Fixture | Grounded Doc | Backend API | Status |
|----------|-----------|------|-----------------|---------|---------|--------------|-------------|--------|
| List/search clinics | TM-CLIN-01 | A | ⚡ `tenant-admin.clinics.list` | ⚡ `fetchVistaClinics()` | 🔧 3 clinics | 📄 grounded domain | ❌ | ⚡ Wired, not proven |
| View clinic detail | TM-CLIN-02 | A | ❌ | ❌ | ❌ | 📄 grounded domain | ❌ | 📄 Documented only |
| Create clinic | TM-CLIN-03 | B | ❌ | ❌ | ❌ | 📄 GW-CLIN-01 | ❌ | 📄 Documented only |
| Edit clinic | TM-CLIN-04 | B | ❌ | ❌ | ❌ | 📄 GW-CLIN-02 | ❌ | 📄 Documented only |
| Inactivate clinic | TM-CLIN-05 | B | ❌ | ❌ | ❌ | 📄 GW-CLIN-04 | ❌ | 📄 Documented only |

### D5: Wards & Room-Beds (Files 42, 405.4)

| Function | Matrix ID | Mode | Screen Contract | Adapter | Fixture | Grounded Doc | Backend API | Status |
|----------|-----------|------|-----------------|---------|---------|--------------|-------------|--------|
| List wards | TM-WARD-01 | A | 📄 `tenant-admin.wards.list` | ❌ | ❌ | 📄 grounded domain | ❌ | 📄 Contract + doc only |
| View ward detail | TM-WARD-02 | A | ❌ | ❌ | ❌ | 📄 domain map | ❌ | 📄 Documented only |
| Ward census | TM-WARD-05 | A | ❌ | ❌ | ❌ | 📄 domain map | ❌ | 📄 Documented only |

### D6: Order Entry Config

| Function | Matrix ID | Mode | Status |
|----------|-----------|------|--------|
| Quick order management | TM-ORD-01 | C | 📄 Domain map only. No tenant-admin surfaces planned. Clinical domain. |

### D7: Parameters & Site Config (Files 8989.3, 8989.5)

| Function | Matrix ID | Mode | Screen Contract | Status |
|----------|-----------|------|-----------------|--------|
| View/edit parameters | TM-PARAM-01 | B | 📄 `tenant-admin.site-params.overview` | 📄 Contract + domain map. No adapter. |

### D8: Alerts & Notifications

| Function | Matrix ID | Mode | Status |
|----------|-----------|------|--------|
| Notification config | TM-ALRT-02 | A | 📄 Domain map only. No tenant-admin surface planned. |

### D9: HL7 & Interfaces

Not targeted for tenant-admin. Terminal-only (Mode E). Integration-plane concern.

### D10: Imaging Admin

Not targeted for tenant-admin. Integration-plane concern.

---

## 4. The Backend API Gap

**This is the most significant structural gap.**

The tenant-admin app's VistA adapter (`vista-adapter.mjs`) makes HTTP calls to:

- `${VISTA_API_URL}/vista/ping`
- `${VISTA_API_URL}/vista/user-list?search=...`
- `${VISTA_API_URL}/vista/divisions`
- `${VISTA_API_URL}/vista/clinics?search=...`
- `${VISTA_API_URL}/vista/current-user`

**These endpoints do not exist in the platform repo.** They existed in the archive repo (`VistA-Evolved/apps/api/`) which is now frozen. The tenant-admin adapter is correctly wired but has no backend to connect to.

**To make any VistA read genuinely live, the platform repo needs either:**

1. A platform-side VistA API layer that wraps RPC calls (port the archive's broker client and relevant routes), or
2. A contract boundary where the distro provides RPC-wrapped HTTP endpoints and the platform consumes them, or
3. A direct RPC broker client in the platform repo

The choice between these is an architectural decision that should be captured as an ADR. The archive repo's `rpcBrokerClient.ts` is the most mature existing implementation and is available as reference material.

---

## 5. Gap Classification by Tier

### Tier 1: Safe Near-Term Grounded Slices

These can be implemented now using existing documentation, confirmed RPCs, and known file/field contracts. Require solving the backend API gap first.

| Gap | Functions | What's Needed | Depends On |
|-----|-----------|---------------|------------|
| **User/key read workspace (Slice 1)** | TM-USR-03, TM-KEY-01, TM-KEY-04, TM-INST-01, TM-INST-02 | Platform API layer with RPC broker → VistA read routes. Screen contracts already exist. | Backend API gap resolution |
| **Facility topology reads (Slice 3)** | TM-CLIN-01, TM-CLIN-02, TM-WARD-01, TM-WARD-02, TM-WARD-05 | Same API layer + clinic/ward DDR reads. | Backend API gap + Slice 1 |
| **User detail surface** | TM-USR-03b (detail view) | DUZ-based File 200 field read via DDR GETS or XUS GET USER INFO | Backend API gap + Slice 1 |

**Evidence for feasibility:** ORWU NEWPERS, XUS DIVISION GET, ORWU CLINLOC are VEHU-confirmed. DDR LISTER and DDR GETS are Vivian-confirmed. Archive has working implementations of all five.

### Tier 2: Medium-Term Guided Write / Wrapper Projects

These historically assumed Mode B or custom RPC wrappers. **Now:** many are covered by DDR + `ZVE*` in tenant-admin; re-audit each function against OpenAPI.

| Gap | Functions | What's Needed | Depends On |
|-----|-----------|---------------|------------|
| **User provisioning workflows (Slice 2)** | TM-USR-01, TM-USR-02, TM-USR-04 | Guided write UI + optional VE CUSROM RPCs or terminal fallback. Write safety: signature validation, audit trail. | Slice 1 reads proven |
| **Key assignment workflows** | TM-KEY-02, TM-KEY-03 | Prefer `ZVE USMG KEYS` when installed; else probe XUS SEND KEYS in target instance. | User detail + distro install |
| **Clinic create/edit workflows** | TM-CLIN-03, TM-CLIN-04, TM-CLIN-05 | SDES2 CREATE/EDIT/INACTIVATE CLINIC absent in VEHU. Guided terminal. | Slice 3 reads proven |
| **Institution/division management** | TM-INST-03 | Custom VE SVC wrapper RPCs needed. Archive has ZVEFAC.m patterns. | Slice 3 + distro overlay |
| **Parameter management** | TM-PARAM-01 | File 8989.3: `GET/PUT .../params/kernel` (allow-listed) + DDR FILER expansion. | Backend API + DDR FILER |

**Key constraint:** Standard Kernel RPCs for many admin writes are missing or unregistered in sandboxes; **DDR FILER** and **overlay `ZVE*`** are the supported direct-write path (not terminal-guided Mode B).

### Tier 3: Integration-Plane Projects

These belong outside tenant-admin, in the integration or interop plane. They require infrastructure that exceeds admin CRUD scope.

| Gap | Domain | Why Integration-Plane |
|-----|--------|-----------------------|
| **HL7 interface admin** | D9 | HL7 engine configuration is system-level infrastructure. Terminal-only (Mode E). No admin RPC surface. |
| **Imaging/DICOM/PACS admin** | D10 | MAG4 suite is deeply integrated with clinical imaging workflow. DICOMweb proxying, device registration, and audit already live in the archive as Phase 22-24 work. Not tenant admin concern. |
| **Lab interface admin** | Not in D1-D10 | Lab HL7 and auto-instrument interfaces are integration-plane infrastructure shared across tenants. |
| **Order entry config** | D6 | Quick order templates, dialog definitions, and order-check configuration are clinical workflow concerns owned by the CPRS clinical workspace, not tenant admin. |

### Tier 4: Deferred / Too-Early Items

| Gap | Why Deferred |
|-----|-------------|
| **Electronic signature setup (TM-USR-06)** | Mode C — terminal-only by VistA security design. ES code never exposed via RPC. Guided terminal with evidence capture is the ceiling until a formal security review approves browser-based signature entry. |
| **Menu tree management (TM-MENU-01)** | Mode C — deeply cross-referenced VistA option trees. DDR reads are possible but writes touch Options (19), Protocols (101), RPCs (8994) simultaneously. High risk, low near-term value. |
| **Alert/notification config (TM-ALRT-02)** | Mode A reads are feasible (ORQ3 LOADALL) but this is a clinical workflow concern. Lower priority than user and facility admin. |
| **Device/printer/terminal setup** | No standard RPCs. File 3.5 (DEVICE) is highly site-specific. Terminal-only. |
| **Pharmacy/Lab package admin** | Package-specific admin is deep subsystem work. Not tenant-admin scope. |

---

## 6. What Belongs Where

| Concern | Correct Placement | Rationale |
|---------|-------------------|-----------|
| User listing, detail, key inventory | **Tenant admin** | Core admin function. Every site admin needs this daily. |
| User create/edit/deactivate | **Tenant admin** (direct API) | Admin-owned; XWB → DDR / `ZVE USMG *`. |
| Key assign/remove | **Tenant admin** (direct API) | `ZVE USMG KEYS` + read-back. |
| Institution/division/clinic reads | **Tenant admin** | Facility topology is admin reference data. |
| Clinic create/edit/inactivate | **Tenant admin** (direct API) | `ZVE CLNM *` + DDR where applicable. |
| Ward/room-bed reads | **Tenant admin** | Admin reference data. |
| Site parameter management | **Tenant admin** | System configuration is admin-owned. |
| Tenant lifecycle (create/bootstrap/provision) | **Control plane** | Already correctly placed. Operator-level, not tenant-level. |
| Module enablement / SKU config | **Control plane** | Already correctly placed. Platform governance. |
| Pack/capability management | **Control plane** | Already correctly placed. Cross-tenant capability. |
| HL7 interface config | **Integration plane** | System infrastructure, not per-tenant admin. |
| Imaging/DICOM admin | **Integration plane** | Cross-cutting infrastructure with clinical dependency. |
| Order entry configuration | **Clinical workspace** | Owned by clinical ordering system. |
| Electronic signature entry | **Terminal only** (for now) | VistA security design mandates terminal. |
| Menu tree management | **Terminal only** (for now) | Too complex and risky for browser admin. |

---

## 7. Distro Repo — Admin Infrastructure Available

The distro repo provides building blocks that the platform can consume:

| Resource | Location | Platform Consumption Path |
|----------|----------|--------------------------|
| ZVECREUSER.m | `overlay/routines/` | User creation MUMPS patterns — reference for custom RPCs |
| ZVECHECK.m | `overlay/routines/` | System health checks — potential admin dashboard source |
| ZVEINIT.m | `overlay/routines/` | Runtime initialization — provisioning flow integration |
| M-mode VistA (9433) | `docker/local-vista/` | Local dev/test target for admin reads |
| UTF-8 VistA (9434) | `docker/local-vista-utf8/` | Primary planned operator lane |
| Upstream VistA-M sources | `upstream/` | Read-only reference for file/routine validation |

**Key constraint:** The distro repo does not expose HTTP/RPC API endpoints. The platform must build its own RPC broker client or VistA proxy to consume distro-lane VistA instances.

---

## 8. Summary: Honest Gap Assessment

### What is genuinely grounded today

1. **Fixture shell** — 6 working UI surfaces with honest source labeling
2. **Screen contracts** — 12 contracts defining target VistA sources and field mappings
3. **Research corpus** — 8 deep reference docs covering 2,510 RPCs, 10 domains, 49 matrix functions, historical guided-write catalog (see `vista-admin-guided-write-workflows.md`), 2 grounded domain field maps
4. **Adapter signatures** — Correct HTTP paths for 4 VistA read operations (unproven)
5. **Slice planning** — 3 slices defined with justification, sequencing, and risk assessment

### What is fixture-only

1. Users list (4 fixture records)
2. Facilities list (1 institution hierarchy)
3. Roles/keys list (6 fixture keys)
4. User detail view (fixture lookup only)
5. Dashboard (fixture count aggregation)

### What is missing completely

1. **Platform VistA API layer** — No backend routes to wrap RPC calls
2. **RPC broker client** — No TCP connection to VistA in the platform repo
3. **Domain entity models** — `packages/domain/admin/` is empty
4. **Guided write UI** — 19 workflows documented but zero wired into the shell
5. **Ward surfaces** — Screen contract exists but no adapter, no fixture, no detail view
6. **Parameter management** — Contract exists but no adapter, no fixture
7. **User-detail VistA read** — No DUZ-based File 200 lookup
8. **Key inventory VistA read** — No File 19.1 read adapter
9. **Clinic detail VistA read** — No SDES GET CLINIC INFO adapter
10. **Any live VistA proof** — Zero test evidence in the repo

### What needs an ADR before proceeding

1. **VistA connectivity architecture** — How does the platform connect to VistA? Direct RPC broker? HTTP proxy via distro? Shared library? This determines the implementation path for all read and write slices.
2. **Write audit persistence** — Immutable audit for direct writes (PG vs VistA-native) — separate from retired guided-write checklists.

---

## 9. Recommended Next Steps (Sequenced)

1. **Resolve the backend API gap** — Decide on VistA connectivity architecture (ADR). This unblocks all grounded slices.
2. **Implement Slice 1 (User/Key Read Workspace)** — Pure Mode A reads. Zero write risk. Proves the VistA connection works.
3. **Implement user detail + key check** — Extends Slice 1 with DUZ-based lookup and File 19.1 reads.
4. **Harden direct-write UI for Slice 2** — Expand allow-lists, field validation, and live proof for user/key flows (already started).
5. **Implement Slice 3 (Facility Topology Reads)** — Clinic/ward/institution reads.
6. **Harden clinic direct-write UI** — `ZVE CLNM` + DDR; live proof per OpenAPI.
7. **Evaluate SDES/SDEC availability** — Probe for modern scheduling RPCs to determine if clinic writes can go Mode A.

---

*Generated: Task 4 of queue pack "VISTA ADMIN CORPUS + TERMINAL-TO-UI TRANSLATION PROGRAM"*
*Research date: 2026-03-21*
