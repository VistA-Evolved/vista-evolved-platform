# VistA Admin Source Manual Index

> **Purpose:** Bibliography of every external source consulted during the VistA Admin Corpus
> discovery research. Each entry records: what was accessed, when, what was extracted,
> and reliability assessment. This ensures every claim in the corpus is traceable.

---

## Primary External Sources

### S1: Wikipedia — VistA

| Field | Value |
|-------|-------|
| **URL** | `https://en.wikipedia.org/wiki/VistA` |
| **Type** | Encyclopedia article |
| **Access date** | 2025-07-16 |
| **What was extracted** | VistA overview: 180+ applications, deployment across 1700+ VA facilities, M/MUMPS architecture, package organization, history from DHCP to VistA, open-source status |
| **Reliability** | HIGH — well-maintained Wikipedia article with 100+ citations to VA and government sources |
| **Used in** | Corpus §1 (System Overview), §2 general context |

### S2: Wikipedia — VA Kernel

| Field | Value |
|-------|-------|
| **URL** | `https://en.wikipedia.org/wiki/VA_Kernel` |
| **Type** | Encyclopedia article |
| **Access date** | 2025-07-16 |
| **What was extracted** | Kernel infrastructure components: MenuMan, MailMan, TaskMan, Sign-on/Security, Device Handler, Alert Utility, Protocol/Event processor. Access/verify code pattern. VistA package as unit of distribution. |
| **Reliability** | HIGH — Wikipedia article with VA citations |
| **Used in** | Corpus §2.1 (Users), §2.2 (Keys/Menus), §2.7 (Parameters), §2.9 (Alerts) |

### S3: Wikipedia — FileMan

| Field | Value |
|-------|-------|
| **URL** | `https://en.wikipedia.org/wiki/FileMan` |
| **Type** | Encyclopedia article |
| **Access date** | 2025-07-16 |
| **What was extracted** | FileMan as metadata/database engine for MUMPS, data dictionary-driven architecture, public domain status, self-documenting nature of DD |
| **Reliability** | HIGH — Wikipedia article with VA citations |
| **Used in** | Corpus §2.8 (FileMan) |

### S4: WorldVistA/VistA-M GitHub — Kernel Package

| Field | Value |
|-------|-------|
| **URL** | `https://github.com/WorldVistA/VistA-M/tree/master/Packages/Kernel` |
| **Type** | Source code repository (global file listing) |
| **Access date** | 2025-07-16 |
| **What was extracted** | Complete VistA global file listing for Kernel: File 200 (NEW PERSON), File 19 (OPTION), File 19.1 (SECURITY KEY), File 4 (INSTITUTION), File 201 (USER CLASS), File 3.5 (DEVICE), File 49 (SERVICE-SECTION), File 7 (PROVIDER CLASS), File 8932.1 (PERSON CLASS), File 8989.2/3 (KERNEL PARAMETERS), File 8992 (ALERT), File 8994.5 (REMOTE APPLICATION), File 101 (PROTOCOL), File 9.4/9.6/9.7 (PACKAGE/BUILD/INSTALL), File 3.081/3.05 (SIGN-ON LOG/FAILED ACCESS ATTEMPTS) |
| **Reliability** | HIGH — open-source VistA repository maintained by WorldVistA |
| **Used in** | Corpus §2.1, §2.2, §2.3, §2.7, §2.9, Domain Map D1-D3, D7-D8 |

### S5: WorldVistA/VistA-M GitHub — Registration Package

| Field | Value |
|-------|-------|
| **URL** | `https://github.com/WorldVistA/VistA-M/tree/master/Packages/Registration` |
| **Type** | Source code repository (global file listing) |
| **Access date** | 2025-07-16 |
| **What was extracted** | File 2 (PATIENT), File 40.8 (MEDICAL CENTER DIVISION), File 42 (WARD LOCATION), File 42.4 (SPECIALTY), File 43 (MAS PARAMETERS), File 405 (PATIENT MOVEMENT), File 405.4 (ROOM-BED), File 8 (ELIGIBILITY CODE), 60+ additional registration files |
| **Reliability** | HIGH — WorldVistA open-source repo |
| **Used in** | Corpus §2.3 (Institutions), §2.5 (Wards), Domain Map D3, D5 |

