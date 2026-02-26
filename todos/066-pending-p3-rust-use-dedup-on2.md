---
status: pending
priority: p3
issue_id: "066"
tags: [code-review, rust, performance, quality]
dependencies: []
---

# Rust Analyzer: O(n²) Deduplication in `detectUseStatements`

## Problem Statement

`detectUseStatements()` in `packages/languages/rust/src/imports.ts` contains `if ([...imports.values()].includes(fullPath)) continue;`. This converts the Map values to a new array on every iteration and performs a linear search — O(n) per import, O(n²) total. For large files with many imports this wastes time unnecessarily.

## Findings

- **File:** `packages/languages/rust/src/imports.ts:22-23`
- `[...imports.values()].includes(fullPath)` — O(n) on every `useRe` match
- The check was meant to prevent re-importing paths already captured by `aliasRe`. However, `aliasRe` and `useRe` are actually mutually exclusive patterns (aliasRe requires `as`, useRe requires no `as`), so this check fires at most once per run and is effectively dead code.
- Replace with O(1) Set-based lookup if the check is needed at all.

## Proposed Solutions

### Option 1: Remove the dead check entirely (Recommended)

Since `aliasRe` and `useRe` patterns are mutually exclusive (aliasRe matches `use X as Y;`, useRe matches `use X;` without `as`), the deduplication check is never triggered. Remove it.

**Pros:** Simplest fix. Removes dead code.
**Cons:** If patterns are modified in the future and the check becomes needed, it won't exist.
**Effort:** Trivial
**Risk:** None

### Option 2: Replace with Set-based O(1) lookup

```typescript
const seenPaths = new Set(imports.values());
// ... in loop:
if (seenPaths.has(fullPath)) continue;
seenPaths.add(fullPath);
```

**Pros:** Correct if check is needed. O(1) lookup.
**Cons:** Rebuilding the Set on each iteration is still wasteful (though O(n) total not O(n²)).
**Effort:** Trivial
**Risk:** None

## Acceptance Criteria

- [ ] `detectUseStatements` has no O(n²) patterns
- [ ] Existing tests pass unchanged

## Work Log

- 2026-02-26: Identified during PR #16 code review
