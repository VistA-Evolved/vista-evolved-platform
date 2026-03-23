# VistA Admin — Terminal-to-UI Translation Matrix

> **Status:** ARCHIVED — superseded by [Terminal-to-UI Translation Matrix v2](vista-admin-terminal-to-ui-translation-matrix-v2.md).
>
> **Purpose:** Maps every discovered VistA admin function from the terminal world to its
> potential UI translation mode. This is the canonical anti-miss artifact: it ensures no
> major terminal admin behavior is silently dropped when translating to a browser-based
> tenant-admin workspace.
>
> **Parent:** [VistA Admin Corpus Discovery Pack](vista-admin-corpus-discovery-pack.md)
>
> **See also:**
> - [VistA Admin Domain Map](vista-admin-domain-map.md) — file/global/RPC quick reference
> - [VistA Admin Slice Ranking and Mode Selection](vista-admin-slice-ranking-and-mode-selection.md) — prioritized first-slice plan
> - [Tenant Admin Architecture and Boundaries](tenant-admin-architecture-and-boundaries.md) — boundary policy
> - [Tenant Admin VistA Admin Truth Discovery Pack](tenant-admin-vista-admin-truth-discovery-pack.md) — live-verified details

---

## Reading Guide

### Column Definitions

| Column | Definition |
|--------|-----------|
| **ID** | Unique function identifier (`TM-{domain}-{seq}`) |
| **Domain / Package** | VistA package and admin domain from corpus |
| **User Role** | Who performs this in a VistA terminal (IRM, ADPAC, CAC, provider, etc.) |
| **Menu Path** | Known or probable VistA menu/option path |
| **Option Name** | VistA OPTION (File 19) name if known |
| **Purpose** | What the function accomplishes |
| **Truth-Bearing Files** | VistA files read or written |
| **Routines / Globals** | MUMPS routines and globals if evidenced |
| **Existing Read Path** | Known read RPC or DDR query |
| **Existing Write Path** | Known write RPC, DDR FILER, or terminal-only |
| **Existing RPC/API?** | Whether an RPC exists in Vivian/VEHU and any VE* custom equivalent |
| **Browser Terminal Fallback?** | Whether guided-terminal is needed because no safe API write exists |
| **Integration-Plane Dep?** | Whether this crosses into integration-plane territory |
| **Tenant-Admin Relevance** | HIGH / MEDIUM / LOW / DEFERRED |
| **UI Translation Mode** | A–E (see below) |
| **Confidence** | EXT-CONFIRMED / VIVIAN-LOCAL / NEEDS-LIVE-PROOF |
| **Source Ref** | Source manual entry (S1–S12, L1–L3) |
| **Verification Plan** | Terminal → API/RPC → Browser steps |

### UI Translation Modes

| Mode | Label | Definition |
|------|-------|-----------|
| **A** | Live read + live write | Safe RPC-backed read and write from browser |
| **B** | Live read + guided write | RPC-backed reads; writes require guided-terminal workflow with evidence capture |
| **C** | Guided terminal workflow | Both read and write are terminal-backed; browser provides guidance and evidence capture only |
| **D** | Wrapper / adapter project | No existing RPC surface; requires new MUMPS routine or DDR-based adapter before UI |
| **E** | Informational / deferred | Too specialized, risky, or low-value for current scope; document and defer |

---

## Matrix: Users & Access Management

