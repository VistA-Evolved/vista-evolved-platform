# VistA Administration Coverage Map

> **Purpose:** Maps every VistA terminal administration function to its tenant-admin UI status.
> Source: VistA Menu Map (9,000+ options), VA VDL documentation, Kernel 8.0 Systems Management Guide.
>
> **Legend:**
> - **DONE** — UI surface exists and communicates with VistA via RPC/DDR
> - **PARTIAL** — UI surface exists but incomplete (missing sub-functions, read-only, etc.)
> - **MISSING** — No UI surface; must use terminal
> - **PLANNED** — Identified for a future slice

---

## 1. Systems Manager Menu [EVE] — Core Administration

### 1.1 User Management [XUSER]

| Terminal Function | Option Name | VistA File | Tenant-Admin Status | Notes |
|---|---|---|---|---|
| Add a New User | XUSERNEW | 200 | **DONE** | POST /users via ZVE USMG ADD |
| Edit an Existing User | XUSEREDIT | 200 | **PARTIAL** | Only 4 contact fields (.132-.151) via DDR FILER. Missing: title, service/section, person class, division, NPI, DEA, SSN, DOB, provider type, primary menu option, secondary menu options. |
| List Users | XUSERLIST | 200 | **DONE** | Via ORWU NEWPERS with search/filter |
| Reactivate a User | XUSERREACT | 200 | **DONE** | POST /users/:duz/reactivate via ZVE USMG REACT |
| Deactivate a User | XUSERDEACT | 200 | **DONE** | POST /users/:duz/deactivate via ZVE USMG DEACT |
| User Inquiry | XUSERINQ | 200 | **PARTIAL** | DDR GETS ENTRY DATA shows raw fields. Missing: formatted display with all 200+ File 200 fields. |
| Switch Identities | XUTESTUSER | 200 | **MISSING** | Dev/test feature, low priority |
| File Access Security | XUFILEACCESS | 200 | **MISSING** | Grant/delete file-level permissions per user. 8 sub-options. |
| Clear Electronic Signature | XUSESIG CLEAR | 200.04 | **MISSING** | Admin ability to clear a user's e-sig code |
| Grant Access by Profile | XUSERBLK | 200 | **MISSING** | Bulk role/menu assignment from templates |
| Electronic Signature Block Edit | XUSESIG BLOCK | 200.02-03 | **MISSING** | Edit initials, printed name, title for a user |
| Person Class Edit | XU-PERSON CLASS EDIT | 200/8932.1 | **MISSING** | VA Person Class taxonomy assignment |
| Manage User File | XUSER FILE MGR | 200 | **MISSING** | Purge inactive attributes, reindex keys |
| Reprint Access Agreement | XUSERREPRINT | 200 | **MISSING** | |

### 1.2 Device Management [XUTIO]

| Terminal Function | Option Name | VistA File | Tenant-Admin Status | Notes |
|---|---|---|---|---|
| Device Edit | XUDEV | 3.5 | **PARTIAL** | DDR LISTER read + DDR FILER add. Missing: full field editing (margin width, page length, subtype, open/close exec, queue). |
| Terminal Type Edit | XUTERM | 3.2 | **MISSING** | Terminal emulation profiles |
| Out of Service Set/Clear | XUOUT | 3.5 | **MISSING** | Mark devices unavailable |
| Display Device Data | XUDISPLAY | 3.5 | **PARTIAL** | List only, no detail view |
| Change Device Terminal Type | XUCHANGE | 3.5 | **MISSING** | |
| List Terminal Types | XULIST | 3.2 | **MISSING** | |
| Send Test Pattern | XUTTEST | 3.5 | **MISSING** | |
| Loopback Test | XUTLOOPBACK | 3.5 | **MISSING** | |
| Hunt Group Manager | XUHGMGR | 3.54 | **MISSING** | Group devices for load balancing |
| Edit Devices by Type | XUDEVEDIT | 3.5 | **MISSING** | Magtape, SDP, Spool, HFS, Network, Resource |
| Line/Port Address | XUDEV LINEPORT | 3.5 | **MISSING** | |

### 1.3 Menu Management [XUMAINT]

