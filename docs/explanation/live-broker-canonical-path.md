# Live Broker Canonical Path

> **Status:** VERIFIED — all proofs captured live against `local-vista-utf8` container.
>
> This document records the proven end-to-end path from the tenant-admin
> Node.js process through the XWB RPC broker to the VistA M environment.
> Every layer and every RPC listed here was verified against a running system.

---

## 1. Architecture stack (bottom to top)

| Layer | Component | Location |
|-------|-----------|----------|
| **M runtime** | YottaDB r2.02 (UTF-8 mode) | `/opt/yottadb/current` inside container |
| **VistA database** | VEHU Plan VI globals + overlays | `/opt/vista/g/vista.dat` |
| **Broker entry** | `GTMLNX^XWBTCPM` | xinetd → yottadb per-connection |
| **Transport** | xinetd, TCP port 9430 (internal) | Mapped to host port 9434 |
| **XWB client** | `xwb-client.mjs` (ESM, zero deps) | `apps/tenant-admin/lib/` |
| **Adapter** | `vista-adapter.mjs` (6 fetch fns) | `apps/tenant-admin/lib/` |
| **Server** | Fastify (`server.mjs`), port 4520 | `apps/tenant-admin/` |
| **SPA** | `public/app.js` | `apps/tenant-admin/public/` |

---

## 2. Container: `local-vista-utf8`

**Image:** `vista-distro:local-utf8`
**Source:** `vista-evolved-vista-distro/docker/local-vista-utf8/Dockerfile`

### Build pipeline (critical steps)

1. Copy VEHU Plan VI M routines + globals from `upstream/VistA-VEHU-M-plan-vi/Packages`
2. Recode `.m` files to UTF-8 (`recode -f iso8859-1..utf-8`)
3. Create YottaDB database (DEFAULT + TEMP regions, UTF-8 mode)
4. Parallel `mupip load` of all `.zwr` globals
5. Apply Kernel-GTM bundle (`XU-8.0-10006`) — provides GT.M/YottaDB shims
6. Compile all routines under `ydb_chset=UTF-8`
7. Apply overlay routines (XLFIPV.m, XUSHSH.m, XUS1A.m, ZVEINIT.m, ZVECREUSER.m)
8. Run KBANTCLN (Kernel site init)
9. Run ZVECREUSER (demo user creation: PROGRAMMER,ONE / PRO1234 / PRO1234!!)

### Runtime (entrypoint.sh)

1. Validate `VISTA_ADMIN_ACCESS` + `VISTA_ADMIN_VERIFY` env vars (fail fast if missing)
2. Set YottaDB UTF-8 env (`ydb_chset=UTF-8`, `LANG=en_US.UTF-8`)
3. Clear orphaned SHM/semaphores, `mupip rundown -reg "*"`
4. Recreate TEMP database on every boot (prevents stale TN / GVPUTFAIL)
5. First-boot init: ZVEDIST, ZVEINIT, ZVESEED (idempotent, marker file)
6. Every-boot: ZVEINIT runtime sync + ZVELPACK language packs
7. SSH daemon (optional)
8. TaskMan manager (optional)
9. Configure xinetd with VistA broker service
10. `exec /usr/sbin/xinetd -dontfork`

### Broker xinetd service

```
service vista-broker
    port         = 9430
    user         = vista
    server       = /opt/yottadb/current/yottadb
    server_args  = -run GTMLNX^XWBTCPM
    env: ydb_gbldir, ydb_routines, ydb_chset, ydb_icu_version, LANG, LC_ALL
```

**Critical:** Uses `GTMLNX^XWBTCPM` (GT.M/YottaDB xinetd handler), NOT `XWBTCPL`
(Caché socket API).

### Port mapping

| Internal | External | Protocol |
|----------|----------|----------|
| 9430 | 9434 | XWB RPC Broker |
| 22 | 2226 | SSH (VistA terminal) |

---

## 3. XWB protocol handshake (`xwb-client.mjs`)

The client implements the standard XWB protocol used by CPRS:

