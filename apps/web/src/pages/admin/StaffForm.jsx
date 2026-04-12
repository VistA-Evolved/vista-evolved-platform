import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppShell from '../../components/shell/AppShell';
import { CautionBanner, ConfirmDialog } from '../../components/shared/SharedComponents';
import { getSites, getPermissions, getStaffMember, getUserPermissions, createStaffMember, updateStaffMember, getESignatureStatus, setESignature, getStaff, getDepartments, updateCredentials, addMailGroupMember, getMailGroups, renameStaffMember, assignPermission, removePermission, assignDivision, checkAccessCode } from '../../services/adminService';
import { ROLES as SYSTEM_ROLES } from './RoleTemplates';

/**
 * AD-02 / ADM-03+ADM-04: Create / Edit Staff Member (Multi-Step Wizard)
 *
 * Spec: Doc 2 Section 3.2 (ADM-03 Create Staff Wizard) — 6-step form
 * Wireframe: Doc 41 (WF-11 AD-02)
 * Vocabulary: Doc 17 — "NEW PERSON #200" -> "Staff Member", "Access Code" -> "Username",
 *   "Verify Code" -> "Password", "Person Class" -> "Provider Type",
 *   "Service/Section" -> "Department", "Division" -> "Site",
 *   "Electronic Signature Code" -> "E-Signature", DUZ -> NEVER DISPLAY
 *
 * Data Source: NEW PERSON #200
 * Backend: ZVE USER CREATE (new), ZVE USER EDIT (existing)
 * Field constraints: NAME must be 3-35 chars, uppercase, LAST,FIRST MIDDLE format
 */

const STEPS = [
  { id: 'person', label: 'Person & Credentials' },
  { id: 'role-location', label: 'Role & Location' },
  { id: 'provider', label: 'Provider Setup', conditional: true },
  { id: 'review', label: 'Review & Create' },
];

// Roles are now imported from RoleTemplates.jsx as SYSTEM_ROLES.
// The 24 VistA-key-backed roles are the single source of truth for both
// the StaffForm wizard and the Roles & Permissions page.

const PROVIDER_TYPES = [
  { value: 'physician', label: 'Physician (MD/DO) — Allopathic / Osteopathic' },
  { value: 'np', label: 'Nurse Practitioner (NP)' },
  { value: 'pa', label: 'Physician Assistant (PA)' },
  { value: 'rn', label: 'Registered Nurse (RN)' },
  { value: 'pharmacist', label: 'Pharmacist (PharmD/RPh)' },
  { value: 'dentist', label: 'Dentist (DDS/DMD)' },
  { value: 'psychologist', label: 'Psychologist (PhD/PsyD)' },
  { value: 'social-worker', label: 'Licensed Clinical Social Worker (LCSW)' },
  { value: 'dietitian', label: 'Registered Dietitian (RD)' },
];

// Curated "starter kit" permissions grouped by function. Every key below
// is a REAL VistA security key present in standard Kernel + CPRS + package
// installs. If a key isn't in the live VistA catalog at runtime, it is
// hidden — not shown as a disabled checkbox with a "will be configured"
// tooltip, which leaks VistA internals to the admin user.
//
// The label is only used as a fallback; the runtime render prefers the
// server-provided displayName + description from the key enrichment.
const PERMISSION_STARTERS = [
  {
    group: 'Clinical',
    hint: 'Orders, clinical notes, provider access',
    items: [
      { key: 'PROVIDER',       label: 'Provider (can be selected on orders and encounters)', roleDefault: ['provider'] },
      { key: 'ORES',           label: 'Write clinical orders (physicians, signed)',          roleDefault: ['provider'] },
      { key: 'ORELSE',         label: 'Enter verbal / telephone orders (non-physician)',     roleDefault: ['nurse'] },
      { key: 'OREMAS',         label: 'MAS order entry (unit clerks / ward clerks)',         roleDefault: [] },
      { key: 'ORCL-SIGN-NOTES', label: 'Sign clinical notes (progress notes, consults)',    roleDefault: ['provider'] },
      { key: 'ORCL-PAT-RECS',  label: 'View patient records and chart data',                roleDefault: ['provider', 'nurse', 'front-desk'] },
      { key: 'GMRA-ALLERGY VERIFY', label: 'Verify patient allergies',                      roleDefault: ['provider'] },
    ],
  },
  {
    group: 'Pharmacy',
    hint: 'Outpatient and inpatient pharmacy operations',
    items: [
      { key: 'PSORPH',         label: 'Outpatient pharmacy refill processing',               roleDefault: ['pharmacist'] },
      { key: 'PSO MANAGER',    label: 'Outpatient pharmacy manager',                         roleDefault: [] },
      { key: 'PSJ PHARMACIST', label: 'Inpatient pharmacist',                                roleDefault: ['pharmacist'] },
      { key: 'PSD PHARMACIST', label: 'Controlled substances pharmacist',                    roleDefault: [] },
      { key: 'PSB NURSE',      label: 'Bedside medication administration (barcode scanning)', roleDefault: ['nurse'] },
      { key: 'PSOINTERFACE',   label: 'Pharmacy system interface',                           roleDefault: ['pharmacist'] },
      { key: 'PSOPHARMACIST',  label: 'Pharmacist prescription verification',                roleDefault: ['pharmacist'] },
    ],
  },
  {
    group: 'Laboratory',
    hint: 'Lab operations, result verification, supervision',
    items: [
      { key: 'LRLAB',          label: 'Core lab operations (accessioning, results)',         roleDefault: ['lab-tech'] },
      { key: 'LRVERIFY',       label: 'Verify and release lab results',                      roleDefault: [] },
      { key: 'LRSUPER',        label: 'Lab supervisor',                                      roleDefault: [] },
      { key: 'LRCAP',          label: 'Lab collection and specimen accession',               roleDefault: ['lab-tech'] },
    ],
  },
  {
    group: 'Scheduling',
    hint: 'Appointments, clinic schedules, supervisor overrides',
    items: [
      { key: 'SD SCHEDULING',  label: 'Schedule patient appointments',                       roleDefault: ['scheduler'] },
      { key: 'SDCLINICAL',     label: 'Clinical scheduling access',                          roleDefault: ['scheduler'] },
      { key: 'SD SUPERVISOR',  label: 'Scheduling supervisor',                               roleDefault: [] },
      { key: 'SDMGR',          label: 'Scheduling manager',                                  roleDefault: [] },
    ],
  },
  {
    group: 'Registration',
    hint: 'Patient registration and sensitive-record access',
    items: [
      { key: 'DG REGISTER',    label: 'Patient registration clerk',                          roleDefault: ['front-desk'] },
      { key: 'DG REGISTRATION', label: 'Full patient registration',                          roleDefault: ['front-desk'] },
      { key: 'DG ADMIT',       label: 'Process patient admissions',                          roleDefault: ['front-desk'] },
      { key: 'DGMEANS TEST',   label: 'Financial screening / means test',                    roleDefault: ['front-desk'] },
      { key: 'DG SENSITIVITY', label: 'Access restricted / sensitive patient records',       roleDefault: [] },
      { key: 'DG SUPERVISOR',  label: 'ADT supervisor',                                      roleDefault: [] },
    ],
  },
  {
    group: 'Imaging',
    hint: 'Imaging and radiology permissions',
    items: [
      { key: 'MAG SYSTEM',     label: 'Imaging system manager',                              roleDefault: [] },
      { key: 'RA ALLOC',       label: 'Radiology resource allocator',                        roleDefault: ['rad-tech'] },
    ],
  },
  {
    group: 'System Administration',
    hint: 'User management and system administration',
    items: [
      { key: 'XUMGR',          label: 'System administrator (full user management)',          roleDefault: ['system-admin'] },
      { key: 'XUPROG',         label: 'System programmer (advanced access)',                  roleDefault: [] },
      { key: 'XUPROGMODE',     label: 'Advanced diagnostic access',                           roleDefault: [] },
    ],
  },
];

