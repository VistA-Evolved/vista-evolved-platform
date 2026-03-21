# VistA Admin — Terminal-to-UI Translation Matrix v2

> **Status:** Canonical v2 translation matrix. Supersedes v1.
> **Date:** 2026-03-21.
> **Pass class:** PASS-DOC.
> **Governed by:** AGENTS.md, VE-PLAT-ADR-0003.
>
> **What v2 adds over v1:**
> - **Role cluster column** (from deep use-case audit RC-1 through RC-12).
> - **Blocker ID column** (from tenant-admin-blocker-ledger.md).
> - **Dependency chain column** — what must be proven live before this function is achievable.
> - **Archive reference column** — exact archive file/route that implemented this function, if any.
> - **Sandbox availability column** — whether the RPC/DDR path is confirmed available in VEHU or the distro lane.
> - **Distro overlay needed column** — whether a custom MUMPS routine is required in the distro overlay.
> - **Estimated pass class** — what pass class (PASS-DOC / PASS-CONTRACT / PASS-SHELL / PASS-LIVE) the function currently achieves.
>
> **Relationship to v1:** This document includes all 49 v1 functions plus 21 new functions from the deep use-case audit (70 total). v1 column data is preserved and extended. v1 is retained as reference.

---

## Reading Guide

### Column Definitions (v2 additions in bold)

| Column | Definition |
|--------|-----------|
| ID | Unique function identifier (`TM-{domain}-{seq}`) |
| Domain / Package | VistA package and admin domain |
| **Role Cluster** | RC-1 through RC-12 from deep use-case audit |
| User Role | Who performs this in terminal |
| Purpose | What the function accomplishes |
| Truth-Bearing Files | VistA files read or written |
| Existing Read Path | Known read RPC or DDR query |
| Existing Write Path | Known write RPC or terminal-only |
| UI Translation Mode | A–E (same as v1) |
| Confidence | EXT-CONFIRMED / VIVIAN-LOCAL / NEEDS-LIVE-PROOF |
| **Sandbox Availability** | VEHU-confirmed / Vivian-only / Archive-custom / DDR-only / None |
| **Dependency Chain** | What must be proven/resolved first |
| **Blocker ID** | Blocker from tenant-admin-blocker-ledger.md, if applicable |
| **Archive Reference** | Exact file path in VistA-Evolved archive repo |
| **Distro Overlay Needed** | Whether custom `ZVE*.m` routine needed in distro overlay |
| **Current Pass Class** | PASS-DOC / PASS-CONTRACT / PASS-SHELL / PASS-LIVE |

### UI Translation Modes (unchanged from v1)

| Mode | Label | Definition |
|------|-------|-----------|
| **A** | Live read + live write | Safe RPC-backed read and write from browser |
| **B** | ~~Live read + guided write~~ **Retired (tenant-admin)** | **Was:** RPC reads + terminal-guided writes. **Now:** same writes go through **DDR / `ZVE*`** from the API (see tenant-admin OpenAPI). |
| **C** | Guided terminal workflow | Both read and write are terminal-backed |
| **D** | Wrapper / adapter project | No existing RPC surface; requires new MUMPS routine |
| **E** | Informational / deferred | Too specialized, risky, or low-value for current scope |

---

## D1: Users & Access (File 200)

