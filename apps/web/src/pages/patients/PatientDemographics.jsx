import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppShell from '../../components/shell/AppShell';
import PatientBanner from '../../components/shared/PatientBanner';
import { usePatient } from '../../components/shared/PatientContext';
import {
  getPatient,
  registerPatient,
  updatePatient,
  searchPatients,
  getDivisions,
} from '../../services/patientService';
import { getSession } from '../../services/adminService';

/* ═══════════════════════════════════════════════════════════════════════════
 *  CONSTANTS — reference lists per spec
 * ═══════════════════════════════════════════════════════════════════════════ */

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY','AS','GU','MP','PR','VI',
];

const SUFFIX_OPTIONS = ['Jr', 'Sr', 'II', 'III', 'IV'];
const SEX_AT_BIRTH = ['Male', 'Female'];
const GENDER_IDENTITY_OPTIONS = [
  'Male', 'Female', 'Transgender Man', 'Transgender Woman',
  'Non-Binary', 'Other', 'Choose not to disclose',
];
const MARITAL_OPTIONS = ['Single', 'Married', 'Divorced', 'Widowed', 'Separated', 'Unknown'];
const RELIGION_OPTIONS = [
  'Adventist','AME','Assemblies of God','Baptist','Brethren','Buddhist',
  'Catholic','Christian','Church of Christ','Church of God','Congregational',
  'Disciples of Christ','Eastern Orthodox','Episcopal','Evangelical',
  'Friends (Quaker)','Full Gospel','Hindu','Islam','Jehovah\'s Witness',
  'Jewish','LDS','Lutheran','Mennonite','Methodist','Nazarene','None',
  'Other','Pentecostal','Presbyterian','Protestant','Roman Catholic',
  'Salvation Army','Seventh Day Adventist','Sikh','Unitarian','Unknown',
];
const RACE_OPTIONS = [
  'American Indian or Alaska Native',
  'Asian',
  'Black or African American',
  'Native Hawaiian or Other Pacific Islander',
  'White',
];
const ETHNICITY_OPTIONS = ['Hispanic or Latino', 'Not Hispanic or Latino', 'Unknown'];
const RELATIONSHIP_OPTIONS = ['Self', 'Spouse', 'Parent', 'Child', 'Sibling', 'Grandparent', 'Other'];
/** VA enrollment / demographics audit: employment & eligibility dropdown */
const VA_EMPLOYMENT_ELIGIBILITY = ['Employed', 'Retired', 'Unemployed', 'Student', 'Self-Employed', 'Unknown'];
const ENROLLMENT_PRIORITY_GROUPS = ['1', '2', '3', '4', '5', '6', '7', '8'];
/** File #2 .3211 — Branch of Service */
const BRANCHES_OF_SERVICE = ['Army', 'Navy', 'Air Force', 'Marines', 'Coast Guard', 'Space Force', 'Other'];
/** File #2 .3212 — Period of Service */
const PERIOD_OF_SERVICE = ['WWI', 'WWII', 'Korean', 'Vietnam', 'Persian Gulf', 'OEF/OIF/OND', 'Other'];
const EXPOSURE_OPTIONS = ['Agent Orange', 'Ionizing Radiation', 'SW Asia', 'Camp Lejeune', 'Burn Pits/PACT Act', 'Other'];
const PATIENT_CATEGORIES = ['Service Connected', 'Non-Service Connected', 'Compensated', 'Pension', 'Insured', 'Private Pay', 'Other'];
const COUNTRY_OPTIONS = ['United States', 'Canada', 'Mexico', 'United Kingdom', 'Germany', 'Japan', 'South Korea', 'Philippines', 'Other'];

/** S23.13: sessionStorage draft — same pattern as StaffForm wizard */
const DEMO_DRAFT_PREFIX = 've-patient-demo-draft:';
const DEMO_DRAFT_MAX_AGE_MS = 2 * 60 * 60 * 1000;

/* ═══════════════════════════════════════════════════════════════════════════
 *  STYLING
 * ═══════════════════════════════════════════════════════════════════════════ */

const inputCls = 'h-10 px-3 border border-[#E2E4E8] rounded-md text-sm text-[#333] bg-white focus:outline-none focus:border-[#2E5984] focus:ring-1 focus:ring-[#2E5984] transition-colors';
const selectCls = inputCls;
const toggleCls = 'relative inline-flex h-6 w-11 items-center rounded-full cursor-pointer transition-colors';

/* ═══════════════════════════════════════════════════════════════════════════
 *  BLANK FORM — every field in the spec
 * ═══════════════════════════════════════════════════════════════════════════ */

const BLANK = {
  lastName: '', firstName: '', middleName: '', suffix: '',
  dob: '', sexAtBirth: '', ssn: '',
  genderIdentity: '', preferredName: '', veteranStatus: false,

  addressLine1: '', addressLine2: '', city: '', state: '', postalCode: '',
  county: '', country: 'United States',
  phoneHome: '', phoneWork: '', phoneMobile: '', email: '',
  maritalStatus: '', religion: '', race: [], ethnicity: '',
  preferredLanguage: '', interpreterNeeded: false,
  countryOfBirth: '',
  motherMaidenName: '',

  ecName: '', ecPhone: '', ecRelationship: '',
  nokName: '', nokPhone: '', nokAddress: '', nokRelationship: '',

  empStatus: '', empName: '', empPhone: '',
  enrollmentPriorityGroup: '',

  branch: '',
  serviceEntryDate: '',
  serviceSeparationDate: '',
  periodOfService: '',
  serviceConnected: false,
  claimNumber: '',
  scPercent: '', combatStatus: '', purpleHeart: false, pow: false, exposures: [],

  registrationFacility: '', patientCategory: '',
  advanceDirectiveOnFile: false,
};

/* ═══════════════════════════════════════════════════════════════════════════
 *  HELPER COMPONENTS
 * ═══════════════════════════════════════════════════════════════════════════ */

function Field({ label, required, error, children, changed }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[12px] font-medium text-[#555]">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className={changed ? 'rounded-md ring-2 ring-yellow-300 bg-yellow-50' : ''}>
        {children}
      </div>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </div>
  );
}

