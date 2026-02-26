---
status: complete
priority: p1
issue_id: "052"
tags: [code-review, java, false-positive, architecture]
dependencies: []
---

# Java Analyzer: Spring Controller Annotations Misidentified as Outgoing API Calls

## Problem Statement

`ANNOTATION_HTTP_PATTERNS` in `packages/languages/java/src/analyzer.ts` matches Spring MVC annotations (`@GetMapping`, `@PostMapping`, etc.) and emits them as outgoing `kind: "api"` entries. These annotations are used on both Spring controller methods (incoming routes) and Feign client interface methods (outgoing calls). Without context about whether the annotation appears on a controller class vs. an interface, the analyzer cannot distinguish the two — and real-world Spring applications will produce large numbers of false positives in the TDM.

## Findings

- **File:** `packages/languages/java/src/analyzer.ts:23-28`
- `ANNOTATION_HTTP_PATTERNS` includes both `@(GET|POST|...)` (Retrofit — outgoing) and `@(Get|Post|...)Mapping(...)` (Spring — ambiguous)
- The fixture `ApiClient.java` exercises `@PostMapping`/`@GetMapping` on a `@FeignClient` **interface**, which is outgoing (correct). But any Spring `@RestController` class with the same annotations would produce false positives.
- A typical Spring controller: `@GetMapping("/api/v1/users")` on `UserController.getUserList()` would be emitted as an outgoing HTTP GET to `/api/v1/users`.
- The test at `analyzer.test.ts:146-157` only validates the FeignClient case, not a controller case.

## Proposed Solutions

### Option 1: Remove Spring Mapping patterns from `ANNOTATION_HTTP_PATTERNS` (Recommended)

**Approach:** Remove `@(Get|Post|Put|Patch|Delete)Mapping` from `ANNOTATION_HTTP_PATTERNS`. These are ambiguous without broader context. Keep only Retrofit `@(GET|POST|...)` on interface methods (which are always outgoing). Add a note in code comments that Spring MVC routes are intentionally excluded.

**Pros:** Eliminates false positives entirely. Retrofit `@GET/@POST` are always outgoing. Simple fix.
**Cons:** Misses genuine Feign client `@GetMapping`/`@PostMapping` usage where the type context isn't a `@FeignClient` interface.
**Effort:** Small
**Risk:** Low

### Option 2: Add heuristic — only emit if adjacent to `@FeignClient` declaration

**Approach:** Track when the analyzer is inside a Feign client interface (detect `@FeignClient` annotation on the class/interface declaration) and only emit `@GetMapping`/`@PostMapping` within that scope.

**Pros:** More accurate — captures real Feign usages without controller false positives.
**Cons:** Regex-based line scanning makes scope tracking fragile. Multi-line annotations complicate this.
**Effort:** Medium
**Risk:** Medium

### Option 3: Treat Spring Mapping annotations as a separate `kind: "endpoint"` (future)

**Approach:** Emit Spring controller mappings as a new `kind: "endpoint"` (incoming route) rather than `kind: "api"` (outgoing call). This correctly captures the declared REST surface area.

**Pros:** Architecturally correct; both controller routes and outgoing calls are valuable data.
**Cons:** Requires TDM schema change; out of scope for Phase 1.
**Effort:** Large
**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

- **Affected file:** `packages/languages/java/src/analyzer.ts:23-28, 169-189`
- **Pattern causing issue:** `[/@(Get|Post|Put|Patch|Delete)Mapping\(\s*(?:value\s*=\s*)?"([^"]+)"/, "SPRING_MAPPING"]`
- Any Spring Boot app with `@RestController` and mapped methods will produce false positives

## Acceptance Criteria

- [ ] Spring controller `@GetMapping`/`@PostMapping` on a `@RestController` class do NOT appear in TDM as outgoing API calls
- [ ] Feign client `@PostMapping`/`@GetMapping` on a `@FeignClient` interface ARE captured
- [ ] Test added for Spring controller false-positive scenario

## Work Log

- 2026-02-25: Identified during PR #15 code review
