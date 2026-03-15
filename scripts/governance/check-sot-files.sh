#!/usr/bin/env bash
# Check that required source-of-truth files exist.
set -euo pipefail

EXIT_CODE=0

REQUIRED_FILES=(
  "AGENTS.md"
  "CLAUDE.md"
  ".github/CODEOWNERS"
  ".github/copilot-instructions.md"
  "docs/reference/source-of-truth-index.md"
  "docs/reference/decision-index.yaml"
  "docs/reference/doc-governance.md"
  "docs/reference/contract-system.md"
  "docs/reference/boundary-policy.md"
  "docs/reference/persistence-policy.md"
  "docs/reference/port-registry.md"
  "docs/reference/docs-policy.md"
  "docs/explanation/governed-build-protocol.md"
  "docs/explanation/ai-coding-governance-and-sdlc.md"
)

for f in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$f" ]; then
    echo "FAIL: required file missing: $f"
    EXIT_CODE=1
  fi
done

if [ "$EXIT_CODE" -eq 0 ]; then
  echo "PASS: all required source-of-truth files present"
fi

exit $EXIT_CODE
