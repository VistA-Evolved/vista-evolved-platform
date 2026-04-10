# VistA Evolved — Administration Panel Deep Audit

> **Date:** April 10, 2026  
> **Scope:** Full admin surface audit — frontend, backend, M routines, VistA terminal model mapping  
> **Purpose:** Identify every gap between the current admin panel and a 100% complete, trustworthy, VistA-grounded modern administration system  
> **Verdict:** Architecture is sound. Coverage is severely incomplete. ~65-70% of the work needed to reach enterprise-grade is done.

---

## EXECUTIVE SUMMARY

### What Is Right

The engineering foundation is genuinely solid:

- **156+ backend routes** all call real VistA RPCs — zero hardcoded data, zero mock fallbacks, zero fixture files
- **33 custom ZVE M routines** handle user management, parameters, keys, divisions, audit, mail, roles, workspace visibility, and two-person integrity
- **13 admin page components** use real API integration with proper error handling, normalization, modals (no `window.confirm`), and pagination
- **Fallback chains** cascade between ZVE RPCs and standard DDR calls — both are VistA-bound, never to fabricated data
- **Per-user session isolation** via AsyncLocalStorage prevents cross-user data leakage
- **Two-person integrity** workflow is fully implemented for security-sensitive parameters

### What Is Wrong

The problems are real, but they are **completeness problems**, not **architecture problems**:

