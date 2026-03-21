/**
 * Tenant Admin — VistA-First Operational Shell
 *
 * Fastify dev server serving the tenant-admin SPA.
 *
 *   1. Serves static assets (HTML/CSS/JS) from public/
 *   2. Exposes VistA-first API routes with fixture fallback for degraded mode
 *
 * Tenant-scoped: every request requires tenantId context.
 * VistA grounding: direct XWB RPC broker connection via lib/xwb-client.mjs.
 * Env vars: VISTA_HOST, VISTA_PORT, VISTA_ACCESS_CODE, VISTA_VERIFY_CODE, VISTA_CONTEXT.
 * Falls back to fixture data with honest source labeling when VistA is unreachable.
 *
 * Port: 4520 (per port-registry.md pattern — control-plane=4500, API=4510, tenant-admin=4520)
 */

import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFile } from 'node:fs/promises';
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
  ddrFilerAdd,
  callZveRpc,
  isRpcMissingError,
  fetchVistaEsigStatusForUsers,
  parseDdrListerResponse,
} from './lib/vista-adapter.mjs';
import { disconnectBroker, getBroker, lockedRpc } from './lib/xwb-client.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '4520', 10);

function zveOutcome(z) {
  if (z.ok) return { kind: 'ok' };
  const msg = z.error || z.line0 || '';
  if (isRpcMissingError(msg)) return { kind: 'missing', msg };
  return { kind: 'fail', msg };
}