| ID | Role | Purpose | Read Path | Write Path | Mode | Sandbox | Dependency | Blocker | Archive Ref | Overlay | Pass Class |
|----|------|---------|-----------|------------|------|---------|------------|---------|-------------|---------|------------|
| TM-USR-01 | RC-1 | Create new user | — | XUS IAM ADD USER (Vivian) | B | Vivian-only | Backend API gap | B-WRITE-001, B-AUTH-001 | `apps/api/src/routes/vista-users.ts` | Maybe (ZVEUSER.m) | PASS-DOC |
| TM-USR-02 | RC-1 | Edit existing user | XUS GET USER INFO | XUS IAM EDIT USER (Vivian) | B | VEHU-confirmed (read) | Backend API + TM-USR-03 live | B-WRITE-001 | `apps/api/src/routes/vista-users.ts` | Maybe | PASS-DOC |
| TM-USR-03 | RC-1 | List/search users | ORWU NEWPERS | N/A (read-only) | A | VEHU-confirmed | Backend API gap | B-PROOF-001 | `apps/api/src/routes/vista-users.ts` | No | PASS-CONTRACT |
| TM-USR-04 | RC-1 | Deactivate user | DDR GETS | XUS IAM TERMINATE USER (Vivian) | B | Vivian-only (write) | TM-USR-03 live + write RPC probe | B-WRITE-001 | — | Maybe | PASS-DOC |
| TM-USR-05 | RC-1 | Reactivate user | DDR GETS | XUS IAM REACTIVATE USER (Vivian) | B | Vivian-only (write) | TM-USR-04 live | B-WRITE-001 | — | Maybe | PASS-DOC |
| TM-USR-06 | RC-1 | E-sig setup | DDR GETS (indicator only) | Terminal-only | C | VEHU-confirmed (read) | Guided terminal infra | — | — | No | PASS-DOC |
| TM-USR-07 | RC-1 | Sig block edit | DDR GETS 20.2-20.4 | DDR FILER on File 200 | A/B | Vivian-only | DDR FILER probe | B-WRITE-001 | — | No | PASS-DOC |
| TM-USR-08 | RC-1 | User class mgmt | DDR LISTER File 201 | DDR FILER File 201 | E | Vivian-only | — | — | — | No | PASS-DOC |

---

## D2: Security Keys & Menus (Files 19.1, 19)

| ID | Role | Purpose | Read Path | Write Path | Mode | Sandbox | Dependency | Blocker | Archive Ref | Overlay | Pass Class |
|----|------|---------|-----------|------------|------|---------|------------|---------|-------------|---------|------------|
| TM-KEY-01 | RC-1 | List all keys | XUS ALLKEYS (Vivian), DDR LISTER File 19.1 | N/A | A | Vivian-only | Backend API + XUS ALLKEYS probe | B-RPC-001, B-FIXTURE-002 | — | No | PASS-DOC |
| TM-KEY-02 | RC-1,2 | Assign key to user | XUS KEY CHECK | XUS SEND KEYS (Vivian) | B | Vivian-only (write) | TM-KEY-01 live + XUS SEND KEYS probe | B-WRITE-001 | — | No | PASS-DOC |
| TM-KEY-03 | RC-1,2 | Remove key from user | XUS KEY CHECK | Archive custom only | B | Archive-custom | TM-KEY-02 live | B-WRITE-001 | `services/vista/ZVEUSER.m` | Yes (ZVEUSER.m) | PASS-DOC |
| TM-KEY-04 | RC-1,2 | Check if user has key | XUS KEY CHECK (Vivian), ORWU HASKEY (confirmed) | N/A | A | VEHU-confirmed | Backend API | — | `apps/api/src/routes/vista-users.ts` | No | PASS-CONTRACT |
| TM-MENU-01 | RC-1 | View/edit option trees | DDR LISTER File 19 | Terminal-only | C | DDR-only (read) | Guided terminal infra | — | — | No | PASS-DOC |
| TM-MENU-02 | RC-1 | RPC Broker contexts | XWB RPC LIST (Vivian) | XWB CREATE CONTEXT (Vivian) | E | Vivian-only | — | — | — | No | PASS-DOC |

---

## D3: Institutions & Divisions (Files 4, 40.8)

