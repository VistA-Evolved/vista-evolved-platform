# VistA Evolved — Data Mapping Reference

**Generated:** April 4, 2026  
**Backend:** tenant-admin server (port 4520) → VistA XWB/DDR (port 9434)  
**Proxy:** Vite dev server (port 3000) — `/api/ta/v1/*` → `http://127.0.0.1:4520/api/tenant-admin/v1/*`  
**Auth:** Bearer token via `Authorization` header, stored in `sessionStorage` key `ve-session-token`

---

## Endpoint Inventory

### Authentication

| Endpoint | Method | Frontend Function | Page(s) | Notes |
|----------|--------|-------------------|---------|-------|
| `/auth/login` | POST | `login(username, password, tenantId)` | LoginPage | Body: `{ accessCode, verifyCode, tenantId }` |
| `/auth/session` | GET | `getSession()` | — | Not currently used |
| `/auth/logout` | POST | `logout()` | SystemBar | Clears session token |

**Login response shape:**
```json
{
  "ok": true,
  "token": "292b926ce7dd7a4795a...",
  "user": {
    "duz": "1",
    "name": "PROGRAMMER,ONE",
    "keys": ["XUMGR", "XUPROG", "XUPROGMODE", ...]
  },
  "roleCluster": { "id": "RC-12", "label": "FileMan DBA / Programmer" },
  "navGroups": ["dashboard", ...]
}
```

**Frontend transform:** Token stored via `setSessionToken(result.token)`. User name displayed in SystemBar.

---

### Staff (NEW PERSON #200)

| Endpoint | Method | Frontend Function | Page(s) |
|----------|--------|-------------------|---------|
| `/users` | GET | `getStaff()` | StaffDirectory |
| `/users/:duz` | GET | `getStaffMember(duz)` | StaffDirectory detail, StaffForm edit |
| `/users` | POST | `createStaffMember(data)` | StaffForm create |
| `/users/:duz` | PUT | `updateStaffMember(duz, data)` | StaffForm edit |
| `/users/:duz/deactivate` | POST | `deactivateStaffMember(duz)` | StaffDirectory |
| `/users/:duz/reactivate` | POST | `reactivateStaffMember(duz)` | StaffDirectory |
| `/users/:duz/terminate` | POST | `terminateStaffMember(duz)` | — |
| `/users/:duz/rename` | PUT | `renameStaffMember(duz, data)` | — |
| `/users/:duz/credentials` | PUT | `updateCredentials(duz, data)` | — |
| `/users/:duz/esig` | POST | `setESignature(duz, data)` | — |
| `/users/:duz/provider` | POST | `setProviderFields(duz, data)` | — |
| `/users/:duz/keys` | GET | `getUserPermissions(duz)` | StaffDirectory detail, StaffForm edit |

**`/users` response shape (list):**
```json
{
  "ok": true,
  "source": "vista",
  "data": [
    { "ien": "11272", "name": "Access,New" },
    { "ien": "11656", "name": "AIMIE,VACO" }
  ]
}
```

**`/users/:duz` response shape (detail):**
```json
{
  "ok": true,
  "source": "vista",
  "data": {
    "id": "11272",
    "ien": "11272",
    "name": "ACCESS,NEW",
    "username": "ACCESS,NEW",
    "title": "",
    "status": "active",
    "roles": [],
    "vistaFields": {
      ".01": "ACCESS,NEW",
      "4": "",
      "5": "",
      "8": "",
      "9": "666000184",
      "20.2": "NEW ACCESS",
      "20.3": "ACCESS,NEW",
      "20.4": "<Hidden>",
      "29": "INFORMATION RESOURCE MGMT"
    },
    "vistaGrounding": {
      "duz": "11272",
      "sex": "",
      "dob": "",
      "ssn": "666000184",
      "officePhone": "",
      "email": "",
      "initials": "NEW ACCESS",
      "sigBlockName": "ACCESS,NEW",
      "npi": "",
      "dea": "",
      "providerType": "",
      "authMeds": "",
      "serviceSection": "INFORMATION RESOURCE MGMT",
      "electronicSignature": {
        "status": "active",
        "hasCode": true,
        "sigBlockName": "ACCESS,NEW",
        "sigBlockTitle": ""
      }
    }
  }
}
```

