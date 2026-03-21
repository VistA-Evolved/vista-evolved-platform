# VistA Administration Coverage Map

> **Purpose:** Single canonical reference mapping every VistA terminal administration function
> to its tenant-admin UI status, with field-level detail, VistA file/RPC, and pass class.
>
> **Source:** VistA Menu Map (9,000+ options), VA VDL documentation, Kernel 8.0 Systems Management Guide.
>
> **Supersedes:** vista-admin-coverage-ledger-and-gap-map.md, vista-admin-terminal-to-ui-translation-matrix-v2.md,
> vista-admin-repo-gap-analysis.md (those are retained as archived reference only).
>
> **Pass Classes:**
> - **PASS-LIVE** — UI surface exists, communicates with VistA, and verified against live Docker
> - **PASS-SHELL** — UI surface exists, backend route wired, but not yet live-verified
> - **PASS-CONTRACT** — API contract defined, screen contract exists, not yet implemented
> - **PASS-DOC** — Documented/planned only
> - **MISSING** — No UI surface; must use terminal
>
> **Coverage: ~150 tracked functions across 7 domains**

---

## Domain 1: USERS AND ACCESS

### 1.1 User Management (File 200 — NEW PERSON)

| ID | Function | Terminal Option | VistA File | RPC/DDR | Pass Class | UI Route | Notes |
|----|----------|----------------|-----------|---------|------------|----------|-------|
| U-01 | Add User | XUSERNEW | 200 | `ZVE USMG ADD` | **PASS-LIVE** | `#/users` | POST /users |
| U-02 | List Users | XUSERLIST | 200 | `ORWU NEWPERS` | **PASS-LIVE** | `#/users` | Search/filter |
| U-03 | User Detail (identity) | XUSERINQ | 200 | `DDR GETS ENTRY DATA` | **PASS-SHELL** | `#/users/:duz` | Fields .01, 4, 5, 9 |
| U-04 | Edit Contact Fields | XUSEREDIT | 200 | `DDR FILER` | **PASS-LIVE** | `#/users/:duz` | Fields .132-.151 |
| U-05 | Edit Provider Credentials | XUSEREDIT | 200 | `DDR FILER` | **MISSING** | `#/users/:duz` | NPI, DEA, Person Class, taxonomy, state license, pharmacy schedules |
| U-06 | Edit Signature Block | XUSESIG BLOCK | 200.02-03 | `DDR FILER` | **MISSING** | `#/users/:duz` | Initials (20.2), printed name (20.3), title |
| U-07 | Set E-Sig Code | — | 200.04 | `ZVE USMG ESIG` | **PASS-LIVE** | `#/users/:duz` | Hashed via `$$EN^XUSHSH` |
| U-08 | Clear E-Sig Code | XUSESIG CLEAR | 200.04 | `DDR FILER` (null) | **MISSING** | `#/users/:duz` | Admin action |
| U-09 | Deactivate User | XUSERDEACT | 200 | `ZVE USMG DEACT` | **PASS-LIVE** | `#/users/:duz` | Sets termination date |
| U-10 | Reactivate User | XUSERREACT | 200 | `ZVE USMG REACT` | **PASS-LIVE** | `#/users/:duz` | Clears termination date |
| U-11 | Reset Credentials | — | 200 | `ZVE USMG CRED` | **PASS-LIVE** | `#/users/:duz` | Access/verify codes |
| U-12 | Edit Menu Assignment | XUSEREDIT | 200 | `DDR FILER` | **MISSING** | `#/users/:duz` | Primary menu (201), secondary menus |
| U-13 | Edit Division | XUSEREDIT | 200 | `DDR FILER` | **MISSING** | `#/users/:duz` | Pointer to File 40.8 |
| U-14 | Edit Service/Section | XUSEREDIT | 200 | `DDR FILER` | **MISSING** | `#/users/:duz` | Pointer to File 49 |
| U-15 | E-Sig Status List | — | 200 | `DDR GETS` batch | **PASS-LIVE** | `#/esig-status` | 118 users with status |
| U-16 | File Access Security | XUFILEACCESS | 200 | `DDR FILER` | **MISSING** | `#/file-access` | Grant/delete file access per user |
| U-17 | Grant Access by Profile | XUSERBLK | 200 | `DDR FILER` bulk | **MISSING** | `#/access-profiles` | Template-based bulk assignment |
| U-18 | Person Class Edit | XU-PERSON CLASS EDIT | 200/8932.1 | `DDR FILER` | **MISSING** | `#/users/:duz` | VA Person Class taxonomy |

