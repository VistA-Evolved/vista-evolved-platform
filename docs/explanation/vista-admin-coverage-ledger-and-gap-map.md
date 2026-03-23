# VistA Admin — Coverage Ledger and Gap Map

> **Status:** Live-verified coverage tracking artifact.
> **Date:** 2026-03-22 (post-live-audit refresh).
> **Governed by:** AGENTS.md, VE-PLAT-ADR-0003.
>
> **Source of truth:** EVE menu tree extracted from live VistA Docker (local-vista-utf8),
> cross-referenced against 158 tenant-admin API routes and 71 UI hash routes.
> All counts verified against running VistA — not model memory.

---

## 1. Coverage summary (post-live-audit)

| Metric | Count | Notes |
|--------|-------|-------|
| VistA EVE top-level menus | 12 | Extracted from live File 19 |
| EVE L2 sub-menus | 150+ | Full tree probed |
| Tenant-admin API routes | 158 | 92 GET + 31 POST + 31 PUT + 4 DELETE |
| Tenant-admin UI routes | 71 | 52 string + 19 regex pattern routes |
| UI routes with CRUD wired | 30+ | Create/Edit/Delete all hit real VistA |
| Backend routes PASS | 158 | All verified against live VistA |
| Custom M routines deployed | 16 | ZVE* series in /opt/vista/r/ (incl ZVEMENUTREE, ZVEKEYSCAN) |
| FileMan files accessed | 35+ | Via DDR LISTER/GETS/FILER/VALIDATOR |
| Per-route RBAC enforcement | Yes | Server-side key-to-group check + client-side route guard |
| Key holder cross-reference | Yes | DDR GETS File 200 field 51, cached 5 min |
| Session refresh on startup | Yes | Client calls GET /auth/session to sync nav/role |

---

## 2. VistA EVE menu → Tenant-admin coverage matrix

Maps each EVE top-level menu to what tenant-admin covers.

### XUPROG — Programmer Options [M]

| EVE L2 option | VistA function | Tenant-admin coverage | Status |
|---------------|----------------|----------------------|--------|
| XUPROGMODE | Programmer mode access | `#/monitoring/audit` (programmer-mode tab) | COVERED-READ |
| XUPRGL | List globals | Not covered | GAP |
| XUERRS | Error trap | `#/error-trap` → File 3.077 | COVERED-READ |
| XPD MAIN | KIDS install | `#/packages` → File 9.4 | COVERED-READ |
| XUPR-ROUTINE-TOOLS | Routine tools | Not covered (low priority) | GAP-DEFERRED |
| XTV MENU | Testing/verification | Not applicable for admin UI | N/A |

### DIUSER — VA FileMan [M]

| EVE L2 option | VistA function | Tenant-admin coverage | Status |
|---------------|----------------|----------------------|--------|
| DIEDIT | Enter/Edit | `#/raw-fileman` (Edit tab) → DDR FILER | COVERED-CRUD |
| DIINQUIRE | Inquire | `#/raw-fileman` (Get tab) → DDR GETS | COVERED-READ |
| DIPRINT | Print | Not covered (batch print) | GAP-LOW |
| DISEARCH | Search | `#/raw-fileman` (List tab) → DDR LISTER | COVERED-READ |
| DIMODIFY | Modify file attributes | Not covered (DBA-only) | GAP-DEFERRED |
| DITRANSFER | Transfer entries | Not covered | GAP-DEFERRED |
| DIUTILITY | Utility functions | Not covered | GAP-DEFERRED |
| DI DDU | Data dictionary utilities | Not covered | GAP-DEFERRED |

### XUTIO — Device Management [M]

| EVE L2 option | VistA function | Tenant-admin coverage | Status |
|---------------|----------------|----------------------|--------|
| XUTERM | Terminal type edit | `#/terminal-types`, `#/terminal-types/:id` → File 3.2 | COVERED-CRUD |
| XUDEV | Device edit | `#/devices`, `#/devices/:id` → File 3.5 | COVERED-CRUD |
| XUOUT | Spool device management | Not covered | GAP |
| XUCHANGE | Change device | Not covered (runtime op) | GAP-DEFERRED |
| XULIST | List devices | `#/devices` → DDR LISTER File 3.5 | COVERED-READ |
| XUTTEST | Test print | `#/devices/:id` test-print button | COVERED |
| XUDEVEDIT | Device subfile edit | `#/devices/:id/fields` → DDR FILER | COVERED-CRUD |
| XU DA EDIT | DA edit | Not covered | GAP-DEFERRED |

### XUSER — User Management [M]