**Frontend transform (StaffDirectory):**
- `id` → `S-${ien}` (formatted Staff ID)
- `name` → `u.name.toUpperCase()` (display format)
- `status` → merged from `/esig-status` bulk endpoint
- `esigStatus` → `esig.hasCode ? 'active' : 'incomplete'`
- `department` → only available on detail view via `vistaGrounding.serviceSection`
- `site` → not available on list view; would need division assignment data

**Frontend transform (StaffDirectory detail panel):**
- `title` → `data.title || vistaGrounding.sigBlockTitle`
- `department` → `vistaGrounding.serviceSection`
- `phone` → `vistaGrounding.officePhone`
- `email` → `vistaGrounding.email`
- `npi` → `vistaGrounding.npi`
- `dea` → `vistaGrounding.dea`
- `isProvider` → `Boolean(vistaGrounding.npi || vistaGrounding.providerType || vistaGrounding.authMeds)`
- `ssn` → `vistaGrounding.ssn ? '***-**-' + ssn.slice(-4) : ''`

---

### E-Signature Status

| Endpoint | Method | Frontend Function | Page(s) |
|----------|--------|-------------------|---------|
| `/esig-status` | GET | `getESignatureStatus()` | StaffDirectory |

**Response shape:**
```json
{
  "ok": true,
  "data": [
    {
      "id": "11272",
      "name": "Access,New",
      "duz": "11272",
      "status": "active",
      "esigStatus": "active",
      "hasCode": true,
      "sigBlockName": "NEW ACCESS",
      "sigBlockTitle": "ACCESS,NEW",
      "initials": "",
      "source": "vista"
    }
  ]
}
```

**Frontend transform:** Merged into staff list via `Map(esigList.map(e => [e.id, e]))`. Used for KPI cards (ready vs. incomplete counts) and E-Signature column badge.

---

### Permissions / Security Keys (SECURITY KEY #19.1)

| Endpoint | Method | Frontend Function | Page(s) |
|----------|--------|-------------------|---------|
| `/key-inventory` | GET | `getPermissions()` | PermissionsCatalog, RoleTemplates, StaffForm |
| `/users/:duz/keys` | GET | `getUserPermissions(duz)` | StaffDirectory detail |
| `/users/:duz/keys` | POST | `assignPermission(duz, keyData)` | PermissionsCatalog |
| `/users/:duz/keys/:keyId` | DELETE | `removePermission(duz, keyId)` | PermissionsCatalog |

**`/key-inventory` response shape:**
```json
{
  "ok": true,
  "data": [
    {
      "keyName": "A1AX APVCO",
      "vistaKey": "A1AX APVCO",
      "description": "",
      "category": "security-key",
      "holderCount": 0,
      "holders": [],
      "vistaGrounding": {
        "file19_1Ien": "113",
        "rpcUsed": "DDR LISTER"
      }
    }
  ]
}
```

**Frontend transform (PermissionsCatalog):**
- `id` → `vistaGrounding.file19_1Ien || keyName`
- `name` → `keyName`
- `module` → `inferModule(keyName)` using prefix-to-module map (OR→Order Entry, PS→Pharmacy, LR→Laboratory, etc.)
- `description` → `description || ''`
- `holderCount` → `holderCount`
- `holders` → `holders[]` (displayed in detail panel)

**`inferModule()` prefix map (from `transforms.js`):**
| Prefix | Module |
|--------|--------|
| OR, ORES, ORELSE | Order Entry |
| PS, PSO, PSJ, PSB | Pharmacy |
| LR | Laboratory |
| RA | Radiology |
| SD | Scheduling |
| DG | Registration |
| XU | Kernel/System |
| MAG | Imaging |
| TIU | Clinical Documents |
| SR | Surgery |
| IB | Billing |
| PROVIDER | Clinical |
| (other) | Other |

