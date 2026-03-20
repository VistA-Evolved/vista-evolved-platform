/**
 * Audit routes — HTTP handlers for audit event queries.
 *
 * Prefix: /api/control-plane-admin/v1/audit
 */
import { listAuditEvents } from '../repos/audit-repo.mjs';

export default async function auditRoutes(fastify) {
  const PREFIX = '/api/control-plane-admin/v1/audit';

  // GET /audit/events — list audit events
  fastify.get(`${PREFIX}/events`, async (request) => {
    const { eventType, entityType, entityId, limit, offset } = request.query || {};
    const events = await listAuditEvents({
      eventType,
      entityType,
      entityId,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
    return { ok: true, events };
  });
}
