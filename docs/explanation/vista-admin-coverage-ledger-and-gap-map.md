# VistA Admin — Coverage Ledger and Gap Map

> **Status:** Canonical coverage tracking artifact.
> **Date:** 2026-03-21.
> **Pass class:** PASS-DOC.
> **Governed by:** AGENTS.md, VE-PLAT-ADR-0003.
>
> **Purpose:** Single-page summary of what is covered, what is missing, and what blocks
> progress from PASS-DOC → PASS-LIVE across all 70 terminal-to-UI functions.
> Companion to `vista-admin-terminal-to-ui-translation-matrix-v2.md`.

---

## 1. Coverage summary

| Metric | Count | % of 70 |
|--------|-------|---------|
| Functions at PASS-LIVE | 0 | 0% |
| Functions at PASS-SHELL | 0 | 0% |
| Functions at PASS-CONTRACT | 7 | 10% |
| Functions at PASS-DOC | 63 | 90% |
| Functions with VEHU-confirmed RPC | 7 | 10% |
| Functions with Vivian-only RPC | 28 | 40% |
| Functions with DDR-only path | 14 | 20% |
| Functions with no RPC surface | 21 | 30% |
| Functions suitable for tenant-admin UI | 33 | 47% |
| Functions requiring guided write | 19 | 27% |
| Functions deferred (Mode E) | 14 | 20% |

---

## 2. Gap map: What blocks each pass class transition

### PASS-DOC → PASS-CONTRACT (63 functions need this)

| Gap | Description | Blocks | Resolution path |
|-----|-------------|--------|-----------------|
| G-CONTRACT-01 | Missing screen contracts for 51 functions | 51 of 63 | Create screen-contract JSON files in `packages/contracts/screen-contracts/` |
| G-CONTRACT-02 | Unprobed Vivian RPCs | 28 functions | Probe each RPC in VEHU/distro via ZVEPROB.m or TCP connection |
| G-CONTRACT-03 | Missing adapter signatures | 51 functions | Add function signatures to `lib/vista-adapter.mjs` |

### PASS-CONTRACT → PASS-SHELL (7 functions ready for this)

| Gap | Description | Blocks | Resolution path | Blocker ID |
|-----|-------------|--------|-----------------|------------|
| G-SHELL-01 | No platform backend API layer | All 7 | Port or re-implement VistA API routes from archive into platform | B-PROOF-001 |
| G-SHELL-02 | No session auth in tenant-admin | All 7 | Wire session/auth to broker connection | B-AUTH-001 |
| G-SHELL-03 | Adapter HTTP targets don't exist | All 7 | Create FastAPI/Fastify endpoints at tenant-admin server or platform API | B-PROOF-001 |

### PASS-SHELL → PASS-LIVE (0 functions ready for this yet)

| Gap | Description | Blocks | Resolution path | Blocker ID |
|-----|-------------|--------|-----------------|------------|
| G-LIVE-01 | No live Docker verification done | All | Start VistA Docker, run API, call endpoints, capture evidence | B-PROOF-001 |
| G-LIVE-02 | Broker restart persistence unproven | All | Prove broker survives restart and reconnects | B-PERSIST-001 |
| G-LIVE-03 | No write paths proven | 19 guided-write functions | Probe write RPCs, capture terminal → RPC → read-back evidence | B-WRITE-001 |

---

## 3. Blocker-to-function impact map

| Blocker ID | Blocker | Impact (functions blocked) | Severity |
|-----------|---------|---------------------------|----------|
| B-PROOF-001 | No live proof package exists | All 70 functions | P0 — total |
| B-AUTH-001 | No session/auth wired | All 70 functions | P0 — total |
| B-WRITE-001 | No write path implemented | 19 guided-write functions | P1 — blocks writes |
| B-RPC-001 | XUS ALLKEYS unprobed | TM-KEY-01 (key catalog) | P2 — blocks key reads |
| B-RPC-002 | Bulk e-sig validation absent | TM-USR-06 (e-sig status) | P2 — blocks e-sig reads |
| B-RPC-003 | Site parameter RPC absent | TM-PARAM-01, TM-INST-04 | P2 — blocks param reads |
| B-PERSIST-001 | Broker restart not proven | All live functions | P1 — blocks PASS-LIVE |
| B-FIXTURE-001 | Roles JSON is fixture-only | Roles display surface | P3 — UX only |
| B-FIXTURE-002 | Key catalog is fixture-only | TM-KEY-01 | P2 — blocks key reads |
| B-FIXTURE-003 | E-sig status is fixture-only | TM-USR-06 | P2 — blocks e-sig reads |
| B-DOC-001 | Admin-console not deprecated | UX confusion | P3 — documentation |

