/**
 * Provisioning routes — HTTP handlers for provisioning run lifecycle.
 *
 * Prefix: /api/control-plane-admin/v1/provisioning
 */
import * as provisioningService from '../services/provisioning-service.mjs';

export default async function provisioningRoutes(fastify) {
  const PREFIX = '/api/control-plane-admin/v1/provisioning';

  // POST /provisioning/runs — create run
  fastify.post(`${PREFIX}/runs`, async (request, reply) => {
    const { bootstrapRequestId, tenantId, actor } = request.body || {};
    const result = await provisioningService.createRun({ bootstrapRequestId, tenantId, actor });
    if (!result.ok) return reply.code(400).send(result);
    return reply.code(201).send(result);
  });

  // GET /provisioning/runs — list runs
  fastify.get(`${PREFIX}/runs`, async (request) => {
    const { status, limit, offset } = request.query || {};
    return provisioningService.listRuns({
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  });

  // GET /provisioning/runs/:id — get run
  fastify.get(`${PREFIX}/runs/:id`, async (request, reply) => {
    const result = await provisioningService.getRun(request.params.id);
    if (!result.ok) return reply.code(404).send(result);
    return result;
  });

  // GET /provisioning/runs/:id/steps — get run with steps
  fastify.get(`${PREFIX}/runs/:id/steps`, async (request, reply) => {
    const result = await provisioningService.getRunWithSteps(request.params.id);
    if (!result.ok) return reply.code(404).send(result);
    return result;
  });

  // POST /provisioning/runs/:id/queue — queue run for execution
  fastify.post(`${PREFIX}/runs/:id/queue`, async (request, reply) => {
    const { actor } = request.body || {};
    const result = await provisioningService.queueRun(request.params.id, { actor });
    if (!result.ok) {
      const code = result.reason?.includes('not found') ? 404 : 409;
      return reply.code(code).send(result);
    }
    return result;
  });

  // POST /provisioning/runs/:id/cancel — cancel run
  fastify.post(`${PREFIX}/runs/:id/cancel`, async (request, reply) => {
    const { actor, reason } = request.body || {};
    const result = await provisioningService.cancelRun(request.params.id, { actor, reason });
    if (!result.ok) {
      const code = result.reason?.includes('not found') ? 404 : 409;
      return reply.code(code).send(result);
    }
    return result;
  });
}
