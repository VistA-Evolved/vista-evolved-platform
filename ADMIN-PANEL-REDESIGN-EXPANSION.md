# ADMIN PANEL REDESIGN SPEC — EXPANSION SUPPLEMENT

> **This document SUPPLEMENTS the ADMIN-PANEL-COMPLETE-REDESIGN-SPEC.md. Read THAT document first. This adds depth, fills gaps, and adds requirements that were missing.**

---

## EXPANSION 1: DEVICES, INTEGRATIONS, AND MEDICAL EQUIPMENT

### What I Originally Left Out and Why It Matters

I said "Device Management is not needed for web UI." That was WRONG. Here's why:

**VistA's DEVICE file (#3.5)** manages system output devices — printers, terminals, host file system (HFS). In a terminal world, this controls where output goes. In a web SaaS world:

- **Printing** does NOT go through VistA's spooler anymore. When a web user clicks "Print," it uses the BROWSER'S print system, which connects to whatever printers are configured on their local machine or network. So VistA's spool device management is genuinely not needed.
- BUT: hospitals need to configure SPECIFIC printers for specific jobs — label printers for pharmacy labels, wristband printers for patient wristbands, barcode label printers for specimens. These are NETWORK printers that multiple users share. The admin needs a way to register these printers so the web app knows where to send specialized print jobs.

**Medical devices** connect to VistA through different mechanisms:
- **Lab instruments** (chemistry analyzers, hematology counters, blood gas machines) → Connect via AUTO INSTRUMENT file #62.4, using HL7 messages. Data flows: instrument reads specimen → sends HL7 result message → VistA HL7 filer processes it → result stored in LAB DATA #63.
- **Imaging devices** (CT, MRI, X-ray, ultrasound, endoscopy, ophthalmology) → Connect via DICOM protocol through a DICOM gateway. VistA has approved interfaces for **250+ specific medical devices** (GE, Siemens, Canon, Carestream, Philips, etc.).
- **Vital signs monitors** (Welch Allyn, Philips, GE) → Connect via specific interfaces that write to GMRV VITAL MEASUREMENT #120.5.
- **Barcode scanners** (BCMA medication admin, lab specimen, patient wristband) → In a web context, these connect to the browser via USB HID or Web Serial API. The browser reads the barcode and the web app processes it.

### What the Admin Panel Needs for Devices

**A new section: "Integrations & Connected Systems"**

This replaces the terminal's Device Management with something that makes sense for a cloud/web SaaS:

```
INTEGRATIONS & CONNECTED SYSTEMS
├── HL7 Interfaces
│   ├── Active interfaces with status indicators
│   ├── Message queue depths
│   ├── Error counts and last error details
│   └── Configure new HL7 connection
├── Imaging (DICOM) 
│   ├── Connected PACS systems
│   ├── DICOM gateway status
│   └── Modality worklist configuration
├── Network Printers
│   ├── Label printers (pharmacy, wristband, specimen)
│   ├── Report printers (default, by department)
│   └── Test print function
└── External Systems
    ├── Insurance eligibility check (270/271)
    ├── Prescription drug monitoring (PDMP)
    └── Health information exchange (HIE)
```

**For the current admin panel build (Wave 1):** Show HL7 Interfaces with the link list from File #870 (the server route GET /hl7-interfaces already exists with 213 routes total). Show the interface status, last message time, and error count. Add a "Network Printers" section that's initially a simple list of configured output destinations.

**For future waves:** Full DICOM gateway management, lab instrument configuration, external system integrations.

### How Medical Devices Work in a Web/Cloud Architecture

In a SaaS deployment where VistA runs in Docker in the cloud:

```
Hospital Network                          Cloud (Our SaaS)
┌─────────────────────┐                  ┌──────────────────┐
│ Lab Analyzer ─────┐ │                  │ VistA Docker     │
│ CT Scanner ───────┤ │    HL7/DICOM     │ ├── HL7 Filer    │
│ Vitals Monitor ───┤ ├──────────────────┤ ├── DICOM Store  │
│ Barcode Scanner ──┤ │    over VPN or   │ └── RPC Broker   │
│ Label Printer ────┘ │    secure tunnel │                  │
│                     │                  │ Tenant-Admin Srv │
│ User's Browser ─────┼──── HTTPS ───────┤ ├── server.mjs   │
│ (web app)           │                  │ └── Web App      │
└─────────────────────┘                  └──────────────────┘
```

