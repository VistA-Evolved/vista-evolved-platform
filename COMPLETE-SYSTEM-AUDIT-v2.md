# VistA Evolved — Complete System Audit v2

> **This replaces all previous audit documents.**
>
> This audit starts from what VistA terminal actually does — researched from VA documentation,
> VistApedia, and our own VistA Docker — and compares against our modern equivalent.
> Every finding is traced to real code with exact file and line references.
>
> **Rules for the AI coder:**
> 1. You may NOT skip any item. If it's hard, build it. If it requires new M routines, write them.
> 2. You may NOT defer, stub, or placeholder anything. Every feature must work end-to-end with VistA.
> 3. After every VistA write: verify at M prompt. After every UI change: test in browser.
> 4. You validate your own work. You do not move to the next section until the current one is verified.
> 5. No lazy work. No shortcuts. No "this is a massive undertaking." You do the work.

---

# SECTION 1: FUNDAMENTAL ARCHITECTURE PROBLEMS

These are not code bugs — they are VistA concept misunderstandings built into our system.
They affect how users perceive and interact with the entire application.

## 1.1 CLINICS PAGE SHOWS ALL HOSPITAL LOCATIONS, NOT JUST CLINICS

### What VistA Terminal Does
In VistA, **File 44 (HOSPITAL LOCATION)** contains ALL locations within a facility:
- **Type C** = Clinic (outpatient scheduling location)
- **Type W** = Ward (inpatient unit)
- **Type OR** = Operating Room
- **Type M** = Module
- **Type Z** = Other

A typical VistA instance has 50-200+ File 44 entries. Only a fraction are actual clinics.
The terminal's `Scheduling Manager → Set Up a Clinic` menu only works with Type C entries.
The terminal's `ADT → Ward Definition` menu only works with Type W entries.

### What Our System Does
Our ClinicManagement page calls `GET /clinics` which runs:
```
ddrList({ file: '44', fields: '.01;1;8;1917;2505', ... })
```
**No TYPE filter.** It returns ALL File 44 entries — clinics, wards, operating rooms, everything.
This is why Ken sees "a whole lot of clinics" — they include wards and OR rooms labeled as clinics.

### How to Fix
**Option A (DDR filter):** Add a screen/filter to the DDR LISTER call to only return TYPE=C:
```javascript
ddrList({ file: '44', fields: '.01;1;2;8;1917;2505', fieldNames: ['name','abbreviation','type','stopCode','apptLength','inactivateDate'], screen: 'I $P(^SC(Y,0),U,3)="C"' })
```
**Option B (M routine):** Create `ZVE CLINIC LIST` that filters by type and returns richer data.

Also: Fetch the TYPE field (field 2) and display it. Show location type badges in the list.

**Verify:** After fix, Clinics page shows only TYPE=C entries. Wards page shows only TYPE=W. Operating rooms don't appear in either.

## 1.2 NAVIGATION CONFUSES VistA CONCEPTS

### The VistA Data Model
VistA has a specific organizational hierarchy:

```
INSTITUTION (File 4)
  = The physical hospital or facility (e.g., "VA Medical Center San Francisco")
  └── MEDICAL CENTER DIVISION (File 40.8)
        = An administrative division within the institution
        = A single VistA instance can serve multiple divisions
        └── HOSPITAL LOCATION (File 44)
              = A specific location within the division
              = Types: Clinic, Ward, Operating Room, Module, Other
              └── SERVICE/SECTION (File 49)
                    = Organizational departments (Cardiology, Radiology, etc.)
```

### What Our Navigation Shows
```
Clinical Setup
  ├── Clinics         → File 44 (but shows ALL types, not just clinics)
  └── Wards           → File 42 (correct file, but File 44 TYPE=W also exists)

Organization
  ├── Facilities & Sites  → File 40.8 Medical Center Division (only 3 entries)
  └── Departments         → File 49 Service/Section
```

### The Problems
1. **"Clinical Setup" is misleading** — clinics and wards are LOCATIONS, not clinical configuration.
2. **"Facilities & Sites" shows divisions (File 40.8), not facilities (File 4).** A division is NOT a facility — it's an administrative unit within a facility. The label is wrong.
3. **A clinic is NOT a facility.** In VistA, a clinic is a scheduling location within a division within a facility. Our nav groups them under different sections but the relationship isn't clear.
4. **Wards page uses File 42, but File 44 TYPE=W entries also exist.** These may or may not be the same records. This creates potential data inconsistency.
5. **There are only 3 entries in Facilities & Sites** because our Docker has 2-3 Medical Center Divisions. This is correct for the Docker but looks broken to the user.

