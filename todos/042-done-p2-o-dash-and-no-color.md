---
status: done
priority: p2
issue_id: "042"
tags: [code-review, cli, agent-native]
dependencies: []
---

# Support -o - for stdout + --no-color for CI

## Problem Statement

1) `-o -` is not supported; it resolves to a file path `./-` instead of stdout. Agents want `thirdwatch scan . -o -` for stdout-only without writing a file. 2) Plan 5.4 specifies `--no-color` for CI; not implemented. picocolors used unconditionally; ANSI codes appear when piping.

## Findings

- **File:** `apps/cli/src/commands/scan.ts`
- `resolve(opts.output)` — "-" becomes path to file named "-"
- **File:** `apps/cli/src/output/summary.ts`, update-check.ts
- No --no-color; no NO_COLOR respect

## Proposed Solutions

### Option 1: -o - and --no-color

**Approach:** When `opts.output === "-"`, write to stdout only; skip file write. Add `--no-color` option; when set or `NO_COLOR` env, use picocolors with `isColorSupported: false` or strip colors.

**Pros:** Agent-friendly; CI-friendly
**Cons:** Slightly more logic
**Effort:** Medium
**Risk:** Low

### Option 2: -o - only

**Approach:** Just add -o - support; defer --no-color.

**Pros:** Addresses main agent need
**Cons:** CI still gets colors
**Effort:** Small
**Risk:** Low

## Recommended Action

To be filled during triage.

## Resources

- **PR:** #4
- **Review agent:** agent-native-reviewer

## Acceptance Criteria

- [ ] `-o -` writes TDM to stdout only (no file)
- [ ] `--no-color` or NO_COLOR disables ANSI output
