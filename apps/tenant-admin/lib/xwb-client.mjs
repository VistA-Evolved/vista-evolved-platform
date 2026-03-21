/**
 * XWB RPC Broker Client — Direct VistA connection for tenant-admin.
 *
 * Implements the standard XWB protocol used by CPRS and other VistA clients:
 *   TCPConnect → XUS SIGNON SETUP → XUS AV CODE → XWB CREATE CONTEXT → RPC calls
 *
 * This is a clean ESM extraction of the proven protocol from the VistA-Evolved
 * archive repo, stripped of dependencies. Uses only Node.js built-ins.
 *
 * Configuration via environment variables:
 *   VISTA_HOST (default: 127.0.0.1)
 *   VISTA_PORT (default: 9430)
 *   VISTA_ACCESS_CODE (required)
 *   VISTA_VERIFY_CODE (required)
 *   VISTA_CONTEXT (default: OR CPRS GUI CHART)
 *   VISTA_DEBUG (default: false)
 */

import { createConnection } from 'node:net';

// ---- Configuration -------------------------------------------------------

const VISTA_HOST = process.env.VISTA_HOST || '127.0.0.1';
const VISTA_PORT = parseInt(process.env.VISTA_PORT || '9430', 10);
const VISTA_ACCESS_CODE = process.env.VISTA_ACCESS_CODE || '';
const VISTA_VERIFY_CODE = process.env.VISTA_VERIFY_CODE || '';
const VISTA_CONTEXT = process.env.VISTA_CONTEXT || 'OR CPRS GUI CHART';
const TIMEOUT_MS = parseInt(process.env.VISTA_TIMEOUT_MS || '10000', 10);
const DEBUG = process.env.VISTA_DEBUG === 'true';

// ---- Constants -----------------------------------------------------------

const EOT = '\x04';
const PREFIX = '[XWB]';

// ---- Debug ---------------------------------------------------------------

function dbg(step, detail) {
  if (!DEBUG) return;
  const safe = detail ? String(detail).replace(/[\x00-\x03\x05-\x09\x0b\x0c\x0e-\x1f]/g, '.') : '';
  console.log(`[XWB] ${step}${safe ? ': ' + safe : ''}`);
}

// ---- XWB framing ---------------------------------------------------------

function sPack(s) {
  if (s.length > 255) throw new Error('sPack: string exceeds 255');
  return String.fromCharCode(s.length) + s;
}

function lPack(s) {
  return s.length.toString().padStart(3, '0') + s;
}

function buildTCPConnect(clientIP, callbackPort) {
  return (
    PREFIX + '10304' + sPack('TCPConnect') +
    '5' + '0' + lPack(clientIP) + 'f' +
    '0' + lPack(String(callbackPort)) + 'f' + EOT
  );
}

function buildRpcMessage(rpcName, params = []) {
  let msg = PREFIX + '11302' + '\x01' + '1' + sPack(rpcName);
  if (params.length === 0) {
    msg += '54f';
  } else {
    msg += '5';
    for (const p of params) {
      msg += '0' + lPack(p) + 'f';
    }
  }
  return msg + EOT;
}

/**
 * @typedef {{ type: 'literal'; value: string } | { type: 'list'; value: Record<string, string> }} RpcParam
 */

function encodeListKeyForMumps(key) {
  const trimmed = key.trim();
  if (!trimmed) return '""';
  if (trimmed.startsWith('"')) return trimmed;
  if (/^\d+(,\d+)*$/.test(trimmed)) return trimmed;
  const commaIndex = trimmed.indexOf(',');
  if (commaIndex === -1) return '"' + trimmed + '"';
  const head = trimmed.slice(0, commaIndex).trim();
  const tail = trimmed.slice(commaIndex);
  if (!head) return trimmed;
  return '"' + head + '"' + tail;
}

/**
 * RPC message with LIST-type params (DDR FILER, DDR GETS ENTRY DATA, DDR LISTER, etc.)
 */
function buildRpcMessageEx(rpcName, params) {
  let msg = PREFIX + '11302' + '\x01' + '1' + sPack(rpcName);
  if (params.length === 0) {
    msg += '54f';
  } else {
    msg += '5';
    for (const p of params) {
      if (p.type === 'literal') {
        msg += '0' + lPack(p.value) + 'f';
      } else {
        const entries = Object.entries(p.value);
        msg += '2';
        entries.forEach(([key, val], idx) => {
          const quotedKey = encodeListKeyForMumps(key);
          msg += lPack(quotedKey) + lPack(val);
          msg += idx < entries.length - 1 ? 't' : 'f';
        });
      }
    }
  }
  return msg + EOT;
}

