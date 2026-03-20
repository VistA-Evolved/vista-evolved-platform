# VistA Admin Grounded Domain: Users, Electronic Signatures, and Security Keys

> **Status:** Canonical grounded domain reference.
> **Date:** 2026-03-21.
> **Type:** Reference.
> **Scope:** VistA Files 200, 19.1, 200.051 and supporting files. Covers globals, indexes,
> field decompositions, RPC inventory (confirmed/unprobed/custom), MUMPS routines,
> electronic signature mechanics, and implementation strategy.
>
> **Parent:** [Terminal-to-UI Translation Matrix](vista-admin-terminal-to-ui-translation-matrix.md)
> — functions TM-USR-01 through TM-USR-08, TM-KEY-01 through TM-KEY-04, TM-MENU-01
>
> **See also:**
> - [Slice Ranking](vista-admin-slice-ranking-and-mode-selection.md) — Slice 1 (read) and Slice 2 (guided write) both target this domain
> - [Corpus Discovery Pack](vista-admin-corpus-discovery-pack.md) §2.1 Users/Access, §2.2 Keys/Menus
> - [Domain Map](vista-admin-domain-map.md) — domains D1 (Users/Access) and D2 (Keys/Menus)
> - [Truth Discovery Pack](tenant-admin-vista-admin-truth-discovery-pack.md) — File 200/19.1 details

---

## 1. VistA Data Model

### 1.1 File 200 — NEW PERSON (`^VA(200,)`)

The master user record. Every person who authenticates to VistA has an entry.

**Owner:** Kernel (XU)

| Field # | Name | Global Location | Type | Notes |
|---------|------|-----------------|------|-------|
| .01 | NAME | `^VA(200,IEN,0)` piece 1 | Free text | `LAST,FIRST MI` format |
| 1 | INITIALS | `^VA(200,IEN,0)` piece 2 | Free text | 2–3 chars |
| 2 | ACCESS CODE | `^VA(200,IEN,0)` piece 3 | Hashed | Via `$$EN^XUSHSH`; never retrievable |
| 7 | DISUSER | Via `FILE^DIE` | Boolean | 1 = account disabled |
| 7.2 | VERIFY CODE NEVER EXPIRES | `^VA(200,IEN,0)` piece 8 | Boolean | Set for service accounts |
| 8 | TITLE | Pointer to File 3.1 | Pointer | Job title |
| 11 | VERIFY CODE | `^VA(200,IEN,.1)` | Hashed | Via `$$EN^XUSHSH` |
| 11.2 | VERIFY CODE CHANGE DATE | `^VA(200,IEN,1.1)` piece 4 | FM date | Controls expiration |
| 20.4 | ELECTRONIC SIGNATURE CODE | `^VA(200,IEN,20)` | Hashed | Input transform auto-hashes on save |
| 28 | FILE MANAGER ACCESS CODE | Field 28 | Free text | FileMan access level |
| 29 | SERVICE/SECTION | Pointer to File 49 | Pointer | Organizational unit |
| 51 (subfile) | SECURITY KEYS | `^VA(200,IEN,51,n,0)` | Multiple | Each entry = pointer to File 19.1 |
| 101.01 | RESTRICT PATIENT SELECTION | `^VA(200,IEN,101)` | Boolean | |
| 201 | PRIMARY MENU OPTION | Pointer to File 19 | Pointer | Main menu (EVE, CPRS, etc.) |
| DIV (subfile) | DIVISION | `^VA(200,IEN,"DIV",)` | Multiple | Division assignments |

**Indexes:**
- `^VA(200,"B",NAME,IEN)=""` — B-index for name lookup (used by `VE USER LIST`)
- `^VA(200,"A",HASHED_AC,IEN)=""` — Access code reverse lookup

### 1.2 File 19.1 — SECURITY KEY (`^DIC(19.1,)`)

Defines security key names. Keys gate access to options and RPCs.

| Field # | Name | Notes |
|---------|------|-------|
| .01 | NAME | Key name (e.g., PROVIDER, ORES, XUMGR) |
| 1 | DESCRIPTION | What the key controls |

**Fast lookup global:** `^XUSEC(KEY_NAME,USER_IEN)=""` — presence means user holds the key. Used by `ORWU HASKEY`.

**Key reference keys:**