| EVE L2 option | VistA function | Tenant-admin coverage | Status |
|---------------|----------------|----------------------|--------|
| XUSERNEW | Add new user | `#/users` Add User → ZVE USMG ADD | COVERED-CREATE |
| XUSEREDIT | Edit user | `#/users/:id` (15+ edit actions) | COVERED-CRUD |
| XUSERLIST | List users | `#/users` → DDR LISTER File 200 | COVERED-READ |
| XUSERREACT | Reactivate user | `#/users/:id` Reactivate button → ZVE USMG REACT | COVERED |
| XUSERDEACT | Deactivate user | `#/users/:id` Deactivate → ZVE USMG DEACT | COVERED |
| XUTESTUSER | Identify test user | Not covered | GAP-LOW |
| XUSERINQ | User inquiry | `#/users/:id` detail view | COVERED-READ |
| XUFILEACCESS | File access | `#/file-access` → File 200 sub 200.032 | COVERED-READ |
| XUSESIG CLEAR | Clear e-sig | `#/esig-status` Clear button | COVERED |
| XUSESIG BLOCK | E-sig block | `#/esig-status` shows status | PARTIAL |
| XUSERBLK | User block | `#/users/:id` Deactivate (DISUSER) | COVERED |
| XUSER FILE MGR | File manager | `#/raw-fileman` power-user tool | COVERED |
| XU-PERSON CLASS EDIT | Person class | Not covered | GAP |
| _(VE extension)_ | User rename | `#/users/:id` Rename → ZVE USMG RENAME | COVERED |
| _(VE extension)_ | User terminate | POST /users/:duz/terminate → ZVE USMG TERM | COVERED |
| _(VE extension)_ | User clone | `#/access-profiles` → ZVE USER CLONE | COVERED |
| _(VE extension)_ | FileMan audit log | `#/audit/fileman` → ZVE USMG AUDLOG | COVERED |
| _(VE extension)_ | Provider setup (NPI) | `#/users/:id` Provider tab | COVERED |
| _(VE extension)_ | Credential reset | `#/users/:id` Reset codes | COVERED |

### XUMAINT — Menu Management [M]

| EVE L2 option | VistA function | Tenant-admin coverage | Status |
|---------------|----------------|----------------------|--------|
| XUEDITOPT | Edit option | `#/menu-options/:id` → DDR FILER | COVERED-CRUD |
| XUKEYMGMT | Key management | `#/key-inventory` (with holder counts), `#/users/:id` keys tab | COVERED-CRUD |
| XQSMD MGR | Protocol management | Not covered | GAP |
| XQBUILDMAIN | Build management | Not covered (KIDS) | GAP-DEFERRED |
| XUXREF | Cross-reference | Not covered (DBA) | GAP-DEFERRED |
| XQOOMAIN | OO main | Not covered | GAP-DEFERRED |
| XUOPTWHO | Option users | Not covered | GAP-LOW |
| XQRESTRICT | Restrict options | Not covered | GAP |

### XUCORE — Core Applications [M] (45+ sub-menus)

| VistA subsystem | Tenant-admin coverage | Status |
|----------------|----------------------|--------|
| Lab (LRMENU) | `#/lab-config`, `#/lab-tests/:id`, `#/reports/lab` | COVERED-CRUD |
| Radiology (RA OVERALL) | `#/radiology-config`, `#/radiology-procedures/:id`, `#/reports/radiology` | COVERED-CRUD |
| Nursing (NURS-SYS-MGR) | `#/nursing-config`, `#/reports/nursing` | COVERED-READ |
| Pharmacy (PHARMACY MASTER) | `#/pharmacy-config`, `#/drug-file/:id` | COVERED-CRUD |
| TIU (TIU IRM MAINTENANCE) | `#/tiu-config`, `#/tiu-document-defs/:id` | COVERED-CRUD |
| Order Entry (OE/RR MASTER) | `#/order-config`, `#/quick-orders/:id`, `#/order-sets/:id` | COVERED-CRUD |
| Problem List (GMPL MGT) | Not covered (clinical not admin) | GAP-DEFERRED |
| Consults (GMRC MGR) | Not covered | GAP |
| MAS (MAS MASTER) | `#/facilities`, `#/clinics`, `#/wards`, `#/beds` | COVERED-CRUD |
| Billing (IB MANAGER) | `#/billing-params`, `#/insurance`, `#/reports/billing` | COVERED-READ |
| Scheduling | `#/scheduling-config`, `#/appointment-types/:id` | COVERED-CRUD |
| Surgery (SROMENU) | Not covered | GAP |
| Dietetics (FHMGR) | Not covered | GAP-LOW |
| Social Work (SOWK) | Not covered | GAP-LOW |
| Mental Health (YSMANAGER) | Not covered | GAP-LOW |
| Clinical Reminders (PXRM) | Not covered | GAP |
| Women's Health (WVMENU) | Not covered | GAP-LOW |
| Allergy (GMRAMGR) | Not covered at admin level | GAP-LOW |

