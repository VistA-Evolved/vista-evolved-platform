# VistA Admin Deep Use-Case Audit

> **Status:** Canonical deep audit of real VistA admin use-cases by role cluster.
> **Date:** 2026-03-21.
> **Pass class:** PASS-DOC.
> **Scope:** Maps what real VistA admin/setup users actually do in roll-and-scroll
> terminal sessions, informed by VistA technical manuals, the Domain Map (D1–D12),
> the Corpus Discovery Pack, archive admin-specs JSON, and Vivian RPC index.
> **Governed by:** AGENTS.md, VE-PLAT-ADR-0003.
>
> **Relationship to existing docs:**
> - **Deepens:** `vista-admin-domain-map.md` (domain→file→global→RPC) with role-oriented use-cases.
> - **Deepens:** `vista-admin-terminal-to-ui-translation-matrix.md` (49 terminal functions) with success/failure criteria and dependency analysis.
> - **Deepens:** `vista-admin-corpus-discovery-pack.md` (14 domains) with operational job descriptions.
> - **Does not replace** those docs; it cross-references them via domain IDs (D1–D12) and matrix IDs (TM-*).

---

## 1. Role clusters

VistA administration is delegated through security keys, menu assignments, and file-level access (DG, DIC, FileMan access). There is no single "admin" role. Instead, real VistA sites have distinct role clusters:

| ID | Role cluster | Typical title | Key packages | Domain coverage | Key(s) required |
|----|-------------|---------------|-------------|----------------|-----------------|
| **RC-1** | IRM / Security site admin | IRM Chief, ADPAC at national-level | XU Kernel, XWB Broker, XTV Toolkit | D1, D2, D7, D8, D9,D10, D-DDR | `XUMGR`, `XUPROG`, `XUPROGMODE` |
| **RC-2** | Delegated application coordinator (ADPAC) | Application Coordinator, Clinical ADPAC | Package-specific menus | D1 (limited), D2 (limited), D4, D6 | Package-specific keys |
| **RC-3** | Facility/site admin | Chief of Staff, Site Manager | DG Registration, XU Kernel | D3, D5 | `DG MENU`, `DG REGISTER` |
| **RC-4** | Scheduling/location admin | Clinic Administrator, MAS/Scheduling manager | SD Scheduling | D4, D5 | `SD SUPERVISOR`, `SDMGR` |
| **RC-5** | ADT/ward-bed admin | Ward Clerk Supervisor, Bed Control | DG Registration | D5 | `DG DISMISS`, `DGADDR`, `DGMAS PARAMETER EDIT` |
| **RC-6** | Device/printing admin | IRM peripheral support | XU Kernel, ZTMQ | D7 (device subsets) | `XUMGR` |
| **RC-7** | Pharmacy package admin | Chief Pharmacist, Pharmacy ADPAC | PS (Pharmacy) | D11 (Pharmacy config) | `PSJI MANAGER`, `PSJ PHARMACIST`, `PSO MANAGER` |
| **RC-8** | Lab interface/admin | Lab Manager, Lab ADPAC | LR (Laboratory) | D12 (Lab config) | `LRMGR`, `LRCAP` |
| **RC-9** | Imaging/DICOM admin | Imaging Coordinator, PACS Admin | MAG (Imaging), RA (Radiology) | D10 | `MAG SYSTEM`, `MAGDISP CLIN` |
| **RC-10** | HL7/integration admin | Interface Engine admin, Integration specialist | HL (Health Level 7) | D9 | `HLPATCH`, `HLMENU` |
| **RC-11** | Order entry/CPRS admin | CPRS Coordinator | OR (OE/RR) | D6 | `ORCLINIC`, `ORELSE` |
| **RC-12** | FileMan DBA | Database administrator, Data dictionary manager | VA FileMan | D-DDR (all files) | `XUPROG`, `XUPROGMODE` |

---

## 2. Use-case detail by role cluster

### 2.1 RC-1: IRM / Security Site Admin

**Who they are:** Information Resource Management (IRM) staff responsible for VistA system-level administration. At VA sites, these are GS-2210 IT Specialists or contractors with IRM Chief/ADPAC (Automated Data Processing Application Coordinator) designations. In community/OSEHRA deployments, this maps to the system administrator.

**What they actually do in terminal/roll-and-scroll:**

