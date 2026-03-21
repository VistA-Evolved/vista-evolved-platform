/**
 * Tenant Admin — VistA-First SPA (direct XWB broker, fixture fallback)
 *
 * Hash-based routing with 11 render functions matching the tenant-admin surfaces
 * defined in tenant-admin-design-contract-v1.md (plus later-slice additions).
 *
 * Implementation posture: VistA-first — direct XWB RPC broker connection via
 * lib/xwb-client.mjs. When VISTA_HOST/PORT/ACCESS_CODE/VERIFY_CODE are configured,
 * data comes from live VistA RPCs (ORWU NEWPERS, ORWU HASKEY, XUS DIVISION GET,
 * ORWU CLINLOC, ORQPT WARDS). Otherwise, fixture data is used.
 * Source badges honestly display "VistA", "FIXTURE", or "TERMINAL" per surface.
 *
 * Surfaces: Dashboard, User List, User Detail, Role Assignment,
 *           Facility List, Facility Detail, Clinic List, Ward List,
 *           Key Inventory, E-Sig Status, Guided Write Workflows
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
  } else if (hash === '#/guided-tasks') {
    renderGuidedTasks(content);
  } else if (hash === '#/modules' || hash === '#/connections' || hash === '#/site-params') {
    content.innerHTML = `<div class="page-header"><h1>Coming Soon</h1><span class="source-posture pending">PLANNED</span></div><div class="empty-message">This surface is planned for a future slice. <a href="#/dashboard">Return to dashboard \u2192</a></div>`;
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

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Render a source posture badge based on the API response source field.
 * @param {string} source - 'vista', 'fixture', or 'unavailable'
 * @returns {string} HTML for the badge
 */
