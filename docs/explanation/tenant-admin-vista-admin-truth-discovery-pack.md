# Tenant Admin — VistA Admin Truth Discovery Pack

> **Status:** Canonical research reference.
> **Date:** 2026-03-20.
> **Type:** Explanation — VistA truth discovery for tenant operational admin.
> **Scope:** Maps each tenant-admin object family to actual VistA files, globals,
> RPCs, routines, and menu paths with confidence classifications.
> **Governed by:** AGENTS.md, tenant-admin-architecture-and-boundaries.md.
> **Input sources:**
> - `VistA-Evolved/data/vista/admin-rpc-catalog.json` — machine-readable admin RPC catalog (archive reference)
> - `VistA-Evolved/AGENTS.md` §8 — VEHU RPC availability reference
> - `vista-evolved-vista-distro/overlay/routines/` — overlay MUMPS routines showing File 200 patterns
> - `docs/explanation/tenant-admin-vista-truth-map.md` — prior research targets
> - [VistA Admin Corpus Discovery Pack](vista-admin-corpus-discovery-pack.md) — externally-sourced master reference (14 domains, 2,510 RPCs)
> - [VistA Admin Domain Map](vista-admin-domain-map.md) — domain→package→file→global quick reference

---

## 1. Purpose

Before building grounded tenant-admin surfaces, we must know what VistA actually
owns, what RPCs are actually available, and where the safe read/write boundaries are.

This document records **verified truth** from three sources:
1. VistA documentation and file structure (FileMan data dictionaries)
2. Archive repo probing artifacts (`admin-rpc-catalog.json`, `ZVEPROB.m` results)
3. Distro overlay routines demonstrating actual VistA writes

Each item is classified:
- **confirmed** — verified against running VistA or catalog with IEN evidence
- **probable** — consistent with VistA documentation and architecture but requires live verification
- **unknown** — requires further probing before any implementation

---

## 2. Users — NEW PERSON (File 200)

### Business meaning
VistA user identity: every person who logs in, signs orders, or accesses the system.
This is the single authority for user names, credentials, security keys, provider class,
electronic signature, division assignments, and menu access.

### VistA owner
Kernel (XU) package. File 200 is the NEW PERSON file stored in `^VA(200,)`.

### VistA files

| File | Global | Purpose |
|------|--------|---------|
| 200 (NEW PERSON) | `^VA(200,IEN,node)` | Master user record |
| 200.01 (subfile) | `^VA(200,IEN,51,)` | Security key assignments |
| 200.04 (subfile) | `^VA(200,IEN,52,)` | CPRS tab/option settings |
| 200.05 (subfile) | `^VA(200,IEN,201)` | Primary menu option IEN |
| 8932.1 (PERSON CLASS) | `^USC(8932.1,)` | Provider taxonomy (physician, nurse, pharmacist) |

### Key global nodes

| Node | Content |
|------|---------|
| `^VA(200,IEN,0)` | Name ^ Initials ^ SSN ^ DOB ^ Access code (hashed) ^ Verify code (hashed) |
| `^VA(200,IEN,1)` | Title ^ Service/Section ^ keys/flags |
| `^VA(200,IEN,20.2)` | Signature block (name as it appears on signed docs) |
| `^VA(200,IEN,20.4)` | Electronic signature code (hashed via XUSHSH) |
| `^VA(200,IEN,51,sub)` | Security key subfile entries |
| `^VA(200,IEN,201)` | Primary menu option IEN (links to File 19) |

### Confirmed available RPCs

| RPC | IEN | Purpose | Source |
|-----|-----|---------|--------|
| `XUS GET USER INFO` | 595 | Get authenticated user metadata | admin-rpc-catalog |
| `XUS AV CODE` | 12 | Authenticate access/verify codes | admin-rpc-catalog |
| `ORWU NEWPERS` | 213 | List persons matching search text | admin-rpc-catalog |
| `ORWU USERINFO` | 185 | Get detailed user info for ordering | admin-rpc-catalog |
| `ORWU HASKEY` | 306 | Check if user has a specific security key | admin-rpc-catalog |
| `ORWU VALIDSIG` | 195 | Validate electronic signature | admin-rpc-catalog |
| `ORWU EXTNAME` | 287 | Get external (display) name for IEN | admin-rpc-catalog |
| `ORWU PARAM` | 691 | Get/set parameter values | admin-rpc-catalog |
| `XUS DIVISION GET` | 596 | Get divisions available to user | admin-rpc-catalog |
| `XUS DIVISION SET` | 594 | Set active division context | admin-rpc-catalog |

