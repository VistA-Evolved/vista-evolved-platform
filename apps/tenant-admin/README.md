# Tenant Admin — Fixture-Backed Prototype Shell

> **Implementation posture:** Fixture-backed prototype.
> **VistA grounding:** Not yet connected. All data sourced from static fixture files.
> **Runtime:** Standalone Fastify + SPA on port 4520.

---

## What this is

A working **prototype shell** for tenant-scoped operational administration.
It demonstrates the 6 first-slice surfaces with correct layout, navigation,
filter rails, context rails, breadcrumbs, and badge vocabulary — all backed
by **static fixture data**, not live VistA or platform-database reads.

### Surfaces (all fixture-backed)

| Surface | Route | Data source |
|---------|-------|-------------|
| Dashboard | `#/dashboard` | Fixture counts + integration-pending |
| User List | `#/users` | `fixtures/users.json` (4 users) |
| User Detail | `#/users/:id` | `fixtures/users.json` |
| Role Assignment | `#/roles` | `fixtures/roles.json` (6 keys) |
| Facility List | `#/facilities` | `fixtures/facilities.json` (hierarchical) |
| Facility Detail | `#/facilities/:id` | `fixtures/facilities.json` |

### What is NOT yet real

- No VistA RPC connection (File 200, 19.1, 4, 44 reads not wired)
- No platform database reads
- No tenant-scoped session auth (tenantId passed via query param)
- No write workflows (all surfaces are read-only against fixtures)
- Dashboard VistA grounding always shows `integration-pending`
- User/facility grounding badges reflect fixture data, not live truth

### What IS honestly working

- Shell layout, navigation, tenant banner, status bar
- Filter rails with search + dropdown filters on list surfaces
- Context rails on detail surfaces
- Breadcrumb navigation on detail surfaces
- Source-posture badge system (`FIXTURE` consistently displayed)
- Handoff from operator console (tenantId + cpReturnUrl)
- Return-to-operator link in status bar

---

## Running

```bash
cd apps/tenant-admin
npm start          # port 4520
```

Open: `http://127.0.0.1:4520/?tenantId=test-001#/dashboard`

Or launch from the operator console via the tenant-admin handoff button.

---

## Architecture references

| Doc | Purpose |
|-----|---------|
| `docs/explanation/tenant-admin-architecture-and-boundaries.md` | Workspace identity, concern areas, boundaries |
| `docs/explanation/tenant-admin-vista-truth-map.md` | VistA file/RPC grounding targets |
| `docs/explanation/tenant-admin-design-contract-v1.md` | Shell anatomy, badge rules, per-surface checklists |
| `docs/explanation/tenant-admin-personas-jobs-and-first-slice-journeys.md` | Personas, jobs, first-slice surfaces |
| `docs/explanation/operator-to-tenant-admin-handoff-model.md` | Cross-workspace transition contract |

---

## Next steps toward grounding

1. VistA admin truth discovery — map actual File 200, 19.1, 4, 44 read paths
2. Replace fixture-backed user/role surfaces with grounded reads
3. Replace fixture-backed facility surfaces with grounded reads
4. Add guided write workflows (terminal-backed, not direct VistA web writes)
