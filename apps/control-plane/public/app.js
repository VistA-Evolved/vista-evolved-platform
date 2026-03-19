/**
 * Control-Plane Local Review Runtime — app.js
 *
 * Hash-based routing over 8 canonical control-plane surfaces.
 * Data fetched from local Fastify API routes (fixture-backed).
 * Write actions open LOCAL REVIEW-ONLY dialogs — no persistence, no real execution.
 *
 * Surface IDs (from screen-contract instances):
 *   control-plane.tenants.list
 *   control-plane.tenants.detail
 *   control-plane.tenants.bootstrap
 *   control-plane.provisioning.runs
 *   control-plane.markets.management
 *   control-plane.markets.detail
 *   control-plane.packs.catalog
 *   control-plane.system.config
 */

'use strict';

// ---------------------------------------------------------------------------
// API loader — fetches from local Fastify routes
// ---------------------------------------------------------------------------
const API_BASE = '/api/control-plane/v1';
const REVIEW_API_BASE = '/api/control-plane-review/v1';
const FIXTURES = {};

async function loadFixtures() {
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
    const resp = await fetch(`${API_BASE}${path}`);
    FIXTURES[key] = await resp.json();
  }
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

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function disabledBtn(label, reason) {
  return `<span class="tooltip-wrap"><button class="btn" disabled>${escHtml(label)}</button><span class="tooltip-text">${escHtml(reason)}</span></span>`;
}

function navLink(href, label) {
  return `<a href="${href}" style="color:var(--primary);text-decoration:none;">${escHtml(label)}</a>`;
}

// ---------------------------------------------------------------------------
// Review Dialog System — LOCAL REVIEW ONLY
// ---------------------------------------------------------------------------
function openReviewDialog(title, operationId, fields, submitFn) {
  const overlay = document.getElementById('review-dialog-overlay');
  const dialog = document.getElementById('review-dialog');

  let fieldsHtml = '';
  for (const f of fields) {
    if (f.type === 'checkbox') {
      fieldsHtml += `<div class="review-checkbox"><input type="checkbox" id="rv-${f.key}"><label for="rv-${f.key}">${escHtml(f.label)}</label></div>`;
    } else if (f.type === 'select') {
      fieldsHtml += `<label>${escHtml(f.label)}</label><select id="rv-${f.key}">${f.options.map(o => `<option value="${escHtml(o.value)}">${escHtml(o.label)}</option>`).join('')}</select>`;
    } else if (f.type === 'textarea') {
      fieldsHtml += `<label>${escHtml(f.label)}${f.required ? ' *' : ''}</label><textarea id="rv-${f.key}" placeholder="${escHtml(f.placeholder || '')}"></textarea>`;
    } else {
      fieldsHtml += `<label>${escHtml(f.label)}${f.required ? ' *' : ''}</label><input type="text" id="rv-${f.key}" placeholder="${escHtml(f.placeholder || '')}" value="${escHtml(f.defaultValue || '')}">`;
    }
  }

  dialog.innerHTML = `
    <h2>${escHtml(title)}</h2>
    <div class="review-subtitle">Canonical operation: <code>${escHtml(operationId)}</code></div>
    <div class="review-warning-banner">
      ⚠ REVIEW-ONLY — This action will NOT be executed. No data will be persisted or changed.
    </div>
    ${fieldsHtml}
    <div class="review-actions">
      <button class="btn btn-primary" id="rv-submit">Submit for Review</button>
      <button class="btn" id="rv-cancel">Cancel</button>
    </div>
    <div id="rv-result"></div>
  `;

  overlay.style.display = 'flex';
  dialog.querySelector('#rv-cancel').onclick = () => { overlay.style.display = 'none'; };
  overlay.onclick = (e) => { if (e.target === overlay) overlay.style.display = 'none'; };
  dialog.querySelector('#rv-submit').onclick = async () => {
    const body = {};
    for (const f of fields) {
      const el = document.getElementById(`rv-${f.key}`);
      if (f.type === 'checkbox') body[f.key] = el.checked;
      else body[f.key] = el.value;
    }
    await submitFn(body);
  };
}

