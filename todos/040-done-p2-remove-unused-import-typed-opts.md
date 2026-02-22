---
status: done
priority: p2
issue_id: "040"
tags: [code-review]
dependencies: []
---

# Remove Unused Import + Typed Commander Options

## Problem Statement

1) `yaml` is imported in scan.ts but never used — formatting uses formatJson/formatYaml. 2) Commander action `opts` is untyped; all option access uses `as` casts, losing type safety.

## Findings

- **File:** `apps/cli/src/commands/scan.ts:8, 27`
- `import yaml from "js-yaml"` — unused
- `.action(async (scanPath: string, opts) => {` — opts untyped

## Proposed Solutions

### Option 1: Remove import + add interface

**Approach:** Remove yaml import. Define `interface ScanOptions { output?: string; format?: string; ... }` and use `.action(async (scanPath: string, opts: ScanOptions) => {`.

**Pros:** Type safety; no dead code
**Cons:** None
**Effort:** Small
**Risk:** Low

## Recommended Action

To be filled during triage.

## Resources

- **PR:** #4
- **Review agent:** kieran-typescript-reviewer

## Acceptance Criteria

- [ ] Unused yaml import removed
- [ ] opts typed via interface