function buildBye() {
  return PREFIX + '10304' + sPack('#BYE#') + EOT;
}

// ---- CipherPad encryption (ENCRYP^XUSRB1) -------------------------------

const CIPHER_PAD = [];
// Cipher pads loaded dynamically at startup from VistA or set below.
// These must match XUSRB1.m Z-tag pads in the target VistA instance.
// Extracted from local-vista-utf8 container 2026-03-22.
void function() {
  const raw = [
    "wkEo-ZJt!dG)49K{nX1BS$vH<&:Myf*>Ae0jQW=;|#PsO`'%+rmb[gpqN,l6/hFC@DcUa ]z~R}\"V\\iIxu?872.(TYL5_3",
    "rKv`R;M/9BqAF%&tSs#Vh)dO1DZP> *fX'u[.4lY=-mg_ci802N7LTG<]!CWo:3?{+,5Q}(@jaExn$~p\\IyHwzU\"|k6Jeb",
    "\\pV(ZJk\"WQmCn!Y,y@1d+~8s?[lNMxgHEt=uw|X:qSLjAI*}6zoF{T3#;ca)/h5%`P4$r]G'9e2if_>UDKb7<v0&- RBO.",
    "depjt3g4W)qD0V~NJar\\B \"?OYhcu[<Ms%Z`RIL_6:]AX-zG.#}$@vk7/5x&*m;(yb2Fn+l'PwUof1K{9,|EQi>H=CT8S!",
    "NZW:1}K$byP;jk)7'`x90B|cq@iSsEnu,(l-hf.&Y_?J#R]+voQXU8mrV[!p4tg~OMez CAaGFD6H53%L/dT2<*>\"{\\wI=",
    "vCiJ<oZ9|phXVNn)m K`t/SI%]A5qOWe\\&?;jT~M!fz1l>[D_0xR32c*4.P\"G{r7}E8wUgyudF+6-:B=$(sY,LkbHa#'@Q",
    "hvMX,'4Ty;[a8/{6l~F_V\"}qLI\\!@x(D7bRmUH]W15J%N0BYPkrs&9:$)Zj>u|zwQ=ieC-oGA.#?tfdcO3gp`S+En K2*<",
    "jd!W5[];4'<C$/&x|rZ(k{>?ghBzIFN}fAK\"#`p_TqtD*1E37XGVs@0nmSe+Y6Qyo-aUu%i8c=H2vJ\\) R:MLb.9,wlO~P",
    "2ThtjEM+!=xXb)7,ZV{*ci3\"8@_l-HS69L>]\\AUF/Q%:qD?1~m(yvO0e'<#o$p4dnIzKP|`NrkaGg.ufCRB[; sJYwW}5&",
    "vB\\5/zl-9y:Pj|=(R'7QJI *&CTX\"p0]_3.idcuOefVU#omwNZ`$Fs?L+1Sk<,b)hM4A6[Y%aDrg@~KqEW8t>H};n!2xG{",
    "sFz0Bo@_HfnK>LR}qWXV+D6`Y28=4Cm~G/7-5A\\b9!a#rP.l&M$hc3ijQk;),TvUd<[:I\"u1'NZSOw]*gxtE{eJp|y (?%",
    "M@,D}|LJyGO8`$*ZqH .j>c~h<d=fimszv[#-53F!+a;NC'6T91IV?(0x&/{B)w\"]Q\\YUWprk4:ol%g2nE7teRKbAPuS_X",
    ".mjY#_0*H<B=Q+FML6]s;r2:e8R}[ic&KA 1w{)vV5d,$u\"~xD/Pg?IyfthO@CzWp%!`N4Z'3-(o|J9XUE7k\\TlqSb>anG",
    "xVa1']_GU<X`|\\NgM?LS9{\"jT%s$}y[nvtlefB2RKJW~(/cIDCPow4,>#zm+:5b@06O3Ap8=*7ZFY!H-uEQk; .q)i&rhd",
    "I]Jz7AG@QX.\"%3Lq>METUo{Pp_ |a6<0dYVSv8:b)~W9NK`(r'4fs&wim\\kReC2hg=HOj$1B*/nxt,;c#y+![?lFuZ-5D}",
    "Rr(Ge6F Hx>q$m&C%M~Tn,:\"o'tX/*yP.{lZ!YkiVhuw_<KE5a[;}W0gjsz3]@7cI2\\QN?f#4p|vb1OUBD9)=-LJA+d`S8",
    "I~k>y|m};d)-7DZ\"Fe/Y<B:xwojR,Vh]O0Sc[`$sg8GXE!1&Qrzp._W%TNK(=J 3i*2abuHA4C'?Mv\\Pq{n#56LftUl@9+",
    "~A*>9 WidFN,1KsmwQ)GJM{I4:C%}#Ep(?HB/r;t.&U8o|l['Lg\"2hRDyZ5`nbf]qjc0!zS-TkYO<_=76a\\X@$Pe3+xVvu",
    "yYgjf\"5VdHc#uA,W1i+v'6|@pr{n;DJ!8(btPGaQM.LT3oe?NB/&9>Z`-}02*%x<7lsqz4OS ~E$\\R]KI[:UwC_=h)kXmF",
    "5:iar.{YU7mBZR@-K|2 \"+~`M%8sq4JhPo<_X\\Sg3WC;Tuxz,fvEQ1p9=w}FAI&j/keD0c?)LN6OHV]lGy'$*>nd[(tb!#",
  ];
  for (const p of raw) { if (p.length !== 94) throw new Error('Cipher pad length mismatch: ' + p.length); CIPHER_PAD.push(p); }
}();