| ID | Domain / Package | User Role | Menu Path | Option Name | Purpose | Truth-Bearing Files | Routines / Globals | Existing Read Path | Existing Write Path | Existing RPC/API? | Browser Terminal Fallback? | Integration-Plane Dep? | Tenant-Admin Relevance | UI Mode | Confidence | Source Ref | Verification Plan |
|----|------------------|-----------|-----------|-------------|---------|--------------------|--------------------|-------------------|--------------------|--------------------|--------------------------|----------------------|----------------------|---------|------------|-----------|-------------------|
| TM-USR-01 | XU Kernel / Users | IRM, ADPAC | EVE → User Management → Add | `XUSERNEW` (probable) | Create new user in File 200 | 200 (NEW PERSON) | `^VA(200,` | `ORWU NEWPERS` (search), `XUS IAM FIND USER` (Vivian) | `XUS IAM ADD USER` (Vivian); `VE USER EDIT` (archive custom) | XUS IAM RPCs: VIVIAN-LOCAL, not VEHU-confirmed. VE USER: archive custom, requires ZVEUSER.m install | Yes — user creation involves many File 200 fields, credential governance, menu/key assignment | No | HIGH | B | VIVIAN-LOCAL | 1. Terminal: create user via roll-and-scroll. 2. RPC: probe `XUS IAM ADD USER` in VEHU. 3. Browser: guided workflow with evidence capture |
| TM-USR-02 | XU Kernel / Users | IRM, ADPAC | EVE → User Management → Edit | `XUSEREDITEXIST` (probable) | Edit existing user record | 200 | `^VA(200,` | `XUS GET USER INFO`, `XUS IAM DISPLAY USER` (Vivian), `VE USER DETAIL` (archive) | `XUS IAM EDIT USER` (Vivian), `VE USER EDIT` (archive) | Similar to TM-USR-01 | Partial — some fields safe for direct edit, others (credentials, keys) need guided flow | No | HIGH | B | VIVIAN-LOCAL | 1. Terminal: edit user fields. 2. RPC: probe XUS IAM EDIT USER. 3. Browser: field-level read + guided write for sensitive fields |
| TM-USR-03 | XU Kernel / Users | IRM | EVE → User Management → List | `XUSERLIST` (probable) | List/search users | 200 | `^VA(200,` | `ORWU NEWPERS` (search by name), `XUS IAM FIND USER` (Vivian), `VE USER LIST` (archive), `DDR LISTER` on File 200 | N/A (read-only) | `ORWU NEWPERS`: VEHU-confirmed. XUS IAM: Vivian. VE USER LIST: archive custom | No | No | HIGH | A | EXT-CONFIRMED | 1. Terminal: user lookup. 2. RPC: call ORWU NEWPERS (confirmed). 3. Browser: display list with search |
| TM-USR-04 | XU Kernel / Users | IRM | EVE → User Management → Deactivate | (part of user edit options) | Deactivate a user account | 200 | `^VA(200,` field: DISUSER | `VE USER DETAIL` (archive), `DDR GETS ENTRY DATA` | `XUS IAM TERMINATE USER` (Vivian), `VE USER DEACTIVATE` (archive) | XUS IAM TERMINATE: Vivian. VE USER DEACTIVATE: archive custom | Yes — deactivation has cascading implications (key removal, menu removal, pending orders) | No | HIGH | B | VIVIAN-LOCAL | 1. Terminal: deactivate user option. 2. RPC: probe XUS IAM TERMINATE USER. 3. Browser: guided deactivation with pre-flight check |
| TM-USR-05 | XU Kernel / Users | IRM | EVE → User Management → Reactivate | (part of user edit options) | Reactivate a terminated user | 200 | `^VA(200,` | Same as TM-USR-04 | `XUS IAM REACTIVATE USER` (Vivian), `VE USER REACTIVATE` (archive) | Vivian + archive custom | Yes — reactivation requires verification of credentials, keys, menu tree | No | MEDIUM | B | VIVIAN-LOCAL | 1. Terminal: reactivate user. 2. RPC: probe. 3. Browser: guided with checklist |
| TM-USR-06 | XU Kernel / Users | Provider, clinician | EVE → Electronic Signature | `XUSESIG` (probable) | Set or change electronic signature code | 200 (ELECTRONIC SIGNATURE CODE field) | `^VA(200,` node 20 | `DDR GETS ENTRY DATA` field .22 (has ES: yes/no indicator) | Terminal-only for signature code entry (ES code is hashed, never exposed via RPC) | No read/write RPC exposes the actual ES code. `XUS EPCS EDIT` exists for EPCS context (Vivian) | Yes — ES code entry is inherently terminal-secured | No | HIGH | C | EXT-CONFIRMED | 1. Terminal: enter/change ES code. 2. RPC: confirm presence indicator only. 3. Browser: guided terminal workflow |
| TM-USR-07 | XU Kernel / Users | User | EVE → Edit Signature Block | `XUSBSEL` (probable) | Edit signature block text (name, title, credentials on signed documents) | 200.01 (SIGNATURE BLOCK subfile) | `^VA(200,` | `DDR GETS ENTRY DATA` field 20.2/20.3/20.4 (sig block fields) | `DDR FILER` on File 200 subfields, or terminal edit | DDR FILER: Vivian. VE USER EDIT: archive custom | Partial — block text is non-sensitive, could be direct write | No | MEDIUM | A or B | VIVIAN-LOCAL | 1. Terminal: edit sig block. 2. RPC: DDR GETS / DDR FILER. 3. Browser: direct edit if DDR FILER safe |
| TM-USR-08 | XU Kernel / Users | IRM | EVE → Provider Classes | `USRCLASS` (probable) | View/manage user class hierarchy | 201 (USER CLASS) | `^USR(201,` | `DDR LISTER` on File 201 | `DDR FILER` on File 201 (risky — cross-references) | DDR only | Probably — class hierarchy manipulation needs care | No | LOW | E | VIVIAN-LOCAL | 1. Terminal: class management. 2. Defer — low priority |

---

## Matrix: Security Keys & Menu Options

| ID | Domain / Package | User Role | Menu Path | Option Name | Purpose | Truth-Bearing Files | Routines / Globals | Existing Read Path | Existing Write Path | Existing RPC/API? | Browser Terminal Fallback? | Integration-Plane Dep? | Tenant-Admin Relevance | UI Mode | Confidence | Source Ref | Verification Plan |
|----|------------------|-----------|-----------|-------------|---------|--------------------|--------------------|-------------------|--------------------|--------------------|--------------------------|----------------------|----------------------|---------|------------|-----------|-------------------|
| TM-KEY-01 | XU Kernel / Keys | IRM | EVE → Key Management → List All | `XUSKEY` (probable) | List security keys defined in system | 19.1 (SECURITY KEY) | `^DIC(19.1,` | `XUS ALLKEYS` (Vivian), `VE KEY LIST` (archive), `DDR LISTER` on File 19.1 | N/A (read-only) | `XUS ALLKEYS`: Vivian. `VE KEY LIST`: archive custom | No | No | HIGH | A | VIVIAN-LOCAL | 1. Terminal: list keys. 2. RPC: probe XUS ALLKEYS. 3. Browser: display key catalog |
| TM-KEY-02 | XU Kernel / Keys | IRM, ADPAC | EVE → Key Management → Assign to User | (part of user edit or key management) | Assign a security key to a user | 200 (KEYS multiple), 19.1 | `^VA(200,` KEYS node | `XUS KEY CHECK` (Vivian), `VE USER DETAIL` → keys held | `XUS SEND KEYS` (Vivian), `VE USER ADD KEY` (archive) | `XUS SEND KEYS`: Vivian. `VE USER ADD KEY`: archive custom | Partial — key assignment is operationally sensitive but technically straightforward | No | HIGH | B | VIVIAN-LOCAL | 1. Terminal: grant key. 2. RPC: probe XUS SEND KEYS. 3. Browser: guided assignment with audit |
| TM-KEY-03 | XU Kernel / Keys | IRM, ADPAC | (part of user edit or key management) | — | Remove a security key from a user | 200 (KEYS multiple) | `^VA(200,` | Same as TM-KEY-02 | `VE USER REMOVE KEY` (archive); no standard Kernel RPC for removal | Archive custom only | Yes — key removal affects user capabilities; needs audit trail | No | HIGH | B | VIVIAN-LOCAL | 1. Terminal: revoke key. 2. RPC: probe archive custom. 3. Browser: guided removal with confirmation |
| TM-KEY-04 | XU Kernel / Keys | IRM | EVE → Key Management → Check User Key | (lookup tool) | Verify whether a user holds a specific key | 200, 19.1 | `^VA(200,` KEYS | `XUS KEY CHECK` (Vivian) | N/A (read-only check) | `XUS KEY CHECK`: Vivian | No | No | MEDIUM | A | VIVIAN-LOCAL | 1. RPC: call XUS KEY CHECK. 2. Browser: quick lookup tool |
| TM-MENU-01 | XU Kernel / Menus | IRM | EVE → Menu Management | `XQMENU` (probable) | View/edit option trees assigned to users | 19 (OPTION), 200 (PRIMARY MENU OPTION) | `^DIC(19,`, `^VA(200,` | `VE MENU LIST` (archive), `DDR LISTER` on File 19 | Terminal-only for menu tree manipulation — complex cross-references | DDR LISTER: Vivian. VE MENU LIST: archive | Yes — menu tree editing is complex with deep cross-references | No | MEDIUM | C | VIVIAN-LOCAL | 1. Terminal: menu management. 2. Read via DDR LISTER. 3. Browser: read-only view, guided terminal for edits |
| TM-MENU-02 | XWB Broker / Contexts | IRM | (part of RPC Broker admin) | `XWBMGMT` (probable) | Manage RPC Broker contexts (which RPCs a GUI app can call) | 8994 (REMOTE PROCEDURE), 19 (OPTION type B) | `^XWB(8994,`, `^DIC(19,` | `XWB RPC LIST` (Vivian), `XWB IS RPC AVAILABLE` (Vivian) | `XWB CREATE CONTEXT` (Vivian) | `XWB RPC LIST`, `XWB IS RPC AVAILABLE`, `XWB CREATE CONTEXT`: all Vivian | No — integration-plane concern, not tenant-admin | Yes — this is integration-plane work | LOW | E | VIVIAN-LOCAL | Defer to integration-plane |

