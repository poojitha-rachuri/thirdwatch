---
status: complete
priority: p1
issue_id: "053"
tags: [code-review, java, error-handling, reliability]
dependencies: []
---

# Java Analyzer: `parseManifests` Has No Error Handling — Can Abort Entire Scan

## Problem Statement

`packages/languages/java/src/manifests.ts` has no try/catch around `readFile()` or the XML/text parsers. If any Java manifest file is unreadable (permissions, encoding) or malformed (invalid XML in `pom.xml`), the thrown exception propagates through `scanner.ts`'s `Promise.all(plugins.map(...analyzeManifests...))` and aborts the entire scan. The CLAUDE.md contract says analyzers must NOT throw — errors should be caught internally and returned gracefully.

## Findings

- **File:** `packages/languages/java/src/manifests.ts:6-34`
- `readFile(manifest, "utf-8")` at line 21 has no error handling — throws on permission errors or binary files
- `parsePomXml` at line 40 calls `XMLParser.parse(content)` — can throw on malformed XML
- `scanner.ts:159-165` uses `Promise.all(plugins.map(p => p.analyzeManifests!(...)))` — no per-plugin error isolation here
- Other language analyzers (`parseManifests` in Python/JS) have similar patterns but the Java one is the first to use an external XML parser that can throw on malformed input
- The scan command in `apps/cli/src/commands/scan.ts` has an outer try/catch but it aborts the entire scan and reports failure — a single bad `pom.xml` kills the whole run

## Proposed Solutions

### Option 1: Wrap entire `parseManifests` body in try/catch per file (Recommended)

**Approach:** In the `for (const manifest of manifestFiles)` loop, wrap each iteration in a try/catch. Log errors via console.error (or accept an optional logger parameter). Return partial results.

```typescript
for (const manifest of manifestFiles) {
  try {
    // ... existing logic
  } catch (err) {
    console.error(`[java-analyzer] Failed to parse ${manifest}: ${err}`);
  }
}
```

**Pros:** Matches plugin contract. Consistent with Go/Python analyzers' error handling approach. Simple.
**Cons:** Errors are logged to stderr without structured reporting (no ScanError integration).
**Effort:** Small
**Risk:** Low

### Option 2: Accept a logger/error-collector parameter in `parseManifests`

**Approach:** Pass an error accumulator array to `parseManifests` (or accept an optional `onError` callback), matching how `scanner.ts` handles `ScanError`.

**Pros:** Errors surfaced to users via `--verbose` flag like source file errors.
**Cons:** Requires interface change to `analyzeManifests` signature (which is a public API).
**Effort:** Medium
**Risk:** Medium (interface change)

### Option 3: Return `{ entries, errors }` from `analyzeManifests`

**Approach:** Change return type of `analyzeManifests` to `Promise<{ entries: DependencyEntry[]; errors: ScanError[] }>`.

**Pros:** Full structured error reporting.
**Cons:** Breaking change to the `LanguageAnalyzerPlugin` interface (v0.1.0 stable API). Needs major version bump.
**Effort:** Large
**Risk:** High

## Recommended Action

To be filled during triage.

## Technical Details

- **Affected files:** `packages/languages/java/src/manifests.ts:6-34`, `packages/core/src/scanner.ts:159-165`
- `fast-xml-parser` throws `Error` on malformed XML (undocumented but observed behavior)
- Go analyzer `parseManifests` at `packages/languages/go/src/manifests.ts` should be checked for same issue

## Acceptance Criteria

- [ ] `parseManifests` does not throw under any input condition
- [ ] A malformed `pom.xml` causes an error to be logged but does not abort the scan
- [ ] Other manifest files in the same run still get processed
- [ ] Test added: `analyzeManifests(['invalid-pom.xml'], root)` returns empty array without throwing

## Work Log

- 2026-02-25: Identified during PR #15 code review
