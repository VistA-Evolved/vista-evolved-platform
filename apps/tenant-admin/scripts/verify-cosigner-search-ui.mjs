import { chromium } from '@playwright/test';

const WEB_BASE = process.env.WEB_BASE || 'http://127.0.0.1:3000';
const ACCESS_CODE = process.env.VISTA_ACCESS_CODE_UI || 'PRO1234';
const VERIFY_CODE = process.env.VISTA_VERIFY_CODE_UI || 'PRO1234!!';
const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR || 'c:/Users/kmoul/OneDrive/Documents/GitHub/vista-evolved-platform/artifacts';
const SEARCH_QUERY = process.env.COSIGNER_QUERY || 'ANE';

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
    window.sessionStorage.setItem('ve-wizard-draft', JSON.stringify({
      step: 2,
      ts: Date.now(),
      form: {
        fullName: 'COSIGNER,VERIFY',
        lastName: 'COSIGNER',
        firstName: 'VERIFY',
        middleInitial: '',
        displayName: '',
        title: '',
        sex: 'F',
        dob: '1980-01-01',
        govIdLast4: '',
        email: '',
        phone: '',
        employeeId: '',
        primaryRole: 'physician-assistant',
        department: 'MEDICINE',
        isProvider: true,
        sigBlockName: '',
        primaryMenu: 'OR CPRS GUI CHART',
        primaryLocation: '',
        additionalLocations: [],
        providerType: '',
        npi: '',
        dea: '',
        deaExpiration: '',
        authorizedToWriteMeds: false,
        assignedPermissions: ['PROVIDER', 'ORES', 'OR CPRS GUI CHART', 'ORCL-PAT-RECS', 'ORCL-SIGN-NOTES'],
        secondaryFeatures: ['OR CPRS GUI CHART'],
        removedDefaults: [],
        language: '',
        verifyCodeNeverExpires: false,
        filemanAccess: '',
        restrictPatient: '',
        mailGroups: [],
        degree: '',
        accessCode: '',
        verifyCode: '',
        verifyCodeConfirm: '',
        requiresCosign: false,
        cosigner: '',
      },
    }));
  });

  await page.goto(`${WEB_BASE}/admin/staff/new`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Provider Configuration' }).waitFor({ timeout: 30000 });
  await page.getByText('Requires cosignature (trainee)', { exact: true }).click();

  const searchInput = page.getByPlaceholder('Search for attending provider...');
  await searchInput.fill(SEARCH_QUERY);
  const resultButtons = page.locator('div.relative').filter({ has: searchInput }).locator('div.absolute button');
  await resultButtons.first().waitFor({ timeout: 30000 });

  const visibleResults = await resultButtons.evaluateAll((nodes) => {
    return nodes.map((node) => (node.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 10);
  });
  if (!visibleResults.length) {
    throw new Error(`No cosigner search results appeared for query ${SEARCH_QUERY}.`);
  }

  const shot = `${SCREENSHOT_DIR}/staff-cosigner-search-results.png`;
  await page.screenshot({ path: shot, fullPage: true });

  console.log(JSON.stringify({
    ok: true,
    query: SEARCH_QUERY,
    resultCount: visibleResults.length,
    visibleResults,
    screenshot: shot,
  }, null, 2));
} catch (error) {
  const debugShot = `${SCREENSHOT_DIR}/staff-cosigner-search-debug.png`;
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