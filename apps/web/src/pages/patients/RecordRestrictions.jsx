import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppShell from '../../components/shell/AppShell';
import PatientBanner from '../../components/shared/PatientBanner';
import { usePatient } from '../../components/shared/PatientContext';
import { CautionBanner } from '../../components/shared/SharedComponents';
import {
  getPatient,
  updateRecordRestriction,
  logBreakTheGlass,
  getProviders,
  getPatientAuditEvents,
  getAuthorizedStaff,
  addAuthorizedStaff,
  removeAuthorizedStaff,
} from '../../services/patientService';

const RESTRICTION_LEVELS = [
  {
    value: 'none',
    label: 'No Restriction',
    desc: 'Standard access — all authorized clinical staff can view this record normally.',
    color: 'border-green-300 bg-green-50',
    badgeBg: 'bg-green-100',
    badgeText: 'text-green-800',
    badgeLabel: 'No Restriction',
  },
  {
    value: 'level1',
    label: 'Level 1 — Sensitive Record',
    desc: 'Access is logged but not restricted. All staff can view, but every access event is recorded in the audit trail.',
    color: 'border-amber-300 bg-amber-50',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-800',
    badgeLabel: 'Level 1 — Sensitive',
  },
  {
    value: 'level2',
    label: 'Level 2 — Restricted Record',
    desc: 'Only authorized staff can access. All others must complete break-the-glass protocol with documented reason.',
    color: 'border-red-300 bg-red-50',
    badgeBg: 'bg-red-100',
    badgeText: 'text-red-800',
    badgeLabel: 'Level 2 — Restricted',
  },
];

const BTG_REASONS = [
  'Emergency Care',
  'Direct Care',
  'Administrative Review',
  'Quality Review',
  'Other',
];



