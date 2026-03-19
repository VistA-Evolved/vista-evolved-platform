# Control Plane — Static Review Prototype

> **This is a static-review prototype, not a running application.**
> It renders fixture data derived from canonical contract artifacts.
> No API calls, no persistence, no authentication.

## What it is

A zero-dependency, vanilla HTML/CSS/JS single-page app that renders all 8
canonical control-plane surfaces using checked-in fixture JSON data. It exists
so operators and reviewers can visually inspect the contract model before any
runtime implementation begins.

## How to open

Open `index.html` directly in a browser (no server required):

```
# From repo root
start apps/control-plane/index.html    # Windows
open apps/control-plane/index.html     # macOS
xdg-open apps/control-plane/index.html # Linux
```

## 8 Surfaces

| # | Surface | Route | Source Contract |
|---|---------|-------|-----------------|
| 1 | Tenant Registry | `#/tenants` | `control-plane.tenants.list` |
| 2 | Tenant Detail | `#/tenants/detail` | `control-plane.tenants.detail` |
| 3 | Tenant Bootstrap | `#/tenants/bootstrap` | `control-plane.tenants.bootstrap` |
| 4 | Provisioning Runs | `#/provisioning` | `control-plane.provisioning.runs` |
| 5 | Market Management | `#/markets` | `control-plane.markets.management` |
| 6 | Market Detail | `#/markets/detail` | `control-plane.markets.detail` |
| 7 | Pack Catalog | `#/packs` | `control-plane.packs.catalog` |
| 8 | System Config | `#/system-config` | `control-plane.system.config` |

## Write control posture

- **Batch 1 reads (R1-R10):** Rendered from fixture data.
- **Batch 1 writes (W1-W2):** Shown as functional controls with non-persistent disclaimer.
- **Batch 2 writes (W5-W8):** Disabled with "integration-pending" tooltip.
- **Batch 3 writes (W9-W16):** Disabled with "integration-pending" tooltip.

## Fixture provenance

All fixture JSON files include `_provenance` metadata tracing each value back to
its source contract artifact. See `fixtures/*.json`.

## What this is NOT

- Not a runtime application — no API, no database, no auth.
- Not a design mockup — layout follows the screen-contract spec, not visual design.
- Not persistent — form inputs reset on navigation. The banner says so.
