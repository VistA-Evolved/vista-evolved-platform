import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../../components/shell/AppShell';
import { ConfirmDialog } from '../../components/shared/SharedComponents';
import { getPermissions, getCustomRoles, createCustomRole, deleteCustomRole, updateCustomRole, getStaff, getUserPermissions, assignPermission } from '../../services/adminService';

/**
 * AD-04: Role Templates (VistA Evolved Addition)
 *
 * Role templates are a VistA Evolved product concept — not stored in VistA.
 * The curated role definitions are client-side. We cross-reference with the
 * live key-inventory (689 keys) to validate which permissions actually exist.
 *
 * Live: GET /key-inventory → validates that referenced keys exist in VistA
 */

const ALL_WORKSPACES = [
  'Dashboard', 'Patients', 'Scheduling', 'Clinical', 'Pharmacy',
  'Lab', 'Imaging', 'Billing', 'Supply', 'Admin', 'Analytics',
];

// Role templates — every key below is a REAL VistA security key in #19.1.
// These templates are a Vista Evolved concept (not stored in VistA itself);
// they bundle assignable starter keys per role. The runtime render cross-
// references with the live /key-inventory and any missing key is hidden,
// not shown as a "pending install" badge.
export const ROLES = [
  {
    id: 'physician', name: 'Physician', isSystem: true,
    description: 'Licensed independent practitioner. Full order entry, prescribing, note signing, chart access.',
    userCount: 0,
    permissions: [
      { label: 'Provider (prescribing authority)', key: 'PROVIDER' },
      { label: 'Write clinical orders (signed)', key: 'ORES' },
      { label: 'CPRS GUI chart access', key: 'OR CPRS GUI CHART' },
      { label: 'Sign clinical notes', key: 'ORCL-SIGN-NOTES' },
      { label: 'View patient records', key: 'ORCL-PAT-RECS' },
      { label: 'Verify allergies', key: 'GMRA ALLERGY VERIFY' },
    ],
    mutualExclusions: ['A physician with order-signing authority cannot also hold verbal-order entry (that role is reserved for nursing staff).'],
    workspaceAccess: { Dashboard: 'rw', Patients: 'rw', Scheduling: 'rw', Clinical: 'rw', Pharmacy: 'ro', Lab: 'ro', Imaging: 'ro', Billing: 'none', Supply: 'none', Admin: 'none', Analytics: 'ro' },
  },
  {
    id: 'nurse-practitioner', name: 'Nurse Practitioner', isSystem: true,
    description: 'Mid-level provider with prescriptive authority. Independent order entry and cosignature capability.',
    userCount: 0,
    permissions: [
      { label: 'Provider (prescribing authority)', key: 'PROVIDER' },
      { label: 'Write clinical orders (signed)', key: 'ORES' },
      { label: 'CPRS GUI chart access', key: 'OR CPRS GUI CHART' },
      { label: 'Sign clinical notes', key: 'ORCL-SIGN-NOTES' },
      { label: 'View patient records', key: 'ORCL-PAT-RECS' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'rw', Patients: 'rw', Scheduling: 'rw', Clinical: 'rw', Pharmacy: 'ro', Lab: 'ro', Imaging: 'ro', Billing: 'none', Supply: 'none', Admin: 'none', Analytics: 'ro' },
  },
  {
    id: 'physician-assistant', name: 'Physician Assistant', isSystem: true,
    description: 'Mid-level provider who may require cosignature. Order entry and prescribing under physician supervision.',
    userCount: 0,
    permissions: [
      { label: 'Provider (prescribing authority)', key: 'PROVIDER' },
      { label: 'Write clinical orders (signed)', key: 'ORES' },
      { label: 'CPRS GUI chart access', key: 'OR CPRS GUI CHART' },
      { label: 'View patient records', key: 'ORCL-PAT-RECS' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'rw', Patients: 'rw', Scheduling: 'rw', Clinical: 'rw', Pharmacy: 'ro', Lab: 'ro', Imaging: 'ro', Billing: 'none', Supply: 'none', Admin: 'none', Analytics: 'ro' },
  },
  {
    id: 'surgeon', name: 'Surgeon', isSystem: true,
    description: 'Surgical specialty provider with full order entry, operative note signing, and surgical scheduling.',
    userCount: 0,
    permissions: [
      { label: 'Provider (prescribing authority)', key: 'PROVIDER' },
      { label: 'Write clinical orders (signed)', key: 'ORES' },
      { label: 'CPRS GUI chart access', key: 'OR CPRS GUI CHART' },
      { label: 'Sign clinical notes', key: 'ORCL-SIGN-NOTES' },
      { label: 'View patient records', key: 'ORCL-PAT-RECS' },
      { label: 'Verify allergies', key: 'GMRA ALLERGY VERIFY' },
      { label: 'Sensitive patient access', key: 'DG SENSITIVITY' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'rw', Patients: 'rw', Scheduling: 'rw', Clinical: 'rw', Pharmacy: 'ro', Lab: 'ro', Imaging: 'ro', Billing: 'none', Supply: 'none', Admin: 'none', Analytics: 'ro' },
  },
  {
    id: 'anesthesiologist', name: 'Anesthesiologist', isSystem: true,
    description: 'Anesthesia provider with order entry, medication management, and pre-op assessments.',
    userCount: 0,
    permissions: [
      { label: 'Provider (prescribing authority)', key: 'PROVIDER' },
      { label: 'Write clinical orders (signed)', key: 'ORES' },
      { label: 'CPRS GUI chart access', key: 'OR CPRS GUI CHART' },
      { label: 'Sign clinical notes', key: 'ORCL-SIGN-NOTES' },
      { label: 'View patient records', key: 'ORCL-PAT-RECS' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'rw', Patients: 'rw', Scheduling: 'ro', Clinical: 'rw', Pharmacy: 'ro', Lab: 'ro', Imaging: 'ro', Billing: 'none', Supply: 'none', Admin: 'none', Analytics: 'ro' },
  },
  {
    id: 'nurse', name: 'Registered Nurse', isSystem: true,
    description: 'Clinical documentation, medication administration, verbal order entry.',
    userCount: 0,
    permissions: [
      { label: 'Enter verbal / telephone orders', key: 'ORELSE' },
      { label: 'CPRS GUI chart access', key: 'OR CPRS GUI CHART' },
      { label: 'View patient records', key: 'ORCL-PAT-RECS' },
      { label: 'Sign clinical notes', key: 'ORCL-SIGN-NOTES' },
      { label: 'Bar-code medication administration', key: 'PSB NURSE' },
    ],
    mutualExclusions: ['A nurse with verbal-order authority cannot also hold physician order-signing authority.'],
    workspaceAccess: { Dashboard: 'rw', Patients: 'ro', Scheduling: 'ro', Clinical: 'rw', Pharmacy: 'none', Lab: 'none', Imaging: 'none', Billing: 'none', Supply: 'none', Admin: 'none', Analytics: 'none' },
  },
  {
    id: 'lpn', name: 'Licensed Practical Nurse', isSystem: true,
    description: 'Nursing care under RN/MD supervision. Documentation and bar-code medication administration.',
    userCount: 0,
    permissions: [
      { label: 'CPRS GUI chart access', key: 'OR CPRS GUI CHART' },
      { label: 'View patient records', key: 'ORCL-PAT-RECS' },
      { label: 'Sign clinical notes', key: 'ORCL-SIGN-NOTES' },
      { label: 'Bar-code medication administration', key: 'PSB NURSE' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'ro', Patients: 'ro', Scheduling: 'ro', Clinical: 'rw', Pharmacy: 'none', Lab: 'none', Imaging: 'none', Billing: 'none', Supply: 'none', Admin: 'none', Analytics: 'none' },
  },
  {
    id: 'social-worker', name: 'Social Worker', isSystem: true,
    description: 'Care coordination, psychosocial assessment, discharge planning documentation.',
    userCount: 0,
    permissions: [
      { label: 'CPRS GUI chart access', key: 'OR CPRS GUI CHART' },
      { label: 'View patient records', key: 'ORCL-PAT-RECS' },
      { label: 'Sign clinical notes', key: 'ORCL-SIGN-NOTES' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'ro', Patients: 'rw', Scheduling: 'ro', Clinical: 'rw', Pharmacy: 'none', Lab: 'none', Imaging: 'none', Billing: 'none', Supply: 'none', Admin: 'none', Analytics: 'none' },
  },
  {
    id: 'ward-clerk', name: 'Ward Clerk / Unit Clerk', isSystem: true,
    description: 'MAS order entry — transcribes orders to the chart without signing authority.',
    userCount: 0,
    permissions: [
      { label: 'MAS order entry (chart-only, no signing)', key: 'OREMAS' },
      { label: 'CPRS Chart Access', key: 'OR CPRS GUI CHART' },
      { label: 'View Patient Records', key: 'ORCL-PAT-RECS' },
      { label: 'Patient Registration', key: 'DG REGISTER' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'ro', Patients: 'rw', Scheduling: 'ro', Clinical: 'ro', Pharmacy: 'none', Lab: 'none', Imaging: 'none', Billing: 'none', Supply: 'none', Admin: 'none', Analytics: 'none' },
  },
  {
    id: 'pharmacist', name: 'Staff Pharmacist', isSystem: true,
    description: 'Outpatient and inpatient pharmacy operations, medication verification.',
    userCount: 0,
    permissions: [
      { label: 'Outpatient pharmacy refill processing', key: 'PSORPH' },
      { label: 'Inpatient pharmacy verification', key: 'PSJ PHARMACIST' },
      { label: 'CPRS Chart Access', key: 'OR CPRS GUI CHART' },
      { label: 'Pharmacist Verification', key: 'PSOPHARMACIST' },
      { label: 'Pharmacy Interface', key: 'PSOINTERFACE' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'ro', Patients: 'ro', Scheduling: 'none', Clinical: 'ro', Pharmacy: 'rw', Lab: 'none', Imaging: 'none', Billing: 'none', Supply: 'none', Admin: 'none', Analytics: 'none' },
  },
  {
    id: 'controlled-substance-pharmacist', name: 'Controlled Substance Pharmacist', isSystem: true,
    description: 'Handles Schedule II-V dispensing, audit trails, and controlled-substance inventory.',
    userCount: 0,
    permissions: [
      { label: 'Controlled substances pharmacist', key: 'PSD PHARMACIST' },
      { label: 'Outpatient pharmacy refill processing', key: 'PSORPH' },
      { label: 'CPRS Chart Access', key: 'OR CPRS GUI CHART' },
      { label: 'CS Dispensing', key: 'PSDRPH' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'ro', Patients: 'ro', Scheduling: 'none', Clinical: 'ro', Pharmacy: 'rw', Lab: 'none', Imaging: 'none', Billing: 'none', Supply: 'none', Admin: 'none', Analytics: 'none' },
  },
  {
    id: 'pharmacy-supervisor', name: 'Pharmacy Supervisor', isSystem: true,
    description: 'Oversees pharmacy operations, manages workflow, overrides dispensing locks, and configures pharmacy settings.',
    userCount: 0,
    permissions: [
      { label: 'Outpatient pharmacy refill processing', key: 'PSORPH' },
      { label: 'Inpatient pharmacy verification', key: 'PSJ PHARMACIST' },
      { label: 'Outpatient pharmacy manager', key: 'PSO MANAGER' },
      { label: 'Controlled substances pharmacist', key: 'PSD PHARMACIST' },
      { label: 'CPRS Chart Access', key: 'OR CPRS GUI CHART' },
      { label: 'Pharmacist Verification', key: 'PSOPHARMACIST' },
      { label: 'Pharmacy Interface', key: 'PSOINTERFACE' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'ro', Patients: 'ro', Scheduling: 'none', Clinical: 'ro', Pharmacy: 'rw', Lab: 'none', Imaging: 'none', Billing: 'none', Supply: 'none', Admin: 'ro', Analytics: 'ro' },
  },
  {
    id: 'lab-tech', name: 'Lab Technologist', isSystem: true,
    description: 'Specimen processing, result entry, and verification.',
    userCount: 0,
    permissions: [
      { label: 'Laboratory technician', key: 'LRLAB' },
      { label: 'Result verification', key: 'LRVERIFY' },
      { label: 'CPRS Chart Access', key: 'OR CPRS GUI CHART' },
      { label: 'Lab Collection & Accession', key: 'LRCAP' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'ro', Patients: 'none', Scheduling: 'none', Clinical: 'none', Pharmacy: 'none', Lab: 'rw', Imaging: 'none', Billing: 'none', Supply: 'none', Admin: 'none', Analytics: 'none' },
  },
  {
    id: 'lab-supervisor', name: 'Lab Supervisor', isSystem: true,
    description: 'Oversees lab operations, workflow, and quality assurance.',
    userCount: 0,
    permissions: [
      { label: 'Laboratory supervisor', key: 'LRSUPER' },
      { label: 'Result verification', key: 'LRVERIFY' },
      { label: 'Laboratory technician', key: 'LRLAB' },
      { label: 'CPRS Chart Access', key: 'OR CPRS GUI CHART' },
      { label: 'Lab Manager', key: 'LRMGR' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'ro', Patients: 'none', Scheduling: 'none', Clinical: 'none', Pharmacy: 'none', Lab: 'rw', Imaging: 'none', Billing: 'none', Supply: 'none', Admin: 'ro', Analytics: 'ro' },
  },
  {
    id: 'rad-tech', name: 'Radiology Technologist', isSystem: true,
    description: 'Performs imaging procedures and manages exam allocation.',
    userCount: 0,
    permissions: [
      { label: 'Radiology Technologist', key: 'RA TECHNOLOGIST' },
      { label: 'Imaging system access', key: 'MAG SYSTEM' },
      { label: 'CPRS Chart Access', key: 'OR CPRS GUI CHART' },
      { label: 'Image Capture', key: 'MAG CAPTURE' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'ro', Patients: 'none', Scheduling: 'none', Clinical: 'none', Pharmacy: 'none', Lab: 'none', Imaging: 'rw', Billing: 'none', Supply: 'none', Admin: 'none', Analytics: 'none' },
  },
  {
    id: 'scheduler', name: 'Scheduling Clerk', isSystem: true,
    description: 'Appointment booking, check-in, schedule management.',
    userCount: 0,
    permissions: [
      { label: 'Scheduling access', key: 'SD SCHEDULING' },
      { label: 'Clinical scheduling', key: 'SDCLINICAL' },
      { label: 'CPRS GUI chart access', key: 'OR CPRS GUI CHART' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'ro', Patients: 'ro', Scheduling: 'rw', Clinical: 'none', Pharmacy: 'none', Lab: 'none', Imaging: 'none', Billing: 'none', Supply: 'none', Admin: 'none', Analytics: 'none' },
  },
  {
    id: 'scheduling-supervisor', name: 'Scheduling Supervisor', isSystem: true,
    description: 'Override closures, manage no-shows, oversee clinic schedules.',
    userCount: 0,
    permissions: [
      { label: 'Scheduling supervisor', key: 'SD SUPERVISOR' },
      { label: 'Scheduling manager', key: 'SDMGR' },
      { label: 'CPRS Chart Access', key: 'OR CPRS GUI CHART' },
      { label: 'Scheduling', key: 'SD SCHEDULING' },
      { label: 'Clinical Scheduling', key: 'SDCLINICAL' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'ro', Patients: 'ro', Scheduling: 'rw', Clinical: 'none', Pharmacy: 'none', Lab: 'none', Imaging: 'none', Billing: 'none', Supply: 'none', Admin: 'ro', Analytics: 'ro' },
  },
  {
    id: 'front-desk', name: 'Registration Clerk', isSystem: true,
    description: 'Patient registration, demographics, means testing.',
    userCount: 0,
    // NOTE: DG REGISTRATION is included alongside DG REGISTER. If DG REGISTRATION
    // is not a real key in this VistA instance, the runtime cross-reference with
    // /key-inventory will automatically hide it. No manual removal needed.
    permissions: [
      { label: 'Patient registration clerk', key: 'DG REGISTER' },
      { label: 'Patient registration', key: 'DG REGISTRATION' },
      { label: 'Patient admission', key: 'DG ADMIT' },
      { label: 'Means test entry', key: 'DGMEANS TEST' },
      { label: 'CPRS GUI chart access', key: 'OR CPRS GUI CHART' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'ro', Patients: 'rw', Scheduling: 'ro', Clinical: 'none', Pharmacy: 'none', Lab: 'none', Imaging: 'none', Billing: 'none', Supply: 'none', Admin: 'none', Analytics: 'none' },
  },
  {
    id: 'adt-coordinator', name: 'ADT Coordinator', isSystem: true,
    description: 'Manages admissions, transfers, discharges, and ADT workflow.',
    userCount: 0,
    permissions: [
      { label: 'ADT coordinator', key: 'DG MENU' },
      { label: 'Patient registration clerk', key: 'DG REGISTER' },
      { label: 'CPRS Chart Access', key: 'OR CPRS GUI CHART' },
      { label: 'Patient Admission', key: 'DG ADMIT' },
      { label: 'Patient Discharge', key: 'DG DISCHARGE' },
      { label: 'Patient Transfer', key: 'DG TRANSFER' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'ro', Patients: 'rw', Scheduling: 'ro', Clinical: 'ro', Pharmacy: 'none', Lab: 'none', Imaging: 'none', Billing: 'ro', Supply: 'none', Admin: 'none', Analytics: 'ro' },
  },
  {
    id: 'adt-supervisor', name: 'ADT Supervisor', isSystem: true,
    description: 'Oversight of patient movement, restricted records, and discharge workflow.',
    userCount: 0,
    permissions: [
      { label: 'ADT supervisor', key: 'DG SUPERVISOR' },
      { label: 'ADT coordinator', key: 'DG MENU' },
      { label: 'Sensitive patient access', key: 'DG SENSITIVITY' },
      { label: 'CPRS Chart Access', key: 'OR CPRS GUI CHART' },
      { label: 'Patient Registration', key: 'DG REGISTER' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'rw', Patients: 'rw', Scheduling: 'ro', Clinical: 'ro', Pharmacy: 'none', Lab: 'none', Imaging: 'none', Billing: 'ro', Supply: 'none', Admin: 'ro', Analytics: 'rw' },
  },
  {
    id: 'system-admin', name: 'System Administrator', isSystem: true,
    description: 'Full administrative access: user management, configuration, security, audit.',
    userCount: 0,
    permissions: [
      { label: 'System administrator (full user management)', key: 'XUMGR' },
      { label: 'System programmer (advanced access)', key: 'XUPROG' },
      { label: 'Advanced diagnostic access', key: 'XUPROGMODE' },
      { label: 'CPRS Chart Access', key: 'OR CPRS GUI CHART' },
      { label: 'Security Auditing', key: 'XUAUDITING' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'rw', Patients: 'ro', Scheduling: 'ro', Clinical: 'ro', Pharmacy: 'ro', Lab: 'ro', Imaging: 'ro', Billing: 'ro', Supply: 'ro', Admin: 'rw', Analytics: 'rw' },
  },
  {
    id: 'chief-of-staff', name: 'Chief of Staff', isSystem: true,
    description: 'Clinical leadership with cross-workspace read access and provider authority.',
    userCount: 0,
    permissions: [
      { label: 'Provider (prescribing authority)', key: 'PROVIDER' },
      { label: 'Write clinical orders (signed)', key: 'ORES' },
      { label: 'CPRS GUI chart access', key: 'OR CPRS GUI CHART' },
      { label: 'Sign clinical notes', key: 'ORCL-SIGN-NOTES' },
      { label: 'View patient records', key: 'ORCL-PAT-RECS' },
      { label: 'Sensitive patient access', key: 'DG SENSITIVITY' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'rw', Patients: 'rw', Scheduling: 'ro', Clinical: 'rw', Pharmacy: 'ro', Lab: 'ro', Imaging: 'ro', Billing: 'ro', Supply: 'none', Admin: 'ro', Analytics: 'rw' },
  },
  {
    id: 'phlebotomist', name: 'Phlebotomist', isSystem: true,
    description: 'Blood draw and specimen collection. Access to lab orders and collection lists.',
    userCount: 0,
    permissions: [
      { label: 'Laboratory technician', key: 'LRLAB' },
      { label: 'CPRS GUI chart access', key: 'OR CPRS GUI CHART' },
      { label: 'View patient records', key: 'ORCL-PAT-RECS' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'ro', Patients: 'ro', Scheduling: 'none', Clinical: 'none', Pharmacy: 'none', Lab: 'rw', Imaging: 'none', Billing: 'none', Supply: 'none', Admin: 'none', Analytics: 'none' },
  },
  {
    id: 'imaging-tech', name: 'Imaging Technician', isSystem: true,
    description: 'Performs imaging exams and manages radiology work queue.',
    userCount: 0,
    permissions: [
      { label: 'Radiology resource allocator', key: 'RA ALLOC' },
      { label: 'Imaging system access', key: 'MAG SYSTEM' },
      { label: 'CPRS GUI chart access', key: 'OR CPRS GUI CHART' },
      { label: 'View patient records', key: 'ORCL-PAT-RECS' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'ro', Patients: 'ro', Scheduling: 'none', Clinical: 'none', Pharmacy: 'none', Lab: 'none', Imaging: 'rw', Billing: 'none', Supply: 'none', Admin: 'none', Analytics: 'none' },
  },
  {
    id: 'billing-clerk', name: 'Billing Clerk', isSystem: true,
    description: 'Insurance billing, claims processing, and revenue cycle support.',
    userCount: 0,
    permissions: [
      { label: 'Billing access', key: 'IBFIN' },
      { label: 'Means test entry', key: 'DGMEANS TEST' },
      { label: 'CPRS GUI chart access', key: 'OR CPRS GUI CHART' },
    ],
    mutualExclusions: [],
    workspaceAccess: { Dashboard: 'ro', Patients: 'ro', Scheduling: 'none', Clinical: 'none', Pharmacy: 'none', Lab: 'none', Imaging: 'none', Billing: 'rw', Supply: 'none', Admin: 'none', Analytics: 'ro' },
  },
];

const ACCESS_LABELS = { rw: 'Read & Write', ro: 'Read Only', none: 'No Access' };
const ACCESS_COLORS = { rw: 'bg-[#E6F4EA] text-[#1B7D3A]', ro: 'bg-[#E8EEF5] text-[#2E5984]', none: 'bg-[#F5F5F5] text-[#999]' };

const KEY_IMPACTS = {
  'PROVIDER': 'Identifies user as healthcare provider. Without this: cannot appear in provider lookups or be selected as attending.',
  'ORES': 'Allows signing clinical orders. Without this: orders pend indefinitely for someone else to sign.',
  'OR CPRS GUI CHART': 'Grants access to patient charts. WITHOUT THIS KEY, THE USER CANNOT OPEN ANY PATIENT CHART.',
  'ORCL-SIGN-NOTES': 'Allows signing clinical notes. Without this: notes remain unsigned and may not be legally valid.',
  'ORCL-PAT-RECS': 'Allows viewing patient records. Without this: patient data is hidden even in accessible workspaces.',
  'ORELSE': 'Allows releasing verbal/telephone orders entered by providers. Without this: verbal orders cannot be released.',
  'PSB NURSE': 'Medication administration (BCMA). Without this: cannot scan and administer medications at bedside.',
  'OREMAS': 'Enter orders on behalf of a provider. Without this: cannot enter orders even when directed by physician.',
  'PSORPH': 'Outpatient pharmacy dispensing. Without this: cannot process or dispense outpatient prescriptions.',
  'PSJ PHARMACIST': 'Inpatient pharmacy verification. Without this: cannot verify inpatient medication orders.',
  'PSO MANAGER': 'Outpatient pharmacy management. Without this: cannot manage pharmacy workflow or override dispensing locks.',
  'PSD PHARMACIST': 'Controlled substance pharmacist. Without this: cannot access Schedule II-V dispensing or CS audit.',
  'PSDRPH': 'Controlled substance dispensing. Without this: cannot dispense Schedule II-V medications.',
  'PSOPHARMACIST': 'Pharmacist verification authority. Without this: cannot verify outpatient prescriptions.',
  'PSOINTERFACE': 'Pharmacy interface access. Without this: cannot access pharmacy interface management functions.',
  'LRLAB': 'Laboratory technician access. Without this: cannot enter or process lab results.',
  'LRVERIFY': 'Laboratory result verification. Without this: results remain unverified and may not release to charts.',
  'LRSUPER': 'Laboratory supervisor authority. Without this: cannot override lab workflows or manage QA.',
  'LRMGR': 'Laboratory manager authority. Without this: cannot manage lab configuration or personnel.',
  'LRCAP': 'Lab collection and accession. Without this: cannot process specimen collection or accession.',
  'SD SCHEDULING': 'Appointment scheduling. Without this: cannot book, cancel, or modify patient appointments.',
  'SDCLINICAL': 'Clinical scheduling access. Without this: cannot manage clinical appointment types.',
  'SD SUPERVISOR': 'Scheduling supervisor authority. Without this: cannot override closures or manage no-shows.',
  'SDMGR': 'Scheduling manager authority. Without this: cannot manage clinic schedule templates.',
  'DG REGISTER': 'Patient registration. Without this: cannot register new patients or update demographics.',
  'DG REGISTRATION': 'Patient registration access. Without this: cannot access the registration workflow.',
  'DG ADMIT': 'Patient admission. Without this: cannot process inpatient admissions.',
  'DG DISCHARGE': 'Patient discharge. Without this: cannot process patient discharges.',
  'DG TRANSFER': 'Patient transfer. Without this: cannot transfer patients between wards or services.',
  'DG MENU': 'ADT coordinator menu. Without this: cannot access the ADT management workflow.',
  'DG SUPERVISOR': 'ADT supervisor authority. Without this: cannot override ADT restrictions or access sensitive records.',
  'DG SENSITIVITY': 'Sensitive patient access. Without this: cannot view records flagged as sensitive.',
  'DGMEANS TEST': 'Means test entry. Without this: cannot enter or update patient means test information.',
  'GMRA ALLERGY VERIFY': 'Allergy verification authority. Without this: cannot verify or mark allergies as reviewed.',
  'RA TECHNOLOGIST': 'Radiology technologist access. Without this: cannot perform or manage imaging exams.',
  'MAG SYSTEM': 'Imaging system access. Without this: cannot access the VistA Imaging system.',
  'MAG CAPTURE': 'Image capture authority. Without this: cannot capture or upload medical images.',
  'XUMGR': 'User management authority. Without this: cannot create, edit, or manage other user accounts.',
  'XUPROG': 'System programmer access. Without this: cannot access FileMan or system programming tools.',
  'XUPROGMODE': 'Advanced diagnostic access. Without this: cannot enter programmer mode for system diagnostics.',
  'XUAUDITING': 'Security auditing access. Without this: cannot view or manage security audit logs.',
  'IBFIN': 'Billing financial access. Without this: cannot process billing claims or financial transactions.',
};

export default function RoleTemplates() {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState(ROLES[0]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('permissions');
  const [vistaKeySet, setVistaKeySet] = useState(new Set());
  const [customRoles, setCustomRoles] = useState([]);
  const [cloneModalSource, setCloneModalSource] = useState(null);
  const [cloneName, setCloneName] = useState('');
  const [roleSaving, setRoleSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [error, setError] = useState(null);

  const [keyHolderMap, setKeyHolderMap] = useState({});
  // Server-enriched key data: keyName → { displayName, description, department }
  const [keyEnrichMap, setKeyEnrichMap] = useState({});

  // Role assignment modal state
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignStaffList, setAssignStaffList] = useState([]);
  const [assignStaffSearch, setAssignStaffSearch] = useState('');
  const [assignStaffLoading, setAssignStaffLoading] = useState(false);
  const [assignSelectedUser, setAssignSelectedUser] = useState(null);
  const [assignUserKeys, setAssignUserKeys] = useState([]);
  const [assigningRole, setAssigningRole] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState(null);

  // Custom role editing state
  const [editingCustomKeys, setEditingCustomKeys] = useState(false);
  const [customKeySearch, setCustomKeySearch] = useState('');
  // Workspace access editing for custom roles
  const [editedWorkspaceAccess, setEditedWorkspaceAccess] = useState(null);

  useEffect(() => {
    Promise.allSettled([
      getPermissions(),
      getCustomRoles(),
    ]).then(([permsRes, customRes]) => {
      let eMap = {};
      if (permsRes.status === 'fulfilled') {
        const permsData = permsRes.value?.data || [];
        const keys = permsData.map(k => k.keyName);
        setVistaKeySet(new Set(keys));
        const hMap = {};
        permsData.forEach(k => {
          hMap[k.keyName] = k.holderCount || 0;
          eMap[k.keyName] = {
            displayName: k.displayName || k.descriptiveName || '',
            description: k.description || '',
            department: k.department || k.packageName || '',
          };
        });
        setKeyHolderMap(hMap);
        setKeyEnrichMap(eMap);
      }
      if (customRes.status === 'fulfilled' && customRes.value?.data) {
        const loaded = customRes.value.data.map(r => ({
          ...r,
          isSystem: false,
          userCount: 0,
          permissions: (r.keys || []).map(k => ({
            label: eMap[k]?.displayName || k,
            key: k,
          })),
          mutualExclusions: [],
          workspaceAccess: {},
        }));
        setCustomRoles(loaded);
      }
      if (permsRes.status === 'rejected' && customRes.status === 'rejected') {
        setError('Failed to load role data. Please try refreshing.');
      }
    });
  }, []);

  const getRoleHolderCount = (role) => {
    if (Object.keys(keyHolderMap).length === 0) return role.userCount;
    // Count minimum holders across all role keys (intersection estimate)
    const counts = role.permissions.map(p => keyHolderMap[p.key] || 0).filter(c => c > 0);
    return counts.length > 0 ? Math.min(...counts) : 0;
  };

  const handleClone = (sourceRole) => {
    setCloneModalSource(sourceRole);
    setCloneName(`${sourceRole.name} (Copy)`);
  };

  const confirmClone = async () => {
    if (!cloneName.trim() || !cloneModalSource) return;
    setRoleSaving(true);
    const newRole = {
      ...cloneModalSource,
      id: `custom-${Date.now()}`,
      name: cloneName.trim(),
      isSystem: false,
      clonedFrom: cloneModalSource.isSystem ? cloneModalSource.id : cloneModalSource.clonedFrom || null,
      userCount: 0,
    };
    try {
      const res = await createCustomRole({
        name: newRole.name,
        description: newRole.description,
        keys: newRole.permissions.map(p => p.key),
      });
      if (res?.id) newRole.id = res.id;
      setCustomRoles(prev => [...prev, newRole]);
      setSelectedRole(newRole);
    } catch (err) {
      setError(err.message || 'Failed to create role');
    }
    setCloneModalSource(null);
    setRoleSaving(false);
  };

  const handleDeleteCustom = async (roleId) => {
    setDeleteTarget(roleId);
  };

  const confirmDeleteCustom = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCustomRole(deleteTarget);
      setCustomRoles(prev => prev.filter(r => r.id !== deleteTarget));
      setSelectedRole(ROLES[0]);
    } catch (err) {
      setError(err.message || 'Failed to delete role');
    }
    setDeleteTarget(null);
  };

  const handleOpenAssignRole = async (role) => {
    setAssignTarget(role);
    setAssignStaffSearch('');
    setAssignSelectedUser(null);
    setAssignUserKeys([]);
    setAssignSuccess(null);
    if (assignStaffList.length === 0) {
      setAssignStaffLoading(true);
      try {
        const res = await getStaff();
        setAssignStaffList((res?.data || []).map(u => ({ duz: u.ien, name: u.name })));
      } catch { setAssignStaffList([]); }
      finally { setAssignStaffLoading(false); }
    }
  };

  const handleSelectAssignUser = async (user) => {
    setAssignSelectedUser(user);
    try {
      const res = await getUserPermissions(user.duz);
      setAssignUserKeys((res?.data || []).map(k => k.name));
    } catch { setAssignUserKeys([]); }
  };

  const handleConfirmAssignRole = async () => {
    if (!assignTarget || !assignSelectedUser) return;
    setAssigningRole(true);
    try {
      const existingSet = new Set(assignUserKeys);
      const toAdd = assignTarget.permissions.filter(p => !existingSet.has(p.key));
      for (const perm of toAdd) {
        await assignPermission(assignSelectedUser.duz, { keyName: perm.key });
      }
      setAssignSuccess(`Assigned ${toAdd.length} new key${toAdd.length !== 1 ? 's' : ''} to ${assignSelectedUser.name}. ${assignTarget.permissions.length - toAdd.length} already held.`);
      setAssignSelectedUser(null);
    } catch (err) {
      setError(err.message || 'Failed to assign role');
    } finally { setAssigningRole(false); }
  };

  const toggleCustomRoleKey = (roleId, keyData) => {
    setCustomRoles(prev => prev.map(r => {
      if (r.id !== roleId) return r;
      const has = r.permissions.some(p => p.key === keyData.name);
      const newPerms = has
        ? r.permissions.filter(p => p.key !== keyData.name)
        : [...r.permissions, { label: keyData.displayName || keyData.name, key: keyData.name }];
      const updated = { ...r, permissions: newPerms };
      if (selectedRole.id === roleId) setSelectedRole(updated);
      return updated;
    }));
  };

  const saveCustomRoleKeys = async (roleId) => {
    const role = customRoles.find(r => r.id === roleId);
    if (!role) return;
    try {
      await updateCustomRole(roleId, {
        name: role.name,
        description: role.description,
        keys: role.permissions.map(p => p.key),
      });
      setEditingCustomKeys(false);
    } catch (err) {
      setError(err.message || 'Failed to save role changes');
    }
  };

  const allRoles = [...ROLES, ...customRoles];
  const filteredRoles = allRoles.filter(r =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell breadcrumb="Admin > Role Templates">
      {error && (
        <div className="mx-4 mt-2 px-4 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-4" aria-label="Dismiss error">&times;</button>
        </div>
      )}
      <div className="flex h-[calc(100vh-40px)]">
        {/* Left panel: role list */}
        <div className="w-full xl:w-[35%] border-r border-border overflow-auto p-4">
          <div className="flex items-center justify-between mb-1 px-2">
            <h1 className="text-[22px] font-bold text-[#222]">Role Templates</h1>
          </div>
          <p className="text-[13px] text-[#666] mb-3 px-2">
            Roles bundle permissions into assignable templates. Assign a role instead of
            individual permissions for consistency across your organization.
          </p>
          <div className="px-2 mb-3">
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search roles..."
              className="w-full px-3 py-2 text-[13px] border border-[#E2E4E8] rounded-md focus:ring-2 focus:ring-[#2E5984]/30 focus:border-[#2E5984] outline-none"
            />
          </div>
          <div className="space-y-1.5">
            {filteredRoles.map(role => (
              <button
                key={role.id}
                onClick={() => { setSelectedRole(role); setEditedWorkspaceAccess(null); }}
                className={`w-full text-left p-3 rounded-md transition-colors ${
                  selectedRole.id === role.id ? 'bg-[#E8EEF5] border border-[#2E5984]' : 'hover:bg-[#F5F8FB] border border-transparent'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-[13px] text-[#222]">{role.name}</div>
                    {role.isSystem && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#E8EEF5] text-[#2E5984] uppercase font-semibold">Built-in</span>}
                  </div>
                  <span className="text-[11px] text-[#999] font-mono">{getRoleHolderCount(role)}</span>
                </div>
                <div className="text-[11px] text-[#666] mt-0.5 line-clamp-1">{role.description}</div>
              </button>
            ))}
          </div>
          <div className="mt-4 px-2">
            <button
              onClick={() => handleClone(selectedRole)}
              className="w-full py-2.5 text-[13px] font-medium text-[#2E5984] border-2 border-dashed border-[#2E5984]/30 rounded-md hover:bg-[#E8EEF5] transition-colors">
              <span className="material-symbols-outlined text-[16px] mr-1.5 align-middle">add</span>
              Create Custom Role
            </button>
          </div>
        </div>

        {/* Right panel: role detail */}
        <div className="hidden xl:block w-[65%] overflow-auto p-6">
          <div className="max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[22px] font-bold text-[#222]">{selectedRole.name}</h2>
                  {selectedRole.isSystem && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-[#E8EEF5] text-[#2E5984] font-semibold">BUILT-IN</span>
                  )}
                </div>
                <p className="text-[13px] text-[#666] mt-1">{selectedRole.description}</p>
              </div>
              <span className="px-3 py-1 bg-[#F5F8FB] rounded-full text-[12px] font-mono text-[#666]">
                {getRoleHolderCount(selectedRole)} staff assigned
              </span>
            </div>

            {/* Tab bar */}
            <div className="flex gap-1 border-b border-[#E2E4E8] mb-5" role="tablist">
              {[
                { id: 'permissions', label: 'Permissions' },
                { id: 'staff', label: 'Staff' },
                { id: 'workspaces', label: 'Workspace Access' },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  role="tab" aria-selected={activeTab === t.id}
                  className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
                    activeTab === t.id ? 'border-[#2E5984] text-[#2E5984]' : 'border-transparent text-[#666] hover:text-[#222]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Permissions tab */}
            {activeTab === 'permissions' && (
              <>
                <section className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[11px] font-semibold text-[#999] uppercase tracking-wider">
                      Permissions Granted
                    </h3>
                    {!selectedRole.isSystem && (
                      <button
                        onClick={() => { setEditingCustomKeys(!editingCustomKeys); setCustomKeySearch(''); }}
                        className="text-[11px] font-medium text-[#2E5984] hover:text-[#1A1A2E] flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">{editingCustomKeys ? 'close' : 'edit'}</span>
                        {editingCustomKeys ? 'Done Editing' : 'Edit Keys'}
                      </button>
                    )}
                  </div>

                  {/* Inline key editor for custom roles */}
                  {editingCustomKeys && !selectedRole.isSystem && (
                    <div className="mb-4 p-3 bg-[#F5F8FB] rounded-lg border border-[#E2E4E8]">
                      <input
                        type="text"
                        placeholder="Search keys…"
                        value={customKeySearch}
                        onChange={e => setCustomKeySearch(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-[#E2E4E8] rounded-md focus:outline-none focus:border-[#2E5984] mb-2"
                      />
                      <div className="max-h-[250px] overflow-y-auto space-y-1">
                        {[...vistaKeySet]
                          .filter(k => !customKeySearch || k.toLowerCase().includes(customKeySearch.toLowerCase()) || (keyEnrichMap[k]?.displayName || '').toLowerCase().includes(customKeySearch.toLowerCase()))
                          .slice(0, 100)
                          .map(keyName => {
                            const enriched = keyEnrichMap[keyName];
                            const isSelected = selectedRole.permissions.some(p => p.key === keyName);
                            return (
                              <label key={keyName} className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-white text-[12px] ${isSelected ? 'bg-[#E8F5E9]' : ''}`}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleCustomRoleKey(selectedRole.id, { name: keyName, displayName: enriched?.displayName || keyName })}
                                  className="w-3.5 h-3.5 accent-[#1B7D3A]"
                                />
                                <span className="font-medium text-[#222]">{enriched?.displayName || keyName}</span>
                                {enriched?.department && <span className="text-[9px] text-[#999]">({enriched.department})</span>}
                              </label>
                            );
                          })}
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#E2E4E8]">
                        <span className="text-[11px] text-[#666]">{selectedRole.permissions.length} keys selected</span>
                        <button
                          onClick={() => saveCustomRoleKeys(selectedRole.id)}
                          className="px-3 py-1.5 text-[11px] font-medium bg-[#1A1A2E] text-white rounded-md hover:bg-[#2E5984]">
                          Save Changes
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    {(() => {
                      const validPerms = selectedRole.permissions.filter(p => vistaKeySet.size === 0 || vistaKeySet.has(p.key));
                      // Group by department
                      const groups = {};
                      for (const perm of validPerms) {
                        const dept = keyEnrichMap[perm.key]?.department || 'General';
                        if (!groups[dept]) groups[dept] = [];
                        groups[dept].push(perm);
                      }
                      const deptEntries = Object.entries(groups);
                      if (deptEntries.length === 0) {
                        return <p className="text-[12px] text-[#999] italic px-3 py-2">No permissions in this role are available in the current system.</p>;
                      }
                      return deptEntries.map(([dept, perms]) => (
                        <div key={dept} className="mb-3">
                          {deptEntries.length > 1 && (
                            <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wider px-3 py-1">{dept}</div>
                          )}
                          {perms.map((perm, i) => {
                            const enriched = keyEnrichMap[perm.key];
                            const displayName = enriched?.displayName || perm.label;
                            const description = enriched?.description || '';
                            return (
                              <div key={i} className="px-3 py-2.5 bg-[#F5F8FB] rounded-lg mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="material-symbols-outlined text-[16px] text-[#1B7D3A]">check_circle</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-[13px] font-medium text-[#222]">{displayName}</span>
                                      {keyEnrichMap[perm.key]?.department && (
                                        <span className="text-[9px] px-2 py-0.5 rounded bg-white text-[#666] flex-shrink-0">
                                          {keyEnrichMap[perm.key].department}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                {description && <div className="text-[11px] text-[#666] ml-6 mt-0.5">{description}</div>}
                                {KEY_IMPACTS[perm.key] && (
                                  <div className="text-[11px] text-[#888] ml-6 mt-1 leading-relaxed italic">{KEY_IMPACTS[perm.key]}</div>
                                )}
                                <details className="ml-6 mt-0.5">
                                  <summary className="text-[9px] text-[#BBB] cursor-pointer hover:text-[#888]">System reference</summary>
                                  <div className="text-[10px] font-mono text-[#AAA] mt-0.5">{perm.key}</div>
                                </details>
                              </div>
                            );
                          })}
                        </div>
                      ));
                    })()}
                  </div>
                </section>

                {selectedRole.mutualExclusions.length > 0 && (
                  <section className="mb-6">
                    <h3 className="text-[11px] font-semibold text-[#999] uppercase tracking-wider mb-3">Mutual Exclusion Rules</h3>
                    {selectedRole.mutualExclusions.map(rule => (
                      <div key={rule} className="flex items-start gap-2 px-3 py-2 bg-[#FFF8E1] rounded-lg border border-[#FFD54F]">
                        <span className="material-symbols-outlined text-[#F5A623] text-[16px] mt-0.5">warning</span>
                        <span className="text-[13px] text-[#222]">{rule}</span>
                      </div>
                    ))}
                  </section>
                )}
              </>
            )}

            {/* Staff tab — shows who holds this role */}
            {activeTab === 'staff' && (
              <section className="mb-6">
                <h3 className="text-[11px] font-semibold text-[#999] uppercase tracking-wider mb-3">
                  Staff Members with This Role
                </h3>
                {(() => {
                  const holderCount = getRoleHolderCount(selectedRole);
                  if (holderCount === 0) {
                    return (
                      <div className="text-center py-8 text-sm text-[#999]">
                        <span className="material-symbols-outlined text-[32px] block mb-2">group_off</span>
                        No staff members currently hold all permissions in this role.
                      </div>
                    );
                  }
                  // Show per-key holder counts as a breakdown
                  return (
                    <div className="space-y-2">
                      <div className="px-3 py-2 bg-[#E8F5E9] rounded-lg text-[13px] text-[#2D6A4F] flex items-center gap-2 mb-3">
                        <span className="material-symbols-outlined text-[16px]">people</span>
                        Approximately {holderCount} staff member{holderCount !== 1 ? 's' : ''} hold this role (based on permission intersection).
                      </div>
                      <h4 className="text-[10px] font-semibold text-[#999] uppercase tracking-wider mt-3 mb-2">Per-Permission Breakdown</h4>
                      {selectedRole.permissions.map((perm, i) => {
                        const count = keyHolderMap[perm.key] || 0;
                        const enriched = keyEnrichMap[perm.key];
                        return (
                          <div key={i} className="flex items-center justify-between px-3 py-2 bg-[#F5F8FB] rounded-lg">
                            <span className="text-[12px] text-[#222]">{enriched?.displayName || perm.label}</span>
                            <span className="text-[11px] font-mono text-[#666]">{count} holder{count !== 1 ? 's' : ''}</span>
                          </div>
                        );
                      })}
                      <button
                        onClick={() => {
                          const firstKey = selectedRole.permissions.find(p => vistaKeySet.size === 0 || vistaKeySet.has(p.key))?.key;
                          navigate(firstKey ? `/admin/permissions?view=${encodeURIComponent(firstKey)}` : '/admin/permissions');
                        }}
                        className="mt-3 px-4 py-2 text-[13px] font-medium border border-[#E2E4E8] rounded-md hover:bg-white transition-colors">
                        <span className="material-symbols-outlined text-[14px] mr-1 align-middle">open_in_new</span>
                        View Full Staff List in Permission Catalog
                      </button>
                    </div>
                  );
                })()}
              </section>
            )}

            {/* Workspace access tab with toggles */}
            {activeTab === 'workspaces' && (
              <section className="mb-6">
                <h3 className="text-[11px] font-semibold text-[#999] uppercase tracking-wider mb-3">
                  Workspace Visibility & Page-Level Access
                </h3>
                <div className="mb-3 p-3 bg-[#FFF8E1] rounded-lg text-[12px] text-[#F57C00] flex items-start gap-2">
                  <span className="material-symbols-outlined text-[16px] mt-0.5">info</span>
                  <span>These workspace access levels are <strong>recommended defaults</strong> for this role. Actual page access is determined by the security keys assigned above. {selectedRole.isSystem ? 'Built-in roles cannot be modified directly — click "Clone Role" to create a customizable copy.' : 'Click an access level to cycle through Read/Write → Read Only → No Access.'}</span>
                </div>
                <div className="space-y-2">
                  {ALL_WORKSPACES.map(ws => {
                    const accessSource = editedWorkspaceAccess && !selectedRole.isSystem ? editedWorkspaceAccess : selectedRole.workspaceAccess;
                    const access = accessSource?.[ws] || 'none';
                    const cycleAccess = () => {
                      if (selectedRole.isSystem) return;
                      const cycle = { rw: 'ro', ro: 'none', none: 'rw' };
                      const current = editedWorkspaceAccess || { ...selectedRole.workspaceAccess };
                      setEditedWorkspaceAccess({ ...current, [ws]: cycle[access] });
                    };
                    return (
                      <div
                        key={ws}
                        onClick={!selectedRole.isSystem ? cycleAccess : undefined}
                        className={`flex items-center justify-between px-4 py-3 rounded-lg border ${access !== 'none' ? 'border-[#E2E4E8] bg-white' : 'border-transparent bg-[#FAFAFA]'} ${!selectedRole.isSystem ? 'cursor-pointer hover:border-[#2E5984] transition-colors' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${access === 'rw' ? 'bg-[#1B7D3A]' : access === 'ro' ? 'bg-[#2E5984]' : 'bg-[#DDD]'}`} />
                          <span className={`text-[13px] ${access !== 'none' ? 'text-[#222] font-medium' : 'text-[#999]'}`}>{ws}</span>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase ${ACCESS_COLORS[access]}`}>
                          {ACCESS_LABELS[access]}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {/* Save / Reset buttons for custom roles with edited workspace access */}
                {editedWorkspaceAccess && !selectedRole.isSystem && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={async () => {
                        try {
                          await updateCustomRole(selectedRole.id, {
                            name: selectedRole.name,
                            description: selectedRole.description,
                            keys: selectedRole.permissions.map(p => p.key),
                            workspaceAccess: editedWorkspaceAccess,
                          });
                          const updated = { ...selectedRole, workspaceAccess: editedWorkspaceAccess };
                          setCustomRoles(prev => prev.map(r => r.id === selectedRole.id ? updated : r));
                          setSelectedRole(updated);
                          setEditedWorkspaceAccess(null);
                        } catch (err) {
                          setError(err.message || 'Failed to save workspace access');
                        }
                      }}
                      className="px-4 py-2 text-[13px] font-medium bg-[#1A1A2E] text-white rounded-md hover:bg-[#2E5984] transition-colors"
                    >
                      Save Workspace Access
                    </button>
                    <button
                      onClick={() => setEditedWorkspaceAccess(null)}
                      className="px-4 py-2 text-[13px] font-medium border border-[#E2E4E8] rounded-md hover:bg-[#F5F8FB] transition-colors"
                    >
                      Discard Changes
                    </button>
                  </div>
                )}
                {/* Reset to Default for custom roles cloned from a built-in */}
                {!selectedRole.isSystem && selectedRole.clonedFrom && !editedWorkspaceAccess && (
                  <div className="mt-3">
                    <button
                      onClick={() => {
                        const source = ROLES.find(r => r.id === selectedRole.clonedFrom);
                        if (source) {
                          setEditedWorkspaceAccess({ ...source.workspaceAccess });
                        }
                      }}
                      className="px-4 py-2 text-[13px] font-medium border border-[#E2E4E8] rounded-md hover:bg-[#F5F8FB] transition-colors"
                    >
                      <span className="material-symbols-outlined text-[14px] mr-1 align-middle">restart_alt</span>
                      Reset to Default
                    </button>
                  </div>
                )}
              </section>
            )}

            <div className="flex gap-3 pt-4 border-t border-[#E2E4E8]">
              <button
                onClick={() => handleOpenAssignRole(selectedRole)}
                className="px-4 py-2 text-[13px] font-medium bg-[#1A1A2E] text-white rounded-md hover:bg-[#2E5984] transition-colors">
                Assign to Staff Member
              </button>
              <button
                onClick={() => {
                  // Navigate to the catalog filtered to the role's primary key
                  // so the operator can see which staff currently hold it.
                  const firstAvailableKey = selectedRole.permissions.find(p => vistaKeySet.size === 0 || vistaKeySet.has(p.key))?.key;
                  if (firstAvailableKey) {
                    navigate(`/admin/permissions?view=${encodeURIComponent(firstAvailableKey)}`);
                  } else {
                    navigate('/admin/permissions');
                  }
                }}
                className="px-4 py-2 text-[13px] font-medium border border-[#E2E4E8] rounded-md hover:bg-[#F5F8FB] transition-colors">
                View Staff with This Role
              </button>
              <button
                onClick={() => handleClone(selectedRole)}
                className="px-4 py-2 text-[13px] font-medium border border-[#E2E4E8] rounded-md hover:bg-[#F5F8FB] transition-colors">
                <span className="material-symbols-outlined text-[14px] mr-1 align-middle">content_copy</span>
                Clone Role
              </button>
              {!selectedRole.isSystem && (
                <button
                  onClick={() => handleDeleteCustom(selectedRole.id)}
                  className="px-4 py-2 text-[13px] font-medium border border-[#E2E4E8] rounded-md hover:bg-[#F5F8FB] text-[#CC3333] transition-colors">
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Clone Role Modal */}
      {cloneModalSource && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setCloneModalSource(null)}>
          <div className="bg-white rounded-lg shadow-xl w-[400px] p-6" role="dialog" aria-modal="true" aria-label="Clone Role" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-[#222] mb-3">Clone Role</h3>
            <p className="text-xs text-[#666] mb-4">
              Create a new custom role based on "{cloneModalSource.name}". The new role will inherit all permissions and workspace access.
            </p>
            <label className="block text-xs font-medium text-[#222] mb-1">New Role Name</label>
            <input type="text" value={cloneName} onChange={e => setCloneName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#E2E4E8] rounded-md focus:outline-none focus:border-[#2E5984] mb-4" />
            <div className="flex justify-end gap-3">
              <button onClick={() => setCloneModalSource(null)}
                className="px-4 py-2 text-xs border border-[#E2E4E8] rounded-md hover:bg-[#F5F8FB]">Cancel</button>
              <button onClick={confirmClone} disabled={!cloneName.trim() || roleSaving}
                className="px-4 py-2 text-xs font-medium bg-[#1A1A2E] text-white rounded-md hover:bg-[#2E5984] disabled:opacity-40">
                {roleSaving ? 'Saving…' : 'Create Role'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Custom Role"
          message="Delete this custom role? This action cannot be undone."
          confirmLabel="Delete"
          onConfirm={confirmDeleteCustom}
          onCancel={() => setDeleteTarget(null)}
          destructive
        />
      )}

      {/* Assign Role to Staff Member Modal */}
      {assignTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setAssignTarget(null)}>
          <div className="bg-white rounded-lg shadow-xl w-[520px] max-h-[85vh] overflow-y-auto p-6" role="dialog" aria-modal="true" aria-label="Assign Role" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-[#222] mb-1">Assign Role: {assignTarget.name}</h3>
            <p className="text-xs text-[#666] mb-4">
              Select a staff member to assign all {assignTarget.permissions.length} permissions in this role. Keys the user already holds will be skipped.
            </p>

            {assignSuccess ? (
              <div className="mb-4">
                <div className="p-3 bg-[#E8F5E9] rounded-lg text-sm text-[#2D6A4F] flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  {assignSuccess}
                </div>
                <div className="flex justify-end gap-3">
                  <button onClick={() => { setAssignSuccess(null); setAssignSelectedUser(null); }}
                    className="px-4 py-2 text-xs font-medium border border-[#E2E4E8] rounded-md hover:bg-[#F5F8FB]">Assign Another</button>
                  <button onClick={() => setAssignTarget(null)}
                    className="px-4 py-2 text-xs font-medium bg-[#1A1A2E] text-white rounded-md hover:bg-[#2E5984]">Done</button>
                </div>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Search staff by name…"
                  value={assignStaffSearch}
                  onChange={e => setAssignStaffSearch(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#E2E4E8] rounded-md focus:outline-none focus:border-[#2E5984] mb-3"
                />

                {assignStaffLoading ? (
                  <div className="text-center py-6 text-sm text-[#999]">Loading staff…</div>
                ) : (
                  <div className="max-h-[200px] overflow-y-auto border border-[#E2E4E8] rounded-md mb-4">
                    {assignStaffList
                      .filter(u => !assignStaffSearch || u.name.toLowerCase().includes(assignStaffSearch.toLowerCase()))
                      .slice(0, 50)
                      .map(user => (
                        <button
                          key={user.duz}
                          onClick={() => handleSelectAssignUser(user)}
                          className={`w-full text-left px-3 py-2 text-sm border-b border-[#F0F0F0] last:border-b-0 hover:bg-[#F5F8FB] transition-colors ${assignSelectedUser?.duz === user.duz ? 'bg-[#E8EEF5] font-medium' : ''}`}>
                          {user.name}
                          <span className="text-[10px] text-[#999] ml-2">DUZ {user.duz}</span>
                        </button>
                      ))}
                  </div>
                )}

                {assignSelectedUser && (
                  <div className="mb-4 p-3 bg-[#F5F8FB] rounded-lg">
                    <div className="text-xs font-semibold text-[#222] mb-2">
                      Key comparison for {assignSelectedUser.name}
                    </div>
                    <div className="space-y-1 max-h-[150px] overflow-y-auto">
                      {assignTarget.permissions.map((perm, i) => {
                        const alreadyHeld = assignUserKeys.includes(perm.key);
                        return (
                          <div key={i} className="flex items-center gap-2 text-[12px]">
                            <span className={`material-symbols-outlined text-[14px] ${alreadyHeld ? 'text-[#999]' : 'text-[#1B7D3A]'}`}>
                              {alreadyHeld ? 'check' : 'add_circle'}
                            </span>
                            <span className={alreadyHeld ? 'text-[#999]' : 'text-[#222]'}>
                              {keyEnrichMap[perm.key]?.displayName || perm.label}
                            </span>
                            {alreadyHeld && <span className="text-[10px] text-[#BBB]">(already held)</span>}
                          </div>
                        );
                      })}
                    </div>
                    <div className="text-[11px] text-[#666] mt-2">
                      {assignTarget.permissions.filter(p => !assignUserKeys.includes(p.key)).length} new key(s) will be assigned
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  <button onClick={() => setAssignTarget(null)}
                    className="px-4 py-2 text-xs border border-[#E2E4E8] rounded-md hover:bg-[#F5F8FB]">Cancel</button>
                  <button
                    onClick={handleConfirmAssignRole}
                    disabled={!assignSelectedUser || assigningRole}
                    className="px-4 py-2 text-xs font-medium bg-[#1A1A2E] text-white rounded-md hover:bg-[#2E5984] disabled:opacity-40">
                    {assigningRole ? 'Assigning…' : 'Assign Role'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Terminal Reference */}
      <details className="mt-6 mb-2">
        <summary className="text-[10px] text-[#BBB] cursor-pointer hover:text-[#888]">📖 Terminal Reference</summary>
        <div className="mt-2 p-3 bg-[#FAFAFA] rounded-lg text-[11px] text-[#888] leading-relaxed space-y-1">
          <p>Role templates are a <strong>VistA Evolved feature</strong> with no direct terminal equivalent. In legacy VistA, key assignment is managed per-user via:</p>
          <p className="font-mono text-[10px] text-[#AAA]">EVE → Systems Manager Menu → User Management → Edit an Existing User → Security Keys</p>
          <p>This page groups keys into named roles for faster, more consistent assignment. Each key in a role template maps 1:1 to a VistA security key in the SECURITY KEY file (#19.1).</p>
        </div>
      </details>
    </AppShell>
  );
}
