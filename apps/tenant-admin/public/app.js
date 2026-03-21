/**
 * Tenant Admin — VistA-First SPA (direct XWB broker, fixture fallback)
 *
 * Hash-based routing with 13 render functions matching the tenant-admin surfaces
 * defined in tenant-admin-design-contract-v1.md and the direct-write architecture.
 *
 * Implementation posture: VistA-first — direct XWB RPC broker connection via
 * lib/xwb-client.mjs. When VISTA_HOST/PORT/ACCESS_CODE/VERIFY_CODE are configured,
 * data comes from live VistA RPCs (ORWU NEWPERS, ORWU HASKEY, XUS DIVISION GET,
 * ORWU CLINLOC, ORQPT WARDS, DDR family). Otherwise, fixture data is used.
 * Source badges display "VistA", "FIXTURE", or "INTEGRATION-PENDING" per surface.
 *
 * Surfaces: Dashboard, User List, User Detail, Role Assignment,
 *           Facility List, Facility Detail, Clinic List, Ward List,
 *           Key Inventory, E-Sig Status, VistA Tools (DDR probe),
 *           Devices, Kernel Parameters
 */

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const STATE = {
  tenantId: null,
  cpReturnUrl: null,
};

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // Parse tenantId + cpReturnUrl from query string (set by operator console handoff)
  const qs = new URLSearchParams(window.location.search);
  STATE.tenantId = qs.get('tenantId') || 'default-tenant';
  STATE.cpReturnUrl = qs.get('cpReturnUrl') || null;

  // Tenant banner
  document.getElementById('tenant-name').textContent = STATE.tenantId;
  document.getElementById('tenant-id-display').textContent = 'Tenant: ' + STATE.tenantId;

  // Probe VistA connection and set banner status
  fetch('/api/tenant-admin/v1/vista-status')
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

  // Return link
  if (STATE.cpReturnUrl) {
    const link = document.getElementById('return-to-cp');
    link.style.display = '';
    link.href = STATE.cpReturnUrl;
  }

  // Nav click handler
  document.getElementById('left-nav').addEventListener('click', (e) => {
    const link = e.target.closest('.nav-link');
    if (!link) return;
    if (link.classList.contains('nav-planned')) { e.preventDefault(); return; }
  });

  // Route on hash change
  window.addEventListener('hashchange', route);
  route();
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
function route() {
  const hash = window.location.hash || '#/dashboard';
  const content = document.getElementById('content-area');

  // Update active nav
  document.querySelectorAll('.nav-link').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === hash.split('?')[0]);
  });

  if (hash.startsWith('#/users/')) {
    const userId = hash.split('/')[2];
    renderUserDetail(content, userId);
  } else if (hash.startsWith('#/facilities/')) {
    const facId = hash.split('/')[2];
    renderFacilityDetail(content, facId);
  } else if (hash === '#/users') {
    renderUserList(content);
  } else if (hash === '#/facilities') {
    renderFacilityList(content);
  } else if (hash === '#/roles') {
    renderRoleAssignment(content);
  } else if (hash === '#/key-inventory') {
    renderKeyInventory(content);
  } else if (hash === '#/esig-status') {
    renderEsigStatus(content);
  } else if (hash === '#/clinics') {
    renderClinicList(content);
  } else if (hash === '#/wards') {
    renderWardList(content);
  } else if (hash === '#/vista-tools') {
    renderVistaTools(content);
  } else if (hash === '#/devices') {
    renderDeviceList(content);
  } else if (hash === '#/params/kernel') {
    renderParamsKernel(content);
  } else if (hash === '#/modules') {
    content.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Module Entitlements</div>
    <div class="page-header"><h1>Module Entitlements</h1><span class="source-posture pending">PLANNED</span></div>
    <div class="detail-section" style="padding:16px;font-size:13px;">
      <p>Module entitlements control which VistA features are enabled for this tenant. This includes:</p>
      <ul style="margin:8px 0 0 20px;">
        <li><strong>Clinical modules</strong> — CPRS, order entry, notes, pharmacy, lab, radiology</li>
        <li><strong>Administrative modules</strong> — scheduling, registration, billing, ADT</li>
        <li><strong>Infrastructure modules</strong> — imaging (DICOM), telehealth, analytics, interop (HL7)</li>
      </ul>
      <p style="margin-top:12px;">This surface will be implemented in a future slice. <a href="#/dashboard">Return to dashboard &rarr;</a></p>
    </div>`;
  } else if (hash === '#/connections') {
    content.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › VistA Connections</div>
    <div class="page-header"><h1>VistA Connections</h1><span class="source-posture pending">PLANNED</span></div>
    <div class="detail-section" style="padding:16px;font-size:13px;">
      <p>VistA connection management allows configuring and monitoring the XWB broker connection to the VistA instance. This includes:</p>
      <ul style="margin:8px 0 0 20px;">
        <li><strong>Broker host/port</strong> — connection parameters</li>
        <li><strong>Health monitoring</strong> — connection state, latency, reconnect history</li>
        <li><strong>RPC context</strong> — active context (OR CPRS GUI CHART), registered RPCs</li>
        <li><strong>Failover</strong> — backup VistA instances, automatic reconnection</li>
      </ul>
      <p style="margin-top:12px;">This surface will be implemented in a future slice. <a href="#/dashboard">Return to dashboard &rarr;</a></p>
    </div>`;
  } else if (hash === '#/site-params') {
    content.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Site Parameters</div>
    <div class="page-header"><h1>Site Parameters</h1><span class="source-posture pending">PLANNED</span></div>
    <div class="detail-section" style="padding:16px;font-size:13px;">
      <p>Extended site parameters beyond the kernel basics. This includes:</p>
      <ul style="margin:8px 0 0 20px;">
        <li><strong>CPRS parameters</strong> — File 8989.51 (OR PARAMETERS), order defaults, timeout settings</li>
        <li><strong>Scheduling parameters</strong> — appointment types, clinic defaults, slot lengths</li>
        <li><strong>Pharmacy parameters</strong> — dispensing rules, refill limits, drug interaction levels</li>
        <li><strong>Lab parameters</strong> — collection defaults, result notification rules</li>
      </ul>
      <p style="margin-top:12px;">For basic kernel parameters, see <a href="#/params/kernel">Kernel Params</a>. <a href="#/dashboard">Return to dashboard &rarr;</a></p>
    </div>`;
  } else {
    renderDashboard(content);
  }
}

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------
async function api(path) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `/api/tenant-admin/v1/${path}${sep}tenantId=${encodeURIComponent(STATE.tenantId)}`;
  const res = await fetch(url);
  return res.json();
}

async function apiPut(path, body) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `/api/tenant-admin/v1/${path}${sep}tenantId=${encodeURIComponent(STATE.tenantId)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  return res.json();
}

async function apiPost(path, body) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `/api/tenant-admin/v1/${path}${sep}tenantId=${encodeURIComponent(STATE.tenantId)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  return res.json();
}

async function apiDelete(path) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `/api/tenant-admin/v1/${path}${sep}tenantId=${encodeURIComponent(STATE.tenantId)}`;
  const res = await fetch(url, { method: 'DELETE' });
  return res.json();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Render a source posture badge based on the API response source field.
 * @param {string} source - 'vista', 'fixture', 'catalog', 'integration-pending', etc.
 * @returns {string} HTML for the badge
 */
function sourceBadge(source) {
  if (source === 'vista') {
    return '<span class="source-posture vista">VistA</span>';
  }
  if (source === 'catalog') {
    return '<span class="source-posture catalog">CATALOG</span>';
  }
  if (source === 'integration-pending') {
    return '<span class="source-posture pending">INTEGRATION-PENDING</span>';
  }
  return '<span class="source-posture fixture">FIXTURE</span>';
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
async function renderDashboard(el) {
  el.innerHTML = `
    <div class="page-header">
      <h1>Dashboard</h1>
      <span class="source-posture fixture">Loading…</span>
    </div>
    <div class="loading-message">Loading dashboard…</div>`;

  const res = await api('dashboard');
  if (!res.ok) { el.innerHTML = `<div class="error-message">Failed to load dashboard</div>`; return; }
  const d = res.data;
  const badge = sourceBadge(res.sourceStatus || res.source);
  const groundingStyle = d.vistaGrounding === 'connected' ? 'color:#065f46' : '';

  el.innerHTML = `
    <div class="page-header">
      <h1>Dashboard</h1>
      ${badge}
    </div>
    <div class="card-grid">
      <div class="card">
        <div class="card-label">Users</div>
        <div class="card-value">${d.userCount}</div>
        <div class="card-sub">${d.activeUserCount} active · <a href="#/users">View user list →</a></div>
      </div>
      <div class="card">
        <div class="card-label">Facilities</div>
        <div class="card-value">${d.facilityCount}</div>
        <div class="card-sub"><a href="#/facilities">View topology →</a></div>
      </div>
      <div class="card">
        <div class="card-label">Clinics</div>
        <div class="card-value">${d.clinicCount ?? '—'}</div>
        <div class="card-sub"><a href="#/clinics">View clinic list →</a></div>
      </div>
      <div class="card">
        <div class="card-label">Wards / Beds</div>
        <div class="card-value">${d.wardCount ?? '—'} / ${d.bedCount ?? '—'}</div>
        <div class="card-sub"><a href="#/wards">View ward list →</a></div>
      </div>
      <div class="card">
        <div class="card-label">Security Keys</div>
        <div class="card-value">${d.roleCount}</div>
        <div class="card-sub"><a href="#/key-inventory">View key inventory →</a></div>
      </div>
      <div class="card">
        <div class="card-label">E-Signatures Active</div>
        <div class="card-value">${d.esigActiveCount ?? '—'}</div>
        <div class="card-sub"><a href="#/esig-status">View e-sig status →</a></div>
      </div>
      <div class="card">
        <div class="card-label">VistA Grounding</div>
        <div class="card-value" style="font-size:16px;${groundingStyle}">${escapeHtml(d.vistaGrounding)}</div>
        <div class="card-sub">${d.vistaUrl ? escapeHtml(d.vistaUrl) : 'No VistA API configured'}</div>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// User List
// ---------------------------------------------------------------------------
async function renderUserList(el) {
  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › User List</div>
    <div class="page-header">
      <h1>User List</h1>
      <span class="source-posture fixture">Loading…</span>
    </div>
    <div class="loading-message">Loading users from VistA…</div>`;

  const res = await api('users');
  if (!res.ok) { el.innerHTML = `<div class="error-message">Failed to load users</div>`; return; }
  const users = res.data;
  const badge = sourceBadge(res.sourceStatus || res.source);
  const vistaNote = res.vistaStatus ? `<span class="vista-note">(VistA: ${escapeHtml(res.vistaStatus)})</span>` : '';

  if (!users.length) {
    el.innerHTML = `
      <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › User List</div>
      <div class="page-header"><h1>User List</h1>${badge}</div>
      <div class="empty-message">No users found for this tenant. ${vistaNote}</div>`;
    return;
  }

  function renderUserRows(list) {
    return list.map(u => {
      const vg = u.vistaGrounding || {};
      const eSig = vg.electronicSignature || {};
      const eSigBadge = eSig.status === 'active' ? 'badge-active'
        : eSig.status === 'revoked' ? 'badge-inactive' : 'badge-ungrounded';
      const id = u.id || u.ien || 'unknown';
      const roles = u.roles || [];
      const groundingStatus = vg.file200Status || (u.ien ? 'vista-ien' : 'unknown');
      return `
      <tr>
        <td><a href="#/users/${encodeURIComponent(id)}">${escapeHtml(u.name)}</a></td>
        <td>${escapeHtml(u.title || (u.ien ? 'DUZ ' + u.ien : '—'))}</td>
        <td><span class="badge ${(u.status || 'active') === 'active' ? 'badge-active' : 'badge-inactive'}">${escapeHtml(u.status || 'active')}</span></td>
        <td>${roles.length ? roles.map(r => '<span class="badge badge-key">' + escapeHtml(r) + '</span>').join(' ') : '<span class="badge badge-ungrounded">—</span>'}</td>
        <td><span class="badge ${eSigBadge}">${escapeHtml(eSig.status || '—')}</span></td>
        <td><span class="badge ${groundingStatus === 'grounded' ? 'badge-grounded' : groundingStatus === 'vista-ien' ? 'badge-grounded' : 'badge-ungrounded'}">${escapeHtml(groundingStatus)}</span></td>
      </tr>`;
    }).join('');
  }

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › User List</div>
    <div class="page-header">
      <h1>User List</h1>
      ${badge}
    </div>
    <div class="filter-rail">
      <input type="text" id="user-search" placeholder="Search users…" />
      <select id="user-status-filter">
        <option value="">All statuses</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
      <select id="user-grounding-filter">
        <option value="">All grounding</option>
        <option value="grounded">Grounded</option>
        <option value="ungrounded">Ungrounded</option>
      </select>
      <span class="result-count" id="user-count">Showing ${users.length} of ${users.length}</span>
    </div>
    <table class="data-table">
      <thead><tr>
        <th>Name</th><th>Title</th><th>Status</th><th>Keys</th><th>E-Sig</th><th>VistA</th>
      </tr></thead>
      <tbody id="user-tbody">${renderUserRows(users)}</tbody>
    </table>
    <div class="pagination-bar">
      <span>Showing ${users.length} of ${users.length} users</span>
    </div>
    <div class="detail-section" style="margin-top:16px;">
      <h2>Add User</h2>
      <p style="font-size:12px;color:var(--color-text-muted);margin-bottom:8px;">Creates a new user in VistA File 200 via <code>ZVE USMG ADD</code> RPC. The user will need access/verify codes set and security keys assigned after creation.</p>
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;">
        <label>Name (LAST,FIRST)<br/><input type="text" id="user-add-name" placeholder="e.g. DOE,JOHN" style="min-width:180px;" /></label>
        <label>Access Code<br/><input type="text" id="user-add-ac" placeholder="Access code" style="min-width:120px;" /></label>
        <label>Verify Code<br/><input type="password" id="user-add-vc" placeholder="Verify code" style="min-width:120px;" /></label>
        <button type="button" class="btn-primary" id="user-add-btn">Create User</button>
      </div>
      <div id="user-add-msg" style="margin-top:8px;font-size:12px;"></div>
    </div>`;

  // Wire filter handlers
  const filterUsers = () => {
    const q = (document.getElementById('user-search').value || '').toLowerCase();
    const statusF = document.getElementById('user-status-filter').value;
    const groundF = document.getElementById('user-grounding-filter').value;
    const filtered = users.filter(u => {
      if (q && !u.name.toLowerCase().includes(q) && !(u.title || '').toLowerCase().includes(q)) return false;
      if (statusF && (u.status || 'active') !== statusF) return false;
      const gStatus = (u.vistaGrounding || {}).file200Status || (u.ien ? 'grounded' : 'unknown');
      if (groundF && gStatus !== groundF) return false;
      return true;
    });
    document.getElementById('user-tbody').innerHTML = renderUserRows(filtered);
    document.getElementById('user-count').textContent = `Showing ${filtered.length} of ${users.length}`;
  };
  document.getElementById('user-search').addEventListener('input', filterUsers);
  document.getElementById('user-status-filter').addEventListener('change', filterUsers);
  document.getElementById('user-grounding-filter').addEventListener('change', filterUsers);

  const userAddBtn = document.getElementById('user-add-btn');
  if (userAddBtn) {
    userAddBtn.addEventListener('click', async () => {
      const name = (document.getElementById('user-add-name') || {}).value || '';
      const ac = (document.getElementById('user-add-ac') || {}).value || '';
      const vc = (document.getElementById('user-add-vc') || {}).value || '';
      const msg = document.getElementById('user-add-msg');
      if (!name.trim()) { msg.textContent = 'Name is required (LAST,FIRST format).'; msg.style.color = '#b91c1c'; return; }
      if (!confirm('Create user "' + name.trim() + '" in VistA? This writes to File 200.')) return;
      msg.textContent = 'Creating user in VistA…';
      msg.style.color = '';
      const out = await apiPost('users', { name: name.trim(), accessCode: ac, verifyCode: vc });
      if (out.ok) {
        msg.textContent = 'User created (IEN: ' + (out.newIen || 'pending') + '). Refreshing…';
        msg.style.color = '#166534';
        setTimeout(() => renderUserList(el), 1500);
      } else {
        msg.textContent = out.error || JSON.stringify(out);
        msg.style.color = '#b91c1c';
      }
    });
  }
}

// ---------------------------------------------------------------------------
// User Detail
// ---------------------------------------------------------------------------
async function renderUserDetail(el, userId) {
  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/users">User List</a> › Detail</div>
    <div class="loading-message">Loading user…</div>`;

  const res = await api(`users/${encodeURIComponent(userId)}`);
  if (!res.ok) { el.innerHTML = `<div class="error-message">User not found</div>`; return; }
  const u = res.data;
  const vg = u.vistaGrounding || {};
  const eSig = vg.electronicSignature || {};
  const eSigBadgeClass = eSig.status === 'active' ? 'badge-active'
    : eSig.status === 'revoked' ? 'badge-inactive' : 'badge-ungrounded';
  const roles = u.roles || [];
  const userStatus = u.status || 'active';
  const groundingStatus = vg.file200Status || (u.ien ? 'vista-ien' : 'unknown');

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/users">User List</a> › ${escapeHtml(u.name)}</div>
    <div class="page-header">
      <h1>${escapeHtml(u.name)}</h1>
      <span class="badge ${userStatus === 'active' ? 'badge-active' : 'badge-inactive'}">${escapeHtml(userStatus)}</span>
      ${vg.disuser ? '<span class="badge badge-inactive">DISUSER</span>' : ''}
      ${sourceBadge(res.sourceStatus || res.source)}
    </div>

    <div class="detail-layout">
      <div class="detail-main">
        <div class="detail-section">
          <h2>Identity</h2>
          <dl>
            <div class="detail-row"><dt>Username</dt><dd>${escapeHtml(u.username || u.name || '—')}</dd></div>
            <div class="detail-row"><dt>Title</dt><dd>${escapeHtml(u.title || (u.ien ? 'DUZ ' + u.ien : '—'))}</dd></div>
            <div class="detail-row"><dt>Status</dt><dd>${escapeHtml(userStatus)}</dd></div>
            <div class="detail-row"><dt>Initials</dt><dd>${escapeHtml(vg.initials || '—')}</dd></div>
          </dl>
        </div>

        <div class="detail-section">
          <h2>VistA Grounding (File 200)</h2>
          <dl>
            <div class="detail-row"><dt>DUZ (IEN)</dt><dd>${vg.duz ?? u.ien ?? '—'}</dd></div>
            <div class="detail-row"><dt>Grounding Status</dt><dd><span class="badge ${groundingStatus === 'grounded' || groundingStatus === 'vista-ien' ? 'badge-grounded' : 'badge-ungrounded'}">${escapeHtml(groundingStatus)}</span></dd></div>
            <div class="detail-row"><dt>Person Class</dt><dd>${escapeHtml(vg.personClass || '—')}</dd></div>
            <div class="detail-row"><dt>Service/Section</dt><dd>${escapeHtml(vg.serviceSection || '—')}</dd></div>
            <div class="detail-row"><dt>Division</dt><dd>${vg.division ? escapeHtml(vg.division.name) + ' (IEN ' + vg.division.ien + ')' : '—'}</dd></div>
            <div class="detail-row"><dt>Primary Menu Option</dt><dd><code>${escapeHtml(vg.primaryMenuOption || '—')}</code></dd></div>
            <div class="detail-row"><dt>DISUSER (disabled)</dt><dd>${vg.disuser === true ? '<span class="badge badge-inactive">YES</span>' : vg.disuser === false ? 'No' : '—'}</dd></div>
          </dl>
        </div>

        <div class="detail-section">
          <h2>Electronic Signature</h2>
          <dl>
            <div class="detail-row"><dt>E-Sig Status</dt><dd><span class="badge ${eSigBadgeClass}">${escapeHtml(eSig.status || 'unknown')}</span></dd></div>
            <div class="detail-row"><dt>Has Code (Field 20.4)</dt><dd>${eSig.hasCode ? 'Yes (hashed in VistA)' : 'No — needs to be set'}</dd></div>
            <div class="detail-row"><dt>Validation RPC</dt><dd><code>ORWU VALIDSIG</code></dd></div>
          </dl>
          <div style="margin-top:8px;padding:10px 14px;background:#eff6ff;border-radius:4px;font-size:12px;color:#1e40af;">
            <strong>VistA e-signature is a typed text code</strong> — like a secondary password, NOT a graphical/handwritten signature.
            When this user signs clinical documents (notes, orders), they will be prompted to type their e-sig code.
            VistA hashes and verifies it against the stored hash in File 200 field 20.4.
            The code itself is never retrievable — only presence can be checked.
          </div>
        </div>

        <div class="detail-section">
          <h2>Security Keys</h2>
          <div>${roles.length ? roles.map(r => '<span class="badge badge-key" style="margin:2px">' + escapeHtml(r) + '</span>').join(' ') : '<span style="color:var(--color-text-muted)">No keys listed on this user (use Key Inventory + future assign API)</span>'}</div>
          <div style="margin-top:8px;font-size:12px;color:var(--color-text-muted);">
            Key catalog: <a href="#/key-inventory">DDR LISTER (File 19.1)</a>. Assignment: <code>POST .../users/:duz/keys</code> (pending <code>ZVEUSMG</code>).
          </div>
        </div>

        ${u.vistaFields && Object.keys(u.vistaFields).length ? `
        <div class="detail-section">
          <h2>DDR GETS (raw fields)</h2>
          <pre style="font-size:11px;overflow:auto;max-height:200px;background:#f8fafc;padding:8px;border-radius:4px;">${escapeHtml(JSON.stringify(u.vistaFields, null, 2))}</pre>
        </div>` : ''}

        <div class="detail-section">
          <h2>Direct field update</h2>
          <p style="font-size:12px;color:var(--color-text-muted);">Allow-listed File 200 contact fields via <code>DDR VALIDATOR</code> + <code>DDR FILER</code> (EDIT).</p>
          <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;margin-top:8px;">
            <label>Field<br/><select id="ta-uf-field" style="min-width:160px">
              <option value=".132">.132 Office phone</option>
              <option value=".133">.133 Voice pager</option>
              <option value=".134">.134 Digital pager</option>
              <option value=".151">.151 Mail code</option>
            </select></label>
            <label>Value<br/><input type="text" id="ta-uf-value" style="min-width:200px" placeholder="New value" /></label>
            <button type="button" id="ta-uf-save" class="btn-primary">Save to VistA</button>
          </div>
          <div id="ta-uf-msg" style="margin-top:8px;font-size:12px;"></div>
        </div>

        <div class="detail-section">
          <h2>Security key (direct RPC)</h2>
          <p style="font-size:12px;color:var(--color-text-muted);">Calls <code>ZVE USMG KEYS</code> when installed in VistA (distro <code>ZVEUSMG.m</code>).</p>
          <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;margin-top:8px;">
            <label>Key name<br/><input type="text" id="ta-key-name" style="min-width:180px" placeholder="e.g. XUPROGMODE" /></label>
            <button type="button" id="ta-key-add" class="btn-primary">Assign key</button>
            <button type="button" id="ta-key-del" class="btn">Remove key</button>
          </div>
          <div id="ta-key-msg" style="margin-top:8px;font-size:12px;"></div>
        </div>

        <div class="detail-section">
          <h2>Electronic signature</h2>
          <input type="password" id="ta-esig-code" placeholder="New e-sig code" style="min-width:200px;margin-right:8px;" />
          <button type="button" id="ta-esig-save" class="btn-primary">Set e-sig</button>
          <div id="ta-esig-msg" style="margin-top:8px;font-size:12px;"></div>
        </div>

        <div class="detail-section">
          <h2>Access / Verify codes</h2>
          <input type="text" id="ta-ac" placeholder="Access" style="min-width:120px;margin-right:4px;" />
          <input type="password" id="ta-vc" placeholder="Verify" style="min-width:120px;margin-right:8px;" />
          <button type="button" id="ta-cred-save" class="btn-primary">Update credentials</button>
          <div id="ta-cred-msg" style="margin-top:8px;font-size:12px;"></div>
        </div>

        <div class="detail-section">
          <h2>User lifecycle</h2>
          <button type="button" id="ta-deact" class="btn">Deactivate (set term date)</button>
          <button type="button" id="ta-react" class="btn" style="margin-left:8px;">Reactivate (clear term date)</button>
          <div id="ta-life-msg" style="margin-top:8px;font-size:12px;"></div>
        </div>
      </div>

      <aside class="context-rail">
        <div class="card">
          <div class="context-label">User</div>
          <div class="context-value">${escapeHtml(u.name)}</div>
          <div class="context-label">DUZ</div>
          <div class="context-value">${vg.duz ?? u.ien ?? '—'}</div>
          <div class="context-label">Status</div>
          <div class="context-value"><span class="badge ${userStatus === 'active' ? 'badge-active' : 'badge-inactive'}">${escapeHtml(userStatus)}</span></div>
          <div class="context-divider"></div>
          <div class="context-label">E-Sig</div>
          <div class="context-value"><span class="badge ${eSigBadgeClass}">${escapeHtml(eSig.status || 'unknown')}</span></div>
          <div class="context-label">Keys</div>
          <div class="context-value">${roles.length} assigned</div>
          <div class="context-divider"></div>
          <div class="context-label">Grounding</div>
          <div class="context-value"><span class="badge ${groundingStatus === 'grounded' || groundingStatus === 'vista-ien' ? 'badge-grounded' : 'badge-ungrounded'}">${escapeHtml(groundingStatus)}</span></div>
          <div class="context-label">Source</div>
          <div class="context-value">${sourceBadge(res.sourceStatus || res.source)}</div>
          <div class="context-divider"></div>
          <div class="context-label">VistA tools</div>
          <div style="font-size:12px;color:var(--color-text-muted);margin-top:4px;">
            <a href="#/vista-tools">DDR probe + write path status →</a>
          </div>
        </div>
      </aside>
    </div>`;

  const saveBtn = document.getElementById('ta-uf-save');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const field = document.getElementById('ta-uf-field').value;
      const value = document.getElementById('ta-uf-value').value;
      const msg = document.getElementById('ta-uf-msg');
      msg.textContent = 'Saving…';
      const out = await apiPut(`users/${encodeURIComponent(userId)}`, { field, value });
      if (out.ok) {
        msg.textContent = 'Saved. RPC: ' + (Array.isArray(out.rpcUsed) ? out.rpcUsed.join(', ') : out.rpcUsed || 'DDR FILER');
        msg.style.color = '#166534';
      } else {
        msg.textContent = out.error || JSON.stringify(out);
        msg.style.color = '#b91c1c';
      }
    });
  }

  const keyAdd = document.getElementById('ta-key-add');
  const keyDel = document.getElementById('ta-key-del');
  const keyMsg = document.getElementById('ta-key-msg');
  if (keyAdd && keyDel) {
    keyAdd.addEventListener('click', async () => {
      const keyName = (document.getElementById('ta-key-name') || {}).value || '';
      keyMsg.textContent = 'Saving…';
      const out = await apiPost(`users/${encodeURIComponent(userId)}/keys`, { keyName });
      if (out.ok) {
        keyMsg.textContent = 'Key assigned. ' + (out.rpcUsed || '');
        keyMsg.style.color = '#166534';
      } else {
        keyMsg.textContent = out.error || out.message || JSON.stringify(out);
        keyMsg.style.color = '#b91c1c';
      }
    });
    keyDel.addEventListener('click', async () => {
      const keyName = (document.getElementById('ta-key-name') || {}).value || '';
      if (!keyName.trim()) { keyMsg.textContent = 'Enter key name to remove'; keyMsg.style.color = '#b91c1c'; return; }
      if (!confirm('Remove security key "' + keyName.trim() + '" from this user? This revokes their access to features gated by this key.')) return;
      keyMsg.textContent = 'Removing…';
      const enc = encodeURIComponent(keyName.trim().replace(/\s/g, '+'));
      const out = await apiDelete(`users/${encodeURIComponent(userId)}/keys/${enc}`);
      if (out.ok) {
        keyMsg.textContent = 'Key removed.';
        keyMsg.style.color = '#166534';
      } else {
        keyMsg.textContent = out.error || JSON.stringify(out);
        keyMsg.style.color = '#b91c1c';
      }
    });
  }

  const esigBtn = document.getElementById('ta-esig-save');
  if (esigBtn) {
    esigBtn.addEventListener('click', async () => {
      const code = (document.getElementById('ta-esig-code') || {}).value || '';
      const msg = document.getElementById('ta-esig-msg');
      msg.textContent = 'Saving…';
      const out = await apiPost(`users/${encodeURIComponent(userId)}/esig`, { code });
      if (out.ok) {
        msg.textContent = 'E-sig updated.';
        msg.style.color = '#166534';
      } else {
        msg.textContent = out.error || JSON.stringify(out);
        msg.style.color = '#b91c1c';
      }
    });
  }

  const credBtn = document.getElementById('ta-cred-save');
  if (credBtn) {
    credBtn.addEventListener('click', async () => {
      const accessCode = (document.getElementById('ta-ac') || {}).value || '';
      const verifyCode = (document.getElementById('ta-vc') || {}).value || '';
      const msg = document.getElementById('ta-cred-msg');
      msg.textContent = 'Saving…';
      const out = await apiPut(`users/${encodeURIComponent(userId)}/credentials`, { accessCode, verifyCode });
      if (out.ok) {
        msg.textContent = 'Credentials updated (hashed in VistA).';
        msg.style.color = '#166534';
      } else {
        msg.textContent = out.error || JSON.stringify(out);
        msg.style.color = '#b91c1c';
      }
    });
  }

  const deact = document.getElementById('ta-deact');
  const react = document.getElementById('ta-react');
  const lifeMsg = document.getElementById('ta-life-msg');
  if (deact && react) {
    deact.addEventListener('click', async () => {
      if (!confirm('Deactivate this user? This sets a termination date in VistA File 200. The user will no longer be able to log in.')) return;
      lifeMsg.textContent = 'Deactivating…';
      const out = await apiPost(`users/${encodeURIComponent(userId)}/deactivate`, {});
      lifeMsg.textContent = out.ok ? 'Deactivated. User can no longer sign in.' : (out.error || JSON.stringify(out));
      lifeMsg.style.color = out.ok ? '#166534' : '#b91c1c';
    });
    react.addEventListener('click', async () => {
      if (!confirm('Reactivate this user? This clears the termination date in VistA File 200.')) return;
      lifeMsg.textContent = 'Reactivating…';
      const out = await apiPost(`users/${encodeURIComponent(userId)}/reactivate`, {});
      lifeMsg.textContent = out.ok ? 'Reactivated.' : (out.error || JSON.stringify(out));
      lifeMsg.style.color = out.ok ? '#166534' : '#b91c1c';
    });
  }
}

