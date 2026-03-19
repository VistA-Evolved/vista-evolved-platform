/**
 * LOCAL REVIEW-ONLY write routes for the control-plane review runtime.
 *
 * These routes are NOT canonical runtime APIs. They exist solely for local
 * review and validation of contracted write actions.
 *
 * Canonical write operations are defined in:
 *   packages/contracts/openapi/control-plane-operator-bootstrap-and-provisioning.openapi.yaml
 *
 * Base path: /api/control-plane-review/v1
 *
 * Every response:
 *   - mode: "local-review"
 *   - executed: false
 *   - persistence: "none"
 *   - No fixture mutation, no in-memory state mutation, no side effects.
 */

import { REVIEW_ACTIONS, validateReviewRequest, buildReviewEnvelope } from '../review-action-map.mjs';

const PREFIX = '/api/control-plane-review/v1';

/**
 * Generic review handler factory.
 * Validates the request body, builds the review envelope, returns it.
 */
function reviewHandler(actionKey, extractParams) {
  return async (request, reply) => {
    const pathParams = extractParams ? extractParams(request) : {};
    const body = request.body || {};
    const validation = validateReviewRequest(actionKey, body, pathParams);
    const envelope = buildReviewEnvelope(actionKey, body, pathParams, validation);
    return envelope;
  };
}

export default function registerReviewRoutes(server) {
  // ── Tenant Lifecycle ─────────────────────────────────────────────────
  server.post(`${PREFIX}/tenants/:tenantId/suspend`, reviewHandler(
    'suspendTenant',
    (req) => ({ tenantId: req.params.tenantId })
  ));

  server.post(`${PREFIX}/tenants/:tenantId/reactivate`, reviewHandler(
    'reactivateTenant',
    (req) => ({ tenantId: req.params.tenantId })
  ));

  server.post(`${PREFIX}/tenants/:tenantId/archive`, reviewHandler(
    'archiveTenant',
    (req) => ({ tenantId: req.params.tenantId })
  ));

  // ── Bootstrap & Provisioning ─────────────────────────────────────────
  server.post(`${PREFIX}/effective-configuration-plans/resolve`, reviewHandler(
    'resolveEffectiveConfigurationPlan'
  ));

  server.post(`${PREFIX}/tenant-bootstrap-requests`, reviewHandler(
    'createTenantBootstrapRequest'
  ));

  server.post(`${PREFIX}/provisioning-runs`, reviewHandler(
    'createProvisioningRun'
  ));

  server.post(`${PREFIX}/provisioning-runs/:provisioningRunId/cancel`, reviewHandler(
    'cancelProvisioningRun',
    (req) => ({ provisioningRunId: req.params.provisioningRunId })
  ));

  // ── Market Profile Authoring ─────────────────────────────────────────
  server.post(`${PREFIX}/legal-market-profiles`, reviewHandler(
    'createLegalMarketProfileDraft'
  ));

  server.put(`${PREFIX}/legal-market-profiles/:legalMarketId`, reviewHandler(
    'updateLegalMarketProfileDraft',
    (req) => ({ legalMarketId: req.params.legalMarketId })
  ));

  server.post(`${PREFIX}/legal-market-profiles/:legalMarketId/submit-review`, reviewHandler(
    'submitLegalMarketProfileForReview',
    (req) => ({ legalMarketId: req.params.legalMarketId })
  ));

  // ── Pack Manifest Authoring ──────────────────────────────────────────
  server.post(`${PREFIX}/packs`, reviewHandler(
    'createPackManifestDraft'
  ));

  server.put(`${PREFIX}/packs/:packId`, reviewHandler(
    'updatePackManifestDraft',
    (req) => ({ packId: req.params.packId })
  ));

  server.post(`${PREFIX}/packs/:packId/submit-review`, reviewHandler(
    'submitPackManifestForReview',
    (req) => ({ packId: req.params.packId })
  ));

  // ── System Configuration ─────────────────────────────────────────────
  server.put(`${PREFIX}/system-config/feature-flags/:flagKey`, reviewHandler(
    'updateFeatureFlag',
    (req) => ({ flagKey: req.params.flagKey })
  ));

  server.put(`${PREFIX}/system-config/parameters/:paramKey`, reviewHandler(
    'updateSystemParameter',
    (req) => ({ paramKey: req.params.paramKey })
  ));

  // ── Discovery: list all available review actions ─────────────────────
  server.get(`${PREFIX}/actions`, async () => {
    return {
      mode: 'local-review',
      description: 'All contracted write actions available for local review simulation',
      actions: Object.entries(REVIEW_ACTIONS).map(([key, action]) => ({
        actionKey: key,
        operationId: action.operationId,
        httpMethod: action.httpMethod,
        canonicalPath: action.canonicalPath,
        surface: action.surface,
        actionClass: action.actionClass,
        requiredFields: Object.keys(action.requiredFields),
        projectedEvents: action.projectedEvents,
      })),
    };
  });
}
