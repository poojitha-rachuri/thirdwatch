---
status: pending
priority: p1
issue_id: "001"
tags: [code-review, architecture, schema]
dependencies: []
---

# Remove Incompatible `stripe-python.tdm.json` Example

## Problem Statement

`schema/v1/examples/stripe-python.tdm.json` exists and uses a completely different schema shape that is **incompatible with the `tdm.schema.json` being formalized in this PR**. This file fails validation against the schema this PR establishes. Any tool, AI agent, or contributor discovering examples in the schema directory will infer incorrect conclusions about the canonical format.

## Findings

The file uses the **old flat-dependencies design** that was superseded:

| Dimension | `stripe-python.tdm.json` | This PR's Schema |
|---|---|---|
| Root version key | `schemaVersion` | `version` |
| Structure | Flat `dependencies[]` with `type` discriminator | Five typed arrays: `packages`, `apis`, `sdks`, `infrastructure`, `webhooks` |
| Entry identity | Per-entry `id` field (`"dep_stripe_sdk_python"`) | No ID fields |
| Confidence | Numeric float (`0.98`) | Enum string (`"high"`, `"medium"`, `"low"`) |
| Column tracking | `column` present on usages | Not present on `TDMLocation` |

**File:** `schema/v1/examples/stripe-python.tdm.json`

Note: The per-entry ID design in this old file is actually architecturally desirable — see todo #009 for tracking that separately.

## Proposed Solutions

### Option A — Delete the file (Recommended)
Delete `schema/v1/examples/stripe-python.tdm.json`. If the design ideas it contains (IDs, numeric confidence, column tracking) are wanted, capture them as GitHub issues rather than leaving a contradictory example.

- Pros: Eliminates ambiguity immediately, one-line fix
- Cons: Loses historical reference (but git history preserves it)
- Effort: Small | Risk: Low

### Option B — Replace with a conforming example
Replace the file with a valid Python example that uses the v1 schema. This gives three Python-codebase examples (the existing `payment-service.tdm.json` is also Python). Rename to `python-basic.tdm.json`.

- Pros: Richer example coverage
- Cons: More work; two Python examples may be redundant
- Effort: Small | Risk: Low

## Recommended Action

Option A — delete the file. Capture the ID design in todo #009.

## Acceptance Criteria

- [ ] `schema/v1/examples/stripe-python.tdm.json` is deleted or replaced with a schema-conforming file
- [ ] All files in `schema/v1/examples/` pass `parseTDM()` validation without errors
- [ ] CI passes with no schema validation failures

## Work Log

- 2026-02-21: Found during architecture review of PR #1
