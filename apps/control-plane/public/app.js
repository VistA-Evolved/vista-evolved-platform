/**
 * Platform Operations Console — Local Review Runtime — app.js
 *
 * Hash-based routing over 22 operator-console surfaces across 8 domains.
 * Data fetched from local Fastify API routes (real-backend + contract-backed).
 * Lifecycle writes proxied to real backend when reachable.
 * Review writes are simulation-only — no persistence, no real execution.
 *
 * 8-domain model (from operator-console-design-contract-v3.md):
 *
 *   Home
 *     control-plane.home                    — Home (action center)
 *
 *   Requests & Onboarding
 *     control-plane.tenants.bootstrap       — Onboarding Requests
 *     control-plane.provisioning.runs       — Provisioning Runs
 *     control-plane.identity.invitations    — Identity & Invitations
 *
 *   Tenants
 *     control-plane.tenants.list            — Tenant Registry
 *     control-plane.tenants.detail          — Tenant Detail
 *
 *   Operations
 *     control-plane.operations.center       — Operations Center
 *     control-plane.ops.alerts              — Alert Center
 *     control-plane.ops.backup-dr           — Backup & DR
 *     control-plane.ops.environments        — Environments & Feature Flags
 *
 *   Support
 *     control-plane.support.console         — Support Console
 *
 *   Commercial
 *     control-plane.commercial.billing      — Billing & Entitlements
 *     control-plane.commercial.usage        — Usage & Metering
 *
 *   Catalogs & Governance
 *     control-plane.markets.management      — Market Management
 *     control-plane.markets.detail          — Market Detail
 *     control-plane.packs.catalog           — Pack Catalog
 *     control-plane.markets.payer-readiness — Payer Readiness
 *     control-plane.markets.eligibility-sim — Eligibility Simulator
 *
 *   Platform
 *     control-plane.system.config           — System Configuration
 *     control-plane.platform.audit          — Audit Trail
 *     control-plane.platform.templates      — Templates & Presets
 *     control-plane.platform.runbooks       — Runbooks Hub
 */

'use strict';

// ---------------------------------------------------------------------------
// Local operator role — review-only role simulation (NOT real auth)
// ---------------------------------------------------------------------------
function getActiveRole() {
  return localStorage.getItem('cp-local-role') || 'platform-operator';
}

function setActiveRole(role) {
  localStorage.setItem('cp-local-role', role);
}

function apiFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  headers['X-Local-Role'] = getActiveRole();
  return fetch(url, { ...options, headers });
}

function switchRole(role) {
  setActiveRole(role);
  boot();
}

// ---------------------------------------------------------------------------
// API loader — fetches from local Fastify routes
// ---------------------------------------------------------------------------
const API_BASE = '/api/control-plane/v1';
// Review routes removed — Phase 0b cleanup
const LIFECYCLE_API_BASE = '/api/control-plane-lifecycle/v1';
const DATA = {};

async function loadData() {
  const endpoints = [
    ['tenants',               '/tenants'],
    ['bootstrap-requests',    '/tenant-bootstrap-requests'],
    ['provisioning-runs',     '/provisioning-runs'],
    ['legal-market-profiles', '/legal-market-profiles'],
    ['effective-plans',       '/effective-plans'],
    ['packs',                 '/packs'],
    ['capabilities',          '/capabilities'],
    ['system-config',         '/system-config']
  ];
  for (const [key, path] of endpoints) {
    const resp = await apiFetch(`${API_BASE}${path}`);
    if (resp.status === 403 || resp.status === 400) {
      const err = await resp.json();
      renderAccessDenied(err);
      return false;
    }
    DATA[key] = await resp.json();
  }
  return true;
}

