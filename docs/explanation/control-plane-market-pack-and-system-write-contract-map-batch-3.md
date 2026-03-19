# Control-Plane Market, Pack, and System-Config Write Operations — Contract Map (Batch 3)

> **Type:** Explanation — architecture rationale and contract binding documentation.
>
> **Batch:** 3 (extends Batch 1 contract map and Batch 2 lifecycle/cancel additions).
>
> **Scope:** Write-side contract operations for the 3 remaining deferred surfaces:
> legal-market profile draft authoring (`markets.management`), pack manifest draft
> authoring (`packs.catalog`), and system-configuration mutations (`system.config`).
> These actions were declared as deferred in Batch 1 planning docs and remained
> deferred after Batch 2.
>
> **Out of scope:** Market activation/deprecation/retirement, pack publish/activate/deactivate,
> launch tier escalation, readiness dimension direct manipulation, delete operations,
> provisioning engine implementation, authorization implementation, runtime code, UI code.

---

## 1. Relationship to Batch 1 and Batch 2

This document extends the following artifacts:

| Prior artifact | What it declared | What Batch 3 contracts |
|----------------|-----------------|------------------------|
| `control-panel-action-semantics-and-source-of-truth-binding-batch-1.md` | W9–W10 marked Deferred; market/pack writes absent from W-matrix | Resolves W9–W10 to Contracted; adds W11–W16 for market/pack writes |
| `control-panel-page-specs-and-operator-manual-batch-1.md` | §3.5 market write ops deferred; §3.7 pack write ops deferred; §3.8 config write deferred | Resolves all 3 surfaces' deferred write status |
| `control-panel-design-contract-and-static-review-prototype-batch-1.md` | §6 deferred elements: market create/edit, pack create/edit, system config edit | Resolves deferred status for all 5 remaining rows |
| `control-plane-tenant-lifecycle-and-provisioning-control-contract-map-batch-2.md` | "Actions that remain deferred" table: W9, W10, market write ops, pack write ops | All 4 categories resolved by this batch |
| `control-plane-operator-bootstrap-and-provisioning-contract-map.md` | Original 6-action binding table | Extended through Batch 2 (rows 7–10) and now Batch 3 (rows 11–16) |

**After Batch 3, zero write actions remain deferred.** All operator write actions across
all 8 control-plane surfaces have either existing API operations (W1–W4), Batch 2
contracted operations (W5–W8), or Batch 3 contracted operations (W9–W16).

---

## 2. Governance Constraints

### 2.1 Market profile governance

Legal-market profiles follow the status lifecycle defined in the legal-market-composition-spec:

```
  draft ──► active ──► deprecated ──► retired
```

**Batch 3 scope is limited to draft-phase operations:**

- **Create draft:** An operator can author a new legal-market profile in `draft` status. The profile requires a valid `legalMarketId` (ISO 3166-1 alpha-2), display name, and initial readiness dimensions.
- **Edit draft:** An operator can modify a draft profile. Edits are only permitted while the profile is in `draft` status. Once a profile exits draft (via review → active), it becomes immutable except through a versioned update workflow (future batch).
- **Submit for review:** An operator can submit a draft profile for governance review. This transitions the profile to `review-pending` status. The profile does not become `active` until a human reviewer approves it.

**Explicitly excluded:**
- Direct activation (draft → active requires human approval, not an API call)
- Launch tier escalation (changes to `launchTier` require governance review)
- Readiness dimension direct manipulation (readiness is computed from pack/adapter state)
- Delete (no market profile delete operation)

### 2.2 Pack manifest governance

Pack manifests follow the lifecycle defined in the pack-and-adapter-governance-spec:

```
  draft ──► validated ──► tested ──► published ──► activated ◄──► deactivated
                                                        │
                                                        └──► retired
```

**Batch 3 scope is limited to draft-phase operations:**

- **Create draft:** An operator can author a new pack manifest in `draft` lifecycle state. The manifest requires `packId`, `displayName`, `packFamily`, initial version, and at minimum the lifecycle and eligibility sections.
- **Edit draft:** An operator can modify a draft pack manifest. Edits are only permitted while the pack is in `draft` lifecycle state. Once a pack exits draft (via validation), content changes require a versioned update.
- **Submit for review:** An operator can submit a draft pack for governance review (validation). This transitions the pack to `review-pending` state. The pack does not advance to `validated` until automated or manual review completes.

**Explicitly excluded:**
- Publish (tested → published requires human approval gate)
- Activate / deactivate (post-publish operations)
- Retire
- Delete