function cipherEncrypt(text) {
  const assocIdx = Math.floor(Math.random() * 20) + 1;
  let idIdx = Math.floor(Math.random() * 20) + 1;
  if (idIdx === assocIdx) idIdx = (idIdx % 20) + 1;

  const assocStr = CIPHER_PAD[assocIdx - 1];
  const idStr = CIPHER_PAD[idIdx - 1];

  let s = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    const pos = idStr.indexOf(ch);
    s += pos === -1 ? ch : assocStr.charAt(pos);
  }
  return String.fromCharCode(idIdx + 31) + s + String.fromCharCode(assocIdx + 31);
}

// ---- Response helpers ----------------------------------------------------

function stripNulls(s) {
  let i = 0;
  while (i < s.length && s.charCodeAt(i) === 0) i++;
  return i > 0 ? s.substring(i) : s;
}

// ---- Broker connection class ---------------------------------------------

export class XwbBroker {
  #sock = null;
  #connected = false;
  #readBuf = '';
  #duz = '';
  #userName = '';

  get connected() { return this.#connected; }
  get duz() { return this.#duz; }
  get userName() { return this.#userName; }

  /** Send raw bytes to broker. */
  #rawSend(data) {
    return new Promise((resolve, reject) => {
      if (!this.#sock || this.#sock.destroyed) return reject(new Error('Socket closed'));
      this.#sock.write(Buffer.from(data, 'latin1'), (err) => {
        if (err) return reject(new Error('Send: ' + err.message));
        resolve();
      });
    });
  }

  /** Read from broker until EOT byte. */
  #readToEOT() {
    return new Promise((resolve, reject) => {
      if (!this.#sock || this.#sock.destroyed) return reject(new Error('Socket closed'));

      const existing = this.#readBuf.indexOf(EOT);
      if (existing !== -1) {
        const result = this.#readBuf.substring(0, existing);
        this.#readBuf = this.#readBuf.substring(existing + 1);
        return resolve(result);
      }

      const sock = this.#sock;
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Read timeout (${TIMEOUT_MS}ms)`));
      }, TIMEOUT_MS);

      const self = this;

      function onData(chunk) {
        self.#readBuf += chunk.toString('latin1');
        const i = self.#readBuf.indexOf(EOT);
        if (i !== -1) {
          cleanup();
          const result = self.#readBuf.substring(0, i);
          self.#readBuf = self.#readBuf.substring(i + 1);
          resolve(result);
        }
      }
      function onErr(e) { cleanup(); reject(new Error('Read: ' + e.message)); }
      function onClose() {
        cleanup();
        if (self.#readBuf.length > 0) {
          const r = self.#readBuf; self.#readBuf = '';
          resolve(r);
        } else {
          reject(new Error('Connection closed before response'));
        }
      }
      function cleanup() {
        clearTimeout(timer);
        sock.removeListener('data', onData);
        sock.removeListener('error', onErr);
        sock.removeListener('close', onClose);
      }

      sock.on('data', onData);
      sock.once('error', onErr);
      sock.once('close', onClose);
    });
  }

  /**
   * Connect, authenticate, and set context.
   * Sequence: TCP → TCPConnect → XUS SIGNON SETUP → XUS AV CODE → XWB CREATE CONTEXT
   */
  async connect(opts = {}) {
    const host = opts.host || VISTA_HOST;
    const port = opts.port || VISTA_PORT;
    const accessCode = opts.accessCode || VISTA_ACCESS_CODE;
    const verifyCode = opts.verifyCode || VISTA_VERIFY_CODE;
    const context = opts.context || VISTA_CONTEXT;

    if (!accessCode || !verifyCode) {
      throw new Error('Missing VistA credentials. Set VISTA_ACCESS_CODE and VISTA_VERIFY_CODE.');
    }

    if (this.#connected) return;

    // 1. TCP connect
    dbg('CONNECT', `${host}:${port}`);
    this.#sock = await new Promise((resolve, reject) => {
      const s = createConnection({ host, port });
      s.setKeepAlive(true, 30000);
      const timer = setTimeout(() => { s.destroy(); reject(new Error('TCP connect timeout')); }, TIMEOUT_MS);
      s.once('connect', () => { clearTimeout(timer); resolve(s); });
      s.once('error', (e) => { clearTimeout(timer); reject(new Error('TCP: ' + e.message)); });
    });
    this.#readBuf = '';

    this.#sock.once('close', () => { this.#connected = false; this.#readBuf = ''; });
    this.#sock.on('error', () => { this.#connected = false; this.#readBuf = ''; });

    // 2. TCPConnect handshake
    dbg('SEND', 'TCPConnect');
    await this.#rawSend(buildTCPConnect('127.0.0.1', 0));
    const tcpResp = stripNulls(await this.#readToEOT());
    dbg('RECV', tcpResp);
    if (!tcpResp.toLowerCase().includes('accept')) {
      throw new Error('TCPConnect rejected: ' + tcpResp);
    }

    // 3. XUS SIGNON SETUP
    dbg('SEND', 'XUS SIGNON SETUP');
    await this.#rawSend(buildRpcMessage('XUS SIGNON SETUP'));
    const setupResp = stripNulls(await this.#readToEOT());
    dbg('RECV SETUP', setupResp.substring(0, 200));

    // 4. XUS AV CODE
    dbg('SEND', 'XUS AV CODE');
    const avEnc = cipherEncrypt(accessCode + ';' + verifyCode);
    await this.#rawSend(buildRpcMessage('XUS AV CODE', [avEnc]));
    const avResp = stripNulls(await this.#readToEOT());
    dbg('RECV AV', avResp.substring(0, 200));

    const avLines = avResp.split(/\r?\n/);
    const duz = avLines[0]?.trim();
    if (!duz || duz === '0') {
      const reason = avLines[3]?.trim() || avLines[2]?.trim() || avLines[1]?.trim() || avResp;
      this.disconnect();
      throw new Error('Sign-on failed: ' + reason.replace(/[\x00-\x1f]/g, ' ').trim());
    }
    this.#duz = duz;
    dbg('SIGNED ON', `DUZ=${duz}`);

    // 5. XWB CREATE CONTEXT
    dbg('SEND', `XWB CREATE CONTEXT: ${context}`);
    const ctxEnc = cipherEncrypt(context);
    await this.#rawSend(buildRpcMessage('XWB CREATE CONTEXT', [ctxEnc]));
    const ctxResp = stripNulls(await this.#readToEOT());
    dbg('RECV CTX', ctxResp);

    const ctxVal = ctxResp.split(/\r?\n/)[0]?.trim();
    if (ctxVal !== '1') {
      this.disconnect();
      throw new Error('Set context failed: ' + ctxResp.replace(/[\x00-\x1f]/g, ' ').trim());
    }

    // 6. Get user info
    dbg('SEND', 'XUS GET USER INFO');
    await this.#rawSend(buildRpcMessage('XUS GET USER INFO'));
    const userResp = stripNulls(await this.#readToEOT());
    dbg('RECV USER', userResp.substring(0, 200));
    const userLines = userResp.split(/\r?\n/);
    this.#userName = userLines[1]?.trim() || 'Unknown';

    this.#connected = true;
    dbg('READY', `Broker ready. User: ${this.#userName} (DUZ=${this.#duz})`);
  }

  /** Call an RPC with literal string parameters. Returns array of lines. */
  async callRpc(rpcName, params = []) {
    if (!this.#connected || !this.#sock || this.#sock.destroyed) {
      throw new Error('Not connected. Call connect() first.');
    }
    dbg('RPC', `${rpcName} params=[${params.map(p => p.length > 30 ? p.substring(0, 30) + '...' : p).join(', ')}]`);
    await this.#rawSend(buildRpcMessage(rpcName, params));
    const resp = stripNulls(await this.#readToEOT());
    dbg('RESP', resp.substring(0, 300));
    return resp.split(/\r?\n/).filter(l => l.length > 0);
  }

  /**
   * Call an RPC with mixed literal + LIST parameters (FileMan DDR family, ORWDAL32, etc.).
   * @param {string} rpcName
   * @param {RpcParam[]} params
   * @returns {Promise<string[]>}
   */
  async callRpcWithList(rpcName, params = []) {
    if (!this.#connected || !this.#sock || this.#sock.destroyed) {
      throw new Error('Not connected. Call connect() first.');
    }
    dbg('RPC-LIST', rpcName);
    await this.#rawSend(buildRpcMessageEx(rpcName, params));
    const resp = stripNulls(await this.#readToEOT());
    dbg('RESP', resp.substring(0, 300));
    return resp.split(/\r?\n/).filter(l => l.length > 0);
  }

  /** Disconnect from broker. */
  disconnect() {
    if (this.#sock && !this.#sock.destroyed) {
      try { this.#sock.write(Buffer.from(buildBye(), 'latin1')); } catch { /* best effort */ }
      this.#sock.destroy();
    }
    this.#sock = null;
    this.#connected = false;
    this.#readBuf = '';
    this.#duz = '';
    this.#userName = '';
  }
}

// ---- Async mutex for broker serialization --------------------------------

let _lockQueue = Promise.resolve();

function withBrokerLock(fn) {
  let release;
  const next = new Promise(res => { release = res; });
  const wait = _lockQueue;
  _lockQueue = next;
  return wait.then(() => fn().finally(release));
}

// ---- Singleton broker instance -------------------------------------------

let _broker = null;

/**
 * Get or create the singleton broker connection.
 * Automatically connects if not already connected.
 */
export async function getBroker() {
  if (_broker && _broker.connected) return _broker;
  if (_broker) { _broker.disconnect(); }
  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      _broker = new XwbBroker();
      await _broker.connect();
      return _broker;
    } catch (err) {
      const msg = err.message || '';
      const isCipherIssue = /not a valid access|cipher|garbled/i.test(msg);
      if (isCipherIssue && attempt < MAX_RETRIES) {
        dbg('RETRY', `Cipher pad issue on attempt ${attempt}, retrying...`);
        try { _broker.disconnect(); } catch {}
        _broker = null;
        await new Promise(r => setTimeout(r, 500 * attempt));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Failed to connect after ' + MAX_RETRIES + ' attempts');
}

/**
 * Execute an RPC call under the broker mutex.
 * Prevents concurrent TCP socket corruption.
 */
export function lockedRpc(fn) {
  return withBrokerLock(fn);
}

/**
 * Quick TCP probe — checks if broker port is reachable without authentication.
 */
export async function probeBroker(host, port, timeoutMs = 3000) {
  const h = host || VISTA_HOST;
  const p = port || VISTA_PORT;
  return new Promise((resolve) => {
    const s = createConnection({ host: h, port: p });
    const timer = setTimeout(() => { s.destroy(); resolve(false); }, timeoutMs);
    s.once('connect', () => { clearTimeout(timer); s.end(); resolve(true); });
    s.once('error', () => { clearTimeout(timer); resolve(false); });
  });
}

/** Disconnect the singleton broker (for graceful shutdown). */
export function disconnectBroker() {
  if (_broker) { _broker.disconnect(); _broker = null; }
}

export { VISTA_HOST, VISTA_PORT };
