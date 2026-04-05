# VistA Evolved — Live Wiring Results

**Date:** April 4, 2026  
**Environment:** Local Docker VistA (vista08), tenant-admin on port 4520, Vite on port 3000  
**Connection Mode:** direct-xwb (RPC Broker over TCP/IP)  
**VistA Instance:** VEHU sandbox at 127.0.0.1:9434  
**Test Credentials:** PRO1234 / PRO1234!!  

---

## 1. Endpoints Called & Response Shapes

### Authentication
| Endpoint | Method | Response Shape |
|----------|--------|---------------|
| `/api/ta/v1/auth/login` | POST | `{ ok: true, token: "...", duz: "1", userName: "PROGRAMMER,ONE", greeting: "..." }` |

### Staff / Users
| Endpoint | Method | Response Shape |
|----------|--------|---------------|
| `/api/ta/v1/users` | GET | `{ ok: true, data: [{ ien: "11272", name: "ACCESS,NEW" }, ...] }` — 118 entries |
| `/api/ta/v1/users/:duz` | GET | `{ ok: true, data: { name, vistaGrounding: { duz, sex, dob, ssn, title, serviceSection, email, officePhone, npi, dea, ... } } }` |
| `/api/ta/v1/users/:duz/keys` | GET | `{ ok: true, data: [{ name: "KEY_NAME" }, ...] }` |
| `/api/ta/v1/esig-status` | GET | `{ ok: true, data: [{ duz: "11272", hasESig: true }, ...] }` — 118 entries |

### Permissions / Security Keys
| Endpoint | Method | Response Shape |
|----------|--------|---------------|
| `/api/ta/v1/key-inventory` | GET | `{ ok: true, data: [{ ien, keyName: "ORES", holderCount: 5, holders: [...] }, ...] }` — 689 entries |

### Sites / Divisions
| Endpoint | Method | Response Shape |
|----------|--------|---------------|
| `/api/ta/v1/divisions` | GET | `{ ok: true, data: [{ ien, name: "VEHU CBOC", stationNumber: "998" }, ...] }` — 3 entries |

### Parameters
| Endpoint | Method | Response Shape |
|----------|--------|---------------|
| `/api/ta/v1/params/kernel` | GET | `{ ok: true, rawLines: ["400^VEHU.EXAMPLE.COM^...", ...] }` — 18 DDR lines |
| `/api/ta/v1/params/kernel` | PUT | `{ ok: true }` — accepts `{ values: {...}, reason: "..." }` |

### Audit
| Endpoint | Method | Response Shape |
|----------|--------|---------------|
| `/api/ta/v1/audit/signon-log` | GET | `{ ok: true, data: [] }` — 0 entries in sandbox |
| `/api/ta/v1/audit/error-log` | GET | `{ ok: true, data: [{ errorText, ... }] }` — 1 entry |
| `/api/ta/v1/audit/failed-access` | GET | `{ ok: true, data: [] }` — 0 entries in sandbox |
| `/api/ta/v1/audit/fileman` | GET | `{ ok: true, data: [] }` — 0 entries in sandbox |

### System Health
| Endpoint | Method | Response Shape |
|----------|--------|---------------|
| `/api/ta/v1/vista-status` | GET | `{ ok: true, vista: { vistaReachable: true, uri: "127.0.0.1:9434" }, currentUser: { userName, duz }, connectionMode: "direct-xwb", productionMode: "test" }` |
| `/api/ta/v1/taskman/status` | GET | `{ ok: true, data: { status: "STOPPED", lastRun: "" } }` |
| `/api/ta/v1/error-trap` | GET | `{ ok: true, data: [{ errorText, errorDate, ... }] }` — 5 entries |

### Alerts
| Endpoint | Method | Response Shape |
|----------|--------|---------------|
| `/api/ta/v1/bulletins` | GET | `{ ok: true, data: [] }` — 0 entries in sandbox |

---

## 2. Transforms Written

All transforms live in `src/utils/transforms.js`:

| Function | Purpose |
|----------|---------|
| `fmDateToDate(fmDate)` | Converts FileMan internal date (e.g., `3260404`) to JS `Date` |
| `fmDateToIso(fmDate)` | Converts FileMan date to ISO string |
| `formatDateTime(iso)` | Formats ISO date to `"MMM DD, YYYY h:mm AM/PM"` |
| `transformUserList(users, esigMap)` | Merges `/users` list with `/esig-status` map, formats staff IDs as `S-XXXXX` |
| `transformUserDetail(raw)` | Extracts `vistaGrounding` fields into flat detail object |
| `inferModule(keyName)` | Categorizes VistA key names by module prefix (OR→Clinical, PS→Pharmacy, LR→Lab, etc.) |
| `transformPermission(raw)` | Maps key-inventory entry to `{ name, module, description, holderCount, holders }` |
| `transformSite(raw)` | Maps division entry to `{ id, name, siteCode, status, type }` |
| `parseKernelParams(rawLines)` | Parses DDR pipe-delimited lines into `{ domainName, siteNumber, prodAccount, welcomeMessage, ... }` |
| `transformErrorTrap(raw)` | Normalizes error trap entry to `{ routine, errorText, errorDate, ... }` |

---

## 3. CRUD Operations Tested

| Operation | Result | Notes |
|-----------|--------|-------|
| **Login** (POST /auth/login) | ✅ PASS | Returns Bearer token, stored in sessionStorage |
| **Read users** (GET /users) | ✅ PASS | 118 users returned |
| **Read user detail** (GET /users/11272) | ✅ PASS | Full `vistaGrounding` object |
| **Read user keys** (GET /users/11272/keys) | ✅ PASS | Returns key array (0 for test user) |
| **Read e-sig status** (GET /esig-status) | ✅ PASS | 118 status entries |
| **Read key inventory** (GET /key-inventory) | ✅ PASS | 689 VistA security keys |
| **Read divisions** (GET /divisions) | ✅ PASS | 3 divisions |
| **Read kernel params** (GET /params/kernel) | ✅ PASS | 18 DDR parameter lines |
| **Read audit signon** (GET /audit/signon-log) | ✅ PASS | 0 entries (sandbox) |
| **Read audit errors** (GET /audit/error-log) | ✅ PASS | 1 entry |
| **Read audit failed** (GET /audit/failed-access) | ✅ PASS | 0 entries (sandbox) |
| **Read audit fileman** (GET /audit/fileman) | ✅ PASS | 0 entries (sandbox) |
| **Read vista-status** (GET /vista-status) | ✅ PASS | VistA reachable, user confirmed |
| **Read taskman** (GET /taskman/status) | ✅ PASS | Status STOPPED |
| **Read error-trap** (GET /error-trap) | ✅ PASS | 5 error entries |
| **Read bulletins** (GET /bulletins) | ✅ PASS | 0 entries (sandbox) |
| **Write params** (PUT /params/kernel) | ⚠️ Not tested live | UI wired; needs manual parameter change test |
| **Deactivate user** (PUT /users/:duz/deactivate) | ⚠️ Not tested live | UI wired with ConfirmDialog |
| **Create user** (POST /users) | ⚠️ Not tested live | StaffForm wired; needs manual test |
| **Update user** (PUT /users/:duz) | ⚠️ Not tested live | StaffForm edit mode wired |

---

## 4. Missing or Broken Endpoints

| Expected Endpoint | Status | Workaround |
|-------------------|--------|------------|
| `/api/ta/v1/audit/programmer-mode` | ❌ Not exposed | Omitted from audit aggregation; 4 sources used instead of 5 |
| `/api/ta/v1/reports/*` | ❌ Not exposed | System Monitor "Reports" tab shows placeholder generation UI |
| `/api/ta/v1/taskman/scheduled` | ❌ Not exposed | Scheduled tasks section omitted |
| `/api/ta/v1/bulletins/:id/acknowledge` | ❌ Not exposed | Acknowledge action wired but may 404 |
| `/api/ta/v1/config/:section` | ❌ Not a real route | Master Config reads from `/params/kernel` (same as Site Parameters) |

---

## 5. Fields Still Using Placeholder/Derived Data