async function submitReview(method, path, body) {
  const resp = await fetch(`${REVIEW_API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  renderReviewResult(data);
}

function renderReviewResult(data) {
  const container = document.getElementById('rv-result');
  const isValid = data.validation && data.validation.valid;

  container.innerHTML = `
    <div class="review-result">
      <div class="result-header ${isValid ? 'valid' : 'invalid'}">
        ${isValid ? '✓ Validation passed' : '✗ Validation failed'} — Review result for <code>${escHtml(data.canonicalOperationId)}</code>
      </div>

      ${!isValid ? `
        <div class="result-section">
          <h4>Validation Errors</h4>
          <ul>${data.validation.errors.map(e => `<li style="font-size:13px;color:var(--danger);">${escHtml(e)}</li>`).join('')}</ul>
        </div>
      ` : ''}

      <div class="result-section">
        <h4>Canonical Operation</h4>
        <pre>${escHtml(data.canonicalHttpMethod)} ${escHtml(data.canonicalPath)}\noperationId: ${escHtml(data.canonicalOperationId)}</pre>
      </div>

      <div class="result-section">
        <h4>Projected Events</h4>
        <pre>${data.projectedEvents.map(e => `${escHtml(e.eventAddress)}\n  → ${escHtml(e.description)}`).join('\n')}</pre>
      </div>

      <div class="result-section">
        <h4>Audit Preview</h4>
        <pre>Action class: ${escHtml(data.auditPreview.actionClass)}
Actor: ${escHtml(data.auditPreview.actorSource)}
Resource: ${escHtml(data.auditPreview.resourceId)}
Summary: ${escHtml(data.auditPreview.summary)}</pre>
      </div>

      <div class="result-section">
        <h4>Guardrails</h4>
        <ul>${data.guardrails.map(g => `<li style="font-size:13px;">${escHtml(g)}</li>`).join('')}</ul>
      </div>

      <div class="no-persist-banner">
        ${data.notes.map(n => escHtml(n)).join(' · ')}
      </div>
    </div>
  `;
}

// Review action openers for each surface
function reviewSuspendTenant(tenantId) {
  openReviewDialog('Suspend Tenant', 'suspendTenant', [
    { key: 'reason', label: 'Reason', type: 'textarea', required: true, placeholder: 'Reason for suspending this tenant…' },
  ], (body) => submitReview('POST', `/tenants/${encodeURIComponent(tenantId)}/suspend`, body));
}
function reviewReactivateTenant(tenantId) {
  openReviewDialog('Reactivate Tenant', 'reactivateTenant', [
    { key: 'reason', label: 'Reason', type: 'textarea', required: true, placeholder: 'Reason for reactivating this tenant…' },
  ], (body) => submitReview('POST', `/tenants/${encodeURIComponent(tenantId)}/reactivate`, body));
}
function reviewArchiveTenant(tenantId) {
  openReviewDialog('Archive Tenant (IRREVERSIBLE)', 'archiveTenant', [
    { key: 'reason', label: 'Reason', type: 'textarea', required: true, placeholder: 'Reason for archiving this tenant…' },
    { key: 'confirmArchive', label: 'I confirm this tenant should be permanently archived', type: 'checkbox' },
  ], (body) => submitReview('POST', `/tenants/${encodeURIComponent(tenantId)}/archive`, body));
}
function reviewResolvePlan() {
  const markets = FIXTURES['legal-market-profiles'].items;
  openReviewDialog('Resolve Effective Configuration Plan', 'resolveEffectiveConfigurationPlan', [
    { key: 'legalMarketId', label: 'Legal Market ID', type: 'select', options: markets.map(m => ({ value: m.legalMarketId, label: `${m.displayName} (${m.legalMarketId})` })) },
    { key: 'tenantDisplayName', label: 'Tenant Display Name (optional)', type: 'text', placeholder: 'e.g., Sunrise Medical Center' },
    { key: 'facilityType', label: 'Facility Type (optional)', type: 'select', options: [{ value: '', label: '(none)' }, { value: 'single-clinic', label: 'Single Clinic' }, { value: 'multi-facility', label: 'Multi-Facility' }, { value: 'hospital', label: 'Hospital' }] },
  ], (body) => {
    const cleaned = { legalMarketId: body.legalMarketId };
    if (body.tenantDisplayName) cleaned.tenantDisplayName = body.tenantDisplayName;
    if (body.facilityType) cleaned.facilityType = body.facilityType;
    submitReview('POST', '/effective-configuration-plans/resolve', cleaned);
  });
}
function reviewCreateBootstrapRequest() {
  openReviewDialog('Create Tenant Bootstrap Request', 'createTenantBootstrapRequest', [
    { key: 'effectivePlanId', label: 'Effective Plan ID (UUID)', type: 'text', required: true, placeholder: 'UUID of a resolved plan' },
    { key: 'tenantDisplayName', label: 'Tenant Display Name', type: 'text', required: true, placeholder: 'e.g., Sunrise Medical Center' },
    { key: 'tenantNotes', label: 'Tenant Notes (optional)', type: 'textarea', placeholder: 'Optional notes…' },
  ], (body) => {
    const cleaned = { effectivePlanId: body.effectivePlanId, tenantDisplayName: body.tenantDisplayName };
    if (body.tenantNotes) cleaned.tenantNotes = body.tenantNotes;
    submitReview('POST', '/tenant-bootstrap-requests', cleaned);
  });
}
function reviewCreateProvisioningRun() {
  openReviewDialog('Create Provisioning Run', 'createProvisioningRun', [
    { key: 'bootstrapRequestId', label: 'Bootstrap Request ID (UUID)', type: 'text', required: true, placeholder: 'UUID of an approved bootstrap request' },
  ], (body) => submitReview('POST', '/provisioning-runs', body));
}
function reviewCancelProvisioningRun(runId) {
  openReviewDialog('Cancel Provisioning Run', 'cancelProvisioningRun', [
    { key: 'reason', label: 'Cancellation Reason', type: 'textarea', required: true, placeholder: 'Reason for cancelling this run…' },
  ], (body) => submitReview('POST', `/provisioning-runs/${encodeURIComponent(runId)}/cancel`, body));
}
function reviewCreateMarketDraft() {
  openReviewDialog('Create Legal-Market Profile Draft', 'createLegalMarketProfileDraft', [
    { key: 'legalMarketId', label: 'Legal Market ID (ISO 3166-1 alpha-2)', type: 'text', required: true, placeholder: 'e.g., JP, DE, IN' },
    { key: 'displayName', label: 'Display Name', type: 'text', required: true, placeholder: 'e.g., Japan' },
    { key: 'launchTier', label: 'Launch Tier', type: 'select', options: [{ value: 'T0', label: 'T0 (draft)' }, { value: 'T1', label: 'T1' }, { value: 'T2', label: 'T2' }, { value: 'T3', label: 'T3' }] },
  ], (body) => {
    const cleaned = { legalMarketId: body.legalMarketId, displayName: body.displayName };
    if (body.launchTier) cleaned.launchTier = body.launchTier;
    submitReview('POST', '/legal-market-profiles', cleaned);
  });
}
function reviewUpdateMarketDraft(legalMarketId) {
  openReviewDialog(`Update Market Draft: ${legalMarketId}`, 'updateLegalMarketProfileDraft', [
    { key: 'displayName', label: 'Display Name (optional)', type: 'text', placeholder: 'New display name' },
    { key: 'launchTier', label: 'Launch Tier (optional)', type: 'select', options: [{ value: '', label: '(unchanged)' }, { value: 'T0', label: 'T0' }, { value: 'T1', label: 'T1' }, { value: 'T2', label: 'T2' }, { value: 'T3', label: 'T3' }] },
  ], (body) => {
    const cleaned = {};
    if (body.displayName) cleaned.displayName = body.displayName;
    if (body.launchTier) cleaned.launchTier = body.launchTier;
    submitReview('PUT', `/legal-market-profiles/${encodeURIComponent(legalMarketId)}`, cleaned);
  });
}
function reviewSubmitMarketForReview(legalMarketId) {
  openReviewDialog(`Submit Market for Review: ${legalMarketId}`, 'submitLegalMarketProfileForReview', [
    { key: 'reason', label: 'Reason (optional)', type: 'textarea', placeholder: 'Optional reason for submission…' },
  ], (body) => {
    const cleaned = {};
    if (body.reason) cleaned.reason = body.reason;
    submitReview('POST', `/legal-market-profiles/${encodeURIComponent(legalMarketId)}/submit-review`, cleaned);
  });
}
function reviewCreatePackDraft() {
  openReviewDialog('Create Pack Manifest Draft', 'createPackManifestDraft', [
    { key: 'packId', label: 'Pack ID', type: 'text', required: true, placeholder: 'e.g., lang-jp, payer-bcbs' },
    { key: 'displayName', label: 'Display Name', type: 'text', required: true, placeholder: 'e.g., Japanese Language Pack' },
    { key: 'packFamily', label: 'Pack Family', type: 'select', required: true, options: [
      { value: 'language', label: 'language' }, { value: 'locale', label: 'locale' },
      { value: 'regulatory', label: 'regulatory' }, { value: 'national-standards', label: 'national-standards' },
      { value: 'payer', label: 'payer' }, { value: 'specialty', label: 'specialty' },
      { value: 'tenant-overlay', label: 'tenant-overlay' },
    ]},
    { key: 'description', label: 'Description (optional)', type: 'textarea', placeholder: 'Pack description…' },
  ], (body) => {
    const cleaned = { packId: body.packId, displayName: body.displayName, packFamily: body.packFamily };
    if (body.description) cleaned.description = body.description;
    submitReview('POST', '/packs', cleaned);
  });
}
function reviewUpdatePackDraft(packId) {
  openReviewDialog(`Update Pack Draft: ${packId}`, 'updatePackManifestDraft', [
    { key: 'displayName', label: 'Display Name (optional)', type: 'text', placeholder: 'New display name' },
    { key: 'description', label: 'Description (optional)', type: 'textarea', placeholder: 'New description' },
  ], (body) => {
    const cleaned = {};
    if (body.displayName) cleaned.displayName = body.displayName;
    if (body.description) cleaned.description = body.description;
    submitReview('PUT', `/packs/${encodeURIComponent(packId)}`, cleaned);
  });
}
function reviewSubmitPackForReview(packId) {
  openReviewDialog(`Submit Pack for Review: ${packId}`, 'submitPackManifestForReview', [
    { key: 'reason', label: 'Reason (optional)', type: 'textarea', placeholder: 'Optional reason for submission…' },
  ], (body) => {
    const cleaned = {};
    if (body.reason) cleaned.reason = body.reason;
    submitReview('POST', `/packs/${encodeURIComponent(packId)}/submit-review`, cleaned);
  });
}
function reviewToggleFeatureFlag(flagKey, currentValue) {
  openReviewDialog(`Toggle Feature Flag: ${flagKey}`, 'updateFeatureFlag', [
    { key: 'value', label: `New Value (current: ${currentValue})`, type: 'select', options: [{ value: 'true', label: 'true (ON)' }, { value: 'false', label: 'false (OFF)' }] },
    { key: 'reason', label: 'Reason (optional)', type: 'textarea', placeholder: 'Reason for change…' },
  ], (body) => {
    const cleaned = { value: body.value === 'true' };
    if (body.reason) cleaned.reason = body.reason;
    submitReview('PUT', `/system-config/feature-flags/${encodeURIComponent(flagKey)}`, cleaned);
  });
}
function reviewUpdateSystemParameter(paramKey, currentValue) {
  openReviewDialog(`Update System Parameter: ${paramKey}`, 'updateSystemParameter', [
    { key: 'value', label: `New Value (current: ${currentValue})`, type: 'text', required: true, defaultValue: String(currentValue) },
    { key: 'reason', label: 'Reason (optional)', type: 'textarea', placeholder: 'Reason for change…' },
  ], (body) => {
    const cleaned = { value: body.value };
    if (body.reason) cleaned.reason = body.reason;
    submitReview('PUT', `/system-config/parameters/${encodeURIComponent(paramKey)}`, cleaned);
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
const ROUTES = {
  'tenants':           renderTenantsList,
  'tenants-detail':    renderTenantsDetail,
  'tenants-bootstrap': renderTenantsBootstrap,
  'provisioning':      renderProvisioningRuns,
  'markets':           renderMarketsManagement,
  'markets-detail':    renderMarketsDetail,
  'packs':             renderPacksCatalog,
  'system-config':     renderSystemConfig,
};

function getRoute() {
  const hash = location.hash.replace('#/', '').replace(/\//g, '-') || 'tenants';
  // normalize hash to route key
  for (const key of Object.keys(ROUTES)) {
    if (hash === key || hash.startsWith(key)) return key;
  }
  return 'tenants';
}

function navigate() {
  const route = getRoute();
  // highlight nav
  document.querySelectorAll('.nav-sidebar a').forEach(a => {
    a.classList.toggle('active', a.dataset.route === route);
  });
  const fn = ROUTES[route];
  if (fn) fn();
}

// ---------------------------------------------------------------------------
// Surface 1: Tenant Registry (control-plane.tenants.list)
// ---------------------------------------------------------------------------
function renderTenantsList() {
  const data = FIXTURES['tenants'];
  const items = data.items;
  const pg = data.pagination;

  document.getElementById('app').innerHTML = `
    <div class="surface-header">
      <h1>Tenant Registry</h1>
      <div class="btn-group">
        <button class="btn btn-primary" onclick="location.hash='#/tenants/bootstrap'">+ New Tenant Bootstrap</button>
        <button class="btn" onclick="reviewResolvePlan()">⊕ Resolve Plan (Review)</button>
        <button class="btn" onclick="navigate()">↻ Refresh</button>
      </div>
    </div>

    <div class="filter-bar">
      <label>Status</label>
      <select disabled><option>All statuses</option></select>
      <label>Market</label>
      <select disabled><option>All markets</option></select>
      <label>Search</label>
      <input type="text" placeholder="Search tenants…" disabled>
    </div>

    <table>
      <thead>
        <tr>
          <th>Tenant ID</th>
          <th>Display Name</th>
          <th>Status</th>
          <th>Legal Market</th>
          <th>Launch Tier</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(t => `
          <tr class="clickable" onclick="location.hash='#/tenants/detail'">
            <td><code>${escHtml(t.tenantId)}</code></td>
            <td>${escHtml(t.displayName)}</td>
            <td>${badge(t.status)}</td>
            <td>${escHtml(t.legalMarketId)}</td>
            <td>${badge(t.launchTier || '—')}</td>
            <td>${fmtDate(t.createdAt)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="pagination">
      <span>Showing ${items.length} of ${pg.totalItems} tenants</span>
      <span>Page ${pg.page} of ${pg.totalPages} · ${pg.pageSize} per page</span>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Surface 2: Tenant Detail (control-plane.tenants.detail)
// ---------------------------------------------------------------------------
function renderTenantsDetail() {
  const tenant = FIXTURES['tenants'].items[0]; // PH demo tenant
  const bootstrapReqs = FIXTURES['bootstrap-requests'].items.filter(b => b.tenantId === tenant.tenantId);
  const latestBootstrap = bootstrapReqs[0];

  document.getElementById('app').innerHTML = `
    <div class="breadcrumb">${navLink('#/tenants', 'Tenant Registry')} › ${escHtml(tenant.displayName)}</div>
    <div class="surface-header">
      <h1>${escHtml(tenant.displayName)}</h1>
      <div>${badge(tenant.status)} ${badge(tenant.launchTier)}</div>
    </div>

    <!-- Identity Section -->
    <div class="card">
      <h3>Identity</h3>
      <dl class="kv-list">
        <dt>Tenant ID</dt><dd><code>${escHtml(tenant.tenantId)}</code></dd>
        <dt>Display Name</dt><dd>${escHtml(tenant.displayName)}</dd>
        <dt>Legal Market</dt><dd>${navLink('#/markets/detail', tenant.legalMarketId)}</dd>
        <dt>Launch Tier</dt><dd>${badge(tenant.launchTier)}</dd>
        <dt>Status</dt><dd>${badge(tenant.status)}</dd>
        <dt>Created</dt><dd>${fmtDate(tenant.createdAt)}</dd>
        <dt>Updated</dt><dd>${fmtDate(tenant.updatedAt)}</dd>
      </dl>
    </div>

    <!-- Bootstrap Section -->
    <div class="card">
      <h3>Bootstrap Request</h3>
      ${latestBootstrap ? `
        <dl class="kv-list">
          <dt>Request ID</dt><dd>${navLink('#/provisioning', latestBootstrap.bootstrapRequestId)}</dd>
          <dt>Status</dt><dd>${badge(latestBootstrap.status)}</dd>
          <dt>Effective Plan</dt><dd><code>${escHtml(latestBootstrap.effectivePlanId)}</code></dd>
          <dt>Provisioning Run</dt><dd>${latestBootstrap.provisioningRunId ? navLink('#/provisioning', latestBootstrap.provisioningRunId) : '—'}</dd>
          <dt>Submitted</dt><dd>${fmtDate(latestBootstrap.createdAt)}</dd>
        </dl>
      ` : '<p class="empty-state">No bootstrap request found.</p>'}
    </div>

    <!-- Provisioning Section -->
    <div class="card">
      <h3>Latest Provisioning</h3>
      ${tenant.latestProvisioningRunId ? `
        <dl class="kv-list">
          <dt>Run ID</dt><dd>${navLink('#/provisioning', tenant.latestProvisioningRunId)}</dd>
        </dl>
      ` : '<p>No provisioning runs.</p>'}
    </div>

    <!-- Active Packs Section -->
    <div class="card">
      <h3>Active Packs</h3>
      ${(tenant.activePacks && tenant.activePacks.length > 0) ? `
        <table>
          <thead><tr><th>Pack ID</th><th>Family</th><th>Display Name</th><th>Lifecycle</th></tr></thead>
          <tbody>
            ${tenant.activePacks.map(p => `
              <tr>
                <td><code>${escHtml(p.packId)}</code></td>
                <td>${badge(p.packFamily)}</td>
                <td>${escHtml(p.displayName)}</td>
                <td>${badge(p.lifecycleState)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p>No active packs.</p>'}
    </div>

    <!-- Actions Bar -->
    <div class="card">
      <h3>Actions</h3>
      <div class="btn-group">
        <button class="btn btn-primary" onclick="location.hash='#/tenants/bootstrap'">Initiate Bootstrap</button>
        <button class="btn" onclick="location.hash='#/provisioning'">View Provisioning</button>
        <button class="btn" onclick="reviewSuspendTenant('${escHtml(tenant.tenantId)}')">Suspend Tenant (Review)</button>
        <button class="btn" onclick="reviewReactivateTenant('${escHtml(tenant.tenantId)}')">Reactivate Tenant (Review)</button>
        <button class="btn btn-danger" onclick="reviewArchiveTenant('${escHtml(tenant.tenantId)}')">Archive Tenant (Review)</button>
        <button class="btn" title="Cross-workspace navigation to tenant admin">Open Tenant Admin ↗</button>
      </div>
      <p style="font-size:12px;color:var(--text-muted);margin-top:8px;">
        Suspend / Reactivate / Archive open review-only dialogs. No real state change occurs.
      </p>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Surface 3: Tenant Bootstrap (control-plane.tenants.bootstrap)
// ---------------------------------------------------------------------------
function renderTenantsBootstrap() {
  const plan = FIXTURES['effective-plans'].plans[0];
  const markets = FIXTURES['legal-market-profiles'].items;

  document.getElementById('app').innerHTML = `
    <div class="breadcrumb">${navLink('#/tenants', 'Tenant Registry')} › ${navLink('#/tenants/detail', 'Tenant Detail')} › Bootstrap</div>
    <div class="surface-header">
      <h1>Tenant Bootstrap</h1>
      <div>${badge('T0')} ${badge('draft')}</div>
    </div>

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

    <!-- Plan Resolution -->
    <div class="card">
      <h3>Plan Resolution Result</h3>
      <p class="section-label">Effective Plan: <code>${escHtml(plan.effectivePlanId)}</code> · Resolved at: ${fmtDate(plan.resolvedAt)}</p>

      <!-- Resolved Packs -->
      <h3 style="margin-top:12px;">Resolved Packs (${plan.resolvedPacks.length})</h3>
      <table>
        <thead><tr><th>Pack ID</th><th>Family</th><th>Source</th><th>Pack State</th><th>Readiness</th><th>Constraints</th></tr></thead>
        <tbody>
          ${plan.resolvedPacks.map(p => `
            <tr>
              <td><code>${escHtml(p.packId)}</code></td>
              <td>${badge(p.packFamily)}</td>
              <td>${badge(p.activationSource)}</td>
              <td>${badge(p.packState)}</td>
              <td>${badge(p.readinessState)}</td>
              <td style="font-size:12px;">${(p.constraints || []).map(c => `<div>• ${escHtml(c)}</div>`).join('')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <!-- Deferred Items -->
      <h3 style="margin-top:12px;">Deferred Items (${plan.deferredItems.length})</h3>
      ${plan.deferredItems.length > 0 ? `
        <table>
          <thead><tr><th>Pack ID</th><th>Reason</th><th>Migration Path</th><th>Target State</th></tr></thead>
          <tbody>
            ${plan.deferredItems.map(d => `
              <tr>
                <td><code>${escHtml(d.packId)}</code></td>
                <td>${badge(d.reason)}</td>
                <td style="font-size:12px;">${escHtml(d.migrationPath)}</td>
                <td>${badge(d.targetState || '—')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p>No deferred items.</p>'}
    </div>

    <!-- Pack Selections (eligible packs) -->
    <div class="card">
      <h3>Pack Selections</h3>
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:8px;">Eligible packs that can be added. Grayed-out packs failed eligibility and cannot be toggled.</p>
      <div>
        <label style="font-size:13px;opacity:0.5;cursor:not-allowed;">
          <input type="checkbox" checked disabled> lang-fil (Filipino Language Pack) — <em>eligibility-failed: cannot toggle</em>
        </label>
      </div>
      <div style="margin-top:8px;">
        <button class="btn" disabled title="Re-resolve plan after selection changes">Re-resolve Plan</button>
      </div>
    </div>

    <!-- Readiness Posture -->
    <div class="card">
      <h3>Readiness Posture</h3>
      <p style="font-size:13px;margin-bottom:8px;">Effective Launch Tier: ${badge(plan.readinessPosture.effectiveLaunchTier)}</p>
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

    <!-- Gating Blockers -->
    <div class="card">
      <h3>Gating Blockers (${plan.readinessPosture.gatingBlockers.length})</h3>
      <ul class="blocker-list">
        ${plan.readinessPosture.gatingBlockers.map(b => `
          <li class="warning">
            <span class="blocker-dim">${escHtml(b.dimension)}</span>: ${escHtml(b.description)}
          </li>
        `).join('')}
      </ul>
    </div>

    <!-- Claim Surface -->
    <div class="claim-surface">
      <h4>Claim Surface — Bootstrap Readiness</h4>
      <p style="font-size:13px;">This tenant operates in market <strong>PH</strong> at launch tier <strong>T0</strong> (draft).
      5 gating blockers prevent advancement beyond T0. All 5 resolved packs are in draft lifecycle state.
      No capability is currently claimable.</p>
    </div>

    <!-- Actions Bar -->
    <div class="card" style="margin-top:16px;">
      <h3>Actions</h3>
      <div class="btn-group">
        <button class="btn btn-primary" onclick="reviewCreateBootstrapRequest()">Submit Bootstrap Request (Review)</button>
        <button class="btn" onclick="reviewResolvePlan()">Resolve Plan (Review)</button>
        <button class="btn" onclick="location.hash='#/tenants'">Cancel</button>
      </div>
      <p style="font-size:12px;color:var(--text-muted);margin-top:8px;">
        ⚠ Review-only: Submit opens a review dialog calling POST /tenant-bootstrap-requests. No actual request is created.
        The plan resolver review calls POST /effective-configuration-plans:resolve. No plan is persisted.
      </p>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Surface 4: Provisioning Runs (control-plane.provisioning.runs)
// ---------------------------------------------------------------------------
function renderProvisioningRuns() {
  const data = FIXTURES['provisioning-runs'];
  const items = data.items;
  const pg = data.pagination;

  document.getElementById('app').innerHTML = `
    <div class="surface-header">
      <h1>Provisioning Runs</h1>
      <div class="btn-group">
        <button class="btn btn-primary" onclick="reviewCreateProvisioningRun()">+ Create Provisioning Run (Review)</button>
        <button class="btn" onclick="navigate()">↻ Refresh</button>
      </div>
    </div>

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
        <div class="btn-group">
          ${run.status === 'failed' ? `<button class="btn btn-primary" onclick="reviewCreateProvisioningRun('${escHtml(run.tenantId)}', '${escHtml(run.legalMarketId)}')">Retry Run (Review)</button>` : ''}
          ${(run.status === 'queued' || run.status === 'in-progress')
            ? `<button class="btn" onclick="reviewCancelProvisioningRun('${escHtml(run.provisioningRunId)}')">Cancel Run (Review)</button>`
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
  const data = FIXTURES['legal-market-profiles'];
  const items = data.items;
  const pg = data.pagination;

  document.getElementById('app').innerHTML = `
    <div class="surface-header">
      <h1>Market Management</h1>
      <div class="btn-group">
        <button class="btn btn-primary" onclick="reviewCreateMarketDraft()">+ Create Market Draft (Review)</button>
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
          <th>Market ID</th>
          <th>Display Name</th>
          <th>Status</th>
          <th>Launch Tier</th>
          <th>Version</th>
          <th>Mandated</th>
          <th>Default-On</th>
          <th>Eligible</th>
          <th>Excluded</th>
          <th>Readiness</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(m => `
          <tr class="clickable" onclick="location.hash='#/markets/detail'">
            <td><code>${escHtml(m.legalMarketId)}</code></td>
            <td>${escHtml(m.displayName)}</td>
            <td>${badge(m.status)}</td>
            <td>${badge(m.launchTier)}</td>
            <td>${escHtml(m.version)}</td>
            <td>${m.mandatedPackCount}</td>
            <td>${m.defaultOnPackCount}</td>
            <td>${m.eligiblePackCount}</td>
            <td>${m.excludedPackCount}</td>
            <td>${(m.readinessDimensions || []).map(d => badge(d.state)).join(' ')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="pagination">
      <span>Showing ${items.length} of ${pg.totalItems} markets</span>
      <span>Page ${pg.page} of ${pg.totalPages}</span>
    </div>

    <!-- Claim Surface Sidebar -->
    <div class="claim-surface">
      <h4>Claim Surface — Market Readiness</h4>
      <p style="font-size:13px;">PH market: 8 readiness dimensions, 6 at <em>declared</em>, 2 at <em>specified</em>.
      No dimension has reached <em>implemented</em> or higher. Launch tier T0.
      Market authoring write operations are contracted (Batch 3) but not yet implemented.</p>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Surface 6: Market Detail (control-plane.markets.detail)
// ---------------------------------------------------------------------------
function renderMarketsDetail() {
  const market = FIXTURES['legal-market-profiles'].items[0]; // PH market

  document.getElementById('app').innerHTML = `
    <div class="breadcrumb">${navLink('#/markets', 'Market Management')} › ${escHtml(market.displayName)}</div>
    <div class="surface-header">
      <h1>${escHtml(market.displayName)} (${escHtml(market.legalMarketId)})</h1>
      <div>${badge(market.status)} ${badge(market.launchTier)}</div>
    </div>

    <!-- Profile Summary -->
    <div class="card">
      <h3>Profile Summary</h3>
      <dl class="kv-list">
        <dt>Legal Market ID</dt><dd><code>${escHtml(market.legalMarketId)}</code></dd>
        <dt>Display Name</dt><dd>${escHtml(market.displayName)}</dd>
        <dt>Version</dt><dd>${escHtml(market.version)}</dd>
        <dt>Status</dt><dd>${badge(market.status)}</dd>
        <dt>Launch Tier</dt><dd>${badge(market.launchTier)}</dd>
        <dt>Mandated Packs</dt><dd>${market.mandatedPackCount}</dd>
        <dt>Default-On Packs</dt><dd>${market.defaultOnPackCount}</dd>
        <dt>Eligible Packs</dt><dd>${market.eligiblePackCount}</dd>
        <dt>Excluded Packs</dt><dd>${market.excludedPackCount}</dd>
      </dl>
    </div>

    <!-- Readiness Dimensions -->
    <div class="card">
      <h3>Readiness Dimensions (${(market.readinessDimensions || []).length})</h3>
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

    <!-- Mandated Packs -->
    <div class="card">
      <div class="pack-group">
        <div class="pack-group-label">Mandated Packs (${(market.mandatedPacks || []).length})</div>
        ${(market.mandatedPacks && market.mandatedPacks.length > 0) ? `
          <table>
            <thead><tr><th>Pack ID</th><th>Family</th><th>Display Name</th><th>Lifecycle</th></tr></thead>
            <tbody>
              ${market.mandatedPacks.map(p => `
                <tr>
                  <td><code>${escHtml(p.packId)}</code></td>
                  <td>${badge(p.packFamily)}</td>
                  <td>${escHtml(p.displayName)}</td>
                  <td>${badge(p.lifecycleState)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p>None.</p>'}
      </div>
    </div>

    <!-- Default-On Packs -->
    <div class="card">
      <div class="pack-group">
        <div class="pack-group-label">Default-On Packs (${(market.defaultOnPacks || []).length})</div>
        ${(market.defaultOnPacks && market.defaultOnPacks.length > 0) ? `
          <table>
            <thead><tr><th>Pack ID</th><th>Family</th><th>Display Name</th><th>Lifecycle</th></tr></thead>
            <tbody>
              ${market.defaultOnPacks.map(p => `
                <tr>
                  <td><code>${escHtml(p.packId)}</code></td>
                  <td>${badge(p.packFamily)}</td>
                  <td>${escHtml(p.displayName)}</td>
                  <td>${badge(p.lifecycleState)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p>None.</p>'}
      </div>
    </div>

    <!-- Eligible Packs -->
    <div class="card">
      <div class="pack-group">
        <div class="pack-group-label">Eligible Packs (${(market.eligiblePacks || []).length})</div>
        ${(market.eligiblePacks && market.eligiblePacks.length > 0) ? `
          <table>
            <thead><tr><th>Pack ID</th><th>Family</th><th>Display Name</th><th>Lifecycle</th></tr></thead>
            <tbody>
              ${market.eligiblePacks.map(p => `
                <tr>
                  <td><code>${escHtml(p.packId)}</code></td>
                  <td>${badge(p.packFamily)}</td>
                  <td>${escHtml(p.displayName || '—')}</td>
                  <td>${badge(p.lifecycleState || 'draft')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p>None.</p>'}
      </div>
    </div>

    <!-- Claim Surface (informational, read-only) -->
    <div class="claim-surface">
      <h4>Claim Surface — Market Readiness (Informational)</h4>
      <p style="font-size:13px;">PH market is at <strong>draft</strong> status, launch tier <strong>T0</strong>.
      6 of 8 readiness dimensions are <em>declared</em> (lowest actionable state).
      2 dimensions (language, locale) are <em>specified</em>.
      No dimension has reached <em>implemented</em> — this market cannot advance beyond T0.</p>
      <p style="font-size:13px;margin-top:4px;"><em>This is an informational claim surface (read-only). No gating decisions are made on this surface.</em></p>
    </div>

    <!-- Actions -->
    <div class="card" style="margin-top:16px;">
      <h3>Actions</h3>
      <div class="btn-group">
        <button class="btn btn-primary" onclick="reviewUpdateMarketDraft('${escHtml(market.legalMarketId)}')">Update Market Draft (Review)</button>
        <button class="btn" onclick="reviewSubmitMarketForReview('${escHtml(market.legalMarketId)}')">Submit for Review (Review)</button>
        <button class="btn" onclick="location.hash='#/tenants/bootstrap'">Bootstrap Tenant for PH</button>
        <button class="btn" onclick="location.hash='#/markets'">← Back to Markets</button>
      </div>
      <p style="font-size:12px;color:var(--text-muted);margin-top:8px;">
        ⚠ Review-only: Update and Submit open review dialogs. No market profile is actually modified or submitted.
      </p>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Surface 7: Pack Catalog (control-plane.packs.catalog)
// ---------------------------------------------------------------------------
function renderPacksCatalog() {
  const data = FIXTURES['packs'];
  const items = data.items;
  const pg = data.pagination;
  const caps = FIXTURES['capabilities'].items;

  document.getElementById('app').innerHTML = `
    <div class="surface-header">
      <h1>Pack Catalog</h1>
      <div class="btn-group">
        <button class="btn btn-primary" onclick="reviewCreatePackDraft()">+ Create Pack Draft (Review)</button>
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
          <th>Pack ID</th>
          <th>Display Name</th>
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
            <td><code>${escHtml(p.packId)}</code></td>
            <td>${escHtml(p.displayName)}</td>
            <td>${badge(p.packFamily)}</td>
            <td>${escHtml(p.version)}</td>
            <td>${badge(p.lifecycleState)}</td>
            <td>${(p.eligibleMarkets && p.eligibleMarkets.length > 0) ? p.eligibleMarkets.join(', ') : 'All'}</td>
            <td>${(p.capabilityContributions || []).map(c => `<code style="font-size:11px;">${escHtml(c.capabilityId)}</code>`).join(', ') || '—'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="pagination">
      <span>Showing ${items.length} of ${pg.totalItems} packs</span>
      <span>Page ${pg.page} of ${pg.totalPages}</span>
    </div>

    <!-- Pack Detail Panel (show first pack) -->
    <div class="card" style="margin-top:16px;">
      <h3>Pack Detail: ${escHtml(items[0].displayName)}</h3>
      <dl class="kv-list">
        <dt>Pack ID</dt><dd><code>${escHtml(items[0].packId)}</code></dd>
        <dt>Family</dt><dd>${badge(items[0].packFamily)}</dd>
        <dt>Version</dt><dd>${escHtml(items[0].version)}</dd>
        <dt>Lifecycle</dt><dd>${badge(items[0].lifecycleState)}</dd>
        <dt>Owner</dt><dd>${escHtml(items[0].lifecycle.owner)}</dd>
        <dt>Implementation Locus</dt><dd>${escHtml(items[0].lifecycle.implementationLocus)}</dd>
        <dt>Description</dt><dd style="font-size:12px;">${escHtml(items[0].description)}</dd>
      </dl>

      ${(items[0].dependencies && items[0].dependencies.length > 0) ? `
        <h3 style="margin-top:12px;">Dependencies</h3>
        <table>
          <thead><tr><th>Pack ID</th><th>Type</th><th>Rationale</th></tr></thead>
          <tbody>
            ${items[0].dependencies.map(d => `
              <tr><td><code>${escHtml(d.packId)}</code></td><td>${badge(d.type)}</td><td style="font-size:12px;">${escHtml(d.rationale || '')}</td></tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}

      ${(items[0].adapterRequirements && items[0].adapterRequirements.length > 0) ? `
        <h3 style="margin-top:12px;">Adapter Requirements</h3>
        <table>
          <thead><tr><th>Adapter ID</th><th>Type</th><th>Required</th><th>Fallback</th></tr></thead>
          <tbody>
            ${items[0].adapterRequirements.map(a => `
              <tr><td><code>${escHtml(a.adapterId)}</code></td><td>${escHtml(a.adapterType)}</td><td>${a.required ? 'Yes' : 'No'}</td><td>${escHtml(a.fallbackBehavior || '—')}</td></tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}

      <div style="margin-top:12px;">
        <div class="btn-group">
          <button class="btn" onclick="reviewUpdatePackDraft('${escHtml(items[0].packId)}')">Update Pack Draft (Review)</button>
          <button class="btn" onclick="reviewSubmitPackForReview('${escHtml(items[0].packId)}')">Submit for Review (Review)</button>
        </div>
      </div>
    </div>

    <!-- Claim Surface -->
    <div class="claim-surface">
      <h4>Claim Surface — Pack Eligibility &amp; Capability</h4>
      <p style="font-size:13px;">All ${items.length} packs are in <em>draft</em> lifecycle. No pack has reached <em>published</em> state.
      ${caps.length} capabilities are tracked, all at <em>declared</em> or <em>specified</em> readiness. No capability is currently claimable.</p>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Surface 8: System Configuration (control-plane.system.config)
// ---------------------------------------------------------------------------
function renderSystemConfig() {
  const config = FIXTURES['system-config'];
  const dp = config.deploymentProfile;
  const flags = config.featureFlags;
  const params = config.systemParameters;

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
        <button class="btn" onclick="navigate()">↻ Refresh</button>
      </div>
    </div>

    <!-- Deployment Profile -->
    <div class="card">
      <h3>Deployment Profile</h3>
      <dl class="kv-list">
        <dt>Profile Name</dt><dd>${escHtml(dp.profileName)}</dd>
        <dt>Runtime Mode</dt><dd>${badge(dp.runtimeMode)}</dd>
        <dt>API Version</dt><dd>${escHtml(dp.apiVersion)}</dd>
        <dt>Platform Version</dt><dd>${escHtml(dp.platformVersion)}</dd>
      </dl>
    </div>

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
              <td>${escHtml(f.scope)}</td>
              <td>${fmtDate(f.updatedAt)}</td>
              <td><button class="btn" onclick="reviewToggleFeatureFlag('${escHtml(f.flagKey)}', ${f.enabled})">Toggle (Review)</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

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
                  <td><button class="btn" onclick="reviewUpdateSystemParameter('${escHtml(p.paramKey)}', '${escHtml(p.value)}')">Edit (Review)</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `).join('')}
    </div>

    <p style="font-size:12px;color:var(--text-muted);margin-top:8px;">
      Last updated: ${fmtDate(config.lastUpdatedAt)}
    </p>
  `;
}

// ---------------------------------------------------------------------------
// Empty State Demo Surface (appended to tenants list when triggered)
// ---------------------------------------------------------------------------
function renderEmptyState() {
  return `
    <div class="empty-state">
      <div class="empty-icon">📭</div>
      <p>No tenants found matching the current filters.</p>
      <p style="margin-top:8px;"><button class="btn btn-primary" onclick="location.hash='#/tenants/bootstrap'">Bootstrap First Tenant</button></p>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Error State Demo (appended to provisioning runs detail)
// ---------------------------------------------------------------------------
function renderErrorState() {
  return `
    <div class="error-state">
      <div class="error-icon">⚠️</div>
      <p>Failed to load provisioning run data. The control-plane API returned an error.</p>
      <p style="margin-top:8px;font-size:12px;color:var(--text-muted);">Error code: INTERNAL_ERROR · Correlation ID: err-0000-0000-0000</p>
      <p style="margin-top:8px;"><button class="btn" onclick="navigate()">↻ Retry</button></p>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
(async function boot() {
  await loadFixtures();
  navigate();
  window.addEventListener('hashchange', navigate);
})();