### 2.3 System configuration governance

System configuration writes follow the controlled-write posture:

- **Toggle feature flag:** An operator can toggle a feature flag's `enabled` state. The flag must already exist in the platform configuration — operators cannot create new flags via this endpoint.
- **Update system parameter:** An operator can update a system parameter's `value`. The parameter must exist and must be marked as operator-editable. Parameters marked as `readOnly` or `system-managed` cannot be updated.

Both operations are:
- Audit-trailed (emit events for the audit subsystem)
- Scoped to existing keys (no key creation/deletion)
- Immediate-effect (synchronous response)

---

## 3. Action Binding Table — Batch 3 Additions

| # | Operator Action | Control-Panel Surface | API operationId | HTTP | Source of Truth | Emitted Event(s) | Sync/Async |
|---|-----------------|----------------------|-----------------|------|-----------------|-------------------|------------|
| 11 | Create market profile draft | markets.management | `createLegalMarketProfileDraft` | `POST /legal-market-profiles` | claim-readiness-registry | `market.profile.draft.created` | Synchronous (201) |
| 12 | Edit market profile draft | markets.management | `updateLegalMarketProfileDraft` | `PUT /legal-market-profiles/{legalMarketId}` | claim-readiness-registry | `market.profile.draft.updated` | Synchronous (200) |
| 13 | Submit market for review | markets.management | `submitLegalMarketProfileForReview` | `POST /legal-market-profiles/{legalMarketId}:submit-review` | claim-readiness-registry | `market.profile.review.submitted` | Synchronous (200) |
| 14 | Create pack manifest draft | packs.catalog | `createPackManifestDraft` | `POST /packs` | platform-pack-catalog | `pack.manifest.draft.created` | Synchronous (201) |
| 15 | Edit pack manifest draft | packs.catalog | `updatePackManifestDraft` | `PUT /packs/{packId}` | platform-pack-catalog | `pack.manifest.draft.updated` | Synchronous (200) |
| 16 | Submit pack for review | packs.catalog | `submitPackManifestForReview` | `POST /packs/{packId}:submit-review` | platform-pack-catalog | `pack.manifest.review.submitted` | Synchronous (200) |
| 9 | Toggle feature flag | system.config | `updateFeatureFlag` | `PUT /system-config/feature-flags/{flagKey}` | platform-system-configuration | `system.config.feature-flag.updated` | Synchronous (200) |
| 10 | Update system parameter | system.config | `updateSystemParameter` | `PUT /system-config/parameters/{paramKey}` | platform-system-configuration | `system.config.parameter.updated` | Synchronous (200) |

---

## 4. Preconditions and Postconditions

### 4.1 Market Profile Draft Operations

| Operation | Precondition | Postcondition |
|-----------|-------------|---------------|
| `createLegalMarketProfileDraft` | No profile exists with the given `legalMarketId` | Profile created with `status: draft` |
| `updateLegalMarketProfileDraft` | Profile exists; `status` is `draft` | Profile fields updated; `updatedAt` refreshed |
| `submitLegalMarketProfileForReview` | Profile exists; `status` is `draft` | Profile `status` → `review-pending`; queued for governance review |

### 4.2 Pack Manifest Draft Operations

| Operation | Precondition | Postcondition |
|-----------|-------------|---------------|
| `createPackManifestDraft` | No pack exists with the given `packId` | Pack created with `lifecycleState: draft` |
| `updatePackManifestDraft` | Pack exists; `lifecycleState` is `draft` | Pack fields updated; `lastModifiedAt` refreshed |
| `submitPackManifestForReview` | Pack exists; `lifecycleState` is `draft` | Pack `lifecycleState` → `review-pending`; queued for validation review |

### 4.3 System Configuration Operations

| Operation | Precondition | Postcondition |
|-----------|-------------|---------------|
| `updateFeatureFlag` | Flag exists with given `flagKey` | Flag `enabled` toggled; `updatedAt` refreshed |
| `updateSystemParameter` | Parameter exists with given `paramKey`; parameter is operator-editable | Parameter `value` updated; `lastUpdatedAt` refreshed |

---

## 5. Error Model

All operations reuse the existing `ErrorResponse` schema.

### 5.1 Market Profile Errors

