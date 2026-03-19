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
 *   - GET /api/control-plane/v1/packs          (hybrid: contract + 1 fabricated demo)
 *   - GET /api/control-plane/v1/packs/:packId  (hybrid: contract + 1 fabricated demo)
 *
 * Fixture-backed routes (loaded from fixtures/):
 *   - All other read-only routes (tenants, bootstrap-requests, provisioning-runs, system-config)
 *
 * Review-only routes: /api/control-plane-review/v1/* — validation & preview only.
 *
 * No persistence, no real writes. Local operator-access enforcement (not real auth).
 * Route names and response shapes align with:
 *   packages/contracts/openapi/control-plane-operator-bootstrap-and-provisioning.openapi.yaml
 */

import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { loadContractData } from './lib/contract-loader.mjs';
import { resolveLocalOperatorContext } from './lib/local-operator-context.mjs';

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

// Startup integrity audit — report pack reference health
if (contractData.integrityWarnings.length > 0) {
  console.warn(`[integrity] ${contractData.integrityWarnings.length} pack reference warning(s):`);
  for (const w of contractData.integrityWarnings) console.warn(`  - ${w}`);
} else {
  console.log('[integrity] All pack references resolve — 0 warnings');
}
console.log(`[contract-loader] Pack catalog: ${contractData.packCatalog.detailIndex.size} packs loaded (${contractData.packCatalog.detailIndex.size - 1} contract + 1 demo)`);

const server = Fastify({ logger: true });

// Static assets from public/
await server.register(fastifyStatic, {
  root: join(__dirname, 'public'),
  prefix: '/',
});

// Local operator-access enforcement — NOT real auth.
// Role read from X-Local-Role header; default: platform-operator.
// Only platform-operator may access control-plane API routes.
server.addHook('onRequest', async (request, reply) => {
  if (!request.url.startsWith('/api/')) return;
  const ctx = resolveLocalOperatorContext(request);
  if (!ctx.recognized) {
    return reply.code(400).send({
      error: 'invalid_role',
      message: ctx.reason,
      validRoles: ctx.validRoles,
    });
  }
  if (!ctx.allowed) {
    return reply.code(403).send({
      error: 'access_denied',
      message: ctx.reason,
      activeRole: ctx.role,
      requiredRole: 'platform-operator',
    });
  }
});

// Read-only API routes (hybrid: contract-backed + fixture-backed)
const { default: registerRoutes } = await import('./routes/index.mjs');
registerRoutes(server, fixtures, contractData);

// LOCAL REVIEW-ONLY write routes (validation & preview, no persistence)
const { default: registerReviewRoutes } = await import('./routes/review.mjs');
registerReviewRoutes(server);

await server.listen({ port: PORT, host: '127.0.0.1' });
server.log.info(`Control-plane review runtime listening on http://127.0.0.1:${PORT}`);
