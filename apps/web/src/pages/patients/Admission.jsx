import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import AppShell from '../../components/shell/AppShell';
import PatientBanner from '../../components/shared/PatientBanner';
import { usePatient } from '../../components/shared/PatientContext';
import { getPatient, admitPatient, getBeds, getWards, getTreatingSpecialties, getProviders } from '../../services/patientService';

const inputCls = 'h-10 px-3 border border-[#E2E4E8] rounded-md text-sm text-[#333] focus:outline-none focus:border-[#2E5984] focus:ring-1 focus:ring-[#2E5984]';
const selectCls = `${inputCls} bg-white`;

const ADMISSION_TYPES = ['Scheduled', 'Emergency', 'Direct', 'Transfer-In'];
const ADMISSION_SOURCES = ['Emergency Room', 'Clinic Referral', 'Transfer from Another Facility', 'Direct Admission', 'Walk-In'];

export default function Admission() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { patient, setPatient, hasPatient } = usePatient();
  const [loading, setLoading] = useState(true);
  const [beds, setBeds] = useState([]);
  const [wards, setWards] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [providers, setProviders] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [successData, setSuccessData] = useState(null);
  const [loadingWards, setLoadingWards] = useState(false);
  const [loadingBeds, setLoadingBeds] = useState(false);
  const [loadingSpecialties, setLoadingSpecialties] = useState(false);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [showInsuranceWarning, setShowInsuranceWarning] = useState(false);
  const [form, setForm] = useState({
    admittingDiagnosis: '', admittingProvider: '', treatingSpecialty: '',
    wardIen: '', roomBed: '', expectedLos: '',
    admissionType: '', admissionSource: '', admissionDateTime: new Date().toISOString().slice(0, 16),
    consentSigned: false, valuablesInventory: false, allergyVerified: false, medReconciliation: false,
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      setLoadingWards(true);
      setLoadingBeds(true);
      setLoadingSpecialties(true);
      setLoadingProviders(true);
      try {
        let patData = null;
        if (!hasPatient) {
          const pRes = await getPatient(patientId);
          if (pRes.ok) { setPatient(pRes.data); patData = pRes.data; }
        } else {
          patData = patient;
        }

        if (patData && (!patData.insurance || patData.insurance.length === 0)) {
          setShowInsuranceWarning(true);
        }

        const [bedRes, wardRes, specRes, provRes] = await Promise.allSettled([
          getBeds(),
          getWards(),
          getTreatingSpecialties(),
          getProviders(),
        ]);

        if (bedRes.status === 'fulfilled') { setBeds(bedRes.value.data || []); }
        setLoadingBeds(false);

        if (wardRes.status === 'fulfilled') { setWards(wardRes.value.data || []); }
        setLoadingWards(false);

        if (specRes.status === 'fulfilled') { setSpecialties(specRes.value.data || []); }
        setLoadingSpecialties(false);

        if (provRes.status === 'fulfilled') {
          setProviders((provRes.value.data || []).filter(u => u.name));
        }
        setLoadingProviders(false);
      } finally {
        setLoading(false);
      }
    })();
  }, [patientId, hasPatient, setPatient, patient]);

  const set = (field, value) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'wardIen') next.roomBed = '';
      return next;
    });
  };

  const units = wards.length > 0
    ? wards.map(w => ({ ien: w.ien, name: w.name }))
    : [...new Set(beds.map(b => b.unit))].map(u => ({ ien: u, name: u }));

  const selectedWard = form.wardIen;
  const selectedWardName = units.find(u => u.ien === selectedWard)?.name || selectedWard;
  const bedsInWard = beds.filter(b => {
    if (!selectedWard) return false;
    if (b.status !== 'available') return false;
    if (wards.length > 0) {
      return b.unit === selectedWardName || b.wardIen === selectedWard;
    }
    return b.unit === selectedWard;
  });

  const allAvailable = beds.filter(b => b.status === 'available');
  const bedsToShow = selectedWard ? bedsInWard : allAvailable;

  const checklistComplete = form.consentSigned && form.valuablesInventory && form.allergyVerified && form.medReconciliation;

  const handleSubmit = async () => {
    if (!form.admittingDiagnosis || !form.wardIen || !form.roomBed || !form.admittingProvider) {
      setSaveError('Please fill all required fields: Diagnosis, Provider, Care Setting, and Room/Bed.');
      return;
    }
    if (!checklistComplete) {
      if (!window.confirm('The admission checklist is incomplete. Do you want to proceed anyway?')) return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await admitPatient(patientId, {
        ...form,
        wardName: units.find(u => u.ien === form.wardIen)?.name || form.wardIen,
        treatingSpecialtyName: specialties.find(s => s.ien === form.treatingSpecialty)?.name || form.treatingSpecialty,
      });
      if (res.ok) {
        setSuccessData(res.data);
      } else {
        setSaveError(res.error || 'Admission failed');
      }
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppShell breadcrumb="Patients › Admission">
        <PatientBanner />
        <div className="flex items-center justify-center py-20">
          <span className="material-symbols-outlined animate-spin text-[24px] text-[#999]">progress_activity</span>
        </div>
      </AppShell>
    );
  }

  if (successData) {
    return (
      <AppShell breadcrumb="Patients › Admission">
        <PatientBanner />
        <div className="px-6 py-5">
          <div className="max-w-xl mx-auto text-center py-12">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[32px] text-green-600">check_circle</span>
            </div>
            <h1 className="text-[24px] font-bold text-[#1A1A2E] mb-2">Patient Admitted Successfully</h1>
            <p className="text-[14px] text-[#666] mb-2">
              Admitted to <strong>{form.wardIen ? (units.find(u => u.ien === form.wardIen)?.name || form.wardIen) : ''}</strong> — Bed <strong>{form.roomBed}</strong>
            </p>
            {successData.source === 'mock' && (
              <p className="text-[12px] text-amber-600 mb-4">Data source: Mock (backend endpoint not yet available)</p>
            )}
            <p className="text-[13px] text-[#888] mb-6">
              Movement ID: <span className="font-mono">{successData.movementId || '—'}</span>
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link to={`/patients/${patientId}`}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#1A1A2E] text-white text-sm font-medium rounded-md hover:bg-[#2E5984] transition-colors">
                <span className="material-symbols-outlined text-[16px]">dashboard</span>
                View Patient Dashboard
              </Link>
              <Link to="/patients/beds"
                className="flex items-center gap-2 px-5 py-2.5 border border-[#E2E4E8] text-sm font-medium rounded-md hover:bg-[#F0F4F8] transition-colors">
                <span className="material-symbols-outlined text-[16px]">bed</span>
                Bed Management
              </Link>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumb="Patients › Admission">
      <PatientBanner />
      <div className="px-6 py-5">
        <h1 className="text-[28px] font-bold text-[#1A1A2E] mb-5">Admit Patient</h1>

        {saveError && (
          <div className="mb-4 px-4 py-3 bg-red-50 border-l-4 border-red-500 rounded-r-md text-sm text-red-800">{saveError}</div>
        )}

        {showInsuranceWarning && (
          <div className="mb-4 px-4 py-3 bg-amber-50 border-l-4 border-amber-500 rounded-r-md text-sm text-amber-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">warning</span>
              Insurance not verified or not on file. Please verify insurance coverage before admission.
            </div>
            <div className="flex gap-2">
              <Link to={`/patients/${patientId}/insurance`} className="text-amber-900 font-medium underline text-[12px]">
                Go to Insurance
              </Link>
              <button onClick={() => setShowInsuranceWarning(false)} className="text-amber-600 hover:text-amber-800 ml-2">
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-4">
            <div className="border border-[#E2E4E8] rounded-md p-5">
              <h2 className="text-[16px] font-semibold text-[#1A1A2E] mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-[#2E5984]">login</span>
                Admission Details
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="text-[12px] font-medium text-[#555]">Admitting Diagnosis <span className="text-red-500">*</span></label>
                  <input value={form.admittingDiagnosis} onChange={e => set('admittingDiagnosis', e.target.value)} className={`${inputCls} w-full`} placeholder="e.g., Chest pain, unspecified (R07.9)" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[12px] font-medium text-[#555]">Admitting Provider <span className="text-red-500">*</span></label>
                    {loadingProviders ? (
                      <div className="h-10 flex items-center gap-2 text-[#999] text-sm"><span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>Loading providers...</div>
                    ) : (
                      <select value={form.admittingProvider} onChange={e => set('admittingProvider', e.target.value)} className={`${selectCls} w-full`}>
                        <option value="">Select provider...</option>
                        {providers.length > 0
                          ? providers.slice(0, 50).map(p => <option key={p.duz || p.ien || p.name} value={p.name}>{p.name}</option>)
                          : <option value="DR. WILSON,SARAH">DR. WILSON,SARAH</option>
                        }
                      </select>
                    )}
                  </div>
                  <div>
                    <label className="text-[12px] font-medium text-[#555]">Admission Type</label>
                    <select value={form.admissionType} onChange={e => set('admissionType', e.target.value)} className={`${selectCls} w-full`}>
                      <option value="">Select...</option>
                      {ADMISSION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[12px] font-medium text-[#555]">Nursing Unit <span className="text-red-500">*</span></label>
                    {loadingWards ? (
                      <div className="h-10 flex items-center gap-2 text-[#999] text-sm"><span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>Loading units...</div>
                    ) : (
                      <select value={form.wardIen} onChange={e => set('wardIen', e.target.value)} className={`${selectCls} w-full`}>
                        <option value="">Select unit / floor...</option>
                        {units.map(u => <option key={u.ien} value={u.ien}>{u.name}</option>)}
                      </select>
                    )}
                  </div>
                  <div>
                    <label className="text-[12px] font-medium text-[#555]">Room / Bed <span className="text-red-500">*</span></label>
                    {loadingBeds ? (
                      <div className="h-10 flex items-center gap-2 text-[#999] text-sm"><span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>Loading beds...</div>
                    ) : (
                      <select value={form.roomBed} onChange={e => set('roomBed', e.target.value)} className={`${selectCls} w-full`} disabled={!selectedWard}>
                        <option value="">{selectedWard ? (bedsToShow.length === 0 ? 'No available beds in this unit' : 'Select bed...') : 'Select nursing unit first'}</option>
                        {bedsToShow.map(b => <option key={b.id} value={b.bed}>{b.bed}</option>)}
                      </select>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-[12px] font-medium text-[#555]">Care Setting</label>
                  {loadingSpecialties ? (
                    <div className="h-10 flex items-center gap-2 text-[#999] text-sm"><span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>Loading specialties...</div>
                  ) : (
                    <select value={form.treatingSpecialty} onChange={e => set('treatingSpecialty', e.target.value)} className={`${selectCls} w-full`}>
                      <option value="">Select care setting...</option>
                      {specialties.map(s => <option key={s.ien} value={s.ien}>{s.name}</option>)}
                    </select>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-[12px] font-medium text-[#555]">Source of Admission</label>
                    <select value={form.admissionSource} onChange={e => set('admissionSource', e.target.value)} className={`${selectCls} w-full`}>
                      <option value="">Select...</option>
                      {ADMISSION_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[12px] font-medium text-[#555]">Expected Length of Stay (days)</label>
                    <input type="number" min="1" value={form.expectedLos} onChange={e => set('expectedLos', e.target.value)} className={`${inputCls} w-full`} placeholder="3" />
                  </div>
                  <div>
                    <label className="text-[12px] font-medium text-[#555]">Admission Date / Time</label>
                    <input type="datetime-local" value={form.admissionDateTime} onChange={e => set('admissionDateTime', e.target.value)} className={`${inputCls} w-full`} />
                  </div>
                </div>
              </div>
            </div>

            <div className="border border-[#E2E4E8] rounded-md p-5">
              <h2 className="text-[16px] font-semibold text-[#1A1A2E] mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-[#2E5984]">checklist</span>
                Admission Checklist
              </h2>
              <div className="space-y-3">
                {[
                  { field: 'consentSigned', label: 'Consent form signed' },
                  { field: 'valuablesInventory', label: 'Valuables inventory completed' },
                  { field: 'allergyVerified', label: 'Allergy information verified' },
                  { field: 'medReconciliation', label: 'Medication reconciliation completed' },
                ].map(item => (
                  <label key={item.field} className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={form[item.field]} onChange={e => set(item.field, e.target.checked)}
                      className="w-5 h-5 rounded border-[#E2E4E8] text-[#2E5984] focus:ring-[#2E5984]" />
                    <span className={`text-[13px] ${form[item.field] ? 'text-green-700 line-through' : 'text-[#333]'}`}>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => navigate(`/patients/${patientId}`)}
                className="px-4 py-2 border border-[#E2E4E8] text-sm rounded-md hover:bg-[#F0F4F8]">Cancel</button>
              <button onClick={handleSubmit}
                disabled={saving || !form.admittingDiagnosis || !form.wardIen || !form.roomBed || !form.admittingProvider}
                className="flex items-center gap-2 px-5 py-2 bg-[#1A1A2E] text-white text-sm font-medium rounded-md hover:bg-[#2E5984] disabled:opacity-50 transition-colors">
                {saving && <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>}
                Admit Patient
              </button>
              {!checklistComplete && (
                <span className="text-[12px] text-amber-600 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">warning</span>
                  Checklist incomplete
                </span>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="border border-[#E2E4E8] rounded-md p-4 h-fit">
              <h3 className="text-[14px] font-semibold text-[#1A1A2E] mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#2E5984]">bed</span>
                Bed Availability
              </h3>
              {units.length === 0 ? (
                <p className="text-[12px] text-[#999]">No nursing unit data available</p>
              ) : units.map(unit => {
                const unitBeds = beds.filter(b => wards.length > 0 ? (b.unit === unit.name || b.wardIen === unit.ien) : b.unit === unit.name);
                const avail = unitBeds.filter(b => b.status === 'available').length;
                const total = unitBeds.length || 1;
                return (
                  <div key={unit.ien} className="mb-3 pb-3 border-b border-[#F0F0F0] last:border-0">
                    <p className="text-[12px] font-medium text-[#333] mb-1">{unit.name}</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-[#E2E4E8] rounded-full overflow-hidden">
                        <div className="h-full bg-[#2E5984] rounded-full" style={{ width: `${((total - avail) / total) * 100}%` }} />
                      </div>
                      <span className="text-[11px] text-[#888]">{avail}/{total} open</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {specialties.length > 0 && (
              <div className="border border-[#E2E4E8] rounded-md p-4 h-fit">
                <h3 className="text-[14px] font-semibold text-[#1A1A2E] mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#2E5984]">medical_services</span>
                  Treating Specialties
                </h3>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {specialties.slice(0, 20).map(s => (
                    <div key={s.ien} className="text-[12px] text-[#555] py-1 border-b border-[#F0F0F0] last:border-0">
                      {s.name}
                      {s.service && <span className="text-[#999] ml-1">({s.service})</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