// ---------------------------------------------------------------------------
// Role Assignment
// ---------------------------------------------------------------------------
async function renderRoleAssignment(el) {
  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Security Keys (Roles)</div>
    <div class="page-header"><h1>Security Keys (Roles)</h1></div>
    <div class="loading-message">Loading security keys from VistA…</div>`;

  const res = await api('roles');
  if (!res.ok) { el.innerHTML = `<div class="error-message">Failed to load roles</div>`; return; }
  const roles = res.data;

  function renderRoleRows(list) {
    if (!list.length) return '<tr><td colspan="4" style="text-align:center;color:var(--color-text-muted)">No matching keys</td></tr>';
    return list.map(r => {
      const vg = r.vistaGrounding || {};
      return `
      <tr>
        <td><span class="badge badge-key">${escapeHtml(r.name)}</span></td>
        <td>${escapeHtml(r.description || '—')}</td>
        <td>${vg.file19_1Ien ? 'IEN ' + vg.file19_1Ien : '—'}</td>
        <td>${(r.assignedUsers || []).length ? r.assignedUsers.map(u => typeof u === 'object' ? '<a href="#/users/' + encodeURIComponent(u.id) + '">' + escapeHtml(u.name) + '</a>' : escapeHtml(u)).join(', ') : '<span style="color:var(--color-text-muted)">—</span>'}</td>
      </tr>`;
    }).join('');
  }

  const noteHtml = res.integrationNote
    ? `<div class="detail-section" style="margin-bottom:12px;padding:12px 16px;font-size:12px;border-left:4px solid var(--color-warning)">
         <strong>Integration Note:</strong> ${escapeHtml(res.integrationNote)}
       </div>`
    : '';

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Security Keys (Roles)</div>
    <div class="page-header">
      <h1>Security Keys (Roles)</h1>
      ${sourceBadge(res.sourceStatus || res.source)}
    </div>
    ${noteHtml}
    <div class="detail-section" style="margin-bottom:12px;padding:12px 16px;font-size:12px;border-left:4px solid var(--color-primary)">
      <strong>What are security keys?</strong> In VistA, security keys (File 19.1) control access to menu options, RPCs, and features.
      Keys are assigned to users in File 200 field 51 and checked via <code>^XUSEC(keyName,DUZ)</code>.
      Common keys: <code>PROVIDER</code>, <code>ORES</code> (order entry), <code>XUPROGMODE</code> (programmer mode).
    </div>
    <div class="filter-rail">
      <input type="text" id="role-search" placeholder="Search keys…" />
      <span class="result-count" id="role-count">Showing ${roles.length} of ${roles.length}</span>
    </div>
    <table class="data-table">
      <thead><tr>
        <th>Key Name</th><th>Description</th><th>File 19.1</th><th>Assigned Users</th>
      </tr></thead>
      <tbody id="role-tbody">${renderRoleRows(roles)}</tbody>
    </table>`;

  const searchInput = document.getElementById('role-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const q = (searchInput.value || '').toLowerCase();
      const filtered = roles.filter(r => r.name.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q));
      document.getElementById('role-tbody').innerHTML = renderRoleRows(filtered);
      document.getElementById('role-count').textContent = `Showing ${filtered.length} of ${roles.length}`;
    });
  }
}

