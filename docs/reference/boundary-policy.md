# Boundary policy

- **Bounded contexts** are reflected in directory layout and CODEOWNERS: `apps/control-plane/`, `apps/admin-console/`, `packages/contracts/`, `packages/config/`, `packages/domain/`, `packages/ui/`.
- **Cross-boundary access** is via contracts (OpenAPI, AsyncAPI, schemas). No direct imports from one app into another’s internals; use shared packages and generated clients.
- **Domain** packages (`packages/domain/admin/`, `packages/domain/tenancy/`) hold shared types and rules; they do not depend on apps or infrastructure. Apps depend on domain and contracts.
