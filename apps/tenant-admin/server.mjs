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
import { probeVista, fetchVistaUsers, fetchVistaDivisions, fetchVistaClinics, fetchVistaWards, fetchVistaCurrentUser } from './lib/vista-adapter.mjs';
import { disconnectBroker } from './lib/xwb-client.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '4520', 10);

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

    // VistA-first: try broker lookup by IEN
    try {
      const usersRes = await fetchVistaUsers('');
      if (usersRes.ok) {
        const vistaUser = usersRes.data.find(u => String(u.ien) === String(userId));
        if (vistaUser) {
          return {
            ok: true, source: 'vista', data: {
              id: vistaUser.ien, name: vistaUser.name, ien: vistaUser.ien,
              username: vistaUser.name, status: 'active', roles: [],
              vistaGrounding: { duz: vistaUser.ien, file200Status: 'vista-ien' }
            }, vistaStatus: 'reachable'
          };
        }
      }
    } catch (_) { /* VistA unavailable — fall through to fixture */ }

    // Fixture fallback
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
      sourceStatus: 'integration-pending',
      tenantId,
      data: enrichedRoles,
      integrationNote: 'No VistA RPC enumerates File 19.1 security keys in bulk. ORWU HASKEY checks one user+key at a time. Full key inventory requires DDR FILE ENTRIES or a custom M routine scanning ^DIC(19.1).',
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

    // Build inventory from fixtures with holder cross-reference
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
      sourceStatus: 'integration-pending',
      tenantId,
      data: inventory,
      summary: {
        totalKeys: inventory.length,
        clinicalKeys: inventory.filter(k => k.category === 'clinical').length,
        adminKeys: inventory.filter(k => k.category === 'administrative').length,
        unassignedKeys: inventory.filter(k => k.holderCount === 0).length,
      },
      integrationNote: 'Key-to-holder mapping is fixture-based. ORWU HASKEY can verify individual assignments but cannot enumerate all holders of a given key. Requires DDR global read of ^XUSEC(key) or a custom M routine.',
    };
  });

  // ---- E-signature status summary ----

  app.get('/api/tenant-admin/v1/esig-status', async (req) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return { ok: false, error: 'tenantId required' };

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
      integrationNote: 'ORWU VALIDSIG validates one e-sig at a time but no RPC exposes bulk e-sig status across all users. Fixture data reflects design-time assumptions, not live VistA state. Requires per-user ORWU VALIDSIG probing or DDR read of File 200 field 20.4 hash presence.',
      vistaGrounding: {
        validationRpc: 'ORWU VALIDSIG',
        field: 'File 200 field 20.4 (ELECTRONIC SIGNATURE CODE)',
        note: 'E-sig codes are hashed in VistA and never retrievable. Presence check only.',
      },
    };
  });

  // ---- Guided write workflow catalog ----

  app.get('/api/tenant-admin/v1/guided-tasks', async (req) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return { ok: false, error: 'tenantId required' };
    const probe = await probeVista();
    const vistaConnected = probe.ok;

    // Workflow catalog (server-side source of truth for GW-* IDs)
    const workflowCatalog = [
      { gwId: 'GW-USR-01', title: 'Add New User', category: 'User Management', mode: 'B', risk: 'high', vistaTarget: 'File 200' },
      { gwId: 'GW-USR-02', title: 'Edit User Properties', category: 'User Management', mode: 'B', risk: 'medium', vistaTarget: 'File 200' },
      { gwId: 'GW-USR-03', title: 'Deactivate User (DISUSER)', category: 'User Management', mode: 'B', risk: 'high', vistaTarget: 'File 200' },
      { gwId: 'GW-USR-04', title: 'Reactivate User', category: 'User Management', mode: 'B', risk: 'high', vistaTarget: 'File 200' },
      { gwId: 'GW-USR-05', title: 'Set Up Electronic Signature', category: 'User Management', mode: 'C', risk: 'high', vistaTarget: 'File 200 field 20.4' },
      { gwId: 'GW-KEY-01', title: 'Allocate Security Key', category: 'Key Management', mode: 'B', risk: 'high', vistaTarget: 'File 19.1' },
      { gwId: 'GW-KEY-02', title: 'Remove Security Key', category: 'Key Management', mode: 'B', risk: 'high', vistaTarget: 'File 19.1' },
      { gwId: 'GW-DIV-01', title: 'Manage Division Configuration', category: 'Division Management', mode: 'C', risk: 'high', vistaTarget: 'File 40.8' },
      { gwId: 'GW-DIV-02', title: 'Manage Service/Section', category: 'Division Management', mode: 'B', risk: 'medium', vistaTarget: 'File 49' },
      { gwId: 'GW-DIV-03', title: 'View/Edit Kernel Site Parameters', category: 'Division Management', mode: 'B', risk: 'high', vistaTarget: 'File 8989.3' },
      { gwId: 'GW-CLIN-01', title: 'Add/Edit Clinic Location', category: 'Clinic Management', mode: 'B', risk: 'medium', vistaTarget: 'File 44' },
      { gwId: 'GW-CLIN-02', title: 'Edit Clinic Fields', category: 'Clinic Management', mode: 'B', risk: 'medium', vistaTarget: 'File 44' },
      { gwId: 'GW-CLIN-03', title: 'Inactivate/Reactivate Clinic', category: 'Clinic Management', mode: 'B', risk: 'medium', vistaTarget: 'File 44' },
      { gwId: 'GW-WARD-01', title: 'Add/Edit Ward Location', category: 'Ward Management', mode: 'B', risk: 'high', vistaTarget: 'File 42 + File 405.4' },
      { gwId: 'GW-WARD-02', title: 'Room-Bed Setup', category: 'Ward Management', mode: 'C', risk: 'high', vistaTarget: 'File 405.4' },
      { gwId: 'GW-ORD-01', title: 'Quick Order Management', category: 'Ordering Configuration', mode: 'C', risk: 'medium', vistaTarget: 'File 101.41' },
      { gwId: 'GW-ORD-02', title: 'Configure CPRS Notifications', category: 'Ordering Configuration', mode: 'A', risk: 'medium', vistaTarget: 'ORQ3 LOADALL/SAVEALL' },
      { gwId: 'GW-MENU-01', title: 'View/Edit Menu Trees', category: 'System Configuration', mode: 'C', risk: 'high', vistaTarget: 'File 19' },
      { gwId: 'GW-PCMM-01', title: 'PCMM Team Management', category: 'System Configuration', mode: 'C', risk: 'medium', vistaTarget: 'SD PCMM files' },
    ];

    return {
      ok: true,
      source: 'catalog',
      tenantId,
      data: workflowCatalog,
      summary: {
        total: workflowCatalog.length,
        modeA: workflowCatalog.filter(w => w.mode === 'A').length,
        modeB: workflowCatalog.filter(w => w.mode === 'B').length,
        modeC: workflowCatalog.filter(w => w.mode === 'C').length,
        highRisk: workflowCatalog.filter(w => w.risk === 'high').length,
      },
      vistaStatus: vistaConnected ? 'connected' : 'integration-pending',
    };
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
    let esigActiveCount = 0;

    if (probe.ok) {
      try {
        // Sequential calls — XWB broker has no mutex, concurrent RPCs corrupt responses
        const usersRes = await fetchVistaUsers('');
        const clinicsRes = await fetchVistaClinics('');
        const wardsRes = await fetchVistaWards();
        if (usersRes.ok) { userCount = usersRes.data.length; activeUserCount = userCount; source = 'vista'; }
        if (clinicsRes.ok) { clinicCount = clinicsRes.data.length; facilityCount = clinicsRes.data.length; }
        if (wardsRes.ok) { wardCount = wardsRes.data.length; }
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
        vistaGrounding: probe.ok ? 'connected' : 'integration-pending',
        vistaUrl: probe.url || null,
        moduleStatus: { enabled: 0, total: 0 }
      }
    };
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