### S6: WorldVistA/VistA-M GitHub — Scheduling Package

| Field | Value |
|-------|-------|
| **URL** | `https://github.com/WorldVistA/VistA-M/tree/master/Packages/Scheduling` |
| **Type** | Source code repository (global file listing) |
| **Access date** | 2025-07-16 |
| **What was extracted** | File 44 (HOSPITAL LOCATION), File 40.7 (CLINIC STOP), File 409.1 (APPOINTMENT TYPE), File 409.2 (CANCELLATION REASONS), File 404.91 (SCHEDULING PARAMETER), File 404.51 (TEAM), File 409.67 (CLINIC GROUP), 50+ files including PCMM Team files |
| **Reliability** | HIGH — WorldVistA open-source repo |
| **Used in** | Corpus §2.4 (Clinics), Domain Map D4 |

### S7: WorldVistA/VistA-M GitHub — RPC Broker Package

| Field | Value |
|-------|-------|
| **URL** | `https://github.com/WorldVistA/VistA-M/tree/master/Packages/RPC%20Broker` |
| **Type** | Source code repository (global file listing) |
| **Access date** | 2025-07-16 |
| **What was extracted** | File 8994 (REMOTE PROCEDURE), File 8994.1 (RPC BROKER SITE PARAMETERS) — only 2 global files |
| **Reliability** | HIGH — WorldVistA open-source repo |
| **Used in** | Corpus §2.10 (RPC Broker), Domain Map D2 |

### S8: WorldVistA/VistA-M GitHub — Toolkit Package

| Field | Value |
|-------|-------|
| **URL** | `https://github.com/WorldVistA/VistA-M/tree/master/Packages/Toolkit` |
| **Type** | Source code repository (global file listing) |
| **Access date** | 2025-07-16 |
| **What was extracted** | File 8989.5 (PARAMETERS), File 8989.51 (PARAMETER DEFINITION), File 8989.518 (PARAMETER ENTITY), File 8989.52 (PARAMETER TEMPLATE), File 15 (DUPLICATE RECORD) |
| **Reliability** | HIGH — WorldVistA open-source repo |
| **Used in** | Corpus §2.7 (Parameters), Domain Map D7 |

### S9: WorldVistA/VistA-M GitHub — Order Entry Package

| Field | Value |
|-------|-------|
| **URL** | `https://github.com/WorldVistA/VistA-M/tree/master/Packages/Order%20Entry%20Results%20Reporting` |
| **Type** | Source code repository (global file listing) |
| **Access date** | 2025-07-16 |
| **What was extracted** | File 100 (ORDER), File 100.98 (DISPLAY GROUP), File 100.99 (ORDER PARAMETERS), File 101.41 (ORDER DIALOG), File 101.43 (ORDERABLE ITEMS), File 860.x (ORDER CHECK files) |
| **Reliability** | HIGH — WorldVistA open-source repo |
| **Used in** | Corpus §2.6 (Order Entry), Domain Map D6 |

### S10: WorldVistA/VistA-M GitHub — Lab Service Package

| Field | Value |
|-------|-------|
| **URL** | `https://github.com/WorldVistA/VistA-M/tree/master/Packages/Lab%20Service` |
| **Type** | Source code repository (global file listing) |
| **Access date** | 2025-07-16 |
| **What was extracted** | File 60 (LABORATORY TEST), File 62 (COLLECTION SAMPLE), File 63 (LAB DATA), File 64 (WKLD CODE), File 69 (LAB ORDER ENTRY), File 69.9 (LABORATORY SITE), 40+ files |
| **Reliability** | HIGH — WorldVistA open-source repo |
| **Used in** | Corpus §2.12 (Lab), Domain Map D11 |

