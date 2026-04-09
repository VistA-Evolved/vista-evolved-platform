import { useState, useEffect, useCallback } from 'react';
import AppShell from '../../components/shell/AppShell';
import { CautionBanner } from '../../components/shared/SharedComponents';
import { getSiteParameters, updateSiteParameters, getPackageParams, updatePackageParams, getSession } from '../../services/adminService';
import ErrorState from '../../components/shared/ErrorState';

// Normalize the /params/kernel server response. The server can return
// either the live ZVE-sourced { data: [{name, value, description}] }
// shape (preferred) or a legacy DDR { rawLines: [...] } shape. We map
// both to the same internal object keyed by the well-known field names
// the UI expects.
function normalizeKernelParams(res) {
  if (!res) return {};
  // ZVE path — preferred
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
      out[key] = {
        value: row.value,
        external: row.value,
        description: row.description || '',
        sourceName: row.name,
      };
    }
    // Derive autoSignOffDelay from sessionTimeout if VistA only carries one
    if (!out.autoSignOffDelay && out.sessionTimeout) {
      out.autoSignOffDelay = { ...out.sessionTimeout };
    }
    return out;
  }
  // Legacy DDR path
  if (Array.isArray(res.rawLines)) {
    const out = {};
    const fieldMap = {
      '.01': 'domainName',
      '217': 'siteNumber',
      '501': 'prodAccount',
      '230': 'sessionTimeout',
      '210': 'autoSignOffDelay',
      '214': 'rpcTimeout',
      '240': 'welcomeMessage',
      '205': 'disableNewUser',
    };
    for (const line of res.rawLines) {
      const parts = line.split('^');
      const field = parts[2];
      const internal = parts[3] || '';
      const external = parts[4] || internal;
      const key = fieldMap[field];
      if (key) out[key] = { value: internal, external, description: '' };
    }
    return out;
  }
  return {};
}

/**
 * Site Parameter Management
 * @vista KERNEL SYSTEM PARAMETERS #8989.3 via DDR GETS ENTRY DATA
 *
 * Live: GET /params/kernel → { rawLines: ["8989.3^1^fieldNum^internal^external", ...] }
 * Returns 18 parameter lines from the sandbox. Fields:
 *   .01 = domain name, .02/.03 = HFS dirs, .05 = disable new users,
 *   9 = type (VA), 205 = disable new user creation,
 *   210 = auto sign-off delay (seconds), 214 = RPC timeout (seconds),
 *   217 = site number, 230 = session timeout (seconds), 240 = welcome message,
 *   501 = production account
 */

const PARAM_TREE = [
  {
    section: 'System',
    groups: [
      { id: 'kernel', label: 'Kernel Parameters', icon: 'settings' },
      { id: 'session', label: 'Session & Security', icon: 'lock' },
    ],
  },
  {
    section: 'Clinical',
    groups: [
      { id: 'order-entry', label: 'Order Entry Settings', icon: 'clinical_notes', vistaFile: '100.99' },
    ],
  },
  {
    section: 'Pharmacy',
    groups: [
      { id: 'pharmacy', label: 'Pharmacy Settings', icon: 'medication', vistaFile: '59.7' },
    ],
  },
  {
    section: 'Laboratory',
    groups: [
      { id: 'lab', label: 'Lab Settings', icon: 'science', vistaFile: '69.9' },
    ],
  },
  {
    section: 'Scheduling',
    groups: [
      { id: 'scheduling', label: 'Scheduling Settings', icon: 'calendar_month', vistaFile: '44' },
    ],
  },
  {
    section: 'Radiology',
    groups: [
      { id: 'radiology', label: 'Radiology Settings', icon: 'radiology', vistaFile: '79.1' },
    ],
  },
  {
    section: 'Surgery',
    groups: [
      { id: 'surgery', label: 'Surgery Settings', icon: 'surgical', vistaFile: '136' },
    ],
  },
];

// Security policy enforcement rules — max values enforced regardless of facility type
const VHA_RULES = {
  sessionTimeout: { max: 900, maxLabel: '15 minutes (900 seconds)', param: 'Session Timeout' },
  autoSignOffDelay: { max: 900, maxLabel: '15 minutes (900 seconds)', param: 'Auto Sign-Off Delay' },
};