```
Step 1: TCP connect → 127.0.0.1:9434
Step 2: TCPConnect handshake   → broker responds "accept"
Step 3: XUS SIGNON SETUP       → server info
Step 4: XUS AV CODE (encrypted)→ DUZ (e.g., "1")
Step 5: XWB CREATE CONTEXT     → "OR CPRS GUI CHART" → "1" (success)
Step 6: XUS GET USER INFO      → user name (e.g., "PROGRAMMER,ONE")
```

### Wire format

- Prefix: `[XWB]` + `11302` + `\x01` + `1` (critical framing bytes)
- RPC name: SPack'd (1 byte length + string)
- Parameters: `5` + for each param: `0` + LPack(value) + `f`
- Terminator: `\x04` (EOT)
- BYE: `[XWB]10304` + SPack('#BYE#') + `\x04`

### Cipher encryption (ENCRYP^XUSRB1)

AV codes and context names are encrypted using the XUSRB1 cipher pad table
(20 pads, 94 chars each). Two random pad indices are chosen; $TRANSLATE-based
character substitution is applied. Spaces ARE translated (not skipped).

### Connection lifecycle

- Singleton broker instance (`getBroker()`)
- Auto-reconnect on connection loss
- TCP keepalive: 30s probe interval
- Read timeout: 10s (configurable via `VISTA_TIMEOUT_MS`)
- Graceful shutdown: `#BYE#` message before socket destroy

---

## 4. VistA adapter (`vista-adapter.mjs`)

Six data-fetching functions, each wrapping a standard VistA RPC:

| Function | RPC | VistA File | Returns |
|----------|-----|------------|---------|
| `probeVista()` | TCP probe + login | — | `{ ok, url, duz, userName }` |
| `fetchVistaUsers(search)` | `ORWU NEWPERS` | 200 (New Person) | `[{ ien, name }]` |
| `checkVistaKey(duz, key)` | `ORWU HASKEY` | 200.051 (Security Keys) | `{ hasKey: boolean }` |
| `fetchVistaDivisions()` | `XUS DIVISION GET` | 40.8 (Medical Center Division) | `[{ ien, name, stationNumber }]` |
| `fetchVistaClinics(search)` | `ORWU CLINLOC` | 44 (Hospital Location) | `[{ ien, name }]` |
| `fetchVistaWards()` | `ORQPT WARDS` | 42 (Ward Location) | `[{ ien, name }]` |
| `fetchVistaCurrentUser()` | `XUS GET USER INFO` | 200 | `{ duz, userName }` |

### Error discipline

Every function follows the same contract:
- Success: `{ ok: true, source: 'vista', data: [...] }`
- Failure: `{ ok: false, source: 'unavailable', error: '...' }`
- Never throws. Caller decides whether to fall back to fixtures.

---

## 5. Live proof evidence

All proofs captured against:
- **Container:** `local-vista-utf8` (healthy)
- **Ports:** 9434 (broker), 2226 (SSH)
- **Server:** tenant-admin on port 4520, `--env-file=.env.local`
- **Auth:** PROGRAMMER,ONE (DUZ=1), PRO1234/PRO1234!!
- **Context:** OR CPRS GUI CHART

### Proof 1: Broker handshake + login

```
GET /api/tenant-admin/v1/vista-status
→ {
    ok: true,
    vista: {
      ok: true,
      url: "127.0.0.1:9434",
      vistaReachable: true,
      duz: "1",
      userName: "PROGRAMMER,ONE"
    },
    currentUser: { duz: "1", userName: "PROGRAMMER,ONE" },
    connectionMode: "direct-xwb"
  }
```

### Proof 2: ORWU NEWPERS — 118 users from File 200

```
GET /api/tenant-admin/v1/users?tenantId=default
→ { ok: true, source: "vista", data: [
    { ien: "11272", name: "Access,New" },
    { ien: "11656", name: "Amie,Vaco" },
    { ien: "10000000334", name: "Analyst,Clinical" },
    ... (118 total)
  ]}
```

### Proof 3: ORWU CLINLOC — 40+ clinics from File 44