export default function StaffForm() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(userId);
  useEffect(() => { document.title = isEdit ? 'Edit Staff — VistA Evolved' : 'New Staff — VistA Evolved'; }, [isEdit]);
  const [currentStep, setCurrentStep] = useState(0);
  const stepContentRef = useRef(null);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [liveSites, setLiveSites] = useState([]);
  const [livePermissions, setLivePermissions] = useState([]);
  const [livePermissionMap, setLivePermissionMap] = useState(new Map());
  const [liveDepartments, setLiveDepartments] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [refDataError, setRefDataError] = useState(null);
  const [esigStatus, setEsigStatus] = useState({ hasCode: false, sigBlockName: '' });
  const [originalForm, setOriginalForm] = useState(null);
  const [clearingEsig, setClearingEsig] = useState(false);
  const [showClearEsigDialog, setShowClearEsigDialog] = useState(false);

  // P3.3: Cosigner provider picker — typeahead search
  const [cosignerSuggestions, setCosignerSuggestions] = useState([]);
  const [cosignerSearching, setCosignerSearching] = useState(false);
  const cosignerTimerRef = useRef(null);
  const searchCosignerProviders = (query) => {
    if (cosignerTimerRef.current) clearTimeout(cosignerTimerRef.current);
    if (!query || query.length < 2) { setCosignerSuggestions([]); return; }
    setCosignerSearching(true);
    cosignerTimerRef.current = setTimeout(async () => {
      try {
        const res = await getStaff({ search: query });
        const providers = (res?.data || []).filter(u => u.isProvider === true || u.isProvider === '1');
        setCosignerSuggestions(providers.slice(0, 10).map(u => ({ name: u.name || u.username, duz: u.ien || u.id })));
      } catch (err) { setCosignerSuggestions([]); }
      finally { setCosignerSearching(false); }
    }, 400);
  };

  // S9.23: Debounced access code uniqueness check
  const [acStatus, setAcStatus] = useState(null); // null | 'checking' | 'available' | 'taken'
  const acTimerRef = useRef(null);
  useEffect(() => () => { if (acTimerRef.current) clearTimeout(acTimerRef.current); }, []);
  const checkAccessCodeAvailability = (code) => {
    if (acTimerRef.current) clearTimeout(acTimerRef.current);
    if (!code || code.length < 3) { setAcStatus(null); return; }
    setAcStatus('checking');
    acTimerRef.current = setTimeout(async () => {
      try {
        const res = await checkAccessCode(code);
        setAcStatus(res.available ? 'available' : 'taken');
      } catch (err) {
        setAcStatus(null); // network error — don't block the form
      }
    }, 500);
  };

  useEffect(() => {
    const loadRefData = async () => {
      setDataLoading(true);
      setRefDataError(null);
      try {
        const [sitesRes, permsRes, deptRes, mailGroupsRes] = await Promise.all([getSites(), getPermissions(), getDepartments(), getMailGroups().catch(() => ({ data: [] }))]);

        // Sites come from MEDICAL CENTER DIVISION #40.8 via the /divisions route
        const sites = (sitesRes?.data || []).map(d => ({
          value: d.ien,
          label: d.stationNumber ? `${d.name} — ${d.stationNumber}` : d.name,
          type: (d.name || '').includes('CBOC') ? 'Community Clinic' : 'Medical Center',
        }));
        setLiveSites(sites);

        // Preserve the full server enrichment for each key (displayName,
        // packageName, description) so the permissions step shows live
        // human labels instead of the hardcoded fallback text.
        const perms = (permsRes?.data || []).map(k => ({
          key: k.keyName,
          displayName: k.displayName || k.descriptiveName || k.keyName,
          description: k.description || '',
          packageName: k.packageName || '',
          holderCount: k.holderCount || 0,
        }));
        setLivePermissions(perms);
        setLivePermissionMap(new Map(perms.map(p => [p.key, p])));

        // SERVICE/SECTION #49 populates the department dropdown. VistA
        // allows duplicate names (e.g. two "NHCU" entries with different
        // IENs), so we dedupe by name for the dropdown.
        const deptNames = [...new Set((deptRes?.data || []).map(d => d.name).filter(Boolean))].sort();
        setLiveDepartments(deptNames);

        // Mail groups for B6 — mail group assignment during user creation
        const groups = (mailGroupsRes?.data || []).map(g => ({ ien: g.ien, name: g.name, description: g.description || '' })).filter(g => g.ien && g.name);
        setLiveMailGroups(groups);

        if (sites.length === 0) {
          setRefDataError('No sites returned. The system may be unreachable.');
        } else if (deptNames.length === 0) {
          setRefDataError('No departments returned. The system may be unreachable.');
        } else if (perms.length === 0) {
          setRefDataError('No permissions returned. The system may be unreachable.');
        }
      } catch (err) {
        setRefDataError(`Failed to load reference data: ${err.message || 'unknown error'}`);
      } finally {
        setDataLoading(false);
      }
    };
    loadRefData();

    if (isEdit && userId) {
      Promise.all([getStaffMember(userId), getUserPermissions(userId), getESignatureStatus({ duz: userId })]).then(([userRes, keysRes, esigRes]) => {
        const vg = userRes?.data?.vistaGrounding || {};
        const keys = (keysRes?.data || []).map(k => k.name);
        const esigData = (esigRes?.data || []).find(e => String(e.duz) === String(userId) || String(e.id) === String(userId));
        if (esigData) setEsigStatus({ hasCode: esigData.hasCode || false, sigBlockName: esigData.sigBlockName || '' });
        // Parse VistA LAST,FIRST MIDDLE format into separate fields
        const rawName = userRes?.data?.name || '';
        let parsedLast = '', parsedFirst = '', parsedMI = '';
        if (rawName.includes(',')) {
          parsedLast = rawName.split(',')[0].trim();
          const rest = rawName.split(',').slice(1).join(',').trim();
          const parts = rest.split(/\s+/);
          parsedFirst = parts[0] || '';
          parsedMI = parts.slice(1).join(' ') || '';
        } else {
          parsedLast = rawName;
        }
        const editVals = {
          fullName: rawName,
          lastName: parsedLast, firstName: parsedFirst, middleInitial: parsedMI,
          email: vg.email || '',
          phone: vg.officePhone || '',
          title: userRes?.data?.title || vg.title || '',
          sex: vg.sex || '',
          npi: vg.npi || '',
          dea: vg.dea || '',
          department: vg.serviceSection || '',
          sigBlockName: vg.electronicSignature?.sigBlockName || esigData?.sigBlockName || '',
          assignedPermissions: keys,
          language: vg.language || '',
          verifyCodeNeverExpires: vg.verifyCodeNeverExpires || false,
          filemanAccess: vg.filemanAccessCode || '',
          restrictPatient: vg.restrictPatient || '',
          employeeId: vg.employeeId || userRes?.data?.employeeId || '',
          providerType: vg.providerType || '',
          cosigner: vg.cosigner || '',
          cosignerDuz: '', // DUZ not returned in DETAIL — will be resolved on re-selection
          requiresCosign: Boolean(vg.cosigner), // #29: infer from cosigner presence
          authMeds: vg.authMeds || false,
        };
        setForm(f => ({ ...f, ...editVals }));
        setOriginalForm(editVals);
      }).catch((err) => {
        setRefDataError(`Failed to load staff member data: ${err.message || 'unknown error'}`);
      });
    }
  }, [isEdit, userId]);

  // J001: Focus first input when step changes
  useEffect(() => {
    if (stepContentRef.current) {
      const firstInput = stepContentRef.current.querySelector('input:not([type=hidden]),select,textarea');
      if (firstInput) firstInput.focus();
    }
  }, [currentStep]);

  const validateStep = (stepId) => {
    const errors = {};
    if (stepId === 'person') {
      if (!form.lastName.trim()) errors.lastName = 'Last name is required';
      else if (form.lastName.length < 2) errors.lastName = 'Last name must be at least 2 characters';
      else if (form.lastName.length > 25) errors.lastName = 'Last name must be 25 characters or fewer';
      else if (!/^[A-Z \-']+$/i.test(form.lastName.trim())) errors.lastName = 'Only letters, spaces, hyphens, and apostrophes allowed';
      if (!form.firstName.trim()) errors.firstName = 'First name is required';
      else if (form.firstName.length < 1) errors.firstName = 'First name is required';
      else if (form.firstName.length > 15) errors.firstName = 'First name must be 15 characters or fewer';
      if (form.middleInitial && form.middleInitial.length > 1) errors.middleInitial = 'Middle initial must be a single letter';
      else if (form.middleInitial && !/^[A-Z]$/i.test(form.middleInitial)) errors.middleInitial = 'Middle initial must be a letter';
      // Compose fullName for length check
      const composedName = `${form.lastName.trim()},${form.firstName.trim()}${form.middleInitial ? ' ' + form.middleInitial.trim() : ''}`.toUpperCase();
      if (composedName.length > 35) errors.lastName = 'Combined name must be 35 characters or fewer';
      if (!form.sex) errors.sex = 'Gender is required';
      if (!form.dob) errors.dob = 'Date of birth is required';
      else {
        const dobDate = new Date(form.dob);
        const ageDiff = Date.now() - dobDate.getTime();
        const ageYears = ageDiff / (365.25 * 24 * 60 * 60 * 1000);
        if (ageYears < 16) errors.dob = 'Staff member must be at least 16 years old';
      }
      // G008: Email validation — require TLD
      if (form.email && !/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(form.email)) errors.email = 'Invalid email format (must include domain like .com, .gov)';
      // G009: Phone validation — at least 10 digits
      if (form.phone && !/^\d{10,}$/.test(form.phone.replace(/[\s\-().+]/g, ''))) errors.phone = 'Phone must contain at least 10 digits';
      // G010: SSN last4 validation
      if (form.govIdLast4 && !/^\d{4}$/.test(form.govIdLast4)) errors.govIdLast4 = 'Must be exactly 4 digits';
      // Credentials are required for new users
      if (!isEdit) {
        if (!form.accessCode || !form.accessCode.trim()) errors.accessCode = 'Username (Access Code) is required';
        else if (form.accessCode.length < 3) errors.accessCode = 'Username must be at least 3 characters';
        else if (acStatus === 'taken') errors.accessCode = 'This username is already in use';
        if (!form.verifyCode) errors.verifyCode = 'Password (Verify Code) is required';
        else if (form.verifyCode.length < 8) errors.verifyCode = 'Password must be at least 8 characters';
        if (form.verifyCode && form.verifyCode !== form.verifyCodeConfirm) errors.verifyCodeConfirm = 'Passwords do not match';
      }
    }
    if (stepId === 'role-location') {
      if (!form.primaryRole) errors.primaryRole = 'Role selection is required';
      if (!form.department.trim()) errors.department = 'Department is required';
      if (!form.primaryLocation) errors.primaryLocation = 'At least one site must be selected';
    }
    if (stepId === 'provider' && showProviderStep) {
      if (!form.providerType) errors.providerType = 'Provider type is required';
      if (form.npi) {
        if (!/^\d{10}$/.test(form.npi)) errors.npi = 'NPI must be exactly 10 digits';
        else {
          // NPI Luhn check (prefix 80840 per CMS standard)
          const prefixed = '80840' + form.npi;
          let sum = 0;
          for (let i = prefixed.length - 1, alt = false; i >= 0; i--, alt = !alt) {
            let n = parseInt(prefixed[i], 10);
            if (alt) { n *= 2; if (n > 9) n -= 9; }
            sum += n;
          }
          if (sum % 10 !== 0) errors.npi = 'NPI check digit is invalid';
        }
      }
      // F013: DEA format validation — 2 letters + 7 digits + checksum
      if (form.dea) {
        if (!/^[A-Za-z]{2}\d{7}$/.test(form.dea)) errors.dea = 'DEA must be 2 letters followed by 7 digits (e.g., AB1234567)';
        else {
          const digits = form.dea.slice(2);
          const odd = parseInt(digits[0]) + parseInt(digits[2]) + parseInt(digits[4]);
          const even = parseInt(digits[1]) + parseInt(digits[3]) + parseInt(digits[5]);
          const checkDigit = (odd + even * 2) % 10;
          if (checkDigit !== parseInt(digits[6])) errors.dea = 'DEA check digit is invalid';
        }
      }
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const [form, setForm] = useState({
    fullName: '', lastName: '', firstName: '', middleInitial: '',
    displayName: '', title: '', sex: '', dob: '', govIdLast4: '', email: '', phone: '',
    employeeId: '',
    primaryRole: '', department: '', isProvider: false, sigBlockName: '',
    primaryLocation: '', additionalLocations: [],
    providerType: '', npi: '', dea: '', deaExpiration: '',
    authorizedToWriteMeds: false, controlledSchedules: [],
    assignedPermissions: [],
    secondaryFeatures: ['OR CPRS GUI CHART'],
    removedDefaults: [],
    language: '', verifyCodeNeverExpires: false, filemanAccess: '',
    restrictPatient: '', mailGroups: [], degree: '',
    accessCode: '', verifyCode: '', verifyCodeConfirm: '',
    requiresCosign: false, cosigner: '', cosignerDuz: '',
  });

  const [liveMailGroups, setLiveMailGroups] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [createSuccess, setCreateSuccess] = useState(null);
  const submitErrorRef = useRef(null);

  // F009: Warn on unsaved changes (beforeunload)
  const isDirty = form.lastName || form.firstName || form.accessCode || form.verifyCode;
  useEffect(() => {
    if (!isDirty || createSuccess) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty, createSuccess]);

  // I006: Scroll to submit error when it appears
  useEffect(() => {
    if (submitError && submitErrorRef.current) {
      submitErrorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [submitError]);

  const updateField = (field, value) => setForm(f => ({ ...f, [field]: value }));
  const step = STEPS[currentStep];
  const showProviderStep = form.isProvider || (() => {
    const role = SYSTEM_ROLES.find(r => r.id === form.primaryRole);
    return role ? role.permissions.some(p => p.key === 'PROVIDER') : false;
  })();

  // When the primary site changes, drop it from the additional-sites list
  // so a user can't be assigned twice to the same division.
  useEffect(() => {
    if (!form.primaryLocation) return;
    if (!form.additionalLocations.includes(form.primaryLocation)) return;
    setForm(f => ({
      ...f,
      additionalLocations: f.additionalLocations.filter(v => v !== form.primaryLocation),
    }));
  }, [form.primaryLocation, form.additionalLocations]);

  const handleSubmit = async () => {
    // Permissions are pre-populated from the role selection in Step 2 (Role & Location).
    // The user can adjust individual permissions in the Review step's collapsible section.
    // Merge with any PERMISSION_STARTERS defaults that are still checked.
    const starterDefaults = PERMISSION_STARTERS.flatMap(g => g.items)
      .filter(item => item.roleDefault.includes(form.primaryRole) && !form.removedDefaults.includes(item.key))
      .map(item => item.key);
    const mergedPermissions = [...new Set([...form.assignedPermissions, ...starterDefaults])];

    // ORES/ORELSE mutual exclusion — block submission
    if (mergedPermissions.includes('ORES') && mergedPermissions.includes('ORELSE')) {
      setSubmitError('Cannot save: "Write clinical orders" and "Enter verbal orders" are mutually exclusive — a staff member cannot hold both. Remove one before proceeding.');
      return;
    }
    // Credential validation for new users
    if (!isEdit && form.verifyCode && form.verifyCode !== form.verifyCodeConfirm) {
      setSubmitError('Passwords do not match. Please correct before submitting.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      // Compose VistA LAST,FIRST MIDDLE format from separate fields
      const composedName = `${form.lastName.trim()},${form.firstName.trim()}${form.middleInitial ? ' ' + form.middleInitial.trim() : ''}`.toUpperCase();
      const payload = {
        name: composedName,
        sex: form.sex,
        dob: form.dob,
        ssnLast4: form.govIdLast4 || '',
        email: form.email,
        phone: form.phone,
        role: form.primaryRole,
        department: form.department,
        isProvider: form.isProvider || showProviderStep,
        primaryLocation: form.primaryLocation,
        additionalLocations: form.additionalLocations,
        providerType: form.providerType,
        npi: form.npi,
        dea: form.dea,
        deaExpiration: form.deaExpiration,
        authorizedToWriteMeds: form.authorizedToWriteMeds,
        controlledSchedules: form.controlledSchedules,
        permissions: mergedPermissions,
        secondaryFeatures: form.secondaryFeatures,
        sigBlockName: form.sigBlockName,
        requiresCosign: form.requiresCosign || false,
        cosigner: form.cosignerDuz || form.cosigner || '',
        language: form.language || '',
        verifyCodeNeverExpires: form.verifyCodeNeverExpires || false,
        filemanAccess: form.filemanAccess || '',
        restrictPatient: form.restrictPatient || '',
        employeeId: form.employeeId || '',
        title: form.title || '',
        degree: form.degree || '',
      };
      if (isEdit) {
        // C001 fix: Send individual field updates instead of bulk payload.
        // Map form keys to VistA File 200 field numbers for PUT /users/:ien {field, value}.
        const FIELD_MAP = {
          email: '.151', phone: '.132', title: '8', sex: '4', npi: '41.99',
          dea: '53.2', department: '29', sigBlockName: '20.3', language: '200.07',
          filemanAccess: '3', restrictPatient: '101.01', providerType: '53.5',
          cosigner: '53.42', deaExpiration: '53.21', degree: '10.6',
        };
        const BOOL_FIELDS = {
          verifyCodeNeverExpires: '9.5', authorizedToWriteMeds: '53.11',
          requiresCosign: '53.08',
        };
        const orig = originalForm || {};
        const errors = [];

        // C011: Handle name rename separately
        const composedOrig = orig.fullName || '';
        if (composedName !== composedOrig) {
          try { await renameStaffMember(userId, { newName: composedName }); }
          catch (e) { errors.push(`Rename: ${e.message}`); }
        }

        // Simple field updates — only send changed values
        for (const [key, fld] of Object.entries(FIELD_MAP)) {
          const cur = form[key] || '';
          const prev = orig[key] || '';
          if (cur !== prev) {
            try { await updateStaffMember(userId, { field: fld, value: cur }); }
            catch (e) { errors.push(`${key}: ${e.message}`); }
          }
        }

        // Boolean field updates
        for (const [key, fld] of Object.entries(BOOL_FIELDS)) {
          const cur = form[key] || false;
          const prev = orig[key] || false;
          if (cur !== prev) {
            try { await updateStaffMember(userId, { field: fld, value: cur ? '1' : '0' }); }
            catch (e) { errors.push(`${key}: ${e.message}`); }
          }
        }

        // Permission diff — add new, remove old
        const origKeys = new Set(orig.assignedPermissions || []);
        const newKeys = new Set(mergedPermissions);
        for (const k of newKeys) {
          if (!origKeys.has(k)) {
            try { await assignPermission(userId, { keyName: k }); }
            catch (e) { errors.push(`+key ${k}: ${e.message}`); }
          }
        }
        for (const k of origKeys) {
          if (!newKeys.has(k)) {
            try { await removePermission(userId, k); }
            catch (e) { errors.push(`-key ${k}: ${e.message}`); }
          }
        }

        // S2.2: Division change tracking
        const origPrimary = orig.primaryLocation || '';
        if (form.primaryLocation && form.primaryLocation !== origPrimary) {
          try { await assignDivision(userId, form.primaryLocation, 'ADD'); }
          catch (e) { errors.push(`Division ${form.primaryLocation}: ${e.message}`); }
        }
        const origAdditional = new Set(orig.additionalLocations || []);
        const newAdditional = new Set(form.additionalLocations || []);
        for (const loc of newAdditional) {
          if (!origAdditional.has(loc)) {
            try { await assignDivision(userId, loc, 'ADD'); }
            catch (e) { errors.push(`+division ${loc}: ${e.message}`); }
          }
        }
        for (const loc of origAdditional) {
          if (!newAdditional.has(loc)) {
            try { await assignDivision(userId, loc, 'REMOVE'); }
            catch (e) { errors.push(`-division ${loc}: ${e.message}`); }
          }
        }

        // Update credentials if provided during edit
        if (form.accessCode || form.verifyCode) {
          try {
            await updateCredentials(userId, {
              accessCode: form.accessCode || undefined,
              verifyCode: form.verifyCode || undefined,
            });
          } catch (e) { errors.push(`Credentials: ${e.message}`); }
        }

        if (errors.length > 0) {
          setSubmitError(`Some fields failed to save: ${errors.join('; ')}`);
          return;
        }
        navigate('/admin/staff');
      } else {
        // Include credentials in create payload — ZVE USMG ADD accepts them
        if (form.accessCode) payload.accessCode = form.accessCode;
        if (form.verifyCode) payload.verifyCode = form.verifyCode;
        const createRes = await createStaffMember(payload);
        // B6: Assign mail groups after creation
        const newDuz = createRes?.data?.duz || createRes?.data?.ien;
        const mailGroupResults = [];
        if (newDuz && form.mailGroups && form.mailGroups.length > 0) {
          for (const groupIen of form.mailGroups) {
            try {
              await addMailGroupMember(groupIen, newDuz);
              mailGroupResults.push({ groupIen, status: 'ok' });
            } catch (e) {
              mailGroupResults.push({ groupIen, status: 'error', detail: e.message });
            }
          }
        }
        // Parse extraFields to find key assignment results
        const extraFields = createRes?.data?.extraFields || createRes?.extraFields || [];
        const permEntry = extraFields.find(f => f.field === 'permissions');
        const keyResults = permEntry?.keys || [];
        const failedKeys = keyResults.filter(k => k.status !== 'ok');
        const successKeyCount = keyResults.filter(k => k.status === 'ok').length;
        const failedMailGroups = mailGroupResults.filter(m => m.status !== 'ok');
        const successMailGroupCount = mailGroupResults.filter(m => m.status === 'ok').length;
        // Show success screen with "Create Another" option
        setCreateSuccess({
          name: `${form.lastName},${form.firstName}${form.middleInitial ? ' ' + form.middleInitial : ''}`,
          staffId: `S-${newDuz}`,
          department: form.department,
          site: liveSites.find(l => l.value === form.primaryLocation)?.label || '',
          role: SYSTEM_ROLES.find(r => r.id === form.primaryRole)?.name || '',
          permCount: keyResults.length > 0 ? successKeyCount : mergedPermissions.length,
          permTotal: mergedPermissions.length,
          failedKeys,
          mailGroupCount: successMailGroupCount,
          failedMailGroups,
          duz: newDuz,
        });
      }
    } catch (err) {
      setSubmitError(err.message || 'Failed to save staff member. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNameBlur = async () => {
    const composedName = `${form.lastName.trim()},${form.firstName.trim()}${form.middleInitial ? ' ' + form.middleInitial.trim() : ''}`.toUpperCase();
    if (!composedName || composedName.length < 3 || !form.lastName.trim() || !form.firstName.trim()) return;
    try {
      const res = await getStaff({ search: composedName });
      const matches = (res?.data || []).filter(u => {
        return u.name && u.name.toUpperCase() === composedName;
      });
      if (matches.length > 0 && !isEdit) {
        setDuplicateWarning({
          message: `Potential duplicate found: ${matches.length} existing record(s) match this name. Verify before continuing.`,
          isDuplicate: true,
        });
      } else {
        setDuplicateWarning({
          message: 'Duplicate check complete. No matching records found.',
          isDuplicate: false,
        });
      }
    } catch (err) {
      setDuplicateWarning(null);
    }
  };

  const visibleSteps = STEPS.filter(s => {
    if (s.id === 'provider' && !showProviderStep) return false;
    return true;
  });

  const handleClearEsig = async () => {
    setShowClearEsigDialog(true);
  };

  const confirmClearEsig = async () => {
    setShowClearEsigDialog(false);
    setClearingEsig(true);
    try {
      await setESignature(userId, { action: 'clear' });
      setEsigStatus({ hasCode: false, sigBlockName: '' });
    } catch (err) {
      setSubmitError(err?.message || 'Failed to clear e-signature');
    } finally { setClearingEsig(false); }
  };

  const handleSaveSigBlock = async () => {
    try {
      await setESignature(userId, { sigBlockName: form.sigBlockName });
      setEsigStatus(prev => ({ ...prev, sigBlockName: form.sigBlockName }));
    } catch (err) {
      setSubmitError(err?.message || 'Failed to save signature block');
    }
  };

  return (
    <AppShell breadcrumb={`Admin > ${isEdit ? 'Edit Staff Member' : 'Create Staff Member'}`}>
      <div className="p-6 max-w-5xl">
        {/* Create Another success screen */}
        {createSuccess ? (
          <div className="text-center py-10">
            <div className="w-16 h-16 rounded-full bg-[#E8F5E9] flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[32px] text-[#2E7D32]">check_circle</span>
            </div>
            <h2 className="text-xl font-bold text-text mb-2">
              {createSuccess.name} created successfully ({createSuccess.staffId})
            </h2>
            <div className="text-sm text-text-secondary mb-6">
              Department: {createSuccess.department || '—'} | Site: {createSuccess.site || '—'} | Role: {createSuccess.role || '—'}
              <br />
              {createSuccess.permCount}{createSuccess.permTotal && createSuccess.permTotal !== createSuccess.permCount ? ` of ${createSuccess.permTotal}` : ''} permissions assigned
              {createSuccess.mailGroupCount > 0 && ` | Added to ${createSuccess.mailGroupCount} mail group(s)`}
            </div>
            {createSuccess.failedKeys && createSuccess.failedKeys.length > 0 && createSuccess.permCount === 0 && (
              <div className="mb-4 mx-auto max-w-md p-3 bg-[#FFEBEE] border border-[#EF5350] rounded-lg text-left" role="alert">
                <p className="text-sm font-bold text-[#C62828] mb-1">
                  ⚠ All {createSuccess.failedKeys.length} permission(s) failed to assign — this user has no capabilities
                </p>
                <p className="text-xs text-[#C62828] mb-2">The user was created but cannot perform any clinical functions. Check that the security keys exist in VistA and retry.</p>
                <ul className="text-xs text-[#C62828] list-disc list-inside">
                  {createSuccess.failedKeys.map((k, i) => (
                    <li key={i}>{k.key}{k.detail ? ` — ${k.detail}` : ''}</li>
                  ))}
                </ul>
              </div>
            )}
            {createSuccess.failedKeys && createSuccess.failedKeys.length > 0 && createSuccess.permCount > 0 && (
              <div className="mb-4 mx-auto max-w-md p-3 bg-[#FFF3E0] border border-[#FFB74D] rounded-lg text-left">
                <p className="text-sm font-medium text-[#E65100] mb-1">
                  {createSuccess.failedKeys.length} permission(s) failed to assign:
                </p>
                <ul className="text-xs text-[#BF360C] list-disc list-inside">
                  {createSuccess.failedKeys.map((k, i) => (
                    <li key={i}>{k.key}{k.detail ? ` — ${k.detail}` : ''}</li>
                  ))}
                </ul>
              </div>
            )}
            {createSuccess.failedMailGroups && createSuccess.failedMailGroups.length > 0 && (
              <div className="mb-4 mx-auto max-w-md p-3 bg-[#FFF3E0] border border-[#FFB74D] rounded-lg text-left">
                <p className="text-sm font-medium text-[#E65100] mb-1">
                  {createSuccess.failedMailGroups.length} mail group(s) failed:
                </p>
                <ul className="text-xs text-[#BF360C] list-disc list-inside">
                  {createSuccess.failedMailGroups.map((m, i) => (
                    <li key={i}>Group {m.groupIen}{m.detail ? ` — ${m.detail}` : ''}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => navigate(`/admin/staff/${createSuccess.duz}/edit`)}
                className="px-5 py-2 text-sm border border-border rounded-md hover:bg-surface-alt transition-colors"
              >
                View Profile
              </button>
              <button
                onClick={() => {
                  const preserveDepartment = form.department;
                  const preserveLocation = form.primaryLocation;
                  const preserveMailGroups = form.mailGroups || [];
                  setForm({
                    fullName: '', lastName: '', firstName: '', middleInitial: '',
                    displayName: '', title: '', sex: '', dob: '', govIdLast4: '', email: '', phone: '',
                    employeeId: '',
                    primaryRole: '', department: preserveDepartment, isProvider: false, sigBlockName: '',
                    primaryLocation: preserveLocation, additionalLocations: [],
                    providerType: '', npi: '', dea: '', deaExpiration: '',
                    authorizedToWriteMeds: false, controlledSchedules: [],
                    assignedPermissions: [],
                    secondaryFeatures: ['OR CPRS GUI CHART'],
                    removedDefaults: [],
                    language: '', verifyCodeNeverExpires: false, filemanAccess: '',
                    restrictPatient: '', mailGroups: preserveMailGroups, degree: '',
                    accessCode: '', verifyCode: '', verifyCodeConfirm: '',
                    requiresCosign: false, cosigner: '',
                  });
                  setCurrentStep(0);
                  setCreateSuccess(null);
                  setSubmitError('');
                  setValidationErrors({});
                  setDuplicateWarning(null);
                }}
                className="px-5 py-2 text-sm font-medium bg-navy text-white rounded-md hover:bg-steel transition-colors"
              >
                Create Another Staff Member
              </button>
              <button
                onClick={() => navigate('/admin/staff')}
                className="px-5 py-2 text-sm border border-border rounded-md hover:bg-surface-alt transition-colors"
              >
                Return to Directory
              </button>
            </div>
          </div>
        ) : (
        <>
        <h1 className="text-[22px] font-bold text-text mb-2">
          {isEdit ? 'Edit Staff Member' : 'Create New Staff Member'}
        </h1>
        <p className="text-sm text-text-secondary mb-6">
          {isEdit
            ? 'Update staff member profile, roles, locations, and permissions.'
            : 'Complete each step to register a new staff member in the system.'}
        </p>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-8 overflow-x-auto">
          {visibleSteps.map((s, i) => {
            const stepIndex = STEPS.indexOf(s);
            return (
              <button
                key={s.id}
                aria-current={currentStep === stepIndex ? 'step' : undefined}
                onClick={() => {
                  if (stepIndex > currentStep) {
                    for (let si = 0; si < stepIndex; si++) {
                      const vs = STEPS[si];
                      if (visibleSteps.includes(vs) && !validateStep(vs.id)) return;
                    }
                  }
                  setCurrentStep(stepIndex);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  currentStep === stepIndex
                    ? 'bg-navy text-white'
                    : currentStep > stepIndex
                      ? 'bg-success-bg text-success'
                      : 'bg-surface-alt text-text-secondary'
                }`}
              >
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border border-current">
                  {currentStep > stepIndex ? '✓' : i + 1}
                </span>
                {s.label}
              </button>
            );
          })}
        </div>

        {dataLoading && (
          <div className="flex items-center gap-2 p-3 bg-info-bg rounded-md text-sm text-info mb-4">
            <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
            Loading reference data (sites, departments, permissions)...
          </div>
        )}
        {!dataLoading && refDataError && (
          <div className="flex items-start gap-2 p-3 bg-[#FDE8E8] border border-[#CC3333] rounded-md text-sm text-[#CC3333] mb-4">
            <span className="material-symbols-outlined text-[18px] mt-0.5">error</span>
            <div>
              <strong>Reference data unavailable.</strong>
              <div className="mt-0.5 text-[12px] text-[#666]">{refDataError}</div>
              <div className="mt-0.5 text-[12px] text-[#666]">You can still fill out this form, but dropdowns for sites, departments, and permissions will be empty until the system is reachable.</div>
            </div>
          </div>
        )}

        <div ref={stepContentRef} className="bg-white border border-border rounded-lg p-6">

          {/* STEP 1: Person & Credentials */}
          {step.id === 'person' && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-text mb-4">Identity Basics</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 grid grid-cols-[1fr_1fr_80px] gap-3">
                  <FormField label="Last Name" required error={validationErrors.lastName}
                    hint="Family name, uppercase, 2+ characters.">
                    <input type="text" value={form.lastName}
                      onChange={e => updateField('lastName', e.target.value.toUpperCase().replace(/[^A-Z'-]/g, ''))}
                      onBlur={handleNameBlur}
                      placeholder="SMITH" className="form-input" maxLength={30} />
                  </FormField>
                  <FormField label="First Name" required error={validationErrors.firstName}
                    hint="Given name, uppercase, 2+ characters.">
                    <input type="text" value={form.firstName}
                      onChange={e => updateField('firstName', e.target.value.toUpperCase().replace(/[^A-Z'-]/g, ''))}
                      onBlur={handleNameBlur}
                      placeholder="JANE" className="form-input" maxLength={20} />
                  </FormField>
                  <FormField label="MI" hint="Optional">
                    <input type="text" value={form.middleInitial}
                      onChange={e => updateField('middleInitial', e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1))}
                      placeholder="A" className="form-input" maxLength={1} />
                  </FormField>
                </div>
                {/* L001/L002: Name character counter */}
                {(form.lastName || form.firstName) && (() => {
                  const composed = `${form.lastName.trim()},${form.firstName.trim()}${form.middleInitial ? ' ' + form.middleInitial.trim() : ''}`;
                  const remaining = 35 - composed.length;
                  return (
                    <p className={`text-[11px] mt-1 -mb-2 ${remaining < 0 ? 'text-[#CC3333] font-medium' : remaining < 6 ? 'text-[#E65100]' : 'text-[#999]'}`}>
                      Composed name: <span className="font-mono">{composed.toUpperCase()}</span> — {remaining >= 0 ? `${remaining} characters remaining` : `${-remaining} over limit`}
                    </p>
                  );
                })()}
                <FormField label="Display Name" hint="Optional friendly name for UI display">
                  <input type="text" value={form.displayName} onChange={e => updateField('displayName', e.target.value)}
                    placeholder="Jane Smith" className="form-input" maxLength={50} />
                </FormField>
                <FormField label="Job Title" hint="Position title (e.g. Staff Physician, RN, Pharmacist). Stored in VistA File #200 field 8.">
                  <input type="text" value={form.title} onChange={e => updateField('title', e.target.value)}
                    placeholder="Staff Physician" className="form-input" maxLength={60} />
                </FormField>
                <FormField label="Sex" required error={validationErrors.sex}
                  hint="Required for VistA File #200. Used for clinical decision support.">
                  <select value={form.sex} onChange={e => updateField('sex', e.target.value)} className="form-input">
                    <option value="">Select...</option>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                    <option value="U">Unknown</option>
                  </select>
                </FormField>
                <FormField label="Date of Birth" required error={validationErrors.dob}
                  hint="Required for identity verification. Stored in VistA File #200 field 5.">
                  <input type="date" value={form.dob}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={e => updateField('dob', e.target.value)}
                    onBlur={() => {
                      if (form.dob) {
                        const ageMs = Date.now() - new Date(form.dob).getTime();
                        if (ageMs / (365.25 * 24 * 60 * 60 * 1000) < 16)
                          setValidationErrors(e => ({ ...e, dob: 'Staff member must be at least 16 years old' }));
                        else setValidationErrors(e => { const { dob, ...rest } = e; return rest; });
                      }
                    }}
                    className="form-input" />
                  {form.dob && (() => {
                    const birth = new Date(form.dob);
                    const today = new Date();
                    let age = today.getFullYear() - birth.getFullYear();
                    if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
                    return age >= 0 && age < 150 ? <span className="text-[10px] text-[#666] ml-2">Age: {age}</span> : null;
                  })()}
                </FormField>
                <FormField label="Government ID (Last 4)" hint="Last 4 digits of SSN or national identifier. Masked for privacy.">
                  <input type="password" value={form.govIdLast4} onChange={e => updateField('govIdLast4', e.target.value)}
                    placeholder="••••" maxLength={4} className="form-input" autoComplete="off" />
                </FormField>
                <FormField label="Email" hint="Used for system notifications and password resets" error={validationErrors.email}>
                  <input type="email" value={form.email} onChange={e => updateField('email', e.target.value)}
                    onBlur={() => {
                      if (form.email && !/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(form.email))
                        setValidationErrors(e => ({ ...e, email: 'Invalid email format (must include domain like .com, .gov)' }));
                      else setValidationErrors(e => { const { email, ...rest } = e; return rest; });
                    }}
                    placeholder="jane.smith@facility.org" className="form-input" />
                </FormField>
                <FormField label="Phone"
                  hint="Office phone number for this staff member."
                  error={validationErrors.phone}>
                  <input type="tel" value={form.phone || ''}
                    onChange={e => updateField('phone', e.target.value)}
                    onBlur={e => {
                      const raw = (e.target.value || '').replace(/[^\d]/g, '');
                      if (raw.length === 10) updateField('phone', `(${raw.slice(0,3)}) ${raw.slice(3,6)}-${raw.slice(6)}`);
                    }}
                    placeholder="(503) 555-0100" className="form-input" />
                </FormField>
                <FormField label="Employee ID / Badge Number"
                  hint="Your organization's employee identifier. Leave blank to use system-generated Staff ID only.">
                  <input type="text" value={form.employeeId || ''}
                    onChange={e => updateField('employeeId', e.target.value)}
                    placeholder="e.g., EMP-1234" maxLength={30} className="form-input" />
                </FormField>
                <FormField label="Degree / Suffix" hint="Professional degree or credential suffix (e.g., MD, DO, PhD, RN). Stored in VistA File #200 field 10.6.">
                  <input type="text" value={form.degree || ''}
                    onChange={e => updateField('degree', e.target.value.toUpperCase())}
                    placeholder="MD" maxLength={20} className="form-input" />
                </FormField>
                <FormField label="Preferred Language" hint="The user's preferred language for system messages and reports. VistA File #200 field 200.07.">
                  <select value={form.language || ''} onChange={e => updateField('language', e.target.value)} className="form-input">
                    <option value="">System default (English)</option>
                    <option value="ENGLISH">English</option>
                    <option value="SPANISH">Spanish</option>
                  </select>
                </FormField>
              </div>
              {duplicateWarning && (
                <div className={`mt-4 p-3 rounded-md text-sm flex items-center gap-2 ${
                  duplicateWarning.isDuplicate ? 'bg-warning-bg text-warning' : 'bg-success-bg text-success'
                }`}>
                  <span className="material-symbols-outlined text-[18px]">
                    {duplicateWarning.isDuplicate ? 'warning' : 'check_circle'}
                  </span>
                  {duplicateWarning.message}
                </div>
              )}
            </div>
          )}

          {/* Credentials section (part of Person & Credentials step) */}
          {step.id === 'person' && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-text mb-2">Login Credentials</h2>
              <p className="text-sm text-[#666]">
                Set the username and password this person will use to sign in.
                In VistA, these are called Access Code and Verify Code.
              </p>
              {!isEdit && (
                <>
                <div className="p-4 bg-[#FFF3E0] rounded-lg text-sm text-[#E65100] flex items-start gap-2">
                  <span className="material-symbols-outlined text-[16px] mt-0.5">warning</span>
                  <span>These credentials cannot be retrieved later. Note them now and communicate securely to the staff member.</span>
                </div>
                <div className="p-4 bg-[#E3F2FD] rounded-lg text-sm text-[#1565C0] flex items-start gap-2">
                  <span className="material-symbols-outlined text-[16px] mt-0.5">info</span>
                  <span>This is a temporary password. The user will be required to change it on their first sign-in. Do not share this password via email — deliver it verbally or in a sealed envelope.</span>
                </div>
                </>
              )}
              <FormField label="Username" required={!isEdit}
                error={validationErrors.accessCode || (acStatus === 'taken' ? 'This username is already in use' : undefined)}
                hint="The identifier the user enters at the login prompt. 3-20 characters, letters and numbers. Called 'Access Code' in VistA.">
                <div className="relative">
                <input
                  value={form.accessCode || ''}
                  onChange={e => {
                    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                    updateField('accessCode', val);
                    if (!isEdit) checkAccessCodeAvailability(val);
                  }}
                  placeholder="e.g., JSMITH1234"
                  maxLength={20}
                  className={`w-full h-10 px-3 pr-9 border rounded-md text-sm ${acStatus === 'taken' ? 'border-[#CC3333]' : acStatus === 'available' ? 'border-[#2E7D32]' : 'border-border'}`}
                  autoComplete="off"
                />
                {acStatus && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2">
                    {acStatus === 'checking' && <span className="material-symbols-outlined text-[18px] text-[#999] animate-spin">progress_activity</span>}
                    {acStatus === 'available' && <span className="material-symbols-outlined text-[18px] text-[#2E7D32]">check_circle</span>}
                    {acStatus === 'taken' && <span className="material-symbols-outlined text-[18px] text-[#CC3333]">cancel</span>}
                  </span>
                )}
                </div>
              </FormField>
              <FormField label="Password" required={!isEdit}
                error={validationErrors.verifyCode}
                hint="8-20 characters with mixed case and numbers. Called 'Verify Code' in VistA. Must be changed every 90 days.">
                <div className="relative">
                  <input
                    type={form._showPassword ? 'text' : 'password'}
                    value={form.verifyCode || ''}
                    onChange={e => updateField('verifyCode', e.target.value)}
                    placeholder="Enter password"
                    maxLength={20}
                    className="w-full h-10 px-3 pr-9 border border-border rounded-md text-sm"
                    autoComplete="new-password"
                  />
                  <button type="button" tabIndex={-1} onClick={() => setForm(f => ({ ...f, _showPassword: !f._showPassword }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#999] hover:text-[#666]">
                    <span className="material-symbols-outlined text-[18px]">{form._showPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
                {/* F005: Password strength meter + #132 requirements checklist */}
                {form.verifyCode && (() => {
                  const pw = form.verifyCode;
                  const checks = [
                    { label: '8+ characters', pass: pw.length >= 8 },
                    { label: 'Uppercase letter', pass: /[A-Z]/.test(pw) },
                    { label: 'Lowercase letter', pass: /[a-z]/.test(pw) },
                    { label: 'Number', pass: /\d/.test(pw) },
                    { label: 'Special character', pass: /[^A-Za-z0-9]/.test(pw) },
                  ];
                  const score = checks.filter(c => c.pass).length;
                  const label = score <= 2 ? 'Weak' : score <= 4 ? 'Fair' : 'Strong';
                  const color = score <= 2 ? '#CC3333' : score <= 4 ? '#E65100' : '#2E7D32';
                  const pct = Math.min(100, score * 20);
                  return (
                    <div className="mt-1.5">
                      <div className="h-1.5 rounded-full bg-[#E2E4E8] overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-medium" style={{ color }}>{label}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1">
                        {checks.map(c => (
                          <div key={c.label} className="flex items-center gap-1 text-[10px]">
                            <span style={{ color: c.pass ? '#2E7D32' : '#999' }}>{c.pass ? '✓' : '○'}</span>
                            <span style={{ color: c.pass ? '#2E7D32' : '#666' }}>{c.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </FormField>
              <FormField label="Confirm Password" required={!isEdit} error={validationErrors.verifyCodeConfirm}>
                <div className="relative">
                  <input
                    type={form._showPassword ? 'text' : 'password'}
                    value={form.verifyCodeConfirm || ''}
                    onChange={e => updateField('verifyCodeConfirm', e.target.value)}
                    placeholder="Re-enter password"
                    maxLength={20}
                    className="w-full h-10 px-3 pr-9 border border-border rounded-md text-sm"
                    autoComplete="new-password"
                  />
                  <button type="button" tabIndex={-1} onClick={() => setForm(f => ({ ...f, _showPassword: !f._showPassword }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#999] hover:text-[#666]">
                    <span className="material-symbols-outlined text-[18px]">{form._showPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
                {form.verifyCode && form.verifyCodeConfirm && form.verifyCode !== form.verifyCodeConfirm && (
                  <p className="text-xs text-[#CC3333] mt-1">Passwords do not match.</p>
                )}
              </FormField>
              {isEdit && (
                <div className="p-3 bg-[#F5F5F5] rounded-lg text-sm text-[#666]">
                  Leave blank to keep existing credentials unchanged.
                </div>
              )}

              <FormField label="Password Never Expires" hint="Override the system-wide password expiration policy for this user. Use only for service accounts or when required by operational policy. VistA field 9.5.">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.verifyCodeNeverExpires || false}
                    onChange={e => updateField('verifyCodeNeverExpires', e.target.checked)}
                    className="w-4 h-4 rounded border-border" />
                  <span className="text-sm">Exempt from password expiration</span>
                </label>
              </FormField>
              {form.primaryRole === 'system-admin' && (
                <FormField label="FileMan Access Code" hint="Controls FileMan database access level. '@' = unrestricted (full read/write to all VistA files). Leave empty for no direct FileMan access. This is a SECURITY-SENSITIVE setting.">
                  <select value={form.filemanAccess || ''} onChange={e => updateField('filemanAccess', e.target.value)} className="form-input">
                    <option value="">None (no FileMan access)</option>
                    <option value="@">@ (Unrestricted)</option>
                  </select>
                </FormField>
              )}
            </div>
          )}

          {/* STEP 2: Role, Location & Department */}
          {step.id === 'role-location' && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-text mb-2">Role & Work Type</h2>
              <p className="text-sm text-[#666] mb-4">
                Select the role that best matches this person's job function.
                The role determines which security keys are pre-selected in the Permissions step.
              </p>
              <FormField label="Primary Role" required error={validationErrors.primaryRole}
                hint="Each role determines default system access and initial permission bundle.">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SYSTEM_ROLES.map(role => (
                    <button key={role.id}
                      onClick={() => {
                        updateField('primaryRole', role.id);
                        // Pre-populate permissions from the role's key bundle
                        const roleKeys = role.permissions.map(p => p.key);
                        updateField('assignedPermissions', roleKeys);
                        updateField('removedDefaults', []);
                        // Set provider flag if role has PROVIDER key
                        if (roleKeys.includes('PROVIDER')) {
                          updateField('isProvider', true);
                        } else if (!['pharmacist', 'controlled-substance-pharmacist'].includes(role.id)) {
                          updateField('isProvider', false);
                        }
                      }}
                      className={`text-left p-3 rounded-md border transition-colors ${
                        form.primaryRole === role.id
                          ? 'border-steel bg-[#E8EEF5]'
                          : 'border-border hover:border-steel/50'
                      }`}
                    >
                      <div className="font-medium text-sm text-text">{role.name}</div>
                      <div className="text-xs text-text-secondary mt-0.5">{role.description}</div>
                      <div className="text-[10px] text-[#999] mt-1">{role.permissions.length} permissions</div>
                    </button>
                  ))}
                </div>
              </FormField>
              <FormField label="Department" required error={validationErrors.department} hint="Type to search or enter a custom department.">
                <input type="text" list="department-list" value={form.department} onChange={e => updateField('department', e.target.value)}
                  placeholder="Select or type department..." className="form-input" />
                <datalist id="department-list">
                  {liveDepartments.map(d => <option key={d} value={d} />)}
                </datalist>
              </FormField>
              <label className="flex items-center gap-3 p-3 bg-surface-alt rounded-lg cursor-pointer">
                <input type="checkbox" checked={form.isProvider} onChange={e => updateField('isProvider', e.target.checked)}
                  className="w-4 h-4 rounded border-border text-steel" />
                <div>
                  <div className="text-sm font-medium text-text">This staff member is a licensed provider</div>
                  <div className="text-xs text-text-secondary">Enables provider configuration: NPI, DEA, prescribing authority, provider type</div>
                </div>
              </label>
            </div>
          )}

          {/* Location section (part of Role & Location step) */}
          {step.id === 'role-location' && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-text mb-4">Location Assignment</h2>
              <p className="text-sm text-text-secondary mb-4">
                Assign this staff member to one or more sites. The primary site determines the default sign-in location.
                Multi-site staff can switch context via the system bar.
              </p>
              <FormField label="Primary Site" required error={validationErrors.primaryLocation} hint="Where this person signs in by default">
                <select value={form.primaryLocation} onChange={e => updateField('primaryLocation', e.target.value)} className="form-input">
                  <option value="">Select primary site...</option>
                  {liveSites.map(loc => (
                    <option key={loc.value} value={loc.value}>{loc.label} ({loc.type})</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Additional Sites" hint="Staff can work across multiple sites — select all that apply">
                <div className="space-y-2">
                  {liveSites.filter(loc => loc.value !== form.primaryLocation).map(loc => (
                    <label key={loc.value} className="flex items-center gap-3 p-2 rounded-md hover:bg-surface-alt text-sm">
                      <input type="checkbox"
                        checked={form.additionalLocations.includes(loc.value)}
                        onChange={e => {
                          const next = e.target.checked
                            ? [...form.additionalLocations, loc.value]
                            : form.additionalLocations.filter(v => v !== loc.value);
                          updateField('additionalLocations', next);
                        }}
                        className="w-4 h-4 rounded border-border" />
                      <div>
                        <div className="font-medium text-text">{loc.label}</div>
                        <div className="text-xs text-text-secondary">{loc.type}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </FormField>
              {liveMailGroups.length > 0 && (
                <FormField label="Mail Groups" hint="Add this user to MailMan distribution groups. They will receive system notifications sent to these groups. Common groups: IRM, After-Hours Support.">
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {liveMailGroups.map(g => (
                      <label key={g.ien} className="flex items-center gap-3 p-2 rounded-md hover:bg-surface-alt text-sm">
                        <input type="checkbox"
                          checked={(form.mailGroups || []).includes(g.ien)}
                          onChange={e => {
                            const next = e.target.checked
                              ? [...(form.mailGroups || []), g.ien]
                              : (form.mailGroups || []).filter(v => v !== g.ien);
                            updateField('mailGroups', next);
                          }}
                          className="w-4 h-4 rounded border-border" />
                        <div className="flex-1">
                          <span className="font-medium text-text">{g.name}</span>
                          {g.description && <p className="text-xs text-[#666] mt-0.5">{g.description}</p>}
                        </div>
                      </label>
                    ))}
                  </div>
                </FormField>
              )}
            </div>
          )}

          {/* STEP 3: Provider Configuration (conditional) */}
          {step.id === 'provider' && showProviderStep && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-text mb-4">Provider Configuration</h2>
              <CautionBanner>
                Provider fields determine prescribing authority and scope of practice.
                Incorrect configuration can allow a user to exceed their professional scope.
                Verify credentials before enabling medication or order-writing authority.
              </CautionBanner>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Provider Type" required error={validationErrors.providerType}
                  hint="Professional classification. Determines scope of practice and permissible actions.">
                  <select value={form.providerType} onChange={e => updateField('providerType', e.target.value)} className="form-input">
                    <option value="">Select provider type...</option>
                    {PROVIDER_TYPES.map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
                  </select>
                </FormField>
                <FormField label="NPI" error={validationErrors.npi} hint="10-digit National Provider Identifier. Required for billing.">
                  <input type="text" value={form.npi} onChange={e => updateField('npi', e.target.value)}
                    onBlur={() => {
                      if (form.npi && !/^\d{10}$/.test(form.npi)) {
                        setValidationErrors(e => ({ ...e, npi: 'NPI must be exactly 10 digits' }));
                      } else if (form.npi) {
                        const prefixed = '80840' + form.npi;
                        let sum = 0;
                        for (let i = prefixed.length - 1, alt = false; i >= 0; i--, alt = !alt) {
                          let n = parseInt(prefixed[i], 10);
                          if (alt) { n *= 2; if (n > 9) n -= 9; }
                          sum += n;
                        }
                        if (sum % 10 !== 0) setValidationErrors(e => ({ ...e, npi: 'NPI check digit is invalid' }));
                        else setValidationErrors(e => { const { npi, ...rest } = e; return rest; });
                      } else { setValidationErrors(e => { const { npi, ...rest } = e; return rest; }); }
                    }}
                    placeholder="1234567890" maxLength={10} className="form-input font-mono" />
                </FormField>
                <FormField label="DEA Number" error={validationErrors.dea} hint="Required for controlled substance prescribing">
                  <input type="text" value={form.dea} onChange={e => updateField('dea', e.target.value)}
                    onBlur={() => {
                      if (form.dea && !/^[A-Za-z]{2}\d{7}$/.test(form.dea)) {
                        setValidationErrors(e => ({ ...e, dea: 'DEA must be 2 letters followed by 7 digits' }));
                      } else if (form.dea) {
                        const digits = form.dea.slice(2);
                        const odd = parseInt(digits[0]) + parseInt(digits[2]) + parseInt(digits[4]);
                        const even = parseInt(digits[1]) + parseInt(digits[3]) + parseInt(digits[5]);
                        if ((odd + even * 2) % 10 !== parseInt(digits[6]))
                          setValidationErrors(e => ({ ...e, dea: 'DEA check digit is invalid' }));
                        else setValidationErrors(e => { const { dea, ...rest } = e; return rest; });
                      } else { setValidationErrors(e => { const { dea, ...rest } = e; return rest; }); }
                    }}
                    placeholder="AB1234567" className="form-input font-mono" />
                </FormField>
                <FormField label="DEA Expiration Date">
                  <input type="date" value={form.deaExpiration} onChange={e => updateField('deaExpiration', e.target.value)} className="form-input" />
                </FormField>
              </div>
              <FormField label="Restrict Patient Selection" hint="When enabled, this user can only access patients matching specific criteria. Used for research accounts or limited-scope staff. VistA File #200 field 101.01.">
                <select value={form.restrictPatient || ''} onChange={e => updateField('restrictPatient', e.target.value)} className="form-input">
                  <option value="">No restriction</option>
                  <option value="YES">Restricted</option>
                </select>
              </FormField>
              <label className="flex items-center gap-3 p-3 bg-surface-alt rounded-lg cursor-pointer">
                <input type="checkbox" checked={form.authorizedToWriteMeds}
                  onChange={e => updateField('authorizedToWriteMeds', e.target.checked)}
                  className="w-4 h-4 rounded border-border text-steel" />
                <div>
                  <div className="text-sm font-medium text-text">Authorized to write medication orders</div>
                  <div className="text-xs text-text-secondary">Must be enabled for this provider to prescribe. Maps to pharmacy authorization field.</div>
                </div>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-3 p-3 bg-[#F5F8FB] rounded-lg cursor-pointer">
                  <input type="checkbox" checked={form.requiresCosign || false}
                    onChange={e => updateField('requiresCosign', e.target.checked)}
                    className="w-4 h-4 rounded border-[#E2E4E8]" />
                  <div>
                    <div className="text-[13px] font-medium text-[#222]">Requires cosignature (trainee)</div>
                    <div className="text-[11px] text-[#666]">Resident/student orders require attending co-signature</div>
                  </div>
                </label>
                {form.requiresCosign && (
                  <FormField label="Cosigner (Attending)" hint="The supervising provider who co-signs this trainee's orders. Search active providers by name.">
                    <div className="relative">
                      <input type="text" value={form.cosigner || ''}
                        onChange={e => { updateField('cosigner', e.target.value); updateField('cosignerDuz', ''); searchCosignerProviders(e.target.value); }}
                        onFocus={() => { if (form.cosigner?.length >= 2) searchCosignerProviders(form.cosigner); }}
                        onBlur={() => setTimeout(() => setCosignerSuggestions([]), 200)}
                        role="combobox"
                        aria-expanded={cosignerSuggestions.length > 0}
                        aria-autocomplete="list"
                        aria-controls="cosigner-listbox"
                        placeholder="Type provider name to search..." className="form-input" />
                      {cosignerSearching && <span className="absolute right-2 top-2 text-xs text-text-muted" aria-live="polite">Searching...</span>}
                      {cosignerSuggestions.length > 0 && (
                        <ul id="cosigner-listbox" role="listbox" className="absolute z-50 w-full bg-white border border-[#E2E4E8] rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
                          {cosignerSuggestions.map(s => (
                            <li key={s.duz} role="option"
                              className="px-3 py-2 text-sm hover:bg-[#E8F0FE] cursor-pointer"
                              onMouseDown={() => { updateField('cosigner', s.name); updateField('cosignerDuz', s.duz); setCosignerSuggestions([]); }}>
                              <span className="font-medium">{s.name}</span>
                              <span className="text-[#999] ml-2 text-xs">DUZ {s.duz}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </FormField>
                )}
              </div>
              {form.dea && (
                <FormField label="Controlled Substance Schedules" hint="Which DEA schedules can this provider prescribe?">
                  <div className="flex gap-3 flex-wrap">
                    {['II', 'IIN', 'III', 'IIIN', 'IV', 'V'].map(sched => (
                      <label key={sched} className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-border rounded-md hover:bg-surface-alt cursor-pointer">
                        <input type="checkbox"
                          checked={form.controlledSchedules.includes(sched)}
                          onChange={e => {
                            const next = e.target.checked
                              ? [...form.controlledSchedules, sched]
                              : form.controlledSchedules.filter(s => s !== sched);
                            updateField('controlledSchedules', next);
                          }}
                          className="w-4 h-4 rounded border-border" />
                        Schedule {sched}
                      </label>
                    ))}
                  </div>
                </FormField>
              )}
            </div>
          )}

          {/* E-Signature (shown during edit in review step) */}
          {step.id === 'review' && isEdit && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-text mb-4">E-Signature Configuration</h2>
              <p className="text-sm text-text-secondary mb-4">
                Electronic signatures are required for signing clinical orders and notes.
                {isEdit
                  ? ' Administrators can view status and clear a signature, but cannot set it — the staff member must set their own on sign-in.'
                  : ' After account creation, this staff member will be prompted to set their electronic signature on first sign-in.'}
              </p>

              {isEdit ? (
              <div className="bg-white border border-border rounded-lg p-5">
                <h3 className="text-sm font-semibold text-text mb-3">Current Status</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">E-Signature</div>
                    <div className="mt-1 flex items-center gap-2">
                      {esigStatus.hasCode ? (
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold bg-[#E8F5E9] text-[#2E7D32] uppercase">Set</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold bg-[#FFF3E0] text-[#E6A817] uppercase">Not Set</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Signature Block Name</div>
                    <div className="text-sm text-text mt-1">{esigStatus.sigBlockName || '—'}</div>
                  </div>
                </div>
              </div>
              ) : (
              <div className="bg-white border border-border rounded-lg p-5">
                <h3 className="text-sm font-semibold text-text mb-3">E-Signature Setup</h3>
                <p className="text-xs text-text-secondary mb-3">
                  This provider will be prompted to create their electronic signature on first sign-in.
                  You can pre-configure the signature block name below.
                </p>
                <div className="flex items-center gap-3">
                  <input type="text" value={form.sigBlockName || ''} onChange={e => updateField('sigBlockName', e.target.value)}
                    placeholder="LASTNAME, FIRSTNAME CREDENTIALS" className="form-input flex-1" />
                </div>
              </div>
              )}

              {isEdit && (
              <div className="bg-white border border-border rounded-lg p-5">
                <h3 className="text-sm font-semibold text-text mb-3">Signature Block Name</h3>
                <p className="text-xs text-text-secondary mb-3">
                  The name that appears on signed documents (e.g., "JOHN A. SMITH, MD").
                </p>
                <div className="flex items-center gap-3">
                  <input type="text" value={form.sigBlockName} onChange={e => updateField('sigBlockName', e.target.value)}
                    placeholder="LASTNAME, FIRSTNAME CREDENTIALS" className="form-input flex-1" />
                  <button onClick={handleSaveSigBlock}
                    className="px-4 py-2 text-xs font-medium bg-navy text-white rounded-md hover:bg-steel transition-colors">
                    Save Block Name
                  </button>
                </div>
              </div>
              )}

              {isEdit && esigStatus.hasCode && (
                <div className="bg-white border border-border rounded-lg p-5">
                  <h3 className="text-sm font-semibold text-text mb-2">Clear E-Signature</h3>
                  <p className="text-xs text-text-secondary mb-3">
                    Clearing forces the user to set a new electronic signature on their next sign-in.
                    Use this if a signature has been compromised or needs to be reset.
                  </p>
                  <button disabled={clearingEsig} onClick={handleClearEsig}
                    className="px-4 py-2 text-xs font-medium border border-[#CC3333] text-[#CC3333] rounded-md hover:bg-[#FDE8E8] transition-colors disabled:opacity-50">
                    {clearingEsig ? 'Clearing...' : 'Clear E-Signature'}
                  </button>
                </div>
              )}

              <div className="p-3 bg-info-bg rounded-md text-sm text-info">
                <strong>Note:</strong> The electronic signature code itself cannot be viewed or set by administrators.
                Only the staff member can set their own e-signature code through the system.
              </div>
            </div>
          )}

          {/* Permissions (collapsible section in Review step) */}
          {step.id === 'review' && (
            <details className="border border-border rounded-lg">
              <summary className="p-4 cursor-pointer text-sm font-semibold text-text hover:bg-surface-alt rounded-lg flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">tune</span>
                Permissions & Features — pre-populated from role (expand to adjust)
              </summary>
              <div className="p-4 pt-0">
              {PERMISSION_STARTERS.map(group => {
                // Only render keys that actually exist in the live inventory.
                // Anything missing is hidden, not shown as a disabled checkbox.
                const visibleItems = group.items.filter(item => livePermissions.length === 0 || livePermissionMap.has(item.key));
                if (visibleItems.length === 0) return null;
                return (
                  <div key={group.group} className="border border-border rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-text mb-1">{group.group}</h3>
                    <p className="text-[10px] text-text-muted mb-3">{group.hint}</p>
                    <div className="space-y-2">
                      {visibleItems.map(item => {
                        const isChecked = form.assignedPermissions.includes(item.key) && !form.removedDefaults.includes(item.key);
                        const isDefault = item.roleDefault.includes(form.primaryRole);
                        // Prefer the server-enriched display name and description,
                        // falling back to the hardcoded label only when VistA data
                        // hasn't loaded yet.
                        const live = livePermissionMap.get(item.key);
                        const displayLabel = (live?.displayName && live.displayName !== item.key)
                          ? live.displayName
                          : item.label;
                        const description = live?.description || '';
                        return (
                          <label key={item.key} className="flex items-start gap-2 text-sm text-text-secondary cursor-pointer hover:bg-surface-alt rounded px-1 py-1">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={e => {
                                if (e.target.checked) {
                                  updateField('assignedPermissions', [...form.assignedPermissions, item.key]);
                                  updateField('removedDefaults', form.removedDefaults.filter(k => k !== item.key));
                                } else {
                                  updateField('assignedPermissions', form.assignedPermissions.filter(k => k !== item.key));
                                  if (item.roleDefault.includes(form.primaryRole)) {
                                    updateField('removedDefaults', [...form.removedDefaults, item.key]);
                                  }
                                }
                              }}
                              className="w-4 h-4 rounded border-border mt-0.5 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={isDefault ? 'text-text font-medium' : ''}>{displayLabel}</span>
                                {isDefault && <span className="text-[9px] text-steel bg-[#E8EEF5] px-1.5 py-0.5 rounded-full">role default</span>}
                              </div>
                              {description && (
                                <div className="text-[11px] text-text-muted mt-0.5 line-clamp-2">{description}</div>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Secondary Features — Doc 2: SECONDARY MENU OPTIONS #203 */}
              <div className="border border-border rounded-lg p-4">
                <h3 className="text-sm font-semibold text-text mb-1">Application Features</h3>
                <p className="text-[10px] text-text-muted mb-3">Additional application access assignments</p>
                <div className="space-y-2">
                  {[
                    { key: 'OR CPRS GUI CHART', label: 'Clinical workspace access (required for all clinical users)', required: true },
                    { key: 'PXRM CPRS CONFIG', label: 'Clinical reminders configuration' },
                    { key: 'WEBG WEBVRAM GUI', label: 'Web-based administration interface' },
                  ].map(feat => (
                    <label key={feat.key} className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                      <input type="checkbox"
                        checked={form.secondaryFeatures.includes(feat.key)}
                        disabled={feat.required}
                        onChange={e => {
                          const next = e.target.checked
                            ? [...form.secondaryFeatures, feat.key]
                            : form.secondaryFeatures.filter(k => k !== feat.key);
                          updateField('secondaryFeatures', next);
                        }}
                        className="w-4 h-4 rounded border-border" />
                      {feat.label}
                      {feat.required && <span className="text-[9px] text-danger bg-danger-bg px-1.5 py-0.5 rounded-full">required</span>}
                    </label>
                  ))}
                </div>
              </div>

              {/* Physician-order vs verbal-order mutual exclusion */}
              {(form.assignedPermissions.includes('ORES') && form.assignedPermissions.includes('ORELSE')) && (
                <div className="p-3 bg-[#FDE8E8] rounded-lg text-[13px] text-[#222] flex items-start gap-2 border border-[#CC3333]">
                  <span className="material-symbols-outlined text-[#CC3333] text-[18px] mt-0.5">error</span>
                  <div>
                    <strong className="text-[#CC3333]">Conflicting permissions</strong>
                    <p className="mt-1 text-[#666]">
                      "Write clinical orders" and "Enter verbal / telephone orders" cannot both be assigned to
                      the same staff member. A user cannot both sign their own orders and enter verbal orders
                      that require cosignature. Uncheck one before continuing.
                    </p>
                  </div>
                </div>
              )}
              {form.primaryRole === 'provider' && !form.assignedPermissions.includes('ORELSE') && (
                <div className="p-3 bg-[#E8EEF5] rounded-lg text-[13px] text-[#666] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#2E5984] text-[18px]">info</span>
                  Providers with order-writing authority sign their own orders. Verbal order entry is reserved for nursing staff.
                </div>
              )}
              </div>
            </details>
          )}

          {/* STEP 4: Review and Confirm */}
          {step.id === 'review' && (() => {
            // Build originals map for edit-mode diff highlighting
            const of = isEdit && originalForm ? originalForm : null;
            const identityOrig = of ? {
              'Name': (of.lastName && of.firstName) ? `${of.lastName},${of.firstName}${of.middleInitial ? ' ' + of.middleInitial : ''}` : '—',
              'Job Title': of.title || '—', 'Sex': of.sex === 'M' ? 'Male' : of.sex === 'F' ? 'Female' : of.sex || '—',
              'Email': of.email || '—', 'Employee ID': of.employeeId || '',
            } : null;
            const roleOrig = of ? { 'Department': of.department || '—' } : null;
            const provOrig = of ? { 'NPI': of.npi || '—', 'DEA': of.dea || '—' } : null;
            return (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-text mb-4">Review and Confirm</h2>
              <p className="text-sm text-text-secondary mb-4">
                Verify all details before {isEdit ? 'saving changes to' : 'creating'} this staff member record.
                {isEdit && <span className="ml-1 text-[#E65100] text-xs">(changed fields highlighted)</span>}
              </p>
              <div className="grid grid-cols-2 gap-6">
                <ReviewSection title="Identity" originals={identityOrig} items={[
                  ['Name', (form.lastName && form.firstName) ? `${form.lastName},${form.firstName}${form.middleInitial ? ' ' + form.middleInitial : ''}` : '—'],
                  ['Display Name', form.displayName || '(auto from name)'],
                  ['Job Title', form.title || '—'],
                  ['Sex', form.sex === 'M' ? 'Male' : form.sex === 'F' ? 'Female' : form.sex === 'U' ? 'Unknown' : form.sex || '—'],
                  ['Date of Birth', form.dob || '—'],
                  ['Email', form.email || '—'],
                  ...(form.employeeId ? [['Employee ID', form.employeeId]] : []),
                  ...(form.degree ? [['Degree/Suffix', form.degree]] : []),
                ]} />
                <ReviewSection title="Role & Department" originals={roleOrig} items={[
                  ['Role', SYSTEM_ROLES.find(r => r.id === form.primaryRole)?.name || '—'],
                  ['Department', form.department || '—'],
                  ['Provider', form.isProvider ? 'Yes' : 'No'],
                ]} />
                <ReviewSection title="Location" items={[
                  ['Primary Site', liveSites.find(l => l.value === form.primaryLocation)?.label || '—'],
                  ['Additional Sites', form.additionalLocations.length > 0
                    ? form.additionalLocations.map(v => liveSites.find(l => l.value === v)?.label).filter(Boolean).join(', ')
                    : 'None'],
                ]} />
                <ReviewSection title="Login Credentials" items={[
                  ['Username', form.accessCode ? '✓ Set' : '— Not set'],
                  ['Password', form.verifyCode ? '✓ Set' : '— Not set'],
                  ['Password Never Expires', form.verifyCodeNeverExpires ? 'Yes (override)' : 'Normal policy'],
                  ...(form.filemanAccess ? [['FileMan Access', form.filemanAccess === '@' ? 'Unrestricted (@)' : form.filemanAccess]] : []),
                ]} />
                {(form.isProvider || showProviderStep) && (
                  <ReviewSection title="Provider Configuration" originals={provOrig} items={[
                    ['Provider Type', PROVIDER_TYPES.find(p => p.value === form.providerType)?.label || '—'],
                    ['NPI', form.npi || '—'],
                    ['DEA', form.dea || '—'],
                    ['Medication Authority', form.authorizedToWriteMeds ? 'Yes' : 'No'],
                    ['Controlled Schedules', form.controlledSchedules.join(', ') || 'None'],
                    ...(form.restrictPatient ? [['Patient Selection', 'Restricted']] : []),
                  ]} />
                )}
                {form.language && (
                  <ReviewSection title="Preferences" items={[
                    ['Preferred Language', form.language],
                  ]} />
                )}
                {(form.mailGroups || []).length > 0 && (
                  <ReviewSection title="Mail Groups" items={[
                    ['Groups', (form.mailGroups || []).map(ien => liveMailGroups.find(g => g.ien === ien)?.name || ien).join(', ')],
                  ]} />
                )}
              </div>

              {/* Post-create guidance from Doc 2 */}
              <div className="p-3 bg-info-bg rounded-md text-sm text-info">
                <strong>After creation:</strong> The new staff member should set their own electronic signature on first sign-in.
                {!form.accessCode && ' No login credentials were set — the staff member will not be able to sign in until an administrator sets their access and verify codes.'}
                {form.accessCode && ' Login credentials have been set — communicate them securely to the staff member.'}
              </div>

              {(!form.lastName || !form.firstName || !form.sex || !form.dob || !form.primaryRole || !form.primaryLocation) && (
                <div className="p-3 bg-warning-bg rounded-md text-sm text-warning flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">warning</span>
                  Missing required fields. Go back and complete all required steps before creating.
                </div>
              )}

              {submitError && (
                <div ref={submitErrorRef} role="alert" className="p-3 bg-danger-bg rounded-md text-sm text-danger flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  {submitError}
                </div>
              )}
            </div>
          );})()}
        </div>
        <div className="flex items-center justify-between mt-6">
          <button onClick={() => {
            if (currentStep === 0) { navigate('/admin/staff'); return; }
            let prev = currentStep - 1;
            while (prev >= 0 && !visibleSteps.includes(STEPS[prev])) prev--;
            setCurrentStep(Math.max(0, prev));
          }}
            className="px-4 py-2 text-sm border border-border rounded-md hover:bg-surface-alt">
            {currentStep === 0 ? 'Cancel' : 'Previous'}
          </button>
          <button
            disabled={submitting}
            onClick={() => {
              if (!validateStep(step.id)) return;
              if (currentStep === STEPS.length - 1) {
                handleSubmit();
              } else {
                let next = currentStep + 1;
                while (next < STEPS.length && !visibleSteps.includes(STEPS[next])) next++;
                setCurrentStep(Math.min(STEPS.length - 1, next));
              }
            }}
            className="px-6 py-2 text-sm font-medium bg-navy text-white rounded-md hover:bg-steel transition-colors disabled:opacity-50"
          >
            {submitting ? 'Saving...' : currentStep === STEPS.length - 1 ? (isEdit ? 'Save Changes' : 'Create Staff Member') : 'Continue'}
          </button>
        </div>
        </>
        )}
      </div>

      {showClearEsigDialog && (
        <ConfirmDialog
          title="Clear E-Signature"
          message="Clear this staff member's electronic signature? They will need to set a new one on next sign-in."
          confirmLabel="Clear E-Signature"
          onConfirm={confirmClearEsig}
          onCancel={() => setShowClearEsigDialog(false)}
          destructive
        />
      )}

      {/* Terminal Reference */}
      <details className="mt-6 border border-border rounded-lg bg-surface-alt">
        <summary className="px-4 py-2.5 text-xs text-text-secondary cursor-pointer select-none hover:bg-surface rounded-lg">
          📖 VistA Terminal Reference
        </summary>
        <div className="px-4 pb-3 text-xs text-text-secondary leading-relaxed">
          This page replaces: <strong>EVE → User Management → Add a New User / Edit an Existing User</strong>.
          VistA File: <strong>NEW PERSON (#200)</strong> — 5-page ScreenMan form.
          Terminal also prompts for: Security Keys, Mail Groups, Access Letter.
          These are handled in our Permissions step and post-creation flows.
        </div>
      </details>
    </AppShell>
  );
}

function FormField({ label, required, hint, error, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-text mb-1">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
      {hint && !error && <p className="text-xs text-text-muted mt-1">{hint}</p>}
    </div>
  );
}

function ReviewSection({ title, items, originals }) {
  return (
    <div className="bg-surface-alt rounded-lg p-4">
      <h3 className="text-sm font-semibold text-text mb-3">{title}</h3>
      <dl className="space-y-1.5">
        {items.map(([label, value]) => {
          const changed = originals && originals[label] !== undefined && originals[label] !== value;
          return (
            <div key={label} className={`flex justify-between text-sm${changed ? ' bg-[#FFFDE7] rounded px-1 -mx-1' : ''}`}>
              <dt className="text-text-secondary">{label}</dt>
              <dd className={`font-medium text-right max-w-[60%]${changed ? ' text-[#E65100]' : ' text-text'}`}>
                {value}
                {changed && <span className="ml-1 text-[10px] text-[#E65100]">(changed)</span>}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
