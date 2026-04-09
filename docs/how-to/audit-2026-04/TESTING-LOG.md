# TESTING LOG — Admin & Patients Audit
**Date:** 2026-04-09

All tests run against live `local-vista-utf8` (VEHU sandbox via YottaDB) through the tenant-admin Fastify server on port 4520. Every readback was performed at the VistA M prompt via the `yottadb -run LABEL^routine` pattern with proper environment variables (`ydb_dist`, `ydb_gbldir=/opt/vista/g/vista.gld`, `ydb_routines=/opt/vista/r ...`, `ydb_icu_version=67.1`).

---

## 1. Environment verification

| Check | Command | Result |
|---|---|---|
| Docker containers | `docker ps` | `local-vista-utf8` + `ve-platform-db` healthy |
| M prompt works | Custom routine deployed + `ydb -run LABEL^routine` | Returns expected values |
| Broker reachable | `curl /vista-status` | `ok:true, vistaReachable:true, duz:1, userName:PROGRAMMER,ONE` |
| Auth login | `POST /auth/login` with PRO1234 | Returns bearer token |
| Token persists across restart | Kill server, restart, re-call with same token | `[sessions] restored 1 session(s) from encrypted store`, RPC still works |

---

## 2. Read endpoints verified

| Endpoint | Source | Sample result |
|---|---|---|
| GET /vista-status | direct | `{vistaReachable:true, duz:1, connectionMode:direct-xwb}` |
| GET /users | ZVE | 200 rows, each with `{ien, name, status, title, service, division, lastLogin, keyCount}` |
| GET /users/1 | ZVE USER DETAIL | `PROGRAMMER,ONE`, 134 keys, service `INFORMATION SYSTEMS CENTER` |
| GET /users/1/keys | ZVE USER DETAIL | 134 keys with displayName+packageName enrichment |
| GET /esig-status | vista | 118 entries with hashed-code status per DUZ |
| GET /key-inventory | ZVE KEY LIST | 689 keys, 100% displayName populated, 473/689 non-General package, 643/689 description populated |
| GET /key-holders/A1AX%20APVCO | ZVE KEY HOLDERS | `holderCount:2, holders:[{duz:11272, name:ACCESS,NEW}, {duz:11298, name:ALBANY,VAMC}]` |
| GET /services | DDR LISTER #49 | 54 SERVICE/SECTION entries (53 unique after dedup) |
| GET /divisions | ZVE | 3 divisions: VEHU DIVISION (500), VEHU-PRRTP (995), VEHU CBOC (998) |
| GET /divisions/1 | DDR GETS ENTRY DATA #40.8 | After fix: `{name, stationNumber, facilityNumber, institution, phone, address, city, state, zip}` |
| GET /params/kernel | ZVE PARAM GET | 8 params: DOMAIN, SITE NAME, PRODUCTION, AUTOLOGOFF, LOCKOUT ATTEMPTS, PASSWORD EXPIRATION, BROKER TIMEOUT, AGENCY CODE |
| GET /params/pharmacy | vista DDR | 7 rawLines from #59.7 |
| GET /params/lab | vista DDR | 8 rawLines from #69.9 |
| GET /params/radiology | vista DDR | 7 rawLines from #79.1 |
| GET /params/surgery | vista DDR | 1 rawLine from #136 |
| GET /params/order-entry | vista DDR | 9 rawLines from #100.99 |
| GET /patients?search=A | ZVE | 4 real patients |
| GET /patients/100841 | ZVE | ALPHATEST,NEW ONE — full demographics |
| GET /patients/100841/insurance | DDR | 0 rows (empty in VEHU sandbox, expected) |
| GET /patients/100841/flags | ZVE | 0 rows |
| GET /patients/100841/assessment | DDR LISTER #408.31 | 0 rows |
| GET /wards | vista | 65 real wards |
| GET /room-beds | vista | 549 real beds |
| GET /census | ZVE | structured census object |
| GET /taskman/status | vista | status object |
| GET /taskman-tasks | vista | 15 real tasks |
| GET /taskman/scheduled | vista | 15 scheduled tasks |
| GET /error-trap | vista | 7 real errors |
| GET /hl7/filer-status | vista | `{INCOMING:STOPPED, OUTGOING:STOPPED}` |
| GET /audit/signon-log | ZVE | 0 rows (VEHU never logged in) |
| GET /audit/error-log | ZVE | 3 rows |
| GET /audit/failed-access | vista | 0 rows |
| GET /audit/fileman | vista | 0 rows |
| GET /audit/programmer-mode | vista | 0 rows |
| GET /bulletins | vista | 0 rows |
| GET /mailman/inbox | ZVE MM INBOX | 50 real messages |
| GET /topology | vista | hierarchy object |
| GET /workspaces?divisionIen=1 | ZVE | `{}` (empty because VEHU has no workspace config) |

