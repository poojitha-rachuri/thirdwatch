---
status: done
priority: p1
issue_id: "038"
tags: [code-review, security]
dependencies: []
---

# Arbitrary File Overwrite via --output Path Traversal

## Problem Statement

The output path from `--output` / `-o` is resolved and passed directly to `writeFile()` with no validation. An attacker can overwrite arbitrary files (e.g. `../../../.bashrc`, `/etc/cron.d/malicious`). In CI, a malicious workflow could lead to code execution.

## Findings

- **File:** `apps/cli/src/commands/scan.ts:31, 86`
- **CWE:** CWE-22 (Improper Limitation of a Pathname)
- `resolve(opts.output)` — no check that path is within safe base
- User-controlled `--output` vector

## Proposed Solutions

### Option 1: Restrict to cwd or scan root

**Approach:** Validate output path is under `process.cwd()` or scan root after resolve. Reject paths that escape.

```ts
const outputPath = resolve(opts.output as string);
const basePath = resolve(process.cwd());
if (!outputPath.startsWith(basePath + path.sep) && outputPath !== basePath) {
  throw new Error(`Output path must be within current directory`);
}
```

**Pros:** Prevents path traversal
**Cons:** May restrict legitimate use cases (e.g. /tmp)
**Effort:** Small
**Risk:** Low

### Option 2: Special case -o -

**Approach:** Treat `-o -` as stdout; skip file write. For other paths, validate against cwd.

**Pros:** Agent-friendly; prevents overwrite
**Cons:** Slightly more logic
**Effort:** Small
**Risk:** Low

## Recommended Action

To be filled during triage.

## Resources

- **PR:** #4
- **Review agent:** security-sentinel

## Acceptance Criteria

- [ ] Output path validated against safe base (cwd or configurable)
- [ ] Or: support `-o -` for stdout-only; validate other paths
