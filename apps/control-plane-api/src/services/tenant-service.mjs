/**
 * Tenant service — guarded lifecycle transitions with audit & outbox.
 *
 * Every command validates the transition against the domain transition map
 * before delegating to the repository. Audit events and outbox events are
 * recorded for every mutation.
 */
import {
  TENANT_TRANSITIONS,
  SUSPENSION_REASONS,
  validateTransition,
} from '../domain/types.mjs';
import * as tenantRepo from '../repos/tenant-repo.mjs';
import { recordAuditEvent, recordOutboxEvent } from '../repos/audit-repo.mjs';

/**
 * Create a new tenant in draft status.
 */
export async function createTenant({ displayName, slug, legalMarketId, actor }) {
  if (!displayName || !slug || !legalMarketId || !actor) {
    return { ok: false, reason: 'displayName, slug, legalMarketId, and actor are required' };
  }

  const tenant = await tenantRepo.createTenant({
    displayName,
    slug,
    legalMarketId,
    createdBy: actor,
  });

  await recordAuditEvent({
    eventType: 'tenant.created',
    entityType: 'tenant',
    entityId: tenant.id,
    actor,
    detail: { displayName, slug, legalMarketId },
  });

  await recordOutboxEvent({
    eventType: 'tenant.created',
    payload: { tenantId: tenant.id, displayName, slug, legalMarketId },
  });

  return { ok: true, tenant };
}

/**
 * Activate a tenant (draft → active).
 */
export async function activateTenant(tenantId, { actor }) {
  return transitionTo(tenantId, 'active', { actor, eventType: 'tenant.activated' });
}

/**
 * Suspend a tenant (active → suspended).
 */
export async function suspendTenant(tenantId, { reason, actor }) {
  if (!reason || !SUSPENSION_REASONS.includes(reason)) {
    return {
      ok: false,
      reason: `Valid suspension reason required. Allowed: ${SUSPENSION_REASONS.join(', ')}`,
    };
  }
  return transitionTo(tenantId, 'suspended', { reason, actor, eventType: 'tenant.suspended' });
}

/**
 * Reactivate a tenant (suspended → active).
 */
export async function reactivateTenant(tenantId, { actor }) {
  return transitionTo(tenantId, 'active', { actor, eventType: 'tenant.reactivated' });
}

/**
 * Archive a tenant (active|suspended → archived).
 */
export async function archiveTenant(tenantId, { actor }) {
  return transitionTo(tenantId, 'archived', { actor, eventType: 'tenant.archived' });
}

/**
 * Get a single tenant by ID.
 */
export async function getTenant(tenantId) {
  const tenant = await tenantRepo.getTenantById(tenantId);
  if (!tenant) return { ok: false, reason: 'Tenant not found' };
  return { ok: true, tenant };
}

/**
 * List tenants with optional filters.
 */
export async function listTenants(filters) {
  const tenants = await tenantRepo.listTenants(filters);
  return { ok: true, tenants };
}

/**
 * Get lifecycle transition history for a tenant.
 */
export async function getTenantHistory(tenantId) {
  const tenant = await tenantRepo.getTenantById(tenantId);
  if (!tenant) return { ok: false, reason: 'Tenant not found' };
  const transitions = await tenantRepo.getTenantTransitions(tenantId);
  return { ok: true, transitions };
}

// ---- Internal ----

async function transitionTo(tenantId, toStatus, { reason, actor, eventType }) {
  if (!actor) return { ok: false, reason: 'actor is required' };

  const tenant = await tenantRepo.getTenantById(tenantId);
  if (!tenant) return { ok: false, reason: 'Tenant not found' };

  const guard = validateTransition(TENANT_TRANSITIONS, tenant.status, toStatus);
  if (!guard.ok) return guard;

  const result = await tenantRepo.transitionTenantStatus(tenantId, {
    toStatus,
    reason: reason || null,
    actor,
  });

  if (!result.ok) return result;

  await recordAuditEvent({
    eventType,
    entityType: 'tenant',
    entityId: tenantId,
    actor,
    detail: { fromStatus: tenant.status, toStatus, reason: reason || null },
  });

  await recordOutboxEvent({
    eventType,
    payload: { tenantId, fromStatus: tenant.status, toStatus },
  });

  return { ok: true, tenant: result.tenant };
}
