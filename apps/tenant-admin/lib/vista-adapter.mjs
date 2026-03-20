/**
 * VistA Data Adapter — HTTP-based adapter for tenant-admin VistA reads.
 *
 * Connects to a configured VistA API endpoint (e.g., the archive API on port 3001
 * or a future platform VistA gateway) to fetch user and security key data.
 *
 * Behavior:
 *   - If VISTA_API_URL is set and reachable: returns VistA-sourced data
 *   - If not configured or unreachable: returns { ok: false, source: 'unavailable' }
 *   - Caller is responsible for fixture fallback
 *
 * This adapter never fakes success. If VistA is unreachable, it says so.
 */

const VISTA_API_URL = process.env.VISTA_API_URL || '';
const VISTA_TIMEOUT_MS = parseInt(process.env.VISTA_TIMEOUT_MS || '5000', 10);

/**
 * Check whether VistA API is reachable.
 * @returns {{ ok: boolean, url: string, error?: string }}
 */
export async function probeVista() {
  if (!VISTA_API_URL) {
    return { ok: false, url: '', error: 'VISTA_API_URL not configured' };
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), VISTA_TIMEOUT_MS);
    const res = await fetch(`${VISTA_API_URL}/vista/ping`, { signal: controller.signal });
    clearTimeout(timer);
    const body = await res.json();
    return { ok: body.ok === true, url: VISTA_API_URL, vistaReachable: body.vista === 'reachable' };
  } catch (err) {
    return { ok: false, url: VISTA_API_URL, error: err.message };
  }
}

/**
 * Fetch user list from VistA via ORWU NEWPERS RPC (through API proxy).
 * The archive API exposes this via authenticated session.
 * For tenant-admin, we use a service-level call pattern.
 *
 * @param {string} searchText - Name search filter (empty string for all)
 * @returns {{ ok: boolean, source: string, data?: Array, error?: string }}
 */
export async function fetchVistaUsers(searchText = '') {
  if (!VISTA_API_URL) {
    return { ok: false, source: 'unavailable', error: 'VISTA_API_URL not configured' };
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), VISTA_TIMEOUT_MS);
    const url = `${VISTA_API_URL}/vista/user-list?search=${encodeURIComponent(searchText)}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      return { ok: false, source: 'vista-error', error: `HTTP ${res.status}` };
    }
    const body = await res.json();
    if (body.ok) {
      return { ok: true, source: 'vista', data: body.data || [] };
    }
    return { ok: false, source: 'vista-error', error: body.error || 'Unknown VistA error' };
  } catch (err) {
    return { ok: false, source: 'unavailable', error: err.message };
  }
}

/**
 * Check if a user holds a specific security key via ORWU HASKEY.
 *
 * @param {string} keyName - Security key name (e.g., "PROVIDER", "ORES")
 * @returns {{ ok: boolean, source: string, hasKey?: boolean, error?: string }}
 */
export async function checkVistaKey(keyName) {
  if (!VISTA_API_URL) {
    return { ok: false, source: 'unavailable', error: 'VISTA_API_URL not configured' };
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), VISTA_TIMEOUT_MS);
    const url = `${VISTA_API_URL}/vista/has-key?key=${encodeURIComponent(keyName)}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      return { ok: false, source: 'vista-error', error: `HTTP ${res.status}` };
    }
    const body = await res.json();
    return { ok: true, source: 'vista', hasKey: body.hasKey === true };
  } catch (err) {
    return { ok: false, source: 'unavailable', error: err.message };
  }
}

/**
 * Fetch current authenticated user info from VistA via XUS GET USER INFO.
 *
 * @returns {{ ok: boolean, source: string, data?: object, error?: string }}
 */
export async function fetchVistaCurrentUser() {
  if (!VISTA_API_URL) {
    return { ok: false, source: 'unavailable', error: 'VISTA_API_URL not configured' };
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), VISTA_TIMEOUT_MS);
    const url = `${VISTA_API_URL}/vista/current-user`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      return { ok: false, source: 'vista-error', error: `HTTP ${res.status}` };
    }
    const body = await res.json();
    if (body.ok) {
      return { ok: true, source: 'vista', data: body.data };
    }
    return { ok: false, source: 'vista-error', error: body.error || 'Unknown error' };
  } catch (err) {
    return { ok: false, source: 'unavailable', error: err.message };
  }
}
