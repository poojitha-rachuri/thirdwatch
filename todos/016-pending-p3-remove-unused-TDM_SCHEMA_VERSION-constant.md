---
status: pending
priority: p3
issue_id: "016"
tags: [code-review, yagni, cleanup]
dependencies: ["012"]
---

# Remove or Actually Use `TDM_SCHEMA_VERSION` Constant

## Problem Statement

`TDM_SCHEMA_VERSION = "1.0"` is exported from `@thirdwatch/tdm` but **no runtime code uses it**. The validator uses a hardcoded regex pattern (`^\d+\.\d+$`). The test fixture uses a bare string literal `"1.0"`. The spec doc references it only as a future-human instruction.

Exporting a constant that nothing in the package reads is YAGNI. If the schema advances to `"1.1"`, someone must remember to update both the constant AND the test fixture, with no compile-time linkage between them.

## Proposed Solutions

### Option A — Remove the constant (Recommended if todo #012 is also resolved)
After removing `metadata.schema_version` (todo #012), remove `TDM_SCHEMA_VERSION` too. The canonical version is in `schema/v1/tdm.schema.json` as the `$id` URL and in the `tdm-spec.md`.

- Pros: Eliminates dead export; ~2 lines removed
- Cons: External consumers who `import { TDM_SCHEMA_VERSION } from "@thirdwatch/tdm"` would break (unlikely since no consumers exist yet)
- Effort: Trivial | Risk: None

### Option B — Actually use it in the validator and test fixture
```typescript
// In validate.ts
version: { type: "string", const: TDM_SCHEMA_VERSION },  // Lock to exactly "1.0"

// In validate.test.ts
version: TDM_SCHEMA_VERSION,  // Prevent test fixture version from drifting
```

- Pros: Constant has a real purpose; test drift is prevented at compile time
- Cons: Locks the schema to exactly one version string — less flexible for version negotiation
- Effort: Small | Risk: Low

## Recommended Action

Option B — make the constant mean something by wiring it into the validator's version check. This also partially addresses the security reviewer's finding that any `X.Y` version string passes validation.

If todo #012 removes `metadata.schema_version`, wire `TDM_SCHEMA_VERSION` into the root `version` field validator.

## Acceptance Criteria

- [ ] `TDM_SCHEMA_VERSION` either removed (and deleted from `index.ts`) or actively used in the runtime validator and test fixtures
- [ ] Test fixture uses the constant: `version: TDM_SCHEMA_VERSION`
- [ ] If used in validator: test confirms version `"2.0"` is rejected

## Work Log

- 2026-02-21: Found during simplicity and pattern recognition reviews of PR #1
