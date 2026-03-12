# Nx adoption plan

- **Current state:** Repo layout is Nx-compatible (apps/*, packages/*). No Nx installed in this bootstrap stage.
- **Next steps when adopting Nx:**
  1. Add `nx` and `@nx/*` to the workspace (e.g. pnpm/npm at root).
  2. Add `nx.json` and configure cache, tasks, and boundaries.
  3. Define project boundaries: each app and each package as a project; enforce deps via `enforceModuleBoundaries` and tags (e.g. `scope:control-plane`, `scope:contracts`).
  4. Wire build/serve/test to Nx targets; use `packages/contracts` as the contract source for codegen.
- **Placeholders:** No application code beyond READMEs and .gitkeep in this stage.
