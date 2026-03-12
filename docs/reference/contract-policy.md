# Contract policy

- **OpenAPI** for all HTTP APIs. Specs in `packages/contracts/openapi/`. Generate server and client; no hand-written HTTP calls when generated SDKs exist.
- **AsyncAPI** for event/WebSocket contracts where applicable. Specs in `packages/contracts/asyncapi/`. Use generated clients when available.
- **Schemas** for config and manifests (capability packs, modules, tenants, deployment profiles). JSON Schema in `packages/contracts/schemas/`. Validate at load time.
- **No ad-hoc clients:** Prefer generated SDKs from OpenAPI/AsyncAPI over manual fetch/axios calls.
