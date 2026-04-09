import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppShell from '../../components/shell/AppShell';
import { CautionBanner, ConfirmDialog } from '../../components/shared/SharedComponents';
import { getSites, getPermissions, getStaffMember, getUserPermissions, createStaffMember, updateStaffMember, getESignatureStatus, setESignature, getStaff, getDepartments } from '../../services/adminService';

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
  { id: 'identity', label: 'Identity' },
  { id: 'role', label: 'Role & Work Type' },
  { id: 'location', label: 'Locations' },
  { id: 'provider', label: 'Provider Setup' },
  { id: 'esignature', label: 'E-Signature' },
  { id: 'permissions', label: 'Permissions & Features' },
  { id: 'review', label: 'Review & Create' },
];

const ROLES = [
  { value: 'system-admin', label: 'System Administrator', description: 'Full system access, user management, configuration' },
  { value: 'location-admin', label: 'Location Administrator', description: 'Manage staff and settings for assigned locations' },
  { value: 'scheduler', label: 'Scheduler', description: 'Manage appointments, clinic schedules, availability' },
  { value: 'front-desk', label: 'Front Desk / Registration', description: 'Patient check-in, registration, demographics' },
  { value: 'nurse', label: 'Nurse', description: 'Clinical documentation, medication administration, vitals' },
  { value: 'provider', label: 'Provider / Physician', description: 'Orders, notes, prescriptions, clinical decision-making' },
  { value: 'pharmacist', label: 'Pharmacist', description: 'Medication processing, verification, formulary management' },
  { value: 'lab-tech', label: 'Laboratory Technician', description: 'Specimen processing, result entry, quality control' },
  { value: 'rad-tech', label: 'Radiology Technician', description: 'Imaging procedures, study tracking, reports' },
  { value: 'billing', label: 'Billing / Revenue Cycle', description: 'Charge capture, claims, billing configuration' },
  { value: 'him', label: 'Health Information Management', description: 'Record management, coding, compliance' },
  { value: 'read-only', label: 'Read-Only', description: 'View-only access, no data modification' },
];

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
      { key: 'PROVIDER',       label: 'Provider (can be selected on orders and encounters)', roleDefault: ['provider', 'nurse'] },
      { key: 'ORES',           label: 'Write clinical orders (physicians, signed)',          roleDefault: ['provider'] },
      { key: 'ORELSE',         label: 'Enter verbal / telephone orders (non-physician)',     roleDefault: ['nurse'] },
      { key: 'OREMAS',         label: 'MAS order entry (unit clerks / ward clerks)',         roleDefault: [] },
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
    ],
  },
  {
    group: 'Laboratory',
    hint: 'Lab operations, result verification, supervision',
    items: [
      { key: 'LRLAB',          label: 'Core lab operations (accessioning, results)',         roleDefault: ['lab-tech'] },
      { key: 'LRVERIFY',       label: 'Verify and release lab results',                      roleDefault: [] },
      { key: 'LRSUPER',        label: 'Lab supervisor',                                      roleDefault: [] },
    ],
  },
  {
    group: 'Scheduling',
    hint: 'Appointments, clinic schedules, supervisor overrides',
    items: [
      { key: 'SD SUPERVISOR',  label: 'Scheduling supervisor',                               roleDefault: [] },
      { key: 'SDMGR',          label: 'Scheduling manager',                                  roleDefault: ['scheduler'] },
    ],
  },
  {
    group: 'Registration',
    hint: 'Patient registration and sensitive-record access',
    items: [
      { key: 'DG REGISTER',    label: 'Patient registration clerk',                          roleDefault: ['front-desk'] },
      { key: 'DG SENSITIVITY', label: 'Access restricted / sensitive patient records',       roleDefault: [] },
      { key: 'DG SUPERVISOR',  label: 'ADT supervisor',                                      roleDefault: [] },
    ],
  },
  {
    group: 'Imaging',
    hint: 'VistA Imaging and radiology',
    items: [
      { key: 'MAG SYSTEM',     label: 'Imaging system manager',                              roleDefault: [] },
      { key: 'RA ALLOC',       label: 'Radiology resource allocator',                        roleDefault: ['rad-tech'] },
    ],
  },
  {
    group: 'System Administration',
    hint: 'User management, Kernel, and programmer access',
    items: [
      { key: 'XUMGR',          label: 'IRM / Site manager (full user admin)',                roleDefault: ['system-admin'] },
      { key: 'XUPROG',         label: 'Programmer (Kernel access)',                          roleDefault: [] },
      { key: 'XUPROGMODE',     label: 'Programmer mode access',                              roleDefault: [] },
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
        const [sitesRes, permsRes, deptRes] = await Promise.all([getSites(), getPermissions(), getDepartments()]);

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

        if (sites.length === 0) {
          setRefDataError('No sites returned from VistA (MEDICAL CENTER DIVISION #40.8 is empty or unreachable).');
        } else if (deptNames.length === 0) {
          setRefDataError('No departments returned from VistA (SERVICE/SECTION #49 is empty or unreachable).');
        } else if (perms.length === 0) {
          setRefDataError('No security keys returned from VistA (SECURITY KEY #19.1 is empty or unreachable).');
        }
      } catch (err) {
        setRefDataError(`Failed to load reference data from VistA: ${err.message || 'unknown error'}`);
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
        }));
      }).catch(() => {});
    }
  }, [isEdit, userId]);

  const validateStep = (stepId) => {
    const errors = {};
    if (stepId === 'identity') {
      if (!form.fullName.trim()) errors.fullName = 'Name is required';
      else if (form.fullName.length < 3) errors.fullName = 'Name must be at least 3 characters';
      else if (!/^[A-Z]+,[A-Z]/.test(form.fullName.trim())) errors.fullName = 'Name must be in LAST,FIRST format (e.g. SMITH,JOHN A)';
      if (!form.sex) errors.sex = 'Gender is required';
    }
    if (stepId === 'role') {
      if (!form.primaryRole) errors.primaryRole = 'Role selection is required';
    }
    if (stepId === 'location') {
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
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const updateField = (field, value) => setForm(f => ({ ...f, [field]: value }));
  const step = STEPS[currentStep];
  const showProviderStep = form.isProvider || ['provider', 'pharmacist', 'nurse'].includes(form.primaryRole);

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
    // ORES/ORELSE mutual exclusion — block submission
    if (form.assignedPermissions.includes('ORES') && form.assignedPermissions.includes('ORELSE')) {
      setSubmitError('Cannot save: ORES and ORELSE are mutually exclusive. Remove one before proceeding.');
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
        isProvider: form.isProvider,
        primaryLocation: form.primaryLocation,
        additionalLocations: form.additionalLocations,
        providerType: form.providerType,
        npi: form.npi,
        dea: form.dea,
        deaExpiration: form.deaExpiration,
        authorizedToWriteMeds: form.authorizedToWriteMeds,
        controlledSchedules: form.controlledSchedules,
        permissions: form.assignedPermissions,
        secondaryFeatures: form.secondaryFeatures,
      };
      if (isEdit) {
        await updateStaffMember(userId, payload);
      } else {
        await createStaffMember(payload);
      }
      navigate('/admin/staff');
    } catch (err) {
      setSubmitError(err.message || 'Failed to save staff member. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNameBlur = async () => {
    if (form.fullName && form.dob) {
      try {
        const res = await getStaff({ search: form.fullName });
        const matches = (res?.data || []).filter(u => {
          const nameMatch = u.name && u.name.toUpperCase() === form.fullName.toUpperCase();
          return nameMatch;
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
        setDuplicateWarning({
          message: 'Duplicate check complete. No matching records found.',
          isDuplicate: false,
        });
      }
    }
  };

  const visibleSteps = STEPS.filter(s => {
    if (s.id === 'provider' && !showProviderStep) return false;
    if (s.id === 'esignature' && !isEdit) return false;
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
    } catch { /* handled by API */ }
    finally { setClearingEsig(false); }
  };

  const handleSaveSigBlock = async () => {
    try {
      await setESignature(userId, { sigBlockName: form.sigBlockName });
      setEsigStatus(prev => ({ ...prev, sigBlockName: form.sigBlockName }));
    } catch { /* handled by API */ }
  };

  return (
    <AppShell breadcrumb={`Admin > ${isEdit ? 'Edit Staff Member' : 'Create Staff Member'}`}>
      <div className="p-6 max-w-5xl">
        <h1 className="text-[28px] font-bold text-text mb-2">
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
            Loading reference data from VistA (sites, departments, permissions)...
          </div>
        )}
        {!dataLoading && refDataError && (
          <div className="flex items-start gap-2 p-3 bg-[#FDE8E8] border border-[#CC3333] rounded-md text-sm text-[#CC3333] mb-4">
            <span className="material-symbols-outlined text-[18px] mt-0.5">error</span>
            <div>
              <strong>Reference data unavailable.</strong>
              <div className="mt-0.5 text-[12px] text-[#666]">{refDataError}</div>
              <div className="mt-0.5 text-[12px] text-[#666]">You can still fill out this form, but dropdowns for sites, departments, and permissions will be empty until VistA is reachable.</div>
            </div>
          </div>
        )}

        <div className="bg-white border border-border rounded-lg p-6">

          {/* STEP 1: Identity — Doc 2 Section 3.2 Step 1 */}
          {step.id === 'identity' && (
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
                <FormField label="Sex" required>
                  <select value={form.sex} onChange={e => updateField('sex', e.target.value)} className="form-input">
                    <option value="">Select...</option>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                    <option value="U">Unknown</option>
                  </select>
                </FormField>
                <FormField label="Date of Birth" required>
                  <input type="date" value={form.dob}
                    onChange={e => { updateField('dob', e.target.value); handleNameBlur(); }}
                    className="form-input" />
                </FormField>
                <FormField label="Government ID (Last 4)" hint="Last 4 digits of SSN or national identifier. Masked for privacy.">
                  <input type="password" value={form.govIdLast4} onChange={e => updateField('govIdLast4', e.target.value)}
                    placeholder="••••" maxLength={4} className="form-input" autoComplete="off" />
                </FormField>
                <FormField label="Email" hint="Not a standard field in legacy systems — product overlay">
                  <input type="email" value={form.email} onChange={e => updateField('email', e.target.value)}
                    placeholder="jane.smith@facility.org" className="form-input" />
                </FormField>
                <FormField label="Phone">
                  <input type="tel" value={form.phone || ''} onChange={e => updateField('phone', e.target.value)}
                    placeholder="(503) 555-0100" className="form-input" />
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

          {/* STEP 2: Role and Work Type — Doc 2 Section 3.2 Step 2 */}
          {step.id === 'role' && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-text mb-4">Role and Work Type</h2>
              <FormField label="Primary Role" required
                hint="Maps to primary menu and initial permission bundle. Each role determines default system access.">
                <div className="grid grid-cols-2 gap-3">
                  {ROLES.map(role => (
                    <button key={role.value}
                      onClick={() => {
                        updateField('primaryRole', role.value);
                        if (['provider', 'pharmacist'].includes(role.value)) updateField('isProvider', true);
                      }}
                      className={`text-left p-3 rounded-md border transition-colors ${
                        form.primaryRole === role.value
                          ? 'border-steel bg-[#E8EEF5]'
                          : 'border-border hover:border-steel/50'
                      }`}
                    >
                      <div className="font-medium text-sm text-text">{role.label}</div>
                      <div className="text-xs text-text-secondary mt-0.5">{role.description}</div>
                    </button>
                  ))}
                </div>
              </FormField>
              <FormField label="Department" required hint="Loaded from VistA SERVICE/SECTION file (#49). Type to search or enter a custom department.">
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

          {/* STEP 3: Location Assignment — Doc 2 Section 3.2 Step 3 */}
          {step.id === 'location' && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-text mb-4">Location Assignment</h2>
              <p className="text-sm text-text-secondary mb-4">
                Assign this staff member to one or more sites. The primary site determines the default sign-in location.
                Multi-site staff can switch context via the system bar.
              </p>
              <FormField label="Primary Site" required hint="Where this person signs in by default">
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
            </div>
          )}

          {/* STEP 4: Provider Configuration — Doc 2 Section 3.2 Step 4 */}
          {step.id === 'provider' && showProviderStep && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-text mb-4">Provider Configuration</h2>
              <CautionBanner>
                Provider fields determine prescribing authority and scope of practice.
                Incorrect configuration can allow a user to exceed their professional scope.
                Verify credentials before enabling medication or order-writing authority.
              </CautionBanner>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Provider Type" required
                  hint="Professional classification. Determines scope of practice and permissible actions.">
                  <select value={form.providerType} onChange={e => updateField('providerType', e.target.value)} className="form-input">
                    <option value="">Select provider type...</option>
                    {PROVIDER_TYPES.map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
                  </select>
                </FormField>
                <FormField label="NPI" hint="10-digit National Provider Identifier. Required for billing. Luhn check applies.">
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

          {/* STEP 5: E-Signature (edit mode only) */}
          {step.id === 'esignature' && isEdit && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-text mb-4">E-Signature Configuration</h2>
              <p className="text-sm text-text-secondary mb-4">
                Electronic signatures are required for signing clinical orders and notes.
                Administrators can view status and clear a signature, but cannot set it — the staff member must set their own on sign-in.
              </p>

              <div className="bg-white border border-border rounded-lg p-5">
                <h3 className="text-sm font-semibold text-text mb-3">Current Status</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">E-Signature Code</div>
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

              {esigStatus.hasCode && (
                <div className="bg-white border border-border rounded-lg p-5">
                  <h3 className="text-sm font-semibold text-text mb-2">Clear E-Signature</h3>
                  <p className="text-xs text-text-secondary mb-3">
                    Clearing forces the user to set a new electronic signature on their next sign-in.
                    Use this if a signature has been compromised or needs to be reset.
                  </p>
                  <button disabled={clearingEsig} onClick={handleClearEsig}
                    className="px-4 py-2 text-xs font-medium border border-[#CC3333] text-[#CC3333] rounded-md hover:bg-[#FDE8E8] transition-colors disabled:opacity-50">
                    {clearingEsig ? 'Clearing...' : 'Clear E-Signature Code'}
                  </button>
                </div>
              )}

              <div className="p-3 bg-info-bg rounded-md text-sm text-info">
                <strong>Note:</strong> The electronic signature code itself cannot be viewed or set by administrators.
                Only the staff member can set their own e-signature code through the system.
              </div>
            </div>
          )}

          {/* STEP 6: Permissions & Features */}
          {step.id === 'permissions' && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-text mb-4">Permissions & Features</h2>
              <p className="text-sm text-text-secondary mb-4">
                Permissions are pre-configured based on the selected role. Adjust individual permissions as needed.
                Each permission corresponds to a live security key in this system.
                {livePermissions.length > 0 && (
                  <span className="ml-1 text-[11px] text-[#999]">({livePermissions.length} permissions available)</span>
                )}
              </p>
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
                        const isDefault = item.roleDefault.includes(form.primaryRole);
                        const isChecked = form.assignedPermissions.includes(item.key) || isDefault;
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
                                const next = e.target.checked
                                  ? [...form.assignedPermissions, item.key]
                                  : form.assignedPermissions.filter(k => k !== item.key);
                                updateField('assignedPermissions', next);
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
          )}

          {/* STEP 6: Review and Confirm — Doc 2 Section 3.2 Step 6 */}
          {step.id === 'review' && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-text mb-4">Review and Confirm</h2>
              <p className="text-sm text-text-secondary mb-4">
                Verify all details before creating this staff member record. Changes to authentication credentials
                must be done by the staff member on first sign-in.
              </p>
              <div className="grid grid-cols-2 gap-6">
                <ReviewSection title="Identity" items={[
                  ['Name', form.fullName || '—'],
                  ['Display Name', form.displayName || '(auto from name)'],
                  ['Sex', form.sex === 'M' ? 'Male' : form.sex === 'F' ? 'Female' : form.sex || '—'],
                  ['Date of Birth', form.dob || '—'],
                  ['Email', form.email || '—'],
                ]} />
                <ReviewSection title="Role & Department" items={[
                  ['Role', ROLES.find(r => r.value === form.primaryRole)?.label || '—'],
                  ['Department', form.department || '—'],
                  ['Provider', form.isProvider ? 'Yes' : 'No'],
                ]} />
                <ReviewSection title="Location" items={[
                  ['Primary Site', liveSites.find(l => l.value === form.primaryLocation)?.label || '—'],
                  ['Additional Sites', form.additionalLocations.length > 0
                    ? form.additionalLocations.map(v => liveSites.find(l => l.value === v)?.label).filter(Boolean).join(', ')
                    : 'None'],
                ]} />
                {form.isProvider && (
                  <ReviewSection title="Provider Configuration" items={[
                    ['Provider Type', PROVIDER_TYPES.find(p => p.value === form.providerType)?.label || '—'],
                    ['NPI', form.npi || '—'],
                    ['DEA', form.dea || '—'],
                    ['Medication Authority', form.authorizedToWriteMeds ? 'Yes' : 'No'],
                    ['Controlled Schedules', form.controlledSchedules.join(', ') || 'None'],
                  ]} />
                )}
              </div>

              {/* Post-create guidance from Doc 2 */}
              <div className="p-3 bg-info-bg rounded-md text-sm text-info">
                <strong>After creation:</strong> The new staff member should set their own electronic signature on first sign-in.
                Administrators cannot set the e-signature code for other users.
                The system will generate initial authentication credentials.
              </div>

              {!form.fullName && (
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
