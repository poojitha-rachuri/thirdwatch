---
status: complete
priority: p2
issue_id: "057"
tags: [code-review, java, false-positive, comments]
dependencies: []
---

# Java Analyzer: Content Inside Multi-Line Block Comments Not Fully Skipped

## Problem Statement

`analyzeJava` in `packages/languages/java/src/analyzer.ts` attempts to skip comment lines by checking if `trimmed` starts with `//`, `*`, or `/*`. However, this check is insufficient for content lines within multi-line block comments (`/* ... */`) that don't begin with `*`. Code examples inside Javadoc, commented-out code blocks, or documentation with URL examples can trigger false-positive dependency detections.

## Findings

- **File:** `packages/languages/java/src/analyzer.ts:132`

```typescript
if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;
```

Consider this valid Java:
```java
/*
 * Example usage:
 * restTemplate.getForEntity("https://api.example.com", String.class);
 *  ^--- This line starts with " *" and IS skipped ✓
 */

/*
Example of how NOT to call:
DriverManager.getConnection("jdbc:postgresql://localhost/testdb");
//  ^--- This line starts with "DriverManager", NOT skipped → false positive!
*/
```

Javadoc `/**` blocks with `@see`, `@link`, or `@example` annotations commonly contain URLs that would trigger HTTP pattern matches.

## Proposed Solutions

### Option 1: Track block comment state with a boolean flag (Recommended)

**Approach:** Maintain a `inBlockComment` boolean. Set to `true` when a line contains `/*` (and doesn't also contain `*/`). Set to `false` when `*/` is found. Skip all processing while `inBlockComment` is true.

```typescript
let inBlockComment = false;
for (let i = 0; i < lines.length; i++) {
  const trimmed = lines[i]!.trim();
  if (inBlockComment) {
    if (trimmed.includes("*/")) inBlockComment = false;
    continue;
  }
  if (trimmed.startsWith("/*")) {
    if (!trimmed.includes("*/")) inBlockComment = true;
    continue;
  }
  if (trimmed.startsWith("//")) continue;
  // ... rest of analysis
}
```

**Pros:** Correctly handles all multi-line block comment patterns. Standard approach.
**Cons:** Edge cases: `/* ... */` on a single line, nested `/*` (not valid Java but possible in strings), inline comments like `getConnection(/* opts */ url)`.
**Effort:** Small
**Risk:** Low

### Option 2: Pre-process source to strip comments before analysis

**Approach:** Use a regex or simple state machine to strip all comments from the source before line-by-line analysis.

**Pros:** Cleaner input, avoids edge cases in line analysis.
**Cons:** Loses line numbers (must map back). Strings containing `/*` would be incorrectly stripped.
**Effort:** Medium
**Risk:** Medium

### Option 3: Accept as known limitation — document it

**Approach:** Document that commented-out code may produce false positives, consistent with Python/JS analyzers which have the same issue.

**Pros:** Simple. Python and JS analyzers have the same behavior — consistency.
**Cons:** Users with large documentation comment blocks in Java code will see false positives.
**Effort:** Trivial
**Risk:** None

## Recommended Action

To be filled during triage.

## Technical Details

- **Affected file:** `packages/languages/java/src/analyzer.ts:126-132`
- Also affects the first (import-scanning) loop at lines 99-124 — same gap exists there
- Both Python and JS analyzers have similar comment-handling limitations (consistent behavior)

## Acceptance Criteria

- [ ] Content lines within `/* ... */` blocks (not starting with `*`) are not analyzed for dependencies
- [ ] Single-line `/* comment */` blocks are correctly handled
- [ ] Test added: file with block comment containing URL does not produce a dependency entry

## Work Log

- 2026-02-25: Identified during PR #15 code review
