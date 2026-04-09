/**
 * Runtime term translation using vista-vocabulary.json.
 * Maps VistA internal terms to modern product labels.
 */

export const KEY_TRANSLATIONS = {
  'XUMGR': 'System Administrator',
  'XUPROG': 'System Programmer',
  'XUPROGMODE': 'Advanced Diagnostic Access',
  'XUAUDITING': 'Audit Management',
  'XUMGR DEVELOPER': 'Developer Access',
  'XUSCREENMAN': 'Form Builder Access',
  'ORES': 'Write Clinical Orders',
  'ORELSE': 'Enter Verbal / Telephone Orders',
  'OREMAS': 'Ward Clerk Order Entry',
  'OR CPRS GUI CHART': 'Clinical Workspace Access',
  'PROVIDER': 'Provider (Clinical Authority)',
  'PSORPH': 'Outpatient Pharmacy Processing',
  'PSO MANAGER': 'Outpatient Pharmacy Manager',
  'PSJ PHARMACIST': 'Inpatient Pharmacist',
  'PSD PHARMACIST': 'Controlled Substances Pharmacist',
  'PSB MANAGER': 'Medication Administration Manager',
  'LRLAB': 'Core Lab Operations',
  'LRVERIFY': 'Lab Result Verification',
  'LRSUPER': 'Lab Supervisor',
  'SD SUPERVISOR': 'Scheduling Supervisor',
  'SDMGR': 'Scheduling Manager',
  'DG REGISTER': 'Patient Registration',
  'DG SENSITIVITY': 'Restricted Record Access',
  'DG SUPERVISOR': 'Registration Supervisor',
  'DG MENU': 'Admissions Coordinator',
  'MAG SYSTEM': 'Imaging System Manager',
  'RA ALLOC': 'Radiology Resource Allocator',
  'SR SURGEON': 'Surgeon',
  'SR ANESTHESIOLOGIST': 'Anesthesiologist',
  'TIU SIGN DOCUMENT': 'Sign Clinical Notes',
  'GMRA ALLERGY VERIFY': 'Verify Allergies',
  'IB BILLING': 'Billing Access',
  'SC PCMM': 'Primary Care Management',
  'DGPF ASSIGNMENT': 'Patient Flag Assignment',
};

const TERM_MAP = {
  // Administrative
  'Institution': 'Facility',
  'Medical Center Division': 'Site',
  'Hospital Location': 'Location',
  'Ward Location': 'Ward',
  'Operating Room': 'Operating Room',
  'Service/Section': 'Department',
  'Station Number': 'Facility Code',
  'Treating Specialty': 'Specialty',
  'Clinic Stop': 'Visit Type',
  'Bedsection': 'Unit Type',
  'VISN': 'Region',
  'CBOC': 'Community Clinic',
  'CLC': 'Long-Term Care',
  'Domiciliary': 'Residential Treatment',
  'Non-Count Clinic': 'Administrative Clinic',
  // Person / Identity
  'Patient': 'Patient',
  'DFN': 'DO NOT DISPLAY',
  'SSN': 'Last 4 SSN',
  'ICN': 'Enterprise ID',
  'NEW PERSON': 'Staff Member',
  'DUZ': 'DO NOT DISPLAY',
  'Provider': 'Provider',
  'Attending': 'Attending Physician',
  'Person Class': 'Provider Type',
  'Electronic Signature Code': 'E-Signature',
  'Surrogate': 'Delegate',
  'Sensitive Patient': 'Restricted Access',
  // Security / System
  'Security Key': 'Permission',
  'Option': 'Feature',
  'Menu Option': 'Feature',
  'Access Code': 'Username',
  'Verify Code': 'Password',
  'Context Option (B-type)': 'Application Context',
  'RPC (Remote Procedure Call)': 'API Endpoint',
  'FileMan Date': 'Date/Time',
  'Global (^-prefixed)': 'DO NOT DISPLAY',
  'TaskMan': 'Background Task',
  'MailMan': 'Notification',
  'Bulletin': 'Alert',
  'Alert': 'Alert',
  'KIDS': 'System Update',
  // Clinical
  'Problem': 'Problem',
  'Progress Note': 'Clinical Note',
  'TIU Document': 'Clinical Note',
  'Order': 'Order',
  'Consult': 'Referral',
  'Allergy': 'Allergy',
  'Adverse Reaction': 'Allergy',
  'Vital Sign': 'Vital Signs',
  'Measurement': 'Vital Signs',
  'Health Factor': 'Health Factor',
  // Scheduling
  'Appointment': 'Appointment',
  'Clinic': 'Clinic',
  'Availability': 'Available Slot',
  'Slot': 'Available Slot',
  'Check-In': 'Check-In',
  'Check-Out': 'Check-Out',
  'No-Show': 'No-Show',
  'Recall Reminder': 'Follow-Up Reminder',
  'Overbook': 'Overbook',
  'Wait List': 'Wait List',
  // Pharmacy
  'Drug': 'Medication',
  'NDF': 'Drug Reference',
  'National Drug File': 'Drug Reference',
  'Orderable Item': 'Orderable Item',
  'Outpatient Prescription': 'Prescription',
  'Inpatient Order (Unit Dose / IV)': 'Medication Order',
  'BCMA': 'Medication Verification',
  // Laboratory
  'Accession': 'Lab Accession',
  'Lab Test': 'Lab Test',
  'Lab Result': 'Result',
  // Billing
  'Integrated Billing': 'Billing',
  'IB': 'Billing',
  'Accounts Receivable': 'Account Balance',
  'AR': 'Account Balance',
  'Third Party': 'Insurance Payer',
  'First Party': 'Patient Responsibility',
  'Means Test': 'Financial Screening',
  'Insurance Company': 'Insurance Company',
  'ECME': 'Pharmacy Claim',
  // Surgery
  'Surgery Case': 'Surgical Case',
  'Anesthesia Record': 'Anesthesia Record',
  'Surgical Waiting List': 'Surgical Wait List',
};

