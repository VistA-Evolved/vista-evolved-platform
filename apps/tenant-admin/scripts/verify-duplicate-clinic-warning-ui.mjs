import { chromium } from '@playwright/test';

const WEB_BASE = process.env.WEB_BASE || 'http://127.0.0.1:3000';
const ACCESS_CODE = process.env.VISTA_ACCESS_CODE_UI || 'PRO1234';
const VERIFY_CODE = process.env.VISTA_VERIFY_CODE_UI || 'PRO1234!!';
const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR || 'c:/Users/kmoul/OneDrive/Documents/GitHub/vista-evolved-platform/artifacts';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
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

  const clinicRes = await fetch('http://127.0.0.1:4520/api/tenant-admin/v1/clinics?tenantId=default', {
    headers: { cookie: `ve-session=${sessionValue}` },
  });
  const clinicJson = await clinicRes.json();
  const sourceClinic = (clinicJson.data || []).find((clinic) => clinic?.name && clinic?.stopCode) || (clinicJson.data || [])[0];
  if (!sourceClinic?.name || !sourceClinic?.stopCode) {
    throw new Error('Could not find a live clinic row with a name and stop code for duplicate-warning verification.');
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

  await page.goto(`${WEB_BASE}/admin/clinics`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Add Clinic' }).first().click();
  await page.getByRole('heading', { name: 'Add Clinic' }).waitFor({ timeout: 30000 });

  await page.getByPlaceholder('e.g. Primary Care East').fill(sourceClinic.name);
  await page.getByPlaceholder(/1-3 digits/).fill(String(sourceClinic.stopCode).replace(/\D/g, '').slice(0, 3));
  await page.getByRole('button', { name: 'Create Clinic' }).click();

  await page.getByRole('heading', { name: 'Duplicate Clinic Name' }).waitFor({ timeout: 30000 });
  const dialogText = (await page.locator('[role="dialog"]').innerText()).trim();
  const shot = `${SCREENSHOT_DIR}/clinic-duplicate-name-warning.png`;
  await page.screenshot({ path: shot, fullPage: true });
  await page.getByRole('button', { name: 'Cancel' }).last().click();

  console.log(JSON.stringify({
    ok: true,
    clinicName: sourceClinic.name,
    stopCode: sourceClinic.stopCode,
    dialogText,
    screenshot: shot,
  }, null, 2));
} catch (error) {
  const debugShot = `${SCREENSHOT_DIR}/clinic-duplicate-name-warning-debug.png`;
  await page.screenshot({ path: debugShot, fullPage: true }).catch(() => {});
  console.log(JSON.stringify({
    ok: false,
    error: String(error?.message || error),
    url: page.url(),
    title: await page.title().catch(() => ''),
    bodyText: (await page.locator('body').innerText().catch(() => '')).slice(0, 4000),
    screenshot: debugShot,
  }, null, 2));
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}