#!/usr/bin/env node
/**
 * Proof harness: tenant-admin direct RPC path (DDR probe + optional allow-listed write).
 *
 * Prerequisites:
 *   - Tenant admin server: pnpm -C apps/tenant-admin start  (port 4520)
 *   - VISTA_* env vars set for server process
 *
 * Usage:
 *   node scripts/ddr-tenant-admin-proof.mjs
 *   node scripts/ddr-tenant-admin-proof.mjs --write --ien 46 --field .132 --value "555-0100"
 */
const BASE = process.env.TENANT_ADMIN_URL || 'http://127.0.0.1:4520';
const TENANT = process.env.TENANT_ID || 'proof-tenant';

async function get(path) {
  const u = `${BASE}/api/tenant-admin/v1/${path}${path.includes('?') ? '&' : '?'}tenantId=${encodeURIComponent(TENANT)}`;
  const r = await fetch(u);
  return { status: r.status, json: await r.json().catch(() => ({})) };
}

async function put(path, body) {
  const u = `${BASE}/api/tenant-admin/v1/${path}?tenantId=${encodeURIComponent(TENANT)}`;
  const r = await fetch(u, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, json: await r.json().catch(() => ({})) };
}

const args = process.argv.slice(2);
const doWrite = args.includes('--write');
const ienArg = args.indexOf('--ien');
const fieldArg = args.indexOf('--field');
const valueArg = args.indexOf('--value');
const ien = ienArg >= 0 ? args[ienArg + 1] : '46';
const field = fieldArg >= 0 ? args[fieldArg + 1] : '.132';
const value = valueArg >= 0 ? args[valueArg + 1] : `proof-${Date.now()}`;

console.log('--- ddr-tenant-admin-proof ---');
console.log('BASE', BASE, 'tenantId', TENANT);

const steps = [];

const v1 = await get('vista-status');
steps.push({ step: 'vista-status', pass: v1.status === 200 && v1.json.vista?.ok !== false, status: v1.status, body: v1.json });

const v2 = await get('vista/ddr-probe');
steps.push({ step: 'ddr-probe', pass: v2.status === 200 && v2.json.ok === true, status: v2.status, summary: v2.json.summary });

if (doWrite) {
  const v3 = await put(`users/${encodeURIComponent(ien)}`, { field, value });
  steps.push({
    step: 'ddr-filer-user-field',
    pass: v3.status === 200 && v3.json.ok === true,
    status: v3.status,
    body: v3.json,
  });
}

for (const s of steps) {
  console.log(s.step, s.pass ? 'PASS' : 'FAIL', s.status || '', s.summary || '');
  if (!s.pass && s.body) console.log(JSON.stringify(s.body, null, 2));
}

const allPass = steps.every(s => s.pass);
console.log('OVERALL', allPass ? 'PASS' : 'FAIL');
process.exit(allPass ? 0 : 1);
