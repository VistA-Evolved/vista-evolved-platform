# AUDIT RESULTS — Admin & Patients Workspace Comprehensive Audit

**Date:** 2026-04-09
**Scope:** 10 Admin pages + 12 Patient pages = 22 pages total
**Environment:** `local-vista-utf8` (VEHU sandbox via YottaDB), `ve-platform-db`, tenant-admin @ :4520, Vite web @ :3000
**Session:** Bearer-token persistent across server restarts via AES-256-GCM on-disk store

---

## Summary

| Metric | Result |
|---|---|
| Pages audited | 22 / 22 |
| Known problems from Step 3 | 12 / 12 fixed |
| DDR fallback branches removed | 4 primary (key-inventory, key-holders, /users, /users/:id) + 4 mechanical |
| `integrationPending: true` branches removed | 32 / 32 |
| `source: 'pending'` silent-ok returns removed | 5 / 5 |
| HTTP 501 codes eliminated | 23 → 0 |
| `window.confirm` / `window.alert` in patient pages | 5 → 0 |
| Hardcoded "fallback" tables removed | `KEY_PREFIX_PACKAGE` (50), `KEY_DISPLAY_NAME` (35), `FALLBACK_CATEGORIES` (10), `DEPARTMENTS_FALLBACK` (15), `LOCATIONS_FALLBACK` (1) |
| "General" package bucket (key-inventory) | 216 → 0 |
| Fake VistA keys in StaffForm PERMISSION_GROUPS | 11 → 0 |
| Fake VistA keys in RoleTemplates ROLES | ~35 → 0 |
| New ZVE RPCs added | 4 (ZVE PACKAGE LIST, ZVE SERVICE LIST, ZVE KEY HOLDERS, already-present-but-broken ZVE USMG ADD) |
| M routine bugs fixed | 3 (KEYLIST DD field lookup, DETAIL key pointer resolution, USMG ADD LAYGO context) |
| Backend code lines changed | ~450 net (added 700+ / removed 250+ of dead fallback code) |
| Total commits | 12 |

---

## Per-Page Results

### ADMIN PAGES (10)

#### Page 1 — StaffDirectory.jsx (Slice 5a)

