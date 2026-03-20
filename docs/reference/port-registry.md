# Port registry

Canonical list of network ports and service endpoints used by the platform.

| Service / component | Port (default) | Protocol | Owner |
|---------------------|----------------|----------|--------|
| Control plane review API | 4500 | HTTP | platform |
| Control plane admin API | 4510 | HTTP | platform |
| Tenant admin workspace | 4520 | HTTP | platform |
| Control plane PostgreSQL | 5433 | TCP | platform |
| Admin console (dev) | TBD | HTTP | platform |
| Events / WebSocket | TBD | WS | platform |

Port assignments and hostnames are configured in `packages/config/ports/`. Override via environment or deployment config.
