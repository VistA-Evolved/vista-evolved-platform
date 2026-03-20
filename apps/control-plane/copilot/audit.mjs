// ---------------------------------------------------------------------------
// Copilot audit / trace — append-only log of all copilot interactions
// ---------------------------------------------------------------------------
// Governed by: ai-assist-safety-spec.md §12 (audit and traceability)
// Service-map §7.2 rule 5: "AI actions are audit-logged"
// ---------------------------------------------------------------------------

/** @type {Array<AuditEntry>} */
const auditLog = [];
const MAX_ENTRIES = 500;

/**
 * @typedef {Object} AuditEntry
 * @property {string} id — unique trace id
 * @property {string} timestamp — ISO 8601
 * @property {'chat'|'tool-call'|'draft'|'error'} type
 * @property {string} [provider] — provider id
 * @property {string} [model] — model used
 * @property {string} [toolName] — tool invoked
 * @property {string} [toolCategory] — read-only | draft-only
 * @property {number} [durationMs]
 * @property {boolean} [ok]
 * @property {string} [error]
 * @property {Object} [usage] — token usage
 */

let traceCounter = 0;

function generateTraceId() {
  traceCounter += 1;
  return `copilot-${Date.now()}-${traceCounter}`;
}

export function logCopilotEvent(entry) {
  const record = {
    id: generateTraceId(),
    timestamp: new Date().toISOString(),
    ...entry,
  };
  auditLog.push(record);
  // Ring buffer — drop oldest when full
  if (auditLog.length > MAX_ENTRIES) {
    auditLog.shift();
  }
  return record.id;
}

export function getAuditLog(limit = 50) {
  return auditLog.slice(-limit);
}

export function getAuditLogLength() {
  return auditLog.length;
}