export default function SiteParameters() {
  const [selectedGroup, setSelectedGroup] = useState('kernel');
  const [editedValues, setEditedValues] = useState({});
  const [changeReason, setChangeReason] = useState('');
  const [kernelParams, setKernelParams] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isVA, setIsVA] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const sess = await getSession();
        if (sess?.facilityType && sess.facilityType !== 'va') setIsVA(false);
      } catch { /* non-fatal */ }
    })();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getSiteParameters();
      setKernelParams(normalizeKernelParams(res));
    } catch (err) {
      setError(err.message || 'Failed to load parameters');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const [packageParams, setPackageParams] = useState({});
  const [pkgLoading, setPkgLoading] = useState(false);

  // Load package-specific params when group changes
  useEffect(() => {
    const group = selectedGroup;
    if (group === 'kernel' || group === 'session') return;
    // If we already loaded this package successfully, skip
    if (packageParams[group]?.ok !== false && packageParams[group]) return;

    let cancelled = false;
    setPkgLoading(true);
    (async () => {
      try {
        const res = await getPackageParams(group);
        if (cancelled) return;
        setPackageParams(prev => ({ ...prev, [group]: res }));
      } catch (err) {
        if (!cancelled) setPackageParams(prev => ({ ...prev, [group]: { ok: false, error: err.message } }));
      } finally {
        if (!cancelled) setPkgLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedGroup]);

  // Build display params from parsed kernel data
  const getParamsForGroup = () => {
    if (!kernelParams) return [];
    if (selectedGroup === 'kernel') {
      return [
        { key: 'domainName', name: 'Domain Name', value: kernelParams.domainName?.value || '', type: 'text', description: 'VistA domain name (FQDN)' },
        { key: 'siteNumber', name: 'Site Name / Number', value: kernelParams.siteNumber?.value || '', type: 'text', description: 'Facility identifier used in VistA' },
        { key: 'prodAccount', name: 'Production Account', value: kernelParams.prodAccount?.external || '', type: 'readonly', description: 'Whether this is a production or test environment' },
        { key: 'welcomeMessage', name: 'Welcome Message', value: kernelParams.welcomeMessage?.value || '', type: 'textarea', description: 'Text displayed on the login page' },
        { key: 'disableNewUser', name: 'Disable New User Creation', value: kernelParams.disableNewUser?.external || '', type: 'readonly', description: 'Whether automatic user creation is disabled' },
      ];
    }
    if (selectedGroup === 'session') {
      const timeoutSec = Number(kernelParams.sessionTimeout?.value || 0);
      const signoffSec = Number(kernelParams.autoSignOffDelay?.value || 0);
      const rpcTimeout = Number(kernelParams.rpcTimeout?.value || 0);
      const policyLabel = isVA ? 'VHA Directive 6500' : 'Security Policy';
      const zeroWarning = (val, param) => val === 0 ? ` ⚠ Currently 0 — ${param} is not enforced. Set a value to enable.` : '';
      return [
        { key: 'sessionTimeout', name: 'Session Timeout', value: String(timeoutSec), type: 'number', unit: 'seconds', description: `Current: ${Math.round(timeoutSec/60)} minutes. ${policyLabel}: max 15 minutes (900 seconds).${zeroWarning(timeoutSec, 'session timeout')}`, critical: true, enforcedMax: 900 },
        { key: 'autoSignOffDelay', name: 'Auto Sign-Off Delay', value: String(signoffSec), type: 'number', unit: 'seconds', description: `Current: ${Math.round(signoffSec/60)} minutes. Inactive terminal disconnection time.${zeroWarning(signoffSec, 'auto sign-off')}`, critical: true, enforcedMax: 900 },
        { key: 'rpcTimeout', name: 'Response Timeout', value: String(rpcTimeout), type: 'number', unit: 'seconds', description: `Maximum wait time for server responses. Current: ${rpcTimeout} seconds.${zeroWarning(rpcTimeout, 'RPC timeout')}` },
      ];
    }
    // Package-specific params
    const pkgData = packageParams[selectedGroup];
    if (!pkgData || pkgData.error) {
      return [{ key: 'loading', name: pkgData?.error || 'Loading...', value: '', type: 'readonly', description: pkgData?.note || 'Connecting to VistA package file...' }];
    }
    // Parse raw DDR lines into editable fields
    const rawLines = pkgData.rawLines || [];
    if (rawLines.length === 0) {
      const groupDef = PARAM_TREE.flatMap(s => s.groups).find(g => g.id === selectedGroup);
      return [{ key: 'empty', name: `${groupDef?.label || selectedGroup}`, value: 'No records found', type: 'readonly', description: `VistA file #${groupDef?.vistaFile || '?'} has no entries in this system. Parameters can be configured once the package is initialized.` }];
    }
    return rawLines.map((line, i) => {
      const parts = line.split('^');
      // DDR GETS ENTRY format: FILE^IEN^FIELD^INTERNAL^EXTERNAL
      const fieldNum = parts[2] || `${i}`;
      const internal = parts[3] || '';
      const external = parts[4] || internal;
      return {
        key: `${selectedGroup}-${fieldNum}`,
        fieldNum,
        name: external || `Field ${fieldNum}`,
        value: internal,
        type: 'text',
        description: `File #${pkgData.file || '?'}, field ${fieldNum}`,
      };
    });
  };

  const params = getParamsForGroup();
  const hasChanges = Object.keys(editedValues).length > 0;

  const hasViolation = Object.entries(editedValues).some(([key, val]) => {
    const rule = VHA_RULES[key];
    if (rule && Number(val) > rule.max) return true;
    return false;
  });

  const updateParam = (key, value) => {
    setEditedValues(prev => {
      const original = params.find(p => p.key === key)?.value;
      if (value === original) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: value };
    });
  };

  const handleSave = async () => {
    if (hasViolation || !changeReason.trim()) return;
    setSaving(true);
    setSaveError('');
    try {
      if (selectedGroup === 'kernel' || selectedGroup === 'session') {
        await updateSiteParameters({ ...editedValues, reason: changeReason });
      } else {
        // Package-specific save
        const payload = {};
        for (const [key, val] of Object.entries(editedValues)) {
          const param = params.find(p => p.key === key);
          if (param?.fieldNum) payload[param.fieldNum] = val;
          else payload[key] = val;
        }
        payload.reason = changeReason;
        await updatePackageParams(selectedGroup, payload);
        // Reload package params
        const res = await getPackageParams(selectedGroup);
        setPackageParams(prev => ({ ...prev, [selectedGroup]: res }));
      }
      setEditedValues({});
      setChangeReason('');
      if (selectedGroup === 'kernel' || selectedGroup === 'session') await loadData();
    } catch (err) {
      setSaveError(err.message || 'Failed to save parameters. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <AppShell breadcrumb="Admin > Site Parameters">
        <div className="p-6"><ErrorState message={error} onRetry={loadData} /></div>
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumb="Admin > Site Parameters">
      <div className="flex h-[calc(100vh-40px)]">
        <div className="w-[260px] border-r border-border overflow-auto p-3 flex-shrink-0">
          <h1 className="text-[28px] font-bold text-text px-2 mb-1">Site Parameters</h1>
          <p className="text-[10px] text-text-muted px-2 mb-4">
            {loading ? 'Loading from VistA...' : 'Live Kernel System Parameters (#8989.3)'}
          </p>

          {PARAM_TREE.map(section => (
            <div key={section.section} className="mb-3">
              <div className="px-2 py-1 text-[10px] font-bold text-text-muted uppercase tracking-wider">{section.section}</div>
              {section.groups.map(group => (
                <button key={group.id} onClick={() => { setSelectedGroup(group.id); setEditedValues({}); setChangeReason(''); }}
                  className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-md text-xs transition-colors ${
                    selectedGroup === group.id ? 'bg-[#E8EEF5] text-steel font-medium' : 'text-text hover:bg-surface-alt'
                  }`}>
                  <span className="material-symbols-outlined text-[16px]">{group.icon}</span>
                  {group.label}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-6 min-w-0">
          <CautionBanner>
            Changes to these settings affect all users at this facility.
            Verify changes carefully and document your reason before saving.
          </CautionBanner>

          {(loading || pkgLoading) ? (
            <div className="space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="h-24 animate-pulse bg-[#E2E4E8] rounded-lg" />)}</div>
          ) : (
            <div className="space-y-5">
              {params.map(param => {
                const isEdited = param.key in editedValues;
                const displayValue = isEdited ? editedValues[param.key] : param.value;
                const rule = VHA_RULES[param.key];
                const isViolation = rule && isEdited && Number(displayValue) > rule.max;

                return (
                  <div key={param.key} className={`p-4 rounded-lg border ${isEdited ? (isViolation ? 'border-[#CC3333] bg-[#FDE8E8]' : 'border-warning bg-[#FFFDE7]') : 'border-border bg-white'}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {param.critical && <span className="material-symbols-outlined text-danger text-[16px]">error</span>}
                        <span className="font-semibold text-sm text-text">{param.name}</span>
                      </div>
                      {param.enforcedMax && (
                        <span className="text-[10px] bg-danger-bg text-danger px-2 py-0.5 rounded-full font-medium">
                          Enforced max: {param.enforcedMax} {param.unit}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-secondary mb-3">{param.description}</p>
                    <div className="flex items-center gap-4">
                      {param.type === 'number' && (
                        <div className="flex items-center gap-2">
                          <input type="number" value={displayValue} onChange={e => updateParam(param.key, e.target.value)}
                            className="w-28 h-8 px-3 text-sm font-mono border border-border rounded-md focus:outline-none focus:border-steel" />
                          <span className="text-xs text-text-muted">{param.unit}</span>
                        </div>
                      )}
                      {param.type === 'text' && (
                        <input type="text" value={displayValue} onChange={e => updateParam(param.key, e.target.value)}
                          className="flex-1 h-8 px-3 text-sm border border-border rounded-md focus:outline-none focus:border-steel" />
                      )}
                      {param.type === 'textarea' && (
                        <textarea value={displayValue} onChange={e => updateParam(param.key, e.target.value)}
                          className="flex-1 h-20 px-3 py-2 text-sm border border-border rounded-md resize-none focus:outline-none focus:border-steel" />
                      )}
                      {param.type === 'readonly' && (
                        <div className="text-sm font-mono text-text-secondary">{displayValue || '—'}</div>
                      )}
                      {isEdited && (
                        <button onClick={() => {
                          setEditedValues(prev => { const next = { ...prev }; delete next[param.key]; return next; });
                        }} className="text-[10px] text-[#2E5984] hover:underline ml-auto">Rollback</button>
                      )}
                    </div>
                    {isViolation && (
                      <div className="mt-2 text-xs text-[#CC3333] font-semibold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">block</span>
                        Exceeds security policy maximum of {rule.maxLabel}. Save will be blocked.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="w-[300px] border-l border-border overflow-auto p-4 flex-shrink-0 bg-surface-alt">
          <h3 className="text-sm font-bold text-text mb-4">Change Preview</h3>
          {!hasChanges ? (
            <p className="text-xs text-text-muted">No changes pending. Edit a parameter to see the impact preview.</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(editedValues).map(([key, newVal]) => {
                const param = params.find(p => p.key === key);
                return (
                  <div key={key} className="bg-white border border-border rounded-lg p-3">
                    <div className="font-medium text-xs text-text mb-1">{param?.name || key}</div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-text-muted line-through">{param?.value}</span>
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      <span className="font-semibold text-warning">{newVal}</span>
                    </div>
                  </div>
                );
              })}
              <div className="pt-3 border-t border-border">
                <label className="block text-xs font-medium text-text mb-1">
                  Reason for Change <span className="text-danger">*</span>
                </label>
                <textarea value={changeReason} onChange={e => setChangeReason(e.target.value)}
                  placeholder="Document the reason for this change"
                  className="w-full h-20 px-3 py-2 text-xs border border-border rounded-md resize-none focus:outline-none focus:border-steel" />
              </div>
              <div className="space-y-2">
                {saveError && (
                  <div className="p-2 bg-[#FDE8E8] border border-[#CC3333] rounded-lg text-[11px] text-[#CC3333] flex items-start gap-2">
                    <span className="material-symbols-outlined text-[14px] mt-0.5">error</span>
                    <span>{saveError}</span>
                  </div>
                )}
                {hasViolation && (
                  <div className="p-2 bg-[#FDE8E8] border border-[#CC3333] rounded-lg text-[11px] text-[#CC3333] flex items-start gap-2">
                    <span className="material-symbols-outlined text-[14px] mt-0.5">block</span>
                    <span>Save blocked — security policy violation.</span>
                  </div>
                )}
                <button disabled={!changeReason.trim() || hasViolation || saving} onClick={handleSave}
                  className="w-full py-2 text-sm font-medium bg-navy text-white rounded-md hover:bg-steel transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button onClick={() => { setEditedValues({}); setChangeReason(''); }}
                  className="w-full py-2 text-sm border border-border rounded-md hover:bg-white transition-colors">
                  Revert All
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