### 1.2 Security Key Management (File 19.1 — SECURITY KEY)

| ID | Function | Terminal Option | VistA File | RPC/DDR | Pass Class | UI Route | Notes |
|----|----------|----------------|-----------|---------|------------|----------|-------|
| K-01 | Key Inventory List | — | 19.1 | `DDR LISTER` | **PASS-LIVE** | `#/key-inventory` | 687 keys |
| K-02 | Allocate Key to User | XUKEYALL | 19.1/200 | `ZVE USMG KEYS` ADD | **PASS-LIVE** | `#/users/:duz` | |
| K-03 | De-allocate Key | XUKEYDEALL | 19.1/200 | `ZVE USMG KEYS` DEL | **PASS-LIVE** | `#/users/:duz` | |
| K-04 | List Key Holders | XQSHOKEY | 19.1/200 | `DDR` on 200.051 xref | **MISSING** | `#/keys/:name` | Users holding a specific key |
| K-05 | Create/Edit Key Def | XUKEYEDIT | 19.1 | `DDR FILER` | **MISSING** | `#/keys` | Custom key definitions |
| K-06 | Role Assignment View | — | 19.1 | `DDR LISTER` | **PASS-LIVE** | `#/roles` | Key-to-description mapping |

---

## Domain 2: FACILITIES AND LOCATIONS

### 2.1 Institution/Division (Files 4, 40.8)

| ID | Function | Terminal Option | VistA File | RPC/DDR | Pass Class | UI Route | Notes |
|----|----------|----------------|-----------|---------|------------|----------|-------|
| F-01 | List Facilities | — | 4/40.8 | `XUS DIVISION GET` | **PASS-LIVE** | `#/facilities` | |
| F-02 | Facility Detail | — | 4 | `DDR GETS` | **PASS-SHELL** | `#/facilities/:id` | Read-only |
| F-03 | Edit Institution | DG INSTITUTION EDIT | 4 | `DDR FILER` | **MISSING** | `#/facilities/:id` | Name, address, station#, type |
| F-04 | Topology View | — | 4/40.8 | Computed | **PASS-SHELL** | `#/facilities` | Division→clinic→ward tree |

### 2.2 Clinic Setup (File 44 — HOSPITAL LOCATION)

| ID | Function | Terminal Option | VistA File | RPC/DDR | Pass Class | UI Route | Notes |
|----|----------|----------------|-----------|---------|------------|----------|-------|
| C-01 | List Clinics | — | 44 | `ORWU CLINLOC` | **PASS-LIVE** | `#/clinics` | |
| C-02 | Add Clinic | SDBUILD | 44 | `ZVE CLNM ADD` | **PASS-LIVE** | `#/clinics` | Basic: name only |
| C-03 | Edit Clinic Name | SDBUILD | 44 | `ZVE CLNM EDIT` | **PASS-LIVE** | `#/clinics/:ien` | |
| C-04 | Edit Clinic Basic Fields | SDBUILD | 44 | `DDR FILER` | **MISSING** | `#/clinics/:ien` | Abbrev, service, stop code, credit stop, location, phone, default provider |
| C-05 | Scheduling Config | SDBUILD | 44 | `DDR FILER` | **MISSING** | `#/clinics/:ien` | Appt length (1912), display begin (1914), increments (1917), overbooks (1918), max future (2002) |
| C-06 | Availability Patterns | SDBUILD | 44.005 | `DDR FILER` | **MISSING** | `#/clinics/:ien` | Day-of-week time slots, slots per period, provider assignment |
| C-07 | Letters/Forms Config | SDBUILD | 44 | `DDR FILER` | **MISSING** | `#/clinics/:ien` | No-show, pre-appt, cancellation letters; encounter form |
| C-08 | Advanced Clinic Settings | SDBUILD | 44 | `DDR FILER` | **MISSING** | `#/clinics/:ien` | Prohibit access, require X-ray, check in/out, workload validation |
| C-09 | Inactivate Clinic | SD INACTIVATE | 44 | `DDR FILER` | **MISSING** | `#/clinics/:ien` | |
| C-10 | Reactivate Clinic | SD REACT | 44 | `DDR FILER` | **MISSING** | `#/clinics/:ien` | |

