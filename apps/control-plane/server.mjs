/**
 * Control-Plane Local Review Runtime
 *
 * Fastify dev server that:
 *   1. Serves static assets (HTML/CSS/JS) from public/
 *   2. Exposes read-only API routes — hybrid (contract-backed + fixture-backed)
 *   3. Exposes LOCAL REVIEW-ONLY write routes for command simulation
 *
 * Contract-backed routes (loaded from packages/contracts/):
 *   - GET /api/control-plane/v1/legal-market-profiles
 *   - GET /api/control-plane/v1/legal-market-profiles/:legalMarketId
 *   - GET /api/control-plane/v1/capabilities
 *   - GET /api/control-plane/v1/effective-plans
 *
 * Fixture-backed routes (loaded from fixtures/):
 *   - All other read-only routes (tenants, bootstrap-requests, provisioning-runs, packs, system-config)
 *
 * Review-only routes: /api/control-plane-review/v1/* — validation & preview only.
 *
 * No persistence, no authentication, no real writes.
 * Route names and response shapes align with:
 *   packages/contracts/openapi/control-plane-operator-bootstrap-and-provisioning.openapi.yaml
 */

import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { loadContractData } from './lib/contract-loader.mjs';

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
const contractData = await loadContractData(__dirname);
const server = Fastify({ logger: true });

// Static assets from public/
await server.register(fastifyStatic, {
  root: join(__dirname, 'public'),
  prefix: '/',
});

// Read-only API routes (hybrid: contract-backed + fixture-backed)
const { default: registerRoutes } = await import('./routes/index.mjs');
registerRoutes(server, fixtures, contractData);

// LOCAL REVIEW-ONLY write routes (validation & preview, no persistence)
const { default: registerReviewRoutes } = await import('./routes/review.mjs');
registerReviewRoutes(server);

await server.listen({ port: PORT, host: '127.0.0.1' });
server.log.info(`Control-plane review runtime listening on http://127.0.0.1:${PORT}`);
