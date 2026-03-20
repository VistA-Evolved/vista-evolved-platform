# VistA Admin — Slice Ranking and Mode Selection

> **Purpose:** Ranks the first 15–25 candidate admin functions by business importance,
> safety, truth availability, and UI feasibility. Selects the first two slice candidates
> with explicit justification.
>
> **Parent:** [Terminal-to-UI Translation Matrix](vista-admin-terminal-to-ui-translation-matrix.md)
>
> **See also:**
> - [VistA Admin Corpus Discovery Pack](vista-admin-corpus-discovery-pack.md) — evidence base
> - [VistA Admin Domain Map](vista-admin-domain-map.md) — file/global/RPC quick reference
> - [Tenant Admin Personas, Jobs, and First-Slice Journeys](tenant-admin-personas-jobs-and-first-slice-journeys.md)

---

## 1. Ranking Criteria

Each candidate is scored across four dimensions (each 1–5):

| Dimension | 1 (Low) | 5 (High) |
|-----------|---------|----------|
| **Business Importance** | Rarely used, affects few users | Used daily/weekly, affects all site staff or patient care |
| **Safety** | Benign read-only, no patient impact | Write to safety-critical data (credentials, keys, orders), patient care impact on failure |
| **Truth Availability** | No known RPC, no probed evidence | VEHU-confirmed live RPC, archive wiring exists, files/globals documented |
| **UI Feasibility** | Complex multi-step, deep VistA cross-references, no API surface | Simple CRUD, existing RPCs, clear file/field contracts |

**Composite score** = Business Importance × 2 + Safety + Truth Availability + UI Feasibility.
Business importance is double-weighted because the goal is tenant-admin value, not technical convenience.

---

## 2. Candidate Ranking (Top 25)