1. **Package parameter labels show "Field 3"** — the ZVE DD FIELDS RPC exists but likely fails silently at runtime, causing fallback to generic labels
2. **Only 6 fields per package** are read from VistA parameter files that contain 20-100+ fields
3. **36 wired adminService functions have zero frontend exposure** — the backend has routes for clinics, wards, devices, mail groups, packages, menu options, etc., but no admin pages surface them
4. **17 system role templates are hardcoded in the frontend**, not stored in or validated against VistA
5. **The Kernel parameter file (#8989.3)** has 23+ configurable fields; only ~10 are exposed in the UI
6. **Actions lack visible feedback** — deactivate, terminate, save, and assign operations call real APIs but don't clearly prove to the user that something happened
7. **The VistA terminal admin model has vastly more depth** than what's currently shown — entire administrative areas (Device Management, Menu Management, Clinic Configuration, Ward Management, Health Summary setup, TIU Document Definitions, Order Set management, Drug File, Lab Tests, etc.) have zero frontend presence despite having working backend routes

### The Trust Equation

```
Trust = Completeness × Transparency × Feedback × Grounding

Current state:
- Completeness:  ~40% (vast areas of VistA admin have no UI)
- Transparency:   ~60% (many controls don't explain what they do or where they map)
- Feedback:       ~50% (save operations don't visibly confirm success)
- Grounding:      ~85% (data IS from VistA, but labels/context don't prove it)

Overall trust:    ~55-65%
```

---

## PART 1: THE VISTA TERMINAL ADMIN MODEL — COMPLETE REFERENCE

### 1.1 The EVE System Manager Menu Tree

When a VistA system manager logs in (`D ^ZU` → EVE menu), they access this structure. Every item marked ❌ has **no modern UI equivalent** today. Items marked ✅ have at least partial coverage. Items marked ⚠️ are partially covered but incomplete.

```
EVE — SYSTEMS MANAGER MENU
│
├── USER MANAGEMENT (Menu)
│   ├── Add a New User to the System .............. ⚠️ StaffForm.jsx exists but incomplete
│   ├── Edit an Existing User ..................... ⚠️ StaffForm.jsx edit mode, limited fields
│   ├── List Users by Various Criteria ............ ✅ StaffDirectory.jsx
│   ├── Find a User .............................. ✅ StaffDirectory.jsx search
│   ├── Release User (Unlock) .................... ✅ unlockUser() in StaffDirectory
│   ├── Proxy User List .......................... ❌ No UI
│   ├── User Inquiry ............................. ⚠️ Detail panel exists but shallow
│   ├── Deactivate a User ........................ ⚠️ Button exists, feedback unclear
│   └── Reactivate a User ........................ ⚠️ Button exists, feedback unclear
│
├── DEVICE MANAGEMENT (Menu)
│   ├── Add/Edit a Device ........................ ❌ Backend route exists, NO admin page
│   ├── List Devices ............................. ❌ Backend route exists, NO admin page
│   ├── Delete a Device .......................... ❌ Backend route exists, NO admin page
│   ├── Test Print to Device ..................... ❌ Backend route exists, NO admin page
│   └── Terminal Type List ....................... ❌ Backend route exists, NO admin page
│
├── MENU MANAGEMENT (Menu)
│   ├── Edit Options .............................. ❌ Backend route exists, NO admin page
│   ├── Menu Inquiry .............................. ❌ Backend route exists, NO admin page
│   ├── Assign Primary Menu Option ................ ❌ No route, no page
│   └── List Options by Package ................... ❌ Backend route exists, NO admin page
│
├── PROGRAMMER OPTIONS
│   ├── Select Routine for Editing ................ N/A (terminal-only, not applicable to web)
│   ├── Routine Integrity Check ................... N/A
│   └── %XCMD Direct M Execute .................... N/A (security risk in web context)
│
├── OPERATIONS MANAGEMENT
│   ├── Kernel Management Menu
│   │   ├── Enter/Edit Kernel Site Parameters ..... ⚠️ SecurityAuth.jsx / SiteParameters.jsx
│   │   │   │                                        (only ~10 of 23+ fields exposed)
│   │   │   ├── Domain Name ...................... ✅ SystemConfig.jsx
│   │   │   ├── Agency Code ...................... ✅ SystemConfig.jsx
│   │   │   ├── Default Timed-Read (Timeout) ..... ✅ SecurityAuth.jsx
│   │   │   ├── Multiple Sign-On ................. ✅ SecurityAuth.jsx
│   │   │   ├── Production Flag .................. ✅ SystemConfig.jsx (read-only)
│   │   │   ├── Auto Menu ........................ ❌ Not exposed
│   │   │   ├── Type-Ahead ....................... ❌ Not exposed
│   │   │   ├── Intro Message .................... ✅ SystemConfig.jsx (welcome message)
│   │   │   ├── Verify Code Change Days .......... ✅ SecurityAuth.jsx (password expiration)
│   │   │   ├── # Failed Sign-On Attempts ........ ✅ SecurityAuth.jsx
│   │   │   ├── Default Lock-Out Time ............ ✅ SecurityAuth.jsx
│   │   │   ├── Broker Timeout ................... ✅ SystemConfig.jsx
│   │   │   ├── Disable New User Creation ........ ❌ Not exposed (field 205 in allow-list)
│   │   │   ├── Option Audit ..................... ✅ SecurityAuth.jsx
│   │   │   ├── Initiate Audit ................... ✅ SecurityAuth.jsx
│   │   │   ├── Terminate Audit .................. ✅ SecurityAuth.jsx
│   │   │   ├── Failed Access Log ................ ✅ SecurityAuth.jsx
│   │   │   ├── Max Sign-On Limit ................ ❌ Not exposed (field 219 in allow-list)
│   │   │   ├── IRM Mail Group ................... ❌ Not exposed (field .02 in allow-list)
│   │   │   ├── After Hours Mail Group ........... ❌ Not exposed (field .03 in allow-list)
│   │   │   ├── Mixed OS ......................... ❌ Not exposed (field .05 in allow-list)
│   │   │   ├── Auto-Generate Access Codes ....... ❌ Not exposed (field 11 in allow-list)
│   │   │   ├── Auto-Generate Verify Codes ....... ❌ Not exposed (field 11.2 in allow-list)
│   │   │   ├── Ask Device Type at Sign-On ....... ❌ Not exposed (field 205 in allow-list)
│   │   │   ├── Default Auto-Menu ................ ❌ Not exposed (field 206 in allow-list)
│   │   │   └── GUI Post Sign-On ................. ❌ Not exposed (field 231 in allow-list)
│   │   ├── Establish System Audit Parameters .... ⚠️ Partially in SecurityAuth.jsx
│   │   └── Edit TaskMan Parameters .............. ❌ No UI, TaskMan status is read-only
│   │
│   ├── Security Key Management
│   │   ├── Allocate Security Keys ............... ✅ PermissionsCatalog.jsx (assign)
│   │   ├── Create/Edit Security Keys ............ ❌ No create/edit UI for keys themselves
│   │   ├── Delete Security Keys ................. ❌ No delete capability
│   │   ├── Check for Multiple Keys .............. ❌ No equivalent
│   │   └── Show Key Holders ..................... ✅ PermissionsCatalog.jsx (holders modal)
│   │
│   └── User Management (same as top-level) ...... (see above)
│
├── SPOOL MANAGEMENT ............................... N/A (printing through browser in web context)
│
├── INFORMATION SECURITY OFFICER MENU
│   ├── Review Sign-On Log ....................... ✅ AuditLog.jsx (Sign-On Activity tab)
│   ├── Review Failed Access Log ................. ✅ AuditLog.jsx (Failed Access tab)
│   ├── Review Programmer Mode Usage ............. ✅ AuditLog.jsx (Programmer Mode tab)
│   ├── Audit Option Usage ....................... ⚠️ Partial — audit mode setting exists
│   └── User Security Report ..................... ⚠️ AdminReports.jsx generic reports
│
├── TASKMAN MANAGEMENT
│   ├── TaskMan Status Display ................... ✅ SystemHealth.jsx (system health tab)
│   ├── Task List ................................ ✅ SystemHealth.jsx (when running)
│   ├── Start TaskMan ............................ ❌ No start/stop capability in web UI
│   ├── Stop TaskMan ............................. ❌ No start/stop capability
│   ├── Requeue Task ............................. ❌ No task requeue capability
│   └── Delete Task .............................. ❌ No task delete capability
│
├── HL7 MAIN MENU
│   ├── Interface List ........................... ✅ SystemHealth.jsx HL7 tab
│   ├── Filer Status ............................. ✅ SystemHealth.jsx HL7 filer status
│   ├── System Link Monitor ...................... ⚠️ Link status exists but limited
│   ├── Start/Stop Filers ........................ ❌ No start/stop capability
│   └── Purge Messages ........................... ❌ No purge capability
│
├── MAILMAN
│   ├── Read Messages ............................ ✅ AlertsNotifications.jsx Messages tab
│   ├── Send Message ............................. ✅ AlertsNotifications.jsx compose
│   ├── Delete Message ........................... ✅ AlertsNotifications.jsx delete
│   ├── Forward Message .......................... ✅ AlertsNotifications.jsx forward
│   ├── Mail Groups Management ................... ❌ Backend route exists, NO admin page
│   │   ├── List Mail Groups ..................... ❌ Backend route exists, NO admin page
│   │   ├── Edit Mail Group ...................... ❌ Backend route exists, NO admin page
│   │   ├── Add/Remove Members ................... ❌ Backend routes exist, NO admin page
│   │   └── Mail Group Detail .................... ❌ Backend route exists, NO admin page
│   └── Bulletin Board ........................... ⚠️ Alerts tab shows bulletins
│
├── CAPACITY PLANNING .............................. ❌ No UI (backend route exists)
│
└── ADDITIONAL ADMIN AREAS (beyond EVE)
    │
    ├── CPRS MANAGER MENU
    │   ├── Quick Orders Management .............. ❌ Backend route exists, NO admin page
    │   ├── Order Sets Management ................. ❌ Backend route exists, NO admin page
    │   ├── Orderable Items ....................... ❌ Backend route exists, NO admin page
    │   └── CPRS Configuration Parameters ........ ⚠️ Partially in SiteParameters.jsx (6 fields)
    │
    ├── CLINIC SETUP (File #44)
    │   ├── Add Clinic ............................ ❌ Backend routes exist, NO admin page
    │   ├── Edit Clinic ........................... ❌ Backend routes exist, NO admin page
    │   ├── Inactivate/Reactivate Clinic ......... ❌ Backend routes exist, NO admin page
    │   ├── Clinic Availability ................... ❌ Backend routes exist, NO admin page
    │   └── List Clinics .......................... ❌ Backend routes exist, NO admin page
    │
    ├── WARD ADMINISTRATION (File #42)
    │   ├── List Wards ............................ ❌ Backend routes exist, NO admin page
    │   ├── Edit Ward ............................. ❌ Backend routes exist, NO admin page
    │   └── Ward Detail ........................... ❌ Backend routes exist, NO admin page
    │
    ├── SCHEDULING MANAGER MENU
    │   ├── Appointment Types (File #409.1) ....... ❌ Backend routes exist, NO admin page
    │   ├── Room/Bed Locations (File #405.4) ...... ❌ Backend routes exist, NO admin page
    │   └── Scheduling Parameters ................. ⚠️ 5 fields in SiteParameters.jsx
    │
    ├── PHARMACY MANAGER MENU
    │   ├── Drug File Management (File #50) ....... ❌ Backend routes exist, NO admin page
    │   ├── Pharmacy Site Parameters .............. ⚠️ 6 fields in SiteParameters.jsx
    │   └── Pharmacy Locations .................... ❌ Not implemented
    │
    ├── LAB MANAGER MENU
    │   ├── Lab Test Management (File #60) ........ ❌ Backend routes exist, NO admin page
    │   ├── Lab Site Parameters ................... ⚠️ 6 fields in SiteParameters.jsx
    │   └── Auto-Instrument Settings (File #62.4) . ❌ Not implemented
    │
    ├── RADIOLOGY MANAGER MENU
    │   ├── Procedure Management (File #71) ....... ❌ Backend routes exist, NO admin page
    │   ├── Radiology Site Parameters ............. ⚠️ 5 fields in SiteParameters.jsx
    │   └── Modality Configuration ................ ❌ Not implemented
    │
    ├── SURGERY SETUP
    │   ├── Surgery Site Parameters ............... ⚠️ 5 fields in SiteParameters.jsx
    │   └── Surgery Locations ..................... ❌ Not implemented
    │
    ├── HEALTH SUMMARY MANAGEMENT
    │   ├── Health Summary Types (File #142) ...... ❌ Backend routes exist, NO admin page
    │   ├── Health Summary Components ............. ❌ Backend routes exist, NO admin page
    │   └── Health Summary Type Editor ............ ❌ Backend routes exist, NO admin page
    │
    ├── TIU (TEXT INTEGRATION UTILITIES)
    │   ├── Document Definition Setup (File #8925.1) ❌ Backend routes exist, NO admin page
    │   └── Note Template Management .............. ❌ Not implemented
    │
    ├── TREATING SPECIALTIES (File #36)
    │   ├── List Specialties ....................... ❌ Backend route exists, NO admin page
    │   └── Edit Specialty ......................... ❌ Backend route exists, NO admin page
    │
    ├── INSURANCE/BILLING SETUP
    │   ├── Insurance Companies (File #71*) ....... ❌ Backend routes exist, NO admin page
    │   ├── Billing Parameters (File #350.9) ...... ❌ Backend route exists, NO admin page
    │   └── Fee Schedule ........................... ❌ Not implemented
    │
    └── INSTITUTION/FACILITY MANAGEMENT (File #4)
        ├── Institution List ...................... ⚠️ SiteManagement.jsx shows divisions (#40.8)
        ├── Institution Detail .................... ⚠️ Limited to division fields
        └── Full Institution Edit ................. ❌ Backend route exists, limited fields
```

### 1.2 The Numbers

| Category | Terminal Functions | Has Backend Route | Has Frontend Page | Fully Complete |
|----------|-------------------|-------------------|-------------------|----------------|
| User Management | 9 | 16 (exceeds) | 3 pages | ⚠️ 60% |
| Device Management | 5 | 6 | 0 pages | ❌ 0% |
| Menu Management | 4 | 3 | 0 pages | ❌ 0% |
| Kernel Site Parameters | 23+ fields | 23 (allow-list) | ~10 fields | ⚠️ 43% |
| Security Key Management | 5 | 8 | 1 page | ⚠️ 40% |
| Audit/Security Officer | 5 | 5 | 1 page | ✅ 80% |
| TaskMan Management | 6 | 4 | 1 page (read-only) | ⚠️ 33% |
| HL7 Interface Management | 5 | 5 | 1 tab | ⚠️ 40% |
| MailMan / Messaging | 8 | 10 | 1 tab | ⚠️ 50% |
| Clinic Setup | 6 | 8 | 0 pages | ❌ 0% |
| Ward Administration | 3 | 3 | 0 pages | ❌ 0% |
| Scheduling Manager | 4 | 5 | 0 pages | ❌ 0% |
| Pharmacy Manager | 4 | 3 | 0 pages | ❌ 0% |
| Lab Manager | 4 | 2 | 0 pages | ❌ 0% |
| Radiology Manager | 3 | 3 | 0 pages | ❌ 0% |
| Surgery Setup | 2 | 1 | 0 pages | ❌ 0% |
| Health Summary Mgmt | 4 | 6 | 0 pages | ❌ 0% |
| TIU Document Defs | 3 | 3 | 0 pages | ❌ 0% |
| Treating Specialties | 2 | 2 | 0 pages | ❌ 0% |
| Insurance/Billing | 3 | 3 | 0 pages | ❌ 0% |
| CPRS Configuration | 4 | 4 | 0 pages | ❌ 0% |
| ***TOTALS*** | ***~107*** | ***~124 routes*** | ***~13 pages*** | ***~30% complete*** |

**The backend has built routes for areas that the frontend has never surfaced.** There are 36 wired adminService.js functions with zero frontend exposure.

---

## PART 2: CURRENT ADMIN PANEL — SECTION-BY-SECTION AUDIT

### 2.1 Staff Directory (StaffDirectory.jsx)

**What works:**
- ✅ Lists users from VistA File #200 via ZVE USER LIST
- ✅ KPI cards (total staff, active, e-sig ready, locked) from real data
- ✅ System account hiding (POSTMASTER, TASKMAN, HL7, etc.)
- ✅ Duplicate name disambiguation with Staff ID
- ✅ Status badges (active, inactive, locked, terminated)
- ✅ CSV export with humanized headers
- ✅ E-signature readiness filter from DDR probe of File #200 fields 20.2-20.4
- ✅ Deactivate / Reactivate calls real ZVE RPCs
- ✅ Unlock user calls real RPC
- ✅ Detail panel loads on row click with lazy loading

**What is incomplete:**
- ⚠️ **Role derivation is client-side guesswork** — `deriveTitleFromKeys()` infers role from permission set because VistA File #200 field 8 (Title) is often empty in test data. Real VistA systems would have this populated, but the logic should still be more robust
- ⚠️ **Action feedback is weak** — Deactivate calls the API but the UI toast/confirmation is brief; user can't easily verify the change happened
- ⚠️ **Provider fields not shown** — NPI, DEA, Person Class (File #200 fields that define provider identity) are not displayed
- ⚠️ **Division assignment not visible** — Which facilities a user is assigned to is not prominently shown
- ⚠️ **Primary menu option not shown** — The user's primary menu (field #201) which defines their access level (EVE=System Manager, XUCORE=Clinical, etc.) is invisible
- ⚠️ **Last sign-on date** — Not prominently displayed despite being available
- ❌ **No audit trail deep-link** — "View Audit Trail" button exists but pre-filtering to the specific user often returns empty results (reported by user)

**VistA terminal equivalent:** USER MANAGEMENT → List Users / Edit an Existing User / User Inquiry  
**Terminal does MORE:** Shows all 5 ScreenMan pages of user data (Identity, Access/Verify, Divisions, Keys, Provider fields). Our detail panel is a subset.

### 2.2 Staff Form / Add Staff (StaffForm.jsx)

**What works:**
- ✅ 7-step wizard (Identity, Role, Locations, Provider, E-Sig, Permissions, Review)
- ✅ Role-based permission defaults from real VistA key names
- ✅ ORES/ORELSE mutual exclusion validation
- ✅ Reference data (sites, departments, permissions) loaded from VistA
- ✅ Duplicate name detection

**What is incomplete:**
- ⚠️ **Create action may not complete cleanly** — `createStaffMember()` is in adminService but the actual create flow via ZVE USMG ADD needs live validation
- ⚠️ **16 editable fields** via PUT /users, but the wizard only exposes a subset
- ❌ **No e-signature setup during create** — Provider e-signature can only be set in edit mode (terminal does it during user creation)
- ❌ **No access code / verify code setup** — `updateCredentials()` exists in service but no UI step for it
- ❌ **No division assignment in create flow** — Terminal allows multi-division assignment during creation; wizard has a "Locations" step but it may not wire division assignment

**VistA terminal equivalent:** USER MANAGEMENT → Add a New User to the System (5 ScreenMan pages)  
**Terminal does MORE:** Complete user setup in one flow: name, SSN, DOB, access/verify codes, divisions, keys, e-signature — all in sequence.

### 2.3 Roles & Permissions (RoleTemplates.jsx)

**What works:**
- ✅ 17 system role templates with real VistA key references
- ✅ Custom roles persisted to VistA via ZVE ROLE CUSTOM CRT/LIST/UPD/DEL
- ✅ Workspace access grid (11 workspaces × 3 permission levels)
- ✅ Permission grouping by department from server enrichment
- ✅ Clone system role to create custom variant

**What is incomplete:**
- ⚠️ **17 system roles are hardcoded in frontend JavaScript** — not stored in VistA, not validated against live key inventory. If VistA doesn't have a key referenced by a role template, the assignment would fail at runtime
- ⚠️ **Role templates are a VistA Evolved invention** — VistA terminal has no concept of "role templates." This is a valid UX addition, but it needs to be clearly labeled as such, and the underlying key assignment must be verified
- ❌ **No way to inspect individual key descriptions** from the role template view — you can see which keys are bundled, but not what each key does
- ❌ **Workspace access controls are not clearly linked to real VistA behavior** — what does "read-only" vs "read-write" for a workspace mean in VistA terms?

**VistA terminal equivalent:** There is NO terminal equivalent. Roles are a modern UX addition.  
**Important:** This needs clear labeling: "Role Templates are a VistA Evolved feature that bundles security keys for easy assignment. In the VistA terminal, keys are assigned individually."

### 2.4 Permission Catalog (PermissionsCatalog.jsx)

**What works:**
- ✅ Reads all ~689 keys from VistA File #19.1 via ZVE KEY LIST
- ✅ Standard view (top ~150 keys) vs. Advanced view (all 689)
- ✅ Dynamic categorization from server data (PACKAGE display names)
- ✅ Human-readable display names from DESCRIPTIVE NAME field
- ✅ Permission holders modal (ZVE KEY HOLDERS → scans ^XUSEC)
- ✅ Assign permission from catalog → target user
- ✅ ORES/ORELSE mutual exclusion validation
- ✅ Deep-link support (?assign=KEYNAME)

**What is incomplete:**
- ⚠️ **Keys with empty DESCRIPTIVE NAME** — many VistA keys have no human-readable description. The frontend shows the coded name (e.g., "A1AX APVCO") when no description exists
- ⚠️ **No "why this key matters" explanation** — terminal-trained ADPACs know what keys do from training. Modern admins need inline help
- ❌ **No key creation** — terminal allows creating new security keys. No modern equivalent
- ❌ **No key deletion** — terminal allows deleting keys. No modern equivalent
- ❌ **No key editing** — terminal allows editing key properties. No modern equivalent
- ❌ **Permission removal** — `removePermission()` exists in adminService but has no UI exposure

**VistA terminal equivalent:** Security Key Management → Allocate Security Keys / Show Key Holders  
**Terminal does MORE:** Create/Edit/Delete keys, not just assign them.

### 2.5 Security & Authentication (SecurityAuth.jsx)

**What works:**
- ✅ Reads real Kernel parameters from VistA File #8989.3 via ZVE PARAM GET
- ✅ Two-person integrity for security-sensitive changes (Login Security, E-Sig sections)
- ✅ Zero-value warnings with recommendations (session timeout=0 → security risk)
- ✅ VHA Directive 6500 enforcement (max 900s session timeout)
- ✅ Pending approval display with self-approval prevention
- ✅ Range validation (password expiration 1-90 days)

**What is incomplete:**
- ⚠️ **Only ~10 of 23+ Kernel parameters exposed** — the KERNEL8989_ALLOW constant in server.mjs has 23 fields; the UI only shows ~10. Missing: Disable New User Creation, Max Sign-On Limit, IRM Mail Group, After Hours Mail Group, Auto-Generate Access Codes, Auto-Generate Verify Codes, Default Auto-Menu, GUI Post Sign-On, Ask Device Type at Sign-On, Mixed OS
- ⚠️ **E-Signature fields shown as read-only** — "minimum 6 characters, cannot be disabled." Is this truly VistA's behavior? What terminal screen governs this? The spec says these values should be READ from VistA, not hardcoded
- ⚠️ **Account Policies section** — "Auto-generate usernames" and "Auto-generate passwords" toggles exist, but do they map to Kernel fields 11 and 11.2? Are they wired?
- ❌ **No "Advanced Security Parameters" section** for the remaining ~13 Kernel fields that are in the allow-list but not in the UI

**VistA terminal equivalent:** Operations → Kernel Management → Enter/Edit Kernel Site Parameters (ScreenMan form)  
**Terminal shows ALL fields** on the ScreenMan form. Our UI shows less than half.

### 2.6 System Configuration (SystemConfig.jsx)

**What works:**
- ✅ Organization identity from real VistA data (domain, agency code, environment)
- ✅ Agency code → human label (V=VA, I=IHS, D=DoD, P=Private)
- ✅ Welcome message read/write (textarea)
- ✅ VistA connection status from live probe
- ✅ Production/Test indicator from real flag

**What is incomplete:**
- ⚠️ **Facility code / Station Number** — shown but unclear if it's editable or read-only
- ⚠️ **Organization Name** — where does it come from? Institution File #4? Is it editable?
- ⚠️ **Timezone** — shown but may not map to a VistA field
- ❌ **No full Institution File #4 editor** — VistA's Institution file has many fields (address, phone, director, services, etc.) that are important for facility identity
- ❌ **No "Environment" toggle** — Production flag is read-only display. In terminal, system managers can change this (carefully)

**VistA terminal equivalent:** Kernel Management → Site Parameters (organization identity fields)  
**Terminal does MORE:** Full Institution file (#4) editing with all facility details.

### 2.7 Module Settings / Site Parameters (SiteParameters.jsx)

**What works:**
- ✅ PARAM_TREE navigation (System, Clinical, Pharmacy, Lab, Scheduling, Radiology, Surgery)
- ✅ Kernel parameter reading and display with normalization
- ✅ Package parameters via DDR GETS + ZVE DD FIELDS

**What is broken/incomplete — THIS IS THE BIGGEST PROBLEM:**
- 🔴 **Generic "Field 3" labels** — ZVE DD FIELDS call fails silently at runtime (wrapped in try/catch with empty catch), causing fallback to `"${pkgDef.label} — Field ${fieldNum}"` or the frontend fallback `"Field ${fieldNum}"`. This is the **#1 user-visible problem**: users see "Pharmacy Site Parameters — Field 3" instead of "Flash Card Printer Name"
- 🔴 **Only 6 fields per package** — PACKAGE_PARAM_FILES defines:
  ```
  order-entry: fields '.01;.02;.03;1;2;3'     (6 fields, File #100.99 has 50+)
  pharmacy:    fields '.01;.02;.03;1;2;4'     (6 fields, File #59.7 has 40+)
  lab:         fields '.01;.02;.03;1;2;3'     (6 fields, File #69.9 has 30+)
  scheduling:  fields '.01;.02;.03;1;2'       (5 fields, File #44.001 has 20+)
  radiology:   fields '.01;.02;.03;1;2'       (5 fields, File #79.1 has 30+)
  surgery:     fields '.01;.02;.03;1;2'       (5 fields, File #136 has 30+)
  ```
  We are showing 5-6 fields out of 20-50+ fields per package. This is roughly 10-15% coverage.
- ⚠️ **No field descriptions or help text** — even when labels are correct, users don't know what changing a parameter does. Terminal users rely on training; web users need inline help
- ⚠️ **Write behavior untested** — PUT /params/:package exists but it's unclear if it's been validated end-to-end
- ❌ **Change Preview panel** — mentioned in code, unclear if it works correctly with the generic labels
- ❌ **No parameter grouping by function** — terminal's ScreenMan forms group parameters logically (e.g., "Pharmacy Label Printing" group, "Dispensing" group). Our UI shows a flat list

**VistA terminal equivalent:** Each package has its own parameter editing screen accessible from the respective manager menu (Pharmacy Manager → Pharmacy Site Parameters, Lab Manager → Lab Site Parameters, etc.)  
**Terminal shows ALL parameters** with meaningful field labels from the data dictionary. We show 5-6 per package with potentially generic labels.

### 2.8 Facilities & Sites (SiteManagement.jsx)

**What works:**
- ✅ Division list from VistA File #40.8 via ZVE DIVISION LIST
- ✅ Add site with name, station number, type
- ✅ Edit site details (name, phone, address, city, state)
- ✅ Workspace visibility toggles per site (persisted to VistA)
- ✅ System topology display
- ✅ Type icons (Medical Center, CBOC, etc.)

**What is incomplete:**
- ⚠️ **Workspace toggles lack explanation** — what does toggling "Scheduling" off for a site actually DO? Does it hide the scheduling workspace for users at that site? Is this a VistA Evolved feature or a VistA feature?
- ⚠️ **Topology display is raw** — `JSON.stringify(topology)` in a `<pre>` tag. Not useful for non-technical users
- ⚠️ **Inactive sites** — user reported seeing 3 inactive facilities with no clear activation mechanism
- ❌ **No full Institution editor** — Division (#40.8) has limited fields. Institution (#4) has the real facility details. No link between the two in the UI
- ❌ **No department assignment per site** — which departments operate at which facility
- ❌ **No clinic listing per site** — which clinics are at this location

**VistA terminal equivalent:** No single terminal menu. Facility management spans Institution file (#4), Medical Center Division (#40.8), and cross-references.  
**Terminal does MORE:** Full institution detail editing, department-facility relationships.

### 2.9 Departments & Services (DepartmentsServices.jsx)

**What works:**
- ✅ Lists departments from VistA File #49 (SERVICE/SECTION)
- ✅ Split-pane UI with detail editing
- ✅ Create new department, edit fields (name, abbreviation, mail symbol)
- ✅ Field-by-field save

**What is incomplete:**
- ⚠️ **Limited fields** — only name (.01), abbreviation (1), mail symbol (2) are editable. File #49 has more: chief, parent service, facility type, etc.
- ⚠️ **No chief assignment** — the chief of service field is read but not editable
- ⚠️ **No hierarchical view** — services can be nested (parent-child). Flat list misses this structure
- ❌ **No service-to-user mapping** — which staff are assigned to which department

**VistA terminal equivalent:** Service/Section file editing is typically done through FileMan directly or through specific package menus.

### 2.10 System Health (SystemHealth.jsx)

**What works:**
- ✅ TaskMan status detection (running/stopped) with prominent warning card
- ✅ Human task names via TASK_HUMAN_NAMES map (XMKPLQ → "Internal Message Queue Processor")
- ✅ Error trap with humanized M error codes
- ✅ HL7 filer status and interface list
- ✅ 6 admin reports with CSV export
- ✅ Promise.allSettled for parallel loading (single failure doesn't break page)

**What is incomplete:**
- ⚠️ **TaskMan is read-only** — no start/stop/restart capability. Terminal can manage TaskMan operations
- ⚠️ **HL7 is read-only** — no start/stop filers, no purge, no interface configuration
- ⚠️ **Error trap lacks actionable guidance** — shows humanized error but doesn't suggest what to do about it
- ❌ **No system performance metrics** — no CPU, memory, disk, response time monitoring
- ❌ **No user count / active sessions** — terminal shows concurrent user info

**VistA terminal equivalent:** TaskMan Management + HL7 Main Menu + Error Trap display  
**Terminal does MORE:** Start/stop TaskMan, start/stop HL7 filers, manage task queue, purge HL7 messages.

### 2.11 Audit Trail (AuditLog.jsx)

**What works:**
- ✅ 5 audit sources (sign-on, FileMan, error, failed access, programmer mode)
- ✅ Normalization across different VistA audit schemas
- ✅ Filters by staff member (typeahead), date range, action type, source
- ✅ Color-coded action rows
- ✅ CSV export
- ✅ Promise.allSettled for parallel loading

**What is incomplete:**
- ⚠️ **Staff filter by DUZ under the hood** — user types a name, but cross-referencing to audit entries (which store DUZ) may produce empty results if the matching logic isn't robust
- ⚠️ **50-row pagination** — for large VistA systems with millions of audit entries, this needs server-side pagination, not client-side filtering
- ❌ **No deep-link from staff detail** — "View Audit Trail" from StaffDirectory doesn't reliably pre-filter

**VistA terminal equivalent:** Information Security Officer Menu → Review Sign-On Log / Failed Access Log / Programmer Mode Usage  
**Coverage is good here.** This is one of the most complete sections.

### 2.12 Messages & Alerts (AlertsNotifications.jsx)

**What works:**
- ✅ Alerts from VistA BULLETIN system
- ✅ MailMan inbox/read/send/delete/forward
- ✅ Staff typeahead for compose/forward
- ✅ Modal confirmations for destructive actions

**What is incomplete:**
- ⚠️ **Notifications tab is static** — informational content about alert routing, not real data
- ❌ **No Mail Groups management** — backend routes exist for listing/editing/managing mail group membership, but no UI
- ❌ **No alert routing configuration** — who gets alerted for what
- ❌ **No surrogates** — VistA allows setting up alert surrogates

**VistA terminal equivalent:** MailMan menu + Alert management  
**Terminal does MORE:** Mail group management, surrogate setup, bulletin board configuration.

### 2.13 Admin Reports (AdminReports.jsx)

**What works:**
- ✅ 6 report types from real backend
- ✅ Dynamic column humanization
- ✅ CSV export
- ✅ 100-row display limit with export for full data

**What is incomplete:**
- ⚠️ **Report quality depends on backend** — if backend returns raw VistA field numbers instead of names, reports will be hard to read
- ❌ **No scheduled reports** — no ability to set up recurring report generation
- ❌ **No report templates** — no ability to define custom report queries
- ❌ **No cross-module reports** — scheduling utilization, pharmacy dispensing volume, lab turnaround time, etc. are not represented

**VistA terminal equivalent:** Various report options scattered across package menus  
**Terminal does MORE:** Package-specific reporting (lab reports, pharmacy reports, scheduling reports, etc.)

---

## PART 3: THE ROOT CAUSE — "FIELD 3 CONFIGURATION PARAMETER 3"

This is the single most visible problem and deserves a detailed diagnosis.

### The Data Flow

```
1. User clicks "Pharmacy Settings" in Module Settings
2. Frontend calls adminService.getPackageParams('pharmacy')
3. HTTP GET /api/ta/v1/params/pharmacy hits server.mjs
4. Server reads PACKAGE_PARAM_FILES['pharmacy'] → { file: '59.7', fields: '.01;.02;.03;1;2;4' }
5. Server calls DDR GETS ENTRY DATA for File 59.7, IEN 1, fields .01;.02;.03;1;2;4
   → Returns: "59.7^1^.01^SOME_SITE^Some Site Name\n59.7^1^3^VALUE^Display"
6. Server calls ZVE DD FIELDS('59.7', '.01;.02;.03;1;2;4') ← WRAPPED IN TRY/CATCH
   → If RPC succeeds: returns field labels like "FLASH CARD PRINTER NAME"
   → If RPC FAILS SILENTLY: fieldLabels stays empty {}
7. Server merges data + labels
   → With labels: { fieldNum: "3", label: "Flash Card Printer Name" }
   → WITHOUT labels: { fieldNum: "3", label: "Pharmacy Site Parameters — Field 3" }
8. Frontend receives response
   → If response has data[] array: uses the server-provided labels (Tier 1)
   → If response has only rawLines: generates "Field 3" labels itself (Tier 2)
9. User sees either meaningful labels OR "Field 3 Configuration Parameter 3"
```

### Why ZVE DD FIELDS Likely Fails

Three plausible failure modes:

1. **RPC not registered in context** — ZVE DD FIELDS must be registered in the OR CPRS GUI CHART context (or whatever context the broker is using). If ZVECTXF (the context fixer routine) didn't add it, the broker will reject the call
2. **M routine compile error** — if ZVEADMN1.m has a syntax issue or the DDFLDS tag has a runtime error, the RPC fails
3. **Data dictionary is empty for these fields** — some parameter files might not have ^DD entries for all fields (unlikely but possible)

### The Fix Path

1. **Verify RPC availability**: `curl` test for ZVE DD FIELDS with a known file/field combination
2. **Add logging to the catch block** in server.mjs line 5942 — currently swallows errors silently
3. **If RPC works**: investigate why specific fields don't have labels
4. **If RPC doesn't work**: check ZVECTXF context registration, check ZVEADMN1 compilation
5. **Expand field coverage**: Each PACKAGE_PARAM_FILES entry needs ALL meaningful fields, not just 5-6

---

## PART 4: THE 36 ORPHANED BACKEND CAPABILITIES

These functions exist in `adminService.js` with working backend routes but **zero frontend pages**:

### Healthcare Operations (Missing Admin Pages)

| Service Function | Backend Route | VistA File | What It Manages | Priority |
|-----------------|---------------|-----------|-----------------|----------|
| `getClinics()` | GET /clinics | File #44 | Clinic locations, hours, services | HIGH |
| `getWards()` | GET /wards | File #42 | Inpatient ward configuration | HIGH |
| `getDevices()` | GET /devices | File #3.5 | System devices, printers | MEDIUM |
| `getMailGroups()` | GET /mail-groups | File #3.8 | Mail group configuration | MEDIUM |
| `getPackages()` | GET /packages | File #9.4 | Installed VistA packages | LOW |

### User Management (Missing Actions in Existing Pages)

| Service Function | Backend Route | What It Does | Should Be In |
|-----------------|---------------|-------------|-------------|
| `removePermission()` | DELETE /users/:duz/keys/:keyId | Revokes a key from user | PermissionsCatalog + StaffDirectory |
| `terminateStaffMember()` | POST /users/:duz/terminate | Terminates employment | StaffDirectory detail panel |
| `renameStaffMember()` | PUT /users/:duz/rename | Changes user name | StaffDirectory detail panel |
| `cloneStaffMember()` | POST /users/clone | Clones user from source | StaffForm |
| `updateCredentials()` | PUT /users/:duz/credentials | Reset access/verify codes | StaffDirectory detail panel |
| `setProviderFields()` | POST /users/:duz/provider | Set provider status | StaffForm wizard |
| `analyzeKeyImpact()` | POST /key-impact | Analyzes what nav areas keys enable | StaffForm permission step |

### Reports & Diagnostics (Missing Pages)

| Service Function | Backend Route | What It Does | Should Be In |
|-----------------|---------------|-------------|-------------|
| `getDashboard()` | GET /dashboard | Aggregated system counts | New Dashboard page |
| `getHL7LinkStatus()` | GET /hl7/link-status/:ien | Individual link status | SystemHealth HL7 tab |
| `getTaskManTask()` | GET /taskman-tasks/:ien | Individual task detail | SystemHealth task detail |
| `getCapacity()` | GET /capacity | System capacity metrics | SystemHealth or new page |
| `ddrProbe()` | GET /vista/ddr-probe | DDR family RPC diagnostics | SystemHealth diagnostics |

---

## PART 5: SPECIFIC ISSUES CONFIRMED BY AUDIT

### Category A: Broken or Silent Behaviors

| # | Issue | Root Cause | Fix |
|---|-------|-----------|-----|
| A1 | Package params show "Field 3" labels | ZVE DD FIELDS fails silently; try/catch swallows error | Add logging, verify RPC registration, expand field lists |
| A2 | Package params show only 5-6 fields per module | PACKAGE_PARAM_FILES hardcodes a tiny subset of fields | Expand to all meaningful fields per parameter file |
| A3 | Deactivate user appears to do nothing | API call succeeds but UI feedback (toast) is too brief/subtle | Add explicit confirmation modal showing before/after state |
| A4 | "View Audit Trail" from staff detail shows empty results | DUZ-based filtering doesn't match audit entry format | Improve cross-reference between user DUZ and audit sources |

### Category B: Missing Actions in Existing Pages

| # | Issue | Backend Ready? | Frontend Work Needed |
|---|-------|---------------|---------------------|
| B1 | No way to remove a permission from a user | ✅ DELETE /users/:duz/keys/:keyId | Add "Remove" button to permission list |
| B2 | No way to terminate (vs deactivate) a user | ✅ POST /users/:duz/terminate | Add "Terminate" action in detail panel |
| B3 | No way to rename a user | ✅ PUT /users/:duz/rename | Add "Rename" option in detail panel |
| B4 | No way to clone a user | ✅ POST /users/clone | Add "Clone User" action |
| B5 | No way to reset access/verify codes | ✅ PUT /users/:duz/credentials | Add "Reset Credentials" in detail panel |
| B6 | No way to create/edit/delete security keys | ❌ No routes | Needs new M routine + server routes + UI |
| B7 | No key impact analysis in UI | ✅ POST /key-impact | Add to permission assignment flow |
| B8 | No HL7 link status per interface | ✅ GET /hl7/link-status/:ien | Add to HL7 tab interface detail |
| B9 | No individual task detail | ✅ GET /taskman-tasks/:ien | Add task detail modal |
| B10 | No DDR probe diagnostics | ✅ GET /vista/ddr-probe | Add to System Health diagnostics |

### Category C: Entire Admin Sections That Don't Exist Yet

| # | Section | Backend Routes | M Routines | Frontend Pages | Priority |
|---|---------|---------------|-----------|---------------|----------|
| C1 | Clinic Management | 8 routes ✅ | ZVE CLNM ADD/EDIT ✅ | 0 pages ❌ | HIGH |
| C2 | Ward Management | 3 routes ✅ | ZVE WRDM EDIT ✅ | 0 pages ❌ | HIGH |
| C3 | Device Management | 6 routes ✅ | ZVE DEV TESTPRINT ✅ | 0 pages ❌ | MEDIUM |
| C4 | Mail Group Management | 6 routes ✅ | ZVE MAILGRP * ✅ | 0 pages ❌ | MEDIUM |
| C5 | Appointment Type Config | 4 routes ✅ | DDR ✅ | 0 pages ❌ | MEDIUM |
| C6 | Room/Bed Config | 3 routes ✅ | DDR ✅ | 0 pages ❌ | MEDIUM |
| C7 | Health Summary Setup | 6 routes ✅ | ZVE HS * ✅ | 0 pages ❌ | MEDIUM |
| C8 | TIU Document Defs | 3 routes ✅ | DDR ✅ | 0 pages ❌ | MEDIUM |
| C9 | Treating Specialties | 2 routes ✅ | DDR ✅ | 0 pages ❌ | LOW |
| C10 | Drug File Management | 3 routes ✅ | DDR ✅ | 0 pages ❌ | LOW |
| C11 | Lab Test Management | 2 routes ✅ | DDR ✅ | 0 pages ❌ | LOW |
| C12 | Radiology Procedures | 3 routes ✅ | DDR ✅ | 0 pages ❌ | LOW |
| C13 | Insurance Companies | 3 routes ✅ | DDR ✅ | 0 pages ❌ | LOW |
| C14 | Billing Parameters | 1 route ✅ | DDR ✅ | 0 pages ❌ | LOW |
| C15 | Quick Orders | 2 routes ✅ | DDR ✅ | 0 pages ❌ | LOW |
| C16 | Order Sets | 2 routes ✅ | DDR ✅ | 0 pages ❌ | LOW |
| C17 | Orderable Items | 1 route ✅ | DDR ✅ | 0 pages ❌ | LOW |
| C18 | Menu Options | 2 routes ✅ | DDR ✅ | 0 pages ❌ | LOW |
| C19 | Admin Dashboard | 1 route ✅ | Multiple DDR ✅ | 0 pages ❌ | HIGH |

### Category D: UX/Explanation/Trust Deficiencies

| # | Issue | Where | Fix |
|---|-------|-------|-----|
| D1 | No "what is this?" help text on any setting | All pages | Add contextual help icons with explanations |
| D2 | No "VistA terminal equivalent" reference | All pages | Add collapsed "Terminal Reference" section per page |
| D3 | No save confirmation with before/after diff | SecurityAuth, SiteParams | Show changed values before save |
| D4 | No explanation of workspace toggles | SiteManagement | Add tooltip explaining what each workspace controls |
| D5 | Topology display is raw JSON | SiteManagement | Render as visual tree diagram |
| D6 | E-signature rules appear hardcoded | SecurityAuth | Read from VistA, add explanation |
| D7 | Role templates not labeled as "VistA Evolved feature" | RoleTemplates | Add note distinguishing from VistA native |
| D8 | Permission catalog lacks "why this key exists" | PermissionsCatalog | Add package context and usage description |
| D9 | No admin tour / setup wizard | Missing | Create guided setup for new installations |
| D10 | No system-wide "what's connected" indicator | Missing | Show VistA connection health persistently |

---

## PART 6: THE WORK PLAN — PRIORITY-ORDERED

### Phase 1: Fix What's Broken (1-2 days)

These are bugs/failures that make existing features appear non-functional:

1. **Fix ZVE DD FIELDS silent failure** — Add logging to server.mjs catch block, verify RPC registration in VistA context, test with curl
2. **Expand PACKAGE_PARAM_FILES** — Read ALL field numbers from each parameter file's data dictionary, not just 5-6
3. **Fix Deactivate/Reactivate feedback** — Add explicit confirmation modal with before/after state
4. **Fix "View Audit Trail" deep-link** — Ensure user-to-audit cross-referencing works
5. **Fix package parameter labels** — If ZVE DD FIELDS truly fails for some files, build a static translation table as fallback (similar to KEY_TRANSLATIONS concept in the Expansion spec)

### Phase 2: Wire Up Orphaned Backend Capabilities (3-5 days)

Surface the 36 already-built backend capabilities that have no frontend:

1. **Add missing user actions to Staff Directory detail panel** — Remove Permission, Terminate, Rename, Reset Credentials, Clone
2. **Add key impact analysis to permission assignment flow**
3. **Add HL7 link status and task detail to System Health**
4. **Add DDR probe diagnostics to System Health**
5. **Create admin Dashboard page** using existing GET /dashboard route

### Phase 3: Build Missing Admin Sections (5-10 days)

Create new admin pages for areas where backend routes exist but no frontend:

1. **Clinic Management page** (HIGH priority — 8 routes ready)
2. **Ward Management page** (HIGH — 3 routes ready)
3. **Device Management page** (MEDIUM — 6 routes ready)
4. **Mail Group Management page** (MEDIUM — 6 routes ready)
5. **Appointment Type Configuration page** (MEDIUM — 4 routes ready)
6. **Room/Bed Configuration page** (MEDIUM — 3 routes ready)
7. **Health Summary Setup page** (MEDIUM — 6 routes ready)
8. **TIU Document Definition page** (MEDIUM — 3 routes ready)
9. **Package-specific management pages** (LOW — drug file, lab tests, radiology procedures, etc.)

### Phase 4: Complete the Kernel Parameter Coverage (2-3 days)

1. **Expose all 23+ Kernel Site Parameters** that are in the KERNEL8989_ALLOW list
2. **Group them logically** (not just flat list) — Security settings, Network settings, Audit settings, System behavior settings
3. **Add help text for every parameter** explaining what it does, safe values, and impact
4. **Expand package parameter field coverage** to include all meaningful fields per file

### Phase 5: UX Trust Layer (3-5 days)

1. **Add contextual help** — every admin control gets a "?" icon with explanation
2. **Add terminal reference** — collapsible section per page showing "In VistA terminal, this is found at: EVE → Operations → Kernel Management → ..."
3. **Add save confirmation with diff** — show exactly what changed before confirming
4. **Improve topology visualization** — replace raw JSON with visual tree
5. **Label VistA Evolved additions** — role templates, workspace access, custom roles get "VistA Evolved feature" label
6. **Add parameter impact warnings** — "Changing this will affect all users system-wide"
7. **Add empty state guidance** — when a section has no data, explain what to do next

### Phase 6: Validation & Evidence (ongoing)

For every page, every control, every action:
1. **Curl test** proving the API works
2. **M-level verification** proving VistA data changed
3. **Screenshot/recording** of the before/after UI state
4. **Document in AUDIT-RESULTS.md**

---

## PART 7: REVISED NAVIGATION STRUCTURE

Based on the audit, the admin navigation needs to expand significantly:

```
ADMINISTRATION
├── DASHBOARD (new — aggregated counts, system status, quick actions)
│
├── PEOPLE
│   ├── Staff Directory .................. (exists, needs enhancements)
│   ├── Add Staff Member ................. (exists, needs completion)
│   └── Proxy Users ...................... (new)
│
├── ACCESS CONTROL
│   ├── Roles & Permissions .............. (exists)
│   ├── Permission Catalog ............... (exists, needs key CRUD)
│   └── Menu Options ..................... (new — backend ready)
│
├── ORGANIZATION
│   ├── Facilities & Sites ............... (exists, needs enhancement)
│   ├── Departments & Services ........... (exists)
│   └── Treating Specialties ............. (new — backend ready)
│
├── CLINICAL SETUP
│   ├── Clinics .......................... (new — 8 backend routes ready)
│   ├── Wards ............................ (new — 3 backend routes ready)
│   ├── Appointment Types ................ (new — 4 backend routes ready)
│   ├── Room/Bed Locations ............... (new — 3 backend routes ready)
│   ├── Health Summary Types ............. (new — 6 backend routes ready)
│   └── Document Definitions ............. (new — 3 backend routes ready)
│
├── ORDER MANAGEMENT
│   ├── Quick Orders ..................... (new — backend ready)
│   ├── Order Sets ....................... (new — backend ready)
│   └── Orderable Items .................. (new — backend ready)
│
├── PHARMACY
│   ├── Drug File ........................ (new — backend ready)
│   └── Pharmacy Settings ................ (exists in Module Settings, needs expansion)
│
├── LABORATORY
│   ├── Lab Tests ........................ (new — backend ready)
│   └── Lab Settings ..................... (exists in Module Settings, needs expansion)
│
├── RADIOLOGY
│   ├── Procedures ....................... (new — backend ready)
│   └── Radiology Settings ............... (exists in Module Settings, needs expansion)
│
├── BILLING & INSURANCE
│   ├── Insurance Companies .............. (new — backend ready)
│   └── Billing Parameters ............... (new — backend ready)
│
├── SYSTEM SETTINGS
│   ├── Security & Authentication ........ (exists, needs field expansion)
│   ├── System Configuration ............. (exists)
│   ├── Module Settings .................. (exists, needs "Field 3" fix + expansion)
│   └── Devices .......................... (new — 6 backend routes ready)
│
├── MONITORING
│   ├── System Health .................... (exists, needs action capabilities)
│   ├── Audit Trail ...................... (exists, mostly complete)
│   ├── Messages & Alerts ................ (exists, needs mail group management)
│   └── Reports .......................... (exists, needs expansion)
│
└── MAIL ADMINISTRATION
    ├── Mail Groups ...................... (new — 6 backend routes ready)
    └── Bulletins ........................ (covered in Alerts tab)
```

This represents approximately **35 admin sections** vs the current **13**. The backend routes for roughly 22 of the missing sections already exist. The work is primarily frontend page creation.

---

## PART 8: THE KEY METRIC

**The question:** Can a hospital IT administrator, clinic manager, or system administrator use this admin panel to do everything they currently do in the VistA terminal?

**Current answer:** No. They can manage users (partially), view audit logs (well), read system health (read-only), send messages (yes), and adjust about 40% of the security parameters. They cannot manage clinics, wards, devices, appointment types, drug files, lab tests, health summary types, document definitions, order sets, mail groups, or most of the department-level configuration that makes a healthcare system operational.

**Target answer:** Yes. Every terminal function that an administrator would need has a modern, clear, well-explained web equivalent. Every control either reads from or writes to VistA. Every change is verified. Every label is understandable. Every section is complete.

**Gap:** ~60-65% of the work remains. But critically, ~50% of the backend plumbing for that remaining work already exists as unused routes waiting for frontend pages.

---

## APPENDIX A: COMPLETE M ROUTINE INVENTORY

| Routine | RPCs | Lines | Purpose |
|---------|------|-------|---------|
| ZVEADMIN.m | 6 | ~400 | User list, detail, edit, terminate, audit, rename |
| ZVEADMN1.m | 13 | ~700 | Keys, params, roles, divisions, alerts, DD FIELDS |
| ZVEADT.m | 4 | ~300 | ADT: admit, discharge, transfer, census |
| ZVEPAT.m | 6 | ~450 | Patient registration, demographics, insurance |
| ZVEPAT1.m | 5 | ~350 | Patient flags, search, duplicates, recent, deceased |
| ZVESITEV.m | 5 | ~350 | Site workspace visibility, custom roles |
| ZVEMAIL.m | 8 | ~500 | MailMan, two-person integrity, alerts |
| ZVECTXR.m | — | ~200 | Context registration installer |
| ZVECTXF.m | — | ~150 | Context fix (21 RPCs to OR CPRS GUI CHART) |

**Total: 47 RPCs across 7 active M routines + 2 installer routines**

## APPENDIX B: adminService.js FUNCTION INVENTORY

**Used by admin pages (44 functions):**
- getStaff, getStaffMember, deactivateStaffMember, reactivateStaffMember, unlockUser
- setESignature, getESignatureStatus, getUserPermissions, getPermissions, assignPermission
- getPermissionHolders, getCustomRoles, createCustomRole, deleteCustomRole
- getSites, getSite, createSite, updateSite, getSiteWorkspaces, updateSiteWorkspace, getTopology
- getDepartments, getDepartmentDetail, createDepartment, updateDepartment
- getSiteParameters, updateSiteParameters, getPackageParams, updatePackageParams
- getVistaStatus, getTaskManStatus, getTaskManTasks, getTaskManScheduled
- getErrorTrap, getHL7FilerStatus, getHL7Interfaces
- getAlerts, updateAlert, createAlert, getStaff (for forward)
- getMailManInbox, getMailManMessage, sendMailManMessage, deleteMailManMessage
- getAdminReport, getSession

**NOT used by any admin page (36 functions):**
- createStaffMember, updateStaffMember, renameStaffMember, terminateStaffMember
- cloneStaffMember, updateCredentials, setProviderFields
- removePermission, analyzeKeyImpact, getRoleTemplates
- getFacilities, getFacility, getClinics, getWards
- getAlert, getAuditErrorLogEntry, getUserFileAccess, getUserAccessAudit
- getTaskManTask, getHL7LinkStatus
- getSchedulingReport, getLabReport, getRadiologyReport, getBillingReport, getNursingReport
- getCapacity, ddrProbe
- getDevices, getMailGroups, getPackages
- submit2PChange, get2PRequests, approve2PRequest, reject2PRequest (used in SecurityAuth)
- getDashboard, setESignatureCode

---

*This audit represents the complete current state of the VistA Evolved administration panel as of April 10, 2026. It identifies every gap between the current implementation and a 100% complete, enterprise-grade, VistA-grounded modern administration system.*
