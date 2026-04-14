import { chromium } from '@playwright/test';

const WEB_BASE = process.env.WEB_BASE || 'http://127.0.0.1:3000';
const ACCESS_CODE = process.env.VISTA_ACCESS_CODE_UI || 'PRO1234';
const VERIFY_CODE = process.env.VISTA_VERIFY_CODE_UI || 'PRO1234!!';
const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR || 'c:/Users/kmoul/OneDrive/Documents/GitHub/vista-evolved-platform/artifacts';

const stamp = Date.now().toString().slice(-8);
const name = `AAATERMFIX${stamp},VERIFY`;
const createPayload = {
  name,
  sex: 'F',
  dob: '1980-01-01',
  primaryRole: 'physician',
  department: 'MEDICINE',
  primaryMenu: 'OR CPRS GUI CHART',
  primaryLocation: '1',
  accessCode: `TX${stamp}`,
  verifyCode: 'TermFix1!',
  isProvider: true,
  providerType: 'PHYSICIAN',
  npi: '1234567893',
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1400 } });
const page = await context.newPage();

async function waitForSearchIndex(sessionValue, targetName, targetDuz) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const res = await fetch(`http://127.0.0.1:4520/api/tenant-admin/v1/users?tenantId=default&search=${encodeURIComponent(targetName)}`, {
      headers: { cookie: `ve-session=${sessionValue}` },
    });
    const json = await res.json().catch(() => ({}));
    const match = (json?.data || []).find((row) => String(row?.duz || row?.ien) === String(targetDuz));
    if (res.ok && match) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for ${targetName} (${targetDuz}) to appear in live staff search.`);
}

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
    throw new Error(`Failed to create disposable terminate user: ${JSON.stringify(createJson)}`);
  }

  const keyRes = await fetch(`http://127.0.0.1:4520/api/tenant-admin/v1/users/${duz}/keys?tenantId=default`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: `ve-session=${sessionValue}`,
    },
    body: JSON.stringify({ keyName: 'OR CPRS GUI CHART' }),
  });
  const keyJson = await keyRes.json();
  if (!keyRes.ok) {
    throw new Error(`Failed to assign OR CPRS GUI CHART before terminate verification: ${JSON.stringify(keyJson)}`);
  }

  await waitForSearchIndex(sessionValue, name, duz);

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

  await page.goto(`${WEB_BASE}/admin/staff?status=All`, { waitUntil: 'networkidle' });
  const searchInput = page.getByPlaceholder('Search by name or ID...');
  await searchInput.fill(name);
  const rowLocator = page.locator('tr').filter({ hasText: name }).first();
  await rowLocator.waitFor({ timeout: 30000 });
  await rowLocator.click();
  await page.getByRole('heading', { name }).waitFor({ timeout: 30000 });
  await page.getByRole('button', { name: 'Full Termination' }).click();

  await page.getByRole('heading', { name: 'Full Termination' }).waitFor({ timeout: 30000 });
  const modalText = (await page.locator('[role="dialog"]').innerText()).trim();
  const modalShot = `${SCREENSHOT_DIR}/staff-terminate-confirm.png`;
  await page.screenshot({ path: modalShot, fullPage: true });

  await page.getByRole('button', { name: 'Terminate Account' }).click();
  await page.waitForURL(`**/admin/staff?**`, { timeout: 30000 });
  await page.goto(`${WEB_BASE}/admin/staff?search=${encodeURIComponent(name)}&status=Terminated`, { waitUntil: 'networkidle' });
  const terminatedRow = page.locator('tr').filter({ hasText: name }).first();
  await terminatedRow.waitFor({ timeout: 30000 });
  const resultShot = `${SCREENSHOT_DIR}/staff-terminate-result.png`;
  await page.screenshot({ path: resultShot, fullPage: true });

  console.log(JSON.stringify({
    ok: true,
    duz: String(duz),
    name,
    modalText,
    modalScreenshot: modalShot,
    resultScreenshot: resultShot,
    accessCode: createPayload.accessCode,
    verifyCode: createPayload.verifyCode,
  }, null, 2));
} catch (error) {
  const debugShot = `${SCREENSHOT_DIR}/staff-terminate-debug.png`;
  await page.screenshot({ path: debugShot, fullPage: true }).catch(() => {});
  console.log(JSON.stringify({
    ok: false,
    error: String(error?.message || error),
    url: page.url(),
    title: await page.title().catch(() => ''),
    bodyText: (await page.locator('body').innerText().catch(() => '')).slice(0, 5000),
    name,
    createPayload,
    screenshot: debugShot,
  }, null, 2));
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}