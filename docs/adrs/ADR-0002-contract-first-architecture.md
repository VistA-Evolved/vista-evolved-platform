# ADR-0002: Contract-first architecture

## Status

Accepted.

## Context

Ad-hoc HTTP and event handling leads to drift between clients and servers and unclear API boundaries.

## Decision

- **HTTP APIs:** Defined in OpenAPI 3.x under `packages/contracts/openapi/`. Generate server and client from specs. No hand-written client calls when generated SDKs exist.
- **Events / WebSockets:** Defined in AsyncAPI under `packages/contracts/asyncapi/` where applicable. Use generated clients when available.
- **Config / manifests:** JSON Schema (or equivalent) in `packages/contracts/schemas/` for capability manifests, modules, tenants. Validate at load time.

## Consequences

- Single source of truth for API shape; generated code reduces human error. Requires discipline to update specs before implementation.
