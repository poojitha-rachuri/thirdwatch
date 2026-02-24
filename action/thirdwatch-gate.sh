#!/usr/bin/env bash
# thirdwatch-gate.sh — Scan + Upload script for any CI system
#
# This script scans your codebase for external dependencies and optionally
# uploads the TDM to Thirdwatch cloud. For full diff + PR gating, use the
# GitHub Action (action/).
#
# Prerequisites: Node.js 20+, jq
# Usage: THIRDWATCH_TOKEN=xxx ./thirdwatch-gate.sh [path]
set -euo pipefail

SCAN_PATH="${1:-.}"
OUTPUT="./thirdwatch.json"

echo "→ Running thirdwatch scan..."
npx thirdwatch@latest scan "$SCAN_PATH" --output "$OUTPUT"

if command -v jq &> /dev/null; then
  FOUND=$(jq '.metadata.total_dependencies_found' "$OUTPUT")
  echo "→ Found $FOUND external dependencies"
else
  echo "→ Scan complete (install jq to see dependency count)"
fi

if [ -n "${THIRDWATCH_TOKEN:-}" ]; then
  echo "→ Uploading TDM for monitoring..."
  npx thirdwatch@latest push "$OUTPUT" --token "$THIRDWATCH_TOKEN"
fi

echo "✓ Thirdwatch scan complete. TDM at: $OUTPUT"
