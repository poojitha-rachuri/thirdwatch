---
status: pending
priority: p2
issue_id: "008"
tags: [code-review, architecture, schema, testing]
dependencies: []
---

# Add CI Test to Detect Schema Drift Between Embedded Copy and Canonical File

## Problem Statement

There are **three representations** of the TDM schema that must stay manually synchronized:
1. `schema/v1/tdm.schema.json` — canonical JSON file (what external tools and documentation reference)
2. `TDM_SCHEMA` in `packages/tdm/src/validate.ts` — what the runtime validator actually uses
3. TypeScript interfaces in `packages/tdm/src/types.ts` — what the type system uses

A field added to `schema/v1/tdm.schema.json` won't affect runtime validation until also added to `TDM_SCHEMA` in `validate.ts`. There is **no CI check** that detects drift between these. The next PR adding a field will almost certainly update one copy and forget the other.

An external consumer who does `import schema from "@thirdwatch/tdm/schema"` gets a different schema than what `parseTDM` enforces internally.

## Findings

- `validate.ts` comment (lines 6–9): explicitly acknowledges the embedding as a workaround for build boundary issues
- The canonical JSON file and embedded TS const currently have identical field structure (verified by pattern recognition reviewer)
- The canonical JSON file has `description` fields on all properties; the embedded copy omits them — but this structural divergence doesn't affect validation

## Proposed Solutions

### Option A — Add a vitest test that compares the two schemas (Recommended)

```typescript
// In validate.test.ts (or a new schema-sync.test.ts)
import { readFileSync } from "fs";
import { join } from "path";

it("embedded TDM_SCHEMA matches schema/v1/tdm.schema.json structurally", () => {
  // Import the embedded schema object (expose it for testing)
  // Compare against the canonical JSON file, ignoring description fields
  const canonicalJson = JSON.parse(
    readFileSync(join(__dirname, "../../../../schema/v1/tdm.schema.json"), "utf-8")
  );

  // Strip description fields from canonical for comparison
  const strip = (obj: unknown): unknown => {
    if (typeof obj !== "object" || obj === null) return obj;
    if (Array.isArray(obj)) return obj.map(strip);
    const { description: _, ...rest } = obj as Record<string, unknown>;
    return Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, strip(v)]));
  };

  expect(TDM_SCHEMA_EXPORTED).toMatchObject(strip(canonicalJson));
});
```

This requires exposing `TDM_SCHEMA` as an export (as `TDM_SCHEMA_OBJECT` from `index.ts`). See TypeScript reviewer recommendation #5.

- Pros: Makes drift a CI failure; zero ongoing maintenance beyond schema changes
- Cons: Requires exporting the schema object; path to canonical file is relative
- Effort: Small | Risk: Low

### Option B — Long-term: Import canonical JSON directly in `validate.ts`
Resolve the TypeScript `rootDir` import boundary issue and eliminate the embedded copy. This is the real fix.

The issue: `import schema from "../../schema/v1/tdm.schema.json"` fails because `schema/v1/` is outside `packages/tdm/src/` (the `rootDir`). Fix options:
- Symlink or copy `tdm.schema.json` into `packages/tdm/src/` at build time
- Move canonical schema into the package and symlink from `schema/v1/`
- Use `paths` in tsconfig to alias the import

- Pros: Single source of truth; eliminates maintenance burden
- Cons: Requires build toolchain change; more complex
- Effort: Medium | Risk: Medium

## Recommended Action

Option A immediately (adds safety net). Option B tracked separately as a follow-up.

## Acceptance Criteria

- [ ] Vitest test verifies structural equality between embedded schema and canonical JSON file
- [ ] CI fails if the two schemas diverge
- [ ] `TDM_SCHEMA` (or a sanitized version) is exported for testing purposes

## Work Log

- 2026-02-21: Found by architecture and pattern recognition reviewers on PR #1
