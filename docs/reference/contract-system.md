# Contract System

> Defines the contract layers that govern inter-service and inter-module communication.

## Contract layers

| Layer | Purpose | Spec format | Location |
|-------|---------|-------------|----------|
| **Capability contract** | What a module/tenant can do | JSON Schema manifest | `packages/contracts/capability-manifests/` |
| **API contract** | HTTP request/response shapes | OpenAPI 3.x | `packages/contracts/openapi/` |
| **Event/Async contract** | Events, WebSocket messages | AsyncAPI | `packages/contracts/asyncapi/` |
| **Config/Runtime contract** | Ports, env vars, module config | JSON Schema | `packages/contracts/schemas/`, `packages/config/` |

## Rules

- **HTTP APIs:** Defined in OpenAPI 3.x under `packages/contracts/openapi/`. Generate server and client from specs. No hand-written HTTP calls when generated SDKs exist.
- **Events / WebSockets:** Defined in AsyncAPI under `packages/contracts/asyncapi/` where applicable. Use generated clients when available.
- **Config / manifests:** JSON Schema (or equivalent) in `packages/contracts/schemas/` for capability manifests, module config, tenant config. Validate at load time.
- **Conventions:** Versioned specs. Breaking changes require an ADR and version bump. Generated code lives in consuming apps/packages — do not commit generated code to contracts.

## Port registry

All network ports are defined in `packages/config/ports/` and documented in `docs/reference/port-registry.md`. Raw hardcoded port numbers in application code outside of approved config files are banned. Use config imports or environment variables.

## Boundary enforcement

Bounded contexts are declared in `/.github/CODEOWNERS`. Cross-boundary access is via contracts only (OpenAPI, AsyncAPI, schemas). No direct imports from one app into another's internals.

When Nx is adopted (see `docs/reference/nx-adoption-plan.md`), boundary tags and `enforceModuleBoundaries` will provide lint-time enforcement. Until then, code review and CI gates are the enforcement mechanism.

<!-- TODO: Wire Nx enforceModuleBoundaries when Nx is installed -->