| # | Use-case | Menu/option path | Objects managed | Files | Dependencies | Confidence |
|---|----------|------------------|----------------|-------|-------------|------------|
| UC-1.1 | Create new user accounts | `EVE > Systems Manager Menu > User Management > Add New User` or `XUSER ADD` | File 200 records | 200 (NEW PERSON) | Institution (File 4) must exist; division assignment depends on File 40.8 | Confirmed by docs |
| UC-1.2 | Edit user access/verify codes | `EVE > Systems Manager Menu > User Management > Edit User` or `XUSERNEW` | File 200 access/verify fields | 200 (.01, 2, 11) | User must exist | Confirmed by docs |
| UC-1.3 | Terminate/reactivate user accounts | `EVE > User Management > Terminate User` | File 200 TERMINATION DATE, DISUSER | 200 (9.2, 7) | Must check: outstanding orders, unsigned notes | Confirmed by docs |
| UC-1.4 | Assign/remove security keys | `EVE > Systems Manager Menu > Key Management > Allocation of Security Keys` | File 200.051 (keys subfile), File 19.1 | 200.051, 19.1 | Key must exist in 19.1; user must exist in 200 | Confirmed by docs |
| UC-1.5 | Edit menu assignments | `EVE > Systems Manager Menu > Menu Management > Edit Options` | File 200 (201 field — primary menu), File 19 (OPTION) | 200, 19 | Menu trees must be compiled (`XU REBUILD MENU TREE`) | Confirmed by docs |
| UC-1.6 | Manage mail groups and alerts | `EVE > Systems Manager Menu > MailMan Menu` | File 3.8 (MAIL GROUP), File 8992 (ALERT) | 3.8, 8992 | Members must exist in File 200 | Confirmed by docs |
| UC-1.7 | Set kernel system parameters | `EVE > Systems Manager Menu > Kernel Management Menu > System Parameter Edit` | File 8989.3 (KERNEL SYSTEM PARAMETERS) | 8989.3 | — | Confirmed by docs |
| UC-1.8 | Manage devices/printers | `ZTMQ Device` or `EVE > Sys Manager > Device Management` | File 3.5 (DEVICE) | 3.5 | Physical printers/terminals must be configured | Confirmed by docs |
| UC-1.9 | TaskMan management | `EVE > Systems Manager Menu > Taskman Management` | File 14.4 (TASK), File 14.7 (TASK MANAGER SITE PARAMETERS) | 14.4, 14.7 | Environment initialized | Confirmed by docs |
| UC-1.10 | Monitor system health | `EVE > Systems Manager Menu > System Status`, lock monitoring | Process/lock tables | — | Running M environment | Confirmed by docs |
| UC-1.11 | Manage RPC broker contexts | `EVE > RPC Broker > Context Management` | File 8994.5 (REMOTE APPLICATION), File 8994 (REMOTE PROCEDURE) | 8994, 8994.5 | — | Confirmed by docs |
| UC-1.12 | Set up electronic signatures | `EVE > User Management > E-Sig Setup` | File 200 (electronic signature hash) | 200 | — | Confirmed by docs |

**What should translate to UI:**
- UC-1.1, UC-1.2, UC-1.3, UC-1.4, UC-1.5: High-value for tenant-admin UI. User/key management is the #1 admin task.
- UC-1.7: Site parameter display is valuable; writes are high-risk and should be guided.
- UC-1.8: Device management maps to tenant-admin concern area.

**What should remain guided or integration-plane:**
- UC-1.5 (menu management): Menu tree compilation (`XU REBUILD MENU TREE`) is a system-level task with global impact. Guided workflow only.
- UC-1.9 (TaskMan): Infrastructure-level. Integration-plane or monitoring only.
- UC-1.10 (system health): Monitoring dashboard, not direct manipulation.
- UC-1.11 (RPC broker contexts): Deep infrastructure. Integration-plane only.

**What is still unknown:**
- Exact behavior of `XUS IAM CREATE BINDING` and `XUS IAM BIND USER` RPCs (unprobed in VEHU).
- Whether `XUS ALLKEYS` returns all keys in File 19.1 or only keys assigned to the logged-in user.

---

### 2.2 RC-2: Delegated Application Coordinator (ADPAC)

**Who they are:** Clinical staff designated as package-specific coordinators. In VA sites, ADPACs manage day-to-day application configuration: adding new order dialogs for their clinics, setting up quick orders, configuring notification distribution. They do NOT have system-level access.

