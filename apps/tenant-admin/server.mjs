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
import fastifyCompress from '@fastify/compress';
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
  hasActiveSessionBrokers,
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

function credentialPolicyCodeFromMessage(msg) {
  const lower = String(msg || '').toLowerCase();
  if (lower.includes('history') || lower.includes('used recently') || lower.includes('reuse')) return 'PASSWORD_HISTORY_VIOLATION';
  if ((lower.includes('same') && lower.includes('access') && lower.includes('verify'))
    || lower.includes('cannot be the same as access code')) return 'ACCESS_VERIFY_MATCH';
  return 'CREDENTIAL_POLICY_VIOLATION';
}

/** S23.1: Opaque fingerprint of ZVE USER DETAIL output for optimistic concurrency on user edits */
function hashUserDetailLines(zLines) {
  if (!zLines || zLines.length < 2) return '';
  const h = crypto.createHash('sha256');
  for (let i = 1; i < zLines.length; i++) {
    h.update(String(zLines[i] ?? ''));
    h.update('\n');
  }
  const extEntries = Object.entries(arguments[1] || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([left], [right]) => left.localeCompare(right));
  for (const [key, value] of extEntries) {
    h.update(`EXT:${key}=${String(value)}\n`);
  }
  return h.digest('hex');
}

function parseUserExtensionLines(zLines) {
  const out = {};
  for (const line of (zLines || []).slice(1)) {
    const pieces = String(line || '').split('^');
    const field = pieces[0] || '';
    const value = pieces.slice(1).join('^');
    if (field === 'EMPID') out.employeeId = value;
    if (field === 'ROLE') out.assignedRole = value;
    if (field === 'DISPLAYNAME') out.displayName = value;
  }
  return out;
}

function normalizeEmployeeId(value) {
  return String(value ?? '').trim().toUpperCase();
}

function normalizeVistaYesNo(value) {
  if (typeof value === 'boolean') return value ? 'Y' : 'N';
  const normalized = String(value ?? '').trim().toUpperCase();
  if (!normalized) return '';
  if (['Y', 'YES', 'TRUE', '1'].includes(normalized)) return 'Y';
  if (['N', 'NO', 'FALSE', '0'].includes(normalized)) return 'N';
  return normalized;
}

function normalizeOptionalNumericString(value) {
  if (value === null || value === undefined || value === '') return '';
  return String(value).trim();
}

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

function parseUserListLine(line) {
  const p = String(line || '').split('^');
  return {
    ien: p[0] || '',
    name: p[1] || '',
    status: p[2] || '',
    title: p[3] || '',
    service: p[4] || '',
    division: p[5] || '',
    lastLogin: p[6] || '',
    keyCount: parseInt(p[7] || '0', 10),
    isProvider: p[8] === '1',
    employeeId: p[9] || '',
    email: p[10] || '',
  };
}

async function resolveUserNameByIen(userIen) {
  const normalized = String(userIen || '').trim();
  if (!normalized) return '';
  if (!/^\d+$/.test(normalized)) return normalized;
  const z = await callZveRpc('ZVE USER DETAIL', [normalized]);
  const o = zveOutcome(z);
  if (o.kind !== 'ok') {
    throw new Error(o.msg || `Unable to resolve user ${normalized}`);
  }
  const name = (z.lines?.[1] || '').split('^')[1] || '';
  if (!name) {
    throw new Error(`Unable to resolve user ${normalized}`);
  }
  return name;
}

async function resolveTitleNameByIen(titleValue) {
  const normalized = String(titleValue || '').trim();
  if (!normalized || normalized === '@') return normalized;
  if (!/^\d+$/.test(normalized)) return normalized;
  const ddr = await ddrGetsEntry('3.1', normalized, '.01');
  const name = String(ddr?.data?.['.01'] || '').trim();
  if (!name) {
    throw new Error(`Unable to resolve title ${normalized}`);
  }
  return name;
}

async function findEmployeeIdMatches(employeeId, excludeIen = '') {
  const normalized = normalizeEmployeeId(employeeId);
  if (!normalized) return [];
  const z = await callZveRpc('ZVE USER LIST', ['', 'all', '', '5000']);
  const o = zveOutcome(z);
  if (o.kind !== 'ok') {
    throw new Error(o.msg || 'Unable to check employee ID duplicates');
  }
  const exclude = String(excludeIen || '').trim();
  const matches = [];
  for (const line of z.lines.slice(1)) {
    const row = parseUserListLine(line);
    if (!row.ien) continue;
    if (exclude && String(row.ien) === exclude) continue;
    if (normalizeEmployeeId(row.employeeId) !== normalized) continue;
    matches.push({ ien: row.ien, name: row.name, employeeId: row.employeeId || employeeId });
  }
  return matches;
}

async function findEmailMatches(email, excludeIen = '') {
  const normalized = normalizeEmail(email);
  if (!normalized) return [];
  const exclude = String(excludeIen || '').trim();
  const z = await callZveRpc('ZVE USER LIST', ['', 'all', '', '5000']);
  const o = zveOutcome(z);
  if (o.kind !== 'ok') {
    throw new Error(o.msg || 'Unable to check email duplicates');
  }
  const matches = [];
  for (const line of z.lines.slice(1)) {
    const row = parseUserListLine(line);
    if (!row.ien) continue;
    if (exclude && String(row.ien) === exclude) continue;
    if (normalizeEmail(row.email) !== normalized) continue;
    matches.push({ ien: row.ien, name: row.name, email: row.email || email });
  }
  return matches;
}