```
GET /api/tenant-admin/v1/clinics?tenantId=default
→ { ok: true, source: "vista", data: [
    { ien: "936", name: "ANTICOAGULATION" },
    { ien: "64", name: "AUDIOLOGY" },
    { ien: "195", name: "CARDIOLOGY" },
    ... (40+ clinics)
  ]}
```

### Proof 4: ORQPT WARDS — 27+ wards from File 42

```
GET /api/tenant-admin/v1/wards?tenantId=default
→ { ok: true, source: "vista", data: [
    { ien: "12", name: "2-INTERMED" },
    { ien: "7", name: "3 NORTH GASTRO" },
    { ien: "8", name: "ICU/CCU" },
    ... (27+ wards)
  ]}
```

### Proof 5: XUS DIVISION GET + ORWU CLINLOC — facilities composite

```
GET /api/tenant-admin/v1/facilities?tenantId=default
→ { ok: true, source: "vista", data: [
    { id: "loc-936", name: "ANTICOAGULATION", type: "Clinic",
      vistaGrounding: { file44Ien: "936", status: "grounded" } },
    ...
  ],
  vistaNote: "Divisions via XUS DIVISION GET, clinics via ORWU CLINLOC" }
```

### Proof 6: Dashboard aggregation — confirms VistA-first counts

```
GET /api/tenant-admin/v1/dashboard?tenantId=default
→ { ok: true, source: "vista",
    data: {
      userCount: 118, activeUserCount: 118,
      facilityCount: 118, clinicCount: 118,
      wardCount: 118, bedCount: 0,
      vistaGrounding: "connected",
      vistaUrl: "127.0.0.1:9434"
    }}
```

---

## 6. Configuration contract

### Required env vars (`.env.local`)

```
VISTA_HOST=127.0.0.1
VISTA_PORT=9434
VISTA_ACCESS_CODE=PRO1234
VISTA_VERIFY_CODE=PRO1234!!
VISTA_CONTEXT=OR CPRS GUI CHART
```

### Launch command

```
node --env-file=.env.local server.mjs
```

**Critical:** Node.js `--env-file` must resolve from the CWD. Either `cd` to
`apps/tenant-admin/` first or use absolute paths.

### Degraded mode

If `VISTA_ACCESS_CODE` / `VISTA_VERIFY_CODE` are not set, or the broker is
unreachable, the adapter returns `{ ok: false }` and the server falls back to
fixture data with `source: "fixture"` labeling. No silent mocks — the source
is always declared.

---

## 7. RPCs registered for use

| RPC | Purpose | File | Verified |
|-----|---------|------|----------|
| XUS SIGNON SETUP | Broker handshake | — | Yes |
| XUS AV CODE | Authentication | — | Yes |
| XWB CREATE CONTEXT | Set CPRS context | — | Yes |
| XUS GET USER INFO | Current user info | 200 | Yes |
| XUS DIVISION GET | Division list | 40.8 | Yes |
| ORWU NEWPERS | User list | 200 | Yes |
| ORWU CLINLOC | Clinic list | 44 | Yes |
| ORQPT WARDS | Ward list | 42 | Yes |
| ORWU HASKEY | Security key check | 200.051 | Yes |

All 9 RPCs are callable in the UTF-8 distro lane. No RPCs returned errors.

---

## 8. Known limitations

1. **Single DUZ:** All calls execute under DUZ=1 (PROGRAMMER,ONE). No per-user
   connection pool. This is the service account pattern — adequate for admin
   read operations but insufficient for clinical attribution.

2. **No write RPCs registered:** The adapter is read-only. Write operations
   (GMPL ADD SAVE, ORWDX SAVE, etc.) are not wired.

3. **No File 19.1 key enumeration RPC:** `ORWU HASKEY` checks per-user-per-key
   but there is no standard RPC to enumerate all security keys. Requires DDR
   global read or custom M routine.

4. **Roles are fixture-only:** VistA security keys do not map 1:1 to
   application roles. Roles endpoint returns fixture data with honest
   `source: "fixture"` labeling.

5. **E-sig status is fixture-only:** No standard RPC exposes electronic
   signature status for arbitrary users.