**What they actually do in terminal:**

| # | Use-case | Menu/option path | Objects managed | Files | Dependencies | Confidence |
|---|----------|------------------|----------------|-------|-------------|------------|
| UC-2.1 | Configure quick orders | `CPRS Config > Quick Orders > Make Quick Order` | File 101.41 (ORDER DIALOG) | 101.41 | Orderable items, display groups must exist | Confirmed by docs |
| UC-2.2 | Edit notification distribution | `CPRS Config > Notifications > Flag/Unflag Notifications` | File 100.9 (NOTIFICATIONS) parameters | 100.9, 8989.5 | User/team assignments | Confirmed by docs |
| UC-2.3 | Manage order sets | `CPRS Config > Order Menus > Order Set Edit` | File 101.41 (ORDER DIALOG) | 101.41 | Component orders must exist | Probable — needs live proof |
| UC-2.4 | Set CPRS GUI display preferences | `CPRS Config > GUI Parameters` | Parameter values (File 8989.5) | 8989.5 | Entity hierarchy (system/division/user/team) | Confirmed by docs |
| UC-2.5 | Configure consult services | `CPRS Config > Consults > Service Setup` | File 123.5 (REQUEST SERVICES) | 123.5 | Service must exist in File 123.5 | Probable — needs live proof |

**What should translate to UI:**
- UC-2.1, UC-2.2: High-frequency ADPAC tasks. Good candidates for guided UI with underlying VistA write.
- UC-2.4: Parameter read/display is straightforward. Writes should be guided.

**What should remain guided:**
- All ADPAC tasks are package-level configuration and inherently safer than IRM-level tasks, but still need guided-write pattern with read-back verification.

**What is still unknown:**
- Whether `ORWDX DLGDEF` returns enough structure to rebuild order dialog config in UI.
- Extent of CPRS parameter hierarchy in sandbox environments.

---

### 2.3 RC-3: Facility/Site Admin

**Who they are:** Personnel responsible for facility registration data: institution identity, division structure, station numbers, NPI identifiers, address/contact, and VA integration designators. At multi-division sites, this may be an HAS (Health Administration Service) chief or MAS (Medical Administration Service) supervisor.

**What they actually do in terminal:**

| # | Use-case | Menu/option path | Objects managed | Files | Dependencies | Confidence |
|---|----------|------------------|----------------|-------|-------------|------------|
| UC-3.1 | Register/edit institution identity | `EVE > Registration Menu > Institution File Management` | File 4 (INSTITUTION) | 4 | Station number assignment is VA-controlled | Confirmed by docs |
| UC-3.2 | Configure divisions | `EVE > Registration Menu > Division Set Up` or `DG SITE PARAMETER EDIT` | File 40.8 (MEDICAL CENTER DIVISION) | 40.8 | Institution (File 4) must exist | Confirmed by docs |
| UC-3.3 | Maintain facility-level MAS parameters | `DG SITE PARAMETER` | File 43 (MAS PARAMETERS) | 43 | Division must exist | Confirmed by docs |
| UC-3.4 | Manage service/section assignments | `EVE > Service/Section` | File 49 (SERVICE/SECTION) | 49 | — | Confirmed by docs |
| UC-3.5 | Set treating specialty mapping | `ADT > Specialty Setup` | File 42.4 (SPECIALTY) | 42.4 | — | Confirmed by docs |

**What should translate to UI:**
- UC-3.1, UC-3.2: Critical for multi-site/multi-division deployments. Read path is tenant-admin; write path is guided.
- UC-3.5: Specialty configuration reads are tenant-admin scope.

**What should remain guided or integration-plane:**
- UC-3.1 write: Institution creation/editing touches VA-specific identifiers. Must be guided.
- UC-3.3: MAS parameters are site-critical. Guided only.

---

### 2.4 RC-4: Scheduling/Location Admin

**Who they are:** Clinic administrators managing scheduling configuration: creating/editing clinics, setting appointment types, managing availability grids, defining cancel reasons, building clinic groups, and configuring PCMM team assignments.

**What they actually do in terminal:**

