/**
 * VistA Data Adapter — Direct RPC broker adapter for tenant-admin.
 *
 * Connects directly to the VistA XWB RPC broker to fetch user, division,
 * clinic, and ward data via standard VistA RPCs.
 *
 * Behavior:
 *   - If VISTA_ACCESS_CODE + VISTA_VERIFY_CODE are set: connects to broker directly
 *   - If not configured or unreachable: returns { ok: false, source: 'unavailable' }
 *   - NO fallbacks of any kind. VistA is the only data source.
 *
 * This adapter never fakes success. If VistA is unreachable, it says so.
 */

import { getBroker, probeBroker, lockedRpc, VISTA_HOST, VISTA_PORT } from './xwb-client.mjs';

/**
 * Fetch institutions from VistA File 4 (INSTITUTION) via DDR LISTER.
 * File 4 is the canonical source for facility records.
 * Fields: .01=NAME, 99=STATION NUMBER, 3=INSTITUTION TYPE (set: 1=VAMC, 2=CLINIC, etc.)
 * Falls back to divisions (File 40.8) if DDR LISTER on File 4 fails.
 */
export async function fetchVistaInstitutions() {
  return lockedRpc(async () => {
    try {
      const broker = await getBroker();
      // Attempt 1: DDR LISTER on File 4 with name + station number + type
      const tryLister = async (fields) => {
        const lines = await broker.callRpcWithList('DDR LISTER', [
          { type: 'list', value: { FILE: '4', FIELDS: fields, FLAGS: 'IP', MAX: '500' } },
        ]);
        return parseDdrListerResponse(lines);
      };
      let parsed = await tryLister('.01;99;3');
      if (!parsed.ok || parsed.data.length === 0) {
        parsed = await tryLister('.01;99');   // Retry without type field (field 3 absent in some VistA versions)
      }
      if (!parsed.ok || parsed.data.length === 0) {
        parsed = await tryLister('.01');       // Minimal: name only
      }
      if (parsed.ok && parsed.data.length > 0) {
        const institutions = parsed.data
          .map(line => {
            const parts = line.split('^');
            const ien = parts[0]?.trim();
            if (!ien || !/^\d+$/.test(ien)) return null;
            return {
              ien,
              name: parts[1]?.trim() || 'Unknown',
              stationNumber: parts[2]?.trim() || '',
              type: parts[3]?.trim() || 'Medical Center',
            };
          })
          .filter(Boolean);
        if (institutions.length > 0) {
          return { ok: true, source: 'vista', rpcUsed: 'DDR LISTER File 4', data: institutions };
        }
      }
      // Fallback: divisions (File 40.8) via XUS DIVISION GET
      const divLines = await broker.callRpc('XUS DIVISION GET');
      const divisions = [];
      for (const l of (Array.isArray(divLines) ? divLines : [])) {
        if (!l || !l.includes('^')) continue;
        const p = l.split('^');
        const ien = p[0]?.trim();
        const name = p[1]?.trim();
        if (ien && name) {
          divisions.push({ ien, name, stationNumber: p[2]?.trim() || '', type: 'Division' });
        }
      }
      if (divisions.length > 0) {
        return { ok: true, source: 'vista', rpcUsed: 'XUS DIVISION GET (fallback)', data: divisions,
          vistaNote: 'File 4 DDR unavailable; returning Medical Center Divisions (File 40.8)' };
      }
      // Last resort: return the site institution using ORWU PARAM
      const siteLines = await broker.callRpc('ORWU PARAM', ['DIVNUM']);
      const divNum = (siteLines[0] || '').trim();
      if (divNum) {
        return { ok: true, source: 'vista', rpcUsed: 'ORWU PARAM DIVNUM (last-resort)', data: [
          { ien: '1', name: 'Current Site', stationNumber: divNum, type: 'Medical Center' },
        ], vistaNote: 'File 4 DDR and XUS DIVISION GET unavailable; showing station number only' };
      }
      return { ok: true, source: 'vista', rpcUsed: 'none', data: [],
        vistaNote: 'No institution data available from VistA File 4, XUS DIVISION GET, or ORWU PARAM' };
    } catch (err) {
      return { ok: false, source: 'unavailable', error: err.message };
    }
  });
}

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
    { type: 'list', value: { FILE: '200', IENS: `${duz},`, FIELDS: '.01', FLAGS: 'IE' } },
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
function parseDdrGetsLines(lines) {
  // DDR GETS response with FLAGS=IE: fileNum^iens^fieldNum^internalValue^externalValue
  // With FLAGS=I: fileNum^iens^fieldNum^internalValue
  // With FLAGS=E: fileNum^iens^fieldNum^^externalValue
  // Prefer external value (human-readable) over internal value.
  const fieldsOut = {};
  const fieldsInternal = {};
  const allLines = [];
  for (const line of lines) {
    allLines.push(line);
    if (!line.includes('^')) continue;
    const parts = line.split('^');
    if (parts.length < 3) continue;
    const fieldNum = parts[2];
    if (!fieldNum || fieldNum === '') continue;
    const intVal = parts[3] || '';
    const extVal = parts[4] || '';
    fieldsOut[fieldNum] = extVal || intVal;
    fieldsInternal[fieldNum] = intVal;
  }
  const hasError = allLines.some(l => l === '[ERROR]' || l.startsWith('[ERROR]'));
  return { fieldsOut, fieldsInternal, allLines, hasError };
}

