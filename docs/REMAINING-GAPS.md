# Remaining Gaps — VistA Evolved Platform (Web App)

**Date:** 2025-01-28
**Context:** Post-deep-audit gap analysis. All 7 known issues resolved; this document tracks remaining work.

---

## Priority 1 — Blocking for Production

### GAP-001: E-Signature Verification RPC

**Status:** Not implementable in frontend alone
**Description:** Multiple pages reference e-signature requirements (StaffForm ORES-SIGN, TIU-SIGN keys; order signing workflows). Currently no `ZVE ESIG VERIFY` M routine exists to hash-validate electronic signatures against VistA's Kernel sign-on hash (field 20.4 in NEW PERSON file #200).
**Impact:** Orders and clinical notes cannot be electronically signed through the web app.
**Resolution:** Implement `ZVE ESIG VERIFY` M routine that accepts (DUZ, plaintext e-sig) and returns pass/fail after comparing against the stored hash. Wire frontend e-signature dialogs to call this RPC.
**Spec Reference:** Security Matrix §4.3 "Electronic Signature Requirements"

### GAP-002: Role-Based Route Enforcement (Frontend)

**Status:** Partially resolved
**Description:** `RequireAdmin` now enforces admin key checks. However, the server-side `resolveNavGroups()` RBAC system (which maps VistA keys to route groups) has no frontend counterpart for non-admin routes. A user with only `DG REGISTER` keys should not see Pharmacy or Lab routes in the sidebar.
**Impact:** Low risk — placeholder routes return "Coming in Wave X" — but sidebar links are visible to all authenticated users.
**Resolution:** Wire `navGroups` from `GET /auth/session` into the sidebar component to conditionally show/hide workspace links based on the user's actual permissions.
**Spec Reference:** Security Matrix §2.1 "Navigation Group Authorization"

---

## Priority 2 — Important for Completeness

### GAP-003: server.mjs Monolith Refactor

**Status:** Documented as tech debt
**Description:** `server.mjs` is ~5,500 lines in a single file. All routes, middleware, VistA broker management, and business logic live in one module. This is functional and correct but creates maintenance burden.
**Impact:** Developer velocity. No user-facing impact.
**Resolution:** Split into route modules: `routes/auth.mjs`, `routes/patients.mjs`, `routes/admin.mjs`, `routes/reference.mjs`, etc. Extract broker management into `lib/broker-pool.mjs`.
**Effort:** 2-3 days, no functional changes needed.

### GAP-004: Scheduling Workspace (Placeholder)

**Status:** Route exists, page is placeholder
**Description:** `/scheduling/*` renders `WorkspacePlaceholder` with "Planned for Build Wave 1". Scheduling is referenced in specs but no VistA scheduling RPCs are in Wave 1 deployment.
**Impact:** Users cannot schedule appointments through the web app.
**Resolution:** Implement scheduling RPCs (SD APPOINTMENT, SD CLINIC) and build scheduling pages in a future wave.
**Spec Reference:** Scheduling Specs §1-§5

### GAP-005: Clinical Workspace (Placeholder)

**Status:** Route exists, page is placeholder
**Description:** `/clinical/*` renders `WorkspacePlaceholder`. Clinical orders, TIU notes, vitals entry, allergy management are all placeholder.
**Impact:** Clinical users cannot perform clinical documentation through the web app.
**Resolution:** Wave 1-2 implementation per project plan.

### GAP-006: Billing Integration

**Status:** Route exists, page is placeholder
**Description:** `/billing/*` renders `WorkspacePlaceholder`. IB (Integrated Billing) integration is not started.
**Impact:** Billing staff cannot use the web app for charge capture or claims processing.
**Resolution:** Wave 3+ implementation.

---

## Priority 3 — Nice-to-Have Improvements

### GAP-007: Admission Status Banner

**Description:** After successful admission, the success screen shows ward/bed/movement ID. However, the patient's main dashboard does not display a persistent "Inpatient" status banner showing current ward, bed, and admission date.
**Resolution:** Add an inpatient status callout to PatientDashboard.jsx that reads from patient context (admissionStatus, ward, roomBed, admissionDateTime).

### GAP-008: Census View

**Description:** No dedicated inpatient census view. BedManagement shows beds but not a ward-by-ward census with patient names, admit dates, and expected discharge dates.
**Resolution:** Build a Census page or tab that calls `GET /census` (route exists on server but not exposed in patientService.js yet).

### GAP-009: Quick Register from Search

**Description:** PatientSearch has a "Register New Patient" header button but no inline quick-register from search results. If a search returns no results, users must click the header button.
**Resolution:** Add a "No results — Register this patient?" CTA in empty search results state.

### GAP-010: Income Threshold Visualization

**Description:** FinancialAssessment shows copay category (A/B/C) and annual income but doesn't visualize how close income is to the threshold for the next category.
**Resolution:** Add a progress-bar visualization comparing reported income to VA income thresholds for each category.

---

## Summary

| Priority | Count | Blocking? |
|----------|-------|-----------|
| P1 — Blocking | 2 | Yes (e-sig, role-based sidebar) |
| P2 — Completeness | 4 | No (placeholders, tech debt) |
| P3 — Nice-to-have | 4 | No (UX improvements) |
| **Total** | **10** | |
