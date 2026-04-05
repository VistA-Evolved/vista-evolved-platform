# VistA EVE Menu → Admin-UI Page Map

> **Purpose:** Systematic mapping of VistA's EVE (Systems Manager) menu options
> to admin-ui pages, FileMan files, and the RPCs needed to replicate each function.
>
> **Source:** VistA Kernel Technical Manual (TM), Scheduling TM, CPRS TM,
> MailMan TM, DG/Registration TM, and live VEHU Docker File 8994 probe.
>
> **Status legend:**
> - ✅ Implemented — admin-ui page exists and calls live VistA
> - 🟡 Partial — page exists but missing some fields or write operations
> - 🔲 Stub — page exists but shows integration-pending
> - ❌ Missing — no admin-ui page; SPA-only or completely absent

---

## 1. EVE Main Menu (Systems Manager Menu)

The VistA EVE main menu is the entry point for system administration.
All items are available to users holding the `XUMGR` security key.

```
EVE  Systems Manager Menu
  │
  ├─ XUSYS   User Management Menus (XU)
  ├─ XUSCL   Device Management (XU)
  ├─ XUINST  Institution Management (XU)
  ├─ XUSCH   Scheduling Configuration (SD)
  ├─ XUKERNEL  Kernel Management (XU)
  ├─ XUENV   Environment Check / TaskMan
  ├─ XMAIL   MailMan
  ├─ OR MGR  CPRS Manager Menu
  └─ XUPROG  Programmer Options (XUPROG key required)
```

---

## 2. User Management (XUSYS / File 200)

**VistA menu path:** EVE → User Management

| Menu Option | Description | FileMan File | admin-ui Page | Status | RPCs |
|---|---|---|---|---|---|
| List Users | List all users | 200 (.01, .02) | `/tenant/users` | ✅ | `ORWU NEWPERS` |
| User Detail | Full profile of a user | 200 (all fields) | `/tenant/users/[userId]` | ✅ | `DDR GETS ENTRY DATA` |
| Edit User | Edit File 200 fields | 200 | `/tenant/users/[userId]` inline edit | 🟡 | `DDR VALIDATOR`, `DDR FILER` |
| New Person | Create a new VistA user | 200 | `/tenant/users` (Create button) | 🟡 | `ZVE USMG ADD` (overlay) |
| Security Keys | Assign/remove keys | 200.051 (subfile) | `/tenant/users/[userId]` Keys panel | ✅ | `DDR LISTER 200.051`, `ZVE USMG KEYS` |
| Menu Options | Assign primary menu | 200 (field 201) | `/tenant/users/[userId]` Access group | 🔲 | `DDR FILER` |
| Electronic Sig | Set/check e-sig status | 200 (field 20.4) | `/tenant/esig` | 🟡 | `ORWU PARAM`, `ORWU HASKEY` |
| Access Audit | Query user access | 200 (audit log) | `/tenant/audit` | 🟡 | `ORWU PARAM` |
| User Clone | Copy keys/menus | 200 | ❌ Missing | ❌ | `ZVE USER CLONE` (overlay) |

**Key FileMan globals:** `^VA(200,`, `^XUSEC(`, `^XUDAT(`

---

## 3. Device Management (XUSCL / File 3.5)

**VistA menu path:** EVE → Device Management

| Menu Option | Description | FileMan File | admin-ui Page | Status | RPCs |
|---|---|---|---|---|---|
| List Devices | All terminals/printers | 3.5 (.01, 1, 3, 3.5) | `/tenant/devices` | ✅ | `DDR LISTER` |
| Device Detail | Edit a device | 3.5 (all fields) | `/tenant/devices/[ien]` | ✅ | `DDR GETS ENTRY DATA` |
| New Device | Create a terminal/printer | 3.5 | ❌ Missing | ❌ | `DDR FILER ADD` |
| Terminal Types | File 3.2 terminal type defs | 3.2 | `/tenant/terminal-types` | ✅ | `DDR LISTER` |

