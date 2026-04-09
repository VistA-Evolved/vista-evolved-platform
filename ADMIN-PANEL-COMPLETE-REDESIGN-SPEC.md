# VistA Evolved — Administration Panel Complete Redesign Specification

> **FOR THE AI CODER:** This document is your COMPLETE context. You have never seen this project before. Read every section. It tells you what VistA is, what we're building, what exists in the code, what's wrong, and exactly what to build. Every instruction is mandatory. Every backend call must be validated against the running Docker VistA instance.

---

## PART 1: WHAT IS VISTA AND WHY ARE WE DOING THIS

### 1.1 What VistA Is

VistA (Veterans Health Information Systems and Technology Architecture) is the electronic health record system built by the US Department of Veterans Affairs starting in the 1980s. It runs on a programming language called MUMPS (M) on a database engine called YottaDB (or InterSystems Caché). It manages EVERYTHING in a hospital: patients, scheduling, pharmacy, lab, radiology, billing, clinical notes, orders, and system administration.

VistA is arguably the most battle-tested EHR in the world — it handles over 9 million veterans across 1,200+ facilities. The underlying technology is proven and reliable.

**The problem:** VistA has NEVER had a proper web-based user interface. All administration — creating users, setting up security, configuring system parameters, managing facilities — is done through a text-based terminal. Think 1980s green screen. A system administrator types commands, answers prompts one at a time, and navigates through nested text menus. It works, but it's impenetrable to modern healthcare IT staff.

### 1.2 What We're Building

**VistA Evolved** is a modern web application (React SPA) that provides a beautiful, intuitive user interface for VistA. The web app communicates with a real VistA instance via RPC (Remote Procedure Call) broker connections. Every button click, every form save, every toggle — reads from and writes to the REAL VistA database. There is no separate database. VistA IS the database.

**This is a SaaS product.** Each customer (hospital, clinic, health system) gets their own VistA instance running in a Docker container. The web application connects to their specific instance. When a new customer signs up, a fresh VistA Docker is provisioned for them.

### 1.3 The Core Principle

**We are the MODERN FACE of VistA.** The terminal still exists. Everything we show in our web UI can also be done in the terminal. But our users will NEVER touch the terminal. They will only use our web application. So our web app must:

1. Do EVERYTHING the terminal admin can do (100% feature coverage)
2. Present it in a way that a modern hospital IT person INSTANTLY understands (no VistA jargon)
3. Actually WORK — every control reads from and writes to real VistA (no fake data, no hardcoded values)
4. Look like an enterprise SaaS product that competes with Epic, Cerner, Oracle Health

---

## PART 2: THE ARCHITECTURE AND REPOSITORIES

### 2.1 Three Repositories

**Repository 1: `vista-evolved-platform`**
The main application. Contains:
- `apps/web/` — React SPA (Vite + Tailwind CSS)
  - `src/pages/admin/` — 10 admin pages (the focus of this redesign)
  - `src/pages/patients/` — 12 patient pages
  - `src/services/adminService.js` — Frontend API client for admin (518 lines)
  - `src/services/patientService.js` — Frontend API client for patients (416 lines)
  - `src/services/api.js` — Base HTTP client with Bearer token auth
  - `src/components/` — Shared UI components (NavRail, SystemBar, PatientBanner, etc.)
- `apps/tenant-admin/` — Node.js Fastify backend server
  - `server.mjs` — THE backend (6,259 lines, 213 routes)
  - `lib/vista-adapter.mjs` — VistA RPC call helpers
  - `lib/xwb-client.mjs` — XWB broker protocol implementation

**Repository 2: `vista-evolved-vista-distro`**
The VistA distribution. Contains:
- `overlay/routines/` — 28 custom M/MUMPS routines (4,606 lines total)
  - `ZVEADMIN.m` — User management RPCs (list, detail, edit, terminate, audit, rename)
  - `ZVEADMN1.m` — Key management, e-sig, role templates, parameters, divisions
  - `ZVEPAT.m` — Patient registration, demographics, insurance, eligibility
  - `ZVEPAT1.m` — Patient flags, search, recent patients, duplicate detection
  - `ZVEADT.m` — Admit/Discharge/Transfer movements
  - `ZVESITEV.m` — Workspace visibility, custom roles
  - `ZVEMAIL.m` — MailMan inbox/read/send/delete
  - Plus 20 more supporting routines
