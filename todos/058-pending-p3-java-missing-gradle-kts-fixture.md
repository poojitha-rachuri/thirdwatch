---
status: pending
priority: p3
issue_id: "058"
tags: [code-review, java, testing, fixtures]
dependencies: []
---

# Java Analyzer: Missing `build.gradle.kts` Test Fixture

## Problem Statement

The PR description claims support for "Gradle `build.gradle.kts` — Kotlin DSL notation" and the parser in `parseGradleBuild` handles `.kts` files (same code path as `.gradle`). However, the `fixtures/java-app/` directory has no `build.gradle.kts` file and no test exercises the Kotlin DSL parsing path directly. Coverage for `.kts` parsing exists only implicitly (same regex runs on both).

## Findings

- **Files:** `fixtures/java-app/` directory, `packages/languages/java/src/__tests__/manifests.test.ts`
- `fixtures/java-app/build.gradle` exists (Groovy DSL) ✓
- `fixtures/java-app/build.gradle.kts` does NOT exist ✗
- `manifests.ts:26` handles `.kts` via same branch as `.gradle`
- The Kotlin DSL uses parentheses around deps: `implementation("com.stripe:stripe-java:24.0.0")` vs Groovy's `implementation 'com.stripe:stripe-java:24.0.0'`
- `kotlinRe` regex is meant to handle this but is never exercised by a fixture file

## Proposed Solutions

### Option 1: Add `fixtures/java-app/build.gradle.kts` and a test (Recommended)

**Approach:** Create a minimal Kotlin DSL `build.gradle.kts` fixture with Kotlin DSL syntax and add a test in `manifests.test.ts` that parses it.

Example fixture:
```kotlin
dependencies {
    implementation("com.stripe:stripe-java:24.0.0")
    implementation("software.amazon.awssdk:s3:2.21.0")
    testImplementation("junit:junit:4.13.2")
}
```

**Pros:** Directly validates the `.kts` code path. Catches regressions.
**Cons:** None.
**Effort:** Trivial
**Risk:** None

### Option 2: Note as known gap — defer to future PR

**Approach:** Accept the current implicit coverage and add a comment in the test file noting that `.kts` is covered by the same code path.

**Pros:** No work needed.
**Cons:** If the code path for `.kts` diverges (it won't currently but could), the gap would go undetected.
**Effort:** None
**Risk:** Low

## Recommended Action

To be filled during triage.

## Technical Details

- **Affected files:** `fixtures/java-app/` (missing `build.gradle.kts`), `packages/languages/java/src/__tests__/manifests.test.ts`
- The `kotlinRe` pattern at `manifests.ts:116-123` handles `implementation("group:artifact:version")` syntax

## Acceptance Criteria

- [ ] `fixtures/java-app/build.gradle.kts` exists with Kotlin DSL dependencies
- [ ] `manifests.test.ts` has a test group for `build.gradle.kts` parsing
- [ ] `testImplementation` is excluded and `implementation(...)` is included in the fixture test

## Work Log

- 2026-02-25: Identified during PR #15 code review