// ---------------------------------------------------------------------------
// Facility List
// ---------------------------------------------------------------------------
async function renderFacilityList(el) {
  el.innerHTML = `
    <div class="page-header">
      <h1>Facility List</h1>
      <span class="source-posture fixture">Loading…</span>
    </div>
    <div class="loading-message">Loading facilities…</div>`;

  const res = await api('facilities');
  if (!res.ok) { el.innerHTML = `<div class="error-message">Failed to load facilities</div>`; return; }
  const facilities = res.data;

  // Flatten for counting
  function countAll(items) {
    let n = 0;
    for (const f of items) { n++; if (f.children) n += countAll(f.children); }
    return n;
  }
  const totalCount = countAll(facilities);

  function renderTree(items, indent) {
    return items.map(f => {
      const indentClass = indent > 0 ? ` tree-indent-${Math.min(indent, 2)}` : '';
      const childHtml = f.children && f.children.length ? renderTree(f.children, indent + 1) : '';
      const fId = f.id || f.ien || 'unknown';
      const fType = f.type || (f.ien ? 'Clinic' : '—');
      const fStatus = f.status || 'active';
      return `
        <li class="${indentClass}">
          <a href="#/facilities/${encodeURIComponent(fId)}">${escapeHtml(f.name)}</a>
          <span class="tree-type">${escapeHtml(fType)}</span>
          <span class="badge ${fStatus === 'active' ? 'badge-active' : 'badge-inactive'}" style="margin-left:4px">${escapeHtml(fStatus)}</span>
        </li>
        ${childHtml}`;
    }).join('');
  }

  const vistaNote = res.vistaNote
    ? `<span class="vista-note">${escapeHtml(res.vistaNote)}</span>`
    : '';

  el.innerHTML = `
    <div class="page-header">
      <h1>Facility List</h1>
      ${sourceBadge(res.sourceStatus || res.source)}${vistaNote}
    </div>
    <div class="filter-rail">
      <input type="text" id="fac-search" placeholder="Search facilities…" />
      <select id="fac-type-filter">
        <option value="">All types</option>
        <option value="Institution">Institution</option>
        <option value="Division">Division</option>
        <option value="Clinic">Clinic</option>
      </select>
      <span class="result-count">${totalCount} facilities</span>
    </div>
    <div class="detail-section">
      <h2>Facility Hierarchy</h2>
      <ul class="facility-tree" id="fac-tree">
        ${renderTree(facilities, 0)}
      </ul>
    </div>`;

  // Wire facility filter controls
  const searchInput = el.querySelector('#fac-search');
  const typeFilter = el.querySelector('#fac-type-filter');
  const countSpan = el.querySelector('.result-count');
  const treeEl = el.querySelector('#fac-tree');

  function applyFilters() {
    const q = (searchInput.value || '').toLowerCase();
    const t = typeFilter.value;
    const items = treeEl.querySelectorAll('li');
    let visible = 0;
    items.forEach(li => {
      const name = (li.querySelector('a') || {}).textContent || '';
      const type = (li.querySelector('.tree-type') || {}).textContent || '';
      const matchName = !q || name.toLowerCase().includes(q);
      const matchType = !t || type === t;
      li.style.display = (matchName && matchType) ? '' : 'none';
      if (matchName && matchType) visible++;
    });
    countSpan.textContent = visible + ' facilities';
  }

  if (searchInput) searchInput.addEventListener('input', applyFilters);
  if (typeFilter) typeFilter.addEventListener('change', applyFilters);
}