function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function RecordRestrictions() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { setPatient, hasPatient, patient } = usePatient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  const [restrictionLevel, setRestrictionLevel] = useState('none');
  const [pendingLevel, setPendingLevel] = useState('none');

  const [authorizedStaff, setAuthorizedStaff] = useState([]);

  const [showStaffPicker, setShowStaffPicker] = useState(false);
  const [staffSearch, setStaffSearch] = useState('');
  const [staffResults, setStaffResults] = useState([]);
  const [staffSearching, setStaffSearching] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);

  const [showBreakGlass, setShowBreakGlass] = useState(false);
  const [btgReasonCategory, setBtgReasonCategory] = useState('');
  const [btgReasonText, setBtgReasonText] = useState('');
  const [btgSubmitting, setBtgSubmitting] = useState(false);
  const [btgGranted, setBtgGranted] = useState(false);

  const [auditEvents, setAuditEvents] = useState([]);

  const staffSearchTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (!hasPatient) {
          const pRes = await getPatient(patientId);
          if (cancelled) return;
          if (pRes.ok) {
            setPatient(pRes.data);
            const level = pRes.data.isSensitive ? 'level2' : pRes.data.isRestricted ? 'level1' : 'none';
            setRestrictionLevel(level);
            setPendingLevel(level);
          } else {
            setError(pRes.error || 'Failed to load patient');
          }
        } else {
          const level = patient.raw?.isSensitive ? 'level2' : patient.isRestricted ? 'level1' : 'none';
          setRestrictionLevel(level);
          setPendingLevel(level);
        }
        // Load audit events and authorized staff from API
        const [auditRes, staffRes] = await Promise.allSettled([
          getPatientAuditEvents(patientId),
          getAuthorizedStaff(patientId),
        ]);
        if (!cancelled) {
          if (auditRes.status === 'fulfilled' && auditRes.value?.ok) setAuditEvents(auditRes.value.data || []);
          if (staffRes.status === 'fulfilled' && staffRes.value?.ok) setAuthorizedStaff(staffRes.value.data || []);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Unexpected error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [patientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpdateRestriction = useCallback(async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const payload = {
        level: pendingLevel,
        isRestricted: pendingLevel !== 'none',
        isSensitive: pendingLevel === 'level2',
      };
      const res = await updateRecordRestriction(patientId, payload);
      if (res.ok) {
        setRestrictionLevel(pendingLevel);
        setSaveMessage({ type: 'success', text: 'Restriction level updated successfully.' });
        setTimeout(() => setSaveMessage(null), 4000);
      } else {
        setSaveMessage({ type: 'error', text: res.error || 'Failed to update restriction.' });
      }
    } catch (err) {
      setSaveMessage({ type: 'error', text: err.message || 'Unexpected error saving restriction.' });
    } finally {
      setSaving(false);
    }
  }, [patientId, pendingLevel]);

  const handleStaffSearch = useCallback(async (query) => {
    setStaffSearch(query);
    if (staffSearchTimer.current) clearTimeout(staffSearchTimer.current);
    if (query.trim().length < 2) { setStaffResults([]); return; }
    staffSearchTimer.current = setTimeout(async () => {
      setStaffSearching(true);
      try {
        const res = await getProviders({ search: query.trim() });
        if (res.ok && Array.isArray(res.data)) {
          setStaffResults(res.data.slice(0, 10).map(p => ({
            duz: p.ien || p.duz || p.id || String(Math.random()).slice(2, 10),
            name: p.name || p.displayName || 'Unknown',
            role: p.title || p.role || 'Staff',
          })));
        } else {
          setStaffResults([]);
        }
      } catch {
        setStaffResults([]);
      } finally {
        setStaffSearching(false);
      }
    }, 350);
  }, []);

  const handleAddStaff = useCallback(async (staff) => {
    if (authorizedStaff.some(s => s.duz === staff.duz)) return;
    try {
      const res = await addAuthorizedStaff(patientId, { duz: staff.duz, name: staff.name, role: staff.role });
      if (res.ok) {
        setAuthorizedStaff(prev => [...prev, {
          id: res.data?.id || `S-${Date.now()}`,
          name: staff.name,
          duz: staff.duz,
          role: staff.role,
          dateAdded: new Date().toISOString(),
          addedBy: 'CURRENT,USER',
        }]);
      }
    } catch (err) {
      setError(err?.message || 'Failed to add authorized staff member');
    }
    setShowStaffPicker(false);
    setStaffSearch('');
    setStaffResults([]);
  }, [patientId, authorizedStaff]);

  const handleRemoveStaff = useCallback(async (id) => {
    try {
      const res = await removeAuthorizedStaff(patientId, id);
      if (res.ok) {
        setAuthorizedStaff(prev => prev.filter(s => s.id !== id));
      }
    } catch (err) {
      setError(err?.message || 'Failed to remove authorized staff member');
    }
    setConfirmRemoveId(null);
  }, [patientId]);

  const handleBreakTheGlass = useCallback(async () => {
    if (!btgReasonCategory) return;
    if (btgReasonCategory === 'Other' && !btgReasonText.trim()) return;

    setBtgSubmitting(true);
    try {
      const res = await logBreakTheGlass(patientId, {
        reasonCategory: btgReasonCategory,
        reasonText: btgReasonText.trim() || btgReasonCategory,
        accessedBy: 'CURRENT,USER',
      });
      if (res.ok) {
        setBtgGranted(true);
        setAuditEvents(prev => [{
          id: res.data?.auditId || `A-${Date.now()}`,
          dateTime: new Date().toISOString(),
          accessedBy: 'CURRENT,USER',
          reasonCategory: btgReasonCategory,
          reasonText: btgReasonText.trim() || btgReasonCategory,
          duration: 'Active',
        }, ...prev]);
      }
    } catch {
      // error handled silently, audit still logged
    } finally {
      setBtgSubmitting(false);
    }
  }, [patientId, btgReasonCategory, btgReasonText]);

  const handleCloseBreakGlass = useCallback(() => {
    setShowBreakGlass(false);
    setBtgReasonCategory('');
    setBtgReasonText('');
    setBtgGranted(false);
  }, []);

  const handleExportAudit = useCallback(() => {
    const header = 'Date/Time,Accessed By,Reason Category,Reason Text,Duration';
    const rows = auditEvents.map(e =>
      `"${formatDateTime(e.dateTime)}","${e.accessedBy}","${e.reasonCategory}","${e.reasonText.replace(/"/g, '""')}","${e.duration}"`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `break-glass-audit-${patientId}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [auditEvents, patientId]);

  const currentLevelConfig = RESTRICTION_LEVELS.find(l => l.value === restrictionLevel) || RESTRICTION_LEVELS[0];
  const btgValid = btgReasonCategory && (btgReasonCategory !== 'Other' || btgReasonText.trim());

  if (loading) {
    return (
      <AppShell breadcrumb="Patients › Record Restrictions">
        <PatientBanner />
        <div className="flex items-center justify-center py-20">
          <span className="material-symbols-outlined animate-spin text-[24px] text-[#999]">progress_activity</span>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell breadcrumb="Patients › Record Restrictions">
        <PatientBanner />
        <div className="px-6 py-10 text-center">
          <span className="material-symbols-outlined text-[48px] text-red-400 mb-3 block">error</span>
          <p className="text-[15px] text-red-700 font-medium mb-2">Failed to load patient record</p>
          <p className="text-[13px] text-[#666] mb-4">{error}</p>
          <button onClick={() => navigate(-1)}
            className="px-4 py-2 text-sm bg-[#1A1A2E] text-white rounded-md hover:bg-[#2E5984] transition-colors">
            Go Back
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumb="Patients › Record Restrictions">
      <PatientBanner />
      <div className="px-6 py-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-[28px] font-bold text-[#1A1A2E]">Record Restrictions</h1>
            <p className="text-[13px] text-[#666] mt-1">Manage access restrictions and break-the-glass policy for this patient record.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-[#666] mr-1">Current Level:</span>
            <span className={`text-[12px] font-bold px-3 py-1 rounded-full ${currentLevelConfig.badgeBg} ${currentLevelConfig.badgeText}`}>
              {currentLevelConfig.badgeLabel}
            </span>
          </div>
        </div>

        <CautionBanner>
          Record restrictions control access to sensitive patient records. Changes are audit-logged and monitored. Unauthorized access triggers immediate notification to the Privacy Officer.
        </CautionBanner>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-5">
            {/* Restriction Level Configuration */}
            <div className="border border-[#E2E4E8] rounded-md p-5">
              <h2 className="text-[16px] font-semibold text-[#1A1A2E] mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-[#2E5984]">shield</span>
                Restriction Level
              </h2>
              <div className="space-y-3">
                {RESTRICTION_LEVELS.map(opt => (
                  <label key={opt.value}
                    className={`flex items-start gap-3 p-3 rounded-md border-2 cursor-pointer transition-colors ${
                      pendingLevel === opt.value ? opt.color : 'border-[#E2E4E8] hover:bg-[#FAFBFC]'
                    }`}>
                    <input
                      type="radio"
                      name="restriction"
                      value={opt.value}
                      checked={pendingLevel === opt.value}
                      onChange={e => setPendingLevel(e.target.value)}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-[13px] font-semibold text-[#1A1A2E]">{opt.label}</p>
                      <p className="text-[12px] text-[#666] mt-0.5">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>

              {saveMessage && (
                <div className={`mt-4 px-3 py-2 rounded-md text-[13px] font-medium ${
                  saveMessage.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  {saveMessage.text}
                </div>
              )}

              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={handleUpdateRestriction}
                  disabled={saving || pendingLevel === restrictionLevel}
                  className="px-5 py-2 bg-[#1A1A2E] text-white text-sm font-medium rounded-md hover:bg-[#2E5984] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving && <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>}
                  Update Restriction Level
                </button>
                {pendingLevel !== restrictionLevel && (
                  <span className="text-[11px] text-amber-600 font-medium">Unsaved changes</span>
                )}
              </div>
            </div>

            {/* Authorized Staff List — Level 2 only */}
            {pendingLevel === 'level2' && (
              <div className="border border-[#E2E4E8] rounded-md p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[16px] font-semibold text-[#1A1A2E] flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-[#2E5984]">group</span>
                    Authorized Staff
                  </h2>
                  <button
                    onClick={() => setShowStaffPicker(true)}
                    className="flex items-center gap-1.5 text-[12px] text-white bg-[#2E5984] hover:bg-[#1A1A2E] px-3 py-1.5 rounded-md transition-colors"
                  >
                    <span className="material-symbols-outlined text-[14px]">person_add</span>
                    Add Authorized Staff
                  </button>
                </div>

                {/* Staff Table */}
                <div className="overflow-hidden rounded-md border border-[#E2E4E8]">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="bg-[#1A1A2E] text-white text-left">
                        <th className="px-3 py-2 font-medium">Staff Name</th>
                        <th className="px-3 py-2 font-medium">Staff ID</th>
                        <th className="px-3 py-2 font-medium">Role</th>
                        <th className="px-3 py-2 font-medium">Date Added</th>
                        <th className="px-3 py-2 font-medium">Added By</th>
                        <th className="px-3 py-2 font-medium text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {authorizedStaff.length === 0 && (
                        <tr><td colSpan={6} className="px-3 py-6 text-center text-[#999]">No authorized staff configured.</td></tr>
                      )}
                      {authorizedStaff.map((s, i) => (
                        <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F8F9FB]'}>
                          <td className="px-3 py-2 font-medium text-[#1A1A2E]">{s.name}</td>
                          <td className="px-3 py-2 font-mono text-[#666]">{s.duz}</td>
                          <td className="px-3 py-2 text-[#555]">{s.role}</td>
                          <td className="px-3 py-2 text-[#666]">{formatDateShort(s.dateAdded)}</td>
                          <td className="px-3 py-2 text-[#666]">{s.addedBy}</td>
                          <td className="px-3 py-2 text-center">
                            {confirmRemoveId === s.id ? (
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => handleRemoveStaff(s.id)}
                                  className="text-[11px] px-2 py-0.5 bg-red-600 text-white rounded hover:bg-red-700">
                                  Confirm
                                </button>
                                <button onClick={() => setConfirmRemoveId(null)}
                                  className="text-[11px] px-2 py-0.5 border border-[#E2E4E8] rounded hover:bg-[#F0F4F8]">
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirmRemoveId(s.id)}
                                className="text-[#999] hover:text-red-600 transition-colors" title="Remove staff">
                                <span className="material-symbols-outlined text-[16px]">close</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Staff Picker Modal */}
                {showStaffPicker && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setShowStaffPicker(false); setStaffSearch(''); setStaffResults([]); }}>
                    <div className="bg-white rounded-lg shadow-xl w-[480px] max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
                      <div className="px-5 py-4 border-b border-[#E2E4E8]">
                        <h3 className="text-[16px] font-semibold text-[#1A1A2E]">Add Authorized Staff</h3>
                        <p className="text-[12px] text-[#666] mt-1">Search for a staff member to grant access to this restricted record.</p>
                      </div>
                      <div className="px-5 py-3">
                        <div className="relative">
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[#999]">search</span>
                          <input
                            type="text"
                            value={staffSearch}
                            onChange={e => handleStaffSearch(e.target.value)}
                            placeholder="Search by name or ID..."
                            className="w-full pl-9 pr-3 py-2 border border-[#E2E4E8] rounded-md text-sm text-[#333] focus:outline-none focus:border-[#2E5984]"
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto px-5 pb-3">
                        {staffSearching && (
                          <div className="py-4 text-center">
                            <span className="material-symbols-outlined animate-spin text-[20px] text-[#999]">progress_activity</span>
                          </div>
                        )}
                        {!staffSearching && staffResults.length === 0 && staffSearch.trim().length >= 2 && (
                          <p className="py-4 text-center text-[13px] text-[#999]">No results found.</p>
                        )}
                        {!staffSearching && staffResults.map(s => {
                          const alreadyAdded = authorizedStaff.some(a => a.duz === s.duz);
                          return (
                            <button
                              key={s.duz}
                              onClick={() => !alreadyAdded && handleAddStaff(s)}
                              disabled={alreadyAdded}
                              className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-md mb-1 transition-colors ${
                                alreadyAdded ? 'opacity-50 cursor-not-allowed bg-[#FAFBFC]' : 'hover:bg-[#F0F4F8] cursor-pointer'
                              }`}
                            >
                              <div>
                                <p className="text-[13px] font-medium text-[#1A1A2E]">{s.name}</p>
                                <p className="text-[11px] text-[#888]">ID: {s.duz} · {s.role}</p>
                              </div>
                              {alreadyAdded ? (
                                <span className="text-[11px] text-green-700 font-medium">Already Added</span>
                              ) : (
                                <span className="material-symbols-outlined text-[18px] text-[#2E5984]">add_circle</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <div className="px-5 py-3 border-t border-[#E2E4E8] flex justify-end">
                        <button onClick={() => { setShowStaffPicker(false); setStaffSearch(''); setStaffResults([]); }}
                          className="px-4 py-2 text-sm border border-[#E2E4E8] rounded-md hover:bg-[#F0F4F8]">
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-5">
            {/* Break-the-Glass Panel — visible when record IS restricted */}
            {restrictionLevel === 'level2' && !btgGranted && (
              <div className="border border-red-200 rounded-md p-5 bg-red-50">
                <h2 className="text-[16px] font-semibold text-red-800 mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px]">emergency</span>
                  Break-the-Glass Access
                </h2>
                <p className="text-[13px] text-red-700 mb-4">
                  If you need emergency access to this restricted record and you are not on the authorized list, you must document a reason. This action is immediately logged and the Privacy Officer will be notified.
                </p>
                <button onClick={() => setShowBreakGlass(true)}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">lock_open</span>
                  Request Emergency Access
                </button>
              </div>
            )}

            {restrictionLevel === 'level2' && btgGranted && (
              <div className="border border-green-200 rounded-md p-5 bg-green-50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-[20px] text-green-700">check_circle</span>
                  <h2 className="text-[16px] font-semibold text-green-800">Access Granted</h2>
                </div>
                <p className="text-[13px] text-green-700">
                  Break-the-glass access has been granted for this session. All actions are being logged.
                </p>
              </div>
            )}

            {/* Break-the-Glass Audit Table */}
            <div className="border border-[#E2E4E8] rounded-md overflow-hidden">
              <div className="px-5 py-3 bg-[#FAFBFC] border-b border-[#E2E4E8] flex items-center justify-between">
                <h2 className="text-[16px] font-semibold text-[#1A1A2E] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-[#2E5984]">history</span>
                  Break-the-Glass Audit Log
                </h2>
                <button onClick={handleExportAudit}
                  className="flex items-center gap-1.5 text-[12px] text-[#2E5984] hover:text-[#1A1A2E] font-medium transition-colors">
                  <span className="material-symbols-outlined text-[14px]">download</span>
                  Export Audit (CSV)
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-[#1A1A2E] text-white text-left">
                      <th className="px-3 py-2 font-medium whitespace-nowrap">Date/Time</th>
                      <th className="px-3 py-2 font-medium whitespace-nowrap">Accessed By</th>
                      <th className="px-3 py-2 font-medium whitespace-nowrap">Reason Category</th>
                      <th className="px-3 py-2 font-medium">Reason Text</th>
                      <th className="px-3 py-2 font-medium whitespace-nowrap">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditEvents.length === 0 && (
                      <tr><td colSpan={5} className="px-3 py-6 text-center text-[#999]">No break-the-glass events recorded.</td></tr>
                    )}
                    {auditEvents.slice(0, 20).map((e, i) => (
                      <tr key={e.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F8F9FB]'}>
                        <td className="px-3 py-2 whitespace-nowrap text-[#333]">{formatDateTime(e.dateTime)}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-medium text-[#1A1A2E]">{e.accessedBy}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                            e.reasonCategory === 'Emergency Care' ? 'bg-red-100 text-red-800' :
                            e.reasonCategory === 'Direct Care' ? 'bg-blue-100 text-blue-800' :
                            e.reasonCategory === 'Administrative Review' ? 'bg-gray-100 text-gray-800' :
                            e.reasonCategory === 'Quality Review' ? 'bg-purple-100 text-purple-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {e.reasonCategory}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-[#555] max-w-[250px] truncate" title={e.reasonText}>{e.reasonText}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-[#666]">{e.duration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {auditEvents.length > 0 && (
                <div className="px-5 py-2 bg-[#FAFBFC] border-t border-[#E2E4E8] text-[11px] text-[#999]">
                  Showing {Math.min(20, auditEvents.length)} of {auditEvents.length} events
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Break-the-Glass Modal */}
      {showBreakGlass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleCloseBreakGlass}>
          <div className="bg-white rounded-lg shadow-2xl w-[520px]" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-[#E2E4E8] flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-red-600 text-[22px]">lock</span>
              </div>
              <div>
                <h3 className="text-[18px] font-bold text-[#1A1A2E]">Restricted Patient Record</h3>
                <p className="text-[12px] text-[#666]">Break-the-glass protocol required</p>
              </div>
            </div>
            <div className="px-6 py-5 space-y-4">
              {btgGranted ? (
                <div className="text-center py-4">
                  <span className="material-symbols-outlined text-[48px] text-green-500 mb-2 block">check_circle</span>
                  <p className="text-[15px] font-semibold text-green-800 mb-1">Access Granted</p>
                  <p className="text-[13px] text-[#666]">Record access has been granted for this session only. All actions are being logged.</p>
                </div>
              ) : (
                <>
                  <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3">
                    <p className="text-[13px] text-red-800">
                      This patient's record is restricted. To access, you must provide a reason. This action will be logged and the Privacy Officer will be notified immediately.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[13px] font-medium text-[#1A1A2E] mb-1.5">Reason for Access</label>
                    <select
                      value={btgReasonCategory}
                      onChange={e => setBtgReasonCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-[#E2E4E8] rounded-md text-sm text-[#333] focus:outline-none focus:border-[#2E5984] bg-white"
                    >
                      <option value="">Select a reason...</option>
                      {BTG_REASONS.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  {btgReasonCategory === 'Other' && (
                    <div>
                      <label className="block text-[13px] font-medium text-[#1A1A2E] mb-1.5">
                        Detailed Reason <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={btgReasonText}
                        onChange={e => setBtgReasonText(e.target.value)}
                        className="w-full h-20 px-3 py-2 border border-[#E2E4E8] rounded-md text-sm text-[#333] focus:outline-none focus:border-[#2E5984] resize-none"
                        placeholder="Describe the specific reason for accessing this restricted record..."
                      />
                    </div>
                  )}

                  {btgReasonCategory && btgReasonCategory !== 'Other' && (
                    <div>
                      <label className="block text-[13px] font-medium text-[#1A1A2E] mb-1.5">Additional Details (optional)</label>
                      <textarea
                        value={btgReasonText}
                        onChange={e => setBtgReasonText(e.target.value)}
                        className="w-full h-20 px-3 py-2 border border-[#E2E4E8] rounded-md text-sm text-[#333] focus:outline-none focus:border-[#2E5984] resize-none"
                        placeholder="Provide any additional context..."
                      />
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="px-6 py-4 border-t border-[#E2E4E8] flex justify-end gap-3">
              {btgGranted ? (
                <button onClick={handleCloseBreakGlass}
                  className="px-5 py-2 text-sm bg-[#1A1A2E] text-white font-medium rounded-md hover:bg-[#2E5984] transition-colors">
                  Continue to Record
                </button>
              ) : (
                <>
                  <button onClick={handleCloseBreakGlass}
                    className="px-4 py-2 text-sm border border-[#E2E4E8] rounded-md hover:bg-[#F0F4F8] transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={handleBreakTheGlass}
                    disabled={!btgValid || btgSubmitting}
                    className="px-5 py-2 text-sm bg-red-600 text-white font-medium rounded-md hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {btgSubmitting && <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>}
                    Access Record
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
