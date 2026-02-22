---
status: done
priority: p2
issue_id: "041"
tags: [code-review]
dependencies: []
---

# package.json Read Error Handling + confidenceDot Exhaustiveness

## Problem Statement

1) index.ts reads package.json with no try/catch; missing or invalid file crashes before any help. 2) confidenceDot switch has no default; if Confidence is extended, may return undefined.

## Findings

- **File:** `apps/cli/src/index.ts:10-12`
- `JSON.parse(readFileSync(...))` — no error handling
- **File:** `apps/cli/src/output/summary.ts:5-14`
- switch(confidence) — no default branch

## Proposed Solutions

### Option 1: Wrap + add default

**Approach:** Wrap package.json read in try/catch; fall back to "0.0.0" or exit with clear message. Add `default: { const _: never = confidence; return pc.gray("●"); }` to confidenceDot.

**Pros:** Robust; exhaustive
**Cons:** None
**Effort:** Small
**Risk:** Low

## Recommended Action

To be filled during triage.

## Resources

- **PR:** #4
- **Review agent:** kieran-typescript-reviewer

## Acceptance Criteria

- [ ] package.json read has error handling
- [ ] confidenceDot has default or exhaustiveness check
