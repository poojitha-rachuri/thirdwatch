---
status: pending
priority: p2
issue_id: "013"
tags: [code-review, security, schema, validation]
dependencies: ["004"]
---

# Add `format: "uri"` to URL Fields and `enum` to HTTP Method Field

## Problem Statement

URL fields in the TDM schema accept any string value — including `javascript:`, `file://`, and private SSRF targets like `http://169.254.169.254/`. The `apis[].method` field accepts any string, including multi-line strings that could cause log injection or unexpected HTTP behavior in consumers that use this field to populate requests.

OWASP category: A03 Injection.

## Findings

**File:** `packages/tdm/src/validate.ts` + `schema/v1/tdm.schema.json`

Fields needing URI format validation:
- `apis[].url` — explicit API endpoint URL
- `apis[].resolved_url` — URL after env var resolution
- `webhooks[].target_url` — outbound webhook registration URL

Fields needing enum constraint:
- `apis[].method` — HTTP verb (currently any string)

Connection string fields (lower priority — comment in types.ts says these may be env var names):
- `infrastructure[].connection_ref` — could be `postgresql://attacker@evil.host/db`
- `infrastructure[].resolved_host` — hostname after resolution

## Proposed Solutions

### Option A — Add `format: "uri"` and method `enum` (Recommended)

```json
"url": { "type": "string", "format": "uri" },
"resolved_url": { "type": "string", "format": "uri" },
"target_url": { "type": "string", "format": "uri" },
"method": {
  "type": "string",
  "enum": ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "CONNECT", "TRACE"]
}
```

For `infrastructure.connection_ref` — keep as free string but add a note in the field description that connection strings with embedded credentials should not be stored in TDM files; use env var names instead.

Note: `format: "uri"` requires `ajv-formats` (already installed). The `format: "uri"` validator rejects `javascript:` and `file://` schemes.

- Pros: Prevents injection via malformed URLs; rejects nonsensical method values
- Cons: Rejects template URLs like `${BASE_URL}/v2/users` that legitimately appear in TDMs
- Effort: Small | Risk: Medium (template URLs will fail validation)

### Option B — Add `format: "uri-reference"` (less strict)
Validates URI structure but allows relative references. Won't reject `${BASE_URL}/v2/users`.

- Pros: Allows template URLs
- Cons: Also allows `javascript:alert(1)` since `format: "uri-reference"` is quite permissive
- Effort: Small | Risk: Low

### Option C — Add a pattern that allows templates or full URIs
```json
"url": { "type": "string", "pattern": "^(https?://|\\$\\{)" }
```

- Pros: Allows template URLs; rejects `javascript:` and `file://`
- Cons: Regex validation, not semantic; partial coverage
- Effort: Small | Risk: Low

## Recommended Action

Option C for `url` fields (allows template URLs which are common in real codebases). Option A for `method` (closed enum). Skip `format: "uri"` on `resolved_url` (also could be a template). Update both schema copies.

## Acceptance Criteria

- [ ] `apis[].method` constrained to valid HTTP verbs via `enum`
- [ ] `apis[].url` and `webhooks[].target_url` have a pattern or format constraint preventing `javascript:` injection
- [ ] Test: `method: "INJECT\r\nHost: evil.com"` causes `TDMValidationError`
- [ ] Test: template URL `"${BASE_URL}/v2/users"` still passes validation

## Work Log

- 2026-02-21: Found during security review of PR #1 (Security Finding F3)
