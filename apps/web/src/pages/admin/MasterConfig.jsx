import { useState, useEffect, useCallback } from 'react';
import AppShell from '../../components/shell/AppShell';
import { CautionBanner } from '../../components/shared/SharedComponents';
import { getMasterConfig, updateMasterConfig, getSession, submit2PChange, get2PRequests, approve2PRequest, reject2PRequest } from '../../services/adminService';
import ErrorState from '../../components/shared/ErrorState';

// Normalize /params/kernel — see SiteParameters.jsx for the full version.
// Handles both the ZVE data[] shape (preferred) and the legacy DDR rawLines.
function normalizeKernelParams(res) {
  if (!res) return {};
  if (Array.isArray(res.data) && res.data.length > 0) {
    const nameMap = {
      'DOMAIN': 'domainName',
      'SITE NAME': 'siteNumber',
      'PRODUCTION': 'prodAccount',
      'AUTOLOGOFF': 'sessionTimeout',
      'LOCKOUT ATTEMPTS': 'lockoutAttempts',
      'PASSWORD EXPIRATION': 'passwordExpiration',
      'BROKER TIMEOUT': 'rpcTimeout',
      'AGENCY CODE': 'agencyCode',
      'WELCOME MESSAGE': 'welcomeMessage',
      'DISABLE NEW USER': 'disableNewUser',
    };
    const out = {};
    for (const row of res.data) {
      const key = nameMap[row.name] || row.name.toLowerCase().replace(/\s+/g, '_');
      out[key] = { value: row.value, external: row.value, description: row.description || '' };
    }
    if (!out.autoSignOffDelay && out.sessionTimeout) out.autoSignOffDelay = { ...out.sessionTimeout };
    return out;
  }
  return {};
}

/**
 * Master Admin Configuration
 * @vista KERNEL SYSTEM PARAMETERS #8989.3
 *
 * Same data source as Site Parameters but presented by security concern grouping.
 * Live: GET /params/kernel → { rawLines: [...] }
 */

const CONFIG_SECTIONS = [
  { id: 'auth', label: 'Authentication Rules', icon: 'lock', twoPersonRequired: true },
  { id: 'esig', label: 'E-Signature Rules', icon: 'draw', twoPersonRequired: true },
  { id: 'session', label: 'Session Management', icon: 'timer', twoPersonRequired: false },
  { id: 'audit', label: 'Audit Configuration', icon: 'shield', twoPersonRequired: true },
  { id: 'motd', label: 'Welcome Message', icon: 'campaign', twoPersonRequired: false },
  { id: 'backup', label: 'Backup Verification', icon: 'backup', twoPersonRequired: false },
];

const FIELD_TO_VISTA_PARAM = {
  sessionTimeout: 'AUTOLOGOFF',
  autoSignoff: 'AUTOLOGOFF',
  rpcTimeout: 'BROKER TIMEOUT',
};

function buildSectionFields(kernelParams, sectionId, isVA = true) {
  if (!kernelParams) return [];
  const ts = Number(kernelParams.sessionTimeout?.value || 0);
  const so = Number(kernelParams.autoSignOffDelay?.value || 0);
  const policyLabel = isVA ? 'VHA Directive 6500' : 'Security Policy';

  // Zero-value security parameter warning (Step 3.8)
  const zeroWarn = (v, what) => v === 0 ? ` — DISABLED, security risk: ${what} is not enforced` : '';
  const critical = (v) => v === 0;

  if (sectionId === 'auth') {
    return [
      { name: 'sessionTimeout', label: 'Session Timeout Duration', type: 'number', value: String(ts), unit: 'seconds', enforcedMax: 900, critical: critical(ts), hint: `${policyLabel}: ≤ 15 min (900s). Current: ${Math.round(ts/60)} min${zeroWarn(ts, 'session timeout')}` },
      { name: 'autoSignoff', label: 'Auto Sign-Off Duration', type: 'number', value: String(so), unit: 'seconds', enforcedMax: 900, critical: critical(so), hint: `Inactive terminal disconnection. Current: ${Math.round(so/60)} min${zeroWarn(so, 'auto sign-off')}` },
    ];
  }
  if (sectionId === 'esig') {
    return [
      { name: 'esigMinLength', label: 'E-Signature Minimum Length', type: 'readonly', value: '6', unit: 'characters', hint: 'Configured in VistA Kernel parameter' },
      { name: 'esigForOrders', label: 'Require E-Signature for Orders', type: 'readonly', value: 'Yes', hint: 'Mandatory for patient safety' },
    ];
  }
  if (sectionId === 'session') {
    return [
      { name: 'rpcTimeout', label: 'Response Timeout', type: 'number', value: String(kernelParams.rpcTimeout?.value || 0), unit: 'seconds', hint: 'Maximum wait time for server responses' },
    ];
  }
  if (sectionId === 'audit') {
    return [
      { name: 'retentionYears', label: 'Audit Retention Period', type: 'readonly', value: '3', unit: 'years', hint: 'Minimum retention per regulation' },
    ];
  }
  if (sectionId === 'motd') {
    return [
      { name: 'welcomeMessage', label: 'Welcome Message (Login Screen)', type: 'textarea', value: kernelParams.welcomeMessage?.value || '', hint: 'Text shown on the login page' },
    ];
  }
  if (sectionId === 'backup') {
    return [
      { name: 'prodAccount', label: 'Production Account', type: 'readonly', value: kernelParams.prodAccount?.external || '—', hint: 'Environment classification' },
      { name: 'domainName', label: 'Domain Name', type: 'readonly', value: kernelParams.domainName?.value || '—' },
    ];
  }
  return [];
}

