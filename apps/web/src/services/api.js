/**
 * VistA Evolved API Client
 *
 * Two backend targets:
 *   /api/ta/v1/* -> tenant-admin server (VistA XWB/DDR, port 4520)
 *   /api/op/v1/* -> control-plane-api (Postgres, port 4510)
 *
 * Vite dev server proxies both. In production, reverse proxy handles routing.
 *
 * Authentication: httpOnly secure cookie set by server on POST /auth/login.
 * CSRF token kept in module-scope memory only. No tokens in sessionStorage.
 */

// S5.1: Session token is now in httpOnly cookie — never stored in JS.
// S5.2: CSRF token kept in module-scope memory only (survives within SPA
// session but not across full page reloads — re-fetched via getSession).
let _csrfToken = null;
let _authenticated = false; // tracks if user has logged in during this SPA session

export function setSessionToken(_token) {
  // S5.1: Session token lives in httpOnly cookie set by server.
  // This function now manages the in-memory auth flag only.
  _authenticated = Boolean(_token);
}

export function setCsrfToken(token) {
  _csrfToken = token || null;
  if (token) _authenticated = true; // CSRF token implies successful login
}

export function getSessionToken() {
  // S5.1: Returns auth status flag (not the actual token).
  // The real token travels in httpOnly cookie automatically.
  return _authenticated ? 'httponly-cookie' : null;
}

export function getCsrfToken() {
  return _csrfToken;
}

class ApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = 'ApiError';
  }
}

async function request(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };

  // S5.1: Session token travels in httpOnly cookie — no Authorization header needed.
  // Cookie is sent automatically because credentials: 'include' is set below.

  // S7.5: Include CSRF token in mutating requests
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrf = getCsrfToken();
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }

  // X002: Configurable API timeout — default 30 seconds
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  const options = { method, headers, credentials: 'include', signal: controller.signal };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const url = method === 'GET' && body
    ? `${path}?${new URLSearchParams(body).toString()}`
    : path;

  let res;
  try {
    res = await fetch(url, options);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new ApiError('TIMEOUT', 'Request timed out after 30 seconds. The server may be busy — please try again.', 408);
    }
    // S7.1: Show connection-lost toast for network errors
    showConnectionToast('Connection lost — your progress is saved. Please check your network and try again.');
    throw new ApiError('NETWORK', 'Unable to connect to the server. Please check your connection.', 0);
  }
  clearTimeout(timeoutId);

  if (res.status === 401) {
    const text401 = await res.text();
    let json401;
    try {
      json401 = JSON.parse(text401);
    } catch (_parseErr) {
      json401 = null;
    }
    // Failed sign-in returns 401 with ok:false — do not treat as session expiry / redirect loop
    const isLoginFailure =
      path.includes('/auth/login') && json401 && json401.ok === false;
    if (isLoginFailure) {
      throw new ApiError(
        json401.code || 'UNKNOWN',
        json401.error || json401.message || 'Authentication failed',
        401
      );
    }

    setSessionToken(null);
    // X005: Preserve current page so login can redirect back after re-auth
    const currentPath = window.location.pathname + window.location.search;
    if (currentPath && currentPath !== '/login') {
      sessionStorage.setItem('ve-return-to', currentPath);
    }
    window.location.href = '/login';
    throw new ApiError('SESSION_EXPIRED', 'Your session has expired. Please sign in again.', 401);
  }

  if (res.status === 204) return { ok: true };

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (parseErr) {
    if (!res.ok) throw new ApiError('NON_JSON', text || `HTTP ${res.status}`, res.status);
    return { ok: true, raw: text };
  }

  if (json.status === 'error' || json.ok === false) {
    throw new ApiError(json.code || 'UNKNOWN', json.error || json.message || 'An error occurred', res.status);
  }

  return json;
}

export const tenantApi = {
  get:    (path, params) => request('GET', `/api/ta/v1${path}`, params),
  post:   (path, body)   => request('POST', `/api/ta/v1${path}`, body),
  put:    (path, body)   => request('PUT', `/api/ta/v1${path}`, body),
  patch:  (path, body)   => request('PATCH', `/api/ta/v1${path}`, body),
  delete: (path)         => request('DELETE', `/api/ta/v1${path}`),
};

export const operatorApi = {
  get:    (path, params) => request('GET', `/api/op/v1${path}`, params),
  post:   (path, body)   => request('POST', `/api/op/v1${path}`, body),
  put:    (path, body)   => request('PUT', `/api/op/v1${path}`, body),
  patch:  (path, body)   => request('PATCH', `/api/op/v1${path}`, body),
  delete: (path)         => request('DELETE', `/api/op/v1${path}`),
};

export { ApiError };

// S7.1: Lightweight DOM-based connection toast (no React dependency)
let _toastEl = null;
let _toastTimer = null;
function showConnectionToast(msg) {
  if (_toastEl) { clearTimeout(_toastTimer); _toastEl.remove(); }
  _toastEl = document.createElement('div');
  _toastEl.setAttribute('role', 'alert');
  _toastEl.setAttribute('aria-live', 'assertive');
  _toastEl.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1A1A2E;color:#fff;padding:12px 24px;border-radius:8px;font-size:14px;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,.3);display:flex;align-items:center;gap:8px;max-width:500px';
  _toastEl.innerHTML = `<span style="font-size:20px">&#9888;</span><span>${msg.replace(/</g, '&lt;')}</span>`;
  document.body.appendChild(_toastEl);
  _toastTimer = setTimeout(() => { if (_toastEl) { _toastEl.remove(); _toastEl = null; } }, 8000);
}
