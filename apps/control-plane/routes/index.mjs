/**
 * Read-only API routes for the control-plane review runtime.
 *
 * Hybrid sourcing:
 *   Real-backend proxy (P0 graduated surfaces — port 4510 with fixture fallback):
 *     - R1: listTenants, R2: getTenant
 *     - R5: listTenantBootstrapRequests, R6: getTenantBootstrapRequest
 *     - R7: listProvisioningRuns, R8: getProvisioningRun
 *
 *   Contract-backed (loaded from packages/contracts/ at startup):
 *     - R3: listLegalMarketProfiles
 *     - R4: getLegalMarketProfile
 *     - R9: listPacks (hybrid: contract manifests + 1 fabricated demo)
 *     - R9b: getPack (hybrid: contract manifests + 1 fabricated demo)
 *     - capabilities
 *     - effective-plans
 *
 *   Fixture-backed (loaded from fixtures/ at startup):
 *     - R10: getSystemConfig
 *
 * Response shapes align with the OpenAPI contract:
 *   packages/contracts/openapi/control-plane-operator-bootstrap-and-provisioning.openapi.yaml
 *
 * Base path: /api/control-plane/v1
 * No writes, no persistence. Operator-access enforced at server level.
 */

const PREFIX = '/api/control-plane/v1';
const BACKEND_PREFIX = '/api/control-plane-admin/v1';

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

/**
 * Fetch from real backend with timeout. Returns null on any failure.
 */
