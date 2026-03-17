# Pack Visibility Rules

> **Artifact:** `docs/reference/pack-visibility-rules.md`
> **Repo:** `vista-evolved-platform`
> **Namespace:** VE-PLAT
> **Type:** Planning-stage reference
> **Status:** Draft — pending human review
> **Date:** 2025-07-20

---

## 1. Purpose and position in the planning sequence

### 1.1 What this document is

This document defines the **first governed rules for how pack variation affects the visibility of platform surfaces**. It answers the question: given the 7 canonical pack families, the 25 concrete inventoried surfaces, the 33 deferred surface families, and the 8-step resolution-order model defined here — what is the planning-stage visibility posture for each surface?

It is a **planning-stage reference artifact**, not a resolver implementation. It produces human-readable rules that downstream artifacts (screen-contract instances, resolver logic, feature-flag schema) will consume.

### 1.2 Position in the handoff chain

| Predecessor | What it provides to this document |
|------------|----------------------------------|
| Screen inventory (`docs/reference/screen-inventory.md`) | 25 concrete surface IDs + 33 deferred families, `packVariationSensitivity` field per entry, evidence postures, scope postures |
| Permissions matrix (`docs/reference/permissions-matrix.md`) | Role × surface × action × entity-context decision matrix; 5 decision values (A/C/—/D/R); 5 critical separations |
| Pack and adapter architecture governance (`docs/explanation/pack-and-adapter-architecture-governance.md`) | 7 pack families, pack lifecycle states, attachment points, eligibility evaluation, composition and precedence, safety constraints |
| Capability truth and claim-gating spec (`docs/explanation/capability-truth-and-claim-gating-spec.md`) | 9 readiness states, 10 scope dimensions, evidence classes, claim surfaces, claim-gating rules |
| Country and payer readiness registry spec (`docs/explanation/country-and-payer-readiness-registry-spec.md`) | Market-readiness dimensions, payer readiness model, launch tiers (T0–T3), bounded-support rules |
| Specialty, content, and analytics architecture spec (`docs/explanation/specialty-content-and-analytics-architecture-spec.md`) | Specialty variation model, content taxonomy, analytics boundary, content lifecycle |

| Successor | What it consumes from this document |
|----------|-------------------------------------|
| Screen-contract instances (batch) | Visibility posture per surface, pack-family dependency declarations, resolution-order reference |
| Pack resolver specification (future) | Resolution-order model, visibility vocabulary, rule structure |
| UI wireframe / layout planning (future) | Which surfaces appear under which pack contexts |

### 1.3 What this document is NOT

| Not this | Why not |
|----------|---------|
| A resolver implementation | No code, no feature-flag wiring, no runtime evaluation engine. Rules are human-readable planning statements. |
| A permissions or RBAC document | The permissions matrix owns role × surface × action decisions. This document does not redefine, override, or replace permission outcomes. |
| A country or payer readiness claim | This document does not assert that any specific market, payer, or language is ready. It defines the *rules* by which readiness affects visibility. |
| A screen-contract instance generator | Screen-contract JSON instances are a separate downstream artifact. This document informs their `claimSurface` and `readinessDependencies` fields. |
| A pack activation or installation specification | Pack activation mechanics are defined in the pack-and-adapter governance spec §14. This document defines how activation *affects visibility*, not how activation *works*. |
| A UI, route, or API specification | No UI wireframes, no HTTP endpoints, no navigation trees. |
| Inside-VistA menu authorization | VistA menu option assignment (`XUMENU`, secondary menu options, File 19/200 key-locking) is inside-VistA behavior. This document governs platform surface visibility, not VistA internal menu trees. |

---

## 2. Inputs consumed

### 2.1 From screen inventory

| Input | What is used |
|-------|-------------|
| 25 concrete surface IDs | Each surface is assessed for pack-visibility posture |
| 33 deferred surface families | Each family is assessed at the family level |
| `packVariationSensitivity` field | The per-surface planning annotation that indicates which pack dimensions affect the surface. Values: `none`, `language-only`, `country-regulatory`, `payer-specific`, `specialty-specific`, `multi-dimensional` |
| Evidence posture | Whether the surface has real evidence, is inferred, or needs research. Affects confidence in the visibility rule. |
| Scope posture | Whether the surface is platform-wide, tenant-scoped, facility-scoped, or patient-scoped. Affects which attachment-level pack rules apply. |

### 2.2 From permissions matrix

| Input | What is used |
|-------|-------------|
| Role × surface decision values | Permissions are evaluated *before* pack visibility in the resolution order. A surface that is permission-denied for a role is not visible regardless of pack state. |
| Scope postures per surface | Confirms entity-context dimension for pack attachment evaluation |
| Research gaps | Known unresolved permission questions are inherited as research gaps in visibility rules |

### 2.3 From pack and adapter governance

| Input | What is used |
|-------|-------------|
| 7 pack families | Language, locale, regulatory, national-standards, payer, specialty/content, tenant-overlay |
| Pack attachment matrix (§9.1) | Which entity level each pack family attaches to (tenant, facility, department) |
| Pack precedence (§10.3) | When multiple packs could affect the same surface, precedence resolves |
| Pack eligibility rules (§11) | Eligibility evaluation determines whether a pack is applicable before it can affect visibility |
| Safety constraints (§20) | Packs do not create shadow data. Activation is never silent. Regulatory packs are non-deactivatable while the legal market applies. |

### 2.4 From capability truth and claim-gating

| Input | What is used |
|-------|-------------|
| 9-state readiness model | A capability's readiness state gates whether its dependent surfaces are visible. A capability at `declared` does not justify surface visibility. |
| Scope dimensions (§9) | Visibility must be scoped — a surface visible for one market/payer is not automatically visible for another |
| Claim-gating rules (§11) | No surface may present capability claims that exceed the governed readiness state |

### 2.5 From country/payer readiness registry

| Input | What is used |
|-------|-------------|
| 8 market-readiness dimensions | Market dimensions gate surfaces with `country-regulatory` or `multi-dimensional` pack variation sensitivity |
| Launch tiers T0–T3 | Market launch tier affects whether market-sensitive surfaces appear for a given tenant's legal market |
| Payer readiness model | Payer-specific surfaces are gated by per-payer readiness state |

### 2.6 From specialty/content/analytics architecture

| Input | What is used |
|-------|-------------|
| Specialty content packs | Specialty/content pack activation affects `specialty-specific` surfaces |
| Content lifecycle | Content that has not reached `published` state does not justify surface visibility |
| Analytics boundary | Analytics surfaces consume derived data; they do not affect clinical visibility |

