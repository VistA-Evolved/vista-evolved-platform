# Tenant Admin — VistA-Only Operational Shell

> **Implementation posture:** VistA-ONLY. No fixture files, no JSON fallbacks, no alternate data sources.
> **VistA grounding:** Direct XWB RPC broker connection via `lib/xwb-client.mjs`.
> Every route reads from and writes to the live VistA system exclusively.
> If VistA is unreachable, routes return `{ok: false, source: "error"}`.
> **Proven against:** `local-vista-utf8` distro lane (port 9434) — 118 users,
> 44 clinics, 29 wards returned from live VistA RPCs.
> **Runtime:** Standalone Fastify + SPA on port 4520.

---

## What this is

A working **VistA-only operational shell** for tenant-scoped administration.
It serves 20+ API surfaces with layout, navigation, filter rails, context rails,
breadcrumbs, and a badge vocabulary that reflects the actual data source.

The XWB broker client (`lib/xwb-client.mjs`) connects directly to the VistA
RPC broker using the XWB protocol (TCP, cipher pad authentication, context
negotiation). Every response includes an honest `source` field
(`"vista"`, `"catalog"`, or `"error"`) displayed as a badge in the UI.

**RULE: There are NO fixture files, NO JSON fallbacks, NO alternate data sources.
VistA is the sole source of truth. If VistA is unreachable, the UI shows an
explicit error state — never fake or cached data.**

### Surfaces

| Surface | Route | VistA source | Status |
|---------|-------|-------------|--------|
| Dashboard | `#/dashboard` | VistA (aggregated counts from all RPCs) | VistA-only |
| VistA Status | `#/` (status bar) | VistA broker probe | VistA-direct |
| User List | `#/users` | `ORWU NEWPERS` | VistA-only |
| User Detail | `#/users/:id` | `DDR GETS` File 200 / `ORWU NEWPERS` | VistA-only |
| Topology | `#/topology` | `XUS DIVISION GET` + `ORWU CLINLOC` + `ORQPT WARDS` | VistA-only |
| Facility List | `#/facilities` | `XUS DIVISION GET` + `ORWU CLINLOC` | VistA-only |
| Facility Detail | `#/facilities/:id` | `ORWU CLINLOC` / `ORQPT WARDS` (by IEN) | VistA-only |
| Clinic List | `#/clinics` | `ORWU CLINLOC` | VistA-only |
| Clinic Detail | `#/clinics/:ien` | `DDR GETS` File 44 | VistA-only |
| Ward List | `#/wards` | `ORQPT WARDS` | VistA-only |
| Role Assignment | `#/roles` | `DDR LISTER` File 19.1 | VistA-only |
| Key Inventory | `#/key-inventory` | `DDR LISTER` File 19.1 | VistA-only |
| E-Sig Status | `#/esig-status` | `ORWU NEWPERS` + `DDR GETS` 20.2-20.4 | VistA-only |
| Devices | `#/devices` | `DDR LISTER` File 3.5 | VistA-only |
| Kernel params | `#/params/kernel` | `DDR GETS` File 8989.3 | VistA-only |
| Treating Specialties | `#/treating-specialties` | `DDR LISTER` File 45.7 | VistA-only |
| Room-Beds | `#/room-beds` | `DDR LISTER` File 405.4 | VistA-only |
| Installed Packages | `#/packages` | `DDR LISTER` File 9.4 | VistA-only |
| Scheduling Config | `#/scheduling-config` | `DDR LISTER` File 409.1 | VistA-only |
| Drug Formulary | `#/pharmacy-config` | `DDR LISTER` File 50 | VistA-only |
| Lab Tests | `#/lab-config` | `DDR LISTER` File 60 | VistA-only |
| TaskMan | `#/taskman` | `DDR LISTER` File 14.4 | VistA-only |
| Titles | `#/titles` | `DDR LISTER` File 3.1 | VistA-only |
| VistA tools | `#/vista-tools` | DDR probe + direct-write posture | Platform-owned |

### VistA adapter (lib/vista-adapter.mjs -> lib/xwb-client.mjs)

| Function | RPC | Purpose |
|----------|-----|---------|
| `probeVista()` | (TCP probe + auth) | Connectivity + session check |
| `fetchVistaUsers(search)` | `ORWU NEWPERS` | User list from File 200 |
| `fetchVistaCurrentUser()` | (broker state) | Authenticated user DUZ + name |
| `fetchVistaDivisions()` | `XUS DIVISION GET` | Division list from File 40.8 |
| `fetchVistaClinics(search)` | `ORWU CLINLOC` | Clinic list from File 44 |
| `fetchVistaWards()` | `ORQPT WARDS` | Ward list from File 42 |
| `checkVistaKey(keyName)` | `ORWU HASKEY` | Per-user key check (File 19.1) |
| `ddrGetsFile200(ien, fields)` | `DDR GETS ENTRY DATA` | Read File 200 fields by IEN |
| `ddrListerSecurityKeys()` | `DDR LISTER` | List keys from File 19.1 |
| `ddrValidateField(file, iens, field, value)` | `DDR VALIDATOR` | Validate before filing |
| `ddrFilerEdit(file, iens, field, value)` | `DDR FILER` (EDIT) | Write allow-listed field |
| `ddrFilerAdd(file, field, iens, value)` | `DDR FILER` (ADD) | Create new entry |
| `callZveRpc(name, params)` | Any `ZVE*` RPC | Call distro overlay RPC |
| `probeDdrRpcFamily()` | DDR family probe | Check DDR RPC availability |
| `fetchVistaEsigStatusForUsers(users)` | `DDR GETS ENTRY DATA` | Bulk e-sig status (fields 20.2-20.4) |
| `parseDdrListerResponse(lines)` | (parser) | Parse DDR LISTER raw output |