**Key globals:** `^%ZIS(`, `^%ZIS(1,`

---

## 4. Institution / Facility (XUINST / File 4)

**VistA menu path:** EVE → Institution Management

| Menu Option | Description | FileMan File | admin-ui Page | Status | RPCs |
|---|---|---|---|---|---|
| Institutions | List all institutions | 4 (.01, 99) | `/tenant/facilities` | ✅ | `DDR LISTER File 4` |
| Divisions | Division records | 40.8 (.01) | `/tenant/divisions` | ✅ | `XUS DIVISION GET` |
| Topology | Divisions → clinics → wards | 4, 40.8, 44, 42 | `/tenant/topology` | 🟡 | Multi-file DDR |
| Edit Facility | Edit institution fields | 4 | ❌ Missing | ❌ | `DDR FILER` |

**Key globals:** `^DIC(4,`, `^DG(40.8,`

---

## 5. Ward Management (File 42)

**VistA menu path:** EVE → Ward Management (via MAS)

| Menu Option | Description | FileMan File | admin-ui Page | Status | RPCs |
|---|---|---|---|---|---|
| List Wards | All inpatient wards | 42 (.01, 3, 4, 4.1) | `/tenant/wards` | ✅ | `DDR LISTER` |
| Ward Detail | Edit a ward | 42 (all fields) | `/tenant/wards/[ien]` | ✅ | `DDR GETS ENTRY DATA`, `DDR FILER` |
| New Ward | Create a ward | 42 | ❌ Missing | ❌ | `ZVE WARD ADD` (overlay needed) |
| Treating Specialties | File 45.7 | 45.7 | `/tenant/treating-specialties` | ✅ | `DDR LISTER` |
| Room/Bed Assign | Bed assignments | 405.4 | `/tenant/room-beds` | 🔲 | `DGPM BED ASSIGN` |

**Key globals:** `^DIC(42,`, `^DPT(`

---

## 6. Clinic Management / Hospital Locations (File 44)

**VistA menu path:** EVE → Scheduling → Clinic Setup

| Menu Option | Description | FileMan File | admin-ui Page | Status | RPCs |
|---|---|---|---|---|---|
| List Clinics | All hospital locations | 44 (.01, 1, 8, 1912) | `/tenant/clinics` | ✅ | `DDR LISTER` |
| Clinic Detail | Edit all clinic fields | 44 (all fields) | `/tenant/clinics/[ien]` | ✅ | `DDR GETS ENTRY DATA`, `DDR FILER` |
| New Clinic | Create a clinic | 44 | `/tenant/clinics` (New button) | 🟡 | `ZVE CLINIC ADD` (overlay) |
| Availability | Clinic availability slots | 409.1 | ❌ Missing | 🔲 | `SDEC FIND APPT SLOTS` |
| Inactivate | Mark clinic inactive | 44 (2505) | ❌ Missing | 🔲 | `DDR FILER` on field 2505 |
| Stop Codes | Assign DSS stop codes | 44 (8, 9) | `/tenant/clinics/[ien]` (editable) | ✅ | `DDR FILER` |
| Appointment Types | File 409.1 (appt type) | 409.1 | ❌ Missing | ❌ | `SDEC APPT TYPES`, `DDR LISTER` |

**Key globals:** `^SC(`, `^SD(`, `^SDAM(`

---

## 7. Scheduling Configuration (XUSCH / SD)

**VistA menu path:** EVE → Scheduling → Scheduling Manager Options

| Menu Option | Description | FileMan File | admin-ui Page | Status | RPCs |
|---|---|---|---|---|---|
| Appointment Types | Define appt types | 409.1 | ❌ Missing | ❌ | `SDES GET APPT TYPES` |
| Holiday Setup | Define holidays | 40.5 | ❌ Missing | ❌ | `DDR LISTER File 40.5` |
| Wait List | Wait list config | 409 | ❌ Missing | ❌ | `SDOE LIST ENCOUNTERS FOR PAT` |
| Scheduling Mode | Probe SDES capability | (probe) | `/tenant/system` (status card) | 🟡 | `SDES GET APPT TYPES` probe |