### How to Fix
Restructure the admin navigation to match VistA's actual hierarchy:
```
Organization
  ├── Institution (File 4) — the hospital itself (name, address, station number)
  ├── Divisions (File 40.8) — administrative units within the institution
  ├── Departments (File 49) — clinical services/sections
  └── Devices (File 3.5) — printers, terminals

Locations
  ├── Clinics (File 44 TYPE=C) — outpatient scheduling locations
  ├── Wards (File 44 TYPE=W) — inpatient units
  └── Other Locations (File 44 TYPE=OR/M/Z) — operating rooms, modules

People
  ├── Staff Directory (File 200)
  ├── Add Staff Member
  └── Access Control
      ├── Roles & Permissions
      └── Permission Catalog (File 19.1)
```

**Label changes:** "Facilities & Sites" → "Divisions" (matches VistA). "Clinical Setup" → "Locations" (accurate). Add explanation tooltips.

## 1.3 ACCESS LETTER IS FUNDAMENTALLY WRONG

### What VistA Terminal Does When Creating a User
When an admin creates a user in the terminal, VistA displays the ACCESS CODE and VERIFY CODE on screen for the admin to write down and give to the user. The admin hands the user:
1. Their ACCESS CODE (username)
2. Their temporary VERIFY CODE (password)
3. Instructions to change the verify code on first login

### What Our Access Letter Prints
Our letter includes:
- Organization name
- Staff ID (DUZ) — meaningless to the user
- Title, Role, Department, Primary Site
- E-Signature status — irrelevant to a new user
- Provider credentials (NPI, DEA, Tax ID) — these are for the ADMIN, not the user
- **A list of raw security key names** (ORES, PROVIDER, ORCL-SIGN-NOTES, PSB NURSE) — completely meaningless to the recipient
- A footer saying "credentials were provided separately" — **but they were NEVER provided**

### How to Fix
The access letter should be a **welcome letter for the new staff member**:

```
═══════════════════════════════════════════════════
[Organization Name]
[Division Name]

WELCOME TO [SYSTEM NAME]
Account Access Information
═══════════════════════════════════════════════════

Dear [FIRST NAME LAST NAME],

Your account has been created. Please use the following credentials to sign in for the first time:

  Username:  [ACCESS CODE]     ← THE ACTUAL USERNAME
  Temporary Password:  [VERIFY CODE]    ← THE ACTUAL TEMP PASSWORD

  ⚠ You MUST change your password on first sign-in.
  ⚠ Do not share these credentials with anyone.

Your Role: [ROLE NAME in plain English, e.g., 'Physician' not 'ORES+PROVIDER+OR CPRS GUI CHART']
Department: [DEPARTMENT]
Primary Location: [DIVISION/FACILITY NAME]

WHAT YOU CAN DO:
  • [Human-readable capability list derived from keys]
  • e.g., 'Sign clinical orders' (not 'ORES')
  • e.g., 'View patient records' (not 'ORCL-PAT-RECS')
  • e.g., 'Administer medications via barcode' (not 'PSB NURSE')

GETTING STARTED:
  1. Go to [LOGIN URL]
  2. Enter your username and temporary password above
  3. You will be prompted to create a new password
  4. Set up your electronic signature when prompted

For help, contact: [IRM/IT Support Contact]

Date Issued: [DATE]
Issued By: [ADMIN NAME]
═══════════════════════════════════════════════════
CONFIDENTIAL — Destroy after first login
═══════════════════════════════════════════════════
```

**Critical:** The letter MUST include the actual access code and verify code. These are set during creation and the admin knows them at that moment. Pass them from the create response to the success screen to the letter.

**Remove:** Raw key names. DUZ/Staff ID. E-sig status. Provider credentials (NPI/DEA).
**Add:** Login URL. Step-by-step first-login instructions. Human-readable capabilities. Contact info.

## 1.4 DIVISION SELECTOR IN SYSTEM BAR IS CONFUSING

### What It Shows
The upper-right corner has a dropdown labeled with the division name (e.g., "VHU DIVISION"). Clicking shows a list of Medical Center Divisions from File 40.8.

### The Problem
1. **"VHU DIVISION" is VistA demo data jargon.** A real deployment would say "VA Medical Center San Francisco" or similar.
2. **The user doesn't know what selecting a different division does.** Does it filter staff? Filter patients? Change what data is visible? There's no explanation.
3. **If there's only one division** (common in small deployments), the dropdown serves no purpose and wastes space.

### How to Fix
- Add tooltip: "Select which facility's data to view. Staff and patients will be filtered to this location."
- If only 1 division exists, show it as static text (no dropdown).
- Show the division's station number alongside the name for identification.
- When changing division, show a brief toast: "Viewing data for [Division Name]"

---

# SECTION 2: SECURITY KEY SYSTEM

