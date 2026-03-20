# Tenant Admin — VistA Users & Security Keys Map

> **Status:** Canonical reference for tenant-admin user management grounding.
> **Date:** 2026-03-20.
> **Type:** Explanation.
> **Scope:** Detailed mapping of VistA FILES 200, 200.01, 19.1, and 8932.1
> to available RPCs, globals, routines, and safe access patterns.
> **Parent:** `tenant-admin-vista-admin-truth-discovery-pack.md`

---

## 1. Users — NEW PERSON (File 200)

### File structure

```
File 200 — NEW PERSON
Global: ^VA(200,IEN,node)

Node 0:  NAME ^ INITIALS ^ SSN ^ DOB ^ ACCESS_CODE_HASH ^ VERIFY_CODE_HASH
Node 1:  TITLE ^ SERVICE/SECTION ^ key flags
Node 20.2: SIGNATURE BLOCK NAME (display name for signed documents)
Node 20.4: ELECTRONIC SIGNATURE CODE (hashed via XUSHSH — never plaintext)
Node 51,sub: SECURITY KEY subfile (File 200.01)
Node 201: PRIMARY MENU OPTION (IEN pointer to File 19)
```

### Display-safe fields

These fields are safe to surface in a tenant-admin web UI:

| Field | Node | Safe to display | Notes |
|-------|------|:---:|-------|
| Name | 0, piece 1 | Yes | Standard display |
| Initials | 0, piece 2 | Yes | |
| Title | 1, piece 1 | Yes | |
| Service/Section | 1, piece 2 | Yes | |
| Signature block name | 20.2 | Yes | |
| Primary menu option | 201 | Yes | Display as resolved option name |

### Security-sensitive fields (NEVER display in web UI)

| Field | Node | Why restricted |
|-------|------|---------------|
| SSN | 0, piece 3 | PHI — never display |
| DOB | 0, piece 4 | PHI — never display |
| Access code | 0, piece 5 | Hashed credential |
| Verify code | 0, piece 6 | Hashed credential |
| Electronic signature | 20.4 | Hashed credential |

### Available RPCs for user reads

| RPC | Purpose | Params | Returns |
|-----|---------|--------|---------|
| `ORWU NEWPERS` | Search users by name text | text, start | List of `IEN^Name` |
| `ORWU USERINFO` | Get user detail for ordering | (uses DUZ) | Provider class, keys, team info |
| `XUS GET USER INFO` | Get current session user | (no params) | DUZ, name, keys |
| `ORWU HASKEY` | Check if user holds a key | key_name | 1 or 0 |
| `ORWU VALIDSIG` | Validate e-signature code | es_code | 1 or 0 |
| `ORWU EXTNAME` | Get external name for IEN | file, IEN | Formatted name |

### Read pattern for user list

```
1. Call ORWU NEWPERS with search text (e.g., "" for all, or partial name)
   → Returns array of "IEN^NAME" strings
2. For each user IEN, call ORWU USERINFO or ORWU EXTNAME for detail
3. For key checks, call ORWU HASKEY per key name
```

### Indexes

| Global | Purpose |
|--------|---------|
| `^VA(200,"B",name,IEN)` | Name-to-IEN B-index |
| `^VA(200,"SSN",last4,IEN)` | SSN-to-IEN index (never display) |
| `^VA(200,"A",code,IEN)` | Access code hash index |

---

## 2. Security Keys — File 19.1

### File structure

```
File 19.1 — SECURITY KEY
Global: ^DIC(19.1,IEN,0)

Node 0:  KEY_NAME ^ DESCRIPTIVE_NAME ^ creator

Fast lookup: ^XUSEC(KEY_NAME,USER_IEN) = "" (exists = user holds key)
```

### Key allocation structure (File 200.01 subfile)

```
^VA(200,USER_IEN,51,sub_IEN,0) = KEY_IEN ^ date_assigned ^ who_assigned
```

### Available RPCs for key reads

