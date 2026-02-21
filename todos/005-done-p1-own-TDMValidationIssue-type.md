---
status: pending
priority: p1
issue_id: "005"
tags: [code-review, typescript, api-design, stability]
dependencies: []
---

# Define Owned `TDMValidationIssue` Type Instead of Leaking Ajv's `ErrorObject`

## Problem Statement

`TDMValidationError.errors` is typed as `NonNullable<typeof _validate.errors>` which resolves to Ajv's internal `ErrorObject[]`. **Ajv's `ErrorObject` is now part of the public API of `@thirdwatch/tdm`.**

Every consumer of this package (scanner, watcher, analyzer, notifier) will type `err.errors` as `ErrorObject[]`. If Ajv is ever upgraded to a version that changes `ErrorObject`, or swapped for a different validator (Zod, Valibot), every consumer's type-checking breaks simultaneously. This is a stability violation in a foundation package.

## Findings

**File:** `packages/tdm/src/validate.ts`, lines 144–155

```typescript
export class TDMValidationError extends Error {
  readonly errors: NonNullable<typeof _validate.errors>;  // <-- leaks Ajv internals

  constructor(errors: NonNullable<typeof _validate.errors>) {
    ...
  }
}
```

The `typeof _validate.errors` is also coupled to the specific compiled validator instance — if the module is restructured, the type changes silently.

## Proposed Solutions

### Option A — Define `TDMValidationIssue` in `types.ts` (Recommended)

```typescript
// In types.ts — stable, owned type
export interface TDMValidationIssue {
  /** JSON path to the failing field, e.g. "/packages/0/confidence" */
  path: string;
  /** Human-readable message, e.g. "must be equal to one of the allowed values" */
  message: string;
  /** Validation keyword that failed, e.g. "enum", "required", "type" */
  keyword: string;
}
```

```typescript
// In validate.ts
import type { ErrorObject } from "ajv";
import type { TDMValidationIssue } from "./types.js";

function toValidationIssue(e: ErrorObject): TDMValidationIssue {
  return {
    path: e.instancePath || "(root)",
    message: e.message ?? "unknown error",
    keyword: e.keyword,
  };
}

export class TDMValidationError extends Error {
  readonly issues: TDMValidationIssue[];  // renamed from `errors` to avoid confusion

  constructor(rawErrors: ErrorObject[]) {
    const shown = rawErrors.slice(0, 5);
    const rest = rawErrors.length - shown.length;
    const summary = shown
      .map((e) => `${e.instancePath || "(root)"}: ${e.message ?? "unknown error"}`)
      .join("; ");
    const suffix = rest > 0 ? `; ... and ${rest} more` : "";
    super(`TDM validation failed: ${summary}${suffix}`);
    this.name = "TDMValidationError";
    this.issues = rawErrors.map(toValidationIssue);
  }
}
```

Note: property renamed from `errors` to `issues` to avoid collision with `Error.cause` semantics and to signal it's not raw Ajv errors.

- Pros: Stable public API; Ajv becomes a true implementation detail; enables validator swap without consumer breakage
- Cons: Breaking change if consumers already use `.errors` — but since no consumers exist yet, now is the time
- Effort: Small | Risk: Low

### Option B — Keep Ajv's `ErrorObject` but re-export it with an alias
```typescript
export type { ErrorObject as TDMValidationErrorDetail } from "ajv";
```

- Pros: No mapping needed
- Cons: Still couples consumers to Ajv; just hides the coupling behind an alias
- Effort: Trivial | Risk: High (future breakage)

## Recommended Action

Option A. The property rename from `errors` to `issues` is also combined with the error cap fix from performance review (see todo #007).

## Acceptance Criteria

- [ ] `TDMValidationIssue` interface defined in `types.ts` and exported from `index.ts`
- [ ] `TDMValidationError.issues` is typed as `TDMValidationIssue[]`
- [ ] `ErrorObject` from Ajv is not exported from `index.ts`
- [ ] Existing tests updated: `err.errors` → `err.issues`
- [ ] Test for `err.issues[0].path`, `err.issues[0].message`, `err.issues[0].keyword`

## Work Log

- 2026-02-21: Found during TypeScript review of PR #1
