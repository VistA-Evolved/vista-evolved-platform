# VE-PLAT-ADR-0007: Unified Admin UI (apps/admin-ui)

**Status:** accepted
**Date:** 2026-03-23
**Deciders:** Platform team

## Context

Before this decision, VistA Evolved had two separate frontend surfaces for
administration:

1. **`apps/control-plane/public/`** — A vanilla JS/HTML/CSS single-page
   application serving the Platform Operations (operator) console. Reached
   on port 4510.
2. **`apps/tenant-admin/public/`** — A separate vanilla JS/HTML/CSS SPA for
   Site Administration (tenant) console. Reached on port 4520.

Problems with the split approach:

- **Inconsistent UX:** Two codebases with different styling, component
  libraries, and interaction patterns, making it impossible to enforce a
  coherent enterprise design language.
- **Duplication:** Authentication flows, table rendering, error handling, and
  status badges were reimplemented twice without shared abstractions.
- **Quality ceiling:** Vanilla JS without TypeScript, a component system, or
  accessibility primitives made it hard to meet enterprise UX standards
  (comparable to Epic/Cerner reference consoles requested in the audit).
- **Routing fragmentation:** The operator console had routing bugs where Pack
  Catalog, Billing, and System Config failed to render due to client-side
  router state issues.
- **No i18n support:** Vanilla apps had no path to supporting en/es/fil/ar
  locales required for international VA deployments and partner sites.

Alternatives considered:

| Option | Verdict |
|--------|---------|
| Patch the two vanilla apps | Rejected — same quality ceiling; duplication remains |
| Vue 3 + Pinia | Not selected — React ecosystem has stronger Next.js alignment |
| Remix | Not selected — App Router (Next.js 15) already adopted |
| Separate Next.js apps per console | Rejected — doubles build/deploy complexity |
| Single Next.js app with route namespacing | **Selected** |

## Decision

Introduce `apps/admin-ui` as the single Next.js 15 (App Router) application
that hosts both consoles under separate URL namespaces:

- `/tenant/*` — Site Administration console (backed by `apps/tenant-admin` API on port 4520)
- `/operator/*` — Platform Operations console (backed by `apps/control-plane-api` API on port 4510)

### Technology choices

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Framework | Next.js 15 App Router | Aligned with React 19; best-in-class DX |
| Component system | shadcn/ui (Radix primitives) | Accessible, unstyled-first, composable |
| Styling | Tailwind CSS 4 | Utility-first; fast iteration; dark-mode first-class |
| Tables | TanStack Table v8 | Headless; works with shadcn/ui cells |
| Forms | React Hook Form + Zod | Type-safe validation; minimal re-renders |
| i18n | Custom `I18nProvider` + message catalogs | Lightweight; no routing changes required; supports RTL (ar) |
| Icons | lucide-react | Consistent with shadcn/ui ecosystem |

### API proxy architecture

`next.config.ts` rewrites proxy all `/api/tenant/*` and `/api/operator/*`
requests to the respective backend services. The frontend never constructs
backend URLs directly.

### Coexistence with legacy apps

The two legacy vanilla apps (`apps/control-plane/public/`, `apps/tenant-admin/public/`)
remain in place as the authoritative backends' built-in fallback UI. They are
**not deleted**. During the transition period:

- `apps/admin-ui` is the primary UI for all new development.
- Legacy UIs continue to serve requests on their native ports as a fallback.
- Once `apps/admin-ui` is confirmed stable in a deployment, the legacy public
  directories may be archived (separate ADR required).

## Consequences

- Single shared component library eliminates UX inconsistency.
- TypeScript end-to-end eliminates a class of runtime type errors.
- Next.js build pipeline catches serialization issues at build time.
- i18n is now structurally possible; message catalogs for en/es/fil/ar added.
- Locale switcher is present in every AppShell header.
- RTL layout (Arabic) is handled via `document.dir` toggling.
- Legacy vanilla apps are preserved; no existing functionality is removed.
- Deploy complexity increases by one Node.js process (`apps/admin-ui` on its
  own port, e.g., 3000). This is documented in `docs/reference/port-registry.md`.