---

## Matrix: Institutions & Divisions

| ID | Domain / Package | User Role | Menu Path | Option Name | Purpose | Truth-Bearing Files | Routines / Globals | Existing Read Path | Existing Write Path | Existing RPC/API? | Browser Terminal Fallback? | Integration-Plane Dep? | Tenant-Admin Relevance | UI Mode | Confidence | Source Ref | Verification Plan |
|----|------------------|-----------|-----------|-------------|---------|--------------------|--------------------|-------------------|--------------------|--------------------|--------------------------|----------------------|----------------------|---------|------------|-----------|-------------------|
| TM-INST-01 | XU Kernel / Institutions | IRM | EVE → Site Management → Institution | `XUSITE` (probable) | View institution record (station number, name, address, parent) | 4 (INSTITUTION) | `^DIC(4,` | `SDEC GET INSTITUTION` (Vivian), `VE INST LIST` (archive), `DDR LISTER` on File 4 | Rarely written — seeded at install time | `SDEC GET INSTITUTION`: Vivian. `VE INST LIST`: archive | No — institutions are essentially read-only in operations | No | HIGH | A | EXT-CONFIRMED | 1. RPC: call SDEC GET INSTITUTION or DDR LISTER. 2. Browser: read-only display |
| TM-INST-02 | DG Registration / Divisions | IRM | EVE → Site Management → Division | `DGDIV` (probable) | View/manage divisions within an institution | 40.8 (MEDICAL CENTER DIVISION) | `^DG(40.8,` | `XUS DIVISION GET` (EXT-CONFIRMED), `SDES GET DIVISION LIST` (Vivian), `VE DIV LIST` (archive) | `DDR FILER` on File 40.8 (risky — affects data routing) | `XUS DIVISION GET`: EXT-CONFIRMED. SDES: Vivian. VE DIV LIST: archive | Yes — division creation/modification is rare and high-impact | No | HIGH | A (read) / C (write) | EXT-CONFIRMED (read) | 1. RPC: call XUS DIVISION GET. 2. Browser: read-only hierarchy + guided write for changes |
| TM-INST-03 | XU Kernel / Services | IRM | EVE → Site Management → Service/Section | `XUSRV` (probable) | Manage service/section assignments | 49 (SERVICE/SECTION) | `^DIC(49,` | `VE SVC LIST` (archive), `DDR LISTER` on File 49 | `VE SVC CREATE`, `VE SVC EDIT` (archive custom), `DDR FILER` | VE SVC: archive custom | Partial — service creation is infrequent | No | MEDIUM | B | VIVIAN-LOCAL | 1. Terminal: manage services. 2. RPC: probe archive custom. 3. Browser: list + guided create |
| TM-INST-04 | XU Kernel / Site Params | IRM | EVE → Site Management → Kernel Parameters | `XUPARAM` (probable) | View/edit kernel system parameters | 8989.3 (KERNEL SYSTEM PARAMETERS) | `^XTV(8989.3,` | `VE SITE PARM` (archive), `DDR GETS ENTRY DATA` | `DDR FILER` on File 8989.3 (risky — system-wide impact) | VE SITE PARM: archive custom | Yes — parameter changes have system-wide impact | No | MEDIUM | B | VIVIAN-LOCAL | 1. Terminal: parameter review. 2. RPC: VE SITE PARM. 3. Browser: read + guided write |

---

## Matrix: Clinics & Scheduling Configuration

