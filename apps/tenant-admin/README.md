# Tenant Admin — Dual-Mode Prototype Shell

> **Implementation posture:** Dual-mode prototype (VistA adapter + fixture fallback).
> **VistA grounding:** Adapter wired. When `VISTA_API_URL` is configured and VistA is
> reachable, user and facility data comes from live VistA RPCs. Otherwise falls back
> to fixture data with honest source labeling. **Not yet proven against live VistA.**
> **Runtime:** Standalone Fastify + SPA on port 4520.

---

## What this is

A working **dual-mode prototype shell** for tenant-scoped operational administration.
It serves 7 surfaces with layout, navigation, filter rails, context rails,
breadcrumbs, and a badge vocabulary that dynamically reflects the actual data source.

The VistA adapter (`lib/vista-adapter.mjs`) provides HTTP-based connectivity to a
VistA API endpoint. Routes attempt VistA-first reads and fall back to fixture data
when VistA is unavailable. Every response includes an honest `source` field
(`"vista"` or `"fixture"`) displayed as a badge in the UI.

### Surfaces

| Surface | Route | VistA data source | Fixture fallback |
|---------|-------|-------------------|------------------|
| Dashboard | `#/dashboard` | VistA probe (`/vista/ping`) | Fixture counts |
| User List | `#/users` | `ORWU NEWPERS` via adapter | `fixtures/users.json` (4 users) |
| User Detail | `#/users/:id` | Fixture + VistA probe | `fixtures/users.json` |
| Role Assignment | `#/roles` | Fixture only (no write RPC) | `fixtures/roles.json` (6 keys) |
| Facility List | `#/facilities` | `XUS DIVISION GET` + `ORWU CLINLOC` via adapter | `fixtures/facilities.json` |
| Facility Detail | `#/facilities/:id` | Fixture + VistA probe | `fixtures/facilities.json` |
| Guided Tasks | `#/guided-tasks` | N/A (terminal step documentation) | N/A |

### VistA adapter functions (lib/vista-adapter.mjs)

| Function | VistA RPC proxy path | Purpose |
|----------|---------------------|---------|
| `probeVista()` | `/vista/ping` | Connectivity check |
| `fetchVistaUsers(search)` | `/vista/user-list` | User list via ORWU NEWPERS |
| `checkVistaKey(keyName)` | `/vista/has-key` | Key check via ORWU HASKEY |
| `fetchVistaCurrentUser()` | `/vista/current-user` | Current user via XUS GET USER INFO |
| `fetchVistaDivisions()` | `/vista/divisions` | Division list via XUS DIVISION GET |
| `fetchVistaClinics(search)` | `/vista/clinics` | Clinic list via ORWU CLINLOC |

### What is NOT yet proven

- VistA adapter path not yet tested against a live running VistA instance
- User detail still fixture-only (DUZ-based lookup requires session context — future slice)
- Role assignment still fixture-only (key inventory read needs bulk enumeration pattern)
- Facility detail still fixture-only (IEN-based global read path not yet built)
- No tenant-scoped session auth (tenantId passed via query param)
- No write workflows wired — guided tasks document terminal procedures only
- Electronic signature status not yet surfaced
- No live ward/room-bed reads
- No site parameter reads
- Admin corpus discovery incomplete — 7 of ~14 domains mapped

### What IS honestly working

- Shell layout, navigation, tenant banner, status bar
- Dual-mode data fetching with honest VistA/FIXTURE badges per surface
- VistA connectivity probe and banner status (connected vs fixture mode)
- Filter rails with search + dropdown filters on list surfaces
- Context rails on detail surfaces
- Breadcrumb navigation on detail surfaces
- Guided write workflow cards (5 terminal-backed procedures)
- Handoff from operator console (tenantId + cpReturnUrl)
- Return-to-operator link in status bar

---

## Running

```bash
cd apps/tenant-admin
npm start          # port 4520
```

Open: `http://127.0.0.1:4520/?tenantId=test-001#/dashboard`

Or launch from the operator console via the tenant-admin handoff button.

### With VistA adapter (optional)

```bash
VISTA_API_URL=http://127.0.0.1:3001 npm start
```

When `VISTA_API_URL` points to a running VistA API with authenticated session,
user and facility surfaces will show live VistA data with `VistA` source badges.

---

## Architecture references

| Doc | Purpose |
|-----|---------|
| `docs/explanation/tenant-admin-architecture-and-boundaries.md` | Workspace identity, concern areas, boundaries |
| `docs/explanation/tenant-admin-vista-truth-map.md` | VistA file/RPC grounding targets |
| `docs/explanation/tenant-admin-vista-admin-truth-discovery-pack.md` | 7-family VistA truth discovery (confirmed/probable/unknown) |
| `docs/explanation/tenant-admin-vista-users-and-security-keys-map.md` | Deep File 200/19.1 truth map |
| `docs/explanation/tenant-admin-vista-facility-division-clinic-map.md` | Deep File 4/40.8/44 truth map |
| `docs/explanation/tenant-admin-vista-ward-bed-map.md` | File 42/405.4 truth map |
| `docs/explanation/tenant-admin-design-contract-v1.md` | Shell anatomy, badge rules, per-surface checklists |
| `docs/explanation/tenant-admin-personas-jobs-and-first-slice-journeys.md` | Personas, jobs, first-slice surfaces |
| `docs/explanation/operator-to-tenant-admin-handoff-model.md` | Cross-workspace transition contract |

---

## Next steps toward grounding

1. Expand admin corpus to cover all 14+ VistA admin domains (Menu Manager, FileMan, devices, lab/imaging/pharmacy admin, integration boundary)
2. Build terminal-to-UI translation matrix for systematic anti-miss coverage
3. Deepen users/signatures/keys domain with electronic signature posture
4. Prove VistA adapter path against live running VistA instance
5. Add ward/room-bed read path
6. Add site parameter read path
7. Formalize guided write workflows with evidence capture and verification structure