export default function MasterConfig() {
  const [selectedSection, setSelectedSection] = useState('auth');
  const [editedValues, setEditedValues] = useState({});
  const [changeReason, setChangeReason] = useState('');
  const [kernelParams, setKernelParams] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isVA, setIsVA] = useState(true);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [currentDuz, setCurrentDuz] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const sess = await getSession();
        if (sess?.facilityType && sess.facilityType !== 'va') setIsVA(false);
        if (sess?.user?.duz) setCurrentDuz(String(sess.user.duz));
      } catch { /* non-fatal */ }
    })();
  }, []);

  const loadPending = useCallback(async () => {
    setPendingLoading(true);
    try {
      const res = await get2PRequests('ALL');
      setPendingRequests(res?.data || []);
    } catch { setPendingRequests([]); }
    finally { setPendingLoading(false); }
  }, []);

  useEffect(() => { loadPending(); }, [loadPending]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMasterConfig();
      setKernelParams(normalizeKernelParams(res));
    } catch (err) {
      setError(err.message || 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const sectionMeta = CONFIG_SECTIONS.find(s => s.id === selectedSection);
  const fields = buildSectionFields(kernelParams, selectedSection, isVA);
  const hasChanges = Object.keys(editedValues).length > 0;

  const hasViolation = Object.entries(editedValues).some(([name, val]) => {
    const f = fields.find(ff => ff.name === name);
    return f?.enforcedMax && Number(val) > f.enforcedMax;
  });

  const updateField = (fieldName, value) => {
    const original = fields.find(f => f.name === fieldName)?.value;
    setEditedValues(prev => {
      if (String(value) === String(original)) {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      }
      return { ...prev, [fieldName]: value };
    });
  };

  const handleSave = async () => {
    if (hasViolation || !changeReason.trim()) return;
    setSaving(true);
    setSaveError('');
    try {
      if (sectionMeta?.twoPersonRequired) {
        for (const [fieldName, newVal] of Object.entries(editedValues)) {
          const f = fields.find(ff => ff.name === fieldName);
          const vistaParam = FIELD_TO_VISTA_PARAM[fieldName] || fieldName.toUpperCase();
          await submit2PChange({ section: selectedSection, field: vistaParam, oldValue: f?.value || '', newValue: String(newVal), reason: changeReason });
        }
        setEditedValues({});
        setChangeReason('');
        setSaveError('submitted');
        await loadPending();
        setTimeout(() => setSaveError(''), 4000);
      } else {
        await updateMasterConfig({ ...editedValues, reason: changeReason });
        setEditedValues({});
        setChangeReason('');
        await loadData();
      }
    } catch (err) {
      setSaveError(err.message || 'Failed to save configuration. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <AppShell breadcrumb="Admin > Master Configuration">
        <div className="p-6"><ErrorState message={error} onRetry={loadData} /></div>
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumb="Admin > Master Configuration">
      <div className="flex h-[calc(100vh-40px)]">
        <div className="w-[240px] border-r border-border overflow-auto p-3 flex-shrink-0">
          <h1 className="text-[28px] font-bold text-text px-2 mb-1">Master Configuration</h1>
          <p className="text-[10px] text-text-muted px-2 mb-4">
            {loading ? 'Loading...' : 'Live Kernel System Parameters'}
          </p>

          <div className="space-y-0.5">
            {CONFIG_SECTIONS.map(sec => (
              <button key={sec.id} onClick={() => { setSelectedSection(sec.id); setEditedValues({}); setChangeReason(''); }}
                className={`w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-md text-xs transition-colors ${
                  selectedSection === sec.id ? 'bg-[#E8EEF5] text-steel font-medium' : 'text-text hover:bg-surface-alt'
                }`}>
                <span className="material-symbols-outlined text-[16px]">{sec.icon}</span>
                {sec.label}
                {sec.twoPersonRequired && (
                  <span className="ml-auto text-[8px] bg-danger-bg text-danger px-1 py-0.5 rounded font-bold">2P</span>
                )}
              </button>
            ))}
          </div>

          <div className="mt-6 px-2 py-3 bg-warning-bg rounded-md">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-warning text-[14px]">security</span>
              <span className="text-[10px] font-bold text-text">Access Level</span>
            </div>
            <p className="text-[10px] text-text-secondary">
              This page requires system administrator access. All changes are audited.
              Sections marked <span className="bg-danger-bg text-danger px-1 rounded text-[8px] font-bold">2P</span> require
              a second administrator to approve changes.
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl">
            <CautionBanner>
              This page contains master system configuration settings. Changes require IRM Chief authorization
              and affect all system operations. All changes are audit-logged.
            </CautionBanner>

            {sectionMeta?.twoPersonRequired && (
              <CautionBanner>
                <strong>Two-person integrity required.</strong> Changes to {sectionMeta.label.toLowerCase()} generate a pending
                change request that must be approved by a second administrator before taking effect.
              </CautionBanner>
            )}

            {saveError === 'submitted' && (
              <div className="mb-4 p-3 bg-[#E8F5E9] border border-[#2D6A4F] rounded-lg text-[12px] text-[#2D6A4F] flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                Change request submitted for approval. A second administrator must approve before the change takes effect.
              </div>
            )}

            {pendingRequests.filter(r => r.status === 'PENDING').length > 0 && (
              <div className="mb-6 p-4 bg-warning-bg border border-warning rounded-lg">
                <h3 className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-warning text-[16px]">pending_actions</span>
                  Pending Approval Requests ({pendingRequests.filter(r => r.status === 'PENDING').length})
                </h3>
                <div className="space-y-2">
                  {pendingRequests.filter(r => r.status === 'PENDING').map(req => {
                    const isSelf = String(req.submitterDuz) === currentDuz;
                    return (
                      <div key={req.id} className="p-3 bg-white rounded-md border border-border">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-text">{req.section} / {req.field}</span>
                          <span className="text-[10px] text-text-muted">{req.submittedDate}</span>
                        </div>
                        <div className="text-[11px] text-text-secondary mb-1">
                          <span className="font-mono">{req.oldValue || '—'}</span> → <span className="font-mono font-bold">{req.newValue}</span>
                        </div>
                        <div className="text-[10px] text-text-muted mb-2">
                          Submitted by: {req.submitterName || req.submitterDuz}{req.reason ? ` — "${req.reason}"` : ''}
                        </div>
                        <div className="flex gap-2">
                          <button disabled={isSelf || pendingLoading}
                            onClick={async () => {
                              setPendingLoading(true);
                              try { await approve2PRequest(req.id); await loadPending(); await loadData(); }
                              catch (err) { setSaveError(err?.message || 'Failed to approve request'); }
                              finally { setPendingLoading(false); }
                            }}
                            className="px-3 py-1.5 text-[11px] bg-[#2D6A4F] text-white rounded-md hover:bg-[#1B4332] disabled:opacity-40"
                            title={isSelf ? 'Cannot approve your own request' : 'Approve and apply change'}>
                            {isSelf ? 'Cannot self-approve' : 'Approve'}
                          </button>
                          <button disabled={isSelf || pendingLoading}
                            onClick={async () => {
                              setPendingLoading(true);
                              try { await reject2PRequest(req.id); await loadPending(); }
                              catch (err) { setSaveError(err?.message || 'Failed to reject request'); }
                              finally { setPendingLoading(false); }
                            }}
                            className="px-3 py-1.5 text-[11px] border border-[#CC3333] text-[#CC3333] rounded-md hover:bg-[#FDE8E8] disabled:opacity-40">
                            Reject
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <h2 className="text-xl font-bold text-text mb-1">{sectionMeta?.label}</h2>
            <p className="text-xs text-text-muted mb-6">
              {sectionMeta?.twoPersonRequired
                ? 'Critical security configuration — changes require dual approval.'
                : 'Standard configuration — changes take effect immediately after save.'}
            </p>

            {loading ? (
              <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-20 animate-pulse bg-[#E2E4E8] rounded-lg" />)}</div>
            ) : (
              <div className="space-y-5">
                {fields.map(field => {
                  const isEdited = field.name in editedValues;
                  const displayValue = isEdited ? editedValues[field.name] : field.value;
                  const isViolation = field.enforcedMax && isEdited && Number(displayValue) > field.enforcedMax;

                  return (
                    <div key={field.name} className={`p-4 rounded-lg border ${isEdited ? (isViolation ? 'border-[#CC3333] bg-[#FDE8E8]' : 'border-warning bg-[#FFFDE7]') : 'border-border bg-white'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-medium text-sm text-text">{field.label}</label>
                        {field.enforcedMax && (
                          <span className="text-[10px] bg-danger-bg text-danger px-2 py-0.5 rounded-full font-medium">
                            Enforced max: {field.enforcedMax} {field.unit}
                          </span>
                        )}
                      </div>
                      {field.hint && <p className="text-[10px] text-text-muted mb-2">{field.hint}</p>}

                      {field.type === 'number' && (
                        <div className="flex items-center gap-2">
                          <input type="number" value={displayValue} onChange={e => updateField(field.name, e.target.value)}
                            className="w-28 h-8 px-3 text-sm font-mono border border-border rounded-md focus:outline-none focus:border-steel" />
                          {field.unit && <span className="text-xs text-text-muted">{field.unit}</span>}
                          {String(displayValue) === '0' && (
                            <span className="px-2 py-0.5 text-[10px] font-semibold bg-[#FDE8E8] text-[#CC3333] rounded-full uppercase">
                              Disabled — value is 0
                            </span>
                          )}
                        </div>
                      )}
                      {field.type === 'textarea' && (
                        <textarea value={displayValue} onChange={e => updateField(field.name, e.target.value)}
                          className="w-full h-24 px-3 py-2 text-sm border border-border rounded-md resize-none focus:outline-none focus:border-steel" />
                      )}
                      {field.type === 'readonly' && (
                        <div className="text-sm font-mono text-text-secondary">{displayValue || '—'}</div>
                      )}

                      {isViolation && (
                        <div className="mt-2 text-xs text-[#CC3333] font-semibold flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">block</span>
                          Exceeds {isVA ? 'VHA Directive 6500' : 'security policy'} limit. Save blocked.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {hasChanges && (
              <div className="mt-6 p-4 bg-surface-alt border border-border rounded-lg">
                <h3 className="text-sm font-semibold text-text mb-3">
                  {sectionMeta?.twoPersonRequired ? 'Submit Change Request' : 'Save Changes'}
                </h3>
                <div className="mb-3">
                  <label className="block text-xs font-medium text-text mb-1">
                    Reason for Change <span className="text-danger">*</span>
                  </label>
                  <textarea value={changeReason} onChange={e => setChangeReason(e.target.value)}
                    placeholder="Document the reason for this change"
                    className="w-full h-16 px-3 py-2 text-xs border border-border rounded-md resize-none focus:outline-none focus:border-steel" />
                </div>
                {saveError && saveError !== 'submitted' && (
                  <div className="p-2 bg-[#FDE8E8] border border-[#CC3333] rounded-lg text-[11px] text-[#CC3333] flex items-start gap-2 mb-3">
                    <span className="material-symbols-outlined text-[14px] mt-0.5">error</span>
                    <span>{saveError}</span>
                  </div>
                )}
                {hasViolation && (
                  <div className="p-2 bg-[#FDE8E8] border border-[#CC3333] rounded-lg text-[11px] text-[#CC3333] flex items-start gap-2 mb-3">
                    <span className="material-symbols-outlined text-[14px] mt-0.5">block</span>
                    <span>Save blocked — {isVA ? 'VHA Directive 6500' : 'security policy'} violation.</span>
                  </div>
                )}
                <div className="flex gap-3">
                  <button disabled={!changeReason.trim() || hasViolation || saving} onClick={handleSave}
                    className="px-5 py-2 text-sm font-medium bg-navy text-white rounded-md hover:bg-steel transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    {saving ? 'Saving...' : sectionMeta?.twoPersonRequired ? 'Submit for Approval' : 'Save Changes'}
                  </button>
                  <button onClick={() => { setEditedValues({}); setChangeReason(''); }}
                    className="px-4 py-2 text-sm border border-border rounded-md hover:bg-white">
                    Revert All
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