| Key | Purpose |
|-----|---------|
| PROVIDER | User can be selected as ordering provider |
| ORES | Order entry/result authorizer (physician signature authority) |
| ORELSE | Order entry on behalf of provider (nurse ordering) |
| PSJ RPHARM | Pharmacy verification/dispensing |
| XUMGR | Kernel system manager (full admin) |
| XUPROGMODE | Programmer mode access |
| CPRS CONFIG | CPRS Clinical Coordinator tools |

### 1.3 File 19 — OPTION (`^DIC(19,)`)

Menu options assigned to users via File 200 field 201 (primary menu).

| Field # | Name | Notes |
|---------|------|-------|
| .01 | NAME | Option name (e.g., EVE, OR CPRS GUI CHART) |
| 3 | LOCK | Pointer to File 19.1 — key required to use this option |

### 1.4 File 200.051 — KEY ASSIGNMENT (subfile)

`^VA(200,USER_IEN,51,KEY_SUB_IEN,0)=KEY_IEN` — each entry is a pointer to File 19.1.

**Write via FileMan:** `UPDATE^DIE` targeting `(200.051,"+1,USER_IEN_",")`
**Delete via FileMan:** `^DIK` on the matching sub-IEN

### 1.5 Electronic Signature

- **Storage:** File 200 field 20.4 (hashed by input transform)
- **Never retrievable:** The hash is one-way; no RPC returns the plain text
- **Presence check:** `$$GET1^DIQ(200,IEN,20.4,"I")` — non-empty = has e-sig
- **Validation:** `ORWU VALIDSIG` (IEN 195) — validates an entered code against stored hash
- **Creation:** Terminal-only or via `UPDATE^DIE` with plain text (FileMan input transform hashes it)
- **ZVECREUSER.m pattern:** `C0XFDA(200,"+1,",20.4)="123456"` — plain text, input transform auto-hashes

---

## 2. RPC Inventory — Three Tiers

### Tier 1: Standard VistA RPCs — Confirmed Available in VEHU

These RPCs exist in VEHU File 8994 with confirmed IENs. No custom MUMPS installation needed.

| RPC | IEN | Package | Purpose | Params | Return Format |
|-----|-----|---------|---------|--------|--------------|
| `ORWU NEWPERS` | 213 | OR | Search users by partial name | `[startName, ""]` | `IEN^Name` per line |
| `ORWU USERINFO` | 185 | OR | Current session user details | `[]` | DUZ, name, title, provider key flag |
| `ORWU HASKEY` | 306 | OR | Check if current user holds a key | `[keyName]` | `0` or `1` |
| `ORWU VALIDSIG` | 195 | OR | Validate electronic signature code | `[esCode]` | `0` or `1` |
| `ORWU EXTNAME` | 287 | OR | Resolve File 200 IEN to name | `[ien, 200]` | External name string |
| `XUS GET USER INFO` | 595 | XU | Authenticated user info (8 lines) | `[]` | DUZ, Name, USR Class, can-sign, e-sig-status, PROVIDER-key |
| `XUS DIVISION GET` | 596 | XU | Divisions for current user | `[]` | `IEN^Name^defaultFlag` per line |
| `XUS DIVISION SET` | 594 | XU | Set active division | `[divisionIen]` | Acknowledgment |
| `XWB GET VARIABLE VALUE` | 9 | XWB | Read any M global reference | `[reference]` | Value of the global node |

**Additional RPCs in Vivian (need VEHU probe):**

| RPC | Vivian Package | Purpose | Probe Priority |
|-----|---------------|---------|----------------|
| `ORWU NPHASKEY` | OR | Check if a specific user (by IEN) has a key | HIGH |
| `ORWU DEFAULT DIVISION` | OR | Get default division for user | MEDIUM |
| `ORWD KEY` | OR | Order-related key checking | LOW |
| `ORWD PROVKEY` | OR | Provider key validation | LOW |
| `XUS ALLKEYS` | XU | List all keys held by current user | HIGH |
| `XUS KEY CHECK` | XU | Check key for current user | HIGH |
| `XUS IS USER ACTIVE` | XU | Check if a DUZ is active | MEDIUM |

### Tier 2: XUS IAM RPCs — In Vivian, Not Yet VEHU-Probed

Seven RPCs forming a complete user lifecycle management suite. All confirmed in Vivian index under package XU. **Must be probed against VEHU File 8994 before any architecture depends on them.**

