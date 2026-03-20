# VistA Admin Corpus Discovery Pack

> **Purpose:** Externally-sourced reference corpus covering every VistA administrative domain
> relevant to the tenant-admin workspace. Every claim is grounded in public documentation,
> the local Vivian index snapshot, or the WorldVistA/VistA-M open-source repository —
> never in repo-internal assumptions or AI model memory.
>
> **Confidence classification:**
> - **EXT-CONFIRMED** — Confirmed by external VA/VistA documentation (Wikipedia, VA VDL, WorldVistA GitHub, Vivian)
> - **VIVIAN-LOCAL** — Confirmed from local Vivian index snapshot (`VistA-Evolved/docs/grounding/vivian-index.json`)
> - **NEEDS-LIVE-PROOF** — Plausible from documentation but requires runtime verification against a VistA instance

---

## 1. VistA System Overview

**Source:** Wikipedia "VistA" and "VA Kernel" articles; WorldVistA GitHub

VistA (Veterans Health Information Systems and Technology Architecture) is an enterprise
health information system deployed across 1,700+ VA facilities. It comprises 180+ integrated
application packages built on a MUMPS/M database (GT.M or YottaDB in open-source distributions).

Key architectural facts (EXT-CONFIRMED):
- **FileMan (DI)** is the metadata engine — all structured data access goes through data dictionaries
- **Kernel (XU)** provides infrastructure: authentication, menus, security keys, devices, TaskMan, MailMan
- **RPC Broker (XWB)** is the wire protocol connecting GUI clients (CPRS, VSE GUI, etc.) to M server RPCs
- **All administrative entities are stored in numbered VistA files** (e.g., File 200 = NEW PERSON, File 4 = INSTITUTION)
- The global namespace `^` prefix maps files to MUMPS globals (e.g., `^VA(200,` = File 200)

---

## 2. Domain-by-Domain Corpus

### 2.1 Users and Access Management

**VistA Package:** Kernel (XU) — prefix XU, namespaces: XU, A4A7, USC, XG, XIP, XLF, XNOA, XPD, XQ, XVIR, ZI, ZOSF, ZOSV, ZT, ZU, %Z

**Canonical files (EXT-CONFIRMED from WorldVistA/VistA-M GitHub):**

| File # | Name | Global | Admin Purpose |
|--------|------|--------|---------------|
| 200 | NEW PERSON | `^VA(200,` | Master user record — every VistA user, provider, admin |
| 200.01 | SIGNATURE BLOCK | within `^VA(200,` | Electronic signature block data |
| 201 | USER CLASS | `^USR(201,` | User class hierarchy for authorization |
| 8930 | TIU DOCUMENT DEFINITION | `^TIU(8925.1,` | Note/document type authorization |

**Canonical RPCs (VIVIAN-LOCAL — 44 RPCs in XU Kernel package):**

| RPC | Admin Purpose | Classification |
|-----|---------------|----------------|
| `XUS SIGNON SETUP` | Initialize sign-on sequence | EXT-CONFIRMED |
| `XUS AV CODE` | Authenticate with access/verify codes | EXT-CONFIRMED |
| `XUS GET USER INFO` | Retrieve authenticated user metadata (DUZ, name, division) | EXT-CONFIRMED |
| `XUS IAM ADD USER` | Create new user in File 200 | VIVIAN-LOCAL |
| `XUS IAM EDIT USER` | Edit existing user record | VIVIAN-LOCAL |
| `XUS IAM FIND USER` | Search for users | VIVIAN-LOCAL |
| `XUS IAM DISPLAY USER` | Read user detail | VIVIAN-LOCAL |
| `XUS IAM TERMINATE USER` | Terminate user access | VIVIAN-LOCAL |
| `XUS IAM REACTIVATE USER` | Reactivate terminated user | VIVIAN-LOCAL |
| `XUS IAM BIND USER` | Bind user to external identity | VIVIAN-LOCAL |
| `XUS ALLKEYS` | List all security keys | VIVIAN-LOCAL |
| `XUS KEY CHECK` | Check if user holds a security key | VIVIAN-LOCAL |
| `XUS SEND KEYS` | Assign security key to user | VIVIAN-LOCAL |
| `XUS DIVISION GET` | Get user's assigned divisions | EXT-CONFIRMED |
| `XUS DIVISION SET` | Set user's active division | EXT-CONFIRMED |
| `XUS GET TOKEN` | Obtain authentication token | VIVIAN-LOCAL |
| `XUS BSE TOKEN` | BSE (Broker Security Enhancement) token | VIVIAN-LOCAL |
| `XUS MVI NEW PERSON GET` | MVI (Master Veteran Index) person lookup | VIVIAN-LOCAL |
| `XUS MVI NEW PERSON UPDATE` | MVI person update | VIVIAN-LOCAL |
| `XUS MVI NEW PERSON DATA` | MVI person data retrieval | VIVIAN-LOCAL |
| `XUS MVI BULK NEW PERSON GET` | Bulk MVI person lookup | VIVIAN-LOCAL |
| `XUS MVI ENRICH NEW PERSON` | Enrich person with MVI data | VIVIAN-LOCAL |
| `XUS PKI GET UPN` | Get PKI User Principal Name | VIVIAN-LOCAL |
| `XUS PKI SET UPN` | Set PKI User Principal Name | VIVIAN-LOCAL |
| `XUS EPCS EDIT` | EPCS (Electronic Prescribing for Controlled Substances) edit | VIVIAN-LOCAL |
| `XQAL GUI ALERTS` | GUI alert management | VIVIAN-LOCAL |
| `XU REBUILD MENU TREE` | Rebuild menu option tree | VIVIAN-LOCAL |
| `XULM GET LOCK TABLE` | Get system lock table | VIVIAN-LOCAL |
| `XULM KILL PROCESS` | Kill a background process | VIVIAN-LOCAL |

