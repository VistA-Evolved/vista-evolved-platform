# Deep Audit Findings — VistA Evolved Platform (Web App)

**Date:** 2025-01-28
**Scope:** `apps/web/src/` — React/Vite frontend for Patient Registration, Admin/Security, ADT
**Method:** Full code review, vocabulary sweep, persona walkthroughs, live endpoint verification

---

## Executive Summary

The deep audit examined every page, service, component, and utility in the web application against 62 specification documents. **7 known issues** were identified and **all 7 have been resolved**. An additional vocabulary sweep found **8 VistA-internal terms** leaking to end users — all fixed. **18/18 backend endpoints** verified against live VistA (source=zve or source=vista). **~1,336 lines of mock data** removed from patientService.js.

---

## Issue 1: Mock Data Fallbacks in patientService.js — FIXED

**Severity:** Critical (silently masked real API failures)
**Before:** 1,716 lines with ~1,100 lines of MOCK_PATIENTS, MOCK_FLAGS_DB, MOCK_INSURANCE_BY_DFN, MOCK_ASSESSMENTS, MOCK_BEDS arrays. Every exported function wrapped in `withMockFallback()` which tried the real API call first, then silently returned mock data on error.
**After:** 380 lines. All mock data removed. All 38 exported functions call real VistA backend directly via `tenantApi`. No fallback patterns.
**Files changed:** `apps/web/src/services/patientService.js` (complete rewrite)
**Verification:** All 18 patient endpoints return `ok:true` from live VistA.

## Issue 2: RequireAdmin Pass-Through — FIXED

