/**
 * Bootstrap repository — PostgreSQL persistence for drafts and requests.
 */
import { query, getClient } from '../db/pool.mjs';

// ---- Bootstrap Draft ----

export async function createDraft({ tenantName, legalMarketId, organization, packSelections, notes, createdBy }) {
  const { rows } = await query(
    `INSERT INTO bootstrap_draft (tenant_name, legal_market_id, organization, pack_selections, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [tenantName || null, legalMarketId || null, organization ? JSON.stringify(organization) : null,
     packSelections ? JSON.stringify(packSelections) : null, notes || null, createdBy]
  );
  return mapDraftRow(rows[0]);
}

export async function getDraftById(id) {
  const { rows } = await query('SELECT * FROM bootstrap_draft WHERE id = $1', [id]);
  return rows[0] ? mapDraftRow(rows[0]) : null;
}

export async function updateDraft(id, fields) {
  const sets = [];
  const params = [];
  let idx = 1;

  for (const [key, value] of Object.entries(fields)) {
    const col = camelToSnake(key);
    if (['organization', 'pack_selections'].includes(col)) {
      sets.push(`${col} = $${idx++}`);
      params.push(JSON.stringify(value));
    } else {
      sets.push(`${col} = $${idx++}`);
      params.push(value);
    }
  }
  sets.push('updated_at = now()');
  params.push(id);

  const { rows } = await query(
    `UPDATE bootstrap_draft SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );
  return rows[0] ? mapDraftRow(rows[0]) : null;
}

export async function transitionDraftStatus(id, toStatus) {
  const { rows } = await query(
    `UPDATE bootstrap_draft SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
    [toStatus, id]
  );
  return rows[0] ? mapDraftRow(rows[0]) : null;
}

// ---- Bootstrap Request ----

export async function createRequest({ draftId, tenantName, legalMarketId, organization, packSelections, validationResult, submittedBy }) {
  const { rows } = await query(
    `INSERT INTO bootstrap_request
       (draft_id, tenant_name, legal_market_id, organization, pack_selections, validation_result, submitted_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [draftId, tenantName, legalMarketId, JSON.stringify(organization),
     JSON.stringify(packSelections), validationResult ? JSON.stringify(validationResult) : null, submittedBy]
  );
  return mapRequestRow(rows[0]);
}

export async function getRequestById(id) {
  const { rows } = await query('SELECT * FROM bootstrap_request WHERE id = $1', [id]);
  return rows[0] ? mapRequestRow(rows[0]) : null;
}

export async function listRequests({ status, limit = 50, offset = 0 } = {}) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (status) {
    conditions.push(`status = $${idx++}`);
    params.push(status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit, offset);
  const sql = `SELECT * FROM bootstrap_request ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`;

  const { rows } = await query(sql, params);
  return rows.map(mapRequestRow);
}

export async function transitionRequestStatus(id, { toStatus, reviewedBy, reviewReason }) {
  const sets = ['status = $1', 'updated_at = now()'];
  const params = [toStatus];
  let idx = 2;

  if (reviewedBy) {
    sets.push(`reviewed_by = $${idx++}`);
    params.push(reviewedBy);
  }
  if (reviewReason) {
    sets.push(`review_reason = $${idx++}`);
    params.push(reviewReason);
  }
  params.push(id);

  const { rows } = await query(
    `UPDATE bootstrap_request SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );
  return rows[0] ? mapRequestRow(rows[0]) : null;
}

// ---- Helpers ----

function mapDraftRow(r) {
  return {
    id: r.id,
    tenantName: r.tenant_name,
    legalMarketId: r.legal_market_id,
    organization: r.organization,
    packSelections: r.pack_selections,
    notes: r.notes,
    status: r.status,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapRequestRow(r) {
  return {
    id: r.id,
    draftId: r.draft_id,
    tenantName: r.tenant_name,
    legalMarketId: r.legal_market_id,
    organization: r.organization,
    packSelections: r.pack_selections,
    status: r.status,
    validationResult: r.validation_result,
    submittedBy: r.submitted_by,
    reviewedBy: r.reviewed_by,
    reviewReason: r.review_reason,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function camelToSnake(str) {
  return str.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
}