**Key globals:** `^SD(`, `^SDAM(`, `^SDEC(`

---

## 8. Kernel Site Parameters (File 8989.3)

**VistA menu path:** EVE → Kernel Management → Site Parameters

| Menu Option | Description | FileMan File | admin-ui Page | Status | RPCs |
|---|---|---|---|---|---|
| Site Name/Domain | .01, .02, .03 | 8989.3 | `/tenant/system` | ✅ | `DDR LISTER + DDR GETS ENTRY DATA` |
| Default Settings | .04, .05, 210, 230 | 8989.3 | `/tenant/system` | ✅ | same |
| Edit Param | Change a site param | 8989.3 | ❌ Missing inline edit | 🔲 | `DDR VALIDATOR`, `DDR FILER` |
| Volume Set | 501 — volume set name | 8989.3 | `/tenant/system` display | ✅ | same |

**Key globals:** `^XTV(8989.3,`

---

## 9. TaskMan (File 14.4)

**VistA menu path:** EVE → TaskMan

| Menu Option | Description | FileMan File | admin-ui Page | Status | RPCs |
|---|---|---|---|---|---|
| TaskMan Status | Active/queued tasks | 14.4 | `/tenant/taskman` | 🔲 | `XTMTASK STATUS`, `DDR LISTER` |
| Task Detail | Single task info | 14.4 | `/tenant/taskman/[ien]` (SPA only) | ❌ | `DDR GETS ENTRY DATA` |
| Start TaskMan | Start the task manager | (system call) | ❌ | ❌ | `ZTMGRSET` MUMPS direct |
| Schedule Task | Create a new task | 14.4 | ❌ | ❌ | `XTMTASK QUEUE` |

**Key globals:** `^XTMP("XM` , `^%ZTSCH(`

---

## 10. MailMan (XM / File 3.9)

**VistA menu path:** EVE → MailMan → Manager

| Menu Option | Description | FileMan File | admin-ui Page | Status | RPCs |
|---|---|---|---|---|---|
| MailMan Config | Domain, routing, users | 4.2, 4.3 | ❌ Missing | ❌ | `XMA2^XMGAPI` |
| Mail Groups | Distribution groups | 3.8 | `/tenant/mail-groups` | 🔲 | `DDR LISTER File 3.8` |
| Bulletins | System bulletins | 3.6 | `/tenant/bulletins` | 🔲 | `DDR LISTER File 3.6` |

**Key globals:** `^XMB(3.9,`, `^XMB(3.8,`

---

## 11. CPRS Manager Options (OR MGR)

**VistA menu path:** EVE → CPRS Manager Menu

| Menu Option | Description | FileMan File | admin-ui Page | Status | RPCs |
|---|---|---|---|---|---|
| Order Check | Order check params | 100.8 | `/tenant/clinical` | 🔲 | `ORWOR CATS`, `ORQQOX LIST` |
| Order Sets | Protocol-based order sets | 101 | ❌ Missing | ❌ | `ORWUL FV4DG`, `DDR LISTER 101` |
| TIU Document Classes | TIU doc defs | 8925.1 | `/tenant/clinical` (TIU tab) | 🟡 | `TIU GET DOCUMENT DEFINITION` |
| Quick Orders | Frequently-used orders | 101.41 | ❌ Missing | ❌ | `ORWDXA FINDBYNAME` |
| Patient Teams | Care team definitions | 100.21 | ❌ Missing | ❌ | `ORP TEAM LIST` |
| Notifications | Clinical notification params | 8992 | ❌ Missing | ❌ | `ORB SORT METHOD`, `ORB LIST` |

