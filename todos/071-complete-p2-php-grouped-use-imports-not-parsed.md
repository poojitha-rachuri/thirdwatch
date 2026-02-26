---
status: complete
priority: p2
issue_id: "071"
tags: [code-review, php, false-negative, imports]
dependencies: []
---

# PHP Analyzer: Grouped `use` Imports (`use Stripe\{Charge, PaymentIntent}`) Not Parsed

## Problem Statement

`detectUseImports()` in `packages/languages/php/src/analyzer.ts` only handles simple `use ClassName;` and `use ClassName as Alias;` patterns. PHP's grouped import syntax (`use Namespace\{ClassA, ClassB};`) is common in modern PHP and is completely ignored. When a PHP file uses grouped imports, SDK detection from `use` statements silently fails for those namespaces.

This is the PHP equivalent of Rust issue #065 (marked P2).

## Findings

- **File:** `packages/languages/php/src/analyzer.ts:11`
- Current regex: `/^\s*use\s+([A-Za-z0-9_\\]+)(?:\s+as\s+(\w+))?\s*;/gm`
- This does NOT match:
  - `use Stripe\{Charge, PaymentIntent};` — grouped class import
  - `use Aws\{S3\S3Client, Sqs\SqsClient};` — grouped with sub-namespaces
  - `use Stripe\Charge, Stripe\PaymentIntent;` — comma-separated (PHP 5.3+)
- When Stripe is imported via `use Stripe\{Charge, PaymentIntent};`, neither `Charge` nor `PaymentIntent` is in the imports map → SDK detection from use statements fails → Stripe is only detected from inline `\Stripe\...` usage patterns
- No fixture exercises grouped imports

## Proposed Solutions

### Option 1: Add grouped import regex (Recommended)

```typescript
function detectUseImports(source: string): Map<string, string> {
  const imports = new Map<string, string>();

  // Simple use: use Ns\Class; or use Ns\Class as Alias;
  const simpleUseRe = /^\s*use\s+([A-Za-z0-9_\\]+)(?:\s+as\s+(\w+))?\s*;/gm;
  for (const m of source.matchAll(simpleUseRe)) {
    const fullPath = m[1]!;
    const alias = m[2] ?? fullPath.split("\\").pop()!;
    imports.set(alias, fullPath);
  }

  // Grouped use: use Ns\{ClassA, ClassB as CB};
  const groupedUseRe = /^\s*use\s+([A-Za-z0-9_\\]+)\\?\{([^}]+)\}/gm;
  for (const m of source.matchAll(groupedUseRe)) {
    const nsPrefix = m[1]!;
    for (const item of m[2]!.split(",").map((s) => s.trim()).filter(Boolean)) {
      const aliasMatch = item.match(/^([A-Za-z0-9_\\]+)\s+as\s+(\w+)$/);
      if (aliasMatch) {
        const fullPath = `${nsPrefix}\\${aliasMatch[1]!}`;
        imports.set(aliasMatch[2]!, fullPath);
      } else {
        const fullPath = `${nsPrefix}\\${item}`;
        const alias = item.split("\\").pop()!;
        imports.set(alias, fullPath);
      }
    }
  }

  return imports;
}
```

**Pros:** Handles modern PHP grouped import syntax. Minimal change to existing behavior.
**Cons:** Slightly longer regex logic.
**Effort:** Small
**Risk:** Low

### Option 2: Add fixture and test only, document limitation

Document that grouped imports are not supported and add a test that verifies the limitation.

**Pros:** No code change risk.
**Cons:** Known false negatives remain.
**Effort:** Trivial
**Risk:** None (but doesn't fix the problem)

## Recommended Action

Option 1 — grouped imports are common PHP usage; silent false negatives undermine SDK detection.

## Technical Details

**Affected files:**
- `packages/languages/php/src/analyzer.ts` — `detectUseImports()` function

**Related issues:**
- Rust #065 — same pattern (P2)

## Acceptance Criteria

- [ ] `use Stripe\{Charge, PaymentIntent};` produces `Charge → Stripe\Charge` and `PaymentIntent → Stripe\PaymentIntent` in the imports map
- [ ] `use Aws\{S3\S3Client};` is parsed correctly
- [ ] All existing 24 tests pass
- [ ] New fixture entry and test for grouped imports

## Work Log

- 2026-02-26: Filed during PR #17 review (PHP analyzer)