### 2.3 Ward/Bed Configuration (Files 42, 405.4)

| ID | Function | Terminal Option | VistA File | RPC/DDR | Pass Class | UI Route | Notes |
|----|----------|----------------|-----------|---------|------------|----------|-------|
| W-01 | List Wards | — | 42 | `ORQPT WARDS` | **PASS-LIVE** | `#/wards` | |
| W-02 | Edit Ward Name | DG WARD DEFINITION | 42 | `ZVE WRDM EDIT` | **PASS-LIVE** | `#/wards/:ien` | |
| W-03 | Edit Ward Details | DG WARD DEFINITION | 42 | `DDR FILER` | **MISSING** | `#/wards/:ien` | Division, treating specialty, service, authorized beds |
| W-04 | Room-Bed Management | DGPM BED ENTRY/EDIT | 405.4 | `DDR FILER` | **MISSING** | `#/beds` | Add/edit/OOS beds |
| W-05 | Treating Specialty Setup | DG TREATING SETUP | 45.7 | `DDR FILER` | **MISSING** | `#/treating-specialties` | |

### 2.4 Scheduling Configuration

| ID | Function | Terminal Option | VistA File | RPC/DDR | Pass Class | UI Route | Notes |
|----|----------|----------------|-----------|---------|------------|----------|-------|
| S-01 | Appointment Types | — | 409.1 | `DDR LISTER/FILER` | **MISSING** | `#/scheduling/appt-types` | Regular, Follow-up, Walk-in, etc. |
| S-02 | Holidays | SDHOLIDAY | 44.001 | `DDR FILER` | **MISSING** | `#/scheduling/holidays` | |
| S-03 | Scheduling Parameters | SD PARM PARAMETERS | 40.3 | `DDR FILER` | **MISSING** | `#/scheduling/params` | Site-wide scheduling rules |
| S-04 | Stop Codes | — | 40.7 | `DDR LISTER` | **MISSING** | `#/scheduling/stop-codes` | DSS workload identifiers |

---

## Domain 3: DEVICES AND CONNECTIVITY

### 3.1 Device Management (File 3.5 — DEVICE)

| ID | Function | Terminal Option | VistA File | RPC/DDR | Pass Class | UI Route | Notes |
|----|----------|----------------|-----------|---------|------------|----------|-------|
| D-01 | List Devices | — | 3.5 | `DDR LISTER` | **PASS-LIVE** | `#/devices` | |
| D-02 | Add Device | XUDEV | 3.5 | `DDR FILER` ADD | **PASS-LIVE** | `#/devices` | Name only currently |
| D-03 | Edit Device Full | XUDEV | 3.5 | `DDR FILER` | **MISSING** | `#/devices/:ien` | All fields: subtype, IO spec, margins, page length, open/close params |
| D-04 | Mark Out of Service | XUOUT | 3.5 | `DDR FILER` | **MISSING** | `#/devices/:ien` | |
| D-05 | Terminal Type List | XULIST | 3.2 | `DDR LISTER` | **MISSING** | `#/terminal-types` | |
| D-06 | Terminal Type Edit | XUTERM | 3.2 | `DDR FILER` | **MISSING** | `#/terminal-types/:ien` | Open/close exec, margins, page length |

### 3.2 Integration/Connectivity

| ID | Function | Terminal Option | VistA File | RPC/DDR | Pass Class | UI Route | Notes |
|----|----------|----------------|-----------|---------|------------|----------|-------|
| I-01 | HL7 Interface List | — | 870 | `DDR LISTER` | **MISSING** | `#/hl7-interfaces` | Read-only status |
| I-02 | HL7 Interface Detail | — | 870/771 | `DDR GETS` | **MISSING** | `#/hl7-interfaces/:ien` | Message counts, errors |
| I-03 | RPC Broker Status | — | — | Probe | **PASS-LIVE** | `#/vista-tools` | Connection test + DDR probe |

---

## Domain 4: CLINICAL CONFIGURATION

### 4.1 Order Entry (Files 101.41, 100.98)