// ---------------------------------------------------------------------------
// Facility Detail
// ---------------------------------------------------------------------------
async function renderFacilityDetail(el, facId) {
  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/facilities">Facility List</a> › Detail</div>
    <div class="loading-message">Loading facility…</div>`;

  // Try the detail endpoint first (VistA-first on the server side)
  const detailRes = await api(`facilities/${encodeURIComponent(facId)}`);
  let res, f;
  if (detailRes.ok) {
    res = detailRes;
    f = detailRes.data;
  } else {
    // Fallback: fetch full list and search client-side (for deeply nested fixture facilities)
    res = await api('facilities');
    if (!res.ok) { el.innerHTML = `<div class="error-message">Failed to load facilities</div>`; return; }

    function findFacility(items, id) {
      for (const item of items) {
        if (item.id === id) return item;
        if (item.children) {
          const found = findFacility(item.children, id);
          if (found) return found;
        }
      }
      return null;
    }

    f = findFacility(res.data, facId);
  }
  if (!f) { el.innerHTML = `<div class="error-message">Facility not found</div>`; return; }

  const groundingRows = Object.entries(f.vistaGrounding || {}).map(([k, v]) => {
    if (typeof v === 'object') return '';
    return `<div class="detail-row"><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(String(v))}</dd></div>`;
  }).join('');

  // File-specific fields (from enriched fixture)
  const fileFields = f.file4Fields || f.file40_8Fields || f.file44Fields || null;
  const fileFieldsHtml = fileFields
    ? `<div class="detail-section">
         <h2>VistA File Fields</h2>
         <dl>${Object.entries(fileFields).map(([k, v]) =>
           `<div class="detail-row"><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(typeof v === 'object' ? JSON.stringify(v) : String(v))}</dd></div>`
         ).join('')}</dl>
       </div>`
    : '';

  // Extra identity rows for enriched data
  const extraIdentity = [];
  if (f.stationNumber) extraIdentity.push(`<div class="detail-row"><dt>Station Number</dt><dd>${escapeHtml(f.stationNumber)}</dd></div>`);
  if (f.facilityType) extraIdentity.push(`<div class="detail-row"><dt>Facility Type</dt><dd>${escapeHtml(f.facilityType)}</dd></div>`);
  if (f.facilityNumber) extraIdentity.push(`<div class="detail-row"><dt>Facility Number</dt><dd>${escapeHtml(f.facilityNumber)}</dd></div>`);
  if (f.abbreviation) extraIdentity.push(`<div class="detail-row"><dt>Abbreviation</dt><dd>${escapeHtml(f.abbreviation)}</dd></div>`);
  if (f.locationType) extraIdentity.push(`<div class="detail-row"><dt>Location Type</dt><dd>${escapeHtml(f.locationType)}</dd></div>`);
  if (f.stopCode) extraIdentity.push(`<div class="detail-row"><dt>Stop Code</dt><dd>${escapeHtml(f.stopCode.ien + ' — ' + f.stopCode.name)}</dd></div>`);
  if (f.defaultSlotLength) extraIdentity.push(`<div class="detail-row"><dt>Slot Length</dt><dd>${f.defaultSlotLength} min</dd></div>`);
  if (f.global) extraIdentity.push(`<div class="detail-row"><dt>Global</dt><dd style="font-family:monospace;font-size:12px">${escapeHtml(f.global)}</dd></div>`);

  const childrenHtml = f.children && f.children.length
    ? `<div class="detail-section">
         <h2>Children</h2>
         <ul class="facility-tree">
           ${f.children.map(c => `<li><a href="#/facilities/${encodeURIComponent(c.id)}">${escapeHtml(c.name)}</a> <span class="tree-type">${escapeHtml(c.type)}</span></li>`).join('')}
         </ul>
       </div>`
    : '';

  // Ward children (for institution-level)
  const wardsHtml = f.wards && f.wards.length
    ? `<div class="detail-section">
         <h2>Wards</h2>
         <table>
           <thead><tr><th>Ward</th><th>Specialty</th><th>Beds</th></tr></thead>
           <tbody>${f.wards.map(w => `<tr><td>${escapeHtml(w.name)}</td><td>${escapeHtml(w.specialty || '—')}</td><td>${(w.beds || []).length}</td></tr>`).join('')}</tbody>
         </table>
         <div style="margin-top:4px"><a href="#/wards">View full ward list →</a></div>
       </div>`
    : '';

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/facilities">Facility List</a> › ${escapeHtml(f.name)}</div>
    <div class="page-header">
      <h1>${escapeHtml(f.name)}</h1>
      <span class="badge ${f.status === 'active' ? 'badge-active' : 'badge-inactive'}">${escapeHtml(f.status)}</span>
      ${sourceBadge(res.sourceStatus || res.source)}
    </div>

    <div class="detail-layout">
      <div class="detail-main">
        <div class="detail-section">
          <h2>Identity</h2>
          <dl>
            <div class="detail-row"><dt>Type</dt><dd>${escapeHtml(f.type)}</dd></div>
            <div class="detail-row"><dt>Status</dt><dd>${escapeHtml(f.status)}</dd></div>
            ${extraIdentity.join('')}
          </dl>
        </div>

        <div class="detail-section">
          <h2>VistA Grounding</h2>
          <dl>${groundingRows}</dl>
        </div>

        ${fileFieldsHtml}
        ${childrenHtml}
        ${wardsHtml}
      </div>

      <aside class="context-rail">
        <div class="card">
          <div class="context-label">Facility</div>
          <div class="context-value">${escapeHtml(f.name)}</div>
          <div class="context-label">Type</div>
          <div class="context-value">${escapeHtml(f.type)}</div>
          <div class="context-label">Status</div>
          <div class="context-value"><span class="badge ${f.status === 'active' ? 'badge-active' : 'badge-inactive'}">${escapeHtml(f.status)}</span></div>
          <div class="context-divider"></div>
          <div class="context-label">Source</div>
          <div class="context-value">${sourceBadge(res.sourceStatus || res.source)}</div>
          <div class="context-label">VistA Grounding</div>
          <div class="context-value"><span class="badge ${(f.vistaGrounding || {}).status === 'grounded' ? 'badge-grounded' : 'badge-ungrounded'}">${escapeHtml((f.vistaGrounding || {}).status || 'unknown')}</span></div>
          <div class="context-divider"></div>
          <div class="context-label">Actions</div>
          <div style="font-size:12px;color:var(--color-text-muted);margin-top:4px;">Read-only in first slice</div>
        </div>
      </aside>
    </div>`;
}

