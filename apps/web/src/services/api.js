/**
 * VistA Evolved API Client
 *
 * Two backend targets:
 *   /api/ta/v1/* -> tenant-admin server (VistA XWB/DDR, port 4520)
 *   /api/op/v1/* -> control-plane-api (Postgres, port 4510)
 *
 * Vite dev server proxies both. In production, reverse proxy handles routing.
 *
 * Authentication: Bearer token stored in sessionStorage after login.
 * The tenant-admin backend issues a session token on POST /auth/login.
 */

const TOKEN_KEY = 've-session-token';

export function setSessionToken(token) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

export function getSessionToken() {
  return sessionStorage.getItem(TOKEN_KEY);
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

  const token = getSessionToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const options = { method, headers, credentials: 'include' };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const url = method === 'GET' && body
    ? `${path}?${new URLSearchParams(body).toString()}`
    : path;

  const res = await fetch(url, options);

  if (res.status === 401) {
    setSessionToken(null);
    window.location.href = '/login';
    throw new ApiError('SESSION_EXPIRED', 'Your session has expired. Please sign in again.', 401);
  }

  if (res.status === 204) return { ok: true };

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    if (!res.ok) throw new ApiError('NON_JSON', text || `HTTP ${res.status}`, res.status);
    return { ok: true, raw: text };
  }

  if (json.status === 'error' || json.ok === false) {
    throw new ApiError(json.code || 'UNKNOWN', json.message || 'An error occurred', res.status);
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