function AccordionSection({ id, title, icon, expanded, onToggle, children, hasError }) {
  return (
    <div className="border border-[#E2E4E8] rounded-lg mb-3 overflow-hidden">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className={`w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors ${
          expanded ? 'bg-[#F0F4F8]' : 'bg-white hover:bg-[#FAFBFC]'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-[20px] text-[#2E5984]">{icon}</span>
          <span className="text-[15px] font-semibold text-[#1A1A2E]">{title}</span>
          {hasError && (
            <span className="ml-2 flex items-center gap-1 text-[11px] text-red-600 font-medium">
              <span className="material-symbols-outlined text-[14px]">error</span>
              Has errors
            </span>
          )}
        </div>
        <span className={`material-symbols-outlined text-[20px] text-[#888] transition-transform ${expanded ? 'rotate-180' : ''}`}>
          expand_more
        </span>
      </button>
      {expanded && <div className="px-5 py-4 border-t border-[#E2E4E8]">{children}</div>}
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`${toggleCls} ${checked ? 'bg-[#2E5984]' : 'bg-gray-300'}`}
      >
        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
      {label && <span className="text-sm text-[#555]">{label}</span>}
    </label>
  );
}

function IdentityWarningBanner({ message }) {
  return (
    <div className="mb-3 px-4 py-2.5 bg-amber-50 border border-amber-300 rounded-md flex items-start gap-2">
      <span className="material-symbols-outlined text-[18px] text-amber-600 mt-0.5">warning</span>
      <span className="text-[13px] text-amber-800">{message}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  SSN MASKING UTILITY
 * ═══════════════════════════════════════════════════════════════════════════ */

function formatSSN(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 9);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

function maskSSN(ssn) {
  const digits = ssn.replace(/\D/g, '');
  if (digits.length < 5) return ssn;
  return `***-**-${digits.slice(-4)}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  MAIN COMPONENT
 * ═══════════════════════════════════════════════════════════════════════════ */

export default function PatientDemographics() {
  const { patientId } = useParams();
  useEffect(() => { document.title = patientId ? 'Edit Patient — VistA Evolved' : 'Register Patient — VistA Evolved'; }, [patientId]);
  const navigate = useNavigate();
  const { setPatient } = usePatient();
  const isEdit = !!patientId;

  const [form, setForm] = useState({ ...BLANK });
  const [originalForm, setOriginalForm] = useState({ ...BLANK });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(null);
  const [divisions, setDivisions] = useState([]);
  const [expandedSections, setExpandedSections] = useState(['identity']);
  const [ssnVisible, setSsnVisible] = useState(false);
  const [identityWarnings, setIdentityWarnings] = useState([]);
  const [isVA, setIsVA] = useState(true);

  // Duplicate check state (register mode)
  const [dupSearchDone, setDupSearchDone] = useState(false);
  const [dupResults, setDupResults] = useState([]);
  const [dupChecking, setDupChecking] = useState(false);
  const [dupDismissed, setDupDismissed] = useState(false);

  const savedDfnRef = useRef(null);

  const draftStorageKey = useMemo(() => `${DEMO_DRAFT_PREFIX}${patientId || 'new'}`, [patientId]);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(originalForm),
    [form, originalForm],
  );

  /* S23.13: Auto-save draft every 1s while there are unsaved changes */
  useEffect(() => {
    if (saveSuccess || loading) return;
    if (!isDirty) return;
    const id = setInterval(() => {
      try {
        sessionStorage.setItem(
          draftStorageKey,
          JSON.stringify({ form, ts: Date.now(), patientId: patientId || null }),
        );
      } catch (_storageErr) {
        /* storage full or disabled */
      }
    }, 1000);
    return () => clearInterval(id);
  }, [isDirty, form, saveSuccess, loading, draftStorageKey, patientId]);

  /* Restore register draft on mount */
  useEffect(() => {
    if (isEdit) return;
    try {
      const raw = sessionStorage.getItem(draftStorageKey);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (Date.now() - d.ts > DEMO_DRAFT_MAX_AGE_MS) {
        sessionStorage.removeItem(draftStorageKey);
        return;
      }
      if (d.form && typeof d.form === 'object') {
        setForm((f) => ({ ...f, ...d.form }));
      }
    } catch (_restoreErr) {
      /* corrupt or missing draft */
    }
  }, [isEdit, draftStorageKey]);

  const isChanged = useCallback((field) => {
    if (!isEdit) return false;
    const orig = originalForm[field];
    const curr = form[field];
    if (Array.isArray(orig) && Array.isArray(curr)) {
      return JSON.stringify(orig) !== JSON.stringify(curr);
    }
    return orig !== curr;
  }, [isEdit, originalForm, form]);

  /* ── Load divisions on mount ── */
  useEffect(() => {
    (async () => {
      try {
        const res = await getDivisions();
        if (res.ok && Array.isArray(res.data)) {
          setDivisions(res.data);
        }
      } catch (err) {
        setDivisions([]);
      }
      try {
        const sess = await getSession();
        if (sess?.facilityType && sess.facilityType !== 'va') setIsVA(false);
      } catch (err) { /* non-fatal */ }
    })();
  }, []);

  /* ── Load patient in edit mode ── */
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      setLoading(true);
      try {
        const res = await getPatient(patientId);
        if (res.ok && res.data) {
          const d = res.data;
          const [last = '', rest = ''] = (d.name || '').split(',');
          const parts = rest.trim().split(' ');
          const mapped = {
            ...BLANK,
            lastName: last.trim(),
            firstName: parts[0] || '',
            middleName: parts.slice(1).join(' ') || '',
            suffix: d.suffix || '',
            dob: d.dob || '',
            sexAtBirth: d.sex === 'M' ? 'Male' : d.sex === 'F' ? 'Female' : d.sex || '',
            ssn: d.ssn || d.govId || '',
            genderIdentity: d.genderIdentity || '',
            preferredName: d.preferredName || '',
            veteranStatus: d.veteranStatus || false,
            addressLine1: d.streetAddress1 || '',
            addressLine2: d.streetAddress2 || '',
            city: d.city || '',
            state: d.state || '',
            postalCode: d.zip || '',
            county: d.county || '',
            country: d.country || 'United States',
            phoneHome: d.phone || '',
            phoneWork: d.phoneWork || '',
            phoneMobile: d.phoneMobile || d.phoneCell || '',
            email: d.email || '',
            maritalStatus: d.maritalStatus || '',
            religion: d.religion || '',
            race: Array.isArray(d.race) ? d.race : (d.race ? [d.race] : []),
            ethnicity: d.ethnicity || '',
            preferredLanguage: d.preferredLanguage || '',
            interpreterNeeded: d.interpreterNeeded || false,
            countryOfBirth: d.countryOfBirth || '',
            motherMaidenName: d.motherMaidenName || '',
            ecName: d.emergencyContact?.name || '',
            ecPhone: d.emergencyContact?.phone || '',
            ecRelationship: d.emergencyContact?.relationship || '',
            nokName: d.nextOfKin?.name || '',
            nokPhone: d.nextOfKin?.phone || '',
            nokAddress: d.nextOfKin?.address || '',
            nokRelationship: d.nextOfKin?.relationship || '',
            empStatus: d.employment?.status || '',
            empName: d.employment?.employer || '',
            empPhone: d.employment?.phone || '',
            enrollmentPriorityGroup: d.enrollmentPriorityGroup != null && d.enrollmentPriorityGroup !== ''
              ? String(d.enrollmentPriorityGroup)
              : (d.eligibility?.priorityGroup != null ? String(d.eligibility.priorityGroup) : ''),
            branch: d.militaryService?.branch || '',
            serviceEntryDate: d.militaryService?.serviceEntryDate || '',
            serviceSeparationDate: d.militaryService?.serviceSeparationDate || '',
            periodOfService: d.militaryService?.periodOfService || d.militaryService?.serviceEra || '',
            serviceConnected: d.militaryService?.serviceConnected || d.serviceConnected || false,
            claimNumber: d.militaryService?.claimNumber || '',
            scPercent: String(d.militaryService?.scPercent ?? d.scPercent ?? ''),
            combatStatus: d.militaryService?.combatStatus || '',
            purpleHeart: d.militaryService?.purpleHeart || false,
            pow: d.militaryService?.pow || false,
            exposures: d.militaryService?.exposures || [],
            registrationFacility: d.registrationSite?.ien || '',
            patientCategory: d.patientCategory || '',
            advanceDirectiveOnFile: d.advanceDirectiveOnFile || false,
          };
          setForm(mapped);
          setOriginalForm(mapped);
          setPatient(d);
          try {
            const raw = sessionStorage.getItem(draftStorageKey);
            if (raw) {
              const draft = JSON.parse(raw);
              if (
                Date.now() - draft.ts <= DEMO_DRAFT_MAX_AGE_MS &&
                String(draft.patientId) === String(patientId) &&
                draft.form &&
                typeof draft.form === 'object'
              ) {
                setForm((prev) => ({ ...mapped, ...draft.form }));
              }
            }
          } catch (_draftErr) {
            /* corrupt draft */
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [patientId, isEdit, setPatient, draftStorageKey]);

  /* ── Field setter with error clearing + identity warnings ── */
  const set = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
    }
    if (isEdit) {
      const warnings = [];
      const nameFields = ['lastName', 'firstName', 'middleName', 'suffix'];
      const updatedForm = { ...form, [field]: value };
      if (nameFields.some(f => updatedForm[f] !== originalForm[f])) {
        warnings.push('Changing the patient name is a monitored identity action.');
      }
      if (updatedForm.dob !== originalForm.dob) {
        warnings.push('Changing the date of birth is a monitored identity action.');
      }
      if (updatedForm.ssn !== originalForm.ssn) {
        warnings.push('Changing the national identifier is a critical identity action.');
      }
      setIdentityWarnings(warnings);
    }
  };

  /* ── Toggle for accordion sections ── */
  const toggleSection = (id) => {
    setExpandedSections(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  /* ── Duplicate check (register mode) ── */
  const runDuplicateCheck = async () => {
    if (!form.lastName || !form.firstName || !form.dob) return;
    setDupChecking(true);
    setDupDismissed(false);
    try {
      const res = await searchPatients(`${form.lastName},${form.firstName}`);
      const matches = (res.data || []).filter(p => p.dob === form.dob);
      setDupResults(matches);
      setDupSearchDone(true);
    } finally {
      setDupChecking(false);
    }
  };

  /* ── Validation ── */
  const validate = () => {
    const e = {};
    if (!form.lastName.trim() || form.lastName.trim().length < 2) {
      e.lastName = 'Last name is required (min 2 characters)';
    } else if (/\d/.test(form.lastName)) {
      e.lastName = 'Last name cannot contain numbers';
    }
    if (!form.firstName.trim()) {
      e.firstName = 'First name is required';
    }
    if (!form.dob) {
      e.dob = 'Date of birth is required';
    } else if (new Date(form.dob) > new Date()) {
      e.dob = 'Date of birth cannot be a future date';
    }
    if (!form.sexAtBirth) {
      e.sexAtBirth = 'Sex at birth is required';
    }
    if (form.ssn) {
      const ssnDigits = form.ssn.replace(/\D/g, '');
      if (ssnDigits.length !== 9) {
        e.ssn = 'SSN must be 9 digits (XXX-XX-XXXX)';
      }
    }
    if (!form.registrationFacility) {
      e.registrationFacility = 'Registration facility is required';
    }
    // VistA SC%: 0–100 in increments of 10 only (when service-connected)
    if (form.serviceConnected) {
      const raw = String(form.scPercent ?? '').trim();
      if (raw !== '') {
        const n = Number(raw);
        if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 100 || n % 10 !== 0) {
          e.scPercent = 'SC percentage must be 0–100 in steps of 10 (0, 10, 20, … 100).';
        }
      }
    }
    setErrors(e);
    if (Object.keys(e).length > 0) {
      if (e.lastName || e.firstName || e.dob || e.sexAtBirth || e.ssn) {
        if (!expandedSections.includes('identity')) {
          setExpandedSections(prev => [...prev, 'identity']);
        }
      }
      if (e.registrationFacility) {
        if (!expandedSections.includes('registration')) {
          setExpandedSections(prev => [...prev, 'registration']);
        }
      }
      if (e.scPercent) {
        if (!expandedSections.includes('military')) {
          setExpandedSections(prev => [...prev, 'military']);
        }
      }
    }
    return Object.keys(e).length === 0;
  };

  /* ── Save handler ── */
  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      const payload = {
        name: `${form.lastName.toUpperCase()},${form.firstName.toUpperCase()} ${form.middleName.toUpperCase()}`.trim(),
        suffix: form.suffix,
        dob: form.dob,
        sex: form.sexAtBirth === 'Male' ? 'M' : form.sexAtBirth === 'Female' ? 'F' : form.sexAtBirth,
        ssn: form.ssn.replace(/\D/g, ''),
        genderIdentity: form.genderIdentity,
        preferredName: form.preferredName,
        veteranStatus: form.veteranStatus,
        streetAddress1: form.addressLine1,
        streetAddress2: form.addressLine2,
        city: form.city,
        state: form.state,
        zip: form.postalCode,
        county: form.county,
        country: form.country,
        phone: form.phoneHome,
        phoneWork: form.phoneWork,
        phoneCell: form.phoneMobile,
        email: form.email,
        maritalStatus: form.maritalStatus,
        religion: form.religion,
        race: form.race,
        ethnicity: form.ethnicity,
        preferredLanguage: form.preferredLanguage,
        interpreterNeeded: form.interpreterNeeded,
        countryOfBirth: form.countryOfBirth,
        motherMaidenName: form.motherMaidenName,
        emergencyContact: { name: form.ecName, phone: form.ecPhone, relationship: form.ecRelationship },
        nextOfKin: { name: form.nokName, phone: form.nokPhone, address: form.nokAddress, relationship: form.nokRelationship },
        employment: { status: form.empStatus, employer: form.empName, phone: form.empPhone },
        enrollmentPriorityGroup: form.enrollmentPriorityGroup,
        advanceDirectiveOnFile: form.advanceDirectiveOnFile,
        militaryService: {
          branch: form.branch,
          serviceEntryDate: form.serviceEntryDate,
          serviceSeparationDate: form.serviceSeparationDate,
          periodOfService: form.periodOfService,
          serviceEra: form.periodOfService,
          serviceConnected: form.serviceConnected,
          claimNumber: form.claimNumber,
          scPercent: Number(form.scPercent) || 0,
          combatStatus: form.combatStatus,
          purpleHeart: form.purpleHeart,
          pow: form.pow,
          exposures: form.exposures,
        },
        registrationSite: form.registrationFacility,
        patientCategory: form.patientCategory,
      };

      const res = isEdit
        ? await updatePatient(patientId, payload)
        : await registerPatient(payload);

      if (res.ok) {
        const newDfn = res.data?.dfn || patientId;
        savedDfnRef.current = newDfn;
        try {
          sessionStorage.removeItem(draftStorageKey);
        } catch (_clearErr) {
          /* storage unavailable */
        }
        setSaveSuccess(isEdit ? 'Demographics updated successfully.' : 'Patient registered successfully.');
        if (isEdit) {
          setOriginalForm({ ...form });
          setIdentityWarnings([]);
        }
      } else {
        setSaveError(res.error || 'Save failed. Please try again.');
      }
    } catch (err) {
      setSaveError(err.message || 'An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  };

  /* ── Section error helpers ── */
  const identityHasError = ['lastName', 'firstName', 'dob', 'sexAtBirth', 'ssn'].some(f => errors[f]);
  const registrationHasError = !!errors.registrationFacility;
  const militaryHasError = !!errors.scPercent;
  const scPctStr = String(form.scPercent ?? '').trim();
  const scPctNum = scPctStr === '' ? NaN : Number(scPctStr);
  const scPctLegacyInvalid =
    form.serviceConnected &&
    scPctStr !== '' &&
    (!Number.isInteger(scPctNum) || scPctNum % 10 !== 0 || scPctNum < 0 || scPctNum > 100);

  /* ── Loading state ── */
  if (loading) {
    return (
      <AppShell breadcrumb={`Patients › ${isEdit ? 'Edit Demographics' : 'Register'}`}>
        <div className="flex items-center justify-center h-[50vh]">
          <span className="material-symbols-outlined animate-spin text-[32px] text-[#999]">progress_activity</span>
        </div>
      </AppShell>
    );
  }

  /* ── Success state with CTAs ── */
  if (saveSuccess) {
    const dfn = savedDfnRef.current || patientId;
    return (
      <AppShell breadcrumb={`Patients › ${isEdit ? 'Edit Demographics' : 'Register'}`}>
        {isEdit && <PatientBanner />}
        <div className="px-6 py-12 flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-5">
            <span className="material-symbols-outlined text-[32px] text-green-600">check_circle</span>
          </div>
          <h2 className="text-[22px] font-bold text-[#1A1A2E] mb-2">{saveSuccess}</h2>
          <p className="text-sm text-[#666] mb-8">
            {isEdit ? 'Patient demographics have been saved.' : `Patient ID: ${dfn}`}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => navigate(`/patients/${dfn}`)}
              className="px-5 py-2.5 bg-[#1A1A2E] text-white text-sm font-medium rounded-md hover:bg-[#2E5984] transition-colors"
            >
              Open Chart
            </button>
            {!isEdit && (
              <button
                onClick={() => navigate(`/patients/${dfn}/insurance`)}
                className="px-5 py-2.5 border border-[#2E5984] text-[#2E5984] text-sm font-medium rounded-md hover:bg-[#F0F4F8] transition-colors"
              >
                Add Insurance
              </button>
            )}
            <button
              onClick={() => navigate(`/patients/${dfn}/schedule`)}
              className="px-5 py-2.5 border border-[#2E5984] text-[#2E5984] text-sm font-medium rounded-md hover:bg-[#F0F4F8] transition-colors"
            >
              Schedule Appointment
            </button>
            {!isEdit && (
              <button
                onClick={() => {
                  setForm({ ...BLANK });
                  setOriginalForm({ ...BLANK });
                  setSaveSuccess(null);
                  setDupSearchDone(false);
                  setDupResults([]);
                  setDupDismissed(false);
                  setExpandedSections(['identity']);
                  savedDfnRef.current = null;
                  try {
                    sessionStorage.removeItem(`${DEMO_DRAFT_PREFIX}new`);
                  } catch (_e) {
                    /* storage unavailable */
                  }
                }}
                className="px-5 py-2.5 border border-[#E2E4E8] text-[#555] text-sm font-medium rounded-md hover:bg-[#F0F4F8] transition-colors"
              >
                Register Another
              </button>
            )}
          </div>
        </div>
      </AppShell>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   *  RENDER — main form
   * ═══════════════════════════════════════════════════════════════════════════ */
  return (
    <AppShell breadcrumb={`Patients › ${isEdit ? 'Edit Demographics' : 'Register New Patient'}`}>
      {isEdit && <PatientBanner />}

      <div className="px-6 py-5 pb-24">
        {/* Page header */}
        <div className="mb-5">
          <h1 className="text-[28px] font-bold text-[#1A1A2E]">
            {isEdit ? 'Edit Demographics' : 'Register New Patient'}
          </h1>
          <p className="text-sm text-[#888] mt-1">
            {isEdit
              ? 'Update the patient demographic record below.'
              : 'Complete all required fields to register a new patient.'}
          </p>
        </div>

        {/* Errors / Warnings */}
        {saveError && (
          <div className="mb-4 px-4 py-3 bg-red-50 border-l-4 border-red-500 rounded-r-md text-sm text-red-800 flex items-start gap-2">
            <span className="material-symbols-outlined text-[18px] mt-0.5">error</span>
            {saveError}
          </div>
        )}

        {isEdit && identityWarnings.map((w, i) => (
          <IdentityWarningBanner key={i} message={w} />
        ))}

        {/* ── Duplicate Check Section (register mode only) ── */}
        {!isEdit && (
          <div className="mb-5 p-5 bg-[#F8FAFC] border border-[#E2E4E8] rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-[20px] text-[#2E5984]">person_search</span>
              <h3 className="text-[15px] font-semibold text-[#1A1A2E]">Duplicate Check</h3>
            </div>
            <p className="text-[13px] text-[#666] mb-4">
              Enter the patient's name and date of birth, then check for existing records before proceeding with registration.
            </p>
            <div className="grid grid-cols-4 gap-3 mb-4">
              <Field label="Last Name" required error={!form.lastName && dupSearchDone ? 'Required' : null}>
                <input value={form.lastName} onChange={e => set('lastName', e.target.value)}
                  className={inputCls} placeholder="SMITH" />
              </Field>
              <Field label="First Name" required>
                <input value={form.firstName} onChange={e => set('firstName', e.target.value)}
                  className={inputCls} placeholder="JOHN" />
              </Field>
              <Field label="Date of Birth" required>
                <input type="date" value={form.dob} onChange={e => set('dob', e.target.value)}
                  className={inputCls} max={new Date().toISOString().split('T')[0]} />
              </Field>
              <div className="flex items-end">
                <button
                  onClick={runDuplicateCheck}
                  disabled={dupChecking || !form.lastName || !form.firstName || !form.dob}
                  className="h-10 px-5 bg-[#2E5984] text-white text-sm font-medium rounded-md hover:bg-[#1A1A2E] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {dupChecking && <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>}
                  Check for Duplicates
                </button>
              </div>
            </div>

            {dupSearchDone && dupResults.length > 0 && !dupDismissed && (
              <div className="px-4 py-3 bg-amber-50 border border-amber-300 rounded-md">
                <div className="flex items-start gap-2 mb-2">
                  <span className="material-symbols-outlined text-[18px] text-amber-600 mt-0.5">warning</span>
                  <span className="text-[13px] font-semibold text-amber-800">
                    {dupResults.length} potential duplicate{dupResults.length > 1 ? 's' : ''} found
                  </span>
                </div>
                <div className="space-y-2 mb-3">
                  {dupResults.map(p => (
                    <div key={p.dfn} className="flex items-center justify-between bg-white rounded px-3 py-2 border border-amber-200">
                      <div className="text-sm">
                        <span className="font-medium text-[#1A1A2E]">{p.name}</span>
                        <span className="text-[#888] ml-3">DOB: {p.dob}</span>
                        <span className="text-[#888] ml-3">ID: {p.dfn}</span>
                      </div>
                      <button
                        onClick={() => navigate(`/patients/${p.dfn}/edit`)}
                        className="text-[13px] text-[#2E5984] font-medium hover:underline"
                      >
                        Open Record
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setDupDismissed(true)}
                  className="text-[13px] text-amber-700 font-medium hover:underline"
                >
                  Not a duplicate — proceed with registration
                </button>
              </div>
            )}

            {dupSearchDone && dupResults.length === 0 && (
              <div className="px-4 py-3 bg-green-50 border border-green-300 rounded-md flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-green-600">check_circle</span>
                <span className="text-[13px] text-green-800">No duplicate records found. You may proceed with registration.</span>
              </div>
            )}
          </div>
        )}

        {/* ── Accordion Sections ── */}
        <div className="max-w-4xl">

          {/* ─────── SECTION 1: IDENTITY ─────── */}
          <AccordionSection
            id="identity" title="Identity" icon="badge"
            expanded={expandedSections.includes('identity')}
            onToggle={toggleSection}
            hasError={identityHasError}
          >
            <div className="grid grid-cols-3 gap-4 mb-5">
              <Field label="Last Name" required error={errors.lastName} changed={isChanged('lastName')}>
                <input value={form.lastName} onChange={e => set('lastName', e.target.value)}
                  className={inputCls + ' w-full'} placeholder="SMITH" />
              </Field>
              <Field label="First Name" required error={errors.firstName} changed={isChanged('firstName')}>
                <input value={form.firstName} onChange={e => set('firstName', e.target.value)}
                  className={inputCls + ' w-full'} placeholder="JOHN" />
              </Field>
              <Field label="Middle Name" changed={isChanged('middleName')}>
                <input value={form.middleName} onChange={e => set('middleName', e.target.value)}
                  className={inputCls + ' w-full'} placeholder="ANDREW" />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-5">
              <Field label="Suffix" changed={isChanged('suffix')}>
                <select value={form.suffix} onChange={e => set('suffix', e.target.value)} className={selectCls + ' w-full'}>
                  <option value="">None</option>
                  {SUFFIX_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Date of Birth" required error={errors.dob} changed={isChanged('dob')}>
                <input type="date" value={form.dob} onChange={e => set('dob', e.target.value)}
                  className={inputCls + ' w-full'} max={new Date().toISOString().split('T')[0]} />
              </Field>
              <Field label="Sex at Birth" required error={errors.sexAtBirth} changed={isChanged('sexAtBirth')}>
                <select value={form.sexAtBirth} onChange={e => set('sexAtBirth', e.target.value)} className={selectCls + ' w-full'}>
                  <option value="">Select...</option>
                  {SEX_AT_BIRTH.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-5">
              <Field label="National ID / SSN" error={errors.ssn} changed={isChanged('ssn')}>
                <div className="relative">
                  <input
                    type={ssnVisible ? 'text' : 'password'}
                    value={ssnVisible ? formatSSN(form.ssn) : (form.ssn ? maskSSN(form.ssn) : '')}
                    onChange={e => {
                      if (ssnVisible) {
                        set('ssn', e.target.value.replace(/\D/g, '').slice(0, 9));
                      }
                    }}
                    onFocus={() => setSsnVisible(true)}
                    onBlur={() => setSsnVisible(false)}
                    className={inputCls + ' w-full pr-10'}
                    placeholder="XXX-XX-XXXX"
                    maxLength={11}
                  />
                  <button
                    type="button"
                    onMouseDown={e => { e.preventDefault(); setSsnVisible(v => !v); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#888] hover:text-[#555]"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {ssnVisible ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </Field>
              <Field label="Gender Identity" changed={isChanged('genderIdentity')}>
                <select value={form.genderIdentity} onChange={e => set('genderIdentity', e.target.value)} className={selectCls + ' w-full'}>
                  <option value="">Select...</option>
                  {GENDER_IDENTITY_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </Field>
              <Field label="Preferred Name" changed={isChanged('preferredName')}>
                <input value={form.preferredName} onChange={e => set('preferredName', e.target.value)}
                  className={inputCls + ' w-full'} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-5">
              <Field label="Country of Birth" changed={isChanged('countryOfBirth')}>
                <input value={form.countryOfBirth} onChange={e => set('countryOfBirth', e.target.value)}
                  className={inputCls + ' w-full'} placeholder="e.g. United States" />
              </Field>
              <Field label="Mother's Maiden Name" changed={isChanged('motherMaidenName')}>
                <input value={form.motherMaidenName} onChange={e => set('motherMaidenName', e.target.value)}
                  className={inputCls + ' w-full'} />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {isVA && (
                <Field label="Veteran Status" changed={isChanged('veteranStatus')}>
                  <div className="h-10 flex items-center">
                    <Toggle checked={form.veteranStatus} onChange={v => set('veteranStatus', v)} label={form.veteranStatus ? 'Yes' : 'No'} />
                  </div>
                </Field>
              )}
            </div>
          </AccordionSection>

          {/* ─────── SECTION 2: DEMOGRAPHICS ─────── */}
          <AccordionSection
            id="demographics" title="Demographics" icon="home"
            expanded={expandedSections.includes('demographics')}
            onToggle={toggleSection}
          >
            <div className="grid grid-cols-2 gap-4 mb-5">
              <Field label="Address Line 1" changed={isChanged('addressLine1')}>
                <input value={form.addressLine1} onChange={e => set('addressLine1', e.target.value)}
                  className={inputCls + ' w-full'} placeholder="1234 Main Street" />
              </Field>
              <Field label="Address Line 2" changed={isChanged('addressLine2')}>
                <input value={form.addressLine2} onChange={e => set('addressLine2', e.target.value)}
                  className={inputCls + ' w-full'} placeholder="Apt, Suite, Unit" />
              </Field>
            </div>
            <div className="grid grid-cols-4 gap-4 mb-5">
              <Field label="City" changed={isChanged('city')}>
                <input value={form.city} onChange={e => set('city', e.target.value)}
                  className={inputCls + ' w-full'} placeholder="Portland" />
              </Field>
              <Field label="State / Province" changed={isChanged('state')}>
                <select value={form.state} onChange={e => set('state', e.target.value)} className={selectCls + ' w-full'}>
                  <option value="">Select...</option>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Postal Code" changed={isChanged('postalCode')}>
                <input value={form.postalCode} onChange={e => set('postalCode', e.target.value)}
                  className={inputCls + ' w-full'} placeholder="97201" maxLength={10} />
              </Field>
              <Field label="County" changed={isChanged('county')}>
                <input value={form.county} onChange={e => set('county', e.target.value)}
                  className={inputCls + ' w-full'} />
              </Field>
            </div>
            <div className="grid grid-cols-4 gap-4 mb-5">
              <Field label="Country" changed={isChanged('country')}>
                <select value={form.country} onChange={e => set('country', e.target.value)} className={selectCls + ' w-full'}>
                  {COUNTRY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Home Phone" changed={isChanged('phoneHome')}>
                <input value={form.phoneHome} onChange={e => set('phoneHome', e.target.value)}
                  className={inputCls + ' w-full'} placeholder="(503) 555-0101" />
              </Field>
              <Field label="Work Phone" changed={isChanged('phoneWork')}>
                <input value={form.phoneWork} onChange={e => set('phoneWork', e.target.value)}
                  className={inputCls + ' w-full'} />
              </Field>
              <Field label="Mobile Phone" changed={isChanged('phoneMobile')}>
                <input value={form.phoneMobile} onChange={e => set('phoneMobile', e.target.value)}
                  className={inputCls + ' w-full'} />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-5">
              <Field label="Email" changed={isChanged('email')}>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  className={inputCls + ' w-full'} placeholder="patient@example.com" />
              </Field>
              <Field label="Marital Status" changed={isChanged('maritalStatus')}>
                <select value={form.maritalStatus} onChange={e => set('maritalStatus', e.target.value)} className={selectCls + ' w-full'}>
                  <option value="">Select...</option>
                  {MARITAL_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="Religion" changed={isChanged('religion')}>
                <select value={form.religion} onChange={e => set('religion', e.target.value)} className={selectCls + ' w-full'}>
                  <option value="">Select...</option>
                  {RELIGION_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
            </div>
            <div className="mb-5">
              <p className="text-[12px] font-medium text-[#555] mb-2">Race</p>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {RACE_OPTIONS.map(r => (
                  <label key={r} className="flex items-center gap-2 text-[13px] text-[#555] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.race.includes(r)}
                      onChange={e => {
                        set('race', e.target.checked
                          ? [...form.race, r]
                          : form.race.filter(x => x !== r));
                      }}
                      className="rounded border-[#E2E4E8]"
                    />
                    {r}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-5">
              <Field label="Ethnicity" changed={isChanged('ethnicity')}>
                <select value={form.ethnicity} onChange={e => set('ethnicity', e.target.value)} className={selectCls + ' w-full'}>
                  <option value="">Select...</option>
                  {ETHNICITY_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </Field>
              <Field label="Preferred Language" changed={isChanged('preferredLanguage')}>
                <input value={form.preferredLanguage} onChange={e => set('preferredLanguage', e.target.value)}
                  className={inputCls + ' w-full'} placeholder="English" />
              </Field>
              <Field label="Interpreter Needed" changed={isChanged('interpreterNeeded')}>
                <div className="h-10 flex items-center">
                  <Toggle checked={form.interpreterNeeded} onChange={v => set('interpreterNeeded', v)} label={form.interpreterNeeded ? 'Yes' : 'No'} />
                </div>
              </Field>
            </div>
          </AccordionSection>

          {/* ─────── SECTION: EMERGENCY CONTACTS (NOK + emergency contact) ─────── */}
          <AccordionSection
            id="emergency" title="Emergency Contacts" icon="emergency"
            expanded={expandedSections.includes('emergency')}
            onToggle={toggleSection}
          >
            <h3 className="text-[14px] font-semibold text-[#1A1A2E] mb-3">Emergency contact</h3>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <Field label="Emergency Contact Name" changed={isChanged('ecName')}>
                <input value={form.ecName} onChange={e => set('ecName', e.target.value)}
                  className={inputCls + ' w-full'} />
              </Field>
              <Field label="Emergency Contact Phone" changed={isChanged('ecPhone')}>
                <input value={form.ecPhone} onChange={e => set('ecPhone', e.target.value)}
                  className={inputCls + ' w-full'} placeholder="(503) 555-0101" />
              </Field>
              <Field label="Relationship" changed={isChanged('ecRelationship')}>
                <select value={form.ecRelationship} onChange={e => set('ecRelationship', e.target.value)} className={selectCls + ' w-full'}>
                  <option value="">Select...</option>
                  {RELATIONSHIP_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
            </div>

            <h3 className="text-[14px] font-semibold text-[#1A1A2E] mb-3 mt-1">Next of kin</h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <Field label="Next of Kin Name" changed={isChanged('nokName')}>
                <input value={form.nokName} onChange={e => set('nokName', e.target.value)}
                  className={inputCls + ' w-full'} />
              </Field>
              <Field label="Next of Kin Phone" changed={isChanged('nokPhone')}>
                <input value={form.nokPhone} onChange={e => set('nokPhone', e.target.value)}
                  className={inputCls + ' w-full'} placeholder="(503) 555-0101" />
              </Field>
              <Field label="NOK Relationship" changed={isChanged('nokRelationship')}>
                <select value={form.nokRelationship} onChange={e => set('nokRelationship', e.target.value)} className={selectCls + ' w-full'}>
                  <option value="">Select...</option>
                  {RELATIONSHIP_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <Field label="Next of Kin Address" changed={isChanged('nokAddress')}>
                <input value={form.nokAddress} onChange={e => set('nokAddress', e.target.value)}
                  className={inputCls + ' w-full'} />
              </Field>
            </div>
          </AccordionSection>

          {/* ─────── SECTION: EMPLOYMENT & ELIGIBILITY ─────── */}
          <AccordionSection
            id="employment" title="Employment & Eligibility" icon="work"
            expanded={expandedSections.includes('employment')}
            onToggle={toggleSection}
          >
            <div className="grid grid-cols-3 gap-4">
              <Field label="Employment Status" changed={isChanged('empStatus')}>
                <select value={form.empStatus} onChange={e => set('empStatus', e.target.value)} className={selectCls + ' w-full'}>
                  <option value="">Select...</option>
                  {form.empStatus && !VA_EMPLOYMENT_ELIGIBILITY.includes(form.empStatus) && (
                    <option value={form.empStatus}>{form.empStatus} (saved)</option>
                  )}
                  {VA_EMPLOYMENT_ELIGIBILITY.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Employer Name" changed={isChanged('empName')}>
                <input value={form.empName} onChange={e => set('empName', e.target.value)}
                  className={inputCls + ' w-full'} />
              </Field>
              <Field label="Enrollment Priority Group" changed={isChanged('enrollmentPriorityGroup')}>
                <select value={form.enrollmentPriorityGroup} onChange={e => set('enrollmentPriorityGroup', e.target.value)} className={selectCls + ' w-full'}>
                  <option value="">Select...</option>
                  {ENROLLMENT_PRIORITY_GROUPS.map(g => <option key={g} value={g}>Group {g}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <Field label="Employer Phone" changed={isChanged('empPhone')}>
                <input value={form.empPhone} onChange={e => set('empPhone', e.target.value)}
                  className={inputCls + ' w-full'} />
              </Field>
            </div>
          </AccordionSection>

          {/* ─────── SECTION 5: MILITARY SERVICE (VA tenant + Veteran Status = Yes) ─────── */}
          {isVA && form.veteranStatus && (
            <AccordionSection
              id="military" title="Military Service & Eligibility" icon="military_tech"
              expanded={expandedSections.includes('military')}
              onToggle={toggleSection}
              hasError={militaryHasError}
            >
              <div className="grid grid-cols-3 gap-4 mb-5">
                <Field label="Branch of Service" changed={isChanged('branch')}>
                  <select value={form.branch} onChange={e => set('branch', e.target.value)} className={selectCls + ' w-full'}>
                    <option value="">Select...</option>
                    {form.branch && !BRANCHES_OF_SERVICE.includes(form.branch) && (
                      <option value={form.branch}>{form.branch} (saved)</option>
                    )}
                    {BRANCHES_OF_SERVICE.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </Field>
                <Field label="Service Entry Date" changed={isChanged('serviceEntryDate')}>
                  <input type="date" value={form.serviceEntryDate} onChange={e => set('serviceEntryDate', e.target.value)}
                    className={inputCls + ' w-full'} />
                </Field>
                <Field label="Service Separation Date" changed={isChanged('serviceSeparationDate')}>
                  <input type="date" value={form.serviceSeparationDate} onChange={e => set('serviceSeparationDate', e.target.value)}
                    className={inputCls + ' w-full'} />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-5">
                <Field label="Period of Service" changed={isChanged('periodOfService')}>
                  <select value={form.periodOfService} onChange={e => set('periodOfService', e.target.value)} className={selectCls + ' w-full'}>
                    <option value="">Select...</option>
                    {form.periodOfService && !PERIOD_OF_SERVICE.includes(form.periodOfService) && (
                      <option value={form.periodOfService}>{form.periodOfService} (saved)</option>
                    )}
                    {PERIOD_OF_SERVICE.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Service Connected" changed={isChanged('serviceConnected')}>
                  <div className="h-10 flex items-center">
                    <Toggle checked={form.serviceConnected} onChange={v => set('serviceConnected', v)} label={form.serviceConnected ? 'Yes' : 'No'} />
                  </div>
                </Field>
                <Field label="Claim Number" changed={isChanged('claimNumber')}>
                  <input value={form.claimNumber} onChange={e => set('claimNumber', e.target.value)}
                    className={inputCls + ' w-full'} />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-5">
                {form.serviceConnected && (
                  <Field label="SC Percentage" changed={isChanged('scPercent')} error={errors.scPercent}>
                    <select
                      value={scPctStr === '' ? '' : String(form.scPercent)}
                      onChange={e => set('scPercent', e.target.value)}
                      className={selectCls + ' w-full'}
                    >
                      <option value="">Select…</option>
                      {scPctLegacyInvalid && (
                        <option value={String(form.scPercent)}>{form.scPercent}% (invalid — pick a 10% step)</option>
                      )}
                      {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((p) => (
                        <option key={p} value={String(p)}>{p}%</option>
                      ))}
                    </select>
                  </Field>
                )}
                <Field label="Combat Veteran" changed={isChanged('combatStatus')}>
                  <select value={form.combatStatus} onChange={e => set('combatStatus', e.target.value)} className={selectCls + ' w-full'}>
                    <option value="">Select...</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </Field>
                <Field label="Purple Heart" changed={isChanged('purpleHeart')}>
                  <div className="h-10 flex items-center">
                    <Toggle checked={form.purpleHeart} onChange={v => set('purpleHeart', v)} label={form.purpleHeart ? 'Yes' : 'No'} />
                  </div>
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-5">
                <Field label="Former POW" changed={isChanged('pow')}>
                  <div className="h-10 flex items-center">
                    <Toggle checked={form.pow} onChange={v => set('pow', v)} label={form.pow ? 'Yes' : 'No'} />
                  </div>
                </Field>
              </div>
              <div>
                <p className="text-[12px] font-medium text-[#555] mb-2">Environmental Exposures</p>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {EXPOSURE_OPTIONS.map(exp => (
                    <label key={exp} className="flex items-center gap-2 text-[13px] text-[#555] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(form.exposures || []).includes(exp)}
                        onChange={e => {
                          set('exposures', e.target.checked
                            ? [...(form.exposures || []), exp]
                            : (form.exposures || []).filter(x => x !== exp));
                        }}
                        className="rounded border-[#E2E4E8]"
                      />
                      {exp}
                    </label>
                  ))}
                </div>
              </div>
            </AccordionSection>
          )}

          {/* ─────── SECTION 6: REGISTRATION CONTEXT ─────── */}
          <AccordionSection
            id="registration" title="Registration Context" icon="app_registration"
            expanded={expandedSections.includes('registration')}
            onToggle={toggleSection}
            hasError={registrationHasError}
          >
            <div className="grid grid-cols-2 gap-4">
              <Field label="Registration Facility" required error={errors.registrationFacility} changed={isChanged('registrationFacility')}>
                <select
                  value={form.registrationFacility}
                  onChange={e => set('registrationFacility', e.target.value)}
                  className={selectCls + ' w-full'}
                >
                  <option value="">Select facility...</option>
                  {divisions.map(d => (
                    <option key={d.ien || d.id} value={d.ien || d.id}>
                      {d.name || d.description || `Division ${d.ien || d.id}`}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Patient Category" changed={isChanged('patientCategory')}>
                <select value={form.patientCategory} onChange={e => set('patientCategory', e.target.value)} className={selectCls + ' w-full'}>
                  <option value="">Select...</option>
                  {PATIENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 mt-4 max-w-md">
              <Field label="Advance Directive on File" changed={isChanged('advanceDirectiveOnFile')}>
                <div className="h-10 flex items-center">
                  <Toggle checked={form.advanceDirectiveOnFile} onChange={v => set('advanceDirectiveOnFile', v)} label={form.advanceDirectiveOnFile ? 'Yes' : 'No'} />
                </div>
              </Field>
            </div>
          </AccordionSection>
        </div>
      </div>

      {/* ── Sticky bottom action bar ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E2E4E8] px-6 py-3 flex items-center justify-between z-50 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
        <button
          onClick={() => navigate(isEdit ? `/patients/${patientId}` : '/patients')}
          className="px-5 py-2.5 border border-[#E2E4E8] text-sm font-medium text-[#555] rounded-md hover:bg-[#F0F4F8] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-[#1A1A2E] text-white text-sm font-medium rounded-md hover:bg-[#2E5984] disabled:opacity-50 transition-colors min-w-[160px] justify-center"
        >
          {saving && <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>}
          {isEdit ? 'Save Changes' : 'Register Patient'}
        </button>
      </div>
    </AppShell>
  );
}