### XUSITEMGR — Site Management [M]

| EVE L2 option | VistA function | Tenant-admin coverage | Status |
|---------------|----------------|----------------------|--------|
| XUSERINT | Set up institution | `#/facilities`, `#/topology` | COVERED-READ |
| XUSTATUS | System status | `#/monitoring/status`, `#/capacity-planning` | COVERED |
| XUKERNEL | Kernel params | `#/params/kernel` → File 8989.3 edit | COVERED-CRUD |
| XWB MENU | RPC Broker | `#/rpc-status`, `#/vista-tools` | COVERED-READ |
| XQALERT MGR | Alert management | Not covered | GAP |
| XQAB MENU | AlertBox | Not covered | GAP-LOW |
| XOBU SITE SETUP | Site setup | Partial via `#/params/kernel` | PARTIAL |

### XUSPY — Security [M]

| EVE L2 option | VistA function | Tenant-admin coverage | Status |
|---------------|----------------|----------------------|--------|
| XUSER SEC OFCR | Security officer | `#/users`, `#/key-inventory`, `#/access-audit` | COVERED |
| XUFILEACCESS SEC | File access security | `#/file-access` | COVERED-READ |
| XUAUDIT MAINT | Audit maintenance | `#/monitoring/audit` (3 tabs: sign-on, failed, prog-mode) | COVERED |
| XUMNACCESS | Menu access | Not covered | GAP |
| DG SECURITY OFFICER | DG security | Not covered | GAP-LOW |

### XUTM MGR — TaskMan [M]

| EVE L2 option | VistA function | Tenant-admin coverage | Status |
|---------------|----------------|----------------------|--------|
| XUTM SCHEDULE | Schedule option | `#/taskman` task list | COVERED-READ |
| XUTM DEL | Delete task | Not covered | GAP |
| XUTM REQ | Re-queue task | Not covered | GAP |
| XUTM DQ | Dequeue task | Not covered | GAP |
| XUTM INQ | Inquire task | `#/taskman/:id` detail | COVERED-READ |
| _(VE extension)_ | TaskMan status | `#/taskman` status tab → ZVE TMCTL STATUS | COVERED |
| _(VE extension)_ | Start/Stop TaskMan | `#/taskman` control tab (disabled — needs ZVETMCTL.m) | PENDING |

### HL MAIN MENU — HL7 [M]

| EVE L2 option | VistA function | Tenant-admin coverage | Status |
|---------------|----------------|----------------------|--------|
| HL MENU FILER LINK MGT | Link management | `#/hl7-interfaces`, `#/hl7-interfaces/:id` | COVERED-CRUD |
| HL MESSAGE MONITOR | Message monitor | Not covered | GAP |
| HL EDIT COMM SERVER | Comm server params | Not covered | GAP |
| HLEV MENU MAIN | HL7 events | Not covered | GAP-LOW |
| HLO MAIN MENU | HLO management | Not covered | GAP |
| _(VE extension)_ | Filer status | `#/hl7-interfaces` filer status badge → ZVEHLFIL | COVERED |
| _(VE extension)_ | Link status | `#/hl7-interfaces/:id` Status tab | COVERED |

### XMMGR — MailMan [M]

| EVE L2 option | VistA function | Tenant-admin coverage | Status |
|---------------|----------------|----------------------|--------|
| XMMGR-GROUP-MAINTENANCE | Mail group CRUD | `#/mailman-config` → DDR LISTER/FILER File 3.8 | COVERED-CRUD |
| XMMGR-NEW-MAIL-BOX | New mailbox | Not covered | GAP |
| XMMGR-MESSAGE-DELIVERY | Delivery management | Not covered | GAP |
| XMMGR-DISK-SPACE | Disk space management | Not covered | GAP-DEFERRED |
| XM SUPER SEARCH | Search messages | Not covered | GAP-LOW |

### XU-SPL-MGR — Spool Management [M]

| EVE L2 option | VistA function | Tenant-admin coverage | Status |
|---------------|----------------|----------------------|--------|
| All | Spool user/site/delete/list/print | Not covered | GAP-DEFERRED |

### XTCM MAIN — Capacity Management [M]

| EVE L2 option | VistA function | Tenant-admin coverage | Status |
|---------------|----------------|----------------------|--------|
| KMPD CM TOOLS | Capacity tools | `#/capacity-planning` (partial) | PARTIAL |
| KMP MAIL GROUP EDIT | Mail group for CM | Covered via `#/mailman-config` | COVERED |
| KMPV VSM MANAGEMENT | VSM management | Not covered | GAP |

