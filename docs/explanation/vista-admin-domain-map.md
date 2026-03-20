# VistA Admin Domain Map

> **Purpose:** Maps every tenant-admin concern domain to its governing VistA packages,
> canonical files, globals, and RPC families. This is the quick-reference companion to
> the [VistA Admin Corpus Discovery Pack](vista-admin-corpus-discovery-pack.md).
>
> **See also:** [VistA Admin Source Manual Index](vista-admin-source-manual-index.md) — bibliography of all sources.
>
> **Key:** Package prefix → File → Global → RPC family → Admin capability

---

## Domain → Package → File Mapping

### D1: Users & Access

| Concern | Package | File # | File Name | Global | RPC Family |
|---------|---------|--------|-----------|--------|------------|
| User master record | XU Kernel | 200 | NEW PERSON | `^VA(200,` | `XUS IAM *`, `XUS GET USER INFO` |
| User classes | XU Kernel | 201 | USER CLASS | `^USR(201,` | (FileMan DDR only) |
| Electronic signature | XU Kernel | 200 | (subfield) | `^VA(200,` | `XUS EPCS EDIT` |
| Person class | XU Kernel | 8932.1 | PERSON CLASS | `^USC(8932.1,` | (FileMan DDR only) |
| Provider taxonomy | XU Kernel | 7 | PROVIDER CLASS | `^DIC(7,` | (FileMan DDR only) |

### D2: Security Keys & Menus

| Concern | Package | File # | File Name | Global | RPC Family |
|---------|---------|--------|-----------|--------|------------|
| Security keys | XU Kernel | 19.1 | SECURITY KEY | `^DIC(19.1,` | `XUS ALLKEYS`, `XUS KEY CHECK`, `XUS SEND KEYS` |
| Menu options | XU Kernel | 19 | OPTION | `^DIC(19,` | `XU REBUILD MENU TREE` |
| RPC contexts | XWB Broker | 8994 | REMOTE PROCEDURE | `^XWB(8994,` | `XWB CREATE CONTEXT`, `XWB IS RPC AVAILABLE` |
| Remote applications | XWB Broker | 8994.5 | REMOTE APPLICATION | (see 8994) | `XWB RPC LIST` |

### D3: Institutions & Divisions

| Concern | Package | File # | File Name | Global | RPC Family |
|---------|---------|--------|-----------|--------|------------|
| Institutions | XU Kernel | 4 | INSTITUTION | `^DIC(4,` | `SDEC GET INSTITUTION`, `SDEC FACLIST` |
| Divisions | DG Registration | 40.8 | MEDICAL CENTER DIVISION | `^DG(40.8,` | `XUS DIVISION GET/SET`, `SDES GET DIVISION LIST` |
| MAS site params | DG Registration | 43 | MAS PARAMETERS | `^DG(43,` | (FileMan DDR only) |
| Service/Section | XU Kernel | 49 | SERVICE/SECTION | `^DIC(49,` | (FileMan DDR only) |

### D4: Clinics & Scheduling Config

| Concern | Package | File # | File Name | Global | RPC Family |
|---------|---------|--------|-----------|--------|------------|
| Clinic master | SD Scheduling | 44 | HOSPITAL LOCATION | `^SC(` | `SDES2 CREATE/EDIT/INACTIVATE CLINIC`, `SDES SEARCH CLINIC` |
| Stop codes | SD Scheduling | 40.7 | CLINIC STOP | `^DIC(40.7,` | `SDEC CLINSTOP` |
| Appointment types | SD Scheduling | 409.1 | APPOINTMENT TYPE | `^SD(409.1,` | `SDES GET APPT TYPES` |
| Cancel reasons | SD Scheduling | 409.2 | CANCELLATION REASONS | `^SD(409.2,` | `SDES GET CANCEL REASONS` |
| Clinic groups | SD Scheduling | 409.67 | CLINIC GROUP | `^SD(409.67,` | `SDES ADDEDIT/READ/DELETE CLINIC GRP` |
| PCMM teams | SD Scheduling | 404.51 | TEAM | `^SCTM(404.51,` | `SC TEAM LIST`, `SC PRIMARY CARE TEAM` |
| Scheduling params | SD Scheduling | 404.91 | SCHEDULING PARAMETER | `^SD(404.91,` | (SDES context) |
| Clinic availability | SD Scheduling | (44 subfields) | AVAILABILITY | `^SC(` | `SDES2 CREATE/EDIT CLINIC AVAIL` |
| Provider resources | SD Scheduling | (SDES internal) | RESOURCE | — | `SDES2 CREATE/EDIT PROVIDER RESOURCE` |

