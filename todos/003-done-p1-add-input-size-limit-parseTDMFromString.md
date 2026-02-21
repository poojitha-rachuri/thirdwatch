---
status: pending
priority: p1
issue_id: "003"
tags: [code-review, security, dos, performance]
dependencies: []
---

# Add Input Size Limit Before `JSON.parse` in `parseTDMFromString`

## Problem Statement

`parseTDMFromString(json)` calls `JSON.parse(json)` with no size guard. `JSON.parse` in V8 is **synchronous and blocks the event loop** for the entire duration of parsing. A cloud service (API gateway, GitHub Action processor) that passes attacker-supplied or corrupted TDM files directly to this function is vulnerable to:

- **Memory exhaustion**: A 500 MB JSON file will be allocated entirely in the heap before Ajv begins validation.
- **Event-loop stall**: A deeply nested or wide structure (100,000-element arrays) blocks Node.js for seconds.

Combined with no `maxItems`/`maxLength` in the schema (see todo #004), this is a reliable DoS vector for any cloud-facing consumer.

## Findings

**File:** `packages/tdm/src/validate.ts`, lines 173–175

```typescript
export function parseTDMFromString(json: string): TDM {
  return parseTDM(JSON.parse(json) as unknown);
}
```

No byte-length check, no depth limit, no timeout. The PR description states TDMs are "consumed by cloud services" — any ingestion endpoint calling this without prior size-gating at the HTTP/transport layer is vulnerable.

OWASP category: A05 Security Misconfiguration.

## Proposed Solutions

### Option A — Add byte-length check before `JSON.parse` (Recommended)

```typescript
const MAX_TDM_BYTES = 50 * 1024 * 1024; // 50 MB — configurable

export function parseTDMFromString(json: string, maxBytes = MAX_TDM_BYTES): TDM {
  if (json.length > maxBytes) {
    throw new Error(`TDM input exceeds maximum allowed size of ${maxBytes} bytes (got ${json.length})`);
  }
  return parseTDM(JSON.parse(json) as unknown);
}
```

- Pros: Trivial fix, clear error message, configurable via parameter
- Cons: String `.length` is codepoints not bytes (UTF-8 multi-byte chars); use `Buffer.byteLength(json)` for true byte count
- Effort: Small | Risk: Low

### Option B — Document that callers must size-gate at the transport layer
Add a JSDoc `@throws` annotation noting that callers are responsible for limiting input size. Do not add a check in the library.

- Pros: Library stays minimal
- Cons: Pushes security responsibility to every caller; misses the "safe by default" principle
- Effort: Trivial | Risk: Medium (consumers will forget)

## Recommended Action

Option A with `Buffer.byteLength(json, 'utf8')` for accurate byte counting. Default to 50 MB (generous for any real codebase scan).

## Acceptance Criteria

- [ ] `parseTDMFromString` rejects inputs above the size limit with a clear, typed error
- [ ] Size limit has a sensible default and is configurable by callers
- [ ] Test added: oversized input throws with a descriptive message
- [ ] JSDoc updated to document the size limit behavior

## Work Log

- 2026-02-21: Found during security review of PR #1