- `docker/` — Docker Compose files for running VistA

**Repository 3: `VistA-Evolved`** (archive, read-only reference)

### 2.2 The Running Environment

```
┌─────────────────────────────────────────────────────┐
│ Docker Container: local-vista-utf8                   │
│ ├── YottaDB (M database engine)                     │
│ ├── VistA Globals (all data: patients, users, etc.) │
│ ├── VistA Routines (standard + our ZVE* customs)    │
│ ├── RPC Broker (port 9434)                          │
│ └── SSH access (port 2226)                          │
│                                                      │
│ Tenant-Admin Server (Node.js Fastify, port 4520)    │
│ ├── Connects to VistA via XWB broker protocol       │
│ ├── 213 API routes                                  │
│ └── Translates HTTP ↔ VistA RPC calls              │
│                                                      │
│ Web App (React Vite, port 3000)                     │
│ ├── Proxies /api/ta/v1/* → localhost:4520           │
│ └── User's browser connects here                    │
└─────────────────────────────────────────────────────┘
```

### 2.3 How Data Flows

```
User clicks "Save" on a form
  → React calls adminService.js function
    → HTTP PUT to /api/ta/v1/params/kernel
      → server.mjs route handler
        → callZveRpc() or ddrFilerEdit()
          → XWB broker sends RPC to VistA
            → M routine executes, reads/writes VistA global
          ← M routine returns result
        ← server.mjs parses response
      ← HTTP JSON response
    ← adminService resolves promise
  ← React updates UI with result
```

**CRITICAL RULE:** Every step in this chain MUST work. If any step fails, the user sees an error. There are NO mock fallbacks, NO hardcoded values, NO fake data.

---

## PART 3: WHAT THE VISTA TERMINAL ADMIN ACTUALLY DOES

When a VistA system manager logs into the terminal (`D ^ZU`), they see this menu:

```
Core Applications
Device Management
Menu Management
Programmer Options
Operations Management
  └── Kernel Management Menu
       ├── Enter/Edit Kernel Site Parameters
       ├── Establish System Audit Parameters
       └── Edit TaskMan Parameters
  └── User Management
       ├── Add a New User
       ├── Edit an Existing User
       ├── List Users
       ├── Find a User
       ├── Release User (unlock locked accounts)
       └── Proxy User List
  └── Security Key Management
       ├── Allocate Security Keys
       ├── Create/Edit Security Keys
       ├── Delete Security Keys
       └── Check for Multiple Keys
Spool Management
Information Security Officer Menu
  ├── Review Sign-On Log
  ├── Review Failed Access Log
  ├── Review Programmer Mode Usage
  └── Audit Option Usage
TaskMan Management
HL7 Main Menu
Capacity Planning
```

### 3.1 The Kernel System Parameters File (#8989.3)

This is the MASTER configuration file for VistA. When a terminal admin edits it, they see a ScreenMan form with these fields:

| Field | What It Controls | Type | Values |
|-------|-----------------|------|--------|
| DOMAIN NAME | System domain identifier | String | e.g., "GOLD.VAINNOVATION.US" |
| AGENCY CODE | Organization type | Code | V=VA, I=IHS, D=DoD, P=Private |
| DEFAULT TIMED-READ (SECONDS) | Session auto-signoff timeout | Number | 0-99999 (0=disabled) |
| MULTIPLE SIGN-ON | Same user on multiple devices | Yes/No | |
| PRODUCTION | Test vs Production environment | Yes/No | |
| AUTO MENU | Auto-display menu options | Yes/No | |
| TYPE-AHEAD | Allow type-ahead at prompts | Yes/No | |
| INTRO MESSAGE | Login screen welcome text | Text | Multi-line |
| VERIFY CODE CHANGE DAYS | Password expiration period | Number | 1-90 days |
| # OF FAILED SIGN-ON ATTEMPTS | Lockout threshold | Number | 1-99 attempts |
| DEFAULT LOCK-OUT TIME | Lockout duration | Number | Seconds |
| BROKER TIMEOUT | RPC response timeout | Number | Seconds |
| DISABLE NEW USER CREATION | Prevent auto-account creation | Yes/No | |
| OPTION AUDIT | What to audit | Code | A=All, N=None, S=Specific |
| INITIATE AUDIT | Audit start date | Date | |
| TERMINATE AUDIT | Audit end date | Date | |
| FAILED ACCESS LOG | Failed login logging mode | Code | A/D/AR/DR/N |
| MAX SIGNON ALLOWED | Concurrent user limit | Number | Per volume set |

