# Screen Inventory — VistA Evolved Platform

> **Status:** Planning / reference artifact — first pass.
> **Date:** 2026-03-17.
> **Type:** Reference inventory (not implementation authorization).
> **Scope:** Candidate surface families and screens by workspace, bridging the workspace map and screen contract schema to later permissions, pack visibility, wireframe, and screen-contract-instance work.

---

## 1. Purpose

### 1.1 What this document is

This document is a **planning-only reference inventory** of concrete and candidate surfaces across the seven canonical workspace families defined in `docs/explanation/information-architecture-workspace-map.md` (§7).

It bridges:

- The **workspace map** (artifact #6 — workspace families, boundaries, role alignment, navigation model)
- The **screen contract schema** (artifact #7 — `packages/contracts/schemas/screen-contract.schema.json`)

to the downstream artifacts that will consume it:

- Permissions matrix (future)
- Pack visibility rules (future)
- Small batches of screen-contract instances (future)
- UI wireframe and layout planning (future)

### 1.2 What this document does NOT do

- **Does not authorize implementation.** No screen, route, component, or API listed here is approved for build by this document alone.
- **Does not replace screen contracts.** Each surface listed here must eventually have a machine-readable screen contract conforming to the schema. This inventory is the planning precursor, not the contract.
- **Does not define the permissions matrix.** Role-to-surface permissions are a future artifact that consumes this inventory plus the entity model.
- **Does not define pack visibility rules.** How packs affect surface availability is governed by the pack-and-adapter spec and resolved at runtime by the capability service.
- **Does not define dashboards.** Analytics surface content is governed by analytics boundary rules (specialty-content-analytics §11).
- **Does not define exact VistA menu trees.** VistA menu/option hierarchies are VistA-internal concerns. This inventory identifies VistA anchor *types* and known anchors only where evidenced.
- **Does not make market/payer/specialty readiness claims.** Listing a surface does not mean the capability it represents is verified, claimable, or production-eligible.
- **Does not build UI.** No HTML, components, layouts, or navigation code.

### 1.3 Gap this artifact fills

The workspace map (§21) explicitly deferred "screen inventory" to post-schema work. The screen contract schema is now accepted (artifact #7). This inventory fulfills that deferred item by providing a structured first-pass enumeration of surfaces, classified by workspace, evidence posture, and implementation readiness — enabling the next bounded artifacts to proceed on solid ground.

---

## 2. Inputs consumed

This inventory consumes and aligns to the following governing artifacts:

| # | Input | Canonical location | What this inventory consumes |
|---|-------|-------------------|------------------------------|
| 1 | Global system architecture | `docs/explanation/global-system-architecture-spec.md` | Planes (§7), workspace separation (§12), CP vs TA (§13), anti-goals (§4) |
| 2 | Organization/facility model | `docs/explanation/organization-facility-network-service-model.md` | Entity types, role categories (§5.4), facility hierarchy |
| 3 | Pack/adapter governance | `docs/explanation/pack-and-adapter-architecture-governance.md` | Pack categories (§6), adapter types, eligibility rules |
| 4 | Capability truth / claim-gating | `docs/explanation/capability-truth-and-claim-gating-spec.md` | Readiness states (§7.1), claim surfaces (§10), gating rules (§11) |
| 5 | Country/payer readiness | `docs/explanation/country-and-payer-readiness-registry-spec.md` | Market readiness dimensions, launch tiers |
| 6 | Specialty/content/analytics | `docs/explanation/specialty-content-and-analytics-architecture-spec.md` | Content taxonomy, analytics boundary (§11), PHI safety (§12) |
| 7 | Information architecture / workspace map | `docs/explanation/information-architecture-workspace-map.md` | 7 workspace families (§7), role mapping (§8), navigation model (§9), transitions (§10), individual workspace definitions (§11–§16) |
| 8 | AI assist safety | `docs/explanation/ai-assist-safety-spec.md` | Assist taxonomy, write-back rules, workspace implications |
| 9 | Screen contract schema | `packages/contracts/schemas/screen-contract.schema.json` | Field names, enums, validation rules |
| 10 | Runtime truth (cross-repo) | `vista-evolved-vista-distro/docs/reference/runtime-truth.md` | Lane readiness, unverified areas |

---

## 3. Non-goals

This artifact explicitly does **NOT**:

1. Build UI, routes, components, or navigation code.
2. Define the permissions matrix (role × action × entity-context).
3. Define pack visibility rules (which packs show/hide which surfaces).
4. Define dashboards or analytics surface content.
5. Define exact VistA menu trees, option hierarchies, or roll-and-scroll screen maps.
6. Make market, payer, or specialty readiness claims.
7. Create screen-contract JSON instances (except as a future handoff).
8. Authorize implementation of any surface listed.
9. Collapse unlike workspaces (CP ≠ TA ≠ clinical ≠ ancillary).
10. Imply that presence in this inventory equals production readiness.

---

## 4. Inventory conventions and field definitions

### 4.1 Field definitions

Each inventory entry uses the following fields. Field names align to the screen contract schema where possible; planning-only fields are marked.

| Field | Schema alignment | Description |
|-------|-----------------|-------------|
| **surfaceId** | `surfaceId` | Candidate unique identifier. Follows pattern: `{workspace-family}.{area}.{surface}`. |
| **surfaceName** | `title` | Human-readable surface name. |
| **workspaceFamily** | `workspaceFamily` enum | One of the 7 families: `control-plane`, `tenant-admin`, `clinical`, `ancillary-ops`, `revenue-cycle`, `analytics-bi`, `it-integration`. |
| **workspaceName** | `workspaceName` | Specific workspace within the family if applicable. |
| **navigationLevel** | `navigationLevel` enum | `primary` or `local`. |
| **surfaceType** | `surfaceType` enum | `admin`, `clinical`, `analytics`, `content-admin`, `claim`, `operational`, `infrastructure`. |
| **primaryAudience** | Derived from `accessRequirements.allowedRoles` | Primary role categories. Uses schema enum: `platform-operator`, `tenant-admin`, `clinician`, `ancillary-staff`, `revenue-cycle-staff`, `analyst`, `it-integration`. |
| **scopePosture** | `accessRequirements.scopePosture` enum | `platform-wide`, `tenant-scoped`, `facility-scoped`, `patient-scoped`. |
| **entityContextRequired** | `accessRequirements.entityContextRequired` | Entity identifiers required (e.g., `tenantId`, `facilityId`, `patientDfn`). |
| **readWritePosture** | `readWritePosture` enum | `read-only`, `controlled-write`, `mixed`. |
| **directWriteAllowed** | `directWriteAllowed` | Whether writes to source systems are permitted. |
| **sourceOfTruth** | Derived from `dataSources[].sourceDomainClass` | Primary truth domain(s): `vista-operational-truth`, `platform-governance`, `derived-analytics`, `claim-readiness-registry`, `external-integration`. |
| **dataClassification** | `dataClassification` enum | `phi`, `de-identified`, `aggregate`, `operational`, `configuration`. |
| **claimSurface** | `claimSurface` | Whether this is a claim surface and which type. Null if not. |
| **analyticsSurface** | `analyticsSurface` | Whether this is an analytics surface. Null if not. |
| **crossWorkspaceTransitions** | `crossWorkspaceTransitions` | Declared transitions to/from other workspaces. |
| **vistaAnchorType** | *Planning-only* | Type of VistA grounding: `rpc`, `file`, `menu-option`, `package`, `global`, `none`, `unknown`. |
| **vistaAnchor** | *Planning-only* | Specific VistA anchor (e.g., RPC name, File number) — only when evidenced. |
| **presentationMode** | *Planning-only* | See §4.2. |
| **initialImplementationPosture** | *Planning-only* | See §4.3. |
| **packVariationSensitivity** | *Planning-only* | Whether this surface's content/visibility varies by country, payer, specialty, or language packs. Values: `none`, `language-only`, `country-regulatory`, `payer-specific`, `specialty-specific`, `multi-dimensional`. |
| **evidencePosture** | *Planning-only* | See §4.4. |
| **governingReferences** | *Planning-only* | Architecture specs or ADRs that govern this surface. |
| **notes** | *Planning-only* | Open questions, caveats, research needs. |

### 4.2 presentationMode values

| Value | Definition |
|-------|-----------|
| `terminal-native` | Surface is rendered as a VistA terminal session in a browser-hosted terminal emulator. The VistA roll-and-scroll interface is the primary interaction model. No platform-side GUI overlay. |
| `gui-native` | Surface is rendered as a platform-built GUI. VistA data may be consumed via API, but the interaction model is graphical, not terminal. |
| `hybrid` | Surface combines terminal and GUI elements. Example: a GUI frame with an embedded terminal panel, or a GUI form that reads VistA data and writes back through governed paths. |

**Key principle:** Classic-dense and modern-guided presentation can be a later rendering choice over the **same governed surface**, not two separate products. The screen contract governs the surface; the rendering layer is an implementation concern.

### 4.3 initialImplementationPosture values

| Value | Definition |
|-------|-----------|
| `terminal-wrap` | First implementation wraps the VistA terminal session in a browser terminal emulator. No custom GUI required. |
| `read-only-mirror` | First implementation provides a read-only GUI view of VistA data (via RPC or API). No write-back. |
| `guided-write` | First implementation provides a GUI form that writes back to VistA through governed API paths. |
| `full-replacement` | First implementation fully replaces the VistA-native interaction (typically for platform-native concerns that don't exist in VistA). |
| `deferred` | Implementation is deferred. Surface is inventoried for planning but not scheduled for near-term work. |

### 4.4 evidencePosture values

| Value | Definition |
|-------|-----------|
| `evidenced-in-current-repo-truth` | Surface existence and VistA grounding are confirmed by governing architecture specs, accepted ADRs, or verified runtime truth in the active repos. |
| `evidenced-in-read-only-salvage` | Surface was observed in the archived VistA-Evolved monorepo. The archive is reference only — not governing truth. Discovery clues are useful but must be independently verified. |
| `inferred-from-architecture` | Surface is inferred from the architecture specs (workspace definitions, entity model, pack model) but has no direct implementation evidence. |
| `research-required` | Surface is plausible but requires VistA investigation (menu options, RPCs, file numbers, package availability) before it can be concretely anchored. |

**Rules:**

- If a VistA anchor (RPC, File, menu option) is not actually evidenced in current-repo truth or verified salvage, mark it `research-required`. Do not fabricate.
- Do not convert architectural possibility into readiness claim.
- Salvage evidence does not upgrade a surface to "ready" — it provides discovery clues only.

---

## 5. Inventory methodology

### 5.1 How entries were chosen

Entries were derived from:

1. **Workspace definitions** in the information architecture workspace map (§11–§16), which enumerate primary concern areas for each workspace family.
2. **Entity model** from the organization/facility/network/service model, which identifies administrable entities (tenants, facilities, users, departments, etc.).
3. **Screen contract schema** field requirements, which demand specific workspace affiliations and surface types.
4. **Read-only salvage discovery** from the archive repo, which reveals what surfaces were prototyped. These are clues, not governing truth.
5. **VistA package knowledge** where evidenced by the distro repo's runtime truth and the archive repo's RPC registry.

### 5.2 Classification principles

- **Terminal-first.** Where a surface's primary interaction is roll-and-scroll VistA, the presentation mode is `terminal-native` and the initial posture is `terminal-wrap`. GUI-native surfaces exist only for platform-side concerns (tenancy, pack config, capability governance) that have no VistA-native counterpart.
- **One-truth-bearing runtime.** Every surface that displays clinical or operational data must declare VistA as source of truth. Platform governance data (tenants, packs, capabilities) declares platform as source of truth.
- **Workspace separation.** Each entry belongs to exactly one workspace family. No surface spans families.
- **Control-plane vs tenant-admin.** Control-plane surfaces are platform-wide, never tenant-scoped. Tenant-admin surfaces are always tenant-scoped. These are distinct workspaces per VE-PLAT-ADR-0003.
- **Pack variation is not feature readiness.** A surface marked `payer-specific` pack sensitivity does not mean payer integration is verified. It means the surface's content or visibility would vary by payer pack if payer packs were activated.
- **Country/payer/specialty variation changes visibility and content, not core architecture.** The same governed surface exists across markets — packs adjust what's visible, not whether the surface governance model applies.

---

## 6. Surface inventory — Priority Group A: Terminal / VistA foundation

These surfaces represent the terminal-first product strategy. The browser-hosted VistA terminal is the first shipping product surface.

### 6.1 Terminal shell and session

| Field | Value |
|-------|-------|
| **surfaceId** | `clinical.terminal.shell` |
| **surfaceName** | Browser Terminal Shell |
| **workspaceFamily** | `clinical` |
| **workspaceName** | terminal |
| **navigationLevel** | `primary` |
| **surfaceType** | `clinical` |
| **primaryAudience** | `clinician`, `ancillary-staff`, `tenant-admin` |
| **scopePosture** | `tenant-scoped` |
| **entityContextRequired** | `tenantId` |
| **readWritePosture** | `mixed` |
| **directWriteAllowed** | `true` (writes occur through VistA's own input handling within the terminal) |
| **sourceOfTruth** | `vista-operational-truth` |
| **dataClassification** | `phi` |
| **claimSurface** | null |
| **analyticsSurface** | null |
| **crossWorkspaceTransitions** | Outgoing: launch from tenant-admin workspace (context: `tenantId`) |
| **vistaAnchorType** | `package` |
| **vistaAnchor** | XWB RPC Broker (TCP session), Kernel sign-on |
| **presentationMode** | `terminal-native` |
| **initialImplementationPosture** | `terminal-wrap` |
| **packVariationSensitivity** | `language-only` |
| **evidencePosture** | `evidenced-in-current-repo-truth` |
| **governingReferences** | Global architecture §7.1, VE-DISTRO-ADR-0003. Distro runtime truth: UTF-8 lane 5/5 readiness. |
| **notes** | UTF-8 lane has 5/5 readiness. Browser terminal sign-on and terminal behavior are **not yet verified** per distro runtime truth. English baseline; Korean and Spanish are bounded product languages. |

### 6.2 Terminal sign-on / session establishment

| Field | Value |
|-------|-------|
| **surfaceId** | `clinical.terminal.signon` |
| **surfaceName** | VistA Sign-On |
| **workspaceFamily** | `clinical` |
| **workspaceName** | terminal |
| **navigationLevel** | `primary` |
| **surfaceType** | `clinical` |
| **primaryAudience** | `clinician`, `ancillary-staff` |
| **scopePosture** | `tenant-scoped` |
| **entityContextRequired** | `tenantId` |
| **readWritePosture** | `controlled-write` |
| **directWriteAllowed** | `true` (VistA Kernel sign-on flow) |
| **sourceOfTruth** | `vista-operational-truth` |
| **dataClassification** | `operational` |
| **claimSurface** | null |
| **analyticsSurface** | null |
| **crossWorkspaceTransitions** | none |
| **vistaAnchorType** | `rpc` |
| **vistaAnchor** | XUS SIGNON SETUP, XUS AV CODE |
| **presentationMode** | `terminal-native` |
| **initialImplementationPosture** | `terminal-wrap` |
| **packVariationSensitivity** | `language-only` |
| **evidencePosture** | `evidenced-in-current-repo-truth` |
| **governingReferences** | Global architecture §7.1, §7.2. XWB broker protocol. |
| **notes** | Sign-on RPCs are well-documented in the XWB protocol. Browser terminal sign-on under UTF-8 is not yet verified per distro runtime truth. Access/verify code authentication is VistA-native. |

### 6.3 Terminal session disconnect / timeout

| Field | Value |
|-------|-------|
| **surfaceId** | `clinical.terminal.disconnect` |
| **surfaceName** | Session Disconnect / Timeout |
| **workspaceFamily** | `clinical` |
| **workspaceName** | terminal |
| **navigationLevel** | `local` |
| **surfaceType** | `clinical` |
| **primaryAudience** | `clinician`, `ancillary-staff` |
| **scopePosture** | `tenant-scoped` |
| **entityContextRequired** | `tenantId` |
| **readWritePosture** | `controlled-write` |
| **directWriteAllowed** | `true` (BYE message to broker) |
| **sourceOfTruth** | `vista-operational-truth` |
| **dataClassification** | `operational` |
| **claimSurface** | null |
| **analyticsSurface** | null |
| **crossWorkspaceTransitions** | none |
| **vistaAnchorType** | `rpc` |
| **vistaAnchor** | #BYE# (XWB disconnect protocol) |
| **presentationMode** | `terminal-native` |
| **initialImplementationPosture** | `terminal-wrap` |
| **packVariationSensitivity** | `none` |
| **evidencePosture** | `evidenced-in-current-repo-truth` |
| **governingReferences** | XWB broker protocol. |
| **notes** | Session cleanup and timeout handling are infrastructure concerns at the terminal-wrap layer. VistA handles its own session expiry. |

### 6.4 Patient selection / context launch

| Field | Value |
|-------|-------|
| **surfaceId** | `clinical.terminal.patient-select` |
| **surfaceName** | Patient Selection (Terminal) |
| **workspaceFamily** | `clinical` |
| **workspaceName** | terminal |
| **navigationLevel** | `primary` |
| **surfaceType** | `clinical` |
| **primaryAudience** | `clinician`, `ancillary-staff` |
| **scopePosture** | `patient-scoped` |
| **entityContextRequired** | `tenantId`, `patientDfn` |
| **readWritePosture** | `read-only` |
| **directWriteAllowed** | `false` |
| **sourceOfTruth** | `vista-operational-truth` |
| **dataClassification** | `phi` |
| **claimSurface** | null |
| **analyticsSurface** | null |
| **crossWorkspaceTransitions** | none |
| **vistaAnchorType** | `rpc` |
| **vistaAnchor** | ORQPT DEFAULT PATIENT LIST, ORWPT LIST ALL (evidenced in archive RPC registry) |
| **presentationMode** | `terminal-native` |
| **initialImplementationPosture** | `terminal-wrap` |
| **packVariationSensitivity** | `none` |
| **evidencePosture** | `evidenced-in-read-only-salvage` |
| **governingReferences** | Workspace map §13 (clinical workspace). |
| **notes** | Patient lookup RPCs are well-established CPRS patterns. Specific terminal-mode patient selection menus require VistA menu-option research. |

---

## 7. Surface inventory — Priority Group B: Tenant operational admin foundation

These surfaces represent the tenant-admin workspace (`apps/admin-console/`) per VE-PLAT-ADR-0003 and workspace map §12.

### 7.1 User management

| Field | Value |
|-------|-------|
| **surfaceId** | `tenant-admin.users.list` |
| **surfaceName** | User List and Status |
| **workspaceFamily** | `tenant-admin` |
| **navigationLevel** | `primary` |
| **surfaceType** | `admin` |
| **primaryAudience** | `tenant-admin` |
| **scopePosture** | `tenant-scoped` |
| **entityContextRequired** | `tenantId` |
| **readWritePosture** | `mixed` |
| **directWriteAllowed** | `false` (platform API manages user records; VistA File 200 is read-only from platform) |
| **sourceOfTruth** | `platform-governance` (identity bridge), `vista-operational-truth` (File 200 for VistA-side user records) |
| **dataClassification** | `operational` |
| **claimSurface** | null |
| **analyticsSurface** | null |
| **crossWorkspaceTransitions** | none |
| **vistaAnchorType** | `file` |
| **vistaAnchor** | File 200 (NEW PERSON) |
| **presentationMode** | `gui-native` |
| **initialImplementationPosture** | `read-only-mirror` |
| **packVariationSensitivity** | `none` |
| **evidencePosture** | `inferred-from-architecture` |
| **governingReferences** | Workspace map §12.2, org-facility model §5.4, data-ownership-matrix. |
| **notes** | User management spans platform identity and VistA File 200. Initial posture is read-only to display VistA user status. Write operations for user provisioning require governed API contracts (future). |

### 7.2 User detail / setup

| Field | Value |
|-------|-------|
| **surfaceId** | `tenant-admin.users.detail` |
| **surfaceName** | User Detail and Setup |
| **workspaceFamily** | `tenant-admin` |
| **navigationLevel** | `local` |
| **surfaceType** | `admin` |
| **primaryAudience** | `tenant-admin` |
| **scopePosture** | `tenant-scoped` |
| **entityContextRequired** | `tenantId`, `userId` |
| **readWritePosture** | `mixed` |
| **directWriteAllowed** | `false` |
| **sourceOfTruth** | `platform-governance`, `vista-operational-truth` |
| **dataClassification** | `operational` |
| **claimSurface** | null |
| **analyticsSurface** | null |
| **crossWorkspaceTransitions** | none |
| **vistaAnchorType** | `file` |
| **vistaAnchor** | File 200 (NEW PERSON) |
| **presentationMode** | `gui-native` |
| **initialImplementationPosture** | `read-only-mirror` |
| **packVariationSensitivity** | `none` |
| **evidencePosture** | `inferred-from-architecture` |
| **governingReferences** | Workspace map §12.2, org-facility model §5.4. |
| **notes** | Keys, menu options, person class, and security keys are VistA-internal. Platform surfaces them read-only initially. Role/key assignment posture requires research into which VistA RPCs support programmatic key assignment. |

### 7.3 Roles and keys posture

| Field | Value |
|-------|-------|
| **surfaceId** | `tenant-admin.users.roles-keys` |
| **surfaceName** | Roles and Keys Posture |
| **workspaceFamily** | `tenant-admin` |
| **navigationLevel** | `local` |
| **surfaceType** | `admin` |
| **primaryAudience** | `tenant-admin` |
| **scopePosture** | `tenant-scoped` |
| **entityContextRequired** | `tenantId`, `userId` |
| **readWritePosture** | `read-only` |
| **directWriteAllowed** | `false` |
| **sourceOfTruth** | `vista-operational-truth` |
| **dataClassification** | `operational` |
| **claimSurface** | null |
| **analyticsSurface** | null |
| **crossWorkspaceTransitions** | none |
| **vistaAnchorType** | `file` |
| **vistaAnchor** | File 200 (KEYS field), File 19.1 (SECURITY KEY) |
| **presentationMode** | `gui-native` |
| **initialImplementationPosture** | `read-only-mirror` |
| **packVariationSensitivity** | `none` |
| **evidencePosture** | `research-required` |
| **governingReferences** | Workspace map §12.2. |
| **notes** | VistA keys and menu option assignments are critical for clinical authorization. RPCs for reading key assignments exist but need verification. Write-back for programmatic key assignment is `research-required`. |

### 7.4 Divisions / facilities / sites

| Field | Value |
|-------|-------|
| **surfaceId** | `tenant-admin.facilities.list` |
| **surfaceName** | Facility List and Configuration |
| **workspaceFamily** | `tenant-admin` |
| **navigationLevel** | `primary` |
| **surfaceType** | `admin` |
| **primaryAudience** | `tenant-admin` |
| **scopePosture** | `tenant-scoped` |
| **entityContextRequired** | `tenantId` |
| **readWritePosture** | `mixed` |
| **directWriteAllowed** | `false` |
| **sourceOfTruth** | `platform-governance` (tenant-facility mapping), `vista-operational-truth` (File 4 — INSTITUTION) |
| **dataClassification** | `configuration` |
| **claimSurface** | null |
| **analyticsSurface** | null |
| **crossWorkspaceTransitions** | none |
| **vistaAnchorType** | `file` |
| **vistaAnchor** | File 4 (INSTITUTION), File 40.8 (MEDICAL CENTER DIVISION) |
| **presentationMode** | `gui-native` |
| **initialImplementationPosture** | `read-only-mirror` |
| **packVariationSensitivity** | `country-regulatory` |
| **evidencePosture** | `inferred-from-architecture` |
| **governingReferences** | Workspace map §12.2, org-facility model §5.1. |
| **notes** | Facility data bridges VistA institutional files and platform tenant configuration. File 4 and File 40.8 are well-established VistA structures. |

### 7.5 Clinics

| Field | Value |
|-------|-------|
| **surfaceId** | `tenant-admin.clinics.list` |
| **surfaceName** | Clinic List and Configuration |
| **workspaceFamily** | `tenant-admin` |
| **navigationLevel** | `primary` |
| **surfaceType** | `admin` |
| **primaryAudience** | `tenant-admin` |
| **scopePosture** | `facility-scoped` |
| **entityContextRequired** | `tenantId`, `facilityId` |
| **readWritePosture** | `mixed` |
| **directWriteAllowed** | `false` |
| **sourceOfTruth** | `vista-operational-truth` |
| **dataClassification** | `configuration` |
| **claimSurface** | null |
| **analyticsSurface** | null |
| **crossWorkspaceTransitions** | none |
| **vistaAnchorType** | `file` |
| **vistaAnchor** | File 44 (HOSPITAL LOCATION) |
| **presentationMode** | `gui-native` |
| **initialImplementationPosture** | `read-only-mirror` |
| **packVariationSensitivity** | `none` |
| **evidencePosture** | `inferred-from-architecture` |
| **governingReferences** | Workspace map §12.2, org-facility model. |
| **notes** | File 44 is the canonical VistA clinic/location file. Read-only mirror is safe. Clinic creation/modification requires FileMan or approved M entry points — `research-required` for write posture. |

### 7.6 Wards / rooms / beds

| Field | Value |
|-------|-------|
| **surfaceId** | `tenant-admin.wards.list` |
| **surfaceName** | Ward, Room, and Bed Configuration |
| **workspaceFamily** | `tenant-admin` |
| **navigationLevel** | `primary` |
| **surfaceType** | `admin` |
| **primaryAudience** | `tenant-admin` |
| **scopePosture** | `facility-scoped` |
| **entityContextRequired** | `tenantId`, `facilityId` |
| **readWritePosture** | `read-only` |
| **directWriteAllowed** | `false` |
| **sourceOfTruth** | `vista-operational-truth` |
| **dataClassification** | `configuration` |
| **claimSurface** | null |
| **analyticsSurface** | null |
| **crossWorkspaceTransitions** | none |
| **vistaAnchorType** | `file` |
| **vistaAnchor** | File 42 (WARD LOCATION), File 42.4 (ROOM-BED) |
| **presentationMode** | `gui-native` |
| **initialImplementationPosture** | `read-only-mirror` |
| **packVariationSensitivity** | `none` |
| **evidencePosture** | `inferred-from-architecture` |
| **governingReferences** | Workspace map §12.2, org-facility model. |
| **notes** | Ward/room/bed configuration is VistA-native (File 42, 42.4). Read-only mirror is appropriate for initial surface. |

### 7.7 Printers / devices

| Field | Value |
|-------|-------|
| **surfaceId** | `tenant-admin.devices.list` |
| **surfaceName** | Printer and Device Defaults |
| **workspaceFamily** | `tenant-admin` |
| **navigationLevel** | `primary` |
| **surfaceType** | `admin` |
| **primaryAudience** | `tenant-admin` |
| **scopePosture** | `facility-scoped` |
| **entityContextRequired** | `tenantId`, `facilityId` |
| **readWritePosture** | `read-only` |
| **directWriteAllowed** | `false` |
| **sourceOfTruth** | `vista-operational-truth` |
| **dataClassification** | `configuration` |
| **claimSurface** | null |
| **analyticsSurface** | null |
| **crossWorkspaceTransitions** | none |
| **vistaAnchorType** | `file` |
| **vistaAnchor** | File 3.5 (DEVICE) |
| **presentationMode** | `gui-native` |
| **initialImplementationPosture** | `read-only-mirror` |
| **packVariationSensitivity** | `none` |
| **evidencePosture** | `inferred-from-architecture` |
| **governingReferences** | Workspace map §12.2. |
| **notes** | Device/printer management is VistA File 3.5. Reading device records is straightforward; write posture is `research-required`. Terminal environments use devices for output routing. |

### 7.8 Site parameters / operational defaults

| Field | Value |
|-------|-------|
| **surfaceId** | `tenant-admin.site-params.overview` |
| **surfaceName** | Site Parameters Overview |
| **workspaceFamily** | `tenant-admin` |
| **navigationLevel** | `primary` |
| **surfaceType** | `admin` |
| **primaryAudience** | `tenant-admin` |
| **scopePosture** | `facility-scoped` |
| **entityContextRequired** | `tenantId`, `facilityId` |
| **readWritePosture** | `read-only` |
| **directWriteAllowed** | `false` |
| **sourceOfTruth** | `vista-operational-truth` |
| **dataClassification** | `configuration` |
| **claimSurface** | null |
| **analyticsSurface** | null |
| **crossWorkspaceTransitions** | none |
| **vistaAnchorType** | `file` |
| **vistaAnchor** | File 8989.3 (PARAMETER DEFINITION), File 8989.5 (PARAMETER) |
| **presentationMode** | `gui-native` |
| **initialImplementationPosture** | `read-only-mirror` |
| **packVariationSensitivity** | `country-regulatory` |
| **evidencePosture** | `research-required` |
| **governingReferences** | Workspace map §12.2. |
| **notes** | VistA parameters span File 8989.3/8989.5. The breadth of site parameters is large. Which parameters surface in tenant-admin vs remain VistA-internal requires research. Initial posture is read-only overview of key operational parameters. |

### 7.9 Module enablement

| Field | Value |
|-------|-------|
| **surfaceId** | `tenant-admin.modules.enablement` |
| **surfaceName** | Module Enablement and Configuration |
| **workspaceFamily** | `tenant-admin` |
| **navigationLevel** | `primary` |
| **surfaceType** | `admin` |
| **primaryAudience** | `tenant-admin` |
| **scopePosture** | `tenant-scoped` |
| **entityContextRequired** | `tenantId` |
| **readWritePosture** | `controlled-write` |
| **directWriteAllowed** | `false` |
| **sourceOfTruth** | `platform-governance` |
| **dataClassification** | `configuration` |
| **claimSurface** | `{ claimSurfaceType: "tenant-admin-enablement", claimDomains: ["capability", "pack-eligibility"] }` |
| **analyticsSurface** | null |
| **crossWorkspaceTransitions** | none |
| **vistaAnchorType** | `none` |
| **vistaAnchor** | — (platform-native concern) |
| **presentationMode** | `gui-native` |
| **initialImplementationPosture** | `full-replacement` |
| **packVariationSensitivity** | `multi-dimensional` |
| **evidencePosture** | `inferred-from-architecture` |
| **governingReferences** | Workspace map §12.2, §12.3. Capability truth §16. Pack-adapter governance §11. |
| **notes** | Module enablement is a platform-native surface that shows eligible capabilities and allows activation. Claim surface: shows only eligible + activated; displays integration-pending where appropriate. Pack sensitivity is multi-dimensional because eligibility depends on market, payer, specialty context. |

### 7.10 Content administration entry point

| Field | Value |
|-------|-------|
| **surfaceId** | `tenant-admin.content.catalog` |
| **surfaceName** | Content Pack Catalog |
| **workspaceFamily** | `tenant-admin` |
| **navigationLevel** | `primary` |
| **surfaceType** | `content-admin` |
| **primaryAudience** | `tenant-admin` |
| **scopePosture** | `tenant-scoped` |
| **entityContextRequired** | `tenantId` |
| **readWritePosture** | `controlled-write` |
| **directWriteAllowed** | `false` |
| **sourceOfTruth** | `platform-governance` |
| **dataClassification** | `configuration` |
| **claimSurface** | null |
| **analyticsSurface** | null |
| **crossWorkspaceTransitions** | none |
| **vistaAnchorType** | `none` |
| **vistaAnchor** | — (content packs are platform-managed) |
| **presentationMode** | `gui-native` |
| **initialImplementationPosture** | `deferred` |
| **packVariationSensitivity** | `multi-dimensional` |
| **evidencePosture** | `inferred-from-architecture` |
| **governingReferences** | Workspace map §16, specialty-content-analytics §8. |
| **notes** | Content administration is a functional area within tenant-admin (workspace map §16.1). Deferred until content pack lifecycle infrastructure is built. Surfaces include: catalog view, activation, version management, audit trail. |

---

## 8. Surface inventory — Priority Group C: VistA-native admin / ops surfaces

These surfaces correspond to VistA-native administrative and operational functions that may be exposed through the browser terminal or hybrid surfaces.

### 8.1 FileMan data dictionary browser

| Field | Value |
|-------|-------|
| **surfaceId** | `it-integration.fileman.dd-browser` |
| **surfaceName** | FileMan Data Dictionary Browser |
| **workspaceFamily** | `it-integration` |
| **navigationLevel** | `primary` |
| **surfaceType** | `infrastructure` |
| **primaryAudience** | `it-integration`, `tenant-admin` |
| **scopePosture** | `tenant-scoped` |
| **entityContextRequired** | `tenantId` |
| **readWritePosture** | `read-only` |
| **directWriteAllowed** | `false` |
| **sourceOfTruth** | `vista-operational-truth` |
| **dataClassification** | `operational` |
| **claimSurface** | null |
| **analyticsSurface** | null |
| **crossWorkspaceTransitions** | none |
| **vistaAnchorType** | `menu-option` |
| **vistaAnchor** | FileMan DI options (VA FileMan menu tree) |
| **presentationMode** | `terminal-native` |
| **initialImplementationPosture** | `terminal-wrap` |
| **packVariationSensitivity** | `none` |
| **evidencePosture** | `evidenced-in-current-repo-truth` |
| **governingReferences** | Global architecture §7.1. |
| **notes** | FileMan is a core VistA subsystem. Data dictionary browsing via terminal is a well-established VistA usage pattern. Write operations (file creation/modification) exist in VistA but are extremely privileged — initial posture is read-only browse via terminal. |

### 8.2 FileMan file maintenance

| Field | Value |
|-------|-------|
| **surfaceId** | `it-integration.fileman.file-maint` |
| **surfaceName** | FileMan File Maintenance |
| **workspaceFamily** | `it-integration` |
| **navigationLevel** | `local` |
| **surfaceType** | `infrastructure` |
| **primaryAudience** | `it-integration` |
| **scopePosture** | `tenant-scoped` |
| **entityContextRequired** | `tenantId` |
| **readWritePosture** | `mixed` |
| **directWriteAllowed** | `true` (through VistA FileMan within terminal session) |
| **sourceOfTruth** | `vista-operational-truth` |
| **dataClassification** | `operational` |
| **claimSurface** | null |
| **analyticsSurface** | null |
| **crossWorkspaceTransitions** | none |
| **vistaAnchorType** | `menu-option` |
| **vistaAnchor** | FileMan DIUSER / DIEDIT options |
| **presentationMode** | `terminal-native` |
| **initialImplementationPosture** | `terminal-wrap` |
| **packVariationSensitivity** | `none` |
| **evidencePosture** | `research-required` |
| **governingReferences** | Global architecture §7.1. |
| **notes** | FileMan edit/enter operations are VistA-native. Exact menu option names for the standard FileMan utilities need verification against the live VistA instance. Only accessible to users with appropriate VistA keys. |

### 8.3 MailMan operational messaging

| Field | Value |
|-------|-------|
| **surfaceId** | `it-integration.mailman.inbox` |
| **surfaceName** | MailMan Message Inbox |
| **workspaceFamily** | `it-integration` |
| **navigationLevel** | `primary` |
| **surfaceType** | `operational` |
| **primaryAudience** | `it-integration`, `tenant-admin` |
| **scopePosture** | `tenant-scoped` |
| **entityContextRequired** | `tenantId` |
| **readWritePosture** | `mixed` |
| **directWriteAllowed** | `true` (through VistA MailMan within terminal session) |
| **sourceOfTruth** | `vista-operational-truth` |
| **dataClassification** | `operational` |
| **claimSurface** | null |
| **analyticsSurface** | null |
| **crossWorkspaceTransitions** | none |
| **vistaAnchorType** | `package` |
| **vistaAnchor** | MailMan (XM package) |
| **presentationMode** | `terminal-native` |
| **initialImplementationPosture** | `terminal-wrap` |
| **packVariationSensitivity** | `none` |
| **evidencePosture** | `evidenced-in-current-repo-truth` |
| **governingReferences** | Global architecture §7.1. |
| **notes** | MailMan is VistA's internal messaging system. Operational messages, system alerts, and interop notifications flow through MailMan. Terminal-native access is the standard interaction. |

### 8.4 TaskMan / background job status

| Field | Value |
|-------|-------|
| **surfaceId** | `it-integration.taskman.status` |
| **surfaceName** | TaskMan Job Status |
| **workspaceFamily** | `it-integration` |
| **navigationLevel** | `primary` |
| **surfaceType** | `infrastructure` |
| **primaryAudience** | `it-integration` |
| **scopePosture** | `tenant-scoped` |
| **entityContextRequired** | `tenantId` |
| **readWritePosture** | `mixed` |
| **directWriteAllowed** | `true` (task rescheduling/stopping through VistA terminal) |
| **sourceOfTruth** | `vista-operational-truth` |
| **dataClassification** | `operational` |
| **claimSurface** | null |
| **analyticsSurface** | null |
| **crossWorkspaceTransitions** | none |
| **vistaAnchorType** | `package` |
| **vistaAnchor** | TaskMan (ZTMK package, ^%ZTSK global) |
| **presentationMode** | `terminal-native` |
| **initialImplementationPosture** | `terminal-wrap` |
| **packVariationSensitivity** | `none` |
| **evidencePosture** | `evidenced-in-current-repo-truth` |
| **governingReferences** | Global architecture §7.1. |
| **notes** | TaskMan is VistA's job scheduler. Status monitoring, task rescheduling, and task management are terminal-native operations. Essential for system operations. |

### 8.5 System environment / configuration

| Field | Value |
|-------|-------|
| **surfaceId** | `it-integration.system.environment` |
| **surfaceName** | VistA System Environment |
| **workspaceFamily** | `it-integration` |
| **navigationLevel** | `primary` |
| **surfaceType** | `infrastructure` |
| **primaryAudience** | `it-integration` |
| **scopePosture** | `tenant-scoped` |
| **entityContextRequired** | `tenantId` |
| **readWritePosture** | `read-only` |
| **directWriteAllowed** | `false` |
| **sourceOfTruth** | `vista-operational-truth` |
| **dataClassification** | `operational` |
| **claimSurface** | null |
| **analyticsSurface** | null |
| **crossWorkspaceTransitions** | none |
| **vistaAnchorType** | `package` |
| **vistaAnchor** | Kernel (XU package), ZU menu options |
| **presentationMode** | `terminal-native` |
| **initialImplementationPosture** | `terminal-wrap` |
| **packVariationSensitivity** | `none` |
| **evidencePosture** | `research-required` |
| **governingReferences** | Global architecture §7.1. |
| **notes** | VistA system status, UCI configuration, volume set information, and environment details are accessible through Kernel system management menus. Exact menu option identifiers require live VistA verification. |

### 8.6 Integration / interface queue monitoring

| Field | Value |
|-------|-------|
| **surfaceId** | `it-integration.interfaces.queue-monitor` |
| **surfaceName** | Interface Queue Monitor |
| **workspaceFamily** | `it-integration` |
| **navigationLevel** | `primary` |
| **surfaceType** | `infrastructure` |
| **primaryAudience** | `it-integration` |
| **scopePosture** | `tenant-scoped` |
| **entityContextRequired** | `tenantId` |
| **readWritePosture** | `read-only` |
| **directWriteAllowed** | `false` |
| **sourceOfTruth** | `vista-operational-truth`, `external-integration` |
| **dataClassification** | `operational` |
| **claimSurface** | null |
| **analyticsSurface** | null |
| **crossWorkspaceTransitions** | none |
| **vistaAnchorType** | `package` |
| **vistaAnchor** | HL7 (HL package), HLO messaging |
| **presentationMode** | `hybrid` |
| **initialImplementationPosture** | `deferred` |
| **packVariationSensitivity** | `none` |
| **evidencePosture** | `research-required` |
| **governingReferences** | Global architecture §7.2. |
| **notes** | VistA HL7 interface monitoring is critical for integration health. Whether this surfaces as terminal-native VistA HL7 menu access or as a platform-side hybrid interface depends on integration architecture decisions. Both paths are plausible. |

### 8.7 Audit trail viewer

| Field | Value |
|-------|-------|
| **surfaceId** | `it-integration.audit.viewer` |
| **surfaceName** | System Audit Trail |
| **workspaceFamily** | `it-integration` |
| **navigationLevel** | `primary` |
| **surfaceType** | `infrastructure` |
| **primaryAudience** | `it-integration`, `tenant-admin` |
| **scopePosture** | `tenant-scoped` |
| **entityContextRequired** | `tenantId` |
| **readWritePosture** | `read-only` |
| **directWriteAllowed** | `false` |
| **sourceOfTruth** | `vista-operational-truth`, `platform-governance` |
| **dataClassification** | `operational` |
| **claimSurface** | null |
| **analyticsSurface** | null |
| **crossWorkspaceTransitions** | none |
| **vistaAnchorType** | `file` |
| **vistaAnchor** | File 1.1 (AUDIT), platform immutable-audit (future) |
| **presentationMode** | `hybrid` |
| **initialImplementationPosture** | `deferred` |
| **packVariationSensitivity** | `country-regulatory` |
| **evidencePosture** | `research-required` |
| **governingReferences** | Global architecture §7.1, AI assist safety §10 (audit requirements). |
| **notes** | Audit spans VistA File 1.1 and platform-side audit logs. A unified audit view is desirable but architecturally complex. Deferred until audit architecture decisions are made. Country/regulatory variation affects audit retention and access rules. |

---

## 9. Surface inventory — Priority Group C (continued): Control-plane surfaces

These surfaces belong to the control-plane workspace (`apps/control-plane/`) per VE-PLAT-ADR-0003 and workspace map §11.

### 9.1 Tenant lifecycle management

| Field | Value |
|-------|-------|
| **surfaceId** | `control-plane.tenants.list` |
| **surfaceName** | Tenant Registry |
| **workspaceFamily** | `control-plane` |
| **navigationLevel** | `primary` |
| **surfaceType** | `admin` |
| **primaryAudience** | `platform-operator` |
| **scopePosture** | `platform-wide` |
| **entityContextRequired** | — |
| **readWritePosture** | `mixed` |
| **directWriteAllowed** | `false` |
| **sourceOfTruth** | `platform-governance` |
| **dataClassification** | `configuration` |
| **claimSurface** | null |
| **analyticsSurface** | null |
| **crossWorkspaceTransitions** | Outgoing: drill into tenant-admin (context: `tenantId`) |
| **vistaAnchorType** | `none` |
| **vistaAnchor** | — (platform-native concern) |
| **presentationMode** | `gui-native` |
| **initialImplementationPosture** | `full-replacement` |
| **packVariationSensitivity** | `none` |
| **evidencePosture** | `inferred-from-architecture` |
| **governingReferences** | Workspace map §11.2, VE-PLAT-ADR-0003. |
| **notes** | Tenant creation, configuration, suspension, archival. Platform-only — no VistA equivalent. |

### 9.2 Legal-market / launch-tier management

| Field | Value |
|-------|-------|
| **surfaceId** | `control-plane.markets.management` |
| **surfaceName** | Legal Market and Launch Tier Management |
| **workspaceFamily** | `control-plane` |
| **navigationLevel** | `primary` |
| **surfaceType** | `admin` |
| **primaryAudience** | `platform-operator` |
| **scopePosture** | `platform-wide` |
| **entityContextRequired** | — |
| **readWritePosture** | `controlled-write` |
| **directWriteAllowed** | `false` |
| **sourceOfTruth** | `claim-readiness-registry` |
| **dataClassification** | `configuration` |
| **claimSurface** | `{ claimSurfaceType: "control-plane-provisioning", claimDomains: ["market", "capability"], informationalOnly: false }` |
| **analyticsSurface** | null |
| **crossWorkspaceTransitions** | none |
| **vistaAnchorType** | `none` |
| **vistaAnchor** | — (platform-native concern) |
| **presentationMode** | `gui-native` |
| **initialImplementationPosture** | `deferred` |
| **packVariationSensitivity** | `country-regulatory` |
| **evidencePosture** | `inferred-from-architecture` |
| **governingReferences** | Workspace map §11.2, capability truth §15, country-payer readiness spec. |
| **notes** | Surfaces market readiness dimensions and launch tiers to platform operators. Claim surface: shows full readiness detail including internal-only states. Deferred until country-payer readiness registry infrastructure exists. |

### 9.3 Pack catalog and eligibility

| Field | Value |
|-------|-------|
| **surfaceId** | `control-plane.packs.catalog` |
| **surfaceName** | Pack Catalog and Eligibility |
| **workspaceFamily** | `control-plane` |
| **navigationLevel** | `primary` |
| **surfaceType** | `admin` |
| **primaryAudience** | `platform-operator` |
| **scopePosture** | `platform-wide` |
| **entityContextRequired** | — |
| **readWritePosture** | `controlled-write` |
| **directWriteAllowed** | `false` |
| **sourceOfTruth** | `platform-governance` |
| **dataClassification** | `configuration` |
| **claimSurface** | `{ claimSurfaceType: "control-plane-provisioning", claimDomains: ["pack-eligibility", "capability"] }` |
| **analyticsSurface** | null |
| **crossWorkspaceTransitions** | none |
| **vistaAnchorType** | `none` |
| **vistaAnchor** | — (platform-native concern) |
| **presentationMode** | `gui-native` |
| **initialImplementationPosture** | `deferred` |
| **packVariationSensitivity** | `multi-dimensional` |
| **evidencePosture** | `inferred-from-architecture` |
| **governingReferences** | Workspace map §11.2, pack-adapter governance §6–§11. |
| **notes** | Platform operators manage the pack catalog, set eligibility rules, and view pack-to-capability mapping. Deferred until pack infrastructure is built. |

### 9.4 System configuration

| Field | Value |
|-------|-------|
| **surfaceId** | `control-plane.system.config` |
| **surfaceName** | Platform System Configuration |
| **workspaceFamily** | `control-plane` |
| **navigationLevel** | `primary` |
| **surfaceType** | `admin` |
| **primaryAudience** | `platform-operator` |
| **scopePosture** | `platform-wide` |
| **entityContextRequired** | — |
| **readWritePosture** | `controlled-write` |
| **directWriteAllowed** | `false` |
| **sourceOfTruth** | `platform-governance` |
| **dataClassification** | `configuration` |
| **claimSurface** | null |
| **analyticsSurface** | null |
| **crossWorkspaceTransitions** | none |
| **vistaAnchorType** | `none` |
| **vistaAnchor** | — |
| **presentationMode** | `gui-native` |
| **initialImplementationPosture** | `full-replacement` |
| **packVariationSensitivity** | `none` |
| **evidencePosture** | `inferred-from-architecture` |
| **governingReferences** | Workspace map §11.2. |
| **notes** | Platform-wide settings, deployment profiles, feature flags. Platform-native; no VistA counterpart. |

---

## 10. Surface inventory — Priority Group D: Deferred workspace families

These entries represent surface *families* within workspaces that are architecturally defined but not yet near-term implementation targets. They are inventoried at the family level to support later planning without over-detailing.

### 10.1 Clinical workspace family — candidate surface families

The clinical workspace (workspace map §13) is the most safety-critical. Individual clinical surfaces are deferred pending terminal proof, permissions matrix, and clinical sub-workspace taxonomy.

| Surface family | surfaceType | VistA anchor type | Evidence posture | Initial posture | Notes |
|---------------|-------------|-------------------|------------------|-----------------|-------|
| Cover sheet / patient summary | `clinical` | `rpc` | `evidenced-in-read-only-salvage` | `deferred` | CPRS cover sheet pattern well-known; RPCs: ORQQAL LIST, ORQQVI VITALS, ORQQPL PROBLEM LIST. Terminal-native initially. |
| Problems list | `clinical` | `rpc` | `evidenced-in-read-only-salvage` | `deferred` | ORQQPL RPCs. Read/write. VistA is SoT. |
| Allergies | `clinical` | `rpc` | `evidenced-in-read-only-salvage` | `deferred` | ORQQAL LIST, ORWDAL32 RPCs. Read/write. |
| Medications / active meds | `clinical` | `rpc` | `evidenced-in-read-only-salvage` | `deferred` | ORWPS ACTIVE and Pharmacy RPCs. Complex multi-line parsing. |
| Orders / CPOE | `clinical` | `rpc` | `evidenced-in-read-only-salvage` | `deferred` | ORWDX RPCs. Safety-critical write path. Requires LOCK/UNLOCK. |
| Clinical notes / TIU | `clinical` | `rpc` | `evidenced-in-read-only-salvage` | `deferred` | TIU RPCs. Create, sign, cosign, addendum. |
| Vitals | `clinical` | `rpc` | `evidenced-in-read-only-salvage` | `deferred` | GMV / ORQQVI RPCs. Read/write. |
| Lab results | `clinical` | `rpc` | `evidenced-in-read-only-salvage` | `deferred` | ORWLRR RPCs (interim, chart, grid). Read-only view. |
| Consults | `clinical` | `rpc` | `evidenced-in-read-only-salvage` | `deferred` | ORQQCN RPCs. Complex workflow. |
| Reports | `clinical` | `rpc` | `evidenced-in-read-only-salvage` | `deferred` | ORWRP RPCs. Read-only. |
| Surgery | `clinical` | `rpc` | `evidenced-in-read-only-salvage` | `deferred` | ORWSR RPCs. Specialized workflow. |
| Immunizations | `clinical` | `rpc` | `evidenced-in-read-only-salvage` | `deferred` | PX SAVE DATA, PXVIMM RPCs. |
| Encounters / PCE | `clinical` | `rpc` | `evidenced-in-read-only-salvage` | `deferred` | ORWPCE RPCs. Encounter data entry. |
| Clinical reminders | `clinical` | `rpc` | `research-required` | `deferred` | PXRM / ORQQPX RPCs. Complex reminder engine. |

### 10.2 Ancillary / operational workspace family — candidate surface families

| Surface family | surfaceType | VistA anchor type | Evidence posture | Initial posture | Notes |
|---------------|-------------|-------------------|------------------|-----------------|-------|
| Scheduling / appointments | `operational` | `rpc` | `research-required` | `deferred` | SDES / SDEC RPCs. Scheduling is VistA-native but SDES depth varies by sandbox. |
| Patient registration / demographics | `operational` | `file` | `research-required` | `deferred` | File 2 (PATIENT). Read-only from platform; writes require governed path. |
| Health information management | `operational` | `package` | `research-required` | `deferred` | HIM/MAS package. Complex regulatory area. |

### 10.3 Revenue cycle workspace family — candidate surface families

| Surface family | surfaceType | VistA anchor type | Evidence posture | Initial posture | Notes |
|---------------|-------------|-------------------|------------------|-----------------|-------|
| Claims management | `operational` | `package` | `research-required` | `deferred` | IB/AR packages. VistA billing data split across IB/PRCA/PCE subsystems. |
| Payer management | `operational` | `none` | `inferred-from-architecture` | `deferred` | Platform-native payer registry. Country/payer readiness spec governs. |
| Coding workbench | `operational` | `package` | `research-required` | `deferred` | ICD/CPT coding. Regulatory and licensing concerns (CPT is AMA-licensed). |
| EDI pipeline status | `operational` | `none` | `inferred-from-architecture` | `deferred` | Platform-native EDI pipeline. |

### 10.4 Analytics / BI workspace family — candidate surface families

| Surface family | surfaceType | VistA anchor type | Evidence posture | Initial posture | Notes |
|---------------|-------------|-------------------|------------------|-----------------|-------|
| Clinical quality metrics | `analytics` | `none` | `inferred-from-architecture` | `deferred` | Derived/aggregate data. No real-time clinical decisions. Per analytics boundary rules (specialty-content-analytics §11). |
| Operational analytics | `analytics` | `none` | `inferred-from-architecture` | `deferred` | Throughput, utilization, efficiency. |
| Financial analytics | `analytics` | `none` | `inferred-from-architecture` | `deferred` | Revenue cycle metrics. |
| Executive dashboards | `analytics` | `none` | `inferred-from-architecture` | `deferred` | High-level summaries for leadership. |

### 10.5 Additional deferred surface families

These workspace-level capabilities are architecturally defined but well beyond near-term scope:

| Workspace area | Surface family | Evidence posture | Notes |
|---------------|---------------|------------------|-------|
| Clinical — imaging | DICOM viewer, worklist, device registry | `research-required` | VistA Imaging (MAG package). Archive has prototypes, but VistA Rad/Nuc Med RPCs are limited in most sandboxes. |
| Clinical — telehealth | Video visit, waiting room, device check | `research-required` | Platform-side concern largely; VistA anchors minimal. |
| Clinical — e-prescribing | Prescription management | `research-required` | Complex regulatory domain. EPCS compliance varies by jurisdiction. |
| Clinical — nursing | eMAR, assessments, task lists | `research-required` | PSB (BCMA) package RPCs partially available. NURS package RPCs not available in standard sandbox. |
| Clinical — ADT | Admission, discharge, transfer | `research-required` | DGPM RPCs not registered in standard sandbox. |
| Ancillary — intake | Patient intake, triage | `research-required` | Archive has intake prototype. VistA anchors need verification. |
| IT/Integration — connector health | Integration connector status | `inferred-from-architecture` | Platform-native monitoring of adapter health. |
| IT/Integration — VistA connectivity dashboard | RPC broker health, capability probe | `evidenced-in-read-only-salvage` | Archive has RPC debug and VistA admin panels. Probe infrastructure exists. |

---

## 11. Cross-cutting notes

### 11.1 Classic-dense vs modern-guided is a rendering choice, not a product split

Per the workspace map §5 (Surface definition) and screen contract schema:

- A **surface** is governed by a screen contract that defines its data sources, access requirements, and workspace placement.
- The **rendering** of that surface — whether it presents as a dense, information-rich "classic" layout or a guided, wizard-like "modern" layout — is an implementation-layer concern.
- The screen inventory does **not** create separate "classic" and "modern" entries for the same surface. If a surface supports both presentations, that is a rendering configuration within a single governed surface, not two surfaces.
- The presentation mode field (`terminal-native`, `gui-native`, `hybrid`) describes the interaction model, not the visual density.

### 11.2 Offline and mobile concerns are future policy

- Offline access and mobile-specific surfaces are not addressed in this inventory.
- They are deferred to a future mobile/offline strategy artifact.
- When that work occurs, it should produce additional screen contract attributes (offline capability, sync model, storage requirements), not a parallel surface inventory.

### 11.3 Country/payer/specialty variation is visibility and content, not architecture

- The same governed surface models exist across markets.
- Country packs affect **what content appears** on a surface (regulatory fields, payer-specific forms, locale-specific labels) and **whether a surface is visible** (e.g., PhilHealth eClaims surfaces only visible when Philippine payer pack is active).
- Specialty packs affect **what clinical content is available** on a surface (order sets, templates, calculators) and may add specialty-specific local navigation within a workspace.
- Neither country nor specialty variation converts this inventory into a per-market or per-specialty fork. Surfaces are universal; packs configure them.

### 11.4 Terminal-native surfaces depend on distro runtime truth

- All surfaces with `presentationMode: terminal-native` depend on the VistA distro's runtime truth.
- Per distro runtime truth: UTF-8 lane has 5/5 readiness, but browser terminal sign-on and terminal behavior are **not yet verified**.
- This inventory does not claim browser terminal readiness. It inventories what surfaces would be delivered via terminal once terminal proof is complete.

---

## 12. Open research gaps

The following areas require further investigation before specific surfaces can be fully anchored to VistA:

| Area | What needs research | Priority |
|------|-------------------|----------|
| **VistA menu/option mappings** | Exact VistA menu option names and hierarchies for standard admin utilities (FileMan, Kernel, TaskMan). Which options are available in the distro builds. | High — needed for terminal-wrap surfaces. |
| **VistA RPC availability per distro lane** | Which RPCs are available in the UTF-8 lane vs the M-mode lane. Archive RPC registry (170+ RPCs) needs verification against live distro. | High — needed for clinical surface planning. |
| **User provisioning write path** | Whether VistA RPCs support programmatic creation/modification of File 200 records (users, keys, menu assignments) from the platform layer. | Medium — needed for tenant-admin user management. |
| **Site parameter surface selection** | Which of VistA's many parameters (File 8989.3/8989.5) are appropriate for tenant-admin exposure vs remain VistA-internal. | Medium — needed for site-params surface. |
| **Clinical sub-workspace taxonomy** | How to model inpatient vs outpatient vs emergency vs surgical sub-workspaces. VistA location types and patient movement model. | Medium — deferred per workspace map §13.4. |
| **CPRS / roll-and-scroll equivalence** | Detailed mapping of CPRS GUI features to VistA roll-and-scroll menu paths. Which features have terminal-native equivalents. | Medium — needed for clinical surface planning. |
| **Scheduling SDES depth** | Which SDES RPCs return useful data in the distro builds. Appointment type, availability, create/cancel workflow. | Medium — needed for scheduling surfaces. |
| **Billing/RCM VistA grounding** | IB/PRCA/PCE data availability in distro builds. Which billing RPCs return data. | Low (deferred domain). |
| **Nursing package availability** | PSB (BCMA) and NURS package RPC availability. eMAR workflow anchors. | Low (deferred domain). |
| **ADT write RPCs** | DGPM admission/discharge/transfer RPC availability. | Low (deferred domain). |
| **Specialty content anchors** | Per-specialty VistA content (order sets, templates, clinical reminders) — what exists natively vs requires pack creation. | Low (deferred, depends on specialty content architecture). |
| **Country-specific regulatory surfaces** | What country-specific regulatory fields, forms, or workflows require unique surfaces vs are handled by pack-driven content variation on existing surfaces. | Low (deferred, depends on country-payer readiness work). |

---

## 13. Handoff — next artifacts

This inventory enables and constrains the following downstream artifacts. **None are authorized by this document** — each requires explicit task authorization.

| Next artifact | What it consumes from this inventory | Scope |
|--------------|-------------------------------------|-------|
| **Permissions matrix** | Surface IDs, role audiences, scope postures, read/write postures | Maps role × surface × action × entity-context to permissions |
| **Pack visibility rules** | Surface IDs, pack variation sensitivity fields | Defines which packs show/hide/modify which surfaces |
| **Screen-contract instances (small batch)** | Complete surface entries from Priority Groups A–C | Machine-readable JSON conforming to `screen-contract.schema.json` |
| **UI wireframe / layout planning** | Surface inventory + permissions + pack visibility | Visual design of surfaces — only after terminal proof and explicit authorization |
| **Clinical sub-workspace design** | Clinical surface families from §10.1 | Detailed clinical workspace taxonomy — consumes research outputs |

The recommended next bounded prompt targets:

1. **Permissions matrix** — consumes this inventory + entity model + role categories to produce a role × surface access matrix.
2. Then **pack visibility rules** — consumes permissions matrix + pack taxonomy to produce pack → surface visibility mappings.
3. Then **small batch of screen-contract JSON instances** — converts the highest-confidence surface entries (Priority Group A terminal surfaces + Priority Group B near-term tenant-admin surfaces) into machine-readable contracts.

---

## 14. Inventory summary

| Priority group | Workspace family | Concrete entries | Deferred families | Evidence posture breakdown |
|---------------|-----------------|-----------------|-------------------|---------------------------|
| **A — Terminal/VistA foundation** | clinical (terminal) | 4 | — | 3 evidenced-in-current-repo, 1 evidenced-in-salvage |
| **B — Tenant admin foundation** | tenant-admin | 10 | — | 2 inferred, 6 inferred, 1 research-required, 1 inferred |
| **C — VistA-native admin/ops** | it-integration | 7 | — | 3 evidenced-in-current-repo, 1 research-required, 1 research-required, 1 research-required, 1 research-required |
| **C — Control-plane** | control-plane | 4 | — | 4 inferred |
| **D — Clinical (deferred)** | clinical | — | 14 families | Mostly evidenced-in-salvage (RPC registry discovery) |
| **D — Ancillary (deferred)** | ancillary-ops | — | 3 families | All research-required |
| **D — Revenue cycle (deferred)** | revenue-cycle | — | 4 families | Mostly research-required |
| **D — Analytics (deferred)** | analytics-bi | — | 4 families | All inferred |
| **D — Additional deferred** | mixed | — | 8 families | Mostly research-required |
| **Totals** | — | **25 concrete** | **33 deferred families** | — |
