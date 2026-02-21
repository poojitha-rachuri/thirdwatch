---
status: pending
priority: p3
issue_id: "015"
tags: [code-review, testing, cleanup, typescript]
dependencies: []
---

# Test Suite Improvements and Cleanup

## Problem Statement

Several small improvements to the test suite (`validate.test.ts`) were identified:

1. **`passWithNoTests: true` in vitest.config.ts** — should be removed now that tests exist; silently passes if all test files are accidentally deleted
2. **`as Record<string, unknown>` casts in tests** — used 3× to delete required properties; bypasses TypeScript type checking
3. **Redundant `parseTDMFromString` happy-path test** — tests the same code path as `parseTDM` happy path
4. **Two redundant error tests can be merged** — `"error message lists the failing field path"` and `"exposes structured errors array"` both set up a try/catch for the same operation
5. **Missing test for `provider: null`** — the only nullable field in the schema; no explicit round-trip test
6. **Imprecise version path assertion** — `toContain("version")` passes because `"/version"` contains `"version"` — should assert `"/version"` explicitly

## Proposed Solutions

Each fix is independent and small:

### Fix 1 — Remove `passWithNoTests` from `vitest.config.ts`
```typescript
// Before
export default defineConfig({ test: { passWithNoTests: true } });

// After
export default defineConfig({});
```

### Fix 2 — Use destructuring instead of `as Record<string, unknown>` for field deletion tests

```typescript
// Before
const bad = { ...VALID_TDM } as Record<string, unknown>;
delete bad["version"];
expect(() => parseTDM(bad)).toThrow(TDMValidationError);

// After
const { version: _removed, ...withoutVersion } = VALID_TDM;
expect(() => parseTDM(withoutVersion)).toThrow(TDMValidationError);
```

### Fix 3 — Remove redundant `parseTDMFromString` happy-path test
Delete the `"parses a valid JSON string"` test (lines 210–213). The `parseTDM` happy-path test already covers this code path.

### Fix 4 — Merge the two error tests

```typescript
it("throws TDMValidationError with message containing path and a non-empty errors array", () => {
  try {
    parseTDM({ ...VALID_TDM, version: "bad" });
    expect.fail("should have thrown");
  } catch (err) {
    expect(err).toBeInstanceOf(TDMValidationError);
    expect((err as TDMValidationError).message).toContain("/version");
    expect((err as TDMValidationError).issues.length).toBeGreaterThan(0);  // or .errors
  }
});
```

### Fix 5 — Add `provider: null` round-trip test

```typescript
it("accepts TDMAPI with provider: null", () => {
  const withNullProvider: TDM = {
    ...VALID_TDM,
    apis: [{ ...VALID_TDM.apis[0]!, provider: null }],
  };
  const result = parseTDM(withNullProvider);
  expect(result.apis[0]?.provider).toBeNull();
});
```

### Fix 6 — Tighten version path assertion
Change `toContain("version")` to `toContain("/version")` to assert the instancePath not just any occurrence of "version" in the message.

## Acceptance Criteria

- [ ] `passWithNoTests: true` removed from `vitest.config.ts`
- [ ] Three `as Record<string, unknown>` casts replaced with destructuring
- [ ] Redundant `parseTDMFromString` happy-path test deleted
- [ ] Two error tests merged into one
- [ ] `provider: null` round-trip test added
- [ ] Version path assertion changed to `"/version"`
- [ ] All 18+ tests still pass after changes

## Work Log

- 2026-02-21: Found during TypeScript and simplicity reviews of PR #1