### Safe first web slice (read-only)

**Path A — Live VistA reads via available RPCs:**
- `ORWU NEWPERS` returns user list (name, IEN) from File 200
- `ORWU USERINFO` returns detailed user info (DUZ, provider class, keys)
- `ORWU HASKEY` checks individual key assignments
- `XUS GET USER INFO` returns current authenticated user

**Confidence:** confirmed — these RPCs have IENs verified in admin-rpc-catalog.json

### What must remain guided-terminal-only for now

- User creation (requires `UPDATE^DIE` into File 200 — see `ZVECREUSER.m` pattern)
- Access/verify code assignment (security-sensitive hash via `XUSHSH`)
- Electronic signature setup (field 20.4 — security-sensitive)
- Primary menu assignment (field 201)
- User deactivation/reactivation (field-level toggle in File 200)

**Confidence:** confirmed — `ZVECREUSER.m` in distro overlay demonstrates the exact pattern

### Evidence: ZVECREUSER.m pattern (distro overlay)

The distro overlay routine `ZVECREUSER.m` demonstrates user creation via:
1. `UPDATE^DIE` for filing into File 200
2. Access/verify codes pre-hashed with `XUSHSH` (not stored as plaintext)
3. Electronic signature set at field 20.4
4. Primary menu assigned at field 201
5. Security key confirmed via `^XUSEC` global

This is the canonical write pattern — no web-direct writes should bypass `UPDATE^DIE`.

---

## 3. Security Keys — File 19.1

### Business meaning
VistA access control primitives. Keys gate what menu options a user can access,
what clinical actions they can perform (ordering, signing, dispensing), and what
administrative functions are available.

### VistA owner
Kernel (XU) package. File 19.1 is the SECURITY KEY file stored in `^DIC(19.1,)`.

### VistA files

| File | Global | Purpose |
|------|--------|---------|
| 19.1 (SECURITY KEY) | `^DIC(19.1,IEN,0)` | Master key definitions |
| 200.01 (subfile) | `^VA(200,userIEN,51,sub)` | Keys allocated to specific user |
| 19 (OPTION) | `^DIC(19,IEN,0)` | Menu options locked by keys |

### Key lookup global
`^XUSEC(KEY_NAME,USER_IEN)` — fast index for "does user X hold key Y?"

### Reference keys

| Key | IEN | Purpose | Allocator safety |
|-----|-----|---------|------------------|
| PROVIDER | varies | General provider access | Low risk — read access |
| ORES | varies | Ordering provider — can write and sign orders | Clinical impact |
| ORELSE | varies | Can enter orders for cosigning (nurse/non-physician) | Clinical impact |
| PSJ RPHARM | varies | Pharmacy — can verify medication orders | Clinical impact |
| XUMGR | varies | User manager — can edit File 200 records | Admin privilege |
| XUPROGMODE | varies | Programmer mode — full system access | Highest privilege |

### Confirmed available RPCs

| RPC | IEN | Purpose |
|-----|-----|---------|
| `ORWU HASKEY` | 306 | Check if user holds a specific key by name |

### Safe first web slice (read-only)

**Path A — Use `ORWU HASKEY` iteratively:**
- For a list of known key names, call `ORWU HASKEY` per user per key
- Build a key-assignment matrix in the UI

**Path B — Use `XWB GET VARIABLE VALUE` for direct global reads:**
- Read `^DIC(19.1,"B")` for full key name index
- Read `^XUSEC(KEY_NAME)` for allocated users per key

**Confidence:** probable — `ORWU HASKEY` is confirmed; `XWB GET VARIABLE VALUE` (IEN 9)
is confirmed available but direct global reads need careful scoping

