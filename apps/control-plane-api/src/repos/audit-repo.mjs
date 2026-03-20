/**
 * Audit event repository — append-only platform audit trail.
 */
import { query } from '../db/pool.mjs';

/**
 * Record an audit event.
 */
export async function recordAuditEvent({ eventType, entityType, entityId, actor, detail }) {
  const { rows } = await query(
    `INSERT INTO audit_event (event_type, entity_type, entity_id, actor, detail)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [eventType, entityType, entityId || null, actor, detail ? JSON.stringify(detail) : null]
  );
  return mapRow(rows[0]);
}

/**
 * List audit events with optional filters.
 */
export async function listAuditEvents({ eventType, entityType, entityId, limit = 100, offset = 0 } = {}) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (eventType) {
    conditions.push(`event_type = $${idx++}`);
    params.push(eventType);
  }
  if (entityType) {
    conditions.push(`entity_type = $${idx++}`);
    params.push(entityType);
  }
  if (entityId) {
    conditions.push(`entity_id = $${idx++}`);
    params.push(entityId);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit, offset);
  const sql = `SELECT * FROM audit_event ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`;

  const { rows } = await query(sql, params);
  return rows.map(mapRow);
}

/**
 * Record an outbox event (for future reliable delivery).
 */
export async function recordOutboxEvent({ eventType, payload }) {
  const { rows } = await query(
    `INSERT INTO outbox_event (event_type, payload) VALUES ($1, $2) RETURNING *`,
    [eventType, JSON.stringify(payload)]
  );
  return {
    id: rows[0].id,
    eventType: rows[0].event_type,
    payload: rows[0].payload,
    published: rows[0].published,
    createdAt: rows[0].created_at,
  };
}

function mapRow(r) {
  return {
    id: r.id,
    eventType: r.event_type,
    entityType: r.entity_type,
    entityId: r.entity_id,
    actor: r.actor,
    detail: r.detail,
    createdAt: r.created_at,
  };
}
