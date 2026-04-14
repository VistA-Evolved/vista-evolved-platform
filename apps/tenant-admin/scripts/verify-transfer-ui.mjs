import { chromium } from '@playwright/test';

const WEB_BASE = process.env.WEB_BASE || 'http://127.0.0.1:3000';
const PATIENT_ID = process.env.PATIENT_ID || '101044';
const ACCESS_CODE = process.env.VISTA_ACCESS_CODE_UI || 'PRO1234';
const VERIFY_CODE = process.env.VISTA_VERIFY_CODE_UI || 'PRO1234!!';
const TARGET_WARD_IEN = process.env.TARGET_WARD_IEN || '33';
const TARGET_WARD_NAME = process.env.TARGET_WARD_NAME || '3E NORTH';
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

  await page.goto(`${WEB_BASE}/patients/${PATIENT_ID}/transfer`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Transfer Patient' }).waitFor({ timeout: 30000 });
  await page.waitForFunction(() => {
    const body = document.body?.innerText || '';
    return body.includes('ICU/CCU') || body.includes('Current division:') || !body.includes('No current inpatient location recorded');
  }, { timeout: 30000 });

  const currentLocationText = (await page.locator('h3', { hasText: 'Current Location' }).locator('..').innerText()).trim();

  const unitSelect = page.locator('select').nth(0);
  await unitSelect.selectOption(TARGET_WARD_IEN);
  await page.locator('select').nth(2).selectOption({ label: 'Bed Management' });
  await page.getByText('Cross-division transfer').waitFor({ timeout: 15000 });

  const divisionBannerText = (await page.getByText('Cross-division transfer').locator('..').innerText()).trim();
  const preConfirmShot = `${SCREENSHOT_DIR}/transfer-cross-division-before-confirm.png`;
  await page.screenshot({ path: preConfirmShot, fullPage: true });

  await page.getByRole('button', { name: 'Transfer Patient' }).click();
  await page.getByRole('heading', { name: 'Confirm Cross-Division Transfer' }).waitFor({ timeout: 15000 });

  const confirmDialogText = (await page.locator('[role="dialog"]').innerText()).trim();
  const confirmShot = `${SCREENSHOT_DIR}/transfer-cross-division-confirm-dialog.png`;
  await page.screenshot({ path: confirmShot, fullPage: true });

  await page.getByRole('button', { name: 'Proceed With Transfer' }).click();
  await page.getByRole('heading', { name: 'Patient Transferred Successfully' }).waitFor({ timeout: 30000 });

  const successPanelText = (await page.locator('body').innerText()).split('\n').filter(Boolean).join('\n');
  const successShot = `${SCREENSHOT_DIR}/transfer-cross-division-success.png`;
  await page.screenshot({ path: successShot, fullPage: true });

  console.log(JSON.stringify({
    ok: true,
    patientId: PATIENT_ID,
    targetWardIen: TARGET_WARD_IEN,
    targetWardName: TARGET_WARD_NAME,
    currentLocationText,
    divisionBannerText,
    confirmDialogText,
    successPanelText,
    screenshots: [preConfirmShot, confirmShot, successShot],
  }, null, 2));
} catch (error) {
  const debugShot = `${SCREENSHOT_DIR}/transfer-cross-division-debug.png`;
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