# VistA Evolved — Patients/Registration Workspace Audit Results

**Date:** April 4, 2026  
**Build Status:** PASS — Vite production build succeeds (74 modules, 0 errors)

---

## 1. Pages Built and Verified

| # | Page ID | File | Route | Status |
|---|---------|------|-------|--------|
| 1 | PT-01 | `PatientSearch.jsx` | `/patients` | ✅ Built |
| 2 | PT-02 | `PatientDashboard.jsx` | `/patients/:patientId` | ✅ Built |
| 3 | PT-03 | `PatientDemographics.jsx` | `/patients/register`, `/patients/:patientId/edit` | ✅ Built |
| 4 | PT-04 | `InsuranceCoverage.jsx` | `/patients/:patientId/insurance` | ✅ Built |
| 5 | PT-05 | `FinancialAssessment.jsx` | `/patients/:patientId/assessment` | ✅ Built |
| 6 | PT-06 | `Admission.jsx` | `/patients/:patientId/admit` | ✅ Built |
| 7 | PT-07 | `Transfer.jsx` | `/patients/:patientId/transfer` | ✅ Built |
| 8 | PT-08 | `Discharge.jsx` | `/patients/:patientId/discharge` | ✅ Built |
| 9 | PT-09 | `BedManagement.jsx` | `/patients/beds` | ✅ Built |
| 10 | PT-10 | `PatientFlags.jsx` | `/patients/:patientId/flags` | ✅ Built |
| 11 | PT-11 | `RecordRestrictions.jsx` | `/patients/:patientId/restrictions` | ✅ Built |
| 12 | PT-12 | `RegistrationReports.jsx` | `/patients/reports` | ✅ Built |

**Total: 12 pages, 13 routes (PT-03 serves both create and edit modes)**

---

## 2. Shared Components

| Component | File | Status |
|-----------|------|--------|
| PatientBanner | `src/components/shared/PatientBanner.jsx` | ✅ Built — 80px expanded / 48px collapsed on scroll, restricted record red banner, allergy chips, behavioral flag badges, code status |
| PatientContext | `src/components/shared/PatientContext.jsx` | ✅ Built — React context provider with `setPatient()`, `clearPatient()`, `hasPatient` |
| PatientsSubNav | `src/components/shell/PatientsSubNav.jsx` | ✅ Built — 5 groups (Register, Eligibility, ADT, Flags, Reports), patient-context-aware links, disabled state for patient-required pages |

---

## 3. Backend Endpoints — Status

The tenant-admin backend does **not** have dedicated patient CRUD endpoints. The following shows what exists vs. what is needed:

| Endpoint | Backend Status | Frontend Fallback |
|----------|---------------|------------------|
| `GET /patients` | ❌ Not implemented | Mock data (25 patients) |
| `GET /patients/:dfn` | ❌ Not implemented | Mock data with full demographics |
| `POST /patients` | ❌ Not implemented | Mock response with generated DFN |
| `PUT /patients/:dfn` | ❌ Not implemented | Mock success response |
| `GET /patients/:dfn/insurance` | ❌ Not implemented | Mock data (2 policies) |
| `POST /patients/:dfn/insurance` | ❌ Not implemented | Mock success response |
| `GET /patients/:dfn/assessment` | ❌ Not implemented | Mock assessment with history |
| `POST /patients/:dfn/admit` | ❌ Not implemented | Mock success response |
| `POST /patients/:dfn/transfer` | ❌ Not implemented | Mock success response |
| `POST /patients/:dfn/discharge` | ❌ Not implemented | Mock success response |
| `GET /patients/:dfn/flags` | ❌ Not implemented | Mock flags from patient data |
| `POST /patients/:dfn/flags` | ❌ Not implemented | Mock success response |
| `GET /room-beds` | ✅ Exists | Real data attempted first |
| `GET /reports/registration` | ❌ Not implemented | Mock summary + data |
| `GET /patients/dashboard` | ❌ Not implemented | Mock KPI stats |

**Strategy:** Each `patientService.js` function uses `try/catch` — it calls the real API first, and on failure (404/network error) falls back to structured mock data. When backend team adds endpoints, pages automatically use live data with zero frontend changes.

---

## 4. Vocabulary Compliance

**Scan result: 0 violations**

All banned VistA terms were searched across all 12 page files, the service layer, shared components, and sub-navigation:

| Banned Term | Correct Term Used | Verified |
|------------|-------------------|----------|
| DFN | Patient ID | ✅ |
| SSN | Government ID | ✅ |
| PTF | Inpatient Stay | ✅ |
| Means Test | Financial Assessment | ✅ |
| Disposition | Discharge Outcome | ✅ |
| TREATING SPECIALTY | Care Setting | ✅ |
| WARD LOCATION | Unit / Floor | ✅ |
| Primary Eligibility | Coverage Basis | ✅ |
| Period of Service | Service Era | ✅ |
| Agent Orange | Exposure: Agent Orange | ✅ |
| SENSITIVITY | Record Restriction | ✅ |
| Bed Control | Bed Management | ✅ |
| MailMan | (not referenced) | ✅ |

