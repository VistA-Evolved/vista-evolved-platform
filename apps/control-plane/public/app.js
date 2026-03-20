/**
 * Operator Console — Local Review Runtime — app.js
 *
 * Hash-based routing over 22 operator-console surfaces across 8 domains.
 * Data fetched from local Fastify API routes (real-backend → fixture fallback).
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
const REVIEW_API_BASE = '/api/control-plane-review/v1';
const LIFECYCLE_API_BASE = '/api/control-plane-lifecycle/v1';
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
    const resp = await apiFetch(`${API_BASE}${path}`);
    if (resp.status === 403 || resp.status === 400) {
      const err = await resp.json();
      renderAccessDenied(err);
      return false;
    }
    FIXTURES[key] = await resp.json();
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
// Source posture label — honest data-source indicator for graduated P0 surfaces
// ---------------------------------------------------------------------------
function sourceBadge(source) {
  if (source === 'real-backend') {
    return '<span class="source-badge source-real">real backend</span>';
  }
  if (source === 'fixture-fallback') {
    return '<span class="source-badge source-fixture">fixture fallback</span>';
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
      ${sourceBadge('fixture-fallback')} Real backend unreachable.
      <span style="font-size:12px;display:block;margin-top:4px;">${escHtml(result.message || '')}</span>
    </div>`;
  } else {
    el.innerHTML = `<div class="lifecycle-result lifecycle-error">
      ${sourceBadge(result._source || 'real-backend')} Action failed: ${escHtml(result.reason || result.message || 'unknown error')}
    </div>`;
  }
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
  const resp = await apiFetch(`${REVIEW_API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (resp.status === 403 || resp.status === 400) {
    const err = await resp.json();
    const container = document.getElementById('rv-result');
    if (container) {
      container.innerHTML = `<div class="review-result"><div class="result-header invalid">Access Denied &mdash; ${escHtml(err.message || 'Insufficient permissions')}</div></div>`;
    }
    return;
  }
  const data = await resp.json();
  renderReviewResult(data);
}

function renderReviewResult(data) {
  const container = document.getElementById('rv-result');
  const isValid = data.validation && data.validation.valid;

  let resolutionHtml = '';
  if (data.resolutionPreview) {
    const rp = data.resolutionPreview;
    resolutionHtml = `
      <div class="result-section">
        <h4>Resolution Preview (Resolver v${escHtml(data.resolverVersion || rp.resolverVersion)})</h4>
        <dl class="kv-list" style="font-size:13px;">
          <dt>Legal Market</dt><dd>${escHtml(rp.legalMarketId)}</dd>
          <dt>Profile Version</dt><dd>${escHtml(rp.profileVersion)}</dd>
          <dt>Resolver Version</dt><dd>${escHtml(rp.resolverVersion)}</dd>
          <dt>Facility Type</dt><dd>${escHtml(rp.facilityType || 'unspecified')}</dd>
          <dt>Resolved Packs</dt><dd>${rp.resolvedPacks.length}</dd>
          <dt>Deferred Items</dt><dd>${rp.deferredItems.length}</dd>
          <dt>Dependency Issues</dt><dd>${(rp.dependencyIssues || []).length}</dd>
          <dt>Gating Blockers</dt><dd>${rp.readinessPosture.gatingBlockers.length}</dd>
          <dt>Effective Launch Tier</dt><dd>${badge(rp.readinessPosture.effectiveLaunchTier)}</dd>
          <dt>Resolved At</dt><dd>${fmtDate(rp.resolvedAt)}</dd>
        </dl>
      </div>

      <div class="result-section">
        <h4>Resolved Packs (${rp.resolvedPacks.length})</h4>
        <table style="font-size:13px;">
          <thead><tr><th>Pack ID</th><th>Family</th><th>Source</th><th>State</th><th>Readiness</th><th>Constraints</th></tr></thead>
          <tbody>
            ${rp.resolvedPacks.map(p => `<tr>
              <td><code>${escHtml(p.packId)}</code></td>
              <td>${badge(p.packFamily)}</td>
              <td>${badge(p.activationSource)}</td>
              <td>${badge(p.packState)}</td>
              <td>${badge(p.readinessState)}</td>
              <td style="font-size:11px;">${(p.constraints || []).map(c => '• ' + escHtml(c)).join('<br>')}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>

      ${rp.deferredItems.length > 0 ? `
        <div class="result-section">
          <h4>Deferred Items (${rp.deferredItems.length})</h4>
          <table style="font-size:13px;">
            <thead><tr><th>Pack ID</th><th>Reason</th><th>Migration Path</th></tr></thead>
            <tbody>
              ${rp.deferredItems.map(d => `<tr>
                <td><code>${escHtml(d.packId)}</code></td>
                <td>${badge(d.reason)}</td>
                <td style="font-size:11px;">${escHtml(d.migrationPath)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      ${(rp.dependencyIssues || []).length > 0 ? `
        <div class="result-section">
          <h4>Dependency Issues (${rp.dependencyIssues.length})</h4>
          <ul>${rp.dependencyIssues.map(i => `<li style="font-size:13px;">${escHtml(i.detail)}</li>`).join('')}</ul>
        </div>
      ` : ''}

      <div class="result-section">
        <h4>Gating Blockers (${rp.readinessPosture.gatingBlockers.length})</h4>
        ${rp.readinessPosture.gatingBlockers.length > 0 ? `
          <ul class="blocker-list">
            ${rp.readinessPosture.gatingBlockers.map(b => `
              <li class="warning" style="font-size:13px;">
                <span class="blocker-dim">${escHtml(b.dimension)}</span>: ${escHtml(b.blocker)}
              </li>
            `).join('')}
          </ul>
        ` : '<p style="font-size:13px;color:var(--success);">No gating blockers.</p>'}
      </div>
    `;
  } else if (data.resolutionError) {
    resolutionHtml = `
      <div class="result-section">
        <h4>Resolution Error</h4>
        <p style="color:var(--danger);">${escHtml(data.resolutionError)}</p>
      </div>
    `;
  }

  let preflightHtml = '';
  if (data.resolverPreflight) {
    const pf = data.resolverPreflight;
    preflightHtml = `
      <div class="result-section">
        <h4>Resolver Preflight (v${escHtml(pf.resolverVersion || '?')})</h4>
        <dl class="kv-list" style="font-size:13px;">
          ${pf.marketFound !== undefined ? `<dt>Market Found</dt><dd>${pf.marketFound ? 'Yes' : 'No'}</dd>` : ''}
          ${pf.resolvedPackCount !== undefined ? `<dt>Resolved Packs</dt><dd>${pf.resolvedPackCount}</dd>` : ''}
          ${pf.deferredItemCount !== undefined ? `<dt>Deferred Items</dt><dd>${pf.deferredItemCount}</dd>` : ''}
          ${pf.gatingBlockerCount !== undefined ? `<dt>Gating Blockers</dt><dd>${pf.gatingBlockerCount}</dd>` : ''}
          ${pf.effectiveLaunchTier ? `<dt>Effective Launch Tier</dt><dd>${badge(pf.effectiveLaunchTier)}</dd>` : ''}
          ${pf.note ? `<dt>Note</dt><dd>${escHtml(pf.note)}</dd>` : ''}
        </dl>
      </div>
    `;
  }

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

      ${resolutionHtml}
      ${preflightHtml}

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

// ---------------------------------------------------------------------------
// Real lifecycle action handlers (P0 graduated — proxy to real backend)
// ---------------------------------------------------------------------------
async function doLifecycleAction(path, body, resultContainerId) {
  const result = await lifecycleFetch(path, body);
  renderLifecycleResult(resultContainerId, result);
  // Refresh data after a short delay so counts update
  if (result.ok) {
    setTimeout(() => { loadFixtures().then(() => navigate()); }, 600);
  }
}

async function doBootstrapDraftCreate(resultContainerId) {
  const tenants = FIXTURES['tenants']?.items || [];
  if (tenants.length === 0) {
    renderLifecycleResult(resultContainerId, { ok: false, error: 'No tenants available to create a bootstrap draft for.' });
    return;
  }
  // Use the first tenant as default — operator can pick from the registry
  const tenantId = tenants[0].tenantId;
  const result = await lifecycleFetch('/bootstrap/drafts', { tenantId, displayName: tenants[0].displayName || 'New Bootstrap' });
  renderLifecycleResult(resultContainerId, result);
  if (result.ok) {
    setTimeout(() => { loadFixtures().then(() => navigate()); }, 600);
  }
}

async function doCreateProvisioningRun(resultContainerId) {
  const bootstrapData = FIXTURES['bootstrap-requests'] || { items: [] };
  const approved = (bootstrapData.items || []).filter(r => r.status === 'approved');
  if (approved.length === 0) {
    renderLifecycleResult(resultContainerId, { ok: false, error: 'No approved bootstrap requests available. Approve a bootstrap request first.' });
    return;
  }
  const req = approved[0];
  const result = await lifecycleFetch('/provisioning/runs', { bootstrapRequestId: req.bootstrapRequestId, tenantId: req.tenantId });
  renderLifecycleResult(resultContainerId, result);
  if (result.ok) {
    setTimeout(() => { loadFixtures().then(() => navigate()); }, 600);
  }
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
  const packItems = FIXTURES['packs'].items;

  // Build eligible pack checkboxes per market
  function eligiblePacksFor(marketId) {
    const market = markets.find(m => m.legalMarketId === marketId);
    if (!market || !market.eligiblePacks) return [];
    return market.eligiblePacks.map(p => ({
      packId: typeof p === 'string' ? p : p.packId,
      displayName: (typeof p === 'object' && p.displayName) ? p.displayName : (typeof p === 'string' ? p : p.packId),
      hasManifest: packItems.some(pi => pi.packId === (typeof p === 'string' ? p : p.packId)),
    }));
  }

  openReviewDialog('Resolve Effective Configuration Plan', 'resolveEffectiveConfigurationPlan', [
    { key: 'legalMarketId', label: 'Legal Market ID', type: 'select', options: markets.map(m => ({ value: m.legalMarketId, label: `${m.displayName} (${m.legalMarketId})` })) },
    { key: 'tenantDisplayName', label: 'Tenant Display Name (optional)', type: 'text', placeholder: 'e.g., Sunrise Medical Center' },
    { key: 'facilityType', label: 'Facility Type (optional)', type: 'select', options: [{ value: '', label: '(none)' }, { value: 'single-clinic', label: 'Single Clinic' }, { value: 'multi-facility', label: 'Multi-Facility' }, { value: 'hospital', label: 'Hospital' }] },
  ], async (body) => {
    const cleaned = { legalMarketId: body.legalMarketId };
    if (body.tenantDisplayName) cleaned.tenantDisplayName = body.tenantDisplayName;
    if (body.facilityType) cleaned.facilityType = body.facilityType;

    // Collect eligible pack selections
    const eligible = eligiblePacksFor(body.legalMarketId);
    const selectedPacks = eligible
      .filter(ep => { const el = document.getElementById(`rv-ep-${ep.packId}`); return el && el.checked; })
      .map(ep => ep.packId);
    if (selectedPacks.length > 0) cleaned.selectedPacks = selectedPacks;

    await submitReview('POST', '/effective-configuration-plans/resolve', cleaned);
  });

  // After dialog opens, inject eligible pack checkboxes
  setTimeout(() => {
    const marketSel = document.getElementById('rv-legalMarketId');
    const submitBtn = document.getElementById('rv-submit');
    if (!marketSel || !submitBtn) return;

    function renderEligibleSection() {
      let existing = document.getElementById('rv-eligible-section');
      if (existing) existing.remove();

      const eligible = eligiblePacksFor(marketSel.value);
      if (eligible.length === 0) return;

      const section = document.createElement('div');
      section.id = 'rv-eligible-section';
      section.style.cssText = 'margin-top:12px;padding:8px;border:1px solid var(--border);border-radius:4px;';
      section.innerHTML = `
        <label style="font-size:13px;font-weight:600;">Eligible Packs (optional selections)</label>
        ${eligible.map(ep => `
          <div class="review-checkbox" style="margin-top:4px;">
            <input type="checkbox" id="rv-ep-${escHtml(ep.packId)}" ${!ep.hasManifest ? 'disabled' : ''}>
            <label for="rv-ep-${escHtml(ep.packId)}" style="${!ep.hasManifest ? 'opacity:0.5;' : ''}">
              ${escHtml(ep.packId)} ${!ep.hasManifest ? '(no manifest — will be deferred)' : ''}
            </label>
          </div>
        `).join('')}
      `;
      submitBtn.parentElement.insertBefore(section, submitBtn.parentElement.firstChild);
    }

    renderEligibleSection();
    marketSel.addEventListener('change', renderEligibleSection);
  }, 50);
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
  // Operations
  'operations':          renderOperationsCenter,
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
  if (fn) fn();
}

// ---------------------------------------------------------------------------
// Surface 1: Tenant Registry (control-plane.tenants.list) — P0 GRADUATED
// ---------------------------------------------------------------------------
function renderTenantsList() {
  const data = FIXTURES['tenants'];
  const items = data.items;
  const pg = data.pagination;
  const source = data._source || 'fixture-fallback';

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
          <tr class="clickable" onclick="location.hash='#/tenants/detail?id=${encodeURIComponent(t.tenantId)}'">
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
// Surface 2: Tenant Detail (control-plane.tenants.detail) — P0 GRADUATED
// ---------------------------------------------------------------------------
async function renderTenantsDetail() {
  // Extract tenant ID from URL hash query param or fall back to first fixture tenant
  const hashParts = location.hash.split('?');
  const params = new URLSearchParams(hashParts[1] || '');
  const tenantId = params.get('id') || (FIXTURES['tenants'].items[0] || {}).tenantId;
  const source = FIXTURES['tenants']._source || 'fixture-fallback';

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

  // Fallback to fixture
  if (!tenant) {
    tenant = FIXTURES['tenants'].items.find(t => t.tenantId === tenantId) || FIXTURES['tenants'].items[0];
    detailSource = 'fixture-fallback';
  }

  if (!tenant) {
    document.getElementById('app').innerHTML = `<div class="empty-state"><p>Tenant not found.</p></div>`;
    return;
  }

  const bootstrapReqs = FIXTURES['bootstrap-requests'].items.filter(b => b.tenantId === tenant.tenantId);
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

    <!-- Tenant Admin Handoff -->
    <div class="card handoff-card">
      <h3>Tenant Operational Admin</h3>
      <p>
        Day-to-day tenant configuration (users, roles, facilities, VistA connections)
        happens in the <strong>Tenant Admin</strong> workspace &mdash; a separate app
        scoped to one tenant at a time.
      </p>
      <ul class="handoff-items">
        <li>&#x2022; User &amp; role management</li>
        <li>&#x2022; Facility topology &amp; location hierarchy</li>
        <li>&#x2022; VistA instance connections</li>
        <li>&#x2022; Module entitlements &amp; feature flags</li>
      </ul>
      <button class="btn-handoff" title="Tenant Admin workspace — not yet available">Open Tenant Admin</button>
      <p style="font-size:11px;color:var(--text-muted);margin-top:10px;">Workspace: <code>vista-evolved-platform/apps/tenant-admin</code> &middot; Status: planned</p>
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
  const plan = FIXTURES['effective-plans'].plans[0];
  const markets = FIXTURES['legal-market-profiles'].items;
  const bootstrapSource = FIXTURES['bootstrap-requests']._source || 'fixture-fallback';

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
      <p>Once this tenant is provisioned, operational setup (users, roles, facilities, VistA connections) continues in the <strong>Tenant Admin</strong> workspace.</p>
      <button class="btn-handoff" title="Tenant Admin workspace — not yet available">Open Tenant Admin</button>
      <p style="font-size:11px;color:var(--text-muted);margin-top:8px;">Planned &middot; <code>apps/tenant-admin</code></p>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Surface 4: Provisioning Runs (control-plane.provisioning.runs) — P0 GRADUATED
// ---------------------------------------------------------------------------
function renderProvisioningRuns() {
  const data = FIXTURES['provisioning-runs'];
  const items = data.items;
  const pg = data.pagination;
  const source = data._source || 'fixture-fallback';

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
  const data = FIXTURES['legal-market-profiles'];
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
  const market = FIXTURES['legal-market-profiles'].items[0]; // PH market

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
  const data = FIXTURES['packs'];
  const items = data.items;
  const pg = data.pagination;
  const caps = FIXTURES['capabilities'].items;

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
      <h3>${escHtml(items[0].displayName)}</h3>
      <dl class="kv-list">
        <dt>Family</dt><dd>${badge(items[0].packFamily)}</dd>
        <dt>Version</dt><dd>${escHtml(items[0].version)}</dd>
        <dt>Lifecycle</dt><dd>${badge(items[0].lifecycleState)}</dd>
        <dt>Owner</dt><dd>${escHtml(items[0].lifecycle.owner)}</dd>
        <dt>Implementation</dt><dd>${escHtml(items[0].lifecycle.implementationLocus)}</dd>
        <dt>Description</dt><dd style="font-size:12px;">${escHtml(items[0].description)}</dd>
      </dl>
      <p class="meta-secondary" style="margin-top:4px;">Pack ID: ${escHtml(items[0].packId)}</p>

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
          <button class="btn" onclick="reviewUpdatePackDraft('${escHtml(items[0].packId)}')">Update Draft</button>
          <button class="btn" onclick="reviewSubmitPackForReview('${escHtml(items[0].packId)}')">Submit for Review</button>
        </div>
      </div>
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
              <td><button class="btn" onclick="reviewToggleFeatureFlag('${escHtml(f.flagKey)}', ${f.enabled})">Toggle</button></td>
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
                  <td><button class="btn" onclick="reviewUpdateSystemParameter('${escHtml(p.paramKey)}', '${escHtml(p.value)}')">Edit</button></td>
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
      <p style="margin-top:8px;"><button class="btn btn-primary" onclick="location.hash='#/bootstrap'">Bootstrap First Tenant</button></p>
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
async function boot() {
  const sel = document.getElementById('role-selector');
  if (sel) sel.value = getActiveRole();
  const ok = await loadFixtures();
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
  const tenantData = FIXTURES['tenants'] || { items: [] };
  const runData = FIXTURES['provisioning-runs'] || { items: [] };
  const bootstrapData = FIXTURES['bootstrap-requests'] || { items: [] };
  const tenants = tenantData.items || [];
  const runs = runData.items || [];
  const bootstrapReqs = bootstrapData.items || [];

  const tenantSource = tenantData._source || 'fixture-fallback';

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
        <h1>Home</h1>
        <p style="font-size:13px;color:var(--text-muted);">What needs my attention right now?</p>
      </div>
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
        moves to the <strong>Tenant Admin</strong> workspace (users, roles, facilities, VistA connections).</p>
        <button class="btn-handoff" title="Tenant Admin workspace — not yet available">Open Tenant Admin</button>
        <p style="font-size:11px;color:var(--text-muted);margin-top:8px;">Planned &middot; <code>apps/tenant-admin</code></p>
      </div>
    </div>

    <div style="margin-top:20px; text-align:center;">
      <span class="meta-secondary">22 surfaces · 8 domains · 11 real + 11 planned · ${sourceBadge(tenantSource)} real-backend + fixture fallback</span>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Surface: Identity & Invitations (control-plane.identity.invitations)
// ---------------------------------------------------------------------------
function renderIdentityInvitations() {
  renderStaticSurface(
    'Identity & Invitations',
    'control-plane.identity.invitations',
    '🔑',
    'Operator identity directory, invitation lifecycle, and OIDC subject mappings for all tenants.',
    'Requests & Onboarding',
    'Platform PG — identity tables',
    [
      { id: 'R11', label: 'List operator identities', status: 'deferred', note: 'Requires identity:manage permission' },
      { id: 'R12', label: 'List pending invitations', status: 'deferred', note: 'Invitation lifecycle tracking' },
      { id: 'W17', label: 'Create invitation', status: 'deferred', note: 'Review-only when implemented' },
      { id: 'W18', label: 'Revoke invitation', status: 'deferred', note: 'Review-only when implemented' },
      { id: 'W19', label: 'Suspend operator identity', status: 'deferred', note: 'Review-only when implemented' },
    ]
  );
}

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
// Surface: Operations Center (control-plane.operations.center)
// ---------------------------------------------------------------------------
// Surface: Operations Center (control-plane.operations.center) — P0 GRADUATED
// ---------------------------------------------------------------------------
function renderOperationsCenter() {
  const app = document.getElementById('app');
  const tenantData = FIXTURES['tenants'] || { items: [] };
  const runData = FIXTURES['provisioning-runs'] || { items: [] };
  const tenants = tenantData.items || [];
  const runs = runData.items || [];
  const config = FIXTURES['system-config'] || {};

  const tenantSource = tenantData._source || 'fixture-fallback';
  const runSource = runData._source || 'fixture-fallback';

  const activeRuns = runs.filter(r => r.status === 'in-progress');
  const failedRuns = runs.filter(r => r.status === 'failed');
  const blockedRuns = runs.filter(r => (r.blockers || []).length > 0);

  app.innerHTML = `
    <div class="surface-header">
      <div>
        <div class="breadcrumb">${navLink('#/home', 'Home')} / Operations</div>
        <h1>Operations Center</h1>
      </div>
      <div class="btn-group">
        ${sourceBadge(tenantSource)}
      </div>
    </div>

    <p class="meta-secondary" style="margin:8px 0;">${sourceBadge(tenantSource)} Tenants · ${sourceBadge(runSource)} Provisioning</p>

    <div class="stat-row">
      <div class="stat-box">
        <div class="stat-value">${tenants.length}</div>
        <div class="stat-label">Total Tenants</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${activeRuns.length}</div>
        <div class="stat-label">Active Runs</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${failedRuns.length}</div>
        <div class="stat-label">Failed Runs</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${blockedRuns.length}</div>
        <div class="stat-label">Blocked Runs</div>
      </div>
    </div>

    <div class="card">
      <h3>Provisioning Activity</h3>
      <table>
        <thead><tr><th>Run ID</th><th>Tenant</th><th>Status</th><th>Blockers</th><th>Started</th></tr></thead>
        <tbody>
          ${runs.map(r => `
            <tr class="clickable" onclick="location.hash='#/provisioning'">
              <td><code style="font-size:11px;">${escHtml(r.provisioningRunId?.substring(0, 8) || '—')}...</code></td>
              <td>${escHtml(r.tenantId?.substring(0, 8) || '—')}...</td>
              <td>${badge(r.status)}</td>
              <td>${(r.blockers || []).length > 0 ? `<span style="color:var(--warning);font-weight:600;">${r.blockers.length} blocker(s)</span>` : '—'}</td>
              <td>${fmtDate(r.startedAt)}</td>
            </tr>
          `).join('')}
          ${runs.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">No provisioning runs</td></tr>' : ''}
        </tbody>
      </table>
    </div>

    <div class="card">
      <h3>System Posture</h3>
      <dl class="kv-list">
        <dt>Auth Mode</dt><dd>${escHtml(config.systemParameters?.find(p => p.paramKey === 'auth-mode')?.value || '—')}</dd>
        <dt>OTel Enabled</dt><dd>${escHtml(config.systemParameters?.find(p => p.paramKey === 'otel-enabled')?.value || '—')}</dd>
        <dt>VistA Instance</dt><dd>${escHtml(config.systemParameters?.find(p => p.paramKey === 'vista-instance-id')?.value || '—')}</dd>
        <dt>Platform Version</dt><dd>${escHtml(config.deploymentProfile?.platformVersion || '—')}</dd>
      </dl>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Surface: Alert Center (control-plane.ops.alerts)
// ---------------------------------------------------------------------------
function renderAlertCenter() {
  renderStaticSurface(
    'Alert Center',
    'control-plane.ops.alerts',
    '🔔',
    'Platform-wide alert rules, active alerts, and notification channels. Configurable thresholds for provisioning failures, adapter health, and capacity.',
    'Operations',
    'Platform PG — alert_rules, alert_events',
    [
      { id: 'R25', label: 'List active alerts', status: 'deferred', note: 'Requires alerts:manage permission' },
      { id: 'R26', label: 'List alert rules', status: 'deferred', note: 'Rule definitions + thresholds' },
      { id: 'W30', label: 'Create alert rule', status: 'deferred', note: 'Review-only when implemented' },
      { id: 'W31', label: 'Acknowledge alert', status: 'deferred', note: 'Review-only when implemented' },
      { id: 'W32', label: 'Silence alert', status: 'deferred', note: 'Time-bounded silence with reason' },
    ]
  );
}

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
function renderEnvironmentsFlags() {
  renderStaticSurface(
    'Environments & Feature Flags',
    'control-plane.ops.environments',
    '🏗️',
    'Fleet environment inventory (dev, staging, production), feature flag management with per-environment and per-tenant overrides.',
    'Operations',
    'Platform PG — environments, feature_flags',
    [
      { id: 'R21', label: 'List environments', status: 'deferred', note: 'Fleet topology view' },
      { id: 'R22', label: 'List feature flags', status: 'deferred', note: 'Flag definitions + override tree' },
      { id: 'W27', label: 'Toggle flag for environment', status: 'deferred', note: 'Review-only when implemented' },
      { id: 'W28', label: 'Create environment', status: 'deferred', note: 'Review-only when implemented' },
    ]
  );
}

// ---------------------------------------------------------------------------
// Surface: Billing & Entitlements (control-plane.commercial.billing)
// ---------------------------------------------------------------------------
function renderBillingEntitlements() {
  const app = document.getElementById('app');
  const tenants = FIXTURES['tenants']?.items || [];

  app.innerHTML = `
    <div class="surface-header">
      <div>
        <h1>Billing & Entitlements</h1>
      </div>
    </div>

    <div class="card">
      <h3>Tenant Entitlement Summary</h3>
      <table>
        <thead><tr><th>Tenant</th><th>Status</th><th>Market</th><th>Launch Tier</th><th>Active Packs</th><th>Billing Status</th></tr></thead>
        <tbody>
          ${tenants.map(t => `
            <tr>
              <td>${navLink(`#/tenants/detail?id=${t.tenantId}`, t.displayName || t.tenantId)}</td>
              <td>${badge(t.status)}</td>
              <td>${escHtml(t.legalMarketId || '—')}</td>
              <td>${badge(t.effectiveLaunchTier || 'T0')}</td>
              <td>${(t.activePacks || []).length}</td>
              <td>${badge('not-connected')}</td>
            </tr>
          `).join('')}
          ${tenants.length === 0 ? '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);">No tenants</td></tr>' : ''}
        </tbody>
      </table>
      <p style="font-size:12px;color:var(--text-muted);margin-top:8px;">Entitlement data derived from tenant status. Billing backend integration pending.</p>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Surface: Usage & Metering (control-plane.commercial.usage)
// ---------------------------------------------------------------------------
function renderUsageMetering() {
  renderStaticSurface(
    'Usage & Metering',
    'control-plane.commercial.usage',
    '📊',
    'Per-tenant resource consumption metrics: API calls, storage, active users, concurrent sessions. Feeds billing calculations.',
    'Commercial',
    'Commercial Service — usage_metrics (deferred)',
    [
      { id: 'R29', label: 'List tenant usage summaries', status: 'deferred', note: 'Read-only — commerce:manage permission' },
      { id: 'R30', label: 'Get tenant usage detail', status: 'deferred', note: 'Time-series breakdown by metric' },
    ]
  );
}

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
function renderAuditTrail() {
  renderStaticSurface(
    'Audit Trail',
    'control-plane.platform.audit',
    '📋',
    'Immutable, hash-chained audit log of all operator actions across the control plane. Supports compliance export and integrity verification.',
    'Platform',
    'Platform PG — immutable_audit_log',
    [
      { id: 'R33', label: 'List audit entries', status: 'deferred', note: 'Paginated, filterable by actor/action/tenant/date' },
      { id: 'R34', label: 'Verify chain integrity', status: 'deferred', note: 'SHA-256 hash chain verification' },
      { id: 'R35', label: 'Export audit range', status: 'deferred', note: 'Requires audit:export permission' },
    ]
  );
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

// ---------------------------------------------------------------------------
// AI Operator Copilot — drawer UI (disabled by default)
// ---------------------------------------------------------------------------
const COPILOT_API = '/api/copilot/v1';
let copilotHistory = [];
let copilotReady = false;

async function initCopilot() {
  try {
    const resp = await apiFetch(`${COPILOT_API}/status`);
    if (!resp.ok) { setCopilotStatus('error', 'unreachable'); return; }
    const data = await resp.json();
    copilotReady = data.operational;
    const fab = document.getElementById('copilot-fab');
    if (fab) fab.style.display = 'flex';
    setCopilotStatus(
      data.operational ? 'operational' : 'disabled',
      data.statusLabel || (data.operational ? 'operational' : 'disabled')
    );
    if (!data.operational) {
      addCopilotMessage('assistant', `Copilot is currently ${escHtml(data.statusLabel || 'disabled')}. Configure COPILOT_ENABLED=true and a provider to activate.`);
    }
  } catch {
    setCopilotStatus('error', 'error');
  }
}

function setCopilotStatus(cls, label) {
  const el = document.getElementById('copilot-status-badge');
  if (el) { el.className = 'copilot-status ' + cls; el.textContent = label; }
}

function toggleCopilotDrawer() {
  const drawer = document.getElementById('copilot-drawer');
  if (!drawer) return;
  const visible = drawer.style.display !== 'none';
  drawer.style.display = visible ? 'none' : 'flex';
}

function addCopilotMessage(role, text) {
  const container = document.getElementById('copilot-messages');
  if (!container) return;
  const div = document.createElement('div');
  const isDraft = typeof text === 'string' && text.includes('AI-ASSISTED DRAFT');
  div.className = 'copilot-msg ' + (isDraft ? 'draft' : role);
  if (isDraft) {
    div.innerHTML = '<span class="draft-label">AI-ASSISTED DRAFT</span>' + escHtml(text);
  } else {
    div.textContent = text;
  }
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

async function sendCopilotMessage() {
  const input = document.getElementById('copilot-input');
  if (!input) return;
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  addCopilotMessage('user', msg);

  if (!copilotReady) {
    addCopilotMessage('error', 'Copilot is not operational. Check /api/copilot/v1/status.');
    return;
  }

  copilotHistory.push({ role: 'user', content: msg });

  try {
    const resp = await apiFetch(`${COPILOT_API}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, history: copilotHistory.slice(-10) }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      addCopilotMessage('error', err.message || `Error: ${resp.status}`);
      return;
    }
    const data = await resp.json();
    const reply = data.content || '(no response)';
    addCopilotMessage('assistant', reply);
    copilotHistory.push({ role: 'assistant', content: reply });
  } catch (e) {
    addCopilotMessage('error', 'Network error — could not reach copilot API.');
  }
}

// Initialize copilot status on load
initCopilot();
