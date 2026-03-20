# Tenant Admin — VistA Ward & Room-Bed Map

> **Status:** Canonical reference for tenant-admin ward/bed topology grounding.
> **Date:** 2026-03-20.
> **Type:** Explanation.
> **Scope:** Detailed mapping of VistA Files 42 and 405.4 to available RPCs,
> globals, and safe access patterns for inpatient bed management.
> **Parent:** [Tenant Admin VistA Admin Truth Discovery Pack](tenant-admin-vista-admin-truth-discovery-pack.md)
>
> **See also:** [VistA Admin Corpus Discovery Pack](vista-admin-corpus-discovery-pack.md) §2.5 (Wards)

---

## 1. Ward Location — File 42

### Business meaning

Wards are inpatient care units: medical wards, surgical wards, ICUs,
psychiatric units. Each ward has a treating specialty, bed count, and
associated nursing staff.

### File structure

```
File 42 — WARD LOCATION
Global: ^DG(42,IEN,0)

Node 0:   WARD_NAME ^ ABBREVIATION ^ DIVISION_POINTER ^ BEDS ^ ... ^ SPECIALTY
```

### Key global nodes

| Node | Content |
|------|---------|
| `^DG(42,IEN,0)` | Ward name ^ abbreviation ^ division ^ bed count ^ specialty |
| `^DG(42,IEN,"GL")` | Ward global location parameters |
| `^DG(42,"B",name,IEN)` | B-index — name-to-IEN |

### Relationship to File 44 (Hospital Location)

Some ward records also have entries in File 44 with type "W" (Ward).
The File 42 record is the authoritative inpatient bed/census source.
The File 44 record handles scheduling-like functions for ward admissions.

### File 42.4 — Treating Specialty

```
File 42.4 — TREATING SPECIALTY
Global: ^DIC(42.4,IEN,0)

Node 0:   SPECIALTY_NAME ^ NATIONAL_CODE ^ ... ^ STATUS
```

Treating specialties classify the type of care provided on each ward
(e.g., General Medicine, General Surgery, Psychiatry).

---

## 2. Room-Bed — File 405.4

### Business meaning

Individual beds within a ward. Each room-bed record links to a ward and
represents a physical bed that can be assigned to a patient.

### File structure

```
File 405.4 — ROOM-BED
Global: ^DG(405.4,IEN,0)

Node 0:   BED_NAME ^ WARD_POINTER ^ STATUS ^ ... ^ ROOM_NUMBER
```

### Key global nodes

| Node | Content |
|------|---------|
| `^DG(405.4,IEN,0)` | Bed name ^ ward IEN ^ status ^ room # |
| `^DG(405.4,"C",wardIEN,IEN)` | C-index — ward-to-bed cross-reference |
| `^DG(405.4,"B",name,IEN)` | B-index — bed name-to-IEN |

### Bed status values

| Status | Meaning |
|--------|---------|
| (empty) | Available |
| Occupied | Patient assigned |
| Dirty | Needs cleaning |
| Blocked | Administratively closed |

---

## 3. Available RPCs

### Patient-oriented RPCs (confirmed)

| RPC | IEN | Purpose | Admin utility |
|-----|-----|---------|:---:|
| `ORWPT BYWARD` | 620 | List patients on a specific ward | Low — returns patients, not bed config |
| `ORWPT ADMITLST` | 198 | List all admitted patients | Low — returns patients, not bed config |

### Admin-oriented reads

No dedicated admin RPCs for ward/bed configuration reads are confirmed available.
The patient-oriented RPCs return clinical data, not structural topology.

**For admin-level ward/bed topology, the recommended read path is:**

```
XWB GET VARIABLE VALUE: $O(^DG(42,"B",""))
  → Walk B-index for all ward names
  → Read ^DG(42,IEN,0) for each for full detail

XWB GET VARIABLE VALUE: $O(^DG(405.4,"C",wardIEN,""))
  → Walk C-index for all beds on a specific ward
  → Read ^DG(405.4,IEN,0) for bed name, status, room#
```

**Confidence:** probable — global paths are well-documented but live probing
via `XWB GET VARIABLE VALUE` not yet tested for these specific globals.

---

## 4. Topology assembly pattern

```
Step 1: Get all wards
  → Walk ^DG(42,"B") for ward name list
  → Read ^DG(42,IEN,0) for ward detail (name, division, specialty, bed count)

Step 2: Get beds per ward
  → Walk ^DG(405.4,"C",wardIEN) for bed list
  → Read ^DG(405.4,IEN,0) for bed detail (name, status, room)

Step 3: Resolve treating specialties
  → Read ^DIC(42.4,specialtyIEN,0) for specialty names

Step 4: Build tree
  Ward
    ├── Treating Specialty
    └── Beds
          ├── Bed A (Room 101) — Available
          ├── Bed B (Room 101) — Occupied
          └── Bed C (Room 102) — Available
```

### Priority assessment

Ward/bed topology is **P3 priority** for tenant admin grounding because:
- Inpatient admin is less common than user/clinic management
- The available RPCs are patient-oriented, not admin-oriented
- Direct global reads require more probing to validate
- Fixture data can serve the prototype phase adequately

---

## 5. What must remain guided-terminal-only

- Ward creation/edit (File 42 writes)
- Bed addition/removal (File 405.4 writes)
- Treating specialty assignment (File 42 field edit)
- Bed status management (blocking/unblocking)
- Ward census configuration
- Room assignment rules

---

## 6. Sandbox data availability

The VEHU sandbox has ward and bed data populated (unlike some other admin files).
`ORWPT BYWARD` returns patient-ward assignments, confirming ward data exists.
The specific population of File 405.4 room-bed records needs live probing.

---