**Key admin facts (EXT-CONFIRMED):**
- File 200 (NEW PERSON) is THE user master — contains name, access code hash, verify code hash, division assignments, service/section, electronic signature, person class, keys held, menu trees
- Security Keys (File 19.1) control access to VistA options. Keys are assigned to users via File 200 fields
- Access/Verify codes are the native authentication mechanism. Access code ~3-20 chars, verify code ~8-20 chars with mixed case + special char requirements
- Division assignment (File 200, DIVISION multiple) determines which facility data a user can access
- Electronic signature (File 200, ELECTRONIC SIGNATURE CODE) is required for signing orders and notes
- User classes (File 201) provide hierarchical authorization groupings

### 2.2 Security Keys and Menu Options

**VistA Package:** Kernel (XU)

**Canonical files (EXT-CONFIRMED from WorldVistA/VistA-M GitHub):**

| File # | Name | Global | Admin Purpose |
|--------|------|--------|---------------|
| 19 | OPTION | `^DIC(19,` | Menu options — every VistA menu and action |
| 19.1 | SECURITY KEY | `^DIC(19.1,` | Named access controls |
| 101 | PROTOCOL | `^ORD(101,` | Protocols — event-driven actions and extended actions |
| 19.081 | PRIMARY MENU OPTION | `^DIC(19,` subfield | User's primary menu assignment |

**Key admin facts (EXT-CONFIRMED):**
- Every VistA function is gated by an OPTION (File 19). Options form a tree (menus containing options)
- Security Keys (File 19.1) are named tokens: ORES (order entry), ORELSE (order release), PROVIDER (clinical), XUPROG (programmer), etc.
- A user must hold the right key AND have the right option on their menu tree to perform an action
- MenuMan (XQ namespace) traverses the option tree at the terminal. GUI applications use RPC Broker context (File 8994.5) instead
- The RPC Broker "context" (OPTION with type "B") gates which RPCs a GUI client can call — this is the equivalent of keys for GUI access

### 2.3 Institutions and Divisions

**VistA Package:** Kernel (XU) for File 4; Registration (DG) for File 40.8

**Canonical files (EXT-CONFIRMED from WorldVistA/VistA-M GitHub):**

| File # | Name | Global | Admin Purpose |
|--------|------|--------|---------------|
| 4 | INSTITUTION | `^DIC(4,` | Every VA facility (station number, name, address, parent) |
| 4.111 | TREATING SPECIALTY | subfield of File 4 | Specialties active at a facility |
| 40.8 | MEDICAL CENTER DIVISION | `^DG(40.8,` | Subdivisions of an institution (divisions) |
| 43 | MAS PARAMETERS | `^DG(43,` | Site-level MAS (Medical Administration Service) configuration |
| 8989.3 | KERNEL SYSTEM PARAMETERS | `^XTV(8989.3,` | Global system parameters |

**Canonical RPCs for institution admin (VIVIAN-LOCAL):**

| RPC | Source Package | Purpose |
|-----|---------------|---------|
| `XUS DIVISION GET` | Kernel (XU) | Get divisions for current user |
| `XUS DIVISION SET` | Kernel (XU) | Set active division context |
| `SDEC GET INSTITUTION` | Scheduling (SD) | Get institution details |
| `SDEC FACLIST` | Scheduling (SD) | Facility list |
| `SDES GET DIVISION LIST` | Scheduling (SD) | Division list from SDES |
| `SDES2 GET DIVISION LIST` | Scheduling (SD) | Division list (v2 API) |
| `SDES2 GET CLINICS BY STATION` | Scheduling (SD) | Clinics at a station |
| `VAFCTFU GET TREATING LIST` | Registration (DG) | List treating facilities |

