# Tenant Admin VistA Truth Map

> **Status:** Foundation reference.
> **Type:** Explanation — VistA grounding for tenant-admin concern areas.
> **Scope:** Maps each tenant-admin concern area to the VistA files, globals, RPCs,
> and MUMPS routines that serve as source of truth. This is the research target list
> for grounding tenant-admin surfaces in VistA reality.
> **Governed by:** AGENTS.md, tenant-admin-architecture-and-boundaries.md.

---

## 1. Purpose

Tenant-admin configuration must be grounded in VistA truth where VistA owns the data.
This document maps each tenant-admin concern area to specific VistA files, globals,
and RPCs so that implementation can target real VistA data rather than inventing
parallel structures.

**This is a research-stage document.** RPC availability must be confirmed against the
running VEHU container using `ZVEPROB.m` before any route is marked as wired.

---

## 2. Facility management

| VistA artifact | File/Global | Purpose | Notes |
|---------------|-------------|---------|-------|
| Institution file | File 4 (`^DIC(4,`) | Master list of institutions/facilities | Station numbers, names, addresses |
| Hospital Location file | File 44 (`^SC(`) | Clinics, wards, operating rooms | Location type, service, stop codes |
| Division file | File 40.8 (`^DG(40.8,`) | Facility divisions | Links to File 4 |
| Location Type | File 40.9 | Classification of hospital locations | Ward, clinic, OR, etc. |

### RPCs to research

| RPC | Expected purpose | Availability |
|-----|-----------------|--------------|
| `ORWU CLINLOC` | List hospital locations (clinics) | Likely available — OR package |
| `ORWU HOSPLOC` | List hospital locations (all) | Likely available — OR package |
| `ORWU1 NEWLOC` | Hospital location detail | Research needed |
| `SD GET CLINIC DETAILS` | Scheduling clinic details | Research needed |
| `SDES GET CLINIC RESOURCES` | SDES clinic resource data | Available in VEHU (Phase 147) |

### VistA globals for direct reads

```
^DIC(4,IEN,0)     — Institution name, station number
^SC(IEN,0)         — Hospital location name, type, service
^SC(IEN,"S",date)  — Clinic availability/slots
^DG(40.8,IEN,0)    — Division info
```

---

## 3. User management

| VistA artifact | File/Global | Purpose | Notes |
|---------------|-------------|---------|-------|
| New Person file | File 200 (`^VA(200,`) | User records — name, keys, menu options | Primary user authority |
| Security Key file | File 200.01 (subfile) | VistA security keys per user | Controls access to locked options |
| Person Class | File 8932.1 (`^USC(8932.1,`) | Provider taxonomy | Person class for ordering/signing |
| Electronic Signature | File 200 field | E-signature code (hashed) | Required for clinical signing |

### RPCs to research

| RPC | Expected purpose | Availability |
|-----|-----------------|--------------|
| `ORWU NEWPERS` | List persons (users) | Likely available — OR package |
| `ORWU2 COSIGNER` | List valid cosigners | Available — used in notes |
| `XUS SET VISITOR` | Set visiting user context | Available — auth package |
| `XUS GET USER INFO` | Get current user details | Available — auth package |
| `ORWU USERINFO` | Get user info for ordering | Likely available |
| `DG SENSITIVE RECORD ACCESS` | Check access to sensitive records | Research needed |

### VistA globals for direct reads

```
^VA(200,IEN,0)      — User name, SSN, DOB
^VA(200,IEN,1)      — Title, service/section
^VA(200,IEN,51)     — Security keys
^VA(200,IEN,52)     — CPRS tabs/menu
^VA(200,IEN,20.2)   — Signature block
```

---

## 4. Role and permission management

| VistA artifact | File/Global | Purpose | Notes |
|---------------|-------------|---------|-------|
| Security Key file | File 19.1 (`^DIC(19.1,`) | Master key definitions | ORES, ORELSE, PROVIDER, etc. |
| Option file | File 19 (`^DIC(19,`) | Menu options | Controls what users can access |
| Delegation (Mail Group) | File 3.8 (`^XMB(3.8,`) | Mail group membership | Used for notification routing |

### Key VistA security keys (reference)

| Key | Purpose |
|-----|---------|
| `ORES` | Physician (ordering provider) — can write orders |
| `ORELSE` | Nurse/non-physician — can enter orders for cosigning |
| `PROVIDER` | Provider key — general provider access |
| `XUPROGMODE` | Programmer mode — system admin |
| `XUMGR` | User manager — can edit File 200 |
| `PSJ RPHARM` | Pharmacy — can verify medication orders |

