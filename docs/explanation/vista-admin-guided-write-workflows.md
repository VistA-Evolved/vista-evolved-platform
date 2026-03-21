# VistA Admin — Guided Write Workflow Catalog

> **Superseded for tenant-admin (2026-03-21):** The platform **no longer** implements Mode B guided terminal workflows in the SPA. Configuration writes use **DDR VALIDATOR / DDR FILER** and distro overlay RPCs (`ZVEUSMG`, `ZVECLNM`, `ZVEWRDM`). This document remains a **historical** menu-path and safety-pattern reference; do not treat GW-* steps as the live UI contract.
>
> **Status:** Canonical reference — Task 5 of queue pack (historical).
> **Date:** 2026-03-21.
> **Type:** Explanation / Reference.
> **Scope:** All terminal-guided write workflows for VistA administration, grounded in
> VistA menu paths, MUMPS routines, and existing implementation evidence.
>
> **See also:**
> - [Translation Matrix](vista-admin-terminal-to-ui-translation-matrix.md) — full function inventory
> - [Grounded Domain: Users/Keys/Signatures](vista-admin-grounded-domain-users-keys-signatures.md) — deep dive on user domain
> - [Grounded Domain: Institution/Division/Clinic](vista-admin-grounded-domain-institution-division-clinic.md) — deep dive on facility domain
> - [Slice Ranking](vista-admin-slice-ranking-and-mode-selection.md) — prioritized slice plan

---

## 1. Translation Modes (Quick Reference)

| Mode | Label | Browser Role | Terminal Role |
|------|-------|-------------|---------------|
| **A** | Live read + live write | Full: reads and writes via RPC | None needed |
| **B** | Live read + guided write | Reads via RPC; composes write intent | Admin executes guided steps; browser re-reads to verify |
| **C** | Guided terminal workflow | Guidance only; optional evidence capture | Both reads and writes are terminal-only |
| **D** | Wrapper/adapter project | N/A — requires new MUMPS routine first | N/A |
| **E** | Informational/deferred | Documentation only | Full terminal workflow; out of scope |

---

## 2. Guided Write Workflow Pattern (Mode B)

The canonical six-step pattern for all Mode B operations:

```
1. DISPLAY    — Browser reads current VistA state via confirmed RPC
2. COMPOSE    — Admin fills in desired change via browser form
3. ATTEMPT    — If direct write RPC exists and is confirmed: execute via API with audit
4. FALLBACK   — If no safe RPC: browser generates terminal command guidance
5. EVIDENCE   — Admin confirms completion (screenshot, terminal output, or paste)
6. VERIFY     — Browser re-reads VistA state to confirm the change took effect
```

**Source:** `vista-evolved-platform/docs/explanation/vista-admin-grounded-domain-users-keys-signatures.md` §6 "Guided write workflow pattern".

---

## 3. Complete Guided Write Workflow Catalog

### 3.1 User Management (ZVEUSER.m domain)

#### GW-USR-01: Create New User

| Attribute | Value |
|-----------|-------|
| **TM ID** | TM-USR-01 |
| **Mode** | B (live read + guided write) |
| **Risk Level** | HIGH |
| **VistA Target** | File 200 (NEW PERSON) via `UPDATE^DIE` or `^VA(200)` |
| **Menu Path** | EVE → User Management → Add a New User |
| **Option Name** | `XUSERNEW` (probable) |
| **Files Affected** | 200 (NEW PERSON), 200.01 (signature block subfile), 200.051 (keys subfile), 8930.3 (USR CLASS) |
| **Globals Written** | `^VA(200,`, `^XUSEC(` |
| **Direct Write RPC** | `XUS IAM ADD USER` (Vivian — NEEDS VEHU PROBE); `VE USER EDIT` (archive custom — requires ZVEUSER.m) |
| **Custom Routine** | `ZVECREUSER.m` in distro overlay — full user creation via `UPDATE^DIE` with `$$EN^XUSHSH` for credential hashing |
| **Terminal Entry** | `docker exec -it vehu su - vehu -c "mumps -r ^XUP"` |

**Terminal Steps:**
1. Open VistA terminal (SSH or Docker exec)
2. Navigate: EVE → User Management → Add a New User
3. Enter user demographics (name, SSN, DOB)
4. Assign ACCESS CODE and VERIFY CODE
5. Set PERSON CLASS and SERVICE/SECTION
6. Assign DIVISION(s) via File 200 node "DIV"
7. Allocate required security keys (PROVIDER, ORES, etc.)
8. Verify creation: `D ^XUP` or check `^VA(200,"B",name)` index

**Verification (re-read):**
- RPC: `VE USER DETAIL` or `ORWU NEWPERS` (search for new user name)
- Global check: `$D(^VA(200,"B","LASTNAME,FIRST"))` should return 1

**Why Terminal:** User creation requires multi-file coordination (200, 200.01, 8930.3) with MUMPS triggers. Credential hashing (`$$EN^XUSHSH`) must execute inside MUMPS environment. No safe single-RPC path for full user provisioning.

**Implementation Provenance:**
- MUMPS routine: `VistA-Evolved/services/vista/ZVEUSER.m` (lines 1–7: header)
- User creation pattern: `vista-evolved-vista-distro/overlay/routines/ZVECREUSER.m` (lines 20–50: FDA array + UPDATE^DIE)
- REST endpoint: `VistA-Evolved/apps/api/src/routes/vista-admin.ts` (lines 84–99: POST `/vista/admin/user/:ien/edit`)
- SPA guided task: `vista-evolved-platform/apps/tenant-admin/public/app.js` (lines 528–541: add-user workflow object)