// ---------------------------------------------------------------------------
// Clinic List
// ---------------------------------------------------------------------------
async function renderClinicList(el) {
  el.innerHTML = `
    <div class="page-header">
      <h1>Clinic List</h1>
      <span class="source-posture fixture">Loading…</span>
    </div>
    <div class="loading-message">Loading clinics…</div>`;

  const res = await api('clinics');
  if (!res.ok) { el.innerHTML = `<div class="error-message">Failed to load clinics</div>`; return; }
  const clinics = res.data || [];
  const summary = res.summary || {};
  const grounding = res.vistaGrounding || {};

  function clinicRows(list) {
    if (!list.length) return '<tr><td colspan="6" style="text-align:center;color:var(--color-text-muted)">No clinics found</td></tr>';
    return list.map(c => `
      <tr>
        <td>${escapeHtml(c.name)}</td>
        <td>${escapeHtml(c.abbreviation || '—')}</td>
        <td>${c.stopCode ? escapeHtml(c.stopCode.ien + ' — ' + c.stopCode.name) : '—'}</td>
        <td>${c.defaultSlotLength ? c.defaultSlotLength + ' min' : '—'}</td>
        <td><span class="badge ${c.status === 'active' ? 'badge-active' : 'badge-inactive'}">${escapeHtml(c.status || 'active')}</span></td>
        <td style="font-size:11px;color:var(--color-text-muted)">File 44 ^SC(${escapeHtml(String(c.file44Ien || c.ien || '?'))},</td>
      </tr>`).join('');
  }

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Clinic List</div>
    <div class="page-header">
      <h1>Clinic List</h1>
      ${sourceBadge(res.sourceStatus || res.source)}
    </div>
    <div class="card-grid" style="margin-bottom:1rem;">
      <div class="card"><div class="card-label">Total Clinics</div><div class="card-value">${summary.totalClinics ?? clinics.length}</div></div>
      <div class="card"><div class="card-label">With Stop Code</div><div class="card-value">${summary.withStopCode ?? '—'}</div></div>
      <div class="card"><div class="card-label">Avg Slot Length</div><div class="card-value">${summary.avgSlotLength ? summary.avgSlotLength + ' min' : '—'}</div></div>
    </div>
    <div class="filter-rail">
      <input type="text" id="clinic-search" placeholder="Search clinics…" />
      <span class="result-count" id="clinic-count">Showing ${clinics.length} of ${clinics.length}</span>
    </div>
    <div class="detail-section">
      <table>
        <thead><tr><th>Clinic Name</th><th>Abbreviation</th><th>Stop Code</th><th>Slot Length</th><th>Status</th><th>VistA Reference</th></tr></thead>
        <tbody id="clinic-tbody">${clinicRows(clinics)}</tbody>
      </table>
    </div>
    <div class="detail-section" style="margin-top:16px;">
      <h2>Add Clinic</h2>
      <p style="font-size:12px;color:var(--color-text-muted);margin-bottom:8px;">Creates a new clinic location in File 44 via <code>ZVE CLNM ADD</code> RPC.</p>
      <div style="display:flex;gap:8px;align-items:flex-end;">
        <label>Clinic Name<br/><input type="text" id="clinic-add-name" placeholder="e.g. CARDIOLOGY" style="min-width:220px;" /></label>
        <button type="button" class="btn-primary" id="clinic-add-btn">Add Clinic</button>
      </div>
      <div id="clinic-add-msg" style="margin-top:8px;font-size:12px;"></div>
    </div>
    <div class="detail-section">
      <h2>VistA Grounding</h2>
      <dl>
        <div class="detail-row"><dt>Read RPC</dt><dd>${escapeHtml(grounding.readRpc || 'ORWU CLINLOC')}</dd></div>
        <div class="detail-row"><dt>Primary File</dt><dd>${escapeHtml(grounding.file || 'File 44 (Hospital Location)')}</dd></div>
        <div class="detail-row"><dt>Global</dt><dd>^SC(</dd></div>
        <div class="detail-row"><dt>Type Index</dt><dd>${escapeHtml(grounding.typeIndex || '"C" index in ^SC("TYPE","C",')}</dd></div>
      </dl>
    </div>`;

  const clinicSearch = document.getElementById('clinic-search');
  if (clinicSearch) {
    clinicSearch.addEventListener('input', () => {
      const q = (clinicSearch.value || '').toLowerCase();
      const filtered = clinics.filter(c => c.name.toLowerCase().includes(q));
      document.getElementById('clinic-tbody').innerHTML = clinicRows(filtered);
      document.getElementById('clinic-count').textContent = `Showing ${filtered.length} of ${clinics.length}`;
    });
  }

  const clinicAddBtn = document.getElementById('clinic-add-btn');
  if (clinicAddBtn) {
    clinicAddBtn.addEventListener('click', async () => {
      const name = (document.getElementById('clinic-add-name') || {}).value || '';
      const msg = document.getElementById('clinic-add-msg');
      if (!name.trim()) { msg.textContent = 'Clinic name is required.'; msg.style.color = '#b91c1c'; return; }
      msg.textContent = 'Creating clinic in VistA…';
      msg.style.color = '';
      const out = await apiPost('clinics', { name: name.trim() });
      if (out.ok) {
        msg.textContent = 'Clinic created. Refreshing list…';
        msg.style.color = '#166534';
        setTimeout(() => renderClinicList(el), 1000);
      } else {
        msg.textContent = out.error || JSON.stringify(out);
        msg.style.color = '#b91c1c';
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Ward List
// ---------------------------------------------------------------------------
async function renderWardList(el) {
  el.innerHTML = `
    <div class="page-header">
      <h1>Ward List</h1>
      <span class="source-posture fixture">Loading…</span>
    </div>
    <div class="loading-message">Loading wards…</div>`;

  const res = await api('wards');
  if (!res.ok) { el.innerHTML = `<div class="error-message">Failed to load wards</div>`; return; }
  const wards = res.data || [];
  const summary = res.summary || {};
  const grounding = res.vistaGrounding || {};

  function wardRows(list) {
    if (!list.length) return '<tr><td colspan="6" style="text-align:center;color:var(--color-text-muted)">No wards found</td></tr>';
    return list.map(w => {
      const beds = w.beds || [];
      const avail = beds.filter(b => b.status === 'available').length;
      const occ = beds.filter(b => b.status === 'occupied').length;
      return `
      <tr>
        <td>${escapeHtml(w.name)}</td>
        <td>${escapeHtml(w.specialty || '—')}</td>
        <td>${w.bedCount ?? beds.length}</td>
        <td>${w.availableBeds ?? avail}</td>
        <td>${w.occupiedBeds ?? occ}</td>
        <td style="font-size:11px;color:var(--color-text-muted)">File 42 ^DIC(42,${escapeHtml(String(w.file42Ien || w.ien || '?'))},</td>
      </tr>`;
    }).join('');
  }

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Ward List</div>
    <div class="page-header">
      <h1>Ward List</h1>
      ${sourceBadge(res.sourceStatus || res.source)}
    </div>
    <div class="card-grid" style="margin-bottom:1rem;">
      <div class="card"><div class="card-label">Total Wards</div><div class="card-value">${summary.totalWards ?? wards.length}</div></div>
      <div class="card"><div class="card-label">Total Beds</div><div class="card-value">${summary.totalBeds ?? '—'}</div></div>
      <div class="card"><div class="card-label">Available</div><div class="card-value">${summary.availableBeds ?? '—'}</div></div>
      <div class="card"><div class="card-label">Occupied</div><div class="card-value">${summary.occupiedBeds ?? '—'}</div></div>
    </div>
    <div class="detail-section">
      <table>
        <thead><tr><th>Ward Name</th><th>Specialty</th><th>Beds</th><th>Available</th><th>Occupied</th><th>VistA Reference</th></tr></thead>
        <tbody id="ward-tbody">${wardRows(wards)}</tbody>
      </table>
    </div>
    <div class="filter-rail">
      <input type="text" id="ward-search" placeholder="Search wards…" />
      <span class="result-count" id="ward-count">Showing ${wards.length} of ${wards.length}</span>
    </div>
    <div class="detail-section">
      <h2>VistA Grounding</h2>
      <dl>
        <div class="detail-row"><dt>Read RPC</dt><dd>${escapeHtml(grounding.readRpc || 'ORQPT WARDS')}</dd></div>
        <div class="detail-row"><dt>Ward File</dt><dd>${escapeHtml(grounding.file || 'File 42 (Ward Location)')}</dd></div>
        <div class="detail-row"><dt>Global</dt><dd>^DIC(42,</dd></div>
        <div class="detail-row"><dt>Bed File</dt><dd>${escapeHtml(grounding.bedFile || 'File 405.4 (Room-Bed)')}</dd></div>
      </dl>
    </div>`;

  const wardSearch = document.getElementById('ward-search');
  if (wardSearch) {
    wardSearch.addEventListener('input', () => {
      const q = (wardSearch.value || '').toLowerCase();
      const filtered = wards.filter(w => w.name.toLowerCase().includes(q) || (w.specialty || '').toLowerCase().includes(q));
      document.getElementById('ward-tbody').innerHTML = wardRows(filtered);
      document.getElementById('ward-count').textContent = `Showing ${filtered.length} of ${wards.length}`;
    });
  }
}

// ---------------------------------------------------------------------------
// Key Inventory
// ---------------------------------------------------------------------------
async function renderKeyInventory(el) {
  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Key Inventory</div>
    <div class="page-header"><h1>Key Inventory</h1></div>
    <div class="loading-message">Loading key inventory from VistA…</div>`;

  const res = await api('key-inventory');
  if (!res.ok) { el.innerHTML = `<div class="error-message">Failed to load key inventory</div>`; return; }
  const keys = res.data;
  const summary = res.summary;

  function renderKeyRows(list) {
    if (!list.length) return '<tr><td colspan="4" style="text-align:center;color:var(--color-text-muted)">No matching keys</td></tr>';
    return list.map(k => {
      const grounding = k.vistaGrounding || {};
      return `
        <tr>
          <td><span class="badge badge-key">${escapeHtml(k.keyName)}</span></td>
          <td>${escapeHtml(k.description || '—')}</td>
          <td style="font-weight:600">${k.holderCount}</td>
          <td>${grounding.file19_1Ien ? 'IEN ' + grounding.file19_1Ien : '—'}</td>
        </tr>`;
    }).join('');
  }

  const noteHtml = res.integrationNote
    ? `<div class="detail-section" style="margin-bottom:12px;padding:12px 16px;font-size:12px;border-left:4px solid var(--color-warning)">
         <strong>Integration Note:</strong> ${escapeHtml(res.integrationNote)}
       </div>`
    : '';

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Key Inventory</div>
    <div class="page-header">
      <h1>Key Inventory</h1>
      ${sourceBadge(res.sourceStatus || res.source)}
    </div>
    <div class="card-grid" style="margin-bottom:20px">
      <div class="card">
        <div class="card-label">Total Keys</div>
        <div class="card-value">${summary.totalKeys}</div>
      </div>
      <div class="card">
        <div class="card-label">With Holders</div>
        <div class="card-value">${summary.totalKeys - (summary.unassignedKeys || 0)}</div>
      </div>
      <div class="card">
        <div class="card-label">Unassigned</div>
        <div class="card-value" style="${(summary.unassignedKeys || 0) > 0 ? 'color:var(--color-warning)' : ''}">${summary.unassignedKeys || 0}</div>
      </div>
    </div>
    ${noteHtml}
    <div class="filter-rail">
      <input type="text" id="key-search" placeholder="Search keys…" />
      <span class="result-count" id="key-count">Showing ${keys.length} of ${keys.length}</span>
    </div>
    <table class="data-table">
      <thead><tr>
        <th>Key Name</th><th>Description</th><th>Holders</th><th>File 19.1</th>
      </tr></thead>
      <tbody id="key-tbody">${renderKeyRows(keys)}</tbody>
    </table>`;

  const searchInput = document.getElementById('key-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const q = (searchInput.value || '').toLowerCase();
      const filtered = keys.filter(k => k.keyName.toLowerCase().includes(q) || (k.description || '').toLowerCase().includes(q));
      document.getElementById('key-tbody').innerHTML = renderKeyRows(filtered);
      document.getElementById('key-count').textContent = `Showing ${filtered.length} of ${keys.length}`;
    });
  }
}