| ID | Domain / Package | User Role | Menu Path | Option Name | Purpose | Truth-Bearing Files | Routines / Globals | Existing Read Path | Existing Write Path | Existing RPC/API? | Browser Terminal Fallback? | Integration-Plane Dep? | Tenant-Admin Relevance | UI Mode | Confidence | Source Ref | Verification Plan |
|----|------------------|-----------|-----------|-------------|---------|--------------------|--------------------|-------------------|--------------------|--------------------|--------------------------|----------------------|----------------------|---------|------------|-----------|-------------------|
| TM-CLIN-01 | SD Scheduling / Clinics | ADPAC, CAC | Scheduling → Clinic Setup → List | `SD CLINIC LIST` (probable) | List/search clinics | 44 (HOSPITAL LOCATION) | `^SC(` | `SDES SEARCH CLINIC` (Vivian), `ORWU CLINLOC` (archive confirmed), `VE CLIN LIST` (archive) | N/A (read-only) | `SDES SEARCH CLINIC`: Vivian. `ORWU CLINLOC`: EXT-CONFIRMED. VE CLIN LIST: archive | No | No | HIGH | A | EXT-CONFIRMED | 1. RPC: call ORWU CLINLOC (confirmed) or SDES SEARCH CLINIC. 2. Browser: searchable clinic list |
| TM-CLIN-02 | SD Scheduling / Clinics | ADPAC, CAC | Scheduling → Clinic Setup → Detail | `SD CLINIC DETAIL` (probable) | View clinic detail (stop code, division, service, providers) | 44 | `^SC(` | `SDES GET CLINIC INFO2/INFO3` (Vivian), `VE CLIN DETAIL` (archive) | N/A (read-only) | SDES GET CLINIC INFO: Vivian. VE CLIN DETAIL: archive | No | No | HIGH | A | VIVIAN-LOCAL | 1. RPC: probe SDES GET CLINIC INFO2. 2. Browser: clinic detail view |
| TM-CLIN-03 | SD Scheduling / Clinics | ADPAC, CAC | Scheduling → Clinic Setup → Create | `SD CLINIC CREATE` (probable) | Create new clinic in File 44 | 44 | `^SC(` | N/A | `SDES2 CREATE CLINIC` (Vivian), `VE CLIN CREATE` (archive) | SDES2 CREATE CLINIC: Vivian. VE CLIN CREATE: archive | Partial — clinic creation needs careful validation (stop codes, division, service) | No | HIGH | B | VIVIAN-LOCAL | 1. Terminal: create clinic. 2. RPC: probe SDES2 CREATE CLINIC in VEHU. 3. Browser: guided creation with validated fields |
| TM-CLIN-04 | SD Scheduling / Clinics | ADPAC, CAC | Scheduling → Clinic Setup → Edit | `SD CLINIC EDIT` (probable) | Edit clinic fields (name, stop code, providers, etc.) | 44 | `^SC(` | Same as TM-CLIN-02 | `SDES2 EDIT CLINIC` (Vivian), `VE CLIN EDIT` (archive) | SDES2 EDIT CLINIC: Vivian. VE CLIN EDIT: archive | Partial — some fields safe for direct edit, others (stop codes) need guidance | No | HIGH | B | VIVIAN-LOCAL | 1. Terminal: edit clinic. 2. RPC: probe SDES2 EDIT CLINIC. 3. Browser: field-level guided edit |
| TM-CLIN-05 | SD Scheduling / Clinics | ADPAC | Scheduling → Clinic Setup → Inactivate | `SD CLINIC INACT` (probable) | Mark clinic inactive (ZZ prefix convention) | 44 | `^SC(` | SDES GET CLINIC INFO → check status | `SDES2 INACTIVATE CLINIC` / `SDES INACTIVATE/ZZ CLINIC` (Vivian), `VE CLIN TOGGLE` (archive) | SDES2 INACTIVATE: Vivian. VE CLIN TOGGLE: archive | Yes — inactivation has scheduling implications | No | MEDIUM | B | VIVIAN-LOCAL | 1. Terminal: inactivate clinic. 2. RPC: probe. 3. Browser: guided toggle with impact warning |
| TM-CLIN-06 | SD Scheduling / Clinics | ADPAC | Scheduling → Clinic Setup → Stop Codes | `SD STOP CODE` (probable) | Assign stop codes to clinic | 44, 40.7 (CLINIC STOP) | `^SC(`, `^DIC(40.7,` | `SDEC CLINSTOP` (Vivian), `VE STOP LIST` (archive) | `SDEC CLINSTOP` (Vivian) | SDEC CLINSTOP: Vivian. VE STOP LIST: archive (read) | Partial — stop code assignment is validated but routine | No | MEDIUM | B | VIVIAN-LOCAL | 1. Terminal: assign stop code. 2. RPC: probe SDEC CLINSTOP. 3. Browser: dropdown from list + guided save |
| TM-CLIN-07 | SD Scheduling / Clinics | ADPAC | Scheduling → Clinic Availability | `SD AVAIL` (probable) | Define clinic appointment slot patterns | 44 (AVAILABILITY subfields) | `^SC(` | `SDES GET APPT TYPES` (Vivian), VistA availability grid reads | `SDES2 CREATE CLINIC AVAIL`, `SDES2 EDIT CLINIC AVAILABILITY` (Vivian) | SDES2: Vivian | Partial — availability grid editing is complex | No | MEDIUM | B | VIVIAN-LOCAL | 1. Terminal: set availability. 2. RPC: probe SDES2 AVAIL RPCs. 3. Browser: calendar grid + guided save |
| TM-CLIN-08 | SD Scheduling / Clinics | ADPAC | Scheduling → Clinic Groups | `SD CLIN GRP` (probable) | Create/manage clinic groups for scheduling views | 409.67 (CLINIC GROUP) | `^SD(409.67,` | `SDES READ CLINIC GROUP` (Vivian) | `SDES ADDEDIT CLINIC GRP`, `SDES DELETE CLINIC GROUP` (Vivian) | SDES: Vivian | No — straightforward CRUD | No | LOW | A | VIVIAN-LOCAL | 1. RPC: probe SDES clinic group RPCs. 2. Browser: group management |
| TM-CLIN-09 | SD Scheduling / Resources | ADPAC | Scheduling → Provider Resources | `SD RESOURCE` (probable) | Map providers to clinic resources | SDES internal | — | `SDES GET RESOURCE BY CLINIC` (Vivian) | `SDES2 CREATE/EDIT PROVIDER RESOURCE` (Vivian) | SDES2: Vivian | Partial — affects scheduling capacity | No | MEDIUM | B | VIVIAN-LOCAL | 1. RPC: probe SDES resource RPCs. 2. Browser: resource-to-clinic mapping |
| TM-CLIN-10 | SD Scheduling / PCMM | CAC, ADPAC | Scheduling → PCMM Team Setup | `SCMC TEAM` (probable) | Manage Primary Care Management Module teams | 404.51 (TEAM) | `^SCTM(404.51,` | `SC TEAM LIST`, `SC PRIMARY CARE TEAM` (Vivian) | Terminal-only for team modification | SC TEAM: Vivian (read). No write RPC | Yes — PCMM team management is complex | No | MEDIUM | C | VIVIAN-LOCAL | 1. Terminal: PCMM team admin. 2. RPC: read via SC TEAM LIST. 3. Browser: read-only view + guided terminal for changes |

