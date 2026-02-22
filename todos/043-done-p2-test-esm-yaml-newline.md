---
status: done
priority: p2
issue_id: "043"
tags: [code-review]
dependencies: []
---

# Test __dirname in ESM + YAML Trailing Newline

## Problem Statement

1) scan.test.ts uses `__dirname` which is not defined in ESM; tests pass only because Vitest injects it — brittle. 2) formatYaml does not append trailing newline; formatJson does. Inconsistent; can cause issues when piping/appending.

## Findings

- **File:** `apps/cli/src/__tests__/scan.test.ts:8-9`
- `__dirname` in ESM — use `import.meta.url` + dirname(fileURLToPath(...))
- **File:** `apps/cli/src/output/yaml.ts:6`
- `yaml.dump(...)` — no `+ "\n"` like formatJson

## Proposed Solutions

### Option 1: Fix both

**Approach:** Replace __dirname with fileURLToPath(import.meta.url) pattern in tests. Add `+ "\n"` to formatYaml return.

**Pros:** ESM-correct; POSIX-friendly output
**Cons:** None
**Effort:** Small
**Risk:** Low

## Recommended Action

To be filled during triage.

## Resources

- **PR:** #4
- **Review agent:** kieran-typescript-reviewer

## Acceptance Criteria

- [ ] Tests use import.meta.url for __dirname
- [ ] formatYaml ends with newline like formatJson