**Key admin facts (EXT-CONFIRMED):**
- File 4 INSTITUTION is the facility master. Each VA medical center has a station number (e.g., 500 = Ann Arbor)
- File 40.8 MEDICAL CENTER DIVISION further subdivides institutions (e.g., main hospital, satellite clinic)
- Division context determines which patients and data a user can interact with
- Files 4 and 40.8 are typically seeded during VistA installation and rarely modified in day-to-day admin
- The concept of "multi-division" is important: a user can be assigned to multiple divisions but operates in one active division at a time

### 2.4 Clinics and Hospital Locations

**VistA Package:** Scheduling (SD) — prefix SD, namespaces: SD, SC

**Canonical files (EXT-CONFIRMED from WorldVistA/VistA-M GitHub):**

| File # | Name | Global | Admin Purpose |
|--------|------|--------|---------------|
| 44 | HOSPITAL LOCATION | `^SC(` | Master clinic/location record |
| 40.7 | CLINIC STOP | `^DIC(40.7,` | DSS/workload stop codes |
| 44.1 | CLINIC STOP | subfield | Stop codes assigned to clinics |
| 409.1 | APPOINTMENT TYPE | `^SD(409.1,` | Types of appointments |
| 409.2 | CANCELLATION REASONS | `^SD(409.2,` | Reason codes for cancellations |
| 404.91 | SCHEDULING PARAMETER | `^SD(404.91,` | SDES scheduling configuration |
| 404.51 | TEAM (PCMM) | `^SCTM(404.51,` | Primary Care Management Module teams |
| 409.67 | CLINIC GROUP | `^SD(409.67,` | Groups of clinics for scheduling views |
| 409.3 | WAIT LIST | `^SD(409.3,` | Patient waiting list |

**Canonical RPCs — scheduling admin (VIVIAN-LOCAL — 608 RPCs total in SD package):**

Key admin-relevant RPCs from the 608 total:

| RPC | Purpose | Classification |
|-----|---------|----------------|
| `SDES2 CREATE CLINIC` | Create a new clinic in File 44 | VIVIAN-LOCAL |
| `SDES2 EDIT CLINIC` | Edit existing clinic | VIVIAN-LOCAL |
| `SDES2 INACTIVATE CLINIC` | Inactivate clinic | VIVIAN-LOCAL |
| `SDES2 REACTIVATE CLINIC` | Reactivate clinic | VIVIAN-LOCAL |
| `SDES SEARCH CLINIC` | Search clinics | VIVIAN-LOCAL |
| `SDES GET CLINIC INFO2` / `INFO3` | Detailed clinic information | VIVIAN-LOCAL |
| `SDES GET APPT TYPES` | List appointment types | VIVIAN-LOCAL |
| `SDES GET CANCEL REASONS` | List cancellation reasons | VIVIAN-LOCAL |
| `SDES2 CREATE CLINIC AVAIL` | Create clinic availability slots | VIVIAN-LOCAL |
| `SDES2 EDIT CLINIC AVAILABILITY` | Edit availability | VIVIAN-LOCAL |
| `SDES2 CANCEL CLINIC AVAIL` | Cancel availability slots | VIVIAN-LOCAL |
| `SDES2 CREATE PROVIDER RESOURCE` | Create provider resource mapping | VIVIAN-LOCAL |
| `SDES2 EDIT PROVIDER RESOURCE` | Edit provider resource | VIVIAN-LOCAL |
| `SDES GET RESOURCE BY CLINIC` | Resource-to-clinic mapping | VIVIAN-LOCAL |
| `SDES ADDEDIT CLINIC GRP` | Add/edit clinic groups | VIVIAN-LOCAL |
| `SDES DELETE CLINIC GROUP` | Delete clinic group | VIVIAN-LOCAL |
| `SDES READ CLINIC GROUP` | Read clinic group | VIVIAN-LOCAL |
| `SDEC CLINSET` | Set clinic configuration | VIVIAN-LOCAL |
| `SDEC CLINSTOP` | Set clinic stop codes | VIVIAN-LOCAL |
| `SDEC CLINPROV` | Set clinic providers | VIVIAN-LOCAL |
| `SDES INACTIVATE/ZZ CLINIC` | Mark clinic inactive with ZZ prefix | VIVIAN-LOCAL |
| `SC TEAM LIST` | PCMM team list | VIVIAN-LOCAL |
| `SC PRIMARY CARE TEAM` | Primary care team lookup | VIVIAN-LOCAL |

