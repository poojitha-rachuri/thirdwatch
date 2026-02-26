---
status: complete
priority: p2
issue_id: "056"
tags: [code-review, java, quality, kafka]
dependencies: []
---

# Java Analyzer: Kafka `connection_ref` Is Always "unknown" — No Bootstrap Server Capture

## Problem Statement

`INFRA_PATTERNS` in `packages/languages/java/src/analyzer.ts` detects Kafka via `KafkaProducer<` and `KafkaConsumer<` patterns. However, the `connection_ref` extraction logic (`const connectionRef = allQuoted[0] ?? "unknown"`) finds the first quoted string on the line. For typical Kafka instantiation:

```java
KafkaProducer<String, String> producer = new KafkaProducer<>(props);
```

There are no quoted strings — the bootstrap server is configured in a `Properties` object on a different line. This means every Kafka entry in the TDM has `connection_ref: "unknown"`, making the entry less useful for monitoring.

## Findings

- **File:** `packages/languages/java/src/analyzer.ts:256-267`
- Kafka `connection_ref` extraction: `const allQuoted = [...line.matchAll(/["']([^"']+)["']/g)].map(m => m[1]!)`
- For `KafkaProducer<String, String> producer = new KafkaProducer<>(props)`, no quoted strings → `"unknown"`
- The bootstrap server IS on a nearby line: `props.put("bootstrap.servers", "localhost:9092")`
- Other infrastructure entries (Redis, MongoDB) have similar issues but at least may have connection strings on the same line
- This produces TDM entries like `{ kind: "infrastructure", type: "kafka", connection_ref: "unknown" }`

## Proposed Solutions

### Option 1: Scan previous N lines for `bootstrap.servers` property (Recommended for Phase 1)

**Approach:** When `KafkaProducer`/`KafkaConsumer` is detected on line `i`, scan lines `i-10` to `i+5` for a pattern like `"bootstrap.servers".*"([^"]+)"` to extract the broker address.

**Pros:** Captures the most common pattern (Properties object near instantiation).
**Cons:** Fragile — only works when bootstrap.servers is nearby. Spring Kafka configs (`@Value`, YAML) still missed.
**Effort:** Small
**Risk:** Low

### Option 2: Scan for `bootstrap.servers` as a standalone pattern anywhere in the file

**Approach:** Add a dedicated pattern to detect `bootstrap.servers` assignment anywhere in the file and correlate with Kafka detection.

**Pros:** Works regardless of proximity.
**Cons:** Could capture test config or commented-out code.
**Effort:** Small
**Risk:** Low

### Option 3: Accept "unknown" as intentional — document as a known limitation

**Approach:** Add a code comment explaining why Kafka connection_ref is often "unknown" for Java (Properties-based config). The TDM entry is still correct in kind/type.

**Pros:** Honest. No false accuracy. Simplest.
**Cons:** Reduces TDM utility for Kafka monitoring.
**Effort:** Trivial
**Risk:** None

## Recommended Action

To be filled during triage.

## Technical Details

- **Affected file:** `packages/languages/java/src/analyzer.ts:256-267`
- Spring Kafka: bootstrap servers are typically in `application.yml` (`spring.kafka.bootstrap-servers`) — completely out of scope for Java source analysis
- Lettuce (Redis client): `RedisClient.create("redis://localhost:6379")` — has connection string on same line ✓
- MongoDB: `MongoClients.create("mongodb://localhost:27017")` — has connection string on same line ✓
- Kafka is the outlier due to Properties-based config pattern

## Acceptance Criteria

- [ ] Kafka entries have a meaningful `connection_ref` (or "unknown" is explicitly documented as expected)
- [ ] If option 1/2 chosen: test added for `bootstrap.servers` capture from Properties

## Work Log

- 2026-02-25: Identified during PR #15 code review