### RPCs to research

| RPC | Expected purpose | Availability |
|-----|-----------------|--------------|
| `ORWU NPHASKEY` | Check if user has a specific key | Likely available |
| `XUS KEY CHECK` | Validate security key | Research needed |

---

## 5. Module and capability enablement

Module enablement is a **platform-only concern** — VistA does not have a concept of
"modules" in the platform sense. The mapping is:

| Platform module | VistA package | VistA key/option |
|----------------|--------------|------------------|
| clinical | OE/RR, TIU, GMRA, GMRV, GMPL | ORES, ORELSE |
| scheduling | SD, SDES | SD SUPERVISOR |
| imaging | MAG, RA | MAG SYSTEM, RA VERIFY |
| pharmacy | PSJ, PSB, PSO | PSJ RPHARM, PSO PHARMACIST |
| lab | LR | LRLAB, LRVERIFY |
| rcm/billing | IB, PRCA | IB SUPERVISOR |

**Module enablement in tenant admin** controls platform-level feature gating.
VistA-level access is controlled by security keys assigned to users (§4 above).

---

## 6. Site parameters

| VistA artifact | File/Global | Purpose | Notes |
|---------------|-------------|---------|-------|
| Package Parameters | File 8989.3 | GUI-configurable parameters per package | OR, TIU, PSB parameter settings |
| Parameter Definition | File 8989.51 (`^XTV(8989.51,`) | Parameter metadata | Defines valid parameters |
| Parameter Value | File 8989.5 (`^XTV(8989.5,`) | Actual parameter values | Per-entity parameter storage |

### RPCs to research

| RPC | Expected purpose | Availability |
|-----|-----------------|--------------|
| `ORWU PARAM` | Get parameter value | Likely available |
| `ORWCH LOADALL` | Load chart view parameters | Available — used in CPRS |
| `ORWCH SAVEALL` | Save chart view parameters | Available — used in CPRS |
| `XWB GET VARIABLE VALUE` | Get M variable/global value | Available |

### Key VistA parameters (reference)

| Parameter | Scope | Purpose |
|-----------|-------|---------|
| `OR BILLING AWARENESS` | Division | Enable billing prompts |
| `OR NATURE DEFAULT` | System/Division | Default order nature |
| `OR UNSIGNED ORDERS ON EXIT` | System | Behavior for unsigned orders |
| `ORCH CONTEXT NOTES` | System | Default TIU note context |
| `PSB DEFAULT PRINTER` | Division | Default BCMA printer |

---

## 7. VistA connection management

VistA connection configuration is a **pure platform concern** — VistA itself does not
store information about how external systems connect to it.

| Platform concern | Storage | Notes |
|-----------------|---------|-------|
| VistA host and broker port | Platform PG (`vista_instance`) | Per-instance connection params |
| Facility-to-VistA binding | Platform PG (`facility_vista_binding`) | Which facility uses which VistA |
| RPC broker credentials | Platform secrets (env vars / vault) | Never stored in VistA |
| Connection health | Runtime probe | TCP + `XWB IM HERE` keep-alive |

---

## 8. Research targets

The following VistA areas require VEHU probing before tenant-admin surfaces can be
implemented. Use `ZVEPROB.m` to confirm RPC availability.

### Priority 1 (first slice — users and roles)

- `ORWU NEWPERS` — list users
- `ORWU USERINFO` — user detail
- `ORWU NPHASKEY` — key check
- `XUS GET USER INFO` — current user

### Priority 2 (facility topology)

- `ORWU CLINLOC` — clinic locations
- `ORWU HOSPLOC` — hospital locations
- `SDES GET CLINIC RESOURCES` — clinic resources (confirmed available)

### Priority 3 (site parameters)

- `ORWU PARAM` — parameter values
- `ORWCH LOADALL` — chart parameters
- `XWB GET VARIABLE VALUE` — arbitrary global reads

---

## 9. References

| Document | Relevance |
|----------|-----------|
| tenant-admin-architecture-and-boundaries.md | Architecture and boundary rules |
| Archive AGENTS.md §8 | VEHU RPC availability probe methodology |
| Archive AGENTS.md §2 | XWB protocol details |
| data/vista/vivian/rpc_index.json (archive) | 3,747 RPC reference index |
| services/vista/ZVEPROB.m (archive) | RPC probe routine |
