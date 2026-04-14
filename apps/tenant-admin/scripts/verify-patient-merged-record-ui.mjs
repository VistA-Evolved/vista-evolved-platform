import { chromium } from '@playwright/test';

const WEB_BASE = process.env.WEB_BASE || 'http://127.0.0.1:3000';
const ACCESS_CODE = process.env.VISTA_ACCESS_CODE_UI || 'PRO1234';
const VERIFY_CODE = process.env.VISTA_VERIFY_CODE_UI || 'PRO1234!!';
const MERGED_DFN = process.env.MERGED_DFN || '1';
const SURVIVOR_DFN = process.env.SURVIVOR_DFN || '2';
const MISSING_DFN = process.env.MISSING_DFN || '999999';
const MERGED_PATIENT_QUERY = process.env.MERGED_PATIENT_QUERY || 'ZZZRETFIVEFIFTYONE';
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

  await page.goto(`${WEB_BASE}/patients`, { waitUntil: 'networkidle' });
  const searchInput = page.getByPlaceholder('Search by patient name...');
  await searchInput.fill(MERGED_PATIENT_QUERY);
  await page.getByRole('button', { name: 'ZZZRETFIVEFIFTYONE,PATIENT' }).waitFor({ timeout: 30000 });
  await page.getByRole('button', { name: 'ZZZRETFIVEFIFTYONE,PATIENT' }).click();
  await page.waitForURL(`**/patients/${SURVIVOR_DFN}`, { timeout: 30000 });
  await page.getByText('Merged record redirected').waitFor({ timeout: 30000 });
  await page.getByRole('heading', { name: 'Chart Overview' }).waitFor({ timeout: 30000 });

  const mergedBannerText = (await page.getByText('Merged record redirected').locator('..').innerText()).trim();
  const mergedUrl = page.url();
  const mergedBodyText = (await page.locator('body').innerText()).slice(0, 4000);
  const mergedShot = `${SCREENSHOT_DIR}/patient-merged-redirect.png`;
  await page.screenshot({ path: mergedShot, fullPage: true });

  await page.goto(`${WEB_BASE}/patients/${MISSING_DFN}`, { waitUntil: 'networkidle' });
  const missingTitleLocator = page.getByText('Record not found', { exact: true });
  const missingMessageLocator = page.getByText('Record not found. Patient record may have been removed or merged.', { exact: true });
  await missingTitleLocator.waitFor({ timeout: 30000 });
  await missingMessageLocator.waitFor({ timeout: 30000 });

  const missingTitle = (await missingTitleLocator.innerText()).trim();
  const missingMessage = (await missingMessageLocator.innerText()).trim();
  const missingShot = `${SCREENSHOT_DIR}/patient-record-not-found.png`;
  await page.screenshot({ path: missingShot, fullPage: true });

  console.log(JSON.stringify({
    ok: true,
    merged: {
      searchQuery: MERGED_PATIENT_QUERY,
      requestedDfn: MERGED_DFN,
      survivorDfn: SURVIVOR_DFN,
      finalUrl: mergedUrl,
      bannerText: mergedBannerText,
      bodyText: mergedBodyText,
      screenshot: mergedShot,
    },
    missing: {
      requestedDfn: MISSING_DFN,
      title: missingTitle,
      message: missingMessage,
      screenshot: missingShot,
    },
  }, null, 2));
} catch (error) {
  const debugShot = `${SCREENSHOT_DIR}/patient-merged-record-debug.png`;
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