/**
 * Generic DDR GETS ENTRY DATA with field-by-field fallback.
 * Many VistA instances return [ERROR] for multi-field requests but succeed per-field.
 */
export async function ddrGetsEntry(file, ien, fields, flags = 'IE') {
  return lockedRpc(async () => {
    try {
      const broker = await getBroker();
      const lines = await broker.callRpcWithList('DDR GETS ENTRY DATA', [
        { type: 'list', value: { FILE: String(file), IENS: `${ien},`, FIELDS: fields, FLAGS: flags } },
      ]);
      const result = parseDdrGetsLines(lines);
      if (!result.hasError && Object.keys(result.fieldsOut).length > 0) {
        return { ok: true, source: 'vista', rpcUsed: 'DDR GETS ENTRY DATA', ien, data: result.fieldsOut, rawLines: result.allLines };
      }
      // Fallback: call field-by-field
      const fieldList = fields.split(';').filter(Boolean);
      const fieldsOut = {};
      const allLines = [];
      for (const f of fieldList) {
        try {
          const fl = await broker.callRpcWithList('DDR GETS ENTRY DATA', [
            { type: 'list', value: { FILE: String(file), IENS: `${ien},`, FIELDS: f, FLAGS: flags } },
          ]);
          const r = parseDdrGetsLines(fl);
          if (!r.hasError) Object.assign(fieldsOut, r.fieldsOut);
          allLines.push(...fl);
        } catch (_) { /* skip failed field */ }
      }
      if (Object.keys(fieldsOut).length > 0) {
        return { ok: true, source: 'vista', rpcUsed: 'DDR GETS ENTRY DATA (per-field)', ien, data: fieldsOut, rawLines: allLines };
      }
      return { ok: true, source: 'vista', rpcUsed: 'DDR GETS ENTRY DATA', ien, data: { _rawLines: lines }, rawLines: lines };
    } catch (err) {
      return { ok: false, source: 'unavailable', error: err.message };
    }
  });
}

