/**
 * P0 Lifecycle Proxy Routes — Real backend write operations.
 *
 * These routes proxy lifecycle mutations to the real control-plane-api backend
 * (port 4510 by default). They replace the review-only simulation for the
 * graduated P0 surfaces: tenants, bootstrap, provisioning.
 *
 * Base path: /api/control-plane-lifecycle/v1
 *
 * When the real backend is unreachable, returns { ok: false, _source: 'backend-unreachable' }.
 */

const PREFIX = '/api/control-plane-lifecycle/v1';
const BACKEND_PREFIX = '/api/control-plane-admin/v1';

/**
 * Proxy a JSON request to the real backend.
 * Returns the parsed response or an error envelope.
 */
async function proxyToBackend(backendUrl, method, path, body) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const opts = {
      method,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body !== undefined) {
      opts.body = JSON.stringify(body);
    }
    const resp = await fetch(`${backendUrl}${path}`, opts);
    clearTimeout(timeout);
    const data = await resp.json();
    return { status: resp.status, data: { ...data, _source: 'real-backend' } };
  } catch {
    return {
      status: 503,
      data: {
        ok: false,
        _source: 'backend-unreachable',
        message: 'Real backend (control-plane-api) is not reachable. Start it with: node --env-file=.env src/server.mjs',
      },
    };
  }
}