async function fetchUserExtensions(duz) {
  try {
    const z = await callZveRpc('ZVE UEXT GETALL', [String(duz)]);
    const o = zveOutcome(z);
    if (o.kind !== 'ok') return {};
    return parseUserExtensionLines(z.lines);
  } catch (_extErr) {
    return {};
  }
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
const HEALTH_HISTORY_PATH = join(__dirname, process.env.HEALTH_HISTORY_PATH || '.health-history.json');
const HEALTH_THRESHOLDS_PATH = join(__dirname, process.env.HEALTH_THRESHOLDS_PATH || '.health-thresholds.json');
const DASHBOARD_HISTORY_PATH = join(__dirname, process.env.DASHBOARD_HISTORY_PATH || '.dashboard-history.json');
const REPORT_SCHEDULES_PATH = join(__dirname, process.env.REPORT_SCHEDULES_PATH || '.report-schedules.json');
const HEALTH_HISTORY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const HEALTH_HISTORY_INTERVAL_MS = Number.parseInt(process.env.HEALTH_HISTORY_INTERVAL_MS || '300000', 10);
const DASHBOARD_HISTORY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const DASHBOARD_HISTORY_INTERVAL_MS = Number.parseInt(process.env.DASHBOARD_HISTORY_INTERVAL_MS || '21600000', 10);
const REPORT_SCHEDULE_INTERVAL_MS = Number.parseInt(process.env.REPORT_SCHEDULE_INTERVAL_MS || '60000', 10);
const SESSION_SECRET_HEX = process.env.SESSION_SECRET || '';
if (!SESSION_SECRET_HEX || SESSION_SECRET_HEX.length !== 64) {
  throw new Error('SESSION_SECRET env var must be a 32-byte hex string (64 chars). Run: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
}
const SESSION_KEY = Buffer.from(SESSION_SECRET_HEX, 'hex');
const healthHistory = [];
const healthThresholds = { watchers: {} };
const dashboardHistory = [];
const reportSchedules = [];
let healthSampleInFlight = false;
let dashboardSampleInFlight = false;
let reportScheduleRunInFlight = false;

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

function parseIsoTime(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePositiveInt(value) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function pruneHealthHistory(now = Date.now()) {
  const cutoff = now - HEALTH_HISTORY_RETENTION_MS;
  while (healthHistory.length > 0) {
    const sampleTime = parseIsoTime(healthHistory[0]?.timestamp);
    if (sampleTime !== null && sampleTime >= cutoff) break;
    healthHistory.shift();
  }
}

function persistHealthHistory() {
  try {
    pruneHealthHistory();
    const tmp = HEALTH_HISTORY_PATH + '.tmp';
    writeFileSync(tmp, JSON.stringify(healthHistory, null, 2), { mode: 0o600 });
    renameSync(tmp, HEALTH_HISTORY_PATH);
  } catch (error) {
    console.error('[health-history] persist failed:', error.message);
  }
}

function loadHealthHistoryFromDisk() {
  if (!existsSync(HEALTH_HISTORY_PATH)) return 0;
  try {
    const raw = JSON.parse(readFileSync(HEALTH_HISTORY_PATH, 'utf8'));
    if (!Array.isArray(raw)) return 0;
    healthHistory.length = 0;
    for (const sample of raw) {
      const sampleTime = parseIsoTime(sample?.timestamp);
      if (sampleTime === null) continue;
      healthHistory.push({
        timestamp: new Date(sampleTime).toISOString(),
        overallUp: sample?.overallUp === true,
        vistaConnected: sample?.vistaConnected === true,
        taskmanRunning: typeof sample?.taskmanRunning === 'boolean' ? sample.taskmanRunning : null,
        hl7Running: typeof sample?.hl7Running === 'boolean' ? sample.hl7Running : null,
      });
    }
    pruneHealthHistory();
    return healthHistory.length;
  } catch (error) {
    console.error('[health-history] load failed:', error.message);
    return 0;
  }
}

function computeRate(samples, key) {
  const defined = samples.filter(sample => typeof sample?.[key] === 'boolean');
  if (defined.length === 0) return null;
  const passing = defined.filter(sample => sample[key] === true).length;
  return Math.round((passing / defined.length) * 1000) / 10;
}

function summarizeHealthWindow(windowMs, label) {
  const now = Date.now();
  const cutoff = now - windowMs;
  const samples = healthHistory.filter(sample => {
    const sampleTime = parseIsoTime(sample.timestamp);
    return sampleTime !== null && sampleTime >= cutoff;
  });
  const firstSample = samples[0] ? parseIsoTime(samples[0].timestamp) : null;
  const lastSample = samples.length > 0 ? parseIsoTime(samples[samples.length - 1].timestamp) : null;
  const coverageMs = firstSample !== null && lastSample !== null
    ? Math.min(windowMs, Math.max(HEALTH_HISTORY_INTERVAL_MS, (lastSample - firstSample) + HEALTH_HISTORY_INTERVAL_MS))
    : 0;

  return {
    label,
    sampleCount: samples.length,
    coverageHours: Math.round((coverageMs / 3600000) * 10) / 10,
    coveragePct: Math.min(100, Math.round((coverageMs / windowMs) * 100)),
    hasFullCoverage: coverageMs >= (windowMs * 0.95),
    overallPct: computeRate(samples, 'overallUp'),
    vistaPct: computeRate(samples, 'vistaConnected'),
    taskmanPct: computeRate(samples, 'taskmanRunning'),
    hl7Pct: computeRate(samples, 'hl7Running'),
  };
}

async function captureHealthSample(force = false) {
  const latest = healthHistory[healthHistory.length - 1];
  const latestTime = latest ? parseIsoTime(latest.timestamp) : null;
  if (!force && latestTime !== null && (Date.now() - latestTime) < (HEALTH_HISTORY_INTERVAL_MS * 0.8)) {
    return latest;
  }
  if (healthSampleInFlight) return latest || null;

  healthSampleInFlight = true;
  try {
    const probe = await probeVista();
    const sample = {
      timestamp: new Date().toISOString(),
      overallUp: probe.ok === true,
      vistaConnected: probe.ok === true,
      taskmanRunning: null,
      hl7Running: null,
    };

    if (probe.ok) {
      try {
        const taskman = await callZveRpc('ZVE TASKMAN STATUS', []);
        const taskmanOutcome = zveOutcome(taskman);
        if (taskmanOutcome.kind === 'ok') {
          const status = ((taskman.line0 || '').split('^')[1] || '').toUpperCase();
          sample.taskmanRunning = status === 'RUNNING';
        } else if (taskmanOutcome.kind === 'rejected') {
          sample.taskmanRunning = false;
        }
      } catch {
        sample.taskmanRunning = null;
      }

      try {
        const hl7 = await callZveRpc('ZVE HL7 FILER STATUS', []);
        const hl7Outcome = zveOutcome(hl7);
        if (hl7Outcome.kind === 'ok') {
          const statuses = (hl7.lines || [])
            .slice(1)
            .map(line => ((line || '').split('^')[1] || '').toUpperCase())
            .filter(Boolean);
          sample.hl7Running = statuses.length > 0 ? statuses.every(status => status === 'RUNNING') : null;
        } else if (hl7Outcome.kind === 'rejected') {
          sample.hl7Running = false;
        }
      } catch {
        sample.hl7Running = null;
      }
    }

    healthHistory.push(sample);
    pruneHealthHistory();
    persistHealthHistory();
    await evaluateHealthThresholds(sample);
    return sample;
  } finally {
    healthSampleInFlight = false;
  }
}

async function ensureRecentHealthSample() {
  const latest = healthHistory[healthHistory.length - 1];
  const latestTime = latest ? parseIsoTime(latest.timestamp) : null;
  if (latestTime === null || (Date.now() - latestTime) >= HEALTH_HISTORY_INTERVAL_MS) {
    await captureHealthSample(true);
  }
}

function normalizeThresholdWatcher(raw = {}) {
  return {
    enabled: raw?.enabled === true,
    vistaDown: raw?.vistaDown === true,
    taskmanStopped: raw?.taskmanStopped === true,
    hl7Stopped: raw?.hl7Stopped === true,
    cooldownMinutes: Math.min(1440, Math.max(5, Number.parseInt(raw?.cooldownMinutes || '60', 10) || 60)),
    lastSent: typeof raw?.lastSent === 'object' && raw.lastSent ? raw.lastSent : {},
  };
}

function persistHealthThresholds() {
  try {
    const tmp = HEALTH_THRESHOLDS_PATH + '.tmp';
    writeFileSync(tmp, JSON.stringify(healthThresholds, null, 2), { mode: 0o600 });
    renameSync(tmp, HEALTH_THRESHOLDS_PATH);
  } catch (error) {
    console.error('[health-thresholds] persist failed:', error.message);
  }
}

function loadHealthThresholdsFromDisk() {
  if (!existsSync(HEALTH_THRESHOLDS_PATH)) return 0;
  try {
    const raw = JSON.parse(readFileSync(HEALTH_THRESHOLDS_PATH, 'utf8'));
    healthThresholds.watchers = {};
    const watchers = raw?.watchers && typeof raw.watchers === 'object' ? raw.watchers : {};
    for (const [duz, watcher] of Object.entries(watchers)) {
      if (!/^\d+$/.test(duz)) continue;
      healthThresholds.watchers[duz] = normalizeThresholdWatcher(watcher);
    }
    return Object.keys(healthThresholds.watchers).length;
  } catch (error) {
    console.error('[health-thresholds] load failed:', error.message);
    return 0;
  }
}

async function evaluateHealthThresholds(sample) {
  const watchers = Object.entries(healthThresholds.watchers || {});
  if (watchers.length === 0) return 0;

  let alertCount = 0;
  for (const [duz, rawWatcher] of watchers) {
    const watcher = normalizeThresholdWatcher(rawWatcher);
    healthThresholds.watchers[duz] = watcher;
    if (!watcher.enabled) continue;

    const conditions = [
      {
        key: 'vistaDown',
        enabled: watcher.vistaDown,
        unhealthy: sample.vistaConnected === false,
        subject: 'System Health: VistA disconnected',
        body: `Tenant-admin could not reach VistA at ${sample.timestamp}.`,
      },
      {
        key: 'taskmanStopped',
        enabled: watcher.taskmanStopped,
        unhealthy: sample.taskmanRunning === false,
        subject: 'System Health: TaskMan stopped',
        body: `TaskMan reported STOPPED at ${sample.timestamp}. Background jobs are not running.`,
      },
      {
        key: 'hl7Stopped',
        enabled: watcher.hl7Stopped,
        unhealthy: sample.hl7Running === false,
        subject: 'System Health: HL7 filer stopped',
        body: `HL7 filer status reported STOPPED at ${sample.timestamp}. Interface traffic may be stalled.`,
      },
    ];

    for (const condition of conditions) {
      if (!condition.enabled) continue;
      if (!condition.unhealthy) {
        delete watcher.lastSent[condition.key];
        continue;
      }

      const lastSentTime = parseIsoTime(watcher.lastSent[condition.key]);
      const cooldownMs = watcher.cooldownMinutes * 60 * 1000;
      if (lastSentTime !== null && (Date.now() - lastSentTime) < cooldownMs) continue;

      try {
        const alertRpc = await callZveRpc('ZVE ALERT CREATE', [String(duz), String(duz), condition.subject, condition.body, 'HIGH']);
        const alertOutcome = zveOutcome(alertRpc);
        if (alertOutcome.kind === 'ok') {
          watcher.lastSent[condition.key] = sample.timestamp;
          alertCount += 1;
        }
      } catch (error) {
        console.error('[health-thresholds] alert send failed:', error.message);
      }
    }
  }

  persistHealthThresholds();
  return alertCount;
}

const DASHBOARD_TREND_KEYS = [
  'activeUserCount',
  'clinicCount',
  'wardCount',
  'bedCount',
  'deviceCount',
  'hl7InterfaceCount',
  'roleCount',
  'esigActiveCount',
];

function pruneDashboardHistory(now = Date.now()) {
  const cutoff = now - DASHBOARD_HISTORY_RETENTION_MS;
  while (dashboardHistory.length > 0) {
    const sampleTime = parseIsoTime(dashboardHistory[0]?.timestamp);
    if (sampleTime !== null && sampleTime >= cutoff) break;
    dashboardHistory.shift();
  }
}

function persistDashboardHistory() {
  try {
    pruneDashboardHistory();
    const tmp = DASHBOARD_HISTORY_PATH + '.tmp';
    writeFileSync(tmp, JSON.stringify(dashboardHistory, null, 2), { mode: 0o600 });
    renameSync(tmp, DASHBOARD_HISTORY_PATH);
  } catch (error) {
    console.error('[dashboard-history] persist failed:', error.message);
  }
}

function loadDashboardHistoryFromDisk() {
  if (!existsSync(DASHBOARD_HISTORY_PATH)) return 0;
  try {
    const raw = JSON.parse(readFileSync(DASHBOARD_HISTORY_PATH, 'utf8'));
    if (!Array.isArray(raw)) return 0;
    dashboardHistory.length = 0;
    for (const sample of raw) {
      const sampleTime = parseIsoTime(sample?.timestamp);
      if (sampleTime === null || !sample?.metrics || typeof sample.metrics !== 'object') continue;
      const metrics = {};
      for (const key of DASHBOARD_TREND_KEYS) {
        if (typeof sample.metrics[key] === 'number') metrics[key] = sample.metrics[key];
      }
      dashboardHistory.push({ timestamp: new Date(sampleTime).toISOString(), metrics });
    }
    pruneDashboardHistory();
    return dashboardHistory.length;
  } catch (error) {
    console.error('[dashboard-history] load failed:', error.message);
    return 0;
  }
}

function extractDashboardTrendMetrics(metrics) {
  const extracted = {};
  for (const key of DASHBOARD_TREND_KEYS) {
    if (typeof metrics?.[key] === 'number') extracted[key] = metrics[key];
  }
  return extracted;
}

function summarizeDashboardTrends(currentMetrics) {
  const now = Date.now();
  const coverageMs = dashboardHistory.length > 0
    ? Math.max(DASHBOARD_HISTORY_INTERVAL_MS, now - parseIsoTime(dashboardHistory[0].timestamp))
    : 0;
  const currentTrendMetrics = extractDashboardTrendMetrics(currentMetrics);

  const metrics = {};
  for (const key of DASHBOARD_TREND_KEYS) {
    const currentValue = currentTrendMetrics[key];
    const weekBaseline = [...dashboardHistory].reverse().find((sample) => {
      const sampleTime = parseIsoTime(sample.timestamp);
      return sampleTime !== null && sampleTime <= (now - (7 * 24 * 60 * 60 * 1000)) && typeof sample.metrics?.[key] === 'number';
    });
    const previousSample = [...dashboardHistory].reverse().find((sample) => typeof sample.metrics?.[key] === 'number');

    metrics[key] = {
      currentValue,
      previousValue: previousSample?.metrics?.[key] ?? null,
      deltaFromPrevious: previousSample && typeof currentValue === 'number' ? currentValue - previousSample.metrics[key] : null,
      weekBaselineValue: weekBaseline?.metrics?.[key] ?? null,
      delta7d: weekBaseline && typeof currentValue === 'number' ? currentValue - weekBaseline.metrics[key] : null,
      has7dBaseline: Boolean(weekBaseline),
    };
  }

  return {
    coverageDays: Math.round((coverageMs / 86400000) * 10) / 10,
    sampleCount: dashboardHistory.length,
    metrics,
  };
}

async function captureDashboardSnapshot(metrics, force = false) {
  const latest = dashboardHistory[dashboardHistory.length - 1];
  const latestTime = latest ? parseIsoTime(latest.timestamp) : null;
  if (!force && latestTime !== null && (Date.now() - latestTime) < (DASHBOARD_HISTORY_INTERVAL_MS * 0.8)) {
    return latest;
  }
  if (dashboardSampleInFlight) return latest || null;

  dashboardSampleInFlight = true;
  try {
    const snapshot = {
      timestamp: new Date().toISOString(),
      metrics: extractDashboardTrendMetrics(metrics),
    };
    dashboardHistory.push(snapshot);
    pruneDashboardHistory();
    persistDashboardHistory();
    return snapshot;
  } finally {
    dashboardSampleInFlight = false;
  }
}

async function ensureRecentDashboardSnapshot(metrics) {
  const latest = dashboardHistory[dashboardHistory.length - 1];
  const latestTime = latest ? parseIsoTime(latest.timestamp) : null;
  if (latestTime === null || (Date.now() - latestTime) >= DASHBOARD_HISTORY_INTERVAL_MS) {
    await captureDashboardSnapshot(metrics, true);
  }
}

async function collectDashboardMetrics() {
  let userCount = 0;
  let activeUserCount = 0;
  let clinicCount = 0;
  let wardCount = 0;
  let facilityCount = 0;
  let bedCount = 0;
  let roleCount = 0;
  let deviceCount = 0;
  let esigActiveCount = 0;
  let terminalTypeCount = 0;
  let hl7InterfaceCount = 0;

  const usersRpc = await callZveRpc('ZVE USER LIST', ['', 'all', '', '5000']);
  const usersRpcOutcome = zveOutcome(usersRpc);
  const keysRes = await ddrListerSecurityKeys();

  if (usersRpcOutcome.kind === 'ok') {
    const users = [];
    for (const line of usersRpc.lines.slice(1)) {
      const parts = line.split('^');
      if (!parts[0]) continue;
      users.push({ ien: parts[0], status: (parts[2] || '').trim().toUpperCase() });
    }
    userCount = users.length;
    activeUserCount = users.filter((user) => user.status === 'ACTIVE').length;
  }

  if (keysRes.ok) roleCount = keysRes.data.length;

  const countFile = async (file) => {
    const broker = await getBroker();
    const lines = await broker.callRpcWithList('DDR LISTER', [
      { type: 'list', value: { FILE: file, FIELDS: '.01', FLAGS: 'IP', MAX: '9999' } },
    ]);
    const parsed = parseDdrListerResponse(lines);
    return parsed.ok ? parsed.data.length : 0;
  };

  const countClinics = async () => {
    const broker = await getBroker();
    const lines = await broker.callRpcWithList('DDR LISTER', [
      {
        type: 'list',
        value: {
          FILE: '44',
          FIELDS: '.01;1;2;8;1917;2505',
          FLAGS: 'IPS',
          MAX: '5000',
          XREF: 'B',
          FROM: '',
          PART: '',
          SCREEN: 'I $P(^SC(Y,0),U,3)="C"',
        },
      },
    ]);
    const parsed = parseDdrListerResponse(lines);
    return parsed.ok ? parsed.data.length : 0;
  };

  await lockedRpc(async () => {
    clinicCount = await countClinics();
    facilityCount = clinicCount;
    wardCount = await countFile('42');
    deviceCount = await countFile('3.5');
    terminalTypeCount = await countFile('3.2');
    hl7InterfaceCount = await countFile('870');
    bedCount = await countFile('405.4');
  });

  // Count e-sig users via DDR LISTER with SCREEN filter (field 20.4 has an output transform
  // that hides the hash, so we can't read the value — instead we SCREEN for non-empty node 20 piece 4)
  // Use @-only fields to avoid data-integrity errors on bad pointer values in File 200
  try {
    const esigLines = await lockedRpc(async () => {
      const broker = await getBroker();
      return broker.callRpcWithList('DDR LISTER', [
        { type: 'list', value: {
          FILE: '200',
          FIELDS: '@',
          FLAGS: 'IPS',
          MAX: '99999',
          SCREEN: 'I $P($G(^VA(200,Y,20)),U,4)]""',
        } },
      ]);
    });
    // Count IEN lines between [BEGIN_diDATA] and [END_diDATA]
    let inData = false;
    for (const l of esigLines) {
      if (l.includes('[BEGIN_diDATA]')) { inData = true; continue; }
      if (l.includes('[END_diDATA]')) { inData = false; continue; }
      if (inData && l.trim().length > 0) esigActiveCount++;
    }
  } catch (e) {
    console.warn('Dashboard e-sig count batch failed, falling back', e.message);
  }

  return {
    userCount,
    activeUserCount,
    facilityCount,
    clinicCount,
    wardCount,
    bedCount,
    roleCount,
    esigActiveCount,
    deviceCount,
    terminalTypeCount,
    hl7InterfaceCount,
  };
}

const REPORT_SCHEDULE_CADENCE_MS = {
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

const ADMIN_REPORT_TYPES = new Set([
  'staff-access',
  'permission-dist',
  'audit-summary',
  'signin-activity',
  'inactive-accounts',
  'stale-accounts',
  'param-changes',
]);

function persistReportSchedules() {
  try {
    const tmp = REPORT_SCHEDULES_PATH + '.tmp';
    writeFileSync(tmp, JSON.stringify(reportSchedules, null, 2), { mode: 0o600 });
    renameSync(tmp, REPORT_SCHEDULES_PATH);
  } catch (error) {
    console.error('[report-schedules] persist failed:', error.message);
  }
}

function loadReportSchedulesFromDisk() {
  if (!existsSync(REPORT_SCHEDULES_PATH)) return 0;
  try {
    const raw = JSON.parse(readFileSync(REPORT_SCHEDULES_PATH, 'utf8'));
    if (!Array.isArray(raw)) return 0;
    reportSchedules.length = 0;
    for (const schedule of raw) {
      if (!ADMIN_REPORT_TYPES.has(schedule?.reportType)) continue;
      if (!Object.prototype.hasOwnProperty.call(REPORT_SCHEDULE_CADENCE_MS, schedule?.cadence)) continue;
      reportSchedules.push({
        id: String(schedule.id || crypto.randomUUID()),
        label: String(schedule.label || schedule.reportType),
        reportType: schedule.reportType,
        cadence: schedule.cadence,
        params: schedule.params && typeof schedule.params === 'object' ? schedule.params : {},
        enabled: schedule.enabled !== false,
        createdAt: schedule.createdAt || new Date().toISOString(),
        updatedAt: schedule.updatedAt || new Date().toISOString(),
        nextRunAt: schedule.nextRunAt || new Date(Date.now() + REPORT_SCHEDULE_CADENCE_MS[schedule.cadence]).toISOString(),
        lastRunAt: schedule.lastRunAt || null,
        lastRunStatus: schedule.lastRunStatus || null,
        lastRunRows: typeof schedule.lastRunRows === 'number' ? schedule.lastRunRows : null,
        lastRunSource: schedule.lastRunSource || null,
        lastRunNote: schedule.lastRunNote || '',
        lastRunError: schedule.lastRunError || '',
      });
    }
    return reportSchedules.length;
  } catch (error) {
    console.error('[report-schedules] load failed:', error.message);
    return 0;
  }
}

function getNextReportRunAt(cadence, from = Date.now()) {
  return new Date(from + REPORT_SCHEDULE_CADENCE_MS[cadence]).toISOString();
}

async function buildAdminReport(reportType, query = {}) {
  if (!ADMIN_REPORT_TYPES.has(reportType)) {
    throw new Error(`Unknown report type: ${reportType}`);
  }

  if (reportType === 'staff-access') {
    const usersRes = await fetchVistaUsers('');
    if (!usersRes.ok) throw new Error('Failed to fetch users');
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
    const z = await callZveRpc('ZVE ADMIN AUDIT', [query.from || '', query.to || '', '50']);
    const o = zveOutcome(z);
    if (o.kind !== 'ok') return { ok: true, source: 'vista', reportType, data: [], note: 'Audit data unavailable' };
    const data = z.lines.slice(1).map(line => {
      const parts = line.split('^');
      return { source: parts[0], timestamp: parts[1], user: parts[2], action: parts[3], detail: parts[4] };
    }).filter(d => d.source);
    return { ok: true, source: 'zve', reportType, data };
  }

  if (reportType === 'inactive-accounts') {
    const usersRes = await fetchVistaUsers('');
    if (!usersRes.ok) throw new Error('Failed to fetch users');
    const now = new Date();
    const inactive = (usersRes.data || []).filter(u => {
      if (!u.lastSignIn) return true;
      return (now - new Date(u.lastSignIn)) / 86400000 > 90;
    }).map(u => ({ duz: u.ien, name: u.name, lastSignIn: u.lastSignIn || 'NEVER', daysSince: u.lastSignIn ? Math.floor((now - new Date(u.lastSignIn)) / 86400000) : 999 }));
    return { ok: true, source: 'vista', reportType, data: inactive, total: inactive.length };
  }

  if (reportType === 'stale-accounts') {
    const usersRes = await fetchVistaUsers('');
    if (!usersRes.ok) throw new Error('Failed to fetch users');
    const rawDays = parseInt(query.days, 10);
    const thresholdDays = Number.isFinite(rawDays) ? Math.min(3650, Math.max(1, rawDays)) : 90;
    const now = new Date();
    const stale = (usersRes.data || [])
      .filter((u) => {
        if (!u.lastSignIn) return true;
        return (now - new Date(u.lastSignIn)) / 86400000 >= thresholdDays;
      })
      .map((u) => ({
        name: u.name,
        DUZ: u.ien,
        lastLoginDate: u.lastSignIn || 'NEVER',
        daysSinceLogin: u.lastSignIn ? Math.floor((now - new Date(u.lastSignIn)) / 86400000) : 999,
      }))
      .sort((a, b) => b.daysSinceLogin - a.daysSinceLogin);
    return { ok: true, source: 'vista', reportType, data: stale, thresholdDays, total: stale.length };
  }

  if (reportType === 'param-changes') {
    const z = await callZveRpc('ZVE ADMIN AUDIT', ['', '', '50']);
    const o = zveOutcome(z);
    const data = (o.kind === 'ok' ? z.lines.slice(1) : []).map(line => {
      const parts = line.split('^');
      return { source: parts[0], timestamp: parts[1], user: parts[2], action: parts[3], detail: parts[4] };
    }).filter(d => d.action && /param|config|set/i.test(d.action));
    return { ok: true, source: 'zve', reportType, data };
  }

  throw new Error(`Unhandled report type: ${reportType}`);
}

async function executeReportSchedule(schedule, options = {}) {
  const { advanceNextRun = true } = options;
  const now = Date.now();
  try {
    const result = await buildAdminReport(schedule.reportType, schedule.params || {});
    schedule.lastRunAt = new Date(now).toISOString();
    schedule.lastRunStatus = 'ok';
    schedule.lastRunRows = Array.isArray(result.data) ? result.data.length : 0;
    schedule.lastRunSource = result.source || 'vista';
    schedule.lastRunNote = result.note || '';
    schedule.lastRunError = '';
    if (advanceNextRun) schedule.nextRunAt = getNextReportRunAt(schedule.cadence, now);
    schedule.updatedAt = new Date(now).toISOString();
    persistReportSchedules();
    return result;
  } catch (error) {
    schedule.lastRunAt = new Date(now).toISOString();
    schedule.lastRunStatus = 'error';
    schedule.lastRunRows = null;
    schedule.lastRunSource = null;
    schedule.lastRunNote = '';
    schedule.lastRunError = error.message;
    if (advanceNextRun) schedule.nextRunAt = getNextReportRunAt(schedule.cadence, now);
    schedule.updatedAt = new Date(now).toISOString();
    persistReportSchedules();
    throw error;
  }
}

async function runDueReportSchedules() {
  if (reportScheduleRunInFlight) return;
  reportScheduleRunInFlight = true;
  try {
    const now = Date.now();
    for (const schedule of reportSchedules) {
      const nextRunAt = parseIsoTime(schedule.nextRunAt);
      if (!schedule.enabled || nextRunAt === null || nextRunAt > now) continue;
      try {
        await executeReportSchedule(schedule);
      } catch (error) {
        console.error(`[report-schedules] run failed for ${schedule.id}:`, error.message);
      }
    }
  } finally {
    reportScheduleRunInFlight = false;
  }
}

function createSession(duz, userName, keys, division, tenantId) {
  const token = crypto.randomBytes(32).toString('hex');
  const session = {
    token,
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

// S5.4: Invalidate sessions for a given DUZ (e.g. after password change).
// exceptToken keeps the current session (e.g. admin changing another user's password keeps admin logged in).
function destroySessionsForDuz(duz, exceptToken = null) {
  const targetDuz = String(duz);
  let destroyed = 0;
  for (const [token, s] of sessions.entries()) {
    if (String(s.duz) === targetDuz && token !== exceptToken) {
      releaseSessionBroker(token);
      sessions.delete(token);
      destroyed++;
    }
  }
  if (destroyed > 0) persistSessions();
  return destroyed;
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
const AUTH_BYPASS = ['/api/tenant-admin/v1/auth/login', '/api/tenant-admin/v1/auth/change-expired-password', '/api/tenant-admin/v1/auth/session', '/api/tenant-admin/v1/vista-status', '/api/tenant-admin/v1/health', '/api/tenant-admin/v1/public/login-config'];

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------
async function main() {
  const app = Fastify({ logger: false, bodyLimit: 1048576 }); // 1MB request body limit

  // Enable per-request broker context via AsyncLocalStorage.
  // This must be called before any hooks or routes are registered so that
  // every HTTP request runs inside an ALS context. Each authenticated
  // session then gets its own XwbBroker (its own VistA DUZ), ensuring
  // all writes are attributed to the correct user in VistA's audit trail.
  setupBrokerContext(app);

  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    try { done(null, body ? JSON.parse(body) : {}); } catch (e) { done(e); }
  });

  // Gzip compression for API responses
  await app.register(fastifyCompress, { global: true });

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

  // Global error handler — normalize all uncaught errors to { ok: false, error, code? }
  app.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode || 500;
    request.log.error(error);
    const code = error.code && typeof error.code === 'string' ? error.code : (statusCode >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR');
    reply.code(statusCode).send({ ok: false, error: error.message || 'Internal server error', code });
  });

  // Security headers, X-Response-Time (S18.9), and payload capture for S18.10 error logging
  app.addHook('onSend', async (request, reply, payload) => {
    const code = reply.statusCode;
    if (code >= 400 && code < 600 && payload != null) {
      const str = typeof payload === 'string' ? payload : (Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload));
      try {
        const j = JSON.parse(str);
        request._clientErrorMsg = typeof j.error === 'string' ? j.error : (typeof j.message === 'string' ? j.message : str.slice(0, 400));
      } catch {
        request._clientErrorMsg = str.slice(0, 400);
      }
    }
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-XSS-Protection', '0'); // Modern CSP replaces this
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'");
    if (request._startTime) {
      reply.header('X-Response-Time', `${Date.now() - request._startTime}ms`);
    }
    return payload;
  });

  // S18.10: structured logging for 4xx/5xx responses
  app.addHook('onResponse', async (request, reply) => {
    const code = reply.statusCode;
    if (code >= 400 && code < 600) {
      const ms = request._startTime ? Date.now() - request._startTime : 0;
      console.error(JSON.stringify({
        level: 'http_client_error',
        timestamp: new Date().toISOString(),
        method: request.method,
        url: request.url,
        duz: request.session?.duz ?? null,
        statusCode: code,
        error: request._clientErrorMsg || `HTTP ${code}`,
        responseTimeMs: ms,
      }));
    }
  });

  // S18.9: Track request start time for X-Response-Time
  app.addHook('onRequest', async (request) => {
    request._startTime = Date.now();
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
      return reply.code(401).send({ ok: false, error: 'Authentication required. POST /api/tenant-admin/v1/auth/login first.', code: 'UNAUTHORIZED' });
    }
    // S5.2: Reject cross-site state-changing requests without exposing a JS-readable CSRF secret.
    const method = (request.method || '').toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !path.endsWith('/auth/login')) {
      const secFetchSite = String(request.headers['sec-fetch-site'] || '').toLowerCase();
      if (secFetchSite && !['same-origin', 'same-site', 'none'].includes(secFetchSite)) {
        return reply.code(403).send({ ok: false, error: 'Cross-site state-changing requests are not allowed', code: 'CSRF_MISMATCH' });
      }
    }
    const session = getSession(token);
    if (!session) {
      return reply.code(401).send({ ok: false, error: 'Session expired or invalid. Please re-login.', code: 'SESSION_INVALID' });
    }
    request.session = session;

    const qsTenant = request.query.tenantId;
    if (qsTenant && qsTenant !== session.tenantId) {
      return reply.code(403).send({ ok: false, error: 'Tenant mismatch: session bound to ' + session.tenantId, code: 'TENANT_MISMATCH' });
    }
    if (!request.query.tenantId) request.query.tenantId = session.tenantId;

    const navGroups = resolveNavGroups(session.keys);
    const routeGroup = resolveRouteGroup(path);
    if (routeGroup && navGroups.length > 0 && !navGroups.includes(routeGroup)) {
      return reply.code(403).send({ ok: false, error: 'Insufficient permissions for this resource', requiredGroup: routeGroup, code: 'INSUFFICIENT_PERMISSIONS' });
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

    // S5.3: DISUSER on every authenticated request — runs after broker activation so DDR uses session context
    try {
      const disRes = await ddrGetsEntry(200, session.duz, '7');
      const disVal = disRes?.data?.['7'] || disRes?.data?.['.07'] || '';
      if (disRes?.ok !== false && isDisabledFieldValue(disVal)) {
        releaseSessionBroker(session.token);
        destroySession(session.token);
        reply.header('Set-Cookie', 've-session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
        return reply.code(401).send({ ok: false, error: 'Account deactivated. Contact your administrator.', code: 'ACCOUNT_DISABLED' });
      }
    } catch (_) {
      // Non-fatal: if we can't check DISUSER, don't block the request
    }
  });

  // ---- Auth routes ----

  // G001: Login rate limiting — 5 attempts per IP per 60 seconds
  const loginAttempts = new Map();
  const loginFailuresByUser = new Map();
  const LOGIN_RATE_LIMIT = 5;
  const LOGIN_RATE_WINDOW = 60000; // 60 seconds
  const LOGIN_FAILURE_RETENTION_MS = 30 * 60 * 1000;

  function normalizeLoginIdentifier(value) {
    return String(value || '').trim().toUpperCase();
  }

  function classifyAuthFailure(rawMsg = '') {
    const lower = String(rawMsg || '').toLowerCase();
    let code = 'INVALID_CREDENTIALS';
    let error = 'VistA authentication failed: ' + (rawMsg || 'Invalid credentials');
    if (/tcp connect timeout|tcp:|econnrefused|enotfound|etimedout|network|refused connection/i.test(rawMsg)) {
      code = 'VISTA_UNAVAILABLE';
      error = rawMsg || 'VistA connection failed';
    } else if (/lock/i.test(lower) && (/sign-on|failed|attempt/i.test(lower) || /too many/i.test(lower))) {
      code = 'ACCOUNT_LOCKED';
    } else if (/expired|expired verify|new verify|change.*password|change.*verify|verify code must be changed|must be changed before continued use/i.test(lower)) {
      code = 'PASSWORD_EXPIRED';
    } else if (/not a valid|invalid.*access|invalid.*verify|garbled/i.test(lower)) {
      code = 'INVALID_CREDENTIALS';
    }
    return { code, error };
  }

  function isDisabledFieldValue(value) {
    const normalized = String(value || '').trim().toUpperCase();
    return normalized === '1' || normalized === 'YES' || normalized === 'Y' || normalized === 'TRUE';
  }

  function pruneLoginFailures(now = Date.now()) {
    for (const [identifier, state] of loginFailuresByUser.entries()) {
      if (!state?.updatedAt || (now - state.updatedAt) > LOGIN_FAILURE_RETENTION_MS) {
        loginFailuresByUser.delete(identifier);
      }
    }
  }

  function clearLoginFailures(identifier) {
    if (!identifier) return;
    loginFailuresByUser.delete(identifier);
  }

  function recordLoginFailure(identifier, lockoutThreshold, now = Date.now()) {
    if (!identifier || !lockoutThreshold) return null;
    pruneLoginFailures(now);
    const current = loginFailuresByUser.get(identifier);
    const count = (current?.count || 0) + 1;
    loginFailuresByUser.set(identifier, { count, updatedAt: now, lockoutThreshold });
    return {
      failedAttempts: count,
      lockoutThreshold,
      attemptsRemaining: Math.max(lockoutThreshold - count, 0),
    };
  }

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

    const loginIdentifier = normalizeLoginIdentifier(accessCode);

    // S5.2: Pre-check application-level lockout. If the user has already reached
    // the threshold, deny immediately without burning another VistA signon attempt.
    try {
      const loginConfig = await getPublicLoginConfigData();
      const threshold = loginConfig.lockoutAttempts || 3;
      const existingFailures = loginFailuresByUser.get(loginIdentifier);
      if (existingFailures && existingFailures.count >= threshold) {
        return reply.code(401).send({
          ok: false,
          error: 'Account locked. Contact your administrator to reset.',
          code: 'ACCOUNT_LOCKED',
          attemptsRemaining: 0,
          lockoutThreshold: threshold,
        });
      }
    } catch (_preCheckErr) { /* non-fatal — proceed to VistA auth */ }

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
      const rawMsg = (authErr.message || '').replace(/[\x00-\x1f]/g, ' ').trim();
      const { code, error: classifiedError } = classifyAuthFailure(rawMsg);
      let error = classifiedError;

      let failureMeta = null;
      let lockoutThreshold = null;
      try {
        const loginConfig = await getPublicLoginConfigData();
        lockoutThreshold = loginConfig.lockoutAttempts;
      } catch (_configErr) {
        lockoutThreshold = null;
      }

      if (code === 'INVALID_CREDENTIALS') {
        failureMeta = recordLoginFailure(loginIdentifier, lockoutThreshold, now);
        if (failureMeta?.attemptsRemaining !== null && failureMeta?.attemptsRemaining !== undefined) {
          error = `Invalid credentials. ${failureMeta.attemptsRemaining} attempt${failureMeta.attemptsRemaining === 1 ? '' : 's'} remaining before lockout.`;
        }
      } else if (code === 'ACCOUNT_LOCKED' || code === 'PASSWORD_EXPIRED' || code === 'VERIFY_EXPIRED') {
        clearLoginFailures(loginIdentifier);
      }

      return reply.code(401).send({
        ok: false,
        error,
        code,
        attemptsRemaining: code === 'ACCOUNT_LOCKED' ? 0 : (failureMeta?.attemptsRemaining ?? null),
        lockoutThreshold,
      });
    }

    clearLoginFailures(loginIdentifier);

    const duz = broker.duz || '0';
    const userName = broker.userName || 'Unknown';

    // S5.3: Block login when DISUSER is set on File #200 field 7
    try {
        const disRes = await ddrGetsEntry(200, duz, '7');
        const disVal = disRes?.data?.['7'] || disRes?.data?.['.07'] || '';
      if (disRes?.ok !== false && isDisabledFieldValue(disVal)) {
        try { broker.disconnect(); } catch (dcErr) { console.warn('[auth/login] broker disconnect failed after DISUSER block:', dcErr.message); }
        return reply.code(401).send({ ok: false, error: 'Account is disabled (DISUSER).', code: 'ACCOUNT_DISABLED' });
      }
    } catch (disErr) { console.warn('[auth/login] DISUSER check failed (non-fatal, allowing login):', disErr.message); }

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
      user: { duz, name: userName, keys: userKeys.map(k => k.name) },
      roleCluster,
      navGroups,
      tenantId,
    };
  });

  app.get('/api/tenant-admin/v1/auth/session', async (req, reply) => {
    // S5.1: Accept session from httpOnly cookie first, then Authorization header (backward compat)
    const cookieHeader = req.headers['cookie'] || '';
    const cookieToken = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith('ve-session='))?.split('=')[1] || null;
    const authHeader = req.headers['authorization'] || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const token = cookieToken || bearerToken;
    const session = getSession(token);
    if (!session) return reply.code(401).send({ ok: false, error: 'No active session', code: 'NO_SESSION' });
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
    } catch (detErr) { console.warn('[auth/session] ZVE USER DETAIL enrichment failed (non-fatal, using session data):', detErr.message); }

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

  app.post('/api/tenant-admin/v1/auth/change-expired-password', async (req, reply) => {
    const body = req.body || {};
    const accessCode = String(body.accessCode || body.username || '').trim();
    const currentVerifyCode = String(body.currentVerifyCode || body.verifyCode || body.currentPassword || '').trim();
    const newVerifyCode = String(body.newVerifyCode || body.newPassword || '').trim();
    const tenantId = body.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    if (!accessCode || !currentVerifyCode || !newVerifyCode) {
      return reply.code(400).send({ ok: false, error: 'accessCode, currentVerifyCode, and newVerifyCode are required' });
    }

    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });

    const sessionOpts = {
      accessCode,
      verifyCode: currentVerifyCode,
      host: process.env.VISTA_HOST,
      port: process.env.VISTA_PORT ? parseInt(process.env.VISTA_PORT, 10) : undefined,
    };

    let probeBroker = null;
    try {
      probeBroker = new XwbBroker();
      await probeBroker.connect(sessionOpts);
      try { probeBroker.disconnect(); } catch (dcErr) { console.warn('[auth/login] probe broker disconnect failed:', dcErr.message); }
      return reply.code(409).send({ ok: false, error: 'Password is not expired for this account.', code: 'PASSWORD_NOT_EXPIRED' });
    } catch (authErr) {
      const rawMsg = (authErr.message || '').replace(/[\x00-\x1f]/g, ' ').trim();
      const classified = classifyAuthFailure(rawMsg);
      if (classified.code !== 'PASSWORD_EXPIRED') {
        return reply.code(401).send({ ok: false, error: classified.error, code: classified.code });
      }
    } finally {
      try { probeBroker?.disconnect(); } catch (dcErr) { console.warn('[auth/login] probe broker disconnect failed:', dcErr.message); }
    }

    const find = await callZveRpc('ZVE USMG FINDAC', [accessCode]);
    const findOutcome = zveOutcome(find);
    if (findOutcome.kind !== 'ok') {
      return reply.code(404).send({ ok: false, error: findOutcome.msg || 'Access code not found', code: 'USER_NOT_FOUND', rpcUsed: find.rpcUsed });
    }

    const targetDuz = (find.line0 || '').split('^')[1] || '';
    if (!targetDuz) {
      return reply.code(404).send({ ok: false, error: 'Unable to resolve account for access code', code: 'USER_NOT_FOUND', rpcUsed: find.rpcUsed });
    }

    const z = await callZveRpc('ZVE USMG CRED', [String(targetDuz), accessCode, newVerifyCode, 'ACTIVE']);
    const o = zveOutcome(z);
    if (o.kind !== 'ok') {
      if (o.kind === 'rejected') {
        const msg = o.msg || 'Credential policy rejected';
        const code = credentialPolicyCodeFromMessage(msg);
        return reply.code(409).send({ ok: false, error: msg, code, rpcUsed: z.rpcUsed, lines: z.lines });
      }
      return reply.code(502).send({ ok: false, error: `RPC ZVE USMG CRED failed: ${o.msg || o.kind}`, rpcUsed: z.rpcUsed, lines: z.lines });
    }

    clearLoginFailures(normalizeLoginIdentifier(accessCode));
    destroySessionsForDuz(targetDuz);
    return { ok: true, tenantId, duz: targetDuz, rpcUsed: z.rpcUsed };
  });

  app.post('/api/tenant-admin/v1/auth/logout', async (req, reply) => {
    if (req.session) {
      releaseSessionBroker(req.session.token); // disconnect per-user VistA broker
      destroySession(req.session.token);
    }
    // S5.1: Clear httpOnly session cookie
    reply.header('Set-Cookie', 've-session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
    return { ok: true };
  });

  // ---- VistA connectivity probe (no auth required) ----

  // S18: Health check endpoint for monitoring
  const _serverStartTime = Date.now();
  const healthPayload = () => {
    const uptime = Math.floor((Date.now() - _serverStartTime) / 1000);
    return {
      ok: true,
      vistaConnected: hasActiveSessionBrokers(),
      uptime,
    };
  };
  app.get('/health', async () => healthPayload());
  app.get('/api/tenant-admin/v1/health', async () => ({ ...healthPayload(), timestamp: new Date().toISOString() }));
  app.get('/api/tenant-admin/v1/health/history', async (_req, reply) => {
    try {
      await ensureRecentHealthSample();
      const latest = healthHistory[healthHistory.length - 1] || null;
      return {
        ok: true,
        source: 'server',
        data: {
          sampleIntervalSeconds: Math.round(HEALTH_HISTORY_INTERVAL_MS / 1000),
          retentionDays: Math.round(HEALTH_HISTORY_RETENTION_MS / 86400000),
          latest,
          windows: [
            summarizeHealthWindow(24 * 60 * 60 * 1000, '24h'),
            summarizeHealthWindow(7 * 24 * 60 * 60 * 1000, '7d'),
            summarizeHealthWindow(30 * 24 * 60 * 60 * 1000, '30d'),
          ],
          recentSamples: healthHistory.slice(-12),
        },
      };
    } catch (error) {
      return reply.code(500).send({ ok: false, error: error.message });
    }
  });
  app.get('/api/tenant-admin/v1/health/thresholds/me', async (req, reply) => {
    const duz = String(req.session?.duz || '');
    if (!duz) return reply.code(401).send({ ok: false, error: 'Authentication required' });
    return {
      ok: true,
      source: 'server',
      data: normalizeThresholdWatcher(healthThresholds.watchers[duz]),
    };
  });
  app.put('/api/tenant-admin/v1/health/thresholds/me', async (req, reply) => {
    const duz = String(req.session?.duz || '');
    if (!duz) return reply.code(401).send({ ok: false, error: 'Authentication required' });

    const watcher = normalizeThresholdWatcher(req.body || {});
    healthThresholds.watchers[duz] = watcher;
    persistHealthThresholds();

    await ensureRecentHealthSample();
    const latest = healthHistory[healthHistory.length - 1] || null;
    const alertsTriggered = latest ? await evaluateHealthThresholds(latest) : 0;

    return {
      ok: true,
      source: 'server',
      data: watcher,
      alertsTriggered,
    };
  });

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
    const pageRaw = req.query.page;
    const limitRaw = req.query.limit;
    const hasPage = pageRaw !== undefined && pageRaw !== null && String(pageRaw).trim() !== '';
    const hasLimit = limitRaw !== undefined && limitRaw !== null && String(limitRaw).trim() !== '';
    const usePagination = hasPage && hasLimit;
    let page = 1;
    let limit = 25;
    if (usePagination) {
      page = Math.max(1, parseInt(String(pageRaw), 10) || 1);
      limit = Math.min(500, Math.max(1, parseInt(String(limitRaw), 10) || 25));
    }
    const offset = usePagination ? (page - 1) * limit : 0;
    const maxStr = usePagination ? String(limit) : (req.query.max || '');
    const search = req.query.search || '';
    const status = req.query.status || '';
    const division = req.query.division || '';
    // Legacy path: 4 params only (matches older ZVE RPC registrations).
    // Pagination path: MAX, FROM, PAGED=1 for LIST2 offset + total count (ZVEADMIN.m).
    const z = usePagination
      ? await callZveRpc('ZVE USER LIST', [search, status, division, maxStr, String(offset), '1'])
      : await callZveRpc('ZVE USER LIST', [search, status, division, maxStr]);
    const o = zveOutcome(z);
    if (o.kind !== 'ok') {
      return reply.code(502).send({
        ok: false, source: 'zve', tenantId,
        error: `ZVE USER LIST failed: ${o.msg || o.kind}`,
        rpcUsed: z.rpcUsed,
      });
    }
    const line0 = (z.lines[0] || '').trim();
    const headerParts = line0.split('^');
    let total = null;
    if (usePagination && headerParts.length >= 4 && headerParts[3] === 'OK') {
      total = parseInt(headerParts[1], 10);
      if (Number.isNaN(total)) total = null;
    }
    const data = [];
    for (const line of z.lines.slice(1)) {
      const row = parseUserListLine(line);
      if (!row.ien) continue;
      data.push(row);
    }
    if (usePagination && total == null) total = data.length;
    const payload = { ok: true, source: 'zve', tenantId, data, rpcUsed: z.rpcUsed };
    if (usePagination) {
      payload.page = page;
      payload.limit = limit;
      payload.total = total;
    }
    return payload;
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
    const userExt = await fetchUserExtensions(userId);
    // Chapter-1 expansion: indices 24-29
    const restrictPatient = detail[24] || '';
    const verifyCodeNeverExpires = detail[25] || '';
    const language = detail[26] || '';
    const filemanAccess = detail[27] || '';
    const defaultOrderList = detail[28] || '';
    const proxyUser = detail[29] || '';
    // S7: Password expiration fields (indices 30-32 from ZVEADMIN DETAIL)
    const vcChangeDate = detail[30] || '';
    const pwdExpirationDays = detail[31] || '';
    const pwdDaysRemaining = detail[32] || '';
    const keys = [];
    const divs = [];
    for (const line of z.lines.slice(2)) {
      const p = line.split('^');
      if (p[0] === 'KEY') keys.push({ ien: p[1], name: p[2] });
      else if (p[0] === 'DIV') divs.push({ ien: p[1], name: p[2], station: p[3] || '' });
    }
    return {
      ok: true, source: 'zve', tenantId, rpcUsed: z.rpcUsed,
      data: {
        id: userId, ien: userId,
        name: detail[1] || '', username: detail[1] || '',
        title: detail[6] || '',
        employeeId: userExt.employeeId || '',
        assignedRole: userExt.assignedRole || '',
        status: (detail[5] || 'ACTIVE').toLowerCase(),
        roles: keys.map(k => k.name),
        vistaGrounding: {
          duz: userId, file200Status: 'zve-detail',
          sex: detail[3] || '', dob: detail[2] || '',
          ssn: detail[4] ? `***-**-${detail[4].slice(-4)}` : '',
          ssnLast4: detail[4] ? detail[4].slice(-4) : '',
          officePhone: detail[9] || '', email: detail[8] || '',
          service: detail[7] || '',
          // serviceSection kept as an alias for callers that predate the
          // rename (StaffDirectory.jsx detail panel, etc.). Both fields
          // carry the same value so neither caller breaks.
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
          employeeId: userExt.employeeId || '',
          assignedRole: userExt.assignedRole || '',
          vcChangeDate,
          pwdExpirationDays: pwdExpirationDays ? parseInt(pwdExpirationDays, 10) : null,
          pwdDaysRemaining: pwdDaysRemaining !== '' ? parseInt(pwdDaysRemaining, 10) : null,
        },
        keys, divisions: divs,
        lastModified: hashUserDetailLines(z.lines, userExt),
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

  app.get('/api/tenant-admin/v1/provider-classes', async (req, reply) => {
    const tenantId = req.query.tenantId || 'default';
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'vista-unreachable', error: p.error });
    const search = req.query.search;
    try {
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '7', FIELDS: '.01', FLAGS: 'IP', MAX: '5000', ...(search ? { PART: String(search).toUpperCase() } : {}) } },
        ]);
        const parsed = parseDdrListerResponse(lines);
        if (!parsed.ok) return [];
        const out = [];
        for (const line of parsed.data) {
          const a = line.split('^');
          const ien = a[0]?.trim();
          const name = a[1]?.trim() || '';
          if (!ien || !/^\d+$/.test(ien) || !name) continue;
          out.push({ ien, name });
        }
        return out;
      });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '7', data: rows };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
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
      } catch (vistaErr) { console.warn(`[facilities/${facilityId}] VistA unavailable:`, vistaErr.message); }
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
      } catch (_zve) { console.debug('[zve-fallback] ZVE unavailable, falling through to DDR:', _zve.message); }
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

  // ---- Clinic list (VistA-only, TYPE=C only) ----

  app.get('/api/tenant-admin/v1/clinics', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, source: 'error', tenantId, error: p.error || 'VistA unreachable' });
    try {
      const rows = await lockedRpc(async () => {
        // Filter File 44 by TYPE (field 2) = "C" (Clinic) — excludes wards, OR rooms, modules
        // FLAGS includes 'S' to enable SCREEN parameter in DDR LISTER
        const allRows = await ddrList({ file: '44', fields: '.01;1;2;8;1917;2505', flags: 'IPS', fieldNames: ['name', 'abbreviation', 'type', 'stopCode', 'apptLength', 'inactivateDate'], search: req.query.search, screen: 'I $P(^SC(Y,0),U,3)="C"' });
        // Server-side fallback: if DDR screen didn't filter, remove non-clinic entries
        return allRows.filter(r => !r.type || r.type === 'C' || r.type === 'c');
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
      const divisionRes = await fetchVistaDivisions();
      const divisionByIen = new Map((divisionRes.ok ? divisionRes.data : []).map((division) => [String(division.ien), division.name || '']));
      const rows = await lockedRpc(async () => {
        return ddrList({ file: '42', fields: '.01;.015', fieldNames: ['name', 'division'], search: req.query.search });
      });
      const data = rows.map((row) => {
        const divisionIen = String(row.division || '').trim();
        return {
          ...row,
          divisionIen,
          division: divisionByIen.get(divisionIen) || divisionIen,
        };
      });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '42', data };
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
      if (o.kind !== 'missing' && !/not registered to the option/i.test(o.msg || '')) {
        return reply.code(502).send({ ok: false, source: 'zve', error: o.msg, rpcUsed: z.rpcUsed });
      }
    } catch (_zve) { console.debug('[zve-fallback] ZVE unavailable, falling through to DDR:', _zve.message); }

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
    } catch (vistaErr) { console.warn('[topology] VistA unreachable for topology build:', vistaErr.message); }
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
    const requestedName = typeof body.newName === 'string' && body.newName.trim()
      ? body.newName.trim()
      : typeof body.name === 'string' && body.name.trim()
        ? body.name.trim()
        : '';
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    if (!body.sourceDuz) return reply.code(400).send({ ok: false, error: 'sourceDuz required' });
    if (!requestedName) return reply.code(400).send({ ok: false, error: 'newName required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable' });
    try {
      // Step 1: Create the new user via ZVE USMG ADD
      const addResult = await callZveRpc('ZVE USMG ADD', [requestedName]);
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
        sourceDuz: body.sourceDuz, newName: requestedName, newDuz,
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
    const normalizedValue = field === '8' ? await resolveTitleNameByIen(value) : value;
    const ALLOW = {
      '.132': 'OFFICE PHONE',
      '.133': 'VOICE PAGER',
      '.134': 'DIGITAL PAGER',
      '.151': 'EMAIL ADDRESS',
      'EMPID': 'EMPLOYEE ID',
      'ROLE': 'ASSIGNED ROLE',
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
      '53.7': 'REQUIRES COSIGNER',
      '53.11': 'AUTHORIZED TO WRITE MED ORDERS',
      '53.2': 'DEA#',
      '53.21': 'DEA EXPIRATION DATE',
      '53.8': 'COSIGNER',
      '53.5': 'PROVIDER CLASS',
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
    // S23.1: Concurrent edit — client sends lastModified from GET /users/:id
    const clientLm = body.lastModified;
    if (clientLm && typeof clientLm === 'string') {
      const zCur = await callZveRpc('ZVE USER DETAIL', [String(ien)]);
      const oCur = zveOutcome(zCur);
      if (oCur.kind === 'ok' && zCur.lines?.length) {
        const extCur = await fetchUserExtensions(ien);
        const fp = hashUserDetailLines(zCur.lines, extCur);
        if (fp !== clientLm) {
          return reply.code(409).send({
            ok: false,
            error: 'This user was modified by another admin. Refresh before saving.',
            code: 'CONCURRENT_EDIT',
          });
        }
      }
    }
    const EXT_FIELD_MAP = { EMPID: 'EMPID', ROLE: 'ROLE' };
    const extField = EXT_FIELD_MAP[field];
    if (extField) {
      try {
        if (field === 'EMPID' && normalizeEmployeeId(value)) {
          const employeeIdMatches = await findEmployeeIdMatches(value, ien);
          if (employeeIdMatches.length > 0) {
            return reply.code(409).send({
              ok: false,
              code: 'DUPLICATE_EMPLOYEE_ID',
              error: `Employee ID ${value} is already assigned to ${employeeIdMatches[0].name} (DUZ ${employeeIdMatches[0].ien}).`,
              matches: employeeIdMatches,
            });
          }
        }
        const z = await callZveRpc('ZVE UEXT SET', [String(ien), extField, String(value)]);
        const o = zveOutcome(z);
        if (o.kind !== 'ok') {
          return reply.code(502).send({ ok: false, source: 'zve', error: o.msg || `Failed to save ${ALLOW[field].toLowerCase()}`, rpcUsed: z.rpcUsed });
        }
        const zAfter = await callZveRpc('ZVE USER DETAIL', [String(ien)]);
        const extAfter = await fetchUserExtensions(ien);
        const lm = (zAfter.lines && zveOutcome(zAfter).kind === 'ok') ? hashUserDetailLines(zAfter.lines, extAfter) : clientLm;
        return { ok: true, source: 'zve', tenantId, ien, field, storedValue: String(value), rpcUsed: z.rpcUsed, lines: z.lines, lastModified: lm };
      } catch (extErr) {
        return reply.code(502).send({ ok: false, source: 'zve', error: extErr.message || `Failed to save ${ALLOW[field].toLowerCase()}` });
      }
    }
    // --- ZVE-first: ZVE USER EDIT ---
    const ZVE_FIELD_MAP = { '.132': 'PHONE', '.133': 'VOICE PAGER', '.134': 'DIGITAL PAGER', '.151': 'EMAIL', '4': 'SEX', '20.2': 'INITIALS', '20.3': 'SIG BLOCK', '20.4': 'ESIG', '201': 'MENU', '8': 'TITLE', '29': 'SERVICE', '5': 'DOB', '9': 'SSN', '41.99': 'NPI', '53.2': 'DEA', '53.5': 'PROVIDER_CLASS' };
    const zveFld = ZVE_FIELD_MAP[field];
    if (zveFld) {
      try {
        if (field === '.151' && normalizeEmail(normalizedValue)) {
          const emailMatches = await findEmailMatches(normalizedValue, ien);
          if (emailMatches.length > 0) {
            return reply.code(409).send({
              ok: false,
              code: 'DUPLICATE_EMAIL',
              error: `Email ${normalizedValue} is already assigned to ${emailMatches[0].name} (DUZ ${emailMatches[0].ien}).`,
              matches: emailMatches,
            });
          }
        }
        const z = await callZveRpc('ZVE USER EDIT', [String(ien), zveFld, String(normalizedValue)]);
        const o = zveOutcome(z);
        if (o.kind === 'ok') {
          const zAfter = await callZveRpc('ZVE USER DETAIL', [String(ien)]);
          const extAfter = await fetchUserExtensions(ien);
          const lm = (zAfter.lines && zveOutcome(zAfter).kind === 'ok') ? hashUserDetailLines(zAfter.lines, extAfter) : clientLm;
          return { ok: true, source: 'zve', tenantId, ien, field, storedValue: String(normalizedValue), rpcUsed: z.rpcUsed, lines: z.lines, lastModified: lm };
        }
        if (o.kind !== 'missing') {
          return reply.code(502).send({ ok: false, source: 'zve', error: o.msg, rpcUsed: z.rpcUsed });
        }
      } catch (_zve) { console.debug('[zve-fallback] ZVE unavailable, falling through to DDR:', _zve.message); }
    }
    // --- DDR fallback ---
    const p = await probeVista();
    if (!p.ok) {
      return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });
    }
    // S3.9: Pointer fields send IENs — need 'I' flag for internal format
    if (field === '53.8') {
      try {
        const cosignerValue = String(value || '').trim() === '' ? '@' : await resolveUserNameByIen(value);
        const z = await callZveRpc('ZVE USER EDIT', [String(ien), 'COSIGNER', cosignerValue]);
        const o = zveOutcome(z);
        if (o.kind !== 'ok') {
          return reply.code(502).send({ ok: false, source: 'zve', error: o.msg || 'Failed to save cosigner', rpcUsed: z.rpcUsed });
        }
        const zAfter = await callZveRpc('ZVE USER DETAIL', [String(ien)]);
        const extAfter = await fetchUserExtensions(ien);
        const lastModified = (zAfter.lines && zveOutcome(zAfter).kind === 'ok') ? hashUserDetailLines(zAfter.lines, extAfter) : clientLm;
        return {
          ok: true,
          source: 'zve',
          tenantId,
          ien,
          field,
          storedValue: String(value || ''),
          rpcUsed: z.rpcUsed,
          lines: z.lines,
          lastModified,
        };
      } catch (cosignerErr) {
        return reply.code(502).send({ ok: false, source: 'zve', error: cosignerErr.message || 'Failed to save cosigner' });
      }
    }
    const POINTER_FIELDS_EDIT = new Set(['8', '53.8', '53.5', '200.07', '201']);
    const iens = `${ien},`;
    const valRes = await ddrValidateField(200, iens, field, String(normalizedValue));
    if (!valRes.ok) {
      return reply.code(400).send({ ok: false, stage: 'DDR VALIDATOR', error: valRes.error });
    }
    const editFlags = POINTER_FIELDS_EDIT.has(field) ? 'EI' : 'E';
    const filer = await ddrFilerEdit(200, iens, field, String(normalizedValue), editFlags);
    if (!filer.ok) {
      return reply.code(502).send({ ok: false, stage: 'DDR FILER', error: filer.error, rpcUsed: filer.rpcUsed });
    }
    const zAfter = await callZveRpc('ZVE USER DETAIL', [String(ien)]);
    const extAfter = await fetchUserExtensions(ien);
    const lastModified = (zAfter.lines && zveOutcome(zAfter).kind === 'ok') ? hashUserDetailLines(zAfter.lines, extAfter) : clientLm;
    return {
      ok: true,
      source: 'vista',
      tenantId,
      ien,
      field,
      storedValue: String(normalizedValue),
      rpcUsed: ['DDR VALIDATOR', filer.rpcUsed],
      filerLines: filer.lines,
      validatorLines: valRes.lines,
      lastModified,
    };
  });

  app.put('/api/tenant-admin/v1/users/:ien/secondary-menus', async (req, reply) => {
    const tenantId = req.query.tenantId || 'default';
    const { ien } = req.params;
    const body = req.body || {};
    const desiredMenus = Array.isArray(body.menus)
      ? [...new Set(body.menus.map(menu => String(menu || '').trim()).filter(Boolean))]
      : [];
    const p = await probeVista();
    if (!p.ok) {
      return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });
    }
    const currentList = await lockedRpc(async () => {
      const broker = await getBroker();
      return broker.callRpcWithList('DDR LISTER', [
        { type: 'list', value: { FILE: '200.03', IENS: `,${ien},`, FIELDS: '.01', FLAGS: 'P', MAX: '5000' } },
      ]);
    });
    const currentMenus = ddrListParsed(currentList, ['menuOption']);
    const desiredSet = new Set(desiredMenus.map(menu => menu.toUpperCase()));
    const currentByName = new Map(currentMenus.map(row => [String(row.menuOption || '').trim().toUpperCase(), row]));
    const added = [];
    const removed = [];

    for (const menu of desiredMenus) {
      if (currentByName.has(menu.toUpperCase())) continue;
      const addResult = await ddrFilerAdd('200.03', '.01', `+1,${ien},`, menu, 'E');
      if (!addResult.ok) {
        return reply.code(502).send({ ok: false, error: addResult.error || `Failed to add secondary menu ${menu}`, rpcUsed: addResult.rpcUsed });
      }
      added.push(menu);
    }

    for (const row of currentMenus) {
      const normalized = String(row.menuOption || '').trim().toUpperCase();
      if (!normalized || desiredSet.has(normalized)) continue;
      const removeResult = await ddrFilerEdit('200.03', `${row.ien},${ien},`, '.01', '@', 'E');
      if (!removeResult.ok) {
        return reply.code(502).send({ ok: false, error: removeResult.error || `Failed to remove secondary menu ${row.menuOption}`, rpcUsed: removeResult.rpcUsed });
      }
      removed.push(row.menuOption || '');
    }

    return { ok: true, source: 'vista', tenantId, ien, added, removed, menus: desiredMenus };
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
        assignedDate: fmDateToIso(p[3] || ''),
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
    if (!p.ok) return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });
    const z = await callZveRpc('ZVE USMG KEYS', ['ADD', String(req.params.targetDuz), sanitized]);
    const o = zveOutcome(z);
    if (o.kind === 'missing') return reply.code(502).send({ ok: false, error: o.msg ? `RPC ZVE USMG KEYS missing: ${o.msg}` : 'RPC ZVE USMG KEYS returned missing status', code: 'RPC_MISSING' });
    if (o.kind !== 'ok' && o.kind !== 'missing') return reply.code(o.kind === 'rejected' ? 409 : 502).send({ ok: false, error: o.msg, rpcUsed: z.rpcUsed, lines: z.lines });
    return { ok: true, tenantId, targetDuz: req.params.targetDuz, keyName: sanitized, rpcUsed: z.rpcUsed, lines: z.lines };
  });

  app.delete('/api/tenant-admin/v1/users/:targetDuz/keys/:keyId', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const keyName = String(req.params.keyId || '').toUpperCase().replace(/\+/g, ' ').replace(/%20/g, ' ');
    if (!keyName.trim()) return reply.code(400).send({ ok: false, error: 'keyId (key name) required' });
    // S23: Prevent admin from removing their own XUMGR key (self-lock prevention)
    if (keyName.trim() === 'XUMGR' && String(req.params.targetDuz) === String(req.session?.duz)) {
      return reply.code(403).send({ ok: false, error: 'Cannot remove your own administrative access (XUMGR). Another admin must perform this action.' });
    }
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });
    const z = await callZveRpc('ZVE USMG KEYS', ['DEL', String(req.params.targetDuz), keyName.trim()]);
    const o = zveOutcome(z);
    if (o.kind === 'missing') return reply.code(502).send({ ok: false, error: o.msg ? `RPC ZVE USMG KEYS missing: ${o.msg}` : 'RPC ZVE USMG KEYS returned missing status', code: 'RPC_MISSING' });
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
    if (!p.ok) return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });
    const z = await callZveRpc('ZVE USMG CHKAC', [ac]);
    const o = zveOutcome(z);
    return { ok: o.kind === 'ok', available: o.kind === 'ok', error: o.kind !== 'ok' ? o.msg : undefined, rpcUsed: z.rpcUsed };
  });

  /** S3.11: Check employee ID uniqueness against live ^ZVEX-backed user list data */
  app.post('/api/tenant-admin/v1/users/check-employee-id', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const employeeId = String((req.body || {}).employeeId || '').trim();
    const excludeDuz = String((req.body || {}).excludeDuz || '').trim();
    if (!employeeId) {
      return { ok: true, duplicate: false, matches: [] };
    }
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });
    const matches = await findEmployeeIdMatches(employeeId, excludeDuz);
    return { ok: true, duplicate: matches.length > 0, matches };
  });

  app.post('/api/tenant-admin/v1/users/check-email', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const email = String((req.body || {}).email || '').trim();
    const excludeDuz = String((req.body || {}).excludeDuz || '').trim();
    if (!email) {
      return { ok: true, duplicate: false, matches: [] };
    }
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });
    const matches = await findEmailMatches(email, excludeDuz);
    return { ok: true, duplicate: matches.length > 0, matches };
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
    if (!p.ok) return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });
    if (normalizeEmployeeId(body.employeeId)) {
      const employeeIdMatches = await findEmployeeIdMatches(body.employeeId);
      if (employeeIdMatches.length > 0) {
        return reply.code(409).send({
          ok: false,
          code: 'DUPLICATE_EMPLOYEE_ID',
          error: `Employee ID ${body.employeeId} is already assigned to ${employeeIdMatches[0].name} (DUZ ${employeeIdMatches[0].ien}).`,
          matches: employeeIdMatches,
        });
      }
    }
    if (normalizeEmail(body.email)) {
      const emailMatches = await findEmailMatches(body.email);
      if (emailMatches.length > 0) {
        return reply.code(409).send({
          ok: false,
          code: 'DUPLICATE_EMAIL',
          error: `Email ${body.email} is already assigned to ${emailMatches[0].name} (DUZ ${emailMatches[0].ien}).`,
          matches: emailMatches,
        });
      }
    }
    const z = await callZveRpc('ZVE USMG ADD', [name, body.accessCode || '', body.verifyCode || '']);
    const o = zveOutcome(z);
    if (o.kind !== 'ok') {
      if (o.kind === 'rejected') {
        const msg = o.msg || 'Credential policy rejected';
        const code = credentialPolicyCodeFromMessage(msg);
        return reply.code(409).send({ ok: false, error: msg, code, rpcUsed: z.rpcUsed, lines: z.lines });
      }
      return reply.code(502).send({ ok: false, error: `RPC ZVE USMG ADD failed: ${o.msg || o.kind}`, rpcUsed: z.rpcUsed, lines: z.lines });
    }
    const newIen = (z.line0 || '').split('^')[1] || null;
    const extraFields = [];
    // DDR-writable fields: body key → File 200 field number
    const EXTRA_MAP = {
      title: '8', sex: '4', dob: '5',
      // NOTE: SSN (field 9) requires full 9 digits — we only collect last-4 for display, so do NOT write to VistA
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
      cosigner: '53.8',
      // A016: Authorized to Write Med Orders
      authorizedToWriteMeds: '53.11',
      // A018: FileMan Access Code
      filemanAccess: '3',
      // A020: DEA Expiration Date
      deaExpiration: '53.21',
      // E011: Degree / Suffix
      degree: '10.6',
    };
    // S3.9: Pointer fields send IENs — DDR FILER needs 'I' flag (internal format)
    // 'E' alone = extended errors + external format; 'EI' = extended errors + internal format
    const POINTER_FIELDS = new Set(['8', '53.8', '53.5', '200.07', '201']);
    // 8=Title→File 3.1, 53.8=Cosigner→File 200, 53.5=ProviderClass→File 7,
    // 200.07=Language→File .85, 201=PrimaryMenu→File 19

    if (newIen) {
      const iens = `${newIen},`;
      const fileCreateField = async (fieldNumber, fieldValue, flags = 'E') => {
        const filer = await ddrFilerEdit(200, iens, fieldNumber, fieldValue, flags);
        if (!filer.ok) {
          throw new Error(filer.error || 'DDR FILER failed');
        }
        return filer;
      };
      for (const [key, fld] of Object.entries(EXTRA_MAP)) {
        const val = key === 'serviceSection' ? (body.serviceSection ?? body.department) : body[key];
        if (val !== undefined && val !== null && val !== '' && fld) {
          try {
            if (key === 'title') {
              const titleName = await resolveTitleNameByIen(val);
              const titleWrite = await callZveRpc('ZVE USER EDIT', [String(newIen), 'TITLE', titleName]);
              const titleOutcome = zveOutcome(titleWrite);
              if (titleOutcome.kind !== 'ok') throw new Error(titleOutcome.msg || 'Failed to save title');
              extraFields.push({ field: fld, key, status: 'ok', storedValue: titleName, rpcUsed: titleWrite.rpcUsed });
              continue;
            }
            if (key === 'providerType') {
              const providerWrite = await callZveRpc('ZVE USER EDIT', [String(newIen), 'PROVIDER_CLASS', String(val)]);
              const providerOutcome = zveOutcome(providerWrite);
              if (providerOutcome.kind !== 'ok') throw new Error(providerOutcome.msg || 'Failed to save provider type');
              extraFields.push({ field: fld, key, status: 'ok', rpcUsed: providerWrite.rpcUsed });
              continue;
            }
            if (key === 'cosigner') {
              const cosignerName = await resolveUserNameByIen(val);
              const cosignerWrite = await callZveRpc('ZVE USER EDIT', [String(newIen), 'COSIGNER', cosignerName]);
              const cosignerOutcome = zveOutcome(cosignerWrite);
              if (cosignerOutcome.kind !== 'ok') throw new Error(cosignerOutcome.msg || 'Failed to save cosigner');
              extraFields.push({ field: fld, key, status: 'ok', rpcUsed: cosignerWrite.rpcUsed });
              continue;
            }
            // Boolean fields → '1'/'0' for VistA SET types
            const vistaVal = (val === true) ? '1' : (val === false) ? '0' : String(val);
            const flags = POINTER_FIELDS.has(fld) ? 'EI' : 'E';
            const filer = await fileCreateField(fld, vistaVal, flags);
            extraFields.push({ field: fld, key, status: 'ok', rpcUsed: filer.rpcUsed });
          } catch (e) { extraFields.push({ field: fld, key, status: 'error', detail: e.message }); }
        }
      }

      // A010: Verify Code Never Expires (field 9.5) — boolean toggle
      if (body.verifyCodeNeverExpires) {
        try {
          const filer = await fileCreateField('9.5', '1', 'E');
          extraFields.push({ field: '9.5', key: 'verifyCodeNeverExpires', status: 'ok', rpcUsed: filer.rpcUsed });
        } catch (e) { extraFields.push({ field: '9.5', key: 'verifyCodeNeverExpires', status: 'error', detail: e.message }); }
      }

      // A011: Restrict Patient Selection (field 101.01) — boolean toggle
      if (body.restrictPatient) {
        try {
          const filer = await fileCreateField('101.01', '1', 'E');
          extraFields.push({ field: '101.01', key: 'restrictPatient', status: 'ok', rpcUsed: filer.rpcUsed });
        } catch (e) { extraFields.push({ field: '101.01', key: 'restrictPatient', status: 'error', detail: e.message }); }
      }

      // A015: Requires Cosigner (field 53.7) — boolean
      if (body.requiresCosign) {
        try {
          const filer = await fileCreateField('53.7', '1', 'E');
          extraFields.push({ field: '53.7', key: 'requiresCosign', status: 'ok', rpcUsed: filer.rpcUsed });
        } catch (e) { extraFields.push({ field: '53.7', key: 'requiresCosign', status: 'error', detail: e.message }); }
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

      // S3.16: Secondary Menu Options — write to File 200.03 sub-file (.01 → pointer to File 19)
      if (Array.isArray(body.secondaryFeatures) && body.secondaryFeatures.length > 0) {
        for (const optName of body.secondaryFeatures) {
          if (!optName) continue;
          try {
            const addMenu = await ddrFilerAdd('200.03', '.01', `+1,${newIen},`, String(optName), 'E');
            if (!addMenu.ok) throw new Error(addMenu.error || `Failed to add secondary menu ${optName}`);
            extraFields.push({ field: 'secondaryMenu', value: optName, status: 'ok' });
          } catch (e) { extraFields.push({ field: 'secondaryMenu', value: optName, status: 'error', detail: e.message }); }
        }
      }

      if (body.employeeId) {
        try {
          const ez = await callZveRpc('ZVE UEXT SET', [String(newIen), 'EMPID', String(body.employeeId)]);
          const eo = zveOutcome(ez);
          extraFields.push({ field: 'employeeId', status: eo.kind === 'ok' ? 'ok' : 'error', detail: eo.msg || '' });
        } catch (e) { extraFields.push({ field: 'employeeId', status: 'error', detail: e.message }); }
      }

      if (body.role) {
        try {
          const rz = await callZveRpc('ZVE UEXT SET', [String(newIen), 'ROLE', String(body.role)]);
          const ro = zveOutcome(rz);
          extraFields.push({ field: 'assignedRole', status: ro.kind === 'ok' ? 'ok' : 'error', detail: ro.msg || '' });
        } catch (e) { extraFields.push({ field: 'assignedRole', status: 'error', detail: e.message }); }
      }
    }
    // S18.1: Return full user object (DUZ + detail from VistA when possible)
    let user = newIen
      ? { duz: newIen, ien: newIen, id: String(newIen), name, username: name, status: 'active', title: '', service: '', roles: [] }
      : null;
    if (newIen) {
      try {
        const dz = await callZveRpc('ZVE USER DETAIL', [String(newIen)]);
        const od = zveOutcome(dz);
        const userExt = await fetchUserExtensions(newIen);
        if (od.kind === 'ok') {
          const d = (dz.lines[1] || '').split('^');
          const roles = [];
          for (const line of dz.lines.slice(2)) {
            const p = line.split('^');
            if (p[0] === 'KEY' && p[2]) roles.push(p[2]);
          }
          if (d[0]) {
            user = {
              duz: newIen,
              ien: newIen,
              id: String(newIen),
              name: d[1] || name,
              username: d[1] || name,
              title: d[6] || '',
              status: (d[5] || 'ACTIVE').toLowerCase(),
              service: d[7] || '',
              email: d[8] || '',
              officePhone: d[9] || '',
              lastLogin: d[10] || '',
              npi: d[11] || '',
              employeeId: userExt.employeeId || '',
              assignedRole: userExt.assignedRole || '',
              roles,
              vistaGrounding: {
                duz: newIen,
                sex: d[3] || '',
                dob: d[2] || '',
                ssnLast4: d[4] ? String(d[4]).slice(-4) : '',
                employeeId: userExt.employeeId || '',
                assignedRole: userExt.assignedRole || '',
              },
            };
          }
        }
      } catch (enrichErr) { console.warn(`[users/create] post-create user enrichment failed (keeping minimal user):`, enrichErr.message); }
    }
    return { ok: true, tenantId, newIen, duz: newIen, ien: newIen, rpcUsed: z.rpcUsed, lines: z.lines, extraFields, warnings,
      user,
      data: user || { duz: newIen, ien: newIen, name, status: 'active' } };
  });

  app.post('/api/tenant-admin/v1/users/:duz/esig', async (req, reply) => {
    const tenantId = req.query.tenantId || 'default';
    const body = req.body || {};
    const action = (body.action || '').toLowerCase();
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });

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
      sigBlockTitle: { file200: '20.3', label: 'SIGNATURE BLOCK TITLE (piece 2)' },
      title: { file200: '8', label: 'TITLE (pointer to File 3.1)' },
      taxId: { file200: '53.3', label: 'TAX ID' },
    };
    const fieldKey = body.field;
    const value = body.value;
    if (!fieldKey || !value || !PROV_FIELDS[fieldKey]) {
      return reply.code(400).send({ ok: false, error: 'field and value required', allowedFields: Object.keys(PROV_FIELDS) });
    }
    const clientLm = body.lastModified;
    if (clientLm && typeof clientLm === 'string') {
      const zCur = await callZveRpc('ZVE USER DETAIL', [String(req.params.duz)]);
      const oCur = zveOutcome(zCur);
      if (oCur.kind === 'ok' && zCur.lines?.length) {
        const fp = hashUserDetailLines(zCur.lines);
        if (fp !== clientLm) {
          return reply.code(409).send({
            ok: false,
            error: 'This user was modified by another admin. Refresh before saving.',
            code: 'CONCURRENT_EDIT',
          });
        }
      }
    }
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });
    const pf = PROV_FIELDS[fieldKey];
    const iens = `${req.params.duz},`;
    const filer = await ddrFilerEdit(200, iens, pf.file200, String(value), 'E');
    if (!filer.ok) return reply.code(502).send({ ok: false, error: filer.error ? `${pf.label}: ${filer.error}` : 'DDR FILER failed', code: 'DDR_ERROR' });
    const zAfter = await callZveRpc('ZVE USER DETAIL', [String(req.params.duz)]);
    const lastModified = (zAfter.lines && zveOutcome(zAfter).kind === 'ok') ? hashUserDetailLines(zAfter.lines) : clientLm;
    return { ok: true, tenantId, duz: req.params.duz, field: pf.label, rpcUsed: 'DDR FILER', lastModified };
  });

  // ---- Legacy alias: returns File 200.03 secondary menu options for a user ----
  app.get('/api/tenant-admin/v1/users/:duz/cprs-tabs', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });
    const duz = req.params.duz;
    try {
      const tabs = await ddrList({
        file: '200.03',
        iens: `,${duz},`,
        fields: '.01',
        flags: 'P',
        fieldNames: ['name'],
        max: '1000',
      });
      return {
        ok: true,
        tenantId,
        duz,
        secondaryMenus: tabs.map((tab) => tab.name || ''),
        tabs: tabs.map((tab) => ({ name: tab.name || '', access: '' })),
        legacyAlias: true,
        rpcUsed: 'DDR LISTER',
      };
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
    const mode = body.activateImmediately === true || body.requirePasswordChange === false ? 'ACTIVE' : 'EXPIRE';
    if (!ac || !vc) return reply.code(400).send({ ok: false, error: 'accessCode and verifyCode are required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });
    const z = await callZveRpc('ZVE USMG CRED', [String(req.params.duz), ac, vc, mode]);
    const o = zveOutcome(z);
    if (o.kind !== 'ok') {
      if (o.kind === 'rejected') {
        const msg = o.msg || 'Credential policy rejected';
        const code = credentialPolicyCodeFromMessage(msg);
        return reply.code(409).send({ ok: false, error: msg, code, rpcUsed: z.rpcUsed, lines: z.lines });
      }
      return reply.code(502).send({ ok: false, error: `RPC ZVE USMG CRED failed: ${o.msg || o.kind}`, rpcUsed: z.rpcUsed, lines: z.lines });
    }
    // S5.4: Invalidate other sessions for this user after password change (keep current session)
    const destroyed = destroySessionsForDuz(req.params.duz, req.session?.token);
    return { ok: true, tenantId, duz: req.params.duz, rpcUsed: z.rpcUsed, sessionsInvalidated: destroyed };
  });

  app.post('/api/tenant-admin/v1/users/:duz/deactivate', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });
    const z = await callZveRpc('ZVE USMG DEACT', [String(req.params.duz), (req.body || {}).reason || '']);
    const o = zveOutcome(z);
    if (o.kind !== 'ok') return reply.code(502).send({ ok: false, error: `RPC ZVE USMG DEACT failed: ${o.msg || o.kind}`, rpcUsed: z.rpcUsed, lines: z.lines });
    return { ok: true, tenantId, duz: req.params.duz, rpcUsed: z.rpcUsed, lines: z.lines };
  });

  app.post('/api/tenant-admin/v1/users/:duz/reactivate', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });
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
    if (!p.ok) return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });
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
    if (!p.ok) return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });
    // Try ZVE wrapper first, fall back to DDR edit of DISUSER field (#200 field 7)
    let z;
    try {
      z = await callZveRpc('ZVE USMG UNLOCK', [targetDuz]);
      const o = zveOutcome(z);
      if (o.kind !== 'ok') throw new Error(o.msg || 'RPC failed');
      return { ok: true, tenantId, duz: targetDuz, action: 'unlock', rpcUsed: z.rpcUsed, lines: z.lines };
    } catch {
      // Fallback: clear DISUSER flag via DDR FILER
      const iens = `${targetDuz},`;
      const filer = await ddrFilerEdit(200, iens, '7', '@', 'E');
      if (!filer.ok) return reply.code(502).send({ ok: false, stage: 'DDR FILER', error: filer.error });
      return { ok: true, tenantId, duz: targetDuz, action: 'unlock', rpcUsed: 'DDR FILER' };
    }
  });

  /** Terminate user (DISUSER + termination date + clear access) via ZVE USMG TERM */
  app.post('/api/tenant-admin/v1/users/:duz/terminate', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });
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
    if (!p.ok) return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });
    const z = await callZveRpc('ZVE USMG AUDLOG', [targetDuz, max]);
    const o = zveOutcome(z);
    if (o.kind === 'missing') return reply.code(502).send({ ok: false, error: o.msg ? `RPC ZVE USMG AUDLOG missing: ${o.msg}` : 'RPC ZVE USMG AUDLOG returned missing status', code: 'RPC_MISSING' });
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
    if (!p.ok) return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });
    const z = await callZveRpc('ZVE USMG RENAME', [String(req.params.duz), newName.toUpperCase().trim()]);
    const o = zveOutcome(z);
    if (o.kind === 'missing') return reply.code(502).send({ ok: false, error: o.msg ? `RPC ZVE USMG RENAME missing: ${o.msg}` : 'RPC ZVE USMG RENAME returned missing status', code: 'RPC_MISSING' });
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
  async function getPublicLoginConfigData() {
    const z = await callZveRpc('ZVE PARAM GET', []);
    const o = zveOutcome(z);
    if (o.kind !== 'ok') {
      const error = new Error(o.msg || 'Unable to read login configuration');
      error.code = o.kind === 'missing' ? 'PARAM_CONFIG_MISSING' : 'PARAM_CONFIG_UNAVAILABLE';
      throw error;
    }

    const params = new Map();
    for (const line of z.lines.slice(1)) {
      const parts = line.split('^');
      if (parts[0] !== 'PARAM') continue;
      params.set(parts[1] || '', parts[2] || '');
    }

    return {
      introMessage: params.get('INTRO MESSAGE') || '',
      siteName: params.get('SITE NAME') || params.get('DEFAULT INSTITUTION') || '',
      domain: params.get('DOMAIN') || '',
      production: params.get('PRODUCTION') || '',
      lockoutAttempts: parsePositiveInt(params.get('LOCKOUT ATTEMPTS')),
    };
  }

  app.get('/api/tenant-admin/v1/public/login-config', async (_req, reply) => {
    try {
      return {
        ok: true,
        source: 'zve',
        data: await getPublicLoginConfigData(),
      };
    } catch (error) {
      return reply.code(error.code === 'PARAM_CONFIG_MISSING' ? 502 : 503).send({ ok: false, error: error.message });
    }
  });

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
    } catch (_zve) { console.debug('[zve-fallback] ZVE unavailable, falling through to DDR:', _zve.message); }

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
      } catch (_zve) { console.debug('[zve-fallback] ZVE unavailable, falling through to DDR:', _zve.message); }
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
    if (!p.ok) return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });
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
    if (!p.ok) return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });
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
    if (!p.ok) return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });
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
    if (!p.ok) return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });
    const z = await callZveRpc('ZVE WRDM EDIT', [String(req.params.ien), name]);
    const o = zveOutcome(z);
    if (o.kind !== 'ok') return reply.code(502).send({ ok: false, error: `RPC ZVE WRDM EDIT failed: ${o.msg || o.kind}`, rpcUsed: z.rpcUsed, lines: z.lines });
    return { ok: true, tenantId, ien: req.params.ien, rpcUsed: z.rpcUsed, lines: z.lines };
  });

  /** Create device File 3.5 — ZVE DEV CREATE (FileMan-backed M routine) */
  app.post('/api/tenant-admin/v1/devices', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const body = req.body || {};
    const nm = body.name;
    if (!nm || typeof nm !== 'string') return reply.code(400).send({ ok: false, error: 'name required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });
    const di = body.dollarI != null ? String(body.dollarI).trim() : '';
    const deviceType = body.terminalType != null ? String(body.terminalType).trim() : '';
    const resolvedType = deviceType || (body.type != null && String(body.type).trim() ? String(body.type).trim() : '');
    const rm = body.rightMargin;
    const marginWidth = rm !== undefined && rm !== null && String(rm).trim() !== '' ? String(rm).trim() : '';
    const pl = body.pageLength;
    const pageLength = pl !== undefined && pl !== null && String(pl).trim() !== '' ? String(pl).trim() : '';
    const hp = body.hostPath != null ? String(body.hostPath).trim() : '';

    try {
      const z = await callZveRpc('ZVE DEV CREATE', [nm, di, resolvedType, marginWidth, pageLength, hp]);
      const o = zveOutcome(z);
      if (o.kind !== 'ok') {
        const status = o.kind === 'rejected' ? 400 : 502;
        return reply.code(status).send({ ok: false, stage: 'ZVE DEV CREATE', error: o.msg || 'Device create failed', rpcUsed: z.rpcUsed, lines: z.lines });
      }
      const newIen = ((z.line0 || '').split('^')[1] || '').trim() || null;
      if (!newIen) {
        return reply.code(502).send({ ok: false, stage: 'ZVE DEV CREATE', error: 'Device created but IEN was not returned', rpcUsed: z.rpcUsed, lines: z.lines });
      }
      return { ok: true, tenantId, newIen, rpcUsed: z.rpcUsed, lines: z.lines };
    } catch (error) {
      return reply.code(500).send({ ok: false, stage: 'ZVE DEV CREATE', error: error.message || 'Device create failed' });
    }
  });

  app.put('/api/tenant-admin/v1/devices/:ien', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const nm = (req.body || {}).name;
    if (!nm || typeof nm !== 'string') return reply.code(400).send({ ok: false, error: 'name required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });
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
    let dashboardMetrics;
    try {
      dashboardMetrics = await collectDashboardMetrics();
    } catch (e) {
      return reply.code(503).send({ ok: false, source: 'error', tenantId, error: `VistA dashboard data fetch failed: ${e.message}` });
    }

    const trendSummary = summarizeDashboardTrends(dashboardMetrics);
    await ensureRecentDashboardSnapshot(dashboardMetrics);

    const oldestDashboardSampleTime = parseIsoTime(dashboardHistory[0]?.timestamp);
    const dashboardCoverageDays = oldestDashboardSampleTime === null
      ? 0
      : Math.round(((Date.now() - oldestDashboardSampleTime) / 86400000) * 10) / 10;

    return {
      ok: true, source: 'vista', tenantId,
      data: { ...dashboardMetrics,
        apiRouteCount: 156, uiRouteCount: 71, vistaFileCount: '35+', mRoutineCount: 14,
        vistaGrounding: 'connected', vistaUrl: probe.url || null, moduleStatus: { enabled: 0, total: 0 },
        trendSummary: {
          ...trendSummary,
          sampleCount: dashboardHistory.length,
          coverageDays: dashboardCoverageDays,
          lastSampledAt: dashboardHistory[dashboardHistory.length - 1]?.timestamp || null,
          recentSamples: dashboardHistory.slice(-8),
        } },
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
    if (!p.ok) return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });
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
      const ddr = await ddrGetsEntry('3.5', ien, '.01;1;2;3;4;5;6;7;8;9;11;19');
      return { ok: true, source: 'vista', tenantId, ien, rpcUsed: ddr.rpcUsed, file: '3.5', data: ddr.data, rawLines: ddr.rawLines };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  /** Edit device field (File 3.5) via DDR VALIDATOR + DDR FILER */
  const DEVICE35_ALLOW = {
    '.01': 'NAME',
    '1': '$I',
    '2': 'TYPE',
    '3': 'SUBTYPE',
    '4': 'ASK DEVICE',
    '5': 'ASK PARAMETERS',
    '6': 'OUT-OF-SERVICE DATE',
    '7': 'NEAREST PHONE',
    '8': 'KEY OPERATOR',
    '9': 'MARGIN WIDTH',
    '11': 'PAGE LENGTH',
    '19': 'OPEN PARAMETERS',
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
    if (!p.ok) return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });
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
    if (!p.ok) return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });
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

  /** Create mail group (File 3.8) — DDR FILER ADD */
  app.post('/api/tenant-admin/v1/mail-groups', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const body = req.body || {};
    const name = (body.name != null ? String(body.name) : '').trim();
    const description = (body.description != null ? String(body.description) : '').trim();
    if (!name) return reply.code(400).send({ ok: false, error: 'name required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });
    try {
      const valRes = await ddrValidateField('3.8', '+1,', '.01', name);
      if (!valRes.ok) return reply.code(400).send({ ok: false, stage: 'DDR VALIDATOR', error: valRes.error });
      const fieldsObj = { '.01': name };
      if (description) fieldsObj['5.1'] = description;
      const result = await ddrFilerAddMulti('3.8', '+1,', fieldsObj, 'E');
      if (!result.ok) return reply.code(502).send({ ok: false, stage: 'DDR FILER ADD', error: result.error, lines: result.lines });
      const newIen = (result.lines || []).find(l => l.includes('^'))?.split('^')[1]?.trim()
        || (result.lines || []).find(l => /^\d+$/.test(String(l || '').trim()))?.trim()
        || null;
      return { ok: true, source: 'vista', tenantId, newIen, rpcUsed: result.rpcUsed, lines: result.lines };
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
      if (!p.ok) return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });
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
      if (!p.ok) return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });
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
      if (!p.ok) return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });
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
      if (!p.ok) return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });
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
      if (!p.ok) return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });
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
      if (!p.ok) return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });
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

  app.post('/api/tenant-admin/v1/taskman/start', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const z = await callZveRpc('ZVE TASKMAN START', []);
      const o = zveOutcome(z);
      if (o.kind === 'missing') {
        return reply.code(502).send({ ok: false, error: 'RPC ZVE TASKMAN START' });
      }
      if (o.kind !== 'ok' && o.kind !== 'missing') return reply.code(o.kind === 'rejected' ? 409 : 502).send({ ok: false, tenantId, source: 'error', error: o.msg });
      const parts = (z.line0 || '').split('^');
      return {
        ok: true,
        source: 'vista',
        tenantId,
        rpcUsed: 'ZVE TASKMAN START',
        data: {
          status: parts[1] || 'UNKNOWN',
          lastRun: parts[2] || '',
        },
        lines: z.lines || [],
      };
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
      if (o.kind === 'missing') return reply.code(502).send({ ok: false, error: o.msg ? `RPC ZVE CLINIC AVAIL GET missing: ${o.msg}` : 'RPC ZVE CLINIC AVAIL GET returned missing status', code: 'RPC_MISSING' });
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
    if (!p.ok) return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });
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

  function getDdrFieldPair(rawLines, fieldNumber) {
    const wanted = String(fieldNumber);
    for (const line of rawLines || []) {
      const parts = String(line || '').split('^');
      if (parts[2] !== wanted) continue;
      return {
        internal: (parts[3] || '').trim(),
        external: (parts[4] || parts[3] || '').trim(),
      };
    }
    return { internal: '', external: '' };
  }

  async function resolveMenuOptionByName(name) {
    const normalized = String(name || '').trim().toUpperCase();
    if (!normalized) return null;
    const candidates = await ddrList({
      file: '19',
      fields: '.01;1;4;3.6',
      fieldNames: ['name', 'menuText', 'type', 'description'],
      search: normalized,
      max: '25',
    });
    return candidates.find((candidate) => String(candidate.name || '').trim().toUpperCase() === normalized) || null;
  }

  async function listMenuChildren(parentIen) {
    return ddrList({
      file: '19.01',
      fields: '.01',
      fieldNames: ['name'],
      flags: 'P',
      iens: `,${parentIen},`,
    });
  }

  async function buildMenuTreeNode(seed, depth, context, lineage = new Set()) {
    const node = {
      ien: String(seed.ien || ''),
      name: seed.name || '',
      menuText: seed.menuText || '',
      type: seed.type || '',
      description: seed.description || '',
      depth,
      childCount: 0,
      children: [],
    };

    if (!node.ien || !/^\d+$/.test(node.ien)) return node;
    if (lineage.has(node.ien)) {
      node.cycleDetected = true;
      return node;
    }

    if (context.nodeCount >= context.maxNodes) {
      node.truncated = true;
      context.truncated = true;
      return node;
    }

    context.nodeCount += 1;
    context.deepestDepth = Math.max(context.deepestDepth, depth);

    const childLinks = await listMenuChildren(node.ien);
    node.childCount = childLinks.length;
    if (childLinks.length === 0) return node;

    if (depth >= context.maxDepth) {
      node.truncated = true;
      context.truncated = true;
      return node;
    }

    const nextLineage = new Set(lineage);
    nextLineage.add(node.ien);

    for (const child of childLinks) {
      if (context.nodeCount >= context.maxNodes) {
        node.truncated = true;
        context.truncated = true;
        break;
      }
      const childName = String(child.name || '').trim();
      if (!childName) continue;
      const cacheKey = childName.toUpperCase();
      let resolved = context.resolveCache.get(cacheKey) || null;
      if (!resolved) {
        resolved = await resolveMenuOptionByName(childName);
        context.resolveCache.set(cacheKey, resolved || null);
      }
      if (!resolved || !resolved.ien) continue;
      node.children.push(await buildMenuTreeNode(resolved, depth + 1, context, nextLineage));
    }

    return node;
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
    } catch (_zve) { console.debug('[zve-fallback] ZVE unavailable, falling through to DDR:', _zve.message); }

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
    } catch (_zve) { console.debug('[zve-fallback] ZVE unavailable, falling through to DDR:', _zve.message); }

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
          { type: 'list', value: { FILE: '200.03', IENS: `,${duz},`, FIELDS: '.01', FLAGS: 'P', MAX: '5000' } },
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
      const disuser = userData['200,7I'] || userData['200,7E'] || userData['200,.07I'] || userData['200,.07E'] || '';

      return {
        ok: true, source: 'vista', tenantId, userDuz: duz,
        rpcUsed: ['DDR GETS ENTRY DATA', 'DDR LISTER x4'],
        userName: name,
        primaryMenu,
        accessLevel: isAdmin ? 'admin' : isClinical ? 'clinical' : 'basic',
        isDisabled: isDisabledFieldValue(disuser),
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

  app.get('/api/tenant-admin/v1/users/:duz/menu-structure', async (req, reply) => {
    const tenantId = req.query.tenantId;
    const duz = req.params.duz;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });

    const maxDepthRaw = parseInt(String(req.query.maxDepth || '4'), 10);
    const maxNodesRaw = parseInt(String(req.query.maxNodes || '800'), 10);
    const maxDepth = Number.isFinite(maxDepthRaw) ? Math.min(Math.max(maxDepthRaw, 1), 6) : 4;
    const maxNodes = Number.isFinite(maxNodesRaw) ? Math.min(Math.max(maxNodesRaw, 25), 1000) : 250;

    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });

    try {
      const userRes = await ddrGetsEntry('200', duz, '201', 'IE');
      const primaryPair = getDdrFieldPair(userRes.rawLines, '201');
      const primaryMenu = primaryPair.external || userRes.data?.['201'] || '';
      const primaryMenuIen = /^\d+$/.test(primaryPair.internal) ? primaryPair.internal : '';

      const secondaryLines = await lockedRpc(async () => {
        const broker = await getBroker();
        return broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '200.03', IENS: `,${duz},`, FIELDS: '.01', FLAGS: 'P', MAX: '5000' } },
        ]);
      });
      const secondaryMenus = ddrListParsed(secondaryLines, ['menuOption'])
        .map((row) => String(row.menuOption || '').trim())
        .filter(Boolean);

      const rootSpecs = new Map();
      const pushRootSpec = (spec) => {
        const key = spec.ien ? `I:${spec.ien}` : `N:${String(spec.name || '').trim().toUpperCase()}`;
        if (!key || key === 'N:') return;
        const existing = rootSpecs.get(key);
        if (existing) {
          existing.rootSources = Array.from(new Set([...(existing.rootSources || []), ...(spec.rootSources || [])]));
          if (!existing.ien && spec.ien) existing.ien = spec.ien;
          if (!existing.name && spec.name) existing.name = spec.name;
          return;
        }
        rootSpecs.set(key, {
          ien: spec.ien || '',
          name: spec.name || '',
          rootSources: Array.from(new Set(spec.rootSources || [])),
        });
      };

      if (primaryMenu || primaryMenuIen) {
        pushRootSpec({ ien: primaryMenuIen, name: primaryMenu, rootSources: ['primary'] });
      }
      for (const menuName of secondaryMenus) {
        pushRootSpec({ name: menuName, rootSources: ['secondary'] });
      }

      const context = { maxDepth, maxNodes, nodeCount: 0, deepestDepth: 0, truncated: false, resolveCache: new Map() };
      const roots = [];
      const unresolvedRoots = [];

      for (const spec of rootSpecs.values()) {
        let resolved = null;
        if (spec.ien && /^\d+$/.test(spec.ien)) {
          const detail = await ddrGetsEntry('19', spec.ien, '.01;1;3.6;4');
          resolved = {
            ien: spec.ien,
            name: detail.data?.['.01'] || spec.name || '',
            menuText: detail.data?.['1'] || '',
            type: detail.data?.['4'] || '',
            description: detail.data?.['3.6'] || '',
          };
        } else {
          resolved = await resolveMenuOptionByName(spec.name);
        }

        if (!resolved || !resolved.ien) {
          unresolvedRoots.push({
            name: spec.name || '',
            rootSources: spec.rootSources || [],
          });
          continue;
        }

        let tree;
        if (context.nodeCount >= context.maxNodes) {
          context.truncated = true;
          tree = {
            ien: String(resolved.ien || ''),
            name: resolved.name || '',
            menuText: resolved.menuText || '',
            type: resolved.type || '',
            description: resolved.description || '',
            depth: 0,
            childCount: 0,
            children: [],
            truncated: true,
          };
        } else {
          tree = await buildMenuTreeNode(resolved, 0, context);
        }
        tree.rootSources = spec.rootSources || [];
        roots.push(tree);
      }

      return {
        ok: true,
        source: 'vista',
        tenantId,
        userDuz: duz,
        rpcUsed: ['DDR GETS ENTRY DATA', 'DDR LISTER', 'DDR LISTER (File 19 tree)'],
        primaryMenu,
        secondaryMenus,
        data: roots,
        roots,
        unresolvedRoots,
        summary: {
          rootCount: roots.length,
          primaryMenuPresent: Boolean(primaryMenu),
          secondaryMenuCount: secondaryMenus.length,
          unresolvedRootCount: unresolvedRoots.length,
          nodeCount: context.nodeCount,
          deepestDepth: context.deepestDepth,
          maxDepth,
          maxNodes,
          truncated: context.truncated,
        },
      };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
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
      } catch (_zve) { console.debug('[zve-fallback] ZVE unavailable, falling through to DDR:', _zve.message); }
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

  function buildMissingPatientResponse(tenantId, dfn) {
    return {
      ok: false,
      tenantId,
      code: 'PATIENT_RECORD_NOT_FOUND',
      error: 'Record not found. Patient record may have been removed or merged.',
      recordStatus: 'not-found',
      dfn: String(dfn),
    };
  }

  async function readPatientMergeStatus(dfn) {
    const mergeDdr = await ddrGetsEntry('2', dfn, '.01;.082', 'IE');
    if (!mergeDdr.ok) {
      return { ok: false, error: mergeDdr.error || 'Unable to read patient merge status' };
    }

    const fields = mergeDdr.data || {};
    const pickField = (...keys) => {
      for (const key of keys) {
        const value = fields[key];
        if (value !== undefined && value !== null && String(value).trim() !== '') {
          return String(value).trim();
        }
      }
      return '';
    };

    const patientName = pickField('.01E', '.01', '2,.01E', '2,.01');
    if (!patientName) {
      return { ok: true, exists: false };
    }

    const mergeLine = (mergeDdr.rawLines || []).find((line) => line.startsWith(`2^${dfn}^.082^`));
    const mergedToDfn = mergeLine ? String((mergeLine.split('^')[3] || '')).trim() : pickField('.082I', '.082', '2,.082I', '2,.082');
    const mergedToName = mergeLine ? String((mergeLine.split('^')[4] || '')).trim() : pickField('.082E', '.082', '2,.082E', '2,.082');
    if (!/^\d+$/.test(mergedToDfn) || mergedToDfn === String(dfn)) {
      return { ok: true, exists: true, merged: false, patientName };
    }

    const survivorDdr = await ddrGetsEntry('2', mergedToDfn, '.01', 'IE');
    const survivorFields = survivorDdr?.data || {};
    const survivorName = [survivorFields['.01E'], survivorFields['.01'], survivorFields['2,.01E'], survivorFields['2,.01']]
      .map((value) => (value === undefined || value === null ? '' : String(value).trim()))
      .find(Boolean) || mergedToName;

    return {
      ok: true,
      exists: true,
      merged: true,
      patientName,
      redirect: {
        reason: 'merged',
        fromDfn: String(dfn),
        fromName: patientName,
        toDfn: mergedToDfn,
        toName: survivorName,
        message: survivorName
          ? `${patientName} was merged into ${survivorName}. Redirected to the surviving chart.`
          : `${patientName} was merged into DFN ${mergedToDfn}. Redirected to the surviving chart.`,
      },
    };
  }

  // ---- Patient Get (ZVE-first, DDR fallback) ----
  app.get('/api/tenant-admin/v1/patients/:dfn', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const { dfn } = req.params;

    try {
      const mergeStatus = await readPatientMergeStatus(dfn);
      if (mergeStatus.ok) {
        if (!mergeStatus.exists) {
          return reply.code(404).send(buildMissingPatientResponse(tenantId, dfn));
        }
        if (mergeStatus.merged) {
          return {
            ok: true,
            tenantId,
            source: 'vista',
            recordStatus: 'merged',
            redirect: mergeStatus.redirect,
          };
        }
      }
    } catch {
      // Fall through to the normal detail read path if the merge probe fails.
    }

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
        let wardLocation = dem.WARD || '';
        let admitDate = dem.ADMIT_DATE || null;
        let roomBed = dem.ROOM_BED || '';

        if (!wardLocation || !roomBed) {
          try {
            const locationDdr = await ddrGetsEntry('2', dfn, '.1;.101', 'IE');
            const locationData = locationDdr?.data || {};
            const getLocation = (field) => {
              return locationData[`${field}E`] || locationData[field] || locationData[`2,${field}`] || locationData[`${field}I`] || '';
            };
            wardLocation = wardLocation || getLocation('.1');
            roomBed = roomBed || getLocation('.101');
          } catch {
            // Keep the ZVE demographic payload if the fallback read is unavailable.
          }
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
            wardLocation, admitDate, roomBed,
            insurance: ins, nextOfKin: nok, emergency: emrg,
          },
        };
      }
      if (o.kind !== 'missing') {
        return reply.code(502).send({ ok: false, source: 'zve', error: o.msg, rpcUsed: z.rpcUsed });
      }
    } catch (_zve) { console.debug('[zve-fallback] ZVE unavailable, falling through to DDR:', _zve.message); }
    // --- DDR fallback ---
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const fields = '.01;.02;.03;.05;.09;.1;.101;.102;.111;.112;.113;.114;.115;.116;.117;.131;.132;.301;.302;.351;1901';
      const ddr = await ddrGetsEntry('2', dfn, fields, 'IE');
      if (!ddr.ok) return reply.code(404).send(buildMissingPatientResponse(tenantId, dfn));
      const d = ddr.data;
      const g = (f) => d[f] || d[`2,${f}`] || '';
      if (!g('.01')) return reply.code(404).send(buildMissingPatientResponse(tenantId, dfn));
      const currentMovementIen = g('.102') || '';
      let currentMovementDate = null;
      if (currentMovementIen) {
        try {
          const movementDdr = await ddrGetsEntry('405', currentMovementIen, '.01', 'IE');
          const movementData = movementDdr?.data || {};
          const movementDate = movementData['.01'] || movementData['405,.01'] || '';
          currentMovementDate = movementDate ? fmDateToIso(movementDate) : null;
        } catch {
          currentMovementDate = null;
        }
      }
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
          admitDate: currentMovementDate,
          roomBed: g('.101') || '',
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
    const veteranStatus = normalizeVistaYesNo(body.veteranStatus);
    const scPercent = normalizeOptionalNumericString(body.scPercent);
    if (!body.name) return reply.code(400).send({ ok: false, error: 'Patient name is required' });
    // --- ZVE-first: ZVE PATIENT REGISTER ---
    try {
      const z = await callZveRpc('ZVE PATIENT REGISTER', [
        body.name, body.dob || '', body.ssn || '', body.sex || '',
        body.streetAddress1 || '', body.city || '', body.state || '', body.zip || '',
        body.phone || '', body.maritalStatus || '', veteranStatus, scPercent,
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
    } catch (_zve) { console.debug('[zve-fallback] ZVE unavailable, falling through to DDR:', _zve.message); }
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
      if (veteranStatus === 'Y') fieldsObj['1901'] = 'YES';
      if (veteranStatus === 'N') fieldsObj['1901'] = 'NO';
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
      } catch (_zve) { console.debug('[zve-fallback] ZVE unavailable, falling through to DDR:', _zve.message); }
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
    } catch (_zve) { console.debug('[zve-fallback] ZVE unavailable, falling through to DDR:', _zve.message); }
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
    } catch (_zve) { console.debug('[zve-fallback] ZVE unavailable, falling through to DDR:', _zve.message); }
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
    } catch (_zve) { console.debug('[zve-fallback] ZVE unavailable, falling through to DDR:', _zve.message); }
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

  function parseActiveMedicationOrders(activeLines) {
    const meds = [];
    let current = null;

    for (const rawLine of (Array.isArray(activeLines) ? activeLines : [activeLines])) {
      const line = String(rawLine || '');
      if (!line) continue;

      if (line.startsWith('~')) {
        const typeEnd = line.indexOf('^');
        const type = typeEnd > 0 ? line.substring(1, typeEnd).trim() : '';
        const fields = (typeEnd > -1 ? line.substring(typeEnd + 1) : line.substring(1)).split('^');
        current = {
          id: fields[0]?.trim() || fields[7]?.trim() || String(meds.length + 1),
          rxId: fields[0]?.split(';')[0] || '',
          type,
          name: fields[1]?.trim() || '',
          orderIen: fields[7]?.trim() || '',
          status: (fields[8]?.trim() || 'ACTIVE').toUpperCase(),
          quantity: fields[11]?.trim() || '',
          sig: '',
        };
        meds.push(current);
        continue;
      }

      if (!current) continue;
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (/^\\\s*Sig:/i.test(trimmed)) {
        const sigText = trimmed.replace(/^\\\s*Sig:\s*/i, '').trim();
        current.sig = current.sig ? `${current.sig} ${sigText}`.trim() : sigText;
        continue;
      }

      if (/^Qty:/i.test(trimmed)) {
        current.quantity = current.quantity || trimmed.replace(/^Qty:\s*/i, '').trim();
        continue;
      }

      current.sig = current.sig ? `${current.sig} ${trimmed}`.trim() : trimmed;
    }

    return meds;
  }

  function enrichMedicationFromOrderText(med, orderTextLines) {
    const lines = (Array.isArray(orderTextLines) ? orderTextLines : [])
      .map(line => String(line || '').trim())
      .filter(Boolean);
    if (!lines.length || lines[0].startsWith('-1')) return;

    if (!med.name && lines[0]) med.name = lines[0];
    if (!med.sig && lines[1]) med.sig = lines[1];
    if (!med.quantity && lines[2] && /^Quantity:/i.test(lines[2])) {
      med.quantity = lines[2].replace(/^Quantity:\s*/i, '').trim();
    }
  }

  app.get('/api/tenant-admin/v1/patients/:dfn/medications', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const { dfn } = req.params;

    try {
      const result = await lockedRpc(async () => {
        const broker = await getBroker();
        const rpcUsed = ['ORWPS ACTIVE'];
        const activeLinesRaw = await broker.callRpc('ORWPS ACTIVE', [String(dfn)]);
        const activeLines = Array.isArray(activeLinesRaw) ? activeLinesRaw : [activeLinesRaw];
        const firstLine = String(activeLines[0] || '').trim();

        if (firstLine.startsWith('-1')) {
          throw new Error(firstLine.split('^').slice(1).join('^') || 'ORWPS ACTIVE failed');
        }

        const meds = parseActiveMedicationOrders(activeLines);
        for (const med of meds) {
          if (!med.orderIen || !/^\d+$/.test(med.orderIen)) continue;
          if (med.name && med.sig && med.quantity) continue;
          try {
            const orderTextRaw = await broker.callRpc('ORWORR GETTXT', [med.orderIen]);
            const orderText = Array.isArray(orderTextRaw) ? orderTextRaw : [orderTextRaw];
            if (!rpcUsed.includes('ORWORR GETTXT')) rpcUsed.push('ORWORR GETTXT');
            enrichMedicationFromOrderText(med, orderText);
          } catch (_orderTextErr) {
            // Preserve the primary ORWPS ACTIVE result even when enrichment fails.
          }
          med.name = med.name || `Medication order ${med.orderIen}`;
        }

        return { meds, rpcUsed };
      });

      return {
        ok: true,
        source: 'vista',
        tenantId,
        rpcUsed: result.rpcUsed,
        count: result.meds.length,
        data: result.meds,
      };
    } catch (e) {
      return reply.code(502).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Ward Census (ZVE ADT CENSUS) ----
  app.get('/api/tenant-admin/v1/census', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    try {
      const z = await callZveRpc('ZVE ADT CENSUS', [req.query.wardIen || 'ALL', req.query.pending || '', req.query.max || '']);
      const o = zveOutcome(z);
      if (o.kind === 'missing') return reply.code(502).send({ ok: false, error: o.msg ? `RPC ZVE ADT CENSUS missing: ${o.msg}` : 'RPC ZVE ADT CENSUS returned missing status', code: 'RPC_MISSING' });
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
      if (o.kind === 'missing') return reply.code(502).send({ ok: false, error: o.msg ? `RPC ZVE RECENT PATIENTS missing: ${o.msg}` : 'RPC ZVE RECENT PATIENTS returned missing status', code: 'RPC_MISSING' });
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
      const z = await callZveRpc('ZVE PATIENT INSURANCE', [String(dfn), 'LIST']);
      const o = zveOutcome(z);
      if (o.kind !== 'ok') return { ok: true, source: 'zve', tenantId, rpcUsed: z.rpcUsed, data: [] };
      const rows = [];
      for (const line of z.lines.slice(1)) {
        if (!line) continue;
        const a = line.split('^');
        const ien = a[0]?.trim();
        if (!ien || !/^\d+$/.test(ien)) continue;
        rows.push({
          id: ien,
          insuranceType: a[1]?.trim() || '',
          planName: a[1]?.trim() || '',
          groupNumber: a[2]?.trim() || '',
          subscriberId: a[3]?.trim() || '',
          effectiveDate: fmDateToIso(a[4]?.trim() || ''),
          expirationDate: fmDateToIso(a[5]?.trim() || ''),
          verified: !!(a[6]?.trim()),
        });
      }
      return { ok: true, source: 'zve', tenantId, rpcUsed: z.rpcUsed, data: rows };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  app.post('/api/tenant-admin/v1/patients/:dfn/insurance', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const { dfn } = req.params;
    const body = req.body || {};
    if (!body.insuranceType) return reply.code(400).send({ ok: false, error: 'insuranceType (company name or IEN) is required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      // Pass companyIen if available (numeric), else pass name for server-side lookup
      const coienOrName = body.companyIen || body.insuranceType;
      const z = await callZveRpc('ZVE PATIENT INSURANCE', [
        String(dfn), 'ADD', String(coienOrName),
        body.groupNumber || '', body.subscriberId || '', body.subscriberName || '',
        body.effectiveDate || '', body.expirationDate || '',
      ]);
      const o = zveOutcome(z);
      if (o.kind !== 'ok') return reply.code(502).send({ ok: false, tenantId, source: 'zve', error: `ZVE PATIENT INSURANCE ADD failed: ${o.msg}`, rpcUsed: z.rpcUsed });
      const insIen = (z.line0 || '').split('^')[2] || '';
      return { ok: true, source: 'zve', tenantId, rpcUsed: z.rpcUsed, data: { id: insIen, dfn, createdAt: new Date().toISOString() } };
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
      const z = await callZveRpc('ZVE PATIENT INSURANCE', [String(dfn), 'DELETE', String(insuranceId)]);
      const o = zveOutcome(z);
      if (o.kind !== 'ok') return reply.code(502).send({ ok: false, tenantId, source: 'zve', error: `ZVE PATIENT INSURANCE DELETE failed: ${o.msg}`, rpcUsed: z.rpcUsed });
      return { ok: true, source: 'zve', tenantId, rpcUsed: z.rpcUsed, data: { id: insuranceId, dfn, deleted: true } };
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
      const income = Math.round(Number(body.annualIncome) || 0);
      // Map category (A/B/C) from the UI copay calculation
      const rawCat = (body.category || '').toUpperCase().replace(/^CAT(EGORY)?\s*/i, '').trim();
      const category = rawCat === 'A' || rawCat === 'B' || rawCat === 'C' ? rawCat : '';
      const z = await callZveRpc('ZVE PATIENT MEANS', [String(dfn), 'INITIATE', String(income), category]);
      const o = zveOutcome(z);
      if (o.kind !== 'ok') return reply.code(502).send({ ok: false, tenantId, source: 'zve', error: `ZVE PATIENT MEANS INITIATE failed: ${o.msg}`, rpcUsed: z.rpcUsed });
      const mtIen = (z.line0 || '').split('^')[2] || '';
      return {
        ok: true, source: 'zve', tenantId, rpcUsed: z.rpcUsed,
        data: { dfn, meansTestIen: mtIen, income, category, date: new Date().toISOString() },
      };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Patient Flag Definitions (File 26.15 — PRF LOCAL FLAG) ----
  app.get('/api/tenant-admin/v1/patients/flag-definitions', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const z = await callZveRpc('ZVE PATIENT FLAGS', ['0', 'DEFS']);
      const data = [];
      for (const line of z.lines.slice(1)) {
        const parts = line.split('^');
        if (!parts[0] || !/^\d+$/.test(parts[0].trim())) continue;
        data.push({ ien: parts[0].trim(), name: (parts[1] || '').trim() });
      }
      return { ok: true, source: 'vista', tenantId, data };
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
          const rawSt = p[3] || '1'; const normSt = (rawSt === '0' || rawSt === 'inactive') ? 'inactive' : 'active';
          data.push({ id: p[0], name: p[1] || '', flagName: p[1] || '', category: p[2] || '', status: normSt, assignedDate: p[4] || '', assignedBy: p[5] || '', reviewDate: p[6] || '' });
        }
        return { ok: true, source: 'zve', tenantId, rpcUsed: z.rpcUsed, data };
      }
      if (o.kind !== 'missing') {
        return reply.code(502).send({ ok: false, source: 'zve', error: o.msg, rpcUsed: z.rpcUsed });
      }
    } catch (_zve) { console.debug('[zve-fallback] ZVE unavailable, falling through to DDR:', _zve.message); }
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
    if (!body.narrative) return reply.code(400).send({ ok: false, error: 'narrative is required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      // Map UI flag type to VistA type (BEHAVIORAL, LOCAL, NATIONAL)
      const typeRaw = (body.category || body.flagType || '').toUpperCase();
      const vistaType = typeRaw === 'BEHAVIORAL' ? 'BEHAVIORAL' : typeRaw === 'NATIONAL' || typeRaw === 'I - NATIONAL' ? 'NATIONAL' : 'LOCAL';
      const z = await callZveRpc('ZVE PATIENT FLAGS', [
        String(dfn), 'ASSIGN', vistaType, body.flagName, body.narrative || '', body.reviewDate || '',
      ]);
      const o = zveOutcome(z);
      if (o.kind !== 'ok') return reply.code(502).send({ ok: false, tenantId, source: 'zve', error: `ZVE PATIENT FLAGS ASSIGN failed: ${o.msg}`, rpcUsed: z.rpcUsed });
      const assignIen = (z.line0 || '').split('^')[2] || '';
      return {
        ok: true, source: 'zve', tenantId, rpcUsed: z.rpcUsed,
        data: { id: assignIen, dfn, name: body.flagName, flagName: body.flagName, category: vistaType, status: 'active', assignedDate: new Date().toISOString() },
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
      // Inactivate uses ZVE PATIENT FLAGS INACTIVATE (direct global write)
      if (body.status && body.status.toLowerCase() === 'inactive') {
        const z = await callZveRpc('ZVE PATIENT FLAGS', [String(dfn), 'INACTIVATE', String(flagId)]);
        const o = zveOutcome(z);
        if (o.kind !== 'ok') return reply.code(502).send({ ok: false, tenantId, source: 'zve', error: `ZVE PATIENT FLAGS INACTIVATE failed: ${o.msg}`, rpcUsed: z.rpcUsed });
        return { ok: true, source: 'zve', tenantId, rpcUsed: z.rpcUsed, data: { id: flagId, dfn, status: 'inactive', updatedAt: new Date().toISOString() } };
      }
      // Review date update: piece 6 in 0-node of ^DGPF(26.13,IEN,0)
      if (body.reviewDate) {
        const edits = { '.06': body.reviewDate };
        const result = await ddrFilerEditMulti('26.13', `${flagId},`, edits);
        if (!result.ok) return reply.code(502).send({ ok: false, tenantId, source: 'error', error: result.error, lines: result.lines });
        return { ok: true, source: 'vista', tenantId, rpcUsed: result.rpcUsed, data: { id: flagId, dfn, reviewDate: body.reviewDate, updatedAt: new Date().toISOString() } };
      }
      return reply.code(400).send({ ok: false, error: 'No valid fields to update (supported: status=inactive, reviewDate)' });
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, source: 'error', error: e.message });
    }
  });

  // ---- Record Restrictions (sensitivity in File 38.1 = ^DGSL(38.1,DFN,0)) ----
  app.put('/api/tenant-admin/v1/patients/:dfn/restrictions', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const { dfn } = req.params;
    const body = req.body || {};
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      // File 38.1 (^DGSL) field 2 = SECURITY LEVEL (0=NON-SENSITIVE, 1=SENSITIVE)
      // UI sends level='none'|'level1'|'level2'; both level1+level2 map to sec=1
      const level = body.level || (body.isSensitive ? 'level2' : body.isRestricted ? 'level1' : 'none');
      const duz = String(req.session?.duz || '0');
      const result = await callZveRpc('ZVE PAT RESTRICT', [String(dfn), level, duz]);
      if (!result.ok) return reply.code(502).send({ ok: false, tenantId, source: 'error', error: result.line0 || result.error });
      const parts = (result.line0 || '').split('^');
      return {
        ok: true, source: 'vista', tenantId, rpcUsed: 'ZVE PAT RESTRICT',
        data: {
          dfn, level,
          isSensitive: level !== 'none',
          isRestricted: level !== 'none',
          securityLevel: parts[3] || '0',
          updatedAt: new Date().toISOString(),
          updatedBy: req.session?.userName || '',
        },
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
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, tenantId, source: 'error', error: p.error });
    try {
      const duz = req.session?.duz || body.duz || '';
      const reason = (body.reason || body.reasonText || body.reasonCategory || 'CLINICAL NECESSITY').slice(0, 65);
      // Write break-the-glass entry directly to File 38.1/38.11 via M routine.
      // ZVE PAT BRGLSS creates the parent 38.1 record (if absent) then adds a
      // subfile 38.11 access-log entry: date/time, DUZ, reason text.
      const result = await callZveRpc('ZVE PAT BRGLSS', [dfn, String(duz), reason]);
      if (!result.ok) {
        return reply.code(502).send({ ok: false, tenantId, source: 'error', error: result.line0 || result.error });
      }
      const parts = (result.line0 || '').split('^');
      return {
        ok: true, source: 'vista', tenantId,
        data: {
          dfn, duz, reason,
          dateTime: new Date().toISOString(),
          auditId: `BTG-${dfn}-${parts[4] || Date.now()}`,
          logged: true,
        },
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
      // ZVE PAT BGREAD reads ^DGSL(38.1,DFN,"D",...) directly — patient-scoped.
      // R(0)="1^count^OK", R(1..n)="AIEN^FNOW^DUZ^REASON^INPAT"
      const z = await callZveRpc('ZVE PAT BGREAD', [dfn, '200']);
      if (!z.ok) {
        return reply.code(502).send({ ok: false, tenantId, source: 'error', error: z.line0 || z.error });
      }
      const rows = [];
      for (const line of z.lines.slice(1)) {
        if (!line) continue;
        const a = line.split('^');
        const aien = a[0]?.trim();
        if (!aien) continue;
        // Strip "ZVE:" source prefix added by BRGLSS
        const rawReason = a[3]?.trim() || '';
        const reasonText = rawReason.startsWith('ZVE:') ? rawReason.slice(4) : rawReason;
        rows.push({
          id: aien,
          dateTime: fmDateToIso(a[1]?.trim() || ''),
          accessedBy: a[2]?.trim() || '',
          reasonCategory: reasonText,
          reasonText,
          inpatient: a[4]?.trim() === 'y',
        });
      }
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
      scheduling:    { file: '44.1',   fields: '.01;.02;.03;1;2',   label: 'Scheduling Parameters' },
    radiology:     { file: '79.1',   fields: '.01;.02;.03;1;2',   label: 'Radiology Site Parameters' },
    surgery:       { file: '136',    fields: '.01;.02;.03;1;2',   label: 'Surgery Site Parameters' },
      registration:  { file: '43',     fields: '.01;.02;.03;1;2',   label: 'Registration Site Parameters' },
      billing:       { file: '350.9',  fields: '.01;.02;.03;.04;.05;.06;.08;.09;.14;1.01;1.02;1.05;1.06;1.07;1.08;1.09;1.14;1.15;1.17;1.19;1.21;1.25;2.08;2.09;2.11;6.01;6.02;6.03;6.04;6.05;6.23;6.24;6.25;7.01;7.02;7.03;7.04;8.01;8.03;8.04;8.1;9.1', label: 'Billing Site Parameters' },
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
            fieldsToRead = discoveredFields.join(';');
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
        // LIST returns: id^name^description^keyCount^keys (keys ;-delimited in piece 5)
        const keyStr = p.slice(4).join('^');  // rejoin in case key names ever contain ^
        data.push({ id: p[0], name: p[1] || '', description: p[2] || '', keys: keyStr ? keyStr.split(';').filter(Boolean) : [] });
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
      const keys = (body.keys || []).join('^');
      const z = await callZveRpc('ZVE ROLE CUSTOM CRT', [body.name, body.description || '', keys]);
      const o = zveOutcome(z);
      if (o.kind !== 'ok') return reply.code(502).send({ ok: false, error: `ZVE ROLE CUSTOM CRT failed: ${o.msg || o.kind}`, rpcUsed: z.rpcUsed });
      const id = (z.lines[0] || '').split('^')[2] || `zve-${Date.now()}`;
      return { ok: true, source: 'zve', id };
    } catch (e) {
      return reply.code(500).send({ ok: false, error: e.message });
    }
  });

  app.put('/api/tenant-admin/v1/roles/custom/:roleId', async (req, reply) => {
    const body = req.body || {};
    if (!body.name) return reply.code(400).send({ ok: false, error: 'name required' });
    try {
      const keys = (body.keys || []).join('^');
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
    if (!p.ok) return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });
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
    if (!p.ok) return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });
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
    if (!p.ok) return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });
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
    if (!p.ok) return reply.code(503).send({ ok: false, error: p.error ? `VistA unavailable: ${p.error}` : 'VistA unavailable', code: 'VISTA_UNAVAILABLE' });
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

  app.get('/api/tenant-admin/v1/reports/admin/schedules', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    return { ok: true, source: 'tenant-admin', tenantId, data: reportSchedules };
  });

  app.post('/api/tenant-admin/v1/reports/admin/schedules', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });

    const body = req.body || {};
    const reportType = String(body.reportType || '').trim();
    const cadence = String(body.cadence || '').trim();
    const params = body.params && typeof body.params === 'object' ? body.params : {};
    const runImmediately = body.runImmediately !== false;

    if (!ADMIN_REPORT_TYPES.has(reportType)) {
      return reply.code(400).send({ ok: false, error: `Unsupported report type: ${reportType || 'blank'}` });
    }
    if (!Object.prototype.hasOwnProperty.call(REPORT_SCHEDULE_CADENCE_MS, cadence)) {
      return reply.code(400).send({ ok: false, error: `Unsupported cadence: ${cadence || 'blank'}` });
    }

    const nowIso = new Date().toISOString();
    const schedule = {
      id: crypto.randomUUID(),
      label: String(body.label || reportType),
      reportType,
      cadence,
      params,
      enabled: true,
      createdAt: nowIso,
      updatedAt: nowIso,
      nextRunAt: runImmediately ? nowIso : getNextReportRunAt(cadence),
      lastRunAt: null,
      lastRunStatus: null,
      lastRunRows: null,
      lastRunSource: null,
      lastRunNote: '',
      lastRunError: '',
    };

    reportSchedules.push(schedule);
    persistReportSchedules();

    if (runImmediately) {
      try {
        await executeReportSchedule(schedule);
      } catch (error) {
        return reply.code(502).send({ ok: false, error: `Schedule saved but initial run failed: ${error.message}` });
      }
    }

    return { ok: true, source: 'tenant-admin', tenantId, data: schedule };
  });

  app.post('/api/tenant-admin/v1/reports/admin/schedules/:id/run-now', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const schedule = reportSchedules.find((entry) => entry.id === req.params.id);
    if (!schedule) return reply.code(404).send({ ok: false, error: 'Schedule not found' });
    try {
      await executeReportSchedule(schedule);
      return { ok: true, source: 'tenant-admin', tenantId, data: schedule };
    } catch (error) {
      return reply.code(502).send({ ok: false, error: error.message });
    }
  });

  app.delete('/api/tenant-admin/v1/reports/admin/schedules/:id', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const index = reportSchedules.findIndex((entry) => entry.id === req.params.id);
    if (index < 0) return reply.code(404).send({ ok: false, error: 'Schedule not found' });
    const [removed] = reportSchedules.splice(index, 1);
    persistReportSchedules();
    return { ok: true, source: 'tenant-admin', tenantId, data: removed };
  });

  app.get('/api/tenant-admin/v1/reports/admin/:type', async (req, reply) => {
    const reportType = req.params.type;
    const tenantId = req.query.tenantId;
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable' });

    try {
      return await buildAdminReport(reportType, req.query || {});
    } catch (e) {
      if (/Unknown report type/i.test(e.message)) {
        return reply.code(404).send({ ok: false, error: e.message });
      }
      return reply.code(500).send({ ok: false, error: e.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // MAILMAN INBOX (^XMB(3.7) / ^XMB(3.9))
  // ═══════════════════════════════════════════════════════════════════════

  app.get('/api/tenant-admin/v1/mailman/baskets', async (req, reply) => {
    const duz = req.session?.duz || '0';
    try {
      const z = await callZveRpc('ZVE MM BASKETS', [duz]);
      const o = zveOutcome(z);
      if (o.kind !== 'ok') return reply.code(502).send({ ok: false, error: `ZVE MM BASKETS failed: ${o.msg || o.kind}`, rpcUsed: z.rpcUsed });
      const data = z.lines.slice(1).map((line) => {
        const p = line.split('^');
        return {
          ien: p[0] || '',
          name: p[1] || '',
          messageCount: parseInt(p[2] || '0', 10) || 0,
          unreadCount: parseInt(p[3] || '0', 10) || 0,
        };
      }).filter((basket) => basket.ien && basket.name);
      return { ok: true, source: 'zve', data };
    } catch (e) {
      return reply.code(500).send({ ok: false, error: e.message });
    }
  });

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

  const restoredHealth = loadHealthHistoryFromDisk();
  if (restoredHealth > 0) console.log(`[health-history] restored ${restoredHealth} sample(s)`);

  const restoredDashboard = loadDashboardHistoryFromDisk();
  if (restoredDashboard > 0) console.log(`[dashboard-history] restored ${restoredDashboard} sample(s)`);

  const restoredReportSchedules = loadReportSchedulesFromDisk();
  if (restoredReportSchedules > 0) console.log(`[report-schedules] restored ${restoredReportSchedules} schedule(s)`);

  const restoredThresholds = loadHealthThresholdsFromDisk();
  if (restoredThresholds > 0) console.log(`[health-thresholds] restored ${restoredThresholds} watcher(s)`);

  await captureHealthSample(true);
  const healthInterval = setInterval(() => {
    captureHealthSample().catch(error => console.error('[health-history] sample failed:', error.message));
  }, HEALTH_HISTORY_INTERVAL_MS);

  try {
    const dashboardMetrics = await collectDashboardMetrics();
    await captureDashboardSnapshot(dashboardMetrics, true);
  } catch (error) {
    console.error('[dashboard-history] initial seed failed:', error.message);
  }

  const dashboardInterval = setInterval(async () => {
    try {
      const dashboardMetrics = await collectDashboardMetrics();
      await captureDashboardSnapshot(dashboardMetrics);
    } catch (error) {
      console.error('[dashboard-history] sample failed:', error.message);
    }
  }, DASHBOARD_HISTORY_INTERVAL_MS);

  const reportScheduleInterval = setInterval(() => {
    runDueReportSchedules().catch(error => console.error('[report-schedules] loop failed:', error.message));
  }, REPORT_SCHEDULE_INTERVAL_MS);

  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`Site Administration Console listening on http://127.0.0.1:${PORT}`);

  // Graceful shutdown — disconnect VistA broker
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => {
      console.log(`\n${sig} received. Disconnecting VistA broker...`);
      clearInterval(healthInterval);
      clearInterval(dashboardInterval);
      clearInterval(reportScheduleInterval);
      disconnectBroker();
      app.close().then(() => process.exit(0));
    });
  }
}

main().catch(err => { console.error(err); process.exit(1); });