// ---------------------------------------------------------------------------
// E-Signature Status
// ---------------------------------------------------------------------------
async function renderEsigStatus(el) {
  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Electronic Signature Status</div>
    <div class="page-header"><h1>Electronic Signature Status</h1></div>
    <div class="loading-message">Loading e-sig status from VistA…</div>`;

  const res = await api('esig-status');
  if (!res.ok) { el.innerHTML = `<div class="error-message">Failed to load e-sig status</div>`; return; }
  const users = res.data;
  const agg = res.aggregates;
  const grounding = res.vistaGrounding || {};

  function renderEsigRows(list) {
    if (!list.length) return '<tr><td colspan="6" style="text-align:center;color:var(--color-text-muted)">No matching users</td></tr>';
    return list.map(u => {
      const statusBadge = u.esigStatus === 'active' ? 'badge-active'
        : u.esigStatus === 'revoked' ? 'badge-inactive' : 'badge-ungrounded';
      return `
        <tr>
          <td><a href="#/users/${encodeURIComponent(u.id)}">${escapeHtml(u.name)}</a></td>
          <td>${u.duz ?? '—'}</td>
          <td><span class="badge ${u.status === 'active' ? 'badge-active' : 'badge-inactive'}">${escapeHtml(u.status)}</span></td>
          <td><span class="badge ${statusBadge}">${escapeHtml(u.esigStatus)}</span></td>
          <td>${u.hasCode ? 'Yes' : 'No'}</td>
          <td>${escapeHtml(u.sigBlockName || '—')}</td>
        </tr>`;
    }).join('');
  }

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Electronic Signature Status</div>
    <div class="page-header">
      <h1>Electronic Signature Status</h1>
      ${sourceBadge(res.sourceStatus || res.source)}
    </div>
    <div class="detail-section" style="margin-bottom:16px;padding:16px;font-size:13px;border-left:4px solid var(--color-primary);background:#f0fdf4;">
      <strong>What is a VistA Electronic Signature?</strong><br/>
      In VistA, an electronic signature is a <strong>typed text code</strong> (like a secondary password),
      <em>not</em> a handwritten or graphical signature. It is NOT captured via touchscreen, signature pad, or image upload.<br/><br/>
      <strong>How it works:</strong><br/>
      <ol style="margin:8px 0 0 20px;padding:0;">
        <li>An administrator or the user themselves sets an e-signature code (a secret phrase).</li>
        <li>VistA hashes the code using <code>$$EN^XUSHSH</code> and stores the hash in File 200, field 20.4. The original code is never stored.</li>
        <li>When a clinician signs a note, order, or other clinical document, they type their e-signature code.</li>
        <li>VistA hashes the typed code and compares it to the stored hash. If they match, the document is signed.</li>
      </ol><br/>
      <strong>Signature block fields</strong> (also set during e-sig setup):<br/>
      <ul style="margin:4px 0 0 20px;padding:0;">
        <li><strong>Initials</strong> — displayed in chart headers (File 200 field 20.2)</li>
        <li><strong>Signature Block Printed Name</strong> — appears on signed documents (File 200 field 20.3)</li>
        <li><strong>Signature Block Title</strong> — e.g. "MD", "RN", "PharmD" (File 200 field 20.3 piece 2)</li>
      </ul>
    </div>
    <div class="card-grid" style="margin-bottom:20px">
      <div class="card">
        <div class="card-label">Total Users</div>
        <div class="card-value">${agg.total}</div>
      </div>
      <div class="card">
        <div class="card-label">E-Sig Active</div>
        <div class="card-value" style="color:var(--color-success)">${agg.active}</div>
      </div>
      <div class="card">
        <div class="card-label">Not Configured</div>
        <div class="card-value" style="${agg.notConfigured > 0 ? 'color:var(--color-warning)' : ''}">${agg.notConfigured}</div>
      </div>
      <div class="card">
        <div class="card-label">Revoked</div>
        <div class="card-value" style="${agg.revoked > 0 ? 'color:var(--color-error)' : ''}">${agg.revoked}</div>
      </div>
    </div>
    <div class="filter-rail">
      <input type="text" id="esig-search" placeholder="Search users…" />
      <select id="esig-filter">
        <option value="">All statuses</option>
        <option value="active">Active (code set)</option>
        <option value="not-configured">Not configured</option>
      </select>
      <span class="result-count" id="esig-count">Showing ${users.length} of ${users.length}</span>
    </div>
    <table class="data-table">
      <thead><tr>
        <th>Name</th><th>DUZ</th><th>User Status</th><th>E-Sig Status</th><th>Has Code</th><th>Sig Block Name</th>
      </tr></thead>
      <tbody id="esig-tbody">${renderEsigRows(users)}</tbody>
    </table>`;

  const esigSearch = document.getElementById('esig-search');
  const esigFilter = document.getElementById('esig-filter');
  function applyEsigFilters() {
    const q = (esigSearch.value || '').toLowerCase();
    const sf = esigFilter.value;
    const filtered = users.filter(u => {
      if (q && !u.name.toLowerCase().includes(q) && !(u.duz || '').toString().includes(q)) return false;
      if (sf && u.esigStatus !== sf) return false;
      return true;
    });
    document.getElementById('esig-tbody').innerHTML = renderEsigRows(filtered);
    document.getElementById('esig-count').textContent = `Showing ${filtered.length} of ${users.length}`;
  }
  if (esigSearch) esigSearch.addEventListener('input', applyEsigFilters);
  if (esigFilter) esigFilter.addEventListener('change', applyEsigFilters);
}