| ID | Function | Terminal Option | VistA File | RPC/DDR | Pass Class | UI Route | Notes |
|----|----------|----------------|-----------|---------|------------|----------|-------|
| OE-01 | Quick Orders | ORCM QUICK ORDERS | 101.41 | `DDR LISTER/FILER` | **MISSING** | `#/order-config/quick-orders` | Pre-built order templates |
| OE-02 | Order Sets | ORCM ORDER SETS | 101.41 | `DDR LISTER/FILER` | **MISSING** | `#/order-config/order-sets` | Grouped orders |
| OE-03 | Order Menus | ORCM MENU | 101.41 | `DDR LISTER/FILER` | **MISSING** | `#/order-config/menus` | Selection menus |
| OE-04 | Orderable Items | ORCM ORDERABLES | 101.43 | `DDR LISTER/FILER` | **MISSING** | `#/order-config/items` | What can be ordered |
| OE-05 | Order Prompts | ORCM PROMPTS | 101.41 | `DDR LISTER/FILER` | **MISSING** | `#/order-config/prompts` | |
| OE-06 | Notification Setup | ORB NOT MGR MENU | 100.9 | `DDR LISTER/FILER` | **MISSING** | `#/order-config/notifications` | |

### 4.2 Clinical Documentation / TIU (Files 8925, 8925.1)

| ID | Function | Terminal Option | VistA File | RPC/DDR | Pass Class | UI Route | Notes |
|----|----------|----------------|-----------|---------|------------|----------|-------|
| TIU-01 | Document Definitions | TIUF DOCUMENT DEFINITION MGR | 8925.1 | `DDR LISTER/FILER` | **MISSING** | `#/tiu-config/definitions` | Note titles, types |
| TIU-02 | TIU Parameters | TIU BASIC PARAMETER EDIT | 8925.99 | `DDR GETS/FILER` | **MISSING** | `#/tiu-config/params` | Site-wide settings |
| TIU-03 | Print Parameters | TIU PRINT PN LOC/DIV PARAMS | 8925 | `DDR FILER` | **MISSING** | `#/tiu-config/print` | Division/location print settings |
| TIU-04 | Template Management | TIU IRM TEMPLATE MGMT | 8925 | `DDR` | **MISSING** | `#/tiu-config/templates` | Manage/delete user templates |

### 4.3 Pharmacy (Files 50, 51.1, 51.2, 50.606, 59)

| ID | Function | Terminal Option | VistA File | RPC/DDR | Pass Class | UI Route | Notes |
|----|----------|----------------|-----------|---------|------------|----------|-------|
| PH-01 | Drug File | PSS DRUG ENTER/EDIT | 50 | `DDR LISTER/FILER` | **MISSING** | `#/pharmacy-config/drugs` | Formulary |
| PH-02 | Drug Interactions | PSS DRG INTER MANAGEMENT | 56 | `DDR LISTER/FILER` | **MISSING** | `#/pharmacy-config/interactions` | |
| PH-03 | Medication Routes | PSS MEDICATION ROUTES EDIT | 51.2 | `DDR LISTER/FILER` | **MISSING** | `#/pharmacy-config/routes` | |
| PH-04 | Dosage Forms | PSS DOSAGE FORM EDIT | 50.606 | `DDR LISTER/FILER` | **MISSING** | `#/pharmacy-config/dosage-forms` | |
| PH-05 | Standard Schedules | PSS SCHEDULE EDIT | 51.1 | `DDR LISTER/FILER` | **MISSING** | `#/pharmacy-config/schedules` | BID, TID, QID |
| PH-06 | Orderable Items | PSS ORDERABLE ITEM MANAGEMENT | 50.7 | `DDR LISTER/FILER` | **MISSING** | `#/pharmacy-config/orderable` | |
| PH-07 | System Parameters | PSS SYS EDIT | 59 | `DDR GETS/FILER` | **MISSING** | `#/pharmacy-config/params` | |

### 4.4 Laboratory (Files 60, 62, 68, 69)

| ID | Function | Terminal Option | VistA File | RPC/DDR | Pass Class | UI Route | Notes |
|----|----------|----------------|-----------|---------|------------|----------|-------|
| LB-01 | Lab Tests | LRDIEATOMIC/LRDIECOSMIC | 60 | `DDR LISTER/FILER` | **MISSING** | `#/lab-config/tests` | Atomic/cosmic tests |
| LB-02 | Collection Samples | — | 62 | `DDR LISTER/FILER` | **MISSING** | `#/lab-config/collections` | Specimen types |
| LB-03 | Accession Areas | — | 68 | `DDR LISTER/FILER` | **MISSING** | `#/lab-config/accession` | Lab sections |
| LB-04 | Lab Schedules | LRXOSX1 | 69 | `DDR GETS/FILER` | **MISSING** | `#/lab-config/schedules` | |
| LB-05 | Hospital Site Params | LRXOSX2 | — | `DDR GETS/FILER` | **MISSING** | `#/lab-config/site-params` | |
| LB-06 | CPRS Order Params | LR7O ORDER PARAMETERS | — | `DDR FILER` | **MISSING** | `#/lab-config/cprs-params` | |
| LB-07 | Workload Config | LR WKLD STATS ON | — | — | **MISSING** | `#/lab-config/workload` | |

