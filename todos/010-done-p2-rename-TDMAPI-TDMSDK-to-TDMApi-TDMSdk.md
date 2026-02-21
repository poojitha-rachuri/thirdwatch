---
status: pending
priority: p2
issue_id: "010"
tags: [code-review, naming, typescript, consistency]
dependencies: []
---

# Rename `TDMAPI` / `TDMSDK` to `TDMApi` / `TDMSdk` for Naming Consistency

## Problem Statement

The six TDM entity interfaces use inconsistent acronym treatment:

| Interface | Acronym treatment |
|---|---|
| `TDMPackage`, `TDMInfrastructure`, `TDMWebhook`, `TDMMetadata`, `TDMLocation` | Next word capitalized normally |
| `TDMAPI` | Two consecutive all-caps acronyms — unreadable |
| `TDMSDK` | Two consecutive all-caps acronyms — unreadable |

TypeScript community convention (Google/Microsoft style guides) renders multi-acronym names with only the first letter of each subsequent acronym capitalized: `TDMApi`, `TDMSdk`. This is also consistent with how TypeScript names things like `XMLHttpRequest`.

`TDMAPI` and `TDMSDK` create an unbroken uppercase run that is harder to parse at a glance, especially in compound expressions like `TDMAPI[]`.

## Findings

The names appear in 4 files:
- `packages/tdm/src/types.ts` — interface declarations (lines 83, 106)
- `packages/tdm/src/validate.ts` — `$defs` keys (lines 76, 91) and `$ref` strings
- `packages/tdm/src/index.ts` — re-exports (lines 6, 7)
- `schema/v1/tdm.schema.json` — `$defs` keys and `$ref` strings (lines 133, 151)

This is a **breaking change** to the public TypeScript API (renames exported types). Since no consumers exist yet outside this PR, now is the right time.

## Proposed Solutions

### Option A — Rename now before any consumers exist (Recommended)

Rename across all 4 files:
- `TDMAPI` → `TDMApi`
- `TDMSDK` → `TDMSdk`
- `$ref: "#/$defs/TDMAPI"` → `$ref: "#/$defs/TDMApi"` (in both schema copies)

- Pros: Clean API from the start; no migration needed later
- Cons: 4-file change; must be synchronized carefully
- Effort: Small | Risk: Low

### Option B — Add type aliases and deprecate
```typescript
export type TDMAPI = TDMApi;  // deprecated alias
export type TDMSDK = TDMSdk;  // deprecated alias
```

- Pros: Backwards compatible
- Cons: Adds complexity; "backwards compatible" is irrelevant since no consumers exist
- Effort: Small | Risk: Low (but unnecessary)

## Recommended Action

Option A. Simple search-and-replace across 4 files. Verify with `tsc --noEmit` after.

## Acceptance Criteria

- [ ] `TDMAPI` renamed to `TDMApi` in `types.ts`, `validate.ts`, `index.ts`, `tdm.schema.json`
- [ ] `TDMSDK` renamed to `TDMSdk` in all four files
- [ ] All `$ref` strings updated to match new `$defs` keys
- [ ] `tsc --noEmit` passes with zero errors after rename
- [ ] Tests pass (they reference the type names in imports)

## Work Log

- 2026-02-21: Found during pattern recognition review of PR #1
