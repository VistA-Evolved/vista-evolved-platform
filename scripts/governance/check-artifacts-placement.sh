#!/usr/bin/env bash
# Check that evidence/artifact files are not placed inside docs/.
# Patterns: *.log, *.json evidence, verification-output*, probe-*, test-result*
set -euo pipefail

EXIT_CODE=0

# Look for common evidence patterns inside docs/
EVIDENCE=$(find docs/ -type f \( \
  -name "*.log" -o \
  -name "verification-output*" -o \
  -name "probe-*" -o \
  -name "test-result*" -o \
  -name "evidence-*" -o \
  -name "*-probe.json" \
  \) 2>/dev/null || true)

if [ -n "$EVIDENCE" ]; then
  echo "FAIL: evidence/artifact files found in docs/ (should be in artifacts/):"
  echo "$EVIDENCE"
  EXIT_CODE=1
else
  echo "PASS: no misplaced evidence files in docs/"
fi

exit $EXIT_CODE
