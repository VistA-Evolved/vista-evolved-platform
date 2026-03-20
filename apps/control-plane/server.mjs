/**
 * Operator Console — Local Review Runtime
 *
 * Fastify dev server serving the operator-console SPA (21 surfaces, 7 domain groups).
 *
 *   1. Serves static assets (HTML/CSS/JS) from public/
 *   2. Exposes read-only API routes — hybrid (contract-backed + fixture-backed)
 *   3. Exposes LOCAL REVIEW-ONLY write routes for command simulation
 *
 * Data sourcing tiers:
 *   Contract-backed (from packages/contracts/):
 *     - legal-market-profiles, capabilities, effective-plans, packs
 *   Fixture-backed (from fixtures/):
 *     - tenants, bootstrap-requests, provisioning-runs, system-config
 *   Static (no API):
 *     - 13 surfaces render contracted IA only (identity, payer-readiness,
 *       eligibility-sim, alerts, backup-dr, environments, billing, usage,
 *       support, audit, templates, runbooks, overview)
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
import { CONTROL_PLANE_REQUIRED_ROLE } from './lib/access-map.mjs';
import { runDriftAudit } from './lib/drift-audit.mjs';
import { initCopilot, getCopilotStatus } from './copilot/copilot-service.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '4500', 10);

// Real backend URL for P0 lifecycle proxy (control-plane-api on port 4510)
const REAL_BACKEND_URL = process.env.REAL_BACKEND_URL || 'http://127.0.0.1:4510';

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

// Startup drift audit — compare resolver output to seed effective plans
const driftResult = runDriftAudit(contractData);
if (driftResult.driftItems.length > 0) {
  console.warn(`[drift-audit] ${driftResult.summary}`);
  for (const d of driftResult.driftItems) {
    const prefix = d.severity === 'error' ? '  ✗' : d.severity === 'warning' ? '  ⚠' : '  ℹ';
    console.warn(`${prefix} [${d.legalMarketId}] ${d.category}: ${d.detail}`);
  }
} else {
  console.log(`[drift-audit] ${driftResult.summary}`);
}

const server = Fastify({ logger: true });

// Static assets from public/
await server.register(fastifyStatic, {
  root: join(__dirname, 'public'),
  prefix: '/',
});

// Local operator-access enforcement — NOT real auth.
// Role read from X-Local-Role header; default: platform-operator.
// Only platform-operator may access control-plane API routes.
// Required role derived from lib/access-map.mjs (grounded in permissions-matrix.md).
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
      requiredRole: CONTROL_PLANE_REQUIRED_ROLE,
    });
  }
});

// Read-only API routes (hybrid: contract-backed + fixture-backed + real-backend proxy)
const { default: registerRoutes } = await import('./routes/index.mjs');
registerRoutes(server, fixtures, contractData, REAL_BACKEND_URL);

// LOCAL REVIEW-ONLY write routes (validation & preview, no persistence)
const { default: registerReviewRoutes } = await import('./routes/review.mjs');
registerReviewRoutes(server, contractData);

// P0 lifecycle proxy routes (real backend writes for graduated surfaces)
const { default: registerLifecycleRoutes } = await import('./routes/lifecycle.mjs');
registerLifecycleRoutes(server, REAL_BACKEND_URL);

// AI Operator Copilot routes (disabled by default — COPILOT_ENABLED=false)
initCopilot();
const copilotStatus = getCopilotStatus();
console.log(`[copilot] status: ${copilotStatus.statusLabel}${copilotStatus.operational ? ' ✓' : ''}`);

const { default: registerCopilotRoutes } = await import('./routes/copilot-routes.mjs');
registerCopilotRoutes(server, fixtures, contractData, REAL_BACKEND_URL);

await server.listen({ port: PORT, host: '127.0.0.1' });
server.log.info(`Control-plane review runtime listening on http://127.0.0.1:${PORT}`);
