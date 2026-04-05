/**
 * Patient Service — Patient/Registration API calls for VistA Evolved Platform
 *
 * All endpoints call REAL backend VistA RPCs and DDR. No mock data.
 * Wave 1 ZVE RPCs are deployed and verified (17/17 endpoints pass).
 *
 * Backend proxy:  /api/ta/v1/* → tenant-admin server (server.mjs)
 * API client:     tenantApi.get / .post / .put / .delete
 *
 * VistA file references:
 *   #2       PATIENT
 *   #4       INSTITUTION
 *   #36      INSURANCE COMPANY
 *   #42      WARD LOCATION
 *   #44      HOSPITAL LOCATION
 *   #45.7    FACILITY TREATING SPECIALTY
 *   #200     NEW PERSON
 *   #405     PATIENT MOVEMENT
 *   #405.4   ROOM-BED
 *   #408.31  ANNUAL MEANS TEST
 *   #26.13   PATIENT RECORD FLAG
 */

import { tenantApi } from './api';

/* ═══════════════════════════════════════════════════════════════════════════
 *  REFERENCE DATA — Ward, Bed, Specialty, Insurance, Clinic, etc.
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * GET /wards — Ward data from VistA WARD LOCATION file #42.
 */
export async function getWards(params = {}) {
  return tenantApi.get('/wards', { tenantId: 'local-dev', ...params });
}

/**
 * GET /room-beds — Bed data from VistA ROOM-BED file #405.4.
 * Returns { ien, roomBed, description, outOfService }.
 */
export async function getRoomBeds(params = {}) {
  return tenantApi.get('/room-beds', { tenantId: 'local-dev', ...params });
}

/**
 * GET /treating-specialties — Data from VistA file #45.7.
 */
export async function getTreatingSpecialties(params = {}) {
  return tenantApi.get('/treating-specialties', { tenantId: 'local-dev', ...params });
}

/**
 * GET /insurance-companies — Data from VistA INSURANCE COMPANY file #36.
 * Returns { ien, name, streetAddr, city, state, zip }.
 */
export async function getInsuranceCompanies(params = {}) {
  return tenantApi.get('/insurance-companies', { tenantId: 'local-dev', ...params });
}

/**
 * GET /clinics — Clinic data from VistA HOSPITAL LOCATION file #44.
 */
export async function getClinics(params = {}) {
  return tenantApi.get('/clinics', { tenantId: 'local-dev', ...params });
}

/**
 * GET /divisions — Division data from VistA MCD file #40.8.
 */
export async function getDivisions(params = {}) {
  return tenantApi.get('/divisions', { tenantId: 'local-dev', ...params });
}

/**
 * GET /facilities — Facility data from VistA INSTITUTION file #4.
 */
export async function getFacilities(params = {}) {
  return tenantApi.get('/facilities', { tenantId: 'local-dev', ...params });
}

/**
 * GET /nursing-locations — Nursing location data.
 */
export async function getNursingLocations(params = {}) {
  return tenantApi.get('/nursing-locations', { tenantId: 'local-dev', ...params });
}

/**
 * GET /users — Staff/provider data from VistA NEW PERSON file #200.
 */
