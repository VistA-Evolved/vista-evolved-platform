# Notion Sync Scaffold

> **Repo is canonical. Notion is a mirror.**

This directory contains the scaffold for exporting approved repo content summaries to Notion.
Notion does NOT own any data. The repo is always the source of truth.

## Status

**Not yet active.** Credentials and Notion database IDs must be configured before sync works.

## How it works

1. `export-approved-content.mjs` reads approved repo files and generates summary payloads.
2. Payloads are sent to Notion via the Notion API (requires `NOTION_TOKEN` and database IDs).
3. Sync happens manually or from CI at approved merge points — not on every edit.

## Setup

1. Copy `notion-sync-config.example.json` to `notion-sync-config.json` (gitignored).
2. Set `NOTION_TOKEN` in environment or in the config file.
3. Create Notion databases matching the schema in the config.
4. Run: `node scripts/notion/export-approved-content.mjs`

## Sync targets

| Target | Source | Notion database |
|--------|--------|-----------------|
| Source of truth index | `docs/reference/source-of-truth-index.md` | Configured in config |
| Decision index | `docs/reference/decision-index.yaml` | Configured in config |
| Roadmap / status | TBD | Configured in config |
| Release summaries | TBD | Configured in config |
| Ownership catalog | `.github/CODEOWNERS` | Configured in config |

## Rules

- AI must not free-write arbitrary Notion pages.
- Sync targets must be fixed and intentional.
- Only approved summaries and indexes are exported.
- See `docs/reference/notion-sync-policy.md` for the full policy.