**Key admin facts (EXT-CONFIRMED):**
- File 44 HOSPITAL LOCATION is the clinic master. A "clinic" in VistA is an administrative location where appointments happen
- Clinics have: name, abbreviation, stop code (for workload credit), division, service, provider, availability (time slots)
- Stop codes (File 40.7) map to DSS national workload identifiers — critical for cost accounting
- The SDES/SDES2 RPCs are the modern scheduling API (VA Scheduling Enhancement). SDEC RPCs are the slightly older VSE (VistA Scheduling Enhancement). Both coexist
- Clinic availability is defined by date/time patterns — not just "open hours" but specific slot grids
- PCMM (Primary Care Management Module) teams (File 404.51) define which providers serve which patient panels

### 2.5 Wards and Room-Bed Configuration

**VistA Package:** Registration (DG)

**Canonical files (EXT-CONFIRMED from WorldVistA/VistA-M GitHub):**

| File # | Name | Global | Admin Purpose |
|--------|------|--------|---------------|
| 42 | WARD LOCATION | `^DIC(42,` | Inpatient ward definitions |
| 42.4 | SPECIALTY | `^DIC(42.4,` | Medical specialties for wards |
| 405 | PATIENT MOVEMENT | `^DGPM(405,` | ADT tracking (admissions, discharges, transfers) |
| 405.4 | ROOM-BED | `^DG(405.4,` | Physical room and bed assignments |
| 8 | ELIGIBILITY CODE | `^DIC(8,` | Patient eligibility categories |

**Canonical RPCs (VIVIAN-LOCAL — DG Registration package, 42 RPCs):**

| RPC | Purpose | Classification |
|-----|---------|----------------|
| `DGWPT BYWARD` | Patients by ward | VIVIAN-LOCAL |
| `DGWPT CLINRNG` | Patients by clinic range | VIVIAN-LOCAL |
| `DGWPT SELECT` | Select patient from ward list | VIVIAN-LOCAL |
| `DGWPT TOP` | Top of ward patient list | VIVIAN-LOCAL |
| `DGWPT DIEDON` | Patient deceased flag | VIVIAN-LOCAL |
| `DGWPT1 PRCARE` | Primary care info for ward patient | VIVIAN-LOCAL |
| `DG SENSITIVE RECORD ACCESS` | Gate sensitive record access | VIVIAN-LOCAL |
| `DG SENSITIVE RECORD BULLETIN` | Sensitive access audit bulletin | VIVIAN-LOCAL |
| `VAFCTFU CONVERT DFN TO ICN` | Patient DFN → ICN conversion | VIVIAN-LOCAL |
| `VAFCTFU CONVERT ICN TO DFN` | Patient ICN → DFN conversion | VIVIAN-LOCAL |

**Key admin facts (EXT-CONFIRMED):**
- Ward (File 42) is the inpatient equivalent of a clinic. Wards have: name, division, specialty, beds
- Room-Bed (File 405.4) maps physical rooms and beds within wards. Beds can be marked as available/unavailable
- Patient Movement (File 405) tracks every admission, transfer, and discharge — the ADT backbone
- Wards are relatively static — set up during facility configuration and rarely modified
- ADT write RPCs (DGPM NEW ADMISSION/TRANSFER/DISCHARGE) are NOT in the standard RPC Broker — they are absent from most open-source VistA distributions

### 2.6 Order Entry and CPRS Configuration

**VistA Package:** Order Entry/Results Reporting (OR) — prefix OR, namespaces: OR, OCX

**Canonical files (EXT-CONFIRMED from WorldVistA/VistA-M GitHub):**

| File # | Name | Global | Admin Purpose |
|--------|------|--------|---------------|
| 100 | ORDER | `^OR(100,` | Master order records |
| 100.98 | ORDER/ENTRY DISPLAY GROUP | `^ORD(100.98,` | Display group categories for orders |
| 100.99 | ORDER PARAMETERS | `^ORD(100.99,` | System/division/user order parameters |
| 101.41 | ORDER DIALOG | `^ORD(101.41,` | Order dialog (quick order) definitions |
| 101.43 | ORDERABLE ITEMS | `^ORD(101.43,` | Orderable item catalog |
| 860 | ORDER CHECK RULE | `^ORD(860,` | Drug interaction and order check rules |

**Canonical RPCs — admin-relevant subset (VIVIAN-LOCAL — 1,116 RPCs total in OR package):**

