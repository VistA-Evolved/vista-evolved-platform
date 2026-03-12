# Contract system

- **HTTP APIs:** OpenAPI 3.x in `packages/contracts/openapi/`. Generate server and client from specs; no hand-written HTTP calls when generated SDKs exist.
- **Events / WebSockets:** AsyncAPI in `packages/contracts/asyncapi/` where applicable. Use generated clients when available.
- **Config / manifests:** JSON Schema (or equivalent) in `packages/contracts/schemas/` for capability manifests, module config, tenant config.
- **Conventions:** Versioned specs; breaking changes require ADR and version bump. Generated code lives in consuming apps/packages; do not commit generated code to contracts.
