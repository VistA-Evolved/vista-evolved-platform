/**
 * Provisioning service — guarded run lifecycle with audit & outbox.
 *
 * Provisioning runs are created from approved bootstrap requests and move
 * through: draft → queued → running → completed|failed|waiting_on_dependency.
 * At this stage, execution is not automated — runs are created and queued
 * but actual step execution requires future operator/automation wiring.
 */
import {
  PROVISIONING_RUN_TRANSITIONS,
  validateTransition,
} from '../domain/types.mjs';
import * as provisioningRepo from '../repos/provisioning-repo.mjs';
import { recordAuditEvent, recordOutboxEvent } from '../repos/audit-repo.mjs';

/**
 * Create a new provisioning run with canonical steps.
 */
export async function createRun({ bootstrapRequestId, tenantId, actor }) {
  if (!actor) return { ok: false, reason: 'actor is required' };

  const run = await provisioningRepo.createRun({
    bootstrapRequestId,
    tenantId,
    createdBy: actor,
  });

  await recordAuditEvent({
    eventType: 'provisioning.run.created',
    entityType: 'provisioning_run',
    entityId: run.id,
    actor,
    detail: { bootstrapRequestId, tenantId },
  });

  return { ok: true, run };
}

/**
 * Queue a draft run for execution (draft → queued).
 */
export async function queueRun(runId, { actor }) {
  if (!actor) return { ok: false, reason: 'actor is required' };

  const run = await provisioningRepo.getRunById(runId);
  if (!run) return { ok: false, reason: 'Run not found' };

  const guard = validateTransition(PROVISIONING_RUN_TRANSITIONS, run.status, 'queued');
  if (!guard.ok) return guard;

  const updated = await provisioningRepo.transitionRunStatus(runId, 'queued');

  await recordAuditEvent({
    eventType: 'provisioning.run.queued',
    entityType: 'provisioning_run',
    entityId: runId,
    actor,
    detail: { fromStatus: run.status },
  });

  await recordOutboxEvent({
    eventType: 'provisioning.run.queued',
    payload: { runId, tenantId: run.tenantId, bootstrapRequestId: run.bootstrapRequestId },
  });

  return { ok: true, run: updated };
}

/**
 * Cancel a run (from draft, queued, running, waiting_on_dependency, or failed).
 */
export async function cancelRun(runId, { actor, reason }) {
  if (!actor) return { ok: false, reason: 'actor is required' };

  const run = await provisioningRepo.getRunById(runId);
  if (!run) return { ok: false, reason: 'Run not found' };

  const guard = validateTransition(PROVISIONING_RUN_TRANSITIONS, run.status, 'cancelled');
  if (!guard.ok) return guard;

  const updated = await provisioningRepo.transitionRunStatus(runId, 'cancelled');

  await recordAuditEvent({
    eventType: 'provisioning.run.cancelled',
    entityType: 'provisioning_run',
    entityId: runId,
    actor,
    detail: { fromStatus: run.status, reason: reason || null },
  });

  return { ok: true, run: updated };
}

// ---- Read operations ----

export async function getRun(runId) {
  const run = await provisioningRepo.getRunById(runId);
  if (!run) return { ok: false, reason: 'Run not found' };
  return { ok: true, run };
}

export async function getRunWithSteps(runId) {
  const run = await provisioningRepo.getRunWithSteps(runId);
  if (!run) return { ok: false, reason: 'Run not found' };
  return { ok: true, run };
}

export async function listRuns(filters) {
  const runs = await provisioningRepo.listRuns(filters);
  return { ok: true, runs };
}
