#!/usr/bin/env node
/**
 * FIX 9 — Role Template Key Verification
 *
 * Extracts all unique security key names referenced by the 25 built-in role
 * templates and verifies each one exists in VistA SECURITY KEY file (#19.1)
 * via the tenant-admin /key-inventory API endpoint.
 *
 * Usage:
 *   node scripts/verify-role-keys.mjs
 *
 * Env:
 *   API_BASE  — tenant-admin API base (default: http://127.0.0.1:4520/api/tenant-admin/v1)
 *   AUTH_TOKEN — optional Bearer token for authenticated requests
 *
 * Output: JSON report to stdout, human-readable summary to stderr.
 */

// ── Import ROLES directly from the source ──────────────────────────────
// We use a dynamic import workaround since the source is JSX + named export.
// Instead, we hard-code the key list extracted from RoleTemplates.jsx.

const ROLE_KEYS = [
  'DG ADMIT', 'DG DISCHARGE', 'DG MENU', 'DG REGISTER', 'DG REGISTRATION',
  'DG SENSITIVITY', 'DG SUPERVISOR', 'DG TRANSFER', 'DGMEANS TEST',
  'GMRA-ALLERGY VERIFY', 'IBFIN', 'LRCAP', 'LRLAB', 'LRMGR', 'LRSUPER',
  'LRVERIFY', 'MAG CAPTURE', 'MAG SYSTEM', 'OR CPRS GUI CHART',
  'ORCL-PAT-RECS', 'ORCL-SIGN-NOTES', 'OREMAS', 'ORELSE', 'ORES',
  'PROVIDER', 'PSB NURSE', 'PSD PHARMACIST', 'PSDRPH', 'PSJ PHARMACIST',
  'PSO MANAGER', 'PSOINTERFACE', 'PSOPHARMACIST', 'PSORPH', 'RA ALLOC',
  'RA TECHNOLOGIST', 'SD SCHEDULING', 'SD SUPERVISOR', 'SDCLINICAL', 'SDMGR',
  'XUAUDITING', 'XUMGR', 'XUPROG', 'XUPROGMODE',
];

// Priority keys explicitly called out in the spec
const PRIORITY_KEYS = [
  'DG REGISTRATION', 'PSDRPH', 'LRMGR', 'RA TECHNOLOGIST',
  'MAG CAPTURE', 'IBFIN', 'XUAUDITING',
];

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:4520/api/tenant-admin/v1';

async function fetchKeyInventory() {
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.AUTH_TOKEN) {
    headers.Authorization = `Bearer ${process.env.AUTH_TOKEN}`;
  }
  const res = await fetch(`${API_BASE}/key-inventory`, { headers });
  if (!res.ok) throw new Error(`key-inventory returned ${res.status}: ${await res.text()}`);
  const body = await res.json();
  return body.data || body;
}

async function main() {
  const report = {
    timestamp: new Date().toISOString(),
    apiBase: API_BASE,
    totalRoleKeys: ROLE_KEYS.length,
    found: [],
    missing: [],
    priorityStatus: [],
  };

  process.stderr.write(`\n  Role Key Verification — ${ROLE_KEYS.length} keys to check\n`);
  process.stderr.write(`  API: ${API_BASE}\n\n`);

  let vistaKeys;
  try {
    vistaKeys = await fetchKeyInventory();
    process.stderr.write(`  ✓ Fetched ${vistaKeys.length} keys from VistA key inventory\n\n`);
  } catch (err) {
    process.stderr.write(`  ✗ Failed to fetch key inventory: ${err.message}\n`);
    process.stderr.write(`  Ensure the API server is running and accessible.\n`);
    report.error = err.message;
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  const vistaKeyNames = new Set(vistaKeys.map(k => (k.name || k.keyName || k).toString().toUpperCase()));

  for (const key of ROLE_KEYS) {
    if (vistaKeyNames.has(key.toUpperCase())) {
      report.found.push(key);
    } else {
      report.missing.push(key);
    }
  }

  // Priority key status
  for (const key of PRIORITY_KEYS) {
    const exists = vistaKeyNames.has(key.toUpperCase());
    report.priorityStatus.push({ key, exists });
    const icon = exists ? '✓' : '✗';
    process.stderr.write(`  ${icon} [PRIORITY] ${key}\n`);
  }

  process.stderr.write(`\n  ── Summary ──\n`);
  process.stderr.write(`  Total role keys:  ${ROLE_KEYS.length}\n`);
  process.stderr.write(`  Found in VistA:   ${report.found.length}\n`);
  process.stderr.write(`  Missing:          ${report.missing.length}\n`);

  if (report.missing.length > 0) {
    process.stderr.write(`\n  Missing keys:\n`);
    for (const key of report.missing) {
      process.stderr.write(`    - ${key}\n`);
    }
  }

  process.stderr.write(`\n`);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.missing.length > 0 ? 1 : 0);
}

main().catch(err => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(2);
});