// ---------------------------------------------------------------------------
// VistA tools (DDR probe -- direct RPC, no terminal write path)
// ---------------------------------------------------------------------------
async function renderVistaTools(el) {
  el.innerHTML = `
    <div class="page-header">
      <h1>VistA tools</h1>
      <span class="source-posture vista">RPC</span>
    </div>
    <p class="detail-section" style="padding:12px 16px;font-size:13px;">
      All configuration writes go through <strong>DDR VALIDATOR / DDR FILER</strong> or distro overlay RPCs (e.g. <code>ZVEUSMG</code>).
      Optional <em>legacy terminal</em> is a separate product surface, not a required step for admin work.
    </p>
    <div class="loading-message" id="ddr-probe-loading">Running DDR probe…</div>
    <pre id="ddr-probe-out" style="display:none;font-size:11px;overflow:auto;max-height:480px;background:#0f172a;color:#e2e8f0;padding:12px;border-radius:6px;"></pre>`;

  const out = document.getElementById('ddr-probe-out');
  const loading = document.getElementById('ddr-probe-loading');
  try {
    const res = await api('vista/ddr-probe');
    loading.style.display = 'none';
    out.style.display = 'block';
    out.textContent = JSON.stringify(res, null, 2);
  } catch (e) {
    loading.textContent = 'Probe failed: ' + e.message;
  }
}

