---
status: complete
priority: p2
issue_id: "075"
tags: [code-review, php, data-quality, manifests]
dependencies: []
---

# PHP Analyzer: `resolveVersion` Leaves Trailing Range Constraints in `current_version`

## Problem Statement

`resolveVersion()` in `packages/languages/php/src/manifests.ts` strips only leading constraint characters using `^[\^~>=<|*\s]+`. For compound Composer constraints like `">=2.0 <3.0"` or `"^1.0 || ^2.0"`, this produces invalid version strings (`"2.0 <3.0"`, `"1.0 || ^2.0"`) in the TDM `current_version` field. Composer compound ranges are common in production PHP projects.

## Findings

- **File:** `packages/languages/php/src/manifests.ts:62-65`
- Current behavior:
  - `"^13.0"` → `"13.0"` ✅ (correct — fixture test passes)
  - `">=2.0 <3.0"` → `"2.0 <3.0"` ❌ (not a valid semver version)
  - `"^1.0 || ^2.0"` → `"1.0 || ^2.0"` ❌ (not a valid semver version)
  - `"~2.0"` → `"2.0"` ✅
  - `"*"` → `"*"` ✅ (fallback to constraint string)
- The `manifests.test.ts` only tests `"^13.0"` → `"13.0"`, which doesn't expose the compound constraint bug
- Python's `resolveVersion` correctly extracts first version token only: uses `([^,\s]+)` stop group

## Proposed Solutions

### Option 1: Composer-aware version extraction (Recommended)

```typescript
function resolveVersion(constraint: string): string {
  // Plain version number: no prefix needed
  if (/^\d/.test(constraint)) return constraint;
  // ^X.Y or ~X.Y → extract X.Y (Composer caret/tilde range)
  const caret = constraint.match(/^[~^]\s*([^\s,|]+)/);
  if (caret) return caret[1]!;
  // >=X.Y or >X.Y → extract first version token only
  const gte = constraint.match(/^>=?\s*([^\s,|<>]+)/);
  if (gte) return gte[1]!;
  // Wildcard or unparseable
  return constraint.replace(/^[\^~>=<|*\s]+/, "") || "unknown";
}
```

**Pros:** Handles all common Composer constraint syntaxes; produces valid semver for compound ranges.
**Cons:** Slightly more code.
**Effort:** Small
**Risk:** Low — only affects `current_version` field in TDM package entries

### Option 2: Extract first whitespace-delimited token after leading operators

```typescript
function resolveVersion(constraint: string): string {
  const cleaned = constraint.replace(/^[\^~>=<|*\s]+/, "");
  // If trailing constraint remains (space + operator), take only first token
  return cleaned.split(/[\s|]+/)[0] || constraint;
}
```

**Pros:** Minimal change.
**Cons:** Fragile for edge cases like `"1.0-2.0"` (hyphen range).
**Effort:** Trivial

## Recommended Action

Option 1 — matches the Python analyzer pattern and handles all common Composer cases.

## Technical Details

**Affected files:**
- `packages/languages/php/src/manifests.ts` — `resolveVersion()` function

## Acceptance Criteria

- [ ] `">=2.0 <3.0"` → `"2.0"` (first version token extracted)
- [ ] `"^1.0 || ^2.0"` → `"1.0"` (first version token extracted)
- [ ] `"^13.0"` → `"13.0"` (existing behavior preserved)
- [ ] `"*"` → `"*"` or `"unknown"` (wildcard preserved or normalized)
- [ ] New test case for compound constraints added to manifests.test.ts

## Work Log

- 2026-02-26: Filed during PR #17 review (PHP analyzer) — pattern agent finding
