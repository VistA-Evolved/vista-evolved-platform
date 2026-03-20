/**
 * Bootstrap service — guarded draft lifecycle + request submission/approval.
 *
 * Draft editing is free-form until validation. After validation the draft
 * must be submitted (creating an immutable request snapshot) and approved
 * before it can be queued for provisioning.
 */
import {
  BOOTSTRAP_TRANSITIONS,
  validateTransition,
} from '../domain/types.mjs';
import * as bootstrapRepo from '../repos/bootstrap-repo.mjs';
import { recordAuditEvent, recordOutboxEvent } from '../repos/audit-repo.mjs';

// ---- Draft commands ----

/**
 * Create a new bootstrap draft.
 */
export async function createDraft({ tenantName, legalMarketId, organization, packSelections, notes, actor }) {
  if (!actor) return { ok: false, reason: 'actor is required' };

  const draft = await bootstrapRepo.createDraft({
    tenantName,
    legalMarketId,
    organization,
    packSelections,
    notes,
    createdBy: actor,
  });

  await recordAuditEvent({
    eventType: 'bootstrap.draft.created',
    entityType: 'bootstrap_draft',
    entityId: draft.id,
    actor,
    detail: { tenantName, legalMarketId },
  });

  return { ok: true, draft };
}

/**
 * Update fields on an in-progress draft (must still be in 'draft' status).
 */
export async function updateDraft(draftId, { fields, actor }) {
  if (!actor) return { ok: false, reason: 'actor is required' };
  if (!fields || Object.keys(fields).length === 0) {
    return { ok: false, reason: 'At least one field must be provided' };
  }

  const existing = await bootstrapRepo.getDraftById(draftId);
  if (!existing) return { ok: false, reason: 'Draft not found' };
  if (existing.status !== 'draft') {
    return { ok: false, reason: `Cannot update draft in status: ${existing.status}` };
  }

  const draft = await bootstrapRepo.updateDraft(draftId, fields);

  await recordAuditEvent({
    eventType: 'bootstrap.draft.updated',
    entityType: 'bootstrap_draft',
    entityId: draftId,
    actor,
    detail: { updatedFields: Object.keys(fields) },
  });

  return { ok: true, draft };
}

/**
 * Validate a draft and transition to 'validated'.
 *
 * Validation checks that all required fields are present. Real plan resolution
 * would be wired here when the plan-resolver is integrated.
 */
export async function validateDraft(draftId, { actor }) {
  if (!actor) return { ok: false, reason: 'actor is required' };

  const draft = await bootstrapRepo.getDraftById(draftId);
  if (!draft) return { ok: false, reason: 'Draft not found' };

  const guard = validateTransition(BOOTSTRAP_TRANSITIONS, draft.status, 'validated');
  if (!guard.ok) return guard;

  // Structural validation: required fields
  const errors = [];
  if (!draft.tenantName) errors.push('tenantName is required');
  if (!draft.legalMarketId) errors.push('legalMarketId is required');
  if (!draft.organization) errors.push('organization is required');
  if (!draft.packSelections) errors.push('packSelections is required');

  if (errors.length > 0) {
    return { ok: false, reason: 'Validation failed', errors };
  }

  const updated = await bootstrapRepo.transitionDraftStatus(draftId, 'validated');

  await recordAuditEvent({
    eventType: 'bootstrap.draft.validated',
    entityType: 'bootstrap_draft',
    entityId: draftId,
    actor,
    detail: { validationResult: { ok: true, errors: [] } },
  });

  return { ok: true, draft: updated };
}

/**
 * Submit a validated draft for approval (creates an immutable request snapshot).
 */
export async function submitForApproval(draftId, { actor }) {
  if (!actor) return { ok: false, reason: 'actor is required' };

  const draft = await bootstrapRepo.getDraftById(draftId);
  if (!draft) return { ok: false, reason: 'Draft not found' };

  const guard = validateTransition(BOOTSTRAP_TRANSITIONS, draft.status, 'approval_required');
  if (!guard.ok) return guard;

  // Transition draft to approval_required
  await bootstrapRepo.transitionDraftStatus(draftId, 'approval_required');

  // Create immutable request snapshot
  const request = await bootstrapRepo.createRequest({
    draftId,
    tenantName: draft.tenantName,
    legalMarketId: draft.legalMarketId,
    organization: draft.organization,
    packSelections: draft.packSelections,
    validationResult: { ok: true, errors: [] },
    submittedBy: actor,
  });

  await recordAuditEvent({
    eventType: 'bootstrap.request.submitted',
    entityType: 'bootstrap_request',
    entityId: request.id,
    actor,
    detail: { draftId, tenantName: draft.tenantName },
  });

  await recordOutboxEvent({
    eventType: 'bootstrap.request.submitted',
    payload: { requestId: request.id, draftId, tenantName: draft.tenantName },
  });

  return { ok: true, request };
}

// ---- Request commands ----

/**
 * Approve a pending request.
 */
export async function approveRequest(requestId, { actor, reason }) {
  if (!actor) return { ok: false, reason: 'actor is required' };

  const request = await bootstrapRepo.getRequestById(requestId);
  if (!request) return { ok: false, reason: 'Request not found' };

  if (request.status !== 'pending') {
    return { ok: false, reason: `Cannot approve request in status: ${request.status}` };
  }

  const updated = await bootstrapRepo.transitionRequestStatus(requestId, {
    toStatus: 'approved',
    reviewedBy: actor,
    reviewReason: reason || null,
  });

  // Also transition the draft to approved
  if (request.draftId) {
    await bootstrapRepo.transitionDraftStatus(request.draftId, 'approved');
  }

  await recordAuditEvent({
    eventType: 'bootstrap.request.approved',
    entityType: 'bootstrap_request',
    entityId: requestId,
    actor,
    detail: { reason: reason || null },
  });

  await recordOutboxEvent({
    eventType: 'bootstrap.request.approved',
    payload: { requestId, draftId: request.draftId },
  });

  return { ok: true, request: updated };
}

/**
 * Cancel a pending request.
 */
export async function cancelRequest(requestId, { actor, reason }) {
  if (!actor) return { ok: false, reason: 'actor is required' };

  const request = await bootstrapRepo.getRequestById(requestId);
  if (!request) return { ok: false, reason: 'Request not found' };

  if (request.status !== 'pending') {
    return { ok: false, reason: `Cannot cancel request in status: ${request.status}` };
  }

  const updated = await bootstrapRepo.transitionRequestStatus(requestId, {
    toStatus: 'cancelled',
    reviewedBy: actor,
    reviewReason: reason || null,
  });

  // Also transition the draft to cancelled
  if (request.draftId) {
    await bootstrapRepo.transitionDraftStatus(request.draftId, 'cancelled');
  }

  await recordAuditEvent({
    eventType: 'bootstrap.request.cancelled',
    entityType: 'bootstrap_request',
    entityId: requestId,
    actor,
    detail: { reason: reason || null },
  });

  return { ok: true, request: updated };
}

// ---- Read operations ----

export async function getDraft(draftId) {
  const draft = await bootstrapRepo.getDraftById(draftId);
  if (!draft) return { ok: false, reason: 'Draft not found' };
  return { ok: true, draft };
}

export async function getRequest(requestId) {
  const request = await bootstrapRepo.getRequestById(requestId);
  if (!request) return { ok: false, reason: 'Request not found' };
  return { ok: true, request };
}

export async function listRequests(filters) {
  const requests = await bootstrapRepo.listRequests(filters);
  return { ok: true, requests };
}
