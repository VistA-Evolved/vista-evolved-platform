#!/usr/bin/env node
/**
 * Tenant Admin Route Audit — tests every API route against live VistA.
 *
 * Usage: node scripts/audit-routes.mjs
 *
 * Requires: tenant-admin server running on port 4520, VistA Docker up.
 * Does NOT bypass auth — uses real login flow.
 *
 * Outputs a structured report: PASS / FAIL / WARN per route.
 */

const BASE = 'http://127.0.0.1:4520/api/tenant-admin/v1';
const TENANT = 'default-tenant';

let TOKEN = null;
let PASS = 0, FAIL = 0, WARN = 0, SKIP = 0;
const results = [];

async function api(method, path, body) {
  const url = `${BASE}${path}${path.includes('?') ? '&' : '?'}tenantId=${TENANT}`;
  const headers = { 'Content-Type': 'application/json' };
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, json };
}

function record(domain, route, method, status, httpCode, detail) {
  const sym = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : status === 'WARN' ? '⚠' : '○';
  if (status === 'PASS') PASS++;
  else if (status === 'FAIL') FAIL++;
  else if (status === 'WARN') WARN++;
  else SKIP++;
  results.push({ domain, route, method, status, httpCode, detail });
  console.log(`  ${sym} [${status}] ${method} ${route} → ${httpCode} ${detail || ''}`);
}

async function testRead(domain, path, expectData = true) {
  try {
    const r = await api('GET', path);
    if (r.status === 200 && r.json.ok) {
      const hasData = r.json.data && (Array.isArray(r.json.data) ? r.json.data.length > 0 : Object.keys(r.json.data).length > 0);
      if (expectData && !hasData) {
        record(domain, path, 'GET', 'WARN', r.status, `ok=true but empty data`);
      } else {
        const count = Array.isArray(r.json.data) ? `${r.json.data.length} items` : 'object';
        record(domain, path, 'GET', 'PASS', r.status, `source=${r.json.source || 'vista'} ${count}`);
      }
    } else if (r.status === 501) {
      record(domain, path, 'GET', 'WARN', r.status, `integration-pending: ${r.json.error || ''}`);
    } else {
      record(domain, path, 'GET', 'FAIL', r.status, r.json.error || JSON.stringify(r.json).slice(0, 120));
    }
    return r;
  } catch (e) {
    record(domain, path, 'GET', 'FAIL', 0, `fetch error: ${e.message}`);
    return null;
  }
}

async function testCreate(domain, path, body, label) {
  try {
    const r = await api('POST', path, body);
    if (r.status === 200 && r.json.ok) {
      record(domain, path, 'POST', 'PASS', r.status, `${label} created: ${r.json.newIen || r.json.lines?.[0] || 'ok'}`);
    } else if (r.status === 501 || r.status === 502) {
      record(domain, path, 'POST', 'WARN', r.status, r.json.error || 'write issue');
    } else {
      record(domain, path, 'POST', 'FAIL', r.status, r.json.error || JSON.stringify(r.json).slice(0, 120));
    }
    return r;
  } catch (e) {
    record(domain, path, 'POST', 'FAIL', 0, `fetch error: ${e.message}`);
    return null;
  }
}

async function testUpdate(domain, path, body, label) {
  try {
    const r = await api('PUT', path, body);
    if (r.status === 200 && r.json.ok) {
      record(domain, path, 'PUT', 'PASS', r.status, `${label} updated`);
    } else if (r.status === 501 || r.status === 502) {
      record(domain, path, 'PUT', 'WARN', r.status, r.json.error || 'write issue');
    } else {
      record(domain, path, 'PUT', 'FAIL', r.status, r.json.error || JSON.stringify(r.json).slice(0, 120));
    }
    return r;
  } catch (e) {
    record(domain, path, 'PUT', 'FAIL', 0, `fetch error: ${e.message}`);
    return null;
  }
}

