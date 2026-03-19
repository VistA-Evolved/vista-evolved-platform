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
import { resolveEffectivePlan, RESOLVER_VERSION } from '../lib/plan-resolver.mjs';

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

export default function registerReviewRoutes(server, contractData) {
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
  // W4 — resolver-backed effective configuration plan resolution
  server.post(`${PREFIX}/effective-configuration-plans/resolve`, async (request, reply) => {
    const body = request.body || {};
    const actionKey = 'resolveEffectiveConfigurationPlan';

    // Standard review validation
    const validation = validateReviewRequest(actionKey, body, {});
    const envelope = buildReviewEnvelope(actionKey, body, {}, validation);

    // Run the real resolver if validation passed and contractData available
    if (validation.valid && contractData) {
      const result = resolveEffectivePlan(contractData, {
        legalMarketId: body.legalMarketId,
        selectedPacks: body.selectedPacks || [],
        deselectedDefaults: body.deselectedDefaults || [],
        facilityType: body.facilityType || '',
        tenantDisplayName: body.tenantDisplayName || '',
      });
      envelope.resolutionPreview = result.ok ? result.resolution : null;
      envelope.resolutionError = result.ok ? null : result.error;
      envelope.resolverVersion = RESOLVER_VERSION;
    }

    return envelope;
  });

  // W5 — bootstrap request with resolver preflight
  server.post(`${PREFIX}/tenant-bootstrap-requests`, async (request, reply) => {
    const body = request.body || {};
    const actionKey = 'createTenantBootstrapRequest';

    const validation = validateReviewRequest(actionKey, body, {});
    const envelope = buildReviewEnvelope(actionKey, body, {}, validation);

    // Preflight: if the body includes legalMarketId, run resolver for context
    if (contractData && body.legalMarketId) {
      const result = resolveEffectivePlan(contractData, {
        legalMarketId: body.legalMarketId,
        selectedPacks: body.selectedPacks || [],
        deselectedDefaults: body.deselectedDefaults || [],
        facilityType: body.facilityType || '',
      });
      envelope.resolverPreflight = {
        resolverVersion: RESOLVER_VERSION,
        marketFound: result.ok,
        resolvedPackCount: result.resolution?.resolvedPacks?.length ?? 0,
        deferredItemCount: result.resolution?.deferredItems?.length ?? 0,
        gatingBlockerCount: result.resolution?.readinessPosture?.gatingBlockers?.length ?? 0,
        effectiveLaunchTier: result.resolution?.readinessPosture?.effectiveLaunchTier ?? 'unknown',
      };
    }

    return envelope;
  });

  // W6 — provisioning run with resolver preflight
  server.post(`${PREFIX}/provisioning-runs`, async (request, reply) => {
    const body = request.body || {};
    const actionKey = 'createProvisioningRun';

    const validation = validateReviewRequest(actionKey, body, {});
    const envelope = buildReviewEnvelope(actionKey, body, {}, validation);

    // Preflight: provisioning requires a non-empty gating blocker check
    envelope.resolverPreflight = {
      resolverVersion: RESOLVER_VERSION,
      note: 'Provisioning run depends on an approved bootstrap request which references a resolved plan. Full resolver preflight runs at bootstrap time.',
    };

    return envelope;
  });

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