// ---------------------------------------------------------------------------
// Access-denied rendering
// ---------------------------------------------------------------------------
function renderAccessDenied(err) {
  document.getElementById('app').innerHTML = `
    <div class="access-denied">
      <div class="access-denied-icon">&#x1f512;</div>
      <h2>Access Denied</h2>
      <p>${escHtml(err.message || 'Access denied')}</p>
      <dl class="kv-list" style="margin-top:16px;">
        <dt>Active Role</dt><dd><strong>${escHtml(err.activeRole || getActiveRole())}</strong></dd>
        <dt>Required Role</dt><dd><strong>platform-operator</strong></dd>
      </dl>
      <p style="margin-top:16px;font-size:13px;color:var(--text-muted);">
        Use the role selector in the banner to switch to <em>platform-operator</em>.
        This is a local review-only role simulation &mdash; not real authentication.
      </p>
    </div>
  `;
  document.querySelectorAll('.nav-sidebar a').forEach(a => a.classList.remove('active'));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function badge(val) {
  if (!val) return '';
  const cls = 'badge-' + String(val).toLowerCase().replace(/[\s_]/g, '-');
  return `<span class="badge ${cls}">${escHtml(val)}</span>`;
}

function escHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Site Administration handoff — opens the tenant-admin workspace with context
function openTenantAdmin(tenantId) {
  const tid = tenantId || 'default-tenant';
  const cpReturn = encodeURIComponent(window.location.href);
  window.open(`http://127.0.0.1:4520/?tenantId=${encodeURIComponent(tid)}&cpReturnUrl=${cpReturn}#/dashboard`, '_blank', 'noopener');
}

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function navLink(href, label) {
  return `<a href="${href}" style="color:var(--primary);text-decoration:none;">${escHtml(label)}</a>`;
}

// ---------------------------------------------------------------------------
// Source posture label — honest data-source indicator for graduated P0 surfaces
// ---------------------------------------------------------------------------
function sourceBadge(source) {
  if (source === 'real-backend') {
    return '<span class="source-badge source-real">real backend</span>';
  }
  if (source === 'unavailable') {
    return '<span class="source-badge source-unavailable">backend unavailable</span>';
  }
  if (source === 'contract-backed') {
    return '<span class="source-badge source-contract">contract-backed</span>';
  }
  if (source === 'static-review') {
    return '<span class="source-badge source-static">static review</span>';
  }
  return '<span class="source-badge source-unknown">unknown source</span>';
}

/**
 * POST to the P0 lifecycle proxy (real backend writes).
 * Returns { ok, _source, ... } or { ok: false, _source: 'backend-unreachable' }.
 */
async function lifecycleFetch(path, body) {
  try {
    const resp = await apiFetch(`${LIFECYCLE_API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return await resp.json();
  } catch {
    return { ok: false, _source: 'backend-unreachable', message: 'Failed to reach real backend' };
  }
}

/**
 * Render a lifecycle action result inline (replaces review-only dialog for P0).
 */
function renderLifecycleResult(containerId, result) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (result.ok) {
    el.innerHTML = `<div class="lifecycle-result lifecycle-success">
      ${sourceBadge(result._source)} Action completed successfully.
    </div>`;
  } else if (result._source === 'backend-unreachable') {
    el.innerHTML = `<div class="lifecycle-result lifecycle-unreachable">
      ${sourceBadge('unavailable')} Real backend unreachable.
      <span style="font-size:12px;display:block;margin-top:4px;">${escHtml(result.message || '')}</span>
    </div>`;
  } else {
    el.innerHTML = `<div class="lifecycle-result lifecycle-error">
      ${sourceBadge(result._source || 'real-backend')} Action failed: ${escHtml(result.reason || result.message || 'unknown error')}
    </div>`;
  }
}

// ---------------------------------------------------------------------------
// Planned action stub — shown for surfaces not yet backed by real lifecycle
// ---------------------------------------------------------------------------
function showGovernedActionModal(actionName, detail) {
  const msg = detail || `"${actionName}" requires the Platform Operations API (port 4510) to be running.`;
  const el = document.getElementById('app');
  const overlay = document.createElement('div');
  overlay.className = 'governed-modal-overlay';
  overlay.innerHTML = `<div class="governed-modal">
    <h3>${escHtml(actionName)}</h3>
    <p>${msg}</p>
    <button onclick="this.closest('.governed-modal-overlay').remove()">Dismiss</button>
  </div>`;
  el.appendChild(overlay);
}

// ---------------------------------------------------------------------------
// Real lifecycle action handlers (P0 graduated — proxy to real backend)
// ---------------------------------------------------------------------------
async function doLifecycleAction(path, body, resultContainerId) {
  const result = await lifecycleFetch(path, body);
  renderLifecycleResult(resultContainerId, result);
  // Refresh data after a short delay so counts update
  if (result.ok) {
    setTimeout(() => { loadData().then(() => navigate()); }, 600);
  }
}

async function doBootstrapDraftCreate(resultContainerId) {
  const tenants = DATA['tenants']?.items || [];
  if (tenants.length === 0) {
    renderLifecycleResult(resultContainerId, { ok: false, error: 'No tenants available to create a bootstrap draft for.' });
    return;
  }
  // Use the first tenant as default — operator can pick from the registry
  const tenantId = tenants[0].tenantId;
  const result = await lifecycleFetch('/bootstrap/drafts', { tenantId, displayName: tenants[0].displayName || 'New Bootstrap' });
  renderLifecycleResult(resultContainerId, result);
  if (result.ok) {
    setTimeout(() => { loadData().then(() => navigate()); }, 600);
  }
}

async function doCreateProvisioningRun(resultContainerId) {
  const bootstrapData = DATA['bootstrap-requests'] || { items: [] };
  const approved = (bootstrapData.items || []).filter(r => r.status === 'approved');
  if (approved.length === 0) {
    renderLifecycleResult(resultContainerId, { ok: false, error: 'No approved bootstrap requests available. Approve a bootstrap request first.' });
    return;
  }
  const req = approved[0];
  const result = await lifecycleFetch('/provisioning/runs', { bootstrapRequestId: req.bootstrapRequestId, tenantId: req.tenantId });
  renderLifecycleResult(resultContainerId, result);
  if (result.ok) {
    setTimeout(() => { loadData().then(() => navigate()); }, 600);
  }
}

// Governed write actions — wire to real backend or show governance context
function reviewResolvePlan() {
  showGovernedActionModal('Resolve Plan',
    'Plan resolution is handled via the provisioning lifecycle. Use the provisioning runs page to retry or cancel runs.');
}
async function reviewCreateMarketDraft() {
  const name = prompt('Market display name:');
  if (!name) return;
  const code = prompt('Market code (e.g. US, PH, DE):');
  if (!code) return;
  const result = await lifecycleFetch('/markets', { displayName: name, code });
  if (result.ok) { await loadData(); navigate(); }
  else showGovernedActionModal('Create Market Draft', `Failed: ${result.error || 'Unknown error'}`);
}
async function reviewUpdateMarketDraft() {
  showGovernedActionModal('Update Market Draft',
    'Market profiles are contract-governed. Edit the market JSON in <code>packages/contracts/instances/markets/</code> and redeploy.');
}
async function reviewSubmitMarketForReview() {
  showGovernedActionModal('Submit Market for Review',
    'Market launch-tier changes require second-operator approval per the governance model. File an audit event to initiate review.');
}
async function reviewCreatePackDraft() {
  showGovernedActionModal('Create Pack Draft',
    'Packs are contract-governed bundles. Create a new pack JSON in <code>packages/contracts/instances/packs/</code> and redeploy.');
}
async function reviewUpdatePackDraft() {
  showGovernedActionModal('Update Pack Draft',
    'Pack updates follow the contract mutation protocol. Edit the pack JSON and redeploy.');
}
async function reviewSubmitPackForReview() {
  showGovernedActionModal('Submit Pack for Review',
    'Pack lifecycle changes require governance review. File an audit event to initiate.');
}
async function reviewToggleFeatureFlag(flagKey, currentEnabled) {
  const key = flagKey || prompt('Flag key to toggle:');
  if (!key) return;
  const env = prompt('Environment (staging/production):', 'staging');
  if (!env) return;
  const enabled = currentEnabled !== undefined ? !currentEnabled : confirm('Enable this flag? (OK=enable, Cancel=disable)');
  const result = await apiFetch(`${API_BASE}/operator/feature-flags`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flagKey: key, environment: env, enabled }),
  });
  if (result && result.ok) { await loadData(); navigate(); }
  else showGovernedActionModal('Toggle Feature Flag', `Failed: ${(result && result.error) || 'Backend unavailable'}`);
}
async function reviewUpdateSystemParameter() {
  showGovernedActionModal('Update System Parameter',
    'System configuration changes require the platform API on port 4510 with a <code>system_config</code> table. Start the API and run migrations.');
}

// ---------------------------------------------------------------------------
// Router — 22 surfaces across 8 domains (design-contract-v3)
// ---------------------------------------------------------------------------
const ROUTES = {
  // Home
  'home':                renderHome,
  // Requests & Onboarding
  'bootstrap':           renderTenantsBootstrap,
  'provisioning':        renderProvisioningRuns,
  'identity':            renderIdentityInvitations,
  // Tenants
  'tenants':             renderTenantsList,
  'tenants-detail':      renderTenantsDetail,
  // Operations (alias → home)
  'operations':          renderHome,
  'alerts':              renderAlertCenter,
  'backup-dr':           renderBackupDr,
  'environments':        renderEnvironmentsFlags,
  // Support
  'support':             renderSupportConsole,
  // Commercial
  'billing':             renderBillingEntitlements,
  'usage':               renderUsageMetering,
  // Catalogs & Governance
  'markets':             renderMarketsManagement,
  'markets-detail':      renderMarketsDetail,
  'packs':               renderPacksCatalog,
  'payer-readiness':     renderPayerReadiness,
  'eligibility-simulator': renderEligibilitySimulator,
  // Platform
  'system-config':       renderSystemConfig,
  'audit':               renderAuditTrail,
  'templates':           renderTemplatesPresets,
  'runbooks':            renderRunbooksHub,
  // Legacy redirect
  'overview':            () => { location.hash = '#/home'; },
  'tenants-bootstrap':   renderTenantsBootstrap,
};

const DEFAULT_ROUTE = 'home';

function getRoute() {
  const hash = location.hash.replace('#/', '').replace(/\//g, '-') || DEFAULT_ROUTE;
  // Sort keys longest-first so "tenants-detail" matches before "tenants"
  const keys = Object.keys(ROUTES).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (hash === key || hash.startsWith(key)) return key;
  }
  return DEFAULT_ROUTE;
}

function navigate() {
  const route = getRoute();
  document.querySelectorAll('.nav-sidebar a').forEach(a => {
    a.classList.toggle('active', a.dataset.route === route);
  });
  const fn = ROUTES[route];
  if (fn) {
    const out = fn();
    if (out && typeof out.then === 'function') out.catch(e => console.error(e));
  }
}

// ---------------------------------------------------------------------------
// Surface 1: Tenant Registry (control-plane.tenants.list) — P0 GRADUATED
// ---------------------------------------------------------------------------
function renderTenantsList() {
  const data = DATA['tenants'];
  const items = data.items;
  const pg = data.pagination;
  const source = data._source || 'unavailable';

  document.getElementById('app').innerHTML = `
    <div class="surface-header">
      <h1>Tenant Registry</h1>
      <div class="btn-group">
        ${sourceBadge(source)}
        <button class="btn btn-primary" onclick="location.hash='#/bootstrap'">+ New Tenant Bootstrap</button>
        <button class="btn" onclick="reviewResolvePlan()">⊕ Resolve Plan</button>
        <button class="btn" onclick="navigate()">↻ Refresh</button>
      </div>
    </div>

    <div class="filter-bar">
      <label>Status</label>
      <select id="tenant-filter-status" onchange="filterTenantsList()">
        <option value="">All statuses</option>
        <option value="active">Active</option>
        <option value="draft">Draft</option>
        <option value="bootstrap-pending">Bootstrap Pending</option>
        <option value="suspended">Suspended</option>
        <option value="decommissioned">Decommissioned</option>
      </select>
      <label>Market</label>
      <select id="tenant-filter-market" onchange="filterTenantsList()">
        <option value="">All markets</option>
        ${[...new Set(items.map(t => t.legalMarketId).filter(Boolean))].sort().map(m => `<option value="${escHtml(m)}">${escHtml(m)}</option>`).join('')}
      </select>
      <label>Search</label>
      <input type="text" id="tenant-filter-search" placeholder="Search by name or ID…" oninput="filterTenantsList()">
    </div>

    <table id="tenant-table">
      <thead>
        <tr>
          <th>Tenant ID</th>
          <th>Display Name</th>
          <th>Status</th>
          <th>Legal Market</th>
          <th>Launch Tier</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody id="tenant-tbody">
        ${items.map(t => `
          <tr class="clickable" data-tenant-id="${escHtml(t.tenantId)}" data-status="${escHtml(t.status || '')}" data-market="${escHtml(t.legalMarketId || '')}" data-name="${escHtml((t.displayName || '') + ' ' + (t.tenantId || '')).toLowerCase()}" onclick="location.hash='#/tenants/detail?id=${encodeURIComponent(t.tenantId)}'">
            <td><code>${escHtml(t.tenantId)}</code></td>
            <td>${escHtml(t.displayName)}</td>
            <td>${badge(t.status)}</td>
            <td>${escHtml(t.legalMarketId)}</td>
            <td>${badge(t.launchTier || '—')}</td>
            <td>${fmtDate(t.createdAt)}</td>
            <td onclick="event.stopPropagation()">
              <button class="btn" style="font-size:11px;padding:2px 8px;" onclick="openTenantAdmin('${escHtml(t.tenantId)}')">Site Admin</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="pagination" id="tenant-pagination">
      <span>Showing ${items.length} of ${pg.totalItems} tenants</span>
      <span>Page ${pg.page} of ${pg.totalPages} · ${pg.pageSize} per page</span>
    </div>
  `;
  window._tenantAllRows = items;
}

// ---------------------------------------------------------------------------
// Tenant Registry live filter
// ---------------------------------------------------------------------------
function filterTenantsList() {
  const status = (document.getElementById('tenant-filter-status') || {}).value || '';
  const market = (document.getElementById('tenant-filter-market') || {}).value || '';
  const search = ((document.getElementById('tenant-filter-search') || {}).value || '').toLowerCase();
  const tbody = document.getElementById('tenant-tbody');
  if (!tbody) return;
  let visible = 0;
  tbody.querySelectorAll('tr').forEach(tr => {
    const st = tr.dataset.status || '';
    const mk = tr.dataset.market || '';
    const nm = tr.dataset.name || '';
    const show = (!status || st === status) && (!market || mk === market) && (!search || nm.includes(search));
    tr.style.display = show ? '' : 'none';
    if (show) visible++;
  });
  const pg = document.getElementById('tenant-pagination');
  if (pg) pg.firstElementChild.textContent = `Showing ${visible} of ${(window._tenantAllRows || []).length} tenants`;
}

// ---------------------------------------------------------------------------
// Surface 2: Tenant Detail (control-plane.tenants.detail) — P0 GRADUATED
// ---------------------------------------------------------------------------
async function renderTenantsDetail() {
  // Extract tenant ID from URL hash query param or fall back to first tenant
  const hashParts = location.hash.split('?');
  const params = new URLSearchParams(hashParts[1] || '');
  const tenantId = params.get('id') || (DATA['tenants'].items[0] || {}).tenantId;
  const source = DATA['tenants']._source || 'unavailable';

  // Try dynamic fetch from real backend for single tenant
  let tenant = null;
  let detailSource = source;
  try {
    const resp = await apiFetch(`${API_BASE}/tenants/${encodeURIComponent(tenantId)}`);
    if (resp.ok) {
      const data = await resp.json();
      tenant = data;
      detailSource = data._source || source;
    }
  } catch { /* fallback below */ }

  // Fallback to first available tenant
  if (!tenant) {
    tenant = DATA['tenants'].items.find(t => t.tenantId === tenantId) || DATA['tenants'].items[0];
    detailSource = 'unavailable';
  }

  if (!tenant) {
    document.getElementById('app').innerHTML = `<div class="empty-state"><p>Tenant not found.</p></div>`;
    return;
  }

  const bootstrapReqs = DATA['bootstrap-requests'].items.filter(b => b.tenantId === tenant.tenantId);
  const latestBootstrap = bootstrapReqs[0];

  document.getElementById('app').innerHTML = `
    <div class="breadcrumb">${navLink('#/tenants', 'Tenant Registry')} &rsaquo; ${escHtml(tenant.displayName)}</div>
    <div class="surface-header">
      <h1>${escHtml(tenant.displayName)}</h1>
      <div>${badge(tenant.status)} ${badge(tenant.launchTier)} ${sourceBadge(detailSource)}</div>
    </div>

    <!-- Identity Section -->
    <div class="card">
      <h3>Identity</h3>
      <dl class="kv-list">
        <dt>Display Name</dt><dd>${escHtml(tenant.displayName)}</dd>
        <dt>Status</dt><dd>${badge(tenant.status)}</dd>
        <dt>Legal Market</dt><dd>${navLink('#/markets/detail', tenant.legalMarketId)}</dd>
        <dt>Launch Tier</dt><dd>${badge(tenant.launchTier)}</dd>
        <dt>Created</dt><dd>${fmtDate(tenant.createdAt)}</dd>
        <dt>Updated</dt><dd>${fmtDate(tenant.updatedAt)}</dd>
      </dl>
      <p class="meta-secondary" style="margin-top:4px;">Tenant ID: ${escHtml(tenant.tenantId)}</p>
    </div>

    <!-- Bootstrap Section -->
    <div class="card">
      <h3>Bootstrap Request</h3>
      ${latestBootstrap ? `
        <dl class="kv-list">
          <dt>Status</dt><dd>${badge(latestBootstrap.status)}</dd>
          <dt>Provisioning Run</dt><dd>${latestBootstrap.provisioningRunId ? navLink('#/provisioning', latestBootstrap.provisioningRunId) : '—'}</dd>
          <dt>Submitted</dt><dd>${fmtDate(latestBootstrap.createdAt)}</dd>
        </dl>
        <p class="meta-secondary" style="margin-top:4px;">Request: ${escHtml(latestBootstrap.bootstrapRequestId)} · Plan: ${escHtml(latestBootstrap.effectivePlanId)}</p>
      ` : '<p class="empty-state">No bootstrap request found.</p>'}
    </div>

    <!-- Provisioning Section -->
    <div class="card">
      <h3>Latest Provisioning</h3>
      ${tenant.latestProvisioningRunId ? `
        <p>${navLink('#/provisioning', 'View Run')} <span class="meta-secondary">${escHtml(tenant.latestProvisioningRunId)}</span></p>
      ` : '<p>No provisioning runs.</p>'}
    </div>

    <!-- Active Packs Section -->
    <div class="card">
      <h3>Active Packs</h3>
      ${(tenant.activePacks && tenant.activePacks.length > 0) ? `
        <table>
          <thead><tr><th>Pack</th><th>Family</th><th>Lifecycle</th></tr></thead>
          <tbody>
            ${tenant.activePacks.map(p => `
              <tr>
                <td>${escHtml(p.displayName)} <span class="meta-secondary">${escHtml(p.packId)}</span></td>
                <td>${badge(p.packFamily)}</td>
                <td>${badge(p.lifecycleState)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p>No active packs.</p>'}
    </div>

    <!-- Site Administration Handoff -->
    <div class="card handoff-card">
      <h3>Tenant Operational Admin</h3>
      <p>
        Day-to-day tenant configuration (users, roles, facilities, VistA connections)
        happens in the <strong>Site Administration</strong> workspace &mdash; a separate app
        scoped to one tenant at a time.
      </p>
      <ul class="handoff-items">
        <li>&#x2022; User &amp; role management</li>
        <li>&#x2022; Facility topology &amp; location hierarchy</li>
        <li>&#x2022; VistA instance connections</li>
        <li>&#x2022; Module entitlements &amp; feature flags</li>
      </ul>
      <button class="btn-handoff" onclick="openTenantAdmin('${escHtml(tenant.tenantId)}')" title="Open Site Administration workspace for this tenant">Open Site Administration ↗</button>
      <p style="font-size:11px;color:var(--text-muted);margin-top:10px;">Workspace: <code>vista-evolved-platform/apps/tenant-admin</code> &middot; Port 4520</p>
    </div>

    <!-- Actions Bar -->
    <div class="card">
      <h3>Actions</h3>
      <div class="btn-group">
        <button class="btn btn-primary" onclick="location.hash='#/bootstrap'">Initiate Bootstrap</button>
        <button class="btn" onclick="location.hash='#/provisioning'">View Provisioning</button>
        <button class="btn" onclick="doLifecycleAction('/tenants/${escHtml(tenant.tenantId)}/suspend', {reason:'operator-action',actor:'operator'}, 'tenant-actions-result')">Suspend Tenant</button>
        <button class="btn" onclick="doLifecycleAction('/tenants/${escHtml(tenant.tenantId)}/reactivate', {actor:'operator'}, 'tenant-actions-result')">Reactivate Tenant</button>
        <button class="btn btn-danger" onclick="doLifecycleAction('/tenants/${escHtml(tenant.tenantId)}/archive', {actor:'operator'}, 'tenant-actions-result')">Archive Tenant</button>
      </div>
      <div id="tenant-actions-result" style="margin-top:8px;"></div>
      <p style="font-size:12px;color:var(--text-muted);margin-top:8px;">
        Lifecycle actions are proxied to the real backend when available.
        Falls back to review-only when backend is unreachable.
      </p>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Surface 3: Tenant Bootstrap (control-plane.tenants.bootstrap) — P0 GRADUATED
// ---------------------------------------------------------------------------
function renderTenantsBootstrap() {
  const plan = DATA['effective-plans'].plans[0];
  const markets = DATA['legal-market-profiles'].items;
  const bootstrapSource = DATA['bootstrap-requests']._source || 'unavailable';

  document.getElementById('app').innerHTML = `
    <div class="breadcrumb">${navLink('#/tenants', 'Tenant Registry')} › ${navLink('#/tenants/detail', 'Tenant Detail')} › Bootstrap</div>
    <div class="surface-header">
      <h1>Tenant Bootstrap</h1>
      <div>${badge('T0')} ${badge('draft')} ${sourceBadge(bootstrapSource)}</div>
    </div>

    <p class="meta-secondary" style="margin:8px 0;">${sourceBadge(bootstrapSource)} Bootstrap · ${sourceBadge('contract-backed')} Plan resolution</p>

    <!-- Market Selection -->
    <div class="card">
      <h3>Market Selection</h3>
      <div class="filter-bar">
        <label>Legal Market</label>
        <select id="bs-market">
          ${markets.map(m => `<option value="${escHtml(m.legalMarketId)}" ${m.legalMarketId === 'PH' ? 'selected' : ''}>${escHtml(m.displayName)} (${m.legalMarketId})</option>`).join('')}
        </select>
        <label>Tenant Display Name</label>
        <input type="text" value="Sunrise Medical Center (Manila)" style="width:280px;">
        <label>Facility Type</label>
        <select><option>single-clinic</option><option>multi-facility</option><option>hospital</option></select>
      </div>
      <label style="font-size:13px;">Operator Notes (optional)</label>
      <textarea style="width:100%;height:60px;margin-top:4px;font-size:13px;border:1px solid var(--border);border-radius:4px;padding:8px;" placeholder="Notes for this bootstrap request…"></textarea>
    </div>

    <!-- Plan Resolution Summary -->
    <div class="card">
      <h3>Plan Resolution</h3>
      <p style="font-size:13px;margin-bottom:8px;">
        ${plan.resolvedPacks.length} packs resolved · ${plan.deferredItems.length} deferred ·
        Launch tier: ${badge(plan.readinessPosture.effectiveLaunchTier)} ·
        ${plan.readinessPosture.gatingBlockers.length} blocker${plan.readinessPosture.gatingBlockers.length !== 1 ? 's' : ''}
      </p>
      ${plan.readinessPosture.gatingBlockers.length > 0 ? `
        <ul class="blocker-list">
          ${plan.readinessPosture.gatingBlockers.map(b => `
            <li class="warning">
              <span class="blocker-dim">${escHtml(b.dimension)}</span>: ${escHtml(b.description)}
            </li>
          `).join('')}
        </ul>
      ` : '<p style="font-size:13px;color:var(--success);">No gating blockers.</p>'}

      <!-- Collapsible: Resolved Packs -->
      <h3 class="collapsible-toggle" style="margin-top:16px;font-size:13px;" onclick="this.classList.toggle('open');this.nextElementSibling.classList.toggle('open')">
        Resolved Packs (${plan.resolvedPacks.length})
      </h3>
      <div class="collapsible-body">
        <table>
          <thead><tr><th>Pack</th><th>Family</th><th>Source</th><th>State</th><th>Readiness</th></tr></thead>
          <tbody>
            ${plan.resolvedPacks.map(p => `
              <tr>
                <td><code style="font-size:11px;">${escHtml(p.packId)}</code></td>
                <td>${badge(p.packFamily)}</td>
                <td>${badge(p.activationSource)}</td>
                <td>${badge(p.packState)}</td>
                <td>${badge(p.readinessState)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Collapsible: Deferred Items -->
      ${plan.deferredItems.length > 0 ? `
        <h3 class="collapsible-toggle" style="margin-top:12px;font-size:13px;" onclick="this.classList.toggle('open');this.nextElementSibling.classList.toggle('open')">
          Deferred Items (${plan.deferredItems.length})
        </h3>
        <div class="collapsible-body">
          <table>
            <thead><tr><th>Pack</th><th>Reason</th><th>Migration Path</th></tr></thead>
            <tbody>
              ${plan.deferredItems.map(d => `
                <tr>
                  <td><code style="font-size:11px;">${escHtml(d.packId)}</code></td>
                  <td>${badge(d.reason)}</td>
                  <td style="font-size:12px;">${escHtml(d.migrationPath)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      <!-- Collapsible: Readiness Dimensions -->
      <h3 class="collapsible-toggle" style="margin-top:12px;font-size:13px;" onclick="this.classList.toggle('open');this.nextElementSibling.classList.toggle('open')">
        Readiness Dimensions (${plan.readinessPosture.dimensions.length})
      </h3>
      <div class="collapsible-body">
        <div class="dim-grid">
          ${plan.readinessPosture.dimensions.map(d => `
            <div class="dim-card">
              <div class="dim-name">${escHtml(d.dimension)}</div>
              <div>${badge(d.state)}</div>
              <div class="dim-scope">${escHtml(d.scopeBounds)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Actions Bar -->
    <div class="card" style="margin-top:16px;">
      <h3>Actions</h3>
      <div class="btn-group">
        <button class="btn btn-primary" onclick="doBootstrapDraftCreate('bootstrap-actions-result')">Submit Bootstrap Draft</button>
        <button class="btn" onclick="reviewResolvePlan()">Resolve Plan</button>
        <button class="btn" onclick="location.hash='#/tenants'">Cancel</button>
      </div>
      <div id="bootstrap-actions-result" style="margin-top:8px;"></div>
      <p style="font-size:12px;color:var(--text-muted);margin-top:8px;">
        Bootstrap draft creation is proxied to the real backend when available.
        Plan resolution remains contract-backed (review-only).
      </p>
    </div>

    <!-- Post-Provisioning Handoff -->
    <div class="card handoff-card" style="margin-top:16px;">
      <h3>After Provisioning</h3>
      <p>Once this tenant is provisioned, operational setup (users, roles, facilities, VistA connections) continues in the <strong>Site Administration</strong> workspace.</p>
      <button class="btn-handoff" onclick="openTenantAdmin()" title="Open Site Administration workspace">Open Site Administration ↗</button>
      <p style="font-size:11px;color:var(--text-muted);margin-top:8px;">Port 4520 &middot; <code>apps/tenant-admin</code></p>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Surface 4: Provisioning Runs (control-plane.provisioning.runs) — P0 GRADUATED
// ---------------------------------------------------------------------------
function renderProvisioningRuns() {
  const data = DATA['provisioning-runs'];
  const items = data.items;
  const pg = data.pagination;
  const source = data._source || 'unavailable';

  document.getElementById('app').innerHTML = `
    <div class="surface-header">
      <h1>Provisioning Runs</h1>
      <div class="btn-group">
        ${sourceBadge(source)}
        <button class="btn btn-primary" onclick="doCreateProvisioningRun('provisioning-actions-result')">+ Create Provisioning Run</button>
        <button class="btn" onclick="navigate()">↻ Refresh</button>
      </div>
    </div>

    <div id="provisioning-actions-result" style="margin-bottom:12px;"></div>

    <div class="filter-bar">
      <label>Status</label>
      <select disabled><option>All statuses</option></select>
      <label>Market</label>
      <select disabled><option>All markets</option></select>
    </div>

    <!-- Runs Table -->
    <table>
      <thead>
        <tr>
          <th>Run ID</th>
          <th>Tenant</th>
          <th>Market</th>
          <th>Status</th>
          <th>Steps</th>
          <th>Created</th>
          <th>Completed</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(r => `
          <tr class="clickable" data-run="${escHtml(r.provisioningRunId)}">
            <td><code>${escHtml(r.provisioningRunId).substring(0, 8)}…</code></td>
            <td>${escHtml(r.tenantId)}</td>
            <td>${escHtml(r.legalMarketId)}</td>
            <td>${badge(r.status)}</td>
            <td>${r.steps.filter(s => s.status === 'completed').length}/${r.steps.length}</td>
            <td>${fmtDate(r.createdAt)}</td>
            <td>${fmtDate(r.completedAt)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="pagination">
      <span>Showing ${items.length} of ${pg.totalItems} runs</span>
      <span>Page ${pg.page} of ${pg.totalPages}</span>
    </div>

    <!-- Run Detail Panel (showing first run) -->
    ${items.map(run => renderRunDetail(run)).join('')}
  `;
}

function renderRunDetail(run) {
  return `
    <div class="card" style="margin-top:16px;">
      <h3>Run Detail: <code>${escHtml(run.provisioningRunId).substring(0, 8)}…</code></h3>
      <dl class="kv-list">
        <dt>Run ID</dt><dd><code>${escHtml(run.provisioningRunId)}</code></dd>
        <dt>Bootstrap Request</dt><dd><code>${escHtml(run.bootstrapRequestId)}</code></dd>
        <dt>Tenant</dt><dd>${escHtml(run.tenantId)}</dd>
        <dt>Market</dt><dd>${escHtml(run.legalMarketId)}</dd>
        <dt>Effective Plan</dt><dd><code>${escHtml(run.effectivePlanId)}</code></dd>
        <dt>Status</dt><dd>${badge(run.status)}</dd>
        <dt>Correlation ID</dt><dd><code>${escHtml(run.correlationId)}</code></dd>
        <dt>Started</dt><dd>${fmtDate(run.startedAt)}</dd>
        <dt>Completed</dt><dd>${fmtDate(run.completedAt)}</dd>
      </dl>

      <!-- Steps -->
      <h3 style="margin-top:12px;">Steps</h3>
      <ul class="step-list">
        ${run.steps.map(s => `
          <li>
            ${badge(s.status)}
            <strong>${escHtml(s.stepName)}</strong>
            ${s.detail ? `<span style="font-size:12px;color:var(--text-muted);margin-left:8px;">${escHtml(s.detail)}</span>` : ''}
            ${s.startedAt ? `<span style="font-size:11px;color:var(--text-muted);margin-left:auto;">${fmtDate(s.startedAt)} → ${fmtDate(s.completedAt)}</span>` : ''}
          </li>
        `).join('')}
      </ul>

      <!-- Blockers -->
      ${run.blockers && run.blockers.length > 0 ? `
        <h3 style="margin-top:12px;">Blockers</h3>
        <ul class="blocker-list">
          ${run.blockers.map(b => `
            <li class="warning">
              <strong>${escHtml(b.blockerType)}</strong>: ${escHtml(b.description)}
              ${b.affectedStep ? ` (affects: ${escHtml(b.affectedStep)})` : ''}
            </li>
          `).join('')}
        </ul>
      ` : ''}

      <!-- Failures -->
      ${run.failures && run.failures.length > 0 ? `
        <h3 style="margin-top:12px;">Failures</h3>
        <ul class="blocker-list">
          ${run.failures.map(f => `
            <li class="error">
              <strong>[${escHtml(f.stepId)}] ${escHtml(f.failureType)}</strong>: ${escHtml(f.description)}
            </li>
          `).join('')}
        </ul>
      ` : ''}

      <!-- Actions -->
      <div style="margin-top:12px;">
        <div id="run-action-result-${escHtml(run.provisioningRunId)}" style="margin-bottom:8px;"></div>
        <div class="btn-group">
          ${run.status === 'pending' ? `<button class="btn btn-primary" onclick="doLifecycleAction('/provisioning/runs/${encodeURIComponent(run.provisioningRunId)}/queue', {}, 'run-action-result-${escHtml(run.provisioningRunId)}')">Queue Run</button>` : ''}
          ${(run.status === 'queued' || run.status === 'in-progress')
            ? `<button class="btn" onclick="doLifecycleAction('/provisioning/runs/${encodeURIComponent(run.provisioningRunId)}/cancel', {}, 'run-action-result-${escHtml(run.provisioningRunId)}')">Cancel Run</button>`
            : ''}
          <button class="btn" onclick="navigate()">↻ Refresh</button>
        </div>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Surface 5: Market Management (control-plane.markets.management)
// ---------------------------------------------------------------------------
function renderMarketsManagement() {
  const data = DATA['legal-market-profiles'];
  const items = data.items;
  const pg = data.pagination;

  document.getElementById('app').innerHTML = `
    <div class="surface-header">
      <h1>Market Management</h1>
      <div class="btn-group">
        <button class="btn btn-primary" onclick="reviewCreateMarketDraft()">+ Create Market Draft</button>
        <button class="btn" onclick="navigate()">↻ Refresh</button>
      </div>
    </div>

    <div class="filter-bar">
      <label>Status</label>
      <select disabled><option>All statuses</option></select>
      <label>Launch Tier</label>
      <select disabled><option>All tiers</option></select>
    </div>

    <table>
      <thead>
        <tr>
          <th>Market</th>
          <th>Status</th>
          <th>Launch Tier</th>
          <th>Packs</th>
          <th>Readiness</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(m => {
          const totalPacks = m.mandatedPackCount + m.defaultOnPackCount + m.eligiblePackCount;
          const dims = m.readinessDimensions || [];
          const highestState = dims.length > 0 ? dims.reduce((best, d) => {
            const order = ['declared','specified','implemented','tested','production'];
            return order.indexOf(d.state) > order.indexOf(best) ? d.state : best;
          }, dims[0].state) : '—';
          return `
          <tr class="clickable" onclick="location.hash='#/markets/detail'">
            <td>${escHtml(m.displayName)} <span class="meta-secondary">(${escHtml(m.legalMarketId)})</span></td>
            <td>${badge(m.status)}</td>
            <td>${badge(m.launchTier)}</td>
            <td>${totalPacks} packs <span class="meta-secondary">(${m.mandatedPackCount} mandated)</span></td>
            <td>${badge(highestState)} <span class="meta-secondary">${dims.length} dimensions</span></td>
          </tr>
        `}).join('')}
      </tbody>
    </table>

    <div class="pagination">
      <span>Showing ${items.length} of ${pg.totalItems} markets</span>
      <span>Page ${pg.page} of ${pg.totalPages}</span>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Surface 6: Market Detail (control-plane.markets.detail)
// ---------------------------------------------------------------------------
function renderMarketsDetail() {
  const market = DATA['legal-market-profiles'].items[0]; // PH market

  document.getElementById('app').innerHTML = `
    <div class="breadcrumb">${navLink('#/markets', 'Market Management')} › ${escHtml(market.displayName)}</div>
    <div class="surface-header">
      <h1>${escHtml(market.displayName)}</h1>
      <div>${badge(market.status)} ${badge(market.launchTier)}</div>
    </div>

    <!-- Profile Summary -->
    <div class="card">
      <h3>Profile Summary</h3>
      <dl class="kv-list">
        <dt>Status</dt><dd>${badge(market.status)}</dd>
        <dt>Launch Tier</dt><dd>${badge(market.launchTier)}</dd>
        <dt>Version</dt><dd>${escHtml(market.version)}</dd>
        <dt>Total Packs</dt><dd>${market.mandatedPackCount + market.defaultOnPackCount + market.eligiblePackCount} <span class="meta-secondary">(${market.mandatedPackCount} mandated, ${market.defaultOnPackCount} default-on, ${market.eligiblePackCount} eligible)</span></dd>
      </dl>
      <p class="meta-secondary" style="margin-top:4px;">Legal Market ID: ${escHtml(market.legalMarketId)}</p>
    </div>

    <!-- Readiness Dimensions (collapsible) -->
    <div class="card">
      <div class="collapsible-toggle" onclick="this.classList.toggle('open');this.nextElementSibling.classList.toggle('open')">
        Readiness Dimensions (${(market.readinessDimensions || []).length})
      </div>
      <div class="collapsible-body">
        <div class="dim-grid">
          ${(market.readinessDimensions || []).map(d => `
            <div class="dim-card">
              <div class="dim-name">${escHtml(d.dimension)}</div>
              <div>${badge(d.state)}</div>
              <div class="dim-scope">${escHtml(d.scopeBounds)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Pack Groups (collapsible) -->
    <div class="card">
      <div class="collapsible-toggle" onclick="this.classList.toggle('open');this.nextElementSibling.classList.toggle('open')">
        Mandated Packs (${(market.mandatedPacks || []).length})
      </div>
      <div class="collapsible-body">
        ${(market.mandatedPacks && market.mandatedPacks.length > 0) ? `
          <table>
            <thead><tr><th>Pack</th><th>Family</th><th>Lifecycle</th></tr></thead>
            <tbody>
              ${market.mandatedPacks.map(p => `
                <tr>
                  <td>${escHtml(p.displayName)} <span class="meta-secondary">${escHtml(p.packId)}</span></td>
                  <td>${badge(p.packFamily)}</td>
                  <td>${badge(p.lifecycleState)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p>None.</p>'}
      </div>
    </div>

    <div class="card">
      <div class="collapsible-toggle" onclick="this.classList.toggle('open');this.nextElementSibling.classList.toggle('open')">
        Default-On Packs (${(market.defaultOnPacks || []).length})
      </div>
      <div class="collapsible-body">
        ${(market.defaultOnPacks && market.defaultOnPacks.length > 0) ? `
          <table>
            <thead><tr><th>Pack</th><th>Family</th><th>Lifecycle</th></tr></thead>
            <tbody>
              ${market.defaultOnPacks.map(p => `
                <tr>
                  <td>${escHtml(p.displayName)} <span class="meta-secondary">${escHtml(p.packId)}</span></td>
                  <td>${badge(p.packFamily)}</td>
                  <td>${badge(p.lifecycleState)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p>None.</p>'}
      </div>
    </div>

    <div class="card">
      <div class="collapsible-toggle" onclick="this.classList.toggle('open');this.nextElementSibling.classList.toggle('open')">
        Eligible Packs (${(market.eligiblePacks || []).length})
      </div>
      <div class="collapsible-body">
        ${(market.eligiblePacks && market.eligiblePacks.length > 0) ? `
          <table>
            <thead><tr><th>Pack</th><th>Family</th><th>Lifecycle</th></tr></thead>
            <tbody>
              ${market.eligiblePacks.map(p => `
                <tr>
                  <td>${escHtml(p.displayName || '—')} <span class="meta-secondary">${escHtml(p.packId)}</span></td>
                  <td>${badge(p.packFamily)}</td>
                  <td>${badge(p.lifecycleState || 'draft')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p>None.</p>'}
      </div>
    </div>

    <!-- Actions -->
    <div class="card" style="margin-top:16px;">
      <h3>Actions</h3>
      <div class="btn-group">
        <button class="btn btn-primary" onclick="reviewUpdateMarketDraft('${escHtml(market.legalMarketId)}')">Update Draft</button>
        <button class="btn" onclick="reviewSubmitMarketForReview('${escHtml(market.legalMarketId)}')">Submit for Review</button>
        <button class="btn" onclick="location.hash='#/bootstrap'">Bootstrap Tenant</button>
        <button class="btn" onclick="location.hash='#/markets'">← Back</button>
      </div>
      <p style="font-size:12px;color:var(--text-muted);margin-top:8px;">
        Review-only — actions open review dialogs. No market profile is modified.
      </p>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Surface 7: Pack Catalog (control-plane.packs.catalog)
// ---------------------------------------------------------------------------
function renderPacksCatalog() {
  const data = DATA['packs'];
  const items = data.items;
  const pg = data.pagination;
  const caps = DATA['capabilities'].items;

  document.getElementById('app').innerHTML = `
    <div class="surface-header">
      <h1>Pack Catalog</h1>
      <div class="btn-group">
        <button class="btn btn-primary" onclick="reviewCreatePackDraft()">+ Create Pack Draft</button>
        <button class="btn" onclick="navigate()">↻ Refresh</button>
      </div>
    </div>

    <div class="filter-bar">
      <label>Family</label>
      <select disabled>
        <option>All families</option>
        <option>language</option><option>locale</option><option>regulatory</option>
        <option>national-standards</option><option>payer</option><option>specialty</option><option>tenant-overlay</option>
      </select>
      <label>Lifecycle</label>
      <select disabled>
        <option>All states</option>
        <option>draft</option><option>review-pending</option><option>validated</option>
        <option>tested</option><option>published</option><option>activated</option><option>retired</option>
      </select>
      <label>Search</label>
      <input type="text" placeholder="Search packs…" disabled>
    </div>

    <table>
      <thead>
        <tr>
          <th>Pack</th>
          <th>Family</th>
          <th>Version</th>
          <th>Lifecycle</th>
          <th>Markets</th>
          <th>Capabilities</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(p => `
          <tr>
            <td>${escHtml(p.displayName)} <span class="meta-secondary">${escHtml(p.packId)}</span></td>
            <td>${badge(p.packFamily)}</td>
            <td>${escHtml(p.version)}</td>
            <td>${badge(p.lifecycleState)}</td>
            <td>${(p.eligibleMarkets && p.eligibleMarkets.length > 0) ? p.eligibleMarkets.join(', ') : 'All'}</td>
            <td>${(p.capabilityContributions || []).length > 0 ? (p.capabilityContributions || []).map(c => `<code style="font-size:11px;">${escHtml(c.capabilityId)}</code>`).join(', ') : '—'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="pagination">
      <span>Showing ${items.length} of ${pg.totalItems} packs</span>
      <span>Page ${pg.page} of ${pg.totalPages}</span>
    </div>

      <!-- Pack Detail Panel (show first pack) -->
    ${items.length > 0 ? (() => {
      const p0 = items[0];
      const lc = p0.lifecycle || {};
      return `<div class="card" style="margin-top:16px;">
        <h3>${escHtml(p0.displayName)}</h3>
        <dl class="kv-list">
          <dt>Family</dt><dd>${badge(p0.packFamily)}</dd>
          <dt>Version</dt><dd>${escHtml(p0.version)}</dd>
          <dt>Lifecycle</dt><dd>${badge(p0.lifecycleState)}</dd>
          ${lc.owner ? `<dt>Owner</dt><dd>${escHtml(lc.owner)}</dd>` : ''}
          ${lc.implementationLocus ? `<dt>Implementation</dt><dd>${escHtml(lc.implementationLocus)}</dd>` : ''}
          <dt>Description</dt><dd style="font-size:12px;">${escHtml(p0.description)}</dd>
        </dl>
        <p class="meta-secondary" style="margin-top:4px;">Pack ID: ${escHtml(p0.packId)}</p>

        ${(p0.dependencies && p0.dependencies.length > 0) ? `
          <h3 style="margin-top:12px;">Dependencies</h3>
          <table>
            <thead><tr><th>Pack ID</th><th>Type</th><th>Rationale</th></tr></thead>
            <tbody>
              ${p0.dependencies.map(d => `
                <tr><td><code>${escHtml(d.packId)}</code></td><td>${badge(d.type)}</td><td style="font-size:12px;">${escHtml(d.rationale || '')}</td></tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}

        ${(p0.adapterRequirements && p0.adapterRequirements.length > 0) ? `
          <h3 style="margin-top:12px;">Adapter Requirements</h3>
          <table>
            <thead><tr><th>Adapter ID</th><th>Type</th><th>Required</th><th>Fallback</th></tr></thead>
            <tbody>
              ${p0.adapterRequirements.map(a => `
                <tr><td><code>${escHtml(a.adapterId)}</code></td><td>${escHtml(a.adapterType)}</td><td>${a.required ? 'Yes' : 'No'}</td><td>${escHtml(a.fallbackBehavior || '—')}</td></tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}

        <div style="margin-top:12px;">
          <div class="btn-group">
            <button class="btn" onclick="reviewUpdatePackDraft('${escHtml(p0.packId)}')">Update Draft</button>
            <button class="btn" onclick="reviewSubmitPackForReview('${escHtml(p0.packId)}')">Submit for Review</button>
          </div>
        </div>
      </div>`;
    })() : ''}
  `;
}

// ---------------------------------------------------------------------------
// Surface 8: System Configuration (control-plane.system.config)
// ---------------------------------------------------------------------------
function renderSystemConfig() {
  const raw = DATA['system-config'] || {};
  // Support both the new flat format {ok, _source, config:{...}} and legacy format with deploymentProfile
  const cfg = raw.config || raw;
  const source = raw._source || 'unavailable';

  // Normalize to display-friendly KV pairs from whatever the API returns
  const identity = cfg.identity || {};
  const envs = cfg.environments || [];
  const provDefaults = cfg.provisioningDefaults || {};
  const retentionDays = cfg.retentionDays || '—';
  const flags = cfg.featureFlags || [];
  const params = cfg.systemParameters || [];

  // Group params by category
  const grouped = {};
  params.forEach(p => {
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category].push(p);
  });

  document.getElementById('app').innerHTML = `
    <div class="surface-header">
      <h1>System Configuration</h1>
      <div class="btn-group">
        ${sourceBadge(source)}
        <button class="btn" onclick="navigate()">↻ Refresh</button>
      </div>
    </div>

    <!-- Runtime Settings -->
    <div class="card">
      <h3>Runtime Settings</h3>
      <dl class="kv-list">
        <dt>Identity Provider</dt><dd>${badge(identity.provider || 'vista-xwb')}</dd>
        <dt>OIDC</dt><dd>${identity.oidcEnabled ? '<span style="color:var(--success);">Enabled</span>' : '<span style="color:var(--text-muted);">Disabled</span>'}</dd>
        <dt>Environments</dt><dd>${(Array.isArray(envs) ? envs : [envs]).map(e => badge(e)).join(' ') || '—'}</dd>
        <dt>Provisioning Topology</dt><dd>${escHtml(provDefaults.topology || 'single-site')}</dd>
        <dt>Retention (days)</dt><dd>${escHtml(String(retentionDays))}</dd>
      </dl>
    </div>

    ${flags.length > 0 ? `
    <!-- Feature Flags -->
    <div class="card">
      <h3>Feature Flags (${flags.length})</h3>
      <table>
        <thead><tr><th>Flag Key</th><th>Display Name</th><th>Enabled</th><th>Scope</th><th>Updated</th><th>Action</th></tr></thead>
        <tbody>
          ${flags.map(f => `
            <tr>
              <td><code>${escHtml(f.flagKey)}</code></td>
              <td>${escHtml(f.displayName)}</td>
              <td>${f.enabled ? '<span style="color:var(--success);font-weight:600;">ON</span>' : '<span style="color:var(--text-muted);">OFF</span>'}</td>
              <td>${escHtml(f.scope || '—')}</td>
              <td>${fmtDate(f.updatedAt)}</td>
              <td><button class="btn" onclick="reviewToggleFeatureFlag('${escHtml(f.flagKey)}', ${f.enabled})">Toggle</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : `
    <div class="card">
      <h3>Feature Flags</h3>
      <p style="color:var(--text-muted);font-size:13px;">Feature flags are managed via the Environments surface. No flags currently configured.</p>
      <a href="#/environments" class="btn" style="display:inline-block;margin-top:8px;">Manage Feature Flags</a>
    </div>
    `}

    ${params.length > 0 ? `
    <!-- System Parameters -->
    <div class="card">
      <h3>System Parameters (${params.length})</h3>
      ${Object.entries(grouped).map(([cat, ps]) => `
        <div class="config-group">
          <h4>${escHtml(cat)}</h4>
          <table>
            <thead><tr><th>Parameter</th><th>Value</th><th>Default</th><th>Description</th><th>Action</th></tr></thead>
            <tbody>
              ${ps.map(p => `
                <tr>
                  <td><code>${escHtml(p.paramKey)}</code></td>
                  <td><strong>${escHtml(p.value)}</strong></td>
                  <td>${escHtml(p.defaultValue || '—')}</td>
                  <td style="font-size:12px;">${escHtml(p.description || '')}</td>
                  <td><button class="btn" onclick="reviewUpdateSystemParameter('${escHtml(p.paramKey)}', '${escHtml(p.value)}')">Edit</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <p style="font-size:12px;color:var(--text-muted);margin-top:8px;">
      Last updated: ${fmtDate(raw.lastUpdatedAt)}
    </p>
  `;
}


// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
async function boot() {
  const sel = document.getElementById('role-selector');
  if (sel) sel.value = getActiveRole();
  const ok = await loadData();
  if (!ok) return;
  navigate();
}

// ---------------------------------------------------------------------------
// Static Surface Helper — for surfaces with no live data source yet
// ---------------------------------------------------------------------------
function renderStaticSurface(title, surfaceId, icon, description, domain, sourceOfTruth, actions) {
  const app = document.getElementById('app');
  // Build a feature checklist from the action list
  const featureItems = actions.map(a => {
    const ready = a.status === 'active' || a.status === 'graduated';
    return `<li>
      <span class="${ready ? 'feature-check' : 'feature-pending'}">${ready ? '✓' : '○'}</span>
      ${escHtml(a.label)}
    </li>`;
  }).join('');

  app.innerHTML = `
    <div class="deferred-surface">
      <div class="deferred-icon">${icon}</div>
      <h2>${escHtml(title)}</h2>
      <div class="deferred-desc">${escHtml(description)}</div>

      ${featureItems.length > 0 ? `
        <h3 style="font-size:13px;text-align:left;max-width:420px;margin:0 auto 8px;color:var(--text-muted);">Planned capabilities</h3>
        <ul class="deferred-feature-list">${featureItems}</ul>
      ` : ''}

      <div class="deferred-status-bar">
        ${sourceBadge('static-review')} This surface is designed and contracted — backend integration is pending.
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Surface: Home (control-plane.home) — Action Center (design-contract-v3 §12)
// ---------------------------------------------------------------------------
function renderHome() {
  const app = document.getElementById('app');
  const tenantData = DATA['tenants'] || { items: [] };
  const runData = DATA['provisioning-runs'] || { items: [] };
  const bootstrapData = DATA['bootstrap-requests'] || { items: [] };
  const tenants = tenantData.items || [];
  const runs = runData.items || [];
  const bootstrapReqs = bootstrapData.items || [];

  const tenantSource = tenantData._source || 'unavailable';

  // Card: Pending Requests
  const pendingRequests = bootstrapReqs.filter(r =>
    ['pending', 'submitted', 'under-review'].includes(r.status)
  );

  // Card: Active Provisioning
  const activeRuns = runs.filter(r =>
    ['queued', 'in-progress', 'failed'].includes(r.status)
  );

  // Card: Tenant Summary
  const activeTenants = tenants.filter(t => t.status === 'active').length;
  const suspendedTenants = tenants.filter(t => t.status === 'suspended').length;
  const draftTenants = tenants.filter(t => t.status === 'draft' || t.status === 'bootstrap-pending').length;

  // Card: Next Actions — computed from above
  const nextActions = [];
  if (pendingRequests.length > 0) {
    nextActions.push({ label: `Review ${pendingRequests.length} pending request${pendingRequests.length > 1 ? 's' : ''}`, href: '#/bootstrap' });
  }
  if (activeRuns.filter(r => r.status === 'failed').length > 0) {
    nextActions.push({ label: `Investigate ${activeRuns.filter(r => r.status === 'failed').length} failed run${activeRuns.filter(r => r.status === 'failed').length > 1 ? 's' : ''}`, href: '#/provisioning' });
  }
  if (activeRuns.filter(r => r.status === 'in-progress').length > 0) {
    nextActions.push({ label: `Monitor ${activeRuns.filter(r => r.status === 'in-progress').length} active run${activeRuns.filter(r => r.status === 'in-progress').length > 1 ? 's' : ''}`, href: '#/provisioning' });
  }
  if (suspendedTenants > 0) {
    nextActions.push({ label: `Review ${suspendedTenants} suspended tenant${suspendedTenants > 1 ? 's' : ''}`, href: '#/tenants' });
  }
  if (nextActions.length === 0) {
    nextActions.push({ label: 'All clear — no urgent actions', href: '#/tenants' });
  }

  app.innerHTML = `
    <div class="surface-header">
      <div>
        <h1>Operations Center</h1>
        <p style="font-size:13px;color:var(--text-muted);">What requires action right now across tenants, provisioning, and operations?</p>
      </div>
    </div>

    <div class="stat-row">
      <div class="stat-box"><div class="stat-value">${tenants.length}</div><div class="stat-label">Total Tenants</div></div>
      <div class="stat-box"><div class="stat-value" style="color:var(--success);">${activeTenants}</div><div class="stat-label">Active</div></div>
      <div class="stat-box"><div class="stat-value" style="color:var(--warning);">${draftTenants}</div><div class="stat-label">Draft / Pending</div></div>
      <div class="stat-box"><div class="stat-value" style="color:var(--danger);">${suspendedTenants}</div><div class="stat-label">Suspended</div></div>
      <div class="stat-box"><div class="stat-value">${runs.length}</div><div class="stat-label">Provisioning Runs</div></div>
    </div>

    <div class="home-grid">
      <div class="home-card" onclick="location.hash='#/bootstrap'">
        <div class="home-card-header">
          <span class="home-card-title">Pending Requests</span>
          <span class="home-card-count">${pendingRequests.length}</span>
        </div>
        <p class="home-card-desc">Bootstrap requests in pending, submitted, or under-review state.</p>
        <div class="home-card-source">${sourceBadge(tenantSource)}</div>
        <div class="home-card-link">Review ${pendingRequests.length} pending request${pendingRequests.length !== 1 ? 's' : ''} &rarr;</div>
      </div>

      <div class="home-card" onclick="location.hash='#/provisioning'">
        <div class="home-card-header">
          <span class="home-card-title">Active Provisioning</span>
          <span class="home-card-count ${activeRuns.some(r => r.status === 'failed') ? 'count-alert' : ''}">${activeRuns.length}</span>
        </div>
        <p class="home-card-desc">Provisioning runs in queued, in-progress, or failed state.</p>
        <div class="home-card-source">${sourceBadge(tenantSource)}</div>
        <div class="home-card-link">View provisioning &rarr;</div>
      </div>

      <div class="home-card" onclick="location.hash='#/alerts'">
        <div class="home-card-header">
          <span class="home-card-title">Recent Alerts</span>
          <span class="home-card-count">0</span>
        </div>
        <p class="home-card-desc">Unresolved alerts and top severity. ${sourceBadge('static-review')}</p>
        <div class="home-card-link">View alerts &rarr;</div>
      </div>

      <div class="home-card" onclick="location.hash='#/tenants'">
        <div class="home-card-header">
          <span class="home-card-title">Tenant Summary</span>
          <span class="home-card-count">${tenants.length}</span>
        </div>
        <p class="home-card-desc">${activeTenants} active · ${suspendedTenants} suspended · ${draftTenants} draft/pending</p>
        <div class="home-card-source">${sourceBadge(tenantSource)}</div>
        <div class="home-card-link">View tenants &rarr;</div>
      </div>

      <div class="home-card home-card-actions">
        <div class="home-card-header">
          <span class="home-card-title">Next Actions</span>
        </div>
        <ul class="home-actions-list">
          ${nextActions.map(a => `<li><a href="${a.href}">${escHtml(a.label)} &rarr;</a></li>`).join('')}
        </ul>
      </div>

      <div class="home-card handoff-card" style="grid-column: 1 / -1;">
        <h3>Tenant Operational Admin</h3>
        <p>After onboarding and provisioning, day-to-day tenant configuration
        moves to the <strong>Site Administration</strong> workspace (users, roles, facilities, VistA connections).</p>
        <button class="btn-handoff" onclick="openTenantAdmin()" title="Open Site Administration workspace">Open Site Administration ↗</button>
        <p style="font-size:11px;color:var(--text-muted);margin-top:8px;">Port 4520 &middot; <code>apps/tenant-admin</code></p>
      </div>
    </div>

    <div style="margin-top:20px; text-align:center;">
      <span class="meta-secondary">22 surfaces · 8 domains · 11 real + 11 planned · ${sourceBadge(tenantSource)} real-backend + contract-backed</span>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Surface: Identity & Invitations (control-plane.identity.invitations)
// ---------------------------------------------------------------------------
async function renderIdentityInvitations() {
  const app = document.getElementById('app');
  app.innerHTML = '<p class="meta-secondary" style="padding:12px;">Loading invitations…</p>';
  let invitations = [];
  let source = 'unavailable';
  try {
    const r = await apiFetch(`${API_BASE}/operator/invitations`);
    if (r.ok) {
      const d = await r.json();
      invitations = d.invitations || [];
      source = d._source || 'real-backend';
    }
  } catch (_) { /* keep empty */ }
  app.innerHTML = `
    <div class="surface-header">
      <div>
        <div class="breadcrumb">${navLink('#/home', 'Home')} / Identity</div>
        <h1>Identity & Invitations</h1>
      </div>
      <div class="btn-group">${sourceBadge(source)}</div>
    </div>
    <p class="meta-secondary">PG-backed via control-plane-api <code>operator_invitation</code>. Create uses lifecycle proxy (shows token once).</p>
    <div class="card">
      <h3>Pending / recent invitations</h3>
      <table>
        <thead><tr><th>Email</th><th>Status</th><th>Invited by</th><th>Created</th></tr></thead>
        <tbody>
          ${invitations.length ? invitations.map(i => `
            <tr>
              <td>${escHtml(i.email)}</td>
              <td>${badge(i.status)}</td>
              <td>${escHtml(i.invitedBy || '—')}</td>
              <td>${fmtDate(i.createdAt)}</td>
            </tr>`).join('') : '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">No rows (start API + migrate v9)</td></tr>'}
        </tbody>
      </table>
      <p style="margin-top:12px;">
        <button class="btn btn-primary" type="button" onclick="cpCreateInvitationPrompt()">+ Create invitation (demo)</button>
      </p>
    </div>`;
}

window.cpCreateInvitationPrompt = async function () {
  const email = window.prompt('Operator email to invite');
  if (!email) return;
  try {
    const resp = await apiFetch(`${LIFECYCLE_API_BASE}/operator/invitations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), invitedBy: getActiveRole() }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      window.alert(data.message || data.error || 'Request failed');
      return;
    }
    if (data.plainToken) {
      window.alert('Invitation created. One-time token (save now): ' + data.plainToken);
    }
    navigate();
  } catch (e) {
    window.alert('Network error');
  }
};

// ---------------------------------------------------------------------------
// Surface: Payer Readiness (control-plane.markets.payer-readiness)
// ---------------------------------------------------------------------------
function renderPayerReadiness() {
  renderStaticSurface(
    'Payer Readiness',
    'control-plane.markets.payer-readiness',
    '🏦',
    'Payer adapter integration status per market. Tracks which payer connectors are declared, tested, and production-eligible.',
    'Catalogs & Governance',
    'Platform PG — payer_connector_status',
    [
      { id: 'R16', label: 'List payer readiness by market', status: 'deferred', note: 'Read-only surface' },
      { id: 'R17', label: 'Get payer connector detail', status: 'deferred', note: 'Adapter health + test history' },
    ]
  );
}

// ---------------------------------------------------------------------------
// Surface: Eligibility Simulator (control-plane.markets.eligibility-sim)
// ---------------------------------------------------------------------------
function renderEligibilitySimulator() {
  renderStaticSurface(
    'Pack Eligibility Simulator',
    'control-plane.markets.eligibility-sim',
    '🧮',
    'Dry-run pack eligibility evaluation. Select a market and tenant parameters to preview which packs would resolve, defer, or block.',
    'Catalogs & Governance',
    'Composition & Eligibility Service (Plan Resolver)',
    [
      { id: 'R18', label: 'Simulate eligibility', status: 'deferred', note: 'Uses plan-resolver in preview mode — no side effects' },
    ]
  );
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Surface: Alert Center (control-plane.ops.alerts)
// ---------------------------------------------------------------------------
async function renderAlertCenter() {
  const app = document.getElementById('app');
  app.innerHTML = '<p class="meta-secondary" style="padding:12px;">Loading alerts…</p>';
  let alerts = [];
  let source = 'unavailable';
  try {
    const r = await apiFetch(`${API_BASE}/operator/alerts?openOnly=1`);
    if (r.ok) {
      const d = await r.json();
      alerts = d.alerts || [];
      source = d._source || 'real-backend';
    }
  } catch (_) { /* empty */ }
  app.innerHTML = `
    <div class="surface-header">
      <div>
        <div class="breadcrumb">${navLink('#/home', 'Home')} / Operations</div>
        <h1>Alert Center</h1>
      </div>
      <div class="btn-group">${sourceBadge(source)}</div>
    </div>
    <p class="meta-secondary">Open alerts from <code>operator_alert</code> (migration v9).</p>
    <div class="card">
      <h3>Open alerts</h3>
      <table>
        <thead><tr><th>Severity</th><th>Title</th><th>Created</th><th></th></tr></thead>
        <tbody>
          ${alerts.length ? alerts.map(a => `
            <tr>
              <td>${escHtml(a.severity)}</td>
              <td>${escHtml(a.title)}</td>
              <td>${fmtDate(a.createdAt)}</td>
              <td><button class="btn" type="button" onclick="cpAckAlert('${a.id}')">Ack</button></td>
            </tr>`).join('') : '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">No open alerts</td></tr>'}
        </tbody>
      </table>
      <p style="margin-top:12px;">
        <button class="btn btn-primary" type="button" onclick="cpCreateAlertPrompt()">+ Create alert (demo)</button>
      </p>
    </div>`;
}

window.cpAckAlert = async function (id) {
  try {
    const resp = await apiFetch(`${LIFECYCLE_API_BASE}/operator/alerts/${encodeURIComponent(id)}/ack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actor: getActiveRole() }),
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      window.alert(data.error || 'Ack failed');
      return;
    }
    navigate();
  } catch (_) {
    window.alert('Network error');
  }
};

window.cpCreateAlertPrompt = async function () {
  const title = window.prompt('Alert title');
  if (!title) return;
  const severity = window.prompt('Severity (info|warning|error|critical)', 'warning') || 'warning';
  try {
    const resp = await apiFetch(`${LIFECYCLE_API_BASE}/operator/alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, severity, actor: getActiveRole() }),
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      window.alert(data.error || 'Create failed');
      return;
    }
    navigate();
  } catch (_) {
    window.alert('Network error');
  }
};

// ---------------------------------------------------------------------------
// Surface: Backup / Restore / DR (control-plane.ops.backup-dr)
// ---------------------------------------------------------------------------
function renderBackupDr() {
  renderStaticSurface(
    'Backup / Restore / DR',
    'control-plane.ops.backup-dr',
    '🛡️',
    'Backup schedules, restore points, and disaster recovery posture. Restore is the highest-risk operator action — requires fleet:restore permission and written justification.',
    'Operations',
    'Platform PG — backup_schedule, restore_points',
    [
      { id: 'R23', label: 'List backup schedules', status: 'deferred', note: 'Per-tenant and platform-wide' },
      { id: 'R24', label: 'List restore points', status: 'deferred', note: 'Point-in-time restore catalog' },
      { id: 'W25', label: 'Initiate restore', status: 'deferred', note: 'HIGHEST-RISK: requires fleet:restore + reason + confirmation' },
      { id: 'W26', label: 'Update backup schedule', status: 'deferred', note: 'Review-only when implemented' },
    ]
  );
}

// ---------------------------------------------------------------------------
// Surface: Environments & Feature Flags (control-plane.ops.environments)
// ---------------------------------------------------------------------------
async function renderEnvironmentsFlags() {
  const app = document.getElementById('app');
  app.innerHTML = '<p class="meta-secondary" style="padding:12px;">Loading feature flags…</p>';
  let flags = [];
  let source = 'unavailable';
  try {
    const r = await apiFetch(`${API_BASE}/operator/feature-flags`);
    if (r.ok) {
      const d = await r.json();
      flags = d.flags || [];
      source = d._source || 'real-backend';
    }
  } catch (_) { /* empty */ }
  app.innerHTML = `
    <div class="surface-header">
      <div>
        <div class="breadcrumb">${navLink('#/home', 'Home')} / Operations</div>
        <h1>Environments & Feature Flags</h1>
      </div>
      <div class="btn-group">${sourceBadge(source)}</div>
    </div>
    <div class="card">
      <h3>Flags (<code>environment_feature_flag</code>)</h3>
      <table>
        <thead><tr><th>Key</th><th>Environment</th><th>Enabled</th></tr></thead>
        <tbody>
          ${flags.length ? flags.map(f => `
            <tr>
              <td><code>${escHtml(f.flagKey)}</code></td>
              <td>${escHtml(f.environment)}</td>
              <td>${f.enabled ? 'yes' : 'no'}</td>
            </tr>`).join('') : '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);">No flags yet</td></tr>'}
        </tbody>
      </table>
      <p style="margin-top:12px;font-size:12px;color:var(--text-muted);">
        Upsert demo: <button class="btn" type="button" onclick="cpUpsertFlagPrompt()">Set flag</button>
      </p>
    </div>`;
}

window.cpUpsertFlagPrompt = async function () {
  const flagKey = window.prompt('flagKey');
  if (!flagKey) return;
  const environment = window.prompt('environment', 'default') || 'default';
  const enabled = window.confirm('Enable this flag?');
  try {
    const resp = await apiFetch(`${LIFECYCLE_API_BASE}/operator/feature-flags`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flagKey, environment, enabled, actor: getActiveRole() }),
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      window.alert(data.error || 'Upsert failed');
      return;
    }
    navigate();
  } catch (_) {
    window.alert('Network error');
  }
};

// ---------------------------------------------------------------------------
// Surface: Billing & Entitlements (control-plane.commercial.billing)
// ---------------------------------------------------------------------------
async function renderBillingEntitlements() {
  const app = document.getElementById('app');
  const tenants = DATA['tenants']?.items || [];
  let entitlements = [];
  let entSource = 'unavailable';
  let billingStatus = { configured: false, provider: 'lago', model: 'usage-based + subscription' };
  try {
    const r = await apiFetch(`${API_BASE}/operator/entitlements`);
    if (r.ok) {
      const d = await r.json();
      entitlements = d.entitlements || [];
      entSource = d._source || 'real-backend';
    }
  } catch (_) { /* ignore */ }
  try {
    const bs = await apiFetch(`${API_BASE}/billing/status`);
    if (bs.ok) {
      const bd = await bs.json();
      if (bd.billing) billingStatus = bd.billing;
    }
  } catch (_) { /* ignore */ }

  app.innerHTML = `
    <div class="surface-header">
      <div>
        <h1>Billing & Entitlements</h1>
      </div>
      <div class="btn-group">${sourceBadge(entSource)}</div>
    </div>

    <div class="card">
      <h3>Billing Engine</h3>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
        <div style="flex:1;min-width:180px;padding:12px;background:var(--surface-alt,#f9fafb);border-radius:6px;">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;">Provider</div>
          <div style="font-weight:600;margin-top:2px;">${escHtml(billingStatus.provider || 'lago')} (self-hosted)</div>
        </div>
        <div style="flex:1;min-width:180px;padding:12px;background:var(--surface-alt,#f9fafb);border-radius:6px;">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;">Model</div>
          <div style="font-weight:600;margin-top:2px;">${escHtml(billingStatus.model || 'usage-based + subscription')}</div>
        </div>
        <div style="flex:1;min-width:180px;padding:12px;background:var(--surface-alt,#f9fafb);border-radius:6px;">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;">Connection</div>
          <div style="font-weight:600;margin-top:2px;color:${billingStatus.configured ? 'var(--success)' : '#92400e'};">${billingStatus.configured ? 'Connected' : 'Awaiting deployment'}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <h3>Commercial Entitlements</h3>
      <table>
        <thead><tr><th>Tenant</th><th>SKU</th><th>Status</th><th>Provider</th></tr></thead>
        <tbody>
          ${entitlements.length ? entitlements.map(e => `
            <tr>
              <td><code>${escHtml(String(e.tenant_id || e.tenantId || '—'))}</code></td>
              <td>${escHtml(e.sku || '—')}</td>
              <td>${badge(e.status || 'pending')}</td>
              <td>${escHtml(e.billing_provider || e.billingProvider || 'lago')}</td>
            </tr>`).join('') : '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">No entitlement rows yet. Entitlements are created when a tenant subscription is activated in Lago.</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="card">
      <h3>Tenant Entitlement Summary</h3>
      <table>
        <thead><tr><th>Tenant</th><th>Status</th><th>Market</th><th>Launch Tier</th><th>Active Packs</th><th>Billing</th></tr></thead>
        <tbody>
          ${tenants.map(t => `
            <tr>
              <td>${navLink(`#/tenants/detail?id=${t.tenantId}`, t.displayName || t.tenantId)}</td>
              <td>${badge(t.status)}</td>
              <td>${escHtml(t.legalMarketId || '—')}</td>
              <td>${badge(t.effectiveLaunchTier || 'T0')}</td>
              <td>${(t.activePacks || []).length}</td>
              <td>${badge('lago-pending')}</td>
            </tr>
          `).join('')}
          ${tenants.length === 0 ? '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);">No tenants</td></tr>' : ''}
        </tbody>
      </table>
      <p style="font-size:12px;color:var(--text-muted);margin-top:8px;">Lago billing adapter will sync subscription + usage data. PG table <code>commercial_entitlement</code> stores the mapping.</p>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Surface: Usage & Metering (control-plane.commercial.usage)
// ---------------------------------------------------------------------------
async function renderUsageMetering() {
  const app = document.getElementById('app');
  app.innerHTML = '<p class="meta-secondary" style="padding:12px;">Loading usage events…</p>';
  let events = [];
  let source = 'unavailable';
  try {
    const r = await apiFetch(`${API_BASE}/operator/usage-events`);
    if (r.ok) {
      const d = await r.json();
      events = d.events || [];
      source = d._source || 'real-backend';
    }
  } catch (_) { /* empty */ }
  app.innerHTML = `
    <div class="surface-header">
      <div>
        <h1>Usage & Metering</h1>
      </div>
      <div class="btn-group">${sourceBadge(source)}</div>
    </div>
    <div class="card">
      <h3>Recent meter events (<code>usage_meter_event</code>)</h3>
      <table>
        <thead><tr><th>Metric</th><th>Qty</th><th>Tenant</th><th>Recorded</th></tr></thead>
        <tbody>
          ${events.length ? events.map(ev => `
            <tr>
              <td>${escHtml(ev.metricName || ev.metric_name || '—')}</td>
              <td>${escHtml(String(ev.quantity ?? '—'))}</td>
              <td><code>${escHtml(String(ev.tenantId || ev.tenant_id || '—'))}</code></td>
              <td>${fmtDate(ev.recordedAt || ev.recorded_at)}</td>
            </tr>`).join('') : '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">No usage rows</td></tr>'}
        </tbody>
      </table>
      <p style="margin-top:12px;">
        <button class="btn" type="button" onclick="cpRecordUsagePrompt()">+ Record demo event</button>
      </p>
    </div>`;
}

window.cpRecordUsagePrompt = async function () {
  const metricName = window.prompt('metric_name');
  if (!metricName) return;
  const quantity = window.prompt('quantity', '1') || '1';
  try {
    const resp = await apiFetch(`${LIFECYCLE_API_BASE}/operator/usage-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metricName, quantity: Number(quantity) || 1 }),
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      window.alert(data.error || 'Record failed');
      return;
    }
    navigate();
  } catch (_) {
    window.alert('Network error');
  }
};

// ---------------------------------------------------------------------------
// Surface: Support Console (control-plane.support.console)
// ---------------------------------------------------------------------------
function renderSupportConsole() {
  renderStaticSurface(
    'Support Console',
    'control-plane.support.console',
    '🎧',
    'Support ticket lifecycle for operator-reported and system-detected issues. Links tickets to tenants, provisioning runs, and incidents.',
    'Support',
    'Support/Incident Service (deferred)',
    [
      { id: 'R31', label: 'List support tickets', status: 'deferred', note: 'Filterable by tenant, severity, status' },
      { id: 'R32', label: 'Get ticket detail', status: 'deferred', note: 'Full timeline with audit events' },
      { id: 'W33', label: 'Create ticket', status: 'deferred', note: 'Review-only when implemented' },
      { id: 'W34', label: 'Update ticket status', status: 'deferred', note: 'Open -> investigating -> resolved -> closed' },
      { id: 'W35', label: 'Escalate ticket', status: 'deferred', note: 'Requires support:manage permission' },
    ]
  );
}

// ---------------------------------------------------------------------------
// Surface: Audit Trail (control-plane.platform.audit)
// ---------------------------------------------------------------------------
async function renderAuditTrail() {
  const app = document.getElementById('app');
  app.innerHTML = '<p class="meta-secondary" style="padding:12px;">Loading audit events…</p>';
  let events = [];
  let source = 'unavailable';
  try {
    const r = await apiFetch(`${API_BASE}/audit/events?limit=75`);
    if (r.ok) {
      const d = await r.json();
      events = d.events || [];
      source = d._source || 'real-backend';
    }
  } catch (_) { /* empty */ }
  app.innerHTML = `
    <div class="surface-header">
      <div>
        <div class="breadcrumb">${navLink('#/home', 'Home')} / Platform</div>
        <h1>Audit Trail</h1>
      </div>
      <div class="btn-group">${sourceBadge(source)}</div>
    </div>
    <p class="meta-secondary">Rows from <code>audit_event</code> (append-only). Hash-chained export is future work.</p>
    <div class="card">
      <table>
        <thead><tr><th>Time</th><th>Type</th><th>Actor</th><th>Entity</th><th>Detail</th></tr></thead>
        <tbody>
          ${events.length ? events.map(ev => `
            <tr>
              <td style="font-size:11px;">${fmtDate(ev.createdAt)}</td>
              <td><code>${escHtml(ev.eventType || '—')}</code></td>
              <td>${escHtml(ev.actor || '—')}</td>
              <td>${escHtml(ev.entityType || '—')} ${ev.entityId ? `<code>${escHtml(String(ev.entityId).slice(0, 8))}</code>` : ''}</td>
              <td style="font-size:11px;max-width:240px;overflow:hidden;text-overflow:ellipsis;">${escHtml(ev.detail ? JSON.stringify(ev.detail) : '—')}</td>
            </tr>`).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">No audit rows</td></tr>'}
        </tbody>
      </table>
    </div>`;
}

// ---------------------------------------------------------------------------
// Surface: Templates & Presets (control-plane.platform.templates)
// ---------------------------------------------------------------------------
function renderTemplatesPresets() {
  renderStaticSurface(
    'Templates & Presets',
    'control-plane.platform.templates',
    '📄',
    'Reusable configuration templates for tenant bootstrap, market profiles, and pack bundles. Operators create templates from known-good configurations.',
    'Platform',
    'Platform PG — config_templates',
    [
      { id: 'R36', label: 'List templates', status: 'deferred', note: 'Grouped by template type' },
      { id: 'W36', label: 'Create template from snapshot', status: 'deferred', note: 'Review-only when implemented' },
      { id: 'W37', label: 'Apply template to tenant', status: 'deferred', note: 'Preview diff before apply' },
    ]
  );
}

// ---------------------------------------------------------------------------
// Surface: Runbooks Hub (control-plane.platform.runbooks)
// ---------------------------------------------------------------------------
function renderRunbooksHub() {
  renderStaticSurface(
    'Runbooks Hub',
    'control-plane.platform.runbooks',
    '📖',
    'Indexed operator runbook catalog. Links operational procedures to surfaces, services, and failure modes. Read-only reference surface.',
    'Platform',
    'docs/runbooks/ (filesystem)',
    [
      { id: 'R19', label: 'List runbooks', status: 'deferred', note: 'Read-only catalog index' },
      { id: 'R20', label: 'Get runbook content', status: 'deferred', note: 'Rendered markdown' },
    ]
  );
}

boot();
window.addEventListener('hashchange', navigate);