**Key globals:** `^ORD(100.8,`, `^ORD(101,`, `^TIU(8925.1,`

---

## 12. Package Management (File 9.4)

**VistA menu path:** EVE → Programmer Options → Package Management

| Menu Option | Description | FileMan File | admin-ui Page | Status | RPCs |
|---|---|---|---|---|---|
| Package List | Installed packages | 9.4 (.01) | `/tenant/packages` | 🟡 | `DDR LISTER File 9.4` |
| Package Detail | Package version/namespaces | 9.4 | `/tenant/packages/[ien]` (SPA) | ❌ | `DDR GETS ENTRY DATA` |
| RPC Status | File 8994 RPC registrations | 8994 | ❌ Missing | ❌ | `DDR LISTER File 8994` |

**Key globals:** `^DIC(9.4,`, `^XWB(8994,`

---

## 13. Security Keys Catalog (File 19.1)

**VistA menu path:** EVE → User Management → Security Keys

| Menu Option | Description | FileMan File | admin-ui Page | Status | RPCs |
|---|---|---|---|---|---|
| Key Catalog | All defined security keys | 19.1 (.01) | `/tenant/security-keys` | ✅ | `DDR LISTER File 19.1` |
| Key Inventory | Which users hold each key | 200.051 | `/tenant/audit` (key tab) | 🟡 | `DDR LISTER 200.051` |
| Assign Key | Give key to user | 200.051 | `/tenant/users/[userId]` Keys panel | ✅ | `ZVE USMG KEYS ADD` (overlay) |
| Remove Key | Revoke key from user | 200.051 | same | ✅ | `ZVE USMG KEYS DEL` (overlay) |

**Key globals:** `^DIC(19.1,`, `^VA(200,<duz>,51,`

---

## 14. Error Trap (File 3.075 / XTLK)

**VistA menu path:** EVE → Kernel Management → Error Trap

| Menu Option | Description | FileMan File | admin-ui Page | Status | RPCs |
|---|---|---|---|---|---|
| Error Log | Recent MUMPS errors | 3.075 | `/tenant/error-trap` | 🔲 | `DDR LISTER File 3.075` |

---

## 15. HL7 Interfaces (File 869.3)

**VistA menu path:** EVE → HL7 → Interface Management

| Menu Option | Description | FileMan File | admin-ui Page | Status | RPCs |
|---|---|---|---|---|---|
| HL7 List | All HL7 logical links | 870 (.01) | `/tenant/hl7` | 🟡 | `DDR LISTER File 870` |
| Link Detail | Edit an HL7 link | 870 | ❌ Missing | ❌ | `DDR GETS ENTRY DATA`, `DDR FILER` |
| Events | HL7 event monitoring | 869.3 | ❌ Missing | ❌ | `HL LISTER` |

**Key globals:** `^HLCS(870,`, `^HLB(`

---

## 16. Billing / Insurance (IB / Files 350, 357)

**VistA menu path:** EVE → IB (Integrated Billing) Manager

| Menu Option | Description | FileMan File | admin-ui Page | Status | RPCs |
|---|---|---|---|---|---|
| Insurance Companies | Insurance company data | 36 (.01) | `/tenant/insurance` | 🟡 | `DDR LISTER File 36` |
| Insurance Detail | Edit company | 36 | `/tenant/insurance/[ien]` (SPA) | ❌ | `DDR GETS ENTRY DATA` |
| Billing Params | Site billing parameters | 350.9 | `/tenant/billing` | 🔲 | `DDR GETS ENTRY DATA 350.9` |

**Key globals:** `^IB(350,`, `^DIC(36,`, `^IB(350.9,`

---

## Summary: Coverage by Domain

