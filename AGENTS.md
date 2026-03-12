# Agent and developer onboarding — VistA Evolved Platform

- **Contract-first:** OpenAPI for HTTP APIs, AsyncAPI for events/WebSockets. Use generated SDKs; no hand-written client calls when generators exist.
- **Config/manifests:** JSON/YAML for config, capability manifests, fixtures. See `packages/contracts/` and `docs/reference/contract-system.md`.
- **Persistence:** No SQLite, no in-memory for persistent state. Platform DB only for control-plane/integration. See `docs/reference/persistence-policy.md`.
- **Docs:** Only tutorials, how-to, reference, explanation, ADRs, runbooks. No broad documentation sprawl.
- **Boundaries:** Bounded contexts in CODEOWNERS; see `docs/reference/boundary-policy.md`.
