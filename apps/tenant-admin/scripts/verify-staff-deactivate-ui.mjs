import { chromium } from '@playwright/test';

const WEB_BASE = process.env.WEB_BASE || 'http://127.0.0.1:3000';
const ACCESS_CODE = process.env.VISTA_ACCESS_CODE_UI || 'PRO1234';
const VERIFY_CODE = process.env.VISTA_VERIFY_CODE_UI || 'PRO1234!!';
const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR || 'c:/Users/kmoul/OneDrive/Documents/GitHub/vista-evolved-platform/artifacts';

const stamp = Date.now().toString().slice(-8);
const name = `DEACTFIX${stamp},VERIFY`;
const reason = 'Security Concern';
const createPayload = {
  name,
  sex: 'F',
  dob: '1980-01-01',
  primaryRole: 'physician',
  department: 'MEDICINE',
  primaryMenu: 'OR CPRS GUI CHART',
  primaryLocation: '1',
  accessCode: `DX${stamp}`,
  verifyCode: 'DeactFix1!',
  isProvider: true,
  providerType: 'PHYSICIAN',
  npi: '1234567893',
  assignedPermissions: [
    'PROVIDER',
    'ORES',
    'OR CPRS GUI CHART',
    'ORCL-SIGN-NOTES',
    'ORCL-PAT-RECS',
    'GMRA-ALLERGY VERIFY',
  ],
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1400 } });
const page = await context.newPage();

try {
  const apiLoginRes = await fetch('http://127.0.0.1:4520/api/tenant-admin/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessCode: ACCESS_CODE, verifyCode: VERIFY_CODE, tenantId: 'default' }),
  });
  const sessionCookie = (apiLoginRes.headers.get('set-cookie') || '').split(';')[0];
  const sessionValue = sessionCookie.split('=')[1] || '';
  if (!sessionValue) {
    throw new Error('Failed to obtain ve-session cookie from tenant-admin login.');
  }

  const createRes = await fetch('http://127.0.0.1:4520/api/tenant-admin/v1/users?tenantId=default', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: `ve-session=${sessionValue}`,
    },
    body: JSON.stringify(createPayload),
  });
  const createJson = await createRes.json();
  const duz = createJson?.duz || createJson?.data?.duz || createJson?.newIen;
  if (!createRes.ok || !duz) {
    throw new Error(`Failed to create disposable deactivate user: ${JSON.stringify(createJson)}`);
  }

  await context.addCookies([{
    name: 've-session',
    value: sessionValue,
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  }]);
  await page.addInitScript(() => {
    window.sessionStorage.setItem('ve-authenticated', 'true');
  });

  await page.goto(`${WEB_BASE}/admin/staff?search=${encodeURIComponent(name)}&user=${encodeURIComponent(duz)}`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name }).waitFor({ timeout: 30000 });
  await page.getByRole('button', { name: 'Deactivate' }).click();

  await page.getByRole('heading', { name: 'Deactivate Staff Member' }).waitFor({ timeout: 30000 });
  await page.getByRole('combobox').last().selectOption({ label: reason });
  await page.getByRole('button', { name: 'Deactivate' }).last().click();

  const successTextLocator = page.getByText(new RegExp(`${name} has been deactivated`, 'i'));
  await successTextLocator.waitFor({ timeout: 30000 });
  const successText = (await successTextLocator.innerText()).trim();
  const shot = `${SCREENSHOT_DIR}/staff-deactivate-disuser-fix.png`;
  await page.screenshot({ path: shot, fullPage: true });

  console.log(JSON.stringify({
    ok: true,
    duz: String(duz),
    name,
    reason,
    successText,
    screenshot: shot,
  }, null, 2));
} catch (error) {
  const debugShot = `${SCREENSHOT_DIR}/staff-deactivate-disuser-debug.png`;
  await page.screenshot({ path: debugShot, fullPage: true }).catch(() => {});
  console.log(JSON.stringify({
    ok: false,
    error: String(error?.message || error),
    url: page.url(),
    title: await page.title().catch(() => ''),
    bodyText: (await page.locator('body').innerText().catch(() => '')).slice(0, 5000),
    name,
    reason,
    createPayload,
    screenshot: debugShot,
  }, null, 2));
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}