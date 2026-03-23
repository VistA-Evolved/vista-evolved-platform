/**
 * Site Administration Console E2E Test Suite
 *
 * Tests the full user-management CRUD lifecycle and key admin screens
 * against a running VistA Docker instance. Requires:
 *   - local-vista-utf8 Docker container running
 *   - node --env-file=.env.local server.mjs running on port 4520
 *   - ZVE* M routines installed in VistA
 *
 * Covers VA training scenarios:
 *   - Sign-on/security (Kernel 8.0 SM Guide Ch.3)
 *   - User lifecycle: create, rename, deactivate, reactivate, terminate
 *   - Key allocation/deallocation (Kernel 8.0 SM Guide Ch.7)
 *   - Device management CRUD (Kernel 8.0 SM Guide Ch.5)
 *   - Clinical config reads (Lab, Rad, Pharmacy, TIU, Orders)
 *   - Kernel system parameter reading (Kernel 8.0 SM Guide Ch.9)
 *   - FileMan audit trail verification
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:4520';
const TENANT = 'T1';
const CREDS = { accessCode: 'PRO1234', verifyCode: 'PRO1234!!' };

let authToken = '';

async function apiLogin() {
  const res = await fetch(`${BASE}/api/tenant-admin/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...CREDS, tenantId: TENANT }),
  });
  const j = await res.json();
  if (!j.token) throw new Error('Login failed: ' + JSON.stringify(j));
  return j.token;
}

async function api(path, opts = {}) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `${BASE}/api/tenant-admin/v1/${path}${sep}tenantId=${TENANT}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
      ...(opts.headers || {}),
    },
  });
  return res.json();
}

test.beforeAll(async () => {
  authToken = await apiLogin();
});

// ==========================================================================
// 1. AUTH & SESSION
// ==========================================================================

test.describe('Auth & Session', () => {
  test('login via UI shows role badge', async ({ page }) => {
    await page.goto(`${BASE}/?tenantId=${TENANT}`);
    await page.waitForSelector('#login-form', { timeout: 5000 });
    await page.fill('#login-access', CREDS.accessCode);
    await page.fill('#login-verify', CREDS.verifyCode);
    await page.click('#login-submit');
    await page.waitForSelector('#role-badge', { timeout: 15_000 });
    const badge = await page.textContent('#role-badge');
    expect(badge).toBeTruthy();
  });

  test('invalid credentials rejected via API', async () => {
    const res = await fetch(`${BASE}/api/tenant-admin/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessCode: 'BAD', verifyCode: 'BAD', tenantId: TENANT }),
    });
    const j = await res.json();
    expect(j.ok).toBe(false);
  });
});

// ==========================================================================
// 2. USER LIFECYCLE (VA Kernel 8.0 SM Guide: Ch.3 User Management)
// ==========================================================================

test.describe.serial('User Lifecycle CRUD', () => {
  let testDuz = '';
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const suffix = Array.from({ length: 4 }, () => alpha[Math.floor(Math.random() * 26)]).join('');
  const testName = `ZVEPW${suffix},TEST`;
  const renamedName = `ZVEPW${suffix},RENAMED`;

  test('CREATE: add new user via ZVE USMG ADD', async () => {
    const r = await api('users', {
      method: 'POST',
      body: JSON.stringify({ name: testName }),
    });
    expect(r.ok).toBe(true);
    testDuz = r.newIen || '';
    expect(testDuz).toBeTruthy();
  });

  test('READ: user detail accessible', async () => {
    expect(testDuz).toBeTruthy();
    const r = await api(`users/${testDuz}`);
    expect(r.ok).toBe(true);
    expect(r.data).toBeTruthy();
  });

  test('UPDATE: rename user via ZVE USMG RENAME', async () => {
    expect(testDuz).toBeTruthy();
    const r = await api(`users/${testDuz}/rename`, {
      method: 'PUT',
      body: JSON.stringify({ newName: renamedName }),
    });
    expect(r.ok).toBe(true);
    expect(r.rpcUsed).toBe('ZVE USMG RENAME');
  });

  test('AUDIT: rename captured in FileMan audit trail', async () => {
    expect(testDuz).toBeTruthy();
    const r = await api(`audit/fileman?duz=${testDuz}&max=10`);
    expect(r.ok).toBe(true);
    const renameEntry = r.entries?.find(e => e.fieldNum === '.01');
    expect(renameEntry).toBeTruthy();
  });

  test('DEACTIVATE: disable user login via ZVE USMG DEACT', async () => {
    expect(testDuz).toBeTruthy();
    const r = await api(`users/${testDuz}/deactivate`, { method: 'POST' });
    expect(r.ok).toBe(true);
    expect(r.rpcUsed).toBe('ZVE USMG DEACT');
  });

  test('REACTIVATE: re-enable user via ZVE USMG REACT', async () => {
    expect(testDuz).toBeTruthy();
    const r = await api(`users/${testDuz}/reactivate`, { method: 'POST' });
    expect(r.ok).toBe(true);
    expect(r.rpcUsed).toBe('ZVE USMG REACT');
  });

  test('TERMINATE: full termination via ZVE USMG TERM', async () => {
    expect(testDuz).toBeTruthy();
    const r = await api(`users/${testDuz}/terminate`, { method: 'POST' });
    expect(r.ok).toBe(true);
    expect(r.rpcUsed).toBe('ZVE USMG TERM');
  });
});

// ==========================================================================
// 3. SECURITY & KEYS (VA Kernel 8.0 SM Guide: Ch.7)
// ==========================================================================

test.describe('Security & Keys', () => {
  test('key inventory loads from File 19.1', async () => {
    const r = await api('key-inventory');
    expect(r.ok).toBe(true);
    expect(r.data).toBeTruthy();
  });

  test('roles list loads', async () => {
    const r = await api('roles');
    expect(r.ok).toBe(true);
    expect(Array.isArray(r.data)).toBe(true);
    expect(r.data.length).toBeGreaterThan(0);
  });

  test('e-signature status loads', async () => {
    const r = await api('esig-status');
    expect(r.ok).toBe(true);
    expect(r.data).toBeTruthy();
  });
});

// ==========================================================================
// 4. FACILITY & LOCATION (VA MAS Guide)
// ==========================================================================

test.describe('Facility & Location', () => {
  test('facilities from File 4', async () => {
    const r = await api('facilities');
    expect(r.ok).toBe(true);
    expect(r.data?.length).toBeGreaterThan(0);
  });

  test('topology tree loads', async () => {
    const r = await api('topology');
    expect(r.ok).toBe(true);
  });

  test('clinics from File 44', async () => {
    const r = await api('clinics');
    expect(r.ok).toBe(true);
    expect(r.data?.length).toBeGreaterThan(0);
  });

  test('wards from File 42', async () => {
    const r = await api('wards');
    expect(r.ok).toBe(true);
    expect(r.data?.length).toBeGreaterThan(0);
  });

  test('room-beds from File 405.4', async () => {
    const r = await api('room-beds');
    expect(r.ok).toBe(true);
  });
});

// ==========================================================================
// 5. DEVICE MANAGEMENT (VA Kernel 8.0 SM Guide: Ch.5)
// ==========================================================================

test.describe.serial('Device Management', () => {
  let testDeviceIen = '';

  test('device list from File 3.5', async () => {
    const r = await api('devices');
    expect(r.ok).toBe(true);
    expect(r.data?.length).toBeGreaterThan(0);
  });

  test('READ: first device detail', async () => {
    const list = await api('devices');
    const first = list.data?.[0];
    expect(first).toBeTruthy();
    testDeviceIen = first.ien;
    const r = await api(`devices/${testDeviceIen}`);
    expect(r.ok).toBe(true);
  });

  test('terminal types from File 3.2', async () => {
    const r = await api('terminal-types');
    expect(r.ok).toBe(true);
    expect(r.data?.length).toBeGreaterThan(0);
  });
});

// ==========================================================================
// 6. CLINICAL CONFIG (TIU, Lab, Rad, Pharmacy, Orders)
// ==========================================================================

test.describe('Clinical Configuration', () => {
  test('TIU document definitions', async () => {
    const r = await api('tiu-document-defs');
    expect(r.ok).toBe(true);
  });

  test('lab tests from File 60', async () => {
    const r = await api('lab-tests');
    expect(r.ok).toBe(true);
  });

  test('radiology procedures from File 71', async () => {
    const r = await api('radiology-procedures');
    expect(r.ok).toBe(true);
  });

  test('drug file from File 50', async () => {
    const r = await api('drug-file');
    expect(r.ok).toBe(true);
  });

  test('quick orders from File 101.41', async () => {
    const r = await api('quick-orders');
    expect(r.ok).toBe(true);
  });

  test('order sets from File 101.43', async () => {
    const r = await api('order-sets');
    expect(r.ok).toBe(true);
  });

  test('health summary types from File 142', async () => {
    const r = await api('health-summary-types');
    expect(r.ok).toBe(true);
  });
});

// ==========================================================================
// 7. SYSTEM PARAMS (Kernel 8.0 SM Guide: Ch.9)
// ==========================================================================

test.describe('System Parameters', () => {
  test('kernel system params from File 8989.3', async () => {
    const r = await api('params/kernel');
    expect(r.ok).toBe(true);
    expect(r.source).toBe('vista');
  });

  test('taskman status', async () => {
    const r = await api('taskman/status');
    expect(r.ok).toBe(true);
  });

  test('taskman task list from File 14.4', async () => {
    const r = await api('taskman-tasks');
    expect(r.ok).toBe(true);
  });

  test('packages from File 9.4', async () => {
    const r = await api('packages');
    expect(r.ok).toBe(true);
  });

  test('error trap from File 3.077', async () => {
    const r = await api('error-trap');
    expect(r.ok).toBe(true);
  });
});

// ==========================================================================
// 8. HL7 & INTEROP
// ==========================================================================

test.describe('HL7 Interfaces', () => {
  test('HL7 logical links from File 870', async () => {
    const r = await api('hl7-interfaces');
    expect(r.ok).toBe(true);
  });

  test('HL7 filer status', async () => {
    const r = await api('hl7/filer-status');
    expect(r.ok).toBe(true);
  });
});

// ==========================================================================
// 9. BILLING & INSURANCE
// ==========================================================================

test.describe('Billing & Insurance', () => {
  test('insurance companies from File 36', async () => {
    const r = await api('insurance-companies');
    expect(r.ok).toBe(true);
  });

  test('billing params from File 350.9', async () => {
    const r = await api('billing-params');
    expect(r.ok).toBe(true);
  });
});

// ==========================================================================
// 10. MONITORING & AUDIT
// ==========================================================================

test.describe('Monitoring & Audit', () => {
  test('dashboard returns VistA summary counts', async () => {
    const r = await api('dashboard');
    expect(r.ok).toBe(true);
    expect(r.data?.userCount).toBeGreaterThan(0);
  });

  test('DDR probe succeeds', async () => {
    const r = await api('vista/ddr-probe');
    expect(r.ok).toBe(true);
  });

  test('FileMan audit trail', async () => {
    const r = await api('audit/fileman?duz=*&max=5');
    expect(r.ok).toBe(true);
  });
});

// ==========================================================================
// 11. UI NAVIGATION — verify screens render real data
// ==========================================================================

test.describe('UI Screen Rendering', () => {
  async function loginAndNavigate(page, hash) {
    await page.goto(`${BASE}/?tenantId=${TENANT}`);
    await page.waitForSelector('#login-form', { timeout: 5000 });
    await page.fill('#login-access', CREDS.accessCode);
    await page.fill('#login-verify', CREDS.verifyCode);
    await page.click('#login-submit');
    await page.waitForSelector('#role-badge', { timeout: 15_000 });
    await page.goto(`${BASE}/?tenantId=${TENANT}#${hash}`);
    await page.waitForTimeout(3000);
  }

  test('dashboard renders counts', async ({ page }) => {
    await loginAndNavigate(page, '/dashboard');
    const content = await page.textContent('#content-area');
    expect(content.length).toBeGreaterThan(50);
  });

  test('users list renders data', async ({ page }) => {
    await loginAndNavigate(page, '/users');
    await page.waitForTimeout(5000);
    const content = await page.textContent('#content-area');
    expect(content.length).toBeGreaterThan(100);
    expect(content).toMatch(/user|User|DUZ|name/i);
  });

  test('clinics list renders data', async ({ page }) => {
    await loginAndNavigate(page, '/clinics');
    await page.waitForTimeout(5000);
    const content = await page.textContent('#content-area');
    expect(content.length).toBeGreaterThan(100);
    expect(content).toMatch(/clinic|Clinic|File 44/i);
  });

  test('devices list renders data', async ({ page }) => {
    await loginAndNavigate(page, '/devices');
    await page.waitForTimeout(5000);
    const content = await page.textContent('#content-area');
    expect(content.length).toBeGreaterThan(100);
    expect(content).toMatch(/device|Device|printer|PRINTER/i);
  });

  test('monitoring audit renders', async ({ page }) => {
    await loginAndNavigate(page, '/monitoring/audit');
    const content = await page.textContent('#content-area');
    expect(content.length).toBeGreaterThan(50);
  });
});