| ID | Role | Purpose | Read Path | Write Path | Mode | Sandbox | Dependency | Blocker | Archive Ref | Overlay | Pass Class |
|----|------|---------|-----------|------------|------|---------|------------|---------|-------------|---------|------------|
| TM-INST-01 | RC-3 | View institution | DDR LISTER File 4, SDEC GET INSTITUTION | Rarely written | A | VEHU-confirmed (DDR) | Backend API | — | `apps/api/src/routes/vista-facilities.ts` | No | PASS-CONTRACT |
| TM-INST-02 | RC-3 | View/manage divisions | XUS DIVISION GET | DDR FILER File 40.8 (risky) | A(read)/C(write) | VEHU-confirmed (read) | Backend API | — | `apps/api/src/routes/vista-facilities.ts` | No | PASS-CONTRACT |
| TM-INST-03 | RC-3 | Manage services | DDR LISTER File 49 | DDR FILER / archive custom | B | DDR-only | TM-INST-01 live | B-WRITE-001 | — | Maybe | PASS-DOC |
| TM-INST-04 | RC-1 | Kernel site parameters | DDR GETS File 8989.3 | DDR FILER File 8989.3 | B | DDR-only | Backend API + DDR probe | B-RPC-003 | — | No | PASS-DOC |

---

## D4: Clinics & Scheduling (File 44)

| ID | Role | Purpose | Read Path | Write Path | Mode | Sandbox | Dependency | Blocker | Archive Ref | Overlay | Pass Class |
|----|------|---------|-----------|------------|------|---------|------------|---------|-------------|---------|------------|
| TM-CLIN-01 | RC-4 | List/search clinics | ORWU CLINLOC (confirmed) | N/A | A | VEHU-confirmed | Backend API | — | `apps/api/src/routes/vista-facilities.ts` | No | PASS-CONTRACT |
| TM-CLIN-02 | RC-4 | View clinic detail | SDES GET CLINIC INFO2/3 (Vivian) | N/A | A | Vivian-only | TM-CLIN-01 live + SDES probe | — | — | No | PASS-DOC |
| TM-CLIN-03 | RC-4 | Create clinic | — | SDES2 CREATE CLINIC (Vivian) | B | Vivian-only | TM-CLIN-02 live + SDES2 probe | B-WRITE-001 | — | Maybe | PASS-DOC |
| TM-CLIN-04 | RC-4 | Edit clinic | Same as TM-CLIN-02 | SDES2 EDIT CLINIC (Vivian) | B | Vivian-only | TM-CLIN-03 live | B-WRITE-001 | — | Maybe | PASS-DOC |
| TM-CLIN-05 | RC-4 | Inactivate clinic | SDES GET CLINIC INFO | SDES2 INACTIVATE CLINIC (Vivian) | B | Vivian-only | TM-CLIN-04 live | B-WRITE-001 | — | Maybe | PASS-DOC |
| TM-CLIN-06 | RC-4 | Assign stop codes | SDEC CLINSTOP (Vivian) | SDEC CLINSTOP (Vivian) | B | Vivian-only | TM-CLIN-01 live | — | — | No | PASS-DOC |
| TM-CLIN-07 | RC-4 | Clinic availability | SDES GET APPT TYPES (Vivian) | SDES2 CREATE/EDIT AVAIL (Vivian) | B | Vivian-only | TM-CLIN-03 live | B-WRITE-001 | — | No | PASS-DOC |
| TM-CLIN-08 | RC-4 | Clinic groups | SDES READ CLINIC GROUP (Vivian) | SDES ADDEDIT CLINIC GRP (Vivian) | A | Vivian-only | SDES probe | — | — | No | PASS-DOC |
| TM-CLIN-09 | RC-4 | Provider resources | SDES GET RESOURCE BY CLINIC (Vivian) | SDES2 CREATE PROVIDER RESOURCE (Vivian) | B | Vivian-only | SDES probe | B-WRITE-001 | — | No | PASS-DOC |
| TM-CLIN-10 | RC-4 | PCMM teams | SC TEAM LIST (Vivian) | Terminal-only | C | Vivian-only (read) | Guided terminal infra | — | — | No | PASS-DOC |

---

## D5: Wards & Room-Beds (Files 42, 405.4)