### D5: Wards & Room-Beds

| Concern | Package | File # | File Name | Global | RPC Family |
|---------|---------|--------|-----------|--------|------------|
| Wards | DG Registration | 42 | WARD LOCATION | `^DIC(42,` | `DGWPT BYWARD`, `ORQPT WARDS` |
| Specialties | DG Registration | 42.4 | SPECIALTY | `^DIC(42.4,` | `ORQPT SPECIALTIES` |
| Room-beds | DG Registration | 405.4 | ROOM-BED | `^DG(405.4,` | (FileMan DDR only) |
| Patient movement | DG Registration | 405 | PATIENT MOVEMENT | `^DGPM(405,` | (ADT RPCs absent from OSS distros) |

### D6: Order Entry Config

| Concern | Package | File # | File Name | Global | RPC Family |
|---------|---------|--------|-----------|--------|------------|
| Order dialogs | OR | 101.41 | ORDER DIALOG | `^ORD(101.41,` | `ORWDX DLGDEF/DLGID/DLGQUIK` |
| Orderable items | OR | 101.43 | ORDERABLE ITEMS | `^ORD(101.43,` | `ORWDX ORDITM` |
| Display groups | OR | 100.98 | DISPLAY GROUP | `^ORD(100.98,` | `ORWDX DGRP` |
| Order parameters | OR | 100.99 | ORDER PARAMETERS | `^ORD(100.99,` | (parameter API) |
| Order checks | OR | 860 | ORDER CHECK RULE | `^ORD(860,` | `ORK TRIGGER` |

### D7: Parameters & Site Config

| Concern | Package | File # | File Name | Global | RPC Family |
|---------|---------|--------|-----------|--------|------------|
| Parameter values | XT Toolkit | 8989.5 | PARAMETERS | `^XTV(8989.5,` | (FileMan DDR or terminal) |
| Parameter definitions | XT Toolkit | 8989.51 | PARAMETER DEFINITION | `^XTV(8989.51,` | (FileMan DDR only) |
| Kernel system params | XU Kernel | 8989.3 | KERNEL SYSTEM PARAMETERS | `^XTV(8989.3,` | (FileMan DDR only) |
| Broker site params | XWB Broker | 8994.1 | RPC BROKER SITE PARAMETERS | `^XWB(8994.1,` | `XWB GET BROKER INFO` |

### D8: Alerts & Notifications

| Concern | Package | File # | File Name | Global | RPC Family |
|---------|---------|--------|-----------|--------|------------|
| Kernel alerts | XU Kernel | 8992 | ALERT | `^XTV(8992,` | `XQAL GUI ALERTS` |
| CPRS notifications | OR | 100.9 | NOTIFICATIONS | `^ORD(100.9,` | `ORB *`, `ORQ3 *` |

### D9: HL7 & Interfaces

| Concern | Package | File # | File Name | Global | RPC Family |
|---------|---------|--------|-----------|--------|------------|
| HL7 applications | HL | 771 | HL7 APPLICATION PARAMETER | `^HL(771,` | (terminal only, 0 RPCs) |
| HL7 message types | HL | 770 | HL7 MESSAGE TYPE | `^HL(770,` | (terminal only) |
| HLO applications | HL | 779.1 | HLO APPLICATION | `^HLO(779.1,` | (terminal only) |

### D10: Imaging Admin