### What must remain guided-terminal-only for now

- Key allocation (write to File 200.01 subfile + `^XUSEC` index)
- Key creation (new entries in File 19.1 — extremely rare, admin-only)
- Key delegation policy changes

---

## 4. Institution — File 4

### Business meaning
Legal identity of the healthcare organization. Station number, official name,
address, NPI if applicable. The institution record anchors the entire facility
hierarchy.

### VistA owner
Kernel (XU) / Registration (DG) packages. File 4 stored in `^DIC(4,)`.

### VistA files

| File | Global | Purpose |
|------|--------|---------|
| 4 (INSTITUTION) | `^DIC(4,IEN,0)` | Institution name, station number |
| 389.9 (STATION NUMBER) | file pointer | Station number cross-ref |

### Key global nodes

| Node | Content |
|------|---------|
| `^DIC(4,IEN,0)` | Institution name ^ station number ^ ... |
| `^DIC(4,"B",name)` | B-index for name lookup |
| `^DIC(4,"D",station#)` | D-index for station number lookup |

### Confirmed available RPCs

| RPC | IEN | Purpose |
|-----|-----|---------|
| `ORWU GENERIC` | 330 | Generic FileMan lookup — works for File 4 |

### Safe first web slice (read-only)

**Path A — Use `ORWU GENERIC` for File 4 lookup.**
**Path B — Use `XWB GET VARIABLE VALUE` to read `^DIC(4,)` globals directly.**

**Confidence:** probable — `ORWU GENERIC` is confirmed; File 4 structure is well-documented.
Live verification needed to confirm what fields are returned.

### What must remain guided-terminal-only for now

- Institution creation/edit — rarely done, high-impact, multi-field FileMan operation
- Station number assignment — system-level configuration

---

## 5. Medical Center Division — File 40.8

### Business meaning
An organizational subdivision of an institution. Divisions are the operational
boundary for many VistA functions (pharmacy, billing, scheduling). A user is
often assigned to one or more divisions.

### VistA owner
Registration (DG) package. File 40.8 stored in `^DG(40.8,)`.

### VistA files

| File | Global | Purpose |
|------|--------|---------|
| 40.8 (MEDICAL CENTER DIVISION) | `^DG(40.8,IEN,0)` | Division records |
| 40.9 (LOCATION TYPE) | `^DIC(40.9,)` | Location type classification |

### Key global nodes

| Node | Content |
|------|---------|
| `^DG(40.8,IEN,0)` | Division name ^ pointer to File 4 ^ ... |
| `^DG(40.8,"B",name)` | B-index for name lookup |

### Confirmed available RPCs

| RPC | IEN | Purpose |
|-----|-----|---------|
| `XUS DIVISION GET` | 596 | Get divisions available to current user |
| `XUS DIVISION SET` | 594 | Set active division for current session |

### Safe first web slice (read-only)

**Path A — Use `XUS DIVISION GET` for division list.**
Returns divisions available to the authenticated user — may not include ALL divisions.

**Path B — Use `XWB GET VARIABLE VALUE` for direct `^DG(40.8,)` reads.**
More complete but requires careful global traversal.

**Confidence:** confirmed for `XUS DIVISION GET`; probable for comprehensive list.

### What must remain guided-terminal-only for now

- Division creation/edit — requires FileMan operations, links to File 4
- Division assignment to users

---

## 6. Hospital Location — File 44

### Business meaning
Clinics, wards, operating rooms, and other patient-care locations. This is where
appointments happen, patients are admitted, and clinical encounters occur.

### VistA owner
Scheduling (SD) / Registration (DG) packages. File 44 stored in `^SC(IEN,)`.

### VistA files

| File | Global | Purpose |
|------|--------|---------|
| 44 (HOSPITAL LOCATION) | `^SC(IEN,0)` | Location name, type, service, stop codes |
| 44.1 | associated | Clinic availability patterns |
| 44.2 | associated | Clinic stop codes |
| 409.832 | associated | Clinic groups |

### Key global nodes