## 2.1 GMRA Key Name Wrong — Dash vs Space
RoleTemplates.jsx uses `GMRA-ALLERGY VERIFY` (dash). VistA key is `GMRA ALLERGY VERIFY` (space).
The sanitizer preserves dashes, so the dash reaches VistA and lookup fails.
**5 occurrences** in RoleTemplates.jsx: RN role, NP role, Surgeon role, KEY_IMPACTS, TASK_TO_KEY.
**Fix:** Replace all `GMRA-ALLERGY VERIFY` with `GMRA ALLERGY VERIFY`.
**Verify:** `M: W $O(^DIC(19.1,"B","GMRA ALLERGY VERIFY",0))` → must return >0.

## 2.2 All 43 Keys Must Be Verified at M Prompt
Run at VistA M prompt:
```mumps
S KEYS="PROVIDER,ORES,OR CPRS GUI CHART,ORCL-SIGN-NOTES,ORCL-PAT-RECS,GMRA ALLERGY VERIFY,ORELSE,PSB NURSE,OREMAS,PSORPH,PSJ PHARMACIST,PSOPHARMACIST,PSOINTERFACE,PSD PHARMACIST,PSDRPH,LRLAB,LRVERIFY,LRSUPER,LRMGR,LRCAP,SD SCHEDULING,SDCLINICAL,SD SUPERVISOR,SDMGR,DG REGISTER,DG REGISTRATION,DG ADMIT,DG DISCHARGE,DG TRANSFER,DG MENU,DG SUPERVISOR,DG SENSITIVITY,DGMEANS TEST,RA TECHNOLOGIST,RA ALLOC,MAG SYSTEM,MAG CAPTURE,XUMGR,XUPROG,XUPROGMODE,XUAUDITING,IBFIN,PSO MANAGER"
F I=1:1:$L(KEYS,",") S K=$P(KEYS,",",I) W !,K," → ",$S($O(^DIC(19.1,"B",K,0))>0:"EXISTS",1:"NOT FOUND")
```
Document every result. Fix any NOT FOUND keys.

---

# SECTION 3: DATA FLOW PROBLEMS

## 3.1 SSN Field Mapping Broken
Payload sends `ssnLast4`. EXTRA_MAP key is `ssn`. Keys don't match — SSN never written.
Even if matched, VistA field 9 requires 9 digits. Fix: Don't write last-4 to field 9. Use for display only.

## 3.2 Cosigner Search Always Returns Empty
searchCosignerProviders filters on `u.roles?.includes('ORES')` but list response has no `roles` field.
Filter always returns []. Fix: Use `u.isProvider` or create dedicated provider search endpoint.

## 3.3 Provider Type (53.5) Is a Pointer — Text May Fail
Field 53.5 points to File 7 (PROVIDER CLASS). Wizard sends text. DDR FILER with 'E' flag should resolve but verify.

## 3.4 Cosigner (53.42) Is a Pointer — Must Send DUZ Not Text
Field 53.42 points to File 200. If cosigner dropdown sends text name instead of DUZ, VistA rejects.

## 3.5 Language (200.07) Is a Sub-File — DDR May Fail
Test: Create user with language → M: `W $$GET1^DIQ(200,DUZ_",",200.07,"E")` → verify it works.

## 3.6 Controlled Substances (Field 55) — Data Type Unknown
Run: `M: D ^DID(200,55)` to check if field 55 is SET OF CODES, sub-file, or free text. Fix write method accordingly.

## 3.7 Employee ID in ^XTMP — Temporary Storage for Permanent Data
ZVEUEXT uses ^XTMP with 10-year purge. ^XTMP is for temporary data. Consider custom global ^ZVEX.

---

# SECTION 4: PERFORMANCE & LOADING ISSUES

Ken reports: "it's taking a long time everywhere to load data and communicate with the system" and "unable to load data" errors.

## 4.1 Clinics Page Returns Too Many Records (No TYPE Filter)
File 44 may have 100+ entries. We fetch ALL of them. Fix: Filter by TYPE=C. Result: 10-30 entries instead of 100+.

## 4.2 Staff Directory Loads ALL Users — No Server-Side Pagination
With 500+ users, getStaff returns everything. Fix: Use LIST2's MAX parameter. Add ?page=N&limit=25.

## 4.3 Two API Calls for Staff List (Staff + E-Sig)
Merge e-sig status into LIST2 M routine output. One call instead of two.

## 4.4 Detail Panel Makes 3 Parallel Calls
getStaffMember + getUserPermissions + getCprsTabAccess. Consider prefetching on hover.

## 4.5 No Connection Pooling for RPC Broker
Each API call may create a new broker connection. Pool connections for reuse.

## 4.6 No Gzip Compression on API Responses
Large JSON payloads uncompressed. Add Fastify compression middleware.

## 4.7 No Lazy Loading of Admin Pages
All 18 admin pages loaded upfront. Use React.lazy + Suspense per page.

## 4.8 30-Second API Timeout May Not Be Enough for Large Datasets
api.js has 30-second timeout. Querying File 44 unfiltered on a large VistA → may timeout.
Fix: Filter data at the source (TYPE=C). Also consider per-route configurable timeouts.

