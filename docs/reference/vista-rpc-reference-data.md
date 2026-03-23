# VistA RPC Reference Data

> **Purpose:** Central index of all VistA RPC reference material available across the
> VistA Evolved repos. AI coders and team members: read this FIRST before guessing
> at RPC names, parameter formats, or return types.
>
> **Canonical status:** This file in `vista-evolved-platform` is the **full detailed reference**.
> The distro repo (`vista-evolved-vista-distro/docs/reference/vista-rpc-reference-data.md`)
> contains a condensed version with a pointer back here. Edits to the frozen-repo corpus
> tables, DDR specification, or external source links should be made **here** first —
> the distro file covers only distro-specific ZVE* RPCs and the DDR quick-reference.

---

## 1. Frozen Repo RPC Data (VistA-Evolved)

The frozen `VistA-Evolved` repo contains the richest RPC reference corpus accumulated
over 580+ phases of development. **Do not delete or modify these files** — they are
read-only reference material.

### Vivian RPC Index (3,747 RPCs)

| File | What | Entries |
|------|------|--------|
| `VistA-Evolved/data/vista/vivian/rpc_index.json` | Normalized flat RPC list (name + package) | 3,747 |
| `VistA-Evolved/docs/grounding/vivian-index.json` | Full Vivian/DOX snapshot (packages, RPCs, HL7, deps) | ~78K lines |
| `VistA-Evolved/docs/vista/vivian-snapshot-format.md` | Schema and update instructions | — |

**Use case:** "Does RPC X exist in VistA?" → search `rpc_index.json`.

### Full File 8994 RPC Catalogs (from live VistA)

| File | What | Entries |
|------|------|--------|
| `VistA-Evolved/data/vista/rpcs/rpc-catalog.json` | Complete File 8994 dump (ien, name, tag, routine, returnType, params, description) | ~4,500+ |
| `VistA-Evolved/data/vista/rpcs/rpc-by-package.json` | RPCs grouped by VistA package namespace | ~5K lines |
| `VistA-Evolved/data/vista/rpcs/rpc-contexts.json` | RPC contexts (File 19) with assigned RPC IENs | ~7.5K lines |
| `VistA-Evolved/data/vista/distro-rpcs/rpc-catalog.json` | Same catalog from the distro build lane | ~60K lines |

**Use case:** "What params does DDR LISTER take?" → search `rpc-catalog.json` for `"DDR LISTER"`.

### Domain-Specific Admin Specs (15 files)

| File | Domain |
|------|--------|
| `VistA-Evolved/data/vista/admin-specs/fileman.json` | FileMan DDR RPCs (DDR LISTER, DDR FILER, DDR GETS, DDR VALIDATOR, etc.) |
| `VistA-Evolved/data/vista/admin-specs/rpc-broker.json` | XWB Broker RPCs (33 RPCs) |
| `VistA-Evolved/data/vista/admin-specs/user-security.json` | User/key management RPCs |
| `VistA-Evolved/data/vista/admin-specs/allergies.json` | Allergy RPCs |
| `VistA-Evolved/data/vista/admin-specs/order-entry.json` | Order entry RPCs |
| `VistA-Evolved/data/vista/admin-specs/pharmacy.json` | Pharmacy RPCs |
| `VistA-Evolved/data/vista/admin-specs/laboratory.json` | Lab RPCs |
| `VistA-Evolved/data/vista/admin-specs/scheduling.json` | Scheduling RPCs |
| `VistA-Evolved/data/vista/admin-specs/billing.json` | Billing RPCs |
| `VistA-Evolved/data/vista/admin-specs/radiology.json` | Radiology RPCs |
| `VistA-Evolved/data/vista/admin-specs/surgery.json` | Surgery RPCs |
| `VistA-Evolved/data/vista/admin-specs/patient-registration.json` | Patient registration RPCs |
| `VistA-Evolved/data/vista/admin-specs/clinical-notes.json` | TIU notes RPCs |
| `VistA-Evolved/data/vista/admin-specs/vitals.json` | Vitals RPCs |
| `VistA-Evolved/data/vista/admin-specs/problem-list.json` | Problem list RPCs |

**Use case:** "What RPCs exist for scheduling?" → read `scheduling.json`. Each file has
tag, routine, returnType, params (name, type, required), and description.

### CPRS Delphi RPC Extraction (975 RPCs)

| File | What |
|------|------|
| `VistA-Evolved/design/contracts/cprs/v1/rpc_catalog.json` | All 975 RPCs extracted from CPRS Delphi source with call sites |

### Coverage & Alignment Reports

| File | What |
|------|------|
| `VistA-Evolved/docs/vista-alignment/rpc-coverage.json` | Cross-reference: CPRS (975) + Vivian (3,747) + API registry (109) |
| `VistA-Evolved/docs/vista-alignment/rpc-coverage.md` | Human-readable coverage report |
| `VistA-Evolved/docs/vista-alignment/route-rpc-map.json` | Which API route calls which RPC |
| `VistA-Evolved/data/vista/rpc-catalog-snapshot.json` | Snapshot of the API's rpcRegistry.ts as JSON |

### Instance Comparison (Vivian vs Live)

