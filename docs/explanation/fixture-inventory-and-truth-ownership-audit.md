# Data Source Policy — VistA-Only (Fixture Purge Complete)

> **Scope:** All data surfaces in `vista-evolved-platform` tenant-admin.
>
> **Date:** 2026-03-21
>
> **Status:** ALL FIXTURE FILES DELETED. VistA is the sole data source.

## Policy

**NO fixture files. NO JSON fallbacks. NO alternate data sources.**

All tenant-admin routes read from and write to the live VistA system exclusively.
If VistA is unreachable, routes return `{ok: false, source: "error", error: "..."}`.

The `fixtures/` directory and all JSON fixture files (`users.json`, `roles.json`,
`facilities.json`, `_fixture-manifest.json`) were permanently deleted on 2026-03-21.

## What was removed

| Former file | Former class | Replacement |
|------------|-------------|-------------|
| `fixtures/users.json` | Degraded-mode fallback | VistA File 200 via `ORWU NEWPERS` + `DDR GETS` |
| `fixtures/roles.json` | Degraded-mode fallback | VistA File 19.1 via `DDR LISTER` |
| `fixtures/facilities.json` | Degraded-mode fallback | VistA Files 4/40.8/44/42 via `XUS DIVISION GET` + `ORWU CLINLOC` + `ORQPT WARDS` |
| `fixtures/_fixture-manifest.json` | Metadata | Deleted (no fixtures to manifest) |

## Enforcement

1. `server.mjs` header comment declares VistA-Only mode
2. `README.md` documents the policy
3. `.cursor/rules/vista-only-data-source.mdc` prevents reintroduction
4. No `readFile` calls for JSON data in any route
5. No `source: 'fixture'` in any API response
6. Code review: any fixture/fallback reintroduction is a rejection-worthy violation

## Why this matters

Fixtures created a false sense of functionality. Routes appeared to "work" but
returned stale JSON data instead of real VistA state. This masked integration
gaps and prevented detection of broken VistA communication paths. The user
could not tell if their changes were actually reaching VistA or just being
displayed from cached JSON files.