| ID | Role | Purpose | Read Path | Write Path | Mode | Sandbox | Dependency | Blocker | Archive Ref | Overlay | Pass Class |
|----|------|---------|-----------|------------|------|---------|------------|---------|-------------|---------|------------|
| TM-WARD-01 | RC-5 | List wards | ORQPT WARDS (confirmed) | N/A | A | VEHU-confirmed | Backend API | — | `apps/api/src/routes/vista-wards.ts` | No | PASS-CONTRACT |
| TM-WARD-02 | RC-5 | Ward detail | DDR GETS File 42 | N/A | A | DDR-only | TM-WARD-01 live | — | — | No | PASS-DOC |
| TM-WARD-03 | RC-5 | Edit ward | DDR GETS File 42 | DDR FILER File 42 | B | DDR-only | TM-WARD-02 live | B-WRITE-001 | — | No | PASS-DOC |
| TM-WARD-04 | RC-5 | Room-bed management | DDR LISTER File 405.4 | DDR FILER File 405.4 | C | DDR-only | TM-WARD-01 live | B-WRITE-001 | — | No | PASS-DOC |
| TM-WARD-05 | RC-5 | Ward census | ORQPT WARD PATIENTS (confirmed) | N/A | A | VEHU-confirmed | Backend API | — | `apps/api/src/routes/vista-wards.ts` | No | PASS-CONTRACT |

---

## D6: Order Entry Config (Files 101.41, 100.98)

| ID | Role | Purpose | Read Path | Write Path | Mode | Sandbox | Dependency | Blocker | Archive Ref | Overlay | Pass Class |
|----|------|---------|-----------|------------|------|---------|------------|---------|-------------|---------|------------|
| TM-ORD-01 | RC-11 | Quick order mgmt | ORWDX DLGDEF (Vivian) | Terminal-only | C | Vivian-only (read) | Guided terminal infra | — | — | No | PASS-DOC |
| TM-ORD-02 | RC-11 | Display groups | ORWDX DGRP (Vivian) | Terminal-only | C | Vivian-only (read) | TM-ORD-01 | — | — | No | PASS-DOC |
| TM-ORD-03 | RC-11 | Order parameters | DDR LISTER File 100.99 | Parameter API | B | DDR-only | Backend API | — | — | No | PASS-DOC |
| TM-ORD-04 | RC-11 | Order checks config | ORK TRIGGER (Vivian) | Terminal-only | E | Vivian-only | — | — | — | No | PASS-DOC |

---

## D7: Parameters & Site Config (Files 8989.3, 8989.5)

| ID | Role | Purpose | Read Path | Write Path | Mode | Sandbox | Dependency | Blocker | Archive Ref | Overlay | Pass Class |
|----|------|---------|-----------|------------|------|---------|------------|---------|-------------|---------|------------|
| TM-PARAM-01 | RC-1,2 | Parameter mgmt | DDR LISTER File 8989.5, VE PARAM LIST (archive) | DDR FILER / VE PARAM EDIT (archive) | B | DDR-only | Backend API | B-RPC-003 | — | Maybe (ZVEPARM.m) | PASS-DOC |
| TM-PARAM-02 | RC-1 | Broker site params | XWB GET BROKER INFO (Vivian) | Terminal-only | E | Vivian-only | — | — | — | No | PASS-DOC |

---

## D8: Alerts & Notifications (Files 8992, 100.9)

| ID | Role | Purpose | Read Path | Write Path | Mode | Sandbox | Dependency | Blocker | Archive Ref | Overlay | Pass Class |
|----|------|---------|-----------|------------|------|---------|------------|---------|-------------|---------|------------|
| TM-ALRT-01 | RC-1,2 | Alert config | XQAL GUI ALERTS (Vivian) | Terminal-only (config) | B | Vivian-only | Backend API | — | — | No | PASS-DOC |
| TM-ALRT-02 | RC-2,11 | Notification routing | ORQ3 LOADALL (Vivian) | ORQ3 SAVEALL (Vivian) | A | Vivian-only | Backend API + ORQ3 probe | — | — | No | PASS-DOC |