const BANNED_TERMS = new Set([
  'DFN', 'DUZ', 'IEN', 'NAOU', 'NEW PERSON', 'NOIS',
  'FileMan', 'Global', '^DPT', '^VA(200)', '^PS',
  'KIDS', 'TaskMan', 'MailMan', 'MUMPS',
  'Stop Code', 'Bedsection', 'Means Test',
  'VISN', 'CBOC', 'CLC', 'Domiciliary',
  'Green Sheet', 'Pink Sheet', 'ORWU', 'SDES',
  'XWB', 'XUS', 'RPC Broker', 'Context Option',
  'Access Code', 'Verify Code',
  'TIU', 'GMRC', 'PCE', 'PIMS',
  'BCMA', 'CMOP', 'ECME', 'NDF', 'PDM',
  'IFCAP', 'FMS', 'DMC', 'TOP',
  'VASQIP', 'ASA Class',
]);

// Case-insensitive lookup map
const LOOKUP = new Map(
  Object.entries(TERM_MAP).map(([k, v]) => [k.toLowerCase(), v])
);

/**
 * Translate a VistA internal term to its modern UI label.
 * Returns the modern label or the original term if no mapping exists.
 */
export function translateTerm(vistaTerm) {
  if (!vistaTerm) return '';
  const mapped = LOOKUP.get(String(vistaTerm).toLowerCase());
  if (mapped === 'DO NOT DISPLAY') return '';
  return mapped || vistaTerm;
}

/**
 * Check if a term is banned from user-facing display.
 */
export function isBannedTerm(term) {
  return BANNED_TERMS.has(term);
}

/**
 * Translate a term, returning null if it maps to DO NOT DISPLAY.
 * Useful for conditional rendering.
 */
export function safeTranslate(vistaTerm) {
  if (!vistaTerm) return null;
  const mapped = LOOKUP.get(String(vistaTerm).toLowerCase());
  if (mapped === 'DO NOT DISPLAY') return null;
  return mapped || vistaTerm;
}

/**
 * Translate a VistA security key name to a human-readable label.
 * Falls back to title-casing the key name if no translation exists.
 */
export function translateKey(keyName) {
  if (!keyName) return '';
  return KEY_TRANSLATIONS[keyName] || KEY_TRANSLATIONS[keyName.toUpperCase()] || null;
}
