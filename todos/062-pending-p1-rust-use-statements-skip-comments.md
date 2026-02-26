---
status: pending
priority: p1
issue_id: "062"
tags: [code-review, rust, false-positive, imports]
dependencies: []
---

# Rust Analyzer: `detectUseStatements` Matches Commented-Out `use` Statements

## Problem Statement

`detectUseStatements()` in `packages/languages/rust/src/imports.ts` runs regex matching on the full source string without first stripping comment lines. A commented-out `use aws_sdk_s3::Client;` will still match the regex and emit a false-positive AWS SDK entry in the TDM — even though the code doesn't actually use AWS SDK.

## Findings

- **File:** `packages/languages/rust/src/imports.ts:9-30`
- `useRe` and `aliasRe` are run against `source` (the full file text) without comment filtering
- Example false positive: `// use stripe;` would set `stripe → stripe` in the imports map, triggering a Stripe SDK entry
- The main `analyzeRust()` loop does skip `//` lines, but `detectUseStatements()` is independent and runs before the loop
- No test exercises this edge case

## Proposed Solutions

### Option 1: Strip full comment lines before regex matching (Recommended)

Pre-process the source to remove lines that are purely comment lines:

```typescript
export function detectUseStatements(source: string): Map<string, string> {
  // Strip comment-only lines to avoid matching commented-out `use` statements.
  // Only removes full-line comments; inline `// ...` after code is safe to keep
  // because `use` statements never have code before them on the same line.
  const withoutLineComments = source
    .split("\n")
    .map(line => (line.trimStart().startsWith("//") ? "" : line))
    .join("\n");
  // ... run regexes on withoutLineComments
}
```

**Pros:** Simple, handles all single-line comment styles (`//`, `///`, `//!`). `use` declarations in Rust are always at the start of a line so this correctly removes all commented-out `use` statements.
**Cons:** Does not handle `/* use stripe; */` (block comment with use). Acceptable edge case for Phase 1.
**Effort:** Trivial
**Risk:** None

### Option 2: Only match `use` at the start of a line (with ^ anchor)

Add line-start anchoring: `^use\s+...` with multiline flag.

**Pros:** Prevents matching `use` inside comments or strings.
**Cons:** Block comments like `/* use stripe; */` still match if the `use` is at the start of the comment line.
**Effort:** Trivial
**Risk:** Low

## Recommended Action

To be filled during triage.

## Technical Details

- **Affected file:** `packages/languages/rust/src/imports.ts:13-27`
- All three regex patterns (`aliasRe`, `useRe`) need the fix

## Acceptance Criteria

- [ ] `// use aws_sdk_s3::Client;` does NOT produce an AWS SDK entry
- [ ] `/// use stripe;` (doc comment) does NOT produce a Stripe SDK entry
- [ ] `use reqwest;` (real use statement) still produces an import entry
- [ ] Test added for commented-out use statement case

## Work Log

- 2026-02-26: Identified during PR #16 code review