---

## 5. Navigation Flow Verified

1. **Dashboard → Patients**: NavRail patients icon → `/patients` (Patient Search landing)
2. **Search → Select Patient**: Click patient row → `/patients/:dfn` (Patient Dashboard)
3. **Dashboard → Edit**: "Edit Demographics" button → `/patients/:dfn/edit`
4. **Dashboard → Admit**: "Admit Patient" button → `/patients/:dfn/admit`
5. **Dashboard → Quick Actions**: All 6 action buttons navigate to correct routes
6. **Sub-Nav → All Pages**: PatientsSubNav links correctly resolve patient-parameterized routes
7. **Sub-Nav Disabled State**: Patient-required pages show disabled (greyed out) when no patient is selected
8. **Register New → Dashboard**: Register form → save → redirects to new patient dashboard
9. **Patient Banner**: Appears on PT-02 through PT-11; does NOT appear on PT-01, PT-09 (Bed Management), or PT-12 (Reports)

---

## 6. Design Consistency

| Check | Status |
|-------|--------|
| Navy table headers (#1A1A2E) with zebra striping | ✅ All tables |
| Labels above inputs with required asterisks | ✅ All forms |
| 28px page titles | ✅ All pages |
| 6px border radius on buttons/inputs | ✅ All pages |
| Loading spinners during data fetch | ✅ All pages |
| Error states for API failures | ✅ PatientDashboard, service layer fallbacks |
| Pagination component on list pages | ✅ PatientSearch, RegistrationReports |
| Patient name in LAST,FIRST MI format | ✅ Consistent |
| DOB with calculated age | ✅ PatientBanner, PatientSearch, PatientDashboard |
| Government ID masked (last 4 only) | ✅ PatientBanner, PatientSearch, PatientDemographics (password field) |
| Record Restriction red banner | ✅ PatientBanner |
| Allergy chips (red) | ✅ PatientBanner, PatientDashboard |
| PatientsSubNav (220px sidebar) | ✅ Same pattern as AdminSubNav |

---

## 7. Files Created

```
src/components/shared/PatientContext.jsx      (NEW)
src/components/shared/PatientBanner.jsx       (NEW)
src/components/shell/PatientsSubNav.jsx       (NEW)
src/services/patientService.js                (NEW)
src/pages/patients/PatientSearch.jsx          (NEW)
src/pages/patients/PatientDashboard.jsx       (NEW)
src/pages/patients/PatientDemographics.jsx    (NEW)
src/pages/patients/InsuranceCoverage.jsx      (NEW)
src/pages/patients/FinancialAssessment.jsx    (NEW)
src/pages/patients/Admission.jsx              (NEW)
src/pages/patients/Transfer.jsx               (NEW)
src/pages/patients/Discharge.jsx              (NEW)
src/pages/patients/BedManagement.jsx          (NEW)
src/pages/patients/PatientFlags.jsx           (NEW)
src/pages/patients/RecordRestrictions.jsx     (NEW)
src/pages/patients/RegistrationReports.jsx    (NEW)
```

## 8. Files Modified

```
src/App.jsx                                   (added 13 patient routes + PatientProvider wrapper)
src/components/shell/AppShell.jsx             (added PatientsSubNav conditional rendering)
```

---

## 9. Remaining Work for Backend Team

To wire the Patients workspace to live VistA data, the backend needs these endpoints added to `apps/tenant-admin/server.mjs`:

1. **Patient Search**: `GET /patients?search=...` — Query VistA PATIENT #2 via `ORWPT LIST ALL` or `ZVE PATIENT SEARCH`
2. **Patient Detail**: `GET /patients/:dfn` — Return full demographics from PATIENT #2 via `ORWPT ID INFO` or `ZVE PATIENT GET`
3. **Register Patient**: `POST /patients` — Write to PATIENT #2 via `ZVE PATIENT REGISTER`
4. **Update Patient**: `PUT /patients/:dfn` — Update PATIENT #2 fields via `ZVE PATIENT EDIT`
5. **Insurance**: `GET/POST /patients/:dfn/insurance` — Read/write insurance data
6. **Financial Assessment**: `GET/POST /patients/:dfn/assessment` — Means Test / copay assessment
7. **ADT Operations**: `POST /patients/:dfn/admit|transfer|discharge` — ADT movement RPCs
8. **Patient Flags**: `GET/POST /patients/:dfn/flags` — Patient Record Flag RPCs
9. **Registration Reports**: `GET /reports/registration` — Aggregate registration data
10. **Dashboard Stats**: `GET /patients/dashboard` — Patient count KPIs

The `patientService.js` is already structured with the exact endpoint paths. Once backend implements them, the frontend will automatically use live data.
