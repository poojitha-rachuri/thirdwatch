---
status: pending
priority: p2
issue_id: "011"
tags: [code-review, examples, schema, documentation]
dependencies: []
---

# Fix `total_dependencies_found` Value in `payment-service.tdm.json`

## Problem Statement

`schema/v1/examples/payment-service.tdm.json` sets `metadata.total_dependencies_found: 8`, but the actual entry count in that file is **13** (4 packages + 3 apis + 2 sdks + 2 infrastructure + 2 webhooks = 13). This discrepancy:

1. Makes the example invalid as a reference — developers copying the pattern will produce TDMs with incorrect metadata
2. Reveals an undocumented semantic question: does `total_dependencies_found` count entries across all arrays, or unique external dependencies?

## Findings

**File:** `schema/v1/examples/payment-service.tdm.json`, line 9

```json
"total_dependencies_found": 8,  // Should be 13 (or semantics need documentation)
```

The `TDMMetadata` comment in `types.ts` line 51 says "Total number of unique dependency entries found" — which is ambiguous. If Stripe counts as one "dependency" despite appearing in packages (stripe), sdks (stripe), and apis (stripe charges, stripe refunds), then 8 might be intentional. But there is no documented counting methodology.

## Proposed Solutions

### Option A — Fix to 13 and document counting methodology (Recommended)
Update `total_dependencies_found` to 13 (count of entries across all 5 arrays) and add a JSDoc comment on `TDMMetadata.total_dependencies_found` explaining the counting rule: "Sum of entries across packages + apis + sdks + infrastructure + webhooks arrays."

- Pros: Example is accurate; counting rule is documented
- Cons: None
- Effort: Trivial | Risk: None

### Option B — Fix to count unique external services (e.g., 4: Stripe, AWS, Slack, PostgreSQL, Redis = 5)
Document that this counts unique provider/service identities, not array entries.

- Pros: More semantically meaningful for "dependency surface" concept
- Cons: Harder for scanners to compute deterministically; makes the field harder to verify
- Effort: Small | Risk: Medium

## Recommended Action

Option A. Count is total array entries across all five arrays. This is the simplest, most deterministic interpretation.

## Acceptance Criteria

- [ ] `total_dependencies_found` corrected to 13 in `payment-service.tdm.json`
- [ ] `TDMMetadata.total_dependencies_found` JSDoc updated with counting methodology
- [ ] `node-api.tdm.json` verified for correctness (5 packages + 3 apis + 3 sdks + 2 infra + 0 webhooks = 13 — also verify)

## Work Log

- 2026-02-21: Found during pattern recognition review of PR #1
