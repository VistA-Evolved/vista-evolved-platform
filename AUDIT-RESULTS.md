# Admin Panel Redesign — Audit Results

**Date:** 2026-04-10  
**Environment:** Docker `local-vista-utf8` (CAMP MASTER sandbox, PRODUCTION=No)  
**Server:** tenant-admin on `127.0.0.1:4520`  
**Authenticated as:** PROGRAMMER,ONE (DUZ 1)

---

## 1. API Endpoint Validation

All 21 critical admin endpoints verified against live Docker VistA:

| # | Endpoint | HTTP | Status | RPC / Source | Notes |
|---|----------|------|--------|-------------|-------|
| 1 | `/vista-status` | GET | 200 | direct-xwb | `vistaReachable: true`, `productionMode: test` |
| 2 | `/users` | GET | 200 | ZVE USER LIST | 28 KB, full staff roster |
| 3 | `/key-inventory` | GET | 200 | ZVE KEY LIST | 306 KB, ~689 keys with displayName + packageName |
| 4 | `/params/kernel` | GET | 200 | ZVE PARAM GET | 12 fields from #8989.3 |
| 5 | `/taskman/status` | GET | 200 | ZVE TASKMAN STATUS | `STOPPED` (expected in sandbox) |
| 6 | `/divisions` | GET | 200 | ZVE DIVISION LIST | VEHU DIVISION (500) |
| 7 | `/services` | GET | 200 | DDR LISTER #49 | 50+ department entries |
| 8 | `/esig-status` | GET | 200 | ZVE ESIG STATUS | 22 KB, all users' e-sig status |
| 9 | `/error-trap` | GET | 200 | DDR LISTER #3.077 | Error entries present |
| 10 | `/hl7/filer-status` | GET | 200 | ZVE HL7 FILER STATUS | INCOMING/OUTGOING: STOPPED |
| 11 | `/hl7-interfaces` | GET | 200 | DDR LISTER #870 | Interface list (AITC_VTS, etc.) |
| 12 | `/bulletins` | GET | 200 | DDR LISTER #3.6 | Empty (no active bulletins) |
| 13 | `/roles/custom` | GET | 200 | ZVE ROLE CUSTOM LIST | Empty (no custom roles yet) |
| 14 | `/reports/admin/staff-access` | GET | 200 | Aggregation | 7.5 KB report data |
| 15 | `/reports/admin/permission-dist` | GET | 200 | Aggregation | 20 KB permission distribution |
| 16 | `/audit/signon-log` | GET | 200 | ZVE ADMIN AUDIT | Sign-on events |
| 17 | `/audit/error-log` | GET | 200 | ZVE ADMIN AUDIT | Error log entries |
| 18 | `/audit/failed-access` | GET | 200 | DDR LISTER #3.05 | Empty (no failed access) |
| 19 | `/audit/programmer-mode` | GET | 200 | DDR LISTER #3.07 | Empty (no programmer mode entries) |
| 20 | `/taskman/scheduled` | GET | 200 | ZVE TASKMAN TASKS | Scheduled task entries |
| 21 | `/config/2p` | GET | 200 | ZVE 2P LIST | Empty (no pending 2P requests) |

**Result: 21/21 endpoints returning 200 with valid data.**

---

## 2. Jargon Removal Audit

All VistA-internal terminology has been removed from user-facing UI text:

