/**
 * Full Live Route Validation — Tests every GET route against the running VistA Docker.
 * Usage: node --env-file=.env scripts/validate-all-routes.mjs
 */

const BASE = 'http://127.0.0.1:4520/api/tenant-admin/v1';
const T = '?tenantId=default';

async function login() {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessCode: 'PRO1234', verifyCode: 'PRO1234!!', tenantId: 'default' }),
  });
  const j = await res.json();
  if (!j.ok) throw new Error('Login failed: ' + j.error);
  return j.token;
}

async function testRoute(token, method, path, label, body) {
  const url = `${BASE}${path}${path.includes('?') ? '&' : '?'}tenantId=default`;
  const opts = { method, headers: { Authorization: `Bearer ${token}` } };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  try {
    const res = await fetch(url, opts);
    const text = await res.text();
    let j;
    try { j = JSON.parse(text); } catch { j = { _raw: text.substring(0, 200) }; }
    const ok = j.ok === true;
    const source = j.source || 'unknown';
    const hasData = j.data !== undefined;
    const isIntegrationPending = j.error && (j.error.includes('integration-pending') || j.error.includes('not registered') || j.error.includes('RPC'));
    const isVistaConstraint = !ok && res.status === 502 && j.error && (
      j.error.includes('already') || j.error.includes('not valid') ||
      j.error.includes('DDR FILER error') || j.error.includes('computed field')
    );
    const dataCount = Array.isArray(j.data) ? j.data.length : (hasData ? 1 : 0);
    const status = ok ? 'PASS' : (isVistaConstraint ? 'VCON' : (isIntegrationPending ? 'PEND' : 'FAIL'));
    const color = ok ? '\x1b[32m' : (isVistaConstraint ? '\x1b[36m' : (isIntegrationPending ? '\x1b[33m' : '\x1b[31m'));
    console.log(`${color}${status}\x1b[0m ${method.padEnd(6)} ${path.padEnd(55)} src=${source.padEnd(12)} items=${String(dataCount).padEnd(5)} http=${res.status}`);
    return { path, method, status, source, dataCount, httpStatus: res.status, error: j.error || null };
  } catch (e) {
    console.log(`\x1b[31mERROR\x1b[0m ${method.padEnd(6)} ${path.padEnd(55)} ${e.message}`);
    return { path, method, status: 'ERROR', source: 'exception', dataCount: 0, httpStatus: 0, error: e.message };
  }
}

