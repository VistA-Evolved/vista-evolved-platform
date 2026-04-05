import {
  getBillingStatus, createCustomer, getCustomer,
  createSubscription, terminateSubscription,
  sendUsageEvent, listInvoices, getInvoice,
  verifyWebhookSignature,
} from '../services/billing-adapter.mjs';

// Prefix aligned with all other control-plane routes: /api/control-plane-admin/v1/
const BILLING_PREFIX = '/api/control-plane-admin/v1/billing';

export default async function billingRoutes(app) {
  app.get(`${BILLING_PREFIX}/status`, async () => {
    return { ok: true, billing: getBillingStatus() };
  });

  app.get(`${BILLING_PREFIX}/customers/:tenantId`, async (req, reply) => {
    const r = await getCustomer(req.params.tenantId);
    if (r.pending) return reply.code(503).send(r);
    if (!r.ok) return reply.code(r.status || 502).send(r);
    return { ok: true, customer: r.data?.customer || r.data };
  });

  app.post(`${BILLING_PREFIX}/customers`, async (req, reply) => {
    const { tenantId, displayName, email } = req.body || {};
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const r = await createCustomer(tenantId, displayName || tenantId, email);
    if (r.pending) return reply.code(503).send(r);
    if (!r.ok) return reply.code(r.status || 502).send(r);
    return { ok: true, customer: r.data?.customer || r.data };
  });

  app.post(`${BILLING_PREFIX}/subscriptions`, async (req, reply) => {
    const { tenantId, planCode } = req.body || {};
    if (!tenantId || !planCode) return reply.code(400).send({ ok: false, error: 'tenantId and planCode required' });
    const r = await createSubscription(tenantId, planCode);
    if (r.pending) return reply.code(503).send(r);
    if (!r.ok) return reply.code(r.status || 502).send(r);
    return { ok: true, subscription: r.data?.subscription || r.data };
  });

  app.delete(`${BILLING_PREFIX}/subscriptions/:externalId`, async (req, reply) => {
    const r = await terminateSubscription(req.params.externalId);
    if (r.pending) return reply.code(503).send(r);
    if (!r.ok) return reply.code(r.status || 502).send(r);
    return { ok: true, terminated: true };
  });

  app.post(`${BILLING_PREFIX}/events`, async (req, reply) => {
    const { tenantId, metricCode, quantity, properties } = req.body || {};
    if (!tenantId || !metricCode) return reply.code(400).send({ ok: false, error: 'tenantId and metricCode required' });
    const r = await sendUsageEvent(tenantId, metricCode, quantity || 1, properties);
    if (r.pending) return reply.code(503).send(r);
    if (!r.ok) return reply.code(r.status || 502).send(r);
    return { ok: true, event: r.data };
  });

  app.get(`${BILLING_PREFIX}/invoices`, async (req, reply) => {
    const { tenantId } = req.query;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId query param required' });
    const r = await listInvoices(tenantId);
    if (r.pending) return reply.code(503).send(r);
    if (!r.ok) return reply.code(r.status || 502).send(r);
    return { ok: true, invoices: r.data?.invoices || [] };
  });

  app.get(`${BILLING_PREFIX}/invoices/:invoiceId`, async (req, reply) => {
    const r = await getInvoice(req.params.invoiceId);
    if (r.pending) return reply.code(503).send(r);
    if (!r.ok) return reply.code(r.status || 502).send(r);
    return { ok: true, invoice: r.data?.invoice || r.data };
  });

  app.post(`${BILLING_PREFIX}/webhooks/lago`, {
    config: { rawBody: true },
  }, async (req, reply) => {
    const signature = req.headers['x-lago-signature'] || '';
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (!verifyWebhookSignature(rawBody, signature)) {
      return reply.code(401).send({ ok: false, error: 'Invalid webhook signature' });
    }
    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const eventType = event?.webhook_type || event?.event_type || 'unknown';
    console.log(`[billing-webhook] Received Lago event: ${eventType}`);
    return { ok: true, received: eventType };
  });
}
