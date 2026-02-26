---
status: pending
priority: p2
issue_id: "064"
tags: [code-review, rust, false-positive, comments]
dependencies: []
---

# Rust Analyzer: Block Comment `/* ... */` Content Not Skipped in Analysis Loop

## Problem Statement

`analyzeRust()` in `packages/languages/rust/src/analyzer.ts` only skips lines starting with `//`. Content inside Rust `/* ... */` block comments is still analyzed and can produce false-positive dependency entries. This is the same issue fixed in the Java analyzer as P2 #057.

Note: Rust supports nested block comments (`/* /* nested */ */`) which standard `inBlockComment` boolean tracking doesn't handle. However, nested comments are rare in practice and simple state machine tracking handles the common cases correctly.

## Findings

- **File:** `packages/languages/rust/src/analyzer.ts:120`
- `if (trimmed.startsWith("//")) continue;` — only single-line comments skipped
- Example false positive: content inside `/* ... */` block (e.g., documentation or commented-out code with URLs) would be analyzed

## Proposed Solutions

### Option 1: Add `inBlockComment` state tracking (Recommended)

```typescript
let inBlockComment = false;
for (let i = 0; i < lines.length; i++) {
  const trimmed = lines[i]!.trim();

  if (trimmed.startsWith("//")) continue;
  if (inBlockComment) {
    if (trimmed.includes("*/")) inBlockComment = false;
    continue;
  }
  if (trimmed.startsWith("/*")) {
    if (!trimmed.includes("*/")) inBlockComment = true;
    continue;
  }
  // ... rest of analysis
}
```

**Pros:** Consistent with Java analyzer fix (057). Handles standard `/* */` blocks correctly.
**Cons:** Doesn't handle Rust's nested block comments (`/* /* */ */`). Acceptable for Phase 1.
**Effort:** Small
**Risk:** None

## Acceptance Criteria

- [ ] Content inside `/* ... */` block does not produce dependency entries
- [ ] `//` comment lines still correctly skipped
- [ ] Single-line `/* comment */` handled correctly

## Work Log

- 2026-02-26: Identified during PR #16 code review