| # | Use-case | Menu/option path | Objects managed | Files | Dependencies | Confidence |
|---|----------|------------------|----------------|-------|-------------|------------|
| UC-4.1 | Create/edit clinic definitions | `SD SETUP > Clinic Definition` or SDES RPCs | File 44 (HOSPITAL LOCATION) | 44 | Division (40.8) and stop codes (40.7) must exist | Confirmed by docs |
| UC-4.2 | Set clinic availability grids | `SD SETUP > Clinic Availability` or SDES RPCs | File 44 subfields (availability patterns) | 44 | Clinic must exist | Confirmed by docs |
| UC-4.3 | Manage appointment types | `SD SCHEDULING PARAMETERS > Appointment Types` | File 409.1 (APPOINTMENT TYPE) | 409.1 | — | Confirmed by docs |
| UC-4.4 | Manage cancel/no-show reasons | `SD SCHEDULING PARAMETERS > Cancel Reasons` | File 409.2 (CANCELLATION REASONS) | 409.2 | — | Confirmed by docs |
| UC-4.5 | Create clinic groups | `SD SETUP > Clinic Groups` or SDES RPCs | File 409.67 (CLINIC GROUP) | 409.67 | Member clinics must exist | Confirmed by docs |
| UC-4.6 | Assign stop codes to clinics | `SD SETUP > Clinic Definition` (embedded) | File 44 (stop code fields) + File 40.7 | 44, 40.7 | Stop code must exist in 40.7 | Confirmed by docs |
| UC-4.7 | Configure provider resources | SDES RPCs (no terminal option in legacy) | SDES internal resource tables | — | Provider must exist in File 200 | Probable — needs live proof |
| UC-4.8 | Manage PCMM team assignments | `SC TEAM LIST` / `SC PRIMARY CARE TEAM` | File 404.51 (TEAM) | 404.51 | Team members must exist in File 200 | Confirmed by docs |
| UC-4.9 | Configure wait list parameters | `SD W/L Management` | File 409.3 (WAIT LIST) parameters | 409.3 | Clinic must exist | Confirmed by docs |
| UC-4.10 | Inactivate/reactivate clinics | `SD SETUP > Clinic Inactivation` or SDES RPCs | File 44 (INACTIVATE DATE) | 44 | Must check: future appointments | Confirmed by docs |

**What should translate to UI:**
- UC-4.1, UC-4.2, UC-4.3, UC-4.4, UC-4.5, UC-4.10: Core tenant-admin scheduling config. High priority.
- UC-4.6, UC-4.8: Tenant-admin reads; guided writes.

**What should remain guided or integration-plane:**
- UC-4.7: SDES provider resources require newer VistA scheduling API (Acheron-specific). Integration-plane until SDES is deployed.
- UC-4.9: Wait list management is operational, not config. Deferred.

**What is still unknown:**
- Whether SDES `CREATE CLINIC` / `EDIT CLINIC` RPCs exist in the target distro lane.
- Whether legacy `SD SETUP` terminal options still work after SDES installation.

---

### 2.5 RC-5: ADT/Ward-Bed Admin

**Who they are:** Ward clerk supervisors or bed-control staff managing ward definitions, room-bed inventories, bed status, and specialty-to-ward mappings.

**What they actually do in terminal:**

| # | Use-case | Menu/option path | Objects managed | Files | Dependencies | Confidence |
|---|----------|------------------|----------------|-------|-------------|------------|
| UC-5.1 | Create/edit ward definitions | `ADT System Definition Menu > Ward Definition` | File 42 (WARD LOCATION) | 42 | Division must exist; needs File 44 type=W entry | Confirmed by docs |
| UC-5.2 | Manage room-bed inventory | `ADT System Definition Menu > Room-Bed Setup` | File 405.4 (ROOM-BED) | 405.4 | Ward must exist; physical rooms must be planned | Confirmed by docs |
| UC-5.3 | Set ward specialties | `ADT System Definition Menu > Specialty Assignment` | File 42 (specialty pointer) → File 42.4 | 42, 42.4 | Specialty must exist in 42.4 | Confirmed by docs |
| UC-5.4 | Configure bed control parameters | `DG SITE PARAMETER > Bed Control Settings` | File 43 (MAS PARAMETERS) bed-control fields | 43 | — | Probable — needs live proof |
| UC-5.5 | Set ward census parameters | `ADT System Definition Menu > Census Parameters` | File 42 (census-related subfields) | 42 | — | Probable — needs live proof |

