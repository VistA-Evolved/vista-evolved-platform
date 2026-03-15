#!/usr/bin/env bash
# Check that raw port numbers don't appear outside approved config locations.
# Approved locations: packages/config/ports/, docs/reference/port-registry.md, .env*, docker-compose*
# This is a heuristic check — it flags suspicious patterns for human review.
set -euo pipefail

EXIT_CODE=0

# Search for common hardcoded port patterns in source code
# Exclude: node_modules, .git, artifacts, approved config files
SUSPICIOUS=$(grep -rn --include="*.ts" --include="*.tsx" --include="*.js" --include="*.mjs" \
  -E '(:\s*[0-9]{4,5}|port\s*[:=]\s*[0-9]{4,5}|PORT\s*[:=]\s*[0-9]{4,5})' \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=artifacts \
  apps/ packages/ 2>/dev/null || true)

if [ -n "$SUSPICIOUS" ]; then
  echo "WARN: potential hardcoded ports found (review manually):"
  echo "$SUSPICIOUS"
  echo ""
  echo "Ports should be defined in packages/config/ports/ or read from environment."
  # This is a WARN, not FAIL — false positives are possible
else
  echo "PASS: no suspicious hardcoded ports detected"
fi

exit $EXIT_CODE