---

#### GW-USR-02: Edit User Properties

| Attribute | Value |
|-----------|-------|
| **TM ID** | TM-USR-02 |
| **Mode** | B (live read + guided write) |
| **Risk Level** | MEDIUM |
| **VistA Target** | File 200 via `^DIE` or VA Kernel menus |
| **Menu Path** | EVE → User Management → Edit an Existing User |
| **Option Name** | `XUSEREDITEXIST` (probable) |
| **Files Affected** | 200 (NEW PERSON) |
| **Globals Written** | `^VA(200,` |
| **Direct Write RPC** | `VE USER EDIT` (archive custom: `EDITUSER^ZVEUSER`); `XUS IAM EDIT USER` (Vivian — needs probe) |
| **Editable Fields** | NAME (.01), TITLE (8), SERVICE (29), DISUSER (7), PRIMARY_MENU (201) |

**Terminal Steps:**
1. Open VistA terminal
2. Navigate: EVE → User Management → Edit an Existing User
3. Select user by name or DUZ
4. Modify target field(s)
5. Verify changes: read back from File 200

**Direct RPC Path (when confirmed):**
```
RPC: VE USER EDIT
Params: [userIEN, fieldName, newValue]
Entry: EDITUSER^ZVEUSER
Action: FILE^DIE("E","FDA","ERR") with field-to-number mapping
```

**Verification (re-read):** `VE USER DETAIL` → confirm changed field

**Implementation Provenance:**
- MUMPS: `VistA-Evolved/services/vista/ZVEUSER.m` (lines 117–136: EDITUSER entry point)
- REST: `VistA-Evolved/apps/api/src/routes/vista-admin.ts` (lines 84–99: POST edit)
- SPA: `vista-evolved-platform/apps/tenant-admin/public/app.js` (lines 552–562: edit-user workflow)

---

#### GW-USR-03: Deactivate User

| Attribute | Value |
|-----------|-------|
| **TM ID** | TM-USR-04 |
| **Mode** | B (live read + guided write) |
| **Risk Level** | HIGH |
| **VistA Target** | File 200 fields: DISUSER (7), TERMINATION DATE (9.2) |
| **Menu Path** | EVE → User Management → (deactivation option within user edit) |
| **Direct Write RPC** | `VE USER DEACTIVATE` (archive: `DEACTUSER^ZVEUSER`); `XUS IAM TERMINATE USER` (Vivian — MISSING from VEHU per rpc_missing_vs_vivian.json) |

**Direct RPC Path:**
```
RPC: VE USER DEACTIVATE
Params: [userIEN]
Entry: DEACTUSER^ZVEUSER
Action: Sets DISUSER=1, TERMINATION DATE=now via FILE^DIE("K")
Pre-check: $$ACTIVE(IEN) must return "ACTIVE"
```

**Verification (re-read):** `VE USER DETAIL` → DISUSER=1, TERMINATED=INACTIVE

**Implementation Provenance:**
- MUMPS: `VistA-Evolved/services/vista/ZVEUSER.m` (lines 175–188: DEACTUSER)
- REST: `VistA-Evolved/apps/api/src/routes/vista-admin.ts` (lines 137–148: POST deactivate)

---

#### GW-USR-04: Reactivate User

| Attribute | Value |
|-----------|-------|
| **TM ID** | TM-USR-05 |
| **Mode** | B (live read + guided write) |
| **Risk Level** | MEDIUM |
| **VistA Target** | File 200 fields: DISUSER (7), TERMINATION DATE (9.2) — set to `@` (delete) |
| **Direct Write RPC** | `VE USER REACTIVATE` (archive: `REACTUSER^ZVEUSER`); `XUS IAM REACTIVATE USER` (Vivian — MISSING from VEHU) |

**Direct RPC Path:**
```
RPC: VE USER REACTIVATE
Params: [userIEN]
Entry: REACTUSER^ZVEUSER
Action: FDA(200,IENS,7)="@" and FDA(200,IENS,9.2)="@" via FILE^DIE("K")
Pre-check: $$ACTIVE(IEN) must return "INACTIVE"
```

**Verification (re-read):** `VE USER DETAIL` → DISUSER=0, TERMINATED=ACTIVE

**Implementation Provenance:**
- MUMPS: `VistA-Evolved/services/vista/ZVEUSER.m` (lines 201–213: REACTUSER)
- REST: `VistA-Evolved/apps/api/src/routes/vista-admin.ts` (lines 149–161: POST reactivate)

---

#### GW-USR-05: Set/Change Electronic Signature Code

| Attribute | Value |
|-----------|-------|
| **TM ID** | TM-USR-06 |
| **Mode** | C (guided terminal ONLY) |
| **Risk Level** | HIGH |
| **VistA Target** | File 200 field 20 (ELECTRONIC SIGNATURE CODE) — hashed, never exposed via RPC |
| **Menu Path** | EVE → Electronic Signature |
| **Option Name** | `XUSESIG` (probable) |
| **Direct Write RPC** | NONE — ES code is inherently terminal-secured. Hashed value is stored; no RPC reads or writes the plaintext. |

**Terminal Steps:**
1. Open VistA terminal
2. User navigates to their Electronic Signature option
3. Enter current signature code (if changing)
4. Enter new signature code (twice for confirmation)
5. System hashes and stores automatically

