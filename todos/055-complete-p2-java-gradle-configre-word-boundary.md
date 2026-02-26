---
status: complete
priority: p2
issue_id: "055"
tags: [code-review, java, regex, false-positive]
dependencies: []
---

# Java Analyzer: Gradle `configRe` Lacks Word Boundaries — Fragile Exclusion of Test Dependencies

## Problem Statement

`parseGradleBuild` in `packages/languages/java/src/manifests.ts` uses a regex `/(?:implementation|api|compileOnly|runtimeOnly)/` without word boundaries (`\b`) to match Gradle build configurations. Currently `testImplementation` is excluded only because Gradle uses camelCase (`testImplementation` has uppercase 'I'), which doesn't match the lowercase `implementation` in the regex. This is fragile: any custom configuration name like `testapi`, `testcompileOnly`, or `integTestImplementation` (lowercase) could accidentally match. Additionally, `annotationProcessor` and `kapt` configurations (used for Kotlin/annotation processors) are not handled.

## Findings

- **File:** `packages/languages/java/src/manifests.ts:103`
- `configRe = /(?:implementation|api|compileOnly|runtimeOnly)/` — no `\b` anchors
- Test passes `"skips testImplementation dependencies"` only because standard Gradle camelCase produces uppercase 'I', not because the regex is correct
- Custom configurations like `integrationTestImplementation`, `functionalTestImplementation` (AndroidX uses these) follow the same camelCase convention and would be excluded correctly. But `testapi` (unusual but possible) would match `api` within it and include test-only deps.
- `annotationProcessor 'org.projectlombok:lombok:1.18.30'` — Lombok annotation processor is a common dependency that would be MISSED (annotationProcessor config not in `configRe`)

## Proposed Solutions

### Option 1: Add `\b` word boundaries (Recommended)

**Approach:** Change `configRe` to `/\b(?:implementation|api|compileOnly|runtimeOnly)\b/`. This ensures only standalone config names match, not substrings within longer names.

**Pros:** Correct regex semantics. Low risk — the common Gradle config names are all standalone words.
**Cons:** `\b` in JavaScript regex works with ASCII word characters. Gradle config names are alphanumeric so `\b` works correctly here.
**Effort:** Trivial
**Risk:** None

### Option 2: Also add `annotationProcessor` and `kapt` to `configRe`

**Approach:** Extend `configRe` to include `annotationProcessor` and `kapt` (Kotlin annotation processing):
`/\b(?:implementation|api|compileOnly|runtimeOnly|annotationProcessor|kapt)\b/`

**Pros:** Captures annotation processor dependencies (Lombok, MapStruct, Dagger) which are external deps worth tracking.
**Cons:** `compileOnly` already partially covers this use case.
**Effort:** Trivial
**Risk:** Low

## Recommended Action

To be filled during triage.

## Technical Details

- **Affected file:** `packages/languages/java/src/manifests.ts:103`
- Standard Gradle configurations: `implementation`, `api`, `compileOnly`, `runtimeOnly`, `testImplementation`, `testCompileOnly`, `testRuntimeOnly`, `annotationProcessor`, `kapt`, `provided`
- The Groovy DSL pattern already has correct string boundary handling (requires `\s+['"]` or `\(["']`) but the map notation regex has the same concern

## Acceptance Criteria

- [ ] `testImplementation 'junit:junit:4.13.2'` is not matched even if a custom config uses all-lowercase
- [ ] `\b` word boundaries added to `configRe`
- [ ] Test added for a dependency with a config that contains `implementation` as a substring

## Work Log

- 2026-02-25: Identified during PR #15 code review