---

## 4. Domain heat map

| Domain | Total functions | PASS-CONTRACT | PASS-DOC only | Mode E (deferred) | Hottest gap |
|--------|----------------|---------------|---------------|--------------------|----|
| D1 Users & Access | 8 | 1 (TM-USR-03) | 6 | 1 | Backend API + write RPCs |
| D2 Security Keys | 6 | 1 (TM-KEY-04) | 4 | 1 | XUS ALLKEYS probe |
| D3 Institutions | 4 | 2 (TM-INST-01, TM-INST-02) | 2 | 0 | DDR FILER safety |
| D4 Clinics | 10 | 1 (TM-CLIN-01) | 8 | 0 (1 Mode C) | SDES probe in distro |
| D5 Wards | 5 | 2 (TM-WARD-01, TM-WARD-05) | 2 | 0 (1 Mode C) | DDR probe for beds |
| D6 Order Entry | 4 | 0 | 2 | 1 (1 Mode C) | Clinical domain — not tenant-admin |
| D7 Parameters | 2 | 0 | 1 | 1 | DDR probe for params |
| D8 Alerts | 2 | 0 | 2 | 0 | ORQ3 probe |
| D9 HL7 | 2 | 0 | 0 | 1 (1 Mode C) | Integration-plane — deferred |
| D10+ Specialized | 15 | 0 | 1 | 14 | All deferred |

---

## 5. First-slice candidates (highest ROI)

Based on:
- Already at PASS-CONTRACT (VEHU-confirmed RPC + screen contract)
- Low dependency count (read-only, no write path needed)
- High tenant-admin relevance (daily admin tasks)

| Priority | Function | ID | RPC | Why first |
|----------|----------|----|----|-----------|
| 1 | List/search users | TM-USR-03 | ORWU NEWPERS | Core admin task #1 |
| 2 | View divisions | TM-INST-02 | XUS DIVISION GET | Foundation for multi-site |
| 3 | List clinics | TM-CLIN-01 | ORWU CLINLOC | Core facility config |
| 4 | List wards | TM-WARD-01 | ORQPT WARDS | Core facility config |
| 5 | Check user key | TM-KEY-04 | ORWU HASKEY | Core security audit |
| 6 | View institution | TM-INST-01 | DDR LISTER File 4 | Foundation read |
| 7 | Ward census | TM-WARD-05 | ORQPT WARD PATIENTS | Operational read |

**All 7 can share a single slice architecture:** Platform API layer with RPC broker → wrap each RPC → tenant-admin adapter calls platform API → UI renders response with honest source label.

---

## 6. Architecture decision required

The backend API gap (G-SHELL-01, G-SHELL-02, G-SHELL-03) blocks all 7 first-slice candidates equally. Three options exist:

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Port archive broker client + routes into platform repo | Proven code, fastest time-to-live | Pulls complexity from archive; maintenance burden |
| B | Distro provides VistA API endpoints; platform consumes via HTTP | Clean contract boundary; distro owns VistA | Requires distro API layer that doesn't exist yet |
| C | Tenant-admin server.mjs connects directly to VistA broker (TCP) | Simplest; already sketched in xwb-client.mjs | Bypasses contract-first architecture; broker in UI server |

**Recommendation:** Option A for first slice (proven path), with Option B as the target architecture. Capture as ADR.

---

## 7. Cross-references

| Doc | Purpose |
|-----|---------|
| `vista-admin-terminal-to-ui-translation-matrix-v2.md` | Full 70-function matrix with all v2 columns |
| `vista-admin-terminal-to-ui-translation-matrix.md` | v1 matrix (49 functions, retained as reference) |
| `vista-admin-deep-use-case-audit.md` | Role cluster analysis (RC-1 through RC-12) |
| `tenant-admin-blocker-ledger.md` | Active blocker tracking |
| `vista-admin-repo-gap-analysis.md` | v1 gap analysis (still accurate, this doc extends it) |
| `vista-admin-slice-ranking-and-mode-selection.md` | Prioritized slice plan |