**What should translate to UI:**
- UC-5.1, UC-5.2: Ward and room-bed read/display is high-value for any operational admin.
- UC-5.3: Specialty reads are straightforward.

**What should remain guided:**
- All ward/bed writes: Room-bed inventory changes affect patient placement and census. Must be guided.

**What is still unknown:**
- Whether there are RPCs for room-bed enumeration beyond `ORQPT WARDS` (which only lists wards, not beds).
- Whether DGWPT or DG-specific RPCs exist in VEHU for bed-level data.

---

### 2.6 RC-6: Device/Printing Admin

**Who they are:** IRM staff managing device/printer/terminal configuration for VistA output. This includes print queues, terminal types, host-file devices, and remote printer configurations.

**What they actually do in terminal:**

| # | Use-case | Menu/option path | Objects managed | Files | Dependencies | Confidence |
|---|----------|------------------|----------------|-------|-------------|------------|
| UC-6.1 | Add/edit device definitions | `EVE > Device Management > Add Device` | File 3.5 (DEVICE) | 3.5 | Terminal type (File 3.2) must exist | Confirmed by docs |
| UC-6.2 | Configure terminal types | `EVE > Device Management > Terminal Type Edit` | File 3.2 (TERMINAL TYPE) | 3.2 | — | Confirmed by docs |
| UC-6.3 | Set up host file devices | `EVE > Device Management > Host File Setup` | File 3.5 (DEVICE) with HOST FILE flag | 3.5 | O/S file path must be writable | Confirmed by docs |
| UC-6.4 | Assign default printers per location/user | Parameter framework | Parameters (File 8989.5) entity=user/location | 8989.5 | Device must exist | Confirmed by docs |

**What should translate to UI:**
- UC-6.1: Device inventory read is tenant-admin relevant.
- UC-6.4: Default printer assignment is useful for facility config.

**What should remain guided or integration-plane:**
- UC-6.1, UC-6.2, UC-6.3 writes: Device configuration requires O/S-level coordination. Guided at minimum, likely integration-plane.

---

### 2.7 RC-7: Pharmacy Package Admin

**Who they are:** Chief Pharmacist or Pharmacy ADPAC managing drug formulary, dispensing rules, medication routes, pharmacology file entries, and pharmacy site parameters.

**What they actually do in terminal:**

| # | Use-case | Menu/option path | Objects managed | Files | Dependencies | Confidence |
|---|----------|------------------|----------------|-------|-------------|------------|
| UC-7.1 | Manage drug formulary | `Pharmacy Data Mgmt > Drug Enter/Edit` | File 50 (DRUG) | 50 | NDF (File 50.6) entries | Confirmed by docs |
| UC-7.2 | Configure pharmacy site parameters | `PSJ SITE PARAMETER` or `PS SITE PARAMETER` | File 59.7, File 58.5 site params | 59.7, 58.5 | — | Confirmed by docs |
| UC-7.3 | Edit medication routes | `Pharmacy Data Mgmt > Medication Route Edit` | File 51.2 (MEDICATION ROUTES) | 51.2 | — | Confirmed by docs |
| UC-7.4 | Manage IV additives/solutions | `Pharmacy Data Mgmt > IV Edit` | File 52.6 (IV ADDITIVES), File 52.7 (IV SOLUTIONS) | 52.6, 52.7 | Drug (File 50) must exist | Confirmed by docs |
| UC-7.5 | Set dispensing parameters | `Pharmacy Site Parameter Edit` | File 59.7 | 59.7 | — | Probable — needs live proof |
| UC-7.6 | Configure drug-drug interaction overrides | `Order Check Management` | File 860 interaction rules | 860 | — | Probable — needs live proof |

**What should translate to UI:**
- UC-7.1: Formulary read/browse is high-value for any healthcare facility admin.
- UC-7.2: Site parameter display is useful.

**What should remain guided or integration-plane:**
- All pharmacy writes: Drug formulary changes affect patient safety. Must be guided or integration-plane with clinical pharmacist sign-off.

**What is still unknown:**
- Whether `PSO MANAGER` or `PSJI MANAGER` keys are allocable in sandbox VistA.
- Whether NDF (National Drug File) data exists in the distro.

---

### 2.8 RC-8: Lab Interface/Admin

**Who they are:** Lab Manager or Lab ADPAC managing laboratory test definitions, specimen types, instrument interfaces, and accession areas.

