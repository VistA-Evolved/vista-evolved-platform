/**
 * Tenant Admin — VistA-First SPA (7-domain architecture)
 *
 * Hash-based routing with domain-grouped render functions per the
 * tenant_admin_deep_blueprint. All configuration writes go through
 * DDR VALIDATOR/DDR FILER or ZVE* overlay RPCs.
 *
 * Domains: Dashboard, Users & Access, Facilities & Locations,
 *   Devices & Connectivity, Clinical Config, Billing & Insurance,
 *   System & Parameters, Monitoring & Reports
 */

const STATE = { tenantId: null, cpReturnUrl: null };

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  const qs = new URLSearchParams(window.location.search);
  STATE.tenantId = qs.get('tenantId') || 'default-tenant';
  STATE.cpReturnUrl = qs.get('cpReturnUrl') || null;

  document.getElementById('tenant-name').textContent = STATE.tenantId;
  document.getElementById('tenant-id-display').textContent = 'Tenant: ' + STATE.tenantId;

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
        statusEl.textContent = 'FIXTURE';
        statusEl.style.background = '#fef3c7';
        statusEl.style.color = '#92400e';
        if (sourceEl) sourceEl.textContent = 'Source: fixture';
      }
    })
    .catch(() => {
      const statusEl = document.getElementById('tenant-status');
      statusEl.textContent = 'FIXTURE';
      statusEl.style.background = '#fef3c7';
      statusEl.style.color = '#92400e';
    });

  if (STATE.cpReturnUrl) {
    const link = document.getElementById('return-to-cp');
    link.style.display = '';
    link.href = STATE.cpReturnUrl;
  }

  initCollapsibleNav();
  window.addEventListener('hashchange', route);
  route();
});

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
  { pattern: '#/users', fn: renderUserList },
  { pattern: '#/facilities', fn: renderFacilityList },
  { pattern: '#/roles', fn: renderRoleAssignment },
  { pattern: '#/key-inventory', fn: renderKeyInventory },
  { pattern: '#/esig-status', fn: renderEsigStatus },
  { pattern: '#/access-profiles', fn: (el) => renderIntegrationPending(el, 'Access Profiles', 'Users & Access', '#/users', 'U-17', 'Grant Access by Profile (XUSERBLK)', 'File 200', 'DDR FILER bulk', 'Apply a template of keys + menus + file access to multiple users at once.') },
  { pattern: '#/file-access', fn: (el) => renderIntegrationPending(el, 'File Access Security', 'Users & Access', '#/users', 'U-16', 'File Access Security (XUFILEACCESS)', 'File 200', 'DDR FILER', 'Grant or delete file-level permissions per user. Controls which VistA files each user can read/write/delete.') },
  { pattern: '#/clinics', fn: renderClinicList },
  { pattern: '#/wards', fn: renderWardList },
  { pattern: '#/beds', fn: renderRoomBeds },
  { pattern: '#/treating-specialties', fn: renderTreatingSpecialties },
  { pattern: '#/scheduling-config', fn: renderSchedulingConfig },
  { pattern: '#/devices', fn: renderDeviceList },
  { pattern: '#/terminal-types', fn: renderTerminalTypes },
  { pattern: '#/hl7-interfaces', fn: renderHL7Interfaces },
  { pattern: '#/rpc-status', fn: renderVistaTools },
  { pattern: '#/order-config', fn: (el) => renderIntegrationPending(el, 'Order Entry Configuration', 'Clinical Config', '#/dashboard', 'OE-01..OE-06', 'Quick Orders, Order Sets, Menus, Items, Prompts, Notifications', 'Files 101.41, 101.43, 100.98, 100.9', 'DDR LISTER/FILER', 'CPRS order entry configuration: define quick orders, order sets, menus, orderable items, prompts, and notification rules.', [
    { name: 'Quick Order Name', field: '101.41/.01', type: 'Free text', notes: 'Display name in CPRS order dialog' },
    { name: 'Display Group', field: '101.41/5', type: 'Pointer', notes: 'Classifies order type (Lab, Rad, Pharm, Consult)' },
    { name: 'Orderable Item', field: '101.41/2', type: 'Pointer → 100.9', notes: 'What this order actually orders' },
    { name: 'Order Set Name', field: '101.43/.01', type: 'Free text', notes: 'Grouping of quick orders' },
    { name: 'Menu Name', field: '100.98/.01', type: 'Free text', notes: 'CPRS menu organization' },
    { name: 'Notification Recipients', field: '100.9/773', type: 'Multiple', notes: 'Who gets notified on order events' },
  ]) },
  { pattern: '#/tiu-config', fn: (el) => renderIntegrationPending(el, 'TIU / Clinical Documentation', 'Clinical Config', '#/dashboard', 'TIU-01..TIU-04', 'Document Definitions, Parameters, Print, Templates', 'Files 8925.1, 8925.99', 'DDR LISTER/FILER', 'TIU (Text Integration Utility) configuration: note titles, document types, signature rules, print settings, and template management.', [
    { name: 'Document Definition Name', field: '8925.1/.01', type: 'Free text', notes: 'Note title (e.g. PROGRESS NOTE, DISCHARGE SUMMARY)' },
    { name: 'Type', field: '8925.1/1', type: 'Set', notes: 'DC (document class), DOC (document definition), CL (class)' },
    { name: 'Status', field: '8925.1/5', type: 'Set', notes: 'Active / Inactive / Test' },
    { name: 'Print Name', field: '8925.1/8', type: 'Free text', notes: 'What appears on printed note' },
    { name: 'Requires Signature', field: '8925.99/10', type: 'Yes/No', notes: 'Site parameter: all notes require e-sig?' },
    { name: 'Default Print Template', field: '8925.99/20', type: 'Pointer', notes: 'Template used when printing notes' },
  ]) },
  { pattern: '#/pharmacy-config', fn: renderDrugFile },
  { pattern: '#/lab-config', fn: renderLabTests },
  { pattern: '#/radiology-config', fn: (el) => renderIntegrationPending(el, 'Radiology Configuration', 'Clinical Config', '#/dashboard', 'RAD-01..RAD-04', 'Procedures, Locations, Division Params, Diagnostic Codes', 'Files 71, 79.1', 'DDR LISTER/FILER', 'Radiology/imaging administration: procedure/exam setup, location parameters, division parameters, diagnostic codes.') },
  { pattern: '#/nursing-config', fn: (el) => renderIntegrationPending(el, 'Nursing Configuration', 'Clinical Config', '#/dashboard', 'NUR-01..NUR-04', 'Locations, Site Params, Care Plans, I/O Config', 'NURS files', 'DDR FILER', 'Nursing administration: nursing location config, site parameters, care plan templates, intake/output categories.') },
  { pattern: '#/health-summary-config', fn: (el) => renderIntegrationPending(el, 'Health Summary Configuration', 'Clinical Config', '#/dashboard', 'HS-01..HS-03', 'Types, Components, Site Params', 'File 142', 'DDR LISTER/FILER', 'Health summary administration: create/edit health summary type definitions, enable/disable components, display defaults.') },
  { pattern: '#/billing-params', fn: (el) => renderIntegrationPending(el, 'Billing Parameters', 'Billing & Insurance', '#/dashboard', 'BIL-01..BIL-02', 'IB Site Parameters, MCCR Parameters', 'IB files', 'DDR GETS/FILER', 'Integrated Billing site-level configuration: core billing settings, cost center reporting parameters.') },
  { pattern: '#/insurance', fn: renderInsuranceCompanies },
  { pattern: '#/encounter-forms', fn: (el) => renderIntegrationPending(el, 'Encounter Forms', 'Billing & Insurance', '#/dashboard', 'BIL-06', 'Encounter Form Editor (IBDF)', 'IB files', 'DDR FILER', 'Design encounter forms and assign them to clinics. Used for workload capture and billing.') },
  { pattern: '#/claims-tracking', fn: (el) => renderIntegrationPending(el, 'Claims Tracking', 'Billing & Insurance', '#/dashboard', 'BIL-07', 'Claims Tracking Parameters', 'IBT files', 'DDR GETS/FILER', 'Configure claims tracking rules, follow-up intervals, and escalation paths.') },
  { pattern: '#/params/kernel', fn: renderParamsKernel },
  { pattern: '#/mailman-config', fn: (el) => renderIntegrationPending(el, 'MailMan Configuration', 'System & Parameters', '#/params/kernel', 'MM-01..MM-04', 'Site Params, Mail Groups, Background Filer, Queue Mgmt', 'Files 4.3, 3.8', 'DDR GETS/FILER + Custom RPC', 'MailMan (VistA internal messaging): site parameters, distribution groups, background filer status, and queue management.') },
  { pattern: '#/taskman', fn: renderTaskMan },
  { pattern: '#/menu-management', fn: renderMenuManagement },
  { pattern: '#/error-trap', fn: (el) => renderIntegrationPending(el, 'Error Processing', 'System & Parameters', '#/params/kernel', 'ERR-01..ERR-02', 'Error Trap Display, Error Cleanup', 'Error globals', 'Custom RPC', 'View recent MUMPS errors from the VistA error trap. Purge old errors. Analyze error frequency.') },
  { pattern: '#/packages', fn: renderInstalledPackages },
  { pattern: '#/modules', fn: renderModuleEntitlements },
  { pattern: '#/monitoring/status', fn: renderMonitoringStatus },
  { pattern: '#/monitoring/audit', fn: (el) => renderIntegrationPending(el, 'Audit Trail', 'Monitoring & Reports', '#/monitoring/status', 'MON-07', 'Login/Config Change History', 'VistA globals', 'Custom RPC', 'User login/logout history, configuration change log, failed login attempts, key assignment/removal history.') },
  { pattern: '#/reports/billing', fn: (el) => renderIntegrationPending(el, 'Billing Status Report', 'Monitoring & Reports', '#/monitoring/status', 'RPT-01', 'Claims in Progress / Filed / Denied', 'IB files', 'DDR LISTER', 'Billing department report: claims in progress, filed, denied. Source: Integrated Billing (IB) subsystem.') },
  { pattern: '#/reports/scheduling', fn: (el) => renderIntegrationPending(el, 'Scheduling Workload Report', 'Monitoring & Reports', '#/monitoring/status', 'RPT-02', 'Appointments by Clinic/Provider', 'SD files', 'DDR LISTER', 'Scheduling workload report: appointments by clinic and provider. Source: Scheduling (SD) subsystem.') },
  { pattern: '#/reports/lab', fn: (el) => renderIntegrationPending(el, 'Lab Workload Report', 'Monitoring & Reports', '#/monitoring/status', 'RPT-03', 'Tests by Accession Area', 'LR files', 'DDR LISTER', 'Laboratory workload report: tests by accession area. Source: Lab (LR) subsystem.') },
  { pattern: '#/reports/radiology', fn: (el) => renderIntegrationPending(el, 'Radiology Workload Report', 'Monitoring & Reports', '#/monitoring/status', 'RPT-04', 'Exams by Type/Location', 'RA files', 'DDR LISTER', 'Radiology workload report: exams by type and location. Source: Radiology (RA) subsystem.') },
  { pattern: '#/reports/nursing', fn: (el) => renderIntegrationPending(el, 'Nursing Workload Report', 'Monitoring & Reports', '#/monitoring/status', 'RPT-05', 'Staff/Patient Ratios', 'NURS files', 'DDR LISTER', 'Nursing workload report: staff-to-patient ratios. Source: Nursing (NURS) subsystem.') },
  { pattern: '#/vista-tools', fn: renderVistaTools },
  { pattern: '#/dashboard', fn: renderDashboard },
];

