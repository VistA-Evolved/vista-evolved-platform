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
import { probeVista, fetchVistaUsers, fetchVistaDivisions, fetchVistaClinics } from './lib/vista-adapter.mjs';

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

  app.get('/api/tenant-admin/v1/dashboard', async (req) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return { ok: false, error: 'tenantId required' };
    function countFacilities(items) {
      let n = 0;
      for (const f of items) { n++; if (f.children) n += countFacilities(f.children); }
      return n;
    }
    const probe = await probeVista();
    return {
      ok: true,
      source: 'fixture',
      tenantId,
      data: {
        userCount: fixtures.users.length,
        facilityCount: countFacilities(fixtures.facilities),
        roleCount: fixtures.roles.length,
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