| Rank | ID | Function | Business | Safety | Truth | Feasibility | Composite | Mode | Rationale |
|------|----|----------|----------|--------|-------|-------------|-----------|------|-----------|
| 1 | TM-USR-03 | List/search users | 5 | 1 | 5 | 5 | **21** | A | Every admin needs this daily. ORWU NEWPERS VEHU-confirmed. Lowest risk, highest value. |
| 2 | TM-KEY-01 | List security keys | 5 | 1 | 4 | 5 | **20** | A | Key catalog is foundational for access governance. DDR LISTER available; XUS ALLKEYS in Vivian. |
| 3 | TM-INST-01 | View institution | 4 | 1 | 5 | 5 | **19** | A | Site context is needed constantly. SDEC GET INSTITUTION in Vivian; DDR read confirmed. |
| 4 | TM-WARD-01 | List wards | 4 | 1 | 5 | 5 | **19** | A | Ward admin is Tier 3 but the read is trivially live (ORQPT WARDS confirmed). |
| 5 | TM-CLIN-01 | List/search clinics | 5 | 1 | 5 | 5 | **21** | A | Clinic management is daily ADPAC work. ORWU CLINLOC confirmed. Tied with USR-03; ranked here because clinic setup depends on user/key context. |
| 6 | TM-INST-02 | View divisions | 4 | 1 | 5 | 4 | **18** | A | Division hierarchy underlies all location-based routing. XUS DIVISION GET confirmed. |
| 7 | TM-WARD-05 | Ward census | 3 | 1 | 5 | 5 | **17** | A | Read-only census view from ORQPT WARD PATIENTS (live). Operational value. |
| 8 | TM-KEY-04 | Check user keys | 4 | 1 | 4 | 5 | **18** | A | Quick key verification. XUS KEY CHECK in Vivian. Useful audit tool. |
| 9 | TM-CLIN-02 | View clinic detail | 4 | 1 | 4 | 5 | **18** | A | Clinic detail is prerequisite for clinic edit workflows. SDES GET CLINIC INFO in Vivian. |
| 10 | TM-DDR-01 | FileMan generic read | 3 | 1 | 4 | 4 | **15** | A | Escape hatch for any ad-hoc file inquiry. DDR LISTER / DDR GETS confirmed in Vivian. |
| 11 | TM-USR-01 | Create user | 5 | 5 | 3 | 2 | **20** | B | Highest business importance + highest safety. Custom ZVEUSER.m exists but needs probing. Complex multi-field write. |
| 12 | TM-USR-02 | Edit user | 5 | 4 | 3 | 3 | **20** | B | Near-daily. Some fields safe direct; credentials/keys need guidance. |
| 13 | TM-KEY-02 | Assign key to user | 5 | 4 | 3 | 3 | **20** | B | Access governance requires key assignment. XUS SEND KEYS in Vivian; archive custom exists. |
| 14 | TM-KEY-03 | Remove key from user | 4 | 4 | 3 | 3 | **18** | B | Key removal is operationally important. No standard Kernel RPC exists. Archive custom. |
| 15 | TM-USR-04 | Deactivate user | 4 | 4 | 3 | 2 | **17** | B | Security-critical: off-boarding staff. XUS IAM TERMINATE in Vivian. Cascading implications. |
| 16 | TM-CLIN-03 | Create clinic | 4 | 3 | 3 | 3 | **18** | B | New clinic setup is regular ADPAC work. SDES2 CREATE CLINIC in Vivian. |
| 17 | TM-CLIN-04 | Edit clinic | 4 | 3 | 3 | 3 | **18** | B | Clinic modification follows creation. SDES2 EDIT CLINIC in Vivian. |
| 18 | TM-ALRT-02 | Notification config | 3 | 2 | 4 | 4 | **16** | A | ORQ3 LOADALL/SAVEALL in Vivian provide direct read+write. Affects clinical workflow. |
| 19 | TM-USR-06 | Electronic signature | 4 | 5 | 4 | 1 | **18** | C | ES code is never exposed via RPC — terminal-only by design. Critical for order signing. |
| 20 | TM-CLIN-05 | Inactivate clinic | 3 | 3 | 3 | 3 | **15** | B | Operational cleanup. SDES2 INACTIVATE in Vivian. |
| 21 | TM-INST-03 | Manage services | 3 | 2 | 3 | 3 | **14** | B | Service/section setup is periodic. Archive custom VE SVC exists. |
| 22 | TM-PARAM-01 | View/edit parameters | 3 | 3 | 3 | 3 | **15** | B | Parameter management is admin power tool. VE PARAM in archive. System-wide impact on write. |
| 23 | TM-MENU-01 | View/edit menu trees | 3 | 3 | 2 | 2 | **13** | C | Menu management is complex, terminal-tied. DDR read available. Writes are deep cross-refs. |
| 24 | TM-ORD-01 | Quick order management | 3 | 4 | 3 | 1 | **14** | C | Among the most complex admin tasks. ORWDX DLG read RPCs exist. No write RPC. |
| 25 | TM-WARD-02 | View ward detail | 3 | 1 | 4 | 4 | **15** | A | Ward detail extends the ward list. VE WARD DETAIL in archive; DDR GETS available. |

---

## 3. Mode Distribution of Top 25

| Mode | Count | IDs |
|------|-------|-----|
| **A** (Live read + live write) | 12 | USR-03, KEY-01, INST-01, WARD-01, CLIN-01, INST-02, WARD-05, KEY-04, CLIN-02, DDR-01, ALRT-02, WARD-02 |
| **B** (Live read + guided write) | 10 | USR-01, USR-02, KEY-02, KEY-03, USR-04, CLIN-03, CLIN-04, CLIN-05, INST-03, PARAM-01 |
| **C** (Guided terminal workflow) | 3 | USR-06, MENU-01, ORD-01 |
| **D/E** | 0 | (None in top 25 — all deferred/wrapper items fell below rank 25) |

---

## 4. First Two Slice Candidates

### Slice 1: **User/Key Read Workspace** (Mode A — Live Read)

**Functions:** TM-USR-03 (list users), TM-KEY-01 (list keys), TM-KEY-04 (check key), TM-INST-01 (view institution), TM-INST-02 (view divisions)

