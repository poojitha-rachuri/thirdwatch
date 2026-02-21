---
status: pending
priority: p3
issue_id: "014"
tags: [code-review, architecture, yagni, cleanup]
dependencies: []
---

# Move `ChangeCategory` and `Priority` Out of `@thirdwatch/tdm`

## Problem Statement

`ChangeCategory` and `Priority` are exported from `@thirdwatch/tdm` but are **not used by any field in any TDM interface**. They are analysis/classification primitives that belong in `@thirdwatch/analyzer` (Plan 09), not in the schema package.

Their presence in `@thirdwatch/tdm`:
- Couples the data format package to analysis semantics not yet built
- Creates confusion about where classification logic lives
- Pollutes the public API with YAGNI types that no current consumer uses

Notably, Plan 08 already re-declares these types locally rather than importing them from this package — confirming the types are in the wrong place.

## Findings

- `types.ts` lines 9–18: declarations
- `index.ts` lines 12–13: re-exports
- No other file in `packages/` references these types
- No field in any `TDM*` interface uses them

## Proposed Solutions

### Option A — Remove from `types.ts` and `index.ts` now, add TODO comment (Recommended)
Delete both type declarations. When `@thirdwatch/analyzer` is implemented (Plan 09), define them there.

- Pros: Cleaner public API; removes YAGNI types; ~12 lines deleted
- Cons: If Plan 09 wants to import them from `@thirdwatch/tdm`, the import location changes
- Effort: Trivial | Risk: Low

### Option B — Keep but add a JSDoc `@deprecated` / TODO comment

```typescript
/**
 * @deprecated Move to @thirdwatch/analyzer when Plan 09 is implemented.
 * TODO(Plan 09): This type belongs in the analyzer package, not the schema package.
 */
export type ChangeCategory = ...
```

- Pros: No breaking change; documents intent
- Cons: Still pollutes the public API; exported `@deprecated` types create noise
- Effort: Trivial | Risk: None

## Recommended Action

Option A. No consumers exist. Delete now, re-add in the right package when needed.

## Acceptance Criteria

- [ ] `ChangeCategory` removed from `types.ts` and `index.ts`
- [ ] `Priority` removed from `types.ts` and `index.ts`
- [ ] No remaining references to these types in `packages/tdm/`
- [ ] `tsc --noEmit` passes after removal

## Work Log

- 2026-02-21: Found during simplicity and pattern recognition reviews of PR #1
