# Notion Sync Policy

> **The repo is canonical. Notion is a mirror.**

## Principles

1. **Repo wins.** All governance files, contracts, ADRs, and documentation live in the repo. Notion receives read-only summaries.
2. **Fixed sync targets.** Only approved content is pushed to Notion. AI and automation must not free-write arbitrary Notion pages.
3. **Intentional sync points.** Sync happens at approved merge/release points, not on every edit or commit.
4. **No credentials in repo.** Notion tokens and database IDs live in `scripts/notion/notion-sync-config.json` (gitignored) or environment variables.

## What gets synced to Notion

| Content | Source file | Direction |
|---------|------------|-----------|
| Source of truth index | `docs/reference/source-of-truth-index.md` | Repo → Notion |
| Decision index | `docs/reference/decision-index.yaml` | Repo → Notion |
| Ownership catalog | `.github/CODEOWNERS` | Repo → Notion |
| Roadmap / status | TBD | Repo → Notion |
| Release summaries | TBD | Repo → Notion |

## What does NOT get synced

- Raw code files
- Build artifacts or evidence
- Prompt content
- CI logs
- Unreviewed or draft content

## Status

**Scaffold only.** The sync script (`scripts/notion/export-approved-content.mjs`) is implemented but Notion API credentials are not connected. See `scripts/notion/README.md` for setup steps.

## Future: MCP integration

If Notion MCP servers become available in the AI tooling environment, the same policy applies:
- MCP may only push approved summaries.
- MCP must not read from Notion as source of truth.
- MCP config templates may be provided but credentials must not be committed.
