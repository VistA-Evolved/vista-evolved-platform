import { chromium } from '@playwright/test';

const WEB_BASE = process.env.WEB_BASE || 'http://127.0.0.1:3000';
const ACCESS_CODE = process.env.VISTA_ACCESS_CODE_UI || 'PRO1234';
const VERIFY_CODE = process.env.VISTA_VERIFY_CODE_UI || 'PRO1234!!';
const EDIT_PATIENT_DFN = process.env.EDIT_PATIENT_DFN || '2';
const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR || 'c:/Users/kmoul/OneDrive/Documents/GitHub/vista-evolved-platform/artifacts';
const REGISTER_MARKER = `DRAFTREG${Date.now()}`;
const EDIT_MARKER = `DRAFTED${Date.now()}`;

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

  await page.goto(`${WEB_BASE}/patients/register`, { waitUntil: 'networkidle' });
  const registerFirstName = page.getByPlaceholder('JOHN').first();
  await registerFirstName.fill(REGISTER_MARKER);
  await page.waitForTimeout(1400);

  const registerDraft = await page.evaluate(() => window.sessionStorage.getItem('ve-patient-demo-draft:new'));
  if (!registerDraft || !registerDraft.includes('DRAFTREG')) {
    throw new Error('Register-mode draft was not written to sessionStorage.');
  }

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction((expected) => {
    const input = document.querySelector('input[placeholder="JOHN"]');
    return input && input.value === expected;
  }, REGISTER_MARKER, { timeout: 30000 });

  const registerShot = `${SCREENSHOT_DIR}/patient-demographics-draft-register.png`;
  await page.screenshot({ path: registerShot, fullPage: true });

  await page.goto(`${WEB_BASE}/patients/${EDIT_PATIENT_DFN}/edit`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Save Changes' }).waitFor({ timeout: 30000 });
  const editFirstName = page.getByPlaceholder('JOHN').first();
  await editFirstName.fill(EDIT_MARKER);
  await page.waitForTimeout(1400);

  const editDraftKey = `ve-patient-demo-draft:${EDIT_PATIENT_DFN}`;
  const editDraft = await page.evaluate((key) => window.sessionStorage.getItem(key), editDraftKey);
  if (!editDraft || !editDraft.includes('DRAFTED')) {
    throw new Error('Edit-mode draft was not written to sessionStorage.');
  }

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction((expected) => {
    const input = document.querySelector('input[placeholder="JOHN"]');
    return input && input.value === expected;
  }, EDIT_MARKER, { timeout: 30000 });

  const editShot = `${SCREENSHOT_DIR}/patient-demographics-draft-edit.png`;
  await page.screenshot({ path: editShot, fullPage: true });

  console.log(JSON.stringify({
    ok: true,
    register: {
      draftKey: 've-patient-demo-draft:new',
      restoredFirstName: REGISTER_MARKER,
      screenshot: registerShot,
    },
    edit: {
      patientDfn: EDIT_PATIENT_DFN,
      draftKey: editDraftKey,
      restoredFirstName: EDIT_MARKER,
      screenshot: editShot,
    },
  }, null, 2));
} catch (error) {
  const debugShot = `${SCREENSHOT_DIR}/patient-demographics-draft-debug.png`;
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