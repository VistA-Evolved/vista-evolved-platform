# VistA Evolved — Admin Workspace Complete Specification

> **Source documents:** WF-11 (Doc 41), Page Contracts v1 (Doc 2), Security Matrix (Doc 21),
> Audit Matrix (Doc 22), API Gateway Spec (Doc 49), Wrapper RPC Master (Doc 48),
> Vocabulary Master (Doc 17), Design System (Doc 30), Volume 1 Admin (Doc 3.1)

---

## Banned Terms — NEVER appear in user-facing UI

| Banned VistA Term | Correct UI Term |
|---|---|
| DUZ | Staff ID (or just "ID") — never show "DUZ" |
| DFN | Patient ID — never show "DFN" |
| NEW PERSON #200 | "Staff Member" |
| SECURITY KEY #19.1 | "Permission" |
| Security Key | "Permission" |
| Division | "Site" |
| Medical Center Division | "Site / Campus" |
| Station Number | "Site Code" or "Facility Code" |
| Access Code | "Username" (login UI only) |
| Verify Code | "Password" (login UI only) |
| MailMan | "Notifications" or "System Notification" |
| TaskMan | "Background Tasks" or "Scheduled Task" |
| CPRS | Never shown to users |
| FileMan | Never shown to users |
| M / MUMPS | Never shown to users |
| RPC | Never shown to users |
| Kernel | Never shown to users |
| Package | "Module" |
| Option / Menu Option | "Feature" or "Menu Item" |
| KIDS Build | "System Update" |
| Global (^-prefixed) | Never shown to users |
| Person Class | "Provider Type" |
| Service/Section | "Department" |
| NAOU | Never shown to users |
| Green Sheet | Never shown to users |
| Clinic Stop | Never shown to users |
| Means Test | "Financial Screening" |
| VISN | "Region" |
| CBOC | "Community Clinic" |
| CLC | "Long-Term Care Facility" |
| Domiciliary | "Residential Treatment Facility" |
| Electronic Signature Code | "E-Signature" |

**Rule 1:** Column A terms NEVER appear for clinical users. Always use modern terms.
**Rule 2:** System administrators MAY see VistA terms as secondary labels/tooltips — e.g. `(VistA: SECURITY KEY #19.1)` — but only in admin-only panels.
**Rule 3:** Search must be bilingual — accept both VistA and modern terms and match them.

---

## Design System Enforcement

### Colors (exact hex values)
| Token | Value | Usage |
|---|---|---|
| Navy Primary | `#1A1A2E` | System Bar, Nav Rail, table headers, primary buttons |
| Steel Blue | `#2E5984` | Active states, links, section headers |
| Slate Blue | `#3A6FA0` | Hover states, info badges |
| Surface | `#FFFFFF` | Content area background |
| Surface Alt | `#F5F8FB` | Zebra stripe rows, panel backgrounds |
| Border | `#E2E4E8` | Table borders, input borders |
| Hover | `#EBEDF0` | Row hover |
| Danger | `#CC3333` | Errors, critical alerts — NEVER decorative |
| Warning | `#E6A817` | Warnings, approaching deadlines |
| Success | `#2E7D32` | Active status, confirmed |
| Info | `#1565C0` | Info badges, submitted status |

### Typography
- All text: `Inter` font family (fallback: Segoe UI, system-ui)
- Monospace (IDs, codes, timestamps): `JetBrains Mono` (fallback: Consolas)
- Page title: 28px bold (--font-size-2xl ~30px)
- Section header: 22px bold
- Body: 15px regular (--font-size-base)
- Small/helper: 13px regular (--font-size-sm)
- Fine print: 11px (--font-size-xs)

### Navigation Rail (IDENTICAL on every page)
Exactly 11 icons, this order, never changes:
1. Dashboard (grid icon) 2. Patients (people) 3. Scheduling (calendar) 4. Clinical (heart-monitor)
5. Pharmacy (pill) 6. Lab (flask) 7. Imaging (scan) 8. Billing (receipt)
9. Supply (package) 10. **Admin (gear) — ACTIVE** 11. Analytics (bar-chart)

Width: 64px. Background: `#1A1A2E`. Active icon: 3px white left accent bar.

### System Bar (IDENTICAL on every page)
Height: 40px. Background: `#1A1A2E`.
Left→right: "VistA Evolved" → breadcrumb → flexible space → notification bell + badge → user avatar + name + dropdown.
NO search bar. NO help icon. NO settings icon.

### Tables
- Header: `#1A1A2E` background, white text, uppercase labels, font-weight 500-600
- Rows: alternating white and `#F5F8FB` (zebra striping)
- Borders: 1px `#E2E4E8`
- Row hover: `#EBEDF0`
- Selected row: 3px left border `#2E5984` + `#E8EEF5` background

---

## REST API Routes (Admin Context: ZVE ADMIN CONTEXT)

All routes require valid JWT. Prefix: `/api/v1/admin/`