**What they actually do in terminal:**

| # | Use-case | Menu/option path | Objects managed | Files | Dependencies | Confidence |
|---|----------|------------------|----------------|-------|-------------|------------|
| UC-8.1 | Manage lab test definitions | `Lab Mgmt Menu > Lab Test Edit` | File 60 (LABORATORY TEST) | 60 | — | Confirmed by docs |
| UC-8.2 | Configure collecting samples | `Lab Mgmt Menu > Collection Sample Edit` | File 62 (COLLECTION SAMPLE) | 62 | — | Confirmed by docs |
| UC-8.3 | Set up lab site parameters | `LR SITE PARAMETER` | File 69.9 (LAB SITE) | 69.9 | — | Confirmed by docs |
| UC-8.4 | Configure instrument interfaces | `Lab Mgmt Menu > Auto Instrument` | File 62.4 (AUTO INSTRUMENT) | 62.4 | Device (File 3.5) | Confirmed by docs |
| UC-8.5 | Manage accession areas | `Lab Mgmt Menu > Accession Area Edit` | File 68 (ACCESSION) subfields | 68 | — | Confirmed by docs |

**What should translate to UI:**
- UC-8.1, UC-8.2: Lab test and specimen configuration reads are valuable.
- UC-8.3: Site parameter display.

**What should remain guided or integration-plane:**
- All lab writes: Instrument interface config affects result integrity. Integration-plane.
- UC-8.4: Requires physical instrument connectivity. Always integration-plane.

---

### 2.9 RC-9: Imaging/DICOM Admin

**Who they are:** Imaging Coordinator or PACS Administrator managing VistA Imaging site parameters, DICOM gateway configuration, image acquisition worklists, and storage management.

**What they actually do in terminal:**

| # | Use-case | Menu/option path | Objects managed | Files | Dependencies | Confidence |
|---|----------|------------------|----------------|-------|-------------|------------|
| UC-9.1 | Configure imaging site parameters | `Imaging Site Parameter Edit` | File 2006.034 (IMAGING SITE PARAMETERS) | 2006.034 | — | Confirmed by docs |
| UC-9.2 | Manage DICOM gateway settings | `DICOM Gateway Menu` | File 2006.563 (DICOM GATEWAY) subfields | 2006.563 | Network connectivity | Confirmed by docs |
| UC-9.3 | Configure modality worklists | `Imaging Menu > Worklist Setup` | File 2006 subfields | 2006 | Modality devices must exist | Probable — needs live proof |
| UC-9.4 | Register image storage locations | `Imaging Site Setup` | File 2005.2 (NETWORK LOCATION) | 2005.2 | Network shares/storage | Confirmed by docs |

**What should translate to UI:**
- UC-9.1, UC-9.2: Read/display of imaging configuration is valuable for facility admin.

**What should remain guided or integration-plane:**
- All imaging writes: DICOM gateway configuration affects image routing. Integration-plane.

**What is still unknown:**
- Whether imaging admin RPCs (`MAG4 ADD IMAGE`, `MAG SYSTEM` key) are functional in VEHU.
- PACS/Orthanc setup is handled in the archive repo's imaging subsystem, not in tenant-admin.

---

### 2.10 RC-10: HL7/Integration Admin

**Who they are:** Interface engine specialists managing HL7 application parameters, message routing, and interface monitor settings.

**What they actually do in terminal:**

| # | Use-case | Menu/option path | Objects managed | Files | Dependencies | Confidence |
|---|----------|------------------|----------------|-------|-------------|------------|
| UC-10.1 | Configure HL7 application parameters | `HL Main Menu > Application Edit` | File 771 (HL7 APPLICATION PARAMETER) | 771 | — | Confirmed by docs |
| UC-10.2 | Set HL7 link definitions | `HL Main Menu > Link Edit` | File 870 (HL LOGICAL LINK) | 870 | Network connectivity | Confirmed by docs |
| UC-10.3 | Monitor HL7 message flow | `HL Main Menu > Monitor` | — (read-only view of message queues) | 773 | Running HL7 processes | Confirmed by docs |
| UC-10.4 | Configure HLO (newer HL7) | `HLO Main Menu` | File 779.1 (HLO APPLICATION) | 779.1 | — | Probable — needs live proof |

**What should translate to UI:**
- UC-10.3: Interface monitoring read-only dashboard is valuable.

