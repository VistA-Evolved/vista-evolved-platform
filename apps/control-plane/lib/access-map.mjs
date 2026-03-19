/**
 * Route/Action Access Map — LOCAL REVIEW RUNTIME ONLY
 *
 * Explicit mapping from every current control-plane API route to:
 *   - canonical surface ID (from screen-inventory.md)
 *   - action class (from action-semantics batch-1)
 *   - allowed roles (from permissions-matrix.md)
 *   - denial behavior
 *
 * Grounded in:
 *   docs/reference/permissions-matrix.md
 *   docs/reference/screen-inventory.md
 *   docs/explanation/control-panel-action-semantics-and-source-of-truth-binding-batch-1.md
 *   packages/contracts/openapi/control-plane-operator-bootstrap-and-provisioning.openapi.yaml
 *
 * This is NOT a product-wide RBAC engine. It is local enforcement metadata
 * for the control-plane review runtime. See:
 *   docs/explanation/control-plane-local-operator-access-foundation-wave-1.md
 */

/**
 * All current control-plane surfaces require platform-operator.
 * Derived from permissions-matrix.md §3 and every screen contract's
 * accessRequirements.allowedRoles: ["platform-operator"].
 */
const ALLOWED_ROLES = ['platform-operator'];

/**
 * Read route access map — 13 GET routes on /api/control-plane/v1/*
 */
export const READ_ROUTES = [
  // R1: listTenants
  { method: 'GET', pattern: '/api/control-plane/v1/tenants', operationId: 'listTenants', surfaceId: 'control-plane.tenants.list', actionClass: 'view', allowedRoles: ALLOWED_ROLES },
  // R2: getTenant
  { method: 'GET', pattern: '/api/control-plane/v1/tenants/:tenantId', operationId: 'getTenant', surfaceId: 'control-plane.tenants.detail', actionClass: 'view', allowedRoles: ALLOWED_ROLES },
  // R3: listLegalMarketProfiles
  { method: 'GET', pattern: '/api/control-plane/v1/legal-market-profiles', operationId: 'listLegalMarketProfiles', surfaceId: 'control-plane.markets.management', actionClass: 'view', allowedRoles: ALLOWED_ROLES },
  // R4: getLegalMarketProfile
  { method: 'GET', pattern: '/api/control-plane/v1/legal-market-profiles/:legalMarketId', operationId: 'getLegalMarketProfile', surfaceId: 'control-plane.markets.detail', actionClass: 'view', allowedRoles: ALLOWED_ROLES },
  // R5: listTenantBootstrapRequests
  { method: 'GET', pattern: '/api/control-plane/v1/tenant-bootstrap-requests', operationId: 'listTenantBootstrapRequests', surfaceId: 'control-plane.tenants.bootstrap', actionClass: 'view', allowedRoles: ALLOWED_ROLES },
  // R6: getTenantBootstrapRequest
  { method: 'GET', pattern: '/api/control-plane/v1/tenant-bootstrap-requests/:bootstrapRequestId', operationId: 'getTenantBootstrapRequest', surfaceId: 'control-plane.tenants.bootstrap', actionClass: 'view', allowedRoles: ALLOWED_ROLES },
  // R7: listProvisioningRuns
  { method: 'GET', pattern: '/api/control-plane/v1/provisioning-runs', operationId: 'listProvisioningRuns', surfaceId: 'control-plane.provisioning.runs', actionClass: 'view', allowedRoles: ALLOWED_ROLES },
  // R8: getProvisioningRun
  { method: 'GET', pattern: '/api/control-plane/v1/provisioning-runs/:provisioningRunId', operationId: 'getProvisioningRun', surfaceId: 'control-plane.provisioning.runs', actionClass: 'view', allowedRoles: ALLOWED_ROLES },
  // R9: listPacks
  { method: 'GET', pattern: '/api/control-plane/v1/packs', operationId: 'listPacks', surfaceId: 'control-plane.packs.catalog', actionClass: 'view', allowedRoles: ALLOWED_ROLES },
  // R9b: getPack
  { method: 'GET', pattern: '/api/control-plane/v1/packs/:packId', operationId: 'getPack', surfaceId: 'control-plane.packs.catalog', actionClass: 'view', allowedRoles: ALLOWED_ROLES },
  // R10: getSystemConfig
  { method: 'GET', pattern: '/api/control-plane/v1/system-config', operationId: 'getSystemConfig', surfaceId: 'control-plane.system.config', actionClass: 'view', allowedRoles: ALLOWED_ROLES },
  // Supplementary: listCapabilities
  { method: 'GET', pattern: '/api/control-plane/v1/capabilities', operationId: 'listCapabilities', surfaceId: 'control-plane.packs.catalog', actionClass: 'view', allowedRoles: ALLOWED_ROLES },
  // Supplementary: listEffectivePlans
  { method: 'GET', pattern: '/api/control-plane/v1/effective-plans', operationId: 'listEffectivePlans', surfaceId: 'control-plane.tenants.bootstrap', actionClass: 'view', allowedRoles: ALLOWED_ROLES },
];

