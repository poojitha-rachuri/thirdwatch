#!/usr/bin/env bash
# thirdwatch-gate.sh — Generic CI gate script for any CI system
# Usage: THIRDWATCH_TOKEN=xxx ./thirdwatch-gate.sh [path]
set -euo pipefail

SCAN_PATH="${1:-.}"
OUTPUT="./thirdwatch.json"

echo "→ Running thirdwatch scan..."
npx thirdwatch@latest scan "$SCAN_PATH" --output "$OUTPUT"

FOUND=$(jq '.metadata.total_dependencies_found' "$OUTPUT")
echo "→ Found $FOUND external dependencies"

if [ -n "${THIRDWATCH_TOKEN:-}" ]; then
  echo "→ Uploading TDM for monitoring..."
  npx thirdwatch@latest push "$OUTPUT" --token "$THIRDWATCH_TOKEN"
fi

echo "✓ Thirdwatch scan complete. TDM at: $OUTPUT"