function route() {
  const hash = window.location.hash || '#/dashboard';
  const content = document.getElementById('content-area');
  const baseHash = hash.split('?')[0];

  document.querySelectorAll('.nav-link').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === baseHash);
  });

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
async function api(path) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `/api/tenant-admin/v1/${path}${sep}tenantId=${encodeURIComponent(STATE.tenantId)}`;
  try {
    const res = await fetch(url);
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
    const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    try { return await res.json(); } catch { return { ok: !res.ok ? false : true, error: res.ok ? null : `HTTP ${res.status}` }; }
  } catch (err) {
    return { ok: false, error: err.message || 'Network error' };
  }
}
async function apiPost(path, body) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `/api/tenant-admin/v1/${path}${sep}tenantId=${encodeURIComponent(STATE.tenantId)}`;
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    try { return await res.json(); } catch { return { ok: !res.ok ? false : true, error: res.ok ? null : `HTTP ${res.status}` }; }
  } catch (err) {
    return { ok: false, error: err.message || 'Network error' };
  }
}
async function apiDelete(path) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `/api/tenant-admin/v1/${path}${sep}tenantId=${encodeURIComponent(STATE.tenantId)}`;
  try {
    const res = await fetch(url, { method: 'DELETE' });
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
  return '<span class="source-posture fixture">FIXTURE</span>';
}

