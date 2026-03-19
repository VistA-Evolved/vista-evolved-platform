/**
 * Read-only API routes for the control-plane review runtime.
 *
 * Hybrid sourcing:
 *   Contract-backed (loaded from packages/contracts/ at startup):
 *     - R3: listLegalMarketProfiles
 *     - R4: getLegalMarketProfile
 *     - R9: listPacks (hybrid: contract manifests + 1 fabricated demo)
 *     - R9b: getPack (hybrid: contract manifests + 1 fabricated demo)
 *     - capabilities
 *     - effective-plans
 *
 *   Fixture-backed (loaded from fixtures/ at startup):
 *     - R1: listTenants, R2: getTenant
 *     - R5: listTenantBootstrapRequests, R6: getTenantBootstrapRequest
 *     - R7: listProvisioningRuns, R8: getProvisioningRun
 *     - R10: getSystemConfig
 *
 * Response shapes align with the OpenAPI contract:
 *   packages/contracts/openapi/control-plane-operator-bootstrap-and-provisioning.openapi.yaml
 *
 * Base path: /api/control-plane/v1
 * No writes, no persistence. Operator-access enforced at server level.
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

export default function registerRoutes(server, fixtures, contractData) {
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

  // ── R3: listLegalMarketProfiles (contract-backed) ────────────────────────
  server.get(`${PREFIX}/legal-market-profiles`, async (request, reply) => {
    return contractData.legalMarketProfiles;
  });

  // ── R4: getLegalMarketProfile (contract-backed) ─────────────────────────
  server.get(`${PREFIX}/legal-market-profiles/:legalMarketId`, async (request, reply) => {
    const { legalMarketId } = request.params;
    const market = contractData.legalMarketProfiles.items.find(
      m => m.legalMarketId === legalMarketId
    );
    if (!market) {
      reply.code(404);
      return { error: 'not_found', message: `Market ${legalMarketId} not found` };
    }
    return market;
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

  // ── R9: listPacks (contract-backed hybrid + filters) ─────────────────────
  server.get(`${PREFIX}/packs`, async (request, reply) => {
    const { packFamily, lifecycleState, legalMarketId, search, page, pageSize } = request.query;
    let items = contractData.packCatalog.summaries;

    // Filters per OpenAPI: packFamily, lifecycleState, legalMarketId, search
    if (packFamily) {
      items = items.filter(p => p.packFamily === packFamily);
    }
    if (lifecycleState) {
      items = items.filter(p => p.lifecycleState === lifecycleState);
    }
    if (legalMarketId) {
      items = items.filter(p => p.eligibleMarkets.includes(legalMarketId));
    }
    if (search) {
      const term = search.toLowerCase();
      items = items.filter(p =>
        p.packId.toLowerCase().includes(term) ||
        p.displayName.toLowerCase().includes(term) ||
        (p.description && p.description.toLowerCase().includes(term))
      );
    }

    // Pagination
    const pg = Math.max(1, parseInt(page, 10) || 1);
    const ps = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
    const totalItems = items.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / ps));
    const start = (pg - 1) * ps;
    const paged = items.slice(start, start + ps);

    return {
      items: paged,
      pagination: { page: pg, pageSize: ps, totalItems, totalPages },
    };
  });

  // ── R9b: getPack (contract-backed hybrid) ───────────────────────────────
  server.get(`${PREFIX}/packs/:packId`, async (request, reply) => {
    const { packId } = request.params;
    const detail = contractData.packCatalog.detailIndex.get(packId);
    if (!detail) {
      reply.code(404);
      return { error: 'not_found', message: `Pack ${packId} not found` };
    }
    return detail;
  });

  // ── R10: getSystemConfig ────────────────────────────────────────────────
  server.get(`${PREFIX}/system-config`, async (request, reply) => {
    return stripProvenance(fixtures['system-config']);
  });

  // ── Supplementary: capabilities (contract-backed) ────────────────────────
  server.get(`${PREFIX}/capabilities`, async (request, reply) => {
    return contractData.capabilities;
  });

  // ── Supplementary: effective-plans (contract-backed) ────────────────────
  server.get(`${PREFIX}/effective-plans`, async (request, reply) => {
    return contractData.effectivePlans;
  });
}