| RPC | Purpose | Params | Returns |
|-----|---------|--------|---------|
| `ORWU HASKEY` | Check single key for DUZ user | key_name | 1 or 0 |

### Read pattern for key inventory

**Option A — Per-user key check (confirmed):**
```
For each known key name (PROVIDER, ORES, ORELSE, PSJ RPHARM, XUMGR, etc.):
  Call ORWU HASKEY with key_name
  → 1 = user holds key, 0 = does not
```

**Option B — Global read for comprehensive view (probable):**
```
XWB GET VARIABLE VALUE: $O(^DIC(19.1,"B",""))
  → Walk B-index to enumerate all key names
XWB GET VARIABLE VALUE: ^XUSEC(KEY_NAME,0)
  → Check if any users hold a specific key
```

### Reference keys for tenant admin

| Key name | Purpose | Risk level |
|----------|---------|:---:|
| PROVIDER | General clinical access | low |
| ORES | Ordering provider (can sign orders) | medium |
| ORELSE | Can enter orders for cosigning | medium |
| PSJ RPHARM | Pharmacy verification | medium |
| LRLAB | Laboratory access | low |
| XUMGR | User manager — can edit File 200 | high |
| XUPROGMODE | Programmer mode — full access | critical |
| OR CPRS GUI CHART | CPRS GUI access | low |
| SDOB | Scheduling supervisor | medium |
| SD SUPERVISOR | Scheduling admin | medium |

---

## 3. Person Class — File 8932.1

### File structure

```
File 8932.1 — PERSON CLASS
Global: ^USC(8932.1,IEN,0)

Node 0:  Classification ^ Status ^ ... (links to NUCC taxonomy)
```

### Purpose in tenant admin

Person class determines provider taxonomy: physician, nurse, pharmacist, etc.
This controls scope of practice within VistA (who can order what, who can sign
what, prescription authority).

### Read pattern

`ORWU USERINFO` returns the person class for the current user.
Direct File 8932.1 reads via `XWB GET VARIABLE VALUE` provide the full taxonomy.

---

## 4. Evidence from distro overlay

### ZVECREUSER.m — File 200 creation pattern

The distro overlay routine `ZVECREUSER.m` demonstrates the canonical VistA user
creation pattern:

1. **Data assembly:** Build FLDS/IENS arrays for `UPDATE^DIE`.
2. **Name:** Filed at `.01` (File 200 name field).
3. **Access code:** Pre-hashed via `HASH^XUSHSH` before filing at `.01` in subfield.
4. **Verify code:** Pre-hashed via `HASH^XUSHSH` before filing.
5. **Electronic signature:** Set at field 20.4 (also hashed).
6. **Primary menu:** Set at field 201 (IEN pointer to File 19 option).
7. **Division:** Set via `XUS DIVISION SET` after creation.
8. **Security keys:** Verified via `^XUSEC(KEY,DUZ)` after allocation.

**Key lesson:** All credential fields use `HASH^XUSHSH` — never store or transmit
plaintext credentials. The web UI must NEVER attempt direct credential writes.

### ZVECHECK.m — Diagnostic routine

`ZVECHECK.m` demonstrates direct global reads for diagnostic purposes:
- `^VA(200,IEN,0)` — user name extraction
- `^DIC(19.1,"B",keyname)` — key name lookup
- `^XUSEC(KEY,DUZ)` — key allocation check

This confirms the global paths documented above are correct.

---

## 5. Web surface design constraints

### MUST for user list/detail surfaces

1. Display only safe fields (name, title, initials, service, signature block)
2. Show key assignments as read-only checklist with live ORWU HASKEY verification
3. Label all data with `Source: VistA (live)` or `Source: fixture` honestly
4. No direct-to-VistA writes from the web interface
5. For credential operations, provide guided-terminal task launchers

### MUST NOT for security

1. Never display SSN, DOB, or hashed credential fields
2. Never transmit access/verify codes through the web API
3. Never allow web-initiated writes to File 200 credential fields
4. Never cache credential-adjacent data in browser storage

---