// ---------------------------------------------------------------------------
// Reusable page template: Integration-Pending page
// ---------------------------------------------------------------------------
function renderIntegrationPending(el, title, domain, backHref, covMapId, terminalOpts, vistaFiles, rpcDdr, description, fieldDetails) {
  const fieldTable = fieldDetails ? `
    <div style="margin-top:16px;">
      <h3 style="font-size:13px;margin-bottom:8px;">Fields to Implement</h3>
      <table class="data-table" style="font-size:12px;">
        <thead><tr><th>Field</th><th>VistA Field #</th><th>Type</th><th>Notes</th></tr></thead>
        <tbody>${fieldDetails.map(f => `<tr>
          <td>${escapeHtml(f.name)}</td>
          <td><code>${escapeHtml(f.field)}</code></td>
          <td>${escapeHtml(f.type)}</td>
          <td style="color:var(--color-text-muted);font-size:11px;">${escapeHtml(f.notes)}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>` : '';

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="${backHref}">${escapeHtml(domain)}</a> › ${escapeHtml(title)}</div>
    <div class="page-header"><h1>${escapeHtml(title)}</h1><span class="source-posture pending">INTEGRATION-PENDING</span></div>
    <div class="integration-pending-page">
      <div class="ip-icon">⏳</div>
      <div class="explanation-header">
        <strong>This configuration surface is planned but not yet wired to VistA.</strong>
        ${escapeHtml(description)}
      </div>
      <div class="ip-scope">
        <h3>VistA Grounding</h3>
        <table>
          <tr><th>Coverage Map ID</th><td><code>${escapeHtml(covMapId)}</code></td></tr>
          <tr><th>Terminal Option(s)</th><td>${escapeHtml(terminalOpts)}</td></tr>
          <tr><th>VistA File(s)</th><td><code>${escapeHtml(vistaFiles)}</code></td></tr>
          <tr><th>RPC / DDR</th><td><code>${escapeHtml(rpcDdr)}</code></td></tr>
          <tr><th>Status</th><td><span class="badge badge-pending">Planned — DDR/RPC wiring needed</span></td></tr>
        </table>
      </div>
      ${fieldTable}
      <div style="margin-top:16px;text-align:center;">
        <a href="${backHref}" class="btn">← Back to ${escapeHtml(domain)}</a>
        <a href="#/vista-tools" class="btn" style="margin-left:8px;">VistA Tools (DDR Probe) →</a>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
async function renderDashboard(el) {
  el.innerHTML = `
    <div class="page-header"><h1>Dashboard</h1><span class="source-posture fixture">Loading…</span></div>
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
        <div class="card"><div class="card-label">Terminal Types</div><div class="card-value">—</div>
          <div class="card-sub"><a href="#/terminal-types">File 3.2 →</a></div></div>
        <div class="card"><div class="card-label">HL7 Interfaces</div><div class="card-value">—</div>
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

    <!-- Coverage Status -->
    <div class="detail-section" style="margin-top:8px;">
      <h2 style="font-size:14px;margin-bottom:8px;">Coverage Status</h2>
      <p style="font-size:13px;color:var(--color-text-muted);margin-bottom:8px;">
        ~117 VistA admin functions tracked. See <code>docs/reference/vista-admin-coverage-map.md</code> for full details.
      </p>
      <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:13px;">
        <span><strong style="color:var(--color-success)">28</strong> PASS-LIVE</span>
        <span><strong style="color:var(--color-primary)">3</strong> PASS-SHELL</span>
        <span><strong style="color:var(--color-warning)">86</strong> MISSING (planned)</span>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// User List
// ---------------------------------------------------------------------------
async function renderUserList(el) {
  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Users &amp; Access › User List</div>
    <div class="page-header"><h1>User List</h1><span class="source-posture fixture">Loading…</span></div>
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
              <div class="detail-row"><dt>Name (.01)</dt><dd>${escapeHtml(u.name || '—')}</dd></div>
              <div class="detail-row"><dt>DUZ (IEN)</dt><dd>${vg.duz ?? u.ien ?? '—'}</dd></div>
              <div class="detail-row"><dt>Status</dt><dd>${escapeHtml(userStatus)}</dd></div>
              <div class="detail-row"><dt>Title</dt><dd>${escapeHtml(u.title || '—')}</dd></div>
              <div class="detail-row"><dt>SSN (masked)</dt><dd>${vg.ssn ? '***-**-' + escapeHtml(String(vg.ssn).slice(-4)) : '—'}</dd></div>
              <div class="detail-row"><dt>DOB</dt><dd>${escapeHtml(vg.dob || '—')}</dd></div>
              <div class="detail-row"><dt>Sex</dt><dd>${escapeHtml(vg.sex || '—')}</dd></div>
            </dl>
            <div style="margin-top:12px;border-top:1px solid #e2e8f0;padding-top:12px;">
              <h3 style="font-size:13px;margin-bottom:8px;">Edit Identity Fields</h3>
              <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;">
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
              <div class="detail-row"><dt>Office Phone (.132)</dt><dd>${escapeHtml(vg.officePhone || '—')}</dd></div>
              <div class="detail-row"><dt>Voice Pager (.133)</dt><dd>${escapeHtml(vg.voicePager || '—')}</dd></div>
              <div class="detail-row"><dt>Digital Pager (.134)</dt><dd>${escapeHtml(vg.digitalPager || '—')}</dd></div>
              <div class="detail-row"><dt>Email (.151)</dt><dd>${escapeHtml(vg.email || '—')}</dd></div>
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
              <div class="detail-row"><dt>Person Class</dt><dd>${escapeHtml(vg.personClass || '—')}</dd></div>
              <div class="detail-row"><dt>NPI</dt><dd>${escapeHtml(vg.npi || '—')}</dd></div>
              <div class="detail-row"><dt>DEA Number</dt><dd>${escapeHtml(vg.dea || '—')}</dd></div>
              <div class="detail-row"><dt>State License</dt><dd>${escapeHtml(vg.stateLicense || '—')}</dd></div>
              <div class="detail-row"><dt>Provider Type</dt><dd>${escapeHtml(vg.providerType || '—')}</dd></div>
              <div class="detail-row"><dt>Authorized to Write Meds</dt><dd>${escapeHtml(vg.authMeds || '—')}</dd></div>
              <div class="detail-row"><dt>Pharmacy Schedules (CS 2-5)</dt><dd>${escapeHtml(vg.pharmSchedules || '—')}</dd></div>
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
              <div class="detail-row"><dt>E-Sig Status</dt><dd><span class="badge ${eSigBadgeClass}">${escapeHtml(eSig.status || 'unknown')}</span></dd></div>
              <div class="detail-row"><dt>Has Code (20.4)</dt><dd>${eSig.hasCode ? 'Yes (hashed)' : 'No — needs to be set'}</dd></div>
              <div class="detail-row"><dt>Initials (20.2)</dt><dd>${escapeHtml(vg.initials || '—')}</dd></div>
              <div class="detail-row"><dt>Sig Block Name (20.3)</dt><dd>${escapeHtml(eSig.sigBlockName || vg.sigBlockName || '—')}</dd></div>
              <div class="detail-row"><dt>Sig Block Title</dt><dd>${escapeHtml(eSig.sigBlockTitle || vg.sigBlockTitle || '—')}</dd></div>
            </dl>
            <div style="margin-top:16px;border-top:1px solid #e2e8f0;padding-top:12px;">
              <h3 style="font-size:13px;margin-bottom:8px;">Edit Signature Block</h3>
              <p style="font-size:11px;color:var(--color-text-muted);margin-bottom:8px;">
                The Signature Block Name + Title appear on every printed document, prescription, and order (e.g. "JOHN SMITH, MD").
              </p>
              <div class="form-grid">
                <div><label>Initials (20.2)</label><input type="text" id="ta-esig-initials" placeholder="e.g. JS" maxlength="4" value="${escapeHtml(vg.initials || '')}" /></div>
                <div><label>Sig Block Printed Name (20.3)</label><input type="text" id="ta-esig-blockname" placeholder="e.g. JOHN SMITH" value="${escapeHtml(eSig.sigBlockName || vg.sigBlockName || '')}" /></div>
                <div><label>Sig Block Title (20.3p2)</label><input type="text" id="ta-esig-blocktitle" placeholder="e.g. MD, DO, RN, PA" value="${escapeHtml(eSig.sigBlockTitle || vg.sigBlockTitle || '')}" /></div>
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
              <label style="font-size:12px;">Key Name<br/><input type="text" id="ta-key-name" style="min-width:180px" placeholder="e.g. XUPROGMODE" /></label>
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
    msg.textContent = 'Saving…';
    const out = await apiPut(`users/${encodeURIComponent(userId)}`, { field, value });
    msg.textContent = out.ok ? 'Saved. RPC: ' + (out.rpcUsed || 'DDR FILER') : (out.error || JSON.stringify(out));
    msg.style.color = out.ok ? '#166534' : '#b91c1c';
  });

  const keyAdd = document.getElementById('ta-key-add');
  const keyDel = document.getElementById('ta-key-del');
  const keyMsg = document.getElementById('ta-key-msg');
  if (keyAdd) keyAdd.addEventListener('click', async () => {
    const keyName = (document.getElementById('ta-key-name') || {}).value || '';
    keyMsg.textContent = 'Saving…';
    const out = await apiPost(`users/${encodeURIComponent(userId)}/keys`, { keyName });
    keyMsg.textContent = out.ok ? 'Key assigned.' : (out.error || JSON.stringify(out));
    keyMsg.style.color = out.ok ? '#166534' : '#b91c1c';
  });
  if (keyDel) keyDel.addEventListener('click', async () => {
    const keyName = (document.getElementById('ta-key-name') || {}).value || '';
    if (!keyName.trim()) { keyMsg.textContent = 'Enter key name'; keyMsg.style.color = '#b91c1c'; return; }
    if (!confirm('Remove key "' + keyName.trim() + '"?')) return;
    keyMsg.textContent = 'Removing…';
    const out = await apiDelete(`users/${encodeURIComponent(userId)}/keys/${encodeURIComponent(keyName.trim())}`);
    keyMsg.textContent = out.ok ? 'Key removed.' : (out.error || JSON.stringify(out));
    keyMsg.style.color = out.ok ? '#166534' : '#b91c1c';
  });

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
    msg.textContent = 'Saving…';
    const out = await apiPost(`users/${encodeURIComponent(userId)}/esig`, { code });
    msg.textContent = out.ok ? 'E-sig updated.' : (out.error || JSON.stringify(out));
    msg.style.color = out.ok ? '#166534' : '#b91c1c';
  });

  const esigClear = document.getElementById('ta-esig-clear');
  if (esigClear) esigClear.addEventListener('click', async () => {
    if (!confirm('Clear this user\'s e-signature code? They will need to set a new one to sign documents.')) return;
    const msg = document.getElementById('ta-esig-msg');
    msg.textContent = 'Clearing…';
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
    msg.textContent = 'Saving…';
    const out = await apiPut(`users/${encodeURIComponent(userId)}/credentials`, { accessCode: ac, verifyCode: vc });
    msg.textContent = out.ok ? 'Credentials updated.' : (out.error || JSON.stringify(out));
    msg.style.color = out.ok ? '#166534' : '#b91c1c';
  });

  const deact = document.getElementById('ta-deact');
  const react = document.getElementById('ta-react');
  const resetAc = document.getElementById('ta-reset-ac');
  const resetVc = document.getElementById('ta-reset-vc');
  const lifeMsg = document.getElementById('ta-life-msg');
  if (deact) deact.addEventListener('click', async () => {
    if (!confirm('Deactivate this user? They will no longer be able to log in.')) return;
    lifeMsg.textContent = 'Deactivating…';
    const out = await apiPost(`users/${encodeURIComponent(userId)}/deactivate`, {});
    lifeMsg.textContent = out.ok ? 'Deactivated.' : (out.error || JSON.stringify(out));
    lifeMsg.style.color = out.ok ? '#166534' : '#b91c1c';
  });
  if (react) react.addEventListener('click', async () => {
    if (!confirm('Reactivate this user?')) return;
    lifeMsg.textContent = 'Reactivating…';
    const out = await apiPost(`users/${encodeURIComponent(userId)}/reactivate`, {});
    lifeMsg.textContent = out.ok ? 'Reactivated.' : (out.error || JSON.stringify(out));
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
    if (!list.length) return '<tr><td colspan="5">No clinics</td></tr>';
    return list.map(c => `<tr>
      <td><a href="#/clinics/${encodeURIComponent(c.ien || c.file44Ien || '')}">${escapeHtml(c.name)}</a></td>
      <td>${escapeHtml(c.abbreviation || '—')}</td>
      <td>${c.stopCode ? escapeHtml(c.stopCode.ien + ' — ' + c.stopCode.name) : '—'}</td>
      <td>${c.defaultSlotLength ? c.defaultSlotLength + ' min' : '—'}</td>
      <td><span class="badge ${(c.status || 'active') === 'active' ? 'badge-active' : 'badge-inactive'}">${escapeHtml(c.status || 'active')}</span></td>
    </tr>`).join('');
  }

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Facilities &amp; Locations › Clinics</div>
    <div class="page-header"><h1>Clinics (File 44)</h1>${sourceBadge(res.sourceStatus || res.source)}</div>
    <div class="explanation-header">
      <strong>Clinic Setup (File 44 — HOSPITAL LOCATION)</strong>
      Clinics are where outpatient care happens. Each clinic has scheduling configuration, stop codes for workload,
      availability patterns, and provider assignments. Read via <code>ORWU CLINLOC</code>, add via <code>ZVE CLNM ADD</code>.
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

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/clinics">Clinics</a> › ${v('.01')}</div>
    <div class="page-header"><h1>${v('.01')}</h1>${badge}</div>
    <div class="explanation-header">
      <strong>Clinic Configuration (File 44 — HOSPITAL LOCATION)</strong>
      This is one of the largest configuration surfaces in VistA — equivalent to FreePBX's Extension detail page.
      All fields are read via <code>DDR GETS</code> and written via <code>DDR FILER</code>.
    </div>

    <!-- Section A: Basic Info -->
    <div class="detail-section">
      <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">▾</span> Basic Info</h2>
      <div class="collapsible-content">
        <dl>
          <div class="detail-row"><dt>Clinic Name (.01)</dt><dd>${v('.01')}</dd></div>
          <div class="detail-row"><dt>Abbreviation (2)</dt><dd>${v('2')}</dd></div>
          <div class="detail-row"><dt>Service</dt><dd>${v('3') !== '—' ? v('3') : '—'} <small>(File 49 pointer)</small></dd></div>
          <div class="detail-row"><dt>Stop Code (8)</dt><dd>${v('8')} <small>(File 40.7 — DSS workload)</small></dd></div>
          <div class="detail-row"><dt>Credit Stop Code</dt><dd>${v('2503')} <small>(File 40.7 — credit pair)</small></dd></div>
          <div class="detail-row"><dt>Physical Location</dt><dd>${v('4')}</dd></div>
          <div class="detail-row"><dt>Telephone</dt><dd>${v('9')}</dd></div>
          <div class="detail-row"><dt>Default Provider</dt><dd>${v('16')} <small>(File 200 pointer)</small></dd></div>
          <div class="detail-row"><dt>Non-Count Clinic</dt><dd>${v('1')}</dd></div>
          <div class="detail-row"><dt>IEN</dt><dd>${escapeHtml(clinicIen)}</dd></div>
        </dl>
      </div>
    </div>

    <!-- Section B: Scheduling Configuration -->
    <div class="detail-section">
      <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">▾</span> Scheduling Configuration</h2>
      <div class="collapsible-content">
        <dl>
          <div class="detail-row"><dt>Length of Appointment (1912)</dt><dd>${v('1912')} ${d['1912'] ? 'minutes' : ''}</dd></div>
          <div class="detail-row"><dt>Variable Appointment Length (1913)</dt><dd>${v('1913')}</dd></div>
          <div class="detail-row"><dt>Hour Clinic Display Begins (1914)</dt><dd>${v('1914')}</dd></div>
          <div class="detail-row"><dt>Display Increments Per Hour (1917)</dt><dd>${v('1917')}</dd></div>
          <div class="detail-row"><dt>Schedule on Holidays (1918.5)</dt><dd>${v('1918.5')}</dd></div>
          <div class="detail-row"><dt>Overbooks/Day Maximum (1918)</dt><dd>${v('1918')}</dd></div>
          <div class="detail-row"><dt>Max Days for Future Booking (2002)</dt><dd>${v('2002')}</dd></div>
          <div class="detail-row"><dt>Default Appointment Type</dt><dd>${v('409.1')} <small>(File 409.1 pointer)</small></dd></div>
          <div class="detail-row"><dt>Allowable Consecutive No-Shows</dt><dd>${v('1920') || '—'}</dd></div>
        </dl>
      </div>
    </div>

    <!-- Section C: Availability Patterns -->
    <div class="detail-section">
      <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">▾</span> Availability Patterns</h2>
      <div class="collapsible-content">
        <div class="explanation-header" style="margin-bottom:12px;">
          In VistA terminal, the <code>SDBUILD</code> option walks the admin through defining time slots day-by-day.
          The availability calendar shows Mon-Fri with time slots, provider assignments per slot, and overbooking rules.
          This requires reading the File 44 availability sub-file and is a complex multi-record structure.
        </div>
        <p style="color:var(--color-text-muted);font-size:13px;">
          <span class="badge badge-pending">Calendar UI pending</span>
          Availability patterns require reading the appointment sub-file of File 44.
          Terminal equivalent: <code>SDBUILD</code> (Set Up Clinic Availability).
        </p>
      </div>
    </div>

    <!-- Section D: Letters and Forms -->
    <div class="detail-section">
      <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">▾</span> Letters &amp; Forms</h2>
      <div class="collapsible-content">
        <dl>
          <div class="detail-row"><dt>No-Show Letter</dt><dd>— <small>(template selection)</small></dd></div>
          <div class="detail-row"><dt>Pre-Appointment Letter</dt><dd>— <small>(template selection)</small></dd></div>
          <div class="detail-row"><dt>Clinic Cancellation Letter</dt><dd>— <small>(template selection)</small></dd></div>
          <div class="detail-row"><dt>Appointment Cancellation Letter</dt><dd>— <small>(template selection)</small></dd></div>
          <div class="detail-row"><dt>Encounter Form</dt><dd>— <small>(attached form for this clinic)</small></dd></div>
        </dl>
      </div>
    </div>

    <!-- Section E: Advanced Settings -->
    <div class="detail-section">
      <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">▾</span> Advanced Settings</h2>
      <div class="collapsible-content">
        <dl>
          <div class="detail-row"><dt>Prohibit Access to Clinic</dt><dd>—</dd></div>
          <div class="detail-row"><dt>Require X-Ray Films</dt><dd>—</dd></div>
          <div class="detail-row"><dt>Require Action Profiles</dt><dd>—</dd></div>
          <div class="detail-row"><dt>Ask for Check In/Out Time</dt><dd>—</dd></div>
          <div class="detail-row"><dt>Workload Validation at Checkout</dt><dd>—</dd></div>
          <div class="detail-row"><dt>Administer Inpatient Meds</dt><dd>—</dd></div>
        </dl>
      </div>
    </div>

    <!-- Edit Section -->
    <div class="detail-section">
      <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">▾</span> Edit Clinic Field</h2>
      <div class="collapsible-content">
        <p style="font-size:12px;color:var(--color-text-muted);margin-bottom:8px;">Write to File 44 via DDR VALIDATOR + DDR FILER.</p>
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;">
          <label style="font-size:12px;">Field<br/><select id="clinic-edit-field" style="min-width:220px;">
            ${Object.entries(FIELD_LABELS).map(([k,l]) => `<option value="${k}">${k} — ${l}</option>`).join('')}
          </select></label>
          <label style="font-size:12px;">Value<br/><input type="text" id="clinic-edit-value" placeholder="New value" style="min-width:200px;" /></label>
          <button type="button" class="btn-primary btn-sm" id="clinic-edit-save">Save</button>
        </div>
        <div id="clinic-edit-msg" style="margin-top:8px;font-size:12px;"></div>
      </div>
    </div>

    ${res.ok && res.rawLines ? `
    <div class="detail-section collapsed">
      <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">▾</span> Raw DDR GETS (File 44)</h2>
      <div class="collapsible-content">
        <pre style="font-size:11px;overflow:auto;max-height:200px;background:#f8fafc;padding:8px;border-radius:4px;">${escapeHtml(JSON.stringify(d, null, 2))}</pre>
      </div>
    </div>` : ''}`;

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
      const beds = w.beds || [];
      const ien = w.ien || w.file42Ien || '';
      return `<tr>
        <td><a href="#/wards/${encodeURIComponent(ien)}">${escapeHtml(w.name)}</a></td>
        <td>${escapeHtml(w.specialty || '—')}</td>
        <td>${w.bedCount ?? beds.length}</td>
        <td>${w.availableBeds ?? beds.filter(b => b.status === 'available').length}</td>
      </tr>`;
    }).join('');
  }

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Facilities &amp; Locations › Wards &amp; Beds</div>
    <div class="page-header"><h1>Wards &amp; Beds</h1>${sourceBadge(res.sourceStatus || res.source)}</div>
    <div class="explanation-header">
      <strong>Ward Configuration (File 42) &amp; Room-Bed Management (File 405.4)</strong>
      Wards are inpatient locations with assigned beds, treating specialties, and services.
    </div>
    <div class="filter-rail">
      <input type="text" id="ward-search" placeholder="Search wards…" />
      <span class="result-count" id="ward-count">Showing ${wards.length} of ${wards.length}</span>
    </div>
    <table class="data-table">
      <thead><tr><th>Ward</th><th>Specialty</th><th>Beds</th><th>Available</th></tr></thead>
      <tbody id="ward-tbody">${rows(wards)}</tbody>
    </table>`;

  document.getElementById('ward-search').addEventListener('input', () => {
    const q = (document.getElementById('ward-search').value || '').toLowerCase();
    const filtered = wards.filter(w => w.name.toLowerCase().includes(q) || (w.specialty || '').toLowerCase().includes(q));
    document.getElementById('ward-tbody').innerHTML = rows(filtered);
    document.getElementById('ward-count').textContent = `Showing ${filtered.length} of ${wards.length}`;
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
          <div class="detail-row"><dt>Ward Name (.01)</dt><dd>${v('.01')}</dd></div>
          <div class="detail-row"><dt>Abbreviation (.015)</dt><dd>${v('.015')}</dd></div>
          <div class="detail-row"><dt>Division</dt><dd>${v('1')} <small>(File 40.8 pointer)</small></dd></div>
          <div class="detail-row"><dt>Treating Specialty (2)</dt><dd>${v('2')} <small>(File 45.7 pointer)</small></dd></div>
          <div class="detail-row"><dt>Service (3)</dt><dd>${v('3')} <small>(File 49 pointer)</small></dd></div>
          <div class="detail-row"><dt>Operating Beds (.1)</dt><dd>${v('.1')}</dd></div>
          <div class="detail-row"><dt>Authorized Beds</dt><dd>${v('.105')}</dd></div>
          <div class="detail-row"><dt>IEN</dt><dd>${escapeHtml(wardIen)}</dd></div>
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
      <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">▾</span> Edit Ward Name</h2>
      <div class="collapsible-content">
        <div style="display:flex;gap:8px;align-items:flex-end;">
          <label style="font-size:12px;">New Name<br/><input type="text" id="ward-edit-name" placeholder="Ward name" style="min-width:220px;" /></label>
          <button type="button" class="btn-primary btn-sm" id="ward-edit-save">Rename</button>
        </div>
        <div id="ward-edit-msg" style="margin-top:8px;font-size:12px;"></div>
      </div>
    </div>
    ${res.ok && res.rawLines ? `
    <div class="detail-section collapsed">
      <h2 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">▾</span> Raw DDR GETS (File 42)</h2>
      <div class="collapsible-content">
        <pre style="font-size:11px;overflow:auto;max-height:200px;background:#f8fafc;padding:8px;border-radius:4px;">${escapeHtml(JSON.stringify(d, null, 2))}</pre>
      </div>
    </div>` : ''}`;

  const saveBtn = document.getElementById('ward-edit-save');
  if (saveBtn) saveBtn.addEventListener('click', async () => {
    const name = (document.getElementById('ward-edit-name') || {}).value || '';
    const msg = document.getElementById('ward-edit-msg');
    if (!name.trim()) { msg.textContent = 'Name required.'; msg.style.color = '#b91c1c'; return; }
    if (!confirm('Rename ward to "' + name.trim() + '"?')) return;
    msg.textContent = 'Saving…'; msg.style.color = '';
    const out = await apiPut(`wards/${encodeURIComponent(wardIen)}`, { name: name.trim() });
    msg.textContent = out.ok ? 'Saved.' : (out.error || JSON.stringify(out));
    msg.style.color = out.ok ? '#166534' : '#b91c1c';
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
    return list.map(k => `<tr>
      <td><span class="badge badge-key">${escapeHtml(k.keyName)}</span></td>
      <td>${escapeHtml(k.description || '—')}</td>
      <td style="font-weight:600">${k.holderCount}</td>
      <td>${(k.vistaGrounding || {}).file19_1Ien ? 'IEN ' + (k.vistaGrounding || {}).file19_1Ien : '—'}</td>
    </tr>`).join('');
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
    if (!confirm('Create security key "' + name.trim().toUpperCase() + '"?')) return;
    msg.textContent = 'Creating…'; msg.style.color = '';
    msg.textContent = 'Security key creation requires ZVE USMG KEYS overlay RPC (integration-pending).';
    msg.style.color = '#92400e';
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
    <div class="page-header"><h1>Kernel Site Parameters</h1></div><div class="loading-message">Loading…</div>`;
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
  for (const line of lines) {
    if (line.includes('^') && !line.startsWith('[')) {
      const parts = line.split('^');
      if (parts.length >= 2) fieldMap[parts[0]?.trim()] = parts.slice(1).join('^').trim();
    }
  }
  const hasData = Object.keys(fieldMap).length > 0 && !lines.some(l => l.includes('[ERROR]'));
  const fieldRows = hasData
    ? Object.entries(fieldMap).map(([k, v]) => `<div class="detail-row"><dt>${escapeHtml(LABELS[k] || k)} <code style="font-size:10px;color:var(--color-text-muted)">${escapeHtml(k)}</code></dt><dd>${escapeHtml(v || '(empty)')}</dd></div>`).join('')
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
          <option value=".01">.01 — SITE NAME</option>
          <option value=".02">.02 — DOMAIN NAME</option>
          <option value=".03">.03 — DEFAULT INSTITUTION</option>
          <option value=".04">.04 — DEFAULT AUTO MENU</option>
          <option value=".05">.05 — DEFAULT LANGUAGE</option>
          <option value="205">205 — AGENCY CODE</option>
          <option value="230">230 — PRODUCTION ACCOUNT</option>
          <option value="210">210 — DEFAULT TIMEOUT</option>
          <option value="501">501 — MULTIPLE SIGN-ON</option>
          <option value="240">240 — BROKER TIMEOUT</option>
        </select></label>
        <label style="font-size:12px;">Value<br/><input type="text" id="ta-kv" placeholder="New value" style="min-width:200px;" /></label>
        <button type="button" class="btn-primary" id="ta-ksave">Save</button>
      </div>
      <div id="ta-kmsg" style="margin-top:8px;font-size:12px;"></div>
    </div>`;

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
    <div class="page-header"><h1>System Status</h1>${connected ? '<span class="source-posture vista">CONNECTED</span>' : '<span class="source-posture fixture">DISCONNECTED</span>'}</div>
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
      <tbody id="tt-tbody">${rows.length ? rows.map(r => `<tr><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.rightMargin || '—')}</td><td>${escapeHtml(r.formFeed || '—')}</td><td>${escapeHtml(r.pageLength || '—')}</td></tr>`).join('') : '<tr><td colspan="5">No terminal types found</td></tr>'}</tbody>
    </table>`;
  document.getElementById('tt-search').addEventListener('input', () => {
    const q = (document.getElementById('tt-search').value || '').toLowerCase();
    const filtered = rows.filter(r => (r.name || '').toLowerCase().includes(q));
    document.getElementById('tt-tbody').innerHTML = filtered.map(r => `<tr><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.rightMargin || '—')}</td><td>${escapeHtml(r.formFeed || '—')}</td><td>${escapeHtml(r.pageLength || '—')}</td></tr>`).join('');
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
      <tbody id="ts-tbody">${rows.length ? rows.map(r => `<tr><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.service || '—')}</td><td>${escapeHtml(r.specialty || '—')}</td></tr>`).join('') : '<tr><td colspan="4">No treating specialties found</td></tr>'}</tbody>
    </table>`;
  document.getElementById('ts-search').addEventListener('input', () => {
    const q = (document.getElementById('ts-search').value || '').toLowerCase();
    const filtered = rows.filter(r => (r.name || '').toLowerCase().includes(q));
    document.getElementById('ts-tbody').innerHTML = filtered.map(r => `<tr><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.service || '—')}</td><td>${escapeHtml(r.specialty || '—')}</td></tr>`).join('');
    document.getElementById('ts-count').textContent = `${filtered.length} of ${rows.length} specialties`;
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
      <tbody id="rb-tbody">${rows.length ? rows.map(r => `<tr><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.roomBed)}</td><td>${escapeHtml(r.description || '—')}</td><td>${r.outOfService === '1' ? '<span style="color:var(--error)">Yes</span>' : 'No'}</td></tr>`).join('') : '<tr><td colspan="4">No room-beds found in File 405.4</td></tr>'}</tbody>
    </table>`;
  document.getElementById('rb-search').addEventListener('input', () => {
    const q = (document.getElementById('rb-search').value || '').toLowerCase();
    const filtered = rows.filter(r => (r.roomBed || '').toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q));
    document.getElementById('rb-tbody').innerHTML = filtered.map(r => `<tr><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.roomBed)}</td><td>${escapeHtml(r.description || '—')}</td><td>${r.outOfService === '1' ? '<span style="color:var(--error)">Yes</span>' : 'No'}</td></tr>`).join('');
    document.getElementById('rb-count').textContent = `${filtered.length} of ${rows.length} room-beds`;
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
      <tbody id="pkg-tbody">${rows.length ? rows.map(r => `<tr><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td><code>${escapeHtml(r.prefix || '—')}</code></td><td>${escapeHtml(r.shortDesc || '—')}</td></tr>`).join('') : '<tr><td colspan="4">No packages found</td></tr>'}</tbody>
    </table>`;
  document.getElementById('pkg-search').addEventListener('input', () => {
    const q = (document.getElementById('pkg-search').value || '').toLowerCase();
    const filtered = rows.filter(r => (r.name || '').toLowerCase().includes(q) || (r.prefix || '').toLowerCase().includes(q));
    document.getElementById('pkg-tbody').innerHTML = filtered.map(r => `<tr><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td><code>${escapeHtml(r.prefix || '—')}</code></td><td>${escapeHtml(r.shortDesc || '—')}</td></tr>`).join('');
    document.getElementById('pkg-count').textContent = `${filtered.length} of ${rows.length} packages`;
  });
}

// ---------------------------------------------------------------------------
// HL7 Interfaces (File 870) — DDR LISTER backed (read-only)
// ---------------------------------------------------------------------------
async function renderHL7Interfaces(el) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/devices">Devices</a> › HL7 Interfaces</div><div class="loading-message">Loading…</div>`;
  const res = await api('hl7-interfaces');
  if (!res.ok) { el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/devices">Devices</a> › HL7 Interfaces</div><div class="error-message">${escapeHtml(res.error || 'Failed to load')}</div>`; return; }
  const rows = res.data || [];
  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/devices">Devices</a> › HL7 Interfaces</div>
    <div class="page-header"><h1>HL7 Interfaces (File 870)</h1>${sourceBadge(res.source)}</div>
    <div class="explanation-header">
      <strong>HL7 Logical Links — Interface Monitoring</strong>
      File 870 (HL LOGICAL LINK) stores all configured HL7 interfaces. These are the connections between VistA and external systems
      (labs, imaging, pharmacy, ADT feeds). This is a read-only monitoring view.
    </div>
    <div class="filter-rail">
      <input type="text" id="hl7-search" placeholder="Search interfaces…" />
      <span class="result-count" id="hl7-count">${rows.length} interfaces</span>
    </div>
    <table class="data-table">
      <thead><tr><th>IEN</th><th>Link Name</th><th>Institution</th><th>Lower Layer Protocol</th><th>Autostart</th></tr></thead>
      <tbody id="hl7-tbody">${rows.length ? rows.map(r => `<tr><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.institution || '—')}</td><td>${escapeHtml(r.lowerLayer || '—')}</td><td>${escapeHtml(r.autostart || '—')}</td></tr>`).join('') : '<tr><td colspan="5">No HL7 interfaces configured</td></tr>'}</tbody>
    </table>`;
  document.getElementById('hl7-search').addEventListener('input', () => {
    const q = (document.getElementById('hl7-search').value || '').toLowerCase();
    const filtered = rows.filter(r => (r.name || '').toLowerCase().includes(q));
    document.getElementById('hl7-tbody').innerHTML = filtered.map(r => `<tr><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.institution || '—')}</td><td>${escapeHtml(r.lowerLayer || '—')}</td><td>${escapeHtml(r.autostart || '—')}</td></tr>`).join('');
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
      <tbody id="ins-tbody">${rows.length ? rows.map(r => `<tr><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.streetAddr || '—')}</td><td>${escapeHtml(r.city || '—')}</td><td>${escapeHtml(r.state || '—')}</td><td>${escapeHtml(r.zip || '—')}</td></tr>`).join('') : '<tr><td colspan="6">No insurance companies found in File 36</td></tr>'}</tbody>
    </table>`;
  document.getElementById('ins-search').addEventListener('input', () => {
    const q = (document.getElementById('ins-search').value || '').toLowerCase();
    const filtered = rows.filter(r => (r.name || '').toLowerCase().includes(q) || (r.city || '').toLowerCase().includes(q));
    document.getElementById('ins-tbody').innerHTML = filtered.map(r => `<tr><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.streetAddr || '—')}</td><td>${escapeHtml(r.city || '—')}</td><td>${escapeHtml(r.state || '—')}</td><td>${escapeHtml(r.zip || '—')}</td></tr>`).join('');
    document.getElementById('ins-count').textContent = `${filtered.length} of ${rows.length} companies`;
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
      <thead><tr><th>IEN</th><th>Appointment Type</th><th>Synonym</th><th>Status</th></tr></thead>
      <tbody id="at-tbody">${rows.length ? rows.map(r => `<tr><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.synonym || '—')}</td><td>${r.inactive ? '<span class="badge badge-inactive">Inactive</span>' : '<span class="badge badge-active">Active</span>'}</td></tr>`).join('') : '<tr><td colspan="4">No appointment types found in File 409.1</td></tr>'}</tbody>
    </table>`;
  document.getElementById('at-search').addEventListener('input', () => {
    const q = (document.getElementById('at-search').value || '').toLowerCase();
    const filtered = rows.filter(r => (r.name || '').toLowerCase().includes(q) || (r.synonym || '').toLowerCase().includes(q));
    document.getElementById('at-tbody').innerHTML = filtered.map(r => `<tr><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.synonym || '—')}</td><td>${r.inactive ? '<span class="badge badge-inactive">Inactive</span>' : '<span class="badge badge-active">Active</span>'}</td></tr>`).join('');
    document.getElementById('at-count').textContent = `${filtered.length} of ${rows.length} types`;
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
      <tbody id="mn-tbody">${rows.length ? rows.map(r => `<tr><td>${escapeHtml(r.ien)}</td><td><code>${escapeHtml(r.name)}</code></td><td>${escapeHtml(r.menuText || '—')}</td><td>${escapeHtml(r.type || '—')}</td><td>${escapeHtml(r.description || '—')}</td></tr>`).join('') : '<tr><td colspan="5">No options found</td></tr>'}</tbody>
    </table>`;
  document.getElementById('mn-search').addEventListener('input', () => {
    const q = (document.getElementById('mn-search').value || '').toLowerCase();
    const filtered = rows.filter(r => (r.name || '').toLowerCase().includes(q) || (r.menuText || '').toLowerCase().includes(q));
    document.getElementById('mn-tbody').innerHTML = filtered.map(r => `<tr><td>${escapeHtml(r.ien)}</td><td><code>${escapeHtml(r.name)}</code></td><td>${escapeHtml(r.menuText || '—')}</td><td>${escapeHtml(r.type || '—')}</td><td>${escapeHtml(r.description || '—')}</td></tr>`).join('');
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
      <tbody id="df-tbody">${rows.length ? rows.map(r => `<tr><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td><code>${escapeHtml(r.vaClass || '—')}</code></td><td>${escapeHtml(deaCodes[r.dea] || r.dea || '—')}</td><td>${r.inactiveDate ? escapeHtml(r.inactiveDate) : '<span style="color:var(--success)">Active</span>'}</td></tr>`).join('') : '<tr><td colspan="5">No drugs found</td></tr>'}</tbody>
    </table>`;
  document.getElementById('df-search').addEventListener('input', () => {
    const q = (document.getElementById('df-search').value || '').toLowerCase();
    const filtered = rows.filter(r => (r.name || '').toLowerCase().includes(q) || (r.vaClass || '').toLowerCase().includes(q));
    document.getElementById('df-tbody').innerHTML = filtered.map(r => `<tr><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td><code>${escapeHtml(r.vaClass || '—')}</code></td><td>${escapeHtml(deaCodes[r.dea] || r.dea || '—')}</td><td>${r.inactiveDate ? escapeHtml(r.inactiveDate) : '<span style="color:var(--success)">Active</span>'}</td></tr>`).join('');
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
      <tbody id="lt-tbody">${rows.length ? rows.map(r => `<tr><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(typeMap[r.type] || r.type || '—')}</td><td>${escapeHtml(subMap[r.subscript] || r.subscript || '—')}</td></tr>`).join('') : '<tr><td colspan="4">No lab tests found</td></tr>'}</tbody>
    </table>`;
  function applyFilter() {
    const q = (document.getElementById('lt-search').value || '').toLowerCase();
    const sub = document.getElementById('lt-sub-filter').value;
    const filtered = rows.filter(r => {
      if (q && !(r.name || '').toLowerCase().includes(q)) return false;
      if (sub && r.subscript !== sub) return false;
      return true;
    });
    document.getElementById('lt-tbody').innerHTML = filtered.map(r => `<tr><td>${escapeHtml(r.ien)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(typeMap[r.type] || r.type || '—')}</td><td>${escapeHtml(subMap[r.subscript] || r.subscript || '—')}</td></tr>`).join('');
    document.getElementById('lt-count').textContent = `${filtered.length} of ${rows.length} tests`;
  }
  document.getElementById('lt-search').addEventListener('input', applyFilter);
  document.getElementById('lt-sub-filter').addEventListener('change', applyFilter);
}