| Domain | Total Options | ✅ Done | 🟡 Partial | 🔲 Stub | ❌ Missing |
|---|---|---|---|---|---|
| Users (File 200) | 9 | 3 | 4 | 1 | 1 |
| Devices (File 3.5) | 4 | 2 | 0 | 0 | 2 |
| Facilities (File 4) | 4 | 2 | 1 | 0 | 1 |
| Wards (File 42) | 5 | 2 | 0 | 1 | 2 |
| Clinics (File 44) | 7 | 3 | 1 | 2 | 1 |
| Scheduling | 4 | 0 | 1 | 0 | 3 |
| Kernel Params | 4 | 3 | 0 | 1 | 0 |
| TaskMan | 4 | 0 | 0 | 1 | 3 |
| MailMan | 3 | 0 | 0 | 2 | 1 |
| CPRS Manager | 6 | 0 | 1 | 1 | 4 |
| Packages | 3 | 0 | 1 | 0 | 2 |
| Security Keys | 4 | 3 | 1 | 0 | 0 |
| Error Trap | 1 | 0 | 0 | 1 | 0 |
| HL7 | 3 | 0 | 1 | 0 | 2 |
| Billing | 3 | 0 | 1 | 1 | 1 |
| **Total** | **64** | **18** | **12** | **11** | **23** |

---

## Next Priority Pages to Build

Based on clinical/operational impact and available VistA RPCs:

1. **Appointment Types** (`/tenant/appointment-types`) — File 409.1, `SDES GET APPT TYPES`
2. **Scheduling Config** (`/tenant/scheduling`) — holiday file, availability templates
3. **TIU Config** (`/tenant/tiu-config`) — document classes and titles for notes workflow
4. **RPC Status** (`/tenant/rpc-status`) — File 8994, monitor RPC registrations
5. **Order Sets** (`/tenant/order-sets`) — File 101, CPRS ordering configuration
6. **MailMan Config** (`/tenant/mailman-config`) — domain setup, routing
7. **HL7 Detail** (`/tenant/hl7/[ien]`) — edit a specific HL7 logical link
8. **Package Detail** (`/tenant/packages/[ien]`) — view package version and namespaces

---

## FileMan Files Reference

| File # | Name | Global | Primary Use |
|---|---|---|---|
| 3.5 | DEVICE | `^%ZIS(` | Terminals, printers |
| 3.075 | ERROR TRAP | `^XTMP("XTERR"` | Error log |
| 3.8 | MAIL GROUP | `^XMB(3.8,` | MailMan groups |
| 4 | INSTITUTION | `^DIC(4,` | Facilities |
| 9.4 | PACKAGE | `^DIC(9.4,` | Installed packages |
| 19.1 | SECURITY KEY | `^DIC(19.1,` | Key definitions |
| 36 | INSURANCE CO | `^DIC(36,` | Insurance companies |
| 40.8 | DIVISION | `^DG(40.8,` | Medical center divisions |
| 42 | WARD LOCATION | `^DIC(42,` | Inpatient wards |
| 44 | HOSPITAL LOCATION | `^SC(` | Clinics |
| 45.7 | TREATING SPECIALTY | `^DIC(45.7,` | Patient treating specialties |
| 101 | PROTOCOL | `^ORD(101,` | Order sets, quick orders |
| 200 | NEW PERSON | `^VA(200,` | VistA users |
| 350.9 | IB SITE PARAMS | `^IB(350.9,` | Billing parameters |
| 409.1 | APPOINTMENT TYPE | `^SDAM(409.1,` | Scheduling appt types |
| 870 | HL LOGICAL LINK | `^HLCS(870,` | HL7 interfaces |
| 8925.1 | TIU DOCUMENT DEF | `^TIU(8925.1,` | Clinical document definitions |
| 8989.3 | KERNEL SITE PARAMS | `^XTV(8989.3,` | Site configuration |
| 8994 | REMOTE PROCEDURE | `^XWB(8994,` | RPC registrations |

---

*Generated: March 2026. Based on VistA Kernel TM v8.0, Scheduling TM 5.3,
CPRS Technical Manual v31, and live VEHU Docker probe.*