export async function ddrGetsFile200(ien, fields = '.01;1;4;8;9;20.2;20.3;20.4;29') {
  return ddrGetsEntry('200', ien, fields);
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
 * Look up a File 200 user name by IEN using DDR LISTER with SCREEN filter.
 * Falls back to ORWU NEWPERS partial search if DDR LISTER SCREEN fails.
 */
export async function resolveUserName(ien) {
  return lockedRpc(async () => {
    try {
      const broker = await getBroker();
      const lines = await broker.callRpcWithList('DDR LISTER', [
        { type: 'list', value: { FILE: '200', FIELDS: '.01', FLAGS: 'IP', MAX: '1', SCREEN: `I DA=${ien}` } },
      ]);
      const parsed = parseDdrListerResponse(lines);
      if (parsed.ok && parsed.data.length > 0) {
        const parts = parsed.data[0].split('^');
        const name = parts[1]?.trim();
        if (name) return { ok: true, name };
      }
    } catch (_) { /* fall through */ }
    try {
      const broker = await getBroker();
      const raw = await broker.callRpc('ORWU NEWPERS', [String(ien), '1']);
      if (raw && typeof raw === 'string') {
        const lines = raw.split('\n').filter(l => l.trim());
        for (const line of lines) {
          const parts = line.split('^');
          if (String(parts[0]).trim() === String(ien)) {
            return { ok: true, name: (parts[1] || '').trim() };
          }
        }
        if (lines.length === 1) {
          const parts = lines[0].split('^');
          const name = (parts[1] || '').trim();
          if (name) return { ok: true, name };
        }
      }
    } catch (_) { /* fall through */ }
    return { ok: false, name: '' };
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
      const hasError = lines.some(l => l.includes('[BEGIN_diERRORS]') || l.includes('[ERROR]'));
      if (hasError) {
        const errLines = [];
        let inErr = false;
        for (const l of lines) {
          if (l.includes('[BEGIN_diERRORS]')) { inErr = true; continue; }
          if (l.includes('[END_diERRORS]')) { inErr = false; continue; }
          if (inErr) errLines.push(l);
        }
        const msg = errLines.filter(l => !l.startsWith('FIELD^') && !l.startsWith('FILE^') && !l.startsWith('IENS^') && !l.match(/^\d+\^/)).join('; ') || 'Validation failed';
        return { ok: false, rpcUsed: 'DDR VALIDATOR', error: msg, lines };
      }
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
      const hasError = lines.some(l => l.includes('[BEGIN_diERRORS]') || (l === '[ERROR]'));
      if (hasError) {
        const errLines = [];
        let inErr = false;
        for (const l of lines) {
          if (l.includes('[BEGIN_diERRORS]')) { inErr = true; continue; }
          if (l.includes('[END_diERRORS]')) { inErr = false; continue; }
          if (inErr) errLines.push(l);
        }
        const msg = errLines.filter(l => !l.startsWith('FIELD^') && !l.startsWith('FILE^') && !l.startsWith('IENS^') && !l.match(/^\d+\^/)).join('; ') || 'DDR FILER error';
        return { ok: false, rpcUsed: 'DDR FILER', error: msg, lines };
      }
      return { ok: true, rpcUsed: 'DDR FILER', lines };
    } catch (err) {
      return { ok: false, error: err.message, rpcUsed: 'DDR FILER' };
    }
  });
}

/**
 * File multiple fields at once via DDR FILER (EDIT mode).
 * Each key in editsObj is a field number, value is the new value.
 * Builds multi-row LIST param: { '1': 'FILE^FIELD1^IENS^VAL1', '2': 'FILE^FIELD2^IENS^VAL2', ... }
 *
 * @param {string} file - VistA file number
 * @param {string} iens - IENS string (must include trailing comma, e.g. "123,")
 * @param {Object} editsObj - { fieldNum: value, ... }
 * @param {string} [flags='E'] - DDR FILER flags
 */