| Page | Field | Reason |
|------|-------|--------|
| Staff Directory | Role column | `/users` returns only `ien` + `name`; role derived from user detail on click |
| Staff Directory | Department column | Only available in user detail view, not bulk list |
| Staff Directory | Last Sign-In | Not returned by `/users` endpoint; shows "—" |
| Staff Directory | Last Updated | Not returned by backend |
| Role Templates | Role definitions | Hardcoded 14 role templates with curated permission bundles; no `/roles` curation endpoint |
| Role Templates | Staff counts per role | Estimated values; no backend role-assignment tracking |
| Site Management | Address, Director, Phone | `/divisions` returns only `ien`, `name`, `stationNumber` |
| Site Management | Staff count per site | Not returned by backend |
| Site Parameters | Clinical/Pharmacy/Lab/etc categories | Only kernel parameters available via `/params/kernel`; other namespaces not exposed |
| Audit Log | Patient-specific audit | No patient linkage in current audit endpoints |
| Alerts | Notification tab | Backend only exposes `/bulletins`; no separate notification stream |
| System Monitor | Scheduled tasks | No `/taskman/scheduled` endpoint |
| System Monitor | Report generation | No report endpoints; UI provides placeholder "Generate" buttons |
| Master Config | Two-person integrity workflow | UI shows "Submit for Approval" but backend applies changes directly |

---

## 6. Login Credentials Used

| Credential | Value |
|------------|-------|
| Access Code | `PRO1234` |
| Verify Code | `PRO1234!!` |
| Tenant ID | `local-dev` |
| Returned DUZ | `1` |
| Returned User | `PROGRAMMER,ONE` |
| Token Type | Bearer (JWT-like opaque token) |
| Token Storage | `sessionStorage` key `ve-token` |

---

## 7. Verification Checklist

### Staff Directory
- [x] Loads 118 real VistA users
- [x] KPI cards show real calculated counts (118 total, active/inactive breakdown, esig ready/incomplete)
- [x] Search filters the real user list
- [x] Filter dropdowns populated from real data (sites from /divisions)
- [x] Detail panel shows real data for clicked user (name, DUZ, title, department, status)
- [x] Detail panel shows real permission pills from /users/:duz/keys
- [x] Provider detail shows NPI/DEA when available in vistaGrounding
- [x] Loading skeleton displayed during fetch
- [x] Error state displays if API fails

### Staff Form
- [x] Edit mode pre-populates from real user data via /users/:duz
- [x] Locations step shows 3 real divisions from /divisions
- [x] Permissions step shows 689 real keys from /key-inventory
- [x] Permission module grouping uses inferModule()
- [ ] CREATE actually creates a user in VistA — not tested in sandbox
- [ ] EDIT saves changes to VistA — not tested in sandbox

### Permissions Catalog
- [x] Loads 689 real security keys
- [x] Shows real holder counts per key
- [x] Category filter works against inferred module data
- [x] Detail panel shows holders list from key-inventory
- [x] Loading skeleton displayed during fetch
- [x] Error state displays if API fails

### Role Templates
- [x] 14 curated role templates displayed
- [x] Permission validation against live VistA keys (vistaKeySet from /key-inventory)
- [x] Keys not in VistA flagged with "Not in VistA" badge
- [ ] Role CRUD not connected — backend doesn't have curated roles endpoint

### Site Management
- [x] Loads 3 real divisions (VEHU CBOC, VEHU DIVISION, VEHU-PRRTP)
- [x] Site cards show real name, station number, derived type
- [x] Workspace toggles functional (client-side state)
- [x] Loading skeleton displayed during fetch

### Site Parameters
- [x] Loads real kernel parameters from /params/kernel (18 DDR lines)
- [x] Displays parsed values: domain, site number, production status, welcome message
- [x] VHA enforcement works: session timeout >15 shows red badge and blocks save
- [x] Save wired to PUT /params/kernel with audit reason modal
- [ ] Save actually writes to VistA — not tested in sandbox
- [x] Loading states functional

### Audit Log
- [x] Loads real entries from 4 audit sources in parallel
- [x] Shows 1 error-log entry (sandbox has minimal audit history)
- [x] Filter bar filters real data
- [x] CSV export generates from filtered data
- [x] Proper empty state for sources returning 0 entries
- [x] Loading skeleton displayed during fetch

### Alerts & Notifications
- [x] Loads real bulletins from /bulletins (0 in sandbox — correct)
- [x] Empty state properly displayed with informative message
- [x] Loading state functional

