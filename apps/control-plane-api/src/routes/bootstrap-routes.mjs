/**
 * Bootstrap routes — HTTP handlers for draft editing, validation, submission, approval.
 *
 * Prefix: /api/control-plane-admin/v1/bootstrap
 */
import * as bootstrapService from '../services/bootstrap-service.mjs';

export default async function bootstrapRoutes(fastify) {
  const PREFIX = '/api/control-plane-admin/v1/bootstrap';

  // ---- Drafts ----

  // POST /bootstrap/drafts — create new draft
  fastify.post(`${PREFIX}/drafts`, async (request, reply) => {
    const { tenantName, legalMarketId, organization, packSelections, notes, actor } = request.body || {};
    const result = await bootstrapService.createDraft({
      tenantName, legalMarketId, organization, packSelections, notes, actor,
    });
    if (!result.ok) return reply.code(400).send(result);
    return reply.code(201).send(result);
  });

  // GET /bootstrap/drafts/:id — get draft
  fastify.get(`${PREFIX}/drafts/:id`, async (request, reply) => {
    const result = await bootstrapService.getDraft(request.params.id);
    if (!result.ok) return reply.code(404).send(result);
    return result;
  });

  // PATCH /bootstrap/drafts/:id — update draft fields
  fastify.patch(`${PREFIX}/drafts/:id`, async (request, reply) => {
    const { actor, ...fields } = request.body || {};
    const result = await bootstrapService.updateDraft(request.params.id, { fields, actor });
    if (!result.ok) {
      const code = result.reason?.includes('not found') ? 404 : 409;
      return reply.code(code).send(result);
    }
    return result;
  });

  // POST /bootstrap/drafts/:id/validate — validate draft
  fastify.post(`${PREFIX}/drafts/:id/validate`, async (request, reply) => {
    const { actor } = request.body || {};
    const result = await bootstrapService.validateDraft(request.params.id, { actor });
    if (!result.ok) {
      const code = result.reason?.includes('not found') ? 404 : result.errors ? 422 : 409;
      return reply.code(code).send(result);
    }
    return result;
  });

  // POST /bootstrap/drafts/:id/submit — submit for approval
  fastify.post(`${PREFIX}/drafts/:id/submit`, async (request, reply) => {
    const { actor } = request.body || {};
    const result = await bootstrapService.submitForApproval(request.params.id, { actor });
    if (!result.ok) {
      const code = result.reason?.includes('not found') ? 404 : 409;
      return reply.code(code).send(result);
    }
    return reply.code(201).send(result);
  });

  // ---- Requests ----

  // GET /bootstrap/requests — list requests
  fastify.get(`${PREFIX}/requests`, async (request) => {
    const { status, limit, offset } = request.query || {};
    return bootstrapService.listRequests({
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  });

  // GET /bootstrap/requests/:id — get single request
  fastify.get(`${PREFIX}/requests/:id`, async (request, reply) => {
    const result = await bootstrapService.getRequest(request.params.id);
    if (!result.ok) return reply.code(404).send(result);
    return result;
  });

  // POST /bootstrap/requests/:id/approve — approve request
  fastify.post(`${PREFIX}/requests/:id/approve`, async (request, reply) => {
    const { actor, reason } = request.body || {};
    const result = await bootstrapService.approveRequest(request.params.id, { actor, reason });
    if (!result.ok) {
      const code = result.reason?.includes('not found') ? 404 : 409;
      return reply.code(code).send(result);
    }
    return result;
  });

  // POST /bootstrap/requests/:id/cancel — cancel request
  fastify.post(`${PREFIX}/requests/:id/cancel`, async (request, reply) => {
    const { actor, reason } = request.body || {};
    const result = await bootstrapService.cancelRequest(request.params.id, { actor, reason });
    if (!result.ok) {
      const code = result.reason?.includes('not found') ? 404 : 409;
      return reply.code(code).send(result);
    }
    return result;
  });
}