**Our current web UI shows only 6 of these 18+ fields. The rest are either missing or hardcoded with fake values.**

### 3.2 The NEW PERSON File (#200)

This is the USER file. Every staff member has a record here. The terminal admin edits it across 5 ScreenMan pages:

- **Page 1:** Name, SSN, DOB, Sex, Title, Service/Section
- **Page 2:** Access Code, Verify Code, Electronic Signature
- **Page 3:** Division assignments (which facilities the user can access)
- **Page 4:** Security Keys (which capabilities the user has)
- **Page 5:** Provider fields (NPI, DEA, Person Class, Prescriptive Authority)

### 3.3 The SECURITY KEY File (#19.1)

Contains ~689 security keys. Each key has:
- **.01 NAME** — The coded name (e.g., "ORES", "PROVIDER", "A1AX APVCO")
- **Field 2: DESCRIPTIVE NAME** — Human-readable (e.g., "Release orders to services")
- **Field 3: PACKAGE** — Pointer to PACKAGE #9.4 (e.g., "Order Entry/Results Reporting")

**Our current web UI shows ONLY the coded name. It does NOT show the descriptive name or package. This is the #1 UX failure in the admin panel.**

---

## PART 4: WHO USES THE ADMIN PANEL AND WHAT THEY DO

### Persona 1: Hospital IT Administrator
**Job:** Set up and maintain the system for a hospital with 500+ staff
**Daily tasks:**
- Add new staff members when people are hired
- Deactivate accounts when people leave
- Reset locked accounts when people get locked out
- Assign appropriate access levels based on job role
- Monitor system health and fix issues
- Generate compliance reports

**What they expect:** A dashboard that shows system status at a glance. Quick actions for common tasks. Easy user search with smart filters. Bulk operations for efficiency.

### Persona 2: Clinic Owner / Practice Manager
**Job:** Set up VistA Evolved for a small practice (5-50 staff)
**One-time tasks:**
- Configure the system during initial setup
- Set up organization identity (name, address, type)
- Create user accounts for all staff
- Set security policies (password rules, session timeouts)
- Configure which modules/workspaces are active

**What they expect:** A setup wizard that walks them through initial configuration. Simple, guided experience. No VistA jargon. Modern SaaS feel.

### Persona 3: Security / Compliance Officer
**Job:** Ensure the system meets security and regulatory requirements
**Periodic tasks:**
- Review audit logs for unusual activity
- Verify password policies meet standards
- Check that inactive accounts are disabled
- Review who has elevated permissions
- Generate security compliance reports

**What they expect:** Audit dashboard with filtering. Security posture summary. Exportable reports.

---

## PART 5: THE ADMIN PANEL REDESIGN — SCREEN BY SCREEN

### Design Philosophy
- **Job-based navigation** — sections named for what users DO, not VistA file names
- **Zero VistA jargon** — no DUZ, no key names like A1AX APVCO, no "Not in VistA"
- **Progressive disclosure** — show common options first, advanced settings behind expandable sections
- **Validation-first** — every field change is validated and saved to VistA immediately or via explicit save with confirmation
- **Enterprise aesthetic** — clean, spacious, professional. Not cramped or prototypish.

### Navigation Structure (Left Sidebar)

```
ADMINISTRATION
├── PEOPLE
│   ├── Staff Directory
│   └── Add Staff Member  
├── ACCESS CONTROL
│   ├── Roles & Permissions
│   └── Permission Catalog
├── ORGANIZATION
│   ├── Facilities & Sites
│   └── Departments & Services
├── SYSTEM SETTINGS
│   ├── Security & Authentication
│   ├── System Configuration
│   └── Module Settings
├── MONITORING
│   ├── System Health
│   ├── Audit Trail
│   ├── Messages & Alerts
│   └── Reports
```

### Screen 1: Staff Directory

**Purpose:** Find, view, and manage all staff members.

**Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│ Staff Directory                           [+ Add Staff]      │
│ Manage staff accounts, roles, and access.                    │
├──────────────────────────────────────────────────────────────┤
│ KPI CARDS:                                                    │
│ [Total Staff: X] [Active: X] [Signature Ready: X] [Locked: X]│
├──────────────────────────────────────────────────────────────┤
│ Search: [________________________]  Filters: [Status▾][Role▾]│
│         [Hide system accounts ✓]             [Site▾]          │
├──────────────────────────────────────────────────────────────┤
│ NAME          │ ROLE       │ SITE      │ STATUS │ ACTIONS    │
│ Smith, Jane   │ Physician  │ Main Hosp │ Active │ [⋮]        │
│ Jones, Bob    │ Nurse      │ Clinic A  │ Active │ [⋮]        │
│ Chen, Li      │ Clerk      │ Main Hosp │ Locked │ [⋮]        │
└──────────────────────────────────────────────────────────────┘
```

**Every field maps to VistA:**
- Name → File #200 field .01
- Role → Derived from Title (#200 field 8) + Keys (field 51)
- Site → Division multiple (#200 field 16 → #40.8)
- Status → DISUSER (#200 field 4) + TERMINATION DATE
- Actions menu: Edit, Assign Role, Manage Permissions, Unlock, View Audit, Deactivate

**The detail panel (opens on row click):**
- Shows populated fields ONLY (hide empty ones)
- Permissions shown as HUMAN NAMES: "Write Clinical Orders" not "ORES"
- Quick actions as icon buttons, NOT navigation links

**Backend calls:**
- GET /users → ZVE USER LIST (ZVEADMIN)
- GET /users/:id → ZVE USER DETAIL (ZVEADMIN)
- POST /users/:duz/deactivate → ZVE USER TERM (ZVEADMIN)
- POST /users/:duz/reactivate → ZVE USER REACTIVATE

**MUST FIX:** Staff directory goes blank after navigation (state management bug). Departments load from VistA #49 not hardcoded. Filter "Hide system accounts" on by default.

### Screen 2: Add/Edit Staff Member

**Purpose:** Multi-step wizard to create or edit a staff account.

**Steps:**
1. **Identity** — Name (LAST,FIRST), Display Name, Sex, DOB, Email, Phone
2. **Role & Department** — Role template selection (cards, not dropdown), Department from VistA #49
3. **Facilities** — Primary site (dropdown from #40.8), Additional sites (checkboxes, EXCLUDING primary)
4. **Access & Signature** — E-signature setup (for providers), credential info
5. **Permissions** — Checkboxes grouped by department, showing HUMAN names only. No VistA key names visible. No "Not in VistA" badges.
6. **Review & Confirm** — Summary of all selections

**Backend calls:**
- POST /users → ZVE USER CREATE (ZVEADMIN)
- PUT /users/:ien → ZVE USER EDIT (ZVEADMIN)
- POST /users/:duz/keys → ZVE KEY ASSIGN (ZVEADMN1)
- DELETE /users/:duz/keys/:keyId → ZVE KEY REMOVE (ZVEADMN1)
- POST /users/:duz/esig/set → ZVE ESIG MANAGE SET (ZVEADMN1)
- GET /services → DDR on SERVICE/SECTION #49

**MUST FIX:** Remove "PROVIDER, ORES, ORELSE key mappings" text. Remove "Not in VistA" badges — disable unavailable permissions with tooltip. Primary site must exclude from additional sites. Use custom modal for e-sig clear, not window.confirm().

### Screen 3: Roles & Permissions

**Purpose:** Define role templates and manage the permission system.

**Layout:** Split view — role list (left), role detail (right)

**Left panel:** 14 built-in roles + custom roles. Each shows: name, description, staff count.
**Right panel for selected role:**
- Permissions tab: grouped by department, human-readable names
- Staff tab: who has this role
- Actions: Assign to Staff, Clone, Edit (custom only), Delete (custom only)

**Permission display:** Each permission shows:
- Human name (large): "Verify Pharmacy Orders"
- Description (small): "Review and approve outpatient prescriptions"
- System reference (collapsed, for admins): "PSORPH"

**Backend calls:**
- GET /roles → ZVE ROLE TEMPLATE (ZVEADMN1)
- GET /roles/custom → ZVE CUSTOM ROLE LIST (ZVESITEV)
- POST /roles/custom → ZVE CUSTOM ROLE CREATE (ZVESITEV)
- GET /key-inventory → ZVE KEY LIST (ZVEADMN1) — MUST return descriptive name + package

**MUST FIX:** Permission names must show DESCRIPTIVE NAME from #19.1 field 2. Module must show PACKAGE NAME from #9.4. No "Other" category — use real package names. Custom roles must persist to VistA (not browser memory).

### Screen 4: Facilities & Sites

**Purpose:** Manage the organization's facilities (divisions, clinics, departments).

**Shows:** List of sites from MEDICAL CENTER DIVISION #40.8. Each shows: name, site code, type, status.
**Actions:** Create site, edit site details, configure which workspaces are active per site.

**Backend calls:**
- GET /divisions → ZVE DIVISION LIST (ZVEADMN1)
- PUT /divisions/:ien → DDR FILER EDIT on #40.8
- POST /divisions → DDR FILER ADD on #40.8
- GET /workspaces?divisionIen=X → ZVE SITE WS GET (ZVESITEV)
- PUT /workspaces → ZVE SITE WS SET (ZVESITEV)

**MUST FIX:** Workspace toggles must persist (they now do via ZVESITEV). Edit site must save. All changes verified with readback.

### Screen 5: Security & Authentication (replaces "Master Configuration")

**Purpose:** Configure all security policies in one place.

**Organized by concern, NOT by VistA file structure:**

**Section A: Login Security**
- Session Timeout: [number] minutes (reads/writes DEFAULT TIMED-READ #8989.3 field 3.1)
- Auto Sign-Off Delay: [number] minutes (same field)
- Failed Login Lockout: After [number] attempts (field 7.3)
- Lockout Duration: [number] minutes (field 7.5)
- Password Expiration: Every [number] days (field 7, range 1-90)
- Allow Multiple Sessions: [toggle] (field 3.2)
- Max Concurrent Users: [number] (field 40.2)

**Section B: Electronic Signature**
- Minimum Signature Length: [number] characters (READ FROM VISTA — not hardcoded)
- Require for Orders: [toggle] (READ FROM VISTA — not hardcoded)
- Require for Clinical Notes: [toggle]

**Section C: Account Policies**
- Disable New Account Creation: [toggle] (field 10)
- Allow Account Self-Registration: [toggle]

**Section D: Audit & Logging**
- Enable Data Auditing: [toggle] (field 19)
- Audit Start Date: [date picker] (field 19.4)
- Audit End Date: [date picker] (field 19.5)
- Failed Access Logging: [dropdown: Off / Log All / Log Specific Devices] (field 212.5)

**Two-Person Integrity:** Sections A and B marked [2P]. Changes create a pending request. A DIFFERENT admin must approve. The submitter sees "Pending Approval" with a green badge. Another admin sees "Approve" / "Reject" buttons.

**Backend calls:**
- GET /params/kernel → ZVE PARAM GET (ZVEADMN1)
- PUT /params/kernel → ZVE PARAM SET (ZVEADMN1)
- POST /config/2p → ZVE 2P SUBMIT (via ^XTMP)
- GET /config/2p → ZVE 2P LIST
- POST /config/2p/:id/approve → ZVE 2P ACTION APPROVE
- POST /config/2p/:id/reject → ZVE 2P ACTION REJECT

**EVERY field reads from real VistA.** No hardcoded values. If a field is 0, show "Disabled — Security Risk" warning.

**Pending approval display must show human labels:** "Session Timeout: 300 → 381 seconds" NOT "auth / AUTOLOGOFF: 300 → 381". The "Cannot self-approve" button must be GRAY/DISABLED, not green.

### Screen 6: System Configuration (replaces "Backup Verification" + "Welcome Message")

**Purpose:** Organization identity and system settings.

**Section A: Organization Identity**
- Organization Name (from Institution #4)
- Domain Name (#8989.3 .01) — read-only display
- Facility Code (Station Number)
- Organization Type (AGENCY CODE translated: "Healthcare System", "Government VA", "Military DoD", "Indian Health Service")
- Environment: Production / Test (#8989.3 field 3.4)
- Time Zone

**Section B: Login Experience**
- Welcome Message (textarea, multi-line) — reads/writes INTRO MESSAGE (#8989.3 field 5)
- Server Response Timeout: [number] seconds — reads/writes BROKER TIMEOUT (#8989.3 field 8)

**Section C: System Information (read-only)**
- VistA Version
- Kernel Version
- Database Engine
- Server Address
- Connection Mode (direct-xwb)

### Screen 7: Module Settings (replaces "Site Parameters" package tabs)

**Purpose:** Configure package-specific settings (Pharmacy, Lab, Scheduling, etc.)

**Tab for each active package:**
- Pharmacy → reads File #59.7 via GET /params/pharmacy
- Lab → reads File #69.9 via GET /params/lab
- Scheduling → reads File #44 via GET /params/scheduling
- Radiology → reads File #79.1 via GET /params/radiology
- Surgery → reads File #136 via GET /params/surgery
- Clinical / Order Entry → reads File #100.99 via GET /params/order-entry

**Each tab shows the REAL parameters from that VistA file.** Not stubs. Not "Parameters Not Available." If a package has no parameters configured, show "This module has default settings. Configure as needed."

### Screen 8: System Health (replaces "System Monitor")

**Purpose:** Real-time system status dashboard.

**Top cards:**
- Background Tasks: Running / Stopped (with action context)
- VistA Connection: Connected / Disconnected
- Error Count: [number] (link to error detail)
- Current User: [name] (NO "DUZ: 1" — just the name)

**Tabs:**

**System Health tab:**
- When TaskMan is STOPPED: Show a single prominent card explaining what this means and what to do. Do NOT show 15 task rows with blank data.
- When TaskMan is RUNNING: Show task table with HUMAN NAMES:
  - "MailMan Queue Processor" not "XMKPLQ"
  - "HL7 Incoming Filer" not "HLCSIN"
  - "Background Task Runner" not "XQ1"
  - Each with real status: Running / Idle / Scheduled / Not Running

**HL7 Interfaces tab:**
- GET /hl7-interfaces → reads HL7 LOGICAL LINK #870
- Show table: Interface Name, Direction, Partner System, Status, Last Message, Errors
- Filer status at top: Incoming [Running/Stopped] Outgoing [Running/Stopped]

**Error Log tab:**
- Show errors with HUMAN-READABLE summaries, not raw M text
- "Parameter mismatch in user management (ZVEUSMG)" not "ADD~ZVEUSMG, %YDB-E-ACTLSTTOOLONG"
- Expandable "Technical Details" for the raw error

**Reports tab:**
- 6 report types with Generate / CSV / Print buttons
- Column headers MUST be human-readable: "Staff ID" not "DUZ", "Permission Name" not "IEN"
- Permission Distribution report MUST show permission names and modules, not just IEN + count

### Screen 9: Audit Trail

**Purpose:** Security and compliance audit log.

**Tabs:** All Events, Sign-On Activity, Data Changes, Failed Access, Programmer Mode

**Filters:** Staff Member (typeahead search by NAME, not raw DUZ input), Date Range, Action Type

**Backend calls:**
- GET /audit/signon-log
- GET /audit/fileman
- GET /audit/error-log
- GET /audit/failed-access
- GET /audit/programmer-mode

**MUST FIX:** When navigating from Staff Directory "View Audit Trail", pass staff member NAME, not DUZ number. If filter returns 0 results, show helpful message with "Clear Filters" button.

### Screen 10: Messages & Alerts

**Purpose:** System messaging and alert management.

**Tabs:** Alerts (VistA alerts), Messages (MailMan), Notifications (system)

**Alerts tab:**
- List from VistA alert system
- Actions: Acknowledge, Delete, Forward, CREATE NEW
- "New Alert" button opens compose modal

**Messages tab (MailMan):**
- Split view: inbox list (left), message body (right)
- Folders: Inbox / Sent / Deleted
- Compose button → modal with To (staff search), Subject, Body
- Read/delete/forward actions

**Backend calls:**
- GET /mailman/inbox → ZVE MM INBOX (ZVEMAIL)
- GET /mailman/message/:ien → ZVE MM READ (ZVEMAIL)
- POST /mailman/send → ZVE MM SEND (ZVEMAIL)
- DELETE /mailman/message/:ien → ZVE MM DELETE (ZVEMAIL)
- POST /alerts → ZVE ALERT CREATE

---

## PART 6: BACKEND VALIDATION REQUIREMENTS

### 6.1 The Docker VistA Instance

A VistA Docker container (`local-vista-utf8`) is running with:
- RPC Broker on port 9434
- SSH on port 2226
- VEHU test data (200 test users, test patients)
- All ZVE* custom M routines installed

### 6.2 How to Validate

**Before claiming ANY feature works, you MUST:**

1. Start the tenant-admin server: `cd apps/tenant-admin && node --env-file=.env server.mjs`
2. Login: `curl -s -X POST http://127.0.0.1:4520/api/tenant-admin/v1/auth/login -H "Content-Type: application/json" -d '{"accessCode":"PRO1234","verifyCode":"PRO1234!!","tenantId":"default"}'`
3. Use the returned token for all subsequent API calls
4. For EVERY read operation: call the API, verify you get real VistA data (source: "zve" or "vista")
5. For EVERY write operation: call the API, THEN verify at the M prompt that the data was written:
   ```bash
   docker exec -it local-vista-utf8 mumps -run %XCMD 'D Q^DI'
   ```
   Then query the relevant file and confirm.

