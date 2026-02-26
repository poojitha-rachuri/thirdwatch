---
status: pending
priority: p1
issue_id: "063"
tags: [code-review, rust, kafka, tdm-accuracy]
dependencies: []
---

# Rust Analyzer: `bootstrap.servers` Pattern Captures Wrong `connection_ref`

## Problem Statement

The `INFRA_PATTERNS` entry `[/bootstrap\.servers/, "kafka"]` fires on Rust lines like `.set("bootstrap.servers", "localhost:9092")`. The connection_ref extraction uses `allQuoted[0]` (the first quoted string on the line), which is `"bootstrap.servers"` — the config key name — not `"localhost:9092"` — the actual broker address. This writes meaningless data to the TDM that cannot be used for monitoring.

## Findings

- **File:** `packages/languages/rust/src/analyzer.ts:199-202`
- For `.set("bootstrap.servers", "localhost:9092")`:
  - `allQuoted` = `["bootstrap.servers", "localhost:9092"]`
  - `allQuoted[0]` = `"bootstrap.servers"` ← wrong
  - `allQuoted[1]` = `"localhost:9092"` ← correct
- The TDM entry has `connection_ref: "bootstrap.servers"` — useless for monitoring
- This also causes duplicate Kafka entries: `FutureProducer` fires on the type declaration line, `bootstrap.servers` fires on the `.set()` call line, producing two separate kafka infrastructure entries

## Proposed Solutions

### Option 1: Remove `bootstrap.servers` from `INFRA_PATTERNS`; scan nearby for it when `FutureProducer`/`StreamConsumer` fires (Recommended)

Remove the `[/bootstrap\.servers/, "kafka"]` entry from `INFRA_PATTERNS`. Instead, when `FutureProducer` or `StreamConsumer` is detected, scan ±10 nearby lines for `.set("bootstrap.servers", "...")` to extract the broker address.

```typescript
function findRustKafkaBootstrapServers(lines: string[], lineIndex: number): string {
  const start = Math.max(0, lineIndex - 3);
  const end = Math.min(lines.length - 1, lineIndex + 10);
  for (let j = start; j <= end; j++) {
    const m = lines[j]!.match(/"bootstrap\.servers"\s*,\s*"([^"]+)"/);
    if (m) return m[1]!;
  }
  return "unknown";
}
```

**Pros:** Eliminates duplicate entries. Captures correct broker address. Consistent with Java Kafka fix (056).
**Cons:** None for typical Kafka setup patterns.
**Effort:** Small
**Risk:** Low

### Option 2: Keep both patterns but skip `allQuoted[0]` when it equals `"bootstrap.servers"`

When infraType is "kafka" and `allQuoted[0] === "bootstrap.servers"`, use `allQuoted[1]` instead.

**Pros:** Minimal change. Still need to handle deduplication separately.
**Cons:** Doesn't eliminate the duplicate entry problem.
**Effort:** Trivial
**Risk:** Low

## Recommended Action

To be filled during triage.

## Technical Details

- **Affected files:** `packages/languages/rust/src/analyzer.ts:53-65, 195-211`
- Test at `analyzer.test.ts:150-153` uses `filter` with `>=1` — tolerates duplicates (should also be updated)

## Acceptance Criteria

- [ ] Only one Kafka entry emitted per Kafka client instantiation
- [ ] `connection_ref` contains the broker address (`localhost:9092`), not `"bootstrap.servers"`
- [ ] Test updated to verify `connection_ref` value and no duplicate entries

## Work Log

- 2026-02-26: Identified during PR #16 code review
