import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import AppShell from '../../components/shell/AppShell';
import PatientBanner from '../../components/shared/PatientBanner';
import { usePatient } from '../../components/shared/PatientContext';
import { getPatient, getPatientInsurance, addInsurance, updateInsurance, deleteInsurance, getInsuranceCompanies, verifyInsuranceEligibility } from '../../services/patientService';

const inputCls = 'h-10 px-3 border border-[#E2E4E8] rounded-md text-sm text-[#333] focus:outline-none focus:border-[#2E5984] focus:ring-1 focus:ring-[#2E5984]';
const selectCls = `${inputCls} bg-white`;

const RELATIONSHIPS = ['Self', 'Spouse', 'Parent', 'Other'];
const COVERAGE_TYPES = ['Inpatient', 'Outpatient', 'Pharmacy', 'Mental Health', 'All'];
const COB_RANKS = ['primary', 'secondary', 'tertiary'];

const EMPTY_FORM = {
  planName: '', companyIen: '', subscriberId: '', groupNumber: '', policyNumber: '',
  subscriberName: '', relationship: 'Self', coverageType: 'All',
  effectiveDate: '', expirationDate: '', type: 'primary',
};

function isExpired(expirationDate) {
  if (!expirationDate) return false;
  return new Date(expirationDate) < new Date();
}