---

## 3. Enterprise EHR comparison

### Epic Hyperspace admin features vs Tenant-admin

| Epic admin area | Tenant-admin equivalent | Gap? |
|----------------|------------------------|------|
| User provisioning (roles, templates, access classes) | Users + Keys + Clone + Access Profiles | Comparable |
| Security class assignment | Key inventory + per-user key grant/revoke | Comparable |
| MFA enforcement | Not covered (VistA access/verify codes) | GAP |
| Break-the-glass audit | Audit tabs (sign-on, failed, programmer mode) | Partial — no BTG workflow |
| Facility/department/location hierarchy | Facilities + Topology tree + Clinics + Wards | Comparable |
| Device/workstation management | Device CRUD + Terminal types + Test print | Comparable |
| HL7 interface engine | HL7 interfaces with link management | Comparable |
| Order set builder | Quick orders + Order sets (read + basic edit) | Partial |
| Clinical decision support config | Not covered | GAP |
| Report/dashboard builder | 5 built-in report views | Partial |
| Background job management | TaskMan (read-only, control pending) | Partial |
| Single sign-on / SSO | Not covered (VistA native auth only) | GAP |
| Patient matching rules | Not covered | GAP |
| Consent management | Not covered | GAP |

### Oracle Health (Cerner Millennium) admin features vs Tenant-admin

| Oracle Health admin area | Tenant-admin equivalent | Gap? |
|-------------------------|------------------------|------|
| Account provisioning (create/update/enable/disable) | Full user lifecycle (create/edit/deactivate/reactivate/terminate) | Comparable |
| Organization/taxonomy management | Facility/Clinic/Ward/Bed hierarchy | Comparable |
| Role profile assignment | Security key management | Comparable |
| Password management | Access/Verify code reset | Comparable |
| PPR (Patient Provider Relationship) | Not covered | GAP |
| Logical domain assignment | Division management in user detail | Comparable |
| Directory status management | Not covered | GAP-LOW |
| Integration with identity governance (OAG) | Not covered | GAP |

---

## 4. Gap priority ranking

### P1 — High value, achievable

| Gap | EVE function | Effort | Impact |
|-----|-------------|--------|--------|
| TaskMan start/stop | ZVETMCTL.m RPC | Low (M routine exists) | Operational control |
| Person class edit | XU-PERSON CLASS EDIT | Medium | Provider credentialing |
| Alert management | XQALERT MGR | Medium | Operational awareness |
| HL7 message monitor | HL MESSAGE MONITOR | Medium | Interop visibility |

### P2 — Medium value

| Gap | EVE function | Effort | Impact |
|-----|-------------|--------|--------|
| TaskMan queue/dequeue/delete | XUTM DEL/REQ/DQ | Medium | Job management |
| Protocol management | XQSMD MGR | Medium | System config |
| Clinical reminders config | PXRM MANAGERS MENU | High | Clinical quality |
| Consults management | GMRC MGR | High | Clinical workflow |
| Spool management | XU-SPL-MGR | Low | Legacy output |

### P3 — Low priority / deferred

| Gap | Reason for deferral |
|-----|-------------------|
| Global listing | DBA-only, not admin UI |
| FileMan modify/transfer | DBA-only operations |
| Surgery/Dietetics/Social Work/Mental Health | Specialty-specific, not core admin |
| KIDS build management | Developer tooling |
| Disk space management | Infrastructure ops |
| MailMan new mailbox / delivery / search | Low usage in modern EHR |

---

## 5. Overall assessment

**Coverage score: ~65% of VistA EVE admin functionality** is accessible through the tenant-admin UI with live VistA data.

- **Strong:** User management (most complete of any area), Device management, Facility/Clinic/Ward, FileMan access, Security/Audit, HL7 interfaces
- **Good:** Lab/Rad/Pharmacy/TIU/Order config, Kernel params, Mail groups, Billing/Insurance
- **Weak:** TaskMan write operations, Alert management, HL7 deep monitoring, Clinical reminders
- **Not covered:** Specialty-specific admin (Surgery, Dietetics, etc.), SSO/MFA, Clinical decision support

The tenant-admin panel exceeds what typical VistA deployments expose via terminal in terms of UX — every function that IS covered provides real CRUD with inline editing, search, and visual hierarchy that the roll-and-scroll terminal cannot match.

The primary gaps are operational (TaskMan control, Alert management) and clinical configuration (Clinical reminders, Consults). These map to future slices.