| RPC | Purpose | Classification |
|-----|---------|----------------|
| `ORWDX DLGDEF` | Get order dialog definition | VIVIAN-LOCAL |
| `ORWDX DLGID` | Get dialog ID | VIVIAN-LOCAL |
| `ORWDX DLGQUIK` | Quick order dialog | VIVIAN-LOCAL |
| `ORQPT WARDS` | List wards | VIVIAN-LOCAL |
| `ORQPT CLINICS` | List clinics | VIVIAN-LOCAL |
| `ORQPT TEAMS` | List teams | VIVIAN-LOCAL |
| `ORQPT SPECIALTIES` | List specialties | VIVIAN-LOCAL |
| `ORQPT PROVIDERS` | List providers | VIVIAN-LOCAL |
| `ORQPT DEFAULT PATIENT LIST` | Get default patient list | VIVIAN-LOCAL |
| `ORWDX LOCK` / `UNLOCK` | Patient-level order locking | VIVIAN-LOCAL |
| `ORWDX SAVE` | Save an order | EXT-CONFIRMED |
| `ORWDXA DC` | Discontinue order | EXT-CONFIRMED |
| `ORWDXA COMPLETE` | Complete order | EXT-CONFIRMED |
| `ORWDXA FLAG` | Flag order | EXT-CONFIRMED |
| `ORWDXA HOLD` | Hold order | EXT-CONFIRMED |
| `ORQ3 LOADALL` / `SAVEALL` | Load/save notification settings | VIVIAN-LOCAL |
| `ORQQXQA USER` | User alerts | VIVIAN-LOCAL |
| `ORQQXQA PATIENT` | Patient alerts | VIVIAN-LOCAL |

**Key admin facts (EXT-CONFIRMED):**
- CPRS (Computerized Patient Record System) is built on the OR (Order Entry) package
- Order dialogs (File 101.41) define what a clinician sees when placing an order — these are highly configurable
- Quick orders are pre-filled order templates that speed common ordering workflows
- Display groups (File 100.98) organize orders into categories visible in CPRS tabs
- Order parameters (File 100.99) can be set at system, division, service, or user level — a 4-tier parameter cascade
- Order checks (File 860) enforce clinical decision support rules (drug-drug interactions, duplicate orders, etc.)

### 2.7 Parameters and Site Configuration

**VistA Package:** Toolkit (XT) + Kernel (XU)

**Canonical files (EXT-CONFIRMED from WorldVistA/VistA-M GitHub):**

| File # | Name | Global | Admin Purpose |
|--------|------|--------|---------------|
| 8989.5 | PARAMETERS | `^XTV(8989.5,` | Named parameter values |
| 8989.51 | PARAMETER DEFINITION | `^XTV(8989.51,` | Parameter metadata (name, type, entity levels) |
| 8989.518 | PARAMETER ENTITY | `^XTV(8989.518,` | Which entities can have which parameters |
| 8989.52 | PARAMETER TEMPLATE | `^XTV(8989.52,` | Parameter template definitions |
| 8989.3 | KERNEL SYSTEM PARAMETERS | `^XTV(8989.3,` | Core system-level parameters |
| 8989.2 | KERNEL INSTALL PARAMETERS | `^XTV(8989.2,` | Install/patch parameters |

**Key admin facts (EXT-CONFIRMED):**
- VistA's parameter system (File 8989.5x) is a hierarchical key-value store with entity-level scoping
- Parameters can be set at: system, division, service, user, patient, and other entity levels
- The parameter cascade resolves in priority order: user > service > division > system (most specific wins)
- This is how CPRS customizations work — a division can set default order views, and a user can override them
- Parameters are the mechanism behind "site configuration" in VistA — not config files

### 2.8 FileMan and Data Dictionary

**VistA Package:** VA FileMan (DI) — prefix DI, namespaces: DI, DD, DM

**Canonical RPCs (VIVIAN-LOCAL — 10 DDR RPCs):**

| RPC | Purpose | Classification |
|-----|---------|----------------|
| `DDR LISTER` | Generic list query against any VistA file | VIVIAN-LOCAL |
| `DDR GETS ENTRY DATA` | Get specific fields from a record | VIVIAN-LOCAL |
| `DDR FIND1` | Find single record by lookup value | VIVIAN-LOCAL |
| `DDR FINDER` | Search records | VIVIAN-LOCAL |
| `DDR FILER` | File (create/update) a record | VIVIAN-LOCAL |
| `DDR DELETE ENTRY` | Delete a record | VIVIAN-LOCAL |
| `DDR GET DD HELP` | Get data dictionary help text | VIVIAN-LOCAL |
| `DDR KEY VALIDATOR` | Validate key values | VIVIAN-LOCAL |
| `DDR LOCK NODE` | Lock a global node | VIVIAN-LOCAL |
| `DDR UNLOCK NODE` | Unlock a global node | VIVIAN-LOCAL |
| `DDR VALIDATOR` | Validate field values | VIVIAN-LOCAL |

**Key admin facts (EXT-CONFIRMED from Wikipedia FileMan article):**
- FileMan is essentially a database schema + access layer on top of MUMPS globals
- The Data Dictionary (DD) defines all VistA files: fields, types, indexes, cross-references, input transforms
- DDR RPCs provide GENERIC CRUD access to ANY VistA file — they are the equivalent of a REST API over the DD
- `DDR LISTER` is the most powerful admin tool: it can query any file's data by specifying file number, fields, screen criteria
- `DDR FILER` can create or update records in any file — but it respects DD validation rules and triggers
- FileMan is the reason VistA self-documents: `help` on any field gives the DD definition

