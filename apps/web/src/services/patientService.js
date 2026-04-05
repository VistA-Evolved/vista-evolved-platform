/**
 * Patient Service — Patient/Registration API calls for VistA Evolved Platform
 *
 * Strategy:
 *   - Reference-data endpoints (wards, beds, treating specialties, insurance
 *     companies, clinics, divisions, facilities, nursing locations, providers)
 *     call REAL backend endpoints that EXIST on the tenant-admin server.
 *     If they fail, the error propagates — NO mock fallback.
 *
 *   - Patient CRUD, ADT, insurance, assessment, flags, restrictions, and
 *     break-the-glass endpoints call the PLANNED backend URLs first.  When the
 *     backend returns an error (ZVE wrapper RPCs not yet implemented), the
 *     service catches the error and returns comprehensive mock data that
 *     matches VistA field shapes.  Every mock response carries `source: 'mock'`
 *     so the UI can render a subtle indicator.
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
 *  UTILITIES
 * ═══════════════════════════════════════════════════════════════════════════ */

function isoToday() {
  return new Date().toISOString().split('T')[0];
}

function isoNow() {
  return new Date().toISOString();
}

function formatDob(dob) {
  if (!dob) return '';
  const d = new Date(dob + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function calcAge(dob) {
  if (!dob) return null;
  const birth = new Date(dob + 'T00:00:00');
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function mockId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Wraps an API call. On error, returns a structured error response
 * instead of silently falling back to mock data. The fallbackFn is
 * retained ONLY as a last resort when the backend is completely unreachable
 * (e.g. dev offline mode). All responses from fallback carry `source: 'mock'`.
 */
async function withMockFallback(apiCall, fallbackFn) {
  try {
    const result = await apiCall();
    return result;
  } catch (err) {
    // If backend returned a structured error, propagate it
    if (err?.response?.data?.ok === false) {
      return err.response.data;
    }
    // Network error or backend unreachable — use fallback for dev tolerance
    const fallback = typeof fallbackFn === 'function' ? fallbackFn() : fallbackFn;
    if (fallback && typeof fallback === 'object' && !fallback.source) {
      fallback.source = 'mock';
    }
    return fallback;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  MOCK DATA — Comprehensive, realistic VistA-shaped records
 *  Used ONLY when backend patient endpoints are not yet available.
 * ═══════════════════════════════════════════════════════════════════════════ */

const MOCK_PATIENTS = [
  // 1 — Active inpatient, service-connected, flags
  {
    dfn: '100001', name: 'SMITH,JOHN A', dob: '1955-01-15', sex: 'M',
    ssn: '666321234', preferredName: 'Jack',
    streetAddress1: '1420 NW Lovejoy St', streetAddress2: '', streetAddress3: '',
    city: 'Portland', state: 'OR', zip: '97209', county: 'Multnomah', country: 'USA',
    phone: '5035550101', email: '',
    race: 'White', ethnicity: 'Not Hispanic or Latino',
    maritalStatus: 'Married', religion: 'Catholic',
    genderIdentity: 'Male',
    veteranStatus: true, serviceConnected: true, scPercent: 70,
    emergencyContact: { name: 'SMITH,MARY B', relationship: 'Spouse', phone: '5035550190' },
    nextOfKin: { name: 'SMITH,MARY B', relationship: 'Spouse', phone: '5035550190' },
    registrationSite: { ien: '1', name: 'VEHU DIVISION' },
    status: 'active', admitted: true, wardIen: '1', roomBed: '301-A',
    dateOfDeath: null, isRestricted: false, isSensitive: false,
    allergies: ['PENICILLIN', 'SULFA DRUGS'],
    flags: [{ name: 'Fall Risk', category: 'Clinical' }],
    codeStatus: '',
    problems: [
      { name: 'Essential Hypertension', icd: 'I10', onset: '2015-03-12', status: 'active', scCondition: true },
      { name: 'Type 2 Diabetes Mellitus without complications', icd: 'E11.9', onset: '2018-06-01', status: 'active', scCondition: true },
      { name: 'Post-traumatic Stress Disorder', icd: 'F43.10', onset: '2010-01-20', status: 'active', scCondition: true },
    ],
    medications: [
      { name: 'LISINOPRIL 20MG TAB', sig: 'TAKE ONE TABLET BY MOUTH EVERY DAY', status: 'active', fillDate: '2026-03-01' },
      { name: 'METFORMIN HCL 500MG TAB', sig: 'TAKE ONE TABLET BY MOUTH TWICE A DAY WITH MEALS', status: 'active', fillDate: '2026-03-01' },
      { name: 'SERTRALINE HCL 100MG TAB', sig: 'TAKE ONE TABLET BY MOUTH EVERY DAY', status: 'active', fillDate: '2026-02-15' },
    ],
    appointments: [
      { date: '2026-04-10', time: '09:00', clinic: 'PRIMARY CARE', clinicIen: '64', provider: 'WILSON,SARAH J', status: 'scheduled' },
      { date: '2026-04-22', time: '14:30', clinic: 'MENTAL HEALTH', clinicIen: '71', provider: 'NGUYEN,THOMAS V', status: 'scheduled' },
    ],
    recentVisits: [
      { date: '2026-03-15', clinic: 'PRIMARY CARE', provider: 'WILSON,SARAH J', type: 'Follow-up' },
      { date: '2026-02-10', clinic: 'LABORATORY', provider: '', type: 'Lab Draw' },
    ],
    insurance: [
      { id: 'INS-A001', companyIen: '12', planName: 'TRICARE Prime', groupNumber: 'DOD-7741', policyNumber: 'TCP-5538821', subscriberName: 'SMITH,JOHN A', relationship: 'Self', effectiveDate: '2022-01-01', expirationDate: '2027-12-31', type: 'primary' },
    ],
  },
  // 2 — Active outpatient, female, Hispanic
  {
    dfn: '100002', name: 'GARCIA,MARIA L', dob: '1968-07-22', sex: 'F',
    ssn: '666458891', preferredName: '',
    streetAddress1: '2805 SE Hawthorne Blvd', streetAddress2: 'Apt 4B', streetAddress3: '',
    city: 'Portland', state: 'OR', zip: '97214', county: 'Multnomah', country: 'USA',
    phone: '5035550102', email: '',
    race: 'White', ethnicity: 'Hispanic or Latino',
    maritalStatus: 'Divorced', religion: '',
    genderIdentity: 'Female',
    veteranStatus: true, serviceConnected: true, scPercent: 30,
    emergencyContact: { name: 'GARCIA,CARLOS R', relationship: 'Son', phone: '5035550291' },
    nextOfKin: { name: 'GARCIA,CARLOS R', relationship: 'Son', phone: '5035550291' },
    registrationSite: { ien: '1', name: 'VEHU DIVISION' },
    status: 'active', admitted: false, wardIen: null, roomBed: null,
    dateOfDeath: null, isRestricted: false, isSensitive: false,
    allergies: ['CODEINE'],
    flags: [{ name: 'Fall Risk', category: 'Clinical' }],
    codeStatus: '',
    problems: [
      { name: 'Major Depressive Disorder, recurrent', icd: 'F33.1', onset: '2017-09-10', status: 'active', scCondition: true },
      { name: 'Chronic low back pain', icd: 'M54.5', onset: '2019-04-22', status: 'active', scCondition: false },
    ],
    medications: [
      { name: 'FLUOXETINE HCL 20MG CAP', sig: 'TAKE ONE CAPSULE BY MOUTH EVERY MORNING', status: 'active', fillDate: '2026-03-10' },
      { name: 'IBUPROFEN 800MG TAB', sig: 'TAKE ONE TABLET BY MOUTH THREE TIMES A DAY WITH FOOD', status: 'active', fillDate: '2026-03-10' },
    ],
    appointments: [
      { date: '2026-04-08', time: '10:30', clinic: 'MENTAL HEALTH', clinicIen: '71', provider: 'NGUYEN,THOMAS V', status: 'scheduled' },
    ],
    recentVisits: [
      { date: '2026-03-22', clinic: 'PRIMARY CARE', provider: 'WILSON,SARAH J', type: 'Annual Physical' },
    ],
    insurance: [],
  },
  // 3 — Elderly inpatient, DNR, no service connection
  {
    dfn: '100003', name: 'JOHNSON,ROBERT W', dob: '1942-11-03', sex: 'M',
    ssn: '666122210', preferredName: 'Bob',
    streetAddress1: '6700 SW Capitol Hwy', streetAddress2: '', streetAddress3: '',
    city: 'Portland', state: 'OR', zip: '97219', county: 'Multnomah', country: 'USA',
    phone: '5035550103', email: '',
    race: 'Black or African American', ethnicity: 'Not Hispanic or Latino',
    maritalStatus: 'Widowed', religion: 'Baptist',
    genderIdentity: 'Male',
    veteranStatus: true, serviceConnected: false, scPercent: 0,
    emergencyContact: { name: 'JOHNSON,LISA M', relationship: 'Daughter', phone: '5035550392' },
    nextOfKin: { name: 'JOHNSON,LISA M', relationship: 'Daughter', phone: '5035550392' },
    registrationSite: { ien: '2', name: 'VEHU CBOC' },
    status: 'active', admitted: true, wardIen: '1', roomBed: '302-A',
    dateOfDeath: null, isRestricted: false, isSensitive: false,
    allergies: [],
    flags: [],
    codeStatus: 'DNR',
    problems: [
      { name: 'Congestive Heart Failure, unspecified', icd: 'I50.9', onset: '2020-02-14', status: 'active', scCondition: false },
      { name: 'Atrial Fibrillation', icd: 'I48.91', onset: '2020-02-14', status: 'active', scCondition: false },
      { name: 'Chronic Kidney Disease, stage 3', icd: 'N18.3', onset: '2021-08-05', status: 'active', scCondition: false },
    ],
    medications: [
      { name: 'WARFARIN SODIUM 5MG TAB', sig: 'TAKE ONE TABLET BY MOUTH EVERY DAY', status: 'active', fillDate: '2026-03-20' },
      { name: 'FUROSEMIDE 40MG TAB', sig: 'TAKE ONE TABLET BY MOUTH EVERY MORNING', status: 'active', fillDate: '2026-03-20' },
      { name: 'POTASSIUM CL 20MEQ TAB SA', sig: 'TAKE ONE TABLET BY MOUTH EVERY DAY', status: 'active', fillDate: '2026-03-20' },
    ],
    appointments: [],
    recentVisits: [
      { date: '2026-03-28', clinic: 'CARDIOLOGY', provider: 'PATEL,ANIL K', type: 'Admission' },
    ],
    insurance: [
      { id: 'INS-C001', companyIen: '5', planName: 'MEDICARE PART A', groupNumber: '', policyNumber: 'MCA-7723456', subscriberName: 'JOHNSON,ROBERT W', relationship: 'Self', effectiveDate: '2007-11-01', expirationDate: '', type: 'primary' },
      { id: 'INS-C002', companyIen: '6', planName: 'MEDICARE PART B', groupNumber: '', policyNumber: 'MCB-7723456', subscriberName: 'JOHNSON,ROBERT W', relationship: 'Self', effectiveDate: '2007-11-01', expirationDate: '', type: 'secondary' },
    ],
  },
  // 4 — Behavioral flag, restricted record, female
  {
    dfn: '100004', name: 'WILLIAMS,PATRICIA M', dob: '1978-03-30', sex: 'F',
    ssn: '666785567', preferredName: 'Pat',
    streetAddress1: '3344 NE Broadway', streetAddress2: '', streetAddress3: '',
    city: 'Portland', state: 'OR', zip: '97232', county: 'Multnomah', country: 'USA',
    phone: '5035550104', email: '',
    race: 'White', ethnicity: 'Not Hispanic or Latino',
    maritalStatus: 'Single', religion: '',
    genderIdentity: 'Female',
    veteranStatus: true, serviceConnected: true, scPercent: 100,
    emergencyContact: { name: 'WILLIAMS,JAMES R', relationship: 'Father', phone: '5035550493' },
    nextOfKin: { name: 'WILLIAMS,JAMES R', relationship: 'Father', phone: '5035550493' },
    registrationSite: { ien: '1', name: 'VEHU DIVISION' },
    status: 'active', admitted: false, wardIen: null, roomBed: null,
    dateOfDeath: null, isRestricted: true, isSensitive: true,
    allergies: ['ASPIRIN', 'LATEX', 'IODINE CONTRAST DYE'],
    flags: [
      { name: 'Behavioral - Violence', category: 'Behavioral' },
      { name: 'High Risk for Suicide', category: 'Behavioral' },
    ],
    codeStatus: '',
    problems: [
      { name: 'Bipolar I Disorder, current episode manic', icd: 'F31.1', onset: '2005-08-22', status: 'active', scCondition: true },
      { name: 'Post-traumatic Stress Disorder', icd: 'F43.10', onset: '2005-08-22', status: 'active', scCondition: true },
      { name: 'Military Sexual Trauma', icd: 'F43.12', onset: '2004-06-01', status: 'active', scCondition: true },
    ],
    medications: [
      { name: 'LITHIUM CARBONATE 300MG CAP', sig: 'TAKE ONE CAPSULE BY MOUTH THREE TIMES A DAY', status: 'active', fillDate: '2026-03-05' },
      { name: 'PRAZOSIN HCL 2MG CAP', sig: 'TAKE ONE CAPSULE BY MOUTH AT BEDTIME', status: 'active', fillDate: '2026-03-05' },
      { name: 'QUETIAPINE FUMARATE 100MG TAB', sig: 'TAKE ONE TABLET BY MOUTH AT BEDTIME', status: 'active', fillDate: '2026-03-05' },
    ],
    appointments: [
      { date: '2026-04-07', time: '13:00', clinic: 'MENTAL HEALTH', clinicIen: '71', provider: 'NGUYEN,THOMAS V', status: 'scheduled' },
      { date: '2026-04-14', time: '11:00', clinic: 'WOMEN VETERAN', clinicIen: '82', provider: 'CHEN,AMY L', status: 'scheduled' },
    ],
    recentVisits: [
      { date: '2026-03-24', clinic: 'MENTAL HEALTH', provider: 'NGUYEN,THOMAS V', type: 'Crisis Follow-up' },
      { date: '2026-03-20', clinic: 'EMERGENCY DEPARTMENT', provider: 'BROOKS,JAMES T', type: 'Emergency' },
    ],
    insurance: [],
  },
  // 5 — Young male, active, no issues
  {
    dfn: '100005', name: 'BROWN,JAMES T', dob: '1990-09-12', sex: 'M',
    ssn: '666553345', preferredName: 'Jim',
    streetAddress1: '1855 SW Broadway', streetAddress2: '', streetAddress3: '',
    city: 'Portland', state: 'OR', zip: '97201', county: 'Multnomah', country: 'USA',
    phone: '5035550105', email: '',
    race: 'White', ethnicity: 'Not Hispanic or Latino',
    maritalStatus: 'Single', religion: '',
    genderIdentity: 'Male',
    veteranStatus: true, serviceConnected: false, scPercent: 0,
    emergencyContact: { name: 'BROWN,CAROL A', relationship: 'Mother', phone: '5035550594' },
    nextOfKin: { name: 'BROWN,CAROL A', relationship: 'Mother', phone: '5035550594' },
    registrationSite: { ien: '3', name: 'VEHU-PRRTP' },
    status: 'active', admitted: false, wardIen: null, roomBed: null,
    dateOfDeath: null, isRestricted: false, isSensitive: false,
    allergies: [],
    flags: [],
    codeStatus: '',
    problems: [
      { name: 'Adjustment Disorder with mixed anxiety and depressed mood', icd: 'F43.23', onset: '2025-11-01', status: 'active', scCondition: false },
    ],
    medications: [],
    appointments: [
      { date: '2026-04-15', time: '08:00', clinic: 'PRRTP INTAKE', clinicIen: '90', provider: 'MARTINEZ,DANIEL S', status: 'scheduled' },
    ],
    recentVisits: [],
    insurance: [
      { id: 'INS-E001', companyIen: '20', planName: 'BLUE CROSS BLUE SHIELD PPO', groupNumber: 'GRP-44821', policyNumber: 'BCB-9982341', subscriberName: 'BROWN,JAMES T', relationship: 'Self', effectiveDate: '2025-01-01', expirationDate: '2026-12-31', type: 'primary' },
    ],
  },
  // 6 — Female, active, multiple medications
  {
    dfn: '100006', name: 'JONES,LINDA S', dob: '1985-04-18', sex: 'F',
    ssn: '666886678', preferredName: '',
    streetAddress1: '4510 N Williams Ave', streetAddress2: '', streetAddress3: '',
    city: 'Portland', state: 'OR', zip: '97217', county: 'Multnomah', country: 'USA',
    phone: '5035550106', email: '',
    race: 'Black or African American', ethnicity: 'Not Hispanic or Latino',
    maritalStatus: 'Married', religion: 'Protestant',
    genderIdentity: 'Female',
    veteranStatus: true, serviceConnected: true, scPercent: 50,
    emergencyContact: { name: 'JONES,DAVID R', relationship: 'Spouse', phone: '5035550695' },
    nextOfKin: { name: 'JONES,DAVID R', relationship: 'Spouse', phone: '5035550695' },
    registrationSite: { ien: '1', name: 'VEHU DIVISION' },
    status: 'active', admitted: false, wardIen: null, roomBed: null,
    dateOfDeath: null, isRestricted: false, isSensitive: false,
    allergies: ['MORPHINE SULFATE'],
    flags: [],
    codeStatus: '',
    problems: [
      { name: 'Asthma, moderate persistent', icd: 'J45.40', onset: '2012-05-10', status: 'active', scCondition: false },
      { name: 'Migraine without aura', icd: 'G43.009', onset: '2016-03-15', status: 'active', scCondition: false },
      { name: 'Lumbar radiculopathy', icd: 'M54.17', onset: '2020-09-30', status: 'active', scCondition: true },
    ],
    medications: [
      { name: 'ALBUTEROL INH 90MCG/ACT', sig: 'INHALE 2 PUFFS BY MOUTH EVERY 4-6 HOURS AS NEEDED', status: 'active', fillDate: '2026-02-28' },
      { name: 'SUMATRIPTAN SUCCINATE 50MG TAB', sig: 'TAKE ONE TABLET BY MOUTH AS NEEDED FOR MIGRAINE', status: 'active', fillDate: '2026-02-28' },
      { name: 'GABAPENTIN 300MG CAP', sig: 'TAKE ONE CAPSULE BY MOUTH THREE TIMES A DAY', status: 'active', fillDate: '2026-03-15' },
    ],
    appointments: [
      { date: '2026-04-12', time: '11:00', clinic: 'PRIMARY CARE', clinicIen: '64', provider: 'WILSON,SARAH J', status: 'scheduled' },
    ],
    recentVisits: [
      { date: '2026-03-01', clinic: 'PULMONARY', provider: 'FOSTER,ROBERT K', type: 'Follow-up' },
    ],
    insurance: [],
  },
  // 7 — Inactive/deceased male
  {
    dfn: '100007', name: 'DAVIS,MICHAEL R', dob: '1950-12-25', sex: 'M',
    ssn: '666999901', preferredName: 'Mike',
    streetAddress1: '900 SW 5th Ave', streetAddress2: '', streetAddress3: '',
    city: 'Portland', state: 'OR', zip: '97204', county: 'Multnomah', country: 'USA',
    phone: '5035550107', email: '',
    race: 'White', ethnicity: 'Not Hispanic or Latino',
    maritalStatus: 'Married', religion: 'Methodist',
    genderIdentity: 'Male',
    veteranStatus: true, serviceConnected: true, scPercent: 40,
    emergencyContact: { name: 'DAVIS,ELLEN M', relationship: 'Spouse', phone: '5035550796' },
    nextOfKin: { name: 'DAVIS,ELLEN M', relationship: 'Spouse', phone: '5035550796' },
    registrationSite: { ien: '2', name: 'VEHU CBOC' },
    status: 'deceased', admitted: false, wardIen: null, roomBed: null,
    dateOfDeath: '2026-03-10', isRestricted: false, isSensitive: false,
    allergies: [],
    flags: [],
    codeStatus: 'DNR/DNI',
    problems: [
      { name: 'Lung Cancer, unspecified', icd: 'C34.90', onset: '2024-06-15', status: 'active', scCondition: false },
      { name: 'Chronic Obstructive Pulmonary Disease', icd: 'J44.1', onset: '2018-01-20', status: 'active', scCondition: true },
    ],
    medications: [],
    appointments: [],
    recentVisits: [
      { date: '2026-03-10', clinic: 'PALLIATIVE CARE', provider: 'HERNANDEZ,MARIA T', type: 'Death Summary' },
      { date: '2026-03-01', clinic: 'ONCOLOGY', provider: 'PARK,JAMES W', type: 'Consult' },
    ],
    insurance: [
      { id: 'INS-G001', companyIen: '5', planName: 'MEDICARE PART A', groupNumber: '', policyNumber: 'MCA-9901245', subscriberName: 'DAVIS,MICHAEL R', relationship: 'Self', effectiveDate: '2015-12-01', expirationDate: '', type: 'primary' },
    ],
  },
  // 8 — Inpatient surgical, behavioral flag, Hispanic female
  {
    dfn: '100008', name: 'MARTINEZ,ROSA E', dob: '1973-06-07', sex: 'F',
    ssn: '666111123', preferredName: 'Rosie',
    streetAddress1: '2200 NE Alberta St', streetAddress2: '', streetAddress3: '',
    city: 'Portland', state: 'OR', zip: '97211', county: 'Multnomah', country: 'USA',
    phone: '5035550108', email: '',
    race: 'White', ethnicity: 'Hispanic or Latino',
    maritalStatus: 'Married', religion: 'Roman Catholic',
    genderIdentity: 'Female',
    veteranStatus: true, serviceConnected: true, scPercent: 20,
    emergencyContact: { name: 'MARTINEZ,PEDRO J', relationship: 'Spouse', phone: '5035550897' },
    nextOfKin: { name: 'MARTINEZ,PEDRO J', relationship: 'Spouse', phone: '5035550897' },
    registrationSite: { ien: '1', name: 'VEHU DIVISION' },
    status: 'active', admitted: true, wardIen: '2', roomBed: '401-A',
    dateOfDeath: null, isRestricted: false, isSensitive: false,
    allergies: ['PENICILLIN'],
    flags: [{ name: 'Suicide Precaution', category: 'Behavioral' }],
    codeStatus: '',
    problems: [
      { name: 'Generalized Anxiety Disorder', icd: 'F41.1', onset: '2016-07-18', status: 'active', scCondition: true },
      { name: 'Status post appendectomy', icd: 'Z87.09', onset: '2026-03-30', status: 'active', scCondition: false },
    ],
    medications: [
      { name: 'BUSPIRONE HCL 10MG TAB', sig: 'TAKE ONE TABLET BY MOUTH TWICE A DAY', status: 'active', fillDate: '2026-03-15' },
      { name: 'ACETAMINOPHEN 500MG TAB', sig: 'TAKE TWO TABLETS BY MOUTH EVERY 6 HOURS AS NEEDED FOR PAIN', status: 'active', fillDate: '2026-03-30' },
    ],
    appointments: [],
    recentVisits: [
      { date: '2026-03-30', clinic: 'SURGERY', provider: 'KIM,HENRY S', type: 'Admission' },
    ],
    insurance: [
      { id: 'INS-H001', companyIen: '15', planName: 'AETNA HMO', groupNumber: 'AET-90412', policyNumber: 'AHM-3321789', subscriberName: 'MARTINEZ,PEDRO J', relationship: 'Spouse', effectiveDate: '2024-06-01', expirationDate: '2027-05-31', type: 'primary' },
    ],
  },
  // 9 — Outpatient, male, Asian
  {
    dfn: '100009', name: 'ANDERSON,DAVID K', dob: '1961-02-14', sex: 'M',
    ssn: '666444456', preferredName: '',
    streetAddress1: '8245 SE Foster Rd', streetAddress2: '', streetAddress3: '',
    city: 'Portland', state: 'OR', zip: '97266', county: 'Multnomah', country: 'USA',
    phone: '5035550109', email: '',
    race: 'Asian', ethnicity: 'Not Hispanic or Latino',
    maritalStatus: 'Married', religion: 'Buddhist',
    genderIdentity: 'Male',
    veteranStatus: true, serviceConnected: true, scPercent: 10,
    emergencyContact: { name: 'ANDERSON,JUNE L', relationship: 'Spouse', phone: '5035550998' },
    nextOfKin: { name: 'ANDERSON,JUNE L', relationship: 'Spouse', phone: '5035550998' },
    registrationSite: { ien: '1', name: 'VEHU DIVISION' },
    status: 'active', admitted: false, wardIen: null, roomBed: null,
    dateOfDeath: null, isRestricted: false, isSensitive: false,
    allergies: [],
    flags: [],
    codeStatus: '',
    problems: [
      { name: 'Hyperlipidemia, unspecified', icd: 'E78.5', onset: '2019-01-10', status: 'active', scCondition: false },
      { name: 'Benign prostatic hyperplasia', icd: 'N40.0', onset: '2022-04-12', status: 'active', scCondition: false },
    ],
    medications: [
      { name: 'ATORVASTATIN CALCIUM 40MG TAB', sig: 'TAKE ONE TABLET BY MOUTH AT BEDTIME', status: 'active', fillDate: '2026-03-01' },
      { name: 'TAMSULOSIN HCL 0.4MG CAP', sig: 'TAKE ONE CAPSULE BY MOUTH AT BEDTIME', status: 'active', fillDate: '2026-03-01' },
    ],
    appointments: [
      { date: '2026-04-20', time: '08:30', clinic: 'PRIMARY CARE', clinicIen: '64', provider: 'WILSON,SARAH J', status: 'scheduled' },
    ],
    recentVisits: [
      { date: '2026-01-15', clinic: 'UROLOGY', provider: 'JACKSON,MARK D', type: 'Follow-up' },
    ],
    insurance: [],
  },
  // 10 — Young female
  {
    dfn: '100010', name: 'TAYLOR,SUSAN B', dob: '1995-08-20', sex: 'F',
    ssn: '666777789', preferredName: 'Sue',
    streetAddress1: '550 SW Oak St', streetAddress2: 'Unit 1204', streetAddress3: '',
    city: 'Portland', state: 'OR', zip: '97204', county: 'Multnomah', country: 'USA',
    phone: '5035550110', email: '',
    race: 'White', ethnicity: 'Not Hispanic or Latino',
    maritalStatus: 'Single', religion: '',
    genderIdentity: 'Female',
    veteranStatus: true, serviceConnected: false, scPercent: 0,
    emergencyContact: { name: 'TAYLOR,MARK A', relationship: 'Father', phone: '5035551099' },
    nextOfKin: { name: 'TAYLOR,MARK A', relationship: 'Father', phone: '5035551099' },
    registrationSite: { ien: '2', name: 'VEHU CBOC' },
    status: 'active', admitted: false, wardIen: null, roomBed: null,
    dateOfDeath: null, isRestricted: false, isSensitive: false,
    allergies: ['NSAIDS'],
    flags: [],
    codeStatus: '',
    problems: [
      { name: 'Iron deficiency anemia', icd: 'D50.9', onset: '2025-06-01', status: 'active', scCondition: false },
    ],
    medications: [
      { name: 'FERROUS SULFATE 325MG TAB', sig: 'TAKE ONE TABLET BY MOUTH EVERY DAY', status: 'active', fillDate: '2026-03-10' },
    ],
    appointments: [
      { date: '2026-04-18', time: '14:00', clinic: 'WOMEN VETERAN', clinicIen: '82', provider: 'CHEN,AMY L', status: 'scheduled' },
    ],
    recentVisits: [
      { date: '2026-03-10', clinic: 'LABORATORY', provider: '', type: 'Lab Draw' },
    ],
    insurance: [
      { id: 'INS-J001', companyIen: '22', planName: 'KAISER PERMANENTE HMO', groupNumber: 'KP-60233', policyNumber: 'KPH-4410098', subscriberName: 'TAYLOR,SUSAN B', relationship: 'Self', effectiveDate: '2025-06-01', expirationDate: '2026-12-31', type: 'primary' },
    ],
  },
  // 11 — Elderly inpatient ICU, comfort care
  {
    dfn: '100011', name: 'THOMAS,CHARLES E', dob: '1938-05-01', sex: 'M',
    ssn: '666222234', preferredName: 'Charlie',
    streetAddress1: '1630 SW Harbor Way', streetAddress2: '', streetAddress3: '',
    city: 'Portland', state: 'OR', zip: '97201', county: 'Multnomah', country: 'USA',
    phone: '5035550111', email: '',
    race: 'White', ethnicity: 'Not Hispanic or Latino',
    maritalStatus: 'Widowed', religion: 'Presbyterian',
    genderIdentity: 'Male',
    veteranStatus: true, serviceConnected: true, scPercent: 60,
    emergencyContact: { name: 'THOMAS,WILLIAM C', relationship: 'Son', phone: '5035551100' },
    nextOfKin: { name: 'THOMAS,WILLIAM C', relationship: 'Son', phone: '5035551100' },
    registrationSite: { ien: '1', name: 'VEHU DIVISION' },
    status: 'active', admitted: true, wardIen: '3', roomBed: 'ICU-01',
    dateOfDeath: null, isRestricted: false, isSensitive: false,
    allergies: ['PENICILLIN', 'CODEINE'],
    flags: [],
    codeStatus: 'Comfort Care',
    problems: [
      { name: 'Sepsis, unspecified organism', icd: 'A41.9', onset: '2026-03-25', status: 'active', scCondition: false },
      { name: 'Acute kidney injury', icd: 'N17.9', onset: '2026-03-25', status: 'active', scCondition: false },
      { name: 'Coronary Artery Disease', icd: 'I25.10', onset: '2010-02-20', status: 'active', scCondition: true },
      { name: 'Diabetes Mellitus Type 2 with neuropathy', icd: 'E11.40', onset: '2005-06-14', status: 'active', scCondition: true },
    ],
    medications: [
      { name: 'MORPHINE SULFATE 2MG/ML INJ', sig: '1-4MG IV EVERY 2 HOURS AS NEEDED FOR PAIN', status: 'active', fillDate: '2026-03-25' },
      { name: 'VANCOMYCIN HCL 1GM IV', sig: 'INFUSE OVER 60 MINUTES EVERY 12 HOURS', status: 'active', fillDate: '2026-03-25' },
      { name: 'INSULIN REGULAR 100U/ML INJ', sig: 'PER SLIDING SCALE EVERY 6 HOURS', status: 'active', fillDate: '2026-03-25' },
    ],
    appointments: [],
    recentVisits: [
      { date: '2026-03-25', clinic: 'INTENSIVE CARE', provider: 'BROOKS,JAMES T', type: 'Admission' },
    ],
    insurance: [
      { id: 'INS-K001', companyIen: '5', planName: 'MEDICARE PART A', groupNumber: '', policyNumber: 'MCA-2234561', subscriberName: 'THOMAS,CHARLES E', relationship: 'Self', effectiveDate: '2003-05-01', expirationDate: '', type: 'primary' },
    ],
  },
  // 12 — Administrative/Research flag
  {
    dfn: '100012', name: 'HERNANDEZ,ANA M', dob: '1982-10-11', sex: 'F',
    ssn: '666555578', preferredName: '',
    streetAddress1: '3030 SE Division St', streetAddress2: '', streetAddress3: '',
    city: 'Portland', state: 'OR', zip: '97202', county: 'Multnomah', country: 'USA',
    phone: '5035550112', email: '',
    race: 'White', ethnicity: 'Hispanic or Latino',
    maritalStatus: 'Married', religion: '',
    genderIdentity: 'Female',
    veteranStatus: true, serviceConnected: false, scPercent: 0,
    emergencyContact: { name: 'HERNANDEZ,CARLOS M', relationship: 'Spouse', phone: '5035551201' },
    nextOfKin: { name: 'HERNANDEZ,CARLOS M', relationship: 'Spouse', phone: '5035551201' },
    registrationSite: { ien: '1', name: 'VEHU DIVISION' },
    status: 'active', admitted: false, wardIen: null, roomBed: null,
    dateOfDeath: null, isRestricted: false, isSensitive: false,
    allergies: [],
    flags: [
      { name: 'Research Protocol Enrollment', category: 'Research' },
      { name: 'Missing ID Verification', category: 'Administrative' },
    ],
    codeStatus: '',
    problems: [
      { name: 'Rheumatoid Arthritis, unspecified', icd: 'M06.9', onset: '2020-04-22', status: 'active', scCondition: false },
    ],
    medications: [
      { name: 'METHOTREXATE 2.5MG TAB', sig: 'TAKE 3 TABLETS BY MOUTH ONCE A WEEK ON MONDAY', status: 'active', fillDate: '2026-03-08' },
      { name: 'FOLIC ACID 1MG TAB', sig: 'TAKE ONE TABLET BY MOUTH EVERY DAY EXCEPT MONDAY', status: 'active', fillDate: '2026-03-08' },
    ],
    appointments: [
      { date: '2026-04-25', time: '09:00', clinic: 'RHEUMATOLOGY', clinicIen: '78', provider: 'FOSTER,ROBERT K', status: 'scheduled' },
    ],
    recentVisits: [
      { date: '2026-03-11', clinic: 'RESEARCH CLINIC', provider: 'PARK,JAMES W', type: 'Research Visit' },
    ],
    insurance: [],
  },
  // 13 — Male, PRRTP
  {
    dfn: '100013', name: 'MOORE,WILLIAM J', dob: '1957-03-28', sex: 'M',
    ssn: '666888812', preferredName: 'Bill',
    streetAddress1: '14500 NE Sandy Blvd', streetAddress2: '', streetAddress3: '',
    city: 'Portland', state: 'OR', zip: '97230', county: 'Multnomah', country: 'USA',
    phone: '5035550113', email: '',
    race: 'American Indian or Alaska Native', ethnicity: 'Not Hispanic or Latino',
    maritalStatus: 'Divorced', religion: '',
    genderIdentity: 'Male',
    veteranStatus: true, serviceConnected: true, scPercent: 80,
    emergencyContact: { name: 'MOORE,SARAH K', relationship: 'Ex-Spouse', phone: '5035551302' },
    nextOfKin: { name: 'MOORE,DANIEL J', relationship: 'Son', phone: '5035551303' },
    registrationSite: { ien: '3', name: 'VEHU-PRRTP' },
    status: 'active', admitted: false, wardIen: null, roomBed: null,
    dateOfDeath: null, isRestricted: false, isSensitive: false,
    allergies: ['SULFA DRUGS'],
    flags: [],
    codeStatus: '',
    problems: [
      { name: 'Alcohol Use Disorder, severe', icd: 'F10.20', onset: '2015-09-01', status: 'active', scCondition: false },
      { name: 'Hepatitis C, chronic', icd: 'B18.2', onset: '2017-03-10', status: 'active', scCondition: false },
      { name: 'Hearing Loss, bilateral sensorineural', icd: 'H90.3', onset: '2010-11-15', status: 'active', scCondition: true },
    ],
    medications: [
      { name: 'NALTREXONE HCL 50MG TAB', sig: 'TAKE ONE TABLET BY MOUTH EVERY DAY', status: 'active', fillDate: '2026-03-20' },
      { name: 'LEDIPASVIR/SOFOSBUVIR 90/400MG TAB', sig: 'TAKE ONE TABLET BY MOUTH EVERY DAY', status: 'active', fillDate: '2026-03-01' },
    ],
    appointments: [
      { date: '2026-04-11', time: '10:00', clinic: 'SUBSTANCE ABUSE', clinicIen: '88', provider: 'MARTINEZ,DANIEL S', status: 'scheduled' },
    ],
    recentVisits: [
      { date: '2026-03-20', clinic: 'HEPATOLOGY', provider: 'PARK,JAMES W', type: 'Follow-up' },
    ],
    insurance: [],
  },
  // 14 — Female, no major issues
  {
    dfn: '100014', name: 'JACKSON,KAREN D', dob: '1975-12-05', sex: 'F',
    ssn: '666111145', preferredName: '',
    streetAddress1: '7820 N Lombard St', streetAddress2: '', streetAddress3: '',
    city: 'Portland', state: 'OR', zip: '97203', county: 'Multnomah', country: 'USA',
    phone: '5035550114', email: '',
    race: 'Black or African American', ethnicity: 'Not Hispanic or Latino',
    maritalStatus: 'Married', religion: 'AME',
    genderIdentity: 'Female',
    veteranStatus: true, serviceConnected: false, scPercent: 0,
    emergencyContact: { name: 'JACKSON,KEVIN L', relationship: 'Spouse', phone: '5035551403' },
    nextOfKin: { name: 'JACKSON,KEVIN L', relationship: 'Spouse', phone: '5035551403' },
    registrationSite: { ien: '1', name: 'VEHU DIVISION' },
    status: 'active', admitted: false, wardIen: null, roomBed: null,
    dateOfDeath: null, isRestricted: false, isSensitive: false,
    allergies: [],
    flags: [],
    codeStatus: '',
    problems: [
      { name: 'Seasonal Allergic Rhinitis', icd: 'J30.2', onset: '2023-04-01', status: 'active', scCondition: false },
    ],
    medications: [
      { name: 'CETIRIZINE HCL 10MG TAB', sig: 'TAKE ONE TABLET BY MOUTH EVERY DAY', status: 'active', fillDate: '2026-03-01' },
    ],
    appointments: [
      { date: '2026-05-01', time: '09:30', clinic: 'PRIMARY CARE', clinicIen: '64', provider: 'WILSON,SARAH J', status: 'scheduled' },
    ],
    recentVisits: [
      { date: '2025-12-15', clinic: 'PRIMARY CARE', provider: 'WILSON,SARAH J', type: 'Annual Physical' },
    ],
    insurance: [
      { id: 'INS-N001', companyIen: '25', planName: 'UNITED HEALTHCARE PPO', groupNumber: 'UHC-33019', policyNumber: 'UHP-8812443', subscriberName: 'JACKSON,KEVIN L', relationship: 'Spouse', effectiveDate: '2024-01-01', expirationDate: '2026-12-31', type: 'primary' },
    ],
  },
  // 15 — Male, behavioral flag (elopement risk)
  {
    dfn: '100015', name: 'WHITE,RICHARD L', dob: '1965-07-19', sex: 'M',
    ssn: '666333367', preferredName: 'Rich',
    streetAddress1: '520 NE Multnomah St', streetAddress2: 'Suite 200', streetAddress3: '',
    city: 'Portland', state: 'OR', zip: '97232', county: 'Multnomah', country: 'USA',
    phone: '5035550115', email: '',
    race: 'White', ethnicity: 'Not Hispanic or Latino',
    maritalStatus: 'Separated', religion: '',
    genderIdentity: 'Male',
    veteranStatus: true, serviceConnected: true, scPercent: 90,
    emergencyContact: { name: 'WHITE,DEBRA A', relationship: 'Sister', phone: '5035551504' },
    nextOfKin: { name: 'WHITE,DEBRA A', relationship: 'Sister', phone: '5035551504' },
    registrationSite: { ien: '2', name: 'VEHU CBOC' },
    status: 'active', admitted: false, wardIen: null, roomBed: null,
    dateOfDeath: null, isRestricted: false, isSensitive: false,
    allergies: ['IODINE CONTRAST DYE'],
    flags: [{ name: 'Elopement Risk', category: 'Behavioral' }],
    codeStatus: '',
    problems: [
      { name: 'Traumatic Brain Injury, unspecified', icd: 'S06.9X9S', onset: '2008-05-01', status: 'active', scCondition: true },
      { name: 'Seizure Disorder, unspecified', icd: 'G40.909', onset: '2008-06-15', status: 'active', scCondition: true },
      { name: 'Cognitive Communication Deficit', icd: 'R41.840', onset: '2008-05-01', status: 'active', scCondition: true },
    ],
    medications: [
      { name: 'LEVETIRACETAM 500MG TAB', sig: 'TAKE ONE TABLET BY MOUTH TWICE A DAY', status: 'active', fillDate: '2026-03-10' },
      { name: 'MEMANTINE HCL 10MG TAB', sig: 'TAKE ONE TABLET BY MOUTH TWICE A DAY', status: 'active', fillDate: '2026-03-10' },
    ],
    appointments: [
      { date: '2026-04-16', time: '13:30', clinic: 'NEUROLOGY', clinicIen: '75', provider: 'PATEL,ANIL K', status: 'scheduled' },
    ],
    recentVisits: [
      { date: '2026-02-20', clinic: 'POLYTRAUMA/TBI', provider: 'PATEL,ANIL K', type: 'Follow-up' },
    ],
    insurance: [],
  },
  // 16 — Young female, no flags
  {
    dfn: '100016', name: 'HARRIS,JENNIFER A', dob: '1988-01-23', sex: 'F',
    ssn: '666666690', preferredName: 'Jen',
    streetAddress1: '1505 NW 23rd Ave', streetAddress2: '', streetAddress3: '',
    city: 'Portland', state: 'OR', zip: '97210', county: 'Multnomah', country: 'USA',
    phone: '5035550116', email: '',
    race: 'Native Hawaiian or Other Pacific Islander', ethnicity: 'Not Hispanic or Latino',
    maritalStatus: 'Married', religion: '',
    genderIdentity: 'Female',
    veteranStatus: true, serviceConnected: false, scPercent: 0,
    emergencyContact: { name: 'HARRIS,BRANDON T', relationship: 'Spouse', phone: '5035551605' },
    nextOfKin: { name: 'HARRIS,BRANDON T', relationship: 'Spouse', phone: '5035551605' },
    registrationSite: { ien: '1', name: 'VEHU DIVISION' },
    status: 'active', admitted: false, wardIen: null, roomBed: null,
    dateOfDeath: null, isRestricted: false, isSensitive: false,
    allergies: [],
    flags: [],
    codeStatus: '',
    problems: [],
    medications: [],
    appointments: [
      { date: '2026-05-05', time: '10:00', clinic: 'WOMEN VETERAN', clinicIen: '82', provider: 'CHEN,AMY L', status: 'scheduled' },
    ],
    recentVisits: [],
    insurance: [],
  },
  // 17 — Deceased elderly male (second deceased patient is #7, this one was already listed as deceased in the original)
  {
    dfn: '100017', name: 'CLARK,GEORGE H', dob: '1944-09-30', sex: 'M',
    ssn: '666999923', preferredName: '',
    streetAddress1: '4400 SW Macadam Ave', streetAddress2: '', streetAddress3: '',
    city: 'Portland', state: 'OR', zip: '97239', county: 'Multnomah', country: 'USA',
    phone: '5035550117', email: '',
    race: 'White', ethnicity: 'Not Hispanic or Latino',
    maritalStatus: 'Married', religion: 'Episcopal',
    genderIdentity: 'Male',
    veteranStatus: true, serviceConnected: true, scPercent: 30,
    emergencyContact: { name: 'CLARK,BARBARA H', relationship: 'Spouse', phone: '5035551706' },
    nextOfKin: { name: 'CLARK,BARBARA H', relationship: 'Spouse', phone: '5035551706' },
    registrationSite: { ien: '1', name: 'VEHU DIVISION' },
    status: 'active', admitted: false, wardIen: null, roomBed: null,
    dateOfDeath: null, isRestricted: false, isSensitive: false,
    allergies: ['MORPHINE SULFATE', 'CODEINE'],
    flags: [],
    codeStatus: '',
    problems: [
      { name: 'Osteoarthritis, primary, knee', icd: 'M17.11', onset: '2018-02-10', status: 'active', scCondition: true },
      { name: 'Hearing Loss, bilateral', icd: 'H90.3', onset: '2015-08-01', status: 'active', scCondition: true },
    ],
    medications: [
      { name: 'ACETAMINOPHEN 500MG TAB', sig: 'TAKE TWO TABLETS BY MOUTH EVERY 6 HOURS AS NEEDED', status: 'active', fillDate: '2026-03-01' },
    ],
    appointments: [
      { date: '2026-04-28', time: '14:00', clinic: 'AUDIOLOGY', clinicIen: '79', provider: 'FOSTER,ROBERT K', status: 'scheduled' },
    ],
    recentVisits: [
      { date: '2026-01-20', clinic: 'ORTHOPEDICS', provider: 'KIM,HENRY S', type: 'Follow-up' },
    ],
    insurance: [
      { id: 'INS-Q001', companyIen: '5', planName: 'MEDICARE PART A', groupNumber: '', policyNumber: 'MCA-9923781', subscriberName: 'CLARK,GEORGE H', relationship: 'Self', effectiveDate: '2009-09-01', expirationDate: '', type: 'primary' },
      { id: 'INS-Q002', companyIen: '30', planName: 'MEDIGAP PLAN F', groupNumber: 'MG-10045', policyNumber: 'MGF-5567234', subscriberName: 'CLARK,GEORGE H', relationship: 'Self', effectiveDate: '2009-09-01', expirationDate: '', type: 'secondary' },
    ],
  },
  // 18 — Female, mid-age
  {
    dfn: '100018', name: 'LEWIS,NANCY C', dob: '1970-11-16', sex: 'F',
    ssn: '666222256', preferredName: '',
    streetAddress1: '2650 NW Thurman St', streetAddress2: '', streetAddress3: '',
    city: 'Portland', state: 'OR', zip: '97210', county: 'Multnomah', country: 'USA',
    phone: '5035550118', email: '',
    race: 'White', ethnicity: 'Not Hispanic or Latino',
    maritalStatus: 'Married', religion: '',
    genderIdentity: 'Female',
    veteranStatus: true, serviceConnected: true, scPercent: 40,
    emergencyContact: { name: 'LEWIS,PAUL D', relationship: 'Spouse', phone: '5035551807' },
    nextOfKin: { name: 'LEWIS,PAUL D', relationship: 'Spouse', phone: '5035551807' },
    registrationSite: { ien: '1', name: 'VEHU DIVISION' },
    status: 'active', admitted: false, wardIen: null, roomBed: null,
    dateOfDeath: null, isRestricted: false, isSensitive: false,
    allergies: [],
    flags: [],
    codeStatus: '',
    problems: [
      { name: 'Hypothyroidism, unspecified', icd: 'E03.9', onset: '2021-07-22', status: 'active', scCondition: false },
      { name: 'Fibromyalgia', icd: 'M79.7', onset: '2019-10-05', status: 'active', scCondition: true },
    ],
    medications: [
      { name: 'LEVOTHYROXINE SODIUM 75MCG TAB', sig: 'TAKE ONE TABLET BY MOUTH EVERY MORNING ON EMPTY STOMACH', status: 'active', fillDate: '2026-03-15' },
      { name: 'DULOXETINE HCL 60MG CAP DR', sig: 'TAKE ONE CAPSULE BY MOUTH EVERY DAY', status: 'active', fillDate: '2026-03-15' },
    ],
    appointments: [
      { date: '2026-04-30', time: '11:30', clinic: 'ENDOCRINOLOGY', clinicIen: '76', provider: 'PATEL,ANIL K', status: 'scheduled' },
    ],
    recentVisits: [
      { date: '2026-02-28', clinic: 'LABORATORY', provider: '', type: 'Lab Draw' },
    ],
    insurance: [
      { id: 'INS-R001', companyIen: '18', planName: 'CIGNA PPO', groupNumber: 'CIG-20187', policyNumber: 'CPP-7712389', subscriberName: 'LEWIS,PAUL D', relationship: 'Spouse', effectiveDate: '2024-01-01', expirationDate: '2026-12-31', type: 'primary' },
    ],
  },
  // 19 — Inpatient ICU, DNR
  {
    dfn: '100019', name: 'WALKER,STEVEN P', dob: '1953-04-08', sex: 'M',
    ssn: '666555589', preferredName: 'Steve',
    streetAddress1: '11230 SE Stark St', streetAddress2: '', streetAddress3: '',
    city: 'Portland', state: 'OR', zip: '97216', county: 'Multnomah', country: 'USA',
    phone: '5035550119', email: '',
    race: 'White', ethnicity: 'Not Hispanic or Latino',
    maritalStatus: 'Married', religion: 'LDS',
    genderIdentity: 'Male',
    veteranStatus: true, serviceConnected: true, scPercent: 50,
    emergencyContact: { name: 'WALKER,DIANE M', relationship: 'Spouse', phone: '5035551908' },
    nextOfKin: { name: 'WALKER,DIANE M', relationship: 'Spouse', phone: '5035551908' },
    registrationSite: { ien: '3', name: 'VEHU-PRRTP' },
    status: 'active', admitted: true, wardIen: '3', roomBed: 'ICU-03',
    dateOfDeath: null, isRestricted: false, isSensitive: false,
    allergies: ['ASPIRIN'],
    flags: [],
    codeStatus: 'DNR',
    problems: [
      { name: 'Acute myocardial infarction, STEMI', icd: 'I21.09', onset: '2026-03-28', status: 'active', scCondition: false },
      { name: 'Coronary Artery Disease, native vessel', icd: 'I25.10', onset: '2020-01-15', status: 'active', scCondition: true },
      { name: 'Peripheral Artery Disease', icd: 'I73.9', onset: '2021-06-01', status: 'active', scCondition: true },
    ],
    medications: [
      { name: 'HEPARIN SODIUM 25000U/250ML INJ', sig: 'CONTINUOUS IV INFUSION PER PROTOCOL', status: 'active', fillDate: '2026-03-28' },
      { name: 'CLOPIDOGREL BISULFATE 75MG TAB', sig: 'TAKE ONE TABLET BY MOUTH EVERY DAY', status: 'active', fillDate: '2026-03-28' },
      { name: 'METOPROLOL TARTRATE 25MG TAB', sig: 'TAKE ONE TABLET BY MOUTH TWICE A DAY', status: 'active', fillDate: '2026-03-28' },
    ],
    appointments: [],
    recentVisits: [
      { date: '2026-03-28', clinic: 'CARDIAC CATH LAB', provider: 'PATEL,ANIL K', type: 'Emergency Admission' },
    ],
    insurance: [
      { id: 'INS-S001', companyIen: '5', planName: 'MEDICARE PART A', groupNumber: '', policyNumber: 'MCA-5589012', subscriberName: 'WALKER,STEVEN P', relationship: 'Self', effectiveDate: '2018-04-01', expirationDate: '', type: 'primary' },
    ],
  },
  // 20 — Inpatient, clinical isolation flag
  {
    dfn: '100020', name: 'ROBINSON,BETTY J', dob: '1980-08-14', sex: 'F',
    ssn: '666888823', preferredName: '',
    streetAddress1: '3820 SE Belmont St', streetAddress2: '', streetAddress3: '',
    city: 'Portland', state: 'OR', zip: '97214', county: 'Multnomah', country: 'USA',
    phone: '5035550120', email: '',
    race: 'White', ethnicity: 'Not Hispanic or Latino',
    maritalStatus: 'Married', religion: '',
    genderIdentity: 'Female',
    veteranStatus: true, serviceConnected: false, scPercent: 0,
    emergencyContact: { name: 'ROBINSON,MARK T', relationship: 'Spouse', phone: '5035552009' },
    nextOfKin: { name: 'ROBINSON,MARK T', relationship: 'Spouse', phone: '5035552009' },
    registrationSite: { ien: '1', name: 'VEHU DIVISION' },
    status: 'active', admitted: true, wardIen: '2', roomBed: '403-A',
    dateOfDeath: null, isRestricted: false, isSensitive: false,
    allergies: [],
    flags: [{ name: 'Contact Isolation - MRSA', category: 'Clinical' }],
    codeStatus: '',
    problems: [
      { name: 'Cellulitis of right lower limb', icd: 'L03.116', onset: '2026-03-26', status: 'active', scCondition: false },
      { name: 'MRSA colonization', icd: 'Z22.322', onset: '2026-03-26', status: 'active', scCondition: false },
    ],
    medications: [
      { name: 'VANCOMYCIN HCL 1GM IV', sig: 'INFUSE OVER 60 MINUTES EVERY 12 HOURS', status: 'active', fillDate: '2026-03-26' },
      { name: 'HEPARIN SODIUM 5000U/ML INJ', sig: '5000 UNITS SUBCUTANEOUS EVERY 8 HOURS', status: 'active', fillDate: '2026-03-26' },
    ],
    appointments: [],
    recentVisits: [
      { date: '2026-03-26', clinic: 'INFECTIOUS DISEASE', provider: 'PARK,JAMES W', type: 'Admission' },
    ],
    insurance: [
      { id: 'INS-T001', companyIen: '20', planName: 'BLUE CROSS BLUE SHIELD PPO', groupNumber: 'GRP-55098', policyNumber: 'BCB-1123567', subscriberName: 'ROBINSON,MARK T', relationship: 'Spouse', effectiveDate: '2023-01-01', expirationDate: '2026-12-31', type: 'primary' },
    ],
  },
  // 21 — Male CBOC
  {
    dfn: '100021', name: 'YOUNG,KENNETH R', dob: '1960-06-25', sex: 'M',
    ssn: '666111156', preferredName: 'Ken',
    streetAddress1: '8920 SW Barbur Blvd', streetAddress2: '', streetAddress3: '',
    city: 'Portland', state: 'OR', zip: '97219', county: 'Multnomah', country: 'USA',
    phone: '5035550121', email: '',
    race: 'White', ethnicity: 'Not Hispanic or Latino',
    maritalStatus: 'Married', religion: 'Lutheran',
    genderIdentity: 'Male',
    veteranStatus: true, serviceConnected: true, scPercent: 20,
    emergencyContact: { name: 'YOUNG,CAROL S', relationship: 'Spouse', phone: '5035552110' },
    nextOfKin: { name: 'YOUNG,CAROL S', relationship: 'Spouse', phone: '5035552110' },
    registrationSite: { ien: '2', name: 'VEHU CBOC' },
    status: 'active', admitted: false, wardIen: null, roomBed: null,
    dateOfDeath: null, isRestricted: false, isSensitive: false,
    allergies: ['PENICILLIN'],
    flags: [],
    codeStatus: '',
    problems: [
      { name: 'Gout, unspecified', icd: 'M10.9', onset: '2022-11-01', status: 'active', scCondition: false },
      { name: 'Tinnitus, bilateral', icd: 'H93.19', onset: '2018-03-15', status: 'active', scCondition: true },
    ],
    medications: [
      { name: 'ALLOPURINOL 100MG TAB', sig: 'TAKE ONE TABLET BY MOUTH EVERY DAY', status: 'active', fillDate: '2026-02-20' },
      { name: 'COLCHICINE 0.6MG TAB', sig: 'TAKE ONE TABLET BY MOUTH AS NEEDED FOR ACUTE GOUT', status: 'active', fillDate: '2026-02-20' },
    ],
    appointments: [
      { date: '2026-04-22', time: '15:00', clinic: 'PRIMARY CARE', clinicIen: '64', provider: 'WILSON,SARAH J', status: 'scheduled' },
    ],
    recentVisits: [
      { date: '2026-02-20', clinic: 'PRIMARY CARE', provider: 'WILSON,SARAH J', type: 'Follow-up' },
    ],
    insurance: [],
  },
  // 22 — Young female
  {
    dfn: '100022', name: 'HALL,MARGARET E', dob: '1993-02-03', sex: 'F',
    ssn: '666444490', preferredName: 'Maggie',
    streetAddress1: '1815 NW Couch St', streetAddress2: 'Apt 306', streetAddress3: '',
    city: 'Portland', state: 'OR', zip: '97209', county: 'Multnomah', country: 'USA',
    phone: '5035550122', email: '',
    race: 'White', ethnicity: 'Not Hispanic or Latino',
    maritalStatus: 'Single', religion: '',
    genderIdentity: 'Female',
    veteranStatus: true, serviceConnected: false, scPercent: 0,
    emergencyContact: { name: 'HALL,ROBERT E', relationship: 'Father', phone: '5035552211' },
    nextOfKin: { name: 'HALL,ROBERT E', relationship: 'Father', phone: '5035552211' },
    registrationSite: { ien: '1', name: 'VEHU DIVISION' },
    status: 'active', admitted: false, wardIen: null, roomBed: null,
    dateOfDeath: null, isRestricted: false, isSensitive: false,
    allergies: [],
    flags: [],
    codeStatus: '',
    problems: [],
    medications: [],
    appointments: [
      { date: '2026-05-10', time: '08:00', clinic: 'PRIMARY CARE', clinicIen: '64', provider: 'WILSON,SARAH J', status: 'scheduled' },
    ],
    recentVisits: [],
    insurance: [],
  },
  // 23 — Elderly male, multiple insurance
  {
    dfn: '100023', name: 'ALLEN,DONALD F', dob: '1948-07-12', sex: 'M',
    ssn: '666777723', preferredName: 'Don',
    streetAddress1: '5500 SE 82nd Ave', streetAddress2: '', streetAddress3: '',
    city: 'Portland', state: 'OR', zip: '97266', county: 'Multnomah', country: 'USA',
    phone: '5035550123', email: '',
    race: 'White', ethnicity: 'Not Hispanic or Latino',
    maritalStatus: 'Married', religion: 'Jewish',
    genderIdentity: 'Male',
    veteranStatus: true, serviceConnected: true, scPercent: 10,
    emergencyContact: { name: 'ALLEN,RUTH M', relationship: 'Spouse', phone: '5035552312' },
    nextOfKin: { name: 'ALLEN,RUTH M', relationship: 'Spouse', phone: '5035552312' },
    registrationSite: { ien: '1', name: 'VEHU DIVISION' },
    status: 'active', admitted: false, wardIen: null, roomBed: null,
    dateOfDeath: null, isRestricted: false, isSensitive: false,
    allergies: ['LATEX'],
    flags: [],
    codeStatus: '',
    problems: [
      { name: 'Chronic Low Back Pain', icd: 'M54.5', onset: '2010-06-01', status: 'active', scCondition: true },
      { name: 'Degenerative Disc Disease, lumbar', icd: 'M51.36', onset: '2010-06-01', status: 'active', scCondition: true },
      { name: 'Gastroesophageal Reflux Disease', icd: 'K21.0', onset: '2019-09-15', status: 'active', scCondition: false },
    ],
    medications: [
      { name: 'OMEPRAZOLE 20MG CAP DR', sig: 'TAKE ONE CAPSULE BY MOUTH EVERY MORNING BEFORE BREAKFAST', status: 'active', fillDate: '2026-03-10' },
      { name: 'CYCLOBENZAPRINE HCL 10MG TAB', sig: 'TAKE ONE TABLET BY MOUTH AT BEDTIME', status: 'active', fillDate: '2026-03-10' },
    ],
    appointments: [
      { date: '2026-04-24', time: '10:30', clinic: 'PAIN MANAGEMENT', clinicIen: '84', provider: 'KIM,HENRY S', status: 'scheduled' },
    ],
    recentVisits: [
      { date: '2026-03-05', clinic: 'PAIN MANAGEMENT', provider: 'KIM,HENRY S', type: 'Follow-up' },
    ],
    insurance: [
      { id: 'INS-W001', companyIen: '5', planName: 'MEDICARE PART A', groupNumber: '', policyNumber: 'MCA-7723901', subscriberName: 'ALLEN,DONALD F', relationship: 'Self', effectiveDate: '2013-07-01', expirationDate: '', type: 'primary' },
      { id: 'INS-W002', companyIen: '30', planName: 'MEDIGAP PLAN G', groupNumber: 'MG-20067', policyNumber: 'MGG-3398712', subscriberName: 'ALLEN,DONALD F', relationship: 'Self', effectiveDate: '2013-07-01', expirationDate: '', type: 'secondary' },
    ],
  },
  // 24 — Female, PRRTP
  {
    dfn: '100024', name: 'WRIGHT,DOROTHY M', dob: '1972-05-29', sex: 'F',
    ssn: '666000056', preferredName: 'Dot',
    streetAddress1: '12345 SE Powell Blvd', streetAddress2: '', streetAddress3: '',
    city: 'Portland', state: 'OR', zip: '97236', county: 'Multnomah', country: 'USA',
    phone: '5035550124', email: '',
    race: 'White', ethnicity: 'Not Hispanic or Latino',
    maritalStatus: 'Divorced', religion: '',
    genderIdentity: 'Female',
    veteranStatus: true, serviceConnected: true, scPercent: 70,
    emergencyContact: { name: 'WRIGHT,THOMAS J', relationship: 'Brother', phone: '5035552413' },
    nextOfKin: { name: 'WRIGHT,THOMAS J', relationship: 'Brother', phone: '5035552413' },
    registrationSite: { ien: '3', name: 'VEHU-PRRTP' },
    status: 'active', admitted: false, wardIen: null, roomBed: null,
    dateOfDeath: null, isRestricted: false, isSensitive: false,
    allergies: [],
    flags: [],
    codeStatus: '',
    problems: [
      { name: 'Post-traumatic Stress Disorder', icd: 'F43.10', onset: '2012-08-01', status: 'active', scCondition: true },
      { name: 'Opioid Use Disorder, in remission', icd: 'F11.21', onset: '2018-04-10', status: 'active', scCondition: false },
    ],
    medications: [
      { name: 'BUPRENORPHINE/NALOXONE 8/2MG SL TAB', sig: 'DISSOLVE ONE TABLET UNDER TONGUE EVERY DAY', status: 'active', fillDate: '2026-03-20' },
      { name: 'TRAZODONE HCL 50MG TAB', sig: 'TAKE ONE TABLET BY MOUTH AT BEDTIME', status: 'active', fillDate: '2026-03-20' },
    ],
    appointments: [
      { date: '2026-04-09', time: '09:00', clinic: 'PRRTP FOLLOW-UP', clinicIen: '91', provider: 'MARTINEZ,DANIEL S', status: 'scheduled' },
    ],
    recentVisits: [
      { date: '2026-03-20', clinic: 'SUBSTANCE ABUSE', provider: 'MARTINEZ,DANIEL S', type: 'Follow-up' },
    ],
    insurance: [],
  },
  // 25 — Male, multiple allergies, clinical flag
  {
    dfn: '100025', name: 'KING,EDWARD S', dob: '1986-10-17', sex: 'M',
    ssn: '666333389', preferredName: 'Ed',
    streetAddress1: '720 SW Washington St', streetAddress2: 'Floor 3', streetAddress3: '',
    city: 'Portland', state: 'OR', zip: '97205', county: 'Multnomah', country: 'USA',
    phone: '5035550125', email: '',
    race: 'White', ethnicity: 'Not Hispanic or Latino',
    maritalStatus: 'Married', religion: '',
    genderIdentity: 'Male',
    veteranStatus: true, serviceConnected: true, scPercent: 60,
    emergencyContact: { name: 'KING,JESSICA L', relationship: 'Spouse', phone: '5035552514' },
    nextOfKin: { name: 'KING,JESSICA L', relationship: 'Spouse', phone: '5035552514' },
    registrationSite: { ien: '1', name: 'VEHU DIVISION' },
    status: 'active', admitted: false, wardIen: null, roomBed: null,
    dateOfDeath: null, isRestricted: false, isSensitive: false,
    allergies: ['PENICILLIN', 'SULFA DRUGS', 'CODEINE', 'TRAMADOL'],
    flags: [{ name: 'Fall Risk', category: 'Clinical' }],
    codeStatus: '',
    problems: [
      { name: 'Multiple Sclerosis, relapsing-remitting', icd: 'G35', onset: '2019-02-15', status: 'active', scCondition: true },
      { name: 'Neurogenic Bladder', icd: 'N31.9', onset: '2020-08-01', status: 'active', scCondition: true },
      { name: 'Depression, moderate', icd: 'F32.1', onset: '2019-06-01', status: 'active', scCondition: true },
    ],
    medications: [
      { name: 'DIMETHYL FUMARATE 240MG CAP DR', sig: 'TAKE ONE CAPSULE BY MOUTH TWICE A DAY', status: 'active', fillDate: '2026-03-05' },
      { name: 'OXYBUTYNIN CL 5MG TAB', sig: 'TAKE ONE TABLET BY MOUTH TWICE A DAY', status: 'active', fillDate: '2026-03-05' },
      { name: 'SERTRALINE HCL 50MG TAB', sig: 'TAKE ONE TABLET BY MOUTH EVERY DAY', status: 'active', fillDate: '2026-03-05' },
    ],
    appointments: [
      { date: '2026-04-14', time: '08:30', clinic: 'NEUROLOGY', clinicIen: '75', provider: 'PATEL,ANIL K', status: 'scheduled' },
      { date: '2026-04-21', time: '14:00', clinic: 'UROLOGY', clinicIen: '77', provider: 'JACKSON,MARK D', status: 'scheduled' },
    ],
    recentVisits: [
      { date: '2026-03-05', clinic: 'NEUROLOGY', provider: 'PATEL,ANIL K', type: 'Follow-up' },
      { date: '2026-02-15', clinic: 'MRI SUITE', provider: '', type: 'Imaging' },
    ],
    insurance: [
      { id: 'INS-Y001', companyIen: '12', planName: 'TRICARE Select', groupNumber: 'DOD-8812', policyNumber: 'TCS-4490123', subscriberName: 'KING,EDWARD S', relationship: 'Self', effectiveDate: '2023-01-01', expirationDate: '2027-12-31', type: 'primary' },
    ],
  },
  // 26 — Transgender veteran, gender identity
  {
    dfn: '100026', name: 'MITCHELL,ALEX J', dob: '1991-03-14', sex: 'M',
    ssn: '666222278', preferredName: 'Alex',
    streetAddress1: '2244 NE Glisan St', streetAddress2: '', streetAddress3: '',
    city: 'Portland', state: 'OR', zip: '97232', county: 'Multnomah', country: 'USA',
    phone: '5035550126', email: '',
    race: 'White', ethnicity: 'Not Hispanic or Latino',
    maritalStatus: 'Single', religion: '',
    genderIdentity: 'Transgender Man',
    veteranStatus: true, serviceConnected: false, scPercent: 0,
    emergencyContact: { name: 'MITCHELL,SUSAN A', relationship: 'Mother', phone: '5035552615' },
    nextOfKin: { name: 'MITCHELL,SUSAN A', relationship: 'Mother', phone: '5035552615' },
    registrationSite: { ien: '1', name: 'VEHU DIVISION' },
    status: 'active', admitted: false, wardIen: null, roomBed: null,
    dateOfDeath: null, isRestricted: false, isSensitive: false,
    allergies: [],
    flags: [],
    codeStatus: '',
    problems: [
      { name: 'Gender Dysphoria in adolescents and adults', icd: 'F64.0', onset: '2020-01-15', status: 'active', scCondition: false },
    ],
    medications: [
      { name: 'TESTOSTERONE CYPIONATE 200MG/ML INJ', sig: 'INJECT 0.5ML INTRAMUSCULARLY EVERY 2 WEEKS', status: 'active', fillDate: '2026-03-15' },
    ],
    appointments: [
      { date: '2026-04-17', time: '11:00', clinic: 'LGBTQ+ HEALTH', clinicIen: '95', provider: 'CHEN,AMY L', status: 'scheduled' },
    ],
    recentVisits: [
      { date: '2026-03-15', clinic: 'ENDOCRINOLOGY', provider: 'PATEL,ANIL K', type: 'Follow-up' },
    ],
    insurance: [
      { id: 'INS-Z001', companyIen: '22', planName: 'KAISER PERMANENTE HMO', groupNumber: 'KP-71099', policyNumber: 'KPH-2278334', subscriberName: 'MITCHELL,ALEX J', relationship: 'Self', effectiveDate: '2025-01-01', expirationDate: '2026-12-31', type: 'primary' },
    ],
  },
  // 27 — Pacific Islander, clinical flag
  {
    dfn: '100027', name: 'CAMPBELL,TANE K', dob: '1979-09-22', sex: 'M',
    ssn: '666888834', preferredName: '',
    streetAddress1: '9350 N Lombard St', streetAddress2: '', streetAddress3: '',
    city: 'Portland', state: 'OR', zip: '97203', county: 'Multnomah', country: 'USA',
    phone: '5035550127', email: '',
    race: 'Native Hawaiian or Other Pacific Islander', ethnicity: 'Not Hispanic or Latino',
    maritalStatus: 'Married', religion: '',
    genderIdentity: 'Male',
    veteranStatus: true, serviceConnected: true, scPercent: 30,
    emergencyContact: { name: 'CAMPBELL,LANI M', relationship: 'Spouse', phone: '5035552716' },
    nextOfKin: { name: 'CAMPBELL,LANI M', relationship: 'Spouse', phone: '5035552716' },
    registrationSite: { ien: '1', name: 'VEHU DIVISION' },
    status: 'active', admitted: false, wardIen: null, roomBed: null,
    dateOfDeath: null, isRestricted: false, isSensitive: false,
    allergies: ['ERYTHROMYCIN'],
    flags: [{ name: 'Wandering Risk', category: 'Clinical' }],
    codeStatus: '',
    problems: [
      { name: 'Type 2 Diabetes Mellitus with diabetic neuropathy', icd: 'E11.40', onset: '2016-03-01', status: 'active', scCondition: false },
      { name: 'Obstructive Sleep Apnea', icd: 'G47.33', onset: '2018-07-15', status: 'active', scCondition: false },
      { name: 'Mild Cognitive Impairment', icd: 'G31.84', onset: '2024-11-01', status: 'active', scCondition: true },
    ],
    medications: [
      { name: 'METFORMIN HCL 1000MG TAB', sig: 'TAKE ONE TABLET BY MOUTH TWICE A DAY WITH MEALS', status: 'active', fillDate: '2026-03-10' },
      { name: 'GLIPIZIDE 5MG TAB', sig: 'TAKE ONE TABLET BY MOUTH EVERY MORNING BEFORE BREAKFAST', status: 'active', fillDate: '2026-03-10' },
      { name: 'DONEPEZIL HCL 10MG TAB', sig: 'TAKE ONE TABLET BY MOUTH AT BEDTIME', status: 'active', fillDate: '2026-03-10' },
    ],
    appointments: [
      { date: '2026-04-19', time: '09:00', clinic: 'NEUROLOGY', clinicIen: '75', provider: 'PATEL,ANIL K', status: 'scheduled' },
    ],
    recentVisits: [
      { date: '2026-03-10', clinic: 'SLEEP LAB', provider: 'FOSTER,ROBERT K', type: 'Follow-up' },
    ],
    insurance: [],
  },
];

/* ── Expanded mock flags covering all 4 categories ── */
const MOCK_FLAGS_DB = {
  100001: [
    { id: 'FLG-001', name: 'Fall Risk', category: 'Clinical', assignedDate: '2026-01-15', assignedBy: 'WILSON,SARAH J', reviewDate: '2026-07-15', status: 'active', narrative: 'Patient has history of falls. Gait unsteady. Requires bed alarm and non-skid footwear.' },
  ],
  100002: [
    { id: 'FLG-002', name: 'Fall Risk', category: 'Clinical', assignedDate: '2026-02-01', assignedBy: 'WILSON,SARAH J', reviewDate: '2026-08-01', status: 'active', narrative: 'History of 2 falls in past 6 months. Evaluate during each visit.' },
  ],
  100004: [
    { id: 'FLG-003', name: 'Behavioral - Violence', category: 'Behavioral', assignedDate: '2025-08-10', assignedBy: 'NGUYEN,THOMAS V', reviewDate: '2026-08-10', status: 'active', narrative: 'Patient has documented history of aggressive behavior toward staff. Escort required.' },
    { id: 'FLG-004', name: 'High Risk for Suicide', category: 'Behavioral', assignedDate: '2026-03-20', assignedBy: 'NGUYEN,THOMAS V', reviewDate: '2026-06-20', status: 'active', narrative: 'Patient presented to ED with suicidal ideation. Safety plan in place. HRC review pending.' },
  ],
  100008: [
    { id: 'FLG-005', name: 'Suicide Precaution', category: 'Behavioral', assignedDate: '2026-02-15', assignedBy: 'NGUYEN,THOMAS V', reviewDate: '2026-08-15', status: 'active', narrative: 'Patient on enhanced monitoring. 15-minute safety checks ordered.' },
  ],
  100012: [
    { id: 'FLG-006', name: 'Research Protocol Enrollment', category: 'Research', assignedDate: '2026-01-05', assignedBy: 'PARK,JAMES W', reviewDate: '2027-01-05', status: 'active', narrative: 'Patient enrolled in RA clinical trial (Protocol #VE-RA-2026-001). Study-specific labs required.' },
    { id: 'FLG-007', name: 'Missing ID Verification', category: 'Administrative', assignedDate: '2026-03-01', assignedBy: 'REGISTRATION,CLERK A', reviewDate: '2026-04-15', status: 'active', narrative: 'Patient unable to present valid photo ID at last visit. Verification pending.' },
  ],
  100015: [
    { id: 'FLG-008', name: 'Elopement Risk', category: 'Behavioral', assignedDate: '2025-11-01', assignedBy: 'PATEL,ANIL K', reviewDate: '2026-05-01', status: 'active', narrative: 'Patient has TBI-related confusion and has left facility unattended twice. Wander guard in use.' },
  ],
  100020: [
    { id: 'FLG-009', name: 'Contact Isolation - MRSA', category: 'Clinical', assignedDate: '2026-03-26', assignedBy: 'PARK,JAMES W', reviewDate: '2026-04-26', status: 'active', narrative: 'MRSA positive wound culture. Contact precautions required. Gown and gloves for all encounters.' },
  ],
  100025: [
    { id: 'FLG-010', name: 'Fall Risk', category: 'Clinical', assignedDate: '2026-02-15', assignedBy: 'PATEL,ANIL K', reviewDate: '2026-08-15', status: 'active', narrative: 'MS-related gait instability. Uses cane. Fall risk reassessment each visit.' },
  ],
  100027: [
    { id: 'FLG-011', name: 'Wandering Risk', category: 'Clinical', assignedDate: '2025-12-01', assignedBy: 'PATEL,ANIL K', reviewDate: '2026-06-01', status: 'active', narrative: 'Cognitive impairment with episodes of disorientation. Wander guard and frequent orientation checks.' },
  ],
};

/* ── Mock insurance by patient (for patients without inline insurance) ── */
const MOCK_INSURANCE_BY_DFN = {};
MOCK_PATIENTS.forEach(p => {
  if (p.insurance && p.insurance.length > 0) {
    MOCK_INSURANCE_BY_DFN[p.dfn] = p.insurance;
  }
});

/* ── Mock financial assessment data ── */
const MOCK_ASSESSMENTS = {
  default: {
    currentAssessment: {
      date: '2026-01-15',
      category: 'Category A',
      copayExempt: true,
      annualIncome: 24500,
      deductibleExpenses: 8200,
      netWorth: 15000,
      dependents: 1,
      assessor: 'REGISTRATION,CLERK A',
    },
    history: [
      { date: '2026-01-15', category: 'Category A', result: 'Copay Exempt', assessor: 'REGISTRATION,CLERK A' },
      { date: '2025-01-10', category: 'Category C', result: 'Copay Required', assessor: 'REGISTRATION,CLERK B' },
      { date: '2024-01-12', category: 'Category B', result: 'Copay Required - Reduced', assessor: 'REGISTRATION,CLERK A' },
    ],
  },
};

/* ── Mock bed data matching multiple wards ── */
const MOCK_BEDS = [
  // Medical Unit 3A
  { id: 'B-001', ien: '1', unit: 'Medical Unit 3A', bed: '301-A', status: 'occupied', patient: 'SMITH,JOHN A', patientDfn: '100001' },
  { id: 'B-002', ien: '2', unit: 'Medical Unit 3A', bed: '301-B', status: 'available', patient: null, patientDfn: null },
  { id: 'B-003', ien: '3', unit: 'Medical Unit 3A', bed: '302-A', status: 'occupied', patient: 'JOHNSON,ROBERT W', patientDfn: '100003' },
  { id: 'B-004', ien: '4', unit: 'Medical Unit 3A', bed: '302-B', status: 'available', patient: null, patientDfn: null },
  { id: 'B-005', ien: '5', unit: 'Medical Unit 3A', bed: '303-A', status: 'reserved', patient: null, patientDfn: null },
  { id: 'B-006', ien: '6', unit: 'Medical Unit 3A', bed: '303-B', status: 'available', patient: null, patientDfn: null },
  // Surgical Unit 4B
  { id: 'B-007', ien: '7', unit: 'Surgical Unit 4B', bed: '401-A', status: 'occupied', patient: 'MARTINEZ,ROSA E', patientDfn: '100008' },
  { id: 'B-008', ien: '8', unit: 'Surgical Unit 4B', bed: '401-B', status: 'available', patient: null, patientDfn: null },
  { id: 'B-009', ien: '9', unit: 'Surgical Unit 4B', bed: '402-A', status: 'blocked', patient: null, patientDfn: null },
  { id: 'B-010', ien: '10', unit: 'Surgical Unit 4B', bed: '402-B', status: 'available', patient: null, patientDfn: null },
  { id: 'B-011', ien: '11', unit: 'Surgical Unit 4B', bed: '403-A', status: 'occupied', patient: 'ROBINSON,BETTY J', patientDfn: '100020' },
  { id: 'B-012', ien: '12', unit: 'Surgical Unit 4B', bed: '403-B', status: 'available', patient: null, patientDfn: null },
  // ICU
  { id: 'B-013', ien: '13', unit: 'ICU', bed: 'ICU-01', status: 'occupied', patient: 'THOMAS,CHARLES E', patientDfn: '100011' },
  { id: 'B-014', ien: '14', unit: 'ICU', bed: 'ICU-02', status: 'available', patient: null, patientDfn: null },
  { id: 'B-015', ien: '15', unit: 'ICU', bed: 'ICU-03', status: 'occupied', patient: 'WALKER,STEVEN P', patientDfn: '100019' },
  { id: 'B-016', ien: '16', unit: 'ICU', bed: 'ICU-04', status: 'available', patient: null, patientDfn: null },
  { id: 'B-017', ien: '17', unit: 'ICU', bed: 'ICU-05', status: 'reserved', patient: null, patientDfn: null },
  { id: 'B-018', ien: '18', unit: 'ICU', bed: 'ICU-06', status: 'available', patient: null, patientDfn: null },
  // Psychiatric Unit 5A
  { id: 'B-019', ien: '19', unit: 'Psychiatric Unit 5A', bed: '501-A', status: 'available', patient: null, patientDfn: null },
  { id: 'B-020', ien: '20', unit: 'Psychiatric Unit 5A', bed: '501-B', status: 'available', patient: null, patientDfn: null },
  { id: 'B-021', ien: '21', unit: 'Psychiatric Unit 5A', bed: '502-A', status: 'blocked', patient: null, patientDfn: null },
  { id: 'B-022', ien: '22', unit: 'Psychiatric Unit 5A', bed: '502-B', status: 'available', patient: null, patientDfn: null },
];

/* ═══════════════════════════════════════════════════════════════════════════
 *  ENRICHMENT — adds computed/derived fields to a mock patient record
 * ═══════════════════════════════════════════════════════════════════════════ */

function enrichPatient(p) {
  return {
    ...p,
    dobFormatted: formatDob(p.dob),
    age: calcAge(p.dob),
    ssnLast4: p.ssn ? p.ssn.slice(-4) : '',
    ssnMasked: p.ssn ? `***-**-${p.ssn.slice(-4)}` : '',
    fullAddress: [p.streetAddress1, p.streetAddress2, p.streetAddress3]
      .filter(Boolean)
      .join(', ') + `, ${p.city}, ${p.state} ${p.zip}`,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  REFERENCE DATA — REAL ENDPOINTS (backend has these; no mock fallback)
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
 *  PATIENT SEARCH / CRUD — Planned endpoints with mock fallback
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Search patients by name, DFN, or last-4 SSN.
 */
export async function searchPatients(query = '') {
  return withMockFallback(
    () => tenantApi.get('/patients', { search: query, tenantId: 'local-dev' }),
    () => {
      const q = (query || '').toLowerCase().trim();
      const filtered = MOCK_PATIENTS.filter(p => {
        if (!q) return true;
        const ssnLast4 = p.ssn ? p.ssn.slice(-4) : '';
        return (
          p.name.toLowerCase().includes(q) ||
          p.dfn.includes(q) ||
          ssnLast4.includes(q) ||
          p.ssn.includes(q)
        );
      });
      return {
        ok: true,
        source: 'mock',
        data: filtered.map(enrichPatient),
        total: filtered.length,
      };
    },
  );
}

/**
 * Get a single patient by DFN.
 */
export async function getPatient(dfn) {
  return withMockFallback(
    () => tenantApi.get(`/patients/${dfn}`, { tenantId: 'local-dev' }),
    () => {
      const p = MOCK_PATIENTS.find(m => m.dfn === String(dfn));
      if (!p) return { ok: false, source: 'mock', error: 'Patient not found', code: 'NOT_FOUND' };
      return { ok: true, source: 'mock', data: enrichPatient(p) };
    },
  );
}

/**
 * Register (create) a new patient.
 */
export async function registerPatient(data) {
  return withMockFallback(
    () => tenantApi.post('/patients', { ...data, tenantId: 'local-dev' }),
    () => {
      const newDfn = String(200000 + Math.floor(Math.random() * 99999));
      return {
        ok: true,
        source: 'mock',
        data: {
          dfn: newDfn,
          ...data,
          registrationDate: isoToday(),
          registeredBy: 'REGISTRATION,CLERK A',
        },
      };
    },
  );
}

/**
 * Update patient demographics.
 */
export async function updatePatient(dfn, data) {
  return withMockFallback(
    () => tenantApi.put(`/patients/${dfn}`, { ...data, tenantId: 'local-dev' }),
    () => ({
      ok: true,
      source: 'mock',
      data: { dfn, ...data, updatedAt: isoNow(), updatedBy: 'REGISTRATION,CLERK A' },
    }),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  ADT — Admission, Transfer, Discharge (PATIENT MOVEMENT #405)
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Admit patient to inpatient bed.
 */
export async function admitPatient(dfn, data) {
  return withMockFallback(
    () => tenantApi.post(`/patients/${dfn}/admit`, { ...data, tenantId: 'local-dev' }),
    () => ({
      ok: true,
      source: 'mock',
      data: {
        movementId: mockId('ADM'),
        dfn,
        ...data,
        movementType: 'ADMISSION',
        status: 'admitted',
        admissionDate: isoNow(),
        enteredBy: 'REGISTRATION,CLERK A',
      },
    }),
  );
}

/**
 * Transfer patient between wards/beds.
 */
export async function transferPatient(dfn, data) {
  return withMockFallback(
    () => tenantApi.post(`/patients/${dfn}/transfer`, { ...data, tenantId: 'local-dev' }),
    () => ({
      ok: true,
      source: 'mock',
      data: {
        movementId: mockId('TRF'),
        dfn,
        ...data,
        movementType: 'TRANSFER',
        status: 'transferred',
        transferDate: isoNow(),
        enteredBy: 'REGISTRATION,CLERK A',
      },
    }),
  );
}

/**
 * Discharge patient from inpatient bed.
 */
export async function dischargePatient(dfn, data) {
  return withMockFallback(
    () => tenantApi.post(`/patients/${dfn}/discharge`, { ...data, tenantId: 'local-dev' }),
    () => ({
      ok: true,
      source: 'mock',
      data: {
        movementId: mockId('DIS'),
        dfn,
        ...data,
        movementType: 'DISCHARGE',
        status: 'discharged',
        dischargeDate: isoNow(),
        enteredBy: 'REGISTRATION,CLERK A',
      },
    }),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  PATIENT INSURANCE — per-patient policies
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Get all insurance policies for a patient.
 */
export async function getPatientInsurance(dfn) {
  return withMockFallback(
    () => tenantApi.get(`/patients/${dfn}/insurance`, { tenantId: 'local-dev' }),
    () => {
      const policies = MOCK_INSURANCE_BY_DFN[String(dfn)] || [];
      return { ok: true, source: 'mock', data: policies };
    },
  );
}

/**
 * Add insurance policy to a patient.
 */
export async function addInsurance(dfn, data) {
  return withMockFallback(
    () => tenantApi.post(`/patients/${dfn}/insurance`, { ...data, tenantId: 'local-dev' }),
    () => ({
      ok: true,
      source: 'mock',
      data: {
        id: mockId('INS'),
        dfn,
        ...data,
        createdAt: isoNow(),
        createdBy: 'REGISTRATION,CLERK A',
      },
    }),
  );
}

/**
 * Update an existing insurance policy.
 */
export async function updateInsurance(dfn, insuranceId, data) {
  return withMockFallback(
    () => tenantApi.put(`/patients/${dfn}/insurance/${insuranceId}`, { ...data, tenantId: 'local-dev' }),
    () => ({
      ok: true,
      source: 'mock',
      data: {
        id: insuranceId,
        dfn,
        ...data,
        updatedAt: isoNow(),
        updatedBy: 'REGISTRATION,CLERK A',
      },
    }),
  );
}

/**
 * Delete an insurance policy from a patient.
 */
export async function deleteInsurance(dfn, insuranceId) {
  return withMockFallback(
    () => tenantApi.delete(`/patients/${dfn}/insurance/${insuranceId}`),
    () => ({
      ok: true,
      source: 'mock',
      data: { id: insuranceId, dfn, deleted: true, deletedAt: isoNow() },
    }),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  FINANCIAL ASSESSMENT (Means Test) — ANNUAL MEANS TEST #408.31
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Get financial assessment / means test for a patient.
 */
export async function getFinancialAssessment(dfn) {
  return withMockFallback(
    () => tenantApi.get(`/patients/${dfn}/assessment`, { tenantId: 'local-dev' }),
    () => ({
      ok: true,
      source: 'mock',
      data: { ...MOCK_ASSESSMENTS.default, dfn: String(dfn) },
    }),
  );
}

/**
 * Submit a financial assessment / means test.
 */
export async function submitFinancialAssessment(dfn, data) {
  return withMockFallback(
    () => tenantApi.post(`/patients/${dfn}/assessment`, { ...data, tenantId: 'local-dev' }),
    () => {
      const income = data.annualIncome || 0;
      let category, copayExempt;
      if (income < 30000) {
        category = 'Category A';
        copayExempt = true;
      } else if (income < 60000) {
        category = 'Category B';
        copayExempt = false;
      } else {
        category = 'Category C';
        copayExempt = false;
      }
      return {
        ok: true,
        source: 'mock',
        data: {
          dfn: String(dfn),
          date: isoToday(),
          category,
          copayExempt,
          assessor: 'REGISTRATION,CLERK A',
          ...data,
        },
      };
    },
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  PATIENT FLAGS — PATIENT RECORD FLAG #26.13
 *  Four categories: Behavioral, Clinical, Administrative, Research
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Get all active flags for a patient.
 */
export async function getPatientFlags(dfn) {
  return withMockFallback(
    () => tenantApi.get(`/patients/${dfn}/flags`, { tenantId: 'local-dev' }),
    () => {
      const flags = MOCK_FLAGS_DB[String(dfn)] || [];
      return { ok: true, source: 'mock', data: flags };
    },
  );
}

/**
 * Add a flag to a patient record.
 */
export async function addPatientFlag(dfn, data) {
  return withMockFallback(
    () => tenantApi.post(`/patients/${dfn}/flags`, { ...data, tenantId: 'local-dev' }),
    () => ({
      ok: true,
      source: 'mock',
      data: {
        id: mockId('FLG'),
        dfn: String(dfn),
        ...data,
        status: 'active',
        assignedDate: isoToday(),
        assignedBy: data.assignedBy || 'CURRENT,USER',
      },
    }),
  );
}

/**
 * Inactivate (soft-delete) a patient flag.
 */
export async function inactivatePatientFlag(dfn, flagId) {
  return withMockFallback(
    () => tenantApi.put(`/patients/${dfn}/flags/${flagId}`, { status: 'inactive', tenantId: 'local-dev' }),
    () => ({
      ok: true,
      source: 'mock',
      data: {
        id: flagId,
        dfn: String(dfn),
        status: 'inactive',
        inactivatedDate: isoToday(),
        inactivatedBy: 'CURRENT,USER',
      },
    }),
  );
}

/**
 * Update a patient flag (e.g. extend review date).
 */
export async function updatePatientFlag(dfn, flagId, data) {
  return withMockFallback(
    () => tenantApi.put(`/patients/${dfn}/flags/${flagId}`, { ...data, tenantId: 'local-dev' }),
    () => ({
      ok: true,
      source: 'mock',
      data: {
        id: flagId,
        dfn: String(dfn),
        ...data,
        updatedAt: isoNow(),
      },
    }),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  RECORD RESTRICTIONS & BREAK-THE-GLASS
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Update record restriction / sensitivity level for a patient.
 */
export async function updateRecordRestriction(dfn, data) {
  return withMockFallback(
    () => tenantApi.put(`/patients/${dfn}/restrictions`, { ...data, tenantId: 'local-dev' }),
    () => ({
      ok: true,
      source: 'mock',
      data: {
        dfn: String(dfn),
        ...data,
        updatedAt: isoNow(),
        updatedBy: 'PRIVACY,OFFICER A',
      },
    }),
  );
}

/**
 * Log a break-the-glass access event for a restricted patient record.
 */
export async function logBreakTheGlass(dfn, data) {
  return withMockFallback(
    () => tenantApi.post(`/patients/${dfn}/break-glass`, { ...data, tenantId: 'local-dev' }),
    () => ({
      ok: true,
      source: 'mock',
      data: {
        dfn: String(dfn),
        ...data,
        auditId: mockId('BTG'),
        timestamp: isoNow(),
        logged: true,
        accessedBy: data.accessedBy || 'CURRENT,USER',
      },
    }),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  REPORTS
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Get registration report data.
 */
export async function getRegistrationReport(params = {}) {
  return withMockFallback(
    () => tenantApi.get('/reports/registration', { ...params, tenantId: 'local-dev' }),
    () => {
      const admitted = MOCK_PATIENTS.filter(p => p.admitted);
      const withInsurance = MOCK_PATIENTS.filter(p => p.insurance && p.insurance.length > 0);
      const active = MOCK_PATIENTS.filter(p => p.status === 'active');
      return {
        ok: true,
        source: 'mock',
        data: {
          summary: {
            totalRegistered: MOCK_PATIENTS.length,
            registeredToday: 3,
            pendingAssessments: 5,
            insuranceVerified: withInsurance.length,
            inpatientCensus: admitted.length,
            bedOccupancy: `${Math.round((admitted.length / MOCK_BEDS.length) * 100)}%`,
            activePatients: active.length,
          },
          recentRegistrations: MOCK_PATIENTS.slice(0, 10).map(p => ({
            ...enrichPatient(p),
            registeredDate: '2026-04-01',
          })),
        },
      };
    },
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  DASHBOARD STATS
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Get KPI stats for the patient registration dashboard.
 */
export async function getPatientDashboardStats() {
  return withMockFallback(
    () => tenantApi.get('/patients/dashboard', { tenantId: 'local-dev' }),
    () => {
      const admitted = MOCK_PATIENTS.filter(p => p.admitted);
      const withFlags = MOCK_PATIENTS.filter(p => p.flags && p.flags.length > 0);
      const withInsurance = MOCK_PATIENTS.filter(p => p.insurance && p.insurance.length > 0);
      const scVeterans = MOCK_PATIENTS.filter(p => p.serviceConnected);
      const totalBeds = MOCK_BEDS.length;
      const availableBeds = MOCK_BEDS.filter(b => b.status === 'available').length;
      const blockedBeds = MOCK_BEDS.filter(b => b.status === 'blocked').length;

      return {
        ok: true,
        source: 'mock',
        data: {
          totalPatients: MOCK_PATIENTS.length,
          activePatients: MOCK_PATIENTS.filter(p => p.status === 'active').length,
          registeredToday: 3,
          pendingRegistrations: 2,
          activeInpatients: admitted.length,
          patientsWithFlags: withFlags.length,
          patientsWithInsurance: withInsurance.length,
          serviceConnectedVeterans: scVeterans.length,
          bedSummary: {
            total: totalBeds,
            occupied: admitted.length,
            available: availableBeds,
            blocked: blockedBeds,
            reserved: MOCK_BEDS.filter(b => b.status === 'reserved').length,
            occupancyRate: `${Math.round((admitted.length / (totalBeds - blockedBeds)) * 100)}%`,
          },
          flagBreakdown: {
            behavioral: withFlags.filter(p => p.flags.some(f => f.category === 'Behavioral')).length,
            clinical: withFlags.filter(p => p.flags.some(f => f.category === 'Clinical')).length,
            administrative: withFlags.filter(p => p.flags.some(f => f.category === 'Administrative')).length,
            research: withFlags.filter(p => p.flags.some(f => f.category === 'Research')).length,
          },
        },
      };
    },
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  BED MANAGEMENT — transform VistA room-bed rows to UI shape
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Transform raw VistA room-bed rows into the UI's expected bed shape.
 * Exported so consuming components can also use it directly.
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
 * Get beds in UI shape.  Tries real /room-beds first, falls back to mock.
 * Unlike other reference-data endpoints, this wraps getRoomBeds with a
 * transform layer so bed management pages get a consistent shape.
 */
export async function getBeds() {
  try {
    const res = await tenantApi.get('/room-beds', { tenantId: 'local-dev' });
    if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
      return { ok: true, source: 'vista', data: transformRoomBeds(res.data) };
    }
    return { ok: true, source: 'mock', data: MOCK_BEDS };
  } catch (_err) {
    return { ok: true, source: 'mock', data: MOCK_BEDS };
  }
}

/**
 * Update a bed's status (e.g. unblock).
 * PUT /room-beds/:ien with { outOfService: '' } to unblock.
 */
export async function updateBed(bedIen, data) {
  return withMockFallback(
    () => tenantApi.put(`/room-beds/${bedIen}`, { ...data, tenantId: 'local-dev' }),
    () => ({
      ok: true,
      source: 'mock',
      data: { ien: bedIen, ...data, updatedAt: isoNow() },
    }),
  );
}

/**
 * Get audit events (break-the-glass access log) for a patient.
 */
export async function getPatientAuditEvents(dfn) {
  return withMockFallback(
    () => tenantApi.get(`/patients/${dfn}/audit-events`, { tenantId: 'local-dev' }),
    () => ({ ok: true, source: 'mock', data: [] }),
  );
}

/**
 * Get authorized staff for a restricted-record patient.
 */
export async function getAuthorizedStaff(dfn) {
  return withMockFallback(
    () => tenantApi.get(`/patients/${dfn}/authorized-staff`, { tenantId: 'local-dev' }),
    () => ({ ok: true, source: 'mock', data: [] }),
  );
}

/**
 * Add a staff member to the authorized access list for a restricted patient.
 */
export async function addAuthorizedStaff(dfn, data) {
  return withMockFallback(
    () => tenantApi.post(`/patients/${dfn}/authorized-staff`, { ...data, tenantId: 'local-dev' }),
    () => ({
      ok: true,
      source: 'mock',
      data: { dfn: String(dfn), ...data, addedAt: isoNow() },
    }),
  );
}

/**
 * Remove a staff member from the authorized access list.
 */
export async function removeAuthorizedStaff(dfn, staffIen) {
  return withMockFallback(
    () => tenantApi.delete(`/patients/${dfn}/authorized-staff/${staffIen}`, { tenantId: 'local-dev' }),
    () => ({
      ok: true,
      source: 'mock',
      data: { deleted: staffIen },
    }),
  );
}

/**
 * Verify insurance eligibility for a patient via VistA.
 */
export async function verifyInsuranceEligibility(dfn) {
  return withMockFallback(
    () => tenantApi.post(`/patients/${dfn}/verify-eligibility`, { tenantId: 'local-dev' }),
    () => ({ ok: true, source: 'mock', data: { dfn: String(dfn), status: 'unknown', verifiedAt: isoNow(), message: 'Eligibility verification unavailable — backend not connected.' } }),
  );
}