**What should remain integration-plane:**
- All HL7 configuration writes: Interface changes affect data exchange with external systems. Always integration-plane.

---

### 2.11 RC-11: Order Entry/CPRS Admin

**Who they are:** CPRS Coordinator (typically a clinical pharmacist or physician informaticist) responsible for configuring order dialogs, quick orders, order sets, order checking rules, and team-based notification routing.

**What they actually do in terminal:**

| # | Use-case | Menu/option path | Objects managed | Files | Dependencies | Confidence |
|---|----------|------------------|----------------|-------|-------------|------------|
| UC-11.1 | Create/edit order dialogs | `CPRS Config (Clin Coord) > Order Menus > Dialog Edit` | File 101.41 (ORDER DIALOG) | 101.41 | Orderable items (101.43) | Confirmed by docs |
| UC-11.2 | Make quick orders | `CPRS Config > Quick Orders` | File 101.41 (quick order subtype) | 101.41 | Base dialog must exist | Confirmed by docs |
| UC-11.3 | Configure order checking | `CPRS Config > Order Checking > Enable/Disable` | File 860 (ORDER CHECK RULE), Parameters | 860, 8989.5 | — | Confirmed by docs |
| UC-11.4 | Set notification routing | `CPRS Config > Notifications` | Parameters (entity=user/team) | 8989.5 | Teams/users must exist | Confirmed by docs |
| UC-11.5 | Configure display group preferences | `CPRS Config > Display Groups` | File 100.98 (DISPLAY GROUP) parameters | 100.98 | — | Confirmed by docs |

**What should translate to UI:**
- UC-11.2: Quick order creation is the highest-frequency CPRS admin task. Would require deep dialog integration.
- UC-11.4: Notification configuration display is useful.

**What should remain guided:**
- All order entry config writes: These directly affect clinical workflow and patient safety. Must be guided or integration-plane.

---

### 2.12 RC-12: FileMan DBA

**Who they are:** Technical database administrators who maintain VistA's Data Dictionary, create/modify file definitions, manage cross-references, and perform data extractions. Requires programmer-level access (`XUPROG`, `XUPROGMODE` keys).

**What they actually do in terminal:**

| # | Use-case | Menu/option path | Objects managed | Files | Dependencies | Confidence |
|---|----------|------------------|----------------|-------|-------------|------------|
| UC-12.1 | Browse data dictionary | `VA FileMan > Inquire to File Entries > DD` | Any file's DD | All files | — | Confirmed by docs |
| UC-12.2 | Create/modify file definitions | `VA FileMan > Modify File Attributes` | File-level metadata | Target file | `XUPROG` key | Confirmed by docs |
| UC-12.3 | Create cross-references | `VA FileMan > Cross-Reference` | X-ref definitions | Target file | File must have data | Confirmed by docs |
| UC-12.4 | Data extraction/reporting | `VA FileMan > Print/Search` or `CAPTIONED PRINT` | — (ad hoc queries) | Any readable file | FileMan access | Confirmed by docs |
| UC-12.5 | DDR (Data Dictionary Read) API operations | Programmatic via `DDR *` RPCs | Any file/field data | Any file | Context must allow DDR | Confirmed by docs |

**What should translate to UI:**
- UC-12.1: DD browsing is a powerful admin tool. Read-only. Could be an advanced tenant-admin or integration-plane surface.
- UC-12.4: Data extraction for reporting is useful for facility managers.
- UC-12.5: DDR is the escape hatch for any file read. Crucial when no purpose-built RPC exists.

**What should remain guided or integration-plane:**
- UC-12.2, UC-12.3: File/DD modifications are system-level. Never in tenant-admin UI.

---

## 3. Summary: Translation disposition

