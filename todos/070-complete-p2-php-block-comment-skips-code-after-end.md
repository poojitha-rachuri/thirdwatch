---
status: complete
priority: p2
issue_id: "070"
tags: [code-review, php, false-negative, comments]
dependencies: []
---

# PHP Analyzer: Block Comment Termination Skips Code on Same Line After `*/`

## Problem Statement

`analyzePhp()` in `packages/languages/php/src/analyzer.ts` uses an `inBlockComment` state machine to skip block comments. However, when `*/` terminates a block comment mid-line (e.g., `*/ $pdo = new PDO('mysql:...')`), the `continue` statement after setting `inBlockComment = false` causes the rest of that line to be silently skipped. Real dependency-detecting code after `*/` on the same line is never analyzed.

This is the PHP equivalent of Rust issue #064 (marked P2).

## Findings

- **File:** `packages/languages/php/src/analyzer.ts:144-146`
- Current code:
  ```typescript
  if (inBlockComment) {
    if (trimmed.includes("*/")) inBlockComment = false;
    continue; // BUG: always skips, even when inBlockComment just became false
  }
  ```
- Example false negative: `*/ $pdo = new PDO('mysql:host=localhost', $u, $p);` — this entire line is skipped, missing the MySQL infrastructure dependency
- Also, line that starts with `/*` and contains `*/` is entirely skipped even though content after the closing `*/` could contain code

## Proposed Solutions

### Option 1: Process remainder of line after comment ends (Recommended)

```typescript
if (inBlockComment) {
  const endIdx = trimmed.indexOf("*/");
  if (endIdx !== -1) {
    inBlockComment = false;
    // Don't continue — the rest of trimmed after '*/' may contain real code
    // Fall through to normal pattern matching below
    // (line will be processed as if it starts after the block comment)
  } else {
    continue; // still inside block comment, skip
  }
}
```

**Pros:** Correctly handles `*/ code()` on same line.
**Cons:** Slightly more complex logic.
**Effort:** Small
**Risk:** Low — only affects lines with `*/` mid-line, which are uncommon but valid PHP

### Option 2: Strip block comment regions before processing (Cleaner but larger change)

Pre-process the source to remove all block comment regions, then process the cleaned source.

**Pros:** Comprehensive; handles all edge cases including inline `/* */` comments.
**Cons:** More code; changes analyzer structure.
**Effort:** Medium
**Risk:** Low

## Recommended Action

Option 1 — minimal and targeted fix consistent with how this was fixed in the Java analyzer (#057).

## Technical Details

**Affected files:**
- `packages/languages/php/src/analyzer.ts` — main loop block comment handling (lines 144-150)

**Related issues:**
- Rust #064 — same pattern (P2)
- Java #057 — fixed (complete)

## Acceptance Criteria

- [ ] `*/ $pdo = new PDO('mysql:host=localhost', $u, $p);` is analyzed and MySQL dependency detected
- [ ] Lines entirely inside block comments are still skipped
- [ ] All 24 existing tests continue to pass

## Work Log

- 2026-02-26: Filed during PR #17 review (PHP analyzer)