| Concern | Package | File # | File Name | Global | RPC Family |
|---------|---------|--------|-----------|--------|------------|
| Image index | MAG | 2005 | IMAGE | `^MAG(2005,` | `MAG4 ADD IMAGE`, `MAG4 GET IMAGE INFO` |
| Network locations | MAG | 2005.2 | NETWORK LOCATION | `^MAG(2005.2,` | (MAG config RPCs) |
| Site parameters | MAG | 2006.1 | IMAGING SITE PARAMETERS | `^MAG(2006.1,` | (MAG config RPCs) |
| Acquisition devices | MAG | 2006.04 | ACQUISITION DEVICE | `^MAG(2006.04,` | (device registry RPCs) |

### D11: Lab Config

| Concern | Package | File # | File Name | Global | RPC Family |
|---------|---------|--------|-----------|--------|------------|
| Lab tests | LR | 60 | LABORATORY TEST | `^LAB(60,` | (FileMan DDR or terminal) |
| Lab site config | LR | 69.9 | LABORATORY SITE | `^LAB(69.9,` | (terminal only) |

### D12: Pharmacy Config

| Concern | Package | File # | File Name | Global | RPC Family |
|---------|---------|--------|-----------|--------|------------|
| Drug file | PS | 50 | DRUG | `^PSDRUG(` | (national maintenance) |
| Pharmacy system | PS | 59.7 | PHARMACY SYSTEM | `^PS(59.7,` | (terminal only) |

### D-DDR: Generic FileMan Access (escape hatch)

| Concern | Package | File # | File Name | Global | RPC Family |
|---------|---------|--------|-----------|--------|------------|
| Any VistA file | DI FileMan | (any) | (any) | (any) | `DDR LISTER`, `DDR GETS ENTRY DATA`, `DDR FILER`, `DDR FIND1`, `DDR FINDER` |

---

## Global-to-File Quick Reference

| Global | File # | Name | Admin Domain |
|--------|--------|------|-------------|
| `^VA(200,` | 200 | NEW PERSON | Users |
| `^DIC(4,` | 4 | INSTITUTION | Institutions |
| `^DIC(7,` | 7 | PROVIDER CLASS | Users |
| `^DIC(19,` | 19 | OPTION | Menu/keys |
| `^DIC(19.1,` | 19.1 | SECURITY KEY | Keys |
| `^DIC(40.7,` | 40.7 | CLINIC STOP | Clinics |
| `^DIC(42,` | 42 | WARD LOCATION | Wards |
| `^DIC(42.4,` | 42.4 | SPECIALTY | Wards |
| `^DIC(49,` | 49 | SERVICE/SECTION | Institutions |
| `^DG(40.8,` | 40.8 | MEDICAL CENTER DIVISION | Divisions |
| `^DG(43,` | 43 | MAS PARAMETERS | Site config |
| `^DG(405.4,` | 405.4 | ROOM-BED | Wards |
| `^SC(` | 44 | HOSPITAL LOCATION | Clinics |
| `^SD(409.1,` | 409.1 | APPOINTMENT TYPE | Scheduling |
| `^SD(409.2,` | 409.2 | CANCELLATION REASONS | Scheduling |
| `^SD(409.67,` | 409.67 | CLINIC GROUP | Scheduling |
| `^ORD(100.98,` | 100.98 | DISPLAY GROUP | Orders |
| `^ORD(100.99,` | 100.99 | ORDER PARAMETERS | Orders |
| `^ORD(101.41,` | 101.41 | ORDER DIALOG | Orders |
| `^ORD(101.43,` | 101.43 | ORDERABLE ITEMS | Orders |
| `^XTV(8989.3,` | 8989.3 | KERNEL SYSTEM PARAMETERS | Site config |
| `^XTV(8989.5,` | 8989.5 | PARAMETERS | Parameters |
| `^XTV(8989.51,` | 8989.51 | PARAMETER DEFINITION | Parameters |
| `^XTV(8992,` | 8992 | ALERT | Alerts |
| `^XWB(8994,` | 8994 | REMOTE PROCEDURE | RPC Broker |
| `^MAG(2005,` | 2005 | IMAGE | Imaging |

---

*Generated: Task 1 of queue pack "VISTA ADMIN CORPUS + TERMINAL-TO-UI TRANSLATION PROGRAM"*
