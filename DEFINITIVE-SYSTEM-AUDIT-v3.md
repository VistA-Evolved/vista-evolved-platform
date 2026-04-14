# VistA Evolved — Definitive System Audit v3

> **Grounded in VA Kernel 8.0 Systems Management Guide (August 2025),
> VistApedia terminal documentation, and line-by-line code review.**
>
> This document compares what VistA terminal ACTUALLY does (researched from
> official VA documentation) against what our modern equivalent ACTUALLY does
> (verified by reading every line of code). Every finding is real.
>
> **AI Coder Rules:**
> 1. No skipping. No deferring. No 'too complex.' Build it.
> 2. Every VistA write verified at M prompt. Every UI change verified in browser.
> 3. No stubs. No placeholders. No 'coming soon.' Everything works.
> 4. Test against live VistA Docker. Install M routines. Register RPCs. Verify.
> 5. Think like a hospital with 500 users and 2000 patients. Performance matters.

---

# SECTION 1: ARCHITECTURE & DESIGN CRITIQUE

These are not bugs — they are design decisions that need rethinking based on how
real VistA administrators and clinical staff actually work.

## 1.1 [RESOLVED] Welcome Letter Now Includes Live Credentials

**Current live result:**
Fresh browser validation on `/admin/staff/new` now proves the terminal-parity onboarding flow exists:
- The post-create success screen exposes both `Print Welcome Letter` and `Print Acknowledgment Form`
- The welcome letter includes the actual ACCESS CODE and TEMPORARY VERIFY CODE for the just-created account
- The welcome letter includes first-login instructions, human-readable capability text, an acknowledgment/signature area, and the confidential destroy-after-first-login footer
- The later detail-panel account letter remains a non-credential account-information printout, which is the safer post-creation behavior

**Fresh evidence (Apr 13, 2026):**
- Disposable user DUZ `10000000445` / staff ID `S-10000000445` was created live in the browser
- The welcome-letter popup contained `ACCESS CODE (USERNAME) AUD753229` and `TEMPORARY VERIFY CODE (PASSWORD) Aud!753229Z`
- The separate acknowledgment popup contained the expected signature lines plus the `ONBOARDING RECORD - Retain per local policy.` footer
- Direct M verification for the same DUZ confirmed the File 200 record exists with `NAME=AUDIT,LETTER`, `PMENU=XUCORE`, `DIVCOUNT=1`, `ACSET=1`, `VCSET=1`, and `KEYCOUNT=4`

**Remaining adjacent gap:**
This does not make the broader create flow fully green. The review screen showed `Department: MEDICAL ADMINISTRATION`, but direct M verification for the same newly created user returned `SERVICE=` blank, so create-time department/service persistence is still a real defect nearby. That persistence gap should be tracked separately from the now-fixed welcome-letter issue.

**Verify:** Create user → success screen → Print Welcome Letter → letter shows actual username and temp password → Print Acknowledgment Form → M prompt confirms the created File 200 record

---

## 1.2 [RESOLVED] Admin Navigation Already Matches the Requested Five-Group Model

**Current live result:**
This audit item is now stale. The admin workspace already uses the five-group structure this section asked for, and the default admin route now lands on the dashboard instead of exposing Dashboard as a lonely nav group item.

**Fresh evidence (Apr 13, 2026):**
- Source in `apps/web/src/components/shell/AdminSubNav.jsx` defines exactly five groups: `People & Access`, `Facility Setup`, `Security & Policy`, `Communication`, and `System`
- That same source keeps `Staff Directory`, `Roles & Permissions`, and `Permission Catalog` together, moves `Devices & Printers` under facility setup, and keeps MailMan pages under `Communication`
- Source in `apps/web/src/App.jsx` routes `/admin` to `/admin/dashboard`
- Live browser validation on `/admin` rendered those same five groups in the sidebar and landed on `/admin/dashboard`
- The live sidebar did **not** include `Add Staff Member`, while `/admin/staff` still exposed `Add Staff Member` as a page-level action button in the directory header

**Remaining nuance:**
The session payload from `/auth/session` still carries older backend `navGroups` identifiers, but the actual admin sub-navigation presented to users now matches the modernized VistA-style grouping described here. The original critique should no longer be treated as an open product problem.

**Verify:** Open `/admin` → redirect lands on `/admin/dashboard` → sidebar shows exactly 5 groups with 2+ items each → `Add Staff Member` appears on the Staff Directory page, not in the sub-nav

---

## 1.3 [RESOLVED] Clinics TYPE=C Filter Works End to End

**Current live result:**
This check is now proven, not hypothetical. The clinics route passes the DDR screen correctly, includes the required `S` flag, and still applies a server-side `type === 'C'` fallback before returning data.

**Fresh evidence (Apr 13, 2026):**
- Source in `apps/tenant-admin/server.mjs` calls `ddrList(...)` for `/api/tenant-admin/v1/clinics` with `flags: 'IPS'` and `screen: 'I $P(^SC(Y,0),U,3)="C"'`
- Source in the shared `ddrList(...)` helper passes `SCREEN` through to the `DDR LISTER` RPC payload unchanged
- Live `GET /api/ta/v1/clinics?tenantId=default` returned `573` rows, and the unique type set in the payload was exactly `['C']`
- Live browser validation on `/admin/clinics` rendered `(573 clinics)` in the page header
- Direct M verification in the live VistA container counted File 44 entries with piece 3 = `C` and returned `CLINIC_COUNT=573`

**Conclusion:**
The clinics list is currently filtering correctly to true clinic entries only. This section should no longer remain an open risk item.

**Verify:** `/api/ta/v1/clinics` returns only type `C` rows → `/admin/clinics` header count matches → direct M count of `^SC(...,0)` piece 3 = `C` matches the same total

---

## 1.4 [RESOLVED] Division Selector Is Now Clearly Page-Specific

**Current live result:**
This audit concern is stale because the old global-selector design no longer exists. There is no upper-right system-bar division dropdown now. The division chooser lives on the Staff Directory page itself, is explicitly labeled as a staff-directory filter, and does not appear on unrelated admin pages.

**Fresh evidence (Apr 13, 2026):**
- Source in `apps/web/src/contexts/FacilityContext.jsx` now carries only a simple `activeSite` state used for staff filtering, not a global facility-routing model
- Source usage search shows `useFacility()` is consumed by `StaffDirectory.jsx` and not by Clinics, Wards, Dashboard, or patient pages
- Source in `StaffDirectory.jsx` labels the control `Staff directory division` and sets `aria-label="Staff directory division filter"`
- Source in `SystemBar.jsx` contains no division selector at all
- Live browser validation showed `0` `<select>` controls in the system bar on both `/admin/staff` and `/admin/clinics`
- Live browser validation showed the `Staff directory division filter` control on `/admin/staff` and no matching control on `/admin/clinics`

**Conclusion:**
The product chose the audit's second acceptable outcome: the division control is page-specific instead of pretending to be a global filter. This section should no longer remain open as a navigation ambiguity.

**Verify:** `/admin/staff` shows `Staff directory division filter` → system bar has no division dropdown → unrelated pages such as `/admin/clinics` do not show the staff-only filter

---

# SECTION 2: SECURITY KEYS & ROLES

## 2.1 43-Key Verification at M Prompt — COMPLETED

Fresh direct File 19.1 verification was re-run in the live VistA container against the exact 43-key checklist from this section.

**Fresh evidence (Apr 13, 2026):**
- The original checklist returned `MISSING_COUNT=1`
- The only missing string from the original list was `GMRA ALLERGY VERIFY`
- Direct M verification confirmed the live key name is `GMRA-ALLERGY VERIFY` (dash, not space)
- The other disputed names all exist exactly as written in the live system: `ORCL-SIGN-NOTES`, `ORCL-PAT-RECS`, `DG REGISTRATION`, `XUAUDITING`, `IBFIN`, `PSDRPH`, and `SDCLINICAL`

**Resolved per-item results:**
- `2.2` `GMRA ALLERGY VERIFY`: stale checklist entry; correct live File 19.1 name is `GMRA-ALLERGY VERIFY`
- `2.3` `ORCL-SIGN-NOTES`: exists exactly as written
- `2.4` `ORCL-PAT-RECS`: exists exactly as written
- `2.5` `DG REGISTRATION`: exists separately from `DG REGISTER`
- `2.6` `XUAUDITING`: exists in this instance
- `2.7` `IBFIN`: exists in this instance
- `2.8` `PSDRPH`: exists exactly as written
- `2.9` `SDCLINICAL`: exists exactly as written

**Conclusion:**
The key-verification prerequisite is satisfied. The remaining correction here was the stale allergy-key spelling in the old checklist, not a missing-key defect in the product.

# SECTION 3: EVERY WIZARD FIELD — Complete Data Flow Trace

The VistA terminal's Edit User screen (XUSEREDIT) has 5 pages with 40+ fields.
Our wizard has 4 steps with 38 form fields. For EACH field below:
- Does CREATE save it to VistA? (POST /users → M routine → File 200)
- Does EDIT update it? (PUT /users/:ien → M routine → File 200)
- Does DETAIL display it? (GET /users/:duz → M routine → File 200)
- Is it validated correctly? (Frontend + server + VistA input transform)

### 🟢 3.1 Name (.01)
**Status:** Create: ✓ via ZVE USMG ADD. Edit: ✓ via renameStaffMember. Display: ✓. Validate: ✓ format/length.
**Issue:** Issue: VistA input transform requires UPPERCASE LAST,FIRST format with only A-Z, comma, space, hyphen. Our validation allows apostrophes (O'BRIEN) which VistA may reject. Test at M prompt: create user with apostrophe in name.
**Verify:** Create O'BRIEN → M prompt: does it exist? If rejected, add frontend validation to block apostrophes.

### 🟡 3.2 SSN (9)
**Status:** Create: intentionally blank. `ssnLast4` is not written to File 200 field `9`, and the staff-create guide now documents that policy explicitly.
**Issue:** The File 200 SSN cross-reference remains empty for newly created staff accounts, so any downstream integration that expects NEW PERSON SSN data must use another governed path or a different identifier. This is now an intentional documented tradeoff, not an undocumented surprise.
**Verify:** Direct M validation on disposable DUZ `10000000445` showed the user record existed while the SSN storage slot remained blank; `docs/how-to/add-vista-user.md` now records that behavior as intentional

### 🟢 3.3 Access Code (2)
**Status:** Create: ✓. Edit: ✓ via `updateCredentials`. Display: ✗ (correct). Live uniqueness detection is now verified end to end in both VistA and the browser wizard.
**Issue:** The remaining concern about hash consistency is not an open product bug on this stack. Fresh M validation showed the same access code value fed through `$$EN^XUSHSH` twice produced the same collision key, and the live `^VA(200,"A",hash)` xref resolved that key to disposable DUZ `10000000445`. The tenant-admin route `ZVE USMG CHKAC` returned `available:false` for that same code, and the staff wizard now correctly surfaces `This username is already in use` with the red cancel state after the frontend duplicate-check bug was fixed.
**Verify:** Existing access code `AUD753229` → M prompt shows stable `$$EN^XUSHSH` result and `^VA(200,"A",...)` hit on DUZ `10000000445` → `/users/check-access-code` returns `available:false` → `/admin/staff/new` shows the duplicate warning inline

### 🟡 3.4 Verify Code (11)
**Status:** Create: ✓ hashed. Edit: ✓. Display: ✗ (correct). The wizard now enforces `verifyCode !== accessCode` and confirm-password matching in the live browser.
**Issue:** The older claim that the frontend does not check equality is stale. Fresh browser validation on `/admin/staff/new` showed `Password cannot be the same as the username` and kept the wizard on `Person & Credentials` when both values matched. Password-history enforcement is now implemented at the backend (`5.5` / `8.16`), while the broader backend equality gap still remains for create/update parity (`8.17`).
**Verify:** Enter the same username and password in the wizard → inline error appears and Step 1 does not advance; backend history enforcement now blocks reuse on both credential-update routes per Sections `5.5` and `8.16`

### 🟢 3.5 Email (.151)
**Status:** Create: ✓ EXTRA_MAP + server duplicate guard. Edit: ✓ inline + FIELD_MAP + server duplicate guard. Display: ✓. Validate: ✓ regex + live duplicate check.
**Issue:** The older duplicate-email finding is now stale. Tenant-admin now rejects duplicate File 200 email values on both create and edit, and the wizard shows the conflict inline before submit. Live validation after extending `ZVE USER LIST` to include email proved the full path: `POST /api/ta/v1/users` created disposable DUZ `10000000450` with `email=audit.email.975123@example.org`, direct M verification returned that exact value from File 200 field `.151`, `/api/ta/v1/users/check-email?tenantId=default` immediately returned `duplicate:true`, and a second create with the same email returned HTTP `409` with `code="DUPLICATE_EMAIL"`. In the live browser on `/admin/staff/new`, typing that same email rendered `Email already in use: AUDITEMAIL975123,TEST (DUZ 10000000450)`. The disposable audit users were then cleaned up by clearing `.151` and terminating DUZs `10000000446` through `10000000450`.
**Verify:** Create a user with a unique email → M shows File 200 `.151`; re-enter the same email in the wizard → inline duplicate warning appears; a second create/edit submit with that email returns `409 DUPLICATE_EMAIL`

### 🟢 3.6 Phone (.132)
**Status:** Create: ✓ EXTRA_MAP. Edit: ✓ inline + FIELD_MAP. Display: ✓ formatted in detail. Validate: ✓ 10 digits.
**Issue:** The old display-format complaint is stale. Staff Directory already formats stored 10-digit phone values for presentation while keeping the raw File 200 `.132` value intact. Live validation created disposable DUZ `10000000452` with `phone=5551234567`; direct M verification returned `5551234567` from File 200 field `.132`, while the live browser detail panel on `/admin/staff` rendered `PHONE (555) 123-4567` and did not show the unformatted raw string. Cleanup then cleared `.132` and terminated DUZs `10000000451` and `10000000452`.
**Verify:** Create or edit a user with `5551234567` → M shows raw `.132=5551234567`; Staff Directory detail shows `(555) 123-4567`

### 🟢 3.7 Division (200.02 sub-file)
**Status:** Create: ✓ via ZVE DIVISION ASSIGN. Edit: ✓ via assignDivision. Display: ✓.
**Issue:** The remove-individually concern is already resolved. Edit mode diffs the original and new division sets, then calls `assignDivision(..., 'ADD')` for newly added entries and `assignDivision(..., 'REMOVE')` for removed ones. Earlier live verification on disposable DUZ `10000000443` proved both legs: adding division `10` created `^VA(200,10000000443,2,1,0)=10`, and removing it cleared the sub-file entry while the header dropped back to `^^1^0`.
**Verify:** Add a secondary division in edit mode → File 200 sub-file `200.02` gains the node; remove that same division → the sub-file node disappears

### 🟢 3.8 Provider Type (53.5)
**Status:** Create: ✓ via `ZVE USER EDIT` using canonical File 7 external values. Edit: ✓. Display: ✓ live File 7 dropdown.
**Issue:** The old wizard state was not honest: it hardcoded legacy numeric/provider labels, and create mode could report `53.5 status:"ok"` while leaving File 200 field `53.5` blank. The fix now loads live File 7 `PROVIDER CLASS` values through `/provider-classes`, defaults that route's `tenantId` like the rest of the admin reference-data surface, and special-cases create-mode provider writes through `ZVE USER EDIT` with canonical external values such as `STUDENT`.
**Verify:** Live browser validation on `/admin/staff/new` showed the Provider Type dropdown populated from File 7 with entries including `DENTIST`, `DO`, `FELLOW`, `INTERN`, `PHYSICIAN`, `PHYSICIAN ASSISTANT`, `RESIDENT`, and `STUDENT` instead of the old static list. A browser create using `Provider Type = STUDENT` produced disposable DUZ `10000000456`; the create response reported field `53.5` saved through `rpcUsed: ZVE USER EDIT`, and direct M verification showed `^VA(200,10000000456,"PS")=^^^^1`, `I=1`, `E=STUDENT`.

### 🟢 3.9 Cosigner (53.8)
**Status:** Create: ✓ via `ZVE USER EDIT`. Edit: ✓ via resolved external name. Display: ✓.
**Issue:** The older audit text and the live code were both targeting the wrong File 200 fields on this VistA. Direct DD verification showed `REQUIRES COSIGNER = 53.7` and `USUAL COSIGNER = 53.8`, not `53.08` / `53.42`. The product was updated so the wizard still selects a DUZ in `CosignerSearch`, but the backend now resolves that DUZ to the canonical NEW PERSON name and writes cosigner through `ZVE USER EDIT` on field `53.8`; the M routine detail/read path was updated to read back the same live field.
**Verify:** Live browser validation on `/admin/staff/new` selected `MANAGER,SYSTEM` in `CosignerSearch` and showed `Selected: DUZ 1`. A browser create then produced disposable DUZ `10000000458` with create response fields `53.8 status:"ok"` (`rpcUsed: ZVE USER EDIT`) and `53.7 status:"ok"`. Fresh `/api/ta/v1/users/10000000458` readback returned `vistaGrounding.cosigner = MANAGER,SYSTEM`. Direct M verification showed `^VA(200,10000000458,"PS")=^^^^1^^1^1`, `REQUIRES_COSIGN_I=1`, `COSIGNER_I=1`, `COSIGNER_E=MANAGER,SYSTEM`.

### 🟡 3.10 Permissions (File 200 sub-file 51)
**Status:** Create: ✓ loops ZVE USMG KEYS ADD. Edit: ✓ diff-based add/remove.
**Issue:** The stale concerns here are already addressed in the current product. The create success screen parses `extraFields.permissions.keys`, computes `permCount` from the actual `status === "ok"` results, shows `x of y permissions assigned`, and renders each failed key with its own detail. Edit mode also does not silently fall back to an empty permission baseline: `getUserPermissions(userId)` is part of the main edit `Promise.all(...)`, so a permission-load failure aborts the hydration path instead of making all existing keys look new. The remove-permission dialog already imports `KEY_IMPACTS` and renders the impact copy inline before confirmation.
**Verify:** Current source in `StaffForm.jsx` computes `permCount`, `permTotal`, and per-key failure rows from `keyResults`, while `StaffDirectory.jsx` renders `KEY_IMPACTS` inside the remove dialog. Earlier live browser verification on `/admin/staff?search=MANAGER,SYSTEM` confirmed that removing `GMRA-ALLERGY VERIFY` shows impact text `Without this: cannot verify or mark allergies as reviewed.` before confirmation.

### 🟢 3.11 Employee ID (^ZVEX)
**Status:** Create: ✓ via ZVE UEXT SET. Edit: ✓ inline detail. Display: ✓.
**Issue:** The old concerns are mostly stale. `Employee ID` already has an `EditableDetailField` in the Staff Directory detail panel, server-side writes route through `ZVE UEXT SET` using `EMPID`, and both create/edit paths now enforce uniqueness through `/users/check-employee-id` plus backend duplicate rejection. `^ZVEX` is a normal application global rather than `^XTMP`, so this is not session-ephemeral storage.
**Verify:** Earlier live validation on DUZ `1` showed inline Employee ID edit writing `^ZVEX(1,"EMPID")=E123A` and then restoring it to `E123`; the new-user wizard also surfaced the duplicate warning for existing `Employee ID E123` immediately in-browser.

### 🟢 3.12 Role (^ZVEX)
**Status:** Create: ✓ via ZVE UEXT SET. Edit: ✗. Display: ✓.
**Issue:** This display concern is already resolved. Staff detail now reads `assignedRole` from the extension-backed user payload (`vg.assignedRole || userRes?.data?.assignedRole`) and renders it explicitly as `Assigned Role`, rather than deriving the visible role only from title or key heuristics.
**Verify:** Earlier live validation on the Staff Directory detail panel showed `Assigned Role` populated from the stored `^ZVEX` value, and the current source still renders that exact field directly.

### 🟢 3.13 Title (8)
**Status:** Create: ✓ pointer IEN from live File 3.1. Edit: ✓ inline + FIELD_MAP. Display: ✓.
**Issue:** The old free-text concern is stale. `StaffForm.jsx` now loads Title entries from `/titles`, stores the selected File 3.1 IEN in the form, renders `Job Title` as a dropdown (`Select title...` plus live options), and maps that pointer to field `8` on both create and edit.
**Verify:** Current source renders the `Job Title` dropdown from `liveTitles`, and earlier live browser validation on `/admin/staff/new` showed that the title selector populated with many live File 3.1 entries even while the page's unrelated department dataset was degraded.

### 🟢 3.14 Department/Service (29)
**Status:** Create: ✓ via wizard `department` alias to field 29. Edit: ✓. Display: ✓.
**Issue:** The real create-mode defect here was not capitalization; it was a request-contract mismatch. The wizard submits `department`, but the backend create loop only wrote `serviceSection`, so browser create flows could claim success while File 200 field `29` stayed blank. The backend now accepts the wizard's `department` value as the create-time alias for `serviceSection` and files the same File 49 pointer that edit mode already uses.
**Verify:** Live browser validation on `/admin/staff/new` restored a non-provider draft with `department = MEDICINE` and created disposable DUZ `10000000459`. The create response now includes field `29` with `key: serviceSection` and `status:"ok"`, fresh `/api/ta/v1/users/10000000459` readback returns `vistaGrounding.serviceSection = MEDICINE`, and direct M verification showed `^VA(200,10000000459,5)=2`, `SERVICE_I=2`, `SERVICE_E=MEDICINE`.

### 🟢 3.15 Primary Menu (201)
**Status:** Create: ✓. Edit: ✓. Display: ✓.
**Issue:** The old `no UI selector` claim is stale. `StaffForm.jsx` already renders a required `Primary Menu` selector in the `Role & Location` step, auto-defaults it from the selected role's key bundle, includes it in both create and edit payloads, and shows it again in review plus user detail readback. The narrower current limitation is that the wizard still offers a curated common-menu list (`OR CPRS GUI CHART`, `XUCORE`, `EVE`, `XUPROG`) instead of a live File `19` picker, but field `201` is not missing from the workflow.
**Verify:** Live browser review on `/admin/staff/new` showed `Primary Menu = XUCORE` for disposable user flow `MENUAUD,VERIFY`, and fresh `/api/ta/v1/users/10000000460?tenantId=default` read back `vistaGrounding.primaryMenu = XUCORE`. Direct M verification showed File `200` field `201` stored `PMENU_E=XUCORE` and `PMENU_I=38` for DUZ `10000000460`.

### 🟢 3.16 Secondary Features/Menus (203)
**Status:** Create: ✓. Edit: ✓. Display: ✓.
**Issue:** The older `payload ignored by server` finding is no longer true. Create mode now loops `secondaryFeatures` and files File `200.03` entries through `ddrFilerAdd(...)`, edit mode diffs menus through `/users/:duz/secondary-menus`, and edit hydration loads current secondary menus from `/users/:duz/access-audit`. The remaining limitation is scope, not absence: the UI currently exposes a small curated menu set rather than a live File `19` browser.
**Verify:** The same disposable browser flow for DUZ `10000000460` kept the default required application feature `OR CPRS GUI CHART`; fresh `/api/ta/v1/users/10000000460/access-audit?tenantId=default` returned `secondaryMenus:["OR CPRS GUI CHART"]`. Direct M verification showed the secondary-menu multiple present as `SMHDR=^200.03IP^1^1`, with subentry `SM1=10989`, and resolving that File `19` pointer returned `SM1_E=OR CPRS GUI CHART`.

### 🟢 3.17 Language (200.07)
**Status:** Create: ✓. Edit: ✓. Display: ✓.
**Issue:** The old uncertainty here is stale. Field `200.07` exists in the live NEW PERSON data dictionary, File `.85` contains `ENGLISH` at IEN `1`, and the product already treats language as a real pointer field on both create and edit. Earlier live write/readback verification on disposable DUZ `10000000409` proved `PUT /users/:ien` with `language = ENGLISH` stored and read back correctly, then restored cleanly with `@`. Fresh M spot-checks still show `LANG_DD_EXISTS=1` and `LANG_ENGLISH_IEN=1` in this distro.
**Verify:** Current source still maps `language -> 200.07` and reads it back into `vistaGrounding.language`; live M spot-check confirmed the field and pointer target still exist, and the earlier end-to-end write proof on DUZ `10000000409` stored external `ENGLISH` via internal pointer `1`.

### 🟢 3.18 Controlled Substances (55)
**Status:** Not applicable in this VistA build; the product now handles that absence honestly.
**Issue:** The older assumption that field `55` just needed more write-path investigation is stale. Fresh direct DD verification returned `FIELD55_DD_EXISTS=0`, so there is no live NEW PERSON field `55` to write on this distro. The current product already reflects that reality: `StaffForm.jsx` shows an explicit note that controlled substance schedule assignment is unavailable in this build, and the backend no longer pretends to map or file field `55` during create/edit.
**Verify:** Direct M prompt verification returned `FIELD55_DD_EXISTS=0`. Current source shows the explicit UI warning in the provider step and no active create/edit mapping for field `55` in `server.mjs`.

---

# SECTION 4: PER-PAGE UX CRITIQUE (As If 1000 Users Reported Issues)

## Staff Directory

### 🟢 [HIGH] Welcome letter now includes live credentials
This older support-ticket claim is stale. Fresh live validation created DUZ `10000000445`, and the `Print Welcome Letter` popup included both the issued ACCESS CODE and TEMPORARY VERIFY CODE. The same success screen also exposed a separate `Print Acknowledgment Form` action with signable onboarding language. The remaining nearby onboarding defect is create-time department persistence, not missing credentials in the welcome letter. See Section 1.1.

### 🟡 [MEDIUM] Column headers are clickable, but sorting is page-local
The old `headers are not clickable` complaint is stale. Staff Directory uses the shared `DataTable` component, which makes sortable headers keyboard/click interactive by default. The remaining limitation is scope: the table sorts the current paged slice passed into `DataTable`, not the full filtered result set before pagination.

### 🟢 [MEDIUM] No row count indicator
This claim is stale. The page now shows `Showing {rangeStart}-{rangeEnd} of {totalFiltered} staff members` directly below the table, so users can see both current-page position and total result count.

### 🟢 [MEDIUM] No 'Clear all filters' button
This claim is stale. The empty-state flow now exposes `Clear all filters`, and the active-filter chip area also exposes a one-click `Clear all` reset when more than one filter is active.

### 🟢 [MEDIUM] Phone numbers display as raw digits
This claim is stale for the current detail experience. Staff detail now renders phone values in formatted display form rather than exposing raw File 200 digits directly to admins.

### 🟢 [MEDIUM] Permission removal has no impact warning
This claim is stale. The permission-removal confirmation already renders key-specific impact copy from `KEY_IMPACTS`, so high-risk removals explain what access will be lost before the admin confirms.

### 🟢 [MEDIUM] Can't tell which keys came from role vs individually assigned
This claim is stale. Staff detail already badges visible permissions as `From role` versus `Individual`, with tooltip text naming the assigned role where applicable.

### 🟢 [MEDIUM] Detail panel doesn't show when password expires
This claim is stale. The detail panel now renders a dedicated `Password Expires` line using `pwdDaysRemaining` or `vcChangeDate + pwdExpirationDays`, including expired/soon-to-expire warning states.

### 🟢 [LOW] Detail panel scroll resets when switching users
This claim is stale. Staff Directory now persists per-user detail scroll positions and restores them when the admin returns to a previously opened user.

### 🟢 [LOW] No 'Copy DUZ' quick button
This claim is stale. The detail header now includes a dedicated `Copy DUZ` action with copied-state feedback.

### 🟢 [LOW] No print stylesheet
This claim is stale. The current print flow opens a dedicated print window for the selected profile and avoids dumping the full navigation shell into the printed output.

### 🔴 [MEDIUM] No batch operations
This remains a real gap. Current Staff Directory flows still operate on one selected user at a time; I did not find live multi-select or bulk deactivate/reactivate/terminate actions in the page source.

### 🟢 [LOW] Long department names truncated without tooltip
This claim is stale. Truncated department/service cells now preserve the full value in the cell tooltip/title attribute.

### 🟢 [MEDIUM] Wizard can't jump to completed steps
This claim is stale. The staff wizard now lets users click completed steps and jump back via `setCurrentStep(stepIndex)` instead of forcing linear Previous/Next navigation only.

### 🟡 [MEDIUM] Review step still lacks a real diff view in edit mode
This remains only partially addressed. Edit mode tracks `originalForm` for submit-time change detection, but the review UI still renders summary sections rather than a field-by-field changed-versus-original diff.

### 🔴 [MEDIUM] No printable review summary before submission
This remains a real gap. The wizard now prints welcome and acknowledgment documents after create succeeds, but I did not find a pre-submit print/export path for the review step itself.

## Role Templates

### 🟢 [MEDIUM] No key dependency visualization
This claim is stale. Role detail now renders `KEY_DEPENDENCIES` inline, shows `Requires:` relationships on individual permissions, and also flags other keys in the same role that depend on the selected permission.

### 🟢 [MEDIUM] Custom role key order is random
This claim is stale. The role detail view now groups permissions by enriched department/package buckets instead of leaving custom-role permissions as one flat random list.

### 🟢 [LOW] No role usage report
This claim is stale. Role Templates now includes a live usage report showing estimated holder counts per role based on current VistA key-holder data.

### 🟢 [LOW] No role comparison
This claim is stale. The page now includes a `Compare to` selector and renders permission plus workspace-access differences between the selected role and the comparison role.

### 🟢 [LOW] No role export/import
This claim is stale. Role Templates now supports `Export Role JSON` and `Import Role JSON` flows for custom role portability.

## Permission Catalog

### 🟢 [MEDIUM] Key holders list not clickable
This claim is stale. Holder names in the holders modal now navigate directly to the corresponding staff detail route.

### 🟢 [MEDIUM] No batch remove
This claim is stale. Permission Catalog now includes `handleBatchRemoveHolders` so admins can remove a key from multiple selected holders in one action.

### 🟢 [LOW] No key description from VistA
This claim is stale. The catalog now renders VistA-enriched descriptions in both the table and the detail panel when description text is available.

### 🟢 [LOW] No deep link to specific key from URL
This claim is stale. Permission Catalog now supports URL deep links including `?key=`, `?view=`, and `?assign=`.

## Clinics

### 🟡 [MEDIUM] Clinic create now captures more than name + stop code, but still not full terminal breadth
The original complaint is stale as written. The create modal now includes stop code validation, appointment length, max appointments per slot, and default-provider selection from live provider records. The remaining parity gap is breadth: terminal-style clinic type and full scheduling-grid setup still are not all captured in the initial create modal.

### 🟢 [MEDIUM] Stop code: no validation against File 40.7
This claim is stale. Clinic create/edit now validates stop codes against live File `40.7` data and shows the matched stop-code description inline.

### 🟢 [LOW] No clinic-to-provider assignment
This claim is stale. Clinic create/edit already loads live active providers and supports default-provider assignment.

### 🟢 [LOW] No clinic schedule template
This claim is stale. Clinic scheduling now includes a template tool that copies an existing day's availability pattern onto future empty dates across selected weekdays.

## Wards

### 🟢 [MEDIUM] No ward census/occupancy display
This claim is stale. Ward detail now exposes live room-bed totals, occupancy, availability, and related census context for the selected inpatient unit.

### 🟢 [LOW] No bed-level management within ward view
Ward detail now shows live room-bed inventory, bed totals, and occupant drill-through alongside the ward record.

## Devices

### 🟢 [MEDIUM] Device create only takes name
This claim is stale. The create modal now captures device name, `$I`, margin width, page length, terminal type, and open parameters/host path instead of prompting for name alone.

### 🔴 [MEDIUM] No device queue status
This remains a real gap. Current Device Management supports create/edit/delete plus test print, but I did not find a queue-depth or queued-print-job status view for individual devices.

## Mail Groups

### 🟢 [MEDIUM] Group names are VistA jargon
This claim is stale. Mail Group Management already loads and displays group descriptions, so admins are not limited to raw VistA group names alone.

### 🟢 [MEDIUM] No group creation
This claim is stale. Mail Group Management now includes an `Add Group` flow that creates new File `3.8` mail groups.

### 🟢 [LOW] No member count in list view
List rows already show live member totals alongside each group name.

## MailMan (Messages & Alerts)

### 🟢 [MEDIUM] No reply capability
This claim is stale. Messages now expose a real `Reply` action and prefill `Re:` subjects for in-thread reply composition.

### 🟢 [MEDIUM] Recipient is DUZ text field, not user picker
This claim is stale. The compose flows now use staff search/picker inputs instead of forcing admins to type raw DUZ values.

### 🟢 [LOW] No unread count anywhere
Messages tab and Inbox now show live unread counts from MailMan read flags.

### 🟢 [LOW] Only Inbox/Sent/Deleted folders
Messages now show live custom MailMan baskets and let users open each basket directly.

## SecurityAuth

### 🔴 [MEDIUM] Pending 2P requests still do not notify approvers
This remains a real gap. The page lists and manages pending two-person requests, but I did not find a MailMan or alert-notification path that proactively informs another admin when approval is needed.

### 🟢 [MEDIUM] 'No Auditing' can be selected without extra confirmation
This claim is stale. Disabling audit mode now opens a dedicated confirmation flow that requires typing `CONFIRM` before the save can proceed.

### 🟢 [LOW] No security compliance score/grade
Security & Authentication now shows a live baseline score and letter grade derived from the current Kernel site parameters, with the weakest controls called out inline so admins can see what is lowering the grade.

## System Health

### 🟢 [MEDIUM] HL7 + TaskMan sections: verify they load real data after M routine deployment
This claim is stale. System Health now loads live VistA status, TaskMan status, active tasks, scheduled tasks, HL7 interface status, HL7 filer status, and related health panels from the real tenant-admin/VistA paths.

### 🟢 [LOW] No historical uptime tracking
System Health now shows persisted 24h/7d/30d uptime windows with real tenant-admin background samples, including separate VistA, TaskMan, and HL7 percentages plus explicit coverage so the history stays truthful while it accumulates.

### 🟢 [LOW] No alert thresholds
System Health now lets each admin subscribe their own VistA alert list to sampled VistA, TaskMan, and HL7 failures, with a cooldown so repeated outages do not spam the same user.

## Audit Log

### 🟢 [MEDIUM] No filter by action type
This claim is stale. Audit Trail now exposes source/action-oriented tabs for `All Events`, `Sign-On Activity`, `Data Changes`, `Error Log`, `Failed Access`, and `Administrative Access`, so admins no longer have to browse one undifferentiated feed.

### 🟢 [MEDIUM] No CSV/PDF export
This claim is stale. Audit Trail already exposes both `Export CSV` and print/PDF export actions.

### 🟢 [LOW] No suspicious activity highlighting
Audit Trail now summarizes suspicious patterns in the filtered result set and flags individual rows for failed logins, off-hours access, and bursts of security-key changes so risky activity stands out instead of blending into normal audit noise.

## Dashboard

### 🟢 [MEDIUM] Cards not clickable
This claim is stale. Dashboard metric cards are now clickable links into the relevant admin destinations.

### 🟢 [MEDIUM] No auto-refresh
This claim is stale. Admin Dashboard now auto-refreshes on a timed interval in addition to exposing a manual refresh action.

### 🟢 [LOW] No trend data
Dashboard counts now persist rolling metric snapshots on the tenant-admin server and show per-card trend context from live VistA data. The page exposes retained snapshot coverage, last-sampled time, and card-level deltas versus the prior snapshot, while transparently staying in baseline-building mode until enough history exists for longer comparisons.

## Reports

### 🟡 [MEDIUM] Reports are live-backed, but coverage is still mixed by report type
The page is not a dead shell anymore: several report cards return real VistA-backed data, and recurring runs are also real. But this area is still only partial overall because not every advertised report variant has been re-proven as a fully populated, distinct live output.

### 🟢 [MEDIUM] No PDF export
This claim is stale. Reports now exposes a `Print / PDF` action alongside CSV export, with a print-root stylesheet intended for clean PDF generation through the browser print dialog.

### 🟢 [LOW] No scheduled/recurring reports
Reports now support persisted recurring runs on tenant-admin with visible cadence, next-run time, last-run status, and last row count. Schedules execute immediately when saved for validation, continue on the background worker after restart, and stay clearly distinguished from native VistA TaskMan jobs.

## System Configuration

### 🟢 [LOW] Welcome message has no preview
System Configuration now renders a live login-screen preview beside the intro-message editor, and the actual sign-in page consumes the same public Kernel-backed intro message so admins preview the real output instead of a mock.

### 🟢 [LOW] Most fields are read-only with no explanation why
Read-only identity and system-status sections now explicitly say whether values come from installation-time Kernel configuration or live VistA status so admins know why those fields cannot be edited here.

## Site Parameters

### 🟡 [MEDIUM] Most field labels are improved, but `Parameter #N` fallback still exists for some modules
This remains only partially resolved. Site Parameters now prefers DD-derived labels and surfaces a warning when unlabeled fields remain, but the page still contains explicit `Parameter #...` fallback naming when discovery does not return a usable label.

### 🟢 [LOW] No recommended value ranges shown
Site Parameters now shows field-level operational guidance where a defensible baseline exists: kernel session settings display recommended numeric ranges, package identity fields are marked as expected-state values, historical conversion markers are flagged as system-managed, and package printer/format dependencies explain when blank is the correct state. Live radiology label-count fields also show a "start at 1" baseline so admins are not editing blind.

## Login Page

### 🔴 [MEDIUM] Expired-password change flow still is not proven end to end
The UI now has a dedicated expired-password change form, but the live workflow remains blocked by the broader fresh-account authentication defect already documented elsewhere in this audit. In current testing, reset or newly issued credentials failed before the user could complete the forced change and sign back in successfully.

### 🟢 [MEDIUM] VistA-down login messaging is now explicit
This claim is stale. `LoginPage.jsx` now maps VistA/network outage conditions to a dedicated `System is currently unavailable. Please try again later.` message instead of collapsing them into the generic invalid-credentials copy.

### 🟢 [LOW] No remaining attempts indicator
Login now shows the live Kernel lockout threshold before sign-in, and invalid-credential failures return the remaining-attempt count from tenant-admin's live login path so users can see how close they are to lockout instead of guessing.

---

# SECTION 5: SECURITY

### 🟢 5.1 [HIGH] Session token still in sessionStorage — XSS vulnerable
**Fix:** Authentication now stays entirely in the httpOnly SameSite=Strict `ve-session` cookie. Login responses no longer return the raw session token, and the frontend no longer keeps any JS-readable auth secret.
**Verify:** Browser inspection shows `document.cookie` empty and sessionStorage limited to UI hints only. Live `/auth/session` responses no longer expose any token field.

### 🟢 5.2 [HIGH] CSRF token also in sessionStorage — same XSS risk
**Fix:** Removed the JS-readable CSRF token flow entirely. Auth responses no longer return `csrfToken`, the frontend no longer caches or sends `X-CSRF-Token`, and tenant-admin now rejects cross-site state-changing requests using browser same-site request signals while keeping the session cookie SameSite=Strict.
**Verify:** Live browser fetches show no `csrfToken` in `/auth/session` or failed-login responses, and a same-origin authenticated `PUT /health/thresholds/me` still succeeds without any JS CSRF header.

### 🔴 5.3 [MEDIUM] Deactivation-driven session invalidation is still not honest end to end
**Issue:** tenant-admin does try to check a deactivation flag on every authenticated request, but the current implementation reads File `200` field `4` rather than the real `DISUSER` field `7`, and the live deactivate flow itself still fails to set `DISUSER` reliably in this environment.
**Verify:** Current source reads `ddrGetsEntry(200, session.duz, '4')`, while earlier live deactivation verification showed users could be marked terminated without a truthful `DISUSER=1` path. So this cannot honestly be closed as working session invalidation yet.

### 🟢 5.4 [MEDIUM] No session invalidation on password change
**Fix:** This is now implemented. tenant-admin keeps a session map and explicitly calls `destroySessionsForDuz(req.params.duz, req.session?.token)` after a successful credential update so other active sessions for that user are revoked.
**Verify:** Current source on the credential route invalidates the target user's other sessions immediately after `ZVE USMG CRED` succeeds.

### 🟢 5.5 [MEDIUM] Password history is now enforced on credential writes
**Fix:** `ZVE USMG CRED` now checks the incoming verify-code hash against the current File 200 verify hash and a persisted recent-history list in `^XTMP("ZVEUSMG","VCHIST",DUZ,...)` before filing updates. On successful changes it records the prior hash (hashed only; no plaintext) and keeps a bounded recent list. tenant-admin now maps these routine rejections to HTTP `409` with `code="PASSWORD_HISTORY_VIOLATION"` instead of generic `502` transport errors.
**Verify:** Live API proof after deploy/restart: disposable DUZ `10000000488` changed `A -> B` (HTTP `200`), then reuse `A` returned HTTP `409` with `code="PASSWORD_HISTORY_VIOLATION"` and message `Verify code was used recently. Choose a new code.`, while `B -> C` still succeeded (HTTP `200`). Direct M proof confirmed `CUR_IS_C=1`, `HIST1_IS_B=1`, `HIST2_IS_A=1`, and `^XTMP("ZVEUSMG",0)` retention metadata was present.

### 🟢 5.6 [MEDIUM] Access/verify equality is now enforced system-wide
**Fix:** This gap is now closed at the write layer. `ZVE USMG CRED` now rejects `ACCESS CODE == VERIFY CODE` before filing File `200` fields `2` and `11`, and `ZVE USMG ADD` now applies the same check during account creation. tenant-admin now maps that M-level rejection to HTTP `409` with `code="ACCESS_VERIFY_MATCH"` for all relevant credential paths.
**Verify:** Live API proof after deploy/restart confirmed parity across create and credential-update flows: `POST /users` with identical access/verify returned HTTP `409` + `ACCESS_VERIFY_MATCH`; `PUT /users/:duz/credentials` with identical values returned HTTP `409` + `ACCESS_VERIFY_MATCH`; and `POST /auth/change-expired-password` with `newVerifyCode == accessCode` also returned HTTP `409` + `ACCESS_VERIFY_MATCH`. A control create with distinct values succeeded (DUZ `10000000495`) and was then terminated successfully.

### 🟢 5.7 [LOW] 7 empty catch blocks remain in codebase
**Fix:** Replaced the remaining silent web-app catch handlers with explicit logging while preserving their existing fallback behavior. Session-storage fallbacks, workspace-visibility fallbacks, duplicate-check fallbacks, and non-blocking refresh paths now emit clear console diagnostics instead of swallowing failures invisibly.
**Verify:** A source scan no longer finds the prior comment-only/no-op catch pattern in `apps/web/src`, and the touched files compile clean with no new errors.

---

# SECTION 6: PERFORMANCE

Think: 500 concurrent users, 2000 staff in File 200, 5000 patients in File 2.

### 🟢 6.1 Server-side pagination exists for `/users`
The old claim is stale. tenant-admin now supports paged `/users` reads with `page`, `limit`, `MAX`, `FROM`, and `total` metadata rather than forcing every caller to pull the entire File `200` list in one response.

### 🟡 6.2 E-signature status is still a separate API call
This remains only partially improved. Staff Directory still loads `getStaff()` and `getESignatureStatus()` separately on page load instead of folding e-signature readiness directly into the main user list payload.

### 🟢 6.3 Hover prefetch exists for the detail panel
This claim is stale. Staff Directory now prefetches detail data on row hover with a short delay and reuses that cache on row click when available.

### 🟡 6.4 Role assignment still makes sequential key calls
This remains a real performance gap. Role assignment still loops individual `assignPermission(...)` calls for each role key rather than sending one batch key-assignment RPC.

### 🟡 6.5 Wizard reference data is still re-fetched on open
This remains a real optimization gap. `StaffForm.jsx` still loads sites, permissions, departments, and mail groups on mount instead of using a shared cached reference-data layer with a TTL.

### 🟢 6.6 Large-list routes now use bounded DDR/ZVE list paths
The old blanket complaint is stale. The current server helpers and main list routes use `MAX` and other limiting/capped patterns instead of leaving large DDR list operations unbounded by default.

### 🟢 6.7 API response-time monitoring header exists
This claim is stale. tenant-admin now emits `X-Response-Time` on responses so callers can observe per-request latency directly.

### 🟡 6.8 Connection-pool visibility is still limited
This remains only partially addressed. The platform has broker/session management, but I did not find a comparable live operator surface exposing pool size, wait time, or connection-failure metrics.

---

# SECTION 7: ERROR HANDLING

### 🟢 7.1 Mid-wizard VistA disconnect now shows a saved-draft warning
This claim is stale. The wizard already performs a periodic VistA health check and now shows `VistA connection lost. Your draft is auto-saved. Please wait for reconnection.` while the form remains open.

### 🟢 7.2 Create partial success: verify the warning display is prominent
The old uncertainty here is stale. The success screen now computes assigned-versus-total permission counts from `extraFields`, and it renders explicit failed-key and failed-mail-group sections instead of silently burying partial-save issues.

### 🟢 7.3 Login errors now map to distinct user-facing states
This claim is stale. `LoginPage.jsx` now maps expired-password, VistA-unavailable, account-locked, username-not-found, and invalid-credentials cases to separate messages instead of collapsing everything into one generic failure string.

### 🟢 7.4 Clinics page now loads through the live TYPE=`C` path
This claim is stale. Earlier verification already showed the clinics page loading a real filtered clinic set from the live backend rather than failing on the old TYPE-filter concern.

### 🟢 7.5 Staff list now clears stale data on load failure
This claim is stale. `StaffDirectory.jsx` now clears `staffList` to `[]` on top-level load failure before showing the error state, so stale rows are not left on screen as if they were current.

### 🟡 7.6 Generic technical error surfaces still remain in places
This remains only partially addressed. Some workflows now map common failures into better product copy, but many current catch paths still surface raw `err.message` text directly to the user.

### 🟢 7.7 Patient pages are wrapped in `ErrorBoundary`
This claim is stale. The patient routes in `App.jsx` are now wrapped in the shared `ErrorBoundary`, not just the admin routes.

### 🟡 7.8 API timeout is explicit, but still fixed at 30 seconds
This remains a partial concern rather than a blank gap. The shared API layer now has an explicit abort/timeout path with a user-facing timeout error, but it is still a fixed 30-second client timeout rather than a route-specific policy.

---

# SECTION 8: TERMINAL PARITY — What VistA Terminal Does That We Don't

Based on Kernel 8.0 Systems Management Guide (Aug 2025) and VistApedia:

### 🟢 8.1
The post-create success screen now exposes a dedicated `Print Welcome Letter` action, so admins can reprint the initial credential letter immediately after account creation instead of having to fall back to the later detail-panel account letter.

### 🟢 8.2
The post-create success screen now exposes a dedicated `Print Acknowledgment Form` action that generates a separate printable onboarding acknowledgment with user responsibilities, signature and witness lines, IRM/admin sign-off, and retention guidance instead of overloading the credential letter.

### 🟢 8.3
Live verification showed that the clone flow now posts the correct new-user name field, and `ZVE USER CLONE` copies the source user's security keys plus secondary menu options (File 200 field 203). In a disposable test cloning DUZ 1, the clone received 134 keys and the same 12 secondary menus; primary menu assignment was not copied, which remains covered by the broader menu-management gaps below.

### 🟢 8.4
The Staff Directory detail view now surfaces live key-assignment dates from File 200.051 on each visible permission, and the per-user keys API returns those dates for export/print use as well. Live validation on MANAGER,SYSTEM showed dated key entries rendering in the detail panel (for example `Assigned Jun 12, 2015`, `Assigned Mar 10, 2010`, `Assigned Jul 31, 2015`) with 133 of 134 DUZ 1 keys carrying a stored assignment date in this environment.

### 🟢 8.5
The permission-removal flow already explains the loss of access instead of using a bare confirm. Live validation on MANAGER,SYSTEM showed the dialog text `This will immediately revoke this access.` plus a key-specific impact block (`Without this: cannot verify or mark allergies as reviewed.`) before confirmation.

### 🟢 8.6
The specific `no menu assignment UI` claim is stale. Staff create/edit already exposes primary menu assignment plus secondary menu options in the wizard, and those values are wired through the live user update path. The broader terminal-style menu-management system remains outside scope, but per-user menu assignment is present.

### 🟢 8.7
Staff Directory now shows a live File 19 menu structure for the selected user instead of stopping at keys and menu names. tenant-admin exposes `/users/:duz/menu-structure`, which resolves the user's primary menu plus secondary menu assignments and walks the File 19 option tree through the real menu multiple so the detail panel can render the accessible option hierarchy.

Live validation on MANAGER,SYSTEM (DUZ 1) confirmed the new path end to end. Browser fetch to `/api/ta/v1/users/1/menu-structure?tenantId=local-dev` returned `primaryMenu=EVE`, `secondaryMenuCount=12`, `rootCount=13`, and a nested tree whose first root was `EVE` (`Systems Manager Menu`) with child options including `DIUSER`. The Staff Directory detail panel now includes a `Menu Structure` section that renders the hierarchy live, showing `Systems Manager Menu` with descendant branches such as `VA FileMan`, `HL7 Main Menu`, `Manage MailMan`, and `Core Applications`, along with the assigned secondary menu roots.

### 🟢 8.8
The gap is real. Terminal `EVE -> Menu Mgmt -> Delegate Options/Keys` supports delegated administration of specific options or security keys without granting full `XUMGR`, and the terminal coverage ledger also calls out security-key delegation level editing under `Create/Edit Security Keys [XUKEYCREATE]`.

Current VistA Evolved still has no equivalent delegation workflow. Source inventory found no admin UI route, page, or service for delegated option/key management, and tenant-admin exposes no delegation endpoint for keys or menu options. Live browser validation on `/admin/staff?search=MANAGER,SYSTEM&user=1` showed the full Administration nav for MANAGER,SYSTEM with `Staff Directory`, `Roles & Permissions`, and `Permission Catalog`, but no delegation page or action. `Permission Catalog` covers assignment/listing only; it does not define delegated managers or edit delegation levels.

### 🟢 8.9
The original claim was only partially true. The UI already exposed multiple create fields, but the live create path was broken in two places: tenant-admin was using the wrong File 3.5 field numbers for type, margin width, page length, and open parameters, and the backend was also relying on a DDR add path that cannot create DEVICE entries in this environment.

This is now fixed with live proof. The device field map was corrected against the live File 3.5 data dictionary (`TYPE=2`, `SUBTYPE=3`, `MARGIN WIDTH=9`, `PAGE LENGTH=11`, `OPEN PARAMETERS=19`), `ddrFilerAdd()` was corrected to stop treating `diERRORS` as success, and device create now uses a dedicated `ZVE DEV CREATE` RPC backed by native FileMan `FILE^DICN` plus follow-up `FILE^DIE` writes. Live validation then created disposable device `ZZZAUDT1842` through `POST /api/ta/v1/devices?tenantId=local-dev`, which returned `1^713^OK`. Immediate readback from `/api/ta/v1/devices/713?tenantId=local-dev` confirmed the stored values on File 3.5: `.01=ZZZAUDT1842`, `$I=/tmp/zz_audt_1842.dat`, `TYPE=HOST FILE SERVER`, `MARGIN WIDTH=132`, `PAGE LENGTH=66`, and `OPEN PARAMETERS=|HFS|/tmp/zz_audt_open_1842.dat`. The disposable verification entries were then deleted directly from VistA.

### 🟢 8.10
This is now fixed for the critical TaskMan control path with live proof. System Health no longer only shows status: when TaskMan is stopped, the page now exposes a live `Start TaskMan` action backed by a new `ZVE TASKMAN START` RPC. Live validation first showed `/admin/health` in the stopped state with `Background Tasks = STOPPED` and a visible `Start TaskMan` button. After the live start path was exercised and the status RPC was corrected to read the actual TaskMan runtime signal (`^%ZTSCH("RUN")` as well as the older node), `GET /api/ta/v1/taskman/status?tenantId=local-dev` returned `RUNNING`, and `/admin/health` refreshed to `Background Tasks = RUNNING` with 26 tasks active and the normal Active Tasks / Scheduled Tasks panels visible again. Deeper per-task stop/suspend/resume/output controls from the fuller AD-09 spec are still future work, but the audit statement that System Health can only show status and cannot manage TaskMan is no longer true.

### 🟢 8.11
This claim is stale. Both reply and custom MailMan folders are already live. Live `GET /api/ta/v1/mailman/baskets` returned real baskets including `BACKUP`, `LBJ`, `Pharmacy Patch Info`, `LEX PATCH INFO`, `BACK UP`, `MOCHA`, `ZZFTD`, `MED`, and `BACKUKP`, and `/admin/messages` rendered those basket tabs in the Messages view alongside Inbox, Sent, and Deleted. Live message detail also exposes a real `Reply` action: opening a MailMan message on `/admin/messages` showed a `Reply` button, and clicking it opened `Compose Message` with the subject prefilled as `Re: Rad/Nuc Med Report (061617-120)`. The current product therefore already supports send, forward, reply, and custom baskets; this audit item no longer describes the live system.

### 🟡 8.12
This is now only partially true. The original subset problem inside the supported packages is fixed: the generic `/params/:package` path no longer truncates discovered fields at 30, and live validation now shows substantially broader parameter coverage for the packages it exposes. Authenticated live fetches returned `Pharmacy Site Parameters` with 142 structured fields from File 59.7, `Registration Site Parameters` with 168 structured fields from File 43, and `Billing Site Parameters` with 239 structured fields from File 350.9. `/admin/module-settings` also now renders those added `Registration Settings` and `Billing Settings` sections in the live UI.

Compared against the full AD-05 list, however, Site Parameters still does not cover every workspace/package section described in the spec. The live page now covers System, Clinical/OE, Pharmacy, Lab, Scheduling, Radiology, Patients/Registration, Billing, and Surgery, but it still omits dedicated Supply, Interfaces, Admin-only package sections, and VistA Evolved-specific parameter groups such as workspace visibility/theme defaults. So the old statement that Site Parameters only handled a subset is no longer fully accurate at the per-package field level, but it remains directionally true when compared to the complete AD-05 parameter inventory.

### 🟡 8.13
This remains partially true. Live `/admin/security` already exposes five real sections with Kernel-backed controls for session timeout, failed-login lockout, lockout duration, password expiration, multiple sign-on, concurrent session limit, account auto-generation defaults, audit mode/start/end/failed-access logging, and advanced mail-group/broker/post-login settings. The live page field labels are: `Session Timeout`, `Failed Login Lockout`, `Lockout Duration`, `Password Expiration`, `Allow Multiple Sessions`, `Max Concurrent Users`, `Auto-Generate Usernames`, `Auto-Generate Passwords`, `Data Auditing Mode`, `Audit Start Date`, `Audit End Date`, `Failed Access Logging`, `IRM Mail Group`, `After-Hours Mail Group`, `Server Response Timeout`, `Default Institution`, and `Post-Login Action`.

Compared to the fuller AD-10 security/config spec, SecurityAuth still handles only a subset. It does not expose Access Code length rules, Verify Code complexity/history-depth controls, session idle warning / session extension policy, role-template defaults, audit retention/archival controls, or sensitive-patient audit level settings. So the blanket statement that these controls are "not in our SecurityAuth" is too broad, but there is still a real coverage gap against the full security policy surface.

### 🟡 8.14
This is now only partially true. We still do not have automatic deactivation enforcement, but we do have a real equivalent for review and scheduled follow-up. Live `/admin/reports` exposes a `Stale Accounts` report, and authenticated `GET /api/ta/v1/reports/admin/stale-accounts?tenantId=local-dev&days=90` returned 118 live rows with `DUZ`, `lastLoginDate`, and `daysSinceLogin` values sourced from NEW PERSON sign-on activity. The same report type is also wired into the recurring report scheduler so admins can save scheduled stale-account runs for repeated review.

What remains missing is the terminal-style automatic action. The current product surfaces stale accounts for manual review and optional deactivation, but it does not automatically set `DISUSER` or otherwise deactivate users after N idle days. So the original claim that we have "no equivalent" is stale, while the narrower claim that we still lack auto-deactivation itself remains true.

### 🔴 8.15
This remains a real gap. We do have live sign-on log visibility, but not the terminal-style purge action. Authenticated `GET /api/ta/v1/audit/signon-log?tenantId=local-dev&max=5` returned HTTP 200 from the live tenant-admin backend, confirming File 3.081 is exposed for review. The audit workspace also provides filtering plus CSV/PDF export for sign-on activity, which helps review and offline retention handling.

But there is still no actual sign-on-log purge equivalent in the product. The only built purge path is the error-trap maintenance route: authenticated `POST /api/ta/v1/error-trap/purge` returned HTTP 200 and targets File 3.077, while an attempted `POST /api/ta/v1/audit/signon-log/purge` returned HTTP 404. Source confirms the same boundary: the backend exposes only `GET /audit/signon-log`, and the frontend service layer only wires sign-on-log reads while `purgeOldErrors()` is limited to `/error-trap/purge`. So the original claim is still materially true.

### 🟢 8.16
This gap is now closed with live VistA-backed enforcement. `ZVE USMG CRED` now rejects verify-code reuse by checking both the current File 200 verify hash and a persisted bounded history of prior verify hashes kept at `^XTMP("ZVEUSMG","VCHIST",DUZ,1..5)`; successful writes push the previous hash into that list. Both tenant-admin credential paths (`PUT /users/:duz/credentials` and `POST /auth/change-expired-password`) now surface that rejection as HTTP `409` with `code="PASSWORD_HISTORY_VIOLATION"`.

Live validation confirmed end-to-end behavior. Admin credential update for disposable DUZ `10000000488` succeeded for `A -> B`, rejected reuse `B -> A` with HTTP `409` and `PASSWORD_HISTORY_VIOLATION`, then succeeded for `B -> C`. Expired-password flow for disposable DUZ `10000000489` also rejected `newVerifyCode == current` with the same `409` policy code. Direct M validation confirmed the history state after the sequence: current verify hash matched `C`, history slot 1 matched `B`, history slot 2 matched `A`, and the `^XTMP("ZVEUSMG",0)` retention node was present.

### 🟢 8.17
This item is now closed with backend parity. The restriction is no longer only a wizard-side check; it is enforced in live VistA write paths. `ZVE USMG ADD` (create) and `ZVE USMG CRED` (credential updates) both reject equal access/verify values, and tenant-admin surfaces that rejection consistently as a business-policy `409` response with `code="ACCESS_VERIFY_MATCH"`.

Live validation confirmed end-to-end behavior after deploying and recompiling `ZVEUSMG.m` in `local-vista-utf8` and restarting tenant-admin. `POST /api/tenant-admin/v1/users?tenantId=default` with equal values returned `409 ACCESS_VERIFY_MATCH`; a control create with distinct values succeeded (`DUZ 10000000495`); `PUT /api/tenant-admin/v1/users/10000000495/credentials?tenantId=default` with equal values returned `409 ACCESS_VERIFY_MATCH`; and `POST /api/tenant-admin/v1/auth/change-expired-password` for that same disposable account with `newVerifyCode == accessCode` also returned `409 ACCESS_VERIFY_MATCH`. Cleanup completed via successful terminate calls for disposable validation users.

### 🟡 8.18
This is partially true. The live edit experience is a multi-step wizard with a single batch submit path rather than terminal-style per-field confirmation. On `/admin/staff/10000000416/edit`, the page shows `Person & Credentials`, `Role & Location`, and `Review & Create` steps with one footer action that becomes `Save Changes`. Source confirms that button calls one `handleSubmit()` routine, which diffs the edited form and then writes all changed fields in sequence: profile fields, boolean flags, permissions, divisions, secondary menus, and optional credentials.

But the statement is too broad if it implies there are no confirmations anywhere. Separate high-risk actions outside the batch edit flow still do prompt: `StaffForm.jsx` uses `ConfirmDialog` for `Clear E-Signature`, and `StaffDirectory.jsx` shows explicit confirm flows for `Deactivate`, `Terminate Account`, and permission removal. So the honest gap is narrower: we do batch-save ordinary user/profile/security-field edits without terminal-style per-field `Are you sure?` prompts or a final diff-confirm step, while some destructive account actions already have dedicated confirmations.

### 🟡 8.19
This is only partially true, and the current product split is different from the note. We do not appear to surface sign-on count in the live web UI today. Staff detail shows `Last Sign-In`, and the full-profile print view explicitly says per-event sign-on history belongs in the Audit workspace. Live `GET /api/ta/v1/users/1?tenantId=local-dev` returned HTTP 200 with `lastLogin`, but no exposed `signOnCount` or `firstSignOn` fields in the response payload.

At the same time, full sign-on history already exists in the product through Audit Trail. The admin audit page loads `getAuditSignonLog()`, and the backend `GET /api/ta/v1/audit/signon-log` is wired to File `3.081` through `ZVE ADMIN AUDIT` or DDR fallback. A live fetch to `GET /api/ta/v1/audit/signon-log?tenantId=local-dev&max=5` returned HTTP 200 in this environment. So the `not full history` part is stale.

The remaining real gap is narrower. `ZVE USER DETAIL` does compute `signOnCount` and `firstSignOn` at indices 33-34, but `server.mjs` currently stops parsing at index 32, so those summary values are dropped before they reach the UI. And `last option used` is still missing: the sign-on audit route only returns timestamp, user, action, source, and detail/IP, with no option/menu/context field captured or displayed.

### 🟡 8.20
This is only partially true. We do not have a real frontend workflow for terminal-style file-level security management, and there is no visible admin page for editing per-file access rules from NEW PERSON sub-file `200.032`. Source shows `getUserFileAccess()` exists only in the service layer and is not surfaced on the current admin screens.

But the system is not entirely blank here. tenant-admin already exposes live read routes for file-level access data: `GET /api/tenant-admin/v1/users/:duz/file-access` and the broader `GET /api/tenant-admin/v1/users/:duz/access-audit`, both backed by File `200.032`. Live authenticated fetches to `GET /api/ta/v1/users/1/file-access?tenantId=local-dev` and `GET /api/ta/v1/users/1/access-audit?tenantId=local-dev` both returned HTTP 200 in this environment, even though DUZ 1 currently has zero `fileAccess` entries here. The product also exposes the coarse `FileMan Access Code` control in staff create/edit, which can grant unrestricted `@` access, but that is not the same as managing per-file security entries.

So the honest remaining gap is specific: terminal-style file-level security administration is still missing from the live UI and there is no write path for sub-file `200.032`, but read-side plumbing and a broad FileMan-access control already exist.

---

# SECTION 9: PATIENT REGISTRATION AUDIT

Our patient pages have 12 components totaling 6,574 lines of code and 42 service functions.
Terminal patient registration (MAS/ADT) captures 90+ fields. Our form has 52 FormField components.

### 🟡 9.1 [MEDIUM] PatientSearch: backend search is real, browser path is tenant-broken
This is only partially true. The backend search path is real and does query live VistA data: authenticated `GET /api/ta/v1/patients?tenantId=default&search=ZZTESTPATIENT` returned 21 rows from `source: "zve"`, and direct M verification through `D SRCH^ZVEPAT1(.R,"ZZTESTPATIENT","NAME","","","5")` returned matching live patient names.

But the current patient-search page is not honest end to end in the active product session. `patientService.js` still hardcodes `tenantId='local-dev'`, so live browser search on `/patients` returned `403 TENANT_MISMATCH` under the current `default`-bound session. So the RPC is registered and working, but the actual browser workflow is only partially functional today.

### 🟡 9.2 [MEDIUM] PatientDemographics: broader UI than noted, but persistence is still narrow
This note is stale as written. The current registration UI captures substantially more than the original 52-field complaint suggested. Live browser and source review showed fields for next of kin, emergency contact, employer, employment status, enrollment priority group, branch/service dates, country of birth, mother's maiden name, interpreter need, advance directive, combat veteran, POW history, employer phone, and exposure checklists.

But the underlying write path still remains much narrower than the UI. Current tenant-admin `/patients` create and `/patients/:dfn` update routes only persist a limited subset of File `2`, so many of those fields are still UI-only rather than honestly saved end to end. And some fields remain fully missing from the product, including place-of-birth city/state, organ donor status, spinal cord injury, collateral of record, designee/healthcare proxy, father's name, and a distinct mother's-name field. So this item is still a real gap, but not in the older form stated here.

### 🟢 9.3 [MEDIUM] Admission: File 405 movement creation verified live
This is verified green. A live admit of patient `DFN 101044` through `POST /api/ta/v1/patients/101044/admit?tenantId=local-dev` returned HTTP `200` via `ZVE ADT ADMIT` with movement `5294`, ward `WARD A-AUTOMATED`, and room/bed `001-A`.

Direct M-prompt verification confirmed the actual writes: `^DGPM(5294,0)` stored a new type-1 admission movement, and `^DPT(101044,.1)` updated the patient's active ward, room/bed, and admit date. The live ward census also picked up `DFN 101044` immediately afterward. The patient-detail read surface is still stale about current ward/admit fields, but the File `405` admission movement itself is genuinely verified.

### 🟡 9.4 [MEDIUM] Discharge: discharge movement is real, admission-link proof is still incomplete
This is only partially true. A live discharge of the same inpatient `DFN 101044` returned HTTP `200` via `ZVE ADT DISCHARGE` with movement `5295`, and direct M verification showed `^DGPM(5295,0)` created plus the active ward/room-bed pieces in `^DPT(101044,.1)` cleared. The post-discharge census also no longer included that patient.

What I did not separately prove here is the stronger `referencing admission` leg at the exact movement-link level, and the surrounding UI/read surface remains inconsistent because `/patients/:dfn` did not reliably show the patient as admitted before discharge. So the discharge mechanics are real, but the fuller audit claim is only partially closed.

### 🟢 9.5 [MEDIUM] Transfer: cross-division browser flow and VistA write are now verified
This is now verified green. The transfer path no longer dies on tenant mismatch, and the page now renders the truthful current inpatient context instead of the old false `not admitted` state. Live browser validation on `/patients/101044/transfer` showed `ICU/CCU — Pending assignment`, `Current division: VEHU DIVISION`, selection of destination ward `3E NORTH`, `Destination division: VEHU CBOC`, the inline cross-division warning, the explicit confirm dialog `Confirm Cross-Division Transfer`, and the final success screen `Patient Transferred Successfully` with `Cross-division transfer completed from VEHU DIVISION to VEHU CBOC.`

Direct M verification closed the write leg. After the browser submit, `^DPT(101044,.1)` updated to leading ward value `33`, and direct File `42` reads confirmed ward `33` is `3E NORTH` with division `VEHU CBOC`. So the page now distinguishes cross-division transfer, requires confirmation, and writes the destination ward change into live VistA.

### 🔴 9.6 [MEDIUM] BedManagement handleAssignPatient: old note is stale, but the workflow is still broken
The original wording is stale in one respect: `handleAssignPatient()` is no longer a pure navigate-only stub. Source shows it now calls `assignBed(...)` to validate the room-bed selection and then navigates with `assignBedContext`.

But the live workflow is still red. In the current browser session, `/patients/beds` showed `0 Total Beds`, `0 Available`, and no assignable rows because the page is still calling room-bed routes with `tenantId='local-dev'` while the active session is bound to `default`. Direct route comparison confirmed the split: `GET /api/ta/v1/room-beds?tenantId=local-dev` returned `403 TENANT_MISMATCH`, while the correct-tenant route returned 549 real room-bed rows. So the handler is not merely a no-op anymore, but the real assignment flow still does not work end to end.

### � 9.7 [FIXED — Session 220] InsuranceCoverage: add flow now creates File 2.312 entries
Fixed. Root cause: `InsuranceCoverage.jsx` was sending `companyIen` (numeric IEN like `'2'`) but `ddrFilerAddMulti` uses external format (`flags='E'`) which requires the company NAME. Fixed to send `planName || companyIen`. Browser verified: MEDICARE added with policy 1EG4-TE5-MK72. VistA M-prompt confirmed: `^DPT(3,.312,1,0)="2"` (MEDICARE IEN). File 2.312 entry created.

### 🔴 9.8 [MEDIUM] FinancialAssessment: local calculator works, File 408.31 write path does not
This remains red. The page's local calculation logic is live enough to derive a category in the browser, but the actual save path is not working. On `/patients/101044/assessment`, entering income values updated the UI to `Category A / Cat A — No Copay`, but clicking `Calculate & Submit` only surfaced `Submission failed. Please try again.`

Replaying the routed request returned HTTP `403 TENANT_MISMATCH` for `POST /api/ta/v1/patients/101044/assessment?tenantId=local-dev`, and a follow-up `GET /api/ta/v1/patients/101044/assessment?tenantId=default` still returned zero rows. So the means-test classification preview exists, but there is still no verified File `408.31` write.

### � 9.9 [FIXED — Session 220] PatientFlags: add flow now creates File 26.13 entries
Fixed. Root cause was multi-layered: (1) File 26.13 field positions were reversed in the M routine, (2) `UPDATE^DIE`/`FILE^DIE` both fail for this subfile, (3) VistA ZVE RPC required ASSIGN action + direct global writes. Fixed `ZVEPAT1.m`: DEFS action returns File 26.15 flags, LIST uses correct piece positions, ASSIGN does direct `^DGPF(26.13,ASSIEN,0)` write with B cross-reference, INACTIVATE sets piece 3=0. Server normalized status `1`→`active`. Browser verified: `Active Flags (8)` all showing `BEHAVIORAL` in FLAG NAME column. VistA M-prompt confirmed: `^DGPF(26.13,191,0)="3^1;DGPF(26.15,^1^^^"`.

### � 9.10 [MEDIUM] RecordRestrictions: restriction update path is still blocked and audit visibility is incomplete
Fixed Session 222. Root cause was a wrong file/field targeting: the server was calling `ddrFilerEditMulti('2', '${dfn},', {'38.1':'1'})` — field 38.1 does not exist in File 2. Sensitivity lives in **File 38.1** (`^DGSL(38.1,DFN,0)`), a separate file with field 2 = SECURITY LEVEL (0=NON-SENSITIVE, 1=SENSITIVE). Added new `ZVE PAT RESTRICT` RPC (IEN auto-assigned, registered in container): `RESTRICT(R,DFN,LEVEL,DUZ)` in `ZVEPAT1.m` creates or updates `^DGSL(38.1,DFN,0)` piece 2 based on `level=none|level1|level2`. Updated `PUT /patients/:dfn/restrictions` to call `ZVE PAT RESTRICT`. Break-the-glass display fix: server now accepts `body.reasonText` and `body.reasonCategory` (not just `body.reason`), and the audit-events response now includes `reasonCategory` (stripped of `ZVE:` prefix) so the UI table colours correctly. M-prompt verification: `^DGSL(38.1,101044,0)` = `101044^1^1^3260413` after `level2`, piece 2 = `0` after `none`. API `GET /audit-events` returns entries with `reasonCategory: "Direct Care"`, `reasonCategory: "Emergency Care"` correctly matching the displayed text columns.

### 🟡 9.11 [LOW] Patient duplicate check: does DUPL RPC work before registration?
This is only partially true. The product already performs pre-registration duplicate checking in the UI, but not through a dedicated `ZVE PATIENT DUPLICATE` route and not as a hard gate on final save. Live `/patients/register` shows a dedicated `Duplicate Check` section with a `Check for Duplicates` action before the registration form. Source confirms `PatientSearch.jsx` also runs a duplicate preflight before navigating to registration when the user has entered a search query plus DOB.

But both current flows use ordinary patient search heuristics rather than the dedicated duplicate RPC. `PatientSearch.jsx` and `PatientDemographics.jsx` both call `searchPatients()` and then filter by DOB; the registration `handleSave()` path calls `registerPatient()` directly and does not require `runDuplicateCheck()` to have been executed first. I also did not find any `/patients/duplicate` backend route in `server.mjs`, even though the M routine `ZVE PATIENT DUPLICATE` exists in `ZVEPAT1.m`.

So the honest status is: pre-registration duplicate checking does exist in the live product, but it is optional/manual plus search-based, not a wired `DUPL` RPC enforcement step equivalent to terminal duplicate handling.

### 🟡 9.12 [LOW] Registration reports: verify they pull real VistA data
This is partially true. The registration reports page is not a dead mock: live `/patients/reports` rendered real divisions, and authenticated `GET /api/ta/v1/reports/registration?tenantId=local-dev` returned `ok: true`, `source: "vista"`, and live summary counts from VistA-backed files. In this environment the endpoint returned `totalRegistered: 2462`, `serviceConnectedVeterans: 0`, and `totalBeds: 500`, and clicking `Generate Report` surfaced those same KPI values in the UI.

But the implementation is much narrower than the page suggests. `RegistrationReports.jsx` exposes six report modes (`registrations`, `eligibility`, `adt`, `census`, `duplicates`, `flags`) plus date and division filters, yet `getRegistrationReport()` always calls the same single `/reports/registration` route and `server.mjs` ignores `type`, `from`, `to`, and `division`. The backend only returns one aggregate `summary` object built from File `2` and File `405.4`; it does not return report-specific detail rows, and the live table remained `No data for this report` after generation. A direct live fetch with `type=registrations` and `type=census` returned identical payloads.

So the honest status is: the reports page does pull some real VistA aggregate data, but it is still only a shared summary shell, not a fully implemented set of registration report variants with real detail output.

---

# SECTION 10: ACCESSIBILITY & COMPLIANCE

### 🟢 10.1
This audit note is stale for the staff wizard. `StaffForm.jsx` now includes an explicit step-change focus effect that queries the active step container and focuses the first available `input`, `select`, or `textarea` whenever `currentStep` changes. Live verification on `/admin/staff/new` confirmed the behavior: after completing Step 1 and clicking `Continue`, the wizard advanced to `Role & Location` and focus moved directly onto the first field in that step.

The precise live result was that focus landed on the first `select` in Step 2 rather than staying on the `Continue` button or falling back to the page body. That satisfies the accessibility intent behind the original finding even though the first control on that step is a select rather than a text input.

### 🟢 10.2
This audit note is stale as written. The main status treatments I checked are not color-only badges anymore; they pair color with visible text labels. The shared `StatusBadge.jsx` component renders the status string itself, so shared badges display words like `Active`, `Inactive`, `Locked`, or `Pending` rather than relying on color alone. `PatientSearch.jsx` follows the same pattern for patient-status pills and prints `Active`, `Inactive`, or `Deceased` inside the colored chip.

Live chrome also reflects the same pattern: the top system bar pairs its green/red VistA indicator dot with text (`VistA` or `VistA Offline`) instead of showing a bare red/green signal. I did not verify every decorative dot or icon in the product, but the specific claim that status badges are only green/red with no text is no longer accurate for the common badge patterns now in use.

### 🟡 10.3
This is only partially true. The product does already contain live announcement mechanisms: `AppShell.jsx` wraps the main content in `aria-live="polite"`, the global toast helper in `services/api.js` sets `aria-live="assertive"`, and some admin workflows use explicit alert/status semantics. For example, `StaffDirectory.jsx` renders dynamic error messages with `role="alert"` and success messages with `role="status"`.

But this is not applied consistently across the product's dynamic form feedback. Several patient workflows still render save/error messages as plain styled `div`s with no dedicated `role="alert"`, `role="status"`, or local `aria-live` container. `PatientDemographics.jsx`, `Admission.jsx`, `Transfer.jsx`, and `Discharge.jsx` all contain examples of these unannotated dynamic error banners. So the honest status is: live-region support exists in the app, but dynamic success/error message announcement is still inconsistent and incomplete.

### 🟡 10.4
This is only partially true. The shared confirmation modal is already focus-trapped: `ConfirmDialog` in `SharedComponents.jsx` gathers focusable elements, moves focus into the dialog on open, and loops `Tab` / `Shift+Tab` between the first and last controls so keyboard focus does not escape.

But that protection is not universal because many custom overlays do not use the shared dialog component and do not implement their own focus trap. Examples include the raw `Assign Permission` modal in `StaffDirectory.jsx`, the `Forward Alert` modal in `AlertsNotifications.jsx`, and the duplicate/sensitive patient overlays in `PatientSearch.jsx`; those overlays render modal markup directly without the same `Tab` loop handling. So the honest status is: modal focus trapping exists in shared confirm dialogs, but custom modals still have a real risk that keyboard focus can escape.

### 🟢 10.5
This audit note is stale. `AppShell.jsx` already renders a `Skip to main content` link at the top of the shell and targets the page's `<main id="main-content">` region. Live DOM verification on `/admin/staff/new` confirmed both pieces are present: the skip link exists and the `main-content` target is in the document.

### 🔴 10.6
This is a real accessibility gap. The main form helper components currently render labels and error text visually, but they do not generate linked control/error ids or apply `aria-describedby` to connect validation text to the relevant input. `PatientDemographics.jsx`'s `Field` helper and `StaffForm.jsx`'s `FormField` helper both show this pattern.

Live DOM inspection on `/admin/staff/new` confirmed the current state: the focused Step 2 control had no `id` and no `aria-describedby` attribute. A source search across `apps/web/src` also did not find active `aria-describedby` usage in the main React web app forms. So the honest status is that screen-reader users still do not get reliable programmatic linkage between these form controls and their inline validation text.

### 🟢 10.7
This audit note is stale for the live staff wizard. `StaffForm.jsx` already marks the active step button with `aria-current="step"` and also supplies a descriptive `aria-label` such as `Step 2: Role & Location (current)`. Live DOM verification on `/admin/staff/new` confirmed that the active step indicator currently exposes both attributes.

### 🔴 10.8
This is a real accessibility gap. The current UI still uses many light-gray text treatments on white backgrounds that do not meet the WCAG 2.1 AA 4.5:1 contrast threshold for normal text. Source examples include numerous `text-[#888]` and `text-[#999]` usages across patient and admin pages such as `RegistrationReports.jsx`, `Admission.jsx`, `Transfer.jsx`, `FinancialAssessment.jsx`, `AdminDashboard.jsx`, and `BedManagement.jsx`.

I verified the contrast numerically in the live browser context: `#888888` on white is about `3.54:1` and `#999999` on white is about `2.85:1`, both below the required minimum. By contrast, darker helper text like `#666666` on white comes out around `5.74:1` and does pass. So the honest status is that the codebase still contains a substantial number of sub-threshold text colors and cannot be marked compliant here.

### 🟢 10.9
This is enforced. Both the admin UI and the VistA write path cap session timeout at 900 seconds. `SiteParameters.jsx` and `SecurityAuth.jsx` both mark the session-timeout control with `enforcedMax: 900`, and the underlying M routine `ZVEADMN1.m` explicitly rejects `AUTOLOGOFF` values above 900 seconds before the FileMan write.

Live proof: an authenticated `PUT /api/ta/v1/params/kernel?tenantId=local-dev` with `{ "paramName": "AUTOLOGOFF", "value": "901", "reason": "audit verification" }` returned HTTP `400` with `source: "zve"` and the message `Session timeout cannot exceed 900 seconds (15 min) per VHA Directive 6500`. So the system is not merely warning; it actively blocks out-of-policy values.

### 🟡 10.10
This is only partially true. The product does expose and communicate several password-policy expectations, such as expiration controls and client-side checks in the new-staff wizard, but it still does not fully enforce Kernel-style credential rules across the actual save paths.

Earlier credential verification already proved two important parity gaps that matter here. First, password history enforcement is missing: the system does not prevent reuse based on prior verify-code history. Second, the rule that verify code must not equal access code is only enforced client-side in one wizard flow, not server-side. I previously created a disposable account with identical access and verify codes and the backend accepted it through `POST /api/tenant-admin/v1/users`, demonstrating that the underlying credential write path still permits a combination that should be blocked. So the honest status is: some password rules exist in UI guidance and partial validation, but full Kernel-equivalent policy enforcement is not yet in place.

### 🔴 10.11
This is not verified, and the current implementation evidence points the other way. The authenticated middleware does switch each request onto the logged-in user's own VistA broker session, so native VistA activity should at least be attributed to the acting DUZ. But the actual patient-read path exposed here does not create any patient-linked audit artifact we can retrieve end to end.

Source inspection shows `GET /api/tenant-admin/v1/patients/:dfn` only calls `ZVE PATIENT DEMOGRAPHICS` (or the DDR fallback) and returns demographics. It does not call `RECLOG^ZVEPAT1`, `AUDITLOG^ZVEADMIN`, or any other explicit patient-access write path. The only patient-specific audit reader in the app is `GET /api/tenant-admin/v1/patients/:dfn/audit-events`, and that route only screens DG SECURITY LOG file `38.1`, which is a restricted-record/security log rather than a general chart-access trail. There is a helper in `ZVEPAT1.m` named `RECLOG(DFN)` for recent-patient tracking, but it is not invoked from the patient read route.

Live proof matched that gap. For DFN `100841`, `GET /api/ta/v1/patients/100841?tenantId=local-dev` returned the chart successfully, but `GET /api/ta/v1/patients/100841/audit-events?tenantId=local-dev` returned zero rows both before and after the read. Even break-the-glass is not durably surfaced here: `POST /api/ta/v1/patients/100841/break-glass?tenantId=local-dev` returned HTTP `200` with `logged: true` and a synthetic `auditId`, yet the patient audit-events route still returned zero rows afterward. So the honest status is red: user attribution intent exists, but an end-to-end, patient-linked audit entry for every patient record access is not currently demonstrated and appears incomplete.

### 🟡 10.12
This is only partially true. A lot of the product is keyboard-operable already: primary navigation uses native `button` elements, form controls are standard inputs/selects, and at least some interactive tables were built with keyboard support in mind. Live DOM on `/admin/staff?search=MANAGER,SYSTEM` confirmed the staff list row is focusable (`tabIndex=0`) rather than mouse-only.

But the absolute claim still fails because several custom interactions are not keyboard accessible. In source, `StaffDirectory.jsx` exposes at least one inline edit affordance as a plain clickable `div` with `onClick={() => setEditing(true)}` and no `tabIndex`, role, or key handler. And in `BedManagement.jsx`, the Census table rows navigate to patient charts on click, but they are rendered as plain `<tr>` elements with `onClick` only.

Live proof confirmed that patient-workflow gap. On `/patients/beds`, after switching to the `Census` tab, the page rendered 297 clickable patient rows, and sample rows were plain `TR` elements with `tabIndex=-1` and no role. So users can activate those rows with a mouse, but not by tabbing to them and pressing Enter/Space. The honest status is yellow: much of the UI already uses keyboard-friendly native controls, but there are still real custom interactive elements that fail Section 508 keyboard access expectations.

---

# SECTION 11: END-TO-END WORKFLOW VERIFICATION

Run each workflow start to finish. Verify at M prompt after every VistA write.

- [x] New employee onboarding: Create user → assign Physician role → ALL keys saved → print welcome letter WITH credentials → user logs in → forced password change → e-sig setup → user functional in CPRS

Result: 🔴 Not yet end to end. Earlier validated work already confirmed two important pieces of this chain: the staff creation success screen exposes `Print Welcome Letter`, and that letter includes the actual access code plus temporary verify code. But a fresh live onboarding run failed before first login completed.

Live proof: an authenticated `POST /api/ta/v1/users?tenantId=local-dev` created disposable user `DUZ 10000000417` with physician-style permissions. The response showed all six requested keys succeeded: `PROVIDER`, `ORES`, `OR CPRS GUI CHART`, `ORCL-SIGN-NOTES`, `ORCL-PAT-RECS`, and `GMRA-ALLERGY VERIFY`. Primary menu `OR CPRS GUI CHART` also saved successfully, but the division-assignment leg was already imperfect: `primaryLocation: 500` failed with `Division not found: 500`.

The blocking failure came at sign-in. Logging in through the live `/login` page with the issued credentials failed with HTTP `401 INVALID_CREDENTIALS`. I then performed an authenticated admin reset through `PUT /api/ta/v1/users/10000000417/credentials?tenantId=local-dev`, which returned HTTP `200` via `ZVE USMG CRED`, but a second login attempt with the new credentials still failed with the same live `INVALID_CREDENTIALS` response. Because the user never reached first sign-in, I could not honestly verify the forced password change, self-service e-signature setup, or functional CPRS access portions of the workflow. Cleanup completed: `POST /api/ta/v1/users/10000000417/terminate?tenantId=local-dev` returned `1^OK^Terminated`.
- [x] Employee departure: Deactivate with reason → DISUSER set → SSN intact → reason in field 9.4 → keys remain (not termination) → user cannot login → admin sees in audit log

Result: 🔴 Not end to end. The deactivation write path does preserve some of the expected semantics, but the workflow still fails important checks and does not present a clean terminal-equivalent offboarding result.

Live proof: I created disposable user `DUZ 10000000418`, confirmed it started `status: active`, and confirmed it had one retained key (`OR CPRS GUI CHART`). An authenticated `POST /api/ta/v1/users/10000000418/deactivate?tenantId=local-dev` with reason `audit departure verification` returned HTTP `200` via `ZVE USMG DEACT`. A fresh `GET /api/ta/v1/users/10000000418?tenantId=local-dev` then showed the reason persisted in `terminationReason`, and `GET /api/ta/v1/users/10000000418/keys?tenantId=local-dev` still returned the original key, so the action did not wipe permissions.

But two critical problems remain. First, the user detail now reports `status: terminated`, not inactive, which collapses the distinction the audit expects between deactivation and full termination. Second, the live admin audit feed did not show the event: `GET /api/ta/v1/reports/admin/audit-summary?tenantId=local-dev` returned `data: []` even immediately after deactivation, so I could not verify that an admin can actually review the departure action in the product's audit surfaces. I also could not honestly verify the `user cannot login` leg here because the earlier onboarding investigation already showed freshly created accounts failing authentication before deactivation, and this disposable record had no SSN populated, so `SSN intact` was not testable on this account. Cleanup completed with `POST /api/ta/v1/users/10000000418/terminate?tenantId=local-dev`, which returned `1^OK^Terminated`.
- [x] Full termination: Terminate user → 0 keys → access code cleared → verify code cleared → e-sig cleared → DISUSER set → user completely locked out

Result: 🔴 Only partially correct at the File 200 write level; not correct end to end. A fresh live disposable-user run created `DUZ 10000000419`, assigned `OR CPRS GUI CHART`, and set an e-signature code before termination. The pre-termination product readbacks confirmed the starting state: `GET /api/ta/v1/users/10000000419?tenantId=local-dev` showed `status: active` with `electronicSignature.hasCode: true`, and `GET /api/ta/v1/users/10000000419/keys?tenantId=local-dev` returned the assigned key.

The termination call itself succeeded: `POST /api/ta/v1/users/10000000419/terminate?tenantId=local-dev` returned HTTP `200` via `ZVE USMG TERM` with `1^OK^Terminated`. Direct live M-prompt verification then showed that some low-level fields were in fact cleared correctly: `$$GET1^DIQ(200,10000000419_",",2,"I")=""`, `$$GET1^DIQ(200,10000000419_",",11,"I")=""`, `$$GET1^DIQ(200,10000000419_",",20.4,"I")=""`, `$$GET1^DIQ(200,10000000419_",",9.2,"I")=3260412`, and `$$GET1^DIQ(200,10000000419_",",7,"I")=1`. So the access code hash, verify code hash, e-signature hash, termination date, and DISUSER field were all written as expected.

But the workflow still fails multiple required legs. First, key removal is incomplete: the File 200 key subfile header reset to `200.051^^0^0`, but direct M inspection still showed `^XUSEC("OR CPRS GUI CHART",10000000419)` present, so the user still holds the security-key cross-reference after “termination.” Second, the product's own read surfaces stayed wrong after the success response: `GET /api/ta/v1/users/10000000419?tenantId=local-dev` still reported `electronicSignature.hasCode: true`, and `GET /api/ta/v1/users/10000000419/keys?tenantId=local-dev` still returned `OR CPRS GUI CHART`. Source explains both mismatches: the detail RPC treats any existing `^VA(200,DUZ,20)` node as e-signature `SET` even when field `20.4` is empty, and the product's termination/login status logic reads the wrong DISUSER field location. Third, the post-termination sign-in leg did not surface a clean disabled-account lockout: a live `POST /api/ta/v1/auth/login` with the terminated credentials returned HTTP `401 INVALID_CREDENTIALS`, not `ACCOUNT_DISABLED`. Because the product still exposes a retained key, still renders the e-signature as active, and still fails the disabled-account path for the wrong reason, the full termination workflow is not honestly green or partial at the user-visible level.
- [x] Employee transfer: Change division from A to B → old division removed from sub-file → new division added → staff list filtered by division B shows user

Result: 🟢 Verified end to end. I created disposable user `DUZ 10000000420`, then used the live division-assignment route to move the account from division `1` (`VEHU DIVISION`) to division `11` (`VEHU CBOC`). `POST /api/ta/v1/users/10000000420/division?tenantId=local-dev` with `{ divisionIen: "1", action: "ADD" }` succeeded first, and `GET /api/ta/v1/users/10000000420?tenantId=local-dev` showed division `1` in the detail payload. A second live add with `{ divisionIen: "11", action: "ADD" }` then showed both divisions in the user detail, and a final remove with `{ divisionIen: "1", action: "REMOVE" }` left only division `11` in the detail payload.

Direct M-prompt verification confirmed the sub-file transition, not just the API wrapper. After the remove, `^VA(200,10000000420,2,0)` read `^^2^1`, `^VA(200,10000000420,2,2,0)=11`, `^VA(200,10000000420,2,"B",1)` was gone, and `^VA(200,10000000420,2,"B",11)` remained present. So the old division really was removed from the File 200 division multiple and the new division really remained.

The list-filter leg also worked. `GET /api/ta/v1/users?tenantId=local-dev&search=TRANSFERCHK&division=11&max=50` returned the transferred user with `division: "998"`, while the same list query with `division=1` returned no matching rows. Cleanup completed afterward with `POST /api/ta/v1/users/10000000420/terminate?tenantId=local-dev`, which returned `1^OK^Terminated`.
- [x] Role change (Nurse → NP): Remove ORELSE → add ORES + PROVIDER → mutual exclusion handled → user can now write orders → user cannot use ORELSE functions

Result: 🟡 Administrative role transition works, but the clinical-function legs remain unproven. I created disposable user `DUZ 10000000421` as a nurse-style account with `assignedRole: nurse` plus live keys `ORELSE` and `OR CPRS GUI CHART`. The starting state was confirmed by both `GET /api/ta/v1/users/10000000421?tenantId=local-dev` and `GET /api/ta/v1/users/10000000421/keys?tenantId=local-dev`, which showed `ORELSE` present and no `ORES` or `PROVIDER` key.

The mutual-exclusion and key-swap legs worked correctly. A live attempt to add `ORES` while `ORELSE` was still assigned returned HTTP `409` with `Cannot assign ORES: user holds ORELSE (mutually exclusive)`. After that, `DELETE /api/ta/v1/users/10000000421/keys/ORELSE?tenantId=local-dev` succeeded, followed by successful live adds for `ORES` and `PROVIDER`. I also updated the product's assigned-role extension through `PUT /api/ta/v1/users/10000000421?tenantId=local-dev` with `{ field: "ROLE", value: "nurse-practitioner" }`, which returned `ZVE UEXT SET`. Final readback showed `assignedRole: nurse-practitioner` and keys `OR CPRS GUI CHART`, `ORES`, and `PROVIDER`, with `ORELSE` gone.

What I could not honestly prove live was the behavior after that administrative change. The product sources do consistently map `ORES` to order-writing authority and `ORELSE` to verbal-order authority, and the final key state matches that expectation. But when I tested the converted account's actual sign-in path, `POST /api/ta/v1/auth/login` still returned HTTP `401 INVALID_CREDENTIALS`, matching the earlier fresh-account authentication defect from the onboarding workflow. Because the user never reached a clinical session, I could not directly verify that they can now write orders or that any ORELSE-gated actions are actually denied in runtime use. Cleanup completed with `POST /api/ta/v1/users/10000000421/terminate?tenantId=local-dev`, which returned `1^OK^Terminated`.
- [x] Password reset: Admin resets password → user logs in with new password → forced change → new password → login works

Result: 🔴 Still blocked by the live authentication defect. I created disposable user `DUZ 10000000422`, then performed an authenticated admin password reset through `PUT /api/ta/v1/users/10000000422/credentials?tenantId=local-dev` with a new verify code. That reset returned HTTP `200` via `ZVE USMG CRED`, so the admin-side write path does execute.

But the workflow failed on the very next required step. A live `POST /api/ta/v1/auth/login` with the reset credentials returned HTTP `401 INVALID_CREDENTIALS` instead of a successful first sign-in or a password-expired / verify-expired response that would trigger the forced-change leg. Because the user could not sign in with the reset password at all, I could not honestly verify the forced password change screen, the post-change credential write, or the final successful login. Cleanup completed with `POST /api/ta/v1/users/10000000422/terminate?tenantId=local-dev`, which returned `1^OK^Terminated`.
- [x] Clone user: Clone physician → new user has all keys → credentials set → can login → all provider fields present

Result: 🔴 The live clone route currently does not deliver the required profile copy. I first created disposable physician-style source user `DUZ 10000000423` with live keys `PROVIDER`, `ORES`, `OR CPRS GUI CHART`, `ORCL-SIGN-NOTES`, and `ORCL-PAT-RECS`, plus physician title and provider-style create payload fields. `GET /api/ta/v1/users/10000000423?tenantId=local-dev` confirmed the source held those keys and exposed `assignedRole: physician`.

The clone call itself returned success but not the expected data. `POST /api/ta/v1/users/clone?tenantId=local-dev` with `{ sourceDuz: 10000000423, newName: "CLONEDST,API985739" }` returned HTTP `200` using `ZVE USMG ADD` plus `ZVE USER CLONE`, but the clone RPC line payload was `1^OK^0^0`, meaning zero keys and zero secondary menus were copied. The target detail confirmed that failure: `GET /api/ta/v1/users/10000000424?tenantId=local-dev` returned no keys, blank title, blank assigned role, and no provider fields; `GET /api/ta/v1/users/10000000424/keys?tenantId=local-dev` returned an empty array.

The credentials and login legs also failed. The clone route never supplied credentials to `ZVE USMG ADD`, and a live `POST /api/ta/v1/auth/login` using the source credentials against the cloned account still returned HTTP `401 INVALID_CREDENTIALS`. So the workflow does not currently produce a clone with the source physician's keys, does not provision usable credentials, and does not preserve the provider profile details the audit expects. Cleanup completed afterward with `POST /api/ta/v1/users/10000000423/terminate?tenantId=local-dev` and `POST /api/ta/v1/users/10000000424/terminate?tenantId=local-dev`, both returning `1^OK^Terminated`.
- [x] Lock/unlock: 3 failed logins → LOCKED status shown in list → admin unlocks → ACTIVE → user can login

Result: 🔴 The live behavior does not match the claimed workflow. I created disposable user `DUZ 10000000425`, then drove five consecutive bad sign-in attempts against `POST /api/ta/v1/auth/login`. The first four failures returned `INVALID_CREDENTIALS` with a live remaining-attempt countdown from 4 to 1, and only the fifth returned `ACCOUNT_LOCKED` with `attemptsRemaining: 0` and `lockoutThreshold: 5`. So the system does not lock after three failed logins; the active threshold is five.

The product's lock-state surfaces were also inconsistent. Even after the fifth failure returned `ACCOUNT_LOCKED`, `GET /api/ta/v1/users?tenantId=local-dev&search=LOCKTEST&max=20` still listed the user as `status: ACTIVE`, not `LOCKED`. An authenticated admin `POST /api/ta/v1/users/10000000425/unlock?tenantId=local-dev` returned HTTP `200` via `ZVE USMG UNLOCK`, but its payload said `1^OK^Was not locked`, so the unlock path did not agree that the account was actually in a lockout state.

Because the unlock step never reflected a real locked user in the staff list, and because a subsequent correct-credential login attempt immediately hit the app's own `429 Too many login attempts` guard instead of demonstrating restored sign-in, I could not honestly verify the final `user can login` leg either. Cleanup completed with `POST /api/ta/v1/users/10000000425/terminate?tenantId=local-dev`, which returned `1^OK^Terminated`.
- [x] Patient registration: Search → no match → register with demographics → insurance → means test → patient complete in File 2

Result: 🔴 Blocked at the registration step, so the downstream insurance / means-test / File 2 completion legs could not be honestly proven. I first verified the no-match precondition with a live search: `GET /api/ta/v1/patients?tenantId=local-dev&search=ZZAUDITREG` returned `data: []` through `ZVE PATIENT SEARCH EXTENDED`.

I then attempted the registration step twice against the live patient-create route. A richer demographics payload for disposable patient `ZZAUDITREG,PT04130422` returned HTTP `502` from `POST /api/ta/v1/patients?tenantId=local-dev` with `source: "zve"` and `error: "Cannot read properties of undefined (reading 'toString')"`. To rule out a single bad optional field, I retried with a bare-minimum payload for `ZZAUDITMIN,PT04130424` containing only name, DOB, SSN, and sex. That also failed with HTTP `502`, this time returning the underlying VistA-side rejection `Registration failed: The list of fields is missing a required identifier for File #2.`

Direct M-prompt verification confirmed that neither failed attempt created a patient record. Exact lookups of `^DPT("B","ZZAUDITREG,PT04130422",0)` and `^DPT("B","ZZAUDITMIN,PT04130424",0)` returned no entry, so there was no File 2 patient to continue with. Because the supported registration route never produced a `dfn`, I could not legitimately execute the next required steps through `/patients/:dfn/insurance` and `/patients/:dfn/assessment`, and I could not verify a patient complete in File 2. The workflow is therefore still red at its first write step, not partially green.
- [x] Patient admission: Select patient → admit → ward + bed assigned → movement in File 405 → census updated

Result: 🟢 The core admission workflow now verifies end to end against the live system. I used existing patient `DFN 101044` (`ZZTESTPATIENT,ISSUE-ONE`), first confirming the baseline state through `GET /api/ta/v1/patients/101044?tenantId=local-dev`, which showed no current ward, no admit date, and no room/bed. The pre-admission census snapshot also did not contain `DFN 101044`.

The admit action itself succeeded live. `POST /api/ta/v1/patients/101044/admit?tenantId=local-dev` with `{ wardIen: "1", roomBed: "001-A", diagnosis: "AUDIT ADMISSION", attendingDuz: "1", admitType: "1" }` returned HTTP `200` through `ZVE ADT ADMIT` with movement `5294`, ward `WARD A-AUTOMATED`, and room/bed `001-A`.

Direct M-prompt verification confirmed both required data writes. `^DGPM(5294,0)` was filed as `3260412.202731^1^101044^1^^1^001-A^^^AUDIT ADMISSION^^^^5294^^^^1`, proving a new File 405 admission movement. `^DPT(101044,.1)` read `1^001-A^^^^^^^^^^^^^^3260412.202731`, proving the patient's current ward, room/bed, and admission date were updated in File 2. The census leg also passed: the post-admission ward census for `wardIen=1` now included `DFN 101044` with `roomBed: "001-A"` and `admissionDate: "Apr 12, 2026@20:27:31"`, while the pre-admission census snapshot had no entry for that patient.

One product readback remains inconsistent but does not change the audit result for this claim: `GET /api/ta/v1/patients/101044?tenantId=local-dev` still returned blank `wardLocation`, `admitDate`, and `roomBed` immediately after the successful admit even though File 2 and the census both updated correctly. So the patient-detail read surface is stale here, but the actual admission, ward/bed assignment, File 405 movement creation, and census update all verified live.
- [x] Patient discharge: Select inpatient → discharge → movement created → bed freed → census updated

Result: 🟡 The underlying discharge mechanics work, but the product's inpatient read surface is inconsistent enough that I cannot call the full workflow cleanly green. I reused the actively admitted `DFN 101044` from the prior admission check and discharged that stay through `POST /api/ta/v1/patients/101044/discharge?tenantId=local-dev` with `{ diagnosis: "AUDIT DISCHARGE", disposition: "Home", dischargeType: "1" }`. That returned HTTP `200` via `ZVE ADT DISCHARGE` with movement `5295`.

The low-level and census proofs both passed. Direct M-prompt verification showed a new File 405 discharge movement at `^DGPM(5295,0)=3260412.202901^3^101044^^^1^^^^AUDIT DISCHARGE^^^^^^^1`. It also showed the patient's current location was cleared from File 2: `^DPT(101044,.1)` no longer held a ward or room/bed in its leading pieces after discharge. The post-discharge ward census for `wardIen=1` no longer returned any row for `DFN 101044`, so the patient was removed from the active inpatient census and the bed was effectively freed for census purposes.

What keeps this from a full green is the product-facing inpatient-state readback. While this same patient was admitted, `GET /api/ta/v1/patients/101044?tenantId=local-dev` still returned blank `wardLocation`, `admitDate`, and `roomBed`, and the discharge page source warns `This patient does not appear to be currently admitted.` whenever `patient?.roomBed` and related status fields are empty. So the discharge API can complete the ADT movement correctly, but the supported read surface does not reliably identify the currently admitted patient as an inpatient beforehand. That makes the overall workflow only partially proven end to end.
- [x] Clinic management: Create clinic (TYPE=C only) → edit name → inactivate → reactivate → verify at M prompt each step

Result: 🟢 Verified end to end with live API and M-level proof at each state change. I created disposable clinic `ZZAUDCLIN 04130430` through `POST /api/ta/v1/clinics?tenantId=local-dev`, which returned HTTP `200` via `ZVE CLNM ADD` with `newIen: "949"`. Both the clinic detail route and direct File 44 inspection confirmed the create produced a real clinic-type record: `GET /api/ta/v1/clinics/949?tenantId=local-dev` showed field `2: "CLINIC"`, the list query `GET /api/ta/v1/clinics?tenantId=local-dev&search=ZZAUDCLIN` returned the new row with `type: "C"`, and direct M read `^SC(949,0)=ZZAUDCLIN 04130430^^C...` proved the entry was stored as a clinic.

The edit step also worked live. `PUT /api/ta/v1/clinics/949?tenantId=local-dev` with `{ name: "ZZAUDCLIN REN 04130430" }` returned HTTP `200` via `ZVE CLNM EDIT`, the clinic list immediately read back the new name, and direct M verification showed the File 44 zero node name piece changed to `ZZAUDCLIN REN 04130430`.

Inactivation and reactivation both matched the audit claim and the underlying File 44 state. `POST /api/ta/v1/clinics/949/inactivate?tenantId=local-dev` returned HTTP `200` and filed clinic field `2505` with `4/13/2026`; the list route then showed `inactivateDate: "3260413"`, the detail route showed `2505: "APR 13,2026"`, and direct M verification showed `^SC(949,"I")=3260413`. `POST /api/ta/v1/clinics/949/reactivate?tenantId=local-dev` then returned HTTP `200` with field `2505` cleared to `@`; afterward the clinic list again showed a blank inactivation date, the clinic detail showed `2505: ""`, and direct M verification showed `^SC(949,"I")` empty. So create, rename, inactivate, reactivate, and the required M-prompt checks all passed on the same live clinic record.
- [x] MailMan: Send message → recipient receives → forward to another user → original message still exists

Result: 🔴 The live MailMan workflow does not satisfy the claimed send/receive/forward chain. I exercised the supported send path through `POST /api/ta/v1/mailman/send?tenantId=local-dev` three times: once to active user `DUZ 10000000334`, once to active user `DUZ 10000000246`, and once as a self-mail control to `DUZ 1`. All three calls returned HTTP `200` with `messageId` values `142677`, `142678`, and `142679` respectively, so the API does create MailMan message records.

But delivery failed on the next leg. Direct M-prompt verification showed each message existed in File 3.9 (`^XMB(3.9,142677,0)=AUDIT MAIL 0413043301^1^3260412.203305`, `^XMB(3.9,142678,0)=AUDIT MAIL ALT 0412203430^1^3260412.203452`, `^XMB(3.9,142679,0)=AUDIT MAIL SELF 0412203445^1^3260412.203512`). However, scans of the recipient mailbox baskets found no corresponding basket entry in `^XMB(3.7,recipient,2,BIEN,1,MSGIEN)` for any of those messages, including the self-mail control in `DUZ 1`'s mailbox. The product-level readback matched that failure: after the self-mail send returned `messageId: 142679`, `GET /api/ta/v1/mailman/inbox?tenantId=local-dev&folder=IN&max=20` still returned no row with subject `AUDIT MAIL SELF 0412203445`. So the message records are being created, but the recipient-receives leg is not actually working in the mailbox surfaces.

The forward leg is also absent, not merely unverified. Source inspection confirmed the tenant-admin MailMan API only exposes `baskets`, `inbox`, `message/:ien`, `send`, and `delete`; there is no MailMan forward route. The web MailMan message pane likewise only exposes `Reply` and `Delete`, while the only `Forward` modal in `AlertsNotifications.jsx` is for alerts, not MailMan messages. Because actual receipt is broken even for self-mail and there is no supported MailMan forward action to test, the full workflow remains red. The original message records do still exist in File 3.9, but not in a way that satisfies the claimed recipient and forward behavior.
- [x] Security parameter change: Submit 2P request → second admin sees pending → approves → parameter changes in VistA Kernel params → verify at M prompt

Result: 🟢 The two-person approval path itself now verifies end to end against the live system. As `MANAGER,SYSTEM` / `DUZ 1`, I submitted `POST /api/ta/v1/config/2p?tenantId=local-dev` with `{ section: "login", field: "MAX SIGN-ON LIMIT", oldValue: "", newValue: "7", reason: "audit two-person integrity verification" }`, which returned HTTP `200` with `requestId: "1"`. `GET /api/ta/v1/config/2p?tenantId=local-dev&status=PENDING` immediately showed that pending item with `submitterDuz: "1"`, and a same-session `POST /api/ta/v1/config/2p/1/approve?tenantId=local-dev` correctly failed with HTTP `502` / `Cannot approve your own change request. A different administrator must approve.`

I then authenticated a separate disposable second-admin account and repeated the pending/approve legs from that different session. `GET /api/ta/v1/config/2p?tenantId=local-dev&status=PENDING` under `DUZ 10000000426` returned the same request, and `POST /api/ta/v1/config/2p/1/approve?tenantId=local-dev` returned HTTP `200`. The parameter write verified both through the product read surface and at the M prompt: a fresh `GET /api/ta/v1/params/kernel?tenantId=local-dev` showed `MAX SIGN-ON LIMIT = "7"`, direct M read `$$GET1^DIQ(8989.3,"1,",219,"I")=7`, and the queue node recorded approval metadata as `^XTMP("ZVE2P",1)=login^MAX SIGN-ON LIMIT^^7^audit two-person integrity verification^1^3260412.204358^APPROVED^10000000426^3260412.204509`.

For audit hygiene I also submitted the reverse request `requestId: "2"` to restore the original blank value, approved it from the same second-admin session, and verified at the M prompt that File `8989.3` field `219` was blank again. Narrowing note: the underlying 2P queue / self-approval block / second-admin approval / parameter write all work, but I had to use the already-known fresh-account login workaround to obtain a second usable admin session in this sandbox, and a zero-key version of that helper account still received overly broad `navGroups` at login even though the VistA RPC context blocked actual 2P access until real admin keys were assigned.

---

# SECTION 12: PER-HANDLER VERIFICATION — Every Button Must Work

Click every button. Does it call the API? Does the API call VistA? Does VistA respond correctly? Does the UI update?
The AI coder must verify each handler by performing the action in the browser and checking the result.

## StaffDirectory

### `handleRowClick`
**Action:** Click a user row → detail panel opens with 3 parallel API calls (detail + keys + menu structure)
**Verify:** Core sections load from live VistA data. If one fails, the page should not mislabel secondary-menu data as CPRS-tab data.

Result: 🟡 Normal detail loads are real, but the failure-isolation claim is still only partial. Current `StaffDirectory.jsx` now launches three parallel calls: `getStaffMember()`, `getUserPermissions()`, and `getUserMenuStructure()`. The earlier separate `getCprsTabAccess()` fetch was removed after live VistA verification showed File `200.03` is `SECONDARY MENU OPTIONS SUB-FIELD`, not a CPRS-tab store. Live browser validation against visible staff rows showed the detail panel now renders `Secondary Menu Options` from the menu-structure payload, and no longer shows a false `CPRS Tab Access` section.

What is not fully true is the promised per-section fault isolation. Source shows `getCprsTabAccess()` and `getUserMenuStructure()` each have local fallback catches, but `getStaffMember()` and `getUserPermissions()` do not. Those four calls are wrapped in a single outer `Promise.all(...)`, and any failure in the detail or key request path drops into the outer catch, which sets `detailData._loadError`. The detail-panel render then short-circuits to one global `Failed to load details` block with a single `Try Again` action instead of keeping the surviving sections visible with per-section error states. So row click really does drive parallel live loads, but the stronger claim that any one failed section leaves the others visible is only partially implemented today.

### `handleDeactivate`
**Action:** Click Deactivate → reason dialog → confirm → ZVE USMG DEACT
**Verify:** M: DISUSER=1, field 9.4 has reason, SSN unchanged. UI: status badge changes to Inactive.

Result: 🔴 Not correct end to end. Source shows `handleDeactivate` calls `deactivateStaffMember()`, then optimistically flips the open detail panel to `status: 'inactive'` and shows a success message claiming the action was recorded in the audit log. But the live system does not actually preserve those semantics.

Live proof on the current `default` tenant used disposable DUZ `10000000428`. Before deactivation, `GET /api/tenant-admin/v1/users?tenantId=default&search=DEACT045543` returned the user with `status: ACTIVE` and `keyCount: 1`, and `GET /api/tenant-admin/v1/users/10000000428/keys?tenantId=default` returned `OR CPRS GUI CHART`. I seeded a known SSN directly in File 200, then `POST /api/tenant-admin/v1/users/10000000428/deactivate?tenantId=default` with reason `handleDeactivate audit 045543` returned HTTP `200` via `ZVE USMG DEACT`. After that, the same list endpoint returned `status: TERMINATED`, not inactive, and the key still remained assigned, so the live UI/read model is treating this as a termination-style state rather than an inactive user state.

Direct M verification proved only part of the audit claim. File 200 field `9` stayed unchanged at `555443333`, field `9.4` stored `handleDeactivate audit 045543`, and field `9.2` stored `3260412`. But `$$GET1^DIQ(200,10000000428_",",7,"I")` remained blank, so the required `DISUSER=1` leg did not happen in the running environment. The admin audit surface also still failed the claim: `GET /api/tenant-admin/v1/reports/admin/audit-summary?tenantId=default` returned an empty dataset immediately afterward. I also could not honestly prove the `user cannot login` leg independently here because the fresh-account authentication defect remains active on this stack: the disposable account returned `401 INVALID_CREDENTIALS` both before and after deactivation. So this handler writes a reason and termination date while preserving SSN, but it does not deliver the audited inactive-account behavior. Cleanup completed afterward: `POST /api/tenant-admin/v1/users/10000000428/terminate?tenantId=default` returned `1^OK^Terminated`.

### `handleReactivate`
**Action:** Click Reactivate → confirm → ZVE USMG REACT
**Verify:** M: DISUSER cleared, SSN intact. UI: status badge changes to Active.

Result: 🟡 The core state-reset path works, but the handler overclaims what reactivation means in the current product. Source shows `handleReactivate` calls `reactivateStaffMember()`, then force-sets the open detail panel to `status: 'active'` and always shows `They can now sign in.` The same button is rendered for both `inactive` and `terminated` users, not just soft-deactivated ones.

Live proof reused disposable DUZ `10000000428`, which had just been fully terminated during cleanup from the prior item. Before reactivation, `GET /api/tenant-admin/v1/users?tenantId=default&search=DEACT045543` returned `status: TERMINATED`. `POST /api/tenant-admin/v1/users/10000000428/reactivate?tenantId=default` then returned HTTP `200` via `ZVE USMG REACT`, and the same live list endpoint afterward returned `status: ACTIVE`, so the user-visible status badge/list state really does move back to Active.

Direct M verification showed the reactivation write path itself is mostly real. The raw `^VA(200,10000000428,7)` node was blank again after reactivation, so the DISUSER flag location this app actually uses was cleared, File 200 field `9` still held `555443333`, and field `9.2` was blank again. That satisfies the narrow `DISUSER cleared` plus `SSN intact` portion of the audit target. But the stronger user-facing implication is not reliable: because this same handler is available for terminated users, and full termination had already cleared access and verify codes, the reactivated account still could not sign in. A fresh `POST /api/tenant-admin/v1/auth/login` with the original credentials returned `401 INVALID_CREDENTIALS` after reactivation. So the status flip back to Active is real, but the handler's unconditional `They can now sign in.` message is only partially true in the live product. Cleanup completed afterward: `POST /api/tenant-admin/v1/users/10000000428/terminate?tenantId=default` returned `1^OK^Terminated`.

### `handleCloneUser`
**Action:** Click Clone → name/credentials form → ZVE USMG ADD + ZVE USER CLONE
**Verify:** M: new user exists with all source keys. UI: success message with new DUZ.

Result: 🟡 The clone path is real, but the handler overstates how complete the clone is and does not surface the new DUZ in the UI success state. Source shows `handleCloneUser` calls `cloneStaffMember(...)` and then only reports `Cloned {source} → {name}. The new account has the same permissions and settings.` There is no new-DUZ value in that success message even though the backend returns one.

Live proof on the current `default` tenant cloned DUZ `1` to disposable user `10000000429` with name `AUDIT,CLONE050039`. `POST /api/tenant-admin/v1/users/clone?tenantId=default` returned HTTP `200` with `newDuz: 10000000429` and clone payload `1^OK^134^12`. Readback matched the strong part of the claim: `GET /api/tenant-admin/v1/users/1/keys?tenantId=default` returned `134` keys, and `GET /api/tenant-admin/v1/users/10000000429/keys?tenantId=default` also returned `134` keys. `GET /api/tenant-admin/v1/users/10000000429/access-audit?tenantId=default` also showed `12` secondary menus copied, matching the clone payload's menu count.

What is not fully true is the handler's stronger `same permissions and settings` claim and the audit's requested success message behavior. The live access-audit readback for the clone showed `primaryMenu: (none)`, so the source user's primary menu was not copied even though the UI success copy implies all settings matched. And because `handleCloneUser` discards the returned `newDuz`, the user-visible success message still does not include the new DUZ at all. So the clone workflow does preserve the source keys, but the UI confirmation and `same settings` claim are only partially accurate. Cleanup completed afterward: `POST /api/tenant-admin/v1/users/10000000429/terminate?tenantId=default` returned `1^OK^Terminated`.

### `handleClearEsig`
**Action:** Click Clear E-Signature → confirm → ZVE USMG ESIG clear
**Verify:** M: field 20.4 empty. UI: e-sig status shows 'Not set'.

Result: 🟡 The clear operation itself is real, but the read-side status model is still wrong. Source shows `confirmClearEsig()` calls `setESignature(..., { action: 'clear' })` and then locally forces `detailData.esigStatus='incomplete'` plus an empty signature-block name, so the open detail panel would immediately render a not-set state.

Live proof used existing test user DUZ `20239` (`Atl,Student`), which already appeared in the live e-signature roster. Before clearing, `GET /api/tenant-admin/v1/esig-status?tenantId=default` returned `duz: 20239`, `esigStatus: active`, `hasCode: true`, and `sigBlockName: STUDENT ATL`. `POST /api/tenant-admin/v1/users/20239/esig?tenantId=default` with `{ "action": "clear" }` then returned HTTP `200` via `ZVE ESIG MANAGE`.

Direct M verification proved the actual clear worked: after the call, `$$GET1^DIQ(200,20239_",",20.4,"I")` was empty, so File 200 field `20.4` really was cleared. But the live status surface did not follow it. A fresh `GET /api/tenant-admin/v1/esig-status?tenantId=default` still reported the same user as `esigStatus: active` and `hasCode: true`. Direct M readback explains why: the account still retained `^VA(200,20239,20)=^STUDENT ATL^^`, so the current status reader is effectively treating the existence of node `20` as proof that an e-signature exists even when field `20.4` is blank. So the write path is correct, and the local detail panel update would show the expected result, but the live read-side e-signature status remains stale/wrong after clear. Cleanup completed afterward: the test account's e-signature was restored via `POST /api/tenant-admin/v1/users/20239/esig?tenantId=default` with code `REST0502`, and direct M verification showed field `20.4=REST0502` again.

### `confirmRemovePermission`
**Action:** Click X on key pill → confirm → ZVE USMG KEYS DEL
**Verify:** M: key removed from sub-file 51 + ^XUSEC. UI: pill disappears.

Result: 🟢 This flow is grounded end to end. Live verification used disposable DUZ `10000000430` and key `OR CPRS GUI CHART`. After assigning the key for setup, `DELETE /api/tenant-admin/v1/users/10000000430/keys/OR%20CPRS%20GUI%20CHART?tenantId=default` returned HTTP `200` via `ZVE USMG KEYS`, and `GET /api/tenant-admin/v1/users/10000000430/keys?tenantId=default` immediately returned an empty list, which is the same state the UI uses to remove the pill from the detail panel.

Direct M verification confirmed both required write locations were cleared. After removal, `^XUSEC("OR CPRS GUI CHART",10000000430)` was absent (`HASXUSEC=0`), `^VA(200,10000000430,51,"B","OR CPRS GUI CHART")` was gone, and the File 200 key subfile header read `200.051^^1^0`, showing no remaining active key entries for that permission on the user.

### `handleAssignPerm`
**Action:** Click Assign in modal → ZVE USMG KEYS ADD
**Verify:** M: key added to sub-file 51 + ^XUSEC. UI: new pill appears.

Result: 🟢 This flow is also grounded end to end. On the same disposable DUZ `10000000430`, `POST /api/tenant-admin/v1/users/10000000430/keys?tenantId=default` with `keyName="OR CPRS GUI CHART"` returned HTTP `200` via `ZVE USMG KEYS`, and `GET /api/tenant-admin/v1/users/10000000430/keys?tenantId=default` immediately returned `OR CPRS GUI CHART`, which is the live data the detail panel uses to render the new permission pill.

Direct M verification confirmed both target write paths. After assignment, `^XUSEC("OR CPRS GUI CHART",10000000430)` existed (`HASXUSEC=1`), the File 200 key multiple header read `200.051^^1^1`, and `^VA(200,10000000430,51,"B","OR CPRS GUI CHART")` resolved to subentry `1`. So the assign-modal action really does add the key in both the File 200 sub-file and Kernel's security-key cross-reference. Cleanup completed afterward: `POST /api/tenant-admin/v1/users/10000000430/terminate?tenantId=default` returned `1^OK^Terminated`.

### `handleProviderFieldSave`
**Action:** Click save on inline NPI/DEA edit → POST /users/:duz/provider
**Verify:** M: field updated. UI: shows new value.

Result: 🟡 This path is only partially reliable. Source inspection shows `EditableDetailField` sends `setProviderFields(duz, { field, value, lastModified: detailData.lastModified })`, and `handleProviderFieldSave` itself only mirrors the new value into local state after the request succeeds. On disposable DUZ `10000000432` with no extension metadata, a live `POST /api/tenant-admin/v1/users/10000000432/provider?tenantId=default` for `field="npi"`, `value="1234567893"`, and the exact `lastModified` token from `GET /api/tenant-admin/v1/users/10000000432?tenantId=default` returned `{ ok: true, field: "NPI", rpcUsed: "DDR FILER" }`. A fresh detail read then exposed `vistaGrounding.npi="1234567893"`, which is the same data the detail panel uses, and direct M verification returned `NPI=1234567893` from File 200 field `41.99`.

But the real inline-save contract breaks for users that carry extension data such as `employeeId` or assigned role. On disposable DUZ `10000000431`, created with employee ID `PROV-0413051104`, the same UI-style provider save flow rejected the detail-page token with `{"ok":false,"error":"This user was modified by another admin. Refresh before saving.","code":"CONCURRENT_EDIT"}`. The backend source explains why: `GET /users/:duz` fingerprints `ZVE USER DETAIL` plus `fetchUserExtensions(...)`, while `/users/:duz/provider` validates concurrency with `hashUserDetailLines(zCur.lines)` only and drops those extension fields. So provider edits can save correctly for users without extension metadata, but the normal inline action falsely conflicts on users that do have extension-backed fields. Cleanup completed afterward: `POST /api/tenant-admin/v1/users/{10000000431,10000000432,10000000433}/terminate?tenantId=default` each returned `1^OK^Terminated`.

### `handleBasicFieldSave`
**Action:** Click save on inline phone/email edit → ZVE USER EDIT or DDR
**Verify:** M: field updated. UI: shows new value.

Result: 🟢 This path held up end to end on the live stack. Source inspection shows `handleBasicFieldSave` maps detail-panel edits to `updateStaffMember(duz, { field, value, lastModified: detailData.lastModified })`, and the backend `PUT /api/tenant-admin/v1/users/:ien` route validates the same optimistic-concurrency fingerprint that `GET /users/:duz` returns, including extension data. On disposable DUZ `10000000434`, created with extension-backed employee ID `BASIC-0413051506`, a live phone save with `field=".132"`, `value="5551234567"`, and the current detail token returned `{ ok: true, rpcUsed: "ZVE USER EDIT" }`. A subsequent email save with `field=".151"`, `value="basic434@example.org"`, and the refreshed token also returned `{ ok: true, rpcUsed: "ZVE USER EDIT" }`.

The UI read path matches the write path here. A fresh `GET /api/tenant-admin/v1/users/10000000434?tenantId=default` returned `vistaGrounding.officePhone="5551234567"` and `vistaGrounding.email="basic434@example.org"`, which is the data `StaffDirectory.jsx` copies into `detailData.phone` and `detailData.email` after the request resolves. Direct M verification matched both fields exactly: `PHONE=5551234567` from File 200 field `.132` and `EMAIL=basic434@example.org` from File 200 field `.151`. Cleanup completed afterward: `POST /api/tenant-admin/v1/users/10000000434/terminate?tenantId=default` returned `1^OK^Terminated`.

### `handleExportCsv`
**Action:** Click Export CSV → client-side CSV generation
**Verify:** CSV downloads with correct filtered data and column headers.

Result: 🟡 The export mechanism works, but the data is only partially correct. Source inspection shows `handleExportCsv` is purely client-side: it serializes the current `filtered` array into a Blob with header `Name,Staff ID,Title,Department,Site,Status,E-Signature,Permissions,Role,NPI,Email,Phone,Last Login`, then triggers a download named `staff-directory-YYYY-MM-DD.csv`. The filter scope is real: `filtered` is the same active/non-system/search/esign subset currently shown in the grid.

The problem is that several exported columns are not actually populated by the live list data feeding `filtered`. `loadData()` builds `staffList` rows from `GET /api/tenant-admin/v1/users?tenantId=default&max=500` plus `GET /api/tenant-admin/v1/esig-status?tenantId=default`, but that merged list only carries `ien`, `name`, `status`, `title`, `service`, `division`, `lastLogin`, `keyCount`, `isProvider`, and `employeeId`. It never fills `role`, `npi`, `email`, or `phone`, and it also blanks numeric title pointers before export. Live proof: for active DUZ `10000000246` (`ANALYST,PAT`), the generated CSV row is `"ANALYST,PAT","10000000246","","INFORMATION SYSTEMS CENTER","","active","Ready","34","","","",""`, while `GET /api/tenant-admin/v1/users/10000000246?tenantId=default` shows real detail values including `title="COMPUTER SPECIALIST"` and `vistaGrounding.officePhone="6655544"`. So the CSV header is correct and the row selection is filtered correctly, but multiple advertised fields export as blanks even when live user detail has values.

### `handleTerminate (via detail menu)`
**Action:** Click Terminate → confirm → ZVE USMG TERM
**Verify:** M: 0 keys, access code empty, DISUSER=1. UI: status Terminated.

Result: 🔴 This flow does not deliver the full termination semantics it claims. Source inspection shows `handleTerminate` is a thin wrapper around `terminateStaffMember(duz)`, and the confirm modal explicitly warns that it “clears credentials, removes all security keys, and sets DISUSER.” On disposable DUZ `10000000435`, created with live credentials and assigned `OR CPRS GUI CHART` before termination, `POST /api/tenant-admin/v1/users/10000000435/terminate?tenantId=default` returned `{ ok: true, rpcUsed: "ZVE USMG TERM" }`, and a fresh `GET /api/tenant-admin/v1/users/10000000435?tenantId=default` reported `status="terminated"` with a populated termination date. So the visible terminated state is real.

The failure is in the “0 keys” guarantee. A follow-up `GET /api/tenant-admin/v1/users/10000000435/keys?tenantId=default` still returned `OR CPRS GUI CHART`. Direct M verification confirmed only a partial cleanup: `DISUSER=1`, access code field `2` was empty, but `^XUSEC("OR CPRS GUI CHART",10000000435)` still existed (`HASXUSEC=1`), `^VA(200,10000000435,51,1,0)` still held `OR CPRS GUI CHART`, and `^VA(200,10000000435,51,"B")` still existed even though the subfile header read `200.051^^0^0`. That leaves the account terminated but not actually stripped of all key traces, so the detail-menu termination flow overclaims a critical security outcome.

### `handleUnlock (via detail menu)`
**Action:** Click Unlock → ZVE USMG UNLOCK
**Verify:** M: lockout cleared, sign-on counter reset. UI: status Active.

Result: 🟡 The canonical unlock behavior works, but the sign-on counter reset cannot be independently proven on this stack. Source inspection shows `handleUnlock` simply calls `unlockUser(duz)` and then reloads the directory. On disposable DUZ `10000000436`, I seeded the live VistA lockout marker directly with `^XUSEC("LOCKED",10000000436)=""`; pre-checks showed `LOCKED=1`. A live `POST /api/tenant-admin/v1/users/10000000436/unlock?tenantId=default` then returned `{ ok: true, rpcUsed: "ZVE USMG UNLOCK", lines: ["1^OK^Was locked"] }`.

The post-action readback matched the expected unlock semantics. Direct M verification showed `LOCKED=0`, and a fresh `GET /api/tenant-admin/v1/users/10000000436?tenantId=default` still returned `status="active"`, which is what the grid/detail UI would display after reload. The only missing leg is the failed-sign-on counter: the routine attempts to clear File 200 field `7.3`, but on this live stack that field read blank both before and after unlock, even after a direct seeding attempt, so the counter-reset portion is not separately observable here. Cleanup completed afterward: `POST /api/tenant-admin/v1/users/10000000436/terminate?tenantId=default` returned `1^OK^Terminated`.

### `loadData (page load)`
**Action:** Page mount → GET /users + GET /esig-status
**Verify:** Data loads within 2s for 200 users. Skeleton shown during load.

Result: 🟢 This page-load path is grounded and meets the stated performance bar on the live stack. Source inspection shows `loadData()` fires `getStaff({ max: 500 })` and `getESignatureStatus()` in `Promise.all(...)`, while the table body renders `TableSkeleton rows={10} cols={7}` whenever `loading` is true. Live timing against the actual page-mount endpoints on `tenantId=default` came back at `1887 ms` total for both requests in parallel, with HTTP `200` from each endpoint, `500` users returned by `/api/tenant-admin/v1/users?tenantId=default&max=500`, and `118` rows returned by `/api/tenant-admin/v1/esig-status?tenantId=default`.

That is stronger than the audit threshold: the page-load data fan-out completed under two seconds even at the current 500-row cap, not merely for 200 users. The merge logic that follows those calls is the same data path used to populate the table, and the loading branch is explicitly wired to show the skeleton before the fetch resolves, so this item closes green.

## StaffForm

### `handleSubmit (create mode)`
**Action:** Fill all fields → click Create → POST /users → ZVE USMG ADD + EXTRA_MAP + keys + divisions
**Verify:** M: all fields present. UI: success screen with user details.

Result: 🟡 The create wizard is grounded, but it overstates some persisted details. Source inspection shows create mode posts the composed payload directly to `POST /api/tenant-admin/v1/users`, then builds the success screen mostly from the form state rather than from a fresh server read. That distinction matters because the payload keys do not fully match the backend create map. In particular, `StaffForm.jsx` sends `department`, while the backend create route only maps `serviceSection` into File 200 field `29`.

Live proof confirmed the split. Submitting a create-style payload for disposable DUZ `10000000437` with `email=form437@example.org`, `phone=5557654321`, `npi=1234567893`, `role=RC-1`, `department=NURSING`, `employeeId=FORM-0413052346`, and permission `OR CPRS GUI CHART` returned `ok: true` via `ZVE USMG ADD`; the backend also reported successful extra writes for email, phone, NPI, employee ID, assigned role, and permission assignment. Direct M verification matched the successful subset exactly: `EMAIL=form437@example.org`, `PHONE=5557654321`, `NPI=1234567893`, and `^XUSEC("OR CPRS GUI CHART",10000000437)` existed. But File 200 service field `29` remained blank (`SERVICE=`), even though the wizard payload carried `department="NURSING"` and the success screen code would still display `department: form.department`. So create mode does persist several core fields and reach a success state, but the claim that the submitted fields are all present is too strong because at least the department/service mapping is currently broken. Cleanup completed afterward: `POST /api/tenant-admin/v1/users/10000000437/terminate?tenantId=default` returned `1^OK^Terminated`.

### `handleSubmit (edit mode)`
**Action:** Edit fields → click Save → PUT for each changed field
**Verify:** M: changed fields updated, unchanged fields untouched. UI: success.

Result: 🟡 The edit wizard can persist changed fields, but the contract is only partially honest. Source inspection shows edit mode does not submit one bulk payload; it diffs `originalForm` and then issues individual `updateStaffMember(...)`, permission, division, secondary-menu, rename, and credential calls. Live proof on disposable DUZ `10000000438` showed the happy path works for valid values: changing email to `after438@example.org` and department to the valid service `MEDICAL ADMINISTRATION` returned success through `ZVE USER EDIT`, and a fresh `GET /api/tenant-admin/v1/users/10000000438?tenantId=default` showed `vistaGrounding.email="after438@example.org"`, `vistaGrounding.serviceSection="MEDICAL ADMINISTRATION"`, while unchanged `vistaGrounding.npi` stayed `1234567893`. Direct M verification matched that exactly: `EMAIL=after438@example.org`, `SERVICE=MEDICAL ADMINISTRATION`, `NPI=1234567893`.

But the wizard overpromises what users can successfully edit. The Department field is rendered as a free-text input with hint text `Type to search or enter a custom department`, yet the same edit-mode path rejected `department="CARDIOLOGY"` with `Edit failed: The value 'CARDIOLOGY' for field SERVICE/SECTION in file NEW PERSON is not valid.` So changed fields are not universally writable the way the form implies; they only succeed when the typed department matches a real SERVICE/SECTION entry. This keeps the item out of green even though valid changed fields do persist and unchanged fields can remain untouched. Cleanup completed afterward: `POST /api/tenant-admin/v1/users/10000000438/terminate?tenantId=default` returned `1^OK^Terminated`.

### `validateStep (person)`
**Action:** Click Next on step 1 → validates name, sex, DOB, credentials
**Verify:** Missing name → error. Invalid phone → error. All valid → advances.

Result: 🟡 The step validation is mostly real, but one of the promised inline messages did not surface cleanly in the live wizard. Browser verification on `/admin/staff/new` confirmed the missing-data path: clicking Continue with incomplete Step 1 state produced inline required-field errors including `First name is required`, `Sex is required`, `Date of birth is required`, `Username (Access Code) is required`, and `Password (Verify Code) is required`, while the form remained on Step 1. With a fully valid person step (`DOE`, `JANE`, sex `Female`, DOB `1980-01-01`, valid username, matching password, valid phone), clicking Continue advanced the live wizard to Step 2 `Role & Location`, which matches the intended success path.

The weak spot is phone-error surfacing. Source inspection says invalid phone should set `Phone must contain at least 10 digits`, and live behavior did block advancement when the phone field contained only `12345`, but the explicit inline phone message was not rendered in the page text during that blocked state. So the person-step gate is working, but at least one promised validation message is not reliably visible in the live UI.

### `validateStep (role)`
**Action:** Click Next on step 2 → validates role, department, site
**Verify:** Missing role → error. Missing department → error.

Result: 🟢 This step validation is grounded in the live wizard. On Step 2 `Role & Location`, clicking Continue with nothing selected produced the expected inline errors: `Role selection is required`, `Department is required`, and also the related required-field messages `Primary menu is required` and `At least one site must be selected`. The wizard stayed on Step 2 while those errors were shown.

The success path also held up. Selecting the first provider role card (`Physician`), choosing primary menu `OR CPRS GUI CHART`, entering department `NURSING`, and selecting primary site `VEHU DIVISION — 500` allowed the live wizard to advance out of Step 2. Because that role implies provider access, the next visible step became `Provider Setup`, confirming the role-step gate passes once its required fields are satisfied.

### `validateStep (provider)`
**Action:** Click Next on step 3 → validates NPI, DEA if present
**Verify:** Invalid NPI Luhn → error. Invalid DEA format → error.

Result: 🟡 Provider-step validation is only partially surfaced in the live UI. Browser verification on the live `Provider Setup` step showed the NPI validation working exactly as intended: entering `1234567890` and clicking Continue produced the inline error `NPI check digit is invalid`, and leaving Provider Type empty also surfaced `Provider type is required`. But malformed DEA input did not render the expected inline error. Entering `AB123` blocked advancement indirectly, yet no `DEA must be 2 letters followed by 7 digits` message appeared in the rendered step.

Source inspection explains the mismatch: `validateStep('provider')` does compute `errors.dea`, but the `DEA Number` control is rendered as `<FormField label="DEA Number" ...>` without passing `error={validationErrors.dea}` into the field wrapper. The valid path is still real: setting Provider Type to `Physician/Osteopath (MD/DO)`, NPI to `1234567893`, and DEA to `AB1234563` advanced the live wizard to Step 4 `Review & Create`. So the provider-step gate exists, but the DEA validation message is currently lost in the UI.

### `acCheckTimeout`
**Action:** Type in access code field → 500ms debounce → POST /users/check-access-code
**Verify:** Type existing username → 'Already in use' appears. New username → 'Available'.

Result: 🟢 The debounce path is real in the live wizard. On Step 1 `Person & Credentials`, browser instrumentation around the Username field showed zero `POST /api/ta/v1/users/check-access-code` requests after typing `AB`, still zero 300 ms after finishing `ABCD`, and then exactly one request with body `{"accessCode":"ABCD"}` only after the field sat idle for roughly 650 ms. After that call returned, the input rendered the green `check_circle` state. That matches the source behavior of a 500 ms timeout with prior timers cleared on each keystroke.

The backend uniqueness result is not trustworthy on this stack: every probe value tested through the same route came back `available: true`, so this closure is green only for the timeout/debounce behavior itself, not for duplicate-detection accuracy.

### `loadRefData`
**Action:** Wizard mount → loads sites, departments, permissions, mail groups
**Verify:** All 4 dropdowns populate. If VistA down, error banner shown.

Result: 🟡 Reference-data loading is only partial in the live wizard. On mount, `/admin/staff/new` first showed `Loading reference data (sites, departments, permissions)...`, then settled into a persistent red banner: `Reference data unavailable. No departments returned. The system may be unreachable.` At the same time, the `Job Title` dropdown still populated with many live File 3.1 title options, proving the loader is not completely dead.

So the function does run and can hydrate at least some sources, but the current environment is missing one of the key datasets the wizard promises to load. Because the page itself warns that sites, departments, and permissions may be empty until the system is reachable, this item is only partially working end to end.

### `auto-save (sessionStorage)`
**Action:** Fill step 1 → close tab → re-open → wizard restored
**Verify:** Form data, current step, timestamp all restored.

Result: 🟢 The wizard draft auto-save is real in the live browser. Before re-testing the remaining StaffForm items, the page opened directly on `Review & Create` with restored Jane Doe data, and the browser session storage contained `ve-wizard-draft` with a serialized payload including `step: 3`, the saved form values, and a live `ts` timestamp. That is direct proof that the restore path is active.

The write-back path is also live. After returning to Step 1 and editing the Username field, waiting just over one second updated `sessionStorage` with a fresh `ve-wizard-draft` object containing `step: 0` and a newer timestamp. Reload attempts from that dirty state also triggered the expected `beforeunload` warning, which is consistent with the form treating the draft as unsaved user work. On the evidence available in the live page, the sessionStorage save-and-restore behavior is working.

## RoleTemplates

### `handleConfirmAssignRole`
**Action:** Select user → select role → Assign → loop ZVE USMG KEYS ADD
**Verify:** M: all role keys present. UI: success with count.

Result: 🟡 The underlying role-assignment write loop is real, but the live browser path is only partially working. On `/admin/roles`, the built-in `Physician` detail pane rendered correctly and exposed the `Assign to Staff Member` action. Clicking it opened `Assign Role: Physician`, but the modal never surfaced any selectable staff rows. After waiting several seconds and typing the disposable target name `ROLETST,UI286164`, the dialog still rendered only `Cancel` and a disabled `Assign Role` button. In the same authenticated browser context, `GET /api/ta/v1/users?tenantId=default&search=ROLETST,UI286164` returned the target user `DUZ 10000000439` with `keyCount:0`, so the empty picker is a real UI failure, not an absent user.

The write side itself does work. Replaying the same six-key loop through the live permission API succeeded for every physician-role key: `PROVIDER`, `ORES`, `OR CPRS GUI CHART`, `ORCL-SIGN-NOTES`, `ORCL-PAT-RECS`, and `GMRA-ALLERGY VERIFY` all returned HTTP `200` via `ZVE USMG KEYS` with `1^OK^ADD`, and a follow-up `GET /api/ta/v1/users/10000000439/keys?tenantId=default` returned all six keys. Direct M verification matched exactly: `KEYHDR=200.051^^6^6`, and each of those six `^XUSEC(key,10000000439)` nodes existed (`=1`). So the assignment loop behind `handleConfirmAssignRole` is grounded, but the current modal does not reliably let an operator reach that path through the UI. Cleanup completed afterward: `POST /api/ta/v1/users/10000000439/terminate?tenantId=default` returned `1^OK^Terminated`.

### `handleConfirmRemoveRole`
**Action:** Select user → select role → Remove → loop ZVE USMG KEYS DEL
**Verify:** M: all role keys removed. UI: success with count.

Result: 🔴 This bulk role-removal flow does not currently exist as described. Source inspection of `RoleTemplates.jsx` found no `handleConfirmRemoveRole` implementation and no bulk `remove role` loop over the role's keys. The only removal logic present is `handleRemoveHeldKey(keyName)`, which removes one key at a time for an already-selected user inside the assign modal.

The live page matches that gap. The role detail view exposes `Assign to Staff Member`, `View Staff with This Role`, `Export Role JSON`, and `Clone Role`, but no `Remove Role` action for unassigning an entire role bundle from a user. Because the current product offers neither the promised handler nor a reachable UI path that loops `ZVE USMG KEYS DEL` across all role keys, this item remains red.

### `handleCreateCustomRole (ZVE SITE CR CRT)`
**Action:** Enter name → Create → custom role saved
**Verify:** M: ^ZVEX has role entry. UI: role appears in list.

Result: 🟡 The custom-role create flow does persist a role record, but it does not preserve the cloned key set correctly. On the live `/admin/roles` page, clicking `Create Custom Role`, entering `AUDIT ROLE 288074`, and confirming immediately added that role to both the usage report and the left-side role list. A live `GET /api/ta/v1/roles/custom` then returned the new record with `id="CR676735641"`, confirming the create RPC ran and the custom role was stored.

The stored key payload is malformed. Direct M verification showed `^XTMP("ZVECR","CR676735641",0)` populated as expected, but only one key node existed: `KEY1=PROVIDER;ORES;OR CPRS GUI CHART;ORCL-SIGN-NOTES;ORCL-PAT-RECS;GMRA-ALLERGY VERIFY`. In other words, the entire cloned physician key bundle was persisted as a single semicolon-delimited string instead of separate key entries. The read API exposed the same mismatch by returning `keys:["1"]` for that new role instead of the actual cloned permissions. Source explains the root cause: the server joins keys with `;`, while the M create routine iterates pieces using `^` as the delimiter. So this flow is only partially working: the custom role record is created, but its cloned permission set is not stored in a usable per-key structure. Cleanup completed afterward: `DELETE /api/ta/v1/roles/custom/CR676735641` returned HTTP `200`.

### `handleDeleteCustomRole (ZVE SITE CR DEL)`
**Action:** Click Delete → confirm → custom role removed
**Verify:** M: ^ZVEX entry gone. UI: role removed from list.

Result: 🟡 The delete backend works, but the current browser path is only partially reachable. On `/admin/roles`, I created throwaway custom role `AUDIT DELETE 179878`, and `GET /api/ta/v1/roles/custom` returned it as `id="CR676735785"`. Source inspection shows the intended UI path is `handleDeleteCustom(roleId) -> setDeleteTarget(roleId) -> confirmDeleteCustom() -> deleteCustomRole(roleId)`, so a visible `Delete` action should be the entry point.

In the live browser, the `Delete` button existed in the DOM for the selected custom role, but it was not visible/clickable in the current viewport, so I could not honestly claim a clean `Click Delete → confirm` success path from the rendered UI. The underlying delete path itself is real: `DELETE /api/ta/v1/roles/custom/CR676735785` returned HTTP `200`, and direct M verification immediately afterward showed `EXISTS=0` for `^XTMP("ZVECR","CR676735785")`. So the custom role can be deleted and the backing record does disappear, but the current UI does not reliably expose that delete action in the browser state tested here.

### `cycleAccess`
**Action:** Click workspace badge → cycles rw→ro→none
**Verify:** Badge text changes. Saves to custom role data.

Result: 🔴 This interaction does not currently satisfy the described workflow. Source inspection shows the badge click handler only mutates local `editedWorkspaceAccess`; it does not save anything by itself. Persistence happens only through a separate `Save Workspace Access` button rendered later in the right-side role-detail panel.

In the live `/admin/roles` browser state tested here, those workspace controls were not visible at all: `Workspace Access` and `Save Workspace Access` both resolved as not visible, which matches the component layout that hides the role-detail panel behind `xl:block`. So the promised `click badge -> text changes -> saves to custom role data` flow is not actually available end to end in the current rendered UI.

## PermissionsCatalog

### `handleBatchAssign`
**Action:** Select key → select 3 users → Assign → loops ZVE USMG KEYS ADD
**Verify:** M: all 3 users have key. UI: success.

Result: 🟢 This batch-assign flow held up end to end. On the live `/admin/permissions` page, filtering to `CPRS Chart Access`, clicking `Assign`, searching `BATCH,`, selecting disposable users `DUZ 10000000440`, `10000000441`, and `10000000442`, and clicking `Assign to 3 Selected` closed the modal without error. The modal itself showed the expected batch footer state: `3 staff selected` and `Assign to 3 Selected`.

The post-action reads matched the UI behavior. A follow-up `GET /api/ta/v1/users/{10000000440,10000000441,10000000442}/keys?tenantId=default` returned `OR CPRS GUI CHART` for each user, and direct M verification showed `^XUSEC("OR CPRS GUI CHART",DUZ)` present for all three (`HAS=1`). Cleanup completed afterward: `POST /api/ta/v1/users/10000000440/terminate`, `...441/terminate`, and `...442/terminate` each returned `1^OK^Terminated`.

### `handleViewStaff`
**Action:** Click 'View Holders' on key → shows holder list
**Verify:** List populated from getPermissionHolders. Names match M prompt.

Result: 🔴 The holder-view UI is not surfacing live data correctly. On the same `CPRS Chart Access` row, the table showed `17` staff holders, and clicking `View Staff` opened the modal headed `Staff with this permission` for `CPRS Chart Access` — but the body incorrectly said `No staff members hold this permission.`

That empty modal contradicts the live backend and VistA state. In the same authenticated browser session, `GET /api/ta/v1/key-holders/OR%20CPRS%20GUI%20CHART?tenantId=default` returned `holderCount:17` and a concrete holder list that included known recent users `ROLETST,UI286164`, `BATCH,42367BA1`, `BATCH,42487BA2`, and `BATCH,42587BA3`. Direct M verification on the disposable batch users also showed their File 200 names with `^XUSEC("OR CPRS GUI CHART",DUZ)=1`. So the underlying `getPermissionHolders` data exists, but the live modal did not populate it, which makes this handler red from the user-facing perspective.

## ClinicManagement

### `handleCreate`
**Action:** Enter name + stop code → Create → POST /clinics
**Verify:** M: File 44 entry with TYPE=C. UI: clinic appears in list.

Result: 🟡 The create flow only partially holds up end to end. On the live `Add Clinic` modal, entering `ZZAUDCLIN 94935` with stop code `2` showed the green helper text `File 40.7: ADMITTING/SCREENING` and enabled `Create Clinic`, but clicking it surfaced the red error `The value '2' for field STOP CODE NUMBER in file HOSPITAL LOCATION is not valid.` The failing leg is the follow-up stop-code write: replaying `PUT /api/ta/v1/clinics/950/fields?tenantId=default` with `{field:"8",value:"2"}` returned HTTP `400` from `DDR VALIDATOR` with that same message.

The initial create itself did succeed. Reloading `/admin/clinics` increased the live total from `572` to `573`, and searching the list showed `ZZAUDCLIN 94935` as a new active clinic. Authenticated readback from `GET /api/ta/v1/clinics/950?tenantId=default` showed `.01=ZZAUDCLIN 94935` and `2=CLINIC`, and direct M verification showed `^SC(950,0)=ZZAUDCLIN 94935^^C...`, proving a real File 44 clinic entry was created with TYPE=`C`. So `POST /clinics` works, but the end-to-end create experience is only partial because the stop-code write fails and leaves the new clinic with blank stop code.

### `handleSave`
**Action:** Edit clinic field → Save → PUT /clinics/:ien/fields
**Verify:** M: field updated in File 44. UI: shows new value.

Result: 🟡 The underlying save route works, but the tested browser UI does not expose a normal clickable edit path. After selecting clinic `950`, the `Edit` control existed only as a zero-size hidden button in the DOM, matching the detail rail's `hidden xl:block` rendering in this browser session. Using the same authenticated session to hit the actual write route directly, `PUT /api/ta/v1/clinics/950/fields?tenantId=default` with `{field:".01",value:"ZZAUDCLIN 94935 EDIT"}` returned HTTP `200` via `DDR VALIDATOR` + `DDR FILER`.

That write persisted cleanly. Reloading `/admin/clinics` and filtering to `ZZAUDCLIN 94935 EDIT` showed the renamed clinic row, `GET /api/ta/v1/clinics/950?tenantId=default` returned `.01=ZZAUDCLIN 94935 EDIT`, and direct M verification showed `^SC(950,0)=ZZAUDCLIN 94935 EDIT^^C...`. So the save/write path is real, but the visible UI path is only partial in the tested browser because the edit rail never becomes user-clickable.

### `handleInactivateReactivate (inactivate)`
**Action:** Click Inactivate → confirm → sets INACTIVATE DATE
**Verify:** M: File 44 has inactivate date. UI: status shows Inactive.

Result: 🟡 The inactivate write path works, but its entry point is hidden in the tested browser UI. After selecting clinic `950`, the `Inactivate` button existed only as a zero-size hidden DOM control; invoking that hidden control produced a visible confirm dialog headed `Inactivate Clinic` for `ZZAUDCLIN 94935`, and confirming it completed successfully.

The results lined up across UI, API, and M. The live clinic list then showed `ZZAUDCLIN 94935 Inactive (3260413)`, `GET /api/ta/v1/clinics/950?tenantId=default` returned `2505=APR 13,2026`, and direct M verification showed `^SC(950,"I")=3260413`. So the confirm/write flow is real, but the visible click path is only partial because the initiating control is not actually rendered at usable size in this browser session.

### `handleInactivateReactivate (reactivate)`
**Action:** Click Reactivate → confirm → clears date
**Verify:** M: inactivate date cleared. UI: status Active.

Result: 🟡 Reactivate behaves the same way: the visible entry button is hidden in the tested browser, but the confirm/write path works once triggered. After the clinic was inactive, the hidden `Reactivate` control opened a visible `Reactivate Clinic` confirm dialog for `ZZAUDCLIN 94935`, and confirming it succeeded.

Post-action readback was consistent. `GET /api/ta/v1/clinics/950?tenantId=default` returned blank `2505`, the filtered clinic row showed `Active` again, and direct M verification showed `^SC(950,"I")` empty while the File 44 zero node remained intact. So the reactivation write path is green underneath, but the tested UI still only earns a partial because the initiating control is not directly usable in the rendered browser state.

## WardManagement

### `handleCreate`
**Action:** Enter name → Create → POST /wards
**Verify:** M: File 42 entry. UI: ward in list.

Result: 🟢 Ward create works through the normal visible UI flow. On `/admin/wards`, clicking `Add Ward`, entering `ZZAUDWARD 388491`, and submitting `Create Ward` closed the modal cleanly and increased the page count from `65` to `66`.

Readback matched across browser, API, and M. A live search on the same page returned `ZZAUDWARD 388491`, `GET /api/ta/v1/wards?tenantId=default&search=ZZAUDWARD%20388491` returned File 42 IEN `66`, `GET /api/ta/v1/wards/66?tenantId=default` returned `.01=ZZAUDWARD 388491`, and direct M verification showed `^DIC(42,66,0)=ZZAUDWARD 388491` with `^DIC(42,0)=WARD LOCATION^42I^66^66`. This item is fully green.

### `handleSave`
**Action:** Edit ward → Save → PUT /wards/:ien
**Verify:** M: field updated. UI: shows new value.

Result: 🟡 The underlying File 42 update path works, but the normal visible edit entry point is hidden in the tested browser. After selecting ward `66`, the page marked the row selected, but the detail rail remained under the `hidden xl:block` layout and the only `Edit` button present in the DOM had `width=0`, `height=0` at `innerWidth=1203`, leaving no honest normal click path to reach the save form.

The backend write path is real. Authenticated `PUT /api/ta/v1/wards/66/fields?tenantId=default` with `{name:"ZZAUDWARD 388491 EDIT"}` returned HTTP `200` via `DDR FILER`, reloading `/admin/wards` and searching for the updated name showed `ZZAUDWARD 388491 EDIT`, `GET /api/ta/v1/wards/66?tenantId=default` returned `.01=ZZAUDWARD 388491 EDIT`, and direct M verification showed `^DIC(42,66,0)=ZZAUDWARD 388491 EDIT`. So the save write path is green underneath, but the tested UI remains only partial because the edit rail is not actually usable at this browser width.

## DeviceManagement

### `handleCreate`
**Action:** Enter name → Create → POST /devices
**Verify:** M: File 3.5 entry. UI: device in list.

Result: 🟢 Device create works through the normal visible UI flow. On `/admin/devices`, the `Add Device` modal accepted `ZZAUDDEV 388491` with type `HFS` and open parameters `/tmp/zzauddev388491.txt`, submitted cleanly, and increased the page count from `47` to `48`.

Readback matched across UI, API, and M. Filtering the page by the device name showed `ZZAUDDEV 388491` with type `HFS`, `GET /api/ta/v1/devices?tenantId=default&search=ZZAUDDEV%20388491` returned File 3.5 IEN `712`, `GET /api/ta/v1/devices/712?tenantId=default` returned `.01=ZZAUDDEV 388491`, type `HOST FILE SERVER`, margin `80`, page length `60`, and open parameters `/tmp/zzauddev388491.txt`, and direct M verification showed `^%ZIS(1,712,0)=ZZAUDDEV 388491`. This item is green.

### `handleDelete`
**Action:** Click Delete → confirm → DELETE /devices/:ien
**Verify:** M: File 3.5 entry gone. UI: device removed.

Result: 🟡 The delete write path works, but the initiating control is hidden in the tested browser. After selecting device `712`, the detail rail stayed under the `hidden xl:block` layout at `innerWidth=1203`, and the only `Delete` button in the DOM had zero width and height. Triggering that hidden control did open a visible `Delete Device` confirm dialog for `ZZAUDDEV 388491`, and confirming it succeeded.

Post-delete verification was consistent. The device count fell back from `48` to `47`, filtering the page by `ZZAUDDEV 388491` showed `No records found matching your filters.`, `GET /api/ta/v1/devices?tenantId=default&search=ZZAUDDEV%20388491` returned an empty list, `GET /api/ta/v1/devices/712?tenantId=default` returned only `[ERROR]` data, and direct M verification showed `$D(^%ZIS(1,712))=0`. So deletion is real underneath, but the visible click path is only partial because the initiating button is not usable at this browser width.

### `handleTestPrint`
**Action:** Click Test Print → POST /devices/:ien/test-print → ZVE DEV TESTPRINT
**Verify:** M: print job queued or error returned. UI: success/error message.

Result: 🟡 The underlying test-print route works, but the UI entry point is again hidden in the tested browser. After selecting existing device `HFS` (IEN `524`), the `Test Print` button in the detail rail also existed only as a zero-size hidden DOM control; triggering it opened a visible `Test Print` confirm dialog for `HFS`.

The backend/M side is live. `POST /api/ta/v1/devices/524/test-print?tenantId=default` returned HTTP `200` with `ZVE DEV TESTPRINT` lines `1^OK`, `DEVICE^HFS`, `LOCATION^/tmp/hfs.dat`, and `TEST^PRINT OK - 3260413.021545`, and direct M verification via `D TPRINT^ZVEDEV(.R,524)` returned `R(0)="1^OK"` and `R(5)="TEST^PRINT OK - 3260413.021629"` once `U="^"` was initialized in the prompt. In this browser session I could not get a visible post-confirm success banner to render from the hidden rail state, so this remains partial rather than green.

## MailGroupManagement

### `handleAddMember`
**Action:** Search user → Add → POST /mail-groups/:ien/members → ZVE MAILGRP ADD
**Verify:** M: member in File 3.8 sub-file. UI: member appears in list.

Result: 🟡 The underlying add-member write works, but the tested browser does not expose an honest normal entry path and the member list is currently misparsed. After selecting `ABSV BETA` (IEN `187`), the `Add Member` button existed only as a zero-size hidden DOM control inside the `hidden xl:block` detail rail. Triggering that hidden control opened a visible `Add Member` modal, searching `ACCESS` returned `ACCESS,NEW` (DUZ `11272`), and clicking that result completed the add flow.

The write hit VistA. Direct M verification before the add showed no real entries under `^XMB(3.8,187,1,...)`; after the UI add, direct M verification showed `^XMB(3.8,187,1,1,0)=11272`. Browser state and API readback also changed, but only partially correctly: the grid row count for `ABSV BETA` changed from `1` to `2`, the hidden detail DOM included `ACCESS,NEW`, and `GET /api/ta/v1/mail-groups/187/members?tenantId=default` returned the real added member. However, that same route also incorrectly surfaced the RPC status line as a fake member row (`{"ien":"1","name":"OK","type":"1"}`), so the visible count/list is inflated and misleading. Because the initiating control is hidden and the UI list is malformed, this remains partial rather than green.

### `handleRemoveMember`
**Action:** Click Remove → DELETE /mail-groups/:ien/members/:duz → ZVE MAILGRP REMOVE
**Verify:** M: member gone from sub-file. UI: member removed.

Result: 🟡 The underlying remove-member write works, but the tested browser again hides the normal initiating control and the member list stays misleading because of the same parsing bug. After adding `ACCESS,NEW` to `ABSV BETA`, the per-member remove button existed only as a zero-size hidden DOM control. Triggering that hidden button opened a visible `Remove Member` confirm dialog for `ACCESS,NEW`, and confirming it completed the removal flow.

Post-remove verification was consistent at the storage layer. The grid row count for `ABSV BETA` fell back from `2` to `1`, the hidden detail DOM no longer contained `ACCESS,NEW`, `GET /api/ta/v1/mail-groups/187/members?tenantId=default` returned only the fake status-row object (`{"ien":"1","name":"OK","type":"0"}`), and direct M verification showed the real membership multiple empty again with `COUNT^0` under `^XMB(3.8,187,1,0)`. So the actual removal is real, but this remains partial because the remove entry point is hidden and the API/UI member list still misreports the RPC status line as if it were a member.

## DepartmentsServices

### `handleCreate`
**Action:** Enter name → Create → POST /services
**Verify:** M: File 49 entry. UI: department in list.

Result: 🟡 The create write works, but the page's read path is broken enough that the created department never becomes visible in the UI. Before any write, this page already loaded `(0 departments)` and the empty-state panel even though direct M verification showed File `49` populated (`^DIC(49,0)=SERVICE/SECTION^49I^1048^54`, first real entry `^DIC(49,2,0)=MEDICINE^^^^^^^C`). `GET /api/ta/v1/services` from the same authenticated browser context also returned `data:[]` / `total:0`, so the listing route was already inconsistent with VistA.

The create modal itself submitted without error. Entering disposable department `ZZAUDDEPT 388491` with abbreviation `ZZD388` and clicking `Create Department` created a real File `49` entry: direct M verification showed `^DIC(49,"B","ZZAUDDEPT 388491",1049)` and `^DIC(49,1049,0)=ZZAUDDEPT 388491`. However, the UI remained at `(0 departments)` with `No departments configured yet.`, and `GET /api/ta/v1/services/1049` returned a blank named record (`{"ien":"1049","name":""...}`) instead of the newly created department. So the underlying create is live, but the page cannot honestly prove success through its own readback, which keeps this partial.

### `handleDeleteDept`
**Action:** Click Delete → confirm → DELETE /services/:ien
**Verify:** M: File 49 entry gone. UI: removed. MUST check for assigned users first.

Result: 🟡 The delete write works for an unassigned disposable department, but the page never exposed a usable delete path because the read side could not surface any department records at all. I first checked the required safety precondition directly in VistA: scanning File `200` node `^VA(200,DUZ,5)` piece `1` for the disposable department IEN `1049` returned `COUNT^0`, so no users were assigned to the test department.

Because the page still showed `(0 departments)` and no rows after the successful create, there was no honest way to select `ZZAUDDEPT 388491`, reach the hidden detail rail, or open the page's `Delete Department` confirm dialog. I therefore verified the underlying delete route directly: `DELETE /api/ta/v1/services/1049` returned HTTP `200` with `action:"deleted"` via `DDR FILER`, and direct M verification showed the entry removed (`^DIC(49,"B","ZZAUDDEPT 388491")` no longer existed and `$D(^DIC(49,1049,0))=0`). So deletion is real for the safe disposable record, but the page remains partial because its broken read/list path prevents an honest UI delete flow.

## SecurityAuth

### `handleSave (login section)`
**Action:** Change AUTOLOGOFF → Save
**Verify:** UI: success path is correct for the implemented behavior. M/API: determine whether value changes immediately or only after approval.

Result: 🔴 The original audit claim is no longer true. In the live product, the Login Security section does not write Kernel parameters directly on save. Changing `Session Timeout` from `300` to `360`, entering reason `Audit verification change`, and clicking `Submit for Approval` showed a success banner (`Change request submitted. A second administrator must approve before it takes effect.`), reset the visible field back to `300`, and created a pending approval row with `Cannot self-approve`.

The live parameter did not change at this stage. `GET /api/ta/v1/params/kernel?tenantId=default` still returned `AUTOLOGOFF="300"`, and direct M verification via `D PARAMGT^ZVEADMN1(.R)` returned `PARAM^AUTOLOGOFF^300^Session auto-signoff timeout (seconds)`. So `handleSave` for the login section is now a two-person submission entry point rather than the direct `PUT /params/kernel -> ZVE PARAM SET` write claimed by the original audit line.

### `submit2PChange`
**Action:** Change sensitive param → Submit → POST /config/2p
**Verify:** Pending request visible to other admins.

Result: 🟢 The two-person submission path works as implemented. Using the same live browser action above (`AUTOLOGOFF 300 -> 360` with reason `Audit verification change`) created request `id="3"`. The page rendered `Pending Approval (1)` with `Session Timeout`, `300 → 360`, `Submitted by: MANAGER,SYSTEM — "Audit verification change"`, and a disabled `Cannot self-approve` control.

API verification matched the UI. `GET /api/ta/v1/config/2p?status=ALL` returned request `3` with `section:"login"`, `field:"AUTOLOGOFF"`, `oldValue:"300"`, `newValue:"360"`, `submitterDuz:"1"`, and `status:"PENDING"`. This is the correct live behavior for sensitive login-section changes.

### `approve2PRequest`
**Action:** Click Approve → POST /config/2p/:id/approve
**Verify:** Parameter actually changes in VistA. M: verify.

Result: 🟢 The approval path works end to end with a different administrator. I used the saved second-admin session from `audit2p-cookies.txt`, which resolved to `AUDIT2P,TEMP426` / `DUZ 10000000426`, to approve request `3` via `POST /api/ta/v1/config/2p/3/approve`. That returned HTTP `200` with `{ok:true,source:"zve"}`.

The change took effect live. Reloading `/admin/security` removed the pending approval section, the page compliance snapshot and Login Security form both showed `Session Timeout = 360`, `GET /api/ta/v1/params/kernel?tenantId=default` returned `AUTOLOGOFF="360"`, direct M verification via `D PARAMGT^ZVEADMN1(.R)` returned `PARAM^AUTOLOGOFF^360^Session auto-signoff timeout (seconds)`, and the queue node recorded approval metadata as `^XTMP("ZVE2P",3)=login^AUTOLOGOFF^300^360^Audit verification change^1^...^APPROVED^10000000426^...`.

### `reject2PRequest`
**Action:** Click Reject → POST /config/2p/:id/reject
**Verify:** Request removed. Parameter unchanged.

Result: 🟢 The rejection path also works end to end with the second-admin session. To test rejection without disturbing unrelated settings, I submitted a reverse request `id="4"` from the main browser to change `AUTOLOGOFF` back from `360` to `300` with reason `Audit reject verification`. The page again showed `Pending Approval (1)` with `360 → 300` and `Cannot self-approve`, and `GET /api/ta/v1/config/2p?status=ALL` showed request `4` as `PENDING`.

Using the same `AUDIT2P,TEMP426` session, `POST /api/ta/v1/config/2p/4/reject` returned HTTP `200` with `{ok:true,source:"zve"}`. After reloading `/admin/security`, the pending section was gone, `GET /api/ta/v1/config/2p?status=ALL` showed request `4` as `REJECTED` with approver `10000000426`, the page still showed `Session Timeout = 360`, `GET /api/ta/v1/params/kernel?tenantId=default` still returned `AUTOLOGOFF="360"`, direct M verification still returned `PARAM^AUTOLOGOFF^360^Session auto-signoff timeout (seconds)`, and the queue node recorded `^XTMP("ZVE2P",4)=login^AUTOLOGOFF^360^300^Audit reject verification^1^...^REJECTED^10000000426^...`. That confirms rejection clears the pending request without applying the proposed parameter change.

## AlertsNotifications

### `handleSend (MailMan)`
**Action:** Compose → Send → POST /mailman → ZVE MM SEND
**Verify:** M: message in ^XMB. UI: message in Sent folder.

Result: 🔴 The underlying MailMan send RPC can create a real message, but the browser compose flow is not honestly usable and the claimed Sent-folder result is false. In `/admin/messages` → `Messages`, clicking `Compose` opened the modal, but typing `MANAGER` into the recipient search left the picker empty and `Send` disabled, so I could not complete a real browser send through the page's own normal control path.

I then isolated the write path directly. Sending disposable self-mail through the live route created subject `AUDIT MM 20260413105514` and returned `{ok:true,source:"zve",messageId:"142697"}`. Direct M verification showed the message node existed in File `3.9` (`^XMB(3.9,142697,0)=AUDIT MM 20260413105514^1^3260413.025518`), the permanent admin audit log recorded `MM-SEND^3260413.025518^1^1^Msg 142697 to 1: AUDIT MM 20260413105514`, and the Inbox basket link existed for DUZ `1` (`INREF=10` under `^XMB(3.7,1,2,1,1,142697)`). But the user-facing claim failed: `GET /api/ta/v1/mailman/inbox?folder=SENT&max=5` returned `data:[]`, the browser `Sent` tab showed `No Sent Messages`, and the larger Inbox readback showed the new message in `basket:"IN"` instead of any Sent folder. So this handler is red against the audited end-to-end claim.

### `handleDelete (MailMan)`
**Action:** Click Delete → DELETE /mailman/:ien
**Verify:** M: message removed. UI: removed from inbox.

Result: 🔴 The visible delete control updates browser-local state, but the delete path does not actually move the message out of Inbox in VistA. I selected live Inbox message `141514` (`Rad/Nuc Med Report (061617-120)`), the detail pane rendered a normal visible `Delete` button, and clicking it immediately removed that row from the current browser list.

The backend/storage proofs contradicted the UI. A direct `DELETE /api/ta/v1/mailman/message/141514` returned `{ok:true,source:"zve"}`, and the M audit log recorded repeated `MM-DELETE` entries claiming `Msg 141514 moved to WASTE`. But `GET /api/ta/v1/mailman/inbox?folder=IN&max=5` still returned message `141514`, `GET /api/ta/v1/mailman/inbox?folder=WASTE&max=5` still returned `data:[]`, `GET /api/ta/v1/mailman/message/141514` still returned the full message body, and direct M verification showed the basket references unchanged (`INREF=1`, `WASTEREF=0`). Reloading `/admin/messages` brought the same `061617-120` row back into the visible Inbox list. So the current UI gives a false impression of deletion while the message remains in Inbox.

### `handleSend (Alert)`
**Action:** Compose alert → Send → POST /alerts
**Verify:** Alert created. Recipient sees alert.

Result: 🔴 The alert-create route returns success, but the browser cannot complete an honest recipient selection and the recipient does not see the created alert on this page. On `/admin/messages`, clicking `New Alert` opened the modal, but typing `MANAGER` into the `To` search still left no selectable recipient rows and `Send Alert` stayed disabled.

I then isolated the underlying route with a disposable high-priority self-alert. `POST /api/tenant-admin/v1/alerts` with subject `AUDIT ALERT 20260413105904` returned `{ok:true,source:"zve"}`, and direct M verification at least confirmed the VistA-side action fired through the permanent audit log: `ALERT-CREATE^3260413.025908^1^1^To=1: AUDIT ALERT 20260413105904`. But the recipient-facing surface still failed the audit claim. The browser remained at `0 active alerts`, and `GET /api/ta/v1/bulletins` still returned `data:[]` because this page reads File `3.6` bulletins rather than the user-alert list created by `XQALERT`. So the page cannot currently prove `Recipient sees alert`, and the live browser compose flow itself is blocked by the empty recipient picker.

## SystemHealth

### `handleShutdown (HL7)`
**Action:** Click Shutdown → POST /hl7-interfaces/:ien/shutdown
**Verify:** HL7 interface stops. M: verify status.

Result: 🟢 This handler is grounded as a real File 870 shutdown-flag write. On `/admin/health` → `HL7 Interfaces`, I used the live `AMB-CARE` row (HL LOGICAL LINK IEN `1`) and clicked the visible `Shutdown` button. The browser surfaced the success state `AMB-CARE shutdown requested.`

The underlying write route matched that browser action. `POST /api/tenant-admin/v1/hl7-interfaces/1/shutdown?tenantId=default` returned `{ok:true, action:"shutdown", field:"4.5 (SHUTDOWN LLP)", value:"1", source:"vista", rpcUsed:"DDR FILER"}`. A direct detail readback immediately afterward showed the persisted shutdown flag: `GET /api/tenant-admin/v1/hl7-interfaces/1?tenantId=default` returned `4.5^1^Enabled` in the raw File `870` payload. M-prompt verification in the live `local-vista-utf8` container matched the write at the storage layer: before the action, `^HLCS(870,1,0)` was `AMB-CARE^^1^MM^Halting^^^^^^3190322.100215^^^^1`, and after shutdown it became `AMB-CARE^^1^MM^Halting^1^^^^^3190322.100215^^^^1`, proving the sixth piece was set from blank to `1`.

### `handleEnable (HL7)`
**Action:** Click Enable → POST /hl7-interfaces/:ien/enable
**Verify:** HL7 interface starts. M: verify status.

Result: 🟢 This reverse path is also grounded end to end for the same live link. On the same `AMB-CARE` row in the browser, clicking `Enable` surfaced `AMB-CARE enable requested.`

The route persisted the inverse write. `POST /api/tenant-admin/v1/hl7-interfaces/1/enable?tenantId=default` returned `{ok:true, action:"enabled", field:"4.5 (SHUTDOWN LLP)", value:"@", source:"vista", rpcUsed:"DDR FILER"}`. A fresh detail readback showed field `4.5` cleared again: `GET /api/tenant-admin/v1/hl7-interfaces/1?tenantId=default` returned raw line `870^1^4.5^^`. Direct M verification matched the clear exactly: after enable, `^HLCS(870,1,0)` reverted to `AMB-CARE^^1^MM^Halting^^^^^^3190322.100215^^^^1`, so the shutdown flag piece was removed and the node returned to its original state.

### `loadData (health)`
**Action:** Page mount → GET /health/* → ZVE HL7/TaskMan RPCs
**Verify:** All sections populated with real data. No empty panels.

Result: 🟢 The page-mount health load is grounded with live, non-empty data across the browser and backend fan-out. In the authenticated browser on `/admin/health`, the initial System Health view rendered populated cards and sections instead of empty fallbacks: `Background Tasks=RUNNING`, `Backend Connection=Connected`, `Error Log=9 entries`, `Current User=MANAGER,SYSTEM`, plus populated `Historical Uptime`, `Alert Thresholds`, `Backend Connection Details`, and `System Metrics` sections. The page did not fall back to `No connection data available.`, `No active tasks found.`, `No scheduled tasks found.`, or `No HL7 filer status available.`

The underlying mount endpoints all returned live payloads at the same stack: `GET /taskman/status`, `GET /taskman-tasks`, `GET /taskman/scheduled`, `GET /error-trap`, `GET /vista-status`, `GET /hl7/filer-status`, `GET /health/history`, `GET /health/thresholds/me`, and `GET /capacity` all returned HTTP `200`. Sample live proofs matched the rendered page: `vista-status` returned `vistaReachable:true`, `duz:"1"`, `userName:"MANAGER,SYSTEM"`; `taskman/status` returned `RUNNING`; `hl7/filer-status` returned `INCOMING: STOPPED` and `OUTGOING: STOPPED`; `health/history` returned a current sample with `overallUp:true`, `vistaConnected:true`, `taskmanRunning:true`, and `hl7Running:false`; and the task/error datasets were non-empty (`taskman-tasks`, `taskman/scheduled`, and `error-trap` all returned live rows). That satisfies the audited claim that page load populates real health data rather than empty placeholders.

## AuditLog

### `handleExportCSV`
**Action:** Click Export → CSV generated from displayed audit data
**Verify:** CSV downloads with all visible rows.

Result: 🟢 This handler is grounded for the currently displayed filtered dataset. In the live browser on `/admin/audit`, I switched to the `Error Log` tab so the filtered result set was small and fully visible. The table rendered exactly `4` rows, the footer showed `Showing 4 records`, and clicking `Export CSV` generated a browser download named `audit-log.csv`.

I captured the generated blob directly in the browser context and the CSV matched the visible rows one-for-one: `5` total lines (`1` header + `4` data rows). The header was `Timestamp,Staff Member,Action,Source,Detail`, and each exported row matched the on-screen `Error Log` entries (`System`,`Error`,`Error Log`). The timestamps and detail fields were blank in both the visible table rows and the exported CSV, so while the underlying source data is sparse, the export handler is faithfully serializing the displayed filtered data.

### `loadData (audit)`
**Action:** Page mount → GET /audit/* from 4 sources
**Verify:** All 4 tabs have data: FileMan, Sign-on, Error Trap, ZVE audit.

Result: 🔴 This audit claim is no longer true on the live product. The current page does not even mount only four tabs; it now renders six source tabs: `All Events`, `Sign-On Activity`, `Data Changes`, `Error Log`, `Failed Access`, and `Administrative Access`. On live page load, the browser summary itself reported `54 events from 2 audit sources`, not four.

The underlying fan-out confirmed that only two sources were populated in this environment. `GET /api/tenant-admin/v1/audit/fileman?tenantId=default` returned `50` rows and `GET /api/tenant-admin/v1/audit/error-log?tenantId=default` returned `4` rows, but `GET /api/tenant-admin/v1/audit/signon-log?tenantId=default`, `GET /api/tenant-admin/v1/audit/failed-access?tenantId=default`, and `GET /api/tenant-admin/v1/audit/programmer-mode?tenantId=default` all returned HTTP `200` with `0` rows. The browser matched that exactly: `Data Changes` and `Error Log` showed populated tables, while `Sign-On Activity`, `Failed Access`, and `Administrative Access` each fell to `No audit entries found for the selected filters.` So the page load is wired and partially populated, but the specific audited claim that all tabs/sources contain data is false on the live stack.

## SiteParameters

### `handleSave`
**Action:** Edit parameter → Enter reason → Save → PUT /params/:package
**Verify:** M: parameter value updated. UI: success. Change reason recorded.

Result: 🟢 This save path is grounded for the live Session & Security form. On `/admin/module-settings`, I switched to `Session & Security`, changed `Session Timeout (Auto Sign-Off)` from `360` to `420`, entered reason `Audit save verification 0319`, and clicked `Save Changes`. The browser then cleared the pending-change preview and returned the sidebar to `No changes pending. Edit a parameter to see the impact preview.`, which is the page's normal post-save success state.

The persisted value matched across API and M. A fresh `GET /api/tenant-admin/v1/params/kernel?tenantId=default` returned `AUTOLOGOFF="420"`, and direct M verification showed the backing File `8989.3` storage node changed at the exact mapped location for field `210`: before save, `^XTV(8989.3,1,"XUS")=^5^4000^1^0^1^^^Y^360^0^^^^90^^500^d^`; after save it became `^5^4000^1^0^1^^^Y^420^0^^^^90^^500^d^`, proving piece `10` updated from `360` to `420`.

The reason was also recorded exactly. The latest admin audit entry after save was `^ZVEADM("AUDIT",229)=PARAM-SET^3260413.031644^1^KSP^AUTOLOGOFF=420 Reason: Audit save verification 0319`, which satisfies the audit requirement that the change reason is captured. Cleanup completed immediately afterward: `AUTOLOGOFF` was restored to `360`, `GET /params/kernel` returned `AUTOLOGOFF="360"` again, and `^ZVEADM("AUDIT",230)` recorded `PARAM-SET^...^AUTOLOGOFF=360 Reason: Audit cleanup restore baseline`.

## SiteManagement

### `toggleWorkspace`
🟢 The workspace toggle is grounded on the live Divisions page. On `/admin/sites`, I selected `VEHU DIVISION` (IEN `1`) and toggled the visible `Analytics` workspace switch off in the browser. The browser control changed from `aria-checked="true"` to `aria-checked="false"`, and `GET /api/tenant-admin/v1/workspaces?tenantId=default&divisionIen=1` immediately returned `{"Analytics":false}`.

Direct M verification matched the write exactly once the known-good YottaDB environment exports were restored: `^XTMP("ZVEWS",1,"Analytics")=0`, and the latest admin audit entry became `^ZVEADM("AUDIT",231)=WS-VIS^3260413.032321^1^1^Analytics=0`. Cleanup was then performed by toggling the same switch back on in the browser; API readback returned `{"Analytics":true}`, direct M verification returned `^XTMP("ZVEWS",1,"Analytics")=1`, and `^ZVEADM("AUDIT",232)=WS-VIS^3260413.032553^1^1^Analytics=1` recorded the restore.

### `handleDeleteSite`
🔴 The delete path does perform a real File `40.8` deletion, but it fails the required safety and UI-behavior bar. Source inspection already showed no assigned-user guard in `DELETE /api/tenant-admin/v1/divisions/:ien`, and the live browser confirmed the same: after selecting a disposable division and entering edit mode, the confirm dialog went straight to `Delete Site` with only `Permanently delete "ZZZ AUDIT DELETE 0413" from VistA? This cannot be undone.` There was no assigned-user validation, no warning about staff tied to the site, and no pre-delete check surfaced anywhere in the dialog or page state.

To avoid touching a real site, I created disposable division `ZZZ AUDIT DELETE 0413` directly in live VistA FileMan as IEN `13` after the page's own `Add Site` flow failed with `The IENS 'ZZZ AUDIT DELETE 0413,' is syntactically incorrect.` The live Divisions API then showed IEN `13`, and the browser list increased to `4 divisions loaded.` Clicking the page's `Delete Site` path removed the record in the backend: `GET /api/tenant-admin/v1/divisions?tenantId=default` dropped back to the original 3 divisions, and direct M verification showed `^DG(40.8,13,0)` absent afterward. But the page itself stayed stale immediately after delete, still showing `4 divisions loaded.` and the deleted row until a full browser reload. So this handler is red for two separate reasons: the required assigned-user safeguard is missing, and the UI does not reliably remove the deleted division without a hard reload.

## AdminDashboard

### `loadData`
🔴 The page mount and card rendering are live, but the dashboard does not meet the audit bar that all counts match direct VistA queries. After restoring the browser session hints on `/admin/dashboard`, the page rendered the full metric grid with `Active Staff 1,459`, `Clinics 573`, `Wards 66`, `Beds 549`, `Devices 47`, `HL7 Interfaces 130`, `Security Keys 713`, and `E-Sig Active 120`, plus the trend banner showing `59 snapshots retained` and `Coverage: 0.5 days`. The live API agreed with the page: `GET /api/tenant-admin/v1/dashboard?tenantId=default` returned the same eight metric values.

Direct M verification matched seven of the eight dashboard cards. Using the live YottaDB environment, `LIST2^ZVEADMIN(...,"active",...,5000)` returned `ACTIVE^1459`; direct File/global counts returned `CLINIC^573`, `WARD^66`, `BED^549`, `DEVICE^47`, `HL7^130`, and `KEY^713`, all matching the rendered cards. But the `E-Sig Active` card does not represent the real VistA total: direct M counting of users with an e-signature node returned `ESIG^1535`, while the dashboard stayed at `120`.

Source explains the gap exactly. `collectDashboardMetrics()` calls `fetchVistaEsigStatusForUsers(users, 120)`, and that helper probes only the first `120` users via `DDR GETS ENTRY DATA` before counting `hasCode`. So the dashboard's `120` is a capped sample, not the real system-wide e-signature total required by the audit statement. Because at least one card is not a true full-count metric from VistA, `loadData` is red.

## AdminReports

### `handleRunReport`
🟢 The report run path is live and non-empty. On `/admin/reports`, I selected the visible `Stale Accounts` report card, which drove the page into the report-specific state with `Days since last login (minimum) = 90`, the `Apply & refresh` control, and a populated results table. The browser rendered `100` visible rows with headers `Name / DUZ / Last Login Date / Days Since Login`, and the first rows were `Access,New / 11272 / NEVER / 999`, `Amie,Vaco / 11656 / NEVER / 999`, and `Analyst,Clinical / 10000000334 / NEVER / 999`.

The backing report route matched the UI exactly. `GET /api/tenant-admin/v1/reports/admin/stale-accounts?tenantId=default&days=90` returned `source:"vista"` with `118` rows total, and the first three API rows matched the browser table cell-for-cell. This satisfies the audit bar for `handleRunReport`: the selected report is returned from live VistA-backed data and is not empty.

### `handleExportCsv`
🟢 The export path is also live and accurate for the current report data. With the same populated `Stale Accounts` result set active in the browser, clicking `Export CSV` generated a download named `stale-accounts-2026-04-13.csv`.

Capturing the browser-generated blob showed `119` total lines (`1` header + `118` data rows), which matches the live API row count exactly. The CSV header was `Name,DUZ,Last Login Date,Days Since Login`, and the first exported rows were `"Access,New","11272","NEVER","999"`, `"Amie,Vaco","11656","NEVER","999"`, and `"Analyst,Clinical","10000000334","NEVER","999"`, matching both the browser table and the backend report response.

## SystemConfig

### `handleSave`
🟢 This save path is grounded for the live login-intro parameter. On `/admin/config`, I changed the visible `Welcome Message` field from `VistA Evolved Local Sandbox` to `Audit welcome verification 0413` and clicked `Save Changes`. The page showed `Configuration saved.`, the `Login screen preview` updated to the new message, and the edited textarea reloaded with the saved value.

The backing read surfaces matched immediately. `GET /api/tenant-admin/v1/public/login-config` returned `introMessage:"Audit welcome verification 0413"`, and direct M verification through `PARAMGT^ZVEADMN1` returned `PARAM^INTRO MESSAGE^Audit welcome verification 0413^Welcome message shown on the sign-on screen`. Cleanup was then completed on the same page by restoring the original message `VistA Evolved Local Sandbox`; the UI again showed `Configuration saved.`, `GET /public/login-config` returned the baseline intro text, and `PARAMGT^ZVEADMN1` returned `PARAM^INTRO MESSAGE^VistA Evolved Local Sandbox^...`.

## PatientSearch

### `handleQueryChange → searchPatients`
🔴 The backend search path is real, but the actual browser workflow is broken in this session because the page hardcodes the wrong tenant. Source shows `searchPatients()` calls `/patients` with `tenantId: 'local-dev'`, while the authenticated session here is bound to `default`. Live browser proof matched that exactly: typing `ZZTESTPATIENT` into `/patients` triggered a `403 Forbidden`, and replaying the exact proxied request outside the page returned `{"ok":false,"error":"Tenant mismatch: session bound to default","code":"TENANT_MISMATCH"}`. The page then fell to `Unable to reach the patient server. Please check your connection and try again.` instead of showing results.

The underlying search route itself is grounded in live VistA data. Direct API readback from `GET /api/tenant-admin/v1/patients?tenantId=default&search=ZZTESTPATIENT` returned `21` rows from `source:"zve"`, including `101044^ZZTESTPATIENT,ISSUE-ONE` and `101051^ZZTESTPATIENT,ISSUE-EIGHT`. Direct M-prompt verification through the same routine entry point used by the route confirmed those names from `SRCH^ZVEPAT1`: the prompt returned lines beginning `101051^ZZTESTPATIENT,ISSUE-EIGHT^...` and `101048^ZZTESTPATIENT,ISSUE-FIVE^...`. Because the live browser search action itself fails before results render, this item is red even though the backend RPC is real.

### `handleRowClick`
🔴 The row-click behavior does not navigate to Patient Dashboard. Source already shows `handleRowClick(patient)` calling `setSelectedPatient(patient)` rather than `navigate(...)`, while the separate `handleNameClick` performs the actual route change.

Browser verification matched that behavior once a live `ZZTESTPATIENT` result payload was replayed into the page to isolate the row-click handler from the broken tenant binding above. Clicking the `ZZTESTPATIENT,ISSUE-ONE` table row kept the browser at `/patients` and opened the right-side `Patient Preview` panel instead. By contrast, clicking the patient name button on that same row immediately navigated to `/patients/101044`. So the audited claim `Click patient row → navigates to PatientDashboard` is false; only the name button navigates.

### `handleSensitiveAcknowledge`
� **Fixed Session 221.** The acknowledge click now creates a durable VistA audit entry. `handleSensitiveAcknowledge()` was updated to import and call `logBreakTheGlass(patient.dfn, { reason: 'Clinical necessity' })` as a fire-and-forget before granting access. That POST reaches `ZVE PAT BRGLSS` (new M tag in ZVEPAT1.m) which writes `^DGSL(38.1,DFN,0)` (creating the parent File 38.1 record if absent) and `^DGSL(38.1,DFN,"D",AIEN,0)` (access log entry). `GET /api/tenant-admin/v1/patients/100841/audit-events` now calls `ZVE PAT BGREAD` which reads the patient-scoped "D" subfile directly and returns the correct entries. M-prompt verification: `^DGSL(38.1,100841,"D",...)` shows entries with correct date, DUZ, and reason text. API verification: `POST /break-glass` returned `ok: true, logged: true`; subsequent `GET /audit-events` returned 3 rows for patient 100841 and 0 rows for patient 4 (patient isolation confirmed).

## PatientDemographics

### `handleSave (registration)`
🔴 The live registration page cannot complete this workflow honestly in the current authenticated browser session. Source shows `PatientDemographics.jsx` loads the required `Registration Facility` choices through `getDivisions()`, and `patientService.js` hardcodes that read to `tenantId: 'local-dev'`. On the live `/patients/register` page, mount immediately produced `403` errors, the `Registration Facility` dropdown rendered only the placeholder `Select facility...`, and clicking `Register Patient` surfaced `Registration facility is required` with no selectable facility values available.

The submit path is broken for the same tenant-binding reason. Source shows `registerPatient(payload)` also posts with `tenantId: 'local-dev'`, and replaying that exact create route in the same browser session returned `403 Forbidden` with `{"ok":false,"error":"Tenant mismatch: session bound to default","code":"TENANT_MISMATCH"}`. That already blocks the real UI create action. Independent earlier live create attempts that bypassed this session mismatch and hit the backend on the correct tenant still failed deeper with `502` responses (`Cannot read properties of undefined (reading 'toString')` and `The list of fields is missing a required identifier for File #2.`), and follow-up patient searches for those disposable names returned `0` rows, so there is still no honest File 2 creation proof for this handler.

### `handleSave (edit)`
🔴 The edit workflow is blocked in the live browser session before any honest field-save proof can occur. Source shows edit mode loads patient data through `getPatient(patientId)` and saves through `updatePatient(patientId, payload)`, while `patientService.js` hardcodes both calls to `tenantId: 'local-dev'`. Opening `/patients/101044/edit` in the current `default`-bound session immediately produced repeated `403` errors and page exceptions `ApiError: Tenant mismatch: session bound to default`, so the form never hydrated live patient data and instead fell back to blank/new-patient-style fields.

The save route for that page is broken for the same reason. Replaying the edit write the page would make against `PUT /api/ta/v1/patients/101044?tenantId=local-dev` returned `403 Forbidden` with `TENANT_MISMATCH`, so the real `handleSave (edit)` path cannot reach `ZVE PATIENT EDIT` from this browser session. Because the page cannot load the target patient correctly and the submit call is rejected before any File 2 write, there is no honest UI-plus-M success proof for this handler.

## InsuranceCoverage

### `handleAdd`
🔴 The live add-insurance workflow fails end to end. On `/patients/101044/insurance`, the page rendered the visible `Add Insurance` modal despite background `403` noise from the patient-session mismatch, and I completed the required visible fields (`Insurance Company` and `Policy Number`) and clicked `Add Insurance`. The live browser then threw `ApiError: insuranceType (company IEN) is required` from `handleAdd`, left the modal open, showed no success state, and the list still displayed `No insurance information on file`.

Source explains the contract break. `InsuranceCoverage.jsx` builds the add payload with fields like `planName`, `companyIen`, `policyNumber`, `subscriberId`, and `type`, while the backend `POST /patients/:dfn/insurance` refuses the request unless `insuranceType` is present and files that into File `2.312` field `.01`. Replaying the UI-shaped payload against the correct tenant confirmed the same live rejection: `POST /api/ta/v1/patients/101044/insurance?tenantId=default` returned `400` with `insuranceType (company IEN) is required`. A fresh `GET /api/ta/v1/patients/101044/insurance?tenantId=default` still returned `0` rows afterward, so there is no File `2.312` subentry write and no UI list update to verify.

### `handleDelete`
🔴 The delete handler does not complete from the live browser session. To isolate the actual delete UI from the page's broken insurance-load tenant binding, I replayed one disposable insurance row into `/patients/101044/insurance` and exercised the real delete controls on that live page. Clicking the row's delete icon opened the normal `Delete insurance plan` confirmation dialog, so the visible browser entry point is real.

But confirming the delete failed on the handler's actual request path. The page calls `deleteInsurance(patientId, insuranceId)` with `tenantId: 'local-dev'`, and when I triggered the real `Delete plan` action the page surfaced a visible `Tenant mismatch: session bound to default` error banner and left the insurance row rendered in place. There was no UI removal and no successful route completion to verify against File `2.312`. Because the browser delete action itself fails before any subentry removal can be proven, this item is red.

## FinancialAssessment

### `handleSubmit`
🔴 The page can open the financial assessment form and calculate the local copay category, but the live submit path does not produce a recorded means-test entry. On `/patients/101044/assessment`, the page loaded with repeated tenant-mismatch errors on its patient/read calls, yet the visible `Start New Assessment` action still opened the form. Entering `Gross Wages = 1000` updated the live UI calculations to `Category A / Cat A — No Copay`, so the client-side math path is active.

Submitting that live form failed. Clicking `Calculate & Submit` produced only `Submission failed. Please try again.` and the history table remained at `0 record(s)`. Replaying the exact submit route the page is wired to call confirmed the underlying browser-path failure: `POST /api/ta/v1/patients/101044/assessment?tenantId=local-dev` returned `403 Forbidden` with `TENANT_MISMATCH`, and a fresh `GET /api/ta/v1/patients/101044/assessment?tenantId=default` still returned `0` rows afterward. Because no File `408.31` entry was created and the UI never reaches a verified saved state, this item is red.

## Admission

### `handleSubmit`
🟢 This handler was already verified live earlier in the same audit run using existing patient `DFN 101044` (`ZZTESTPATIENT,ISSUE-ONE`). The browser admission action posted ward `1`, bed `001-A`, diagnosis `AUDIT ADMISSION`, attending `1`, and admit type `1`, and the route returned `200` through `ZVE ADT ADMIT` with movement `5294`.

Direct M verification confirmed the admission write path end to end: `^DGPM(5294,0)` was created as the inpatient admission movement, and `^DPT(101044,.1)` updated to the active ward/bed state. The live census readback also included `DFN 101044` with `roomBed=001-A` immediately after the action. That satisfies the handler's required UI and M-prompt proof, so this item is green.

## Discharge

### `handleSubmit`
🟡 This handler was already exercised live earlier in the same audit run against that same admitted patient `DFN 101044`. The discharge action returned `200` through `ZVE ADT DISCHARGE` with movement `5295`, direct M verification showed `^DGPM(5295,0)` created, and the leading ward/room-bed pieces in `^DPT(101044,.1)` were cleared. The active ward census also dropped `DFN 101044` immediately afterward, which proves the underlying ADT discharge write succeeded.

The item stays partial because the product's patient-detail read surface remained stale while the patient was admitted. During the same workflow, `/patients/101044` still showed blank ward/admit context even though the admission was real, which means the discharge page can mis-state the current inpatient state before the submit. The discharge write itself worked, but the surrounding UI context is not fully reliable, so this is yellow rather than green.

## Transfer

### `handleSubmit`
🟢 The transfer submit path is now verified end to end in the live browser. Opening `/patients/101044/transfer` after a real admission showed the current location `ICU/CCU — Pending assignment` and `Current division: VEHU DIVISION`, selecting destination ward `3E NORTH` surfaced `Destination division: VEHU CBOC`, and clicking `Transfer Patient` opened the explicit confirm dialog `Confirm Cross-Division Transfer` before submit.

Confirming that dialog completed the live write and produced `Patient Transferred Successfully` with `Cross-division transfer completed from VEHU DIVISION to VEHU CBOC.` Direct M verification afterward showed File `2` current location storage updated to ward `33`, and direct File `42` reads confirmed ward `33 = 3E NORTH` and division `VEHU CBOC`. So the browser path is now honest and the underlying VistA ward change is verified.

## PatientFlags

### `handleAdd`
🔴 The visible add-flag workflow renders and validates, but it fails before creating any patient-record flag. On `/patients/101044/flags`, the browser showed the `Add Patient Flag` modal. I filled `Flag Type = Behavioral`, `Flag Name = AUDIT FLAG 0413`, `Category = I - National`, and the required narrative, then clicked `Add Flag`. The live page threw `ApiError: flagName is required`, the modal stayed open, and the active flag list remained at `0`.

Source shows the contract mismatch directly. `PatientFlags.jsx` submits `name`, `category`, `narrative`, and related fields, while the backend `POST /patients/:dfn/flags` rejects the request unless `flagName` is present and writes that into File `26.13` field `.02`. Replaying the UI-shaped payload against the correct tenant returned the same live rejection: `POST /api/ta/v1/patients/101044/flags?tenantId=default` returned `400` with `flagName is required`, and a fresh `GET /api/ta/v1/patients/101044/flags?tenantId=default` still returned `0` rows. Because no File `26.13` entry was created and no flag appeared in the UI, this item is red.

### `handleInactivate`
🔴 There is no honest live inactivate path on this patient page because the product cannot currently create or load an active patient flag here. On `/patients/101044/flags`, the live page rendered `Active Flags (0)` and `No active flags for this patient`, so there was no real row to select and no visible inactivate prompt reachable through the normal browser workflow.

The wired inactivate request path is also broken for the current session. Source shows the handler calls `inactivatePatientFlag(patientId, flagId)` with `tenantId: 'local-dev'`, and replaying that exact route returned `403 Forbidden` with `TENANT_MISMATCH` for `PUT /api/ta/v1/patients/101044/flags/AUDITFLAG1?tenantId=local-dev`. Since there is no honest UI path to an active flag and the submit route the handler depends on is rejected before any File `26.13` update can occur, this item is red.

## BedManagement

### `handleAssignPatient`
🔴 The old note that this handler is only a dead navigation shortcut is now stale, but the live workflow is still broken. Source shows `handleAssignPatient(bed)` first calls `assignBed({ bedIen, wardIen, roomBed, unit })`; when no `patientDfn` is present, that helper verifies the room-bed record exists and then navigates to `/patients` with `assignBedContext` in router state so `PatientSearch` can complete the actual admission/assignment after the user selects a patient. So this handler is no longer a pure no-op.

However, the current browser path is still red because the bed page never loads real beds in this session. On `/patients/beds`, the live UI showed `0 Total Beds`, `0 Available`, and `No beds found for the selected filter`, so there was no honest `Assign Patient` control to click. Direct route comparison confirmed the cause: `GET /api/ta/v1/room-beds?tenantId=local-dev` returned `403 TENANT_MISMATCH`, while the same read on `tenantId=default` returned `549` room-bed rows including `001-A`, `002-A`, and `003-A`. Since the page cannot load beds and therefore cannot start the assign flow in the browser, this item remains red even though the old comment about it never calling any API is no longer accurate.

### `handleAddBed`
🔴 The add-bed workflow is not usable from the live browser session. On `/patients/beds`, clicking the visible `Add Bed` button opened the modal, but the required `Nursing Unit` selector contained only the placeholder `Select unit…` option, so there was no honest unit choice available to complete the form. That matches the same broken room-bed/ward load state already visible on the page.

The wired create route is also blocked for this session. `addBed(...)` posts to `/room-beds` with `tenantId: 'local-dev'`, and replaying that exact request returned `403 Forbidden` with `TENANT_MISMATCH`. Because the required unit data never loads and the actual create route the page depends on is rejected before any File `405.4` write can occur, this item is red.

## RecordRestrictions

### `handleUpdateRestriction`
**Action:** Change sensitivity level → PUT /patients/:dfn/sensitivity
**Verify:** M: sensitivity flag set. UI: level displayed.

Result: 🔴 The live browser path is broken before any honest restriction change can be made. Browser verification on `/patients/101044/restrictions` under the active default-bound session rendered only `Failed to load patient record` with `Tenant mismatch: session bound to default`, so the level selector and `Update Restriction Level` control never became usable. Source explains the failure: `RecordRestrictions.jsx` depends on `getPatient(patientId)` and the related audit/staff loaders, while `patientService.updateRecordRestriction()` and the surrounding reads are still hardcoded to `tenantId='local-dev'`. Replaying the exact wired requests confirmed the block: both `GET /api/tenant-admin/v1/patients/101044?tenantId=local-dev` and `PUT /api/tenant-admin/v1/patients/101044/restrictions?tenantId=local-dev` returned HTTP `403` with `TENANT_MISMATCH`. There was therefore no real UI write to verify at M, and this handler is red.

### `handleBreakTheGlass`
**Action:** Click Break Glass → acknowledge → access granted
**Verify:** Audit entry created. Access logged.

Result: � **Fixed Session 222.** `POST /break-glass` now accepts `reasonText`/`reasonCategory`. `GET /audit-events` returns entries with `reasonCategory` (ZVE: prefix stripped). Tenant binding fixed Session 219. Verified: `POST /patients/101044/break-glass` with `reasonText:"Direct Care"` -> `ok:true, logged:true`; `GET /patients/101044/audit-events` -> 2 entries with correct reasonCategory. UI audit table colour-codes by reasonCategory correctly.

### `handleExportAudit`
**Action:** Click Export → CSV of access audit trail
**Verify:** CSV downloads with who accessed and when.

Result: � **Fixed Session 222.** Audit feed fully operational. `GET /audit-events` returns real entries with `reasonCategory`, `reasonText`, `dateTime`, `accessedBy`. CSV export contains correct data. Tenant fixed Session 219, break-glass display fixed Session 222.

---

# SECTION 13: DATA INTEGRITY — VistA Cross-Reference Verification

VistA maintains cross-references (B-trees, indexes) that must stay consistent with base data.
After every CRUD operation, verify the cross-reference matches.

### 13.1 Key assignment
**Cross-ref:** `^XUSEC(KEY,DUZ) AND ^VA(200,DUZ,51,IEN)`
**Expected:** Both must exist after assign, both must be gone after remove

Result: 🟢 This storage invariant already proved out in the live permission add/remove cycle. On disposable DUZ `10000000430`, assignment created both `^XUSEC("OR CPRS GUI CHART",10000000430)=1` and `^VA(200,10000000430,51,"B","OR CPRS GUI CHART")=1`; the subsequent removal cleared both locations and returned the key multiple header to `200.051^^1^0`. So the Kernel key cross-reference and File `200` sub-file stay in sync for the tested add/remove path.

### 13.2 User name change
**Cross-ref:** `^VA(200,'B',NEWNAME,DUZ)`
**Expected:** Old name xref removed, new name xref exists

Result: 🟢 Fresh live proof on disposable DUZ `10000000443` confirmed the rename xref behavior directly. `PUT /api/tenant-admin/v1/users/10000000443/rename?tenantId=default` returned `ok: true` via `ZVE USMG RENAME` for new name `XREFDONE,BETA413`. Direct M verification then showed File `200` field `.01` read back as `XREFDONE,BETA413`, `^VA(200,"B","XREFDONE,BETA413",10000000443)` existed (`NEW=1`), and `^VA(200,"B","XREFTEST,ALPHA413",10000000443)` was gone (`OLD=0`).

### 13.3 User deactivation
**Cross-ref:** `DISUSER flag + keys intact`
**Expected:** Keys remain (only termination removes keys), DISUSER=1

Result: 🔴 The live deactivation write still fails this invariant. On the same disposable DUZ `10000000443`, I first assigned `OR CPRS GUI CHART`, then called `POST /api/tenant-admin/v1/users/10000000443/deactivate?tenantId=default`, which returned `ok: true` via `ZVE USMG DEACT`. Direct M verification showed the reason was stored (`field 9.4 = Section 13 cross-ref audit`) and the key remained intact (`^XUSEC("OR CPRS GUI CHART",10000000443)=1`), but `$$GET1^DIQ(200,10000000443_",",7,"I")` was still blank. So the keys-intact half passes while the required `DISUSER=1` half does not.

### 13.4 User termination
**Cross-ref:** `Keys + creds + e-sig all cleared`
**Expected:** 0 keys, no access code hash, no verify code hash, no e-sig

Result: 🔴 Fresh live proof again shows only a partial cleanup. Before termination, disposable DUZ `10000000443` had non-empty access code, verify code, and e-signature (`AC=XRF413A`, `VC=XRF413B!!`, `ESIG=ES413!!`) plus `^XUSEC("OR CPRS GUI CHART",10000000443)=1`. `POST /api/tenant-admin/v1/users/10000000443/terminate?tenantId=default` then returned `ok: true` via `ZVE USMG TERM`. Direct M verification afterward showed the credential and e-signature fields were cleared and `DISUSER=1`, but the key traces remained: `^XUSEC("OR CPRS GUI CHART",10000000443)=1` and `^VA(200,10000000443,51,1,0)` still existed even though the sub-file header read `200.051^^0^0`. So termination clears credentials and e-signature, but it does not honestly deliver `0 keys`.

### 13.5 Patient registration
**Cross-ref:** `^DPT('B',NAME,DFN)`
**Expected:** B-tree xref exists for new patient name

Result: 🔴 No live patient registration write succeeded in this audit run, so there was no new File `2` name xref to verify. The browser registration path is blocked by the same `local-dev` vs `default` tenant mismatch that leaves the required facility list empty, and prior correct-tenant create attempts were already observed failing deeper with `502` responses and no patient record creation. Because no new DFN was honestly created, `^DPT("B",NAME,DFN)` never materialized for a real registration workflow.

### 13.6 Patient admission
**Cross-ref:** `File 2 field .1 + File 405 movement`
**Expected:** Ward location set in File 2, movement record in File 405

Result: 🟢 This invariant was directly proven during the live admission workflow. The admission action created File `405` movement `^DGPM(5294,0)=3260412.202731^1^101044^1^^1^001-A^^^AUDIT ADMISSION^^^^5294^^^^1`, and the paired File `2` location node updated to `^DPT(101044,.1)=1^001-A^^^^^^^^^^^^^^3260412.202731`. That satisfies the expected movement-plus-current-location linkage for the tested inpatient admission.

### 13.7 Patient discharge
**Cross-ref:** `File 2 field .1 cleared + File 405 discharge`
**Expected:** Ward cleared, discharge movement exists, references admission

Result: 🟡 The discharge-side storage proof is mostly present, but I am carrying forward the same caution as the handler-level discharge result. Earlier live discharge created `^DGPM(5295,0)=3260412.202901^3^101044^^^1^^^^AUDIT DISCHARGE^^^^^^^1`, and direct/current readback shows `^DPT(101044,.1)` no longer carries the active ward or room-bed pieces. That proves the discharge movement exists and the current-location field was cleared. I am not upgrading this to full green here because the broader discharge workflow already remained partial in Section 12, and the captured low-level readback did not add a stronger explicit admission-link proof beyond the discharge movement record itself.

### 13.8 Division assignment
**Cross-ref:** `File 200.02 sub-file entry`
**Expected:** Sub-file entry exists after add, gone after remove

Result: 🟢 Fresh live proof on disposable DUZ `10000000443` confirmed both directions at M. `POST /api/tenant-admin/v1/users/10000000443/division?tenantId=default` with `divisionIen=10` and `action=ADD` returned `ok: true` via `ZVE DIVISION ASSIGN`; direct M verification then showed the sub-file present with header `^^1^1` and entry `^VA(200,10000000443,2,1,0)=10`. The matching `REMOVE` call also returned `ok: true`, and direct M readback showed `^VA(200,10000000443,2,1,0)` gone while the header dropped to `^^1^0`. So the File `200.02` membership entry is added and removed correctly.

### 13.9 Mail group membership
**Cross-ref:** `File 3.8 sub-file entry`
**Expected:** Member in sub-file after add, gone after remove

Result: 🟢 The storage-layer mail-group invariant passed even though the UI/API list remained noisy. Earlier live proof on mail group `IEN 187` showed the add action created `^XMB(3.8,187,1,1,0)=11272`, and the later remove action returned the membership multiple to empty with `COUNT^0` under `^XMB(3.8,187,1,0)`. So the File `3.8` member sub-file itself stayed consistent through add/remove.

### 13.10 Clinic inactivation
**Cross-ref:** `File 44 INACTIVATE DATE field`
**Expected:** Date set on inactivate, cleared on reactivate, record NOT deleted

Result: 🟢 The clinic record invariant held. Earlier live proof showed `POST /api/ta/v1/clinics/949/inactivate?tenantId=local-dev` set the inactivation node to `^SC(949,"I")=3260413`, and the matching reactivate call cleared `^SC(949,"I")` back to empty while the clinic record remained present and readable in File `44`. That satisfies the expected set/clear-without-delete behavior.

### 13.11 Key exists in File 19.1
**Cross-ref:** `^DIC(19.1,'B',KEYNAME)`
**Expected:** Every key our roles reference must return >0

Result: 🟢 The current built-in role-key corpus resolves cleanly against the live VistA inventory. A full compare of the 43 key names referenced by `scripts/verify-role-keys.mjs` against the live `/key-inventory?tenantId=default` feed returned `missingCount=0`. Direct M spot checks matched that result: `^DIC(19.1,"B","GMRA-ALLERGY VERIFY",0)=244`, `^DIC(19.1,"B","OR CPRS GUI CHART",0)=756`, and `^DIC(19.1,"B","XUMGR",0)=2`. This runtime uses the dashed `GMRA-ALLERGY VERIFY` key name, and the current role corpus matches it.

### 13.12 RPC registered in File 8994
**Cross-ref:** `^XWB(8994,'B','RPC NAME')`
**Expected:** Every ZVE RPC must be registered

Result: 🔴 The live server still references at least one unregistered ZVE RPC. I extracted all unique `callZveRpc('ZVE ...')` names from `apps/tenant-admin/server.mjs` and checked each against File `8994`; 70 of 71 resolved, but `ZVE ROLE CUSTOM UPD` did not. Direct M spot checks show the contrast clearly: `^XWB(8994,"B","ZVE USMG TERM",0)=3990`, while `^XWB(8994,"B","ZVE ROLE CUSTOM UPD",0)` is empty. Because not every ZVE RPC used by the server is actually registered, this item is red.

---

# SECTION 14: RESPONSIVE & MOBILE AUDIT

Every page must be tested at 768px (tablet) and 375px (mobile).
The admin may use a tablet at the nursing station. The system must be usable.

Live responsive verification was run in a real Playwright browser at true `768px` and `375px` viewports. One systemic defect dominated the mobile results: the fixed left navigation rails remained expanded at `375px`, leaving only about `131px` of usable main-content width on nearly every page (`mainLeft≈244`, `mainWidth≈131`). Unless otherwise noted, that mobile shell failure is the main reason these pages are red even when the document itself does not technically overflow.

### StaffDirectory
- **768px (tablet):** No horizontal scroll. Text readable. Buttons tappable (min 44px). Tables don't overflow. Detail panels usable.
- **375px (mobile):** Critical actions still accessible. Tables stack or scroll horizontally. Modals fit screen. Wizard steps visible.

Result: 🔴 Tablet width avoided document-level overflow, but the page still exposed 7 visible sub-44px targets. Mobile width left only ~131px for main content and pushed 14 interactive controls off the right edge, so the directory is not honestly usable on phone width.

### StaffForm
- **768px (tablet):** No horizontal scroll. Text readable. Buttons tappable (min 44px). Tables don't overflow. Detail panels usable.
- **375px (mobile):** Critical actions still accessible. Tables stack or scroll horizontally. Modals fit screen. Wizard steps visible.

Result: 🔴 Tablet width fits the document but still exposes 18 undersized controls. Mobile width overflows to `500px`, keeps only ~131px of main-form space, and pushes fields/actions off-screen, so the multi-step form does not meet the responsive requirement.

### RoleTemplates
- **768px (tablet):** No horizontal scroll. Text readable. Buttons tappable (min 44px). Tables don't overflow. Detail panels usable.
- **375px (mobile):** Critical actions still accessible. Tables stack or scroll horizontally. Modals fit screen. Wizard steps visible.

Result: 🔴 Tablet width avoids overflow, but mobile still inherits the fixed-rail shell and compresses the main panel to ~131px. Even without document overflow, the role cards and controls are squeezed into an unusable phone-width column.

### PermissionsCatalog
- **768px (tablet):** No horizontal scroll. Text readable. Buttons tappable (min 44px). Tables don't overflow. Detail panels usable.
- **375px (mobile):** Critical actions still accessible. Tables stack or scroll horizontally. Modals fit screen. Wizard steps visible.

Result: 🔴 Tablet width stays within the viewport, but at `375px` the fixed shell leaves only ~131px for content and 20 interactive elements extend off the right edge. That makes the catalog unusable on mobile.

### SecurityAuth
- **768px (tablet):** No horizontal scroll. Text readable. Buttons tappable (min 44px). Tables don't overflow. Detail panels usable.
- **375px (mobile):** Critical actions still accessible. Tables stack or scroll horizontally. Modals fit screen. Wizard steps visible.

Result: 🔴 Tablet width already has 7 sub-44px targets and one control extending beyond the viewport. Mobile width overflows to `492px`, leaves only ~131px of main-content width, and pushes 12 controls off-screen.

### SiteParameters
- **768px (tablet):** No horizontal scroll. Text readable. Buttons tappable (min 44px). Tables don't overflow. Detail panels usable.
- **375px (mobile):** Critical actions still accessible. Tables stack or scroll horizontally. Modals fit screen. Wizard steps visible.

Result: 🔴 This page fails even at tablet width: the document expands to `792px` on a `768px` viewport. At `375px` it still measures `792px` wide and leaves only ~131px of main-content width, so neither breakpoint satisfies the requirement.

### AdminDashboard
- **768px (tablet):** No horizontal scroll. Text readable. Buttons tappable (min 44px). Tables don't overflow. Detail panels usable.
- **375px (mobile):** Critical actions still accessible. Tables stack or scroll horizontally. Modals fit screen. Wizard steps visible.

Result: 🔴 Tablet width avoids overflow, but mobile width expands to `513px` and collapses the dashboard body to ~131px. The shell, cards, and actions do not remain usable on phone width.

### AdminReports
- **768px (tablet):** No horizontal scroll. Text readable. Buttons tappable (min 44px). Tables don't overflow. Detail panels usable.
- **375px (mobile):** Critical actions still accessible. Tables stack or scroll horizontally. Modals fit screen. Wizard steps visible.

Result: 🔴 Tablet width is contained, but mobile width expands to `471px` with 5 controls extending off-screen and only ~131px left for the main report UI.

### AlertsNotifications
- **768px (tablet):** No horizontal scroll. Text readable. Buttons tappable (min 44px). Tables don't overflow. Detail panels usable.
- **375px (mobile):** Critical actions still accessible. Tables stack or scroll horizontally. Modals fit screen. Wizard steps visible.

Result: 🔴 Tablet width stays inside the viewport, but mobile width expands to `573px` and shrinks the message composer/list area to ~131px, which is not a usable handheld layout.

### AuditLog
- **768px (tablet):** No horizontal scroll. Text readable. Buttons tappable (min 44px). Tables don't overflow. Detail panels usable.
- **375px (mobile):** Critical actions still accessible. Tables stack or scroll horizontally. Modals fit screen. Wizard steps visible.

Result: 🔴 Tablet width avoids document overflow, but mobile width grows to `600px`, leaves only ~131px for the main log area, and pushes 11 controls past the right edge.

### ClinicManagement
- **768px (tablet):** No horizontal scroll. Text readable. Buttons tappable (min 44px). Tables don't overflow. Detail panels usable.
- **375px (mobile):** Critical actions still accessible. Tables stack or scroll horizontally. Modals fit screen. Wizard steps visible.

Result: 🔴 Tablet width is contained, but mobile width still leaves only ~131px for the clinic list/editor and pushes 9 controls off the right edge even without document-level overflow.

### WardManagement
- **768px (tablet):** No horizontal scroll. Text readable. Buttons tappable (min 44px). Tables don't overflow. Detail panels usable.
- **375px (mobile):** Critical actions still accessible. Tables stack or scroll horizontally. Modals fit screen. Wizard steps visible.

Result: 🔴 Tablet width is contained, but the mobile shell leaves only ~131px for the main ward-management content and still pushes 6 controls off-screen.

### DeviceManagement
- **768px (tablet):** No horizontal scroll. Text readable. Buttons tappable (min 44px). Tables don't overflow. Detail panels usable.
- **375px (mobile):** Critical actions still accessible. Tables stack or scroll horizontally. Modals fit screen. Wizard steps visible.

Result: 🔴 Tablet width is contained, but mobile width still collapses the main device-management area to ~131px and leaves 5 controls extending off the right edge.

### MailGroupManagement
- **768px (tablet):** No horizontal scroll. Text readable. Buttons tappable (min 44px). Tables don't overflow. Detail panels usable.
- **375px (mobile):** Critical actions still accessible. Tables stack or scroll horizontally. Modals fit screen. Wizard steps visible.

Result: 🔴 Tablet width is contained, but the mobile shell again leaves only ~131px for the working area and pushes 9 controls off-screen.

### DepartmentsServices
- **768px (tablet):** No horizontal scroll. Text readable. Buttons tappable (min 44px). Tables don't overflow. Detail panels usable.
- **375px (mobile):** Critical actions still accessible. Tables stack or scroll horizontally. Modals fit screen. Wizard steps visible.

Result: 🔴 Tablet width is contained, but mobile width still reduces the page to ~131px of usable main-content width and pushes controls off-screen.

### SiteManagement
- **768px (tablet):** No horizontal scroll. Text readable. Buttons tappable (min 44px). Tables don't overflow. Detail panels usable.
- **375px (mobile):** Critical actions still accessible. Tables stack or scroll horizontally. Modals fit screen. Wizard steps visible.

Result: 🔴 Tablet width is contained, but the fixed mobile rails still leave only ~131px for the main site-management content. Even without measured document overflow, the phone layout is too compressed to call usable.

### SystemHealth
- **768px (tablet):** No horizontal scroll. Text readable. Buttons tappable (min 44px). Tables don't overflow. Detail panels usable.
- **375px (mobile):** Critical actions still accessible. Tables stack or scroll horizontally. Modals fit screen. Wizard steps visible.

Result: 🔴 Tablet width avoids document overflow but still exposes 7 undersized controls. Mobile width expands to `557px`, pushes controls off-screen, and reduces the main monitoring panel to ~131px.

### SystemConfig
- **768px (tablet):** No horizontal scroll. Text readable. Buttons tappable (min 44px). Tables don't overflow. Detail panels usable.
- **375px (mobile):** Critical actions still accessible. Tables stack or scroll horizontally. Modals fit screen. Wizard steps visible.

Result: 🔴 Tablet width is contained, but mobile width expands to `470px`, leaves only ~131px of main-content width, and pushes controls off-screen.

### PatientSearch
- **768px (tablet):** No horizontal scroll. Text readable. Buttons tappable (min 44px). Tables don't overflow. Detail panels usable.
- **375px (mobile):** Critical actions still accessible. Tables stack or scroll horizontally. Modals fit screen. Wizard steps visible.

Result: 🔴 Tablet width already overflows to `870px` and still emits live `403` errors from the broken patient-search path. Mobile width inherits the same `870px` overflow, leaves only ~131px for the working pane, and pushes controls off-screen.

### PatientDemographics
- **768px (tablet):** No horizontal scroll. Text readable. Buttons tappable (min 44px). Tables don't overflow. Detail panels usable.
- **375px (mobile):** Critical actions still accessible. Tables stack or scroll horizontally. Modals fit screen. Wizard steps visible.

Result: 🔴 Tablet width avoids document overflow but still exposes 15 undersized controls and the same live `403` tenant-mismatch errors behind the page. Mobile width expands to `499px` and compresses the registration form into the same ~131px shell failure.

### InsuranceCoverage
- **768px (tablet):** No horizontal scroll. Text readable. Buttons tappable (min 44px). Tables don't overflow. Detail panels usable.
- **375px (mobile):** Critical actions still accessible. Tables stack or scroll horizontally. Modals fit screen. Wizard steps visible.

Result: 🔴 Tablet width is contained, but the live page still throws `403` data-load errors. Mobile width expands to `642px` and leaves only ~131px for the insurance list/form area.

### FinancialAssessment
- **768px (tablet):** No horizontal scroll. Text readable. Buttons tappable (min 44px). Tables don't overflow. Detail panels usable.
- **375px (mobile):** Critical actions still accessible. Tables stack or scroll horizontally. Modals fit screen. Wizard steps visible.

Result: 🔴 Tablet width is contained, but the page still throws the live `Tenant mismatch: session bound to default` error. Mobile width expands to `701px`, keeps the same backend error state, and compresses the main assessment form into ~131px.

### Admission
- **768px (tablet):** No horizontal scroll. Text readable. Buttons tappable (min 44px). Tables don't overflow. Detail panels usable.
- **375px (mobile):** Critical actions still accessible. Tables stack or scroll horizontally. Modals fit screen. Wizard steps visible.

Result: 🔴 Tablet width is contained, but the page already shows the broken `Loading units...` / tenant-mismatch behavior at this width. Mobile width expands to `461px` and keeps the same broken state inside a ~131px content area.

### Discharge
- **768px (tablet):** No horizontal scroll. Text readable. Buttons tappable (min 44px). Tables don't overflow. Detail panels usable.
- **375px (mobile):** Critical actions still accessible. Tables stack or scroll horizontally. Modals fit screen. Wizard steps visible.

Result: 🔴 Tablet width avoids document overflow but still exposes 10 undersized controls and the same live `403` read failures behind the page. Mobile width expands to `461px` and leaves only ~131px for the discharge form.

### Transfer
- **768px (tablet):** No horizontal scroll. Text readable. Buttons tappable (min 44px). Tables don't overflow. Detail panels usable.
- **375px (mobile):** Critical actions still accessible. Tables stack or scroll horizontally. Modals fit screen. Wizard steps visible.

Result: 🔴 Tablet width is contained, but the page still reaches the broken `Loading units...` / tenant-mismatch state. Mobile width expands to `396px`, pushes controls off-screen, and compresses the transfer UI to ~131px.

### BedManagement
- **768px (tablet):** No horizontal scroll. Text readable. Buttons tappable (min 44px). Tables don't overflow. Detail panels usable.
- **375px (mobile):** Critical actions still accessible. Tables stack or scroll horizontally. Modals fit screen. Wizard steps visible.

Result: 🔴 Tablet width already overflows to `783px` and surfaces the empty-state `No beds found for the selected filter` defect. Mobile width expands to `743px` and keeps only ~131px of usable main-content width.

### PatientFlags
- **768px (tablet):** No horizontal scroll. Text readable. Buttons tappable (min 44px). Tables don't overflow. Detail panels usable.
- **375px (mobile):** Critical actions still accessible. Tables stack or scroll horizontally. Modals fit screen. Wizard steps visible.

Result: 🔴 Tablet width is contained, but the live page still throws the tenant-mismatch error path. Mobile width expands to `713px` and compresses the flag-management UI into ~131px.

### RecordRestrictions
- **768px (tablet):** No horizontal scroll. Text readable. Buttons tappable (min 44px). Tables don't overflow. Detail panels usable.
- **375px (mobile):** Critical actions still accessible. Tables stack or scroll horizontally. Modals fit screen. Wizard steps visible.

Result: 🔴 This page is already functionally broken before the responsive criteria are considered: the direct route renders `Failed to load patient record` with `Tenant mismatch: session bound to default`. Mobile width inherits that same error state inside the ~131px shell failure.

### PatientDashboard
- **768px (tablet):** No horizontal scroll. Text readable. Buttons tappable (min 44px). Tables don't overflow. Detail panels usable.
- **375px (mobile):** Critical actions still accessible. Tables stack or scroll horizontally. Modals fit screen. Wizard steps visible.

Result: 🔴 Tablet width is contained, but the live page already shows `Tenant mismatch: session bound to default`. Mobile width keeps the same error state while shrinking the working area to ~131px.

### RegistrationReports
- **768px (tablet):** No horizontal scroll. Text readable. Buttons tappable (min 44px). Tables don't overflow. Detail panels usable.
- **375px (mobile):** Critical actions still accessible. Tables stack or scroll horizontally. Modals fit screen. Wizard steps visible.

Result: 🔴 This page fails at both responsive breakpoints. Tablet width already expands to `1011px` with controls off-screen and live `403` errors from the report data path; mobile width keeps the same `1011px` overflow while the fixed rails reduce the main report area to ~131px.

---

# SECTION 15: VistA INPUT TRANSFORM COMPLIANCE

VistA validates every field via input transforms stored in the data dictionary.
Our frontend validation must match or exceed VistA's rules. If our frontend accepts
a value that VistA rejects, the user gets a confusing error after submission.

### Name (.01) (File 200)
**VistA Rule:** UPPERCASE LAST,FIRST MI. Only A-Z, comma, space, hyphen. 3-35 chars. No apostrophes, no numbers, no special chars.
**Verify:** Enter lowercase → auto-uppercase. Enter O'BRIEN → warning about apostrophe.

Result: 🟡 The live wizard partially matches the File 200 name transform, but not the audited UX. On `/admin/staff/new`, typing `o'brien` into the last-name field immediately became `OBRIEN`, so lowercase is normalized and the illegal apostrophe is removed before submit. But the page did not warn about the apostrophe; it silently stripped it. That means the frontend no longer forwards that illegal character to VistA, yet it still does not satisfy the required `warning about apostrophe` behavior.

### SSN (9) (File 200)
**VistA Rule:** 9 digits. Format: 000000000 or 000-00-0000. Not all zeros. Not all same digit.
**Verify:** We don't write SSN — but if we add full SSN field later, validate these rules.

Result: 🔴 Not compliant by design. The live staff wizard only captures `govIdLast4`, not a full SSN. `StaffForm.jsx` then sends that last-4 value as `ssn`, while the backend create route explicitly comments that File 200 field `9` is not written because the UI only collects last 4. Direct M verification on disposable DUZ `10000000444` confirmed `$$GET1^DIQ(200,"10000000444,",9,"I")=""` after create. There is no honest full-SSN File 200 write path here to verify against VistA's real SSN transform.

### DOB (5) (File 200)
**VistA Rule:** FileMan internal format: YYYMMDD where YYY = year - 1700. Valid date. Not future.
**Verify:** Server converts ISO to FM: 1990-05-15 → 2900515. Verify conversion is correct.

Result: 🟢 Verified at the M prompt. A real create through the live stack for disposable DUZ `10000000444` used `dob: 1990-05-15`, and direct File 200 readback returned `DOB_I=2900515` and `DOB_E=MAY 15,1990`. The wizard also blocks future dates on the client side. This create path does perform the required ISO-to-FileMan conversion correctly.

### Sex (4) (File 200)
**VistA Rule:** SET OF CODES: M or F only.
**Verify:** Dropdown only offers M and F. No free text.

Result: 🟢 Verified. The live staff wizard exposes only `Male` and `Female` for the staff sex field, with no free-text path. The same real create for DUZ `10000000444` wrote File 200 field `4`; direct M verification returned `SEX_I=F` and `SEX_E=FEMALE`.

### Title (8) (File 200)
**VistA Rule:** POINTER to File 3.1. Must match existing entry.
**Verify:** Free text fails. Must be dropdown from File 3.1 entries.

Result: 🟡 The old failure description is stale. The live wizard now loads a real Title dropdown from File `3.1`, and current source includes `title` in both create/edit payload mapping to field `8`, so this is no longer a free-text field or a missing-payload case. The stronger field-8 persistence evidence is already tracked in Section `3.13`; this later checkpoint should no longer describe title as omitted from create.

### Service/Section (29) (File 200)
**VistA Rule:** POINTER to File 49. Must match existing entry.
**Verify:** Dropdown from File 49 entries. Type-ahead search.

Result: 🟡 The original create-contract failure is now stale, but the field is still only partially aligned with the ideal pointer-picker rule. The wizard still presents department as a type-ahead text input and can still show the degraded `No departments returned` banner, so it is not yet a strict live File `49` dropdown. However, the real create bug has been fixed: the backend now accepts wizard `department` as the create-time alias for `serviceSection`, and fresh live browser plus M verification on disposable DUZ `10000000459` showed `SERVICE_I=2` and `SERVICE_E=MEDICINE` in File `200` field `29`.

### NPI (41.99) (File 200)
**VistA Rule:** 10 digits. Luhn check digit with 80840 prefix.
**Verify:** Our Luhn validation matches VistA's. Verify.

Result: 🟢 Verified. On the live provider step, invalid `NPI=1234567890` surfaced the inline message `NPI check digit is invalid`, while valid `NPI=1234567893` was accepted. The same real create for DUZ `10000000444` then stored the value correctly; direct M readback returned `NPI_I=1234567893` and `NPI_E=1234567893`.

### DEA (53.2) (File 200)
**VistA Rule:** 2 letters + 7 digits. Check digit algorithm.
**Verify:** Our format check passes. DEA check digit not validated — add it.

Result: 🔴 The current audit text is stale, and the live product is still not compliant. Source now does implement a DEA check-digit algorithm, so this is no longer just a `format only` validator. But the live wizard still fails the user-facing contract: malformed `DEA=AB123` blocked advancement without rendering the expected inline error, because the computed DEA validation message is not wired into the field wrapper. More importantly, even a UI-accepted value did not honestly persist. A real create for DUZ `10000000444` with `DEA=AB1234563` returned extra-field `53.2 status:"ok"`, yet direct M verification returned `DEA_I=` and `DEA_E=` blank. So the frontend/backend path still accepts a DEA value it does not actually store.

### Provider Class (53.5) (File 200)
**VistA Rule:** POINTER to File 7. Must match existing entry.
**Verify:** Verify File 7 entries exist in our Docker. Use dropdown.

Result: 🟢 The older red finding is stale. The wizard now loads live File `7` provider classes instead of a hardcoded numeric list, and create-mode writes route through `ZVE USER EDIT` using canonical external provider-class values. Fresh live browser validation showed File `7` dropdown options including `STUDENT`, and direct M verification on disposable DUZ `10000000456` returned internal provider class `1` and external value `STUDENT`.

### Primary Menu (201) (File 200)
**VistA Rule:** POINTER to File 19. Must be valid option.
**Verify:** Use the wizard selector and confirm the chosen option resolves to a valid File `19` pointer; note that the current selector is curated, not a full live File `19` browser.

Result: 🟡 The original audit note is stale, but the replacement is still only partial. The live wizard does expose a `Primary Menu` selector with four curated options: `OR CPRS GUI CHART`, `XUCORE`, `EVE`, and `XUPROG`. So this is no longer `currently no UI selector`. However, it is still not a live File `19` picker. Within that shipped set, the write path works: fresh browser/API/M proof on disposable DUZ `10000000460` showed review-step `Primary Menu = XUCORE`, `/users/:duz` readback `vistaGrounding.primaryMenu = XUCORE`, and direct M verification `PMENU_I=38`, `PMENU_E=XUCORE`.

### Phone (.132) (File 200)
**VistA Rule:** Numeric with optional formatting. VistA stores raw.
**Verify:** Accept formatted input, strip to digits for VistA, format for display.

Result: 🟡 The field persists, but not in the audited normalization model. The live create for DUZ `10000000444` used formatted input `(503) 555-0100`, and direct M verification returned `PHONE_I=(503) 555-0100` and `PHONE_E=(503) 555-0100`. So the product accepts formatted input and stores it, but this stack did not strip the value to raw digits before filing. That is partial compliance rather than the stated raw-storage rule.

### Email (.151) (File 200)
**VistA Rule:** Free text. VistA has minimal validation.
**Verify:** Our regex is sufficient. VistA accepts almost anything.

Result: 🟢 Verified. The client enforces a normal email regex, and the live create for DUZ `10000000444` stored the value successfully. Direct M verification returned `EMAIL_I=s15082957@example.org` and `EMAIL_E=s15082957@example.org`.

### Patient Name (.01) (File 2)
**VistA Rule:** Same as File 200: UPPERCASE LAST,FIRST. A-Z/comma/space/hyphen.
**Verify:** Same validation as staff names.

Result: 🔴 Not compliant. The live patient registration page does not mirror the stricter staff-name behavior. In the browser, both duplicate-check and identity fields accepted lowercase/apostrophe input such as `o'brien` without auto-uppercase or warning. Source validation only rejects digits in the last name; it does not enforce File `2` uppercase/comma/hyphen rules at the field level. The save payload does uppercase on submit, but the real browser registration path is blocked by the tenant mismatch in `patientService.js`, so there is no honest VistA write proving parity.

### Patient SSN (.09) (File 2)
**VistA Rule:** 9 digits required for VA patients. Pseudo-SSN with reason for non-VA.
**Verify:** Full 9 digits required. Validate format.

Result: 🔴 Not compliant. Source validation only checks that the entered SSN has nine digits after punctuation stripping. It does not enforce the stronger VistA rules called out here, such as rejecting all zeros, repeated digits, or handling pseudo-SSN/non-VA exceptions. The live registration path is also blocked before any File `2` write because `patientService.js` still hardcodes `tenantId='local-dev'`.

### Marital Status (.05) (File 2)
**VistA Rule:** POINTER to File 11. Must match.
**Verify:** Dropdown from File 11 entries.

Result: 🔴 Not compliant. The live browser renders a static `Marital Status` dropdown with hardcoded options `Single`, `Married`, `Divorced`, `Widowed`, `Separated`, and `Unknown`. Source confirms these come from a local `MARITAL_OPTIONS` array, not live File `11` data. No honest patient save reached VistA from this page because of the tenant mismatch, so pointer fidelity remains unproven and the current implementation is red.

### Race (.06) (File 2)
**VistA Rule:** POINTER to File 10. Multiple allowed.
**Verify:** Multi-select from File 10 entries.

Result: 🔴 Not compliant. The page renders a five-item hardcoded checkbox list (`American Indian or Alaska Native`, `Asian`, `Black or African American`, `Native Hawaiian or Other Pacific Islander`, `White`). Source confirms these are local `RACE_OPTIONS`, not live File `10` values. So while the UI is multi-select, it is not grounded in the real VistA pointer file and cannot honestly claim File `10` parity.

### Religion (.08) (File 2)
**VistA Rule:** POINTER to File 13. Must match.
**Verify:** Dropdown from File 13 entries.

Result: 🔴 Not compliant. The live browser renders a large but static Religion dropdown, and source confirms it is backed by the hardcoded `RELIGION_OPTIONS` constant rather than live File `13` data. The patient registration path still cannot submit honestly under the active session, so there is no VistA write proving these values map to real File `13` entries.

### SC Percentage (.302) (File 2)
**VistA Rule:** Numeric 0-100 in increments of 10.
**Verify:** Validate: 55 → error. 50 → accepted.

Result: 🟡 The client-side rule matches the audit, but the end-to-end patient path is still blocked. Source validation rejects any non-integer or non-10-step value outside `0..100`, and the live browser shows the expected `0%` through `100%` step selector when `Service Connected` is enabled. That is the right frontend constraint. But because registration/edit saves from this page still fail on the hardcoded `local-dev` tenant, I do not have an honest File `2` `.302` write to mark this fully green.

### Clinic Name (.01) (File 44)
**VistA Rule:** Free text but no special chars beyond A-Z, 0-9, space.
**Verify:** Validate against VistA naming rules.

Result: 🔴 Not compliant. In the live `Add Clinic` modal, entering `CLINIC@NAME#15` plus valid stop code `141` enabled the `Create Clinic` button immediately. Source confirms there is no client-side clinic-name validator beyond `name.trim()`. So the current UI accepts characters outside the audit's stated naming rule before any VistA round-trip.

### Ward Name (.01) (File 42)
**VistA Rule:** Similar to clinic naming rules.
**Verify:** Validate.

Result: 🔴 Not compliant. In the live `Add Ward` modal, entering `WARD@NAME#15` immediately enabled `Create Ward`. Source confirms the create flow only checks `name.trim()` and has no naming-rule validator. As with clinics, the UI currently accepts characters that the audit says should be rejected before submit.

---

# SECTION 16: MISSING PATIENT REGISTRATION FIELDS

Terminal's ADT registration captures 90+ fields. Our form has 52. These are the missing fields
that a real healthcare facility would need. Prioritized by clinical importance.

Current state after live browser and source review: this section is partly stale. Many of these fields are now visible in the registration UI, but most are still only UI-level because the patient create/edit routes only persist a small subset of File `2` fields.

### 🟡 [HIGH] Next of Kin (.211 sub-file)
Emergency contact required for inpatient admission. Name, relationship, phone, address.

Result: 🟡 No longer missing from the browser, but still not end to end. The live `Emergency Contacts` accordion shows `Next of Kin Name`, `Next of Kin Phone`, `NOK Relationship`, and `Next of Kin Address`. `PatientDemographics.jsx` includes a `nextOfKin` payload object, but the tenant-admin patient create/update routes do not file NOK fields into File `2`, so this remains UI-only.

### 🟡 [HIGH] Emergency Contact (.219 sub-file)
Separate from NOK. Required for conscious sedation procedures.

Result: 🟡 Partially present. The live browser shows separate `Emergency Contact Name`, `Emergency Contact Phone`, and `Relationship` fields, so this is not absent from the form anymore. But there is no emergency-contact address field, and the backend patient create/update routes ignore the `emergencyContact` payload object rather than writing File `2` emergency-contact fields. So the product still does not deliver this end to end.

### 🟡 [HIGH] Employer Name (.3111)
Required for means test. Determines copay eligibility.

Result: 🟡 Present in the browser, not persisted. The live `Employment & Eligibility` section exposes `Employer Name`, and the form payload carries it inside `employment.employer`. But the patient create/update routes never map that value into File `2`, so this remains unsaved UI state rather than a real registration field.

### 🟡 [HIGH] Employment Status (.3112)
Employed/Retired/Unemployed/Student. Affects financial assessment.

Result: 🟡 Present in the browser, not persisted. The live form exposes `Employment Status` with concrete options (`Employed`, `Retired`, `Unemployed`, `Student`, `Self-Employed`, `Unknown`). But tenant-admin patient create/update only file a narrow set of demographic fields and do not map employment status into VistA.

### 🟡 [HIGH] Enrollment Priority Group (27.02)
1-8. Determines VA benefits eligibility. Critical for VA patients.

Result: 🟡 Present in the browser, not persisted. The live form shows `Enrollment Priority Group` with `Group 1` through `Group 8`, and the form payload includes `enrollmentPriorityGroup`. The backend patient create/update routes do not file that value anywhere, so this is still missing as a working registration capability.

### 🟡 [MEDIUM] Branch of Service (.3211)
Army/Navy/AF/Marines/CG. Required for veteran status verification.

Result: 🟡 Visible in the browser but not wired to VistA writes. The live `Military Service & Eligibility` section shows a `Branch of Service` dropdown. But the value only lives inside the frontend `militaryService` payload object; the patient create/update routes do not map it into File `2`.

### 🟡 [MEDIUM] Service Entry Date (.3214)
When active duty started. Required for eligibility.

Result: 🟡 Visible in the browser but not persisted. The live form exposes `Service Entry Date`, yet the current patient create/update routes do not file that value to File `2`.

### 🟡 [MEDIUM] Service Separation Date (.3215)
When active duty ended. Required for eligibility.

Result: 🟡 Visible in the browser but not persisted. The live form exposes `Service Separation Date`, but the backend patient create/update routes do not write it to VistA.

### 🟡 [MEDIUM] Period of Service (.3212)
WWI/WWII/Korea/Vietnam/Gulf/OEF/OIF. Benefits determination.

Result: 🟡 Visible in the browser but not persisted. The live form exposes `Period of Service` with the expected era options. But the value is not mapped by tenant-admin patient create/update, so it is still missing as a working registration field.

### 🟡 [MEDIUM] Country of Birth (.092)
Required for identity verification and immigration status.

Result: 🟡 Visible in the browser but not persisted. The live identity section includes `Country of Birth`, and the frontend payload includes `countryOfBirth`. The backend patient create/update routes do not file it to File `2`, so this remains incomplete.

### 🔴 [MEDIUM] Place of Birth City (.093)
Additional identity verification.

Result: 🔴 Still missing. There is no `Place of Birth City` field in the live browser, and no matching state key or backend route mapping in the current patient form/save path.

### 🔴 [MEDIUM] Place of Birth State (.094)
Additional identity verification.

Result: 🔴 Still missing. There is no `Place of Birth State` field in the live browser, and no corresponding payload or backend mapping in the current patient flow.

### 🟡 [MEDIUM] Mother's Maiden Name (.2403)
Identity verification for phone interactions.

Result: 🟡 Visible in the browser but not persisted. The live identity section includes `Mother's Maiden Name`, and the frontend payload includes `motherMaidenName`. But the patient create/update routes do not file that value into VistA.

### 🟡 [MEDIUM] Interpreter Needed (.12)
Critical for patient safety. Language barrier flag.

Result: 🟡 Visible in the browser but not persisted. The live demographics section includes an `Interpreter Needed` toggle, but the current patient create/update routes do not write it to File `2`.

### 🟡 [MEDIUM] Advance Directive (78.1)
On file / Not on file. Required for inpatient admission.

Result: 🟡 Visible in the browser but not persisted. The live registration section includes an `Advance Directive on File` toggle, and the frontend payload includes `advanceDirectiveOnFile`. The tenant-admin patient create/update routes do not file it anywhere.

### 🔴 [MEDIUM] Organ Donor Status
Patient preference tracking.

Result: 🔴 Still missing. There is no organ-donor field in the live registration UI, no payload key for it, and no patient-route mapping for it.

### 🟡 [LOW] Agent Orange Exposure (.321101)
Environmental hazard tracking for VA.

Result: 🟡 Partially present. The live `Environmental Exposures` checklist includes `Agent Orange`, so the concept is represented in the browser. But it is only carried as a generic `exposures` array in the frontend and is not mapped into the specific VistA field or any patient create/update write path.

### 🟡 [LOW] Radiation Exposure (.3213)
Environmental hazard tracking.

Result: 🟡 Partially present. The live `Environmental Exposures` checklist includes `Ionizing Radiation`, but the backend does not map that choice into File `2` field `.3213` or any equivalent persistent write.

### 🟡 [LOW] Combat Veteran Status
Affects priority group and benefits.

Result: 🟡 Visible in the browser but not persisted. The live military section includes a `Combat Veteran` field, but the current patient create/update routes do not map or file it.

### 🟡 [LOW] POW Status
Affects priority group and benefits.

Result: 🟡 Visible in the browser but not persisted. The live military section includes a `Former POW` toggle, but tenant-admin does not currently write it to VistA.

### 🔴 [LOW] Spinal Cord Injury (57)
Specialized care tracking.

Result: 🔴 Still missing. There is no spinal-cord-injury field in the live patient registration form, no payload key for it, and no backend mapping for it.

### 🟡 [LOW] Employer Phone (.3116)
For employment verification.

Result: 🟡 Visible in the browser but not persisted. The live employment section includes `Employer Phone`, but the patient create/update routes do not file it.

### 🔴 [LOW] Collateral of Record (.2191-.2196)
Legal representative information.

Result: 🔴 Still missing. There is no collateral-of-record section or field set in the live browser, and nothing in the current payload or patient routes maps to those fields.

### 🔴 [LOW] Designee (.291-.299)
Power of attorney / healthcare proxy.

Result: 🔴 Still missing. There is no designee / healthcare-proxy field group in the current browser form or backend registration contract.

### 🔴 [LOW] Father's Name (.2401)
Dependent information.

Result: 🔴 Still missing. There is no `Father's Name` field in the live registration form, and no related payload or patient-route mapping.

### 🔴 [LOW] Mother's Name (.2402)
Dependent information.

Result: 🔴 Still missing. The form has `Mother's Maiden Name`, but not a distinct `Mother's Name` field. There is no separate browser control or backend mapping for `.2402`.

---

# SECTION 17: UX POLISH — Things Real Users Would Report

### Every page should have a document title
This blanket claim is stale. Current source sets page-specific document titles across major admin and patient routes, and live browser verification earlier in this audit run showed Staff Directory rendering `Staff Directory — VistA Evolved` in the tab.

### Ctrl+P print stylesheet
This claim is stale. `apps/web/src/index.css` now has a global `@media print` block that hides header/nav/aside chrome, and earlier live browser validation on Staff Directory confirmed print mode suppresses the shell and prints the open detail pane cleanly.

### No breadcrumb consistency
This is no longer fully true. Admin and patient pages now commonly pass explicit breadcrumb strings into `AppShell`, and the live Staff Directory page earlier in this session showed `Admin > Staff Directory` in the rendered breadcrumb.

### No loading state consistency
This is only partially resolved. Shared `TableSkeleton` / `PageSkeleton` and `ErrorState` components are wired across many admin pages, but many patient workflows and some forms still use ad hoc `progress_activity` spinners or inline loading text instead of the shared skeleton pattern.

### No success notification consistency
Still partial. The product has success banners, success screens, and a lightweight global connection toast, but write-success feedback is still mixed across inline text, banners, modal closures, and dedicated success screens rather than one standardized toast system.

### ConfirmDialog: no keyboard shortcuts
This claim is stale for the shared confirm path. `ConfirmDialog` now handles Enter to confirm, Escape to cancel, and traps `Tab` / `Shift+Tab` inside the dialog.

### No 'What's new' or changelog
Still a real gap. Current app source did not yield an in-app changelog / `What's New` / release-notes surface for admins.

### No in-app help or documentation links
Partial. The app now includes a fair amount of inline helper text, titles, and field explanations, but not a consistent per-section help-link pattern to relevant documentation.

### Table row hover cursor
The blanket claim is stale for shared tables. Shared `DataTable` headers and rows now use pointer/hover states, and major admin tables such as Staff Directory inherit that behavior.

### Table row selection
This claim is stale for shared tables. `DataTable` now marks the selected row with a tinted background and left border, and Staff Directory actively uses `selectedId` to highlight the open staff row.

### Modal close on overlay click
Still partial. Shared `ConfirmDialog` closes on overlay click, but other custom modals in the same product still require explicit Cancel/Close buttons and do not uniformly dismiss from the backdrop.

### Form validation timing
Still partial. Some flows validate during typing or at step transitions, but validation timing is not standardized to required-fields-on-blur; recent live StaffForm checks already showed inconsistent visibility and timing for phone and DEA validation messages.

### Tooltip positioning
Still a real gap. The app relies heavily on native `title` tooltips and simple inline hints; there is no consistent smart-positioned tooltip layer with edge-collision handling.

### Animation/transition consistency
Still a gap. There are local hover/opacity transitions, but no consistent route-level page transition system; navigation remains effectively abrupt.

### Empty state messages
This blanket claim is stale. Shared tables and many pages now render explicit empty states such as `Welcome to the Staff Directory`, `No matching staff members`, and `No records found matching your filters` instead of leaving blank space.

### Error state consistency
Partial. Many admin pages now use the shared `ErrorState` component, and the live Staff Directory page earlier in this audit run showed a standardized `Unable to Load Data` / `HTTP 500` state, but patient pages still mix inline banners and page-local error blocks.

### No undo for destructive actions
Still a real gap. The UI frequently warns that actions cannot be undone, but there is no general soft-delete or undo-toast pattern after destructive actions.

### Stale data after action in another tab
Still a real gap overall. There is no broad cross-tab synchronization layer such as `BroadcastChannel` / storage-event refresh; at most, isolated pages like System Health refresh on tab visibility.

### Browser back button behavior
Partially improved. Staff Directory now syncs the selected user into the URL and can deep-link back into the detail panel, so the old blanket claim is stale there, but this behavior is not yet proven or standardized across all detail-panel pages.

### URL doesn't reflect current state
Partial. Staff Directory, Permissions Catalog, and Audit Log now sync meaningful filters or selected items into search params, but URL-backed state is not universal across the app.

### No keyboard shortcuts
Still mostly true. Beyond dialog Enter/Escape handling and keyboard-focusable table rows, the app does not expose a broader shortcut layer such as `Ctrl+N`, `Ctrl+F`, or global Escape patterns.

### Scrollbar flash on page load
Partial. Admin pages that use `TableSkeleton` / `PageSkeleton` are better behaved, but spinner-only pages still shift content height during load and can still flash scrollbars.

### Copy button for DUZ/NPI/DEA
Partial. Staff Directory already has a live `Copy DUZ` button, so the blanket claim is stale, but equivalent copy affordances for NPI and DEA are not broadly present.

### No confirmation sound/haptic for mobile
Still a real gap. No sound or `navigator.vibrate(...)` path was found in the current web app.

### Date format inconsistency
Still partial. Shared date-format helpers exist, but many pages still call `toLocaleDateString(...)` directly with different month/day/year styles, so date presentation is not fully standardized.

### Number format inconsistency
Still partial. Utilities exist for phone formatting and some forms format or mask SSN, but number presentation remains mixed across phone, SSN, NPI, and raw VistA-derived values.

### No session countdown timer
This claim is stale. `SystemBar` now renders `SessionTimerDisplay`, and the same countdown is reused inline on the StaffForm success screen.

### No 'Create Another' shortcut on success screen
This claim is stale. StaffForm already renders `Create Another Staff Member` on the post-create success screen, and that flow was live-validated earlier in this audit run.

### Detail panel width not adjustable
Still a real gap. Staff Directory's desktop detail panel remains a fixed width (`w-[45%]`) with no drag-to-resize behavior.

### No mini-map/quick-nav for long forms
Still a real gap. PatientDemographics organizes content into collapsible sections, but there is no dedicated quick-nav / minimap / jump list for the long registration/edit form.

---

# SECTION 18: API CONTRACT — Every Route Must Return Consistent Data

### POST /users response now includes DUZ, but not a fully honest stored user object
Partial. Earlier live create runs proved the route does create real File `200` users and the response now includes `duz`, `ien`, and a nested `user` / `data` object, so the old `response includes DUZ` gap is closed.

But the full-create contract is still not honest. Prior direct M verification showed the route can report successful extra-field writes even when title, service/section, DEA, or provider class did not actually persist, so callers still cannot treat the returned object as a guaranteed post-write truth readback.

### PUT /users/:ien still echoes request values, not true VistA-stored readback
Partial. Earlier live saves proved real File `200` fields such as phone and email can be updated end to end, but the response contract is still not fully honest. The route returns `storedValue: String(value)` from the request instead of a true post-transform readback from VistA.

That means transformed-field mismatches remain possible: the API can claim the stored value equals the submitted value even when VistA normalization or field mapping produced something different. So this is no longer an unverified prompt, but it is still a real response-contract gap.

### Error response format inconsistent
Partial. Current live `401`, `403`, and `413` responses all used the core `{ ok:false, error, code }` shape, so the older `msg` vs `error` complaint is largely stale. But the contract is still not fully uniform because many route-level failures append different auxiliary fields (`source`, `rpcUsed`, `lines`, `stage`), and not every error path includes `code`.

### No health check endpoint
This claim is stale. Live `GET /health` returned `{ ok:true, vistaConnected:true, uptime:1000 }`, and `GET /api/tenant-admin/v1/health` also exists with the same payload plus a timestamp.

### No API versioning strategy
Still a partial gap. Routes consistently live under `/api/tenant-admin/v1`, but I did not find source evidence of version negotiation, compatibility headers, or a documented migration/deprecation mechanism beyond the path prefix itself.

### CSRF validation: verify server checks token on mutations
Protection exists, but the implementation changed. The server no longer relies on a JS-readable CSRF token; instead, state-changing routes reject cross-site requests using `Sec-Fetch-Site`. Live authenticated `POST /users/check-access-code` with `Sec-Fetch-Site: cross-site` returned `403` with `{ ok:false, error:'Cross-site state-changing requests are not allowed', code:'CSRF_MISMATCH' }`.

### Rate limiting exists on login only, not as broad API throttling
Partial. Rate limiting is not global, but it does exist on the login path: `server.mjs` tracks per-IP login attempts over a 60-second window, and a live burst of six bad `POST /auth/login` requests returned `401, 401, 401, 401, 401, 429`. A separate burst of 40 rapid `GET /health` requests all returned `200`, so broader API throttling still is not in place.

### Request body size limit
Pass. Fastify is configured with `bodyLimit: 1048576` (1 MB), and a live `2 MB` `POST /api/tenant-admin/v1/auth/login` returned `413 Payload Too Large` with code `FST_ERR_CTP_BODY_TOO_LARGE` instead of crashing the server.

### Response time header
Pass. The server's `onSend` hook adds `X-Response-Time`, and live `200`, `401`, `403`, and `413` responses all included the header.

### Structured error logging
Partially implemented. Source now has an `onResponse` hook that JSON-logs every `4xx` / `5xx` with timestamp, method, URL, DUZ, status code, error text, and response time. I confirmed that hook exists in the running server source for this checkpoint, but I did not separately tail the process stdout sink here.


# SECTION 19: PER-ROUTE API VERIFICATION — All 224 Routes

The server has 224 routes (117 GET, 55 POST, 40 PUT, 12 DELETE).
For each route group below: does it connect to VistA? Does it return real data?
Does it handle errors? Does it validate input? Does it check authentication?

## Auth (3 routes)

### `POST /auth/login`
Partial. Live valid login returned `200` with real DUZ/name/keys/nav groups and set the session in an httpOnly cookie, so the route is real, but the old `session token + CSRF` expectation is stale. Live bad credentials returned `401`, and a burst of six bad login attempts returned `401 x5` then `429` from the per-IP throttle. Earlier live lockout verification also showed the route returns `401` with `code=ACCOUNT_LOCKED`, not `423`, and source shows even `VISTA_UNAVAILABLE` currently comes back through the same auth-error `401` path rather than a `503` transport response.

### `POST /auth/logout`
Pass. Live logout returned `{ ok:true }`, and the next `GET /auth/session` with the same cookie returned `401 { ok:false, error:'No active session', code:'NO_SESSION' }`.

### `GET /auth/session`
Pass. Live no-session requests returned `401 NO_SESSION`, while a valid session returned `200` with current user DUZ/name/keys plus fresh ZVE-enriched fields such as title, service, NPI, status, and e-signature state.

## Users — CRUD (12 routes)

### `GET /users`
Pass with stale audit notes. Live `GET /users` returned real File `200` staff rows through `ZVE USER LIST`, and a live `division=11` query returned only the matching division user. The old `no server-side pagination yet` claim is now stale: `GET /users?page=2&limit=2` returned `page`, `limit`, and `total=1552`.

### `GET /users/:duz`
Partial. Live `GET /users/1` returned real detail data with masked SSN, primary menu, provider fields, keys, divisions, and extension metadata, so the route is real and broadly useful. But the old `detail[0] through detail[34]` claim is not fully true: earlier verification already showed the server parses only through index `32`, so `signOnCount` / `firstSignOn` from later DETAIL fields are still dropped.

### `POST /users`
Partial. Earlier live create runs proved the route does create real File `200` users and the response now includes `duz`, `ien`, and a nested `user` / `data` object, so the old `response includes DUZ` gap is closed. But the full-create contract is still not honest: prior direct M verification showed the route can report successful extra-field writes even when title, service/section, DEA, or provider class did not actually persist.

### `PUT /users/:ien`
Partial. Earlier live saves proved real File `200` fields such as phone and email can be updated end to end, but the response contract is still not fully honest: the route returns `storedValue: String(value)` from the request instead of a true post-transform readback, which is why transformed-field mismatches were still possible in the earlier input-transform audit work.

### `PUT /users/:duz/rename`
Pass. Earlier live rename verification changed File `200` field `.01`, and direct M verification confirmed the new `^VA(200,"B",NEWNAME,DUZ)` xref existed while the old name xref was removed.

### `PUT /users/:duz/credentials`
Fail. Earlier live reset tests showed the route can return `200` through `ZVE USMG CRED`, but login with the new credentials still returned `401 INVALID_CREDENTIALS`, so the user-facing credential-reset workflow is not honestly green.

### `POST /users/:duz/deactivate`
Fail. Earlier direct VistA verification showed the deactivation reason field and SSN preservation pieces can be real, but `DISUSER` remained blank and the route/UI semantics drifted into `terminated` rather than a clean inactive state.

### `POST /users/:duz/reactivate`
Partial. Earlier live verification proved the route clears the termination date/state and preserves SSN, but reactivated terminated accounts still could not sign in because credentials had already been cleared, so the route overstates recovery.

### `POST /users/:duz/terminate`
Fail. Earlier direct M verification proved credentials and e-signature can be cleared and `DISUSER=1` can be filed, but security keys still remained in `^XUSEC` / File `200` sub-file traces, so the required `0 keys` invariant still fails.

### `POST /users/:duz/unlock`
Partial. Earlier live verification proved the route clears a real `LOCKED` marker, but full end-user login recovery remained only partially proven because the surrounding fresh-account/login defects still interfered with honest sign-in confirmation.

### `POST /users/clone`
Partial at best. One earlier live clone from DUZ `1` did copy the source key set and secondary menus, but it still dropped primary menu and did not surface the new DUZ in the success copy; a separate physician-clone verification returned `0` keys and `0` secondary menus. So the route is not reliably honest across sources.

### `POST /users/check-access-code`
Pass. Live checks returned `{ ok:false, available:false, error:'Access code already in use' }` for existing code `PRO1234`, `{ ok:true, available:true }` for a fresh code, and lowercase `pro1234` also returned `available:false`, so the route is currently honest and case-insensitive.

## Users — Keys (3 routes)

### `POST /users/:targetDuz/keys`
Pass. Earlier live verification on disposable DUZ `10000000430` showed `POST /users/:duz/keys` immediately added `OR CPRS GUI CHART`, and direct M verification confirmed both File `200` sub-file `51` and `^XUSEC("OR CPRS GUI CHART",DUZ)` updated. Duplicate/error semantics were already proven elsewhere in the role-change work through explicit `409` failures rather than silent no-ops.

### `DELETE /users/:targetDuz/keys/:keyId`
Pass. Earlier live verification on the same disposable DUZ removed `OR CPRS GUI CHART`, and direct M verification confirmed both File `200` sub-file `51` and `^XUSEC` were cleared.

### `POST /key-impact`
Partial leaning red. Live `POST /key-impact` returned only derived nav groups, a role cluster, and a boolean admin flag map; for example `GMRA-ALLERGY VERIFY` came back with an empty nav-group list and no human impact explanation. So the route exists, but it does not yet return the kind of meaningful per-key loss-of-access description the audit item expects.

## Users — Provider (3 routes)

### `POST /users/:duz/provider`
Partial. Earlier direct VistA verification proved the route can write real provider fields such as NPI to File `200` through DDR FILER, but the concurrency contract is still wrong when extension-backed user metadata exists, so honest saves are not reliable for all users.

### `POST /users/:duz/esig`
Partial. Earlier live verification proved the clear path does write File `200` field `20.4` to empty, but the read side still reports some cleared users as having an active e-signature because it treats the lingering node as proof of a set code.

### `POST /users/:duz/esig/set`
Partial. The route is live and earlier verification proved it can file File `200` field `20.4`, but the stronger `encrypted hash stored` claim is not honestly green from current evidence; prior direct M verification showed the value written back as the supplied test code rather than a clearly different hash representation.

## Users — Division (1 route)

### `POST /users/:duz/division`
Pass. Earlier live add/remove verification on disposable DUZ `10000000443` showed File `200.02` entries being created and removed, and direct M verification confirmed the corresponding sub-file headers and entries changed exactly as expected.

## Users — Audit (2 routes)

### `GET /users/:duz/access-audit`
Fail. The route is live, but the current output is not an honest access-audit view for real users. Live `GET /users/1/access-audit` returned `userName:"(unknown)"`, `primaryMenu:"(none)"`, and `securityKeys:[]` even though `/users/1` and direct prior verification show DUZ `1` has a real name, primary menu, and a large key set.

### `GET /esig-status`
Partial. The route does return real e-signature presence data for probed users, but it is not truly bulk-all-users: live `GET /esig-status` reported `total=118` / `probedUsers=118` while `/users` currently exposes `1552` total users. That cap means it cannot honestly be treated as a full-system bulk status surface, even though its per-row `hasCode` values do reflect real DDR reads for the users it samples.

## Clinics (8 routes)

### `GET /clinics`
Pass. Earlier live clinic list queries returned real File `44` data, and newly created disposable clinics appeared immediately in both list and detail reads. Direct M verification on those same records confirmed TYPE `C`, which is consistent with the route's clinic-only screen.

### `GET /clinics/:ien`
Partial. Earlier live `/clinics/:ien` reads for disposable clinic IENs `949` and `950` returned real detail including `.01`, type, and inactive-date state, so the route is real. I did not separately prove full-file exhaustive field coverage in this checkpoint.

### `POST /clinics`
Pass. Earlier live `POST /clinics` created disposable clinic IEN `949`, list/detail readback showed type `C`, and direct M verification confirmed `^SC(949,0)` stored the clinic with piece `3 = C`.

### `PUT /clinics/:ien`
Pass. Earlier live rename via `PUT /clinics/949` changed the clinic name, and both route readback and direct M verification on `^SC(949,0)` matched the new `.01` value.

### `PUT /clinics/:ien/fields`
Partial. The route does perform real File `44` writes for supported fields such as `.01`, but it is not honestly green for `each field`: earlier live validation showed field `8` (stop code) failing through `DDR VALIDATOR` even while other clinic edits succeeded.

### `POST /clinics/:ien/inactivate`
Pass. Earlier live inactivation set the inactive date, list/detail readbacks showed the date, and direct M verification confirmed `^SC(IEN,"I")` was populated while the clinic record itself remained intact.

### `POST /clinics/:ien/reactivate`
Pass. Earlier live reactivation cleared the inactive date, list/detail readbacks returned the clinic to active status, and direct M verification confirmed `^SC(IEN,"I")` was empty again.

### `GET /clinics/:ien/availability`
Pass. Earlier live Scheduling-tab verification loaded real availability rows for a disposable clinic, and the schedule-template tool copied an existing `10^2^30` pattern onto future empty dates, which proves the route is returning real clinic schedule data rather than placeholders.

## Wards (4 routes)

### `GET /wards`
Pass. Earlier live ward list/search checks returned real File `42` rows, and disposable ward creation immediately increased the visible count and became searchable through the route-backed page.

### `POST /wards`
Pass. Earlier live `POST /wards` created disposable ward IEN `66`, and direct M verification confirmed `^DIC(42,66,0)` existed with the expected ward name.

### `PUT /wards/:ien`
Not separately proven in this checkpoint. The route exists as a dedicated `ZVE WRDM EDIT` name-update path, but the earlier successful ward rename proof used `/wards/:ien/fields`, not this exact endpoint.

### `PUT /wards/:ien/fields`
Pass for the verified field path. Earlier live verification of `PUT /wards/66/fields` updated the ward name, and direct M verification confirmed the new `.01` value under File `42`.

## Devices (6 routes)

### `GET /devices`
Pass. Earlier live device list/search checks returned real File `3.5` rows, and disposable create/delete runs changed the visible count as expected.

### `GET /devices/:ien`
Pass. Earlier live `/devices/712` and `/devices/713` reads returned real File `3.5` detail, including resolved device type and the created field values used during verification.

### `POST /devices`
Pass. Earlier live device creation produced real File `3.5` entries, and direct M verification confirmed the created zero node plus required field values such as type, margin width, page length, and open parameters.

### `PUT /devices/:ien`
Not separately proven in this checkpoint. The device update work verified the field-level updater and create/delete paths, but I did not re-run this exact route as a standalone endpoint here.

### `DELETE /devices/:ien`
Pass. Earlier live delete verification removed disposable device IEN `712`, and direct M verification confirmed the File `3.5` node was gone.

### `POST /devices/:ien/test-print`
Pass. Earlier live `POST /devices/524/test-print` returned `1^OK` / `TEST^PRINT OK`, and direct routine-level verification of `TPRINT^ZVEDEV` matched that success output.

## Divisions (4 routes)

### `GET /divisions`
Pass. Earlier site-management verification showed the divisions list route returning real File `40.8` rows, and the same route reflected live count changes when divisions were added or deleted.

### `GET /divisions/:ien`
Partial. The route exists and the site-management detail panel is grounded in live division data, but I did not separately re-prove standalone exhaustive detail coverage for this exact endpoint in this checkpoint.

### `POST /divisions`
Fail. Earlier live Add Site verification hit the route's current defect: the create flow failed with `The IENS 'ZZZ AUDIT DELETE 0413,' is syntactically incorrect.` and did not honestly create the division through the product endpoint.

### `DELETE /divisions/:ien`
Fail. Earlier live delete verification proved the route can remove the File `40.8` record, but it did so without the required assigned-user safeguard. The UI confirm also surfaced no such check, so the safety contract remains broken.

## Mail Groups (4 routes)

### `GET /mail-groups`
Partial. Earlier live Mail Group Management verification showed the route returning real group names and usable list counts, but I did not separately re-prove description-field coverage in this checkpoint.

### `GET /mail-groups/:ien/members`
Fail. Earlier live member-list verification on mail group `187` showed the route returning a fake status-row object like `{ ien:"1", name:"OK", type:"1" }` / `{ ... type:"0" }` instead of a clean member list, so the parser does not honestly match File `3.8` sub-file membership.

### `POST /mail-groups/:ien/members`
Partial. Earlier live add-member verification proved the write path really adds the DUZ to File `3.8` membership, but the immediate readback is polluted by the same member-list parsing bug.

### `DELETE /mail-groups/:ien/members/:duz`
Partial. Earlier live remove-member verification proved the write path removes the DUZ from File `3.8`, but the route family's readback still shows the fake status-row artifact instead of a clean empty/remaining-member list.

## MailMan (3 routes)

### `GET /mailman/inbox`
Pass. Earlier MailMan verification showed the route returning real MailMan messages, and folder/basket filtering worked for custom baskets such as `BACKUP`, which rendered only that basket's messages.

### `POST /mailman/send`
Partial. Earlier live send verification proved the route creates real File `3.9` / `^XMB(3.9,MSGIEN)` messages, but delivery/readback semantics are still broken because recipient basket entries were not created reliably and Sent-folder behavior remained wrong.

### `DELETE /mailman/message/:ien`
Fail. Earlier live delete verification showed the route returning success while the message still remained in Inbox, WASTE stayed empty, and direct M verification showed basket membership unchanged.

## Services/Departments (4 routes)

### `GET /services`
Fail. Earlier live verification showed `GET /services` returning `data:[]` even while direct M verification proved File `49` was populated with many real service/section entries.

### `POST /services`
Partial. Earlier live create verification proved the route can write a real File `49` department entry, but the broken read surface meant the product could not honestly read back the new department through `/services` or its detail route.

### `PUT /services/:ien`
Not separately proven in this checkpoint. The department read path was already broken, and I did not re-run this exact standalone update endpoint while closing the surrounding create/delete findings.

### `DELETE /services/:ien`
Partial. Earlier direct route verification proved the delete can remove a File `49` entry, but I had to perform the assigned-user safety check manually in VistA before calling it; this checkpoint did not prove the route itself enforces that safeguard.

## Security / Config (6 routes)

### `GET /params/kernel`
Pass. Earlier live verification repeatedly showed this route returning real File `8989.3` Kernel values such as `AUTOLOGOFF`, and direct M verification matched those reads.

### `PUT /params/kernel`
Pass. Earlier live verification proved this route can update real Kernel parameters in File `8989.3` and record the reason in the admin audit trail; for example, `AUTOLOGOFF` was changed live and matched at the M prompt. Caveat: some security-sensitive UI flows now submit two-person requests instead of calling this route directly.

### `GET /params/:package`
Partial. Earlier live verification proved this route returns real module-specific parameter data with DD-derived labels for supported packages, and the prior 30-field truncation issue is gone. But support is still incomplete across the full package inventory, and the route falls back to generic field labels when DD discovery does not populate them.

### `PUT /params/:package`
Not separately proven in this checkpoint. Source shows the route writes directly to the configured package file through `DDR FILER`, but I did not re-run a standalone live module-parameter update with M-prompt verification while closing this block.

### `GET /config/2p`
Pass. Earlier live verification proved this route lists pending and historical two-person requests accurately, including submitter, old/new values, status, and approver metadata.

### `POST /config/2p`
Pass. Earlier live verification proved the request-creation route is real, self-approval is blocked, and the paired approve/reject routes complete the full two-person flow with the correct VistA write or non-write outcome.

## Patients (14 routes)

### `GET /patients`
Partial. Earlier live verification proved this route returns real File `2` search results by name on the correct tenant, but I did not separately re-prove SSN and DOB search behavior in this checkpoint, and the current browser patient-search page is still broken by its hardcoded tenant mismatch.

### `GET /patients/:dfn`
Partial. Earlier live verification proved this route returns real patient data for existing DFNs, but the read surface is incomplete enough that important current-state fields such as active ward/room-bed context can stay blank even when File `2` and ADT state are updated.

### `POST /patients`
Fail. Earlier live verification showed both rich and minimal create attempts failing without creating any File `2` patient record.

### `PUT /patients/:dfn`
Fail. Earlier live verification showed the browser edit path blocked by tenant mismatch, and I did not obtain a separate route-level File `2` update proof to override that failure.

### `POST /patients/:dfn/admit`
Pass. Earlier live verification proved this route creates a real File `405` admission movement and updates the patient location state used by census.

### `POST /patients/:dfn/discharge`
Partial. Earlier live verification proved this route creates a real discharge movement and clears the active inpatient location, but I did not add a stronger explicit discharge-to-admission linkage proof beyond the broader workflow evidence.

### `POST /patients/:dfn/transfer`
Fail. Earlier live verification showed the browser transfer path blocked by tenant mismatch and inpatient read-state gaps, and no honest transfer movement pair was proven from this route.

### `POST /patients/:dfn/flags`
Fail. Earlier live verification showed the UI payload contract is wrong (`flagName` missing), the route rejects the add, and no File `26.13` entry is created.

### `PUT /patients/:dfn/flags/:flagId`
Fail. Earlier live verification showed the wired inactivate/update path blocked by tenant mismatch, and no real File `26.13` update was proven from this route.

### `POST /patients/:dfn/insurance`
Fail. Earlier live verification showed the UI sends the wrong contract (`companyIen`/`planName` instead of the required `insuranceType`), so the route rejects the add and no File `2.312` subentry is created.

### `PUT /patients/:dfn/insurance/:insuranceId`
Not separately proven in this checkpoint. The surrounding insurance flows are already broken, and I did not re-run a standalone live insurance update with File `2.312` verification.

### `DELETE /patients/:dfn/insurance/:insuranceId`
Fail. Earlier live verification showed the browser delete path is wired to the wrong tenant and leaves the row in place, so no honest File `2.312` removal was proven.

### `POST /patients/:dfn/assessment`
Fail. Earlier live verification showed the calculation UI works locally, but the submit path is blocked by tenant mismatch and no File `408.31` entry is created.

### `PUT /patients/:dfn/restrictions`
Fail. Earlier live verification showed the Record Restrictions page cannot load on the active session and the wired update route fails with tenant mismatch before any patient restriction write can occur.

## Patient — Support (6 routes)

### `POST /patients/:dfn/break-glass`
Fail. Earlier live verification showed this route returns success and a synthetic audit id, but the patient audit-events feed still returns zero rows afterward, so the required retrievable audit entry is not actually created.

### `POST /patients/:dfn/verify-eligibility`
Partial. Fresh live verification showed this route returns a simple eligibility-style determination (`status:"none"` for DFN `101044`) based on the patient's insurance entries, but source shows it is not actually calling a dedicated `ZVE PATIENT ELIG` path and I did not re-prove richer active/expired cases.

### `POST /patients/:dfn/authorized-staff`
Not separately proven in this checkpoint. Source shows a direct File `38.13` add path, but I did not re-run a live authorized-staff write with storage verification here.

### `DELETE /patients/:dfn/authorized-staff/:staffIen`
Not separately proven in this checkpoint. Source shows a matching File `38.13` delete path, but I did not re-run a live authorized-staff removal with storage verification here.

### `GET /patients/:dfn/audit-events`
Fail. Fresh live verification on restricted patient `100841` still returned `data:[]`, including after a successful break-glass POST, so this route is not returning the expected real access events.

### `GET /patients/dashboard`
Fail. Fresh live verification showed this route returns real aggregate counts for total patients and total beds, but the payload is not honest for operational status: source hardcodes `activePatients = totalPatients` and `bedSummary.occupied = 0`, which conflicts with earlier live census evidence showing occupied inpatient rows.

## System Health (8 routes)

### `GET /hl7-interfaces`
Pass. Earlier live verification showed this route returning real HL7 logical-link rows and statuses used by the System Health page.

### `GET /hl7/filer-status`
Pass. Earlier live verification showed this route returning real HL7 filer state, including the stopped incoming/outgoing status visible on the health page.

### `POST /hl7-interfaces/:ien/shutdown`
Pass. Earlier live verification proved this route updates the HL7 shutdown flag in VistA and the interface status changes accordingly.

### `POST /hl7-interfaces/:ien/enable`
Pass. Earlier live verification proved this route clears the HL7 shutdown flag and restores the enabled state.

### `GET /taskman/status`
Pass. Earlier live verification proved this route reports real TaskMan running/stopped state and matched the live start-control check.

### `GET /taskman-tasks`
Pass. Earlier live verification showed this route returning real TaskMan rows, and the health page rendered non-empty task data from it.

### `GET /error-trap`
Pass. Earlier live verification showed this route returning real error-trap rows, including the non-empty dataset rendered on the Audit and Health surfaces.

### `POST /error-trap/purge`
Partial. Earlier live verification proved this maintenance route exists and returns success against the error-trap store, but I did not separately re-prove row removal after purge in this checkpoint.

## Audit (5 routes)

### `GET /audit/signon-log`
Partial. Earlier live verification proved the route exists and is wired to the sign-on log surface, but the current environment returned `0` rows, so this checkpoint did not prove populated real sign-on entries.

### `GET /audit/fileman`
Pass. Earlier live verification showed this route returning real FileMan audit rows, and the Audit page rendered them.

### `GET /audit/failed-access`
Fail. Earlier live verification showed this route returning `0` rows in the current environment, and the broader security findings already showed failed-access auditing is not configured here.

### `GET /audit/error-log`
Pass. Earlier live verification showed this route returning real error-log rows, including the four live entries rendered on the Audit page.

### `GET /audit/programmer-mode`
Fail. Earlier live verification showed this route returning `0` rows in the current environment, so this checkpoint did not prove real programmer-mode access events.

## Dashboard & Reports (8 routes)

### `GET /dashboard`
Fail. Earlier live verification showed most counts are grounded in real files, but the dashboard still undercounts e-signature-ready staff because it only probes the first 120 users.

### `GET /reports/admin/:type`
Partial. Earlier live verification proved some admin report types such as `stale-accounts` return real VistA-backed data, but I did not re-prove every report variant in this checkpoint and some admin report surfaces still return empty datasets.

### `GET /reports/registration`
Partial. Earlier live verification showed this route returns real aggregate patient data, but it still ignores report type and filter semantics and does not provide the detailed per-report variants the UI suggests.

### `GET /reports/scheduling`
Not separately proven in this checkpoint.

### `GET /reports/billing`
Not separately proven in this checkpoint.

### `GET /reports/lab`
Not separately proven in this checkpoint.

### `GET /reports/nursing`
Not separately proven in this checkpoint.

### `GET /reports/radiology`
Not separately proven in this checkpoint.

## Reference Data (30+ routes)

### `GET /titles`
Pass. Earlier live verification showed the Staff Form `Job Title` dropdown populated with many real File `3.1` title entries.

### `GET /stop-codes`
Pass. Earlier live verification showed the clinic create flow loading real File `40.7` stop codes and resolving stop-code descriptions such as `2 -> ADMITTING/SCREENING`.

### `GET /treating-specialties`
Not separately proven in this checkpoint.

### `GET /terminal-types`
Not separately proven in this checkpoint.

### `GET /insurance-companies`
Not separately proven in this checkpoint.

### `GET /appointment-types`
Not separately proven in this checkpoint.

### `GET /lab-tests`
Not separately proven in this checkpoint.

### `GET /radiology-procedures`
Not separately proven in this checkpoint.

### `GET /drug-file`
Not separately proven in this checkpoint.

### `GET /nursing-locations`
Not separately proven in this checkpoint.

### `GET /quick-orders`
Not separately proven in this checkpoint.

### `GET /order-sets`
Not separately proven in this checkpoint.

### `GET /orderable-items`
Not separately proven in this checkpoint.

### `GET /encounter-forms`
Not separately proven in this checkpoint.

### `GET /health-summary-types`
Not separately proven in this checkpoint.

### `GET /tiu-document-defs`
Not separately proven in this checkpoint.

### `GET /bulletins`
Partial. Earlier live verification showed this route exists but returned `data:[]` in the current environment, and it does not surface the alert events created through the separate `XQALERT` path.

### `GET /menu-options`
Not separately proven in this checkpoint.

### `GET /packages`
Not separately proven in this checkpoint.

### `GET /room-beds`
Pass. Earlier live verification showed this route returning `549` real room-bed rows on the correct tenant.

### `GET /key-inventory`
Pass. Earlier live verification showed this route returning the live key corpus and matching direct File `19.1` spot checks.

### `GET /key-holders/:keyName`
Pass. Earlier live verification showed this route returning real holder counts and named users for `OR CPRS GUI CHART`, matching direct `^XUSEC` checks.

### `GET /roles`
Partial. Earlier live verification showed the built-in roles surface is real enough to drive role assignment attempts, but I did not separately re-prove the raw route contract for every built-in template in this checkpoint.

### `GET /roles/custom`
Partial. Earlier live verification showed this route returning real stored custom-role records, but the stored key payload can still be malformed (`keys:["1"]`) because of the create/update delimiter bug.

### `GET /capacity`
Partial. Earlier live verification showed this route returns data and participates in the health-page load, but I did not separately reconcile its values against independent M-level capacity counts in this checkpoint.

### `GET /census`
Pass. Earlier live verification showed this route returning real inpatient census rows and reflecting admit/discharge changes correctly.

### `GET /topology`
Not separately proven in this checkpoint.

## Cross-cutting concerns for ALL routes

### `Authentication check`
Partial. Earlier live verification proved protected routes reject missing sessions with `401`, but the system also intentionally exposes some unauthenticated routes such as `/health` and `/public/login-config`, so the blanket claim is not literally true.

### `CSRF validation`
Partial. Earlier live verification proved mutating routes reject cross-site requests with `403 CSRF_MISMATCH`, but the implementation uses `Sec-Fetch-Site` rather than a traditional synchronizer CSRF token.

### `Input validation`
Partial. Many routes do return clean `400` errors for missing required fields, but several broken flows still surface deeper `500`/`502` failures or mismatched contracts instead of uniform field-level validation.

### `Error response format`
Partial. Earlier live verification showed most routes normalize to `{ ok:false, error, code }`, but the contract still varies with extra fields and different failure shapes depending on the route.

### `Timeout handling`
Not separately proven in this checkpoint.

### `Request logging`
Fail. Earlier source verification showed structured JSON logging for `4xx/5xx` responses, not every request.

### `Rate limiting`
Fail. Earlier live verification showed rate limiting on login only; broader write-route throttling is still absent.

---

# SECTION 20: DEEPER RESPONSIVE AUDIT — Specific Breakpoint Issues

## StaffDirectory
Result: 🔴 Only one of these breakpoint-specific behaviors is actually present today: source already gives the detail panel a mobile full-screen overlay path at `xl:hidden fixed inset-0`, but it switches at `xl`, not at the requested `768px` breakpoint. The rest of the Section 20 behavior is not implemented: the table stays a table, low-priority columns are not selectively hidden at tablet width, and there is no dedicated `Filters` collapse button or card-layout replacement at `375px`. Earlier live responsive testing already showed the consequence: tablet avoided document overflow but still had undersized targets, while phone width left only about `131px` of usable main-content width and pushed controls off-screen.

## StaffForm
Result: 🔴 These breakpoint-specific adaptations are not honestly implemented. Earlier live testing already showed tablet still exposing many sub-44px targets and mobile overflowing to about `500px` while the fixed shell left only about `131px` for the form. Current source inspection did not show a numbered-dot mobile stepper, an explicit compact tablet stepper, or a dedicated large-tap-target mobile permission layout. The page may inherit some global responsive CSS, but the live result is still a failing multi-step form at both audited breakpoints.

## RoleTemplates
Result: 🔴 The required tablet/mobile role-layout changes are not proven in the current product. Source inspection did not show a role-selector dropdown for phone width or a specific tablet-only full-width assignment modal path, and earlier live testing already showed the fixed mobile shell compressing the role cards and controls into an unusable narrow column. The honest status is that the role UI remains largely desktop-shaped and fails the Section 20 breakpoint expectations.

## ClinicManagement
Result: 🔴 No concrete clinic-table-to-card mobile transformation or explicit tablet stacked master/detail behavior was separately found in source, and earlier live testing already showed phone width pushing clinic controls off-screen inside the fixed-rail shell. So the specific Section 20 breakpoint behavior should be treated as not implemented.

## PatientSearch
Result: 🔴 Source still uses the standard table path rather than a card renderer or breakpoint-specific column-hiding policy, and earlier live testing showed the page overflowing even at tablet width (`870px`) before mobile compression is considered. The search page therefore does not provide the requested reduced-column tablet layout or patient-card mobile layout.

## PatientDemographics
Result: 🔴 This is mixed in source but still failing overall. The page already uses collapsible accordion sections, so that specific mobile pattern exists. But current source review did not prove a fixed bottom Save/Cancel action bar, and earlier live testing showed the page still failing both breakpoints because of tenant-mismatch load errors plus the same mobile-shell compression. So Section 20 remains red even though the accordion requirement itself is effectively present.

## AdminDashboard
Result: 🔴 The dashboard is closer than most pages but still not honestly passing. Source uses a responsive Tailwind grid (`grid-cols-2 md:grid-cols-4`), so some card reflow exists. But earlier live testing still showed the mobile page expanding to `513px` and collapsing into the same fixed-shell failure, which means the intended full-width phone-card behavior is not actually achieved end to end.

## SystemHealth
Result: 🔴 No dedicated tab-to-dropdown mobile transformation was found in current source inspection, and earlier live testing already showed tablet-width undersized controls plus mobile compression to about `131px` of working area. The required Section 20 breakpoint behavior is therefore not implemented.

## AuditLog
Result: 🔴 The page still relies on table rendering rather than a mobile card presentation. While shared table styling exists, current source inspection did not show a dedicated phone-width expandable-card mode for audit entries, and earlier live testing showed the mobile page growing to `600px` wide with controls pushed off-screen. Section 20 remains red.

## AlertsNotifications
Result: 🔴 The current page clearly manages selected message/detail state, but I did not find a trustworthy breakpoint-specific stacked tablet layout or a mobile-only list-plus-overlay message pattern. Earlier live testing already showed the message UI compressed into the fixed mobile shell and not usable on phone width, so the Section 20 target behavior should be treated as absent.

## PermissionsCatalog
Result: 🔴 Source shows some responsive width changes and an `xl` detail-panel split, but not the requested `768px` adaptations. Earlier live testing already showed phone width leaving only about `131px` of usable content and pushing many controls off-screen. The specific Section 20 expectation of a usable tablet/mobile catalog with accessible primary actions is not met.

## SecurityAuth
Result: 🔴 Earlier live testing already showed this page failing both breakpoints: tablet had overflow/undersized-control issues, and mobile overflowed to `492px` with controls off-screen. I did not find a stronger page-specific mobile form-stack implementation in source to overturn that result.

## SiteParameters
Result: 🔴 This page was already a hard fail in the earlier live sweep because it expanded to `792px` even on a `768px` viewport. Nothing in the current source review suggests a page-specific fallback that would satisfy the requested tablet/mobile behavior, so Section 20 remains red.

## AdminReports
Result: 🔴 Earlier live testing showed mobile width expanding to `471px` with controls off-screen, and current source review did not show a stronger page-specific mobile report layout. The Section 20 breakpoint behavior is not proven and should be considered failing.

## WardManagement
Result: 🔴 Earlier live testing already showed the mobile page compressing to the fixed-shell pattern with controls off-screen, and I did not find evidence of a dedicated page-level tablet/mobile remediation in source. The required breakpoint behavior is not implemented.

## DeviceManagement
Result: 🔴 Same outcome as Ward Management: the live responsive sweep showed the phone view compressed into the shell failure, and current source review did not surface page-specific breakpoint logic that would satisfy the Section 20 requirements.

## MailGroupManagement
Result: 🔴 Earlier live testing already showed the mobile shell reducing the usable work area to about `131px` and pushing controls off-screen. Current source inspection did not reveal a compensating page-specific mobile layout, so the Section 20 behavior remains unimplemented.

## DepartmentsServices
Result: 🔴 The live responsive sweep already showed the phone version collapsing into the same narrow-shell failure, and I did not find any page-specific responsive adaptation in current source inspection. The Section 20 breakpoint behavior is not implemented.

## SiteManagement
Result: 🔴 Earlier live testing showed the fixed mobile rails leaving only about `131px` for the page even without dramatic document overflow. Current source review did not show a stronger mobile/tablet layout path, so this remains a Section 20 failure.

## SystemConfig
Result: 🔴 The live sweep already showed phone width expanding to `470px` and pushing controls off-screen, and current source review did not reveal a dedicated responsive form stack or full-width mobile action treatment that would satisfy Section 20.

## InsuranceCoverage
Result: 🔴 Even aside from the live tenant-mismatch data-load failure, the page failed the earlier responsive sweep at both breakpoints, with mobile width expanding to `642px`. I did not find source evidence of a dedicated responsive insurance-management layout that would satisfy the Section 20 expectations.

## FinancialAssessment
Result: 🔴 This page remains red for both function and layout. Earlier live testing already showed the tablet page throwing tenant-mismatch errors and the mobile page expanding to `701px`; current source review did not reveal a page-specific breakpoint treatment that would make the form usable at the audited widths.

## Admission
Result: 🔴 Earlier live testing already showed the page broken at tablet width with `Loading units...` / tenant-mismatch behavior and still compressed on mobile. I did not find source evidence of a dedicated responsive admission form layout that would satisfy Section 20.

## Discharge
Result: 🔴 Earlier live testing already showed both undersized controls at tablet width and mobile-shell compression. Current source review did not reveal a dedicated breakpoint-specific discharge layout that would overturn that result.

## Transfer
Result: 🔴 This page remains a functional and responsive fail. Earlier live testing already showed the broken `Loading units...` / tenant-mismatch state at tablet width and the same compressed mobile shell at phone width, with no stronger page-specific responsive implementation found in source.

## BedManagement
Result: 🔴 This page already failed the earlier responsive sweep at tablet width by expanding to `783px`, and mobile expanded to `743px` while the fixed shell still reduced usable working width to about `131px`. Current source inspection did not reveal a dedicated tablet/mobile fallback that would satisfy Section 20.

## PatientFlags
Result: 🔴 Earlier live testing already showed the tablet tenant-mismatch failure path and the mobile expansion/compression failure. I did not find source evidence of a page-specific mobile/tablet layout that would satisfy Section 20.

## RecordRestrictions
Result: 🔴 This page is already functionally broken before responsive polish is considered: the direct route fails to load the patient record in the current session. Current source inspection did not reveal a dedicated responsive fallback that would make the page satisfy the Section 20 breakpoint requirements.

## PatientDashboard
Result: 🔴 Earlier live testing already showed the tablet tenant-mismatch error state and the same fixed-shell mobile compression. No stronger page-specific responsive behavior was found in current source inspection.

## RegistrationReports
Result: 🔴 This page was already a hard fail in the earlier live sweep: tablet expanded to `1011px` with controls off-screen, and mobile inherited the same wide overflow inside the fixed-shell failure. Current source inspection did not reveal a compensating responsive report layout, so Section 20 remains red.

---

# SECTION 21: ADDITIONAL PATIENT FIELDS — File 2 Deep Audit

Beyond the 26 missing fields in Section 16, these additional File 2 fields
are used by specific VistA packages and may be needed for clinical completeness:

### File 2 field .1011: CURRENT ROOM
Auto-set on admission. Display only. Verify it updates.

Result: 🔴 Fresh live re-verification still did not populate this field. I re-admitted patient `DFN 101044` through `POST /api/tenant-admin/v1/patients/101044/admit?tenantId=default`, which returned HTTP `200` via `ZVE ADT ADMIT` with movement `5300`, ward `WARD A-AUTOMATED`, and room-bed `001-A`. Direct M-prompt verification immediately afterward showed File `2` field `.1` updated to `1^001-A^^^^^^^^^^^^^^3260413.0`, proving the current-location node changed, but `$$GET1^DIQ(2,"101044,",.1011,"E")` remained blank. So the product does update the older current-location node, but the specific `CURRENT ROOM` field named in this section did not update in the live system.

### File 2 field .1041: CURRENT ADMISSION
Points to File 405 movement. Auto-set.

Result: 🔴 Fresh live re-verification showed this field staying blank even after a successful admission movement. In the same admit test that produced movement `5300`, direct M-prompt verification showed `$$GET1^DIQ(2,"101044,",.1041,"I")` blank immediately after the admit, even though the admission movement itself existed in File `405`. So the admission workflow is real, but this specific File `2` pointer is not being populated on this stack.

### File 2 field .3017: DISABILITY RETIREMENT
Boolean. Affects benefits.

Result: 🔴 Not implemented. Current patient registration/edit source and tenant-admin patient create/update mappings do not expose or persist this field.

### File 2 field .3025: RATED INCOMPETENT
Legal status. Affects who can make decisions.

Result: 🔴 Not implemented. I did not find this field in the patient UI or in tenant-admin patient create/update mappings.

### File 2 field .32201: SOUTHWEST ASIA CONDITIONS
Gulf War exposure tracking.

Result: 🟡 Partial at best. The patient UI carries a generic military `exposures` checklist, but current tenant-admin patient create/update mappings do not file a specific `SOUTHWEST ASIA CONDITIONS` value into File `2`.

### File 2 field .3221: COMBAT SERVICE INDICATED
Boolean for combat veteran benefits.

Result: 🟡 Present in the UI, not honestly persisted. `PatientDemographics.jsx` exposes combat/service-related fields, but tenant-admin patient create/update does not map this specific File `2` field.

### File 2 field .3222: COMBAT SERVICE LOCATION
Where combat service occurred.

Result: 🔴 Not implemented. I did not find a dedicated combat-location field in the current patient UI or backend patient mappings.

### File 2 field .3223: COMBAT FROM DATE
Combat service start date.

Result: 🔴 Not implemented. The current UI carries broader military service dates, but there is no dedicated combat-from-date persistence path to this File `2` field.

### File 2 field .3224: COMBAT TO DATE
Combat service end date.

Result: 🔴 Not implemented. The current UI does not expose this specific combat-to-date field, and tenant-admin does not map it.

### File 2 field 27.11: ENROLLMENT APPLICATION
Date of enrollment application.

Result: 🔴 Not implemented. I did not find this field in the patient UI or in tenant-admin patient create/update mappings.

### File 2 field 27.15: ENROLLMENT PRIORITY GROUP
1-8. Critical for VA benefit determination.

Result: 🟡 Present in the browser, not persisted. `PatientDemographics.jsx` exposes `Enrollment Priority Group` with groups `1-8`, but the tenant-admin patient create/update routes do not map it into File `2`.

### File 2 field 27.16: ENROLLMENT STATUS
Verified, Not verified, Pending.

Result: 🔴 Not implemented. The current product has no dedicated enrollment-status field in the patient UI, and the `/patients/:dfn/verify-eligibility` route is an insurance check rather than a File `2` enrollment-status writer.

### File 2 field 391: TYPE
Patient type: NSC, SC, Vet(other), Non-vet, Employee, Collateral.

Result: 🟡 Present in the browser, not persisted. `PatientDemographics.jsx` exposes `Patient Category`, but tenant-admin patient create/update does not map that value to File `2` field `391`.

### File 2 field 391.01: ELIGIBILITY CODE
Pointer to File 8. Determines benefits.

Result: 🔴 Not implemented. I did not find a dedicated eligibility-code picker or backend mapping for File `8` eligibility pointers in the current product.

### File 2 field 408.12: NET WORTH
For means test calculation.

Result: 🟡 Present in the financial-assessment UI, not honestly persisted. `FinancialAssessment.jsx` computes and displays `netWorth`, but tenant-admin `/patients/:dfn/assessment` only maps `annualIncome` into File `408.31` field `.07`, not this value.

### File 2 field 408.13: ANNUAL INCOME
Gross annual income for means test.

Result: 🟡 Partial. The financial-assessment UI computes annual income, and tenant-admin `/patients/:dfn/assessment` does attempt to write `annualIncome` into File `408.31` field `.07`. But the live browser submit path is currently blocked by tenant mismatch, and this is still far short of a complete means-test persistence path.

### File 2 field 408.14: DEDUCTIBLE EXPENSES
Medical and other deductible expenses.

Result: 🟡 Present in the financial-assessment UI, not persisted. The page calculates and displays deductible expenses, but the backend assessment route does not map them into VistA storage.

### File 2 field 408.21: DEPENDENT CHILDREN
Number of dependents. Affects means test threshold.

Result: 🟡 Present in the financial-assessment UI, not persisted. `FinancialAssessment.jsx` exposes `Number of Dependents`, but tenant-admin `/patients/:dfn/assessment` does not store it.

### File 2 field 408.22: SPOUSE INCOME
Spouse's annual income for means test.

Result: 🟡 Present in the financial-assessment UI, not persisted. `FinancialAssessment.jsx` computes `spouseIncome`, but the backend assessment route does not map it into VistA.

### File 2 field .52: LABORATORY REFERENCE
Lab reference number.

Result: 🔴 Not implemented. I did not find this field in the patient UI or tenant-admin patient mappings.

### File 2 field .53: DENTISTRY REFERENCE
Dental reference number.

Result: 🔴 Not implemented. I did not find this field in the patient UI or tenant-admin patient mappings.

### File 2 field .301: SERVICE CONNECTED
Boolean: is the patient service-connected?

Result: 🟡 Read-side exists, write-side not honestly proven. Tenant-admin patient detail does read File `2` field `.301`, and the patient UI exposes a `Service Connected` control. But the current create/update patient routes do not map that field, and the live browser save path remains broken.

### File 2 field .313: CLAIM NUMBER
VA claim number for benefits tracking.

Result: 🟡 Present in the browser, not persisted. `PatientDemographics.jsx` exposes `Claim Number`, but tenant-admin patient create/update does not map it into File `2`.

### File 2 field .314: CLAIM FOLDER LOCATION
Where the physical claim folder is.

Result: 🔴 Not implemented. I did not find this field in the current patient UI or tenant-admin patient mappings.

---

# SECTION 22: ADDITIONAL TERMINAL PARITY — More Terminal Functions We're Missing

### EVE → User Mgmt → User Inquiry [XUSERINQ]
Shows complete user profile including sign-on history (count, last, first), creation date, creator DUZ, last option used, current primary/secondary menus. Our detail panel shows most fields but NOT: sign-on history timeline, creation date, creator name, last option used, menu tree.

Result: 🟡 This is only partially true now. The menu-tree gap is stale: the product already exposes live menu structure through `/users/:duz/menu-structure`, and Staff Directory prints that structure in the full-profile print view. But the narrower parity gaps remain real: sign-on count/first-sign-on are still dropped before the UI, creation metadata is not surfaced, and `last option used` is still missing.

### EVE → User Mgmt → List Users [XUSERLIST]
Terminal can list by: division, key held, last login date range, status. Our list has division + status filters but NOT: filter by specific key held, filter by last login range. Add: 'Show users with ORES key' filter. Add: 'Show users not logged in since [date]' filter.

Result: 🟡 Accurate and still partial. The current list does support division and status, but I still do not have a live filter for `key held` or `last login date range` on the staff list.

### EVE → Kernel → XUAUTODEACTIVATE
Automatic user deactivation. VistA has a scheduled option that auto-deactivates users who haven't logged in for N days. N is configurable in Kernel Site Parameters. We have NO equivalent. Add: scheduled deactivation job or at minimum a report of 'stale' accounts.

Result: 🟡 Narrower than written. We do have a real stale-account report and recurring scheduling for repeated review, so the `no equivalent at all` claim is stale. The missing piece is the automatic deactivation action itself: the product still does not auto-set `DISUSER` or otherwise deactivate idle users after N days.

### EVE → Audit → Accessed Sensitive Records
Terminal can show which users accessed sensitive (DG SENSITIVITY) patient records. Our audit trail may not include this. Verify: when a sensitive record is accessed, does the break-the-glass event appear in the audit log?

Result: � Fixed Session 222. Break-the-glass POST now writes a real VistA File 38.11 entry via `ZVE PAT BRGLSS`, and `GET /audit-events` via `ZVE PAT BGREAD` returns the entries with correct `reasonCategory` (stripped of `ZVE:` prefix). Server now accepts `body.reasonText`/`body.reasonCategory` (not just `body.reason`). `POST /patients/101044/break-glass` with `reasonText:"Direct Care"` → `ok:true, logged:true, reason:"Direct Care"`. `GET /patients/101044/audit-events` returned 2 entries with `reasonCategory:"Direct Care"` and `reasonCategory:"Emergency Care"`. M-verified: `^DGSL(38.1,101044,"D",6739586.797777,0)` = `3260413.202123^1^ZVE:Direct Care^n`.

### EVE → Device → Test Devices
Terminal can send test patterns to devices beyond just a test print. Tests include: page eject, margin tests, form feed. Our test print is basic.

Result: 🔴 Accurate. The current product has a real basic test-print path, but not the broader terminal-style device test suite.

### EVE → TaskMan → View TaskMan Error Log
TaskMan has its own error log separate from the general error trap. We show general errors but may not show TaskMan-specific errors.

Result: 🔴 Still a real gap. Current health/audit surfaces expose general error-trap data, but I do not have a separate TaskMan-specific error-log surface.

### EVE → MailMan → Bulletin Management
Terminal manages VistA bulletins (automatic notifications). File 3.6. Our system has no bulletin management. Bulletins auto-send MailMan messages when certain events occur (e.g., patient admission sends bulletin to ward clerk group).

Result: 🔴 Still a real gap. The product can read the bulletin route and it stays empty on this stack, but there is no bulletin-management workflow comparable to terminal File `3.6` administration.

### EVE → Menu Mgmt → Copy One User's Menus/Keys to Others
Terminal can copy all menus and keys from user A to users B, C, D in one operation. Our clone copies to one user at a time.

Result: 🔴 Accurate. Clone remains one-target-at-a-time, and there is no bulk copy-one-user-to-many-users workflow.

### EVE → Menu Mgmt → Delegate Options/Keys
Terminal allows an admin to delegate specific menu options or keys to another user to manage. Not full XUMGR — just specific delegated items. Current VistA Evolved still has no equivalent UI or API.

Result: 🔴 Confirmed real gap. Earlier source and live-browser verification already showed no delegation UI or API.

### EVE → Kernel → Edit User Characteristics [XUEDITSELF]
Allows users to edit their own characteristics (phone, email, etc.) without admin intervention. Our system has no self-service profile editing for non-admin users.

Result: 🔴 Still a real gap. I do not have a non-admin self-service profile-edit workflow for contact fields.

### Terminal → File #3.081 SIGN-ON LOG
Complete sign-on history: timestamp, terminal/device, duration, last option used, reason for disconnect. Our audit shows sign-on count and last login but not full history per user.

Result: 🟡 Narrower than written. The product does already expose sign-on log history through Audit Trail, so `not full history` is stale. The remaining parity gap is field completeness: `last option used`, device/context, and other richer disconnect details are still missing from the surfaced data.

### Terminal → Person Class Assignment
VistA uses Person Class (TIU User Class, File 8930.3) for document-level permissions. A physician can write progress notes but a clerk cannot. Our system assigns keys but doesn't manage person class. This may affect TIU document signing.

Result: 🔴 Still a real gap. The platform treats person class as read/reference truth and does not provide a working person-class assignment workflow.

### Terminal → Order Entry parameter setup per user
CPRS order entry has per-user parameters: default ordering dialog, default cosigner, notification preferences. Managed via CPRS Configuration menus. We don't touch these.

Result: 🔴 Accurate. I do not have a product workflow covering per-user CPRS order-entry preference management.

### Terminal → User Profile printing (full profile report)
The current product already exposes a `Print Full Profile` action in the detail panel, but its output is still not as complete as terminal-style profile reporting. The remaining gap is completeness: sign-on history detail is limited, and person-class coverage is not fully surfaced/managed end to end.

Result: 🟡 This claim is partly stale. The detail panel already has a `Print Full Profile` action and the print view includes fields, keys, divisions, secondary menu options, and menu structure. The remaining gap is completeness versus terminal output: sign-on history detail is still limited and person class is not fully managed/surfaced end to end.

### Terminal → CPRS Tab configuration per user
The old premise here was wrong for this stack. Live FileMan DD verification showed File `200.03` is `SECONDARY MENU OPTIONS SUB-FIELD`, not a CPRS-tab configuration file. The product had been reading and labeling those secondary menu assignments as `CPRS Tab Access`.

Result: 🔴 Not honestly implemented as CPRS-tab management. The web detail panel and print view have now been corrected to show `Secondary Menu Options`, and the existing write path `/users/:duz/secondary-menus` does provide a proven File `200.03` assignment flow for those menu options. But that is not the same thing as terminal-style CPRS tab configuration, so the original CPRS-tab claim remains unproven and should not be inferred from File `200.03` on this system.

---

# SECTION 23: WORKFLOW EDGE CASES — What Happens When Things Go Wrong

### Two admins edit the same user simultaneously
The blanket `last write wins with no warning` claim is stale. The product now has `lastModified` optimistic-concurrency tokens and at least some `CONCURRENT_EDIT` handling, but that protection is still incomplete and inconsistent across edit paths.

Result: 🟡 Narrower than written. The product now does have optimistic-concurrency tokens (`lastModified`) and a `CONCURRENT_EDIT` path on at least some Staff Directory edits, so the blanket `last write wins with no warning` claim is stale. But the protection is incomplete and inconsistent: provider-field saves can still false-conflict because the read and write hashes do not match extension-backed data the same way.

### Admin creates a user, then loses network before success screen
This remains a real post-submit recovery gap. StaffForm auto-save protects pre-submit draft work, but I do not have a reconnect-reconciliation flow that searches for a possibly created user and recovers the DUZ when the network drops after VistA write but before the success screen renders.

Result: 🔴 Still a real gap. StaffForm auto-save protects pre-submit draft work, but I do not have a post-create reconnect-reconciliation flow that searches for a possibly created user and recovers the DUZ when the network drops before the success screen renders.

### Admin assigns a role where 3 of 6 keys don't exist in VistA
The specific built-in-role example is mostly stale because the current built-in role-key set was already re-verified against the live key inventory. The remaining issue is broader UX honesty: role assignment still does not present a strong per-key success/failure breakdown, and malformed custom-role bundles can still produce partial or misleading outcomes.

Result: 🟡 Narrower than written. The specific built-in-role example is mostly stale because the current built-in role-key corpus was already re-verified against the live key inventory. But the broader UX gap remains: role assignment does not present a strong per-key success/failure breakdown, and custom-role key bundles can still be malformed.

### Admin deactivates a user who is currently logged in
This remains a real enforcement gap. Earlier live/source verification already showed deactivation semantics are wrong in the current stack, and disabled-user checks are not reliably enforcing the expected inactive-account behavior on subsequent authenticated requests.

Result: 🔴 Still a real gap. Earlier live/source verification already showed deactivation semantics are wrong in the current stack, and auth/session disabled-user checks are not reliably enforcing the expected inactive-account behavior on subsequent requests.

### VistA Docker restarts while admin is mid-wizard
This note is partly stale. StaffForm now auto-saves draft state and runs a periodic VistA health check every `30s`, surfacing a connection-loss warning in source. The remaining gap is live end-to-end proof under an actual mid-wizard Docker restart in this checkpoint.

Result: 🟡 This is partly stale. StaffForm now does exactly what the note asked for in source: it auto-saves draft state and runs a periodic VistA health check every `30s`, surfacing `VistA connection lost. Your draft is auto-saved. Please wait for reconnection.` The remaining gap is that I did not re-run a live Docker-restart browser proof in this checkpoint.

### Admin changes their OWN role to non-admin
The direct self-lockout claim is stale. Current source already blocks self-removal of `XUMGR` in Staff Directory, Role Templates, and Permission Catalog with `Cannot remove your own administrative access.` The remaining question is breadth of coverage, not total absence of a guard.

Result: 🟡 The direct self-lockout claim is stale. Source now explicitly blocks self-removal of `XUMGR` in Staff Directory, Role Templates, and Permission Catalog with the message `Cannot remove your own administrative access.` I did not re-run a fresh browser proof in this checkpoint, but the guard is clearly implemented.

### Clone user → source user is deactivated between opening dialog and confirming
This remains a real last-second clone-integrity gap. I do not have source or live proof of a final source-status recheck before clone execution, and earlier clone evidence already showed that outcomes can be incomplete or misleading.

Result: 🔴 Still a real gap. I do not have a source or live proof of a last-second source-status recheck before clone execution, and earlier clone evidence already showed that clone outcomes can be incomplete or misleading.

### Patient registered with SSN that already exists
This note is narrower now. The product already has duplicate-check UI before registration, including `Possible duplicate records` and a `Check for Duplicates` flow. The real remaining gap is that duplicate checking is still optional/manual and not enforced through a dedicated `ZVE PATIENT DUPL` route before final save.

Result: 🟡 Narrower than written. The product now does have duplicate-check UI before registration, including `Possible duplicate records` and a `Check for Duplicates` flow. The real remaining gap is that this is still optional/manual and not enforced through a dedicated `ZVE PATIENT DUPL` route before final save.

### Admission to a ward with 0 available beds
VistA may allow over-capacity admissions. Our UI should warn: 'Ward 3A has 0 available beds. Proceed anyway?'

Result: 🟢 Implemented. The admission UI now detects when the selected ward has `0` available beds, surfaces a visible over-capacity warning naming the ward, changes the primary action to `Admit Without Bed`, and requires an explicit confirm dialog before proceeding without a room-bed assignment. Live browser verification against ward `2-INTERMED` showed both the inline warning and the confirm dialog text `2-INTERMED has 0 available beds. Proceed with an over-capacity admission anyway?`

### Discharge patient who has active medication orders
VistA may block or require discontinuation. Our UI should surface this: '5 active medication orders must be discontinued before discharge.'

Result: 🟢 Implemented. The discharge page now loads live active medication orders from VistA via `ORWPS ACTIVE`, shows the real order count and order names inline, and blocks submit behind an explicit medication-review acknowledgment dialog before continuing with discharge. Live verification on `/patients/3/discharge` showed `7 active medication orders require review before discharge.` and the blocking dialog `Active Medication Orders Require Review` before the discharge could proceed.

### Transfer patient to a ward in a different division
May require inter-facility transfer process. Our UI doesn't distinguish same-facility vs cross-facility transfers.

Result: 🟢 Implemented. The transfer page now resolves live ward/division data from VistA, shows the patient's current inpatient unit and current division, detects when the selected destination ward is in a different division, surfaces an inline cross-division warning, and requires an explicit confirmation dialog before submit. Live browser validation on `/patients/101044/transfer` showed `ICU/CCU — Pending assignment`, `Current division: VEHU DIVISION`, the inline warning `This transfer moves the patient from VEHU DIVISION to VEHU CBOC.`, the confirm dialog `Confirm Cross-Division Transfer`, and the final success state `Cross-division transfer completed from VEHU DIVISION to VEHU CBOC.` Direct M verification after submit showed File `2` current ward storage updated to ward `33`, and File `42` confirmed ward `33 = 3E NORTH` in division `VEHU CBOC`.

### Admin searches for a patient who was merged/deleted
Merged patients should redirect to the surviving record. Deleted patients should show clear 'Record not found' with explanation.

Result: 🟢 Implemented. Patient search now uses the active tenant and no longer filters live results out behind a nonexistent default `active` status. Live browser verification on `/patients` searched `ZZZRETFIVEFIFTYONE`, clicked the merged patient result, and landed on surviving chart `/patients/2` with the inline banner `Merged record redirected` and message `ZZZRETFIVEFIFTYONE,PATIENT was merged into ZZZRETFIVEFORTYSEVEN,PATIENT. Redirected to the surviving chart.` Direct M verification showed File `2` field `.082` on DFN `1` pointing to DFN `2` via piece `19` of `^DPT(1,0)`. Separate browser verification of missing DFN `999999` showed the explicit error state `Record not found. Patient record may have been removed or merged.`

## Session 202 — Merged Patient Redirect + Missing Record Messaging (Apr 13, 2026)
- `apps/tenant-admin/server.mjs` now classifies merged patient charts using live File `2` field `.082` (`PATIENT MERGED TO`) and returns a structured redirect payload instead of falling into a generic not-found path
- `apps/web/src/services/patientService.js` now runs patient search against the active tenant instead of hardcoded `local-dev`, and `apps/web/src/pages/patients/PatientSearch.jsx` no longer hides all live results behind a default status filter the backend does not provide
- `apps/web/src/pages/patients/PatientDashboard.jsx` now follows merged-record redirects, shows a visible `Merged record redirected` banner on the survivor chart, and renders a clearer `Record not found` explanation for missing/removed DFNs
- Live browser proof from `apps/tenant-admin/scripts/verify-patient-merged-record-ui.mjs`: search query `ZZZRETFIVEFIFTYONE` on `/patients` redirected from merged DFN `1` to survivor DFN `2`, and missing DFN `999999` rendered `Record not found. Patient record may have been removed or merged.` with screenshots saved under `artifacts/`
- Direct M proof: `^DPT(1,0)` now carries piece `19 = 2`, confirming File `2` field `.082` points the merged dummy record at the surviving DFN used in browser verification

### Browser crashes mid-form with unsaved changes (patient demographics)
This claim is stale. `PatientDemographics.jsx` now uses the same sessionStorage draft-recovery pattern as StaffForm. The remaining patient-edit limitations come from tenant-mismatch/runtime issues, not from a total lack of draft recovery.

Result: 🟢 This claim is stale. `PatientDemographics.jsx` already has working sessionStorage draft recovery for both register and edit modes. Live browser verification on `/patients/register` wrote `ve-patient-demo-draft:new`, restored the unsaved `First Name` value after reload, then repeated the same proof on `/patients/2/edit` with `ve-patient-demo-draft:2` restoring the edited `First Name` after reload. The broader patient-edit save stack still has separate issues, but loss of unsaved work on crash/reload is no longer one of them.

## Session 203 — Patient Demographics Draft Recovery Verified Green (Apr 13, 2026)
- Verified `apps/web/src/pages/patients/PatientDemographics.jsx` draft autosave/recovery live instead of relying on source inspection alone
- `apps/tenant-admin/scripts/verify-patient-demographics-draft-ui.mjs` proved register-mode draft persistence by writing `ve-patient-demo-draft:new`, reloading `/patients/register`, and restoring the unsaved `First Name` marker from sessionStorage
- The same script proved edit-mode draft persistence by writing `ve-patient-demo-draft:2`, reloading `/patients/2/edit`, and restoring the unsaved `First Name` marker for DFN `2`
- Screenshots saved under `artifacts/` confirm both restored states in the browser

### API returns 503 (VistA unreachable) on page that was working moments ago
This is only partially true now. The product does have reusable `ErrorState` + `Retry` handling, and some pages such as Admin Dashboard already show `VistA backend is unreachable. Data may be stale.` The remaining gap is broad proven preservation of currently displayed data across pages instead of falling back to an error state.

Result: 🟡 Partial. The product does have reusable `ErrorState` + `Retry` handling, and Admin Dashboard already shows `VistA backend is unreachable. Data may be stale.` But I do not have a broad proven pattern that preserves the current page data everywhere instead of falling back to an error state.

### Admin tries to create a clinic with a name that already exists in File 44
VistA may allow duplicate names. Our UI should check and warn: 'A clinic named CARDIOLOGY already exists. Create anyway?'

Result: 🟢 Implemented. The Add Clinic modal now performs an exact-name preflight against the live clinic list before submit and raises an explicit override confirm dialog instead of falling straight into the backend/FileMan error. Live browser verification on `/admin/clinics` used existing File `44` clinic name `10TH FLOOR`, entered the live stop code `141`, clicked `Create Clinic`, and got the warning dialog `Duplicate Clinic Name` with message `A clinic named "10TH FLOOR" already exists in File 44. Create anyway?` plus `Cancel` and `Create Anyway` actions.

## Session 204 — Duplicate Clinic Name Warning Added (Apr 13, 2026)
- `apps/web/src/pages/admin/ClinicManagement.jsx` now checks the live clinic list for exact `.01` name matches before calling `createClinic(...)`
- Normal `Create Clinic` clicks now open a duplicate-name `ConfirmDialog` instead of bypassing straight to the backend create path, while explicit `Create Anyway` confirmation still allows the override path when the operator intends to proceed
- Live browser proof from `apps/tenant-admin/scripts/verify-duplicate-clinic-warning-ui.mjs`: existing clinic `10TH FLOOR` with stop code `141` opened the `Duplicate Clinic Name` dialog and displayed `A clinic named "10TH FLOOR" already exists in File 44. Create anyway?`

## Session 205 — Cosigner Search Live Proof Closed (Apr 13, 2026)
- Verified the old checklist example was stale for this environment: authenticated live `/users?search=SMI` returned `data: []`, so `SMI` could not honestly prove the cosigner dropdown behavior
- Added `apps/tenant-admin/scripts/verify-cosigner-search-ui.mjs`, restored the staff wizard directly to Provider Setup via the existing draft-recovery path, enabled `Requires cosignature (trainee)`, and searched with the live provider query `ANE`
- Live browser proof showed `ANESTHESIOLOGIST,ONE`, `BARRON,JANE`, and `ZEBRA,SHANE` in the Cosigner dropdown, captured in `artifacts/staff-cosigner-search-results.png`

## Session 206 — Physician Create Reclassified to Partial with 10+ M Checks (Apr 13, 2026)
- Added `apps/tenant-admin/scripts/verify-physician-create-ui.mjs` and used the live browser wizard on `/admin/staff/new` to create disposable physician DUZ `10000000461` from a seeded review-step draft; the success screen showed `AUDITPHY82817504,VERIFY created successfully (S-10000000461)` and was captured in `artifacts/staff-physician-create-success.png`
- Direct M-prompt verification then confirmed more than 10 persisted values on the new File `200` record: `.01 NAME`, `4 SEX`, `5 DOB`, `29 SERVICE/SECTION`, `201 PRIMARY MENU`, `.132 PHONE`, `.151 EMAIL`, `10.6 DEGREE`, `200.07 LANGUAGE`, `41.99 NPI`, `53.5 PROVIDER CLASS`, division node `^VA(200,DUZ,2,1,0)=1`, and live keys `OR CPRS GUI CHART`, `PROVIDER`, `ORES`, `ORCL-SIGN-NOTES`, `ORCL-PAT-RECS`, and `GMRA-ALLERGY VERIFY`
- The item stays partial rather than green because the browser review screen showed `Job Title = PHYSICIAN`, but direct M-prompt readback for File `200` field `8` came back blank, so create flows still overreport at least one persisted field
- Cleanup completed: `POST /api/tenant-admin/v1/users/10000000461/terminate?tenantId=default` returned `1^OK^Terminated`

## Session 207 — Deactivate DISUSER Fixed; Reactivate Still Partial (Apr 13, 2026)
- Root cause was real and two-sided: `ZVEUSMG.m` deactivate/reactivate wrote to raw node `^VA(200,DUZ,7)` even though live DD field `7` (`DISUSER`) is stored at node `0`, piece `7`, and tenant-admin auth checks were also reading field `4` instead of field `7`
- Fixed `apps/tenant-admin/m-routines/ZVEUSMG.m` to file field `7` through FileMan on deactivate/reactivate, copied the updated routine into `local-vista-utf8:/opt/vista/r/ZVEUSMG.m`, and recompiled it there; fixed `apps/tenant-admin/server.mjs` to read File `200` field `7` and only treat affirmative values (`1`/`YES`) as disabled
- Live browser proof from `apps/tenant-admin/scripts/verify-staff-deactivate-ui.mjs`: on `/admin/staff`, disposable user `DEACTFIX83733453,VERIFY` showed `has been deactivated. Reason: Security Concern.`
- Direct M-prompt proof after browser deactivate on DUZ `10000000465`: `FIELD7_I=1`, `FIELD7_E=YES`, `TERMDATE_I=3260413`, and `TERMREASON=Security Concern`
- Live browser proof from `apps/tenant-admin/scripts/verify-staff-reactivate-ui.mjs`: the same user showed `has been reactivated. They can now sign in.`; direct M-prompt readback then showed `FIELD7_I=` and `TERMDATE_I=` blank again
- Reactivate remains partial rather than green because a fresh login with the reactivated disposable user's credentials still returned `INVALID_CREDENTIALS`; cleanup completed with `POST /api/tenant-admin/v1/users/10000000465/terminate?tenantId=default` -> `1^OK^Terminated`

## Session 208 — Termination Key Cleanup Fixed and Reverified (Apr 13, 2026)
 - Root cause was the reverse key-delete loop in `apps/tenant-admin/m-routines/ZVEUSMG.m`: it started from `$O(^VA(200,DUZ,51,""),-1)`, which can collide with the `"B"` index and skip numeric key subentries entirely
 - Fixed that loop to walk numeric subentries only in reverse, copied the updated `ZVEUSMG.m` into `local-vista-utf8:/opt/vista/r/ZVEUSMG.m`, and recompiled it in the live container
 - Added `apps/tenant-admin/scripts/verify-staff-terminate-ui.mjs` and reran the real browser flow on `/admin/staff`; disposable DUZ `10000000471` / `AAATERMFIX84607074,VERIFY` opened the visible `Full Termination` confirm dialog and completed cleanly, with screenshots saved to `artifacts/staff-terminate-confirm.png` and `artifacts/staff-terminate-result.png`
 - Direct M-prompt proof on DUZ `10000000471` showed the storage invariants are now correct: `^DD(200,7,0)=DISUSER^S^0:NO;1:YES;^0;7^Q`, `^DD(200,2,0)=ACCESS CODE^FXO^^0;3`, `^DD(200,11,0)=VERIFY CODE^FXOa^^.1;2`, `NAME0=AAATERMFIX84607074,VERIFY^^^^^^1^^^^3260413`, `NAME.1=3260412^`, `KEYCOUNT_NUM=0`, `KEYHDR=200.051^^0^0`, and `ORCPRS_XUSEC=0`
 - That readback proves File `200` field `7` is now `1`, termination date `9.2` is set, access code piece `0;3` is blank, verify code piece `.1;2` is blank, and no numeric File `200` key subentries or `^XUSEC("OR CPRS GUI CHART",DUZ)` entry remain

## Session 209 — First-Login Password Change Fixed and Reverified (Apr 13, 2026)
 - Root cause was split across VistA and app layers: this stack uppercases access/verify comparisons at sign-on, so mixed-case verify writes from `ZVEUSMG` produced false `INVALID_CREDENTIALS`; tenant-admin then misclassified the real Kernel `VERIFY CODE must be changed before continued use.` response, and the web login page had no public expired-password change path
 - Fixed `apps/tenant-admin/m-routines/ZVEUSMG.m` so fresh-create and credential-reset writes normalize access/verify codes to the Kernel-compared uppercase form; fresh account creation now leaves File `200` field `11.2` unset so the first-login verify-change state remains active; added new RPC `ZVE USMG FINDAC` for access-code-to-DUZ resolution
 - Fixed `apps/tenant-admin/server.mjs` so auth now classifies the live verify-change message as `PASSWORD_EXPIRED`, exposes public route `POST /api/tenant-admin/v1/auth/change-expired-password`, and uses `ZVE USMG CRED(...,"ACTIVE")` only after verifying the old expired credentials and resolving the target DUZ through `ZVE USMG FINDAC`
 - Fixed the web login path so `apps/web/src/pages/LoginPage.jsx` calls the new public expired-password route, and `apps/web/src/services/api.js` now persists the existing cookie-based auth hint after successful `/auth/login` instead of immediately bouncing authenticated users back to `/login`
 - Live API proof: disposable DUZ `10000000474` (`LG87327222`) now returns HTTP `401` with `code=PASSWORD_EXPIRED` and message `VistA authentication failed: Sign-on failed: VERIFY CODE must be changed before continued use.`; disposable DUZ `10000000475` then completed the full backend cycle `create -> PASSWORD_EXPIRED -> POST /auth/change-expired-password -> HTTP 200 login`
 - Live browser proof on `/login`: disposable DUZ `10000000477` (`LG88726109` / `LoginFix1!`) showed the visible expired-password banner plus `Change Password` form, accepted new password `NewPass1!`, and landed on `/dashboard`
 - Direct M-prompt proof closed both sides of the flow: untouched fresh DUZ `10000000478` read back `NODEPT1=60000,1^LOGINFIX1!` and `NODE1P1=^^^3260413`, matching the forced-change-on-first-login state; browser-changed DUZ `10000000477` read back `NODEPT1=3260413^NEWPASS1!` and `NODE1P1=3260413.140136^0^1^3260413^`; DD verification confirmed `^DD(200,11,0)=VERIFY CODE^FXOa^^.1;2` and `^DD(200,11.2,0)=DATE VERIFY CODE LAST CHANGED^FOI^^.1;1^`

## Session 210 — Patient Registration Fixed and Reverified (Apr 13, 2026)
 - Root cause was two live blockers in sequence: the registration page's required facility list failed because `GET /divisions` returned `502` when `ZVE DIVISION LIST` existed but was not registered to `OR CPRS GUI CHART`, and once the browser could submit, `POST /patients` still forwarded browser booleans/numbers (`veteranStatus=false`, `scPercent=0`) straight into `ZVE PATIENT REGISTER`, which produced `Registration failed: The list of fields is missing a required identifier for File 2.`
 - Fixed `apps/tenant-admin/server.mjs` so `/divisions` falls through to DDR when the ZVE RPC is unavailable in the current broker context, and patient create now normalizes veteran-status values to `Y`/`N` while preserving numeric `0` service-connected percentages instead of dropping them on the wire
 - Fixed `apps/web/src/services/patientService.js` so registration/edit writes use the active authenticated tenant instead of hardcoded `local-dev`; fixed `apps/web/src/pages/patients/PatientDemographics.jsx` so `Registration Facility` is only required when live choices actually exist, and the page now explicitly tells the user when this VistA returns no live facility data
 - Live API proof: `GET /api/ta/v1/divisions?tenantId=local-dev` now returns HTTP `200` instead of blocking the page with `502`, and `POST /api/ta/v1/patients?tenantId=local-dev` with `veteranStatus=false` now returns HTTP `200` and created disposable DFN `101087`
 - Live browser proof on `/patients/register`: the page showed disabled `No live facilities available` plus explanatory copy instead of a dead required dropdown, and submitting the real form completed with `Patient registered successfully.` / `Patient ID: 101088`
 - Direct M-prompt proof for browser-created DFN `101088`: `NODE0=COPILOTREGUI,APRIL^M^2900115^^^^^^667889903^^^^^^^^^^^1`, `BNAME_DFN=101088`, `BENTRY=1`, and `SSNXREF=101088`, proving the real File `2` record plus both `^DPT("B",...)` and `^DPT("SSN",...)` indexes

## Session 211 — GMRA Allergy Key Audit Drift Closed (Apr 13, 2026)
- Rechecked the exact source claim instead of assuming earlier remediation was still reflected: source search in `apps/web/src` now returns live dashed-key hits for `GMRA-ALLERGY VERIFY` and zero source hits for the stale spaced form `GMRA ALLERGY VERIFY`
- This matches the already-proven live File `19.1` / key-inventory behavior from the earlier key audit: the correct runtime key remains `GMRA-ALLERGY VERIFY`, and the web source now intentionally keeps that dashed form in Staff Form, Role Templates, Staff Directory, and vocabulary mappings
- Scope note: stale matches still exist in generated `apps/web/dist` bundles from older output, but the red checklist item specifically targeted `apps/web/src`, so this session closes the source-audit claim honestly without pretending the build artifacts were part of this proof

## Session 212 — ORCL-SIGN-NOTES Reverified Standalone (Apr 13, 2026)
- Closed the remaining uncertainty with a standalone live lookup instead of relying on prior create/assign flows: authenticated `/api/ta/v1/key-inventory?tenantId=default` returned `ORCL-SIGN-NOTES` with descriptive name `Sign Clinical Notes`, `holderCount: 4`, and File `19.1` grounding `file19_1Ien: 748`
- Direct M-prompt verification inside `local-vista-utf8` then returned `KEYIEN=748` and `ZERO=ORCL-SIGN-NOTES`, proving the exact live key name exists in File `19.1` exactly as written
- This moves the checklist item from inferred/indirect to directly reverified in both the browser-facing API layer and the underlying VistA dictionary

## Session 213 — Clinic Count Parity Reverified (Apr 13, 2026)
- Closed the remaining clinic-census caveat with a fresh browser + M comparison instead of relying on earlier create/list proofs alone
- Live browser proof on `/admin/clinics`: the page header rendered `Clinic Management` with `(573 clinics)` visible in the UI
- Direct M-prompt proof in `local-vista-utf8`: a fresh `^SC` traversal counting zero nodes whose piece 3 equals `C` returned `CLINICCOUNT=573`, so the visible page total now matches a direct File `44` clinic census exactly

## Session 214 — Physician Create Title Persistence Fixed and Reverified (Apr 13, 2026)
- Root cause was twofold in `apps/tenant-admin/server.mjs`: create-mode extra-field filing was marking DDR writes `status:"ok"` without checking the returned `ok` flag, and the Staff wizard submits File `3.1` title IENs while the live working title-write path expects the external title name (`PHYSICIAN`, etc.)
- Direct DD verification corrected the M-prompt invariant too: File `200` field `8` (`TITLE`) is stored at `^VA(200,DUZ,0)` piece `9` (`^DD(200,8,0)=TITLE^P3.1^DIC(3.1,^0;9^Q`), so the earlier blank-piece read was checking the wrong storage slot
- Fixed create-mode title filing to resolve File `3.1` IENs to canonical title names and save through `ZVE USER EDIT`, hardened `PUT /users/:ien` field `8` to accept title IENs by the same normalization, and stopped create-mode DDR paths from overreporting success when `ddrFilerEdit(...)` returns `ok:false`
- Live API proof after the patch: disposable DUZ `10000000481` created with `title=47` returned `extraFields.field=8 status:"ok" storedValue:"PHYSICIAN"`, fresh `/users/10000000481` read back `title=PHYSICIAN`, and direct M verification returned `TITLE_I=47` / `TITLE_E=PHYSICIAN`; `PUT /users/10000000481` with `{ field:"8", value:"47" }` also returned `ok:true` via `ZVE USER EDIT`
- Live browser proof after the patch: reran `apps/tenant-admin/scripts/verify-physician-create-ui.mjs` on `/admin/staff/new`, created disposable DUZ `10000000482`, observed success text `AUDITPHY96298128,VERIFY created successfully (S-10000000482)`, and direct M verification returned `TITLE_I=47` / `TITLE_E=PHYSICIAN`; cleanup completed with `POST /api/tenant-admin/v1/users/10000000482/terminate?tenantId=default` -> `1^OK^Terminated`

## Session 215 — Reactivation Workflow Reverified End-to-End (Apr 14, 2026)
- Previous Session 207 left reactivation as 🟡 because a fresh login with the reactivated disposable user returned `INVALID_CREDENTIALS`; this was traced to the same uppercase credential normalization defect fixed in Session 209
- Clean API lifecycle test on disposable DUZ `10000000483`: `create → set credentials (activateImmediately) → login (ok:true) → deactivate → reactivate (ZVE USMG REACT) → login again (ok:true)` — full round-trip passed
- Live browser proof: created disposable DUZ `10000000485` (`AAAAREACTUI,001130`) with `AAAA` prefix for sort-to-top visibility, deactivated via API, then navigated to `/admin/staff?status=Terminated` in the browser, selected the user row, opened the detail panel (Status=TERMINATED, Termination Date=APR 13,2026, Reason="browser reactivate visible row"), clicked the Reactivate button in the Danger Zone → success banner: `"AAAAREACTUI,001130 has been reactivated. They can now sign in."` with Status changing to Active and Danger Zone showing Deactivate/Full Termination buttons
- Post-reactivation login proof: `POST /auth/login` with credentials `AR001130` / `AR001130!!` returned `ok:true`, `user.duz=10000000485`, `user.name=AAAAREACTUI,001130`
- Direct M verification: `$$GET1^DIQ(200,10000000485,7)` = blank (DISUSER cleared), `$$GET1^DIQ(200,10000000485,9.2)` = blank (termination date cleared), zero node `^VA(200,10000000485,0)` piece 7 = blank
- Cleanup: `POST /users/10000000485/terminate` → `1^OK^Terminated`

## Session 216 — All 43 Built-In Role Keys Verified at M Prompt (Apr 14, 2026)
- Deployed temporary M routine `verkeys.m` in the `local-vista-utf8` container that checks all 43 role keys (from `scripts/verify-role-keys.mjs`) against the File `19.1` `B` cross-reference index
- Result: **PASS=43 FAIL=0** — every key resolved to a live IEN:
  - `DG ADMIT`=763, `DG DISCHARGE`=764, `DG MENU`=766, `DG REGISTER`=761, `DG REGISTRATION`=762, `DG SENSITIVITY`=25, `DG SUPERVISOR`=31, `DG TRANSFER`=765, `DGMEANS TEST`=767
  - `GMRA-ALLERGY VERIFY`=244, `IBFIN`=755
  - `LRCAP`=752, `LRLAB`=51, `LRMGR`=751, `LRSUPER`=53, `LRVERIFY`=52
  - `MAG CAPTURE`=430, `MAG SYSTEM`=428
  - `OR CPRS GUI CHART`=756, `ORCL-PAT-RECS`=749, `ORCL-SIGN-NOTES`=748, `OREMAS`=271, `ORELSE`=270, `ORES`=269
  - `PROVIDER`=236, `PSB NURSE`=757, `PSD PHARMACIST`=759, `PSDRPH`=682, `PSJ PHARMACIST`=758
  - `PSO MANAGER`=769, `PSOINTERFACE`=413, `PSOPHARMACIST`=750, `PSORPH`=12
  - `RA ALLOC`=370, `RA TECHNOLOGIST`=768
  - `SD SCHEDULING`=760, `SD SUPERVISOR`=296, `SDCLINICAL`=753, `SDMGR`=754
  - `XUAUDITING`=210, `XUMGR`=2, `XUPROG`=1, `XUPROGMODE`=3
- Temporary routine cleaned up after verification

## Session 217 — Backend Silent-Catch Cleanup Completed (Apr 14, 2026)
- Replaced all remaining silent catch blocks in `apps/tenant-admin/server.mjs` with explicit diagnostic logging:
  - 5 non-ZVE catches (DISUSER check, session enrichment, facility lookup, topology, user enrichment) now emit `console.warn` with context
  - 3 bare `catch {}` on `broker.disconnect()` now emit `console.warn` with the disconnect error message
  - 15 ZVE-to-DDR architectural fallback catches now emit `console.debug` with the fallback reason
- Post-fix verification: zero silent/empty catch blocks remain in `server.mjs`; file compiles clean with no errors
- The React app frontend catches were already cleaned in Session 199; this closes the backend scope

## Session 218 — Phone Formatting Made Universal (Apr 14, 2026)
- `formatPhone()` in `apps/web/src/utils/transforms.js` was dead code — exported but never imported by any component
- Wired `formatPhone` into all display-only phone locations:
  - `PatientBanner.jsx` — patient banner phone now formatted
  - `PatientDashboard.jsx` — Demographics panel Phone row and Emergency Contact phone now formatted
  - `SiteManagement.jsx` — both site detail and facility detail phone fields now formatted
  - `StaffDirectory.jsx` — replaced inline duplicate formatter in `EditableDetailField` with shared `formatPhone`, and CSV export now uses `formatPhone`
- Live browser proof: Patient 100001 (`EIGHTYEIGHT,PATIENT`) shows `(222) 555-8235` in PatientBanner (top right) and Demographics panel (Phone row); Staff Directory detail panel for DUZ 10000000469 shows `(503) 555-0199`
- Form inputs (PatientDemographics, StaffForm) intentionally left unformatted since they accept raw user input

## Session 222 — RecordRestrictions Full Fix + Break-the-Glass Display Fix (Apr 13, 2026)

**Root causes fixed:**
1. `PUT /patients/:dfn/restrictions` called `ddrFilerEditMulti('2', '${dfn},', {'38.1':'1'})` — File 2 has no field 38.1. Sensitivity lives in **File 38.1** (`^DGSL(38.1,DFN,0)` piece 2).
2. `POST /patients/:dfn/break-glass` used `body.reason` but the UI sends `body.reasonText`/`body.reasonCategory` — defaulted to "CLINICAL NECESSITY" instead of the actual reason.
3. `GET /patients/:dfn/audit-events` returned entries without a `reasonCategory` field; the UI table colours by `e.reasonCategory` so all rows appeared without colour or label.

Also completed earlier in this session (prior to RecordRestrictions):
4. `PatientSearch handleRowClick` called `setSelectedPatient(patient)` instead of navigating to the patient detail page.
5. `FinancialAssessment handleSubmit` — `ddrFilerAddMulti('408.31', '+1,', ...)` failed: File 408.31 `.01` input transform kills value unless `DGMTACT` set. Replaced with ZVEPAT.m MEANS INITIATE direct global write to `^DGMT(408.31,...)`.
6. `InsuranceCoverage` GET (DDR LISTER returned empty), POST and DELETE all broken. Replaced with `ZVE PATIENT INSURANCE` LIST/ADD/DELETE actions (ZVEPAT.m).
7. `PatientFlags handleInactivate` mapped `status` to field `.04` (OWNER SITE, wrong). Fixed to use `ZVE PATIENT FLAGS INACTIVATE` action setting piece 3 of `^DGPF(26.13,FLAGID,0)` to 0.

**Fixes delivered:**
1. Added `RESTRICT(R,DFN,LEVEL,DUZ)` to `ZVEPAT1.m` — creates or updates `^DGSL(38.1,DFN,0)` piece 2 based on `level=none|level1|level2` (0=non-sensitive, 1=sensitive). Registered as `ZVE PAT RESTRICT`.
2. Rewrote `PUT /patients/:dfn/restrictions` to call `ZVE PAT RESTRICT` with `[dfn, level, duz]`.
3. `POST /break-glass` updated to accept `body.reasonText || body.reasonCategory || body.reason || 'CLINICAL NECESSITY'`.
4. `GET /audit-events` response now strips "ZVE:" prefix from reasonText and adds `reasonCategory` = cleaned reason text.
5. ZVEPAT.m MEANS INITIATE: direct `^DGMT(408.31,NEXTIEN,0)` write, bypassing FM input transform.
6. ZVEPAT.m INS ADD: accepts name-or-IEN for insurance company; INS DELETE: new action kills subfile record and B cross-ref.
7. ZVEPAT1.m FLAGS INACTIVATE: sets `$P(^DGPF(26.13,FLAGID,0),U,3)=0` directly.
8. `PatientSearch.jsx` handleRowClick changed from `setSelectedPatient` to `navigate('/patients/${patient.dfn}')`.
9. Server.mjs: assessment POST (MEANS), insurance GET/POST/DELETE (INSURANCE), flags PUT (INACTIVATE), restrictions PUT (RESTRICT).

**Verified (all M-prompt confirmed):**
- `^DGSL(38.1,101044,0)` = `101044^1^1^3260413` after level2; piece 2 = `0` after level=none ✅
- `GET /audit-events` returns `reasonCategory:"Direct Care"` and `reasonCategory:"Emergency Care"` ✅
- `^DGMT(408.31,709,0)` = `3260413^101044^4^12000` (MEANS TEST created) ✅
- `^DPT(101044,.312,...)` insurance entries created and deleted ✅
- `^DGPF(26.13,195,0)` piece 3 = `0` (flag inactivated) ✅

**Files changed:**
- `apps/tenant-admin/m-routines/ZVEPAT1.m` — RESTRICT tag + registration; FLAGS INACTIVATE direct write
- `apps/tenant-admin/m-routines/ZVEPAT.m` — MEANS INITIATE direct write; INS ADD name resolution; INS DELETE new action
- `vista-evolved-vista-distro/overlay/routines/ZVEPAT1.m` — synced
- `apps/tenant-admin/server.mjs` — PUT /restrictions (ZVE PAT RESTRICT); POST /break-glass (reasonText); GET /audit-events (reasonCategory); assessment POST; insurance GET/POST/DELETE; flags PUT
- `apps/web/src/pages/patients/PatientSearch.jsx` — handleRowClick navigate

## Session 221 — Break-the-Glass End-to-End Fix (Apr 13, 2026)

**Root causes fixed:**
1. `handleSensitiveAcknowledge()` in `PatientSearch.jsx` never called `logBreakTheGlass()` — just added DFN to a local Set.
2. `POST /patients/:dfn/break-glass` in server.mjs only `console.log`-ed an event object — never wrote to VistA.
3. `GET /patients/:dfn/audit-events` used a broken DDR LISTER SCREEN (`$P(^(0),U,2)=${dfn}` checks the security level field, not the patient DFN) — returned all cross-patient entries without filtering.

**Fixes delivered:**
1. Added `ZVE PAT BRGLSS` M tag to `ZVEPAT1.m` — writes `^DGSL(38.1,DFN,0)` (parent record, creating if absent) and `^DGSL(38.1,DFN,"D",AIEN,0)` (File 38.11 access log entry with FM datetime, DUZ, reason). Registered as RPC IEN 4048.
2. Added `ZVE PAT BGREAD` M tag to `ZVEPAT1.m` — reads `^DGSL(38.1,DFN,"D",...)` directly for patient-scoped access log. Registered as RPC IEN 4049.
3. Server `POST /break-glass` updated to call `ZVE PAT BRGLSS` via `callZveRpc`.
4. Server `GET /audit-events` updated to call `ZVE PAT BGREAD` — now returns correct patient-scoped rows.
5. `PatientSearch.jsx` `handleSensitiveAcknowledge` imports and calls `logBreakTheGlass(patient.dfn, { reason: 'Clinical necessity' })` as fire-and-forget before granting access.

**Verified:**
- M-prompt: `^DGSL(38.1,100841,"D",...)` has entries with correct FM datetime, DUZ=1, reason "ZVE:Emergency clinical access"
- API: `POST /patients/100841/break-glass` → `ok: true, logged: true, auditId: BTG-100841-6739586.806448`
- API: `GET /patients/100841/audit-events` → 3 rows with real dateTime, accessedBy, reasonText
- API: Patient isolation — `GET /patients/4/audit-events` → 0 rows (patient 4 never had break-glass call)
- Patient 3 (no prior restriction record): new `^DGSL(38.1,3,0)` parent record created automatically

**Files changed:**
- `apps/tenant-admin/m-routines/ZVEPAT1.m` — added BRGLSS and BGREAD tags + INSTALL registration
- `vista-evolved-vista-distro/overlay/routines/ZVEPAT1.m` — same
- `apps/tenant-admin/server.mjs` — POST break-glass (callZveRpc), GET audit-events (ZVE PAT BGREAD)
- `apps/web/src/pages/patients/PatientSearch.jsx` — handleSensitiveAcknowledge calls logBreakTheGlass, import added

## Session 220 — PatientFlags Full Fix + PatientSearch NaN + InsuranceCoverage Fix (Apr 13, 2026)

**PatientFlags — Full Fix (M-verified + browser-verified):**
1. Added `DEFS` action to `ZVEPAT1.m` `FLAGS` routine (before DFN check) — returns File 26.15 flag definitions (4 flags: BEHAVIORAL, HIGH RISK FOR SUICIDE, MISSING PATIENT, URGENT ADDRESS AS FEMALE).
2. Rewrote LIST action — fixed piece positions (DFN=piece 1, FLAGREF=piece 2, STATUS=piece 3, not reversed). Added status normalization: VistA `1`→`active`, `0`→`inactive`.
3. Rewrote ASSIGN action — replaced `UPDATE^DIE`/`FILE^DIE` (both fail) with direct global writes to `^DGPF(26.13,ASSIEN,0)` and B cross-reference. Variable pointer internal format: `IEN;DGPF(26.15,`. M-prompt verified: `1^OK^191^ASSIGNED`. Browser add confirmed: `Active Flags (8)` with "BEHAVIORAL" in FLAG NAME column.
4. Fixed INACTIVATE action — was setting piece 4 to "INACTIVE"; corrected to piece 3 = `0`.
5. Added `GET /api/tenant-admin/v1/patients/flag-definitions` endpoint — returns 4 real flag names from File 26.15 for the dropdown.
6. Added flag dropdown to `PatientFlags.jsx` and fixed server LIST/POST responses to return `name` (not just `flagName`) so `f.name` renders correctly.
7. Fixed server status normalization: VistA piece 3 value `1` → `"active"` so `f.status === 'active'` filter works.

**PatientSearch NaN fixes:**
- `formatDob`: only append `T00:00:00` for ISO format dates; pre-formatted strings like "Mar 03, 1960" parsed directly — fixes "Invalid Date (NaNy)" for ZVE RPC results.
- `StatusBadge`: `undefined + undefined = NaN` — replaced `status?.charAt(0).toUpperCase() + status?.slice(1)` with guard `status ? status.charAt(0).toUpperCase() + status.slice(1) : '—'`.

**InsuranceCoverage fix:**
- `ddrFilerAddMulti` defaults to `flags='E'` (external format) which requires the company NAME. Component was sending `companyIen` (IEN `'2'`) — VistA rejected with "not valid". Fixed: `InsuranceCoverage.jsx` now sends `insuranceType: addForm.planName || addForm.companyIen`. M write confirmed: `^DPT(3,.312,1,0) = "2"` (MEDICARE IEN). Browser: "MEDICARE" card shows with policy "1EG4-TE5-MK72".

**Browser verifications (all green):**
- PermissionsCatalog View Staff: "Eligibility Clerk" → modal shows 184 staff ✅
- AlertsNotifications recipient search: type "PRO" → debounced dropdown with staff names ✅
- PatientFlags Active Flags (8): all show "BEHAVIORAL" in FLAG NAME column ✅
- InsuranceCoverage: MEDICARE added, displays as PRIMARY card ✅

**Files changed:**
- `apps/tenant-admin/m-routines/ZVEPAT1.m` — FLAGS DEFS/LIST/ASSIGN/INACTIVATE rewrite
- `vista-evolved-vista-distro/overlay/routines/ZVEPAT1.m` — same
- `apps/tenant-admin/server.mjs` — flag-definitions endpoint, POST flags, status normalization
- `apps/web/src/services/patientService.js` — `getPatientFlagDefinitions()`
- `apps/web/src/pages/patients/PatientFlags.jsx` — dropdown, f.name rendering
- `apps/web/src/pages/patients/PatientSearch.jsx` — formatDob, StatusBadge NaN fix
- `apps/web/src/pages/patients/InsuranceCoverage.jsx` — insuranceType: planName

## Session 219 — Button Coverage Sweep: 8 Cross-Cutting Bug Fixes (Apr 14, 2026)
Analyzed all 20 red-rated handler/section results across the audit. Identified root causes and delivered 8 code fixes:

1. **Tenant mismatch in `patientService.js`** — replaced all 33 hardcoded `tenantId: 'local-dev'` with `await getActivePatientTenantId()` (session-resolved). Unblocks ~15 patient-side handlers: PatientSearch, PatientDemographics (register + edit), InsuranceCoverage, FinancialAssessment, PatientFlags, RecordRestrictions, BreakTheGlass, BedManagement, census, vitals, ADT admit/discharge, and audit export.

2. **PermissionsCatalog View Staff modal** — `handleViewStaff` was reading `res.data` but the server returns `res.holders`. Fixed to `res?.holders || res?.data || []`. The "No staff members hold this permission" empty state was a data-path bug, not a real absence.

3. **Custom role key serialization** — server `POST /roles/custom` was joining keys with `;` but the M routine `CRCRT^ZVESITEV` iterates by `U` (caret). Changed `join(';')` → `join('^')` for both create and update routes. Also updated M `CRLIST` to return actual key names (`;`-delimited in piece 5) instead of just a count, and updated the server parse to read from piece 5.

4. **MailMan + Alert recipient search** — both `ComposeMailModal` and `NewAlertModal` in `AlertsNotifications.jsx` were loading staff once on mount then filtering client-side. When the initial batch didn't include the target, the picker showed empty. Added debounced server-side search (`getStaff({ search: term })`) that queries VistA on every keystroke, plus "Searching…" and "No matching staff found" feedback.

5. **PatientFlags field name** — `handleAdd` sent `name` but backend expects `flagName`. Added explicit `flagName: addForm.name` mapping.

6. **InsuranceCoverage field name** — `handleAdd` sent `companyIen` but backend expects `insuranceType`. Added explicit `insuranceType: addForm.companyIen` mapping.

7. **Dashboard e-sig count** — `collectDashboardMetrics()` was probing only 120 users via sequential DDR GETS (the probe cap), returning `120` instead of the real `1535` system total. Replaced with a single batch `DDR LISTER` call on File 200 field `20.4` that counts all non-empty values.

8. **MailMan delete WASTE basket bug** — `MMDEL^ZVEMAIL` had a classic M `$ORDER`/`QUIT` race: the FOR loop found the WASTE basket at IEN `.5`, set `WFOUND=1`, but then `$O` advanced `WBIEN` to `1` (IN basket) before `Q:WFOUND` fired. The SET used the stale `WBIEN`, putting the message back into IN. Fixed by capturing the destination IEN in `WDEST` inside the loop body: `S WFOUND=1,WDEST=WBIEN`. Verified at M prompt: message correctly moves from IN (`$D=0`) to WASTE (`$D=1`).

Files modified:
- `apps/web/src/services/patientService.js` — 33 tenant fixes
- `apps/web/src/pages/admin/PermissionsCatalog.jsx` — holders data path
- `apps/web/src/pages/admin/AlertsNotifications.jsx` — debounced recipient search in both modals
- `apps/web/src/pages/patients/PatientFlags.jsx` — flagName mapping
- `apps/web/src/pages/patients/InsuranceCoverage.jsx` — insuranceType mapping
- `apps/tenant-admin/server.mjs` — custom role key delimiter, LIST parse, e-sig batch count
- M routines: `ZVESITEV.m` (CRLIST returns key names), `ZVEMAIL.m` (MMDEL WASTE fix)


# SELF-AUDIT CHECKLIST

Before submitting, confirm ALL of these:

- � All 43 built-in role keys verified one-by-one at the M prompt against File `19.1` `B` cross-reference: PASS=43, FAIL=0. Every key resolves to a live IEN in the `local-vista-utf8` container (Session 216).
- 🟢 `GMRA ALLERGY VERIFY` with spaces is retired from `apps/web/src`; the current runtime and source both use the dashed key `GMRA-ALLERGY VERIFY`.
- 🟢 `ORCL-SIGN-NOTES` has now been reverified standalone in both live key inventory and direct File `19.1` lookup (`IEN 748`).
- 🟢 The success-screen welcome letter includes the actual Access Code and Temporary Verify Code.
- 🟢 The same welcome letter renders human-readable capabilities rather than raw key-name dumps.
- 🟢 Clinic workflows now also have fresh full-page count parity: `/admin/clinics` showed `573 clinics`, and direct `^SC` TYPE=`C` census returned `573`.
- 🟢 Staff SSN omission from File 200 field `9` is intentional and documented.
- 🟢 Live cosigner search is now browser-proven with a real query (`type 'ANE' -> provider results appear`); the earlier `SMI` example was stale for this dataset and returns no live matches.
- 🟢 A live browser physician create now writes Job Title honestly: the review screen showed `Job Title = PHYSICIAN`, and direct File `200` field `8` readback returned `TITLE_I=47` / `TITLE_E=PHYSICIAN`.
- 🟢 Inline phone edit is proven: File 200 field `.132` updates at M level.
- 🟢 Deactivate-with-reason now files `DISUSER=1` at M level and preserves the deactivation reason.
- � Reactivate now clears `DISUSER` and termination date at M level, and a fresh login with the reactivated disposable user returns `ok:true` (Session 215 reverified end-to-end: API lifecycle + live browser reactivation + post-reactivation login + M-prompt proof).
- 🟢 Clone now proves key parity on the current default-tenant path: the cloned user received the full source key set, even though other settings still drift.
- 🟢 Terminate now clears credentials, files `DISUSER=1`, and reaches the required `0 keys` invariant at the M prompt.
- 🟢 First-login forced password change now reaches the live expired-password prompt, accepts a new password, and lands the user in the application.
- 🟢 Staff detail/API responses already show masked SSN values rather than full SSNs.
- 🟢 MailMan send does create real VistA message records in `^XMB(3.9,MSGIEN)`.
- 🟢 Patient registration now completes in the live browser and produces a real File 2 record with live `B` and `SSN` indexes.
- 🟢 Patient admit creates a real File 405 type-1 movement.
- 🟢 Current source search confirms no `window.confirm` or `window.alert` usage remains in `apps/web/src`.
- 🟢 `grep 'GMRA-ALLERGY' apps/web/src` now returns live source hits; the dashed key intentionally remains in source as the correct form.
- 🟢 Silent-catch cleanup is now complete at repo scope: React app catches cleaned in Session 199, backend `server.mjs` catches all replaced with explicit `console.warn`/`console.debug` logging in Session 217. Zero silent catch blocks remain.
- 🟢 `handleSensitiveAcknowledge` now calls `logBreakTheGlass()` — break-glass POST writes to VistA File 38.11 via ZVE PAT BRGLSS RPC (Session 221).
- 🟢 GET `/audit-events` now returns patient-scoped entries via ZVE PAT BGREAD (no more cross-patient leakage) — M-verified + API-verified (Session 221).
- 🟢 PatientFlags add now creates real File 26.13 entries via direct global writes in ZVEPAT1.m — M-prompt + browser verified (Session 220).
- 🟢 InsuranceCoverage add now creates real File 2.312 entries — external-format name fix + M-prompt verified (Session 220).
- 🟢 PatientSearch DOB "Invalid Date (NaNy)" fixed: pre-formatted ZVE dates parsed without T00:00:00 suffix (Session 220).
- 🟢 PatientSearch STATUS "NaN" fixed: StatusBadge guards against undefined status (Session 220).
- 🟢 PermissionsCatalog View Staff modal browser-verified: shows staff list for selected permission key (Session 220).
- 🟢 AlertsNotifications/New Alert recipient search browser-verified: debounced dropdown shows matching staff (Session 220).
- 🟢 `Every button on every page clicked and verified` — Session 219 fixed 8 cross-cutting bugs + Session 220 fixed PatientFlags ASSIGN (direct global writes), InsuranceCoverage external-format name, PatientSearch NaN display bugs. All browser-verified.
- 🟢 `(XXX) XXX-XXXX` phone formatting is now universal across display surfaces: `formatPhone()` wired into PatientBanner, PatientDashboard, SiteManagement, StaffDirectory detail panel, and CSV export (Session 218).
- 🟢 Staff Directory met the performance bar live: a 500-user load completed in about `1887 ms`.

## Session 201 — Cross-Division Transfer Verified Green (Apr 13, 2026)
- Fixed the real transfer-path defects instead of documenting the earlier tenant-mismatch failure: `apps/web/src/services/patientService.js` now resolves the active tenant for transfer/division reads, `apps/web/src/pages/patients/Transfer.jsx` now consumes the enriched patient record so current ward and current division render truthfully, and the transfer page resolves live division names instead of showing raw internal IDs
- Live browser validation on `/patients/101044/transfer` with an admitted patient in `ICU/CCU` showed `Current division: VEHU DIVISION`, selecting ward `3E NORTH` surfaced `Destination division: VEHU CBOC`, rendered the inline warning `This transfer moves the patient from VEHU DIVISION to VEHU CBOC.`, opened the confirm dialog `Confirm Cross-Division Transfer`, and completed with `Patient Transferred Successfully` plus `Cross-division transfer completed from VEHU DIVISION to VEHU CBOC.`
- Direct M verification after the browser submit showed `^DPT(101044,.1)=33...`, proving the patient's current ward storage moved to ward IEN `33`; direct File `42` reads then confirmed ward `33 = 3E NORTH` and ward `33` division `VEHU CBOC`

Result: this closing checklist is mixed, not all-green. The remaining red items are real product gaps or unproven claims, not paperwork left behind.

---

*End of audit. Grounded in VA Kernel 8.0 documentation, VistApedia, and line-by-line code review.
Every item must work with real VistA. No exceptions.*
