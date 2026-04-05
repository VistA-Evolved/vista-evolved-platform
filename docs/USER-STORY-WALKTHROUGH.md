# User Story Walkthroughs — VistA Evolved Platform

**Date:** 2025-01-28
**Method:** 5 persona walkthroughs through the actual UI code, tracing every click, API call, and state change.

---

## Persona 1: Registration Clerk — "Register a Walk-In Veteran"

**Actor:** Jane, Registration Clerk (has `DG REGISTER` key)
**Goal:** Register a new veteran who walks in without an appointment.

### Steps

1. **Login** → `POST /auth/login` with access/verify codes → receives token, stored in `sessionStorage('ve-session-token')`. `LoginPage.jsx` redirects to `/dashboard`.

2. **Navigate to Registration** → Clicks "Patients" in sidebar → `PatientSearch.jsx` loads. `getPatientDashboardStats()` fires GET `/patients/dashboard` to show KPI cards (Total Patients, Active, Service Connected, Flagged).

3. **Search for existing patient** → Types "SMITH,JOHN" in search box → `searchPatients('SMITH,JOHN')` fires GET `/patients?search=SMITH,JOHN&tenantId=local-dev`. ZVE PATIENT SEARCH EXTENDED RPC executes. Results appear in table.

4. **No match found** → Clicks "Register New Patient" button → navigates to `/patients/register`. `PatientDemographics.jsx` mounts in create mode.

5. **Fill demographics** → Enters Last Name, First Name, DOB, Sex, SSN. `getDivisions()` populates Registration Facility dropdown. Form validation runs client-side for required fields, SSN format (XXX-XX-XXXX), DOB reasonableness.

6. **Duplicate check** → On blur from SSN field, `searchPatients(last4)` runs to check for duplicates. If match found, yellow duplicate warning banner shows with "Continue New Registration" or "Go to Existing Patient" options.

7. **Submit** → `registerPatient(data)` fires POST `/patients` → ZVE PATIENT REGISTER RPC → ddrFilerAddMulti writes to Patient file #2. Server returns `{ ok: true, data: { dfn: '100099', ... } }`.

8. **Success screen** → Shows green checkmark, Patient ID, and **4 CTAs**:
   - "Open Chart" → `/patients/100099`
   - **"Add Insurance"** → `/patients/100099/insurance` *(new — added in this audit)*
   - "Schedule Appointment" → `/patients/100099/schedule`
   - "Register Another" → resets form

9. **Add Insurance** → Jane clicks "Add Insurance" → `InsuranceCoverage.jsx` loads. `getPatientInsurance(100099)` returns empty array. Jane clicks "Add Policy", selects from `getInsuranceCompanies()` dropdown, enters policy number, group number, subscriber info. `addInsurance(100099, data)` fires POST `/patients/100099/insurance`.

**Result:** Patient registered in VistA with insurance. Total API calls: 7. All via real VistA RPCs.

---

## Persona 2: ADT Coordinator — "Admit, Transfer, and Discharge"

**Actor:** Carlos, ADT Coordinator (has `DG REGISTER`, `DG MENU` keys)
**Goal:** Admit a patient to Medical Ward, transfer to Surgical ICU, then discharge.

### Admit

1. **Search** → `/patients` → searches for patient → selects from results → `PatientContext` auto-fetches via URL pattern `/patients/100022`.

2. **Navigate to Admit** → `/patients/100022/admit`. `Admission.jsx` loads. Parallel API calls:
   - `getPatient(100022)` (if not already in context)
   - `getBeds()` → GET `/room-beds` → `transformRoomBeds()` maps VistA data to UI shape
   - `getWards()` → GET `/wards`
   - `getTreatingSpecialties()` → GET `/treating-specialties`
   - `getProviders()` → GET `/users`

3. **Insurance check** → If `patient.insurance.length === 0`, amber warning banner appears with "Go to Insurance" link.

4. **Fill form** → Select Ward (dropdown), Bed (filtered by selected ward), Treating Specialty, Admitting Provider, Admission Diagnosis. All dropdowns populated from real VistA data.

5. **Submit** → `admitPatient(100022, data)` fires POST `/patients/100022/admit` → ZVE ADT ADMIT → ddrFilerAddMulti writes to Patient Movement file #405.

6. **Success** → Shows "Patient Admitted Successfully" with ward name, bed, and Movement ID.

### Transfer

7. **Navigate** → `/patients/100022/transfer`. `Transfer.jsx` loads. Shows current ward/bed from patient data. Same reference data APIs fire for available wards/beds.

8. **Select new ward/bed** → Carlos picks Surgical ICU and an available bed.

9. **Submit** → `transferPatient(100022, data)` fires POST `/patients/100022/transfer` → ZVE ADT TRANSFER → new movement record in #405.

### Discharge

10. **Navigate** → `/patients/100022/discharge`. `Discharge.jsx` loads. Checks `patient.admissionStatus === 'admitted'`.

11. **Fill form** → Discharge Date/Time, Disposition ("Regular"), Diagnosis, Condition ("Good"), Discharging Provider. Discharge checklist: Rx sent, follow-up scheduled, instructions given, valuables returned.

12. **Submit** → `dischargePatient(100022, data)` fires POST `/patients/100022/discharge` → ZVE ADT DISCHARGE.

