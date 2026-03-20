/**
 * Provisioning run repository — PostgreSQL persistence for runs and steps.
 */
import { query, getClient } from '../db/pool.mjs';
import { CANONICAL_PROVISIONING_STEPS } from '../domain/types.mjs';

export async function createRun({ bootstrapRequestId, tenantId, createdBy }) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO provisioning_run (bootstrap_request_id, tenant_id, status, created_by)
       VALUES ($1, $2, 'draft', $3)
       RETURNING *`,
      [bootstrapRequestId || null, tenantId || null, createdBy]
    );
    const run = rows[0];

    // Create canonical steps
    for (let i = 0; i < CANONICAL_PROVISIONING_STEPS.length; i++) {
      await client.query(
        `INSERT INTO provisioning_step (run_id, step_name, step_order, status)
         VALUES ($1, $2, $3, 'pending')`,
        [run.id, CANONICAL_PROVISIONING_STEPS[i], i + 1]
      );
    }

    await client.query('COMMIT');
    return mapRunRow(run);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getRunById(id) {
  const { rows } = await query('SELECT * FROM provisioning_run WHERE id = $1', [id]);
  return rows[0] ? mapRunRow(rows[0]) : null;
}

export async function getRunWithSteps(id) {
  const run = await getRunById(id);
  if (!run) return null;

  const { rows } = await query(
    'SELECT * FROM provisioning_step WHERE run_id = $1 ORDER BY step_order',
    [id]
  );

  return {
    ...run,
    steps: rows.map(mapStepRow),
  };
}

export async function listRuns({ status, limit = 50, offset = 0 } = {}) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (status) {
    conditions.push(`status = $${idx++}`);
    params.push(status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit, offset);
  const sql = `SELECT * FROM provisioning_run ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`;

  const { rows } = await query(sql, params);
  return rows.map(mapRunRow);
}

export async function transitionRunStatus(id, toStatus) {
  const { rows } = await query(
    `UPDATE provisioning_run SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
    [toStatus, id]
  );
  return rows[0] ? mapRunRow(rows[0]) : null;
}

function mapRunRow(r) {
  return {
    id: r.id,
    bootstrapRequestId: r.bootstrap_request_id,
    tenantId: r.tenant_id,
    status: r.status,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapStepRow(r) {
  return {
    id: r.id,
    runId: r.run_id,
    stepName: r.step_name,
    stepOrder: r.step_order,
    status: r.status,
    detail: r.detail,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    createdAt: r.created_at,
  };
}
