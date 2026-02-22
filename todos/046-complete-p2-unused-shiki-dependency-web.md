---
status: complete
priority: p2
issue_id: "046"
tags: [code-review, web, dependencies]
dependencies: []
---

# Unused shiki Dependency in apps/web

## Problem Statement

`shiki` is listed in `apps/web/package.json` but never imported. Plan 06 mentioned Shiki for syntax highlighting, but the implementation uses plain `<pre><code>` and `JSON.stringify()`. This adds ~500KB+ to node_modules and unnecessary dependency surface.

## Findings

- **File:** `apps/web/package.json:21` — `"shiki": "^3.22.0"`
- No imports of shiki anywhere in apps/web
- TDM Explorer and CLI reference use raw `<pre><code>` instead
- Identified by: kieran-typescript-reviewer, code-simplicity-reviewer, security-sentinel, performance-oracle

## Proposed Solutions

### Option 1: Remove shiki

**Approach:** `pnpm remove shiki --filter @thirdwatch/web` (or equivalent).

**Pros:** Smaller install, less surface for vulnerabilities
**Cons:** None if syntax highlighting not needed
**Effort:** Small
**Risk:** Low

---

### Option 2: Add Shiki for syntax highlighting

**Approach:** Implement `code-block.tsx` using Shiki as planned; use in TDM Explorer and CLI reference.

**Pros:** Better code display
**Cons:** Adds complexity; current approach works
**Effort:** Medium
**Risk:** Low

---

### Option 3: Document and defer

**Approach:** Add a comment or issue for future Shiki use; keep dependency.

**Pros:** No immediate change
**Cons:** Unnecessary dependency remains
**Effort:** Trivial
**Risk:** Low

## Recommended Action

Removed shiki via pnpm remove.

## Technical Details

**Affected files:**
- `apps/web/package.json`
- `pnpm-lock.yaml`

## Resources

- **PR:** #5
- **Plan:** docs/plans/2026-02-21-06-feat-website-thirdwatch-dev-plan.md

## Acceptance Criteria

- [ ] shiki removed from dependencies OR used for syntax highlighting
- [ ] pnpm install succeeds
- [ ] Build passes

## Work Log

### 2026-02-22 - Code Review Discovery

**By:** workflows:review

**Actions:**
- Identified unused shiki dependency
- Removed via pnpm remove shiki --filter @thirdwatch/web