13. **Success** → Shows disposition, condition, freed bed notification, and **Length of Stay** calculation *(new — added in this audit)*.

**Result:** Full ADT cycle completed. 3 movement records created in VistA file #405.

---

## Persona 3: Privacy Officer — "Restrict a Sensitive Record"

**Actor:** Maria, Privacy Officer (has `XUMGR` key)
**Goal:** Mark a VIP patient's record as restricted and manage authorized staff.

### Steps

1. **Navigate** → `/patients/100022/restrictions`. `RecordRestrictions.jsx` loads.

2. **Set restriction** → Selects sensitivity level from dropdown. Enters reason. `updateRecordRestriction(100022, data)` fires PUT `/patients/100022/restrictions`.

3. **Add authorized staff** → Clicks "Add Staff" → staff picker modal opens. Types name in search → `getProviders({search: 'SMITH'})` populates results. Table headers show **"Staff ID"** (not "DUZ" — *fixed in this audit*). Search placeholder says **"Search by name or ID..."** (*fixed*).

4. **Select staff** → Clicks staff member → `addAuthorizedStaff(100022, data)` fires POST `/patients/100022/authorized-staff`. Staff appears in authorized list.

5. **View audit log** → Scrolls to audit section. `getPatientAuditEvents(100022)` fires GET `/patients/100022/audit-events`. Shows break-the-glass access log.

6. **Break-the-glass test** → Any user without authorization who tries to access this patient's chart is prompted by the break-the-glass dialog. `logBreakTheGlass(100022, data)` fires POST `/patients/100022/break-glass`.

**Result:** Record restricted. Authorized staff list maintained. All access audited.

---

## Persona 4: IRM Chief — "Audit System Access"

**Actor:** Robert, IRM Chief (has `XUMGR`, `XUPROG`, `XUPROGMODE` keys)
**Goal:** Review system access audit trail and manage staff permissions.

### Steps

1. **Login** → Has admin keys → `RequireAdmin` checks session → `GET /auth/session` returns keys including XUMGR → `sessionStorage('ve-admin-verified')` set to 'true' → admin routes accessible.

2. **Staff Directory** → `/admin/staff`. `StaffDirectory.jsx` loads. Calls admin service to list users from VistA NEW PERSON file #200. Shows name, **Staff ID** (*not "DUZ" — fixed in CSV export*), status, service, division.

3. **Export CSV** → Clicks export → CSV downloads with header **"Name,Staff ID,Status,Service,Division"** *(fixed from "Name,DUZ,...")*. 

4. **Audit Log** → `/admin/audit`. `AuditLog.jsx` loads. Three sources: Sign-On Log, Programmer Mode, Data Audit. User column shows names or **"Staff 12345"** fallback *(fixed from "DUZ 12345")*.

5. **Site Parameters** → `/admin/parameters`. `SiteParameters.jsx` shows Session Timeout, Auto Sign-Off Delay, and **"Response Timeout"** *(fixed from "RPC Timeout")*.

6. **Master Config** → `/admin/config`. `MasterConfig.jsx` session section shows **"Response Timeout"** *(fixed from "RPC Timeout")*.

**Result:** Full admin audit capability. All VistA-internal terms replaced with user-friendly labels.

---

## Persona 5: Supervisor — "Review Registration Reports"

**Actor:** Lisa, Supervisory Registration Clerk
**Goal:** Pull daily registration reports, review financial assessments.

### Steps

1. **Registration Reports** → `/patients/reports`. `RegistrationReports.jsx` loads. Dropdown selects report type (Daily Activity, Monthly Summary, Pending). Division filter from `getDivisions()`.

2. **Run report** → `getRegistrationReport({type:'daily', ...})` fires GET `/reports/registration?type=daily&tenantId=local-dev`. Data table renders with Patient ID, Name, Registration Date, Type, Division.

3. **Financial Assessment** → Navigates to patient → `/patients/100022/assessment`. `FinancialAssessment.jsx` loads. `getFinancialAssessment(100022)` returns existing assessment if any. KPI cards show:
   - Copay Category (A/B/C) with color-coded badge
   - Assessment Date
   - Annual Income
   - Net Worth

4. **Submit new assessment** → Fills income, assets, dependents. `submitFinancialAssessment(100022, data)` fires POST `/patients/100022/assessment`. Results update showing copay determination.

**Result:** Registration report data from live VistA. Financial assessment creates real means test record.

---

## Cross-Cutting Observations

| Feature | Status | Notes |
|---------|--------|-------|
| Session timeout (15 min) | Works | SessionManager.jsx enforces VHA Directive 6500 |
| PatientContext auto-fetch | Works | *New — watches URL for /patients/:dfn* |
| PatientBanner | Works | Shows patient name, DOB, age, flags on all patient subpages |
| Error handling | Works | All API calls show error banners on failure |
| Loading states | Works | Spinner/skeleton states on all data-fetching pages |
| Form validation | Works | Client-side required field + format checks |
| Keyboard navigation | Partial | Tab order works, but no ARIA roles on custom dropdowns |
| Mobile responsiveness | Partial | Tailwind responsive classes used, but not tested on mobile |
| Accessibility (508) | Partial | Color contrast meets WCAG AA, but screen reader testing not done |