| Method | Route | RPC Called | Description |
|---|---|---|---|
| GET | `/admin/users` | ZVE USER LIST | List users with pagination, filter by status/division/role |
| POST | `/admin/users` | ZVE USER CREATE | Create new user |
| GET | `/admin/users/:duz` | ZVE USER LIST (single) | Get user detail by DUZ |
| PATCH | `/admin/users/:duz` | ZVE USER EDIT | Update user fields |
| POST | `/admin/users/:duz/keys` | ZVE KEY ASSIGN | Assign permission to user |
| DELETE | `/admin/users/:duz/keys/:keyIen` | ZVE KEY REMOVE | Remove permission from user |
| GET | `/admin/keys` | ZVE KEY LIST | List all permissions with holder counts |
| POST | `/admin/users/:duz/esig` | ZVE ESIG MANAGE | Manage e-signature setup |
| GET | `/admin/divisions` | ZVE DIVISION LIST | List all sites |
| GET | `/admin/roles` | ZVE ROLE TEMPLATE | Get role templates with key bundles |
| GET | `/admin/audit` | ZVE ADMIN AUDIT | Search audit log entries |
| GET | `/admin/params/:namespace` | ZVE ADMIN PARAMS | Read site parameters by namespace |
| PATCH | `/admin/params/:namespace` | ZVE ADMIN PARAMS (write) | Update site parameters |
| GET | `/admin/alerts` | ZVE ADMIN ALERT | List alerts for current user |
| POST | `/admin/alerts/:id/acknowledge` | ZVE ADMIN ALERT | Acknowledge alert |
| GET | `/admin/reports?type=...` | ZVE ADMIN REPORTS | Generate admin report |
| GET | `/admin/config/:section` | ZVE ADMIN CONFIG | Read master config section |
| PATCH | `/admin/config/:section` | ZVE ADMIN CONFIG (write) | Update master config |

---

## Page 1: Staff Directory

### Purpose
Browse, search, and manage all staff members in the system. Primary page for user management operations. Entry point to staff detail, editing, deactivation.

### Who Uses It
System Administrators, Location Administrators, ADPACs, Clinical Informatics

### Layout
- **Top:** Page header with title "Staff Directory", subtitle, "Export" button (secondary), "Add Staff Member" button (primary)
- **Summary cards row:** Total Staff, Active, Providers, E-Signature Incomplete (4 cards with icons and counts)
- **Search bar:** Full-width search by name, role, department, or identifier
- **Filter row:** Status dropdown, Role dropdown, Provider toggle, Site dropdown, Readiness dropdown
- **Active filter chips:** Show active filters with remove buttons
- **Data table:** Main worklist with columns below
- **Pagination:** 25 per page default. Total count displayed.

### Table Columns (exact order)
| # | Column | Data | Formatting |
|---|---|---|---|
| 1 | Name | LAST, FIRST MI | Bold, primary sort. Click opens detail/edit. |
| 2 | Staff Member ID | Internal ID | `font-mono`, never labeled "DUZ" |
| 3 | Role | Product role name | Text |
| 4 | Provider | Yes/No | Colored chip: Yes=steel-blue, No=gray |
| 5 | Department | Service/Section name | Text |
| 6 | Site | Division name | Text |
| 7 | Status | Active/Inactive/Locked/Pending | Badge: Active=green, Inactive=gray, Locked=red, Pending=blue |
| 8 | E-Signature | Ready/Incomplete/N/A | Badge: Ready=green, Incomplete=amber, N/A=gray |
| 9 | Permissions | Count | Monospace count badge. Tooltip on hover lists permission names. |
| 10 | Last Sign-In | Date/time | **Amber text if >30 days ago. Red text if >90 days or Never.** |
| 11 | Last Updated | Date | Text |
| 12 | Actions | Detail, Edit | Text links |

### Filters
- **Status:** Active (default) / Inactive / Locked / All
- **Role:** All Roles / Physician / Nurse / Nurse Manager / Pharmacist / Lab Technician / Radiology Technician / Scheduler / Front Desk / Billing Specialist / HIM Staff / System Admin / Read-Only
- **Provider:** All / Providers Only / Non-Providers
- **Site:** Dropdown from MEDICAL CENTER DIVISION #40.8 (multi-division sites)
- **Readiness:** All / Ready / Incomplete / Missing E-Signature / Missing Location
- **Last Sign-In Within:** Today / 7 Days / 30 Days / 90 Days / Never (for identifying unused accounts)

### Behavioral Rules
- **Row click:** Show detail panel (right 45%) OR navigate to Staff Detail page
- **Inactive Account Detection:** Users not signed in within 90 days flagged for investigation per VHA Directive 6500. >30 days = amber. >90 days = red.
- **"Locked" status** means failed too many login attempts — shows lock icon
- **"Inactive" status** means admin deactivated — record preserved for audit
- **Deactivate action** requires ConfirmDialog: "Deactivating this staff member will immediately prevent them from signing in. Their records will be preserved for audit purposes. Continue?" — sets DISUSER flag in #200
- **Provider fields visible in detail:** NPI, DEA#, Provider Type, Person Class, E-Signature status
- **Permission hover tooltip:** Shows list of permission names grouped by namespace
- **E-Signature admin rules:** Admin can CLEAR (reset) e-sig code but CANNOT VIEW or SET it (Kernel security design)
- **Virtual scrolling** for facilities with 5,000+ users

### Detail Panel (right 45%, on row selection)
- Name, Staff ID, SSN (masked: ***-**-1234, full display requires click + audit log), Title/Position
- Department, Site(s), Phone, Email
- Primary Menu, All Assigned Permissions (grouped by namespace: OR*, PSJ*, LR*, etc.)
- Provider fields if applicable: Person Class, NPI, DEA#, VA#
- Account Status: last sign-in, sign-in count, failed attempts, lock status
- Actions: Edit User, Assign Permissions, Assign Role, Clear E-Signature, Deactivate, Reactivate, View Audit Trail