### S11: WorldVistA/VistA-M GitHub — Pharmacy Data Management Package

| Field | Value |
|-------|-------|
| **URL** | `https://github.com/WorldVistA/VistA-M/tree/master/Packages/Pharmacy%20Data%20Management` |
| **Type** | Source code repository (global file listing) |
| **Access date** | 2025-07-16 |
| **What was extracted** | File 50 (DRUG), File 50.7 (PHARMACY ORDERABLE ITEM), File 51 (MEDICATION INSTRUCTION), File 52.6 (IV ADDITIVES), File 55 (PHARMACY PATIENT), File 59.7 (PHARMACY SYSTEM) |
| **Reliability** | HIGH — WorldVistA open-source repo |
| **Used in** | Corpus §2.13 (Pharmacy), Domain Map D12 |

### S12: WorldVistA/VistA-M GitHub — Imaging Package

| Field | Value |
|-------|-------|
| **URL** | `https://github.com/WorldVistA/VistA-M/tree/master/Packages/Imaging` |
| **Type** | Source code repository (global file listing) |
| **Access date** | 2025-07-16 |
| **What was extracted** | File 2005 (IMAGE), File 2005.2 (NETWORK LOCATION), File 2006.1 (IMAGING SITE PARAMETERS), File 2006.04 (ACQUISITION DEVICE), 100+ imaging/DICOM files |
| **Reliability** | HIGH — WorldVistA open-source repo |
| **Used in** | Corpus §2.14 (Imaging), Domain Map D10 |

---

## Local Reference Sources

### L1: Vivian Index Snapshot

| Field | Value |
|-------|-------|
| **Location** | `VistA-Evolved/docs/grounding/vivian-index.json` |
| **Type** | Cached Vivian DOX package index |
| **What it contains** | 127 VistA packages, 4,721 RPCs (with names), package metadata (prefix, namespaces, description, interfaces, RPC lists, VDL links) |
| **Reliability** | HIGH — snapshot from Vivian (vivian.worldvista.org), maintained by OSEHRA/WorldVistA. Cross-referenced against WorldVistA GitHub for file-level detail |
| **Used in** | All RPC counts and RPC name lists throughout Corpus and Domain Map |

### L2: Vivian RPC Index

| Field | Value |
|-------|-------|
| **Location** | `VistA-Evolved/data/vista/vivian/rpc_index.json` |
| **Type** | Flat RPC name + package mapping |
| **What it contains** | 3,747 RPCs with package attribution |
| **Used in** | Corpus §3 (Package RPC Summary) |

### L3: RPC Coverage Map

| Field | Value |
|-------|-------|
| **Location** | `VistA-Evolved/docs/vista-alignment/rpc-coverage.json` |
| **Type** | Cross-reference map |
| **What it contains** | 76 live wired, 34 registered only, 368 stubbed, 538 CPRS gaps, mapping to CPRS Delphi extraction and Vivian |
| **Used in** | Context for tenant-admin implementation priorities |

---

## Failed/Inaccessible Sources

| Source | URL | Result | Notes |
|--------|-----|--------|-------|
| VA VDL (application pages) | `va.gov/vdl/application.asp?appid=*` | ASP template chrome only | Server-rendered pages return layout without useful content when fetched directly |
| Vivian DOX package pages | `vivian.worldvista.org/dox/Package_*.html` | "Not Found" | SPA/JavaScript-rendered — no static content accessible via direct URL fetch |
| OSEHRA | `osehra.org` | Redirect to bavida.com | OSEHRA shut down February 2020 |
| VistAPedia | `vistapedia.com` | Not Found | Domain exists but returns no content |

---

*Generated: Task 1 of queue pack "VISTA ADMIN CORPUS + TERMINAL-TO-UI TRANSLATION PROGRAM"*
*Research date: 2025-07-16*
