---
status: pending
priority: p2
issue_id: "065"
tags: [code-review, rust, false-negative, imports]
dependencies: []
---

# Rust Analyzer: Grouped `use` Imports (`use X::{A, B}`) Not Parsed

## Problem Statement

`detectUseStatements()` in `packages/languages/rust/src/imports.ts` only handles simple `use X;` and `use X as Y;` patterns. Grouped use imports like `use aws_sdk_s3::{Client, Error};` are very common in Rust and are completely missed. This means SDK detection from imports (the deduplication mechanism) fails for grouped import syntax, potentially causing duplicate SDK entries or missed detections when the SDK is only referenced via grouped imports.

## Findings

- **File:** `packages/languages/rust/src/imports.ts:12-28`
- `aliasRe` = `/use\s+([\w:]+(?:::\w+)*)\s+as\s+(\w+)\s*;/g` — misses `{...}` groups
- `useRe` = `/use\s+([\w:]+(?:::\w+)*)\s*;/g` — misses `{...}` groups
- Common Rust patterns NOT handled:
  - `use aws_sdk_s3::{Client, config::Builder};`
  - `use tokio::{fs, net::TcpListener};`
  - `use stripe::{Charge, PaymentIntent};`
- No fixture exercises grouped imports

## Proposed Solutions

### Option 1: Add a grouped import regex (Recommended)

```typescript
// use path::{A, B, C as D} — grouped imports
const groupedUseRe = /use\s+([\w:]+(?:::\w+)*)::\{([^}]+)\}/g;
for (const m of withoutLineComments.matchAll(groupedUseRe)) {
  const cratePath = m[1]!;
  for (const item of m[2]!.split(",").map(s => s.trim()).filter(Boolean)) {
    const aliasMatch = item.match(/^([\w:]+)\s+as\s+(\w+)$/);
    if (aliasMatch) {
      imports.set(aliasMatch[2]!, `${cratePath}::${aliasMatch[1]!}`);
    } else if (item && item !== "_") {
      const fullPath = `${cratePath}::${item}`;
      imports.set(item.split("::").pop()!, fullPath);
    }
  }
}
```

**Pros:** Handles the most common grouped import pattern. Low risk.
**Cons:** Does not handle nested groups `use X::{A, B::{C, D}}` (uncommon).
**Effort:** Small
**Risk:** Low

### Option 2: No change — document as known limitation

**Approach:** Document that grouped imports aren't parsed and SDK detection falls back to constructor-based detection.
**Pros:** Simple. Constructor detection still works.
**Cons:** When SDK is only referenced via grouped imports with no explicit constructor call, it won't be detected.
**Effort:** None
**Risk:** Low

## Acceptance Criteria

- [ ] `use aws_sdk_s3::{Client, Error};` detects AWS SDK
- [ ] `use stripe::{Charge, PaymentIntent};` detects Stripe SDK
- [ ] Aliases within groups work: `use stripe::{Charge as StripeCharge}` detected

## Work Log

- 2026-02-26: Identified during PR #16 code review