### API Calls
- `GET /api/v1/admin/users?search=X&status=active&division=500&page=1&pageSize=25`
- RPC: ZVE USER LIST → reads NEW PERSON #200 (.01 NAME, #4 DISUSER, #1.01 last signon), SIGN-ON LOG #3.081

### Audit Rules
- View user list: L0 (no audit)
- View user detail: L1 (who viewed which user)
- Edit user: L2 (full before/after with field-level diff)
- Assign/remove permission: L2 (key assigned/removed, by whom, reason)
- Deactivate user: L2 (reason required, DISUSER flag change logged)

### Permission Rules
- Visible to: XUMGR (System Manager), XUSPF200 (Edit User Characteristics), or VE admin equivalent
- Hidden from Navigation Rail for non-admin users
- Read-only mode for Location Admins viewing other sites' staff

### States
- **Default loaded:** Table with data, summary cards populated
- **Loading:** Skeleton loaders in table and cards
- **Empty:** "No staff members found" + CTA "Add Staff Member"
- **No results:** "No results match your filters" + "Clear Filters" button
- **Backend unavailable:** Error banner "Unable to load staff directory" + Retry button
- **Permission denied:** Redirect or read-only mode, no Add/Edit actions

---

## Page 2: Staff Form (Create / Edit Wizard)

### Purpose
Multi-step wizard for creating a new staff member or editing an existing one. Maps to Kernel SM Guide Screens 1-5.

### Layout
- 6-step wizard with step indicator: Identity → Role & Work Type → Locations → Provider Setup (conditional) → Permissions & Features → Review & Create
- Step indicator shows progress with numbered circles: completed=green checkmark, active=navy, pending=gray
- Provider Setup step only visible if staff member is a provider

### Step 1: Identity Basics
| Field | Type | Required | Validation | VistA File/Field |
|---|---|---|---|---|
| Full Name | Text (uppercase) | YES | 3-35 chars, uppercase, LAST,FIRST MIDDLE format. Must contain exactly one comma. | #200 .01 NAME |
| Display Name | Text | No | Max 50 chars | Product overlay |
| Sex | Dropdown (Male/Female/Unknown) | YES | Must select one | #200 #4 SEX |
| Date of Birth | Date picker | YES | Valid date, not in future | #200 #5 DOB |
| Government ID (Last 4) | Text (masked) | Conditional | 4 digits | #200 #9 SSN |
| Email | Text | Conditional | Valid email format | Product overlay |
| Phone | Text | No | Phone format | #200 phone field |

**Duplicate check:** Auto-triggered on name+DOB entry. Search existing #200 entries for similar name/DOB combinations. Show warning if match found with side-by-side comparison.

### Step 2: Role and Work Type
| Field | Type | Required | Backend |
|---|---|---|---|
| Primary Role | Card selection grid | YES | Maps to PRIMARY MENU #201 + initial key bundle |
| Department | Dropdown | YES | SERVICE/SECTION #29 → #49 |
| Is Provider? | Toggle | No | Controls provider step visibility |

Available roles: System Administrator, Location Administrator, Scheduler, Front Desk/Registration, Nurse, Provider/Physician, Pharmacist, Laboratory Technician, Radiology Technician, Billing/Revenue Cycle, Health Information Management, Read-Only.

Each role maps to a primary menu option and initial permission bundle. Selecting "Provider" or "Pharmacist" auto-enables provider step.

### Step 3: Location Assignment
| Field | Type | Required | Backend |
|---|---|---|---|
| Primary Site | Dropdown | YES | DIVISION multiple #16 in #200 → INSTITUTION #4 |
| Additional Sites | Multi-select | No | Additional DIVISION entries |

Must select at least one site. This determines default sign-in context (DUZ(2)). Multi-site staff switch via System Bar.

### Step 4: Provider Configuration (conditional — only if provider)
| Field | Type | Required | VistA File/Field |
|---|---|---|---|
| Provider Type | Searchable dropdown | YES (for providers) | PERSON CLASS #8932.1 |
| NPI | Text (10 digits) | Conditional | NPI field in #200 |
| DEA Number | Text | Conditional | #200 field 53.2 |
| DEA Expiration Date | Date picker | If DEA entered | #200 field 53.7 |
| Authorized to Write Medications | Toggle | YES for prescribers | #200 field 53.1 |
| Controlled Substance Schedules | Multi-checkbox (II, IIN, III, IIIN, IV, V) | If DEA entered | #200 field 53.8 |

**CAUTION banner required:** "Provider fields determine prescribing authority and scope of practice. Incorrect configuration can allow a user to exceed their professional scope."

**NPI validation:** 10 digits + Luhn check digit.
**DEA validation:** 2 alpha + 7 numeric + check digit.
**Person Class scope enforcement:** If user classified as Medical Student is assigned Attending Physician role, system warns about scope mismatch.

### Step 5: Permissions & Features
- **Permission Groups:** Displayed as categorized checklists. Auto-populated from role selection, individually adjustable.
  - Clinical: ORES (Write orders), ORELSE (Verbal orders), OREMAS (Chart signature), DG-RECORD (View records), TIU-WRITE/SIGN (Notes)
  - Pharmacy: PSORPH (Outpatient), PSJ-VERIFY (Inpatient), PSOFORM (Formulary), PSB-ADMIN (Medication administration)
  - Laboratory: LRLAB (Core lab), LRVERIFY (Result verification), LRSUPER (Supervisor)
  - Scheduling: SD-SCHED (Appointments), SD-SUPER (Supervisor)
  - Registration: DG-ACCESS (Demographics), DG-SENSITIVE (Restricted records / break-the-glass)
  - System: XUMGR (System manager), XUPROG (Programmer access)

