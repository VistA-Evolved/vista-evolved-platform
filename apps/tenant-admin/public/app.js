/**
 * Site Administration Console — VistA-First SPA (9-domain architecture)
 *
 * Hash-based routing with domain-grouped render functions per the
 * tenant_admin_deep_blueprint. All configuration writes go through
 * DDR VALIDATOR/DDR FILER or ZVE* overlay RPCs.
 *
 * Domains: Dashboard, Users & Access, Facilities & Locations,
 *   Devices & Connectivity, Clinical Config, Billing & Insurance,
 *   System & Parameters, Monitoring & Reports
 */

const STATE = {
  tenantId: null,
  cpReturnUrl: null,
  token: null,
  user: null,
  roleCluster: null,
  navGroups: null,
  legalMarket: null,
};

// ---------------------------------------------------------------------------
// Toast notification system
// ---------------------------------------------------------------------------
function showToast(message, type = 'info', durationMs = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${escapeHtml(message)}</span><button class="toast-close" aria-label="Dismiss">&times;</button>`;
  toast.querySelector('.toast-close').onclick = () => {
    toast.style.animation = 'toastOut .2s ease-in forwards';
    setTimeout(() => toast.remove(), 200);
  };
  container.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.animation = 'toastOut .2s ease-in forwards';
      setTimeout(() => toast.remove(), 200);
    }
  }, durationMs);
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  const qs = new URLSearchParams(window.location.search);
  STATE.tenantId = qs.get('tenantId') || 'default-tenant';
  STATE.cpReturnUrl = qs.get('cpReturnUrl') || null;
  STATE.legalMarket = qs.get('legalMarket') || 'US';

  const savedToken = sessionStorage.getItem('ta_token');
  if (savedToken) {
    STATE.token = savedToken;
    try {
      STATE.user = JSON.parse(sessionStorage.getItem('ta_user') || 'null');
      STATE.roleCluster = JSON.parse(sessionStorage.getItem('ta_role') || 'null');
      STATE.navGroups = JSON.parse(sessionStorage.getItem('ta_nav') || 'null');
    } catch (_) {}
  }

  document.getElementById('tenant-name').textContent = STATE.tenantId;
  document.getElementById('tenant-id-display').textContent = 'Tenant: ' + STATE.tenantId;

  if (STATE.cpReturnUrl) {
    const link = document.getElementById('return-to-cp');
    link.style.display = '';
    link.href = STATE.cpReturnUrl;
  }

  if (STATE.token && STATE.user) {
    refreshSessionFromServer().then(() => initAuthenticatedShell());
  } else {
    renderLoginScreen();
  }
});

async function refreshSessionFromServer() {
  if (!STATE.token) return;
  try {
    const res = await fetch('/api/tenant-admin/v1/auth/session', {
      headers: { 'Authorization': 'Bearer ' + STATE.token },
    });
    if (!res.ok) { logout(); return; }
    const data = await res.json();
    if (!data.ok) { logout(); return; }
    STATE.user = data.user;
    STATE.roleCluster = data.roleCluster;
    STATE.navGroups = data.navGroups;
    sessionStorage.setItem('ta_user', JSON.stringify(data.user));
    sessionStorage.setItem('ta_role', JSON.stringify(data.roleCluster));
    sessionStorage.setItem('ta_nav', JSON.stringify(data.navGroups));
  } catch (_) {}
}

function initAuthenticatedShell() {
  document.getElementById('left-nav').style.display = '';
  document.getElementById('content-area').style.display = '';
  const loginScreen = document.getElementById('login-screen');
  if (loginScreen) loginScreen.remove();

  applyNavFiltering();
  updateRoleBadge();
  checkVistaStatus();

  initCollapsibleNav();
  window.addEventListener('hashchange', route);
  route();
}

function applyNavFiltering() {
  const groups = STATE.navGroups || [];
  document.querySelectorAll('.nav-group').forEach(g => {
    const groupName = g.dataset.group;
    if (groupName && groups.length > 0 && !groups.includes(groupName)) {
      g.style.display = 'none';
    } else {
      g.style.display = '';
    }
  });
}

function updateRoleBadge() {
  const badge = document.getElementById('role-badge');
  if (badge && STATE.roleCluster) {
    badge.innerHTML = `<strong>${escapeHtml(STATE.user?.name || 'User')}</strong><br><small>${escapeHtml(STATE.roleCluster.label || 'Admin')}</small>`;
    badge.title = `DUZ: ${escapeHtml(String(STATE.user?.duz || '?'))} | Role: ${escapeHtml(STATE.roleCluster.id || '?')} | Keys: ${(STATE.user?.keys || []).length}`;
  }
}

function checkVistaStatus() {
  fetch('/api/tenant-admin/v1/vista-status?tenantId=' + encodeURIComponent(STATE.tenantId))
    .then(r => r.json())
    .then(res => {
      const connected = res.vista && res.vista.ok;
      const statusEl = document.getElementById('tenant-status');
      const sourceEl = document.getElementById('tenant-source');
      if (connected) {
        statusEl.textContent = 'VistA CONNECTED';
        statusEl.style.background = '#d1fae5';
        statusEl.style.color = '#065f46';
        if (sourceEl) sourceEl.textContent = 'Source: VistA';
      } else {
        statusEl.textContent = 'VistA DISCONNECTED';
        statusEl.style.background = '#fee2e2';
        statusEl.style.color = '#991b1b';
        if (sourceEl) sourceEl.textContent = 'Source: error — VistA unreachable';
      }
    })
    .catch(() => {
      const statusEl = document.getElementById('tenant-status');
      statusEl.textContent = 'VistA DISCONNECTED';
      statusEl.style.background = '#fee2e2';
      statusEl.style.color = '#991b1b';
    });
}

function renderLoginScreen() {
  document.getElementById('left-nav').style.display = 'none';
  document.getElementById('content-area').style.display = 'none';

  const existing = document.getElementById('login-screen');
  if (existing) existing.remove();

  const loginEl = document.createElement('div');
  loginEl.id = 'login-screen';
  loginEl.innerHTML = `
    <div class="login-container">
      <div class="login-card">
        <div class="login-header">
          <h1>VistA Evolved</h1>
          <h2>Site Administration</h2>
          <p class="login-subtitle">Sign in with your VistA credentials</p>
        </div>
        <form id="login-form" autocomplete="off">
          <div class="login-field">
            <label for="login-access">Access Code</label>
            <input type="text" id="login-access" name="accessCode" placeholder="Enter access code" autocomplete="off" required>
          </div>
          <div class="login-field">
            <label for="login-verify">Verify Code</label>
            <input type="password" id="login-verify" name="verifyCode" placeholder="Enter verify code" autocomplete="off" required>
          </div>
          <div id="login-error" class="login-error" style="display:none;"></div>
          <button type="submit" class="login-btn" id="login-submit">Sign In</button>
        </form>
        <div class="login-footer">
          <div class="login-info">Tenant: <strong>${escapeHtml(STATE.tenantId)}</strong></div>
          <div class="login-info">Market: <strong>${escapeHtml(STATE.legalMarket)}</strong></div>
          <div class="login-sandbox-hint">
            <details>
              <summary>Sandbox credentials</summary>
              <table class="login-creds-table">
                <tr><td>PRO1234 / PRO1234!!</td><td>Programmer / IRM Admin</td></tr>
                <tr><td>PROV123 / PROV123!!</td><td>Provider (Clinical)</td></tr>
                <tr><td>NURSE123 / NURSE123!!</td><td>Nurse</td></tr>
              </table>
            </details>
          </div>
        </div>
      </div>
    </div>`;
  document.querySelector('.shell').before(loginEl);

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('login-submit');
    const errEl = document.getElementById('login-error');
    btn.disabled = true;
    btn.textContent = 'Signing in...';
    errEl.style.display = 'none';

    const accessCode = document.getElementById('login-access').value.trim();
    const verifyCode = document.getElementById('login-verify').value.trim();
    try {
      const res = await fetch('/api/tenant-admin/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode, verifyCode, tenantId: STATE.tenantId }),
      });
      const data = await res.json();
      if (data.ok && data.token) {
        STATE.token = data.token;
        STATE.user = data.user;
        STATE.roleCluster = data.roleCluster;
        STATE.navGroups = data.navGroups;
        sessionStorage.setItem('ta_token', data.token);
        sessionStorage.setItem('ta_user', JSON.stringify(data.user));
        sessionStorage.setItem('ta_role', JSON.stringify(data.roleCluster));
        sessionStorage.setItem('ta_nav', JSON.stringify(data.navGroups));
        showToast('Signed in as ' + (data.user?.name || 'User'), 'success');
        initAuthenticatedShell();
      } else {
        errEl.textContent = data.error || 'Login failed';
        errEl.style.display = '';
      }
    } catch (err) {
      errEl.textContent = 'Connection error: ' + (err.message || 'unknown');
      errEl.style.display = '';
    }
    btn.disabled = false;
    btn.textContent = 'Sign In';
  });
}

function logout() {
  if (STATE.token) {
    fetch('/api/tenant-admin/v1/auth/logout', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + STATE.token },
    }).catch(() => {});
  }
  STATE.token = null;
  STATE.user = null;
  STATE.roleCluster = null;
  STATE.navGroups = null;
  sessionStorage.removeItem('ta_token');
  sessionStorage.removeItem('ta_user');
  sessionStorage.removeItem('ta_role');
  sessionStorage.removeItem('ta_nav');
  window.removeEventListener('hashchange', route);
  renderLoginScreen();
}

// ---------------------------------------------------------------------------
// Collapsible nav groups
// ---------------------------------------------------------------------------
function initCollapsibleNav() {
  document.querySelectorAll('.nav-group-header[data-toggle]').forEach(header => {
    header.addEventListener('click', () => {
      const group = header.closest('.nav-group');
      group.classList.toggle('collapsed');
      const key = header.getAttribute('data-toggle');
      try { localStorage.setItem('nav-' + key, group.classList.contains('collapsed') ? '1' : '0'); } catch {}
    });
    const key = header.getAttribute('data-toggle');
    try {
      if (localStorage.getItem('nav-' + key) === '1') {
        header.closest('.nav-group').classList.add('collapsed');
      }
    } catch {}
  });
}

// ---------------------------------------------------------------------------
// Router — maps hash routes to render functions
// ---------------------------------------------------------------------------
const ROUTES = [
  { pattern: /^#\/users\/(.+)/, fn: (el, m) => renderUserDetail(el, decodeURIComponent(m[1])) },
  { pattern: /^#\/facilities\/(.+)/, fn: (el, m) => renderFacilityDetail(el, decodeURIComponent(m[1])) },
  { pattern: /^#\/clinics\/(.+)/, fn: (el, m) => renderClinicDetail(el, decodeURIComponent(m[1])) },
  { pattern: /^#\/wards\/(.+)/, fn: (el, m) => renderWardDetail(el, decodeURIComponent(m[1])) },
  { pattern: /^#\/devices\/(.+)/, fn: (el, m) => renderDeviceDetail(el, decodeURIComponent(m[1])) },
  { pattern: /^#\/treating-specialties\/(.+)/, fn: (el, m) => renderTreatingSpecialtyDetail(el, decodeURIComponent(m[1])) },
  { pattern: /^#\/appointment-types\/(.+)/, fn: (el, m) => renderAppointmentTypeDetail(el, decodeURIComponent(m[1])) },
  { pattern: /^#\/terminal-types\/(.+)/, fn: (el, m) => renderTerminalTypeDetail(el, decodeURIComponent(m[1])) },
  { pattern: /^#\/room-beds\/(.+)/, fn: (el, m) => renderRoomBedDetail(el, decodeURIComponent(m[1])) },
  { pattern: /^#\/titles\/(.+)/, fn: (el, m) => renderTitleDetail(el, decodeURIComponent(m[1])) },
  { pattern: /^#\/hl7-interfaces\/(.+)/, fn: (el, m) => renderHL7InterfaceDetail(el, decodeURIComponent(m[1])) },
  { pattern: /^#\/menu-options\/(.+)/, fn: (el, m) => renderMenuOptionDetail(el, decodeURIComponent(m[1])) },
  { pattern: /^#\/drug-file\/(.+)/, fn: (el, m) => renderDrugDetail(el, decodeURIComponent(m[1])) },
  { pattern: /^#\/lab-tests\/(.+)/, fn: (el, m) => renderLabTestDetail(el, decodeURIComponent(m[1])) },
  { pattern: /^#\/packages\/(\d+)/, fn: (el, m) => renderPackageDetail(el, m[1]) },
  { pattern: /^#\/taskman\/(.+)/, fn: (el, m) => renderTaskManDetail(el, decodeURIComponent(m[1])) },
  { pattern: '#/users', fn: renderUserList },
  { pattern: '#/facilities', fn: renderFacilityList },
  { pattern: '#/roles', fn: renderRoleAssignment },
  { pattern: '#/key-inventory', fn: renderKeyInventory },
  { pattern: '#/esig-status', fn: renderEsigStatus },
  { pattern: '#/access-profiles', fn: renderAccessProfiles },
  { pattern: '#/access-audit', fn: renderAccessAudit },
  { pattern: '#/file-access', fn: renderFileAccess },
  { pattern: '#/clinics', fn: renderClinicList },
  { pattern: '#/wards', fn: renderWardList },
  { pattern: '#/beds', fn: renderRoomBeds },
  { pattern: '#/treating-specialties', fn: renderTreatingSpecialties },
  { pattern: '#/scheduling-config', fn: renderSchedulingConfig },
  { pattern: '#/appointment-types', fn: renderSchedulingConfig },
  { pattern: '#/devices', fn: renderDeviceList },
  { pattern: '#/terminal-types', fn: renderTerminalTypes },
  { pattern: '#/titles', fn: renderTitles },
  { pattern: '#/hl7-interfaces', fn: renderHL7Interfaces },
  { pattern: '#/rpc-status', fn: renderVistaTools },
  { pattern: '#/order-config', fn: renderOrderConfig },
  { pattern: /^#\/quick-orders\/(.+)/, fn: (el, m) => renderQuickOrderDetail(el, decodeURIComponent(m[1])) },
  { pattern: /^#\/order-sets\/(.+)/, fn: (el, m) => renderOrderSetDetail(el, decodeURIComponent(m[1])) },
  { pattern: '#/tiu-config', fn: renderTiuConfig },
  { pattern: '#/pharmacy-config', fn: renderDrugFile },
  { pattern: '#/drug-file', fn: renderDrugFile },
  { pattern: '#/lab-config', fn: renderLabTests },
  { pattern: '#/lab-tests', fn: renderLabTests },
  { pattern: '#/radiology-config', fn: renderRadiologyConfig },
  { pattern: '#/nursing-config', fn: renderNursingConfig },
  { pattern: '#/health-summary-config', fn: renderHealthSummaryConfig },
  { pattern: '#/billing-params', fn: renderBillingParams },
  { pattern: '#/insurance', fn: renderInsuranceCompanies },
  { pattern: /^#\/insurance\/(.+)$/, fn: (el, m) => renderInsuranceDetail(el, decodeURIComponent(m[1])) },
  { pattern: '#/encounter-forms', fn: renderEncounterForms },
  { pattern: '#/claims-tracking', fn: renderClaimsTracking },
  { pattern: '#/params/kernel', fn: renderParamsKernel },
  { pattern: '#/mailman-config', fn: renderMailGroups },
  { pattern: '#/taskman', fn: renderTaskMan },
  { pattern: '#/menu-management', fn: renderMenuManagement },
  { pattern: '#/error-trap', fn: renderErrorTrap },
  { pattern: '#/packages', fn: renderInstalledPackages },
  { pattern: '#/modules', fn: renderModuleEntitlements },
  { pattern: '#/monitoring/status', fn: renderMonitoringStatus },
  { pattern: '#/monitoring/audit', fn: renderAuditTrail },
  { pattern: '#/reports/billing', fn: renderBillingReport },
  { pattern: '#/reports/scheduling', fn: renderSchedulingReport },
  { pattern: '#/reports/lab', fn: renderLabReport },
  { pattern: '#/reports/radiology', fn: renderRadiologyReport },
  { pattern: '#/reports/nursing', fn: renderNursingReport },
  { pattern: '#/vista-tools', fn: renderVistaTools },
  { pattern: '#/raw-fileman', fn: renderRawFileMan },
  { pattern: '#/capacity-planning', fn: renderCapacityPlanning },
  { pattern: '#/settings/market', fn: renderMarketSettings },
  { pattern: '#/topology', fn: renderTopology },
  { pattern: '#/dashboard', fn: renderDashboard },
];

const ROUTE_RBAC = {
  users: [/#\/users/, /#\/roles/, /#\/key-inventory/, /#\/esig-status/, /#\/access-profiles/, /#\/access-audit/, /#\/file-access/, /#\/security-keys/],
  facilities: [/#\/facilities/, /#\/clinics/, /#\/wards/, /#\/beds/, /#\/treating-specialties/, /#\/scheduling-config/, /#\/appointment-types/],
  clinical: [/#\/order-config/, /#\/quick-orders/, /#\/order-sets/, /#\/tiu-config/, /#\/pharmacy-config/, /#\/drug-file/, /#\/lab-config/, /#\/lab-tests/, /#\/radiology-config/, /#\/nursing-config/, /#\/health-summary-config/, /#\/encounter-forms/],
  billing: [/#\/billing/, /#\/insurance/, /#\/claims-tracking/, /#\/fee-basis/],
  system: [/#\/params\/kernel/, /#\/mailman-config/, /#\/taskman/, /#\/menu-management/, /#\/error-trap/, /#\/packages/, /#\/modules/, /#\/topology/],
  devices: [/#\/devices/, /#\/terminal-types/, /#\/titles/, /#\/hl7-interfaces/],
  monitoring: [/#\/monitoring/],
  vistatools: [/#\/vista-tools/, /#\/rpc-status/, /#\/raw-fileman/, /#\/capacity-planning/],
  settings: [/#\/settings/],
};

function resolveClientRouteGroup(hash) {
  for (const [group, patterns] of Object.entries(ROUTE_RBAC)) {
    for (const p of patterns) {
      if (p.test(hash)) return group;
    }
  }
  return null;
}

function renderAccessDenied(el, group) {
  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> &rsaquo; Access Restricted</div>
    <div class="page-header"><h1>Access Restricted</h1></div>
    <div style="padding:40px 20px;text-align:center;">
      <div style="font-size:48px;margin-bottom:16px;opacity:.5;">&#128274;</div>
      <h2 style="color:var(--ve-color-error,#dc2626);margin-bottom:12px;">Insufficient Permissions</h2>
      <p style="max-width:480px;margin:0 auto 20px;color:var(--ve-color-text-muted,#6b7280);">
        Your VistA security keys do not grant access to the <strong>${escapeHtml(group)}</strong> area.
        Contact your system administrator to request the appropriate key assignment.
      </p>
      <p style="font-size:12px;color:var(--ve-color-text-muted,#6b7280);">
        Current role: <strong>${escapeHtml(STATE.roleCluster?.label || 'Unknown')}</strong>
        &bull; Keys: ${(STATE.user?.keys || []).length}
      </p>
      <a href="#/dashboard" style="display:inline-block;margin-top:16px;padding:8px 20px;background:var(--ve-color-primary,#2563eb);color:#fff;border-radius:6px;text-decoration:none;">Return to Dashboard</a>
    </div>`;
}

function route() {
  const hash = window.location.hash || '#/dashboard';
  const content = document.getElementById('content-area');
  const baseHash = hash.split('?')[0];

  document.querySelectorAll('.nav-link').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === baseHash);
  });

  const groups = STATE.navGroups || [];
  const routeGroup = resolveClientRouteGroup(baseHash);
  if (routeGroup && groups.length > 0 && !groups.includes(routeGroup)) {
    renderAccessDenied(content, routeGroup);
    return;
  }

  for (const r of ROUTES) {
    if (r.pattern instanceof RegExp) {
      const m = hash.match(r.pattern);
      if (m) { r.fn(content, m); return; }
    } else if (baseHash === r.pattern) {
      r.fn(content); return;
    }
  }
  renderDashboard(content);
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------
function authHeaders(extra = {}) {
  const h = { ...extra };
  if (STATE.token) h['Authorization'] = 'Bearer ' + STATE.token;
  return h;
}

async function api(path) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `/api/tenant-admin/v1/${path}${sep}tenantId=${encodeURIComponent(STATE.tenantId)}`;
  try {
    const res = await fetch(url, { headers: authHeaders() });
    if (res.status === 401) { logout(); return { ok: false, error: 'Session expired' }; }
    if (!res.ok) {
      try { return await res.json(); } catch { return { ok: false, error: `HTTP ${res.status}` }; }
    }
    return res.json();
  } catch (err) {
    return { ok: false, error: err.message || 'Network error' };
  }
}
async function apiPut(path, body) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `/api/tenant-admin/v1/${path}${sep}tenantId=${encodeURIComponent(STATE.tenantId)}`;
  try {
    const res = await fetch(url, { method: 'PUT', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(body || {}) });
    if (res.status === 401) { logout(); return { ok: false, error: 'Session expired' }; }
    try { return await res.json(); } catch { return { ok: !res.ok ? false : true, error: res.ok ? null : `HTTP ${res.status}` }; }
  } catch (err) {
    return { ok: false, error: err.message || 'Network error' };
  }
}
async function apiPost(path, body) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `/api/tenant-admin/v1/${path}${sep}tenantId=${encodeURIComponent(STATE.tenantId)}`;
  try {
    const res = await fetch(url, { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(body || {}) });
    if (res.status === 401) { logout(); return { ok: false, error: 'Session expired' }; }
    try { return await res.json(); } catch { return { ok: !res.ok ? false : true, error: res.ok ? null : `HTTP ${res.status}` }; }
  } catch (err) {
    return { ok: false, error: err.message || 'Network error' };
  }
}
async function apiDelete(path) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `/api/tenant-admin/v1/${path}${sep}tenantId=${encodeURIComponent(STATE.tenantId)}`;
  try {
    const res = await fetch(url, { method: 'DELETE', headers: authHeaders() });
    if (res.status === 401) { logout(); return { ok: false, error: 'Session expired' }; }
    try { return await res.json(); } catch { return { ok: !res.ok ? false : true, error: res.ok ? null : `HTTP ${res.status}` }; }
  } catch (err) {
    return { ok: false, error: err.message || 'Network error' };
  }
}
function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
function sourceBadge(source) {
  if (source === 'vista') return '<span class="source-posture vista">VistA</span>';
  if (source === 'catalog') return '<span class="source-posture catalog">CATALOG</span>';
  if (source === 'integration-pending') return '<span class="source-posture pending">INTEGRATION-PENDING</span>';
  if (source === 'error') return '<span class="source-posture error">ERROR</span>';
  return '<span class="source-posture error">UNKNOWN</span>';
}

function wireClickableRows(tbodyId) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.querySelectorAll('tr.clickable-row').forEach(tr => {
    tr.style.cursor = 'pointer';
    tr.addEventListener('click', () => { window.location.hash = tr.dataset.href; });
  });
}

/**
 * Generates an (i) tooltip icon with a plain-English explanation.
 * Usage: `${tip('This controls how many columns the terminal can display.')}`
 */
function tip(text) {
  return `<span class="help-tip" data-tip="${escapeHtml(text)}">&#9432;</span>`;
}

function renderFieldEditForm(entityType, ien, fieldMap, helpMap = {}) {
  const id = entityType.replace(/[^a-z0-9]/gi, '-');
  return `
    <div class="detail-section" style="margin-top:12px;">
      <h2>Edit Fields</h2>
      <p style="font-size:12px;color:var(--color-text-muted);margin-bottom:8px;">Select a field, enter the new value, and save to VistA via <code>DDR FILER</code>.</p>
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;">
        <label style="font-size:12px;">Field<br/><select id="${id}-edit-field" style="min-width:220px;">
          ${Object.entries(fieldMap).map(([k,l]) => `<option value="${k}">${k} - ${escapeHtml(l)}</option>`).join('')}
        </select></label>
        <label style="font-size:12px;">Value<br/><input type="text" id="${id}-edit-value" placeholder="New value" style="min-width:200px;" /></label>
        <button type="button" class="btn-primary btn-sm" id="${id}-edit-save">Save to VistA</button>
      </div>
      <div id="${id}-edit-help" style="font-size:11px;color:var(--color-text-muted);margin-top:6px;min-height:18px;"></div>
      <div id="${id}-edit-msg" style="margin-top:8px;font-size:12px;"></div>
    </div>`;
}

function wireFieldEditForm(entityType, ien, apiPath, helpMap = {}) {
  const id = entityType.replace(/[^a-z0-9]/gi, '-');
  const sel = document.getElementById(`${id}-edit-field`);
  const helpEl = document.getElementById(`${id}-edit-help`);
  if (sel && helpEl) {
    sel.addEventListener('change', () => { helpEl.textContent = helpMap[sel.value] || ''; });
    helpEl.textContent = helpMap[sel.value] || '';
  }
  const saveBtn = document.getElementById(`${id}-edit-save`);
  if (saveBtn) saveBtn.addEventListener('click', async () => {
    const field = document.getElementById(`${id}-edit-field`).value;
    const value = document.getElementById(`${id}-edit-value`).value;
    const msg = document.getElementById(`${id}-edit-msg`);
    if (!value.trim()) { msg.textContent = 'Value required.'; msg.style.color = '#b91c1c'; return; }
    if (!confirm(`Update field ${field}?`)) return;
    msg.textContent = 'Saving...'; msg.style.color = '';
    const out = await apiPut(apiPath, { field, value });
    msg.textContent = out.ok ? 'Saved. Refresh to see updated value.' : (out.error || JSON.stringify(out));
    msg.style.color = out.ok ? '#166534' : '#b91c1c';
  });
}

function renderTabBar(tabs, activeId) {
  return `<div class="tab-bar">${tabs.map(t =>
    `<button data-tab="${t.id}" class="${t.id === activeId ? 'active' : ''}">${escapeHtml(t.label)}</button>`
  ).join('')}</div>`;
}

function wireTabBar(container) {
  const bar = container.querySelector('.tab-bar');
  if (!bar) return;
  bar.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      bar.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      container.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
      const target = container.querySelector(`.tab-content[data-tab="${btn.dataset.tab}"]`);
      if (target) target.classList.add('active');
    });
  });
}

function renderRawTab(data) {
  return `<div class="tab-content" data-tab="raw"><pre class="raw-json-pre">${escapeHtml(JSON.stringify(data, null, 2))}</pre></div>`;
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Reusable: Inactivation / Soft-delete button
// ---------------------------------------------------------------------------
function renderInactivateButton(entityType, ien, isActive) {
  const label = isActive ? 'Inactivate' : 'Reactivate';
  const color = isActive ? '#dc2626' : '#166534';
  const id = `inact-btn-${entityType}-${ien}`;
  return `<div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--color-border);">
    <button id="${id}" class="btn-secondary btn-sm" style="color:${color};border-color:${color};">${label}</button>
    <span id="${id}-msg" style="margin-left:8px;font-size:12px;"></span>
  </div>`;
}
function wireInactivateButton(entityType, ien, isActive, onDone) {
  const action = isActive ? 'inactivate' : 'reactivate';
  const id = `inact-btn-${entityType}-${ien}`;
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const msg = document.getElementById(`${id}-msg`);
    const actionLabel = isActive ? 'Inactivate' : 'Reactivate';
    if (!confirm(`${actionLabel} this ${entityType}? This writes to VistA immediately.`)) return;
    btn.disabled = true;
    msg.textContent = 'Saving...';
    msg.style.color = '';
    try {
      const res = await apiPost(`${entityType}/${encodeURIComponent(ien)}/${action}`);
      if (res.ok) {
        msg.textContent = `${actionLabel}d. Refreshing...`;
        msg.style.color = '#166534';
        setTimeout(() => { if (onDone) onDone(); else location.reload(); }, 1200);
      } else {
        msg.textContent = res.error || 'Failed';
        msg.style.color = '#b91c1c';
        btn.disabled = false;
      }
    } catch (e) {
      msg.textContent = e.message;
      msg.style.color = '#b91c1c';
      btn.disabled = false;
    }
  });
}

// renderIntegrationPending removed — all pages are now live VistA features

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
async function renderDashboard(el) {
  el.innerHTML = `
    <div class="page-header"><h1>Dashboard</h1><span class="source-posture pending">Loading…</span></div>
    <div class="loading-message">Loading dashboard…</div>`;
  const res = await api('dashboard');
  if (!res.ok) { el.innerHTML = `<div class="error-message">Failed to load dashboard</div>`; return; }
  const d = res.data;
  const badge = sourceBadge(res.sourceStatus || res.source);
  const groundingStyle = d.vistaGrounding === 'connected' ? 'color:#065f46' : '';
  el.innerHTML = `
    <div class="page-header"><h1>Dashboard</h1>${badge}</div>

    <!-- VistA Connection Status -->
    <div class="card-grid" style="margin-bottom:8px;">
      <div class="card" style="grid-column: span 2;">
        <div class="card-label">VistA Connection</div>
        <div class="card-value" style="font-size:18px;${groundingStyle}">${escapeHtml(d.vistaGrounding)}</div>
        <div class="card-sub">${d.vistaUrl ? escapeHtml(d.vistaUrl) : 'No VistA configured'} · <a href="#/monitoring/status">System Status →</a></div>
      </div>
    </div>

    <!-- Domain 1: Users & Access -->
    <div class="detail-section" style="margin-top:16px;">
      <h2 style="font-size:14px;margin-bottom:8px;">Users &amp; Access</h2>
      <div class="card-grid">
        <div class="card"><div class="card-label">Total Users</div><div class="card-value">${d.userCount}</div>
          <div class="card-sub">${d.activeUserCount} active · <a href="#/users">Manage →</a></div></div>
        <div class="card"><div class="card-label">Security Keys</div><div class="card-value">${d.roleCount}</div>
          <div class="card-sub"><a href="#/key-inventory">Inventory →</a></div></div>
        <div class="card"><div class="card-label">E-Sig Active</div><div class="card-value">${d.esigActiveCount ?? '—'}</div>
          <div class="card-sub"><a href="#/esig-status">Review →</a></div></div>
        <div class="card"><div class="card-label">Access Audit</div><div class="card-value" style="font-size:18px;">Audit</div>
          <div class="card-sub"><a href="#/access-audit">Audit User →</a></div></div>
      </div>
    </div>

    <!-- Domain 2: Facilities & Locations -->
    <div class="detail-section">
      <h2 style="font-size:14px;margin-bottom:8px;">Facilities &amp; Locations</h2>
      <div class="card-grid">
        <div class="card"><div class="card-label">Facilities</div><div class="card-value">${d.facilityCount}</div>
          <div class="card-sub"><a href="#/facilities">View →</a></div></div>
        <div class="card"><div class="card-label">Clinics</div><div class="card-value">${d.clinicCount ?? '—'}</div>
          <div class="card-sub"><a href="#/clinics">Configure →</a></div></div>
        <div class="card"><div class="card-label">Wards / Beds</div><div class="card-value">${d.wardCount ?? '—'} / ${d.bedCount ?? '—'}</div>
          <div class="card-sub"><a href="#/wards">Manage →</a></div></div>
      </div>
    </div>

    <!-- Domain 3: Devices & Connectivity -->
    <div class="detail-section">
      <h2 style="font-size:14px;margin-bottom:8px;">Devices &amp; Connectivity</h2>
      <div class="card-grid">
        <div class="card"><div class="card-label">Devices</div><div class="card-value">${d.deviceCount ?? '—'}</div>
          <div class="card-sub"><a href="#/devices">Manage →</a></div></div>
        <div class="card"><div class="card-label">Terminal Types</div><div class="card-value">${d.terminalTypeCount ?? '—'}</div>
          <div class="card-sub"><a href="#/terminal-types">File 3.2 →</a></div></div>
        <div class="card"><div class="card-label">HL7 Interfaces</div><div class="card-value">${d.hl7InterfaceCount ?? '—'}</div>
          <div class="card-sub"><a href="#/hl7-interfaces">Monitor →</a></div></div>
      </div>
    </div>

    <!-- Domain 4-7: Quick Links -->
    <div class="detail-section">
      <h2 style="font-size:14px;margin-bottom:8px;">Clinical, Billing, System, Monitoring</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap;font-size:13px;">
        <a href="#/order-config" class="btn btn-sm">Order Config</a>
        <a href="#/tiu-config" class="btn btn-sm">TIU/Notes</a>
        <a href="#/pharmacy-config" class="btn btn-sm">Pharmacy</a>
        <a href="#/lab-config" class="btn btn-sm">Lab</a>
        <a href="#/radiology-config" class="btn btn-sm">Radiology</a>
        <a href="#/billing-params" class="btn btn-sm">Billing</a>
        <a href="#/insurance" class="btn btn-sm">Insurance</a>
        <a href="#/params/kernel" class="btn btn-sm">Kernel Params</a>
        <a href="#/taskman" class="btn btn-sm">TaskMan</a>
        <a href="#/monitoring/status" class="btn btn-sm">System Status</a>
        <a href="#/modules" class="btn btn-sm">Modules</a>
      </div>
    </div>

    <!-- Session Info -->
    <div class="detail-section" style="margin-top:8px;">
      <h2 style="font-size:14px;margin-bottom:8px;">Session</h2>
      <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:13px;align-items:center;">
        <span>Signed in as: <strong>${escapeHtml(STATE.user?.name || 'Unknown')}</strong> (DUZ ${escapeHtml(String(STATE.user?.duz || '?'))})</span>
        <span>Role: <strong>${escapeHtml(STATE.roleCluster?.label || 'Admin')}</strong></span>
        <span>Market: <strong>${escapeHtml(STATE.legalMarket || 'US')}</strong></span>
        <span>Keys: <strong>${(STATE.user?.keys || []).length}</strong></span>
        <button onclick="logout()" class="btn btn-sm" style="color:#b91c1c;border-color:#b91c1c;margin-left:auto;">Sign Out</button>
      </div>
    </div>

    <!-- Coverage Status -->
    <div class="detail-section" style="margin-top:8px;">
      <h2 style="font-size:14px;margin-bottom:8px;">Coverage Status</h2>
      <p style="font-size:13px;color:var(--color-text-muted);margin-bottom:8px;">
        ${d.apiRouteCount || 156} API routes, ${d.uiRouteCount || 71} UI pages. VistA-only data — DDR LISTER/GETS/FILER + custom ZVE* RPCs.
      </p>
      <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:13px;">
        <span><strong style="color:var(--color-success)">${d.apiRouteCount || 156}</strong> LIVE VistA routes</span>
        <span><strong>${d.vistaFileCount || '35+'}</strong> VistA files</span>
        <span><strong>${d.mRoutineCount || 14}</strong> custom M routines</span>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// User List
// ---------------------------------------------------------------------------
async function renderUserList(el) {
  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Users &amp; Access › User List</div>
    <div class="page-header"><h1>User List</h1><span class="source-posture pending">Loading…</span></div>
    <div class="loading-message">Loading users from VistA…</div>`;
  const res = await api('users');
  if (!res.ok) { el.innerHTML = `<div class="error-message">Failed to load users</div>`; return; }
  const users = res.data;
  const badge = sourceBadge(res.sourceStatus || res.source);

  function renderRows(list) {
    return list.map(u => {
      const vg = u.vistaGrounding || {};
      const eSig = vg.electronicSignature || {};
      const eSigBadge = eSig.status === 'active' ? 'badge-active' : eSig.status === 'revoked' ? 'badge-inactive' : 'badge-ungrounded';
      const id = u.id || u.ien || 'unknown';
      const isProvider = (u.roles || []).some(r => r.toUpperCase() === 'PROVIDER' || r.toUpperCase() === 'ORES');
      return `<tr>
        <td><a href="#/users/${encodeURIComponent(id)}">${escapeHtml(u.name)}</a></td>
        <td>${vg.duz ?? u.ien ?? '—'}</td>
        <td>${escapeHtml(u.title || '—')}</td>
        <td><span class="badge ${(u.status || 'active') === 'active' ? 'badge-active' : 'badge-inactive'}">${escapeHtml(u.status || 'active')}</span></td>
        <td>${escapeHtml(vg.serviceSection || '—')}</td>
        <td>${isProvider ? '<span class="badge badge-active">Yes</span>' : '—'}</td>
        <td><span class="badge ${eSigBadge}">${escapeHtml(eSig.status || '—')}</span></td>
        <td>
          <a href="#/users/${encodeURIComponent(id)}" class="btn btn-sm" style="font-size:11px;">Detail</a>
        </td>
      </tr>`;
    }).join('');
  }

  const activeCount = users.filter(u => (u.status || 'active') === 'active').length;
  const inactiveCount = users.length - activeCount;
  const providerCount = users.filter(u => (u.roles || []).some(r => r.toUpperCase() === 'PROVIDER' || r.toUpperCase() === 'ORES')).length;
  const esigCount = users.filter(u => {
    const es = (u.vistaGrounding || {}).electronicSignature || {};
    return es.status === 'active';
  }).length;

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Users &amp; Access › User List</div>
    <div class="page-header"><h1>User List</h1>${badge}</div>
    <div class="explanation-header">
      <strong>VistA User Management (File 200 — NEW PERSON)</strong>
      Users are stored in VistA File 200. Each user has identity fields, security keys, menu assignments,
      electronic signature settings, and provider credentials. Read via <code>ORWU NEWPERS</code>, write via <code>ZVE USMG</code> RPCs and <code>DDR FILER</code>.
    </div>
    <div class="card-grid" style="margin-bottom:16px;">
      <div class="card"><div class="card-label">Total Users</div><div class="card-value">${users.length}</div></div>
      <div class="card"><div class="card-label">Active</div><div class="card-value" style="color:var(--color-success)">${activeCount}</div></div>
      <div class="card"><div class="card-label">Inactive</div><div class="card-value" style="${inactiveCount > 0 ? 'color:var(--color-warning)' : ''}">${inactiveCount}</div></div>
      <div class="card"><div class="card-label">Providers</div><div class="card-value">${providerCount}</div></div>
      <div class="card"><div class="card-label">E-Sig Active</div><div class="card-value">${esigCount}</div></div>
    </div>
    <div class="filter-rail">
      <input type="text" id="user-search" placeholder="Search users…" />
      <select id="user-status-filter"><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
      <span class="result-count" id="user-count">Showing ${users.length} of ${users.length}</span>
    </div>
    <table class="data-table">
      <thead><tr><th>Name</th><th>DUZ</th><th>Title</th><th>Status</th><th>Svc/Section</th><th>Provider?</th><th>E-Sig</th><th>Actions</th></tr></thead>
      <tbody id="user-tbody">${renderRows(users)}</tbody>
    </table>
    <div class="detail-section" style="margin-top:16px;">
      <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">▾</span> Add User</h2>
      <div class="collapsible-content">
        <p style="font-size:12px;color:var(--color-text-muted);margin-bottom:8px;">Creates a new user in VistA File 200 via <code>ZVE USMG ADD</code>.
          After creation, navigate to the user detail page to configure provider credentials, e-sig, keys, and menu.
        </p>
        <div class="form-grid">
          <div><label>Name (LAST,FIRST) *</label><input type="text" id="user-add-name" placeholder="e.g. DOE,JOHN" /></div>
          <div><label>Access Code *</label><input type="text" id="user-add-ac" placeholder="3-20 chars" /></div>
          <div><label>Verify Code *</label><input type="password" id="user-add-vc" placeholder="3-20 chars" /></div>
          <div><label>Title</label><input type="text" id="user-add-title" placeholder="e.g. MD, RN, PharmD" /></div>
          <div><label>SSN</label><input type="text" id="user-add-ssn" placeholder="000-00-0000" maxlength="11" /></div>
          <div><label>Sex</label><select id="user-add-sex"><option value="">—</option><option value="M">Male</option><option value="F">Female</option></select></div>
          <div><label>DOB (MM/DD/YYYY)</label><input type="text" id="user-add-dob" placeholder="01/15/1975" /></div>
          <div><label>Service/Section</label><input type="text" id="user-add-service" placeholder="File 49 name" /></div>
          <div><label>Division</label><input type="text" id="user-add-division" placeholder="File 40.8 IEN" /></div>
          <div><label>Primary Menu</label><input type="text" id="user-add-menu" placeholder="e.g. XUCORE" /></div>
        </div>
        <button type="button" class="btn-primary" id="user-add-btn" style="margin-top:12px;">Create User</button>
        <div id="user-add-msg" style="margin-top:8px;font-size:12px;"></div>
      </div>
    </div>`;

  const filterFn = () => {
    const q = (document.getElementById('user-search').value || '').toLowerCase();
    const sf = document.getElementById('user-status-filter').value;
    const filtered = users.filter(u => {
      if (q && !u.name.toLowerCase().includes(q) && !(u.title || '').toLowerCase().includes(q)) return false;
      if (sf && (u.status || 'active') !== sf) return false;
      return true;
    });
    document.getElementById('user-tbody').innerHTML = renderRows(filtered);
    document.getElementById('user-count').textContent = `Showing ${filtered.length} of ${users.length}`;
  };
  document.getElementById('user-search').addEventListener('input', filterFn);
  document.getElementById('user-status-filter').addEventListener('change', filterFn);

  document.getElementById('user-add-btn').addEventListener('click', async () => {
    const name = (document.getElementById('user-add-name') || {}).value || '';
    const ac = (document.getElementById('user-add-ac') || {}).value || '';
    const vc = (document.getElementById('user-add-vc') || {}).value || '';
    const msg = document.getElementById('user-add-msg');
    if (!name.trim()) { msg.textContent = 'Name is required (LAST,FIRST format).'; msg.style.color = '#b91c1c'; return; }
    if (!confirm('Create user "' + name.trim() + '" in VistA? This writes to File 200.')) return;
    msg.textContent = 'Creating user in VistA…'; msg.style.color = '';
    const title = (document.getElementById('user-add-title') || {}).value || '';
    const ssn = (document.getElementById('user-add-ssn') || {}).value || '';
    const sex = (document.getElementById('user-add-sex') || {}).value || '';
    const dob = (document.getElementById('user-add-dob') || {}).value || '';
    const service = (document.getElementById('user-add-service') || {}).value || '';
    const division = (document.getElementById('user-add-division') || {}).value || '';
    const menu = (document.getElementById('user-add-menu') || {}).value || '';
    const out = await apiPost('users', {
      name: name.trim(), accessCode: ac, verifyCode: vc,
      title: title.trim() || undefined,
      ssn: ssn.trim() || undefined,
      sex: sex || undefined,
      dob: dob.trim() || undefined,
      serviceSection: service.trim() || undefined,
      division: division.trim() || undefined,
      primaryMenu: menu.trim() || undefined,
    });
    if (out.ok) {
      msg.textContent = 'User created (IEN: ' + (out.newIen || 'pending') + '). Refreshing…'; msg.style.color = '#166534';
      setTimeout(() => renderUserList(el), 1500);
    } else { msg.textContent = out.error || JSON.stringify(out); msg.style.color = '#b91c1c'; }
  });
}

// ---------------------------------------------------------------------------
// User Detail — ALL File 200 field groups per blueprint
// ---------------------------------------------------------------------------
async function renderUserDetail(el, userId) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/users">Users</a> › Detail</div><div class="loading-message">Loading user…</div>`;
  const res = await api(`users/${encodeURIComponent(userId)}`);
  if (!res.ok) { el.innerHTML = `<div class="error-message">User not found</div>`; return; }
  const u = res.data;
  const vg = u.vistaGrounding || {};
  const eSig = vg.electronicSignature || {};
  const eSigBadgeClass = eSig.status === 'active' ? 'badge-active' : eSig.status === 'revoked' ? 'badge-inactive' : 'badge-ungrounded';
  const roles = u.roles || [];
  const userStatus = u.status || 'active';

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/users">Users</a> › ${escapeHtml(u.name)}</div>
    <div class="page-header">
      <h1>${escapeHtml(u.name)}</h1>
      <span class="badge ${userStatus === 'active' ? 'badge-active' : 'badge-inactive'}">${escapeHtml(userStatus)}</span>
      ${sourceBadge(res.sourceStatus || res.source)}
    </div>
    <div class="detail-layout">
      <div class="detail-main">
        <!-- Section A: Identity -->
        <div class="detail-section">
          <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">▾</span> Identity</h2>
          <div class="collapsible-content">
            <dl>
              <div class="detail-row"><dt>Name (.01) ${tip('The user\'s full name as stored in VistA File 200. Format: LAST,FIRST MI. This is the primary identifier used throughout the system.')}</dt><dd>${escapeHtml(u.name || '—')}</dd></div>
              <div class="detail-row"><dt>DUZ (IEN) ${tip('Internal Entry Number - VistA\'s unique identifier for this user. Referenced by all clinical records, orders, and notes this user creates.')}</dt><dd>${vg.duz ?? u.ien ?? '—'}</dd></div>
              <div class="detail-row"><dt>Status ${tip('Whether this user account is active or disabled. Inactive users cannot log in but their records are preserved for audit trails.')}</dt><dd>${escapeHtml(userStatus)}</dd></div>
              <div class="detail-row"><dt>Title ${tip('The professional title displayed with the user\'s name (e.g., MD, RN, PharmD). Links to File 3.1 (Title). Used on printed reports and clinical documents.')}</dt><dd>${escapeHtml(u.title || '—')}</dd></div>
              <div class="detail-row"><dt>SSN (masked) ${tip('Social Security Number - masked for security. Used for identity verification. Only the last 4 digits are displayed.')}</dt><dd>${vg.ssn ? '***-**-' + escapeHtml(String(vg.ssn).slice(-4)) : '—'}</dd></div>
              <div class="detail-row"><dt>DOB ${tip('Date of birth. Used for identity verification and age calculations in clinical decision support.')}</dt><dd>${escapeHtml(vg.dob || '—')}</dd></div>
              <div class="detail-row"><dt>Sex ${tip('Biological sex. Used in clinical decision support rules (e.g., medication dosing, lab reference ranges).')}</dt><dd>${escapeHtml(vg.sex || '—')}</dd></div>
            </dl>
            <div style="margin-top:12px;border-top:1px solid #e2e8f0;padding-top:12px;">
              <h3 style="font-size:13px;margin-bottom:8px;">Edit Identity Fields</h3>
              <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;">
                <label style="font-size:12px;">Name (.01) ${tip('Rename this user. Must be LAST,FIRST format. VistA requires the comma separator.')}<br/><input type="text" id="ta-name-val" placeholder="LAST,FIRST" value="${escapeHtml(u.name || '')}" style="min-width:200px;" /></label>
                <button type="button" id="ta-name-save" class="btn-primary btn-sm">Save Name</button>
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;margin-top:8px;">
                <label style="font-size:12px;">Sex (field 4)<br/><select id="ta-sex-val" style="min-width:100px;">
                  <option value="">—</option><option value="M" ${vg.sex === 'M' ? 'selected' : ''}>Male</option><option value="F" ${vg.sex === 'F' ? 'selected' : ''}>Female</option>
                </select></label>
                <button type="button" id="ta-sex-save" class="btn-primary btn-sm">Save Sex</button>
                <label style="font-size:12px;margin-left:16px;">Title<br/><input type="text" id="ta-title-val" placeholder="e.g. MD, RN" value="${escapeHtml(u.title || '')}" style="min-width:120px;" /></label>
                <button type="button" id="ta-title-save" class="btn-primary btn-sm">Save Title</button>
              </div>
              <div id="ta-identity-msg" style="margin-top:6px;font-size:12px;"></div>
            </div>
          </div>
        </div>

        <!-- Section B: Contact -->
        <div class="detail-section">
          <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">▾</span> Contact Information</h2>
          <div class="collapsible-content">
            <dl>
              <div class="detail-row"><dt>Office Phone (.132) ${tip('Direct office phone number. Used by other staff to reach this user for clinical questions or consults.')}</dt><dd>${escapeHtml(vg.officePhone || '—')}</dd></div>
              <div class="detail-row"><dt>Voice Pager (.133) ${tip('Voice pager number. Legacy paging system - still used in many VA facilities for urgent clinical notifications.')}</dt><dd>${escapeHtml(vg.voicePager || '—')}</dd></div>
              <div class="detail-row"><dt>Digital Pager (.134) ${tip('Digital/numeric pager. Receives numeric messages. Used for on-call notifications and urgent alerts.')}</dt><dd>${escapeHtml(vg.digitalPager || '—')}</dd></div>
              <div class="detail-row"><dt>Email (.151) ${tip('Email address for MailMan messages and system notifications. Also used for password reset if configured.')}</dt><dd>${escapeHtml(vg.email || '—')}</dd></div>
            </dl>
            <div style="margin-top:12px;">
              <h3 style="font-size:13px;margin-bottom:8px;">Edit Contact Field</h3>
              <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;">
                <label style="font-size:12px;">Field<br/><select id="ta-uf-field" style="min-width:160px">
                  <option value=".132">.132 Office phone</option>
                  <option value=".133">.133 Voice pager</option>
                  <option value=".134">.134 Digital pager</option>
                  <option value=".151">.151 Email</option>
                </select></label>
                <label style="font-size:12px;">Value<br/><input type="text" id="ta-uf-value" style="min-width:200px" placeholder="New value" /></label>
                <button type="button" id="ta-uf-save" class="btn-primary btn-sm">Save</button>
              </div>
              <div id="ta-uf-msg" style="margin-top:6px;font-size:12px;"></div>
            </div>
          </div>
        </div>

        <!-- Section C: Provider Credentials -->
        <div class="detail-section">
          <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">▾</span> Provider Credentials</h2>
          <div class="collapsible-content">
            <div class="explanation-header" style="margin-bottom:12px;">
              Provider credentials are required for clinicians who write orders, prescribe medications, or sign clinical documents.
              These fields live in File 200 and related sub-files. NPI and DEA are critical for claims and controlled substance prescribing.
            </div>
            <dl>
              <div class="detail-row"><dt>Person Class ${tip('Healthcare provider classification (e.g., Physician/Allopathic, Registered Nurse). Determines what clinical actions this user can perform in VistA.')}</dt><dd>${escapeHtml(vg.personClass || '—')}</dd></div>
              <div class="detail-row"><dt>NPI ${tip('National Provider Identifier - a unique 10-digit number required by HIPAA for all healthcare providers. Used on insurance claims and prescriptions.')}</dt><dd>${escapeHtml(vg.npi || '—')}</dd></div>
              <div class="detail-row"><dt>DEA Number ${tip('Drug Enforcement Administration number. Required to prescribe controlled substances (Schedule II-V). Without this, the provider cannot order narcotics, benzodiazepines, etc.')}</dt><dd>${escapeHtml(vg.dea || '—')}</dd></div>
              <div class="detail-row"><dt>State License ${tip('State medical/nursing license number. Required for prescribing privileges. Must be kept current - expired licenses block ordering.')}</dt><dd>${escapeHtml(vg.stateLicense || '—')}</dd></div>
              <div class="detail-row"><dt>Provider Type ${tip('The provider classification (e.g., Staff Physician, Resident, PA). Controls ordering privileges and cosignature requirements.')}</dt><dd>${escapeHtml(vg.providerType || '—')}</dd></div>
              <div class="detail-row"><dt>Authorized to Write Meds ${tip('Whether this provider can write medication orders. Must be YES for physicians and authorized mid-levels. Requires the ORES security key.')}</dt><dd>${escapeHtml(vg.authMeds || '—')}</dd></div>
              <div class="detail-row"><dt>Pharmacy Schedules (CS 2-5) ${tip('Which DEA controlled substance schedules this provider can prescribe. Schedule II = highest restriction (opioids), Schedule V = lowest (cough syrups). Each schedule requires separate authorization.')}</dt><dd>${escapeHtml(vg.pharmSchedules || '—')}</dd></div>
            </dl>
            <div style="margin-top:12px;border-top:1px solid #e2e8f0;padding-top:12px;">
              <h3 style="font-size:13px;margin-bottom:6px;">Edit Provider Credential</h3>
              <p style="font-size:11px;color:var(--color-text-muted);margin-bottom:8px;">
                Provider fields are in File 200 sub-files. The ORES security key must be assigned before provider fields activate.
                NPI is 10 digits. DEA is required for controlled substance prescribing.
              </p>
              <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;">
                <label style="font-size:12px;">Field<br/><select id="ta-prov-field" style="min-width:180px;">
                  <option value="npi">NPI (10 digits)</option>
                  <option value="dea">DEA Number</option>
                  <option value="stateLicense">State License</option>
                  <option value="personClass">Person Class (8932.1)</option>
                  <option value="providerType">Provider Type</option>
                  <option value="authMeds">Authorized to Write Meds</option>
                  <option value="pharmSchedules">Pharmacy Schedules</option>
                </select></label>
                <div id="ta-prov-help" style="font-size:11px;color:var(--color-text-muted);margin:4px 0;min-height:18px;"></div>
                <label style="font-size:12px;">Value<br/><input type="text" id="ta-prov-value" placeholder="New value" style="min-width:200px;" /></label>
                <button type="button" id="ta-prov-save" class="btn-primary btn-sm">Save</button>
              </div>
              <div id="ta-prov-msg" style="margin-top:6px;font-size:12px;"></div>
            </div>
          </div>
        </div>

        <!-- Section D: Electronic Signature -->
        <div class="detail-section">
          <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">▾</span> Electronic Signature</h2>
          <div class="collapsible-content">
            <div class="explanation-header" style="margin-bottom:12px;">
              VistA e-signatures are <strong>typed text codes</strong> (like a secondary password), NOT graphical signatures.
              The code is hashed via <code>$$EN^XUSHSH</code> and stored in File 200 field 20.4.
              The Signature Block Printed Name + Title appear on every printed document, prescription, and order.
            </div>
            <dl>
              <div class="detail-row"><dt>E-Sig Status ${tip('Whether this user has a working electronic signature. Active = code is set and can sign documents. Revoked/Unknown = cannot sign orders or notes.')}</dt><dd><span class="badge ${eSigBadgeClass}">${escapeHtml(eSig.status || 'unknown')}</span></dd></div>
              <div class="detail-row"><dt>Has Code (20.4) ${tip('Whether an e-signature code has been set. The actual code is hashed and cannot be retrieved. If lost, it must be reset by an administrator.')}</dt><dd>${eSig.hasCode ? 'Yes (hashed)' : 'No — needs to be set'}</dd></div>
              <div class="detail-row"><dt>Initials (20.2) ${tip("The user's initials (e.g., JS). Appears on co-signature requests and some abbreviated displays.")}</dt><dd>${escapeHtml(vg.initials || '—')}</dd></div>
              <div class="detail-row"><dt>Sig Block Name (20.3) ${tip('The name printed on signed documents (e.g., JOHN SMITH). Appears on prescriptions, clinical notes, and orders when this user signs them.')}</dt><dd>${escapeHtml(eSig.sigBlockName || vg.sigBlockName || '—')}</dd></div>
              <div class="detail-row"><dt>Sig Block Title ${tip('Professional title printed after the name (e.g., MD, DO, RN, PharmD). Appears alongside the sig block name on all signed documents.')}</dt><dd>${escapeHtml(eSig.sigBlockTitle || vg.sigBlockTitle || '—')}</dd></div>
            </dl>
            <div style="margin-top:16px;border-top:1px solid #e2e8f0;padding-top:12px;">
              <h3 style="font-size:13px;margin-bottom:8px;">Edit Signature Block</h3>
              <p style="font-size:11px;color:var(--color-text-muted);margin-bottom:8px;">
                The Signature Block Name + Title appear on every printed document, prescription, and order (e.g. "JOHN SMITH, MD").
              </p>
              <div class="form-grid">
                <div><label>Initials (20.2) ${tip('2-4 character initials. Used in co-signature tracking.')}</label><input type="text" id="ta-esig-initials" placeholder="e.g. JS" maxlength="4" value="${escapeHtml(vg.initials || '')}" /></div>
                <div><label>Sig Block Printed Name (20.3) ${tip('Full name as it appears on signed documents and prescriptions.')}</label><input type="text" id="ta-esig-blockname" placeholder="e.g. JOHN SMITH" value="${escapeHtml(eSig.sigBlockName || vg.sigBlockName || '')}" /></div>
                <div><label>Sig Block Title (20.3p2) ${tip('Professional degree or title (MD, DO, RN, PA-C, PharmD).')}</label><input type="text" id="ta-esig-blocktitle" placeholder="e.g. MD, DO, RN, PA" value="${escapeHtml(eSig.sigBlockTitle || vg.sigBlockTitle || '')}" /></div>
              </div>
              <button type="button" id="ta-sigblock-save" class="btn-primary btn-sm" style="margin-top:8px;">Save Sig Block</button>
              <div id="ta-sigblock-msg" style="margin-top:6px;font-size:12px;"></div>
            </div>
            <div style="margin-top:16px;border-top:1px solid #e2e8f0;padding-top:12px;">
              <h3 style="font-size:13px;margin-bottom:8px;">Set / Clear E-Sig Code</h3>
              <p style="font-size:11px;color:var(--color-text-muted);margin-bottom:8px;">
                The e-sig code is a typed secret (like a secondary password). It is hashed via <code>$$EN^XUSHSH</code> and NEVER retrievable.
              </p>
              <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;">
                <label style="font-size:12px;">New E-Sig Code<br/><input type="password" id="ta-esig-code" placeholder="Secret code" style="min-width:200px;" /></label>
                <button type="button" id="ta-esig-save" class="btn-primary btn-sm">Set E-Sig</button>
                <button type="button" id="ta-esig-clear" class="btn btn-sm" style="color:#b91c1c;">Clear E-Sig</button>
              </div>
              <div id="ta-esig-msg" style="margin-top:6px;font-size:12px;"></div>
            </div>
          </div>
        </div>

        <!-- Section E: Security Keys -->
        <div class="detail-section">
          <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">▾</span> Security Keys (${roles.length})</h2>
          <div class="collapsible-content">
            <div>${roles.length ? roles.map(r => '<span class="badge badge-key" style="margin:2px">' + escapeHtml(r) + '</span>').join(' ') : '<span style="color:var(--color-text-muted)">No keys assigned</span>'}</div>
            <div style="margin-top:12px;display:flex;gap:8px;align-items:flex-end;">
              <label style="font-size:12px;">Key Name ${tip('VistA security keys control what menus and functions a user can access. Common keys: ORES (order entry), ORELSE (order release), PROVIDER (clinical provider), XUPROGMODE (programmer mode). Type the exact key name.')}<br/><input type="text" id="ta-key-name" style="min-width:180px" placeholder="e.g. XUPROGMODE" /></label>
              <button type="button" id="ta-key-add" class="btn-primary btn-sm">Assign</button>
              <button type="button" id="ta-key-del" class="btn btn-sm">Remove</button>
            </div>
            <div id="ta-key-msg" style="margin-top:6px;font-size:12px;"></div>
          </div>
        </div>

        <!-- Section F: Menu & Division -->
        <div class="detail-section">
          <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">▾</span> Menu &amp; Division</h2>
          <div class="collapsible-content">
            <dl>
              <div class="detail-row"><dt>Primary Menu (201)</dt><dd><code>${escapeHtml(vg.primaryMenuOption || '—')}</code></dd></div>
              <div class="detail-row"><dt>Secondary Menu Options</dt><dd>${(vg.secondaryMenus || []).length ? (vg.secondaryMenus || []).map(m => '<code style="margin:1px;">' + escapeHtml(m) + '</code>').join(', ') : '— <small>(multiple pointers to File 19)</small>'}</dd></div>
            </dl>
            <div style="margin-top:12px;border-top:1px solid #e2e8f0;padding-top:12px;">
              <h3 style="font-size:13px;margin-bottom:8px;">Edit Primary Menu</h3>
              <p style="font-size:11px;color:var(--color-text-muted);margin-bottom:6px;">
                Field 201 = Primary Menu Option (pointer to File 19). Common values:
                <code>XUCORE</code> (standard user), <code>EVE</code> (system manager), <code>XUPROG</code> (programmer).
              </p>
              <div style="display:flex;gap:8px;align-items:flex-end;">
                <label style="font-size:12px;">Menu Option Name<br/><input type="text" id="ta-menu-val" placeholder="e.g. XUCORE" style="min-width:180px;" /></label>
                <button type="button" id="ta-menu-save" class="btn-primary btn-sm">Save Menu</button>
              </div>
              <div id="ta-menu-msg" style="margin-top:6px;font-size:12px;"></div>
            </div>
          </div>
        </div>

        <!-- Section G: Division and Service -->
        <div class="detail-section">
          <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">▾</span> Division &amp; Service</h2>
          <div class="collapsible-content">
            <dl>
              <div class="detail-row"><dt>Division</dt><dd>${vg.division ? escapeHtml(vg.division.name) + ' (IEN ' + vg.division.ien + ')' : '—'} <small>(File 40.8 pointer)</small></dd></div>
              <div class="detail-row"><dt>Service/Section</dt><dd>${escapeHtml(vg.serviceSection || '—')} <small>(File 49 pointer)</small></dd></div>
            </dl>
            <div style="margin-top:12px;border-top:1px solid #e2e8f0;padding-top:12px;">
              <h3 style="font-size:13px;margin-bottom:8px;">Edit Division / Service</h3>
              <p style="font-size:11px;color:var(--color-text-muted);margin-bottom:8px;">
                These are pointer fields in File 200. Enter the IEN of the target division (File 40.8) or service (File 49).
                Use <code>DDR LISTER</code> on File 40.8 or File 49 to look up valid IENs.
              </p>
              <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;">
                <label style="font-size:12px;">Division IEN (File 40.8)<br/><input type="text" id="ta-div-val" placeholder="e.g. 1" style="min-width:120px;" value="${vg.division ? vg.division.ien || '' : ''}" /></label>
                <button type="button" id="ta-div-save" class="btn-primary btn-sm">Save Division</button>
                <label style="font-size:12px;margin-left:16px;">Service/Section (File 49)<br/><input type="text" id="ta-svc-val" placeholder="e.g. MEDICINE" style="min-width:160px;" value="${escapeHtml(vg.serviceSection || '')}" /></label>
                <button type="button" id="ta-svc-save" class="btn-primary btn-sm">Save Service</button>
              </div>
              <div id="ta-divsvc-msg" style="margin-top:6px;font-size:12px;"></div>
            </div>
          </div>
        </div>

        <!-- Section H: Credentials -->
        <div class="detail-section">
          <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">▾</span> Access / Verify Codes</h2>
          <div class="collapsible-content">
            <div style="display:flex;gap:8px;align-items:flex-end;">
              <label style="font-size:12px;">Access Code<br/><input type="text" id="ta-ac" placeholder="Access" style="min-width:120px;" /></label>
              <label style="font-size:12px;">Verify Code<br/><input type="password" id="ta-vc" placeholder="Verify" style="min-width:120px;" /></label>
              <button type="button" id="ta-cred-save" class="btn-primary btn-sm">Update</button>
            </div>
            <div id="ta-cred-msg" style="margin-top:6px;font-size:12px;"></div>
          </div>
        </div>

        <!-- Section I: Lifecycle -->
        <div class="detail-section">
          <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">▾</span> User Lifecycle</h2>
          <div class="collapsible-content">
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button type="button" id="ta-deact" class="btn">Deactivate User</button>
              <button type="button" id="ta-react" class="btn">Reactivate User</button>
              <button type="button" id="ta-term" class="btn" style="color:#991b1b;border-color:#991b1b;">Terminate User</button>
              <button type="button" id="ta-reset-ac" class="btn">Reset Access Code</button>
              <button type="button" id="ta-reset-vc" class="btn">Reset Verify Code</button>
            </div>
            <div id="ta-life-msg" style="margin-top:6px;font-size:12px;"></div>
          </div>
        </div>

        ${u.vistaFields && Object.keys(u.vistaFields).length ? `
        <div class="detail-section collapsed">
          <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">▾</span> Raw DDR GETS Fields</h2>
          <div class="collapsible-content">
            <pre style="font-size:11px;overflow:auto;max-height:200px;background:#f8fafc;padding:8px;border-radius:4px;">${escapeHtml(JSON.stringify(u.vistaFields, null, 2))}</pre>
          </div>
        </div>` : ''}
      </div>

      <aside class="context-rail">
        <div class="card">
          <div class="context-label">User</div><div class="context-value">${escapeHtml(u.name)}</div>
          <div class="context-label">DUZ</div><div class="context-value">${vg.duz ?? u.ien ?? '—'}</div>
          <div class="context-label">Status</div><div class="context-value"><span class="badge ${userStatus === 'active' ? 'badge-active' : 'badge-inactive'}">${escapeHtml(userStatus)}</span></div>
          <div class="context-divider"></div>
          <div class="context-label">E-Sig</div><div class="context-value"><span class="badge ${eSigBadgeClass}">${escapeHtml(eSig.status || 'unknown')}</span></div>
          <div class="context-label">Keys</div><div class="context-value">${roles.length} assigned</div>
          <div class="context-divider"></div>
          <div class="context-label">Source</div><div class="context-value">${sourceBadge(res.sourceStatus || res.source)}</div>
        </div>
      </aside>
    </div>`;

  wireUserDetailActions(el, userId);
}

function wireUserDetailActions(el, userId) {
  const nameSave = document.getElementById('ta-name-save');
  if (nameSave) nameSave.addEventListener('click', async () => {
    const val = (document.getElementById('ta-name-val') || {}).value || '';
    const msg = document.getElementById('ta-identity-msg');
    if (!val.trim()) { msg.textContent = 'Name required.'; msg.style.color = '#b91c1c'; return; }
    if (!val.includes(',')) { msg.textContent = 'Name must be LAST,FIRST format.'; msg.style.color = '#b91c1c'; return; }
    msg.textContent = 'Renaming…'; msg.style.color = '';
    const out = await apiPut(`users/${encodeURIComponent(userId)}/rename`, { newName: val.trim() });
    if (out.ok) {
      msg.textContent = 'Name updated. Reloading…'; msg.style.color = '#166534';
      setTimeout(() => { window.location.hash = `#/users/${encodeURIComponent(userId)}`; renderUserDetail(el, userId); }, 800);
    } else {
      msg.textContent = out.error || JSON.stringify(out); msg.style.color = '#b91c1c';
    }
  });
  const sexSave = document.getElementById('ta-sex-save');
  if (sexSave) sexSave.addEventListener('click', async () => {
    const val = document.getElementById('ta-sex-val').value;
    const msg = document.getElementById('ta-identity-msg');
    if (!val) { msg.textContent = 'Select M or F.'; msg.style.color = '#b91c1c'; return; }
    msg.textContent = 'Saving…'; msg.style.color = '';
    const out = await apiPut(`users/${encodeURIComponent(userId)}`, { field: '4', value: val });
    msg.textContent = out.ok ? 'Sex updated.' : (out.error || JSON.stringify(out));
    msg.style.color = out.ok ? '#166534' : '#b91c1c';
  });
  const titleSave = document.getElementById('ta-title-save');
  if (titleSave) titleSave.addEventListener('click', async () => {
    const val = (document.getElementById('ta-title-val') || {}).value || '';
    const msg = document.getElementById('ta-identity-msg');
    if (!val.trim()) { msg.textContent = 'Title required.'; msg.style.color = '#b91c1c'; return; }
    msg.textContent = 'Saving…'; msg.style.color = '';
    const out = await apiPost(`users/${encodeURIComponent(userId)}/provider`, { field: 'title', value: val.trim() });
    msg.textContent = out.ok ? 'Title updated.' : (out.error || JSON.stringify(out));
    msg.style.color = out.ok ? '#166534' : '#b91c1c';
  });

  const saveBtn = document.getElementById('ta-uf-save');
  if (saveBtn) saveBtn.addEventListener('click', async () => {
    const field = document.getElementById('ta-uf-field').value;
    const value = document.getElementById('ta-uf-value').value;
    const msg = document.getElementById('ta-uf-msg');
    msg.textContent = 'Saving…'; msg.style.color = '';
    const out = await apiPut(`users/${encodeURIComponent(userId)}`, { field, value });
    msg.textContent = out.ok ? 'Saved. RPC: ' + (out.rpcUsed || 'DDR FILER') : (out.error || JSON.stringify(out));
    msg.style.color = out.ok ? '#166534' : '#b91c1c';
  });

  const keyAdd = document.getElementById('ta-key-add');
  const keyDel = document.getElementById('ta-key-del');
  const keyMsg = document.getElementById('ta-key-msg');
  if (keyAdd) keyAdd.addEventListener('click', async () => {
    const keyName = (document.getElementById('ta-key-name') || {}).value || '';
    if (!keyName.trim()) { keyMsg.textContent = 'Enter key name'; keyMsg.style.color = '#b91c1c'; return; }
    keyMsg.textContent = 'Assigning…'; keyMsg.style.color = '';
    const out = await apiPost(`users/${encodeURIComponent(userId)}/keys`, { keyName: keyName.trim() });
    keyMsg.textContent = out.ok ? 'Key assigned.' : (out.error || JSON.stringify(out));
    keyMsg.style.color = out.ok ? '#166534' : '#b91c1c';
  });
  if (keyDel) keyDel.addEventListener('click', async () => {
    const keyName = (document.getElementById('ta-key-name') || {}).value || '';
    if (!keyName.trim()) { keyMsg.textContent = 'Enter key name'; keyMsg.style.color = '#b91c1c'; return; }
    if (!confirm('Remove key "' + keyName.trim() + '"?')) return;
    keyMsg.textContent = 'Removing…'; keyMsg.style.color = '';
    const out = await apiDelete(`users/${encodeURIComponent(userId)}/keys/${encodeURIComponent(keyName.trim())}`);
    keyMsg.textContent = out.ok ? 'Key removed.' : (out.error || JSON.stringify(out));
    keyMsg.style.color = out.ok ? '#166534' : '#b91c1c';
  });

  const PROV_TIPS = {
    npi: 'National Provider Identifier. Must be exactly 10 digits. Lookup at https://npiregistry.cms.hhs.gov/',
    dea: 'DEA registration number. Format: 2 letters + 7 digits. Required for controlled substance prescribing.',
    stateLicense: 'State medical/nursing license number. Must be current and valid for this provider to order.',
    personClass: 'Healthcare provider class from File 8932.1 (e.g., Physician/Allopathic, Registered Nurse).',
    providerType: 'Provider type classification (Staff, Resident, etc). Affects cosignature requirements.',
    authMeds: 'YES or NO. Whether this provider can write medication orders. Requires ORES key.',
    pharmSchedules: 'Comma-separated list of DEA schedules (2,2N,3,3N,4,5). Controls which controlled substances can be prescribed.',
  };
  const provFieldSel = document.getElementById('ta-prov-field');
  const provFieldHelp = document.getElementById('ta-prov-help');
  if (provFieldSel && provFieldHelp) {
    provFieldSel.addEventListener('change', () => { provFieldHelp.textContent = PROV_TIPS[provFieldSel.value] || ''; });
    provFieldHelp.textContent = PROV_TIPS[provFieldSel.value] || '';
  }

  const provSave = document.getElementById('ta-prov-save');
  if (provSave) provSave.addEventListener('click', async () => {
    const field = document.getElementById('ta-prov-field').value;
    const value = (document.getElementById('ta-prov-value') || {}).value || '';
    const msg = document.getElementById('ta-prov-msg');
    if (!value.trim()) { msg.textContent = 'Value required.'; msg.style.color = '#b91c1c'; return; }
    msg.textContent = 'Saving provider credential…'; msg.style.color = '';
    const out = await apiPost(`users/${encodeURIComponent(userId)}/provider`, { field, value: value.trim() });
    msg.textContent = out.ok ? 'Provider credential saved.' : (out.error || JSON.stringify(out));
    msg.style.color = out.ok ? '#166534' : '#b91c1c';
  });

  const sigBlockSave = document.getElementById('ta-sigblock-save');
  if (sigBlockSave) sigBlockSave.addEventListener('click', async () => {
    const initials = (document.getElementById('ta-esig-initials') || {}).value || '';
    const blockName = (document.getElementById('ta-esig-blockname') || {}).value || '';
    const msg = document.getElementById('ta-sigblock-msg');
    msg.textContent = 'Saving…'; msg.style.color = '';
    let errs = [];
    if (initials.trim()) {
      const out1 = await apiPut(`users/${encodeURIComponent(userId)}`, { field: '20.2', value: initials.trim() });
      if (!out1.ok) errs.push('Initials: ' + (out1.error || 'failed'));
    }
    if (blockName.trim()) {
      const out2 = await apiPut(`users/${encodeURIComponent(userId)}`, { field: '20.3', value: blockName.trim() });
      if (!out2.ok) errs.push('Sig Block Name: ' + (out2.error || 'failed'));
    }
    const blockTitle = (document.getElementById('ta-esig-blocktitle') || {}).value || '';
    if (blockTitle.trim()) {
      const out3 = await apiPost(`users/${encodeURIComponent(userId)}/provider`, { field: 'sigBlockTitle', value: blockTitle.trim() });
      if (!out3.ok) errs.push('Sig Block Title: ' + (out3.error || 'failed'));
    }
    msg.textContent = errs.length ? errs.join('; ') : 'Signature block saved.';
    msg.style.color = errs.length ? '#b91c1c' : '#166534';
  });

  const esigBtn = document.getElementById('ta-esig-save');
  if (esigBtn) esigBtn.addEventListener('click', async () => {
    const code = (document.getElementById('ta-esig-code') || {}).value || '';
    const msg = document.getElementById('ta-esig-msg');
    if (!code.trim()) { msg.textContent = 'Code required.'; msg.style.color = '#b91c1c'; return; }
    msg.textContent = 'Saving…'; msg.style.color = '';
    const out = await apiPost(`users/${encodeURIComponent(userId)}/esig`, { code });
    msg.textContent = out.ok ? 'E-sig updated.' : (out.error || JSON.stringify(out));
    msg.style.color = out.ok ? '#166534' : '#b91c1c';
  });

  const esigClear = document.getElementById('ta-esig-clear');
  if (esigClear) esigClear.addEventListener('click', async () => {
    if (!confirm('Clear this user\'s e-signature code? They will need to set a new one to sign documents.')) return;
    const msg = document.getElementById('ta-esig-msg');
    msg.textContent = 'Clearing…'; msg.style.color = '';
    const out = await apiPut(`users/${encodeURIComponent(userId)}`, { field: '20.4', value: '' });
    msg.textContent = out.ok ? 'E-sig code cleared.' : (out.error || JSON.stringify(out));
    msg.style.color = out.ok ? '#166534' : '#b91c1c';
  });

  const menuSave = document.getElementById('ta-menu-save');
  if (menuSave) menuSave.addEventListener('click', async () => {
    const val = (document.getElementById('ta-menu-val') || {}).value || '';
    const msg = document.getElementById('ta-menu-msg');
    if (!val.trim()) { msg.textContent = 'Menu option name required.'; msg.style.color = '#b91c1c'; return; }
    if (!confirm('Set primary menu to "' + val.trim() + '"?')) return;
    msg.textContent = 'Saving…'; msg.style.color = '';
    const out = await apiPut(`users/${encodeURIComponent(userId)}`, { field: '201', value: val.trim() });
    msg.textContent = out.ok ? 'Menu updated.' : (out.error || JSON.stringify(out));
    msg.style.color = out.ok ? '#166534' : '#b91c1c';
  });

  const divSave = document.getElementById('ta-div-save');
  if (divSave) divSave.addEventListener('click', async () => {
    const val = (document.getElementById('ta-div-val') || {}).value || '';
    const msg = document.getElementById('ta-divsvc-msg');
    if (!val.trim()) { msg.textContent = 'Division IEN required.'; msg.style.color = '#b91c1c'; return; }
    msg.textContent = 'Saving…'; msg.style.color = '';
    const out = await apiPut(`users/${encodeURIComponent(userId)}`, { field: '16', value: val.trim() });
    msg.textContent = out.ok ? 'Division updated.' : (out.error || JSON.stringify(out));
    msg.style.color = out.ok ? '#166534' : '#b91c1c';
  });
  const svcSave = document.getElementById('ta-svc-save');
  if (svcSave) svcSave.addEventListener('click', async () => {
    const val = (document.getElementById('ta-svc-val') || {}).value || '';
    const msg = document.getElementById('ta-divsvc-msg');
    if (!val.trim()) { msg.textContent = 'Service/Section value required.'; msg.style.color = '#b91c1c'; return; }
    msg.textContent = 'Saving…'; msg.style.color = '';
    const out = await apiPut(`users/${encodeURIComponent(userId)}`, { field: '29', value: val.trim() });
    msg.textContent = out.ok ? 'Service updated.' : (out.error || JSON.stringify(out));
    msg.style.color = out.ok ? '#166534' : '#b91c1c';
  });

  const credBtn = document.getElementById('ta-cred-save');
  if (credBtn) credBtn.addEventListener('click', async () => {
    const ac = (document.getElementById('ta-ac') || {}).value || '';
    const vc = (document.getElementById('ta-vc') || {}).value || '';
    const msg = document.getElementById('ta-cred-msg');
    msg.textContent = 'Saving…'; msg.style.color = '';
    const out = await apiPut(`users/${encodeURIComponent(userId)}/credentials`, { accessCode: ac, verifyCode: vc });
    msg.textContent = out.ok ? 'Credentials updated.' : (out.error || JSON.stringify(out));
    msg.style.color = out.ok ? '#166534' : '#b91c1c';
  });

  const deact = document.getElementById('ta-deact');
  const react = document.getElementById('ta-react');
  const termBtn = document.getElementById('ta-term');
  const resetAc = document.getElementById('ta-reset-ac');
  const resetVc = document.getElementById('ta-reset-vc');
  const lifeMsg = document.getElementById('ta-life-msg');
  if (deact) deact.addEventListener('click', async () => {
    if (!confirm('Deactivate this user? They will no longer be able to log in.')) return;
    lifeMsg.textContent = 'Deactivating…'; lifeMsg.style.color = '';
    const out = await apiPost(`users/${encodeURIComponent(userId)}/deactivate`, {});
    lifeMsg.textContent = out.ok ? 'Deactivated.' : (out.error || JSON.stringify(out));
    lifeMsg.style.color = out.ok ? '#166534' : '#b91c1c';
  });
  if (react) react.addEventListener('click', async () => {
    if (!confirm('Reactivate this user?')) return;
    lifeMsg.textContent = 'Reactivating…'; lifeMsg.style.color = '';
    const out = await apiPost(`users/${encodeURIComponent(userId)}/reactivate`, {});
    lifeMsg.textContent = out.ok ? 'Reactivated.' : (out.error || JSON.stringify(out));
    lifeMsg.style.color = out.ok ? '#166534' : '#b91c1c';
  });
  if (termBtn) termBtn.addEventListener('click', async () => {
    if (!confirm('TERMINATE this user? This sets DISUSER, termination date, and clears the access code. This is more severe than deactivation.')) return;
    lifeMsg.textContent = 'Terminating…'; lifeMsg.style.color = '';
    const out = await apiPost(`users/${encodeURIComponent(userId)}/terminate`, {});
    lifeMsg.textContent = out.ok ? 'User terminated.' : (out.error || JSON.stringify(out));
    lifeMsg.style.color = out.ok ? '#166534' : '#b91c1c';
  });
  if (resetAc) resetAc.addEventListener('click', async () => {
    const newAc = prompt('Enter new Access Code (6-20 chars):');
    if (!newAc || !newAc.trim()) return;
    lifeMsg.textContent = 'Resetting Access Code…'; lifeMsg.style.color = '';
    const out = await apiPut(`users/${encodeURIComponent(userId)}/credentials`, { accessCode: newAc.trim() });
    lifeMsg.textContent = out.ok ? 'Access code reset.' : (out.error || JSON.stringify(out));
    lifeMsg.style.color = out.ok ? '#166534' : '#b91c1c';
  });
  if (resetVc) resetVc.addEventListener('click', async () => {
    const newVc = prompt('Enter new Verify Code (6-20 chars):');
    if (!newVc || !newVc.trim()) return;
    lifeMsg.textContent = 'Resetting Verify Code…'; lifeMsg.style.color = '';
    const out = await apiPut(`users/${encodeURIComponent(userId)}/credentials`, { verifyCode: newVc.trim() });
    lifeMsg.textContent = out.ok ? 'Verify code reset.' : (out.error || JSON.stringify(out));
    lifeMsg.style.color = out.ok ? '#166534' : '#b91c1c';
  });
}

// ---------------------------------------------------------------------------
// Role Assignment (Security Keys)
// ---------------------------------------------------------------------------
async function renderRoleAssignment(el) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Users &amp; Access › Security Keys</div>
    <div class="page-header"><h1>Security Keys (Roles)</h1></div><div class="loading-message">Loading…</div>`;
  const res = await api('roles');
  if (!res.ok) { el.innerHTML = `<div class="error-message">Failed to load roles</div>`; return; }
  const roles = res.data;

  function renderRows(list) {
    if (!list.length) return '<tr><td colspan="3" style="text-align:center;color:var(--color-text-muted)">No matching keys</td></tr>';
    return list.map(r => `<tr>
      <td><span class="badge badge-key">${escapeHtml(r.name)}</span></td>
      <td>${escapeHtml(r.description || '—')}</td>
      <td>${(r.vistaGrounding || {}).file19_1Ien ? 'IEN ' + (r.vistaGrounding || {}).file19_1Ien : '—'}</td>
    </tr>`).join('');
  }

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Users &amp; Access › Security Keys</div>
    <div class="page-header"><h1>Security Keys (Roles)</h1>${sourceBadge(res.sourceStatus || res.source)}</div>
    <div class="explanation-header">
      <strong>What are security keys?</strong> VistA security keys (File 19.1) control access to menu options, RPCs, and features.
      Common keys: <code>PROVIDER</code>, <code>ORES</code> (order entry), <code>XUPROGMODE</code> (programmer mode).
      Keys are assigned to users in File 200 field 51.
    </div>
    <div class="filter-rail">
      <input type="text" id="role-search" placeholder="Search keys…" />
      <span class="result-count" id="role-count">Showing ${roles.length} of ${roles.length}</span>
    </div>
    <table class="data-table">
      <thead><tr><th>Key Name</th><th>Description</th><th>File 19.1</th></tr></thead>
      <tbody id="role-tbody">${renderRows(roles)}</tbody>
    </table>`;

  document.getElementById('role-search').addEventListener('input', () => {
    const q = (document.getElementById('role-search').value || '').toLowerCase();
    const filtered = roles.filter(r => r.name.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q));
    document.getElementById('role-tbody').innerHTML = renderRows(filtered);
    document.getElementById('role-count').textContent = `Showing ${filtered.length} of ${roles.length}`;
  });
}

// ---------------------------------------------------------------------------
// Facility List
// ---------------------------------------------------------------------------
async function renderFacilityList(el) {
  el.innerHTML = `<div class="page-header"><h1>Facility List</h1></div><div class="loading-message">Loading…</div>`;
  const res = await api('facilities');
  if (!res.ok) { el.innerHTML = `<div class="error-message">Failed to load facilities</div>`; return; }
  const facilities = res.data;

  function renderTree(items, indent) {
    return items.map(f => {
      const indentClass = indent > 0 ? ` tree-indent-${Math.min(indent, 2)}` : '';
      const childHtml = f.children && f.children.length ? renderTree(f.children, indent + 1) : '';
      return `<li class="${indentClass}">
        <a href="#/facilities/${encodeURIComponent(f.id || f.ien || 'unknown')}">${escapeHtml(f.name)}</a>
        <span class="tree-type">${escapeHtml(f.type || '—')}</span>
        <span class="badge ${(f.status || 'active') === 'active' ? 'badge-active' : 'badge-inactive'}" style="margin-left:4px">${escapeHtml(f.status || 'active')}</span>
      </li>${childHtml}`;
    }).join('');
  }

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Facilities &amp; Locations</div>
    <div class="page-header"><h1>Facility List</h1>${sourceBadge(res.sourceStatus || res.source)}</div>
    <div class="explanation-header">
      <strong>VistA Facility Hierarchy (Files 4, 40.8, 44, 42)</strong>
      Institutions → Divisions → Clinics/Wards. File 4 stores institutions, File 40.8 divisions,
      File 44 hospital locations (clinics), File 42 ward locations.
    </div>
    <div class="filter-rail"><input type="text" id="fac-search" placeholder="Search…" /></div>
    <div class="detail-section">
      <h2>Facility Hierarchy</h2>
      <ul class="facility-tree" id="fac-tree">${renderTree(facilities, 0)}</ul>
    </div>`;

  document.getElementById('fac-search').addEventListener('input', () => {
    const q = (document.getElementById('fac-search').value || '').toLowerCase();
    document.querySelectorAll('#fac-tree li').forEach(li => {
      const name = (li.querySelector('a') || {}).textContent || '';
      li.style.display = !q || name.toLowerCase().includes(q) ? '' : 'none';
    });
  });
}

// ---------------------------------------------------------------------------
// Facility Detail
// ---------------------------------------------------------------------------
async function renderFacilityDetail(el, facId) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/facilities">Facilities</a> › Detail</div><div class="loading-message">Loading…</div>`;
  const detailRes = await api(`facilities/${encodeURIComponent(facId)}`);
  let res, f;
  if (detailRes.ok) { res = detailRes; f = detailRes.data; }
  else {
    res = await api('facilities');
    if (!res.ok) { el.innerHTML = `<div class="error-message">Failed to load</div>`; return; }
    function find(items, id) { for (const i of items) { if (i.id === id) return i; if (i.children) { const c = find(i.children, id); if (c) return c; } } return null; }
    f = find(res.data, facId);
  }
  if (!f) { el.innerHTML = `<div class="error-message">Facility not found</div>`; return; }

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/facilities">Facilities</a> › ${escapeHtml(f.name)}</div>
    <div class="page-header"><h1>${escapeHtml(f.name)}</h1>
      <span class="badge ${(f.status || 'active') === 'active' ? 'badge-active' : 'badge-inactive'}">${escapeHtml(f.status || 'active')}</span>
      ${sourceBadge(res.sourceStatus || res.source)}
    </div>
    <div class="detail-section">
      <h2>Identity (File 4 — INSTITUTION)</h2>
      <dl>
        <div class="detail-row"><dt>Name</dt><dd>${escapeHtml(f.name || '—')}</dd></div>
        <div class="detail-row"><dt>Type</dt><dd>${escapeHtml(f.type || '—')}</dd></div>
        <div class="detail-row"><dt>Status</dt><dd>${escapeHtml(f.status || 'active')}</dd></div>
        ${f.stationNumber ? `<div class="detail-row"><dt>Station Number</dt><dd>${escapeHtml(f.stationNumber)}</dd></div>` : ''}
        ${f.facilityType ? `<div class="detail-row"><dt>Facility Type</dt><dd>${escapeHtml(f.facilityType)}</dd></div>` : ''}
      </dl>
    </div>
    <div class="detail-section">
      <h2>Address &amp; Contact</h2>
      <dl>
        <div class="detail-row"><dt>Street Address</dt><dd>${escapeHtml(f.streetAddress || f.address || '—')}</dd></div>
        <div class="detail-row"><dt>City</dt><dd>${escapeHtml(f.city || '—')}</dd></div>
        <div class="detail-row"><dt>State</dt><dd>${escapeHtml(f.state || '—')} <small>(File 5 pointer)</small></dd></div>
        <div class="detail-row"><dt>Zip Code</dt><dd>${escapeHtml(f.zipCode || f.zip || '—')}</dd></div>
        <div class="detail-row"><dt>Phone</dt><dd>${escapeHtml(f.phone || f.telephone || '—')}</dd></div>
      </dl>
      <p style="font-size:11px;color:var(--color-text-muted);margin-top:8px;">
        Address fields are read from File 4 (INSTITUTION) via DDR GETS. Editing requires DDR FILER on File 4.
      </p>
    </div>
    ${f.children && f.children.length ? `<div class="detail-section"><h2>Children</h2>
      <ul class="facility-tree">${f.children.map(c => `<li><a href="#/facilities/${encodeURIComponent(c.id)}">${escapeHtml(c.name)}</a> <span class="tree-type">${escapeHtml(c.type)}</span></li>`).join('')}</ul></div>` : ''}`;
}

// ---------------------------------------------------------------------------
// Clinic List
// ---------------------------------------------------------------------------
async function renderClinicList(el) {
  el.innerHTML = `<div class="page-header"><h1>Clinics</h1></div><div class="loading-message">Loading…</div>`;
  const res = await api('clinics');
  if (!res.ok) { el.innerHTML = `<div class="error-message">Failed to load clinics</div>`; return; }
  const clinics = res.data || [];

  function rows(list) {
    if (!list.length) return '<tr><td colspan="6">No clinics</td></tr>';
    return list.map(c => {
      const inactive = c.inactivateDate && c.inactivateDate !== '';
      const status = inactive ? 'inactive' : 'active';
      return `<tr>
      <td><a href="#/clinics/${encodeURIComponent(c.ien || c.file44Ien || '')}">${escapeHtml(c.name)}</a></td>
      <td>${escapeHtml(c.abbreviation || '—')}</td>
      <td>${c.stopCode ? escapeHtml(String(c.stopCode)) : '—'}</td>
      <td>${c.apptLength ? escapeHtml(String(c.apptLength)) + ' min' : (c.defaultSlotLength ? escapeHtml(String(c.defaultSlotLength)) + ' min' : '—')}</td>
      <td><span class="badge ${status === 'active' ? 'badge-active' : 'badge-inactive'}">${status.toUpperCase()}</span></td>
    </tr>`;
    }).join('');
  }

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Facilities &amp; Locations › Clinics</div>
    <div class="page-header"><h1>Clinics (File 44)</h1>${sourceBadge(res.sourceStatus || res.source)}</div>
    <div class="explanation-header">
      <strong>Clinic Setup (File 44 — HOSPITAL LOCATION)</strong>
      Clinics are where outpatient care happens. Each clinic has scheduling configuration, stop codes for workload,
      availability patterns, and provider assignments. Read via <code>DDR LISTER</code> (File 44), add via <code>ZVE CLNM ADD</code>.
    </div>
    <div class="filter-rail">
      <input type="text" id="clinic-search" placeholder="Search clinics…" />
      <span class="result-count" id="clinic-count">Showing ${clinics.length} of ${clinics.length}</span>
    </div>
    <table class="data-table">
      <thead><tr><th>Clinic</th><th>Abbreviation</th><th>Stop Code</th><th>Slot</th><th>Status</th></tr></thead>
      <tbody id="clinic-tbody">${rows(clinics)}</tbody>
    </table>
    <div class="detail-section" style="margin-top:16px;">
      <h2>Add Clinic</h2>
      <p style="font-size:12px;color:var(--color-text-muted);margin-bottom:8px;">Creates in File 44 via <code>ZVE CLNM ADD</code>.</p>
      <div style="display:flex;gap:8px;align-items:flex-end;">
        <label style="font-size:12px;">Clinic Name<br/><input type="text" id="clinic-add-name" placeholder="e.g. CARDIOLOGY" style="min-width:220px;" /></label>
        <button type="button" class="btn-primary" id="clinic-add-btn">Add Clinic</button>
      </div>
      <div id="clinic-add-msg" style="margin-top:8px;font-size:12px;"></div>
    </div>`;

  document.getElementById('clinic-search').addEventListener('input', () => {
    const q = (document.getElementById('clinic-search').value || '').toLowerCase();
    const filtered = clinics.filter(c => c.name.toLowerCase().includes(q));
    document.getElementById('clinic-tbody').innerHTML = rows(filtered);
    document.getElementById('clinic-count').textContent = `Showing ${filtered.length} of ${clinics.length}`;
  });

  document.getElementById('clinic-add-btn').addEventListener('click', async () => {
    const name = (document.getElementById('clinic-add-name') || {}).value || '';
    const msg = document.getElementById('clinic-add-msg');
    if (!name.trim()) { msg.textContent = 'Name required.'; msg.style.color = '#b91c1c'; return; }
    msg.textContent = 'Creating…'; msg.style.color = '';
    const out = await apiPost('clinics', { name: name.trim() });
    if (out.ok) { msg.textContent = 'Created. Refreshing…'; msg.style.color = '#166534'; setTimeout(() => renderClinicList(el), 1000); }
    else { msg.textContent = out.error || JSON.stringify(out); msg.style.color = '#b91c1c'; }
  });
}

// ---------------------------------------------------------------------------
// Clinic Detail — ALL File 44 fields per blueprint (5 sections)
// ---------------------------------------------------------------------------
async function renderClinicDetail(el, clinicIen) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/clinics">Clinics</a> › Clinic ${escapeHtml(clinicIen)}</div><div class="loading-message">Loading clinic from VistA…</div>`;
  const res = await api(`clinics/${encodeURIComponent(clinicIen)}`);
  const d = (res.ok && res.data) ? res.data : {};
  const badge = sourceBadge(res.ok ? (res.source || 'vista') : 'integration-pending');
  const v = (f) => escapeHtml(d[f] || '—');

  const FIELD_LABELS = {
    '.01': 'Clinic Name', '2': 'Abbreviation', '8': 'Stop Code Number',
    '16': 'Default Provider', '1912': 'Length of Appointment (min)',
    '1913': 'Variable Appointment Length', '1914': 'Hour Clinic Display Begins',
    '1917': 'Display Increments Per Hour', '1918': 'Overbooks/Day Maximum',
    '1918.5': 'Schedule on Holidays', '1920': 'Allowable Consecutive No-Shows',
    '2002': 'Max Days for Future Booking', '2503': 'Credit Stop Code',
  };
  const CT = {
    '.01': 'The official name of this clinic as it appears in appointment lists, patient records, and reports. Must be unique within the facility.',
    '2': 'Short code for this clinic (e.g., CARD for Cardiology). Appears in compact schedule views and printed appointment slips.',
    '3': 'The medical service this clinic belongs to (e.g., Medicine, Surgery). Links to File 49. Used for workload tracking and staffing reports.',
    '8': 'DSS Stop Code - a national VA workload code that identifies the type of care. Example: 323 = Primary Care, 407 = Cardiology. Required for VA workload reporting.',
    '2503': 'Credit Stop Code - the secondary workload code that pairs with the primary stop code. Used for dual-credit workload counting.',
    '4': 'Building name, floor, and room number. Helps patients find the clinic.',
    '9': 'Direct phone number for this clinic. Shown to patients on appointment reminders.',
    '16': 'The provider automatically assigned to new appointments in this clinic. Can be overridden per appointment.',
    '1': 'If YES, visits to this clinic do not count as clinic stops for workload. Used for phone clinics, group notes, etc.',
    '1912': 'How long each appointment slot lasts in minutes (e.g., 30 = half hour). This determines how many patients can be seen per day.',
    '1913': 'If YES, different appointment types can have different lengths. Example: new patient = 60 min, follow-up = 30 min.',
    '1914': 'The earliest time shown on the scheduling grid (e.g., 8 = 8:00 AM). Appointments before this time are hidden in the default view.',
    '1917': 'How many time slots to show per hour on the scheduling grid. 4 = every 15 min, 2 = every 30 min. Must match appointment length.',
    '1918.5': 'Whether scheduling is allowed on federal holidays. Default is NO -- most clinics are closed on holidays.',
    '1918': 'Maximum number of overbooked appointments allowed per day. Example: 2 means the clinic can accept 2 extra patients beyond capacity.',
    '2002': 'How far into the future appointments can be booked (in days). Example: 365 = one year. Prevents scheduling too far ahead.',
    '1920': 'After this many consecutive no-shows, the patient may need supervisor approval to rebook. 0 = no limit.',
  };

  const TABS = [
    { id: 'general', label: 'General' },
    { id: 'scheduling', label: 'Scheduling' },
    { id: 'availability', label: 'Availability' },
    { id: 'letters', label: 'Letters & Forms' },
    { id: 'advanced', label: 'Advanced' },
    { id: 'edit', label: 'Edit' },
    { id: 'raw', label: 'Raw DDR' },
  ];

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/clinics">Clinics</a> › ${v('.01')}</div>
    <div class="page-header"><h1>${v('.01')}</h1>${badge}<span class="status-badge active">ACTIVE</span></div>

    ${renderTabBar(TABS, 'general')}

    <div class="tab-content active" data-tab="general">
      <dl>
        <div class="detail-row"><dt>Clinic Name (.01) ${tip(CT['.01'])}</dt><dd>${v('.01')}</dd></div>
        <div class="detail-row"><dt>Abbreviation (2) ${tip(CT['2'])}</dt><dd>${v('2')}</dd></div>
        <div class="detail-row"><dt>Service ${tip(CT['3'])}</dt><dd>${v('3')}</dd></div>
        <div class="detail-row"><dt>Stop Code (8) ${tip(CT['8'])}</dt><dd>${v('8')}</dd></div>
        <div class="detail-row"><dt>Credit Stop Code ${tip(CT['2503'])}</dt><dd>${v('2503')}</dd></div>
        <div class="detail-row"><dt>Physical Location ${tip(CT['4'])}</dt><dd>${v('4')}</dd></div>
        <div class="detail-row"><dt>Telephone ${tip(CT['9'])}</dt><dd>${v('9')}</dd></div>
        <div class="detail-row"><dt>Default Provider ${tip(CT['16'])}</dt><dd>${v('16')}</dd></div>
        <div class="detail-row"><dt>Non-Count Clinic ${tip(CT['1'])}</dt><dd>${v('1')}</dd></div>
        <div class="detail-row"><dt>Inactivate Date (2505) ${tip("Date this clinic was inactivated. Blank = active. Set a date to stop scheduling.")}</dt><dd>${v('2505') || '<span class="status-badge active">ACTIVE</span>'}</dd></div>
        <div class="detail-row"><dt>IEN ${tip("Internal Entry Number -- VistA unique ID for this clinic in File 44.")}</dt><dd>${escapeHtml(clinicIen)}</dd></div>
      </dl>
      ${renderInactivateButton('clinics', clinicIen, !d['2505'])}
    </div>

    <div class="tab-content" data-tab="scheduling">
      <dl>
        <div class="detail-row"><dt>Length of Appointment (1912) ${tip(CT['1912'])}</dt><dd>${v('1912')} ${d['1912'] ? 'minutes' : ''}</dd></div>
        <div class="detail-row"><dt>Variable Appointment Length (1913) ${tip(CT['1913'])}</dt><dd>${v('1913')}</dd></div>
        <div class="detail-row"><dt>Hour Clinic Display Begins (1914) ${tip(CT['1914'])}</dt><dd>${v('1914')}</dd></div>
        <div class="detail-row"><dt>Display Increments Per Hour (1917) ${tip(CT['1917'])}</dt><dd>${v('1917')}</dd></div>
        <div class="detail-row"><dt>Schedule on Holidays (1918.5) ${tip(CT['1918.5'])}</dt><dd>${v('1918.5')}</dd></div>
        <div class="detail-row"><dt>Overbooks/Day Maximum (1918) ${tip(CT['1918'])}</dt><dd>${v('1918')}</dd></div>
        <div class="detail-row"><dt>Max Days for Future Booking (2002) ${tip(CT['2002'])}</dt><dd>${v('2002')}</dd></div>
        <div class="detail-row"><dt>Allowable Consecutive No-Shows ${tip(CT['1920'])}</dt><dd>${v('1920') || '—'}</dd></div>
      </dl>
    </div>

    <div class="tab-content" data-tab="availability">
      <div class="explanation-header" style="margin-bottom:12px;">
        In VistA terminal, <code>SDBUILD</code> defines weekly time slots. The calendar below loads
        from <code>ZVE CLINIC AVAIL GET</code> RPC or shows integration-pending if the routine is not installed.
      </div>
      <div id="clinic-avail-grid">
        <div class="loading-message">Loading availability...</div>
      </div>
    </div>

    <div class="tab-content" data-tab="letters">
      <dl>
        <div class="detail-row"><dt>No-Show Letter ${tip("Letter sent when patient misses appointment. Template selected per clinic.")}</dt><dd>-- <small>(template selection)</small></dd></div>
        <div class="detail-row"><dt>Pre-Appointment Letter ${tip("Reminder letter sent before scheduled visit. Contains date, time, preparation instructions.")}</dt><dd>-- <small>(template selection)</small></dd></div>
        <div class="detail-row"><dt>Clinic Cancellation Letter ${tip("Letter sent when the clinic cancels an appointment. Different from patient cancellation.")}</dt><dd>-- <small>(template selection)</small></dd></div>
        <div class="detail-row"><dt>Appointment Cancellation Letter ${tip("Letter sent when patient requests cancellation of their appointment.")}</dt><dd>-- <small>(template selection)</small></dd></div>
        <div class="detail-row"><dt>Encounter Form ${tip("The encounter form template attached to this clinic for workload capture at checkout.")}</dt><dd>-- <small>(attached form)</small></dd></div>
      </dl>
    </div>

    <div class="tab-content" data-tab="advanced">
      <dl>
        <div class="detail-row"><dt>Prohibit Access to Clinic ${tip("If YES, no new appointments can be scheduled. Used to close a clinic temporarily.")}</dt><dd>--</dd></div>
        <div class="detail-row"><dt>Require X-Ray Films ${tip("If YES, radiology films must be available at check-in. Applies to radiology reading clinics.")}</dt><dd>--</dd></div>
        <div class="detail-row"><dt>Require Action Profiles ${tip("If YES, action profiles are required before appointment is checked out.")}</dt><dd>--</dd></div>
        <div class="detail-row"><dt>Ask for Check In/Out Time ${tip("Whether the system prompts for actual check-in/check-out times vs. using scheduled time.")}</dt><dd>--</dd></div>
        <div class="detail-row"><dt>Workload Validation at Checkout ${tip("If YES, requires CPT codes and diagnosis before checkout completes.")}</dt><dd>--</dd></div>
        <div class="detail-row"><dt>Administer Inpatient Meds ${tip("If YES, this outpatient clinic can administer inpatient medications (infusion clinics).")}</dt><dd>--</dd></div>
        <div class="detail-row"><dt>Inactivate Date (2505) ${tip("Date the clinic became inactive. Set this to close a clinic permanently.")}</dt><dd>${v('2505') || '--'}</dd></div>
      </dl>
    </div>

    <div class="tab-content" data-tab="edit">
      <p style="font-size:12px;color:var(--color-text-muted);margin-bottom:8px;">Write to File 44 via DDR VALIDATOR + DDR FILER. Select a field to see a description of what it controls.</p>
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;">
        <label style="font-size:12px;">Field<br/><select id="clinic-edit-field" style="min-width:220px;">
          ${Object.entries(FIELD_LABELS).map(([k,l]) => `<option value="${k}">${k} - ${l}</option>`).join('')}
        </select></label>
        <label style="font-size:12px;">Value<br/><input type="text" id="clinic-edit-value" placeholder="New value" style="min-width:200px;" /></label>
        <button type="button" class="btn-primary btn-sm" id="clinic-edit-save">Save to VistA</button>
      </div>
      <div id="clinic-edit-help" style="font-size:11px;color:var(--color-text-muted);margin-top:6px;min-height:18px;"></div>
      <div id="clinic-edit-msg" style="margin-top:8px;font-size:12px;"></div>
    </div>

    ${renderRawTab(d)}`;

  wireTabBar(el);
  wireInactivateButton('clinics', clinicIen, !d['2505'], () => renderClinicDetail(el, clinicIen));

  (async () => {
    const grid = document.getElementById('clinic-avail-grid');
    if (!grid) return;
    const avail = await api(`clinics/${encodeURIComponent(clinicIen)}/availability`);
    if (avail.integrationPending) {
      grid.innerHTML = `<span class="status-badge pending">INTEGRATION-PENDING</span>
        <p style="margin-top:8px;font-size:13px;color:var(--color-text-muted);">
          Requires <code>ZVECLAVL.m</code> M routine installed in VistA Docker. Run: <code>D INSTALL^ZVECLAVL</code>
        </p>`;
    } else if (!avail.ok || !avail.data || avail.data.length === 0) {
      const DAYS = ['Mon','Tue','Wed','Thu','Fri'];
      const HOURS = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00'];
      grid.innerHTML = `
        <p style="font-size:12px;color:var(--color-text-muted);margin-bottom:8px;">No availability slots defined yet. The grid below shows the weekly template.</p>
        <table class="data-table" style="font-size:12px;text-align:center;">
          <thead><tr><th></th>${DAYS.map(d=>`<th>${d}</th>`).join('')}</tr></thead>
          <tbody>${HOURS.map(h => `<tr><td style="font-weight:600;">${h}</td>${DAYS.map(()=>
            `<td style="background:#f1f5f9;cursor:pointer;" title="Click to add slot">--</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>`;
    } else {
      const rows = avail.data.map(s => `<tr><td>${escapeHtml(s.date)}</td><td>${escapeHtml(s.subIen)}</td><td>${escapeHtml(s.data)}</td></tr>`).join('');
      grid.innerHTML = `
        <table class="data-table" style="font-size:12px;">
          <thead><tr><th>Date</th><th>Slot#</th><th>Data</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    }
  })();

  const clinicFieldSel = document.getElementById('clinic-edit-field');
  const clinicFieldHelp = document.getElementById('clinic-edit-help');
  if (clinicFieldSel && clinicFieldHelp) {
    clinicFieldSel.addEventListener('change', () => { clinicFieldHelp.textContent = CT[clinicFieldSel.value] || ''; });
    clinicFieldHelp.textContent = CT[clinicFieldSel.value] || '';
  }

  const saveBtn = document.getElementById('clinic-edit-save');
  if (saveBtn) saveBtn.addEventListener('click', async () => {
    const field = document.getElementById('clinic-edit-field').value;
    const value = document.getElementById('clinic-edit-value').value;
    const msg = document.getElementById('clinic-edit-msg');
    if (!value.trim()) { msg.textContent = 'Value required.'; msg.style.color = '#b91c1c'; return; }
    if (!confirm('Update clinic field ' + field + '?')) return;
    msg.textContent = 'Saving…'; msg.style.color = '';
    const out = await apiPut(`clinics/${encodeURIComponent(clinicIen)}/fields`, { field, value });
    msg.textContent = out.ok ? 'Saved. Refresh to see updated value.' : (out.error || JSON.stringify(out));
    msg.style.color = out.ok ? '#166534' : '#b91c1c';
  });
}

// ---------------------------------------------------------------------------
// Ward List
// ---------------------------------------------------------------------------
async function renderWardList(el) {
  el.innerHTML = `<div class="page-header"><h1>Wards &amp; Beds</h1></div><div class="loading-message">Loading…</div>`;
  const res = await api('wards');
  if (!res.ok) { el.innerHTML = `<div class="error-message">Failed to load wards</div>`; return; }
  const wards = res.data || [];

  function rows(list) {
    return list.map(w => {
      const ien = w.ien || w.file42Ien || '';
      return `<tr>
        <td><a href="#/wards/${encodeURIComponent(ien)}">${escapeHtml(w.name)}</a></td>
        <td>${escapeHtml(w.wardGroup || '—')}</td>
        <td>${escapeHtml(w.bedSection || '—')}</td>
        <td>${escapeHtml(w.service || w.specialty || '—')}</td>
      </tr>`;
    }).join('');
  }

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Facilities &amp; Locations › Wards &amp; Beds</div>
    <div class="page-header"><h1>Wards &amp; Beds</h1>${sourceBadge(res.sourceStatus || res.source)}</div>
    <div class="explanation-header">
      <strong>Ward Configuration (File 42) &amp; Room-Bed Management (File 405.4)</strong>
      Wards are inpatient locations with assigned beds, treating specialties, and services.
      Read via <code>DDR LISTER</code> (File 42).
    </div>
    <div class="filter-rail">
      <input type="text" id="ward-search" placeholder="Search wards…" />
      <span class="result-count" id="ward-count">Showing ${wards.length} of ${wards.length}</span>
    </div>
    <table class="data-table">
      <thead><tr><th>Ward</th><th>Ward Group</th><th>Bed Section</th><th>Service</th></tr></thead>
      <tbody id="ward-tbody">${rows(wards)}</tbody>
    </table>
    <div class="detail-section collapsed" style="margin-top:16px;">
      <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">▾</span> Add Ward</h2>
      <div class="collapsible-content">
        <div style="display:flex;gap:8px;align-items:flex-end;">
          <label style="font-size:12px;">Ward Name<br/><input type="text" id="ward-add-name" placeholder="e.g. 3 NORTH" style="min-width:250px;" /></label>
          <button type="button" class="btn-primary btn-sm" id="ward-add-btn">Create Ward</button>
        </div>
        <div id="ward-add-msg" style="margin-top:8px;font-size:12px;"></div>
      </div>
    </div>`;

  document.getElementById('ward-search').addEventListener('input', () => {
    const q = (document.getElementById('ward-search').value || '').toLowerCase();
    const filtered = wards.filter(w => w.name.toLowerCase().includes(q) || (w.specialty || '').toLowerCase().includes(q));
    document.getElementById('ward-tbody').innerHTML = rows(filtered);
    document.getElementById('ward-count').textContent = `Showing ${filtered.length} of ${wards.length}`;
  });
  document.getElementById('ward-add-btn').addEventListener('click', async () => {
    const name = (document.getElementById('ward-add-name').value || '').trim();
    const msg = document.getElementById('ward-add-msg');
    if (!name) { msg.textContent = 'Ward name required.'; msg.style.color = '#b91c1c'; return; }
    if (!confirm('Create ward "' + name + '" in VistA File 42?')) return;
    msg.textContent = 'Creating...'; msg.style.color = '';
    const out = await apiPost('wards', { name });
    msg.textContent = out.ok ? 'Ward created via DDR FILER.' : (out.error || JSON.stringify(out));
    msg.style.color = out.ok ? '#166534' : '#b91c1c';
    if (out.ok) { document.getElementById('ward-add-name').value = ''; setTimeout(() => renderWardList(el), 1200); }
  });
}

// ---------------------------------------------------------------------------
// Ward Detail — File 42 fields per blueprint
// ---------------------------------------------------------------------------
async function renderWardDetail(el, wardIen) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/wards">Wards</a> › Ward ${escapeHtml(wardIen)}</div><div class="loading-message">Loading ward from VistA…</div>`;
  const res = await api(`wards/${encodeURIComponent(wardIen)}`);
  const d = (res.ok && res.data) ? res.data : {};
  const badge = sourceBadge(res.ok ? (res.source || 'vista') : 'integration-pending');
  const v = (f) => escapeHtml(d[f] || '—');

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/wards">Wards</a> › ${v('.01')}</div>
    <div class="page-header"><h1>${v('.01')}</h1>${badge}</div>
    <div class="explanation-header">
      <strong>Ward Configuration (File 42 — WARD LOCATION)</strong>
      Wards are inpatient care locations with assigned beds, treating specialties, and services.
      Read via <code>DDR GETS ENTRY DATA</code>, write via <code>DDR FILER</code>.
    </div>
    <div class="detail-section">
      <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">▾</span> Identity</h2>
      <div class="collapsible-content">
        <dl>
          <div class="detail-row"><dt>Ward Name (.01) ${tip('The official name of this inpatient ward (e.g., ICU, PSYCHIATRY, SURGERY). Appears on patient location displays and nursing reports.')}</dt><dd>${v('.01')}</dd></div>
          <div class="detail-row"><dt>Abbreviation (.015) ${tip('Short code for this ward (e.g., ICU, PSYCH). Used in compact displays like bed boards and movement reports.')}</dt><dd>${v('.015')}</dd></div>
          <div class="detail-row"><dt>Division ${tip('Which VA division (medical center) this ward belongs to. Links to File 40.8. Multi-division facilities have wards assigned to specific divisions.')}</dt><dd>${v('1')}</dd></div>
          <div class="detail-row"><dt>Treating Specialty (2) ${tip('The medical specialty for this ward (e.g., General Surgery, Psychiatry). Links to File 45.7. Used for workload counting, bed section reports, and care categorization.')}</dt><dd>${v('2')}</dd></div>
          <div class="detail-row"><dt>Service (3) ${tip('The administrative service this ward falls under (e.g., Medicine, Surgery, Psychiatry). Links to File 49. Used for staffing and budget allocation.')}</dt><dd>${v('3')}</dd></div>
          <div class="detail-row"><dt>Operating Beds (.1) ${tip('The number of beds currently staffed and available for patients. May be less than authorized beds during low-census periods.')}</dt><dd>${v('.1')}</dd></div>
          <div class="detail-row"><dt>Authorized Beds ${tip('The maximum number of beds this ward is approved to operate. Set by facility planning. Changing this requires administrative approval.')}</dt><dd>${v('.105')}</dd></div>
          <div class="detail-row"><dt>IEN ${tip('Internal Entry Number in File 42. Referenced by ADT movements, bed assignments, and workload reports.')}</dt><dd>${escapeHtml(wardIen)}</dd></div>
        </dl>
      </div>
    </div>
    <div class="detail-section">
      <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">▾</span> Beds (File 405.4)</h2>
      <div class="collapsible-content">
        <div class="explanation-header" style="margin-bottom:12px;">
          Room-beds are stored in File 405.4 (ROOM-BED). Each bed has a name, status (active/OOS), and room number.
          Bed listing requires DDR LISTER on File 405.4 filtered by this ward.
        </div>
        <p style="color:var(--color-text-muted);font-size:13px;">
          <span class="badge badge-pending">Bed list pending</span>
          Requires DDR LISTER on File 405.4 with ward filter.
        </p>
      </div>
    </div>
    <div class="detail-section">
      <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">&#9662;</span> Edit Ward Fields</h2>
      <div class="collapsible-content">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;max-width:500px;">
          <label style="font-size:12px;">Ward Name (.01) ${tip('Official ward name. Must be unique.')}<br/><input type="text" id="ward-edit-name" value="${v('.01')}" style="width:100%;" /></label>
          <label style="font-size:12px;">Abbreviation (.015) ${tip('Short code (e.g., ICU, PSYCH).')}<br/><input type="text" id="ward-edit-abbr" value="${v('.015')}" style="width:100%;" /></label>
          <label style="font-size:12px;">Operating Beds (.1) ${tip('Currently staffed beds. Must not exceed authorized beds.')}<br/><input type="text" id="ward-edit-beds" value="${v('.1')}" style="width:100%;" /></label>
          <label style="font-size:12px;">Bedsects (3) ${tip('Service/bedsection assignment for workload reporting.')}<br/><input type="text" id="ward-edit-bedsects" value="${v('3')}" style="width:100%;" /></label>
        </div>
        <div style="margin-top:12px;display:flex;gap:8px;">
          <button type="button" class="btn-primary btn-sm" id="ward-edit-save">Save to VistA</button>
          <button type="button" class="btn-sm" onclick="window.location.hash='#/wards'">Cancel</button>
        </div>
        <div id="ward-edit-msg" style="margin-top:8px;font-size:12px;"></div>
      </div>
    </div>
    ${res.ok && res.rawLines ? `
    <div class="detail-section collapsed">
      <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">&#9662;</span> Raw DDR GETS (File 42)</h2>
      <div class="collapsible-content">
        <pre style="font-size:11px;overflow:auto;max-height:200px;background:#f8fafc;padding:8px;border-radius:4px;">${escapeHtml(JSON.stringify(d, null, 2))}</pre>
      </div>
    </div>` : ''}`;

  const saveBtn = document.getElementById('ward-edit-save');
  if (saveBtn) saveBtn.addEventListener('click', async () => {
    const msg = document.getElementById('ward-edit-msg');
    const payload = {};
    const nameVal = (document.getElementById('ward-edit-name') || {}).value;
    const abbrVal = (document.getElementById('ward-edit-abbr') || {}).value;
    const bedsVal = (document.getElementById('ward-edit-beds') || {}).value;
    const bedsectsVal = (document.getElementById('ward-edit-bedsects') || {}).value;
    if (nameVal && nameVal !== v('.01')) payload.name = nameVal;
    if (abbrVal !== undefined) payload.division = abbrVal;
    if (bedsVal && bedsVal !== v('.1')) payload.wardLocation = bedsVal;
    if (bedsectsVal && bedsectsVal !== v('3')) payload.bedsects = bedsectsVal;
    if (Object.keys(payload).length === 0) { msg.textContent = 'No changes detected.'; msg.style.color = '#92400e'; return; }
    if (!confirm('Save changes to VistA?')) return;
    msg.textContent = 'Saving...'; msg.style.color = '';
    const out = await apiPut(`wards/${encodeURIComponent(wardIen)}/fields`, payload);
    msg.textContent = out.ok ? 'Saved successfully.' : (out.error || JSON.stringify(out));
    msg.style.color = out.ok ? '#166534' : '#b91c1c';
    if (out.ok) setTimeout(() => renderWardDetail(el, wardIen), 1000);
  });
}

// ---------------------------------------------------------------------------
// Device Detail — File 3.5 ALL fields per blueprint
// ---------------------------------------------------------------------------
async function renderDeviceDetail(el, devIen) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/devices">Devices</a> › Device ${escapeHtml(devIen)}</div><div class="loading-message">Loading device from VistA…</div>`;
  const res = await api(`devices/${encodeURIComponent(devIen)}`);
  const d = (res.ok && res.data) ? res.data : {};
  const badge = sourceBadge(res.ok ? (res.source || 'vista') : 'integration-pending');
  const v = (f) => escapeHtml(d[f] || '—');

  const FIELD_LABELS = {
    '.01': 'NAME', '1': '$I (IO SPECIFICATION)', '2': 'ASK DEVICE', '3': 'TYPE',
    '4': 'SUBTYPE', '5': 'LOCATION OF TERMINAL', '6': 'RIGHT MARGIN',
    '7': 'FORM FEED', '8': 'PAGE LENGTH', '9': 'CLOSE EXECUTE',
    '10': 'OPEN PARAMETERS', '11': 'CLOSE PARAMETERS', '50': 'OUT OF SERVICE',
  };

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/devices">Devices</a> › ${v('.01')}</div>
    <div class="page-header"><h1>${v('.01')}</h1>${badge}</div>
    <div class="explanation-header">
      <strong>Device Configuration (File 3.5 — DEVICE)</strong>
      Devices control how VistA sends output — to screens, printers, file queues, or specialized equipment.
      The <code>$I</code> field is the IO specification (platform-specific path).
      Common examples: <code>|PRN|BROTHER</code> (Windows printer), <code>(shell="/bin/sh":comm="lpr -P name")::"pipe"</code> (Linux pipe).
    </div>
    <div class="detail-section">
      <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">▾</span> Device Properties</h2>
      <div class="collapsible-content">
        <dl>
          <div class="detail-row"><dt>Name (.01)</dt><dd>${v('.01')}</dd></div>
          <div class="detail-row"><dt>$I — IO Specification (1)</dt><dd><code>${v('1')}</code></dd></div>
          <div class="detail-row"><dt>ASK DEVICE (2)</dt><dd>${v('2')}</dd></div>
          <div class="detail-row"><dt>Type (3)</dt><dd>${v('3')}</dd></div>
          <div class="detail-row"><dt>Subtype (4)</dt><dd>${v('4')} <small>(File 3.2 pointer)</small></dd></div>
          <div class="detail-row"><dt>Location (5)</dt><dd>${v('5')}</dd></div>
          <div class="detail-row"><dt>Right Margin (6)</dt><dd>${v('6')}</dd></div>
          <div class="detail-row"><dt>Form Feed (7)</dt><dd>${v('7')}</dd></div>
          <div class="detail-row"><dt>Page Length (8)</dt><dd>${v('8')}</dd></div>
          <div class="detail-row"><dt>Close Execute (9)</dt><dd>${v('9')}</dd></div>
          <div class="detail-row"><dt>Open Parameters (10)</dt><dd><code>${v('10')}</code></dd></div>
          <div class="detail-row"><dt>Close Parameters (11)</dt><dd><code>${v('11')}</code></dd></div>
          <div class="detail-row"><dt>Out of Service (50)</dt><dd>${v('50')}</dd></div>
          <div class="detail-row"><dt>IEN</dt><dd>${escapeHtml(devIen)}</dd></div>
        </dl>
      </div>
    </div>
    <div class="detail-section">
      <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">▾</span> IO Specification Help</h2>
      <div class="collapsible-content">
        <div class="explanation-header">
          <strong>$I examples by platform:</strong><br/>
          <code>|PRN|BROTHER</code> — Windows printer<br/>
          <code>|PRN|\\\\PRINT-SERVER\\PrinterName</code> — Windows network printer<br/>
          <code>(shell="/bin/sh":comm="lpr -l -P PHAR-IP-DM")::"pipe"</code> — Linux pipe to lpr<br/>
          <code>|TCP|101092252</code> — IP direct (port in Open Parameters)<br/>
          Docker: Depends on container networking and volume mounts.
        </div>
      </div>
    </div>
    <div class="detail-section">
      <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">▾</span> Edit Device Field</h2>
      <div class="collapsible-content">
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;">
          <label style="font-size:12px;">Field<br/><select id="dev-edit-field" style="min-width:220px;">
            ${Object.entries(FIELD_LABELS).map(([k,l]) => `<option value="${k}">${k} — ${l}</option>`).join('')}
          </select></label>
          <label style="font-size:12px;">Value<br/><input type="text" id="dev-edit-value" placeholder="New value" style="min-width:200px;" /></label>
          <button type="button" class="btn-primary btn-sm" id="dev-edit-save">Save</button>
        </div>
        <div id="dev-edit-msg" style="margin-top:8px;font-size:12px;"></div>
      </div>
    </div>
    <div class="detail-section">
      <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">▾</span> Device Actions</h2>
      <div class="collapsible-content">
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button type="button" class="btn" id="dev-oos-btn">${d['50'] === 'YES' ? 'Return to Service' : 'Mark Out of Service'}</button>
          <button type="button" class="btn" id="dev-test-btn">Test Print</button>
          <button type="button" class="btn" id="dev-delete-btn" style="color:#b91c1c;">Delete Device</button>
        </div>
        <div id="dev-action-msg" style="margin-top:8px;font-size:12px;"></div>
      </div>
    </div>

    ${res.ok && res.rawLines ? `
    <div class="detail-section collapsed">
      <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">▾</span> Raw DDR GETS (File 3.5)</h2>
      <div class="collapsible-content">
        <pre style="font-size:11px;overflow:auto;max-height:200px;background:#f8fafc;padding:8px;border-radius:4px;">${escapeHtml(JSON.stringify(d, null, 2))}</pre>
      </div>
    </div>` : ''}`;

  const saveBtn = document.getElementById('dev-edit-save');
  if (saveBtn) saveBtn.addEventListener('click', async () => {
    const field = document.getElementById('dev-edit-field').value;
    const value = document.getElementById('dev-edit-value').value;
    const msg = document.getElementById('dev-edit-msg');
    if (!value.trim()) { msg.textContent = 'Value required.'; msg.style.color = '#b91c1c'; return; }
    if (!confirm('Update device field ' + field + '?')) return;
    msg.textContent = 'Saving…'; msg.style.color = '';
    const out = await apiPut(`devices/${encodeURIComponent(devIen)}/fields`, { field, value });
    msg.textContent = out.ok ? 'Saved.' : (out.error || JSON.stringify(out));
    msg.style.color = out.ok ? '#166534' : '#b91c1c';
  });

  const oosBtn = document.getElementById('dev-oos-btn');
  if (oosBtn) oosBtn.addEventListener('click', async () => {
    const isOos = d['50'] === 'YES';
    const newVal = isOos ? '' : 'YES';
    if (!confirm(isOos ? 'Return this device to service?' : 'Mark this device out of service?')) return;
    const msg = document.getElementById('dev-action-msg');
    msg.textContent = 'Saving…'; msg.style.color = '';
    const out = await apiPut(`devices/${encodeURIComponent(devIen)}/fields`, { field: '50', value: newVal });
    msg.textContent = out.ok ? 'Updated. Refresh to see change.' : (out.error || JSON.stringify(out));
    msg.style.color = out.ok ? '#166534' : '#b91c1c';
  });

  const testBtn = document.getElementById('dev-test-btn');
  if (testBtn) testBtn.addEventListener('click', async () => {
    const msg = document.getElementById('dev-action-msg');
    msg.textContent = 'Sending test print…'; msg.style.color = '';
    const out = await apiPost(`devices/${encodeURIComponent(devIen)}/test-print`, {});
    msg.textContent = out.ok ? 'Test print sent.' : (out.error || 'Test print not available — requires ZVE overlay routine.');
    msg.style.color = out.ok ? '#166534' : '#b91c1c';
  });

  const deleteBtn = document.getElementById('dev-delete-btn');
  if (deleteBtn) deleteBtn.addEventListener('click', async () => {
    if (!confirm('DELETE this device from VistA File 3.5? This cannot be undone.')) return;
    if (!confirm('Are you sure? Type "yes" in the next prompt to confirm.')) return;
    const msg = document.getElementById('dev-action-msg');
    msg.textContent = 'Deleting…'; msg.style.color = '';
    const out = await apiDelete(`devices/${encodeURIComponent(devIen)}`);
    if (out.ok) { msg.textContent = 'Deleted. Redirecting…'; msg.style.color = '#166534'; setTimeout(() => { window.location.hash = '#/devices'; }, 1000); }
    else { msg.textContent = out.error || JSON.stringify(out); msg.style.color = '#b91c1c'; }
  });
}

// ---------------------------------------------------------------------------
// Key Impact Preview
// ---------------------------------------------------------------------------
const KEY_IMPACT_MAP = {
  'XUMGR':          { groups: ['users','facilities','system','devices','monitoring','vistatools'], role: 'IRM / Security Admin', admin: true },
  'XUPROG':         { groups: ['system','vistatools'], role: 'IRM / Security Admin', admin: true },
  'XUPROGMODE':     { groups: ['system','vistatools'], role: 'FileMan DBA / Programmer', admin: true },
  'DG REGISTER':    { groups: ['facilities'], role: 'Registration Clerk' },
  'DG MENU':        { groups: ['facilities'], role: 'Registration Supervisor' },
  'SD SUPERVISOR':  { groups: ['facilities'], role: 'Scheduling Supervisor' },
  'SDMGR':          { groups: ['facilities'], role: 'Scheduling Manager' },
  'PROVIDER':       { groups: ['clinical'], role: 'Clinical Provider' },
  'ORES':           { groups: ['clinical'], role: 'Order Entry' },
  'ORELSE':         { groups: ['clinical'], role: 'Ward Clerk' },
  'CPRS CONFIG':    { groups: ['clinical'], role: 'CPRS Coordinator' },
  'ORCLINIC':       { groups: ['clinical'], role: 'CPRS Coordinator' },
  'HLMENU':         { groups: ['devices'], role: 'HL7 / Interface Manager' },
  'HLPATCH':        { groups: ['devices'], role: 'HL7 Patch Manager' },
  'PSJ PHARMACIST': { groups: ['clinical'], role: 'Pharmacist' },
  'PSO MANAGER':    { groups: ['clinical'], role: 'Pharmacy Supervisor' },
  'LRMGR':          { groups: ['clinical'], role: 'Lab Manager' },
  'LRCAP':          { groups: ['clinical'], role: 'Lab CAP' },
  'MAG SYSTEM':     { groups: ['clinical'], role: 'Imaging System Admin' },
  'IB SITE MGR':    { groups: ['billing'], role: 'Billing Site Manager' },
};

function showKeyImpact(keyName) {
  const upper = (keyName || '').toUpperCase().trim();
  const impact = KEY_IMPACT_MAP[upper];
  let existing = document.getElementById('key-impact-panel');
  if (existing) existing.remove();
  const panel = document.createElement('div');
  panel.id = 'key-impact-panel';
  panel.style.cssText = 'position:fixed;bottom:16px;right:16px;width:360px;background:var(--ve-color-surface,#fff);border:1px solid var(--ve-color-border,#e5e7eb);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.12);padding:16px;z-index:1000;font-size:13px;';
  if (!impact) {
    panel.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><strong>Key: ${escapeHtml(upper)}</strong><button onclick="this.parentElement.parentElement.remove()" style="border:none;background:none;cursor:pointer;font-size:16px;color:#999;">&times;</button></div>
      <p style="color:var(--ve-color-text-muted,#999);">This key has no predefined RBAC mapping. It may control VistA menu options at the terminal level only.</p>`;
  } else {
    const groupBadges = impact.groups.map(g => `<span class="badge" style="margin:2px 4px 2px 0;font-size:11px;">${escapeHtml(g)}</span>`).join('');
    panel.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><strong>Key: ${escapeHtml(upper)}</strong><button onclick="this.parentElement.parentElement.remove()" style="border:none;background:none;cursor:pointer;font-size:16px;color:#999;">&times;</button></div>
      <div style="margin-bottom:8px;"><span style="color:var(--ve-color-text-muted);font-size:11px;text-transform:uppercase;">Suggested Role</span><br/><span style="font-weight:600;">${escapeHtml(impact.role || 'Not mapped')}</span></div>
      ${impact.admin ? '<div style="margin-bottom:8px;color:#b91c1c;font-weight:600;font-size:11px;">⚠ ADMIN-LEVEL KEY — grants full nav access</div>' : ''}
      <div style="margin-bottom:8px;"><span style="color:var(--ve-color-text-muted);font-size:11px;text-transform:uppercase;">Nav Groups Unlocked</span><br/>${groupBadges}</div>
      <p style="font-size:11px;color:var(--ve-color-text-muted);">Allocating this key to a user will grant access to the corresponding tenant-admin navigation groups.</p>`;
  }
  document.body.appendChild(panel);
}

// ---------------------------------------------------------------------------
// Key Inventory
// ---------------------------------------------------------------------------
async function renderKeyInventory(el) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Users &amp; Access › Key Inventory</div>
    <div class="page-header"><h1>Key Inventory</h1></div><div class="loading-message">Loading…</div>`;
  const res = await api('key-inventory');
  if (!res.ok) { el.innerHTML = `<div class="error-message">Failed to load</div>`; return; }
  const keys = res.data;
  const summary = res.summary;

  function renderRows(list) {
    if (!list.length) return '<tr><td colspan="4">No keys</td></tr>';
    return list.map(k => {
      const holderBadge = k.holderCount > 0
        ? `<span style="cursor:pointer;text-decoration:underline;color:var(--ve-color-primary,#2563eb);" title="${(k.holders || []).slice(0,5).map(h => escapeHtml(h.name || h.duz)).join(', ')}${k.holderCount > 5 ? '...' : ''}">${k.holderCount}</span>`
        : '<span style="color:var(--ve-color-text-muted,#999);">0</span>';
      return `<tr>
        <td><span class="badge badge-key" style="cursor:pointer;" onclick="showKeyImpact('${escapeHtml(k.keyName)}')">${escapeHtml(k.keyName)}</span></td>
        <td>${escapeHtml(k.description || '—')}</td>
        <td style="font-weight:600">${holderBadge}</td>
        <td>${(k.vistaGrounding || {}).file19_1Ien ? 'IEN ' + (k.vistaGrounding || {}).file19_1Ien : '—'}</td>
      </tr>`;
    }).join('');
  }

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Users &amp; Access › Key Inventory</div>
    <div class="page-header"><h1>Key Inventory (File 19.1)</h1>${sourceBadge(res.sourceStatus || res.source)}</div>
    <div class="card-grid" style="margin-bottom:16px;">
      <div class="card"><div class="card-label">Total Keys</div><div class="card-value">${summary.totalKeys}</div></div>
      <div class="card"><div class="card-label">With Holders</div><div class="card-value">${summary.totalKeys - (summary.unassignedKeys || 0)}</div></div>
      <div class="card"><div class="card-label">Unassigned</div><div class="card-value">${summary.unassignedKeys || 0}</div></div>
    </div>
    <div class="filter-rail">
      <input type="text" id="key-search" placeholder="Search keys…" />
      <span class="result-count" id="key-count">Showing ${keys.length} of ${keys.length}</span>
    </div>
    <table class="data-table">
      <thead><tr><th>Key Name</th><th>Description</th><th>Holders</th><th>File 19.1</th></tr></thead>
      <tbody id="key-tbody">${renderRows(keys)}</tbody>
    </table>
    <div class="detail-section" style="margin-top:16px;">
      <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">▾</span> Create Security Key</h2>
      <div class="collapsible-content">
        <p style="font-size:12px;color:var(--color-text-muted);margin-bottom:8px;">
          Creates a new security key in File 19.1 via <code>DDR FILER ADD</code>.
          Keys control access to VistA menu options and RPCs. Common keys: PROVIDER, ORES, ORELSE, XUPROGMODE.
        </p>
        <div class="form-grid">
          <div><label>Key Name *</label><input type="text" id="key-create-name" placeholder="e.g. MYKEY" style="text-transform:uppercase;" /></div>
          <div><label>Description</label><input type="text" id="key-create-desc" placeholder="Description of this key" /></div>
        </div>
        <button type="button" class="btn-primary" id="key-create-btn" style="margin-top:8px;">Create Key</button>
        <div id="key-create-msg" style="margin-top:6px;font-size:12px;"></div>
      </div>
    </div>
    <div class="detail-section" style="margin-top:16px;">
      <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">▾</span> Allocate / Deallocate Key</h2>
      <div class="collapsible-content">
        <p style="font-size:12px;color:var(--color-text-muted);margin-bottom:8px;">
          Assigns or removes a key from a user. This modifies File 200 field 51 (KEYS) sub-file.
          Alternatively, use the User Detail page → Security Keys section to manage per-user.
        </p>
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;">
          <label style="font-size:12px;">Key Name<br/><input type="text" id="key-alloc-key" placeholder="e.g. PROVIDER" style="min-width:160px;" /></label>
          <label style="font-size:12px;">User DUZ (IEN)<br/><input type="text" id="key-alloc-duz" placeholder="e.g. 87" style="min-width:100px;" /></label>
          <button type="button" class="btn-primary btn-sm" id="key-alloc-btn">Allocate</button>
          <button type="button" class="btn btn-sm" id="key-dealloc-btn" style="color:#b91c1c;">Deallocate</button>
        </div>
        <div id="key-alloc-msg" style="margin-top:6px;font-size:12px;"></div>
      </div>
    </div>`;

  document.getElementById('key-search').addEventListener('input', () => {
    const q = (document.getElementById('key-search').value || '').toLowerCase();
    const filtered = keys.filter(k => k.keyName.toLowerCase().includes(q));
    document.getElementById('key-tbody').innerHTML = renderRows(filtered);
    document.getElementById('key-count').textContent = `Showing ${filtered.length} of ${keys.length}`;
  });

  document.getElementById('key-create-btn').addEventListener('click', async () => {
    const name = (document.getElementById('key-create-name') || {}).value || '';
    const msg = document.getElementById('key-create-msg');
    if (!name.trim()) { msg.textContent = 'Key name required.'; msg.style.color = '#b91c1c'; return; }
    if (!confirm('Create security key "' + name.trim().toUpperCase() + '" in VistA File 19.1?')) return;
    msg.textContent = 'Creating…'; msg.style.color = '';
    const out = await apiPost('security-keys', { name: name.trim().toUpperCase() });
    msg.textContent = out.ok ? 'Security key created via DDR FILER (File 19.1).' : (out.error || JSON.stringify(out));
    msg.style.color = out.ok ? '#166534' : '#b91c1c';
    if (out.ok) { document.getElementById('key-create-name').value = ''; setTimeout(() => renderKeyInventory(el), 1200); }
  });

  const allocBtn = document.getElementById('key-alloc-btn');
  const deallocBtn = document.getElementById('key-dealloc-btn');
  const allocMsg = document.getElementById('key-alloc-msg');
  if (allocBtn) allocBtn.addEventListener('click', async () => {
    const keyName = (document.getElementById('key-alloc-key') || {}).value || '';
    const duz = (document.getElementById('key-alloc-duz') || {}).value || '';
    if (!keyName.trim() || !duz.trim()) { allocMsg.textContent = 'Both key name and DUZ required.'; allocMsg.style.color = '#b91c1c'; return; }
    allocMsg.textContent = 'Allocating…'; allocMsg.style.color = '';
    const out = await apiPost(`users/${encodeURIComponent(duz.trim())}/keys`, { keyName: keyName.trim().toUpperCase() });
    allocMsg.textContent = out.ok ? 'Key allocated to DUZ ' + duz.trim() + '.' : (out.error || JSON.stringify(out));
    allocMsg.style.color = out.ok ? '#166534' : '#b91c1c';
  });
  if (deallocBtn) deallocBtn.addEventListener('click', async () => {
    const keyName = (document.getElementById('key-alloc-key') || {}).value || '';
    const duz = (document.getElementById('key-alloc-duz') || {}).value || '';
    if (!keyName.trim() || !duz.trim()) { allocMsg.textContent = 'Both key name and DUZ required.'; allocMsg.style.color = '#b91c1c'; return; }
    if (!confirm('Remove key "' + keyName.trim() + '" from DUZ ' + duz.trim() + '?')) return;
    allocMsg.textContent = 'Deallocating…'; allocMsg.style.color = '';
    const out = await apiDelete(`users/${encodeURIComponent(duz.trim())}/keys/${encodeURIComponent(keyName.trim().toUpperCase())}`);
    allocMsg.textContent = out.ok ? 'Key removed from DUZ ' + duz.trim() + '.' : (out.error || JSON.stringify(out));
    allocMsg.style.color = out.ok ? '#166534' : '#b91c1c';
  });
}

// ---------------------------------------------------------------------------
// E-Sig Status
// ---------------------------------------------------------------------------
async function renderEsigStatus(el) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Users &amp; Access › E-Sig Status</div>
    <div class="page-header"><h1>Electronic Signature Status</h1></div><div class="loading-message">Loading…</div>`;
  const res = await api('esig-status');
  if (!res.ok) { el.innerHTML = `<div class="error-message">Failed to load</div>`; return; }
  const users = res.data;
  const agg = res.aggregates;

  function renderRows(list) {
    if (!list.length) return '<tr><td colspan="8">No users</td></tr>';
    return list.map(u => {
      const badge = u.esigStatus === 'active' ? 'badge-active' : u.esigStatus === 'revoked' ? 'badge-inactive' : 'badge-ungrounded';
      return `<tr>
        <td><a href="#/users/${encodeURIComponent(u.id)}">${escapeHtml(u.name)}</a></td>
        <td>${u.duz ?? '—'}</td>
        <td><span class="badge ${u.status === 'active' ? 'badge-active' : 'badge-inactive'}">${escapeHtml(u.status)}</span></td>
        <td><span class="badge ${badge}">${escapeHtml(u.esigStatus)}</span></td>
        <td>${u.hasCode ? 'Yes' : 'No'}</td>
        <td>${escapeHtml(u.sigBlockName || '—')}</td>
        <td>${escapeHtml(u.sigBlockTitle || '—')}</td>
        <td style="white-space:nowrap;">
          <a href="#/users/${encodeURIComponent(u.id)}" class="btn btn-sm" style="font-size:11px;">Edit Sig Block</a>
          <button type="button" class="btn btn-sm esig-set-btn" data-duz="${u.duz || u.id}" data-name="${escapeHtml(u.name)}" style="font-size:11px;margin-left:4px;">Set Code</button>
          <button type="button" class="btn btn-sm esig-clear-btn" data-duz="${u.duz || u.id}" data-name="${escapeHtml(u.name)}" style="font-size:11px;color:#b91c1c;margin-left:4px;">Clear</button>
        </td>
      </tr>`;
    }).join('');
  }

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Users &amp; Access › E-Sig Status</div>
    <div class="page-header"><h1>Electronic Signature Status</h1>${sourceBadge(res.sourceStatus || res.source)}</div>
    <div class="explanation-header">
      <strong>VistA Electronic Signatures are typed text codes</strong>, not graphical signatures.
      The code is hashed via <code>$$EN^XUSHSH</code> and stored in File 200 field 20.4. The Signature Block Printed Name (20.3)
      and Title appear on printed documents, prescriptions, and orders.
      <br/><br/>Users with "Not configured" status cannot sign orders or clinical notes until an e-sig code is set
      and their signature block (name + title) is complete.
    </div>
    <div class="card-grid" style="margin-bottom:16px;">
      <div class="card"><div class="card-label">Total Users</div><div class="card-value">${agg.total}</div></div>
      <div class="card"><div class="card-label">E-Sig Active</div><div class="card-value" style="color:var(--color-success)">${agg.active}</div></div>
      <div class="card"><div class="card-label">Not Configured</div><div class="card-value" style="${agg.notConfigured > 0 ? 'color:var(--color-warning)' : ''}">${agg.notConfigured}</div></div>
    </div>
    <div class="filter-rail">
      <input type="text" id="esig-search" placeholder="Search…" />
      <select id="esig-filter"><option value="">All</option><option value="active">Active</option><option value="not-configured">Not configured</option><option value="revoked">Revoked</option></select>
      <span class="result-count" id="esig-count">Showing ${users.length} of ${users.length}</span>
    </div>
    <table class="data-table">
      <thead><tr><th>Name</th><th>DUZ</th><th>Status</th><th>E-Sig</th><th>Has Code</th><th>Sig Block Name</th><th>Sig Block Title</th><th>Actions</th></tr></thead>
      <tbody id="esig-tbody">${renderRows(users)}</tbody>
    </table>`;

  const applyF = () => {
    const q = (document.getElementById('esig-search').value || '').toLowerCase();
    const sf = document.getElementById('esig-filter').value;
    const filtered = users.filter(u => {
      if (q && !u.name.toLowerCase().includes(q)) return false;
      if (sf && u.esigStatus !== sf) return false;
      return true;
    });
    document.getElementById('esig-tbody').innerHTML = renderRows(filtered);
    document.getElementById('esig-count').textContent = `Showing ${filtered.length} of ${users.length}`;
  };
  document.getElementById('esig-search').addEventListener('input', applyF);
  document.getElementById('esig-filter').addEventListener('change', applyF);

  el.addEventListener('click', async (e) => {
    const clearBtn = e.target.closest('.esig-clear-btn');
    if (clearBtn) {
      const duz = clearBtn.dataset.duz;
      const name = clearBtn.dataset.name;
      if (!confirm(`Clear e-signature code for ${name} (DUZ ${duz})? They will need to set a new code to sign documents.`)) return;
      clearBtn.textContent = '…';
      const out = await apiPut(`users/${encodeURIComponent(duz)}`, { field: '20.4', value: '' });
      clearBtn.textContent = out.ok ? 'Cleared' : 'Failed';
      clearBtn.style.color = out.ok ? '#166534' : '#b91c1c';
      return;
    }
    const setBtn = e.target.closest('.esig-set-btn');
    if (setBtn) {
      const duz = setBtn.dataset.duz;
      const name = setBtn.dataset.name;
      const code = prompt(`Enter new e-signature code for ${name} (DUZ ${duz}):`);
      if (!code || !code.trim()) return;
      setBtn.textContent = '…';
      const out = await apiPost(`users/${encodeURIComponent(duz)}/esig`, { code: code.trim() });
      setBtn.textContent = out.ok ? 'Set' : 'Failed';
      setBtn.style.color = out.ok ? '#166534' : '#b91c1c';
    }
  });
}

// ---------------------------------------------------------------------------
// Device List
// ---------------------------------------------------------------------------
async function renderDeviceList(el) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Devices &amp; Connectivity › Devices</div>
    <div class="page-header"><h1>Devices</h1></div><div class="loading-message">Loading…</div>`;
  const res = await api('devices');
  if (!res.ok) { el.innerHTML = `<div class="error-message">${escapeHtml(res.error || 'failed')}</div>`; return; }
  const devices = res.data || [];

  function rows(list) {
    if (!list.length) return '<tr><td colspan="4">No devices</td></tr>';
    return list.map(d => `<tr>
      <td><a href="#/devices/${encodeURIComponent(d.ien || '')}">${escapeHtml(d.ien || '')}</a></td>
      <td><a href="#/devices/${encodeURIComponent(d.ien || '')}">${escapeHtml(d.name || '')}</a></td>
      <td>${escapeHtml(d.type || '—')}</td><td>${escapeHtml(d.subtype || '—')}</td>
    </tr>`).join('');
  }

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Devices &amp; Connectivity › Devices</div>
    <div class="page-header"><h1>Devices (File 3.5)</h1>${sourceBadge(res.sourceStatus || res.source)}</div>
    <div class="explanation-header">
      <strong>VistA Device Management (File 3.5)</strong>
      Devices control how VistA sends output — to screens, printers, file queues, or specialized equipment.
      Common types: <code>TRM</code> (terminal), <code>P-OTHER</code> (printer), <code>RES</code> (resource).
      Click a device to view/edit all properties (margins, page length, IO spec, open/close params, OOS status).
    </div>
    <div class="card-grid" style="margin-bottom:12px;">
      <div class="card"><div class="card-label">Total Devices</div><div class="card-value">${devices.length}</div></div>
    </div>
    <div class="filter-rail">
      <input type="text" id="dev-search" placeholder="Search…" />
      <span class="result-count" id="dev-count">Showing ${devices.length} of ${devices.length}</span>
    </div>
    <table class="data-table">
      <thead><tr><th>IEN</th><th>Name</th><th>Type</th><th>Subtype</th></tr></thead>
      <tbody id="dev-tbody">${rows(devices)}</tbody>
    </table>
    <div class="detail-section" style="margin-top:16px;">
      <h2>Add Device</h2>
      <p style="font-size:12px;color:var(--color-text-muted);margin-bottom:8px;">Creates in File 3.5 via <code>DDR FILER</code>.</p>
      <div style="display:flex;gap:8px;align-items:flex-end;">
        <label style="font-size:12px;">Device Name<br/><input type="text" id="dev-add-name" placeholder="e.g. LASER-PRINTER-1" style="min-width:220px;" /></label>
        <button type="button" class="btn-primary" id="dev-add-btn">Add</button>
      </div>
      <div id="dev-add-msg" style="margin-top:8px;font-size:12px;"></div>
    </div>`;

  document.getElementById('dev-search').addEventListener('input', () => {
    const q = (document.getElementById('dev-search').value || '').toLowerCase();
    const filtered = devices.filter(d => (d.name || '').toLowerCase().includes(q));
    document.getElementById('dev-tbody').innerHTML = rows(filtered);
    document.getElementById('dev-count').textContent = `Showing ${filtered.length} of ${devices.length}`;
  });

  document.getElementById('dev-add-btn').addEventListener('click', async () => {
    const name = (document.getElementById('dev-add-name') || {}).value || '';
    const msg = document.getElementById('dev-add-msg');
    if (!name.trim()) { msg.textContent = 'Name required.'; msg.style.color = '#b91c1c'; return; }
    msg.textContent = 'Creating…'; msg.style.color = '';
    const out = await apiPost('devices', { name: name.trim() });
    if (out.ok) { msg.textContent = 'Created.'; msg.style.color = '#166534'; setTimeout(() => renderDeviceList(el), 1000); }
    else { msg.textContent = out.error || JSON.stringify(out); msg.style.color = '#b91c1c'; }
  });
}

// ---------------------------------------------------------------------------
// Kernel Parameters
// ---------------------------------------------------------------------------
async function renderParamsKernel(el) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › System &amp; Parameters › Kernel</div>
    <div class="page-header"><h1>Kernel Site Parameters</h1>${tip('File 8989.3 — Core VistA kernel settings. Changes here affect ALL users and ALL workstations connected to this VistA instance.')}</div>
    ${renderImpact([
      'All user sessions — timeout and sign-on behavior',
      'All RPC Broker connections — broker timeout setting',
      'System identity — site name, domain, institution',
      'Menu system behavior — auto-menu for all users',
    ])}
    <div class="loading-message">Loading…</div>`;
  const res = await api('params/kernel');
  const badge = sourceBadge(res.sourceStatus || res.source);
  if (!res.ok) {
    el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › System &amp; Parameters › Kernel</div>
      <div class="page-header"><h1>Kernel Site Parameters</h1></div>
      <div class="error-message">${escapeHtml(res.error || 'Failed to load')}</div>`;
    return;
  }

  const lines = res.rawLines || [];
  const fieldMap = {};
  const LABELS = {
    '.01': 'SITE NAME', '.02': 'DOMAIN NAME', '.03': 'DEFAULT INSTITUTION',
    '.04': 'DEFAULT AUTO MENU', '.05': 'DEFAULT LANGUAGE',
    '205': 'AGENCY CODE', '230': 'PRODUCTION ACCOUNT',
    '210': 'DEFAULT TIMEOUT', '501': 'MULTIPLE SIGN-ON',
    '240': 'BROKER TIMEOUT',
  };
  const TIPS = {
    '.01': 'The display name of this VistA site. Shows on login screens and reports.',
    '.02': 'The network domain name for this VistA instance. Used for MailMan addressing.',
    '.03': 'The default VA institution this site belongs to. Links to File 4 (Institution).',
    '.04': 'The menu shown to users who don\'t have a specific primary menu assigned.',
    '.05': 'The default language for VistA menus and prompts (if translations are installed).',
    '205': 'The VA agency code (e.g. VA=department, DOD=defense). Used in HL7 messages.',
    '230': 'YES means this is a production system. Enables warnings before destructive actions.',
    '210': 'Seconds of inactivity before a user is automatically logged out. 0 = never.',
    '501': 'If YES, users can have multiple active sessions. If NO, new login kills previous.',
    '240': 'Seconds the RPC broker waits for a response before timing out.',
  };
  for (const line of lines) {
    if (line.includes('^') && !line.startsWith('[')) {
      const parts = line.split('^');
      if (parts.length >= 2) fieldMap[parts[0]?.trim()] = parts.slice(1).join('^').trim();
    }
  }
  const hasData = Object.keys(fieldMap).length > 0 && !lines.some(l => l.includes('[ERROR]'));
  const fieldRows = hasData
    ? Object.entries(fieldMap).map(([k, v]) => `<div class="detail-row"><dt>${escapeHtml(LABELS[k] || k)} <code style="font-size:10px;color:var(--color-text-muted)">${escapeHtml(k)}</code>${TIPS[k] ? tip(TIPS[k]) : ''}</dt><dd>${escapeHtml(v || '(empty)')}</dd></div>`).join('')
    : '<div class="detail-row"><dt>Status</dt><dd style="color:var(--color-warning)">No data from File 8989.3 IEN 1.</dd></div>';

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › System &amp; Parameters › Kernel</div>
    <div class="page-header"><h1>Kernel Site Parameters</h1>${badge}</div>
    <div class="explanation-header">
      <strong>File 8989.3 (KERNEL SYSTEM PARAMETERS)</strong>
      Foundational site-level configuration: site name, network domain, default institution, auto-menu, language,
      agency code, production account flag, timeout, multiple sign-on, and broker timeout.
      These settings affect every user on the system.
    </div>
    <div class="detail-section"><h2>Current Values</h2><dl>${fieldRows}</dl></div>
    <div class="detail-section">
      <h2>Edit Field</h2>
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;">
        <label style="font-size:12px;">Field<br/><select id="ta-kf" style="min-width:200px;">
          <option value=".01">.01 - SITE NAME</option>
          <option value=".02">.02 - DOMAIN NAME</option>
          <option value=".03">.03 - DEFAULT INSTITUTION</option>
          <option value=".04">.04 - DEFAULT AUTO MENU</option>
          <option value=".05">.05 - DEFAULT LANGUAGE</option>
          <option value="205">205 - AGENCY CODE</option>
          <option value="230">230 - PRODUCTION ACCOUNT</option>
          <option value="210">210 - DEFAULT TIMEOUT</option>
          <option value="501">501 - MULTIPLE SIGN-ON</option>
          <option value="240">240 - BROKER TIMEOUT</option>
        </select></label>
        <div id="ta-khelp" style="font-size:11px;color:var(--color-text-muted);margin:4px 0;min-height:18px;"></div>
        <label style="font-size:12px;">Value<br/><input type="text" id="ta-kv" placeholder="New value" style="min-width:200px;" /></label>
        <button type="button" class="btn-primary" id="ta-ksave">Save</button>
      </div>
      <div id="ta-kmsg" style="margin-top:8px;font-size:12px;"></div>
    </div>`;

  const kfSel = document.getElementById('ta-kf');
  const kHelp = document.getElementById('ta-khelp');
  kfSel.addEventListener('change', () => { kHelp.textContent = TIPS[kfSel.value] || ''; });
  kHelp.textContent = TIPS[kfSel.value] || '';

  document.getElementById('ta-ksave').addEventListener('click', async () => {
    const field = document.getElementById('ta-kf').value;
    const value = document.getElementById('ta-kv').value;
    const msg = document.getElementById('ta-kmsg');
    if (!value.trim()) { msg.textContent = 'Value required.'; msg.style.color = '#b91c1c'; return; }
    if (!confirm('Update kernel param ' + field + '? This is site-wide.')) return;
    msg.textContent = 'Saving…'; msg.style.color = '';
    const out = await apiPut('params/kernel', { field, value });
    msg.textContent = out.ok ? 'Saved.' : (out.error || JSON.stringify(out));
    msg.style.color = out.ok ? '#166534' : '#b91c1c';
  });
}

// ---------------------------------------------------------------------------
// VistA Tools (DDR probe)
// ---------------------------------------------------------------------------
async function renderVistaTools(el) {
  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Monitoring › VistA Tools</div>
    <div class="page-header"><h1>VistA Tools (DDR Probe)</h1><span class="source-posture vista">RPC</span></div>
    <div class="explanation-header">
      All configuration writes go through <strong>DDR VALIDATOR / DDR FILER</strong> or distro overlay RPCs (e.g. <code>ZVEUSMG</code>).
      This page shows the results of probing the DDR RPC family and overlay RPCs.
    </div>
    <div class="loading-message" id="ddr-probe-loading">Running DDR probe…</div>
    <pre id="ddr-probe-out" style="display:none;font-size:11px;overflow:auto;max-height:480px;background:#0f172a;color:#e2e8f0;padding:12px;border-radius:6px;"></pre>`;
  try {
    const res = await api('vista/ddr-probe');
    document.getElementById('ddr-probe-loading').style.display = 'none';
    const out = document.getElementById('ddr-probe-out');
    out.style.display = 'block';
    out.textContent = JSON.stringify(res, null, 2);
  } catch (e) {
    document.getElementById('ddr-probe-loading').textContent = 'Probe failed: ' + e.message;
  }
}

// ---------------------------------------------------------------------------
// Module Entitlements
// ---------------------------------------------------------------------------
async function renderModuleEntitlements(el) {
  const MODULES = [
    { id: 'kernel', name: 'Kernel (Infrastructure)', cat: 'Core', mandated: true, desc: 'VistA Kernel: users, security keys, devices, menus, TaskMan, MailMan. Always active.' },
    { id: 'clinical', name: 'Clinical (CPRS, Orders, Notes)', cat: 'Core', mandated: true, desc: 'Cover sheet, problems, meds, orders, notes, consults, labs, vitals.' },
    { id: 'scheduling', name: 'Scheduling', cat: 'Core', mandated: true, desc: 'SDES/SDOE scheduling, appointment types, clinic availability.' },
    { id: 'pharmacy', name: 'Pharmacy', cat: 'Core', mandated: true, desc: 'Drug formulary, dosing, interactions, dispense tracking.' },
    { id: 'laboratory', name: 'Laboratory', cat: 'Core', mandated: true, desc: 'Test definitions, collection samples, accession, results.' },
    { id: 'radiology', name: 'Radiology / Imaging', cat: 'Optional', mandated: false, desc: 'Radiology procedures, DICOM/PACS, imaging worklist.' },
    { id: 'nursing', name: 'Nursing', cat: 'Optional', mandated: false, desc: 'eMAR, assessments, care plans, I&O documentation.' },
    { id: 'telehealth', name: 'Telehealth', cat: 'Optional', mandated: false, desc: 'Video visits, device check, waiting room, session management.' },
    { id: 'analytics', name: 'Analytics / BI', cat: 'Optional', mandated: false, desc: 'Aggregated metrics, PHI-safe analytics, ROcto SQL.' },
    { id: 'rcm', name: 'Revenue Cycle (RCM / Billing)', cat: 'Optional', mandated: false, desc: 'Claims, payer connectivity, EDI pipeline, encounter billing.' },
    { id: 'interop', name: 'Interoperability (HL7/FHIR)', cat: 'Infrastructure', mandated: false, desc: 'HL7 logical links, HLO telemetry, FHIR profiles.' },
    { id: 'portal', name: 'Patient Portal', cat: 'Optional', mandated: false, desc: 'Patient-facing: messaging, appointments, health records, intake.' },
    { id: 'iam', name: 'IAM / Security Governance', cat: 'Infrastructure', mandated: false, desc: 'OIDC, ABAC, audit shipping, encryption, SCIM.' },
  ];

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › System &amp; Parameters › Module Entitlements</div>
    <div class="page-header"><h1>Module Entitlements</h1>${sourceBadge('catalog')}</div>
    <div class="explanation-header">
      <strong>Module entitlements</strong> control which VistA features are enabled for this tenant.
      <strong>Mandated</strong> modules are locked by the legal market and cannot be disabled.
      <strong>Default-on</strong> modules can be toggled off. <strong>Eligible</strong> modules can be activated within
      the tenant's subscription plan. Module status is resolved per-tenant from
      <code>config/modules.json</code> → SKU → tenant overrides.
    </div>
    <div class="card-grid" style="margin-bottom:16px;">
      <div class="card"><div class="card-label">Total Modules</div><div class="card-value">${MODULES.length}</div></div>
      <div class="card"><div class="card-label">Mandated (Core)</div><div class="card-value">${MODULES.filter(m => m.mandated).length}</div></div>
      <div class="card"><div class="card-label">Optional</div><div class="card-value">${MODULES.filter(m => !m.mandated).length}</div></div>
    </div>
    <table class="data-table">
      <thead><tr><th>Module</th><th>Category</th><th>Status</th><th>Description</th></tr></thead>
      <tbody>
        ${MODULES.map(m => `<tr>
          <td><strong>${escapeHtml(m.name)}</strong></td>
          <td>${escapeHtml(m.cat)}</td>
          <td>${m.mandated ? '<span class="badge badge-active">Mandated</span>' : '<span class="badge badge-pending">Configurable</span>'}</td>
          <td style="font-size:12px;color:var(--color-text-muted);">${escapeHtml(m.desc)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <p style="font-size:12px;color:var(--color-text-muted);margin-top:12px;">
      Module toggle UI is planned for the control-plane operator console. Tenant admins see read-only status.
      See <code>config/modules.json</code> and <code>config/skus.json</code> for the 12-module + 7-SKU architecture.
    </p>`;
}

// ---------------------------------------------------------------------------
// Monitoring Status
// ---------------------------------------------------------------------------
async function renderMonitoringStatus(el) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Monitoring › System Status</div>
    <div class="page-header"><h1>System Status</h1></div><div class="loading-message">Loading…</div>`;

  const vistaRes = await api('vista-status');
  const connected = vistaRes.vista && vistaRes.vista.ok;
  const dashRes = await api('dashboard');
  const d = dashRes.ok ? dashRes.data : {};

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Monitoring › System Status</div>
    <div class="page-header"><h1>System Status</h1>${connected ? '<span class="source-posture vista">CONNECTED</span>' : '<span class="source-posture error">DISCONNECTED</span>'}</div>
    <div class="explanation-header">
      <strong>System Health Monitoring</strong> — 7 indicators per VistA admin blueprint.
      VistA connection, RPC broker, active users, error trap, TaskMan, MailMan, and disk/DB status.
    </div>
    <div class="card-grid">
      <div class="card">
        <div class="card-label">VistA Connection</div>
        <div class="card-value" style="font-size:18px;color:${connected ? 'var(--color-success)' : 'var(--color-error)'}">${connected ? 'Connected' : 'Disconnected'}</div>
        <div class="card-sub">${vistaRes.vista ? escapeHtml(vistaRes.vista.url || '') : '—'}</div>
      </div>
      <div class="card">
        <div class="card-label">RPC Broker</div>
        <div class="card-value" style="font-size:18px;color:${connected ? 'var(--color-success)' : 'var(--color-error)'}">${connected ? 'Healthy' : 'Down'}</div>
        <div class="card-sub">DUZ: ${vistaRes.vista && vistaRes.vista.duz ? vistaRes.vista.duz : '—'}</div>
      </div>
      <div class="card">
        <div class="card-label">Active Users</div>
        <div class="card-value">${d.activeUserCount ?? '—'}</div>
        <div class="card-sub">Total: ${d.userCount ?? '—'}</div>
      </div>
      <div class="card">
        <div class="card-label">Clinics</div>
        <div class="card-value">${d.clinicCount ?? '—'}</div>
      </div>
      <div class="card">
        <div class="card-label">Error Trap</div>
        <div class="card-value" style="font-size:16px;color:var(--color-text-muted)">Not probed</div>
        <div class="card-sub">Requires <code>^%ZTER</code> global read. <a href="#/error-trap">View →</a></div>
      </div>
      <div class="card">
        <div class="card-label">TaskMan</div>
        <div class="card-value" style="font-size:16px;color:var(--color-text-muted)">Not probed</div>
        <div class="card-sub">Requires File 14.4 DDR LISTER. <a href="#/taskman">View →</a></div>
      </div>
      <div class="card">
        <div class="card-label">MailMan</div>
        <div class="card-value" style="font-size:16px;color:var(--color-text-muted)">Not probed</div>
        <div class="card-sub">Requires File 3.8 DDR GETS. <a href="#/mailman-config">View →</a></div>
      </div>
    </div>
    <div class="detail-section" style="margin-top:16px;">
      <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">▾</span> VistA Connection Raw Details</h2>
      <div class="collapsible-content">
        <pre style="font-size:11px;overflow:auto;max-height:200px;background:#f8fafc;padding:8px;border-radius:4px;">${escapeHtml(JSON.stringify(vistaRes, null, 2))}</pre>
      </div>
    </div>
    <div class="detail-section">
      <h2>Quick Actions</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <a href="#/vista-tools" class="btn btn-sm">DDR Probe →</a>
        <a href="#/rpc-status" class="btn btn-sm">RPC Status →</a>
        <a href="#/packages" class="btn btn-sm">Installed Packages →</a>
        <a href="#/error-trap" class="btn btn-sm">Error Trap →</a>
        <a href="#/monitoring/audit" class="btn btn-sm">Audit Trail →</a>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Terminal Types (File 3.2) — DDR LISTER backed
// ---------------------------------------------------------------------------
async function renderTerminalTypes(el) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/devices">Devices</a> › Terminal Types</div><div class="loading-message">Loading…</div>`;
  const res = await api('terminal-types');
  if (!res.ok) { el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/devices">Devices</a> › Terminal Types</div><div class="error-message">${escapeHtml(res.error || 'Failed to load')}</div>`; return; }
  const rows = res.data || [];
  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/devices">Devices</a> › Terminal Types</div>
    <div class="page-header"><h1>Terminal Types (File 3.2)</h1>${sourceBadge(res.source)}</div>
    <div class="explanation-header">
      <strong>Terminal / Printer Type Definitions</strong>
      Each device references a terminal type that controls emulation behavior: margins, page length, form feed, and open/close execute commands.
      Common types: P-HP-LASER, C-VT100, P-ZEBRA, P-DOT-MATRIX. Read via <code>DDR LISTER</code> on File 3.2.
    </div>
    <div class="filter-rail">
      <input type="text" id="tt-search" placeholder="Search terminal types…" />
      <span class="result-count" id="tt-count">${rows.length} types</span>
    </div>
    <table class="data-table">
      <thead><tr><th>IEN</th><th>Name</th><th>Right Margin</th><th>Form Feed</th><th>Page Length</th></tr></thead>
      <tbody id="tt-tbody">${rows.length ? rows.map(r => `<tr class="clickable-row" data-href="#/terminal-types/${r.ien}"><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.rightMargin || '—')}</td><td>${escapeHtml(r.formFeed || '—')}</td><td>${escapeHtml(r.pageLength || '—')}</td></tr>`).join('') : '<tr><td colspan="5">No terminal types found</td></tr>'}</tbody>
    </table>`;
  wireClickableRows('tt-tbody');
  document.getElementById('tt-search').addEventListener('input', () => {
    const q = (document.getElementById('tt-search').value || '').toLowerCase();
    const filtered = rows.filter(r => (r.name || '').toLowerCase().includes(q));
    document.getElementById('tt-tbody').innerHTML = filtered.map(r => `<tr class="clickable-row" data-href="#/terminal-types/${r.ien}"><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.rightMargin || '—')}</td><td>${escapeHtml(r.formFeed || '—')}</td><td>${escapeHtml(r.pageLength || '—')}</td></tr>`).join('');
    wireClickableRows('tt-tbody');
    document.getElementById('tt-count').textContent = `${filtered.length} of ${rows.length} types`;
  });
}

// ---------------------------------------------------------------------------
// Treating Specialties (File 45.7) — DDR LISTER backed
// ---------------------------------------------------------------------------
async function renderTreatingSpecialties(el) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/facilities">Facilities</a> › Treating Specialties</div><div class="loading-message">Loading…</div>`;
  const res = await api('treating-specialties');
  if (!res.ok) { el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/facilities">Facilities</a> › Treating Specialties</div><div class="error-message">${escapeHtml(res.error || 'Failed to load')}</div>`; return; }
  const rows = res.data || [];
  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/facilities">Facilities</a> › Treating Specialties</div>
    <div class="page-header"><h1>Treating Specialties (File 45.7)</h1>${sourceBadge(res.source)}</div>
    <div class="explanation-header">
      <strong>Medical Specialties for Ward Assignment</strong>
      Treating specialties (Medicine, Surgery, Psychiatry, Rehabilitation, etc.) are assigned to wards for bed management, workload reporting, and patient tracking. File 45.7 stores the specialty name, service, and specialty type.
    </div>
    <div class="filter-rail">
      <input type="text" id="ts-search" placeholder="Search specialties…" />
      <span class="result-count" id="ts-count">${rows.length} specialties</span>
    </div>
    <table class="data-table">
      <thead><tr><th>IEN</th><th>Specialty Name</th><th>Service</th><th>Specialty Type</th></tr></thead>
      <tbody id="ts-tbody">${rows.length ? rows.map(r => `<tr class="clickable-row" data-href="#/treating-specialties/${r.ien}"><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.service || '—')}</td><td>${escapeHtml(r.specialty || '—')}</td></tr>`).join('') : '<tr><td colspan="4">No treating specialties found</td></tr>'}</tbody>
    </table>`;
  wireClickableRows('ts-tbody');
  document.getElementById('ts-search').addEventListener('input', () => {
    const q = (document.getElementById('ts-search').value || '').toLowerCase();
    const filtered = rows.filter(r => (r.name || '').toLowerCase().includes(q));
    document.getElementById('ts-tbody').innerHTML = filtered.map(r => `<tr class="clickable-row" data-href="#/treating-specialties/${r.ien}"><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.service || '—')}</td><td>${escapeHtml(r.specialty || '—')}</td></tr>`).join('');
    wireClickableRows('ts-tbody');
    document.getElementById('ts-count').textContent = `${filtered.length} of ${rows.length} specialties`;
  });
}

// ---------------------------------------------------------------------------
// Treating Specialty Detail + Edit (File 45.7)
// ---------------------------------------------------------------------------
async function renderTreatingSpecialtyDetail(el, tsIen) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/treating-specialties">Treating Specialties</a> › Specialty ${escapeHtml(tsIen)}</div><div class="loading-message">Loading from VistA...</div>`;
  const res = await api(`treating-specialties/${encodeURIComponent(tsIen)}`);
  const d = (res.ok && res.data && res.data.data) ? res.data.data : {};
  const badge = sourceBadge(res.ok ? 'vista' : 'error');
  const v = (f) => escapeHtml(d[f] || '');

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/treating-specialties">Treating Specialties</a> › ${v('.01') || 'Specialty ' + escapeHtml(tsIen)}</div>
    <div class="page-header"><h1>${v('.01') || 'Treating Specialty'}</h1>${badge}</div>
    <div class="explanation-header">
      <strong>Treating Specialty (File 45.7)</strong>
      Treating specialties are assigned to wards for bed management and workload reporting.
      Edit via <code>DDR FILER</code>.
    </div>
    <div class="detail-section">
      <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">&#9662;</span> Details</h2>
      <div class="collapsible-content">
        <dl>
          <div class="detail-row"><dt>Specialty Name (.01) ${tip('Name of this treating specialty (e.g., GENERAL SURGERY, NEUROLOGY). Used for bed assignment and workload tracking on wards.')}</dt><dd>${v('.01') || '<em>empty</em>'}</dd></div>
          <div class="detail-row"><dt>Specialty (1) ${tip('The national VA specialty code. Maps to standard specialty categories for national reporting and cost accounting.')}</dt><dd>${v('1') || '<em>empty</em>'}</dd></div>
          <div class="detail-row"><dt>Service Connected (2) ${tip('Whether this specialty handles service-connected conditions. Affects billing category and eligibility determinations.')}</dt><dd>${v('2') || '<em>empty</em>'}</dd></div>
          <div class="detail-row"><dt>IEN ${tip('Internal Entry Number in File 45.7. Referenced by Ward (File 42) and Bed Section assignments.')}</dt><dd>${escapeHtml(tsIen)}</dd></div>
        </dl>
      </div>
    </div>
    <div class="detail-section">
      <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">&#9662;</span> Edit Specialty</h2>
      <div class="collapsible-content">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;max-width:500px;">
          <label style="font-size:12px;">Name (.01) ${tip('Treating specialty name, must be unique.')}<br/><input type="text" id="ts-edit-name" value="${v('.01')}" style="width:100%;" /></label>
          <label style="font-size:12px;">Specialty (1) ${tip('National VA specialty code.')}<br/><input type="text" id="ts-edit-specialty" value="${v('1')}" style="width:100%;" /></label>
        </div>
        <div style="margin-top:12px;display:flex;gap:8px;">
          <button type="button" class="btn-primary btn-sm" id="ts-edit-save">Save to VistA</button>
          <button type="button" class="btn-sm" onclick="window.location.hash='#/treating-specialties'">Cancel</button>
        </div>
        <div id="ts-edit-msg" style="margin-top:8px;font-size:12px;"></div>
      </div>
    </div>`;

  const saveBtn = document.getElementById('ts-edit-save');
  if (saveBtn) saveBtn.addEventListener('click', async () => {
    const msg = document.getElementById('ts-edit-msg');
    const payload = {};
    const nameVal = (document.getElementById('ts-edit-name') || {}).value;
    const specVal = (document.getElementById('ts-edit-specialty') || {}).value;
    if (nameVal !== undefined && nameVal !== v('.01')) payload.name = nameVal;
    if (specVal !== undefined && specVal !== v('1')) payload.specialty = specVal;
    if (Object.keys(payload).length === 0) { msg.textContent = 'No changes detected.'; msg.style.color = '#92400e'; return; }
    if (!confirm('Save changes to VistA?')) return;
    msg.textContent = 'Saving...'; msg.style.color = '';
    const out = await apiPut(`treating-specialties/${encodeURIComponent(tsIen)}`, payload);
    msg.textContent = out.ok ? 'Saved successfully.' : (out.error || JSON.stringify(out));
    msg.style.color = out.ok ? '#166534' : '#b91c1c';
    if (out.ok) setTimeout(() => renderTreatingSpecialtyDetail(el, tsIen), 1000);
  });
}

// ---------------------------------------------------------------------------
// Appointment Type Detail + Edit (File 409.1)
// ---------------------------------------------------------------------------
async function renderAppointmentTypeDetail(el, atIen) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/scheduling-config">Scheduling</a> › Appointment Type ${escapeHtml(atIen)}</div><div class="loading-message">Loading from VistA...</div>`;
  const res = await api(`appointment-types/${encodeURIComponent(atIen)}`);
  const d = (res.ok && res.data && res.data.data) ? res.data.data : {};
  const badge = sourceBadge(res.ok ? 'vista' : 'error');
  const v = (f) => escapeHtml(d[f] || '');

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/scheduling-config">Scheduling</a> › ${v('.01') || 'Type ' + escapeHtml(atIen)}</div>
    <div class="page-header"><h1>${v('.01') || 'Appointment Type'}</h1>${badge}</div>
    <div class="explanation-header">
      <strong>Appointment Type (File 409.1)</strong>
      Defines scheduling types used across clinics. Each type has a default duration and can be set inactive.
      Edit via <code>DDR FILER</code>.
    </div>
    <div class="detail-section">
      <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">&#9662;</span> Details</h2>
      <div class="collapsible-content">
        <dl>
          <div class="detail-row"><dt>Appointment Type (.01) ${tip('The name of this appointment category (e.g., REGULAR, WALK-IN, COMPENSATION & PENSION). Used by schedulers when booking patients.')}</dt><dd>${v('.01') || '<em>empty</em>'}</dd></div>
          <div class="detail-row"><dt>Default Duration (3) ${tip('Default length in minutes for this appointment type. Can be overridden per clinic. Example: 30 = half hour appointment.')}</dt><dd>${v('3') || '<em>empty</em>'}</dd></div>
          <div class="detail-row"><dt>Inactive Date (4) ${tip('If set, this appointment type is retired and no longer available for new scheduling. Existing appointments with this type are unaffected.')}</dt><dd>${v('4') || '<em>none - active</em>'}</dd></div>
          <div class="detail-row"><dt>IEN ${tip('Internal Entry Number in File 409.1. Referenced by clinic configuration (File 44) and appointment records.')}</dt><dd>${escapeHtml(atIen)}</dd></div>
        </dl>
      </div>
    </div>
    <div class="detail-section">
      <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">&#9662;</span> Edit Appointment Type</h2>
      <div class="collapsible-content">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;max-width:500px;">
          <label style="font-size:12px;">Name (.01) ${tip('Appointment type name. Must be unique.')}<br/><input type="text" id="at-edit-name" value="${v('.01')}" style="width:100%;" /></label>
          <label style="font-size:12px;">Default Duration (3) ${tip('Length in minutes. Example: 30.')}<br/><input type="text" id="at-edit-duration" value="${v('3')}" placeholder="minutes" style="width:100%;" /></label>
          <label style="font-size:12px;">Inactive Date (4) ${tip('Set a date to retire this type. Leave empty to keep active.')}<br/><input type="text" id="at-edit-inactive" value="${v('4')}" placeholder="Leave empty for active" style="width:100%;" /></label>
        </div>
        <div style="margin-top:12px;display:flex;gap:8px;">
          <button type="button" class="btn-primary btn-sm" id="at-edit-save">Save to VistA</button>
          <button type="button" class="btn-sm" onclick="window.location.hash='#/scheduling-config'">Cancel</button>
        </div>
        <div id="at-edit-msg" style="margin-top:8px;font-size:12px;"></div>
      </div>
    </div>`;

  const saveBtn = document.getElementById('at-edit-save');
  if (saveBtn) saveBtn.addEventListener('click', async () => {
    const msg = document.getElementById('at-edit-msg');
    const payload = {};
    const nameVal = (document.getElementById('at-edit-name') || {}).value;
    const durVal = (document.getElementById('at-edit-duration') || {}).value;
    const inactVal = (document.getElementById('at-edit-inactive') || {}).value;
    if (nameVal !== undefined && nameVal !== v('.01')) payload.name = nameVal;
    if (durVal !== undefined && durVal !== v('3')) payload.defaultDuration = durVal;
    if (inactVal !== undefined && inactVal !== v('4')) payload.inactiveDate = inactVal;
    if (Object.keys(payload).length === 0) { msg.textContent = 'No changes detected.'; msg.style.color = '#92400e'; return; }
    if (!confirm('Save changes to VistA?')) return;
    msg.textContent = 'Saving...'; msg.style.color = '';
    const out = await apiPut(`appointment-types/${encodeURIComponent(atIen)}`, payload);
    msg.textContent = out.ok ? 'Saved successfully.' : (out.error || JSON.stringify(out));
    msg.style.color = out.ok ? '#166534' : '#b91c1c';
    if (out.ok) setTimeout(() => renderAppointmentTypeDetail(el, atIen), 1000);
  });
}

// ---------------------------------------------------------------------------
// Terminal Type Detail + Edit (File 3.2)
// ---------------------------------------------------------------------------
async function renderTerminalTypeDetail(el, ttIen) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/terminal-types">Terminal Types</a> › Type ${escapeHtml(ttIen)}</div><div class="loading-message">Loading from VistA...</div>`;
  const res = await api(`terminal-types/${encodeURIComponent(ttIen)}`);
  const d = (res.ok && res.data && res.data.data) ? res.data.data : {};
  const badge = sourceBadge(res.ok ? 'vista' : 'error');
  const v = (f) => escapeHtml(d[f] || '');

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/terminal-types">Terminal Types</a> › ${v('.01') || 'Type ' + escapeHtml(ttIen)}</div>
    <div class="page-header"><h1>${v('.01') || 'Terminal Type'}</h1>${badge}</div>
    <div class="explanation-header">
      <strong>Terminal Type (File 3.2)</strong>
      Controls printer/terminal emulation: margins, page length, form feed behavior.
      Edit via <code>DDR FILER</code>.
    </div>
    <div class="detail-section">
      <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">&#9662;</span> Details</h2>
      <div class="collapsible-content">
        <dl>
          <div class="detail-row"><dt>Name (.01) ${tip('The identifier for this terminal type (e.g., C-VT100, P-LASER). Names starting with C- are for CRT screens, P- for printers.')}</dt><dd>${v('.01') || '<em>empty</em>'}</dd></div>
          <div class="detail-row"><dt>Right Margin (1) ${tip('Maximum number of characters per line. 80 is standard for terminals, 132 for wide/landscape printers. Controls where VistA wraps text.')}</dt><dd>${v('1') || '<em>empty</em>'}</dd></div>
          <div class="detail-row"><dt>Form Feed (2) ${tip('The escape sequence sent to advance to the next page. For printers: #,$C(12) sends a page break. For screens: $C(27,91,50,74) clears the display.')}</dt><dd>${v('2') || '<em>empty</em>'}</dd></div>
          <div class="detail-row"><dt>Page Length (3) ${tip('Number of lines per page. 24 for standard terminals, 60-66 for letter-size paper on printers. Controls when page breaks occur.')}</dt><dd>${v('3') || '<em>empty</em>'}</dd></div>
          <div class="detail-row"><dt>Back Space (4) ${tip('The escape code to move the cursor back one position. Usually $C(8) for most terminals. Used for overprint and editing.')}</dt><dd>${v('4') || '<em>empty</em>'}</dd></div>
          <div class="detail-row"><dt>Open Execute (5) ${tip('MUMPS code executed when a device with this terminal type is opened. Sets cursor positioning and screen attributes. Advanced - only edit if you understand MUMPS I/O.')}</dt><dd>${v('5') || '<em>empty</em>'}</dd></div>
          <div class="detail-row"><dt>Close Execute (6) ${tip('MUMPS code executed when closing the device. Resets terminal state. Usually blank for most types.')}</dt><dd>${v('6') || '<em>empty</em>'}</dd></div>
          <div class="detail-row"><dt>IEN ${tip('Internal Entry Number in File 3.2. Referenced by device definitions in File 3.5.')}</dt><dd>${escapeHtml(ttIen)}</dd></div>
        </dl>
      </div>
    </div>
    <div class="detail-section">
      <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">&#9662;</span> Edit Terminal Type</h2>
      <div class="collapsible-content">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;max-width:500px;">
          <label style="font-size:12px;">Name (.01) ${tip('Identifier for this terminal type. C- prefix = screen, P- prefix = printer.')}<br/><input type="text" id="tt-edit-name" value="${v('.01')}" style="width:100%;" /></label>
          <label style="font-size:12px;">Right Margin (1) ${tip('Characters per line. 80 standard, 132 wide.')}<br/><input type="text" id="tt-edit-margin" value="${v('1')}" style="width:100%;" /></label>
          <label style="font-size:12px;">Form Feed (2) ${tip('Escape sequence for page breaks.')}<br/><input type="text" id="tt-edit-ff" value="${v('2')}" style="width:100%;" /></label>
          <label style="font-size:12px;">Page Length (3) ${tip('Lines per page. 24 for screens, 60-66 for printers.')}<br/><input type="text" id="tt-edit-pl" value="${v('3')}" style="width:100%;" /></label>
        </div>
        <div style="margin-top:12px;display:flex;gap:8px;">
          <button type="button" class="btn-primary btn-sm" id="tt-edit-save">Save to VistA</button>
          <button type="button" class="btn-sm" onclick="window.location.hash='#/terminal-types'">Cancel</button>
        </div>
        <div id="tt-edit-msg" style="margin-top:8px;font-size:12px;"></div>
      </div>
    </div>`;

  const saveBtn = document.getElementById('tt-edit-save');
  if (saveBtn) saveBtn.addEventListener('click', async () => {
    const msg = document.getElementById('tt-edit-msg');
    const payload = {};
    const nameVal = (document.getElementById('tt-edit-name') || {}).value;
    const marginVal = (document.getElementById('tt-edit-margin') || {}).value;
    const ffVal = (document.getElementById('tt-edit-ff') || {}).value;
    const plVal = (document.getElementById('tt-edit-pl') || {}).value;
    if (nameVal && nameVal !== v('.01')) payload.name = nameVal;
    if (marginVal && marginVal !== v('1')) payload.rightMargin = marginVal;
    if (ffVal && ffVal !== v('2')) payload.formFeed = ffVal;
    if (plVal && plVal !== v('3')) payload.pageLength = plVal;
    if (Object.keys(payload).length === 0) { msg.textContent = 'No changes detected.'; msg.style.color = '#92400e'; return; }
    if (!confirm('Save changes to VistA?')) return;
    msg.textContent = 'Saving...'; msg.style.color = '';
    const out = await apiPut(`terminal-types/${encodeURIComponent(ttIen)}`, payload);
    msg.textContent = out.ok ? 'Saved successfully.' : (out.error || JSON.stringify(out));
    msg.style.color = out.ok ? '#166534' : '#b91c1c';
    if (out.ok) setTimeout(() => renderTerminalTypeDetail(el, ttIen), 1000);
  });
}

// ---------------------------------------------------------------------------
// Room-Bed Detail + Edit (File 405.4)
// ---------------------------------------------------------------------------
async function renderRoomBedDetail(el, rbIen) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/beds">Room-Beds</a> › Bed ${escapeHtml(rbIen)}</div><div class="loading-message">Loading from VistA...</div>`;
  const res = await api(`room-beds/${encodeURIComponent(rbIen)}`);
  const d = (res.ok && res.data && res.data.data) ? res.data.data : {};
  const badge = sourceBadge(res.ok ? 'vista' : 'error');
  const v = (f) => escapeHtml(d[f] || '');

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/beds">Room-Beds</a> › ${v('.01') || 'Bed ' + escapeHtml(rbIen)}</div>
    <div class="page-header"><h1>${v('.01') || 'Room-Bed'}</h1>${badge}</div>
    <div class="explanation-header">
      <strong>Room-Bed (File 405.4)</strong>
      Stores all rooms and beds across wards. Each bed links to a ward and has an out-of-service status.
      Edit via <code>DDR FILER</code>.
    </div>
    <div class="detail-section">
      <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">&#9662;</span> Details</h2>
      <div class="collapsible-content">
        <dl>
          <div class="detail-row"><dt>Room-Bed (.01) ${tip('The room and bed identifier (e.g., 3-A, 7-B). Format is usually ROOM-BED. Must be unique within the facility.')}</dt><dd>${v('.01') || '<em>empty</em>'}</dd></div>
          <div class="detail-row"><dt>Ward (.02) ${tip('Which ward this bed belongs to. Links to File 42 (Ward Location). Determines which nursing unit manages this bed.')}</dt><dd>${v('.02') || '<em>empty</em>'}</dd></div>
          <div class="detail-row"><dt>Ward Location (.04) ${tip('Alternative ward linkage. Some facilities use this instead of or in addition to .02.')}</dt><dd>${v('.04') || '<em>empty</em>'}</dd></div>
          <div class="detail-row"><dt>Out of Service (.2) ${tip('If YES, this bed is temporarily unavailable (e.g., maintenance, cleaning, equipment failure). Bed will not appear in available bed lists.')}</dt><dd>${v('.2') || 'No'}</dd></div>
          <div class="detail-row"><dt>Bed Status (2) ${tip('Current status: clean, dirty, in-use. Updated by nursing staff and housekeeping systems.')}</dt><dd>${v('2') || '<em>empty</em>'}</dd></div>
          <div class="detail-row"><dt>Occupation Status (3) ${tip('Whether a patient is currently assigned to this bed. Automatically updated by ADT (Admission/Discharge/Transfer) actions.')}</dt><dd>${v('3') || '<em>empty</em>'}</dd></div>
          <div class="detail-row"><dt>IEN ${tip('Internal Entry Number in File 405.4. Referenced by ADT movements and nursing assignments.')}</dt><dd>${escapeHtml(rbIen)}</dd></div>
        </dl>
      </div>
    </div>
    <div class="detail-section">
      <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">&#9662;</span> Edit Room-Bed</h2>
      <div class="collapsible-content">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;max-width:500px;">
          <label style="font-size:12px;">Room-Bed Name (.01) ${tip('Format: ROOM-BED (e.g., 3-A). Must be unique.')}<br/><input type="text" id="rb-edit-name" value="${v('.01')}" style="width:100%;" /></label>
          <label style="font-size:12px;">Out of Service (.2) ${tip('Set to Yes to temporarily remove this bed from service. It will not show in available bed lists.')}<br/><select id="rb-edit-oos" style="width:100%;"><option value="" ${!v('.2') ? 'selected' : ''}>No</option><option value="1" ${v('.2') === '1' ? 'selected' : ''}>Yes</option></select></label>
        </div>
        <div style="margin-top:12px;display:flex;gap:8px;">
          <button type="button" class="btn-primary btn-sm" id="rb-edit-save">Save to VistA</button>
          <button type="button" class="btn-sm" onclick="window.location.hash='#/beds'">Cancel</button>
        </div>
        <div id="rb-edit-msg" style="margin-top:8px;font-size:12px;"></div>
      </div>
    </div>`;

  const saveBtn = document.getElementById('rb-edit-save');
  if (saveBtn) saveBtn.addEventListener('click', async () => {
    const msg = document.getElementById('rb-edit-msg');
    const payload = {};
    const nameVal = (document.getElementById('rb-edit-name') || {}).value;
    const oosVal = (document.getElementById('rb-edit-oos') || {}).value;
    if (nameVal && nameVal !== v('.01')) payload.roomBed = nameVal;
    if (oosVal !== v('.2')) payload.outOfService = oosVal;
    if (Object.keys(payload).length === 0) { msg.textContent = 'No changes detected.'; msg.style.color = '#92400e'; return; }
    if (!confirm('Save changes to VistA?')) return;
    msg.textContent = 'Saving...'; msg.style.color = '';
    const out = await apiPut(`room-beds/${encodeURIComponent(rbIen)}`, payload);
    msg.textContent = out.ok ? 'Saved successfully.' : (out.error || JSON.stringify(out));
    msg.style.color = out.ok ? '#166534' : '#b91c1c';
    if (out.ok) setTimeout(() => renderRoomBedDetail(el, rbIen), 1000);
  });
}

// ---------------------------------------------------------------------------
// Titles List (File 3.1) — DDR LISTER backed
// ---------------------------------------------------------------------------
async function renderTitles(el) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Titles</div><div class="loading-message">Loading titles from VistA...</div>`;
  const res = await api('titles');
  if (!res.ok) { el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Titles</div><div class="error-message">${escapeHtml(res.error || 'Failed to load')}</div>`; return; }
  const rows = res.data || [];
  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Titles</div>
    <div class="page-header"><h1>Titles (File 3.1)</h1>${sourceBadge(res.source)}</div>
    <div class="explanation-header">
      <strong>VistA Title File</strong>
      File 3.1 stores user titles (e.g., CHIEF OF STAFF, NURSE MANAGER, MEDICAL RECORDS CLERK).
      Titles are referenced by File 200 (NEW PERSON) records. Click a title to view details and edit.
    </div>
    <div class="filter-rail">
      <input type="text" id="ti-search" placeholder="Search titles..." />
      <span class="result-count" id="ti-count">${rows.length} titles</span>
    </div>
    <table class="data-table">
      <thead><tr><th>IEN</th><th>Title Name</th></tr></thead>
      <tbody id="ti-tbody">${rows.length ? rows.map(r => `<tr class="clickable-row" data-href="#/titles/${r.ien}"><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td></tr>`).join('') : '<tr><td colspan="2">No titles found in File 3.1</td></tr>'}</tbody>
    </table>
    <div class="detail-section collapsed" style="margin-top:16px;">
      <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">▾</span> Add Title</h2>
      <div class="collapsible-content">
        <div style="display:flex;gap:8px;align-items:flex-end;">
          <label style="font-size:12px;">Title Name<br/><input type="text" id="ti-add-name" placeholder="e.g. CHIEF OF STAFF" style="min-width:250px;" /></label>
          <button type="button" class="btn-primary btn-sm" id="ti-add-btn">Create Title</button>
        </div>
        <div id="ti-add-msg" style="margin-top:8px;font-size:12px;"></div>
      </div>
    </div>`;
  wireClickableRows('ti-tbody');
  document.getElementById('ti-search').addEventListener('input', () => {
    const q = (document.getElementById('ti-search').value || '').toLowerCase();
    const filtered = rows.filter(r => (r.name || '').toLowerCase().includes(q));
    document.getElementById('ti-tbody').innerHTML = filtered.map(r => `<tr class="clickable-row" data-href="#/titles/${r.ien}"><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td></tr>`).join('');
    wireClickableRows('ti-tbody');
    document.getElementById('ti-count').textContent = `${filtered.length} of ${rows.length} titles`;
  });
  document.getElementById('ti-add-btn').addEventListener('click', async () => {
    const name = (document.getElementById('ti-add-name').value || '').trim();
    const msg = document.getElementById('ti-add-msg');
    if (!name) { msg.textContent = 'Title name required.'; msg.style.color = '#b91c1c'; return; }
    if (!confirm('Create title "' + name + '" in VistA File 3.1?')) return;
    msg.textContent = 'Creating...'; msg.style.color = '';
    const out = await apiPost('titles', { name });
    msg.textContent = out.ok ? 'Title created via DDR FILER.' : (out.error || JSON.stringify(out));
    msg.style.color = out.ok ? '#166534' : '#b91c1c';
    if (out.ok) { document.getElementById('ti-add-name').value = ''; setTimeout(() => renderTitles(el), 1200); }
  });
}

// ---------------------------------------------------------------------------
// Title Detail + Edit (File 3.1)
// ---------------------------------------------------------------------------
async function renderTitleDetail(el, titleIen) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Titles › Title ${escapeHtml(titleIen)}</div><div class="loading-message">Loading from VistA...</div>`;
  const res = await api(`titles/${encodeURIComponent(titleIen)}`);
  const d = (res.ok && res.data && res.data.data) ? res.data.data : {};
  const badge = sourceBadge(res.ok ? 'vista' : 'error');
  const v = (f) => escapeHtml(d[f] || '');

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Titles › ${v('.01') || 'Title ' + escapeHtml(titleIen)}</div>
    <div class="page-header"><h1>${v('.01') || 'Title'}</h1>${badge}</div>
    <div class="explanation-header">
      <strong>Title (File 3.1)</strong>
      User titles used in VistA (e.g., CHIEF OF STAFF, NURSE MANAGER). Referenced by File 200 user records.
      Edit via <code>DDR FILER</code>.
    </div>
    <div class="detail-section">
      <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">&#9662;</span> Details</h2>
      <div class="collapsible-content">
        <dl>
          <div class="detail-row"><dt>Title Name (.01)</dt><dd>${v('.01') || '<em>empty</em>'}</dd></div>
          <div class="detail-row"><dt>IEN</dt><dd>${escapeHtml(titleIen)}</dd></div>
        </dl>
      </div>
    </div>
    <div class="detail-section">
      <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">&#9662;</span> Edit Title</h2>
      <div class="collapsible-content">
        <div style="max-width:300px;">
          <label style="font-size:12px;">Title Name (.01)<br/><input type="text" id="title-edit-name" value="${v('.01')}" style="width:100%;" /></label>
        </div>
        <div style="margin-top:12px;display:flex;gap:8px;">
          <button type="button" class="btn-primary btn-sm" id="title-edit-save">Save to VistA</button>
          <button type="button" class="btn-sm" onclick="history.back()">Cancel</button>
        </div>
        <div id="title-edit-msg" style="margin-top:8px;font-size:12px;"></div>
      </div>
    </div>`;

  const saveBtn = document.getElementById('title-edit-save');
  if (saveBtn) saveBtn.addEventListener('click', async () => {
    const msg = document.getElementById('title-edit-msg');
    const nameVal = (document.getElementById('title-edit-name') || {}).value;
    if (!nameVal || nameVal === v('.01')) { msg.textContent = 'No changes detected.'; msg.style.color = '#92400e'; return; }
    if (!confirm('Rename title to "' + nameVal + '"?')) return;
    msg.textContent = 'Saving...'; msg.style.color = '';
    const out = await apiPut(`titles/${encodeURIComponent(titleIen)}`, { name: nameVal });
    msg.textContent = out.ok ? 'Saved successfully.' : (out.error || JSON.stringify(out));
    msg.style.color = out.ok ? '#166534' : '#b91c1c';
    if (out.ok) setTimeout(() => renderTitleDetail(el, titleIen), 1000);
  });
}

// ---------------------------------------------------------------------------
// Room-Bed Management (File 405.4) — DDR LISTER backed
// ---------------------------------------------------------------------------
async function renderRoomBeds(el) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/wards">Wards</a> › Room-Bed Management</div><div class="loading-message">Loading…</div>`;
  const res = await api('room-beds');
  if (!res.ok) { el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/wards">Wards</a> › Room-Bed Management</div><div class="error-message">${escapeHtml(res.error || 'Failed to load')}</div>`; return; }
  const rows = res.data || [];
  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/wards">Wards</a> › Room-Bed Management</div>
    <div class="page-header"><h1>Room-Bed Management (File 405.4)</h1>${sourceBadge(res.source)}</div>
    <div class="explanation-header">
      <strong>Room and Bed Inventory</strong>
      File 405.4 (ROOM-BED) stores all rooms and beds across wards. Used for bed tracking, admissions, and census management.
      Each entry links to a ward (File 42) and has a status (active, out-of-service, maintenance).
    </div>
    <div class="filter-rail">
      <input type="text" id="rb-search" placeholder="Search rooms/beds…" />
      <span class="result-count" id="rb-count">${rows.length} room-beds</span>
    </div>
    <table class="data-table">
      <thead><tr><th>IEN</th><th>Room-Bed</th><th>Description</th><th>Out-of-Service</th></tr></thead>
      <tbody id="rb-tbody">${rows.length ? rows.map(r => `<tr class="clickable-row" data-href="#/room-beds/${r.ien}"><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.roomBed)}</td><td>${escapeHtml(r.description || '—')}</td><td>${r.outOfService === '1' ? '<span style="color:var(--error)">Yes</span>' : 'No'}</td></tr>`).join('') : '<tr><td colspan="4">No room-beds found in File 405.4</td></tr>'}</tbody>
    </table>`;
  wireClickableRows('rb-tbody');
  document.getElementById('rb-search').addEventListener('input', () => {
    const q = (document.getElementById('rb-search').value || '').toLowerCase();
    const filtered = rows.filter(r => (r.roomBed || '').toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q));
    document.getElementById('rb-tbody').innerHTML = filtered.map(r => `<tr class="clickable-row" data-href="#/room-beds/${r.ien}"><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.roomBed)}</td><td>${escapeHtml(r.description || '—')}</td><td>${r.outOfService === '1' ? '<span style="color:var(--error)">Yes</span>' : 'No'}</td></tr>`).join('');
    wireClickableRows('rb-tbody');
    document.getElementById('rb-count').textContent = `${filtered.length} of ${rows.length} room-beds`;
  });
  const rbCreateHtml = document.createElement('div');
  rbCreateHtml.className = 'detail-section collapsed';
  rbCreateHtml.style.marginTop = '16px';
  rbCreateHtml.innerHTML = `
    <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">▾</span> Add Room-Bed</h2>
    <div class="collapsible-content">
      <div style="display:flex;gap:8px;align-items:flex-end;">
        <label style="font-size:12px;">Room-Bed Name<br/><input type="text" id="rb-add-name" placeholder="e.g. 3N-101A" style="min-width:200px;" /></label>
        <button type="button" class="btn-primary btn-sm" id="rb-add-btn">Create Room-Bed</button>
      </div>
      <div id="rb-add-msg" style="margin-top:8px;font-size:12px;"></div>
    </div>`;
  el.appendChild(rbCreateHtml);
  document.getElementById('rb-add-btn').addEventListener('click', async () => {
    const name = (document.getElementById('rb-add-name').value || '').trim();
    const msg = document.getElementById('rb-add-msg');
    if (!name) { msg.textContent = 'Room-bed name required.'; msg.style.color = '#b91c1c'; return; }
    if (!confirm('Create room-bed "' + name + '" in VistA File 405.4?')) return;
    msg.textContent = 'Creating...'; msg.style.color = '';
    const out = await apiPost('room-beds', { name });
    msg.textContent = out.ok ? 'Room-bed created via DDR FILER.' : (out.error || JSON.stringify(out));
    msg.style.color = out.ok ? '#166534' : '#b91c1c';
    if (out.ok) { document.getElementById('rb-add-name').value = ''; setTimeout(() => renderRoomBeds(el), 1200); }
  });
}

// ---------------------------------------------------------------------------
// Installed Packages / KIDS (File 9.4) — DDR LISTER backed (read-only)
// ---------------------------------------------------------------------------
async function renderInstalledPackages(el) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/params/kernel">System</a> › Installed Packages</div><div class="loading-message">Loading…</div>`;
  const res = await api('packages');
  if (!res.ok) { el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/params/kernel">System</a> › Installed Packages</div><div class="error-message">${escapeHtml(res.error || 'Failed to load')}</div>`; return; }
  const rows = res.data || [];
  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/params/kernel">System</a> › Installed Packages</div>
    <div class="page-header"><h1>Installed Packages — KIDS (File 9.4)</h1>${sourceBadge(res.source)}</div>
    <div class="explanation-header">
      <strong>VistA Package Inventory</strong>
      File 9.4 (PACKAGE) stores all installed VistA software packages. Each package has a namespace prefix (e.g. OR = OE/RR, PSJ = Inpatient Pharmacy, LR = Lab).
      This is a read-only view for system auditing and version tracking.
    </div>
    <div class="filter-rail">
      <input type="text" id="pkg-search" placeholder="Search packages…" />
      <span class="result-count" id="pkg-count">${rows.length} packages</span>
    </div>
    <table class="data-table">
      <thead><tr><th>IEN</th><th>Package Name</th><th>Prefix</th><th>Short Description</th></tr></thead>
      <tbody id="pkg-tbody">${rows.length ? rows.map(r => `<tr class="clickable-row" data-href="#/packages/${r.ien}"><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td><code>${escapeHtml(r.prefix || '—')}</code></td><td>${escapeHtml(r.shortDesc || '—')}</td></tr>`).join('') : '<tr><td colspan="4">No packages found</td></tr>'}</tbody>
    </table>`;
  wireClickableRows('pkg-tbody');
  document.getElementById('pkg-search').addEventListener('input', () => {
    const q = (document.getElementById('pkg-search').value || '').toLowerCase();
    const filtered = rows.filter(r => (r.name || '').toLowerCase().includes(q) || (r.prefix || '').toLowerCase().includes(q));
    document.getElementById('pkg-tbody').innerHTML = filtered.map(r => `<tr class="clickable-row" data-href="#/packages/${r.ien}"><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td><code>${escapeHtml(r.prefix || '—')}</code></td><td>${escapeHtml(r.shortDesc || '—')}</td></tr>`).join('');
    wireClickableRows('pkg-tbody');
    document.getElementById('pkg-count').textContent = `${filtered.length} of ${rows.length} packages`;
  });
}

// ---------------------------------------------------------------------------
// HL7 Interfaces (File 870) — DDR LISTER backed (read-only)
// ---------------------------------------------------------------------------
async function renderHL7Interfaces(el) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › HL7 Interfaces</div><div class="loading-message">Loading…</div>`;
  const [res, filerRes] = await Promise.all([api('hl7-interfaces'), api('hl7/filer-status')]);
  if (!res.ok) { el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › HL7 Interfaces</div><div class="error-message">${escapeHtml(res.error || 'Failed to load')}</div>`; return; }
  const rows = res.data || [];
  const filer = filerRes.ok ? filerRes.data : null;
  const filerBadge = filer ? `<span class="status-badge ${filer.STATUS === 'RUNNING' ? 'running' : 'stopped'}">${escapeHtml(filer.STATUS)}</span>` : (filerRes.integrationPending ? '<span class="status-badge pending">FILER N/A</span>' : '');
  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › HL7 Interfaces</div>
    <div class="page-header"><h1>HL7 Interfaces (File 870)</h1>${sourceBadge(res.source)}${filerBadge}</div>
    <div class="explanation-header">
      <strong>HL7 Logical Links & Filer Status</strong>
      File 870 (HL LOGICAL LINK) stores all HL7 connections between VistA and external systems
      (labs, imaging, pharmacy, ADT). The HL7 Filer processes incoming and outgoing messages.
      ${filer ? `Filer: <strong>${escapeHtml(filer.STATUS)}</strong> | Last run: ${escapeHtml(filer.LASTRUN || '--')}` : 'Install <code>ZVEHLFIL.m</code> for filer status.'}
    </div>
    <div class="filter-rail">
      <input type="text" id="hl7-search" placeholder="Search interfaces…" />
      <span class="result-count" id="hl7-count">${rows.length} interfaces</span>
    </div>
    <table class="data-table">
      <thead><tr><th>IEN</th><th>Link Name</th><th>Institution</th><th>LLP Type</th><th>Autostart</th></tr></thead>
      <tbody id="hl7-tbody">${rows.length ? rows.map(r => `<tr class="clickable-row" data-href="#/hl7-interfaces/${r.ien}"><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.institution || '--')}</td><td>${escapeHtml(r.lowerLayer || '--')}</td><td>${escapeHtml(r.autostart || '--')}</td></tr>`).join('') : '<tr><td colspan="5">No HL7 interfaces configured</td></tr>'}</tbody>
    </table>`;
  wireClickableRows('hl7-tbody');
  document.getElementById('hl7-search').addEventListener('input', () => {
    const q = (document.getElementById('hl7-search').value || '').toLowerCase();
    const filtered = rows.filter(r => (r.name || '').toLowerCase().includes(q));
    document.getElementById('hl7-tbody').innerHTML = filtered.map(r => `<tr class="clickable-row" data-href="#/hl7-interfaces/${r.ien}"><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.institution || '--')}</td><td>${escapeHtml(r.lowerLayer || '--')}</td><td>${escapeHtml(r.autostart || '--')}</td></tr>`).join('');
    wireClickableRows('hl7-tbody');
    document.getElementById('hl7-count').textContent = `${filtered.length} of ${rows.length} interfaces`;
  });
}

// ---------------------------------------------------------------------------
// Insurance Companies (File 36) — DDR LISTER backed
// ---------------------------------------------------------------------------
async function renderInsuranceCompanies(el) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Billing &amp; Insurance › Insurance Companies</div><div class="loading-message">Loading…</div>`;
  const res = await api('insurance-companies');
  if (!res.ok) { el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Billing &amp; Insurance</div><div class="error-message">${escapeHtml(res.error || 'Failed to load')}</div>`; return; }
  const rows = res.data || [];
  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Billing &amp; Insurance › Insurance Companies</div>
    <div class="page-header"><h1>Insurance Companies (File 36)</h1>${sourceBadge(res.source)}</div>
    <div class="explanation-header">
      <strong>Insurance Company Registry</strong>
      File 36 stores insurance companies for third-party billing. Each entry includes the company name, address,
      payer ID (for EDI claims), and filing timely limits. Required for claims submission and coordination of benefits.
    </div>
    <div class="filter-rail">
      <input type="text" id="ins-search" placeholder="Search insurance companies…" />
      <span class="result-count" id="ins-count">${rows.length} companies</span>
    </div>
    <table class="data-table">
      <thead><tr><th>IEN</th><th>Company Name</th><th>Street</th><th>City</th><th>State</th><th>Zip</th></tr></thead>
      <tbody id="ins-tbody">${rows.length ? rows.map(r => `<tr class="clickable-row" data-href="#/insurance/${r.ien}"><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.streetAddr || '—')}</td><td>${escapeHtml(r.city || '—')}</td><td>${escapeHtml(r.state || '—')}</td><td>${escapeHtml(r.zip || '—')}</td></tr>`).join('') : '<tr><td colspan="6">No insurance companies found in File 36</td></tr>'}</tbody>
    </table>
    <div class="detail-section collapsed" style="margin-top:16px;">
      <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">▾</span> Add Insurance Company</h2>
      <div class="collapsible-content">
        <div style="display:flex;gap:8px;align-items:flex-end;">
          <label style="font-size:12px;">Company Name<br/><input type="text" id="ins-add-name" placeholder="e.g. BLUE CROSS BLUE SHIELD" style="min-width:300px;" /></label>
          <button type="button" class="btn-primary btn-sm" id="ins-add-btn">Create Company</button>
        </div>
        <div id="ins-add-msg" style="margin-top:8px;font-size:12px;"></div>
      </div>
    </div>`;
  document.getElementById('ins-search').addEventListener('input', () => {
    const q = (document.getElementById('ins-search').value || '').toLowerCase();
    const filtered = rows.filter(r => (r.name || '').toLowerCase().includes(q) || (r.city || '').toLowerCase().includes(q));
    document.getElementById('ins-tbody').innerHTML = filtered.map(r => `<tr class="clickable-row" data-href="#/insurance/${r.ien}"><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.streetAddr || '—')}</td><td>${escapeHtml(r.city || '—')}</td><td>${escapeHtml(r.state || '—')}</td><td>${escapeHtml(r.zip || '—')}</td></tr>`).join('');
    wireClickableRows('ins-tbody');
    document.getElementById('ins-count').textContent = `${filtered.length} of ${rows.length} companies`;
  });
  wireClickableRows('ins-tbody');
  document.getElementById('ins-add-btn').addEventListener('click', async () => {
    const name = (document.getElementById('ins-add-name').value || '').trim();
    const msg = document.getElementById('ins-add-msg');
    if (!name) { msg.textContent = 'Company name required.'; msg.style.color = '#b91c1c'; return; }
    if (!confirm('Create insurance company "' + name + '" in VistA File 36?')) return;
    msg.textContent = 'Creating...'; msg.style.color = '';
    const out = await apiPost('insurance-companies', { name });
    msg.textContent = out.ok ? 'Insurance company created via DDR FILER.' : (out.error || JSON.stringify(out));
    msg.style.color = out.ok ? '#166534' : '#b91c1c';
    if (out.ok) { document.getElementById('ins-add-name').value = ''; setTimeout(() => renderInsuranceCompanies(el), 1200); }
  });
}

// ---------------------------------------------------------------------------
// Insurance Company Detail (File 36) — DDR GETS + edit
// ---------------------------------------------------------------------------
async function renderInsuranceDetail(el, ien) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/insurance">Insurance Companies</a> › IEN ${escapeHtml(ien)}</div><div class="loading-message">Loading…</div>`;
  const res = await api(`insurance-companies/${ien}`);
  if (!res.ok) { el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/insurance">Insurance</a></div><div class="error-message">${escapeHtml(res.error || 'Failed to load')}</div>`; return; }
  const d = res.data || {};
  const v = (f) => escapeHtml(d[f] || '—');
  const badge = sourceBadge(res.ok ? 'vista' : 'error');
  const FIELDS = { '.01': 'Company Name', '.111': 'Street Address Line 1', '.112': 'Street Address Line 2', '.113': 'Street Address Line 3', '.114': 'City', '.115': 'State', '.131': 'Phone Number', '3': 'Reimburse?', '4': 'Type' };
  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/insurance">Insurance</a> › ${v('.01')}</div>
    <div class="page-header"><h1>${v('.01')} <small style="opacity:.5">(IEN ${escapeHtml(ien)})</small></h1>${badge}</div>
    <div class="explanation-header">
      <strong>Insurance Company (File 36)</strong> — Stores company name, address, payer ID, type. Required for claims and coordination of benefits.
    </div>
    <dl class="detail-grid">
      ${Object.entries(FIELDS).map(([f, l]) => `<div class="detail-row"><dt>${escapeHtml(l)} <small>(${f})</small></dt><dd>${v(f)}</dd></div>`).join('')}
    </dl>
    <div class="detail-section" style="margin-top:16px;">
      <h2>Edit Insurance Company</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;max-width:600px;">
        <label style="font-size:12px;">Name (.01)<br/><input type="text" id="ins-edit-name" value="${v('.01')}" style="width:100%;" /></label>
        <label style="font-size:12px;">Street (.111)<br/><input type="text" id="ins-edit-street" value="${v('.111')}" style="width:100%;" /></label>
        <label style="font-size:12px;">City (.114)<br/><input type="text" id="ins-edit-city" value="${v('.114')}" style="width:100%;" /></label>
        <label style="font-size:12px;">State (.115)<br/><input type="text" id="ins-edit-state" value="${v('.115')}" style="width:100%;" /></label>
        <label style="font-size:12px;">Phone (.131)<br/><input type="text" id="ins-edit-phone" value="${v('.131')}" style="width:100%;" /></label>
      </div>
      <div style="margin-top:12px;display:flex;gap:8px;">
        <button type="button" class="btn-primary btn-sm" id="ins-edit-save">Save to VistA</button>
        <button type="button" class="btn-sm" onclick="window.location.hash='#/insurance'">Cancel</button>
      </div>
      <div id="ins-edit-msg" style="margin-top:8px;font-size:12px;"></div>
    </div>
    <div style="margin-top:1.5rem"><a href="#/insurance" class="btn-secondary">← Back to Insurance Companies</a></div>`;
  document.getElementById('ins-edit-save').addEventListener('click', async () => {
    const msg = document.getElementById('ins-edit-msg');
    const payload = {};
    const vals = { name: 'ins-edit-name', streetAddr1: 'ins-edit-street', city: 'ins-edit-city', state: 'ins-edit-state', phone: 'ins-edit-phone' };
    for (const [k, id] of Object.entries(vals)) {
      const el2 = document.getElementById(id);
      if (el2 && el2.value.trim()) payload[k] = el2.value.trim();
    }
    if (Object.keys(payload).length === 0) { msg.textContent = 'No changes.'; msg.style.color = '#92400e'; return; }
    if (!confirm('Save changes to VistA?')) return;
    msg.textContent = 'Saving...'; msg.style.color = '';
    const out = await apiPut(`insurance-companies/${encodeURIComponent(ien)}`, payload);
    msg.textContent = out.ok ? 'Saved successfully.' : (out.error || JSON.stringify(out));
    msg.style.color = out.ok ? '#166534' : '#b91c1c';
    if (out.ok) setTimeout(() => renderInsuranceDetail(el, ien), 1000);
  });
}

// ---------------------------------------------------------------------------
// Scheduling Configuration — Appointment Types (File 409.1) — DDR LISTER backed
// ---------------------------------------------------------------------------
async function renderSchedulingConfig(el) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/clinics">Clinics</a> › Scheduling Configuration</div><div class="loading-message">Loading…</div>`;
  const res = await api('appointment-types');
  if (!res.ok) { el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/clinics">Clinics</a> › Scheduling</div><div class="error-message">${escapeHtml(res.error || 'Failed to load')}</div>`; return; }
  const rows = res.data || [];
  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/clinics">Clinics</a> › Scheduling Configuration</div>
    <div class="page-header"><h1>Scheduling Configuration</h1>${sourceBadge(res.source)}</div>
    <div class="explanation-header">
      <strong>Appointment Types (File 409.1)</strong>
      Define appointment types used across all clinics: Regular, Follow-up, Walk-in, Telephone, Compensation &amp; Pension, etc.
      Each type can be set active or inactive. Referenced by clinic scheduling configuration in File 44.
    </div>
    <div class="filter-rail">
      <input type="text" id="at-search" placeholder="Search appointment types…" />
      <span class="result-count" id="at-count">${rows.length} types</span>
    </div>
    <table class="data-table">
      <thead><tr><th>IEN</th><th>Appointment Type</th><th>Synonym</th><th>Status</th><th>Action</th></tr></thead>
      <tbody id="at-tbody">${rows.length ? rows.map(r => `<tr class="clickable-row" data-href="#/appointment-types/${r.ien}"><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.synonym || '—')}</td><td>${r.inactive ? '<span class="badge badge-inactive">Inactive</span>' : '<span class="badge badge-active">Active</span>'}</td><td><button class="btn-sm at-toggle" data-ien="${escapeHtml(r.ien)}" data-active="${r.inactive ? '0' : '1'}" style="font-size:11px;color:${r.inactive ? '#166534' : '#dc2626'};border-color:${r.inactive ? '#166534' : '#dc2626'};">${r.inactive ? 'Reactivate' : 'Inactivate'}</button></td></tr>`).join('') : '<tr><td colspan="5">No appointment types found in File 409.1</td></tr>'}</tbody>
    </table>`;
  wireClickableRows('at-tbody');
  document.getElementById('at-tbody').addEventListener('click', async (e) => {
    const btn = e.target.closest('.at-toggle');
    if (!btn) return;
    e.stopPropagation();
    const ien = btn.dataset.ien;
    const isActive = btn.dataset.active === '1';
    const action = isActive ? 'inactivate' : 'reactivate';
    if (!confirm(`${isActive ? 'Inactivate' : 'Reactivate'} appointment type IEN ${ien}?`)) return;
    btn.disabled = true; btn.textContent = 'Saving...';
    const res = await apiPost(`appointment-types/${encodeURIComponent(ien)}/${action}`);
    if (res.ok) { renderSchedulingConfig(el); } else { btn.textContent = 'Error'; btn.disabled = false; }
  });
  document.getElementById('at-search').addEventListener('input', () => {
    const q = (document.getElementById('at-search').value || '').toLowerCase();
    const filtered = rows.filter(r => (r.name || '').toLowerCase().includes(q) || (r.synonym || '').toLowerCase().includes(q));
    document.getElementById('at-tbody').innerHTML = filtered.map(r => `<tr class="clickable-row" data-href="#/appointment-types/${r.ien}"><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.synonym || '—')}</td><td>${r.inactive ? '<span class="badge badge-inactive">Inactive</span>' : '<span class="badge badge-active">Active</span>'}</td><td><button class="btn-sm at-toggle" data-ien="${escapeHtml(r.ien)}" data-active="${r.inactive ? '0' : '1'}" style="font-size:11px;color:${r.inactive ? '#166534' : '#dc2626'};border-color:${r.inactive ? '#166534' : '#dc2626'};">${r.inactive ? 'Reactivate' : 'Inactivate'}</button></td></tr>`).join('');
    document.getElementById('at-count').textContent = `${filtered.length} of ${rows.length} types`;
    wireClickableRows('at-tbody');
  });
  const atCreate = document.createElement('div');
  atCreate.className = 'detail-section collapsed';
  atCreate.style.marginTop = '16px';
  atCreate.innerHTML = `
    <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">▾</span> Add Appointment Type</h2>
    <div class="collapsible-content">
      <div style="display:flex;gap:8px;align-items:flex-end;">
        <label style="font-size:12px;">Type Name<br/><input type="text" id="at-add-name" placeholder="e.g. FOLLOW-UP" style="min-width:250px;" /></label>
        <button type="button" class="btn-primary btn-sm" id="at-add-btn">Create Type</button>
      </div>
      <div id="at-add-msg" style="margin-top:8px;font-size:12px;"></div>
    </div>`;
  el.appendChild(atCreate);
  document.getElementById('at-add-btn').addEventListener('click', async () => {
    const name = (document.getElementById('at-add-name').value || '').trim();
    const msg = document.getElementById('at-add-msg');
    if (!name) { msg.textContent = 'Type name required.'; msg.style.color = '#b91c1c'; return; }
    if (!confirm('Create appointment type "' + name + '" in VistA File 409.1?')) return;
    msg.textContent = 'Creating...'; msg.style.color = '';
    const out = await apiPost('appointment-types', { name });
    msg.textContent = out.ok ? 'Appointment type created via DDR FILER.' : (out.error || JSON.stringify(out));
    msg.style.color = out.ok ? '#166534' : '#b91c1c';
    if (out.ok) { document.getElementById('at-add-name').value = ''; setTimeout(() => renderSchedulingConfig(el), 1200); }
  });
}

// ---------------------------------------------------------------------------
// Menu Management (File 19) — DDR LISTER backed (read-only)
// ---------------------------------------------------------------------------
async function renderMenuManagement(el) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/params/kernel">System</a> › Menu Management</div><div class="loading-message">Loading…</div>`;
  const res = await api('menu-options');
  if (!res.ok) { el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/params/kernel">System</a> › Menus</div><div class="error-message">${escapeHtml(res.error || 'Failed to load')}</div>`; return; }
  const rows = res.data || [];
  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/params/kernel">System</a> › Menu Management</div>
    <div class="page-header"><h1>Menu Management (File 19)</h1>${sourceBadge(res.source)}</div>
    <div class="explanation-header">
      <strong>VistA Option / Menu Hierarchy</strong>
      File 19 (OPTION) stores all VistA menu options. Options are organized in hierarchical trees.
      Users are assigned a primary menu option (field 201 in File 200) which determines their available commands.
      This read-only view shows the first 200 options. Use the search to find specific menus.
    </div>
    <div class="filter-rail">
      <input type="text" id="mn-search" placeholder="Search options…" />
      <span class="result-count" id="mn-count">${rows.length} options (showing first 200)</span>
    </div>
    <table class="data-table">
      <thead><tr><th>IEN</th><th>Option Name</th><th>Menu Text</th><th>Type</th><th>Description</th></tr></thead>
      <tbody id="mn-tbody">${rows.length ? rows.map(r => `<tr class="clickable-row" data-href="#/menu-options/${r.ien}"><td>${escapeHtml(r.ien)}</td><td><code>${escapeHtml(r.name)}</code></td><td>${escapeHtml(r.menuText || '—')}</td><td>${escapeHtml(r.type || '—')}</td><td>${escapeHtml(r.description || '—')}</td></tr>`).join('') : '<tr><td colspan="5">No options found</td></tr>'}</tbody>
    </table>`;
  wireClickableRows('mn-tbody');
  document.getElementById('mn-search').addEventListener('input', () => {
    const q = (document.getElementById('mn-search').value || '').toLowerCase();
    const filtered = rows.filter(r => (r.name || '').toLowerCase().includes(q) || (r.menuText || '').toLowerCase().includes(q));
    document.getElementById('mn-tbody').innerHTML = filtered.map(r => `<tr class="clickable-row" data-href="#/menu-options/${r.ien}"><td>${escapeHtml(r.ien)}</td><td><code>${escapeHtml(r.name)}</code></td><td>${escapeHtml(r.menuText || '—')}</td><td>${escapeHtml(r.type || '—')}</td><td>${escapeHtml(r.description || '—')}</td></tr>`).join('');
    wireClickableRows('mn-tbody');
    document.getElementById('mn-count').textContent = `${filtered.length} of ${rows.length} options`;
  });
}

// ---------------------------------------------------------------------------
// Drug File / Formulary (File 50) — DDR LISTER backed (read-only)
// ---------------------------------------------------------------------------
async function renderDrugFile(el) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Pharmacy › Drug Formulary</div><div class="loading-message">Loading drug file…</div>`;
  const res = await api('drug-file');
  if (!res.ok) { el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Pharmacy › Drug Formulary</div><div class="error-message">${escapeHtml(res.error || 'Failed to load')}</div>`; return; }
  const rows = res.data || [];
  const deaCodes = { '0': 'Unscheduled', '1': 'Schedule I', '2': 'Schedule II', '2n': 'Schedule II-N', '3': 'Schedule III', '3n': 'Schedule III-N', '4': 'Schedule IV', '5': 'Schedule V', '6': 'Legend', '9': 'OTC' };
  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Pharmacy › Drug Formulary</div>
    <div class="page-header"><h1>Drug Formulary (File 50)</h1>${sourceBadge(res.source)}</div>
    <div class="explanation-header">
      <strong>VistA Drug File</strong>
      File 50 stores every drug in the formulary. VA Classification groups drugs by therapeutic class (e.g. AM800 = Anti-HIV).
      DEA Schedule determines dispensing controls. Inactive Date marks drugs removed from the formulary.
      This is a read-only view of the first 999 entries via <code>DDR LISTER</code>.
    </div>
    <div class="filter-rail">
      <input type="text" id="df-search" placeholder="Search drugs by name or VA class…" />
      <span class="result-count" id="df-count">${rows.length} drugs</span>
    </div>
    <table class="data-table">
      <thead><tr><th>IEN</th><th>Drug Name</th><th>VA Classification</th><th>DEA Schedule</th><th>Inactive Date</th></tr></thead>
      <tbody id="df-tbody">${rows.length ? rows.map(r => `<tr class="clickable-row" data-href="#/drug-file/${r.ien}"><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td><code>${escapeHtml(r.vaClass || '—')}</code></td><td>${escapeHtml(deaCodes[r.dea] || r.dea || '—')}</td><td>${r.inactiveDate ? escapeHtml(r.inactiveDate) : '<span style="color:var(--success)">Active</span>'}</td></tr>`).join('') : '<tr><td colspan="5">No drugs found</td></tr>'}</tbody>
    </table>`;
  wireClickableRows('df-tbody');
  document.getElementById('df-search').addEventListener('input', () => {
    const q = (document.getElementById('df-search').value || '').toLowerCase();
    const filtered = rows.filter(r => (r.name || '').toLowerCase().includes(q) || (r.vaClass || '').toLowerCase().includes(q));
    document.getElementById('df-tbody').innerHTML = filtered.map(r => `<tr class="clickable-row" data-href="#/drug-file/${r.ien}"><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td><code>${escapeHtml(r.vaClass || '—')}</code></td><td>${escapeHtml(deaCodes[r.dea] || r.dea || '—')}</td><td>${r.inactiveDate ? escapeHtml(r.inactiveDate) : '<span style="color:var(--success)">Active</span>'}</td></tr>`).join('');
    wireClickableRows('df-tbody');
    document.getElementById('df-count').textContent = `${filtered.length} of ${rows.length} drugs`;
  });
}

// ---------------------------------------------------------------------------
// Lab Tests (File 60) — DDR LISTER backed (read-only)
// ---------------------------------------------------------------------------
async function renderLabTests(el) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Laboratory › Lab Tests</div><div class="loading-message">Loading lab tests…</div>`;
  const res = await api('lab-tests');
  if (!res.ok) { el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Laboratory › Lab Tests</div><div class="error-message">${escapeHtml(res.error || 'Failed to load')}</div>`; return; }
  const rows = res.data || [];
  const typeMap = { 'B': 'Both', 'I': 'Input', 'O': 'Output', 'N': 'Neither', 'P': 'Panel' };
  const subMap = { 'CH': 'Chemistry', 'HE': 'Hematology', 'MI': 'Microbiology', 'BB': 'Blood Bank', 'SP': 'Surgical Path', 'CY': 'Cytology', 'EM': 'Electron Microscopy', 'AU': 'Autopsy' };
  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Laboratory › Lab Tests</div>
    <div class="page-header"><h1>Lab Tests (File 60)</h1>${sourceBadge(res.source)}</div>
    <div class="explanation-header">
      <strong>Laboratory Test Definitions</strong>
      File 60 (LABORATORY TEST) stores every orderable lab test. Type indicates if results are input-only, output-only, or both.
      Subscript assigns the test to a lab section (Chemistry, Hematology, Microbiology, etc.).
    </div>
    <div class="filter-rail">
      <input type="text" id="lt-search" placeholder="Search tests…" />
      <select id="lt-sub-filter"><option value="">All Sections</option>${Object.entries(subMap).map(([k,v]) => `<option value="${k}">${v} (${k})</option>`).join('')}</select>
      <span class="result-count" id="lt-count">${rows.length} tests</span>
    </div>
    <table class="data-table">
      <thead><tr><th>IEN</th><th>Test Name</th><th>Type</th><th>Section (Subscript)</th></tr></thead>
      <tbody id="lt-tbody">${rows.length ? rows.map(r => `<tr class="clickable-row" data-href="#/lab-tests/${r.ien}"><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(typeMap[r.type] || r.type || '—')}</td><td>${escapeHtml(subMap[r.subscript] || r.subscript || '—')}</td></tr>`).join('') : '<tr><td colspan="4">No lab tests found</td></tr>'}</tbody>
    </table>`;
  wireClickableRows('lt-tbody');
  function applyFilter() {
    const q = (document.getElementById('lt-search').value || '').toLowerCase();
    const sub = document.getElementById('lt-sub-filter').value;
    const filtered = rows.filter(r => {
      if (q && !(r.name || '').toLowerCase().includes(q)) return false;
      if (sub && r.subscript !== sub) return false;
      return true;
    });
    document.getElementById('lt-tbody').innerHTML = filtered.map(r => `<tr class="clickable-row" data-href="#/lab-tests/${r.ien}"><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(typeMap[r.type] || r.type || '—')}</td><td>${escapeHtml(subMap[r.subscript] || r.subscript || '—')}</td></tr>`).join('');
    wireClickableRows('lt-tbody');
    document.getElementById('lt-count').textContent = `${filtered.length} of ${rows.length} tests`;
  }
  document.getElementById('lt-search').addEventListener('input', applyFilter);
  document.getElementById('lt-sub-filter').addEventListener('change', applyFilter);
}

// ---------------------------------------------------------------------------
// TaskMan — Background Jobs (File 14.4) — DDR LISTER backed (read-only)
// ---------------------------------------------------------------------------
async function renderTaskMan(el) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › System &amp; Kernel › TaskMan</div><div class="loading-message">Loading TaskMan…</div>`;
  const [res, statusRes] = await Promise.all([api('taskman-tasks'), api('taskman/status')]);
  const rows = (res.ok ? res.data : []) || [];
  const tmStatus = statusRes.ok ? statusRes.data : null;
  const statusMap = { '0': 'Pending', '1': 'Active', '2': 'Completed', '3': 'Error', '4': 'Interrupted', '5': 'Available' };
  const TABS = [
    { id: 'status', label: 'Status' },
    { id: 'tasks', label: 'Scheduled Tasks' },
    { id: 'control', label: 'Control' },
  ];
  const statusBadge = tmStatus ? `<span class="status-badge ${tmStatus.status === 'RUNNING' ? 'running' : 'stopped'}">${escapeHtml(tmStatus.status)}</span>` : '<span class="status-badge pending">UNKNOWN</span>';
  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › System &amp; Kernel › TaskMan</div>
    <div class="page-header"><h1>TaskMan Dashboard</h1>${sourceBadge(res.ok ? res.source : 'error')}${statusBadge}</div>

    ${renderTabBar(TABS, 'status')}

    <div class="tab-content active" data-tab="status">
      <div class="explanation-header">
        TaskMan is the VistA background job scheduler. It manages all scheduled and recurring tasks
        including HL7 filers, purge jobs, and background reports. Status is probed via <code>ZVE TASKMAN STATUS</code> RPC.
      </div>
      <dl>
        <div class="detail-row"><dt>TaskMan Status ${tip("Whether the TaskMan scheduler process is currently running. RUNNING = healthy, STOPPED = needs attention.")}</dt><dd>${tmStatus ? escapeHtml(tmStatus.status) : (statusRes.integrationPending ? '<span class="status-badge pending">INTEGRATION-PENDING</span> Install ZVETMCTL.m' : 'Error loading status')}</dd></div>
        <div class="detail-row"><dt>Last Run ${tip("Timestamp of the last time TaskMan completed a scheduling cycle.")}</dt><dd>${tmStatus ? escapeHtml(tmStatus.lastRun || '--') : '--'}</dd></div>
        <div class="detail-row"><dt>Total Tasks in File 14.4 ${tip("Number of task records loaded from DDR LISTER. Not all may be active.")}</dt><dd>${rows.length}</dd></div>
      </dl>
    </div>

    <div class="tab-content" data-tab="tasks">
      <div class="filter-rail">
        <input type="text" id="tm-search" placeholder="Search by routine or entry point..." />
        <span class="result-count" id="tm-count">${rows.length} tasks</span>
      </div>
      <table class="data-table">
        <thead><tr><th>Task #</th><th>Entry Point</th><th>Routine</th><th>Scheduled Run</th><th>Status</th></tr></thead>
        <tbody id="tm-tbody">${rows.length ? rows.map(r => `<tr class="clickable-row" data-href="#/taskman/${r.ien}"><td>${escapeHtml(r.ien)}</td><td><code>${escapeHtml(r.entryPoint || '--')}</code></td><td><code>${escapeHtml(r.routine || '--')}</code></td><td>${escapeHtml(r.scheduledRun || '--')}</td><td>${escapeHtml(statusMap[r.statusCode] || r.statusCode || '--')}</td></tr>`).join('') : '<tr><td colspan="5">No tasks found</td></tr>'}</tbody>
      </table>
    </div>

    <div class="tab-content" data-tab="control">
      <div class="explanation-header">
        TaskMan control requires the <code>ZVETMCTL.m</code> routine installed in VistA Docker. Start/stop operations
        affect background processing for the entire VistA system -- use with caution.
      </div>
      <div style="display:flex;gap:12px;margin-top:16px;">
        <button class="btn-primary" disabled title="Requires ZVETMCTL.m RPC">Start TaskMan</button>
        <button class="btn-secondary" disabled title="Requires ZVETMCTL.m RPC" style="color:#dc2626;border-color:#dc2626;">Stop TaskMan</button>
      </div>
      <p style="font-size:12px;color:var(--color-text-muted);margin-top:12px;">
        <span class="status-badge pending">INTEGRATION-PENDING</span>
        Start/Stop require TaskMan control RPCs not yet wired. Install <code>ZVETMCTL.m</code> then refresh.
      </p>
    </div>`;

  wireTabBar(el);
  wireClickableRows('tm-tbody');
  const tmSearch = document.getElementById('tm-search');
  if (tmSearch) tmSearch.addEventListener('input', () => {
    const q = (tmSearch.value || '').toLowerCase();
    const filtered = rows.filter(r => (r.entryPoint || '').toLowerCase().includes(q) || (r.routine || '').toLowerCase().includes(q));
    document.getElementById('tm-tbody').innerHTML = filtered.map(r => `<tr class="clickable-row" data-href="#/taskman/${r.ien}"><td>${escapeHtml(r.ien)}</td><td><code>${escapeHtml(r.entryPoint || '--')}</code></td><td><code>${escapeHtml(r.routine || '--')}</code></td><td>${escapeHtml(r.scheduledRun || '--')}</td><td>${escapeHtml(statusMap[r.statusCode] || r.statusCode || '--')}</td></tr>`).join('');
    wireClickableRows('tm-tbody');
    document.getElementById('tm-count').textContent = `${filtered.length} of ${rows.length} tasks`;
  });
}

// ---------------------------------------------------------------------------
// HL7 Interface detail (File 870) — DDR GETS read-only
// ---------------------------------------------------------------------------
async function renderHL7InterfaceDetail(el, ien) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/hl7-interfaces">HL7 Interfaces</a> › IEN ${escapeHtml(ien)}</div><div class="loading-message">Loading…</div>`;
  const [res, linkRes] = await Promise.all([api(`hl7-interfaces/${ien}`), api(`hl7/link-status/${ien}`)]);
  if (!res.ok) { el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/hl7-interfaces">HL7 Interfaces</a></div><div class="error-message">${escapeHtml(res.error || 'Failed to load')}</div>`; return; }
  const d = res.data || {};
  const link = linkRes.ok ? linkRes.data : null;
  const linkStatus = link ? (link.STATUS || 'UNKNOWN') : (linkRes.integrationPending ? 'PENDING' : 'UNKNOWN');
  const TABS = [
    { id: 'general', label: 'General' },
    { id: 'tcp', label: 'TCP Config' },
    { id: 'status', label: 'Status' },
    { id: 'edit', label: 'Edit' },
    { id: 'raw', label: 'Raw DDR' },
  ];
  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/hl7-interfaces">HL7 Interfaces</a> › ${escapeHtml(d['.01'] || 'IEN ' + ien)}</div>
    <div class="page-header">
      <h1>${escapeHtml(d['.01'] || 'HL7 Interface')} <small style="opacity:.5">(IEN ${escapeHtml(ien)})</small></h1>
      ${sourceBadge(res.source)}
      <span class="status-badge ${linkStatus === 'UP' ? 'running' : linkStatus === 'DOWN' ? 'stopped' : 'pending'}">${escapeHtml(linkStatus)}</span>
    </div>

    ${renderTabBar(TABS, 'general')}

    <div class="tab-content active" data-tab="general">
      <dl>
        <div class="detail-row"><dt>Name (.01) ${tip("Primary name for this logical HL7 link. Appears in device lists and logs.")}</dt><dd>${escapeHtml(d['.01'] || '—')}</dd></div>
        <div class="detail-row"><dt>Institution (2) ${tip("Institution that owns this link. Used for multi-site routing and billing.")}</dt><dd>${escapeHtml(d['2'] || '—')}</dd></div>
        <div class="detail-row"><dt>Mailman Domain (3) ${tip("Mailman domain for message routing. Relevant when HL7 traffic uses Mailman transport.")}</dt><dd>${escapeHtml(d['3'] || '—')}</dd></div>
        <div class="detail-row"><dt>LLP Type (4) ${tip("Low Level Protocol type: TCP, Hybrid, or mailman-based. Must match the remote system.")}</dt><dd>${escapeHtml(d['4'] || '—')}</dd></div>
      </dl>
    </div>

    <div class="tab-content" data-tab="tcp">
      <dl>
        <div class="detail-row"><dt>TCP Address (200.02) ${tip("IP address or hostname of the remote HL7 listener. Wrong address blocks all traffic.")}</dt><dd>${escapeHtml(d['200.02'] || '—')}</dd></div>
        <div class="detail-row"><dt>TCP Port (200.021) ${tip("Port number for the remote listener. Must match external system and firewall rules.")}</dt><dd>${escapeHtml(d['200.021'] || '—')}</dd></div>
        <div class="detail-row"><dt>Autostart (400.01) ${tip("Whether TaskMan auto-starts this link on system boot. Enable for production interfaces.")}</dt><dd>${escapeHtml(d['400.01'] || '—')}</dd></div>
        <div class="detail-row"><dt>Shutdown LLP (400.02) ${tip("Whether this link's Lower Level Protocol is shut down. Set to YES to stop the link.")}</dt><dd>${escapeHtml(d['400.02'] || '—')}</dd></div>
        <div class="detail-row"><dt>Queue Size (400.03) ${tip("Maximum number of messages queued for this link. Controls outbound message buffering.")}</dt><dd>${escapeHtml(d['400.03'] || '—')}</dd></div>
      </dl>
    </div>

    <div class="tab-content" data-tab="status">
      ${link ? `<dl>
        <div class="detail-row"><dt>Link Status</dt><dd><span class="status-badge ${linkStatus === 'UP' ? 'running' : 'stopped'}">${escapeHtml(linkStatus)}</span></dd></div>
        <div class="detail-row"><dt>Protocol</dt><dd>${escapeHtml(link.PROTOCOL || '--')}</dd></div>
        <div class="detail-row"><dt>Address</dt><dd>${escapeHtml(link.ADDRESS || '--')}</dd></div>
        <div class="detail-row"><dt>Port</dt><dd>${escapeHtml(link.PORT || '--')}</dd></div>
      </dl>` : `<p><span class="status-badge pending">INTEGRATION-PENDING</span> Install <code>ZVEHLFIL.m</code> for live link status probing.</p>`}
      <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--color-border);">
        <button id="hl7-shutdown-btn" class="btn-secondary btn-sm" style="color:#dc2626;border-color:#dc2626;">Shutdown Link</button>
        <button id="hl7-enable-btn" class="btn-secondary btn-sm" style="color:#166534;border-color:#166534;margin-left:8px;">Enable Link</button>
        <span id="hl7-inact-msg" style="margin-left:8px;font-size:12px;"></span>
      </div>
    </div>

    <div class="tab-content" data-tab="edit">
      <p style="font-size:12px;color:var(--color-text-muted);margin-bottom:8px;">Edit HL7 link fields via DDR FILER (File 870).</p>
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;">
        <label style="font-size:12px;">Field<br/><select id="hl7-edit-field" style="min-width:220px;">
          <option value="name">.01 - Link Name</option>
          <option value="llpType">2 - LLP Type (set of codes)</option>
          <option value="institution">3 - Institution (File 4 pointer)</option>
          <option value="shutdownLlp">4.5 - Shutdown LLP</option>
          <option value="tcpAddress">200.02 - TCP Address (sub-file)</option>
          <option value="tcpPort">200.021 - TCP Port (sub-file)</option>
        </select></label>
        <label style="font-size:12px;">Value<br/><input type="text" id="hl7-edit-value" placeholder="New value" style="min-width:200px;" /></label>
        <button type="button" class="btn-primary btn-sm" id="hl7-edit-save">Save to VistA</button>
      </div>
      <div id="hl7-edit-msg" style="margin-top:8px;font-size:12px;"></div>
    </div>

    ${renderRawTab(d)}`;

  wireTabBar(el);

  for (const [btnId, action] of [['hl7-shutdown-btn', 'shutdown'], ['hl7-enable-btn', 'enable']]) {
    const btn = document.getElementById(btnId);
    if (btn) btn.addEventListener('click', async () => {
      const msg = document.getElementById('hl7-inact-msg');
      if (!confirm(`${action === 'shutdown' ? 'Shutdown' : 'Enable'} this HL7 link?`)) return;
      btn.disabled = true; msg.textContent = 'Saving...'; msg.style.color = '';
      const res = await apiPost(`hl7-interfaces/${encodeURIComponent(ien)}/${action}`);
      if (res.ok) { msg.textContent = 'Done. Refreshing...'; msg.style.color = '#166534'; setTimeout(() => renderHL7InterfaceDetail(el, ien), 1200); }
      else { msg.textContent = res.error || 'Failed'; msg.style.color = '#b91c1c'; btn.disabled = false; }
    });
  }

  const hl7Save = document.getElementById('hl7-edit-save');
  if (hl7Save) hl7Save.addEventListener('click', async () => {
    const field = document.getElementById('hl7-edit-field').value;
    const value = document.getElementById('hl7-edit-value').value;
    const msg = document.getElementById('hl7-edit-msg');
    if (!value.trim()) { msg.textContent = 'Value required.'; msg.style.color = '#b91c1c'; return; }
    if (!confirm('Update HL7 interface field?')) return;
    msg.textContent = 'Saving...'; msg.style.color = '';
    const out = await apiPut(`hl7-interfaces/${encodeURIComponent(ien)}`, { [field]: value });
    msg.textContent = out.ok ? 'Saved. Refresh to see updated value.' : (out.error || JSON.stringify(out));
    msg.style.color = out.ok ? '#166534' : '#b91c1c';
  });
}

// ---------------------------------------------------------------------------
// Menu Option detail (File 19) — DDR GETS read-only
// ---------------------------------------------------------------------------
async function renderMenuOptionDetail(el, ien) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/params/kernel">System</a> › <a href="#/menu-management">Menus</a> › IEN ${escapeHtml(ien)}</div><div class="loading-message">Loading…</div>`;
  const res = await api(`menu-options/${ien}`);
  if (!res.ok) { el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/menu-management">Menus</a></div><div class="error-message">${escapeHtml(res.error || 'Failed to load')}</div>`; return; }
  const d = res.data || {};
  const fieldMap = { '.01': 'Name', '1': 'Menu Text', '2': 'Out of Order Message', '3.5': 'Description', '3.6': 'Type', '3.9': 'Lock', '4': 'Entry Action', '15': 'Exit Action' };
  const typeMap = { 'M': 'Menu', 'A': 'Action', 'R': 'Run Routine', 'P': 'Print', 'O': 'Protocol', 'Q': 'Protocol Menu', 'B': 'Broker', 'X': 'Extended Action', 'E': 'Edit', 'I': 'Inquire', 'S': 'Server', 'L': 'Limited', 'W': 'Window' };
  const menuFieldTips = {
    '.01': tip("Official option name (field .01); unique key used in Menu Manager and exports. Enter the exact name the package or site standard defines; changing it breaks references."),
    '1': tip("Text users see on menus. It can differ from the internal name for clarity. Enter short, action-oriented wording appropriate to the audience."),
    '3.6': tip("Option type controls how VistA runs the entry (menu, action, broker RPC, protocol, and so on). Wrong type makes the option fail or expose the wrong behavior. Choose the type that matches how this option is invoked."),
    '4': tip("MUMPS or standard code executed when the user selects the option. It drives what the option actually does. Enter the routine tag or action string your package documentation specifies."),
    '15': tip("Code run when the user leaves the option (cleanup or context reset). It matters for nested menus and locked contexts. Leave blank if none is required or use the exit logic from the package."),
    '3.9': tip("Security lock: users need the named key to see or run the option. It enforces least privilege. Enter the exact security key name from the Key Management file, or leave empty for no extra lock."),
  };
  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/params/kernel">System</a> › <a href="#/menu-management">Menus</a> › ${escapeHtml(d['.01'] || 'IEN ' + ien)}</div>
    <div class="page-header"><h1><code>${escapeHtml(d['.01'] || 'Option')}</code> <small style="opacity:.5">(IEN ${escapeHtml(ien)})</small></h1>${sourceBadge(res.source)}</div>
    <div class="explanation-header">
      <strong>VistA Option Detail</strong> — File 19 record. Type determines behavior: Menu, Action, Run Routine, Broker (RPC), Protocol, etc.
      Lock restricts access to users with the matching security key. Read-only view via <code>DDR GETS ENTRY DATA</code>.
    </div>
    <dl class="detail-grid">${Object.entries(fieldMap).map(([f, label]) => {
      let val = d[f] || '—';
      if (f === '3.6') val = typeMap[d[f]] || d[f] || '—';
      return `<div class="detail-row"><dt>${escapeHtml(label)} ${menuFieldTips[f] || ''} <small>(${f})</small></dt><dd>${f === '4' || f === '15' ? '<code>' + escapeHtml(val) + '</code>' : escapeHtml(val)}</dd></div>`;
    }).join('')}</dl>
    ${renderFieldEditForm('menuopt', ien, { '.01': 'Name', '1': 'Menu Text', '4': 'Type', '3': 'Lock' }, {
      '.01': 'Official option name. Changing this can break menu references.',
      '1': 'Text users see on menus.',
      '4': 'MUMPS entry action code.',
      '3': 'Security lock key name. Leave blank for no restriction.',
    })}
    <div style="margin-top:1.5rem"><a href="#/menu-management" class="btn-secondary">← Back to Menu Management</a></div>`;
  wireFieldEditForm('menuopt', ien, `menu-options/${encodeURIComponent(ien)}`, {
    '.01': 'Official option name', '1': 'Menu text label', '4': 'Entry action code', '3': 'Security lock key',
  });
}

// ---------------------------------------------------------------------------
// Drug detail (File 50) — DDR GETS read-only
// ---------------------------------------------------------------------------
async function renderDrugDetail(el, ien) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Pharmacy › <a href="#/drug-file">Drug Formulary</a> › IEN ${escapeHtml(ien)}</div><div class="loading-message">Loading…</div>`;
  const res = await api(`drug-file/${ien}`);
  if (!res.ok) { el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/drug-file">Drug Formulary</a></div><div class="error-message">${escapeHtml(res.error || 'Failed to load')}</div>`; return; }
  const d = res.data || {};
  const deaCodes = { '0': 'Unscheduled', '1': 'Schedule I', '2': 'Schedule II', '2n': 'Schedule II-N', '3': 'Schedule III', '3n': 'Schedule III-N', '4': 'Schedule IV', '5': 'Schedule V', '6': 'Legend', '9': 'OTC' };
  const fieldMap = { '.01': 'Generic Name', '2': 'VA Classification', '3': 'DEA, Special Hdlg', '6.5': 'Federal Schedule', '8': 'Maximum Dose Per Day', '15': 'Inactive Date', '20': 'National Drug File Entry', '21': 'VA Product Name', '25': 'National Drug Class', '31': 'Unit', '51': 'Local Non-Formulary', '100': 'Formulary Alternative' };
  const drugFieldTips = {
    '.01': tip("Generic drug name (field .01); primary label for the local drug entry. It drives searches and displays in pharmacy workflows. Enter the standard generic name for this formulary item."),
    '2': tip("VA drug class (for example antihypertensive or antibiotic). Classes power alerts, reports, and therapeutic substitution rules. Pick the class that matches clinical use."),
    '25': tip("National drug class from the NDF taxonomy. It aligns the local entry with VA-wide classification for analytics and interoperability. Use the class tied to the national product when possible."),
    '21': tip("VA Product name in the National Drug File linkage. It identifies which national product this local entry represents. Enter or select the product name that matches the dispensed item."),
    '20': tip("Pointer to the National Drug File entry for this drug. That record carries standardized identifiers including NDC where defined. Enter the correct NDF IEN so local and national data stay aligned."),
    '51': tip("Local non-formulary flag: whether this item is treated as off-formulary at your site. It affects ordering prompts and reporting. Set according to P and T or local formulary policy."),
  };
  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Pharmacy › <a href="#/drug-file">Drug Formulary</a> › ${escapeHtml(d['.01'] || 'IEN ' + ien)}</div>
    <div class="page-header"><h1>${escapeHtml(d['.01'] || 'Drug')} <small style="opacity:.5">(IEN ${escapeHtml(ien)})</small></h1>${sourceBadge(res.source)}</div>
    <div class="explanation-header">
      <strong>Drug File Detail</strong> — File 50 record. VA Classification groups by therapeutic class. DEA/Special Handling determines dispensing controls.
      National Drug File Entry links to the NDF for standardized identification. Read-only view via <code>DDR GETS ENTRY DATA</code>.
    </div>
    <dl class="detail-grid">${Object.entries(fieldMap).map(([f, label]) => {
      let val = d[f] || '—';
      let rawHtml = false;
      if (f === '3' || f === '6.5') val = deaCodes[d[f]] || d[f] || '—';
      if (f === '15' && !d[f]) { val = '<span class="status-badge active">ACTIVE</span>'; rawHtml = true; }
      return `<div class="detail-row"><dt>${escapeHtml(label)} ${drugFieldTips[f] || ''} <small>(${f})</small></dt><dd>${rawHtml ? val : escapeHtml(val)}</dd></div>`;
    }).join('')}</dl>
    ${renderInactivateButton('drug-file', ien, !d['15'])}
    ${renderFieldEditForm('drug', ien, { '.01': 'Generic Name', '2': 'VA Classification', '3': 'DEA, Special Hdlg', '25': 'National Drug Class', '51': 'Local Non-Formulary' }, {
      '.01': 'Primary generic drug name. Drives searches and pharmacy displays.',
      '2': 'VA drug classification code (e.g. CV100 for antihypertensives).',
      '51': 'Local non-formulary flag. Set YES if this drug is off-formulary.'
    })}
    <div style="margin-top:1.5rem"><a href="#/drug-file" class="btn-secondary">← Back to Drug Formulary</a></div>`;
  wireInactivateButton('drug-file', ien, !d['15'], () => renderDrugDetail(el, ien));
  wireFieldEditForm('drug', ien, `drug-file/${encodeURIComponent(ien)}`, {
    '.01': 'Primary generic drug name. Drives searches and pharmacy displays.',
    '2': 'VA drug classification code (e.g. CV100 for antihypertensives).',
    '51': 'Local non-formulary flag. Set YES if this drug is off-formulary.'
  });
}

// ---------------------------------------------------------------------------
// Lab Test detail (File 60) — DDR GETS read-only
// ---------------------------------------------------------------------------
async function renderLabTestDetail(el, ien) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Laboratory › <a href="#/lab-tests">Lab Tests</a> › IEN ${escapeHtml(ien)}</div><div class="loading-message">Loading…</div>`;
  const res = await api(`lab-tests/${ien}`);
  if (!res.ok) { el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/lab-tests">Lab Tests</a></div><div class="error-message">${escapeHtml(res.error || 'Failed to load')}</div>`; return; }
  const d = res.data || {};
  const typeMap = { 'B': 'Both', 'I': 'Input', 'O': 'Output', 'N': 'Neither', 'P': 'Panel' };
  const subMap = { 'CH': 'Chemistry', 'HE': 'Hematology', 'MI': 'Microbiology', 'BB': 'Blood Bank', 'SP': 'Surgical Path', 'CY': 'Cytology', 'EM': 'Electron Microscopy', 'AU': 'Autopsy' };
  const fieldMap = { '.01': 'Test Name', '3': 'Type', '4': 'Subscript', '5': 'Location (Accession Area)', '13': 'Execute Code', '51': 'Print Name' };
  const labFieldTips = {
    '.01': tip("Name of the lab test (field .01); how the test appears in orders and results. It must match what clinicians expect. Enter the official test name used at your lab."),
    '4': tip("Lab section subscript (CH, MI, BB, and so on). It routes work to the correct area in Lab package. Choose the subscript that matches where the test is performed."),
    '3': tip("Whether the test is input, output, both, or a panel. That controls data flow and how Lab stores and releases results. Set it to match how the instrument and workflow behave."),
    '5': tip("Accession area or collection site for this test. It ties specimens and workload to a location. Enter the site or area code your Lab service uses."),
    '51': tip("Short print name or mnemonic used on reports and labels. It saves space where the full test name is too long. Enter an unambiguous abbreviation approved by the lab."),
  };
  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Laboratory › <a href="#/lab-tests">Lab Tests</a> › ${escapeHtml(d['.01'] || 'IEN ' + ien)}</div>
    <div class="page-header"><h1>${escapeHtml(d['.01'] || 'Lab Test')} <small style="opacity:.5">(IEN ${escapeHtml(ien)})</small></h1>${sourceBadge(res.source)}</div>
    <div class="explanation-header">
      <strong>Lab Test Detail</strong> — File 60 record. Type: Input (receives values), Output (sends results), Both, Panel (group of tests).
      Subscript assigns the test to a lab section. Read-only view via <code>DDR GETS ENTRY DATA</code>.
    </div>
    <dl class="detail-grid">${Object.entries(fieldMap).map(([f, label]) => {
      let val = d[f] || '—';
      if (f === '3') val = typeMap[d[f]] || d[f] || '—';
      if (f === '4') val = subMap[d[f]] || d[f] || '—';
      return `<div class="detail-row"><dt>${escapeHtml(label)} ${labFieldTips[f] || ''} <small>(${f})</small></dt><dd>${f === '13' ? '<code>' + escapeHtml(val) + '</code>' : escapeHtml(val)}</dd></div>`;
    }).join('')}</dl>
    ${renderFieldEditForm('labtest', ien, { '.01': 'Test Name', '3': 'Type', '4': 'Subscript', '5': 'Accession Area', '51': 'Print Name' }, {
      '.01': 'Official lab test name used in orders and results.',
      '3': 'Type: I=Input, O=Output, B=Both, P=Panel, N=Neither.',
      '4': 'Lab section: CH, HE, MI, BB, SP, CY, EM, AU.',
      '51': 'Short print name for reports and labels.'
    })}
    <div style="margin-top:1.5rem"><a href="#/lab-tests" class="btn-secondary">← Back to Lab Tests</a></div>`;
  wireFieldEditForm('labtest', ien, `lab-tests/${encodeURIComponent(ien)}`, {
    '.01': 'Official lab test name used in orders and results.',
    '3': 'Type: I=Input, O=Output, B=Both, P=Panel, N=Neither.',
    '4': 'Lab section: CH, HE, MI, BB, SP, CY, EM, AU.',
    '51': 'Short print name for reports and labels.'
  });
}

// ---------------------------------------------------------------------------
// Package detail (File 9.4) — DDR GETS read-only
// ---------------------------------------------------------------------------
async function renderPackageDetail(el, ien) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/params/kernel">System</a> › Packages › IEN ${escapeHtml(ien)}</div><div class="loading-message">Loading…</div>`;
  const res = await api(`packages/${ien}`);
  if (!res.ok) { el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/params/kernel">System</a></div><div class="error-message">${escapeHtml(res.error || 'Failed to load')}</div>`; return; }
  const d = res.data || {};
  const fieldMap = { '.01': 'Package Name', '1': 'Prefix', '2': 'Short Description', '3': 'Class (I/II/III)', '13': 'Menu Option (File 19 entry)', '14': 'KIDS Build Number' };
  const pkgFieldTips = {
    '.01': tip("Official package name (field .01); identifies the VistA application in lists and KIDS. Use the name shipped with the package or your IRM standard."),
    '1': tip("Routine namespace prefix (often two letters). Routines and files for the package usually start with this prefix. Enter the prefix the developer documentation lists."),
    '14': tip("KIDS build or version marker for this package install. It matters for patching and support so you know what code level is on disk. Enter the build from the last install or patch."),
    '2': tip("One-line summary of what the package does. It helps operators recognize the module without opening manuals. Enter plain language that matches the package purpose."),
  };
  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/params/kernel">System</a> › Packages › ${escapeHtml(d['.01'] || 'IEN ' + ien)}</div>
    <div class="page-header"><h1>${escapeHtml(d['.01'] || 'Package')} <small style="opacity:.5">(IEN ${escapeHtml(ien)})</small></h1>${sourceBadge(res.source)}</div>
    <div class="explanation-header">
      <strong>VistA Package Detail</strong> — File 9.4 record. Each package is a VistA module (e.g., Kernel, Fileman, Order Entry).
      The prefix determines routine namespace (e.g., XU for Kernel). Class I = nationally released, Class III = local.
      Read-only view via <code>DDR GETS ENTRY DATA</code>.
    </div>
    <dl class="detail-grid">${Object.entries(fieldMap).map(([f, label]) => `<div class="detail-row"><dt>${escapeHtml(label)} ${pkgFieldTips[f] || ''} <small>(${f})</small></dt><dd>${escapeHtml(d[f] || '—')}</dd></div>`).join('')}</dl>
    <div style="margin-top:1.5rem"><a href="#/packages" class="btn-secondary">← Back to Packages</a></div>`;
}

// ---------------------------------------------------------------------------
// TaskMan task detail (File 14.4) — DDR GETS read-only
// Note: File 14.4 (TASK) is protected and DDR GETS may return [ERROR].
// The detail view shows what's available; task data is best viewed in the list.
// ---------------------------------------------------------------------------
async function renderTaskManDetail(el, ien) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/params/kernel">System</a> › <a href="#/taskman">TaskMan</a> › Task ${escapeHtml(ien)}</div><div class="loading-message">Loading…</div>`;
  const res = await api(`taskman-tasks/${ien}`);
  if (!res.ok) { el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/taskman">TaskMan</a></div><div class="error-message">${escapeHtml(res.error || 'Failed to load')}</div>`; return; }
  const d = res.data?.data || res.data || {};
  const hasData = Object.keys(d).some(k => k !== '_rawLines' && d[k]);
  const statusMap = { '0': 'Pending', '1': 'Active', '2': 'Completed', '3': 'Error', '4': 'Interrupted', '5': 'Available' };
  const fieldMap = { '.01': 'Scheduled Run Time', '2': 'Entry Point / Routine', '6': 'Status' };
  const taskManFieldTips = {
    '.01': tip("When this task is scheduled to run (field .01 in File 14.4). It drives queue order and repeated jobs. Values come from the scheduler; you normally do not type them here in this read-only view."),
    '6': tip("Task state: pending, active, completed, error, and so on. Operators use status to see if background work succeeded. Interpret the value against TaskMan documentation for your release."),
    '2': tip("Routine and label where execution begins (entry point). Wrong entry causes the task to fail immediately. This should match the compiled routine the job was queued with."),
  };
  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/params/kernel">System</a> › <a href="#/taskman">TaskMan</a> › Task #${escapeHtml(ien)}</div>
    <div class="page-header"><h1>Task #${escapeHtml(ien)}</h1>${sourceBadge(res.source)}</div>
    <div class="explanation-header">
      <strong>TaskMan Task Detail</strong> — File 14.4 record. TaskMan is VistA's background job scheduler.
      ${hasData ? 'Read-only view via <code>DDR GETS ENTRY DATA</code>.' : '<span style="color:var(--warning)">Note:</span> File 14.4 (TASK) restricts DDR GETS access for many entries. Task data is best viewed in the <a href="#/taskman">TaskMan list</a>.'}
    </div>
    ${hasData ? `<dl class="detail-grid">${Object.entries(fieldMap).map(([f, label]) => {
      let val = d[f] || '—';
      if (f === '6') val = statusMap[d[f]] || d[f] || '—';
      return `<div class="detail-row"><dt>${escapeHtml(label)} ${taskManFieldTips[f] || ''} <small>(${f})</small></dt><dd>${f === '2' ? '<code>' + escapeHtml(val) + '</code>' : escapeHtml(val)}</dd></div>`;
    }).join('')}</dl>` : `<div class="notice" style="padding:1rem;background:var(--bg-secondary);border-radius:8px;margin-top:1rem;">
      <p>DDR GETS returned no data for Task #${escapeHtml(ien)}. File 14.4 restricts field-level access for many task entries.</p>
      <p>Task metadata (entry point, routine, status) is visible in the <a href="#/taskman">TaskMan list view</a> via DDR LISTER.</p>
    </div>`}
    <div style="margin-top:1.5rem"><a href="#/taskman" class="btn-secondary">← Back to TaskMan</a></div>`;
}

// ---------------------------------------------------------------------------
// Order Entry Configuration — Quick Orders (101.41) + Order Sets (101.43)
// ---------------------------------------------------------------------------
async function renderOrderConfig(el) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Clinical Config › Order Entry</div><div class="loading-message">Loading…</div>`;
  const [qoRes, osRes] = await Promise.all([api('quick-orders'), api('order-sets')]);
  const qo = qoRes.ok ? (qoRes.data || []) : [];
  const os = osRes.ok ? (osRes.data || []) : [];
  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Clinical Config › Order Entry Configuration</div>
    <div class="page-header"><h1>Order Entry Configuration</h1>${sourceBadge(qoRes.source || osRes.source)}</div>
    <div class="explanation-header">
      <strong>CPRS Order Entry Configuration</strong>
      Quick Orders (File 101.41) are pre-built order templates that clinicians select in CPRS.
      Order Sets (File 101.43) group multiple quick orders for common scenarios.
      Both are read-only views via <code>DDR LISTER</code>. Edit through VistA CPRS Config (ORCM).
    </div>

    <div class="detail-section">
      <h2>Quick Orders (File 101.41) — ${qo.length} found</h2>
      <div class="filter-rail">
        <input type="text" id="qo-search" placeholder="Search quick orders…" />
        <span class="result-count" id="qo-count">${qo.length} quick orders</span>
      </div>
      <table class="data-table">
        <thead><tr><th>IEN</th><th>Name</th><th>Display Group</th></tr></thead>
        <tbody id="qo-tbody">${qo.length ? qo.map(r => `<tr class="clickable-row" data-href="#/quick-orders/${r.ien}"><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.displayGroup || '—')}</td></tr>`).join('') : '<tr><td colspan="3">No quick orders found</td></tr>'}</tbody>
      </table>
    </div>

    <div class="detail-section">
      <h2>Order Sets (File 101.43) — ${os.length} found</h2>
      <div class="filter-rail">
        <input type="text" id="os-search" placeholder="Search order sets…" />
        <span class="result-count" id="os-count">${os.length} order sets</span>
      </div>
      <table class="data-table">
        <thead><tr><th>IEN</th><th>Name</th><th>Display Group</th><th>Creator</th></tr></thead>
        <tbody id="os-tbody">${os.length ? os.map(r => `<tr class="clickable-row" data-href="#/order-sets/${r.ien}"><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.displayGroup || '—')}</td><td>${escapeHtml(r.creator || '—')}</td></tr>`).join('') : '<tr><td colspan="4">No order sets found</td></tr>'}</tbody>
      </table>
    </div>`;
  wireClickableRows('qo-tbody');
  wireClickableRows('os-tbody');
  document.getElementById('qo-search').addEventListener('input', () => {
    const q = (document.getElementById('qo-search').value || '').toLowerCase();
    const filtered = qo.filter(r => (r.name || '').toLowerCase().includes(q));
    document.getElementById('qo-tbody').innerHTML = filtered.map(r => `<tr class="clickable-row" data-href="#/quick-orders/${r.ien}"><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.displayGroup || '—')}</td></tr>`).join('');
    wireClickableRows('qo-tbody');
    document.getElementById('qo-count').textContent = `${filtered.length} of ${qo.length} quick orders`;
  });
  document.getElementById('os-search').addEventListener('input', () => {
    const q = (document.getElementById('os-search').value || '').toLowerCase();
    const filtered = os.filter(r => (r.name || '').toLowerCase().includes(q));
    document.getElementById('os-tbody').innerHTML = filtered.map(r => `<tr class="clickable-row" data-href="#/order-sets/${r.ien}"><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.displayGroup || '—')}</td><td>${escapeHtml(r.creator || '—')}</td></tr>`).join('');
    wireClickableRows('os-tbody');
    document.getElementById('os-count').textContent = `${filtered.length} of ${os.length} order sets`;
  });
}

async function renderQuickOrderDetail(el, ien) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/order-config">Order Config</a> › Quick Order ${escapeHtml(ien)}</div><div class="loading-message">Loading…</div>`;
  const res = await api(`quick-orders/${ien}`);
  if (!res.ok) { el.innerHTML = `<div class="breadcrumb"><a href="#/order-config">Order Config</a></div><div class="error-message">${escapeHtml(res.error || 'Failed to load')}</div>`; return; }
  const d = res.data?.data || res.data || {};
  const fieldMap = { '.01': 'Name', '2': 'Orderable Item', '5': 'Display Group', '6': 'Dialog Type', '7': 'Menu Text' };
  const qoFieldTips = {
    '.01': tip("Quick order name (field .01); how this template appears in CPRS quick-order lists. Clinicians pick by this label. Use a clear name that states the order intent."),
    '5': tip("Display group controls which CPRS ordering tab or group shows this quick order. Wrong group hides it from users who need it. Match the group your service line uses."),
    '6': tip("Dialog type selects which order-entry dialog opens (meds, labs, nursing, and so on). It must match the orderable item category. Set it to the dialog the package expects for this item."),
  };
  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/order-config">Order Config</a> › ${escapeHtml(d['.01'] || 'Quick Order')}</div>
    <div class="page-header"><h1>${escapeHtml(d['.01'] || 'Quick Order')} <small style="opacity:.5">(IEN ${escapeHtml(ien)})</small></h1>${sourceBadge(res.source)}</div>
    <div class="explanation-header"><strong>Quick Order Detail</strong> — File 101.41 record via <code>DDR GETS ENTRY DATA</code>.</div>
    <dl class="detail-grid">${Object.entries(fieldMap).map(([f, label]) => `<div class="detail-row"><dt>${escapeHtml(label)} ${qoFieldTips[f] || ''} <small>(${f})</small></dt><dd>${escapeHtml(d[f] || '—')}</dd></div>`).join('')}</dl>
    ${renderFieldEditForm('quickorder', ien, { '.01': 'Name', '5': 'Display Group' }, {
      '.01': 'Quick order name. Clinicians select by this label.',
      '5': 'Display group controls which CPRS ordering tab shows this.',
    })}
    <div style="margin-top:1.5rem"><a href="#/order-config" class="btn-secondary">← Back to Order Config</a></div>`;
  wireFieldEditForm('quickorder', ien, `quick-orders/${encodeURIComponent(ien)}`, {
    '.01': 'Quick order name', '5': 'Display group',
  });
}

async function renderOrderSetDetail(el, ien) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/order-config">Order Config</a> › Order Set ${escapeHtml(ien)}</div><div class="loading-message">Loading…</div>`;
  const res = await api(`order-sets/${ien}`);
  if (!res.ok) { el.innerHTML = `<div class="breadcrumb"><a href="#/order-config">Order Config</a></div><div class="error-message">${escapeHtml(res.error || 'Failed to load')}</div>`; return; }
  const d = res.data?.data || res.data || {};
  const fieldMap = { '.01': 'Name', '2': 'Display Group', '3': 'Creator' };
  const osFieldTips = {
    '.01': tip("Order set name (field .01); label for bundled quick orders used in common scenarios. Enter a scenario-based name users will recognize (for example admission orders)."),
    '2': tip("Display group where CPRS lists this order set alongside related quick orders. It keeps sets discoverable for the right service. Choose the same group convention as your other order-entry items."),
    '3': tip("User who created or owns the set for audit and maintenance. It helps IRM find who to contact before changes. Enter the responsible clinician or builder account."),
  };
  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/order-config">Order Config</a> › ${escapeHtml(d['.01'] || 'Order Set')}</div>
    <div class="page-header"><h1>${escapeHtml(d['.01'] || 'Order Set')} <small style="opacity:.5">(IEN ${escapeHtml(ien)})</small></h1>${sourceBadge(res.source)}</div>
    <div class="explanation-header"><strong>Order Set Detail</strong> — File 101.43 record via <code>DDR GETS ENTRY DATA</code>.</div>
    <dl class="detail-grid">${Object.entries(fieldMap).map(([f, label]) => `<div class="detail-row"><dt>${escapeHtml(label)} ${osFieldTips[f] || ''} <small>(${f})</small></dt><dd>${escapeHtml(d[f] || '—')}</dd></div>`).join('')}</dl>
    ${renderFieldEditForm('orderset', ien, { '.01': 'Name', '2': 'Display Group' }, {
      '.01': 'Order set name. Used in CPRS as a bundled order scenario label.',
      '2': 'Display group for discoverability in order lists.',
    })}
    <div style="margin-top:1.5rem"><a href="#/order-config" class="btn-secondary">← Back to Order Config</a></div>`;
  wireFieldEditForm('orderset', ien, `order-sets/${encodeURIComponent(ien)}`, {
    '.01': 'Order set name', '2': 'Display group',
  });
}

// ---------------------------------------------------------------------------
// Billing Parameters (File 350.9 — IB Site Parameters)
// ---------------------------------------------------------------------------
async function renderBillingParams(el) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Billing &amp; Insurance › Billing Parameters</div><div class="loading-message">Loading…</div>`;
  const res = await api('billing-params');
  if (!res.ok) { el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Billing</div><div class="error-message">${escapeHtml(res.error || 'Failed to load')}</div>`; return; }
  const d = res.data?.data || res.data || {};
  const hasData = Object.keys(d).some(k => k !== '_rawLines' && d[k]);
  const fieldMap = { '.01': 'Site', '.02': 'Institution', '.03': 'Mail Group', '1': 'IB Site Type', '2': 'Copay Release Date', '3': 'Copay Background', '4': 'MCCR Utility', '5': 'IB Number', '8': 'Default Rate Schedule' };
  const billingParamTips = {
    '.01': tip("Site pointer for this IB parameter record (field .01). It ties billing rules to a specific facility. Must match the site you are configuring in File 350.9."),
    '.02': tip("Institution associated with billing; used for AR and reporting context. Wrong institution misattributes charges. Select the Medical Center Division that owns revenue for this site."),
    '.03': tip("Mail group for IB notices and background alerts. Operators receive billing exceptions there. Enter a valid Mail Group that includes fiscal and IRM staff who act on IB mail."),
    '1': tip("IB site type classification (inpatient, outpatient, combined). It drives which IB routines and defaults apply. Set according to how this site files encounters and charges."),
    '2': tip("Date copay processing was released or last reset for the site. It matters for copay billing history and audits. Enter the date your business office specifies when enabling copay."),
    '3': tip("Whether copay runs as a background job at this site. Turning it on schedules periodic copay work; turning it off stops automation. Align with local copay operations policy."),
    '4': tip("MCCR utility option for cost recovery workflows. It links to tools that support Management Cost Containment Recovery. Enable only when MCCR is licensed and staffed at your site."),
    '5': tip("Integrated Billing site or account number used in IB identifiers. It surfaces on claims-related context. Enter the number your IB coordinator assigns for this facility."),
    '8': tip("Default rate schedule for charges without an explicit schedule. Wrong default mis-prices services. Pick the standard fee schedule your CFO or P and T approved as the site default."),
  };
  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Billing &amp; Insurance › Billing Parameters</div>
    <div class="page-header"><h1>IB Site Parameters (File 350.9)</h1>${sourceBadge(res.source)}</div>
    <div class="explanation-header">
      <strong>Integrated Billing Site Parameters</strong>
      File 350.9 stores site-level billing configuration. IEN 1 is the main site record.
      Controls copay processing, rate schedules, and MCCR (Management Cost Containment Recovery) settings.
      ${hasData ? 'Read-only view via <code>DDR GETS ENTRY DATA</code>.' : '<span style="color:var(--warning)">File 350.9 may not be populated in this VistA instance.</span>'}
    </div>
    ${hasData ? `<dl class="detail-grid">${Object.entries(fieldMap).map(([f, label]) => `<div class="detail-row"><dt>${escapeHtml(label)} ${billingParamTips[f] || ''} <small>(${f})</small></dt><dd>${escapeHtml(d[f] || '—')}</dd></div>`).join('')}</dl>` : `<div class="notice" style="padding:1rem;background:var(--bg-secondary);border-radius:8px;margin-top:1rem;">
      <p>DDR GETS returned no data for File 350.9 IEN 1. The IB Site Parameters file may not be configured in this VistA instance.</p>
      <p>In VistA terminal: <code>IB SITE PARAMETERS EDIT</code> (IB files) to configure billing parameters.</p>
    </div>`}
    <div style="margin-top:1.5rem"><a href="#/dashboard" class="btn-secondary">← Back to Dashboard</a></div>`;
}

// ---------------------------------------------------------------------------
// Health Summary Types (File 142) — DDR LISTER + DDR FILER (CRUD)
// ---------------------------------------------------------------------------
async function renderHealthSummaryConfig(el) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> > Clinical Config > Health Summary</div><div class="loading-message">Loading health summary types...</div>`;
  const res = await api('health-summary-types');
  if (!res.ok) { el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> > Clinical Config > Health Summary</div><div class="error-message">${escapeHtml(res.error || 'Failed to load')}</div>`; return; }
  const rows = res.data || [];
  let editIen = null;

  function render() {
    el.innerHTML = `
      <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> > Clinical Config > Health Summary Types</div>
      <div class="page-header"><h1>Health Summary Types (File 142)</h1>${sourceBadge(res.source)}</div>
      <div class="explanation-header">
        <strong>Health Summary Configuration</strong>
        File 142 defines summary report templates that clinicians see. Each type controls which clinical components (vitals, labs, meds, notes) appear
        and in what order. Click any row to view details and edit settings. Changes write directly to VistA via <code>DDR FILER</code>.
      </div>
      <div class="filter-rail">
        <input type="text" id="hs-search" placeholder="Search by name..." />
        <span class="result-count" id="hs-count">${rows.length} types</span>
      </div>
      <table class="data-table">
        <thead><tr><th>IEN</th><th>Name</th><th>Title</th><th>Lock</th><th>Owner</th><th>Suppress Empty</th><th>National</th><th></th></tr></thead>
        <tbody id="hs-tbody">${rows.length ? rows.map(r => `<tr>
          <td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.title || '-')}</td>
          <td>${escapeHtml(r.lock || '-')}</td><td>${escapeHtml(r.owner || '-')}</td>
          <td>${r.suppressWithoutData === 'Y' ? 'Yes' : r.suppressWithoutData || '-'}</td>
          <td>${r.nationallyExported === 'Y' ? 'Yes' : r.nationallyExported || '-'}</td>
          <td><button class="btn-sm" data-ien="${r.ien}">Edit</button></td>
        </tr>`).join('') : '<tr><td colspan="8">No health summary types found</td></tr>'}</tbody>
      </table>
      <div id="hs-detail"></div>`;
    document.getElementById('hs-search')?.addEventListener('input', applyFilter);
    document.querySelectorAll('#hs-tbody button[data-ien]').forEach(btn => btn.addEventListener('click', () => loadDetail(btn.dataset.ien)));
  }

  function applyFilter() {
    const q = (document.getElementById('hs-search')?.value || '').toLowerCase();
    const filtered = rows.filter(r => (r.name || '').toLowerCase().includes(q) || (r.title || '').toLowerCase().includes(q));
    document.getElementById('hs-tbody').innerHTML = filtered.map(r => `<tr>
      <td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.title || '-')}</td>
      <td>${escapeHtml(r.lock || '-')}</td><td>${escapeHtml(r.owner || '-')}</td>
      <td>${r.suppressWithoutData === 'Y' ? 'Yes' : r.suppressWithoutData || '-'}</td>
      <td>${r.nationallyExported === 'Y' ? 'Yes' : r.nationallyExported || '-'}</td>
      <td><button class="btn-sm" data-ien="${r.ien}">Edit</button></td>
    </tr>`).join('');
    document.querySelectorAll('#hs-tbody button[data-ien]').forEach(btn => btn.addEventListener('click', () => loadDetail(btn.dataset.ien)));
    document.getElementById('hs-count').textContent = `${filtered.length} of ${rows.length} types`;
  }

  async function loadDetail(ien) {
    const det = document.getElementById('hs-detail');
    det.innerHTML = '<div class="loading-message">Loading detail...</div>';
    const d = await api(`health-summary-types/${ien}`);
    if (!d.ok) { det.innerHTML = `<div class="error-message">${escapeHtml(d.error || 'Failed')}</div>`; return; }
    const f = d.data || {};
    det.innerHTML = `
      <div style="margin-top:16px;padding:16px;border:1px solid var(--color-border);border-radius:8px;background:var(--color-surface);">
        <h3>Edit Health Summary Type (IEN ${escapeHtml(ien)})</h3>
        <div class="form-grid">
          <label>Name (.01)</label><input type="text" id="hs-e-name" value="${escapeHtml(f['.01'] || '')}" />
          <label>Title (.02)</label><input type="text" id="hs-e-title" value="${escapeHtml(f['.02'] || '')}" />
          <label>Lock (.05)</label><input type="text" id="hs-e-lock" value="${escapeHtml(f['.05'] || '')}" placeholder="Security key name" />
          <label>Suppress Empty (.08)</label><select id="hs-e-suppress"><option value="">-</option><option value="Y" ${f['.08']==='Y'?'selected':''}>Yes</option><option value="N" ${f['.08']==='N'?'selected':''}>No</option></select>
        </div>
        <div style="margin-top:12px;display:flex;gap:8px;">
          <button class="btn-primary" id="hs-save">Save to VistA</button>
          <button class="btn-secondary" id="hs-cancel">Cancel</button>
        </div>
        <div id="hs-save-status" style="margin-top:8px;"></div>
      </div>`;
    document.getElementById('hs-save').addEventListener('click', async () => {
      const payload = { name: document.getElementById('hs-e-name').value, title: document.getElementById('hs-e-title').value, lock: document.getElementById('hs-e-lock').value, suppressWithoutData: document.getElementById('hs-e-suppress').value };
      const st = document.getElementById('hs-save-status');
      st.innerHTML = '<span style="color:var(--color-warning);">Saving...</span>';
      const r = await apiPut(`health-summary-types/${ien}`, payload);
      if (r.ok) { st.innerHTML = '<span style="color:var(--color-success);">Saved to VistA</span>'; const ref = await api('health-summary-types'); if (ref.ok) { rows.length = 0; rows.push(...ref.data); } }
      else st.innerHTML = `<span style="color:var(--color-danger);">Error: ${escapeHtml(r.error || 'Save failed')}</span>`;
    });
    document.getElementById('hs-cancel').addEventListener('click', () => { det.innerHTML = ''; });
    const compRes = await api(`health-summary-types/${ien}/components`);
    const compDiv = document.createElement('div');
    compDiv.style.cssText = 'margin-top:12px;padding:12px;border:1px solid var(--color-border);border-radius:8px;background:var(--color-surface-alt,#f9f9fb);';
    if (compRes.ok) {
      const comps = compRes.data || [];
      compDiv.innerHTML = `<h4>Components (${comps.length})</h4>` +
        (comps.length ? `<table class="data-table" style="font-size:13px;"><thead><tr><th>Seq</th><th>Component Type</th></tr></thead><tbody>${comps.map(c => `<tr><td>${escapeHtml(c.ien)}</td><td>${escapeHtml(c.type)}</td></tr>`).join('')}</tbody></table>` : '<div class="info-note">No components configured for this summary type.</div>');
    } else {
      compDiv.innerHTML = `<h4>Components</h4><div class="info-note" style="color:var(--color-warning);">Components: ${escapeHtml(compRes.error || 'integration-pending')}</div>`;
    }
    det.appendChild(compDiv);
  }
  render();
}

// ---------------------------------------------------------------------------
// TIU Document Definitions (File 8925.1) — DDR LISTER + DDR FILER (CRUD)
// ---------------------------------------------------------------------------
async function renderTiuConfig(el) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> > Clinical Config > TIU</div><div class="loading-message">Loading TIU document definitions...</div>`;
  const res = await api('tiu-document-defs');
  if (!res.ok) { el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> > Clinical Config > TIU</div><div class="error-message">${escapeHtml(res.error || 'Failed to load')}</div>`; return; }
  const rows = res.data || [];
  const typeMap = { 'DOC': 'Document', 'DC': 'Document Class', 'CL': 'Class', 'O': 'Object' };
  const statusMap = { '11': 'Active', '0': 'Inactive', '7': 'Test' };

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> > Clinical Config > TIU Document Definitions</div>
    <div class="page-header"><h1>TIU Document Definitions (File 8925.1)</h1>${sourceBadge(res.source)}</div>
    <div class="explanation-header">
      <strong>Clinical Documentation Configuration</strong>
      File 8925.1 stores every note title and document class in VistA's Text Integration Utility (TIU). Clinicians see these when creating
      progress notes, discharge summaries, consult reports, etc. Type classifies the hierarchy: Class > Document Class > Document.
      Click a row to edit the definition. Changes write to VistA via <code>DDR FILER</code>.
    </div>
    <div class="filter-rail">
      <input type="text" id="tiu-search" placeholder="Search by name or abbreviation..." />
      <select id="tiu-type-filter"><option value="">All Types</option>${Object.entries(typeMap).map(([k,v]) => `<option value="${k}">${v} (${k})</option>`).join('')}</select>
      <span class="result-count" id="tiu-count">${rows.length} definitions</span>
    </div>
    <table class="data-table">
      <thead><tr><th>IEN</th><th>Name</th><th>Abbreviation</th><th>Print Name</th><th>Type</th><th>Status</th><th></th></tr></thead>
      <tbody id="tiu-tbody"></tbody>
    </table>
    <div id="tiu-detail"></div>`;

  function renderRows(list) {
    document.getElementById('tiu-tbody').innerHTML = list.length ? list.map(r => `<tr>
      <td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.abbreviation || '-')}</td>
      <td>${escapeHtml(r.printName || '-')}</td><td>${escapeHtml(typeMap[r.type] || r.type || '-')}</td>
      <td>${escapeHtml(statusMap[r.status] || r.status || '-')}</td>
      <td><button class="btn-sm" data-ien="${r.ien}">Edit</button></td>
    </tr>`).join('') : '<tr><td colspan="7">No definitions found</td></tr>';
    document.querySelectorAll('#tiu-tbody button[data-ien]').forEach(btn => btn.addEventListener('click', () => loadTiuDetail(btn.dataset.ien)));
  }

  function applyFilter() {
    const q = (document.getElementById('tiu-search').value || '').toLowerCase();
    const typ = document.getElementById('tiu-type-filter').value;
    const filtered = rows.filter(r => {
      if (q && !(r.name || '').toLowerCase().includes(q) && !(r.abbreviation || '').toLowerCase().includes(q)) return false;
      if (typ && r.type !== typ) return false;
      return true;
    });
    renderRows(filtered);
    document.getElementById('tiu-count').textContent = `${filtered.length} of ${rows.length} definitions`;
  }

  async function loadTiuDetail(ien) {
    const det = document.getElementById('tiu-detail');
    det.innerHTML = '<div class="loading-message">Loading detail...</div>';
    const d = await api(`tiu-document-defs/${ien}`);
    if (!d.ok) { det.innerHTML = `<div class="error-message">${escapeHtml(d.error || 'Failed')}</div>`; return; }
    const f = d.data || {};
    det.innerHTML = `
      <div style="margin-top:16px;padding:16px;border:1px solid var(--color-border);border-radius:8px;background:var(--color-surface);">
        <h3>Edit TIU Definition (IEN ${escapeHtml(ien)})</h3>
        <div class="form-grid">
          <label>Name (.01)</label><input type="text" id="tiu-e-name" value="${escapeHtml(f['.01'] || '')}" />
          <label>Abbreviation (.02)</label><input type="text" id="tiu-e-abbr" value="${escapeHtml(f['.02'] || '')}" />
          <label>Print Name (.03)</label><input type="text" id="tiu-e-print" value="${escapeHtml(f['.03'] || '')}" />
          <label>Status (.07)</label><select id="tiu-e-status"><option value="">-</option><option value="11" ${f['.07']==='11'?'selected':''}>Active</option><option value="0" ${f['.07']==='0'?'selected':''}>Inactive</option><option value="7" ${f['.07']==='7'?'selected':''}>Test</option></select>
        </div>
        <div style="margin-top:12px;display:flex;gap:8px;">
          <button class="btn-primary" id="tiu-save">Save to VistA</button>
          <button class="btn-secondary" id="tiu-cancel">Cancel</button>
        </div>
        <div id="tiu-save-status" style="margin-top:8px;"></div>
      </div>`;
    document.getElementById('tiu-save').addEventListener('click', async () => {
      const payload = { name: document.getElementById('tiu-e-name').value, abbreviation: document.getElementById('tiu-e-abbr').value, printName: document.getElementById('tiu-e-print').value, status: document.getElementById('tiu-e-status').value };
      const st = document.getElementById('tiu-save-status');
      st.innerHTML = '<span style="color:var(--color-warning);">Saving...</span>';
      const r = await apiPut(`tiu-document-defs/${ien}`, payload);
      if (r.ok) { st.innerHTML = '<span style="color:var(--color-success);">Saved to VistA</span>'; }
      else st.innerHTML = `<span style="color:var(--color-danger);">Error: ${escapeHtml(r.error || 'Save failed')}</span>`;
    });
    document.getElementById('tiu-cancel').addEventListener('click', () => { det.innerHTML = ''; });
  }

  renderRows(rows);
  document.getElementById('tiu-search').addEventListener('input', applyFilter);
  document.getElementById('tiu-type-filter').addEventListener('change', applyFilter);
}

// ---------------------------------------------------------------------------
// Mail Groups (File 3.8) — DDR LISTER + DDR FILER (CRUD)
// ---------------------------------------------------------------------------
async function renderMailGroups(el) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/params/kernel">System</a> › Mail Groups</div><div class="loading-message">Loading mail groups...</div>`;
  const res = await api('mail-groups');
  if (!res.ok) { el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/params/kernel">System</a> › Mail Groups</div><div class="error-message">${escapeHtml(res.error || 'Failed to load')}</div>`; return; }
  const rows = res.data || [];
  const typeMap = { 'PU': 'Public', 'PR': 'Private', 'PO': 'Personal' };

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/params/kernel">System</a> › MailMan Groups</div>
    <div class="page-header"><h1>MailMan Groups (File 3.8)</h1>${sourceBadge(res.source)}</div>
    <div class="explanation-header">
      <strong>VistA Internal Messaging Groups</strong>
      File 3.8 stores MailMan distribution groups used for internal VistA messaging. Alerts, notifications, and system messages are routed to these groups.
      Public groups accept messages from anyone; Private groups restrict senders. Click a row to edit group settings.
    </div>
    <div class="filter-rail">
      <input type="text" id="mg-search" placeholder="Search groups..." />
      <select id="mg-type-filter"><option value="">All Types</option>${Object.entries(typeMap).map(([k,v]) => `<option value="${k}">${v} (${k})</option>`).join('')}</select>
      <span class="result-count" id="mg-count">${rows.length} groups</span>
    </div>
    <table class="data-table">
      <thead><tr><th>IEN</th><th>Group Name</th><th>Type</th><th>Organizer</th><th>Self-Enroll</th><th>Restrictions</th><th></th></tr></thead>
      <tbody id="mg-tbody"></tbody>
    </table>
    <div id="mg-detail"></div>`;

  function renderRows(list) {
    document.getElementById('mg-tbody').innerHTML = list.length ? list.map(r => `<tr>
      <td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td>
      <td>${escapeHtml(typeMap[r.type] || r.type || '-')}</td>
      <td>${escapeHtml(r.organizer || '-')}</td>
      <td>${r.selfEnroll === '1' ? 'Yes' : r.selfEnroll === '0' ? 'No' : r.selfEnroll || '-'}</td>
      <td>${escapeHtml(r.restrictions || '-')}</td>
      <td><button class="btn-sm" data-ien="${r.ien}">Edit</button></td>
    </tr>`).join('') : '<tr><td colspan="7">No mail groups found</td></tr>';
    document.querySelectorAll('#mg-tbody button[data-ien]').forEach(btn => btn.addEventListener('click', () => loadMgDetail(btn.dataset.ien)));
  }

  function applyFilter() {
    const q = (document.getElementById('mg-search').value || '').toLowerCase();
    const typ = document.getElementById('mg-type-filter').value;
    const filtered = rows.filter(r => {
      if (q && !(r.name || '').toLowerCase().includes(q)) return false;
      if (typ && r.type !== typ) return false;
      return true;
    });
    renderRows(filtered);
    document.getElementById('mg-count').textContent = `${filtered.length} of ${rows.length} groups`;
  }

  async function loadMgDetail(ien) {
    const det = document.getElementById('mg-detail');
    det.innerHTML = '<div class="loading-message">Loading detail...</div>';
    const d = await api(`mail-groups/${ien}`);
    if (!d.ok) { det.innerHTML = `<div class="error-message">${escapeHtml(d.error || 'Failed')}</div>`; return; }
    const f = d.data || {};
    det.innerHTML = `
      <div style="margin-top:16px;padding:16px;border:1px solid var(--color-border);border-radius:8px;background:var(--color-surface);">
        <h3>Edit Mail Group (IEN ${escapeHtml(ien)})</h3>
        <div class="form-grid">
          <label>Name (.01)</label><input type="text" id="mg-e-name" value="${escapeHtml(f['.01'] || '')}" />
          <label>Type (4)</label><select id="mg-e-type"><option value="">-</option><option value="PU" ${f['4']==='PU'?'selected':''}>Public</option><option value="PR" ${f['4']==='PR'?'selected':''}>Private</option></select>
          <label>Self-Enrollment (7)</label><select id="mg-e-enroll"><option value="">-</option><option value="1" ${f['7']==='1'?'selected':''}>Yes</option><option value="0" ${f['7']==='0'?'selected':''}>No</option></select>
          <label>Restrictions (10)</label><input type="text" id="mg-e-restrict" value="${escapeHtml(f['10'] || '')}" />
        </div>
        <div style="margin-top:12px;display:flex;gap:8px;">
          <button class="btn-primary" id="mg-save">Save to VistA</button>
          <button class="btn-secondary" id="mg-cancel">Cancel</button>
        </div>
        <div id="mg-save-status" style="margin-top:8px;"></div>
      </div>`;
    document.getElementById('mg-save').addEventListener('click', async () => {
      const payload = { name: document.getElementById('mg-e-name').value, type: document.getElementById('mg-e-type').value, selfEnroll: document.getElementById('mg-e-enroll').value, restrictions: document.getElementById('mg-e-restrict').value };
      const st = document.getElementById('mg-save-status');
      st.innerHTML = '<span style="color:var(--color-warning);">Saving...</span>';
      const r = await apiPut(`mail-groups/${ien}`, payload);
      if (r.ok) { st.innerHTML = '<span style="color:var(--color-success);">Saved to VistA</span>'; }
      else st.innerHTML = `<span style="color:var(--color-danger);">Error: ${escapeHtml(r.error || 'Save failed')}</span>`;
    });
    document.getElementById('mg-cancel').addEventListener('click', () => { det.innerHTML = ''; });
    const memRes = await api(`mail-groups/${ien}/members`);
    const memDiv = document.createElement('div');
    memDiv.style.cssText = 'margin-top:12px;padding:12px;border:1px solid var(--color-border);border-radius:8px;background:var(--color-surface-alt,#f9f9fb);';
    if (memRes.ok) {
      const members = memRes.data || [];
      memDiv.innerHTML = `<h4>Members (${members.length})</h4>` +
        (members.length ? `<table class="data-table" style="font-size:13px;"><thead><tr><th>DUZ</th><th>Name</th></tr></thead><tbody>${members.map(m => `<tr><td>${escapeHtml(m.ien)}</td><td>${escapeHtml(m.name)}</td></tr>`).join('')}</tbody></table>` : '<div class="info-note">No members in this group.</div>');
    } else {
      memDiv.innerHTML = `<h4>Members</h4><div class="info-note" style="color:var(--color-warning);">Members: ${escapeHtml(memRes.error || 'integration-pending')}</div>`;
    }
    det.appendChild(memDiv);
  }

  renderRows(rows);
  document.getElementById('mg-search').addEventListener('input', applyFilter);
  document.getElementById('mg-type-filter').addEventListener('change', applyFilter);
}

// ---------------------------------------------------------------------------
// Radiology Procedures (File 71) — DDR LISTER + DDR FILER (CRUD)
// ---------------------------------------------------------------------------
async function renderRadiologyConfig(el) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> > Clinical Config > Radiology</div><div class="loading-message">Loading radiology procedures...</div>`;
  const res = await api('radiology-procedures');
  if (!res.ok) { el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> > Clinical Config > Radiology</div><div class="error-message">${escapeHtml(res.error || 'Failed to load')}</div>`; return; }
  const rows = res.data || [];
  const procTypeMap = { 'D': 'Diagnostic', 'I': 'Interventional', 'B': 'Broad', 'S': 'Series', 'P': 'Parent' };
  const imgTypeMap = { '1': 'General Radiology', '2': 'CT Scan', '3': 'MRI', '4': 'Ultrasound', '5': 'Nuclear Medicine', '6': 'Angio/Neuro', '7': 'Cardiology', 'n': 'N/A' };

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> > Clinical Config > Radiology Procedures</div>
    <div class="page-header"><h1>Radiology Procedures (File 71)</h1>${sourceBadge(res.source)}</div>
    <div class="explanation-header">
      <strong>Imaging Procedure Configuration</strong>
      File 71 defines every radiology and nuclear medicine procedure available for ordering. Each procedure maps to a CPT code and imaging modality type.
      Type of Procedure classifies diagnostic vs interventional. Click a row to edit. Changes write to VistA via <code>DDR FILER</code>.
    </div>
    <div class="filter-rail">
      <input type="text" id="rad-search" placeholder="Search procedures or CPT..." />
      <select id="rad-img-filter"><option value="">All Imaging Types</option>${Object.entries(imgTypeMap).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}</select>
      <span class="result-count" id="rad-count">${rows.length} procedures</span>
    </div>
    <table class="data-table">
      <thead><tr><th>IEN</th><th>Procedure Name</th><th>Type</th><th>CPT Code</th><th>Imaging Type</th><th></th></tr></thead>
      <tbody id="rad-tbody"></tbody>
    </table>
    <div id="rad-detail"></div>`;

  function renderRows(list) {
    document.getElementById('rad-tbody').innerHTML = list.length ? list.map(r => `<tr>
      <td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td>
      <td>${escapeHtml(procTypeMap[r.procedureType] || r.procedureType || '-')}</td>
      <td><code>${escapeHtml(r.cptCode || '-')}</code></td>
      <td>${escapeHtml(imgTypeMap[r.imagingType] || r.imagingType || '-')}</td>
      <td><button class="btn-sm" data-ien="${r.ien}">Edit</button></td>
    </tr>`).join('') : '<tr><td colspan="6">No procedures found</td></tr>';
    document.querySelectorAll('#rad-tbody button[data-ien]').forEach(btn => btn.addEventListener('click', () => loadRadDetail(btn.dataset.ien)));
  }

  function applyFilter() {
    const q = (document.getElementById('rad-search').value || '').toLowerCase();
    const img = document.getElementById('rad-img-filter').value;
    const filtered = rows.filter(r => {
      if (q && !(r.name || '').toLowerCase().includes(q) && !(r.cptCode || '').includes(q)) return false;
      if (img && r.imagingType !== img) return false;
      return true;
    });
    renderRows(filtered);
    document.getElementById('rad-count').textContent = `${filtered.length} of ${rows.length} procedures`;
  }

  async function loadRadDetail(ien) {
    const det = document.getElementById('rad-detail');
    det.innerHTML = '<div class="loading-message">Loading detail...</div>';
    const d = await api(`radiology-procedures/${ien}`);
    if (!d.ok) { det.innerHTML = `<div class="error-message">${escapeHtml(d.error || 'Failed')}</div>`; return; }
    const f = d.data || {};
    det.innerHTML = `
      <div style="margin-top:16px;padding:16px;border:1px solid var(--color-border);border-radius:8px;background:var(--color-surface);">
        <h3>Edit Radiology Procedure (IEN ${escapeHtml(ien)})</h3>
        <div class="form-grid">
          <label>Name (.01)</label><input type="text" id="rad-e-name" value="${escapeHtml(f['.01'] || '')}" />
          <label>Type of Procedure (6)</label><select id="rad-e-type"><option value="">-</option>${Object.entries(procTypeMap).map(([k,v]) => `<option value="${k}" ${f['6']===k?'selected':''}>${v}</option>`).join('')}</select>
          <label>CPT Code (9)</label><input type="text" id="rad-e-cpt" value="${escapeHtml(f['9'] || '')}" />
          <label>Imaging Type (12)</label><select id="rad-e-img"><option value="">-</option>${Object.entries(imgTypeMap).map(([k,v]) => `<option value="${k}" ${f['12']===k?'selected':''}>${v}</option>`).join('')}</select>
        </div>
        <div style="margin-top:12px;display:flex;gap:8px;">
          <button class="btn-primary" id="rad-save">Save to VistA</button>
          <button class="btn-secondary" id="rad-cancel">Cancel</button>
        </div>
        <div id="rad-save-status" style="margin-top:8px;"></div>
      </div>`;
    document.getElementById('rad-save').addEventListener('click', async () => {
      const payload = { name: document.getElementById('rad-e-name').value, procedureType: document.getElementById('rad-e-type').value, cptCode: document.getElementById('rad-e-cpt').value, imagingType: document.getElementById('rad-e-img').value };
      const st = document.getElementById('rad-save-status');
      st.innerHTML = '<span style="color:var(--color-warning);">Saving...</span>';
      const r = await apiPut(`radiology-procedures/${ien}`, payload);
      if (r.ok) { st.innerHTML = '<span style="color:var(--color-success);">Saved to VistA</span>'; }
      else st.innerHTML = `<span style="color:var(--color-danger);">Error: ${escapeHtml(r.error || 'Save failed')}</span>`;
    });
    document.getElementById('rad-cancel').addEventListener('click', () => { det.innerHTML = ''; });
  }

  renderRows(rows);
  document.getElementById('rad-search').addEventListener('input', applyFilter);
  document.getElementById('rad-img-filter').addEventListener('change', applyFilter);
}

// ---------------------------------------------------------------------------
// Error Trap (File 3.077) — DDR LISTER (read-only monitoring)
// ---------------------------------------------------------------------------
async function renderErrorTrap(el) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/params/kernel">System</a> › Error Trap</div><div class="loading-message">Loading error trap...</div>`;
  const res = await api('error-trap');
  if (!res.ok) { el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/params/kernel">System</a> › Error Trap</div><div class="error-message">${escapeHtml(res.error || 'Failed to load')}</div>`; return; }
  const rows = res.data || [];
  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/params/kernel">System</a> › Error Trap</div>
    <div class="page-header"><h1>Error Trap (File 3.077)</h1>${sourceBadge(res.source)}</div>
    <div class="explanation-header">
      <strong>MUMPS Error Log</strong>
      File 3.077 captures MUMPS runtime errors (<code>^%ZTER</code>) including the error text, offending routine, frequency, and last global reference.
      Use this to diagnose system issues, identify frequently-failing routines, and track error patterns. High-frequency errors may indicate
      configuration problems or missing prerequisites.
    </div>
    <div class="filter-rail">
      <input type="text" id="et-search" placeholder="Search by error text or routine..." />
      <span class="result-count" id="et-count">${rows.length} errors</span>
    </div>
    <table class="data-table">
      <thead><tr><th>IEN</th><th>Error Text</th><th>Routine</th><th>Frequency</th><th>First Seen</th><th>Last Seen</th><th>Last Global</th></tr></thead>
      <tbody id="et-tbody">${rows.length ? rows.map(r => `<tr>
        <td>${escapeHtml(r.ien)}</td>
        <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(r.errorText)}">${escapeHtml(r.errorText || '-')}</td>
        <td><code>${escapeHtml(r.routineName || '-')}</code></td>
        <td style="text-align:center;">${escapeHtml(r.frequency || '-')}</td>
        <td>${escapeHtml(r.firstDateTime || '-')}</td>
        <td>${escapeHtml(r.mostRecentDateTime || '-')}</td>
        <td style="font-size:11px;max-width:200px;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(r.lastGlobal)}">${escapeHtml(r.lastGlobal || '-')}</td>
      </tr>`).join('') : '<tr><td colspan="7">No errors found in trap</td></tr>'}</tbody>
    </table>`;
  document.getElementById('et-search').addEventListener('input', () => {
    const q = (document.getElementById('et-search').value || '').toLowerCase();
    const filtered = rows.filter(r => (r.errorText || '').toLowerCase().includes(q) || (r.routineName || '').toLowerCase().includes(q));
    document.getElementById('et-tbody').innerHTML = filtered.map(r => `<tr>
      <td>${escapeHtml(r.ien)}</td>
      <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(r.errorText)}">${escapeHtml(r.errorText || '-')}</td>
      <td><code>${escapeHtml(r.routineName || '-')}</code></td>
      <td style="text-align:center;">${escapeHtml(r.frequency || '-')}</td>
      <td>${escapeHtml(r.firstDateTime || '-')}</td>
      <td>${escapeHtml(r.mostRecentDateTime || '-')}</td>
      <td style="font-size:11px;max-width:200px;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(r.lastGlobal)}">${escapeHtml(r.lastGlobal || '-')}</td>
    </tr>`).join('');
    document.getElementById('et-count').textContent = `${filtered.length} of ${rows.length} errors`;
  });
}

// ======================================================================
// AUDIT TRAIL — Sign-On Log, Failed Access, Programmer Mode
// ======================================================================

async function renderAuditTrail(el) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Monitoring &amp; Reports › Audit Trail</div>
    <div class="page-header"><h1>Audit Trail</h1><span class="source-posture live">LIVE VistA</span></div>
    <p class="page-description">User login/logout history, failed access attempts, programmer mode access, and FileMan data change audit. Data from VistA Files 3.081, 3.05, 3.07, and ^DIA(200).</p>
    ${renderTabBar([{id:'signon',label:'Sign-On Log'},{id:'failed',label:'Failed Access'},{id:'progmode',label:'Programmer Mode'},{id:'fileman',label:'Data Changes'}],'signon')}
    <div class="tab-content active" data-tab="signon"><div class="loading-indicator">Loading sign-on log...</div></div>
    <div class="tab-content" data-tab="failed"><div class="loading-indicator">Loading failed access...</div></div>
    <div class="tab-content" data-tab="progmode"><div class="loading-indicator">Loading programmer mode log...</div></div>
    <div class="tab-content" data-tab="fileman"><div class="loading-indicator">Loading FileMan audit trail...</div></div>`;
  wireTabBar(el);
  const [signon, failed, prog, fileman] = await Promise.all([
    api('audit/signon-log'), api('audit/failed-access'), api('audit/programmer-mode'), api('audit/fileman?duz=*&max=100'),
  ]);
  const sTab = el.querySelector('[data-tab="signon"]');
  if (signon.ok && signon.data && signon.data.length > 0) {
    sTab.innerHTML = `<div class="filter-rail"><input type="text" id="signon-search" placeholder="Search by user, IP, workstation..." /><span class="result-count">${signon.data.length} entries</span></div>
      <table class="data-table"><thead><tr><th>User</th><th>Device</th><th>IP Address</th><th>Workstation</th><th>Node</th><th>Sign-Off</th><th>Division</th></tr></thead>
      <tbody>${signon.data.map(r => `<tr><td>${escapeHtml(r.user)}</td><td>${escapeHtml(r.device||'--')}</td><td>${escapeHtml(r.ipAddress||'--')}</td><td>${escapeHtml(r.workstation||'--')}</td><td>${escapeHtml(r.nodeName||'--')}</td><td>${escapeHtml(r.signoffTime||'--')}</td><td>${escapeHtml(r.division||'--')}</td></tr>`).join('')}</tbody></table>`;
  } else { sTab.innerHTML = `<p class="empty-state">No sign-on log entries found. VistA sign-on logging may not be enabled or the log may be empty.</p>`; }
  const fTab = el.querySelector('[data-tab="failed"]');
  if (failed.ok && failed.data && failed.data.length > 0) {
    fTab.innerHTML = `<table class="data-table"><thead><tr><th>Device</th><th>CPU</th><th>Fail Type</th><th>Attempts</th><th>User</th></tr></thead>
      <tbody>${failed.data.map(r => `<tr><td>${escapeHtml(r.device)}</td><td>${escapeHtml(r.cpu||'--')}</td><td><span class="status-badge stopped">${escapeHtml(r.failType === 'V' ? 'VERIFY CODE' : r.failType === 'A' ? 'ACCESS CODE' : r.failType === 'D' ? 'DEVICE' : r.failType||'--')}</span></td><td>${escapeHtml(r.attempts||'--')}</td><td>${escapeHtml(r.user||'--')}</td></tr>`).join('')}</tbody></table>`;
  } else { fTab.innerHTML = `<p class="empty-state">No failed access attempts recorded.</p>`; }
  const pTab = el.querySelector('[data-tab="progmode"]');
  if (prog.ok && prog.data && prog.data.length > 0) {
    pTab.innerHTML = `<table class="data-table"><thead><tr><th>Device</th><th>Date</th><th>User</th></tr></thead>
      <tbody>${prog.data.map(r => `<tr><td>${escapeHtml(r.device)}</td><td>${escapeHtml(r.date||'--')}</td><td>${escapeHtml(r.user||'--')}</td></tr>`).join('')}</tbody></table>`;
  } else { pTab.innerHTML = `<p class="empty-state">No programmer mode log entries found.</p>`; }
  const fmTab = el.querySelector('[data-tab="fileman"]');
  if (fileman.ok && fileman.entries && fileman.entries.length > 0) {
    fmTab.innerHTML = `<div class="filter-rail"><input type="text" id="fm-audit-search" placeholder="Search by field, user, value..." /><span class="result-count">${fileman.entries.length} entries</span></div>
      <table class="data-table"><thead><tr><th>Audit IEN</th><th>User IEN</th><th>When</th><th>Field</th><th>#</th><th>By DUZ</th><th>Old Value</th><th>New Value</th></tr></thead>
      <tbody id="fm-audit-tbody">${fileman.entries.map(r => `<tr><td>${escapeHtml(r.auditIen)}</td><td>${escapeHtml(r.entryIen)}</td><td>${escapeHtml(r.when)}</td><td>${escapeHtml(r.fieldName)}</td><td>${escapeHtml(r.fieldNum)}</td><td>${escapeHtml(r.byDuz)}</td><td>${escapeHtml(r.oldValue||'--')}</td><td>${escapeHtml(r.newValue||'--')}</td></tr>`).join('')}</tbody></table>`;
    document.getElementById('fm-audit-search')?.addEventListener('input', () => {
      const q = (document.getElementById('fm-audit-search').value || '').toLowerCase();
      const filtered = fileman.entries.filter(r => (r.fieldName||'').toLowerCase().includes(q) || (r.oldValue||'').toLowerCase().includes(q) || (r.newValue||'').toLowerCase().includes(q) || (r.entryIen||'').includes(q));
      document.getElementById('fm-audit-tbody').innerHTML = filtered.map(r => `<tr><td>${escapeHtml(r.auditIen)}</td><td>${escapeHtml(r.entryIen)}</td><td>${escapeHtml(r.when)}</td><td>${escapeHtml(r.fieldName)}</td><td>${escapeHtml(r.fieldNum)}</td><td>${escapeHtml(r.byDuz)}</td><td>${escapeHtml(r.oldValue||'--')}</td><td>${escapeHtml(r.newValue||'--')}</td></tr>`).join('');
    });
  } else { fmTab.innerHTML = `<p class="empty-state">No FileMan data change audit entries found for File 200. Ensure audit is enabled on key fields (.01, 7, 9.2) via ^DD(200,field,"AUDIT")="y".</p>`; }
}

// ======================================================================
// NURSING CONFIGURATION — File 211.4 NURS LOCATION
// ======================================================================

async function renderNursingConfig(el) {
  const res = await api('nursing-locations');
  const rows = (res.ok && res.data) ? res.data : [];
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Clinical Config › Nursing</div>
    <div class="page-header"><h1>Nursing Configuration</h1><span class="source-posture live">LIVE VistA</span></div>
    <p class="page-description">${tip("Nursing location configuration from File 211.4. Each entry maps a ward or patient care area to its nursing parameters, care setting, and staffing attributes.")} Nursing locations (File 211.4): patient care areas, inpatient/outpatient settings, staffing configuration.</p>
    <div class="filter-rail"><input type="text" id="nurs-search" placeholder="Search nursing locations..." /><span class="result-count" id="nurs-count">${rows.length} locations</span></div>
    <table class="data-table"><thead><tr><th>IEN</th><th>Name</th><th>Facility</th><th>Care Setting</th><th>Status</th></tr></thead>
    <tbody id="nurs-tbody">${rows.length ? rows.map(r => `<tr class="clickable-row" data-ien="${escapeHtml(r.ien)}">
      <td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.facility||'--')}</td>
      <td>${escapeHtml(r.careSetting === 'I' ? 'Inpatient' : r.careSetting === 'O' ? 'Other' : r.careSetting||'--')}</td>
      <td><span class="status-badge ${r.inactiveFlag === 'I' || r.patientCareFlag === 'I' ? 'stopped' : 'active'}">${r.inactiveFlag === 'I' ? 'INACTIVE' : 'ACTIVE'}</span></td>
    </tr>`).join('') : '<tr><td colspan="5">No nursing locations found</td></tr>'}</tbody></table>`;
  document.getElementById('nurs-search').addEventListener('input', () => {
    const q = (document.getElementById('nurs-search').value || '').toLowerCase();
    const filtered = rows.filter(r => (r.name||'').toLowerCase().includes(q) || (r.facility||'').toLowerCase().includes(q));
    document.getElementById('nurs-tbody').innerHTML = filtered.map(r => `<tr class="clickable-row" data-ien="${escapeHtml(r.ien)}"><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.facility||'--')}</td><td>${escapeHtml(r.careSetting === 'I' ? 'Inpatient' : r.careSetting === 'O' ? 'Other' : r.careSetting||'--')}</td><td><span class="status-badge ${r.inactiveFlag === 'I' ? 'stopped' : 'active'}">${r.inactiveFlag === 'I' ? 'INACTIVE' : 'ACTIVE'}</span></td></tr>`).join('');
    document.getElementById('nurs-count').textContent = `${filtered.length} of ${rows.length} locations`;
  });
}

// ======================================================================
// ENCOUNTER FORMS — File 357
// ======================================================================

async function renderEncounterForms(el) {
  const res = await api('encounter-forms');
  const rows = (res.ok && res.data) ? res.data : [];
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Billing &amp; Insurance › Encounter Forms</div>
    <div class="page-header"><h1>Encounter Forms</h1><span class="source-posture live">LIVE VistA</span></div>
    <p class="page-description">${tip("Encounter forms (File 357) are used for outpatient workload capture and billing. Each form defines the layout and data elements collected during a patient encounter.")} ${rows.length} encounter forms found in VistA File 357. These forms capture outpatient encounter data for billing and workload reporting.</p>
    <div class="filter-rail"><input type="text" id="ef-search" placeholder="Search forms..." /><span class="result-count" id="ef-count">${rows.length} forms</span></div>
    <table class="data-table"><thead><tr><th>IEN</th><th>Name</th><th>Description</th><th>Type</th><th>Compiled</th><th>Toolkit</th></tr></thead>
    <tbody id="ef-tbody">${rows.length ? rows.map(r => `<tr>
      <td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(r.description)}">${escapeHtml(r.description||'--')}</td>
      <td>${escapeHtml(r.typeOfUse === '1' ? 'Outpatient' : r.typeOfUse === '0' ? 'Utility' : r.typeOfUse||'--')}</td>
      <td>${escapeHtml(r.compiled === '1' ? 'Yes' : r.compiled === '0' ? 'No' : r.compiled === 'F' ? 'Failed' : r.compiled||'--')}</td>
      <td>${escapeHtml(r.toolkit === '1' ? 'Yes' : 'No')}</td>
    </tr>`).join('') : '<tr><td colspan="6">No encounter forms found</td></tr>'}</tbody></table>`;
  document.getElementById('ef-search').addEventListener('input', () => {
    const q = (document.getElementById('ef-search').value || '').toLowerCase();
    const filtered = rows.filter(r => (r.name||'').toLowerCase().includes(q) || (r.description||'').toLowerCase().includes(q));
    document.getElementById('ef-tbody').innerHTML = filtered.map(r => `<tr><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(r.description||'--')}</td><td>${escapeHtml(r.typeOfUse === '1' ? 'Outpatient' : 'Utility')}</td><td>${escapeHtml(r.compiled === '1' ? 'Yes' : 'No')}</td><td>${escapeHtml(r.toolkit === '1' ? 'Yes' : 'No')}</td></tr>`).join('');
    document.getElementById('ef-count').textContent = `${filtered.length} of ${rows.length} forms`;
  });
}

// ======================================================================
// CLAIMS TRACKING — File 356
// ======================================================================

async function renderClaimsTracking(el) {
  const res = await api('claims-tracking');
  const rows = (res.ok && res.data) ? res.data : [];
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Billing &amp; Insurance › Claims Tracking</div>
    <div class="page-header"><h1>Claims Tracking</h1><span class="source-posture live">LIVE VistA</span></div>
    <p class="page-description">${tip("Claims tracking (File 356) records insurance claim entries for inpatient, outpatient, prescription, and prosthetic events. Each entry links to a patient, visit, and billing status.")} ${rows.length} claims tracking entries from VistA File 356. Tracks insurance billing lifecycle from event to claim submission.</p>
    <div class="filter-rail"><input type="text" id="ct-search" placeholder="Search by patient or entry ID..." /><span class="result-count" id="ct-count">${rows.length} entries</span></div>
    <table class="data-table"><thead><tr><th>IEN</th><th>Entry ID</th><th>Patient</th><th>Episode Date</th><th>Event Type</th><th>Active</th></tr></thead>
    <tbody id="ct-tbody">${rows.length ? rows.map(r => `<tr>
      <td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.entryId)}</td><td>${escapeHtml(r.patient||'--')}</td>
      <td>${escapeHtml(r.episodeDate||'--')}</td><td>${escapeHtml(r.eventType||'--')}</td>
      <td><span class="status-badge ${r.active === '1' ? 'active' : 'stopped'}">${r.active === '1' ? 'ACTIVE' : 'INACTIVE'}</span></td>
    </tr>`).join('') : '<tr><td colspan="6">No claims tracking entries found</td></tr>'}</tbody></table>`;
  document.getElementById('ct-search').addEventListener('input', () => {
    const q = (document.getElementById('ct-search').value || '').toLowerCase();
    const filtered = rows.filter(r => (r.entryId||'').toLowerCase().includes(q) || (r.patient||'').toLowerCase().includes(q));
    document.getElementById('ct-tbody').innerHTML = filtered.map(r => `<tr><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.entryId)}</td><td>${escapeHtml(r.patient||'--')}</td><td>${escapeHtml(r.episodeDate||'--')}</td><td>${escapeHtml(r.eventType||'--')}</td><td><span class="status-badge ${r.active === '1' ? 'active' : 'stopped'}">${r.active === '1' ? 'ACTIVE' : 'INACTIVE'}</span></td></tr>`).join('');
    document.getElementById('ct-count').textContent = `${filtered.length} of ${rows.length} entries`;
  });
}

// ======================================================================
// ACCESS PROFILES — User template clone functionality
// ======================================================================

async function renderAccessProfiles(el) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Users &amp; Access › Access Profiles</div>
    <div class="page-header"><h1>Access Profiles</h1><span class="source-posture live">LIVE VistA</span></div>
    <p class="page-description">${tip("Access profiles use VistA user cloning to copy keys, menus, and file access from a template user to new users. This is the standard VistA approach for role-based access setup.")} Clone a template user's keys, menus, and file access to other users. Uses the ZVE USER CLONE RPC (File 200).</p>
    <div class="card" style="max-width:600px;">
      <h3>Clone User Access Profile</h3>
      <div style="display:grid;gap:12px;margin-top:12px;">
        <label>Source User DUZ (template) ${tip("The DUZ (internal entry number) of the user whose access profile you want to copy. Set up a template user with the desired keys and menus first.")}<br/><input type="text" id="ap-source" placeholder="e.g. 87" style="width:100%;" /></label>
        <label>New User Name (LAST,FIRST) ${tip("The new user's name in VistA format: LAST,FIRST. Must be unique in File 200.")}<br/><input type="text" id="ap-name" placeholder="e.g. SMITH,JOHN" style="width:100%;" /></label>
        <label>Access Code ${tip("Optional initial access code for the new user. If blank, the user will need to set one at first sign-on.")}<br/><input type="text" id="ap-access" placeholder="Optional" style="width:100%;" /></label>
        <label>Verify Code ${tip("Optional initial verify code. If blank, the user will need to set one at first sign-on.")}<br/><input type="password" id="ap-verify" placeholder="Optional" style="width:100%;" /></label>
        <button type="button" class="btn-primary" id="ap-clone-btn">Clone User</button>
        <div id="ap-msg" style="font-size:12px;margin-top:4px;"></div>
      </div>
    </div>`;
  document.getElementById('ap-clone-btn').addEventListener('click', async () => {
    const sourceDuz = document.getElementById('ap-source').value.trim();
    const newName = document.getElementById('ap-name').value.trim();
    const accessCode = document.getElementById('ap-access').value.trim();
    const verifyCode = document.getElementById('ap-verify').value.trim();
    const msg = document.getElementById('ap-msg');
    if (!sourceDuz || !newName) { msg.innerHTML = '<span style="color:var(--color-error);">Source DUZ and new name are required.</span>'; return; }
    if (!confirm(`Clone user DUZ ${sourceDuz} to create "${newName}"?`)) return;
    msg.textContent = 'Cloning...';
    const out = await apiPost('users/clone', { sourceDuz, newName, accessCode, verifyCode });
    if (out.ok) { msg.innerHTML = `<span style="color:var(--color-success);">User cloned successfully. ${escapeHtml(JSON.stringify(out.lines || []))}</span>`; }
    else { msg.innerHTML = `<span style="color:var(--color-error);">${escapeHtml(out.error || 'Clone failed')}</span>`; }
  });
}

// ======================================================================
// FILE ACCESS SECURITY — File 200.032 sub-file
// ======================================================================

async function renderFileAccess(el) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Users &amp; Access › File Access Security</div>
    <div class="page-header"><h1>File Access Security</h1><span class="source-posture live">LIVE VistA</span></div>
    <p class="page-description">${tip("File access (sub-file 200.032) controls which VistA files each user can read, write, delete, or audit. This is FileMan-level security separate from menu/key access.")} View file-level access permissions for a specific user. Data from File 200 sub-file 200.032.</p>
    <div style="display:flex;gap:8px;align-items:flex-end;margin-bottom:16px;">
      <label>User DUZ ${tip("Enter the internal entry number (DUZ) of the user whose file access you want to inspect.")}<br/><input type="text" id="fa-duz" placeholder="e.g. 87" style="width:120px;" /></label>
      <button type="button" class="btn-primary" id="fa-load-btn">Load File Access</button>
    </div>
    <div id="fa-results"></div>`;
  document.getElementById('fa-load-btn').addEventListener('click', async () => {
    const duz = document.getElementById('fa-duz').value.trim();
    const results = document.getElementById('fa-results');
    if (!duz) { results.innerHTML = '<p style="color:var(--color-error);">Enter a DUZ.</p>'; return; }
    results.innerHTML = '<div class="loading-indicator">Loading file access...</div>';
    const res = await api(`users/${encodeURIComponent(duz)}/file-access`);
    if (res.ok && res.data && res.data.length > 0) {
      results.innerHTML = `<p>${res.data.length} file access entries for DUZ ${escapeHtml(duz)}</p>
        <table class="data-table"><thead><tr><th>File</th><th>DD Access</th><th>Delete</th><th>LAYGO</th><th>Read</th><th>Write</th><th>Audit</th></tr></thead>
        <tbody>${res.data.map(r => `<tr><td>${escapeHtml(r.file)}</td><td>${r.ddAccess === '1' ? 'Yes' : '--'}</td><td>${r.deleteAccess === '1' ? 'Yes' : '--'}</td><td>${r.laygoAccess === '1' ? 'Yes' : '--'}</td><td>${r.readAccess === '1' ? 'Yes' : '--'}</td><td>${r.writeAccess === '1' ? 'Yes' : '--'}</td><td>${r.auditAccess === '1' ? 'Yes' : '--'}</td></tr>`).join('')}</tbody></table>`;
    } else {
      results.innerHTML = `<p class="empty-state">No file access entries found for DUZ ${escapeHtml(duz)}. This user may not have any explicit file-level permissions set.</p>`;
    }
  });
}

// ======================================================================
// ACCESS AUDIT — Comprehensive user access profile
// ======================================================================

async function renderAccessAudit(el) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Users &amp; Access › Access Audit</div>
    <div class="page-header"><h1>Access Audit</h1><span class="source-posture live">LIVE VistA</span></div>
    <p class="page-description">${tip("Audits a user's complete VistA access profile: security keys, menus, divisions, file access, and computed access level. Uses DDR GETS on File 200 plus DDR LISTER on sub-files 200.051, 200.03, 200.02, 200.032.")} Enter a user's DUZ to see their complete access profile — security keys, menus, divisions, file permissions, and computed access level.</p>
    <div style="display:flex;gap:8px;align-items:flex-end;margin-bottom:16px;">
      <label>User DUZ ${tip("The DUZ (internal entry number) of the user to audit. You can find this from the User List page.")}<br/><input type="text" id="aa-duz" placeholder="e.g. 87" style="width:120px;" /></label>
      <button type="button" class="btn-primary" id="aa-load-btn">Audit Access</button>
    </div>
    <div id="aa-results"></div>`;
  document.getElementById('aa-load-btn').addEventListener('click', async () => {
    const duz = (document.getElementById('aa-duz').value || '').trim();
    const results = document.getElementById('aa-results');
    if (!duz) { results.innerHTML = '<p style="color:var(--color-error);">Enter a DUZ.</p>'; return; }
    results.innerHTML = '<div class="loading-indicator">Loading access profile...</div>';
    const res = await api(`users/${encodeURIComponent(duz)}/access-audit`);
    if (!res.ok) { results.innerHTML = `<p class="error-message">${escapeHtml(res.error || 'Failed to load')}</p>`; return; }
    const levelBadge = res.accessLevel === 'admin' ? '<span class="badge badge-inactive" style="background:#fef2f2;color:#b91c1c;">ADMIN</span>'
      : res.accessLevel === 'clinical' ? '<span class="badge badge-active">CLINICAL</span>'
      : '<span class="badge badge-ungrounded">BASIC</span>';
    const disabledBadge = res.isDisabled ? ' <span class="badge badge-inactive">DISABLED</span>' : '';
    results.innerHTML = `
      <div class="detail-section" style="margin-top:8px;">
        <h2>${escapeHtml(res.userName)} (DUZ ${escapeHtml(duz)}) ${levelBadge}${disabledBadge}</h2>
        <dl class="detail-grid">
          <dt>Primary Menu</dt><dd>${escapeHtml(res.primaryMenu || '(none)')}</dd>
          <dt>Divisions</dt><dd>${res.divisions.length ? res.divisions.map(d => escapeHtml(d)).join(', ') : '(none)'}</dd>
          <dt>Access Level</dt><dd>${levelBadge} — ${res.summary.hasAdminKeys ? 'Has programmer/manager keys' : res.summary.hasClinicalKeys ? 'Has clinical provider keys' : 'No admin or clinical keys found'}</dd>
        </dl>
      </div>
      <div class="detail-section" style="margin-top:16px;">
        <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">▾</span> Security Keys (${res.securityKeys.length})</h2>
        <div class="collapsible-content">
          ${res.securityKeys.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px;">${res.securityKeys.map(k => `<span class="badge badge-key">${escapeHtml(k)}</span>`).join('')}</div>` : '<p class="empty-state">No security keys assigned.</p>'}
        </div>
      </div>
      <div class="detail-section" style="margin-top:8px;">
        <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">▾</span> Secondary Menu Options (${res.secondaryMenus.length})</h2>
        <div class="collapsible-content">
          ${res.secondaryMenus.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px;">${res.secondaryMenus.map(m => `<span class="badge" style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;padding:2px 8px;border-radius:4px;font-size:11px;">${escapeHtml(m)}</span>`).join('')}</div>` : '<p class="empty-state">No secondary menu options.</p>'}
        </div>
      </div>
      <div class="detail-section" style="margin-top:8px;">
        <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">▾</span> File Access Permissions (${res.fileAccess.length})</h2>
        <div class="collapsible-content">
          ${res.fileAccess.length ? `<table class="data-table"><thead><tr><th>File</th><th>DD</th><th>Delete</th><th>LAYGO</th><th>Read</th><th>Write</th><th>Audit</th></tr></thead>
            <tbody>${res.fileAccess.map(r => `<tr><td>${escapeHtml(r.file)}</td><td>${r.ddAccess === '1' ? 'Yes' : '--'}</td><td>${r.deleteAccess === '1' ? 'Yes' : '--'}</td><td>${r.laygoAccess === '1' ? 'Yes' : '--'}</td><td>${r.readAccess === '1' ? 'Yes' : '--'}</td><td>${r.writeAccess === '1' ? 'Yes' : '--'}</td><td>${r.auditAccess === '1' ? 'Yes' : '--'}</td></tr>`).join('')}</tbody></table>` : '<p class="empty-state">No explicit file access entries.</p>'}
        </div>
      </div>
      <div class="detail-section" style="margin-top:16px;">
        <h2>Access Summary</h2>
        <div class="card-grid">
          <div class="card"><div class="card-label">Keys</div><div class="card-value">${res.summary.totalKeys}</div></div>
          <div class="card"><div class="card-label">Menus</div><div class="card-value">${res.summary.totalMenus}</div></div>
          <div class="card"><div class="card-label">Divisions</div><div class="card-value">${res.summary.totalDivisions}</div></div>
          <div class="card"><div class="card-label">File Access</div><div class="card-value">${res.summary.totalFileAccessEntries}</div></div>
        </div>
      </div>
      <div style="margin-top:1.5rem;display:flex;gap:8px;">
        <a href="#/users/${encodeURIComponent(duz)}" class="btn-primary btn-sm">View User Detail →</a>
        <a href="#/key-inventory" class="btn-secondary btn-sm">Key Inventory →</a>
        <a href="#/access-profiles" class="btn-secondary btn-sm">Access Profiles →</a>
      </div>`;
  });
}

// ======================================================================
// REPORTS — Billing, Scheduling, Lab, Radiology, Nursing
// ======================================================================

async function renderBillingReport(el) {
  const res = await api('reports/billing');
  const rows = (res.ok && res.data) ? res.data : [];
  el.innerHTML = `<div class="page-header"><h1>Billing Status Report</h1><a href="#/monitoring/status" class="breadcrumb-link">Monitoring</a><span class="source-posture live">LIVE VistA</span></div>
    <p class="page-description">${tip("Bills from File 399 (BILL/CLAIMS). Shows active and completed third-party insurance bills including status, charges, and payer.")} ${rows.length} billing entries from VistA File 399.</p>
    <div class="filter-rail"><input type="text" id="br-search" placeholder="Search by bill number or patient..." /><span class="result-count" id="br-count">${rows.length} bills</span></div>
    <table class="data-table"><thead><tr><th>IEN</th><th>Bill Number</th><th>Patient</th><th>Rate Type</th><th>Status</th><th>Total Charges</th><th>Payer</th></tr></thead>
    <tbody id="br-tbody">${rows.length ? rows.map(r => `<tr><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.billNumber)}</td><td>${escapeHtml(r.patient||'--')}</td><td>${escapeHtml(r.rateType||'--')}</td><td>${escapeHtml(r.status||'--')}</td><td>${escapeHtml(r.totalCharges||'--')}</td><td>${escapeHtml(r.payer||'--')}</td></tr>`).join('') : '<tr><td colspan="7">No billing entries found</td></tr>'}</tbody></table>`;
  document.getElementById('br-search').addEventListener('input', () => {
    const q = (document.getElementById('br-search').value || '').toLowerCase();
    const filtered = rows.filter(r => (r.billNumber||'').toLowerCase().includes(q) || (r.patient||'').toLowerCase().includes(q));
    document.getElementById('br-tbody').innerHTML = filtered.map(r => `<tr><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.billNumber)}</td><td>${escapeHtml(r.patient||'--')}</td><td>${escapeHtml(r.rateType||'--')}</td><td>${escapeHtml(r.status||'--')}</td><td>${escapeHtml(r.totalCharges||'--')}</td><td>${escapeHtml(r.payer||'--')}</td></tr>`).join('');
    document.getElementById('br-count').textContent = `${filtered.length} of ${rows.length} bills`;
  });
}

async function renderSchedulingReport(el) {
  const res = await api('reports/scheduling');
  const rows = (res.ok && res.data) ? res.data : [];
  el.innerHTML = `<div class="page-header"><h1>Scheduling Workload Report</h1><a href="#/monitoring/status" class="breadcrumb-link">Monitoring</a><span class="source-posture live">LIVE VistA</span></div>
    <p class="page-description">${tip("Clinic scheduling data from File 44. Shows clinics with their service, division, and stop codes for workload analysis.")} ${rows.length} clinics from VistA File 44.</p>
    <div class="filter-rail"><input type="text" id="sr-search" placeholder="Search clinics..." /><span class="result-count" id="sr-count">${rows.length} clinics</span></div>
    <table class="data-table"><thead><tr><th>IEN</th><th>Clinic</th><th>Abbreviation</th><th>Service</th><th>Division</th><th>Stop Code</th></tr></thead>
    <tbody id="sr-tbody">${rows.length ? rows.map(r => `<tr><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.clinicName)}</td><td>${escapeHtml(r.abbreviation||'--')}</td><td>${escapeHtml(r.service||'--')}</td><td>${escapeHtml(r.division||'--')}</td><td>${escapeHtml(r.stopCode||'--')}</td></tr>`).join('') : '<tr><td colspan="6">No clinics found</td></tr>'}</tbody></table>`;
  document.getElementById('sr-search').addEventListener('input', () => {
    const q = (document.getElementById('sr-search').value || '').toLowerCase();
    const filtered = rows.filter(r => (r.clinicName||'').toLowerCase().includes(q));
    document.getElementById('sr-tbody').innerHTML = filtered.map(r => `<tr><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.clinicName)}</td><td>${escapeHtml(r.abbreviation||'--')}</td><td>${escapeHtml(r.service||'--')}</td><td>${escapeHtml(r.division||'--')}</td><td>${escapeHtml(r.stopCode||'--')}</td></tr>`).join('');
    document.getElementById('sr-count').textContent = `${filtered.length} of ${rows.length} clinics`;
  });
}

async function renderLabReport(el) {
  const res = await api('reports/lab');
  const rows = (res.ok && res.data) ? res.data : [];
  el.innerHTML = `<div class="page-header"><h1>Lab Workload Report</h1><a href="#/monitoring/status" class="breadcrumb-link">Monitoring</a><span class="source-posture live">LIVE VistA</span></div>
    <p class="page-description">${tip("Lab tests from File 60 (LABORATORY TEST). Shows configured lab tests with their type, subscript category, and accession area.")} ${rows.length} lab tests from VistA File 60.</p>
    <div class="filter-rail"><input type="text" id="lr-search" placeholder="Search lab tests..." /><span class="result-count" id="lr-count">${rows.length} tests</span></div>
    <table class="data-table"><thead><tr><th>IEN</th><th>Test Name</th><th>Type</th><th>Subscript</th><th>Location</th><th>Accession Area</th></tr></thead>
    <tbody id="lr-tbody">${rows.length ? rows.map(r => `<tr><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.type||'--')}</td><td>${escapeHtml(r.subscript||'--')}</td><td>${escapeHtml(r.location||'--')}</td><td>${escapeHtml(r.accessionArea||'--')}</td></tr>`).join('') : '<tr><td colspan="6">No lab tests found</td></tr>'}</tbody></table>`;
  document.getElementById('lr-search').addEventListener('input', () => {
    const q = (document.getElementById('lr-search').value || '').toLowerCase();
    const filtered = rows.filter(r => (r.name||'').toLowerCase().includes(q));
    document.getElementById('lr-tbody').innerHTML = filtered.map(r => `<tr><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.type||'--')}</td><td>${escapeHtml(r.subscript||'--')}</td><td>${escapeHtml(r.location||'--')}</td><td>${escapeHtml(r.accessionArea||'--')}</td></tr>`).join('');
    document.getElementById('lr-count').textContent = `${filtered.length} of ${rows.length} tests`;
  });
}

async function renderRadiologyReport(el) {
  const res = await api('reports/radiology');
  const rows = (res.ok && res.data) ? res.data : [];
  el.innerHTML = `<div class="page-header"><h1>Radiology Workload Report</h1><a href="#/monitoring/status" class="breadcrumb-link">Monitoring</a><span class="source-posture live">LIVE VistA</span></div>
    <p class="page-description">${tip("Radiology/Nuclear Medicine procedures from File 71. Shows configured imaging procedures with type and CPT codes.")} ${rows.length} radiology procedures from VistA File 71.</p>
    <div class="filter-rail"><input type="text" id="rr-search" placeholder="Search procedures..." /><span class="result-count" id="rr-count">${rows.length} procedures</span></div>
    <table class="data-table"><thead><tr><th>IEN</th><th>Procedure</th><th>Type</th><th>Imaging Type</th><th>CPT Code</th></tr></thead>
    <tbody id="rr-tbody">${rows.length ? rows.map(r => `<tr><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.type||'--')}</td><td>${escapeHtml(r.imagingType||'--')}</td><td>${escapeHtml(r.cptCode||'--')}</td></tr>`).join('') : '<tr><td colspan="5">No radiology procedures found</td></tr>'}</tbody></table>`;
  document.getElementById('rr-search').addEventListener('input', () => {
    const q = (document.getElementById('rr-search').value || '').toLowerCase();
    const filtered = rows.filter(r => (r.name||'').toLowerCase().includes(q));
    document.getElementById('rr-tbody').innerHTML = filtered.map(r => `<tr><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.type||'--')}</td><td>${escapeHtml(r.imagingType||'--')}</td><td>${escapeHtml(r.cptCode||'--')}</td></tr>`).join('');
    document.getElementById('rr-count').textContent = `${filtered.length} of ${rows.length} procedures`;
  });
}

async function renderNursingReport(el) {
  const res = await api('reports/nursing');
  const rows = (res.ok && res.data) ? res.data : [];
  el.innerHTML = `<div class="page-header"><h1>Nursing Workload Report</h1><a href="#/monitoring/status" class="breadcrumb-link">Monitoring</a><span class="source-posture live">LIVE VistA</span></div>
    <p class="page-description">${tip("Nursing location staffing data from File 211.4. Shows care areas with their active/inactive status, care setting, and professional staffing percentage.")} ${rows.length} nursing locations from VistA File 211.4.</p>
    <table class="data-table"><thead><tr><th>IEN</th><th>Location</th><th>Facility</th><th>Care Setting</th><th>Active</th><th>Prof %</th><th>Experience</th></tr></thead>
    <tbody>${rows.length ? rows.map(r => `<tr><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.facility||'--')}</td><td>${escapeHtml(r.careSetting === 'I' ? 'Inpatient' : r.careSetting === 'O' ? 'Other' : r.careSetting||'--')}</td><td><span class="status-badge ${r.inactive === 'I' ? 'stopped' : 'active'}">${r.inactive === 'I' ? 'INACTIVE' : 'ACTIVE'}</span></td><td>${escapeHtml(r.profPct||'--')}</td><td>${escapeHtml(r.experience||'--')}</td></tr>`).join('') : '<tr><td colspan="7">No nursing locations found</td></tr>'}</tbody></table>`;
}

// ======================================================================
// RAW FILEMAN — Direct DDR access to any VistA file
// ======================================================================

async function renderRawFileMan(el) {
  el.innerHTML = `<div class="page-header"><h1>Raw FileMan Browser</h1><span class="source-posture live">LIVE VistA</span></div>
    <p class="page-description">${tip("Direct FileMan access via DDR LISTER and DDR GETS. Query any VistA file by number, specify fields, and browse entries. Power-user tool for administrators.")} Direct DDR access to any VistA file. Specify file number and fields to list or get specific entries.</p>
    ${renderTabBar([{id:'list',label:'List Entries (DDR LISTER)'},{id:'get',label:'Get Entry (DDR GETS)'},{id:'edit',label:'Edit Entry (DDR FILER)'}],'list')}
    <div class="tab-content active" data-tab="list">
      <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-bottom:12px;">
        <label>File # ${tip("VistA file number, e.g. 200 for NEW PERSON, 44 for HOSPITAL LOCATION.")}<br/><input type="text" id="fm-list-file" placeholder="e.g. 200" style="width:100px;" /></label>
        <label>Fields ${tip("Comma-separated field numbers to retrieve. Use .01 for name field.")}<br/><input type="text" id="fm-list-fields" placeholder=".01;1;2" value=".01" style="width:200px;" /></label>
        <label>Max ${tip("Maximum entries to return.")}<br/><input type="number" id="fm-list-max" value="50" style="width:80px;" /></label>
        <button type="button" class="btn-primary" id="fm-list-btn">List</button>
      </div>
      <div id="fm-list-results"></div>
    </div>
    <div class="tab-content" data-tab="get">
      <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-bottom:12px;">
        <label>File #<br/><input type="text" id="fm-get-file" placeholder="e.g. 200" style="width:100px;" /></label>
        <label>IEN<br/><input type="text" id="fm-get-ien" placeholder="e.g. 1" style="width:100px;" /></label>
        <label>Fields<br/><input type="text" id="fm-get-fields" placeholder=".01;1;2;3" value=".01" style="width:200px;" /></label>
        <button type="button" class="btn-primary" id="fm-get-btn">Get</button>
      </div>
      <div id="fm-get-results"></div>
    </div>
    <div class="tab-content" data-tab="edit">
      <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-bottom:12px;">
        <label>File #<br/><input type="text" id="fm-edit-file" placeholder="e.g. 200" style="width:100px;" /></label>
        <label>IEN<br/><input type="text" id="fm-edit-ien" placeholder="e.g. 1" style="width:100px;" /></label>
        <label>Field #<br/><input type="text" id="fm-edit-field" placeholder="e.g. .01" style="width:100px;" /></label>
        <label>Value<br/><input type="text" id="fm-edit-value" placeholder="New value" style="width:200px;" /></label>
        <button type="button" class="btn-primary" id="fm-edit-btn">Save</button>
      </div>
      <div id="fm-edit-results"></div>
    </div>`;
  wireTabBar(el);
  document.getElementById('fm-list-btn').addEventListener('click', async () => {
    const file = document.getElementById('fm-list-file').value.trim();
    const fields = document.getElementById('fm-list-fields').value.trim();
    const max = document.getElementById('fm-list-max').value.trim();
    const out = document.getElementById('fm-list-results');
    if (!file) { out.innerHTML = '<p style="color:var(--color-error);">File number required.</p>'; return; }
    out.innerHTML = '<div class="loading-indicator">Querying VistA...</div>';
    const res = await api(`fileman/list?file=${encodeURIComponent(file)}&fields=${encodeURIComponent(fields)}&max=${encodeURIComponent(max)}`);
    if (res.ok && res.data) {
      out.innerHTML = `<p>${res.data.length} entries from File ${escapeHtml(file)}</p><pre style="max-height:400px;overflow:auto;background:var(--color-bg-secondary);padding:12px;border-radius:4px;font-size:11px;">${escapeHtml(JSON.stringify(res.data, null, 2))}</pre>`;
    } else { out.innerHTML = `<p style="color:var(--color-error);">${escapeHtml(res.error || 'Query failed')}</p>`; }
  });
  document.getElementById('fm-get-btn').addEventListener('click', async () => {
    const file = document.getElementById('fm-get-file').value.trim();
    const ien = document.getElementById('fm-get-ien').value.trim();
    const fields = document.getElementById('fm-get-fields').value.trim();
    const out = document.getElementById('fm-get-results');
    if (!file || !ien) { out.innerHTML = '<p style="color:var(--color-error);">File and IEN required.</p>'; return; }
    out.innerHTML = '<div class="loading-indicator">Querying VistA...</div>';
    const res = await api(`fileman/entry?file=${encodeURIComponent(file)}&ien=${encodeURIComponent(ien)}&fields=${encodeURIComponent(fields)}`);
    if (res.ok && res.data) {
      const d = res.data;
      out.innerHTML = `<dl>${Object.entries(d).map(([k, v]) => `<div class="detail-row"><dt>Field ${escapeHtml(k)}</dt><dd>${escapeHtml(String(v) || '--')}</dd></div>`).join('')}</dl>`;
    } else { out.innerHTML = `<p style="color:var(--color-error);">${escapeHtml(res.error || 'Get failed')}</p>`; }
  });
  document.getElementById('fm-edit-btn').addEventListener('click', async () => {
    const file = document.getElementById('fm-edit-file').value.trim();
    const ien = document.getElementById('fm-edit-ien').value.trim();
    const field = document.getElementById('fm-edit-field').value.trim();
    const value = document.getElementById('fm-edit-value').value;
    const out = document.getElementById('fm-edit-results');
    if (!file || !ien || !field) { out.innerHTML = '<p style="color:var(--color-error);">File, IEN, and field required.</p>'; return; }
    if (!confirm(`Edit File ${file}, IEN ${ien}, Field ${field} = "${value}"?`)) return;
    out.innerHTML = '<div class="loading-indicator">Writing to VistA...</div>';
    const res = await apiPut('fileman/entry', { file, ien, field, value });
    if (res.ok) { out.innerHTML = `<p style="color:var(--color-success);">Saved successfully.</p>`; }
    else { out.innerHTML = `<p style="color:var(--color-error);">${escapeHtml(res.error || 'Save failed')}</p>`; }
  });
}

// ======================================================================
// CAPACITY PLANNING — System status overview
// ======================================================================

async function renderCapacityPlanning(el) {
  el.innerHTML = `<div class="page-header"><h1>Capacity Planning</h1><span class="source-posture live">LIVE VistA</span></div>
    <p class="page-description">${tip("System capacity overview: VistA connection status, TaskMan health, and real-time system metrics.")} VistA system health and capacity metrics.</p>
    <div class="loading-indicator">Loading capacity data...</div>`;
  const res = await api('capacity');
  if (res.ok && res.data) {
    const d = res.data;
    el.innerHTML = `<div class="page-header"><h1>Capacity Planning</h1><span class="source-posture live">LIVE VistA</span></div>
      <p class="page-description">System capacity overview. Timestamp: ${escapeHtml(d.timestamp || '')}</p>
      <div class="card-grid">
        <div class="card"><h3>VistA Connection</h3>
          <div class="card-value"><span class="status-badge ${d.vistaConnection && d.vistaConnection.ok ? 'running' : 'stopped'}">${d.vistaConnection && d.vistaConnection.ok ? 'CONNECTED' : 'DISCONNECTED'}</span></div>
          <p style="font-size:12px;color:var(--color-text-muted);">Port: ${escapeHtml(d.vistaConnection ? String(d.vistaConnection.port || '') : '--')}</p>
        </div>
        <div class="card"><h3>TaskMan Status</h3>
          <div class="card-value"><span class="status-badge ${d.taskmanStatus && d.taskmanStatus.status === 'RUNNING' ? 'running' : 'stopped'}">${escapeHtml(d.taskmanStatus ? d.taskmanStatus.status : 'UNKNOWN')}</span></div>
          <p style="font-size:12px;color:var(--color-text-muted);">Last run: ${escapeHtml(d.taskmanStatus ? d.taskmanStatus.lastRun || '--' : '--')}</p>
        </div>
      </div>`;
  } else {
    el.innerHTML += `<p style="color:var(--color-error);">${escapeHtml(res.error || 'Failed to load capacity data')}</p>`;
  }
}

// ---------------------------------------------------------------------------
// Impact Panel helper — renders a "What this affects" callout
// ---------------------------------------------------------------------------
function renderImpact(items) {
  if (!items || items.length === 0) return '';
  return `<div class="impact-panel">
    <h4>&#x26A0; What this affects</h4>
    <ul>${items.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul>
  </div>`;
}

// ======================================================================
// MARKET & LOCALE SETTINGS (Hybrid country/market config)
// ======================================================================

async function renderMarketSettings(el) {
  const market = STATE.legalMarket || 'US';
  const marketProfiles = {
    US: {
      label: 'United States', currency: 'USD', dateFormat: 'MM/DD/YYYY', timeFormat: '12h',
      billingStandard: 'X12 5010 / HIPAA EDI', codeSets: 'ICD-10-CM, CPT, HCPCS',
      claimFormats: '837P (Professional), 837I (Institutional)', insuranceModel: 'Commercial + Medicare + Medicaid',
      regulatoryBody: 'CMS / OIG', language: 'English', timezone: 'America/New_York',
    },
    PH: {
      label: 'Philippines', currency: 'PHP', dateFormat: 'DD/MM/YYYY', timeFormat: '24h',
      billingStandard: 'PhilHealth eClaims (CF1-CF4)', codeSets: 'ICD-10-PCS, RVS',
      claimFormats: 'CF1 (Facility), CF2 (Claim), CF3 (Professional), CF4 (Medicines)',
      insuranceModel: 'PhilHealth Universal + HMO', regulatoryBody: 'DOH / PhilHealth',
      language: 'Filipino / English', timezone: 'Asia/Manila',
    },
    AU: {
      label: 'Australia', currency: 'AUD', dateFormat: 'DD/MM/YYYY', timeFormat: '24h',
      billingStandard: 'Medicare Benefits Schedule (MBS)', codeSets: 'ICD-10-AM, ACHI, MBS Item Numbers',
      claimFormats: 'Medicare Online / ECLIPSE', insuranceModel: 'Medicare + PHI',
      regulatoryBody: 'Department of Health / ACSQHC', language: 'English', timezone: 'Australia/Sydney',
    },
    GB: {
      label: 'United Kingdom', currency: 'GBP', dateFormat: 'DD/MM/YYYY', timeFormat: '24h',
      billingStandard: 'NHS PbR / National Tariff', codeSets: 'ICD-10 (WHO), OPCS-4',
      claimFormats: 'SUS/CDS submissions', insuranceModel: 'NHS (single payer)',
      regulatoryBody: 'NHS England / CQC', language: 'English', timezone: 'Europe/London',
    },
    DE: {
      label: 'Germany', currency: 'EUR', dateFormat: 'DD.MM.YYYY', timeFormat: '24h',
      billingStandard: 'DRG / EBM / GOÄ', codeSets: 'ICD-10-GM, OPS, EBM',
      claimFormats: 'KV-Abrechnung (xDT / EDIFACT)', insuranceModel: 'GKV (statutory) + PKV (private)',
      regulatoryBody: 'BMG / KBV / InEK', language: 'German', timezone: 'Europe/Berlin',
    },
    CA: {
      label: 'Canada', currency: 'CAD', dateFormat: 'YYYY-MM-DD', timeFormat: '24h',
      billingStandard: 'Provincial fee schedules (OHIP, MSP, RAMQ)', codeSets: 'ICD-10-CA, CCI, CIHI DAD',
      claimFormats: 'Provincial claim submission (EDT, MSP Teleplan)', insuranceModel: 'Provincial single-payer',
      regulatoryBody: 'Health Canada / CIHI', language: 'English / French', timezone: 'America/Toronto',
    },
    SG: {
      label: 'Singapore', currency: 'SGD', dateFormat: 'DD/MM/YYYY', timeFormat: '24h',
      billingStandard: 'MOH fee benchmarks / Medisave', codeSets: 'ICD-10-AM (Singapore ed.), TOSP',
      claimFormats: 'CHAS / MediShield Life / Medisave claims', insuranceModel: 'Medisave + MediShield + CareShield',
      regulatoryBody: 'MOH Singapore', language: 'English', timezone: 'Asia/Singapore',
    },
    AE: {
      label: 'United Arab Emirates', currency: 'AED', dateFormat: 'DD/MM/YYYY', timeFormat: '24h',
      billingStandard: 'DHA / HAAD eClaims', codeSets: 'ICD-10-AM, CPT (adapted)',
      claimFormats: 'DHA XML / HAAD XML eClaims', insuranceModel: 'Mandatory private insurance',
      regulatoryBody: 'DHA (Dubai) / DOH (Abu Dhabi)', language: 'English / Arabic', timezone: 'Asia/Dubai',
    },
  };
  const profile = marketProfiles[market] || marketProfiles.US;

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Settings › Market &amp; Locale</div>
    <div class="page-header"><h1>Market &amp; Locale Settings</h1><span class="source-posture vista">CONFIGURED</span></div>

    <div class="explanation-header">
      <strong>How market configuration works</strong>
      The legal market is set by the platform operator at the control plane level when provisioning this tenant.
      It determines billing standards, regulatory requirements, code sets, and claim formats.
      Within this market, hospital IT admins can configure locale preferences (timezone, date/time display,
      language) and local billing parameters that are appropriate for the assigned market.
    </div>

    ${renderImpact([
      'Billing claim format and submission pipeline',
      'Code set validation (ICD, CPT, RVS, MBS, etc.)',
      'Insurance/payer connector selection',
      'Date/time formatting across all tenant-admin screens',
      'Regulatory compliance rules and audit requirements',
    ])}

    <div class="detail-section">
      <h2>Legal Market Profile (Read-Only — Set by Operator)</h2>
      <div class="form-grid" style="gap:16px;">
        <div><label>Market ${tip('Legal market is assigned by the platform operator and cannot be changed here. Contact your operator to change market assignment.')}</label>
          <input type="text" value="${escapeHtml(market)} — ${escapeHtml(profile.label)}" disabled></div>
        <div><label>Currency ${tip('The default currency for all financial displays and calculations.')}</label>
          <input type="text" value="${escapeHtml(profile.currency)}" disabled></div>
        <div><label>Billing Standard ${tip('The primary billing/claims standard used in this market.')}</label>
          <input type="text" value="${escapeHtml(profile.billingStandard)}" disabled></div>
        <div><label>Code Sets ${tip('Medical code classifications required by this market.')}</label>
          <input type="text" value="${escapeHtml(profile.codeSets)}" disabled></div>
        <div><label>Claim Formats ${tip('The electronic claim formats used for payer submission.')}</label>
          <input type="text" value="${escapeHtml(profile.claimFormats)}" disabled></div>
        <div><label>Insurance Model ${tip('The prevailing insurance/payer model in this market.')}</label>
          <input type="text" value="${escapeHtml(profile.insuranceModel)}" disabled></div>
        <div><label>Regulatory Body ${tip('The government or standards body governing healthcare billing.')}</label>
          <input type="text" value="${escapeHtml(profile.regulatoryBody)}" disabled></div>
      </div>
    </div>

    <div class="detail-section">
      <h2>Locale Preferences (Configurable by Hospital IT)</h2>
      <div class="form-grid" style="gap:16px;">
        <div><label>Display Language ${tip('Primary display language for the tenant-admin UI. Does not affect VistA terminal language.')}</label>
          <select id="mkt-language">
            <option value="en" ${profile.language.includes('English') ? 'selected' : ''}>English</option>
            <option value="fil" ${market === 'PH' ? 'selected' : ''}>Filipino</option>
            <option value="es">Spanish</option>
          </select></div>
        <div><label>Timezone ${tip('Default timezone for displaying dates and times. This does not change VistA internal storage (which uses UTC/FileMan internal format).')}</label>
          <select id="mkt-timezone">
            <option value="America/New_York" ${profile.timezone === 'America/New_York' ? 'selected' : ''}>US Eastern</option>
            <option value="America/Chicago">US Central</option>
            <option value="America/Denver">US Mountain</option>
            <option value="America/Los_Angeles">US Pacific</option>
            <option value="Asia/Manila" ${profile.timezone === 'Asia/Manila' ? 'selected' : ''}>Asia/Manila (PHT)</option>
            <option value="Australia/Sydney" ${profile.timezone === 'Australia/Sydney' ? 'selected' : ''}>Australia/Sydney (AEST)</option>
            <option value="Europe/London" ${profile.timezone === 'Europe/London' ? 'selected' : ''}>Europe/London (GMT/BST)</option>
          </select></div>
        <div><label>Date Format ${tip('How dates are displayed in tenant-admin UI screens.')}</label>
          <select id="mkt-dateformat">
            <option value="MM/DD/YYYY" ${profile.dateFormat === 'MM/DD/YYYY' ? 'selected' : ''}>MM/DD/YYYY (US)</option>
            <option value="DD/MM/YYYY" ${profile.dateFormat === 'DD/MM/YYYY' ? 'selected' : ''}>DD/MM/YYYY (International)</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD (ISO 8601)</option>
          </select></div>
        <div><label>Time Format ${tip('12-hour (AM/PM) or 24-hour military time display.')}</label>
          <select id="mkt-timeformat">
            <option value="12h" ${profile.timeFormat === '12h' ? 'selected' : ''}>12-hour (AM/PM)</option>
            <option value="24h" ${profile.timeFormat === '24h' ? 'selected' : ''}>24-hour</option>
          </select></div>
      </div>
      <div style="margin-top:16px;">
        <button class="btn-primary" id="mkt-save-btn">Save Locale Preferences</button>
        <span id="mkt-save-msg" style="margin-left:12px;font-size:12px;"></span>
      </div>
    </div>

    <div class="detail-section" style="background:#fffbeb;border-color:#fcd34d;">
      <h2 style="color:#92400e;">Market-Specific Billing Configuration</h2>
      <p style="font-size:13px;color:#92400e;margin-bottom:8px;">
        Billing parameters for the ${escapeHtml(profile.label)} market are managed through the
        <a href="#/billing-params" style="color:#92400e;font-weight:600;">Billing Parameters</a> page.
        Insurance companies and payer setup are managed through the
        <a href="#/insurance" style="color:#92400e;font-weight:600;">Insurance Companies</a> page.
      </p>
      <p style="font-size:12px;color:var(--color-text-muted);">
        The billing engine automatically selects the correct connector (X12 for US, PhilHealth eClaims for PH,
        MBS for AU) based on the legal market profile assigned to this tenant.
      </p>
    </div>`;

  const saveBtn = document.getElementById('mkt-save-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      showToast('Locale preferences saved', 'success');
      document.getElementById('mkt-save-msg').textContent = 'Saved';
      document.getElementById('mkt-save-msg').style.color = '#065f46';
    });
  }
}

// ======================================================================
// TOPOLOGY — Facility hierarchy visualization
// ======================================================================

async function renderTopology(el) {
  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Settings › Facility Topology</div>
    <div class="page-header"><h1>Facility Topology</h1><span class="source-posture pending">Loading…</span></div>
    <div class="loading-message">Building topology from VistA…</div>`;
  const res = await api('topology');
  if (!res.ok) { el.innerHTML = `<div class="error-message">${escapeHtml(res.error || 'Failed to load topology')}</div>`; return; }
  const badge = sourceBadge(res.source);
  const topo = res.data || [];
  function renderTree(nodes, depth = 0) {
    return nodes.map(n => {
      const indent = 'tree-indent-' + Math.min(depth, 2);
      const children = [...(n.clinics || []), ...(n.wards || [])];
      return `<li class="${indent}">
        <strong>${escapeHtml(n.name)}</strong> <span class="tree-type">${escapeHtml(n.type)}</span>
        ${n.stationNumber ? `<span class="badge badge-key">#${escapeHtml(n.stationNumber)}</span>` : ''}
        ${n.clinicCount ? `<span style="font-size:11px;color:var(--color-text-muted);">${n.clinicCount} clinics, ${n.wardCount} wards</span>` : ''}
      </li>` + (children.length > 0 ? renderTree(children, depth + 1) : '');
    }).join('');
  }
  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Settings › Facility Topology</div>
    <div class="page-header"><h1>Facility Topology</h1>${badge}</div>

    <div class="explanation-header">
      <strong>What is the facility topology?</strong>
      This shows the organizational hierarchy of your VistA system — Divisions at the top, with Clinics and Wards
      nested underneath. This hierarchy determines how appointments are scheduled, where orders are placed,
      and how billing is routed.
    </div>

    ${renderImpact([
      'Appointment scheduling destination options',
      'Ward assignment for inpatient admissions',
      'Clinic stop codes for workload reporting',
      'Division-level billing and reporting rollups',
    ])}

    <div class="detail-section">
      <h2>Hierarchy</h2>
      <ul class="facility-tree">${renderTree(topo)}</ul>
    </div>

    <div class="detail-section">
      <h2>Source RPCs</h2>
      <p style="font-size:12px;color:var(--color-text-muted);">
        ${(res.vistaGrounding?.rpcsUsed || []).map(r => `<span class="badge badge-key">${escapeHtml(r)}</span>`).join(' ')}
      </p>
    </div>`;
}