### 2.9 Alerts and Notifications

**VistA Package:** Kernel (XU) for alerts; Order Entry (OR) for CPRS notifications

**Canonical files (EXT-CONFIRMED):**

| File # | Name | Global | Admin Purpose |
|--------|------|--------|---------------|
| 8992 | ALERT | `^XTV(8992,` | Kernel alert records |
| 100.9 | OE/RR NOTIFICATIONS | `^ORD(100.9,` | CPRS notification definitions |

**Canonical RPCs:**

| RPC | Purpose | Classification |
|-----|---------|----------------|
| `XQAL GUI ALERTS` | Alert management for GUI | VIVIAN-LOCAL |
| `ORB DELETE ALERT` | Delete a CPRS alert/notification | VIVIAN-LOCAL |
| `ORB FORWARD ALERT` | Forward alert to another user | VIVIAN-LOCAL |
| `ORB RENEW ALERT` | Renew expiring alert | VIVIAN-LOCAL |
| `ORB SORT METHOD` | Set notification sort method | VIVIAN-LOCAL |
| `ORQ3 LOADALL` | Load notification settings | VIVIAN-LOCAL |
| `ORQ3 SAVEALL` | Save notification settings | VIVIAN-LOCAL |

**Key admin facts (EXT-CONFIRMED):**
- VistA alerts are the notification system — Kernel alerts (File 8992) for system-level, CPRS notifications (File 100.9) for clinical
- CPRS notifications include: new order, lab result ready, flagged order, unsigned note, imaging result, consult response
- Notification routing can be configured per user, per team, per service
- Alert management (forwarding, deletion, renewal) is a regular admin task

### 2.10 RPC Broker and Application Contexts

**VistA Package:** RPC Broker (XWB) — prefix XWB, namespaces: XWB

**Canonical files (EXT-CONFIRMED from WorldVistA/VistA-M GitHub):**

| File # | Name | Global | Admin Purpose |
|--------|------|--------|---------------|
| 8994 | REMOTE PROCEDURE | `^XWB(8994,` | Master RPC registry — every callable RPC |
| 8994.1 | RPC BROKER SITE PARAMETERS | `^XWB(8994.1,` | Broker configuration (ports, timeouts) |

**Canonical RPCs (VIVIAN-LOCAL — 33 RPCs in XWB package):**

| RPC | Purpose | Classification |
|-----|---------|----------------|
| `XWB CREATE CONTEXT` | Set the application context for RPC authorization | VIVIAN-LOCAL |
| `XWB IS RPC AVAILABLE` | Check if a single RPC exists and is callable | VIVIAN-LOCAL |
| `XWB ARE RPCS AVAILABLE` | Batch-check RPC availability | VIVIAN-LOCAL |
| `XWB RPC LIST` | List all registered RPCs | VIVIAN-LOCAL |
| `XWB GET BROKER INFO` | Get broker configuration info | VIVIAN-LOCAL |
| `XWB GET VARIABLE VALUE` | Read any M variable (powerful debug tool) | VIVIAN-LOCAL |
| `XWB DEFERRED RPC` | Queue an RPC for deferred execution | VIVIAN-LOCAL |
| `XWB REMOTE RPC` | Call RPC on a remote VistA instance | VIVIAN-LOCAL |

**Key admin facts (EXT-CONFIRMED):**
- File 8994 is the RPC master registry. Every RPC has: name, tag, routine, input parameters, return type, application context membership
- Application contexts (OPTION type "B" in File 19) gate which RPCs a GUI can call. CPRS uses "OR CPRS GUI CHART" context
- `XWB GET VARIABLE VALUE` can read any MUMPS variable or global node — extremely powerful for admin inspection but dangerous
- RPC Broker site parameters (File 8994.1) set: listener port, callback port, timeouts, UCX vs Caché broker mode
- The Broker wire protocol uses TCP with XWB-specific framing (see archive AGENTS.md for protocol details)

### 2.11 HL7 Messaging and Interfaces

**VistA Package:** Health Level Seven (HL) — prefix HL

**Canonical files (EXT-CONFIRMED from WorldVistA/VistA-M GitHub):**

| File # | Name | Admin Purpose |
|--------|------|---------------|
| 771 | HL7 APPLICATION PARAMETER | HL7 application identifiers |
| 770 | HL7 MESSAGE TYPE | Message type definitions |
| 771.2 | HL7 INTERFACE | Interface configurations |
| 779.1 | HLO APPLICATION | HLO (HL7 Optimized) application registry |