The hospital installs a small **edge gateway** on their local network. This gateway:
1. Connects to local medical devices via HL7/DICOM/serial
2. Tunnels data securely to the cloud VistA instance
3. Routes print jobs from the cloud back to local network printers

This is an architecture decision we need to document but NOT build in the admin panel yet. The admin panel should have a PLACEHOLDER page: "Connected Systems — Configure local device connections using the VistA Evolved Edge Gateway (documentation link)."

---

## EXPANSION 2: SECURITY KEYS — THE DEEP TRUTH

### How VistA REALLY Handles Roles and Permissions

In VistA terminal, there are NO "roles" in the modern sense. VistA has:

1. **Security Keys** — 689 individual keys in File #19.1. Each key gates access to specific functionality. A user either holds a key or doesn't.
2. **Menu Options** — Each user is assigned a Primary Menu (field #201 in #200) that determines their top-level navigation. Menus contain options, which contain sub-options.
3. **Person Class** — Provider taxonomy (field #8932.1) that categorizes the user's professional type (Physician, Nurse Practitioner, Pharmacist, etc.)

**When a VA system manager sets up a new physician in terminal, they do this:**
1. Create the user record (name, SSN, DOB, division)
2. Assign the EVE menu (Systems Manager) or XUCORE menu (standard clinical)
3. Add the PROVIDER key
4. Add the ORES key (Order Release — allows signing orders)
5. Set Person Class to "Physician" (from taxonomy)
6. Set up Electronic Signature
7. Assign to appropriate clinics

**They do NOT select from a "Physician role template."** That concept is OUR INVENTION (VistA Evolved Addition). In the VA, each key is manually assigned. A knowledgeable ADPAC (Application Coordinator) knows which keys a physician needs.

### Our Role Templates — What They Are and Why

We created Role Templates as a MODERN UX convenience. They bundle commonly-assigned keys into named roles:

| Role Template | Bundled Keys | Who Gets This |
|---------------|-------------|--------------|
| Physician | PROVIDER, ORES, ORCL-SIGN-NOTES, ORCL-PAT-RECS | Attending physicians |
| Nurse Practitioner | PROVIDER, ORES, ORCL-SIGN-NOTES | NPs with prescriptive authority |
| Registered Nurse | ORELSE, OREMAS, ORCL-PAT-RECS | RNs |
| Staff Pharmacist | PSORPH, PSOPHARMACIST, PSOINTERFACE | Outpatient pharmacists |
| Pharmacy Technician | PSOTECH | Pharmacy techs |
| Lab Technologist | LRLAB, LRVERIFY | Lab personnel |
| Radiology Technologist | RA TECHNOLOGIST | Rad techs |
| Scheduling Clerk | SD SCHEDULING, SDCLINICAL | Schedulers |
| Registration Clerk | DG REGISTER, DGMEANS TEST | Registration |
| Billing Coder | IBCNE INSURANCE MANAGEMENT | Billing staff |
| Social Worker | (TIU note signing) | Social work |
| System Administrator | XUMGR, XUPROG, XUPROGMODE | IT/IRM staff |
| Imaging Technician | MAG CAPTURE, MAG ANNOTATE | Imaging capture |
| Health Information | MAG EDIT, TIU EDIT | HIM/Medical Records |

**These role templates are a VistA Evolved ADDITION.** They don't exist in VistA terminal. They're our way of making key assignment intuitive for non-VA administrators.

### The 689 Keys Problem — What to Show and How

The 689 security keys come from ALL installed VistA packages. Most are internal system keys that no administrator needs to see. The breakdown:

- **~50 keys** are clinically important (PROVIDER, ORES, ORELSE, pharmacy keys, lab keys, etc.)
- **~100 keys** are administratively relevant (XUMGR, DG REGISTER, SD SCHEDULING, etc.)  
- **~539 keys** are internal system keys (A1AX APVCO, ABSV MGR, etc.) that exist for package-internal access control and should be HIDDEN from normal admin view

**What the admin UI should do:**
1. Show the **Permission Catalog** with TWO views:
   - **Standard View** (default): Only show the ~150 clinically/administratively important keys, with human-readable names, grouped by department
   - **Advanced View** (toggle): Show all 689 keys for system administrators who need low-level control
2. Each permission shows:
   - **Human Name** (from File #19.1 DESCRIPTIVE NAME field 2, or our own translation if that's empty)
   - **Department** (from PACKAGE #9.4 via field 3)
   - **Description** (what this permission enables the user to do)
   - **System Reference** (collapsed: the raw key name, for advanced admins)

### Where We Need a Translation Table

Many VistA keys have NO descriptive name in field 2. For those, we need our own translation table. This should be a JSON file or a config in the web app:

```javascript
const KEY_TRANSLATIONS = {
  'PROVIDER': { name: 'Clinical Provider', desc: 'Identifies user as a healthcare provider. Required for signing orders and clinical documentation.', dept: 'Clinical' },
  'ORES': { name: 'Sign & Release Orders', desc: 'Allows signing and releasing clinical orders to pharmacy, lab, and radiology.', dept: 'Clinical' },
  'ORELSE': { name: 'Release Other\'s Orders', desc: 'Allows releasing orders written by another provider. Used by supervising physicians.', dept: 'Clinical' },
  'OREMAS': { name: 'Enter Orders for Provider', desc: 'Allows non-providers (clerks) to enter orders that require provider signature later.', dept: 'Clinical' },
  'PSORPH': { name: 'Outpatient Pharmacy', desc: 'Process outpatient prescriptions, manage medication dispensing.', dept: 'Pharmacy' },
  'PSOPHARMACIST': { name: 'Pharmacist Verification', desc: 'Verify and approve medication orders before dispensing.', dept: 'Pharmacy' },
  'LRLAB': { name: 'Laboratory Access', desc: 'Access lab results, process specimens, enter results.', dept: 'Laboratory' },
  'LRVERIFY': { name: 'Verify Lab Results', desc: 'Authorize and release laboratory test results.', dept: 'Laboratory' },
  'DG REGISTER': { name: 'Patient Registration', desc: 'Register new patients, edit demographics, manage admissions.', dept: 'Registration' },
  'SD SCHEDULING': { name: 'Scheduling', desc: 'Book, modify, and cancel patient appointments.', dept: 'Scheduling' },
  'XUMGR': { name: 'System Administrator', desc: 'Full system management access including user administration and configuration.', dept: 'System' },
  'MAG CAPTURE': { name: 'Image Capture', desc: 'Capture and store medical images from devices and cameras.', dept: 'Imaging' },
  // ... continue for all important keys
};
```

This file MUST be created and maintained. The AI coder should build it by reading the DESCRIPTIVE NAME from VistA for each key, and for any key where the VistA description is empty or unhelpful, provide a clear human translation.

---

## EXPANSION 3: SPOOLER AND PRINTING IN A WEB WORLD

### Why VistA's Spooler Doesn't Apply

VistA's spooler is a text-based output queue system. When a terminal user prints a report, it goes to VistA's spool, which then sends it to a VistA-configured device (printer). This made sense when all output was text-based and all printers were directly connected to the VistA server.

In our web SaaS world:
- **Reports** → Rendered as HTML/PDF in the browser → User clicks Print → Goes to their browser's print dialog → Prints on their locally configured printer
- **Labels** (pharmacy, specimen, wristband) → Generated as formatted HTML/PDF or ZPL (Zebra label language) → Sent to a specific network label printer
- **Forms** → Same as reports

**So we do NOT need VistA's spooler.** But we DO need:
1. A **print configuration** section where admins can register network printers for specialized jobs (label printers, wristband printers)
2. A **PDF/export** function for reports so users can save, email, or print them
3. Label format templates (pharmacy label, specimen label, wristband) that can be customized per site

For Wave 1, the admin panel should have print buttons that trigger `window.print()` for standard content and a future "Print Settings" page under System Configuration for specialized printers.

---

## EXPANSION 4: MANDATORY SELF-AUDIT PROTOCOL FOR THE AI CODER

### The Build-Check-Validate Cycle

For EVERY screen you build or modify, you MUST execute this cycle:

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  BUILD   │────→│  CHECK   │────→│ VALIDATE │────→│  VERIFY  │
│          │     │          │     │          │     │          │
│ Write the│     │ Does it  │     │ Call the │     │ Query    │
│ frontend │     │ render?  │     │ real API │     │ VistA at │
│ code     │     │ Does it  │     │ with curl│     │ M prompt │
│          │     │ look     │     │ Does it  │     │ Did data │
│          │     │ right?   │     │ return   │     │ actually │
│          │     │ Is UX    │     │ real     │     │ persist? │
│          │     │ good?    │     │ data?    │     │          │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                │                │
     │                │                │                │
     ▼ If NO at any step:                               │
     ┌──────────────────────────────────────────────────┘
     │ FIX IT. Do not move to the next feature.
     │ If the API doesn't exist, CREATE the route.
     │ If the M routine doesn't work, FIX the M code.
     │ If VistA doesn't have an RPC, WRITE one.
     │ Deploy to Docker. Test again. Repeat until PASS.
     └──────────────────────────────────────────────────
```

### The UX Self-Critique

After building each screen, ask yourself these questions. If the answer to ANY is "no," redesign before moving on:

1. **Job test:** Can the target user (hospital IT admin, clinic owner) complete their task in under 60 seconds?
2. **Jargon test:** Is there ANY text visible that a non-VistA person wouldn't understand?
3. **Empty state test:** If VistA has no data for this screen, does it show a helpful empty state (not blank, not error)?
4. **Error test:** If the VistA call fails, does the user see a clear error message (not a stack trace, not a blank page)?
5. **Persistence test:** After saving, does refreshing the page show the saved data?
6. **Navigation test:** Can the user get back to where they came from without getting lost?
7. **Competitive test:** If someone showed you this screen next to Epic's admin panel, would you be embarrassed?

### CRUD Verification Protocol

For every interactive control (button, toggle, form, dropdown):

**CREATE operations:**
```bash
# 1. Call the create API
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  http://127.0.0.1:4520/api/tenant-admin/v1/[endpoint] -d '{"field":"value"}'

# 2. Verify in VistA
docker exec -it local-vista-utf8 mumps -run %XCMD 'W $$GET1^DIQ([file],[ien]_",",[field],"E")'

# 3. Verify via GET API
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:4520/api/tenant-admin/v1/[endpoint]/[id]
```

**READ operations:**
```bash
# Call the API and verify it returns real data with source: "zve" or "vista"
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:4520/api/tenant-admin/v1/[endpoint] | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print('ok:', d.get('ok'), 'source:', d.get('source'), 'count:', len(d.get('data',[])))"
```

**UPDATE operations:**
```bash
# 1. Read the current value
# 2. Change it via PUT
# 3. Read it again — verify the value changed
# 4. Verify at M prompt — the VistA file has the new value
```

**DELETE operations:**
```bash
# 1. Verify the record exists
# 2. Delete via DELETE
# 3. Verify via GET — the record is gone
# 4. Verify at M prompt — the VistA file entry is removed
```

### The "No Excuses" Rules

These are ABSOLUTE. The AI coder must follow these without exception:

1. **NO fallback data.** If an API call fails, show an error. Do not show fake data.
2. **NO hardcoded values.** If a configuration value appears on screen, it MUST come from a VistA API call. If the API doesn't return it yet, add it to the API.
3. **NO "coming soon."** If a button exists, it must work. If it can't work yet, don't show the button.
4. **NO window.confirm() or window.alert().** Use custom modal components.
5. **NO raw VistA terminology.** Every VistA term must be translated to a human-readable equivalent.
6. **NO untested features.** Every feature must have a documented curl test proving it works.
7. **NO moving to the next screen until the current one passes ALL checks.**
8. **MAXIMAL effort.** Do not take shortcuts. Do not do the minimum. Build the best possible version of each screen. If something can be better, make it better.

---

## EXPANSION 5: DEEPER SCREEN SPECIFICATIONS

### Staff Directory — Additional Requirements

**The "200 test users" problem:** The VEHU sandbox has 200 test accounts including garbage like ATL,STUDENT repeated 7 times and system accounts like ANRVAPPLICATION,PROXY USER. The admin panel must handle this:

1. **"Hide System Accounts" toggle** (default: ON) — Filters out names containing: APPLICATION, PROXY, POSTMASTER, APITEST, TASKMAN, or names that match known VistA system account patterns
2. **Duplicate name disambiguation** — When multiple users share the same name (ATL,STUDENT × 7), show the Staff ID next to the name: "Atl, Student (S-20221)" vs "Atl, Student (S-20222)"
3. **"Sandbox Environment" indicator** — When connected to a test/sandbox VistA (PRODUCTION flag = No), show a persistent amber banner: "Test Environment — This system contains sample data"

**The detail panel must show USEFUL information:**
- If a user has Title set, show it prominently (DR. SMITH, PHYSICIAN)
- If a user has no title, derive it from their keys: has PROVIDER → "Provider", has PSORPH → "Pharmacist", has DG REGISTER → "Registration Clerk"
- Show the user's PRIMARY MENU OPTION (#201) translated: EVE → "System Manager", XUCORE → "Clinical User", OR CPRS GUI → "CPRS User"
- Show last sign-on date from SIGN-ON LOG #3.081
- Show number of assigned keys as "X permissions" with a link to view them

### Security & Authentication — Additional Requirements

**Zero-value warnings must be PROMINENT:**
When Session Timeout is 0, don't just show "0 seconds." Show:
```
┌─────────────────────────────────────────────────────┐
│ ⚠ Session Timeout: DISABLED                         │
│                                                      │
│ Sessions will never automatically expire. This is a  │
│ SECURITY RISK. Healthcare security standards require │
│ session timeouts of 15 minutes or less.              │
│                                                      │
│ Recommended: 900 seconds (15 minutes)                │
│ [Set Recommended Value]                              │
└─────────────────────────────────────────────────────┘
```

**The password expiration field:**
VistA allows 1-90 days. Show a slider or number input with:
- Visual indicator of security strength (30 days = amber, 60 = green, 90 = yellow "long")
- Industry standard reference: "HIPAA recommends 60-90 days. Some organizations require 30 days."

### System Health — Additional Requirements

**The TaskMan section when STOPPED:**
Do NOT show 15 rows of tasks with "—" for everything. Instead:

```
┌─────────────────────────────────────────────────────┐
│ ⚠ Background Tasks: STOPPED                         │
│                                                      │
│ TaskMan is not running. This means:                  │
│ • MailMan messages are not being delivered            │
│ • HL7 messages are not being processed               │
│ • Scheduled reports are not running                   │
│ • Lab results from instruments are not being filed    │
│                                                      │
│ TaskMan must be started for the system to function    │
│ properly. Contact your system administrator.          │
│                                                      │
│ 15 tasks are configured but not running.              │
│ [Show Task Details ▾]                                 │
└─────────────────────────────────────────────────────┘
```

Only when the user clicks "Show Task Details" do they see the task list. And THEN the tasks must show human names, not M routine names.

### Reports — Additional Requirements

**Permission Distribution report MUST show:**
| Permission Name | Department | Staff Assigned | Key Holders |
|----------------|-----------|---------------|-------------|
| Clinical Provider | Clinical | 18 | View List |
| Sign & Release Orders | Clinical | 12 | View List |
| Outpatient Pharmacy | Pharmacy | 12 | View List |
| ... | ... | ... | ... |

NOT:
| HOLDER COUNT | IEN |
|---|---|
| 0 | 113 |
| 0 | 112 |

If ALL holder counts are 0 (as in the VEHU sandbox), show a note: "No permissions have been assigned yet. Use the Staff Directory to assign roles to staff members."

---

## EXPANSION 6: COMPLETE DELIVERABLE CHECKLIST

When the AI coder is DONE, every item must be checked:

### Per-Screen Verification
For each of the 10 admin screens:
- [ ] Screen renders without errors
- [ ] All data comes from real VistA API calls (verified with curl)
- [ ] Zero VistA jargon visible to the user
- [ ] Zero hardcoded fake values
- [ ] Zero window.confirm/alert — all custom modals
- [ ] Empty states are helpful (not blank, not error)
- [ ] Error states show clear messages
- [ ] All interactive controls (buttons, toggles, forms) trigger real API calls
- [ ] Write operations verified with VistA M prompt readback
- [ ] Navigation to/from this screen works (no blank page bugs)
- [ ] The screen passes the "competitive test" — would not embarrass next to Epic

### Overall System Verification
- [ ] All 213 server routes respond (no 404s, no 500s for expected calls)
- [ ] All 28 M routines compile without errors in Docker
- [ ] Login → session → all admin screens → logout flow works end to end
- [ ] Permission enforcement: non-admin user cannot access admin pages
- [ ] Two-person integrity: 2P changes require second admin approval
- [ ] Audit trail: all admin actions create audit entries
- [ ] VEHU sandbox data handled gracefully (system accounts filtered, sandbox indicator shown)

### Documentation Deliverables
- [ ] AUDIT-RESULTS.md — Every curl test and M prompt verification documented
- [ ] SCREEN-BY-SCREEN-REVIEW.md — Screenshot or description of each final screen with notes
- [ ] API-VALIDATION-LOG.md — Every endpoint called with request/response logged
