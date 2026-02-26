---
status: complete
priority: p1
issue_id: "069"
tags: [code-review, php, security, credentials]
dependencies: []
---

# PHP Analyzer: `redactConnString` Does Not Redact Query-String Credentials

## Problem Statement

`redactConnString()` in `packages/languages/php/src/analyzer.ts` only redacts `://user:pass@` style credentials using a single `.replace()` call (no `g` flag). It does not redact `?password=secret` or `&password=secret` query-string credential patterns. This means plaintext credentials can be written to the TDM output if a connection string uses query-parameter authentication.

This is the PHP equivalent of Rust issue #067.

## Findings

- **File:** `packages/languages/php/src/analyzer.ts:259-261`
- Current implementation:
  ```typescript
  function redactConnString(raw: string): string {
    return raw.replace(/:\/\/[^@]+@/, "://<redacted>@");
  }
  ```
- `.replace()` without `g` flag — only replaces the first occurrence (though unlikely to have multiple)
- Does NOT cover `?password=...`, `&password=...`, `?token=...` patterns
- Example credential leaks:
  - `mysql://localhost/mydb?password=secret123` → NOT redacted
  - `mongodb://host/db?authSource=admin&password=hunter2` → NOT redacted
  - `pgsql://host/db?sslpassword=certpass` → NOT redacted
- PDO DSN format `mysql:host=localhost;dbname=mydb;user=root;password=secret` — password= in DSN NOT redacted

## Proposed Solutions

### Option 1: Extend `redactConnString` to cover query-string and DSN credentials (Recommended)

```typescript
function redactConnString(raw: string): string {
  // Redact user:pass@ in URL-style connection strings
  let result = raw.replaceAll(/:\/\/[^@]+@/, "://<redacted>@");
  // Redact ?key=val and &key=val credential params
  result = result.replaceAll(
    /([?&;](?:password|passwd|pwd|secret|token|key|auth|user)\s*=\s*)[^&\s"';]+/gi,
    "$1<redacted>",
  );
  return result;
}
```

**Pros:** Covers URL-style, query-string, and DSN (semicolon-delimited) credentials. Uses `replaceAll` for multiple occurrences.
**Cons:** None for standard credential parameter names.
**Effort:** Trivial
**Risk:** Low — only affects what appears in TDM output

### Option 2: Minimal fix — use `replaceAll` for existing pattern only

```typescript
function redactConnString(raw: string): string {
  return raw.replaceAll(/:\/\/[^@]+@/, "://<redacted>@");
}
```

**Pros:** Minimal change.
**Cons:** Still doesn't cover query-string credentials.
**Effort:** Trivial
**Risk:** None

## Recommended Action

Option 1 — full coverage, consistent with the fix planned for Rust #067.

## Technical Details

**Affected files:**
- `packages/languages/php/src/analyzer.ts` — `redactConnString()` function

**Related issues:**
- Rust #067 — same pattern
- Java #059 — partial precedent (replace vs replaceAll)

## Acceptance Criteria

- [ ] `mysql://localhost/mydb?password=secret123` → `mysql://localhost/mydb?password=<redacted>`
- [ ] `mongodb://user:pass@localhost:27017` → `mongodb://<redacted>@localhost:27017` (existing behavior preserved)
- [ ] `pgsql://host/db?sslpassword=certpass&token=abc` → all credential params redacted
- [ ] All 24 existing tests continue to pass
- [ ] New test covering query-string credential redaction

## Work Log

- 2026-02-26: Filed during PR #17 review (PHP analyzer)