function InsuranceCard({ ins, onEdit, onDelete, isPrimary }) {
  const expired = isExpired(ins.expirationDate);
  return (
    <div className={`border rounded-md overflow-hidden ${expired ? 'border-red-300 bg-red-50/30' : isPrimary ? 'border-[#2E5984]' : 'border-[#E2E4E8]'}`}>
      <div className={`px-4 py-3 flex items-center justify-between ${expired ? 'bg-red-50' : isPrimary ? 'bg-[#E8EEF5]' : 'bg-[#FAFBFC]'}`}>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-[#2E5984]">health_and_safety</span>
          <h3 className="text-[14px] font-semibold text-[#1A1A2E]">{ins.planName}</h3>
          {expired && (
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-red-200 text-red-800 flex items-center gap-1">
              <span className="material-symbols-outlined text-[10px]">warning</span>
              Expired
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${isPrimary ? 'bg-[#2E5984] text-white' : 'bg-gray-200 text-gray-600'}`}>
            {ins.type}
          </span>
          <button onClick={() => onEdit(ins)} className="p-1 text-[#666] hover:text-[#2E5984] transition-colors" title="Edit">
            <span className="material-symbols-outlined text-[16px]">edit</span>
          </button>
          <button onClick={() => onDelete(ins)} className="p-1 text-[#666] hover:text-red-600 transition-colors" title="Delete">
            <span className="material-symbols-outlined text-[16px]">delete</span>
          </button>
        </div>
      </div>
      <div className="p-4 grid grid-cols-3 gap-3 text-[13px]">
        <InfoField label="Subscriber ID" value={ins.subscriberId || '—'} />
        <InfoField label="Group Number" value={ins.groupNumber || '—'} />
        <InfoField label="Policy Number" value={ins.policyNumber || '—'} />
        <InfoField label="Subscriber Name" value={ins.subscriberName || '—'} />
        <InfoField label="Relationship" value={ins.relationship || '—'} />
        <InfoField label="Coverage Type" value={ins.coverageType || 'All'} />
        <InfoField label="Effective Date" value={ins.effectiveDate ? new Date(ins.effectiveDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'} />
        <InfoField label="Expiration Date" value={ins.expirationDate ? new Date(ins.expirationDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Ongoing'} />
        <InfoField label="COB Rank" value={(ins.type || '').charAt(0).toUpperCase() + (ins.type || '').slice(1)} />
      </div>
    </div>
  );
}

function InfoField({ label, value }) {
  return (
    <div>
      <p className="text-[11px] text-[#888] uppercase tracking-wide">{label}</p>
      <p className="text-[#333] font-medium">{value}</p>
    </div>
  );
}

function InsuranceModal({ title, form, setForm, companies, companySearch, setCompanySearch, saving, onSave, onClose }) {
  const filteredCompanies = companies.filter(c =>
    !companySearch || c.name.toLowerCase().includes(companySearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-[#1A1A2E] mb-4">{title}</h3>
        <div className="space-y-3">
          <div>
            <label className="text-[12px] font-medium text-[#555]">Insurance Company <span className="text-red-500">*</span></label>
            {companies.length > 0 ? (
              <div>
                <input
                  value={companySearch}
                  onChange={e => setCompanySearch(e.target.value)}
                  className={`${inputCls} w-full mb-1`}
                  placeholder="Search insurance companies..."
                />
                <select
                  value={form.planName}
                  onChange={e => {
                    const c = companies.find(co => co.name === e.target.value);
                    setForm(p => ({ ...p, planName: e.target.value, companyIen: c?.ien || '' }));
                  }}
                  className={`${selectCls} w-full`}
                  size={Math.min(filteredCompanies.length, 5)}
                >
                  {filteredCompanies.map(c => (
                    <option key={c.ien} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <input value={form.planName} onChange={e => setForm(p => ({ ...p, planName: e.target.value }))} className={`${inputCls} w-full`} placeholder="Enter insurance plan name" />
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[12px] font-medium text-[#555]">Subscriber ID</label>
              <input value={form.subscriberId} onChange={e => setForm(p => ({ ...p, subscriberId: e.target.value }))} className={`${inputCls} w-full`} />
            </div>
            <div>
              <label className="text-[12px] font-medium text-[#555]">Group Number</label>
              <input value={form.groupNumber} onChange={e => setForm(p => ({ ...p, groupNumber: e.target.value }))} className={`${inputCls} w-full`} />
            </div>
            <div>
              <label className="text-[12px] font-medium text-[#555]">Policy Number <span className="text-red-500">*</span></label>
              <input value={form.policyNumber} onChange={e => setForm(p => ({ ...p, policyNumber: e.target.value }))} className={`${inputCls} w-full`} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] font-medium text-[#555]">Subscriber Name</label>
              <input value={form.subscriberName} onChange={e => setForm(p => ({ ...p, subscriberName: e.target.value }))} className={`${inputCls} w-full`} placeholder="LAST,FIRST MI" />
            </div>
            <div>
              <label className="text-[12px] font-medium text-[#555]">Relationship to Patient</label>
              <select value={form.relationship} onChange={e => setForm(p => ({ ...p, relationship: e.target.value }))} className={`${selectCls} w-full`}>
                {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] font-medium text-[#555]">Coverage Type</label>
              <select value={form.coverageType} onChange={e => setForm(p => ({ ...p, coverageType: e.target.value }))} className={`${selectCls} w-full`}>
                {COVERAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[12px] font-medium text-[#555]">COB Rank</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className={`${selectCls} w-full`}>
                {COB_RANKS.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] font-medium text-[#555]">Plan Type</label>
              <select value={form.planType || ''} onChange={e => setForm(p => ({ ...p, planType: e.target.value }))} className={`${selectCls} w-full`}>
                <option value="">Select type...</option>
                {['HMO', 'PPO', 'POS', 'EPO', 'Indemnity', 'Medicare', 'Medicaid', 'TRICARE', 'Other'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[12px] font-medium text-[#555]">Authorization Number</label>
              <input value={form.authorizationNumber || ''} onChange={e => setForm(p => ({ ...p, authorizationNumber: e.target.value }))} className={`${inputCls} w-full`} placeholder="Pre-auth #" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] font-medium text-[#555]">Effective Date</label>
              <input type="date" value={form.effectiveDate} onChange={e => setForm(p => ({ ...p, effectiveDate: e.target.value }))} className={`${inputCls} w-full`} />
            </div>
            <div>
              <label className="text-[12px] font-medium text-[#555]">End Date</label>
              <input type="date" value={form.expirationDate} onChange={e => setForm(p => ({ ...p, expirationDate: e.target.value }))} className={`${inputCls} w-full`} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-[#E2E4E8] rounded-md hover:bg-[#F0F4F8]">Cancel</button>
          <button onClick={onSave} disabled={saving || !form.planName || !form.policyNumber}
            className="px-4 py-2 text-sm bg-[#1A1A2E] text-white rounded-md hover:bg-[#2E5984] disabled:opacity-50">
            {saving ? 'Saving...' : title.includes('Edit') ? 'Update Insurance' : 'Add Insurance'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InsuranceCoverage() {
  const { patientId } = useParams();
  const { setPatient, hasPatient } = usePatient();
  const [insurance, setInsurance] = useState([]);
  const [insuranceCompanies, setInsuranceCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingIns, setEditingIns] = useState(null);
  const [verifyMsg, setVerifyMsg] = useState(null);
  const [addForm, setAddForm] = useState({ ...EMPTY_FORM });
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM });
  const [companySearch, setCompanySearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [patRes, insRes, companiesRes] = await Promise.allSettled([
          !hasPatient ? getPatient(patientId) : Promise.resolve(null),
          getPatientInsurance(patientId),
          getInsuranceCompanies(),
        ]);
        if (patRes.status === 'fulfilled' && patRes.value?.ok) setPatient(patRes.value.data);
        if (insRes.status === 'fulfilled') setInsurance(insRes.value.data || []);
        if (companiesRes.status === 'fulfilled') setInsuranceCompanies(companiesRes.value.data || []);
      } finally {
        setLoading(false);
      }
    })();
  }, [patientId, hasPatient, setPatient]);

  const handleAdd = async () => {
    setSaving(true);
    try {
      const res = await addInsurance(patientId, addForm);
      if (res.ok) {
        setInsurance(prev => [...prev, { ...addForm, ...res.data }]);
        setShowAdd(false);
        setAddForm({ ...EMPTY_FORM });
        setCompanySearch('');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (ins) => {
    setEditingIns(ins);
    setEditForm({
      planName: ins.planName || '',
      companyIen: ins.companyIen || '',
      subscriberId: ins.subscriberId || '',
      groupNumber: ins.groupNumber || '',
      policyNumber: ins.policyNumber || '',
      subscriberName: ins.subscriberName || '',
      relationship: ins.relationship || 'Self',
      coverageType: ins.coverageType || 'All',
      effectiveDate: ins.effectiveDate || '',
      expirationDate: ins.expirationDate || '',
      type: ins.type || 'primary',
    });
    setCompanySearch('');
  };

  const handleUpdate = async () => {
    if (!editingIns) return;
    setSaving(true);
    try {
      const res = await updateInsurance(patientId, editingIns.id, editForm);
      if (res.ok) {
        setInsurance(prev => prev.map(ins =>
          ins.id === editingIns.id ? { ...ins, ...editForm, ...res.data } : ins
        ));
        setEditingIns(null);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ins) => {
    if (!window.confirm(`Delete insurance "${ins.planName}"? This action cannot be undone.`)) return;
    setDeleteError(null);
    try {
      const res = await deleteInsurance(patientId, ins.id);
      if (res.ok) {
        setInsurance(prev => prev.filter(i => i.id !== ins.id));
      } else {
        setDeleteError(res.error || 'Failed to delete insurance');
      }
    } catch (err) {
      setDeleteError(err.message);
    }
  };

  const handleVerify = async () => {
    if (insurance.length === 0) {
      setVerifyMsg({ type: 'warning', text: 'No insurance on file to verify. Please add insurance first.' });
      return;
    }
    setVerifyMsg({ type: 'info', text: 'Eligibility verification in progress...' });
    try {
      const res = await verifyInsuranceEligibility(patientId);
      if (res.ok) {
        const d = res.data;
        if (d.status === 'active') {
          setVerifyMsg({ type: 'success', text: `Verified: ${d.activePolicies} active polic${d.activePolicies === 1 ? 'y' : 'ies'} confirmed.` });
        } else if (d.status === 'expired') {
          setVerifyMsg({ type: 'warning', text: 'Warning: All insurance policies on file have expired. Coverage may not be active.' });
        } else {
          setVerifyMsg({ type: 'warning', text: d.message || 'Eligibility status could not be determined.' });
        }
      } else {
        setVerifyMsg({ type: 'warning', text: res.error || 'Eligibility verification failed.' });
      }
    } catch (err) {
      setVerifyMsg({ type: 'warning', text: err.message || 'Eligibility verification failed.' });
    }
  };

  const sortedInsurance = [...insurance].sort((a, b) => {
    const order = { primary: 0, secondary: 1, tertiary: 2 };
    return (order[a.type] ?? 3) - (order[b.type] ?? 3);
  });

  return (
    <AppShell breadcrumb="Patients › Insurance & Coverage">
      <PatientBanner />
      <div className="px-6 py-5">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-[28px] font-bold text-[#1A1A2E]">Insurance & Coverage</h1>
          <div className="flex gap-2">
            <button onClick={() => { setShowAdd(true); setCompanySearch(''); }}
              className="flex items-center gap-2 px-4 py-2 bg-[#1A1A2E] text-white text-sm font-medium rounded-md hover:bg-[#2E5984] transition-colors">
              <span className="material-symbols-outlined text-[16px]">add</span>
              Add Insurance
            </button>
            <button onClick={handleVerify}
              className="flex items-center gap-2 px-4 py-2 border border-[#E2E4E8] text-sm rounded-md hover:bg-[#F0F4F8]">
              <span className="material-symbols-outlined text-[16px]">verified</span>
              Verify Eligibility
            </button>
          </div>
        </div>

        {verifyMsg && (
          <div className={`mb-4 px-4 py-3 rounded-md border-l-4 text-sm flex items-center gap-2 ${
            verifyMsg.type === 'success' ? 'bg-green-50 border-green-500 text-green-800' :
            verifyMsg.type === 'warning' ? 'bg-amber-50 border-amber-500 text-amber-800' :
            'bg-blue-50 border-blue-500 text-blue-800'
          }`}>
            <span className="material-symbols-outlined text-[16px]">
              {verifyMsg.type === 'success' ? 'check_circle' : verifyMsg.type === 'warning' ? 'warning' : 'info'}
            </span>
            {verifyMsg.text}
            <button onClick={() => setVerifyMsg(null)} className="ml-auto text-[#999] hover:text-[#333]">
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          </div>
        )}

        {deleteError && (
          <div className="mb-4 px-4 py-3 bg-red-50 border-l-4 border-red-500 rounded-r-md text-sm text-red-800">{deleteError}</div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <span className="material-symbols-outlined animate-spin text-[24px] text-[#999]">progress_activity</span>
          </div>
        ) : insurance.length === 0 ? (
          <div className="text-center py-12 border border-[#E2E4E8] rounded-md bg-[#FAFBFC]">
            <span className="material-symbols-outlined text-[40px] text-[#ccc] mb-2 block">health_and_safety</span>
            <p className="text-[#888]">No insurance information on file</p>
            <button onClick={() => setShowAdd(true)} className="mt-3 text-sm text-[#2E5984] hover:underline">Add Insurance</button>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedInsurance.map((ins, i) => (
              <InsuranceCard
                key={ins.id || i}
                ins={ins}
                isPrimary={ins.type === 'primary'}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {showAdd && (
          <InsuranceModal
            title="Add Insurance"
            form={addForm}
            setForm={setAddForm}
            companies={insuranceCompanies}
            companySearch={companySearch}
            setCompanySearch={setCompanySearch}
            saving={saving}
            onSave={handleAdd}
            onClose={() => { setShowAdd(false); setCompanySearch(''); }}
          />
        )}

        {editingIns && (
          <InsuranceModal
            title="Edit Insurance"
            form={editForm}
            setForm={setEditForm}
            companies={insuranceCompanies}
            companySearch={companySearch}
            setCompanySearch={setCompanySearch}
            saving={saving}
            onSave={handleUpdate}
            onClose={() => { setEditingIns(null); setCompanySearch(''); }}
          />
        )}
      </div>
    </AppShell>
  );
}
