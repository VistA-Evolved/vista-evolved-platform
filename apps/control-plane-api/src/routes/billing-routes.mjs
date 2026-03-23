import {
  getBillingStatus, createCustomer, getCustomer,
  createSubscription, terminateSubscription,
  sendUsageEvent, listInvoices, getInvoice,
  verifyWebhookSignature,
} from '../services/billing-adapter.mjs';

export default async function billingRoutes(app) {
  app.get('/api/control-plane/v1/billing/status', async () => {
    return { ok: true, billing: getBillingStatus() };
  });

  app.get('/api/control-plane/v1/billing/customers/:tenantId', async (req, reply) => {
    const r = await getCustomer(req.params.tenantId);
    if (r.pending) return reply.code(503).send(r);
    if (!r.ok) return reply.code(r.status || 502).send(r);
    return { ok: true, customer: r.data?.customer || r.data };
  });

  app.post('/api/control-plane/v1/billing/customers', async (req, reply) => {
    const { tenantId, displayName, email } = req.body || {};
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId required' });
    const r = await createCustomer(tenantId, displayName || tenantId, email);
    if (r.pending) return reply.code(503).send(r);
    if (!r.ok) return reply.code(r.status || 502).send(r);
    return { ok: true, customer: r.data?.customer || r.data };
  });

  app.post('/api/control-plane/v1/billing/subscriptions', async (req, reply) => {
    const { tenantId, planCode } = req.body || {};
    if (!tenantId || !planCode) return reply.code(400).send({ ok: false, error: 'tenantId and planCode required' });
    const r = await createSubscription(tenantId, planCode);
    if (r.pending) return reply.code(503).send(r);
    if (!r.ok) return reply.code(r.status || 502).send(r);
    return { ok: true, subscription: r.data?.subscription || r.data };
  });

  app.delete('/api/control-plane/v1/billing/subscriptions/:externalId', async (req, reply) => {
    const r = await terminateSubscription(req.params.externalId);
    if (r.pending) return reply.code(503).send(r);
    if (!r.ok) return reply.code(r.status || 502).send(r);
    return { ok: true, terminated: true };
  });

  app.post('/api/control-plane/v1/billing/events', async (req, reply) => {
    const { tenantId, metricCode, quantity, properties } = req.body || {};
    if (!tenantId || !metricCode) return reply.code(400).send({ ok: false, error: 'tenantId and metricCode required' });
    const r = await sendUsageEvent(tenantId, metricCode, quantity || 1, properties);
    if (r.pending) return reply.code(503).send(r);
    if (!r.ok) return reply.code(r.status || 502).send(r);
    return { ok: true, event: r.data };
  });

  app.get('/api/control-plane/v1/billing/invoices', async (req, reply) => {
    const { tenantId } = req.query;
    if (!tenantId) return reply.code(400).send({ ok: false, error: 'tenantId query param required' });
    const r = await listInvoices(tenantId);
    if (r.pending) return reply.code(503).send(r);
    if (!r.ok) return reply.code(r.status || 502).send(r);
    return { ok: true, invoices: r.data?.invoices || [] };
  });

  app.get('/api/control-plane/v1/billing/invoices/:invoiceId', async (req, reply) => {
    const r = await getInvoice(req.params.invoiceId);
    if (r.pending) return reply.code(503).send(r);
    if (!r.ok) return reply.code(r.status || 502).send(r);
    return { ok: true, invoice: r.data?.invoice || r.data };
  });

  app.post('/api/control-plane/v1/billing/webhooks/lago', {
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
