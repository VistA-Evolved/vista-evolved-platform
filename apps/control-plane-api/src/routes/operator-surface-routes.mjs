/**
 * Operator surface routes — invitations, alerts, usage, commercial, feature flags.
 * Prefix: /api/control-plane-admin/v1/operator
 */
import { recordAuditEvent } from '../repos/audit-repo.mjs';
import {
  listInvitations,
  insertInvitation,
  listAlerts,
  insertAlert,
  acknowledgeAlert,
  listUsageEvents,
  insertUsageEvent,
  listEntitlements,
  insertEntitlementStub,
  listFeatureFlags,
  upsertFeatureFlag,
} from '../repos/operator-surface-repo.mjs';

const PREFIX = '/api/control-plane-admin/v1/operator';

export default async function operatorSurfaceRoutes(fastify) {
  fastify.get(`${PREFIX}/invitations`, async () => {
    const invitations = await listInvitations({ limit: 100, offset: 0 });
    return { ok: true, invitations };
  });

  fastify.post(`${PREFIX}/invitations`, async (request, reply) => {
    const body = request.body || {};
    const { email, tenantId, invitedBy, expiresAt } = body;
    if (!email || typeof email !== 'string') {
      return reply.code(400).send({ ok: false, error: 'email required' });
    }
    const actor = invitedBy || 'control-plane-api';
    const row = await insertInvitation({
      tenantId: tenantId || null,
      email: email.trim(),
      invitedBy: actor,
      expiresAt: expiresAt || null,
    });
    await recordAuditEvent({
      eventType: 'operator.invitation.created',
      entityType: 'operator_invitation',
      entityId: row.id,
      actor,
      detail: { email: email.trim(), tenantId: tenantId || null },
    });
    return {
      ok: true,
      invitation: { id: row.id, createdAt: row.createdAt },
      plainToken: row.plainToken,
      note: 'plainToken is shown once; store hash-only in DB.',
    };
  });

  fastify.get(`${PREFIX}/alerts`, async (request) => {
    const openOnly = request.query?.openOnly === '1' || request.query?.openOnly === 'true';
    const alerts = await listAlerts({ limit: 100, offset: 0, openOnly });
    return { ok: true, alerts };
  });

  fastify.post(`${PREFIX}/alerts`, async (request, reply) => {
    const body = request.body || {};
    if (!body.title || typeof body.title !== 'string') {
      return reply.code(400).send({ ok: false, error: 'title required' });
    }
    const actor = body.actor || 'control-plane-api';
    const row = await insertAlert({
      tenantId: body.tenantId || null,
      severity: body.severity || 'info',
      title: body.title,
      body: body.body || null,
    });
    await recordAuditEvent({
      eventType: 'operator.alert.created',
      entityType: 'operator_alert',
      entityId: row.id,
      actor,
      detail: { title: body.title, severity: body.severity || 'info' },
    });
    return { ok: true, alert: row };
  });

  fastify.post(`${PREFIX}/alerts/:id/ack`, async (request, reply) => {
    const updated = await acknowledgeAlert(request.params.id);
    if (!updated) return reply.code(404).send({ ok: false, error: 'alert not found or already acked' });
    await recordAuditEvent({
      eventType: 'operator.alert.acknowledged',
      entityType: 'operator_alert',
      entityId: request.params.id,
      actor: (request.body || {}).actor || 'control-plane-api',
      detail: {},
    });
    return { ok: true, alert: updated };
  });

  fastify.get(`${PREFIX}/usage-events`, async () => {
    const events = await listUsageEvents({ limit: 200, offset: 0 });
    return { ok: true, events };
  });

  fastify.post(`${PREFIX}/usage-events`, async (request, reply) => {
    const body = request.body || {};
    if (!body.metricName || typeof body.metricName !== 'string') {
      return reply.code(400).send({ ok: false, error: 'metricName required' });
    }
    const row = await insertUsageEvent({
      tenantId: body.tenantId || null,
      metricName: body.metricName,
      quantity: body.quantity,
      detail: body.detail || null,
    });
    return { ok: true, event: row };
  });

  fastify.get(`${PREFIX}/entitlements`, async () => {
    const entitlements = await listEntitlements({ limit: 100, offset: 0 });
    return { ok: true, entitlements };
  });

  fastify.post(`${PREFIX}/entitlements`, async (request, reply) => {
    const body = request.body || {};
    if (!body.tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const row = await insertEntitlementStub({
      tenantId: body.tenantId,
      sku: body.sku,
      billingProvider: body.billingProvider,
      meta: body.meta || null,
    });
    await recordAuditEvent({
      eventType: 'commercial.entitlement.stub_created',
      entityType: 'commercial_entitlement',
      entityId: row.id,
      actor: body.actor || 'control-plane-api',
      detail: { sku: row.sku, tenantId: body.tenantId },
    });
    return { ok: true, entitlement: row };
  });

  fastify.get(`${PREFIX}/feature-flags`, async () => {
    const flags = await listFeatureFlags();
    return { ok: true, flags };
  });

  fastify.put(`${PREFIX}/feature-flags`, async (request, reply) => {
    const body = request.body || {};
    if (!body.flagKey) return reply.code(400).send({ ok: false, error: 'flagKey required' });
    const row = await upsertFeatureFlag({
      flagKey: body.flagKey,
      environment: body.environment,
      enabled: body.enabled,
      meta: body.meta || null,
    });
    await recordAuditEvent({
      eventType: 'operator.feature_flag.upserted',
      entityType: 'environment_feature_flag',
      entityId: row.id,
      actor: body.actor || 'control-plane-api',
      detail: { flagKey: row.flagKey, environment: row.environment, enabled: row.enabled },
    });
    return { ok: true, flag: row };
  });
}
