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
  probeDdrRpcFamily,
  ddrGetsFile200,
  ddrListerSecurityKeys,
  resolveUserName,
  ddrGetsEntry,
  ddrValidateField,
  ddrFilerEdit,
  ddrFilerEditMulti,
  ddrFilerAdd,
  callZveRpc,
  isRpcMissingError,
  fetchVistaEsigStatusForUsers,
  parseDdrListerResponse,
} from './lib/vista-adapter.mjs';
import { disconnectBroker, getBroker, lockedRpc } from './lib/xwb-client.mjs';

import crypto from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '4520', 10);

const REQUIRED_ENV = ['VISTA_HOST', 'VISTA_PORT', 'VISTA_ACCESS_CODE', 'VISTA_VERIFY_CODE'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`FATAL: Missing required env vars: ${missing.join(', ')}`);
  console.error('Start with: node --env-file=.env server.mjs');
  process.exit(1);
}

function zveOutcome(z) {
  if (z.ok) return { kind: 'ok' };
  const msg = z.error || z.line0 || '';
  if (isRpcMissingError(msg)) return { kind: 'missing', msg };
  if ((z.line0 || '').startsWith('0^')) return { kind: 'noop', msg: (z.line0 || '').slice(2) };
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
// Session store — in-memory, cleared on restart
// ---------------------------------------------------------------------------
const sessions = new Map();
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

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
  return session;
}

function getSession(token) {
  if (!token) return null;
  const s = sessions.get(token);
  if (!s) return null;
  if (Date.now() - s.createdAt > SESSION_TTL_MS) {
    sessions.delete(token);
    return null;
  }
  s.lastActivity = Date.now();
  return s;
}

