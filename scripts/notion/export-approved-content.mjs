#!/usr/bin/env node
/**
 * Notion sync — export approved content summaries.
 *
 * This script reads canonical repo files and pushes summaries to Notion.
 * It does NOT make Notion the source of truth — the repo always wins.
 *
 * Prerequisites:
 *   - NOTION_TOKEN env var or in notion-sync-config.json
 *   - Notion databases created matching the config schema
 *
 * Usage:
 *   node scripts/notion/export-approved-content.mjs
 *   node scripts/notion/export-approved-content.mjs --dry-run
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(__dirname, 'notion-sync-config.json');
const DRY_RUN = process.argv.includes('--dry-run');

// --- Config ---

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    console.error('ERROR: notion-sync-config.json not found.');
    console.error('Copy notion-sync-config.example.json and fill in credentials.');
    process.exit(1);
  }
  const raw = readFileSync(CONFIG_PATH, 'utf-8');
  return JSON.parse(raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw);
}

// --- Approved content readers ---

function readSourceOfTruthIndex() {
  const path = resolve(__dirname, '../../docs/reference/source-of-truth-index.md');
  if (!existsSync(path)) return null;
  return { title: 'Source of Truth Index', content: readFileSync(path, 'utf-8') };
}

function readDecisionIndex() {
  const path = resolve(__dirname, '../../docs/reference/decision-index.yaml');
  if (!existsSync(path)) return null;
  return { title: 'Decision Index', content: readFileSync(path, 'utf-8') };
}

function readCodeowners() {
  const path = resolve(__dirname, '../../.github/CODEOWNERS');
  if (!existsSync(path)) return null;
  return { title: 'Ownership Catalog', content: readFileSync(path, 'utf-8') };
}

// --- Notion API (scaffold) ---

async function pushToNotion(config, payload) {
  const token = process.env.NOTION_TOKEN || config.notionToken;
  if (!token) {
    console.error('ERROR: NOTION_TOKEN not set. Skipping push.');
    return false;
  }

  // TODO: Implement actual Notion API calls using @notionhq/client or fetch
  // For each payload item, create or update a page in the configured database.
  // Database IDs come from config.databases[target].
  console.log(`[${DRY_RUN ? 'DRY RUN' : 'PUSH'}] Would sync: ${payload.title}`);
  return true;
}

// --- Main ---

async function main() {
  console.log('Notion sync — export approved content');
  console.log(DRY_RUN ? '(dry run mode — no API calls)' : '');
  console.log('');

  const config = loadConfig();

  const payloads = [
    readSourceOfTruthIndex(),
    readDecisionIndex(),
    readCodeowners(),
  ].filter(Boolean);

  console.log(`Found ${payloads.length} sync targets.`);

  for (const payload of payloads) {
    await pushToNotion(config, payload);
  }

  console.log('');
  console.log('Done. Repo remains source of truth. Notion is mirror only.');
}

main().catch((err) => {
  console.error('Sync failed:', err.message);
  process.exit(1);
});
