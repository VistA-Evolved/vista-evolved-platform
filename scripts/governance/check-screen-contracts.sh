#!/usr/bin/env bash
# Governance gate G1: Screen contract schema validation.
# Validates all screen-contract JSON instances in packages/contracts/screen-contracts/
# against the canonical schema in packages/contracts/schemas/screen-contract.schema.json.
#
# Checks:
#   1. If instances dir exists, the schema file must exist.
#   2. At least one *.json instance must be present.
#   3. Every instance must parse as valid JSON.
#   4. Every instance must validate against the schema (JSON Schema Draft 2020-12).
#   5. Every instance filename must equal ${surfaceId}.json.
#   6. No duplicate surfaceId values across instances.
#
# Requires: node (for npx ajv-cli). GitHub Actions ubuntu-latest has Node pre-installed.
# Exit 1 on any violation.
set -euo pipefail

SCHEMA="packages/contracts/schemas/screen-contract.schema.json"
INSTANCES_DIR="packages/contracts/screen-contracts"
EXIT_CODE=0
CHECKED=0
SURFACE_IDS=""

# --- Precondition: instances directory ---
if [ ! -d "$INSTANCES_DIR" ]; then
  echo "PASS: screen-contracts directory does not exist yet — nothing to validate"
  exit 0
fi

# --- Gate 1: Schema file must exist if instances dir exists ---
if [ ! -f "$SCHEMA" ]; then
  echo "FAIL: screen-contract schema not found at $SCHEMA"
  exit 1
fi

# --- Collect JSON files ---
shopt -s nullglob
JSON_FILES=("$INSTANCES_DIR"/*.json)
shopt -u nullglob

if [ ${#JSON_FILES[@]} -eq 0 ]; then
  echo "FAIL: $INSTANCES_DIR exists but contains no *.json files"
  exit 1
fi

# --- Gate 3: JSON parseability (check all before schema validation) ---
for json_file in "${JSON_FILES[@]}"; do
  basename_file=$(basename "$json_file")
  if ! node -e "JSON.parse(require('fs').readFileSync('$json_file','utf8'))" 2>/dev/null; then
    echo "FAIL: invalid JSON: $basename_file"
    EXIT_CODE=1
  fi
done

if [ "$EXIT_CODE" -ne 0 ]; then
  echo "FAIL: JSON parse errors found — skipping schema validation"
  exit 1
fi

# --- Gate 4: Schema validation via ajv-cli ---
# Install ajv-cli locally (no global install, no package.json change needed)
if ! npx --yes ajv-cli@5 validate \
  -s "$SCHEMA" \
  -d "$INSTANCES_DIR/*.json" \
  --spec=draft2020 2>&1; then
  echo "FAIL: schema validation failed"
  EXIT_CODE=1
fi

if [ "$EXIT_CODE" -ne 0 ]; then
  exit 1
fi

# --- Gate 5: Filename must equal ${surfaceId}.json ---
for json_file in "${JSON_FILES[@]}"; do
  basename_file=$(basename "$json_file")
  surface_id=$(node -e "const d=JSON.parse(require('fs').readFileSync('$json_file','utf8')); process.stdout.write(d.surfaceId || '')")
  if [ -z "$surface_id" ]; then
    echo "FAIL: missing surfaceId in $basename_file"
    EXIT_CODE=1
    continue
  fi
  expected_filename="${surface_id}.json"
  if [ "$basename_file" != "$expected_filename" ]; then
    echo "FAIL: filename mismatch: file is '$basename_file' but surfaceId is '$surface_id' (expected '$expected_filename')"
    EXIT_CODE=1
  fi
  SURFACE_IDS="$SURFACE_IDS $surface_id"
  CHECKED=$((CHECKED + 1))
done

# --- Gate 6: No duplicate surfaceIds ---
if [ -n "$SURFACE_IDS" ]; then
  DUPES=$(echo "$SURFACE_IDS" | tr ' ' '\n' | sort | uniq -d)
  if [ -n "$DUPES" ]; then
    echo "FAIL: duplicate surfaceId values found:"
    echo "$DUPES"
    EXIT_CODE=1
  fi
fi

# --- Summary ---
if [ "$EXIT_CODE" -eq 0 ]; then
  echo "PASS: $CHECKED screen-contract instance(s) validated against schema, filenames match surfaceIds, no duplicates"
else
  echo "FAIL: screen-contract validation failed"
fi

exit $EXIT_CODE
