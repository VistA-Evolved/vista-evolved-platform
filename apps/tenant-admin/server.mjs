/**
 * Tenant Admin — Workspace Shell
 *
 * Fastify dev server serving the tenant-admin SPA.
 *
 *   1. Serves static assets (HTML/CSS/JS) from public/
 *   2. Exposes dual-mode API routes: VistA-first with fixture fallback
 *
 * Tenant-scoped: every request requires tenantId context.
 * VistA grounding: adapter-based — uses VISTA_API_URL if configured,
 * falls back to fixture data with honest source labeling.
 *
 * Port: 4520 (per port-registry.md pattern — control-plane=4500, API=4510, tenant-admin=4520)
 */

import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { probeVista, fetchVistaUsers, fetchVistaDivisions, fetchVistaClinics, fetchVistaWards } from './lib/vista-adapter.mjs';

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
    return { ok: true, vista: probe };
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
    // Fixture lookup (VistA user-detail requires DUZ-based lookup — future slice)
    const user = fixtures.users.find(u => u.id === userId);
    if (!user) return { ok: false, error: 'user not found' };

    // Probe VistA for source labeling
    const probe = await probeVista();
    return {
      ok: true,
      source: 'fixture',
      data: user,
      vistaStatus: probe.ok ? 'reachable' : 'unavailable',
    };
  });

  // ---- Dual-mode facility routes (VistA-first, fixture fallback) ----

  app.get('/api/tenant-admin/v1/facilities', async (req) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return { ok: false, error: 'tenantId required' };

    // Try VistA adapter: divisions + clinics → assemble topology
    const divResult = await fetchVistaDivisions();
    const clinicResult = await fetchVistaClinics(req.query.search || '');

    if (divResult.ok) {
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

      // Attach clinics to divisions if we have them
      if (clinicResult.ok) {
        const clinics = (clinicResult.data || []).map(c => ({
          id: `loc-${c.ien || c.id || 'unknown'}`,
          name: c.name || c.locationName || 'Unknown Clinic',
          type: 'Clinic',
          status: 'active',
          vistaGrounding: { file44Ien: c.ien || c.id, status: 'grounded' },
        }));
        // If only one division, attach all clinics to it; otherwise flat list
        if (divisions.length === 1) {
          divisions[0].children = clinics;
        } else if (divisions.length > 1) {
          // Clinics without division-level grouping — attach as flat peers
          for (const c of clinics) divisions.push(c);
        }
      }

      return {
        ok: true,
        source: 'vista',
        tenantId,
        data: divisions,
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
    // Fixture lookup (VistA detail requires IEN-based global reads — future slice)
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

    // Probe VistA for source labeling
    const probe = await probeVista();
    return {
      ok: true,
      source: 'fixture',
      data: facility,
      vistaStatus: probe.ok ? 'reachable' : 'unavailable',
    };
  });

  app.get('/api/tenant-admin/v1/roles', async (req) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return { ok: false, error: 'tenantId required' };
    return { ok: true, source: 'fixture', tenantId, data: fixtures.roles };
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
        if (f.type === 'Clinic' && (!typeFilter || f.vistaGrounding.locationType === typeFilter)) {
          clinics.push({ ...f, parentDivision: parentDivision || null });
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
          wards.push({
            ...w,
            parentInstitution: inst.name,
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

    const topology = fixtures.facilities.map(inst => {
      const divisions = (inst.children || []).filter(c => c.type === 'Division');
      return {
        id: inst.id,
        name: inst.name,
        type: inst.type,
        stationNumber: inst.vistaGrounding.stationNumber || null,
        divisionCount: divisions.length,
        clinicCount: divisions.reduce((s, d) =>
          s + (d.children || []).filter(c => c.type === 'Clinic').length, 0),
        wardCount: (inst.wards || []).length,
        bedCount: (inst.wards || []).reduce((s, w) => s + (w.beds || []).length, 0),
        divisions: divisions.map(d => ({
          id: d.id,
          name: d.name,
          facilityNumber: d.vistaGrounding.facilityNumber || null,
          clinicCount: (d.children || []).filter(c => c.type === 'Clinic').length,
          clinics: (d.children || []).filter(c => c.type === 'Clinic').map(c => ({
            id: c.id,
            name: c.name,
            abbreviation: c.vistaGrounding.abbreviation || null,
            stopCode: c.vistaGrounding.stopCode || null,
            slotLength: c.vistaGrounding.defaultSlotLength || null,
          })),
        })),
        wards: (inst.wards || []).map(w => ({
          id: w.id,
          name: w.name,
          specialty: w.vistaGrounding.specialty || null,
          bedCount: (w.beds || []).length,
          availableBeds: (w.beds || []).filter(b => b.status === 'available').length,
        })),
      };
    });

    return {
      ok: true,
      source: 'fixture',
      tenantId,
      data: topology,
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
      tenantId,
      data: inventory,
      summary: {
        totalKeys: inventory.length,
        clinicalKeys: inventory.filter(k => k.category === 'clinical').length,
        adminKeys: inventory.filter(k => k.category === 'administrative').length,
        unassignedKeys: inventory.filter(k => k.holderCount === 0).length,
      },
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
      tenantId,
      data: summary,
      aggregates: {
        total: summary.length,
        active: summary.filter(u => u.esigStatus === 'active').length,
        notConfigured: summary.filter(u => u.esigStatus === 'not-configured').length,
        revoked: summary.filter(u => u.esigStatus === 'revoked').length,
      },
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
    const wardCount = fixtures.facilities.reduce((s, inst) => s + (inst.wards || []).length, 0);
    const bedCount = fixtures.facilities.reduce((s, inst) =>
      s + (inst.wards || []).reduce((ws, w) => ws + (w.beds || []).length, 0), 0);
    const probe = await probeVista();
    const activeUsers = fixtures.users.filter(u => u.status === 'active').length;
    const esigActive = fixtures.users.filter(u =>
      u.vistaGrounding.electronicSignature && u.vistaGrounding.electronicSignature.status === 'active'
    ).length;
    return {
      ok: true,
      source: 'fixture',
      tenantId,
      data: {
        userCount: fixtures.users.length,
        activeUserCount: activeUsers,
        facilityCount: countFacilities(fixtures.facilities),
        clinicCount: countClinics(fixtures.facilities),
        wardCount,
        bedCount,
        roleCount: fixtures.roles.length,
        esigActiveCount: esigActive,
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
}

main().catch(err => { console.error(err); process.exit(1); });