// ---------------------------------------------------------------------------
// Devices (DDR LISTER 3.5)
// ---------------------------------------------------------------------------
async function renderDeviceList(el) {
  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Devices</div>
    <div class="page-header"><h1>Devices</h1><span class="source-posture vista">Loading…</span></div>
    <div class="loading-message">Loading devices from VistA…</div>`;
  const res = await api('devices');
  const badge = sourceBadge(res.sourceStatus || res.source);
  if (!res.ok) {
    el.innerHTML = `<div class="page-header"><h1>Devices</h1></div><div class="error-message">${escapeHtml(res.error || 'failed')}</div>`;
    return;
  }
  const devices = res.data || [];

  function renderDeviceRows(list) {
    if (!list.length) return '<tr><td colspan="4" style="text-align:center;color:var(--color-text-muted)">No devices found</td></tr>';
    return list.map(d => `
      <tr>
        <td>${escapeHtml(d.ien || '')}</td>
        <td>${escapeHtml(d.name || '')}</td>
        <td>${escapeHtml(d.type || '—')}</td>
        <td>${escapeHtml(d.subtype || '—')}</td>
      </tr>`).join('');
  }

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Devices</div>
    <div class="page-header"><h1>Devices (File 3.5)</h1>${badge}</div>
    <div class="detail-section" style="margin-bottom:12px;padding:12px 16px;font-size:12px;border-left:4px solid var(--color-primary)">
      <strong>What are VistA devices?</strong> File 3.5 stores terminal, printer, and resource device definitions.
      Devices control how VistA sends output — to screens, printers, file queues, or specialized equipment.
      Common types: <code>TRM</code> (terminal), <code>P-OTHER</code> (printer), <code>RES</code> (resource), <code>HFS</code> (host file server).
    </div>
    <div class="card-grid" style="margin-bottom:12px;">
      <div class="card"><div class="card-label">Total Devices</div><div class="card-value">${devices.length}</div></div>
    </div>
    <div class="filter-rail">
      <input type="text" id="dev-search" placeholder="Search devices…" />
      <span class="result-count" id="dev-count">Showing ${devices.length} of ${devices.length}</span>
    </div>
    <table class="data-table"><thead><tr><th>IEN</th><th>Name</th><th>Type</th><th>Subtype</th></tr></thead>
    <tbody id="dev-tbody">${renderDeviceRows(devices)}</tbody></table>
    <div class="detail-section" style="margin-top:16px;">
      <h2>Add Device</h2>
      <p style="font-size:12px;color:var(--color-text-muted);margin-bottom:8px;">Creates a new entry in File 3.5 via <code>DDR FILER</code>.</p>
      <div style="display:flex;gap:8px;align-items:flex-end;">
        <label>Device Name<br/><input type="text" id="dev-add-name" placeholder="e.g. LASER-PRINTER-1" style="min-width:220px;" /></label>
        <button type="button" class="btn-primary" id="dev-add-btn">Add Device</button>
      </div>
      <div id="dev-add-msg" style="margin-top:8px;font-size:12px;"></div>
    </div>`;

  const devSearch = document.getElementById('dev-search');
  if (devSearch) {
    devSearch.addEventListener('input', () => {
      const q = (devSearch.value || '').toLowerCase();
      const filtered = devices.filter(d => (d.name || '').toLowerCase().includes(q) || (d.type || '').toLowerCase().includes(q));
      document.getElementById('dev-tbody').innerHTML = renderDeviceRows(filtered);
      document.getElementById('dev-count').textContent = `Showing ${filtered.length} of ${devices.length}`;
    });
  }

  const addBtn = document.getElementById('dev-add-btn');
  if (addBtn) {
    addBtn.addEventListener('click', async () => {
      const name = (document.getElementById('dev-add-name') || {}).value || '';
      const msg = document.getElementById('dev-add-msg');
      if (!name.trim()) { msg.textContent = 'Device name is required.'; msg.style.color = '#b91c1c'; return; }
      msg.textContent = 'Creating device in VistA…';
      msg.style.color = '';
      const out = await apiPost('devices', { name: name.trim() });
      if (out.ok) {
        msg.textContent = 'Device created. Refreshing list…';
        msg.style.color = '#166534';
        setTimeout(() => renderDeviceList(el), 1000);
      } else {
        msg.textContent = out.error || JSON.stringify(out);
        msg.style.color = '#b91c1c';
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Kernel parameters (DDR GETS 8989.3)
// ---------------------------------------------------------------------------
async function renderParamsKernel(el) {
  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Kernel Site Parameters</div>
    <div class="page-header"><h1>Kernel Site Parameters</h1><span class="source-posture vista">Loading…</span></div>
    <div class="loading-message">Loading kernel parameters from VistA…</div>`;
  const res = await api('params/kernel');
  const badge = sourceBadge(res.sourceStatus || res.source);
  if (!res.ok) {
    el.innerHTML = `<div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Kernel Site Parameters</div>
    <div class="page-header"><h1>Kernel Site Parameters</h1></div>
    <div class="error-message">${escapeHtml(res.error || 'Failed to load kernel parameters')}</div>
    <div class="detail-section" style="margin-top:12px;padding:12px 16px;font-size:12px;border-left:4px solid var(--color-warning)">
      <strong>Note:</strong> File 8989.3 (KERNEL SYSTEM PARAMETERS) may not have IEN 1 populated in this VistA instance.
      This file controls site-level settings like site name, domain, default institution, and default language.
    </div>`;
    return;
  }

  const lines = res.rawLines || [];
  const fieldMap = {};
  const LABELS = {
    '.01': 'SITE NAME',
    '.02': 'DOMAIN NAME',
    '.03': 'DEFAULT INSTITUTION',
    '.04': 'DEFAULT AUTO MENU',
    '.05': 'DEFAULT LANGUAGE',
  };
  for (const line of lines) {
    if (line.includes('^') && !line.startsWith('[')) {
      const parts = line.split('^');
      if (parts.length >= 2) {
        const fieldRef = parts[0]?.trim();
        const value = parts.slice(1).join('^').trim();
        if (fieldRef) fieldMap[fieldRef] = value;
      }
    }
  }

  const hasData = Object.keys(fieldMap).length > 0 && !lines.some(l => l.includes('[ERROR]'));

  const fieldRows = hasData
    ? Object.entries(fieldMap).map(([k, v]) => {
        const label = LABELS[k] || k;
        return `<div class="detail-row"><dt>${escapeHtml(label)} <code style="font-size:10px;color:var(--color-text-muted)">${escapeHtml(k)}</code></dt><dd>${escapeHtml(v || '(empty)')}</dd></div>`;
      }).join('')
    : '<div class="detail-row"><dt>Status</dt><dd style="color:var(--color-warning)">No field data returned from File 8989.3 IEN 1. The file may not be populated in this VistA instance.</dd></div>';

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › Kernel Site Parameters</div>
    <div class="page-header"><h1>Kernel Site Parameters</h1>${badge}</div>
    <div class="detail-section" style="margin-bottom:12px;padding:12px 16px;font-size:12px;border-left:4px solid var(--color-primary)">
      <strong>What is this?</strong> File 8989.3 (KERNEL SYSTEM PARAMETERS) stores site-level configuration:
      the site name, network domain, default institution, auto-menu settings, and default language.
      These are foundational settings that affect every user on the system.
    </div>
    <div class="detail-section">
      <h2>Current Values</h2>
      <dl>${fieldRows}</dl>
    </div>
    <div class="detail-section" style="margin-top:12px;">
      <h2>Edit Field</h2>
      <p style="font-size:12px;color:var(--color-text-muted);margin-bottom:8px;">Saves via <code>DDR VALIDATOR</code> + <code>DDR FILER</code> to File 8989.3 IEN 1.</p>
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;">
        <label>Field<br/><select id="ta-kf" style="min-width:200px;">
          <option value=".01">.01 — SITE NAME</option>
          <option value=".02">.02 — DOMAIN NAME</option>
          <option value=".03">.03 — DEFAULT INSTITUTION</option>
          <option value=".04">.04 — DEFAULT AUTO MENU</option>
          <option value=".05">.05 — DEFAULT LANGUAGE</option>
        </select></label>
        <label>Value<br/><input type="text" id="ta-kv" placeholder="New value" style="min-width:200px;" /></label>
        <button type="button" class="btn-primary" id="ta-ksave">Save to VistA</button>
      </div>
      <div id="ta-kmsg" style="margin-top:8px;font-size:12px;"></div>
    </div>`;

  document.getElementById('ta-ksave').addEventListener('click', async () => {
    const field = document.getElementById('ta-kf').value;
    const value = document.getElementById('ta-kv').value;
    const msg = document.getElementById('ta-kmsg');
    if (!value.trim()) { msg.textContent = 'Value is required.'; msg.style.color = '#b91c1c'; return; }
    if (!confirm('Update kernel parameter ' + field + ' to "' + value + '"? This is a site-wide change.')) return;
    msg.textContent = 'Saving…';
    msg.style.color = '';
    const out = await apiPut('params/kernel', { field, value });
    if (out.ok) {
      msg.textContent = 'Saved. Refresh to see updated values.';
      msg.style.color = '#166534';
    } else {
      msg.textContent = out.error || JSON.stringify(out);
      msg.style.color = '#b91c1c';
    }
  });
}

