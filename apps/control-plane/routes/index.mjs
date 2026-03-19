/**
 * Read-only API routes for the control-plane review runtime.
 *
 * All routes are fixture-backed. Response shapes align with the OpenAPI contract:
 *   packages/contracts/openapi/control-plane-operator-bootstrap-and-provisioning.openapi.yaml
 *
 * Base path: /api/control-plane/v1
 * No writes, no auth, no persistence.
 */

const PREFIX = '/api/control-plane/v1';

/** Strip _provenance from fixture data before serving */
function stripProvenance(obj) {
  if (obj == null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripProvenance);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === '_provenance') continue;
    out[k] = stripProvenance(v);
  }
  return out;
}

export default function registerRoutes(server, fixtures) {
  // ── R1: listTenants ─────────────────────────────────────────────────────
  server.get(`${PREFIX}/tenants`, async (request, reply) => {
    return stripProvenance(fixtures['tenants']);
  });

  // ── R2: getTenant ───────────────────────────────────────────────────────
  server.get(`${PREFIX}/tenants/:tenantId`, async (request, reply) => {
    const { tenantId } = request.params;
    const tenant = fixtures['tenants'].items.find(t => t.tenantId === tenantId);
    if (!tenant) {
      reply.code(404);
      return { error: 'not_found', message: `Tenant ${tenantId} not found` };
    }
    return stripProvenance(tenant);
  });

  // ── R3: listLegalMarketProfiles ─────────────────────────────────────────
  server.get(`${PREFIX}/legal-market-profiles`, async (request, reply) => {
    return stripProvenance(fixtures['legal-market-profiles']);
  });

  // ── R4: getLegalMarketProfile ───────────────────────────────────────────
  server.get(`${PREFIX}/legal-market-profiles/:legalMarketId`, async (request, reply) => {
    const { legalMarketId } = request.params;
    const market = fixtures['legal-market-profiles'].items.find(
      m => m.legalMarketId === legalMarketId
    );
    if (!market) {
      reply.code(404);
      return { error: 'not_found', message: `Market ${legalMarketId} not found` };
    }
    return stripProvenance(market);
  });

  // ── R5: listTenantBootstrapRequests ─────────────────────────────────────
  server.get(`${PREFIX}/tenant-bootstrap-requests`, async (request, reply) => {
    return stripProvenance(fixtures['bootstrap-requests']);
  });

  // ── R6: getTenantBootstrapRequest ───────────────────────────────────────
  server.get(`${PREFIX}/tenant-bootstrap-requests/:bootstrapRequestId`, async (request, reply) => {
    const { bootstrapRequestId } = request.params;
    const req = fixtures['bootstrap-requests'].items.find(
      b => b.bootstrapRequestId === bootstrapRequestId
    );
    if (!req) {
      reply.code(404);
      return { error: 'not_found', message: `Bootstrap request ${bootstrapRequestId} not found` };
    }
    return stripProvenance(req);
  });

  // ── R7: listProvisioningRuns ────────────────────────────────────────────
  server.get(`${PREFIX}/provisioning-runs`, async (request, reply) => {
    return stripProvenance(fixtures['provisioning-runs']);
  });

  // ── R8: getProvisioningRun ──────────────────────────────────────────────
  server.get(`${PREFIX}/provisioning-runs/:provisioningRunId`, async (request, reply) => {
    const { provisioningRunId } = request.params;
    const run = fixtures['provisioning-runs'].items.find(
      r => r.provisioningRunId === provisioningRunId
    );
    if (!run) {
      reply.code(404);
      return { error: 'not_found', message: `Provisioning run ${provisioningRunId} not found` };
    }
    return stripProvenance(run);
  });

  // ── R9: listPacks ──────────────────────────────────────────────────────
  server.get(`${PREFIX}/packs`, async (request, reply) => {
    return stripProvenance(fixtures['packs']);
  });

  // ── R10: getSystemConfig ────────────────────────────────────────────────
  server.get(`${PREFIX}/system-config`, async (request, reply) => {
    return stripProvenance(fixtures['system-config']);
  });

  // ── Supplementary: capabilities (no OpenAPI operationId yet) ────────────
  server.get(`${PREFIX}/capabilities`, async (request, reply) => {
    return stripProvenance(fixtures['capabilities']);
  });

  // ── Supplementary: effective-plans ──────────────────────────────────────
  server.get(`${PREFIX}/effective-plans`, async (request, reply) => {
    return stripProvenance(fixtures['effective-plans']);
  });
}
