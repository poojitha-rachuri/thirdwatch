---
status: complete
priority: p2
issue_id: "054"
tags: [code-review, java, quality, dead-code]
dependencies: []
---

# Java Analyzer: Dead Code in Annotation Method Detection Branch

## Problem Statement

In `packages/languages/java/src/analyzer.ts:172-178`, the `if (kind === "SPRING_MAPPING")` block and its `else` branch are identical. Both assign `method = match[1]!.toUpperCase()`. This is dead code — the conditional branch serves no purpose and signals a future distinction that was never implemented.

## Findings

- **File:** `packages/languages/java/src/analyzer.ts:172-178`

```typescript
let method: string;
if (kind === "SPRING_MAPPING") {
  method = match[1]!.toUpperCase();
} else {
  method = match[1]!.toUpperCase();
}
```

Both branches are byte-for-byte identical. This passes TypeScript strict checks but is confusing to future maintainers who might assume the branches differ.

## Proposed Solutions

### Option 1: Collapse to single assignment (Recommended)

**Approach:** Replace the if/else with `const method = match[1]!.toUpperCase();`.

**Pros:** Removes confusion, one line instead of five.
**Cons:** None.
**Effort:** Trivial
**Risk:** None

### Option 2: Add different treatment per kind

**Approach:** If there is a valid reason to treat RETROFIT vs SPRING_MAPPING differently (e.g., Retrofit `@DELETE` → `"DELETE"`, Spring `@DeleteMapping` → strip `Mapping` suffix first), implement it.

**Pros:** Correct behavior if the patterns diverge.
**Cons:** Currently there is no difference — premature.
**Effort:** Small
**Risk:** Low

## Recommended Action

To be filled during triage.

## Technical Details

- **Affected file:** `packages/languages/java/src/analyzer.ts:170-189`
- Related to the ANNOTATION_HTTP_PATTERNS defined at lines 23-28

## Acceptance Criteria

- [ ] No dead/duplicate code in the annotation method determination block
- [ ] Both RETROFIT and SPRING_MAPPING produce correct HTTP methods in test output

## Work Log

- 2026-02-25: Identified during PR #15 code review
