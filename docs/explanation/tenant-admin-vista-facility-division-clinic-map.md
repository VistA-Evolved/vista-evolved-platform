# Tenant Admin — VistA Facility, Division & Clinic Map

> **Status:** Canonical reference for tenant-admin facility topology grounding.
> **Date:** 2026-03-20.
> **Type:** Explanation.
> **Scope:** Detailed mapping of VistA Files 4, 40.8, 44, and related files
> to available RPCs, globals, and safe access patterns.
> **Parent:** `tenant-admin-vista-admin-truth-discovery-pack.md`

---

## 1. Facility hierarchy

VistA models facility topology as a three-level hierarchy:

```
Institution (File 4)          — Legal entity / station
  └── Division (File 40.8)    — Organizational subdivision
        └── Hospital Location (File 44) — Clinic / ward / OR / other care site
```

Each level has distinct VistA files, globals, and RPCs. The hierarchy is
navigated via pointer fields between files.

---

## 2. Institution — File 4

### File structure

```
File 4 — INSTITUTION
Global: ^DIC(4,IEN,0)

Node 0:  INSTITUTION_NAME ^ STATION_NUMBER ^ ... ^ status
```

### Key global nodes

| Node | Content |
|------|---------|
| `^DIC(4,IEN,0)` | Name ^ station number ^ facility type |
| `^DIC(4,IEN,99)` | NPI, additional identifiers |
| `^DIC(4,"B",name,IEN)` | B-index — name-to-IEN |
| `^DIC(4,"D",station#,IEN)` | D-index — station-number-to-IEN |

### Confirmed available RPCs

| RPC | Purpose | Confidence |
|-----|---------|:---:|
| `ORWU GENERIC` | Generic FileMan lookup (works for File 4) | confirmed |
| `XWB GET VARIABLE VALUE` | Direct global read | confirmed |

### Read pattern

```
Option A: ORWU GENERIC with file=4, search text
  → Returns matching institution names + IENs

Option B: XWB GET VARIABLE VALUE for ^DIC(4,"B","") traversal
  → Walk B-index for full institution list
  → Read ^DIC(4,IEN,0) for each result for detail
```

**Confidence:** probable — `ORWU GENERIC` confirmed available; File 4 lookup
via ORWU GENERIC not yet tested live.

---

## 3. Medical Center Division — File 40.8

### File structure

```
File 40.8 — MEDICAL CENTER DIVISION
Global: ^DG(40.8,IEN,0)

Node 0:  DIVISION_NAME ^ INSTITUTION_POINTER ^ FACILITY_NUMBER ^ ... ^ status
```

### Key relationships

| From | Field | To | Purpose |
|------|-------|----|----|
| File 40.8 | piece 2 of node 0 | File 4 (Institution) | Division → Institution link |
| File 200 (user) | division assignments | File 40.8 | User → Division(s) |

### Key global nodes

| Node | Content |
|------|---------|
| `^DG(40.8,IEN,0)` | Division name ^ institution IEN ^ facility # |
| `^DG(40.8,"B",name,IEN)` | B-index — name-to-IEN |

### Confirmed available RPCs

| RPC | Purpose | Confidence |
|-----|---------|:---:|
| `XUS DIVISION GET` (IEN 596) | Get divisions available to authenticated user | **confirmed** |
| `XUS DIVISION SET` (IEN 594) | Set active division for session | **confirmed** |

### Read pattern

```
XUS DIVISION GET
  → Returns array of division records available to current user
  → Format: division_IEN ^ name ^ default_flag ^ institution_IEN ^ station#

For comprehensive division list (beyond user-scoped):
  XWB GET VARIABLE VALUE: $O(^DG(40.8,"B",""))
  → Walk B-index for all divisions
  → Read ^DG(40.8,IEN,0) for each for full detail
```

### Limitations

