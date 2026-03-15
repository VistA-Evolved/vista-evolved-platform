#!/usr/bin/env bash
# Check that no docs appear outside approved roots.
# Approved top-level dirs under docs/: tutorials, how-to, reference, explanation, adrs, runbooks
# Exit 1 if violations found.
set -euo pipefail

DOCS_DIR="docs"
APPROVED="tutorials how-to reference explanation adrs runbooks"
EXIT_CODE=0

if [ ! -d "$DOCS_DIR" ]; then
  echo "PASS: no docs/ directory found"
  exit 0
fi

for entry in "$DOCS_DIR"/*/; do
  dirname=$(basename "$entry")
  found=0
  for approved in $APPROVED; do
    if [ "$dirname" = "$approved" ]; then
      found=1
      break
    fi
  done
  if [ "$found" -eq 0 ]; then
    echo "FAIL: unapproved docs directory: docs/$dirname"
    EXIT_CODE=1
  fi
done

# Check for forbidden top-level paths
for forbidden in "reports" "docs/reports"; do
  if [ -d "$forbidden" ]; then
    echo "FAIL: forbidden directory exists: $forbidden"
    EXIT_CODE=1
  fi
done

if [ "$EXIT_CODE" -eq 0 ]; then
  echo "PASS: all docs directories are in approved roots"
fi

exit $EXIT_CODE