| Node | Content |
|------|---------|
| `^SC(IEN,0)` | Location name ^ abbreviation ^ type ^ ... |
| `^SC(IEN,"S",date)` | Availability slots for given date |
| `^SC(IEN,"SL")` | Clinic default slot length |
| `^SC("B",name)` | B-index for name lookup |

### Confirmed available RPCs

| RPC | IEN | Purpose |
|-----|-----|---------|
| `ORWU CLINLOC` | 254 | List clinic locations matching search |
| `SDES GET APPT TYPES` | 4399 | List appointment types |
| `SDES GET APPT BY APPT IEN` | 4323 | Get appointment by IEN |
| `SDEC APPADD` | 3676 | Add appointment |
| `SDEC CLINLET` | 3657 | Clinic letter |

### Safe first web slice (read-only)

**Path A — Use `ORWU CLINLOC` for clinic list.**
Returns clinic locations matching a search string.

**Path B — Use `XWB GET VARIABLE VALUE` for direct `^SC(IEN,)` reads.**
Richer data but needs structured extraction.

**Confidence:** confirmed — `ORWU CLINLOC` has IEN 254 in catalog.

### What must remain guided-terminal-only for now

- Clinic creation (multi-field File 44 record)
- Availability pattern setup (complex recurring template)
- Stop code assignment
- Clinic group management

---

## 7. Ward Location — File 42 & Room-Bed — File 405.4

### Business meaning
Inpatient bed management: wards, rooms within wards, and individual bed
assignments within rooms.

### VistA owner
Registration (DG) package. File 42 in `^DG(42,)`, File 405.4 in `^DG(405.4,)`.

### VistA files

| File | Global | Purpose |
|------|--------|---------|
| 42 (WARD LOCATION) | `^DG(42,IEN,0)` | Ward records (name, service, beds) |
| 42.4 (SPECIALTY) | `^DIC(42.4,)` | Treating specialty classification |
| 405.4 (ROOM-BED) | `^DG(405.4,IEN,0)` | Individual room-bed entries |

### Confirmed available RPCs

| RPC | IEN | Purpose |
|-----|-----|---------|
| `ORWPT BYWARD` | 620 | Patients by ward |
| `ORWPT ADMITLST` | 198 | Admitted patient list |

### Safe first web slice (read-only)

**Path B only — Use `XWB GET VARIABLE VALUE` for direct global reads.**
The available RPCs return patient lists by ward, not ward configuration.
For admin-level ward/bed topology, direct global reads are the likely path.

**Confidence:** probable — RPCs are patient-oriented, not admin-oriented.
Ward configuration reads need live probing.

### What must remain guided-terminal-only for now

- Ward creation/edit
- Room-bed setup
- Bed census configuration
- Treating specialty assignment

---

## 8. Kernel System Parameters — File 8989.3

### Business meaning
Site-wide and package-level configuration parameters that control VistA behavior:
CPRS defaults, pharmacy settings, scheduling rules, security policies.

### VistA owner
Kernel (XU) package. Parameters stored across Files 8989.3, 8989.5, 8989.51.

### VistA files

| File | Global | Purpose |
|------|--------|---------|
| 8989.3 (PACKAGE PARAMETERS) | `^XTV(8989.3,)` | Package-level parameter stores |
| 8989.51 (PARAMETER DEFINITION) | `^XTV(8989.51,)` | Parameter metadata/definitions |
| 8989.5 (PARAMETER) | `^XTV(8989.5,)` | Parameter values per entity scope |

### Key global nodes

| Node | Content |
|------|---------|
| `^XTV(8989.3,1,"XUS")` | Kernel XUS authentication parameters |
| `^XTV(8989.51,IEN,0)` | Parameter definition name, type, allowed values |
| `^XTV(8989.5,paramIEN,entityScope)` | Parameter value for scope (system/division/user) |

### Confirmed available RPCs

| RPC | IEN | Purpose |
|-----|-----|---------|
| `ORWU PARAM` | 691 | Get/set parameter values |
| `XWB GET VARIABLE VALUE` | 9 | Read arbitrary M variable/global value |
| `ORWCH LOADALL` | varies | Load chart view parameters |
| `ORWCH SAVEALL` | varies | Save chart view parameters |

