# Port registry

Canonical list of network ports and service endpoints used by the platform.

| Service / component | Port (default) | Protocol | Owner |
|---------------------|----------------|----------|--------|
| Control plane API | TBD | HTTP | platform |
| Admin console (dev) | TBD | HTTP | platform |
| Events / WebSocket | TBD | WS | platform |

Port assignments and hostnames are configured in `packages/config/ports/`. Override via environment or deployment config.