---

### Sites / Divisions (MEDICAL CENTER DIVISION #40.8)

| Endpoint | Method | Frontend Function | Page(s) |
|----------|--------|-------------------|---------|
| `/divisions` | GET | `getSites()` | SiteManagement, StaffForm, StaffDirectory, SystemBar |

**Response shape:**
```json
{
  "ok": true,
  "data": [
    {
      "ien": "11",
      "name": "VEHU CBOC",
      "stationNumber": "998",
      "institutionIen": null,
      "status": "active",
      "vistaGrounding": { "file": "40.8", "ien": "11", "status": "grounded" }
    },
    {
      "ien": "1",
      "name": "VEHU DIVISION",
      "stationNumber": "500",
      "status": "active"
    },
    {
      "ien": "10",
      "name": "VEHU-PRRTP",
      "stationNumber": "995",
      "status": "active"
    }
  ]
}
```

**Frontend transform:**
- `id` → `ien`
- `name` → `name`
- `siteCode` → `stationNumber`
- `status` → `status || 'active'`
- `type` → derived: `name.includes('CBOC') ? 'Community Clinic' : name.includes('PRRTP') ? 'Residential Treatment' : 'Medical Center'`

---

### Site Parameters (KERNEL SYSTEM PARAMETERS #8989.3)

| Endpoint | Method | Frontend Function | Page(s) |
|----------|--------|-------------------|---------|
| `/params/kernel` | GET | `getSiteParameters()`, `getMasterConfig()` | SiteParameters, MasterConfig |
| `/params/kernel` | PUT | `updateSiteParameters(data)`, `updateMasterConfig(data)` | SiteParameters, MasterConfig |

**Response shape:**
```json
{
  "ok": true,
  "rawLines": [
    "[Data]",
    "8989.3^1^.01^400^GOLD.VAINNOVATION.US",
    "8989.3^1^.02^G.IRM^G.IRM",
    "8989.3^1^.05^0^No",
    "8989.3^1^205^0^No",
    "8989.3^1^210^-100^-100",
    "8989.3^1^214^90^90",
    "8989.3^1^217^500^500",
    "8989.3^1^230^180^180",
    "8989.3^1^240^[WORD PROCESSING]",
    "VistA Evolved Local Sandbox ...",
    "8989.3^1^501^^No"
  ]
}
```

**Frontend transform (`parseKernelParams` in `transforms.js`):**

Parses DDR pipe-delimited lines. Format: `file^ien^fieldNum^internal^external`.

| Field # | Parsed Key | Label | Example Value |
|---------|-----------|-------|---------------|
| .01 | `domainName` | Domain Name | `GOLD.VAINNOVATION.US` |
| .02 | `primaryHfsDir` | Primary HFS Directory | `G.IRM` |
| 205 | `disableNewUser` | Disable New User Creation | `No` |
| 210 | `autoSignOffDelay` | Auto Sign-Off Delay (seconds) | `-100` |
| 214 | `rpcTimeout` | RPC Timeout (seconds) | `90` |
| 217 | `siteNumber` | Site Number / Name | `500` |
| 230 | `sessionTimeout` | Session Timeout (seconds) | `180` |
| 240 | `welcomeMessage` | Welcome Message | (word processing text) |
| 501 | `prodAccount` | Production Account | `No` |

Word Processing fields (field 240) span multiple lines; parser accumulates them until the next `8989.3^` prefix or `$$END$$`.

**VHA Directive 6500 enforcement (client-side):**
- `sessionTimeout` > 900 → blocked
- `autoSignOffDelay` > 900 → blocked

---

### Audit Log (Multiple Sources)

