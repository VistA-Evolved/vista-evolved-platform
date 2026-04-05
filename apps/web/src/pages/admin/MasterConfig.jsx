import { useState, useEffect, useCallback } from 'react';
import AppShell from '../../components/shell/AppShell';
import { CautionBanner } from '../../components/shared/SharedComponents';
import { getMasterConfig, updateMasterConfig } from '../../services/adminService';
import { parseKernelParams } from '../../utils/transforms';
import ErrorState from '../../components/shared/ErrorState';

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

// Maps parsed kernel params to config section fields
function buildSectionFields(kernelParams, sectionId) {
  if (!kernelParams) return [];
  const ts = Number(kernelParams.sessionTimeout?.value || 0);
  const so = Number(kernelParams.autoSignOffDelay?.value || 0);

  if (sectionId === 'auth') {
    return [
      { name: 'sessionTimeout', label: 'Session Timeout Duration', type: 'number', value: String(ts), unit: 'seconds', enforcedMax: 900, hint: `VHA Directive 6500: ≤ 15 min (900s). Current: ${Math.round(ts/60)} min` },
      { name: 'autoSignoff', label: 'Auto Sign-Off Duration', type: 'number', value: String(so), unit: 'seconds', enforcedMax: 900, hint: `Inactive terminal disconnection. Current: ${Math.round(so/60)} min` },
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

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMasterConfig();
      if (res?.rawLines) {
        setKernelParams(parseKernelParams(res.rawLines));
      } else {
        setKernelParams({});
      }
    } catch (err) {
      setError(err.message || 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const sectionMeta = CONFIG_SECTIONS.find(s => s.id === selectedSection);
  const fields = buildSectionFields(kernelParams, selectedSection);
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
      await updateMasterConfig({ ...editedValues, reason: changeReason });
      setEditedValues({});
      setChangeReason('');
      await loadData();
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
                          Exceeds VHA Directive 6500 limit. Save blocked.
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
                {saveError && (
                  <div className="p-2 bg-[#FDE8E8] border border-[#CC3333] rounded-lg text-[11px] text-[#CC3333] flex items-start gap-2 mb-3">
                    <span className="material-symbols-outlined text-[14px] mt-0.5">error</span>
                    <span>{saveError}</span>
                  </div>
                )}
                {hasViolation && (
                  <div className="p-2 bg-[#FDE8E8] border border-[#CC3333] rounded-lg text-[11px] text-[#CC3333] flex items-start gap-2 mb-3">
                    <span className="material-symbols-outlined text-[14px] mt-0.5">block</span>
                    <span>Save blocked — VHA Directive 6500 violation.</span>
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
