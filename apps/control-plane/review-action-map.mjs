/**
 * Review Action Map — LOCAL REVIEW METADATA ONLY
 *
 * This file is app-local review metadata for the control-plane local review runtime.
 * It is NOT canonical product truth. Canonical write operations are defined in:
 *   packages/contracts/openapi/control-plane-operator-bootstrap-and-provisioning.openapi.yaml
 * Canonical events are defined in:
 *   packages/contracts/asyncapi/control-plane-provisioning-events.asyncapi.yaml
 *
 * This map derives required fields, projected events, and audit previews from those
 * canonical contracts for local review-only simulation.
 */

export const REVIEW_ACTIONS = {
  // ── Tenant Lifecycle ───────────────────────────────────────────────────
  suspendTenant: {
    operationId: 'suspendTenant',
    httpMethod: 'POST',
    canonicalPath: '/tenants/{tenantId}/suspend',
    surface: 'Tenant Detail',
    actionClass: 'tenant-lifecycle',
    requiredFields: { reason: { type: 'string', minLength: 1, maxLength: 2048 } },
    optionalFields: {},
    projectedEvents: ['tenant.lifecycle.suspended'],
    auditSummary: 'Suspend an active tenant — revokes sessions, blocks access',
    guardrails: ['Precondition: tenant status must be active', 'Emits lifecycle event to access-control consumers'],
  },
  reactivateTenant: {
    operationId: 'reactivateTenant',
    httpMethod: 'POST',
    canonicalPath: '/tenants/{tenantId}/reactivate',
    surface: 'Tenant Detail',
    actionClass: 'tenant-lifecycle',
    requiredFields: { reason: { type: 'string', minLength: 1, maxLength: 2048 } },
    optionalFields: {},
    projectedEvents: ['tenant.lifecycle.reactivated'],
    auditSummary: 'Reactivate a suspended tenant — restores access',
    guardrails: ['Precondition: tenant status must be suspended', 'Emits lifecycle event to access-control consumers'],
  },
  archiveTenant: {
    operationId: 'archiveTenant',
    httpMethod: 'POST',
    canonicalPath: '/tenants/{tenantId}/archive',
    surface: 'Tenant Detail',
    actionClass: 'tenant-lifecycle',
    requiredFields: {
      reason: { type: 'string', minLength: 1, maxLength: 2048 },
      confirmArchive: { type: 'boolean', mustBeTrue: true },
    },
    optionalFields: {},
    projectedEvents: ['tenant.lifecycle.archived'],
    auditSummary: 'IRREVERSIBLE — archive a suspended tenant, permanently revoke access',
    guardrails: ['Precondition: tenant status must be suspended', 'Irreversible operation', 'confirmArchive must be true', 'Triggers permanent data-retention workflow'],
  },

  // ── Bootstrap & Provisioning ───────────────────────────────────────────
  resolveEffectiveConfigurationPlan: {
    operationId: 'resolveEffectiveConfigurationPlan',
    httpMethod: 'POST',
    canonicalPath: '/effective-configuration-plans:resolve',
    surface: 'Tenant Bootstrap',
    actionClass: 'plan-resolution',
    requiredFields: {
      legalMarketId: { type: 'string', pattern: '^[A-Z]{2}(-[A-Z0-9]{1,8})?$' },
    },
    optionalFields: {
      tenantDisplayName: { type: 'string' },
      facilityType: { type: 'string' },
      selectedPacks: { type: 'array' },
      deselectedDefaults: { type: 'array' },
      selectedPayers: { type: 'array' },
      selectedSpecialties: { type: 'array' },
    },
    projectedEvents: ['effective-plan.resolved'],
    auditSummary: 'Resolve an effective configuration plan for a legal market',
    guardrails: ['Informational only — does not imply production readiness', 'Plan must be referenced by a bootstrap request to take effect'],
  },
  createTenantBootstrapRequest: {
    operationId: 'createTenantBootstrapRequest',
    httpMethod: 'POST',
    canonicalPath: '/tenant-bootstrap-requests',
    surface: 'Tenant Bootstrap',
    actionClass: 'bootstrap',
    requiredFields: {
      effectivePlanId: { type: 'string', format: 'uuid' },
      tenantDisplayName: { type: 'string', minLength: 1, maxLength: 256 },
    },
    optionalFields: {
      tenantNotes: { type: 'string' },
    },
    projectedEvents: ['tenant.bootstrap.requested'],
    auditSummary: 'Submit a tenant bootstrap request referencing a resolved plan',
    guardrails: ['Async — returns 202 Accepted', 'Plan must exist and pass eligibility', 'Consumer: provisioning eligibility evaluator'],
  },
  createProvisioningRun: {
    operationId: 'createProvisioningRun',
    httpMethod: 'POST',
    canonicalPath: '/provisioning-runs',
    surface: 'Provisioning Runs',
    actionClass: 'provisioning',
    requiredFields: {
      bootstrapRequestId: { type: 'string', format: 'uuid' },
    },
    optionalFields: {},
    projectedEvents: ['provisioning.run.requested'],
    auditSummary: 'Start a provisioning run for an approved bootstrap request',
    guardrails: ['Async — returns 202 Accepted', 'Bootstrap request must be approved', 'Consumer: provisioning orchestrator'],
  },
  cancelProvisioningRun: {
    operationId: 'cancelProvisioningRun',
    httpMethod: 'POST',
    canonicalPath: '/provisioning-runs/{provisioningRunId}/cancel',
    surface: 'Provisioning Runs',
    actionClass: 'provisioning-control',
    requiredFields: {
      reason: { type: 'string', minLength: 1, maxLength: 2048 },
    },
    optionalFields: {},
    projectedEvents: ['provisioning.run.cancel.requested'],
    auditSummary: 'Request cancellation of an in-progress provisioning run',
    guardrails: ['Async — returns 202 Accepted', 'Does NOT roll back completed steps', 'Precondition: run status must be queued or in-progress'],
  },

  // ── Market Profile Authoring ───────────────────────────────────────────
  createLegalMarketProfileDraft: {
    operationId: 'createLegalMarketProfileDraft',
    httpMethod: 'POST',
    canonicalPath: '/legal-market-profiles',
    surface: 'Market Management',
    actionClass: 'market-authoring',
    requiredFields: {
      legalMarketId: { type: 'string', pattern: '^[A-Z]{2}(-[A-Z0-9]{1,8})?$' },
      displayName: { type: 'string', minLength: 1, maxLength: 256 },
    },
    optionalFields: {
      launchTier: { type: 'string', enum: ['T0', 'T1', 'T2', 'T3'] },
      readinessDimensions: { type: 'array' },
      mandatedPacks: { type: 'array' },
      defaultOnPacks: { type: 'array' },
      eligiblePacks: { type: 'array' },
      excludedPacks: { type: 'array' },
    },
    projectedEvents: ['market.profile.draft.created'],
    auditSummary: 'Create a new legal-market profile draft',
    guardrails: ['Creates in draft status', 'legalMarketId must be ISO 3166-1 alpha-2 pattern'],
  },
  updateLegalMarketProfileDraft: {
    operationId: 'updateLegalMarketProfileDraft',
    httpMethod: 'PUT',
    canonicalPath: '/legal-market-profiles/{legalMarketId}',
    surface: 'Market Detail',
    actionClass: 'market-authoring',
    requiredFields: {},
    optionalFields: {
      displayName: { type: 'string', minLength: 1, maxLength: 256 },
      launchTier: { type: 'string', enum: ['T0', 'T1', 'T2', 'T3'] },
      readinessDimensions: { type: 'array' },
      mandatedPacks: { type: 'array' },
      defaultOnPacks: { type: 'array' },
      eligiblePacks: { type: 'array' },
      excludedPacks: { type: 'array' },
    },
    projectedEvents: ['market.profile.draft.updated'],
    auditSummary: 'Update an existing draft legal-market profile',
    guardrails: ['Precondition: profile must be in draft status', 'Returns 409 if not draft'],
  },
  submitLegalMarketProfileForReview: {
    operationId: 'submitLegalMarketProfileForReview',
    httpMethod: 'POST',
    canonicalPath: '/legal-market-profiles/{legalMarketId}:submit-review',
    surface: 'Market Detail',
    actionClass: 'market-authoring',
    requiredFields: {},
    optionalFields: { reason: { type: 'string' } },
    projectedEvents: ['market.profile.review.submitted'],
    auditSummary: 'Submit a draft market profile for governance review (draft → review-pending)',
    guardrails: ['One-way transition until governance review completes', 'Must pass structural validation'],
  },

  // ── Pack Manifest Authoring ────────────────────────────────────────────
  createPackManifestDraft: {
    operationId: 'createPackManifestDraft',
    httpMethod: 'POST',
    canonicalPath: '/packs',
    surface: 'Pack Catalog',
    actionClass: 'pack-authoring',
    requiredFields: {
      packId: { type: 'string', pattern: '^[a-z][a-z0-9-]*$' },
      displayName: { type: 'string', minLength: 1, maxLength: 256 },
      packFamily: { type: 'string', enum: ['language', 'locale', 'regulatory', 'national-standards', 'payer', 'specialty', 'tenant-overlay'] },
    },
    optionalFields: {
      description: { type: 'string' },
      dependencies: { type: 'array' },
      eligibility: { type: 'object' },
      adapterRequirements: { type: 'array' },
    },
    projectedEvents: ['pack.manifest.draft.created'],
    auditSummary: 'Create a new pack manifest in draft lifecycle state',
    guardrails: ['Creates in draft lifecycle', 'packId must match ^[a-z][a-z0-9-]*$'],
  },
  updatePackManifestDraft: {
    operationId: 'updatePackManifestDraft',
    httpMethod: 'PUT',
    canonicalPath: '/packs/{packId}',
    surface: 'Pack Catalog',
    actionClass: 'pack-authoring',
    requiredFields: {},
    optionalFields: {
      displayName: { type: 'string', minLength: 1, maxLength: 256 },
      description: { type: 'string' },
      packFamily: { type: 'string', enum: ['language', 'locale', 'regulatory', 'national-standards', 'payer', 'specialty', 'tenant-overlay'] },
      dependencies: { type: 'array' },
      eligibility: { type: 'object' },
      contentSummary: { type: 'object' },
      adapterRequirements: { type: 'array' },
      configurationKeys: { type: 'array' },
      capabilityContributions: { type: 'array' },
    },
    projectedEvents: ['pack.manifest.draft.updated'],
    auditSummary: 'Update an existing draft pack manifest',
    guardrails: ['Precondition: pack must be in draft lifecycle', 'Returns 409 if not draft'],
  },
  submitPackManifestForReview: {
    operationId: 'submitPackManifestForReview',
    httpMethod: 'POST',
    canonicalPath: '/packs/{packId}:submit-review',
    surface: 'Pack Catalog',
    actionClass: 'pack-authoring',
    requiredFields: {},
    optionalFields: { reason: { type: 'string' } },
    projectedEvents: ['pack.manifest.review.submitted'],
    auditSummary: 'Submit a draft pack manifest for governance review (draft → review-pending)',
    guardrails: ['One-way transition until governance review completes'],
  },

  // ── System Configuration ───────────────────────────────────────────────
  updateFeatureFlag: {
    operationId: 'updateFeatureFlag',
    httpMethod: 'PUT',
    canonicalPath: '/system-config/feature-flags/{flagKey}',
    surface: 'System Config',
    actionClass: 'system-config',
    requiredFields: {
      value: { type: 'boolean|string|integer', description: 'New flag value' },
    },
    optionalFields: { reason: { type: 'string' } },
    projectedEvents: ['system.config.feature-flag.updated'],
    auditSummary: 'Update a feature flag value (cannot create/delete flags)',
    guardrails: ['Cannot create or delete flags', 'Propagates to tenant runtime planes'],
  },
  updateSystemParameter: {
    operationId: 'updateSystemParameter',
    httpMethod: 'PUT',
    canonicalPath: '/system-config/parameters/{paramKey}',
    surface: 'System Config',
    actionClass: 'system-config',
    requiredFields: {
      value: { type: 'string|integer|number|boolean', description: 'New parameter value' },
    },
    optionalFields: { reason: { type: 'string' } },
    projectedEvents: ['system.config.parameter.updated'],
    auditSummary: 'Update a system parameter value (cannot create/delete parameters)',
    guardrails: ['Cannot create or delete parameters', 'Propagates to tenant runtime planes'],
  },
};

