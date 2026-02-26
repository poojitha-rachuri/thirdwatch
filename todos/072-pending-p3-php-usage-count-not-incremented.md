---
status: pending
priority: p3
issue_id: "072"
tags: [code-review, php, data-quality]
dependencies: []
---

# PHP Analyzer: `usage_count` Not Incremented When SDK Entry Is Deduplicated

## Problem Statement

When the PHP analyzer deduplicates SDK entries (merging multiple usages of the same provider into one `DependencyEntry`), it correctly appends to `locations[]` but never increments `usage_count`. The TDM always reports `usage_count: 1` for SDK entries regardless of how many times the SDK is used in the file.

This is the same P3 bug as Java #060 and the equivalent Rust issue.

## Findings

- **File:** `packages/languages/php/src/analyzer.ts:197-200`
- Current code:
  ```typescript
  const existing = emittedSdkProviders.get(provider);
  if (existing && existing.kind === "sdk") {
    existing.locations.push({ file: rel, line: lineNum, context: trimmed });
    // missing: existing.usage_count++
  }
  ```
- `usage_count` starts at 1 and never increases
- Consumers of the TDM who rely on `usage_count` for impact scoring will see incorrect data

## Proposed Solutions

### Option 1: Add `usage_count++` in the dedup branch (Recommended)

```typescript
if (existing && existing.kind === "sdk") {
  existing.locations.push({ file: rel, line: lineNum, context: trimmed });
  existing.usage_count++;
}
```

**Effort:** Trivial
**Risk:** None

## Recommended Action

Option 1.

## Technical Details

**Affected files:**
- `packages/languages/php/src/analyzer.ts:197-200`

**Related issues:**
- Java #060 — identical fix
- Rust equivalent

## Acceptance Criteria

- [ ] SDK entry used 3 times reports `usage_count: 3`
- [ ] New test verifying `usage_count` equals number of usage locations

## Work Log

- 2026-02-26: Filed during PR #17 review (PHP analyzer)