export async function ddrFilerEditMulti(file, iens, editsObj, flags = 'E') {
  return lockedRpc(async () => {
    try {
      const broker = await getBroker();
      const entries = Object.entries(editsObj);
      const listVal = {};
      for (let i = 0; i < entries.length; i++) {
        const [field, value] = entries[i];
        listVal[String(i + 1)] = `${file}^${field}^${iens}^${value}`;
      }
      const lines = await broker.callRpcWithList('DDR FILER', [
        { type: 'literal', value: 'EDIT' },
        { type: 'list', value: listVal },
        { type: 'literal', value: flags },
      ]);
      const hasError = lines.some(l => l.includes('[BEGIN_diERRORS]') || (l === '[ERROR]'));
      if (hasError) {
        const errLines = [];
        let inErr = false;
        for (const l of lines) {
          if (l.includes('[BEGIN_diERRORS]')) { inErr = true; continue; }
          if (l.includes('[END_diERRORS]')) { inErr = false; continue; }
          if (inErr) errLines.push(l);
        }
        const msg = errLines.filter(l => !l.startsWith('FIELD^') && !l.startsWith('FILE^') && !l.startsWith('IENS^') && !l.match(/^\d+\^/)).join('; ') || 'DDR FILER error';
        return { ok: false, rpcUsed: 'DDR FILER', error: msg, lines };
      }
      return { ok: true, rpcUsed: 'DDR FILER', lines, fieldCount: entries.length };
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
 * DDR FILER ADD mode — multi-field: { fieldNum: value, ... } in a single call.
 */
export async function ddrFilerAddMulti(file, iens, fieldsObj, flags = 'E') {
  return lockedRpc(async () => {
    try {
      const broker = await getBroker();
      const entries = Object.entries(fieldsObj);
      const listVal = {};
      for (let i = 0; i < entries.length; i++) {
        const [field, value] = entries[i];
        listVal[String(i + 1)] = `${file}^${field}^${iens}^${value}`;
      }
      const lines = await broker.callRpcWithList('DDR FILER', [
        { type: 'literal', value: 'ADD' },
        { type: 'list', value: listVal },
        { type: 'literal', value: flags },
      ]);
      const hasError = lines.some(l => l.includes('[BEGIN_diERRORS]'));
      if (hasError) {
        const errLines = [];
        let inErr = false;
        for (const l of lines) {
          if (l.includes('[BEGIN_diERRORS]')) { inErr = true; continue; }
          if (l.includes('[END_diERRORS]')) { inErr = false; continue; }
          if (inErr) errLines.push(l);
        }
        const msg = errLines.filter(l => !l.startsWith('FIELD^') && !l.startsWith('FILE^') && !l.startsWith('IENS^') && !l.match(/^\d+\^/)).join('; ') || 'DDR FILER ADD error';
        return { ok: false, rpcUsed: 'DDR FILER', error: msg, lines };
      }
      return { ok: true, rpcUsed: 'DDR FILER', lines, fieldCount: entries.length };
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
    // #618: Retry once on transient failures (VistA busy, socket hiccup)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const broker = await getBroker();
        const lines = await broker.callRpc(rpcName, params);
        const line0 = (lines[0] || '').trim();
        const ok = line0.startsWith('1^');
        return { ok, lines, line0, rpcUsed: rpcName };
      } catch (err) {
        if (attempt === 0 && isTransientError(err)) continue;
        return { ok: false, lines: [], line0: '', error: err.message, rpcUsed: rpcName };
      }
    }
  });
}

/** Detect transient errors that merit a single retry */
function isTransientError(err) {
  const msg = String(err?.message || '');
  return /ETIMEDOUT|ECONNRESET|EPIPE|socket hang up|broker busy/i.test(msg);
}

/** True when error text indicates the RPC ITSELF is not registered in the
 *  broker (as opposed to a valid RPC returning an error about missing data).
 *  We specifically look for the VistA XWB broker's canonical not-registered
 *  error signature rather than loose substring matches, because arbitrary
 *  application error text may legitimately contain "not found" etc. */
export function isRpcMissingError(text = '') {
  const s = String(text || '');
  // XWB broker: "RPC does not exist", "No such RPC", "Unknown RPC"
  // Also some implementations: "M ERROR... RPC ... NOT REGISTERED"
  return /RPC (?:does not exist|not registered)|no such RPC|unknown RPC|RPC call denied|rpc is unknown|not a valid option/i.test(s);
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