| Terminal Function | Option Name | VistA File | Tenant-Admin Status | Notes |
|---|---|---|---|---|
| Edit Options | XUEDITOPT | 19 | **MISSING** | Core option/menu editor |
| Key Management - Allocate | XUKEYALL | 19.1/200 | **DONE** | POST /users/:duz/keys |
| Key Management - De-allocate | XUKEYDEALL | 19.1/200 | **DONE** | DELETE /users/:duz/keys/:key |
| Key Management - Edit Keys | XUKEYEDIT | 19.1 | **MISSING** | Create/edit key definitions |
| Key Management - List Holders | XQSHOKEY | 19.1/200 | **MISSING** | Show all users holding a key |
| Key Management - Show User Keys | XQLISTKEY | 200 | **PARTIAL** | Shown in user detail but not comprehensive |
| Key Management - Delegate | XQKEYDEL | 19.1 | **MISSING** | |
| Restrict Option Availability | XQRESTRICT | 19 | **MISSING** | |
| Build Primary Menu Trees | XQBUILDTREE | 19 | **MISSING** | |
| Option Access By User | XUOPTWHO | 19/200 | **MISSING** | |
| Secure Menu Delegation | XQSMD MGR | 19/200 | **MISSING** | 8 sub-options |
| Out-Of-Order Set Management | XQOOMAIN | 19 | **MISSING** | 7 sub-options |
| Display Menus and Options | XQDISPLAY OPTIONS | 19 | **MISSING** | |

### 1.4 Kernel Site Parameters

| Terminal Function | VistA File | Tenant-Admin Status | Notes |
|---|---|---|---|
| Site Name | 8989.3 .01 | **DONE** | GET/PUT /params/kernel |
| Domain Name | 8989.3 .02 | **DONE** | |
| Default Institution | 8989.3 .03 | **DONE** | |
| Default Auto Menu | 8989.3 .04 | **DONE** | |
| Default Language | 8989.3 .05 | **DONE** | |
| MailMan Site Parameters | 4.3 | **MISSING** | |
| TaskMan Site Parameters | 14.7 | **MISSING** | Background job scheduling |
| RPC Broker Site Parameters | 8994.1 | **MISSING** | |

### 1.5 Programmer Options [XUPROG]

| Terminal Function | Tenant-Admin Status | Notes |
|---|---|---|
| KIDS (Installation/Distribution) | **MISSING** | Package installation — advanced IRM |
| Error Processing | **MISSING** | Error trap display, cleanup |
| Routine Tools | **MISSING** | Index, compare, edit MUMPS routines |
| Programmer Mode | **MISSING** | Direct MUMPS access |

---

## 2. Core Applications [XUCORE] — Department Administration

### 2.1 ADT (Admission/Discharge/Transfer) [DG MANAGER MENU]

| Terminal Function | VistA File | Tenant-Admin Status | Notes |
|---|---|---|---|
| Bed Control (admit/transfer/discharge) | 405 | **MISSING** | 15+ sub-options |
| Registration | 2 | **MISSING** | Patient registration, eligibility |
| Treating Specialty Setup | 45.7 | **MISSING** | |
| Ward Configuration | 42 | **PARTIAL** | Read-only ward list. Missing: edit, bed assignment, specialty. |
| Room-Bed Setup | 405.4 | **MISSING** | |
| Means Test Parameters | | **MISSING** | |
| Patient Type Setup | | **MISSING** | |

### 2.2 Scheduling [SDUSER]

| Terminal Function | VistA File | Tenant-Admin Status | Notes |
|---|---|---|---|
| Clinic Setup | 44 | **PARTIAL** | Add via ZVE CLNM ADD. Missing: availability, providers, stop codes, credit stops, appointment types, letters. |
| Appointment Types | 409.1 | **MISSING** | |
| Clinic Availability Patterns | 44.005 | **MISSING** | Time slots, providers per slot |
| Stop Code Assignment | 40.7 | **MISSING** | DSS identifiers for workload |
| Scheduling Parameters | 44.001 | **MISSING** | |
| Wait List Management | 409.3 | **MISSING** | |
| Appointment Letters | | **MISSING** | |

### 2.3 Pharmacy

| Terminal Function | VistA File | Tenant-Admin Status | Notes |
|---|---|---|---|
| Drug File Maintenance | 50 | **MISSING** | Formulary, drug definitions |
| Dispensing Configuration | 59.7 | **MISSING** | |
| Drug-Drug Interactions | 56 | **MISSING** | |
| Drug-Allergy Interactions | | **MISSING** | |
| Order Check Parameters | | **MISSING** | |
| IV Additives/Solutions | 52.6/52.7 | **MISSING** | |
| BCMA Parameters | | **MISSING** | |
| Controlled Substances | | **MISSING** | |

