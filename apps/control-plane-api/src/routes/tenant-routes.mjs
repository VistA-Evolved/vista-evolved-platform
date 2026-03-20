/**
 * Tenant routes — HTTP handlers for tenant lifecycle.
 *
 * Prefix: /api/control-plane-admin/v1/tenants
 */
import * as tenantService from '../services/tenant-service.mjs';

export default async function tenantRoutes(fastify) {
  const PREFIX = '/api/control-plane-admin/v1/tenants';

  // POST /tenants — create tenant draft
  fastify.post(PREFIX, async (request, reply) => {
    const { displayName, slug, legalMarketId, actor } = request.body || {};
    const result = await tenantService.createTenant({ displayName, slug, legalMarketId, actor });
    if (!result.ok) return reply.code(400).send(result);
    return reply.code(201).send(result);
  });

  // GET /tenants — list tenants
  fastify.get(PREFIX, async (request) => {
    const { status, legalMarketId, search, limit, offset } = request.query || {};
    return tenantService.listTenants({
      status, legalMarketId, search,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  });

  // GET /tenants/:id — get single tenant
  fastify.get(`${PREFIX}/:id`, async (request, reply) => {
    const result = await tenantService.getTenant(request.params.id);
    if (!result.ok) return reply.code(404).send(result);
    return result;
  });

  // POST /tenants/:id/activate — activate tenant
  fastify.post(`${PREFIX}/:id/activate`, async (request, reply) => {
    const { actor } = request.body || {};
    const result = await tenantService.activateTenant(request.params.id, { actor });
    if (!result.ok) return reply.code(result.reason?.includes('not found') ? 404 : 409).send(result);
    return result;
  });

  // POST /tenants/:id/suspend — suspend tenant
  fastify.post(`${PREFIX}/:id/suspend`, async (request, reply) => {
    const { reason, actor } = request.body || {};
    const result = await tenantService.suspendTenant(request.params.id, { reason, actor });
    if (!result.ok) return reply.code(result.reason?.includes('not found') ? 404 : 409).send(result);
    return result;
  });

  // POST /tenants/:id/reactivate — reactivate tenant
  fastify.post(`${PREFIX}/:id/reactivate`, async (request, reply) => {
    const { actor } = request.body || {};
    const result = await tenantService.reactivateTenant(request.params.id, { actor });
    if (!result.ok) return reply.code(result.reason?.includes('not found') ? 404 : 409).send(result);
    return result;
  });

  // POST /tenants/:id/archive — archive tenant
  fastify.post(`${PREFIX}/:id/archive`, async (request, reply) => {
    const { actor } = request.body || {};
    const result = await tenantService.archiveTenant(request.params.id, { actor });
    if (!result.ok) return reply.code(result.reason?.includes('not found') ? 404 : 409).send(result);
    return result;
  });

  // GET /tenants/:id/transitions — lifecycle transition history
  fastify.get(`${PREFIX}/:id/transitions`, async (request, reply) => {
    const result = await tenantService.getTenantHistory(request.params.id);
    if (!result.ok) return reply.code(404).send(result);
    return result;
  });
}
