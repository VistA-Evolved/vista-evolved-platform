# Control-Plane Local Operator-Access Foundation — Wave 1

> **HISTORICAL (2026-03-22):** The review-only runtime described here has been superseded. The operator console now uses real-backend proxy routes and lifecycle actions. This document is retained as historical reference.

> **Category:** explanation
> **Scope:** `apps/control-plane/` local review runtime only
> **Status:** historical

## What "local operator context" means in this runtime

The control-plane local review runtime accepts a simulated operator role via
the `X-Local-Role` HTTP request header. This role determines whether API
requests are allowed or denied. It is not a real identity claim — it is a
bounded local signal used to exercise and demonstrate the access posture
defined in the permissions matrix and screen contracts.

The runtime defaults to `platform-operator` when no header is sent,
preserving developer usability. The role is stored in `localStorage` on the
client side and injected into every `fetch()` call by the `apiFetch()` wrapper.

## Recognized role categories

The following 7 role categories are recognized, matching the `roleCategoryEnum`
in `packages/contracts/schemas/screen-contract.schema.json`:

| Role value | Full name |
|---|---|
| `platform-operator` | Platform operator / super-admin |
| `tenant-admin` | Tenant administrator |
| `clinician` | Clinician (physician, nurse, pharmacist, therapist) |
| `ancillary-staff` | Ancillary staff (scheduling, HIM, intake) |
| `revenue-cycle-staff` | Revenue cycle staff (billing, coding, claims) |
| `analyst` | Analyst / quality officer |
| `it-integration` | IT / integration engineer |

No additional role categories are invented. Unrecognized values return 400.

## Which surfaces, routes, and actions are allowed vs. denied

All 8 current control-plane surfaces are scoped to `platform-operator` only,
as documented in `docs/reference/permissions-matrix.md` §3 and the
`accessRequirements.allowedRoles` field in each screen contract under
`packages/contracts/screen-contracts/control-plane.*.json`.

| Allowed | Denied |
|---|---|
| `platform-operator` — full access to all 13 read routes, 15 review-write routes, and the review-action discovery endpoint | `tenant-admin`, `clinician`, `ancillary-staff`, `revenue-cycle-staff`, `analyst`, `it-integration` — all receive 403 |

The explicit route-to-surface-to-action mapping is maintained in
`apps/control-plane/lib/access-map.mjs` and is grounded in:

- `docs/reference/permissions-matrix.md` (role entitlements)
- `docs/reference/screen-inventory.md` (surface IDs)
- `docs/explanation/control-panel-action-semantics-and-source-of-truth-binding-batch-1.md` (action classes)
- `packages/contracts/openapi/control-plane-operator-bootstrap-and-provisioning.openapi.yaml` (operation IDs)

## Why control-plane is currently platform-operator-only

The permissions matrix assigns `allowed` (A) to `platform-operator` and
`prohibited` (—) to all other roles for every control-plane surface. This is
an architectural decision, not a limitation: control-plane surfaces manage
tenant lifecycle, market profiles, pack catalogs, and platform-wide system
configuration. These are platform governance operations that require
platform-level authority.

See `docs/reference/permissions-matrix.md` §3 (control-plane workspace
entitlements) and `docs/explanation/information-architecture-workspace-map.md`
§8 (role-to-workspace alignment).

## Why this is NOT real authentication

This mechanism:

- Has **no backend user store** — no database, no identity provider, no token validation.
- Has **no session persistence** — the role signal is a plain request header, not a cryptographic token.
- Has **no external IdP integration** — no SSO, no OIDC, no JWT, no SAML.
- Is **trivially bypassable** — any HTTP client can set any header value.
- Is **local-only** — it runs in the dev review runtime, not in a deployed environment.

It exists solely to exercise and demonstrate the access rules defined in the
planning artifacts, so the runtime honestly reflects which roles can and
cannot use these surfaces.

## Why this is NOT the final product-wide authorization model

The product-wide authorization model will:

- Use the platform database for session/identity concerns.
- Integrate with an external IdP (OIDC) for authentication.
- Enforce role claims via validated tokens, not request headers.
- Support entity-context scoping (tenant, facility, patient) per the `scopePostureEnum`.
- Support granular permission claims per the permissions matrix action classes.
- Be enforced at the API gateway layer, not in app-local middleware.

This local enforcement is a **planning bridge** — it grounds the current
runtime in the same access truths that the future auth system will enforce.

## Expected 403 behavior

When a recognized non-platform role sends an API request:

```json
HTTP 403 Forbidden
{
  "error": "access_denied",
  "message": "Role <role> does not have control-plane access",
  "activeRole": "<role>",
  "requiredRole": "platform-operator"
}
```

When an unrecognized role value is sent:

```json
HTTP 400 Bad Request
{
  "error": "invalid_role",
  "message": "Unrecognized role: <value>",
  "validRoles": ["platform-operator", "tenant-admin", ...]
}
```

No `_provenance` metadata, no internal debug text, no stack traces.

## Expected UI behavior for denied access

When the active local role is not `platform-operator`:

1. All API fetches return 403 or 400.
2. The main content area renders a centered access-denied message with the
   active role, required role, and instructions to switch.
3. The role switcher in the top banner remains functional so the operator can
   switch back.
4. Navigation sidebar links remain visible but non-functional (no data loads).
5. Write-action buttons are not rendered (the surface never loads for denied roles).

## Default local role behavior

When no `X-Local-Role` header is present (the common case for local dev):

- The runtime defaults to `platform-operator`.
- All routes succeed normally.
- The developer experience is unchanged from before this enforcement was added.

The UI persists the selected role in `localStorage` under key `cp-local-role`
and injects it into every API call via the `apiFetch()` wrapper.
