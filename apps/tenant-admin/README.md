# Tenant Admin — VistA-First Operational Shell

> **Implementation posture:** VistA-first with fixture fallback for degraded mode.
> **VistA grounding:** Direct XWB RPC broker connection via `lib/xwb-client.mjs`.
> All VistA-owned data surfaces connect to the live broker first; fixture data
> serves only as fallback when VistA is unreachable, with honest `source` labeling.
> **Proven against:** `local-vista-utf8` distro lane (port 9434) — 118 users,
> 44 clinics, 29 wards returned from live VistA RPCs.
> **Runtime:** Standalone Fastify + SPA on port 4520.

---

## What this is

A working **VistA-first operational shell** for tenant-scoped administration.
It serves 15 API surfaces (13 with dedicated UI renders) with layout, navigation, filter rails, context rails,
breadcrumbs, and a badge vocabulary that dynamically reflects the actual data source.

The XWB broker client (`lib/xwb-client.mjs`) connects directly to the VistA
RPC broker using the XWB protocol (TCP, cipher pad authentication, context
negotiation). Routes attempt VistA-first reads and fall back to fixture data
when VistA is unreachable. Every response includes an honest `source` field
(`"vista"`, `"fixture"`, or `"catalog"`) displayed as a badge in the UI.

### Surfaces

| Surface | Route | Primary source | Fallback | Status |
|---------|-------|---------------|----------|--------|
| Dashboard | `#/dashboard` | VistA (aggregated counts) | Fixture counts | ✅ VistA-first |
| VistA Status | `#/` (status bar) | VistA broker probe | Error state | ✅ VistA-direct |
| User List | `#/users` | `ORWU NEWPERS` | `fixtures/users.json` | ✅ VistA-first |
| User Detail | `#/users/:id` | `DDR GETS` File 200 / `ORWU NEWPERS` | `fixtures/users.json` | ✅ VistA-first |
| Topology | `#/topology` | `XUS DIVISION GET` + `ORWU CLINLOC` + `ORQPT WARDS` | `fixtures/facilities.json` | ✅ VistA-first |
| Facility List | `#/facilities` | `XUS DIVISION GET` + `ORWU CLINLOC` | `fixtures/facilities.json` | ✅ VistA-first |
| Facility Detail | `#/facilities/:id` | `ORWU CLINLOC` / `ORQPT WARDS` (by IEN) | `fixtures/facilities.json` | ✅ VistA-first |
| Clinic List | `#/clinics` | `ORWU CLINLOC` | `fixtures/facilities.json` | ✅ VistA-first |
| Ward List | `#/wards` | `ORQPT WARDS` | `fixtures/facilities.json` | ✅ VistA-first |
| Role Assignment | `#/roles` | `DDR LISTER` File 19.1 | `fixtures/roles.json` | ✅ VistA-first |
| Key Inventory | `#/key-inventory` | `DDR LISTER` File 19.1 | `fixtures/roles.json` | ✅ VistA-first |
| E-Sig Status | `#/esig-status` | `ORWU NEWPERS` + `DDR GETS` 20.2-20.4 | `fixtures/users.json` | ✅ VistA-first |
| VistA tools | `#/vista-tools` | DDR probe + direct-write posture | `GET /vista/ddr-probe` | ✅ Platform-owned |
| Devices | `#/devices` | `DDR LISTER` File 3.5 | — | ✅ VistA-direct |
| Kernel params | `#/params/kernel` | `DDR GETS` File 8989.3 | — | ✅ VistA-direct |

### VistA adapter (lib/vista-adapter.mjs → lib/xwb-client.mjs)

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

### Partially integrated surfaces

Holder-count cross-referencing for keys/roles requires reading `^XUSEC(KEY,DUZ)`
or File 200 field 51 — not yet wired in this slice. When VistA DDR LISTER
returns keys but holder lookup fails, `holderCount: 0` is shown with an
integration note.

### Fixture files (degraded-mode fallback only)

Fixture files in `fixtures/` are **not the source of truth** for VistA-owned data.
They exist solely as degraded-mode fallback when VistA is unreachable. Each file
contains a `_meta` object documenting its classification and truth ownership.
See `docs/explanation/fixture-inventory-and-truth-ownership-audit.md` for the
full inventory and classification.

| File | Class | Truth owner | Happy-path role |
|------|-------|-------------|-----------------|
| `users.json` | C (degraded-mode) | VistA File 200 | Fallback only |
| `roles.json` | C (degraded-mode) | VistA File 19.1 | Fallback + integration-pending |
| `facilities.json` | C (degraded-mode) | VistA Files 4/40.8/44/42 | Fallback only |

---

## Running

### With VistA broker (recommended)

```bash
cd apps/tenant-admin

# Set broker connection env vars
export VISTA_HOST=127.0.0.1
export VISTA_PORT=9434
export VISTA_ACCESS_CODE=PRO1234
export VISTA_VERIFY_CODE="PRO1234!!"
export VISTA_CONTEXT="OR CPRS GUI CHART"

node server.mjs    # port 4520
```

Or use the `.env.local` file:

```bash
node --env-file=.env.local server.mjs
```

Open: `http://127.0.0.1:4520/?tenantId=tenant-ph-001#/dashboard`

### Without VistA (fixture-only mode)

```bash
cd apps/tenant-admin
node server.mjs    # all surfaces fall back to fixture data
```

### From operator console

Launch via the tenant-admin handoff button in the operator console.
The `tenantId` and `cpReturnUrl` are passed as query parameters.

### Verified broker connections

| Lane | Container | Broker port | Credentials | Status |
|------|-----------|-------------|-------------|--------|
| UTF-8 distro | `local-vista-utf8` | 9434 | PRO1234 / PRO1234!! | ✅ Proven |
| VEHU sandbox | `vehu` | 9431 | PRO1234 / PRO1234!! | Compatible |
| Legacy | `wv` | 9430 | PROV123 / PROV123!! | Compatible |

---

## Architecture references

| Doc | Purpose |
|-----|---------|
| `docs/explanation/tenant-admin-architecture-and-boundaries.md` | Workspace identity, concern areas, boundaries |
| `docs/explanation/fixture-inventory-and-truth-ownership-audit.md` | Fixture classification and truth ownership |
| `docs/explanation/tenant-admin-happy-path-source-map.md` | Per-surface data source map (13 surfaces) |
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
- **User detail by IEN:** Uses `ORWU NEWPERS` empty search then filters by IEN. Users not in the first page of results may fall through to fixture.
- **Kernel params:** `GET/PUT /params/kernel` (allow-listed fields on File 8989.3).

## Next steps

1. Wire holder-count cross-reference for key inventory (`^XUSEC` or File 200 field 51)
2. Expand DDR allow-lists (more File 200 contact fields, clinic/ward metadata)
3. Expand ZVE* RPC coverage per `packages/contracts/openapi/tenant-admin.openapi.yaml`
4. Add device-type management (File 3.5 fields 1-3 beyond .01)