---

## 3. Non-goals

These items are explicitly excluded from this document:

1. **No resolver code.** This document produces planning-stage rules, not a runtime resolver. A future resolver specification will consume these rules.
2. **No feature-flag schema.** Feature flags are an implementation mechanism. This document defines the *what* (visibility rules), not the *how* (flag evaluation).
3. **No auth/RBAC definitions.** The permissions matrix is the canonical source for role-based access. This document does not add, remove, or override permission decisions.
4. **No country/payer readiness claims.** This document does not declare any market or payer as ready. It defines rules for how readiness *would* affect visibility when readiness is eventually established.
5. **No new pack taxonomy families.** This document uses only the 7 canonical pack families from the pack-and-adapter governance spec §6.1. It does not invent new pack categories.
6. **No screen-contract JSON instances.** Those are a separate downstream artifact. This document informs their content but does not produce them.
7. **No UI or navigation implementation.** No wireframes, no route trees, no navigation components.
8. **No pack activation mechanics.** Activation workflows, dependency resolution, and conflict detection are defined in the pack-and-adapter governance spec §14. This document defines visibility *effects*, not activation *processes*.
9. **No inside-VistA authorization rules.** VistA menu options, security keys, and File 200 attributes are inside-VistA concerns. Platform surface visibility is a separate layer.

---

## 4. Visibility-model principles

These principles govern all visibility rules in this document. If a specific rule conflicts with a principle, the principle wins.

### 4.1 Visibility is not permission

**Visibility** answers: "Does this surface appear in the user's workspace?"
**Permission** answers: "Is this user allowed to perform this action on this surface?"

A surface may be visible but permission-denied for certain actions (read-only view for a viewer role). A surface may be permission-allowed but invisible because the required pack is not active. These are independent dimensions that compose — they do not replace each other.

The permissions matrix (§4 "Five critical separations") establishes this boundary. This document respects it.

### 4.2 Visibility is not readiness or claimability

**Visibility** answers: "Does this surface appear?"
**Readiness** answers: "Has the underlying capability been verified?"
**Claimability** answers: "May we truthfully assert this capability on a claim surface?"

A surface may be visible (the UI element exists and is navigable) while the underlying capability is at `integration-pending`. In that case, the surface must display explicit pending state — it does not silently pretend to function. Conversely, a capability may be verified but its surface is invisible because the required pack is not activated for the user's scope.

Visibility, readiness, and claimability are three independent dimensions. This document governs visibility. The capability truth spec governs readiness and claimability.

### 4.3 Visibility is not pack activation

**Visibility** answers: "Does this surface appear?"
**Pack activation** answers: "Is this pack's configuration in effect for this scope?"

Pack activation is a necessary input to some visibility rules (e.g., a payer-specific surface requires the payer pack to be active). But activation alone does not determine visibility — workspace boundary, permissions, readiness, and other factors also contribute. This document defines how activation participates in the visibility resolution, not what activation means.

### 4.4 Platform surface visibility is not inside-VistA menu authorization

VistA has its own access control model: security keys (File 8989.3), menu options (File 19), secondary menu options (File 200), and CPRS GUI context switching. These are **inside-VistA** authorization concerns.

Platform surface visibility is a **separate layer** that governs which surfaces the platform workspace presents. A terminal-native surface wraps VistA roll-and-scroll interaction — but whether the user can access specific VistA menu options once inside the terminal is a VistA-internal concern, not a platform visibility concern.

When a platform surface wraps VistA terminal interaction, the platform makes the surface visible based on platform rules. VistA then independently enforces its own menu/key authorization. If VistA denies access, the terminal displays VistA's own error/denial — the platform does not duplicate or pre-empt VistA's security model.

### 4.5 Surfaces with `packVariationSensitivity: none` are not pack-governed

If the screen inventory marks a surface as `packVariationSensitivity: none`, then no pack family affects that surface's visibility. It is governed by workspace membership, permissions, and other non-pack factors only. This document records that fact but does not invent pack dependencies where none exist.

### 4.6 Uncertainty is stated, not assumed away

When the correct visibility rule is uncertain, this document uses `deferred` or `research-required` as the visibility posture. It does not guess. A `deferred` or `research-required` posture is a legitimate planning outcome that signals "more input needed before this rule is final."

---

## 5. Vocabulary and conventions

### 5.1 Visibility values

| Value | Meaning | When to use |
|-------|---------|-------------|
| `base-visible` | The surface is visible in its workspace by default, regardless of pack state. Packs do not gate its appearance. | Surfaces whose function is pack-independent: platform governance, infrastructure, VistA-native admin. |
| `conditionally-visible` | The surface is visible only when specific conditions are met: a pack is active, a capability is at a minimum readiness state, a configuration flag is set, or tenant context matches. The condition is stated in the rule. | Surfaces that depend on pack activation, market readiness, or configuration posture. |
| `hidden-by-default` | The surface exists in the system but is not shown unless explicitly enabled by operator action, pack activation, or configuration. The enablement path is stated in the rule. | Surfaces for advanced, optional, or market-specific functionality that most tenants would not see. |
| `suppressed` | The surface is actively suppressed and must not be shown. Suppression overrides all other visibility factors. Used for safety, regulatory, or governance reasons. | Surfaces that are dangerous to expose in current state, or that violate a regulatory constraint. |
| `deferred` | The visibility rule is not yet determined. The surface is inventoried but its pack-visibility posture requires further planning. | Deferred surface families where pack interaction is architecturally plausible but not yet analyzed. |
| `research-required` | The visibility rule requires research or evidence that is not yet available. A specific research question is stated. | Surfaces where the rule depends on VistA investigation, regulatory analysis, or pack design that has not been completed. |

### 5.2 Conditions notation

When a visibility posture is `conditionally-visible` or `hidden-by-default`, the condition is stated using this notation:

| Notation | Meaning |
|----------|---------|
| `WHEN pack:<family> IS active AT <scope>` | The named pack family must have an activated instance at the specified scope (tenant, facility, department) |
| `WHEN capability:<name> IS AT LEAST <state>` | The named capability must have reached at least the specified readiness state |
| `WHEN market:<dimension> IS AT LEAST <state>` | The named market-readiness dimension must be at the specified state for the tenant's legal market |
| `WHEN config:<key> IS <value>` | A platform configuration key must have the specified value |
| `WHEN tenant.legalMarket IS <iso2>` | The tenant is operating in the specified legal market |

Conditions may be combined with `AND` (all must be true) or `OR` (any may be true). When conditions compose, they are listed in resolution order (§6).

