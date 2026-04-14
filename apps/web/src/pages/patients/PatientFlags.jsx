import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import AppShell from '../../components/shell/AppShell';
import PatientBanner from '../../components/shared/PatientBanner';
import { usePatient } from '../../components/shared/PatientContext';
import { getPatient, getPatientFlags, getPatientFlagDefinitions, addPatientFlag, inactivatePatientFlag, updatePatientFlag } from '../../services/patientService';

const inputCls = 'h-10 px-3 border border-[#E2E4E8] rounded-md text-sm text-[#333] focus:outline-none focus:border-[#2E5984] focus:ring-1 focus:ring-[#2E5984]';

const FLAG_TYPES = ['Behavioral', 'Safety', 'Clinical', 'Administrative'];
const FLAG_CATEGORIES_LEVEL = ['I - National', 'II - Local'];

const CATEGORY_STYLES = {
  Behavioral:     { bg: 'bg-red-100',   text: 'text-red-800',   border: 'border-red-300',   icon: 'warning',             dot: 'bg-red-500' },
  Safety:         { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300', icon: 'shield',              dot: 'bg-amber-500' },
  Clinical:       { bg: 'bg-blue-100',  text: 'text-blue-800',  border: 'border-blue-300',  icon: 'medical_information', dot: 'bg-blue-500' },
  Administrative: { bg: 'bg-gray-100',  text: 'text-gray-700',  border: 'border-gray-300',  icon: 'assignment',          dot: 'bg-gray-500' },
  Research:       { bg: 'bg-teal-100',  text: 'text-teal-800',  border: 'border-teal-300',  icon: 'science',             dot: 'bg-teal-500' },
};

export default function PatientFlags() {
  useEffect(() => { document.title = 'Patient Flags — VistA Evolved'; }, []);
  const { patientId } = useParams();
  const { patient, setPatient, hasPatient } = usePatient();
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedFlag, setSelectedFlag] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [inactivateReason, setInactivateReason] = useState('');
  const [showInactivatePrompt, setShowInactivatePrompt] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', category: '', categoryLevel: '', narrative: '', reviewDate: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [flagDefs, setFlagDefs] = useState([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        if (!hasPatient) {
          const pRes = await getPatient(patientId);
          if (pRes.ok) setPatient(pRes.data);
        }
        const [flagRes, defsRes] = await Promise.all([
          getPatientFlags(patientId),
          getPatientFlagDefinitions(),
        ]);
        setFlags(flagRes.data || []);
        setFlagDefs(defsRes.data || []);
      } finally {
        setLoading(false);
      }
    })();
  }, [patientId, hasPatient, setPatient]);

  const activeFlags = flags.filter(f => f.status === 'active');
  const inactiveFlags = flags.filter(f => f.status !== 'active');

  const handleAdd = async () => {
    if (!addForm.name || !addForm.category || !addForm.narrative) {
      setSaveError('Flag type, category, and narrative are required.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await addPatientFlag(patientId, {
        ...addForm,
        flagName: addForm.name,
        assignedDate: new Date().toISOString().slice(0, 10),
        status: 'active',
      });
      if (res.ok) {
        setFlags(prev => [...prev, res.data]);
        setShowAdd(false);
        setAddForm({ name: '', category: '', categoryLevel: '', narrative: '', reviewDate: '' });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleInactivate = async () => {
    if (!selectedFlag || !inactivateReason.trim()) return;
    try {
      const res = await inactivatePatientFlag(patientId, selectedFlag.id);
      if (res.ok) {
        setFlags(prev => prev.map(f => f.id === selectedFlag.id ? { ...f, status: 'inactive', inactivateReason: inactivateReason } : f));
        setSelectedFlag(prev => ({ ...prev, status: 'inactive' }));
        setShowInactivatePrompt(false);
        setInactivateReason('');
      }
    } catch (err) {
      setSaveError(err.message);
    }
  };

  const handleExtendReview = async () => {
    if (!selectedFlag) return;
    const base = selectedFlag.reviewDate ? new Date(selectedFlag.reviewDate + 'T00:00:00') : new Date();
    base.setDate(base.getDate() + 90);
    const dateStr = base.toISOString().slice(0, 10);
    try {
      await updatePatientFlag(patientId, selectedFlag.id, { reviewDate: dateStr });
      setFlags(prev => prev.map(f => f.id === selectedFlag.id ? { ...f, reviewDate: dateStr } : f));
      setSelectedFlag(prev => ({ ...prev, reviewDate: dateStr }));
    } catch (err) {
      setSaveError(err.message || 'Failed to extend review date');
    }
  };

  const handlePrint = () => window.print();

  const cwad = {
    crisis: patient?.flags?.some(f => f.name?.toLowerCase().includes('crisis') || f.name?.toLowerCase().includes('suicide')) || activeFlags.some(f => f.name?.toLowerCase().includes('crisis') || f.name?.toLowerCase().includes('suicide')),
    warnings: activeFlags.filter(f => f.category === 'Behavioral' || f.category === 'Safety').length > 0,
    allergies: patient?.allergies?.length > 0,
    directives: !!patient?.codeStatus,
  };

  return (
    <AppShell breadcrumb="Patients › Patient Flags">
      <PatientBanner />
      <div className="px-6 py-5">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-[28px] font-bold text-[#1A1A2E]">Patient Flags</h1>
          <div className="flex gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 border border-[#E2E4E8] text-sm rounded-md hover:bg-[#F0F4F8]">
              <span className="material-symbols-outlined text-[16px]">print</span>
              Print Flags
            </button>
            <button onClick={() => { setShowAdd(true); setSaveError(null); }}
              className="flex items-center gap-2 px-4 py-2 bg-[#1A1A2E] text-white text-sm font-medium rounded-md hover:bg-[#2E5984] transition-colors">
              <span className="material-symbols-outlined text-[16px]">add</span>
              Add Flag
            </button>
          </div>
        </div>

        {/* CWAD Bar */}
        <div className="flex gap-3 mb-5">
          {[
            { key: 'crisis', label: 'Crisis Notes', active: cwad.crisis, color: 'red' },
            { key: 'warnings', label: 'Warnings', active: cwad.warnings, color: 'amber' },
            { key: 'allergies', label: 'Allergies', active: cwad.allergies, color: 'orange', detail: patient?.allergies?.join(', ') },
            { key: 'directives', label: 'Advance Directives', active: cwad.directives, color: 'blue', detail: patient?.codeStatus },
          ].map(item => (
            <div key={item.key} className={`flex-1 border rounded-md p-3 ${item.active ? `border-${item.color}-300 bg-${item.color}-50` : 'border-[#E2E4E8] bg-[#FAFBFC]'}`}>
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2.5 h-2.5 rounded-full ${item.active ? `bg-${item.color}-500` : 'bg-gray-300'}`} />
                <span className={`text-[11px] font-bold uppercase tracking-wide ${item.active ? `text-${item.color}-800` : 'text-[#999]'}`}>
                  {item.label}
                </span>
              </div>
              {item.active && item.detail && (
                <p className={`text-[11px] text-${item.color}-700 mt-1 truncate`}>{item.detail}</p>
              )}
              {!item.active && <p className="text-[10px] text-[#ccc]">None</p>}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <span className="material-symbols-outlined animate-spin text-[24px] text-[#999]">progress_activity</span>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-5">
            <div className="col-span-2 space-y-4">
              {/* Active Flags */}
              <div className="border border-[#E2E4E8] rounded-md overflow-hidden">
                <div className="px-4 py-3 bg-[#1A1A2E] text-white flex items-center justify-between">
                  <h3 className="text-[13px] font-semibold">Active Flags ({activeFlags.length})</h3>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#FAFBFC] text-left text-[11px] uppercase tracking-wide text-[#888]">
                      <th className="px-4 py-2.5 font-semibold">Flag Name</th>
                      <th className="px-4 py-2.5 font-semibold">Type</th>
                      <th className="px-4 py-2.5 font-semibold">Category</th>
                      <th className="px-4 py-2.5 font-semibold">Assigned</th>
                      <th className="px-4 py-2.5 font-semibold">Assigned By</th>
                      <th className="px-4 py-2.5 font-semibold">Review Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeFlags.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-12 text-center text-[#999]">No active flags for this patient</td></tr>
                    ) : activeFlags.map((f, i) => {
                      const cs = CATEGORY_STYLES[f.category] || CATEGORY_STYLES.Administrative;
                      const isSelected = selectedFlag?.id === f.id;
                      return (
                        <tr key={f.id || i}
                          onClick={() => setSelectedFlag(f)}
                          className={`border-t border-[#E2E4E8] cursor-pointer hover:bg-[#F0F4F8] transition-colors ${isSelected ? 'bg-[#E8EEF5]' : i % 2 === 0 ? 'bg-white' : 'bg-[#FAFBFC]'}`}>
                          <td className="px-4 py-3 font-semibold text-[#1A1A2E]">
                            <div className="flex items-center gap-2">
                              <div className={`w-2.5 h-2.5 rounded-full ${cs.dot}`} />
                              {f.name}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${cs.bg} ${cs.text}`}>{f.category}</span>
                          </td>
                          <td className="px-4 py-3 text-[#555] text-[12px]">{f.categoryLevel || '—'}</td>
                          <td className="px-4 py-3 text-[#555]">{f.assignedDate || '—'}</td>
                          <td className="px-4 py-3 text-[#555]">{f.assignedBy || '—'}</td>
                          <td className="px-4 py-3 text-[#555]">{f.reviewDate || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Flag History */}
              <div className="border border-[#E2E4E8] rounded-md overflow-hidden">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="w-full px-4 py-3 bg-[#FAFBFC] flex items-center justify-between hover:bg-[#F0F4F8] transition-colors">
                  <h3 className="text-[13px] font-semibold text-[#555]">Flag History ({inactiveFlags.length})</h3>
                  <span className="material-symbols-outlined text-[16px] text-[#888]">
                    {showHistory ? 'expand_less' : 'expand_more'}
                  </span>
                </button>
                {showHistory && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#FAFBFC] text-left text-[11px] uppercase tracking-wide text-[#888]">
                        <th className="px-4 py-2.5 font-semibold">Flag Name</th>
                        <th className="px-4 py-2.5 font-semibold">Type</th>
                        <th className="px-4 py-2.5 font-semibold">Assigned</th>
                        <th className="px-4 py-2.5 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inactiveFlags.length === 0 ? (
                        <tr><td colSpan={4} className="px-4 py-8 text-center text-[#ccc]">No inactive or expired flags</td></tr>
                      ) : inactiveFlags.map((f, i) => {
                        const cs = CATEGORY_STYLES[f.category] || CATEGORY_STYLES.Administrative;
                        return (
                          <tr key={f.id || i} className={`border-t border-[#E2E4E8] ${i % 2 === 0 ? 'bg-white' : 'bg-[#FAFBFC]'}`}>
                            <td className="px-4 py-3 text-[#999]">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full bg-gray-300`} />
                                <span className="line-through">{f.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-500">{f.category}</span>
                            </td>
                            <td className="px-4 py-3 text-[#999]">{f.assignedDate || '—'}</td>
                            <td className="px-4 py-3">
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-600">Inactive</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Detail Panel */}
            <div className="border border-[#E2E4E8] rounded-md p-4 h-fit sticky top-14">
              {selectedFlag ? (() => {
                const cs = CATEGORY_STYLES[selectedFlag.category] || CATEGORY_STYLES.Administrative;
                return (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-3 h-3 rounded-full ${cs.dot}`} />
                      <h3 className="text-[16px] font-semibold text-[#1A1A2E]">{selectedFlag.name}</h3>
                    </div>
                    <div className="space-y-2 text-[13px] mb-4">
                      <div className="flex justify-between py-1.5 border-b border-[#F0F0F0]">
                        <span className="text-[#888]">Type</span>
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${cs.bg} ${cs.text}`}>{selectedFlag.category}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-[#F0F0F0]">
                        <span className="text-[#888]">Category</span>
                        <span className="text-[#333] font-medium">{selectedFlag.categoryLevel || '—'}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-[#F0F0F0]">
                        <span className="text-[#888]">Status</span>
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${selectedFlag.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                          {selectedFlag.status?.charAt(0).toUpperCase() + selectedFlag.status?.slice(1)}
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-[#F0F0F0]">
                        <span className="text-[#888]">Assigned</span>
                        <span className="text-[#333] font-medium">{selectedFlag.assignedDate}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-[#F0F0F0]">
                        <span className="text-[#888]">Assigned By</span>
                        <span className="text-[#333] font-medium">{selectedFlag.assignedBy}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-[#F0F0F0]">
                        <span className="text-[#888]">Review Date</span>
                        <span className="text-[#333] font-medium">{selectedFlag.reviewDate || '—'}</span>
                      </div>
                    </div>
                    {selectedFlag.narrative && (
                      <div className="mb-4">
                        <p className="text-[11px] text-[#888] uppercase tracking-wide mb-1">Narrative</p>
                        <p className="text-[13px] text-[#333] bg-[#FAFBFC] rounded-md p-3 border border-[#E2E4E8]">{selectedFlag.narrative}</p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setShowInactivatePrompt(true);
                          setInactivateReason('');
                        }}
                        disabled={selectedFlag.status === 'inactive'}
                        className="flex-1 px-3 py-2 text-[12px] border border-red-200 text-red-700 rounded-md hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed">
                        Inactivate
                      </button>
                      <button
                        onClick={handleExtendReview}
                        disabled={selectedFlag.status === 'inactive'}
                        className="flex-1 px-3 py-2 text-[12px] border border-[#E2E4E8] rounded-md hover:bg-[#F0F4F8] disabled:opacity-50">
                        Extend Review (+90d)
                      </button>
                    </div>
                  </div>
                );
              })() : (
                <div className="text-center py-8">
                  <span className="material-symbols-outlined text-[32px] text-[#ccc] mb-2 block">flag</span>
                  <p className="text-[13px] text-[#999]">Select a flag to view details</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Inactivate Reason Prompt */}
        {showInactivatePrompt && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
              <h3 className="text-lg font-semibold text-[#1A1A2E] mb-2">Inactivate Flag</h3>
              <p className="text-[13px] text-[#666] mb-4">
                Inactivating flag: <strong>{selectedFlag?.name}</strong>. Please provide a reason.
              </p>
              <textarea
                value={inactivateReason}
                onChange={e => setInactivateReason(e.target.value)}
                className="w-full h-20 px-3 py-2 border border-[#E2E4E8] rounded-md text-sm text-[#333] focus:outline-none focus:border-[#2E5984] focus:ring-1 focus:ring-[#2E5984] resize-none"
                placeholder="Reason for inactivation (required)..."
              />
              <div className="flex justify-end gap-3 mt-4">
                <button onClick={() => setShowInactivatePrompt(false)} className="px-4 py-2 text-sm border border-[#E2E4E8] rounded-md hover:bg-[#F0F4F8]">Cancel</button>
                <button onClick={handleInactivate} disabled={!inactivateReason.trim()}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50">
                  Inactivate Flag
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Flag Modal */}
        {showAdd && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
              <h3 className="text-lg font-semibold text-[#1A1A2E] mb-4">Add Patient Flag</h3>
              {saveError && (
                <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-md text-[12px] text-red-700">{saveError}</div>
              )}
              <div className="space-y-3">
                <div>
                  <label className="text-[12px] font-medium text-[#555]">Flag Type <span className="text-red-500">*</span></label>
                  <select value={addForm.category} onChange={e => setAddForm(p => ({ ...p, category: e.target.value }))} className={`${inputCls} w-full bg-white`}>
                    <option value="">Select type...</option>
                    {FLAG_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[12px] font-medium text-[#555]">Flag Name <span className="text-red-500">*</span></label>
                  {flagDefs.length > 0 ? (
                    <select value={addForm.name} onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))} className={`${inputCls} w-full bg-white`}>
                      <option value="">Select a flag...</option>
                      {flagDefs.map(d => <option key={d.ien} value={d.name}>{d.name}</option>)}
                    </select>
                  ) : (
                    <input value={addForm.name} onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))} className={`${inputCls} w-full`} placeholder="e.g., HIGH RISK FOR SUICIDE" />
                  )}
                </div>
                <div>
                  <label className="text-[12px] font-medium text-[#555]">Category</label>
                  <select value={addForm.categoryLevel} onChange={e => setAddForm(p => ({ ...p, categoryLevel: e.target.value }))} className={`${inputCls} w-full bg-white`}>
                    <option value="">Select...</option>
                    {FLAG_CATEGORIES_LEVEL.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[12px] font-medium text-[#555]">Narrative <span className="text-red-500">*</span></label>
                  <textarea value={addForm.narrative} onChange={e => setAddForm(p => ({ ...p, narrative: e.target.value }))}
                    className="w-full h-20 px-3 py-2 border border-[#E2E4E8] rounded-md text-sm text-[#333] focus:outline-none focus:border-[#2E5984] focus:ring-1 focus:ring-[#2E5984] resize-none"
                    placeholder="Required: describe the flag reason and any special instructions..." />
                </div>
                <div>
                  <label className="text-[12px] font-medium text-[#555]">Review Date</label>
                  <input type="date" value={addForm.reviewDate} onChange={e => setAddForm(p => ({ ...p, reviewDate: e.target.value }))} className={`${inputCls} w-full`} />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => { setShowAdd(false); setSaveError(null); }} className="px-4 py-2 text-sm border border-[#E2E4E8] rounded-md hover:bg-[#F0F4F8]">Cancel</button>
                <button onClick={handleAdd} disabled={saving || !addForm.name || !addForm.category || !addForm.narrative}
                  className="px-4 py-2 text-sm bg-[#1A1A2E] text-white rounded-md hover:bg-[#2E5984] disabled:opacity-50">
                  {saving ? 'Adding...' : 'Add Flag'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