- **CRITICAL MUTUAL EXCLUSION:** ORES and ORELSE are mutually exclusive. The system MUST enforce this. When ORES is checked, ORELSE must be unchecked and disabled with warning. Per CPRS Setup Guide: "DO NOT give users both the ORES key and the ORELSE key."

- **Application Features (Secondary Menu Options):** OR CPRS GUI CHART (required for clinical users), PXRM CPRS CONFIGURATION, WEBG WEBVRAM GUI

### Step 6: Review and Create
- Summary panel showing all entered data organized by step
- Warning panel for: (a) missing required fields, (b) duplicate user, (c) provider without e-sig code
- Post-create guidance: "The new staff member should set their own electronic signature on first sign-in. Administrators cannot set the e-signature code for other users."
- Confirm button creates the record
- Post-create next steps: Open Staff Detail, Set Up E-Sig (guided), Add to Clinic Schedule, Return to Directory

### Backend Action Chain (ZVE USER CREATE)
1. Create entry in #200 with NAME, SEX, DOB, SSN
2. Set ACCESS CODE and VERIFY CODE (system-generated initial)
3. Set DIVISION multiple entries
4. Set PRIMARY MENU OPTION #201
5. Set SECONDARY MENU OPTIONS #203
6. Set SERVICE/SECTION #29
7. Assign permissions via KEYS multiple
8. If provider: set Person Class, NPI, DEA, pharmacy fields
9. Set SIGNATURE BLOCK PRINTED NAME #20.2
10. Return: new user IEN, success/failure, validation errors

### Audit Rules
- Create user: L2 — who created, when, roles/keys assigned
- Edit user: L2 — full field-level diff (old value → new value)

---

## Page 3: Permissions Catalog

### Purpose
Browse and manage the catalog of system permissions. This is a READ + ASSIGN page. **There is NO "Create New Permission" button.** Permissions are VistA system objects installed via software builds, not created by admins.

### Layout
- **Left 55%:** Searchable permission catalog table
- **Right 45%:** Detail panel (appears on row selection)

### Table Columns
| # | Column | Formatting |
|---|---|---|
| 1 | Permission Name | Bold |
| 2 | Module | Text (namespace: Order Entry, Pharmacy, Lab, etc.) |
| 3 | Description | Text |
| 4 | Staff Assigned | Count badge, monospace |
| 5 | Role Associations | Pill badges showing which roles include this permission |
| 6 | Actions | "View Staff", "Assign" links |

### Filters
- Search: by name, namespace prefix, description keyword
- Category tabs: All / Clinical / Pharmacy / Laboratory / Scheduling / Registration / System
- Filter by role association (permissions in a specific role)
- Filter by "orphaned" (permissions held by users but not in any role — ad-hoc manual assignments needing cleanup)

### Detail Panel (right 45%)
- Permission Name, Module, Category, Full Description
- **Staff with This Permission:** Scrollable list showing Name, Staff ID, Department, Role
- **System Reference (Admin Only):** Shows VistA key name (e.g., "ORES") as secondary reference per Doc 17 Rule 2. This is admin-only, never clinical-user-facing.
- **Dependency Map:**
  - Features Gated: which workspace pages require this permission
  - API Calls Gated: which RPCs check for this permission
  - Related Permissions: other permissions in the same namespace
- **Default Roles:** Which role templates include this permission

### Actions
- "Assign to Staff" — opens user search modal → confirm assignment → audit logged
- "Remove from Staff" — opens holder list → select user → confirm → audit logged. WARNING: if removing a permission that's part of user's role, system warns about role-permission mismatch.
- "Bulk Assign" — assign to all users matching criteria (role, department)
- "Associate with Role" — link to role template in Role Templates page

### Behavioral Rules
- Package namespace convention: OR* = Order Entry, PS* = Pharmacy, LR* = Lab, RA* = Radiology, DG* = Registration, SD* = Scheduling, IB* = Billing, MAG* = Imaging, SR* = Surgery, XU* = System
- Orphaned permission detection helps admins standardize access
- Every assignment/removal is audit-logged with: permission name, user affected, action, performed by, date/time, reason

### API Calls
- `GET /api/v1/admin/keys` → ZVE KEY LIST
- `POST /api/v1/admin/users/:duz/keys` → ZVE KEY ASSIGN
- `DELETE /api/v1/admin/users/:duz/keys/:keyIen` → ZVE KEY REMOVE

### Audit Rules
- Assign permission: RA (Reversible with Approval), L2
- Remove permission: RA, L2

---

## Page 4: Role Templates

### Purpose
Manage role templates that bundle permissions into assignable groups. This is a VistA Evolved ADDITION — native VistA has no role concept.

### Layout
- **Left 40%:** Role catalog list
- **Right 60%:** Role detail/editor with three tabs