export default function registerLifecycleRoutes(server, backendUrl) {
  // ── Tenant Lifecycle ──────────────────────────────────────────────────

  // Create tenant draft
  server.post(`${PREFIX}/tenants`, async (request, reply) => {
    const { status, data } = await proxyToBackend(
      backendUrl, 'POST', `${BACKEND_PREFIX}/tenants`, request.body
    );
    return reply.code(status).send(data);
  });

  // Activate tenant
  server.post(`${PREFIX}/tenants/:id/activate`, async (request, reply) => {
    const { status, data } = await proxyToBackend(
      backendUrl, 'POST', `${BACKEND_PREFIX}/tenants/${encodeURIComponent(request.params.id)}/activate`, request.body
    );
    return reply.code(status).send(data);
  });

  // Suspend tenant
  server.post(`${PREFIX}/tenants/:id/suspend`, async (request, reply) => {
    const { status, data } = await proxyToBackend(
      backendUrl, 'POST', `${BACKEND_PREFIX}/tenants/${encodeURIComponent(request.params.id)}/suspend`, request.body
    );
    return reply.code(status).send(data);
  });

  // Reactivate tenant
  server.post(`${PREFIX}/tenants/:id/reactivate`, async (request, reply) => {
    const { status, data } = await proxyToBackend(
      backendUrl, 'POST', `${BACKEND_PREFIX}/tenants/${encodeURIComponent(request.params.id)}/reactivate`, request.body
    );
    return reply.code(status).send(data);
  });

  // Archive tenant
  server.post(`${PREFIX}/tenants/:id/archive`, async (request, reply) => {
    const { status, data } = await proxyToBackend(
      backendUrl, 'POST', `${BACKEND_PREFIX}/tenants/${encodeURIComponent(request.params.id)}/archive`, request.body
    );
    return reply.code(status).send(data);
  });

  // Tenant transition history
  server.get(`${PREFIX}/tenants/:id/transitions`, async (request, reply) => {
    const { status, data } = await proxyToBackend(
      backendUrl, 'GET', `${BACKEND_PREFIX}/tenants/${encodeURIComponent(request.params.id)}/transitions`
    );
    return reply.code(status).send(data);
  });

  // ── Bootstrap Lifecycle ───────────────────────────────────────────────

  // Create bootstrap draft
  server.post(`${PREFIX}/bootstrap/drafts`, async (request, reply) => {
    const { status, data } = await proxyToBackend(
      backendUrl, 'POST', `${BACKEND_PREFIX}/bootstrap/drafts`, request.body
    );
    return reply.code(status).send(data);
  });

  // Validate draft
  server.post(`${PREFIX}/bootstrap/drafts/:id/validate`, async (request, reply) => {
    const { status, data } = await proxyToBackend(
      backendUrl, 'POST', `${BACKEND_PREFIX}/bootstrap/drafts/${encodeURIComponent(request.params.id)}/validate`, request.body
    );
    return reply.code(status).send(data);
  });

  // Submit draft for approval
  server.post(`${PREFIX}/bootstrap/drafts/:id/submit`, async (request, reply) => {
    const { status, data } = await proxyToBackend(
      backendUrl, 'POST', `${BACKEND_PREFIX}/bootstrap/drafts/${encodeURIComponent(request.params.id)}/submit`, request.body
    );
    return reply.code(status).send(data);
  });

  // Approve bootstrap request
  server.post(`${PREFIX}/bootstrap/requests/:id/approve`, async (request, reply) => {
    const { status, data } = await proxyToBackend(
      backendUrl, 'POST', `${BACKEND_PREFIX}/bootstrap/requests/${encodeURIComponent(request.params.id)}/approve`, request.body
    );
    return reply.code(status).send(data);
  });

  // Cancel bootstrap request
  server.post(`${PREFIX}/bootstrap/requests/:id/cancel`, async (request, reply) => {
    const { status, data } = await proxyToBackend(
      backendUrl, 'POST', `${BACKEND_PREFIX}/bootstrap/requests/${encodeURIComponent(request.params.id)}/cancel`, request.body
    );
    return reply.code(status).send(data);
  });

  // ── Provisioning Lifecycle ────────────────────────────────────────────

  // Create provisioning run
  server.post(`${PREFIX}/provisioning/runs`, async (request, reply) => {
    const { status, data } = await proxyToBackend(
      backendUrl, 'POST', `${BACKEND_PREFIX}/provisioning/runs`, request.body
    );
    return reply.code(status).send(data);
  });

  // Queue provisioning run
  server.post(`${PREFIX}/provisioning/runs/:id/queue`, async (request, reply) => {
    const { status, data } = await proxyToBackend(
      backendUrl, 'POST', `${BACKEND_PREFIX}/provisioning/runs/${encodeURIComponent(request.params.id)}/queue`, request.body
    );
    return reply.code(status).send(data);
  });

  // Cancel provisioning run
  server.post(`${PREFIX}/provisioning/runs/:id/cancel`, async (request, reply) => {
    const { status, data } = await proxyToBackend(
      backendUrl, 'POST', `${BACKEND_PREFIX}/provisioning/runs/${encodeURIComponent(request.params.id)}/cancel`, request.body
    );
    return reply.code(status).send(data);
  });

  // ── Operator surfaces (PG-backed control-plane-api) ─────────────────────

  server.post(`${PREFIX}/operator/invitations`, async (request, reply) => {
    const { status, data } = await proxyToBackend(
      backendUrl, 'POST', `${BACKEND_PREFIX}/operator/invitations`, request.body
    );
    return reply.code(status).send(data);
  });

  server.post(`${PREFIX}/operator/alerts`, async (request, reply) => {
    const { status, data } = await proxyToBackend(
      backendUrl, 'POST', `${BACKEND_PREFIX}/operator/alerts`, request.body
    );
    return reply.code(status).send(data);
  });

  server.post(`${PREFIX}/operator/alerts/:id/ack`, async (request, reply) => {
    const { status, data } = await proxyToBackend(
      backendUrl, 'POST', `${BACKEND_PREFIX}/operator/alerts/${encodeURIComponent(request.params.id)}/ack`, request.body
    );
    return reply.code(status).send(data);
  });

  server.post(`${PREFIX}/operator/usage-events`, async (request, reply) => {
    const { status, data } = await proxyToBackend(
      backendUrl, 'POST', `${BACKEND_PREFIX}/operator/usage-events`, request.body
    );
    return reply.code(status).send(data);
  });

  server.post(`${PREFIX}/operator/entitlements`, async (request, reply) => {
    const { status, data } = await proxyToBackend(
      backendUrl, 'POST', `${BACKEND_PREFIX}/operator/entitlements`, request.body
    );
    return reply.code(status).send(data);
  });

  server.put(`${PREFIX}/operator/feature-flags`, async (request, reply) => {
    const { status, data } = await proxyToBackend(
      backendUrl, 'PUT', `${BACKEND_PREFIX}/operator/feature-flags`, request.body
    );
    return reply.code(status).send(data);
  });
}
