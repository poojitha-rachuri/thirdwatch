---
status: pending
priority: p1
issue_id: "002"
tags: [code-review, architecture, publishing, esm, cjs]
dependencies: []
---

# Fix CJS Output / `"import"` Export Condition Mismatch

## Problem Statement

`packages/tdm/package.json` declares `"import": "./dist/index.js"` in its exports map, but the compiled output (`dist/index.js`) is **CommonJS** (uses `require()` and `exports`). This contradicts what the `"import"` condition signals to Node.js and bundlers.

When published to npm, `import { parseTDM } from "@thirdwatch/tdm"` in an ESM consumer will fail or behave incorrectly because Node.js uses the `"import"` condition to load a file it expects to be ESM, but finds CJS syntax.

Additionally, the `./schema` export points to `./../../schema/v1/tdm.schema.json` which:
1. Traverses outside the package directory
2. Is not included in `"files": ["dist"]`

Both issues will cause failures for the first external consumer (the GitHub Action in Plan 11).

## Findings

**File:** `packages/tdm/package.json`

```json
{
  "main": "./dist/index.js",       // CJS — correct for "main"
  "exports": {
    ".": {
      "import": "./dist/index.js", // WRONG — signals ESM but file is CJS
      "types": "./dist/index.d.ts"
    },
    "./schema": "./../../schema/v1/tdm.schema.json"  // Outside package boundary
  },
  "files": ["dist"]                // schema/v1/ not included
}
```

**Why it's CJS:** `packages/tdm/package.json` does NOT have `"type": "module"`, so TypeScript's `module: NodeNext` emits CJS. This was correct (removed `"type": "module"` to fix Ajv import issues), but the exports map was not updated to reflect it.

## Proposed Solutions

### Option A — Fix exports map to match CJS output (Recommended for now)
Change `"import"` to `"require"` (or `"default"`) in the exports map. Add proper `"require"` condition. Remove or fix the `./schema` export.

```json
{
  "main": "./dist/index.js",
  "exports": {
    ".": {
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"]
}
```

- Pros: Minimal change, fixes the broken signal immediately
- Cons: Drops ESM export — ESM consumers get CJS (works in Node 14+, but not ideal)
- Effort: Small | Risk: Low

### Option B — Add `"type": "module"` + fix Ajv imports properly
Add `"type": "module"` to `packages/tdm/package.json`, resolve Ajv ESM import issues using named imports (`import { Ajv2020 } from "ajv/dist/2020.js"`), and emit true ESM output.

- Pros: Proper ESM-first package
- Cons: Requires re-testing Ajv import patterns that were previously problematic
- Effort: Medium | Risk: Medium

### Option C — Dual CJS+ESM build
Add a `tsup` or second `tsconfig` build step to emit both `dist/index.cjs` and `dist/index.mjs`.

- Pros: Maximum compatibility
- Cons: Adds build complexity to a foundation package
- Effort: Large | Risk: Medium

## Recommended Action

Option A first (unblock P1), then evaluate Option B as a follow-up before publishing `@thirdwatch/tdm` externally.

## Acceptance Criteria

- [ ] `exports` map conditions accurately reflect actual output file format
- [ ] `import { parseTDM } from "@thirdwatch/tdm"` works from both CJS and ESM consumers
- [ ] `./schema` export either removed or pointing to a file that is included in `"files"`
- [ ] Verified with `node --input-type=module -e "import { parseTDM } from '@thirdwatch/tdm'"`

## Work Log

- 2026-02-21: Found during architecture review of PR #1