async function backendFetch(backendUrl, path) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const resp = await fetch(`${backendUrl}${path}`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

/**
 * Normalize a real-backend tenant row to the fixture-compatible shape.
 */
function normalizeTenant(t) {
  return {
    tenantId: t.id,
    displayName: t.displayName,
    slug: t.slug || null,
    status: t.status,
    legalMarketId: t.legalMarketId,
    launchTier: null,
    suspensionReason: t.suspensionReason || null,
    activePacks: [],
    bootstrapRequestId: null,
    latestProvisioningRunId: null,
    createdBy: t.createdBy || null,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

/**
 * Normalize a real-backend bootstrap request row to the fixture-compatible shape.
 */
function normalizeBootstrapRequest(r) {
  return {
    bootstrapRequestId: r.id,
    tenantName: r.tenantName,
    legalMarketId: r.legalMarketId,
    organization: r.organization || null,
    status: r.status,
    packSelections: r.packSelections || null,
    validationResult: r.validationResult || null,
    submittedBy: r.submittedBy || null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/**
 * Normalize a real-backend provisioning run row to the fixture-compatible shape.
 */
function normalizeProvisioningRun(r) {
  return {
    provisioningRunId: r.id,
    bootstrapRequestId: r.bootstrapRequestId || null,
    tenantId: r.tenantId,
    status: r.status,
    steps: (r.steps || []).map(s => ({
      stepId: s.id || s.stepName,
      stepName: s.stepName,
      status: s.status,
      detail: s.detail || null,
      startedAt: s.startedAt || null,
      completedAt: s.completedAt || null,
    })),
    legalMarketId: null,
    effectivePlanId: null,
    correlationId: null,
    blockers: [],
    failures: [],
    createdBy: r.createdBy || null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    startedAt: r.createdAt,
    completedAt: r.updatedAt,
  };
}

export default function registerRoutes(server, fixtures, contractData, backendUrl) {
  // ── R1: listTenants (real-backend proxy with fixture fallback) ────────
  server.get(`${PREFIX}/tenants`, async (request, reply) => {
    if (backendUrl) {
      const qs = request.url.includes('?') ? request.url.split('?')[1] : '';
      const path = `${BACKEND_PREFIX}/tenants${qs ? '?' + qs : ''}`;
      const data = await backendFetch(backendUrl, path);
      if (data && data.ok) {
        const items = (data.tenants || []).map(normalizeTenant);
        return {
          _source: 'real-backend',
          items,
          pagination: {
            page: 1,
            pageSize: items.length || 20,
            totalItems: items.length,
            totalPages: 1,
          },
        };
      }
    }
    const fixtureData = stripProvenance(fixtures['tenants']);
    return { ...fixtureData, _source: 'fixture-fallback' };
  });

  // ── R2: getTenant (real-backend proxy with fixture fallback) ──────────
  server.get(`${PREFIX}/tenants/:tenantId`, async (request, reply) => {
    const { tenantId } = request.params;
    if (backendUrl) {
      const data = await backendFetch(backendUrl, `${BACKEND_PREFIX}/tenants/${encodeURIComponent(tenantId)}`);
      if (data && data.ok && data.tenant) {
        return { ...normalizeTenant(data.tenant), _source: 'real-backend' };
      }
    }
    const tenant = fixtures['tenants'].items.find(t => t.tenantId === tenantId);
    if (!tenant) {
      reply.code(404);
      return { error: 'not_found', message: `Tenant ${tenantId} not found` };
    }
    return { ...stripProvenance(tenant), _source: 'fixture-fallback' };
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

  // ── R5: listTenantBootstrapRequests (real-backend proxy with fixture fallback) ──
  server.get(`${PREFIX}/tenant-bootstrap-requests`, async (request, reply) => {
    if (backendUrl) {
      const qs = request.url.includes('?') ? request.url.split('?')[1] : '';
      const path = `${BACKEND_PREFIX}/bootstrap/requests${qs ? '?' + qs : ''}`;
      const data = await backendFetch(backendUrl, path);
      if (data && data.ok) {
        const items = (data.requests || []).map(normalizeBootstrapRequest);
        return {
          _source: 'real-backend',
          items,
          pagination: {
            page: 1,
            pageSize: items.length || 20,
            totalItems: items.length,
            totalPages: 1,
          },
        };
      }
    }
    const fixtureData = stripProvenance(fixtures['bootstrap-requests']);
    return { ...fixtureData, _source: 'fixture-fallback' };
  });

  // ── R6: getTenantBootstrapRequest (real-backend proxy with fixture fallback) ──
  server.get(`${PREFIX}/tenant-bootstrap-requests/:bootstrapRequestId`, async (request, reply) => {
    const { bootstrapRequestId } = request.params;
    if (backendUrl) {
      const data = await backendFetch(backendUrl, `${BACKEND_PREFIX}/bootstrap/requests/${encodeURIComponent(bootstrapRequestId)}`);
      if (data && data.ok && data.request) {
        return { ...normalizeBootstrapRequest(data.request), _source: 'real-backend' };
      }
    }
    const req = fixtures['bootstrap-requests'].items.find(
      b => b.bootstrapRequestId === bootstrapRequestId
    );
    if (!req) {
      reply.code(404);
      return { error: 'not_found', message: `Bootstrap request ${bootstrapRequestId} not found` };
    }
    return { ...stripProvenance(req), _source: 'fixture-fallback' };
  });

  // ── R7: listProvisioningRuns (real-backend proxy with fixture fallback) ──
  server.get(`${PREFIX}/provisioning-runs`, async (request, reply) => {
    if (backendUrl) {
      const qs = request.url.includes('?') ? request.url.split('?')[1] : '';
      const path = `${BACKEND_PREFIX}/provisioning/runs${qs ? '?' + qs : ''}`;
      const data = await backendFetch(backendUrl, path);
      if (data && data.ok) {
        const items = (data.runs || []).map(normalizeProvisioningRun);
        return {
          _source: 'real-backend',
          items,
          pagination: {
            page: 1,
            pageSize: items.length || 20,
            totalItems: items.length,
            totalPages: 1,
          },
        };
      }
    }
    const fixtureData = stripProvenance(fixtures['provisioning-runs']);
    return { ...fixtureData, _source: 'fixture-fallback' };
  });

  // ── R8: getProvisioningRun (real-backend proxy with fixture fallback) ──
  server.get(`${PREFIX}/provisioning-runs/:provisioningRunId`, async (request, reply) => {
    const { provisioningRunId } = request.params;
    if (backendUrl) {
      // Try with steps first for richer data
      const data = await backendFetch(backendUrl, `${BACKEND_PREFIX}/provisioning/runs/${encodeURIComponent(provisioningRunId)}/steps`);
      if (data && data.ok && data.run) {
        return { ...normalizeProvisioningRun(data.run), _source: 'real-backend' };
      }
      // Fallback to basic run
      const basic = await backendFetch(backendUrl, `${BACKEND_PREFIX}/provisioning/runs/${encodeURIComponent(provisioningRunId)}`);
      if (basic && basic.ok && basic.run) {
        return { ...normalizeProvisioningRun(basic.run), _source: 'real-backend' };
      }
    }
    const run = fixtures['provisioning-runs'].items.find(
      r => r.provisioningRunId === provisioningRunId
    );
    if (!run) {
      reply.code(404);
      return { error: 'not_found', message: `Provisioning run ${provisioningRunId} not found` };
    }
    return { ...stripProvenance(run), _source: 'fixture-fallback' };
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

  // ── Audit events (real-backend proxy) ───────────────────────────────────
  server.get(`${PREFIX}/audit/events`, async (request, reply) => {
    if (backendUrl) {
      const qs = request.url.includes('?') ? request.url.split('?')[1] : '';
      const path = `${BACKEND_PREFIX}/audit/events${qs ? '?' + qs : ''}`;
      const data = await backendFetch(backendUrl, path);
      if (data && data.ok) {
        return { ...data, _source: 'real-backend' };
      }
    }
    return {
      ok: true,
      events: [],
      _source: 'fixture-fallback',
      message: 'Start control-plane-api (4510) for live audit_event rows.',
    };
  });

  // ── Operator surfaces (read proxy to control-plane-api) ────────────────
  function opProxy(suffix, emptyPayload) {
    server.get(`${PREFIX}${suffix}`, async (request, reply) => {
      if (backendUrl) {
        const qs = request.url.includes('?') ? request.url.split('?')[1] : '';
        const path = `${BACKEND_PREFIX}${suffix}${qs ? '?' + qs : ''}`;
        const data = await backendFetch(backendUrl, path);
        if (data && data.ok) return { ...data, _source: 'real-backend' };
      }
      return {
        ok: true,
        ...emptyPayload,
        _source: 'fixture-fallback',
        message: 'Start control-plane-api for live PG-backed operator data.',
      };
    });
  }
  opProxy('/operator/invitations', { invitations: [] });
  opProxy('/operator/alerts', { alerts: [] });
  opProxy('/operator/usage-events', { events: [] });
  opProxy('/operator/entitlements', { entitlements: [] });
  opProxy('/operator/feature-flags', { flags: [] });
}
