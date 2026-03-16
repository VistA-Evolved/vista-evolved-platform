#!/usr/bin/env bash
# Check that all ADR files in docs/adrs/ are registered in decision-index.yaml.
# Exit 1 if any ADR file is missing from the index.
set -euo pipefail

INDEX="docs/reference/decision-index.yaml"
ADR_DIR="docs/adrs"
EXIT_CODE=0

if [ ! -f "$INDEX" ]; then
  echo "FAIL: decision-index.yaml not found at $INDEX"
  exit 1
fi

if [ ! -d "$ADR_DIR" ]; then
  echo "PASS: no ADR directory found"
  exit 0
fi

for adr_file in "$ADR_DIR"/*ADR-*.md; do
  [ -f "$adr_file" ] || continue
  basename_file=$(basename "$adr_file")
  if ! grep -q "$basename_file" "$INDEX"; then
    echo "FAIL: ADR not registered in decision-index.yaml: $basename_file"
    EXIT_CODE=1
  fi
done

# Check for duplicate IDs in decision-index.yaml
DUPES=$(grep '^\s*- id:' "$INDEX" | sort | uniq -d)
if [ -n "$DUPES" ]; then
  echo "FAIL: duplicate ADR IDs in decision-index.yaml:"
  echo "$DUPES"
  EXIT_CODE=1
fi

if [ "$EXIT_CODE" -eq 0 ]; then
  echo "PASS: all ADRs registered and no duplicate IDs"
fi

exit $EXIT_CODE