| File | What |
|------|------|
| `VistA-Evolved/data/vista/vista_instance/rpc_present.json` | RPCs confirmed present in VEHU (2,508) |
| `VistA-Evolved/data/vista/vista_instance/rpc_missing_vs_vivian.json` | RPCs in Vivian but not in VEHU (1,239) |
| `VistA-Evolved/data/vista/vista_instance/rpc_extra_vs_vivian.json` | RPCs in VEHU but not in Vivian (292) |
| `VistA-Evolved/data/vista/vista_instance/rpc_catalog_cache.json` | Full File 8994 cache from live instance |

### RPC Registry (Source Code)

| File | What |
|------|------|
| `VistA-Evolved/apps/api/src/vista/rpcRegistry.ts` | Canonical API RPC registry: 109+ RPCs with domain, tag, description |
| `VistA-Evolved/data/vista/rpc-safe-harbor-v2.json` | Write RPC tiers (safe-harbor, supervised, experimental, blocked) |

---

## 2. DDR RPC Family — Verified Specification

Source: actual MUMPS source code from `WorldVistA/VistA-M` (DDR.m, DDR2.m, DDR3.m).

### DDR LISTER (LISTC^DDR)

- **Return type:** GLOBAL ARRAY
- **Parameter count:** 1
- **Parameter:** `LIST ATTRIBUTES` — type `REFERENCE` (LIST in XWB protocol)

The `PARSE` function in DDR.m extracts these named subscripts from the LIST parameter:

| Key | MUMPS Variable | Default | Description |
|-----|---------------|---------|-------------|
| `FILE` | DDRFILE | (required) | VistA file number (e.g., `"19.1"`, `"3.5"`, `"200"`) |
| `IENS` | DDRIENS | `""` | Internal entry number string (for subfiles) |
| `FIELDS` | DDRFLDS | (required) | Semicolon-delimited field numbers (e.g., `".01;2"`) |
| `FLAGS` | DDRFLAGS | `""` | LIST^DIC flags (I=include IEN, P=packed, etc.) |
| `MAX` | DDRMAX | `"*"` (all) | Maximum records to return |
| `FROM` | DDRFROM | `""` | Starting point for pagination |
| `PART` | DDRPART | `""` | Partial match string |
| `XREF` | DDRXREF | `""` | Cross-reference to traverse |
| `SCREEN` | DDRSCRN | `""` | DBS screen code |
| `ID` | DDRID | `""` | Identifier fields |
| `OPTIONS` | DDROPT | `""` | Additional options (WID, IX) |

**Response format (V1 with P flag):**

```
[MAP]
field-map-line
[BEGIN_diDATA]
IEN^field1^field2^...
IEN^field1^field2^...
[END_diDATA]
[BEGIN_diERRORS]
...
[END_diERRORS]
```

The `[MAP]`, `[BEGIN_diDATA]`, `[END_diDATA]`, and `[BEGIN_diERRORS]` lines are metadata.
Only lines between `[BEGIN_diDATA]` and `[END_diDATA]` are actual records.

**Wire format (XWB Broker):**

```javascript
broker.callRpcWithList('DDR LISTER', [
  { type: 'list', value: { FILE: '19.1', FIELDS: '.01;2', FLAGS: 'IP', MAX: '999' } },
]);
```

### DDR GETS ENTRY DATA (GETSC^DDR2)

- **Return type:** ARRAY
- **Parameter:** `GETS ATTRIBUTES` — type `REFERENCE` (LIST)

Keys: `FILE`, `IENS`, `FIELDS`, `FLAGS`

### DDR FILER (FILEC^DDR3)

- **Return type:** ARRAY
- **Parameters:** `EDIT RESULTS` (REFERENCE/LIST) + `EDIT MODE` (LITERAL)

### DDR VALIDATOR (VALC^DDR3)

- **Return type:** ARRAY
- **Parameter:** `PARAMETERS` — type `REFERENCE` (LIST)

### DDR DELETE ENTRY (DELC^DDR4)

- **Return type:** SINGLE VALUE
- **Parameter:** `PARAMETERS` — type `REFERENCE` (LIST)

### DDR FIND1 (FINDC^DDR4)

- **Return type:** ARRAY
- **Parameter:** `PARAMETERS` — type `REFERENCE` (LIST)

---

## 3. External Sources

| Source | URL | What |
|--------|-----|------|
| Vivian/DOX Browser | https://vivian.worldvista.org/dox | Browse VistA packages, routines, RPCs, globals |
| Vivian RPC Data | https://vivian.worldvista.org/vivian-data/8994/ | Raw File 8994 RPC entries |
| VistA-M on GitHub | https://github.com/WorldVistA/VistA-M | Full MUMPS source (FileMan, Kernel, CPRS, etc.) |
| VA VDL (docs) | https://www.va.gov/vdl/ | VA technical manuals (PDF) for every VistA package |
| VistApedia | https://vistapedia.net | Community wiki for VistA RPC and protocol reference |

---

## 4. How to Use This Reference

1. **Before writing any RPC call:** Search the frozen repo's `rpc-catalog.json` or
   `admin-specs/*.json` for the RPC name to get its exact parameter spec.
2. **Before guessing at parameter format:** Read the DDR specification above or check
   the MUMPS source on GitHub (`WorldVistA/VistA-M/Packages/VA FileMan/Routines/DDR*.m`).
3. **Before adding a new RPC to the registry:** Check `rpc_index.json` (Vivian) and
   `rpc_present.json` (live instance) to confirm it exists.
4. **For CPRS parity work:** Use `rpc-coverage.json` to see which of the 975 CPRS RPCs
   are wired, registered, or missing.
