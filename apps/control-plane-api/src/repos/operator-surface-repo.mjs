/**
 * PG repos for operator-console surfaces: invitations, alerts, usage, commercial, flags.
 */
import { createHash, randomBytes } from 'node:crypto';
import { query } from '../db/pool.mjs';

export async function listInvitations({ limit = 50, offset = 0 } = {}) {
  const { rows } = await query(
    `SELECT id, tenant_id AS "tenantId", email, status, invited_by AS "invitedBy",
            expires_at AS "expiresAt", created_at AS "createdAt"
     FROM operator_invitation ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

export async function insertInvitation({ tenantId, email, invitedBy, expiresAt }) {
  const plain = randomBytes(24).toString('hex');
  const tokenHash = createHash('sha256').update(plain).digest('hex');
  const { rows } = await query(
    `INSERT INTO operator_invitation (tenant_id, email, token_hash, invited_by, expires_at)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at AS "createdAt"`,
    [tenantId || null, email, tokenHash, invitedBy, expiresAt || null]
  );
  return { ...rows[0], plainToken: plain };
}

export async function listAlerts({ limit = 50, offset = 0, openOnly = false } = {}) {
  const where = openOnly ? 'WHERE acknowledged_at IS NULL' : '';
  const { rows } = await query(
    `SELECT id, tenant_id AS "tenantId", severity, title, body,
            acknowledged_at AS "acknowledgedAt", created_at AS "createdAt"
     FROM operator_alert ${where} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

export async function insertAlert({ tenantId, severity, title, body }) {
  const { rows } = await query(
    `INSERT INTO operator_alert (tenant_id, severity, title, body)
     VALUES ($1, $2, $3, $4)
     RETURNING id, created_at AS "createdAt"`,
    [tenantId || null, severity || 'info', title, body || null]
  );
  return rows[0];
}

export async function acknowledgeAlert(id) {
  const { rows } = await query(
    `UPDATE operator_alert SET acknowledged_at = now() WHERE id = $1 AND acknowledged_at IS NULL
     RETURNING id, acknowledged_at AS "acknowledgedAt"`,
    [id]
  );
  return rows[0] || null;
}

export async function listUsageEvents({ limit = 100, offset = 0 } = {}) {
  const { rows } = await query(
    `SELECT id, tenant_id AS "tenantId", metric_name AS "metricName", quantity, detail,
            recorded_at AS "recordedAt"
     FROM usage_meter_event ORDER BY recorded_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

export async function insertUsageEvent({ tenantId, metricName, quantity, detail }) {
  const { rows } = await query(
    `INSERT INTO usage_meter_event (tenant_id, metric_name, quantity, detail)
     VALUES ($1, $2, $3, $4) RETURNING id, recorded_at AS "recordedAt"`,
    [tenantId || null, metricName, quantity ?? 1, detail ?? null]
  );
  return rows[0];
}

export async function listEntitlements({ limit = 50, offset = 0 } = {}) {
  const { rows } = await query(
    `SELECT id, tenant_id AS "tenantId", sku, status, billing_provider AS "billingProvider",
            external_ref AS "externalRef", meta, created_at AS "createdAt", updated_at AS "updatedAt"
     FROM commercial_entitlement ORDER BY updated_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

export async function insertEntitlementStub({ tenantId, sku, billingProvider, meta }) {
  const { rows } = await query(
    `INSERT INTO commercial_entitlement (tenant_id, sku, billing_provider, meta)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [tenantId, sku || 'UNCONFIGURED', billingProvider || 'unconfigured', meta ?? null]
  );
  return rows[0];
}

export async function listFeatureFlags() {
  const { rows } = await query(
    `SELECT id, flag_key AS "flagKey", environment, enabled, meta, updated_at AS "updatedAt"
     FROM environment_feature_flag ORDER BY environment, flag_key`
  );
  return rows;
}

export async function upsertFeatureFlag({ flagKey, environment, enabled, meta }) {
  const { rows } = await query(
    `INSERT INTO environment_feature_flag (flag_key, environment, enabled, meta)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (flag_key, environment)
     DO UPDATE SET enabled = EXCLUDED.enabled, meta = EXCLUDED.meta, updated_at = now()
     RETURNING id, flag_key AS "flagKey", environment, enabled, meta, updated_at AS "updatedAt"`,
    [flagKey, environment || 'default', Boolean(enabled), meta ?? null]
  );
  return rows[0];
}
