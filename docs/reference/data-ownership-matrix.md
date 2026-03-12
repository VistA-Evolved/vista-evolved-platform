# Data ownership matrix

| Data / entity | Source of truth | Platform DB | VistA | Notes |
|---------------|-----------------|-------------|--------|-------|
| Tenant | Platform | Yes | No | Control-plane |
| Facility | Platform / VistA | Reference only | Yes where clinical | See ADRs |
| Capability pack / module | Platform | Yes | No | Config |
| Deployment profile | Platform | Yes | No | Config |
| User / identity | Platform / IdP | Yes | No | Control-plane |
| Clinical data | VistA | No | Yes | VistA-owned |
| Offline / mobile policy | Platform | Yes | No | Config |

VistA is source of truth where VistA owns the data. Platform database is only for control-plane, config, and integration concerns. See `docs/reference/persistence-policy.md`.