| Endpoint | Method | Frontend Function | Page(s) |
|----------|--------|-------------------|---------|
| `/audit/signon-log` | GET | `getAuditSignonLog()` | AuditLog |
| `/audit/error-log` | GET | `getAuditErrorLog()` | AuditLog |
| `/audit/failed-access` | GET | `getAuditFailedAccess()` | AuditLog |
| `/audit/fileman` | GET | `getAuditFileMan()` | AuditLog |
| `/audit/programmer-mode` | GET | `getAuditProgrammerMode()` | — (not exposed by backend) |

**`/audit/error-log` response shape:**
```json
{
  "ok": true,
  "data": [
    { "ien": "67664", "date": "67664", "errorCount": "12" }
  ]
}
```

**`/audit/signon-log`, `/audit/failed-access`, `/audit/fileman` response shapes:**
```json
{ "ok": true, "data": [] }
```
(Empty in sandbox — expected for a test environment.)

**Frontend transform (`normalizeAuditEntry` in `AuditLog.jsx`):**

All sources normalized to:
```
{ id, timestamp, _sortTime, user, action, actionColor, source, detail, raw }
```

| Source | Action Label | Action Color | Detail Source |
|--------|-------------|--------------|--------------|
| signon | Sign-On / Sign-Off | create | deviceUsed |
| error | Error | delete | errorText |
| failed | Failed Access | delete | reason |
| fileman | Data Change | update | fieldChanged + old→new values |

Entries sorted by `_sortTime` (numeric epoch ms, not string timestamps).

---

### System Health

| Endpoint | Method | Frontend Function | Page(s) |
|----------|--------|-------------------|---------|
| `/vista-status` | GET | `getVistaStatus()` | SystemMonitor, SystemBar |
| `/taskman/status` | GET | `getTaskManStatus()` | SystemMonitor |
| `/error-trap` | GET | `getErrorTrap()` | SystemMonitor |

**`/vista-status` response shape:**
```json
{
  "ok": true,
  "vista": {
    "ok": true,
    "url": "127.0.0.1:9434",
    "vistaReachable": true,
    "duz": "1",
    "userName": "PROGRAMMER,ONE"
  },
  "currentUser": { "duz": "1", "userName": "PROGRAMMER,ONE" },
  "connectionMode": "direct-xwb",
  "productionMode": "test"
}
```

**`/taskman/status` response shape:**
```json
{
  "ok": true,
  "data": { "status": "STOPPED", "lastRun": "" }
}
```

**`/error-trap` response shape:**
```json
{
  "ok": true,
  "data": [
    {
      "ien": "13",
      "errorText": "ADD~ZVEUSMG, More actual parameters than formal parameters...",
      "firstDateTime": "3260322.120203",
      "mostRecentDateTime": "3260322.120203",
      "routineName": "",
      "frequency": "",
      "lastGlobal": "",
      "lineOfCode": ""
    }
  ]
}
```

**Frontend transform (`transformErrorTrap` in `transforms.js`):**
- `id` → `ien`
- `error` → `errorText`
- `firstOccurrence` → `fmDateToIso(firstDateTime)` (FileMan date → ISO)
- `lastOccurrence` → `fmDateToIso(mostRecentDateTime)`
- `routine` → `routineName || errorText.match(/^(\S+~\S+)/)?.[1]`

---

### Alerts / Bulletins

| Endpoint | Method | Frontend Function | Page(s) |
|----------|--------|-------------------|---------|
| `/bulletins` | GET | `getAlerts()` | AlertsNotifications |
| `/bulletins/:ien` | PUT | `updateAlert(ien, data)` | AlertsNotifications |

**Response shape:**
```json
{ "ok": true, "data": [] }
```
(Empty in sandbox — expected for a test environment with no active bulletins.)

---

## Fields Not Available from Backend

These fields appear in the UI but cannot be sourced from the current backend API:

