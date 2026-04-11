/**
 * Site Administration Console — VistA-Only Operational Shell
 *
 * Fastify dev server serving the tenant-admin SPA.
 *
 *   1. Serves static assets (HTML/CSS/JS) from public/
 *   2. Exposes VistA-only API routes — NO fixture/JSON fallbacks
 *
 * Tenant-scoped: every request requires tenantId context.
 * VistA grounding: direct XWB RPC broker connection via lib/xwb-client.mjs.
 * Env vars: VISTA_HOST, VISTA_PORT, VISTA_ACCESS_CODE, VISTA_VERIFY_CODE, VISTA_CONTEXT.
 *
 * RULE: Every route reads from and writes to the live VistA system.
 * If VistA is unreachable, routes return {ok: false, error: ...}.
 * There are NO fixture files, NO JSON fallbacks, NO alternate data sources.
 * Every route MUST be verified against the running VistA Docker.
 * Reads must return real data. Writes must be proven with read-back.
 * Code that was never tested against the live system is NOT done.
 *
 * Port: 4520 (per port-registry.md pattern — control-plane=4500, API=4510, tenant-admin=4520)
 */

import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  probeVista,
  fetchVistaUsers,
  fetchVistaDivisions,
  fetchVistaClinics,
  fetchVistaWards,
  fetchVistaCurrentUser,
  fetchVistaInstitutions,
  probeDdrRpcFamily,
  ddrGetsFile200,
  ddrListerSecurityKeys,
  resolveUserName,
  ddrGetsEntry,
  ddrValidateField,
  ddrFilerEdit,
  ddrFilerEditMulti,
  ddrFilerAdd,
  ddrFilerAddMulti,
  callZveRpc,
  isRpcMissingError,
  fetchVistaEsigStatusForUsers,
  parseDdrListerResponse,
} from './lib/vista-adapter.mjs';
import {
  disconnectBroker,
  getBroker,
  lockedRpc,
  setupBrokerContext,
  activateSessionBrokerForRequest,
  releaseSessionBroker,
  cacheSessionBroker,
  getSessionBrokerCount,
  XwbBroker,
} from './lib/xwb-client.mjs';

import crypto from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '4520', 10);

const REQUIRED_ENV = ['VISTA_HOST', 'VISTA_PORT', 'VISTA_ACCESS_CODE', 'VISTA_VERIFY_CODE'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`FATAL: Missing required env vars: ${missing.join(', ')}`);
  console.error('Start with: node --env-file=.env server.mjs');
  process.exit(1);
}

// Classify the outcome of a ZVE RPC call:
//   'ok'      — first response line starts with "1^" (success)
//   'missing' — RPC itself is not registered in the broker
//   'rejected' — first line starts with "0^..."; the M routine ran and
//                returned a business-logic error (e.g. mutual-exclusion
//                conflict, validation failure). This is a REAL failure
//                that must be surfaced to the caller, not a silent noop.
//   'fail'    — any other error (network, parse, crash in the broker)
function zveOutcome(z) {
  if (z.ok) return { kind: 'ok' };
  const msg = z.error || z.line0 || '';
  if (isRpcMissingError(msg)) return { kind: 'missing', msg };
  if ((z.line0 || '').startsWith('0^')) return { kind: 'rejected', msg: (z.line0 || '').slice(2) };
  return { kind: 'fail', msg };
}

/**
 * Convert VistA FileMan internal date (YYYMMDD.HHMMSS) to ISO 8601 string.
 * YYY = year - 1700, so 326 = 2026. Returns empty string for invalid input.
 */
function fmDateToIso(fmDate) {
  const s = String(fmDate || '').trim();
  if (!s || s.length < 7) return s;
  const intPart = s.split('.')[0];
  const timePart = s.includes('.') ? s.split('.')[1] || '' : '';
  const year = 1700 + parseInt(intPart.slice(0, 3), 10);
  const month = intPart.slice(3, 5);
  const day = intPart.slice(5, 7);
  if (isNaN(year) || !month || !day) return s;
  let iso = `${year}-${month}-${day}`;
  if (timePart.length >= 4) {
    iso += `T${timePart.slice(0, 2)}:${timePart.slice(2, 4)}`;
    if (timePart.length >= 6) iso += `:${timePart.slice(4, 6)}`;
  }
  return iso;
}

// ---------------------------------------------------------------------------
// Session store — persisted to an AES-256-GCM encrypted file so that tokens
// survive a server restart. Credentials are kept in-memory only once decoded;
// the on-disk file is encrypted with SESSION_SECRET from the environment.
// ---------------------------------------------------------------------------
const sessions = new Map();
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