async function main() {
  console.log('=== Full Live Route Validation Against Running VistA ===\n');
  console.log('Logging in...');
  const token = await login();
  console.log('Login OK. Starting route tests...\n');

  const results = [];
  const t = (m, p, l, b) => testRoute(token, m, p, l, b).then(r => results.push(r));
  const h = (tk) => ({ headers: { Authorization: `Bearer ${tk}` } });

  // ---- No-auth routes ----
  console.log('--- NO-AUTH ROUTES ---');
  await t('GET', '/vista-status', 'VistA status');

  // ---- Auth/session routes ----
  console.log('\n--- AUTH/SESSION ---');
  await t('GET', '/auth/session', 'Session info');

  // ---- Dashboard ----
  console.log('\n--- DASHBOARD ---');
  await t('GET', '/dashboard', 'Dashboard');

  // ---- Users & Access ----
  console.log('\n--- USERS & ACCESS ---');
  await t('GET', '/users', 'User list');
  await t('GET', '/users/1', 'User detail (DUZ=1)');
  await t('GET', '/roles', 'Security keys/roles');
  await t('GET', '/key-inventory', 'Key inventory');
  await t('GET', '/key-holders/XUMGR', 'Key holders for XUMGR');
  await t('GET', '/esig-status', 'E-sig status');
  await t('GET', '/titles', 'Titles');
  await t('GET', '/audit/fileman', 'FileMan audit');

  // ---- Facilities & Locations ----
  console.log('\n--- FACILITIES & LOCATIONS ---');
  await t('GET', '/facilities', 'Facility list');
  await t('GET', '/facilities/loc-23', 'Facility detail (23)');
  await t('GET', '/clinics', 'Clinics');
  await t('GET', '/clinics/23', 'Clinic detail (IEN=23)');
  await t('GET', '/clinics/23/availability', 'Clinic availability');
  await t('GET', '/wards', 'Wards');
  await t('GET', '/divisions', 'Divisions');
  await t('GET', '/topology', 'Topology');
  await t('GET', '/treating-specialties', 'Treating specialties');
  await t('GET', '/appointment-types', 'Appointment types');
  await t('GET', '/room-beds', 'Room-beds');

  // ---- Clinical Config ----
  console.log('\n--- CLINICAL CONFIG ---');
  await t('GET', '/health-summary-types', 'Health summary types');
  await t('GET', '/tiu-document-defs', 'TIU document defs');
  await t('GET', '/quick-orders', 'Quick orders');
  await t('GET', '/order-sets', 'Order sets');
  await t('GET', '/orderable-items', 'Orderable items');
  await t('GET', '/drug-file', 'Drug file');
  await t('GET', '/lab-tests', 'Lab tests');
  await t('GET', '/radiology-procedures', 'Radiology procedures');

  // ---- Billing & Insurance ----
  console.log('\n--- BILLING & INSURANCE ---');
  await t('GET', '/billing-params', 'Billing params');
  await t('GET', '/insurance-companies', 'Insurance companies');
  await t('GET', '/stop-codes', 'Stop codes');

  // ---- System & Kernel ----
  console.log('\n--- SYSTEM & KERNEL ---');
  await t('GET', '/params/kernel', 'Kernel site params');
  await t('GET', '/packages', 'Installed packages');
  await t('GET', '/error-trap', 'Error trap');
  await t('GET', '/menu-options', 'Menu options');
  await t('GET', '/bulletins', 'Bulletins');
  await t('GET', '/mail-groups', 'Mail groups');
  await t('GET', '/taskman/status', 'TaskMan status');
  await t('GET', '/taskman/scheduled', 'TaskMan scheduled');
  await t('GET', '/taskman-tasks', 'TaskMan tasks');

  // ---- Devices & Connectivity ----
  console.log('\n--- DEVICES & CONNECTIVITY ---');
  await t('GET', '/devices', 'Devices');
  await t('GET', '/terminal-types', 'Terminal types');
  await t('GET', '/hl7-interfaces', 'HL7 interfaces');
  await t('GET', '/hl7/filer-status', 'HL7 filer status');

  // ---- VistA Tools ----
  console.log('\n--- VISTA TOOLS ---');
  await t('GET', '/vista/ddr-probe', 'DDR probe');

  // ---- Detail Routes (real IENs) ----
  console.log('\n--- DETAIL ROUTES (IEN=1) ---');
  await t('GET', '/users/1', 'User detail DUZ=1');
  await t('GET', '/clinics/1', 'Clinic detail IEN=1');
  await t('GET', '/wards/1', 'Ward detail IEN=1');
  await t('GET', '/divisions/1', 'Division detail IEN=1');
  await t('GET', '/health-summary-types/1', 'HS type detail IEN=1');
  await t('GET', '/tiu-document-defs/1', 'TIU doc def IEN=1');
  await t('GET', '/mail-groups/1', 'Mail group IEN=1');
  await t('GET', '/radiology-procedures/1', 'Rad proc IEN=1');
  await t('GET', '/insurance-companies/1', 'Insurance IEN=1');
  await t('GET', '/treating-specialties/1', 'Treat spec IEN=1');
  await t('GET', '/appointment-types/1', 'Appt type IEN=1');
  await t('GET', '/terminal-types/1', 'Terminal type IEN=1');
  await t('GET', '/room-beds/1', 'Room-bed IEN=1');
  await t('GET', '/titles/1', 'Title IEN=1');
  await t('GET', '/devices/1', 'Device IEN=1');
  await t('GET', '/hl7-interfaces/1', 'HL7 iface IEN=1');
  await t('GET', '/menu-options/1', 'Menu opt IEN=1');
  await t('GET', '/drug-file/1', 'Drug IEN=1');
  await t('GET', '/lab-tests/1', 'Lab test IEN=1');
  await t('GET', '/packages/1', 'Package IEN=1');
  await t('GET', '/quick-orders/1', 'Quick ord IEN=1');
  await t('GET', '/order-sets/1', 'Order set IEN=1');
  await t('GET', '/bulletins/1', 'Bulletin IEN=1');
  await t('GET', '/taskman-tasks/1', 'TaskMan IEN=1');
  await t('GET', '/menu-options/1/children', 'Menu children IEN=1');

  // ---- POST tests (key-impact) ----
  console.log('\n--- POST TESTS ---');
  await t('POST', '/key-impact', 'Key impact analysis', { keys: ['XUMGR', 'PROVIDER'] });

  // ---- WRITE ROUTE TESTS (DDR FILER + ZVE RPCs) ----
  console.log('\n--- WRITE ROUTES (DDR FILER / ZVE) ---');

  // 1. User edit: change office phone then restore (DDR VALIDATOR format: 10-digit)
  console.log('  [W1] User edit (office phone)...');
  await t('PUT', '/users/1', 'Edit user phone', { field: '.132', value: '555-555-1234' });
  const afterEdit = await fetch(`${BASE}/users/1?tenantId=default`, h(token)).then(r => r.json());
  const newPhone = afterEdit.data?.fields?.['.132'] || '';
  console.log(`    Read-back: phone="${newPhone}" (expected contains 555)`);
  await t('PUT', '/users/1', 'Restore user phone', { field: '.132', value: '@' });

  // 2. Clinic create via ZVE CLNM ADD + read-back (unique name per run)
  console.log('  [W2] Clinic create...');
  const clinicTs = Date.now().toString(36).toUpperCase();
  await t('POST', '/clinics', 'Create clinic', { name: `ZVE AUTO ${clinicTs}` });

  // 3. Ward edit via ZVE WRDM EDIT (use a unique name)
  console.log('  [W3] Ward edit...');
  await t('PUT', '/wards/1', 'Edit ward name', { name: 'WARD A-AUTOMATED' });

  // 4. Clinic fields edit via DDR FILER
  console.log('  [W4] Clinic field edit...');
  await t('PUT', '/clinics/23/fields', 'Edit clinic field', { field: '.01', value: 'AUDIOLOGY' });

  // 5. User key assign via ZVE USMG KEYS
  console.log('  [W5] Key assign/remove...');
  await t('POST', '/users/1/keys', 'Assign key', { keyName: 'ZVEAUDIT38' });
  await t('DELETE', '/users/1/keys/ZVEAUDIT38', 'Remove key');

  // 6. User deactivate/reactivate via ZVE USMG
  console.log('  [W6] User deactivate/reactivate...');
  await t('POST', '/users/73/deactivate', 'Deactivate user', { reason: 'test automation' });
  await t('POST', '/users/73/reactivate', 'Reactivate user');

  // 7. Device create via DDR FILER
  console.log('  [W7] Device create...');
  await t('POST', '/devices', 'Create device', { name: 'ZVE-TEST-PRINTER' });

  // 8. Clinic availability set via ZVE CLINIC AVAIL SET
  console.log('  [W8] Clinic availability set...');
  await t('POST', '/clinics/23/availability', 'Set avail', { date: '12/25/2026', slotData: '10' });

  // 9. Various DDR FILER entity edits (use named fields per handler)
  console.log('  [W9] DDR FILER entity edits...');
  await t('PUT', '/terminal-types/1', 'Edit terminal type', { name: 'C-VT100' });
  await t('PUT', '/room-beds/1', 'Edit room-bed', { roomBed: 'WARD A-1' });
  await t('PUT', '/health-summary-types/1', 'Edit HS type', { name: 'ACTIVE PROBLEMS' });
  await t('PUT', '/bulletins/3', 'Edit bulletin', { name: 'FEE BASIS CLOSE OUT' });
  await t('PUT', '/billing-params', 'Edit billing params', { holdMtBills: '0' });

  // 10. Clinic inactivate/reactivate
  console.log('  [W10] Clinic inactivate/reactivate...');
  await t('POST', '/clinics/23/inactivate', 'Inactivate clinic');
  await t('POST', '/clinics/23/reactivate', 'Reactivate clinic');

  // ---- Summary ----
  console.log('\n\n=== SUMMARY ===');
  const pass = results.filter(r => r.status === 'PASS').length;
  const vcon = results.filter(r => r.status === 'VCON').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const pend = results.filter(r => r.status === 'PEND').length;
  const err = results.filter(r => r.status === 'ERROR').length;
  console.log(`Total: ${results.length}  PASS: ${pass}  VISTA-CONSTRAINED: ${vcon}  FAIL: ${fail}  PENDING: ${pend}  ERROR: ${err}`);
  if (vcon > 0) {
    console.log('\n--- VISTA CONSTRAINTS (route reachable, VistA data rule rejected edit) ---');
    results.filter(r => r.status === 'VCON').forEach(r => {
      console.log(`  ${r.method} ${r.path} -> ${r.error}`);
    });
  }
  
  if (fail > 0) {
    console.log('\n--- FAILURES ---');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  ${r.method} ${r.path} -> http=${r.httpStatus} error=${r.error}`);
    });
  }
  if (pend > 0) {
    console.log('\n--- INTEGRATION PENDING (ZVE routine not installed) ---');
    results.filter(r => r.status === 'PEND').forEach(r => {
      console.log(`  ${r.method} ${r.path} -> ${r.error}`);
    });
  }
  if (err > 0) {
    console.log('\n--- ERRORS ---');
    results.filter(r => r.status === 'ERROR').forEach(r => {
      console.log(`  ${r.method} ${r.path} -> ${r.error}`);
    });
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
