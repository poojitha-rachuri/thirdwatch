---
status: done
priority: p1
issue_id: "037"
tags: [code-review, cli]
dependencies: []
---

# --quiet Suppresses Error Output to stderr

## Problem Statement

With `--quiet`, scan failures do not print the error message. Agents and scripts get exit code 1 but no explanation. Errors should always be written to stderr regardless of `--quiet`.

## Findings

- **File:** `apps/cli/src/commands/scan.ts:95-103`
- `if (!quiet)` guards both `s.fail()` and `console.error()` — errors never printed when quiet
- Agents need error message to diagnose failures

## Proposed Solutions

### Option 1: Always emit errors to stderr

**Approach:** Remove the `!quiet` guard from `console.error`; always write error message. Keep `s.fail()` guarded (spinner only when not quiet).

**Pros:** Agents get error info; scripts can log
**Cons:** None
**Effort:** Trivial
**Risk:** Low

## Recommended Action

To be filled during triage.

## Resources

- **PR:** #4
- **Review agent:** kieran-typescript-reviewer

## Acceptance Criteria

- [ ] Error message always written to stderr on scan failure
- [ ] `--quiet` still suppresses spinner and summary
