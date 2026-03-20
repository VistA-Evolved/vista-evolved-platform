/**
 * Tenant Admin — Dual-Mode SPA (VistA-first, fixture fallback)
 *
 * Hash-based routing with 6 render functions matching the first-slice surfaces
 * defined in tenant-admin-design-contract-v1.md.
 *
 * Implementation posture: dual-mode — VistA adapter + fixture fallback.
 * When VISTA_API_URL is configured and VistA is reachable, user data comes from
 * VistA RPCs (ORWU NEWPERS, ORWU HASKEY). Otherwise, fixture data is used.
 * Source badges honestly display "VistA" or "FIXTURE" per surface.
 *
 * Surfaces: Dashboard, User List, User Detail, Role Assignment,
 *           Facility List, Facility Detail
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
        <div class="card-sub"><a href="#/users">View user list →</a></div>
      </div>
      <div class="card">
        <div class="card-label">Facilities</div>
        <div class="card-value">${d.facilityCount}</div>
        <div class="card-sub"><a href="#/facilities">View facility list →</a></div>
      </div>
      <div class="card">
        <div class="card-label">Security Keys / Roles</div>
        <div class="card-value">${d.roleCount}</div>
        <div class="card-sub"><a href="#/roles">View role assignment →</a></div>
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
    return list.map(u => `
      <tr>
        <td><a href="#/users/${encodeURIComponent(u.id)}">${escapeHtml(u.name)}</a></td>
        <td>${escapeHtml(u.title || '—')}</td>
        <td><span class="badge ${u.status === 'active' ? 'badge-active' : 'badge-inactive'}">${escapeHtml(u.status)}</span></td>
        <td>${u.roles.map(r => `<span class="badge badge-key">${escapeHtml(r)}</span>`).join(' ')}</td>
        <td><span class="badge ${u.vistaGrounding.file200Status === 'grounded' ? 'badge-grounded' : 'badge-ungrounded'}">${escapeHtml(u.vistaGrounding.file200Status)}</span></td>
      </tr>`).join('');
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
        <th>Name</th><th>Title</th><th>Status</th><th>Keys</th><th>VistA</th>
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
      if (statusF && u.status !== statusF) return false;
      if (groundF && u.vistaGrounding.file200Status !== groundF) return false;
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

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/users">User List</a> › ${escapeHtml(u.name)}</div>
    <div class="page-header">
      <h1>${escapeHtml(u.name)}</h1>
      <span class="badge ${u.status === 'active' ? 'badge-active' : 'badge-inactive'}">${escapeHtml(u.status)}</span>
    </div>

    <div class="detail-layout">
      <div class="detail-main">
        <div class="detail-section">
          <h2>Identity</h2>
          <dl>
            <div class="detail-row"><dt>Username</dt><dd>${escapeHtml(u.username)}</dd></div>
            <div class="detail-row"><dt>Title</dt><dd>${escapeHtml(u.title || '—')}</dd></div>
            <div class="detail-row"><dt>Status</dt><dd>${escapeHtml(u.status)}</dd></div>
          </dl>
        </div>

        <div class="detail-section">
          <h2>VistA Grounding</h2>
          <dl>
            <div class="detail-row"><dt>DUZ (File 200)</dt><dd>${u.vistaGrounding.duz ?? '—'}</dd></div>
            <div class="detail-row"><dt>Grounding Status</dt><dd><span class="badge ${u.vistaGrounding.file200Status === 'grounded' ? 'badge-grounded' : 'badge-ungrounded'}">${escapeHtml(u.vistaGrounding.file200Status)}</span></dd></div>
            <div class="detail-row"><dt>Person Class</dt><dd>${escapeHtml(u.vistaGrounding.personClass || '—')}</dd></div>
          </dl>
        </div>

        <div class="detail-section">
          <h2>Security Keys</h2>
          <div>${u.roles.map(r => `<span class="badge badge-key" style="margin:2px">${escapeHtml(r)}</span>`).join(' ')}</div>
        </div>
      </div>

      <aside class="context-rail">
        <div class="card">
          <div class="context-label">User</div>
          <div class="context-value">${escapeHtml(u.name)}</div>
          <div class="context-label">Status</div>
          <div class="context-value"><span class="badge ${u.status === 'active' ? 'badge-active' : 'badge-inactive'}">${escapeHtml(u.status)}</span></div>
          <div class="context-divider"></div>
          <div class="context-label">VistA DUZ</div>
          <div class="context-value">${u.vistaGrounding.duz ?? '—'}</div>
          <div class="context-label">Grounding</div>
          <div class="context-value"><span class="badge ${u.vistaGrounding.file200Status === 'grounded' ? 'badge-grounded' : 'badge-ungrounded'}">${escapeHtml(u.vistaGrounding.file200Status)}</span></div>
          <div class="context-divider"></div>
          <div class="context-label">Actions</div>
          <div style="font-size:12px;color:var(--color-text-muted);margin-top:4px;">Read-only in first slice</div>
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
      <span class="source-posture fixture">FIXTURE</span>
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
      <td>${r.assignedUsers.length ? r.assignedUsers.map(u => escapeHtml(u)).join(', ') : '<span style="color:var(--color-text-muted)">None</span>'}</td>
    </tr>`).join('');

  el.innerHTML = `
    <div class="page-header">
      <h1>Role Assignment</h1>
      <span class="source-posture fixture">FIXTURE</span>
    </div>
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
      return `
        <li class="${indentClass}">
          <a href="#/facilities/${encodeURIComponent(f.id)}">${escapeHtml(f.name)}</a>
          <span class="tree-type">${escapeHtml(f.type)}</span>
          <span class="badge ${f.status === 'active' ? 'badge-active' : 'badge-inactive'}" style="margin-left:4px">${escapeHtml(f.status)}</span>
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

  // Facilities may be nested — search recursively
  const res = await api('facilities');
  if (!res.ok) { el.innerHTML = `<div class="error-message">Failed to load facilities</div>`; return; }

  function findFacility(items, id) {
    for (const f of items) {
      if (f.id === id) return f;
      if (f.children) {
        const found = findFacility(f.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  const f = findFacility(res.data, facId);
  if (!f) { el.innerHTML = `<div class="error-message">Facility not found</div>`; return; }

  const groundingRows = Object.entries(f.vistaGrounding || {}).map(([k, v]) =>
    `<div class="detail-row"><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(String(v))}</dd></div>`
  ).join('');

  const childrenHtml = f.children && f.children.length
    ? `<div class="detail-section">
         <h2>Children</h2>
         <ul class="facility-tree">
           ${f.children.map(c => `<li><a href="#/facilities/${encodeURIComponent(c.id)}">${escapeHtml(c.name)}</a> <span class="tree-type">${escapeHtml(c.type)}</span></li>`).join('')}
         </ul>
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
          </dl>
        </div>

        <div class="detail-section">
          <h2>VistA Grounding</h2>
          <dl>${groundingRows}</dl>
        </div>

        ${childrenHtml}
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