### Partially integrated surfaces

Holder-count cross-referencing for keys/roles requires reading `^XUSEC(KEY,DUZ)`
or File 200 field 51 -- not yet wired in this slice. When VistA DDR LISTER
returns keys but holder lookup fails, `holderCount: 0` is shown with an
integration note.

---

## Running

### With VistA broker (REQUIRED)

VistA must be running and reachable. There is no fallback mode.

```bash
cd apps/tenant-admin
node --env-file=.env.local server.mjs    # port 4520
```

Or set env vars directly:

```bash
export VISTA_HOST=127.0.0.1
export VISTA_PORT=9434
export VISTA_ACCESS_CODE=PRO1234
export VISTA_VERIFY_CODE="PRO1234!!"
export VISTA_CONTEXT="OR CPRS GUI CHART"
node server.mjs
```

Open: `http://127.0.0.1:4520/?tenantId=tenant-ph-001#/dashboard`

### From operator console

Launch via the tenant-admin handoff button in the operator console.
The `tenantId` and `cpReturnUrl` are passed as query parameters.

### Verified broker connections

| Lane | Container | Broker port | Credentials | Status |
|------|-----------|-------------|-------------|--------|
| UTF-8 distro | `local-vista-utf8` | 9434 | PRO1234 / PRO1234!! | Proven |
| VEHU sandbox | `vehu` | 9431 | PRO1234 / PRO1234!! | Compatible |
| Legacy | `wv` | 9430 | PROV123 / PROV123!! | Compatible |

---

## Architecture references

| Doc | Purpose |
|-----|---------|
| `docs/explanation/tenant-admin-architecture-and-boundaries.md` | Workspace identity, concern areas, boundaries |
| `docs/explanation/tenant-admin-happy-path-source-map.md` | Per-surface data source map |
| `docs/explanation/live-broker-canonical-path.md` | Proven XWB broker connection path |
| `docs/explanation/tenant-admin-vista-truth-map.md` | VistA file/RPC grounding targets |
| `docs/explanation/tenant-admin-vista-admin-truth-discovery-pack.md` | 7-family VistA truth discovery |
| `docs/explanation/tenant-admin-vista-users-and-security-keys-map.md` | Deep File 200/19.1 truth map |
| `docs/explanation/tenant-admin-vista-facility-division-clinic-map.md` | Deep File 4/40.8/44 truth map |
| `docs/explanation/tenant-admin-vista-ward-bed-map.md` | File 42/405.4 truth map |
| `docs/explanation/tenant-admin-design-contract-v1.md` | Shell anatomy, badge rules, per-surface checklists |
| `docs/explanation/tenant-admin-personas-jobs-and-first-slice-journeys.md` | Personas, jobs, first-slice surfaces |
| `docs/explanation/operator-to-tenant-admin-handoff-model.md` | Cross-workspace transition contract |

---

## Known limitations

- **Single-socket XWB broker:** The XWB client maintains one TCP socket. Concurrent RPC calls must be serialized (no `Promise.all`). All multi-RPC routes use sequential calls.
- **No tenant-scoped session auth:** `tenantId` is passed as a query parameter, not enforced by session.
- **Direct writes require distro RPCs:** Key assignment and some user ops need `INSTALL^ZVEUSMG` on the target instance. See `vista-evolved-vista-distro/docs/how-to/zveusmg-overlay-install.md`.
- **User detail by IEN:** Uses `ORWU NEWPERS` empty search then filters by IEN. Users not in the first page of results will return an error.
- **Kernel params:** `GET/PUT /params/kernel` (allow-listed fields on File 8989.3).

## Data source policy

**NO FIXTURE FILES. NO JSON FALLBACKS. NO ALTERNATE DATA SOURCES.**

Every route in this application reads from and writes to the live VistA system.
If VistA is unreachable, the route returns `{ok: false, source: "error", error: "..."}`.
The UI displays an error badge and message — never fake or stale data.

This policy is enforced by:
1. Server header comment in `server.mjs`
2. This README
3. Cursor rule `.cursor/rules/vista-only-data-source.mdc`
4. Code review: any `readFile` of JSON data files or `source: 'fixture'` is a rejection-worthy violation.

## Next steps

1. Wire holder-count cross-reference for key inventory (`^XUSEC` or File 200 field 51)
2. Expand DDR allow-lists (more File 200 contact fields, clinic/ward metadata)
3. Expand ZVE* RPC coverage per `packages/contracts/openapi/tenant-admin.openapi.yaml`
4. Add device-type management (File 3.5 fields 1-3 beyond .01)
