---
status: complete
priority: p1
issue_id: "074"
tags: [code-review, php, security, credentials]
dependencies: []
---

# PHP Analyzer: TDM `context` Field Leaks Raw Credentials from Infrastructure Connection Strings

## Problem Statement

Every `DependencyEntry` location object has a `context` field containing the verbatim PHP source line. For infrastructure entries, the `context` is set directly to `trimmed` — the raw PHP source line. This means lines like `$mongo = new \MongoDB\Client('mongodb://user:pass@localhost:27017');` are written to the TDM `context` field **without any redaction**, even though `connection_ref` is correctly redacted via `redactConnString()`.

This creates a two-channel credential leak: `connection_ref` is safe but `locations[].context` exposes full plaintext credentials to any TDM consumer (CI logs, `thirdwatch scan` output files, dashboards).

The fixture `fixtures/php-app/app.php:45` triggers this immediately in tests.

## Findings

- **File:** `packages/languages/php/src/analyzer.ts:227`
  ```typescript
  entries.push({
    kind: "infrastructure",
    type: infraType,
    connection_ref: redactConnString(connectionRef),   // ✅ redacted
    locations: [{ file: rel, line: lineNum, context: trimmed }],  // ❌ raw line, credentials intact
    confidence: "high",
  });
  ```
- **File:** `packages/languages/php/src/analyzer.ts:247`
  ```typescript
  entries.push({
    kind: "infrastructure",
    type: infraType,
    connection_ref: redactConnString(connMatch[0]),   // ✅ redacted
    locations: [{ file: rel, line: lineNum, context: trimmed }],  // ❌ raw line
    confidence: "high",
  });
  ```
- **Fixture trigger:** `fixtures/php-app/app.php:45` — `$mongo = new \MongoDB\Client('mongodb://user:pass@localhost:27017');` — full connection string with credentials appears verbatim in TDM `context` field
- The existing "redacts credentials from MongoDB connection string" test checks `connection_ref` only, not `context`

## Proposed Solutions

### Option 1: Apply `redactConnString` to the context field for infrastructure entries (Recommended)

```typescript
entries.push({
  kind: "infrastructure",
  type: infraType,
  connection_ref: redactConnString(connectionRef),
  locations: [{ file: rel, line: lineNum, context: redactConnString(trimmed) }],
  confidence: "high",
});
```

Apply the same fix to the `CONN_STRING_PATTERNS` block at line 247.

**Pros:** Simple one-line fix per location; consistent with connection_ref redaction; no behavior change for non-credential lines.
**Cons:** None — `redactConnString` is idempotent and safe to call on any string.
**Effort:** Trivial
**Risk:** None

### Option 2: Create a shared `sanitizeContext(line)` helper

```typescript
function sanitizeContext(line: string): string {
  return redactConnString(line);
}
```

Then use `sanitizeContext(trimmed)` everywhere a `context` field is set for infrastructure entries.

**Pros:** Makes the intent explicit; easy to extend if other context sanitization is needed.
**Cons:** Slightly more code for the same result.
**Effort:** Trivial
**Risk:** None

## Recommended Action

Option 1 — minimal change, directly fix the two affected call sites.

## Technical Details

**Affected files:**
- `packages/languages/php/src/analyzer.ts` — lines 227 and 247 (two `locations` objects for infra entries)

**Related issues:**
- #069 — redactConnString query-string credentials (fix together for full coverage)

## Acceptance Criteria

- [ ] TDM output for MongoDB infra entry has no credentials in `locations[].context`
- [ ] `$mongo = new \MongoDB\Client('mongodb://user:pass@localhost:27017')` → context is `$mongo = new \MongoDB\Client('mongodb://<redacted>@localhost:27017')`
- [ ] Existing "redacts credentials" test extended to also verify `context` field is redacted
- [ ] All 24 existing tests continue to pass

## Work Log

- 2026-02-26: Filed during PR #17 review (PHP analyzer) — security agent finding
