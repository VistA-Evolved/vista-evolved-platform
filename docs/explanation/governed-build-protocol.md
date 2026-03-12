# Governed build protocol

- **Contract-first:** APIs and events are defined in OpenAPI/AsyncAPI before implementation. Generated clients/server stubs are used; no ad-hoc HTTP calls when generators exist.
- **Config as code:** Ports, modules, tenants, capability packs are defined in config packages and validated by schemas.
- **Docs policy:** Only tutorials, how-to, reference, explanation, ADRs, runbooks. No sprawl.
- **Persistence:** Platform database only for control-plane and integration concerns. No SQLite; no in-memory for persistent state. VistA is source of truth where VistA owns the data.
- **Proof artifacts:** Verification and evidence go under `artifacts/`; not committed as canonical docs.