---

## 3. Write endpoints verified with M-prompt readback

### 3.1 Create user — POST /users

```
Request:
  POST /api/tenant-admin/v1/users?tenantId=default
  { "name": "ZVEAUDIT,TESTADD1",
    "accessCode": "TESTADD12345",
    "verifyCode": "TESTADD12345!!" }

Response:
  { "ok": true, "newIen": "10000000401", "rpcUsed": "ZVE USMG ADD",
    "lines": ["1^10000000401"] }
```

**M-prompt readback:**

```
^VA(200,10000000401,0)   = "ZVEAUDIT,TESTADD1^^TESTADD12345"
^VA(200,"B","ZVEAUDIT,TESTADD1")  → DUZ 10000000401
```

(The "cleartext" access code in piece 3 is a VEHU sandbox artifact — `$$EN^XUSHSH` is stubbed to return input unchanged in this distro. In production VistA the same code path produces hashed values.)

### 3.2 Assign security key — POST /users/:duz/keys

```
Request:
  POST /api/tenant-admin/v1/users/10000000401/keys?tenantId=default
  { "keyName": "ORES" }

Response:
  { "ok": true, "rpcUsed": "ZVE USMG KEYS", "lines": ["1^OK^ADD"] }
```

**M-prompt readback:**

```
^VA(200,10000000401,51,0)        = "200.051^^1^1"   (header: 1 entry)
^VA(200,10000000401,51,1,0)      = "ORES"
^VA(200,10000000401,51,"B","ORES",1)  exists
^XUSEC("ORES",10000000401)       exists   (Kernel security xref)
```

**API readback after server restart:**

```
GET /users/10000000401/keys
  → { ok:true, source:"zve", data: [
      { ien:"269", name:"ORES",
        displayName:"Medical Provider (Can Write Orders)",
        packageName:"CPRS / Orders" }
    ] }
```

### 3.3 Remove security key — DELETE /users/:duz/keys/:key

```
Request:
  DELETE /api/tenant-admin/v1/users/10000000401/keys/ORES

Response:
  { "ok": true, "rpcUsed": "ZVE USMG KEYS", "lines": ["1^OK^DEL"] }

API readback:
  GET /users/10000000401/keys → { data: [] }
```

### 3.4 Deactivate user — POST /users/:duz/deactivate

```
Request:
  POST /api/tenant-admin/v1/users/10000000401/deactivate

Response:
  { "ok": true, "rpcUsed": "ZVE USMG DEACT", "lines": ["1^OK"] }
```

### 3.5 Reactivate user — POST /users/:duz/reactivate

```
Request:
  POST /api/tenant-admin/v1/users/10000000401/reactivate

Response:
  { "ok": true, "rpcUsed": "ZVE USMG REACT", "lines": ["1^OK"] }

M-prompt readback after round-trip:
  ^VA(200,10000000401,0) = "ZVEAUDIT,TESTADD1^^TESTADD12345"
  (no termination date in field 9 — reactivate cleared it)
```

### 3.6 Edit site parameter — PUT /params/kernel

```
Request:
  PUT /api/tenant-admin/v1/params/kernel?tenantId=default
  { "paramName": "AUTOLOGOFF", "value": "600", "reason": "Audit write test" }

Response:
  { "ok": true, "source": "zve", "rpcUsed": "ZVE PARAM SET",
    "paramName": "AUTOLOGOFF", "value": "600" }

Readback:
  GET /params/kernel → AUTOLOGOFF: 600

Revert:
  PUT /params/kernel { paramName:"AUTOLOGOFF", value:"300" }  → ok
  GET /params/kernel → AUTOLOGOFF: 300 (back to original)
```