| RPC | Purpose | If Available | If Missing |
|-----|---------|-------------|-----------|
| `XUS IAM ADD USER` | Create new user in File 200 | Replaces ZVECREUSER.m pattern | Fall back to VE USER EDIT + guided terminal |
| `XUS IAM FIND USER` | Search users | Alternative to `ORWU NEWPERS` | Use ORWU NEWPERS (confirmed) |
| `XUS IAM DISPLAY USER` | Display user detail | Richer than ORWU USERINFO | Use VE USER DETAIL (custom) |
| `XUS IAM EDIT USER` | Edit user fields | Standard write path | Use VE USER EDIT (custom) |
| `XUS IAM TERMINATE USER` | Deactivate/terminate user | Standard deactivation | Use VE USER DEACTIVATE (custom) |
| `XUS IAM REACTIVATE USER` | Reactivate terminated user | Standard reactivation | Use VE USER REACTIVATE (custom) |
| `XUS IAM BIND USER` | Bind external identity to DUZ | Novel — OIDC/PIV binding | No custom equivalent |

**Probe command:**
```powershell
# Add to services/vista/ZVEPROB.m LIST array and run:
docker cp services\vista\ZVEPROB.m vehu:/tmp/ZVEPROB.m
docker exec vehu bash -c "cp /tmp/ZVEPROB.m /home/vehu/r/ZVEPROB.m && chown vehu:vehu /home/vehu/r/ZVEPROB.m"
docker exec vehu su - vehu -c "mumps -r PROBE^ZVEPROB"
```

### Tier 3: Custom VE* RPCs — From Archive ZVEUSER.m

Nine custom RPCs defined in the archive's `services/vista/ZVEUSER.m` (200 lines of production MUMPS). Registered in `rpcRegistry.ts` under `RPC_EXCEPTIONS` with domain `admin-users`. Require installing ZVEUSER.m + registration via ZVEMINS.m pattern.

| RPC | Entry Point | Type | Purpose |
|-----|------------|------|---------|
| `VE USER LIST` | `LIST^ZVEUSER` | READ | Walk `^VA(200,"B")` from search prefix, max 500 results; returns `IEN^Name^Active^Title^Service` |
| `VE USER DETAIL` | `DETAIL^ZVEUSER` | READ | 16+ fields including all key assignments, e-sig status, division info |
| `VE KEY LIST` | `KEYS^ZVEUSER` | READ | Full enumeration of File 19.1 via B-index |
| `VE MENU LIST` | `MENUS^ZVEUSER` | READ | File 19 option enumeration |
| `VE USER EDIT` | `EDITUSER^ZVEUSER` | WRITE | `FILE^DIE` with FDA for NAME, TITLE, SERVICE, DISUSER, PRIMARY_MENU |
| `VE USER ADD KEY` | `ADDKEY^ZVEUSER` | WRITE | `UPDATE^DIE` to File 200.051; idempotent (checks existing) |
| `VE USER REMOVE KEY` | `REMOVEKEY^ZVEUSER` | WRITE | Walk subfile to find key, delete via `^DIK` |
| `VE USER DEACTIVATE` | `DEACTUSER^ZVEUSER` | WRITE | Set DISUSER=1 + termination date via `FILE^DIE` |
| `VE USER REACTIVATE` | `REACTUSER^ZVEUSER` | WRITE | Clear DISUSER + termination date |

**Data return format (VE USER LIST):**
```
1:87^PROVIDER,CLYDE WV^YES^PHYSICIAN^MEDICINE
2:88^NURSE,HELEN WV^YES^REGISTERED NURSE^NURSING
3:89^PHARMACIST,LINDA WV^YES^PHARMACIST^PHARMACY
```

**Data return format (VE USER DETAIL):**
```
IEN:87
NAME:PROVIDER,CLYDE WV
INITIALS:CWP
ACCESS_CODE_EXISTS:YES
VERIFY_CODE_EXISTS:YES
SEX:M
DOB:1960-01-15
SSN:last4
TITLE:PHYSICIAN
SERVICE:MEDICINE
DIVISION:WORLDVISTA
DISUSER:0
TERMINATED:
EMAIL:
ESIG_EXISTS:YES
PRIMARY_MENU:OR CPRS GUI CHART
KEY^PROVIDER
KEY^ORES
KEY^XUMGR
```

---

## 3. Existing Implementation Evidence

