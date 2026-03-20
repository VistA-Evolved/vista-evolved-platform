/**
 * Tenant repository — PostgreSQL persistence for tenant records.
 */
import { query, getClient } from '../db/pool.mjs';

/**
 * Create a new tenant in draft status.
 */
export async function createTenant({ displayName, slug, legalMarketId, createdBy }) {
  const { rows } = await query(
    `INSERT INTO tenant (display_name, slug, legal_market_id, status, created_by)
     VALUES ($1, $2, $3, 'draft', $4)
     RETURNING *`,
    [displayName, slug, legalMarketId, createdBy]
  );
  return mapRow(rows[0]);
}

/**
 * Get a tenant by ID.
 */
export async function getTenantById(id) {
  const { rows } = await query('SELECT * FROM tenant WHERE id = $1', [id]);
  return rows[0] ? mapRow(rows[0]) : null;
}

/**
 * List tenants with optional filters.
 */
export async function listTenants({ status, legalMarketId, search, limit = 50, offset = 0 } = {}) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (status) {
    conditions.push(`status = $${idx++}`);
    params.push(status);
  }
  if (legalMarketId) {
    conditions.push(`legal_market_id = $${idx++}`);
    params.push(legalMarketId);
  }
  if (search) {
    conditions.push(`(display_name ILIKE $${idx} OR slug ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT * FROM tenant ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`;
  params.push(limit, offset);

  const { rows } = await query(sql, params);
  return rows.map(mapRow);
}

/**
 * Update tenant status with a lifecycle transition (transactional).
 */
export async function transitionTenantStatus(id, { toStatus, reason, actor }) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      'SELECT * FROM tenant WHERE id = $1 FOR UPDATE', [id]
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'Tenant not found' };
    }
    const tenant = rows[0];

    // Record transition
    await client.query(
      `INSERT INTO tenant_lifecycle_transition (tenant_id, from_status, to_status, reason, actor)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, tenant.status, toStatus, reason || null, actor]
    );

    // Update status
    const updateFields = ['status = $1', 'updated_at = now()'];
    const updateParams = [toStatus];
    let pIdx = 2;

    if (toStatus === 'suspended' && reason) {
      updateFields.push(`suspension_reason = $${pIdx++}`);
      updateParams.push(reason);
    } else if (toStatus !== 'suspended') {
      updateFields.push('suspension_reason = NULL');
    }

    updateParams.push(id);
    const { rows: updated } = await client.query(
      `UPDATE tenant SET ${updateFields.join(', ')} WHERE id = $${pIdx} RETURNING *`,
      updateParams
    );

    await client.query('COMMIT');
    return { ok: true, tenant: mapRow(updated[0]) };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Get lifecycle transition history for a tenant.
 */
export async function getTenantTransitions(tenantId) {
  const { rows } = await query(
    'SELECT * FROM tenant_lifecycle_transition WHERE tenant_id = $1 ORDER BY created_at',
    [tenantId]
  );
  return rows.map(r => ({
    id: r.id,
    tenantId: r.tenant_id,
    fromStatus: r.from_status,
    toStatus: r.to_status,
    reason: r.reason,
    actor: r.actor,
    createdAt: r.created_at,
  }));
}

function mapRow(r) {
  return {
    id: r.id,
    displayName: r.display_name,
    slug: r.slug,
    legalMarketId: r.legal_market_id,
    status: r.status,
    suspensionReason: r.suspension_reason,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