### 5.3 Surface ID conventions

Surface IDs follow the format established in the screen inventory: `<workspace>.<area>.<surface>` for concrete surfaces (e.g., `control-plane.packs.catalog`). Deferred surface families are referenced by their family name as listed in screen inventory §10 (e.g., "Claims management family").

---

## 6. Resolution order and precedence

When determining a surface's visibility posture, the following 8-step resolution model applies. Steps are evaluated in order. Early steps may terminate evaluation (e.g., if the surface does not exist, no further steps are needed).

### 6.1 Resolution steps

| Step | Gate | Question | If NO | If YES |
|------|------|----------|-------|--------|
| **1. Surface existence** | Inventory gate | Is this surface inventoried in the screen inventory? | Surface does not exist; no visibility posture. | Proceed to step 2. |
| **2. Workspace boundary** | Boundary gate | Does the user's current workspace include this surface's workspace family? | Surface is invisible (wrong workspace). | Proceed to step 3. |
| **3. Permission posture** | Permission gate | Does the permissions matrix grant the user's role at least one non-denied action on this surface? | Surface is invisible for this role (permission-denied). This is a permissions matrix concern, not a pack rule. | Proceed to step 4. |
| **4. Hard suppressors** | Safety gate | Are there any active suppressors (safety, regulatory, governance) that override all other visibility? | No suppressor; proceed to step 5. | Surface is `suppressed`. Evaluation terminates. |
| **5. Capability readiness** | Readiness gate | If this surface depends on a capability, has that capability reached a minimum readiness state for the user's scope? | If readiness is a precondition and is not met: surface display is `integration-pending` (visible but explicitly non-functional). If readiness is not a precondition for visibility: proceed to step 6. | Proceed to step 6. |
| **6. Market / legal / payer applicability** | Market gate | If this surface has `packVariationSensitivity` of `country-regulatory`, `payer-specific`, or `multi-dimensional`: does the tenant's legal-market context and payer context make this surface applicable? | Surface is `hidden-by-default` (not applicable to this market/payer). | Proceed to step 7. |
| **7. Pack family applicability and activation** | Pack gate | If this surface depends on a pack family being active: is the required pack active at the appropriate scope for this user? | Surface is `hidden-by-default` (pack not active). | Proceed to step 8. |
| **8. Final visibility posture** | Composition | All gates passed. Compose the final posture from the surviving visibility value. | — | Surface's governed visibility posture applies: `base-visible`, `conditionally-visible`, or `hidden-by-default` as determined by the composition of preceding gates. |

### 6.2 Key resolution properties

1. **Steps 1–4 can only deny or suppress.** They cannot make a surface visible that would otherwise be hidden. They are elimination gates.
2. **Steps 5–7 can constrain visibility.** They apply conditions or hide surfaces that fail market, readiness, or pack gates.
3. **Step 8 produces the final posture.** If a surface passes all gates without constraint, it takes its default visibility posture from this document's rules table (§8).
4. **Earlier steps take precedence.** A surface suppressed at step 4 is not visible regardless of what step 7 would say. Permission denial at step 3 prevents pack-visibility evaluation at step 7.
5. **Pack visibility never overrides permission.** If the permissions matrix denies a surface for a role, no pack activation makes it visible. The pack gate (step 7) is downstream of the permission gate (step 3).
6. **Pack visibility never overrides safety suppressors.** If governance suppresses a surface, no pack activation lifts the suppression. The safety gate (step 4) is upstream of the pack gate (step 7).
7. **Resolution is deterministic.** Given the same inputs (inventory, workspace, role, suppressors, readiness, market/payer context, pack state), the resolution always produces the same visibility posture.

---

## 7. Methodology

### 7.1 How visibility postures were assigned

For each of the 25 concrete surfaces and 33 deferred families, the following method was applied:

1. **Read the surface's `packVariationSensitivity` value** from the screen inventory.
2. **If `none`:** The surface is `base-visible` with respect to pack rules. Packs do not gate it. Record the posture and stop.
3. **If any non-`none` value:** Identify which pack families are relevant (from the sensitivity value). Determine whether the surface requires pack activation to be visible, or whether the pack merely affects the surface's *content* (what appears on it) without affecting *visibility* (whether it appears at all).
4. **Distinguish content-variation from visibility-variation.** A surface where language packs affect string labels but the surface always appears is `base-visible` with content variation — not `conditionally-visible`. A surface that should only appear when a specific payer pack is active is `conditionally-visible`.
5. **For deferred families:** Assign `deferred` or `research-required` as the visibility posture. Add a research note if needed. Do not over-specify.
6. **Cross-check against permissions matrix.** Ensure the visibility rule does not contradict or duplicate a permissions decision.
7. **Cross-check against capability truth.** Ensure the visibility rule does not assert readiness that has not been established.

### 7.2 Confidence levels