### 3.1 Archive Route Layer (9 endpoints)

Source: `VistA-Evolved/apps/api/src/routes/vista-admin.ts`

| Method | Path | RPC | Status |
|--------|------|-----|--------|
| GET | `/vista/admin/users?search=` | `VE USER LIST` | Implemented, requires ZVEUSER.m |
| GET | `/vista/admin/user/:ien` | `VE USER DETAIL` | Implemented, requires ZVEUSER.m |
| POST | `/vista/admin/user/:ien/edit` | `VE USER EDIT` | Implemented, requires ZVEUSER.m |
| POST | `/vista/admin/user/:ien/add-key` | `VE USER ADD KEY` | Implemented, requires ZVEUSER.m |
| POST | `/vista/admin/user/:ien/remove-key` | `VE USER REMOVE KEY` | Implemented, requires ZVEUSER.m |
| POST | `/vista/admin/user/:ien/deactivate` | `VE USER DEACTIVATE` | Implemented, requires ZVEUSER.m |
| POST | `/vista/admin/user/:ien/reactivate` | `VE USER REACTIVATE` | Implemented, requires ZVEUSER.m |
| GET | `/vista/admin/keys` | `VE KEY LIST` | Implemented, requires ZVEUSER.m |
| GET | `/vista/admin/menus` | `VE MENU LIST` | Implemented, requires ZVEUSER.m |

### 3.2 Platform Tenant-Admin Adapter (6 functions)

Source: `vista-evolved-platform/apps/tenant-admin/lib/vista-adapter.mjs`

| Function | Proxied RPC | Type |
|----------|-----------|------|
| `probeVista()` | TCP probe | Connectivity |
| `fetchVistaUsers(search)` | `ORWU NEWPERS` | READ — confirmed VEHU |
| `checkVistaKey(keyName)` | `ORWU HASKEY` | READ — confirmed VEHU |
| `fetchVistaCurrentUser()` | `XUS GET USER INFO` | READ — confirmed VEHU |
| `fetchVistaDivisions()` | `XUS DIVISION GET` | READ — confirmed VEHU |
| `fetchVistaClinics(search)` | `ORWU CLINLOC` | READ — confirmed VEHU |

Pattern: HTTP-based proxy via `VISTA_API_URL`. Returns `{ ok, source: 'vista'|'unavailable', data? }`.

### 3.3 Platform Tenant-Admin SPA Surfaces

Source: `vista-evolved-platform/apps/tenant-admin/public/app.js`

| Surface | Route | Data Source | Status |
|---------|-------|------------|--------|
| Dashboard | `#/dashboard` | Fixture + VistA | Working prototype |
| User List | `#/users` | Fixture + VistA user search | Working prototype |
| User Detail | `#/users/:id` | Fixture only (detail) | Fixture-backed |
| Role Assignment | `#/roles` | Fixture only | Fixture-backed |
| Guided Tasks | `#/guided-tasks` | Static instructions | 5 terminal workflows |

### 3.4 MUMPS Write Patterns (from archive)

**ZVEUSER.m — EDITUSER (edit existing user):**
```mumps
EDITUSER(RESULT,USERIEN,FIELD,VALUE)
 ; FIELD maps: NAME→.01, TITLE→8, SERVICE→29, DISUSER→7, PRIMARY_MENU→201
 N FDA,FNUM,ERR
 S FNUM=$$FLDNUM(FIELD)
 Q:FNUM=""
 S FDA(200,USERIEN_",",FNUM)=VALUE
 D FILE^DIE("E","FDA","ERR")
 S RESULT(0)=$S($D(ERR):"ERROR: "_$G(ERR("DIERR",1,"TEXT",1)),1:"OK")
```

**ZVEUSER.m — ADDKEY (assign key to user):**
```mumps
ADDKEY(RESULT,USERIEN,KEYIEN)
 ; Check if already assigned, then UPDATE^DIE to subfile 200.051
 N FDA,IEN,ERR
 ; ... idempotency check ...
 S FDA(200.051,"+1,"_USERIEN_",",".01")=KEYIEN
 D UPDATE^DIE("E","FDA","IEN","ERR")
```