**Justification:**
1. **Business importance:** Every admin task starts with "who are my users, what keys do they hold, in which institution/division?" This is the foundation — nothing else works without it.
2. **Safety:** Pure read-only. Zero risk of corrupting VistA data. No writes to any file.
3. **Truth availability:** `ORWU NEWPERS` is VEHU-confirmed live. `XUS DIVISION GET` is EXT-CONFIRMED. `DDR LISTER` on Files 4, 19.1, 200 is gateway-level Vivian-confirmed. Archive has `VE USER LIST`, `VE KEY LIST`, `VE INST LIST`, `VE DIV LIST` custom RPCs (require ZVEUSER.m install).
4. **UI feasibility:** All Mode A — list views with search, detail panels, badge indicators. No complex forms or guided workflows. Can deliver the entire slice as a read-only dashboard.
5. **Persona alignment:** TA-1 (IRM/Site Admin) and TA-2 (ADPAC) both begin every session by checking user and access state. This slice validates the tenant-admin workspace concept.

**What this proves:** That the VistA-Evolved platform can surface real VistA administrative truth in a browser UI. If the reads are accurate, guided writes become credible.

**Not included in Slice 1:** User create/edit, key assign/remove (those are Slice 2 or later — Mode B write operations).

### Slice 2: **User/Key Write with Guided Terminal Fallback** (Mode B — Live Read + Guided Write)

**Functions:** TM-USR-01 (create user), TM-USR-02 (edit user), TM-KEY-02 (assign key), TM-KEY-03 (remove key), TM-USR-04 (deactivate user)

**Justification:**
1. **Business importance:** User provisioning and access management is the most urgent admin task at every VistA site. New staff can't work until they have a user record and the right keys.
2. **Safety:** These are the highest-safety functions in the matrix (creating users, granting/revoking access). This is exactly why they must be Mode B: live reads confirm current state, but writes go through a guided workflow with evidence capture (screenshots, confirmation steps, audit trail).
3. **Truth availability:** Mixed. `XUS IAM` RPCs exist in Vivian but need VEHU probing. Archive has `VE USER EDIT`, `VE USER ADD KEY`, etc., but these require `ZVEUSER.m` installation. The live-probe step is part of this slice's implementation.
4. **UI feasibility:** Mode B means the browser reads current state from VistA and composes a write request, but the actual write either goes through a confirmed RPC or falls back to a guided-terminal workflow with operator evidence capture.
5. **Terminal fallback:** If the write RPCs are unavailable in VEHU, the browser generates terminal command guidance and captures evidence (what was typed, what VistA returned). This is the Guided Write pattern — the browser is useful even when it can't directly write.

**What this proves:** That Mode B (guided write) works — the platform adds value even when direct RPC writes aren't available, by structuring the workflow and capturing evidence.

**Depends on Slice 1:** Must complete the read workspace first. Can't guide a user creation if you can't display the current user list.

---

## 5. Sequencing Rationale

```
Slice 1 (Read Workspace)   →  Slice 2 (User/Key Writes)
  pure Mode A reads              Mode B guided writes
  zero risk                      audit-captured writes
  proves browser truth           proves guided workflow
```

**Why not start with clinics?** Clinics (ranked #5 for list) have equally good read RPCs but clinic creation requires file 44 knowledge that is more complex than File 200. Users are the primitive — clinics, wards, and orders all depend on having users first.

**Why not start with electronic signature (C)?** ES code entry is terminal-only by VistA security design and cannot be proven as a browser feature. It should be third, after the mode B pattern is proven.

**Why not skip straight to writes?** Because every write in VistA is validated against the data dictionary. Without read-side proof that the browser correctly interprets VistA state, write guidance can't be trusted.

---

## 6. Risk Log

| Risk | Mitigation |
|------|-----------|
| XUS IAM RPCs not available in VEHU | Slice 2 includes probe step; fallback to DDR FILER or guided terminal |
| VE* custom RPCs require ZVEUSER.m install | Installation procedure documented in archive; `install-vista-routines.ps1` handles it |
| DDR LISTER returns raw VistA format | Parser already exists in archive for other DDR-based routes |
| File 200 field count is extremely large (~200 fields) | Slice 2 focuses on the 15-20 operationally critical fields, not all 200 |
| Guided write UX is untested | Slice 2 is explicitly a proof-of-concept for the guided write pattern |

---

*Generated: Task 2 of queue pack "VISTA ADMIN CORPUS + TERMINAL-TO-UI TRANSLATION PROGRAM"*
*Research date: 2026-03-21*
