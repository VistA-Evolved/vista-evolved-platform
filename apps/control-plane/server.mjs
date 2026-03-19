/**
 * Control-Plane Local Review Runtime
 *
 * Fastify dev server that:
 *   1. Serves static assets (HTML/CSS/JS) from public/
 *   2. Exposes read-only API routes backed by fixture JSON data
 *
 * All data is fixture-sourced. No persistence, no authentication, no writes.
 * Route names and response shapes align with:
 *   packages/contracts/openapi/control-plane-operator-bootstrap-and-provisioning.openapi.yaml
 */

import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFile } from 'node:fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '4500', 10);

// ---------------------------------------------------------------------------
// Load fixtures once at startup
// ---------------------------------------------------------------------------
async function loadFixtures() {
  const fixtureDir = join(__dirname, 'fixtures');
  const files = [
    'tenants', 'bootstrap-requests', 'provisioning-runs',
    'legal-market-profiles', 'effective-plans', 'packs',
    'capabilities', 'system-config'
  ];
  const fixtures = {};
  for (const f of files) {
    const raw = await readFile(join(fixtureDir, `${f}.json`), 'utf8');
    fixtures[f] = JSON.parse(raw);
  }
  return fixtures;
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------
const fixtures = await loadFixtures();
const server = Fastify({ logger: true });

// Static assets from public/
await server.register(fastifyStatic, {
  root: join(__dirname, 'public'),
  prefix: '/',
});

// Read-only API routes (registered in GATE 2)
const { default: registerRoutes } = await import('./routes/index.mjs');
registerRoutes(server, fixtures);

await server.listen({ port: PORT, host: '127.0.0.1' });
server.log.info(`Control-plane review runtime listening on http://127.0.0.1:${PORT}`);
