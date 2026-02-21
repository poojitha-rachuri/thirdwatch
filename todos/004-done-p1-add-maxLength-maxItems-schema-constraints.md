---
status: pending
priority: p1
issue_id: "004"
tags: [code-review, security, dos, schema]
dependencies: ["003"]
---

# Add `maxLength` and `maxItems` Constraints to Schema

## Problem Statement

Every string field in the TDM schema is declared as `{ "type": "string" }` with **no `maxLength`**. Every array is declared without **`maxItems`**. This means a malicious TDM could carry strings with millions of characters and arrays with millions of entries, forcing Ajv to traverse and validate them all.

With `allErrors: true`, Ajv collects every violation — so 1,000,000 invalid entries produce 1,000,000 `ErrorObject` instances. The `TDMValidationError` constructor then joins them all into a single error message string. Combined, these create a reliable memory exhaustion / event-loop stall vector.

OWASP category: A05 Security Misconfiguration.

## Findings

**File:** `packages/tdm/src/validate.ts` lines 29–128; `schema/v1/tdm.schema.json` lines 53–192

Fields with no length constraints:
- `file`, `context`, `usage` (TDMLocation)
- `schema_version`, `scan_timestamp`, `scanner_version`, `repository` (TDMMetadata)
- All string fields in TDMPackage, TDMAPI, TDMSDK, TDMInfrastructure, TDMWebhook

The `date-time` format validator in `ajv-formats` processes the entire string length — for a megabyte-long `scan_timestamp`, this means a multi-millisecond regex execution.

## Proposed Solutions

### Option A — Add practical `maxLength` and `maxItems` to all fields (Recommended)

Recommended limits:
| Field category | `maxLength` |
|---|---|
| File paths (`file`, `manifest_file`) | 4096 |
| Version strings | 128 |
| URLs (`url`, `resolved_url`, `target_url`) | 2048 |
| Free-text (`context`, `repository`) | 512 |
| Short identifiers (`name`, `ecosystem`, `method`, `usage`) | 256 |
| Metadata strings (`scan_timestamp`, `scanner_version`) | 64 |

Array `maxItems`:
| Array | `maxItems` |
|---|---|
| `packages`, `apis`, `sdks`, `infrastructure`, `webhooks` | 10000 each |
| `locations` per entry | 1000 |
| `services_used`, `api_methods`, `headers`, `languages_detected` | 100 each |

These limits must be added to **both** the embedded `TDM_SCHEMA` in `validate.ts` AND `schema/v1/tdm.schema.json`. (Addresses the dual-maintenance risk tracked in todo #008.)

- Pros: Eliminates DoS vector at schema level; self-documenting
- Cons: Requires updating both schema copies; limits must be chosen carefully to not break real TDMs
- Effort: Medium | Risk: Low

### Option B — Only add `maxItems` to top-level arrays
Skip string length limits; only limit array sizes.

- Pros: Faster to implement
- Cons: String-level DoS still possible via single massive field value
- Effort: Small | Risk: Medium

## Recommended Action

Option A. Use the limits in the table above. Update both schema copies in a single commit.

## Acceptance Criteria

- [ ] All string fields have `maxLength` in both `TDM_SCHEMA` (validate.ts) and `tdm.schema.json`
- [ ] All array fields have `maxItems` in both schema copies
- [ ] Test added: a string exceeding `maxLength` on any field causes `TDMValidationError`
- [ ] Example files are verified to stay within all new limits
- [ ] Both schema copies updated in the same commit (no drift)

## Work Log

- 2026-02-21: Found during security review of PR #1