// ---------------------------------------------------------------------------
// Load fixtures once at startup
// ---------------------------------------------------------------------------
async function loadFixtures() {
  const fixtureDir = join(__dirname, 'fixtures');
  const files = ['users', 'facilities', 'roles'];
  const fixtures = {};
  for (const f of files) {
    try {
      const raw = await readFile(join(fixtureDir, `${f}.json`), 'utf8');
      fixtures[f] = JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
    } catch {
      fixtures[f] = [];
    }
  }
  return fixtures;
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------
async function main() {
  const fixtures = await loadFixtures();
  const app = Fastify({ logger: false });

  // Static files
  app.register(fastifyStatic, {
    root: join(__dirname, 'public'),
    prefix: '/',
  });

  // ---- VistA connectivity probe ----

  app.get('/api/tenant-admin/v1/vista-status', async () => {
    const probe = await probeVista();
    const currentUser = probe.ok ? await fetchVistaCurrentUser() : { ok: false };
    return {
      ok: true,
      vista: probe,
      currentUser: currentUser.ok ? currentUser.data : null,
      connectionMode: 'direct-xwb',
    };
  });

  // ---- Dual-mode user routes (VistA-first, fixture fallback) ----

  app.get('/api/tenant-admin/v1/users', async (req) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return { ok: false, error: 'tenantId required' };

    // Try VistA adapter first
    const vistaResult = await fetchVistaUsers(req.query.search || '');
    if (vistaResult.ok) {
      return { ok: true, source: 'vista', tenantId, data: vistaResult.data };
    }

    // Fixture fallback with honest labeling
    return {
      ok: true,
      source: 'fixture',
      tenantId,
      data: fixtures.users,
      vistaStatus: vistaResult.error || 'unavailable',
    };
  });

  app.get('/api/tenant-admin/v1/users/:userId', async (req) => {
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
    } catch (_) { /* fixture */ }

    const user = fixtures.users.find(u => u.id === userId);
    if (user) {
      return { ok: true, source: 'fixture', data: user, vistaStatus: 'unavailable' };
    }

    return { ok: false, error: 'user not found' };
  });

  // ---- Dual-mode facility routes (VistA-first, fixture fallback) ----

  app.get('/api/tenant-admin/v1/facilities', async (req) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return { ok: false, error: 'tenantId required' };

    // Try VistA adapter: divisions + clinics → assemble topology
    // Sequential calls — XWB broker has no mutex, concurrent RPCs corrupt responses
    const divResult = await fetchVistaDivisions();
    const clinicResult = await fetchVistaClinics(req.query.search || '');

    if (divResult.ok || clinicResult.ok) {
      // Build topology from VistA data
      const divisions = (divResult.data || []).map(d => ({
        id: `div-${d.ien || d.id || 'unknown'}`,
        name: d.name || d.divisionName || 'Unknown Division',
        type: 'Division',
        status: 'active',
        vistaGrounding: { file40_8Ien: d.ien || d.id, status: 'grounded' },
        institutionIen: d.institutionIen || null,
        stationNumber: d.stationNumber || null,
        children: [],
      }));

      const clinics = clinicResult.ok ? (clinicResult.data || []).map(c => ({
        id: `loc-${c.ien || c.id || 'unknown'}`,
        name: c.name || c.locationName || 'Unknown Clinic',
        type: 'Clinic',
        status: 'active',
        vistaGrounding: { file44Ien: c.ien || c.id, status: 'grounded' },
      })) : [];

      let facilities;
      if (divisions.length === 1) {
        divisions[0].children = clinics;
        facilities = divisions;
      } else if (divisions.length > 1) {
        facilities = [...divisions, ...clinics];
      } else {
        // No divisions returned (single-division sandbox) — return clinics directly
        facilities = clinics;
      }

      return {
        ok: true,
        source: 'vista',
        tenantId,
        data: facilities,
        vistaNote: clinicResult.ok
          ? 'Divisions via XUS DIVISION GET, clinics via ORWU CLINLOC'
          : 'Divisions via XUS DIVISION GET (clinics unavailable)',
      };
    }

    // Fixture fallback with honest labeling
    return {
      ok: true,
      source: 'fixture',
      tenantId,
      data: fixtures.facilities,
      vistaStatus: divResult.error || 'unavailable',
    };
  });

  app.get('/api/tenant-admin/v1/facilities/:facilityId', async (req) => {
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
      } catch (_) { /* VistA unavailable — fall through to fixture */ }
    }

    // Fixture fallback
    function findFacility(items, id) {
      for (const f of items) {
        if (f.id === id) return f;
        if (f.children) {
          const found = findFacility(f.children, id);
          if (found) return found;
        }
      }
      return null;
    }
    const facility = findFacility(fixtures.facilities, facilityId);
    if (!facility) return { ok: false, error: 'facility not found' };

    return {
      ok: true,
      source: 'fixture',
      data: facility,
      vistaStatus: 'unavailable',
    };
  });

  app.get('/api/tenant-admin/v1/roles', async (req) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return { ok: false, error: 'tenantId required' };

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

    const enrichedRoles = fixtures.roles.map(r => ({
      ...r,
      assignedUsers: (r.assignedUsers || []).map(uid => {
        const user = fixtures.users.find(u => u.id === uid);
        return user ? { id: user.id, name: user.name } : { id: uid, name: uid };
      }),
    }));
    return {
      ok: true,
      source: 'fixture',
      sourceStatus: keysRes.error ? 'ddr-unavailable' : 'integration-pending',
      tenantId,
      data: enrichedRoles,
      vistaNote: keysRes.error || null,
      integrationNote:
        'DDR LISTER on File 19.1 is the preferred key catalog. When VistA is unreachable, fixture roles are shown.',
    };
  });

  // ---- Clinic list: extract clinics from facility hierarchy ----

  app.get('/api/tenant-admin/v1/clinics', async (req) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return { ok: false, error: 'tenantId required' };
    const typeFilter = req.query.type || '';

    // Try VistA adapter first
    const vistaResult = await fetchVistaClinics(req.query.search || '');
    if (vistaResult.ok) {
      return { ok: true, source: 'vista', tenantId, data: vistaResult.data };
    }

    // Fixture fallback: extract clinics from facility hierarchy
    function extractClinics(items, parentDivision) {
      let clinics = [];
      for (const f of items) {
        if (f.type === 'Clinic' && (!typeFilter || (f.vistaGrounding || {}).locationType === typeFilter)) {
          const vg = f.vistaGrounding || {};
          clinics.push({
            ...f,
            abbreviation: vg.abbreviation || null,
            stopCode: vg.stopCode || null,
            defaultSlotLength: vg.defaultSlotLength || null,
            file44Ien: vg.file44Ien || null,
            ien: vg.file44Ien || null,
            parentDivision: parentDivision || null,
          });
        }
        if (f.children) {
          const divName = f.type === 'Division' ? f.name : parentDivision;
          clinics = clinics.concat(extractClinics(f.children, divName));
        }
      }
      return clinics;
    }
    const clinics = extractClinics(fixtures.facilities, null);

    return {
      ok: true,
      source: 'fixture',
      tenantId,
      data: clinics,
      summary: {
        totalClinics: clinics.length,
        withStopCode: clinics.filter(c => c.vistaGrounding.stopCode).length,
        avgSlotLength: clinics.length
          ? Math.round(clinics.reduce((s, c) => s + (c.vistaGrounding.defaultSlotLength || 0), 0) / clinics.length)
          : 0,
      },
      vistaGrounding: {
        readRpc: 'ORWU CLINLOC',
        file: 'File 44 (HOSPITAL LOCATION)',
        typeIndex: '^SC("AC","C",IEN)',
        note: 'Type C = Clinic. Division linkage via field 0 piece 4 → File 40.8.',
      },
      vistaStatus: vistaResult.error || 'unavailable',
    };
  });

  // ---- Ward list: extract wards from facility hierarchy ----

  app.get('/api/tenant-admin/v1/wards', async (req) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return { ok: false, error: 'tenantId required' };

    // Try VistA adapter first
    const vistaResult = await fetchVistaWards();
    if (vistaResult.ok) {
      return { ok: true, source: 'vista', tenantId, data: vistaResult.data };
    }

    // Fixture fallback: wards are at institution level
    const wards = [];
    for (const inst of fixtures.facilities) {
      if (inst.wards) {
        for (const w of inst.wards) {
          const vg = w.vistaGrounding || {};
          wards.push({
            ...w,
            parentInstitution: inst.name,
            specialty: vg.specialty ? (typeof vg.specialty === 'object' ? vg.specialty.name : vg.specialty) : null,
            file42Ien: vg.file42Ien || null,
            bedCount: w.beds ? w.beds.length : 0,
            availableBeds: w.beds ? w.beds.filter(b => b.status === 'available').length : 0,
            occupiedBeds: w.beds ? w.beds.filter(b => b.status === 'occupied').length : 0,
          });
        }
      }
    }

    return {
      ok: true,
      source: 'fixture',
      tenantId,
      data: wards,
      summary: {
        totalWards: wards.length,
        totalBeds: wards.reduce((s, w) => s + w.bedCount, 0),
        availableBeds: wards.reduce((s, w) => s + w.availableBeds, 0),
        occupiedBeds: wards.reduce((s, w) => s + w.occupiedBeds, 0),
      },
      vistaGrounding: {
        readRpc: 'ORQPT WARDS',
        file: 'File 42 (WARD LOCATION)',
        file44Type: 'W',
        bedFile: 'File 405.4 (ROOM-BED)',
        note: 'Wards map to File 44 type=W and File 42. Room-beds in File 405.4.',
      },
      vistaStatus: vistaResult.error || 'unavailable',
    };
  });

  // ---- Facility topology: summary hierarchy ----

  app.get('/api/tenant-admin/v1/topology', async (req) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return { ok: false, error: 'tenantId required' };

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
    } catch (_) { /* VistA unavailable — fall through to fixture */ }

    // Fixture fallback
    const topology = fixtures.facilities.map(inst => {
      const divisions = (inst.children || []).filter(c => c.type === 'Division');
      return {
        id: inst.id, name: inst.name, type: inst.type,
        stationNumber: (inst.vistaGrounding || {}).stationNumber || null,
        divisionCount: divisions.length,
        clinicCount: divisions.reduce((s, d) => s + (d.children || []).filter(c => c.type === 'Clinic').length, 0),
        wardCount: (inst.wards || []).length,
        divisions: divisions.map(d => ({
          id: d.id, name: d.name,
          clinicCount: (d.children || []).filter(c => c.type === 'Clinic').length,
        })),
      };
    });

    return {
      ok: true,
      source: 'fixture',
      tenantId,
      data: topology,
      integrationNote: 'VistA broker unavailable — showing fixture topology as fallback.',
      vistaGrounding: {
        hierarchy: 'Institution (File 4) → Division (File 40.8) → Clinic (File 44 type=C) / Ward (File 42 + File 44 type=W)',
        rpcs: ['XUS DIVISION GET', 'ORWU CLINLOC', 'ORQPT WARDS'],
      },
    };
  });

  // ---- Key inventory: cross-reference keys to holders ----

  app.get('/api/tenant-admin/v1/key-inventory', async (req) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return { ok: false, error: 'tenantId required' };
    const category = req.query.category || '';

    const keysRes = await ddrListerSecurityKeys();
    if (keysRes.ok && keysRes.data.length > 0) {
      const inventory = keysRes.data
        .filter(k => !category || (k.description || '').toLowerCase().includes(category.toLowerCase()))
        .map(k => ({
          keyName: k.name,
          vistaKey: k.name,
          description: k.description || '',
          category: 'security-key',
          holderCount: 0,
          holders: [],
          vistaGrounding: { file19_1Ien: k.ien, rpcUsed: keysRes.rpcUsed },
        }));
      return {
        ok: true,
        source: 'vista',
        tenantId,
        data: inventory,
        summary: {
          totalKeys: inventory.length,
          clinicalKeys: 0,
          adminKeys: inventory.length,
          unassignedKeys: inventory.length,
        },
        integrationNote:
          'Holder lists require a follow-on DDR read of File 200 field 51 or ^XUSEC — not yet wired in this slice.',
      };
    }

    const inventory = fixtures.roles
      .filter(r => !category || r.category === category)
      .map(role => {
        const holders = fixtures.users.filter(u => u.roles.includes(role.name));
        return {
          keyName: role.name,
          vistaKey: role.vistaKey,
          description: role.description,
          category: role.category || 'uncategorized',
          holderCount: holders.length,
          holders: holders.map(h => ({
            id: h.id,
            name: h.name,
            duz: h.vistaGrounding.duz,
            status: h.status,
          })),
          vistaGrounding: role.vistaGrounding,
        };
      });

    return {
      ok: true,
      source: 'fixture',
      sourceStatus: keysRes.error ? 'ddr-unavailable' : 'integration-pending',
      tenantId,
      data: inventory,
      vistaNote: keysRes.error || null,
      summary: {
        totalKeys: inventory.length,
        clinicalKeys: inventory.filter(k => k.category === 'clinical').length,
        adminKeys: inventory.filter(k => k.category === 'administrative').length,
        unassignedKeys: inventory.filter(k => k.holderCount === 0).length,
      },
      integrationNote:
        'Prefer DDR LISTER(File 19.1). Fixture shown when DDR is unavailable.',
    };
  });

  // ---- E-signature status summary ----

  app.get('/api/tenant-admin/v1/esig-status', async (req) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return { ok: false, error: 'tenantId required' };

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

    const summary = fixtures.users.map(u => ({
      id: u.id,
      name: u.name,
      duz: u.vistaGrounding.duz,
      status: u.status,
      esigStatus: u.vistaGrounding.electronicSignature
        ? u.vistaGrounding.electronicSignature.status
        : 'unknown',
      hasCode: u.vistaGrounding.electronicSignature
        ? u.vistaGrounding.electronicSignature.hasCode
        : false,
    }));

    return {
      ok: true,
      source: 'fixture',
      sourceStatus: 'integration-pending',
      tenantId,
      data: summary,
      aggregates: {
        total: summary.length,
        active: summary.filter(u => u.esigStatus === 'active').length,
        notConfigured: summary.filter(u => u.esigStatus === 'not-configured').length,
        revoked: summary.filter(u => u.esigStatus === 'revoked').length,
      },
      integrationNote:
        'Live path: ORWU NEWPERS + per-user DDR GETS (20.2-20.4). Fixture shown when VistA/DDR unavailable.',
      vistaGrounding: {
        readRpc: 'DDR GETS ENTRY DATA',
        field: 'File 200 field 20.4 (ELECTRONIC SIGNATURE CODE)',
        note: 'E-sig codes are hashed in VistA and never retrievable. Presence check only.',
      },
    };
  });

  // ---- VistA DDR family probe (no terminal; RPC-only) ----

  app.get('/api/tenant-admin/v1/vista/ddr-probe', async (req) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return { ok: false, error: 'tenantId required' };
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
      return { ok: false, tenantId, source: 'error', error: e.message };
    }
  });

  /** Direct write: update allow-listed File 200 fields via DDR VALIDATOR + DDR FILER */
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
      '.151': 'MAIL CODE',
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
    const body = req.body || {};
    if (!body.accessCode && !body.verifyCode) {
      return reply.code(400).send({ ok: false, error: 'accessCode or verifyCode required' });
    }
    const p = await probeVista();
    if (!p.ok) return reply.code(503).send({ ok: false, error: 'VistA unavailable', detail: p.error });
    const z = await callZveRpc('ZVE USMG CRED', [String(req.params.duz), String(body.accessCode || ''), String(body.verifyCode || '')]);
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

  /** Device list (File 3.5) via DDR LISTER */
  app.get('/api/tenant-admin/v1/devices', async (req) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return { ok: false, error: 'tenantId required' };
    const p = await probeVista();
    if (!p.ok) {
      return { ok: false, tenantId, source: 'integration-pending', error: p.error };
    }
    try {
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '3.5', FIELDS: '.01;1;2;3', FLAGS: 'IP', MAX: '999' } },
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
            name: a[1]?.trim(),
            dollarI: a[2]?.trim(),
            type: a[3]?.trim(),
            subtype: a[4]?.trim(),
          });
        }
        return out;
      });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '3.5', data: rows };
    } catch (e) {
      return { ok: false, tenantId, source: 'error', error: e.message };
    }
  });

  /** Kernel site parameters (File 8989.3) — first entry */
  app.get('/api/tenant-admin/v1/params/kernel', async (req) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return { ok: false, error: 'tenantId required' };
    try {
      const lines = await lockedRpc(async () => {
        const broker = await getBroker();
        return broker.callRpcWithList('DDR GETS ENTRY DATA', [
          { type: 'list', value: { FILE: '8989.3', IENS: '1,', FIELDS: '.01;.02;.03;.04;.05;205;210;230;240;501' } },
        ]);
      });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR GETS ENTRY DATA', file: '8989.3', rawLines: lines };
    } catch (e) {
      return { ok: false, tenantId, error: e.message, note: 'File 8989.3 IEN may differ per site.' };
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
    const iens = '1,';
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
    const valRes = await ddrValidateField(3.5, '+1,', '.01', nm);
    if (!valRes.ok) return reply.code(400).send({ ok: false, stage: 'DDR VALIDATOR', error: valRes.error });
    const filer = await ddrFilerAdd(3.5, '.01', '+1,', nm, 'E');
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

  app.get('/api/tenant-admin/v1/dashboard', async (req) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return { ok: false, error: 'tenantId required' };

    const probe = await probeVista();
    let source = 'fixture';

    // Try VistA-first for counts
    let userCount = fixtures.users.length;
    let activeUserCount = fixtures.users.filter(u => u.status === 'active').length;
    let clinicCount = 0;
    let wardCount = 0;
    let facilityCount = 0;
    let bedCount = 0;
    let roleCount = fixtures.roles.length;
    let deviceCount = 0;
    let esigActiveCount = 0;

    if (probe.ok) {
      try {
        const usersRes = await fetchVistaUsers('');
        const clinicsRes = await fetchVistaClinics('');
        const wardsRes = await fetchVistaWards();
        const keysRes = await ddrListerSecurityKeys();
        if (usersRes.ok) { userCount = usersRes.data.length; activeUserCount = userCount; source = 'vista'; }
        if (clinicsRes.ok) { clinicCount = clinicsRes.data.length; facilityCount = clinicsRes.data.length; }
        if (wardsRes.ok) { wardCount = wardsRes.data.length; }
        if (keysRes.ok) { roleCount = keysRes.data.length; }
        try {
          const devRows = await lockedRpc(async () => {
            const broker = await getBroker();
            const lines = await broker.callRpcWithList('DDR LISTER', [
              { type: 'list', value: { FILE: '3.5', FIELDS: '.01', FLAGS: 'IP', MAX: '999' } },
            ]);
            const parsed = parseDdrListerResponse(lines);
            return parsed.ok ? parsed.data.length : 0;
          });
          deviceCount = devRows;
        } catch (_) { /* ignore */ }
        if (usersRes.ok) {
          const es = await fetchVistaEsigStatusForUsers(usersRes.data, 120);
          if (es.ok) { esigActiveCount = es.data.filter(u => u.hasCode).length; }
        }
      } catch (_) { /* fall back to fixture counts */ }
    } else {
      function countFacilities(items) {
        let n = 0;
        for (const f of items) { n++; if (f.children) n += countFacilities(f.children); }
        return n;
      }
      function countClinics(items) {
        let n = 0;
        for (const f of items) {
          if (f.type === 'Clinic') n++;
          if (f.children) n += countClinics(f.children);
        }
        return n;
      }
      facilityCount = countFacilities(fixtures.facilities);
      clinicCount = countClinics(fixtures.facilities);
      wardCount = fixtures.facilities.reduce((s, inst) => s + (inst.wards || []).length, 0);
      bedCount = fixtures.facilities.reduce((s, inst) =>
        s + (inst.wards || []).reduce((ws, w) => ws + (w.beds || []).length, 0), 0);
      esigActiveCount = fixtures.users.filter(u =>
        u.vistaGrounding.electronicSignature && u.vistaGrounding.electronicSignature.status === 'active'
      ).length;
    }

    return {
      ok: true,
      source,
      tenantId,
      data: {
        userCount,
        activeUserCount,
        facilityCount,
        clinicCount,
        wardCount,
        bedCount,
        roleCount,
        esigActiveCount,
        deviceCount,
        vistaGrounding: probe.ok ? 'connected' : 'integration-pending',
        vistaUrl: probe.url || null,
        moduleStatus: { enabled: 0, total: 0 }
      }
    };
  });

  /** Clinic detail (File 44) via DDR GETS ENTRY DATA — all scheduling + basic fields */
  app.get('/api/tenant-admin/v1/clinics/:ien', async (req) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return { ok: false, error: 'tenantId required' };
    const { ien } = req.params;
    const p = await probeVista();
    if (!p.ok) return { ok: false, tenantId, source: 'integration-pending', error: p.error };
    try {
      const ddr = await ddrGetsEntry('44', ien, '.01;1;2;3;4;8;9;16;1912;1913;1914;1917;1918;1918.5;1920;2002;2503');
      return { ok: true, source: 'vista', tenantId, ien, rpcUsed: ddr.rpcUsed, file: '44', data: ddr.data, rawLines: ddr.rawLines };
    } catch (e) {
      return { ok: false, tenantId, source: 'error', error: e.message };
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
  app.get('/api/tenant-admin/v1/wards/:ien', async (req) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return { ok: false, error: 'tenantId required' };
    const { ien } = req.params;
    const p = await probeVista();
    if (!p.ok) return { ok: false, tenantId, source: 'integration-pending', error: p.error };
    try {
      const ddr = await ddrGetsEntry('42', ien, '.01;.015;1;2;3;.1;.105');
      return { ok: true, source: 'vista', tenantId, ien, rpcUsed: ddr.rpcUsed, file: '42', data: ddr.data, rawLines: ddr.rawLines };
    } catch (e) {
      return { ok: false, tenantId, source: 'error', error: e.message };
    }
  });

  /** Device detail (File 3.5) via DDR GETS ENTRY DATA */
  app.get('/api/tenant-admin/v1/devices/:ien', async (req) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return { ok: false, error: 'tenantId required' };
    const { ien } = req.params;
    const p = await probeVista();
    if (!p.ok) return { ok: false, tenantId, source: 'integration-pending', error: p.error };
    try {
      const ddr = await ddrGetsEntry('3.5', ien, '.01;1;2;3;4;5;6;7;8;9;10;11;50');
      return { ok: true, source: 'vista', tenantId, ien, rpcUsed: ddr.rpcUsed, file: '3.5', data: ddr.data, rawLines: ddr.rawLines };
    } catch (e) {
      return { ok: false, tenantId, source: 'error', error: e.message };
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

  app.get('/api/tenant-admin/v1/terminal-types', async (req) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return { ok: false, error: 'tenantId required' };
    const p = await probeVista();
    if (!p.ok) return { ok: false, tenantId, source: 'integration-pending', error: p.error };
    try {
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '3.2', FIELDS: '.01;1;2;3', FLAGS: 'IP', MAX: '999' } },
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
      return { ok: false, tenantId, source: 'error', error: e.message };
    }
  });

  // ---- Treating Specialties (File 45.7) via DDR LISTER ----

  app.get('/api/tenant-admin/v1/treating-specialties', async (req) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return { ok: false, error: 'tenantId required' };
    const p = await probeVista();
    if (!p.ok) return { ok: false, tenantId, source: 'integration-pending', error: p.error };
    try {
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '45.7', FIELDS: '.01;1;2', FLAGS: 'IP', MAX: '999' } },
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
      return { ok: false, tenantId, source: 'error', error: e.message };
    }
  });

  // ---- Room-Bed Management (File 405.4) via DDR LISTER ----

  app.get('/api/tenant-admin/v1/room-beds', async (req) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return { ok: false, error: 'tenantId required' };
    const p = await probeVista();
    if (!p.ok) return { ok: false, tenantId, source: 'integration-pending', error: p.error };
    try {
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '405.4', FIELDS: '.01;.02;.2', FLAGS: 'IP', MAX: '999' } },
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
      return { ok: false, tenantId, source: 'error', error: e.message };
    }
  });

  // ---- Installed Packages (File 9.4) via DDR LISTER ----

  app.get('/api/tenant-admin/v1/packages', async (req) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return { ok: false, error: 'tenantId required' };
    const p = await probeVista();
    if (!p.ok) return { ok: false, tenantId, source: 'integration-pending', error: p.error };
    try {
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '9.4', FIELDS: '.01;1;2', FLAGS: 'IP', MAX: '999' } },
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
      return { ok: false, tenantId, source: 'error', error: e.message };
    }
  });

  // ---- HL7 Interfaces (File 870 — HL LOGICAL LINK) via DDR LISTER (read-only) ----

  app.get('/api/tenant-admin/v1/hl7-interfaces', async (req) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return { ok: false, error: 'tenantId required' };
    const p = await probeVista();
    if (!p.ok) return { ok: false, tenantId, source: 'integration-pending', error: p.error };
    try {
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '870', FIELDS: '.01;2;4;200.02', FLAGS: 'IP', MAX: '999' } },
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
      return { ok: false, tenantId, source: 'error', error: e.message };
    }
  });

  // ---- Insurance Companies (File 36) via DDR LISTER ----

  app.get('/api/tenant-admin/v1/insurance-companies', async (req) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return { ok: false, error: 'tenantId required' };
    const p = await probeVista();
    if (!p.ok) return { ok: false, tenantId, source: 'integration-pending', error: p.error };
    try {
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '36', FIELDS: '.01;.111;.114;.115;.116', FLAGS: 'IP', MAX: '999' } },
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
      return { ok: false, tenantId, source: 'error', error: e.message };
    }
  });

  // ---- Appointment Types (File 409.1) via DDR LISTER ----

  app.get('/api/tenant-admin/v1/appointment-types', async (req) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return { ok: false, error: 'tenantId required' };
    const p = await probeVista();
    if (!p.ok) return { ok: false, tenantId, source: 'integration-pending', error: p.error };
    try {
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '409.1', FIELDS: '.01;3;4', FLAGS: 'IP', MAX: '999' } },
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
      return { ok: false, tenantId, source: 'error', error: e.message };
    }
  });

  // ---- Menu Options (File 19) via DDR LISTER (read-only) ----

  app.get('/api/tenant-admin/v1/menu-options', async (req) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return { ok: false, error: 'tenantId required' };
    const p = await probeVista();
    if (!p.ok) return { ok: false, tenantId, source: 'integration-pending', error: p.error };
    try {
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '19', FIELDS: '.01;1;3.6;4', FLAGS: 'IP', MAX: '200' } },
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
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '19', data: rows };
    } catch (e) {
      return { ok: false, tenantId, source: 'error', error: e.message };
    }
  });

  // ---- Drug File / Formulary (File 50) via DDR LISTER (read-only) ----

  app.get('/api/tenant-admin/v1/drug-file', async (req) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return { ok: false, error: 'tenantId required' };
    const p = await probeVista();
    if (!p.ok) return { ok: false, tenantId, source: 'integration-pending', error: p.error };
    try {
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '50', FIELDS: '.01;2;3;100', FLAGS: 'IP', MAX: '999' } },
        ]);
        const parsed = parseDdrListerResponse(lines);
        if (!parsed.ok) return [];
        const out = [];
        for (const line of parsed.data) {
          const a = line.split('^');
          const ien = a[0]?.trim();
          if (!ien || !/^\d+$/.test(ien)) continue;
          out.push({ ien, name: a[1]?.trim() || '', vaClass: a[2]?.trim() || '', dea: a[3]?.trim() || '', inactiveDate: a[4]?.trim() || '' });
        }
        return out;
      });
      return { ok: true, source: 'vista', tenantId, rpcUsed: 'DDR LISTER', file: '50', data: rows };
    } catch (e) {
      return { ok: false, tenantId, source: 'error', error: e.message };
    }
  });

  // ---- Lab Tests (File 60) via DDR LISTER (read-only) ----

  app.get('/api/tenant-admin/v1/lab-tests', async (req) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return { ok: false, error: 'tenantId required' };
    const p = await probeVista();
    if (!p.ok) return { ok: false, tenantId, source: 'integration-pending', error: p.error };
    try {
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '60', FIELDS: '.01;3;4', FLAGS: 'IP', MAX: '999' } },
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
      return { ok: false, tenantId, source: 'error', error: e.message };
    }
  });

  // ---- TaskMan Status (File 14.4) via DDR LISTER (read-only) ----

  app.get('/api/tenant-admin/v1/taskman-tasks', async (req) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return { ok: false, error: 'tenantId required' };
    const p = await probeVista();
    if (!p.ok) return { ok: false, tenantId, source: 'integration-pending', error: p.error };
    try {
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '14.4', FIELDS: '.01;2;6;51', FLAGS: 'IP', MAX: '200' } },
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
      return { ok: false, tenantId, source: 'error', error: e.message };
    }
  });

  // ---- Titles (File 3.1) via DDR LISTER (read-only) ----

  app.get('/api/tenant-admin/v1/titles', async (req) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return { ok: false, error: 'tenantId required' };
    const p = await probeVista();
    if (!p.ok) return { ok: false, tenantId, source: 'integration-pending', error: p.error };
    try {
      const rows = await lockedRpc(async () => {
        const broker = await getBroker();
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '3.1', FIELDS: '.01', FLAGS: 'IP', MAX: '999' } },
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
      return { ok: false, tenantId, source: 'error', error: e.message };
    }
  });

  // ---- SPA fallback ----
  app.setNotFoundHandler(async (_req, reply) => {
    return reply.sendFile('index.html');
  });

  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`Tenant Admin shell listening on http://127.0.0.1:${PORT}`);

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
