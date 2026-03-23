# Control-Plane Local Write Review Runtime (Batch 3)

> **SUPERSEDED (2026-03-22):** Review-only write routes have been removed from `apps/control-plane/`. This document is retained as historical reference for the review simulation design.

> **⚠️ EXPANDED.** This document describes the original 8-surface write-review architecture. The runtime now covers 21 surfaces with 15 write simulation routes. The write-review patterns and ReviewEnvelope contract defined here remain current; the surface count has expanded. See `apps/control-plane/README.md` for current posture.

> **Explanation:** Rationale and architecture for the review-only write simulation
> layer added to `apps/control-plane/`.

## Context

The control-plane local runtime was initially read-only (12 GET routes,
fixture-backed). All 15 contracted write actions from the OpenAPI spec were
disabled in the UI with "integration-pending" tooltips.

This batch upgrades the runtime so that every contracted write action can be
exercised locally as a **review-only simulation**: the action validates input,
projects side-effects (events, audit), and returns an honest envelope — but
never persists, never mutates fixtures, and never fakes success.

## Architecture

### Route namespace separation

- **Canonical read routes:** `/api/control-plane/v1/*` — unchanged, fixture-backed.
- **Review-only write routes:** `/api/control-plane-review/v1/*` — new, completely
  separate namespace. No risk of collision with canonical routes.

### Module structure

| File | Purpose |
|------|---------|
| `review-action-map.mjs` | Centralized action metadata: 15 actions with required/optional fields, projected events, guardrails, audit summaries. Validation and envelope-building functions. |
| `routes/review.mjs` | 15 POST/PUT review endpoints + 1 GET discovery endpoint. Uses generic `reviewHandler` factory pattern. |

### ReviewEnvelope contract

Every review endpoint returns the same shape:

```json
{
  "mode": "local-review",
  "executed": false,
  "persistence": "none",
  "canonicalOperationId": "<operationId>",
  "validation": { "valid": true|false, "errors": [...] },
  "projectedEvents": ["<asyncapi.channel.id>", ...],
  "auditPreview": { "who": "local-reviewer", "what": "<description>" },
  "guardrails": ["<constraint>", ...],
  "notes": ["Review-only: no state was mutated"]
}
```

### UI integration

Each of the 8 surfaces has buttons wired to open a review dialog. The dialog:

1. Shows required and optional form fields for the action
2. Submits to the review-only POST/PUT endpoint
3. Displays the returned envelope with validation results, projected events,
   audit preview, and guardrails
4. Shows a persistent "NO PERSISTENCE" banner

### Safety posture

- **No fixture mutation:** Review routes do not read from or write to fixture files.
- **No persistence of any kind:** Responses include `persistence: "none"` and `executed: false`.
- **No fake success:** The envelope clearly states the action was reviewed, not executed.
- **No canonical write APIs:** The review namespace (`/api/control-plane-review/v1`)
  is structurally separate from the canonical namespace.

## 15 contracted write actions

| # | operationId | Surface | AsyncAPI Event |
|---|------------|---------|---------------|
| W1 | suspendTenant | Tenant Detail | tenant.lifecycle.suspended |
| W2 | reactivateTenant | Tenant Detail | tenant.lifecycle.reactivated |
| W3 | archiveTenant | Tenant Detail | tenant.lifecycle.archived |
| W4 | resolveEffectiveConfigurationPlan | Tenant Registry, Bootstrap | effective-plan.resolved |
| W5 | createTenantBootstrapRequest | Bootstrap | bootstrap.request.created |
| W6 | createProvisioningRun | Provisioning | provisioning.run.created |
| W7 | cancelProvisioningRun | Provisioning | provisioning.run.cancelled |
| W8 | createLegalMarketProfileDraft | Markets | market.draft.created |
| W9 | updateLegalMarketProfileDraft | Market Detail | market.draft.updated |
| W10 | submitLegalMarketProfileForReview | Market Detail | market.review.submitted |
| W11 | createPackManifestDraft | Pack Catalog | pack.draft.created |
| W12 | updatePackManifestDraft | Pack Catalog | pack.draft.updated |
| W13 | submitPackManifestForReview | Pack Catalog | pack.review.submitted |
| W14 | updateFeatureFlag | System Config | system.feature-flag.updated |
| W15 | updateSystemParameter | System Config | system.parameter.updated |

## What this is NOT

- Not canonical write APIs — review routes simulate, they don't execute.
- Not a mock server — there is no fake or stubbed backend. Input is validated
  against the contract; the response honestly reports what *would* happen.
- Not persistent — form data and review results exist only in the browser session.