### Reference parameters (subset)

| Parameter | Scope | Purpose |
|-----------|-------|---------|
| `OR BILLING AWARENESS` | Division | Enable billing prompts |
| `OR NATURE DEFAULT` | System/Division | Default order nature |
| `OR UNSIGNED ORDERS ON EXIT` | System | Unsigned orders behavior |
| `ORCH CONTEXT NOTES` | System | Default TIU note context |
| `PSB DEFAULT PRINTER` | Division | Default BCMA printer |

### Safe first web slice (read-only)

**Path A — Use `ORWU PARAM` for individual parameter reads.**
Requires knowing parameter names in advance.

**Confidence:** probable — `ORWU PARAM` confirmed; comprehensive parameter enumeration
may require `XWB GET VARIABLE VALUE` with `^XTV(8989.51,)` traversal.

### What must remain guided-terminal-only for now

- Parameter value changes (some are safety-critical)
- Parameter definition creation
- Scope management (system vs division vs user)

---

## 9. Summary: read path confidence

| Object family | File | Read RPCs available | Read confidence | Write path |
|--------------|------|--------------------:|:----|:------|
| Users | 200 | ORWU NEWPERS, ORWU USERINFO, XUS GET USER INFO, ORWU HASKEY | **confirmed** | Guided terminal (UPDATE^DIE) |
| Security keys | 19.1, 200.01 | ORWU HASKEY, XWB GET VARIABLE VALUE | **probable** | Guided terminal |
| Institution | 4 | ORWU GENERIC, XWB GET VARIABLE VALUE | **probable** | Guided terminal |
| Division | 40.8 | XUS DIVISION GET | **confirmed** | Guided terminal |
| Hospital Location | 44 | ORWU CLINLOC | **confirmed** | Guided terminal |
| Ward / Room-Bed | 42, 405.4 | ORWPT BYWARD (patient-oriented) | **probable** | Guided terminal |
| Site Parameters | 8989.3 | ORWU PARAM, XWB GET VARIABLE VALUE | **probable** | Guided terminal |

---

## 10. RPC probing methodology

Before wiring any RPC into a tenant-admin route:

1. Confirm RPC exists in File 8994 using `ZVEPROB.m`:
   ```powershell
   docker cp services\vista\ZVEPROB.m vehu:/tmp/ZVEPROB.m
   docker exec vehu bash -c "cp /tmp/ZVEPROB.m /home/vehu/r/ZVEPROB.m && chown vehu:vehu /home/vehu/r/ZVEPROB.m"
   docker exec vehu su - vehu -c "mumps -r PROBE^ZVEPROB"
   ```
2. If IEN returned — RPC exists, wire it
3. If "NOT IN FILE 8994" — RPC is genuinely missing
4. Test actual call with real parameters against VEHU
5. Verify return format matches expected structure

### XWB GET VARIABLE VALUE usage for admin reads

`XWB GET VARIABLE VALUE` (IEN 9) can read arbitrary M global references.
For admin reads, this enables:
- `$$GET^XPAR` style parameter retrieval
- `^VA(200,` user record reads
- `^DIC(4,` institution reads
- `^SC(` hospital location reads
- `^DG(40.8,` division reads

**Safety:** Read-only. Does not modify globals. But must not be used to read
security-sensitive fields (hashed passwords, SSN, DOB) for display in web UI.

---

## 11. Recommended grounding order

| Priority | Slice | Read path | Confidence |
|----------|-------|-----------|------------|
| P1 | Users + Security Keys (§2, §3) | ORWU NEWPERS + ORWU HASKEY | confirmed |
| P2 | Facility topology (§4, §5, §6) | XUS DIVISION GET + ORWU CLINLOC + ORWU GENERIC | confirmed/probable |
| P3 | Wards + Room-Beds (§7) | XWB GET VARIABLE VALUE globals | probable |
| P4 | Site Parameters (§8) | ORWU PARAM | probable |

---