---

## Matrix: Wards & Room-Bed Configuration

| ID | Domain / Package | User Role | Menu Path | Option Name | Purpose | Truth-Bearing Files | Routines / Globals | Existing Read Path | Existing Write Path | Existing RPC/API? | Browser Terminal Fallback? | Integration-Plane Dep? | Tenant-Admin Relevance | UI Mode | Confidence | Source Ref | Verification Plan |
|----|------------------|-----------|-----------|-------------|---------|--------------------|--------------------|-------------------|--------------------|--------------------|--------------------------|----------------------|----------------------|---------|------------|-----------|-------------------|
| TM-WARD-01 | DG Registration / Wards | IRM, ADPAC | ADT → Ward Definition | `DGWARD` (probable) | List/view wards | 42 (WARD LOCATION) | `^DIC(42,` | `ORQPT WARDS` (EXT-CONFIRMED), `VE WARD LIST` (archive), `DDR LISTER` on File 42 | N/A (read-only list) | `ORQPT WARDS`: VEHU-confirmed live. VE WARD LIST: archive custom | No | No | HIGH | A | EXT-CONFIRMED | 1. RPC: ORQPT WARDS (live). 2. Browser: already wired in archive |
| TM-WARD-02 | DG Registration / Wards | IRM | ADT → Ward Definition → Detail | (part of ward edit) | View ward detail (division, specialty, beds, status) | 42 | `^DIC(42,` | `VE WARD DETAIL` (archive), `DDR GETS ENTRY DATA` | N/A (read-only) | VE WARD DETAIL: archive custom. DDR: Vivian | No | No | MEDIUM | A | VIVIAN-LOCAL | 1. RPC: VE WARD DETAIL or DDR GETS. 2. Browser: ward detail panel |
| TM-WARD-03 | DG Registration / Wards | IRM | ADT → Ward Definition → Edit | (part of ward setup) | Edit ward fields (name, specialty, beds, active status) | 42 | `^DIC(42,` | Same as TM-WARD-02 | `VE WARD EDIT` (archive), `DDR FILER` on File 42 | VE WARD EDIT: archive custom | Yes — ward modification affects ADT routing | No | LOW | B | VIVIAN-LOCAL | 1. Terminal: edit ward. 2. RPC: probe VE WARD EDIT. 3. Browser: guided edit |
| TM-WARD-04 | DG Registration / Room-Beds | IRM | ADT → Room-Bed Setup | `DGBED` (probable) | Define rooms and beds within wards | 405.4 (ROOM-BED) | `^DG(405.4,` | `DDR LISTER` on File 405.4 | `DDR FILER` on File 405.4 (risky — bed assignment is patient-facing) | DDR only | Yes — room-bed changes affect patient placement | No | LOW | C | VIVIAN-LOCAL | 1. Terminal: room-bed setup. 2. DDR reads for listing. 3. Guided terminal for edits |
| TM-WARD-05 | DG Registration / Wards | Clinical, admin | ADT → Ward Census | `DGWPTCEN` (probable) | View current ward census (patients per ward) | 42, 405 (PATIENT MOVEMENT) | `^DIC(42,`, `^DGPM(405,` | `ORQPT WARD PATIENTS` (live in archive), `VE CENSUS` (archive) | N/A (read-only) | `ORQPT WARD PATIENTS`: VEHU-confirmed live | No | No | MEDIUM | A | EXT-CONFIRMED | 1. RPC: ORQPT WARD PATIENTS (live). 2. Browser: census dashboard |

---

## Matrix: Order Entry Configuration

| ID | Domain / Package | User Role | Menu Path | Option Name | Purpose | Truth-Bearing Files | Routines / Globals | Existing Read Path | Existing Write Path | Existing RPC/API? | Browser Terminal Fallback? | Integration-Plane Dep? | Tenant-Admin Relevance | UI Mode | Confidence | Source Ref | Verification Plan |
|----|------------------|-----------|-----------|-------------|---------|--------------------|--------------------|-------------------|--------------------|--------------------|--------------------------|----------------------|----------------------|---------|------------|-----------|-------------------|
| TM-ORD-01 | OR / Order Dialogs | CAC, IRM | CPRS Config → Quick Order Management | `ORCSQO` (probable) | View/manage quick order definitions | 101.41 (ORDER DIALOG) | `^ORD(101.41,` | `ORWDX DLGDEF`, `ORWDX DLGID`, `ORWDX DLGQUIK` (Vivian) | Terminal-only for dialog modification (complex cross-references) | ORWDX DLG*: Vivian read RPCs. No write RPC for dialog edit | Yes — quick order editing is among the most complex VistA admin tasks | No | MEDIUM | C | VIVIAN-LOCAL | 1. Terminal: CPRS configuration. 2. RPC: read dialogs via ORWDX RPCs. 3. Browser: read-only view + guided terminal for edits |
| TM-ORD-02 | OR / Display Groups | CAC | CPRS Config → Display Groups | `ORCSDG` (probable) | Manage order display groups (categories in CPRS tabs) | 100.98 (DISPLAY GROUP) | `^ORD(100.98,` | `ORWDX DGRP` (Vivian) | Terminal-only | ORWDX DGRP: Vivian (read) | Yes — display group changes affect CPRS tab layout | No | LOW | C | VIVIAN-LOCAL | 1. Terminal: display group management. 2. Read via ORWDX DGRP. 3. Defer write to terminal |
| TM-ORD-03 | OR / Parameters | CAC, IRM | CPRS Config → Order Parameters | `ORCSPAR` (probable) | Set order parameters at system/division/user level | 100.99 (ORDER PARAMETERS) | `^ORD(100.99,` | `DDR LISTER` on File 100.99, parameter API | Parameter API writes | DDR: Vivian | Semi — parameter cascade is well-understood but affects all clinicians | No | MEDIUM | B | VIVIAN-LOCAL | 1. Terminal: parameter config. 2. DDR read for current values. 3. Browser: guided parameter edit |
| TM-ORD-04 | OR / Order Checks | CAC | CPRS Config → Order Checks | `ORCSCHK` (probable) | Configure clinical decision support rules | 860 (ORDER CHECK RULE) | `^ORD(860,` | `ORK TRIGGER` (Vivian) | Terminal-only (order check configuration is national + local) | ORK TRIGGER: Vivian (read/check) | Yes — order check rules are safety-critical | No | LOW | E | VIVIAN-LOCAL | Defer — specialized clinical safety domain |