| Operation | HTTP | Error Code | When |
|-----------|------|------------|------|
| `createLegalMarketProfileDraft` | 409 | `CONFLICT` | Profile already exists with this `legalMarketId` |
| `createLegalMarketProfileDraft` | 422 | `VALIDATION_FAILED` | Invalid `legalMarketId` format or missing required fields |
| `updateLegalMarketProfileDraft` | 404 | `ARTIFACT_NOT_FOUND` | Profile does not exist |
| `updateLegalMarketProfileDraft` | 409 | `CONFLICT` | Profile is not in `draft` status |
| `submitLegalMarketProfileForReview` | 404 | `ARTIFACT_NOT_FOUND` | Profile does not exist |
| `submitLegalMarketProfileForReview` | 409 | `CONFLICT` | Profile is not in `draft` status (already submitted or active) |
| All | 401 | `UNAUTHORIZED` | No valid operator token |
| All | 403 | `FORBIDDEN` | Operator lacks `control-plane:markets:write` permission |

### 5.2 Pack Manifest Errors

| Operation | HTTP | Error Code | When |
|-----------|------|------------|------|
| `createPackManifestDraft` | 409 | `CONFLICT` | Pack already exists with this `packId` |
| `createPackManifestDraft` | 422 | `VALIDATION_FAILED` | Invalid `packId` format or missing required fields |
| `updatePackManifestDraft` | 404 | `ARTIFACT_NOT_FOUND` | Pack does not exist |
| `updatePackManifestDraft` | 409 | `CONFLICT` | Pack is not in `draft` lifecycle state |
| `submitPackManifestForReview` | 404 | `ARTIFACT_NOT_FOUND` | Pack does not exist |
| `submitPackManifestForReview` | 409 | `CONFLICT` | Pack is not in `draft` lifecycle state |
| All | 401 | `UNAUTHORIZED` | No valid operator token |
| All | 403 | `FORBIDDEN` | Operator lacks `control-plane:packs:write` permission |

### 5.3 System Configuration Errors

| Operation | HTTP | Error Code | When |
|-----------|------|------------|------|
| `updateFeatureFlag` | 404 | `ARTIFACT_NOT_FOUND` | Flag does not exist |
| `updateFeatureFlag` | 422 | `VALIDATION_FAILED` | Invalid value for the flag's type |
| `updateSystemParameter` | 404 | `ARTIFACT_NOT_FOUND` | Parameter does not exist |
| `updateSystemParameter` | 409 | `CONFLICT` | Parameter is `readOnly` or `system-managed` |
| `updateSystemParameter` | 422 | `VALIDATION_FAILED` | Value fails type or range validation |
| All | 401 | `UNAUTHORIZED` | No valid operator token |
| All | 403 | `FORBIDDEN` | Operator lacks `control-plane:config:write` permission |

---

## 6. Event Catalog — Batch 3 Additions

Eight new events are added to the AsyncAPI contract.

### 6.1 Market Profile Events

| Event Address | Message Name | Producer | Consumers | When |
|--------------|-------------|----------|-----------|------|
| `market.profile.draft.created` | `MarketProfileDraftCreated` | Market management service | Audit subsystem, control panel (list refresh) | After draft profile created |
| `market.profile.draft.updated` | `MarketProfileDraftUpdated` | Market management service | Audit subsystem, control panel (detail refresh) | After draft profile updated |
| `market.profile.review.submitted` | `MarketProfileReviewSubmitted` | Market management service | Audit subsystem, governance review queue, control panel (status refresh) | After profile submitted for review |

### 6.2 Pack Manifest Events

| Event Address | Message Name | Producer | Consumers | When |
|--------------|-------------|----------|-----------|------|
| `pack.manifest.draft.created` | `PackManifestDraftCreated` | Pack catalog service | Audit subsystem, control panel (list refresh) | After draft pack created |
| `pack.manifest.draft.updated` | `PackManifestDraftUpdated` | Pack catalog service | Audit subsystem, control panel (detail refresh) | After draft pack updated |
| `pack.manifest.review.submitted` | `PackManifestReviewSubmitted` | Pack catalog service | Audit subsystem, governance review queue, control panel (status refresh) | After pack submitted for review |

### 6.3 System Configuration Events

| Event Address | Message Name | Producer | Consumers | When |
|--------------|-------------|----------|-----------|------|
| `system.config.feature-flag.updated` | `SystemConfigFeatureFlagUpdated` | System config service | Audit subsystem, tenant runtime planes (flag propagation), control panel (flag state refresh) | After feature flag toggled |
| `system.config.parameter.updated` | `SystemConfigParameterUpdated` | System config service | Audit subsystem, tenant runtime planes (parameter propagation), control panel (parameter state refresh) | After system parameter updated |

### 6.4 Event Payload Conventions

