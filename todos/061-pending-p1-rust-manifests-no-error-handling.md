---
status: pending
priority: p1
issue_id: "061"
tags: [code-review, rust, error-handling, reliability]
dependencies: []
---

# Rust Analyzer: `parseManifests` Has No Error Handling — Can Abort Entire Scan

## Problem Statement

`packages/languages/rust/src/manifests.ts` has no try/catch around `readFile()`. If any `Cargo.toml` is unreadable (permissions, binary file, encoding issue), the thrown exception propagates through `scanner.ts`'s `Promise.all` and aborts the entire scan. The `parseCargoToml` function only wraps the TOML parser in a try/catch — the file read itself is unprotected. This is the same P1 that was just fixed in the Java analyzer (053).

## Findings

- **File:** `packages/languages/rust/src/manifests.ts:13-16`
- `readFile(manifest, "utf-8")` at line 14 has no error handling
- `parseCargoToml` has try/catch around `parseTOML()` but NOT around `readFile()`
- `scanner.ts:159-165` wraps `analyzeManifests` calls in `Promise.all` without per-plugin error isolation
- The Java analyzer had the same bug and was fixed in commit `ec1bf30` — Rust was not updated at the same time

## Proposed Solutions

### Option 1: Wrap per-file block in try/catch (Recommended)

```typescript
for (const manifest of manifestFiles) {
  if (manifest.endsWith("Cargo.toml")) {
    try {
      const content = await readFile(manifest, "utf-8");
      entries.push(...parseCargoToml(content, relative(scanRoot, manifest)));
    } catch (err) {
      console.error(`[rust-analyzer] Failed to parse ${manifest}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
```

**Pros:** Consistent with Java fix. Non-fatal. Simple.
**Cons:** None.
**Effort:** Trivial
**Risk:** None

## Recommended Action

To be filled during triage.

## Acceptance Criteria

- [ ] `parseManifests` does not throw under any input condition
- [ ] Unreadable `Cargo.toml` logs error to stderr and does not abort the scan
- [ ] Test: `analyzeManifests(['nonexistent.toml'], root)` returns `[]` without throwing

## Work Log

- 2026-02-26: Identified during PR #16 code review
