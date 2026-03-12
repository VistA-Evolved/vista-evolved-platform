# Persistence policy

- **SQLite forbidden** for persistent state.
- **In-memory forbidden** for persistent state (caches and ephemeral state are allowed where documented).
- **JSON/YAML** allowed only for config, manifests, fixtures, and evidence. Not as primary store for mutable application data.
- **VistA is source of truth** where VistA owns the data (clinical, facility, etc.). Platform does not replicate VistA-owned data as the system of record.
- **Platform database** is only for control-plane and integration concerns: tenants, deployment profiles, capability/config, identity/integration metadata. Use a proper database (e.g. PostgreSQL) for platform persistence when implemented.