**ZVECREUSER.m — Full user creation (distro overlay):**
```mumps
 S C0XFDA(200,"+1,",.01)=NAME
 S C0XFDA(200,"+1,",1)=INITIALS
 S C0XFDA(200,"+1,",2)=$$EN^XUSHSH(ACCESS_CODE)
 S C0XFDA(200,"+1,",11)=$$EN^XUSHSH(VERIFY_CODE)
 S C0XFDA(200,"+1,",20.4)=ESIG_PLAIN_TEXT  ; input transform auto-hashes
 S C0XFDA(200,"+1,",201)="`"_MENU_IEN      ; backtick = IEN pointer
 D UPDATE^DIE("E",$NA(C0XFDA),$NA(C0XIEN),$NA(C0XERR))
```

---

## 4. RPC Strategy Decision Tree

```
Start: Does VEHU have XUS IAM RPCs?
  │
  ├─ YES → Use XUS IAM for user lifecycle CRUD
  │         Keep ORWU NEWPERS for search (confirmed, fast)
  │         Keep ORWU HASKEY / VALIDSIG for quick checks
  │         XUS IAM BIND USER enables OIDC identity mapping
  │
  └─ NO  → Two sub-paths:
            │
            ├─ Install ZVEUSER.m via ZVEMINS.m pattern
            │   Use VE USER * RPCs for full CRUD
            │   Matches archive route patterns exactly
            │   Maintenance burden: custom MUMPS
            │
            └─ Read-only with Tier 1 RPCs only
                Use ORWU NEWPERS for search
                Use XWB GET VARIABLE VALUE for detail reads
                Guided terminal for all writes
                Lowest risk, least functionality
