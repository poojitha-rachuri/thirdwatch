---
status: pending
priority: p3
issue_id: "059"
tags: [code-review, java, security, credentials]
dependencies: []
---

# Java Analyzer: `redactConnString` Uses `.replace()` Not `.replaceAll()` — Only First Occurrence Redacted

## Problem Statement

`redactConnString` in `packages/languages/java/src/analyzer.ts:319-321` uses `String.replace()` which only replaces the **first** occurrence of the regex match. A string with multiple embedded credentials (unusual but possible in concatenated connection strings) would have only the first credential redacted.

```typescript
function redactConnString(raw: string): string {
  return raw.replace(/:\/\/[^@]+@/, "://<redacted>@");
}
```

## Findings

- **File:** `packages/languages/java/src/analyzer.ts:319-321`
- `String.replace(regex, ...)` replaces only the first match unless the `g` flag is set
- Connection strings in practice are single URLs, so this rarely matters
- However, for safety and correctness, all credential patterns should be redacted
- Example edge case: a multi-tenant connection string or a string containing two connection URLs would only have the first set of credentials redacted

## Proposed Solutions

### Option 1: Use `.replace()` with the `g` flag (Recommended)

**Approach:** Change the regex to include the global flag: `/\/:\/\/[^@]+@/g` → all occurrences are redacted.

```typescript
function redactConnString(raw: string): string {
  return raw.replace(/:\/\/[^@]+@/g, "://<redacted>@");
}
```

**Pros:** Correct for all cases. One character change.
**Cons:** None.
**Effort:** Trivial
**Risk:** None

### Option 2: No change — accept as limitation

**Approach:** Document that `redactConnString` only redacts the first credential occurrence. This is acceptable because real connection strings are single URLs.

**Pros:** No change needed.
**Cons:** Technically incorrect behavior for edge cases; future contributors may not notice.
**Effort:** None
**Risk:** Low

## Recommended Action

To be filled during triage.

## Technical Details

- **Affected file:** `packages/languages/java/src/analyzer.ts:319-321`
- Go analyzer (`packages/languages/go/src/analyzer.ts`) should be checked for the same issue

## Acceptance Criteria

- [ ] `redactConnString` redacts credentials in all occurrences within the input string
- [ ] Test: `redactConnString("jdbc:postgresql://user:pass@host1/db && jdbc:postgresql://user2:pass2@host2/db")` redacts both

## Work Log

- 2026-02-25: Identified during PR #15 code review