**Verification:** `DDR GETS ENTRY DATA` field .22 — returns yes/no indicator (NOT the code itself). `VE USER DETAIL` → ESIG_EXISTS=1.

**Why Terminal-Only:** The e-signature code is a credential equivalent to a wet signature. By VistA design, it is never exposed in cleartext via any RPC. The input transform applies `$$EN^XUSHSH` hashing at the MUMPS layer. There is no safe browser-mediated path.

**Implementation Provenance:**
- SPA: `vista-evolved-platform/apps/tenant-admin/public/app.js` — NOT YET in guided tasks (only 5 workflows defined; this would be #6)
- Translation Matrix: TM-USR-06 Mode C, EXT-CONFIRMED confidence
- ZVEUSER.m DETAIL: returns `ESIG_EXISTS` flag (line 54: `$S($D(^VA(200,USERIEN,20,1)):1,1:0)`)

---

### 3.2 Security Key Management (ZVEUSER.m domain)

#### GW-KEY-01: Allocate Security Key to User

| Attribute | Value |
|-----------|-------|
| **TM ID** | TM-KEY-02 |
| **Mode** | B (live read + guided write) |
| **Risk Level** | HIGH |
| **VistA Target** | File 200 multiple 51 (KEYS subfile) via `UPDATE^DIE` to File 200.051 |
| **Menu Path** | EVE → Menu Management → Key Management → Allocation |
| **Globals Written** | `^VA(200,DUZ,51,`, `^XUSEC(keyName,DUZ)` |
| **Direct Write RPC** | `VE USER ADD KEY` (archive: `ADDKEY^ZVEUSER`); `XUS SEND KEYS` (Vivian — needs probe) |

**Direct RPC Path:**
```
RPC: VE USER ADD KEY
Params: [userIEN, keyIEN]
Entry: ADDKEY^ZVEUSER
Action: Idempotency check (walk subfile for existing key), then UPDATE^DIE
        to File 200.051 with +N append (never KILL)
Error: Returns "-1^User already has this key" if duplicate
```

**Terminal Steps:**
1. Open VistA terminal
2. Navigate: EVE → Menu Management → Key Management → Allocation
3. Select key name (e.g., PROVIDER, ORES, XUMGR)
4. Select user to grant
5. Confirm allocation

**Verification:** `VE USER DETAIL` → check KEY^ entries; or `$D(^XUSEC(keyName,DUZ))` should return 1

**Implementation Provenance:**
- MUMPS: `VistA-Evolved/services/vista/ZVEUSER.m` (lines 139–160: ADDKEY — idempotent append)
- REST: `VistA-Evolved/apps/api/src/routes/vista-admin.ts` (lines 100–113: POST add-key)
- SPA: `vista-evolved-platform/apps/tenant-admin/public/app.js` (lines 563–579: allocate-key workflow)

---

#### GW-KEY-02: Remove Security Key from User

| Attribute | Value |
|-----------|-------|
| **TM ID** | TM-KEY-03 |
| **Mode** | B (live read + guided write) |
| **Risk Level** | HIGH |
| **VistA Target** | File 200 multiple 51 — delete subentry via `^DIK` |
| **Direct Write RPC** | `VE USER REMOVE KEY` (archive: `REMOVEKEY^ZVEUSER`). NO standard Kernel RPC for key removal. |

**Direct RPC Path:**
```
RPC: VE USER REMOVE KEY
Params: [userIEN, keyIEN]
Entry: REMOVEKEY^ZVEUSER
Action: Walk subfile to locate key IEN, then D ^DIK to delete the subentry
Error: Returns "-1^User does not have this key" if not found
```

**Verification:** `VE USER DETAIL` → KEY^ entries should NOT include removed key

**Implementation Provenance:**
- MUMPS: `VistA-Evolved/services/vista/ZVEUSER.m` (lines 162–177: REMOVEKEY — subfile walk + ^DIK)
- REST: `VistA-Evolved/apps/api/src/routes/vista-admin.ts` (lines 114–127: POST remove-key)

---

### 3.3 Division & Facility Management (ZVEFAC.m domain)

#### GW-DIV-01: Manage Division Configuration

| Attribute | Value |
|-----------|-------|
| **TM ID** | TM-INST-02 (write portion) |
| **Mode** | A (read) / C (write) |
| **Risk Level** | HIGH |
| **VistA Target** | File 40.8 (MEDICAL CENTER DIVISION) via `^DG(40.8)` |
| **Menu Path** | EVE → Systems Manager → Site Parameters → Medical Center Division |
| **Files Affected** | 40.8 (MEDICAL CENTER DIVISION), 4 (INSTITUTION — pointer target) |
| **Globals Written** | `^DG(40.8,` |
| **Direct Write RPC** | `DDR FILER` on File 40.8 (risky — affects data routing). No safe direct RPC. |

**Terminal Steps (from SPA):**
1. Open VistA terminal
2. Navigate: EVE → Systems Manager → Site Parameters
3. Edit Medical Center Division file
4. Set division name, institution pointer, facility number
5. Verify: `XUS DIVISION GET` returns updated data

**Why Terminal:** Division configuration affects system-wide routing and is tightly coupled to Kernel site parameters. Division creation is rare and high-impact.

**Verification:** RPC: `XUS DIVISION GET` (VEHU-confirmed, IEN 596)

**Implementation Provenance:**
- MUMPS read: `VistA-Evolved/services/vista/ZVEFAC.m` (lines 37–48: DIVLIST)
- SPA guided task: `vista-evolved-platform/apps/tenant-admin/public/app.js` (lines 580–596: manage-division workflow)
- Grounded domain: `vista-evolved-platform/docs/explanation/vista-admin-grounded-domain-institution-division-clinic.md` §1.2

---

#### GW-DIV-02: Manage Service/Section

| Attribute | Value |
|-----------|-------|
| **TM ID** | TM-INST-03 |
| **Mode** | B (live read + guided write) |
| **Risk Level** | MEDIUM |
| **VistA Target** | File 49 (SERVICE/SECTION) via `^DIC(49)` |
| **Menu Path** | EVE → Site Management → Service/Section |
| **Option Name** | `XUSRV` (probable) |
| **Direct Write RPCs** | `VE SVC CREATE` (`SVCCRT^ZVEFAC`), `VE SVC EDIT` (`SVCEDT^ZVEFAC`) |

**Direct RPC Path (create):**
```
RPC: VE SVC CREATE
Params: [name, abbreviation, chief]
Entry: SVCCRT^ZVEFAC
Action: UPDATE^DIE to File 49 — creates new entry
```

**Direct RPC Path (edit):**
```
RPC: VE SVC EDIT
Params: [serviceIEN, fieldName, newValue]
Entry: SVCEDT^ZVEFAC
Fields: NAME (.01), ABBREVIATION (1), CHIEF (2)
```

**Verification:** `VE SVC LIST` → confirm new/edited service appears

**Implementation Provenance:**
- MUMPS: `VistA-Evolved/services/vista/ZVEFAC.m` (lines 97–127: SVCCRT + SVCEDT)

---

#### GW-DIV-03: View/Edit Kernel Site Parameters

| Attribute | Value |
|-----------|-------|
| **TM ID** | TM-INST-04 |
| **Mode** | B (live read + guided write) |
| **Risk Level** | MEDIUM |
| **VistA Target** | File 8989.3 (KERNEL SYSTEM PARAMETERS) via `^XTV(8989.3)` |
| **Menu Path** | EVE → Site Management → Kernel Parameters |
| **Option Name** | `XUPARAM` (probable) |
| **Direct Read RPC** | `VE SITE PARM` (`SITEPARM^ZVEFAC`) — returns domain, volume set, default institution |
| **Direct Write RPC** | `DDR FILER` on File 8989.3 (risky — system-wide impact). No custom write. |

**Terminal Steps:** Navigate to Kernel parameters via EVE; edit fields as needed; verify via `VE SITE PARM`.

**Implementation Provenance:**
- MUMPS read: `VistA-Evolved/services/vista/ZVEFAC.m` (lines 85–93: SITEPARM)

---

### 3.4 Clinic Management (ZVECLIN.m domain)

#### GW-CLIN-01: Create Clinic

| Attribute | Value |
|-----------|-------|
| **TM ID** | TM-CLIN-03 |
| **Mode** | B (live read + guided write) |
| **Risk Level** | MEDIUM |
| **VistA Target** | File 44 (HOSPITAL LOCATION) via `^SC(` |
| **Menu Path** | EVE → Scheduling → Set Up Clinic |
| **Files Affected** | 44 (HOSPITAL LOCATION), 40.7 (STOP CODE — pointer) |
| **Direct Write RPC** | `VE CLIN CREATE` (`CLINCRT^ZVECLIN`); `SDES2 CREATE CLINIC` (Vivian — needs probe) |

**Direct RPC Path:**
```
RPC: VE CLIN CREATE
Params: [name, abbreviation, service, stopCode, appointmentLength]
Entry: CLINCRT^ZVECLIN
Action: Step 1: DIC create entry (UPDATE^DIE fails with File 44 identifier issue)
        Step 2: FILE^DIE to set remaining fields (abbreviation, type=C, service, stop code, appt length)
Returns: IEN of new clinic
```

**Terminal Steps (from SPA):**
1. Open VistA terminal
2. Navigate: EVE → Scheduling → Set Up Clinic
3. Enter clinic name, abbreviation, type (C=Clinic)
4. Set division pointer, stop codes, default slot length
5. Configure availability (optional)
6. Verify: `ORWU CLINLOC` returns the new clinic

**Verification:** `ORWU CLINLOC` (VEHU-confirmed) or `VE CLIN LIST`

**Implementation Provenance:**
- MUMPS: `VistA-Evolved/services/vista/ZVECLIN.m` (lines 88–113: CLINCRT — DIC then FILE^DIE)
- SPA guided task: `vista-evolved-platform/apps/tenant-admin/public/app.js` (lines 597–613: manage-clinic workflow)

---

#### GW-CLIN-02: Edit Clinic Fields

| Attribute | Value |
|-----------|-------|
| **TM ID** | TM-CLIN-04 |
| **Mode** | B (live read + guided write) |
| **Risk Level** | MEDIUM |
| **VistA Target** | File 44 fields via `FILE^DIE` |
| **Direct Write RPC** | `VE CLIN EDIT` (`CLINEDT^ZVECLIN`); `SDES2 EDIT CLINIC` (Vivian — needs probe) |

**Direct RPC Path:**
```
RPC: VE CLIN EDIT
Params: [clinicIEN, fieldName, newValue]
Entry: CLINEDT^ZVECLIN
Fields: NAME (.01), ABBREVIATION (1), SERVICE (9), STOP_CODE (8),
        APPT_LENGTH (1912), DISPLAY_INCR (1917), OVERBOOKS_DAY (1918), TELEPHONE (99)
```

**Verification:** `VE CLIN DETAIL` → confirm changed field

**Implementation Provenance:**
- MUMPS: `VistA-Evolved/services/vista/ZVECLIN.m` (lines 115–143: CLINEDT)

---

#### GW-CLIN-03: Inactivate/Reactivate Clinic

| Attribute | Value |
|-----------|-------|
| **TM ID** | TM-CLIN-05 |
| **Mode** | B (live read + guided write) |
| **Risk Level** | MEDIUM |
| **VistA Target** | File 44 fields 2505 (INACTIVATE DATE), 2506 (REACTIVATE DATE) |
| **Direct Write RPC** | `VE CLIN TOGGLE` (`CLINTOGL^ZVECLIN`); `SDES2 INACTIVATE CLINIC` (Vivian — needs probe) |

**Direct RPC Path:**
```
RPC: VE CLIN TOGGLE
Params: [clinicIEN, "INACTIVATE" or "REACTIVATE"]
Entry: CLINTOGL^ZVECLIN
Action: INACTIVATE → sets field 2505=now, clears 2506
        REACTIVATE → sets field 2506=now
```

**Verification:** `VE CLIN DETAIL` → INACTIVATE_DATE / REACTIVATE_DATE

**Implementation Provenance:**
- MUMPS: `VistA-Evolved/services/vista/ZVECLIN.m` (lines 145–166: CLINTOGL)

---

### 3.5 Menu & Order Configuration (Terminal-only domain)

#### GW-MENU-01: View/Edit Menu Trees

| Attribute | Value |
|-----------|-------|
| **TM ID** | TM-MENU-01 |
| **Mode** | C (guided terminal workflow) |
| **Risk Level** | MEDIUM |
| **VistA Target** | File 19 (OPTION), File 200 (PRIMARY MENU OPTION field) |
| **Menu Path** | EVE → Menu Management |
| **Option Name** | `XQMENU` (probable) |
| **Globals Affected** | `^DIC(19,`, `^VA(200,` |
| **Direct Read RPC** | `VE MENU LIST` (`MENUS^ZVEUSER`), `DDR LISTER` on File 19 |
| **Direct Write RPC** | NONE — menu tree manipulation involves complex cross-references |

**Why Terminal-Only:** Menu option trees have deep cross-references between parent/child options, multiple subfile types (B, M, Action, Protocol), and lock relationships. No RPC exists for safe menu tree editing.

---

#### GW-ORD-01: Quick Order Management

| Attribute | Value |
|-----------|-------|
| **TM ID** | TM-ORD-01 |
| **Mode** | C (guided terminal workflow) |
| **Risk Level** | HIGH |
| **VistA Target** | File 101.41 (ORDER DIALOG) via `^ORD(101.41)` |
| **Menu Path** | CPRS Config → Quick Order Management |
| **Option Name** | `ORCSQO` (probable) |
| **Direct Read RPCs** | `ORWDX DLGDEF`, `ORWDX DLGID`, `ORWDX DLGQUIK` (Vivian) |
| **Direct Write RPC** | NONE — dialog modification is among the most complex VistA admin tasks |

**Why Terminal-Only:** Quick order dialog editing has no write RPC. The cross-references span order dialogs, orderable items, and CPRS tab configuration.

---

#### GW-ORD-02: Configure CPRS Notifications

| Attribute | Value |
|-----------|-------|
| **TM ID** | TM-ALRT-02 |
| **Mode** | A (direct read + write via RPC) |
| **VistA Target** | File 100.9 (OE/RR NOTIFICATIONS) |
| **Read RPC** | `ORQ3 LOADALL` (Vivian) |
| **Write RPC** | `ORQ3 SAVEALL` (Vivian) |

This is one of the few admin write operations with a direct RPC-based save path.

---

### 3.6 PCMM & Ward Management

#### GW-PCMM-01: PCMM Team Management

| Attribute | Value |
|-----------|-------|
| **TM ID** | TM-CLIN-10 |
| **Mode** | C (guided terminal workflow) |
| **Risk Level** | MEDIUM |
| **VistA Target** | File 404.51 (TEAM) via `^SCTM(404.51)` |
| **Menu Path** | Scheduling → PCMM Team Setup |
| **Option Name** | `SCMC TEAM` (probable) |
| **Direct Read RPCs** | `SC TEAM LIST`, `SC PRIMARY CARE TEAM` (Vivian) |
| **Direct Write RPC** | NONE — PCMM team management has no write RPC |

---

#### GW-WARD-01: Edit Ward Configuration

| Attribute | Value |
|-----------|-------|
| **TM ID** | TM-WARD-03 |
| **Mode** | B (live read + guided write) |
| **Risk Level** | LOW |
| **VistA Target** | File 42 (WARD LOCATION) via `^DIC(42)` |
| **Globals Written** | `^DIC(42,` |
| **Direct Write RPC** | `VE WARD EDIT` (archive custom), `DDR FILER` on File 42 |

---

#### GW-WARD-02: Room-Bed Setup

| Attribute | Value |
|-----------|-------|
| **TM ID** | TM-WARD-04 |
| **Mode** | C (guided terminal workflow) |
| **Risk Level** | LOW |
| **VistA Target** | File 405.4 (ROOM-BED) via `^DG(405.4)` |
| **Menu Path** | ADT → Room-Bed Setup |
| **Read RPC** | `DDR LISTER` on File 405.4 |
| **Write RPC** | `DDR FILER` (risky — bed assignment is patient-facing) |

---

### 3.7 Parameter Management

#### GW-PARAM-01: View/Edit Named Parameters

| Attribute | Value |
|-----------|-------|
| **TM ID** | TM-PARAM-01 |
| **Mode** | B (live read + guided write) |
| **Risk Level** | MEDIUM |
| **VistA Target** | File 8989.5 (PARAMETERS), 8989.51 (DEFINITION) |
| **Menu Path** | Toolkit → Parameter Management |
| **Option Name** | `XPAR MENU TOOLS` (probable) |
| **Read RPC** | `VE PARAM LIST` (archive custom), `DDR LISTER` on File 8989.5/51 |
| **Write RPC** | `VE PARAM EDIT` (archive custom), `DDR FILER` on File 8989.5 |

---

#### GW-PARAM-02: Order Entry Parameters

| Attribute | Value |
|-----------|-------|
| **TM ID** | TM-ORD-03 |
| **Mode** | B (live read + guided write) |
| **Risk Level** | MEDIUM |
| **VistA Target** | File 100.99 (ORDER PARAMETERS) via `^ORD(100.99)` |
| **Menu Path** | CPRS Config → Order Parameters |
| **Read RPC** | `DDR LISTER` on File 100.99, VistA parameter API |
| **Write RPC** | VistA parameter API writes |

---

## 4. VistA EVE Menu Tree Reference (Admin-Relevant Paths)

```
EVE (System Manager Menu)
├── User Management
│   ├── Add a New User .................. [GW-USR-01] Mode B
│   ├── Edit an Existing User ........... [GW-USR-02] Mode B
│   ├── Deactivate User ................. [GW-USR-03] Mode B
│   ├── Reactivate User ................. [GW-USR-04] Mode B
│   └── Electronic Signature ............ [GW-USR-05] Mode C
│
├── Menu Management
│   ├── Key Management
│   │   ├── List All Keys ............... [Read-only, Mode A]
│   │   ├── Assign Key to User .......... [GW-KEY-01] Mode B
│   │   ├── Remove Key from User ........ [GW-KEY-02] Mode B
│   │   └── Check User Key .............. [Read-only, Mode A]
│   └── Edit Menu Trees ................. [GW-MENU-01] Mode C
│
├── Site Management
│   ├── Institution ..................... [Read-only, Mode A]
│   ├── Division ........................ [GW-DIV-01] Mode C (write)
│   ├── Service/Section ................. [GW-DIV-02] Mode B
│   └── Kernel Parameters ............... [GW-DIV-03] Mode B
│
├── Scheduling
│   ├── Clinic Setup
│   │   ├── List Clinics ................ [Read-only, Mode A]
│   │   ├── Create Clinic ............... [GW-CLIN-01] Mode B
│   │   ├── Edit Clinic ................. [GW-CLIN-02] Mode B
│   │   ├── Inactivate/Reactivate ...... [GW-CLIN-03] Mode B
│   │   ├── Stop Code Assignment ........ Mode B
│   │   ├── Availability Config ......... Mode B
│   │   └── Provider Resources .......... Mode B
│   └── PCMM Team Setup ................ [GW-PCMM-01] Mode C
│
├── CPRS Configuration
│   ├── Quick Order Management .......... [GW-ORD-01] Mode C
│   ├── Display Groups .................. Mode C
│   ├── Order Parameters ................ [GW-PARAM-02] Mode B
│   ├── Notification Setup .............. [GW-ORD-02] Mode A
│   └── Order Checks .................... Mode E (deferred)
│
├── Toolkit
│   └── Parameter Management ............ [GW-PARAM-01] Mode B
│
├── ADT
│   ├── Ward Definition ................. [GW-WARD-01] Mode B
│   └── Room-Bed Setup .................. [GW-WARD-02] Mode C
│
└── (Deferred domains: HL7, Imaging, Lab, Pharmacy — all Mode E)
```

---

## 5. Write Safety Patterns

### 5.1 FileMan Write Patterns (MUMPS Layer)

All VE* custom RPCs use one of three FileMan write patterns:

| Pattern | API | Use Case | Safety |
|---------|-----|----------|--------|
| `FILE^DIE("E")` | Edit existing field | Single-field updates (EDITUSER, CLINEDT, SVCEDT) | DD validation + input transforms fire |
| `FILE^DIE("K")` | Internal edit | DISUSER flag, termination date (DEACTUSER, REACTUSER, CLINTOGL) | Bypasses input transforms; fields must be internal format |
| `UPDATE^DIE("E")` | Add new entry/subentry | Key allocation (ADDKEY), service creation (SVCCRT), user creation (ZVECREUSER) | Full DD validation + cross-references |
| `^DIK` | Delete subentry | Key removal (REMOVEKEY) | FileMan-managed deletion with cross-ref cleanup |
| `^DIC` | Lookup/create | Clinic creation first-step (CLINCRT) | Resolves identifier conflicts that UPDATE^DIE can't |

**Critical safety rule:** Never write `^VA(200,` or `^SC(` directly — always use FileMan APIs. Direct global sets bypass DD validation, input transforms, triggers, and cross-reference updates.

### 5.2 Audit Trail Patterns

| Layer | What Gets Logged | Where |
|-------|-----------------|-------|
| **VistA FileMan** | All FILE^DIE / UPDATE^DIE writes are tracked in VistA's internal audit trail (File 1.1 AUDIT if enabled for the file) | Inside VistA; not externally accessible without custom RPC |
| **Archive API** | Every RPC call logged via structured logger with request ID propagation (`safeCallRpc` wraps with circuit breaker + logging) | `VistA-Evolved/apps/api/src/lib/rpc-resilience.ts` |
| **Platform immutable audit** | SHA-256 hash-chained append-only audit trail (Phase 35+) | `VistA-Evolved/apps/api/src/lib/immutable-audit.ts` |
| **SPA guided task evidence** | Admin-captured evidence (screenshot, terminal output) — design pattern, not yet implemented | Planned for `vista-evolved-platform/apps/tenant-admin/` |

### 5.3 Verification (Re-Read) Patterns

Every Mode B workflow uses post-write verification:

| Write Operation | Verification RPC | Check |
|----------------|-----------------|-------|
| Create user | `VE USER DETAIL` or `ORWU NEWPERS` | New user appears in search results |
| Edit user | `VE USER DETAIL` | Changed field matches expected value |
| Deactivate user | `VE USER DETAIL` | DISUSER=1, TERMINATED=INACTIVE |
| Reactivate user | `VE USER DETAIL` | DISUSER=0, TERMINATED=ACTIVE |
| Assign key | `VE USER DETAIL` | KEY^ entries include new key |
| Remove key | `VE USER DETAIL` | KEY^ entries exclude removed key |
| Create clinic | `ORWU CLINLOC` or `VE CLIN LIST` | New clinic appears in clinic list |
| Edit clinic | `VE CLIN DETAIL` | Changed field matches expected value |
| Toggle clinic | `VE CLIN DETAIL` | INACTIVATE_DATE / REACTIVATE_DATE updated |
| Create service | `VE SVC LIST` | New service appears in list |
| Division change | `XUS DIVISION GET` | Updated division data returned |

### 5.4 Rollback Patterns

| Operation | Rollback Approach | Notes |
|-----------|------------------|-------|
| Edit user | Re-edit to previous value | `VE USER EDIT` with old value; capture before-state from `VE USER DETAIL` |
| Deactivate | Reactivate | `VE USER REACTIVATE` |
| Reactivate | Deactivate | `VE USER DEACTIVATE` |
| Assign key | Remove key | `VE USER REMOVE KEY` |
| Remove key | Assign key | `VE USER ADD KEY` |
| Create clinic | Inactivate | `VE CLIN TOGGLE INACTIVATE` (cannot delete File 44 entries safely) |
| Edit clinic | Re-edit to previous value | Capture before-state from `VE CLIN DETAIL` |
| Create service | N/A | File 49 entries cannot be safely deleted; mark inactive if needed |

**Lock patterns:** No explicit ORWDX LOCK/UNLOCK equivalent exists for admin writes. FileMan's internal locking (`LOCK +^VA(200,IEN)`) is handled automatically by FILE^DIE and UPDATE^DIE. The `safeCallRpc` wrapper in the archive serializes socket access via `withBrokerLock()`.

---

## 6. Implementation Readiness Assessment

### 6.1 Fully Implemented (archive custom RPCs exist + REST routes exist)

| Workflow | MUMPS | REST | SPA Guided | VistA Probe | Status |
|----------|-------|------|-----------|-------------|--------|
| GW-USR-02 Edit user | `EDITUSER^ZVEUSER` | `/vista/admin/user/:ien/edit` | ✅ card | Needs ZVEUSER.m install | **Ready — pending routine install** |
| GW-USR-03 Deactivate | `DEACTUSER^ZVEUSER` | `/vista/admin/user/:ien/deactivate` | — | Needs ZVEUSER.m install | **Ready — pending routine install** |
| GW-USR-04 Reactivate | `REACTUSER^ZVEUSER` | `/vista/admin/user/:ien/reactivate` | — | Needs ZVEUSER.m install | **Ready — pending routine install** |
| GW-KEY-01 Assign key | `ADDKEY^ZVEUSER` | `/vista/admin/user/:ien/add-key` | ✅ card | Needs ZVEUSER.m install | **Ready — pending routine install** |
| GW-KEY-02 Remove key | `REMOVEKEY^ZVEUSER` | `/vista/admin/user/:ien/remove-key` | — | Needs ZVEUSER.m install | **Ready — pending routine install** |

### 6.2 MUMPS Exists (archive custom RPCs exist, no REST route in platform)

| Workflow | MUMPS | REST | SPA Guided | VistA Probe | Status |
|----------|-------|------|-----------|-------------|--------|
| GW-CLIN-01 Create clinic | `CLINCRT^ZVECLIN` | Archive only | ✅ card | Needs ZVECLIN.m install | **MUMPS ready — needs platform route** |
| GW-CLIN-02 Edit clinic | `CLINEDT^ZVECLIN` | Archive only | — | Needs ZVECLIN.m install | **MUMPS ready — needs platform route** |
| GW-CLIN-03 Toggle clinic | `CLINTOGL^ZVECLIN` | Archive only | — | Needs ZVECLIN.m install | **MUMPS ready — needs platform route** |
| GW-DIV-02 Create service | `SVCCRT^ZVEFAC` | Archive only | — | Needs ZVEFAC.m install | **MUMPS ready — needs platform route** |
| GW-DIV-02 Edit service | `SVCEDT^ZVEFAC` | Archive only | — | Needs ZVEFAC.m install | **MUMPS ready — needs platform route** |

### 6.3 Terminal-Only (no direct RPC write path)

| Workflow | VistA Write | Browser Role | Status |
|----------|------------|-------------|--------|
| GW-USR-01 Create user | Terminal: EVE → User Management | Guided steps + evidence capture | **SPA guidance exists; no RPC write** |
| GW-USR-05 E-signature | Terminal: ES code entry | Guidance only; cannot broker | **Must remain terminal-only by design** |
| GW-DIV-01 Division config | Terminal: EVE → Site Management | Guided steps | **SPA guidance exists** |
| GW-MENU-01 Menu trees | Terminal: EVE → Menu Management | Read-only view via DDR LISTER | **No write path possible** |
| GW-ORD-01 Quick orders | Terminal: CPRS Config | Read-only view via ORWDX DLG* RPCs | **No write path possible** |
| GW-PCMM-01 PCMM teams | Terminal: PCMM Team Setup | Read via SC TEAM LIST | **No write path possible** |
| GW-WARD-02 Room-bed setup | Terminal: ADT → Room-Bed | Read via DDR LISTER | **DDR FILER possible but risky** |

### 6.4 Deferred (Mode D/E — out of scope)

14 functions deferred: User classes, RPC broker config, HL7 admin, imaging admin (3), lab config (2), pharmacy config (2), order checks, system management (3).

---

## 7. Summary Statistics

| Category | Count |
|----------|-------|
| **Total guided write workflows cataloged** | 19 |
| **Mode A (direct RPC write)** | 2 (notifications, clinic groups) |
| **Mode B (live read + guided write)** | 10 (user CRUD, key mgmt, clinic CRUD, service, params) |
| **Mode C (terminal-only)** | 6 (e-sig, menu, quick orders, PCMM, division, room-bed) |
| **Mode E (deferred)** | 14 |
| **Custom MUMPS routines with write RPCs** | 3 (ZVEUSER.m: 5 write RPCs, ZVECLIN.m: 3 write RPCs, ZVEFAC.m: 2 write RPCs) |
| **Archive REST endpoints implemented** | 9 (all in `vista-admin.ts`) |
| **SPA guided task cards implemented** | 5 (add-user, edit-user, allocate-key, manage-division, add-clinic) |
| **XUS IAM RPCs needing VEHU probe** | 6 (ADD USER, EDIT USER, TERMINATE, REACTIVATE, FIND USER, BIND USER) |

---

## 8. Source Provenance Index

| Evidence | Location | Confidence |
|----------|----------|-----------|
| Tenant-admin SPA guided tasks (5 workflows) | `vista-evolved-platform/apps/tenant-admin/public/app.js` lines 523–652 | VERIFIED — read directly |
| Translation matrix (49 functions) | `vista-evolved-platform/docs/explanation/vista-admin-terminal-to-ui-translation-matrix.md` | VERIFIED — read directly |
| Grounded domain: users/keys/signatures | `vista-evolved-platform/docs/explanation/vista-admin-grounded-domain-users-keys-signatures.md` | VERIFIED — read directly |
| Grounded domain: institution/division/clinic | `vista-evolved-platform/docs/explanation/vista-admin-grounded-domain-institution-division-clinic.md` | VERIFIED — read directly |
| Slice ranking (top 25 functions) | `vista-evolved-platform/docs/explanation/vista-admin-slice-ranking-and-mode-selection.md` | VERIFIED — read directly |
| ZVEUSER.m (9 RPCs: 4 read, 5 write) | `VistA-Evolved/services/vista/ZVEUSER.m` (220 lines) | VERIFIED — read directly |
| ZVECLIN.m (6 RPCs: 3 read, 3 write) | `VistA-Evolved/services/vista/ZVECLIN.m` (~180 lines) | VERIFIED — read directly |
| ZVEFAC.m (8 RPCs: 6 read, 2 write) | `VistA-Evolved/services/vista/ZVEFAC.m` (~140 lines) | VERIFIED — read directly |
| ZVECREUSER.m (user creation) | `vista-evolved-vista-distro/overlay/routines/ZVECREUSER.m` (80 lines) | VERIFIED — read directly |
| Archive REST: vista-admin.ts (9 endpoints) | `VistA-Evolved/apps/api/src/routes/vista-admin.ts` (~200 lines) | VERIFIED — read directly |
| Platform tenant-admin adapter (6 functions) | `vista-evolved-platform/apps/tenant-admin/lib/vista-adapter.mjs` | VERIFIED — read directly |
| XUS IAM RPCs in Vivian but MISSING from VEHU | `VistA-Evolved/data/vista/vista_instance/rpc_missing_vs_vivian.json` | VERIFIED — grep confirmed |
| XUS IAM EDIT USER in VEHU (present) | `VistA-Evolved/data/vista/vista_instance/rpc_present.json` line 2374 | VERIFIED — grep confirmed |
| Control-plane write routes | `vista-evolved-platform/apps/control-plane/` (15 review-only simulation routes + lifecycle proxies) | VERIFIED — read directly; NOT VistA-specific writes |

---

*Generated: Task 5 of queue pack. Research date: 2026-03-21.*