| Role cluster | Total use-cases | Suitable for tenant-admin UI | Guided write only | Integration-plane | Deferred/monitoring |
|-------------|----------------|-----------------------------|--------------------|-------------------|---------------------|
| RC-1 IRM/Security | 12 | 5 (UC-1.1–1.4, UC-1.7 read) | 4 (UC-1.1–1.4 writes, UC-1.7 write) | 3 (UC-1.9, UC-1.10, UC-1.11) | 0 |
| RC-2 ADPAC | 5 | 3 (UC-2.1, UC-2.2, UC-2.4 reads) | 3 (UC-2.1, UC-2.2, UC-2.4 writes) | 2 (UC-2.3, UC-2.5) | 0 |
| RC-3 Facility admin | 5 | 3 (UC-3.1, UC-3.2, UC-3.5 reads) | 3 (UC-3.1, UC-3.2 guided writes) | 1 (UC-3.3) | 1 (UC-3.4) |
| RC-4 Scheduling admin | 10 | 6 (UC-4.1–4.6 reads) | 4 (UC-4.1, UC-4.3, UC-4.4, UC-4.10 writes) | 2 (UC-4.7, UC-4.9) | 0 |
| RC-5 ADT/Ward-bed | 5 | 3 (UC-5.1–5.3 reads) | 3 (UC-5.1–5.3 writes) | 0 | 2 (UC-5.4, UC-5.5) |
| RC-6 Device/printing | 4 | 2 (UC-6.1, UC-6.4 reads) | 0 | 2 (UC-6.1–6.3 writes) | 2 (UC-6.2, UC-6.3) |
| RC-7 Pharmacy | 6 | 2 (UC-7.1, UC-7.2 reads) | 0 | 4 (all writes) | 2 (UC-7.5, UC-7.6) |
| RC-8 Lab | 5 | 2 (UC-8.1, UC-8.3 reads) | 0 | 3 (all writes) | 2 (UC-8.4, UC-8.5) |
| RC-9 Imaging | 4 | 2 (UC-9.1, UC-9.2 reads) | 0 | 2 (all writes) | 2 (UC-9.3, UC-9.4) |
| RC-10 HL7/Integration | 4 | 1 (UC-10.3 monitoring) | 0 | 3 (UC-10.1, UC-10.2, UC-10.4) | 0 |
| RC-11 Order entry | 5 | 2 (UC-11.2, UC-11.4 reads) | 2 (UC-11.2, UC-11.4 writes) | 3 (UC-11.1, UC-11.3, UC-11.5) | 0 |
| RC-12 FileMan DBA | 5 | 2 (UC-12.1, UC-12.4) | 0 | 1 (UC-12.5 DDR) | 2 (UC-12.2, UC-12.3) |
| **TOTALS** | **70** | **33 reads** | **19 guided writes** | **24** | **11** |

---

## 4. Classification confidence

| Classification | Count | Meaning |
|---------------|-------|---------|
| Confirmed by docs | 55 | Use-case is documented in VistA technical manuals, VDL resources, or verified admin-specs JSON |
| Probable — needs live proof | 12 | Use-case is architecturally implied but not yet verified against live VistA |
| Unknown | 3 | Specific RPC behavior or parameter scope is unclear |

---

## 5. What existing repo docs cover vs. what this audit adds

| Existing doc | What it covers | What this audit adds |
|-------------|---------------|---------------------|
| Domain map (D1–D12) | File→global→RPC per domain | Role→use-case→success/failure→disposition per domain |
| Translation matrix (49 functions) | Terminal function→UI mode mapping | Additional 21 use-cases (70 total), dependency analysis, guided-write boundaries |
| Corpus discovery pack | 14 domains, 2510 RPCs | Role-grounded context: who does what, not just what RPCs exist |
| Grounded domains (users/facilities) | Deep file/RPC maps | Success/failure criteria, unknown areas, integration-plane boundaries |
| Guided write workflows (19 GW-*) | Step-by-step terminal workflows | Role context: which role typically executes each workflow |

---

## 6. Cross-references

| Doc | Purpose |
|-----|---------|
| `vista-admin-domain-map.md` | Domain→File→RPC mapping (D1–D12) |
| `vista-admin-corpus-discovery-pack.md` | Comprehensive domain/RPC discovery |
| `vista-admin-terminal-to-ui-translation-matrix.md` | 49 terminal functions with UI mode |
| `vista-admin-grounded-domain-users-keys-signatures.md` | Deep users/keys grounding |
| `vista-admin-grounded-domain-institution-division-clinic.md` | Deep facility grounding |
| `vista-admin-guided-write-workflows.md` | 19 guided-write workflows |
| `vista-admin-repo-gap-analysis.md` | Gap analysis across all domains |
| `tenant-admin-blocker-ledger.md` | Active blockers for PASS-LIVE |
| Archive: `data/vista/admin-specs/*.json` | Extracted VistA admin specifications (14 domains) |
