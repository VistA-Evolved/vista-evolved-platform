import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import AppShell from '../../components/shell/AppShell';
import PatientBanner from '../../components/shared/PatientBanner';
import { usePatient } from '../../components/shared/PatientContext';
import { getPatient, transferPatient, getBeds, getWards, getProviders, getTreatingSpecialties } from '../../services/patientService';

const inputCls = 'h-10 px-3 border border-[#E2E4E8] rounded-md text-sm text-[#333] focus:outline-none focus:border-[#2E5984] focus:ring-1 focus:ring-[#2E5984]';
const selectCls = `${inputCls} bg-white`;

const TRANSFER_REASONS = [
  'Clinical Improvement',
  'Clinical Deterioration',
  'Specialty Transfer',
  'Bed Management',
  'Patient Request',
  'Isolation Requirement',
];

export default function Transfer() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { patient, setPatient, hasPatient } = usePatient();
  const [loading, setLoading] = useState(true);
  const [beds, setBeds] = useState([]);
  const [wards, setWards] = useState([]);
  const [providers, setProviders] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [successData, setSuccessData] = useState(null);
  const [loadingWards, setLoadingWards] = useState(false);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [loadingSpecialties, setLoadingSpecialties] = useState(false);
  const [form, setForm] = useState({
    transferTo: '', roomBed: '', transferReason: '', attendingProvider: '',
    treatingSpecialty: '', transferDateTime: new Date().toISOString().slice(0, 16),
    transferNotes: '',
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      setLoadingWards(true);
      setLoadingProviders(true);
      setLoadingSpecialties(true);
      try {
        if (!hasPatient) {
          const pRes = await getPatient(patientId);
          if (pRes.ok) setPatient(pRes.data);
        }
        const [bedRes, wardRes, provRes, specRes] = await Promise.allSettled([
          getBeds(),
          getWards(),
          getProviders(),
          getTreatingSpecialties(),
        ]);
        if (bedRes.status === 'fulfilled') setBeds(bedRes.value.data || []);
        if (wardRes.status === 'fulfilled') setWards(wardRes.value.data || []);
        setLoadingWards(false);
        if (provRes.status === 'fulfilled') setProviders((provRes.value.data || []).filter(u => u.name));
        setLoadingProviders(false);
        if (specRes.status === 'fulfilled') setSpecialties(specRes.value.data || []);
        setLoadingSpecialties(false);
      } finally {
        setLoading(false);
      }
    })();
  }, [patientId, hasPatient, setPatient]);

  const set = (field, value) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'transferTo') next.roomBed = '';
      return next;
    });
  };

  const units = wards.length > 0
    ? wards.map(w => ({ ien: w.ien, name: w.name }))
    : [...new Set(beds.map(b => b.unit))].map(u => ({ ien: u, name: u }));

  const selectedWardName = units.find(u => u.ien === form.transferTo)?.name || form.transferTo;
  const availableInUnit = beds.filter(b => {
    if (!form.transferTo) return false;
    if (b.status !== 'available') return false;
    if (wards.length > 0) return b.unit === selectedWardName || b.wardIen === form.transferTo;
    return b.unit === form.transferTo;
  });

  const currentBed = beds.find(b => b.patientDfn === patientId);
  const currentWardName = currentBed?.unit || patient?.wardIen || '—';
  const currentBedName = currentBed?.bed || patient?.roomBed || '—';
  const isAdmitted = !!currentBed || patient?.admissionStatus === 'admitted' || patient?.status === 'inpatient';

  const handleSubmit = async () => {
    if (!form.transferTo) {
      setSaveError('Transfer-to nursing unit is required.');
      return;
    }
    if (!form.transferReason) {
      setSaveError('Transfer reason is required.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await transferPatient(patientId, {
        ...form,
        fromWard: currentWardName,
        fromBed: currentBedName,
        toWardName: selectedWardName,
      });
      if (res.ok) {
        setSuccessData(res.data);
      } else {
        setSaveError(res.error || 'Transfer failed');
      }
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppShell breadcrumb="Patients › Transfer">
        <PatientBanner />
        <div className="flex items-center justify-center py-20">
          <span className="material-symbols-outlined animate-spin text-[24px] text-[#999]">progress_activity</span>
        </div>
      </AppShell>
    );
  }

  if (successData) {
    return (
      <AppShell breadcrumb="Patients › Transfer">
        <PatientBanner />
        <div className="px-6 py-5">
          <div className="max-w-xl mx-auto text-center py-12">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[32px] text-green-600">check_circle</span>
            </div>
            <h1 className="text-[24px] font-bold text-[#1A1A2E] mb-2">Patient Transferred Successfully</h1>
            <p className="text-[14px] text-[#666] mb-2">
              Transferred from <strong>{currentWardName} — {currentBedName}</strong> to <strong>{selectedWardName} — {form.roomBed}</strong>
            </p>
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
    <AppShell breadcrumb="Patients › Transfer">
      <PatientBanner />
      <div className="px-6 py-5">
        <h1 className="text-[28px] font-bold text-[#1A1A2E] mb-5">Transfer Patient</h1>

        {!isAdmitted && (
          <div className="mb-4 px-4 py-3 bg-amber-50 border-l-4 border-amber-400 rounded-r-md">
            <div className="flex items-center gap-2 text-amber-800">
              <span className="material-symbols-outlined text-[18px]">info</span>
              <span className="text-sm font-medium">This patient does not appear to be currently admitted.</span>
            </div>
            <p className="text-xs text-amber-700 mt-1 ml-7">
              Transfers require an active admission. If the patient was recently admitted, this data may still be loading.
              <Link to={`/patients/${patientId}/admit`} className="ml-1 underline font-medium">Admit Patient</Link>
            </p>
          </div>
        )}

        {saveError && (
          <div className="mb-4 px-4 py-3 bg-red-50 border-l-4 border-red-500 rounded-r-md text-sm text-red-800">{saveError}</div>
        )}

        <div className="max-w-2xl space-y-5">
          <div className="border border-[#E2E4E8] rounded-md p-4 bg-[#FAFBFC]">
            <h3 className="text-[12px] text-[#888] uppercase tracking-wide mb-2">Current Location</h3>
            {currentBed ? (
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[20px] text-[#2E5984]">bed</span>
                <span className="text-[14px] font-medium text-[#1A1A2E]">{currentBed.unit} — {currentBed.bed}</span>
              </div>
            ) : patient?.roomBed ? (
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[20px] text-[#2E5984]">bed</span>
                <span className="text-[14px] font-medium text-[#1A1A2E]">Unit {patient.wardIen || '—'} — {patient.roomBed}</span>
              </div>
            ) : (
              <p className="text-[#999] text-[13px]">No current inpatient location recorded</p>
            )}
          </div>

          <div className="border border-[#E2E4E8] rounded-md p-5 space-y-4">
            <h2 className="text-[16px] font-semibold text-[#1A1A2E] flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-[#2E5984]">swap_horiz</span>
              Transfer Details
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[12px] font-medium text-[#555]">Transfer To (Nursing Unit) <span className="text-red-500">*</span></label>
                {loadingWards ? (
                  <div className="h-10 flex items-center gap-2 text-[#999] text-sm"><span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>Loading units...</div>
                ) : (
                  <select value={form.transferTo} onChange={e => set('transferTo', e.target.value)} className={`${selectCls} w-full`}>
                    <option value="">Select unit...</option>
                    {units.map(u => <option key={u.ien} value={u.ien}>{u.name}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="text-[12px] font-medium text-[#555]">Room / Bed</label>
                <select value={form.roomBed} onChange={e => set('roomBed', e.target.value)} className={`${selectCls} w-full`} disabled={!form.transferTo}>
                  <option value="">{form.transferTo ? (availableInUnit.length === 0 ? 'No available beds' : 'Select bed...') : 'Select unit first'}</option>
                  {availableInUnit.map(b => <option key={b.id} value={b.bed}>{b.bed}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-[12px] font-medium text-[#555]">Transfer Reason <span className="text-red-500">*</span></label>
              <select value={form.transferReason} onChange={e => set('transferReason', e.target.value)} className={`${selectCls} w-full`}>
                <option value="">Select reason...</option>
                {TRANSFER_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[12px] font-medium text-[#555]">New Care Setting</label>
              {loadingSpecialties ? (
                <div className="h-10 flex items-center gap-2 text-[#999] text-sm"><span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>Loading...</div>
              ) : (
                <select value={form.treatingSpecialty} onChange={e => set('treatingSpecialty', e.target.value)} className={`${selectCls} w-full`}>
                  <option value="">Select specialty...</option>
                  {specialties.map(s => <option key={s.ien} value={s.ien}>{s.name}</option>)}
                </select>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[12px] font-medium text-[#555]">New Attending Provider</label>
                {loadingProviders ? (
                  <div className="h-10 flex items-center gap-2 text-[#999] text-sm"><span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>Loading...</div>
                ) : (
                  <select value={form.attendingProvider} onChange={e => set('attendingProvider', e.target.value)} className={`${selectCls} w-full`}>
                    <option value="">Select provider...</option>
                    {providers.length > 0
                      ? providers.slice(0, 50).map(p => <option key={p.duz || p.ien || p.name} value={p.name}>{p.name}</option>)
                      : <option value="" disabled>No providers loaded</option>
                    }
                  </select>
                )}
              </div>
              <div>
                <label className="text-[12px] font-medium text-[#555]">Transfer Date / Time</label>
                <input type="datetime-local" value={form.transferDateTime} onChange={e => set('transferDateTime', e.target.value)} className={`${inputCls} w-full`} />
              </div>
            </div>
            <div>
              <label className="text-[12px] font-medium text-[#555]">Additional Notes</label>
              <textarea value={form.transferNotes} onChange={e => set('transferNotes', e.target.value)}
                className="w-full h-20 px-3 py-2 border border-[#E2E4E8] rounded-md text-sm text-[#333] focus:outline-none focus:border-[#2E5984] focus:ring-1 focus:ring-[#2E5984] resize-none"
                placeholder="Additional transfer notes..." />
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => navigate(`/patients/${patientId}`)}
              className="px-4 py-2 border border-[#E2E4E8] text-sm rounded-md hover:bg-[#F0F4F8]">Cancel</button>
            <button onClick={handleSubmit}
              disabled={saving || !form.transferTo || !form.transferReason}
              className="flex items-center gap-2 px-5 py-2 bg-[#1A1A2E] text-white text-sm font-medium rounded-md hover:bg-[#2E5984] disabled:opacity-50 transition-colors">
              {saving && <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>}
              Transfer Patient
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
