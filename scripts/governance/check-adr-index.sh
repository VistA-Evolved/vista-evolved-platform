#!/usr/bin/env bash
# Check ADR governance in docs/adrs/:
#   1. All ADR files are registered in decision-index.yaml
#   2. No legacy ADR filenames (must use VE-PLAT- prefix)
#   3. No duplicate ADR files (same ADR, two filenames)
#   4. ADR H1/title matches the enterprise ID from the filename
#   5. No duplicate IDs in decision-index.yaml
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

# --- Gate 1: All platform ADR files registered in index ---
for adr_file in "$ADR_DIR"/*ADR-*.md; do
  [ -f "$adr_file" ] || continue
  basename_file=$(basename "$adr_file")
  if ! grep -q "$basename_file" "$INDEX"; then
    echo "FAIL: ADR not registered in decision-index.yaml: $basename_file"
    EXIT_CODE=1
  fi
done

# --- Gate 2: Reject legacy platform ADR filenames (no VE-PLAT- prefix) ---
for adr_file in "$ADR_DIR"/ADR-*.md; do
  [ -f "$adr_file" ] || continue
  basename_file=$(basename "$adr_file")
  echo "FAIL: legacy platform ADR filename (must use VE-PLAT- prefix): $basename_file"
  EXIT_CODE=1
done

# --- Gate 3: Duplicate file detection (same enterprise ID, two files) ---
declare -A SEEN_IDS
for adr_file in "$ADR_DIR"/VE-PLAT-ADR-*.md; do
  [ -f "$adr_file" ] || continue
  basename_file=$(basename "$adr_file")
  # Extract enterprise ID from filename: VE-PLAT-ADR-NNNN
  eid=$(echo "$basename_file" | grep -oP 'VE-PLAT-ADR-\d+' || true)
  if [ -n "$eid" ]; then
    if [ -n "${SEEN_IDS[$eid]:-}" ]; then
      echo "FAIL: duplicate ADR files for $eid: ${SEEN_IDS[$eid]} and $basename_file"
      EXIT_CODE=1
    else
      SEEN_IDS[$eid]="$basename_file"
    fi
  fi
done

# --- Gate 4: ADR H1/title matches enterprise ID from filename ---
for adr_file in "$ADR_DIR"/VE-PLAT-ADR-*.md; do
  [ -f "$adr_file" ] || continue
  basename_file=$(basename "$adr_file")
  eid=$(echo "$basename_file" | grep -oP 'VE-PLAT-ADR-\d+' || true)
  if [ -n "$eid" ]; then
    # Check that the first H1 line contains the enterprise ID
    h1_line=$(grep -m1 '^# ' "$adr_file" || true)
    if [ -n "$h1_line" ]; then
      if ! echo "$h1_line" | grep -q "$eid"; then
        echo "FAIL: H1 title does not contain enterprise ID $eid: $adr_file"
        echo "  H1: $h1_line"
        EXIT_CODE=1
      fi
    else
      echo "FAIL: no H1 heading found in $adr_file"
      EXIT_CODE=1
    fi
  fi
done

# --- Gate 5: No duplicate IDs in decision-index.yaml ---
DUPES=$(grep '^\s*- id:' "$INDEX" | sort | uniq -d)
if [ -n "$DUPES" ]; then
  echo "FAIL: duplicate ADR IDs in decision-index.yaml:"
  echo "$DUPES"
  EXIT_CODE=1
fi

if [ "$EXIT_CODE" -eq 0 ]; then
  echo "PASS: all ADR governance checks passed (5 gates)"
fi

exit $EXIT_CODE
