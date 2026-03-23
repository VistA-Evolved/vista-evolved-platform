/**
 * Platform Operations Console E2E Test Suite
 *
 * Single spec file covering all operator console surfaces, API proxy routes,
 * and lifecycle actions. Expand this file — do NOT create additional spec files.
 *
 * Requires:
 *   - control-plane server running on port 4500 (node server.mjs)
 *   - control-plane-api running on port 4510 with ve-platform-db
 *
 * Policy: one spec file per app. Add new test.describe() blocks here as
 * surfaces are added. See .cursor/rules/30-e2e-test-policy.mdc.
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:4500';
const API_READ = `${BASE}/api/control-plane/v1`;
const API_LIFECYCLE = `${BASE}/api/control-plane-lifecycle/v1`;

// ─── Shell & Navigation ────────────────────────────────────────────────────

test.describe('Shell & Navigation', () => {
  test('main page loads with 200 and correct title', async ({ page }) => {
    const res = await page.goto(BASE);
    expect(res.status()).toBe(200);
    await expect(page).toHaveTitle(/Platform Operations/);
  });

  test('status banner renders with correct pills', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator('.status-banner')).toBeVisible();
    await expect(page.locator('.status-pill-label')).toHaveText('Platform Operations');
    await expect(page.locator('.status-pill-reads')).toContainText('real backend');
    await expect(page.locator('.status-pill-writes')).toContainText('lifecycle actions');
  });

  test('left nav sidebar has all domain groups', async ({ page }) => {
    await page.goto(BASE);
    const nav = page.locator('.nav-sidebar');
    await expect(nav).toBeVisible();
    const links = nav.locator('a[data-route]');
    expect(await links.count()).toBeGreaterThanOrEqual(15);
  });

  test('hash navigation routes to correct surface', async ({ page }) => {
    await page.goto(`${BASE}/#/tenants`);
    await page.waitForTimeout(500);
    await expect(page.locator('#app')).toContainText(/Tenant/i);
  });
});

// ─── API Proxy — Read Routes ───────────────────────────────────────────────

test.describe('API Proxy — Read Routes', () => {
  test('GET /tenants returns real-backend source', async ({ request }) => {
    const res = await request.get(`${API_READ}/tenants`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body._source).toBe('real-backend');
    expect(body).toHaveProperty('items');
    expect(body).toHaveProperty('pagination');
  });

  test('GET /packs returns 9 contract-backed packs', async ({ request }) => {
    const res = await request.get(`${API_READ}/packs`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.items.length).toBe(9);
    for (const p of body.items) {
      expect(p).toHaveProperty('packId');
      expect(p).toHaveProperty('packFamily');
      expect(p).toHaveProperty('lifecycleState');
    }
  });

  test('GET /legal-market-profiles returns US and PH', async ({ request }) => {
    const res = await request.get(`${API_READ}/legal-market-profiles`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.items.length).toBe(2);
    const ids = body.items.map(m => m.legalMarketId).sort();
    expect(ids).toEqual(['PH', 'US']);
  });

  test('GET /capabilities returns non-empty array', async ({ request }) => {
    const res = await request.get(`${API_READ}/capabilities`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('items');
    expect(body.items.length).toBeGreaterThan(0);
  });

  test('GET /effective-plans returns seed plans', async ({ request }) => {
    const res = await request.get(`${API_READ}/effective-plans`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('plans');
    expect(body.plans.length).toBeGreaterThanOrEqual(2);
  });

  test('GET /system-config returns config with source', async ({ request }) => {
    const res = await request.get(`${API_READ}/system-config`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body._source).toBeTruthy();
    expect(body.config).toBeTruthy();
  });

  test('GET /audit/events returns events array', async ({ request }) => {
    const res = await request.get(`${API_READ}/audit/events`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('events');
  });

  test('GET /packs/:id returns 404 for nonexistent pack', async ({ request }) => {
    const res = await request.get(`${API_READ}/packs/nonexistent-pack-xyz`);
    expect(res.status()).toBe(404);
  });

  test('GET /tenants/:id returns 404 for nonexistent tenant', async ({ request }) => {
    const res = await request.get(`${API_READ}/tenants/00000000-0000-0000-0000-000000000000`);
    expect(res.status()).toBe(404);
  });
});

// ─── Lifecycle Actions (via /api/control-plane-lifecycle/v1) ───────────────

test.describe('Lifecycle Actions', () => {
  let tenantId;

  test('POST /tenants creates a new tenant', async ({ request }) => {
    const res = await request.post(`${API_LIFECYCLE}/tenants`, {
      data: {
        displayName: `E2E Test Tenant ${Date.now()}`,
        slug: `e2e-${Date.now()}`,
        legalMarketId: 'US',
        actor: 'e2e-test',
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.tenant).toHaveProperty('id');
    tenantId = body.tenant.id;
  });

  test('GET /tenants shows created tenant', async ({ request }) => {
    const res = await request.get(`${API_READ}/tenants`);
    const body = await res.json();
    const found = body.items.find(t => t.tenantId === tenantId);
    expect(found).toBeTruthy();
  });

  test('POST activate → suspend → reactivate → archive lifecycle', async ({ request }) => {
    const post = (path, body) =>
      request.post(`${API_LIFECYCLE}${path}`, { data: { actor: 'e2e-test', ...body } });

    const activate = await post(`/tenants/${tenantId}/activate`, { reason: 'E2E activate' });
    expect(activate.ok()).toBeTruthy();

    const suspend = await post(`/tenants/${tenantId}/suspend`, { reason: 'operator-action' });
    expect(suspend.ok()).toBeTruthy();

    const reactivate = await post(`/tenants/${tenantId}/reactivate`, { reason: 'E2E reactivate' });
    expect(reactivate.ok()).toBeTruthy();

    const archive = await post(`/tenants/${tenantId}/archive`, { reason: 'E2E archive' });
    expect(archive.ok()).toBeTruthy();
  });
});

// ─── Bootstrap & Provisioning ──────────────────────────────────────────────

test.describe('Bootstrap & Provisioning', () => {
  test('GET /tenant-bootstrap-requests returns items array', async ({ request }) => {
    const res = await request.get(`${API_READ}/tenant-bootstrap-requests`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('items');
  });

  test('GET /provisioning-runs returns items array', async ({ request }) => {
    const res = await request.get(`${API_READ}/provisioning-runs`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('items');
  });
});

// ─── UI Surface Rendering ──────────────────────────────────────────────────

test.describe('UI Surface Rendering', () => {
  test('home surface renders', async ({ page }) => {
    await page.goto(`${BASE}/#/home`);
    await page.waitForTimeout(2000);
    await expect(page.locator('#app')).not.toBeEmpty();
  });

  test('tenants surface renders Tenant Registry', async ({ page }) => {
    await page.goto(`${BASE}/#/tenants`);
    await page.waitForTimeout(2000);
    await expect(page.locator('#app')).toContainText(/Tenant/i);
  });

  test('markets surface renders market data', async ({ page }) => {
    await page.goto(`${BASE}/#/markets`);
    await page.waitForTimeout(2000);
    await expect(page.locator('#app')).toContainText(/Market|Philippines|United States/i);
  });

  test('packs surface renders pack headings', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(2000);
    await page.goto(`${BASE}/#/packs`);
    await page.waitForTimeout(3000);
    const text = await page.locator('#app').textContent();
    expect(text.length).toBeGreaterThan(50);
  });

  test('audit surface renders', async ({ page }) => {
    await page.goto(`${BASE}/#/audit`);
    await page.waitForTimeout(2000);
    await expect(page.locator('#app')).not.toBeEmpty();
  });

  test('operations surface renders', async ({ page }) => {
    await page.goto(`${BASE}/#/operations`);
    await page.waitForTimeout(2000);
    await expect(page.locator('#app')).not.toBeEmpty();
  });
});

// ─── Static Assets ─────────────────────────────────────────────────────────

test.describe('Static Assets', () => {
  test('app.js loads with 200', async ({ request }) => {
    const res = await request.get(`${BASE}/app.js`);
    expect(res.ok()).toBeTruthy();
  });

  test('styles.css loads with 200', async ({ request }) => {
    const res = await request.get(`${BASE}/styles.css`);
    expect(res.ok()).toBeTruthy();
  });
});