All event payloads follow established conventions from Batch 1 and Batch 2:

- Required envelope: `eventId` (UUID), `eventType` (const string), `occurredAt` (ISO 8601), `correlationId` (UUID)
- Domain identifiers: `legalMarketId`, `packId`, `flagKey`, `paramKey` as appropriate
- `requestedBy`: operator identity from auth context
- **No PHI**: only operational/configuration identifiers
- Audit-relevant fields: `previousValue`/`newValue` for toggles and parameter updates

---

## 7. Permission Model

Batch 3 operations use permission claims defined (but previously unexercised) in Batch 1:

| Permission claim | Operations |
|-----------------|------------|
| `control-plane:markets:write` | W11, W12, W13 (market draft authoring + review submission) |
| `control-plane:packs:write` | W14, W15, W16 (pack draft authoring + review submission) |
| `control-plane:config:write` | W9, W10 (feature flag toggle + parameter update) |

These permission claims were declared in the action-semantics doc (§2) with the note
"defined here for completeness but the corresponding API operations are deferred to
future contracts." Batch 3 exercises them.

---

## 8. Audit Requirements

All Batch 3 actions produce audit trail entries consistent with Batch 1 and Batch 2 conventions:

| Field | Source |
|-------|--------|
| `eventType` | From emitted event's `eventType` constant |
| `occurredAt` | Server-generated ISO 8601 timestamp |
| `correlationId` | Per-request UUID |
| `requestedBy` | Derived from authenticated operator session (auth context) |
| `detail` | Operation-specific payload |

**Market audit detail:** `legalMarketId`, `displayName`, `status` (before/after for submit-review)

**Pack audit detail:** `packId`, `packFamily`, `displayName`, `lifecycleState` (before/after for submit-review)

**System config audit detail:** `flagKey`/`paramKey`, `previousValue`, `newValue`, `updatedBy`

---

## 9. PH Truth Constraints

**No change from Batch 1 / Batch 2.** These write operations do not alter PH truth:

- PH legal market remains `draft` / `T0` — the `updateLegalMarketProfileDraft` operation can modify draft fields but cannot transition status to `active` or escalate launch tier
- All PH packs remain lifecycle `draft` — the `updatePackManifestDraft` operation can modify draft fields but cannot advance lifecycle
- The `submitLegalMarketProfileForReview` and `submitPackManifestForReview` operations transition to `review-pending`, not to `active` or `published`
- Feature flag toggles and parameter updates are market-independent
- No PH capability becomes claimable or production-eligible through these operations

---

## 10. Compensation and Recovery

### 10.1 Market Profile Drafts

Draft creation and editing are **overwrite operations** — each PUT replaces the draft content. There is no undo, but since the profile is in draft status, the operator can simply re-edit. Submitting for review is **one-directional** — a submitted profile cannot be un-submitted through the API. If a review needs withdrawal, it requires governance-layer intervention (future batch).

### 10.2 Pack Manifest Drafts

Same pattern as market profiles: drafts are freely editable until submitted. Submission for review is one-directional. No automated rollback.

### 10.3 System Configuration

Feature flag toggles are **immediately reversible** — toggle again to restore the previous state. Parameter updates are also reversible by updating back to the previous value. Both operations include `previousValue` in the event payload for audit trail reconstruction.

---

## 11. Verification Checklist

- [ ] OpenAPI has 8 new operations: `createLegalMarketProfileDraft`, `updateLegalMarketProfileDraft`, `submitLegalMarketProfileForReview`, `createPackManifestDraft`, `updatePackManifestDraft`, `submitPackManifestForReview`, `updateFeatureFlag`, `updateSystemParameter`
- [ ] OpenAPI operation count: 26 (was 18)
- [ ] OpenAPI version bumped from `0.2.0` to `0.3.0`
- [ ] AsyncAPI has 8 new channels for Batch 3 events
- [ ] AsyncAPI event count: 20 (was 12)
- [ ] AsyncAPI version bumped from `0.2.0` to `0.3.0`
- [ ] Batch 1 action-semantics W9–W10 changed from Deferred to Contracted; W11–W16 added
- [ ] Batch 1 page-specs deferred controls inventory updated
- [ ] Batch 1 design-contract deferred elements resolved
- [ ] Source-of-truth-index updated with Batch 3 doc and operation counts
- [ ] PH truth unchanged: draft/T0, no capability escalation
- [ ] No screen-contract changes
- [ ] No JSON Schema changes
- [ ] No runtime code changes
- [ ] No UI code changes
- [ ] YAML lint passes on both contracts
