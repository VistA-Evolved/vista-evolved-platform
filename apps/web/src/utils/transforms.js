/**
 * VistA → Frontend data transforms
 *
 * Backend response shapes (verified against live VistA Docker):
 *
 *  GET /users           → { data: [{ ien, name }] }                         (list — minimal)
 *  GET /users/:duz      → { data: { id, ien, name, title, status, vistaGrounding: { ... } } }
 *  GET /esig-status     → { data: [{ id, name, duz, esigStatus, hasCode, sigBlockName }] }
 *  GET /users/:duz/keys → { data: [{ ien, name }] }
 *  GET /key-inventory   → { data: [{ keyName, vistaKey, description, holderCount, holders }] }
 *  GET /divisions       → { data: [{ ien, name, stationNumber, status }] }
 *  GET /params/kernel   → { rawLines: ["8989.3^1^fieldNum^internal^external", ...] }
 *  GET /error-trap      → { data: [{ ien, errorText, firstDateTime, mostRecentDateTime }] }
 *  GET /taskman/status  → { data: { status, lastRun } }
 *  GET /bulletins       → { data: [{ ien, ... }] }
 */

// ── FileMan date → JS Date ────────────────────────────
export function fmDateToDate(fmDate) {
  const s = String(fmDate || '').trim();
  if (!s || s.length < 7) return null;
  const [intPart, timePart = ''] = s.split('.');
  const year = 1700 + parseInt(intPart.slice(0, 3), 10);
  const month = parseInt(intPart.slice(3, 5), 10) - 1;
  const day = parseInt(intPart.slice(5, 7), 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  const hours = timePart.length >= 2 ? parseInt(timePart.slice(0, 2), 10) : 0;
  const mins  = timePart.length >= 4 ? parseInt(timePart.slice(2, 4), 10) : 0;
  const secs  = timePart.length >= 6 ? parseInt(timePart.slice(4, 6), 10) : 0;
  return new Date(year, month, day, hours, mins, secs);
}

export function fmDateToIso(fmDate) {
  const d = fmDateToDate(fmDate);
  return d ? d.toISOString() : '';
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// ── User list transform ────────────────────────────────
// Merges the minimal /users list with bulk /esig-status data
export function transformUserList(users, esigMap) {
  return (users || []).map(u => {
    const esig = esigMap.get(u.ien) || {};
    return {
      id: `S-${u.ien}`,
      duz: u.ien,
      name: (u.name || '').toUpperCase(),
      status: esig.status || 'active',
      esigStatus: esig.esigStatus || 'unknown',
      hasEsig: esig.hasCode || false,
      sigBlockName: esig.sigBlockName || '',
    };
  });
}

// ── User detail transform (from GET /users/:duz) ──────
export function transformUserDetail(raw) {
  if (!raw) return null;
  const vg = raw.vistaGrounding || {};
  const esig = vg.electronicSignature || {};
  return {
    id: `S-${raw.ien}`,
    duz: raw.ien,
    name: (raw.name || '').toUpperCase(),
    title: raw.title || vg.sigBlockTitle || '',
    status: raw.status || 'active',
    department: vg.serviceSection || '',
    phone: vg.officePhone || '',
    email: vg.email || '',
    npi: vg.npi || '',
    dea: vg.dea || '',
    providerType: vg.providerType || '',
    personClass: vg.personClass || '',
    initials: vg.initials || '',
    isProvider: Boolean(vg.npi || vg.providerType || vg.authMeds),
    esigStatus: esig.status || 'unknown',
    hasEsig: esig.hasCode || false,
    sigBlockName: esig.sigBlockName || '',
    ssn: vg.ssn ? `***-**-${vg.ssn.slice(-4)}` : '',
  };
}

// ── Permission / Security Key transform ────────────────
const KEY_MODULE_MAP = {
  'OR': 'Order Entry', 'ORES': 'Order Entry', 'ORELSE': 'Order Entry',
  'PS': 'Pharmacy', 'PSO': 'Pharmacy', 'PSJ': 'Pharmacy', 'PSB': 'Pharmacy',
  'LR': 'Laboratory', 'RA': 'Radiology', 'SD': 'Scheduling',
  'DG': 'Registration', 'XU': 'Kernel/System', 'XM': 'MailMan',
  'MAG': 'Imaging', 'TIU': 'Clinical Documents', 'GMRA': 'Allergy',
  'SR': 'Surgery', 'IB': 'Billing', 'SC': 'Primary Care',
  'DGCR': 'Billing', 'DGPF': 'Patient Flags', 'GMTS': 'Health Summary',
  'PROVIDER': 'Clinical', 'ZTMQ': 'System',
};

export function inferModule(keyName) {
  if (!keyName) return 'Unclassified';
  if (KEY_MODULE_MAP[keyName]) return KEY_MODULE_MAP[keyName];
  const prefix = String(keyName).split(/[\s_]/)[0];
  return KEY_MODULE_MAP[prefix] || 'Unclassified';
}

export function humanizeKeyName(keyName) {
  if (!keyName) return '';
  return String(keyName)
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bXu\b/gi, 'Kernel')
    .replace(/\bOr\b/gi, 'Order Entry')
    .replace(/\bPs[ojb]?\b/gi, m => ({ ps: 'Pharmacy', pso: 'Outpatient Rx', psj: 'Inpatient Rx', psb: 'BCMA' }[m.toLowerCase()] || m))
    .replace(/\bLr\b/gi, 'Lab')
    .replace(/\bSd\b/gi, 'Scheduling')
    .replace(/\bDg\b/gi, 'Registration')
    .replace(/\bTiu\b/gi, 'Clinical Docs');
}

export function transformPermission(raw) {
  if (!raw) return null;
  const descriptiveName = raw.descriptiveName || raw.description || '';
  const packageName = raw.packageName || '';
  return {
    id: raw.vistaGrounding?.file19_1Ien || raw.keyName,
    name: raw.keyName,
    displayName: descriptiveName || humanizeKeyName(raw.keyName),
    vistaKey: raw.vistaKey || raw.keyName,
    description: raw.description || '',
    module: packageName || inferModule(raw.keyName),
    packageName,
    holderCount: raw.holderCount || 0,
    holders: raw.holders || [],
  };
}

// ── Division → Site transform ──────────────────────────
export function transformSite(raw) {
  if (!raw) return null;
  return {
    id: raw.ien,
    name: raw.name,
    siteCode: raw.stationNumber,
    status: raw.status || 'active',
  };
}

// ── Kernel params raw lines → key-value map ────────────
// DDR format: "8989.3^1^fieldNum^internalValue^externalValue"
const KERNEL_FIELD_MAP = {
  '.01': { key: 'domainName', label: 'Domain Name' },
  '.02': { key: 'primaryHfsDir', label: 'Primary HFS Directory' },
  '205': { key: 'disableNewUser', label: 'Disable New User Creation' },
  '210': { key: 'autoSignOffDelay', label: 'Auto Sign-Off Delay (seconds)' },
  '214': { key: 'rpcTimeout', label: 'Response Timeout (seconds)' },
  '217': { key: 'siteNumber', label: 'Site Number / Name' },
  '230': { key: 'sessionTimeout', label: 'Session Timeout (seconds)' },
  '240': { key: 'welcomeMessage', label: 'Welcome Message' },
  '501': { key: 'prodAccount', label: 'Production Account' },
};

export function parseKernelParams(rawLines) {
  const params = {};
  let wpKey = null;
  const wpLines = [];

  for (const line of (rawLines || [])) {
    if (line === '[Data]' || line === '$$END$$') {
      if (wpKey) { params[wpKey].value = wpLines.join('\n'); wpKey = null; wpLines.length = 0; }
      continue;
    }
    if (wpKey) {
      if (line.startsWith('8989.3^')) {
        params[wpKey].value = wpLines.join('\n');
        wpKey = null; wpLines.length = 0;
      } else {
        wpLines.push(line);
        continue;
      }
    }
    const parts = line.split('^');
    if (parts.length >= 4) {
      const fieldNum = parts[2];
      const internal = parts[3];
      const external = parts[4] || internal;
      const meta = KERNEL_FIELD_MAP[fieldNum];
      if (internal === '[WORD PROCESSING]') {
        wpKey = meta?.key || `field_${fieldNum}`;
        params[wpKey] = { fieldNum, label: meta?.label || `Field ${fieldNum}`, value: '', external: '' };
      } else {
        const key = meta?.key || `field_${fieldNum}`;
        params[key] = { fieldNum, label: meta?.label || `Field ${fieldNum}`, value: internal, external };
      }
    }
  }
  if (wpKey) params[wpKey].value = wpLines.join('\n');
  return params;
}

// ── Error trap transform ───────────────────────────────
export function transformErrorTrap(raw) {
  if (!raw) return null;
  return {
    id: raw.ien,
    error: raw.errorText || '',
    firstOccurrence: fmDateToIso(raw.firstDateTime),
    lastOccurrence: fmDateToIso(raw.mostRecentDateTime),
    routine: raw.routineName || ((raw.errorText || '').match(/^(\S+~\S+)/)?.[1] || ''),
  };
}