| File | Issue | Before | After |
|------|-------|--------|-------|
| `App.jsx` | Access denied page | "security keys", "IRM", "XUMGR" | "permissions", "system administrator" |
| `SecurityAuth.jsx` | Password hint | "verify code" | "password" |
| `SecurityAuth.jsx` | E-sig hint | "ZVE ESIG MANAGE", "M routine" | "Contact your system administrator" |
| `SecurityAuth.jsx` | Order hint | "ORES key" | "order-writing authority" |
| `SecurityAuth.jsx` | Note hint | "TIU SIGN DOCUMENT" | "clinical note signing authority" |
| `SecurityAuth.jsx` | Account toggles | "Access Codes" / "Verify Codes" | "Usernames" / "Passwords" |
| `StaffForm.jsx` | System admin group | "Kernel", "IRM" | "system administration" |
| `StaffForm.jsx` | Permission labels | "IRM / Site manager" | "System administrator" |
| `StaffForm.jsx` | Permission labels | "Programmer (Kernel access)" | "System programmer (advanced access)" |
| `StaffForm.jsx` | Permission labels | "Programmer mode access" | "Advanced diagnostic access" |
| `StaffForm.jsx` | Error text | "ORES and ORELSE" | "Write clinical orders and Enter verbal orders" |
| `StaffForm.jsx` | E-sig label | "E-Signature Code" | "E-Signature" |
| `StaffForm.jsx` | Ref data error | "security keys" | "permissions" |
| `StaffForm.jsx` | Permission hint | "live security key" | "system capabilities" |
| `RoleTemplates.jsx` | Role name | "System Administrator (IRM)" | "System Administrator" |
| `RoleTemplates.jsx` | Permission labels | "IRM / site manager", "Programmer" | Human-readable versions |
| `SiteParameters.jsx` | Nav label | "Kernel Parameters" | "Core System Settings" |
| `SiteParameters.jsx` | Empty state | "File #100.99 has no entries" | "This module has not been initialized" |
| `SiteParameters.jsx` | Field desc | "File #?, field X" | "Configuration parameter X" |
| `SystemHealth.jsx` | Task name | "TaskMan Health Check" | "Background Task Health Check" |
| `SystemHealth.jsx` | Card label | "Error Trap" | "Error Log" |
| `SystemHealth.jsx` | Empty state | "error trap entries" | "error log entries" |
| `PermissionsCatalog.jsx` | Error msg | "ORES"/"ORELSE" raw keys | Human-readable permission names |
| `AuditLog.jsx` | Action type | "Programmer Mode" | "Administrative Access" |
| `AuditLog.jsx` | Source label | "Programmer Mode" | "Administrative Access" |
| `AuditLog.jsx` | Error source | "Error Trap" | "Error Log" |

---

## 3. Vocabulary & Translation Layer

### `vocabulary.js` updates:
- Added `KEY_TRANSLATIONS` map with 35 known security key translations
- Added `translateKey()` export function
- Existing `TERM_MAP`, `BANNED_TERMS`, `translateTerm()`, `safeTranslate()` unchanged

### `transforms.js` updates:
- `humanizeKeyName()` now checks `KEY_TRANSLATIONS` first before regex fallback
- Regex replacements improved: "Kernel" → "System", "BCMA" → "Medication Admin", added Imaging/Radiology/Surgery/Allergy/Billing/Primary Care patterns

---

## 4. UX Improvements

### Sandbox Banner
- `AppShell.jsx` `SandboxBanner` fixed: condition changed from `productionMode === false` to `productionMode !== 'production'`
- Confirmed live API returns `productionMode: "test"` — banner now correctly appears

### Duplicate Name Disambiguation
- `StaffDirectory.jsx`: When multiple staff share the same name, the Staff ID (`S-{IEN}`) is appended as a suffix in the table
- `isDuplicate` and `displayName` fields computed after merge

### Title Derivation from Keys
- `StaffDirectory.jsx`: New `deriveTitleFromKeys()` function infers role title from permission keys when no title is set
- Priority: System Admin > Provider > Nurse > Pharmacist > Lab > Radiology > Scheduling > Registration > Clinical Staff

### Last Sign-In Display
- `StaffDirectory.jsx`: `lastLogin` field propagated from user list data to detail panel

---

## 5. Files Modified

| File | Changes |
|------|---------|
| `apps/web/src/App.jsx` | Access denied jargon removal |
| `apps/web/src/components/shell/AppShell.jsx` | SandboxBanner condition fix |
| `apps/web/src/utils/vocabulary.js` | KEY_TRANSLATIONS map, translateKey() |
| `apps/web/src/utils/transforms.js` | humanizeKeyName() uses KEY_TRANSLATIONS |
| `apps/web/src/pages/admin/SecurityAuth.jsx` | 6 jargon fixes |
| `apps/web/src/pages/admin/StaffForm.jsx` | 8 jargon fixes |
| `apps/web/src/pages/admin/StaffDirectory.jsx` | Duplicate names, title derivation, lastLogin |
| `apps/web/src/pages/admin/RoleTemplates.jsx` | 3 jargon fixes |
| `apps/web/src/pages/admin/SiteParameters.jsx` | 3 jargon fixes |
| `apps/web/src/pages/admin/SystemHealth.jsx` | 3 jargon fixes |
| `apps/web/src/pages/admin/PermissionsCatalog.jsx` | 1 jargon fix (mutual exclusion error) |
| `apps/web/src/pages/admin/AuditLog.jsx` | 6 jargon fixes (Programmer Mode → Administrative Access, Error Trap → Error Log) |

---

## 6. No Regressions

- Zero `window.alert()` or `window.confirm()` calls in admin pages (verified)
- No VistA file numbers (#200, #19.1, etc.) exposed in user-facing UI
- All 21 API endpoints confirmed working
- No lint errors in any modified file
