# VistA Evolved — Complete System Audit

> **1,050 findings across 30 admin + patient pages, 28 M routines, 222 server routes.**
>
> This document is the single source of truth. The AI coder reads one section at a time, executes every fix, verifies every fix at the VistA M prompt AND in the browser, then moves to the next section.
>
> **Rules for the AI coder:**
> 1. You may NOT skip any item. If something is hard, you build it. If it requires a new M routine, you write one.
> 2. You may NOT say "this is a massive undertaking" and defer. You do it now.
> 3. You may NOT use fallbacks, stubs, or "coming soon" placeholders. Every feature must work.
> 4. After every change that writes to VistA: open the M prompt, run the verify command, confirm the data. Then refresh the browser and confirm the display. Both must match.
> 5. After every UI change: click it in the browser. Does it work? Does it look right? Does it handle errors?
> 6. You validate your own work as you go. You do not move to the next section until every item in the current section is verified.

---

# SECTION 1: CRITICAL ISSUES (Fix First — Everything Else Depends on These)

## 1.1 GMRA Key Name Has a Dash — VistA Key Has a Space

**File:** `apps/web/src/pages/admin/RoleTemplates.jsx`

**Problem:** Three roles (Registered Nurse, Nurse Practitioner, Surgeon) include the key `GMRA-ALLERGY VERIFY` with a DASH between GMRA and ALLERGY. The actual VistA security key in File 19.1 is almost certainly `GMRA ALLERGY VERIFY` with a SPACE. Our key sanitizer (`/[^A-Z0-9 \-]/g`) now preserves dashes, so the dash goes directly to VistA. The lookup `$O(^DIC(19.1,"B","GMRA-ALLERGY VERIFY",0))` will return 0 — key not found. Every nurse, NP, and surgeon who should have allergy verification authority does NOT actually get it.

**Fix:** Change every occurrence of `GMRA-ALLERGY VERIFY` to `GMRA ALLERGY VERIFY` (space, not dash) in RoleTemplates.jsx. There are 5 occurrences:
1. Registered Nurse role keys array
2. Nurse Practitioner role keys array
3. Surgeon role keys array
4. KEY_IMPACTS constant
5. TASK_TO_KEY mapping

**Verify:**
```
M prompt: W $O(^DIC(19.1,"B","GMRA ALLERGY VERIFY",0))
Must return > 0 (key exists)

Then: Assign Registered Nurse role to a user → M prompt:
S IEN=0 F  S IEN=$O(^VA(200,DUZ,51,IEN)) Q:'IEN  W !,$P(^VA(200,DUZ,51,IEN,0),U,1)
→ GMRA ALLERGY VERIFY must appear in the list
```

## 1.2 All 43 Security Keys Must Be Verified at VistA M Prompt

**This has been requested in every fix document since the beginning and has NEVER been done.**

Connect to the VistA Docker container and run this command at the M prompt:

```mumps
S KEYS="PROVIDER,ORES,OR CPRS GUI CHART,ORCL-SIGN-NOTES,ORCL-PAT-RECS,GMRA ALLERGY VERIFY,ORELSE,PSB NURSE,OREMAS,PSORPH,PSJ PHARMACIST,PSOPHARMACIST,PSOINTERFACE,PSD PHARMACIST,PSDRPH,LRLAB,LRVERIFY,LRSUPER,LRMGR,LRCAP,SD SCHEDULING,SDCLINICAL,SD SUPERVISOR,SDMGR,DG REGISTER,DG REGISTRATION,DG ADMIT,DG DISCHARGE,DG TRANSFER,DG MENU,DG SUPERVISOR,DG SENSITIVITY,DGMEANS TEST,RA TECHNOLOGIST,RA ALLOC,MAG SYSTEM,MAG CAPTURE,XUMGR,XUPROG,XUPROGMODE,XUAUDITING,IBFIN,PSO MANAGER"
F I=1:1:$L(KEYS,",") S K=$P(KEYS,",",I) W !,K," → ",$S($O(^DIC(19.1,"B",K,0))>0:"EXISTS",1:"*** NOT FOUND ***")
```

**For any key that returns NOT FOUND:**
1. Search for similar names: `S X="" F  S X=$O(^DIC(19.1,"B",X)) Q:X=""  I X["ORCL" W !,X` (replace ORCL with search term)
2. If the key has a different name in this VistA instance, update RoleTemplates.jsx with the correct name
3. If the key genuinely doesn't exist, it needs to be created via FileMan or the role template needs to be adjusted
4. **Document every finding** — write a comment in the code next to each key: `// Verified 2026-04-12: EXISTS in ^DIC(19.1)` or `// Verified: actual name is X`

## 1.3 SSN Field Mapping Broken — ssnLast4 vs ssn Key Mismatch

**Files:** `StaffForm.jsx` (line ~payload construction), `server.mjs` (EXTRA_MAP)

**Problem:** The wizard collects `govIdLast4` (4 digits). The payload sends `ssnLast4: form.govIdLast4`. But the server's EXTRA_MAP has `ssn: '9'` — note the key is `ssn`, not `ssnLast4`. The payload key doesn't match the EXTRA_MAP key, so SSN is never written to VistA.

**But there's a deeper problem:** Even if the keys matched, VistA File 200 field 9 (SSN) expects a full 9-digit SSN (000-00-0000 or 000000000). Writing just "5678" (4 digits) to field 9 will either fail VistA's input transform or store an invalid SSN that breaks other VistA functions that expect 9 digits.

**Fix (choose one):**
- **Option A (recommended):** Remove SSN from EXTRA_MAP entirely. Don't write last-4 to VistA field 9. Use ssnLast4 for display-only purposes in the UI. If full SSN is needed, add a separate secure full-SSN field to the wizard with appropriate masking.
- **Option B:** Add `ssnLast4: '9'` to EXTRA_MAP and pad to 9 digits with zeros: `000-00-${ssnLast4}`. This is technically valid but semantically wrong — it creates fake SSNs in VistA.

**Verify:** Create a user with govIdLast4 = "5678" → M prompt: `W $$GET1^DIQ(200,DUZ_",",9,"E")` → Either empty (Option A) or properly formatted (Option B). Then check the detail panel shows the last 4 correctly.

## 1.4 Cosigner Search Returns Empty Results — Filter on Non-Existent Field

**File:** `StaffForm.jsx`, `searchCosignerProviders` function

**Problem:** The cosigner search calls `getStaff({ search: query })` and then filters: `(res?.data || []).filter(u => u.roles?.includes('ORES'))`. But the LIST2 response does NOT include a `roles` field — it returns `ien, name, status, title, service, division, lastLogin, keyCount, isProvider`. There is no `roles` array. So `u.roles` is always `undefined`, `u.roles?.includes('ORES')` is always `false`, and the filter returns an empty array. **The cosigner dropdown always shows zero suggestions.**

**Fix:** Change the filter to use `isProvider` instead of `roles`:
```javascript
const providers = (res?.data || []).filter(u => u.isProvider === true || u.isProvider === '1');
```
Or better: create a dedicated endpoint `/users/providers` that returns only users with ORES key, including their DUZ. The cosigner field must store the DUZ (pointer to File 200), not the name text.

**Verify:** Type "SMI" in cosigner field → dropdown shows SMITH,JOHN A (DUZ: 56). Select → payload sends cosigner DUZ, not text. → M prompt: `W $$GET1^DIQ(200,DUZ_",",53.42,"E")` → shows cosigner name.

---

# SECTION 2: USER CREATION — Every Field Traced End-to-End

For each field the wizard collects, trace: Does the payload include it? Does the server process it? Does VistA receive it? Does the detail panel display it? Can it be edited?

### 🟢 #1 [MEDIUM] Name .01: Name regex allows apostrophes but VistA .01 rejects them via input transform
**VistA Field:** 200/.01