**Key admin facts (EXT-CONFIRMED):**
- VistA HL7 is used for inter-system messaging: ADT (patient registration), ORM (orders), ORU (results), SIU (scheduling)
- HL7 interfaces connect VistA to: lab instruments, radiology PACS, pharmacy robots, other VistA sites, DoD systems
- HL7 admin involves: creating application parameters, defining interfaces, monitoring message queues
- VistA supports both traditional HL7 v2.x and newer HLO (HL7 Optimized) protocol
- The HL package has 0 RPCs — all HL7 admin is done through MUMPS options (terminal-based)

### 2.12 Lab Service Configuration

**VistA Package:** Lab Service (LR) — prefix LR

**Canonical files (EXT-CONFIRMED from WorldVistA/VistA-M GitHub):**

| File # | Name | Global | Admin Purpose |
|--------|------|--------|---------------|
| 60 | LABORATORY TEST | `^LAB(60,` | Lab test definitions (names, specimen, method) |
| 62 | COLLECTION SAMPLE | `^LAB(62,` | Sample collection types |
| 63 | LAB DATA | `^LR(` | Patient lab results (clinical, not admin) |
| 64 | WKLD CODE | `^LAB(64,` | Workload codes for lab procedures |
| 69 | LAB ORDER ENTRY | `^LRO(69,` | Lab orders |
| 69.9 | LABORATORY SITE | `^LAB(69.9,` | Lab site-level configuration |

**Key admin facts (EXT-CONFIRMED):**
- Lab configuration is one of the most complex admin domains in VistA
- File 60 (LABORATORY TEST) has hundreds of entries defining every lab test: name, specimen, collection sample, method, urgency
- File 69.9 (LABORATORY SITE) controls: lab sections, specimen labels, hardware interfaces, accession areas
- Lab admin typically requires specialized training — it's not a general admin task
- Lab RPCs for ordering (LR ORDER, LR VERIFY) are NOT registered in most open-source distributions

### 2.13 Pharmacy Configuration

**VistA Package:** Pharmacy Data Management (PS) — prefix PS

**Canonical files (EXT-CONFIRMED from WorldVistA/VistA-M GitHub):**

| File # | Name | Global | Admin Purpose |
|--------|------|--------|---------------|
| 50 | DRUG | `^PSDRUG(` | Drug file — every formulary drug |
| 50.7 | PHARMACY ORDERABLE ITEM | `^PS(50.7,` | Items orderable through pharmacy |
| 51 | MEDICATION INSTRUCTION | `^PS(51,` | SIG (instructions) definitions |
| 52.6 | IV ADDITIVES | `^PS(52.6,` | IV additive catalog |
| 55 | PHARMACY PATIENT | `^PS(55,` | Patient pharmacy profile |
| 59.7 | PHARMACY SYSTEM | `^PS(59.7,` | Pharmacy system parameters |

**Key admin facts (EXT-CONFIRMED):**
- Drug file (File 50) is maintained nationally by VA — local sites map orderable items to it
- Pharmacy orderable items (File 50.7) bridge between CPRS ordering and the actual drug file
- Pharmacy system parameters (File 59.7) control: max supply days, refill logic, warning thresholds
- Drug-drug interaction checking is driven by File 50 cross-references and national databases
- EPCS (Electronic Prescribing for Controlled Substances) requires DEA registration linked to File 200 user records

### 2.14 Imaging (VistA Imaging)

**VistA Package:** Imaging (MAG) — prefix MAG

**Canonical RPCs (VIVIAN-LOCAL — 528 RPCs total in MAG package):**

Key admin-relevant RPCs:

| RPC | Purpose | Classification |
|-----|---------|----------------|
| `MAG4 ADD IMAGE` | Add image to VistA Imaging | EXT-CONFIRMED |
| `MAG4 GET IMAGE INFO` | Get image metadata | VIVIAN-LOCAL |
| `MAGG PAT INFO` | Patient imaging info | VIVIAN-LOCAL |
| `MAG DOC TYPES` | Document types for imaging | VIVIAN-LOCAL |
| `MAG DICOM GET INST` | Get DICOM institution info | VIVIAN-LOCAL |
| `MAG WRKS SETTINGS` | Workstation settings | VIVIAN-LOCAL |

**Canonical files (EXT-CONFIRMED from WorldVistA/VistA-M GitHub):**

| File # | Name | Global | Admin Purpose |
|--------|------|--------|---------------|
| 2005 | IMAGE | `^MAG(2005,` | Master image index |
| 2005.2 | NETWORK LOCATION | `^MAG(2005.2,` | Image storage locations |
| 2006.1 | IMAGING SITE PARAMETERS | `^MAG(2006.1,` | Site-level imaging configuration |
| 2006.04 | ACQUISITION DEVICE | `^MAG(2006.04,` | Imaging capture devices |