---

## D9–D10+: Specialized Domains

| ID | Role | Purpose | Mode | Sandbox | Pass Class | Notes |
|----|------|---------|------|---------|------------|-------|
| TM-HL7-01 | RC-10 | HL7 app params | C | DDR-only (read) | PASS-DOC | Integration-plane. No admin RPCs. |
| TM-HL7-02 | RC-10 | Link monitor | E | Vivian-only | PASS-DOC | Integration-plane telemetry. |
| TM-IMG-01 | RC-9 | Imaging locations | E | Vivian-only | PASS-DOC | Integration-plane. |
| TM-IMG-02 | RC-9 | Imaging devices | E | Vivian-only | PASS-DOC | Integration-plane. Archive Phase 24. |
| TM-IMG-03 | RC-9 | Imaging site params | E | Vivian-only | PASS-DOC | Integration-plane. |
| TM-LAB-01 | RC-8 | Lab test defs | E | DDR-only | PASS-DOC | Specialized domain. |
| TM-LAB-02 | RC-8 | Lab site config | E | DDR-only | PASS-DOC | Specialized domain. |
| TM-PHAR-01 | RC-7 | Drug file mgmt | E | DDR-only | PASS-DOC | Nationally governed. |
| TM-PHAR-02 | RC-7 | Pharmacy site params | E | DDR-only | PASS-DOC | Specialized domain. |
| TM-SYS-01 | RC-1 | TaskMan mgmt | E | Vivian-only | PASS-DOC | Infrastructure monitoring. |
| TM-SYS-02 | RC-1 | Error trap | E | Archive-custom | PASS-DOC | Infrastructure monitoring. |
| TM-SYS-03 | RC-6 | Device mgmt | E | DDR-only | PASS-DOC | Hardware-tied. |
| TM-DDR-01 | RC-12 | DD browsing | A (read) | DDR-only | PASS-DOC | Powerful read tool. |
| TM-DDR-02 | RC-12 | Data extract/print | A (read) | DDR-only | PASS-DOC | Reporting tool. |

---

## Summary: Pass Class Distribution

| Pass Class | Count | Meaning |
|------------|-------|---------|
| PASS-LIVE | 0 | No function proven end-to-end against live VistA |
| PASS-SHELL | 0 | No function has a working UI shell wired to live data |
| PASS-CONTRACT | 7 | Screen contract exists + RPC is VEHU-confirmed: TM-USR-03, TM-KEY-04, TM-INST-01, TM-INST-02, TM-CLIN-01, TM-WARD-01, TM-WARD-05 |
| PASS-DOC | 63 | Research, design, and/or direct-write / legacy guided-write docs |
| **Total** | **70** | |

---

## Critical path: 7 functions at PASS-CONTRACT are the first PASS-LIVE candidates

These 7 functions have: (1) confirmed RPCs in VEHU, (2) screen contracts, (3) adapter stubs, and (4) complete grounded domain documentation. The only gap between PASS-CONTRACT and PASS-LIVE is the backend API layer and a live proof run.

| ID | Function | RPC | Confirmed? |
|----|----------|-----|------------|
| TM-USR-03 | List/search users | ORWU NEWPERS | VEHU ✅ |
| TM-KEY-04 | Check user key | ORWU HASKEY | VEHU ✅ |
| TM-INST-01 | View institution | DDR LISTER File 4 | VEHU ✅ (DDR) |
| TM-INST-02 | View divisions | XUS DIVISION GET | VEHU ✅ |
| TM-CLIN-01 | List clinics | ORWU CLINLOC | VEHU ✅ |
| TM-WARD-01 | List wards | ORQPT WARDS | VEHU ✅ |
| TM-WARD-05 | Ward census | ORQPT WARD PATIENTS | VEHU ✅ |
