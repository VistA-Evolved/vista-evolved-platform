/**
 * Platform Operations Console — Control Plane Runtime
 *
 * Fastify server serving the operator-console SPA.
 *
 *   1. Serves static assets (HTML/CSS/JS) from public/
 *   2. Exposes read-only API routes:
 *      - Real-backend proxy (tenants, bootstrap, provisioning, audit)
 *      - Contract-backed (markets, packs, capabilities, effective-plans)
 *   3. Exposes lifecycle proxy for real writes to control-plane-api
 *
 * Data sourcing:
 *   Real-backend (from control-plane-api via REAL_BACKEND_URL):
 *     - tenants, bootstrap-requests, provisioning-runs, audit, operator data
 *   Contract-backed (from packages/contracts/):
 *     - legal-market-profiles, capabilities, effective-plans, packs
 *
 * Route names and response shapes align with:
 *   packages/contracts/openapi/control-plane-operator-bootstrap-and-provisioning.openapi.yaml
 */

import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadContractData } from './lib/contract-loader.mjs';
import { resolveLocalOperatorContext } from './lib/local-operator-context.mjs';
import { CONTROL_PLANE_REQUIRED_ROLE } from './lib/access-map.mjs';
import { runDriftAudit } from './lib/drift-audit.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '4500', 10);

const REAL_BACKEND_URL = process.env.REAL_BACKEND_URL || 'http://127.0.0.1:4510';

const contractData = await loadContractData(__dirname);

if (contractData.integrityWarnings.length > 0) {
  console.warn(`[integrity] ${contractData.integrityWarnings.length} pack reference warning(s):`);
  for (const w of contractData.integrityWarnings) console.warn(`  - ${w}`);
} else {
  console.log('[integrity] All pack references resolve — 0 warnings');
}
console.log(`[contract-loader] Pack catalog: ${contractData.packCatalog.detailIndex.size} packs loaded`);

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

await server.register(fastifyStatic, {
  root: join(__dirname, 'public'),
  prefix: '/',
});

await server.register(fastifyStatic, {
  root: join(__dirname, '..', '..', 'packages', 'ui', 'design-system'),
  prefix: '/design-system/',
  decorateReply: false,
});

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

const { default: registerRoutes } = await import('./routes/index.mjs');
registerRoutes(server, contractData, REAL_BACKEND_URL);

const { default: registerLifecycleRoutes } = await import('./routes/lifecycle.mjs');
registerLifecycleRoutes(server, REAL_BACKEND_URL);

await server.listen({ port: PORT, host: '127.0.0.1' });
server.log.info(`Control-plane operator console listening on http://127.0.0.1:${PORT}`);
