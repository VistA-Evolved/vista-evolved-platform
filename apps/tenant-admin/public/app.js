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
  } else if (hash === '#/key-inventory') {
    renderKeyInventory(content);
  } else if (hash === '#/esig-status') {
    renderEsigStatus(content);
  } else if (hash === '#/guided-tasks') {
    renderGuidedTasks(content);
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
        <div class="card-sub"><a href="#/facilities">View facility list →</a></div>
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
      const eSig = u.vistaGrounding.electronicSignature || {};
      const eSigBadge = eSig.status === 'active' ? 'badge-active'
        : eSig.status === 'revoked' ? 'badge-inactive' : 'badge-ungrounded';
      return `
      <tr>
        <td><a href="#/users/${encodeURIComponent(u.id)}">${escapeHtml(u.name)}</a></td>
        <td>${escapeHtml(u.title || '—')}</td>
        <td><span class="badge ${u.status === 'active' ? 'badge-active' : 'badge-inactive'}">${escapeHtml(u.status)}</span></td>
        <td>${u.roles.map(r => '<span class="badge badge-key">' + escapeHtml(r) + '</span>').join(' ')}</td>
        <td><span class="badge ${eSigBadge}">${escapeHtml(eSig.status || '—')}</span></td>
        <td><span class="badge ${u.vistaGrounding.file200Status === 'grounded' ? 'badge-grounded' : 'badge-ungrounded'}">${escapeHtml(u.vistaGrounding.file200Status)}</span></td>
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
  const eSig = u.vistaGrounding.electronicSignature || {};
  const eSigBadgeClass = eSig.status === 'active' ? 'badge-active'
    : eSig.status === 'revoked' ? 'badge-inactive' : 'badge-ungrounded';

  el.innerHTML = `
    <div class="breadcrumb"><a href="#/dashboard">Dashboard</a> › <a href="#/users">User List</a> › ${escapeHtml(u.name)}</div>
    <div class="page-header">
      <h1>${escapeHtml(u.name)}</h1>
      <span class="badge ${u.status === 'active' ? 'badge-active' : 'badge-inactive'}">${escapeHtml(u.status)}</span>
      ${u.vistaGrounding.disuser ? '<span class="badge badge-inactive">DISUSER</span>' : ''}
    </div>

    <div class="detail-layout">
      <div class="detail-main">
        <div class="detail-section">
          <h2>Identity</h2>
          <dl>
            <div class="detail-row"><dt>Username</dt><dd>${escapeHtml(u.username)}</dd></div>
            <div class="detail-row"><dt>Title</dt><dd>${escapeHtml(u.title || '—')}</dd></div>
            <div class="detail-row"><dt>Status</dt><dd>${escapeHtml(u.status)}</dd></div>
            <div class="detail-row"><dt>Initials</dt><dd>${escapeHtml(u.vistaGrounding.initials || '—')}</dd></div>
          </dl>
        </div>

        <div class="detail-section">
          <h2>VistA Grounding (File 200)</h2>
          <dl>
            <div class="detail-row"><dt>DUZ (IEN)</dt><dd>${u.vistaGrounding.duz ?? '—'}</dd></div>
            <div class="detail-row"><dt>Grounding Status</dt><dd><span class="badge ${u.vistaGrounding.file200Status === 'grounded' ? 'badge-grounded' : 'badge-ungrounded'}">${escapeHtml(u.vistaGrounding.file200Status)}</span></dd></div>
            <div class="detail-row"><dt>Person Class</dt><dd>${escapeHtml(u.vistaGrounding.personClass || '—')}</dd></div>
            <div class="detail-row"><dt>Service/Section</dt><dd>${escapeHtml(u.vistaGrounding.serviceSection || '—')}</dd></div>
            <div class="detail-row"><dt>Division</dt><dd>${u.vistaGrounding.division ? escapeHtml(u.vistaGrounding.division.name) + ' (IEN ' + u.vistaGrounding.division.ien + ')' : '—'}</dd></div>
            <div class="detail-row"><dt>Primary Menu Option</dt><dd><code>${escapeHtml(u.vistaGrounding.primaryMenuOption || '—')}</code></dd></div>
            <div class="detail-row"><dt>DISUSER (disabled)</dt><dd>${u.vistaGrounding.disuser === true ? '<span class="badge badge-inactive">YES</span>' : u.vistaGrounding.disuser === false ? 'No' : '—'}</dd></div>
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
          <div>${u.roles.length ? u.roles.map(r => '<span class="badge badge-key" style="margin:2px">' + escapeHtml(r) + '</span>').join(' ') : '<span style="color:var(--color-text-muted)">No keys assigned</span>'}</div>
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
          <div class="context-value">${u.vistaGrounding.duz ?? '—'}</div>
          <div class="context-label">Status</div>
          <div class="context-value"><span class="badge ${u.status === 'active' ? 'badge-active' : 'badge-inactive'}">${escapeHtml(u.status)}</span></div>
          <div class="context-divider"></div>
          <div class="context-label">E-Sig</div>
          <div class="context-value"><span class="badge ${eSigBadgeClass}">${escapeHtml(eSig.status || 'unknown')}</span></div>
          <div class="context-label">Keys</div>
          <div class="context-value">${u.roles.length} assigned</div>
          <div class="context-divider"></div>
          <div class="context-label">Grounding</div>
          <div class="context-value"><span class="badge ${u.vistaGrounding.file200Status === 'grounded' ? 'badge-grounded' : 'badge-ungrounded'}">${escapeHtml(u.vistaGrounding.file200Status)}</span></div>
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

// ---------------------------------------------------------------------------
// Key Inventory
// ---------------------------------------------------------------------------
async function renderKeyInventory(el) {
  el.innerHTML = `
    <div class="page-header">
      <h1>Key Inventory</h1>
      <span class="source-posture fixture">Loading…</span>
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

  el.innerHTML = `
    <div class="page-header">
      <h1>Key Inventory</h1>
      <span class="source-posture fixture">FIXTURE</span>
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
      <span class="source-posture fixture">Loading…</span>
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

  el.innerHTML = `
    <div class="page-header">
      <h1>Electronic Signature Status</h1>
      <span class="source-posture fixture">FIXTURE</span>
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
  const workflows = [
    {
      id: 'add-user',
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
        'Verify creation: D ^XUP or check File 200 B-index',
      ],
      terminalCommand: 'docker exec -it vehu su - vehu -c "mumps -r ^XUP"',
      whyTerminal: 'VistA user creation requires multi-file coordination (200, 200.01, 8930.3) with MUMPS triggers. No safe write RPC exists for full user provisioning.',
    },
    {
      id: 'edit-user',
      title: 'Edit User Properties',
      description: 'Modify an existing user\'s status, division assignment, person class, or service/section.',
      vistaTarget: 'File 200 via ^DIE or VA Kernel menus',
      riskLevel: 'medium',
      steps: [
        'Open VistA terminal',
        'Navigate: EVE > User Management > Edit an Existing User',
        'Select user by name or DUZ',
        'Modify target field(s)',
        'Verify changes: read back from File 200',
      ],
      terminalCommand: 'docker exec -it vehu su - vehu -c "mumps -r ^XUP"',
      whyTerminal: 'User field edits involve FileMan cross-references and triggers that must execute within the MUMPS environment.',
    },
    {
      id: 'allocate-key',
      title: 'Allocate Security Key',
      description: 'Grant or revoke a security key (File 19.1) for a user. Keys control access to VistA menu options and RPCs.',
      vistaTarget: 'File 19.1 holders via ^XUSEC',
      riskLevel: 'high',
      steps: [
        'Open VistA terminal',
        'Navigate: EVE > Menu Management > Key Management > Allocation',
        'Select key name (e.g., PROVIDER, ORES, XUMGR)',
        'Select user to grant/revoke',
        'Confirm allocation',
        'Verify: check ^XUSEC(keyName,DUZ) exists',
      ],
      terminalCommand: 'docker exec -it vehu su - vehu -c "mumps -r ^XUP"',
      whyTerminal: 'Key allocation writes to the ^XUSEC global with FileMan-managed cross-references. Direct RPC writes risk index corruption.',
    },
    {
      id: 'manage-division',
      title: 'Manage Division Configuration',
      description: 'Add or modify a Medical Center Division (File 40.8) and link it to an Institution (File 4).',
      vistaTarget: 'File 40.8 via ^DG(40.8)',
      riskLevel: 'high',
      steps: [
        'Open VistA terminal',
        'Navigate: EVE > Systems Manager > Site Parameters',
        'Edit Medical Center Division file',
        'Set division name, institution pointer, facility number',
        'Verify: XUS DIVISION GET returns updated data',
      ],
      terminalCommand: 'docker exec -it vehu su - vehu -c "mumps -r ^XUP"',
      whyTerminal: 'Division configuration affects system-wide routing and is tightly coupled to Kernel site parameters.',
    },
    {
      id: 'manage-clinic',
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
        'Verify: ORWU CLINLOC returns the new clinic',
      ],
      terminalCommand: 'docker exec -it vehu su - vehu -c "mumps -r ^XUP"',
      whyTerminal: 'Clinic setup involves multiple File 44 sub-nodes and scheduling cross-references that require interactive FileMan entry.',
    },
    {
      id: 'setup-esig',
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
        'Verify: ORWU VALIDSIG returns confirmation for the user',
      ],
      terminalCommand: 'docker exec -it vehu su - vehu -c "mumps -r ^XUP"',
      whyTerminal: 'Electronic signature codes are hashed by VistA Kernel (ENCRYP^XUSRB1) and stored in File 200 field 20.4. The code must be entered interactively — it cannot be set via RPC. This is a VistA security design constraint.',
    },
    {
      id: 'deactivate-user',
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
        'Verify: user cannot authenticate via XUS SIGNON SETUP',
      ],
      terminalCommand: 'docker exec -it vehu su - vehu -c "mumps -r ^XUP"',
      whyTerminal: 'User deactivation involves DISUSER flag plus potential key revocation and signature code clearing. Multiple cross-referenced fields must be coordinated within VistA\'s FileMan transaction model.',
    },
  ];

  const riskColor = { high: '#dc2626', medium: '#d97706', low: '#059669' };

  const cards = workflows.map(w => `
    <div class="guided-task-card">
      <div class="guided-task-header">
        <h3>${escapeHtml(w.title)}</h3>
        <span class="risk-badge" style="background:${riskColor[w.riskLevel]};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;text-transform:uppercase">${escapeHtml(w.riskLevel)} risk</span>
      </div>
      <p class="guided-task-desc">${escapeHtml(w.description)}</p>
      <div class="guided-task-target">
        <strong>VistA target:</strong> ${escapeHtml(w.vistaTarget)}
      </div>
      <div class="guided-task-steps">
        <strong>Steps:</strong>
        <ol>${w.steps.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ol>
      </div>
      <div class="guided-task-terminal">
        <strong>Terminal entry point:</strong>
        <code class="terminal-cmd">${escapeHtml(w.terminalCommand)}</code>
      </div>
      <div class="guided-task-rationale">
        <em>${escapeHtml(w.whyTerminal)}</em>
      </div>
    </div>
  `).join('');

  el.innerHTML = `
    <div class="page-header">
      <h1>Guided Write Workflows</h1>
      <span class="source-posture terminal">TERMINAL</span>
    </div>
    <div class="guided-tasks-intro">
      <p><strong>VistA writes require terminal access.</strong> Direct web-based writes to VistA
      globals risk index corruption, missed cross-references, and audit gaps. These guided
      workflows document the exact terminal steps for each admin operation.</p>
      <p>Each card below shows: what VistA files are affected, the step-by-step terminal
      procedure, the Docker command to start, and why terminal-only is the safe path.</p>
    </div>
    <div class="guided-tasks-grid">
      ${cards}
    </div>`;
}
