/**
 * Tenant Admin — Workspace Shell
 *
 * Fastify dev server serving the tenant-admin SPA.
 *
 *   1. Serves static assets (HTML/CSS/JS) from public/
 *   2. Exposes fixture-backed read API routes for first-slice surfaces
 *
 * Tenant-scoped: every request requires tenantId context.
 * VistA grounding is integration-pending until VistA connection adapter is wired.
 *
 * Port: 4520 (per port-registry.md pattern — control-plane=4500, API=4510, tenant-admin=4520)
 */

import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFile } from 'node:fs/promises';

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

  // ---- Fixture-backed read routes ----

  app.get('/api/tenant-admin/v1/users', async (req) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return { ok: false, error: 'tenantId required' };
    return { ok: true, source: 'fixture', tenantId, data: fixtures.users };
  });

  app.get('/api/tenant-admin/v1/users/:userId', async (req) => {
    const { userId } = req.params;
    const user = fixtures.users.find(u => u.id === userId);
    if (!user) return { ok: false, error: 'user not found' };
    return { ok: true, source: 'fixture', data: user };
  });

  app.get('/api/tenant-admin/v1/facilities', async (req) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return { ok: false, error: 'tenantId required' };
    return { ok: true, source: 'fixture', tenantId, data: fixtures.facilities };
  });

  app.get('/api/tenant-admin/v1/facilities/:facilityId', async (req) => {
    const { facilityId } = req.params;
    const facility = fixtures.facilities.find(f => f.id === facilityId);
    if (!facility) return { ok: false, error: 'facility not found' };
    return { ok: true, source: 'fixture', data: facility };
  });

  app.get('/api/tenant-admin/v1/roles', async (req) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return { ok: false, error: 'tenantId required' };
    return { ok: true, source: 'fixture', tenantId, data: fixtures.roles };
  });

  app.get('/api/tenant-admin/v1/dashboard', async (req) => {
    const tenantId = req.query.tenantId;
    if (!tenantId) return { ok: false, error: 'tenantId required' };
    return {
      ok: true,
      source: 'fixture',
      tenantId,
      data: {
        userCount: fixtures.users.length,
        facilityCount: fixtures.facilities.length,
        roleCount: fixtures.roles.length,
        vistaGrounding: 'integration-pending',
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