### Pre-defined Roles (shipped with product)
Attending Physician, Resident Physician, Registered Nurse, Licensed Practical Nurse, Staff Pharmacist, Pharmacy Technician, Lab Technologist, Radiology Technologist, Dietitian, Social Worker, Psychologist, Dentist, Dental Hygienist, Scheduling Clerk, Registration Clerk, Billing Specialist, Coding Specialist, Medical Records, IRM/System Admin, ADPAC, Chief of Staff, Nurse Executive, Chief Pharmacist, Lab Director, Radiology Chief, Privacy Officer

### Role Detail Editor (3 tabs)
**Tab A: Permissions**
- Multi-select from all permissions in #19.1
- Grouped by namespace
- Each permission shows description tooltip

**Tab B: Workspace Access**
- Checklist of all 11 workspaces
- Per workspace: Visible (Y/N), then per-page: No Access / Read Only / Read-Write
- This is the mechanism for the Tenant Profile Matrix

**Tab C: Menu Options (legacy compatibility)**
- Primary Menu assignment (OPTION #19 entry)
- Secondary Menu Options
- Maintained for backward compatibility with VistA terminal access

### Role-to-Permission Mapping (from Doc 21)
| Role | VistA Keys Auto-Granted | Permission Count |
|---|---|---|
| Physician | ORES, PROVIDER, OR CPRS GUI CHART, DG SENSITIVITY (if authorized) | ~12 |
| Nurse | ORELSE, PSJI RNFINISH, OR CPRS GUI CHART | ~10 |
| Pharmacist | PSO PHARMACIST, PSJ RPHARM, PSS MFU, OR CPRS GUI CHART | ~15 |
| Lab Technologist | LRLAB, LRVERIFY, OR CPRS GUI CHART (read-only clinical) | ~10 |
| System Administrator | XUMGR, all configuration keys | ~25+ |
| Compliance Officer | XUAUDITING, DG SENSITIVITY, read-only clinical | ~8 |

### Impact Preview (below editor)
When editing a role's permissions or workspace access:
1. "Users Currently Assigned: N users" — listed by name
2. "Adding permission X will grant N users the ability to Y"
3. Key Conflicts: warns if role includes cross-category permissions

### Save & Propagation
On save: "This role is assigned to N users. Apply changes to all current holders?" YES applies immediately. NO saves definition for future assignments only.

### Behavioral Rules
- **ORES/ORELSE mutual exclusion enforced at role level.** A role cannot contain both.
- **Role hierarchy:** child roles inherit parent role's permissions. Modifying parent cascades.
- **Person Class validation:** assigning provider-level role to user with incompatible Person Class triggers warning.
- **Additive model:** roles add access. Individual permission overrides after role assignment take precedence.

### API Calls
- `GET /api/v1/admin/roles` → ZVE ROLE TEMPLATE

### Audit Rules
- Create/modify role: L2
- Assign role to user: L2

---

## Page 5: Site Parameters

### Purpose
Configure system-wide and package-specific parameters. Affects all users at the facility.

### Layout (three-column)
- **Left sidebar (260px):** Tree-style navigation organized by workspace/package
- **Center (flexible):** Parameter editor form
- **Right sidebar (300px):** Change preview & impact panel

### CAUTION Banner (REQUIRED)
"Changes to these settings affect all users at this facility. Verify changes carefully and document your reason before saving."

### Parameter Tree Navigation
- **System (Kernel):** Authentication & Sign-In, Session Management, Audit Configuration
- **Clinical (CPRS/OE-RR):** Order Entry Settings, Order Safety Checks, Clinical Notes
- **Pharmacy (PSO/PSJ/PSB):** Outpatient Prescriptions, Inpatient Medications, Medication Safety
- **Laboratory (LR):** General Lab Settings, Auto-Verification Rules
- **Scheduling (SD):** Scheduling Defaults, Walk-In Configuration
- **Patients/Registration (DG):** Registration Settings, Record Sensitivity
- **Billing (IB/PRCA):** Billing Parameters
- **Supply (GIP/IFCAP):** Supply Parameters
- **Surgery (SR):** Surgery Parameters
- **Interfaces (HL7):** Interface Parameters
- **VistA Evolved:** Theme & Appearance, Workspace Visibility, Design System Defaults

Search: parameter name search across all sections.

### Per-Parameter Display
- Parameter Name (bold)
- Current Value (editable: text/number/dropdown/toggle depending on type)
- Description
- Default Value (for reference)
- Allowed Values (enumerated or range)
- Last Changed (date + by whom)
- **Changed fields: YELLOW highlight background**
- **Critical parameters: RED warning icon**

### Critical Parameter Rules
1. **Session Timeout:** Hard ceiling of 15 minutes per VHA Directive 6500. If admin enters >15, show compliance warning AND **BLOCK the save**. Error: "VHA Directive 6500 requires session timeout ≤ 15 minutes. Value N is not permitted."
2. **Password Expiration:** Hard ceiling of 90 days.
3. **Failed Sign-In Lockout:** Hard ceiling of 5 attempts.
4. **Password Minimum Length:** Hard floor of 8 characters.
5. **Order Checks (Drug Interaction, Allergy, Duplicate):** Flagged critical. Changes require SECOND APPROVER (two-person integrity).
6. **Auto-Verify Lab Results:** Flagged critical. Changing from No→Yes means results release without manual review.
7. **BCMA Override Allowed:** Flagged critical. Too permissive = nurses bypass barcode verification.

### Impact Preview Panel (right 300px)
Before saving:
1. "You are changing [Parameter Name] from [Old Value] to [New Value]."
2. Impact: "This parameter affects: [functional impact description]"
3. Rollback info: history of last 5 changes with dates
4. **Reason for Change: text area (REQUIRED for audit)**

### Save Actions
- "Save Changes" — confirmation dialog lists all changes in diff format
- "Revert All" — undo all unsaved changes
- Per-parameter "Rollback" — revert to historical value
- After save: audit record created

### API Calls
- `GET /api/v1/admin/params/:namespace` → ZVE ADMIN PARAMS
- `PATCH /api/v1/admin/params/:namespace` → ZVE ADMIN PARAMS (write)
- Reads: KERNEL SYSTEM PARAMETERS #8989.3 + package-specific files (PSO SITE #59, LR SITE #69.9, RA SITE #79, DG SITE #43, SD SITE #44.1, IB SITE PARAMETERS)

### Audit Rules
- Change site parameter (Tier 1/2): RA, L2 — old value, new value, who, when, reason text

---

## Page 6: Site Management

### Purpose
Manage facilities, community clinics, and specialized sites. Configure which workspaces are available at each site.

### Layout
- **Left 40%:** Site list with search
- **Right 60%:** Site detail/editor

### Site Card (left panel)
- Icon (by type), Name, Facility Code (`font-mono`), Type badge, Staff Count, Status badge

### Site Detail (right panel)
**Profile section:**
- Name, Facility Code (was "Station Number"), Address, Phone, Fax
- Director, Chief of Staff, Nurse Executive
- Time Zone, Complexity Level (1a-3), Teaching Hospital (Y/N)
- Region (was "VISN")

**Product Profile Link:**
- Assigned Tenant Profile (e.g., "Profile A: Full Hospital")
- "Determines the master set of visible workspaces and features."

**Active Workspaces:**
- Toggle list of all 11 workspace names. Some sites may not have all workspaces (e.g., community clinic lacks Surgery, full Lab).
- Site visibility can RESTRICT below tenant profile but CANNOT EXPAND beyond it.

**Staff at This Site:**
- Count with "View Staff List" and "Add Staff to This Site" buttons

### Facility Code Format
- Main medical centers: 3 digits (e.g., 521)
- Community clinics: parent + suffix (e.g., 521A4, 521BY)
- Long-term care: NH suffix

### Multi-Site Context
When a user assigned to multiple sites switches active site via System Bar:
- Different patients become visible
- Different parameters apply
- Different workspaces may be available
- Reports scope to selected site

### API Calls
- `GET /api/v1/admin/divisions` → ZVE DIVISION LIST
- `PATCH /api/v1/admin/divisions/:id` → ZVE DIVISION ASSIGN
- Reads: INSTITUTION #4, MEDICAL CENTER DIVISION #40.8

---

## Page 7: Audit Log

### Purpose
Search and review all audit events. Supports HIPAA privacy investigations, compliance review, and override monitoring.

### Layout
- **Top:** Multi-criteria search bar
- **Main:** Event table with expandable detail rows
- **Actions:** Saved Searches, Export CSV

### Search Filters
| Filter | Type | Options |
|---|---|---|
| Staff Member | Text search | By name |
| Date Range | Date from/to | Date pickers |
| Action Type | Multi-select dropdown | All, Create, Read, Update, Delete, Sign, Override, Print, Export, Parameter Change, Login, Logout, Failed Login |
| Object Type | Multi-select dropdown | All, Patient Record, Order, Note/Document, Medication, Lab Result, Allergy, Vital Sign, Staff Account, Permission, Parameter, Role |
| Patient | Text search | For privacy investigations — "who accessed this patient" |
| Workspace | Dropdown | All, Clinical, Pharmacy, Lab, Scheduling, Patients, Admin, Billing |
| IP Address | Text | For tracing access source |

"Save Search" saves filter combination as named template (e.g., "Daily Override Review")

### Table Columns
| # | Column | Formatting |
|---|---|---|
| 1 | Timestamp | `font-mono`, date/time to second |
| 2 | Staff Member | Name + ID below in `font-mono` |
| 3 | Action | Colored badge: Create=green, Read=blue, Update=amber, Delete=red, Sign=purple, Override=orange |
| 4 | Object Type | Icon + text |
| 5 | Detail | Brief description |
| 6 | Patient | Clickable name (if patient-related), "—" if not |

### Override Row Highlighting
Override rows get subtle amber (`#FFF8E1`) background tint — highest-scrutiny actions.

### Expanded Detail (on row click)
- Session ID (`font-mono`)
- Client IP Address (`font-mono`)
- Workstation Name
- Application (VistA Evolved Web / VistA Terminal / CPRS / API)
- Full Before/After data for modifications (field-level diff)
- Override Justification (reason text user entered at time of override)
- Linked Events (related audit entries grouped under parent)

### Key Behavioral Rules
1. **Patient-specific audit:** Search by patient to see ALL staff who accessed that patient's record. Required for privacy investigations (HIPAA, VHA Directive 1605.01).
2. **Sensitive patient access:** Patients flagged as restricted have additional logging. Access reason (Direct Care / Chart Review / Administrative) is logged.
3. **Override audit types:** Drug interaction override, BCMA barcode override, formulary override, allergy override — all tracked with reason text. Reviewed by pharmacy, nursing, safety committees.
4. **Immutability:** Audit records CANNOT be edited, deleted, or modified. They are L3 (Legal Record) — append-only with hash chaining.
5. **Retention:** Minimum 3 years (6 years for some categories). Archival to long-term storage but remains searchable.
6. **Export:** CSV for compliance review.

### API Calls
- `GET /api/v1/admin/audit?user=X&action=Y&dateFrom=Z&dateTo=W&patient=P&page=1&pageSize=50`
- RPC: ZVE ADMIN AUDIT → reads VistA audit trail + VE audit log + SIGN-ON LOG #3.081

---

## Page 8: Alerts & Notifications

### Purpose
Manage clinical alerts, system notifications, and escalation rules. Unresolved alerts represent patient safety risk.

### Layout
- **Main tabs:** Alerts / Notifications / Configuration
- **Alerts tab:** Sub-tabs "My Alerts" and "System Alerts" + detail panel
- **Notifications tab:** Inbox-style list
- **Configuration tab:** Escalation rules, suppression, purge schedule

### Alert Item Display
- Priority indicator: High=red circle, Normal=blue, Low=gray
- Subject (bold if unread)
- Source, Timestamp, Preview snippet
- Status: New / Read / Resolved / Forwarded
- "Action Required" badge for items needing response

### Alert Detail Panel (right, on selection)
- Full alert body
- Related items table
- Actions: Take Action, Forward, Mark Read, Acknowledge & Dismiss

### Alert Types
- **Clinical Alert:** Critical lab result, unsigned order, STAT order — actionable items requiring response
- **System Alert:** Interface down, background task backlog, maintenance scheduled — informational but may need IRM action
- **Notification:** Install complete, password expiring, report generated — informational only

### Escalation Rules (Configuration tab)
Per alert type:
- Initial recipient assignment logic
- Escalation delay (hours)
- Escalation chain: recipient → backup → supervisor → facility director
- Example: Critical Lab Result — 30 min → Covering Provider → Department Chief → Facility Director

### Alert Configuration
- Alert suppression: ability to suppress low-value alerts facility-wide during planned maintenance
- Alert purge schedule: resolved alerts auto-purged after configurable retention (default 30 days)

### Behavioral Rules
1. Admin monitors accumulated unresolved alerts (e.g., provider on vacation with critical lab alerts piling up — redirect to covering provider)
2. Alert fatigue monitoring: if an alert fires 200 times/day, it needs tuning
3. **NO reference to "MailMan" anywhere in UI**

### API Calls
- `GET /api/v1/admin/alerts` → ZVE ADMIN ALERT
- `POST /api/v1/admin/alerts/:id/acknowledge` → ZVE ADMIN ALERT

---

## Page 9: System Monitor & Reports

### Purpose
Monitor background task status and generate operational reports.

### Layout
- **Health summary cards:** 4 cards (Background Tasks status, Task Queue depth, VistA Connection, Error Trap count)
- **Tabs:** Background Tasks / System Reports

### Background Tasks Tab
**Active Tasks table:**
| Column | Description |
|---|---|
| Task Name | What is running |
| Started | Timestamp (`font-mono`) |
| Duration | Running time |
| Status | Running (green pulse) / Waiting / Error (red) |
| Owner | Who scheduled |
| Actions | View Output, Stop Task |

**Scheduled Tasks table:**
| Column | Description |
|---|---|
| Task Name | What will run |
| Frequency | One-Time / Daily / Weekly / Monthly |
| Last Run / Next Run | Timestamps |
| Status | Active (green) / Suspended (amber) |
| Actions | Suspend / Resume |

**Task Queue Depth:** Count of waiting tasks. Alert if >30 (threshold).

### System Reports Tab
Report cards with selection → date range → generate → export:

1. **Staff Access Report:** Active users, sign-in frequency, inactive >90 days, failed attempts, locked accounts
2. **Permission Distribution:** By holder count, role alignment %, orphaned permissions
3. **Audit Summary:** Actions by type, by workspace, by period. Override counts and trends. Sensitive patient accesses.
4. **System Health:** VistA uptime, RPC response times, background task throughput, error trap summary
5. **Parameter Change Log:** All changes in period with who/when/old/new/reason
6. **Alert Compliance:** Resolution times by type, unresolved aging, escalated alerts

Each report: date range filter, site filter, KPI summary cards at top + data table, export (Print, CSV, PDF, Schedule).

### Background Task Criticality
If background tasks stop, automated processes halt: HL7 messages stop flowing, scheduled reports don't generate, CMOP transmissions stop. Background task status = continuous monitoring with auto-alert to IRM if stopped.

### Error Trap Monitoring
Error counts by namespace (which module is generating errors), trends (is a new update causing increased errors), specific error details for debugging.

### API Calls
- `GET /api/v1/admin/reports?type=user_access&dateFrom=X&dateTo=Y&division=Z` → ZVE ADMIN REPORTS
- Background task monitoring via ZVE ADMIN TASKMON → reads TASK #14.4, OPTION SCHEDULING #19.2

---

## Page 10: Master Configuration

### Purpose
Master system configuration. **HIGHEST PRIVILEGE PAGE.** Requires IRM Chief or equivalent access.

### CAUTION Banner (REQUIRED)
"This page contains master system configuration settings. Changes require IRM Chief authorization and affect all system operations. All changes are audit-logged."

### Layout
- **Left sidebar (240px):** Section navigation with "2P" badge on two-person-integrity sections
- **Center:** Configuration form
- "Access Level" notice in sidebar: "This page requires system administrator access."

### Configuration Sections

**Authentication Rules (TWO-PERSON INTEGRITY)**
| Setting | Default | Enforced Limit | VHA Directive 6500 |
|---|---|---|---|
| Session Timeout | 15 min | ≤ 15 min | YES — system REJECTS values >15 |
| Auto Sign-Off | 15 min | | |
| Max Concurrent Sessions | 2 | | |
| Failed Sign-In Lockout | 5 attempts | ≤ 5 | YES |
| Lockout Duration | 30 min | | Options: 0/15/30/60 min |
| Username Min Length | 6 chars | | |
| Password Complexity | Strong | | 8+ chars, mixed case, number, special char |
| Password Expiration | 90 days | ≤ 90 days | YES |
| Password History | 12 | | Prior passwords that can't be reused |

**E-Signature Rules (TWO-PERSON INTEGRITY)**
| Setting | Default |
|---|---|
| E-Sig Min Length | 6 chars |
| E-Sig Expiration | 0 days (never) |
| E-Sig Required for Orders | Yes |
| E-Sig Required for Notes | Yes |
| E-Sig Required for Results | Yes |

**Session Management**
- Concurrent session limit, idle warning time, allow session extension

**Role Template Defaults**
- Default role for new staff, role inheritance, conflict resolution policy

**Audit Configuration (TWO-PERSON INTEGRITY)**
- Retention period (years), audit scope (All/High-Risk), sensitive record audit level, archive schedule

**Alert Configuration**
- Default escalation time, max unresolved age, purge schedule

**System Maintenance**
- Maintenance window schedule, maintenance message, last backup verified

**Welcome Message (MOTD)**
- Display toggle, message text (shown on login screen)

### Two-Person Integrity
For sections marked with "2P":
1. Admin makes changes and enters reason
2. System generates a **pending change request**
3. A DIFFERENT admin must review and approve before changes take effect
4. Pending request appears in second admin's alert queue
5. This prevents a single compromised account from weakening security

**This is analogous to two-person integrity for nuclear launch codes.**

### VHA Directive 6500 Enforcement
The system validates values against hard-coded policy constraints. These CANNOT be overridden:
- Session timeout > 15 → REJECTED with "VHA Directive 6500 requires session timeout ≤ 15 minutes"
- Password expiry > 90 → REJECTED
- Lockout threshold > 5 → REJECTED
- Password length < 8 → REJECTED

### API Calls
- `GET /api/v1/admin/config/:section` → ZVE ADMIN CONFIG
- `PATCH /api/v1/admin/config/:section` → ZVE ADMIN CONFIG (write)
- Reads/writes: KERNEL SYSTEM PARAMETERS #8989.3

---

## Cross-Workspace Integration Points

| Integration | Admin Page | Connected To | Data Flow |
|---|---|---|---|
| User provisioning → All workspaces | Staff Directory, Staff Form, Role Templates | Every workspace | User's role determines Nav Rail visibility and page access |
| Permissions → Pharmacy | Permissions Catalog | Pharmacy verification queue | PSO PHARMACIST key gates pharmacist verification |
| Permissions → Clinical | Permissions Catalog | Clinical orders page | ORES key gates order writing. ORELSE gates verbal orders. |
| Parameters → Lab | Site Parameters | Lab auto-verify | Lab auto-verify parameters control which results auto-release |
| Parameters → BCMA | Site Parameters | Pharmacy BCMA | BCMA override parameters control barcode bypass rules |
| Sites → All workspaces | Site Management | Every workspace | Site context scopes data visibility and parameters |
| Audit → Patient chart | Audit Log | Clinical patient pages | Every patient access logged. Sensitive patient access requires reason. |
| Alerts → Clinical | Alerts & Notifications | Notification system | Clinical alerts managed through same alert system |

---

## Security Rules Summary (from Doc 21)

1. **ORES and ORELSE are MUTUALLY EXCLUSIVE.** System must enforce at role assignment time. Cannot have both Physician role (ORES) and Nurse role (ORELSE).
2. **Electronic signature MANDATORY for order signing.** Users with ORES must complete e-sig before orders release.
3. **LRLAB must NOT be given to non-lab staff.** System prevents assigning Lab roles to non-lab users.
4. **XUPROG (programmer access) must NOT exist in production.** System should not expose M programmer access through web UI.
5. **Break-the-glass for sensitive records:** DG SENSITIVITY key + formal BTG workflow: block → warning → justification → access → enhanced audit → supervisor notification.
6. **Temporary access elevation must be time-limited and audited.**
7. **Every permission assignment/removal must be auditable** with: who, what, when, by whom, resulting VistA key changes.

---

## Audit Classification for Admin Actions (from Doc 22)

| Action | Reversibility | Audit Level |
|---|---|---|
| Create user account | R | L2 |
| Edit user fields | R | L2 (field-level diff) |
| Assign permission/role | RA | L2 |
| Remove permission/role | RA | L2 |
| Deactivate user | RA | L2 (reason required) |
| Change site parameter | RA | L2 (old/new/reason) |
| Change master config | RA | L2 + two-person approval |
| View audit log | R | L1 |
| Export audit data | R | L2 (what exported, by whom) |
| Data purge/archive | I (Irreversible) | L3 (double confirmation) |
| Break-the-glass access | N/A (event) | L3 (BTG logged) |

**Reversibility codes:** R=Reversible, RA=Reversible with Approval, I=Irreversible
**Audit levels:** L0=None, L1=Basic, L2=Enhanced (full before/after), L3=Legal Record (immutable)