// ============================================================================
// MAIN AUDIT
// ============================================================================
async function main() {
  console.log('=== Tenant Admin Route Audit ===');
  console.log(`Server: ${BASE}`);
  console.log(`Tenant: ${TENANT}`);
  console.log('');

  // 0. Pre-flight: VistA status (no auth required)
  console.log('--- PRE-FLIGHT ---');
  const vistaStatus = await testRead('pre-flight', '/vista-status', false);
  if (!vistaStatus || !vistaStatus.json.ok) {
    console.log('\nFATAL: VistA not reachable. Aborting audit.');
    process.exit(1);
  }

  // 1. Auth
  console.log('\n--- AUTH ---');
  const loginRes = await api('POST', '/auth/login', {
    accessCode: 'PRO1234', verifyCode: 'PRO1234!!', tenantId: TENANT
  });
  if (loginRes.status === 200 && loginRes.json.ok) {
    TOKEN = loginRes.json.token;
    record('auth', '/auth/login', 'POST', 'PASS', 200, `DUZ=${loginRes.json.user.duz} keys=${loginRes.json.user.keys.length}`);
  } else {
    record('auth', '/auth/login', 'POST', 'FAIL', loginRes.status, loginRes.json.error);
    console.log('\nFATAL: Login failed. Aborting.');
    process.exit(1);
  }

  const sessionRes = await testRead('auth', '/auth/session', false);

  // 2. Dashboard
  console.log('\n--- DASHBOARD ---');
  await testRead('dashboard', '/dashboard');

  // 3. DDR Probe
  console.log('\n--- VISTA TOOLS ---');
  await testRead('tools', '/vista/ddr-probe', false);

  // 4. Users & Access
  console.log('\n--- USERS & ACCESS ---');
  const usersRes = await testRead('users', '/users');
  const firstUserIen = usersRes?.json?.data?.[0]?.ien;
  if (firstUserIen) {
    await testRead('users', `/users/${firstUserIen}`);
  }
  await testRead('users', '/roles');
  await testRead('users', '/key-inventory');
  await testRead('users', '/esig-status');
  await testRead('users', '/titles');

  // User CRUD: create, update, key assign/remove, esig, deactivate/reactivate, rename, clone
  const testUserName = `TESTAUDIT,USER${Date.now() % 10000}`;
  const createUserRes = await testCreate('users', '/users', { name: testUserName }, 'user');
  const newUserIen = createUserRes?.json?.newIen;
  if (newUserIen) {
    await testUpdate('users', `/users/${newUserIen}`, { field: '.132', value: '555-0199' }, 'user phone');
    await testCreate('users', `/users/${newUserIen}/keys`, { keyName: 'PROVIDER' }, 'key assign');
    await testCreate('users', `/users/${newUserIen}/esig`, { code: 'TESTSIG123' }, 'esig set');
    await testCreate('users', `/users/${newUserIen}/provider`, { field: 'npi', value: '1234567890' }, 'provider NPI');
    await testUpdate('users', `/users/${newUserIen}/credentials`, {}, 'credentials reset');
    await testUpdate('users', `/users/${newUserIen}/rename`, { newName: `TESTAUDIT,RENAMED${Date.now() % 1000}` }, 'rename');
    await testCreate('users', `/users/${newUserIen}/deactivate`, {}, 'deactivate');
    await testCreate('users', `/users/${newUserIen}/reactivate`, {}, 'reactivate');
    // Clone requires sourceDuz + newName
    await testCreate('users', '/users/clone', { sourceDuz: newUserIen, newName: `TESTAUDIT,CLONED${Date.now() % 1000}` }, 'clone');
  }

  // 5. Facilities & Locations
  console.log('\n--- FACILITIES & LOCATIONS ---');
  await testRead('facilities', '/facilities');
  await testRead('facilities', '/topology');
  const clinicsRes = await testRead('facilities', '/clinics');
  const firstClinicIen = clinicsRes?.json?.data?.[0]?.ien;
  if (firstClinicIen) {
    await testRead('facilities', `/clinics/${firstClinicIen}`);
    await testRead('facilities', `/clinics/${firstClinicIen}/availability`);
  }
  const wardsRes = await testRead('facilities', '/wards');
  const firstWardIen = wardsRes?.json?.data?.[0]?.ien;
  if (firstWardIen) {
    await testRead('facilities', `/wards/${firstWardIen}`);
  }
  await testRead('facilities', '/room-beds');
  await testRead('facilities', '/treating-specialties');
  await testRead('facilities', '/appointment-types');
  await testRead('facilities', '/stop-codes');

  // Clinic CRUD
  const testClinicName = `AUDIT CLINIC ${Date.now() % 10000}`;
  const createClinicRes = await testCreate('facilities', '/clinics', { name: testClinicName }, 'clinic');
  const newClinicIen = createClinicRes?.json?.newIen;
  if (newClinicIen) {
    await testUpdate('facilities', `/clinics/${newClinicIen}`, { name: `${testClinicName} EDITED` }, 'clinic name');
    await testUpdate('facilities', `/clinics/${newClinicIen}/fields`, { field: '1912', value: '30' }, 'appt length');
    await testCreate('facilities', `/clinics/${newClinicIen}/inactivate`, {}, 'inactivate');
    await testCreate('facilities', `/clinics/${newClinicIen}/reactivate`, {}, 'reactivate');
  }

  // Ward CRUD
  const testWardName = `AUDIT WARD ${Date.now() % 10000}`;
  await testCreate('facilities', '/wards', { name: testWardName }, 'ward');

  // Room-Bed, Appointment Type, Title, Security Key CREATEs
  await testCreate('facilities', '/room-beds', { name: `AUD-${Date.now() % 1000}` }, 'room-bed');
  await testCreate('facilities', '/appointment-types', { name: `AUDIT APPT TYPE ${Date.now() % 1000}` }, 'appt type');
  await testCreate('users', '/titles', { name: `AUDIT TITLE ${Date.now() % 1000}` }, 'title');
  await testCreate('users', '/security-keys', { name: `ZVEAUDIT${Date.now() % 100}` }, 'security key');

  // 6. Clinical Config
  console.log('\n--- CLINICAL CONFIG ---');
  await testRead('clinical', '/health-summary-types');
  const hsRes = await testRead('clinical', '/health-summary-types');
  const firstHsIen = hsRes?.json?.data?.[0]?.ien;
  if (firstHsIen) {
    await testRead('clinical', `/health-summary-types/${firstHsIen}`);
    await testRead('clinical', `/health-summary-types/${firstHsIen}/components`);
  }
  await testRead('clinical', '/tiu-document-defs');
  const tiuRes = await testRead('clinical', '/tiu-document-defs');
  const firstTiuIen = tiuRes?.json?.data?.[0]?.ien;
  if (firstTiuIen) {
    await testRead('clinical', `/tiu-document-defs/${firstTiuIen}`);
  }
  await testRead('clinical', '/quick-orders');
  await testRead('clinical', '/order-sets');
  await testRead('clinical', '/orderable-items');
  await testRead('clinical', '/drug-file');
  const drugRes = await testRead('clinical', '/drug-file');
  const firstDrugIen = drugRes?.json?.data?.[0]?.ien;
  if (firstDrugIen) {
    await testRead('clinical', `/drug-file/${firstDrugIen}`);
  }
  await testRead('clinical', '/lab-tests');
  const labRes = await testRead('clinical', '/lab-tests');
  const firstLabIen = labRes?.json?.data?.[0]?.ien;
  if (firstLabIen) {
    await testRead('clinical', `/lab-tests/${firstLabIen}`);
  }
  await testRead('clinical', '/radiology-procedures');

  // 7. Billing & Insurance
  console.log('\n--- BILLING & INSURANCE ---');
  await testRead('billing', '/billing-params');
  await testRead('billing', '/insurance-companies');
  const insRes = await testRead('billing', '/insurance-companies');
  const firstInsIen = insRes?.json?.data?.[0]?.ien;
  if (firstInsIen) {
    await testRead('billing', `/insurance-companies/${firstInsIen}`);
  }
  await testCreate('billing', '/insurance-companies', { name: `AUDIT INS CO ${Date.now() % 1000}` }, 'insurance co');

  // 8. System & Kernel
  console.log('\n--- SYSTEM & KERNEL ---');
  await testRead('system', '/params/kernel');
  await testRead('system', '/packages');
  const pkgRes = await testRead('system', '/packages');
  const firstPkgIen = pkgRes?.json?.data?.[0]?.ien;
  if (firstPkgIen) {
    await testRead('system', `/packages/${firstPkgIen}`);
  }
  await testRead('system', '/menu-options');
  const menuRes = await testRead('system', '/menu-options');
  const firstMenuIen = menuRes?.json?.data?.[0]?.ien;
  if (firstMenuIen) {
    await testRead('system', `/menu-options/${firstMenuIen}`);
    await testRead('system', `/menu-options/${firstMenuIen}/children`);
  }
  await testRead('system', '/bulletins');
  await testRead('system', '/error-trap');
  await testRead('system', '/taskman-tasks');
  await testRead('system', '/taskman/status');
  await testRead('system', '/taskman/scheduled');

  // 9. Devices & Connectivity
  console.log('\n--- DEVICES & CONNECTIVITY ---');
  await testRead('devices', '/devices');
  const devRes = await testRead('devices', '/devices');
  const firstDevIen = devRes?.json?.data?.[0]?.ien;
  if (firstDevIen) {
    await testRead('devices', `/devices/${firstDevIen}`);
  }
  await testRead('devices', '/terminal-types');
  const ttRes = await testRead('devices', '/terminal-types');
  const firstTtIen = ttRes?.json?.data?.[0]?.ien;
  if (firstTtIen) {
    await testRead('devices', `/terminal-types/${firstTtIen}`);
  }
  await testRead('devices', '/hl7-interfaces');
  const hl7Res = await testRead('devices', '/hl7-interfaces');
  const firstHl7Ien = hl7Res?.json?.data?.[0]?.ien;
  if (firstHl7Ien) {
    await testRead('devices', `/hl7-interfaces/${firstHl7Ien}`);
    await testRead('devices', `/hl7/filer-status`);
    await testRead('devices', `/hl7/link-status/${firstHl7Ien}`);
  }

  // 10. MailMan
  console.log('\n--- MAILMAN ---');
  await testRead('mailman', '/mail-groups');
  const mgRes = await testRead('mailman', '/mail-groups');
  const firstMgIen = mgRes?.json?.data?.[0]?.ien;
  if (firstMgIen) {
    await testRead('mailman', `/mail-groups/${firstMgIen}`);
    await testRead('mailman', `/mail-groups/${firstMgIen}/members`);
  }

  // ===== SUMMARY =====
  console.log('\n========================================');
  console.log('         ROUTE AUDIT SUMMARY');
  console.log('========================================');
  console.log(`  PASS: ${PASS}`);
  console.log(`  FAIL: ${FAIL}`);
  console.log(`  WARN: ${WARN}`);
  console.log(`  SKIP: ${SKIP}`);
  console.log(`  TOTAL: ${PASS + FAIL + WARN + SKIP}`);
  console.log('');

  if (FAIL > 0) {
    console.log('--- FAILURES ---');
    for (const r of results.filter(r => r.status === 'FAIL')) {
      console.log(`  ✗ ${r.method} ${r.route} → ${r.httpCode} ${r.detail}`);
    }
    console.log('');
  }

  if (WARN > 0) {
    console.log('--- WARNINGS (integration-pending / empty data) ---');
    for (const r of results.filter(r => r.status === 'WARN')) {
      console.log(`  ⚠ ${r.method} ${r.route} → ${r.httpCode} ${r.detail}`);
    }
    console.log('');
  }

  // Domain coverage summary
  const domains = [...new Set(results.map(r => r.domain))];
  console.log('--- DOMAIN COVERAGE ---');
  for (const d of domains) {
    const dr = results.filter(r => r.domain === d);
    const dp = dr.filter(r => r.status === 'PASS').length;
    const df = dr.filter(r => r.status === 'FAIL').length;
    const dw = dr.filter(r => r.status === 'WARN').length;
    console.log(`  ${d}: ${dp}/${dr.length} pass, ${df} fail, ${dw} warn`);
  }

  // Write JSON report
  const report = {
    timestamp: new Date().toISOString(),
    server: BASE,
    tenant: TENANT,
    summary: { pass: PASS, fail: FAIL, warn: WARN, skip: SKIP, total: PASS + FAIL + WARN + SKIP },
    results,
  };

  const fs = await import('node:fs');
  const outPath = new URL('../artifacts/route-audit.json', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
  fs.mkdirSync(new URL('../artifacts', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nReport written to: ${outPath}`);
}

main().catch(e => { console.error(e); process.exit(1); });