**Severity:** High (security — any logged-in user could access /admin/* routes)
**Before:** `RequireAdmin` component only checked for a session token (same as `RequireAuth`). Comment said "For now, we allow access" — no permission checking.
**After:** `RequireAdmin` now calls `GET /auth/session`, retrieves the user's VistA security keys, and checks for XUMGR, XUPROG, XUPROGMODE, XU PARAM, or ZVE ADMIN AUDIT. Non-admin users see an "Access Denied" page. Result cached in `sessionStorage` under `ve-admin-verified` to avoid repeated API calls.
**Files changed:** `apps/web/src/App.jsx`
**Verification:** Session endpoint returns `keys` array; PROGRAMMER,ONE has XUMGR → allowed.

## Issue 3: DUZ Vocabulary Leak in RecordRestrictions — FIXED

**Severity:** Medium (exposes VistA internal terminology to end users)
**Before:** Three user-visible instances of "DUZ" — a table header, a search placeholder, and a staff display label.
**After:** Changed to "Staff ID" (table header), "Search by name or ID..." (placeholder), "ID: {s.duz}" (label).
**Files changed:** `apps/web/src/pages/patients/RecordRestrictions.jsx` (lines 401, 459, 487)

## Issue 4: "Ward Clerk" → "Unit Clerk" — FIXED

**Severity:** Low (incorrect VA terminology)
**Before:** `'Mark orders as signed on chart (ward clerk)'` — VA uses "unit clerk" not "ward clerk".
**After:** Changed to `'Mark orders as signed on chart (unit clerk)'`.
**Files changed:** `apps/web/src/pages/admin/StaffForm.jsx` (line 74)

## Issue 5: E-Signature Capture — DOCUMENTED AS GAP

**Severity:** Medium (requires new M routine SET action)
**Status:** Cannot be fixed in frontend alone — requires `ZVE ESIG VERIFY` M routine to hash-validate e-signatures against VistA's Kernel sign-on hash. Documented in REMAINING-GAPS.md.

## Issue 6: PatientContext URL Auto-Fetch — FIXED

**Severity:** Medium (UX — pages had to manually fetch patient on mount)
**Before:** `PatientContext` was a dumb store — `setPatient`/`clearPatient`/`hasPatient` only. Each page independently called `getPatient(patientId)` on mount.
**After:** Added `useEffect` watching `location.pathname` for `/patients/:dfn/*` pattern. Auto-fetches patient data from API when URL changes. Clears patient when navigating away. Deduplicates requests via `loadingRef`.
**Files changed:** `apps/web/src/components/shared/PatientContext.jsx`

## Issue 7: server.mjs Monolith — DOCUMENTED AS TECH DEBT

**Severity:** Low (maintainability, not functionality)
**Status:** server.mjs is ~5,500 lines. Functional and correct but should be split into route modules in a future refactor. Documented in REMAINING-GAPS.md.

---

## Vocabulary Sweep — 8 Additional Fixes

| Term | File | Line | Before | After |
|------|------|------|--------|-------|
| DUZ | AuditLog.jsx | 52 | `DUZ ${raw.duz}` | `Staff ${raw.duz}` |
| DUZ | AuditLog.jsx | 94 | `DUZ ${raw.duz}` | `Staff ${raw.duz}` |
| DUZ | AuditLog.jsx | 107 | `DUZ ${raw.duz}` | `Staff ${raw.duz}` |
| DUZ | StaffDirectory.jsx | 294 | CSV header "Name,DUZ,..." | "Name,Staff ID,..." |
| RPC | MasterConfig.jsx | 45 | "RPC Timeout" | "Response Timeout" |
| RPC | SiteParameters.jsx | 104 | "RPC Timeout" | "Response Timeout" |
| RPC | transforms.js | 136 | "RPC Timeout (seconds)" | "Response Timeout (seconds)" |

---

## UX Quick Wins Implemented

1. **Post-Registration Insurance CTA** — After registering a new patient, an "Add Insurance" button now appears in the success CTAs, navigating to `/patients/:dfn/insurance`.
2. **Discharge Length of Stay** — Discharge success screen now calculates and displays length of stay from admission date to discharge date.
3. **Stale Mock Banners Removed** — Removed `source === 'mock'` warning banners from Admission, Transfer, Discharge, PatientDashboard, and RegistrationReports pages.

---

## Backend Endpoint Verification (18/18 PASS)

| # | Endpoint | Source | Result |
|---|----------|--------|--------|
| 1 | GET /wards | vista | OK (65 wards) |
| 2 | GET /room-beds | vista | OK (549 beds) |
| 3 | GET /treating-specialties | vista | OK (83 specialties) |
| 4 | GET /insurance-companies | vista | OK (3 companies) |
| 5 | GET /clinics | vista | OK (940 clinics) |
| 6 | GET /divisions | zve | OK (3 divisions) |
| 7 | GET /facilities | vista | OK (500 facilities) |
| 8 | GET /nursing-locations | vista | OK (26 locations) |
| 9 | GET /users | zve | OK (200 users) |
| 10 | GET /patients?search=SMITH | zve | OK |
| 11 | GET /patients/100022 | zve | OK |
| 12 | GET /patients/100022/insurance | vista | OK |
| 13 | GET /patients/100022/assessment | vista | OK |
| 14 | GET /patients/100022/flags | zve | OK |
| 15 | GET /patients/100022/audit-events | vista | OK |
| 16 | GET /patients/100022/authorized-staff | vista | OK |
| 17 | GET /patients/dashboard | vista | OK |
| 18 | GET /reports/registration | vista | OK |

**Auth endpoint:** GET /auth/session → ok=true, source=zve, returns user keys + navGroups + roleCluster.

---

## Files Modified

| File | Change |
|------|--------|
| `services/patientService.js` | Complete rewrite: 1,716→380 lines, all mock data removed |
| `App.jsx` | RequireAdmin wired to real session/key check |
| `components/shared/PatientContext.jsx` | URL-driven auto-fetch for patient context |
| `pages/patients/RecordRestrictions.jsx` | DUZ→Staff ID (3 places) |
| `pages/admin/StaffForm.jsx` | ward clerk→unit clerk |
| `pages/admin/AuditLog.jsx` | DUZ→Staff (3 places) |
| `pages/admin/StaffDirectory.jsx` | CSV header DUZ→Staff ID |
| `pages/admin/MasterConfig.jsx` | RPC Timeout→Response Timeout |
| `pages/admin/SiteParameters.jsx` | RPC Timeout→Response Timeout |
| `utils/transforms.js` | RPC Timeout→Response Timeout label |
| `pages/patients/PatientDemographics.jsx` | Added "Add Insurance" CTA post-registration |
| `pages/patients/Discharge.jsx` | Added Length of Stay display, removed mock banner |
| `pages/patients/Admission.jsx` | Removed stale mock banner |
| `pages/patients/Transfer.jsx` | Removed stale mock banner |
| `pages/patients/PatientDashboard.jsx` | Removed stale mock banner |
| `pages/patients/RegistrationReports.jsx` | Removed stale mock banner |