/**
 * Validate a request body against an action's required fields.
 * Returns { valid: boolean, errors: string[] }
 */
export function validateReviewRequest(actionKey, body, pathParams = {}) {
  const action = REVIEW_ACTIONS[actionKey];
  if (!action) return { valid: false, errors: [`Unknown action: ${actionKey}`] };

  const errors = [];
  const safeBody = body || {};

  for (const [field, spec] of Object.entries(action.requiredFields)) {
    const val = safeBody[field] ?? pathParams[field];
    if (val === undefined || val === null || val === '') {
      errors.push(`Missing required field: ${field}`);
      continue;
    }
    if (spec.minLength && typeof val === 'string' && val.length < spec.minLength) {
      errors.push(`${field} must be at least ${spec.minLength} character(s)`);
    }
    if (spec.maxLength && typeof val === 'string' && val.length > spec.maxLength) {
      errors.push(`${field} must be at most ${spec.maxLength} characters`);
    }
    if (spec.pattern && typeof val === 'string' && !new RegExp(spec.pattern).test(val)) {
      errors.push(`${field} must match pattern ${spec.pattern}`);
    }
    if (spec.enum && !spec.enum.includes(val)) {
      errors.push(`${field} must be one of: ${spec.enum.join(', ')}`);
    }
    if (spec.mustBeTrue && val !== true) {
      errors.push(`${field} must be true`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Build the standard review response envelope for an action.
 */
export function buildReviewEnvelope(actionKey, body, pathParams, validation) {
  const action = REVIEW_ACTIONS[actionKey];
  const resourceId = pathParams.tenantId || pathParams.legalMarketId ||
    pathParams.provisioningRunId || pathParams.packId ||
    pathParams.flagKey || pathParams.paramKey || '(new)';

  return {
    mode: 'local-review',
    executed: false,
    persistence: 'none',
    canonicalOperationId: action.operationId,
    canonicalHttpMethod: action.httpMethod,
    canonicalPath: action.canonicalPath,
    targetResource: {
      ...pathParams,
      ...(body || {}),
    },
    validation,
    projectedEvents: action.projectedEvents.map(e => ({
      eventAddress: e,
      description: `Would be emitted by canonical runtime on successful ${action.operationId}`,
    })),
    auditPreview: {
      actionClass: action.actionClass,
      actorSource: 'operator (review-only — no real actor)',
      resourceId,
      summary: action.auditSummary,
    },
    guardrails: action.guardrails,
    notes: [
      'This action was NOT executed.',
      'No persistence occurred.',
      'No tenant or runtime state changed.',
      'Canonical runtime support is pending implementation.',
      'This is a local review-only simulation for validation and preview purposes.',
    ],
  };
}