---

## Matrix: Parameters & Site Configuration

| ID | Domain / Package | User Role | Menu Path | Option Name | Purpose | Truth-Bearing Files | Routines / Globals | Existing Read Path | Existing Write Path | Existing RPC/API? | Browser Terminal Fallback? | Integration-Plane Dep? | Tenant-Admin Relevance | UI Mode | Confidence | Source Ref | Verification Plan |
|----|------------------|-----------|-----------|-------------|---------|--------------------|--------------------|-------------------|--------------------|--------------------|--------------------------|----------------------|----------------------|---------|------------|-----------|-------------------|
| TM-PARAM-01 | XT Toolkit / Parameters | IRM | Toolkit → Parameter Management | `XPAR MENU TOOLS` (probable) | View/edit named parameters at various entity levels | 8989.5 (PARAMETERS), 8989.51 (DEFINITION) | `^XTV(8989.5,`, `^XTV(8989.51,` | `VE PARAM LIST` (archive), `DDR LISTER` on File 8989.5/51 | `VE PARAM EDIT` (archive), `DDR FILER` on File 8989.5 | VE PARAM: archive custom. DDR: Vivian | Partial — parameter reads are safe, writes at system level are high-impact | No | MEDIUM | B | VIVIAN-LOCAL | 1. Terminal: parameter review/edit. 2. RPC: VE PARAM LIST. 3. Browser: read + guided write for system-level params |
| TM-PARAM-02 | XWB Broker / Site Config | IRM | Broker Management → Site Parameters | `XWBMGMT` (probable) | View/edit RPC Broker site parameters (port, timeout) | 8994.1 (RPC BROKER SITE PARAMETERS) | `^XWB(8994.1,` | `XWB GET BROKER INFO` (Vivian) | Terminal-only (broker parameters are system-critical) | `XWB GET BROKER INFO`: Vivian | Yes — broker parameter changes can disrupt all RPC connectivity | Yes — integration-plane concern | LOW | E | VIVIAN-LOCAL | Defer to integration-plane |

---

## Matrix: Alerts & Notifications

| ID | Domain / Package | User Role | Menu Path | Option Name | Purpose | Truth-Bearing Files | Routines / Globals | Existing Read Path | Existing Write Path | Existing RPC/API? | Browser Terminal Fallback? | Integration-Plane Dep? | Tenant-Admin Relevance | UI Mode | Confidence | Source Ref | Verification Plan |
|----|------------------|-----------|-----------|-------------|---------|--------------------|--------------------|-------------------|--------------------|--------------------|--------------------------|----------------------|----------------------|---------|------------|-----------|-------------------|
| TM-ALRT-01 | XU Kernel / Alerts | IRM, ADPAC | — | `XQALERT` (probable) | Manage system alert configurations | 8992 (ALERT) | `^XTV(8992,` | `XQAL GUI ALERTS` (Vivian) | Terminal-only for alert configuration | XQAL GUI ALERTS: Vivian (read/manage) | Partial — alert management RPCs exist for GUI | No | LOW | B | VIVIAN-LOCAL | 1. RPC: XQAL GUI ALERTS. 2. Browser: alert list + guided config |
| TM-ALRT-02 | OR / Notifications | IRM, ADPAC | CPRS Config → Notification Setup | `ORB NOTIF` (probable) | Configure CPRS notification routing per user/team/service | 100.9 (OE/RR NOTIFICATIONS) | `^ORD(100.9,` | `ORQ3 LOADALL` (Vivian) | `ORQ3 SAVEALL` (Vivian) | ORQ3 LOADALL/SAVEALL: Vivian | No — direct RPC save exists | No | MEDIUM | A | VIVIAN-LOCAL | 1. RPC: ORQ3 LOADALL for current settings. 2. RPC: ORQ3 SAVEALL to update. 3. Browser: notification config UI |

---

## Matrix: HL7 & Interfaces

| ID | Domain / Package | User Role | Menu Path | Option Name | Purpose | Truth-Bearing Files | Routines / Globals | Existing Read Path | Existing Write Path | Existing RPC/API? | Browser Terminal Fallback? | Integration-Plane Dep? | Tenant-Admin Relevance | UI Mode | Confidence | Source Ref | Verification Plan |
|----|------------------|-----------|-----------|-------------|---------|--------------------|--------------------|-------------------|--------------------|--------------------|--------------------------|----------------------|----------------------|---------|------------|-----------|-------------------|
| TM-HL7-01 | HL / Applications | Interface analyst | HL7 Menu → Application Parameters | `HL MAIN MENU` (probable) | Manage HL7 application parameter entries | 771 (HL7 APPLICATION PARAMETER) | `^HL(771,` | `DDR LISTER` on File 771 (read) | Terminal-only (0 RPCs in HL package) | No RPCs — all terminal | Yes — HL7 is 100% terminal-based admin | Yes — integration-plane | LOW | C | EXT-CONFIRMED | 1. Terminal: HL7 admin. 2. DDR: read-only listing. 3. Browser: informational status only |
| TM-HL7-02 | HL / Link Monitor | Interface analyst | HL7 Menu → Link Monitor | `HL LINK MONITOR` (probable) | Monitor HL7 interface link status and message queues | 771.2 (HL7 INTERFACE) | `^HL(771.2,` | `DDR LISTER` on File 771.2, `ZVEMIOP.m` interop RPCs (archive) | N/A (monitoring only) | Archive ZVEMIOP.m (Phase 21): interop telemetry | No — read-only monitoring | Yes — integration-plane | LOW | E | VIVIAN-LOCAL | Defer — integration-plane telemetry exists in archive |