```

**Recommended path:** Probe XUS IAM first. If available, prefer standard Kernel RPCs. If missing, install ZVEUSER.m for reads and use guided terminal for writes until trust is established.

---

## 5. Read Workspace Scope (Slice 1)

The following operations form the Slice 1 read workspace (Mode A, zero write risk):

| Operation | Primary RPC | Fallback RPC | UI Surface |
|-----------|------------|-------------|-----------|
| Search users | `ORWU NEWPERS` (confirmed) | `VE USER LIST` (custom) | Search bar → user list |
| User detail | `XUS GET USER INFO` + `XWB GET VARIABLE VALUE` | `VE USER DETAIL` (custom) | User detail panel |
| Current user context | `ORWU USERINFO` (confirmed) | `XUS GET USER INFO` (confirmed) | Session header |
| List security keys | `XUS ALLKEYS` (probe needed) | `VE KEY LIST` (custom) | Key catalog page |
| Check user key | `ORWU HASKEY` (confirmed) | `ORWU NPHASKEY` (probe needed) | Key badge on user detail |
| Validate e-signature | `ORWU VALIDSIG` (confirmed) | — | Signature status indicator |
| View divisions | `XUS DIVISION GET` (confirmed) | — | Division selector |

### Data contract for Slice 1 API responses:

**User list response:**
```json
{
  "ok": true,
  "source": "vista",
  "rpcUsed": ["ORWU NEWPERS"],
  "data": [
    { "ien": 87, "name": "PROVIDER,CLYDE WV" },
    { "ien": 88, "name": "NURSE,HELEN WV" }
  ]
}
```

**User detail response (composite from multiple RPCs):**
```json
{
  "ok": true,
  "source": "vista",
  "rpcUsed": ["XUS GET USER INFO", "XWB GET VARIABLE VALUE"],
  "data": {
    "ien": 87,
    "name": "PROVIDER,CLYDE WV",
    "initials": "CWP",
    "title": "PHYSICIAN",
    "service": "MEDICINE",
    "division": "WORLDVISTA",
    "active": true,
    "electronicSignatureExists": true,
    "primaryMenu": "OR CPRS GUI CHART",
    "keys": ["PROVIDER", "ORES", "XUMGR"]
  }
}
```

---

## 6. Guided Write Scope (Slice 2)

These operations require Mode B (live read + guided write):

| Operation | Write RPC (if available) | Guided Terminal Fallback | Risk Level |
|-----------|------------------------|------------------------|-----------|
| Create user | `XUS IAM ADD USER` (probe) or ZVECREUSER.m pattern | Terminal: `^XUP` → User Management | HIGH — multi-file coordination |
| Edit user | `XUS IAM EDIT USER` (probe) or `VE USER EDIT` | Terminal: FileMan edit File 200 | MEDIUM — single field at a time |
| Assign key | `VE USER ADD KEY` (custom) | Terminal: Key Management option | MEDIUM — subfile write |
| Remove key | `VE USER REMOVE KEY` (custom) | Terminal: Key Management option | MEDIUM — subfile delete |
| Deactivate user | `XUS IAM TERMINATE USER` (probe) or `VE USER DEACTIVATE` | Terminal: DISUSER field edit | HIGH — affects access |

### Guided write workflow pattern:

1. Browser displays current VistA state (from Slice 1 reads)
2. Admin fills in the desired change via form
3. If direct RPC exists and is confirmed: execute via API with audit capture
4. If no direct RPC: browser generates terminal command guidance
5. Evidence capture: admin confirms completion (screenshot or terminal output)
6. Browser re-reads VistA state to verify the change took effect

---

## 7. PHI and Security Considerations

| Field | Classification | Handling |
|-------|---------------|----------|
| User name | PII (employee data) | Display normally; do not include in external logs |
| SSN | PHI/PII | ZVEUSER.m returns last 4 only; never store full SSN |
| DOB | PII | Display in detail view; redact from audit logs |
| Access code | Credential | Never retrievable (hashed); only exists-check |
| Verify code | Credential | Never retrievable (hashed); only exists-check |
| Electronic signature code | Credential | Never retrievable (hashed); only exists-check / validate |
| Security key assignments | Access control | Display for authorized admins only |

---

## 8. Open Probing Requirements

Before Slice 1 implementation can finalize its RPC selection:

| Probe | Target | Why |
|-------|--------|-----|
| `XUS IAM FIND USER` | VEHU File 8994 | May provide richer search than ORWU NEWPERS |
| `XUS IAM DISPLAY USER` | VEHU File 8994 | May provide richer detail than composite reads |
| `XUS IAM ADD USER` | VEHU File 8994 | Determines Slice 2 write strategy |
| `XUS IAM EDIT USER` | VEHU File 8994 | Determines Slice 2 write strategy |
| `XUS IAM TERMINATE USER` | VEHU File 8994 | Determines deactivation approach |
| `XUS IAM REACTIVATE USER` | VEHU File 8994 | Determines reactivation approach |
| `XUS IAM BIND USER` | VEHU File 8994 | Determines OIDC identity mapping |
| `XUS ALLKEYS` | VEHU File 8994 | May replace VE KEY LIST (no custom install) |
| `XUS KEY CHECK` | VEHU File 8994 | May supplement ORWU HASKEY |
| `ORWU NPHASKEY` | VEHU File 8994 | Check key for any user (not just current) |
| `XUS IS USER ACTIVE` | VEHU File 8994 | Active status check without full detail |

**Probe method:** Add each RPC to `ZVEPROB.m` LIST array and run against the VEHU container. If it returns `IEN:NNN` → available. If `NOT IN FILE 8994` → genuinely missing.

---

## 9. Source Map

| Evidence | Source | Confidence |
|----------|--------|-----------|
| File 200 field map | ZVEUSER.m + ZVECREUSER.m + Truth Discovery Pack | EXT-CONFIRMED (code reads/writes these fields) |
| File 19.1 structure | ZVEUSER.m KEYS entry point + Truth Discovery Pack | EXT-CONFIRMED |
| ORWU NEWPERS availability | VEHU probe, IEN 213 | EXT-CONFIRMED |
| ORWU HASKEY availability | VEHU probe, IEN 306 | EXT-CONFIRMED |
| ORWU VALIDSIG availability | VEHU probe, IEN 195 | EXT-CONFIRMED |
| XUS GET USER INFO availability | VEHU probe, IEN 595 | EXT-CONFIRMED |
| XUS DIVISION GET availability | VEHU probe, IEN 596 | EXT-CONFIRMED |
| XUS IAM RPCs existence | Vivian index, package XU | VIVIAN-LOCAL (not yet VEHU-probed) |
| VE USER * RPCs | Archive rpcRegistry.ts + ZVEUSER.m | EXT-CONFIRMED (code exists, needs install) |
| Electronic signature hashing | ZVECREUSER.m field 20.4 + ORWU VALIDSIG | EXT-CONFIRMED |
| ^XUSEC key lookup | ZVEUSER.m, Truth Discovery Pack | EXT-CONFIRMED (global pattern documented) |

---

*Generated: Task 3 of queue pack "VISTA ADMIN CORPUS + TERMINAL-TO-UI TRANSLATION PROGRAM"*
*Research date: 2026-03-21*
