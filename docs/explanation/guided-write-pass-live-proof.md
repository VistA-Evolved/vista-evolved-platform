# DDR direct-write proof (replaces guided terminal Mode B)

> **Status:** Historical Mode B / guided-write routes have been **removed**. Tenant admin now uses **DDR VALIDATOR + DDR FILER** and **distro overlay RPCs** (`ZVEUSMG`, `ZVECLNM`, `ZVEWRDM`) for writes.
>
> **Evidence:** run `node scripts/ddr-tenant-admin-proof.mjs` with tenant-admin + VistA running; capture console output under `/artifacts` per `docs/reference/doc-governance.md`.

## Objective

Prove the **UI → API → XWB → DDR / ZVE*** path without terminal-guided workflows.

## Mechanism

| Layer | Responsibility |
|-------|------------------|
| Browser | Forms and `PUT`/`POST` to `/api/tenant-admin/v1/*` |
| `server.mjs` | Allow-lists fields, calls `DDR VALIDATOR` then `DDR FILER`, or `callZveRpc` |
| VistA | FileMan `FILE^DIE` / `UPDATE^DIE` via DDR or overlay M |

## Proof script

| Artifact | Path |
|----------|------|
| Proof script | `scripts/ddr-tenant-admin-proof.mjs` |
| OpenAPI | `packages/contracts/openapi/tenant-admin.openapi.yaml` |

### Steps (default)

1. `GET /api/tenant-admin/v1/vista-status` — broker reachable.
2. `GET /api/tenant-admin/v1/vista/ddr-probe` — DDR read RPCs callable.

### Optional write slice

```bash
node scripts/ddr-tenant-admin-proof.mjs --write --ien 46 --field .132 --value "555-0199"
```

Expect `200` and `ok: true` when DDR FILER is registered and field is valid for the site.

## Distro overlay install

Copy `vista-evolved-vista-distro/overlay/routines/ZVEUSMG.m` (and related) into the running VistA container, then `D INSTALL^ZVEUSMG` (programmer mode). See `vista-evolved-vista-distro/docs/how-to/zveusmg-overlay-install.md`.

## Files superseded

- `scripts/guided-write-proof.mjs` — **removed**
- `POST /guided-write/*` — **removed** from tenant-admin server