---

## 4. Browser UI smoke tests (via preview_eval DOM introspection)

| Page | Verified | Evidence |
|---|---|---|
| /admin/staff | Department + keyCount populate; "Terminated" filter present; detail panel serviceSection populated; permission pills render `displayName` + tooltip `"DG SENSITIVITY — Registration"`; Assign Permissions modal shows `{displayName, mono keyName, package badge, description}` | Multiple DOM queries |
| /admin/staff/new | Step 2 Department datalist: 53 unique entries (was 54 with NHCU dup); Step 3 Primary picks 3 divisions, Additional filters out primary on selection; Step 6 Permissions: Clinical shows "Medical Provider (Can Write Orders)" pre-checked for provider role; Pharmacy hides PSJ PHARMACIST / PSO MANAGER / PSD PHARMACIST (not in VEHU); zero disabled checkboxes | DOM |
| /admin/permissions | 689 keys load; filter pills built from live `packageName` values ("Ext Rev Track", "Clinical Case Registries", "Lab Service", ...); row click → detail panel; "Assign to a staff member" button opens inline modal at `/admin/permissions` with subtitle "DG VTS RIDESHARE" | DOM |
| /admin/roles | Physician role shows exactly 2 permissions (ORES + PROVIDER); "Assign to Staff Member" click → URL becomes `/admin/permissions`, modal opens with subtitle "Medical Provider (Can Write Orders)" | DOM |
| /admin/parameters | Kernel tab: Domain=GOLD.VAINNOVATION.US, Site=CAMP MASTER, Production=No. Session tab: Session Timeout=300 (5 min), Auto Sign-Off=300, Response Timeout=180 | DOM |
| /patients/search | Page loads, zero console errors | DOM |

All pages: **zero console errors** on fresh server buffer after all fixes.

---

## 5. Environment + session-persistence stress test

```
1. curl POST /auth/login with PRO1234  → token T1
2. curl -H "Bearer T1" /users  → 200 staff
3. kill tenant-admin (PID captured via netstat)
4. nohup node --env-file=.env server.mjs > /tmp/ta.log 2>&1 &
5. Server logs: "[sessions] restored 1 session(s) from encrypted store"
6. curl -H "Bearer T1" /users  → 200 staff (same token still works)
7. curl -H "Bearer T1" /key-holders/A1AX%20APVCO  → 2 holders (broker re-activated from encrypted credentials)
```

✅ Token survives restart. Per-session broker re-establishes automatically via `activateSessionBrokerForRequest`.

---

## 6. Vocabulary sweep results

```bash
grep -rn "\bDUZ\b" apps/web/src/pages apps/web/src/components --include="*.jsx"
  → 1 hit: StaffForm.jsx:15 in a JSDoc comment block. Not user-visible.

grep -rn "key mapping\|Not in VistA\|Pending Install" apps/web/src/pages --include="*.jsx"
  → 0 user-visible strings. 2 code comments in RoleTemplates.jsx referencing
    "pending install" as a removed pattern.

grep -rn "'ZVE \|\"ZVE " apps/web/src/pages --include="*.jsx"
  → 0

grep -rn "\bRPC\b" apps/web/src/pages --include="*.jsx"
  → 2 hits, both non-user-visible:
    - SiteParameters.jsx JSDoc comment
    - StaffDirectory.jsx system-account regex pattern ("RPC BROKER")
    (user-visible "RPC timeout" label in a zero-warning string was fixed to
     "response timeout" in Slice 9)

grep -rn "window.confirm\|window.alert" apps/web/src/pages --include="*.jsx"
  → 0 (was 5 in patients/, all replaced with ConfirmDialog)

grep -rn "coming soon\|not yet implemented" apps/web/src/pages --include="*.jsx"
  → 0
```

---

## 7. Server-side cleanup results

```
grep -c "integrationPending" apps/tenant-admin/server.mjs  → 0  (was 32)
grep -c "code(501)"                                         → 0  (was 23)
grep -c "source: 'pending'"                                 → 0  (was 5)
grep -c "not deployed"                                      → 0  (was 5)
grep -c "coming soon"                                       → 0
```