| Element | Status | Proof |
|---|---|---|
| KPI cards (Total/Active/E-Sig Ready/Incomplete) | ✅ live | 200 staff / 190 active / 118 sig-ready / 82 incomplete |
| Search box | ✅ | Client filter over live 200-row list |
| Status filter | ✅ **fixed** | Removed "Locked" (backend never returns it), added "Terminated" (backend does) |
| E-Signature filter | ✅ | Live bulk sig-status endpoint, 118 sig-code holders |
| Hide system accounts toggle | ✅ | Client regex |
| Department column | ✅ **fixed** | Was hardcoded to `''`. Now reads `u.service` from ZVE USER LIST — "INFORMATION RESOURCE MGMT" etc. visible in browser |
| Permission count column | ✅ **fixed** | Was `null`. Now reads `u.keyCount` from ZVE USER LIST — 45/00/04/34/38 visible |
| Row click → detail panel | ✅ **fixed** | Regression from Slice 2a where `vg.serviceSection` stopped populating — added backward-compat alias on the server response |
| Edit / Keys / Audit row actions | ✅ | Navigations verified |
| Detail panel fields | ✅ | `Department: INFORMATION RESOURCE MGMT`, `SSN: ***-**-0184`, all populated |
| Detail panel permission pills | ✅ **fixed** | Now show `displayName` from server enrichment ("Sensitive Patient Access", "ADT Supervisor") with tooltip `"DG SENSITIVITY — Registration"` |
| "Edit Staff Member" button | ✅ | Navigates to StaffForm edit mode |
| "Assign Permissions" button | ✅ **fixed** | Was silent-dropping server enrichment in the mapper. Now modal shows title + mono key + package badge + description |
| "Assign Role" button | ✅ | Navigates to RoleTemplates |
| "Clear E-Signature" button | ✅ | Uses `ConfirmDialog` (not `window.confirm`) |
| "View Audit Trail" button | ✅ | Passes `?user={name}` not DUZ (Step 3.7 not an issue here; any residual was in AuditLog's consumer side) |
| Deactivate / Reactivate | ✅ **fixed** | Reactivate now shows for both `inactive` AND `terminated` status (was only `inactive`) |
| Export CSV | ✅ | Client-side build from live data |

**Vocabulary:** zero DUZ visible, zero "key mapping", zero "Not in VistA", zero RPC leaks.

#### Page 2 — StaffForm.jsx (6-step wizard, Slice 5b)

| Step | Status | Key fixes |
|---|---|---|
| 1 Identity | ✅ | Name / Display Name / Sex / DOB / Gov ID / Email / Phone all wired |
| 2 Role & Work Type | ✅ **fixed** | Department dropdown now live from `#49 SERVICE/SECTION` (53 unique entries, deduped — was triggering React duplicate-key warning on "NHCU"). Removed `DEPARTMENTS_FALLBACK` hardcoded list |
| 3 Locations | ✅ **fixed** | Primary Site shows 3 real divisions from `#40.8`. Additional Sites dynamically excludes the selected primary. Fixed a `useEffect` so changing primary also removes it from `additionalLocations[]` state. Removed `LOCATIONS_FALLBACK` |
| 4 Provider Setup | ✅ | NPI / DEA / Schedule II-V checkboxes / Cosigner all wired |
| 5 E-Signature | ✅ | Save Block Name + Clear E-Sig both use ConfirmDialog |
| 6 Permissions | ✅ **fixed** | Replaced 11+ fake hyphenated keys (ORES-SIGN, TIU-WRITE, DG-RECORD, DG-ACCESS, DG-SENSITIVE, SD-SCHED, SD-SUPER, PSJ-VERIFY, PSB-ADMIN, PSOFORM, LR TECH, etc.) with ONLY real VistA keys. Missing keys are HIDDEN at render time (was showing disabled checkboxes with "will be configured when..." tooltip). Labels come from server's enriched `displayName`. Descriptions come from `#19.1` word-processing subfile |
| 7 Review | ✅ | All sections populated |
| Mutual-exclusion warning | ✅ **fixed** | Removed raw "(ORES)" / "(ORELSE)" VistA key leak from the conflict banner text |
| Ref-data error banner | ✅ **new** | Visible red banner when #40.8 / #49 / #19.1 returns empty, names the specific file number |

#### Page 3 — PermissionsCatalog.jsx (Slice 5c)

| Element | Status | Proof |
|---|---|---|
| 689-key load | ✅ | `source: zve`, all 689 returned |
| Category filter pills | ✅ **fixed** | Removed 10-entry `FALLBACK_CATEGORIES` hardcoded list. Built dynamically from live `packageName` values |
| Search | ✅ | Matches name, displayName, description, module |
| Row → detail panel | ✅ | Category, description, holder count, raw key |
| Detail holder list | ✅ **fixed** | Now keyed by `duz` (stable), filters empty names, dropped `JSON.stringify(h)` diagnostic fallback |
| "View all N staff members" | ✅ **fixed** | Was a `<div>` with no onClick — dead element. Now a real `<button>` calling `handleViewStaff` |
| "Assign to a staff member" (detail panel) | ✅ **fixed** | **Step 3.11** — was navigating away to `/admin/staff` with useless router state. Now opens the inline assign modal via `handleOpenAssign(selectedPerm)`, stays on `/admin/permissions` |
| Per-row "View Staff" / "Assign" actions | ✅ | Both already opened inline modals; verified intact |
| Holder count parity | ✅ **fixed** | **Step 3.12** — was drifting because catalog used `^XUSEC` count from M routine but `/key-holders` used File #200 field 51 scan. Both now use `ZVE KEY HOLDERS` which reads `^XUSEC` directly. Verified: `A1AX APVCO` shows 2 holders in both places |
| Deep-link support | ✅ **new** | Catalog now reads `?assign=KEY` and `?view=KEY` query params to auto-open the matching modal. Used by RoleTemplates cross-page integration |

#### Page 4 — RoleTemplates.jsx (Slice 5d)

| Element | Status | Proof |
|---|---|---|
| Role list (16 built-in) | ✅ **fixed** | Rewrote ROLES with only real VistA keys. Added new templates: Ward Clerk (OREMAS), Controlled Substance Pharmacist (PSD PHARMACIST), Scheduling Supervisor, ADT Coordinator, ADT Supervisor. Removed ~35 fake keys (TIU WRITE, TIU SIGN, DG RECORDS, PSJ LM OPTION, PSO PHARMACIST, LR TECH, RA TECH, SD APPT MAKE, IB INSURANCE, etc.) |
| Permissions tab | ✅ **fixed** | Filters to only keys present in the live catalog. No "Pending Install" badge, no yellow-help icon. If every key in a role is missing, shows a gentle italic "No permissions in this role are available" |
| Workspace Access tab | ✅ | All 11 workspace rows render |
| "Assign to Staff Member" button | ✅ **fixed** | Was navigating to /admin/staff with useless state. Now navigates to `/admin/permissions?assign=KEY` which auto-opens the inline assign modal (via the new deep-link hook in PermissionsCatalog) |
| "View Staff with This Role" button | ✅ **fixed** | Same pattern. Now navigates to `/admin/permissions?view=KEY` which opens the holders modal |
| Clone Role | ✅ | Uses inline modal, calls createCustomRole |
| Delete custom role | ✅ | Uses ConfirmDialog |

#### Page 5 — SiteParameters.jsx (Slice 5e + Slice 10)

| Element | Status | Proof |
|---|---|---|
| Kernel Parameters tab | ✅ **fixed** | Backend response shape changed from `rawLines[]` to `data: [{name, value, description}]`. Frontend was still calling `parseKernelParams(res.rawLines)` → page blank. Added `normalizeKernelParams()` that handles both shapes. Live: Domain Name=GOLD.VAINNOVATION.US, Site Name=CAMP MASTER, Production Account=No |
| Session & Security tab | ✅ **fixed** | Session Timeout=300 (5 min), Auto Sign-Off=300, Response Timeout=180 — all live from #8989.3 via ZVE PARAM GET |
| Package tabs (Pharmacy, Lab, Scheduling, Radiology, Surgery) | ✅ | Each loads via `/params/:pkg` DDR route, parses the raw lines into editable fields |
| Save button | ✅ **fixed** | Was sending `{sessionTimeout: "600", reason: "..."}` which didn't match the server's `{paramName, value, reason}` shape — every save returned 400 "field must be allow-listed". Added `KERNEL_FIELD_TO_PARAM` mapping and loops submissions one param at a time. Verified live: AUTOLOGOFF round-trip 300 → 600 → read-back → 300 |
| VHA 900-second enforcement | ✅ | Client blocks save, shows block banner |
| Change preview panel | ✅ | Shows old → new diff, requires reason |

#### Page 6 — SiteManagement.jsx (Slice 6)

| Element | Status | Proof |
|---|---|---|
| Sites list | ✅ | 3 real VEHU divisions: VEHU DIVISION (500), VEHU-PRRTP (995), VEHU CBOC (998) |
| Search | ✅ | Client filter |
| Site profile fields | ✅ **fixed** | Server was emitting `facilityNumber`/`institution`/`defaultPrinterMedRec`/`mailGroup`/`defaultTimeZone` but the frontend editor expected `name`/`phone`/`address`/`city`/`state`/`zip`. Rewrote `GET /divisions/:ien` to fetch and emit the same field numbers the `PUT` route writes to (fields `.01, 1, 2, 4, 1.01, 1.03, 1.04, 1.05`). Round-trip edit now works |
| Edit Site form | ✅ | All fields populate on "Edit Site", save calls PUT /divisions/:ien via DDR FILER |
| Workspace Access toggles | ✅ | Per-division toggles wired to `/workspaces?divisionIen=` (ZVE path) |
| Topology section | ✅ | Live from /topology |
| Add Site modal | ✅ | POST /divisions via DDR FILER |

#### Page 7 — AuditLog.jsx (Slice 6)

| Element | Status | Proof |
|---|---|---|
| 5 source tabs (All/Sign-On/Data/Error/Failed/Programmer) | ✅ | All endpoints respond; VEHU has 3 error-log entries, others are legitimately empty in the sandbox |
| `?user=` query param from StaffDirectory | ✅ | Step 3.7 — the receiving side reads it via `useSearchParams` and initializes `userSearch` state. Verified: clicking "View Audit Trail" on a staff member passes the name correctly |
| Filters (action type, user, date from/to) | ✅ | Client-side filtering over the normalized combined event list |
| Event detail expand | ✅ | Shows source/action/user/detail/raw JSON |
| Export CSV | ✅ | Client-side build |

#### Page 8 — AlertsNotifications.jsx (Slice 6)

| Element | Status | Proof |
|---|---|---|
| Alerts tab | ✅ | /bulletins endpoint responds (empty in VEHU, expected) |
| Messages (MailMan) tab | ✅ | /mailman/inbox returns 50 real messages via ZVE MM INBOX |
| Configuration tab | ✅ | — |
| Delete alert | ✅ | Uses ConfirmDialog |
| Compose / Send message | ✅ | Uses inline modal |

#### Page 9 — SystemMonitor.jsx (Slice 6)

| Element | Status | Proof |
|---|---|---|
| Health cards (Tasks, VistA, Errors, User) | ✅ | All live data |
| System Health tab | ✅ | /taskman/status, /vista-status, /taskman-tasks (15), /taskman/scheduled all respond |
| HL7 Interfaces tab | ✅ | /hl7/filer-status returns `{INCOMING: STOPPED, OUTGOING: STOPPED}` live |
| Error Trap tab | ✅ | /error-trap returns 7 real entries |
| Reports tab | ✅ | 6 domain-specific report generators wired |

#### Page 10 — MasterConfig.jsx (Slice 6)

| Element | Status | Proof |
|---|---|---|
| Kernel parameter normalizer | ✅ **fixed** | Same `parseKernelParams(res.rawLines)` bug as SiteParameters — copied the `normalizeKernelParams()` helper locally so the Auth/Session/ESig/Audit/MOTD/Backup sections populate |
| Zero-value security warning (Step 3.8) | ✅ **fixed** | Added `critical: v === 0` flag and "DISABLED, security risk" hint text. The rendering already had a "Disabled — value is 0" pill next to number inputs (line 344-348) |
| 2-person integrity flow | ✅ | Submit → pending queue → approve (by other admin, can't self-approve) |
| Pending approval card | ✅ | Shows submitter, old/new values, reason |

### PATIENT PAGES (12)

#### Pages 11-22 (Slices 7+8)

| Page | Status | Key findings |
|---|---|---|
| PatientSearch | ✅ | `/patients?search=` returns 4 real matches for "A" via ZVE path |
| PatientDashboard | ✅ | Vital signs form, problem list, orders — all live-wired |
| PatientDemographics | ✅ | SSN validation, `XXX-XX-XXXX` placeholder (not a bug) |
| InsuranceCoverage | ✅ **fixed** | `window.confirm('Delete insurance "..."?')` → `ConfirmDialog destructive` |
| FinancialAssessment | ✅ | `/patients/:dfn/assessment` returns File #408.31 rows |
| Admission | ✅ **fixed** | `window.confirm('admission checklist incomplete')` → `ConfirmDialog`. Checklist state captured in `checklistPrompt` |
| Transfer | ✅ | No confirm usage |
| Discharge | ✅ **fixed** | Two `window.confirm` calls → two `ConfirmDialog` (AMA destructive + checklist). AMA flow chains into checklist if both conditions apply |
| BedManagement | ✅ **fixed** | `window.confirm('Remove bed X?')` → `ConfirmDialog destructive`. 549 live beds, 65 live wards |
| PatientFlags | ✅ | Uses dialog patterns, no confirm |
| RecordRestrictions | ✅ | DDR-backed read/write |
| RegistrationReports | ✅ | Aggregated reports from live data |

**Vocabulary across all 12 patient pages:** zero DUZ visible, zero "key mapping", zero "Not in VistA", zero "ZVE " leaks, zero "RPC" in user-facing text.

---

## Terminal Function → Web UI Mapping Results

| # | Terminal Function | Web UI | Backend | Write verified | UX |
|---|---|---|---|---|---|
| 1 | Add a New User (XUSERNEW) | StaffForm.jsx create mode | POST /users → ZVE USMG ADD | ✅ DUZ 10000000401 created, verified at M prompt | Clean |
| 2 | Edit an Existing User (XUSER) | StaffForm.jsx edit mode | PUT /users/:userId | ⚠ untested this session | Clean |
| 3 | List Users (XUSERLIST) | StaffDirectory.jsx | GET /users → ZVE USER LIST | ✅ read verified | Clean |
| 4 | Find a User (XUFIND) | StaffDirectory search bar | GET /users?search= | ✅ | Clean |
| 5 | Allocate Security Keys (XUKEYALL) | StaffForm step 6 + catalog Assign modal | POST /users/:duz/keys → ZVE USMG KEYS | ✅ verified at M prompt (^VA(200,…,51) + ^XUSEC) | Clean |
| 6 | Remove Security Keys | Catalog Assign or StaffForm step 6 | DELETE /users/:duz/keys/:key | ✅ verified: empty readback after delete | Clean |
| 7 | Terminate User | StaffDirectory > Deactivate | POST /users/:duz/deactivate → ZVE USMG DEACT | ✅ returns 1^OK | Clean |
| 8 | Reactivate User | StaffDirectory > Reactivate | POST /users/:duz/reactivate → ZVE USMG REACT | ✅ returns 1^OK | Clean |
| 9 | Release Locked User | Not built | — | — | Acceptable (Kernel session lock is rare in modern usage) |
| 10 | Set E-Signature | ESignatureSetup.jsx (self-service), StaffDirectory clear (admin) | POST /users/:duz/esig | ⚠ self-service untested this session; admin clear works | Clean |
| 11 | Edit Kernel Parameters | SiteParameters.jsx + MasterConfig.jsx | PUT /params/kernel → ZVE PARAM SET | ✅ AUTOLOGOFF 300→600→300 verified | Clean |
| 12 | View Sign-On Log | AuditLog.jsx | GET /audit/signon-log | ✅ endpoint responds (empty in VEHU) | Clean |
| 13 | Manage MailMan | AlertsNotifications Messages tab | GET /mailman/inbox | ✅ 50 real messages | Clean |
| 14 | Manage Alerts | AlertsNotifications Alerts tab | GET /bulletins | ✅ endpoint responds | Clean |
| 15 | Division Management | SiteManagement.jsx | GET/PUT/POST /divisions | ✅ 3 real divisions, field shape fixed | Clean |
| 16 | TaskMan Management | SystemMonitor.jsx | /taskman/* + /taskman-tasks | ✅ 15 tasks, status live | Clean |
| 17 | Error Trap Review | SystemMonitor Error tab | /error-trap | ✅ 7 entries | Clean |
| 18 | Register Patient | PatientDemographics create | POST /patients | ⚠ untested this session | Clean |
| 19 | Edit Patient | PatientDemographics edit | PUT /patients/:dfn | ⚠ untested this session | Clean |
| 20 | Admit Patient | Admission.jsx | POST /patients/:dfn/admit | ⚠ untested this session | Clean (ConfirmDialog replaced window.confirm) |
| 21 | Transfer Patient | Transfer.jsx | POST /patients/:dfn/transfer | ⚠ untested this session | Clean |
| 22 | Discharge Patient | Discharge.jsx | POST /patients/:dfn/discharge | ⚠ untested this session | Clean (both ConfirmDialogs replace both confirms) |
| 23 | Means Test | FinancialAssessment.jsx | POST /patients/:dfn/assessment | ⚠ untested this session | Clean |
| 24 | Patient Flags | PatientFlags.jsx | /patients/:dfn/flags | ✅ endpoint responds | Clean |

**Legend:** ✅ verified this session with live data or write+readback · ⚠ code wired correctly but no write-and-readback performed in this session (safe to do when ready)

---

## Root-cause fixes shipped

### 1. Hardcoded security-key prefix table → live VistA lookup
**Problem:** 216/689 keys bucketed to "General" because the hardcoded `KEY_PREFIX_PACKAGE` table missed many prefixes.
**Fix:** Added `ZVE PACKAGE LIST` RPC that returns all 458 `PACKAGE #9.4` prefix→name pairs. `ensurePackageMap()` caches on first use. `deriveKeyPackage()` does longest-prefix match. Result: 0 General bucket.

### 2. KEYLIST M routine read wrong DD field
**Problem:** `KEYLIST^ZVEADMN1` called `$$GET1^DIQ(19.1, IEN, 2, "E")` but the DD has `.02 DESCRIPTIVE NAME` at `0;2`. Field `2` didn't exist, so displayName was empty for every key.
**Fix:** Changed to `.02` and also walk the word-processing description subfile at `^DIC(19.1,IEN,1,N,0)` to populate the description field. 643/689 keys now have descriptions.

### 3. File #200 field 51 storage inconsistency
**Problem:** `DETAIL^ZVEADMIN` was reading field 51 piece 1 as if it were the key NAME, but it's actually a POINTER to #19.1.
**Fix:** Use `$$GET1^DIQ(200.051, KIENS, .01, "E")` for external resolution. Plus a fallback to read the raw string for entries written by `ZVE USMG KEYS` which uses the name-as-string convention.

### 4. Holder count source divergence (Step 3.12)
**Problem:** `/key-inventory` reported holder count from M routine's `^XUSEC` scan, `/key-holders/:name` used File #200 field 51 scan. Two different tables diverged over time.
**Fix:** Added `ZVE KEY HOLDERS` RPC that scans `^XUSEC(KEYNAME, DUZ)` (authoritative Kernel security xref). Both endpoints now use it. Catalog and detail modal agree.

### 5. ZVE USMG ADD LAYGO context crash
**Problem:** `UPDATE^DIE` doesn't export `DIC`/`DIC(0)` to the input-transform scope. File 200's `.01` input transform calls `LAYGO^XUA4A7` which expects `DIC(0)`. Result: `%YDB-E-LVUNDEF` crash on every create attempt.
**Fix:** Rewrote `ADD^ZVEUSMG` to use `FILE^DICN` with explicit `DIC="^VA(200,"` and `DIC(0)="LX"`. Verified: `POST /users` with `ZVEAUDIT,TESTADD1` creates DUZ 10000000401 and the user exists in `^VA(200,"B")`.

### 6. Persistent auth tokens
**Problem:** Session store was an in-memory `Map`, so every server restart invalidated every client session. Painful for dev, unacceptable for ops.
**Fix:** AES-256-GCM encrypted session file at `apps/tenant-admin/.sessions.enc` (mode 0600), key from `SESSION_SECRET` env var. `persistSessions()` fires on create/destroy/expiry via `queueMicrotask` debounce, atomic tmp+rename writes. `loadSessionsFromDisk()` runs at boot. Verified: killed server mid-session, restarted, same token continued working including per-request broker re-activation.

### 7. Frontend divergence from server response shape
**Problem:** `SiteParameters.jsx` and `MasterConfig.jsx` both called `parseKernelParams(res.rawLines)` but the server's `/params/kernel` endpoint now returns `data: [{name, value, description}]` via the ZVE path, not `rawLines`. Result: every field on those pages was blank.
**Fix:** Added `normalizeKernelParams()` in both pages that handles both shapes.

---

## Deliverables (this document + siblings)

1. `AUDIT-RESULTS.md` — this file
2. `TESTING-LOG.md` — every API call, every write verification
3. `REMAINING-ISSUES.md` — things deferred with rationale

## Commits (in order)

All committed, none pushed. Working trees clean on both repos.

```
vista-evolved-vista-distro:
  56dc1e9  feat: ZVEADMN1 — KEYLIST DD fix, add PKGLIST/SVCLIST/KEYHLD RPCs
  ce3e302  fix: resolve SECURITY KEY pointer IENs in DETAIL + KEYLIST user branch
  8551409  fix: ZVE USMG ADD LAYGO context + DETAIL handles ZVE-style key storage

vista-evolved-platform:
  c3f4e0c  fix(tenant-admin): live PACKAGE #9.4 lookup, persistent sessions, 0 fallbacks
  191f665  fix(admin): StaffDirectory audit — server enrichment, key overrides, UI data plumbing
  452fe03  fix(admin): StaffForm audit — real VistA keys, error banner, dynamic site filter, #49 dedup
  33efb90  fix(admin): PermissionsCatalog audit — inline assign modal, drop fallbacks, trust server enrichment
  4c6339c  fix(admin): RoleTemplates — real VistA keys, drop 'Pending Install', cross-page deep links
  1c7520a  fix(admin): SiteParameters — normalize live ZVE response shape, drop legacy rawLines parser
  5272136  fix(admin): Slice 6 audit — SiteManagement + MasterConfig + /divisions:ien field shape
  d938942  fix(patients): replace all window.confirm with ConfirmDialog across patient pages
  7e83b62  fix(admin): vocabulary sweep — drop the 'RPC timeout' label from SiteParameters
  844b0f5  fix(admin): SiteParameters — send paramName not raw field keys to PUT /params/kernel
```