| Page | Field | Reason | Current Handling |
|------|-------|--------|------------------|
| Staff Directory | Role column | `/users` list returns only `ien` + `name` | Shows "—" in table; populated on detail click via `/users/:duz` |
| Staff Directory | Department column | Not in bulk list response | Shows "—" in table; populated on detail click |
| Staff Directory | Site column | No division assignment in list | Shows "—" |
| Staff Directory | Last Sign-In | Not returned by any current endpoint | Shows "—" |
| Staff Directory | Permission Count | Requires per-user key query | Shows "—" in table; populated on detail click |
| Role Templates | Role definitions | Backend `/roles` returns all 689 keys, not curated templates | 14 curated role templates maintained in frontend code |
| Role Templates | Staff count per role | No role-to-user tracking | Estimated static values |
| Site Management | Address, Director, Phone | `/divisions` returns only `ien`, `name`, `stationNumber` | Not displayed |
| Site Management | Staff count per site | Not returned | Not displayed |
| Site Parameters | Non-kernel parameters | Only `/params/kernel` exposed | Other categories show "Parameters Not Available" |
| Audit Log | Patient-specific filtering | No patient linkage in audit endpoints | Not implemented |
| Alerts | Notification stream | Backend only has `/bulletins` | Simplified to single alert tab |
| System Monitor | Scheduled tasks | No `/taskman/scheduled` response data | Tab not shown |
| System Monitor | Report generation | No report endpoints | Placeholder "Generate" buttons |
| Master Config | Two-person approval queue | No approval workflow backend | UI shows "Submit for Approval" but saves directly with toast |

---

## Transform Functions (src/utils/transforms.js)

| Function | Input | Output | Used By |
|----------|-------|--------|---------|
| `fmDateToDate(fmDate)` | FileMan date string (e.g., `3260322.120203`) | JS `Date` object | AuditLog, SystemMonitor |
| `fmDateToIso(fmDate)` | FileMan date string | ISO string | AuditLog |
| `formatDateTime(iso)` | ISO date string | `"Mar 22, 2026 12:02 PM"` | AuditLog, SystemMonitor |
| `transformUserList(users, esigMap)` | `/users` + `/esig-status` data | Staff list with merged esig | StaffDirectory |
| `transformUserDetail(raw)` | `/users/:duz` data | Flat detail object | StaffDirectory detail |
| `inferModule(keyName)` | VistA key name string | Module category string | PermissionsCatalog, StaffForm |
| `transformPermission(raw)` | `/key-inventory` entry | Permission object | PermissionsCatalog |
| `transformSite(raw)` | `/divisions` entry | Site object | SiteManagement |
| `parseKernelParams(rawLines)` | DDR raw lines array | Key-value parameter map | SiteParameters, MasterConfig |
| `transformErrorTrap(raw)` | `/error-trap` entry | Error trap object | SystemMonitor |

---

## Page → Endpoint Mapping Summary

| Admin Page | Primary Endpoint(s) | Records in Sandbox |
|------------|--------------------|--------------------|
| Login | POST `/auth/login` | — |
| Staff Directory | GET `/users`, `/esig-status`, `/divisions` (parallel) | 118 users, 118 esig, 3 divisions |
| Staff Directory Detail | GET `/users/:duz`, `/users/:duz/keys` (on click) | 1 user + N keys |
| Staff Form | GET `/divisions`, `/key-inventory` (ref data); POST/PUT `/users` (submit) | 3 sites, 689 keys |
| Permissions Catalog | GET `/key-inventory` | 689 keys |
| Role Templates | GET `/key-inventory` (key validation) | 689 keys |
| Site Parameters | GET `/params/kernel`; PUT `/params/kernel` | 18 DDR lines |
| Site Management | GET `/divisions` | 3 divisions |
| Audit Log | GET `/audit/signon-log`, `/audit/error-log`, `/audit/failed-access`, `/audit/fileman` (parallel) | 0 + 1 + 0 + 0 entries |
| Alerts & Notifications | GET `/bulletins` | 0 bulletins |
| System Monitor | GET `/taskman/status`, `/error-trap`, `/vista-status` (parallel) | 1 + 5 + 1 |
| Master Config | GET `/params/kernel`; PUT `/params/kernel` | 18 DDR lines |
| SystemBar | GET `/vista-status`, `/divisions` | User info + 3 sites |
