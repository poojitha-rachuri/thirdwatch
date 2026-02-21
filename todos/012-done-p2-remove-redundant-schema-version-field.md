---
status: pending
priority: p2
issue_id: "012"
tags: [code-review, architecture, schema, cleanup]
dependencies: []
---

# Resolve Redundant `TDM.version` vs `TDMMetadata.schema_version` Fields

## Problem Statement

The TDM root has `version: string` AND `metadata.schema_version: string`, and both carry the same value ("1.0" in all examples). This is **redundant** and will inevitably drift. A producer could set `version: "1.0"` and `metadata.schema_version: "1.1"`, and the validator would accept both, silently creating contradictory metadata.

The `tdm-spec.md` docs say both mean "TDM schema version, e.g. '1.0'" — identical semantic intent.

## Findings

**Types:**
- `TDM.version: string` — `types.ts:176` — "TDM schema version, e.g. '1.0'"
- `TDMMetadata.schema_version: string` — `types.ts:41` — "TDM schema version, e.g. '1.0'"

**Examples:** Both set to `"1.0"` in `payment-service.tdm.json` and `node-api.tdm.json`.

**Test fixture:** Both set to `"1.0"` in `validate.test.ts` VALID_TDM (lines 10, 12).

## Proposed Solutions

### Option A — Remove `metadata.schema_version` (Recommended)
Keep `TDM.version` as the single authoritative version field at the root level. Remove `schema_version` from `TDMMetadata`.

- Pros: Eliminates redundancy; `version` at root is more discoverable
- Cons: Breaking change to `TDMMetadata` — but no consumers exist yet, so now is the time
- Effort: Small | Risk: Low

### Option B — Remove `TDM.version` and keep `metadata.schema_version`
Keep it nested in metadata only.

- Pros: Version is alongside other scan context
- Cons: Harder to check — `tdm.metadata.schema_version` vs `tdm.version`; convention across similar formats (SPDX, CycloneDX) puts version at the root
- Effort: Small | Risk: Low

### Option C — Keep both, add validator assertion they match
Add a post-validation check in `parseTDM` that `version === metadata.schema_version`, throwing if they differ.

- Pros: No breaking change; catches drift at runtime
- Cons: Doesn't eliminate the conceptual redundancy; extra runtime check
- Effort: Small | Risk: Low

## Recommended Action

Option A. `TDM.version` stays, `metadata.schema_version` is removed. Update all examples, types, schema, and test fixture.

## Acceptance Criteria

- [ ] `schema_version` removed from `TDMMetadata` interface in `types.ts`
- [ ] `schema_version` removed from `TDMMetadata` `$def` in both schema copies
- [ ] Examples updated (remove `schema_version` from `metadata` objects)
- [ ] Test fixture updated
- [ ] `tdm-spec.md` updated
- [ ] `tsc --noEmit` and tests pass

## Work Log

- 2026-02-21: Found during architecture review of PR #1