---

# SECTION 5: SECURITY

## 5.1 Session Token in sessionStorage — XSS Vulnerable
Move to httpOnly secure cookie.

## 5.2 CSRF Token Also in sessionStorage
CSRF token stored in JS-accessible storage defeats the purpose. Use meta tag or separate cookie.

## 5.3 Full SSN in DETAIL Response — Now Masked (Verify)
Previous fix masked to ***-**-1234. Verify: DevTools network tab → SSN masked in response JSON.

## 5.4 No Content-Security-Policy Header
Add CSP header to prevent inline script injection.

## 5.5 No X-Frame-Options Header
Site can be embedded in iframes for clickjacking. Add X-Frame-Options: DENY.

## 5.6 Login Rate Limiting — Verify It Works
Previous fix added rate limiting. Test: 6 rapid login attempts → 6th blocked.

---

# SECTION 6: USER CREATION FIELD-BY-FIELD AUDIT

The wizard collects 32 fields. For each one below: does create save it? Does edit update it? Does detail display it? Is it validated?

### Name (.01)
Create: ✓ (ZVE USMG ADD). Edit: ✓ (renameStaffMember). Display: ✓. Validate: ✓ (format, length, chars). Issue: apostrophes may fail VistA input transform.

### Sex (4)
Create: ✓. Edit: ✓. Display: ✓. Validate: ✓ (dropdown M/F). Complete.

### DOB (5)
Create: ✓. Edit: ✓. Display: ✓. Validate: ✓ (max=today). Issue: no minimum age check (can create user born today). Fix: min age 16.

### SSN (9)
Create: ✗ (key mismatch — ssnLast4 vs ssn). Edit: ✗ (not in FIELD_MAP). Display: ✓ (masked). Validate: ✓ (4 digits). Fix: See Section 3.1.

### Access Code (2)
Create: ✓ (ZVE USMG ADD hashes). Edit: ✓ (updateCredentials). Display: ✗ (correct — never show). Validate: ✓ (min 3, uniqueness check). Complete.

### Verify Code (11)
Create: ✓ (hashed). Edit: ✓. Display: ✗ (correct). Validate: ✓ (min 8, strength meter). Issue: field 11.2 date format — verify $$FMADD fix works.

### Email (.151)
Create: ✓ (EXTRA_MAP). Edit: ✓ (FIELD_MAP + inline). Display: ✓. Validate: ✓ (basic regex). Issue: no TLD validation.

### Phone (.132)
Create: ✓. Edit: ✓ (inline). Display: ✓. Validate: ✓ (10 digits). Issue: no formatting (raw digits stored). Fix: format display as (XXX) XXX-XXXX.

### NPI (41.99)
Create: ✓. Edit: ✓ (inline). Display: ✓. Validate: ✓ (10 digits). Issue: no Luhn checksum validation.

### DEA (53.2)
Create: ✓. Edit: ✓. Display: ✓. Validate: ✓ (2 letters + 7 digits). Issue: no DEA check digit validation.

