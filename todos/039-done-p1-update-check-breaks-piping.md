---
status: done
priority: p1
issue_id: "039"
tags: [code-review, cli, agent-native]
dependencies: []
---

# Update Check Writes to stdout and Breaks Piping

## Problem Statement

`checkForUpdates()` runs on every invocation and uses `console.log()` for the update message. That output goes to stdout. With `thirdwatch scan . --quiet | jq .`, the stream can contain both TDM JSON and the update message, causing `jq` and other parsers to fail. The check is async so the race is non-deterministic.

## Findings

- **File:** `apps/cli/src/update-check.ts`
- `console.log(pc.yellow(...))` — goes to stdout
- Runs on every invocation; no check for --quiet or non-TTY

## Proposed Solutions

### Option 1: Skip when --quiet or non-TTY

**Approach:** Skip update check when `--quiet` is used, or when `!process.stdout.isTTY`, or when `CI` or `NO_UPDATE_NOTIFICATION` env var is set. Pass quiet flag from index to checkForUpdates.

**Pros:** Piping works; CI unaffected
**Cons:** Need to pass opts to update check (called before parse)
**Effort:** Small
**Risk:** Low

### Option 2: Write update message to stderr

**Approach:** Use `console.error` instead of `console.log` for update message.

**Pros:** stdout stays clean for piping
**Cons:** Update message mixes with stderr; may still appear in quiet mode
**Effort:** Trivial
**Risk:** Low

### Option 3: Skip when non-TTY only

**Approach:** Check `process.stdout.isTTY`; skip if false (piping, CI).

**Pros:** Simple; covers most cases
**Cons:** --quiet with TTY would still show update
**Effort:** Small
**Risk:** Low

## Recommended Action

To be filled during triage.

## Resources

- **PR:** #4
- **Review agent:** agent-native-reviewer

## Acceptance Criteria

- [ ] `thirdwatch scan . --quiet | jq .` produces valid JSON only
- [ ] Update check does not pollute stdout when piping
