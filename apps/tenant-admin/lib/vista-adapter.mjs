/**
 * VistA Data Adapter — Direct RPC broker adapter for tenant-admin.
 *
 * Connects directly to the VistA XWB RPC broker to fetch user, division,
 * clinic, and ward data via standard VistA RPCs.
 *
 * Behavior:
 *   - If VISTA_ACCESS_CODE + VISTA_VERIFY_CODE are set: connects to broker directly
 *   - If not configured or unreachable: returns { ok: false, source: 'unavailable' }
 *   - Caller is responsible for fixture fallback
 *
 * This adapter never fakes success. If VistA is unreachable, it says so.
 */

import { getBroker, probeBroker, VISTA_HOST, VISTA_PORT } from './xwb-client.mjs';

/**
 * Check whether VistA broker is reachable.
 */
export async function probeVista() {
  const reachable = await probeBroker();
  if (!reachable) {
    return { ok: false, url: `${VISTA_HOST}:${VISTA_PORT}`, error: 'VistA broker unreachable' };
  }
  // Try to get a live broker connection
  try {
    const broker = await getBroker();
    return {
      ok: true,
      url: `${VISTA_HOST}:${VISTA_PORT}`,
      vistaReachable: true,
      duz: broker.duz,
      userName: broker.userName,
    };
  } catch (err) {
    return { ok: false, url: `${VISTA_HOST}:${VISTA_PORT}`, error: err.message };
  }
}

/**
 * Fetch user list from VistA via ORWU NEWPERS RPC.
 * Response format: IEN^NAME per line.
 *
 * @param {string} searchText - Name search filter
 */
export async function fetchVistaUsers(searchText = '') {
  try {
    const broker = await getBroker();
    // ORWU NEWPERS params: search text, direction flag (1=forward, -1=backward)
    // Empty FROM with direction=1 starts $ORDER from beginning of "AUSER" index
    const from = searchText || ' ';
    const lines = await broker.callRpc('ORWU NEWPERS', [from, '1']);
    const users = lines
      .filter(l => l.includes('^'))
      .map(l => {
        const parts = l.split('^');
        return {
          ien: parts[0]?.trim(),
          name: parts[1]?.trim() || 'Unknown',
        };
      })
      .filter(u => u.ien && u.ien !== '0');
    return { ok: true, source: 'vista', rpcUsed: 'ORWU NEWPERS', data: users };
  } catch (err) {
    return { ok: false, source: 'unavailable', error: err.message };
  }
}

/**
 * Check if the current user holds a specific security key via ORWU HASKEY.
 * Returns 1 if user has key, 0 if not.
 *
 * @param {string} keyName - Security key name (e.g., "PROVIDER", "ORES")
 */
export async function checkVistaKey(keyName) {
  try {
    const broker = await getBroker();
    const lines = await broker.callRpc('ORWU HASKEY', [keyName]);
    const hasKey = lines[0]?.trim() === '1';
    return { ok: true, source: 'vista', rpcUsed: 'ORWU HASKEY', hasKey };
  } catch (err) {
    return { ok: false, source: 'unavailable', error: err.message };
  }
}

/**
 * Fetch divisions via XUS DIVISION GET.
 * Response format: IEN^name^station^default per line.
 */
export async function fetchVistaDivisions() {
  try {
    const broker = await getBroker();
    const lines = await broker.callRpc('XUS DIVISION GET');
    const divisions = lines
      .filter(l => l.includes('^'))
      .map(l => {
        const parts = l.split('^');
        return {
          ien: parts[0]?.trim(),
          name: parts[1]?.trim() || 'Unknown Division',
          stationNumber: parts[2]?.trim() || '',
          isDefault: parts[3]?.trim() === '1',
        };
      })
      .filter(d => d.ien);
    return { ok: true, source: 'vista', rpcUsed: 'XUS DIVISION GET', data: divisions };
  } catch (err) {
    return { ok: false, source: 'unavailable', error: err.message };
  }
}

/**
 * Fetch clinic locations from VistA via ORWU CLINLOC.
 * Params: start text, direction flag.
 * Response format: IEN^NAME per line.
 *
 * @param {string} searchText - Name search filter
 */
export async function fetchVistaClinics(searchText = '') {
  try {
    const broker = await getBroker();
    // ORWU CLINLOC: search text, direction (1=forward)
    const lines = await broker.callRpc('ORWU CLINLOC', [searchText || '', '1']);
    const clinics = lines
      .filter(l => l.includes('^'))
      .map(l => {
        const parts = l.split('^');
        return {
          ien: parts[0]?.trim(),
          name: parts[1]?.trim() || 'Unknown Clinic',
        };
      })
      .filter(c => c.ien && c.ien !== '0');
    return { ok: true, source: 'vista', rpcUsed: 'ORWU CLINLOC', data: clinics };
  } catch (err) {
    return { ok: false, source: 'unavailable', error: err.message };
  }
}

/**
 * Fetch ward locations from VistA via ORQPT WARDS.
 * Response format: IEN^NAME per line.
 */
export async function fetchVistaWards() {
  try {
    const broker = await getBroker();
    const lines = await broker.callRpc('ORQPT WARDS');
    const wards = lines
      .filter(l => l.includes('^'))
      .map(l => {
        const parts = l.split('^');
        return {
          ien: parts[0]?.trim(),
          name: parts[1]?.trim() || 'Unknown Ward',
        };
      })
      .filter(w => w.ien && w.ien !== '0');
    return { ok: true, source: 'vista', rpcUsed: 'ORQPT WARDS', data: wards };
  } catch (err) {
    return { ok: false, source: 'unavailable', error: err.message };
  }
}

/**
 * Fetch current authenticated user info from VistA.
 * User info was already retrieved during connect() — return broker state.
 */
export async function fetchVistaCurrentUser() {
  try {
    const broker = await getBroker();
    return {
      ok: true,
      source: 'vista',
      data: {
        duz: broker.duz,
        userName: broker.userName,
      },
    };
  } catch (err) {
    return { ok: false, source: 'unavailable', error: err.message };
  }
}