### 2.4 Laboratory

| Terminal Function | VistA File | Tenant-Admin Status | Notes |
|---|---|---|---|
| Test/Procedure Setup | 60 | **MISSING** | Lab test definitions |
| Collection Sample Setup | 62 | **MISSING** | |
| Specimen Management | 61 | **MISSING** | |
| Accession Area Setup | 68 | **MISSING** | |
| Lab Section Configuration | | **MISSING** | |
| Result Entry Parameters | | **MISSING** | |
| Workload Capture | | **MISSING** | |

### 2.5 Radiology/Imaging

| Terminal Function | VistA File | Tenant-Admin Status | Notes |
|---|---|---|---|
| Procedure/Exam Setup | 71 | **MISSING** | |
| Imaging Location Config | 79.1 | **MISSING** | |
| Contrast Media | | **MISSING** | |
| Report Parameters | | **MISSING** | |
| DICOM Parameters | | **MISSING** | |

### 2.6 Order Entry/Results Reporting (OE/RR)

| Terminal Function | VistA File | Tenant-Admin Status | Notes |
|---|---|---|---|
| Order Dialog Setup | 101.41 | **MISSING** | |
| Quick Orders | 101.41 | **MISSING** | |
| Order Sets | 100.98 | **MISSING** | |
| Order Menus | 101.41 | **MISSING** | |
| Notification Setup | 100.9 | **MISSING** | |
| Team Lists | 100.21 | **MISSING** | |
| Display Groups | 100.98 | **MISSING** | |

### 2.7 Billing (Integrated Billing)

| Terminal Function | VistA File | Tenant-Admin Status | Notes |
|---|---|---|---|
| Rate Schedules | 363.1 | **MISSING** | |
| Charge Items | 363 | **MISSING** | |
| Insurance Company Setup | 36 | **MISSING** | |
| Third-Party Billing | 399 | **MISSING** | |
| Revenue Codes | 399.1 | **MISSING** | |
| MCCR Parameters | | **MISSING** | |

### 2.8 Clinical Documentation (TIU)

| Terminal Function | VistA File | Tenant-Admin Status | Notes |
|---|---|---|---|
| Document Definition Setup | 8925.1 | **MISSING** | Note titles, templates |
| Note Title Setup | 8925.1 | **MISSING** | |
| TIU Parameters | 8925.99 | **MISSING** | |
| Signature Rules | | **MISSING** | Who can sign, co-sign requirements |

### 2.9 Other Departments

| Department | Menu Name | Tenant-Admin Status |
|---|---|---|
| Nursing | NURS-SYS-MGR | **MISSING** — Staffing, assessments, care plans |
| Mental Health | YSUSER | **MISSING** — Instruments, assessments |
| Dietetics | FHMGR | **MISSING** — Diets, food production |
| Surgery | SROMENU | **MISSING** — Scheduling, consent, reports |
| Dental | DENTMANAGER | **MISSING** — Procedures, treatment plans |
| Social Work | SOWK | **MISSING** — Consults, referrals |
| Engineering | ENMGR | **MISSING** — Work orders, equipment |
| Prosthetics | RMPR OFFICIAL | **MISSING** — Devices, fitting |
| Oncology | ONCO #SITE MANAGER MENU | **MISSING** — Cancer registry |
| Quality Management | QAQ MANAGER | **MISSING** — Reviews, indicators |

---

## 3. Infrastructure Administration

### 3.1 HL7/Integration

| Function | Tenant-Admin Status | Notes |
|---|---|---|
| HL7 Application Parameters | **MISSING** | Interface engine config |
| Logical Links | **MISSING** | External system connections |
| Message Routing | **MISSING** | |
| Interface Monitoring | **MISSING** | |

### 3.2 MailMan

| Function | Tenant-Admin Status | Notes |
|---|---|---|
| Mail Groups | **MISSING** | |
| Domain Configuration | **MISSING** | |
| Background Filer | **MISSING** | |

### 3.3 TaskMan (Background Jobs)

| Function | Tenant-Admin Status | Notes |
|---|---|---|
| Schedule/Unschedule Options | **MISSING** | |
| Task Manager Status | **MISSING** | |
| Cleanup Old Tasks | **MISSING** | |

