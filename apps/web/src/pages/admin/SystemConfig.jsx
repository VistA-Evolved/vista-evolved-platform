import { useState, useEffect, useCallback } from 'react';
import AppShell from '../../components/shell/AppShell';
import LoginIntroPreview from '../../components/shared/LoginIntroPreview';
import { getSiteParameters, updateSiteParameters, getVistaStatus } from '../../services/adminService';
import ErrorState from '../../components/shared/ErrorState';

/**
 * System Configuration — Screen 6
 * @vista KERNEL SYSTEM PARAMETERS #8989.3 + VistA status probe
 *
 * Organized as:
 *   Section A: Organization Identity
 *   Section B: Login Experience
 *   Section C: System Information (read-only)
 */

const AGENCY_LABELS = {
  'V': 'Government — Department of Veterans Affairs',
  'I': 'Government — Indian Health Service',
  'D': 'Government — Department of Defense',
  'P': 'Private Healthcare System',
};

function normalizeParams(res) {
  if (!res) return {};
  if (Array.isArray(res.data) && res.data.length > 0) {
    const out = {};
    for (const row of res.data) {
      out[row.name] = { value: row.value ?? '', description: row.description || '' };
    }
    return out;
  }
  return {};
}

export default function SystemConfig() {
  useEffect(() => { document.title = 'System Configuration — VistA Evolved'; }, []);
  const [params, setParams] = useState(null);
  const [vistaInfo, setVistaInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editedValues, setEditedValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [paramRes, statusRes] = await Promise.all([
        getSiteParameters(),
        getVistaStatus().catch(() => null),
      ]);
      setParams(normalizeParams(paramRes));
      setVistaInfo(statusRes);
    } catch (err) {
      setError(err.message || 'Failed to load system configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const updateField = (fieldName, value) => {
    setEditedValues(prev => {
      const original = params?.[fieldName]?.value ?? '';
      if (String(value) === String(original)) {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      }
      return { ...prev, [fieldName]: value };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveResult(null);
    try {
      for (const [fieldName, newVal] of Object.entries(editedValues)) {
        await updateSiteParameters({ paramName: fieldName, value: String(newVal), reason: 'System configuration update' });
      }
      setEditedValues({});
      await loadData();
      setSaveResult({ type: 'success', msg: 'Configuration saved.' });
      setTimeout(() => setSaveResult(null), 4000);
    } catch (err) {
      setSaveResult({ type: 'error', msg: err.message || 'Failed to save.' });
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = Object.keys(editedValues).length > 0;
  const domain = params?.['DOMAIN']?.value || '';
  const siteName = params?.['SITE NAME']?.value || '';
  const agencyCode = params?.['AGENCY CODE']?.value || '';
  const production = params?.['PRODUCTION']?.value || '';
  const brokerTimeout = params?.['BROKER TIMEOUT']?.value || '';
  const introMessage = editedValues['INTRO MESSAGE'] ?? params?.['INTRO MESSAGE']?.value ?? '';
  const stationNumber = params?.['STATION NUMBER']?.value || vistaInfo?.vista?.stationNumber || '';
  const timeZone = params?.['TIME ZONE']?.value || vistaInfo?.vista?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  const defaultInstitution = params?.['DEFAULT INSTITUTION']?.value || '';
  const vistaVersion = vistaInfo?.vista?.vistaVersion || vistaInfo?.vista?.version || '';

  if (error) {
    return (
      <AppShell breadcrumb="Admin > System Configuration">
        <div className="p-6"><ErrorState message={error} onRetry={loadData} /></div>
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumb="Admin > System Configuration">
      <div className="p-6 max-w-3xl">
        <h1 className="text-[22px] font-bold text-text mb-1">System Configuration</h1>
        <p className="text-xs text-[#999] mb-6">Organization identity, login experience, and system information.</p>

        {saveResult?.type === 'success' && (
          <div className="mb-4 p-3 bg-[#E8F5E9] border border-[#2D6A4F] rounded-lg text-[12px] text-[#2D6A4F] flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            {saveResult.msg}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-32 animate-pulse bg-[#E2E4E8] rounded-lg" />)}</div>
        ) : (
          <>
            {/* Section A: Organization Identity */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-text mb-1 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#2E5984]">apartment</span>
                Organization Identity
              </h2>
              <p className="text-[11px] text-[#999] mb-4">Core system identification.</p>
              <div className="mb-4 rounded-lg border border-[#D6E4F0] bg-[#F8FAFC] px-3 py-2 text-[11px] text-[#52606D]">
                These values are read-only here because they are established during VistA installation or derived from live Kernel site configuration.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-white border border-[#E2E4E8] rounded-lg">
                  <label className="block text-xs font-medium text-text mb-1">Organization Name</label>
                  <div className="text-sm font-medium text-text">{siteName || '—'}</div>
                  <p className="text-[10px] text-[#999] mt-1">Primary institution for this system</p>
                </div>
                <div className="p-4 bg-white border border-[#E2E4E8] rounded-lg">
                  <label className="block text-xs font-medium text-text mb-1">Domain Name</label>
                  <div className="text-sm font-mono text-[#666]">{domain || '—'}</div>
                  <p className="text-[10px] text-[#999] mt-1">The system domain registered in VistA Kernel. This identifies the system in network communications.</p>
                </div>
                <div className="p-4 bg-white border border-[#E2E4E8] rounded-lg">
                  <label className="block text-xs font-medium text-text mb-1">Default Institution</label>
                  <div className="text-sm text-text">{defaultInstitution || '—'}</div>
                  <p className="text-[10px] text-[#999] mt-1">The primary institution (VistA File #4) for this system</p>
                </div>
                <div className="p-4 bg-white border border-[#E2E4E8] rounded-lg">
                  <label className="block text-xs font-medium text-text mb-1">Organization Type</label>
                  <div className="text-sm text-text">{AGENCY_LABELS[agencyCode] || agencyCode || '—'}</div>
                </div>
                <div className="p-4 bg-white border border-[#E2E4E8] rounded-lg">
                  <label className="block text-xs font-medium text-text mb-1">Environment</label>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      production?.toUpperCase() === 'YES'
                        ? 'bg-[#E8F5E9] text-[#2D6A4F]'
                        : 'bg-[#FFF3E0] text-[#E65100]'
                    }`}>
                      <span className="material-symbols-outlined text-[12px]">
                        {production?.toUpperCase() === 'YES' ? 'verified' : 'science'}
                      </span>
                      {production?.toUpperCase() === 'YES' ? 'Production' : 'Test / Sandbox'}
                    </span>
                  </div>
                </div>
                <div className="p-4 bg-white border border-[#E2E4E8] rounded-lg">
                  <label className="block text-xs font-medium text-text mb-1">Facility Code</label>
                  <div className="text-sm font-mono text-[#666]">{stationNumber || '—'}</div>
                  <p className="text-[10px] text-[#999] mt-1">Station number / site identifier</p>
                </div>
                <div className="p-4 bg-white border border-[#E2E4E8] rounded-lg">
                  <label className="block text-xs font-medium text-text mb-1">Time Zone</label>
                  <div className="text-sm text-text">{timeZone || '—'}</div>
                  <p className="text-[10px] text-[#999] mt-1">Server time zone for scheduling and timestamps</p>
                </div>
              </div>
            </section>

            {/* Section B: Login Experience */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-text mb-1 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#2E5984]">campaign</span>
                Login Experience
              </h2>
              <p className="text-[11px] text-[#999] mb-4">Controls what users see when signing in.</p>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
                <div className="space-y-4">
                  <div className="p-4 bg-white border border-[#E2E4E8] rounded-lg">
                    <label className="block text-xs font-medium text-text mb-1">Welcome Message</label>
                    <p className="text-[10px] text-[#999] mb-2">Text displayed on the login screen. Supports multiple lines.</p>
                    <textarea
                      value={introMessage}
                      onChange={e => updateField('INTRO MESSAGE', e.target.value)}
                      className="w-full h-32 px-3 py-2 text-sm border border-[#E2E4E8] rounded-md resize-none focus:outline-none focus:border-[#2E5984] font-mono"
                      placeholder="Enter a welcome message for the login screen..."
                    />
                  </div>
                  <div className="p-4 bg-white border border-[#E2E4E8] rounded-lg">
                    <label className="block text-xs font-medium text-text mb-1">Server Response Timeout</label>
                    <p className="text-[10px] text-[#999] mb-2">Maximum time (seconds) to wait for the server to respond to a request.</p>
                    <div className="flex items-center gap-2">
                      <input type="number"
                        value={editedValues['BROKER TIMEOUT'] ?? brokerTimeout}
                        onChange={e => updateField('BROKER TIMEOUT', e.target.value)}
                        className="w-28 h-8 px-3 text-sm font-mono border border-[#E2E4E8] rounded-md focus:outline-none focus:border-[#2E5984]" />
                      <span className="text-xs text-[#999]">seconds</span>
                    </div>
                  </div>
                </div>

                <LoginIntroPreview
                  siteName={siteName}
                  domain={domain}
                  production={production}
                  message={introMessage}
                />
              </div>
            </section>

            {/* Section C: System Information */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-text mb-1 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#2E5984]">info</span>
                System Information
              </h2>
              <p className="text-[11px] text-[#999] mb-4">Read-only technical details about this system.</p>
              <div className="mb-4 rounded-lg border border-[#D6E4F0] bg-[#F8FAFC] px-3 py-2 text-[11px] text-[#52606D]">
                These values are status-only. They are populated from the live VistA connection and cannot be edited from this screen.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { label: 'System Status', value: vistaInfo?.vista?.vistaReachable ? 'Connected' : 'Unreachable', icon: vistaInfo?.vista?.vistaReachable ? 'check_circle' : 'error', color: vistaInfo?.vista?.vistaReachable ? 'text-[#2D6A4F]' : 'text-[#CC3333]', hint: 'Whether VistA is reachable from the web server. If \'Unreachable\', check the VistA Docker container and network.' },
                  { label: 'Current User', value: vistaInfo?.vista?.userName || '—' },
                  { label: 'Connection Mode', value: vistaInfo?.connectionMode === 'direct-xwb' ? 'Direct' : vistaInfo?.connectionMode || 'Unknown' },
                  { label: 'Production Mode', value: vistaInfo?.productionMode ? 'Yes' : 'No', hint: 'Read from VistA Kernel field 501. When \'Yes\', certain development/test features are disabled.' },
                  ...(vistaVersion ? [{ label: 'VistA Version', value: vistaVersion }] : []),
                ].map(item => (
                  <div key={item.label} className="p-3 bg-[#F4F5F7] border border-[#E2E4E8] rounded-lg">
                    <div className="text-[10px] text-[#999] mb-0.5">{item.label}</div>
                    <div className={`text-sm font-medium flex items-center gap-1 ${item.color || 'text-text'}`}>
                      {item.icon && <span className="material-symbols-outlined text-[14px]">{item.icon}</span>}
                      {item.value}
                    </div>
                    {item.hint && <p className="text-[9px] text-[#BBB] mt-1">{item.hint}</p>}
                  </div>
                ))}
              </div>
            </section>

            {/* Save panel */}
            {hasChanges && (
              <div className="p-4 bg-[#F4F5F7] border border-[#E2E4E8] rounded-lg">
                {saveResult?.type === 'error' && (
                  <div className="p-2 bg-[#FDE8E8] border border-[#CC3333] rounded-lg text-[11px] text-[#CC3333] flex items-start gap-2 mb-3">
                    <span className="material-symbols-outlined text-[14px] mt-0.5">error</span>
                    <span>{saveResult.msg}</span>
                  </div>
                )}
                <div className="flex gap-3">
                  <button disabled={saving} onClick={handleSave}
                    className="px-5 py-2 text-sm font-medium bg-[#1A1A2E] text-white rounded-md hover:bg-[#2E5984] transition-colors disabled:opacity-40">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button onClick={() => setEditedValues({})}
                    className="px-4 py-2 text-sm border border-[#E2E4E8] rounded-md hover:bg-white">
                    Discard Changes
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Terminal Reference */}
      <details className="mt-8 mb-4 text-sm text-[#6B7280] border border-[#E2E4E8] rounded-md p-4 bg-[#FAFAFA]">
        <summary className="cursor-pointer font-medium text-[#374151]">📖 Terminal Reference</summary>
        <p className="mt-2">This page shows system identity from VistA Kernel (File #8989.3) and Institution (File #4).</p>
        <p className="mt-1">Terminal equivalent: <strong>EVE → Operations → Kernel Management → Enter/Edit Kernel Site Parameters</strong> (identity fields).</p>
        <p className="mt-1">Some values are read-only in both terminal and web (e.g., Production flag).</p>
      </details>
    </AppShell>
  );
}