---

## Matrix: Imaging Admin

| ID | Domain / Package | User Role | Menu Path | Option Name | Purpose | Truth-Bearing Files | Routines / Globals | Existing Read Path | Existing Write Path | Existing RPC/API? | Browser Terminal Fallback? | Integration-Plane Dep? | Tenant-Admin Relevance | UI Mode | Confidence | Source Ref | Verification Plan |
|----|------------------|-----------|-----------|-------------|---------|--------------------|--------------------|-------------------|--------------------|--------------------|--------------------------|----------------------|----------------------|---------|------------|-----------|-------------------|
| TM-IMG-01 | MAG Imaging / Network Locations | Imaging admin | MAG Menu → Network Location Setup | `MAG SYS CONFIG` (probable) | Manage imaging network storage locations | 2005.2 (NETWORK LOCATION) | `^MAG(2005.2,` | MAG config RPCs (Vivian), `DDR LISTER` on File 2005.2 | Terminal + MAG config RPCs | MAG config RPCs: Vivian (528 total, admin subset) | Partial — storage location setup is specialized | Yes — integration-plane | LOW | E | VIVIAN-LOCAL | Defer — specialized imaging infrastructure |
| TM-IMG-02 | MAG Imaging / Devices | Imaging admin | MAG Menu → Acquisition Device Setup | `MAG DEV CONFIG` (probable) | Manage imaging acquisition device registry | 2006.04 (ACQUISITION DEVICE) | `^MAG(2006.04,` | MAG device RPCs, `DDR LISTER` on File 2006.04 | Terminal + MAG device RPCs | MAG device RPCs: Vivian | Partial — device management has existing platform capability (Phase 24) | Yes — integration-plane | LOW | E | VIVIAN-LOCAL | Defer — platform imaging layer already handles this |
| TM-IMG-03 | MAG Imaging / Site Params | Imaging admin | MAG Menu → Imaging Site Parameters | `MAG SITE PARAMS` (probable) | View/edit imaging site-level configuration | 2006.1 (IMAGING SITE PARAMETERS) | `^MAG(2006.1,` | MAG config RPCs | Terminal-only for parameter changes | MAG config RPCs: Vivian | Yes — imaging parameters are specialized | Yes — integration-plane | LOW | E | VIVIAN-LOCAL | Defer — integration-plane |

---

## Matrix: Lab Configuration

| ID | Domain / Package | User Role | Menu Path | Option Name | Purpose | Truth-Bearing Files | Routines / Globals | Existing Read Path | Existing Write Path | Existing RPC/API? | Browser Terminal Fallback? | Integration-Plane Dep? | Tenant-Admin Relevance | UI Mode | Confidence | Source Ref | Verification Plan |
|----|------------------|-----------|-----------|-------------|---------|--------------------|--------------------|-------------------|--------------------|--------------------|--------------------------|----------------------|----------------------|---------|------------|-----------|-------------------|
| TM-LAB-01 | LR Lab / Test Definitions | Lab supervisor | Lab Menu → Lab Test Setup | `LR TEST SETUP` (probable) | View/manage lab test definitions | 60 (LABORATORY TEST) | `^LAB(60,` | `VE LAB TEST LIST` (archive), `DDR LISTER` on File 60 | `VE LAB TEST EDIT` (archive), `DDR FILER` on File 60 | VE LAB: archive custom. DDR: Vivian. No standard LR admin RPCs | Yes — lab test configuration is specialized | No | LOW | E | VIVIAN-LOCAL | Defer — specialized domain |
| TM-LAB-02 | LR Lab / Site Config | Lab supervisor | Lab Menu → Lab Site Setup | `LR SITE CONFIG` (probable) | Configure lab sections, collection, accession | 69.9 (LABORATORY SITE) | `^LAB(69.9,` | `DDR GETS ENTRY DATA` on File 69.9 | Terminal-only | No RPCs — terminal admin | Yes — lab configuration is deep and specialized | No | LOW | E | VIVIAN-LOCAL | Defer — specialized domain |

---

## Matrix: Pharmacy Configuration

| ID | Domain / Package | User Role | Menu Path | Option Name | Purpose | Truth-Bearing Files | Routines / Globals | Existing Read Path | Existing Write Path | Existing RPC/API? | Browser Terminal Fallback? | Integration-Plane Dep? | Tenant-Admin Relevance | UI Mode | Confidence | Source Ref | Verification Plan |
|----|------------------|-----------|-----------|-------------|---------|--------------------|--------------------|-------------------|--------------------|--------------------|--------------------------|----------------------|----------------------|---------|------------|-----------|-------------------|
| TM-PHAR-01 | PS Pharmacy / Drug File | Pharmacy chief | Pharmacy Menu → Drug File Management | `PS DRUG MGMT` (probable) | Manage local drug file entries | 50 (DRUG) | `^PSDRUG(` | `VE DRUG LIST`, `VE DRUG DETAIL` (archive), `DDR LISTER` on File 50 | `VE DRUG EDIT` (archive), `DDR FILER` on File 50 | VE DRUG: archive custom. DDR: Vivian. Drug file is nationally maintained | Yes — drug file is safety-critical and nationally governed | No | LOW | E | EXT-CONFIRMED | Defer — nationally maintained, rarely locally edited |
| TM-PHAR-02 | PS Pharmacy / System Params | Pharmacy chief | Pharmacy Menu → Pharmacy System Parameters | `PS SYS PARAMS` (probable) | Configure pharmacy system parameters (max supply, refills) | 59.7 (PHARMACY SYSTEM) | `^PS(59.7,` | `DDR GETS ENTRY DATA` on File 59.7 | Terminal-only | DDR: Vivian (read). No write RPC | Yes — pharmacy parameter changes are safety-critical | No | LOW | E | VIVIAN-LOCAL | Defer — specialized safety-critical domain |

