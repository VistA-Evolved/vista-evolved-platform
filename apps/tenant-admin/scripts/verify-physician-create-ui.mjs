import { chromium } from '@playwright/test';

const WEB_BASE = process.env.WEB_BASE || 'http://127.0.0.1:3000';
const ACCESS_CODE = process.env.VISTA_ACCESS_CODE_UI || 'PRO1234';
const VERIFY_CODE = process.env.VISTA_VERIFY_CODE_UI || 'PRO1234!!';
const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR || 'c:/Users/kmoul/OneDrive/Documents/GitHub/vista-evolved-platform/artifacts';

const stamp = Date.now().toString().slice(-8);
const payload = {
  lastName: `AUDITPHY${stamp}`,
  firstName: 'VERIFY',
  sex: 'F',
  dob: '1980-01-01',
  title: '47',
  department: 'MEDICINE',
  primaryLocation: '1',
  accessCode: `PHY${stamp}`.slice(0, 20),
  verifyCode: 'PhysTest1!',
  phone: '5558675309',
  email: `phys.create.${stamp}@example.org`,
  employeeId: `PHY-${stamp}`,
  degree: 'MD',
  language: 'ENGLISH',
  primaryRole: 'physician',
  primaryMenu: 'OR CPRS GUI CHART',
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

  await context.addCookies([{
    name: 've-session',
    value: sessionValue,
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  }]);
  await page.addInitScript((draftPayload) => {
    window.sessionStorage.setItem('ve-authenticated', 'true');
    window.sessionStorage.setItem('ve-wizard-draft', JSON.stringify({
      step: 3,
      ts: Date.now(),
      form: {
        fullName: `${draftPayload.lastName},${draftPayload.firstName}`,
        lastName: draftPayload.lastName,
        firstName: draftPayload.firstName,
        middleInitial: '',
        displayName: '',
        title: draftPayload.title,
        sex: draftPayload.sex,
        dob: draftPayload.dob,
        govIdLast4: '',
        email: draftPayload.email,
        phone: draftPayload.phone,
        employeeId: draftPayload.employeeId,
        primaryRole: draftPayload.primaryRole,
        department: draftPayload.department,
        isProvider: true,
        sigBlockName: '',
        primaryMenu: draftPayload.primaryMenu,
        primaryLocation: draftPayload.primaryLocation,
        additionalLocations: [],
        providerType: draftPayload.providerType,
        npi: draftPayload.npi,
        dea: '',
        deaExpiration: '',
        authorizedToWriteMeds: false,
        assignedPermissions: draftPayload.assignedPermissions,
        secondaryFeatures: ['OR CPRS GUI CHART'],
        removedDefaults: [],
        language: draftPayload.language,
        verifyCodeNeverExpires: false,
        filemanAccess: '',
        restrictPatient: '',
        mailGroups: [],
        degree: draftPayload.degree,
        accessCode: draftPayload.accessCode,
        verifyCode: draftPayload.verifyCode,
        verifyCodeConfirm: draftPayload.verifyCode,
        requiresCosign: false,
        cosigner: '',
      },
    }));
  }, payload);

  await page.goto(`${WEB_BASE}/admin/staff/new`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Review and Confirm' }).waitFor({ timeout: 30000 });
  await page.getByRole('button', { name: 'Create Staff Member' }).click();

  const successHeading = page.getByText(/created successfully/i).first();
  await successHeading.waitFor({ timeout: 60000 });
  const headingText = (await successHeading.innerText()).trim();
  const successText = (await page.locator('main').innerText()).trim();
  const match = successText.match(/S-(\d+)/);
  const duz = match?.[1] || '';
  if (!duz) {
    throw new Error(`Could not parse DUZ from success screen. Heading: ${headingText}`);
  }

  const shot = `${SCREENSHOT_DIR}/staff-physician-create-success.png`;
  await page.screenshot({ path: shot, fullPage: true });

  console.log(JSON.stringify({
    ok: true,
    duz,
    headingText,
    staffId: `S-${duz}`,
    payload,
    screenshot: shot,
  }, null, 2));
} catch (error) {
  const debugShot = `${SCREENSHOT_DIR}/staff-physician-create-debug.png`;
  await page.screenshot({ path: debugShot, fullPage: true }).catch(() => {});
  console.log(JSON.stringify({
    ok: false,
    error: String(error?.message || error),
    url: page.url(),
    title: await page.title().catch(() => ''),
    bodyText: (await page.locator('body').innerText().catch(() => '')).slice(0, 5000),
    payload,
    screenshot: debugShot,
  }, null, 2));
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}