| Confidence | Meaning |
|-----------|---------|
| **High** | Rule is directly supported by inventory data, pack governance spec, and existing architecture. No open questions. |
| **Medium** | Rule is reasonable based on current architecture but depends on assumptions that have not been independently verified (e.g., exact scope of a pack family's applicability). |
| **Low** | Rule requires research or evidence not yet available. Posture is `deferred` or `research-required`. |

---

## 8. Pack-visibility rules by workspace

### 8.1 Workspace A — Control-plane surfaces

Control-plane surfaces serve platform operators managing the enterprise. They govern tenants, markets, packs, and system-wide configuration. Most are pack-independent governance tools. The pack *catalog* itself is a governance surface — it displays pack state, it does not depend on pack activation to be visible.

| Surface ID | packVariationSensitivity | Visibility posture | Condition (if any) | Confidence | Notes |
|-----------|-------------------------|-------------------|-------------------|------------|-------|
| `control-plane.tenants.list` | `none` | `base-visible` | — | High | Tenant management is a governance function. No pack gates it. |
| `control-plane.markets.management` | `country-regulatory` | `base-visible` | — | High | Content variation: market definitions include regulatory context, country codes, and market-level compliance requirements. But the surface always appears for platform-operator roles — operators must see all markets regardless of regulatory pack state. |
| `control-plane.packs.catalog` | `multi-dimensional` | `base-visible` | — | High | The pack catalog is the governance surface for managing packs. It displays packs across all dimensions (language, regulatory, specialty, payer). It must always be visible to platform operators regardless of which packs are active. Content varies by dimension — visibility does not. |
| `control-plane.system.config` | `none` | `base-visible` | — | High | System configuration is infrastructure governance. Completely pack-independent. |

**Workspace A summary:** All 4 control-plane surfaces are `base-visible`. No pack family gates control-plane surface visibility. Two surfaces have `country-regulatory` or `multi-dimensional` sensitivity — this means their *content* (which markets are shown, which packs are displayed, which compliance contexts apply) varies by pack dimension. But the surfaces themselves are always visible to platform operators.

**Rationale:** Control-plane surfaces are platform-operator governance tools. Making them conditionally visible based on pack state would undermine the operator's ability to manage packs in the first place — the operator needs to see the pack catalog to activate packs, and must see market management to manage markets regardless of regulatory pack state.

### 8.2 Workspace B — Tenant-admin surfaces

Tenant-admin surfaces serve site administrators managing their tenant's users, facilities, modules, and operational configuration. Most are baseline operational surfaces that should be visible regardless of pack state. Content-sensitive admin entry points (content catalog, site parameters with regulatory fields) may vary based on active packs, but this is content variation within a visible surface, not visibility gating.

| Surface ID | packVariationSensitivity | Visibility posture | Condition (if any) | Confidence | Notes |
|-----------|-------------------------|-------------------|-------------------|------------|-------|
| `tenant-admin.users.list` | `none` | `base-visible` | — | High | User management is baseline admin. |
| `tenant-admin.users.detail` | `none` | `base-visible` | — | High | User detail/editing is baseline admin. |
| `tenant-admin.users.roles-keys` | `none` | `base-visible` | — | High | Role/key assignment is baseline admin. |
| `tenant-admin.facilities.list` | `country-regulatory` | `base-visible` | — | Medium | Facility management is baseline admin. Country-regulatory sensitivity means *content* varies by market (facility regulatory fields, compliance labels, required attributes differ by jurisdiction) — but the surface itself is always visible for tenant-admin roles. Content variation, not visibility gating. |
| `tenant-admin.clinics.list` | `none` | `base-visible` | — | High | Clinic directory is baseline admin. |
| `tenant-admin.wards.list` | `none` | `base-visible` | — | High | Ward management is baseline admin. |
| `tenant-admin.devices.list` | `none` | `base-visible` | — | High | Device management is baseline admin. Completely pack-independent. |
| `tenant-admin.site-params.overview` | `country-regulatory` | `base-visible` | — | Medium | Site parameters overview is always visible. Country-regulatory sensitivity means which site parameters are mandatory or relevant varies by market — but the surface itself is always visible for tenant-admin roles. Content variation, not visibility gating. |
| `tenant-admin.modules.enablement` | `multi-dimensional` | `base-visible` | — | Medium | Module enablement is always visible. Multi-dimensional sensitivity means which modules are *eligible* for enablement varies across multiple dimensions (market, specialty, payer availability). But the enablement surface itself is always visible. Eligibility gating is handled inside the surface logic, not at the surface-visibility level. |
| `tenant-admin.content.catalog` | `multi-dimensional` | `conditionally-visible` | `WHEN capability:content-management IS AT LEAST implemented` | Medium | The content catalog displays specialty/content packs, templates, order sets, and clinical content available for the tenant. If no content management capability exists (no content packs published, no content pipeline), this surface has nothing to display. It becomes visible when the content management capability is at least `implemented`. The content shown varies by active specialty, market, and language packs — this is content variation within the surface once visible. |

**Workspace B summary:** 9 of 10 tenant-admin surfaces are `base-visible`. One (`tenant-admin.content.catalog`) is `conditionally-visible` based on content management capability readiness. Four surfaces have `country-regulatory` or `multi-dimensional` pack variation sensitivity — in all cases, the sensitivity affects *content within the surface* (what fields, what options, what eligibility constraints), not *surface visibility*.

**Rationale:** Tenant administrators need a stable, predictable admin workspace. Hiding core admin surfaces based on pack state would create a confusing experience where the admin dashboard changes shape as packs are activated. Instead, the surfaces are always present, and pack state affects what options/content appear *within* each surface.

### 8.3 Workspace C — Clinical terminal surfaces

Clinical terminal surfaces provide the browser-mediated VistA roll-and-scroll experience. These surfaces are governed by product phase, runtime lane readiness, and tenant enablement — not by specialty or country packs. The critical principle: **pack families do not gate terminal surface visibility**. Specialty packs and language packs affect what the user experiences *inside* VistA (which menus are available, which language prompts appear), but the terminal surface itself is either visible or not based on infrastructure and enablement posture.

| Surface ID | packVariationSensitivity | Visibility posture | Condition (if any) | Confidence | Notes |
|-----------|-------------------------|-------------------|-------------------|------------|-------|
| `clinical.terminal.shell` | `language-only` | `conditionally-visible` | `WHEN config:terminalEnabled IS true AND capability:browser-terminal IS AT LEAST validated` | High | Terminal shell visibility is governed by product phase and tenant enablement, not packs. Language-only sensitivity means VistA prompt language varies based on language pack / VistA kernel locale — this is content variation inside the terminal, not visibility gating. The terminal must be explicitly enabled, and the browser-terminal capability must have passed at least validation (tested against live VistA). Per screen inventory: terminal-native surfaces depend on distro runtime truth. |
| `clinical.terminal.signon` | `language-only` | `conditionally-visible` | `WHEN clinical.terminal.shell IS visible` | High | Sign-on is a child of the terminal shell. It is visible if and only if the shell is visible. Language-only sensitivity affects VistA sign-on prompt language, not visibility. |
| `clinical.terminal.disconnect` | `none` | `conditionally-visible` | `WHEN clinical.terminal.shell IS visible` | High | Disconnect is a child of the terminal shell. Same conditions. |
| `clinical.terminal.patient-select` | `none` | `conditionally-visible` | `WHEN clinical.terminal.shell IS visible` | High | Patient select is a child of the terminal shell. Same conditions. |

**Workspace C summary:** All 4 clinical terminal surfaces are `conditionally-visible`, conditioned on terminal enablement and capability readiness — not on any pack family. Two have `language-only` sensitivity (shell, signon) and two have `none` (disconnect, patient-select). Language packs affect VistA terminal prompt language (content), not terminal surface visibility.

**Rationale:** The terminal is a delivery mechanism, not a content surface. Specialty packs affect what clinical content a user works with inside VistA (order sets, templates, menus). Language packs affect what language VistA prompts display. But the *terminal surface itself* is either available or not based on whether the browser terminal capability is ready and enabled. Once inside the terminal, VistA's own menu and security model takes over.

**Critical distinction:** Browser terminal surface visibility (platform concern, governed here) is separate from inside-VistA menu availability (VistA concern, governed by VistA File 19/200 and security keys). A user may have the terminal surface visible but be denied specific VistA menu options by VistA's own access control. This document does not attempt to pre-empt or duplicate VistA's internal authorization.

### 8.4 Workspace D — IT/integration surfaces

IT/integration surfaces serve IT administrators and integration engineers managing VistA connectivity, data dictionary browsing, messaging, and system monitoring. Most are VistA-native admin utilities that are pack-independent.

| Surface ID | packVariationSensitivity | Visibility posture | Condition (if any) | Confidence | Notes |
|-----------|-------------------------|-------------------|-------------------|------------|-------|
| `it-integration.fileman.dd-browser` | `none` | `base-visible` | — | High | FileMan data dictionary browsing is a VistA-native admin utility. Completely pack-independent. |
| `it-integration.fileman.file-maint` | `none` | `base-visible` | — | High | FileMan file maintenance is a VistA-native admin utility. |
| `it-integration.mailman.inbox` | `none` | `base-visible` | — | High | MailMan is a VistA-native messaging utility. |
| `it-integration.taskman.status` | `none` | `base-visible` | — | High | TaskMan is a VistA-native job scheduler viewer. |
| `it-integration.system.environment` | `none` | `base-visible` | — | High | System environment display is infrastructure monitoring. |
| `it-integration.interfaces.queue-monitor` | `none` | `base-visible` | — | High | The interface queue monitor is a baseline IT monitoring tool. Completely pack-independent. When no interfaces are configured, the queue is empty — the surface is still visible and displays its empty state. |
| `it-integration.audit.viewer` | `country-regulatory` | `base-visible` | — | Medium | The audit viewer surface is always visible for IT/admin roles. Country-regulatory sensitivity means audit *content* varies by regulatory requirements (which audit categories are mandatory, which retention policies apply) — but the viewer itself is a governance tool that must always be accessible. Parallel reasoning to the control-plane pack catalog: you cannot audit what you cannot see. |

**Workspace D summary:** All 7 IT/integration surfaces are `base-visible`. One surface (`it-integration.audit.viewer`) has `country-regulatory` sensitivity — this affects audit content (which regulatory categories apply), not surface visibility. The remaining 6 surfaces have `none` sensitivity and are completely pack-independent.

### 8.5 Workspace E — Deferred surface families

Deferred surface families from screen inventory §10 are assessed at the family level. Individual surface-level visibility rules will be defined when these families are promoted to concrete surface entries.

#### 8.5.1 Clinical workspace family — deferred surfaces

| Surface family | packVariationSensitivity (assessed) | Visibility posture | Pack-family interactions (planning) | Confidence | Notes |
|---------------|-------------------------------------|--------------------|-------------------------------------|------------|-------|
| Cover sheet / patient summary | `multi-dimensional` | `deferred` | Language: content labels. Specialty: which summary sections appear. Regulatory: which fields are mandatory. But the surface existence is governed by clinical capability, not packs. | Low | Pack interaction is content-level. Visibility-level rules await clinical workspace detailed design. |
| Problems list | `language-only` | `deferred` | Language: labels and display strings. Problems as a clinical concept is universal across markets and specialties. | Low | Likely `base-visible` within clinical workspace once that workspace exists. |
| Allergies | `language-only` | `deferred` | Language: labels. Allergies are universal. | Low | Likely `base-visible` within clinical workspace. |
| Medications / active meds | `multi-dimensional` | `deferred` | Language: labels. Regulatory: drug scheduling, formulary rules vary by market. Specialty: specialty-specific medication protocols. But med list visibility is universal. | Low | Likely `base-visible` with significant content variation by market/regulatory/specialty. |
| Orders / CPOE | `multi-dimensional` | `deferred` | Specialty: order sets vary by specialty. Regulatory: ordering rules vary by market. Payer: prior-auth requirements vary by payer. CPOE surface itself is universal; content is heavily pack-driven. | Low | Likely `base-visible` with the most extensive content variation of any clinical surface. |
| Clinical notes / TIU | `specialty-specific` | `deferred` | Specialty: note templates, documentation requirements, structured data capture vary by specialty. Base note entry is universal. | Low | Likely `base-visible` with specialty content variation. |
| Vitals | `language-only` | `deferred` | Language: labels and unit labels. Vitals concept is universal. | Low | Likely `base-visible` within clinical workspace. |
| Lab results | `language-only` | `deferred` | Language: labels. Lab results display is universal. | Low | Likely `base-visible` within clinical workspace. |
| Consults | `specialty-specific` | `deferred` | Specialty: consult types, routing, and available specialties vary. Base consult workflow is universal. | Low | Likely `base-visible` with specialty-driven content. |
| Reports | `language-only` | `deferred` | Language: report labels. Report framework is universal. | Low | Likely `base-visible`. |
| Surgery | `specialty-specific` | `deferred` | Specialty: surgery-specific workflow. Could be `conditionally-visible` if surgery capability requires a surgical specialty pack. | Low | `research-required` — need to determine whether surgery surfaces should be hidden when no surgical specialty pack is active, or always visible with integration-pending state. |
| Immunizations | `country-regulatory` | `deferred` | Regulatory: immunization schedules, reporting requirements vary by jurisdicton. Base immunization recording is universal. | Low | Likely `base-visible` with regulatory content variation. |
| Encounters / PCE | `multi-dimensional` | `deferred` | Specialty, regulatory, payer: encounter data capture varies extensively. Base encounter framework is universal. | Low | Likely `base-visible` with heavy content variation. |
| Clinical reminders | `multi-dimensional` | `research-required` | Specialty, regulatory: which reminders fire, which are mandatory. The reminder engine is VistA-native (PXRM). Platform visibility rules are unclear. | Low | Research: how does the VistA reminder engine interact with platform pack-driven content? |

#### 8.5.2 Ancillary / operational workspace family — deferred surfaces

| Surface family | packVariationSensitivity (assessed) | Visibility posture | Pack-family interactions (planning) | Confidence | Notes |
|---------------|-------------------------------------|--------------------|-------------------------------------|------------|-------|
| Scheduling / appointments | `multi-dimensional` | `deferred` | Language: labels. Regulatory: appointment-related rules. Specialty: appointment types vary by specialty. The scheduling surface itself is universal. | Low | Likely `base-visible` within operational workspace. |
| Patient registration / demographics | `country-regulatory` | `deferred` | Regulatory: required demographic fields and identifier formats vary by market (SSN in US, PhilHealth PIN in PH, resident registration number in KR). National-standards: identifier format rules come from standards packs. | Low | Likely `base-visible` with significant content/field variation by market. |
| Health information management | `country-regulatory` | `research-required` | Regulatory: HIM requirements vary significantly by market. This may be a candidate for `conditionally-visible` based on regulatory pack activation. | Low | Research: does HIM merit its own visibility gate, or is it always visible with regulatory content variation? |

#### 8.5.3 Revenue-cycle workspace family — deferred surfaces

| Surface family | packVariationSensitivity (assessed) | Visibility posture | Pack-family interactions (planning) | Confidence | Notes |
|---------------|-------------------------------------|--------------------|-------------------------------------|------------|-------|
| Claims management | `payer-specific` | `deferred` | Payer: claims management is heavily payer-dependent. Surface may be `conditionally-visible` when at least one payer pack is active for the tenant. Without any payer pack, claims management has nothing to manage. | Low | Strong candidate for `conditionally-visible` WHEN `pack:payer IS active AT tenant`. |
| Payer management | `payer-specific` | `deferred` | Payer: the payer management surface displays and configures payer relationships. May need to be visible even before payer packs are active (to manage payer registration). | Low | Research: should payer management be visible before any payer pack is active (for setup purposes), or only after? |
| Coding workbench | `multi-dimensional` | `deferred` | Regulatory, national-standards: code sets vary by market. Payer: coding requirements vary by payer. | Low | Likely `conditionally-visible` when RCM module is enabled and at least national-standards pack is active. |
| EDI pipeline status | `payer-specific` | `deferred` | Payer: EDI traffic is payer-specific. No payer pack = no EDI traffic to monitor. | Low | Strong candidate for `conditionally-visible` WHEN `pack:payer IS active AT tenant`. |

#### 8.5.4 Analytics / BI workspace family — deferred surfaces

| Surface family | packVariationSensitivity (assessed) | Visibility posture | Pack-family interactions (planning) | Confidence | Notes |
|---------------|-------------------------------------|--------------------|-------------------------------------|------------|-------|
| Clinical quality metrics | `specialty-specific` | `deferred` | Specialty: quality metrics vary by specialty (cardiac metrics vs orthopedic outcomes). Analytics surfaces display derived data — they do not affect clinical visibility. | Low | Likely `conditionally-visible` when analytics capability is implemented and specialty-relevant data exists. |
| Operational analytics | `none` | `deferred` | Pack-independent. Operational metrics (throughput, utilization) apply universally. | Low | Likely `base-visible` within analytics workspace once that workspace exists. |
| Financial analytics | `payer-specific` | `deferred` | Payer: financial analytics are payer-sensitive (revenue by payer, denial rates by payer). Without payer data, financial analytics have limited content. | Low | Likely `conditionally-visible` when payer data is flowing. |
| Executive dashboards | `none` | `deferred` | Pack-independent. Executive summaries aggregate across all domains. | Low | Likely `base-visible` within analytics workspace. |

#### 8.5.5 Additional deferred surface families

| Surface family | packVariationSensitivity (assessed) | Visibility posture | Pack-family interactions (planning) | Confidence | Notes |
|---------------|-------------------------------------|--------------------|-------------------------------------|------------|-------|
| Imaging (DICOM viewer, worklist, device) | `none` | `deferred` | Imaging infrastructure is adapter-dependent (Orthanc, VistA Imaging), not pack-dependent. | Low | Likely `conditionally-visible` based on imaging module and adapter availability, not packs. |
| Telehealth (video, waiting room) | `none` | `deferred` | Telehealth is adapter-dependent (Jitsi or similar), not pack-dependent. | Low | Likely `conditionally-visible` based on telehealth module and adapter availability. |
| e-Prescribing | `country-regulatory` | `research-required` | Regulatory: EPCS/e-prescribing regulations vary significantly by jurisdiction. May require active regulatory pack. | Low | Research: Is e-prescribing a surface-visibility concern (hidden when regulatory pack is absent) or a content-variation concern (always visible but shows pending state)? |
| Nursing (eMAR, assessments) | `specialty-specific` | `deferred` | Specialty: nursing workflows vary by care setting. VistA PSB/NURS package dependency. | Low | Likely `conditionally-visible` based on nursing capability readiness. |
| ADT (admission, discharge, transfer) | `none` | `deferred` | ADT is a universal clinical concept. VistA DGPM dependency. Not pack-gated. | Low | Likely `conditionally-visible` based on ADT capability readiness, not packs. |
| Patient intake / triage | `multi-dimensional` | `deferred` | Language, regulatory, specialty: intake workflows vary. Base intake concept is universal. | Low | Likely `base-visible` with content variation. |
| Connector health (integration monitoring) | `none` | `deferred` | Pack-independent IT/infra monitoring surface. | Low | Likely `base-visible` for IT roles. |
| VistA connectivity dashboard | `none` | `deferred` | Pack-independent VistA infrastructure surface. | Low | Likely `base-visible` for IT roles. |

---

## 9. Pack-family impact summary

This section summarizes how each of the 7 canonical pack families affects surface visibility across all workspaces.

### 9.1 Language pack

| Impact type | Description |
|------------|-------------|
| Visibility impact | **None.** Language packs do not gate any surface's visibility. No surface becomes visible or invisible based on language pack activation. |
| Content impact | **Extensive.** Language packs affect UI string labels, terminal prompt language, VistA dialog translations, and formatting labels on all surfaces that display text. |
| Key principle | Language is a content concern, not a visibility concern. A surface is visible in the user's workspace regardless of whether a language pack is active. If no language pack is active, the surface displays in the baseline language (English). |

### 9.2 Locale pack

| Impact type | Description |
|------------|-------------|
| Visibility impact | **None.** Locale packs do not gate any surface's visibility. |
| Content impact | **Moderate.** Locale packs affect date/time formatting, number formatting, currency display, and measurement units on all surfaces that display formatted data. |
| Key principle | Locale is a formatting concern, not a visibility concern. Without a locale pack, the platform uses default formatting (typically US conventions). The surface remains visible. |

### 9.3 Regulatory pack

| Impact type | Description |
|------------|-------------|
| Visibility impact | **Minimal for concrete surfaces. Research-required for deferred families.** Among the 25 concrete surfaces, no surface's visibility is gated by regulatory pack activation. Content within surfaces (required fields, compliance labels, mandatory documentation checklists) varies by regulatory pack. Among deferred families, some surfaces (HIM, e-prescribing) may have regulatory visibility gating — marked as `research-required`. |
| Content impact | **Significant.** Regulatory packs affect mandatory fields, consent workflows, documentation requirements, acceptable code sets, and audit requirements across clinical, operational, and revenue-cycle surfaces. |
| Key principle | Regulatory packs enforce *what must appear on a surface* (mandatory fields, compliance rules), not *whether the surface appears*. Most surfaces exist with or without regulatory packs; the regulatory pack ensures the right content appears within them. |

### 9.4 National-standards pack

| Impact type | Description |
|------------|-------------|
| Visibility impact | **None for concrete surfaces. Research-required for deferred families.** Among deferred families, national-standards packs may affect coding workbench visibility (can't code without code sets). |
| Content impact | **Significant.** National-standards packs affect code set availability (ICD variants, CPT/HCPCS, local drug codes), identifier formats, and form structures across clinical and revenue-cycle surfaces. |
| Key principle | Standards packs provide reference data consumed by surfaces. They do not gate surface visibility at the platform level. |

### 9.5 Payer pack

| Impact type | Description |
|------------|-------------|
| Visibility impact | **None for concrete surfaces. Likely significant for deferred revenue-cycle families.** Claims management, EDI pipeline status, and financial analytics are strong candidates for `conditionally-visible` based on payer pack activation. Without an active payer pack, these surfaces have no data to display. |
| Content impact | **Heavy within revenue-cycle surfaces.** Payer packs configure claim formats, eligibility rules, connector settings, and remittance parsing. |
| Key principle | Payer packs are the strongest candidate for visibility gating among all pack families — but only for revenue-cycle and payer-specific surfaces. Clinical and administrative surfaces are not payer-gated. |

### 9.6 Specialty / content pack

| Impact type | Description |
|------------|-------------|
| Visibility impact | **None for concrete surfaces. Possible for deferred clinical families.** Specialty packs may gate sub-surface navigation (e.g., surgery surfaces appearing when a surgical specialty pack is active). The base clinical surfaces (problems, allergies, vitals, notes) are universal and not specialty-gated. |
| Content impact | **Heavy within clinical surfaces.** Specialty packs provide order sets, templates, decision support rules, and documentation helpers that populate clinical surfaces. |
| Key principle | Specialty packs define *what clinical content is available*, not *whether clinical surfaces exist*. The clinical workspace is universal; specialty packs configure it for specific disciplines. |

### 9.7 Tenant-overlay pack

| Impact type | Description |
|------------|-------------|
| Visibility impact | **None.** Tenant-overlay packs do not gate surface visibility. |
| Content impact | **Cosmetic to moderate.** Tenant-overlay packs provide branding, terminology preferences, default configuration values, and tenant-specific feature flags that customize the appearance and behavior of all surfaces. |
| Key principle | Tenant overlays are the highest-precedence customization layer (per pack governance §10.3), but they customize *within* visible surfaces. They do not hide or show surfaces. |

---

## 10. Cross-cutting invariants

These invariants hold across all workspaces, surface types, and pack families. A visibility rule that violates an invariant is incorrect and must be revised.

### 10.1 Invariants

| # | Invariant | Rationale |
|---|-----------|-----------|
| **INV-1** | **No surface becomes visible solely from pack activation.** Pack activation is a necessary condition for `conditionally-visible` surfaces (step 7), but a surface must also pass inventory, workspace, permission, and safety gates (steps 1–4). Activating a payer pack does not magically create a claims surface in the clinical terminal workspace. | Prevents packs from creating unauthorized surfaces. Workspace boundaries and permissions are prior constraints. |
| **INV-2** | **No pack can suppress a surface.** Suppression (step 4) is a governance/safety action, not a pack capability. Packs affect content and conditional visibility. Only governance decisions can suppress. | Prevents pack misconfiguration from hiding safety-critical surfaces. |
| **INV-3** | **Language and locale packs never gate visibility.** They are content/formatting concerns only. No surface ID has a visibility condition that references a language or locale pack. | Language neutrality: the platform is usable in any language. Absence of translation does not hide surfaces. |
| **INV-4** | **Regulatory packs gate content requirements, not surface existence.** Among concrete surfaces, no visibility rule is conditioned on regulatory pack activation. A regulatory pack being active means more mandatory fields appear on a surface — it does not mean the surface appears or disappears. Exception: deferred families where this requires research (e.g., HIM, e-prescribing). | Regulatory compliance is additive (adds requirements), not subtractive (hides surfaces). |
| **INV-5** | **Deferred families are never `base-visible` or `suppressed`.** Their posture is `deferred` or `research-required` until they are promoted to concrete surface entries with full analysis. | Prevents premature rule assignment for under-analyzed surfaces. |
| **INV-6** | **Pack-visibility rules never override permissions.** Permission denial at step 3 terminates visibility evaluation. No pack activation can make a surface visible to a role that the permissions matrix denies. | Permissions are upstream of pack visibility in the resolution order. |
| **INV-7** | **Pack-visibility rules never assert readiness.** A visibility rule of `conditionally-visible WHEN capability:X IS AT LEAST validated` does not claim that capability X *is* validated. It conditionally gates visibility on a readiness state that is independently governed by the capability truth pipeline. | Visibility rules consume readiness; they do not produce it. |
| **INV-8** | **Every `conditionally-visible` surface has an explicit condition.** No surface may be `conditionally-visible` with unstated conditions. If the conditions cannot be stated, the posture is `research-required`. | Explicit conditions are reviewable and testable. Implicit conditions are not. |
| **INV-9** | **Content variation is not visibility variation.** If a pack affects what appears *on* a surface (labels, fields, options, templates, order sets) without affecting whether the surface *appears*, the pack has content impact but zero visibility impact. This is recorded as "content variation, not visibility gating." | Prevents conflation of content customization with surface show/hide logic. |
| **INV-10** | **Platform surface visibility and inside-VistA menu authorization are independent layers.** A terminal surface being visible in the platform workspace does not guarantee VistA menu access. VistA's own File 19/200 security model is independently authoritative. | Prevents the platform from making security assumptions about VistA's authorization model. |

---

## 11. Open research gaps

The following questions remain unresolved and require further investigation before the affected visibility rules can be finalized.

| # | Gap | Affected surfaces | What is needed | Priority |
|---|-----|-------------------|---------------|----------|
| **RG-1** | Surgery surface visibility gating | Surgery (deferred family) | Determine whether surgery surfaces should be `conditionally-visible` based on surgical specialty pack activation, or `base-visible` with integration-pending state when no surgical pack is active. Requires clinical workflow analysis. | Medium |
| **RG-2** | HIM surface regulatory dependency | HIM (deferred family) | Determine whether Health Information Management surfaces require a regulatory pack to be visible, or are always visible with regulatory content variation. Requires regulatory analysis per target market. | Medium |
| **RG-3** | e-Prescribing regulatory visibility | e-Prescribing (deferred family) | Determine whether e-prescribing surfaces should be hidden when the market's regulatory pack does not cover e-prescribing requirements, or visible with an integration-pending state. EPCS compliance varies significantly by jurisdiction. | Low |
| **RG-4** | Clinical reminders and VistA pack interaction | Clinical reminders (deferred family) | Research how VistA's PXRM reminder engine interacts with platform-side pack-driven content. Reminders are VistA-native; packs are platform-native. The interaction model is unclear. | Low |
| **RG-5** | Payer management pre-activation visibility | Payer management (deferred family) | Determine whether the payer management surface should be visible before any payer pack is active (for setup/onboarding purposes), or only after at least one payer pack exists. | Medium |
| **RG-6** | Content catalog minimum readiness | `tenant-admin.content.catalog` | Validate that `capability:content-management IS AT LEAST implemented` is the correct readiness threshold for showing the content catalog. May need to be `validated` or `specified` instead. | Medium |
| **RG-7** | Audit viewer regulatory content scope | `it-integration.audit.viewer` | Validate which regulatory audit categories should be mandatory per market and how they affect audit viewer content filtering. Not a visibility concern but a content-configuration concern. | Low |
| **RG-8** | Specialty-driven sub-surface navigation | Clinical workspace (deferred families) | When clinical surfaces are promoted from deferred to concrete, determine whether specialty packs affect sub-surface *navigation* (e.g., a cardiology tab within the clinical workspace) or only *content within existing navigational elements*. | Low |
| **RG-9** | Tenant-overlay feature-flag scope | All surfaces | Determine whether tenant-overlay feature flags can affect surface visibility (making specific surfaces hidden for a specific tenant) or are limited to content/behavior customization. If tenant-overlay can affect visibility, it would be the only pack family with visibility-gating power beyond payer and specialty — which may violate INV-2 philosophy. | Medium |
| **RG-10** | Analytics surface conditional-visibility thresholds | Analytics families (deferred) | When analytics surfaces are promoted, determine what data-availability threshold makes analytics surfaces worth showing. An empty analytics dashboard may be worse than no dashboard. | Low |

---

## 12. Handoff — next artifacts

This document enables and constrains the following downstream artifacts. **None are authorized by this document** — each requires explicit task authorization.

| Next artifact | What it consumes from this document | Scope |
|--------------|-------------------------------------|-------|
| **Screen-contract instances (batch)** | Visibility posture per surface, condition expressions, pack-family dependency declarations. The `claimSurface`, `readinessDependencies`, and visibility-related fields in screen-contract JSON instances are informed by this document's rules. | Machine-readable JSON conforming to `screen-contract.schema.json` for Priority Group A–C surfaces. |
| **Pack resolver specification** | Resolution-order model (8 steps), visibility vocabulary (6 values), condition notation, invariants. A future resolver implementation must produce results consistent with these planning-stage rules. | Architecture specification for the runtime resolution engine. |
| **Clinical sub-workspace design** | Deferred clinical family rules (§8.5.1), research gaps RG-1/RG-4/RG-8. Clinical sub-workspace design must resolve which deferred families become concrete surfaces and finalize their pack-visibility postures. | Sub-workspace taxonomy and surface promotion for the clinical workspace. |
| **Revenue-cycle surface promotion** | Deferred revenue-cycle family rules (§8.5.3), research gaps RG-5. Revenue-cycle surface design must resolve payer-pack visibility gating for concrete surfaces. | Revenue-cycle workspace detailed design. |
| **UI wireframe / layout planning** | All visibility postures + resolution order. UI design must respect the visibility rules defined here — surfaces marked `hidden-by-default` must not appear by default, and `conditionally-visible` surfaces must have their conditions evaluated. | Visual design of surfaces — only after terminal proof and explicit authorization. |

### 12.1 Recommended next bounded prompts

1. **Screen-contract instances (small batch)** — convert the highest-confidence concrete surface entries (Priority Group A terminal surfaces + Priority Group B near-term tenant-admin surfaces) into machine-readable JSON contracts. These contracts will reference the visibility postures and conditions from this document.
2. Then **clinical sub-workspace design** or **revenue-cycle surface promotion** — depending on product priority, promote deferred families to concrete surfaces with full pack-visibility analysis.

---

## 13. Document summary

### 13.1 Key findings

| Finding | Detail |
|---------|--------|
| **Most concrete surfaces are `base-visible`.** | 20 of 25 concrete surfaces are `base-visible` — packs do not gate their visibility. Pack state affects content within these surfaces, not whether they appear. |
| **5 concrete surfaces are `conditionally-visible`.** | 4 terminal surfaces (conditioned on terminal enablement/capability) + 1 tenant-admin surface (content catalog, conditioned on content-management capability). Terminal conditions are not pack-driven. Only 1 concrete surface has a condition that references capability readiness potentially connected to packs (`tenant-admin.content.catalog`). |
| **No concrete surface is `hidden-by-default` or `suppressed`.** | All 25 concrete surfaces are either always visible or conditionally visible. None is hidden by default. None is suppressed. |
| **Language, locale, and tenant-overlay packs never gate visibility.** | These 3 pack families have zero visibility impact. They affect content and formatting only. |
| **Regulatory and national-standards packs primarily affect content, not visibility.** | Among concrete surfaces, no visibility rule is conditioned on regulatory or standards pack activation. Deferred families may have research-required regulatory visibility gates. |
| **Payer packs are the strongest visibility-gating candidate.** | Among deferred revenue-cycle families, payer pack activation is a strong candidate for `conditionally-visible` gating (claims management, EDI pipeline). |
| **Specialty packs may gate sub-surface navigation for deferred clinical families.** | This requires research (RG-8). Base clinical surfaces are universal; specialty content varies within them. |
| **33 deferred families have `deferred` or `research-required` posture.** | This is expected. Deferred families await promotion to concrete surface entries before finalizing pack-visibility rules. |
| **10 research gaps identified.** | RG-1 through RG-10 cover surgery visibility, HIM regulatory gate, e-prescribing, clinical reminders, payer management, and more. |

### 13.2 Visibility posture distribution

| Visibility posture | Concrete surfaces | Deferred families |
|-------------------|------------------|-------------------|
| `base-visible` | 20 | 0 |
| `conditionally-visible` | 5 | 0 |
| `hidden-by-default` | 0 | 0 |
| `suppressed` | 0 | 0 |
| `deferred` | 0 | 28 |
| `research-required` | 0 | 5 |
| **Total** | **25** | **33** |