---

## Matrix: System Management

| ID | Domain / Package | User Role | Menu Path | Option Name | Purpose | Truth-Bearing Files | Routines / Globals | Existing Read Path | Existing Write Path | Existing RPC/API? | Browser Terminal Fallback? | Integration-Plane Dep? | Tenant-Admin Relevance | UI Mode | Confidence | Source Ref | Verification Plan |
|----|------------------|-----------|-----------|-------------|---------|--------------------|--------------------|-------------------|--------------------|--------------------|--------------------------|----------------------|----------------------|---------|------------|-----------|-------------------|
| TM-SYS-01 | XU Kernel / TaskMan | IRM | EVE → TaskMan Management | `XUTM` (probable) | Monitor/manage background tasks | TaskMan internal | `^%ZTSK(` | `VE TASKMAN LIST` (archive), `XULM GET LOCK TABLE` (Vivian) | `XULM KILL PROCESS` (Vivian) | XULM: Vivian. VE TASKMAN LIST: archive | No — read/manage via existing RPCs | Yes — system infrastructure | LOW | E | VIVIAN-LOCAL | Defer — system infrastructure monitoring |
| TM-SYS-02 | XU Kernel / Error Trap | IRM | EVE → Error Trap | `XUERRL` (probable) | View recent MUMPS error trap entries | Error trap globals | `^ZTER(`, `^TMP(` | `VE ERROR TRAP` (archive) | N/A (read-only) | VE ERROR TRAP: archive custom | No | Yes — system infrastructure | LOW | E | VIVIAN-LOCAL | Defer — system infrastructure monitoring |
| TM-SYS-03 | XU Kernel / Devices | IRM | EVE → Device Management | `XUSDEV` (probable) | Manage terminal/printer/device definitions | 3.5 (DEVICE) | `^%ZIS(1,` | `DDR LISTER` on File 3.5 | Terminal-only (device configuration is hardware-tied) | DDR: Vivian (read) | Yes — device setup is hardware-specific | No | LOW | E | EXT-CONFIRMED | Defer — hardware-specific terminal work |

---

## Matrix: FileMan Generic Access

| ID | Domain / Package | User Role | Menu Path | Option Name | Purpose | Truth-Bearing Files | Routines / Globals | Existing Read Path | Existing Write Path | Existing RPC/API? | Browser Terminal Fallback? | Integration-Plane Dep? | Tenant-Admin Relevance | UI Mode | Confidence | Source Ref | Verification Plan |
|----|------------------|-----------|-----------|-------------|---------|--------------------|--------------------|-------------------|--------------------|--------------------|--------------------------|----------------------|----------------------|---------|------------|-----------|-------------------|
| TM-DDR-01 | DI FileMan / Generic Read | IRM, authorized admin | VA FileMan → Inquire | `DIINQUIRE` (probable) | Generic read access to any VistA file via Data Dictionary | Any file | Any global | `DDR LISTER`, `DDR GETS ENTRY DATA`, `DDR FIND1`, `DDR FINDER` (Vivian) | N/A (read-only) | DDR RPCs: Vivian confirmed. 10 DDR RPCs total | No | No | HIGH (as escape hatch) | A | VIVIAN-LOCAL | 1. RPC: call DDR LISTER with target file. 2. Browser: parameterized query tool |
| TM-DDR-02 | DI FileMan / Generic Write | IRM | VA FileMan → Enter/Edit | `DIEDIT` (probable) | Generic write access to any VistA file via DD validation | Any file | Any global | N/A | `DDR FILER` (Vivian) — respects DD validation, input transforms, triggers | DDR FILER: Vivian | Yes — generic writes are powerful but need file/field knowledge | No | MEDIUM (for guided targeted writes) | D | VIVIAN-LOCAL | 1. Terminal: FileMan edit. 2. DDR FILER for targeted writes with DD validation. 3. Browser: only with exact file/field contracts |

---

## Summary: Mode Distribution

| UI Mode | Count | Description |
|---------|-------|-------------|
| **A** — Live read + live write | 11 | User list, key list/check, institution read, division read, clinic list/detail/groups, ward list/census, notification config, DDR read |
| **B** — Live read + guided write | 17 | User create/edit/deactivate/reactivate, sig block edit, key assign/remove, service manage, site params, clinic create/edit/inactivate/stops/availability/resources, ward edit, order params, alert config, parameter edit |
| **C** — Guided terminal workflow | 6 | Electronic signature setup, menu management, PCMM teams, room-bed setup, quick order management, display groups |
| **D** — Wrapper/adapter project | 1 | DDR FILER generic write gateway |
| **E** — Informational/deferred | 14 | User classes, RPC broker config, HL7 admin, imaging admin (3), lab config (2), pharmacy config (2), order checks, system management (3) |

---

## Source Coverage

| Source | Functions Mapped |
|--------|-----------------|
| S1 (Wikipedia VistA) | System overview context |
| S2 (Wikipedia VA Kernel) | User, key, menu, parameter, alert functions |
| S3 (Wikipedia FileMan) | DDR generic access |
| S4–S12 (WorldVistA GitHub) | File/global grounding for all domains |
| L1 (Vivian Index) | RPC availability for all domains |
| L2 (Archive rpcRegistry) | Custom VE* RPC evidence |
| L3 (Archive AGENTS.md VEHU) | Live VEHU RPC confirmation |

---

*Generated: Task 2 of queue pack "VISTA ADMIN CORPUS + TERMINAL-TO-UI TRANSLATION PROGRAM"*
*Research date: 2026-03-21*