### Division (200.02)
Create: ✓ (ZVE DIVISION ASSIGN). Edit: ✗ (not in FIELD_MAP — can't change division in edit mode). Display: ✓. Fix: Add division change to edit mode.

### Permissions (51)
Create: ✓ (loops ZVE USMG KEYS ADD). Edit: ✗ (edit mode doesn't handle key changes). Display: ✓. Fix: Track key changes in edit mode.

### Provider Type (53.5)
Create: ✓ (EXTRA_MAP). Edit: ✓ (inline). Display: ✓. Issue: pointer field — text may not resolve. Verify.

### Cosigner (53.42)
Create: ✓ (EXTRA_MAP). Edit: ✗. Display: ✓. Issue: search returns empty (Section 3.2). Sends text not DUZ (Section 3.4).

### Language (200.07)
Create: ✓ (EXTRA_MAP). Edit: ✓ (FIELD_MAP). Display: ✓. Issue: sub-file — may fail DDR (Section 3.5).

### Employee ID
Create: ✓ (ZVE UEXT SET). Edit: ✗. Display: ✓. Issue: ^XTMP storage (Section 3.7).

### Role
Create: ✓ (ZVE UEXT SET). Edit: ✗. Display: ✓. Issue: ^XTMP storage.

### Primary Menu (201)
Create: ✓ (EXTRA_MAP). Edit: ✓ (BASIC_FIELD_MAP). Display: ✓. Issue: no UI selector in wizard — defaults to whatever is sent.

### Degree (10.6)
Create: ✓ (EXTRA_MAP). Edit: ✓ (FIELD_MAP). Display: ✓. Issue: in wizard but only edit mode references it consistently.

### Sig Block (20.3)
Create: ✓. Edit: ✓. Display: ✓. Complete.

### Auth Meds (53.11)
Create: ✓. Edit: ✓. Display: ✓. Toggle. Issue: verify detail index mapping correct (detail[22]).

### FM Access (3)
Create: ✓. Edit: ✓. Display: ✓. Issue: what are valid values? VistA expects @, ^, or blank.

### Restrict Patient (101.01)
Create: ✓. Edit: ✓. Display: ✓. Issue: no explanation of what this does.

### VC Never Expires (9.5)
Create: ✓. Edit: ✓. Display: ✓. Issue: overrides VHA Directive 6500 compliance.

### Requires Cosign (53.08)
Create: ✓. Edit: ✓. Display: ✓. Complete.

### DEA Expiration (53.21)
Create: ✓. Edit: ✓. Display: ✓. Complete.

### CS Schedules (55)
Create: ✓ (EXTRA_MAP). Issue: field data type unknown — may fail (Section 3.6).

### Title (8)
Create: ✓. Edit: ✓. Display: ✓. Issue: pointer to File 3.1. Free text may fail — should be dropdown.

### Department (29)
Create: ✓. Edit: ✓. Display: ✓. Issue: pointer to File 49. Free text may fail — should be dropdown.

### displayName
Not sent in payload (removed). Good — VistA doesn't support it.

### secondaryFeatures
In payload but server ignores. Fix: either process or remove from wizard.

### OE/RR List (200.0001)
Not in wizard. Terminal allows this. Fix: add team selector.

---

# SECTION 7: STAFF DIRECTORY UX

### 🟢 [MEDIUM] No search debounce
Every keystroke re-renders. Fix: 300ms setTimeout debounce.

### 🟢 [MEDIUM] No column header sorting
DataTable has sort infrastructure but headers not clickable. Fix: wire handleSort to all column headers.

### 🟢 [MEDIUM] No role source badges on permissions
Can't tell role-assigned vs individual. Fix: badge each key with source.

### 🟢 [MEDIUM] Multi-division display is comma text
Fix: individual badges with primary star indicator.

### 🟢 [MEDIUM] Wizard can't jump to completed steps
Must navigate sequentially. Fix: make completed step labels clickable.

### 🟢 [MEDIUM] No review step diff highlighting
Edit mode review doesn't show what changed. Fix: color-code changed fields.

### 🟢 [MEDIUM] Password expiration not displayed
vcChangeDate exists in detail but not rendered. Fix: calculate and show 'Expires: July 15, 2026'.

### ⚪ [LOW] No user activity timeline
Only sign-on count shown. Fix: timeline of status changes.

### ⚪ [LOW] No CSV export as PDF option
Only CSV. Fix: add PDF export with all detail data.

### 🟢 [MEDIUM] Bulk import not built
Must create users one at a time. Fix: CSV upload → validate → create all.

### 🟢 [MEDIUM] No scheduled deactivation
Can't set future deactivation for temp staff. Fix: date picker → auto-deactivate.

### 🟡 [HIGH] Access letter fundamentally wrong
See Section 1.3 for complete redesign.

### ⚪ [LOW] E-sig clear button: verify conditional
Should show only when esigStatus==='active'. Verify.

### 🟢 [MEDIUM] Termination reason displayed for inactive users?
terminationReason is in detail data. Verify it renders.

---

# SECTION 8: REMAINING ADMIN PAGES — VERIFICATION REQUIRED

For each page, the AI coder must click every button, verify every action writes/reads VistA correctly.

## ClinicManagement (File 44)
- Fix TYPE filter (Section 1.1) — show only TYPE=C entries
- Create clinic → M: D ^DIQ(44,IEN) → verify all fields in File 44
- Edit clinic name → M: verify updated
- Inactivate → M: verify inactive flag (not deletion!)
- Reactivate → M: verify reactivated
- Clinic detail: show more than just name + stop code (terminal shows 20+ fields)
- Stop code: validate against File 40.7 entries
- Appointment length: validate numeric, reasonable range
- Availability: verify ZVE CLINIC AVAIL GET returns real data after deployment

## WardManagement (File 42)
- Ward list: comes from File 42 — verify entries are real wards
- Ward create → M: verify File 42 entry
- Ward edit → M: verify field update
- Consider also showing File 44 TYPE=W entries for cross-reference
- Bed count: is it live from VistA or static?
- No ward occupancy display — add census data from ZVE ADT CENSUS

## DeviceManagement (File 3.5)
- Create device → M: verify File 3.5 entry with all required fields
- Edit device → M: verify field update
- Delete device → M: verify gone
- Test print → verify ZVE DEV TESTPRINT actually sends output
- Device create needs more fields than just name (terminal requires margin, page length, type)

## MailGroupManagement (File 3.8)
- View members → M: verify members match File 3.8 sub-file
- Add member → M: verify sub-file entry created
- Remove member → M: verify sub-file entry removed
- Group descriptions not shown — load File 3.8 field 5.1
- No group creation from UI — terminal can create groups
- Mail group names are VistA jargon (IRM MAIL GROUP) — show descriptions

## SiteManagement (Facilities & Sites) (File 40.8/4)
- Rename to 'Divisions' to match VistA terminology
- Shows File 40.8 data — verify station numbers correct
- Workspace enable/disable toggles → verify ZVE SITE WS SET persists in VistA
- Custom role CRUD → verify ZVE SITE CR CRT/DEL work
- Site delete: no user assignment check — block if users assigned
- Consider adding File 4 (INSTITUTION) management for the parent facility

## DepartmentsServices (File 49)
- Create department → M: verify File 49 entry
- Delete department → MUST check for assigned users first
- No department hierarchy — File 49 is flat in VistA but org charts would help

## SecurityAuth (File 8989.3)
- Login security (2P): verify submit → pending → approve/reject flow works
- Session timeout change → M: verify Kernel Site Params updated
- IRM Mail Group: verify dropdown populated (not free text)
- 'No Auditing' option needs extra confirmation for compliance
- Pending 2P requests: no email notification to approver — add MailMan alert

## SystemHealth (File Various)
- HL7 status: verify ZVEHLFIL.m returns real data after deployment
- TaskMan status: verify ZVETMCTL.m returns real data
- HL7 shutdown/enable: test if interface state actually changes in VistA
- Error trap display: verify real errors from ^TMP("$ZE")
- Auto-refresh: verify 60-second refresh cycle works

## SiteParameters (File 8989.3+)
- Module parameters: verify ZVE DD FIELDS returns field labels (not 'Parameter #N')
- Save parameter → M: verify value updated in correct VistA file
- Change reason: enforce minimum 10 characters
- Some packages may write to wrong file — verify per-package

## AlertsNotifications (File 3.9)
- MailMan send → M: verify message in ^XMB
- MailMan delete → M: verify removed
- MailMan read: show full thread, not just single message
- MailMan compose: recipient is DUZ text field — should be user picker with name search
- Alert priority: verify VistA alert system supports HIGH/NORMAL/LOW
- No reply capability — add MailMan reply functionality

## AuditLog (File Various)
- 4 sources: FileMan audit, sign-on log, error trap, ZVE audit — verify each loads real data
- Date range filter: verify it actually filters
- No export (CSV/PDF) — add for compliance
- No filter by action type (login, key change, edit) — add dropdown

## AdminDashboard (File Various)
- Cards show real VistA counts? Verify against M prompt queries
- No auto-refresh — stale after creating users. Add 60s refresh.
- Cards not clickable — should navigate to filtered views
- No trend data (users this week vs last)

## AdminReports (File Various)
- Each report: does it return real VistA data?
- No PDF export — only CSV. Add PDF.
- No scheduled/recurring reports
- Long reports may timeout — add progress indicator

## SystemConfig (File 8989.3)
- Most fields read-only — add explanations why
- Welcome message: no preview of how it appears on login screen
- Broker timeout: what are valid ranges? Validate.

---

# SECTION 9: PATIENT REGISTRATION (12 Pages)

Each page must be verified against VistA terminal patient registration workflow.

## PatientSearch
Search by name: partial prefix only (VistA B-tree). Search by SSN: needs full 9 or special index for last-4. Duplicate detection: verify it runs before creation. Recent patients: verify ZVE RECENT PATIENTS works. Deceased patients: show flag in results.

## PatientDemographics
Terminal captures 90+ File 2 fields. Compare our form. Missing fields likely include: employer (.3111-.3116), next of kin (.211 sub-file), emergency contact (.219), country of birth (.092), mother maiden name (.2403), military service dates (.3211-.3216), agent orange exposure (.321101), radiation exposure (.3213), combat veteran status, POW status, enrollment priority (27.02). Address validation: state/zip format. Veteran status: affects eligibility. SC percentage: 0-100 in increments of 10.

## InsuranceCoverage
Creates in File 2.312 sub-file. Subscriber info required. Insurance company: pointer to File 36. Verify end-to-end write.

## FinancialAssessment
Means test: File 408.31. Income thresholds: current year? Classification: GMT/HVT/MT correct? Verify end-to-end.

## Admission
File 405 movement type 1. Ward validation: only active wards. Attending physician: valid provider with PROVIDER key. Treating specialty field.

## Discharge
File 405 discharge movement. Must reference admission. Disposition: pointer to File 37. Follow-up scheduling prompt.

## Transfer
Two movements in File 405. Bed assignment update. Transfer reason.

## BedManagement
File 405.4 room-bed tracking. Real-time availability. Bed status tracking.

## PatientFlags
File 26.13. Flag types match VistA categories. Review date. Narrative.

## RecordRestrictions
Sensitivity levels. Break-the-glass workflow. 38 USC 7332 compliance.

## PatientDashboard
Census, admissions today, discharges — real VistA data?

## RegistrationReports
Reports pull real VistA data? Completeness, coverage, means test reports.

---

# SECTION 10: TERMINAL COMPARISON — What Terminal Does That We Don't

Based on VistApedia documentation and VA Kernel 8.0 Systems Management guide:

### User Management → Add New User
5-page ScreenMan with 60+ fields. We capture ~32. Missing: address (.111-.116), home phone (.131), pagers (.133-.134), initials (1), pay grade (4.5), nickname (5.5), medical school (53.4), treating specialty (29.5), VA number (53.6). Research which are critical.

### User Management → User Inquiry
Terminal shows ALL File 200 data including sign-on history, creation date, creator, last option used. Our detail panel shows most but missing activity history.

### User Management → Grant Access by Profile (Clone)
Terminal's recommended way to create users. Copies all keys, menus, and delegation. Our clone copies keys but may miss menus and delegation.

### Key Management → Show Keys of a User
Terminal shows keys WITH assignment dates. Our list shows keys without dates.

### Key Management → Allocate Key to Multiple Users
Terminal does batch allocation in one operation. Our batch assign makes N sequential calls.

### Menu Management → Assign Primary Menu
Terminal sets field 201 with menu picker. Our wizard has no menu selector UI.

### Menu Management → Assign Secondary Menu
Terminal assigns secondary menu options (field 203). Our secondaryFeatures payload field is ignored.

### Menu Management → Display User Menus
Terminal shows complete menu tree. No equivalent in our UI.

### Device Management → Set Up a Device
Terminal creates with margin, page length, type, host file, form feed. Our create only sends name.

### TaskMan → Schedule/Unschedule Tasks
Terminal can schedule FileMan tasks. Our SystemHealth shows status but can't schedule.

### TaskMan → Requeue Failed Task
Terminal can retry failed tasks. No equivalent.

### MailMan → Forward Message
Terminal can forward messages. We have no forward.

### MailMan → Manage Baskets
Terminal has custom mail baskets/folders. We only have Inbox/Sent/Deleted.

### MailMan → Reply to Message
Terminal can reply in-thread. We have no reply.

### Kernel Site Parameters
Terminal edits 50+ parameters. Our SiteParameters handles a subset.

### Kernel → Prohibited Times
Terminal restricts login during certain hours. No equivalent.

### Audit → FileMan Audit by File
Terminal shows per-file audit. Our audit shows combined.

### Audit → Purge Old Audit Entries
Terminal can purge old entries. No equivalent.

### Division Setup
Terminal creates/modifies File 4 (INSTITUTION) entries. Our 'Facilities & Sites' only shows File 40.8 divisions.

### ADT → Scheduled Admissions
Terminal manages pre-admission scheduling. No equivalent.

### ADT → Treating Specialty Report
Terminal generates specialty-based reports. No equivalent.

### ADT → Patient Merge/Duplicate Resolution
Terminal can merge duplicate patients. No equivalent.

### Registration → Full 90+ Field Demographic Capture
Terminal captures employment, military history, environmental exposures, etc. Our form has ~15 fields.

---

# SECTION 11: M ROUTINE & SERVER ISSUES

### 🟢 [MEDIUM] ZVEADMIN DETAIL: output line may exceed 245-char broker limit
Detail line with 30+ pieces could exceed broker line length. Split across multiple lines if needed.

### 🟢 [MEDIUM] ZVEADMIN AUDITLOG: ^XTMP based — purge may delete audit trail
Audit should be permanent. Extend purge date or use dedicated file.

### ⚪ [LOW] ZVEUSMG ADD: no check for File 200 LREC lock
If file is locked, creation fails cryptically. Check and show clear error.

### ⚪ [LOW] ZVEUSMG KEYS: ORES/ORELSE check correct but no other mutual exclusions checked
Research if other key conflicts exist.

### 🟢 [MEDIUM] ZVEUSMG RENAME: no format validation
Could rename to invalid format. Validate LAST,FIRST format.

### 🟢 [MEDIUM] ZVEUSMG CHKAC: case sensitivity
VistA access codes are case-insensitive. Hash should be too. Verify.

### 🟢 [MEDIUM] ZVEUEXT: ^XTMP temporary storage
Employee ID and role should be permanent. Consider custom global.

### ⚪ [LOW] Server: 222 routes with no documentation
No OpenAPI spec. Add /api/docs endpoint.

### 🟢 [MEDIUM] Server: No request body size limit
Large payloads could crash. Set explicit Fastify limit.

### 🟢 [MEDIUM] Server: No request logging for audit
API requests not logged. Add structured logging.

### 🟢 [MEDIUM] Server: Concurrent requests may race on same user
Two admins editing same user → last write wins. Add optimistic locking.

---

# SECTION 12: ACCESSIBILITY & COMPLIANCE

### No focus management in wizard
Step change doesn't focus first field. Fix: useRef + focus.

### Color-only status indicators
Green/red badges without text. Colorblind users can't distinguish. Fix: add text or icon.

### No aria-live for dynamic messages
Success/error not announced to screen readers. Fix: aria-live='polite'.

### Modal focus trap missing
Tab escapes modals. Fix: trap focus inside.

### No skip-to-content link
Keyboard users tab through entire nav. Fix: hidden skip link.

### Form labels may use placeholder instead of label
Every input needs <label> with htmlFor.

### Section 508: color contrast ratio
Light gray text may fail 4.5:1 ratio. Run contrast checker.

### VHA Directive 6500: 15-min timeout
Verify cannot set >900 seconds.

### VHA Directive 6500: password 8+ chars mixed case
Verify frontend + Kernel enforce same rules.

### HIPAA: all PHI access logged
Every patient access must create audit entry. Verify.

---

# SECTION 13: ERROR HANDLING & RECOVERY

### VistA down mid-wizard
Data lost. Fix: auto-save to sessionStorage. Show retry with saved state.

### Create partial success
User created but 3 of 20 fields failed. Fix: show per-field results.

### Key assignment shows wrong count
Says '6 assigned' but 2 failed. Fix: check extraFields for errors.

### Clone error shows generic message
Fix: surface VistA error text.

### Deactivate error generic
Fix: surface specific VistA reason (e.g., 'has active orders').

### Network error shows stale data
Fix: clear data on error. Show retry button.

### Login error messages all similar
Wrong password vs expired vs VistA down look the same. Fix: distinct messages.

### Clinic create 'Unable to load data'
This is the error Ken sees. Investigate root cause — VistA timeout? Missing RPC? Permission?

---

# SECTION 14: END-TO-END WORKFLOW VERIFICATION

The AI coder must run each workflow start to finish and verify at M prompt.

- [ ] New employee onboarding: Create → assign role → print access letter (with real credentials!) → first login → forced password change → e-sig setup
- [ ] Employee departure: Deactivate with reason → verify DISUSER + reason + SSN intact
- [ ] Employee transfer: Change division → verify old removed, new added
- [ ] Role change (Nurse → NP): Remove ORELSE → add ORES + PROVIDER (mutual exclusion handled)
- [ ] Password reset: Admin resets → user logs in → forced change → new password works
- [ ] Clone user: Clone physician → new user has all keys → credentials set → can login
- [ ] Terminate user: Full termination → 0 keys, no credentials, DISUSER=1
- [ ] Lock/unlock: 3 failed logins → LOCKED status → admin unlocks → ACTIVE
- [ ] Patient registration: Search → no match → register → demographics → insurance → means test
- [ ] Patient admission: Search → admit → ward + bed assigned → movement in File 405
- [ ] Patient discharge: Select inpatient → discharge → movement created → bed freed
- [ ] Clinic management: Create clinic (TYPE=C only!) → edit → inactivate → reactivate

---

# SELF-AUDIT CHECKLIST

Before submitting, confirm ALL of these:

- [ ] Clinics page shows ONLY File 44 TYPE=C entries (not wards, OR rooms)
- [ ] Access letter includes actual ACCESS CODE and VERIFY CODE
- [ ] Access letter shows human-readable capabilities, NOT raw key names
- [ ] Navigation relabeled: 'Facilities & Sites' → 'Divisions' (or accurate VistA term)
- [ ] GMRA ALLERGY VERIFY uses SPACE not DASH — all 5 occurrences
- [ ] All 43 keys verified at M prompt — results documented
- [ ] SSN handling resolved — no invalid 4-digit data in field 9
- [ ] Cosigner search returns actual providers (not empty)
- [ ] Create physician → M: all fields saved (check 10+ at M prompt)
- [ ] Edit phone inline → M: field .132 updated
- [ ] Deactivate with reason → M: DISUSER=1, SSN unchanged, field 9.4=reason
- [ ] Reactivate → M: DISUSER cleared, SSN intact
- [ ] Clone → new user has all source keys
- [ ] Terminate → 0 keys, no creds, DISUSER=1
- [ ] First login → forced password change form appears
- [ ] SSN masked in browser DevTools response
- [ ] MailMan send → message exists in VistA
- [ ] Patient register → M: File 2 record complete
- [ ] Patient admit → M: File 405 movement
- [ ] grep -r 'window.confirm' → 0 results
- [ ] grep -r 'catch {' (empty catches) → 0 results
- [ ] Every button on every page clicked and verified
- [ ] Performance: Clinics page loads in <2s (after TYPE filter fix)
- [ ] Performance: Staff directory loads in <3s for 200+ users

---

*End of audit. Every item must work with real VistA. No exceptions. No shortcuts.*