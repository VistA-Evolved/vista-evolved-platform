/**
 * Domain types for the control-plane operator-state engine.
 *
 * These types define the canonical objects, state families, and transition
 * rules for tenant lifecycle, bootstrap, provisioning, audit, and outbox.
 *
 * Source of truth: docs/explanation/control-plane-tenant-lifecycle-and-orchestration-model.md
 */

// ---- Tenant lifecycle ----

export const TENANT_STATUSES = ['draft', 'active', 'suspended', 'archived'];

export const TENANT_TRANSITIONS = {
  draft:     ['active'],
  active:    ['suspended', 'archived'],
  suspended: ['active', 'archived'],
  archived:  [],
};

export const SUSPENSION_REASONS = [
  'operator-action',
  'commercial-suspension',
  'security-incident',
  'compliance-hold',
];

// ---- Bootstrap lifecycle ----

export const BOOTSTRAP_STATUSES = [
  'draft', 'validated', 'approval_required', 'approved',
  'queued', 'superseded', 'cancelled',
];

export const BOOTSTRAP_TRANSITIONS = {
  draft:             ['validated', 'cancelled'],
  validated:         ['approval_required', 'cancelled'],
  approval_required: ['approved', 'cancelled'],
  approved:          ['queued', 'cancelled'],
  queued:            ['superseded'],
  superseded:        [],
  cancelled:         [],
};

// ---- Provisioning run lifecycle ----

export const PROVISIONING_RUN_STATUSES = [
  'draft', 'queued', 'running', 'waiting_on_dependency',
  'failed', 'cancelled', 'completed',
];

export const PROVISIONING_RUN_TRANSITIONS = {
  draft:                 ['queued', 'cancelled'],
  queued:                ['running', 'cancelled'],
  running:               ['completed', 'failed', 'waiting_on_dependency', 'cancelled'],
  waiting_on_dependency: ['running', 'cancelled'],
  failed:                ['cancelled'],
  cancelled:             [],
  completed:             [],
};

// ---- Provisioning step lifecycle ----

export const PROVISIONING_STEP_STATUSES = ['pending', 'running', 'completed', 'failed', 'skipped'];

// ---- Canonical provisioning steps ----

export const CANONICAL_PROVISIONING_STEPS = [
  'validate-bootstrap-request',
  'create-tenant-draft',
  'resolve-effective-plan',
  'allocate-environment',
  'bind-tenant-to-environment',
  'activate-packs',
  'configure-vista-lane',
  'run-health-checks',
  'activate-tenant',
  'initialize-billing',
];

// ---- Audit event types ----

export const AUDIT_EVENT_TYPES = [
  'tenant.created', 'tenant.activated', 'tenant.suspended',
  'tenant.reactivated', 'tenant.archived',
  'bootstrap.draft.created', 'bootstrap.draft.updated', 'bootstrap.draft.validated',
  'bootstrap.request.submitted', 'bootstrap.request.approved', 'bootstrap.request.cancelled',
  'provisioning.run.created', 'provisioning.run.queued',
  'provisioning.run.cancelled', 'provisioning.run.completed', 'provisioning.run.failed',
];

/**
 * Validate that a state transition is allowed.
 * @param {Record<string, string[]>} transitionMap
 * @param {string} from
 * @param {string} to
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validateTransition(transitionMap, from, to) {
  const allowed = transitionMap[from];
  if (!allowed) {
    return { ok: false, reason: `Unknown state: ${from}` };
  }
  if (!allowed.includes(to)) {
    return { ok: false, reason: `Transition ${from} → ${to} is not allowed. Allowed: ${allowed.join(', ') || 'none (terminal state)'}` };
  }
  return { ok: true };
}