---

## 4. Coverage Summary

| Category | Total Terminal Functions | DONE | PARTIAL | MISSING |
|---|---|---|---|---|
| User Management | 15 | 5 | 2 | 8 |
| Device Management | 15 | 0 | 2 | 13 |
| Menu/Key Management | 18 | 2 | 1 | 15 |
| Kernel Site Parameters | 8 | 5 | 0 | 3 |
| ADT/Registration | 15 | 0 | 1 | 14 |
| Scheduling | 7 | 0 | 1 | 6 |
| Pharmacy | 8 | 0 | 0 | 8 |
| Laboratory | 7 | 0 | 0 | 7 |
| Radiology/Imaging | 5 | 0 | 0 | 5 |
| Order Entry | 7 | 0 | 0 | 7 |
| Billing | 6 | 0 | 0 | 6 |
| Clinical Documentation | 4 | 0 | 0 | 4 |
| Other Departments | 10 | 0 | 0 | 10 |
| Infrastructure | 7 | 0 | 0 | 7 |
| **TOTAL** | **~132 tracked** | **12** | **7** | **~113** |

**Current coverage: ~9% DONE, ~5% PARTIAL, ~86% MISSING**

> Note: This tracks ~132 key admin functions. The full VistA menu system has 9,000+ options.
> Many of those are user-facing (not admin), reports, or rarely-used functions.
> The 132 above represent the core administration that a site operator needs.

---

## 5. Priority Roadmap (New Site Setup Order)

A new VistA site needs these in roughly this order:

### Priority 1 — Day-One Essentials (Current Focus)
1. Kernel site parameters (site name, domain, institution) — **DONE**
2. User management (add, edit, activate, e-sig, credentials) — **PARTIAL**
3. Security key management (assign, remove, list) — **DONE**
4. Division/facility setup — **PARTIAL**
5. Device management (printers, terminals) — **PARTIAL**

### Priority 2 — Clinical Foundation
6. Clinic setup (availability, stop codes, providers)
7. Ward/bed configuration
8. Treating specialties
9. TIU document definitions (note titles, templates)
10. Order entry configuration (quick orders, order sets)

### Priority 3 — Department Configuration
11. Pharmacy (drug file, formulary, dispensing)
12. Lab (tests, collection, accession areas)
13. Radiology (procedures, locations)
14. Scheduling (appointment types, availability patterns)

### Priority 4 — Advanced Administration
15. Menu management (option editing, delegation)
16. File access security
17. HL7 integration
18. TaskMan / background jobs
19. Billing / insurance setup

### Priority 5 — Specialty Departments
20. Nursing, Mental Health, Surgery, Dental, etc.

---

## 6. UI Design Principles (Inspired by FreePBX/VitalPBX)

Large configuration systems like FreePBX handle complexity through:

1. **Grouped navigation** — Categories in sidebar (we have this)
2. **Progressive disclosure** — Show essential fields first, "Advanced" toggle for the rest
3. **Inline help/tooltips** — Explain what each field does and what valid values are
4. **Wizards for first-time setup** — Step-by-step guided configuration
5. **Validation feedback** — Real-time field validation before save
6. **Bulk operations** — Apply profiles/templates to multiple users/devices
7. **Search everywhere** — Global search across all configuration
8. **Audit trail** — Who changed what and when
9. **Import/Export** — CSV import for bulk data entry
10. **Contextual links** — "This clinic needs a stop code" → link to stop code setup

---

## 7. VistA-Specific UI Challenges

1. **FileMan field types** — VistA fields have complex validation (sets of codes, pointers, computed, word-processing). DDR VALIDATOR handles this but the UI must present appropriate input controls.
2. **Cross-file relationships** — A clinic (File 44) points to an institution (File 4), a division (File 40.8), stop codes (File 40.7), etc. The UI needs to resolve these pointers for user-friendly display.
3. **Security context** — Most admin writes require appropriate security keys held by the logged-in user. The UI should check key ownership before showing write controls.
4. **MUMPS-specific data formats** — Internal dates (FileMan format), pointer references (IEN^name), set-of-codes values. All need translation for the UI.
5. **No transaction rollback** — VistA has no ACID transactions. Failed multi-step operations leave partial state. The UI must handle this gracefully.
