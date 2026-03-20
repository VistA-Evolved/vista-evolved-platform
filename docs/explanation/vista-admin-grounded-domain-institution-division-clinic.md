# Grounded Domain Reference — Institution, Division & Clinic Topology

> **Status:** Canonical grounded domain reference.
> **Date:** 2026-03-21.
> **Type:** Reference.
> **Scope:** VistA Files 4, 40.8, 44, 42, and supporting files. Covers globals, indexes,
> field decompositions, RPC inventory (confirmed/Vivian/custom), MUMPS routines,
> existing implementations, screen contracts, and known gaps.
> **Evidence provenance:** Every claim maps to a repo, file, and (where applicable) line number.
> Cross-repo paths use repo-prefixed format for multi-root workspace disambiguation.

---

## Table of contents

1. [VistA file landscape](#1-vista-file-landscape)
2. [RPC inventory](#2-rpc-inventory)
3. [Existing implementation evidence](#3-existing-implementation-evidence)
4. [MUMPS routines and write patterns](#4-mumps-routines-and-write-patterns)
5. [Gaps and probe requirements](#5-gaps-and-probe-requirements)
6. [Source provenance index](#6-source-provenance-index)

---

## 1. VistA file landscape

### 1.1 Institution — File 4

**Global root:** `^DIC(4,IEN,...)`

| Node | Piece | Field | Type | Notes |
|------|-------|-------|------|-------|
| `^DIC(4,IEN,0)` | 1 | INSTITUTION NAME | Free text | Primary name |
| `^DIC(4,IEN,0)` | 2 | STATION NUMBER | Free text | VA station number (3-digit + suffix) |
| `^DIC(4,IEN,0)` | 11 | FACILITY TYPE | Set of codes | |
| `^DIC(4,IEN,0)` | 99 | NPI / additional identifiers | Free text | Referenced during sign-on (`DUZ(2)`) |
| `^DIC(4,IEN,99)` | — | Extended identifiers | — | NPI, additional identifiers |

**Indexes:**

| Global path | Purpose |
|-------------|---------|
| `^DIC(4,"B",name,IEN)` | B-index — name → IEN |
| `^DIC(4,"D",stationNumber,IEN)` | D-index — station number → IEN |

**Hierarchy role:** Top of the three-level hierarchy. One institution may have multiple divisions.

**Write posture:** Guided-terminal-only. Institution creation is extremely high-impact and rarely done. Station number assignment is system-level. No safe RPC-based write path exists.

**Provenance:** `vista-evolved-platform/docs/explanation/tenant-admin-vista-facility-division-clinic-map.md` §2. Global node structure confirmed by `VistA-Evolved/services/vista/ZVEFAC.m` INSTLIST entry point.

---

### 1.2 Medical Center Division — File 40.8

**Global root:** `^DG(40.8,IEN,...)`

| Node | Piece | Field | Type | Notes |
|------|-------|-------|------|-------|
| `^DG(40.8,IEN,0)` | 1 | DIVISION NAME | Free text | Display name |
| `^DG(40.8,IEN,0)` | 2 | INSTITUTION POINTER | Pointer → File 4 | Links division to parent institution |
| `^DG(40.8,IEN,0)` | 7 | FACILITY NUMBER | Free text | May differ from station number |

**Indexes:**

| Global path | Purpose |
|-------------|---------|
| `^DG(40.8,"B",name,IEN)` | B-index — name → IEN |

**Key relationships:**

| From | Field | To | Purpose |
|------|-------|----|----|
| File 40.8 node 0 | piece 2 | File 4 (INSTITUTION) | Division → institution link |
| File 200 (NEW PERSON) | division subfield | File 40.8 | User → division assignment(s) |
| File 44 node 0 | division pointer piece | File 40.8 | Hospital location → parent division |

**Write posture:** Guided-terminal-only. Division creation requires FileMan operations with File 4 linkage. Division assignment to users writes to File 200 subfields. Division deactivation has cascading impact on clinics and scheduling.

**Provenance:** `vista-evolved-platform/docs/explanation/tenant-admin-vista-facility-division-clinic-map.md` §3. DIVLIST entry point in `VistA-Evolved/services/vista/ZVEFAC.m` (walks `^DG(40.8,"B")`, reads piece 7 for institution pointer).

---

### 1.3 Hospital Location — File 44

**Global root:** `^SC(IEN,...)`

| Node | Piece | Field | Type | Notes |
|------|-------|-------|------|-------|
| `^SC(IEN,0)` | 1 | LOCATION NAME | Free text | Clinic / ward / OR name |
| `^SC(IEN,0)` | 2 | ABBREVIATION | Free text | Short name |
| `^SC(IEN,0)` | 3 | TYPE | Set of codes | C=Clinic, W=Ward, OR=Operating Room, M=Module, Z=Other |
| `^SC(IEN,0)` | 4 | DIVISION POINTER | Pointer → File 40.8 | Links location to parent division |
| `^SC(IEN,0)` | 7 | STOP CODE | Pointer → File 40.7 | Primary clinic stop code |
| `^SC(IEN,"SL")` | — | DEFAULT SLOT LENGTH | Numeric | Appointment slot length in minutes |
| `^SC(IEN,"S",date)` | — | Slot availability | Subfile | Slot availability for specific date |

**Subfiles:**

| Subfile | Global | Content |
|---------|--------|---------|
| File 44.003 | `^SC(clinicIEN,"S",date,1,subIEN,0)` | Appointment slots: `DFN^length^^^reason` |
| File 44.005 | `^SC(IEN,"ST",...)` | Stop code overrides |

**Indexes:**

| Global path | Purpose |
|-------------|---------|
| `^SC("B",name,IEN)` | B-index — name → IEN |
| `^SC("AC",type,IEN)` | AC-index — location type → IEN cross-reference |

**Location type values:**

| Code | Meaning |
|------|---------|
| C | Clinic |
| W | Ward |
| OR | Operating Room |
| M | Module |
| Z | Other |

**Write posture:** Mixed. Clinic creation is complex multi-field setup (stop codes, availability templates, scheduling patterns). SDES2 CREATE CLINIC exists in Vivian but is **not present in VEHU** — requires SDES package installation. ZVESDSEED.m demonstrates direct `^SC` global writes for dev/demo seeding only.

**Provenance:** `vista-evolved-platform/docs/explanation/tenant-admin-vista-facility-division-clinic-map.md` §4. Zero-node format confirmed by `VistA-Evolved/services/vista/ZVESDSEED.m` SEEDCLINICS entry point.

---

### 1.4 Ward Location — File 42

**Global root:** `^DIC(42,IEN,...)`

| Node | Piece | Field | Type | Notes |
|------|-------|-------|------|-------|
| `^DIC(42,IEN,0)` | 1 | WARD NAME | Free text | Ward display name |

**Relationship to File 44:** Ward locations have a corresponding File 44 (HOSPITAL LOCATION) entry of type `W`. File 42 holds ward-specific configuration; File 44 holds the location scheduling/type info.

**Write posture:** Read-only mirror is the appropriate initial posture.

**Provenance:** Screen contract `vista-evolved-platform/packages/contracts/screen-contracts/tenant-admin.wards.list.json`. Inventory entry `vista-evolved-platform/docs/reference/screen-inventory.md` §7.6.

---

### 1.5 Room-Bed — File 42.4

**Global root:** Not directly confirmed. Referenced in screen contracts as companion to File 42.

**Write posture:** Read-only.

**Provenance:** `vista-evolved-platform/packages/contracts/screen-contracts/tenant-admin.wards.list.json` — `dataSources` lists "VistA File 42.4 (ROOM-BED)".

---

### 1.6 Supporting files

| File | Global | Purpose | Provenance |
|------|--------|---------|------------|
| **40.7** — CLINIC STOP CODE | `^DIC(40.7,IEN,0)` | DSS stop codes for workload tracking | `VistA-Evolved/services/vista/ZVEFAC.m` STOPLIST tag |
| **42.4** — SPECIALTY | `^DIC(42.4,IEN,0)` | Treating specialty for bed sections | `VistA-Evolved/services/vista/ZVEFAC.m` SPECLIST tag |
| **49** — SERVICE/SECTION | `^DIC(49,IEN,0)` | OrgChart: clinical service hierarchy | `VistA-Evolved/services/vista/ZVEFAC.m` SVCLIST tag |
| **409.1** — APPOINTMENT TYPE | `^SD(409.1,IEN,0)` | Appointment type definitions | `VistA-Evolved/services/vista/ZVESDSEED.m` SEEDAPPTTYPES tag |
| **409.2** — APPOINTMENT STATUS | — | Appointment lifecycle states | `VistA-Evolved/data/vista/vivian/rpc_index.json` |
| **409.832** — SDES CLINIC | — | SDES scheduling clinic metadata | Vivian index |
| **409.845** — SDES AVAILABILITY | — | SDES availability patterns | Vivian index |
| **8989.3** — KERNEL SYSTEM PARAMS | `^XTV(8989.3,IEN,0)` | Site parameters: domain, volume set, default institution | `VistA-Evolved/services/vista/ZVEFAC.m` SITEPARM tag |

---

### 1.7 Hierarchy diagram

```
Institution (File 4, ^DIC(4))
  │
  ├── [pointer: File 40.8 node 0 piece 2 → File 4 IEN]
  │
  └── Division (File 40.8, ^DG(40.8))
        │
        ├── [pointer: File 44 node 0 piece 4 → File 40.8 IEN]
        │
        ├── Clinic (File 44 type=C, ^SC)
        │     ├── Stop Code (File 40.7)
        │     ├── Appointment Type (File 409.1)
        │     └── Appointment Subfile (File 44.003, ^SC(IEN,"S",date))
        │
        ├── Ward (File 44 type=W → File 42, ^DIC(42))
        │     └── Room-Bed (File 42.4)
        │
        └── Operating Room (File 44 type=OR)

User (File 200) ──[division assignment]──► Division (File 40.8)
  └── DUZ(2) = File 4 IEN of primary division's institution
```

---

## 2. RPC inventory

### 2.1 Confirmed available in VEHU (tested against live instance)

These RPCs are confirmed present in File 8994 of the VEHU sandbox. Source: `VistA-Evolved/data/vista/vista_instance/rpc_present.json`.

| RPC | IEN | Package | Domain | Purpose |
|-----|-----|---------|--------|---------|
| **ORWU CLINLOC** | 254 | OR | location | Search clinic locations by name text |
| **ORWU HOSPLOC** | — | OR | location | Search hospital locations (broader than clinics) |
| **ORWU INPLOC** | — | OR | location | Search inpatient locations |
| **ORWU DEFAULT DIVISION** | — | OR | division | Get default division for current user |
| **ORWU1 NEWLOC** | — | OR | location | Location search/lookup (new location subset) |
| **ORWU GENERIC** | 330 | OR | generic | Generic FileMan lookup (works for any file including File 4) |
| **XUS DIVISION GET** | 596 | XU | division | Get divisions available to authenticated user |
| **XUS DIVISION SET** | 594 | XU | division | Set active division for session |
| **XWB GET VARIABLE VALUE** | — | XWB | generic | Direct global read (any global path) |
| **DDR LISTER** | — | DDR | generic | Data Dictionary Reader — list records from any file |
| **DDR GETS ENTRY DATA** | — | DDR | generic | Get specific record fields from any file |
| **ORWPT ADMITLST** | 198 | OR | ADT | Admitted patients by ward |
| **ORWPT CLINRNG** | 253 | OR | scheduling | Patients by clinic and date range |
| **ORWPT BYWARD** | 620 | OR | ADT | Patients by ward location |
| **ORQPT WARD PATIENTS** | — | OR | ADT | Patients on a ward |
| **SDOE LIST ENCOUNTERS** | 132 | SDOE | scheduling | List encounters for patient |

### 2.2 Confirmed available — custom VE RPCs (require routine installation)

These RPCs are defined in `VistA-Evolved/services/vista/ZVEFAC.m` and registered in `VistA-Evolved/apps/api/src/vista/rpcRegistry.ts`. They require running the routine installer (`install-vista-routines.ps1`) in a VistA instance.

| RPC | MUMPS Entry | File Accessed | Purpose |
|-----|-------------|---------------|---------|
| **VE INST LIST** | `INSTLIST^ZVEFAC` | File 4 via `^DIC(4)` | Admin-comprehensive institution list (walks B-index) |
| **VE DIV LIST** | `DIVLIST^ZVEFAC` | File 40.8 via `^DG(40.8)` | Admin-comprehensive division list (walks B-index) |
| **VE SVC LIST** | `SVCLIST^ZVEFAC` | File 49 via `^DIC(49)` | Service/section list |
| **VE STOP LIST** | `STOPLIST^ZVEFAC` | File 40.7 via `^DIC(40.7)` | Clinic stop code list |
| **VE SPEC LIST** | `SPECLIST^ZVEFAC` | File 42.4 via `^DIC(42.4)` | Specialty list |
| **VE SITE PARM** | `SITEPARM^ZVEFAC` | File 8989.3 via `^XTV(8989.3)` | Site parameter read (domain, vol set, default institution) |
| **VE SVC CREATE** | `SVCCRT^ZVEFAC` | File 49 | Service/section create (via `UPDATE^DIE`) |
| **VE SVC EDIT** | `SVCEDT^ZVEFAC` | File 49 | Service/section edit (via `FILE^DIE`) |

### 2.3 Cataloged in Vivian but NOT present in VEHU

**Critical gap.** The SDES and SDEC scheduling RPCs are NOT installed in the VEHU sandbox. They exist in the Vivian DOX index (SD package) and in the archive's `rpc-catalog-snapshot.json` (with IENs), but `rpc_present.json` confirms they are absent from VEHU File 8994. Source: `VistA-Evolved/data/vista/vista_instance/rpc_present.json`.

#### SDEC — Scheduling GUI (Clinic administration)

| RPC | Vivian Package | Purpose |
|-----|---------------|---------|
| SDEC FACLIST | SD | Facility list for scheduling |
| SDEC GET INSTITUTION | SD | Get institution details |
| SDEC CLINALL | SD | All clinics list |
| SDEC CLINDIS | SD | Clinic display data |
| SDEC CLINLET | SD | Clinic appointment letter |
| SDEC CLINPROV | SD | Clinic providers |
| SDEC CLINSET | SD | Clinic settings |
| SDEC CLINSTOP | SD | Clinic stop codes |
| SDEC CLINIC GROUP LOOKUP | SD | Clinic group lookup |
| SDEC CLINIC GROUP RETURN | SD | Clinic group return data |
| SDEC PROVCLIN | SD | Provider clinic assignments |
| SDEC01 CLINICS | SD | Clinics listing (alternate) |

#### SDES — Scheduling Enhancement Services (Modern)

| RPC | Vivian Package | Purpose |
|-----|---------------|---------|
| SDES GET DIVISION LIST | SD | Division list for scheduling context |
| SDES SEARCH CLINIC | SD | Clinic search (by name/attributes/group) |
| SDES GET CLINIC INFO2 / INFO3 | SD | Detailed clinic configuration |
| SDES GET CLINIC ORIGINAL AVAIL | SD | Clinic original availability template |
| SDES GET CLINIC STOPCD | SD | Clinic stop codes |
| SDES GET CLINICS BY CLIN LIST | SD | Batch clinic detail lookup |
| SDES GET CLINICS BY PROVIDER | SD | Clinics by provider assignment |
| SDES GET RESOURCE BY CLINIC | SD | Scheduling resources for clinic |
| SDES EDIT CLINIC AVAILABILITY | SD | Clinic availability editing |
| SDES2 CREATE CLINIC | SD | Clinic creation (modern SDES) |
| SDES2 EDIT CLINIC | SD | Clinic edit (modern SDES) |
| SDES2 GET CLINIC INFO | SD | Clinic info read (modern) |
| SDES INACTIVATE CLINIC | SD | Clinic inactivation |
| SDES REACTIVATE CLINIC | SD | Clinic reactivation |

### 2.4 Custom RPCs needed but NOT yet implemented

Identified as "customNeeded" in `VistA-Evolved/data/vista/admin-rpc-catalog.json` but no MUMPS routine exists yet.

| RPC | Domain | Purpose | Catalog section |
|-----|--------|---------|-----------------|
| VE CLIN LIST | clinic | Admin-comprehensive clinic list (File 44) | §3 Clinic Setup |
| VE CLIN CREATE | clinic | Clinic creation via FileMan | §3 Clinic Setup |
| VE CLIN EDIT | clinic | Clinic edit via FileMan | §3 Clinic Setup |
| VE CLIN PATTERN | clinic | Clinic availability pattern management | §3 Clinic Setup |
| VE CLIN GROUP | clinic | Clinic group management | §3 Clinic Setup |
| VE INST EDIT | institution | Institution edit | §2 Facility/Org Setup |
| VE DIV CREATE | division | Division creation | §2 Facility/Org Setup |
| VE WARD LIST | inpatient | Ward location listing (File 42) | §4 Inpatient/ADT |
| VE WARD CREATE | inpatient | Ward creation | §4 Inpatient/ADT |
| VE WARD EDIT | inpatient | Ward edit | §4 Inpatient/ADT |
| VE BED STATUS | inpatient | Bed status/census | §4 Inpatient/ADT |
| VE CENSUS | inpatient | Inpatient census | §4 Inpatient/ADT |

### 2.5 CPRS call-site provenance

From `VistA-Evolved/design/contracts/cprs/v1/rpc_catalog.json`:

| RPC | CPRS Delphi source | Procedure | Line |
|-----|-------------------|-----------|------|
| ORWU CLINLOC | rCore.pas | SubSetOfClinics | 742 |
| ORWU HOSPLOC | rCore.pas | SubSetOfLocations | 1367 |
| ORWU INPLOC | rCore.pas | SubSetOfInpatientLocations | 1384 |
| ORWU1 NEWLOC | rCore.pas | SubSetOfNewLocs | 1376 |
| ORWU DEFAULT DIVISION | fFrame.pas | — | 975 |
| XUS DIVISION GET | SelDiv.pas | ChooseDiv, SelectDivision, MultDiv | multiple |
| XUS DIVISION SET | SelDiv.pas | SetDiv | 195 |

---

## 3. Existing implementation evidence

### 3.1 Platform — tenant-admin adapter

**File:** `vista-evolved-platform/apps/tenant-admin/lib/vista-adapter.mjs`

| Function | VistA endpoint | RPC behind endpoint | Scope |
|----------|---------------|-------------------|-------|
| `fetchVistaDivisions()` | `/vista/divisions` | XUS DIVISION GET | User-scoped |
| `fetchVistaClinics(searchText)` | `/vista/clinics` | ORWU CLINLOC | All matching clinics |
| `fetchVistaCurrentUser()` | `/vista/current-user` | XUS GET USER INFO | Session user |
| `probeVista()` | `/vista/ping` | TCP probe | Connectivity |

**Dual-mode pattern:** The adapter tries VistA-first. If the VistA API is unavailable, it falls back to fixture data from `fixtures/facilities.json`. Every response includes an honest `source` field (`"vista"` or `"fixture"`).

**Limitation:** `fetchVistaDivisions()` uses `XUS DIVISION GET`, which returns only divisions assigned to the authenticated user — NOT an admin-comprehensive list. For a full topology, the adapter would need to call `VE DIV LIST` (custom RPC) or use `DDR LISTER`/`XWB GET VARIABLE VALUE` for direct global walks.

### 3.2 Platform — screen contracts

Three screen contracts govern the facility topology surfaces:

| Contract file | Surface ID | VistA anchor | Read/write | Direct write |
|---------------|-----------|--------------|------------|-------------|
| `tenant-admin.facilities.list.json` | `tenant-admin.facilities.list` | File 4, File 40.8 | read-only | false |
| `tenant-admin.clinics.list.json` | `tenant-admin.clinics.list` | File 44 | mixed | false |
| `tenant-admin.wards.list.json` | `tenant-admin.wards.list` | File 42, File 42.4 | read-only | false |

**Key design decisions in contracts:**
- All three surfaces have `directWriteAllowed: false`.
- Facility list is `tenant-scoped`; clinic and ward lists are `facility-scoped` (require `tenantId` + `facilityId`).
- Clinics are `mixed` read/write posture but with write gated behind future research.
- All surfaces are `base-visible` (no pack gating) per `vista-evolved-platform/docs/reference/pack-visibility-rules.md`.

### 3.3 Platform — permissions matrix

From `vista-evolved-platform/docs/reference/permissions-matrix.md`:

| Surface | platform-operator | tenant-admin | clinician | ancillary | revenue-cycle | analyst | it-integration |
|---------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `tenant-admin.facilities.list` | C | A | — | — | — | — | C |
| `tenant-admin.clinics.list` | C | A | — | — | — | — | C |
| `tenant-admin.wards.list` | C | A | — | — | — | — | C |

(C = Contextual read, A = Admin access)

### 3.4 Platform — facilities detail screen contract

**File:** `vista-evolved-platform/packages/contracts/screen-contracts/tenant-admin.facilities.detail.json`

Data sources: `vista-file-4` (institution), `vista-file-44` (hospital locations), `platform-tenant-facility-mapping` (governance overlay). Status: draft, read-only.

### 3.5 Archive — rpcRegistry entries

**File:** `VistA-Evolved/apps/api/src/vista/rpcRegistry.ts`

The `admin-facility` domain in the registry contains:

| RPC name | Domain | Access | Description |
|----------|--------|--------|-------------|
| VE INST LIST | admin-facility | read | List institutions from File #4 |
| VE DIV LIST | admin-facility | read | List divisions from File #40.8 |
| VE SVC LIST | admin-facility | read | List services from File #49 |
| VE STOP LIST | admin-facility | read | List stop codes from File #40.7 |
| VE SPEC LIST | admin-facility | read | List specialties from File #42.4 |
| VE SITE PARM | admin-facility | read | Read site parameters from File #8989.3 |
| VE SVC CREATE | admin-facility | write | Create service in File #49 |
| VE SVC EDIT | admin-facility | write | Edit service in File #49 |

All listed in `customRpcs` section with provenance as custom VistA Evolved routines.

### 3.6 Archive — scheduling adapter types

**File:** `VistA-Evolved/apps/api/src/adapters/scheduling/interface.ts`

Key TypeScript types for clinic representation:

```typescript
interface ClinicInfo {
  ien: string;
  name: string;
  abbreviation: string;
  phone: string;
  location: string;
  stopCode: string;
}

interface ClinicResource {
  clinicIen: string;
  clinicName: string;
  resourceIen: string;
  slotLength: number;
  maxOverbooksPerDay: number;
  startTime: string;
  endTime: string;
  daysOfWeek: string[];
}

type SchedulingMode = {
  writebackEnabled: boolean;
  sdesInstalled: boolean;
  sdoeInstalled: boolean;
  mode: 'vista_direct' | 'vista_waitlist' | 'sdes_partial' | 'request_only';
}
```

### 3.7 Archive — capabilities.json scheduling entry

**File:** `VistA-Evolved/config/capabilities.json`

```json
"scheduling.clinics.list": {
  "status": "configured",
  "module": "scheduling",
  "adapter": "scheduling",
  "targetRpc": "SD W/L RETRIVE HOSP LOC(#44)",
  "targetPackage": "SD"
}
```

### 3.8 Platform — control-plane facilityType

**File:** `vista-evolved-platform/apps/control-plane/lib/plan-resolver.mjs`

The plan resolver accepts an optional `facilityType` input parameter used during tenant onboarding. This plumbs facility type into resolved plans and effective tenant configuration. Not directly VistA-wired — governance layer only.

---

## 4. MUMPS routines and write patterns

### 4.1 ZVEFAC.m — Facility administration RPCs

**File:** `VistA-Evolved/services/vista/ZVEFAC.m` (~200 lines)

#### INSTLIST — Institution listing (File 4)

```mumps
INSTLIST(RESULT,SEARCH,COUNT)
 ; Walk ^DIC(4,"B",name,IEN)
 ; For each IEN: read ^DIC(4,IEN,0) → NAME (piece 1)
 ; Also reads piece 11 and node 99
 ; Returns: RESULT(n) = "IEN^NAME^piece11^piece99"
```

Pattern: B-index walk with optional search text filtering and count limit.

#### DIVLIST — Division listing (File 40.8)

```mumps
DIVLIST(RESULT)
 ; Walk ^DG(40.8,"B",name,IEN)
 ; For each IEN: read ^DG(40.8,IEN,0)
 ;   piece 1 = division name
 ;   piece 7 = institution pointer (File 4 IEN)
 ; Resolves institution name by reading ^DIC(4,instIEN,0)
 ; Returns: RESULT(n) = "IEN^NAME^piece2^INST_NAME"
```

Pattern: B-index walk with pointer resolution to parent institution.

#### SVCLIST, STOPLIST, SPECLIST — Supporting file listings

```mumps
SVCLIST → walks ^DIC(49,"B") for File 49 (SERVICE/SECTION)
STOPLIST → walks ^DIC(40.7,"B") for File 40.7 (CLINIC STOP CODE)
SPECLIST → walks ^DIC(42.4,"B") for File 42.4 (SPECIALTY)
```

All follow the same B-index walk pattern.

#### SITEPARM — Site parameters (File 8989.3)

```mumps
SITEPARM(RESULT)
 ; Read ^XTV(8989.3,IEN,0) for:
 ;   Domain name, volume set, default institution pointer
 ; Resolves institution pointer to name via ^DIC(4,...)
```

#### SVCCRT / SVCEDT — Service/section writes (File 49)

```mumps
SVCCRT → Uses UPDATE^DIE (FileMan API) to create File 49 entry
SVCEDT → Uses FILE^DIE (FileMan API) to edit File 49 entry
```

**Key principle:** Write operations use VistA FileMan APIs (`UPDATE^DIE`, `FILE^DIE`), NOT direct global sets. This is the correct pattern for safe VistA writes.

#### INSTALL — RPC registration

```mumps
INSTALL
 ; Calls REG^ZVEUSER for each RPC name
 ; Registers entries in File 8994 (REMOTE PROCEDURE)
 ; Idempotent — checks $O(^XWB(8994,"B",NAME,"")) before inserting
```

### 4.2 ZVESDSEED.m — Scheduling sandbox seeder

**File:** `VistA-Evolved/services/vista/ZVESDSEED.m` (~200 lines)

**Warning:** This routine uses DIRECT global sets, not FileMan. It is DEV/DEMO labeled only — not production-safe.

#### SEEDCLINICS — File 44 clinic seeding

```mumps
; Direct ^SC(IEN,0) write pattern:
SET ^SC(IEN,0)=NAME_"^"_ABBR_"^"_TYPE_"^^^"_STOP
; Type C = Clinic
; Also sets B-index: ^SC("B",NAME,IEN)=""
```

Zero-node format: `NAME^ABBREVIATION^TYPE^^^STOP_CODE`

#### SEEDAPPTTYPES — File 409.1 appointment type seeding

```mumps
; Direct ^SD(409.1,IEN,0) write
SET ^SD(409.1,IEN,0)=NAME_"^"_CODE
; Also sets B-index: ^SD(409.1,"B",NAME,IEN)=""
```

#### Appointment creation — File 44.003 subfile

```mumps
; Appointment slot write:
SET ^SC(clinicIEN,"S",date,1,subIEN,0)=DFN_"^"_LENGTH_"^^^"_REASON
```

### 4.3 XUS1A.m — Kernel sign-on overlay (distro)

**File:** `vista-evolved-vista-distro/overlay/routines/XUS1A.m`

**Relevant line (line 46):** References `^DIC(4,DUZ(2),99)` — reads institution File 4, node 99, using the user's `DUZ(2)` (which is the IEN of the user's assigned institution in File 4). This shows how VistA resolves the user's institution context during sign-on.

**Key insight:** `DUZ(2)` is the user's primary institution IEN from File 4, set during the login/division-selection process. All subsequent operations use this to scope the session to the correct institution.

---

## 5. Gaps and probe requirements

### 5.1 Critical gap: SDEC/SDES RPCs absent from VEHU

**Finding:** ALL SDEC and SDES RPCs are absent from the VEHU sandbox File 8994. Only SDOE (encounter) RPCs are present. This means:

- No SDES-based clinic creation/editing via RPC
- No SDES-based division list for scheduling context
- No SDEC-based clinic settings, providers, or stop code reads
- The modern SDES scheduling workflow (used by VSE-GUI, the VA's new scheduling app) has no RPC foundation in the test instance

**Impact:** The `SchedulingMode` in the archive correctly reports `sdes_partial` at best. First-slice clinic read must use ORWU CLINLOC (confirmed present), not SDES.

**Remediation:** Install the SDES/SDEC package in the distro build lane, or confirm the distro `vista-evolved-vista-distro` image includes them. This is the highest-priority probe requirement.

### 5.2 User-scoped vs. admin-comprehensive division listing

`XUS DIVISION GET` (confirmed present, IEN 596) returns only divisions **assigned to the authenticated user**. For admin-comprehensive facility topology, one of these approaches is needed:

1. **VE DIV LIST** (custom RPC, walks all `^DG(40.8,"B")`) — requires ZVEFAC.m installation
2. **DDR LISTER** with file=40.8 — generic FileMan reader, confirmed present
3. **XWB GET VARIABLE VALUE** with `$O(^DG(40.8,"B",""))` traversal

### 5.3 Missing MUMPS routines for clinic admin

No MUMPS routine exists yet for:
- `VE CLIN LIST` — admin-comprehensive clinic listing from File 44
- `VE CLIN CREATE` / `VE CLIN EDIT` — clinic write operations
- `VE WARD LIST` — admin-comprehensive ward listing from File 42

The patterns in ZVEFAC.m (B-index walks, FileMan API writes) provide the template for implementing these.

### 5.4 Distro overlay — no facility/clinic routines yet

The `vista-evolved-vista-distro/overlay/routines/` directory contains 11 `ZVE*.m` files but none correspond to ZVEFAC.m or clinic admin operations. The facility/clinic routines from the archive have not been migrated to the distro overlay.

### 5.5 Probe requirements (prioritized)

| Priority | Probe | How | Why |
|----------|-------|-----|-----|
| 1 | SDES/SDEC presence in distro build | Check File 8994 after build | Determines if modern scheduling admin RPCs are available |
| 2 | ORWU CLINLOC result format at scale | Call with empty search against VEHU | Verify return format, count, and division pointer inclusion |
| 3 | DDR LISTER for File 44 | `DDR LISTER` with file=44, fields=.01;2;3 | Can we get admin-comprehensive clinic list without custom RPC? |
| 4 | DDR LISTER for File 40.8 | `DDR LISTER` with file=40.8, fields=.01;2;7 | Admin-comprehensive division list without custom RPC |
| 5 | `^SC("AC","C")` cross-reference | `XWB GET VARIABLE VALUE` walk | Can we get all type=C locations efficiently? |
| 6 | File 44 division pointer piece | Live read of `^SC(IEN,0)` piece 4 | Confirm which piece is the File 40.8 pointer |

---

## 6. Source provenance index

Every finding in this document maps to a specific repo and file:

| Claim domain | Primary source | Repo |
|--------------|---------------|------|
| File 4 structure | `docs/explanation/tenant-admin-vista-facility-division-clinic-map.md` §2 | platform |
| File 40.8 structure | `docs/explanation/tenant-admin-vista-facility-division-clinic-map.md` §3 | platform |
| File 44 structure | `docs/explanation/tenant-admin-vista-facility-division-clinic-map.md` §4 | platform |
| File 44 zero-node format | `services/vista/ZVESDSEED.m` SEEDCLINICS tag | archive |
| ZVEFAC.m entry points | `services/vista/ZVEFAC.m` (full file) | archive |
| RPC IENs (confirmed) | `data/vista/vista_instance/rpc_present.json` | archive |
| RPC IENs (Vivian) | `data/vista/vivian/rpc_index.json` | archive |
| SDES/SDEC absence | `data/vista/vista_instance/rpc_present.json` (not listed) | archive |
| admin-rpc-catalog sections | `data/vista/admin-rpc-catalog.json` §2, §3, §4 | archive |
| CPRS call sites | `design/contracts/cprs/v1/rpc_catalog.json` | archive |
| rpcRegistry entries | `apps/api/src/vista/rpcRegistry.ts` | archive |
| Adapter implementation | `apps/tenant-admin/lib/vista-adapter.mjs` | platform |
| Screen contracts | `packages/contracts/screen-contracts/tenant-admin.*.json` | platform |
| Screen inventory | `docs/reference/screen-inventory.md` §7.4–7.6 | platform |
| Permissions matrix | `docs/reference/permissions-matrix.md` | platform |
| Pack visibility | `docs/reference/pack-visibility-rules.md` | platform |
| Translation matrix RPCs | `docs/explanation/vista-admin-terminal-to-ui-translation-matrix.md` | platform |
| DUZ(2) sign-on reference | `overlay/routines/XUS1A.m` line 46 | distro |
| ClinicInfo / SchedulingMode types | `apps/api/src/adapters/scheduling/interface.ts` | archive |
| Scheduling capability | `config/capabilities.json` scheduling.clinics.list | archive |
| Control-plane facilityType | `apps/control-plane/lib/plan-resolver.mjs` | platform |

---

## Appendix A — Topology assembly (first-slice safe pattern)

For a grounded read-only first slice:

```
1. Call XUS DIVISION GET
   → Returns user-scoped divisions: division_IEN ^ name ^ default_flag ^ institution_IEN ^ station#

2. Call ORWU CLINLOC("", 1, 999)
   → Returns clinic locations: IEN ^ name ^ type

3. For each unique institution IEN from step 1:
   Read ^DIC(4,IEN,0) via XWB GET VARIABLE VALUE or DDR GETS ENTRY DATA
   → Resolve institution name and station number

4. Display flat tables with "Source: VistA (live)" badges
   → Divisions table, clinics table — tree view is stretch goal

5. For tree hierarchy (stretch goal):
   For each clinic from step 2: read ^SC(IEN,0) via XWB GET VARIABLE VALUE
   → Parse piece 4 for division pointer → group clinics under divisions
```

## Appendix B — Glossary of key VistA symbols

| Symbol | Meaning |
|--------|---------|
| `DUZ` | User IEN in File 200 (NEW PERSON) |
| `DUZ(2)` | User's primary institution IEN in File 4 |
| `^DIC(4)` | INSTITUTION global |
| `^DG(40.8)` | MEDICAL CENTER DIVISION global |
| `^SC` | HOSPITAL LOCATION global (File 44) |
| `^DIC(42)` | WARD LOCATION global |
| `^DIC(40.7)` | CLINIC STOP CODE global |
| `^DIC(42.4)` | SPECIALTY global |
| `^DIC(49)` | SERVICE/SECTION global |
| `^SD(409.1)` | APPOINTMENT TYPE global |
| `^XTV(8989.3)` | KERNEL SYSTEM PARAMETERS global |
| `^XWB(8994)` | REMOTE PROCEDURE (RPC registry) global |
| B-index | Standard VistA cross-reference: `^GLOBAL("B",name,IEN)=""` |