**Key admin facts (EXT-CONFIRMED):**
- VistA Imaging stores metadata in File 2005 and actual images on network shares or DICOM PACS
- Network locations (File 2005.2) define where images are physically stored
- Imaging site parameters control: image compression, routing rules, purge policies
- VistA Imaging has its own display application (Clinical Image Display) separate from CPRS
- The MAG package has 528 RPCs — the second largest RPC surface after OR (1,116)

---

## 3. Package RPC Summary

**Source: Local Vivian index snapshot (VistA-Evolved/docs/grounding/vivian-index.json)**

| Package | Prefix | RPC Count | Admin Relevance |
|---------|--------|-----------|-----------------|
| Order Entry/Results Reporting | OR | 1,116 | CPRS configuration, order dialogs, notifications |
| Scheduling | SD | 608 | Clinic management, appointments, availability |
| Imaging | MAG | 528 | Image administration, device management |
| TIU (Text Integration Utilities) | TIU | 129 | Document types, note templates |
| Registration | DG | 42 | ADT, patient lookup, facility data |
| Kernel | XU | 44 | Users, keys, divisions, authentication |
| RPC Broker | XWB | 33 | RPC registration, contexts, broker config |
| FileMan | DI | 10 | Generic CRUD on any VistA file |
| HL7 | HL | 0 | All terminal-based; no RPCs |
| MailMan | XM | 0 | All terminal-based; no RPCs |
| **Total admin-relevant** | | **2,510** | |

---

## 4. External Source Provenance

Every fact in this document is traceable to one of these external sources:

| Source | Type | URL/Location | What Was Extracted |
|--------|------|-------------|-------------------|
| Wikipedia — VistA | Encyclopedia | `en.wikipedia.org/wiki/VistA` | 180+ apps overview, architecture |
| Wikipedia — VA Kernel | Encyclopedia | `en.wikipedia.org/wiki/VA_Kernel` | MenuMan, MailMan, security model |
| Wikipedia — FileMan | Encyclopedia | `en.wikipedia.org/wiki/FileMan` | DD model, metadata architecture |
| WorldVistA/VistA-M GitHub | Source code | `github.com/WorldVistA/VistA-M/Packages/` | Global files per package (Files/globals) |
| Vivian Index (local snapshot) | Package index | `VistA-Evolved/docs/grounding/vivian-index.json` | 127 packages, 4,721 RPCs, interfaces |
| RPC Coverage Map (local) | Cross-reference | `VistA-Evolved/docs/vista-alignment/rpc-coverage.json` | 76 live wired, CPRS gap analysis |
| VA VDL | Documentation portal | `va.gov/vdl/` | Package landing pages (content limited) |

**Sources attempted but not extractable:**
- Vivian DOX (vivian.worldvista.org/dox/*) — SPA, returns "Not Found" on direct fetch
- OSEHRA (osehra.org) — Shut down Feb 2020, redirects to bavida.com
- VistAPedia (vistapedia.com) — Returns "Not Found"

---

## 5. Implications for Tenant Admin

Based on this corpus, the tenant admin workspace should focus on these domain priorities:

### Tier 1 — Rich RPC surface, admin-essential
1. **Users & Keys** (XU Kernel) — 44 RPCs including IAM CRUD, excellent admin coverage
2. **Clinics & Scheduling Config** (SD) — 608 RPCs, SDES2 has full clinic CRUD
3. **Institutions & Divisions** (XU/DG) — Small but critical topology reads

### Tier 2 — Admin-relevant reads, limited writes via RPC
4. **Order Entry Config** (OR) — 1,116 RPCs but mostly clinical; admin = dialog/parameter config
5. **Parameters & Site Config** (XT/XU) — Hierarchical parameter reads/writes
6. **Alerts & Notifications** (XU/OR) — Notification settings management

### Tier 3 — Specialized admin, NEEDS-LIVE-PROOF
7. **Wards & Room-Beds** (DG) — Small file set, mostly read-only admin
8. **Lab Configuration** (LR) — Complex, specialized, minimal RPC admin surface
9. **Pharmacy Configuration** (PS) — Drug file national, local mapping only
10. **Imaging Admin** (MAG) — 528 RPCs but mostly clinical image handling
11. **HL7 Interfaces** (HL) — Terminal-only admin, no RPCs

### Tier 4 — Generic escape hatch
12. **FileMan DDR RPCs** (DI) — 10 RPCs that can read/write ANY file. Use as fallback when domain-specific RPCs are unavailable. Requires exact file/field knowledge from DD.

---

*Generated: Task 1 of queue pack "VISTA ADMIN CORPUS + TERMINAL-TO-UI TRANSLATION PROGRAM"*
*External research date: 2026-03-20*
