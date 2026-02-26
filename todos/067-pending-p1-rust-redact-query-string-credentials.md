---
status: pending
priority: p1
issue_id: "067"
tags: [code-review, rust, security, credentials]
dependencies: []
---

# Rust Analyzer: `redactConnString` Does Not Redact Query-String Credentials

## Problem Statement

`redactConnString()` in `packages/languages/rust/src/analyzer.ts` only redacts `://user:pass@` style credentials in connection string URLs. It does not redact `?password=secret` or `&password=secret` query-string credential patterns. This means plaintext credentials can be written to the TDM output if a connection string uses query-parameter authentication (e.g., MySQL `?password=...`, some MongoDB driver options, or custom SDK auth params).

## Findings

- **File:** `packages/languages/rust/src/analyzer.ts:240-242`
- Current implementation:
  ```typescript
  function redactConnString(raw: string): string {
    return raw.replace(/:\/\/[^@]+@/, "://<redacted>@");
  }
  ```
- Only one `.replace()` call (not `.replaceAll()`) — misses multiple credentials in one string
- Does not cover `?password=secret&user=admin` patterns
- Example credential leaks:
  - `mysql://localhost/mydb?password=secret123` → not redacted
  - `postgresql://host/db?sslpassword=certpass` → not redacted
  - `mongodb://host/db?authSource=admin&password=hunter2` → not redacted

## Proposed Solutions

### Option 1: Extend `redactConnString` with query-param redaction (Recommended)

```typescript
function redactConnString(raw: string): string {
  // Redact user:pass@ style credentials
  let result = raw.replaceAll(/:\/\/[^@]+@/, "://<redacted>@");
  // Redact ?password=... and &password=... query params
  result = result.replaceAll(/([?&](?:password|passwd|pwd|secret|token|key|auth)=)[^&\s"']+/gi, "$1<redacted>");
  return result;
}
```

**Pros:** Covers both userinfo and query-string credential patterns. Consistent with Java fix. Uses `replaceAll` to handle multiple occurrences.
**Cons:** None for standard credential parameter names.
**Effort:** Trivial
**Risk:** None

### Option 2: Minimal fix — only add `replaceAll` for userinfo pattern

Only switch from `.replace()` to `.replaceAll()` for the existing `://user:pass@` pattern.

**Pros:** Minimal change.
**Cons:** Still misses query-string passwords.
**Effort:** Trivial
**Risk:** None

## Acceptance Criteria

- [ ] `mysql://localhost/mydb?password=secret123` → password is redacted
- [ ] `mongodb://host/db?authSource=admin&password=hunter2` → password is redacted
- [ ] `postgresql://user:pass@localhost/db` → still redacted correctly
- [ ] Multiple credentials in one string are all redacted

## Work Log

- 2026-02-26: Identified during PR #16 code review (security-sentinel agent)