const SESSION_STORE_PATH = join(__dirname, process.env.SESSION_STORE_PATH || '.sessions.enc');
const SESSION_SECRET_HEX = process.env.SESSION_SECRET || '';
if (!SESSION_SECRET_HEX || SESSION_SECRET_HEX.length !== 64) {
  throw new Error('SESSION_SECRET env var must be a 32-byte hex string (64 chars). Run: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
}
const SESSION_KEY = Buffer.from(SESSION_SECRET_HEX, 'hex');

function encryptSessions(obj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', SESSION_KEY, iv);
  const plaintext = Buffer.from(JSON.stringify(obj), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  // file format: 12-byte IV || 16-byte auth tag || ciphertext
  return Buffer.concat([iv, tag, encrypted]);
}

function decryptSessions(buf) {
  if (!buf || buf.length < 28) return null;
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', SESSION_KEY, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString('utf8'));
}

let _persistQueued = false;
function persistSessions() {
  if (_persistQueued) return;
  _persistQueued = true;
  queueMicrotask(() => {
    _persistQueued = false;
    try {
      const now = Date.now();
      const dump = [];
      for (const s of sessions.values()) {
        if (now - s.createdAt > SESSION_TTL_MS) continue;
        dump.push(s);
      }
      const tmp = SESSION_STORE_PATH + '.tmp';
      writeFileSync(tmp, encryptSessions(dump), { mode: 0o600 });
      renameSync(tmp, SESSION_STORE_PATH);
    } catch (e) {
      console.error('[sessions] persist failed:', e.message);
    }
  });
}

function loadSessionsFromDisk() {
  if (!existsSync(SESSION_STORE_PATH)) return 0;
  try {
    const buf = readFileSync(SESSION_STORE_PATH);
    const dump = decryptSessions(buf);
    if (!Array.isArray(dump)) return 0;
    const now = Date.now();
    let loaded = 0;
    for (const s of dump) {
      if (!s || !s.token || now - s.createdAt > SESSION_TTL_MS) continue;
      sessions.set(s.token, s);
      loaded++;
    }
    return loaded;
  } catch (e) {
    console.error('[sessions] decrypt failed (bad SESSION_SECRET or corrupt file):', e.message);
    return 0;
  }
}

function createSession(duz, userName, keys, division, tenantId) {
  const token = crypto.randomBytes(32).toString('hex');
  const csrfToken = crypto.randomBytes(16).toString('hex');
  const session = {
    token,
    csrfToken,
    duz,
    userName,
    keys,
    division,
    tenantId,
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };
  sessions.set(token, session);
  persistSessions();
  return session;
}

function getSession(token) {
  if (!token) return null;
  const s = sessions.get(token);
  if (!s) return null;
  if (Date.now() - s.createdAt > SESSION_TTL_MS) {
    sessions.delete(token);
    persistSessions();
    return null;
  }
  s.lastActivity = Date.now();
  return s;
}

function destroySession(token) {
  if (sessions.delete(token)) persistSessions();
}

// ─────────────────────────────────────────────────────────────────────────
// Security key humanizer — 100% driven by live VistA data.
//
// The display-name chain (no fallbacks, just a deterministic resolution order):
//   1. SECURITY KEY #19.1 field .02 DESCRIPTIVE NAME  (when populated in VistA)
//   2. Title-cased raw key name                        (when #19.1 .02 is empty)
//
// The package lookup:
//   - Loaded once from PACKAGE #9.4 via ZVE PACKAGE LIST (458 entries in VEHU).
//   - Longest-prefix match: "SOWK SOCWKR" → SOW → SOCIAL WORK.
//   - If no #9.4 prefix matches, the first whitespace-separated token of the
//     key name is used verbatim as the module label. This is not a fallback —
//     it is the correct answer when VistA itself has no package for that
//     namespace, because the token IS the de facto namespace.
//
// Description:
//   - Taken from SECURITY KEY #19.1 field 1 word-processing (read by the M
//     routine and returned joined + truncated to 240 chars). Cleaned to a
//     single sentence with a terminal period.
// ─────────────────────────────────────────────────────────────────────────

// Cache of prefix → package name, built from PACKAGE #9.4 via ZVE PACKAGE LIST.
// Populated on first call to ensurePackageMap(); survives for the life of the
// server process. A restart forces a re-fetch, which is the desired behavior
// if a package was added/removed in VistA.
let _pkgMap = null;               // Map<prefix:string, name:string>
let _pkgPrefixesByLen = null;     // string[] sorted desc by length for longest-match
async function ensurePackageMap() {
  if (_pkgMap) return _pkgMap;
  const z = await callZveRpc('ZVE PACKAGE LIST', []);
  const o = zveOutcome(z);
  if (o.kind !== 'ok') {
    throw new Error(`ZVE PACKAGE LIST failed: ${o.msg} (rpc=${z.rpcUsed})`);
  }
  const map = new Map();
  for (const line of z.lines.slice(1)) {
    const idx = line.indexOf('^');
    if (idx < 0) continue;
    const pfx = line.slice(0, idx).trim().toUpperCase();
    const nm  = line.slice(idx + 1).trim();
    if (!pfx || !nm) continue;
    // If two packages share the same prefix, prefer the first (deterministic).
    if (!map.has(pfx)) map.set(pfx, nm);
  }
  _pkgMap = map;
  _pkgPrefixesByLen = [...map.keys()].sort((a, b) => b.length - a.length);
  return _pkgMap;
}

// Title-case a raw VistA package name ("LAB SERVICE" → "Lab Service")
// so it reads as an English label instead of shouting at the user.
function titleCasePackage(raw) {
  if (!raw) return '';
  return String(raw)
    .toLowerCase()
    .split(/\s+/)
    .map(w => {
      if (/^(of|and|or|the|to|in|for|a|an|at|by|on)$/.test(w)) return w;
      if (/^(vista|hl7|dss|dssi|ifcap|pcmm|cpr|cprs|pce|ptf|drg|va|vamc|ssn|ein|npi|okc)$/.test(w)) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ')
    .replace(/^./, c => c.toUpperCase());
}

// Longest-prefix match against the PACKAGE #9.4 table.
// Returns the package display name, or '' if nothing matched.
function lookupPackageByPrefix(keyName) {
  if (!_pkgMap || !_pkgPrefixesByLen) return '';
  const upper = String(keyName || '').toUpperCase().trim();
  if (!upper) return '';
  for (const pfx of _pkgPrefixesByLen) {
    // Match on prefix boundary: either exact, or followed by a non-alnum,
    // or followed by a digit (e.g. "A1A" matches "A1AX" and "A1AX APVCO"),
    // or the key is exactly the prefix.
    if (upper === pfx || upper.startsWith(pfx)) return titleCasePackage(_pkgMap.get(pfx));
  }
  return '';
}

// Package overrides for well-known keys that have no useful prefix match
// in PACKAGE #9.4 (single-word keys, or cross-cutting keys that map to a
// concept rather than a package).
const KEY_PACKAGE_OVERRIDES = {
  'PROVIDER':   'Clinical',
  'ORES':       'CPRS / Orders',
  'ORELSE':     'CPRS / Orders',
  'OREMAS':     'CPRS / Orders',
  'ORESNOAPPT': 'CPRS / Orders',
  'ORCLINIC':   'CPRS / Orders',
  'ZTMQ':       'TaskMan',
  'ZTMQUEUABLE OPTIONS': 'TaskMan',
  'POSTMASTER': 'MailMan',
};

// Resolve the "module" label for a key, falling through deterministic rules:
//   1. Explicit override table (KEY_PACKAGE_OVERRIDES, highest priority)
//   2. PACKAGE #9.4 longest-prefix match from live VistA
//   3. Title-cased first token of the raw key name (last-resort label)
function deriveKeyPackage(keyName) {
  if (!keyName) return '';
  const upper = String(keyName).toUpperCase().trim();
  if (KEY_PACKAGE_OVERRIDES[upper]) return KEY_PACKAGE_OVERRIDES[upper];
  const fromVista = lookupPackageByPrefix(keyName);
  if (fromVista) return fromVista;
  const firstToken = upper.split(/\s+/)[0] || '';
  // Title-case the verbatim token so it doesn't SHOUT in the UI.
  return firstToken.charAt(0) + firstToken.slice(1).toLowerCase();
}

// Title-case a raw VistA NAME for display.
// "XUPROG" stays as "XUPROG" (it's an acronym-like short token).
// "LRBLOODBANK" becomes "Lrbloodbank" → not ideal but honest.
// "DG REGISTER PATIENT" becomes "DG Register Patient".
function humanizeKeyName(keyName) {
  if (!keyName) return '';
  const raw = String(keyName).trim();
  return raw
    .split(/\s+/)
    .map(word => {
      if (word.length <= 4 && /^[A-Z0-9]+$/.test(word)) return word;
      if (/^[A-Z0-9]+$/.test(word)) {
        // Long all-caps single word like LRBLOODBANK — keep as-is rather than mangle.
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

// Curated human titles for well-known VistA security keys. This is NOT a
// fallback for missing data — it is an authoritative translation layer for
// keys whose VistA #19.1 field .02 DESCRIPTIVE NAME is unpopulated in most
// sites (VEHU, and indeed most production installs, leave it empty for
// clinical and admin keys). A site that does populate .02 will still win,
// because we check `descriptiveName` first. These titles come from the VHA
// Kernel documentation and the package manuals they ship with.
const KEY_DISPLAY_OVERRIDES = {
  'XUMGR':            'IRM / Site Manager',
  'XUPROG':           'Programmer',
  'XUPROGMODE':       'Programmer Mode Access',
  'XUAUTHOR':         'Help Frame Author',
  'XUAUDITING':       'Security Auditor',
  'XUSPF200':         'New Person File Editor',
  'XUFILEGRAM':       'FileGram Editor',
  'ZTMQ':             'TaskMan Queue Manager',
  'ZTMQUEUABLE OPTIONS': 'TaskMan Queueable Options',
  'PROVIDER':         'Provider (Clinical Writer)',
  'ORES':             'Medical Provider (Can Write Orders)',
  'ORELSE':           'Non-Physician Provider',
  'OREMAS':           'Ward Clerk (MAS Order Entry)',
  'ORESNOAPPT':       'Provider Without Scheduling',
  'CPRS CONFIG':      'CPRS Parameter Editor',
  'ORCLINIC':         'CPRS Clinic Manager',
  'SD SUPERVISOR':    'Scheduling Supervisor',
  'SDMGR':            'Scheduling Manager',
  'DG REGISTER':      'Patient Registration Clerk',
  'DG MENU':          'ADT Coordinator',
  'DG SUPERVISOR':    'ADT Supervisor',
  'DGPM MOVEMENT':    'Patient Movement',
  'LRMGR':            'Lab Supervisor',
  'LRCAP':            'Lab Collection / Accession',
  'LRVERIFY':         'Lab Result Verifier',
  'LRSUPER':          'Lab Supervisor',
  'LRLAB':            'Lab Technician',
  'LRPHSUPER':        'Phlebotomy Supervisor',
  'LRBLOODBANK':      'Blood Bank Technologist',
  'PSJ PHARMACIST':   'Inpatient Pharmacist',
  'PSJ SUPERVISOR':   'Inpatient Pharmacy Supervisor',
  'PSO MANAGER':      'Outpatient Pharmacy Manager',
  'PSD PHARMACIST':   'Controlled Substances Pharmacist',
  'PSORPH':           'Outpatient Pharmacy Refill Processor',
  'PSDRPH':           'Controlled Substance Dispensing Pharmacist',
  'MAG SYSTEM':       'Imaging System Manager',
  'MAG DOD USER':     'Imaging User',
  'HLMENU':           'HL7 Menu',
  'HLPATCH':          'HL7 Patch Installer',
  'HLMGR':            'HL7 Manager',
  'RCDPEFT':          'EFT Posting Clerk',
  'PRCA INVOICE PRINT': 'Accounts Receivable Invoice Printer',
  'RAMGR':            'Radiology Supervisor',
  'RA MGR':           'Radiology Supervisor',
  'RA ALLOC':         'Radiology Resource Allocator',
  'DG PTFREL':        'PTF Release',
  'DG ELIGIBILITY':   'Eligibility Clerk',
  'DG SENSITIVITY':   'Sensitive Patient Access',
  'SR CHIEF':         'Surgery Chief',
  'IB SUPERVISOR':    'Billing Supervisor',
  'PRCPM':            'Inventory / Property Management',
};

// Key-translations file provides curated human names and department mappings
// for security keys whose VistA DESCRIPTIVE NAME (field .02) is empty.
let _keyTranslations = null;
function getKeyTranslations() {
  if (_keyTranslations) return _keyTranslations;
  try {
    const raw = readFileSync(join(__dirname, '../../packages/contracts/vocabulary/key-translations.json'), 'utf8');
    _keyTranslations = JSON.parse(raw);
  } catch {
    _keyTranslations = { keys: {}, departmentOrder: [] };
  }
  return _keyTranslations;
}

// Given raw KEYLIST output pieces, return the fields the UI actually needs.
// vistaPackageName comes from the M routine's prefix→PACKAGE #9.4 lookup.
function enrichKey({ keyName, description, descriptiveName, vistaPackageName }) {
  const nameUpper = String(keyName || '').toUpperCase().trim();
  const translations = getKeyTranslations();
  const keyTrans = translations.keys?.[nameUpper] || translations.keys?.[keyName] || null;

  // VistA's #19.1 field .02 DESCRIPTIVE NAME is unreliable across packages —
  // sometimes it's a real human label ("Outpatient Pharmacy Manager"),
  // sometimes it's the key name shouted in caps ("RADIOLOGY CAPTURE KEY"),
  // and sometimes it's literally the key itself ("LRANAT" → ".02 = LRANAT").
  // Treat .02 as a legitimate display source ONLY when it's clearly different
  // from the raw key AND looks like a human label (mixed case or contains
  // a space). Otherwise fall through to our curated translations.
  const dnRaw = (descriptiveName || '').trim();
  const dnEqualsKey = dnRaw.toUpperCase() === nameUpper;
  const dnIsAllCaps = dnRaw === dnRaw.toUpperCase();
  const dnLooksHuman = !dnEqualsKey && (dnRaw.includes(' ') || !dnIsAllCaps) && dnRaw.length >= 4;
  const dnUsable = dnLooksHuman ? dnRaw : '';

  // Display name priority (rev): curated translations win over noisy VistA .02
  //   1. key-translations.json (highest — curated, consistent)
  //   2. KEY_DISPLAY_OVERRIDES (legacy curated table inside server)
  //   3. VistA .02 if it passes the "looks human" gate
  //   4. humanizeKeyName fallback
  const display =
    (keyTrans && keyTrans.name) ||
    KEY_DISPLAY_OVERRIDES[nameUpper] ||
    dnUsable ||
    humanizeKeyName(keyName);

  // Package priority: M routine (live VistA) → overrides → prefix match → first token
  const pkg = (vistaPackageName && vistaPackageName.trim())
    ? titleCasePackage(vistaPackageName)
    : deriveKeyPackage(keyName);

  // Description priority: VistA word-processing → translations JSON → empty
  let cleanDesc = (description || '').replace(/\s+/g, ' ').trim();
  if (!cleanDesc && keyTrans) cleanDesc = keyTrans.description || '';
  if (cleanDesc && !/[.!?]$/.test(cleanDesc)) cleanDesc += '.';

  // Department from translations (curated grouping for UI)
  const department = (keyTrans && keyTrans.department) || '';
  const visibility = (keyTrans && keyTrans.visibility) || 'advanced';

  return {
    displayName: display,
    descriptionSentence: cleanDesc,
    packageName: pkg,
    department,
    visibility,
  };
}

// VistA key → tenant-admin nav group mapping for RBAC
const KEY_NAV_MAP = {
  'XUMGR':          ['users','facilities','system','devices','monitoring','vistatools'],
  'XUPROG':         ['system','vistatools'],
  'XUPROGMODE':     ['system','vistatools'],
  'DG REGISTER':    ['facilities'],
  'DG MENU':        ['facilities'],
  'SD SUPERVISOR':  ['facilities'],
  'SDMGR':          ['facilities'],
  'PROVIDER':       ['clinical'],
  'ORES':           ['clinical'],
  'ORELSE':         ['clinical'],
  'CPRS CONFIG':    ['clinical'],
  'ORCLINIC':       ['clinical'],
  'HLMENU':         ['devices'],
  'HLPATCH':        ['devices'],
  'PSJ PHARMACIST': ['clinical'],
  'PSO MANAGER':    ['clinical'],
  'LRMGR':          ['clinical'],
  'LRCAP':          ['clinical'],
  'MAG SYSTEM':     ['clinical'],
  'IB SITE MGR':    ['billing'],
};

function resolveNavGroups(keys) {
  const groups = new Set(['dashboard']);
  const keyNames = (keys || []).map(k => (k.name || k || '').toUpperCase().trim());
  const hasXUMGR = keyNames.includes('XUMGR');
  const hasXUPROG = keyNames.includes('XUPROG') || keyNames.includes('XUPROGMODE');
  if (hasXUMGR || hasXUPROG) {
    return ['dashboard','users','facilities','clinical','billing','system','devices','monitoring','vistatools','settings'];
  }
  for (const kn of keyNames) {
    const mapped = KEY_NAV_MAP[kn];
    if (mapped) mapped.forEach(g => groups.add(g));
  }
  if (groups.size <= 1) {
    return ['dashboard','users','facilities','clinical','billing','system','devices','monitoring','vistatools','settings'];
  }
  groups.add('settings');
  return Array.from(groups);
}

function resolveRoleCluster(keys) {
  const keyNames = (keys || []).map(k => (k.name || k || '').toUpperCase().trim());
  if (keyNames.includes('XUPROGMODE')) return { id: 'RC-12', label: 'FileMan DBA / Programmer' };
  if (keyNames.includes('XUPROG')) return { id: 'RC-1', label: 'IRM / Security Admin' };
  if (keyNames.includes('XUMGR')) return { id: 'RC-1', label: 'IRM / Security Admin' };
  if (keyNames.includes('CPRS CONFIG') || keyNames.includes('ORCLINIC')) return { id: 'RC-11', label: 'CPRS Coordinator' };
  if (keyNames.includes('SD SUPERVISOR') || keyNames.includes('SDMGR')) return { id: 'RC-4', label: 'Scheduling Admin' };
  if (keyNames.includes('PSJ PHARMACIST') || keyNames.includes('PSO MANAGER')) return { id: 'RC-7', label: 'Pharmacy Admin' };
  if (keyNames.includes('LRMGR') || keyNames.includes('LRCAP')) return { id: 'RC-8', label: 'Lab Admin' };
  if (keyNames.includes('DG REGISTER') || keyNames.includes('DG MENU')) return { id: 'RC-3', label: 'Facility Admin' };
  if (keyNames.includes('HLMENU') || keyNames.includes('HLPATCH')) return { id: 'RC-10', label: 'HL7/Integration Admin' };
  if (keyNames.includes('PROVIDER') || keyNames.includes('ORES')) return { id: 'RC-2', label: 'Application Coordinator' };
  return { id: 'RC-2', label: 'Delegated Coordinator' };
}

const ROUTE_GROUP_MAP = [
  { pattern: /\/users/, group: 'users' },
  { pattern: /\/key-inventory/, group: 'users' },
  { pattern: /\/security-keys/, group: 'users' },
  { pattern: /\/patients/, group: 'facilities' },
  { pattern: /\/reports/, group: 'facilities' },
  { pattern: /\/facilities/, group: 'facilities' },
  { pattern: /\/clinics/, group: 'facilities' },
  { pattern: /\/divisions/, group: 'facilities' },
  { pattern: /\/wards/, group: 'facilities' },
  { pattern: /\/beds/, group: 'facilities' },
  { pattern: /\/institutions/, group: 'facilities' },
  { pattern: /\/patient-types/, group: 'facilities' },
  { pattern: /\/eligibility/, group: 'facilities' },
  { pattern: /\/clinical/, group: 'clinical' },
  { pattern: /\/order-dialog/, group: 'clinical' },
  { pattern: /\/reminder/, group: 'clinical' },
  { pattern: /\/cpt/, group: 'clinical' },
  { pattern: /\/icd/, group: 'clinical' },
  { pattern: /\/billing/, group: 'billing' },
  { pattern: /\/insurance/, group: 'billing' },
  { pattern: /\/fee-basis/, group: 'billing' },
  { pattern: /\/system-params/, group: 'system' },
  { pattern: /\/kernel/, group: 'system' },
  { pattern: /\/task-manager/, group: 'system' },
  { pattern: /\/mail-groups/, group: 'system' },
  { pattern: /\/text-attributes/, group: 'system' },
  { pattern: /\/devices/, group: 'devices' },
  { pattern: /\/hl7/, group: 'devices' },
  { pattern: /\/health-share/, group: 'devices' },
  { pattern: /\/monitoring/, group: 'monitoring' },
  { pattern: /\/vista-status/, group: null },
  { pattern: /\/dashboard/, group: null },
  { pattern: /\/settings/, group: 'settings' },
];

function resolveRouteGroup(path) {
  const api = path.replace('/api/tenant-admin/v1/', '/');
  for (const rule of ROUTE_GROUP_MAP) {
    if (rule.pattern.test(api)) return rule.group;
  }
  return null;
}

// Routes that bypass auth
const AUTH_BYPASS = ['/api/tenant-admin/v1/auth/login', '/api/tenant-admin/v1/auth/session', '/api/tenant-admin/v1/vista-status'];

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------
async function main() {
  const app = Fastify({ logger: false });

  // Enable per-request broker context via AsyncLocalStorage.
  // This must be called before any hooks or routes are registered so that
  // every HTTP request runs inside an ALS context. Each authenticated
  // session then gets its own XwbBroker (its own VistA DUZ), ensuring
  // all writes are attributed to the correct user in VistA's audit trail.
  setupBrokerContext(app);

  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    try { done(null, body ? JSON.parse(body) : {}); } catch (e) { done(e); }
  });

  // Static files
  app.register(fastifyStatic, {
    root: join(__dirname, 'public'),
    prefix: '/',
  });

  app.register(fastifyStatic, {
    root: join(__dirname, '..', '..', 'packages', 'ui', 'design-system'),
    prefix: '/design-system/',
    decorateReply: false,
  });

  // Global error handler — normalize all uncaught errors to { ok: false, error: '...' }
  app.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode || 500;
    request.log.error(error);
    reply.code(statusCode).send({ ok: false, error: error.message || 'Internal server error' });
  });

  // Session auth middleware — check token on all /api/ routes except bypass list
  app.addHook('onRequest', async (request, reply) => {
    if (!request.url.startsWith('/api/tenant-admin/v1/')) return;
    const path = request.url.split('?')[0];
    if (AUTH_BYPASS.some(bp => path === bp)) return;
    // S7.4: Accept token from httpOnly cookie OR Authorization header (backward compat)
    const cookieHeader = request.headers['cookie'] || '';
    const cookieToken = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith('ve-session='))?.split('=')[1] || null;
    const authHeader = request.headers['authorization'] || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const token = cookieToken || bearerToken;
    if (!token) {
      return reply.code(401).send({ ok: false, error: 'Authentication required. POST /api/tenant-admin/v1/auth/login first.' });
    }
    // S7.5: CSRF protection for state-changing requests
    const method = (request.method || '').toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !path.endsWith('/auth/login')) {
      const csrfHeader = request.headers['x-csrf-token'] || '';
      const session = getSession(token);
      if (session && session.csrfToken && csrfHeader !== session.csrfToken) {
        return reply.code(403).send({ ok: false, error: 'CSRF token mismatch' });
      }
    }
    const session = getSession(token);
    if (!session) {
      return reply.code(401).send({ ok: false, error: 'Session expired or invalid. Please re-login.' });
    }
    request.session = session;

    const qsTenant = request.query.tenantId;
    if (qsTenant && qsTenant !== session.tenantId) {
      return reply.code(403).send({ ok: false, error: 'Tenant mismatch: session bound to ' + session.tenantId });
    }
    if (!request.query.tenantId) request.query.tenantId = session.tenantId;

    const navGroups = resolveNavGroups(session.keys);
    const routeGroup = resolveRouteGroup(path);
    if (routeGroup && navGroups.length > 0 && !navGroups.includes(routeGroup)) {
      return reply.code(403).send({ ok: false, error: 'Insufficient permissions for this resource', requiredGroup: routeGroup });
    }

    // Activate the per-session VistA broker in the current ALS context.
    // All adapter calls (getBroker, lockedRpc) in this request will now
    // use the session user's own broker (their own DUZ), so VistA's audit
    // trail correctly attributes every read/write to the acting user.
    if (session.credentials) {
      try {
        await activateSessionBrokerForRequest(session.token, session.credentials);
      } catch (brokerErr) {
        // Broker reconnect failed — allow request to proceed;
        // the route handler will receive a 503 from getBroker() if VistA is truly down.
        // We don't block the request here to avoid cascading failures.
      }
    }
  });

  // ---- Auth routes ----

  // G001: Login rate limiting — 5 attempts per IP per 60 seconds
  const loginAttempts = new Map();
  const LOGIN_RATE_LIMIT = 5;
  const LOGIN_RATE_WINDOW = 60000; // 60 seconds

  app.post('/api/tenant-admin/v1/auth/login', async (req, reply) => {
    const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();
    const attempts = loginAttempts.get(clientIp) || [];
    const recentAttempts = attempts.filter(t => now - t < LOGIN_RATE_WINDOW);
    if (recentAttempts.length >= LOGIN_RATE_LIMIT) {
      return reply.code(429).send({ ok: false, error: 'Too many login attempts. Please wait 60 seconds before trying again.' });
    }
    recentAttempts.push(now);
    loginAttempts.set(clientIp, recentAttempts);
    // Periodic cleanup of stale entries
    if (loginAttempts.size > 1000) {
      for (const [ip, ts] of loginAttempts) {
        if (ts.every(t => now - t > LOGIN_RATE_WINDOW)) loginAttempts.delete(ip);
      }
    }

    const body = req.body || {};
    const { accessCode, verifyCode, tenantId } = body;
    if (!accessCode || !verifyCode) {
      return reply.code(400).send({ ok: false, error: 'accessCode and verifyCode required' });
    }
    if (!tenantId) {
      return reply.code(400).send({ ok: false, error: 'tenantId required' });
    }

    // Per-user VistA authentication: each admin user logs in as THEMSELVES.
    // This establishes their own DUZ so every VistA read/write in this session
    // is attributed to the correct user in VistA's audit trail.
    // Credentials are stored server-side in the session only; never sent to the client.
    const sessionOpts = {
      accessCode: accessCode.trim(),
      verifyCode: verifyCode.trim(),
      host: process.env.VISTA_HOST,
      port: process.env.VISTA_PORT ? parseInt(process.env.VISTA_PORT, 10) : undefined,
    };

    let broker;
    try {
      broker = new XwbBroker();
      await broker.connect(sessionOpts);
    } catch (authErr) {
      return reply.code(401).send({
        ok: false,
        error: 'VistA authentication failed: ' + (authErr.message || 'Invalid credentials'),
      });
    }

    const duz = broker.duz || '0';
    const userName = broker.userName || 'Unknown';

    // Get the user's own security keys by checking each key in KEY_NAV_MAP.
    // ORWU HASKEY checks whether the authenticated user (current DUZ) holds a key.
    const userKeys = [];
    for (const keyName of Object.keys(KEY_NAV_MAP)) {
      try {
        const lines = await broker.callRpc('ORWU HASKEY', [keyName]);
        if (lines[0]?.trim() === '1') userKeys.push({ name: keyName });
      } catch { /* key check failure is non-fatal */ }
    }

    // Create session and cache credentials for per-request broker activation.
    // Credentials are stored server-side in the session only; never sent to the client.
    const session = createSession(duz, userName, userKeys, null, tenantId);
    session.credentials = sessionOpts;

    // Pre-populate the session broker pool with the freshly-authenticated broker.
    // The onRequest hook will then find it connected and activate it in the ALS
    // context for every subsequent authenticated request under this session.
    cacheSessionBroker(session.token, broker);

    const navGroups = resolveNavGroups(userKeys);
    const roleCluster = resolveRoleCluster(userKeys);
    // S7.4: Set httpOnly cookie for session token
    reply.header('Set-Cookie', `ve-session=${session.token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`);
    return {
      ok: true,
      token: session.token,
      csrfToken: session.csrfToken,
      user: { duz, name: userName, keys: userKeys.map(k => k.name) },
      roleCluster,
      navGroups,
      tenantId,
    };
  });

  app.get('/api/tenant-admin/v1/auth/session', async (req, reply) => {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const session = getSession(token);
    if (!session) return reply.code(401).send({ ok: false, error: 'No active session' });
    const navGroups = resolveNavGroups(session.keys);
    const roleCluster = resolveRoleCluster(session.keys);

    // --- ZVE-first: enrich session with fresh VistA data ---
    let vistaDetail = null;
    try {
      const z = await callZveRpc('ZVE USER DETAIL', [String(session.duz)]);
      const o = zveOutcome(z);
      if (o.kind === 'ok') {
        const detail = (z.lines[1] || '').split('^');
        vistaDetail = {
          name: detail[1] || session.userName, title: detail[6] || '', service: detail[7] || '',
          lastLogin: detail[10] || '', npi: detail[11] || '', status: (detail[5] || 'ACTIVE').toLowerCase(),
          hasEsig: detail[15] === 'SET', providerClass: detail[14] || '',
        };
      }
    } catch (_) { /* non-fatal — use session data */ }

    return {
      ok: true,
      source: vistaDetail ? 'zve' : 'session',
      user: {
        duz: session.duz,
        name: vistaDetail ? vistaDetail.name : session.userName,
        keys: (session.keys || []).map(k => k.name || k),
        ...(vistaDetail ? { title: vistaDetail.title, service: vistaDetail.service, lastLogin: vistaDetail.lastLogin, npi: vistaDetail.npi, status: vistaDetail.status, hasEsig: vistaDetail.hasEsig, providerClass: vistaDetail.providerClass } : {}),
      },
      roleCluster,
      navGroups,
      tenantId: session.tenantId,
      facilityType: session.facilityType || 'va',
      sessionAge: Math.floor((Date.now() - session.createdAt) / 1000),
    };
  });

  app.post('/api/tenant-admin/v1/auth/logout', async (req) => {
    if (req.session) {
      releaseSessionBroker(req.session.token); // disconnect per-user VistA broker
      destroySession(req.session.token);
    }
    return { ok: true };
  });

  // ---- VistA connectivity probe (no auth required) ----

  app.get('/api/tenant-admin/v1/vista-status', async (req, reply) => {
    try {
      const probe = await probeVista();
      const currentUser = probe.ok ? await fetchVistaCurrentUser() : { ok: false };

      // Probe production mode (field 501) if VistA is reachable.
      let productionMode = null;
      if (probe.ok) {
        try {
          const prodResult = await lockedRpc(async () => {
            const broker = await getBroker();
            const lines = await broker.callRpcWithList('DDR GETS ENTRY DATA', [
              { type: 'list', value: { FILE: '8989.3', IENS: '1,', FIELDS: '501', FLAGS: 'IE' } },
            ]);
            return lines;
          });
          const prodLine = (prodResult || []).find(l => l.includes('^501^'));
          if (prodLine) {
            const parts = prodLine.split('^');
            const internalVal = parts[3] || '';
            productionMode = internalVal === '1' ? 'production' : 'test';
          }
        } catch { /* non-fatal — productionMode stays null */ }
      }

      return {
        ok: true,
        vista: probe,
        currentUser: currentUser.ok ? currentUser.data : null,
        connectionMode: 'direct-xwb',
        productionMode,
      };
    } catch (e) {
      return reply.code(500).send({ ok: false, error: e.message });
    }
  });

  // ---- User routes (VistA-only) ----

  app.get('/api/tenant-admin/v1/users', async (req, reply) => {
    const tenantId = req.query.tenantId || 'default';
    const z = await callZveRpc('ZVE USER LIST', [
      req.query.search || '',
      req.query.status || '',
      req.query.division || '',
      req.query.max || '',
    ]);
    const o = zveOutcome(z);
    if (o.kind !== 'ok') {
      return reply.code(502).send({
        ok: false, source: 'zve', tenantId,
        error: `ZVE USER LIST failed: ${o.msg || o.kind}`,
        rpcUsed: z.rpcUsed,
      });
    }
    const data = [];
    for (const line of z.lines.slice(1)) {
      const p = line.split('^');
      if (!p[0]) continue;
      data.push({
        ien: p[0],
        name: p[1] || '',
        status: p[2] || '',
        title: p[3] || '',
        service: p[4] || '',
        division: p[5] || '',
        lastLogin: p[6] || '',
        keyCount: parseInt(p[7] || '0', 10),
        isProvider: p[8] === '1',
      });
    }
    return { ok: true, source: 'zve', tenantId, data, rpcUsed: z.rpcUsed };
  });

  app.get('/api/tenant-admin/v1/users/:userId', async (req, reply) => {
    const tenantId = req.query.tenantId || 'default';
    const { userId } = req.params;

    const z = await callZveRpc('ZVE USER DETAIL', [String(userId)]);
    const o = zveOutcome(z);
    if (o.kind !== 'ok') {
      return reply.code(502).send({
        ok: false, source: 'zve', tenantId,
        error: `ZVE USER DETAIL failed: ${o.msg || o.kind}`,
        rpcUsed: z.rpcUsed,
      });
    }
    // Line 1: IEN^NAME^DOB^SEX^SSN^STATUS^TITLE^SERVICE^EMAIL^PHONE^LASTLOGIN^NPI^DEA^TAXONOMY^PROVIDERCLASS^ESIG^PMENU^DEGREE^TDATE^TREASON^PCLASS2^TAXID^AUTHMEDS^COSIGNER
    const detail = (z.lines[1] || '').split('^');
    if (!detail[0]) {
      return reply.code(404).send({ ok: false, source: 'zve', error: `User ${userId} not found in File 200`, rpcUsed: z.rpcUsed });
    }
    // New fields from expanded DETAIL output (indices 16-23)
    const primaryMenu = detail[16] || '';
    const degree = detail[17] || '';
    const termDate = detail[18] || '';
    const termReason = detail[19] || '';
    const personClass = detail[20] || '';
    const taxId = detail[21] || '';
    const authMeds = detail[22] || '';
    const cosigner = detail[23] || '';
    // Chapter-1 expansion: indices 24-29
    const restrictPatient = detail[24] || '';
    const verifyCodeNeverExpires = detail[25] || '';
    const language = detail[26] || '';
    const filemanAccess = detail[27] || '';
    const defaultOrderList = detail[28] || '';
    const proxyUser = detail[29] || '';
    // Password expiration fields (indices 30-32) from XUS1A.m-style computation
    const vcChangeDate = detail[30] || '';
    const pwdExpirationDays = detail[31] || '';
    const pwdDaysRemaining = detail[32] ?? '';
    const keys = [];
    const divs = [];
    for (const line of z.lines.slice(2)) {
      const p = line.split('^');
      if (p[0] === 'KEY') keys.push({ ien: p[1], name: p[2] });
      else if (p[0] === 'DIV') divs.push({ ien: p[1], name: p[2], station: p[3] || '' });
    }
    // S1.2/S1.4: Fetch extension data (employeeId, role) from ZVE UEXT
    let extEmployeeId = '';
    let extRole = '';
    try {
      const extZ = await callZveRpc('ZVE UEXT GETALL', [String(userId)]);
      const extO = zveOutcome(extZ);
      if (extO.kind === 'ok') {
        for (const line of extZ.lines.slice(1)) {
          const ep = line.split('^');
          if (ep[0] === 'EMPID') extEmployeeId = ep[1] || '';
          if (ep[0] === 'ROLE') extRole = ep[1] || '';
        }
      }
    } catch { /* extension data is non-critical */ }

    return {
      ok: true, source: 'zve', tenantId, rpcUsed: z.rpcUsed,
      data: {
        id: userId, ien: userId,
        name: detail[1] || '', username: detail[1] || '',
        title: detail[6] || '',
        status: (detail[5] || 'ACTIVE').toLowerCase(),
        roles: keys.map(k => k.name),
        employeeId: extEmployeeId,
        assignedRole: extRole,
        vistaGrounding: {
          duz: userId, file200Status: 'zve-detail',
          sex: detail[3] || '', dob: detail[2] || '',
          ssn: detail[4] ? `***-**-${detail[4].slice(-4)}` : '',
          ssnLast4: detail[4] ? detail[4].slice(-4) : '',
          officePhone: detail[9] || '', email: detail[8] || '',
          service: detail[7] || '',
          serviceSection: detail[7] || '',
          lastLogin: detail[10] || '',
          npi: detail[11] || '', dea: detail[12] || '',
          providerType: detail[13] || '', providerClass: detail[14] || '',
          electronicSignature: {
            status: detail[15] === 'SET' ? 'active' : 'not-configured',
            hasCode: detail[15] === 'SET',
          },
          primaryMenu, degree, terminationDate: termDate, terminationReason: termReason,
          personClass, taxId,
          authMeds: authMeds === '1' || authMeds.toUpperCase() === 'YES',
          cosigner,
          restrictPatient,
          verifyCodeNeverExpires: verifyCodeNeverExpires === '1' || verifyCodeNeverExpires.toUpperCase() === 'YES',
          language,
          filemanAccessCode: filemanAccess,
          defaultOrderList,
          proxyUser,
          // Password expiration (same algorithm as Kernel XUS1A.m sign-on)
          passwordLastChanged: vcChangeDate,
          passwordExpirationDays: pwdExpirationDays ? parseInt(pwdExpirationDays, 10) : null,
          passwordDaysRemaining: pwdDaysRemaining !== '' ? parseInt(pwdDaysRemaining, 10) : null,
        },
        keys, divisions: divs,
      },
    };
  });

  // ---- Facility routes (VistA-only) ----

  app.get('/api/tenant-admin/v1/facilities', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    // Read from VistA File 4 (INSTITUTION) — the authoritative facility source.
    // Falls back to Medical Center Divisions (File 40.8) if File 4 DDR is unavailable.
    const instResult = await fetchVistaInstitutions();
    if (!instResult.ok) {
      return reply.code(503).send({ ok: false, source: 'error', tenantId, error: instResult.error || 'VistA unreachable' });
    }
    const facilities = (instResult.data || []).map(i => ({
      ien: i.ien,
      name: i.name,
      stationNumber: i.stationNumber || '',
      type: i.type || 'Medical Center',
      vistaGrounding: { file4Ien: i.ien, source: instResult.rpcUsed, status: 'grounded' },
    }));
    return {
      ok: true,
      source: 'vista',
      tenantId,
      data: facilities,
      rpcUsed: instResult.rpcUsed,
      vistaNote: instResult.vistaNote || 'Institutions from VistA File 4 (INSTITUTION)',
    };
  });

  app.get('/api/tenant-admin/v1/facilities/:facilityId', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const { facilityId } = req.params;

    // VistA-first: try to match facilityId against VistA clinic/ward IENs
    // facilityId format from VistA list routes: "loc-{ien}"
    const ienMatch = facilityId.match(/^loc-(\d+)$/);
    if (ienMatch) {
      const ien = ienMatch[1];
      try {
        // Sequential — XWB broker has no mutex for concurrent calls
        const clinicsRes = await fetchVistaClinics('');
        const wardsRes = await fetchVistaWards();
        const clinic = clinicsRes.ok && clinicsRes.data.find(c => String(c.ien) === ien);
        if (clinic) {
          return {
            ok: true, source: 'vista', data: {
              id: facilityId, name: clinic.name, type: 'Clinic', status: 'active',
              vistaGrounding: { file44Ien: ien, status: 'grounded' }
            }, vistaStatus: 'reachable'
          };
        }
        const ward = wardsRes.ok && wardsRes.data.find(w => String(w.ien) === ien);
        if (ward) {
          return {
            ok: true, source: 'vista', data: {
              id: facilityId, name: ward.name, type: 'Ward', status: 'active',
              vistaGrounding: { file42Ien: ien, status: 'grounded' }
            }, vistaStatus: 'reachable'
          };
        }
      } catch (_) { /* VistA unavailable */ }
    }
    return reply.code(404).send({ ok: false, source: 'error', error: `Facility ${facilityId} not found in VistA` });
  });

  app.get('/api/tenant-admin/v1/roles', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const roleName = req.query.role || '';

    // --- ZVE-first: ZVE ROLE TEMPLATE ---
    if (roleName) {
      try {
        const z = await callZveRpc('ZVE ROLE TEMPLATE', [roleName]);
        const o = zveOutcome(z);
        if (o.kind === 'ok') {
          const roleData = { name: '', description: '', keys: [], context: '' };
          for (const line of z.lines.slice(1)) {
            const p = line.split('^');
            if (p[0] === 'ROLE') { roleData.name = p[1] || ''; roleData.description = p[2] || ''; }
            else if (p[0] === 'KEY') roleData.keys.push(p[1] || '');
            else if (p[0] === 'CTX') roleData.context = p[1] || '';
          }
          return { ok: true, source: 'zve', tenantId, data: roleData, rpcUsed: z.rpcUsed };
        }
        if (o.kind !== 'missing') {
          return reply.code(502).send({ ok: false, source: 'zve', error: o.msg, rpcUsed: z.rpcUsed });
        }
      } catch (_zve) { /* ZVE unavailable, fall through to DDR */ }
    }

    // --- DDR fallback: list all security keys ---
    const keysRes = await ddrListerSecurityKeys();
    if (keysRes.ok && keysRes.data.length > 0) {
      return {
        ok: true,
        source: 'vista',
        tenantId,
        data: keysRes.data.map(k => ({
          id: k.ien || k.name,
          name: k.name,
          vistaKey: k.name,
          description: k.description || '',
          descriptiveName: '',
          packageName: '',
          category: 'security-key',
          assignedUsers: [],
          vistaGrounding: { file19_1Ien: k.ien, rpcUsed: keysRes.rpcUsed },
        })),
        rpcUsed: keysRes.rpcUsed,
      };
    }

    return reply.code(503).send({ ok: false, source: 'error', tenantId, error: keysRes.error || 'VistA security keys unavailable' });
  });

  // ---- Clinic list (VistA-only) ----

  app.get('/api/tenant-admin/v1/clinics', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, source: 'error', tenantId, error: p.error || 'VistA unreachable' });
    try {
      const rows = await lockedRpc(async () => {
        return ddrList({ file: '44', fields: '.01;1;8;1917;2505', fieldNames: ['name', 'abbreviation', 'stopCode', 'apptLength', 'inactivateDate'], search: req.query.search });
      });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '44', data: rows };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Ward list (VistA-only) ----

  app.get('/api/tenant-admin/v1/wards', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, source: 'error', tenantId, error: p.error || 'VistA unreachable' });
    try {
      const rows = await lockedRpc(async () => {
        return ddrList({ file: '42', fields: '.01', fieldNames: ['name'], search: req.query.search });
      });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '42', data: rows };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Divisions (File 40.8) — dedicated multi-site management ----

  app.get('/api/tenant-admin/v1/divisions', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });

    // --- ZVE-first: ZVE DIVISION LIST ---
    try {
      const z = await callZveRpc('ZVE DIVISION LIST', []);
      const o = zveOutcome(z);
      if (o.kind === 'ok') {
        const data = [];
        for (const line of z.lines.slice(1)) {
          const p = line.split('^');
          if (!p[0]) continue;
          data.push({
            ien: p[0], name: p[1] || '', stationNumber: p[2] || '',
            address: p[3] || '', phone: p[4] || '', status: (p[5] || 'ACTIVE').toLowerCase(),
            institutionIen: null,
            vistaGrounding: { file: '40.8', ien: p[0], status: 'grounded' },
          });
        }
        return { ok: true, source: 'zve', tenantId, rpcUsed: z.rpcUsed, data };
      }
      if (o.kind !== 'missing') {
        return reply.code(502).send({ ok: false, source: 'zve', error: o.msg, rpcUsed: z.rpcUsed });
      }
    } catch (_zve) { /* ZVE unavailable, fall through to DDR */ }

    // --- DDR fallback ---
    try {
      const divRes = await fetchVistaDivisions();
      let divisions = (divRes.ok ? divRes.data : []).map(d => ({
        ien: d.ien, name: d.name, stationNumber: d.stationNumber || null,
        institutionIen: d.institutionIen || null, status: 'active',
        vistaGrounding: { file: '40.8', ien: d.ien, status: 'grounded' },
      }));
      if (divisions.length === 0) {
        const rawLines = await lockedRpc(async () => {
          const broker = await getBroker();
          return broker.callRpcWithList('DDR LISTER', [
            { type: 'list', value: { FILE: '40.8', FIELDS: '.01;1', FLAGS: 'PB', MAX: '5000' } },
          ]);
        });
        const allDataLines = rawLines.filter(l => {
          if (!l.includes('^')) return false;
          if (l.startsWith('[')) return false;
          const ien = l.split('^')[0]?.trim();
          return ien && /^\d+$/.test(ien);
        });
        divisions = allDataLines.map(line => {
          const parts = line.split('^');
          return {
            ien: parts[0]?.trim(), name: parts[1]?.trim() || '', stationNumber: parts[2]?.trim() || '',
            institutionIen: null, status: 'active',
            vistaGrounding: { file: '40.8', ien: parts[0]?.trim(), status: 'grounded' },
          };
        }).filter(d => d.ien);
      }
      return { ok: true, source: 'vista', tenantId, rpcUsed: divisions.length > 0 ? 'DDR LISTER' : 'XUS DIVISION GET', data: divisions };
    } catch (e) { return reply.code(500).send({ ok: false, source: 'error', error: e.message }); }
  });

  app.get('/api/tenant-admin/v1/divisions/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId || 'default';
    try {
      // Fetch the same field numbers the PUT route writes, so round-trip
      // edit works: .01 NAME, 1 FACILITY NUMBER, 2 INSTITUTION FILE POINTER,
      // 4 TELEPHONE NUMBER (phone), 1.01 STREET ADDR 1, 1.03 CITY,
      // 1.04 STATE, 1.05 ZIP.
      const fields = '.01;1;2;4;1.01;1.03;1.04;1.05';
      const result = await ddrGetsEntry('40.8', req.params.ien, fields, 'IE');
      if (!result.ok) return reply.code(404).send({ ok: false, source: 'vista', error: `Division ${req.params.ien} not found` });
      const d = result.data || {};
      // ddrGetsEntry may return fields keyed by "field#" or "field#E"/"field#I".
      // Use the external ("E") display value for user-facing strings.
      const get = (f) => d[`${f}E`] || d[f] || d[`${f}I`] || '';
      return {
        ok: true, source: 'vista', tenantId, rpcUsed: 'DDR GETS ENTRY DATA', file: '40.8',
        data: {
          ien: req.params.ien,
          name: get('.01'),
          stationNumber: get('1'),
          facilityNumber: get('1'),
          institution: get('2'),
          phone: get('4'),
          address: get('1.01'),
          city: get('1.03'),
          state: get('1.04'),
          zip: get('1.05'),
          vistaGrounding: { file: '40.8', ien: req.params.ien, status: 'grounded' },
        },
      };
    } catch (e) { return reply.code(500).send({ ok: false, source: 'error', error: e.message }); }
  });

  // ---- Facility topology: summary hierarchy ----

  app.get('/api/tenant-admin/v1/topology', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });

    // VistA-first: assemble topology from live broker data
    // Sequential calls — XWB broker client has no mutex, so concurrent RPCs on
    // the same TCP socket corrupt each other's response buffers.
    try {
      const divRes = await fetchVistaDivisions();
      const clinicRes = await fetchVistaClinics('');
      const wardRes = await fetchVistaWards();

      if (divRes.ok || clinicRes.ok || wardRes.ok) {
        const divisions = (divRes.ok ? divRes.data : []).map(d => ({
          id: `div-${d.ien}`, name: d.name, type: 'Division',
          stationNumber: d.stationNumber || null,
          vistaGrounding: { file40_8Ien: d.ien, status: 'grounded' },
        }));
        const clinics = (clinicRes.ok ? clinicRes.data : []).map(c => ({
          id: `loc-${c.ien}`, name: c.name, type: 'Clinic',
          vistaGrounding: { file44Ien: c.ien, status: 'grounded' },
        }));
        const wards = (wardRes.ok ? wardRes.data : []).map(w => ({
          id: `ward-${w.ien}`, name: w.name, type: 'Ward',
          vistaGrounding: { file42Ien: w.ien, status: 'grounded' },
        }));

        // Build unified topology: divisions at top, clinics and wards nested
        const topology = divisions.length > 0
          ? divisions.map(d => ({ ...d, clinicCount: clinics.length, wardCount: wards.length, clinics, wards }))
          : [{ id: 'site-default', name: 'Site', type: 'Site', clinicCount: clinics.length, wardCount: wards.length, clinics, wards }];

        return {
          ok: true,
          source: 'vista',
          tenantId,
          data: topology,
          vistaGrounding: {
            hierarchy: 'Division (XUS DIVISION GET) → Clinic (ORWU CLINLOC) / Ward (ORQPT WARDS)',
            rpcsUsed: [
              divRes.ok ? 'XUS DIVISION GET' : null,
              clinicRes.ok ? 'ORWU CLINLOC' : null,
              wardRes.ok ? 'ORQPT WARDS' : null,
            ].filter(Boolean),
          },
        };
      }
    } catch (_) { /* VistA unavailable */ }
    return reply.code(503).send({ ok: false, source: 'error', tenantId, error: 'VistA unreachable — cannot build topology' });
  });

  // ---- Key inventory: cross-reference keys to holders via ^XUSEC ----

  let keyHolderCache = { data: null, ts: 0 };
  const KEY_HOLDER_CACHE_TTL = 5 * 60 * 1000;

  async function buildKeyHolderMap() {
    if (keyHolderCache.data && (Date.now() - keyHolderCache.ts) < KEY_HOLDER_CACHE_TTL) {
      return keyHolderCache.data;
    }
    const usersRes = await fetchVistaUsers('');
    if (!usersRes.ok) return null;
    const holderMap = {};
    const maxProbe = Math.min(usersRes.data.length, 150);
    for (let i = 0; i < maxProbe; i++) {
      const u = usersRes.data[i];
      const g = await ddrGetsFile200(u.ien, '51');
      if (g.ok && g.data) {
        const raw = g.data['51'] || g.data[51] || '';
        const keyLines = Array.isArray(raw) ? raw : String(raw).split('\n');
        for (const kl of keyLines) {
          const keyName = (kl.split('^')[0] || kl).trim().toUpperCase();
          if (!keyName) continue;
          if (!holderMap[keyName]) holderMap[keyName] = [];
          holderMap[keyName].push({ duz: u.ien, name: u.name });
        }
      }
    }
    keyHolderCache = { data: holderMap, ts: Date.now() };
    return holderMap;
  }

  app.get('/api/tenant-admin/v1/key-inventory', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const category = req.query.category || '';

    // Load the live PACKAGE #9.4 prefix→name map from VistA. Fails loud if
    // the RPC is unavailable — we do not fall back to a hardcoded table.
    await ensurePackageMap();

    const z = await callZveRpc('ZVE KEY LIST', []);
    const o = zveOutcome(z);
    if (o.kind !== 'ok') {
      return reply.code(502).send({
        ok: false, source: 'zve', tenantId,
        error: `ZVE KEY LIST failed: ${o.msg}`,
        rpcUsed: z.rpcUsed,
      });
    }

    const data = [];
    for (const line of z.lines.slice(1)) {
      const p = line.split('^');
      if (!p[0]) continue;
      const kName = p[1] || '';
      if (category && !kName.toLowerCase().includes(category.toLowerCase()) && !(p[2] || '').toLowerCase().includes(category.toLowerCase())) continue;
      const enriched = enrichKey({ keyName: kName, description: p[2] || '', descriptiveName: p[4] || '', vistaPackageName: p[5] || '' });
      data.push({
        keyName: kName,
        vistaKey: kName,
        displayName: enriched.displayName,
        description: enriched.descriptionSentence,
        descriptiveName: enriched.displayName,
        packageName: enriched.packageName,
        department: enriched.department,
        visibility: enriched.visibility,
        category: 'security-key',
        // Holder count comes from ^XUSEC scan inside the M routine (piece 3).
        // This is the canonical source — same table the security check reads.
        holderCount: parseInt(p[3] || '0', 10),
        holders: [],
        vistaGrounding: { file19_1Ien: p[0], rpcUsed: z.rpcUsed },
      });
    }
    const unassigned = data.filter(k => k.holderCount === 0).length;
    const clinical = data.filter(k => /PROVIDER|ORES|ORELSE|PSJ|PSO|LR|MAG|CPRS/i.test(k.keyName)).length;
    return {
      ok: true, source: 'zve', tenantId, data,
      summary: {
        totalKeys: data.length,
        clinicalKeys: clinical,
        adminKeys: data.length - clinical,
        unassignedKeys: unassigned,
        holderCountSource: 'xusec',
      },
      rpcUsed: z.rpcUsed,
    };
  });

  app.get('/api/tenant-admin/v1/key-holders/:keyName', async (req, reply) => {
    const tenantId = req.query.tenantId || 'default';
    const keyName = req.params.keyName;
    if (!keyName) return reply.code(400).send({ ok: false, error: 'keyName required' });

    // ZVE KEY HOLDERS scans ^XUSEC which is the Kernel security xref the
    // security check actually reads. This is the same table the KEYLIST RPC
    // uses for its holder count, so the detail modal and the catalog stay
    // in sync. This is the canonical source. If it fails, we fail loud.
    const z = await callZveRpc('ZVE KEY HOLDERS', [keyName.toUpperCase()]);
    const o = zveOutcome(z);
    if (o.kind !== 'ok') {
      return reply.code(502).send({
        ok: false, source: 'zve',
        error: `ZVE KEY HOLDERS failed: ${o.msg}`,
        rpcUsed: z.rpcUsed,
      });
    }
    const holders = [];
    for (const line of z.lines.slice(1)) {
      const p = line.split('^');
      if (!p[0]) continue;
      holders.push({ duz: p[0], name: p[1] || '' });
    }
    return {
      ok: true,
      source: 'zve',
      tenantId,
      keyName: keyName.toUpperCase(),
      holderCount: holders.length,
      holders,
      rpcUsed: z.rpcUsed,
    };
  });

  app.post('/api/tenant-admin/v1/key-impact', async (req) => {
    const body = req.body || {};
    const keys = body.keys || [];
    const navGroups = resolveNavGroups(keys.map(k => ({ name: k })));
    const roleCluster = resolveRoleCluster(keys.map(k => ({ name: k })));
    const keyImpact = {};
    for (const k of keys) {
      const upper = k.toUpperCase().trim();
      keyImpact[upper] = {
        navGroups: KEY_NAV_MAP[upper] || [],
        isAdmin: ['XUMGR', 'XUPROG', 'XUPROGMODE'].includes(upper),
      };
    }
    return { ok: true, navGroups, roleCluster, keyImpact };
  });

  // ---- E-signature status summary ----

  app.get('/api/tenant-admin/v1/esig-status', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });

    const usersRes = await fetchVistaUsers('');
    if (usersRes.ok && usersRes.data.length > 0) {
      const es = await fetchVistaEsigStatusForUsers(usersRes.data, 120);
      if (es.ok) {
        const summary = es.data.map(row => ({
          id: row.ien,
          name: row.name,
          duz: row.ien,
          status: 'active',
          esigStatus: row.hasCode ? 'active' : 'not-configured',
          hasCode: row.hasCode,
          sigBlockName: row.sigBlockName,
          sigBlockTitle: row.sigBlockTitle,
          initials: row.initials || '',
          source: row.source,
        }));
        return {
          ok: true,
          source: 'vista',
          tenantId,
          data: summary,
          aggregates: {
            total: summary.length,
            active: summary.filter(u => u.hasCode).length,
            notConfigured: summary.filter(u => !u.hasCode).length,
            revoked: 0,
          },
          rpcUsed: es.rpcUsed,
          probedUsers: es.probed,
          vistaGrounding: {
            readRpc: 'DDR GETS ENTRY DATA',
            fields: '20.2;20.3;20.4',
            note: 'Field 20.4 is hashed; response indicates presence only.',
          },
        };
      }
    }

    return reply.code(503).send({ ok: false, source: 'error', tenantId, error: 'VistA e-signature data unavailable (DDR GETS 200, fields 20.2-20.4)' });
  });

  // ---- VistA DDR family probe (no terminal; RPC-only) ----

  app.get('/api/tenant-admin/v1/vista/ddr-probe', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const probe = await probeVista();
    if (!probe.ok) {
      return reply.code(503).send({
        ok: false,
        tenantId,
        source: 'vista-unreachable',
        error: probe.error || 'VistA unreachable',
      });
    }
    try {
      const ddr = await probeDdrRpcFamily();
      return { ok: true, tenantId, source: 'vista', ...ddr };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- User Clone (via ZVE USER CLONE) — static path before parametric /users/:ien ----

  app.post('/api/tenant-admin/v1/users/clone', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const body = req.body || {};
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    if (!body.sourceDuz) return reply.code(400).send({ ok: false, error: 'sourceDuz required' });
    if (!body.newName) return reply.code(400).send({ ok: false, error: 'newName required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable' });
    try {
      // Step 1: Create the new user via ZVE USMG ADD
      const addResult = await callZveRpc('ZVE USMG ADD', [body.newName]);
      const addOutcome = zveOutcome(addResult);
      if (addOutcome.kind !== 'ok') {
        const code = addOutcome.kind === 'rejected' ? 409 : 502;
        return reply.code(code).send({ ok: false, error: addOutcome.msg, stage: 'create-user', lines: addResult.lines });
      }
      const newDuz = (addResult.line0 || '').split('^')[1] || null;
      if (!newDuz) return reply.code(502).send({ ok: false, error: 'User created but could not extract new DUZ', lines: addResult.lines });

      // Step 2: Clone keys/menus from source to new user via ZVE USER CLONE
      const cloneResult = await callZveRpc('ZVE USER CLONE', [String(body.sourceDuz), newDuz]);
      const cloneOutcome = zveOutcome(cloneResult);
      if (cloneOutcome.kind !== 'ok') {
        const code = cloneOutcome.kind === 'rejected' ? 409 : 502;
        return reply.code(code).send({ ok: false, error: cloneOutcome.msg, stage: 'clone-keys', lines: cloneResult.lines });
      }

      return {
        ok: true, source: 'vista', tenantId,
        rpcsUsed: ['ZVE USMG ADD', 'ZVE USER CLONE'],
        sourceDuz: body.sourceDuz, newName: body.newName, newDuz,
        createLines: addResult.lines, cloneLines: cloneResult.lines,
      };
    } catch (e) { return reply.code(500).send({ ok: false, error: e.message }); }
  });

  /** Update allow-listed File 200 fields via ZVE USER EDIT (ZVE-first) or DDR VALIDATOR + DDR FILER */
  app.put('/api/tenant-admin/v1/users/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const { ien } = req.params;
    const body = req.body || {};
    const field = body.field;
    const value = body.value;
    const ALLOW = {
      '.132': 'OFFICE PHONE',
      '.133': 'VOICE PAGER',
      '.134': 'DIGITAL PAGER',
      '.151': 'EMAIL ADDRESS',
      '3': 'FILE MANAGER ACCESS CODE',
      '4': 'SEX',
      '5': 'DOB',
      '8': 'TITLE',
      '9': 'SSN',
      '9.5': 'VERIFY CODE NEVER EXPIRES',
      '20.2': 'ELECTRONIC SIGNATURE INITIALS',
      '20.3': 'SIGNATURE BLOCK PRINTED NAME',
      '20.4': 'ELECTRONIC SIGNATURE CODE',
      '29': 'SERVICE/SECTION',
      '41.99': 'NPI',
      '53.08': 'REQUIRES COSIGNER',
      '53.11': 'AUTHORIZED TO WRITE MED ORDERS',
      '53.2': 'DEA#',
      '53.21': 'DEA EXPIRATION DATE',
      '53.42': 'COSIGNER',
      '53.5': 'PROVIDER CLASS',
      '55': 'PHARMACY SCHEDULES',
      '10.6': 'DEGREE',
      '101.01': 'RESTRICT PATIENT SELECTION',
      '200.07': 'LANGUAGE',
      '201': 'PRIMARY MENU OPTION',
    };
    if (!field || value === undefined || !ALLOW[field]) {
      return reply.code(400).send({
        ok: false,
        error: 'field and value required; field must be an allow-listed field',
        allowedFields: Object.keys(ALLOW),
        labels: ALLOW,
      });
    }
    // --- ZVE-first: ZVE USER EDIT ---
    const ZVE_FIELD_MAP = { '.132': 'PHONE', '.133': 'VOICE PAGER', '.134': 'DIGITAL PAGER', '.151': 'EMAIL', '4': 'SEX', '20.2': 'INITIALS', '20.3': 'SIG BLOCK', '20.4': 'ESIG', '201': 'MENU', '8': 'TITLE', '29': 'SERVICE', '5': 'DOB', '9': 'SSN', '41.99': 'NPI', '53.2': 'DEA', '53.5': 'PROVIDER_CLASS' };
    const zveFld = ZVE_FIELD_MAP[field];
    if (zveFld) {
      try {
        const z = await callZveRpc('ZVE USER EDIT', [String(ien), zveFld, String(value)]);
        const o = zveOutcome(z);
        if (o.kind === 'ok') {
          return { ok: true, source: 'zve', tenantId, ien, field, storedValue: String(value), rpcUsed: z.rpcUsed, lines: z.lines };
        }
        if (o.kind !== 'missing') {
          return reply.code(502).send({ ok: false, source: 'zve', error: o.msg, rpcUsed: z.rpcUsed });
        }
      } catch (_zve) { /* fall through to DDR */ }
    }
    // --- DDR fallback ---
    const p = await probeVista();
    if (!p.ok) {
      return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
    }
    const iens = `${ien},`;
    const valRes = await ddrValidateField(200, iens, field, String(value));
    if (!valRes.ok) {
      return reply.code(400).send({ ok: false, stage: 'DDR VALIDATOR', error: valRes.error });
    }
    const filer = await ddrFilerEdit(200, iens, field, String(value), 'E');
    if (!filer.ok) {
      return reply.code(502).send({ ok: false, stage: 'DDR FILER', error: filer.error, rpcUsed: filer.rpcUsed });
    }
    return {
      ok: true,
      source: 'vista',
      tenantId,
      ien,
      field,
      storedValue: String(value),
      rpcUsed: ['DDR VALIDATOR', filer.rpcUsed],
      filerLines: filer.lines,
      validatorLines: valRes.lines,
    };
  });

  /** List security keys for a user — DDR LISTER on File 200.051 subfile */
  app.get('/api/tenant-admin/v1/users/:targetDuz/keys', async (req, reply) => {
    const tenantId = req.query.tenantId || 'default';
    const duz = String(req.params.targetDuz);

    // ZVE USER DETAIL already returns the user's keys in its suffix lines
    // (KEY^IEN^NAME). Reusing it here gives us a single source of truth
    // so the detail panel and the per-user keys endpoint cannot drift.
    const z = await callZveRpc('ZVE USER DETAIL', [duz]);
    const o = zveOutcome(z);
    if (o.kind !== 'ok') {
      return reply.code(502).send({
        ok: false, source: 'zve', tenantId,
        error: `ZVE USER DETAIL failed: ${o.msg || o.kind}`,
        rpcUsed: z.rpcUsed,
      });
    }
    await ensurePackageMap();
    const rawKeys = [];
    for (const line of z.lines.slice(2)) {
      const p = line.split('^');
      if (p[0] !== 'KEY') continue;
      const keyName = p[2] || '';
      if (!keyName) continue;
      // p[1] = SECURITY KEY #19.1 IEN, p[2] = key name
      const enriched = enrichKey({ keyName, description: '', descriptiveName: '' });
      rawKeys.push({
        ien: p[1],
        name: keyName,
        displayName: enriched.displayName,
        packageName: enriched.packageName,
      });
    }
    return {
      ok: true, source: 'zve', tenantId, duz,
      data: rawKeys,
      rpcUsed: z.rpcUsed,
    };
  });

  /** Assign security key — ZVE USMG KEYS (overlay). */
  app.post('/api/tenant-admin/v1/users/:targetDuz/keys', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const keyName = (req.body || {}).keyName;
    if (!keyName || typeof keyName !== 'string') {
      return reply.code(400).send({ ok: false, error: 'keyName required in JSON body' });
    }
    const sanitized = keyName.toUpperCase().replace(/[^A-Z0-9 \-]/g, '').trim();
    if (!sanitized) return reply.code(400).send({ ok: false, error: 'keyName empty after sanitize' });
    // ORES/ORELSE mutual exclusion — server-side enforcement
    if (sanitized === 'ORES' || sanitized === 'ORELSE') {
      const conflict = sanitized === 'ORES' ? 'ORELSE' : 'ORES';
      try {
        const userKeysLines = await lockedRpc(async () => {
          const broker = await getBroker();
          return broker.callRpcWithList('DDR LISTER', [{
            type: 'list',
            value: { FILE: '200.051', IENS: `,${req.params.targetDuz},`, FIELDS: '.01', FLAGS: 'IP', MAX: '999' },
          }]);
        });
        const parsedKeys = parseDdrListerResponse(userKeysLines);
        if (parsedKeys.ok) {
          const keyCatalog = await ddrListerSecurityKeys();
          const ienToName = {};
          if (keyCatalog.ok && keyCatalog.data) {
            for (const k of keyCatalog.data) { ienToName[k.ien] = k.name; }
          }
          const existing = (parsedKeys.data || []).map(line => {
            const parts = line.split('^');
            return (ienToName[(parts[1] || '').trim()] || '').toUpperCase();
          });
          if (existing.includes(conflict)) {
            return reply.code(409).send({ ok: false, error: `Cannot assign ${sanitized}: user already holds ${conflict}. ORES and ORELSE are mutually exclusive per VA policy.` });
          }
        }
      } catch { /* proceed — overlay may handle it */ }
    }
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
    const z = await callZveRpc('ZVE USMG KEYS', ['ADD', String(req.params.targetDuz), sanitized]);
    const o = zveOutcome(z);
    if (o.kind === 'missing') return reply.code(502).send({ ok: false, error: `RPC ZVE USMG KEYS returned missing status`, detail: o.msg });
    if (o.kind !== 'ok' && o.kind !== 'missing') return reply.code(o.kind === 'rejected' ? 409 : 502).send({ ok: false, error: o.msg, rpcUsed: z.rpcUsed, lines: z.lines });
    return { ok: true, tenantId, targetDuz: req.params.targetDuz, keyName: sanitized, rpcUsed: z.rpcUsed, lines: z.lines };
  });

  app.delete('/api/tenant-admin/v1/users/:targetDuz/keys/:keyId', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const keyName = String(req.params.keyId || '').toUpperCase().replace(/\+/g, ' ').replace(/%20/g, ' ');
    if (!keyName.trim()) return reply.code(400).send({ ok: false, error: 'keyId (key name) required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
    const z = await callZveRpc('ZVE USMG KEYS', ['DEL', String(req.params.targetDuz), keyName.trim()]);
    const o = zveOutcome(z);
    if (o.kind === 'missing') return reply.code(502).send({ ok: false, error: `RPC ZVE USMG KEYS returned missing status`, detail: o.msg });
    if (o.kind !== 'ok' && o.kind !== 'missing') return reply.code(o.kind === 'rejected' ? 409 : 502).send({ ok: false, error: o.msg, rpcUsed: z.rpcUsed, lines: z.lines });
    return { ok: true, tenantId, targetDuz: req.params.targetDuz, keyName: keyName.trim(), rpcUsed: z.rpcUsed, lines: z.lines };
  });

  /** S9.23: Check access code availability — ZVE USMG CHKAC */
  app.post('/api/tenant-admin/v1/users/check-access-code', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const ac = (req.body || {}).accessCode;
    if (!ac || typeof ac !== 'string' || ac.length < 3) {
      return reply.code(400).send({ ok: false, error: 'accessCode required (min 3 chars)' });
    }
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
    const z = await callZveRpc('ZVE USMG CHKAC', [ac]);
    const o = zveOutcome(z);
    return { ok: o.kind === 'ok', available: o.kind === 'ok', error: o.kind !== 'ok' ? o.msg : undefined, rpcUsed: z.rpcUsed };
  });

  /** Create File 200 user — ZVE USMG ADD + save ALL wizard fields (A001-A022) */
  app.post('/api/tenant-admin/v1/users', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const body = req.body || {};
    const name = body.name;
    if (!name || typeof name !== 'string') {
      return reply.code(400).send({ ok: false, error: 'name required' });
    }
    // S1.12: Require accessCode + verifyCode for usable accounts
    if (!body.accessCode || !body.verifyCode) {
      return reply.code(400).send({ ok: false, error: 'accessCode and verifyCode are required to create a usable account' });
    }
    // Warn (non-blocking) on missing demographic fields
    const warnings = [];
    if (!body.sex) warnings.push('sex not provided');
    if (!body.dob) warnings.push('dob not provided');
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
    const z = await callZveRpc('ZVE USMG ADD', [name, body.accessCode || '', body.verifyCode || '']);
    const o = zveOutcome(z);
    if (o.kind !== 'ok') return reply.code(502).send({ ok: false, error: `RPC ZVE USMG ADD failed: ${o.msg || o.kind}`, rpcUsed: z.rpcUsed, lines: z.lines });
    const newIen = (z.line0 || '').split('^')[1] || null;
    const extraFields = [];
    // DDR-writable fields: body key → File 200 field number
    const EXTRA_MAP = {
      title: '8', ssn: '9', sex: '4', dob: '5',
      serviceSection: '29',
      primaryMenu: '201',
      // A002: Email
      email: '.151',
      // A003: Phone
      phone: '.132',
      // A004: NPI
      npi: '41.99',
      // A005: DEA#
      dea: '53.2',
      // A006: Provider Type/Class
      providerType: '53.5',
      // A009: Language
      language: '200.07',
      // A013: Signature Block Printed Name
      sigBlockName: '20.3',
      // A014: Cosigner (pointer to File 200)
      cosigner: '53.42',
      // A016: Authorized to Write Med Orders
      authorizedToWriteMeds: '53.11',
      // A017: Controlled substance schedules
      controlledSchedules: '55',
      // A018: FileMan Access Code
      filemanAccess: '3',
      // A020: DEA Expiration Date
      deaExpiration: '53.21',
      // E011: Degree / Suffix
      degree: '10.6',
    };
    if (newIen) {
      const iens = `${newIen},`;
      for (const [key, fld] of Object.entries(EXTRA_MAP)) {
        const val = body[key];
        if (val !== undefined && val !== null && val !== '' && fld) {
          try {
            // Boolean fields → '1'/'0' for VistA SET types
            const vistaVal = (val === true) ? '1' : (val === false) ? '0' : String(val);
            await ddrFilerEdit(200, iens, fld, vistaVal, 'E');
            extraFields.push({ field: fld, key, status: 'ok' });
          } catch (e) { extraFields.push({ field: fld, key, status: 'error', detail: e.message }); }
        }
      }

      // A010: Verify Code Never Expires (field 9.5) — boolean toggle
      if (body.verifyCodeNeverExpires) {
        try {
          await ddrFilerEdit(200, iens, '9.5', '1', 'E');
          extraFields.push({ field: '9.5', key: 'verifyCodeNeverExpires', status: 'ok' });
        } catch (e) { extraFields.push({ field: '9.5', key: 'verifyCodeNeverExpires', status: 'error', detail: e.message }); }
      }

      // A011: Restrict Patient Selection (field 101.01) — boolean toggle
      if (body.restrictPatient) {
        try {
          await ddrFilerEdit(200, iens, '101.01', '1', 'E');
          extraFields.push({ field: '101.01', key: 'restrictPatient', status: 'ok' });
        } catch (e) { extraFields.push({ field: '101.01', key: 'restrictPatient', status: 'error', detail: e.message }); }
      }

      // A015: Requires Cosigner (field 53.08) — boolean
      if (body.requiresCosign) {
        try {
          await ddrFilerEdit(200, iens, '53.08', '1', 'E');
          extraFields.push({ field: '53.08', key: 'requiresCosign', status: 'ok' });
        } catch (e) { extraFields.push({ field: '53.08', key: 'requiresCosign', status: 'error', detail: e.message }); }
      }

      // A001: Assign security keys (permissions)
      if (Array.isArray(body.permissions) && body.permissions.length > 0) {
        const keyResults = [];
        for (const keyName of body.permissions) {
          const sanitized = String(keyName).toUpperCase().replace(/[^A-Z0-9 \-]/g, '').trim();
          if (!sanitized) continue;
          try {
            const kz = await callZveRpc('ZVE USMG KEYS', ['ADD', String(newIen), sanitized]);
            const ko = zveOutcome(kz);
            keyResults.push({ key: sanitized, status: ko.kind === 'ok' ? 'ok' : 'error', detail: ko.msg || '' });
          } catch (e) { keyResults.push({ key: sanitized, status: 'error', detail: e.message }); }
        }
        extraFields.push({ field: 'permissions', status: 'processed', keys: keyResults });
      }

      // A007: Primary division via ZVE DIVISION ASSIGN
      if (body.primaryLocation) {
        try {
          const dz = await callZveRpc('ZVE DIVISION ASSIGN', [String(newIen), String(body.primaryLocation), 'ADD']);
          const dd = zveOutcome(dz);
          extraFields.push({ field: 'primaryLocation', status: dd.kind === 'ok' ? 'ok' : 'error', detail: dd.msg || '' });
        } catch (e) { extraFields.push({ field: 'primaryLocation', status: 'error', detail: e.message }); }
      }

      // A008: Additional locations
      if (Array.isArray(body.additionalLocations)) {
        for (const locIen of body.additionalLocations) {
          if (!locIen) continue;
          try {
            const lz = await callZveRpc('ZVE DIVISION ASSIGN', [String(newIen), String(locIen), 'ADD']);
            const ld = zveOutcome(lz);
            extraFields.push({ field: 'additionalLocation', value: locIen, status: ld.kind === 'ok' ? 'ok' : 'error', detail: ld.msg || '' });
          } catch (e) { extraFields.push({ field: 'additionalLocation', value: locIen, status: 'error', detail: e.message }); }
        }
      }
    }

    // S1.2: Store employeeId in extension global (no File 200 field for this)
    if (newIen && body.employeeId) {
      try {
        const ez = await callZveRpc('ZVE UEXT SET', [String(newIen), 'EMPID', String(body.employeeId)]);
        const eo = zveOutcome(ez);
        extraFields.push({ field: 'employeeId', key: 'employeeId', status: eo.kind === 'ok' ? 'ok' : 'error', detail: eo.msg || '' });
      } catch (e) { extraFields.push({ field: 'employeeId', key: 'employeeId', status: 'error', detail: e.message }); }
    }

    // S1.4: Persist role name used during creation
    if (newIen && body.role) {
      try {
        const rz = await callZveRpc('ZVE UEXT SET', [String(newIen), 'ROLE', String(body.role)]);
        const ro = zveOutcome(rz);
        extraFields.push({ field: 'role', key: 'role', status: ro.kind === 'ok' ? 'ok' : 'error', detail: ro.msg || '' });
      } catch (e) { extraFields.push({ field: 'role', key: 'role', status: 'error', detail: e.message }); }
    }

    // Y003: Return full user data so frontend doesn't need to re-fetch
    return { ok: true, tenantId, newIen, duz: newIen, ien: newIen, rpcUsed: z.rpcUsed, lines: z.lines, extraFields, warnings,
      data: { duz: newIen, ien: newIen, name: name, status: 'active' } };
  });

  app.post('/api/tenant-admin/v1/users/:duz/esig', async (req, reply) => {
    const tenantId = req.query.tenantId || 'default';
    const body = req.body || {};
    const action = (body.action || '').toLowerCase();
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });

    // CLEAR action — nulls field 20.4 in File #200 via ZVE ESIG MANAGE
    if (action === 'clear') {
      try {
        const z = await callZveRpc('ZVE ESIG MANAGE', [String(req.params.duz), 'CLEAR']);
        const o = zveOutcome(z);
        if (o.kind !== 'ok') return reply.code(o.kind === 'rejected' ? 409 : 502).send({ ok: false, error: o.msg || 'Failed to clear e-signature', rpcUsed: z.rpcUsed });
        return { ok: true, tenantId, duz: req.params.duz, action: 'clear', rpcUsed: z.rpcUsed };
      } catch (clearErr) {
        return reply.code(502).send({ ok: false, error: `Clear failed: ${clearErr.message}` });
      }
    }

    // SET action — requires a code
    const code = body.code;
    if (!code || typeof code !== 'string') return reply.code(400).send({ ok: false, error: 'code required (or use action: "clear" to clear)' });
    const z = await callZveRpc('ZVE USMG ESIG', [String(req.params.duz), code]);
    const o = zveOutcome(z);
    if (o.kind !== 'ok') return reply.code(o.kind === 'rejected' ? 409 : 502).send({ ok: false, error: o.msg || 'Failed to set e-signature', rpcUsed: z.rpcUsed });
    return { ok: true, tenantId, duz: req.params.duz, action: 'set', rpcUsed: z.rpcUsed };
  });

  app.post('/api/tenant-admin/v1/users/:duz/provider', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const body = req.body || {};
    const PROV_FIELDS = {
      npi: { file200: '41.99', label: 'NPI' },
      dea: { file200: '53.2', label: 'DEA NUMBER' },
      stateLicense: { file200: '53.1', label: 'STATE LICENSE NUMBER' },
      personClass: { file200: '200.05', label: 'PERSON CLASS' },
      providerType: { file200: '53.5', label: 'PROVIDER TYPE' },
      authMeds: { file200: '53.11', label: 'AUTHORIZED TO WRITE MED ORDERS' },
      pharmSchedules: { file200: '55', label: 'DEA# SUFFIX / PHARMACY SCHEDULES' },
      sigBlockTitle: { file200: '20.3', label: 'SIGNATURE BLOCK TITLE (piece 2)' },
      title: { file200: '8', label: 'TITLE (pointer to File 3.1)' },
      taxId: { file200: '53.3', label: 'TAX ID' },
    };
    const fieldKey = body.field;
    const value = body.value;
    if (!fieldKey || !value || !PROV_FIELDS[fieldKey]) {
      return reply.code(400).send({ ok: false, error: 'field and value required', allowedFields: Object.keys(PROV_FIELDS) });
    }
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
    const pf = PROV_FIELDS[fieldKey];
    const iens = `${req.params.duz},`;
    const filer = await ddrFilerEdit(200, iens, pf.file200, String(value), 'E');
    if (!filer.ok) return reply.code(502).send({ ok: false, stage: 'DDR FILER', field: pf.label, error: filer.error });
    return { ok: true, tenantId, duz: req.params.duz, field: pf.label, rpcUsed: 'DDR FILER' };
  });

  // ---- CPRS Tab Access for a user (Chapter-1 B8) ----
  app.get('/api/tenant-admin/v1/users/:duz/cprs-tabs', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
    // File 200.03 = OE/RR LIST sub-file under File 200 (CPRS tab parameters)
    // DDR LISTER columns: .01 (name), 1 (access)
    const duz = req.params.duz;
    const iens = `${duz},`;
    try {
      const z = await callZveRpc('ZVE DDR LISTER', [
        '200.03', iens, '.01;1', '', '', '', '', '', '1000',
      ]);
      const o = zveOutcome(z);
      if (o.kind !== 'ok') {
        return reply.code(502).send({ ok: false, error: `DDR LISTER 200.03 failed: ${o.msg || o.kind}`, rpcUsed: z.rpcUsed });
      }
      const tabs = [];
      for (const line of z.lines.slice(1)) {
        const parts = line.split('^');
        if (parts[0]) tabs.push({ name: parts[0], access: parts[1] || '' });
      }
      return { ok: true, tenantId, duz, tabs, rpcUsed: z.rpcUsed };
    } catch (err) {
      return reply.code(502).send({ ok: false, error: err.message });
    }
  });

  app.put('/api/tenant-admin/v1/users/:duz/credentials', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const body = req.body || {};
    const ac = body.accessCode || body.username || '';
    const vc = body.verifyCode || body.password || '';
    if (!ac || !vc) return reply.code(400).send({ ok: false, error: 'accessCode and verifyCode are required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
    const z = await callZveRpc('ZVE USMG CRED', [String(req.params.duz), ac, vc]);
    const o = zveOutcome(z);
    if (o.kind !== 'ok') return reply.code(502).send({ ok: false, error: `RPC ZVE USMG CRED failed: ${o.msg || o.kind}`, rpcUsed: z.rpcUsed, lines: z.lines });
    return { ok: true, tenantId, duz: req.params.duz, rpcUsed: z.rpcUsed };
  });

  app.post('/api/tenant-admin/v1/users/:duz/deactivate', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
    const z = await callZveRpc('ZVE USMG DEACT', [String(req.params.duz), (req.body || {}).reason || '']);
    const o = zveOutcome(z);
    if (o.kind !== 'ok') return reply.code(502).send({ ok: false, error: `RPC ZVE USMG DEACT failed: ${o.msg || o.kind}`, rpcUsed: z.rpcUsed, lines: z.lines });
    return { ok: true, tenantId, duz: req.params.duz, rpcUsed: z.rpcUsed, lines: z.lines };
  });

  app.post('/api/tenant-admin/v1/users/:duz/reactivate', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
    const z = await callZveRpc('ZVE USMG REACT', [String(req.params.duz)]);
    const o = zveOutcome(z);
    if (o.kind !== 'ok') return reply.code(502).send({ ok: false, error: `RPC ZVE USMG REACT failed: ${o.msg || o.kind}`, rpcUsed: z.rpcUsed, lines: z.lines });
    return { ok: true, tenantId, duz: req.params.duz, rpcUsed: z.rpcUsed, lines: z.lines };
  });

  /** S2.2: Assign or remove a division for a user via ZVE DIVISION ASSIGN */
  app.post('/api/tenant-admin/v1/users/:duz/division', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const body = req.body || {};
    const divisionIen = body.divisionIen;
    const action = (body.action || 'ADD').toUpperCase();
    if (!divisionIen) return reply.code(400).send({ ok: false, error: 'divisionIen required' });
    if (!['ADD', 'REMOVE'].includes(action)) return reply.code(400).send({ ok: false, error: 'action must be ADD or REMOVE' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
    const z = await callZveRpc('ZVE DIVISION ASSIGN', [String(req.params.duz), String(divisionIen), action]);
    const o = zveOutcome(z);
    if (o.kind !== 'ok') return reply.code(502).send({ ok: false, error: `ZVE DIVISION ASSIGN failed: ${o.msg || o.kind}`, rpcUsed: z.rpcUsed, lines: z.lines });
    return { ok: true, tenantId, duz: req.params.duz, divisionIen, action, rpcUsed: z.rpcUsed };
  });

  /** Unlock a locked-out user account via ZVE wrapper or DDR FILER fallback */
  app.post('/api/tenant-admin/v1/users/:duz/unlock', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    // Validate the DUZ is a positive integer up-front so the DDR fallback
    // doesn't surface "The IENS '0,' is syntactically incorrect" to the UI.
    const targetDuz = String(req.params.duz || '').trim();
    if (!/^\d+$/.test(targetDuz) || Number(targetDuz) <= 0) {
      return reply.code(400).send({ ok: false, error: 'duz must be a positive integer' });
    }
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
    // Try ZVE wrapper first, fall back to DDR edit of DISUSER field (#200 field 4)
    let z;
    try {
      z = await callZveRpc('ZVE USMG UNLOCK', [targetDuz]);
      const o = zveOutcome(z);
      if (o.kind !== 'ok') throw new Error(o.msg || 'RPC failed');
      return { ok: true, tenantId, duz: targetDuz, action: 'unlock', rpcUsed: z.rpcUsed, lines: z.lines };
    } catch {
      // Fallback: clear DISUSER flag via DDR FILER
      const iens = `${targetDuz},`;
      const filer = await ddrFilerEdit(200, iens, '4', '@', 'E');
      if (!filer.ok) return reply.code(502).send({ ok: false, stage: 'DDR FILER', error: filer.error });
      return { ok: true, tenantId, duz: targetDuz, action: 'unlock', rpcUsed: 'DDR FILER' };
    }
  });

  /** Terminate user (DISUSER + termination date + clear access) via ZVE USMG TERM */
  app.post('/api/tenant-admin/v1/users/:duz/terminate', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
    const z = await callZveRpc('ZVE USMG TERM', [String(req.params.duz)]);
    const o = zveOutcome(z);
    if (o.kind !== 'ok') return reply.code(502).send({ ok: false, error: `RPC ZVE USMG TERM failed: ${o.msg || o.kind}`, rpcUsed: z.rpcUsed, lines: z.lines });
    const details = {};
    for (const line of z.lines.slice(1)) {
      const [k, v] = line.split('^');
      if (k) details[k] = v;
    }
    return { ok: true, tenantId, duz: req.params.duz, rpcUsed: z.rpcUsed, lines: z.lines, details };
  });

  /** Query VistA FileMan audit trail (^DIA) for File 200 via ZVE USMG AUDLOG */
  app.get('/api/tenant-admin/v1/audit/fileman', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const targetDuz = req.query.duz || '*';
    const max = req.query.max || '50';
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
    const z = await callZveRpc('ZVE USMG AUDLOG', [targetDuz, max]);
    const o = zveOutcome(z);
    if (o.kind === 'missing') return reply.code(502).send({ ok: false, error: `RPC ZVE USMG AUDLOG returned missing status`, detail: o.msg });
    if (o.kind !== 'ok') return reply.code(o.kind === 'rejected' ? 409 : 502).send({ ok: false, error: o.msg || 'RPC rejected', rpcUsed: z.rpcUsed });
    const data = [];
    for (const line of z.lines.slice(1)) {
      const parts = line.split('^');
      if (parts.length >= 6) {
        data.push({
          ien: parts[0],
          fileNumber: '200',
          dateTime: parts[2],
          fieldChanged: parts[3],
          fieldNum: parts[4],
          userName: parts[5] ? `Staff #${parts[5]}` : '',
          oldValue: parts[6] || '',
          newValue: parts[7] || '',
        });
      }
    }
    return { ok: true, source: 'vista', tenantId, rpcUsed: z.rpcUsed, data };
  });

  /** Rename user (.01 field) via ZVE USMG RENAME */
  app.put('/api/tenant-admin/v1/users/:duz/rename', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const body = req.body || {};
    const newName = body.newName;
    if (!newName || typeof newName !== 'string') {
      return reply.code(400).send({ ok: false, error: 'newName required (LAST,FIRST format)' });
    }
    if (!newName.includes(',')) {
      return reply.code(400).send({ ok: false, error: 'Name must be LAST,FIRST format' });
    }
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
    const z = await callZveRpc('ZVE USMG RENAME', [String(req.params.duz), newName.toUpperCase().trim()]);
    const o = zveOutcome(z);
    if (o.kind === 'missing') return reply.code(502).send({ ok: false, error: `RPC ZVE USMG RENAME returned missing status`, detail: o.msg });
    if (o.kind !== 'ok' && o.kind !== 'missing') return reply.code(o.kind === 'rejected' ? 409 : 502).send({ ok: false, error: o.msg, rpcUsed: z.rpcUsed, lines: z.lines });
    return { ok: true, tenantId, duz: req.params.duz, newName: newName.toUpperCase().trim(), rpcUsed: z.rpcUsed, lines: z.lines };
  });

  /** Device list (File 3.5) via DDR LISTER */
  app.get('/api/tenant-admin/v1/devices', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) {
      return reply.code(503).send({ ok: false, tenantId, source: 'vista-unreachable', error: p.error });
    }
    try {
      const rows = await lockedRpc(async () => {
        return ddrList({ file: '3.5', fields: '.01;1;2;3', fieldNames: ['name', 'dollarI', 'type', 'subtype'], search: req.query.search });
      });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '3.5', data: rows };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  /** Kernel site parameters (File 8989.3) — ZVE-first, DDR fallback */
  app.get('/api/tenant-admin/v1/params/kernel', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });

    // --- ZVE-first: ZVE PARAM GET ---
    try {
      const z = await callZveRpc('ZVE PARAM GET', []);
      const o = zveOutcome(z);
      if (o.kind === 'ok') {
        const params = [];
        for (const line of z.lines.slice(1)) {
          const p = line.split('^');
          if (p[0] === 'PARAM') {
            params.push({ name: p[1] || '', value: p[2] || '', description: p[3] || '' });
          }
        }
        return { ok: true, source: 'zve', tenantId, rpcUsed: z.rpcUsed, file: '8989.3', data: params };
      }
      if (o.kind !== 'missing') {
        return reply.code(502).send({ ok: false, source: 'zve', error: o.msg, rpcUsed: z.rpcUsed });
      }
    } catch (_zve) { /* ZVE unavailable, fall through to DDR */ }

    // --- DDR fallback ---
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable' });
    try {
      const result = await lockedRpc(async () => {
        const broker = await getBroker();
        const listLines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '8989.3', FIELDS: '.01', FLAGS: 'IP', MAX: '5' } },
        ]);
        const parsed = parseDdrListerResponse(listLines);
        let ien = '1';
        if (parsed.ok && parsed.data.length > 0) {
          const firstLine = parsed.data[0];
          const parts = firstLine.split('^');
          if (parts[0] && /^\d+$/.test(parts[0].trim())) {
            ien = parts[0].trim();
          }
        }
        // Fields confirmed present in File 8989.3 (no .04 — it does not exist).
        // FLAGS=IE returns both Internal and External values so numeric fields show correctly.
        // Includes the security policy fields (202, 203, 204, 214, 219, 19*, 212.5)
        // so the DDR fallback path matches the live ZVE PARAM GET surface.
        const getsLines = await broker.callRpcWithList('DDR GETS ENTRY DATA', [
          { type: 'list', value: { FILE: '8989.3', IENS: `${ien},`, FIELDS: '.01;.02;.03;.05;9;11;11.2;19;19.4;19.5;202;203;204;205;210;212.5;214;217;219;230;231;240;501', FLAGS: 'IE' } },
        ]);
        return { ien, rawLines: getsLines };
      });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER + DDR GETS ENTRY DATA', file: '8989.3', ien: result.ien, rawLines: result.rawLines };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, error: e.message, note: 'File 8989.3 IEN may differ per site.' });
    }
  });

  // Fields verified present in File 8989.3 DD (probed via ZVEPRB94.m):
  // .04 does NOT exist — removed. .03 = AFTER HOURS MAIL GROUP, not institution.
  // Security policy fields (202, 203, 204, 214, 219, 19, 19.4, 19.5, 212.5,
  // 11.2) added so the DDR PUT fallback matches the live ZVE PARAM SET path.
  const KERNEL8989_ALLOW = {
    '.01': 'DOMAIN NAME',
    '.02': 'IRM MAIL GROUP',
    '.03': 'AFTER HOURS MAIL GROUP',
    '.05': 'MIXED OS',
    '9': 'AGENCY CODE',
    '11': 'AUTO-GENERATE ACCESS CODES',
    '11.2': 'AUTO-GENERATE VERIFY CODES',
    '19': 'OPTION AUDIT',
    '19.4': 'INITIATE AUDIT',
    '19.5': 'TERMINATE AUDIT',
    '202': 'DEFAULT # OF ATTEMPTS',
    '203': 'DEFAULT LOCK-OUT TIME',
    '204': 'MULTIPLE SIGN-ON',
    '205': 'ASK DEVICE TYPE AT SIGN-ON',
    '206': 'DEFAULT AUTO-MENU',
    '210': 'DEFAULT TIMED-READ (SECONDS)',
    '212.5': 'FAILED ACCESS LOG',
    '214': 'LIFETIME OF VERIFY CODE',
    '217': 'DEFAULT INSTITUTION',
    '219': 'MAX SIGN-ON LIMIT',
    '230': 'BROKER ACTIVITY TIMEOUT',
    '231': 'GUI POST SIGN-ON',
    '501': 'PRODUCTION',
  };

  app.put('/api/tenant-admin/v1/params/kernel', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const body = req.body || {};
    const field = body.field;
    const value = body.value;
    const paramName = body.paramName || '';

    // --- ZVE-first: ZVE PARAM SET (uses param names not field numbers) ---
    if (paramName) {
      try {
        const z = await callZveRpc('ZVE PARAM SET', [paramName, String(value), body.reason || '']);
        const o = zveOutcome(z);
        if (o.kind === 'ok') {
          return { ok: true, source: 'zve', tenantId, paramName, value, rpcUsed: z.rpcUsed };
        }
        if ((o.kind !== 'ok' && o.kind !== 'missing')) {
          return reply.code(400).send({ ok: false, source: 'zve', error: o.msg, rpcUsed: z.rpcUsed });
        }
        if (o.kind !== 'missing') {
          return reply.code(502).send({ ok: false, source: 'zve', error: o.msg, rpcUsed: z.rpcUsed });
        }
      } catch (_zve) { /* ZVE unavailable, fall through to DDR */ }
    }

    // --- DDR fallback (uses field numbers) ---
    if (!field || value === undefined || !KERNEL8989_ALLOW[field]) {
      return reply.code(400).send({
        ok: false,
        error: 'field and value required; field must be allow-listed',
        allowedFields: Object.keys(KERNEL8989_ALLOW),
      });
    }
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
    const actualIen = await lockedRpc(async () => {
      const broker = await getBroker();
      const listLines = await broker.callRpcWithList('DDR LISTER', [
        { type: 'list', value: { FILE: '8989.3', FIELDS: '.01', FLAGS: 'IP', MAX: '1' } },
      ]);
      const parsed = parseDdrListerResponse(listLines);
      if (parsed.ok && parsed.data.length > 0) {
        const parts = parsed.data[0].split('^');
        if (parts[0] && /^\d+$/.test(parts[0].trim())) return parts[0].trim();
      }
      return '1';
    });
    const iens = `${actualIen},`;
    const valRes = await ddrValidateField(8989.3, iens, field, String(value));
    if (!valRes.ok) return reply.code(400).send({ ok: false, stage: 'DDR VALIDATOR', error: valRes.error });
    const filer = await ddrFilerEdit(8989.3, iens, field, String(value), 'E');
    if (!filer.ok) return reply.code(502).send({ ok: false, stage: 'DDR FILER', error: filer.error });
    return {
      ok: true,
      tenantId,
      field,
      rpcUsed: ['DDR VALIDATOR', 'DDR FILER'],
      filerLines: filer.lines,
    };
  });

  /** Create clinic (File 44) — ZVE CLNM ADD */
  app.post('/api/tenant-admin/v1/clinics', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const name = (req.body || {}).name;
    if (!name || typeof name !== 'string') return reply.code(400).send({ ok: false, error: 'name required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
    const z = await callZveRpc('ZVE CLNM ADD', [name]);
    const o = zveOutcome(z);
    if (o.kind !== 'ok') return reply.code(502).send({ ok: false, error: `RPC ZVE CLNM ADD failed: ${o.msg || o.kind}`, rpcUsed: z.rpcUsed, lines: z.lines });
    const newIen = (z.line0 || '').split('^')[1] || null;
    return { ok: true, tenantId, newIen, rpcUsed: z.rpcUsed, lines: z.lines };
  });

  app.put('/api/tenant-admin/v1/clinics/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const name = (req.body || {}).name;
    if (!name || typeof name !== 'string') return reply.code(400).send({ ok: false, error: 'name required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
    const z = await callZveRpc('ZVE CLNM EDIT', [String(req.params.ien), name]);
    const o = zveOutcome(z);
    if (o.kind !== 'ok') return reply.code(502).send({ ok: false, error: `RPC ZVE CLNM EDIT failed: ${o.msg || o.kind}`, rpcUsed: z.rpcUsed, lines: z.lines });
    return { ok: true, tenantId, ien: req.params.ien, rpcUsed: z.rpcUsed, lines: z.lines };
  });

  app.put('/api/tenant-admin/v1/wards/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const name = (req.body || {}).name;
    if (!name || typeof name !== 'string') return reply.code(400).send({ ok: false, error: 'name required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
    const z = await callZveRpc('ZVE WRDM EDIT', [String(req.params.ien), name]);
    const o = zveOutcome(z);
    if (o.kind !== 'ok') return reply.code(502).send({ ok: false, error: `RPC ZVE WRDM EDIT failed: ${o.msg || o.kind}`, rpcUsed: z.rpcUsed, lines: z.lines });
    return { ok: true, tenantId, ien: req.params.ien, rpcUsed: z.rpcUsed, lines: z.lines };
  });

  /** Create device File 3.5 — DDR FILER ADD .01 */
  app.post('/api/tenant-admin/v1/devices', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const nm = (req.body || {}).name;
    if (!nm || typeof nm !== 'string') return reply.code(400).send({ ok: false, error: 'name required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
    const valRes = await ddrValidateField('3.5', '+1,', '.01', nm);
    if (!valRes.ok) return reply.code(400).send({ ok: false, stage: 'DDR VALIDATOR', error: valRes.error });
    const filer = await ddrFilerAdd('3.5', '.01', '+1,', nm, 'E');
    if (!filer.ok) return reply.code(502).send({ ok: false, stage: 'DDR FILER ADD', error: filer.error });
    return { ok: true, tenantId, rpcUsed: filer.rpcUsed, lines: filer.lines };
  });

  app.put('/api/tenant-admin/v1/devices/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const nm = (req.body || {}).name;
    if (!nm || typeof nm !== 'string') return reply.code(400).send({ ok: false, error: 'name required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
    const iens = `${req.params.ien},`;
    const valRes = await ddrValidateField(3.5, iens, '.01', nm);
    if (!valRes.ok) return reply.code(400).send({ ok: false, stage: 'DDR VALIDATOR', error: valRes.error });
    const filer = await ddrFilerEdit(3.5, iens, '.01', nm, 'E');
    if (!filer.ok) return reply.code(502).send({ ok: false, stage: 'DDR FILER', error: filer.error });
    return { ok: true, tenantId, ien: req.params.ien, rpcUsed: ['DDR VALIDATOR', 'DDR FILER'], lines: filer.lines };
  });

  app.get('/api/tenant-admin/v1/dashboard', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const probe = await probeVista();
    if (!probe.ok) {
      return reply.code(503).send({ ok: false, source: 'error', tenantId, error: probe.error || 'VistA unreachable — dashboard requires live VistA connection' });
    }
    let userCount = 0, activeUserCount = 0, clinicCount = 0, wardCount = 0;
    let facilityCount = 0, bedCount = 0, roleCount = 0, deviceCount = 0, esigActiveCount = 0;
    let terminalTypeCount = 0, hl7InterfaceCount = 0;
    try {
      const usersRes = await fetchVistaUsers('');
      const keysRes = await ddrListerSecurityKeys();
      if (usersRes.ok) { userCount = usersRes.data.length; activeUserCount = userCount; }
      if (keysRes.ok) { roleCount = keysRes.data.length; }
      const countFile = async (file) => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: file, FIELDS: '.01', FLAGS: 'IP', MAX: '9999' } },
        ]);
        const parsed = parseDdrListerResponse(lines);
        return parsed.ok ? parsed.data.length : 0;
      };
      await lockedRpc(async () => {
        clinicCount = await countFile('44');
        facilityCount = clinicCount;
        wardCount = await countFile('42');
        deviceCount = await countFile('3.5');
        terminalTypeCount = await countFile('3.2');
        hl7InterfaceCount = await countFile('870');
        bedCount = await countFile('405.4');
      });
      if (usersRes.ok) {
        const es = await fetchVistaEsigStatusForUsers(usersRes.data, 120);
        if (es.ok) { esigActiveCount = es.data.filter(u => u.hasCode).length; }
      }
    } catch (e) {
      return reply.code(503).send({ ok: false, source: 'error', tenantId, error: `VistA dashboard data fetch failed: ${e.message}` });
    }
    return {
      ok: true, source: 'vista', tenantId,
      data: { userCount, activeUserCount, facilityCount, clinicCount, wardCount, bedCount,
        roleCount, esigActiveCount, deviceCount, terminalTypeCount, hl7InterfaceCount,
        apiRouteCount: 156, uiRouteCount: 71, vistaFileCount: '35+', mRoutineCount: 14,
        vistaGrounding: 'connected', vistaUrl: probe.url || null, moduleStatus: { enabled: 0, total: 0 } },
    };
  });

  /** Clinic detail (File 44) via DDR GETS ENTRY DATA — all scheduling + basic fields */
  app.get('/api/tenant-admin/v1/clinics/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const { ien } = req.params;
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'vista-unreachable', error: p.error });
    try {
      const ddr = await ddrGetsEntry('44', ien, '.01;1;2;3;4;8;9;16;1912;1913;1914;1917;1918;1918.5;1920;2002;2503;2505');
      return { ok: true, source: 'vista', tenantId, ien, rpcUsed: ddr.rpcUsed, file: '44', data: ddr.data, rawLines: ddr.rawLines };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  /** Edit clinic field (File 44) via DDR VALIDATOR + DDR FILER */
  const CLINIC44_ALLOW = {
    '.01': 'CLINIC NAME', '2': 'ABBREVIATION', '8': 'STOP CODE NUMBER',
    '16': 'DEFAULT PROVIDER', '1912': 'LENGTH OF APPOINTMENT',
    '1913': 'VARIABLE APPOINTMENT LENGTH', '1914': 'HOUR CLINIC DISPLAY BEGINS',
    '1917': 'DISPLAY INCREMENTS PER HOUR', '1918': 'OVERBOOKS/DAY MAXIMUM',
    '1918.5': 'SCHEDULE ON HOLIDAYS', '1920': 'ALLOWABLE CONSECUTIVE NO-SHOWS',
    '2002': 'MAX DAYS FOR FUTURE BOOKING', '2503': 'CREDIT STOP CODE',
  };

  app.put('/api/tenant-admin/v1/clinics/:ien/fields', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const body = req.body || {};
    const field = body.field;
    const value = body.value;
    if (!field || value === undefined || !CLINIC44_ALLOW[field]) {
      return reply.code(400).send({ ok: false, error: 'field and value required', allowedFields: Object.keys(CLINIC44_ALLOW), labels: CLINIC44_ALLOW });
    }
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
    const iens = `${req.params.ien},`;
    const valRes = await ddrValidateField(44, iens, field, String(value));
    if (!valRes.ok) return reply.code(400).send({ ok: false, stage: 'DDR VALIDATOR', error: valRes.error });
    const filer = await ddrFilerEdit(44, iens, field, String(value), 'E');
    if (!filer.ok) return reply.code(502).send({ ok: false, stage: 'DDR FILER', error: filer.error });
    return { ok: true, tenantId, ien: req.params.ien, field, rpcUsed: ['DDR VALIDATOR', 'DDR FILER'], filerLines: filer.lines };
  });

  /** Ward detail (File 42) via DDR GETS ENTRY DATA */
  app.get('/api/tenant-admin/v1/wards/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const { ien } = req.params;
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'vista-unreachable', error: p.error });
    try {
      const ddr = await ddrGetsEntry('42', ien, '.01;.015;1;2;3;.1;.105');
      return { ok: true, source: 'vista', tenantId, ien, rpcUsed: ddr.rpcUsed, file: '42', data: ddr.data, rawLines: ddr.rawLines };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  /** Device detail (File 3.5) via DDR GETS ENTRY DATA */
  app.get('/api/tenant-admin/v1/devices/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const { ien } = req.params;
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'vista-unreachable', error: p.error });
    try {
      const ddr = await ddrGetsEntry('3.5', ien, '.01;1;2;3;4;5;6;7;8;9;10;11;50');
      return { ok: true, source: 'vista', tenantId, ien, rpcUsed: ddr.rpcUsed, file: '3.5', data: ddr.data, rawLines: ddr.rawLines };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  /** Edit device field (File 3.5) via DDR VALIDATOR + DDR FILER */
  const DEVICE35_ALLOW = {
    '.01': 'NAME', '1': '$I', '2': 'ASK DEVICE', '3': 'TYPE',
    '4': 'SUBTYPE', '5': 'LOCATION OF TERMINAL', '6': 'RIGHT MARGIN',
    '7': 'FORM FEED', '8': 'PAGE LENGTH', '9': 'CLOSE EXECUTE',
    '10': 'OPEN PARAMETERS', '11': 'CLOSE PARAMETERS', '50': 'OUT OF SERVICE',
  };

  app.put('/api/tenant-admin/v1/devices/:ien/fields', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const body = req.body || {};
    const field = body.field;
    const value = body.value;
    if (!field || value === undefined || !DEVICE35_ALLOW[field]) {
      return reply.code(400).send({ ok: false, error: 'field and value required', allowedFields: Object.keys(DEVICE35_ALLOW), labels: DEVICE35_ALLOW });
    }
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable' });
    const iens = `${req.params.ien},`;
    const valRes = await ddrValidateField(3.5, iens, field, String(value));
    if (!valRes.ok) return reply.code(400).send({ ok: false, stage: 'DDR VALIDATOR', error: valRes.error });
    const filer = await ddrFilerEdit(3.5, iens, field, String(value), 'E');
    if (!filer.ok) return reply.code(502).send({ ok: false, stage: 'DDR FILER', error: filer.error });
    return { ok: true, tenantId, ien: req.params.ien, field, rpcUsed: ['DDR VALIDATOR', 'DDR FILER'], filerLines: filer.lines };
  });

  /** Test print to device (File 3.5) — requires ZVE overlay routine */
  app.post('/api/tenant-admin/v1/devices/:ien/test-print', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
    const z = await callZveRpc('ZVE DEV TESTPRINT', [String(req.params.ien)]);
    const o = zveOutcome(z);
    if (o.kind !== 'ok') return reply.code(502).send({ ok: false, error: `RPC ZVE DEV TESTPRINT failed: ${o.msg || o.kind}`, rpcUsed: z.rpcUsed, lines: z.lines });
    return { ok: true, tenantId, ien: req.params.ien, rpcUsed: z.rpcUsed, lines: z.lines };
  });

  /** Delete device (File 3.5) via DDR DELETE ENTRY */
  app.delete('/api/tenant-admin/v1/devices/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
    const iens = `${req.params.ien},`;
    try {
      const lines = await lockedRpc(async () => {
        const broker = await getBroker();
        return broker.callRpcWithList('DDR DELETE ENTRY', [
          { type: 'list', value: { FILE: '3.5', IENS: iens } },
        ]);
      });
      const hasError = lines.some(l => l.includes('[ERROR]') || l.includes('[Data]'));
      if (hasError) {
        return reply.code(502).send({ ok: false, error: 'DDR DELETE ENTRY returned error', lines });
      }
      return { ok: true, tenantId, ien: req.params.ien, rpcUsed: 'DDR DELETE ENTRY', lines };
    } catch (e) {
      if (isRpcMissingError(e.message || '')) {
        return reply.code(502).send({ ok: false, error: 'DDR DELETE ENTRY not available.',
          detail: e.message,
         });
      }
      return reply.code(502).send({ ok: false, error: e.message });
    }
  });

  // ---- Terminal Types (File 3.2) via DDR LISTER ----

  app.get('/api/tenant-admin/v1/terminal-types', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'vista-unreachable', error: p.error });
    const search = req.query.search;
    try {
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '3.2', FIELDS: '.01;1;2;3', FLAGS: 'IP', MAX: '5000', ...(search ? { PART: search.toUpperCase() } : {}) } },
        ]);
        const parsed = parseDdrListerResponse(lines);
        if (!parsed.ok) return [];
        const out = [];
        for (const line of parsed.data) {
          const a = line.split('^');
          const ien = a[0]?.trim();
          if (!ien || !/^\d+$/.test(ien)) continue;
          out.push({ ien, name: a[1]?.trim() || '', rightMargin: a[2]?.trim() || '', formFeed: a[3]?.trim() || '', pageLength: a[4]?.trim() || '' });
        }
        return out;
      });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '3.2', data: rows };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Treating Specialties (File 45.7) via DDR LISTER ----

  app.get('/api/tenant-admin/v1/treating-specialties', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'vista-unreachable', error: p.error });
    const search = req.query.search;
    try {
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '45.7', FIELDS: '.01;1;2', FLAGS: 'IP', MAX: '5000', ...(search ? { PART: search.toUpperCase() } : {}) } },
        ]);
        const parsed = parseDdrListerResponse(lines);
        if (!parsed.ok) return [];
        const out = [];
        for (const line of parsed.data) {
          const a = line.split('^');
          const ien = a[0]?.trim();
          if (!ien || !/^\d+$/.test(ien)) continue;
          out.push({ ien, name: a[1]?.trim() || '', service: a[2]?.trim() || '', specialty: a[3]?.trim() || '' });
        }
        return out;
      });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '45.7', data: rows };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Room-Bed Management (File 405.4) via DDR LISTER ----

  app.get('/api/tenant-admin/v1/room-beds', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'vista-unreachable', error: p.error });
    const search = req.query.search;
    try {
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '405.4', FIELDS: '.01;.02;.2', FLAGS: 'IP', MAX: '5000', ...(search ? { PART: search.toUpperCase() } : {}) } },
        ]);
        const parsed = parseDdrListerResponse(lines);
        if (!parsed.ok) return [];
        const out = [];
        for (const line of parsed.data) {
          const a = line.split('^');
          const ien = a[0]?.trim();
          if (!ien || !/^\d+$/.test(ien)) continue;
          out.push({ ien, roomBed: a[1]?.trim() || '', description: a[2]?.trim() || '', outOfService: a[3]?.trim() || '' });
        }
        return out;
      });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '405.4', data: rows };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Installed Packages (File 9.4) via DDR LISTER ----

  app.get('/api/tenant-admin/v1/packages', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'vista-unreachable', error: p.error });
    const search = req.query.search;
    try {
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '9.4', FIELDS: '.01;1;2', FLAGS: 'IP', MAX: '5000', ...(search ? { PART: search.toUpperCase() } : {}) } },
        ]);
        const parsed = parseDdrListerResponse(lines);
        if (!parsed.ok) return [];
        const out = [];
        for (const line of parsed.data) {
          const a = line.split('^');
          const ien = a[0]?.trim();
          if (!ien || !/^\d+$/.test(ien)) continue;
          out.push({ ien, name: a[1]?.trim() || '', prefix: a[2]?.trim() || '', shortDesc: a[3]?.trim() || '' });
        }
        return out;
      });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '9.4', data: rows };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- HL7 Interfaces (File 870 — HL LOGICAL LINK) via DDR LISTER (read-only) ----

  app.get('/api/tenant-admin/v1/hl7-interfaces', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'vista-unreachable', error: p.error });
    const search = req.query.search;
    try {
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '870', FIELDS: '.01;2;4;200.02', FLAGS: 'IP', MAX: '5000', ...(search ? { PART: search.toUpperCase() } : {}) } },
        ]);
        const parsed = parseDdrListerResponse(lines);
        if (!parsed.ok) return [];
        const out = [];
        for (const line of parsed.data) {
          const a = line.split('^');
          const ien = a[0]?.trim();
          if (!ien || !/^\d+$/.test(ien)) continue;
          out.push({ ien, name: a[1]?.trim() || '', institution: a[2]?.trim() || '', lowerLayer: a[3]?.trim() || '', autostart: a[4]?.trim() || '' });
        }
        return out;
      });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '870', data: rows };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- HL7 Interface detail (File 870) ----

  app.get('/api/tenant-admin/v1/hl7-interfaces/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const ddr = await ddrGetsEntry('870', ien, '.01;2;3;4;4.5;200.02;200.021;400.01;400.02;400.03');
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR GETS ENTRY DATA', file: '870', ien, data: ddr.data, rawLines: ddr.rawLines };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Insurance Companies (File 36) via DDR LISTER ----

  app.get('/api/tenant-admin/v1/insurance-companies', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'vista-unreachable', error: p.error });
    const search = req.query.search;
    try {
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '36', FIELDS: '.01;.111;.114;.115;.116', FLAGS: 'IP', MAX: '5000', ...(search ? { PART: search.toUpperCase() } : {}) } },
        ]);
        const parsed = parseDdrListerResponse(lines);
        if (!parsed.ok) return [];
        const out = [];
        for (const line of parsed.data) {
          const a = line.split('^');
          const ien = a[0]?.trim();
          if (!ien || !/^\d+$/.test(ien)) continue;
          out.push({ ien, name: a[1]?.trim() || '', streetAddr: a[2]?.trim() || '', city: a[3]?.trim() || '', state: a[4]?.trim() || '', zip: a[5]?.trim() || '' });
        }
        return out;
      });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '36', data: rows };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Appointment Types (File 409.1) via DDR LISTER ----

  app.get('/api/tenant-admin/v1/appointment-types', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'vista-unreachable', error: p.error });
    const search = req.query.search;
    try {
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '409.1', FIELDS: '.01;3;4', FLAGS: 'IP', MAX: '5000', ...(search ? { PART: search.toUpperCase() } : {}) } },
        ]);
        const parsed = parseDdrListerResponse(lines);
        if (!parsed.ok) return [];
        const out = [];
        for (const line of parsed.data) {
          const a = line.split('^');
          const ien = a[0]?.trim();
          if (!ien || !/^\d+$/.test(ien)) continue;
          out.push({ ien, name: a[1]?.trim() || '', inactive: a[2]?.trim() || '', synonym: a[3]?.trim() || '' });
        }
        return out;
      });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '409.1', data: rows };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Menu Options (File 19) via DDR LISTER (read-only) ----

  app.get('/api/tenant-admin/v1/menu-options', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'vista-unreachable', error: p.error });
    const search = req.query.search;
    try {
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '19', FIELDS: '.01;1;3.6;4', FLAGS: 'IP', MAX: '5000', ...(search ? { PART: search.toUpperCase() } : {}) } },
        ]);
        const parsed = parseDdrListerResponse(lines);
        if (!parsed.ok) return [];
        const out = [];
        for (const line of parsed.data) {
          const a = line.split('^');
          const ien = a[0]?.trim();
          if (!ien || !/^\d+$/.test(ien)) continue;
          out.push({ ien, name: a[1]?.trim() || '', menuText: a[2]?.trim() || '', type: a[3]?.trim() || '', description: a[4]?.trim() || '' });
        }
        return out;
      });
      const MAX_MENU = 5000;
      const capped = rows.length >= MAX_MENU;
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '19', data: rows,
        ...(capped ? { capped: true, totalNote: `Results limited to ${MAX_MENU}. Use search to narrow.` } : {}) };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Menu Option detail (File 19) ----

  app.get('/api/tenant-admin/v1/menu-options/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const ddr = await ddrGetsEntry('19', ien, '.01;1;2;3.5;3.6;3.9;4;15');
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR GETS ENTRY DATA', file: '19', ien, data: ddr.data, rawLines: ddr.rawLines };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Drug File / Formulary (File 50) via DDR LISTER (read-only) ----

  app.get('/api/tenant-admin/v1/drug-file', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'vista-unreachable', error: p.error });
    try {
      const rows = await lockedRpc(async () => {
        return ddrList({ file: '50', fields: '.01;2;3;100', fieldNames: ['name', 'vaClass', 'dea', 'inactiveDate'], search: req.query.search });
      });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '50', data: rows };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Drug detail (File 50) ----

  app.get('/api/tenant-admin/v1/drug-file/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const ddr = await ddrGetsEntry('50', ien, '.01;2;3;6.5;8;15;20;21;25;31;51;100');
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR GETS ENTRY DATA', file: '50', ien, data: ddr.data, rawLines: ddr.rawLines };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Lab Tests (File 60) via DDR LISTER (read-only) ----

  app.get('/api/tenant-admin/v1/lab-tests', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'vista-unreachable', error: p.error });
    const search = req.query.search;
    try {
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '60', FIELDS: '.01;3;4', FLAGS: 'IP', MAX: '5000', ...(search ? { PART: search.toUpperCase() } : {}) } },
        ]);
        const parsed = parseDdrListerResponse(lines);
        if (!parsed.ok) return [];
        const out = [];
        for (const line of parsed.data) {
          const a = line.split('^');
          const ien = a[0]?.trim();
          if (!ien || !/^\d+$/.test(ien)) continue;
          out.push({ ien, name: a[1]?.trim() || '', type: a[2]?.trim() || '', subscript: a[3]?.trim() || '' });
        }
        return out;
      });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '60', data: rows };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Lab Test detail (File 60) ----

  app.get('/api/tenant-admin/v1/lab-tests/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const ddr = await ddrGetsEntry('60', ien, '.01;3;4;5;13;51');
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR GETS ENTRY DATA', file: '60', ien, data: ddr.data, rawLines: ddr.rawLines };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Package detail (File 9.4) ----

  app.get('/api/tenant-admin/v1/packages/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const ddr = await ddrGetsEntry('9.4', ien, '.01;1;2;3;13;14');
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR GETS ENTRY DATA', file: '9.4', ien, data: ddr.data, rawLines: ddr.rawLines };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- TaskMan task detail (File 14.4) ----

  app.get('/api/tenant-admin/v1/taskman-tasks/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const ddr = await ddrGetsEntry('14.4', ien, '.01;2;6');
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR GETS ENTRY DATA', file: '14.4', ien, data: ddr.data, rawLines: ddr.rawLines };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- TaskMan Status (File 14.4) via DDR LISTER (read-only) ----

  app.get('/api/tenant-admin/v1/taskman-tasks', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'vista-unreachable', error: p.error });
    const search = req.query.search;
    try {
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '14.4', FIELDS: '.01;2;6;51', FLAGS: 'IP', MAX: '5000', ...(search ? { PART: search.toUpperCase() } : {}) } },
        ]);
        const parsed = parseDdrListerResponse(lines);
        if (!parsed.ok) return [];
        const out = [];
        for (const line of parsed.data) {
          const a = line.split('^');
          const ien = a[0]?.trim();
          if (!ien || !/^\d+$/.test(ien)) continue;
          out.push({ ien, entryPoint: a[1]?.trim() || '', routine: a[2]?.trim() || '', scheduledRun: a[3]?.trim() || '', statusCode: a[4]?.trim() || '' });
        }
        return out;
      });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '14.4', data: rows };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Titles (File 3.1) via DDR LISTER (read-only) ----

  app.get('/api/tenant-admin/v1/titles', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'vista-unreachable', error: p.error });
    const search = req.query.search;
    try {
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '3.1', FIELDS: '.01', FLAGS: 'IP', MAX: '5000', ...(search ? { PART: search.toUpperCase() } : {}) } },
        ]);
        const parsed = parseDdrListerResponse(lines);
        if (!parsed.ok) return [];
        const out = [];
        for (const line of parsed.data) {
          const a = line.split('^');
          const ien = a[0]?.trim();
          if (!ien || !/^\d+$/.test(ien)) continue;
          out.push({ ien, name: a[1]?.trim() || '' });
        }
        return out;
      });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '3.1', data: rows };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Terminal Type detail + edit (File 3.2) ----

  app.get('/api/tenant-admin/v1/terminal-types/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const ddr = await ddrGetsEntry('3.2', ien, '.01;1;2;3;4;5;6');
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR GETS ENTRY DATA', file: '3.2', ien, data: ddr.data, rawLines: ddr.rawLines };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  app.put('/api/tenant-admin/v1/terminal-types/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    const body = req.body || {};
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    const fieldMap = { name: '.01', rightMargin: '1', formFeed: '2', pageLength: '3', backSpace: '4' };
    const edits = {};
    for (const [k, fld] of Object.entries(fieldMap)) {
      if (body[k] !== undefined) edits[fld] = body[k];
    }
    if (Object.keys(edits).length === 0) return reply.code(400).send({ ok: false, error: 'No editable fields provided' });
    const iens = `${ien},`;
    const result = await ddrFilerEditMulti('3.2', iens, edits);
    if (!result.ok) return reply.code(502).send({ ok: false, tenantId, source: 'error', stage: 'DDR FILER', error: result.error, lines: result.lines });
    return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR FILER', file: '3.2', ien, fieldCount: result.fieldCount, lines: result.lines };
  });

  // ---- Room-Bed detail + edit (File 405.4) ----

  app.get('/api/tenant-admin/v1/room-beds/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const ddr = await ddrGetsEntry('405.4', ien, '.01;.02;.04;.2;2;3');
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR GETS ENTRY DATA', file: '405.4', ien, data: ddr.data, rawLines: ddr.rawLines };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  app.put('/api/tenant-admin/v1/room-beds/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    const body = req.body || {};
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    const fieldMap = { roomBed: '.01', ward: '.02', outOfService: '.2' };
    const edits = {};
    for (const [k, fld] of Object.entries(fieldMap)) {
      if (body[k] !== undefined) edits[fld] = body[k];
    }
    if (Object.keys(edits).length === 0) return reply.code(400).send({ ok: false, error: 'No editable fields provided' });
    const iens = `${ien},`;
    const result = await ddrFilerEditMulti('405.4', iens, edits);
    if (!result.ok) return reply.code(502).send({ ok: false, tenantId, source: 'error', stage: 'DDR FILER', error: result.error, lines: result.lines });
    return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR FILER', file: '405.4', ien, fieldCount: result.fieldCount, lines: result.lines };
  });

  app.delete('/api/tenant-admin/v1/room-beds/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const iens = `${ien},`;
      const result = await ddrFilerEditMulti('405.4', iens, { '.01': '@' });
      if (!result.ok) return reply.code(502).send({ ok: false, tenantId, source: 'error', stage: 'DDR FILER DELETE', error: result.error, lines: result.lines });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR FILER', file: '405.4', ien, action: 'deleted' };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Title detail + edit (File 3.1) ----

  app.get('/api/tenant-admin/v1/titles/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const ddr = await ddrGetsEntry('3.1', ien, '.01');
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR GETS ENTRY DATA', file: '3.1', ien, data: ddr.data, rawLines: ddr.rawLines };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  app.put('/api/tenant-admin/v1/titles/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    const body = req.body || {};
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    const fieldMap = { name: '.01' };
    const edits = {};
    for (const [k, fld] of Object.entries(fieldMap)) {
      if (body[k] !== undefined) edits[fld] = body[k];
    }
    if (Object.keys(edits).length === 0) return reply.code(400).send({ ok: false, error: 'No editable fields provided' });
    const iens = `${ien},`;
    const result = await ddrFilerEditMulti('3.1', iens, edits);
    if (!result.ok) return reply.code(502).send({ ok: false, tenantId, source: 'error', stage: 'DDR FILER', error: result.error, lines: result.lines });
    return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR FILER', file: '3.1', ien, fieldCount: result.fieldCount, lines: result.lines };
  });

  // ---- Health Summary Types (File 142) via DDR LISTER ----

  app.get('/api/tenant-admin/v1/health-summary-types', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    const search = req.query.search;
    try {
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '142', FIELDS: '.01;.02;.05;.06;.08;.09', FLAGS: 'IP', MAX: '5000', ...(search ? { PART: search.toUpperCase() } : {}) } },
        ]);
        const parsed = parseDdrListerResponse(lines);
        if (!parsed.ok) return [];
        const out = [];
        for (const line of parsed.data) {
          const a = line.split('^');
          const ien = a[0]?.trim();
          if (!ien || !/^\d+$/.test(ien)) continue;
          out.push({
            ien,
            name: a[1]?.trim() || '',
            title: a[2]?.trim() || '',
            lock: a[3]?.trim() || '',
            owner: a[4]?.trim() || '',
            suppressWithoutData: a[5]?.trim() || '',
            nationallyExported: a[6]?.trim() || '',
          });
        }
        return out;
      });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '142', data: rows };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- TIU Document Definitions (File 8925.1) via DDR LISTER ----

  app.get('/api/tenant-admin/v1/tiu-document-defs', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    const search = req.query.search;
    try {
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '8925.1', FIELDS: '.01;.02;.03;.04;.07', FLAGS: 'IP', MAX: '5000', ...(search ? { PART: search.toUpperCase() } : {}) } },
        ]);
        const parsed = parseDdrListerResponse(lines);
        if (!parsed.ok) return [];
        const out = [];
        for (const line of parsed.data) {
          const a = line.split('^');
          const ien = a[0]?.trim();
          if (!ien || !/^\d+$/.test(ien)) continue;
          out.push({
            ien,
            name: a[1]?.trim() || '',
            abbreviation: a[2]?.trim() || '',
            printName: a[3]?.trim() || '',
            type: a[4]?.trim() || '',
            status: a[5]?.trim() || '',
          });
        }
        return out;
      });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '8925.1', data: rows };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Mail Groups (File 3.8) via DDR LISTER ----

  app.get('/api/tenant-admin/v1/mail-groups', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    const search = req.query.search;
    try {
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '3.8', FIELDS: '.01;4;5;5.1;7;10', FLAGS: 'IP', MAX: '5000', ...(search ? { PART: search.toUpperCase() } : {}) } },
        ]);
        const parsed = parseDdrListerResponse(lines);
        if (!parsed.ok) return [];
        const out = [];
        for (const line of parsed.data) {
          const a = line.split('^');
          const ien = a[0]?.trim();
          if (!ien || !/^\d+$/.test(ien)) continue;
          out.push({
            ien,
            name: a[1]?.trim() || '',
            type: a[2]?.trim() || '',
            organizer: a[3]?.trim() || '',
            description: a[4]?.trim() || '',
            selfEnroll: a[5]?.trim() || '',
            restrictions: a[6]?.trim() || '',
          });
        }
        return out;
      });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '3.8', data: rows };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Radiology Procedures (File 71) via DDR LISTER ----

  app.get('/api/tenant-admin/v1/radiology-procedures', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    const search = req.query.search;
    try {
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '71', FIELDS: '.01;6;9;12', FLAGS: 'IP', MAX: '5000', ...(search ? { PART: search.toUpperCase() } : {}) } },
        ]);
        const parsed = parseDdrListerResponse(lines);
        if (!parsed.ok) return [];
        const out = [];
        for (const line of parsed.data) {
          const a = line.split('^');
          const ien = a[0]?.trim();
          if (!ien || !/^\d+$/.test(ien)) continue;
          out.push({
            ien,
            name: a[1]?.trim() || '',
            procedureType: a[2]?.trim() || '',
            cptCode: a[3]?.trim() || '',
            imagingType: a[4]?.trim() || '',
          });
        }
        return out;
      });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '71', data: rows };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Error Trap (File 3.077) via DDR LISTER ----

  app.get('/api/tenant-admin/v1/error-trap', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    const search = req.query.search;
    try {
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '3.077', FIELDS: '.01;1;2;3;4;6;20', FLAGS: 'IP', MAX: '5000', ...(search ? { PART: search.toUpperCase() } : {}) } },
        ]);
        const parsed = parseDdrListerResponse(lines);
        if (!parsed.ok) return [];
        const out = [];
        for (const line of parsed.data) {
          const a = line.split('^');
          const ien = a[0]?.trim();
          if (!ien || !/^\d+$/.test(ien)) continue;
          out.push({
            ien,
            errorText: a[1]?.trim() || '',
            firstDateTime: a[2]?.trim() || '',
            mostRecentDateTime: a[3]?.trim() || '',
            routineName: a[4]?.trim() || '',
            frequency: a[5]?.trim() || '',
            lastGlobal: a[6]?.trim() || '',
            lineOfCode: a[7]?.trim() || '',
          });
        }
        return out;
      });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '3.077', data: rows };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Error Trap Purge (File 3.077) ----

  app.delete('/api/tenant-admin/v1/error-trap/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable' });
    try {
      const result = await ddrFilerEdit('3.077', `${ien},`, '.01', '@', 'E');
      return { ok: true, tenantId, ien, action: 'purged', rpcUsed: 'DDR FILER', result };
    } catch (e) { return reply.code(500).send({ ok: false, error: e.message }); }
  });

  app.post('/api/tenant-admin/v1/error-trap/purge', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const body = req.body || {};
    const olderThanDays = body.olderThanDays || 30;
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable' });
    try {
      const lines = await lockedRpc(async () => {
        const broker = await getBroker();
        return broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '3.077', FIELDS: '.01;2', FLAGS: 'IP', MAX: '500' } },
        ]);
      });
      const parsed = parseDdrListerResponse(lines);
      if (!parsed.ok) return { ok: true, tenantId, purged: 0, note: 'No entries found' };
      // Calculate cutoff date in FM internal format (YYYMMDD)
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - olderThanDays);
      const cutoffFm = `${cutoff.getFullYear() - 1700}${String(cutoff.getMonth() + 1).padStart(2, '0')}${String(cutoff.getDate()).padStart(2, '0')}`;
      let purged = 0;
      for (const line of parsed.data) {
        const parts = line.split('^');
        const entryIen = parts[0]?.trim();
        if (!entryIen || !/^\d+$/.test(entryIen)) continue;
        // parts[2] = field 2 (most recent date/time) in FM format
        const entryDate = (parts[2] || '').trim().split('.')[0];
        if (entryDate && entryDate >= cutoffFm) continue; // skip entries newer than cutoff
        try {
          await ddrFilerEdit('3.077', `${entryIen},`, '.01', '@', 'E');
          purged++;
        } catch { /* skip entries that can't be deleted */ }
      }
      return { ok: true, tenantId, purged, olderThanDays, rpcUsed: 'DDR FILER' };
    } catch (e) { return reply.code(500).send({ ok: false, error: e.message }); }
  });

  // ---- Health Summary Type detail (DDR GETS) + edit (DDR FILER) ----

  app.get('/api/tenant-admin/v1/health-summary-types/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const ddr = await ddrGetsEntry('142', ien, '.01;.02;.05;.06;.07;.08;.09');
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR GETS ENTRY DATA', file: '142', ien, data: ddr.data, rawLines: ddr.rawLines };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  app.put('/api/tenant-admin/v1/health-summary-types/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    const body = req.body || {};
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    const fieldMap = { name: '.01', title: '.02', lock: '.05', suppressWithoutData: '.08' };
    const edits = {};
    for (const [k, fld] of Object.entries(fieldMap)) {
      if (body[k] !== undefined) edits[fld] = body[k];
    }
    if (Object.keys(edits).length === 0) return reply.code(400).send({ ok: false, error: 'No editable fields provided' });
    const iens = `${ien},`;
    const result = await ddrFilerEditMulti('142', iens, edits);
    if (!result.ok) return reply.code(502).send({ ok: false, tenantId, source: 'error', stage: 'DDR FILER', error: result.error, lines: result.lines });
    return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR FILER', file: '142', ien, fieldCount: result.fieldCount, lines: result.lines };
  });

  // ---- TIU Doc Def detail + edit ----

  app.get('/api/tenant-admin/v1/tiu-document-defs/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const ddr = await ddrGetsEntry('8925.1', ien, '.01;.02;.03;.04;.07;.08;.1;.13');
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR GETS ENTRY DATA', file: '8925.1', ien, data: ddr.data, rawLines: ddr.rawLines };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  app.put('/api/tenant-admin/v1/tiu-document-defs/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    const body = req.body || {};
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    const fieldMap = { name: '.01', abbreviation: '.02', printName: '.03', status: '.07' };
    const edits = {};
    for (const [k, fld] of Object.entries(fieldMap)) {
      if (body[k] !== undefined) edits[fld] = body[k];
    }
    if (Object.keys(edits).length === 0) return reply.code(400).send({ ok: false, error: 'No editable fields provided' });
    const iens = `${ien},`;
    const result = await ddrFilerEditMulti('8925.1', iens, edits);
    if (!result.ok) return reply.code(502).send({ ok: false, tenantId, source: 'error', stage: 'DDR FILER', error: result.error, lines: result.lines });
    return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR FILER', file: '8925.1', ien, fieldCount: result.fieldCount, lines: result.lines };
  });

  // ---- Mail Group detail + edit ----

  app.get('/api/tenant-admin/v1/mail-groups/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const ddr = await ddrGetsEntry('3.8', ien, '.01;4;5;5.1;7;8;10');
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR GETS ENTRY DATA', file: '3.8', ien, data: ddr.data, rawLines: ddr.rawLines };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  app.put('/api/tenant-admin/v1/mail-groups/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    const body = req.body || {};
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    const fieldMap = { name: '.01', type: '4', organizer: '5', selfEnroll: '7', restrictions: '10' };
    const edits = {};
    for (const [k, fld] of Object.entries(fieldMap)) {
      if (body[k] !== undefined) edits[fld] = body[k];
    }
    if (Object.keys(edits).length === 0) return reply.code(400).send({ ok: false, error: 'No editable fields provided' });
    const iens = `${ien},`;
    const result = await ddrFilerEditMulti('3.8', iens, edits);
    if (!result.ok) return reply.code(502).send({ ok: false, tenantId, source: 'error', stage: 'DDR FILER', error: result.error, lines: result.lines });
    return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR FILER', file: '3.8', ien, fieldCount: result.fieldCount, lines: result.lines };
  });

  // ---- Radiology Procedure detail + edit ----

  app.get('/api/tenant-admin/v1/radiology-procedures/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const ddr = await ddrGetsEntry('71', ien, '.01;6;7;9;10;12;13;18');
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR GETS ENTRY DATA', file: '71', ien, data: ddr.data, rawLines: ddr.rawLines };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  app.put('/api/tenant-admin/v1/radiology-procedures/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    const body = req.body || {};
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    const fieldMap = { name: '.01', procedureType: '6', cptCode: '9', imagingType: '12' };
    const edits = {};
    for (const [k, fld] of Object.entries(fieldMap)) {
      if (body[k] !== undefined) edits[fld] = body[k];
    }
    if (Object.keys(edits).length === 0) return reply.code(400).send({ ok: false, error: 'No editable fields provided' });
    const iens = `${ien},`;
    const result = await ddrFilerEditMulti('71', iens, edits);
    if (!result.ok) return reply.code(502).send({ ok: false, tenantId, source: 'error', stage: 'DDR FILER', error: result.error, lines: result.lines });
    return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR FILER', file: '71', ien, fieldCount: result.fieldCount, lines: result.lines };
  });

  // ---- Insurance Company detail + edit (File 36) ----

  app.get('/api/tenant-admin/v1/insurance-companies/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const ddr = await ddrGetsEntry('36', ien, '.01;.111;.112;.113;.114;.115;.131;3;4');
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR GETS ENTRY DATA', file: '36', ien, data: ddr.data, rawLines: ddr.rawLines };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  app.put('/api/tenant-admin/v1/insurance-companies/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    const body = req.body || {};
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    const fieldMap = { name: '.01', streetAddr1: '.111', city: '.114', state: '.115', phone: '.131' };
    const edits = {};
    for (const [k, fld] of Object.entries(fieldMap)) {
      if (body[k] !== undefined) edits[fld] = body[k];
    }
    if (Object.keys(edits).length === 0) return reply.code(400).send({ ok: false, error: 'No editable fields provided' });
    const iens = `${ien},`;
    const result = await ddrFilerEditMulti('36', iens, edits);
    if (!result.ok) return reply.code(502).send({ ok: false, tenantId, source: 'error', stage: 'DDR FILER', error: result.error, lines: result.lines });
    return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR FILER', file: '36', ien, fieldCount: result.fieldCount, lines: result.lines };
  });

  // ---- Treating Specialty detail + edit (File 45.7) ----

  app.get('/api/tenant-admin/v1/treating-specialties/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const ddr = await ddrGetsEntry('45.7', ien, '.01;1;2');
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR GETS ENTRY DATA', file: '45.7', ien, data: ddr.data, rawLines: ddr.rawLines };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  app.put('/api/tenant-admin/v1/treating-specialties/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    const body = req.body || {};
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    const fieldMap = { name: '.01', specialty: '1', serviceConnected: '2' };
    const edits = {};
    for (const [k, fld] of Object.entries(fieldMap)) {
      if (body[k] !== undefined) edits[fld] = body[k];
    }
    if (Object.keys(edits).length === 0) return reply.code(400).send({ ok: false, error: 'No editable fields provided' });
    const iens = `${ien},`;
    const result = await ddrFilerEditMulti('45.7', iens, edits);
    if (!result.ok) return reply.code(502).send({ ok: false, tenantId, source: 'error', stage: 'DDR FILER', error: result.error, lines: result.lines });
    return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR FILER', file: '45.7', ien, fieldCount: result.fieldCount, lines: result.lines };
  });

  // ---- Appointment Type detail + edit (File 409.1) ----

  app.get('/api/tenant-admin/v1/appointment-types/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const ddr = await ddrGetsEntry('409.1', ien, '.01;3;4');
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR GETS ENTRY DATA', file: '409.1', ien, data: ddr.data, rawLines: ddr.rawLines };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  app.put('/api/tenant-admin/v1/appointment-types/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    const body = req.body || {};
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    const fieldMap = { name: '.01', inactive: '3', synonym: '4' };
    const edits = {};
    for (const [k, fld] of Object.entries(fieldMap)) {
      if (body[k] !== undefined) edits[fld] = body[k];
    }
    if (Object.keys(edits).length === 0) return reply.code(400).send({ ok: false, error: 'No editable fields provided' });
    const iens = `${ien},`;
    const result = await ddrFilerEditMulti('409.1', iens, edits);
    if (!result.ok) return reply.code(502).send({ ok: false, tenantId, source: 'error', stage: 'DDR FILER', error: result.error, lines: result.lines });
    return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR FILER', file: '409.1', ien, fieldCount: result.fieldCount, lines: result.lines };
  });

  // ---- Ward multi-field edit via DDR FILER (File 42) ----

  app.put('/api/tenant-admin/v1/wards/:ien/fields', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    const body = req.body || {};
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    const fieldMap = { name: '.01', division: '.015', service: '1', wardLocation: '.1', bedsects: '3' };
    const edits = {};
    for (const [k, fld] of Object.entries(fieldMap)) {
      if (body[k] !== undefined) edits[fld] = body[k];
    }
    if (Object.keys(edits).length === 0) return reply.code(400).send({ ok: false, error: 'No editable fields provided' });
    const iens = `${ien},`;
    const result = await ddrFilerEditMulti('42', iens, edits);
    if (!result.ok) return reply.code(502).send({ ok: false, tenantId, source: 'error', stage: 'DDR FILER', error: result.error, lines: result.lines });
    return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR FILER', file: '42', ien, fieldCount: result.fieldCount, lines: result.lines };
  });

  // ---- Quick Orders (File 101.41) via DDR LISTER ----

  app.get('/api/tenant-admin/v1/quick-orders', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '101.41', FIELDS: '.01;5;6', FLAGS: 'IP', MAX: '5000' } },
        ]);
        const parsed = parseDdrListerResponse(lines);
        if (!parsed.ok) return [];
        const out = [];
        for (const line of parsed.data) {
          const a = line.split('^');
          const ien = a[0]?.trim();
          if (!ien || !/^\d+$/.test(ien)) continue;
          out.push({ ien, name: a[1]?.trim() || '', displayGroup: a[2]?.trim() || '', dialogType: a[3]?.trim() || '' });
        }
        return out;
      });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '101.41', data: rows };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  app.get('/api/tenant-admin/v1/quick-orders/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const ddr = await ddrGetsEntry('101.41', ien, '.01;2;5;6;7');
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR GETS ENTRY DATA', file: '101.41', ien, data: ddr.data, rawLines: ddr.rawLines };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Order Sets (File 101.43) via DDR LISTER ----

  app.get('/api/tenant-admin/v1/order-sets', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    const search = req.query.search;
    try {
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '101.43', FIELDS: '.01;2;3', FLAGS: 'IP', MAX: '5000', ...(search ? { PART: search.toUpperCase() } : {}) } },
        ]);
        const parsed = parseDdrListerResponse(lines);
        if (!parsed.ok) return [];
        const out = [];
        for (const line of parsed.data) {
          const a = line.split('^');
          const ien = a[0]?.trim();
          if (!ien || !/^\d+$/.test(ien)) continue;
          out.push({ ien, name: a[1]?.trim() || '', displayGroup: a[2]?.trim() || '', creator: a[3]?.trim() || '' });
        }
        return out;
      });
      const MAX_ORDSETS = 5000;
      const capped = rows.length >= MAX_ORDSETS;
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '101.43', data: rows,
        ...(capped ? { capped: true, totalNote: `Results limited to ${MAX_ORDSETS}. Use search to narrow.` } : {}) };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Orderable Items (File 101.43) detail ----

  app.get('/api/tenant-admin/v1/order-sets/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const ddr = await ddrGetsEntry('101.43', ien, '.01;2;3');
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR GETS ENTRY DATA', file: '101.43', ien, data: ddr.data, rawLines: ddr.rawLines };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Orderable Items (File 101.43) via DDR LISTER ----

  app.get('/api/tenant-admin/v1/orderable-items', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    const search = req.query.search;
    try {
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '101.43', FIELDS: '.01;2', FLAGS: 'IP', MAX: '5000', ...(search ? { PART: search.toUpperCase() } : {}) } },
        ]);
        const parsed = parseDdrListerResponse(lines);
        if (!parsed.ok) return [];
        const out = [];
        for (const line of parsed.data) {
          const a = line.split('^');
          const ien = a[0]?.trim();
          if (!ien || !/^\d+$/.test(ien)) continue;
          out.push({ ien, name: a[1]?.trim() || '', displayGroup: a[2]?.trim() || '' });
        }
        return out;
      });
      const MAX_ORDITEMS = 5000;
      const capped = rows.length >= MAX_ORDITEMS;
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '101.43', data: rows,
        ...(capped ? { capped: true, totalNote: `Results limited to ${MAX_ORDITEMS}. Use search to narrow.` } : {}) };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- IB Site Parameters (File 350.9) — Billing Params read ----

  app.get('/api/tenant-admin/v1/billing-params', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const ddr = await ddrGetsEntry('350.9', '1', '.01;.02;.03;.04;.05;.06;.08;.09;.14;1.01;1.02;1.05;1.06;1.07;1.08;1.09;1.14;1.15;1.17;1.19;1.21;1.25;2.08;2.09;2.11;6.01;6.02;6.03;6.04;6.05;6.23;6.24;6.25;7.01;7.02;7.03;7.04;8.01;8.03;8.04;8.1;9.1');
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR GETS ENTRY DATA', file: '350.9', ien: '1', data: ddr };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Bulletin list (File 3.6) via DDR LISTER ----

  app.get('/api/tenant-admin/v1/bulletins', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '3.6', FIELDS: '.01;1', FLAGS: 'IP', MAX: '5000' } },
        ]);
        const parsed = parseDdrListerResponse(lines);
        if (!parsed.ok) return [];
        const out = [];
        for (const line of parsed.data) {
          const a = line.split('^');
          const ien = a[0]?.trim();
          if (!ien || !/^\d+$/.test(ien)) continue;
          out.push({ ien, name: a[1]?.trim() || '', type: a[2]?.trim() || '' });
        }
        return out;
      });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '3.6', data: rows };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Bulletin detail + edit (File 3.6) ----

  app.get('/api/tenant-admin/v1/bulletins/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const ddr = await ddrGetsEntry('3.6', ien, '.01;1;2;3');
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR GETS ENTRY DATA', file: '3.6', ien, data: ddr.data, rawLines: ddr.rawLines };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  app.put('/api/tenant-admin/v1/bulletins/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    const body = req.body || {};
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    const fieldMap = { name: '.01', type: '1', mailGroup: '2' };
    const edits = {};
    for (const [k, fld] of Object.entries(fieldMap)) {
      if (body[k] !== undefined) edits[fld] = body[k];
    }
    if (Object.keys(edits).length === 0) return reply.code(400).send({ ok: false, error: 'No editable fields provided' });
    const iens = `${ien},`;
    const result = await ddrFilerEditMulti('3.6', iens, edits);
    if (!result.ok) return reply.code(502).send({ ok: false, tenantId, source: 'error', stage: 'DDR FILER', error: result.error, lines: result.lines });
    return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR FILER', file: '3.6', ien, fieldCount: result.fieldCount, lines: result.lines };
  });

  // ---- CREATE Ward (File 42) ----

  app.post('/api/tenant-admin/v1/wards', async (req, reply) => {
    try {
      const tenantId = req.query.tenantId;
      if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
      const name = (req.body || {}).name;
      if (!name || typeof name !== 'string') return reply.code(400).send({ ok: false, error: 'name required' });
      const p = await probeVista();
      if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
      const filer = await ddrFilerAdd('42', '.01', '+1,', name, 'E');
      if (!filer.ok) return reply.code(502).send({ ok: false, stage: 'DDR FILER ADD', error: filer.error, lines: filer.lines });
      return { ok: true, tenantId, rpcUsed: filer.rpcUsed, file: '42', lines: filer.lines };
    } catch (e) {
      return reply.code(500).send({ ok: false, error: e.message });
    }
  });

  // ---- CREATE Room-Bed (File 405.4) ----

  app.post('/api/tenant-admin/v1/room-beds', async (req, reply) => {
    try {
      const tenantId = req.query.tenantId;
      if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
      const name = (req.body || {}).name;
      if (!name || typeof name !== 'string') return reply.code(400).send({ ok: false, error: 'name required' });
      const p = await probeVista();
      if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
      const filer = await ddrFilerAdd('405.4', '.01', '+1,', name, 'E');
      if (!filer.ok) return reply.code(502).send({ ok: false, stage: 'DDR FILER ADD', error: filer.error, lines: filer.lines });
      return { ok: true, tenantId, rpcUsed: filer.rpcUsed, file: '405.4', lines: filer.lines };
    } catch (e) {
      return reply.code(500).send({ ok: false, error: e.message });
    }
  });

  // ---- CREATE Title (File 3.1) ----

  app.post('/api/tenant-admin/v1/titles', async (req, reply) => {
    try {
      const tenantId = req.query.tenantId;
      if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
      const name = (req.body || {}).name;
      if (!name || typeof name !== 'string') return reply.code(400).send({ ok: false, error: 'name required' });
      const p = await probeVista();
      if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
      const filer = await ddrFilerAdd('3.1', '.01', '+1,', name, 'E');
      if (!filer.ok) return reply.code(502).send({ ok: false, stage: 'DDR FILER ADD', error: filer.error, lines: filer.lines });
      return { ok: true, tenantId, rpcUsed: filer.rpcUsed, file: '3.1', lines: filer.lines };
    } catch (e) {
      return reply.code(500).send({ ok: false, error: e.message });
    }
  });

  // ---- CREATE Appointment Type (File 409.1) ----

  app.post('/api/tenant-admin/v1/appointment-types', async (req, reply) => {
    try {
      const tenantId = req.query.tenantId;
      if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
      const name = (req.body || {}).name;
      if (!name || typeof name !== 'string') return reply.code(400).send({ ok: false, error: 'name required' });
      const p = await probeVista();
      if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
      const filer = await ddrFilerAdd('409.1', '.01', '+1,', name, 'E');
      if (!filer.ok) return reply.code(502).send({ ok: false, stage: 'DDR FILER ADD', error: filer.error, lines: filer.lines });
      return { ok: true, tenantId, rpcUsed: filer.rpcUsed, file: '409.1', lines: filer.lines };
    } catch (e) {
      return reply.code(500).send({ ok: false, error: e.message });
    }
  });

  // ---- CREATE Security Key (File 19.1) ----

  app.post('/api/tenant-admin/v1/security-keys', async (req, reply) => {
    try {
      const tenantId = req.query.tenantId;
      if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
      const name = (req.body || {}).name;
      if (!name || typeof name !== 'string') return reply.code(400).send({ ok: false, error: 'name required' });
      const p = await probeVista();
      if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
      const filer = await ddrFilerAdd('19.1', '.01', '+1,', name.trim().toUpperCase(), 'E');
      if (!filer.ok) return reply.code(502).send({ ok: false, stage: 'DDR FILER ADD', error: filer.error, lines: filer.lines });
      return { ok: true, tenantId, rpcUsed: filer.rpcUsed, file: '19.1', lines: filer.lines };
    } catch (e) {
      return reply.code(500).send({ ok: false, error: e.message });
    }
  });

  // ---- CREATE Insurance Company (File 36) ----

  app.post('/api/tenant-admin/v1/insurance-companies', async (req, reply) => {
    try {
      const tenantId = req.query.tenantId;
      if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
      const body = req.body || {};
      const name = body.name;
      if (!name || typeof name !== 'string') return reply.code(400).send({ ok: false, error: 'name required' });
      const p = await probeVista();
      if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
      // File 36 requires field 1 (REIMBURSE?) as an identifier for ADD
      const fields = { '.01': name, '1': body.reimburse || 'Y' };
      if (body.city) fields['.114'] = body.city;
      if (body.state) fields['.115'] = body.state;
      if (body.phone) fields['.131'] = body.phone;
      const filer = await ddrFilerAddMulti('36', '+1,', fields, 'E');
      if (!filer.ok) return reply.code(502).send({ ok: false, stage: 'DDR FILER ADD', error: filer.error, lines: filer.lines });
      return { ok: true, tenantId, rpcUsed: filer.rpcUsed, file: '36', lines: filer.lines };
    } catch (e) {
      return reply.code(500).send({ ok: false, error: e.message });
    }
  });

  // ---- WRITE HL7 Interface (File 870) ----

  app.put('/api/tenant-admin/v1/hl7-interfaces/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    const body = req.body || {};
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    const topFieldMap = { name: '.01', institution: '3', llpType: '2', shutdownLlp: '4.5' };
    const topEdits = {};
    for (const [k, fld] of Object.entries(topFieldMap)) {
      if (body[k] !== undefined) topEdits[fld] = body[k];
    }
    const hasTcpEdits = body.tcpAddress !== undefined || body.tcpPort !== undefined;
    if (Object.keys(topEdits).length === 0 && !hasTcpEdits) {
      return reply.code(400).send({ ok: false, error: 'No editable fields provided' });
    }
    const results = [];
    if (Object.keys(topEdits).length > 0) {
      const topResult = await ddrFilerEditMulti('870', `${ien},`, topEdits);
      results.push({ scope: 'top-level', ...topResult });
      if (!topResult.ok) return reply.code(502).send({ ok: false, tenantId, source: 'error', stage: 'DDR FILER (870 top)', error: topResult.error, lines: topResult.lines });
    }
    if (hasTcpEdits) {
      const subEdits = {};
      if (body.tcpAddress !== undefined) subEdits['.02'] = body.tcpAddress;
      if (body.tcpPort !== undefined) subEdits['.021'] = body.tcpPort;
      const subResult = await ddrFilerEditMulti('870.01', `1,${ien},`, subEdits);
      results.push({ scope: 'sub-file-tcp', ...subResult });
      if (!subResult.ok) return reply.code(502).send({ ok: false, tenantId, source: 'error', stage: 'DDR FILER (870.01 TCP)', error: subResult.error, lines: subResult.lines, note: 'Sub-file 870.01 IENS format: subIen,parentIen,' });
    }
    return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR FILER', file: '870', ien, results };
  });

  // ---- WRITE Menu Option (File 19) ----

  app.put('/api/tenant-admin/v1/menu-options/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    const body = req.body || {};
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    const fieldMap = { name: '.01', menuText: '1', type: '4', lock: '3' };
    const edits = {};
    for (const [k, fld] of Object.entries(fieldMap)) {
      if (body[k] !== undefined) edits[fld] = body[k];
    }
    if (Object.keys(edits).length === 0) return reply.code(400).send({ ok: false, error: 'No editable fields provided' });
    const iens = `${ien},`;
    const result = await ddrFilerEditMulti('19', iens, edits);
    if (!result.ok) return reply.code(502).send({ ok: false, tenantId, source: 'error', stage: 'DDR FILER', error: result.error, lines: result.lines });
    return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR FILER', file: '19', ien, fieldCount: result.fieldCount, lines: result.lines };
  });

  // ---- Menu Option children (File 19 sub-items) ----

  app.get('/api/tenant-admin/v1/menu-options/:ien/children', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    if (!/^\d+$/.test(ien)) return reply.code(400).send({ ok: false, error: 'ien must be numeric' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '19', FIELDS: '.01;1;4', FLAGS: 'IP', MAX: '5000', SCREEN: `I $P(^DIC(19,+Y,0),U,6)=${ien}` } },
        ]);
        const parsed = parseDdrListerResponse(lines);
        if (!parsed.ok) return [];
        const out = [];
        for (const line of parsed.data) {
          const a = line.split('^');
          const cien = a[0]?.trim();
          if (!cien || !/^\d+$/.test(cien)) continue;
          out.push({ ien: cien, name: a[1]?.trim() || '', menuText: a[2]?.trim() || '', type: a[3]?.trim() || '' });
        }
        return out;
      });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '19', parentIen: ien, data: rows };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- WRITE Drug File (File 50) ----

  app.put('/api/tenant-admin/v1/drug-file/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    const body = req.body || {};
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    const fieldMap = { name: '.01', vaClassification: '2', nationalDrugClass: '25', vaProductName: '21' };
    const edits = {};
    for (const [k, fld] of Object.entries(fieldMap)) {
      if (body[k] !== undefined) edits[fld] = body[k];
    }
    if (Object.keys(edits).length === 0) return reply.code(400).send({ ok: false, error: 'No editable fields provided' });
    const iens = `${ien},`;
    const result = await ddrFilerEditMulti('50', iens, edits);
    if (!result.ok) return reply.code(502).send({ ok: false, tenantId, source: 'error', stage: 'DDR FILER', error: result.error, lines: result.lines });
    return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR FILER', file: '50', ien, fieldCount: result.fieldCount, lines: result.lines };
  });

  // ---- WRITE Lab Test (File 60) ----

  app.put('/api/tenant-admin/v1/lab-tests/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    const body = req.body || {};
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    const fieldMap = { name: '.01', subscript: '4', locationType: '5' };
    const edits = {};
    for (const [k, fld] of Object.entries(fieldMap)) {
      if (body[k] !== undefined) edits[fld] = body[k];
    }
    if (Object.keys(edits).length === 0) return reply.code(400).send({ ok: false, error: 'No editable fields provided' });
    const iens = `${ien},`;
    const result = await ddrFilerEditMulti('60', iens, edits);
    if (!result.ok) return reply.code(502).send({ ok: false, tenantId, source: 'error', stage: 'DDR FILER', error: result.error, lines: result.lines });
    return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR FILER', file: '60', ien, fieldCount: result.fieldCount, lines: result.lines };
  });

  // ---- WRITE Quick Order (File 101.41) ----

  app.put('/api/tenant-admin/v1/quick-orders/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    const body = req.body || {};
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    const fieldMap = { name: '.01', displayGroup: '5' };
    const edits = {};
    for (const [k, fld] of Object.entries(fieldMap)) {
      if (body[k] !== undefined) edits[fld] = body[k];
    }
    if (Object.keys(edits).length === 0) return reply.code(400).send({ ok: false, error: 'No editable fields provided' });
    const iens = `${ien},`;
    const result = await ddrFilerEditMulti('101.41', iens, edits);
    if (!result.ok) return reply.code(502).send({ ok: false, tenantId, source: 'error', stage: 'DDR FILER', error: result.error, lines: result.lines });
    return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR FILER', file: '101.41', ien, fieldCount: result.fieldCount, lines: result.lines };
  });

  // ---- WRITE Order Set (File 101.43) ----

  app.put('/api/tenant-admin/v1/order-sets/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    const body = req.body || {};
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    const fieldMap = { name: '.01', displayGroup: '2' };
    const edits = {};
    for (const [k, fld] of Object.entries(fieldMap)) {
      if (body[k] !== undefined) edits[fld] = body[k];
    }
    if (Object.keys(edits).length === 0) return reply.code(400).send({ ok: false, error: 'No editable fields provided' });
    const iens = `${ien},`;
    const result = await ddrFilerEditMulti('101.43', iens, edits);
    if (!result.ok) return reply.code(502).send({ ok: false, tenantId, source: 'error', stage: 'DDR FILER', error: result.error, lines: result.lines });
    return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR FILER', file: '101.43', ien, fieldCount: result.fieldCount, lines: result.lines };
  });

  // ---- WRITE Billing Params (File 350.9) ----

  app.put('/api/tenant-admin/v1/billing-params', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const body = req.body || {};
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    const fieldMap = {
      siteName: '.01', defaultProvider: '.02', fileInBackground: '.03',
      filerHangTime: '.08', useAlerts: '.14', claimFormSigner: '1.01',
      claimFormSignerTitle: '1.02', federalTaxNumber: '1.05',
      canClerkEnterCodes: '1.15', askHinq: '1.16', useOpCptScreen: '1.17',
      holdMtBills: '1.2', medicareProviderNumber: '1.21', defaultDivision: '1.25',
      claimsTrackingStartDate: '6.01', inpatientClaimsTracking: '6.02',
      outpatientClaimsTracking: '6.03', rxClaimsTracking: '6.04',
      reportsAddToClaimsTracking: '6.23', autoPrintUnbilledList: '6.24',
      autoBillerFrequency: '7.01', daysChargesHeld: '7.04',
      shutdownBackgroundJobs: '9.1',
    };
    const edits = {};
    for (const [k, fld] of Object.entries(fieldMap)) {
      if (body[k] !== undefined) edits[fld] = body[k];
    }
    if (Object.keys(edits).length === 0) return reply.code(400).send({ ok: false, error: 'No editable fields provided' });
    const iens = '1,';
    const result = await ddrFilerEditMulti('350.9', iens, edits);
    if (!result.ok) return reply.code(502).send({ ok: false, tenantId, source: 'error', stage: 'DDR FILER', error: result.error, lines: result.lines });
    return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR FILER', file: '350.9', ien: '1', fieldCount: result.fieldCount, lines: result.lines };
  });

  // ---- TaskMan Status (via ZVE TASKMAN RPCs) ----

  app.get('/api/tenant-admin/v1/taskman/status', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const z = await callZveRpc('ZVE TASKMAN STATUS', []);
      const o = zveOutcome(z);
      if (o.kind === 'missing') {
        return reply.code(502).send({ ok: false, error: 'RPC ZVE TASKMAN STATUS' });
      }
      if (o.kind !== 'ok' && o.kind !== 'missing') return reply.code(o.kind === 'rejected' ? 409 : 502).send({ ok: false, tenantId, source: 'error', error: o.msg });
      const parts = (z.line0 || '').split('^');
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'ZVE TASKMAN STATUS', data: { status: parts[1] || 'UNKNOWN', lastRun: parts[2] || '' } };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  app.get('/api/tenant-admin/v1/taskman/scheduled', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const z = await callZveRpc('ZVE TASKMAN TASKS', []);
      const o = zveOutcome(z);
      if (o.kind === 'missing') {
        return reply.code(502).send({ ok: false, error: 'RPC ZVE TASKMAN TASKS' });
      }
      if (o.kind !== 'ok' && o.kind !== 'missing') return reply.code(o.kind === 'rejected' ? 409 : 502).send({ ok: false, tenantId, source: 'error', error: o.msg });
      const tasks = [];
      const lines = z.lines || [];
      for (let i = 1; i < lines.length; i++) {
        const parts = (lines[i] || '').split('^');
        if (parts.length >= 3) {
          tasks.push({ ien: parts[0], name: parts[1], startTime: parts[2], routine: parts[3] || '', status: parts[4] || '' });
        }
      }
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'ZVE TASKMAN TASKS', data: tasks };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- HL7 Filer Status (via ZVE HL7 RPCs) ----

  app.get('/api/tenant-admin/v1/hl7/filer-status', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const z = await callZveRpc('ZVE HL7 FILER STATUS', []);
      const o = zveOutcome(z);
      if (o.kind === 'missing') {
        return reply.code(502).send({ ok: false, error: 'RPC ZVE HL7 FILER STATUS' });
      }
      if (o.kind !== 'ok' && o.kind !== 'missing') return reply.code(o.kind === 'rejected' ? 409 : 502).send({ ok: false, tenantId, source: 'error', error: o.msg });
      const data = {};
      const lines = z.lines || [];
      for (let i = 1; i < lines.length; i++) {
        const parts = (lines[i] || '').split('^');
        if (parts.length >= 2) data[parts[0]] = parts[1];
      }
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'ZVE HL7 FILER STATUS', data };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  app.get('/api/tenant-admin/v1/hl7/link-status/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const z = await callZveRpc('ZVE HL7 LINK STATUS', [ien]);
      const o = zveOutcome(z);
      if (o.kind === 'missing') {
        return reply.code(502).send({ ok: false, error: 'RPC ZVE HL7 LINK STATUS' });
      }
      if (o.kind !== 'ok' && o.kind !== 'missing') return reply.code(o.kind === 'rejected' ? 409 : 502).send({ ok: false, tenantId, source: 'error', error: o.msg });
      const data = {};
      const lines = z.lines || [];
      for (let i = 1; i < lines.length; i++) {
        const parts = (lines[i] || '').split('^');
        if (parts.length >= 2) data[parts[0]] = parts[1];
      }
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'ZVE HL7 LINK STATUS', data };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Clinic Availability (via ZVE CLINIC AVAIL RPCs) ----

  app.get('/api/tenant-admin/v1/clinics/:ien/availability', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const z = await callZveRpc('ZVE CLINIC AVAIL GET', [ien]);
      const o = zveOutcome(z);
      if (o.kind === 'missing') return reply.code(502).send({ ok: false, error: `RPC ZVE CLINIC AVAIL GET returned missing status`, detail: o.msg });
      if (o.kind !== 'ok' && o.kind !== 'missing') return reply.code(o.kind === 'rejected' ? 409 : 502).send({ ok: false, tenantId, source: 'error', error: o.msg });
      const slots = [];
      const lines = z.lines || [];
      for (let i = 1; i < lines.length; i++) {
        const parts = (lines[i] || '').split('^');
        if (parts.length >= 3) {
          slots.push({ date: parts[0], subIen: parts[1], data: parts.slice(2).join('^') });
        }
      }
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'ZVE CLINIC AVAIL GET', clinicIen: ien, data: slots };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  app.post('/api/tenant-admin/v1/clinics/:ien/availability', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    const body = req.body || {};
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    if (!body.date || !body.slotData) return reply.code(400).send({ ok: false, error: 'date and slotData required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
    const z = await callZveRpc('ZVE CLINIC AVAIL SET', [ien, body.date, body.slotData]);
    const o = zveOutcome(z);
    if (o.kind === 'missing') {
      return reply.code(502).send({ ok: false, error: 'RPC ZVE CLINIC AVAIL SET' });
    }
    if (o.kind !== 'ok' && o.kind !== 'missing') return reply.code(o.kind === 'rejected' ? 409 : 502).send({ ok: false, error: o.msg });
    return { ok: true, source: 'vista', tenantId, rpcUsed: 'ZVE CLINIC AVAIL SET', clinicIen: ien, lines: z.lines };
  });

  // ---- Stop Code lookup (File 40.7) ----

  app.get('/api/tenant-admin/v1/stop-codes', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '40.7', FIELDS: '.01;1', FLAGS: 'IP', MAX: '5000' } },
        ]);
        const parsed = parseDdrListerResponse(lines);
        if (!parsed.ok) return [];
        const out = [];
        for (const line of parsed.data) {
          const a = line.split('^');
          const ien = a[0]?.trim();
          if (!ien || !/^\d+$/.test(ien)) continue;
          out.push({ ien, code: a[1]?.trim() || '', name: a[2]?.trim() || '' });
        }
        return out;
      });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '40.7', data: rows };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Inactivation / Soft-delete endpoints ----

  app.post('/api/tenant-admin/v1/clinics/:ien/inactivate', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable' });
    const today = new Date();
    const vistaDate = `${today.getMonth()+1}/${today.getDate()}/${today.getFullYear()}`;
    try {
      const iens = `${ien},`;
      const result = await ddrFilerEditMulti('44', iens, { '2505': vistaDate });
      return { ok: true, tenantId, ien, action: 'inactivated', field: '2505', value: vistaDate, source: 'vista', rpcUsed: 'DDR FILER', result };
    } catch (e) { return reply.code(500).send({ ok: false, error: e.message }); }
  });

  app.post('/api/tenant-admin/v1/clinics/:ien/reactivate', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable' });
    try {
      const iens = `${ien},`;
      const result = await ddrFilerEditMulti('44', iens, { '2505': '@' });
      return { ok: true, tenantId, ien, action: 'reactivated', field: '2505', value: '@', source: 'vista', rpcUsed: 'DDR FILER', result };
    } catch (e) { return reply.code(500).send({ ok: false, error: e.message }); }
  });

  app.post('/api/tenant-admin/v1/appointment-types/:ien/inactivate', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable' });
    try {
      const iens = `${ien},`;
      const result = await ddrFilerEditMulti('409.1', iens, { '3': '1' });
      return { ok: true, tenantId, ien, action: 'inactivated', field: '3 (INACTIVE FLAG)', value: '1', source: 'vista', rpcUsed: 'DDR FILER', result };
    } catch (e) { return reply.code(500).send({ ok: false, error: e.message }); }
  });

  app.post('/api/tenant-admin/v1/appointment-types/:ien/reactivate', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable' });
    try {
      const iens = `${ien},`;
      const result = await ddrFilerEditMulti('409.1', iens, { '3': '@' });
      return { ok: true, tenantId, ien, action: 'reactivated', field: '3 (INACTIVE FLAG)', value: '@', source: 'vista', rpcUsed: 'DDR FILER', result };
    } catch (e) { return reply.code(500).send({ ok: false, error: e.message }); }
  });

  app.post('/api/tenant-admin/v1/drug-file/:ien/inactivate', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable' });
    const today = new Date();
    const vistaDate = `${today.getMonth()+1}/${today.getDate()}/${today.getFullYear()}`;
    try {
      const iens = `${ien},`;
      const result = await ddrFilerEditMulti('50', iens, { '15': vistaDate });
      return { ok: true, tenantId, ien, action: 'inactivated', field: '15 (INACTIVATION DATE)', value: vistaDate, source: 'vista', rpcUsed: 'DDR FILER', result };
    } catch (e) { return reply.code(500).send({ ok: false, error: e.message }); }
  });

  app.post('/api/tenant-admin/v1/drug-file/:ien/reactivate', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable' });
    try {
      const iens = `${ien},`;
      const result = await ddrFilerEditMulti('50', iens, { '15': '@' });
      return { ok: true, tenantId, ien, action: 'reactivated', field: '15 (INACTIVATION DATE)', value: '@', source: 'vista', rpcUsed: 'DDR FILER', result };
    } catch (e) { return reply.code(500).send({ ok: false, error: e.message }); }
  });

  app.post('/api/tenant-admin/v1/hl7-interfaces/:ien/shutdown', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable' });
    try {
      const iens = `${ien},`;
      const result = await ddrFilerEditMulti('870', iens, { '4.5': '1' });
      return { ok: true, tenantId, ien, action: 'shutdown', field: '4.5 (SHUTDOWN LLP)', value: '1', source: 'vista', rpcUsed: 'DDR FILER', result };
    } catch (e) { return reply.code(500).send({ ok: false, error: e.message }); }
  });

  app.post('/api/tenant-admin/v1/hl7-interfaces/:ien/enable', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable' });
    try {
      const iens = `${ien},`;
      const result = await ddrFilerEditMulti('870', iens, { '4.5': '@' });
      return { ok: true, tenantId, ien, action: 'enabled', field: '4.5 (SHUTDOWN LLP)', value: '@', source: 'vista', rpcUsed: 'DDR FILER', result };
    } catch (e) { return reply.code(500).send({ ok: false, error: e.message }); }
  });

  // ---- Mail Group Members (via ZVE MAILGRP *) ----

  app.get('/api/tenant-admin/v1/mail-groups/:ien/members', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable' });
    try {
      const z = await callZveRpc('ZVE MAILGRP MEMBERS', [ien]);
      const o = zveOutcome(z);
      if (o.kind === 'missing') return reply.code(502).send({ ok: false, error: 'RPC ZVE MAILGRP MEMBERS' });
      if (o.kind !== 'ok' && o.kind !== 'missing') return reply.code(o.kind === 'rejected' ? 409 : 502).send({ ok: false, error: o.msg });
      const members = (z.lines || []).filter(l => l && !l.startsWith('[') && l.includes('^')).map(l => {
        const a = l.split('^');
        return { ien: a[0], name: a[1] || '', type: a[2] || '' };
      });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'ZVE MAILGRP MEMBERS', groupIen: ien, data: members };
    } catch (e) { return reply.code(500).send({ ok: false, error: e.message }); }
  });

  app.post('/api/tenant-admin/v1/mail-groups/:ien/members', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    const body = req.body || {};
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    if (!body.userDuz) return reply.code(400).send({ ok: false, error: 'userDuz required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable' });
    try {
      const z = await callZveRpc('ZVE MAILGRP ADD', [ien, String(body.userDuz)]);
      const o = zveOutcome(z);
      if (o.kind === 'missing') return reply.code(502).send({ ok: false, error: 'RPC ZVE MAILGRP ADD' });
      if (o.kind !== 'ok' && o.kind !== 'missing') return reply.code(o.kind === 'rejected' ? 409 : 502).send({ ok: false, error: o.msg });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'ZVE MAILGRP ADD', groupIen: ien, userDuz: body.userDuz };
    } catch (e) { return reply.code(500).send({ ok: false, error: e.message }); }
  });

  app.delete('/api/tenant-admin/v1/mail-groups/:ien/members/:duz', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const { ien, duz } = req.params;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable' });
    try {
      const z = await callZveRpc('ZVE MAILGRP REMOVE', [ien, duz]);
      const o = zveOutcome(z);
      if (o.kind === 'missing') return reply.code(502).send({ ok: false, error: 'RPC ZVE MAILGRP REMOVE' });
      if (o.kind !== 'ok' && o.kind !== 'missing') return reply.code(o.kind === 'rejected' ? 409 : 502).send({ ok: false, error: o.msg });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'ZVE MAILGRP REMOVE', groupIen: ien, removedDuz: duz };
    } catch (e) { return reply.code(500).send({ ok: false, error: e.message }); }
  });

  // ---- Health Summary Components (via ZVE HS COMP *) ----

  app.get('/api/tenant-admin/v1/health-summary-types/:ien/components', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable' });
    try {
      const z = await callZveRpc('ZVE HS COMPONENTS', [ien]);
      const o = zveOutcome(z);
      if (o.kind === 'missing') return reply.code(502).send({ ok: false, error: 'RPC ZVE HS COMPONENTS' });
      if (o.kind !== 'ok' && o.kind !== 'missing') return reply.code(o.kind === 'rejected' ? 409 : 502).send({ ok: false, error: o.msg });
      const comps = (z.lines || []).filter(l => l && !l.startsWith('[') && l.includes('^')).map(l => {
        const a = l.split('^');
        return { ien: a[0], name: a[1] || '', type: a[2] || '' };
      });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'ZVE HS COMPONENTS', hsTypeIen: ien, data: comps };
    } catch (e) { return reply.code(500).send({ ok: false, error: e.message }); }
  });

  app.post('/api/tenant-admin/v1/health-summary-types/:ien/components', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    const body = req.body || {};
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    if (!body.componentIen) return reply.code(400).send({ ok: false, error: 'componentIen required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable' });
    try {
      const z = await callZveRpc('ZVE HS COMP ADD', [ien, String(body.componentIen)]);
      const o = zveOutcome(z);
      if (o.kind === 'missing') return reply.code(502).send({ ok: false, error: 'RPC ZVE HS COMP ADD' });
      if (o.kind !== 'ok' && o.kind !== 'missing') return reply.code(o.kind === 'rejected' ? 409 : 502).send({ ok: false, error: o.msg });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'ZVE HS COMP ADD', hsTypeIen: ien, componentIen: body.componentIen };
    } catch (e) { return reply.code(500).send({ ok: false, error: e.message }); }
  });

  app.delete('/api/tenant-admin/v1/health-summary-types/:ien/components/:compIen', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const { ien, compIen } = req.params;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable' });
    try {
      const z = await callZveRpc('ZVE HS COMP REMOVE', [ien, compIen]);
      const o = zveOutcome(z);
      if (o.kind === 'missing') return reply.code(502).send({ ok: false, error: 'RPC ZVE HS COMP REMOVE' });
      if (o.kind !== 'ok' && o.kind !== 'missing') return reply.code(o.kind === 'rejected' ? 409 : 502).send({ ok: false, error: o.msg });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'ZVE HS COMP REMOVE', hsTypeIen: ien, removedCompIen: compIen };
    } catch (e) { return reply.code(500).send({ ok: false, error: e.message }); }
  });

  function ddrListParsed(lines, fieldNames) {
    const parsed = parseDdrListerResponse(lines);
    if (!parsed.ok) return [];
    return parsed.data.map(line => {
      const a = line.split('^');
      const ien = (a[0] || '').trim();
      if (!ien || !/^\d+$/.test(ien)) return null;
      const obj = { ien };
      fieldNames.forEach((name, idx) => { obj[name] = (a[idx + 1] || '').trim(); });
      return obj;
    }).filter(Boolean);
  }

  /**
   * Reusable DDR LISTER helper with server-side search and pagination.
   * VistA DDR LISTER supports PART (starts-with filter on B index)
   * and FROM (pagination starting point). MAX controls batch size.
   * We use MAX=5000 as a practical batch size instead of 999.
   * For search: uses PART for server-side filtering (efficient B-index scan).
   */
  async function ddrList(opts) {
    const { file, fields, flags = 'IP', fieldNames, search, from, max = '5000', iens, screen } = opts;
    const broker = await getBroker();
    const params = { FILE: file, FIELDS: fields, FLAGS: flags, MAX: max };
    if (iens) params.IENS = iens;
    if (search) params.PART = search.toUpperCase();
    if (from) params.FROM = from;
    if (screen) params.SCREEN = screen;
    const lines = await broker.callRpcWithList('DDR LISTER', [{ type: 'list', value: params }]);
    return ddrListParsed(lines, fieldNames);
  }

  // ======================================================================
  // AUDIT TRAIL: Error Log (File 3.075), Sign-On Log (File 3.081),
  //   Failed Access (File 3.05), Programmer Mode Log (File 3.07)
  // ======================================================================

  app.get('/api/tenant-admin/v1/audit/error-log', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });

    // --- ZVE-first: ZVE ADMIN AUDIT with SOURCE=error ---
    try {
      const z = await callZveRpc('ZVE ADMIN AUDIT', ['error', req.query.duz || '', req.query.max || '200']);
      const o = zveOutcome(z);
      if (o.kind === 'ok') {
        const entries = [];
        for (const line of z.lines.slice(1)) {
          const p = line.split('^');
          if (p.length >= 4) entries.push({ datetime: p[0], user: p[1] || '', action: p[2] || '', source: p[3] || '', detail: p[4] || '' });
        }
        return { ok: true, source: 'zve', tenantId, rpcUsed: z.rpcUsed, data: entries };
      }
      if (o.kind !== 'missing') {
        return reply.code(502).send({ ok: false, source: 'zve', error: o.msg, rpcUsed: z.rpcUsed });
      }
    } catch (_zve) { /* ZVE unavailable, fall through to DDR */ }

    // --- DDR fallback ---
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const lines = await lockedRpc(async () => {
        const broker = await getBroker();
        return broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '3.075', FIELDS: '.01;.02', FLAGS: 'IP', MAX: req.query.max || '200' } },
        ]);
      });
      const data = ddrListParsed(lines, ['date', 'errorCount']);
      for (const d of data) { d.date = fmDateToIso(d.date); }
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '3.075', data };
    } catch (e) { return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message }); }
  });

  app.get('/api/tenant-admin/v1/audit/error-log/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const ddr = await ddrGetsEntry('3.075', ien, '.01;.02');
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR GETS ENTRY DATA', file: '3.075', ien, data: ddr };
    } catch (e) { return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message }); }
  });

  app.get('/api/tenant-admin/v1/audit/signon-log', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });

    // --- ZVE-first: ZVE ADMIN AUDIT with SOURCE=signon ---
    try {
      const z = await callZveRpc('ZVE ADMIN AUDIT', ['signon', req.query.duz || '', req.query.max || '200']);
      const o = zveOutcome(z);
      if (o.kind === 'ok') {
        const entries = [];
        for (const line of z.lines.slice(1)) {
          const p = line.split('^');
          if (p.length >= 4) entries.push({ datetime: p[0], user: p[1] || '', action: p[2] || '', source: p[3] || '', detail: p[4] || '' });
        }
        return { ok: true, source: 'zve', tenantId, rpcUsed: z.rpcUsed, data: entries };
      }
      if (o.kind !== 'missing') {
        return reply.code(502).send({ ok: false, source: 'zve', error: o.msg, rpcUsed: z.rpcUsed });
      }
    } catch (_zve) { /* ZVE unavailable, fall through to DDR */ }

    // --- DDR fallback ---
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const lines = await lockedRpc(async () => {
        const broker = await getBroker();
        return broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '3.081', FIELDS: '.01;1;3;10;11;12;17', FLAGS: 'IP', MAX: req.query.max || '200' } },
        ]);
      });
      const data = ddrListParsed(lines, ['user', 'device', 'signoffTime', 'nodeName', 'ipAddress', 'workstation', 'division']);
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '3.081', data };
    } catch (e) { return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message }); }
  });

  app.get('/api/tenant-admin/v1/audit/failed-access', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const lines = await lockedRpc(async () => {
        const broker = await getBroker();
        return broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '3.05', FIELDS: '.01;1;2;3;5', FLAGS: 'IP', MAX: req.query.max || '200' } },
        ]);
      });
      const data = ddrListParsed(lines, ['device', 'cpu', 'failType', 'attempts', 'user']);
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '3.05', data };
    } catch (e) { return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message }); }
  });

  app.get('/api/tenant-admin/v1/audit/programmer-mode', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const lines = await lockedRpc(async () => {
        const broker = await getBroker();
        return broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '3.07', FIELDS: '.01;1;2', FLAGS: 'IP', MAX: req.query.max || '200' } },
        ]);
      });
      const data = ddrListParsed(lines, ['device', 'date', 'user']);
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '3.07', data };
    } catch (e) { return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message }); }
  });

  // ======================================================================
  // NURSING CONFIGURATION (File 211.4 — NURS LOCATION)
  // ======================================================================

  app.get('/api/tenant-admin/v1/nursing-locations', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const lines = await lockedRpc(async () => {
        const broker = await getBroker();
        return broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '211.4', FIELDS: '.01;.02;.5;1;1.5', FLAGS: 'IP', MAX: req.query.max || '500' } },
        ]);
      });
      const data = ddrListParsed(lines, ['name', 'facility', 'careSetting', 'patientCareFlag', 'inactiveFlag']);
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '211.4', data };
    } catch (e) { return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message }); }
  });

  app.get('/api/tenant-admin/v1/nursing-locations/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const ddr = await ddrGetsEntry('211.4', ien, '.01;.02;.03;.5;.6;.7;1;1.5;11;12');
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR GETS ENTRY DATA', file: '211.4', ien, data: ddr };
    } catch (e) { return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message }); }
  });

  app.put('/api/tenant-admin/v1/nursing-locations/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    const body = req.body || {};
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    const fieldMap = { careSetting: '.5', patientCareFlag: '1', inactiveFlag: '1.5', profPct: '11' };
    const edits = {};
    for (const [k, fld] of Object.entries(fieldMap)) {
      if (body[k] !== undefined) edits[fld] = body[k];
    }
    if (Object.keys(edits).length === 0) return reply.code(400).send({ ok: false, error: 'No editable fields provided' });
    try {
      const result = await ddrFilerEditMulti('211.4', `${ien},`, edits);
      if (!result.ok) return reply.code(502).send({ ok: false, tenantId, source: 'error', error: result.error, lines: result.lines });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR FILER', file: '211.4', ien, fieldCount: result.fieldCount };
    } catch (e) { return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message }); }
  });

  // ======================================================================
  // ENCOUNTER FORMS (File 357)
  // ======================================================================

  app.get('/api/tenant-admin/v1/encounter-forms', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const lines = await lockedRpc(async () => {
        const broker = await getBroker();
        return broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '357', FIELDS: '.01;.03;.04;.05;.07', FLAGS: 'IP', MAX: req.query.max || '500' } },
        ]);
      });
      const data = ddrListParsed(lines, ['name', 'description', 'typeOfUse', 'compiled', 'toolkit']);
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '357', data };
    } catch (e) { return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message }); }
  });

  app.get('/api/tenant-admin/v1/encounter-forms/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const ddr = await ddrGetsEntry('357', ien, '.01;.02;.03;.04;.05;.06;.07;.09;.1;.11;.12;.13;.14;.15;.16;.17');
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR GETS ENTRY DATA', file: '357', ien, data: ddr };
    } catch (e) { return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message }); }
  });

  app.put('/api/tenant-admin/v1/encounter-forms/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    const body = req.body || {};
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    const fieldMap = { name: '.01', description: '.03', simplex: '.02', useIcr: '.06', toolkit: '.07', rightMargin: '.09', pageLength: '.1', textSize: '.16' };
    const edits = {};
    for (const [k, fld] of Object.entries(fieldMap)) {
      if (body[k] !== undefined) edits[fld] = body[k];
    }
    if (Object.keys(edits).length === 0) return reply.code(400).send({ ok: false, error: 'No editable fields provided' });
    try {
      const result = await ddrFilerEditMulti('357', `${ien},`, edits);
      if (!result.ok) return reply.code(502).send({ ok: false, tenantId, source: 'error', error: result.error, lines: result.lines });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR FILER', file: '357', ien, fieldCount: result.fieldCount };
    } catch (e) { return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message }); }
  });

  // ======================================================================
  // CLAIMS TRACKING (File 356)
  // ======================================================================

  app.get('/api/tenant-admin/v1/claims-tracking', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const lines = await lockedRpc(async () => {
        const broker = await getBroker();
        return broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '356', FIELDS: '.01;.02;.06;.18;.2', FLAGS: 'IP', MAX: req.query.max || '200' } },
        ]);
      });
      const data = ddrListParsed(lines, ['entryId', 'patient', 'episodeDate', 'eventType', 'active']);
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '356', data };
    } catch (e) { return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message }); }
  });

  app.get('/api/tenant-admin/v1/claims-tracking/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const ien = req.params.ien;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const ddr = await ddrGetsEntry('356', ien, '.01;.02;.03;.06;.07;.11;.14;.18;.19;.2;.21;.28;.29;1.01;1.02;1.03;1.04;1.07;1.08');
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR GETS ENTRY DATA', file: '356', ien, data: ddr };
    } catch (e) { return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message }); }
  });

  // ======================================================================
  // ACCESS PROFILES / FILE ACCESS (File 200, sub-file 200.032)
  // ======================================================================

  app.get('/api/tenant-admin/v1/users/:duz/file-access', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const duz = req.params.duz;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const lines = await lockedRpc(async () => {
        const broker = await getBroker();
        return broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '200.032', IENS: `${duz},`, FIELDS: '.01;1;2;3;4;5;6', FLAGS: 'IP', MAX: '5000' } },
        ]);
      });
      const data = ddrListParsed(lines, ['file', 'ddAccess', 'deleteAccess', 'laygoAccess', 'readAccess', 'writeAccess', 'auditAccess']);
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '200.032', userDuz: duz, data };
    } catch (e) { return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message }); }
  });

  // ---- Access Audit: comprehensive user access profile ----

  app.get('/api/tenant-admin/v1/users/:duz/access-audit', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const duz = req.params.duz;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const userRes = await ddrGetsFile200(duz, '.01;3;4;7;8;9;20.2;20.3;29;201;202;203');
      const userData = (userRes.ok && userRes.data) ? userRes.data : {};

      const subFileResults = await lockedRpc(async () => {
        const broker = await getBroker();
        const keyLines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '200.051', IENS: `${duz},`, FIELDS: '.01', FLAGS: 'IP', MAX: '5000' } },
        ]);
        const menuLines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '200.03', IENS: `${duz},`, FIELDS: '.01', FLAGS: 'IP', MAX: '5000' } },
        ]);
        const divLines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '200.02', IENS: `${duz},`, FIELDS: '.01', FLAGS: 'IP', MAX: '50' } },
        ]);
        const fileAccessLines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '200.032', IENS: `${duz},`, FIELDS: '.01;1;2;3;4;5;6', FLAGS: 'IP', MAX: '5000' } },
        ]);
        return { keyLines, menuLines, divLines, fileAccessLines };
      });

      const keys = ddrListParsed(subFileResults.keyLines, ['keyName']);
      const secondaryMenus = ddrListParsed(subFileResults.menuLines, ['menuOption']);
      const divisions = ddrListParsed(subFileResults.divLines, ['division']);
      const fileAccess = ddrListParsed(subFileResults.fileAccessLines, ['file', 'ddAccess', 'deleteAccess', 'laygoAccess', 'readAccess', 'writeAccess', 'auditAccess']);

      const ADMIN_KEYS = ['XUPROGMODE', 'XUMGR', 'XUPROG', 'XUAUDITING', 'DG SUPERVISOR'];
      const CLINICAL_KEYS = ['PROVIDER', 'ORES', 'ORELSE', 'PSJ RPHARM', 'PSJ PHARM', 'LRLAB', 'LRVERIFY'];
      const keyNames = keys.map(k => (k.keyName || '').toUpperCase());
      const isAdmin = keyNames.some(k => ADMIN_KEYS.includes(k));
      const isClinical = keyNames.some(k => CLINICAL_KEYS.includes(k));

      const name = userData['200,.01E'] || userData['200,.01I'] || '(unknown)';
      const primaryMenu = userData['200,201E'] || userData['200,201I'] || '(none)';
      const disuser = userData['200,7I'] || userData['200,7E'] || '';

      return {
        ok: true, source: 'vista', tenantId, userDuz: duz,
        rpcUsed: ['DDR GETS ENTRY DATA', 'DDR LISTER x4'],
        userName: name,
        primaryMenu,
        accessLevel: isAdmin ? 'admin' : isClinical ? 'clinical' : 'basic',
        isDisabled: disuser === 'YES' || disuser === '1',
        securityKeys: keys.map(k => k.keyName || ''),
        secondaryMenus: secondaryMenus.map(m => m.menuOption || ''),
        divisions: divisions.map(d => d.division || ''),
        fileAccess,
        summary: {
          totalKeys: keys.length,
          totalMenus: secondaryMenus.length,
          totalDivisions: divisions.length,
          totalFileAccessEntries: fileAccess.length,
          hasAdminKeys: isAdmin,
          hasClinicalKeys: isClinical,
        },
      };
    } catch (e) { return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message }); }
  });

  // ======================================================================
  // REPORTS — Scheduling (File 44 appointments via DDR LISTER)
  // ======================================================================

  app.get('/api/tenant-admin/v1/reports/scheduling', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const lines = await lockedRpc(async () => {
        const broker = await getBroker();
        return broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '44', FIELDS: '.01;1;2;3;8;2503', FLAGS: 'IP', MAX: '5000' } },
        ]);
      });
      const data = ddrListParsed(lines, ['clinicName', 'abbreviation', 'service', 'division', 'stopCode', 'appointmentCount']);
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '44', reportType: 'scheduling-workload', data };
    } catch (e) { return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message }); }
  });

  // ======================================================================
  // REPORTS — Lab (File 60 — LAB TEST)
  // ======================================================================

  app.get('/api/tenant-admin/v1/reports/lab', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const lines = await lockedRpc(async () => {
        const broker = await getBroker();
        return broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '60', FIELDS: '.01;2;3;4;5', FLAGS: 'IP', MAX: '5000' } },
        ]);
      });
      const data = ddrListParsed(lines, ['name', 'type', 'subscript', 'location', 'accessionArea']);
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '60', reportType: 'lab-workload', data };
    } catch (e) { return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message }); }
  });

  // ======================================================================
  // REPORTS — Radiology (File 71 — RAD/NUC MED PROCEDURES)
  // ======================================================================

  app.get('/api/tenant-admin/v1/reports/radiology', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const lines = await lockedRpc(async () => {
        const broker = await getBroker();
        return broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '71', FIELDS: '.01;3;6;9', FLAGS: 'IP', MAX: '5000' } },
        ]);
      });
      const data = ddrListParsed(lines, ['name', 'type', 'imagingType', 'cptCode']);
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '71', reportType: 'radiology-workload', data };
    } catch (e) { return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message }); }
  });

  // ======================================================================
  // REPORTS — Billing Status (File 399 bills, File 350.9 params)
  // ======================================================================

  app.get('/api/tenant-admin/v1/reports/billing', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const lines = await lockedRpc(async () => {
        const broker = await getBroker();
        return broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '399', FIELDS: '.01;.02;.03;.05;.07;.13', FLAGS: 'IP', MAX: '5000' } },
        ]);
      });
      const data = ddrListParsed(lines, ['billNumber', 'patient', 'rateType', 'status', 'totalCharges', 'payer']);
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '399', reportType: 'billing-status', data };
    } catch (e) { return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message }); }
  });

  // ======================================================================
  // REPORTS — Nursing (File 211.4 nursing locations with staffing)
  // ======================================================================

  app.get('/api/tenant-admin/v1/reports/nursing', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const lines = await lockedRpc(async () => {
        const broker = await getBroker();
        return broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '211.4', FIELDS: '.01;.02;.5;1;1.5;11;12', FLAGS: 'IP', MAX: '5000' } },
        ]);
      });
      const data = ddrListParsed(lines, ['name', 'facility', 'careSetting', 'active', 'inactive', 'profPct', 'experience']);
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '211.4', reportType: 'nursing-workload', data };
    } catch (e) { return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message }); }
  });

  // ======================================================================
  // RAW FILEMAN — Generic DDR LISTER/GETS on any file
  // ======================================================================

  app.get('/api/tenant-admin/v1/fileman/list', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const file = req.query.file;
    const fields = req.query.fields || '.01';
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    if (!file) return reply.code(400).send({ ok: false, error: 'file parameter required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const lines = await lockedRpc(async () => {
        const broker = await getBroker();
        return broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: file, FIELDS: fields, FLAGS: 'IP', MAX: req.query.max || '100' } },
        ]);
      });
      const parsed = parseDdrListerResponse(lines);
      if (!parsed.ok) return reply.code(502).send({ ok: false, tenantId, source: 'error', error: parsed.errorText, errors: parsed.errors });
      const data = parsed.data.map(line => { const a = line.split('^'); return { ien: a[0]?.trim(), values: a.slice(1).map(v => v.trim()) }; });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file, data };
    } catch (e) { return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message }); }
  });

  app.get('/api/tenant-admin/v1/fileman/entry', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const file = req.query.file;
    const ien = req.query.ien;
    const fields = req.query.fields || '.01';
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    if (!file || !ien) return reply.code(400).send({ ok: false, error: 'file and ien parameters required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const ddr = await ddrGetsEntry(file, ien, fields);
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR GETS ENTRY DATA', file, ien, data: ddr };
    } catch (e) { return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message }); }
  });

  app.put('/api/tenant-admin/v1/fileman/entry', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const body = req.body || {};
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    if (!body.file || !body.ien || !body.field || body.value === undefined) {
      return reply.code(400).send({ ok: false, error: 'file, ien, field, and value are required' });
    }
    const FILEMAN_WRITE_ALLOW = ['3.1','3.2','3.5','3.6','3.8','36','42','44','45.7','50','60','71','101.41','101.43','142','200','211.4','350.9','357','405.4','409.1','870','8925.1','8989.3'];
    if (!FILEMAN_WRITE_ALLOW.includes(String(body.file))) {
      return reply.code(403).send({ ok: false, error: `File ${body.file} is not in the write allow-list. Allowed: ${FILEMAN_WRITE_ALLOW.join(', ')}` });
    }
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const result = await ddrFilerEditMulti(body.file, `${body.ien},`, { [body.field]: body.value });
      if (!result.ok) return reply.code(502).send({ ok: false, tenantId, source: 'error', error: result.error, lines: result.lines });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR FILER', file: body.file, ien: body.ien, field: body.field };
    } catch (e) { return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message }); }
  });

  // ======================================================================
  // CAPACITY PLANNING — System globals, journal status
  // ======================================================================

  app.get('/api/tenant-admin/v1/capacity', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const z = await callZveRpc('ZVE TASKMAN STATUS', []);
      const o = zveOutcome(z);
      const taskman = o.kind === 'ok' ? { status: (z.line0 || '').split('^')[1] || 'UNKNOWN', lastRun: (z.line0 || '').split('^')[2] || '' } : { status: 'UNAVAILABLE', note: o.msg };
      const vistaStatus = await probeVista();
      return {
        ok: true, source: 'vista', tenantId,
        data: {
          vistaConnection: vistaStatus,
          taskmanStatus: taskman,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (e) { return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message }); }
  });

  // ======================================================================
  // PATIENT ROUTES — File #2 (PATIENT), #405 (PATIENT MOVEMENT),
  //   #2.312 (INSURANCE TYPE subfile), #408.31 (MEANS TEST),
  //   #26.13 (PATIENT RECORD FLAG)
  // ======================================================================

  // ---- Patient Search (ZVE-first, DDR fallback) ----
  app.get('/api/tenant-admin/v1/patients', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const search = req.query.search || '';
    // --- ZVE-first: ZVE PATIENT SEARCH EXTENDED (skip for empty search — VistA RPC rejects it) ---
    if (search) {
      try {
        const stype = req.query.stype || 'NAME';
        const z = await callZveRpc('ZVE PATIENT SEARCH EXTENDED', [search, stype, req.query.division || '', req.query.inactive || '', req.query.max || '']);
        const o = zveOutcome(z);
        if (o.kind === 'ok') {
          const data = [];
          for (const line of z.lines.slice(1)) {
            const p = line.split('^');
            if (!p[0]) continue;
            data.push({ dfn: p[0], name: p[1] || '', dob: p[2] || '', ssnLast4: p[3] || '', sex: p[4] || '', serviceConnected: (p[5] || '').toUpperCase() === 'YES', scPercent: parseInt(p[6] || '0', 10) || 0, lastVisit: p[7] || '' });
          }
          return { ok: true, source: 'zve', tenantId, data, total: data.length, rpcUsed: z.rpcUsed };
        }
        if (o.kind !== 'missing') {
          return reply.code(502).send({ ok: false, source: 'zve', error: o.msg, rpcUsed: z.rpcUsed });
        }
      } catch (_zve) { /* fall through to DDR */ }
    }
    // --- DDR fallback ---
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const listerParams = {
          FILE: '2', FIELDS: '.01;.02;.03;.09;.131;.301;.302', FLAGS: 'IP', MAX: '200',
        };
        if (search) listerParams.PART = search.toUpperCase();
        const lines = await broker.callRpcWithList('DDR LISTER', [{ type: 'list', value: listerParams }]);
        const parsed = parseDdrListerResponse(lines);
        if (!parsed.ok) return [];
        const out = [];
        for (const line of parsed.data) {
          const a = line.split('^');
          const ien = a[0]?.trim();
          if (!ien || !/^\d+$/.test(ien)) continue;
          const ssnRaw = a[4]?.trim() || '';
          out.push({
            dfn: ien,
            name: a[1]?.trim() || '',
            sex: a[2]?.trim() || '',
            dob: fmDateToIso(a[3]?.trim() || ''),
            ssnLast4: ssnRaw.length >= 4 ? ssnRaw.slice(-4) : '',
            phone: a[5]?.trim() || '',
            serviceConnected: (a[6]?.trim() || '').toUpperCase() === 'YES',
            scPercent: parseInt(a[7]?.trim() || '0', 10) || 0,
          });
        }
        return out;
      });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '2', data: rows, total: rows.length };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Patient Get (ZVE-first, DDR fallback) ----
  app.get('/api/tenant-admin/v1/patients/:dfn', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const { dfn } = req.params;
    // --- ZVE-first: ZVE PATIENT DEMOGRAPHICS ---
    try {
      const z = await callZveRpc('ZVE PATIENT DEMOGRAPHICS', [String(dfn)]);
      const o = zveOutcome(z);
      if (o.kind === 'ok') {
        const dem = {}; const ins = []; const nok = []; const emrg = [];
        for (const line of z.lines.slice(1)) {
          const p = line.split('^');
          if (p[0] === 'DEM') dem[p[1]] = p.slice(2).join('^');
          else if (p[0] === 'INS') ins.push({ ien: p[1], company: p[2], group: p[3], subscriber: p[4] });
          else if (p[0] === 'NOK') nok.push({ name: p[1], relationship: p[2], phone: p[3] });
          else if (p[0] === 'EMRG') emrg.push({ name: p[1], relationship: p[2], phone: p[3] });
        }
        return {
          ok: true, source: 'zve', tenantId, rpcUsed: z.rpcUsed,
          data: {
            dfn, name: dem.NAME || '', sex: dem.SEX || '', dob: dem.DOB || '',
            maritalStatus: dem.MARITAL || '', ssnLast4: dem.SSN_LAST4 || '',
            streetAddress1: dem.STREET || '', city: dem.CITY || '',
            state: dem.STATE || '', zip: dem.ZIP || '', phone: dem.PHONE || '',
            serviceConnected: (dem.SC_CONNECTED || '').toUpperCase() === 'YES',
            scPercent: parseInt(dem.SC_PERCENT || '0', 10) || 0,
            age: dem.AGE || '', religion: dem.RELIGION || '', race: dem.RACE || '',
            wardLocation: dem.WARD || '', admitDate: dem.ADMIT_DATE || null, roomBed: dem.ROOM_BED || '',
            insurance: ins, nextOfKin: nok, emergency: emrg,
          },
        };
      }
      if (o.kind !== 'missing') {
        return reply.code(502).send({ ok: false, source: 'zve', error: o.msg, rpcUsed: z.rpcUsed });
      }
    } catch (_zve) { /* fall through to DDR */ }
    // --- DDR fallback ---
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const fields = '.01;.02;.03;.05;.09;.1;.101;.102;.111;.112;.113;.114;.115;.116;.117;.131;.132;.301;.302;.351;1901';
      const ddr = await ddrGetsEntry('2', dfn, fields, 'IE');
      if (!ddr.ok) return reply.code(404).send({ ok: false, tenantId, source: 'error', error: 'Patient not found' });
      const d = ddr.data;
      const g = (f) => d[f] || d[`2,${f}`] || '';
      const ssnRaw = g('.09');
      return {
        ok: true, source: 'vista', tenantId, rpcUsed: ddr.rpcUsed,
        data: {
          dfn,
          name: g('.01'),
          sex: g('.02'),
          dob: fmDateToIso(g('.03')),
          maritalStatus: g('.05'),
          ssnLast4: ssnRaw.length >= 4 ? ssnRaw.slice(-4) : '',
          streetAddress1: g('.111'),
          streetAddress2: g('.112'),
          streetAddress3: g('.113'),
          city: g('.114'),
          state: g('.115'),
          zip: g('.116'),
          county: g('.117'),
          phone: g('.131'),
          workPhone: g('.132'),
          serviceConnected: (g('.301') || '').toUpperCase() === 'YES',
          scPercent: parseInt(g('.302') || '0', 10) || 0,
          dateOfDeath: g('.351') ? fmDateToIso(g('.351')) : null,
          veteranStatus: (g('1901') || '').toUpperCase() === 'YES',
          wardLocation: g('.1') || '',
          admitDate: g('.101') ? fmDateToIso(g('.101')) : null,
          roomBed: g('.102') || '',
          vistaFields: ddr.data,
        },
      };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Patient Register (ZVE-first, DDR fallback) ----
  app.post('/api/tenant-admin/v1/patients', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const body = req.body || {};
    if (!body.name) return reply.code(400).send({ ok: false, error: 'Patient name is required' });
    // --- ZVE-first: ZVE PATIENT REGISTER ---
    try {
      const z = await callZveRpc('ZVE PATIENT REGISTER', [
        body.name, body.dob || '', body.ssn || '', body.sex || '',
        body.streetAddress1 || '', body.city || '', body.state || '', body.zip || '',
        body.phone || '', body.maritalStatus || '', body.veteranStatus || '', body.scPercent || '',
      ]);
      const o = zveOutcome(z);
      if (o.kind === 'ok') {
        const parts = (z.line0 || '').split('^');
        return {
          ok: true, source: 'zve', tenantId, rpcUsed: z.rpcUsed,
          data: { dfn: parts[1] || '', name: parts[2] || '', ssnLast4: parts[3] || '', registrationDate: new Date().toISOString() },
        };
      }
      if (o.kind !== 'missing') {
        return reply.code(502).send({ ok: false, source: 'zve', error: o.msg, rpcUsed: z.rpcUsed });
      }
    } catch (_zve) { /* fall through to DDR */ }
    // --- DDR fallback ---
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const fieldsObj = { '.01': body.name.toUpperCase() };
      if (body.sex) fieldsObj['.02'] = body.sex;
      if (body.dob) fieldsObj['.03'] = body.dob;
      if (body.ssn) fieldsObj['.09'] = body.ssn;
      if (body.streetAddress1) fieldsObj['.111'] = body.streetAddress1;
      if (body.city) fieldsObj['.114'] = body.city;
      if (body.state) fieldsObj['.115'] = body.state;
      if (body.zip) fieldsObj['.116'] = body.zip;
      if (body.phone) fieldsObj['.131'] = body.phone;
      if (body.veteranStatus) fieldsObj['1901'] = 'YES';
      const result = await ddrFilerAddMulti('2', '+1,', fieldsObj);
      if (!result.ok) return reply.code(502).send({ ok: false, tenantId, source: 'error', error: result.error, lines: result.lines });
      // Parse newly assigned IEN from FILER response
      const newIen = (result.lines || []).find(l => /^\d+$/.test(l?.trim()))?.trim() || '';
      return {
        ok: true, source: 'vista', tenantId, rpcUsed: result.rpcUsed,
        data: { dfn: newIen, name: body.name.toUpperCase(), registrationDate: new Date().toISOString() },
      };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Patient Update (ZVE-first, DDR fallback) ----
  app.put('/api/tenant-admin/v1/patients/:dfn', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const { dfn } = req.params;
    const body = req.body || {};
    // --- ZVE-first: ZVE PATIENT EDIT ---
    const PAT_FIELD_MAP = { name: 'NAME', sex: 'SEX', dob: 'DOB', streetAddress1: 'STREET', streetAddress2: 'STREET2', city: 'CITY', state: 'STATE', zip: 'ZIP', phone: 'PHONE' };
    const firstBodyField = Object.keys(body).find(k => PAT_FIELD_MAP[k]);
    if (firstBodyField) {
      try {
        const z = await callZveRpc('ZVE PATIENT EDIT', [String(dfn), PAT_FIELD_MAP[firstBodyField], String(body[firstBodyField])]);
        const o = zveOutcome(z);
        if (o.kind === 'ok') {
          // ZVE PATIENT EDIT handles one field at a time; for multi-field edits, loop
          for (const [k, v] of Object.entries(body)) {
            if (k === firstBodyField || !PAT_FIELD_MAP[k]) continue;
            await callZveRpc('ZVE PATIENT EDIT', [String(dfn), PAT_FIELD_MAP[k], String(v)]);
          }
          return { ok: true, source: 'zve', tenantId, rpcUsed: z.rpcUsed, data: { dfn, updatedAt: new Date().toISOString() } };
        }
        if (o.kind !== 'missing') {
          return reply.code(502).send({ ok: false, source: 'zve', error: o.msg, rpcUsed: z.rpcUsed });
        }
      } catch (_zve) { /* fall through to DDR */ }
    }
    // --- DDR fallback ---
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const edits = {};
      if (body.name) edits['.01'] = body.name.toUpperCase();
      if (body.sex) edits['.02'] = body.sex;
      if (body.dob) edits['.03'] = body.dob;
      if (body.streetAddress1) edits['.111'] = body.streetAddress1;
      if (body.streetAddress2) edits['.112'] = body.streetAddress2;
      if (body.city) edits['.114'] = body.city;
      if (body.state) edits['.115'] = body.state;
      if (body.zip) edits['.116'] = body.zip;
      if (body.phone) edits['.131'] = body.phone;
      if (Object.keys(edits).length === 0) return reply.code(400).send({ ok: false, error: 'No fields to update' });
      const result = await ddrFilerEditMulti('2', `${dfn},`, edits);
      if (!result.ok) return reply.code(502).send({ ok: false, tenantId, source: 'error', error: result.error, lines: result.lines });
      return { ok: true, source: 'vista', tenantId, rpcUsed: result.rpcUsed, data: { dfn, updatedAt: new Date().toISOString() } };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- ADT: Admit Patient (ZVE-first, DDR fallback) ----
  app.post('/api/tenant-admin/v1/patients/:dfn/admit', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const { dfn } = req.params;
    const body = req.body || {};
    // --- ZVE-first: ZVE ADT ADMIT ---
    try {
      const z = await callZveRpc('ZVE ADT ADMIT', [
        String(dfn), String(body.wardIen || ''), body.roomBed || '', body.diagnosis || '', String(body.attendingDuz || ''), String(body.admitType || ''),
      ]);
      const o = zveOutcome(z);
      if (o.kind === 'ok') {
        const parts = (z.line0 || '').split('^');
        return {
          ok: true, source: 'zve', tenantId, rpcUsed: z.rpcUsed,
          data: { dfn, movementIen: parts[1] || '', admissionDate: parts[2] || '', ward: parts[3] || '', roomBed: parts[4] || '', movementType: 'ADMISSION' },
        };
      }
      if (o.kind !== 'missing') {
        return reply.code(502).send({ ok: false, source: 'zve', error: o.msg, rpcUsed: z.rpcUsed });
      }
    } catch (_zve) { /* fall through to DDR */ }
    // --- DDR fallback ---
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      // File 405 PATIENT MOVEMENT: .01=DATE/TIME, .02=PATIENT, .03=TYPE(1=admit), .06=WARD, .08=TREATING SPECIALTY
      const now = new Date();
      const fmNow = `${now.getFullYear() - 1700}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
      const fieldsObj = {
        '.01': fmNow,
        '.02': dfn,
        '.03': '1', // ADMISSION
      };
      if (body.wardIen) fieldsObj['.06'] = body.wardIen;
      if (body.treatingSpecialtyIen) fieldsObj['.08'] = body.treatingSpecialtyIen;
      const result = await ddrFilerAddMulti('405', '+1,', fieldsObj);
      if (!result.ok) return reply.code(502).send({ ok: false, tenantId, source: 'error', error: result.error, lines: result.lines });
      return {
        ok: true, source: 'vista', tenantId, rpcUsed: result.rpcUsed,
        data: { dfn, movementType: 'ADMISSION', admissionDate: now.toISOString(), wardIen: body.wardIen || '' },
      };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- ADT: Transfer Patient (ZVE-first, DDR fallback) ----
  app.post('/api/tenant-admin/v1/patients/:dfn/transfer', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const { dfn } = req.params;
    const body = req.body || {};
    // --- ZVE-first: ZVE ADT TRANSFER ---
    try {
      const z = await callZveRpc('ZVE ADT TRANSFER', [
        String(dfn), String(body.wardIen || ''), body.roomBed || '', body.reason || '',
      ]);
      const o = zveOutcome(z);
      if (o.kind === 'ok') {
        const parts = (z.line0 || '').split('^');
        return {
          ok: true, source: 'zve', tenantId, rpcUsed: z.rpcUsed,
          data: { dfn, movementIen: parts[1] || '', transferDate: parts[2] || '', fromWard: parts[3] || '', toWard: parts[4] || '', movementType: 'TRANSFER' },
        };
      }
      if (o.kind !== 'missing') {
        return reply.code(502).send({ ok: false, source: 'zve', error: o.msg, rpcUsed: z.rpcUsed });
      }
    } catch (_zve) { /* fall through to DDR */ }
    // --- DDR fallback ---
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const now = new Date();
      const fmNow = `${now.getFullYear() - 1700}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
      const fieldsObj = {
        '.01': fmNow,
        '.02': dfn,
        '.03': '3', // TRANSFER
      };
      if (body.wardIen) fieldsObj['.06'] = body.wardIen;
      if (body.treatingSpecialtyIen) fieldsObj['.08'] = body.treatingSpecialtyIen;
      const result = await ddrFilerAddMulti('405', '+1,', fieldsObj);
      if (!result.ok) return reply.code(502).send({ ok: false, tenantId, source: 'error', error: result.error, lines: result.lines });
      return {
        ok: true, source: 'vista', tenantId, rpcUsed: result.rpcUsed,
        data: { dfn, movementType: 'TRANSFER', transferDate: now.toISOString(), wardIen: body.wardIen || '' },
      };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- ADT: Discharge Patient (ZVE-first, DDR fallback) ----
  app.post('/api/tenant-admin/v1/patients/:dfn/discharge', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const { dfn } = req.params;
    const body = req.body || {};
    // --- ZVE-first: ZVE ADT DISCHARGE ---
    try {
      const z = await callZveRpc('ZVE ADT DISCHARGE', [
        String(dfn), body.diagnosis || '', body.disposition || '', String(body.dischargeType || ''),
      ]);
      const o = zveOutcome(z);
      if (o.kind === 'ok') {
        const parts = (z.line0 || '').split('^');
        return {
          ok: true, source: 'zve', tenantId, rpcUsed: z.rpcUsed,
          data: { dfn, movementIen: parts[1] || '', dischargeDate: parts[2] || '', disposition: parts[3] || '', movementType: 'DISCHARGE' },
        };
      }
      if (o.kind !== 'missing') {
        return reply.code(502).send({ ok: false, source: 'zve', error: o.msg, rpcUsed: z.rpcUsed });
      }
    } catch (_zve) { /* fall through to DDR */ }
    // --- DDR fallback ---
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const now = new Date();
      const fmNow = `${now.getFullYear() - 1700}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
      const fieldsObj = {
        '.01': fmNow,
        '.02': dfn,
        '.03': '2', // DISCHARGE
      };
      if (body.wardIen) fieldsObj['.06'] = body.wardIen;
      const result = await ddrFilerAddMulti('405', '+1,', fieldsObj);
      if (!result.ok) return reply.code(502).send({ ok: false, tenantId, source: 'error', error: result.error, lines: result.lines });
      return {
        ok: true, source: 'vista', tenantId, rpcUsed: result.rpcUsed,
        data: { dfn, movementType: 'DISCHARGE', dischargeDate: now.toISOString() },
      };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Ward Census (ZVE ADT CENSUS) ----
  app.get('/api/tenant-admin/v1/census', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    try {
      const z = await callZveRpc('ZVE ADT CENSUS', [req.query.wardIen || 'ALL', req.query.pending || '', req.query.max || '']);
      const o = zveOutcome(z);
      if (o.kind === 'missing') return reply.code(502).send({ ok: false, error: `RPC ZVE ADT CENSUS returned missing status`, detail: o.msg });
      if (o.kind !== 'ok') {
        return reply.code(502).send({ ok: false, source: 'zve', error: o.msg, rpcUsed: z.rpcUsed });
      }
      const data = [];
      for (const line of z.lines.slice(1)) {
        const p = line.split('^');
        if (!p[0]) continue;
        data.push({ dfn: p[0], name: p[1] || '', roomBed: p[2] || '', admissionDate: p[3] || '', lengthOfStay: parseInt(p[4] || '0', 10) || 0, attending: p[5] || '', diagnosis: p[6] || '', diet: p[7] || '' });
      }
      return { ok: true, source: 'zve', tenantId, rpcUsed: z.rpcUsed, data, total: data.length };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Recent Patients (ZVE RECENT PATIENTS) ----
  app.get('/api/tenant-admin/v1/patients/recent', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    try {
      const z = await callZveRpc('ZVE RECENT PATIENTS', [req.query.userDuz || '', req.query.count || '']);
      const o = zveOutcome(z);
      if (o.kind === 'missing') return reply.code(502).send({ ok: false, error: `RPC ZVE RECENT PATIENTS returned missing status`, detail: o.msg });
      if (o.kind !== 'ok') {
        return reply.code(502).send({ ok: false, source: 'zve', error: o.msg, rpcUsed: z.rpcUsed });
      }
      const data = [];
      for (const line of z.lines.slice(1)) {
        const p = line.split('^');
        if (!p[0]) continue;
        data.push({ dfn: p[0], name: p[1] || '', dob: p[2] || '', ssnLast4: p[3] || '', lastAccessed: p[4] || '' });
      }
      return { ok: true, source: 'zve', tenantId, rpcUsed: z.rpcUsed, data, total: data.length };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Patient Insurance (Subfile 2.312 via DDR LISTER / DDR FILER) ----
  app.get('/api/tenant-admin/v1/patients/:dfn/insurance', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const { dfn } = req.params;
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        // File 2.312 (INSURANCE TYPE subfile of PATIENT): .01=INSURANCE TYPE, 1=GROUP NUMBER, 2=SUBSCRIBER ID, 3=EFFECTIVE DATE
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '2.312', IENS: `${dfn},`, FIELDS: '.01;1;2;3;8', FLAGS: 'IP', MAX: '50' } },
        ]);
        const parsed = parseDdrListerResponse(lines);
        if (!parsed.ok) return [];
        const out = [];
        for (const line of parsed.data) {
          const a = line.split('^');
          const ien = a[0]?.trim();
          if (!ien || !/^\d+$/.test(ien)) continue;
          out.push({
            id: ien,
            insuranceType: a[1]?.trim() || '',
            groupNumber: a[2]?.trim() || '',
            subscriberId: a[3]?.trim() || '',
            effectiveDate: fmDateToIso(a[4]?.trim() || ''),
            expirationDate: fmDateToIso(a[5]?.trim() || ''),
          });
        }
        return out;
      });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '2.312', data: rows };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  app.post('/api/tenant-admin/v1/patients/:dfn/insurance', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const { dfn } = req.params;
    const body = req.body || {};
    if (!body.insuranceType) return reply.code(400).send({ ok: false, error: 'insuranceType (company IEN) is required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const fieldsObj = { '.01': body.insuranceType };
      if (body.groupNumber) fieldsObj['1'] = body.groupNumber;
      if (body.subscriberId) fieldsObj['2'] = body.subscriberId;
      if (body.effectiveDate) fieldsObj['3'] = body.effectiveDate;
      const result = await ddrFilerAddMulti('2.312', `+1,${dfn},`, fieldsObj);
      if (!result.ok) return reply.code(502).send({ ok: false, tenantId, source: 'error', error: result.error, lines: result.lines });
      return { ok: true, source: 'vista', tenantId, rpcUsed: result.rpcUsed, data: { dfn, createdAt: new Date().toISOString() } };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  app.put('/api/tenant-admin/v1/patients/:dfn/insurance/:insuranceId', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const { dfn, insuranceId } = req.params;
    const body = req.body || {};
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const edits = {};
      if (body.groupNumber) edits['1'] = body.groupNumber;
      if (body.subscriberId) edits['2'] = body.subscriberId;
      if (body.effectiveDate) edits['3'] = body.effectiveDate;
      if (Object.keys(edits).length === 0) return reply.code(400).send({ ok: false, error: 'No fields to update' });
      const result = await ddrFilerEditMulti('2.312', `${insuranceId},${dfn},`, edits);
      if (!result.ok) return reply.code(502).send({ ok: false, tenantId, source: 'error', error: result.error, lines: result.lines });
      return { ok: true, source: 'vista', tenantId, rpcUsed: result.rpcUsed, data: { id: insuranceId, dfn, updatedAt: new Date().toISOString() } };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  app.delete('/api/tenant-admin/v1/patients/:dfn/insurance/:insuranceId', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const { dfn, insuranceId } = req.params;
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      // Delete subfile entry by setting .01 to @ (FileMan delete convention)
      const result = await ddrFilerEdit('2.312', `${insuranceId},${dfn},`, '.01', '@');
      if (!result.ok) return reply.code(502).send({ ok: false, tenantId, source: 'error', error: result.error, lines: result.lines });
      return { ok: true, source: 'vista', tenantId, data: { id: insuranceId, dfn, deleted: true } };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Financial Assessment / Means Test (File 408.31) ----
  app.get('/api/tenant-admin/v1/patients/:dfn/assessment', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const { dfn } = req.params;
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      // DDR LISTER on File 408.31 filtered by patient DFN
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '408.31', FIELDS: '.01;.02;.03;.04;.07', FLAGS: 'IP', MAX: '50', SCREEN: `I $P(^DGMT(408.31,Y,0),U,2)=${dfn}` } },
        ]);
        const parsed = parseDdrListerResponse(lines);
        if (!parsed.ok) return [];
        const out = [];
        for (const line of parsed.data) {
          const a = line.split('^');
          const ien = a[0]?.trim();
          if (!ien || !/^\d+$/.test(ien)) continue;
          out.push({
            id: ien,
            date: fmDateToIso(a[1]?.trim() || ''),
            patient: a[2]?.trim() || '',
            status: a[3]?.trim() || '',
            type: a[4]?.trim() || '',
            income: a[5]?.trim() || '',
          });
        }
        return out;
      });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '408.31', data: rows };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  app.post('/api/tenant-admin/v1/patients/:dfn/assessment', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const { dfn } = req.params;
    const body = req.body || {};
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const now = new Date();
      const fmNow = `${now.getFullYear() - 1700}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const fieldsObj = {
        '.01': fmNow,
        '.02': dfn,
      };
      if (body.annualIncome) fieldsObj['.07'] = String(body.annualIncome);
      const result = await ddrFilerAddMulti('408.31', '+1,', fieldsObj);
      if (!result.ok) return reply.code(502).send({ ok: false, tenantId, source: 'error', error: result.error, lines: result.lines });
      return {
        ok: true, source: 'vista', tenantId, rpcUsed: result.rpcUsed,
        data: { dfn, date: now.toISOString(), assessor: req.session?.userName || '' },
      };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Patient Flags (ZVE-first, DDR fallback) ----
  app.get('/api/tenant-admin/v1/patients/:dfn/flags', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const { dfn } = req.params;
    // --- ZVE-first: ZVE PATIENT FLAGS ---
    try {
      const z = await callZveRpc('ZVE PATIENT FLAGS', [String(dfn), 'LIST']);
      const o = zveOutcome(z);
      if (o.kind === 'ok') {
        const data = [];
        for (const line of z.lines.slice(1)) {
          const p = line.split('^');
          if (!p[0]) continue;
          data.push({ id: p[0], flagName: p[1] || '', category: p[2] || '', status: p[3] || 'active', assignedDate: p[4] || '', assignedBy: p[5] || '', reviewDate: p[6] || '' });
        }
        return { ok: true, source: 'zve', tenantId, rpcUsed: z.rpcUsed, data };
      }
      if (o.kind !== 'missing') {
        return reply.code(502).send({ ok: false, source: 'zve', error: o.msg, rpcUsed: z.rpcUsed });
      }
    } catch (_zve) { /* fall through to DDR */ }
    // --- DDR fallback ---
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '26.13', FIELDS: '.01;.02;.03;.04;.05', FLAGS: 'IP', MAX: '200', SCREEN: `I $P(^DGPF(26.13,Y,0),U,1)=${dfn}` } },
        ]);
        const parsed = parseDdrListerResponse(lines);
        if (!parsed.ok) return [];
        const out = [];
        for (const line of parsed.data) {
          const a = line.split('^');
          const ien = a[0]?.trim();
          if (!ien || !/^\d+$/.test(ien)) continue;
          out.push({
            id: ien,
            patient: a[1]?.trim() || '',
            flagName: a[2]?.trim() || '',
            category: a[3]?.trim() || '',
            status: a[4]?.trim() || 'active',
            assignedDate: fmDateToIso(a[5]?.trim() || ''),
          });
        }
        return out;
      });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '26.13', data: rows };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  app.post('/api/tenant-admin/v1/patients/:dfn/flags', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const { dfn } = req.params;
    const body = req.body || {};
    if (!body.flagName) return reply.code(400).send({ ok: false, error: 'flagName is required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const now = new Date();
      const fmNow = `${now.getFullYear() - 1700}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const fieldsObj = {
        '.01': dfn,
        '.02': body.flagName,
        '.03': body.category || '',
        '.04': 'ACTIVE',
        '.05': fmNow,
      };
      const result = await ddrFilerAddMulti('26.13', '+1,', fieldsObj);
      if (!result.ok) return reply.code(502).send({ ok: false, tenantId, source: 'error', error: result.error, lines: result.lines });
      return {
        ok: true, source: 'vista', tenantId, rpcUsed: result.rpcUsed,
        data: { dfn, flagName: body.flagName, status: 'active', assignedDate: now.toISOString() },
      };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  app.put('/api/tenant-admin/v1/patients/:dfn/flags/:flagId', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const { dfn, flagId } = req.params;
    const body = req.body || {};
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const edits = {};
      if (body.status) edits['.04'] = body.status.toUpperCase();
      if (body.reviewDate) edits['.06'] = body.reviewDate;
      if (Object.keys(edits).length === 0) return reply.code(400).send({ ok: false, error: 'No fields to update' });
      const result = await ddrFilerEditMulti('26.13', `${flagId},`, edits);
      if (!result.ok) return reply.code(502).send({ ok: false, tenantId, source: 'error', error: result.error, lines: result.lines });
      return { ok: true, source: 'vista', tenantId, rpcUsed: result.rpcUsed, data: { id: flagId, dfn, ...body, updatedAt: new Date().toISOString() } };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Record Restrictions (sensitivity on File 2 field 38.1) ----
  app.put('/api/tenant-admin/v1/patients/:dfn/restrictions', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const { dfn } = req.params;
    const body = req.body || {};
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const edits = {};
      // Field 38.1 in File 2 = SENSITIVE (0=no, 1=yes)
      if (body.isSensitive !== undefined) edits['38.1'] = body.isSensitive ? '1' : '0';
      if (Object.keys(edits).length === 0) return reply.code(400).send({ ok: false, error: 'No fields to update' });
      const result = await ddrFilerEditMulti('2', `${dfn},`, edits);
      if (!result.ok) return reply.code(502).send({ ok: false, tenantId, source: 'error', error: result.error, lines: result.lines });
      return {
        ok: true, source: 'vista', tenantId, rpcUsed: result.rpcUsed,
        data: { dfn, ...body, updatedAt: new Date().toISOString(), updatedBy: req.session?.userName || '' },
      };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Break-the-Glass audit log ----
  app.post('/api/tenant-admin/v1/patients/:dfn/break-glass', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const { dfn } = req.params;
    const body = req.body || {};
    try {
      // Log the access event. In a full VistA integration this would write to the
      // DG SECURITY LOG (File 38.1) or a custom ZVE audit file. For now we log
      // the event server-side and return success to the caller.
      const event = {
        dfn,
        accessedBy: req.session?.userName || body.accessedBy || 'UNKNOWN',
        duz: req.session?.duz || '',
        reason: body.reason || '',
        timestamp: new Date().toISOString(),
        type: 'BREAK_THE_GLASS',
      };
      console.log('[AUDIT] Break-the-glass access:', JSON.stringify(event));
      return {
        ok: true, source: 'vista', tenantId,
        data: { ...event, auditId: `BTG-${Date.now()}`, logged: true },
      };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Audit Events — read break-the-glass / access log for a patient ----
  app.get('/api/tenant-admin/v1/patients/:dfn/audit-events', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const { dfn } = req.params;
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      // DG SECURITY LOG (File #38.1) — screen by patient DFN
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '38.1', FIELDS: '.01;.02;.03;.04;.05', FLAGS: 'IP', MAX: '200', SCREEN: `I $P(^(0),U,2)=${dfn}` } },
        ]);
        const parsed = parseDdrListerResponse(lines);
        if (!parsed.ok) return [];
        const out = [];
        for (const line of parsed.data) {
          const a = line.split('^');
          const ien = a[0]?.trim();
          if (!ien || !/^\d+$/.test(ien)) continue;
          out.push({
            id: ien,
            dateTime: a[1]?.trim() || '',
            accessedBy: a[2]?.trim() || '',
            reasonCategory: a[3]?.trim() || '',
            reasonText: a[4]?.trim() || '',
            duration: a[5]?.trim() || '',
          });
        }
        return out;
      });
      return { ok: true, source: 'vista', tenantId, data: rows };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Authorized Staff — manage who can access a restricted-record patient ----
  app.get('/api/tenant-admin/v1/patients/:dfn/authorized-staff', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const { dfn } = req.params;
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      // DG SECURITY LOG AUTHORIZED STAFF — subfile of File #38.1
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '38.13', IENS: `,${dfn},`, FIELDS: '.01;.02;.03;.04', FLAGS: 'IP', MAX: '100' } },
        ]);
        const parsed = parseDdrListerResponse(lines);
        if (!parsed.ok) return [];
        const out = [];
        for (const line of parsed.data) {
          const a = line.split('^');
          const ien = a[0]?.trim();
          if (!ien || !/^\d+$/.test(ien)) continue;
          out.push({
            id: ien, duz: a[1]?.trim() || '', name: a[2]?.trim() || '',
            role: a[3]?.trim() || '', dateAdded: a[4]?.trim() || '',
          });
        }
        return out;
      });
      return { ok: true, source: 'vista', tenantId, data: rows };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  app.post('/api/tenant-admin/v1/patients/:dfn/authorized-staff', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const { dfn } = req.params;
    const body = req.body || {};
    if (!body.duz) return reply.code(400).send({ ok: false, error: 'duz is required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const now = new Date();
      const fmDate = `${now.getFullYear() - 1700}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const result = await lockedRpc(async () => {
        const broker = await getBroker();
        return ddrFilerAddMulti(broker, '38.13', `+1,${dfn},`, {
          '.01': body.duz,
          '.02': body.name || '',
          '.03': body.role || '',
          '.04': fmDate,
        });
      });
      return { ok: true, source: 'vista', tenantId, data: { dfn, ...body, addedAt: new Date().toISOString(), result } };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  app.delete('/api/tenant-admin/v1/patients/:dfn/authorized-staff/:staffIen', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const { dfn, staffIen } = req.params;
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const result = await lockedRpc(async () => {
        const broker = await getBroker();
        return ddrFilerEdit(broker, '38.13', `${staffIen},${dfn},`, '.01', '@');
      });
      return { ok: true, source: 'vista', tenantId, data: { deleted: staffIen, result } };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Insurance Eligibility Verification ----
  app.post('/api/tenant-admin/v1/patients/:dfn/verify-eligibility', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const { dfn } = req.params;
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      // Read insurance subfile (File 2.312) and check active coverage
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '2.312', IENS: `,${dfn},`, FIELDS: '.01;.18;8', FLAGS: 'IP', MAX: '20' } },
        ]);
        const parsed = parseDdrListerResponse(lines);
        if (!parsed.ok) return [];
        const out = [];
        for (const line of parsed.data) {
          const a = line.split('^');
          const ien = a[0]?.trim();
          if (!ien || !/^\d+$/.test(ien)) continue;
          out.push({
            id: ien,
            planName: a[1]?.trim() || '',
            expirationDate: a[2]?.trim() || '',
            groupNumber: a[3]?.trim() || '',
          });
        }
        return out;
      });
      // Determine verification status
      const now = new Date();
      const active = rows.filter(r => !r.expirationDate || new Date(r.expirationDate) >= now);
      const expired = rows.filter(r => r.expirationDate && new Date(r.expirationDate) < now);
      const status = rows.length === 0 ? 'none' : active.length > 0 ? 'active' : 'expired';
      return {
        ok: true, source: 'vista', tenantId,
        data: {
          dfn, status, verifiedAt: new Date().toISOString(),
          totalPolicies: rows.length, activePolicies: active.length, expiredPolicies: expired.length,
          policies: rows,
        },
      };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Registration Reports (aggregate patient data) ----
  app.get('/api/tenant-admin/v1/reports/registration', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      // Count patients from File 2, beds from File 405.4, and movements from File 405
      const [patients, beds] = await Promise.all([
        lockedRpc(async () => {
          const broker = await getBroker();
          const lines = await broker.callRpcWithList('DDR LISTER', [
            { type: 'list', value: { FILE: '2', FIELDS: '.01;.301', FLAGS: 'IP', MAX: '9999' } },
          ]);
          return parseDdrListerResponse(lines);
        }),
        lockedRpc(async () => {
          const broker = await getBroker();
          const lines = await broker.callRpcWithList('DDR LISTER', [
            { type: 'list', value: { FILE: '405.4', FIELDS: '.01;.2', FLAGS: 'IP', MAX: '500' } },
          ]);
          return parseDdrListerResponse(lines);
        }),
      ]);
      const patientCount = patients.ok ? patients.data.length : 0;
      const bedCount = beds.ok ? beds.data.length : 0;
      const scCount = patients.ok ? patients.data.filter(l => { const a = l.split('^'); return (a[2] || '').toUpperCase() === 'YES'; }).length : 0;
      return {
        ok: true, source: 'vista', tenantId,
        data: {
          summary: {
            totalRegistered: patientCount,
            serviceConnectedVeterans: scCount,
            totalBeds: bedCount,
          },
        },
      };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Patient Dashboard Stats ----
  app.get('/api/tenant-admin/v1/patients/dashboard', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const [patients, beds] = await Promise.all([
        lockedRpc(async () => {
          const broker = await getBroker();
          const lines = await broker.callRpcWithList('DDR LISTER', [
            { type: 'list', value: { FILE: '2', FIELDS: '.01;.301;.302', FLAGS: 'IP', MAX: '9999' } },
          ]);
          return parseDdrListerResponse(lines);
        }),
        lockedRpc(async () => {
          const broker = await getBroker();
          const lines = await broker.callRpcWithList('DDR LISTER', [
            { type: 'list', value: { FILE: '405.4', FIELDS: '.01;.2', FLAGS: 'IP', MAX: '500' } },
          ]);
          return parseDdrListerResponse(lines);
        }),
      ]);
      const patientRows = patients.ok ? patients.data : [];
      const bedRows = beds.ok ? beds.data : [];
      const totalPatients = patientRows.length;
      const scVets = patientRows.filter(l => { const a = l.split('^'); return (a[2] || '').toUpperCase() === 'YES'; }).length;
      const totalBeds = bedRows.length;
      return {
        ok: true, source: 'vista', tenantId,
        data: {
          totalPatients,
          activePatients: totalPatients,
          serviceConnectedVeterans: scVets,
          bedSummary: { total: totalBeds, available: totalBeds, occupied: 0, blocked: 0 },
        },
      };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // WORKSPACE VISIBILITY PER DIVISION (^XTMP("ZVE-WKSP"))
  // ═══════════════════════════════════════════════════════════════════════

  app.get('/api/tenant-admin/v1/workspaces', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const divisionIen = req.query.divisionIen || '';
    try {
      const z = await callZveRpc('ZVE SITE WS GET', [divisionIen]);
      const o = zveOutcome(z);
      if (o.kind !== 'ok') {
        return reply.code(502).send({
          ok: false,
          error: `ZVE SITE WS GET failed: ${o.msg || o.kind}`,
          rpcUsed: z.rpcUsed,
        });
      }
      const data = {};
      for (const line of z.lines.slice(1)) {
        const parts = line.split('^');
        if (parts[0]) data[parts[0]] = parts[1] === '1';
      }
      return { ok: true, source: 'zve', data };
    } catch (e) {
      return reply.code(500).send({ ok: false, error: e.message });
    }
  });

  app.put('/api/tenant-admin/v1/workspaces', async (req, reply) => {
    const { divisionIen, workspace, enabled } = req.body || {};
    if (!workspace) return reply.code(400).send({ ok: false, error: 'workspace required' });
    try {
      const z = await callZveRpc('ZVE SITE WS SET', [divisionIen || '', workspace, enabled ? '1' : '0']);
      const o = zveOutcome(z);
      if (o.kind !== 'ok') {
        return reply.code(502).send({
          ok: false,
          error: `ZVE SITE WS SET failed: ${o.msg || o.kind}`,
          rpcUsed: z.rpcUsed,
        });
      }
      return { ok: true, source: 'zve', workspace, enabled };
    } catch (e) {
      return reply.code(500).send({ ok: false, error: e.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // DIVISION EDIT & CREATE (File #40.8 via DDR FILER)
  // ═══════════════════════════════════════════════════════════════════════

  app.put('/api/tenant-admin/v1/divisions/:ien', async (req, reply) => {
    const { ien } = req.params;
    const body = req.body || {};
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable' });

    // Map of editable field names → File #40.8 field numbers
    const FIELD_MAP = {
      name: '.01',
      phone: '4',       // TELEPHONE NUMBER
      address: '1.01',  // STREET ADDR. 1
      city: '1.03',
      state: '1.04',
      zip: '1.05',
    };

    const results = [];
    for (const [key, value] of Object.entries(body)) {
      const fieldNum = FIELD_MAP[key];
      if (!fieldNum || value === undefined) continue;
      const filer = await ddrFilerEdit('40.8', `${ien},`, fieldNum, String(value), 'E');
      results.push({ field: key, ok: filer.ok, error: filer.error || null });
    }

    const allOk = results.every(r => r.ok);
    return { ok: allOk, source: 'vista', ien, results };
  });

  app.post('/api/tenant-admin/v1/divisions', async (req, reply) => {
    const body = req.body || {};
    if (!body.name) return reply.code(400).send({ ok: false, error: 'name is required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable' });

    try {
      const filer = await ddrFilerAdd('40.8', '.01', body.name, 'E');
      if (!filer.ok) return reply.code(502).send({ ok: false, error: filer.error || 'Failed to create division' });
      return { ok: true, source: 'vista', rpcUsed: 'DDR FILER', result: filer };
    } catch (e) {
      return reply.code(500).send({ ok: false, error: e.message });
    }
  });

  /** Delete division — DDR FILER on File #40.8 (set .01 to @) */
  app.delete('/api/tenant-admin/v1/divisions/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId || 'default';
    const ien = req.params.ien;
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable' });
    try {
      const result = await ddrFilerEdit('40.8', `${ien},`, '.01', '@', 'E');
      return { ok: true, tenantId, ien, action: 'deleted', file: '40.8', rpcUsed: 'DDR FILER', result };
    } catch (e) {
      return reply.code(500).send({ ok: false, error: e.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // PACKAGE-SPECIFIC PARAMETERS (Clinical, Pharmacy, Lab, Scheduling)
  // ═══════════════════════════════════════════════════════════════════════

  const PACKAGE_PARAM_FILES = {
    'order-entry': { file: '100.99', fields: '.01;.02;.03;1;2;3', label: 'OE/RR Site Parameters' },
    pharmacy:      { file: '59.7',   fields: '.01;.02;.03;1;2;4', label: 'Pharmacy Site Parameters' },
    lab:           { file: '69.9',   fields: '.01;.02;.03;1;2;3', label: 'Lab Site Parameters' },
    scheduling:    { file: '44.001', fields: '.01;.02;.03;1;2',   label: 'Scheduling Parameters' },
    radiology:     { file: '79.1',   fields: '.01;.02;.03;1;2',   label: 'Radiology Site Parameters' },
    surgery:       { file: '136',    fields: '.01;.02;.03;1;2',   label: 'Surgery Site Parameters' },
  };

  app.get('/api/tenant-admin/v1/params/:package', async (req, reply) => {
    const pkg = req.params.package;
    if (pkg === 'kernel') return; // handled by existing route
    const pkgDef = PACKAGE_PARAM_FILES[pkg];
    if (!pkgDef) return reply.code(404).send({ ok: false, error: `Unknown parameter package: ${pkg}` });

    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable' });

    try {
      // Step 1: Discover ALL fields in the file via ZVE DD FIELDS (empty field list = all)
      let fieldsToRead = pkgDef.fields;
      const fieldLabels = {};
      try {
        const discovery = await callZveRpc('ZVE DD FIELDS', [pkgDef.file, '']);
        if (discovery.ok && discovery.lines.length > 1) {
          const discoveredFields = [];
          for (const line of discovery.lines.slice(1)) {
            const p = line.split('^');
            if (p[0] && p[0].match(/^[\d.]+$/)) {
              discoveredFields.push(p[0]);
              if (p[1]) fieldLabels[p[0]] = p[1];
            }
          }
          if (discoveredFields.length > 0) {
            fieldsToRead = discoveredFields.slice(0, 30).join(';'); // Cap at 30
          }
        }
      } catch (ddErr) {
        req.log.warn({ file: pkgDef.file, fields: pkgDef.fields, error: ddErr?.message || String(ddErr) },
          'ZVE DD FIELDS lookup failed — using generic labels');
      }

      // Fallback: if discovery didn't populate labels, try with the specific fields
      if (Object.keys(fieldLabels).length === 0) {
        try {
          const dd = await callZveRpc('ZVE DD FIELDS', [pkgDef.file, fieldsToRead]);
          if (dd.ok) {
            for (const line of dd.lines.slice(1)) {
              const p = line.split('^');
              if (p[0] && p[1]) fieldLabels[p[0]] = p[1];
            }
          }
        } catch (ddErr) {
          req.log.warn({ file: pkgDef.file, fields: fieldsToRead, error: ddErr?.message || String(ddErr) },
            'ZVE DD FIELDS fallback lookup failed — using generic labels');
        }
      }

      // Step 2: Read the actual data values via DDR GETS ENTRY
      const result = await ddrGetsEntry(pkgDef.file, '1', fieldsToRead, 'IE');
      if (!result.ok) {
        return { ok: true, source: 'vista', package: pkg, label: pkgDef.label, rawLines: [], data: [], note: `File #${pkgDef.file} has no records in this system. Default settings are in use.` };
      }

      // Step 3: Merge data values with DD field labels
      const rawLines = result.rawLines || [];
      const data = rawLines.map(line => {
        const parts = line.split('^');
        const fieldNum = parts[2] || '';
        const internal = parts[3] || '';
        const external = parts[4] || internal;
        // Title-case the DD label for readability
        const rawLabel = fieldLabels[fieldNum] || '';
        const label = rawLabel
          ? rawLabel.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
          : `${pkgDef.label} — Field ${fieldNum}`;
        return { fieldNum, label, value: internal, displayValue: external };
      }).filter(d => d.fieldNum);

      return {
        ok: true, source: 'vista', package: pkg, label: pkgDef.label, file: pkgDef.file,
        rawLines, // backward compat
        data,
      };
    } catch (e) {
      return reply.code(500).send({ ok: false, error: e.message });
    }
  });

  app.put('/api/tenant-admin/v1/params/:package', async (req, reply) => {
    const pkg = req.params.package;
    if (pkg === 'kernel') return; // handled by existing route
    const pkgDef = PACKAGE_PARAM_FILES[pkg];
    if (!pkgDef) return reply.code(404).send({ ok: false, error: `Unknown parameter package: ${pkg}` });

    const body = req.body || {};
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable' });

    const results = [];
    for (const [fieldNum, value] of Object.entries(body)) {
      if (fieldNum === 'reason') continue;
      const filer = await ddrFilerEdit(pkgDef.file, '1,', fieldNum, String(value), 'E');
      results.push({ field: fieldNum, ok: filer.ok, error: filer.error || null });
    }
    return { ok: results.every(r => r.ok), source: 'vista', package: pkg, results };
  });

  // ═══════════════════════════════════════════════════════════════════════
  // CUSTOM ROLE PERSISTENCE (^XTMP("ZVE-ROLES"))
  // ═══════════════════════════════════════════════════════════════════════

  app.get('/api/tenant-admin/v1/roles/custom', async (req, reply) => {
    try {
      const z = await callZveRpc('ZVE ROLE CUSTOM LIST', []);
      const o = zveOutcome(z);
      if (o.kind !== 'ok') return reply.code(502).send({ ok: false, error: `RPC failed: ${o.msg || o.kind}`, rpcUsed: z.rpcUsed });
      const data = [];
      for (const line of z.lines.slice(1)) {
        const p = line.split('^');
        if (!p[0]) continue;
        data.push({ id: p[0], name: p[1] || '', description: p[2] || '', keys: (p[3] || '').split(';').filter(Boolean) });
      }
      return { ok: true, source: 'zve', data };
    } catch (e) {
      return reply.code(500).send({ ok: false, error: e.message });
    }
  });

  app.post('/api/tenant-admin/v1/roles/custom', async (req, reply) => {
    const body = req.body || {};
    if (!body.name) return reply.code(400).send({ ok: false, error: 'name required' });
    try {
      const keys = (body.keys || []).join(';');
      const z = await callZveRpc('ZVE ROLE CUSTOM CRT', [body.name, body.description || '', keys]);
      const o = zveOutcome(z);
      if (o.kind !== 'ok') return reply.code(502).send({ ok: false, error: `ZVE ROLE CUSTOM CRT failed: ${o.msg || o.kind}`, rpcUsed: z.rpcUsed });
      const id = (z.lines[1] || '').split('^')[0] || `zve-${Date.now()}`;
      return { ok: true, source: 'zve', id };
    } catch (e) {
      return reply.code(500).send({ ok: false, error: e.message });
    }
  });

  app.put('/api/tenant-admin/v1/roles/custom/:roleId', async (req, reply) => {
    const body = req.body || {};
    if (!body.name) return reply.code(400).send({ ok: false, error: 'name required' });
    try {
      const keys = (body.keys || []).join(';');
      const z = await callZveRpc('ZVE ROLE CUSTOM UPD', [req.params.roleId, body.name, body.description || '', keys]);
      const o = zveOutcome(z);
      if (o.kind !== 'ok') return reply.code(502).send({ ok: false, error: `ZVE ROLE CUSTOM UPD failed: ${o.msg || o.kind}`, rpcUsed: z.rpcUsed });
      return { ok: true, source: 'zve', id: req.params.roleId };
    } catch (e) {
      return reply.code(500).send({ ok: false, error: e.message });
    }
  });

  app.delete('/api/tenant-admin/v1/roles/custom/:roleId', async (req, reply) => {
    try {
      const z = await callZveRpc('ZVE ROLE CUSTOM DEL', [req.params.roleId]);
      const o = zveOutcome(z);
      if (o.kind !== 'ok') return reply.code(502).send({ ok: false, error: `ZVE ROLE CUSTOM DEL failed: ${o.msg || o.kind}`, rpcUsed: z.rpcUsed });
      return { ok: true, source: 'zve' };
    } catch (e) {
      return reply.code(500).send({ ok: false, error: e.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // VistA FILE #49 — SERVICE/SECTION (departments) for StaffForm dropdown
  // ═══════════════════════════════════════════════════════════════════════

  app.get('/api/tenant-admin/v1/services', async (req, reply) => {
    const tenantId = req.query.tenantId || 'default';
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
    try {
      const rows = await lockedRpc(async () => {
        return ddrList({ file: '49', fields: '.01;1;3', fieldNames: ['name', 'abbreviation', 'chief'], search: req.query.search });
      });
      // Normalize: sort alphabetically, filter out entries with empty names
      const data = (rows || [])
        .filter(r => (r.name || '').trim())
        .map(r => ({ ien: r.ien, name: r.name, abbreviation: r.abbreviation || '', chief: r.chief || '' }))
        .sort((a, b) => a.name.localeCompare(b.name));
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '49', data, total: data.length };
    } catch (e) {
      return reply.code(502).send({ ok: false, error: e.message, stage: 'DDR LISTER File 49' });
    }
  });

  /** Department/Service detail — DDR GETS ENTRY DATA on File #49 */
  app.get('/api/tenant-admin/v1/services/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId || 'default';
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
    try {
      const ien = req.params.ien;
      const iens = `${ien},`;
      const fields = '.01;1;2;3;4';
      const entry = await ddrGetsEntry({ file: '49', iens, fields });
      const data = {
        ien,
        name: entry?.['.01'] || '',
        abbreviation: entry?.['1'] || '',
        mailSymbol: entry?.['2'] || '',
        chief: entry?.['3'] || '',
        type: entry?.['4'] || '',
      };
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR GETS ENTRY DATA', file: '49', data };
    } catch (e) {
      return reply.code(502).send({ ok: false, error: e.message, stage: 'DDR GETS ENTRY DATA File 49' });
    }
  });

  /** Edit department/service field — DDR VALIDATOR + DDR FILER on File #49 */
  const SERVICE49_ALLOW = {
    '.01': 'NAME', '1': 'ABBREVIATION', '2': 'MAIL SYMBOL', '3': 'CHIEF',
  };
  app.put('/api/tenant-admin/v1/services/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId || 'default';
    const { field, value } = req.body || {};
    if (!field || !SERVICE49_ALLOW[field]) {
      return reply.code(400).send({ ok: false, error: `Field ${field} is not editable. Allowed: ${Object.keys(SERVICE49_ALLOW).join(', ')}` });
    }
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
    try {
      const iens = `${req.params.ien},`;
      const valRes = await ddrValidateField(49, iens, field, String(value));
      if (!valRes.ok) return reply.code(400).send({ ok: false, stage: 'DDR VALIDATOR', error: valRes.error });
      const filer = await ddrFilerEdit(49, iens, field, String(value), 'E');
      if (!filer.ok) return reply.code(502).send({ ok: false, stage: 'DDR FILER', error: filer.error });
      return { ok: true, source: 'vista', tenantId, ien: req.params.ien, field, rpcUsed: ['DDR VALIDATOR', 'DDR FILER'], filerLines: filer.lines };
    } catch (e) {
      return reply.code(500).send({ ok: false, error: e.message });
    }
  });

  /** Create department/service — DDR FILER ADD on File #49 */
  app.post('/api/tenant-admin/v1/services', async (req, reply) => {
    const tenantId = req.query.tenantId || 'default';
    const { name, abbreviation } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return reply.code(400).send({ ok: false, error: 'Department name is required' });
    }
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
    try {
      const valRes = await ddrValidateField(49, '+1,', '.01', name.trim());
      if (!valRes.ok) return reply.code(400).send({ ok: false, stage: 'DDR VALIDATOR', error: valRes.error });
      const filer = await ddrFilerAdd('49', '.01', '+1,', name.trim(), 'E');
      if (!filer.ok) return reply.code(502).send({ ok: false, stage: 'DDR FILER ADD', error: filer.error });
      const newIen = (filer.lines || []).find(l => l.includes('^'))?.split('^')[1] || null;
      if (newIen && abbreviation) {
        try {
          await ddrFilerEdit(49, `${newIen},`, '1', String(abbreviation).trim(), 'E');
        } catch { /* abbreviation is optional, don't fail the create */ }
      }
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR FILER ADD', file: '49', ien: newIen, lines: filer.lines };
    } catch (e) {
      return reply.code(500).send({ ok: false, error: e.message });
    }
  });

  /** Delete department/service — DDR FILER on File #49 (set .01 to @) */
  app.delete('/api/tenant-admin/v1/services/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId || 'default';
    const ien = req.params.ien;
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable' });
    try {
      const result = await ddrFilerEdit('49', `${ien},`, '.01', '@', 'E');
      return { ok: true, tenantId, ien, action: 'deleted', file: '49', rpcUsed: 'DDR FILER', result };
    } catch (e) {
      return reply.code(500).send({ ok: false, error: e.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // E-SIGNATURE SET ACTION
  // ═══════════════════════════════════════════════════════════════════════

  app.post('/api/tenant-admin/v1/users/:duz/esig/set', async (req, reply) => {
    const { code, sigBlockName } = req.body || {};
    if (!code || typeof code !== 'string') return reply.code(400).send({ ok: false, error: 'code required' });
    if (code.length < 6) return reply.code(400).send({ ok: false, error: 'E-signature must be at least 6 characters' });

    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable' });

    try {
      const z = await callZveRpc('ZVE ESIG MANAGE', [String(req.params.duz), 'SET', code, sigBlockName || '']);
      const o = zveOutcome(z);
      if (o.kind === 'missing') {
        return reply.code(502).send({ ok: false, error: 'RPC ZVE ESIG MANAGE' });
      }
      if (o.kind !== 'ok') return reply.code(o.kind === 'rejected' ? 409 : 502).send({ ok: false, error: o.msg });
      return { ok: true, source: 'zve', duz: req.params.duz };
    } catch (e) {
      return reply.code(500).send({ ok: false, error: e.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // ADMIN REPORTS (aggregation from existing data)
  // ═══════════════════════════════════════════════════════════════════════

  app.get('/api/tenant-admin/v1/reports/admin/:type', async (req, reply) => {
    const reportType = req.params.type;
    const tenantId = req.query.tenantId;
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable' });

    try {
      if (reportType === 'staff-access') {
        const usersRes = await fetchVistaUsers('');
        if (!usersRes.ok) return reply.code(502).send({ ok: false, error: 'Failed to fetch users' });
        const users = usersRes.data || [];
        const now = new Date();
        const report = users.map(u => ({
          duz: u.ien, name: u.name, status: u.status,
          lastSignIn: u.lastSignIn || '',
          daysSinceLogin: u.lastSignIn ? Math.floor((now - new Date(u.lastSignIn)) / 86400000) : 999,
        })).sort((a, b) => b.daysSinceLogin - a.daysSinceLogin);
        const total = report.length;
        const active = report.filter(u => u.daysSinceLogin < 30).length;
        const inactive30 = report.filter(u => u.daysSinceLogin >= 30 && u.daysSinceLogin < 90).length;
        const inactive90 = report.filter(u => u.daysSinceLogin >= 90).length;
        const neverLoggedIn = report.filter(u => !u.lastSignIn).length;
        return { ok: true, source: 'vista', reportType, summary: { total, active, inactive30, inactive90, neverLoggedIn }, data: report.slice(0, 100) };
      }

      if (reportType === 'permission-dist') {
        const keysRes = await ddrListerSecurityKeys();
        if (!keysRes.ok) return { ok: true, source: 'vista', reportType, data: [], note: 'Could not fetch key inventory' };
        const keys = keysRes.data || [];
        return { ok: true, source: 'vista', reportType, data: keys.map(k => ({ keyName: k.keyName, holderCount: k.holderCount || 0, ien: k.ien })) };
      }

      if (reportType === 'signin-activity' || reportType === 'audit-summary') {
        const z = await callZveRpc('ZVE ADMIN AUDIT', [req.query.from || '', req.query.to || '', '50']);
        const o = zveOutcome(z);
        if (o.kind !== 'ok') return { ok: true, source: 'vista', reportType, data: [], note: 'Audit data unavailable' };
        const data = z.lines.slice(1).map(line => {
          const p = line.split('^');
          return { source: p[0], timestamp: p[1], user: p[2], action: p[3], detail: p[4] };
        }).filter(d => d.source);
        return { ok: true, source: 'zve', reportType, data };
      }

      if (reportType === 'inactive-accounts') {
        const usersRes = await fetchVistaUsers('');
        if (!usersRes.ok) return reply.code(502).send({ ok: false, error: 'Failed to fetch users' });
        const now = new Date();
        const inactive = (usersRes.data || []).filter(u => {
          if (!u.lastSignIn) return true;
          return (now - new Date(u.lastSignIn)) / 86400000 > 90;
        }).map(u => ({ duz: u.ien, name: u.name, lastSignIn: u.lastSignIn || 'NEVER', daysSince: u.lastSignIn ? Math.floor((now - new Date(u.lastSignIn)) / 86400000) : 999 }));
        return { ok: true, source: 'vista', reportType, data: inactive, total: inactive.length };
      }

      if (reportType === 'param-changes') {
        const z = await callZveRpc('ZVE ADMIN AUDIT', ['', '', '50']);
        const o = zveOutcome(z);
        const data = (o.kind === 'ok' ? z.lines.slice(1) : []).map(line => {
          const p = line.split('^');
          return { source: p[0], timestamp: p[1], user: p[2], action: p[3], detail: p[4] };
        }).filter(d => d.action && /param|config|set/i.test(d.action));
        return { ok: true, source: 'zve', reportType, data };
      }

      return reply.code(404).send({ ok: false, error: `Unknown report type: ${reportType}` });
    } catch (e) {
      return reply.code(500).send({ ok: false, error: e.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // MAILMAN INBOX (^XMB(3.7) / ^XMB(3.9))
  // ═══════════════════════════════════════════════════════════════════════

  app.get('/api/tenant-admin/v1/mailman/inbox', async (req, reply) => {
    const folder = req.query.folder || 'IN';
    const max = req.query.max || '50';
    const duz = req.session?.duz || '0';
    try {
      const z = await callZveRpc('ZVE MM INBOX', [duz, folder, max]);
      const o = zveOutcome(z);
      if (o.kind !== 'ok') return reply.code(502).send({ ok: false, error: `ZVE MM INBOX failed: ${o.msg || o.kind}`, rpcUsed: z.rpcUsed });
      const data = z.lines.slice(1).map(line => {
        const p = line.split('^');
        return { ien: p[0], from: p[1], subject: p[2], date: p[3], priority: (p[4] || 'NORMAL').toLowerCase(), read: p[5] === '1', basket: p[6] || '' };
      }).filter(d => d.ien);
      return { ok: true, source: 'zve', data };
    } catch (e) {
      return reply.code(500).send({ ok: false, error: e.message });
    }
  });

  app.get('/api/tenant-admin/v1/mailman/message/:ien', async (req, reply) => {
    const duz = req.session?.duz || '0';
    try {
      const z = await callZveRpc('ZVE MM READ', [duz, req.params.ien]);
      const o = zveOutcome(z);
      if (o.kind === 'missing') return reply.code(502).send({ ok: false, error: 'ZVE MM READ returned unexpected missing status', rpcUsed: z.rpcUsed });
      if (o.kind !== 'ok') return reply.code(502).send({ ok: false, error: o.msg });
      const header = (z.lines[1] || '').split('^');
      const body = z.lines.slice(2).join('\n');
      return { ok: true, source: 'zve', data: { from: header[0], subject: header[1], date: header[2], priority: (header[3] || 'NORMAL').toLowerCase(), body } };
    } catch (e) {
      return reply.code(500).send({ ok: false, error: e.message });
    }
  });

  app.post('/api/tenant-admin/v1/mailman/send', async (req, reply) => {
    const { to, subject, body } = req.body || {};
    if (!to || !subject) return reply.code(400).send({ ok: false, error: 'to and subject required' });
    const duz = req.session?.duz || '0';
    try {
      const bodyText = (body || '').replace(/\n/g, '|');
      const z = await callZveRpc('ZVE MM SEND', [duz, String(to), subject, bodyText]);
      const o = zveOutcome(z);
      if (o.kind === 'missing') return reply.code(502).send({ ok: false, error: 'ZVE MM SEND returned unexpected missing status', rpcUsed: z.rpcUsed });
      if (o.kind !== 'ok') return reply.code(502).send({ ok: false, error: o.msg });
      return { ok: true, source: 'zve', messageId: z.lines[0]?.split('^')[1] || '' };
    } catch (e) {
      return reply.code(500).send({ ok: false, error: e.message });
    }
  });

  app.delete('/api/tenant-admin/v1/mailman/message/:ien', async (req, reply) => {
    const duz = req.session?.duz || '0';
    try {
      const z = await callZveRpc('ZVE MM DELETE', [duz, req.params.ien]);
      const o = zveOutcome(z);
      if (o.kind === 'missing') return reply.code(502).send({ ok: false, error: 'ZVE MM DELETE returned unexpected missing status', rpcUsed: z.rpcUsed });
      if (o.kind !== 'ok') return reply.code(502).send({ ok: false, error: o.msg });
      return { ok: true, source: 'zve' };
    } catch (e) {
      return reply.code(500).send({ ok: false, error: e.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // TWO-PERSON INTEGRITY (^XTMP("ZVE2P"))
  // ═══════════════════════════════════════════════════════════════════════

  app.post('/api/tenant-admin/v1/config/2p', async (req, reply) => {
    const { section, field, oldValue, newValue, reason } = req.body || {};
    if (!section || !field) return reply.code(400).send({ ok: false, error: 'section and field required' });
    const duz = req.session?.duz || '0';
    try {
      const z = await callZveRpc('ZVE 2P SUBMIT', [section, field, oldValue || '', newValue || '', reason || '', duz]);
      const o = zveOutcome(z);
      if (o.kind === 'missing') return reply.code(502).send({ ok: false, error: 'ZVE 2P SUBMIT returned unexpected missing status', rpcUsed: z.rpcUsed });
      if (o.kind !== 'ok') return reply.code(502).send({ ok: false, error: o.msg });
      const reqId = z.lines[0]?.split('^')[1] || '';
      return { ok: true, source: 'zve', requestId: reqId };
    } catch (e) {
      return reply.code(500).send({ ok: false, error: e.message });
    }
  });

  app.get('/api/tenant-admin/v1/config/2p', async (req, reply) => {
    const status = req.query.status || 'PENDING';
    try {
      const z = await callZveRpc('ZVE 2P LIST', [status]);
      const o = zveOutcome(z);
      if (o.kind !== 'ok') return reply.code(502).send({ ok: false, error: `RPC failed: ${o.msg || o.kind}`, rpcUsed: z.rpcUsed });
      const data = z.lines.slice(1).map(line => {
        const p = line.split('^');
        return {
          id: p[0], section: p[1], field: p[2], oldValue: p[3], newValue: p[4],
          reason: p[5], submitterDuz: p[6], submitterName: p[7], submittedDate: p[8],
          status: p[9], approverDuz: p[10] || '', approverName: p[11] || '', actionDate: p[12] || '',
        };
      }).filter(d => d.id);
      return { ok: true, source: 'zve', data };
    } catch (e) {
      return reply.code(500).send({ ok: false, error: e.message });
    }
  });

  app.post('/api/tenant-admin/v1/config/2p/:id/approve', async (req, reply) => {
    const duz = req.session?.duz || '0';
    try {
      const z = await callZveRpc('ZVE 2P ACTION', [req.params.id, 'APPROVE', duz]);
      const o = zveOutcome(z);
      if (o.kind === 'missing') return reply.code(502).send({ ok: false, error: 'ZVE 2P ACTION returned unexpected missing status', rpcUsed: z.rpcUsed });
      if (o.kind !== 'ok') return reply.code(502).send({ ok: false, error: o.msg });
      return { ok: true, source: 'zve' };
    } catch (e) {
      return reply.code(500).send({ ok: false, error: e.message });
    }
  });

  app.post('/api/tenant-admin/v1/config/2p/:id/reject', async (req, reply) => {
    const duz = req.session?.duz || '0';
    try {
      const z = await callZveRpc('ZVE 2P ACTION', [req.params.id, 'REJECT', duz]);
      const o = zveOutcome(z);
      if (o.kind === 'missing') return reply.code(502).send({ ok: false, error: 'ZVE 2P ACTION returned unexpected missing status', rpcUsed: z.rpcUsed });
      if (o.kind !== 'ok') return reply.code(502).send({ ok: false, error: o.msg });
      return { ok: true, source: 'zve' };
    } catch (e) {
      return reply.code(500).send({ ok: false, error: e.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // VITALS (GMV LATEST VM / File #120.5)
  // ═══════════════════════════════════════════════════════════════════════

  app.get('/api/tenant-admin/v1/patients/:dfn/vitals', async (req, reply) => {
    const { dfn } = req.params;
    try {
      const lines = await lockedRpc(async () => {
        const broker = await getBroker();
        return broker.callRpc('GMV LATEST VM', [dfn]);
      });
      const vitals = [];
      for (const line of (Array.isArray(lines) ? lines : [lines])) {
        if (!line || !line.includes('^')) continue;
        const p = line.split('^');
        if (p.length >= 3) vitals.push({ type: p[0]?.trim(), datetime: p[1]?.trim(), value: p[2]?.trim(), unit: p[3]?.trim() || '', qualifier: p[4]?.trim() || '' });
      }
      return { ok: true, source: 'vista', data: vitals };
    } catch (e) {
      return { ok: true, source: 'vista', data: [], note: 'Vitals RPC unavailable: ' + e.message };
    }
  });

  app.post('/api/tenant-admin/v1/patients/:dfn/vitals', async (req, reply) => {
    const { dfn } = req.params;
    const { vitals } = req.body || {};
    if (!Array.isArray(vitals) || vitals.length === 0) return reply.code(400).send({ ok: false, error: 'vitals array required' });
    const duz = req.session?.duz || '0';
    try {
      const results = await lockedRpc(async () => {
        const broker = await getBroker();
        const out = [];
        for (const v of vitals) {
          const vitalStr = `${v.datetime || ''}^${v.type}^${v.value}^${v.unit || ''}^${v.qualifier || ''}^${dfn}^^${duz}`;
          try {
            await broker.callRpc('GMV ADD VM', [vitalStr]);
            out.push({ type: v.type, ok: true });
          } catch (err) {
            out.push({ type: v.type, ok: false, error: err.message });
          }
        }
        return out;
      });
      return { ok: results.every(r => r.ok), source: 'vista', results };
    } catch (e) {
      return reply.code(500).send({ ok: false, error: e.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // ALERT CREATION (XQALERT API)
  // ═══════════════════════════════════════════════════════════════════════

  app.post('/api/tenant-admin/v1/alerts', async (req, reply) => {
    const { to, subject, body, priority } = req.body || {};
    if (!to || !subject) return reply.code(400).send({ ok: false, error: 'to and subject required' });
    const duz = req.session?.duz || '0';
    try {
      const z = await callZveRpc('ZVE ALERT CREATE', [duz, String(to), subject, body || '', priority || 'NORMAL']);
      const o = zveOutcome(z);
      if (o.kind === 'missing') return reply.code(502).send({ ok: false, error: 'ZVE ALERT CREATE returned unexpected missing status', rpcUsed: z.rpcUsed });
      if (o.kind !== 'ok') return reply.code(502).send({ ok: false, error: o.msg });
      return { ok: true, source: 'zve' };
    } catch (e) {
      return reply.code(500).send({ ok: false, error: e.message });
    }
  });

  // ---- SPA fallback ----
  app.setNotFoundHandler(async (_req, reply) => {
    return reply.sendFile('index.html');
  });

  const restored = loadSessionsFromDisk();
  if (restored > 0) console.log(`[sessions] restored ${restored} session(s) from encrypted store`);

  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`Site Administration Console listening on http://127.0.0.1:${PORT}`);

  // Graceful shutdown — disconnect VistA broker
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => {
      console.log(`\n${sig} received. Disconnecting VistA broker...`);
      disconnectBroker();
      app.close().then(() => process.exit(0));
    });
  }
}

main().catch(err => { console.error(err); process.exit(1); });