**Fix:** Strip or warn on apostrophe/special chars. Only allow [A-Z, ',- SPACE].

**Verify:** Enter O'BRIEN → either accepted or clear warning

### 🟢 #2 [MEDIUM] Name .01: No maxLength enforced on individual name fields (Last/First)
**VistA Field:** 200/.01

**Fix:** Last max 25, First max 15, MI max 1. Combined ≤ 35.

**Verify:** Enter 40-char last name → blocked

### ⚪ #3 [LOW] Name .01: Middle Initial allows multiple chars
**VistA Field:** 200/.01

**Fix:** MI should be single letter only. Enforce maxLength=1 on MI input.

**Verify:** Enter "AB" as MI → only first char kept

### 🟢 #4 [MEDIUM] Name .01: Edit mode name rename may collide with existing names
**VistA Field:** 200/.01

**Fix:** renameStaffMember doesn't check for duplicates before renaming.

**Verify:** Rename to existing name → either VistA error surfaced or pre-check

### 🔴 #5 [CRITICAL] SSN 9: ssnLast4 in payload but EXTRA_MAP has no ssnLast4 key — SSN never written
**VistA Field:** 200/9

**Fix:** Either remove SSN write entirely (use last-4 for display only) OR add ssnLast4 to EXTRA_MAP mapped to a safe approach. Full SSN (field 9) requires 9 digits.

**Verify:** Create user with last4="5678" → M: check field 9 vs not written

### 🟢 #6 [MEDIUM] SSN 9: SSN edit not possible in edit mode FIELD_MAP
**VistA Field:** 200/9

**Fix:** FIELD_MAP has no SSN entry. Admin can't correct SSN.

**Verify:** If SSN correction needed, add to FIELD_MAP with appropriate validation

### 🟢 #7 [MEDIUM] Email .151: Email validation allows some invalid formats (no TLD check)
**VistA Field:** 200/.151

**Fix:** Current regex /^[^\s@]+@[^\s@]+\.[^\s@]+$/ is basic. Add TLD check.

**Verify:** Enter "user@test" → should warn

### ⚪ #8 [LOW] Email .151: No email domain validation (could enter user@localhost)
**VistA Field:** 200/.151

**Fix:** Warn on non-standard domains.

**Verify:** Enter user@localhost → warning

### 🟢 #9 [MEDIUM] Phone .132: Phone not formatted on save — raw digits stored
**VistA Field:** 200/.132

**Fix:** Format to (XXX) XXX-XXXX before saving to VistA or store raw and format on display.

**Verify:** Enter 5551234567 → display shows (555) 123-4567

### ⚪ #10 [LOW] Phone .132: No international phone support
**VistA Field:** 200/.132

**Fix:** Only validates 10+ digits. International numbers may be longer.

**Verify:** Enter +63 917 123 4567 → either accepted or clear message

### ⚪ #11 [LOW] DOB 5: No minimum age check — can create user born today
**VistA Field:** 200/5

**Fix:** A staff member born today is not valid. Add min age (16? 18?).

**Verify:** Enter today's date → warning "Staff must be at least 16"

### ⚪ #12 [LOW] DOB 5: DOB format sent as ISO but VistA expects FileMan format
**VistA Field:** 200/5

**Fix:** Server must convert ISO to FileMan YYYMMDD before DDR FILER.

**Verify:** Create with DOB 1990-05-15 → M: W $$GET1^DIQ(200,DUZ_",",5,"I") → 2900515

### 🟢 #13 [MEDIUM] NPI 41.99: NPI Luhn checksum not validated — only checks 10 digits
**VistA Field:** 200/41.99

**Fix:** NPI has a check digit algorithm. Validate it.

**Verify:** Enter 1234567890 → may pass digit count but fail Luhn check

### ⚪ #14 [LOW] NPI 41.99: NPI should be unique across users but no uniqueness check
**VistA Field:** 200/41.99

**Fix:** Two users with same NPI would be a billing problem.

**Verify:** Create two users with same NPI → warning

### 🟡 #15 [HIGH] DEA 53.2: DEA validation is frontend-only — server doesn't validate
**VistA Field:** 200/53.2

**Fix:** Bypass validation by sending raw API call with invalid DEA.

**Verify:** POST /users with dea:"INVALID" → server should reject

### ⚪ #16 [LOW] DEA 53.2: DEA checksum digit not validated
**VistA Field:** 200/53.2

**Fix:** DEA has a specific checksum algorithm beyond format.

**Verify:** Enter AB1234567 → pass format, verify checksum

### 🟢 #17 [MEDIUM] Provider Type 53.5: providerType sent as text but field 53.5 is a pointer to File 7
**VistA Field:** 200/53.5

**Fix:** DDR FILER with "E" flag should resolve, but if text doesn't match a File 7 entry, it silently fails.

**Verify:** Create with providerType="UNKNOWN_TYPE" → verify error surfaced

### 🟡 #18 [HIGH] Cosigner 53.42: Cosigner search queries getStaff but filters by u.roles which may not exist in list response
**VistA Field:** 200/53.42

**Fix:** getStaff returns list data without roles field. Filter always returns []. Cosigner suggestions always empty.

**Verify:** Type cosigner name → suggestions should appear (verify they do)

### 🟢 #19 [MEDIUM] Cosigner 53.42: Cosigner sends text name but field 53.42 is pointer to File 200 — needs DUZ
**VistA Field:** 200/53.42

**Fix:** If user selects from dropdown, ensure the DUZ is sent, not the name text.

**Verify:** Select cosigner → verify field 53.42 = DUZ not text

### 🟢 #20 [MEDIUM] Language 200.07: Field 200.07 is a sub-file pointer to File .85 — DDR FILER may fail
**VistA Field:** 200/200.07

**Fix:** Test at M prompt. If DDR FILER doesn't handle sub-file correctly, use direct set or custom RPC.

**Verify:** Create with language → M: W $$GET1^DIQ(200,DUZ_",",200.07,"E")

### 🟢 #21 [MEDIUM] Division 200.02: Edit mode has no UI for changing primary division
**VistA Field:** 200/200.02

**Fix:** BASIC_FIELD_MAP has no division entry. User can't change facility in edit.

**Verify:** Add division change to edit mode via assignDivision service

### ⚪ #22 [LOW] Division 200.02: No visual distinction between primary and secondary divisions in detail
**VistA Field:** 200/200.02

**Fix:** All divisions shown equally. Primary should be marked.

**Verify:** Primary badge with star icon

### 🟢 #23 [MEDIUM] Controlled Substances 55: Field 55 may be a SET OF CODES or sub-file — single string write may fail
**VistA Field:** 200/55

**Fix:** Research field 55 data type at M prompt: D ^DID(200,55). If sub-file, need per-schedule entries.

**Verify:** M: D ^DID(200,55) → check data type → fix write method

### ⚪ #25 [LOW] Sig Block 20.2/20.3: No preview of how sig block will appear in CPRS notes
**VistA Field:** 200/20.2,20.3

**Fix:** Sig block is used at the bottom of clinical notes. Show preview.

**Verify:** Enter sig block → see preview of formatted appearance

### 🟡 #26 [HIGH] OE/RR List 200.0001: No UI for CPRS team assignment — field 200.0001
**VistA Field:** 200/200.0001

**Fix:** Terminal allows assigning team lists per user. Our wizard has nothing for this.

**Verify:** Add team selector to wizard or detail panel → M: check 200.0001

### 🟢 #27 [MEDIUM] Primary Menu 201: primaryMenu in BASIC_FIELD_MAP for edit but no selector UI in wizard create
**VistA Field:** 200/201

**Fix:** Field saved on create via EXTRA_MAP but user can't pick which menu.

**Verify:** Add dropdown: CPRS, Vista Terminal, etc. Default to CPRS for clinical.

### 🟡 #28 [HIGH] Auth to Write Meds: toggle saves but DETAIL may not return current state correctly
**VistA Field:** 200/53.11

**Fix:** Verify DETAIL returns field 53.11 value and detail panel displays it. Check the index mapping (detail[22]).

**Verify:** Toggle auth meds on create → M: W $$GET1^DIQ(200,DUZ_",",53.11,"I") → refresh detail → shows correctly

### 🟢 #29 [MEDIUM] Requires Cosigner: saved on create but may not load correctly in edit mode
**VistA Field:** 200/53.08

**Fix:** Verify the edit mode loads this field from DETAIL response and pre-fills the toggle.

**Verify:** Create user with requiresCosign=true → edit → toggle should be ON

### 🟢 #30 [MEDIUM] FileMan Access Code: saved but what are valid values?
**VistA Field:** 200/3

**Fix:** VistA field 3 accepts specific values: @, ^, or blank. Validate input matches VistA expectations.

**Verify:** Enter "XYZ" for FM access → does VistA accept it?

### 🟢 #31 [MEDIUM] Verify Code Never Expires: toggle saved but may conflict with VHA Directive 6500
**VistA Field:** 200/9.5

**Fix:** VHA requires password changes every 90 days. Document that this overrides compliance.

**Verify:** Set VC never expires → password doesn't expire → note compliance override

### 🟢 #32 [MEDIUM] Restrict Patient Selection: what does this actually do in CPRS?
**VistA Field:** 200/101.01

**Fix:** Field 101.01 limits which patients a user can access. Our UI doesn't explain this.

**Verify:** Add tooltip explaining the restriction. Test in CPRS if possible.

### ⚪ #33 [LOW] displayName: removed from payload but some code may still reference it
**VistA Field:** Custom

**Fix:** Search for displayName in payload construction and detail mapping.

**Verify:** Grep for displayName → remove any orphaned references

### 🟢 #34 [MEDIUM] Employee ID: stored in ^XTMP which has purge dates — data may be lost
**VistA Field:** ^ZVEX

**Fix:** ZVEUEXT uses ^XTMP with 10-year purge. But ^XTMP is designed for TEMPORARY data. Consider using a custom global ^ZVEX instead.

**Verify:** Verify ^XTMP("ZVE-USEREXT") purge policy. Consider migration to permanent global.

### 🟢 #35 [MEDIUM] Role persistence: stored in ^XTMP — same concern as Employee ID
**VistA Field:** ^ZVEX

**Fix:** Same fix as above. Consider permanent storage.

**Verify:** Check data persistence after VistA restart

### 🟡 #36 [HIGH] Permissions: key assignment success screen shows failed keys but what if ALL keys fail?
**VistA Field:** 200/51

**Fix:** If every key in a role fails (e.g., none exist in VistA), success screen says "User created" but user has zero capabilities.

**Verify:** Assign role where all keys are invalid → UI should show prominent warning

### 🟢 #131 [MEDIUM] No real-time validation on blur for all fields
**VistA Field:** UI

**Fix:** Only name has onBlur. Phone/email/NPI validate only on Next.

**Verify:** Add onBlur to all required fields

### 🟢 #132 [MEDIUM] Password strength meter: no requirements checklist
**VistA Field:** UI

**Fix:** Shows Weak/Fair/Strong but doesn't list what's needed (uppercase, number, etc).

**Verify:** Show: ✓ 8+ chars, ✗ number, ✗ uppercase

### ⚪ #133 [LOW] No form progress indicator (% complete)
**VistA Field:** UI

**Fix:** Only step numbers. No sense of overall completion.

**Verify:** Progress bar or percentage

### ⚪ #134 [LOW] No auto-save draft to sessionStorage
**VistA Field:** UI

**Fix:** Closing browser loses all work.

**Verify:** Auto-save every 5 seconds. Restore on re-open.

### 🟢 #135 [MEDIUM] Department is free text — should be dropdown from VistA File 49
**VistA Field:** UI

**Fix:** User can type any department name. Should select from existing.

**Verify:** Dropdown populated from getDepartments()

### ⚪ #136 [LOW] Title field is free text — should be dropdown from File 3.1
**VistA Field:** UI

**Fix:** VistA Title is pointer to File 3.1. Should be a picker.

**Verify:** Dropdown from File 3.1 entries

### 🟢 #137 [MEDIUM] No preview of how the user account will look before creation
**VistA Field:** UI

**Fix:** Review step shows data but not a visual preview of the account.

**Verify:** Show mini detail-panel preview in review step

### ⚪ #197 [LOW] Reference data re-fetched every wizard open
**VistA Field:** Perf

**Fix:** Sites, departments, permissions loaded fresh each time.

**Verify:** Cache in context with 5-min TTL

### 🟢 #203 [MEDIUM] VistA down mid-wizard: no draft save or retry
**VistA Field:** Error

**Fix:** If VistA disconnects during step 3, all data lost.

**Verify:** Auto-save to sessionStorage. Show "Connection lost. [Retry]"

### 🟢 #204 [MEDIUM] Create partial success: no per-field error report in UI
**VistA Field:** Error

**Fix:** extraFields has per-field status but UI may not render it clearly.

**Verify:** Show: "User created. Warning: email failed to save (DDR error)."

### ⚪ #207 [LOW] Submit error not scrolled to on mobile
**VistA Field:** Error

**Fix:** Error at bottom, screen at top.

**Verify:** Scroll to error or use toast notification

### 🟢 #212 [MEDIUM] No focus management in wizard — step change doesn't focus first field
**VistA Field:** A11y

**Fix:** useRef on first input per step. Focus on step change.

**Verify:** Advance to step 2 → cursor in first field

### ⚪ #218 [LOW] Wizard step indicators not announced to screen readers
**VistA Field:** A11y

**Fix:** SR doesn't know which step is current.

**Verify:** aria-current="step" on active step

### ⚪ #225 [LOW] Access Code / Verify Code labels — still showing VistA jargon?
**VistA Field:** Terms

**Fix:** Check if parenthetical removed.

**Verify:** Fields show "Username" and "Password" only

### ⚪ #228 [LOW] Create vs Save button label matches mode?
**VistA Field:** Terms

**Fix:** New mode: "Create Staff Member". Edit mode: "Save Changes".

**Verify:** Correct label per mode

### 🟢 #229 [MEDIUM] Apostrophe in name (O'BRIEN) — does VistA accept?
**VistA Field:** Edge

**Fix:** Test at M prompt. VistA .01 input transform may reject.

**Verify:** Create O'BRIEN → either success or clear warning

### 🟢 #230 [MEDIUM] Unicode characters in name
**VistA Field:** Edge

**Fix:** Non-ASCII characters (accented letters, CJK) in VistA.

**Verify:** Enter José → VistA may reject → clear error

### 🟢 #232 [MEDIUM] Duplicate name: VistA may allow but system should warn
**VistA Field:** Edge

**Fix:** VistA doesn't enforce unique names. But duplicates cause confusion.

**Verify:** Create SMITH,JOHN when one exists → warning

### 🟢 #235 [MEDIUM] Session timeout mid-wizard: data lost
**VistA Field:** Edge

**Fix:** No auto-save. 15-min session.

**Verify:** Auto-save draft. On re-auth, restore wizard state.

### 🟢 #279 [MEDIUM] Create user → assign role → edit user → change role
**VistA Field:** E2E

**Fix:** Role lifecycle.

**Verify:** Physician → 6 keys → change to Nurse → old keys removed, new keys added

---

# SECTION 3: STAFF DIRECTORY — List, Search, Detail, Actions

### ⚪ #24 [LOW] E-Signature 20.4: Clear e-sig button should confirm with typed phrase for security
**VistA:** 200/20.4

**Fix:** Currently just confirm dialog. For security, require typing "CLEAR" to prevent accidental clears.

**Verify:** Click clear → type "CLEAR" → signature removed

### 🟢 #111 [MEDIUM] No search debounce — every keystroke triggers re-render
**VistA:** UI

**Fix:** Add 300ms debounce via setTimeout on search input.

**Verify:** Type quickly → no lag

### 🟢 #112 [MEDIUM] Sort options exist but no column header click-sort
**VistA:** UI

**Fix:** DataTable has sortCol/sortDir but headers not clickable for sort.

**Verify:** Click "Name" header → sorts A-Z then Z-A

### 🟢 #113 [MEDIUM] No role source badge on permissions
**VistA:** UI

**Fix:** Can't tell which keys came from role vs individually assigned.

**Verify:** Add badge: "From: Physician" vs "Individual"

### 🟢 #114 [MEDIUM] Multi-division display is comma-separated text
**VistA:** UI

**Fix:** Show as individual badges with add/remove controls.

**Verify:** Divisions as clickable badges

### 🟢 #115 [MEDIUM] No review step diff highlighting in edit mode
**VistA:** UI

**Fix:** Edit wizard review step doesn't show what changed vs original.

**Verify:** Changed fields highlighted in blue

### ⚪ #116 [LOW] No pinned/favorite staff for quick access
**VistA:** UI

**Fix:** Admin managing 500+ users can't bookmark favorites.

**Verify:** Star icon → pinned users at top

### ⚪ #117 [LOW] No keyboard shortcuts
**VistA:** UI

**Fix:** No Ctrl+N for new, Ctrl+F for search.

**Verify:** Ctrl+N → opens wizard

### ⚪ #118 [LOW] No dark mode support
**VistA:** UI

**Fix:** Fixed light theme only.

**Verify:** Dark mode toggle in shell

### ⚪ #119 [LOW] Table density options (compact/comfortable/spacious)
**VistA:** UI

**Fix:** Fixed row height. Compact shows more data.

**Verify:** Density toggle in toolbar

### 🟢 #120 [MEDIUM] No "recently viewed" users section
**VistA:** UI

**Fix:** Can't quickly return to a user viewed moments ago.

**Verify:** Show last 5 viewed users in sidebar

### 🟢 #121 [MEDIUM] Column visibility selector missing
**VistA:** UI

**Fix:** Can't hide/show specific columns.

**Verify:** Toggle columns via dropdown

### ⚪ #122 [LOW] No row count display ("Showing 1-25 of 342")
**VistA:** UI

**Fix:** User doesn't know total count.

**Verify:** Page indicator with total

### 🟢 #123 [MEDIUM] Wizard can't jump to completed steps
**VistA:** UI

**Fix:** Must navigate Previous/Next sequentially.

**Verify:** Click completed step label → jumps to that step

### ⚪ #124 [LOW] No "Create Another" shortcut after success
**VistA:** UI

**Fix:** Must navigate back and re-open wizard.

**Verify:** Success screen has "Create Another" button (verify it works)

### 🟢 #125 [MEDIUM] Password expiration not shown in detail panel
**VistA:** UI

**Fix:** vcChangeDate and pwdExpirationDays exist in detail but no display.

**Verify:** Show "Password expires: July 15, 2026" or "Expired 3 days ago"

### 🟢 #126 [MEDIUM] No user activity feed/timeline in detail
**VistA:** UI

**Fix:** Only sign-on count shown. No timeline of status changes.

**Verify:** Show timeline: created → activated → key added → deactivated

### ⚪ #127 [LOW] No export of user profile as PDF
**VistA:** UI

**Fix:** Can only print access letter. No full profile export.

**Verify:** Export PDF with all detail panel data

### ⚪ #128 [LOW] Access letter could include QR code for verification
**VistA:** UI

**Fix:** Modern enhancement — QR links to user profile.

**Verify:** QR code in access letter

### 🟢 #129 [MEDIUM] Bulk import (CSV upload) not built
**VistA:** UI

**Fix:** Must create users one at a time.

**Verify:** CSV template download → upload → validate → create all

### 🟢 #130 [MEDIUM] No scheduled deactivation (future date deactivation)
**VistA:** UI

**Fix:** Can't set "deactivate on Dec 31" for temporary staff.

**Verify:** Date picker → auto-deactivate on that date

### 🟢 #193 [MEDIUM] No server-side pagination — all users loaded
**VistA:** Perf

**Fix:** LIST2 accepts MAX param. Frontend should paginate with ?page=N&limit=25.

**Verify:** GET /users?page=2&limit=25 → rows 26-50

### 🟢 #194 [MEDIUM] E-sig still separate API call (may have been merged — verify)
**VistA:** Perf

**Fix:** Check if LIST2 now includes e-sig or if still 2 calls.

**Verify:** Network tab: 1 call or 2 for staff list?

### 🟢 #195 [MEDIUM] No hover prefetch for detail panel
**VistA:** Perf

**Fix:** Click → 3 API calls → wait. Prefetch on hover.

**Verify:** Hover 500ms → start loading → click → instant

### ⚪ #198 [LOW] No virtual scrolling for large lists
**VistA:** Perf

**Fix:** With 1000+ rows, DOM becomes heavy.

**Verify:** Use react-window or virtualized list

### 🟢 #205 [MEDIUM] Clone error: generic message
**VistA:** Error

**Fix:** handleCloneUser catch shows err.message which may be technical.

**Verify:** Surface user-friendly: "Clone failed: user SMITH,JOHN already exists"

### 🟢 #206 [MEDIUM] Deactivate error: generic message
**VistA:** Error

**Fix:** Same issue. Surface specific VistA error.

**Verify:** Show: "Cannot deactivate: user has active orders"

### 🟢 #213 [MEDIUM] Color-only status indicators (green/red)
**VistA:** A11y

**Fix:** Colorblind users can't distinguish. Add text or icon.

**Verify:** Status shows: "● Active" or "○ Inactive" with text

### ⚪ #215 [LOW] Modal focus trap not implemented
**VistA:** A11y

**Fix:** Tab key can escape modals to background.

**Verify:** Focus trapped inside modal. Escape closes.

### 🟢 #223 [MEDIUM] All 43+ key names have human-readable translations?
**VistA:** Terms

**Fix:** Check key-translations.json covers every key used in roles.

**Verify:** Every key pill shows readable name

### 🟢 #231 [MEDIUM] Concurrent editing: two admins edit same user
**VistA:** Edge

**Fix:** No optimistic locking. Both overwrite.

**Verify:** Add ETag/version check on save

### ⚪ #233 [LOW] Empty system (new VistA): does UI handle zero users?
**VistA:** Edge

**Fix:** Welcome message exists? Verify.

**Verify:** Empty system → "No staff yet. Create your first."

### ⚪ #234 [LOW] User with 50+ permissions: display overflow
**VistA:** Edge

**Fix:** Long permission list.

**Verify:** Collapse after 10: "Show 40 more"

### ⚪ #236 [LOW] Corrupt VistA record (empty .01 name)
**VistA:** Edge

**Fix:** Blank row in table.

**Verify:** Show "(No Name — Record #DUZ)" for empty names

### ⚪ #238 [LOW] Very long department/title strings: table column overflow
**VistA:** Edge

**Fix:** VistA allows long text. Table columns may break.

**Verify:** Truncate with tooltip on hover

### ⚪ #239 [LOW] User photo/avatar upload
**VistA:** Enhance

**Fix:** Modern systems show photos.

**Verify:** Upload photo → visible in directory + detail

### ⚪ #240 [LOW] Quick-action toolbar on row hover
**VistA:** Enhance

**Fix:** Inline action icons without opening detail.

**Verify:** Hover → edit/deactivate/clone icons appear

### ⚪ #241 [LOW] User onboarding checklist
**VistA:** Enhance

**Fix:** Post-creation checklist: keys ✓, e-sig ○, first login ○.

**Verify:** New user shows progress tracking

### ⚪ #242 [LOW] Credential delivery options
**VistA:** Enhance

**Fix:** After create: print letter / email credentials / copy to clipboard.

**Verify:** Choose delivery method on success screen

### ⚪ #243 [LOW] User groups/teams beyond department
**VistA:** Enhance

**Fix:** Organizational teams: "Cardiology Team," "Night Shift."

**Verify:** Create team → assign members → team badge in directory

### ⚪ #244 [LOW] Time-limited key access
**VistA:** Enhance

**Fix:** Assign key with expiration for temporary staff.

**Verify:** Assign with 30-day expiry → auto-removed after 30 days

### ⚪ #245 [LOW] Compliance dashboard
**VistA:** Enhance

**Fix:** Which users are compliant (current pwd, e-sig, training)?

**Verify:** Filter to "Non-compliant" → actionable list

### ⚪ #246 [LOW] Smart role suggestion from job title
**VistA:** Enhance

**Fix:** Type "Cardiologist" → suggest "Physician" role.

**Verify:** TITLE_TO_ROLE mapping

### ⚪ #247 [LOW] User comparison/diff tool
**VistA:** Enhance

**Fix:** Compare two users' permissions side by side.

**Verify:** Select two → diff view

### ⚪ #248 [LOW] Org chart visualization
**VistA:** Enhance

**Fix:** See reporting structure visually.

**Verify:** Org chart from department + supervisor data

### ⚪ #249 [LOW] Delegation of authority workflow
**VistA:** Enhance

**Fix:** Formal cosigner/attending delegation.

**Verify:** Request → approve → time-limited delegation

### ⚪ #250 [LOW] Two-factor authentication
**VistA:** Enhance

**Fix:** TOTP or SMS 2FA for admin logins.

**Verify:** After password → enter TOTP code → access

### 🟢 #267 [MEDIUM] Create physician → verify ALL 32 fields saved → M prompt check 10+ fields
**VistA:** E2E

**Fix:** Full create trace. Every field verified at M prompt.

**Verify:** Create → check name, email, phone, NPI, DEA, division, keys at M prompt

### 🟢 #268 [MEDIUM] Edit user phone → verify round-trip
**VistA:** E2E

**Fix:** Edit → PUT → DDR FILER → File 200 → GET → display.

**Verify:** Edit phone → M: W $$GET1^DIQ(200,DUZ_",",.132) → refresh → shows new phone

### 🟢 #269 [MEDIUM] Deactivate → reactivate → verify SSN intact
**VistA:** E2E

**Fix:** Full lifecycle. SSN must survive.

**Verify:** Deactivate → M: SSN unchanged → Reactivate → M: SSN still there

### 🟢 #270 [MEDIUM] Lock user (3 failed logins) → shows LOCKED → unlock
**VistA:** E2E

**Fix:** Lock at terminal or via failed logins → list shows LOCKED → unlock.

**Verify:** LIST2 returns LOCKED → Unlock → ACTIVE

### 🟢 #271 [MEDIUM] Clone user → verify all keys copied
**VistA:** E2E

**Fix:** Clone physician → new user has same keys.

**Verify:** Clone → M: compare key lists

### 🟢 #272 [MEDIUM] Terminate user → verify credentials cleared + keys removed
**VistA:** E2E

**Fix:** Full termination. No residual access.

**Verify:** Terminate → M: access code empty, key count = 0

---

# SECTION 4: ROLES & SECURITY KEYS

## 4.1 Key Verifications (43 keys)

Each key below must be verified at the M prompt. The AI coder runs the verification script from Section 1.2 and documents results here.

### 🔴 #37 [CRITICAL] GMRA-ALLERGY VERIFY has DASH — VistA key name likely has SPACE: GMRA ALLERGY VERIFY
**Fix:** Change all references from "GMRA-ALLERGY VERIFY" to "GMRA ALLERGY VERIFY" (space not dash). Sanitizer preserves dashes so the dash goes to VistA and lookup fails.
**Verify:** M: W $O(^DIC(19.1,"B","GMRA ALLERGY VERIFY",0)) vs W $O(^DIC(19.1,"B","GMRA-ALLERGY VERIFY",0))

### 🟡 #38 [HIGH] Verify key "PROVIDER" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","PROVIDER",0)). If 0: find correct name or create.
**Verify:** Key PROVIDER returns valid IEN

### 🟡 #39 [HIGH] Verify key "ORES" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","ORES",0)). If 0: find correct name or create.
**Verify:** Key ORES returns valid IEN

### 🟡 #40 [HIGH] Verify key "OR CPRS GUI CHART" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","OR CPRS GUI CHART",0)). If 0: find correct name or create.
**Verify:** Key OR CPRS GUI CHART returns valid IEN

### 🟡 #41 [HIGH] Verify key "ORCL-SIGN-NOTES" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","ORCL-SIGN-NOTES",0)). If 0: find correct name or create.
**Verify:** Key ORCL-SIGN-NOTES returns valid IEN

### 🟡 #42 [HIGH] Verify key "ORCL-PAT-RECS" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","ORCL-PAT-RECS",0)). If 0: find correct name or create.
**Verify:** Key ORCL-PAT-RECS returns valid IEN

### 🟡 #43 [HIGH] Verify key "GMRA ALLERGY VERIFY" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","GMRA ALLERGY VERIFY",0)). If 0: find correct name or create.
**Verify:** Key GMRA ALLERGY VERIFY returns valid IEN

### 🟡 #44 [HIGH] Verify key "ORELSE" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","ORELSE",0)). If 0: find correct name or create.
**Verify:** Key ORELSE returns valid IEN

### 🟡 #45 [HIGH] Verify key "PSB NURSE" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","PSB NURSE",0)). If 0: find correct name or create.
**Verify:** Key PSB NURSE returns valid IEN

### 🟡 #46 [HIGH] Verify key "OREMAS" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","OREMAS",0)). If 0: find correct name or create.
**Verify:** Key OREMAS returns valid IEN

### 🟡 #47 [HIGH] Verify key "PSORPH" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","PSORPH",0)). If 0: find correct name or create.
**Verify:** Key PSORPH returns valid IEN

### 🟡 #48 [HIGH] Verify key "PSJ PHARMACIST" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","PSJ PHARMACIST",0)). If 0: find correct name or create.
**Verify:** Key PSJ PHARMACIST returns valid IEN

### 🟡 #49 [HIGH] Verify key "PSOPHARMACIST" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","PSOPHARMACIST",0)). If 0: find correct name or create.
**Verify:** Key PSOPHARMACIST returns valid IEN

### 🟡 #50 [HIGH] Verify key "PSOINTERFACE" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","PSOINTERFACE",0)). If 0: find correct name or create.
**Verify:** Key PSOINTERFACE returns valid IEN

### 🟡 #51 [HIGH] Verify key "PSD PHARMACIST" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","PSD PHARMACIST",0)). If 0: find correct name or create.
**Verify:** Key PSD PHARMACIST returns valid IEN

### 🟡 #52 [HIGH] Verify key "PSDRPH" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","PSDRPH",0)). If 0: find correct name or create.
**Verify:** Key PSDRPH returns valid IEN

### 🟡 #53 [HIGH] Verify key "LRLAB" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","LRLAB",0)). If 0: find correct name or create.
**Verify:** Key LRLAB returns valid IEN

### 🟡 #54 [HIGH] Verify key "LRVERIFY" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","LRVERIFY",0)). If 0: find correct name or create.
**Verify:** Key LRVERIFY returns valid IEN

### 🟡 #55 [HIGH] Verify key "LRSUPER" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","LRSUPER",0)). If 0: find correct name or create.
**Verify:** Key LRSUPER returns valid IEN

### 🟡 #56 [HIGH] Verify key "LRMGR" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","LRMGR",0)). If 0: find correct name or create.
**Verify:** Key LRMGR returns valid IEN

### 🟡 #57 [HIGH] Verify key "LRCAP" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","LRCAP",0)). If 0: find correct name or create.
**Verify:** Key LRCAP returns valid IEN

### 🟡 #58 [HIGH] Verify key "SD SCHEDULING" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","SD SCHEDULING",0)). If 0: find correct name or create.
**Verify:** Key SD SCHEDULING returns valid IEN

### 🟡 #59 [HIGH] Verify key "SDCLINICAL" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","SDCLINICAL",0)). If 0: find correct name or create.
**Verify:** Key SDCLINICAL returns valid IEN

### 🟡 #60 [HIGH] Verify key "SD SUPERVISOR" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","SD SUPERVISOR",0)). If 0: find correct name or create.
**Verify:** Key SD SUPERVISOR returns valid IEN

### 🟡 #61 [HIGH] Verify key "SDMGR" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","SDMGR",0)). If 0: find correct name or create.
**Verify:** Key SDMGR returns valid IEN

### 🟡 #62 [HIGH] Verify key "DG REGISTER" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","DG REGISTER",0)). If 0: find correct name or create.
**Verify:** Key DG REGISTER returns valid IEN

### 🟡 #63 [HIGH] Verify key "DG REGISTRATION" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","DG REGISTRATION",0)). If 0: find correct name or create.
**Verify:** Key DG REGISTRATION returns valid IEN

### 🟡 #64 [HIGH] Verify key "DG ADMIT" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","DG ADMIT",0)). If 0: find correct name or create.
**Verify:** Key DG ADMIT returns valid IEN

### 🟡 #65 [HIGH] Verify key "DG DISCHARGE" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","DG DISCHARGE",0)). If 0: find correct name or create.
**Verify:** Key DG DISCHARGE returns valid IEN

### 🟡 #66 [HIGH] Verify key "DG TRANSFER" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","DG TRANSFER",0)). If 0: find correct name or create.
**Verify:** Key DG TRANSFER returns valid IEN

### 🟡 #67 [HIGH] Verify key "DG MENU" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","DG MENU",0)). If 0: find correct name or create.
**Verify:** Key DG MENU returns valid IEN

### 🟡 #68 [HIGH] Verify key "DG SUPERVISOR" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","DG SUPERVISOR",0)). If 0: find correct name or create.
**Verify:** Key DG SUPERVISOR returns valid IEN

### 🟡 #69 [HIGH] Verify key "DG SENSITIVITY" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","DG SENSITIVITY",0)). If 0: find correct name or create.
**Verify:** Key DG SENSITIVITY returns valid IEN

### 🟡 #70 [HIGH] Verify key "DGMEANS TEST" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","DGMEANS TEST",0)). If 0: find correct name or create.
**Verify:** Key DGMEANS TEST returns valid IEN

### 🟡 #71 [HIGH] Verify key "RA TECHNOLOGIST" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","RA TECHNOLOGIST",0)). If 0: find correct name or create.
**Verify:** Key RA TECHNOLOGIST returns valid IEN

### 🟡 #72 [HIGH] Verify key "RA ALLOC" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","RA ALLOC",0)). If 0: find correct name or create.
**Verify:** Key RA ALLOC returns valid IEN

### 🟡 #73 [HIGH] Verify key "MAG SYSTEM" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","MAG SYSTEM",0)). If 0: find correct name or create.
**Verify:** Key MAG SYSTEM returns valid IEN

### 🟡 #74 [HIGH] Verify key "MAG CAPTURE" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","MAG CAPTURE",0)). If 0: find correct name or create.
**Verify:** Key MAG CAPTURE returns valid IEN

### 🟡 #75 [HIGH] Verify key "XUMGR" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","XUMGR",0)). If 0: find correct name or create.
**Verify:** Key XUMGR returns valid IEN

### 🟡 #76 [HIGH] Verify key "XUPROG" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","XUPROG",0)). If 0: find correct name or create.
**Verify:** Key XUPROG returns valid IEN

### 🟡 #77 [HIGH] Verify key "XUPROGMODE" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","XUPROGMODE",0)). If 0: find correct name or create.
**Verify:** Key XUPROGMODE returns valid IEN

### 🟡 #78 [HIGH] Verify key "XUAUDITING" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","XUAUDITING",0)). If 0: find correct name or create.
**Verify:** Key XUAUDITING returns valid IEN

### 🟡 #79 [HIGH] Verify key "IBFIN" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","IBFIN",0)). If 0: find correct name or create.
**Verify:** Key IBFIN returns valid IEN

### 🟡 #80 [HIGH] Verify key "PSO MANAGER" exists in VistA File 19.1
**Fix:** M: W $O(^DIC(19.1,"B","PSO MANAGER",0)). If 0: find correct name or create.
**Verify:** Key PSO MANAGER returns valid IEN

### 🟢 #81 [MEDIUM] Role "Physician" (6 keys): Consider DG SENSITIVITY for sensitive records
**Fix:** Verify all 6 keys exist. Consider DG SENSITIVITY for sensitive records
**Verify:** Assign Physician role → all keys present at M prompt

### 🟢 #82 [MEDIUM] Role "Nurse Practitioner" (5 keys): Missing GMRA ALLERGY VERIFY — NPs verify allergies
**Fix:** Verify all 5 keys exist. Missing GMRA ALLERGY VERIFY — NPs verify allergies
**Verify:** Assign Nurse Practitioner role → all keys present at M prompt

### 🟢 #83 [MEDIUM] Role "Physician Assistant" (5 keys): Complete after ORCL-SIGN-NOTES was added
**Fix:** Verify all 5 keys exist. Complete after ORCL-SIGN-NOTES was added
**Verify:** Assign Physician Assistant role → all keys present at M prompt

### 🟢 #84 [MEDIUM] Role "Surgeon" (7 keys): Complete for surgical provider
**Fix:** Verify all 7 keys exist. Complete for surgical provider
**Verify:** Assign Surgeon role → all keys present at M prompt

### 🟢 #85 [MEDIUM] Role "Anesthesiologist" (5 keys): Consider PSB NURSE for medication admin during procedures
**Fix:** Verify all 5 keys exist. Consider PSB NURSE for medication admin during procedures
**Verify:** Assign Anesthesiologist role → all keys present at M prompt

### 🟢 #86 [MEDIUM] Role "Registered Nurse" (6 keys): GMRA ALLERGY VERIFY must use correct name (space not dash)
**Fix:** Verify all 6 keys exist. GMRA ALLERGY VERIFY must use correct name (space not dash)
**Verify:** Assign Registered Nurse role → all keys present at M prompt

### 🟢 #87 [MEDIUM] Role "LPN" (4 keys): Consider whether ORELSE needed
**Fix:** Verify all 4 keys exist. Consider whether ORELSE needed
**Verify:** Assign LPN role → all keys present at M prompt

### 🟢 #88 [MEDIUM] Role "Social Worker" (3 keys): Consider DG REGISTER for intake workflows
**Fix:** Verify all 3 keys exist. Consider DG REGISTER for intake workflows
**Verify:** Assign Social Worker role → all keys present at M prompt

### 🟢 #89 [MEDIUM] Role "Ward Clerk" (4 keys): Complete
**Fix:** Verify all 4 keys exist. Complete
**Verify:** Assign Ward Clerk role → all keys present at M prompt

### 🟢 #90 [MEDIUM] Role "Staff Pharmacist" (5 keys): Verify PSO MANAGER NOT included (supervisor only)
**Fix:** Verify all 5 keys exist. Verify PSO MANAGER NOT included (supervisor only)
**Verify:** Assign Staff Pharmacist role → all keys present at M prompt

### 🟢 #91 [MEDIUM] Role "CS Pharmacist" (4 keys): Consider PSJ PHARMACIST for inpatient
**Fix:** Verify all 4 keys exist. Consider PSJ PHARMACIST for inpatient
**Verify:** Assign CS Pharmacist role → all keys present at M prompt

### 🟢 #92 [MEDIUM] Role "Pharmacy Supervisor" (7 keys): Complete
**Fix:** Verify all 7 keys exist. Complete
**Verify:** Assign Pharmacy Supervisor role → all keys present at M prompt

### 🟢 #93 [MEDIUM] Role "Lab Technologist" (4 keys): Complete
**Fix:** Verify all 4 keys exist. Complete
**Verify:** Assign Lab Technologist role → all keys present at M prompt

### 🟢 #94 [MEDIUM] Role "Lab Supervisor" (5 keys): Complete
**Fix:** Verify all 5 keys exist. Complete
**Verify:** Assign Lab Supervisor role → all keys present at M prompt

### 🟢 #95 [MEDIUM] Role "Phlebotomist" (3 keys): LRCAP now included — correct
**Fix:** Verify all 3 keys exist. LRCAP now included — correct
**Verify:** Assign Phlebotomist role → all keys present at M prompt

### 🟢 #96 [MEDIUM] Role "Rad Tech" (4 keys): Complete
**Fix:** Verify all 4 keys exist. Complete
**Verify:** Assign Rad Tech role → all keys present at M prompt

### 🟢 #97 [MEDIUM] Role "Imaging Tech" (4 keys): Complete
**Fix:** Verify all 4 keys exist. Complete
**Verify:** Assign Imaging Tech role → all keys present at M prompt

### 🟢 #98 [MEDIUM] Role "Scheduling Clerk" (3 keys): Complete
**Fix:** Verify all 3 keys exist. Complete
**Verify:** Assign Scheduling Clerk role → all keys present at M prompt

### 🟢 #99 [MEDIUM] Role "Scheduling Supervisor" (5 keys): Complete
**Fix:** Verify all 5 keys exist. Complete
**Verify:** Assign Scheduling Supervisor role → all keys present at M prompt

### 🟢 #100 [MEDIUM] Role "Registration Clerk" (5 keys): Verify DG REGISTRATION exists
**Fix:** Verify all 5 keys exist. Verify DG REGISTRATION exists
**Verify:** Assign Registration Clerk role → all keys present at M prompt

### 🟢 #101 [MEDIUM] Role "ADT Coordinator" (6 keys): Complete
**Fix:** Verify all 6 keys exist. Complete
**Verify:** Assign ADT Coordinator role → all keys present at M prompt

### 🟢 #102 [MEDIUM] Role "ADT Supervisor" (5 keys): Complete
**Fix:** Verify all 5 keys exist. Complete
**Verify:** Assign ADT Supervisor role → all keys present at M prompt

### 🟢 #103 [MEDIUM] Role "Billing Clerk" (3 keys): Verify IBFIN exists
**Fix:** Verify all 3 keys exist. Verify IBFIN exists
**Verify:** Assign Billing Clerk role → all keys present at M prompt

### 🟢 #104 [MEDIUM] Role "System Administrator" (5 keys): Verify XUAUDITING exists
**Fix:** Verify all 5 keys exist. Verify XUAUDITING exists
**Verify:** Assign System Administrator role → all keys present at M prompt

### 🟢 #105 [MEDIUM] Role "Chief of Staff" (6 keys): Complete
**Fix:** Verify all 6 keys exist. Complete
**Verify:** Assign Chief of Staff role → all keys present at M prompt

### 🟢 #106 [MEDIUM] Key dependency: When removing PROVIDER, warn about ORES dependency
**Fix:** If user has ORES and admin removes PROVIDER, ORES becomes orphaned. Warn.
**Verify:** Remove PROVIDER from user with ORES → dependency warning shown

### 🟢 #107 [MEDIUM] Key dependency: ORELSE and ORES are mutually exclusive but no warning on role change
**Fix:** Changing from nurse (ORELSE) to physician (ORES) should auto-remove ORELSE.
**Verify:** Change role from nurse to physician → ORELSE auto-removed

### ⚪ #108 [LOW] No "key audit" report showing which users hold which keys
**Fix:** Terminal has "Show Holders of a Key." Our Permission Catalog shows holders but no export.
**Verify:** Add CSV export of key holders

### ⚪ #109 [LOW] Permission Catalog holders not clickable → can't navigate to user
**Fix:** Names shown as text. Should link to user detail.
**Verify:** Click holder name → navigates to user detail

### ⚪ #110 [LOW] No batch REMOVE permission (only batch ASSIGN exists)
**Fix:** Add batch remove: select multiple users → remove key from all.
**Verify:** Batch remove ORELSE from 5 users

### 🟢 #196 [MEDIUM] Role assignment still sequential (6 calls for physician)
**Fix:** Create ZVE KEY ASSIGN BATCH RPC for single-call role assignment.
**Verify:** Assign role → 1 network call → all keys set

---

# SECTION 5: SECURITY & AUTHENTICATION

### 🟢 #138 [MEDIUM] IRM Mail Group field may be dropdown now — verify it works
**Fix:** Previous round may have added dropdown. Verify it populates and saves.
**Verify:** Select mail group from dropdown → saves to VistA

### 🟢 #139 [MEDIUM] "No Auditing" has no extra confirmation for compliance
**Fix:** Disabling audit = HIPAA violation risk. Should require typed confirmation.
**Verify:** Select "No Auditing" → red warning → type CONFIRM → applies

### ⚪ #140 [LOW] Pending 2P requests have no email notification
**Fix:** Second admin must check the page. No push notification.
**Verify:** Submit 2P change → MailMan message sent to approver

### 🟢 #141 [MEDIUM] Session timeout slider label only shows seconds — add human-readable
**Fix:** Shows "900" but should show "15 minutes (900 seconds)".
**Verify:** Slider shows "15 minutes (900 seconds)"

### ⚪ #142 [LOW] No password policy preview
**Fix:** Admin changes password rules but can't see how they affect existing users.
**Verify:** Show "X users would be affected by this change"

### 🟢 #190 [MEDIUM] Login: wrong password shows same delay as correct password
**Fix:** Timing attack mitigation. Ensure consistent response time.
**Verify:** Time 10 wrong passwords vs 10 right — should be similar

### 🟢 #191 [MEDIUM] No account lockout display after N failures in admin panel
**Fix:** User locked at VistA level but admin panel doesn't show lockout timer.
**Verify:** Show "Account locked for 15 minutes" on login page

### 🟢 #210 [MEDIUM] Login error messages all similar
**Fix:** Wrong password vs expired vs VistA down all look similar.
**Verify:** Distinct messages per error type

### 🟢 #273 [MEDIUM] Change session timeout → verify in VistA Kernel params
**Fix:** 2P flow end-to-end.
**Verify:** Change → approve → M: W $$GET1^DIQ(8989.3,1,"200","I")

### 🟢 #278 [MEDIUM] Login → session → forced password change → new password
**Fix:** First-login flow.
**Verify:** Create user → login → forced change → new password works

### 🟡 #183 [HIGH] Session token still in sessionStorage — XSS vulnerable
**Fix:** Move to httpOnly secure cookie. Server sets cookie on login, browser sends automatically.
**Verify:** document.cookie shows no token. Token travels in cookie header.

### 🟡 #184 [HIGH] CSRF token also in sessionStorage
**Fix:** CSRF token should be in a meta tag or separate httpOnly cookie, not JS-accessible storage.
**Verify:** CSRF not accessible via XSS

### 🟢 #185 [MEDIUM] No Content-Security-Policy header
**Fix:** CSP prevents inline script injection.
**Verify:** Add CSP header: default-src 'self'; script-src 'self'

### 🟢 #186 [MEDIUM] No X-Frame-Options or frame-ancestors
**Fix:** Site can be embedded in iframes for clickjacking.
**Verify:** Add X-Frame-Options: DENY header

### 🟢 #187 [MEDIUM] No rate limiting on API endpoints (not just login)
**Fix:** Bulk API abuse possible.
**Verify:** Rate limit: 100 req/min per session on write endpoints

### ⚪ #188 [LOW] No session activity display ("Last active: 5 min ago")
**Fix:** User doesn't know when session will expire.
**Verify:** Show countdown timer or "Last active" indicator

### ⚪ #189 [LOW] No "Force logout all sessions" for admin
**Fix:** Can't force-disconnect a compromised user.
**Verify:** Admin action: "Terminate all active sessions for this user"

### ⚪ #192 [LOW] No API versioning header
**Fix:** No X-API-Version or versioning strategy.
**Verify:** Add version header for future migrations

### 🟢 #199 [MEDIUM] No gzip/brotli compression on API responses
**Fix:** Large JSON payloads sent uncompressed.
**Verify:** Add compression middleware to Fastify

### ⚪ #200 [LOW] No API response caching headers
**Fix:** Browser re-fetches identical data.
**Verify:** Add ETag / If-None-Match support

### ⚪ #201 [LOW] No lazy loading of admin page components
**Fix:** All 18 pages loaded upfront.
**Verify:** React.lazy + Suspense for each admin page

### 🟢 #202 [MEDIUM] No connection pooling for RPC broker
**Fix:** Each API call may create new broker connection.
**Verify:** Pool broker connections, reuse across requests

### 🟢 #208 [MEDIUM] Network error shows stale data in some pages
**Fix:** If getStaff() fails, previous staffList may still show.
**Verify:** Clear data on error. Show retry state.

### ⚪ #209 [LOW] No global toast notification system
**Fix:** Some pages use inline errors, others use banners. Inconsistent.
**Verify:** Standardize: toast for actions, inline for form validation

### ⚪ #211 [LOW] Console.log may leak VistA internals in production
**Fix:** Server logs may include M routine data in browser console.
**Verify:** Remove console.log in production build

### 🟢 #214 [MEDIUM] No aria-live regions for dynamic content
**Fix:** Success/error messages not announced to screen readers.
**Verify:** Add aria-live="polite" to notification containers

### ⚪ #216 [LOW] No skip-to-content link
**Fix:** Keyboard users tab through entire nav.
**Verify:** Hidden "Skip to main content" visible on focus

### ⚪ #219 [LOW] No high-contrast mode support
**Fix:** Low-vision users need higher contrast.
**Verify:** CSS custom properties for high-contrast theme

### 🟢 #220 [MEDIUM] Form fields may lack proper label associations
**Fix:** Some inputs may use placeholder instead of label.
**Verify:** Every input has associated <label> with htmlFor

### ⚪ #221 [LOW] Error messages not linked to form fields via aria-describedby
**Fix:** Screen reader doesn't associate error with field.
**Verify:** aria-describedby={errorId} on each validated input

### 🟢 #222 [MEDIUM] Staff ID vs Employee ID vs System ID — still inconsistent?
**Fix:** Standardize: "Employee ID" (user-entered), "System ID" (auto DUZ).
**Verify:** All labels consistent throughout

### ⚪ #226 [LOW] DUZ in any user-facing messages?
**Fix:** Grep for DUZ in error messages and UI text.
**Verify:** No "DUZ" visible to users

### ⚪ #227 [LOW] VistA file numbers in tooltips or help text?
**Fix:** File #200, File #44 references.
**Verify:** No file numbers in user-facing text

### 🟢 #237 [MEDIUM] VistA Docker restart: do sessions survive?
**Fix:** In-memory sessions lost on server restart.
**Verify:** Persist sessions to disk or Redis

### ⚪ #254 [LOW] i18n framework (react-intl)
**Fix:** English only. Prepare for translation.
**Verify:** All strings in message catalog

### ⚪ #255 [LOW] In-app help / documentation links
**Fix:** No contextual help.
**Verify:** ? icon per section → links to relevant docs

### ⚪ #256 [LOW] Changelog / release notes page
**Fix:** Users don't know what changed.
**Verify:** /admin/changelog with version history

### ⚪ #257 [LOW] Feature flags system
**Fix:** Can't enable/disable features per tenant.
**Verify:** Feature toggle infrastructure

### ⚪ #258 [LOW] Print stylesheet for all pages
**Fix:** Ctrl+P prints nav and shell.
**Verify:** @media print hides shell, shows content only

### 🟢 #259 [MEDIUM] POST /users response: no full user object returned
**Fix:** Must re-fetch after create. Return full user.
**Verify:** Create → response includes all fields

### 🟢 #260 [MEDIUM] PUT /users/:ien: no canonical VistA value returned
**Fix:** Returns input value, not what VistA stored (which may differ).
**Verify:** Edit NPI → response shows VistA-stored value

### ⚪ #261 [LOW] Error response format inconsistent
**Fix:** Some {ok,error}, others {ok,msg}. Standardize {ok,error,code}.
**Verify:** All errors same shape

### ⚪ #262 [LOW] No OpenAPI/Swagger documentation
**Fix:** No machine-readable API docs.
**Verify:** Generate OpenAPI spec

### ⚪ #263 [LOW] No API versioning strategy
**Fix:** Routes use /v1/ but no migration plan.
**Verify:** Document versioning policy

### 🟢 #264 [MEDIUM] DELETE /users/:duz/keys/:keyId — keyId format ambiguous
**Fix:** Sometimes IEN, sometimes name. Standardize.
**Verify:** Always use key name. Document.

### ⚪ #265 [LOW] No health check endpoint for load balancers
**Fix:** No /health or /ready.
**Verify:** GET /health → {ok:true, vistaConnected:true}

### 🟢 #266 [MEDIUM] Cosigner search uses getStaff which doesn't return roles field in list
**Fix:** The cosigner provider filter checks u.roles but list response has no roles. Filter broken.
**Verify:** Add provider/key info to list response, or use separate endpoint

### 🟢 #328 [MEDIUM] ErrorBoundary only wraps some pages — should wrap all
**Fix:** Only StaffDirectory has ErrorBoundary. All admin pages need it.
**Verify:** Error in any page → fallback UI, not white screen

### 🟢 #329 [MEDIUM] API timeout not configurable per route
**Fix:** Some operations (reports) need longer timeout.
**Verify:** Add per-route timeout configuration

### 🟢 #330 [MEDIUM] 401 redirect may lose page context
**Fix:** After session expiry → login → should return to original page.
**Verify:** Expire session on /admin/staff → login → returns to /admin/staff

### ⚪ #331 [LOW] No loading state consistency
**Fix:** Some pages: skeleton, others: spinner, others: nothing.
**Verify:** Standardize: skeleton for pages, spinner for actions

### ⚪ #332 [LOW] No success notification consistency
**Fix:** Some: banner, others: inline, others: toast.
**Verify:** Standardize success feedback via toast

### ⚪ #333 [LOW] ConfirmDialog: no keyboard shortcut
**Fix:** Must click buttons. Enter=confirm, Escape=cancel.
**Verify:** Enter → confirms, Escape → cancels

### ⚪ #334 [LOW] No "Clear all filters" button
**Fix:** Must remove filters one by one.
**Verify:** One-click "Clear All Filters" link

### ⚪ #335 [LOW] No page-specific document titles
**Fix:** All tabs show same title.
**Verify:** Tab shows "Staff Directory — VistA Evolved"

### ⚪ #336 [LOW] No breadcrumb consistency
**Fix:** Some pages have breadcrumbs, others don't.
**Verify:** All pages show: Admin > Page Name

### 🟢 #337 [MEDIUM] window.confirm eliminated? Verify.
**Fix:** Should be 0 uses. All via ConfirmDialog.
**Verify:** grep window.confirm → 0 results

### 🟢 #338 [MEDIUM] Empty catch blocks eliminated? Verify.
**Fix:** All catches should show errors.
**Verify:** grep "catch {" → 0 empty catches

### ⚪ #339 [LOW] No "What's new" or onboarding tour
**Fix:** New admins have no guidance.
**Verify:** First-time tour highlighting key features

---

# SECTION 6: OTHER ADMIN PAGES

### 🟢 #143 [MEDIUM] [AdminDash] Dashboard cards don't auto-refresh
**VistA:** Vista
**Fix:** Stale data after creating users. Add 60s auto-refresh or manual button.
**Verify:** Create user → dashboard count increments within 60s

### 🟢 #144 [MEDIUM] [AdminDash] Dashboard cards not clickable → no navigation to filtered views
**VistA:** Vista
**Fix:** Click "Active Users: 45" should go to StaffDirectory?status=Active
**Verify:** Click card → filtered view opens

### ⚪ #145 [LOW] [AdminDash] No trend data (users this week vs last)
**VistA:** Vista
**Fix:** Static counts only. Track over time.
**Verify:** Show sparkline or delta from last period

### 🟢 #146 [MEDIUM] [AdminReports] Reports may timeout on large datasets — no progress indicator
**VistA:** Vista
**Fix:** Loading spinner only. Long reports seem frozen.
**Verify:** Large report → progress bar or "X of Y rows"

### 🟢 #147 [MEDIUM] [AdminReports] No PDF export option — only CSV
**VistA:** Vista
**Fix:** Clinical compliance often requires PDF.
**Verify:** Add "Export as PDF" button

### ⚪ #148 [LOW] [AdminReports] No scheduled/recurring reports
**VistA:** Vista
**Fix:** Must manually run each time.
**Verify:** Schedule daily/weekly email delivery

### 🟢 #149 [MEDIUM] [AlertsNotify] MailMan compose: recipient is DUZ text field — should be user picker
**VistA:** 3.9/MailMan
**Fix:** Must type DUZ number. Should search by name.
**Verify:** Search provider by name → select → DUZ auto-filled

### 🟢 #150 [MEDIUM] [AlertsNotify] MailMan reply not implemented
**VistA:** 3.9
**Fix:** Can read but can't reply to messages.
**Verify:** Reply button → composer pre-filled with thread

### ⚪ #151 [LOW] [AlertsNotify] No unread message count in page header or bell icon
**VistA:** 3.9
**Fix:** Bell was removed. Unread count not visible anywhere.
**Verify:** Show unread count in page tab or nav badge

### 🟢 #152 [MEDIUM] [AlertsNotify] Alert priority options: are they VistA-backed?
**VistA:** 3.9
**Fix:** Priority "HIGH/NORMAL/LOW" — does VistA alert system support priority?
**Verify:** Create HIGH priority alert → verify priority stored in VistA

### 🟢 #153 [MEDIUM] [AuditLog] Audit entries may have inconsistent date formats across sources
**VistA:** FileMan
**Fix:** FileMan audit, sign-on log, ZVE audit, error trap all have different formats.
**Verify:** All dates shown in consistent format: "Apr 12, 2026 3:45 PM"

### 🟢 #154 [MEDIUM] [AuditLog] No export of audit data — view only
**VistA:** FileMan
**Fix:** Compliance requires exportable audit trails.
**Verify:** Add CSV and PDF export of audit data

### ⚪ #155 [LOW] [AuditLog] No filter by action type (login, key change, user edit)
**VistA:** FileMan
**Fix:** Must browse all entries.
**Verify:** Dropdown filter: "All" / "Sign-ons" / "Key Changes" / "Edits"

### ⚪ #156 [LOW] [AuditLog] No highlighting of suspicious activity
**VistA:** FileMan
**Fix:** Failed logins, off-hours access, mass key changes not flagged.
**Verify:** Highlight rows with suspicious patterns

### 🟢 #157 [MEDIUM] [ClinicMgmt] Clinic create only takes name + stop code — terminal has 20+ fields
**VistA:** 44
**Fix:** Terminal creates clinics with hours, appointment length, clinic type, location, etc.
**Verify:** Add at minimum: clinic type, appointment length, max appointments

### 🟢 #158 [MEDIUM] [ClinicMgmt] Clinic inactivation: verify it doesn't delete data
**VistA:** 44
**Fix:** Inactivation should set a date flag, not remove the clinic.
**Verify:** Inactivate → M: D ^DIQ(44,IEN,0) → still exists with inactive flag

### ⚪ #159 [LOW] [ClinicMgmt] No clinic schedule/template editor
**VistA:** 44
**Fix:** Can't set up recurring availability patterns.
**Verify:** Calendar view for weekly schedule

### 🟢 #160 [MEDIUM] [ClinicMgmt] Clinic detail fields: are all editable inline?
**VistA:** 44
**Fix:** Some fields may be read-only in our UI but editable in terminal.
**Verify:** Each field clickable → saves to File 44

### 🟢 #161 [MEDIUM] [WardMgmt] Ward create: does it exist?
**VistA:** 42
**Fix:** handleCreate found but verify it actually creates in File 42.
**Verify:** Create ward → M: verify in File 42

### 🟢 #162 [MEDIUM] [WardMgmt] Ward bed count: is it calculated from File 405.4 or hardcoded?
**VistA:** 42
**Fix:** Bed count should come from actual Room-Bed file sub-entries.
**Verify:** M: count beds in File 405.4 for this ward → UI matches

### ⚪ #163 [LOW] [WardMgmt] No ward occupancy display (current patients)
**VistA:** 42
**Fix:** Census data exists via ZVE ADT CENSUS but not shown in admin.
**Verify:** Show occupancy: "12/20 beds (60%)"

### 🟢 #164 [MEDIUM] [DeviceMgmt] Device test print: verify output actually reaches the device
**VistA:** 3.5
**Fix:** Server calls ZVE DEV TESTPRINT but was this routine deployed and working?
**Verify:** Test print → verify output at M prompt or device queue

### 🟢 #165 [MEDIUM] [DeviceMgmt] Device create: does it write all required File 3.5 fields?
**VistA:** 3.5
**Fix:** Terminal device setup requires margin, page length, type. Our create may only set name.
**Verify:** Create device → M: verify all fields in File 3.5

### ⚪ #166 [LOW] [DeviceMgmt] No device status monitoring (online/offline)
**VistA:** 3.5
**Fix:** Static list. No live status.
**Verify:** Periodic status check per device

### 🟢 #167 [MEDIUM] [MailGrpMgmt] Group descriptions not loaded — names are VistA jargon
**VistA:** 3.8
**Fix:** IRM MAIL GROUP, OR ALERTS are meaningless to non-VistA users.
**Verify:** Load File 3.8 field 5.1 (description) and show alongside name

### 🟢 #168 [MEDIUM] [MailGrpMgmt] No group creation from UI
**VistA:** 3.8
**Fix:** Can only manage existing groups. Terminal can create.
**Verify:** Add create group with name + description

### ⚪ #169 [LOW] [MailGrpMgmt] No group member count shown in list
**VistA:** 3.8
**Fix:** Must click each group to see how many members.
**Verify:** Show member count badge in group list

### 🟢 #170 [MEDIUM] [DeptService] Department delete has no user assignment check
**VistA:** 49
**Fix:** Can delete department that has users assigned to it.
**Verify:** Block delete if users assigned: "3 users in this department"

### ⚪ #171 [LOW] [DeptService] No department hierarchy/org chart
**VistA:** 49
**Fix:** Flat list only.
**Verify:** Add parent-child relationship or tree view

### 🟢 #172 [MEDIUM] [SiteMgmt] Site delete has no user assignment check
**VistA:** 4
**Fix:** Can delete facility with assigned users.
**Verify:** Block delete if users assigned

### 🟢 #173 [MEDIUM] [SiteMgmt] Custom role CRUD: does create/delete work end-to-end?
**VistA:** 4/ZVESITEV
**Fix:** createCustomRole and deleteCustomRole RPCs exist. Verify.
**Verify:** Create custom role → M: verify in ^ZVEX → assign to user → works

### 🟢 #174 [MEDIUM] [SiteParams] Module parameters: some may write to wrong file
**VistA:** 8989.3
**Fix:** Package params routed through DDR FILER but file number may differ per package.
**Verify:** Edit Pharmacy param → M: verify in correct file

### ⚪ #175 [LOW] [SiteParams] No recommended value ranges shown
**VistA:** 8989.3
**Fix:** Admin doesn't know what values are safe.
**Verify:** Show "Recommended: 900 (15 min)" next to timeout

### ⚪ #176 [LOW] [SiteParams] No parameter change history
**VistA:** 8989.3
**Fix:** Can't see what was changed when.
**Verify:** Show last 5 changes per parameter from audit log

### ⚪ #177 [LOW] [SystemConfig] Most fields read-only — page feels useless
**VistA:** Vista
**Fix:** Only welcome message and broker timeout editable.
**Verify:** Add explanations: "This field is set during installation and cannot be changed here."

### 🟢 #178 [MEDIUM] [SystemConfig] Welcome message has no preview
**VistA:** Vista
**Fix:** Edit text but can't see how it looks on the login screen.
**Verify:** Add "Preview" button showing login page with the message

### 🟢 #179 [MEDIUM] [SystemHealth] HL7 status section: verify data loads after deployment
**VistA:** Vista
**Fix:** ZVEHLFIL.m now deployed. Verify the HL7 section loads real data.
**Verify:** SystemHealth → HL7 tab → shows interface statuses

### 🟢 #180 [MEDIUM] [SystemHealth] TaskMan status: verify data loads after deployment
**VistA:** Vista
**Fix:** ZVETMCTL.m now deployed. Verify TaskMan section loads.
**Verify:** SystemHealth → TaskMan → shows running/stopped

### ⚪ #181 [LOW] [SystemHealth] No alert thresholds for health metrics
**VistA:** Vista
**Fix:** No notification when a system component fails.
**Verify:** Set threshold: "Alert if HL7 filer stopped for >5 min"

### ⚪ #182 [LOW] [SystemHealth] No historical uptime tracking
**VistA:** Vista
**Fix:** Point-in-time snapshot only.
**Verify:** Track and display uptime percentage over 24h/7d/30d

### ⚪ #217 [LOW] [DataTable] Table rows not keyboard navigable
**VistA:** A11y
**Fix:** Can't use arrow keys to navigate.
**Verify:** Arrow key navigation + Enter to select

### 🟢 #224 [MEDIUM] [MailGrpMgmt] Mail group names are VistA jargon
**VistA:** Terms
**Fix:** IRM MAIL GROUP, OR ALERTS meaningless. Show description.
**Verify:** Load File 3.8 description field

### 🟢 #274 [MEDIUM] [ClinicMgmt] Create clinic → edit name → inactivate → reactivate
**VistA:** E2E
**Fix:** Full clinic lifecycle.
**Verify:** Create → M: File 44 → edit → M: check → inactivate → M: flag set

### 🟢 #275 [MEDIUM] [MailGrpMgmt] View members → add member → remove member
**VistA:** E2E
**Fix:** Full mail group member lifecycle.
**Verify:** Add → M: File 3.8 sub-file → remove → M: gone

### 🟢 #276 [MEDIUM] [AlertsNotify] Send MailMan message → verify in VistA MailMan
**VistA:** E2E
**Fix:** Full message send.
**Verify:** Send → M: check ^XMB → message exists

### 🟢 #277 [MEDIUM] [DeviceMgmt] Create device → test print → delete
**VistA:** E2E
**Fix:** Full device lifecycle.
**Verify:** Create → M: File 3.5 → test print → delete → M: gone

---

# SECTION 7: PATIENT REGISTRATION & ADT

### 🟢 #280 [MEDIUM] [PatientSearch] Search by name: does partial match work?
**VistA:** 2
**Fix:** VistA name search uses B-tree. Partial prefix only — no substring.
**Verify:** Search "SMI" → finds SMITH. Search "MITH" → may not find SMITH

### 🟢 #281 [MEDIUM] [PatientSearch] Search by SSN: full SSN required or last 4?
**VistA:** 2
**Fix:** SSN search may need full 9 digits. Last-4 search requires different index.
**Verify:** Search "5678" (last 4) → verify results

### 🟢 #282 [MEDIUM] [PatientSearch] Duplicate detection: does it run before registration?
**VistA:** 2
**Fix:** Terminal checks for duplicates before creating. Our flow?
**Verify:** Register SMITH,JOHN 1990-01-01 → duplicate check before creation

### ⚪ #283 [LOW] [PatientSearch] No recent patients shortcut
**VistA:** 2
**Fix:** Terminal has "Select recent patient." We may not have this.
**Verify:** Show recently accessed patients

### 🟢 #284 [MEDIUM] [PatientSearch] Search results: does it include inactive/deceased patients?
**VistA:** 2
**Fix:** May need to filter or flag.
**Verify:** Deceased patient shows flag in results

### 🟢 #285 [MEDIUM] [PatientDemo] Registration: how many of the 60+ File 2 fields are captured?
**VistA:** 2
**Fix:** Terminal registration captures extensive demographics. Our form?
**Verify:** Compare our form fields vs terminal registration fields

### 🟢 #286 [MEDIUM] [PatientDemo] Address validation: do we validate state/zip format?
**VistA:** 2
**Fix:** ZIP should be 5 or 9 digits. State should be valid 2-letter code.
**Verify:** Enter invalid ZIP → error. Enter "XX" state → error

### 🟢 #287 [MEDIUM] [PatientDemo] Veteran status: does it correctly set VistA eligibility flags?
**VistA:** 2
**Fix:** VETERAN field affects eligibility determination.
**Verify:** Register veteran → M: check eligibility fields

### 🟢 #288 [MEDIUM] [PatientDemo] Service-connected percentage: validated range 0-100?
**VistA:** 2
**Fix:** SC% must be 0-100 in increments of 10.
**Verify:** Enter 150% → error. Enter 50% → accepted

### 🟢 #289 [MEDIUM] [PatientDemo] Emergency contact: stored in VistA?
**VistA:** 2
**Fix:** File 2 has emergency contact sub-file (.33). Are we capturing?
**Verify:** Enter emergency contact → M: check File 2 sub-file

### 🟢 #290 [MEDIUM] [PatientDemo] Race/ethnicity: multi-select or single?
**VistA:** 2
**Fix:** VistA supports multiple race entries. Our UI?
**Verify:** Select multiple races → saved correctly

### ⚪ #291 [LOW] [PatientDemo] No patient photo capture
**VistA:** 2
**Fix:** Modern systems capture photos for identification.
**Verify:** Add photo capture or upload

### 🟢 #292 [MEDIUM] [PatientDemo] Religion: does the picker match File 13 entries?
**VistA:** 2
**Fix:** VistA religion is pointer to File 13.
**Verify:** Select religion → M: pointer stored correctly

### 🟢 #293 [MEDIUM] [PatientDemo] Marital status: does the dropdown match File 11 entries?
**VistA:** 2
**Fix:** VistA marital status pointer to File 11.
**Verify:** Select married → M: correct pointer

### 🟢 #294 [MEDIUM] [Insurance] Insurance create: does it write to File 2.312 sub-file?
**VistA:** 2.312
**Fix:** Insurance is a complex sub-file with many required fields.
**Verify:** Add insurance → M: check File 2.312

### 🟢 #295 [MEDIUM] [Insurance] Insurance subscriber info: name, DOB, relationship captured?
**VistA:** 2.312
**Fix:** Sub-file has subscriber fields that must be populated.
**Verify:** Enter subscriber → M: check sub-file fields

### 🟢 #296 [MEDIUM] [Insurance] Insurance company: pointer to File 36 — does picker work?
**VistA:** 36
**Fix:** Must select from existing insurance companies in File 36.
**Verify:** Select Blue Cross → M: pointer to File 36 entry

### ⚪ #297 [LOW] [Insurance] No insurance card image upload
**VistA:** 2.312
**Fix:** Modern systems scan insurance cards.
**Verify:** Upload card image → stored and viewable

### 🟢 #298 [MEDIUM] [Insurance] Insurance edit: can you change plan details?
**VistA:** 2.312
**Fix:** Some fields may be read-only after creation.
**Verify:** Edit insurance group number → saves

### 🟢 #299 [MEDIUM] [Financial] Means test: does it write to File 408.31?
**VistA:** 408.31
**Fix:** Means test determines copay/cost-sharing.
**Verify:** Complete means test → M: check File 408.31

### 🟢 #300 [MEDIUM] [Financial] Means test income thresholds: are they current year?
**VistA:** 408.31
**Fix:** VHA updates income thresholds annually.
**Verify:** Thresholds match current VHA guidelines

### 🟢 #301 [MEDIUM] [Financial] Means test result: GMT/HVT/MT classification correct?
**VistA:** 408.31
**Fix:** Classification based on income + dependents + geographic area.
**Verify:** Enter income → correct classification shown

### ⚪ #302 [LOW] [Financial] No financial counseling notes
**VistA:** 408.31
**Fix:** Terminal allows adding notes to means test.
**Verify:** Add notes field → M: check File 408.31

### 🟢 #303 [MEDIUM] [PatientFlags] Flag creation: does it write correctly?
**VistA:** 26.13
**Fix:** Flags are complex: type (local/national), narrative, review date.
**Verify:** Create flag → M: check File 26.13

### 🟢 #304 [MEDIUM] [PatientFlags] Flag types: do they match VistA flag categories?
**VistA:** 26.13
**Fix:** VistA has specific flag types (behavioral, clinical, admin).
**Verify:** Flag type dropdown matches VistA categories

### ⚪ #305 [LOW] [PatientFlags] Flag review workflow: does it set review date?
**VistA:** 26.13
**Fix:** Flags should have periodic review.
**Verify:** Create flag with review date → M: review date stored

### 🟢 #306 [MEDIUM] [Admission] Admission: does it write movement to File 405?
**VistA:** 405
**Fix:** ADT movements are critical. Must create correct movement type.
**Verify:** Admit patient → M: check File 405 for movement

### 🟢 #307 [MEDIUM] [Admission] Ward validation: does ward picker show only active wards?
**VistA:** 405
**Fix:** Inactive wards should not appear in admission picker.
**Verify:** Inactive ward not shown in dropdown

### 🟢 #308 [MEDIUM] [Admission] Attending physician: pointer validation
**VistA:** 405
**Fix:** Must be a valid provider with PROVIDER key.
**Verify:** Select attending → M: valid provider pointer

### ⚪ #309 [LOW] [Admission] No bed availability display before admission
**VistA:** 405
**Fix:** Should show available beds in selected ward.
**Verify:** Select ward → show "12 of 20 beds available"

### 🟢 #310 [MEDIUM] [Discharge] Discharge: does it create correct movement type?
**VistA:** 405
**Fix:** Discharge movement must reference admission movement.
**Verify:** Discharge → M: correct movement type in File 405

### 🟢 #311 [MEDIUM] [Discharge] Disposition: does it match File 37 entries?
**VistA:** 405
**Fix:** Disposition pointer to File 37.
**Verify:** Select disposition → M: pointer correct

### ⚪ #312 [LOW] [Discharge] No discharge summary prompt
**VistA:** 405
**Fix:** Should prompt for discharge summary creation.
**Verify:** Discharge → "Create discharge summary?" prompt

### 🟢 #313 [MEDIUM] [Transfer] Transfer: does it create movement and update bed assignment?
**VistA:** 405
**Fix:** Transfer = discharge from Ward A + admit to Ward B.
**Verify:** Transfer → M: two movements in File 405 + bed update

### ⚪ #314 [LOW] [Transfer] No transfer reason required
**VistA:** 405
**Fix:** Terminal requires reason. Our UI may not.
**Verify:** Require transfer reason → M: stored

### 🟢 #315 [MEDIUM] [BedMgmt] Bed assignment: does it update Room-Bed file?
**VistA:** 405.4
**Fix:** File 405.4 tracks bed assignments.
**Verify:** Assign bed → M: check File 405.4

### ⚪ #316 [LOW] [BedMgmt] No bed cleaning/status tracking
**VistA:** 405.4
**Fix:** No way to mark beds as clean/dirty/occupied.
**Verify:** Bed status: Available / Occupied / Cleaning

### 🟢 #317 [MEDIUM] [RecordRestrict] Sensitive patient: does flag set DG SENSITIVITY?
**VistA:** 2
**Fix:** Sensitive record access requires DG SENSITIVITY key.
**Verify:** Mark sensitive → M: check sensitivity flag

### ⚪ #318 [LOW] [RecordRestrict] No access log for restricted records
**VistA:** 2
**Fix:** Can't see who accessed a restricted patient.
**Verify:** Show access log per sensitive patient

### 🟢 #319 [MEDIUM] [RegReports] Registration reports: do they pull real data?
**VistA:** 2
**Fix:** Reports should query VistA, not cache.
**Verify:** Run "patients registered today" → accurate count

### ⚪ #320 [LOW] [RegReports] No report scheduling
**VistA:** 2
**Fix:** Manual run only.
**Verify:** Schedule daily report → email

### 🟢 #321 [MEDIUM] [PatientDash] Dashboard stats: live from VistA?
**VistA:** 2
**Fix:** Census, admissions today, discharges today — real numbers?
**Verify:** Dashboard counts match M prompt queries

### ⚪ #322 [LOW] [PatientDash] No patient satisfaction integration
**VistA:** 2
**Fix:** Modern dashboards show satisfaction scores.
**Verify:** Placeholder for satisfaction data

### 🟢 #323 [MEDIUM] [PatientGlobal] Patient search after registration: does new patient appear?
**VistA:** 2
**Fix:** After registration, search should find the patient immediately.
**Verify:** Register JONES,MARY → search JONES → found

### 🟢 #324 [MEDIUM] [PatientGlobal] Patient edit: does it work for all demographic fields?
**VistA:** 2
**Fix:** Edit each field → verify at M prompt.
**Verify:** Edit phone → M: check field .131 → correct

### 🟢 #325 [MEDIUM] [PatientGlobal] Eligibility determination: does ZVE PATIENT ELIG return correct data?
**VistA:** 2
**Fix:** Eligibility is complex: SC status, means test, insurance, etc.
**Verify:** Check eligibility → matches terminal display

### ⚪ #326 [LOW] [PatientGlobal] No patient merge/duplicate resolution
**VistA:** 2
**Fix:** If duplicates exist, no way to merge.
**Verify:** Duplicate resolution workflow

### ⚪ #327 [LOW] [PatientGlobal] No patient portal link/integration
**VistA:** 2
**Fix:** No patient-facing features.
**Verify:** Placeholder for patient portal

---

# SECTION 8: TERMINAL COMPARISON — Admin

### 🟢 #340 [MEDIUM] [Terminal] EVE→User Mgmt→Add New User: Our wizard creates but may miss fields terminal captures (e.g., Remarks, Date Entered, Creator)
**VistA:** 200
**Fix:** Check if VistA auto-populates Date Entered (field 7.1) and Creator. If not, add via M routine.
**Verify:** Create user → M: W $$GET1^DIQ(200,DUZ_",",7.1) → date exists

### 🟢 #341 [MEDIUM] [Terminal] EVE→User Mgmt→Edit User: Terminal allows editing ALL fields. Our edit mode only handles FIELD_MAP fields.
**VistA:** 200
**Fix:** Add any missing editable fields to FIELD_MAP/ALLOW.
**Verify:** Compare terminal edit fields vs our FIELD_MAP keys

### 🟢 #342 [MEDIUM] [Terminal] EVE→User Mgmt→User Inquiry: Terminal shows ALL file 200 data. Our detail panel may miss some.
**VistA:** 200
**Fix:** Compare detail panel fields vs terminal User Inquiry output.
**Verify:** Terminal shows field X → detail panel shows it too

### 🟢 #343 [MEDIUM] [Terminal] EVE→User Mgmt→List Users: Terminal can list by division, by key, by last login date.
**VistA:** 200
**Fix:** Our list has division filter + status. Add "by key" and "by last login range".
**Verify:** Filter by ORES key → shows only ORES holders

### 🟢 #344 [MEDIUM] [Terminal] EVE→User Mgmt→User Security Report: Terminal generates security audit per user.
**VistA:** 200
**Fix:** Add security report button to detail panel.
**Verify:** Click → report showing all access, keys, last login, lockouts

### 🟢 #345 [MEDIUM] [Terminal] EVE→User Mgmt→Activate/Inactivate CPRS Context: Terminal-specific but relevant for CPRS access control.
**VistA:** 200
**Fix:** Verify our CPRS tab toggle maps to the same VistA mechanism.
**Verify:** Toggle CPRS tab → M: check context activation state

### 🟢 #346 [MEDIUM] [Terminal] EVE→Key Mgmt→Allocate Key to User(s): Terminal allows batch allocation to multiple users at once.
**VistA:** 19.1
**Fix:** Our PermsCatalog has batch assign. Verify it works for 10+ users.
**Verify:** Batch assign ORES to 10 users → all get it

### 🟢 #347 [MEDIUM] [Terminal] EVE→Key Mgmt→De-allocate Key from User(s): Terminal has batch de-allocation.
**VistA:** 19.1
**Fix:** Our PermsCatalog may not have batch remove. Add it.
**Verify:** Batch remove ORELSE from 5 users → all lose it

### 🟢 #348 [MEDIUM] [Terminal] EVE→Key Mgmt→Show Keys of a User: Terminal shows keys with dates assigned.
**VistA:** 19.1
**Fix:** Our permission list shows keys but no assignment date.
**Verify:** Show: "ORES — assigned Jan 15, 2026"

### ⚪ #349 [LOW] [Terminal] EVE→Key Mgmt→Show Holders of a Key: Terminal shows all holders with division.
**VistA:** 19.1
**Fix:** Our PermsCatalog shows holders. Verify division shown.
**Verify:** Click ORES → holders with their facility shown

### ⚪ #350 [LOW] [Terminal] EVE→Key Mgmt→Key Usage Statistics: Terminal-era feature. Show how many holders per key.
**VistA:** 19.1
**Fix:** Add key holder count to PermsCatalog list view.
**Verify:** Each key shows "(45 holders)"

### ⚪ #351 [LOW] [Terminal] EVE→Menu Mgmt→Assign Primary Menu: Terminal sets field 201.
**VistA:** 19
**Fix:** Our wizard can set primaryMenu but no UI selector. Add dropdown.
**Verify:** Select CPRS from dropdown → M: field 201 = CPRS

### ⚪ #352 [LOW] [Terminal] EVE→Menu Mgmt→Assign Secondary Menu: Terminal allows secondary menu options.
**VistA:** 19
**Fix:** secondaryFeatures in payload but not processed.
**Verify:** Select secondary options → saved to VistA

### 🟢 #353 [MEDIUM] [Terminal] EVE→Menu Mgmt→Display User Menus: Terminal shows complete menu tree for a user.
**VistA:** 19
**Fix:** No equivalent in our UI. User's menu tree not visible.
**Verify:** Add "View Menu Tree" to detail panel

### 🟢 #354 [MEDIUM] [Terminal] EVE→Device Mgmt→Set Up a Device: Terminal creates with margin, page length, type, host file.
**VistA:** 3.5
**Fix:** Our create only sends name. Need more fields for functional device.
**Verify:** Create device with all required File 3.5 fields

### 🟢 #355 [MEDIUM] [Terminal] EVE→Device Mgmt→Delete a Device: Terminal checks for active references.
**VistA:** 3.5
**Fix:** Our delete may not check for references. Verify.
**Verify:** Delete device → no orphaned references

### 🟢 #356 [MEDIUM] [Terminal] EVE→Device Mgmt→Terminal Type: Terminal configures File 3.2.
**VistA:** 3.5
**Fix:** Our DeviceMgmt may show terminal types but can they be edited?
**Verify:** Edit terminal type → saves to File 3.2

### 🟢 #357 [MEDIUM] [Terminal] EVE→TaskMan→Schedule/Unschedule Tasks: Terminal can schedule FileMan tasks.
**VistA:** 14.4
**Fix:** Our SystemHealth shows TaskMan status but can't schedule.
**Verify:** Add schedule/unschedule capabilities

### ⚪ #358 [LOW] [Terminal] EVE→TaskMan→Requeue Task: Terminal can requeue failed tasks.
**VistA:** 14.4
**Fix:** No equivalent. Add if possible.
**Verify:** Requeue failed task → M: task restarted

### ⚪ #359 [LOW] [Terminal] EVE→TaskMan→Delete Task: Terminal can delete scheduled tasks.
**VistA:** 14.4
**Fix:** No equivalent. Add if possible.
**Verify:** Delete task → M: task removed from File 14.4

### 🟢 #360 [MEDIUM] [Terminal] EVE→MailMan→Send Message: Terminal has rich addressing (G.group, I.user, etc).
**VistA:** 3.9
**Fix:** Our compose only takes one DUZ recipient. Add group sending.
**Verify:** Send to mail group → all members receive

### 🟢 #361 [MEDIUM] [Terminal] EVE→MailMan→Read Message: Terminal shows full thread with responses.
**VistA:** 3.9
**Fix:** Our read shows single message. No thread view.
**Verify:** View thread → shows all replies in order

### 🟢 #362 [MEDIUM] [Terminal] EVE→MailMan→Forward Message: Terminal can forward messages.
**VistA:** 3.9
**Fix:** No forward capability in our UI.
**Verify:** Forward button → select recipient → forwarded

### ⚪ #363 [LOW] [Terminal] EVE→MailMan→Manage Baskets: Terminal has custom mail baskets/folders.
**VistA:** 3.9
**Fix:** Our UI has Inbox/Sent/Deleted only. Add custom baskets.
**Verify:** Create basket → move messages into it

### 🟢 #364 [MEDIUM] [Terminal] EVE→Kernel→Site Parameters: Terminal edits 50+ parameters.
**VistA:** 8989.3
**Fix:** Our SiteParameters handles some. May miss many.
**Verify:** Compare our parameter list vs terminal parameter list

### 🟢 #365 [MEDIUM] [Terminal] EVE→Kernel→Prohibited Times: Restrict login during certain hours.
**VistA:** 8989.3
**Fix:** No equivalent in our SecurityAuth.
**Verify:** Add prohibited time range setting

### ⚪ #366 [LOW] [Terminal] EVE→Kernel→Welcome Message: Terminal sets login banner.
**VistA:** 8989.3
**Fix:** Our SystemConfig has welcome message editor. Verify it saves.
**Verify:** Edit welcome → M: W ^XTV(8989.3,1,"INTRO") → shows text

### 🟢 #367 [MEDIUM] [Terminal] EVE→Audit→FileMan Audit Trail: Terminal shows per-file audit.
**VistA:** 1.1
**Fix:** Our AuditLog shows combined. Add per-file filter.
**Verify:** Filter audit to "File 200 only" → shows user changes

### ⚪ #368 [LOW] [Terminal] EVE→Audit→Purge Audit Trail: Terminal can purge old entries.
**VistA:** 1.1
**Fix:** No purge capability. Add with date range.
**Verify:** Purge audits older than 1 year → confirmed

### 🟢 #369 [MEDIUM] [Terminal] EVE→Division→Set Up Division: Terminal creates divisions in File 4.
**VistA:** 4
**Fix:** Our SiteMgmt may not create divisions. Verify.
**Verify:** Create new division → M: File 4 entry exists

### 🟢 #370 [MEDIUM] [Terminal] EVE→Division→Delete Division: Terminal deletes with checks.
**VistA:** 4
**Fix:** Our delete may not verify no users assigned.
**Verify:** Delete division with users → blocked

---

# SECTION 9: TERMINAL COMPARISON — Patient/ADT

### 🟢 #371 [MEDIUM] [Terminal-Pat] ADT→Register Patient: Terminal captures 90+ fields including employer, religion, race, ethnicity, place of birth, mother's maiden name
**VistA:** 2
**Fix:** Our registration captures maybe 15 fields. Need to add more.
**Verify:** Compare field count: terminal vs our form

### 🟢 #372 [MEDIUM] [Terminal-Pat] ADT→Register Patient: Terminal sets TREATING SPECIALTY on admission
**VistA:** 2
**Fix:** File 2 field 45.7. Not captured in our admission.
**Verify:** Admit patient → M: check treating specialty

### 🟢 #373 [MEDIUM] [Terminal-Pat] ADT→Means Test: Terminal has 40+ income/asset fields
**VistA:** 2
**Fix:** Our FinancialAssessment may have fewer. Compare.
**Verify:** Compare means test field count

### 🟢 #374 [MEDIUM] [Terminal-Pat] ADT→Eligibility Verification: Terminal runs real-time eligibility check
**VistA:** 2
**Fix:** Our eligibility display may be read-only. Need real-time check.
**Verify:** Run eligibility check → current result from VistA

### 🟢 #375 [MEDIUM] [Terminal-Pat] ADT→Patient Sensitivity: Terminal supports 3 levels (employee,38 USC 7332, HIV)
**VistA:** 2
**Fix:** Our RecordRestrictions may not distinguish sensitivity levels.
**Verify:** Set level-2 sensitivity → M: correct flag

### ⚪ #376 [LOW] [Terminal-Pat] ADT→Combat Veteran: Terminal tracks combat episode dates and theater
**VistA:** 2
**Fix:** File 2 has combat veteran fields. Our demographics?
**Verify:** Enter combat dates → M: stored correctly

### ⚪ #377 [LOW] [Terminal-Pat] ADT→POW Status: Terminal captures POW information
**VistA:** 2
**Fix:** File 2 has POW fields. May not be in our form.
**Verify:** Enter POW status → M: stored

### 🟢 #378 [MEDIUM] [Terminal-Pat] ADT→Enrollment: Terminal manages VA enrollment status and priority groups
**VistA:** 2
**Fix:** File 27.11 enrollment data. Our form?
**Verify:** Enrollment group shown → matches VistA

### 🟢 #379 [MEDIUM] [Terminal-Pat] ADT→Bed Control: Terminal shows real-time census with movement tracking
**VistA:** 405
**Fix:** Our BedMgmt may be simpler. Compare features.
**Verify:** Census matches M: D CENSUS^ZVEADT

### 🟢 #380 [MEDIUM] [Terminal-Pat] ADT→Scheduled Admissions: Terminal manages pre-admission scheduling
**VistA:** 405
**Fix:** No equivalent in our system.
**Verify:** Add pre-admission scheduling

### ⚪ #381 [LOW] [Terminal-Pat] ADT→Treating Specialty Report: Terminal generates specialty-based reports
**VistA:** 405
**Fix:** No equivalent. Add to RegistrationReports.
**Verify:** Run treating specialty report → data correct

### ⚪ #382 [LOW] [Terminal-Pat] ADT→Patient Merge: Terminal has duplicate resolution and merge
**VistA:** 2
**Fix:** No equivalent in our system.
**Verify:** Build duplicate resolution workflow

### 🟢 #383 [MEDIUM] [Terminal-Pat] Registration→Country of Birth: File 2 field .092
**VistA:** 2
**Fix:** Not in our demographics form. Add.
**Verify:** Enter country → M: stored in .092

### 🟢 #384 [MEDIUM] [Terminal-Pat] Registration→Mother Maiden Name: File 2 field .2403
**VistA:** 2
**Fix:** Not in our demographics form. Add.
**Verify:** Enter maiden name → M: stored in .2403

### 🟢 #385 [MEDIUM] [Terminal-Pat] Registration→Employer: File 2 fields .3111-.3116
**VistA:** 2
**Fix:** Not in our demographics form. Multiple employer fields.
**Verify:** Enter employer → M: check .3111-.3116

### ⚪ #386 [LOW] [Terminal-Pat] Registration→Next of Kin: File 2 sub-file .211
**VistA:** 2
**Fix:** May not be in our form.
**Verify:** Enter NOK → M: sub-file populated

### ⚪ #387 [LOW] [Terminal-Pat] Registration→Spinal Cord Injury: File 2 field 57
**VistA:** 2
**Fix:** Specialized field for VA use. May not be in our form.
**Verify:** Enter SCI → M: stored in field 57

### 🟢 #388 [MEDIUM] [Terminal-Pat] Registration→Service Dates: Active duty start/end, branch of service
**VistA:** 2
**Fix:** File 2 military history fields .3211-.3216.
**Verify:** Enter military dates → M: stored correctly

### ⚪ #389 [LOW] [Terminal-Pat] Registration→Agent Orange Exposure: File 2 field .321101
**VistA:** 2
**Fix:** Environmental exposure tracking.
**Verify:** Enter AO exposure → M: stored

### ⚪ #390 [LOW] [Terminal-Pat] Registration→Radiation Exposure: File 2 field .3213
**VistA:** 2
**Fix:** Environmental exposure tracking.
**Verify:** Enter radiation exposure → M: stored

---

# SECTION 10: PER-PAGE DEEP UX AUDIT — Admin

### ⚪ #391 [LOW] [AdminDash] Cards should show loading skeleton, not spinner
**VistA:** UX
**Fix:** Implement or fix: Cards should show loading skeleton, not spinner
**Verify:** Verify the feature works end-to-end

### ⚪ #392 [LOW] [AdminDash] Cards should have subtle animation on count change
**VistA:** UX
**Fix:** Implement or fix: Cards should have subtle animation on count change
**Verify:** Verify the feature works end-to-end

### ⚪ #393 [LOW] [AdminDash] Last refresh timestamp shown
**VistA:** UX
**Fix:** Implement or fix: Last refresh timestamp shown
**Verify:** Verify the feature works end-to-end

### 🟢 #394 [MEDIUM] [AdminDash] Cards should be configurable (show/hide)
**VistA:** UX
**Fix:** Implement or fix: Cards should be configurable (show/hide)
**Verify:** Verify the feature works end-to-end

### ⚪ #395 [LOW] [AdminDash] Quick action buttons below cards: New User, View Audit, System Status
**VistA:** UX
**Fix:** Implement or fix: Quick action buttons below cards: New User, View Audit, System Status
**Verify:** Verify the feature works end-to-end

### ⚪ #396 [LOW] [AdminDash] No welcome message for first-time admin
**VistA:** UX
**Fix:** Implement or fix: No welcome message for first-time admin
**Verify:** Verify the feature works end-to-end

### ⚪ #397 [LOW] [AdminDash] No system status summary (VistA connected, Docker up)
**VistA:** UX
**Fix:** Implement or fix: No system status summary (VistA connected, Docker up)
**Verify:** Verify the feature works end-to-end

### 🟢 #398 [MEDIUM] [AdminDash] Cards don't handle VistA-down state gracefully
**VistA:** UX
**Fix:** Implement or fix: Cards don't handle VistA-down state gracefully
**Verify:** Verify the feature works end-to-end

### ⚪ #399 [LOW] [AdminDash] No mobile-friendly card layout
**VistA:** UX
**Fix:** Implement or fix: No mobile-friendly card layout
**Verify:** Verify the feature works end-to-end

### ⚪ #400 [LOW] [AdminDash] No chart/graph visualization of user trends
**VistA:** UX
**Fix:** Implement or fix: No chart/graph visualization of user trends
**Verify:** Verify the feature works end-to-end

### 🟢 #401 [MEDIUM] [StaffForm] No form state persistence across page navigations
**VistA:** UX
**Fix:** Implement or fix: No form state persistence across page navigations
**Verify:** Verify the feature works end-to-end

### ⚪ #402 [LOW] [StaffForm] No character count on text fields
**VistA:** UX
**Fix:** Implement or fix: No character count on text fields
**Verify:** Verify the feature works end-to-end

### ⚪ #403 [LOW] [StaffForm] No tooltip help on each field
**VistA:** UX
**Fix:** Implement or fix: No tooltip help on each field
**Verify:** Verify the feature works end-to-end

### 🟢 #404 [MEDIUM] [StaffForm] Provider step: specialty/sub-specialty not captured (File 200 field 29.5)
**VistA:** UX
**Fix:** Implement or fix: Provider step: specialty/sub-specialty not captured (File 200 field 29.5)
**Verify:** Verify the feature works end-to-end

### 🟢 #405 [MEDIUM] [StaffForm] No ability to attach documents/certifications to user record
**VistA:** UX
**Fix:** Implement or fix: No ability to attach documents/certifications to user record
**Verify:** Verify the feature works end-to-end

### ⚪ #406 [LOW] [StaffForm] No automatic username generation from name
**VistA:** UX
**Fix:** Implement or fix: No automatic username generation from name
**Verify:** Verify the feature works end-to-end

### ⚪ #407 [LOW] [StaffForm] No password generator button
**VistA:** UX
**Fix:** Implement or fix: No password generator button
**Verify:** Verify the feature works end-to-end

### 🟢 #408 [MEDIUM] [StaffForm] Credential step: no verification that access code meets VistA Kernel rules
**VistA:** UX
**Fix:** Implement or fix: Credential step: no verification that access code meets VistA Kernel rules
**Verify:** Verify the feature works end-to-end

### ⚪ #409 [LOW] [StaffForm] No progress save/resume if browser crashes
**VistA:** UX
**Fix:** Implement or fix: No progress save/resume if browser crashes
**Verify:** Verify the feature works end-to-end

### ⚪ #410 [LOW] [StaffForm] No keyboard-only wizard navigation (Tab through fields, Enter for Next)
**VistA:** UX
**Fix:** Implement or fix: No keyboard-only wizard navigation (Tab through fields, Enter for Next)
**Verify:** Verify the feature works end-to-end

### 🟢 #411 [MEDIUM] [StaffForm] Provider step: medical school (field 53.4) not captured
**VistA:** UX
**Fix:** Implement or fix: Provider step: medical school (field 53.4) not captured
**Verify:** Verify the feature works end-to-end

### 🟢 #412 [MEDIUM] [StaffForm] Provider step: internship/residency dates not captured
**VistA:** UX
**Fix:** Implement or fix: Provider step: internship/residency dates not captured
**Verify:** Verify the feature works end-to-end

### ⚪ #413 [LOW] [StaffForm] Review step: no PDF generation of the review summary
**VistA:** UX
**Fix:** Implement or fix: Review step: no PDF generation of the review summary
**Verify:** Verify the feature works end-to-end

### 🟢 #414 [MEDIUM] [StaffDirectory] Selected row highlight lost on sort/filter change
**VistA:** UX
**Fix:** Implement or fix: Selected row highlight lost on sort/filter change
**Verify:** Verify the feature works end-to-end

### ⚪ #415 [LOW] [StaffDirectory] No staff list export as PDF (only CSV)
**VistA:** UX
**Fix:** Implement or fix: No staff list export as PDF (only CSV)
**Verify:** Verify the feature works end-to-end

### ⚪ #416 [LOW] [StaffDirectory] No drag-and-drop column reorder
**VistA:** UX
**Fix:** Implement or fix: No drag-and-drop column reorder
**Verify:** Verify the feature works end-to-end

### 🟢 #417 [MEDIUM] [StaffDirectory] Detail panel doesn't auto-close when clicking another nav item
**VistA:** UX
**Fix:** Implement or fix: Detail panel doesn't auto-close when clicking another nav item
**Verify:** Verify the feature works end-to-end

### ⚪ #418 [LOW] [StaffDirectory] No right-click context menu on rows
**VistA:** UX
**Fix:** Implement or fix: No right-click context menu on rows
**Verify:** Verify the feature works end-to-end

### 🟢 #419 [MEDIUM] [StaffDirectory] Long department names truncated without tooltip
**VistA:** UX
**Fix:** Implement or fix: Long department names truncated without tooltip
**Verify:** Verify the feature works end-to-end

### ⚪ #420 [LOW] [StaffDirectory] No mini-chart showing user status distribution
**VistA:** UX
**Fix:** Implement or fix: No mini-chart showing user status distribution
**Verify:** Verify the feature works end-to-end

### 🟢 #421 [MEDIUM] [StaffDirectory] Permission removal requires too many clicks (pill → confirm → done)
**VistA:** UX
**Fix:** Implement or fix: Permission removal requires too many clicks (pill → confirm → done)
**Verify:** Verify the feature works end-to-end

### ⚪ #422 [LOW] [StaffDirectory] No batch status change (select multiple → deactivate all)
**VistA:** UX
**Fix:** Implement or fix: No batch status change (select multiple → deactivate all)
**Verify:** Verify the feature works end-to-end

### ⚪ #423 [LOW] [StaffDirectory] No table row striping for readability
**VistA:** UX
**Fix:** Implement or fix: No table row striping for readability
**Verify:** Verify the feature works end-to-end

### 🟢 #424 [MEDIUM] [StaffDirectory] Table doesn't remember column widths after refresh
**VistA:** UX
**Fix:** Implement or fix: Table doesn't remember column widths after refresh
**Verify:** Verify the feature works end-to-end

### ⚪ #425 [LOW] [StaffDirectory] No "Copy DUZ" button in detail panel
**VistA:** UX
**Fix:** Implement or fix: No "Copy DUZ" button in detail panel
**Verify:** Verify the feature works end-to-end

### 🟢 #426 [MEDIUM] [StaffDirectory] Detail panel scroll position resets when switching users
**VistA:** UX
**Fix:** Implement or fix: Detail panel scroll position resets when switching users
**Verify:** Verify the feature works end-to-end

### 🟢 #427 [MEDIUM] [RoleTemplates] Custom role: no validation that name is unique
**VistA:** UX
**Fix:** Implement or fix: Custom role: no validation that name is unique
**Verify:** Verify the feature works end-to-end

### ⚪ #428 [LOW] [RoleTemplates] Custom role: no description field
**VistA:** UX
**Fix:** Implement or fix: Custom role: no description field
**Verify:** Verify the feature works end-to-end

### ⚪ #429 [LOW] [RoleTemplates] Role comparison: can't select two roles and see diff
**VistA:** UX
**Fix:** Implement or fix: Role comparison: can't select two roles and see diff
**Verify:** Verify the feature works end-to-end

### 🟢 #430 [MEDIUM] [RoleTemplates] Role export as JSON/CSV for documentation
**VistA:** UX
**Fix:** Implement or fix: Role export as JSON/CSV for documentation
**Verify:** Verify the feature works end-to-end

### ⚪ #431 [LOW] [RoleTemplates] Role import from JSON for sharing between facilities
**VistA:** UX
**Fix:** Implement or fix: Role import from JSON for sharing between facilities
**Verify:** Verify the feature works end-to-end

### 🟢 #432 [MEDIUM] [RoleTemplates] Role key reorder: can't arrange keys in meaningful order
**VistA:** UX
**Fix:** Implement or fix: Role key reorder: can't arrange keys in meaningful order
**Verify:** Verify the feature works end-to-end

### ⚪ #433 [LOW] [RoleTemplates] No role usage report (how many users per role)
**VistA:** UX
**Fix:** Implement or fix: No role usage report (how many users per role)
**Verify:** Verify the feature works end-to-end

### 🟢 #434 [MEDIUM] [RoleTemplates] Workspace access grid: what do rw/ro/none actually control?
**VistA:** UX
**Fix:** Implement or fix: Workspace access grid: what do rw/ro/none actually control?
**Verify:** Verify the feature works end-to-end

### ⚪ #435 [LOW] [RoleTemplates] No role change history/audit
**VistA:** UX
**Fix:** Implement or fix: No role change history/audit
**Verify:** Verify the feature works end-to-end

### ⚪ #436 [LOW] [RoleTemplates] No role approval workflow for new custom roles
**VistA:** UX
**Fix:** Implement or fix: No role approval workflow for new custom roles
**Verify:** Verify the feature works end-to-end

### 🟢 #437 [MEDIUM] [PermsCatalog] Advanced mode: 689 keys with no category filter beyond package
**VistA:** UX
**Fix:** Implement or fix: Advanced mode: 689 keys with no category filter beyond package
**Verify:** Verify the feature works end-to-end

### ⚪ #438 [LOW] [PermsCatalog] No key description from VistA File 19.1 field 2
**VistA:** UX
**Fix:** Implement or fix: No key description from VistA File 19.1 field 2
**Verify:** Verify the feature works end-to-end

### 🟢 #439 [MEDIUM] [PermsCatalog] Batch assign: no progress indicator for large batches
**VistA:** UX
**Fix:** Implement or fix: Batch assign: no progress indicator for large batches
**Verify:** Verify the feature works end-to-end

### ⚪ #440 [LOW] [PermsCatalog] No key creation from UI (VistA allows creating custom keys)
**VistA:** UX
**Fix:** Implement or fix: No key creation from UI (VistA allows creating custom keys)
**Verify:** Verify the feature works end-to-end

### ⚪ #441 [LOW] [PermsCatalog] No key dependency visualization (graph/tree)
**VistA:** UX
**Fix:** Implement or fix: No key dependency visualization (graph/tree)
**Verify:** Verify the feature works end-to-end

### 🟢 #442 [MEDIUM] [PermsCatalog] Holders list: pagination needed for keys with 100+ holders
**VistA:** UX
**Fix:** Implement or fix: Holders list: pagination needed for keys with 100+ holders
**Verify:** Verify the feature works end-to-end

### ⚪ #443 [LOW] [PermsCatalog] No deep link to specific key from URL
**VistA:** UX
**Fix:** Implement or fix: No deep link to specific key from URL
**Verify:** Verify the feature works end-to-end

### ⚪ #444 [LOW] [PermsCatalog] No key search by description, not just name
**VistA:** UX
**Fix:** Implement or fix: No key search by description, not just name
**Verify:** Verify the feature works end-to-end

### ⚪ #445 [LOW] [SecurityAuth] Section tabs: no deep link from URL
**VistA:** UX
**Fix:** Implement or fix: Section tabs: no deep link from URL
**Verify:** Verify the feature works end-to-end

### 🟢 #446 [MEDIUM] [SecurityAuth] 2P request: no expiration timer shown
**VistA:** UX
**Fix:** Implement or fix: 2P request: no expiration timer shown
**Verify:** Verify the feature works end-to-end

### ⚪ #447 [LOW] [SecurityAuth] Password policy: no preview of which users would be affected
**VistA:** UX
**Fix:** Implement or fix: Password policy: no preview of which users would be affected
**Verify:** Verify the feature works end-to-end

### ⚪ #448 [LOW] [SecurityAuth] No security audit summary on this page
**VistA:** UX
**Fix:** Implement or fix: No security audit summary on this page
**Verify:** Verify the feature works end-to-end

### ⚪ #449 [LOW] [SecurityAuth] E-sig section is read-only — add explanation why
**VistA:** UX
**Fix:** Implement or fix: E-sig section is read-only — add explanation why
**Verify:** Verify the feature works end-to-end

### 🟢 #450 [MEDIUM] [SecurityAuth] Login section: AUTOLOGOFF value should show human-readable minutes
**VistA:** UX
**Fix:** Implement or fix: Login section: AUTOLOGOFF value should show human-readable minutes
**Verify:** Verify the feature works end-to-end

### ⚪ #451 [LOW] [SecurityAuth] No security compliance score/grade
**VistA:** UX
**Fix:** Implement or fix: No security compliance score/grade
**Verify:** Verify the feature works end-to-end

### 🟢 #452 [MEDIUM] [SiteParams] Module params: error when DD FIELDS returns empty for a module
**VistA:** UX
**Fix:** Implement or fix: Module params: error when DD FIELDS returns empty for a module
**Verify:** Verify the feature works end-to-end

### ⚪ #453 [LOW] [SiteParams] No search across all parameter groups
**VistA:** UX
**Fix:** Implement or fix: No search across all parameter groups
**Verify:** Verify the feature works end-to-end

### ⚪ #454 [LOW] [SiteParams] No "reset to default" for changed parameters
**VistA:** UX
**Fix:** Implement or fix: No "reset to default" for changed parameters
**Verify:** Verify the feature works end-to-end

### 🟢 #455 [MEDIUM] [SiteParams] Save button enabled even when nothing changed
**VistA:** UX
**Fix:** Implement or fix: Save button enabled even when nothing changed
**Verify:** Verify the feature works end-to-end

### ⚪ #456 [LOW] [SiteParams] No parameter import/export for backup
**VistA:** UX
**Fix:** Implement or fix: No parameter import/export for backup
**Verify:** Verify the feature works end-to-end

### ⚪ #457 [LOW] [SiteParams] Change reason field: no minimum length enforcement
**VistA:** UX
**Fix:** Implement or fix: Change reason field: no minimum length enforcement
**Verify:** Verify the feature works end-to-end

### 🟢 #458 [MEDIUM] [ClinicMgmt] Clinic list: no search/filter
**VistA:** UX
**Fix:** Implement or fix: Clinic list: no search/filter
**Verify:** Verify the feature works end-to-end

### 🟢 #459 [MEDIUM] [ClinicMgmt] Clinic detail: only name + stop code shown. Terminal shows 20+ fields.
**VistA:** UX
**Fix:** Implement or fix: Clinic detail: only name + stop code shown. Terminal shows 20+ fields.
**Verify:** Verify the feature works end-to-end

### ⚪ #460 [LOW] [ClinicMgmt] No clinic schedule template editor
**VistA:** UX
**Fix:** Implement or fix: No clinic schedule template editor
**Verify:** Verify the feature works end-to-end

### ⚪ #461 [LOW] [ClinicMgmt] No clinic utilization report
**VistA:** UX
**Fix:** Implement or fix: No clinic utilization report
**Verify:** Verify the feature works end-to-end

### 🟢 #462 [MEDIUM] [ClinicMgmt] Clinic create: no error if stop code doesn't exist in File 40.7
**VistA:** UX
**Fix:** Implement or fix: Clinic create: no error if stop code doesn't exist in File 40.7
**Verify:** Verify the feature works end-to-end

### ⚪ #463 [LOW] [ClinicMgmt] No clinic-to-provider assignment
**VistA:** UX
**Fix:** Implement or fix: No clinic-to-provider assignment
**Verify:** Verify the feature works end-to-end

### 🟢 #464 [MEDIUM] [WardMgmt] Ward list: no search/filter
**VistA:** UX
**Fix:** Implement or fix: Ward list: no search/filter
**Verify:** Verify the feature works end-to-end

### ⚪ #465 [LOW] [WardMgmt] No ward census display
**VistA:** UX
**Fix:** Implement or fix: No ward census display
**Verify:** Verify the feature works end-to-end

### ⚪ #466 [LOW] [WardMgmt] No bed-level management within ward
**VistA:** UX
**Fix:** Implement or fix: No bed-level management within ward
**Verify:** Verify the feature works end-to-end

### ⚪ #467 [LOW] [WardMgmt] No ward-to-department mapping
**VistA:** UX
**Fix:** Implement or fix: No ward-to-department mapping
**Verify:** Verify the feature works end-to-end

### 🟢 #468 [MEDIUM] [WardMgmt] Ward create: minimal fields (terminal has more)
**VistA:** UX
**Fix:** Implement or fix: Ward create: minimal fields (terminal has more)
**Verify:** Verify the feature works end-to-end

### 🟢 #469 [MEDIUM] [DeviceMgmt] Device list: no search/filter
**VistA:** UX
**Fix:** Implement or fix: Device list: no search/filter
**Verify:** Verify the feature works end-to-end

### 🟢 #470 [MEDIUM] [DeviceMgmt] Device create: minimal fields for functional device
**VistA:** UX
**Fix:** Implement or fix: Device create: minimal fields for functional device
**Verify:** Verify the feature works end-to-end

### ⚪ #471 [LOW] [DeviceMgmt] No device queue status display
**VistA:** UX
**Fix:** Implement or fix: No device queue status display
**Verify:** Verify the feature works end-to-end

### ⚪ #472 [LOW] [DeviceMgmt] No print job monitoring
**VistA:** UX
**Fix:** Implement or fix: No print job monitoring
**Verify:** Verify the feature works end-to-end

### 🟢 #473 [MEDIUM] [DeviceMgmt] Terminal type editing: limited fields
**VistA:** UX
**Fix:** Implement or fix: Terminal type editing: limited fields
**Verify:** Verify the feature works end-to-end

### 🟢 #474 [MEDIUM] [MailGrpMgmt] No group creation from UI
**VistA:** UX
**Fix:** Implement or fix: No group creation from UI
**Verify:** Verify the feature works end-to-end

### ⚪ #475 [LOW] [MailGrpMgmt] No member count in group list
**VistA:** UX
**Fix:** Implement or fix: No member count in group list
**Verify:** Verify the feature works end-to-end

### ⚪ #476 [LOW] [MailGrpMgmt] No group description display
**VistA:** UX
**Fix:** Implement or fix: No group description display
**Verify:** Verify the feature works end-to-end

### ⚪ #477 [LOW] [MailGrpMgmt] No group-to-division mapping
**VistA:** UX
**Fix:** Implement or fix: No group-to-division mapping
**Verify:** Verify the feature works end-to-end

### 🟢 #478 [MEDIUM] [MailGrpMgmt] Remove member: no confirmation dialog
**VistA:** UX
**Fix:** Implement or fix: Remove member: no confirmation dialog
**Verify:** Verify the feature works end-to-end

### 🟢 #479 [MEDIUM] [DeptService] No department search/filter
**VistA:** UX
**Fix:** Implement or fix: No department search/filter
**Verify:** Verify the feature works end-to-end

### ⚪ #480 [LOW] [DeptService] No department hierarchy
**VistA:** UX
**Fix:** Implement or fix: No department hierarchy
**Verify:** Verify the feature works end-to-end

### ⚪ #481 [LOW] [DeptService] No department head/supervisor assignment
**VistA:** UX
**Fix:** Implement or fix: No department head/supervisor assignment
**Verify:** Verify the feature works end-to-end

### 🟢 #482 [MEDIUM] [DeptService] Delete: no user count warning
**VistA:** UX
**Fix:** Implement or fix: Delete: no user count warning
**Verify:** Verify the feature works end-to-end

### ⚪ #483 [LOW] [DeptService] No department abbreviation display
**VistA:** UX
**Fix:** Implement or fix: No department abbreviation display
**Verify:** Verify the feature works end-to-end

### 🟢 #484 [MEDIUM] [SiteMgmt] Custom role CRUD: verify create + delete work end-to-end
**VistA:** UX
**Fix:** Implement or fix: Custom role CRUD: verify create + delete work end-to-end
**Verify:** Verify the feature works end-to-end

### ⚪ #485 [LOW] [SiteMgmt] No site comparison view
**VistA:** UX
**Fix:** Implement or fix: No site comparison view
**Verify:** Verify the feature works end-to-end

### 🟢 #486 [MEDIUM] [SiteMgmt] Workspace enable/disable: verify toggle saves to VistA
**VistA:** UX
**Fix:** Implement or fix: Workspace enable/disable: verify toggle saves to VistA
**Verify:** Verify the feature works end-to-end

### ⚪ #487 [LOW] [SiteMgmt] No site statistics summary
**VistA:** UX
**Fix:** Implement or fix: No site statistics summary
**Verify:** Verify the feature works end-to-end

### 🟢 #488 [MEDIUM] [SiteMgmt] Site delete: no user/clinic assignment check
**VistA:** UX
**Fix:** Implement or fix: Site delete: no user/clinic assignment check
**Verify:** Verify the feature works end-to-end

### 🟢 #489 [MEDIUM] [AlertsNotify] MailMan compose: no attachment support
**VistA:** UX
**Fix:** Implement or fix: MailMan compose: no attachment support
**Verify:** Verify the feature works end-to-end

### 🟢 #490 [MEDIUM] [AlertsNotify] MailMan compose: no message priority selector for MailMan (different from alerts)
**VistA:** UX
**Fix:** Implement or fix: MailMan compose: no message priority selector for MailMan (different from alerts)
**Verify:** Verify the feature works end-to-end

### ⚪ #491 [LOW] [AlertsNotify] No message templates for common notifications
**VistA:** UX
**Fix:** Implement or fix: No message templates for common notifications
**Verify:** Verify the feature works end-to-end

### 🟢 #492 [MEDIUM] [AlertsNotify] Alert compose: no user search/picker for recipient
**VistA:** UX
**Fix:** Implement or fix: Alert compose: no user search/picker for recipient
**Verify:** Verify the feature works end-to-end

### ⚪ #493 [LOW] [AlertsNotify] No notification preferences per admin
**VistA:** UX
**Fix:** Implement or fix: No notification preferences per admin
**Verify:** Verify the feature works end-to-end

### ⚪ #494 [LOW] [AlertsNotify] No read receipt tracking
**VistA:** UX
**Fix:** Implement or fix: No read receipt tracking
**Verify:** Verify the feature works end-to-end

### 🟢 #495 [MEDIUM] [AuditLog] No filter by specific user
**VistA:** UX
**Fix:** Implement or fix: No filter by specific user
**Verify:** Verify the feature works end-to-end

### 🟢 #496 [MEDIUM] [AuditLog] No filter by action type
**VistA:** UX
**Fix:** Implement or fix: No filter by action type
**Verify:** Verify the feature works end-to-end

### ⚪ #497 [LOW] [AuditLog] No audit data export
**VistA:** UX
**Fix:** Implement or fix: No audit data export
**Verify:** Verify the feature works end-to-end

### ⚪ #498 [LOW] [AuditLog] No audit retention policy display
**VistA:** UX
**Fix:** Implement or fix: No audit retention policy display
**Verify:** Verify the feature works end-to-end

### ⚪ #499 [LOW] [AuditLog] No audit anomaly highlighting
**VistA:** UX
**Fix:** Implement or fix: No audit anomaly highlighting
**Verify:** Verify the feature works end-to-end

### 🟢 #500 [MEDIUM] [SystemHealth] HL7 interface management: can we start/stop individual interfaces?
**VistA:** UX
**Fix:** Implement or fix: HL7 interface management: can we start/stop individual interfaces?
**Verify:** Verify the feature works end-to-end

### 🟢 #501 [MEDIUM] [SystemHealth] TaskMan: can we view task error details?
**VistA:** UX
**Fix:** Implement or fix: TaskMan: can we view task error details?
**Verify:** Verify the feature works end-to-end

### ⚪ #502 [LOW] [SystemHealth] No system resource monitoring (disk, memory)
**VistA:** UX
**Fix:** Implement or fix: No system resource monitoring (disk, memory)
**Verify:** Verify the feature works end-to-end

### ⚪ #503 [LOW] [SystemHealth] No alert threshold configuration
**VistA:** UX
**Fix:** Implement or fix: No alert threshold configuration
**Verify:** Verify the feature works end-to-end

### 🟢 #504 [MEDIUM] [SystemHealth] Auto-refresh: does it work correctly?
**VistA:** UX
**Fix:** Implement or fix: Auto-refresh: does it work correctly?
**Verify:** Verify the feature works end-to-end

### ⚪ #505 [LOW] [SystemHealth] No health history/uptime tracking
**VistA:** UX
**Fix:** Implement or fix: No health history/uptime tracking
**Verify:** Verify the feature works end-to-end

### ⚪ #506 [LOW] [SystemConfig] Welcome message: no rich text formatting
**VistA:** UX
**Fix:** Implement or fix: Welcome message: no rich text formatting
**Verify:** Verify the feature works end-to-end

### ⚪ #507 [LOW] [SystemConfig] System info: no copy-to-clipboard for support
**VistA:** UX
**Fix:** Implement or fix: System info: no copy-to-clipboard for support
**Verify:** Verify the feature works end-to-end

### 🟢 #508 [MEDIUM] [SystemConfig] Broker timeout: what are valid ranges?
**VistA:** UX
**Fix:** Implement or fix: Broker timeout: what are valid ranges?
**Verify:** Verify the feature works end-to-end

### ⚪ #509 [LOW] [SystemConfig] No environment label customization
**VistA:** UX
**Fix:** Implement or fix: No environment label customization
**Verify:** Verify the feature works end-to-end

### 🟢 #510 [MEDIUM] [AdminReports] Each report: does it return real VistA data?
**VistA:** UX
**Fix:** Implement or fix: Each report: does it return real VistA data?
**Verify:** Verify the feature works end-to-end

### ⚪ #511 [LOW] [AdminReports] No custom report builder
**VistA:** UX
**Fix:** Implement or fix: No custom report builder
**Verify:** Verify the feature works end-to-end

### ⚪ #512 [LOW] [AdminReports] No report scheduling
**VistA:** UX
**Fix:** Implement or fix: No report scheduling
**Verify:** Verify the feature works end-to-end

### ⚪ #513 [LOW] [AdminReports] No report sharing between admins
**VistA:** UX
**Fix:** Implement or fix: No report sharing between admins
**Verify:** Verify the feature works end-to-end

---

# SECTION 11: PER-PAGE DEEP UX AUDIT — Patient

### 🟢 #514 [MEDIUM] [PatientSearch] Search results: does it show flags (behavioral, sensitive)?
**VistA:** File 2/UX
**Fix:** Implement: Search results: does it show flags (behavioral, sensitive)?
**Verify:** Feature works end-to-end with VistA

### 🟢 #515 [MEDIUM] [PatientSearch] Search results: veteran vs non-veteran indicator
**VistA:** File 2/UX
**Fix:** Implement: Search results: veteran vs non-veteran indicator
**Verify:** Feature works end-to-end with VistA

### 🟢 #516 [MEDIUM] [PatientSearch] Advanced search: by DOB range, by ward, by provider
**VistA:** File 2/UX
**Fix:** Implement: Advanced search: by DOB range, by ward, by provider
**Verify:** Feature works end-to-end with VistA

### ⚪ #517 [LOW] [PatientSearch] Search results: no photo/avatar placeholder
**VistA:** File 2/UX
**Fix:** Implement: Search results: no photo/avatar placeholder
**Verify:** Feature works end-to-end with VistA

### 🟢 #518 [MEDIUM] [PatientSearch] Search: does "Select Patient" navigate to demographics?
**VistA:** File 2/UX
**Fix:** Implement: Search: does "Select Patient" navigate to demographics?
**Verify:** Feature works end-to-end with VistA

### 🟢 #519 [MEDIUM] [PatientSearch] No MPI (Master Patient Index) integration concept
**VistA:** File 2/UX
**Fix:** Implement: No MPI (Master Patient Index) integration concept
**Verify:** Feature works end-to-end with VistA

### ⚪ #520 [LOW] [PatientSearch] Search results: no pagination for 100+ matches
**VistA:** File 2/UX
**Fix:** Implement: Search results: no pagination for 100+ matches
**Verify:** Feature works end-to-end with VistA

### 🟢 #521 [MEDIUM] [PatientSearch] Search by DFN (internal ID) not supported
**VistA:** File 2/UX
**Fix:** Implement: Search by DFN (internal ID) not supported
**Verify:** Feature works end-to-end with VistA

### ⚪ #522 [LOW] [PatientSearch] No barcode/scan patient search
**VistA:** File 2/UX
**Fix:** Implement: No barcode/scan patient search
**Verify:** Feature works end-to-end with VistA

### 🟢 #523 [MEDIUM] [PatientDemo] Address: no auto-complete or validation via USPS
**VistA:** File 2/UX
**Fix:** Implement: Address: no auto-complete or validation via USPS
**Verify:** Feature works end-to-end with VistA

### 🟢 #524 [MEDIUM] [PatientDemo] Phone: home vs cell vs work not distinguished
**VistA:** File 2/UX
**Fix:** Implement: Phone: home vs cell vs work not distinguished
**Verify:** Feature works end-to-end with VistA

### 🟢 #525 [MEDIUM] [PatientDemo] Email: not commonly stored in VistA File 2 — which field?
**VistA:** File 2/UX
**Fix:** Implement: Email: not commonly stored in VistA File 2 — which field?
**Verify:** Feature works end-to-end with VistA

### 🟢 #526 [MEDIUM] [PatientDemo] Preferred name/alias: File 2 field .01 vs preferred name field
**VistA:** File 2/UX
**Fix:** Implement: Preferred name/alias: File 2 field .01 vs preferred name field
**Verify:** Feature works end-to-end with VistA

### 🟢 #527 [MEDIUM] [PatientDemo] Gender identity vs sex at birth: modern requirements
**VistA:** File 2/UX
**Fix:** Implement: Gender identity vs sex at birth: modern requirements
**Verify:** Feature works end-to-end with VistA

### 🟢 #528 [MEDIUM] [PatientDemo] Pronouns: not in standard VistA but modern expectation
**VistA:** File 2/UX
**Fix:** Implement: Pronouns: not in standard VistA but modern expectation
**Verify:** Feature works end-to-end with VistA

### ⚪ #529 [LOW] [PatientDemo] Social history: smoking/alcohol not in demographics
**VistA:** File 2/UX
**Fix:** Implement: Social history: smoking/alcohol not in demographics
**Verify:** Feature works end-to-end with VistA

### 🟢 #530 [MEDIUM] [PatientDemo] Advance directive: File 2 field 78.1-78.2
**VistA:** File 2/UX
**Fix:** Implement: Advance directive: File 2 field 78.1-78.2
**Verify:** Feature works end-to-end with VistA

### 🟢 #531 [MEDIUM] [PatientDemo] Organ donor status: File 2 field 200
**VistA:** File 2/UX
**Fix:** Implement: Organ donor status: File 2 field 200
**Verify:** Feature works end-to-end with VistA

### 🟢 #532 [MEDIUM] [PatientDemo] Language preference: File 2 field .07 (not 200.07)
**VistA:** File 2/UX
**Fix:** Implement: Language preference: File 2 field .07 (not 200.07)
**Verify:** Feature works end-to-end with VistA

### 🟢 #533 [MEDIUM] [PatientDemo] Interpreter needed flag: File 2 field .12
**VistA:** File 2/UX
**Fix:** Implement: Interpreter needed flag: File 2 field .12
**Verify:** Feature works end-to-end with VistA

### 🟢 #534 [MEDIUM] [PatientDemo] Collateral of record: File 2 fields .2191-.2196
**VistA:** File 2/UX
**Fix:** Implement: Collateral of record: File 2 fields .2191-.2196
**Verify:** Feature works end-to-end with VistA

### ⚪ #535 [LOW] [PatientDemo] Photo ID verification indicator
**VistA:** File 2/UX
**Fix:** Implement: Photo ID verification indicator
**Verify:** Feature works end-to-end with VistA

### 🟢 #536 [MEDIUM] [PatientDemo] Secondary NOK: File 2 sub-file .211 entry 2
**VistA:** File 2/UX
**Fix:** Implement: Secondary NOK: File 2 sub-file .211 entry 2
**Verify:** Feature works end-to-end with VistA

### 🟢 #537 [MEDIUM] [PatientDemo] Designee: File 2 fields .291-.299
**VistA:** File 2/UX
**Fix:** Implement: Designee: File 2 fields .291-.299
**Verify:** Feature works end-to-end with VistA

### 🟢 #538 [MEDIUM] [Insurance] Insurance verification: no real-time eligibility check
**VistA:** File 2/UX
**Fix:** Implement: Insurance verification: no real-time eligibility check
**Verify:** Feature works end-to-end with VistA

### 🟢 #539 [MEDIUM] [Insurance] Coordination of benefits: primary vs secondary vs tertiary
**VistA:** File 2/UX
**Fix:** Implement: Coordination of benefits: primary vs secondary vs tertiary
**Verify:** Feature works end-to-end with VistA

### ⚪ #540 [LOW] [Insurance] Pre-authorization tracking
**VistA:** File 2/UX
**Fix:** Implement: Pre-authorization tracking
**Verify:** Feature works end-to-end with VistA

### 🟢 #541 [MEDIUM] [Insurance] Insurance plan details: copay, deductible, max benefit
**VistA:** File 2/UX
**Fix:** Implement: Insurance plan details: copay, deductible, max benefit
**Verify:** Feature works end-to-end with VistA

### ⚪ #542 [LOW] [Insurance] Insurance company search: does it search File 36 by name?
**VistA:** File 2/UX
**Fix:** Implement: Insurance company search: does it search File 36 by name?
**Verify:** Feature works end-to-end with VistA

### 🟢 #543 [MEDIUM] [Financial] Means test: no automated income verification
**VistA:** File 2/UX
**Fix:** Implement: Means test: no automated income verification
**Verify:** Feature works end-to-end with VistA

### 🟢 #544 [MEDIUM] [Financial] Hardship determination: special criteria
**VistA:** File 2/UX
**Fix:** Implement: Hardship determination: special criteria
**Verify:** Feature works end-to-end with VistA

### ⚪ #545 [LOW] [Financial] Copay exemption tracking
**VistA:** File 2/UX
**Fix:** Implement: Copay exemption tracking
**Verify:** Feature works end-to-end with VistA

### 🟢 #546 [MEDIUM] [Financial] Prescription copay eligibility based on means test result
**VistA:** File 2/UX
**Fix:** Implement: Prescription copay eligibility based on means test result
**Verify:** Feature works end-to-end with VistA

### ⚪ #547 [LOW] [Financial] Travel pay eligibility based on SC percentage
**VistA:** File 2/UX
**Fix:** Implement: Travel pay eligibility based on SC percentage
**Verify:** Feature works end-to-end with VistA

### 🟢 #548 [MEDIUM] [Admission] Pre-admission checklist: insurance verified, means test current
**VistA:** File 2/UX
**Fix:** Implement: Pre-admission checklist: insurance verified, means test current
**Verify:** Feature works end-to-end with VistA

### 🟢 #549 [MEDIUM] [Admission] Admission diagnosis: ICD-10 picker
**VistA:** File 2/UX
**Fix:** Implement: Admission diagnosis: ICD-10 picker
**Verify:** Feature works end-to-end with VistA

### 🟢 #550 [MEDIUM] [Admission] Admission type: does dropdown match File 405.1?
**VistA:** File 2/UX
**Fix:** Implement: Admission type: does dropdown match File 405.1?
**Verify:** Feature works end-to-end with VistA

### ⚪ #551 [LOW] [Admission] Expected length of stay input
**VistA:** File 2/UX
**Fix:** Implement: Expected length of stay input
**Verify:** Feature works end-to-end with VistA

### 🟢 #552 [MEDIUM] [Admission] Diet order prompt on admission
**VistA:** File 2/UX
**Fix:** Implement: Diet order prompt on admission
**Verify:** Feature works end-to-end with VistA

### ⚪ #553 [LOW] [Admission] Isolation precautions indicator
**VistA:** File 2/UX
**Fix:** Implement: Isolation precautions indicator
**Verify:** Feature works end-to-end with VistA

### 🟢 #554 [MEDIUM] [Discharge] Discharge diagnosis: ICD-10 picker
**VistA:** File 2/UX
**Fix:** Implement: Discharge diagnosis: ICD-10 picker
**Verify:** Feature works end-to-end with VistA

### 🟢 #555 [MEDIUM] [Discharge] Follow-up appointment scheduling prompt
**VistA:** File 2/UX
**Fix:** Implement: Follow-up appointment scheduling prompt
**Verify:** Feature works end-to-end with VistA

### ⚪ #556 [LOW] [Discharge] Discharge instructions template
**VistA:** File 2/UX
**Fix:** Implement: Discharge instructions template
**Verify:** Feature works end-to-end with VistA

### 🟢 #557 [MEDIUM] [Discharge] Medications at discharge reconciliation prompt
**VistA:** File 2/UX
**Fix:** Implement: Medications at discharge reconciliation prompt
**Verify:** Feature works end-to-end with VistA

### ⚪ #558 [LOW] [Discharge] Transportation arrangement for discharge
**VistA:** File 2/UX
**Fix:** Implement: Transportation arrangement for discharge
**Verify:** Feature works end-to-end with VistA

### 🟢 #559 [MEDIUM] [Transfer] Transfer reason: required or optional?
**VistA:** File 2/UX
**Fix:** Implement: Transfer reason: required or optional?
**Verify:** Feature works end-to-end with VistA

### ⚪ #560 [LOW] [Transfer] Receiving ward notification
**VistA:** File 2/UX
**Fix:** Implement: Receiving ward notification
**Verify:** Feature works end-to-end with VistA

### 🟢 #561 [MEDIUM] [Transfer] Transfer of care documentation prompt
**VistA:** File 2/UX
**Fix:** Implement: Transfer of care documentation prompt
**Verify:** Feature works end-to-end with VistA

### ⚪ #562 [LOW] [Transfer] Equipment/belongings transfer tracking
**VistA:** File 2/UX
**Fix:** Implement: Equipment/belongings transfer tracking
**Verify:** Feature works end-to-end with VistA

### 🟢 #563 [MEDIUM] [BedMgmt] Real-time bed availability dashboard
**VistA:** File 2/UX
**Fix:** Implement: Real-time bed availability dashboard
**Verify:** Feature works end-to-end with VistA

### ⚪ #564 [LOW] [BedMgmt] Bed reservation for upcoming admissions
**VistA:** File 2/UX
**Fix:** Implement: Bed reservation for upcoming admissions
**Verify:** Feature works end-to-end with VistA

### 🟢 #565 [MEDIUM] [BedMgmt] Bed cleaning status tracking
**VistA:** File 2/UX
**Fix:** Implement: Bed cleaning status tracking
**Verify:** Feature works end-to-end with VistA

### ⚪ #566 [LOW] [BedMgmt] Environmental services notification on discharge
**VistA:** File 2/UX
**Fix:** Implement: Environmental services notification on discharge
**Verify:** Feature works end-to-end with VistA

### 🟢 #567 [MEDIUM] [BedMgmt] Bed swap between patients
**VistA:** File 2/UX
**Fix:** Implement: Bed swap between patients
**Verify:** Feature works end-to-end with VistA

### 🟢 #568 [MEDIUM] [PatientFlags] Flag notification: who gets notified when flag is set?
**VistA:** File 2/UX
**Fix:** Implement: Flag notification: who gets notified when flag is set?
**Verify:** Feature works end-to-end with VistA

### ⚪ #569 [LOW] [PatientFlags] Flag acknowledgment tracking
**VistA:** File 2/UX
**Fix:** Implement: Flag acknowledgment tracking
**Verify:** Feature works end-to-end with VistA

### 🟢 #570 [MEDIUM] [PatientFlags] Flag inheritance: flags visible across divisions?
**VistA:** File 2/UX
**Fix:** Implement: Flag inheritance: flags visible across divisions?
**Verify:** Feature works end-to-end with VistA

### ⚪ #571 [LOW] [PatientFlags] Flag template/common flag quick-add
**VistA:** File 2/UX
**Fix:** Implement: Flag template/common flag quick-add
**Verify:** Feature works end-to-end with VistA

### 🟢 #572 [MEDIUM] [RecordRestrict] Sensitivity log: who accessed this restricted record?
**VistA:** File 2/UX
**Fix:** Implement: Sensitivity log: who accessed this restricted record?
**Verify:** Feature works end-to-end with VistA

### 🟢 #573 [MEDIUM] [RecordRestrict] Break-the-glass workflow for sensitive records
**VistA:** File 2/UX
**Fix:** Implement: Break-the-glass workflow for sensitive records
**Verify:** Feature works end-to-end with VistA

### ⚪ #574 [LOW] [RecordRestrict] Automatic restriction based on employee-patient relationship
**VistA:** File 2/UX
**Fix:** Implement: Automatic restriction based on employee-patient relationship
**Verify:** Feature works end-to-end with VistA

### 🟢 #575 [MEDIUM] [RecordRestrict] 38 USC 7332 compliance for substance abuse/HIV/sickle cell
**VistA:** File 2/UX
**Fix:** Implement: 38 USC 7332 compliance for substance abuse/HIV/sickle cell
**Verify:** Feature works end-to-end with VistA

### 🟢 #576 [MEDIUM] [PatientDash] Dashboard: active orders summary
**VistA:** File 2/UX
**Fix:** Implement: Dashboard: active orders summary
**Verify:** Feature works end-to-end with VistA

### 🟢 #577 [MEDIUM] [PatientDash] Dashboard: upcoming appointments
**VistA:** File 2/UX
**Fix:** Implement: Dashboard: upcoming appointments
**Verify:** Feature works end-to-end with VistA

### ⚪ #578 [LOW] [PatientDash] Dashboard: lab results summary
**VistA:** File 2/UX
**Fix:** Implement: Dashboard: lab results summary
**Verify:** Feature works end-to-end with VistA

### 🟢 #579 [MEDIUM] [PatientDash] Dashboard: active medications list
**VistA:** File 2/UX
**Fix:** Implement: Dashboard: active medications list
**Verify:** Feature works end-to-end with VistA

### ⚪ #580 [LOW] [PatientDash] Dashboard: clinical reminders
**VistA:** File 2/UX
**Fix:** Implement: Dashboard: clinical reminders
**Verify:** Feature works end-to-end with VistA

### 🟢 #581 [MEDIUM] [PatientDash] Dashboard: problem list summary
**VistA:** File 2/UX
**Fix:** Implement: Dashboard: problem list summary
**Verify:** Feature works end-to-end with VistA

### ⚪ #582 [LOW] [PatientDash] Dashboard: recent notes/encounters
**VistA:** File 2/UX
**Fix:** Implement: Dashboard: recent notes/encounters
**Verify:** Feature works end-to-end with VistA

### 🟢 #583 [MEDIUM] [RegReports] Reports: registration completeness report
**VistA:** File 2/UX
**Fix:** Implement: Reports: registration completeness report
**Verify:** Feature works end-to-end with VistA

### ⚪ #584 [LOW] [RegReports] Reports: insurance coverage report
**VistA:** File 2/UX
**Fix:** Implement: Reports: insurance coverage report
**Verify:** Feature works end-to-end with VistA

### 🟢 #585 [MEDIUM] [RegReports] Reports: means test due/overdue report
**VistA:** File 2/UX
**Fix:** Implement: Reports: means test due/overdue report
**Verify:** Feature works end-to-end with VistA

### ⚪ #586 [LOW] [RegReports] Reports: veteran demographics report
**VistA:** File 2/UX
**Fix:** Implement: Reports: veteran demographics report
**Verify:** Feature works end-to-end with VistA

---

# SECTION 12: M ROUTINE ISSUES

### 🟢 #587 [MEDIUM] [M-Routines] LIST2: DISUSER check uses $G(^VA(200,IEN,7)) but node 7 may not exist for all users
**VistA:** ZVEADMIN
**Fix:** Add $G fallback: S DISUSER=$P($G(^VA(200,IEN,7)),U,1)
**Verify:** Verify users without node 7 show ACTIVE

### 🟢 #588 [MEDIUM] [M-Routines] DETAIL: output line may exceed broker line length limit
**VistA:** ZVEADMIN
**Fix:** RPC broker has 245-char line limit. Detail line with 30+ pieces could exceed.
**Verify:** Create user with long fields → detail loads without truncation

### 🟢 #589 [MEDIUM] [M-Routines] EDIT: no validation that FIELD parameter is valid
**VistA:** ZVEADMIN
**Fix:** EDIT accepts any field string. Should validate against allowed list.
**Verify:** Send invalid field → returns error, not silent failure

### 🟢 #590 [MEDIUM] [M-Routines] AUDITLOG: ^XTMP based — purge date may delete audit trail
**VistA:** ZVEADMIN
**Fix:** Audit should be permanent. Consider moving to dedicated file.
**Verify:** Check ^XTMP purge date. Extend or use permanent global.

### 🟢 #591 [MEDIUM] [M-Routines] ADD: no check for VistA file 200 being full/locked
**VistA:** ZVEUSMG
**Fix:** If File 200 is locked (LREC set), creation fails cryptically.
**Verify:** Lock File 200 → create user → clear error message

### 🟢 #592 [MEDIUM] [M-Routines] KEYS: ORES/ORELSE conflict check is correct but no OTHER mutual exclusions checked
**VistA:** ZVEUSMG
**Fix:** Are there other mutually exclusive keys in VistA? Check XUSEC logic.
**Verify:** Research and document any other key conflicts

### ⚪ #593 [LOW] [M-Routines] UNLOCK: does it clear the failed access count or just the lock flag?
**VistA:** ZVEUSMG
**Fix:** VistA lockout involves both the ^XUSEC("LOCKED") flag and a counter. Both must be cleared.
**Verify:** Unlock → M: verify both flag and counter cleared

### 🟢 #594 [MEDIUM] [M-Routines] TERM: does it audit the termination including which keys were removed?
**VistA:** ZVEUSMG
**Fix:** TERM removes keys but should log each removed key for audit trail.
**Verify:** Terminate → audit log shows each key removed

### 🟢 #595 [MEDIUM] [M-Routines] RENAME: no check for name format (LAST,FIRST)
**VistA:** ZVEUSMG
**Fix:** Could rename to invalid format.
**Verify:** Rename to "INVALIDNAME" → error about format

### 🟢 #596 [MEDIUM] [M-Routines] CHKAC: checks hash collision but what about case sensitivity?
**VistA:** ZVEUSMG
**Fix:** Access codes in VistA are case-insensitive. Hash should be case-insensitive too.
**Verify:** Check "admin" vs "ADMIN" → same hash → collision detected

### 🟢 #597 [MEDIUM] [M-Routines] Uses ^XTMP which is designed for temporary data
**VistA:** ZVEUEXT
**Fix:** Employee ID and role should be permanent. Use ^ZVEX or custom file.
**Verify:** Restart VistA → ^XTMP data still present? (Yes, purge date is 10yr, but still temporary)

### ⚪ #598 [LOW] [M-Routines] No field validation — any string accepted as field name
**VistA:** ZVEUEXT
**Fix:** Could store arbitrary fields. Should validate against known list.
**Verify:** Set field="GARBAGE" → accepted (should reject)

### 🟢 #599 [MEDIUM] [M-Routines] REG: does it set VETERAN status correctly for non-veterans?
**VistA:** ZVEPAT
**Fix:** Non-veteran patients are valid in VistA. Verify SEX/VETERAN fields.
**Verify:** Register non-veteran → M: veteran field = NO

### 🟢 #600 [MEDIUM] [M-Routines] EDIT: same as ZVEADMIN EDIT — no field validation
**VistA:** ZVEPAT
**Fix:** Any field number accepted. Should validate.
**Verify:** Send invalid field → returns error

### 🟢 #601 [MEDIUM] [M-Routines] SRCH: does it handle MAX parameter correctly?
**VistA:** ZVEPAT1
**Fix:** MAX should limit results. Verify M routine respects it.
**Verify:** Search with MAX=5 → exactly 5 or fewer results

### 🟢 #602 [MEDIUM] [M-Routines] FLAGS: does it set national vs local flag type correctly?
**VistA:** ZVEPAT1
**Fix:** VistA has distinct flag mechanisms for national (File 26.15) vs local (File 26.13).
**Verify:** Set national flag → correct file

### 🟢 #603 [MEDIUM] [M-Routines] ADMIT: does it create proper movement in File 405?
**VistA:** ZVEADT
**Fix:** Admission movement must be type 1 (Admission).
**Verify:** Admit → M: File 405 movement type = 1

### 🟢 #604 [MEDIUM] [M-Routines] DISCHARGE: does it reference the correct admission movement?
**VistA:** ZVEADT
**Fix:** Discharge must link to the admission.
**Verify:** Discharge → M: movement references admission

### 🟢 #605 [MEDIUM] [M-Routines] CENSUS: does it include pending movements?
**VistA:** ZVEADT
**Fix:** Census should show current inpatients + pending transfers.
**Verify:** Census → matches ward occupancy

### ⚪ #606 [LOW] [M-Routines] MMSEND: does it handle multi-line body correctly?
**VistA:** ZVEMAIL
**Fix:** MailMan messages can have multiple lines. Body parameter may truncate.
**Verify:** Send multi-line message → all lines received

### 🟢 #607 [MEDIUM] [M-Routines] WSSET: does it validate workspace name?
**VistA:** ZVESITEV
**Fix:** Could set arbitrary workspace names. Should validate.
**Verify:** Set workspace="FAKEWS" → error

### 🟢 #608 [MEDIUM] [M-Routines] ADD: does it set all required File 44 fields?
**VistA:** ZVECLNM
**Fix:** Terminal creates clinics with many required fields. Our ADD may only set .01.
**Verify:** Create clinic → M: check required fields populated

### 🟢 #609 [MEDIUM] [M-Routines] EDIT: does it only allow valid File 42 fields?
**VistA:** ZVEWRDM
**Fix:** No field validation.
**Verify:** Edit with invalid field → error

### 🟢 #610 [MEDIUM] [M-Routines] DIVASSN: does ADD vs REMOVE action work correctly?
**VistA:** ZVEADMN1
**Fix:** Verify both actions process properly.
**Verify:** ADD division → M: sub-file entry. REMOVE → M: entry gone.

### 🟢 #611 [MEDIUM] [M-Routines] PARAMST: does it handle all Kernel parameter types?
**VistA:** ZVEADMN1
**Fix:** Different parameters may have different validation (numeric, set of codes, free text).
**Verify:** Set non-numeric value for numeric param → error

---

# SECTION 13: SERVER & API ISSUES

### 🟢 #612 [MEDIUM] [Server] 222 routes but no route documentation or list endpoint
**VistA:** Routes
**Fix:** Add GET /api/tenant-admin/v1/routes for debugging.
**Verify:** GET /routes → list of all endpoints

### 🟢 #613 [MEDIUM] [Server] No request body size limit — large payloads could crash
**VistA:** Routes
**Fix:** Fastify default is 1MB. May need explicit limit.
**Verify:** POST with 10MB body → 413 error

### 🟢 #614 [MEDIUM] [Server] No request logging for audit
**VistA:** Routes
**Fix:** API requests not logged to file. Need for debugging.
**Verify:** Every request logged: method, URL, user, timestamp

### 🟢 #615 [MEDIUM] [Server] Session timeout: is it the VHA-required 15 minutes?
**VistA:** Auth
**Fix:** VHA Directive 6500 requires ≤15 min. Verify default.
**Verify:** Check default timeout → 900 seconds (15 min)

### 🟢 #616 [MEDIUM] [Server] Session list: admin should see active sessions
**VistA:** Auth
**Fix:** No way to view who's logged in.
**Verify:** GET /sessions → list active sessions

### ⚪ #617 [LOW] [Server] No "remember me" option (appropriate for clinical workstations)
**VistA:** Auth
**Fix:** Clinical systems should NOT have "remember me." Verify it's not added.
**Verify:** No checkbox on login page

### 🟢 #618 [MEDIUM] [Server] DDR FILER: no retry on temporary failures
**VistA:** DDR
**Fix:** If VistA is briefly busy, DDR call fails permanently. Add 1 retry.
**Verify:** DDR fails → auto-retry once → succeeds

### 🟢 #619 [MEDIUM] [Server] DDR LISTER: no pagination for large result sets
**VistA:** DDR
**Fix:** Returns all results. File 200 with 10k entries → timeout.
**Verify:** Query large file → paginated results

### ⚪ #620 [LOW] [Server] No API rate limiting per user
**VistA:** Routes
**Fix:** Single user could make 10k calls/minute.
**Verify:** Rate limit: 200 req/min per session

### 🟢 #621 [MEDIUM] [Server] Concurrent requests to same user may cause race conditions
**VistA:** Routes
**Fix:** Two admins editing same user → last write wins.
**Verify:** Add optimistic locking or queue

---

# SECTION 14: FILE 200 FIELD AUDIT (User)

### ⚪ #622 [LOW] [File200Audit] File 200 field .09 (Alias): User alias/nickname — terminal allows, we don't
**VistA:** 200/.09
**Fix:** Evaluate whether field .09 should be in wizard/detail. If yes, add to EXTRA_MAP or FIELD_MAP.
**Verify:** Create/edit with this field → M: check value

### ⚪ #623 [LOW] [File200Audit] File 200 field .111 (Street Address 1): User address — not captured
**VistA:** 200/.111
**Fix:** Evaluate whether field .111 should be in wizard/detail. If yes, add to EXTRA_MAP or FIELD_MAP.
**Verify:** Create/edit with this field → M: check value

### ⚪ #624 [LOW] [File200Audit] File 200 field .112 (Street Address 2): Not captured in our system. Add if clinically relevant.
**VistA:** 200/.112
**Fix:** Evaluate whether field .112 should be in wizard/detail. If yes, add to EXTRA_MAP or FIELD_MAP.
**Verify:** Create/edit with this field → M: check value

### ⚪ #625 [LOW] [File200Audit] File 200 field .114 (City): Not captured in our system. Add if clinically relevant.
**VistA:** 200/.114
**Fix:** Evaluate whether field .114 should be in wizard/detail. If yes, add to EXTRA_MAP or FIELD_MAP.
**Verify:** Create/edit with this field → M: check value

### ⚪ #626 [LOW] [File200Audit] File 200 field .115 (State): Not captured in our system. Add if clinically relevant.
**VistA:** 200/.115
**Fix:** Evaluate whether field .115 should be in wizard/detail. If yes, add to EXTRA_MAP or FIELD_MAP.
**Verify:** Create/edit with this field → M: check value

### ⚪ #627 [LOW] [File200Audit] File 200 field .116 (Zip Code): Not captured in our system. Add if clinically relevant.
**VistA:** 200/.116
**Fix:** Evaluate whether field .116 should be in wizard/detail. If yes, add to EXTRA_MAP or FIELD_MAP.
**Verify:** Create/edit with this field → M: check value

### ⚪ #628 [LOW] [File200Audit] File 200 field .131 (Home Phone): Distinct from office phone .132
**VistA:** 200/.131
**Fix:** Evaluate whether field .131 should be in wizard/detail. If yes, add to EXTRA_MAP or FIELD_MAP.
**Verify:** Create/edit with this field → M: check value

### ⚪ #629 [LOW] [File200Audit] File 200 field .133 (Voice Pager): In ALLOW map but no wizard field
**VistA:** 200/.133
**Fix:** Evaluate whether field .133 should be in wizard/detail. If yes, add to EXTRA_MAP or FIELD_MAP.
**Verify:** Create/edit with this field → M: check value

### ⚪ #630 [LOW] [File200Audit] File 200 field .134 (Digital Pager): In ALLOW map but no wizard field
**VistA:** 200/.134
**Fix:** Evaluate whether field .134 should be in wizard/detail. If yes, add to EXTRA_MAP or FIELD_MAP.
**Verify:** Create/edit with this field → M: check value

### ⚪ #631 [LOW] [File200Audit] File 200 field 1 (Initials): Auto-generated from name but could be custom
**VistA:** 200/1
**Fix:** Evaluate whether field 1 should be in wizard/detail. If yes, add to EXTRA_MAP or FIELD_MAP.
**Verify:** Create/edit with this field → M: check value

### ⚪ #632 [LOW] [File200Audit] File 200 field 4.5 (Pay Grade): Federal pay grade — relevant for VA
**VistA:** 200/4.5
**Fix:** Evaluate whether field 4.5 should be in wizard/detail. If yes, add to EXTRA_MAP or FIELD_MAP.
**Verify:** Create/edit with this field → M: check value

### ⚪ #633 [LOW] [File200Audit] File 200 field 5.5 (Nickname): Preferred name
**VistA:** 200/5.5
**Fix:** Evaluate whether field 5.5 should be in wizard/detail. If yes, add to EXTRA_MAP or FIELD_MAP.
**Verify:** Create/edit with this field → M: check value

### ⚪ #634 [LOW] [File200Audit] File 200 field 7.1 (DATE ENTERED): Auto-set on creation? Verify.
**VistA:** 200/7.1
**Fix:** Evaluate whether field 7.1 should be in wizard/detail. If yes, add to EXTRA_MAP or FIELD_MAP.
**Verify:** Create/edit with this field → M: check value

### ⚪ #635 [LOW] [File200Audit] File 200 field 7.2 (CREATOR): Auto-set to creating admin? Verify.
**VistA:** 200/7.2
**Fix:** Evaluate whether field 7.2 should be in wizard/detail. If yes, add to EXTRA_MAP or FIELD_MAP.
**Verify:** Create/edit with this field → M: check value

### ⚪ #636 [LOW] [File200Audit] File 200 field 8.1 (MAIL CODE): Internal mailing code
**VistA:** 200/8.1
**Fix:** Evaluate whether field 8.1 should be in wizard/detail. If yes, add to EXTRA_MAP or FIELD_MAP.
**Verify:** Create/edit with this field → M: check value

### ⚪ #637 [LOW] [File200Audit] File 200 field 13 (Name Components): Structured name parts
**VistA:** 200/13
**Fix:** Evaluate whether field 13 should be in wizard/detail. If yes, add to EXTRA_MAP or FIELD_MAP.
**Verify:** Create/edit with this field → M: check value

### ⚪ #638 [LOW] [File200Audit] File 200 field 16 (DIVISION): Primary division pointer
**VistA:** 200/16
**Fix:** Evaluate whether field 16 should be in wizard/detail. If yes, add to EXTRA_MAP or FIELD_MAP.
**Verify:** Create/edit with this field → M: check value

### ⚪ #639 [LOW] [File200Audit] File 200 field 20.1 (Signature Date): When e-sig was set
**VistA:** 200/20.1
**Fix:** Evaluate whether field 20.1 should be in wizard/detail. If yes, add to EXTRA_MAP or FIELD_MAP.
**Verify:** Create/edit with this field → M: check value

### ⚪ #640 [LOW] [File200Audit] File 200 field 29.5 (Treating Specialty): For clinical users
**VistA:** 200/29.5
**Fix:** Evaluate whether field 29.5 should be in wizard/detail. If yes, add to EXTRA_MAP or FIELD_MAP.
**Verify:** Create/edit with this field → M: check value

### ⚪ #641 [LOW] [File200Audit] File 200 field 51.2 (Keys Last Changed): When keys were last modified
**VistA:** 200/51.2
**Fix:** Evaluate whether field 51.2 should be in wizard/detail. If yes, add to EXTRA_MAP or FIELD_MAP.
**Verify:** Create/edit with this field → M: check value

### ⚪ #642 [LOW] [File200Audit] File 200 field 53.1 (Person Class (VA)): Different from 53.5
**VistA:** 200/53.1
**Fix:** Evaluate whether field 53.1 should be in wizard/detail. If yes, add to EXTRA_MAP or FIELD_MAP.
**Verify:** Create/edit with this field → M: check value

### ⚪ #643 [LOW] [File200Audit] File 200 field 53.3 (Tax ID): In ALLOW but not in wizard
**VistA:** 200/53.3
**Fix:** Evaluate whether field 53.3 should be in wizard/detail. If yes, add to EXTRA_MAP or FIELD_MAP.
**Verify:** Create/edit with this field → M: check value

### ⚪ #644 [LOW] [File200Audit] File 200 field 53.4 (Medical School): Education tracking
**VistA:** 200/53.4
**Fix:** Evaluate whether field 53.4 should be in wizard/detail. If yes, add to EXTRA_MAP or FIELD_MAP.
**Verify:** Create/edit with this field → M: check value

### ⚪ #645 [LOW] [File200Audit] File 200 field 53.5 (Provider Class): Pointer to File 7
**VistA:** 200/53.5
**Fix:** Evaluate whether field 53.5 should be in wizard/detail. If yes, add to EXTRA_MAP or FIELD_MAP.
**Verify:** Create/edit with this field → M: check value

### ⚪ #646 [LOW] [File200Audit] File 200 field 53.6 (VA Number): Could store Employee ID here
**VistA:** 200/53.6
**Fix:** Evaluate whether field 53.6 should be in wizard/detail. If yes, add to EXTRA_MAP or FIELD_MAP.
**Verify:** Create/edit with this field → M: check value

### ⚪ #647 [LOW] [File200Audit] File 200 field 53.8 (Exclusive Provider): Not captured in our system. Add if clinically relevant.
**VistA:** 200/53.8
**Fix:** Evaluate whether field 53.8 should be in wizard/detail. If yes, add to EXTRA_MAP or FIELD_MAP.
**Verify:** Create/edit with this field → M: check value

### ⚪ #648 [LOW] [File200Audit] File 200 field 53.9 (Non-VA Prescriber): Not captured in our system. Add if clinically relevant.
**VistA:** 200/53.9
**Fix:** Evaluate whether field 53.9 should be in wizard/detail. If yes, add to EXTRA_MAP or FIELD_MAP.
**Verify:** Create/edit with this field → M: check value

### ⚪ #649 [LOW] [File200Audit] File 200 field 200.02 (Division sub-file): Multiple division assignments
**VistA:** 200/200.02
**Fix:** Evaluate whether field 200.02 should be in wizard/detail. If yes, add to EXTRA_MAP or FIELD_MAP.
**Verify:** Create/edit with this field → M: check value

### ⚪ #650 [LOW] [File200Audit] File 200 field 200.03 (CPRS Tab Config): Already implemented as toggle
**VistA:** 200/200.03
**Fix:** Evaluate whether field 200.03 should be in wizard/detail. If yes, add to EXTRA_MAP or FIELD_MAP.
**Verify:** Create/edit with this field → M: check value

### ⚪ #651 [LOW] [File200Audit] File 200 field 200.05 (Person Class sub-file): Multiple person classes
**VistA:** 200/200.05
**Fix:** Evaluate whether field 200.05 should be in wizard/detail. If yes, add to EXTRA_MAP or FIELD_MAP.
**Verify:** Create/edit with this field → M: check value

### ⚪ #652 [LOW] [File200Audit] File 200 field 200.051 (Security Keys sub-file): Key assignments
**VistA:** 200/200.051
**Fix:** Evaluate whether field 200.051 should be in wizard/detail. If yes, add to EXTRA_MAP or FIELD_MAP.
**Verify:** Create/edit with this field → M: check value

### ⚪ #653 [LOW] [File200Audit] File 200 field 201.1 (SECONDARY MENU OPTION): Secondary menu — our secondaryFeatures
**VistA:** 200/201.1
**Fix:** Evaluate whether field 201.1 should be in wizard/detail. If yes, add to EXTRA_MAP or FIELD_MAP.
**Verify:** Create/edit with this field → M: check value

### ⚪ #654 [LOW] [File200Audit] File 200 field 203 (Mail-related fields): Forwarding, surrogate
**VistA:** 200/203
**Fix:** Evaluate whether field 203 should be in wizard/detail. If yes, add to EXTRA_MAP or FIELD_MAP.
**Verify:** Create/edit with this field → M: check value

### ⚪ #655 [LOW] [File200Audit] File 200 field 203.1 (Proxy User): Already in BASIC_FIELD_MAP
**VistA:** 200/203.1
**Fix:** Evaluate whether field 203.1 should be in wizard/detail. If yes, add to EXTRA_MAP or FIELD_MAP.
**Verify:** Create/edit with this field → M: check value

### ⚪ #656 [LOW] [File200Audit] File 200 field 205 (Package params sub-file): Per-package settings
**VistA:** 200/205
**Fix:** Evaluate whether field 205 should be in wizard/detail. If yes, add to EXTRA_MAP or FIELD_MAP.
**Verify:** Create/edit with this field → M: check value

### ⚪ #657 [LOW] [File200Audit] File 200 field 8932.1 (Person Class (national)): National taxonomy
**VistA:** 200/8932.1
**Fix:** Evaluate whether field 8932.1 should be in wizard/detail. If yes, add to EXTRA_MAP or FIELD_MAP.
**Verify:** Create/edit with this field → M: check value

---

# SECTION 15: FILE 2 FIELD AUDIT (Patient)

### ⚪ #658 [LOW] [File2Audit] File 2 field .02 (SEX): Already captured
**VistA:** 2/.02
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #659 [LOW] [File2Audit] File 2 field .03 (DATE OF BIRTH): Already captured
**VistA:** 2/.03
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #660 [LOW] [File2Audit] File 2 field .05 (MARITAL STATUS): Pointer File 11
**VistA:** 2/.05
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #661 [LOW] [File2Audit] File 2 field .06 (RACE): Pointer File 10 — may need multiple
**VistA:** 2/.06
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #662 [LOW] [File2Audit] File 2 field .07 (LANGUAGE): Pointer File .85
**VistA:** 2/.07
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #663 [LOW] [File2Audit] File 2 field .08 (RELIGIOUS PREF): Pointer File 13
**VistA:** 2/.08
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #664 [LOW] [File2Audit] File 2 field .09 (SSN): Already captured
**VistA:** 2/.09
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #665 [LOW] [File2Audit] File 2 field .091 (PSEUDO SSN REASON): If SSN is pseudo
**VistA:** 2/.091
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #666 [LOW] [File2Audit] File 2 field .092 (COUNTRY OF BIRTH): Free text or pointer
**VistA:** 2/.092
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #667 [LOW] [File2Audit] File 2 field .093 (PLACE OF BIRTH CITY): Evaluate for inclusion in patient form.
**VistA:** 2/.093
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #668 [LOW] [File2Audit] File 2 field .094 (PLACE OF BIRTH STATE): Evaluate for inclusion in patient form.
**VistA:** 2/.094
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #669 [LOW] [File2Audit] File 2 field .096 (WHO ENTERED): Auto-set?
**VistA:** 2/.096
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #670 [LOW] [File2Audit] File 2 field .097 (DATE ENTERED): Auto-set?
**VistA:** 2/.097
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #671 [LOW] [File2Audit] File 2 field .0906 (ETHNICITY): Pointer File 10.2
**VistA:** 2/.0906
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #672 [LOW] [File2Audit] File 2 field .1 (WARD LOCATION): For inpatients
**VistA:** 2/.1
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #673 [LOW] [File2Audit] File 2 field .104 (ROOM-BED): Current room
**VistA:** 2/.104
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #674 [LOW] [File2Audit] File 2 field .12 (INTERPRETER NEEDED): Yes/No flag
**VistA:** 2/.12
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #675 [LOW] [File2Audit] File 2 field .131 (HOME PHONE): Already captured?
**VistA:** 2/.131
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #676 [LOW] [File2Audit] File 2 field .132 (CELL PHONE): Modern necessity
**VistA:** 2/.132
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #677 [LOW] [File2Audit] File 2 field .134 (EMAIL): Patient email
**VistA:** 2/.134
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #678 [LOW] [File2Audit] File 2 field .2401 (FATHER NAME): Dependent info
**VistA:** 2/.2401
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #679 [LOW] [File2Audit] File 2 field .2402 (MOTHER NAME): Evaluate for inclusion in patient form.
**VistA:** 2/.2402
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #680 [LOW] [File2Audit] File 2 field .2403 (MOTHER MAIDEN NAME): Identity verification
**VistA:** 2/.2403
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #681 [LOW] [File2Audit] File 2 field .211 (NOK sub-file): Next of kin — multiple entries
**VistA:** 2/.211
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #682 [LOW] [File2Audit] File 2 field .219 (EMERGENCY CONTACT): Sub-file
**VistA:** 2/.219
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #683 [LOW] [File2Audit] File 2 field .291 (DESIGNEE NAME): Power of attorney
**VistA:** 2/.291
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #684 [LOW] [File2Audit] File 2 field .301 (SC STATUS): Service Connected Yes/No
**VistA:** 2/.301
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #685 [LOW] [File2Audit] File 2 field .302 (SC PERCENTAGE): 0-100
**VistA:** 2/.302
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #686 [LOW] [File2Audit] File 2 field .3111 (EMPLOYER NAME): Employment info
**VistA:** 2/.3111
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #687 [LOW] [File2Audit] File 2 field .3112 (EMPLOYMENT STATUS): Employed/Retired/etc
**VistA:** 2/.3112
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #688 [LOW] [File2Audit] File 2 field .3116 (EMPLOYER PHONE): Evaluate for inclusion in patient form.
**VistA:** 2/.3116
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #689 [LOW] [File2Audit] File 2 field .3211 (BRANCH OF SERVICE): Military history
**VistA:** 2/.3211
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #690 [LOW] [File2Audit] File 2 field .3212 (PERIOD OF SERVICE): Era
**VistA:** 2/.3212
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #691 [LOW] [File2Audit] File 2 field .3213 (RADIATION EXPOSURE): Env hazard
**VistA:** 2/.3213
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #692 [LOW] [File2Audit] File 2 field .3214 (AGENT ORANGE EXPOSURE): Env hazard
**VistA:** 2/.3214
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #693 [LOW] [File2Audit] File 2 field .321101 (AO EXPOSURE LOCATION): Specific location
**VistA:** 2/.321101
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #694 [LOW] [File2Audit] File 2 field 27.01 (CURRENT ENROLLMENT): VA enrollment sub-file
**VistA:** 2/27.01
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #695 [LOW] [File2Audit] File 2 field 27.02 (ENROLLMENT PRIORITY): 1-8 groups
**VistA:** 2/27.02
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #696 [LOW] [File2Audit] File 2 field 36 (INSURANCE TYPE): Sub-file 2.312
**VistA:** 2/36
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #697 [LOW] [File2Audit] File 2 field 391 (TYPE): Patient type (NSC/SC/etc)
**VistA:** 2/391
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #698 [LOW] [File2Audit] File 2 field 405 (MOVEMENTS): Admit/discharge/transfer sub-file
**VistA:** 2/405
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #699 [LOW] [File2Audit] File 2 field 408.13 (ANNUAL INCOME): Means test income
**VistA:** 2/408.13
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #700 [LOW] [File2Audit] File 2 field 408.31 (MEANS TEST): Means test data
**VistA:** 2/408.31
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #701 [LOW] [File2Audit] File 2 field 57 (SPINAL CORD INJURY): Evaluate for inclusion in patient form.
**VistA:** 2/57
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #702 [LOW] [File2Audit] File 2 field 78.1 (ADVANCE DIRECTIVE): Evaluate for inclusion in patient form.
**VistA:** 2/78.1
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

### ⚪ #703 [LOW] [File2Audit] File 2 field 78.2 (AD STATUS): On file/Not on file
**VistA:** 2/78.2
**Fix:** If clinically relevant: add to demographics form or registration wizard. Write via DDR FILER or custom RPC.
**Verify:** Register/edit with field → M: check value

---

# SECTION 16: END-TO-END WORKFLOW TRACES

### 🟢 #704 [MEDIUM] [Workflow] New employee onboarding: Create → assign role → assign division → assign mail groups → print letter → first login → forced password change
**VistA:** E2E
**Fix:** This is the most common admin workflow. Must work flawlessly.
**Verify:** Execute entire flow → all steps succeed

### 🟢 #705 [MEDIUM] [Workflow] Employee departure: Deactivate → remove keys → clear e-sig → remove from mail groups → remove division → audit log
**VistA:** E2E
**Fix:** Complete offboarding.
**Verify:** Execute → M: verify all access removed

### 🟢 #706 [MEDIUM] [Workflow] Employee transfer between divisions: Remove old div → add new div → adjust keys → update department
**VistA:** E2E
**Fix:** Inter-facility transfer.
**Verify:** Transfer → M: new division, correct keys

### 🟢 #707 [MEDIUM] [Workflow] Role change: Nurse → Nurse Practitioner (promotion): Remove ORELSE → add ORES + PROVIDER
**VistA:** E2E
**Fix:** Role upgrade with mutually exclusive key swap.
**Verify:** Change role → ORELSE removed, ORES added

### 🟢 #708 [MEDIUM] [Workflow] Temporary staff: Create with time-limited access → auto-deactivate on end date
**VistA:** E2E
**Fix:** Locum, contractor, student.
**Verify:** Create with end date → auto-deactivated

### 🟢 #709 [MEDIUM] [Workflow] Security incident: Terminate → clear all → lock → audit → notify
**VistA:** E2E
**Fix:** Emergency access revocation.
**Verify:** Terminate → M: zero access → audit log complete

### 🟢 #710 [MEDIUM] [Workflow] Password reset request: Admin resets → user logs in → forced change → works
**VistA:** E2E
**Fix:** Most common support request.
**Verify:** Reset → login → change → new password works

### 🟢 #711 [MEDIUM] [Workflow] Batch onboarding: 10 new residents starting July 1
**VistA:** E2E
**Fix:** Need efficient multi-user creation.
**Verify:** Create 10 users in <30 minutes

### 🟢 #712 [MEDIUM] [Workflow] Annual review: Check all users → identify inactive → deactivate stale accounts
**VistA:** E2E
**Fix:** Periodic access review.
**Verify:** Filter last login >90 days → deactivate all

### 🟢 #713 [MEDIUM] [Workflow] New division setup: Create site → enable workspaces → assign admin → configure params
**VistA:** E2E
**Fix:** Division bootstrapping.
**Verify:** New division → fully configured

### 🟢 #714 [MEDIUM] [Workflow] New patient registration: Search → no match → register → demographics → insurance → means test → assign PCP
**VistA:** E2E
**Fix:** Full registration flow.
**Verify:** Execute → M: complete File 2 record

### 🟢 #715 [MEDIUM] [Workflow] Patient admission: Search → select → admit → assign ward → assign bed → diet order
**VistA:** E2E
**Fix:** Inpatient admission.
**Verify:** Admit → M: File 405 movement + bed assigned

### 🟢 #716 [MEDIUM] [Workflow] Patient discharge: Select inpatient → discharge → disposition → follow-up → instructions
**VistA:** E2E
**Fix:** Discharge flow.
**Verify:** Discharge → M: discharge movement + bed freed

### 🟢 #717 [MEDIUM] [Workflow] Patient transfer: Select → transfer → new ward → new bed → update census
**VistA:** E2E
**Fix:** Ward transfer.
**Verify:** Transfer → M: two movements + bed changes

### 🟢 #718 [MEDIUM] [Workflow] Duplicate patient resolution: Search → find duplicates → merge → verify single record
**VistA:** E2E
**Fix:** Patient safety critical.
**Verify:** Find duplicates → merge → one record remains

### 🟢 #719 [MEDIUM] [Workflow] Insurance update: Select patient → add/change insurance → verify coverage → update copay
**VistA:** E2E
**Fix:** Insurance lifecycle.
**Verify:** Update → M: File 2.312 correct

### 🟢 #720 [MEDIUM] [Workflow] Means test renewal: Select patient → financial assessment → updated copay status
**VistA:** E2E
**Fix:** Annual requirement.
**Verify:** Complete means test → M: File 408.31 current

### 🟢 #721 [MEDIUM] [Workflow] Patient death recording: Search → mark deceased → date/source → restrict access → notify
**VistA:** E2E
**Fix:** Sensitive workflow.
**Verify:** Record death → M: File 2 death fields set

### 🟢 #722 [MEDIUM] [Workflow] Sensitive patient flag: Search → add flag → narrative → review date → notification
**VistA:** E2E
**Fix:** Safety workflow.
**Verify:** Add flag → M: File 26.13 entry

### 🟢 #723 [MEDIUM] [Workflow] Emergency registration: Quick register → minimal fields → complete later
**VistA:** E2E
**Fix:** Time-critical registration.
**Verify:** Quick reg → M: basic record → edit later → complete

---

# SECTION 17: LOAD & CAPACITY

### 🟢 #724 [MEDIUM] [LoadTest] 2000 concurrent users: does the RPC broker handle it?
**VistA:** Perf
**Fix:** VistA RPC broker may have connection limit. Test/document.
**Verify:** Simulate 100 concurrent broker connections → stable

### 🟢 #725 [MEDIUM] [LoadTest] 10,000 users in File 200: does LIST2 return in <5 seconds?
**VistA:** Perf
**Fix:** LIST2 scans ^VA(200). 10k entries with no index = slow.
**Verify:** Load test with 10k users → response time measured

### 🟢 #726 [MEDIUM] [LoadTest] 1000 patients: does search return in <2 seconds?
**VistA:** Perf
**Fix:** Patient search uses B-tree index — should be fast. Verify.
**Verify:** Search with 1k patients → sub-2-second response

### ⚪ #727 [LOW] [LoadTest] 100 simultaneous user creates: do they serialize correctly?
**VistA:** Perf
**Fix:** File 200 LASTENTRY counter must serialize. Race condition?
**Verify:** Batch create 100 → no DUZ collisions

### 🟢 #728 [MEDIUM] [LoadTest] Session memory: 500 active sessions — memory impact?
**VistA:** Perf
**Fix:** In-memory session store grows. How much per session?
**Verify:** 500 sessions → server memory <500MB

### ⚪ #729 [LOW] [LoadTest] API response times: p95 < 1 second for all read endpoints
**VistA:** Perf
**Fix:** Measure actual API performance under load.
**Verify:** Load test → p95 < 1s for reads

### ⚪ #730 [LOW] [LoadTest] API response times: p95 < 3 seconds for all write endpoints
**VistA:** Perf
**Fix:** Writes involve M routine execution.
**Verify:** Load test → p95 < 3s for writes

### 🟢 #731 [MEDIUM] [LoadTest] Browser memory: StaffDirectory with 2000 users — does it lag?
**VistA:** Perf
**Fix:** Client-side filtering of 2000 rows may be slow.
**Verify:** Open with 2000 users → no jank

### ⚪ #732 [LOW] [LoadTest] Bundle size: admin pages total JS weight
**VistA:** Perf
**Fix:** Lazy loading needed for large bundles.
**Verify:** Measure admin bundle → if >1MB, add code splitting

### 🟢 #733 [MEDIUM] [LoadTest] WebSocket/long-polling: should we add real-time updates?
**VistA:** Perf
**Fix:** Currently no real-time. Two admins editing = stale data.
**Verify:** Consider WebSocket for collaborative editing

---

# SECTION 18: COMPLIANCE & STANDARDS

### 🟢 #734 [MEDIUM] [Compliance] VHA Directive 6500: 15-minute session timeout enforced?
**VistA:** VHA
**Fix:** Verify default is 900 seconds. No override >900 in UI.
**Verify:** Cannot set timeout >900 seconds

### 🟢 #735 [MEDIUM] [Compliance] VHA Directive 6500: Password must be 8+ chars, mixed case, number, special
**VistA:** VHA
**Fix:** Verify frontend + VistA Kernel both enforce same rules.
**Verify:** Password "password" rejected

### 🟢 #736 [MEDIUM] [Compliance] HIPAA: All PHI access must be logged
**VistA:** HIPAA
**Fix:** Every patient record access must create audit entry.
**Verify:** View patient → audit log shows access

### 🟢 #737 [MEDIUM] [Compliance] HIPAA: Minimum necessary access — role-based
**VistA:** HIPAA
**Fix:** Users should only see patients they're authorized for.
**Verify:** Restricted patient → unauthorized user blocked

### 🟢 #738 [MEDIUM] [Compliance] HIPAA: Breach notification — suspicious access alerts
**VistA:** HIPAA
**Fix:** Mass record access should trigger alert.
**Verify:** View 100 patients in 1 hour → admin notified

### 🟢 #739 [MEDIUM] [Compliance] Section 508: All interactive elements keyboard accessible
**VistA:** Section508
**Fix:** Every button, link, input reachable via Tab.
**Verify:** Tab through entire UI → every element reachable

### 🟢 #740 [MEDIUM] [Compliance] Section 508: All images have alt text
**VistA:** Section508
**Fix:** Icons, avatars, logos need alt text.
**Verify:** Inspect DOM → all img tags have alt

### 🟢 #741 [MEDIUM] [Compliance] Section 508: Color contrast ratio ≥ 4.5:1
**VistA:** Section508
**Fix:** Light gray text on white may fail.
**Verify:** Run contrast checker → all pass

### 🟢 #742 [MEDIUM] [Compliance] Section 508: Form error messages programmatically associated
**VistA:** Section508
**Fix:** aria-describedby on invalid fields.
**Verify:** Screen reader announces error on invalid field

### ⚪ #743 [LOW] [Compliance] FedRAMP: Activity logging for all administrative actions
**VistA:** FedRAMP
**Fix:** Already have audit log. Verify completeness.
**Verify:** Every admin action creates audit entry

### ⚪ #744 [LOW] [Compliance] FedRAMP: Session management — no concurrent sessions per user?
**VistA:** FedRAMP
**Fix:** Should one user have only one active session?
**Verify:** Login twice → first session invalidated

### ⚪ #745 [LOW] [Compliance] CMS Interoperability: FHIR readiness for patient data
**VistA:** CMS
**Fix:** Future requirement. Plan for FHIR API layer.
**Verify:** Document FHIR mapping for patient demographics

---

# SECTION 19: INTEGRATION & INTEROP

### ⚪ #746 [LOW] [Integration] Active Directory / LDAP integration for user provisioning
**VistA:** ADLDaP
**Fix:** Enterprise environments use AD. Map AD fields to File 200.
**Verify:** Import from AD → users created with mapped data

### ⚪ #747 [LOW] [Integration] Single Sign-On (SAML/OIDC) integration
**VistA:** SSO
**Fix:** Enterprise SSO for seamless login.
**Verify:** Login via SSO → VistA session created

### ⚪ #748 [LOW] [Integration] HL7 ADT messages for patient events
**VistA:** HL7
**Fix:** HL7 A01/A02/A03 for admit/transfer/discharge to external systems.
**Verify:** Admit patient → HL7 A01 sent

### ⚪ #749 [LOW] [Integration] FHIR R4 Patient resource endpoint
**VistA:** FHIR
**Fix:** Modern interop standard.
**Verify:** GET /fhir/Patient/{id} → valid FHIR JSON

### ⚪ #750 [LOW] [Integration] Email notification service for admin actions
**VistA:** Email
**Fix:** Send emails on deactivation, role change, etc.
**Verify:** Deactivate user → email to supervisor

### ⚪ #751 [LOW] [Integration] SMS notification for password resets
**VistA:** SMS
**Fix:** Two-factor via SMS.
**Verify:** Reset password → SMS code sent

### ⚪ #752 [LOW] [Integration] PDF generation for reports and letters
**VistA:** PDF
**Fix:** Server-side PDF for access letters, reports.
**Verify:** Generate PDF letter → professional output

### ⚪ #753 [LOW] [Integration] Automated backup verification
**VistA:** Backup
**Fix:** VistA data backup status.
**Verify:** Dashboard shows: "Last backup: 2 hours ago"

---

# SECTION 20: HANDLER TRACES — Every Button Verified

### 🟢 #789 [MEDIUM] [SD-Handler] handleRowClick: Loads detail + keys + CPRS tabs. Trace: 3 parallel API calls → must ALL succeed or show partial error
**VistA:** 200/handleRowClick
**Fix:** Click the button/action → trace through service → server → RPC → M routine → verify.
**Verify:** Click user → all 3 sections load or error shown per section

### 🟢 #790 [MEDIUM] [SD-Handler] handleDeactivate: Deactivates user with reason. Trace: Must pass reason to ZVE USMG DEACT → field 9.4 + DISUSER
**VistA:** 200/handleDeactivate
**Fix:** Click the button/action → trace through service → server → RPC → M routine → verify.
**Verify:** Deactivate with reason → M: DISUSER=1, field 9.4=reason

### 🟢 #791 [MEDIUM] [SD-Handler] handleReactivate: Reactivates user. Trace: Clears DISUSER + field 9.2
**VistA:** 200/handleReactivate
**Fix:** Click the button/action → trace through service → server → RPC → M routine → verify.
**Verify:** Reactivate → M: DISUSER empty, SSN intact

### 🟢 #792 [MEDIUM] [SD-Handler] handleCloneUser: Clones user with keys. Trace: ZVE USMG ADD + ZVE USER CLONE
**VistA:** 200/handleCloneUser
**Fix:** Click the button/action → trace through service → server → RPC → M routine → verify.
**Verify:** Clone → new user → M: same keys as source

### 🟢 #793 [MEDIUM] [SD-Handler] handleClearEsig: Clears e-signature. Trace: ZVE USMG ESIG with clear action
**VistA:** 200/handleClearEsig
**Fix:** Click the button/action → trace through service → server → RPC → M routine → verify.
**Verify:** Clear → M: field 20.4 empty

### 🟢 #794 [MEDIUM] [SD-Handler] confirmRemovePermission: Removes a security key. Trace: ZVE USMG KEYS DEL → ^XUSEC check
**VistA:** 200/confirmRemovePermission
**Fix:** Click the button/action → trace through service → server → RPC → M routine → verify.
**Verify:** Remove ORES → M: key gone from File 200 sub-file 51

### 🟢 #795 [MEDIUM] [SD-Handler] handleOpenAssignPerms: Opens permission assignment modal. Trace: Loads all keys from DDR LISTER on File 19.1
**VistA:** 200/handleOpenAssignPerms
**Fix:** Click the button/action → trace through service → server → RPC → M routine → verify.
**Verify:** Modal opens → all keys listed

### 🟢 #796 [MEDIUM] [SD-Handler] handleAssignPerm: Assigns one key. Trace: ZVE USMG KEYS ADD
**VistA:** 200/handleAssignPerm
**Fix:** Click the button/action → trace through service → server → RPC → M routine → verify.
**Verify:** Assign PROVIDER → M: key in sub-file 51 + ^XUSEC

### 🟢 #797 [MEDIUM] [SD-Handler] handleProviderFieldSave: Saves inline provider field edit. Trace: PUT /users/:duz/provider → DDR FILER
**VistA:** 200/handleProviderFieldSave
**Fix:** Click the button/action → trace through service → server → RPC → M routine → verify.
**Verify:** Edit NPI inline → M: field 41.99 updated

### 🟢 #798 [MEDIUM] [SD-Handler] handleBasicFieldSave: Saves inline basic field edit. Trace: PUT /users/:ien → ZVE USER EDIT or DDR
**VistA:** 200/handleBasicFieldSave
**Fix:** Click the button/action → trace through service → server → RPC → M routine → verify.
**Verify:** Edit phone inline → M: field .132 updated

### 🟢 #799 [MEDIUM] [SD-Handler] loadData: Loads staff list + esig. Trace: GET /users + GET /esig-status
**VistA:** 200/loadData
**Fix:** Click the button/action → trace through service → server → RPC → M routine → verify.
**Verify:** Page load → data appears within 2 seconds

### 🟢 #800 [MEDIUM] [SD-Handler] handleExportCsv: Exports filtered list as CSV. Trace: Client-side CSV generation from filtered array
**VistA:** 200/handleExportCsv
**Fix:** Click the button/action → trace through service → server → RPC → M routine → verify.
**Verify:** Export → CSV file downloads with correct filtered data

### 🟢 #801 [MEDIUM] [SD-Handler] handleTerminate: Full account termination. Trace: ZVE USMG TERM → clears creds + keys + DISUSER
**VistA:** 200/handleTerminate
**Fix:** Click the button/action → trace through service → server → RPC → M routine → verify.
**Verify:** Terminate → M: access code empty, 0 keys, DISUSER=1

### 🟢 #802 [MEDIUM] [SF-Handler] handleSubmit(new): Creates new user. Trace: POST /users → ZVE USMG ADD + EXTRA_MAP + keys + divisions
**VistA:** 200/handleSubmit(new)
**Fix:** Execute action → verify end-to-end.
**Verify:** Create → M: all fields present

### 🟢 #803 [MEDIUM] [SF-Handler] handleSubmit(edit): Saves edited fields. Trace: For each changed field → PUT /users/:ien
**VistA:** 200/handleSubmit(edit)
**Fix:** Execute action → verify end-to-end.
**Verify:** Edit 3 fields → M: all 3 updated

### 🟢 #804 [MEDIUM] [SF-Handler] validateStep(person): Validates Person & Credentials step. Trace: Name, sex, DOB, credentials validated
**VistA:** 200/validateStep(person)
**Fix:** Execute action → verify end-to-end.
**Verify:** Leave name empty → error. Fill all → no error.

### 🟢 #805 [MEDIUM] [SF-Handler] validateStep(role): Validates Role & Location step. Trace: Role, department, site required
**VistA:** 200/validateStep(role)
**Fix:** Execute action → verify end-to-end.
**Verify:** Leave role empty → error.

### 🟢 #806 [MEDIUM] [SF-Handler] validateStep(provider): Validates Provider Setup step. Trace: NPI, DEA format checks
**VistA:** 200/validateStep(provider)
**Fix:** Execute action → verify end-to-end.
**Verify:** Invalid NPI → error. Valid → passes.

### 🟢 #807 [MEDIUM] [SF-Handler] searchCosignerProviders: Searches for cosigner candidates. Trace: Debounced GET /users with search → filter by provider
**VistA:** 200/searchCosignerProviders
**Fix:** Execute action → verify end-to-end.
**Verify:** Type "SMI" → provider list appears

### 🟢 #808 [MEDIUM] [SF-Handler] handleNameBlur: Validates name on blur. Trace: Checks format, length, special chars
**VistA:** 200/handleNameBlur
**Fix:** Execute action → verify end-to-end.
**Verify:** Leave name → error appears immediately

### 🟢 #809 [MEDIUM] [SF-Handler] acCheckTimeout: Checks username availability. Trace: POST /users/check-access-code → ZVE USMG CHKAC
**VistA:** 200/acCheckTimeout
**Fix:** Execute action → verify end-to-end.
**Verify:** Type existing username → "Already in use" shown

### 🟢 #810 [MEDIUM] [RT-Handler] handleConfirmAssignRole: Assigns role to user. Trace: Loop keys → ZVE USMG KEYS ADD for each
**VistA:** 19.1/handleConfirmAssignRole
**Fix:** Execute → verify.
**Verify:** Assign Physician → M: all 6 keys present

### 🟢 #811 [MEDIUM] [RT-Handler] handleConfirmRemoveRole: Removes all role keys from user. Trace: Loop keys → ZVE USMG KEYS DEL for each
**VistA:** 19.1/handleConfirmRemoveRole
**Fix:** Execute → verify.
**Verify:** Remove role → M: all role keys gone

### 🟢 #812 [MEDIUM] [RT-Handler] cycleAccess: Toggles workspace access for custom role. Trace: Updates local state → saves to custom role storage
**VistA:** 19.1/cycleAccess
**Fix:** Execute → verify.
**Verify:** Cycle rw→ro→none → saves correctly

### 🟢 #813 [MEDIUM] [RT-Handler] handleResetDefault: Resets custom role to built-in defaults. Trace: Restores original key set
**VistA:** 19.1/handleResetDefault
**Fix:** Execute → verify.
**Verify:** Reset → keys match original built-in role

### 🟢 #814 [MEDIUM] [RT-Handler] handleCreateCustomRole: Creates new custom role. Trace: ZVE SITE CR CRT
**VistA:** 19.1/handleCreateCustomRole
**Fix:** Execute → verify.
**Verify:** Create → M: role exists in ^ZVEX

### 🟢 #815 [MEDIUM] [RT-Handler] handleDeleteCustomRole: Deletes custom role. Trace: ZVE SITE CR DEL
**VistA:** 19.1/handleDeleteCustomRole
**Fix:** Execute → verify.
**Verify:** Delete → M: role removed

### 🟢 #816 [MEDIUM] [SA-Handler] handleSubmit(login): Saves login security params. Trace: PUT /params/kernel → ZVE PARAM SET for each param
**VistA:** 8989.3/handleSubmit(login)
**Fix:** Execute → verify.
**Verify:** Change AUTOLOGOFF → M: Kernel Site Params updated

### 🟢 #817 [MEDIUM] [SA-Handler] handleSubmit(password): Saves password policy. Trace: PUT /params/kernel for password params
**VistA:** 8989.3/handleSubmit(password)
**Fix:** Execute → verify.
**Verify:** Change expiration → M: param updated

### 🟢 #818 [MEDIUM] [SA-Handler] handleSubmit(esig): Saves e-sig policy. Trace: PUT /params/kernel for e-sig params
**VistA:** 8989.3/handleSubmit(esig)
**Fix:** Execute → verify.
**Verify:** Change e-sig rules → M: param updated

### 🟢 #819 [MEDIUM] [SA-Handler] submit2PChange: Submits 2P approval request. Trace: POST /2p-submit → ZVE MM TWOPSUB
**VistA:** 8989.3/submit2PChange
**Fix:** Execute → verify.
**Verify:** Submit → pending request visible to other admins

### 🟢 #820 [MEDIUM] [SA-Handler] approve2PRequest: Approves pending 2P request. Trace: POST /2p-action approve → ZVE MM TWOPACT
**VistA:** 8989.3/approve2PRequest
**Fix:** Execute → verify.
**Verify:** Approve → parameter actually changes in VistA

### 🟢 #821 [MEDIUM] [SA-Handler] reject2PRequest: Rejects pending 2P request. Trace: POST /2p-action reject → ZVE MM TWOPACT
**VistA:** 8989.3/reject2PRequest
**Fix:** Execute → verify.
**Verify:** Reject → request removed, no param change

### 🟢 #822 [MEDIUM] [CM-Handler] handleCreate: Creates new clinic. Trace: POST /clinics → ZVE CLNM ADD → File 44
**VistA:** 44/handleCreate
**Fix:** Execute → verify.
**Verify:** Create "CARDIOLOGY" → M: File 44 entry

### 🟢 #823 [MEDIUM] [CM-Handler] handleSave: Saves clinic field edit. Trace: PUT /clinics/:ien/fields → DDR FILER → File 44
**VistA:** 44/handleSave
**Fix:** Execute → verify.
**Verify:** Edit name → M: File 44 name updated

### 🟢 #824 [MEDIUM] [CM-Handler] handleInactivate: Inactivates clinic. Trace: PUT /clinics/:ien → sets inactive flag
**VistA:** 44/handleInactivate
**Fix:** Execute → verify.
**Verify:** Inactivate → M: inactive flag set, not deleted

### 🟢 #825 [MEDIUM] [CM-Handler] handleReactivate: Reactivates clinic. Trace: PUT /clinics/:ien → clears inactive flag
**VistA:** 44/handleReactivate
**Fix:** Execute → verify.
**Verify:** Reactivate → M: active again

### 🟢 #826 [MEDIUM] [CM-Handler] loadAvailability: Loads clinic availability. Trace: GET /clinics/:ien/availability → ZVE CLINIC AVAIL GET
**VistA:** 44/loadAvailability
**Fix:** Execute → verify.
**Verify:** Click clinic → availability slots shown

### 🟢 #827 [MEDIUM] [WM-Handler] WardMgmt handleCreate: Creates ward in File 42
**VistA:** 42
**Fix:** POST /wards → writes to File 42
**Verify:** Create → M: File 42 entry

### 🟢 #828 [MEDIUM] [WM-Handler] WardMgmt handleSave: Edits ward field
**VistA:** 42
**Fix:** PUT /wards/:ien → DDR FILER
**Verify:** Edit → M: updated

### 🟢 #829 [MEDIUM] [DM-Handler] DeviceMgmt handleCreate: Creates device in File 3.5
**VistA:** 3.5
**Fix:** POST /devices → writes to File 3.5
**Verify:** Create → M: File 3.5 entry

### 🟢 #830 [MEDIUM] [DM-Handler] DeviceMgmt handleSave: Edits device field
**VistA:** 3.5
**Fix:** PUT /devices/:ien → DDR FILER
**Verify:** Edit → M: updated

### 🟢 #831 [MEDIUM] [DM-Handler] DeviceMgmt handleDelete: Deletes device from File 3.5
**VistA:** 3.5
**Fix:** DELETE /devices/:ien → DDR FILER
**Verify:** Delete → M: gone

### 🟢 #832 [MEDIUM] [DM-Handler] DeviceMgmt handleTestPrint: Sends test print
**VistA:** 3.5
**Fix:** POST /devices/:ien/test-print → ZVE DEV TESTPRINT
**Verify:** Test → output sent

### 🟢 #833 [MEDIUM] [MG-Handler] MailGrpMgmt handleAddMember: Adds member to group
**VistA:** 3.8
**Fix:** POST /mailgroups/:ien/members → ZVE MAILGRP ADD
**Verify:** Add → M: member in group

### 🟢 #834 [MEDIUM] [MG-Handler] MailGrpMgmt handleRemoveMember: Removes member
**VistA:** 3.8
**Fix:** DELETE /mailgroups/:ien/members/:duz → ZVE MAILGRP REMOVE
**Verify:** Remove → M: member gone

### 🟢 #835 [MEDIUM] [DS-Handler] DeptService handleCreate: Creates department in File 49
**VistA:** 49
**Fix:** POST /departments → DDR FILER
**Verify:** Create → M: File 49 entry

### 🟢 #836 [MEDIUM] [DS-Handler] DeptService handleDelete: Deletes department
**VistA:** 49
**Fix:** DELETE /departments/:ien → DDR FILER
**Verify:** Delete → M: File 49 entry gone

### 🟢 #837 [MEDIUM] [SM-Handler] SiteMgmt handleToggleWorkspace: Enables/disables workspace
**VistA:** 4
**Fix:** PUT /sites/:ien/workspaces → ZVE SITE WS SET
**Verify:** Toggle → M: workspace state changed

### 🟢 #838 [MEDIUM] [SM-Handler] SiteMgmt handleDeleteSite: Deletes site/division
**VistA:** 4
**Fix:** DELETE /sites/:ien
**Verify:** Delete → M: File 4 affected

### 🟢 #839 [MEDIUM] [SP-Handler] SiteParams handleSave: Saves module parameters
**VistA:** 8989.3
**Fix:** PUT /params/:package → DDR FILER
**Verify:** Save → M: parameter updated

### 🟢 #840 [MEDIUM] [AN-Handler] AlertsNotify handleSend (MailMan): Sends message
**VistA:** 3.9
**Fix:** POST /mailman → ZVE MM SEND
**Verify:** Send → M: message in ^XMB

### 🟢 #841 [MEDIUM] [AN-Handler] AlertsNotify handleDelete (MailMan): Deletes message
**VistA:** 3.9
**Fix:** DELETE /mailman/:ien → ZVE MM DEL
**Verify:** Delete → M: message gone

### 🟢 #842 [MEDIUM] [AN-Handler] AlertsNotify handleSend (Alert): Creates alert
**VistA:** 3.9
**Fix:** POST /alerts → ZVE ALERT CREATE
**Verify:** Create → M: alert exists

### 🟢 #843 [MEDIUM] [AL-Handler] AuditLog loadData: Loads audit from 4 sources
**VistA:** 1.1
**Fix:** GET /audit → ZVEADMIN AUDIT(FileMan,SignOn,ErrorTrap,ZVE)
**Verify:** Load → all 4 source tabs have data

### 🟢 #844 [MEDIUM] [SH-Handler] SystemHealth loadData: Loads HL7 + TaskMan + errors
**VistA:** Vista
**Fix:** GET /health/* → ZVE HL7 + ZVE TASKMAN RPCs
**Verify:** Load → HL7 status + TaskMan status + error traps shown

### 🟢 #845 [MEDIUM] [SC-Handler] SystemConfig handleSave: Saves welcome message
**VistA:** 8989.3
**Fix:** PUT /config/welcome → ZVE PARAM SET
**Verify:** Edit welcome → login page shows new text

### 🟢 #846 [MEDIUM] [AD-Handler] AdminDash loadData: Loads all dashboard counts
**VistA:** Vista
**Fix:** GET /dashboard → counts from File 200, 44, 42, 3.5, etc.
**Verify:** Load → all counts match M prompt queries

### 🟢 #847 [MEDIUM] [AR-Handler] AdminReports handleRunReport: Generates report
**VistA:** Vista
**Fix:** GET /reports/:id → various DDR queries
**Verify:** Run report → real data returned

### 🟢 #848 [MEDIUM] [PS-Handler] PatientSearch handleSearch: Searches File 2
**VistA:** 2
**Fix:** GET /patients/search → ZVE PATIENT SEARCH → scans ^DPT
**Verify:** Search "SMITH" → results from File 2

### 🟢 #849 [MEDIUM] [PS-Handler] PatientSearch handleSelect: Selects patient and navigates
**VistA:** 2
**Fix:** Sets selected patient → navigates to demographics
**Verify:** Select → demographics page loads with patient data

### 🟢 #850 [MEDIUM] [PS-Handler] PatientSearch handleNewPatient: Opens registration form
**VistA:** 2
**Fix:** Navigates to blank demographics form
**Verify:** Click New → empty registration form

### 🟢 #851 [MEDIUM] [PD-Handler] PatientDemo handleRegister: Creates patient in File 2
**VistA:** 2
**Fix:** POST /patients → ZVE PATIENT REG → FileMan LAYGO
**Verify:** Register → M: File 2 entry with all fields

### 🟢 #852 [MEDIUM] [PD-Handler] PatientDemo handleSave: Saves demographic edits
**VistA:** 2
**Fix:** PUT /patients/:dfn → ZVE PATIENT EDIT per field
**Verify:** Edit phone → M: field .131 updated

### 🟢 #853 [MEDIUM] [PD-Handler] PatientDemo handleDuplCheck: Checks for duplicate patients
**VistA:** 2
**Fix:** POST /patients/duplicate → ZVE PATIENT DUPLICATE
**Verify:** Enter SMITH 1990-01-01 → duplicates shown if exist

### 🟢 #854 [MEDIUM] [IC-Handler] Insurance handleAddInsurance: Adds insurance entry
**VistA:** 2.312
**Fix:** POST /patients/:dfn/insurance → ZVE PATIENT INS ADD
**Verify:** Add Blue Cross → M: File 2.312 sub-entry

### 🟢 #855 [MEDIUM] [IC-Handler] Insurance handleEditInsurance: Edits insurance details
**VistA:** 2.312
**Fix:** PUT /patients/:dfn/insurance/:ien → ZVE PATIENT INS EDIT
**Verify:** Edit group number → M: sub-file updated

### 🟢 #856 [MEDIUM] [IC-Handler] Insurance handleDeleteInsurance: Removes insurance
**VistA:** 2.312
**Fix:** DELETE /patients/:dfn/insurance/:ien → ZVE PATIENT INS DEL
**Verify:** Delete → M: sub-entry removed

### 🟢 #857 [MEDIUM] [FA-Handler] Financial handleSaveMeansTest: Saves means test
**VistA:** 408.31
**Fix:** POST /patients/:dfn/means-test → ZVE PATIENT MEANS
**Verify:** Complete test → M: File 408.31 entry

### 🟢 #858 [MEDIUM] [AM-Handler] Admission handleAdmit: Admits patient
**VistA:** 405
**Fix:** POST /patients/:dfn/admit → ZVE ADT ADMIT
**Verify:** Admit → M: File 405 movement type 1

### 🟢 #859 [MEDIUM] [DC-Handler] Discharge handleDischarge: Discharges patient
**VistA:** 405
**Fix:** POST /patients/:dfn/discharge → ZVE ADT DISCHARGE
**Verify:** Discharge → M: File 405 discharge movement

### 🟢 #860 [MEDIUM] [TR-Handler] Transfer handleTransfer: Transfers patient
**VistA:** 405
**Fix:** POST /patients/:dfn/transfer → ZVE ADT TRANSFER
**Verify:** Transfer → M: File 405 transfer movement

### 🟢 #861 [MEDIUM] [PF-Handler] PatientFlags handleAddFlag: Adds patient flag
**VistA:** 26.13
**Fix:** POST /patients/:dfn/flags → ZVE PATIENT FLAGS ADD
**Verify:** Add flag → M: File 26.13 entry

### 🟢 #862 [MEDIUM] [PF-Handler] PatientFlags handleRemoveFlag: Removes flag
**VistA:** 26.13
**Fix:** DELETE /patients/:dfn/flags/:ien → ZVE PATIENT FLAGS DEL
**Verify:** Remove → M: flag removed

### 🟢 #863 [MEDIUM] [BM-Handler] BedMgmt handleAssignBed: Assigns bed to patient
**VistA:** 405.4
**Fix:** PUT /patients/:dfn/bed → updates Room-Bed assignment
**Verify:** Assign → M: bed occupied

### 🟢 #864 [MEDIUM] [RR-Handler] RecordRestrict handleSetSensitivity: Sets patient sensitivity level
**VistA:** 2
**Fix:** PUT /patients/:dfn/sensitivity → sets DG SENSITIVITY flag
**Verify:** Set sensitive → M: flag set

### 🟢 #865 [MEDIUM] [PDB-Handler] PatientDash loadData: Loads patient overview
**VistA:** 2
**Fix:** GET /patients/:dfn/dashboard → demographics + insurance + flags + movements
**Verify:** Load → all sections populated

---

# SECTION 21: RESPONSIVE / MOBILE

### ⚪ #866 [LOW] [StaffDirectory] StaffDirectory: Tablet (768px) layout — verify no horizontal scroll, readable text, tappable buttons
**VistA:** Responsive
**Fix:** Test at 768px width. Fix any overflow, tiny buttons, or illegible text.
**Verify:** StaffDirectory at 768px → fully usable

### ⚪ #867 [LOW] [StaffDirectory] StaffDirectory: Mobile (375px) layout — verify critical actions still accessible
**VistA:** Responsive
**Fix:** Test at 375px. Stack layouts. Ensure primary actions visible.
**Verify:** StaffDirectory at 375px → primary action works

### ⚪ #868 [LOW] [StaffForm] StaffForm: Tablet (768px) layout — verify no horizontal scroll, readable text, tappable buttons
**VistA:** Responsive
**Fix:** Test at 768px width. Fix any overflow, tiny buttons, or illegible text.
**Verify:** StaffForm at 768px → fully usable

### ⚪ #869 [LOW] [StaffForm] StaffForm: Mobile (375px) layout — verify critical actions still accessible
**VistA:** Responsive
**Fix:** Test at 375px. Stack layouts. Ensure primary actions visible.
**Verify:** StaffForm at 375px → primary action works

### ⚪ #870 [LOW] [RoleTemplates] RoleTemplates: Tablet (768px) layout — verify no horizontal scroll, readable text, tappable buttons
**VistA:** Responsive
**Fix:** Test at 768px width. Fix any overflow, tiny buttons, or illegible text.
**Verify:** RoleTemplates at 768px → fully usable

### ⚪ #871 [LOW] [RoleTemplates] RoleTemplates: Mobile (375px) layout — verify critical actions still accessible
**VistA:** Responsive
**Fix:** Test at 375px. Stack layouts. Ensure primary actions visible.
**Verify:** RoleTemplates at 375px → primary action works

### ⚪ #872 [LOW] [PermsCatalog] PermsCatalog: Tablet (768px) layout — verify no horizontal scroll, readable text, tappable buttons
**VistA:** Responsive
**Fix:** Test at 768px width. Fix any overflow, tiny buttons, or illegible text.
**Verify:** PermsCatalog at 768px → fully usable

### ⚪ #873 [LOW] [PermsCatalog] PermsCatalog: Mobile (375px) layout — verify critical actions still accessible
**VistA:** Responsive
**Fix:** Test at 375px. Stack layouts. Ensure primary actions visible.
**Verify:** PermsCatalog at 375px → primary action works

### ⚪ #874 [LOW] [SecurityAuth] SecurityAuth: Tablet (768px) layout — verify no horizontal scroll, readable text, tappable buttons
**VistA:** Responsive
**Fix:** Test at 768px width. Fix any overflow, tiny buttons, or illegible text.
**Verify:** SecurityAuth at 768px → fully usable

### ⚪ #875 [LOW] [SecurityAuth] SecurityAuth: Mobile (375px) layout — verify critical actions still accessible
**VistA:** Responsive
**Fix:** Test at 375px. Stack layouts. Ensure primary actions visible.
**Verify:** SecurityAuth at 375px → primary action works

### ⚪ #876 [LOW] [SiteParams] SiteParams: Tablet (768px) layout — verify no horizontal scroll, readable text, tappable buttons
**VistA:** Responsive
**Fix:** Test at 768px width. Fix any overflow, tiny buttons, or illegible text.
**Verify:** SiteParams at 768px → fully usable

### ⚪ #877 [LOW] [SiteParams] SiteParams: Mobile (375px) layout — verify critical actions still accessible
**VistA:** Responsive
**Fix:** Test at 375px. Stack layouts. Ensure primary actions visible.
**Verify:** SiteParams at 375px → primary action works

### ⚪ #878 [LOW] [AdminDash] AdminDash: Tablet (768px) layout — verify no horizontal scroll, readable text, tappable buttons
**VistA:** Responsive
**Fix:** Test at 768px width. Fix any overflow, tiny buttons, or illegible text.
**Verify:** AdminDash at 768px → fully usable

### ⚪ #879 [LOW] [AdminDash] AdminDash: Mobile (375px) layout — verify critical actions still accessible
**VistA:** Responsive
**Fix:** Test at 375px. Stack layouts. Ensure primary actions visible.
**Verify:** AdminDash at 375px → primary action works

### ⚪ #880 [LOW] [AdminReports] AdminReports: Tablet (768px) layout — verify no horizontal scroll, readable text, tappable buttons
**VistA:** Responsive
**Fix:** Test at 768px width. Fix any overflow, tiny buttons, or illegible text.
**Verify:** AdminReports at 768px → fully usable

### ⚪ #881 [LOW] [AdminReports] AdminReports: Mobile (375px) layout — verify critical actions still accessible
**VistA:** Responsive
**Fix:** Test at 375px. Stack layouts. Ensure primary actions visible.
**Verify:** AdminReports at 375px → primary action works

### ⚪ #882 [LOW] [AlertsNotify] AlertsNotify: Tablet (768px) layout — verify no horizontal scroll, readable text, tappable buttons
**VistA:** Responsive
**Fix:** Test at 768px width. Fix any overflow, tiny buttons, or illegible text.
**Verify:** AlertsNotify at 768px → fully usable

### ⚪ #883 [LOW] [AlertsNotify] AlertsNotify: Mobile (375px) layout — verify critical actions still accessible
**VistA:** Responsive
**Fix:** Test at 375px. Stack layouts. Ensure primary actions visible.
**Verify:** AlertsNotify at 375px → primary action works

### ⚪ #884 [LOW] [AuditLog] AuditLog: Tablet (768px) layout — verify no horizontal scroll, readable text, tappable buttons
**VistA:** Responsive
**Fix:** Test at 768px width. Fix any overflow, tiny buttons, or illegible text.
**Verify:** AuditLog at 768px → fully usable

### ⚪ #885 [LOW] [AuditLog] AuditLog: Mobile (375px) layout — verify critical actions still accessible
**VistA:** Responsive
**Fix:** Test at 375px. Stack layouts. Ensure primary actions visible.
**Verify:** AuditLog at 375px → primary action works

### ⚪ #886 [LOW] [ClinicMgmt] ClinicMgmt: Tablet (768px) layout — verify no horizontal scroll, readable text, tappable buttons
**VistA:** Responsive
**Fix:** Test at 768px width. Fix any overflow, tiny buttons, or illegible text.
**Verify:** ClinicMgmt at 768px → fully usable

### ⚪ #887 [LOW] [ClinicMgmt] ClinicMgmt: Mobile (375px) layout — verify critical actions still accessible
**VistA:** Responsive
**Fix:** Test at 375px. Stack layouts. Ensure primary actions visible.
**Verify:** ClinicMgmt at 375px → primary action works

### ⚪ #888 [LOW] [WardMgmt] WardMgmt: Tablet (768px) layout — verify no horizontal scroll, readable text, tappable buttons
**VistA:** Responsive
**Fix:** Test at 768px width. Fix any overflow, tiny buttons, or illegible text.
**Verify:** WardMgmt at 768px → fully usable

### ⚪ #889 [LOW] [WardMgmt] WardMgmt: Mobile (375px) layout — verify critical actions still accessible
**VistA:** Responsive
**Fix:** Test at 375px. Stack layouts. Ensure primary actions visible.
**Verify:** WardMgmt at 375px → primary action works

### ⚪ #890 [LOW] [DeviceMgmt] DeviceMgmt: Tablet (768px) layout — verify no horizontal scroll, readable text, tappable buttons
**VistA:** Responsive
**Fix:** Test at 768px width. Fix any overflow, tiny buttons, or illegible text.
**Verify:** DeviceMgmt at 768px → fully usable

### ⚪ #891 [LOW] [DeviceMgmt] DeviceMgmt: Mobile (375px) layout — verify critical actions still accessible
**VistA:** Responsive
**Fix:** Test at 375px. Stack layouts. Ensure primary actions visible.
**Verify:** DeviceMgmt at 375px → primary action works

### ⚪ #892 [LOW] [MailGrpMgmt] MailGrpMgmt: Tablet (768px) layout — verify no horizontal scroll, readable text, tappable buttons
**VistA:** Responsive
**Fix:** Test at 768px width. Fix any overflow, tiny buttons, or illegible text.
**Verify:** MailGrpMgmt at 768px → fully usable

### ⚪ #893 [LOW] [MailGrpMgmt] MailGrpMgmt: Mobile (375px) layout — verify critical actions still accessible
**VistA:** Responsive
**Fix:** Test at 375px. Stack layouts. Ensure primary actions visible.
**Verify:** MailGrpMgmt at 375px → primary action works

### ⚪ #894 [LOW] [DeptService] DeptService: Tablet (768px) layout — verify no horizontal scroll, readable text, tappable buttons
**VistA:** Responsive
**Fix:** Test at 768px width. Fix any overflow, tiny buttons, or illegible text.
**Verify:** DeptService at 768px → fully usable

### ⚪ #895 [LOW] [DeptService] DeptService: Mobile (375px) layout — verify critical actions still accessible
**VistA:** Responsive
**Fix:** Test at 375px. Stack layouts. Ensure primary actions visible.
**Verify:** DeptService at 375px → primary action works

### ⚪ #896 [LOW] [SiteMgmt] SiteMgmt: Tablet (768px) layout — verify no horizontal scroll, readable text, tappable buttons
**VistA:** Responsive
**Fix:** Test at 768px width. Fix any overflow, tiny buttons, or illegible text.
**Verify:** SiteMgmt at 768px → fully usable

### ⚪ #897 [LOW] [SiteMgmt] SiteMgmt: Mobile (375px) layout — verify critical actions still accessible
**VistA:** Responsive
**Fix:** Test at 375px. Stack layouts. Ensure primary actions visible.
**Verify:** SiteMgmt at 375px → primary action works

### ⚪ #898 [LOW] [SystemHealth] SystemHealth: Tablet (768px) layout — verify no horizontal scroll, readable text, tappable buttons
**VistA:** Responsive
**Fix:** Test at 768px width. Fix any overflow, tiny buttons, or illegible text.
**Verify:** SystemHealth at 768px → fully usable

### ⚪ #899 [LOW] [SystemHealth] SystemHealth: Mobile (375px) layout — verify critical actions still accessible
**VistA:** Responsive
**Fix:** Test at 375px. Stack layouts. Ensure primary actions visible.
**Verify:** SystemHealth at 375px → primary action works

### ⚪ #900 [LOW] [SystemConfig] SystemConfig: Tablet (768px) layout — verify no horizontal scroll, readable text, tappable buttons
**VistA:** Responsive
**Fix:** Test at 768px width. Fix any overflow, tiny buttons, or illegible text.
**Verify:** SystemConfig at 768px → fully usable

### ⚪ #901 [LOW] [SystemConfig] SystemConfig: Mobile (375px) layout — verify critical actions still accessible
**VistA:** Responsive
**Fix:** Test at 375px. Stack layouts. Ensure primary actions visible.
**Verify:** SystemConfig at 375px → primary action works

### ⚪ #902 [LOW] [PatientSearch] PatientSearch: Tablet (768px) layout — verify no horizontal scroll, readable text, tappable buttons
**VistA:** Responsive
**Fix:** Test at 768px width. Fix any overflow, tiny buttons, or illegible text.
**Verify:** PatientSearch at 768px → fully usable

### ⚪ #903 [LOW] [PatientSearch] PatientSearch: Mobile (375px) layout — verify critical actions still accessible
**VistA:** Responsive
**Fix:** Test at 375px. Stack layouts. Ensure primary actions visible.
**Verify:** PatientSearch at 375px → primary action works

### ⚪ #904 [LOW] [PatientDemo] PatientDemo: Tablet (768px) layout — verify no horizontal scroll, readable text, tappable buttons
**VistA:** Responsive
**Fix:** Test at 768px width. Fix any overflow, tiny buttons, or illegible text.
**Verify:** PatientDemo at 768px → fully usable

### ⚪ #905 [LOW] [PatientDemo] PatientDemo: Mobile (375px) layout — verify critical actions still accessible
**VistA:** Responsive
**Fix:** Test at 375px. Stack layouts. Ensure primary actions visible.
**Verify:** PatientDemo at 375px → primary action works

### ⚪ #906 [LOW] [Insurance] Insurance: Tablet (768px) layout — verify no horizontal scroll, readable text, tappable buttons
**VistA:** Responsive
**Fix:** Test at 768px width. Fix any overflow, tiny buttons, or illegible text.
**Verify:** Insurance at 768px → fully usable

### ⚪ #907 [LOW] [Insurance] Insurance: Mobile (375px) layout — verify critical actions still accessible
**VistA:** Responsive
**Fix:** Test at 375px. Stack layouts. Ensure primary actions visible.
**Verify:** Insurance at 375px → primary action works

### ⚪ #908 [LOW] [Financial] Financial: Tablet (768px) layout — verify no horizontal scroll, readable text, tappable buttons
**VistA:** Responsive
**Fix:** Test at 768px width. Fix any overflow, tiny buttons, or illegible text.
**Verify:** Financial at 768px → fully usable

### ⚪ #909 [LOW] [Financial] Financial: Mobile (375px) layout — verify critical actions still accessible
**VistA:** Responsive
**Fix:** Test at 375px. Stack layouts. Ensure primary actions visible.
**Verify:** Financial at 375px → primary action works

### ⚪ #910 [LOW] [Admission] Admission: Tablet (768px) layout — verify no horizontal scroll, readable text, tappable buttons
**VistA:** Responsive
**Fix:** Test at 768px width. Fix any overflow, tiny buttons, or illegible text.
**Verify:** Admission at 768px → fully usable

### ⚪ #911 [LOW] [Admission] Admission: Mobile (375px) layout — verify critical actions still accessible
**VistA:** Responsive
**Fix:** Test at 375px. Stack layouts. Ensure primary actions visible.
**Verify:** Admission at 375px → primary action works

### ⚪ #912 [LOW] [Discharge] Discharge: Tablet (768px) layout — verify no horizontal scroll, readable text, tappable buttons
**VistA:** Responsive
**Fix:** Test at 768px width. Fix any overflow, tiny buttons, or illegible text.
**Verify:** Discharge at 768px → fully usable

### ⚪ #913 [LOW] [Discharge] Discharge: Mobile (375px) layout — verify critical actions still accessible
**VistA:** Responsive
**Fix:** Test at 375px. Stack layouts. Ensure primary actions visible.
**Verify:** Discharge at 375px → primary action works

### ⚪ #914 [LOW] [Transfer] Transfer: Tablet (768px) layout — verify no horizontal scroll, readable text, tappable buttons
**VistA:** Responsive
**Fix:** Test at 768px width. Fix any overflow, tiny buttons, or illegible text.
**Verify:** Transfer at 768px → fully usable

### ⚪ #915 [LOW] [Transfer] Transfer: Mobile (375px) layout — verify critical actions still accessible
**VistA:** Responsive
**Fix:** Test at 375px. Stack layouts. Ensure primary actions visible.
**Verify:** Transfer at 375px → primary action works

### ⚪ #916 [LOW] [BedMgmt] BedMgmt: Tablet (768px) layout — verify no horizontal scroll, readable text, tappable buttons
**VistA:** Responsive
**Fix:** Test at 768px width. Fix any overflow, tiny buttons, or illegible text.
**Verify:** BedMgmt at 768px → fully usable

### ⚪ #917 [LOW] [BedMgmt] BedMgmt: Mobile (375px) layout — verify critical actions still accessible
**VistA:** Responsive
**Fix:** Test at 375px. Stack layouts. Ensure primary actions visible.
**Verify:** BedMgmt at 375px → primary action works

### ⚪ #918 [LOW] [PatientFlags] PatientFlags: Tablet (768px) layout — verify no horizontal scroll, readable text, tappable buttons
**VistA:** Responsive
**Fix:** Test at 768px width. Fix any overflow, tiny buttons, or illegible text.
**Verify:** PatientFlags at 768px → fully usable

### ⚪ #919 [LOW] [PatientFlags] PatientFlags: Mobile (375px) layout — verify critical actions still accessible
**VistA:** Responsive
**Fix:** Test at 375px. Stack layouts. Ensure primary actions visible.
**Verify:** PatientFlags at 375px → primary action works

### ⚪ #920 [LOW] [RecordRestrict] RecordRestrict: Tablet (768px) layout — verify no horizontal scroll, readable text, tappable buttons
**VistA:** Responsive
**Fix:** Test at 768px width. Fix any overflow, tiny buttons, or illegible text.
**Verify:** RecordRestrict at 768px → fully usable

### ⚪ #921 [LOW] [RecordRestrict] RecordRestrict: Mobile (375px) layout — verify critical actions still accessible
**VistA:** Responsive
**Fix:** Test at 375px. Stack layouts. Ensure primary actions visible.
**Verify:** RecordRestrict at 375px → primary action works

### ⚪ #922 [LOW] [PatientDash] PatientDash: Tablet (768px) layout — verify no horizontal scroll, readable text, tappable buttons
**VistA:** Responsive
**Fix:** Test at 768px width. Fix any overflow, tiny buttons, or illegible text.
**Verify:** PatientDash at 768px → fully usable

### ⚪ #923 [LOW] [PatientDash] PatientDash: Mobile (375px) layout — verify critical actions still accessible
**VistA:** Responsive
**Fix:** Test at 375px. Stack layouts. Ensure primary actions visible.
**Verify:** PatientDash at 375px → primary action works

### ⚪ #924 [LOW] [RegReports] RegReports: Tablet (768px) layout — verify no horizontal scroll, readable text, tappable buttons
**VistA:** Responsive
**Fix:** Test at 768px width. Fix any overflow, tiny buttons, or illegible text.
**Verify:** RegReports at 768px → fully usable

### ⚪ #925 [LOW] [RegReports] RegReports: Mobile (375px) layout — verify critical actions still accessible
**VistA:** Responsive
**Fix:** Test at 375px. Stack layouts. Ensure primary actions visible.
**Verify:** RegReports at 375px → primary action works

---

# SECTION 22: ERROR RECOVERY

### 🟢 #926 [MEDIUM] [StaffForm] Create user: Network error mid-create: user may exist in VistA but frontend doesn't know DUZ
**VistA:** ErrorRecov
**Fix:** Add check: search by name after timeout to see if user was created.
**Verify:** Trigger error → specific message shown → user can retry or take corrective action

### 🟢 #927 [MEDIUM] [StaffDirectory] Edit user field: DDR FILER rejects value: error message is technical
**VistA:** ErrorRecov
**Fix:** Show human-readable: "Title must be from the approved list."
**Verify:** Trigger error → specific message shown → user can retry or take corrective action

### 🟢 #928 [MEDIUM] [StaffDirectory] Deactivate user: User has pending orders in CPRS: VistA may reject deactivation
**VistA:** ErrorRecov
**Fix:** Surface: "Cannot deactivate: user has 3 pending orders."
**Verify:** Trigger error → specific message shown → user can retry or take corrective action

### 🟢 #929 [MEDIUM] [StaffDirectory] Assign key: Key doesn't exist in VistA 19.1: silent failure
**VistA:** ErrorRecov
**Fix:** Surface: "Key ORCL-SIGN-NOTES not found in VistA security key file."
**Verify:** Trigger error → specific message shown → user can retry or take corrective action

### 🟢 #930 [MEDIUM] [StaffDirectory] Clone user: Source user deactivated during clone: partial clone
**VistA:** ErrorRecov
**Fix:** Check source status before starting clone.
**Verify:** Trigger error → specific message shown → user can retry or take corrective action

### 🟢 #931 [MEDIUM] [ClinicMgmt] Create clinic: Duplicate clinic name in File 44
**VistA:** ErrorRecov
**Fix:** Surface: "Clinic CARDIOLOGY already exists."
**Verify:** Trigger error → specific message shown → user can retry or take corrective action

### 🟢 #932 [MEDIUM] [DeviceMgmt] Create device: Device name conflicts in File 3.5
**VistA:** ErrorRecov
**Fix:** Surface: "Device PRINTER1 already exists."
**Verify:** Trigger error → specific message shown → user can retry or take corrective action

### 🟢 #933 [MEDIUM] [AlertsNotify] Send MailMan: Recipient DUZ doesn't exist
**VistA:** ErrorRecov
**Fix:** Surface: "Recipient not found."
**Verify:** Trigger error → specific message shown → user can retry or take corrective action

### 🟢 #934 [MEDIUM] [LoginPage] Change password: New password fails VistA Kernel rules
**VistA:** ErrorRecov
**Fix:** Surface: "Password must include uppercase, lowercase, and number."
**Verify:** Trigger error → specific message shown → user can retry or take corrective action

### 🟢 #935 [MEDIUM] [PatientDemo] Register patient: Duplicate patient detected by VistA
**VistA:** ErrorRecov
**Fix:** Surface: "Possible duplicate: SMITH,JOHN DOB 01/01/1990 already exists."
**Verify:** Trigger error → specific message shown → user can retry or take corrective action

### 🟢 #936 [MEDIUM] [Admission] Admit patient: Ward is full: no available beds
**VistA:** ErrorRecov
**Fix:** Surface: "Ward 3A has 0 available beds."
**Verify:** Trigger error → specific message shown → user can retry or take corrective action

### 🟢 #937 [MEDIUM] [Discharge] Discharge patient: Patient has active orders that need discontinuation
**VistA:** ErrorRecov
**Fix:** Surface: "Cannot discharge: 5 active orders must be discontinued."
**Verify:** Trigger error → specific message shown → user can retry or take corrective action

### 🟢 #938 [MEDIUM] [Transfer] Transfer patient: Destination ward doesn't accept this patient type
**VistA:** ErrorRecov
**Fix:** Surface: "Ward 4B does not accept surgical patients."
**Verify:** Trigger error → specific message shown → user can retry or take corrective action

### 🟢 #939 [MEDIUM] [Insurance] Add insurance: Insurance company not in File 36
**VistA:** ErrorRecov
**Fix:** Surface: "Insurance company not found. Contact registration supervisor."
**Verify:** Trigger error → specific message shown → user can retry or take corrective action

### 🟢 #940 [MEDIUM] [Financial] Means test: Income data fails validation
**VistA:** ErrorRecov
**Fix:** Surface: "Annual income must be a positive number."
**Verify:** Trigger error → specific message shown → user can retry or take corrective action

### 🟢 #941 [MEDIUM] [PatientFlags] Add flag: Flag type not recognized by VistA
**VistA:** ErrorRecov
**Fix:** Surface: "Flag type CUSTOM not supported. Use BEHAVIORAL, CLINICAL, or ADMINISTRATIVE."
**Verify:** Trigger error → specific message shown → user can retry or take corrective action

### 🟢 #942 [MEDIUM] [SiteParams] Save parameter: Parameter value out of valid range
**VistA:** ErrorRecov
**Fix:** Surface: "AUTOLOGOFF must be between 60 and 900 seconds."
**Verify:** Trigger error → specific message shown → user can retry or take corrective action

### 🟢 #943 [MEDIUM] [SecurityAuth] 2P submit: Approver is the same person as submitter
**VistA:** ErrorRecov
**Fix:** Block: "Cannot approve your own request. A different administrator must approve."
**Verify:** Trigger error → specific message shown → user can retry or take corrective action

### 🟢 #944 [MEDIUM] [DeptService] Delete department: Users assigned to this department
**VistA:** ErrorRecov
**Fix:** Block: "Cannot delete: 12 staff members assigned to CARDIOLOGY."
**Verify:** Trigger error → specific message shown → user can retry or take corrective action

### 🟢 #945 [MEDIUM] [SiteMgmt] Delete site: Active clinics in this division
**VistA:** ErrorRecov
**Fix:** Block: "Cannot delete: 5 active clinics in this division."
**Verify:** Trigger error → specific message shown → user can retry or take corrective action

---

# SECTION 23: HELP TEXT & TOOLTIPS

### ⚪ #946 [LOW] [StaffForm] Field "lastName": Add tooltip/help icon with text: "Format: uppercase. VistA stores as LAST,FIRST MI."
**VistA:** HelpText
**Fix:** Add ℹ️ icon next to field label. On hover/click: show help text.
**Verify:** Hover ℹ️ next to lastName → tooltip appears with explanation

### ⚪ #947 [LOW] [StaffForm] Field "firstName": Add tooltip/help icon with text: "Will be combined with last name in VistA format."
**VistA:** HelpText
**Fix:** Add ℹ️ icon next to field label. On hover/click: show help text.
**Verify:** Hover ℹ️ next to firstName → tooltip appears with explanation

### ⚪ #948 [LOW] [StaffForm] Field "sex": Add tooltip/help icon with text: "VistA File 200 field 4. Used for clinical calculations."
**VistA:** HelpText
**Fix:** Add ℹ️ icon next to field label. On hover/click: show help text.
**Verify:** Hover ℹ️ next to sex → tooltip appears with explanation

### ⚪ #949 [LOW] [StaffForm] Field "dob": Add tooltip/help icon with text: "VistA File 200 field 5. Stored in FileMan internal format."
**VistA:** HelpText
**Fix:** Add ℹ️ icon next to field label. On hover/click: show help text.
**Verify:** Hover ℹ️ next to dob → tooltip appears with explanation

### ⚪ #950 [LOW] [StaffForm] Field "govIdLast4": Add tooltip/help icon with text: "Last 4 digits of government ID for verification purposes."
**VistA:** HelpText
**Fix:** Add ℹ️ icon next to field label. On hover/click: show help text.
**Verify:** Hover ℹ️ next to govIdLast4 → tooltip appears with explanation

### ⚪ #951 [LOW] [StaffForm] Field "email": Add tooltip/help icon with text: "VistA File 200 field .151. Used for password reset and notifications."
**VistA:** HelpText
**Fix:** Add ℹ️ icon next to field label. On hover/click: show help text.
**Verify:** Hover ℹ️ next to email → tooltip appears with explanation

### ⚪ #952 [LOW] [StaffForm] Field "phone": Add tooltip/help icon with text: "VistA File 200 field .132 (Office Phone)."
**VistA:** HelpText
**Fix:** Add ℹ️ icon next to field label. On hover/click: show help text.
**Verify:** Hover ℹ️ next to phone → tooltip appears with explanation

### ⚪ #953 [LOW] [StaffForm] Field "accessCode": Add tooltip/help icon with text: "Username for VistA sign-on. Must be unique. 3-20 characters."
**VistA:** HelpText
**Fix:** Add ℹ️ icon next to field label. On hover/click: show help text.
**Verify:** Hover ℹ️ next to accessCode → tooltip appears with explanation

### ⚪ #954 [LOW] [StaffForm] Field "verifyCode": Add tooltip/help icon with text: "Password for VistA sign-on. 8-20 characters. Changed on first login."
**VistA:** HelpText
**Fix:** Add ℹ️ icon next to field label. On hover/click: show help text.
**Verify:** Hover ℹ️ next to verifyCode → tooltip appears with explanation

### ⚪ #955 [LOW] [StaffForm] Field "primaryRole": Add tooltip/help icon with text: "Determines which security keys are assigned automatically."
**VistA:** HelpText
**Fix:** Add ℹ️ icon next to field label. On hover/click: show help text.
**Verify:** Hover ℹ️ next to primaryRole → tooltip appears with explanation

### ⚪ #956 [LOW] [StaffForm] Field "department": Add tooltip/help icon with text: "VistA File 200 field 29 (Service/Section). Select from existing departments."
**VistA:** HelpText
**Fix:** Add ℹ️ icon next to field label. On hover/click: show help text.
**Verify:** Hover ℹ️ next to department → tooltip appears with explanation

### ⚪ #957 [LOW] [StaffForm] Field "primaryLocation": Add tooltip/help icon with text: "VistA division assignment. Determines which facility data is accessible."
**VistA:** HelpText
**Fix:** Add ℹ️ icon next to field label. On hover/click: show help text.
**Verify:** Hover ℹ️ next to primaryLocation → tooltip appears with explanation

### ⚪ #958 [LOW] [StaffForm] Field "npi": Add tooltip/help icon with text: "National Provider Identifier. 10 digits with check digit. Required for billing."
**VistA:** HelpText
**Fix:** Add ℹ️ icon next to field label. On hover/click: show help text.
**Verify:** Hover ℹ️ next to npi → tooltip appears with explanation

### ⚪ #959 [LOW] [StaffForm] Field "dea": Add tooltip/help icon with text: "Drug Enforcement Administration number. Required for prescribing controlled substances."
**VistA:** HelpText
**Fix:** Add ℹ️ icon next to field label. On hover/click: show help text.
**Verify:** Hover ℹ️ next to dea → tooltip appears with explanation

### ⚪ #960 [LOW] [StaffForm] Field "providerType": Add tooltip/help icon with text: "VistA File 200 field 53.5. Pointer to Provider Class (File 7)."
**VistA:** HelpText
**Fix:** Add ℹ️ icon next to field label. On hover/click: show help text.
**Verify:** Hover ℹ️ next to providerType → tooltip appears with explanation

### ⚪ #961 [LOW] [StaffForm] Field "sigBlockName": Add tooltip/help icon with text: "Appears at the bottom of clinical notes. VistA File 200 field 20.3."
**VistA:** HelpText
**Fix:** Add ℹ️ icon next to field label. On hover/click: show help text.
**Verify:** Hover ℹ️ next to sigBlockName → tooltip appears with explanation

### ⚪ #962 [LOW] [StaffForm] Field "cosigner": Add tooltip/help icon with text: "Senior provider who co-signs notes. Must be a provider with ORES key."
**VistA:** HelpText
**Fix:** Add ℹ️ icon next to field label. On hover/click: show help text.
**Verify:** Hover ℹ️ next to cosigner → tooltip appears with explanation

### ⚪ #963 [LOW] [StaffForm] Field "language": Add tooltip/help icon with text: "Preferred language for system prompts. VistA File 200 field 200.07."
**VistA:** HelpText
**Fix:** Add ℹ️ icon next to field label. On hover/click: show help text.
**Verify:** Hover ℹ️ next to language → tooltip appears with explanation

### ⚪ #964 [LOW] [StaffForm] Field "degree": Add tooltip/help icon with text: "Professional credential suffix (MD, DO, PhD, RN). Field 10.6."
**VistA:** HelpText
**Fix:** Add ℹ️ icon next to field label. On hover/click: show help text.
**Verify:** Hover ℹ️ next to degree → tooltip appears with explanation

### ⚪ #965 [LOW] [StaffForm] Field "employeeId": Add tooltip/help icon with text: "Organization-assigned employee identifier. Stored in VistA Evolved extension."
**VistA:** HelpText
**Fix:** Add ℹ️ icon next to field label. On hover/click: show help text.
**Verify:** Hover ℹ️ next to employeeId → tooltip appears with explanation

### ⚪ #966 [LOW] [StaffForm] Field "filemanAccess": Add tooltip/help icon with text: "Controls FileMan database access level. Advanced — leave blank for most users."
**VistA:** HelpText
**Fix:** Add ℹ️ icon next to field label. On hover/click: show help text.
**Verify:** Hover ℹ️ next to filemanAccess → tooltip appears with explanation

### ⚪ #967 [LOW] [StaffForm] Field "restrictPatient": Add tooltip/help icon with text: "Limits which patients this user can access. VistA field 101.01."
**VistA:** HelpText
**Fix:** Add ℹ️ icon next to field label. On hover/click: show help text.
**Verify:** Hover ℹ️ next to restrictPatient → tooltip appears with explanation

### ⚪ #968 [LOW] [StaffForm] Field "verifyCodeNeverExpires": Add tooltip/help icon with text: "Overrides password expiration policy. Not recommended for production."
**VistA:** HelpText
**Fix:** Add ℹ️ icon next to field label. On hover/click: show help text.
**Verify:** Hover ℹ️ next to verifyCodeNeverExpires → tooltip appears with explanation

### ⚪ #969 [LOW] [StaffForm] Field "authorizedToWriteMeds": Add tooltip/help icon with text: "Must be set for prescribing providers. VistA field 53.11."
**VistA:** HelpText
**Fix:** Add ℹ️ icon next to field label. On hover/click: show help text.
**Verify:** Hover ℹ️ next to authorizedToWriteMeds → tooltip appears with explanation

### ⚪ #970 [LOW] [StaffForm] Field "controlledSchedules": Add tooltip/help icon with text: "DEA controlled substance schedule authorization. Field 55."
**VistA:** HelpText
**Fix:** Add ℹ️ icon next to field label. On hover/click: show help text.
**Verify:** Hover ℹ️ next to controlledSchedules → tooltip appears with explanation

### ⚪ #971 [LOW] [PatientDemo] Field "lastName": Add tooltip/help icon with text: "Patient last name. VistA File 2 field .01. Format: LAST,FIRST MI"
**VistA:** HelpText
**Fix:** Add ℹ️ icon next to field label. On hover/click: show help text.
**Verify:** Hover ℹ️ next to lastName → tooltip appears with explanation

### ⚪ #972 [LOW] [PatientDemo] Field "ssn": Add tooltip/help icon with text: "Social Security Number. VistA File 2 field .09. Required for VA patients."
**VistA:** HelpText
**Fix:** Add ℹ️ icon next to field label. On hover/click: show help text.
**Verify:** Hover ℹ️ next to ssn → tooltip appears with explanation

### ⚪ #973 [LOW] [PatientDemo] Field "veteranStatus": Add tooltip/help icon with text: "Determines VA benefits eligibility. Affects means test requirements."
**VistA:** HelpText
**Fix:** Add ℹ️ icon next to field label. On hover/click: show help text.
**Verify:** Hover ℹ️ next to veteranStatus → tooltip appears with explanation

### ⚪ #974 [LOW] [PatientDemo] Field "scPercent": Add tooltip/help icon with text: "Service-connected disability percentage. 0-100. Affects copay and priority."
**VistA:** HelpText
**Fix:** Add ℹ️ icon next to field label. On hover/click: show help text.
**Verify:** Hover ℹ️ next to scPercent → tooltip appears with explanation

### ⚪ #975 [LOW] [PatientDemo] Field "maritalStatus": Add tooltip/help icon with text: "Pointer to File 11. Affects benefits and dependent calculations."
**VistA:** HelpText
**Fix:** Add ℹ️ icon next to field label. On hover/click: show help text.
**Verify:** Hover ℹ️ next to maritalStatus → tooltip appears with explanation

---

# SECTION 24: DATA INTEGRITY & CROSS-REFERENCES

### 🟢 #976 [MEDIUM] [DataInteg] Key assignment: verify ^XUSEC cross-reference matches File 200 sub-file 51
**VistA:** 200/^XUSEC
**Fix:** After key assign, both ^XUSEC(KEY,DUZ) AND ^VA(200,DUZ,51) should have the key.
**Verify:** Assign key → M: check both locations match

### 🟢 #977 [MEDIUM] [DataInteg] User name change: verify B-tree cross-reference updated
**VistA:** 200/^VA
**Fix:** After rename, ^VA(200,"B",NEWNAME) should exist, old name removed.
**Verify:** Rename → M: B xref correct

### 🟢 #978 [MEDIUM] [DataInteg] User deactivation: keys remain but DISUSER blocks login
**VistA:** 200/^XUSEC
**Fix:** Keys should NOT be removed on deactivation (only on termination).
**Verify:** Deactivate → M: keys still present, DISUSER=1

### 🟢 #979 [MEDIUM] [DataInteg] User termination: keys AND credentials AND e-sig all cleared
**VistA:** 200
**Fix:** TERM routine must clear everything.
**Verify:** Terminate → M: 0 keys, no access code, no e-sig

### 🟢 #980 [MEDIUM] [DataInteg] Patient name change: verify ^DPT("B") cross-reference
**VistA:** 2/^DPT
**Fix:** After edit, B-tree must update.
**Verify:** Edit patient name → M: B xref correct

### 🟢 #981 [MEDIUM] [DataInteg] Patient admission: File 2 ward location (field .1) matches File 405 movement
**VistA:** 2/405
**Fix:** Admission should set both.
**Verify:** Admit → M: File 2 field .1 = ward, File 405 movement exists

### 🟢 #982 [MEDIUM] [DataInteg] Patient discharge: File 2 ward location cleared
**VistA:** 2/405
**Fix:** Discharge should clear field .1.
**Verify:** Discharge → M: File 2 field .1 empty

### 🟢 #983 [MEDIUM] [DataInteg] Insurance delete: verify sub-file entry actually removed
**VistA:** 2/2.312
**Fix:** DDR FILER delete on sub-file must work correctly.
**Verify:** Delete insurance → M: sub-file entry gone

### 🟢 #984 [MEDIUM] [DataInteg] Division assignment: verify sub-file 200.02 has entry
**VistA:** 200/200.02
**Fix:** Division add must create sub-file entry.
**Verify:** Assign division → M: 200.02 entry exists

### 🟢 #985 [MEDIUM] [DataInteg] Division removal: verify sub-file entry removed
**VistA:** 200/200.02
**Fix:** Division remove must delete sub-file entry.
**Verify:** Remove division → M: 200.02 entry gone

### 🟢 #986 [MEDIUM] [DataInteg] Mail group member add: verify File 3.8 sub-file entry
**VistA:** 3.8
**Fix:** Member must appear in group sub-file.
**Verify:** Add member → M: member in group

### 🟢 #987 [MEDIUM] [DataInteg] Mail group member remove: verify sub-file entry removed
**VistA:** 3.8
**Fix:** Member must be removed from sub-file.
**Verify:** Remove → M: member not in group

### 🟢 #988 [MEDIUM] [DataInteg] Clinic create: verify File 44 entry has all required fields
**VistA:** 44
**Fix:** Clinic must have at least .01 (name) and stop code.
**Verify:** Create → M: D ^DIQ(44,IEN) → required fields present

### 🟢 #989 [MEDIUM] [DataInteg] Ward create: verify File 42 entry
**VistA:** 42
**Fix:** Ward must have .01 (name).
**Verify:** Create → M: D ^DIQ(42,IEN) → name present

### 🟢 #990 [MEDIUM] [DataInteg] Device create: verify File 3.5 entry
**VistA:** 3.5
**Fix:** Device must have .01 (name) and device type.
**Verify:** Create → M: D ^DIQ(3.5,IEN) → fields present

---

# SECTION 25: PRINT & EXPORT

### ⚪ #991 [LOW] [StaffDirectory] StaffDirectory: Print view — @media print hides nav/shell, shows content
**VistA:** Print
**Fix:** Add @media print CSS to hide AppShell for this page.
**Verify:** Ctrl+P on StaffDirectory → clean printout without nav

### ⚪ #992 [LOW] [StaffDirectory] StaffDirectory: CSV/PDF export of displayed data
**VistA:** Export
**Fix:** Add export button. CSV for data, PDF for formatted report.
**Verify:** Export → file downloads with correct data

### ⚪ #993 [LOW] [RoleTemplates] RoleTemplates: Print view — @media print hides nav/shell, shows content
**VistA:** Print
**Fix:** Add @media print CSS to hide AppShell for this page.
**Verify:** Ctrl+P on RoleTemplates → clean printout without nav

### ⚪ #994 [LOW] [RoleTemplates] RoleTemplates: CSV/PDF export of displayed data
**VistA:** Export
**Fix:** Add export button. CSV for data, PDF for formatted report.
**Verify:** Export → file downloads with correct data

### ⚪ #995 [LOW] [PermsCatalog] PermsCatalog: Print view — @media print hides nav/shell, shows content
**VistA:** Print
**Fix:** Add @media print CSS to hide AppShell for this page.
**Verify:** Ctrl+P on PermsCatalog → clean printout without nav

### ⚪ #996 [LOW] [PermsCatalog] PermsCatalog: CSV/PDF export of displayed data
**VistA:** Export
**Fix:** Add export button. CSV for data, PDF for formatted report.
**Verify:** Export → file downloads with correct data

### ⚪ #997 [LOW] [SecurityAuth] SecurityAuth: Print view — @media print hides nav/shell, shows content
**VistA:** Print
**Fix:** Add @media print CSS to hide AppShell for this page.
**Verify:** Ctrl+P on SecurityAuth → clean printout without nav

### ⚪ #998 [LOW] [SecurityAuth] SecurityAuth: CSV/PDF export of displayed data
**VistA:** Export
**Fix:** Add export button. CSV for data, PDF for formatted report.
**Verify:** Export → file downloads with correct data

### ⚪ #999 [LOW] [ClinicMgmt] ClinicMgmt: Print view — @media print hides nav/shell, shows content
**VistA:** Print
**Fix:** Add @media print CSS to hide AppShell for this page.
**Verify:** Ctrl+P on ClinicMgmt → clean printout without nav

### ⚪ #1000 [LOW] [ClinicMgmt] ClinicMgmt: CSV/PDF export of displayed data
**VistA:** Export
**Fix:** Add export button. CSV for data, PDF for formatted report.
**Verify:** Export → file downloads with correct data

### ⚪ #1001 [LOW] [WardMgmt] WardMgmt: Print view — @media print hides nav/shell, shows content
**VistA:** Print
**Fix:** Add @media print CSS to hide AppShell for this page.
**Verify:** Ctrl+P on WardMgmt → clean printout without nav

### ⚪ #1002 [LOW] [WardMgmt] WardMgmt: CSV/PDF export of displayed data
**VistA:** Export
**Fix:** Add export button. CSV for data, PDF for formatted report.
**Verify:** Export → file downloads with correct data

### ⚪ #1003 [LOW] [DeviceMgmt] DeviceMgmt: Print view — @media print hides nav/shell, shows content
**VistA:** Print
**Fix:** Add @media print CSS to hide AppShell for this page.
**Verify:** Ctrl+P on DeviceMgmt → clean printout without nav

### ⚪ #1004 [LOW] [DeviceMgmt] DeviceMgmt: CSV/PDF export of displayed data
**VistA:** Export
**Fix:** Add export button. CSV for data, PDF for formatted report.
**Verify:** Export → file downloads with correct data

### ⚪ #1005 [LOW] [MailGrpMgmt] MailGrpMgmt: Print view — @media print hides nav/shell, shows content
**VistA:** Print
**Fix:** Add @media print CSS to hide AppShell for this page.
**Verify:** Ctrl+P on MailGrpMgmt → clean printout without nav

### ⚪ #1006 [LOW] [MailGrpMgmt] MailGrpMgmt: CSV/PDF export of displayed data
**VistA:** Export
**Fix:** Add export button. CSV for data, PDF for formatted report.
**Verify:** Export → file downloads with correct data

### ⚪ #1007 [LOW] [DeptService] DeptService: Print view — @media print hides nav/shell, shows content
**VistA:** Print
**Fix:** Add @media print CSS to hide AppShell for this page.
**Verify:** Ctrl+P on DeptService → clean printout without nav

### ⚪ #1008 [LOW] [DeptService] DeptService: CSV/PDF export of displayed data
**VistA:** Export
**Fix:** Add export button. CSV for data, PDF for formatted report.
**Verify:** Export → file downloads with correct data

### ⚪ #1009 [LOW] [AuditLog] AuditLog: Print view — @media print hides nav/shell, shows content
**VistA:** Print
**Fix:** Add @media print CSS to hide AppShell for this page.
**Verify:** Ctrl+P on AuditLog → clean printout without nav

### ⚪ #1010 [LOW] [AuditLog] AuditLog: CSV/PDF export of displayed data
**VistA:** Export
**Fix:** Add export button. CSV for data, PDF for formatted report.
**Verify:** Export → file downloads with correct data

### ⚪ #1011 [LOW] [AdminReports] AdminReports: Print view — @media print hides nav/shell, shows content
**VistA:** Print
**Fix:** Add @media print CSS to hide AppShell for this page.
**Verify:** Ctrl+P on AdminReports → clean printout without nav

### ⚪ #1012 [LOW] [AdminReports] AdminReports: CSV/PDF export of displayed data
**VistA:** Export
**Fix:** Add export button. CSV for data, PDF for formatted report.
**Verify:** Export → file downloads with correct data

### ⚪ #1013 [LOW] [PatientSearch] PatientSearch: Print view — @media print hides nav/shell, shows content
**VistA:** Print
**Fix:** Add @media print CSS to hide AppShell for this page.
**Verify:** Ctrl+P on PatientSearch → clean printout without nav

### ⚪ #1014 [LOW] [PatientSearch] PatientSearch: CSV/PDF export of displayed data
**VistA:** Export
**Fix:** Add export button. CSV for data, PDF for formatted report.
**Verify:** Export → file downloads with correct data

### ⚪ #1015 [LOW] [PatientDemo] PatientDemo: Print view — @media print hides nav/shell, shows content
**VistA:** Print
**Fix:** Add @media print CSS to hide AppShell for this page.
**Verify:** Ctrl+P on PatientDemo → clean printout without nav

### ⚪ #1016 [LOW] [PatientDemo] PatientDemo: CSV/PDF export of displayed data
**VistA:** Export
**Fix:** Add export button. CSV for data, PDF for formatted report.
**Verify:** Export → file downloads with correct data

### ⚪ #1017 [LOW] [Insurance] Insurance: Print view — @media print hides nav/shell, shows content
**VistA:** Print
**Fix:** Add @media print CSS to hide AppShell for this page.
**Verify:** Ctrl+P on Insurance → clean printout without nav

### ⚪ #1018 [LOW] [Insurance] Insurance: CSV/PDF export of displayed data
**VistA:** Export
**Fix:** Add export button. CSV for data, PDF for formatted report.
**Verify:** Export → file downloads with correct data

### ⚪ #1019 [LOW] [Financial] Financial: Print view — @media print hides nav/shell, shows content
**VistA:** Print
**Fix:** Add @media print CSS to hide AppShell for this page.
**Verify:** Ctrl+P on Financial → clean printout without nav

### ⚪ #1020 [LOW] [Financial] Financial: CSV/PDF export of displayed data
**VistA:** Export
**Fix:** Add export button. CSV for data, PDF for formatted report.
**Verify:** Export → file downloads with correct data

### ⚪ #1021 [LOW] [Admission] Admission: Print view — @media print hides nav/shell, shows content
**VistA:** Print
**Fix:** Add @media print CSS to hide AppShell for this page.
**Verify:** Ctrl+P on Admission → clean printout without nav

### ⚪ #1022 [LOW] [Admission] Admission: CSV/PDF export of displayed data
**VistA:** Export
**Fix:** Add export button. CSV for data, PDF for formatted report.
**Verify:** Export → file downloads with correct data

---

# SECTION 26: NAVIGATION & STATE

### 🟢 #1023 [MEDIUM] [Navigation] Deep link to user detail: /admin/staff/:duz should open detail panel
**VistA:** UI
**Fix:** Currently may not support direct URL to a user.
**Verify:** Navigate to /admin/staff/56 → detail panel opens for DUZ 56

### 🟢 #1024 [MEDIUM] [Navigation] Deep link to role: /admin/roles/:id should open role detail
**VistA:** UI
**Fix:** Currently may not support.
**Verify:** Navigate to /admin/roles/physician → role detail opens

### 🟢 #1025 [MEDIUM] [Navigation] Deep link to patient: /patients/:dfn should open demographics
**VistA:** UI
**Fix:** Currently may not support.
**Verify:** Navigate to /patients/123 → demographics loads

### 🟢 #1026 [MEDIUM] [Navigation] Back button behavior: should return to previous page, not reset state
**VistA:** UI
**Fix:** Browser back may reset filters/selection.
**Verify:** Set filters → navigate away → back → filters preserved

### ⚪ #1027 [LOW] [Navigation] Breadcrumb navigation: all pages show Admin > Section > Page
**VistA:** UI
**Fix:** Breadcrumbs may be missing on some pages.
**Verify:** Every page shows correct breadcrumb trail

### ⚪ #1028 [LOW] [Navigation] Active nav item highlighted correctly on all sub-routes
**VistA:** UI
**Fix:** Sub-route /admin/staff/new may not highlight Staff Directory.
**Verify:** Navigate to /admin/staff/new → Staff Directory highlighted

### ⚪ #1029 [LOW] [Navigation] 404 page for invalid admin routes
**VistA:** UI
**Fix:** /admin/nonexistent should show helpful error.
**Verify:** Navigate to /admin/xyz → "Page not found" with nav options

### 🟢 #1030 [MEDIUM] [Navigation] Session expiry: redirect to login preserves return URL
**VistA:** UI
**Fix:** After timeout, user should return to where they were.
**Verify:** Timeout on /admin/staff → login → returns to /admin/staff

### ⚪ #1031 [LOW] [Navigation] Page transition animations (optional but professional)
**VistA:** UI
**Fix:** No transition between pages — abrupt change.
**Verify:** Navigate → subtle fade/slide transition

### 🟢 #1032 [MEDIUM] [Navigation] Browser history: each significant action is a history entry
**VistA:** UI
**Fix:** Only page navigations create history. Modal opens don't.
**Verify:** Open modal → back button closes modal, not page

---

# SECTION 27: VISTA INPUT VALIDATION

### 🟢 #1033 [MEDIUM] [InputValid] Name (.01): VistA input transform requires uppercase LAST,FIRST format, 3-35 chars, A-Z/comma/space only
**VistA:** 200/.01
**Fix:** Frontend must enforce same rules as VistA LAYGO^XUA4A7.
**Verify:** Enter lowercase → auto-uppercase or error

### 🟢 #1034 [MEDIUM] [InputValid] Sex (4): SET OF CODES — only M or F accepted
**VistA:** 200/4
**Fix:** Frontend dropdown must only offer M and F (VistA standard).
**Verify:** Select → only M/F available

### 🟢 #1035 [MEDIUM] [InputValid] DOB (5): FileMan date — internal format YYYMMDD, must be valid date
**VistA:** 200/5
**Fix:** Server must convert ISO to FM format. Invalid dates rejected.
**Verify:** Enter 2025-13-45 → error

### 🟢 #1036 [MEDIUM] [InputValid] Title (8): Pointer to File 3.1 — must match existing entry
**VistA:** 200/8
**Fix:** Free text will fail. Must select from File 3.1 entries.
**Verify:** Enter "KING" → error if not in File 3.1

### 🟢 #1037 [MEDIUM] [InputValid] SSN (9): 9 digits, Luhn-like validation in VistA
**VistA:** 200/9
**Fix:** VistA SSN input transform validates format. Last-4 won't pass.
**Verify:** Enter "1234" → VistA rejects

### 🟢 #1038 [MEDIUM] [InputValid] Service/Section (29): Pointer to File 49
**VistA:** 200/29
**Fix:** Must match File 49 entry. Free text fails.
**Verify:** Enter "FAKE DEPT" → error if not in File 49

### 🟢 #1039 [MEDIUM] [InputValid] NPI (41.99): 10 digits with Luhn check digit
**VistA:** 200/41.99
**Fix:** Frontend checks 10 digits but not Luhn. VistA may validate further.
**Verify:** Enter invalid Luhn NPI → VistA rejects

### 🟢 #1040 [MEDIUM] [InputValid] DEA (53.2): 2 letters + 7 digits with check digit
**VistA:** 200/53.2
**Fix:** Frontend checks format. VistA may validate DEA check digit.
**Verify:** Enter invalid DEA checksum → VistA rejects

### 🟢 #1041 [MEDIUM] [InputValid] Provider Class (53.5): Pointer to File 7
**VistA:** 200/53.5
**Fix:** Must be valid File 7 entry.
**Verify:** Enter invalid class → error

### 🟢 #1042 [MEDIUM] [InputValid] Primary Menu (201): Pointer to File 19
**VistA:** 200/201
**Fix:** Must be valid Option in File 19.
**Verify:** Enter "FAKEMENU" → error

### 🟢 #1043 [MEDIUM] [InputValid] Patient Name (.01): Same transform as File 200
**VistA:** 2/.01
**Fix:** LAST,FIRST format, uppercase, 3-30 chars.
**Verify:** Enter lowercase → error or auto-uppercase

### 🟢 #1044 [MEDIUM] [InputValid] Patient SSN (.09): 9 digits required for VA patients
**VistA:** 2/.09
**Fix:** Non-VA may use pseudo-SSN with reason.
**Verify:** Enter 9 digits → accepted. Enter 4 → error.

### 🟢 #1045 [MEDIUM] [InputValid] Marital Status (.05): Pointer to File 11
**VistA:** 2/.05
**Fix:** Must be valid entry. Not free text.
**Verify:** Select from list → valid pointer stored

### 🟢 #1046 [MEDIUM] [InputValid] Race (.06): Pointer to File 10
**VistA:** 2/.06
**Fix:** Must be valid entry.
**Verify:** Select → valid pointer

### 🟢 #1047 [MEDIUM] [InputValid] Religion (.08): Pointer to File 13
**VistA:** 2/.08
**Fix:** Must be valid entry.
**Verify:** Select → valid pointer

### 🟢 #1048 [MEDIUM] [InputValid] SC Percentage (.302): Numeric 0-100 in increments of 10
**VistA:** 2/.302
**Fix:** Not any number — must be 0,10,20,...100.
**Verify:** Enter 55 → error. Enter 50 → accepted.

### 🟢 #1049 [MEDIUM] [InputValid] Clinic Name (44/.01): No special characters in VistA
**VistA:** 44/.01
**Fix:** VistA may restrict clinic name characters.
**Verify:** Enter "CLINIC #1" → may fail. Enter "CLINIC 1" → accepted.

### 🟢 #1050 [MEDIUM] [InputValid] Ward Name (42/.01): Similar restrictions
**VistA:** 42/.01
**Fix:** VistA ward name rules.
**Verify:** Enter valid name → accepted

---

# SECTION 28: ENHANCEMENTS

### ⚪ #251 [LOW] [AdminReports] Custom report builder
**VistA:** Enhance
**Fix:** Admin selects fields, filters, sort for ad-hoc reports.
**Verify:** Build custom → run → export

### ⚪ #252 [LOW] [AdminReports] Scheduled report delivery
**VistA:** Enhance
**Fix:** Email reports on schedule.
**Verify:** Schedule weekly → email to admin

### ⚪ #253 [LOW] [AuditLog] Anomaly detection / suspicious activity alerts
**VistA:** Enhance
**Fix:** Flag: mass key changes, off-hours, brute force.
**Verify:** Unusual pattern → notification to admin

### ⚪ #754 [LOW] [Enhance] Drag-and-drop role key editor
**VistA:** Admin
**Fix:** Design and implement: Drag-and-drop role key editor. Must integrate with VistA backend.
**Verify:** Feature works end-to-end with VistA

### ⚪ #755 [LOW] [Enhance] Recent users widget on dashboard
**VistA:** Admin
**Fix:** Design and implement: Recent users widget on dashboard. Must integrate with VistA backend.
**Verify:** Feature works end-to-end with VistA

### ⚪ #756 [LOW] [Enhance] Auto-expire inactive accounts after N days
**VistA:** Admin
**Fix:** Design and implement: Auto-expire inactive accounts after N days. Must integrate with VistA backend.
**Verify:** Feature works end-to-end with VistA

### ⚪ #757 [LOW] [Enhance] Permission inheritance from department
**VistA:** Admin
**Fix:** Design and implement: Permission inheritance from department. Must integrate with VistA backend.
**Verify:** Feature works end-to-end with VistA

### ⚪ #758 [LOW] [Enhance] Org chart visualization
**VistA:** Admin
**Fix:** Design and implement: Org chart visualization. Must integrate with VistA backend.
**Verify:** Feature works end-to-end with VistA

### ⚪ #759 [LOW] [Enhance] Real-time user count badge in nav
**VistA:** Admin
**Fix:** Design and implement: Real-time user count badge in nav. Must integrate with VistA backend.
**Verify:** Feature works end-to-end with VistA

### ⚪ #760 [LOW] [Enhance] Session monitoring dashboard
**VistA:** Admin
**Fix:** Design and implement: Session monitoring dashboard. Must integrate with VistA backend.
**Verify:** Feature works end-to-end with VistA

### ⚪ #761 [LOW] [Enhance] Bulk deactivation with shared reason
**VistA:** Admin
**Fix:** Design and implement: Bulk deactivation with shared reason. Must integrate with VistA backend.
**Verify:** Feature works end-to-end with VistA

### ⚪ #762 [LOW] [Enhance] Re-credential workflow (renew DEA, NPI, etc)
**VistA:** Admin
**Fix:** Design and implement: Re-credential workflow (renew DEA, NPI, etc). Must integrate with VistA backend.
**Verify:** Feature works end-to-end with VistA

### ⚪ #763 [LOW] [Enhance] Mass division reassignment
**VistA:** Admin
**Fix:** Design and implement: Mass division reassignment. Must integrate with VistA backend.
**Verify:** Feature works end-to-end with VistA

### ⚪ #764 [LOW] [Enhance] User account template (save preset for quick create)
**VistA:** Admin
**Fix:** Design and implement: User account template (save preset for quick create). Must integrate with VistA backend.
**Verify:** Feature works end-to-end with VistA

### ⚪ #765 [LOW] [Enhance] Role-based dashboard customization
**VistA:** Admin
**Fix:** Design and implement: Role-based dashboard customization. Must integrate with VistA backend.
**Verify:** Feature works end-to-end with VistA

### ⚪ #766 [LOW] [Enhance] Notification center with history
**VistA:** Admin
**Fix:** Design and implement: Notification center with history. Must integrate with VistA backend.
**Verify:** Feature works end-to-end with VistA

### ⚪ #767 [LOW] [Enhance] Admin activity summary (my actions today)
**VistA:** Admin
**Fix:** Design and implement: Admin activity summary (my actions today). Must integrate with VistA backend.
**Verify:** Feature works end-to-end with VistA

### ⚪ #768 [LOW] [Enhance] System status banner for maintenance windows
**VistA:** Admin
**Fix:** Design and implement: System status banner for maintenance windows. Must integrate with VistA backend.
**Verify:** Feature works end-to-end with VistA

### ⚪ #769 [LOW] [Enhance] Customizable table column order per user
**VistA:** Admin
**Fix:** Design and implement: Customizable table column order per user. Must integrate with VistA backend.
**Verify:** Feature works end-to-end with VistA

### ⚪ #770 [LOW] [Enhance] Export all admin data as backup
**VistA:** Admin
**Fix:** Design and implement: Export all admin data as backup. Must integrate with VistA backend.
**Verify:** Feature works end-to-end with VistA

### ⚪ #771 [LOW] [Enhance] Import admin configuration from another VistA instance
**VistA:** Admin
**Fix:** Design and implement: Import admin configuration from another VistA instance. Must integrate with VistA backend.
**Verify:** Feature works end-to-end with VistA

### ⚪ #772 [LOW] [Enhance] Multi-language support for admin UI (i18n)
**VistA:** Admin
**Fix:** Design and implement: Multi-language support for admin UI (i18n). Must integrate with VistA backend.
**Verify:** Feature works end-to-end with VistA

### ⚪ #773 [LOW] [Enhance] Theme customization per organization
**VistA:** Admin
**Fix:** Design and implement: Theme customization per organization. Must integrate with VistA backend.
**Verify:** Feature works end-to-end with VistA

### ⚪ #774 [LOW] [Enhance] Patient portal account linking
**VistA:** Patient
**Fix:** Design and implement: Patient portal account linking. Must integrate with VistA backend.
**Verify:** Feature works end-to-end with VistA

### ⚪ #775 [LOW] [Enhance] Patient photograph capture
**VistA:** Patient
**Fix:** Design and implement: Patient photograph capture. Must integrate with VistA backend.
**Verify:** Feature works end-to-end with VistA

### ⚪ #776 [LOW] [Enhance] Barcode/QR patient wristband generation
**VistA:** Patient
**Fix:** Design and implement: Barcode/QR patient wristband generation. Must integrate with VistA backend.
**Verify:** Feature works end-to-end with VistA

### ⚪ #777 [LOW] [Enhance] Patient kiosk self-check-in
**VistA:** Patient
**Fix:** Design and implement: Patient kiosk self-check-in. Must integrate with VistA backend.
**Verify:** Feature works end-to-end with VistA

### ⚪ #778 [LOW] [Enhance] Insurance card OCR scanning
**VistA:** Patient
**Fix:** Design and implement: Insurance card OCR scanning. Must integrate with VistA backend.
**Verify:** Feature works end-to-end with VistA

### ⚪ #779 [LOW] [Enhance] Digital consent form signatures
**VistA:** Patient
**Fix:** Design and implement: Digital consent form signatures. Must integrate with VistA backend.
**Verify:** Feature works end-to-end with VistA

### ⚪ #780 [LOW] [Enhance] Patient communication preferences (text/email/phone)
**VistA:** Patient
**Fix:** Design and implement: Patient communication preferences (text/email/phone). Must integrate with VistA backend.
**Verify:** Feature works end-to-end with VistA

### ⚪ #781 [LOW] [Enhance] Appointment reminders integration
**VistA:** Patient
**Fix:** Design and implement: Appointment reminders integration. Must integrate with VistA backend.
**Verify:** Feature works end-to-end with VistA

### ⚪ #782 [LOW] [Enhance] Telehealth visit tracking
**VistA:** Patient
**Fix:** Design and implement: Telehealth visit tracking. Must integrate with VistA backend.
**Verify:** Feature works end-to-end with VistA

### ⚪ #783 [LOW] [Enhance] Patient satisfaction survey integration
**VistA:** Patient
**Fix:** Design and implement: Patient satisfaction survey integration. Must integrate with VistA backend.
**Verify:** Feature works end-to-end with VistA

### ⚪ #784 [LOW] [Enhance] Referral tracking for registration
**VistA:** Patient
**Fix:** Design and implement: Referral tracking for registration. Must integrate with VistA backend.
**Verify:** Feature works end-to-end with VistA

### ⚪ #785 [LOW] [Enhance] Wait time display for walk-in registration
**VistA:** Patient
**Fix:** Design and implement: Wait time display for walk-in registration. Must integrate with VistA backend.
**Verify:** Feature works end-to-end with VistA

### ⚪ #786 [LOW] [Enhance] Patient education materials by diagnosis
**VistA:** Patient
**Fix:** Design and implement: Patient education materials by diagnosis. Must integrate with VistA backend.
**Verify:** Feature works end-to-end with VistA

### ⚪ #787 [LOW] [Enhance] Community resource referral database
**VistA:** Patient
**Fix:** Design and implement: Community resource referral database. Must integrate with VistA backend.
**Verify:** Feature works end-to-end with VistA

### ⚪ #788 [LOW] [Enhance] Social determinants of health screening
**VistA:** Patient
**Fix:** Design and implement: Social determinants of health screening. Must integrate with VistA backend.
**Verify:** Feature works end-to-end with VistA

---

# EXECUTION ORDER

1. **Section 1 (Critical):** Fix GMRA dash→space. Run 43-key verification. Fix SSN mapping. Fix cosigner search.
2. **Section 2 (Create):** Verify every wizard field writes to VistA.
3. **Section 3 (Directory):** Fix search debounce, sorting, inline edits, detail panel issues.
4. **Section 4 (Roles):** Verify all 25 role key sets against M prompt results.
5. **Section 5 (Security):** Address XSS, CSRF, rate limiting.
6. **Section 6 (Other Pages):** Click every button on every remaining admin page. Verify at M prompt.
7. **Section 7 (Patient):** Verify registration, admission, discharge, transfer all write correctly.
8. **Sections 8-9 (Terminal):** Close terminal parity gaps.
9. **Sections 10-11 (Deep UX):** Per-page polish.
10. **Sections 12-13 (M/Server):** Fix M routine and server issues.
11. **Sections 14-15 (Field Audits):** Evaluate missing fields for inclusion.
12. **Section 16 (Workflows):** Run each end-to-end workflow.
13. **Sections 17-28:** Performance, compliance, handlers, responsive, errors, tooltips, data integrity, print/export, navigation, input validation, enhancements.

# SELF-AUDIT CHECKLIST

Before submitting, the AI coder must confirm ALL of these:

- [ ] GMRA ALLERGY VERIFY uses SPACE not DASH — all 5 occurrences fixed
- [ ] All 43 keys verified at M prompt — results documented in code comments
- [ ] SSN handling resolved — no invalid data written to field 9
- [ ] Cosigner search returns actual provider suggestions (not empty)
- [ ] Create physician → M prompt: check name, email, phone, NPI, DEA, division, all 6 keys
- [ ] Edit phone inline → M prompt: field .132 shows new value
- [ ] Deactivate with reason → M prompt: DISUSER=1, SSN unchanged, field 9.4 = reason
- [ ] Reactivate → M prompt: DISUSER cleared, SSN still intact
- [ ] Clone user → M prompt: new user has all source user's keys
- [ ] Terminate → M prompt: 0 keys, access code empty, DISUSER=1
- [ ] Lock user (3 failed logins) → list shows LOCKED → Unlock → ACTIVE
- [ ] First login → forced password change form appears
- [ ] SSN masked in browser DevTools network response (***-**-1234)
- [ ] MailMan send → message exists in VistA MailMan
- [ ] Patient register → M prompt: File 2 record with all demographics
- [ ] Patient admit → M prompt: File 405 movement type 1
- [ ] Patient discharge → M prompt: discharge movement exists
- [ ] grep -r 'window.confirm' → 0 results
- [ ] grep -r 'catch {' (empty catches) → 0 results
- [ ] Every button on every page clicked and verified

---

*End of audit. 1,050 items. Every one must work with real VistA. No exceptions.*