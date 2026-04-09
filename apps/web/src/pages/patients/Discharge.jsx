import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import AppShell from '../../components/shell/AppShell';
import PatientBanner from '../../components/shared/PatientBanner';
import { usePatient } from '../../components/shared/PatientContext';
import { ConfirmDialog } from '../../components/shared/SharedComponents';
import { getPatient, dischargePatient, getProviders } from '../../services/patientService';

const inputCls = 'h-10 px-3 border border-[#E2E4E8] rounded-md text-sm text-[#333] focus:outline-none focus:border-[#2E5984] focus:ring-1 focus:ring-[#2E5984]';
const selectCls = `${inputCls} bg-white`;

const DISCHARGE_DISPOSITIONS = [
  'Home',
  'SNF',
  'Rehab',
  'AMA',
  'Expired',
  'Transfer Out',
];

const DISCHARGE_CONDITIONS = [
  'Improved',
  'Stable',
  'Unchanged',
  'Deteriorated',
  'Expired',
];

export default function Discharge() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { patient, setPatient, hasPatient } = usePatient();
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [successData, setSuccessData] = useState(null);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [amaPrompt, setAmaPrompt] = useState(false);
  const [checklistPrompt, setChecklistPrompt] = useState(false);
  const [form, setForm] = useState({
    dischargeDateTime: new Date().toISOString().slice(0, 16),
    dischargeDisposition: '',
    dischargeDiagnosis: '',
    dischargeCondition: '',
    dischargeProvider: '',
    followUpInstructions: '',
    dischargeMedications: '',
    rxSent: false, followUpScheduled: false, instructionsGiven: false, valuablesReturned: false,
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      setLoadingProviders(true);
      try {
        const [patRes, provRes] = await Promise.allSettled([
          !hasPatient ? getPatient(patientId) : Promise.resolve(null),
          getProviders(),
        ]);
        if (patRes.status === 'fulfilled' && patRes.value?.ok) setPatient(patRes.value.data);
        if (provRes.status === 'fulfilled') {
          setProviders((provRes.value.data || []).filter(u => u.name));
        }
        setLoadingProviders(false);
      } finally {
        setLoading(false);
      }
    })();
  }, [patientId, hasPatient, setPatient]);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const checklistComplete = form.rxSent && form.followUpScheduled && form.instructionsGiven && form.valuablesReturned;
  const isAMA = form.dischargeDisposition === 'AMA';

  const handleSubmit = async () => {
    if (!form.dischargeDateTime) {
      setSaveError('Discharge date/time is required.');
      return;
    }
    if (!form.dischargeDisposition) {
      setSaveError('Discharge disposition is required.');
      return;
    }
    if (!form.dischargeProvider) {
      setSaveError('Discharging provider is required.');
      return;
    }
    if (isAMA) {
      setAmaPrompt(true);
      return;
    }
    if (!checklistComplete) {
      setChecklistPrompt(true);
      return;
    }
    await doSubmit();
  };

  const doSubmit = async () => {
    setAmaPrompt(false);
    setChecklistPrompt(false);
    setSaving(true);
    setSaveError(null);
    try {
      const res = await dischargePatient(patientId, {
        ...form,
        wardName: patient?.wardIen || '',
        roomBed: patient?.roomBed || '',
      });
      if (res.ok) {
        setSuccessData(res.data);
      } else {
        setSaveError(res.error || 'Discharge failed');
      }
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // When the AMA dialog is accepted, we still need to check the checklist
  const confirmAma = () => {
    setAmaPrompt(false);
    if (!checklistComplete) {
      setChecklistPrompt(true);
    } else {
      doSubmit();
    }
  };

  if (loading) {
    return (
      <AppShell breadcrumb="Patients › Discharge">
        <PatientBanner />
        <div className="flex items-center justify-center py-20">
          <span className="material-symbols-outlined animate-spin text-[24px] text-[#999]">progress_activity</span>
        </div>
      </AppShell>
    );
  }

  if (successData) {
    return (
      <AppShell breadcrumb="Patients › Discharge">
        <PatientBanner />
        <div className="px-6 py-5">
          <div className="max-w-xl mx-auto text-center py-12">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[32px] text-green-600">check_circle</span>
            </div>
            <h1 className="text-[24px] font-bold text-[#1A1A2E] mb-2">Patient Discharged Successfully</h1>
            <p className="text-[14px] text-[#666] mb-2">
              Disposition: <strong>{form.dischargeDisposition}</strong> — Condition: <strong>{form.dischargeCondition || 'N/A'}</strong>
            </p>
            {patient?.roomBed && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-md text-[13px] text-blue-800 mb-4">
                <span className="material-symbols-outlined text-[14px]">bed</span>
                Bed <strong>{patient.roomBed}</strong> has been freed and is now available
              </div>
            )}
            {patient?.admissionDateTime && form.dischargeDateTime && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#F0F4F8] border border-[#E2E4E8] rounded-md text-[13px] text-[#333] mb-4 ml-2">
                <span className="material-symbols-outlined text-[14px]">schedule</span>
                Length of Stay: <strong>{(() => {
                  const admit = new Date(patient.admissionDateTime);
                  const discharge = new Date(form.dischargeDateTime);
                  const diffMs = discharge - admit;
                  const days = Math.floor(diffMs / 86400000);
                  const hours = Math.floor((diffMs % 86400000) / 3600000);
                  return days > 0 ? `${days} day${days !== 1 ? 's' : ''}, ${hours} hr${hours !== 1 ? 's' : ''}` : `${hours} hour${hours !== 1 ? 's' : ''}`;
                })()}</strong>
              </div>
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
    <AppShell breadcrumb="Patients › Discharge">
      <PatientBanner />
      <div className="px-6 py-5">
        <h1 className="text-[28px] font-bold text-[#1A1A2E] mb-5">Discharge Patient</h1>

        {!(patient?.admissionStatus === 'admitted' || patient?.status === 'inpatient' || patient?.roomBed) && (
          <div className="mb-4 px-4 py-3 bg-amber-50 border-l-4 border-amber-400 rounded-r-md">
            <div className="flex items-center gap-2 text-amber-800">
              <span className="material-symbols-outlined text-[18px]">info</span>
              <span className="text-sm font-medium">This patient does not appear to be currently admitted.</span>
            </div>
            <p className="text-xs text-amber-700 mt-1 ml-7">
              Discharge requires an active admission. If the patient was recently admitted, this data may still be loading.
            </p>
          </div>
        )}

        {saveError && (
          <div className="mb-4 px-4 py-3 bg-red-50 border-l-4 border-red-500 rounded-r-md text-sm text-red-800">{saveError}</div>
        )}

        {isAMA && (
          <div className="mb-4 px-4 py-3 bg-red-50 border-l-4 border-red-600 rounded-r-md text-sm text-red-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <strong>AMA Discharge:</strong> Against Medical Advice discharge requires additional documentation. Ensure the patient has been counseled and AMA form is signed.
          </div>
        )}

        <div className="max-w-3xl space-y-5">
          <div className="border border-[#E2E4E8] rounded-md p-5 space-y-4">
            <h2 className="text-[16px] font-semibold text-[#1A1A2E] flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-[#2E5984]">logout</span>
              Discharge Details
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[12px] font-medium text-[#555]">Discharge Date / Time <span className="text-red-500">*</span></label>
                <input type="datetime-local" value={form.dischargeDateTime} onChange={e => set('dischargeDateTime', e.target.value)} className={`${inputCls} w-full`} />
              </div>
              <div>
                <label className="text-[12px] font-medium text-[#555]">Discharge Disposition <span className="text-red-500">*</span></label>
                <select value={form.dischargeDisposition} onChange={e => set('dischargeDisposition', e.target.value)} className={`${selectCls} w-full`}>
                  <option value="">Select disposition...</option>
                  {DISCHARGE_DISPOSITIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-[12px] font-medium text-[#555]">Discharge Diagnosis</label>
              <input value={form.dischargeDiagnosis} onChange={e => set('dischargeDiagnosis', e.target.value)} className={`${inputCls} w-full`} placeholder="e.g., Pneumonia, resolved (J18.9)" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[12px] font-medium text-[#555]">Discharge Condition</label>
                <select value={form.dischargeCondition} onChange={e => set('dischargeCondition', e.target.value)} className={`${selectCls} w-full`}>
                  <option value="">Select condition...</option>
                  {DISCHARGE_CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[12px] font-medium text-[#555]">Discharging Provider <span className="text-red-500">*</span></label>
                {loadingProviders ? (
                  <div className="h-10 flex items-center gap-2 text-[#999] text-sm"><span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>Loading...</div>
                ) : (
                  <select value={form.dischargeProvider} onChange={e => set('dischargeProvider', e.target.value)} className={`${selectCls} w-full`}>
                    <option value="">Select provider...</option>
                    {providers.length > 0
                      ? providers.slice(0, 50).map(p => <option key={p.duz || p.ien || p.name} value={p.name}>{p.name}</option>)
                      : <option value="" disabled>No providers loaded</option>
                    }
                  </select>
                )}
              </div>
            </div>
          </div>

          <div className="border border-[#E2E4E8] rounded-md p-5 space-y-4">
            <h2 className="text-[16px] font-semibold text-[#1A1A2E] flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-[#2E5984]">medication</span>
              Follow-Up & Instructions
            </h2>
            <div>
              <label className="text-[12px] font-medium text-[#555]">Follow-Up Instructions</label>
              <textarea value={form.followUpInstructions} onChange={e => set('followUpInstructions', e.target.value)}
                className="w-full h-24 px-3 py-2 border border-[#E2E4E8] rounded-md text-sm text-[#333] focus:outline-none focus:border-[#2E5984] focus:ring-1 focus:ring-[#2E5984] resize-none"
                placeholder="Follow-up appointment details, care instructions, activity restrictions..." />
            </div>
            <div>
              <label className="text-[12px] font-medium text-[#555]">Discharge Medications</label>
              <textarea value={form.dischargeMedications} onChange={e => set('dischargeMedications', e.target.value)}
                className="w-full h-20 px-3 py-2 border border-[#E2E4E8] rounded-md text-sm text-[#333] focus:outline-none focus:border-[#2E5984] focus:ring-1 focus:ring-[#2E5984] resize-none"
                placeholder="List discharge medications..." />
            </div>
          </div>

          <div className="border border-[#E2E4E8] rounded-md p-5">
            <h2 className="text-[16px] font-semibold text-[#1A1A2E] mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-[#2E5984]">checklist</span>
              Discharge Checklist
            </h2>
            <div className="space-y-3">
              {[
                { field: 'rxSent', label: 'Prescriptions sent to pharmacy' },
                { field: 'followUpScheduled', label: 'Follow-up appointment scheduled' },
                { field: 'instructionsGiven', label: 'Discharge instructions given to patient' },
                { field: 'valuablesReturned', label: 'Valuables returned to patient' },
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
              disabled={saving || !form.dischargeDisposition || !form.dischargeDateTime || !form.dischargeProvider}
              className="flex items-center gap-2 px-5 py-2 bg-[#1A1A2E] text-white text-sm font-medium rounded-md hover:bg-[#2E5984] disabled:opacity-50 transition-colors">
              {saving && <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>}
              Discharge Patient
            </button>
            {!checklistComplete && (
              <span className="text-[12px] text-amber-600 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">warning</span>
                Checklist incomplete
              </span>
            )}
          </div>
        </div>
      </div>

      {amaPrompt && (
        <ConfirmDialog
          title="Discharge Against Medical Advice"
          message="This patient is being discharged Against Medical Advice (AMA). AMA discharge requires additional documentation on the chart and an incident note. Confirm that you intend to proceed."
          confirmLabel="Proceed with AMA discharge"
          cancelLabel="Go back"
          onConfirm={confirmAma}
          onCancel={() => setAmaPrompt(false)}
          destructive
        />
      )}

      {checklistPrompt && (
        <ConfirmDialog
          title="Incomplete Discharge Checklist"
          message="The discharge checklist is incomplete. One or more required items (discharge instructions, medication reconciliation, follow-up scheduled, or equipment returned) are still pending. Do you want to proceed anyway?"
          confirmLabel="Proceed with discharge"
          cancelLabel="Go back"
          onConfirm={doSubmit}
          onCancel={() => setChecklistPrompt(false)}
        />
      )}
    </AppShell>
  );
}
