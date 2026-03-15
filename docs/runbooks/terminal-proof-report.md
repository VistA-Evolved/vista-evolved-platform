# Terminal Proof Report — Browser Roll-and-Scroll against local-vista

> **Date:** 2026-03-12
> **Scope:** Prove an authentic browser-based roll-and-scroll terminal against the local-vista distro runtime. Minimum viable path only — no control-plane, no tenant admin, no broad UI migration.

---

## 1. Objective

Prove that:
1. A browser tab can open a live terminal to the local-vista VistA container
2. The connection uses WebSocket → SSH (the standard roll-and-scroll path)
3. Real VistA data is accessible through the terminal (MUMPS globals)
4. Keystrokes flow from the browser to YDB/MUMPS and output flows back

---

## 2. Files created (platform repo)

| File | Purpose |
|------|---------|
| `apps/terminal-proof/package.json` | Minimal NPM package (fastify, @fastify/websocket, @fastify/static, ssh2) |
| `apps/terminal-proof/.env` | SSH target config (host, port, user, password, server port) |
| `apps/terminal-proof/.gitignore` | Excludes `.env` and `node_modules` |
| `apps/terminal-proof/src/server.mjs` | Fastify backend: static files + WS-to-SSH bridge + health/sessions endpoints |
| `apps/terminal-proof/public/index.html` | Vanilla HTML + xterm.js 5.5.0 from CDN (no React, no build step) |

### Archive files inspected (read-only, NOT modified)

| File | What was learned |
|------|-----------------|
| `VistA-Evolved/apps/api/src/routes/ws-terminal.ts` | Production WS-to-SSH bridge pattern (auth, audit, session mgmt) |
| `VistA-Evolved/apps/web/src/components/terminal/VistaSshTerminal.tsx` | Production xterm.js React component (themes, reconnect, fit) |
| `vista-evolved-vista-distro/docker/local-vista/entrypoint.sh` | Container init: YDB env + SSH daemon + xinetd RPC broker |
| `vista-evolved-vista-distro/docker/local-vista/Dockerfile` | SSH user `vista:vista`, login shell at `/opt/vista/vista-login.sh` |

---

## 3. Architecture

```
Browser (xterm.js 5.5.0)
  │
  │  WebSocket ws://127.0.0.1:4400/ws/terminal
  │
  ▼
Fastify server (port 4400)
  │
  │  ssh2 TCP connection
  │
  ▼
local-vista container (port 2225 → 22)
  │
  │  SSH shell → /opt/vista/vista-login.sh
  │
  ▼
YDB direct mode (MUMPS prompt)
```

### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | Serves `public/index.html` (xterm.js terminal page) |
| GET | `/ws/terminal` | WebSocket upgrade → SSH bridge |
| GET | `/terminal/health` | SSH probe (creates temp connection, reports status) |
| GET | `/terminal/sessions` | Lists active terminal sessions |

---

## 4. Commands run (exact)

### Infrastructure verification

```powershell
docker ps --format "table {{.Names}}\t{{.Status}}" | Select-String "local-vista"
# Result: local-vista   Up 7 hours (healthy)
```

### Install and start

```powershell
cd c:\Users\kmoul\OneDrive\Documents\GitHub\vista-evolved-platform\apps\terminal-proof
npm install
# Result: 98 packages, 0 vulnerabilities

node --env-file=.env src/server.mjs
# Result: Server listening on http://0.0.0.0:4400
```

### Health and sessions

```powershell
curl.exe -s http://127.0.0.1:4400/terminal/health
# {"ok":true,"ssh":{"host":"127.0.0.1","port":2225,"status":"connected"},"activeSessions":0}

curl.exe -s http://127.0.0.1:4400/terminal/sessions
# {"ok":true,"sessions":[{"sessionId":"term-1773358325369-ot4fp3","connectedAt":"2026-03-12T23:32:05.369Z"}],"count":1}
```

### Browser terminal — MUMPS commands executed

```
W $$VERSION^DI
→ %YDB-E-INVOBJFILE ... CHSET=M different from $ZCHSET (non-blocking, see Risks)

W $S($D(^DIC)>0:"DIC EXISTS",1:"MISSING")
→ DIC EXISTS

W $S($D(^XWB(8994))>0:"RPC BROKER EXISTS",1:"MISSING")
→ RPC BROKER EXISTS

W $S($D(^VA(200))>0:"USER FILE EXISTS",1:"MISSING")
→ USER FILE EXISTS
```

---

## 5. Proof evidence

