---
status: pending
priority: p1
issue_id: "006"
tags: [code-review, typescript, type-safety, schema]
dependencies: ["005"]
---

# Use `JSONSchemaType<TDM>` to Close Schema/Types Gap at Compile Time

## Problem Statement

`parseTDM` returns `input as TDM` after Ajv validation. This cast is **unsound**: Ajv validates JSON shape against the embedded schema, but the embedded schema and the TypeScript `TDM` interface are two separate definitions maintained independently. There is no compile-time guarantee they stay in sync.

If someone adds a field to `types.ts` without updating the embedded schema (or vice versa), `parseTDM` will silently return a value typed as `TDM` that doesn't actually match the interface. For a foundation package that every other package trusts as its data contract, this is the highest-risk point in the codebase.

## Findings

**File:** `packages/tdm/src/validate.ts`, lines 161–166

```typescript
export function parseTDM(input: unknown): TDM {
  if (!_validate(input)) {
    throw new TDMValidationError(_validate.errors ?? []);
  }
  return input as TDM;  // <-- unsafe cast; relies on schema/types staying in sync manually
}
```

## Proposed Solutions

### Option A — Annotate `TDM_SCHEMA` with `JSONSchemaType<TDM>` (Recommended)

```typescript
import type { JSONSchemaType } from "ajv";
import type { TDM } from "./types.js";

const TDM_SCHEMA: JSONSchemaType<TDM> = {
  // ... same schema content ...
} as const;

const _validate = ajv.compile<TDM>(TDM_SCHEMA);
```

With `JSONSchemaType<TDM>`, TypeScript will error at compile time if the schema shape does not match the `TDM` interface. This closes the gap:
- Add a field to `TDM` without updating the schema → TypeScript error on `TDM_SCHEMA`
- Add a field to `TDM_SCHEMA` that doesn't exist in `TDM` → TypeScript error on the object literal

The `parseTDM` cast then becomes sound:
```typescript
const _validate = ajv.compile<TDM>(TDM_SCHEMA);
// _validate is ValidateFunction<TDM> — the type narrowing is checked by Ajv's type system
return input as TDM; // now sound given the compile-time constraint above
```

**Caveat:** `JSONSchemaType` has limitations with open `string` unions (`ecosystem: "npm" | string`). TypeScript may require `as any` on those specific fields or use `JTDSchemaType` instead. Evaluate during implementation.

- Pros: Closes the structural gap at compile time; no cast is truly unsafe
- Cons: `JSONSchemaType` has edge cases with discriminated unions and open string unions
- Effort: Medium | Risk: Medium (may require `as any` workarounds for open unions)

### Option B — Add a compile-time `satisfies` check
```typescript
import type { SchemaObject } from "ajv";
// Doesn't close the gap but makes the relationship explicit
const TDM_SCHEMA = { ... } as const satisfies SchemaObject;
```

- Pros: No restrictions on schema content
- Cons: Does not enforce schema/type synchrony; just type-checks the schema is a valid Ajv schema
- Effort: Trivial | Risk: High (doesn't solve the problem)

## Recommended Action

Option A. Attempt `JSONSchemaType<TDM>`. If open union fields (`ecosystem`, `infrastructure.type`) cause irresolvable errors, annotate those specific fields with `as any` and document why, preserving the compile-time check for all other fields.

## Acceptance Criteria

- [ ] `TDM_SCHEMA` is annotated with `JSONSchemaType<TDM>` or the type gap is otherwise enforced at compile time
- [ ] `tsc` emits a type error if a required field is added to `TDM` but not to `TDM_SCHEMA`
- [ ] `parseTDM` return type is `TDM` with a justifiable (not purely trust-based) cast

## Work Log

- 2026-02-21: Found during TypeScript review of PR #1