### 6.3 What "Working" Means

A feature is NOT working unless:
- The frontend renders correctly
- The frontend calls a real API endpoint
- The API endpoint calls a real VistA RPC or DDR operation
- The VistA operation reads from or writes to the correct file
- For writes: the data can be read back from VistA confirming it was saved
- Zero VistA jargon visible to the user
- Zero hardcoded fake values
- Zero window.confirm() or window.alert() — only custom modals

---

## PART 7: SPECIFIC ISSUES TO FIX (FROM REAL USER TESTING)

These were found by the product owner clicking through the live application:

1. **Permissions show raw VistA key names** (A1AX APVCO, ABSV MGR) — must show descriptive names
2. **Staff directory goes blank** after navigating to Assign Permissions and back
3. **Staff detail panel shows all dashes** for empty fields — hide empty fields instead
4. **"PROVIDER, ORES, ORELSE key mappings"** text visible in Edit Staff permissions step
5. **"Not in VistA" red badges** on permissions — must be removed, use disabled+tooltip instead
6. **window.confirm()** used for e-signature clear — must use custom modal
7. **Audit log pre-filters to empty** when navigating from staff "View Audit Trail"
8. **Departments dropdown hardcoded** to 12 items — must load from VistA #49
9. **Primary Site doesn't exclude** from Additional Sites checkboxes
10. **"Assign Permissions" navigates to blank page** — must open modal instead
11. **Permission count inconsistency** — catalog shows 1 holder, detail shows 0
12. **E-Signature Rules hardcoded** ("6" and "Yes") — must read from VistA
13. **Audit Configuration hardcoded** ("3 years") — must read from VistA
14. **Session Management has only 1 field** — must show all 7 security parameters
15. **Pending approval shows "auth / AUTOLOGOFF"** — must show "Session Timeout"
16. **"Cannot self-approve" button is GREEN** — must be gray/disabled
17. **System Monitor shows "DUZ: 1"** — must show user name only
18. **Task names are raw M routines** (XMKPLQ, HLCSIN) — must show human names
19. **All task status shows "—"** — must show "Not running" when TaskMan stopped
20. **HL7 page shows only filer status** — must show configured interface list
21. **Error trap shows raw M errors** — must show human summaries
22. **Reports show "DUZ" column** — must show "Staff ID"
23. **Permission Distribution report shows only IEN + count** — no permission names
24. **Report headers are raw JSON keys** — must use human-readable column names
25. **Missing: Unlock User** feature (terminal has Release User [XUSERREL])
26. **Missing: Password Expiration setting** (field exists in #8989.3)
27. **Missing: Lockout Attempts setting** (field exists in #8989.3)
28. **Missing: Lockout Duration setting** (field exists in #8989.3)
29. **Missing: Multiple Sign-On setting** (field exists in #8989.3)
30. **Missing: Concurrent User Limit** (field exists in #8989.3)

---

## PART 8: COMMIT RULES

- Frontend and server changes → commit to `vista-evolved-platform`
- M routine changes → commit to `vista-evolved-vista-distro`
- After changing M routines, deploy to Docker:
  ```bash
  docker cp overlay/routines/ZVEADMN1.m local-vista-utf8:/opt/vista/r/ZVEADMN1.m
  docker exec local-vista-utf8 mumps -run %XCMD 'ZLINK "ZVEADMN1"'
  ```
- After changing server.mjs, restart the tenant-admin server
- After every change, run validation tests against Docker VistA

---

## PART 9: DELIVERABLES

When done, you must have:

1. **All 10 admin pages rebuilt** with the designs in Part 5
2. **All 30 issues from Part 7 fixed**
3. **All backend calls validated** against running Docker VistA
4. **Zero VistA jargon** visible to users anywhere in the admin panel
5. **Zero hardcoded values** — everything reads from real VistA
6. **Zero broken controls** — every button, toggle, form, and dropdown works
7. **AUDIT-RESULTS.md** documenting every validation test performed