/**
 * Review-write route access map — 15 write simulation routes + 1 discovery route
 * on /api/control-plane-review/v1/*
 *
 * Action classes match review-action-map.mjs actionClass values.
 * These are review-only routes (executed: false, persistence: "none").
 */
export const REVIEW_ROUTES = [
  // W1: suspendTenant
  { method: 'POST', pattern: '/api/control-plane-review/v1/tenants/:tenantId/suspend', operationId: 'suspendTenant', surfaceId: 'control-plane.tenants.detail', actionClass: 'tenant-lifecycle', allowedRoles: ALLOWED_ROLES },
  // W2: reactivateTenant
  { method: 'POST', pattern: '/api/control-plane-review/v1/tenants/:tenantId/reactivate', operationId: 'reactivateTenant', surfaceId: 'control-plane.tenants.detail', actionClass: 'tenant-lifecycle', allowedRoles: ALLOWED_ROLES },
  // W3: archiveTenant
  { method: 'POST', pattern: '/api/control-plane-review/v1/tenants/:tenantId/archive', operationId: 'archiveTenant', surfaceId: 'control-plane.tenants.detail', actionClass: 'tenant-lifecycle', allowedRoles: ALLOWED_ROLES },
  // W4: resolveEffectiveConfigurationPlan
  { method: 'POST', pattern: '/api/control-plane-review/v1/effective-configuration-plans/resolve', operationId: 'resolveEffectiveConfigurationPlan', surfaceId: 'control-plane.tenants.bootstrap', actionClass: 'plan-resolution', allowedRoles: ALLOWED_ROLES },
  // W5: createTenantBootstrapRequest
  { method: 'POST', pattern: '/api/control-plane-review/v1/tenant-bootstrap-requests', operationId: 'createTenantBootstrapRequest', surfaceId: 'control-plane.tenants.bootstrap', actionClass: 'bootstrap', allowedRoles: ALLOWED_ROLES },
  // W6: createProvisioningRun
  { method: 'POST', pattern: '/api/control-plane-review/v1/provisioning-runs', operationId: 'createProvisioningRun', surfaceId: 'control-plane.provisioning.runs', actionClass: 'provisioning', allowedRoles: ALLOWED_ROLES },
  // W7: cancelProvisioningRun
  { method: 'POST', pattern: '/api/control-plane-review/v1/provisioning-runs/:provisioningRunId/cancel', operationId: 'cancelProvisioningRun', surfaceId: 'control-plane.provisioning.runs', actionClass: 'provisioning-control', allowedRoles: ALLOWED_ROLES },
  // W8: createLegalMarketProfileDraft
  { method: 'POST', pattern: '/api/control-plane-review/v1/legal-market-profiles', operationId: 'createLegalMarketProfileDraft', surfaceId: 'control-plane.markets.management', actionClass: 'market-authoring', allowedRoles: ALLOWED_ROLES },
  // W9: updateLegalMarketProfileDraft
  { method: 'PUT', pattern: '/api/control-plane-review/v1/legal-market-profiles/:legalMarketId', operationId: 'updateLegalMarketProfileDraft', surfaceId: 'control-plane.markets.detail', actionClass: 'market-authoring', allowedRoles: ALLOWED_ROLES },
  // W10: submitLegalMarketProfileForReview
  { method: 'POST', pattern: '/api/control-plane-review/v1/legal-market-profiles/:legalMarketId/submit-review', operationId: 'submitLegalMarketProfileForReview', surfaceId: 'control-plane.markets.detail', actionClass: 'market-authoring', allowedRoles: ALLOWED_ROLES },
  // W11: createPackManifestDraft
  { method: 'POST', pattern: '/api/control-plane-review/v1/packs', operationId: 'createPackManifestDraft', surfaceId: 'control-plane.packs.catalog', actionClass: 'pack-authoring', allowedRoles: ALLOWED_ROLES },
  // W12: updatePackManifestDraft
  { method: 'PUT', pattern: '/api/control-plane-review/v1/packs/:packId', operationId: 'updatePackManifestDraft', surfaceId: 'control-plane.packs.catalog', actionClass: 'pack-authoring', allowedRoles: ALLOWED_ROLES },
  // W13: submitPackManifestForReview
  { method: 'POST', pattern: '/api/control-plane-review/v1/packs/:packId/submit-review', operationId: 'submitPackManifestForReview', surfaceId: 'control-plane.packs.catalog', actionClass: 'pack-authoring', allowedRoles: ALLOWED_ROLES },
  // W14: updateFeatureFlag
  { method: 'PUT', pattern: '/api/control-plane-review/v1/system-config/feature-flags/:flagKey', operationId: 'updateFeatureFlag', surfaceId: 'control-plane.system.config', actionClass: 'system-config', allowedRoles: ALLOWED_ROLES },
  // W15: updateSystemParameter
  { method: 'PUT', pattern: '/api/control-plane-review/v1/system-config/parameters/:paramKey', operationId: 'updateSystemParameter', surfaceId: 'control-plane.system.config', actionClass: 'system-config', allowedRoles: ALLOWED_ROLES },
  // Discovery: listReviewActions
  { method: 'GET', pattern: '/api/control-plane-review/v1/actions', operationId: 'listReviewActions', surfaceId: 'control-plane.system.config', actionClass: 'view', allowedRoles: ALLOWED_ROLES },
];