### 4.5 Radiology (Files 71, 79.1)

| ID | Function | Terminal Option | VistA File | RPC/DDR | Pass Class | UI Route | Notes |
|----|----------|----------------|-----------|---------|------------|----------|-------|
| RAD-01 | Procedure Setup | RA PROCEDURE | 71 | `DDR LISTER/FILER` | **MISSING** | `#/radiology-config/procedures` | |
| RAD-02 | Location Parameters | RA SYSLOC | 79.1 | `DDR GETS/FILER` | **MISSING** | `#/radiology-config/locations` | |
| RAD-03 | Division Parameters | RA SYSDIV | — | `DDR GETS/FILER` | **MISSING** | `#/radiology-config/division` | |
| RAD-04 | Diagnostic Codes | RA DIAGEDIT | — | `DDR LISTER/FILER` | **MISSING** | `#/radiology-config/diag-codes` | |

### 4.6 Nursing

| ID | Function | Terminal Option | VistA File | RPC/DDR | Pass Class | UI Route | Notes |
|----|----------|----------------|-----------|---------|------------|----------|-------|
| NUR-01 | Nursing Location Config | NURSFL-LOC | — | `DDR FILER` | **MISSING** | `#/nursing-config/locations` | |
| NUR-02 | Site Parameters | NURSFL-SITE | — | `DDR GETS/FILER` | **MISSING** | `#/nursing-config/params` | |
| NUR-03 | Care Plan Config | NURCFE-CARE | — | `DDR FILER` | **MISSING** | `#/nursing-config/care-plans` | |
| NUR-04 | I/O File Config | NURCPE-I/O-FILE EDIT | — | `DDR FILER` | **MISSING** | `#/nursing-config/io` | Intake/output categories |

### 4.7 Health Summary (File 142)

| ID | Function | Terminal Option | VistA File | RPC/DDR | Pass Class | UI Route | Notes |
|----|----------|----------------|-----------|---------|------------|----------|-------|
| HS-01 | Health Summary Types | GMTS TYPE ENTER/EDIT | 142 | `DDR LISTER/FILER` | **MISSING** | `#/health-summary-config/types` | |
| HS-02 | Components | GMTS IRM/ADPAC COMP EDIT | 142 | `DDR FILER` | **MISSING** | `#/health-summary-config/components` | |
| HS-03 | Site Parameters | GMTS IRM/ADPAC PARAMETER EDIT | 142 | `DDR GETS/FILER` | **MISSING** | `#/health-summary-config/params` | |

---

## Domain 5: BILLING AND INSURANCE

| ID | Function | Terminal Option | VistA File | RPC/DDR | Pass Class | UI Route | Notes |
|----|----------|----------------|-----------|---------|------------|----------|-------|
| BIL-01 | IB Site Parameters | IB EDIT SITE PARAMETERS | — | `DDR GETS/FILER` | **MISSING** | `#/billing/params` | |
| BIL-02 | MCCR Parameters | IB MCCR PARAMETER EDIT | — | `DDR GETS/FILER` | **MISSING** | `#/billing/mccr` | |
| BIL-03 | Billing Rates | IB BILLING RATES FILE | 363.1 | `DDR LISTER/FILER` | **MISSING** | `#/billing/rates` | |
| BIL-04 | Revenue Codes | IB ACTIVATE REVENUE CODES | 399.1 | `DDR LISTER/FILER` | **MISSING** | `#/billing/revenue-codes` | |
| BIL-05 | Insurance Companies | DG INSURANCE COMPANY EDIT | 36 | `DDR LISTER/FILER` | **MISSING** | `#/insurance` | |
| BIL-06 | Encounter Forms | IBDF EDIT ENCOUNTER FORMS | — | `DDR FILER` | **MISSING** | `#/billing/encounter-forms` | |
| BIL-07 | Claims Tracking | IBT EDIT TRACKING PARAMETERS | — | `DDR GETS/FILER` | **MISSING** | `#/billing/claims-tracking` | |

