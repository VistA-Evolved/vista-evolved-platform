/**
 * Lago billing adapter — wraps Lago REST API for subscription and usage billing.
 *
 * Lago is self-hosted. The adapter communicates via Lago's REST API:
 *   - Customers (tenant mapping)
 *   - Subscriptions (plan assignment)
 *   - Events (usage metering)
 *   - Invoices (billing output)
 *   - Wallets (prepaid credit)
 *
 * Env vars:
 *   LAGO_API_URL   — e.g. http://lago-api:3000/api/v1
 *   LAGO_API_KEY   — Lago organization API key
 *
 * When LAGO_API_URL is not set, the adapter returns { ok: false, pending: true }
 * for all operations — no silent fakes.
 */

const LAGO_API_URL = process.env.LAGO_API_URL || '';
const LAGO_API_KEY = process.env.LAGO_API_KEY || '';

function isConfigured() {
  return !!(LAGO_API_URL && LAGO_API_KEY);
}

async function lagoFetch(path, options = {}) {
  if (!isConfigured()) {
    return { ok: false, pending: true, error: 'Lago not configured (LAGO_API_URL / LAGO_API_KEY)' };
  }
  const url = `${LAGO_API_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${LAGO_API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { ok: false, status: res.status, error: body || res.statusText };
  }
  const data = await res.json().catch(() => ({}));
  return { ok: true, data };
}

export async function createCustomer(tenantId, displayName, email) {
  return lagoFetch('/customers', {
    method: 'POST',
    body: JSON.stringify({
      customer: {
        external_id: tenantId,
        name: displayName,
        email: email || `billing+${tenantId}@vista-evolved.io`,
      },
    }),
  });
}

export async function getCustomer(tenantId) {
  return lagoFetch(`/customers/${encodeURIComponent(tenantId)}`);
}

export async function createSubscription(tenantId, planCode) {
  return lagoFetch('/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      subscription: {
        external_customer_id: tenantId,
        plan_code: planCode,
        external_id: `${tenantId}-${planCode}`,
      },
    }),
  });
}

export async function terminateSubscription(subscriptionExternalId) {
  return lagoFetch(`/subscriptions/${encodeURIComponent(subscriptionExternalId)}`, {
    method: 'DELETE',
  });
}

export async function sendUsageEvent(tenantId, metricCode, quantity, properties = {}) {
  return lagoFetch('/events', {
    method: 'POST',
    body: JSON.stringify({
      event: {
        transaction_id: `${tenantId}-${metricCode}-${Date.now()}`,
        external_customer_id: tenantId,
        code: metricCode,
        properties: { ...properties, quantity: String(quantity) },
      },
    }),
  });
}

export async function listInvoices(tenantId) {
  return lagoFetch(`/invoices?external_customer_id=${encodeURIComponent(tenantId)}`);
}

export async function getInvoice(invoiceId) {
  return lagoFetch(`/invoices/${encodeURIComponent(invoiceId)}`);
}

export function getBillingStatus() {
  return {
    configured: isConfigured(),
    provider: 'lago',
    version: 'v1.44.0',
    apiUrl: LAGO_API_URL ? LAGO_API_URL.replace(/\/api\/v1$/, '') : null,
    model: 'usage-based + subscription',
    webhookConfigured: !!process.env.LAGO_WEBHOOK_SECRET,
  };
}

export function verifyWebhookSignature(payload, signature) {
  const secret = process.env.LAGO_WEBHOOK_SECRET;
  if (!secret) return false;
  const crypto = globalThis.crypto || require('node:crypto');
  const hmac = require('node:crypto').createHmac('sha256', secret);
  hmac.update(payload);
  const expected = hmac.digest('hex');
  return expected === signature;
}
