/**
 * Read-only API routes for the control-plane operator console.
 *
 * Sourcing:
 *   Real-backend proxy (control-plane-api on port 4510):
 *     - R1/R2: tenants
 *     - R5/R6: bootstrap requests
 *     - R7/R8: provisioning runs
 *     - audit events, operator data
 *
 *   Contract-backed (from packages/contracts/):
 *     - R3/R4: legal market profiles
 *     - R9: packs
 *     - capabilities, effective-plans
 *
 * When the real backend is unreachable, proxy routes return
 * { ok: false, source: "unavailable" } instead of fake data.
 *
 * Base path: /api/control-plane/v1
 */

const PREFIX = '/api/control-plane/v1';
const BACKEND_PREFIX = '/api/control-plane-admin/v1';

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

const UNAVAILABLE = { ok: false, source: 'unavailable', message: 'Start control-plane-api on port 4510 for live data.' };

export default function registerRoutes(server, contractData, backendUrl) {
  // R1: listTenants (real-backend only)
  server.get(`${PREFIX}/tenants`, async (request, reply) => {
    if (backendUrl) {
      const qs = request.url.includes('?') ? request.url.split('?')[1] : '';
      const path = `${BACKEND_PREFIX}/tenants${qs ? '?' + qs : ''}`;
      const data = await backendFetch(backendUrl, path);
      if (data && data.ok) {
        const items = (data.tenants || []).map(normalizeTenant);
        return { _source: 'real-backend', items, pagination: { page: 1, pageSize: items.length || 20, totalItems: items.length, totalPages: 1 } };
      }
    }
    return UNAVAILABLE;
  });

  // R2: getTenant (real-backend only)
  server.get(`${PREFIX}/tenants/:tenantId`, async (request, reply) => {
    const { tenantId } = request.params;
    if (backendUrl) {
      const data = await backendFetch(backendUrl, `${BACKEND_PREFIX}/tenants/${encodeURIComponent(tenantId)}`);
      if (data && data.ok && data.tenant) {
        return { ...normalizeTenant(data.tenant), _source: 'real-backend' };
      }
    }
    reply.code(404);
    return { error: 'not_found', message: `Tenant ${tenantId} not found` };
  });

  // R3: listLegalMarketProfiles (contract-backed)
  server.get(`${PREFIX}/legal-market-profiles`, async () => contractData.legalMarketProfiles);

  // R4: getLegalMarketProfile (contract-backed)
  server.get(`${PREFIX}/legal-market-profiles/:legalMarketId`, async (request, reply) => {
    const market = contractData.legalMarketProfiles.items.find(m => m.legalMarketId === request.params.legalMarketId);
    if (!market) { reply.code(404); return { error: 'not_found' }; }
    return market;
  });

  // R5: listBootstrapRequests (real-backend only)
  server.get(`${PREFIX}/tenant-bootstrap-requests`, async (request, reply) => {
    if (backendUrl) {
      const qs = request.url.includes('?') ? request.url.split('?')[1] : '';
      const data = await backendFetch(backendUrl, `${BACKEND_PREFIX}/bootstrap/requests${qs ? '?' + qs : ''}`);
      if (data && data.ok) {
        const items = (data.requests || []).map(normalizeBootstrapRequest);
        return { _source: 'real-backend', items, pagination: { page: 1, pageSize: items.length || 20, totalItems: items.length, totalPages: 1 } };
      }
    }
    return UNAVAILABLE;
  });

  // R6: getBootstrapRequest (real-backend only)
  server.get(`${PREFIX}/tenant-bootstrap-requests/:bootstrapRequestId`, async (request, reply) => {
    const { bootstrapRequestId } = request.params;
    if (backendUrl) {
      const data = await backendFetch(backendUrl, `${BACKEND_PREFIX}/bootstrap/requests/${encodeURIComponent(bootstrapRequestId)}`);
      if (data && data.ok && data.request) {
        return { ...normalizeBootstrapRequest(data.request), _source: 'real-backend' };
      }
    }
    reply.code(404);
    return { error: 'not_found', message: `Bootstrap request ${bootstrapRequestId} not found` };
  });

  // R7: listProvisioningRuns (real-backend only)
  server.get(`${PREFIX}/provisioning-runs`, async (request, reply) => {
    if (backendUrl) {
      const qs = request.url.includes('?') ? request.url.split('?')[1] : '';
      const data = await backendFetch(backendUrl, `${BACKEND_PREFIX}/provisioning/runs${qs ? '?' + qs : ''}`);
      if (data && data.ok) {
        const items = (data.runs || []).map(normalizeProvisioningRun);
        return { _source: 'real-backend', items, pagination: { page: 1, pageSize: items.length || 20, totalItems: items.length, totalPages: 1 } };
      }
    }
    return UNAVAILABLE;
  });

  // R8: getProvisioningRun (real-backend only)
  server.get(`${PREFIX}/provisioning-runs/:provisioningRunId`, async (request, reply) => {
    const { provisioningRunId } = request.params;
    if (backendUrl) {
      const data = await backendFetch(backendUrl, `${BACKEND_PREFIX}/provisioning/runs/${encodeURIComponent(provisioningRunId)}/steps`);
      if (data && data.ok && data.run) {
        return { ...normalizeProvisioningRun(data.run), _source: 'real-backend' };
      }
      const basic = await backendFetch(backendUrl, `${BACKEND_PREFIX}/provisioning/runs/${encodeURIComponent(provisioningRunId)}`);
      if (basic && basic.ok && basic.run) {
        return { ...normalizeProvisioningRun(basic.run), _source: 'real-backend' };
      }
    }
    reply.code(404);
    return { error: 'not_found', message: `Provisioning run ${provisioningRunId} not found` };
  });

  // R9: listPacks (contract-backed with filters)
  server.get(`${PREFIX}/packs`, async (request) => {
    const { packFamily, lifecycleState, legalMarketId, search, page, pageSize } = request.query;
    let items = contractData.packCatalog.summaries;
    if (packFamily) items = items.filter(p => p.packFamily === packFamily);
    if (lifecycleState) items = items.filter(p => p.lifecycleState === lifecycleState);
    if (legalMarketId) items = items.filter(p => p.eligibleMarkets.includes(legalMarketId));
    if (search) {
      const term = search.toLowerCase();
      items = items.filter(p => p.packId.toLowerCase().includes(term) || p.displayName.toLowerCase().includes(term) || (p.description && p.description.toLowerCase().includes(term)));
    }
    const pg = Math.max(1, parseInt(page, 10) || 1);
    const ps = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
    const totalItems = items.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / ps));
    const start = (pg - 1) * ps;
    return { items: items.slice(start, start + ps), pagination: { page: pg, pageSize: ps, totalItems, totalPages } };
  });

  // R9b: getPack (contract-backed)
  server.get(`${PREFIX}/packs/:packId`, async (request, reply) => {
    const detail = contractData.packCatalog.detailIndex.get(request.params.packId);
    if (!detail) { reply.code(404); return { error: 'not_found' }; }
    return detail;
  });

  // R10: getSystemConfig (real-backend proxy)
  server.get(`${PREFIX}/system-config`, async () => {
    if (backendUrl) {
      const data = await backendFetch(backendUrl, `${BACKEND_PREFIX}/system-config`);
      if (data && data.ok) return { ...data, _source: 'real-backend' };
    }
    return { ok: true, _source: 'default', config: {
      identity: { provider: 'vista-xwb', oidcEnabled: false },
      environments: ['development'],
      provisioningDefaults: { topology: 'single-site' },
      retentionDays: 365,
    }};
  });

  // Supplementary: capabilities (contract-backed)
  server.get(`${PREFIX}/capabilities`, async () => contractData.capabilities);

  // Supplementary: effective-plans (contract-backed)
  server.get(`${PREFIX}/effective-plans`, async () => contractData.effectivePlans);

  // Audit events (real-backend proxy)
  server.get(`${PREFIX}/audit/events`, async (request) => {
    if (backendUrl) {
      const qs = request.url.includes('?') ? request.url.split('?')[1] : '';
      const data = await backendFetch(backendUrl, `${BACKEND_PREFIX}/audit/events${qs ? '?' + qs : ''}`);
      if (data && data.ok) return { ...data, _source: 'real-backend' };
    }
    return UNAVAILABLE;
  });

  // Operator surfaces (real-backend proxy)
  function opProxy(suffix, emptyPayload) {
    server.get(`${PREFIX}${suffix}`, async (request) => {
      if (backendUrl) {
        const qs = request.url.includes('?') ? request.url.split('?')[1] : '';
        const data = await backendFetch(backendUrl, `${BACKEND_PREFIX}${suffix}${qs ? '?' + qs : ''}`);
        if (data && data.ok) return { ...data, _source: 'real-backend' };
      }
      return UNAVAILABLE;
    });
  }
  opProxy('/operator/invitations', { invitations: [] });
  opProxy('/operator/alerts', { alerts: [] });
  opProxy('/operator/usage-events', { events: [] });
  opProxy('/operator/entitlements', { entitlements: [] });
  opProxy('/operator/feature-flags', { flags: [] });

  server.get(`${PREFIX}/billing/status`, async () => {
    if (backendUrl) {
      const data = await backendFetch(backendUrl, '/api/control-plane/v1/billing/status');
      if (data && data.ok) return { ...data, _source: 'real-backend' };
    }
    return { ok: true, billing: { configured: false, provider: 'lago', model: 'usage-based + subscription' }, _source: 'fallback' };
  });
}