function sourceBadge(source) {
  if (source === 'vista') {
    return '<span class="source-posture vista">VistA</span>';
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
  const badge = sourceBadge(res.source);
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
    <div class="page-header">
      <h1>User List</h1>
      <span class="source-posture fixture">Loading…</span>
    </div>
    <div class="loading-message">Loading users…</div>`;

  const res = await api('users');
  if (!res.ok) { el.innerHTML = `<div class="error-message">Failed to load users</div>`; return; }
  const users = res.data;
  const badge = sourceBadge(res.source);
  const vistaNote = res.vistaStatus ? `<span class="vista-note">(VistA: ${escapeHtml(res.vistaStatus)})</span>` : '';

  if (!users.length) {
    el.innerHTML = `
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
      ${sourceBadge(res.source)}
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
            <div class="detail-row"><dt>Has Code (Field 20.4)</dt><dd>${eSig.hasCode ? 'Yes (hashed in VistA)' : 'No'}</dd></div>
            <div class="detail-row"><dt>Validation RPC</dt><dd><code>ORWU VALIDSIG</code></dd></div>
          </dl>
          <div style="margin-top:8px;padding:8px 12px;background:#fffbeb;border-radius:4px;font-size:12px;color:#92400e;">
            E-signature codes are hashed in VistA File 200 field 20.4 and cannot be retrieved.
            Validation is presence-check only via ORWU VALIDSIG. Setup/reset is terminal-only.
          </div>
        </div>

        <div class="detail-section">
          <h2>Security Keys</h2>
          <div>${roles.length ? roles.map(r => '<span class="badge badge-key" style="margin:2px">' + escapeHtml(r) + '</span>').join(' ') : '<span style="color:var(--color-text-muted)">No keys assigned</span>'}</div>
          <div style="margin-top:8px;font-size:12px;color:var(--color-text-muted);">
            Keys are verified via <code>ORWU HASKEY</code> RPC. Assignment/revocation is terminal-only
            (<a href="#/guided-tasks">guided workflow →</a>).
          </div>
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
          <div class="context-value">${sourceBadge(res.source)}</div>
          <div class="context-divider"></div>
          <div class="context-label">Write Actions</div>
          <div style="font-size:12px;color:var(--color-text-muted);margin-top:4px;">
            <a href="#/guided-tasks">Guided terminal workflows →</a>
          </div>
        </div>
      </aside>
    </div>`;
}

// ---------------------------------------------------------------------------
// Role Assignment
// ---------------------------------------------------------------------------
async function renderRoleAssignment(el) {
  el.innerHTML = `
    <div class="page-header">
      <h1>Role Assignment</h1>
    </div>
    <div class="loading-message">Loading roles…</div>`;

  const res = await api('roles');
  if (!res.ok) { el.innerHTML = `<div class="error-message">Failed to load roles</div>`; return; }
  const roles = res.data;

  const rows = roles.map(r => `
    <tr>
      <td><span class="badge badge-key">${escapeHtml(r.name)}</span></td>
      <td>${escapeHtml(r.description)}</td>
      <td>${r.vistaGrounding.file19_1Ien ? 'IEN ' + r.vistaGrounding.file19_1Ien : '—'}</td>
      <td>${r.assignedUsers.length ? r.assignedUsers.map(u => typeof u === 'object' ? '<a href="#/users/' + encodeURIComponent(u.id) + '">' + escapeHtml(u.name) + '</a>' : escapeHtml(u)).join(', ') : '<span style="color:var(--color-text-muted)">None</span>'}</td>
    </tr>`).join('');

  const noteHtml = res.integrationNote
    ? `<div class="detail-section" style="margin-bottom:12px;padding:12px 16px;font-size:12px;border-left:4px solid var(--color-warning)">
         <strong>Integration Note:</strong> ${escapeHtml(res.integrationNote)}
       </div>`
    : '';

  el.innerHTML = `
    <div class="page-header">
      <h1>Role Assignment</h1>
      ${sourceBadge(res.source)}
    </div>
    ${noteHtml}
    <table class="data-table">
      <thead><tr>
        <th>Key</th><th>Description</th><th>File 19.1</th><th>Assigned Users</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
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
      ${sourceBadge(res.source)}${vistaNote}
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
      ${sourceBadge(res.source)}
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
          <div class="context-value">${sourceBadge(res.source)}</div>
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
      ${sourceBadge(res.source)}
    </div>
    <div class="card-grid" style="margin-bottom:1rem;">
      <div class="card"><div class="card-label">Total Clinics</div><div class="card-value">${summary.totalClinics ?? clinics.length}</div></div>
      <div class="card"><div class="card-label">With Stop Code</div><div class="card-value">${summary.withStopCode ?? '—'}</div></div>
      <div class="card"><div class="card-label">Avg Slot Length</div><div class="card-value">${summary.avgSlotLength ? summary.avgSlotLength + ' min' : '—'}</div></div>
    </div>
    <div class="detail-section">
      <table>
        <thead><tr><th>Clinic Name</th><th>Abbreviation</th><th>Stop Code</th><th>Slot Length</th><th>Status</th><th>VistA Reference</th></tr></thead>
        <tbody id="clinic-tbody">${clinicRows(clinics)}</tbody>
      </table>
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
      ${sourceBadge(res.source)}
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
    <div class="detail-section">
      <h2>VistA Grounding</h2>
      <dl>
        <div class="detail-row"><dt>Read RPC</dt><dd>${escapeHtml(grounding.readRpc || 'ORQPT WARDS')}</dd></div>
        <div class="detail-row"><dt>Ward File</dt><dd>${escapeHtml(grounding.file || 'File 42 (Ward Location)')}</dd></div>
        <div class="detail-row"><dt>Global</dt><dd>^DIC(42,</dd></div>
        <div class="detail-row"><dt>Bed File</dt><dd>${escapeHtml(grounding.bedFile || 'File 405.4 (Room-Bed)')}</dd></div>
      </dl>
    </div>`;
}

// ---------------------------------------------------------------------------
// Key Inventory
// ---------------------------------------------------------------------------
async function renderKeyInventory(el) {
  el.innerHTML = `
    <div class="page-header">
      <h1>Key Inventory</h1>
    </div>
    <div class="loading-message">Loading key inventory…</div>`;

  const res = await api('key-inventory');
  if (!res.ok) { el.innerHTML = `<div class="error-message">Failed to load key inventory</div>`; return; }
  const keys = res.data;
  const summary = res.summary;

  const rows = keys.map(k => {
    const catBadge = k.category === 'clinical'
      ? '<span class="badge" style="background:#dbeafe;color:#1e40af">clinical</span>'
      : k.category === 'administrative'
      ? '<span class="badge" style="background:#fef3c7;color:#92400e">admin</span>'
      : '<span class="badge badge-inactive">other</span>';
    const holderList = k.holders.length
      ? k.holders.map(h => '<a href="#/users/' + encodeURIComponent(h.id) + '">' + escapeHtml(h.name) + '</a>').join(', ')
      : '<span style="color:var(--color-text-muted)">No holders</span>';
    const grounding = k.vistaGrounding;
    return `
      <tr>
        <td><span class="badge badge-key">${escapeHtml(k.keyName)}</span></td>
        <td>${catBadge}</td>
        <td>${escapeHtml(k.description)}</td>
        <td style="font-weight:600">${k.holderCount}</td>
        <td>${holderList}</td>
        <td>${grounding.file19_1Ien ? 'IEN ' + grounding.file19_1Ien : '—'}</td>
      </tr>`;
  }).join('');

  const keyNoteHtml = res.integrationNote
    ? `<div class="detail-section" style="margin-bottom:12px;padding:12px 16px;font-size:12px;border-left:4px solid var(--color-warning)">
         <strong>Integration Note:</strong> ${escapeHtml(res.integrationNote)}
       </div>`
    : '';

  el.innerHTML = `
    <div class="page-header">
      <h1>Key Inventory</h1>
      ${sourceBadge(res.source)}
    </div>
    <div class="card-grid" style="margin-bottom:20px">
      <div class="card">
        <div class="card-label">Total Keys</div>
        <div class="card-value">${summary.totalKeys}</div>
      </div>
      <div class="card">
        <div class="card-label">Clinical Keys</div>
        <div class="card-value">${summary.clinicalKeys}</div>
      </div>
      <div class="card">
        <div class="card-label">Admin Keys</div>
        <div class="card-value">${summary.adminKeys}</div>
      </div>
      <div class="card">
        <div class="card-label">Unassigned</div>
        <div class="card-value" style="${summary.unassignedKeys > 0 ? 'color:var(--color-warning)' : ''}">${summary.unassignedKeys}</div>
      </div>
    </div>
    ${keyNoteHtml}
    <div class="detail-section" style="margin-bottom:12px;padding:12px 16px;font-size:12px;border-left:4px solid var(--color-primary)">
      <strong>VistA Grounding:</strong> Keys live in File 19.1 (SECURITY KEY).
      Holder lookup: <code>^XUSEC(keyName,DUZ)</code>.
      Verification RPC: <code>ORWU HASKEY</code>.
      Key assignment is terminal-only — <a href="#/guided-tasks">guided workflow →</a>
    </div>
    <table class="data-table">
      <thead><tr>
        <th>Key</th><th>Category</th><th>Description</th><th>Holders</th><th>Assigned To</th><th>File 19.1</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ---------------------------------------------------------------------------
// E-Signature Status
// ---------------------------------------------------------------------------
async function renderEsigStatus(el) {
  el.innerHTML = `
    <div class="page-header">
      <h1>Electronic Signature Status</h1>
    </div>
    <div class="loading-message">Loading e-sig status…</div>`;

  const res = await api('esig-status');
  if (!res.ok) { el.innerHTML = `<div class="error-message">Failed to load e-sig status</div>`; return; }
  const users = res.data;
  const agg = res.aggregates;
  const grounding = res.vistaGrounding;

  const rows = users.map(u => {
    const statusBadge = u.esigStatus === 'active' ? 'badge-active'
      : u.esigStatus === 'revoked' ? 'badge-inactive' : 'badge-ungrounded';
    return `
      <tr>
        <td><a href="#/users/${encodeURIComponent(u.id)}">${escapeHtml(u.name)}</a></td>
        <td>${u.duz ?? '—'}</td>
        <td><span class="badge ${u.status === 'active' ? 'badge-active' : 'badge-inactive'}">${escapeHtml(u.status)}</span></td>
        <td><span class="badge ${statusBadge}">${escapeHtml(u.esigStatus)}</span></td>
        <td>${u.hasCode ? 'Yes' : 'No'}</td>
      </tr>`;
  }).join('');

  const esigNoteHtml = res.integrationNote
    ? `<div class="detail-section" style="margin-bottom:12px;padding:12px 16px;font-size:12px;border-left:4px solid var(--color-warning)">
         <strong>Integration Note:</strong> ${escapeHtml(res.integrationNote)}
       </div>`
    : '';

  el.innerHTML = `
    <div class="page-header">
      <h1>Electronic Signature Status</h1>
      ${sourceBadge(res.source)}
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
    ${esigNoteHtml}
    <div class="detail-section" style="margin-bottom:12px;padding:12px 16px;font-size:12px;border-left:4px solid var(--color-warning)">
      <strong>VistA Grounding:</strong> E-signature codes are stored as hashed values in
      <code>${escapeHtml(grounding.field)}</code> and <strong>cannot be retrieved</strong>.
      Validation RPC: <code>${escapeHtml(grounding.validationRpc)}</code>.
      ${escapeHtml(grounding.note)}
      E-sig setup/reset is terminal-only — <a href="#/guided-tasks">guided workflow →</a>
    </div>
    <table class="data-table">
      <thead><tr>
        <th>Name</th><th>DUZ</th><th>User Status</th><th>E-Sig Status</th><th>Has Code</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ---------------------------------------------------------------------------
// Guided Write Workflows
// ---------------------------------------------------------------------------
async function renderGuidedTasks(el) {
  // 19 guided write workflows from the canonical catalog (GW-* IDs)
  // Mode A = Live Read (auto-verify), Mode B = Guided Terminal Write, Mode C = Terminal-Only
  const workflows = [
    // --- USER MANAGEMENT ---
    {
      id: 'GW-USR-01', category: 'User Management', mode: 'B',
      title: 'Add New User',
      description: 'Create a new user in VistA File 200 with proper access/verify codes, person class, and division assignment.',
      vistaTarget: 'File 200 via UPDATE^DIE or ^VA(200)',
      riskLevel: 'high',
      steps: [
        'Open VistA terminal (SSH or Docker exec)',
        'Navigate: EVE > User Management > Add a New User',
        'Enter user demographics (name, SSN, DOB)',
        'Assign ACCESS CODE and VERIFY CODE',
        'Set PERSON CLASS and SERVICE/SECTION',
        'Assign DIVISION(s) via File 200 node "DIV"',
        'Allocate required security keys (PROVIDER, ORES, etc.)',
      ],
      verifyStep: 'Re-read user list: check new user appears in File 200 B-index',
      verifyRoute: '#/users',
      terminalCommand: 'docker exec -it vehu su - vehu -c "mumps -r ^XUP"',
      whyTerminal: 'VistA user creation requires multi-file coordination (200, 200.01, 8930.3) with MUMPS triggers. No safe write RPC exists for full user provisioning.',
    },
    {
      id: 'GW-USR-02', category: 'User Management', mode: 'B',
      title: 'Edit User Properties',
      description: 'Modify an existing user\'s status, division assignment, person class, or service/section.',
      vistaTarget: 'File 200 via ^DIE or VA Kernel menus',
      riskLevel: 'medium',
      steps: [
        'Open VistA terminal',
        'Navigate: EVE > User Management > Edit an Existing User',
        'Select user by name or DUZ',
        'Modify target field(s)',
      ],
      verifyStep: 'Re-read user detail: confirm changed fields reflect new values',
      verifyRoute: '#/users',
      terminalCommand: 'docker exec -it vehu su - vehu -c "mumps -r ^XUP"',
      whyTerminal: 'User field edits involve FileMan cross-references and triggers that must execute within the MUMPS environment.',
    },
    {
      id: 'GW-USR-03', category: 'User Management', mode: 'B',
      title: 'Deactivate User (DISUSER)',
      description: 'Set DISUSER flag (File 200 field 4) to prevent a user from logging into VistA. Does not delete the record.',
      vistaTarget: 'File 200 field 4 (DISUSER)',
      riskLevel: 'high',
      steps: [
        'Open VistA terminal',
        'Navigate: EVE > User Management > Edit an Existing User',
        'Select user by name or DUZ',
        'Set DISUSER field to YES',
        'Optionally remove security keys to prevent residual access',
        'Optionally clear electronic signature code',
      ],
      verifyStep: 'Re-read user detail: confirm status shows inactive/DISUSER=YES',
      verifyRoute: '#/users',
      terminalCommand: 'docker exec -it vehu su - vehu -c "mumps -r ^XUP"',
      whyTerminal: 'User deactivation involves DISUSER flag plus potential key revocation and signature code clearing. Multiple cross-referenced fields must be coordinated.',
    },
    {
      id: 'GW-USR-04', category: 'User Management', mode: 'B',
      title: 'Reactivate User',
      description: 'Clear the DISUSER flag and restore access for a previously deactivated user. May need to re-assign keys and verify codes.',
      vistaTarget: 'File 200 field 4 (DISUSER) + field 2/11 (verify code)',
      riskLevel: 'high',
      steps: [
        'Open VistA terminal',
        'Navigate: EVE > User Management > Edit an Existing User',
        'Select user by name or DUZ',
        'Set DISUSER field to NO',
        'Verify ACCESS CODE and VERIFY CODE are still valid',
        'Re-allocate security keys if previously revoked',
      ],
      verifyStep: 'Re-read user detail: confirm status active, DISUSER=NO',
      verifyRoute: '#/users',
      terminalCommand: 'docker exec -it vehu su - vehu -c "mumps -r ^XUP"',
      whyTerminal: 'Reactivation requires clearing DISUSER, possibly resetting verify code, and re-allocating keys — all FileMan-coordinated operations.',
    },
    {
      id: 'GW-USR-05', category: 'User Management', mode: 'C',
      title: 'Set Up Electronic Signature',
      description: 'Configure or reset a user\'s electronic signature code in File 200 field 20.4. E-sig is required for signing orders and notes.',
      vistaTarget: 'File 200 field 20.4 (ELECTRONIC SIGNATURE CODE)',
      riskLevel: 'high',
      steps: [
        'Open VistA terminal (SSH or Docker exec)',
        'Navigate: EVE > User Management > Electronic Signature',
        'Select user by name or DUZ',
        'User enters new signature code (interactive, not scriptable)',
        'VistA hashes and stores in File 200 field 20.4',
      ],
      verifyStep: 'Re-read e-sig status: confirm user shows esigStatus=active',
      verifyRoute: '#/esig-status',
      terminalCommand: 'docker exec -it vehu su - vehu -c "mumps -r ^XUP"',
      whyTerminal: 'E-sig codes are hashed by ENCRYP^XUSRB1 and must be entered interactively. Cannot be set via RPC — VistA security design constraint.',
    },
    // --- KEY MANAGEMENT ---
    {
      id: 'GW-KEY-01', category: 'Key Management', mode: 'B',
      title: 'Allocate Security Key',
      description: 'Grant a security key (File 19.1) to a user. Keys control access to VistA menu options and RPCs.',
      vistaTarget: 'File 19.1 holders via ^XUSEC',
      riskLevel: 'high',
      steps: [
        'Open VistA terminal',
        'Navigate: EVE > Menu Management > Key Management > Allocation',
        'Select key name (e.g., PROVIDER, ORES, XUMGR)',
        'Select user to grant key to',
        'Confirm allocation',
      ],
      verifyStep: 'Re-read key inventory: confirm holder count increased for this key',
      verifyRoute: '#/key-inventory',
      terminalCommand: 'docker exec -it vehu su - vehu -c "mumps -r ^XUP"',
      whyTerminal: 'Key allocation writes to ^XUSEC global with FileMan-managed cross-references. Direct writes risk index corruption.',
    },
    {
      id: 'GW-KEY-02', category: 'Key Management', mode: 'B',
      title: 'Remove Security Key',
      description: 'Revoke a security key from a user. The key record remains in File 19.1 but the user is removed from the holder list.',
      vistaTarget: 'File 19.1 holders via ^XUSEC',
      riskLevel: 'high',
      steps: [
        'Open VistA terminal',
        'Navigate: EVE > Menu Management > Key Management > De-Allocation',
        'Select key name',
        'Select user to revoke key from',
        'Confirm de-allocation',
      ],
      verifyStep: 'Re-read key inventory: confirm holder count decreased for this key',
      verifyRoute: '#/key-inventory',
      terminalCommand: 'docker exec -it vehu su - vehu -c "mumps -r ^XUP"',
      whyTerminal: 'Key de-allocation must update ^XUSEC cross-references atomically within FileMan.',
    },
    // --- DIVISION MANAGEMENT ---
    {
      id: 'GW-DIV-01', category: 'Division Management', mode: 'C',
      title: 'Manage Division Configuration',
      description: 'Add or modify a Medical Center Division (File 40.8) and link it to an Institution (File 4).',
      vistaTarget: 'File 40.8 via ^DG(40.8)',
      riskLevel: 'high',
      steps: [
        'Open VistA terminal',
        'Navigate: EVE > Systems Manager > Site Parameters',
        'Edit Medical Center Division file',
        'Set division name, institution pointer, facility number',
      ],
      verifyStep: 'Re-read facilities: confirm XUS DIVISION GET returns updated data',
      verifyRoute: '#/facilities',
      terminalCommand: 'docker exec -it vehu su - vehu -c "mumps -r ^XUP"',
      whyTerminal: 'Division configuration affects system-wide routing and is tightly coupled to Kernel site parameters.',
    },
    {
      id: 'GW-DIV-02', category: 'Division Management', mode: 'B',
      title: 'Manage Service/Section',
      description: 'Create or edit a Service/Section entry used for user assignment and workload reporting.',
      vistaTarget: 'File 49 (SERVICE/SECTION) via ^DIC(49)',
      riskLevel: 'medium',
      steps: [
        'Open VistA terminal',
        'Navigate: EVE > Systems Manager > MAS Parameter Entry/Edit',
        'Select Service/Section file',
        'Enter or edit service name, abbreviation, chief',
        'Link to appropriate division',
      ],
      verifyStep: 'Confirm service appears in user edit picklist',
      verifyRoute: '#/facilities',
      terminalCommand: 'docker exec -it vehu su - vehu -c "mumps -r ^XUP"',
      whyTerminal: 'Service/Section entries in File 49 are referenced by user records, workload, and bed control. FileMan cross-references must be maintained.',
    },
    {
      id: 'GW-DIV-03', category: 'Division Management', mode: 'B',
      title: 'View/Edit Kernel Site Parameters',
      description: 'View and modify Kernel System Parameters (File 8989.3) including site name, domain, and production account flag.',
      vistaTarget: 'File 8989.3 (KERNEL SYSTEM PARAMETERS)',
      riskLevel: 'high',
      steps: [
        'Open VistA terminal',
        'Navigate: EVE > Systems Manager > Kernel System Parameters',
        'Review current site name, domain, production flag',
        'Edit parameters as needed (requires XUMGR key)',
      ],
      verifyStep: 'Confirm updated parameters via terminal re-read',
      verifyRoute: '#/facilities',
      terminalCommand: 'docker exec -it vehu su - vehu -c "mumps -r ^XUP"',
      whyTerminal: 'Kernel parameters are foundational infrastructure. Changes cascade to login behavior, RPC context, and site identification.',
    },
    // --- CLINIC MANAGEMENT ---
    {
      id: 'GW-CLIN-01', category: 'Clinic Management', mode: 'B',
      title: 'Add/Edit Clinic Location',
      description: 'Create or modify a Hospital Location (File 44) clinic entry with scheduling parameters.',
      vistaTarget: 'File 44 via ^SC',
      riskLevel: 'medium',
      steps: [
        'Open VistA terminal',
        'Navigate: EVE > Scheduling > Set Up Clinic',
        'Enter clinic name, abbreviation, type (C=Clinic)',
        'Set division pointer, stop codes, default slot length',
        'Configure availability (optional)',
      ],
      verifyStep: 'Re-read clinic list: confirm ORWU CLINLOC returns the new/changed clinic',
      verifyRoute: '#/clinics',
      terminalCommand: 'docker exec -it vehu su - vehu -c "mumps -r ^XUP"',
      whyTerminal: 'Clinic setup involves multiple File 44 sub-nodes and scheduling cross-references that require interactive FileMan entry.',
    },
    {
      id: 'GW-CLIN-02', category: 'Clinic Management', mode: 'B',
      title: 'Edit Clinic Fields',
      description: 'Modify clinic properties: stop code, slot length, display name, abbreviation, or inactivation date.',
      vistaTarget: 'File 44 fields via ^SC',
      riskLevel: 'medium',
      steps: [
        'Open VistA terminal',
        'Navigate: EVE > Scheduling > Set Up Clinic',
        'Select existing clinic by name',
        'Edit target field(s) — stop code, slot length, abbreviation',
      ],
      verifyStep: 'Re-read clinic list: confirm changed fields reflect new values',
      verifyRoute: '#/clinics',
      terminalCommand: 'docker exec -it vehu su - vehu -c "mumps -r ^XUP"',
      whyTerminal: 'Stop code and scheduling fields have associated cross-references in File 44 that FileMan must maintain.',
    },
    {
      id: 'GW-CLIN-03', category: 'Clinic Management', mode: 'B',
      title: 'Inactivate/Reactivate Clinic',
      description: 'Set or clear the inactivation date on a File 44 clinic entry. Inactive clinics are excluded from scheduling.',
      vistaTarget: 'File 44 INACTIVATION DATE field',
      riskLevel: 'medium',
      steps: [
        'Open VistA terminal',
        'Navigate: EVE > Scheduling > Set Up Clinic',
        'Select clinic by name',
        'Set INACTIVATION DATE to today (inactivate) or clear it (reactivate)',
      ],
      verifyStep: 'Re-read clinic list: confirm clinic status changed',
      verifyRoute: '#/clinics',
      terminalCommand: 'docker exec -it vehu su - vehu -c "mumps -r ^XUP"',
      whyTerminal: 'Inactivation date changes trigger scheduling cross-reference updates in File 44.',
    },
    // --- WARD MANAGEMENT ---
    {
      id: 'GW-WARD-01', category: 'Ward Management', mode: 'B',
      title: 'Add/Edit Ward Location',
      description: 'Create or modify a Ward Location (File 42) with room-bed inventory and link to File 44 type=W.',
      vistaTarget: 'File 42 via ^DIC(42) + File 405.4 via ^DG(405.4)',
      riskLevel: 'high',
      steps: [
        'Open VistA terminal',
        'Navigate: EVE > ADT Manager > Ward Definition',
        'Enter ward name, specialty, service',
        'Set corresponding Hospital Location (File 44 type=W)',
        'Define room-bed inventory in File 405.4',
        'Assign operating beds and out-of-service beds',
      ],
      verifyStep: 'Re-read ward list: confirm ORQPT WARDS returns the new/changed ward',
      verifyRoute: '#/wards',
      terminalCommand: 'docker exec -it vehu su - vehu -c "mumps -r ^XUP"',
      whyTerminal: 'Ward creation requires coordinated entries in File 42, File 44, and File 405.4. MUMPS cross-references link bed status to ADT movements.',
    },
    {
      id: 'GW-WARD-02', category: 'Ward Management', mode: 'C',
      title: 'Room-Bed Setup',
      description: 'Add, modify, or decommission room-bed entries in File 405.4 for an existing ward.',
      vistaTarget: 'File 405.4 (ROOM-BED) via ^DG(405.4)',
      riskLevel: 'high',
      steps: [
        'Open VistA terminal',
        'Navigate: EVE > ADT Manager > Bed Control',
        'Select ward',
        'Add/edit/decommission beds',
        'Set bed status (available, out-of-service)',
      ],
      verifyStep: 'Re-read ward list: confirm bed counts updated',
      verifyRoute: '#/wards',
      terminalCommand: 'docker exec -it vehu su - vehu -c "mumps -r ^XUP"',
      whyTerminal: 'Room-bed changes in File 405.4 update bed tracking and ADT census cross-references. DDR FILER could write but risks data integrity.',
    },
    // --- ORDERING / CPRS CONFIG ---
    {
      id: 'GW-ORD-01', category: 'Ordering Configuration', mode: 'C',
      title: 'Quick Order Management',
      description: 'Create or edit quick orders used by CPRS for streamlined ordering. Quick orders reference order dialogs and pre-populated fields.',
      vistaTarget: 'File 101.41 (ORDER DIALOG) via CPRS setup menus',
      riskLevel: 'medium',
      steps: [
        'Open VistA terminal',
        'Navigate: EVE > CPRS Manager > Quick Order Management',
        'Select order dialog type (meds, labs, consults)',
        'Enter quick order name and pre-populated fields',
        'Assign to target clinic or provider',
      ],
      verifyStep: 'Confirm quick order appears in CPRS ordering dialog (requires CPRS login)',
      verifyRoute: null,
      terminalCommand: 'docker exec -it vehu su - vehu -c "mumps -r ^XUP"',
      whyTerminal: 'Quick order creation involves File 101.41 with complex sub-file structures. No safe write RPC exists for full order dialog provisioning.',
    },
    {
      id: 'GW-ORD-02', category: 'Ordering Configuration', mode: 'A',
      title: 'Configure CPRS Notifications',
      description: 'View and modify CPRS notification settings. Uses ORQ3 LOADALL/SAVEALL RPCs for read and write.',
      vistaTarget: 'Notification parameters via ORQ3 LOADALL / ORQ3 SAVEALL',
      riskLevel: 'medium',
      steps: [
        'Review current notification settings via ORQ3 LOADALL RPC',
        'Identify notifications to enable/disable',
        'Compose updated settings payload',
        'Submit via ORQ3 SAVEALL RPC (if available in sandbox)',
      ],
      verifyStep: 'Re-read via ORQ3 LOADALL: confirm updated settings',
      verifyRoute: null,
      terminalCommand: 'docker exec -it vehu su - vehu -c "mumps -r ^XUP"',
      whyTerminal: 'While ORQ3 SAVEALL exists as a write RPC, notification parameter structures are complex. Terminal verification recommended after RPC write.',
    },
    // --- MENU / PCMM ---
    {
      id: 'GW-MENU-01', category: 'System Configuration', mode: 'C',
      title: 'View/Edit Menu Trees',
      description: 'View and modify VistA menu option trees (File 19). Controls user navigation and feature access.',
      vistaTarget: 'File 19 (OPTION) via ^DIC(19)',
      riskLevel: 'high',
      steps: [
        'Open VistA terminal',
        'Navigate: EVE > Menu Management > Edit Options',
        'Select option by name',
        'Add/remove sub-options or modify properties',
        'Verify menu tree reflects changes',
      ],
      verifyStep: 'Confirm via terminal: menu tree shows updated structure',
      verifyRoute: null,
      terminalCommand: 'docker exec -it vehu su - vehu -c "mumps -r ^XUP"',
      whyTerminal: 'Menu trees in File 19 have recursive sub-file structures with security key linkages. No write RPC exists.',
    },
    {
      id: 'GW-PCMM-01', category: 'System Configuration', mode: 'C',
      title: 'PCMM Team Management',
      description: 'Create or modify Patient Care Management Module (PCMM) team assignments linking providers to patient panels.',
      vistaTarget: 'PCMM files via SD PCMM menus',
      riskLevel: 'medium',
      steps: [
        'Open VistA terminal',
        'Navigate: EVE > Scheduling > PCMM Manager',
        'Select team or create new team',
        'Assign providers and define roles',
        'Link patients to primary care team',
      ],
      verifyStep: 'Confirm via terminal: team roster shows updated assignments',
      verifyRoute: null,
      terminalCommand: 'docker exec -it vehu su - vehu -c "mumps -r ^XUP"',
      whyTerminal: 'PCMM team/patient assignment involves multiple cross-referenced files. No safe write RPC exists for team management.',
    },
  ];

  const riskColor = { high: '#dc2626', medium: '#d97706', low: '#059669' };
  const modeLabel = { A: 'Mode A — Live Read', B: 'Mode B — Guided Terminal', C: 'Mode C — Terminal Only' };
  const modeColor = { A: '#059669', B: '#2563eb', C: '#7c3aed' };

  // Group by category
  const categories = [];
  const catMap = {};
  for (const w of workflows) {
    if (!catMap[w.category]) { catMap[w.category] = []; categories.push(w.category); }
    catMap[w.category].push(w);
  }

  function renderCard(w) {
    const stepsHtml = w.steps.map((s, i) => `
      <li>
        <label class="step-check">
          <input type="checkbox" data-wf="${w.id}" data-step="${i}" />
          <span>${escapeHtml(s)}</span>
        </label>
      </li>`).join('');

    const verifyHtml = w.verifyRoute
      ? `<div class="guided-task-verify">
           <strong>Verify:</strong> ${escapeHtml(w.verifyStep)}
           <a href="${w.verifyRoute}" class="verify-link">Open verify surface →</a>
         </div>`
      : `<div class="guided-task-verify">
           <strong>Verify:</strong> ${escapeHtml(w.verifyStep || 'Manual terminal verification required')}
         </div>`;

    return `
    <div class="guided-task-card" id="wf-${w.id}">
      <div class="guided-task-header">
        <h3>${escapeHtml(w.title)}</h3>
        <div style="display:flex;gap:6px;align-items:center;">
          <span class="mode-badge" style="background:${modeColor[w.mode]};color:#fff;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;">${w.mode}</span>
          <span class="risk-badge" style="background:${riskColor[w.riskLevel]};color:#fff;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;text-transform:uppercase">${escapeHtml(w.riskLevel)}</span>
        </div>
      </div>
      <div style="font-size:11px;color:var(--color-text-muted);margin-bottom:4px;">${escapeHtml(w.id)} · ${escapeHtml(modeLabel[w.mode])}</div>
      <p class="guided-task-desc">${escapeHtml(w.description)}</p>
      <div class="guided-task-target">
        <strong>VistA target:</strong> ${escapeHtml(w.vistaTarget)}
      </div>
      <div class="guided-task-steps">
        <strong>Steps:</strong>
        <ol>${stepsHtml}</ol>
      </div>
      <div class="guided-task-terminal">
        <strong>Terminal entry point:</strong>
        <code class="terminal-cmd">${escapeHtml(w.terminalCommand)}</code>
      </div>
      ${verifyHtml}
      <details class="evidence-section">
        <summary>Evidence capture</summary>
        <textarea class="evidence-input" data-wf="${w.id}" rows="4" placeholder="Paste terminal output or describe what you observed…"></textarea>
        <div style="font-size:11px;color:var(--color-text-muted);margin-top:4px;">Evidence is stored locally in browser only · not sent to server</div>
      </details>
      <div class="guided-task-rationale">
        <em>${escapeHtml(w.whyTerminal)}</em>
      </div>
    </div>`;
  }

  const categoryBlocks = categories.map(cat => `
    <div class="guided-category">
      <h2 class="guided-category-title">${escapeHtml(cat)}</h2>
      <div class="guided-tasks-grid">
        ${catMap[cat].map(w => renderCard(w)).join('')}
      </div>
    </div>`).join('');

  // Summary counts
  const total = workflows.length;
  const modeACnt = workflows.filter(w => w.mode === 'A').length;
  const modeBCnt = workflows.filter(w => w.mode === 'B').length;
  const modeCCnt = workflows.filter(w => w.mode === 'C').length;
  const highRisk = workflows.filter(w => w.riskLevel === 'high').length;

  el.innerHTML = `
    <div class="page-header">
      <h1>Guided Write Workflows</h1>
      <span class="source-posture terminal">TERMINAL</span>
    </div>
    <div class="card-grid" style="margin-bottom:1rem;">
      <div class="card"><div class="card-label">Total Workflows</div><div class="card-value">${total}</div></div>
      <div class="card"><div class="card-label">Mode A (Live)</div><div class="card-value" style="color:${modeColor.A}">${modeACnt}</div></div>
      <div class="card"><div class="card-label">Mode B (Guided)</div><div class="card-value" style="color:${modeColor.B}">${modeBCnt}</div></div>
      <div class="card"><div class="card-label">Mode C (Terminal)</div><div class="card-value" style="color:${modeColor.C}">${modeCCnt}</div></div>
      <div class="card"><div class="card-label">High Risk</div><div class="card-value" style="color:${riskColor.high}">${highRisk}</div></div>
    </div>
    <div class="guided-tasks-intro">
      <p><strong>VistA writes require terminal access.</strong> Direct web-based writes to VistA
      globals risk index corruption, missed cross-references, and audit gaps.</p>
      <p>Each workflow follows the 6-step canonical pattern: <strong>Display → Compose → Attempt → Fallback → Evidence → Verify.</strong>
      Check off steps as you complete them. Paste terminal output in the evidence section. Use the verify link to re-read VistA state and confirm your change took effect.</p>
      <p style="font-size:12px;color:var(--color-text-muted);">
        <strong>Mode A</strong> = live read/write via confirmed RPCs ·
        <strong>Mode B</strong> = guided terminal write with browser verification ·
        <strong>Mode C</strong> = terminal-only, no browser writeback
      </p>
    </div>
    ${categoryBlocks}`;

  // --- Step tracking persistence (localStorage) ---
  const STEP_KEY = 've-guided-steps';
  const EVIDENCE_KEY = 've-guided-evidence';

  function loadSteps() {
    try { return JSON.parse(localStorage.getItem(STEP_KEY)) || {}; } catch { return {}; }
  }
  function saveSteps(data) { localStorage.setItem(STEP_KEY, JSON.stringify(data)); }
  function loadEvidence() {
    try { return JSON.parse(localStorage.getItem(EVIDENCE_KEY)) || {}; } catch { return {}; }
  }
  function saveEvidence(data) { localStorage.setItem(EVIDENCE_KEY, JSON.stringify(data)); }

  // Restore saved step state
  const stepState = loadSteps();
  el.querySelectorAll('input[data-wf][data-step]').forEach(cb => {
    const key = cb.dataset.wf + ':' + cb.dataset.step;
    if (stepState[key]) {
      cb.checked = true;
      cb.closest('label').querySelector('span').classList.add('step-done');
    }
  });

  // Restore saved evidence
  const evidState = loadEvidence();
  el.querySelectorAll('textarea.evidence-input').forEach(ta => {
    if (evidState[ta.dataset.wf]) ta.value = evidState[ta.dataset.wf];
  });

  // Step checkbox handler
  el.addEventListener('change', (e) => {
    const cb = e.target.closest('input[data-wf][data-step]');
    if (!cb) return;
    const key = cb.dataset.wf + ':' + cb.dataset.step;
    const data = loadSteps();
    data[key] = cb.checked;
    saveSteps(data);
    const span = cb.closest('label').querySelector('span');
    span.classList.toggle('step-done', cb.checked);
  });

  // Evidence textarea handler (debounced save)
  let evidTimer = null;
  el.addEventListener('input', (e) => {
    const ta = e.target.closest('textarea.evidence-input');
    if (!ta) return;
    clearTimeout(evidTimer);
    evidTimer = setTimeout(() => {
      const data = loadEvidence();
      data[ta.dataset.wf] = ta.value;
      saveEvidence(data);
    }, 400);
  });
}
