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

import { getBroker, probeBroker, lockedRpc, VISTA_HOST, VISTA_PORT } from './xwb-client.mjs';

/**
 * Check whether VistA broker is reachable.
 */
export async function probeVista() {
  const reachable = await probeBroker();
  if (!reachable) {
    return { ok: false, url: `${VISTA_HOST}:${VISTA_PORT}`, error: 'VistA broker unreachable' };
  }
  return lockedRpc(async () => {
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
  });
}

/**
 * Fetch user list from VistA via ORWU NEWPERS RPC.
 * Response format: IEN^NAME per line.
 *
 * @param {string} searchText - Name search filter
 */
export async function fetchVistaUsers(searchText = '') {
  return lockedRpc(async () => {
    try {
      const broker = await getBroker();
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
  });
}

/**
 * Check if the current user holds a specific security key via ORWU HASKEY.
 * Returns 1 if user has key, 0 if not.
 *
 * @param {string} keyName - Security key name (e.g., "PROVIDER", "ORES")
 */
export async function checkVistaKey(keyName) {
  return lockedRpc(async () => {
    try {
      const broker = await getBroker();
      const lines = await broker.callRpc('ORWU HASKEY', [keyName]);
      const hasKey = lines[0]?.trim() === '1';
      return { ok: true, source: 'vista', rpcUsed: 'ORWU HASKEY', hasKey };
    } catch (err) {
      return { ok: false, source: 'unavailable', error: err.message };
    }
  });
}

/**
 * Fetch divisions via XUS DIVISION GET.
 * Response format: IEN^name^station^default per line.
 */
export async function fetchVistaDivisions() {
  return lockedRpc(async () => {
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
  });
}

/**
 * Fetch clinic locations from VistA via ORWU CLINLOC.
 * Params: start text, direction flag.
 * Response format: IEN^NAME per line.
 *
 * @param {string} searchText - Name search filter
 */
export async function fetchVistaClinics(searchText = '') {
  return lockedRpc(async () => {
    try {
      const broker = await getBroker();
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
  });
}

/**
 * Fetch ward locations from VistA via ORQPT WARDS.
 * Response format: IEN^NAME per line.
 */
export async function fetchVistaWards() {
  return lockedRpc(async () => {
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
  });
}

/**
 * Fetch current authenticated user info from VistA.
 * User info was already retrieved during connect() — return broker state.
 */
export async function fetchVistaCurrentUser() {
  return lockedRpc(async () => {
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
  });
}

/** Classify DDR / RPC probe outcome from response lines or error text. */
export function classifyDdrOutcome(lines, errMsg = '') {
  const text = errMsg || lines.join('\n').toLowerCase();
  if (/does not exist|not registered|unknown rpc|no such rpc/i.test(text)) {
    return { status: 'missing', detail: text.slice(0, 500) };
  }
  if (/parameter|wrong number|invalid|required/i.test(text) && lines.length < 3) {
    return { status: 'param_mismatch', detail: text.slice(0, 500) };
  }
  return { status: 'callable', detail: lines.slice(0, 5).join(' | ').slice(0, 500) };
}

/**
 * Parse DDR LISTER response using [BEGIN_diDATA]/[END_diDATA] markers.
 * Returns { ok, data: string[], errors: string[] }.
 * The data array contains only lines between the markers that have ^ delimiters.
 * If [BEGIN_diERRORS] is present, extracts error text.
 */
export function parseDdrListerResponse(lines) {
  const data = [];
  const errors = [];
  let inData = false;
  let inErrors = false;

  for (const line of lines) {
    if (line.includes('[BEGIN_diDATA]')) { inData = true; continue; }
    if (line.includes('[END_diDATA]')) { inData = false; continue; }
    if (line.includes('[BEGIN_diERRORS]')) { inErrors = true; continue; }
    if (line.includes('[END_diERRORS]')) { inErrors = false; continue; }
    if (inData && line.includes('^')) {
      data.push(line);
    }
    if (inErrors && line.length > 0) {
      errors.push(line);
    }
  }

  if (errors.length > 0) {
    const errText = errors.join(' | ');
    return { ok: false, data: [], errors, errorText: errText };
  }

  if (!lines.some(l => l.includes('[BEGIN_diDATA]'))) {
    const fallback = lines.filter(l => {
      if (!l.includes('^')) return false;
      if (l.startsWith('[')) return false;
      const ien = l.split('^')[0]?.trim();
      return ien && /^\d+$/.test(ien);
    });
    return { ok: fallback.length > 0, data: fallback, errors: [], errorText: fallback.length === 0 ? 'No [BEGIN_diDATA] marker and no parseable data lines' : '' };
  }

  return { ok: true, data, errors: [], errorText: '' };
}

/**
 * Probe DDR-related RPCs (availability in File 8994 + application context).
 * Uses a harmless read (DDR GETS on File 200 .01) where possible.
 */
export async function probeDdrRpcFamily() {
  return lockedRpc(async () => {
  const results = [];
  const broker = await getBroker();
  const duz = broker.duz || '1';

  const tryRpc = async (name, params) => {
    try {
      const lines = await broker.callRpcWithList(name, params);
      const c = classifyDdrOutcome(lines);
      results.push({
        rpc: name,
        outcome: c.status === 'callable' ? 'available' : c.status,
        sample: lines.slice(0, 8),
        detail: c.detail,
      });
    } catch (e) {
      const c = classifyDdrOutcome([], e.message);
      results.push({
        rpc: name,
        outcome: c.status === 'missing' ? 'missing' : 'error',
        sample: [],
        detail: e.message,
      });
    }
  };

  await tryRpc('DDR GETS ENTRY DATA', [
    { type: 'list', value: { FILE: '200', IENS: `${duz},`, FIELDS: '.01' } },
  ]);

  await tryRpc('DDR VALIDATOR', [
    {
      type: 'list',
      value: { FILE: '200', IENS: `${duz},`, FIELD: '.01', VALUE: broker.userName || 'TEST' },
    },
  ]);

  await tryRpc('DDR LISTER', [
    { type: 'list', value: { FILE: '19.1', FIELDS: '.01', FLAGS: 'IP' } },
  ]);

  await tryRpc('DDR FIND1', [
    {
      type: 'list',
      value: { FILE: '200', VALUE: broker.userName || 'PROGRAMMER,ONE', FLAGS: 'X' },
    },
  ]);

  for (const rpc of ['DDR FILER', 'DDR DELETE ENTRY', 'DDR LOCK NODE', 'DDR UNLOCK NODE']) {
    results.push({
      rpc,
      outcome: 'not_probed',
      sample: [],
      detail:
        'Requires explicit LIST/file context; exercise via tenant-admin write routes or scripts/ddr-tenant-admin-proof.mjs after DDR GETS/VALIDATOR passes',
    });
  }

  const available = results.filter(r => r.outcome === 'available').length;
  return {
    ok: true,
    rpcUsed: 'DDR family probe',
    duz,
    results,
    summary: { total: results.length, likelyAvailable: available },
  };
  });
}

/**
 * Read File 200 fields for a user via DDR GETS ENTRY DATA.
 * @param {string} ien - File 200 IEN
 * @param {string} fields - Semicolon-separated field numbers (e.g. ".01;1;4;8;20.2;20.3;20.4")
 */
export async function ddrGetsFile200(ien, fields = '.01;1;4;8;9;20.2;20.3;20.4;29') {
  return lockedRpc(async () => {
    try {
      const broker = await getBroker();
      const lines = await broker.callRpcWithList('DDR GETS ENTRY DATA', [
        { type: 'list', value: { FILE: '200', IENS: `${ien},`, FIELDS: fields } },
      ]);
      const fieldsOut = {};
      for (const line of lines) {
        if (!line.includes('^')) continue;
        const parts = line.split('^');
        const fn = parts[1] || parts[0];
        if (fn) fieldsOut[String(fn).replace(/^200,/, '')] = parts.slice(2).join('^') || parts[parts.length - 1];
      }
      if (lines.length && Object.keys(fieldsOut).length === 0) {
        fieldsOut._rawLines = lines;
      }
      return { ok: true, source: 'vista', rpcUsed: 'DDR GETS ENTRY DATA', ien, data: fieldsOut, rawLines: lines };
    } catch (err) {
      return { ok: false, source: 'unavailable', error: err.message };
    }
  });
}

/**
 * List security keys (File 19.1) via DDR LISTER.
 * File 19.1 field .01 = NAME. Field 2 does NOT exist in standard VistA DD.
 * Some distro builds may not have File 19.1 populated at all.
 */
export async function ddrListerSecurityKeys() {
  return lockedRpc(async () => {
    try {
      const broker = await getBroker();
      const lines = await broker.callRpcWithList('DDR LISTER', [
        { type: 'list', value: { FILE: '19.1', FIELDS: '.01', FLAGS: 'IP', MAX: '999' } },
      ]);
      const parsed = parseDdrListerResponse(lines);
      if (!parsed.ok) {
        return {
          ok: false,
          source: 'vista',
          rpcUsed: 'DDR LISTER',
          data: [],
          error: parsed.errorText || 'DDR LISTER returned no data for File 19.1',
          ddrErrors: parsed.errors,
          rawLines: lines,
          vistaNote: 'File 19.1 (SECURITY KEY) may not be populated in this VistA instance. Keys are assigned via ^XUSEC.',
        };
      }
      const keys = [];
      for (const line of parsed.data) {
        const p = line.split('^');
        const ien = p[0]?.trim();
        if (!ien || !/^\d+$/.test(ien)) continue;
        keys.push({ ien, name: p[1]?.trim() || '' });
      }
      return { ok: true, source: 'vista', rpcUsed: 'DDR LISTER', data: keys, rawLines: lines };
    } catch (err) {
      return { ok: false, source: 'unavailable', error: err.message };
    }
  });
}

/**
 * Validate a field value before filing (DDR VALIDATOR).
 */
export async function ddrValidateField(file, iens, field, value) {
  return lockedRpc(async () => {
    try {
      const broker = await getBroker();
      const lines = await broker.callRpcWithList('DDR VALIDATOR', [
        { type: 'list', value: { FILE: String(file), IENS: iens, FIELD: String(field), VALUE: value } },
      ]);
      return { ok: true, rpcUsed: 'DDR VALIDATOR', lines };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}

/**
 * File a single field via DDR FILER (EDIT mode). DDRROOT rows: FILE^FIELD^IENS^VALUE
 */
export async function ddrFilerEdit(file, iens, field, value, flags = 'E') {
  return lockedRpc(async () => {
    try {
      const broker = await getBroker();
      const row = `${file}^${field}^${iens}^${value}`;
      const lines = await broker.callRpcWithList('DDR FILER', [
        { type: 'literal', value: 'EDIT' },
        { type: 'list', value: { '1': row } },
        { type: 'literal', value: flags },
      ]);
      return { ok: true, rpcUsed: 'DDR FILER', lines };
    } catch (err) {
      return { ok: false, error: err.message, rpcUsed: 'DDR FILER' };
    }
  });
}

/**
 * DDR FILER ADD mode — single DDRROOT row FILE^FIELD^IENS^VALUE (often +1, for new IEN).
 */
export async function ddrFilerAdd(file, field, iens, value, flags = 'E') {
  return lockedRpc(async () => {
    try {
      const broker = await getBroker();
      const row = `${file}^${field}^${iens}^${value}`;
      const lines = await broker.callRpcWithList('DDR FILER', [
        { type: 'literal', value: 'ADD' },
        { type: 'list', value: { '1': row } },
        { type: 'literal', value: flags },
      ]);
      return { ok: true, rpcUsed: 'DDR FILER', lines };
    } catch (err) {
      return { ok: false, error: err.message, rpcUsed: 'DDR FILER' };
    }
  });
}

/**
 * Call a distro-registered ZVE* remote procedure with literal string params (matches callRpc).
 * Returns ok when first line starts with 1^
 */
export async function callZveRpc(rpcName, params = []) {
  return lockedRpc(async () => {
    try {
      const broker = await getBroker();
      const lines = await broker.callRpc(rpcName, params);
      const line0 = (lines[0] || '').trim();
      const ok = line0.startsWith('1^');
      return { ok, lines, line0, rpcUsed: rpcName };
    } catch (err) {
      return { ok: false, lines: [], line0: '', error: err.message, rpcUsed: rpcName };
    }
  });
}

/** True when error text indicates RPC is not registered / missing. */
export function isRpcMissingError(text = '') {
  return /does not exist|not registered|unknown rpc|no such rpc/i.test(String(text));
}

/** Build e-sig summary for users returned by ORWU NEWPERS (sequential DDR GETS). */
export async function fetchVistaEsigStatusForUsers(users, maxProbe = 80) {
  const slice = users.slice(0, maxProbe);
  const rows = [];
  for (const u of slice) {
    const g = await ddrGetsFile200(u.ien, '20.2;20.3;20.4');
    if (!g.ok) {
      rows.push({
        ien: u.ien,
        name: u.name,
        source: 'unavailable',
        error: g.error,
      });
      continue;
    }
    const d = g.data;
    const hasCode = Boolean(
      d['20.4'] || d[20.4] || (g.rawLines || []).some(l => /20\.4/.test(l) && l.length > 4)
    );
    rows.push({
      ien: u.ien,
      name: u.name,
      hasCode,
      sigBlockName: d['20.2'] || d[20.2] || null,
      sigBlockTitle: d['20.3'] || d[20.3] || null,
      source: 'vista',
    });
  }
  return { ok: true, source: 'vista', data: rows, rpcUsed: 'DDR GETS ENTRY DATA', probed: slice.length };
}