---

## Domain 6: SYSTEM AND PARAMETERS

### 6.1 Kernel Site Parameters (File 8989.3)

| ID | Function | Terminal Option | VistA File | RPC/DDR | Pass Class | UI Route | Notes |
|----|----------|----------------|-----------|---------|------------|----------|-------|
| KP-01 | Site Name | — | 8989.3 (.01) | `DDR GETS/FILER` | **PASS-LIVE** | `#/params/kernel` | |
| KP-02 | Domain Name | — | 8989.3 (.02) | `DDR GETS/FILER` | **PASS-LIVE** | `#/params/kernel` | |
| KP-03 | Default Institution | — | 8989.3 (.03) | `DDR GETS/FILER` | **PASS-LIVE** | `#/params/kernel` | |
| KP-04 | Default Auto Menu | — | 8989.3 (.04) | `DDR GETS/FILER` | **PASS-LIVE** | `#/params/kernel` | |
| KP-05 | Default Language | — | 8989.3 (.05) | `DDR GETS/FILER` | **PASS-LIVE** | `#/params/kernel` | |
| KP-06 | Agency Code | — | 8989.3 | `DDR GETS/FILER` | **MISSING** | `#/params/kernel` | VA, IHS, DoD |
| KP-07 | Production Account | — | 8989.3 | `DDR GETS/FILER` | **MISSING** | `#/params/kernel` | Yes/No |
| KP-08 | Default Timeout | — | 8989.3 | `DDR GETS/FILER` | **MISSING** | `#/params/kernel` | Session timeout |
| KP-09 | Multiple Sign-on | — | 8989.3 | `DDR GETS/FILER` | **MISSING** | `#/params/kernel` | Allow/Disallow |

### 6.2 MailMan (File 4.3)

| ID | Function | Terminal Option | VistA File | RPC/DDR | Pass Class | UI Route | Notes |
|----|----------|----------------|-----------|---------|------------|----------|-------|
| MM-01 | MailMan Site Parameters | XMSITE | 4.3 | `DDR GETS/FILER` | **MISSING** | `#/mailman/params` | |
| MM-02 | Mail Groups | XMEDITPERSGROUP | 3.8 | `DDR LISTER/FILER` | **MISSING** | `#/mailman/groups` | |
| MM-03 | Background Filer Status | XMMGR-CHECK-BACKGROUND-FILER | — | Custom RPC | **MISSING** | `#/mailman/filer` | |
| MM-04 | Queue Management | XMQDISP | — | Custom RPC | **MISSING** | `#/mailman/queues` | |

### 6.3 TaskMan

| ID | Function | Terminal Option | VistA File | RPC/DDR | Pass Class | UI Route | Notes |
|----|----------|----------------|-----------|---------|------------|----------|-------|
| TM-01 | Task Status | — | 14.4 | `DDR LISTER` | **MISSING** | `#/taskman/status` | Running/waiting/error |
| TM-02 | Task Cleanup | — | 14.4 | Custom RPC | **MISSING** | `#/taskman/cleanup` | |

### 6.4 Menu Management (File 19)

| ID | Function | Terminal Option | VistA File | RPC/DDR | Pass Class | UI Route | Notes |
|----|----------|----------------|-----------|---------|------------|----------|-------|
| MN-01 | Option Editor | XUEDITOPT | 19 | `DDR LISTER/GETS/FILER` | **MISSING** | `#/menu-mgmt/options` | |
| MN-02 | Out-of-Order Mgmt | XQOOMAIN | 19 | `DDR FILER` | **MISSING** | `#/menu-mgmt/out-of-order` | |
| MN-03 | Display Menu Trees | XQDISPLAY OPTIONS | 19 | `DDR LISTER` | **MISSING** | `#/menu-mgmt/trees` | Read-only hierarchy |

### 6.5 Error Processing

| ID | Function | Terminal Option | VistA File | RPC/DDR | Pass Class | UI Route | Notes |
|----|----------|----------------|-----------|---------|------------|----------|-------|
| ERR-01 | Error Trap Display | XUERTRAP | — | Custom RPC or DDR | **MISSING** | `#/errors/trap` | Recent MUMPS errors |
| ERR-02 | Error Cleanup | XUERTRP CLEAN | — | Custom RPC | **MISSING** | `#/errors/cleanup` | Purge old errors |

