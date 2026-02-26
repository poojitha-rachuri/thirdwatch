---
status: complete
priority: p1
issue_id: "068"
tags: [code-review, php, false-positive, imports, security]
dependencies: []
---

# PHP Analyzer: `detectUseImports` Matches Commented-Out `use` Statements + Line Always Reports 1

## Problem Statement

`detectUseImports()` in `packages/languages/php/src/analyzer.ts` runs a regex across the entire source string without first stripping comment lines. A commented-out `use Stripe\Charge;` will still be detected and emit a false-positive Stripe SDK entry in the TDM. Additionally, the line number for all use-import-based SDK detections is hardcoded to `1`, so every SDK detected via `use` statement appears at line 1 regardless of where it actually appears in the file.

This is the PHP equivalent of Rust issue #062.

## Findings

- **File:** `packages/languages/php/src/analyzer.ts:9-18` (`detectUseImports`)
- `useRe` is matched against the full `source` string — single-line `//` and `#` comments and block `/* */` comment content are all searched
- Example false positive: `// use Stripe\Charge;` or `# use Aws\S3\S3Client;` inside a comment still maps `Charge → Stripe\Charge` in the imports map → triggers a Stripe SDK entry
- **File:** `packages/languages/php/src/analyzer.ts:124` — `line: 1` hardcoded for all use-import SDK detections
- PHP `use` statements commonly appear at lines 3–10+, but TDM reports them all at line 1
- No tests exercise commented-out `use` statements

## Proposed Solutions

### Option 1: Strip comment lines before regex matching + track line numbers (Recommended)

Refactor `detectUseImports` to process line-by-line with comment awareness, and return line numbers:

```typescript
function detectUseImports(source: string): Map<string, [string, number]> {
  const imports = new Map<string, [string, number]>();
  let inBlockComment = false;

  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]!.trim();

    if (trimmed.startsWith("//") || trimmed.startsWith("#")) continue;
    if (inBlockComment) {
      if (trimmed.includes("*/")) inBlockComment = false;
      continue;
    }
    if (trimmed.startsWith("/*")) {
      if (!trimmed.includes("*/")) inBlockComment = true;
      continue;
    }

    const useRe = /^\s*use\s+([A-Za-z0-9_\\]+)(?:\s+as\s+(\w+))?\s*;/;
    const m = lines[i]!.match(useRe);
    if (m) {
      const fullPath = m[1]!;
      const alias = m[2] ?? fullPath.split("\\").pop()!;
      imports.set(alias, [fullPath, i + 1]); // i+1 = 1-indexed line number
    }
  }
  return imports;
}
```

Then update callers to use the line number:
```typescript
// In the use-import SDK detection loop:
for (const [, [fullPath, lineNum]] of imports) {
  // ...
  locations: [{ file: rel, line: lineNum, context: `use ${fullPath}` }],
```

**Pros:** Eliminates false positives; provides accurate line numbers for TDM.
**Cons:** Slightly more code; must update callers.
**Effort:** Small
**Risk:** Low

### Option 2: Pre-strip comment lines before passing to regex (Quick fix)

```typescript
function detectUseImports(source: string): Map<string, string> {
  const withoutComments = source
    .split("\n")
    .map(line => {
      const t = line.trimStart();
      return (t.startsWith("//") || t.startsWith("#")) ? "" : line;
    })
    .join("\n");
  // run existing regex on withoutComments
}
```

**Pros:** Minimal change; eliminates false positives from single-line comments.
**Cons:** Doesn't fix line number accuracy; doesn't strip block comment content.
**Effort:** Trivial
**Risk:** Very low

## Recommended Action

Option 1 — fixes both problems at once with clean line-by-line processing.

## Technical Details

**Affected files:**
- `packages/languages/php/src/analyzer.ts` — `detectUseImports()` function and its callers

**Related issues:**
- Rust #062 — same pattern

## Acceptance Criteria

- [ ] Commented-out `use Stripe\Charge;` does NOT produce an SDK entry
- [ ] `use Stripe\Charge;` at line 5 produces `locations: [{ line: 5 }]` not `{ line: 1 }`
- [ ] All existing 24 tests continue to pass
- [ ] New test: commented-out `use` statement produces no entry

## Work Log

- 2026-02-26: Filed during PR #17 review (PHP analyzer)
