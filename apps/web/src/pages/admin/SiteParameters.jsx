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
      { id: 'kernel', label: 'Core System Settings', icon: 'settings' },
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
      { id: 'scheduling', label: 'Scheduling Settings', icon: 'calendar_month', vistaFile: '44.1' },
    ],
  },
  {
    section: 'Radiology',
    groups: [
      { id: 'radiology', label: 'Radiology Settings', icon: 'radiology', vistaFile: '79.1' },
    ],
  },
  {
    section: 'Patients & Registration',
    groups: [
      { id: 'registration', label: 'Registration Settings', icon: 'badge', vistaFile: '43' },
    ],
  },
  {
    section: 'Billing',
    groups: [
      { id: 'billing', label: 'Billing Settings', icon: 'receipt_long', vistaFile: '350.9' },
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
};

// Known field groupings for package parameter files. When the server returns
// discovered fields, we organize them into logical sections instead of a flat list.
const FIELD_GROUPS = {
  'pharmacy': [
    { label: 'Site Identity', fields: ['.01', '.02', '.03'] },
    { label: 'Dispensing', fields: ['1', '2', '3', '4', '5'] },
    { label: 'Label Printing', fields: ['6', '7', '8', '9', '10'] },
    { label: 'Processing', fields: ['11', '12', '13', '14', '15'] },
  ],
  'lab': [
    { label: 'Site Identity', fields: ['.01', '.02', '.03'] },
    { label: 'Processing', fields: ['1', '2', '3', '4', '5'] },
    { label: 'Reporting', fields: ['6', '7', '8', '9', '10'] },
  ],
  'scheduling': [
    { label: 'Site Identity', fields: ['.01', '.02', '.03'] },
    { label: 'Booking Rules', fields: ['1', '2', '3', '4', '5'] },
  ],
  'order-entry': [
    { label: 'Site Identity', fields: ['.01', '.02', '.03'] },
    { label: 'Order Processing', fields: ['1', '2', '3', '4', '5'] },
    { label: 'Notifications', fields: ['6', '7', '8', '9', '10'] },
  ],
  'radiology': [
    { label: 'Site Identity', fields: ['.01', '.02', '.03'] },
    { label: 'Imaging Defaults', fields: ['1', '2', '3', '4', '5'] },
    { label: 'Report Settings', fields: ['6', '7', '8', '9', '10'] },
  ],
  'registration': [
    { label: 'Site Identity', fields: ['.01', '.02', '.03'] },
    { label: 'Admissions & ADT', fields: ['1', '2', '3', '4', '5'] },
  ],
  'billing': [
    { label: 'Site Identity', fields: ['.01', '.02', '.03', '.04', '.05', '.06'] },
    { label: 'Claims & Filing', fields: ['.08', '.09', '.14', '1.01', '1.02', '1.05', '1.06', '1.07', '1.08', '1.09', '1.14', '1.15', '1.17', '1.19', '1.21', '1.25'] },
    { label: 'Tracking & Automation', fields: ['2.08', '2.09', '2.11', '6.01', '6.02', '6.03', '6.04', '6.05', '6.23', '6.24', '6.25', '7.01', '7.02', '7.03', '7.04', '8.01', '8.03', '8.04', '8.1', '9.1'] },
  ],
  'surgery': [
    { label: 'Site Identity', fields: ['.01', '.02', '.03'] },
    { label: 'Scheduling', fields: ['1', '2', '3', '4', '5'] },
    { label: 'Documentation', fields: ['6', '7', '8', '9', '10'] },
  ],
};

function getGuidanceTone(kind) {
  switch (kind) {
    case 'range':
      return {
        border: 'border-[#BFDBFE] bg-[#EFF6FF]',
        icon: 'rule_settings',
        iconColor: 'text-[#1D4ED8]',
        titleColor: 'text-[#1E3A8A]',
        detailColor: 'text-[#355070]',
      };
    case 'expected':
      return {
        border: 'border-[#C7E9D0] bg-[#F0FDF4]',
        icon: 'task_alt',
        iconColor: 'text-[#15803D]',
        titleColor: 'text-[#166534]',
        detailColor: 'text-[#355070]',
      };
    case 'setup':
      return {
        border: 'border-[#FDE68A] bg-[#FFFBEB]',
        icon: 'build',
        iconColor: 'text-[#B45309]',
        titleColor: 'text-[#92400E]',
        detailColor: 'text-[#6B4F1D]',
      };
    case 'identity':
      return {
        border: 'border-[#D8B4FE] bg-[#FAF5FF]',
        icon: 'domain_verification',
        iconColor: 'text-[#7E22CE]',
        titleColor: 'text-[#6B21A8]',
        detailColor: 'text-[#5B4B8A]',
      };
    case 'workflow':
      return {
        border: 'border-[#FCD34D] bg-[#FFFBEB]',
        icon: 'tune',
        iconColor: 'text-[#CA8A04]',
        titleColor: 'text-[#854D0E]',
        detailColor: 'text-[#6B4F1D]',
      };
    case 'system':
    default:
      return {
        border: 'border-[#E5E7EB] bg-[#F9FAFB]',
        icon: 'info',
        iconColor: 'text-[#6B7280]',
        titleColor: 'text-[#374151]',
        detailColor: 'text-[#4B5563]',
      };
  }
}

function getParameterGuidance(selectedGroup, param) {
  if (!param) return null;

  if (selectedGroup === 'session') {
    if (param.key === 'sessionTimeout') {
      return {
        kind: 'range',
        title: 'Recommended range',
        summary: '300-900 seconds',
        detail: 'Five to fifteen minutes is the normal operating range. Going above 900 seconds violates the VHA maximum already enforced on save.',
      };
    }
    if (param.key === 'rpcTimeout') {
      return {
        kind: 'range',
        title: 'Recommended range',
        summary: '30-300 seconds',
        detail: 'Use the shortest timeout that still lets legitimate long-running RPCs finish. Values far above five minutes usually hide slow or stalled integrations.',
      };
    }
  }

  if (selectedGroup === 'kernel') {
    if (param.key === 'welcomeMessage') {
      return {
        kind: 'workflow',
        title: 'Recommended baseline',
        summary: 'Keep it short and operational',
        detail: 'Use one brief environment or outage notice that operators can scan before signing in. Avoid long policy text that pushes the login form down.',
      };
    }
    if (param.key === 'domainName' || param.key === 'siteNumber') {
      return {
        kind: 'identity',
        title: 'Expected state',
        summary: 'Match live site identity',
        detail: 'These values should match the real Kernel site identity for the environment. Treat mismatches as configuration issues, not tuning opportunities.',
      };
    }
  }

  const label = String(param.name || '').trim();
  const normalizedLabel = label.toLowerCase();

  if (!label) return null;

  if (/how many .* per (visit|exam)/i.test(label)) {
    return {
      kind: 'range',
      title: 'Recommended baseline',
      summary: 'Start at 1',
      detail: 'A single printed card or label is the safe default. Raise this only when the physical workflow truly requires duplicates.',
    };
  }

  if (/timeout/i.test(label)) {
    return {
      kind: 'range',
      title: 'Recommended baseline',
      summary: 'Keep the timeout finite',
      detail: 'Use a short, explicit timeout instead of leaving integrations to hang indefinitely. Increase it only when a known downstream job needs more time.',
    };
  }

  if (/site name|default institution|location|name$/i.test(label) && !/printer|format|source/i.test(label)) {
    return {
      kind: 'identity',
      title: 'Expected state',
      summary: 'Should reflect the real site record',
      detail: 'This value should align with the local institution, location, or package site record already established in VistA.',
    };
  }

  if (/printer|format|source|language/i.test(label)) {
    return {
      kind: 'setup',
      title: 'Configure only after dependency setup',
      summary: 'Leave blank until the target exists',
      detail: 'Populate this only after the corresponding printer, print format, source file, or external feed has been installed and tested.',
    };
  }

  if (/conversion|converted|inits run|background job|current order #|restart number|marker|date .*converted|conversion status|status$/i.test(normalizedLabel)) {
    return {
      kind: 'expected',
      title: 'System-managed marker',
      summary: 'Usually not tuned by hand',
      detail: 'This looks like a migration, initialization, or package status marker. Treat unexpected values as setup history to investigate, not as a routine knob to adjust.',
    };
  }

  if (/print labels|ask |treating specialty|completed/i.test(label)) {
    return {
      kind: 'workflow',
      title: 'Workflow-dependent setting',
      summary: 'Change only with package-owner approval',
      detail: 'This toggles prompts or package behavior. Keep the current baseline unless the downstream clinical workflow has been reviewed with the responsible ADPAC or service owner.',
    };
  }

  return null;
}

export default function SiteParameters() {
  useEffect(() => { document.title = 'Site Parameters — VistA Evolved'; }, []);
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
      } catch (err) {
        console.warn('Failed to load site parameter session context:', err);
      }
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
        { key: 'domainName', name: 'Domain Name', value: kernelParams.domainName?.value || '', type: 'text', description: 'System domain name (FQDN)' },
        { key: 'siteNumber', name: 'Site Name / Number', value: kernelParams.siteNumber?.value || '', type: 'text', description: 'Facility identifier for this system' },
        { key: 'prodAccount', name: 'Production Account', value: kernelParams.prodAccount?.external || '', type: 'readonly', description: 'Whether this is a production or test environment' },
        { key: 'welcomeMessage', name: 'Welcome Message', value: kernelParams.welcomeMessage?.value || '', type: 'textarea', description: 'Text displayed on the login page' },
        { key: 'disableNewUser', name: 'Disable New User Creation', value: kernelParams.disableNewUser?.external || '', type: 'readonly', description: 'Whether automatic user creation is disabled' },
      ];
    }
    if (selectedGroup === 'session') {
      const timeoutSec = Number(kernelParams.sessionTimeout?.value || 0);
      const rpcTimeout = Number(kernelParams.rpcTimeout?.value || 0);
      const policyLabel = isVA ? 'VHA Directive 6500' : 'Security Policy';
      const zeroWarning = (val, param) => val === 0 ? ` ⚠ Currently 0 — ${param} is not enforced. Set a value to enable.` : '';
      return [
        { key: 'sessionTimeout', name: 'Session Timeout (Auto Sign-Off)', value: String(timeoutSec), type: 'number', unit: 'seconds', description: `Current: ${Math.round(timeoutSec/60)} minutes. ${policyLabel}: max 15 minutes (900 seconds). This controls how long an inactive session remains open before automatic sign-off.${zeroWarning(timeoutSec, 'session timeout')}`, critical: true, enforcedMax: 900 },
        { key: 'rpcTimeout', name: 'Response Timeout', value: String(rpcTimeout), type: 'number', unit: 'seconds', description: `Maximum wait time for server responses. Current: ${rpcTimeout} seconds.${zeroWarning(rpcTimeout, 'response timeout')}` },
      ];
    }
    // Package-specific params
    const pkgData = packageParams[selectedGroup];
    if (!pkgData || pkgData.error) {
      return [{ key: 'loading', name: pkgData?.error || 'Loading...', value: '', type: 'readonly', description: pkgData?.note || 'Connecting to system...' }];
    }
    // Use the structured data[] array from the server which includes
    // real DD field labels (e.g. "Flash Card Printer Name") instead of
    // raw DDR field numbers ("Field 3 / Configuration parameter 3").
    const structuredData = pkgData.data || [];
    if (structuredData.length > 0) {
      const groupDefs = FIELD_GROUPS[selectedGroup];
      const items = structuredData.map(d => ({
        key: `${selectedGroup}-${d.fieldNum}`,
        fieldNum: d.fieldNum,
        name: d.label || d.description || `Parameter #${d.fieldNum} (label unavailable — check system configuration)`,
        value: d.value || '',
        type: 'text',
        description: d.displayValue && d.displayValue !== d.value
          ? `Current value: ${d.displayValue}`
          : `VistA File #${pkgData.file || '?'}, field ${d.fieldNum}`,
        vistaFile: pkgData.file,
      }));
      // If we have group definitions, add section headers
      if (groupDefs) {
        const grouped = [];
        const assigned = new Set();
        for (const grp of groupDefs) {
          const members = items.filter(p => grp.fields.includes(p.fieldNum));
          if (members.length > 0) {
            grouped.push({ key: `header-${grp.label}`, name: grp.label, value: '', type: 'section-header', description: '' });
            grouped.push(...members);
            members.forEach(m => assigned.add(m.key));
          }
        }
        // Remaining ungrouped fields
        const remaining = items.filter(p => !assigned.has(p.key));
        if (remaining.length > 0) {
          if (grouped.length > 0) {
            grouped.push({ key: 'header-other', name: 'Other Settings', value: '', type: 'section-header', description: '' });
          }
          grouped.push(...remaining);
        }
        return grouped.length > 0 ? grouped : items;
      }
      return items;
    }
    // Legacy fallback: parse raw DDR lines if server didn't return structured data
    const rawLines = pkgData.rawLines || [];
    if (rawLines.length === 0) {
      const groupDef = PARAM_TREE.flatMap(s => s.groups).find(g => g.id === selectedGroup);
      return [{ key: 'empty', name: `${groupDef?.label || selectedGroup}`, value: '', type: 'readonly', description: 'This module uses default settings. Configure as needed once the package is initialized.' }];
    }
    return rawLines.map((line, i) => {
      const parts = line.split('^');
      const fieldNum = parts[2] || `${i}`;
      const internal = parts[3] || '';
      const external = parts[4] || internal;
      return {
        key: `${selectedGroup}-${fieldNum}`,
        fieldNum,
        name: `Parameter #${fieldNum} (unlabeled)`,
        value: internal,
        type: 'text',
        description: external ? `Value: ${external}` : '',
      };
    });
  };

  const params = getParamsForGroup();
  const hasChanges = Object.keys(editedValues).length > 0;
  const guidedParams = params.filter(param => getParameterGuidance(selectedGroup, param));

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

  // Frontend field key → ZVE PARAM SET paramName. These are the exact
  // names the ZVE PARAM GET RPC returns, so the round-trip stays
  // consistent: the edit form reads a field under one key and writes
  // back with the matching VistA param name.
  const KERNEL_FIELD_TO_PARAM = {
    sessionTimeout: 'AUTOLOGOFF',
    rpcTimeout: 'BROKER TIMEOUT',
    welcomeMessage: 'WELCOME MESSAGE',
    domainName: 'DOMAIN',
    siteNumber: 'SITE NAME',
  };

  const handleSave = async () => {
    if (hasViolation || !changeReason.trim()) return;
    setSaving(true);
    setSaveError('');
    try {
      if (selectedGroup === 'kernel' || selectedGroup === 'session') {
        // ZVE PARAM SET takes one param at a time — submit each edited
        // field as its own save with the mapped VistA paramName.
        for (const [key, val] of Object.entries(editedValues)) {
          const paramName = KERNEL_FIELD_TO_PARAM[key];
          if (!paramName) {
            throw new Error(`Unknown parameter: ${key}`);
          }
          await updateSiteParameters({ paramName, value: String(val), reason: changeReason });
        }
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
        <div className="w-[200px] lg:w-[260px] border-r border-border overflow-auto p-3 flex-shrink-0">
          <h1 className="text-[22px] font-bold text-text px-2 mb-1">Site Parameters</h1>
          <p className="text-[10px] text-text-muted px-2 mb-4">
            {loading ? 'Loading...' : 'Live System Parameters'}
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

          <p className="text-[11px] text-[#999] mb-4">
            Configure package-specific parameters. Each clinical module (Pharmacy, Lab, Scheduling, etc.) has its own parameter file in VistA. Changes here affect all users of that module.
          </p>

          {/* Package-specific helper text */}
          {selectedGroup === 'pharmacy' && (
            <div className="mb-3 p-3 bg-[#F5F8FB] rounded-lg text-[11px] text-[#666] flex items-start gap-2">
              <span className="material-symbols-outlined text-[14px] text-[#2E5984] mt-0.5">info</span>
              Pharmacy Site Parameters (VistA File #59.7). Controls dispensing behavior, label printing, and prescription processing rules.
            </div>
          )}
          {selectedGroup === 'lab' && (
            <div className="mb-3 p-3 bg-[#F5F8FB] rounded-lg text-[11px] text-[#666] flex items-start gap-2">
              <span className="material-symbols-outlined text-[14px] text-[#2E5984] mt-0.5">info</span>
              Lab Site Parameters (VistA File #69.9). Controls specimen processing, auto-verification rules, and result reporting.
            </div>
          )}
          {selectedGroup === 'scheduling' && (
            <div className="mb-3 p-3 bg-[#F5F8FB] rounded-lg text-[11px] text-[#666] flex items-start gap-2">
              <span className="material-symbols-outlined text-[14px] text-[#2E5984] mt-0.5">info</span>
              Scheduling Parameters (VistA File #44.1). Controls appointment booking rules, clinic availability, and scheduling notifications.
            </div>
          )}
          {selectedGroup === 'order-entry' && (
            <div className="mb-3 p-3 bg-[#F5F8FB] rounded-lg text-[11px] text-[#666] flex items-start gap-2">
              <span className="material-symbols-outlined text-[14px] text-[#2E5984] mt-0.5">info</span>
              Order Entry Parameters (VistA File #100.99). Controls CPRS order processing, signature requirements, and notification rules.
            </div>
          )}
          {selectedGroup === 'radiology' && (
            <div className="mb-3 p-3 bg-[#F5F8FB] rounded-lg text-[11px] text-[#666] flex items-start gap-2">
              <span className="material-symbols-outlined text-[14px] text-[#2E5984] mt-0.5">info</span>
              Radiology Parameters (VistA File #79.1). Controls imaging defaults, report formatting, and procedure tracking.
            </div>
          )}
          {selectedGroup === 'registration' && (
            <div className="mb-3 p-3 bg-[#F5F8FB] rounded-lg text-[11px] text-[#666] flex items-start gap-2">
              <span className="material-symbols-outlined text-[14px] text-[#2E5984] mt-0.5">info</span>
              Registration Parameters (VistA File #43). Controls patient-registration and admission defaults that apply across the site.
            </div>
          )}
          {selectedGroup === 'billing' && (
            <div className="mb-3 p-3 bg-[#F5F8FB] rounded-lg text-[11px] text-[#666] flex items-start gap-2">
              <span className="material-symbols-outlined text-[14px] text-[#2E5984] mt-0.5">info</span>
              Billing Parameters (VistA File #350.9). Controls site-level claims, tracking, and automated billing behavior.
            </div>
          )}
          {selectedGroup === 'surgery' && (
            <div className="mb-3 p-3 bg-[#F5F8FB] rounded-lg text-[11px] text-[#666] flex items-start gap-2">
              <span className="material-symbols-outlined text-[14px] text-[#2E5984] mt-0.5">info</span>
              Surgery Parameters (VistA File #136). Controls surgical scheduling, documentation requirements, and case tracking.
            </div>
          )}
          {selectedGroup === 'kernel' && (
            <div className="mb-3 p-3 bg-[#F5F8FB] rounded-lg text-[11px] text-[#666] flex items-start gap-2">
              <span className="material-symbols-outlined text-[14px] text-[#2E5984] mt-0.5">info</span>
              Kernel System Parameters (VistA File #8989.3). Core system identity — domain name, site number, production status, and welcome message.
            </div>
          )}
          {selectedGroup === 'session' && (
            <div className="mb-3 p-3 bg-[#F5F8FB] rounded-lg text-[11px] text-[#666] flex items-start gap-2">
              <span className="material-symbols-outlined text-[14px] text-[#2E5984] mt-0.5">info</span>
              Session & Security Parameters. Controls session timeout, auto sign-off delays, and RPC broker timeout. Subject to VHA security policy enforcement.
            </div>
          )}

          {(loading || pkgLoading) ? (
            <div className="space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="h-24 animate-pulse bg-[#E2E4E8] rounded-lg" />)}</div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-lg border border-[#D6E4F0] bg-[#F7FAFC] p-4 text-[12px] text-[#355070]">
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-[16px] text-[#2E5984] mt-0.5">rule_settings</span>
                  <div>
                    <div className="font-semibold text-[#1E3A8A]">Recommended parameter guidance</div>
                    <p className="mt-1">
                      This page now shows recommended ranges only where a defensible baseline exists. Historical conversion markers, site-identity fields, and setup-only dependencies are labeled separately so administrators know when a value should be left alone instead of tuned.
                    </p>
                    <p className="mt-2 text-[11px] text-[#52606D]">
                      {guidedParams.length > 0
                        ? `${guidedParams.length} field${guidedParams.length === 1 ? '' : 's'} in this section currently have explicit guidance.`
                        : 'No universal baseline exists for the currently visible fields, so this section is presented as informational rather than prescriptive.'}
                    </p>
                  </div>
                </div>
              </div>
              {params.some(p => p.name?.includes('Parameter #') && (p.name?.includes('unlabeled') || p.name?.includes('label unavailable'))) && (
                <div className="mb-3 p-3 bg-[#FFF3E0] rounded-lg text-[11px] text-[#E65100] flex items-start gap-2">
                  <span className="material-symbols-outlined text-[14px] mt-0.5">warning</span>
                  <span>Some parameter labels could not be loaded from VistA's data dictionary. This may indicate the ZVE DD FIELDS RPC needs registration. Contact your system administrator.</span>
                </div>
              )}
              {params.map(param => {
                if (param.type === 'section-header') {
                  return (
                    <div key={param.key} className="pt-4 pb-1 border-b border-[#E2E4E8]">
                      <h3 className="text-[11px] font-bold text-[#999] uppercase tracking-wider">{param.name}</h3>
                    </div>
                  );
                }
                const isEdited = param.key in editedValues;
                const displayValue = isEdited ? editedValues[param.key] : param.value;
                const rule = VHA_RULES[param.key];
                const isViolation = rule && isEdited && Number(displayValue) > rule.max;
                const guidance = getParameterGuidance(selectedGroup, param);
                const guidanceTone = guidance ? getGuidanceTone(guidance.kind) : null;

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
                    <p className="text-xs text-text-secondary mb-1">{param.description}</p>
                    {param.fieldNum && (
                      <p className="text-[10px] text-[#BBB] mt-0.5 mb-3">
                        VistA File #{param.vistaFile || '—'} • Field {param.fieldNum}
                      </p>
                    )}
                    {!param.fieldNum && <div className="mb-3" />}
                    {guidance && guidanceTone && (
                      <div className={`mb-3 rounded-md border px-3 py-2 ${guidanceTone.border}`}>
                        <div className="flex items-start gap-2">
                          <span className={`material-symbols-outlined text-[15px] mt-0.5 ${guidanceTone.iconColor}`}>{guidanceTone.icon}</span>
                          <div>
                            <div className={`text-[11px] font-semibold ${guidanceTone.titleColor}`}>
                              {guidance.title}: {guidance.summary}
                            </div>
                            <div className={`mt-1 text-[11px] ${guidanceTone.detailColor}`}>{guidance.detail}</div>
                          </div>
                        </div>
                      </div>
                    )}
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

          {/* Terminal Reference */}
          <details className="mt-8 mb-4 text-sm text-[#6B7280] border border-[#E2E4E8] rounded-md p-4 bg-[#FAFAFA]">
            <summary className="cursor-pointer font-medium text-[#374151]">📖 Terminal Reference</summary>
            <p className="mt-2">Each section replaces a package-specific parameter editor from the terminal.</p>
            <p className="mt-1">Terminal path varies: <strong>Pharmacy Manager → Site Parameters</strong>, <strong>Lab Manager → Site Parameters</strong>, etc.</p>
            <p className="mt-1">VistA stores these in separate parameter files per package.</p>
            <p className="mt-1">The terminal's ScreenMan form shows ALL fields with data dictionary labels. We aim to match that coverage.</p>
          </details>
        </div>

        <div className="w-[300px] border-l border-border overflow-auto p-4 flex-shrink-0 bg-surface-alt">
          <h3 className="text-sm font-bold text-text mb-4">Change Preview</h3>
          {!hasChanges ? (
            <p className="text-xs text-text-muted">No changes pending. Edit a parameter to see the impact preview.</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(editedValues).map(([key, newVal]) => {
                const param = params.find(p => p.key === key);
                const guidance = getParameterGuidance(selectedGroup, param);
                return (
                  <div key={key} className="bg-white border border-border rounded-lg p-3">
                    <div className="font-medium text-xs text-text mb-1">{param?.name || key}</div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-text-muted line-through">{param?.value}</span>
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      <span className="font-semibold text-warning">{newVal}</span>
                    </div>
                    {guidance && (
                      <div className="mt-2 text-[11px] text-[#52606D]">
                        <span className="font-semibold text-[#374151]">{guidance.title}:</span> {guidance.summary}
                      </div>
                    )}
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
