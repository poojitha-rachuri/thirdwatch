---
status: pending
priority: p2
issue_id: "007"
tags: [code-review, performance, security]
dependencies: ["005"]
---

# Cap Error Summary String in `TDMValidationError` Constructor

## Problem Statement

With `allErrors: true`, Ajv collects every single validation violation. For a TDM with 10,000 invalid entries, the `TDMValidationError` constructor's `.map().join()` produces an error message string that can be **hundreds of kilobytes long**. This:
- Allocates unbounded heap memory
- Potentially logs 700 KB of text to stdout
- Causes performance issues in test runners and log aggregators

This is both a performance issue (tracked in performance review) and a security amplification vector (Security Finding F4).

## Findings

**File:** `packages/tdm/src/validate.ts`, lines 147–154

```typescript
constructor(errors: NonNullable<typeof _validate.errors>) {
  const summary = errors
    .map((e: ErrorObject) => `${e.instancePath || "(root)"}: ${e.message ?? "unknown error"}`)
    .join("; ");  // Can be 700 KB+ with 10,000 errors
  super(`TDM validation failed: ${summary}`);
```

The structured `errors` array is the right place for programmatic consumers. The human-readable `message` only needs a bounded subset.

## Proposed Solutions

### Option A — Cap at N=5 with trailing count (Recommended)

```typescript
constructor(rawErrors: ErrorObject[]) {
  const MAX_INLINE = 5;
  const shown = rawErrors.slice(0, MAX_INLINE);
  const rest = rawErrors.length - shown.length;
  const summary = shown
    .map((e) => `${e.instancePath || "(root)"}: ${e.message ?? "unknown error"}`)
    .join("; ");
  const suffix = rest > 0 ? `; ... and ${rest} more error(s)` : "";
  super(`TDM validation failed: ${summary}${suffix}`);
  this.name = "TDMValidationError";
  this.issues = rawErrors.map(toValidationIssue); // Full list via issues property
}
```

- Pros: O(1) worst-case message size; full data still available on `.issues`; clear UX with count
- Cons: First error might not be the most important (Ajv returns them in schema-traversal order)
- Effort: Small | Risk: Low

### Option B — Always truncate to 1 error with count
Simpler but less useful for debugging multi-field invalid TDMs.
- Effort: Trivial | Risk: Low

## Recommended Action

Option A. Combine this fix with todo #005 (owned `TDMValidationIssue` type) since both touch the constructor.

## Acceptance Criteria

- [ ] `TDMValidationError.message` is bounded regardless of error count
- [ ] Full error details still accessible via `.issues` (or `.errors`)
- [ ] Test: constructing `TDMValidationError` with 1000 errors produces a message under 2 KB
- [ ] Test: trailing count is shown when errors exceed the cap

## Work Log

- 2026-02-21: Found during performance + security review of PR #1