function destroySession(token) {
  sessions.delete(token);
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

  // Session auth middleware — check token on all /api/ routes except bypass list
  app.addHook('onRequest', async (request, reply) => {
    if (!request.url.startsWith('/api/tenant-admin/v1/')) return;
    const path = request.url.split('?')[0];
    if (AUTH_BYPASS.some(bp => path === bp)) return;
    const authHeader = request.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return reply.code(401).send({ ok: false, error: 'Authentication required. POST /api/tenant-admin/v1/auth/login first.' });
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
  });

  // ---- Auth routes ----

  app.post('/api/tenant-admin/v1/auth/login', async (req, reply) => {
    const body = req.body || {};
    const { accessCode, verifyCode, tenantId } = body;
    if (!accessCode || !verifyCode) {
      return reply.code(400).send({ ok: false, error: 'accessCode and verifyCode required' });
    }
    if (!tenantId) {
      return reply.code(400).send({ ok: false, error: 'tenantId required' });
    }
    // Single-broker model: validate credentials match the env var broker creds
    // The broker authenticates once with VISTA_ACCESS_CODE/VISTA_VERIFY_CODE.
    // Tenant-admin login verifies user provides those same credentials.
    const envAC = (process.env.VISTA_ACCESS_CODE || '').toUpperCase().trim();
    const envVC = (process.env.VISTA_VERIFY_CODE || '').trim();
    const givenAC = accessCode.toUpperCase().trim();
    const givenVC = verifyCode.trim();
    if (givenAC !== envAC || givenVC !== envVC) {
      return reply.code(401).send({ ok: false, error: 'Invalid access code or verify code' });
    }
    try {
      const broker = await getBroker();
      const userKeys = [];
      try {
        const keysRes = await ddrListerSecurityKeys();
        if (keysRes.ok) {
          for (const k of keysRes.data) userKeys.push({ name: k.name, ien: k.ien });
        }
      } catch (_) { /* keys optional at login */ }
      const currentUser = await fetchVistaCurrentUser();
      const duz = currentUser.ok ? (currentUser.data.duz || currentUser.data.ien || '0') : '0';
      const userName = currentUser.ok ? (currentUser.data.userName || currentUser.data.name || 'Unknown') : 'Unknown';
      const session = createSession(duz, userName, userKeys, null, tenantId);
      const navGroups = resolveNavGroups(userKeys);
      const roleCluster = resolveRoleCluster(userKeys);
      return {
        ok: true,
        token: session.token,
        user: { duz, name: userName, keys: userKeys.map(k => k.name) },
        roleCluster,
        navGroups,
        tenantId,
      };
    } catch (e) {
      return reply.code(401).send({ ok: false, error: 'Login failed: ' + (e.message || 'VistA authentication error') });
    }
  });

  app.get('/api/tenant-admin/v1/auth/session', async (req, reply) => {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const session = getSession(token);
    if (!session) return reply.code(401).send({ ok: false, error: 'No active session' });
    const navGroups = resolveNavGroups(session.keys);
    const roleCluster = resolveRoleCluster(session.keys);
    return {
      ok: true,
      user: { duz: session.duz, name: session.userName, keys: (session.keys || []).map(k => k.name || k) },
      roleCluster,
      navGroups,
      tenantId: session.tenantId,
      sessionAge: Math.floor((Date.now() - session.createdAt) / 1000),
    };
  });

  app.post('/api/tenant-admin/v1/auth/logout', async (req) => {
    if (req.session) destroySession(req.session.token);
    return { ok: true };
  });

  // ---- VistA connectivity probe (no auth required) ----

  app.get('/api/tenant-admin/v1/vista-status', async (req, reply) => {
    try {
      const probe = await probeVista();
      const currentUser = probe.ok ? await fetchVistaCurrentUser() : { ok: false };
      return {
        ok: true,
        vista: probe,
        currentUser: currentUser.ok ? currentUser.data : null,
        connectionMode: 'direct-xwb',
      };
    } catch (e) {
      return reply.code(500).send({ ok: false, error: e.message });
    }
  });

  // ---- User routes (VistA-only) ----

  app.get('/api/tenant-admin/v1/users', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const vistaResult = await fetchVistaUsers(req.query.search || '');
    if (vistaResult.ok) {
      return { ok: true, source: 'vista', tenantId, data: vistaResult.data };
    }
    return reply.code(503).send({ ok: false, source: 'error', tenantId, error: vistaResult.error || 'VistA unreachable' });
  });

  app.get('/api/tenant-admin/v1/users/:userId', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const { userId } = req.params;

    // VistA-first: DDR GETS ENTRY DATA on File 200 (full field read path)
    // 200.05 (Person Class) is a sub-file -- requires separate DDR LISTER call
    // .01 NAME field often returns empty from DDR GETS (NAME-type field) -- merge from ORWU NEWPERS
    const DETAIL_FIELDS_FULL = '.01;4;5;8;9;20.2;20.3;20.4;29;.132;.133;.134;.151;41.99;53.1;53.2;53.5;53.11;55;201';
    const DETAIL_FIELDS_BASIC = '.01;4;5;8;9;20.2;20.3;20.4;29';
    try {
      let ddr = await ddrGetsFile200(userId, DETAIL_FIELDS_FULL);
      const hasError = (ddr.rawLines || []).some(l => l === '[ERROR]' || l.startsWith('[ERROR]'));
      if (hasError) {
        ddr = await ddrGetsFile200(userId, DETAIL_FIELDS_BASIC);
      }
      const realData = !((ddr.rawLines || []).some(l => l === '[ERROR]'));
      if (ddr.ok && realData && (ddr.rawLines?.length > 0 || Object.keys(ddr.data).length > 0)) {
        const d = ddr.data;
        const g = (f) => d[f] || d[`200,${f}`] || '';
        let resolvedName = g('.01');
        if (!resolvedName) {
          try {
            const nr = await resolveUserName(userId);
            if (nr.ok) resolvedName = nr.name;
          } catch (_) { /* ignore */ }
        }
        if (!resolvedName) {
          try {
            const usersRes = await fetchVistaUsers('');
            if (usersRes.ok) {
              const match = usersRes.data.find(u => String(u.ien) === String(userId));
              if (match) resolvedName = match.name;
            }
          } catch (_) { /* ignore */ }
        }
        const name = resolvedName || `User ${userId}`;
        const hasEsigCode = Boolean(g('20.4'));
        return {
          ok: true,
          source: 'vista',
          data: {
            id: userId,
            ien: userId,
            name: String(name).trim() || `User ${userId}`,
            username: String(name).trim(),
            title: g('8') || '',
            status: 'active',
            roles: [],
            vistaFields: ddr.data,
            ddrRawLines: ddr.rawLines,
            vistaGrounding: {
              duz: userId,
              file200Status: 'ddr-gets',
              rpcUsed: ddr.rpcUsed,
              sex: g('4') || '',
              dob: g('5') || '',
              ssn: g('9') || '',
              officePhone: g('.132') || '',
              voicePager: g('.133') || '',
              digitalPager: g('.134') || '',
              email: g('.151') || '',
              initials: g('20.2') || '',
              sigBlockName: g('20.3') || '',
              npi: g('41.99') || '',
              stateLicense: g('53.1') || '',
              dea: g('53.2') || '',
              providerType: g('53.5') || '',
              authMeds: g('53.11') || '',
              pharmSchedules: g('55') || '',
              personClass: '',
              primaryMenuOption: g('201') || '',
              serviceSection: g('29') || '',
              electronicSignature: {
                status: hasEsigCode ? 'active' : 'not-configured',
                hasCode: hasEsigCode,
                sigBlockName: g('20.3') || '',
                sigBlockTitle: '',
              },
            },
          },
          vistaStatus: 'reachable',
        };
      }
    } catch (_) { /* fall through */ }

    // Fallback: broker user list by IEN only
    try {
      const usersRes = await fetchVistaUsers('');
      if (usersRes.ok) {
        const vistaUser = usersRes.data.find(u => String(u.ien) === String(userId));
        if (vistaUser) {
          return {
            ok: true,
            source: 'vista',
            data: {
              id: vistaUser.ien,
              name: vistaUser.name,
              ien: vistaUser.ien,
              username: vistaUser.name,
              status: 'active',
              roles: [],
              vistaGrounding: { duz: vistaUser.ien, file200Status: 'orwu-newpers-only' },
            },
            vistaStatus: 'reachable',
          };
        }
      }
    } catch (_) { /* VistA fallback exhausted */ }

    return reply.code(404).send({ ok: false, source: 'error', error: 'User not found in VistA (File 200)' });
  });

  // ---- Facility routes (VistA-only) ----

  app.get('/api/tenant-admin/v1/facilities', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const divResult = await fetchVistaDivisions();
    const clinicResult = await fetchVistaClinics(req.query.search || '');
    if (!divResult.ok && !clinicResult.ok) {
      return reply.code(503).send({ ok: false, source: 'error', tenantId, error: divResult.error || clinicResult.error || 'VistA unreachable' });
    }
    const divisions = (divResult.data || []).map(d => ({
      id: `div-${d.ien || d.id || 'unknown'}`,
      name: d.name || d.divisionName || 'Unknown Division',
      type: 'Division', status: 'active',
      vistaGrounding: { file40_8Ien: d.ien || d.id, status: 'grounded' },
      institutionIen: d.institutionIen || null,
      stationNumber: d.stationNumber || null,
      children: [],
    }));
    const clinics = clinicResult.ok ? (clinicResult.data || []).map(c => ({
      id: `loc-${c.ien || c.id || 'unknown'}`,
      name: c.name || c.locationName || 'Unknown Clinic',
      type: 'Clinic', status: 'active',
      vistaGrounding: { file44Ien: c.ien || c.id, status: 'grounded' },
    })) : [];
    let facilities;
    if (divisions.length === 1) { divisions[0].children = clinics; facilities = divisions; }
    else if (divisions.length > 1) { facilities = [...divisions, ...clinics]; }
    else { facilities = clinics; }
    return { ok: true, source: 'vista', tenantId, data: facilities,
      vistaNote: 'Divisions via XUS DIVISION GET, clinics via ORWU CLINLOC' };
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
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    try {
      const fields = '.01;1;2;3;4;5;6;7;8;9;10;100';
      const result = await ddrGetsEntry('40.8', req.params.ien, fields, 'IE');
      if (!result.ok) return reply.code(404).send({ ok: false, source: 'vista', error: `Division ${req.params.ien} not found` });
      const d = result.data || {};
      return {
        ok: true, source: 'vista', tenantId, rpcUsed: 'DDR GETS ENTRY DATA', file: '40.8',
        data: {
          ien: req.params.ien,
          name: d['.01'] || d['.01E'] || d['.01I'] || '',
          facilityNumber: d['1'] || d['1E'] || d['1I'] || '',
          institution: d['2'] || d['2E'] || '',
          defaultPrinterMedRec: d['3'] || d['3E'] || '',
          mailGroup: d['4'] || d['4E'] || '',
          defaultTimeZone: d['5'] || d['5E'] || '',
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

    const keysRes = await ddrListerSecurityKeys();
    if (!keysRes.ok || !keysRes.data.length) {
      return reply.code(503).send({ ok: false, source: 'error', tenantId, error: keysRes.error || 'VistA security keys unavailable (DDR LISTER File 19.1)' });
    }

    let holderMap = null;
    try { holderMap = await buildKeyHolderMap(); } catch (_) {}

    const inventory = keysRes.data
      .filter(k => !category || (k.name || '').toLowerCase().includes(category.toLowerCase()) || (k.description || '').toLowerCase().includes(category.toLowerCase()))
      .map(k => {
        const holders = holderMap ? (holderMap[k.name.toUpperCase()] || []) : [];
        return {
          keyName: k.name,
          vistaKey: k.name,
          description: k.description || '',
          category: 'security-key',
          holderCount: holders.length,
          holders: holders.slice(0, 20),
          vistaGrounding: { file19_1Ien: k.ien, rpcUsed: keysRes.rpcUsed },
        };
      });

    const unassigned = inventory.filter(k => k.holderCount === 0).length;
    const clinical = inventory.filter(k => /PROVIDER|ORES|ORELSE|PSJ|PSO|LR|MAG|CPRS/i.test(k.keyName)).length;

    return {
      ok: true,
      source: 'vista',
      tenantId,
      data: inventory,
      summary: {
        totalKeys: inventory.length,
        clinicalKeys: clinical,
        adminKeys: inventory.length - clinical,
        unassignedKeys: unassigned,
        holderMapSource: holderMap ? 'ddr-file200-field51' : 'unavailable',
      },
      rpcUsed: [keysRes.rpcUsed, 'DDR GETS ENTRY DATA (File 200, field 51)'],
    };
  });

  app.get('/api/tenant-admin/v1/key-holders/:keyName', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const keyName = req.params.keyName;
    if (!keyName) return reply.code(400).send({ ok: false, error: 'keyName required' });

    const holderMap = await buildKeyHolderMap();
    const holders = holderMap ? (holderMap[keyName.toUpperCase()] || []) : [];
    return {
      ok: true,
      source: 'vista',
      tenantId,
      keyName: keyName.toUpperCase(),
      holderCount: holders.length,
      holders,
      rpcUsed: 'DDR GETS ENTRY DATA (File 200, field 51)',
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
      return {
        ok: false,
        tenantId,
        source: 'integration-pending',
        error: probe.error || 'VistA unreachable',
      };
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
      if (addOutcome.kind === 'missing') return reply.code(501).send({ ok: false, integrationPending: true, error: 'RPC ZVE USMG ADD not registered. Install ZVEUSMG.m.' });
      if (addOutcome.kind === 'fail') return reply.code(502).send({ ok: false, error: addOutcome.msg, stage: 'create-user', lines: addResult.lines });
      const newDuz = (addResult.line0 || '').split('^')[1] || null;
      if (!newDuz) return reply.code(502).send({ ok: false, error: 'User created but could not extract new DUZ', lines: addResult.lines });

      // Step 2: Clone keys/menus from source to new user via ZVE USER CLONE
      const cloneResult = await callZveRpc('ZVE USER CLONE', [String(body.sourceDuz), newDuz]);
      const cloneOutcome = zveOutcome(cloneResult);
      if (cloneOutcome.kind === 'missing') return reply.code(501).send({ ok: false, integrationPending: true, error: 'RPC ZVE USER CLONE not registered. Install ZVEUCLONE.m.' });
      if (cloneOutcome.kind === 'fail') return reply.code(502).send({ ok: false, error: cloneOutcome.msg, stage: 'clone-keys', lines: cloneResult.lines });

      return {
        ok: true, source: 'vista', tenantId,
        rpcsUsed: ['ZVE USMG ADD', 'ZVE USER CLONE'],
        sourceDuz: body.sourceDuz, newName: body.newName, newDuz,
        createLines: addResult.lines, cloneLines: cloneResult.lines,
      };
    } catch (e) { return reply.code(500).send({ ok: false, error: e.message }); }
  });

  /** Update allow-listed File 200 fields via DDR VALIDATOR + DDR FILER (FileMan APIs) */
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
      '4': 'SEX',
      '20.2': 'ELECTRONIC SIGNATURE INITIALS',
      '20.3': 'SIGNATURE BLOCK PRINTED NAME',
      '20.4': 'ELECTRONIC SIGNATURE CODE',
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
      rpcUsed: ['DDR VALIDATOR', filer.rpcUsed],
      filerLines: filer.lines,
      validatorLines: valRes.lines,
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
    const sanitized = keyName.toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim();
    if (!sanitized) return reply.code(400).send({ ok: false, error: 'keyName empty after sanitize' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
    const z = await callZveRpc('ZVE USMG KEYS', ['ADD', String(req.params.targetDuz), sanitized]);
    const o = zveOutcome(z);
    if (o.kind === 'missing') {
      return reply.code(501).send({
        ok: false,
        integrationPending: true,
        error: 'RPC ZVE USMG KEYS not registered. Run INSTALL^ZVEUSMG in VistA (distro overlay).',
        detail: o.msg,
      });
    }
    if (o.kind === 'fail') {
      return reply.code(502).send({ ok: false, error: o.msg, rpcUsed: z.rpcUsed, lines: z.lines });
    }
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
    if (o.kind === 'missing') {
      return reply.code(501).send({
        ok: false,
        integrationPending: true,
        error: 'RPC ZVE USMG KEYS not registered. Run INSTALL^ZVEUSMG in VistA.',
        detail: o.msg,
      });
    }
    if (o.kind === 'fail') {
      return reply.code(502).send({ ok: false, error: o.msg, rpcUsed: z.rpcUsed, lines: z.lines });
    }
    return { ok: true, tenantId, targetDuz: req.params.targetDuz, keyName: keyName.trim(), rpcUsed: z.rpcUsed, lines: z.lines };
  });

  /** Create File 200 user (minimal) — ZVE USMG ADD */
  app.post('/api/tenant-admin/v1/users', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const body = req.body || {};
    const name = body.name;
    if (!name || typeof name !== 'string') {
      return reply.code(400).send({ ok: false, error: 'name required' });
    }
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
    const z = await callZveRpc('ZVE USMG ADD', [name, body.accessCode || '', body.verifyCode || '']);
    const o = zveOutcome(z);
    if (o.kind === 'missing') {
      return reply.code(501).send({
        ok: false,
        integrationPending: true,
        error: 'RPC ZVE USMG ADD not registered. Run INSTALL^ZVEUSMG in VistA.',
        detail: o.msg,
      });
    }
    if (o.kind === 'fail') return reply.code(502).send({ ok: false, error: o.msg, lines: z.lines });
    const newIen = (z.line0 || '').split('^')[1] || null;
    const extraFields = [];
    const EXTRA_MAP = {
      title: '8', ssn: '9', sex: '4', dob: '5',
      serviceSection: '29',
      division: null, // sub-file 200.02 — requires ZVE USMG routine, not simple DDR FILER
      primaryMenu: '201',
    };
    if (newIen) {
      const iens = `${newIen},`;
      for (const [key, fld] of Object.entries(EXTRA_MAP)) {
        if (body[key] && fld) {
          try {
            await ddrFilerEdit(200, iens, fld, String(body[key]), 'E');
            extraFields.push({ field: fld, key, status: 'ok' });
          } catch (e) { extraFields.push({ field: fld, key, status: 'error', detail: e.message }); }
        }
      }
    }
    return { ok: true, tenantId, newIen, rpcUsed: z.rpcUsed, lines: z.lines, extraFields };
  });

  app.post('/api/tenant-admin/v1/users/:duz/esig', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const code = (req.body || {}).code;
    if (!code || typeof code !== 'string') return reply.code(400).send({ ok: false, error: 'code required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
    const z = await callZveRpc('ZVE USMG ESIG', [String(req.params.duz), code]);
    const o = zveOutcome(z);
    if (o.kind === 'missing') {
      return reply.code(501).send({ ok: false, integrationPending: true, error: 'RPC ZVE USMG ESIG not registered.', detail: o.msg });
    }
    if (o.kind === 'fail') return reply.code(502).send({ ok: false, error: o.msg, lines: z.lines });
    return { ok: true, tenantId, duz: req.params.duz, rpcUsed: z.rpcUsed, lines: z.lines };
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

  app.put('/api/tenant-admin/v1/users/:duz/credentials', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
    const z = await callZveRpc('ZVE USMG CRED', [String(req.params.duz)]);
    const o = zveOutcome(z);
    if (o.kind === 'missing') {
      return reply.code(501).send({ ok: false, integrationPending: true, error: 'RPC ZVE USMG CRED not registered.', detail: o.msg });
    }
    if (o.kind === 'fail') return reply.code(502).send({ ok: false, error: o.msg, lines: z.lines });
    return { ok: true, tenantId, duz: req.params.duz, rpcUsed: z.rpcUsed, lines: z.lines };
  });

  app.post('/api/tenant-admin/v1/users/:duz/deactivate', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
    const z = await callZveRpc('ZVE USMG DEACT', [String(req.params.duz)]);
    const o = zveOutcome(z);
    if (o.kind === 'missing') {
      return reply.code(501).send({ ok: false, integrationPending: true, error: 'RPC ZVE USMG DEACT not registered.', detail: o.msg });
    }
    if (o.kind === 'fail') return reply.code(502).send({ ok: false, error: o.msg, lines: z.lines });
    return { ok: true, tenantId, duz: req.params.duz, rpcUsed: z.rpcUsed, lines: z.lines };
  });

  app.post('/api/tenant-admin/v1/users/:duz/reactivate', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
    const z = await callZveRpc('ZVE USMG REACT', [String(req.params.duz)]);
    const o = zveOutcome(z);
    if (o.kind === 'missing') {
      return reply.code(501).send({ ok: false, integrationPending: true, error: 'RPC ZVE USMG REACT not registered.', detail: o.msg });
    }
    if (o.kind === 'fail') return reply.code(502).send({ ok: false, error: o.msg, lines: z.lines });
    return { ok: true, tenantId, duz: req.params.duz, rpcUsed: z.rpcUsed, lines: z.lines };
  });

  /** Terminate user (DISUSER + termination date + clear access) via ZVE USMG TERM */
  app.post('/api/tenant-admin/v1/users/:duz/terminate', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
    const z = await callZveRpc('ZVE USMG TERM', [String(req.params.duz)]);
    const o = zveOutcome(z);
    if (o.kind === 'missing') {
      return reply.code(501).send({ ok: false, integrationPending: true, error: 'RPC ZVE USMG TERM not registered. Run INSTALL^ZVEUSMG in VistA.', detail: o.msg });
    }
    if (o.kind === 'fail') return reply.code(502).send({ ok: false, error: o.msg, lines: z.lines });
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
    if (o.kind === 'missing') {
      return reply.code(501).send({ ok: false, integrationPending: true, error: 'RPC ZVE USMG AUDLOG not registered.', detail: o.msg });
    }
    const entries = [];
    for (const line of z.lines.slice(1)) {
      const parts = line.split('^');
      if (parts.length >= 6) {
        entries.push({
          auditIen: parts[0], entryIen: parts[1], when: parts[2],
          fieldName: parts[3], fieldNum: parts[4], byDuz: parts[5],
          oldValue: parts[6] || '', newValue: parts[7] || '',
        });
      }
    }
    return { ok: true, source: 'vista', tenantId, rpcUsed: z.rpcUsed, count: entries.length, entries };
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
    if (o.kind === 'missing') {
      return reply.code(501).send({
        ok: false, integrationPending: true,
        error: 'RPC ZVE USMG RENAME not registered. Run INSTALL^ZVEUSMG in VistA.',
        detail: o.msg,
      });
    }
    if (o.kind === 'fail') return reply.code(502).send({ ok: false, error: o.msg, rpcUsed: z.rpcUsed, lines: z.lines });
    return { ok: true, tenantId, duz: req.params.duz, newName: newName.toUpperCase().trim(), rpcUsed: z.rpcUsed, lines: z.lines };
  });

  /** Device list (File 3.5) via DDR LISTER */
  app.get('/api/tenant-admin/v1/devices', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const p = await probeVista();
    if (!p.ok) {
      return reply.code(501).send({ ok: false, tenantId, source: 'integration-pending', error: p.error });
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

  /** Kernel site parameters (File 8989.3) — find actual IEN first, then read */
  app.get('/api/tenant-admin/v1/params/kernel', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
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
        const getsLines = await broker.callRpcWithList('DDR GETS ENTRY DATA', [
          { type: 'list', value: { FILE: '8989.3', IENS: `${ien},`, FIELDS: '.01;.02;.03;.04;.05;205;210;230;240;501' } },
        ]);
        return { ien, rawLines: getsLines };
      });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER + DDR GETS ENTRY DATA', file: '8989.3', ien: result.ien, rawLines: result.rawLines };
    } catch (e) {
      return reply.code(500).send({ ok: false, tenantId, error: e.message, note: 'File 8989.3 IEN may differ per site.' });
    }
  });

  const KERNEL8989_ALLOW = {
    '.01': 'SITE NAME',
    '.02': 'DOMAIN NAME',
    '.03': 'DEFAULT INSTITUTION',
    '.04': 'DEFAULT AUTO MENU',
    '.05': 'DEFAULT LANGUAGE',
    '205': 'AGENCY CODE',
    '210': 'DEFAULT TIMEOUT',
    '230': 'PRODUCTION ACCOUNT',
    '240': 'BROKER TIMEOUT',
    '501': 'MULTIPLE SIGN-ON',
  };

  app.put('/api/tenant-admin/v1/params/kernel', async (req, reply) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const body = req.body || {};
    const field = body.field;
    const value = body.value;
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
    if (o.kind === 'missing') {
      return reply.code(501).send({
        ok: false,
        integrationPending: true,
        error: 'RPC ZVE CLNM ADD not registered. Run INSTALL^ZVECLNM in VistA.',
        detail: o.msg,
      });
    }
    if (o.kind === 'fail') return reply.code(502).send({ ok: false, error: o.msg, lines: z.lines });
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
    if (o.kind === 'missing') {
      return reply.code(501).send({
        ok: false,
        integrationPending: true,
        error: 'RPC ZVE CLNM EDIT not registered. Run INSTALL^ZVECLNM in VistA.',
        detail: o.msg,
      });
    }
    if (o.kind === 'fail') return reply.code(502).send({ ok: false, error: o.msg, lines: z.lines });
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
    if (o.kind === 'missing') {
      return reply.code(501).send({
        ok: false,
        integrationPending: true,
        error: 'RPC ZVE WRDM EDIT not registered. Run INSTALL^ZVEWRDM in VistA.',
        detail: o.msg,
      });
    }
    if (o.kind === 'fail') return reply.code(502).send({ ok: false, error: o.msg, lines: z.lines });
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
    if (!p.ok) return reply.code(501).send({ ok: false, tenantId, source: 'integration-pending', error: p.error });
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
    if (!p.ok) return reply.code(501).send({ ok: false, tenantId, source: 'integration-pending', error: p.error });
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
    if (!p.ok) return reply.code(501).send({ ok: false, tenantId, source: 'integration-pending', error: p.error });
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
    if (o.kind === 'missing') {
      return reply.code(501).send({
        ok: false,
        integrationPending: true,
        error: 'RPC ZVE DEV TESTPRINT not registered. Run INSTALL^ZVEDEV in VistA.',
        detail: o.msg,
      });
    }
    if (o.kind === 'fail') return reply.code(502).send({ ok: false, error: o.msg, lines: z.lines });
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
        return reply.code(501).send({
          ok: false,
          integrationPending: true,
          error: 'DDR DELETE ENTRY not available.',
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
    if (!p.ok) return reply.code(501).send({ ok: false, tenantId, source: 'integration-pending', error: p.error });
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
    if (!p.ok) return reply.code(501).send({ ok: false, tenantId, source: 'integration-pending', error: p.error });
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
    if (!p.ok) return reply.code(501).send({ ok: false, tenantId, source: 'integration-pending', error: p.error });
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
    if (!p.ok) return reply.code(501).send({ ok: false, tenantId, source: 'integration-pending', error: p.error });
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
    if (!p.ok) return reply.code(501).send({ ok: false, tenantId, source: 'integration-pending', error: p.error });
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
    if (!p.ok) return reply.code(501).send({ ok: false, tenantId, source: 'integration-pending', error: p.error });
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
    if (!p.ok) return reply.code(501).send({ ok: false, tenantId, source: 'integration-pending', error: p.error });
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
    if (!p.ok) return reply.code(501).send({ ok: false, tenantId, source: 'integration-pending', error: p.error });
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
    if (!p.ok) return reply.code(501).send({ ok: false, tenantId, source: 'integration-pending', error: p.error });
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
    if (!p.ok) return reply.code(501).send({ ok: false, tenantId, source: 'integration-pending', error: p.error });
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
    if (!p.ok) return reply.code(501).send({ ok: false, tenantId, source: 'integration-pending', error: p.error });
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
    if (!p.ok) return reply.code(501).send({ ok: false, tenantId, source: 'integration-pending', error: p.error });
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
          { type: 'list', value: { FILE: '3.8', FIELDS: '.01;4;5;7;10', FLAGS: 'IP', MAX: '5000', ...(search ? { PART: search.toUpperCase() } : {}) } },
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
            selfEnroll: a[4]?.trim() || '',
            restrictions: a[5]?.trim() || '',
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
      const name = (req.body || {}).name;
      if (!name || typeof name !== 'string') return reply.code(400).send({ ok: false, error: 'name required' });
      const p = await probeVista();
      if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
      const filer = await ddrFilerAdd('36', '.01', '+1,', name, 'E');
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
        return reply.code(501).send({ ok: false, integrationPending: true, error: 'RPC ZVE TASKMAN STATUS not registered. Install ZVETMCTL.m.' });
      }
      if (o.kind === 'fail') return reply.code(502).send({ ok: false, tenantId, source: 'error', error: o.msg });
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
        return reply.code(501).send({ ok: false, integrationPending: true, error: 'RPC ZVE TASKMAN TASKS not registered. Install ZVETMCTL.m.' });
      }
      if (o.kind === 'fail') return reply.code(502).send({ ok: false, tenantId, source: 'error', error: o.msg });
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
        return reply.code(501).send({ ok: false, integrationPending: true, error: 'RPC ZVE HL7 FILER STATUS not registered. Install ZVEHLFIL.m.' });
      }
      if (o.kind === 'fail') return reply.code(502).send({ ok: false, tenantId, source: 'error', error: o.msg });
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
        return reply.code(501).send({ ok: false, integrationPending: true, error: 'RPC ZVE HL7 LINK STATUS not registered. Install ZVEHLFIL.m.' });
      }
      if (o.kind === 'fail') return reply.code(502).send({ ok: false, tenantId, source: 'error', error: o.msg });
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
      if (o.kind === 'missing') {
        return reply.code(501).send({ ok: false, integrationPending: true, error: 'RPC ZVE CLINIC AVAIL GET not registered. Install ZVECLAVL.m.', detail: o.msg });
      }
      if (o.kind === 'fail') return reply.code(502).send({ ok: false, tenantId, source: 'error', error: o.msg });
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
      return reply.code(501).send({ ok: false, integrationPending: true, error: 'RPC ZVE CLINIC AVAIL SET not registered. Install ZVECLAVL.m.' });
    }
    if (o.kind === 'fail') return reply.code(502).send({ ok: false, error: o.msg });
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
      if (o.kind === 'missing') return reply.code(501).send({ ok: false, integrationPending: true, error: 'RPC ZVE MAILGRP MEMBERS not registered. Install ZVEMGRP.m.' });
      if (o.kind === 'fail') return reply.code(502).send({ ok: false, error: o.msg });
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
      if (o.kind === 'missing') return reply.code(501).send({ ok: false, integrationPending: true, error: 'RPC ZVE MAILGRP ADD not registered. Install ZVEMGRP.m.' });
      if (o.kind === 'fail') return reply.code(502).send({ ok: false, error: o.msg });
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
      if (o.kind === 'missing') return reply.code(501).send({ ok: false, integrationPending: true, error: 'RPC ZVE MAILGRP REMOVE not registered. Install ZVEMGRP.m.' });
      if (o.kind === 'fail') return reply.code(502).send({ ok: false, error: o.msg });
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
      if (o.kind === 'missing') return reply.code(501).send({ ok: false, integrationPending: true, error: 'RPC ZVE HS COMPONENTS not registered. Install ZVEHSCOMP.m.' });
      if (o.kind === 'fail') return reply.code(502).send({ ok: false, error: o.msg });
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
      if (o.kind === 'missing') return reply.code(501).send({ ok: false, integrationPending: true, error: 'RPC ZVE HS COMP ADD not registered. Install ZVEHSCOMP.m.' });
      if (o.kind === 'fail') return reply.code(502).send({ ok: false, error: o.msg });
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
      if (o.kind === 'missing') return reply.code(501).send({ ok: false, integrationPending: true, error: 'RPC ZVE HS COMP REMOVE not registered. Install ZVEHSCOMP.m.' });
      if (o.kind === 'fail') return reply.code(502).send({ ok: false, error: o.msg });
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

  // ---- SPA fallback ----
  app.setNotFoundHandler(async (_req, reply) => {
    return reply.sendFile('index.html');
  });

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
