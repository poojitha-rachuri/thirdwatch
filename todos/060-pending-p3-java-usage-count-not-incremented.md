---
status: pending
priority: p3
issue_id: "060"
tags: [code-review, java, quality, tdm-accuracy]
dependencies: []
---

# Java Analyzer: `usage_count` Hardcoded to 1 — Never Reflects Actual Usage

## Problem Statement

Every `DependencyEntry` emitted by `analyzeJava` in `packages/languages/java/src/analyzer.ts` has `usage_count: 1`, including SDK entries where multiple locations are appended via deduplication. When `S3Client.builder()` appears 5 times in a file, the TDM shows `usage_count: 1` with 5 entries in `locations`. This makes `usage_count` misleading — it doesn't count actual usages.

## Findings

- **File:** `packages/languages/java/src/analyzer.ts:109, 159, 181, 210, 234, 243, 260`
- SDK deduplication path at line 203-207: when a second usage of the same provider is found, `existing.locations.push(...)` is called but `existing.usage_count` is never incremented
- All entry constructors hardcode `usage_count: 1`
- Same issue exists in Python and JS analyzers (likely intentional at Phase 1)
- The `usage_count` field in the TDM schema is described as "number of times this dependency is used" — the current value is inaccurate

## Proposed Solutions

### Option 1: Increment `usage_count` when adding locations to existing entries

**Approach:** In the SDK deduplication block (and similar patterns), increment `usage_count` when appending to `locations`:

```typescript
existing.usage_count = (existing.usage_count ?? 0) + 1;
existing.locations.push({ file: rel, line: lineNum, context: trimmed });
```

Also set initial `usage_count` to 1 on creation (unchanged from current).

**Pros:** Accurate `usage_count` reflects actual call sites found. Low risk.
**Cons:** For API/infra entries (not deduplicated), each occurrence is still a separate entry with `usage_count: 1`. Deduplication of APIs by URL is a separate concern.
**Effort:** Small
**Risk:** Low

### Option 2: Deduplicate all entries by (kind, key) and sum usage_count in `buildTDM`

**Approach:** Have `buildTDM` in core aggregate all entries by their natural key (URL+method for APIs, provider for SDKs, type+connection for infra) and sum `usage_count`.

**Pros:** Deduplication in one place. Cleaner separation of concerns.
**Cons:** `buildTDM` currently takes raw entries — would need a significant refactor. Out of scope for Phase 1.
**Effort:** Large
**Risk:** Medium

### Option 3: Accept `usage_count: 1` as "detected" (boolean flag) rather than count

**Approach:** Document `usage_count` as "1 = detected, 0 = not detected" per entry, not an actual count. Align Python/JS/Go analyzers to the same convention.

**Pros:** No code change. Semantically valid.
**Cons:** `usage_count` name is misleading if it doesn't count usage. Schema says "number of times used".
**Effort:** Trivial (docs only)
**Risk:** None

## Recommended Action

To be filled during triage.

## Technical Details

- **Affected file:** `packages/languages/java/src/analyzer.ts` (multiple locations)
- Same pattern exists in `packages/languages/python/src/analyzer.ts` and `packages/languages/javascript/src/analyzer.ts`
- `usage_count` is defined in `schema/v1/tdm.schema.json` — check definition there

## Acceptance Criteria

- [ ] Decision made: `usage_count` is either accurate count or documented as "detected" flag
- [ ] If option 1: SDK entries with multiple locations show `usage_count` equal to `locations.length`
- [ ] Behavior consistent across all language analyzers

## Work Log

- 2026-02-25: Identified during PR #15 code review