### 5a. Verified (PASS)

| # | Gate | Evidence |
|---|------|----------|
| 1 | Page loads in browser | Screenshot: xterm.js terminal renders, dark background, status UI visible |
| 2 | WebSocket connects to SSH | Screenshot: green "connected" dot, SSH Debian banner displayed, `vista@...` prompt |
| 3 | Keystrokes reach MUMPS | Screenshot: typed `W $S($D(^DIC)>0:"DIC EXISTS",1:"MISSING")` → output `DIC EXISTS` |
| 4 | Real VistA data accessible | `^DIC`, `^XWB(8994)`, `^VA(200)` all confirmed to exist — these are core VistA globals |
| 5 | Session lifecycle works | `/terminal/sessions` shows 1 active session; server logs show clean connect/disconnect/cleanup |
| 6 | Health endpoint confirms SSH reachable | `{"ok":true,"ssh":{"status":"connected"}}` |
| 7 | No npm audit vulnerabilities | `npm install` reported 0 vulnerabilities |

### 5b. Not yet verified (deferred to later phases)

| # | Area | Notes |
|---|------|-------|
| 1 | `D ^ZU` VistA sign-on menu | CHSET mismatch may block routine execution — needs investigation |
| 2 | Session auth/audit | Proof server has no session auth (intentional for proof-of-concept) |
| 3 | Copy/paste fidelity | Not tested in this proof |
| 4 | Terminal resize propagation | Code exists (`stream.setWindow`) but not explicitly tested in browser |
| 5 | Multi-session concurrency | Only single session tested |
| 6 | Production hardening | No rate limiting, no max sessions, no audit logging |

---

## 6. Known risks

### CHSET mismatch (non-blocking for proof, needs fix for production)

When calling `$$VERSION^DI`, YDB returns:
```
%YDB-E-INVOBJFILE, Cannot ZLINK object file /opt/vista/r/DI.o due to unexpected format
%YDB-I-TEXT, Object compiled with CHSET=M which is different from $ZCHSET
```

**Root cause:** The `.o` object files in the container were compiled with `CHSET=M` (byte mode), but the current session's `$ZCHSET` is set to `UTF-8`. YDB refuses to load stale object files compiled under a different character set.

**Impact:** Direct global access (`$D(^DIC)`) works fine. Routine calls (`$$VERSION^DI`, `D ^ZU`) may fail until object files are recompiled or `ydb_chset` is set to `M` in the container environment.

**Fix path:** In `docker/local-vista/entrypoint.sh` or the login shell, ensure `ydb_chset=M` before entering MUMPS, or recompile `.o` files with current CHSET. This is a distro-repo issue, not a terminal-proof issue.

---

## 7. Manual proof checklist

To reproduce this proof from scratch:

```powershell
# 1. Ensure local-vista is running
docker ps | Select-String "local-vista"
# Must show: local-vista ... (healthy)

# 2. Install and start terminal proof server
cd vista-evolved-platform/apps/terminal-proof
npm install
node --env-file=.env src/server.mjs

# 3. Verify health
curl.exe -s http://127.0.0.1:4400/terminal/health
# Must return: {"ok":true,"ssh":{"status":"connected"}}

# 4. Open browser
# Navigate to http://127.0.0.1:4400
# Expect: green dot, SSH banner, vista@... prompt

# 5. Type MUMPS commands
# Type: W $S($D(^DIC)>0:"OK",1:"FAIL")
# Press Enter
# Expect: OK

# 6. Check active sessions
curl.exe -s http://127.0.0.1:4400/terminal/sessions
# Must show count >= 1
```

---

## 8. What was NOT built (scoping discipline)

Per the governed build protocol, the following were intentionally excluded:

- No control-plane features
- No tenant admin UI
- No React components (vanilla HTML only)
- No build step / bundler / TypeScript
- No session authentication or RBAC
- No audit logging
- No VistA RPC broker calls (SSH only)
- No migration of archive assets (read-only reference only)

---

## 9. Next steps

1. **Fix CHSET mismatch** in `vista-evolved-vista-distro` — set `ydb_chset=M` in entrypoint or recompile `.o` files
2. **Test `D ^ZU`** — VistA roll-and-scroll sign-on menu after CHSET fix
3. **Add session auth** — port the session middleware pattern when control-plane is ready
4. **Migrate to React/xterm** — when `apps/admin-console` is scaffolded, port the proven pattern into a proper component
5. **Add audit logging** — every terminal session should be logged (who, when, duration)
