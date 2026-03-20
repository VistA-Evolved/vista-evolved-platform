/**
 * Copilot API Routes — governed AI operator assistant endpoints.
 *
 * Base path: /api/copilot/v1
 *
 * Endpoints:
 *   GET  /status  — copilot operational status (always available)
 *   POST /chat    — send a message, receive response + tool results
 *   GET  /audit   — copilot interaction audit trail (admin)
 *
 * The copilot is DISABLED by default (COPILOT_ENABLED=false).
 * When disabled, /status returns the reason; /chat returns 503.
 *
 * No PHI. No destructive actions. Read-only + draft-only tools only.
 */

import { getCopilotStatus, chat } from '../copilot/copilot-service.mjs';
import { getAuditLog } from '../copilot/audit.mjs';

const PREFIX = '/api/copilot/v1';

export default function registerCopilotRoutes(server, fixtures, contractData, backendUrl) {
  // ── GET /status — always returns copilot health ───────────────────────
  server.get(`${PREFIX}/status`, async () => {
    return getCopilotStatus();
  });

  // ── POST /chat — send operator message ────────────────────────────────
  server.post(`${PREFIX}/chat`, async (request, reply) => {
    const status = getCopilotStatus();
    if (!status.operational) {
      return reply.code(503).send({
        ok: false,
        error: 'copilot_unavailable',
        reason: status.statusLabel,
        message: 'Copilot is not operational. Set COPILOT_ENABLED=true and configure a provider.',
      });
    }

    const { message, history } = request.body || {};
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return reply.code(400).send({
        ok: false,
        error: 'invalid_request',
        message: 'Request body must include a non-empty "message" string.',
      });
    }

    // Build tool context — tools can access real backend, fixtures, contracts
    const toolContext = {
      backendUrl,
      fixtures,
      contractData,
    };

    const result = await chat({
      message: message.trim(),
      history: Array.isArray(history) ? history : [],
      toolContext,
    });

    return { ok: true, ...result };
  });

  // ── GET /audit — copilot audit trail ──────────────────────────────────
  server.get(`${PREFIX}/audit`, async (request) => {
    const limit = Math.min(parseInt(request.query.limit || '50', 10) || 50, 500);
    const entries = getAuditLog(limit);
    return {
      ok: true,
      count: entries.length,
      entries,
    };
  });
}