### 6.6 KIDS / Package Status

| ID | Function | Terminal Option | VistA File | RPC/DDR | Pass Class | UI Route | Notes |
|----|----------|----------------|-----------|---------|------------|----------|-------|
| PKG-01 | Installed Packages | — | 9.4 | `DDR LISTER` | **MISSING** | `#/packages` | Read-only list |
| PKG-02 | Patch History | — | 9.7 | `DDR LISTER` | **MISSING** | `#/packages/patches` | Applied patches |

---

## Domain 7: MONITORING AND REPORTS

| ID | Function | Source | Pass Class | UI Route | Notes |
|----|----------|--------|------------|----------|-------|
| MON-01 | VistA Connection Status | Broker probe | **PASS-LIVE** | `#/monitoring/status` | Green/red |
| MON-02 | RPC Capability Check | Capability cache | **PASS-LIVE** | `#/monitoring/status` | N/M available |
| MON-03 | Active User Count | File 200 | **PASS-LIVE** | `#/monitoring/status` | From dashboard |
| MON-04 | Error Trap Count | Error globals | **MISSING** | `#/monitoring/status` | Last 24h |
| MON-05 | TaskMan Status | TaskMan check | **MISSING** | `#/monitoring/status` | Running/stopped |
| MON-06 | MailMan Filer Status | XMMGR | **MISSING** | `#/monitoring/status` | Running/stopped |
| MON-07 | Audit Trail | VistA globals | **MISSING** | `#/monitoring/audit` | Login/config change history |
| MON-08 | Billing Status Report | IB | **MISSING** | `#/monitoring/reports/billing` | Claims status |
| MON-09 | Scheduling Workload | SD | **MISSING** | `#/monitoring/reports/scheduling` | Appointments by clinic |
| MON-10 | Lab Workload | LR | **MISSING** | `#/monitoring/reports/lab` | Tests by area |
| MON-11 | Radiology Workload | RA | **MISSING** | `#/monitoring/reports/radiology` | Exams by type |

---

## Coverage Summary

| Domain | Total | PASS-LIVE | PASS-SHELL | PASS-CONTRACT | MISSING |
|--------|-------|-----------|------------|---------------|---------|
| 1. Users and Access | 24 | 12 | 1 | 0 | 11 |
| 2. Facilities and Locations | 19 | 5 | 2 | 0 | 12 |
| 3. Devices and Connectivity | 9 | 3 | 0 | 0 | 6 |
| 4. Clinical Configuration | 28 | 0 | 0 | 0 | 28 |
| 5. Billing and Insurance | 7 | 0 | 0 | 0 | 7 |
| 6. System and Parameters | 19 | 5 | 0 | 0 | 14 |
| 7. Monitoring and Reports | 11 | 3 | 0 | 0 | 8 |
| **TOTAL** | **117** | **28** | **3** | **0** | **86** |

**Current coverage: ~24% PASS-LIVE, ~2% PASS-SHELL, ~74% MISSING**

---

## Blocker Sync

| Blocker ID | Status | Description | Affects |
|-----------|--------|-------------|---------|
| B-AUTH-001 | Active | No tenant-scoped session auth | All writes |
| B-RPC-001 | Resolved | Bulk key enumeration | K-01 through K-06 |
| B-RPC-002 | Resolved | Bulk e-sig status | U-15 |
| B-RPC-003 | Resolved | Site parameter read path | KP-01 through KP-05 |
| B-PROOF-001 | Resolved | Live proof | All PASS-LIVE items |
| B-WRITE-001 | Resolved | Write path | U-01, U-04, U-07, U-09, U-10, U-11 |
| B-PERSIST-001 | Resolved | Broker restart persistence | All VistA calls |

---

## New Site Setup Priority Order

1. **Day-One**: KP-01..05, U-01..04, U-07, U-09..11, K-01..03, F-01..02, D-01..02
2. **Clinical Foundation**: C-04..08, W-03..05, S-01..04, TIU-01..02, OE-01..03
3. **Department Config**: PH-01..07, LB-01..06, RAD-01..04, NUR-01..04
4. **Advanced Admin**: MN-01..03, U-16..17, I-01..02, TM-01..02, BIL-01..07
5. **Specialty Departments**: HS-01..03, additional department-specific config
