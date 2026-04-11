import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppShell from '../../components/shell/AppShell';
import { CautionBanner, ConfirmDialog } from '../../components/shared/SharedComponents';
import { getSites, getPermissions, getStaffMember, getUserPermissions, createStaffMember, updateStaffMember, getESignatureStatus, setESignature, getStaff, getDepartments, updateCredentials, addMailGroupMember, getMailGroups } from '../../services/adminService';
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
      { key: 'GMRA ALLERGY VERIFY', label: 'Verify patient allergies',                      roleDefault: ['provider'] },
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
  const [currentStep, setCurrentStep] = useState(0);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [liveSites, setLiveSites] = useState([]);
  const [livePermissions, setLivePermissions] = useState([]);
  const [livePermissionMap, setLivePermissionMap] = useState(new Map());
  const [liveDepartments, setLiveDepartments] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [refDataError, setRefDataError] = useState(null);
  const [esigStatus, setEsigStatus] = useState({ hasCode: false, sigBlockName: '' });
  const [clearingEsig, setClearingEsig] = useState(false);
  const [showClearEsigDialog, setShowClearEsigDialog] = useState(false);

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
        const groups = (mailGroupsRes?.data || []).map(g => ({ ien: g.ien, name: g.name })).filter(g => g.ien && g.name);
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
        setForm(f => ({
          ...f,
          fullName: userRes?.data?.name || '',
          email: vg.email || '',
          phone: vg.officePhone || '',
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
        }));
      }).catch((err) => {
        setRefDataError(`Failed to load staff member data: ${err.message || 'unknown error'}`);
      });
    }
  }, [isEdit, userId]);

  const validateStep = (stepId) => {
    const errors = {};
    if (stepId === 'person') {
      if (!form.fullName.trim()) errors.fullName = 'Name is required';
      else if (form.fullName.length < 3) errors.fullName = 'Name must be at least 3 characters';
      else if (form.fullName.length > 35) errors.fullName = 'Name must be 35 characters or fewer';
      else if (!/^[A-Z]+,[A-Z]/.test(form.fullName.trim())) errors.fullName = 'Name must be in LAST,FIRST format (e.g. SMITH,JOHN A)';
      if (!form.sex) errors.sex = 'Gender is required';
      if (!form.dob) errors.dob = 'Date of birth is required';
      // Credentials are required for new users
      if (!isEdit) {
        if (!form.accessCode || !form.accessCode.trim()) errors.accessCode = 'Username (Access Code) is required';
        else if (form.accessCode.length < 3) errors.accessCode = 'Username must be at least 3 characters';
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
      if (form.npi && form.npi.length !== 10) errors.npi = 'NPI must be exactly 10 digits';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const [form, setForm] = useState({
    fullName: '', displayName: '', sex: '', dob: '', govIdLast4: '', email: '', phone: '',
    primaryRole: '', department: '', isProvider: false, sigBlockName: '',
    primaryLocation: '', additionalLocations: [],
    providerType: '', npi: '', dea: '', deaExpiration: '',
    authorizedToWriteMeds: false, controlledSchedules: [],
    assignedPermissions: [],
    secondaryFeatures: ['OR CPRS GUI CHART'],
    removedDefaults: [],
    language: '', verifyCodeNeverExpires: false, filemanAccess: '',
    restrictPatient: '', mailGroups: [],
    accessCode: '', verifyCode: '', verifyCodeConfirm: '',
    requiresCosign: false, cosigner: '',
  });

  const [liveMailGroups, setLiveMailGroups] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [createSuccess, setCreateSuccess] = useState(null);

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
      const payload = {
        name: form.fullName,
        displayName: form.displayName,
        sex: form.sex,
        dob: form.dob,
        govIdLast4: form.govIdLast4,
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
        cosigner: form.cosigner || '',
        language: form.language || '',
        verifyCodeNeverExpires: form.verifyCodeNeverExpires || false,
        filemanAccess: form.filemanAccess || '',
        restrictPatient: form.restrictPatient || '',
      };
      if (isEdit) {
        await updateStaffMember(userId, payload);
        // Update credentials if provided during edit
        if (form.accessCode || form.verifyCode) {
          await updateCredentials(userId, {
            accessCode: form.accessCode || undefined,
            verifyCode: form.verifyCode || undefined,
          });
        }
        navigate('/admin/staff');
      } else {
        // Include credentials in create payload — ZVE USMG ADD accepts them
        if (form.accessCode) payload.accessCode = form.accessCode;
        if (form.verifyCode) payload.verifyCode = form.verifyCode;
        const createRes = await createStaffMember(payload);
        // B6: Assign mail groups after creation
        const newDuz = createRes?.data?.duz || createRes?.data?.ien;
        if (newDuz && form.mailGroups && form.mailGroups.length > 0) {
          for (const groupIen of form.mailGroups) {
            try { await addMailGroupMember(groupIen, newDuz); } catch { /* non-blocking */ }
          }
        }
        // Show success screen with "Create Another" option
        setCreateSuccess({
          name: form.fullName,
          staffId: `S-${newDuz}`,
          department: form.department,
          site: liveSites.find(l => l.value === form.primaryLocation)?.label || '',
          role: SYSTEM_ROLES.find(r => r.id === form.primaryRole)?.name || '',
          permCount: mergedPermissions.length,
          mailGroupCount: (form.mailGroups || []).length,
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
    if (!form.fullName || form.fullName.length < 3) return;
    try {
      const res = await getStaff({ search: form.fullName });
      const matches = (res?.data || []).filter(u => {
        return u.name && u.name.toUpperCase() === form.fullName.toUpperCase();
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
    } catch {
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
              {createSuccess.permCount} permissions assigned
              {createSuccess.mailGroupCount > 0 && ` | Added to ${createSuccess.mailGroupCount} mail group(s)`}
            </div>
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
                    fullName: '', displayName: '', sex: '', dob: '', govIdLast4: '', email: '', phone: '',
                    primaryRole: '', department: preserveDepartment, isProvider: false, sigBlockName: '',
                    primaryLocation: preserveLocation, additionalLocations: [],
                    providerType: '', npi: '', dea: '', deaExpiration: '',
                    authorizedToWriteMeds: false, controlledSchedules: [],
                    assignedPermissions: [],
                    secondaryFeatures: ['OR CPRS GUI CHART'],
                    removedDefaults: [],
                    language: '', verifyCodeNeverExpires: false, filemanAccess: '',
                    restrictPatient: '', mailGroups: preserveMailGroups,
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

        <div className="bg-white border border-border rounded-lg p-6">

          {/* STEP 1: Person & Credentials */}
          {step.id === 'person' && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-text mb-4">Identity Basics</h2>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Full Name" required error={validationErrors.fullName}
                  hint="Format: LAST,FIRST MIDDLE — uppercase, 3-35 characters. Must contain exactly one comma.">
                  <input type="text" value={form.fullName}
                    onChange={e => updateField('fullName', e.target.value.toUpperCase())}
                    onBlur={handleNameBlur}
                    placeholder="SMITH,JANE A" className="form-input" maxLength={35} />
                </FormField>
                <FormField label="Display Name" hint="Optional friendly name for UI display">
                  <input type="text" value={form.displayName} onChange={e => updateField('displayName', e.target.value)}
                    placeholder="Jane Smith" className="form-input" maxLength={50} />
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
                    onChange={e => updateField('dob', e.target.value)}
                    className="form-input" />
                </FormField>
                <FormField label="Government ID (Last 4)" hint="Last 4 digits of SSN or national identifier. Masked for privacy.">
                  <input type="password" value={form.govIdLast4} onChange={e => updateField('govIdLast4', e.target.value)}
                    placeholder="••••" maxLength={4} className="form-input" autoComplete="off" />
                </FormField>
                <FormField label="Email" hint="Used for system notifications and password resets">
                  <input type="email" value={form.email} onChange={e => updateField('email', e.target.value)}
                    placeholder="jane.smith@facility.org" className="form-input" />
                </FormField>
                <FormField label="Phone"
                  hint="Office phone number for this staff member.">
                  <input type="tel" value={form.phone || ''} onChange={e => updateField('phone', e.target.value)}
                    placeholder="(503) 555-0100" className="form-input" />
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
                <div className="p-4 bg-[#FFF3E0] rounded-lg text-sm text-[#E65100] flex items-start gap-2">
                  <span className="material-symbols-outlined text-[16px] mt-0.5">warning</span>
                  <span>These credentials cannot be retrieved later. Note them now and communicate securely to the staff member.</span>
                </div>
              )}
              <FormField label="Username (Access Code)" required={!isEdit}
                error={validationErrors.accessCode}
                hint="The identifier the user enters at the login prompt. 3-20 characters, letters and numbers. Called 'Access Code' in VistA.">
                <input
                  value={form.accessCode || ''}
                  onChange={e => updateField('accessCode', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  placeholder="e.g., JSMITH1234"
                  maxLength={20}
                  className="w-full h-10 px-3 border border-border rounded-md text-sm"
                  autoComplete="off"
                />
              </FormField>
              <FormField label="Password (Verify Code)" required={!isEdit}
                error={validationErrors.verifyCode}
                hint="8-20 characters with mixed case and numbers. Called 'Verify Code' in VistA. Must be changed every 90 days.">
                <input
                  type="password"
                  value={form.verifyCode || ''}
                  onChange={e => updateField('verifyCode', e.target.value)}
                  placeholder="Enter password"
                  maxLength={20}
                  className="w-full h-10 px-3 border border-border rounded-md text-sm"
                  autoComplete="new-password"
                />
              </FormField>
              <FormField label="Confirm Password" required={!isEdit} error={validationErrors.verifyCodeConfirm}>
                <input
                  type="password"
                  value={form.verifyCodeConfirm || ''}
                  onChange={e => updateField('verifyCodeConfirm', e.target.value)}
                  placeholder="Re-enter password"
                  maxLength={20}
                  className="w-full h-10 px-3 border border-border rounded-md text-sm"
                  autoComplete="new-password"
                />
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
                        <span className="font-medium text-text">{g.name}</span>
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
                    placeholder="1234567890" maxLength={10} className="form-input font-mono" />
                </FormField>
                <FormField label="DEA Number" hint="Required for controlled substance prescribing">
                  <input type="text" value={form.dea} onChange={e => updateField('dea', e.target.value)}
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
                  <FormField label="Cosigner (Attending)" hint="The supervising provider who co-signs this trainee's orders. Select from active providers.">
                    <input type="text" value={form.cosigner || ''} onChange={e => updateField('cosigner', e.target.value)}
                      placeholder="Enter attending provider name..." className="form-input" />
                    <p className="text-[10px] text-text-muted mt-1">
                      Enter the provider's name as it appears in the system (LAST,FIRST format).
                    </p>
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
          {step.id === 'review' && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-text mb-4">Review and Confirm</h2>
              <p className="text-sm text-text-secondary mb-4">
                Verify all details before {isEdit ? 'saving changes to' : 'creating'} this staff member record.
              </p>
              <div className="grid grid-cols-2 gap-6">
                <ReviewSection title="Identity" items={[
                  ['Name', form.fullName || '—'],
                  ['Display Name', form.displayName || '(auto from name)'],
                  ['Sex', form.sex === 'M' ? 'Male' : form.sex === 'F' ? 'Female' : form.sex === 'U' ? 'Unknown' : form.sex || '—'],
                  ['Date of Birth', form.dob || '—'],
                  ['Email', form.email || '—'],
                ]} />
                <ReviewSection title="Role & Department" items={[
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
                  ['Username (Access Code)', form.accessCode ? '✓ Set' : '— Not set'],
                  ['Password (Verify Code)', form.verifyCode ? '✓ Set' : '— Not set'],
                  ['Password Never Expires', form.verifyCodeNeverExpires ? 'Yes (override)' : 'Normal policy'],
                  ...(form.filemanAccess ? [['FileMan Access', form.filemanAccess === '@' ? 'Unrestricted (@)' : form.filemanAccess]] : []),
                ]} />
                {(form.isProvider || showProviderStep) && (
                  <ReviewSection title="Provider Configuration" items={[
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

              {(!form.fullName || !form.sex || !form.dob || !form.primaryRole || !form.primaryLocation) && (
                <div className="p-3 bg-warning-bg rounded-md text-sm text-warning flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">warning</span>
                  Missing required fields. Go back and complete all required steps before creating.
                </div>
              )}

              {submitError && (
                <div className="p-3 bg-danger-bg rounded-md text-sm text-danger flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  {submitError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
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

function ReviewSection({ title, items }) {
  return (
    <div className="bg-surface-alt rounded-lg p-4">
      <h3 className="text-sm font-semibold text-text mb-3">{title}</h3>
      <dl className="space-y-1.5">
        {items.map(([label, value]) => (
          <div key={label} className="flex justify-between text-sm">
            <dt className="text-text-secondary">{label}</dt>
            <dd className="font-medium text-text text-right max-w-[60%]">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