// ---------------------------------------------------------------------------
// TaskMan — Background Jobs (File 14.4) — DDR LISTER backed (read-only)
// ---------------------------------------------------------------------------
async function renderTaskMan(el) {
  el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/params/kernel">System</a> › TaskMan</div><div class="loading-message">Loading TaskMan tasks…</div>`;
  const res = await api('taskman-tasks');
  if (!res.ok) { el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/params/kernel">System</a> › TaskMan</div><div class="error-message">${escapeHtml(res.error || 'Failed to load')}</div>`; return; }
  const rows = res.data || [];
  const statusMap = { '0': 'Pending', '1': 'Active', '2': 'Completed', '3': 'Error', '4': 'Interrupted', '5': 'Available' };
  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/params/kernel">System</a> › TaskMan</div>
    <div class="page-header"><h1>TaskMan — Background Jobs (File 14.4)</h1>${sourceBadge(res.source)}</div>
    <div class="explanation-header">
      <strong>VistA Task Scheduler</strong>
      File 14.4 (TASK) stores all background tasks managed by TaskMan. Each task has an entry point, routine, scheduled run time, and status.
      This shows the most recent 200 tasks via <code>DDR LISTER</code>. Status codes: 0=Pending, 1=Active, 2=Completed, 3=Error.
    </div>
    <div class="filter-rail">
      <input type="text" id="tm-search" placeholder="Search by routine or entry point…" />
      <span class="result-count" id="tm-count">${rows.length} tasks</span>
    </div>
    <table class="data-table">
      <thead><tr><th>Task #</th><th>Entry Point</th><th>Routine</th><th>Scheduled Run</th><th>Status</th></tr></thead>
      <tbody id="tm-tbody">${rows.length ? rows.map(r => `<tr><td>${escapeHtml(r.ien)}</td><td><code>${escapeHtml(r.entryPoint || '—')}</code></td><td><code>${escapeHtml(r.routine || '—')}</code></td><td>${escapeHtml(r.scheduledRun || '—')}</td><td>${escapeHtml(statusMap[r.statusCode] || r.statusCode || '—')}</td></tr>`).join('') : '<tr><td colspan="5">No tasks found</td></tr>'}</tbody>
    </table>`;
  document.getElementById('tm-search').addEventListener('input', () => {
    const q = (document.getElementById('tm-search').value || '').toLowerCase();
    const filtered = rows.filter(r => (r.entryPoint || '').toLowerCase().includes(q) || (r.routine || '').toLowerCase().includes(q));
    document.getElementById('tm-tbody').innerHTML = filtered.map(r => `<tr><td>${escapeHtml(r.ien)}</td><td><code>${escapeHtml(r.entryPoint || '—')}</code></td><td><code>${escapeHtml(r.routine || '—')}</code></td><td>${escapeHtml(r.scheduledRun || '—')}</td><td>${escapeHtml(statusMap[r.statusCode] || r.statusCode || '—')}</td></tr>`).join('');
    document.getElementById('tm-count').textContent = `${filtered.length} of ${rows.length} tasks`;
  });
}
