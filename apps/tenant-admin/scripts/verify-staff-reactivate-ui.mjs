import { chromium } from '@playwright/test';

const WEB_BASE = process.env.WEB_BASE || 'http://127.0.0.1:3000';
const ACCESS_CODE = process.env.VISTA_ACCESS_CODE_UI || 'PRO1234';
const VERIFY_CODE = process.env.VISTA_VERIFY_CODE_UI || 'PRO1234!!';
const TARGET_DUZ = process.env.REACTIVATE_DUZ;
const TARGET_NAME = process.env.REACTIVATE_NAME;
const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR || 'c:/Users/kmoul/OneDrive/Documents/GitHub/vista-evolved-platform/artifacts';

if (!TARGET_DUZ || !TARGET_NAME) {
  throw new Error('REACTIVATE_DUZ and REACTIVATE_NAME are required.');
}

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

  await page.goto(`${WEB_BASE}/admin/staff?search=${encodeURIComponent(TARGET_NAME)}&user=${encodeURIComponent(TARGET_DUZ)}`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: TARGET_NAME }).waitFor({ timeout: 30000 });
  await page.getByRole('button', { name: 'Reactivate' }).click();

  const successTextLocator = page.getByText(new RegExp(`${TARGET_NAME} has been reactivated`, 'i'));
  await successTextLocator.waitFor({ timeout: 30000 });
  const successText = (await successTextLocator.innerText()).trim();
  const shot = `${SCREENSHOT_DIR}/staff-reactivate-disuser-fix.png`;
  await page.screenshot({ path: shot, fullPage: true });

  console.log(JSON.stringify({
    ok: true,
    duz: TARGET_DUZ,
    name: TARGET_NAME,
    successText,
    screenshot: shot,
  }, null, 2));
} catch (error) {
  const debugShot = `${SCREENSHOT_DIR}/staff-reactivate-disuser-debug.png`;
  await page.screenshot({ path: debugShot, fullPage: true }).catch(() => {});
  console.log(JSON.stringify({
    ok: false,
    error: String(error?.message || error),
    url: page.url(),
    title: await page.title().catch(() => ''),
    bodyText: (await page.locator('body').innerText().catch(() => '')).slice(0, 5000),
    duz: TARGET_DUZ,
    name: TARGET_NAME,
    screenshot: debugShot,
  }, null, 2));
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}