/**
 * All routes combined for enforcement lookup.
 */
export const ALL_ROUTES = [...READ_ROUTES, ...REVIEW_ROUTES];

/**
 * The required role for all current control-plane routes.
 * Derived from permissions-matrix.md: all 8 control-plane surfaces
 * assign allowed (A) only to platform-operator.
 */
export const CONTROL_PLANE_REQUIRED_ROLE = 'platform-operator';

/**
 * Surface-level access summary — one entry per canonical surface.
 */
export const SURFACE_ACCESS = {
  'control-plane.tenants.list':      { allowedRoles: ALLOWED_ROLES, scopePosture: 'platform-wide' },
  'control-plane.tenants.detail':    { allowedRoles: ALLOWED_ROLES, scopePosture: 'platform-wide' },
  'control-plane.tenants.bootstrap': { allowedRoles: ALLOWED_ROLES, scopePosture: 'platform-wide' },
  'control-plane.provisioning.runs': { allowedRoles: ALLOWED_ROLES, scopePosture: 'platform-wide' },
  'control-plane.markets.management':{ allowedRoles: ALLOWED_ROLES, scopePosture: 'platform-wide' },
  'control-plane.markets.detail':    { allowedRoles: ALLOWED_ROLES, scopePosture: 'platform-wide' },
  'control-plane.packs.catalog':     { allowedRoles: ALLOWED_ROLES, scopePosture: 'platform-wide' },
  'control-plane.system.config':     { allowedRoles: ALLOWED_ROLES, scopePosture: 'platform-wide' },
};