`XUS DIVISION GET` returns only divisions **assigned to the authenticated user**.
A system admin who needs to see ALL divisions may need direct global reads.

---

## 4. Hospital Location — File 44

### File structure

```
File 44 — HOSPITAL LOCATION
Global: ^SC(IEN,0)

Node 0:   LOCATION_NAME ^ ABBREVIATION ^ TYPE ^ ... ^ DIVISION_POINTER
Node "SL": Default slot length (scheduling)
Node "S",date: Slot availability for date
```

### Location types (field in node 0)

| Type | Meaning |
|------|---------|
| C | Clinic |
| W | Ward |
| OR | Operating Room |
| M | Module |
| Z | Other |

### Key global nodes

| Node | Content |
|------|---------|
| `^SC(IEN,0)` | Name ^ abbreviation ^ type ^ division pointer ^ ... |
| `^SC(IEN,"SL")` | Default slot length in minutes |
| `^SC(IEN,"S",date)` | Slot availability for specific date |
| `^SC("B",name,IEN)` | B-index — name-to-IEN |
| `^SC("AC",type,IEN)` | AC-index — type-to-IEN cross-reference |

### Confirmed available RPCs

| RPC | IEN | Purpose | Confidence |
|-----|-----|---------|:---:|
| `ORWU CLINLOC` | 254 | Search clinic locations by name text | **confirmed** |
| `SDES GET APPT TYPES` | 4399 | List appointment types | **confirmed** |
| `SDES GET APPT BY APPT IEN` | 4323 | Get appointment by IEN | **confirmed** |
| `SDEC APPADD` | 3676 | Add appointment (scheduling write) | **confirmed** |

### Read pattern

```
ORWU CLINLOC with search text (e.g., "" or partial name)
  → Returns array of "IEN^Name^Type" for matching clinics

For full clinic detail:
  XWB GET VARIABLE VALUE: ^SC(IEN,0)
  → Parse pieces for name, type, division, stop codes
```

### Relationship to divisions

File 44 node 0 contains a pointer to File 40.8 (division). This links
clinics to their parent division, completing the hierarchy:

```
Institution (File 4) ← Division (File 40.8) ← Hospital Location (File 44)
```

---

## 5. Topology assembly pattern

To render a complete facility tree in the tenant-admin UI:

```
Step 1: Get all divisions
  → XUS DIVISION GET (for user-scoped)
  → OR walk ^DG(40.8,"B") (for admin-comprehensive)
  → Each division has institution pointer

Step 2: Resolve institutions
  → Read ^DIC(4,IEN,0) for each unique institution pointer
  → OR use ORWU GENERIC for File 4 lookup

Step 3: Get clinics per division
  → ORWU CLINLOC with empty search returns all clinics
  → Filter by division pointer in node 0
  → OR walk ^SC("AC","C") for clinic-type locations

Step 4: Build tree
  Institution
    └── Division(s)
          └── Clinic(s) / Ward(s) / OR(s)
```

### First-slice simplification

For the first grounded read-only slice, skip comprehensive global walks:

```
Minimal path:
1. XUS DIVISION GET → divisions for current user
2. ORWU CLINLOC → clinic locations (may not have division filter)
3. Combine and display flat tables with honest "Source: VistA (live)" labels
4. Tree hierarchy is a stretch goal requiring global reads
```

---

## 6. What must remain guided-terminal-only

### Institution (File 4)
- Institution creation/edit — extremely high-impact, rarely done
- Station number assignment — system-level

### Division (File 40.8)
- Division creation — requires FileMan operations with File 4 linkage
- Division assignment to users — writes to File 200 subfields
- Division deactivation — cascading impact on clinics and scheduling

### Hospital Location (File 44)
- Clinic creation — complex multi-field setup (stop codes, availability templates)
- Availability pattern definition — recurring complex scheduling templates
- Stop code mapping — impacts billing and workload reporting
- Clinic inactivation — cascading impact on appointments

---
