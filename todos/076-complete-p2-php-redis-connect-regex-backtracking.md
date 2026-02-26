---
status: complete
priority: p2
issue_id: "076"
tags: [code-review, php, security, performance, regex]
dependencies: []
---

# PHP Analyzer: Redis `->connect()` INFRA Pattern Uses `[\w.]+` Instead of Negated Class, Risking Backtracking

## Problem Statement

`INFRA_PATTERNS` in `packages/languages/php/src/analyzer.ts` contains a Redis connection pattern that uses a positive character class `[\w.]+` inside a quoted-string construct. Unlike the negated-class patterns used everywhere else in the codebase (`[^\s"']+`), a positive class creates a backtracking risk: when the regex engine reaches the closing quote position and it doesn't match (malformed or long input), it must backtrack through every character accumulated by `[\w.]+`. Combined with two quote-style alternatives `['"]`, this produces O(n²) behavior on lines with long non-terminating identifiers.

## Findings

- **File:** `packages/languages/php/src/analyzer.ts:83`
  ```typescript
  [/->connect\(\s*['"][\w.]+['"]\s*,\s*6379/, "redis"],
  //                       ^^^^^^ positive class — backtracking risk
  ```
- All other INFRA and CONN_STRING patterns correctly use negated classes:
  - `[^\s"']+` in `CONN_STRING_PATTERNS` (lines 94–98)
  - All other analyzers (Python, Go, Rust, Java) use `[^\s"']+` for URL/hostname extraction inside strings
- Crafted PHP file with a line like `->connect('AAAAA...AAAA` (10,000 chars, no closing quote) can trigger worst-case backtracking

## Proposed Solutions

### Option 1: Replace `[\w.]+` with negated class `[^"']+` (Recommended)

```typescript
// Before:
[/->connect\(\s*['"][\w.]+['"]\s*,\s*6379/, "redis"],

// After:
[/->connect\(\s*["'][^"']+["']\s*,\s*6379/, "redis"],
```

`[^"']+` stops immediately at any quote character, guaranteeing O(n) backtracking in the worst case and O(1) when the string terminates normally.

**Pros:** Consistent with all other patterns; eliminates backtracking risk; no functional change for valid inputs.
**Cons:** None.
**Effort:** Trivial (one character class change)
**Risk:** None

### Option 2: Add maximum-length bound to `[\w.]+`

```typescript
[/->connect\(\s*['"][\w.]{1,253}['"]\s*,\s*6379/, "redis"],
```

255 chars is the max hostname length; 253 is the practical DNS limit.

**Pros:** Bounds the backtracking depth.
**Cons:** Arbitrary limit; less idiomatic than the negated class; positive class still slower than negated.
**Effort:** Trivial

## Recommended Action

Option 1 — one character change, consistent with all other patterns.

## Technical Details

**Affected files:**
- `packages/languages/php/src/analyzer.ts:83`

## Acceptance Criteria

- [ ] `->connect('127.0.0.1', 6379)` still detected as redis infra entry
- [ ] `->connect("10.0.0.1", 6379)` still detected
- [ ] Pattern updated to use `[^"']+`
- [ ] All 24 existing tests pass

## Work Log

- 2026-02-26: Filed during PR #17 review (PHP analyzer) — performance agent finding