### System Monitor
- [x] Shows real TaskMan status: STOPPED
- [x] Shows real VistA connection: Connected at 127.0.0.1:9434
- [x] Shows real error trap count: 5 entries
- [x] Error trap tab displays actual error entries
- [x] VistA status details: reachable, URI, connection mode, user, production mode
- [x] Loading skeleton displayed during fetch

### Master Configuration
- [x] Loads real parameter values from /params/kernel (same source as Site Parameters)
- [x] VHA enforcement badges appear on real values
- [x] Audit reason required before save
- [x] Two-person integrity UI present (with "not yet connected" toast fallback)
- [x] Loading state functional

### Login & Session
- [x] Login works with real VistA credentials (PRO1234 / PRO1234!!)
- [x] Token stored in sessionStorage under 've-token'
- [x] Session persists across page navigation
- [x] RequireAuth redirects to /login when no token
- [x] SystemBar shows real user name "PROGRAMMER,ONE"
- [x] Sign Out clears token and redirects to login

### Site Selector
- [x] Shows 3 real division names from /divisions
- [x] Default selection: VEHU CBOC (998)
- [x] Dropdown functional with all 3 sites

### Code Quality
- [x] Zero mock data arrays remain in component files (all removed or replaced by live fetch)
- [x] Zero critical console errors during operation
- [x] All loading states work (skeleton → data transition)
- [x] All error states work (ErrorState component with retry)
- [x] React Router future flag warnings are non-blocking informational messages

---

## 8. Architecture Summary

```
Browser (localhost:3000)
  ├── LoginPage → POST /api/ta/v1/auth/login → stores Bearer token
  ├── RequireAuth guard → checks sessionStorage for token
  ├── SystemBar → GET /vista-status + GET /divisions (live user + site data)
  └── Admin Pages
       ├── StaffDirectory → GET /users + /esig-status + /divisions (parallel)
       │                   → GET /users/:duz + /users/:duz/keys (on click)
       ├── StaffForm → GET /divisions + /key-inventory (ref data on mount)
       │              → GET /users/:duz + /users/:duz/keys (edit mode)
       ├── PermissionsCatalog → GET /key-inventory (689 keys)
       ├── RoleTemplates → GET /key-inventory (for key validation)
       ├── SiteParameters → GET /params/kernel → parseKernelParams()
       │                  → PUT /params/kernel (on save)
       ├── SiteManagement → GET /divisions (3 sites)
       ├── AuditLog → GET /audit/signon-log + /error-log + /failed-access + /fileman (parallel)
       ├── AlertsNotifications → GET /bulletins
       ├── SystemMonitor → GET /taskman/status + /error-trap + /vista-status (parallel)
       └── MasterConfig → GET /params/kernel → parseKernelParams()
                        → PUT /params/kernel (on save)

Vite Proxy:
  /api/ta/v1/* → http://127.0.0.1:4520/api/tenant-admin/v1/*
  /api/op/v1/* → http://127.0.0.1:4510/api/operator/v1/*
```

---

## 9. Known Limitations

1. **Bulk user list is minimal**: `/users` only returns `ien` + `name`. Rich columns (role, department, last sign-in) require per-user detail fetch, which is not practical for 118 users. These columns show "—" in the table until a row is clicked.

2. **Audit history is sparse in sandbox**: The VEHU sandbox has minimal audit trail activity. In a production VistA with active users, all 5 audit sources would return substantial data.

3. **TaskMan is stopped**: This is expected for a Docker sandbox. The UI correctly displays a warning about TaskMan being stopped.

4. **No bulletin data**: The sandbox has 0 bulletins. The Alerts page correctly shows an empty state.

5. **Parameter writes untested**: While the PUT endpoint is wired and the UI flow (edit → audit reason modal → save) is complete, an actual parameter write was not executed to avoid modifying the sandbox state.

6. **Role templates are curated, not backend-sourced**: The 14 role definitions are maintained in the frontend because the backend doesn't have a curated roles API. Permission key validation against live VistA keys is functional.

7. **Two-person integrity is UI-only**: The "Submit for Approval" workflow on Master Config shows the UI but falls back to direct save with a toast notification since the backend doesn't have an approval queue.