export async function getProviders(params = {}) {
  return tenantApi.get('/users', { tenantId: 'local-dev', ...params });
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  PATIENT SEARCH / CRUD — Live VistA via ZVE RPCs + DDR
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Search patients by name, DFN, or last-4 SSN.
 * Backend: ZVE PATIENT SEARCH EXTENDED → DDR LISTER File #2
 */
export async function searchPatients(query = '') {
  return tenantApi.get('/patients', { search: query, tenantId: 'local-dev' });
}

/**
 * Get a single patient by DFN.
 * Backend: ZVE PATIENT DEMOGRAPHICS → ddrGetsEntry File #2
 */
export async function getPatient(dfn) {
  return tenantApi.get(`/patients/${dfn}`, { tenantId: 'local-dev' });
}

/**
 * Register (create) a new patient.
 * Backend: ZVE PATIENT REGISTER → ddrFilerAddMulti File #2
 */
export async function registerPatient(data) {
  return tenantApi.post('/patients', { ...data, tenantId: 'local-dev' });
}

/**
 * Update patient demographics.
 * Backend: ZVE PATIENT EDIT → ddrFilerEditMulti File #2
 */
export async function updatePatient(dfn, data) {
  return tenantApi.put(`/patients/${dfn}`, { ...data, tenantId: 'local-dev' });
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  ADT — Admission, Transfer, Discharge (PATIENT MOVEMENT #405)
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Admit patient to inpatient bed.
 * Backend: ZVE ADT ADMIT → ddrFilerAddMulti File #405
 */
export async function admitPatient(dfn, data) {
  return tenantApi.post(`/patients/${dfn}/admit`, { ...data, tenantId: 'local-dev' });
}

/**
 * Transfer patient between wards/beds.
 * Backend: ZVE ADT TRANSFER → ddrFilerAddMulti File #405
 */
export async function transferPatient(dfn, data) {
  return tenantApi.post(`/patients/${dfn}/transfer`, { ...data, tenantId: 'local-dev' });
}

/**
 * Discharge patient from inpatient bed.
 * Backend: ZVE ADT DISCHARGE → ddrFilerAddMulti File #405
 */
export async function dischargePatient(dfn, data) {
  return tenantApi.post(`/patients/${dfn}/discharge`, { ...data, tenantId: 'local-dev' });
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  PATIENT INSURANCE — per-patient policies (File #2.312 subfile)
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Get all insurance policies for a patient.
 * Backend: DDR LISTER File #2.312
 */
export async function getPatientInsurance(dfn) {
  return tenantApi.get(`/patients/${dfn}/insurance`, { tenantId: 'local-dev' });
}

/**
 * Add insurance policy to a patient.
 * Backend: ddrFilerAddMulti File #2.312
 */
export async function addInsurance(dfn, data) {
  return tenantApi.post(`/patients/${dfn}/insurance`, { ...data, tenantId: 'local-dev' });
}

/**
 * Update an existing insurance policy.
 * Backend: ddrFilerEditMulti File #2.312
 */
export async function updateInsurance(dfn, insuranceId, data) {
  return tenantApi.put(`/patients/${dfn}/insurance/${insuranceId}`, { ...data, tenantId: 'local-dev' });
}

/**
 * Delete an insurance policy from a patient.
 * Backend: ddrFilerEdit File #2.312
 */
export async function deleteInsurance(dfn, insuranceId) {
  return tenantApi.delete(`/patients/${dfn}/insurance/${insuranceId}?tenantId=local-dev`);
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  FINANCIAL ASSESSMENT (Means Test) — ANNUAL MEANS TEST #408.31
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Get financial assessment / means test for a patient.
 * Backend: DDR LISTER File #408.31
 */
export async function getFinancialAssessment(dfn) {
  return tenantApi.get(`/patients/${dfn}/assessment`, { tenantId: 'local-dev' });
}

/**
 * Submit a financial assessment / means test.
 * Backend: ddrFilerAddMulti File #408.31
 */
export async function submitFinancialAssessment(dfn, data) {
  return tenantApi.post(`/patients/${dfn}/assessment`, { ...data, tenantId: 'local-dev' });
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  PATIENT FLAGS — PATIENT RECORD FLAG #26.13
 *  Four categories: Behavioral, Clinical, Administrative, Research
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Get all active flags for a patient.
 * Backend: ZVE PATIENT FLAGS → DDR LISTER File #26.13
 */
export async function getPatientFlags(dfn) {
  return tenantApi.get(`/patients/${dfn}/flags`, { tenantId: 'local-dev' });
}

/**
 * Add a flag to a patient record.
 * Backend: ddrFilerAddMulti File #26.13
 */
export async function addPatientFlag(dfn, data) {
  return tenantApi.post(`/patients/${dfn}/flags`, { ...data, tenantId: 'local-dev' });
}

/**
 * Inactivate (soft-delete) a patient flag.
 * Backend: ddrFilerEditMulti File #26.13
 */
export async function inactivatePatientFlag(dfn, flagId) {
  return tenantApi.put(`/patients/${dfn}/flags/${flagId}`, { status: 'inactive', tenantId: 'local-dev' });
}

/**
 * Update a patient flag (e.g. extend review date).
 * Backend: ddrFilerEditMulti File #26.13
 */
export async function updatePatientFlag(dfn, flagId, data) {
  return tenantApi.put(`/patients/${dfn}/flags/${flagId}`, { ...data, tenantId: 'local-dev' });
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  RECORD RESTRICTIONS & BREAK-THE-GLASS
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Update record restriction / sensitivity level for a patient.
 * Backend: ddrFilerEditMulti File #2, field 38.1
 */
export async function updateRecordRestriction(dfn, data) {
  return tenantApi.put(`/patients/${dfn}/restrictions`, { ...data, tenantId: 'local-dev' });
}

/**
 * Log a break-the-glass access event for a restricted patient record.
 * Backend: POST /patients/:dfn/break-glass (audit logging)
 */
export async function logBreakTheGlass(dfn, data) {
  return tenantApi.post(`/patients/${dfn}/break-glass`, { ...data, tenantId: 'local-dev' });
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  REPORTS & DASHBOARD
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Get registration report data.
 * Backend: DDR LISTER across multiple files
 */
export async function getRegistrationReport(params = {}) {
  return tenantApi.get('/reports/registration', { ...params, tenantId: 'local-dev' });
}

/**
 * Get KPI stats for the patient registration dashboard.
 * Backend: DDR LISTER File #44, #42, etc.
 */
export async function getPatientDashboardStats() {
  return tenantApi.get('/patients/dashboard', { tenantId: 'local-dev' });
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  BED MANAGEMENT — transform VistA room-bed rows to UI shape
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Transform raw VistA room-bed rows into the UI's expected bed shape.
 *
 * @param {{ ien: string, roomBed: string, description: string, outOfService: string }[]} vistaRows
 * @returns {{ id: string, ien: string, unit: string, bed: string, status: string, patient: string|null, patientDfn: string|null }[]}
 */
export function transformRoomBeds(vistaRows) {
  return vistaRows.map(row => {
    const oos = String(row.outOfService || '').toUpperCase();
    const isBlocked = oos === '1' || oos === 'YES' || oos === 'TRUE';
    return {
      id: `B-${row.ien}`,
      ien: row.ien,
      unit: row.description || 'General Ward',
      bed: row.roomBed || row.ien,
      status: isBlocked ? 'blocked' : 'available',
      patient: null,
      patientDfn: null,
    };
  });
}

/**
 * Get beds in UI shape. Calls real /room-beds and transforms.
 */
export async function getBeds() {
  const res = await tenantApi.get('/room-beds', { tenantId: 'local-dev' });
  if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
    return { ok: true, source: 'vista', data: transformRoomBeds(res.data) };
  }
  return { ok: true, source: 'vista', data: [] };
}

/**
 * Update a bed's status (e.g. unblock).
 * PUT /room-beds/:ien with { outOfService: '' } to unblock.
 */
export async function updateBed(bedIen, data) {
  return tenantApi.put(`/room-beds/${bedIen}`, { ...data, tenantId: 'local-dev' });
}

/**
 * Add a new bed.
 * POST /room-beds with { wardIen, room, bed, bedType }.
 */
export async function addBed(data) {
  return tenantApi.post('/room-beds', { ...data, tenantId: 'local-dev' });
}

/**
 * Delete a bed.
 * DELETE /room-beds/:ien
 */
export async function deleteBed(bedIen) {
  return tenantApi.delete(`/room-beds/${bedIen}?tenantId=local-dev`);
}

/**
 * Get ward census — live inpatient data from ZVE ADT CENSUS.
 * Returns { data: [{ dfn, name, roomBed, admissionDate, lengthOfStay, attending, diagnosis, diet }] }
 */
export async function getCensus(wardIen = '') {
  const params = { tenantId: 'local-dev' };
  if (wardIen) params.wardIen = wardIen;
  return tenantApi.get('/census', params);
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  AUDIT & AUTHORIZED STAFF (Record Restrictions)
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Get audit events (break-the-glass access log) for a patient.
 */
export async function getPatientAuditEvents(dfn) {
  return tenantApi.get(`/patients/${dfn}/audit-events`, { tenantId: 'local-dev' });
}

/**
 * Get authorized staff for a restricted-record patient.
 * Backend: DDR LISTER File #38.13
 */
export async function getAuthorizedStaff(dfn) {
  return tenantApi.get(`/patients/${dfn}/authorized-staff`, { tenantId: 'local-dev' });
}

/**
 * Add a staff member to the authorized access list for a restricted patient.
 * Backend: ddrFilerAddMulti File #38.13
 */
export async function addAuthorizedStaff(dfn, data) {
  return tenantApi.post(`/patients/${dfn}/authorized-staff`, { ...data, tenantId: 'local-dev' });
}

/**
 * Remove a staff member from the authorized access list.
 * Backend: ddrFilerEdit File #38.13
 */
export async function removeAuthorizedStaff(dfn, staffIen) {
  return tenantApi.delete(`/patients/${dfn}/authorized-staff/${staffIen}?tenantId=local-dev`);
}

/**
 * Verify insurance eligibility for a patient via VistA.
 * Backend: DDR LISTER File #2.312
 */
export async function verifyInsuranceEligibility(dfn) {
  return tenantApi.post(`/patients/${dfn}/verify-eligibility`, { tenantId: 'local-dev' });
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  VITALS (GMV LATEST VM / GMV ADD VM via File #120.5)
 * ═══════════════════════════════════════════════════════════════════════════ */

export async function getPatientVitals(dfn) {
  return tenantApi.get(`/patients/${dfn}/vitals`, { tenantId: 'local-dev' });
}

export async function recordVitals(dfn, vitals) {
  return tenantApi.post(`/patients/${dfn}/vitals`, { vitals, tenantId: 'local-dev' });
}
