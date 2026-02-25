---
title: "feat: Go Language Analyzer"
type: feat
phase: 1 — The Map (expansion)
date: 2026-02-24
priority: P1
dependencies: Plan 3 (Scanner Core), Plan 4 (Detectors), Plan 16 (AST — optional)
package: packages/languages/go
---

# feat: Go Language Analyzer

## Overview

Build `@thirdwatch/language-go` — a language analyzer plugin that detects external dependencies in Go codebases. Go has a distinctive module system (`go.mod`), explicit import paths that double as package identifiers, and a standard library HTTP client (`net/http`) that most projects use directly. The analyzer covers manifest parsing, HTTP client detection, SDK usage, and infrastructure connections.

## Problem Statement

Go is the dominant language for cloud-native infrastructure, Kubernetes operators, CLI tools, and backend microservices. A large percentage of Thirdwatch's target audience writes Go. Without Go support, Thirdwatch cannot scan the exact codebases that have the highest density of external API dependencies — API gateways, webhook processors, and cloud infrastructure automation.

## Proposed Solution

A `@thirdwatch/language-go` package implementing the `LanguageAnalyzerPlugin` interface with:
1. `go.mod` and `go.sum` manifest parsing
2. HTTP client detection (`net/http`, `resty`, `go-retryablehttp`)
3. SDK detection (AWS SDK Go v2, Stripe Go, Google Cloud Go, OpenAI Go)
4. Infrastructure detection (`database/sql`, `pgx`, `go-redis`, `mongo-driver`)

## Technical Approach

### Plugin Entry Point

```typescript
// packages/languages/go/src/index.ts
import type { LanguageAnalyzerPlugin, AnalyzerContext, DependencyEntry } from "@thirdwatch/core";
import { analyzeGo } from "./analyzer.js";
import { parseManifests } from "./manifests.js";

export class GoPlugin implements LanguageAnalyzerPlugin {
  readonly name = "Go Analyzer";
  readonly language = "go";
  readonly extensions = [".go"];

  async analyze(context: AnalyzerContext): Promise<DependencyEntry[]> {
    return analyzeGo(context);
  }

  async analyzeManifests(
    manifestFiles: string[],
    scanRoot: string,
  ): Promise<DependencyEntry[]> {
    return parseManifests(manifestFiles, scanRoot);
  }
}
```

### Manifest Parsing — `go.mod`

Go modules use a custom format, not JSON/YAML/TOML:

```go
// Example go.mod
module github.com/acme/payments-service

go 1.22

require (
    github.com/stripe/stripe-go/v78 v78.1.0
    github.com/aws/aws-sdk-go-v2 v1.24.0
    github.com/aws/aws-sdk-go-v2/service/s3 v1.47.0
    github.com/redis/go-redis/v9 v9.4.0
    github.com/jackc/pgx/v5 v5.5.0
)

require (
    // indirect dependencies
    github.com/jmespath/go-jmespath v0.4.0 // indirect
)
```

```typescript
// packages/languages/go/src/manifests.ts

const REQUIRE_BLOCK_RE = /require\s*\(([\s\S]*?)\)/g;
const REQUIRE_SINGLE_RE = /require\s+([\w./-]+)\s+(v[\w.+-]+)/g;
const MODULE_LINE_RE = /^[\t ]*([^\s/][^\s]*)\s+(v[^\s]+)/;

export async function parseManifests(
  manifestFiles: string[],
  scanRoot: string,
): Promise<DependencyEntry[]> {
  const entries: DependencyEntry[] = [];

  for (const manifest of manifestFiles) {
    if (manifest.endsWith("go.mod")) {
      const content = await readFile(manifest, "utf-8");
      entries.push(...parseGoMod(content, relative(scanRoot, manifest)));
    }
  }

  return entries;
}

function parseGoMod(content: string, manifestFile: string): DependencyEntry[] {
  const entries: DependencyEntry[] = [];
  const lines = content.split("\n");
  let inRequireBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "require (") {
      inRequireBlock = true;
      continue;
    }
    if (trimmed === ")") {
      inRequireBlock = false;
      continue;
    }

    // Skip indirect dependencies
    if (trimmed.includes("// indirect")) continue;

    if (inRequireBlock) {
      const match = trimmed.match(/^([^\s]+)\s+(v[^\s]+)/);
      if (match) {
        entries.push(makeGoPackageEntry(match[1]!, match[2]!, manifestFile));
      }
    }

    // Single-line require
    const singleMatch = trimmed.match(/^require\s+([^\s]+)\s+(v[^\s]+)/);
    if (singleMatch) {
      entries.push(makeGoPackageEntry(singleMatch[1]!, singleMatch[2]!, manifestFile));
    }
  }

  return entries;
}

function makeGoPackageEntry(
  modulePath: string,
  version: string,
  manifestFile: string,
): DependencyEntry {
  return {
    kind: "package",
    name: modulePath,
    ecosystem: "go",
    current_version: version,
    version_constraint: version,
    manifest_file: manifestFile,
    locations: [],
    usage_count: 0,
    confidence: "high",
  };
}
```

### HTTP Client Detection

Go HTTP patterns to detect:

```go
// net/http standard library
resp, err := http.Get("https://api.stripe.com/v1/charges")
resp, err := http.Post("https://api.example.com/data", "application/json", body)
req, err := http.NewRequest("POST", "https://api.openai.com/v1/completions", body)
req, err := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
client.Do(req)

// resty
client := resty.New()
resp, err := client.R().Get("https://api.example.com/users")
resp, err := client.R().SetBody(payload).Post(url)

// go-retryablehttp
client := retryablehttp.NewClient()
resp, err := client.Get("https://api.example.com/health")
```

```typescript
// packages/languages/go/src/analyzer.ts — HTTP detection

const GO_HTTP_PATTERNS: [RegExp, string][] = [
  // http.Get("url"), http.Post("url", ...)
  [/http\.(Get|Post|Head|PostForm)\(\s*"([^"]+)"/, "CALL"],
  // http.NewRequest("METHOD", "url", ...)
  [/http\.NewRequest(?:WithContext)?\([^,]*,?\s*"(\w+)",\s*"([^"]+)"/, "NEW_REQUEST"],
  // resty: client.R().Get("url"), .Post("url")
  [/\.R\(\)\s*\.\s*(Get|Post|Put|Patch|Delete|Head)\(\s*"([^"]+)"/, "RESTY"],
  // retryablehttp: client.Get("url")
  [/retryablehttp\.\w+\.(Get|Post|Head)\(\s*"([^"]+)"/, "RETRYABLE"],
];

function detectHTTPCalls(line: string, lineNum: number, rel: string): DependencyEntry[] {
  const entries: DependencyEntry[] = [];

  for (const [pattern, kind] of GO_HTTP_PATTERNS) {
    const match = line.match(pattern);
    if (!match) continue;

    let method = "GET";
    let url = "unknown";

    if (kind === "NEW_REQUEST") {
      method = match[1]?.toUpperCase() ?? "GET";
      url = match[2] ?? "unknown";
    } else {
      method = match[1]?.toUpperCase() ?? "GET";
      url = match[2] ?? "unknown";
      if (method === "POSTFORM") method = "POST";
    }

    entries.push({
      kind: "api",
      url,
      method: method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD",
      locations: [{ file: rel, line: lineNum, context: line.trim() }],
      usage_count: 1,
      confidence: /^https?:\/\//.test(url) ? "high" : "medium",
    });
  }

  return entries;
}
```

### SDK Detection

Go SDK patterns to detect:

```go
// AWS SDK v2
cfg, err := config.LoadDefaultConfig(ctx)
s3Client := s3.NewFromConfig(cfg)
sqsClient := sqs.NewFromConfig(cfg)
dynamoClient := dynamodb.NewFromConfig(cfg)
s3Client.PutObject(ctx, &s3.PutObjectInput{...})

// Stripe
stripe.Key = os.Getenv("STRIPE_SECRET_KEY")
params := &stripe.ChargeParams{Amount: stripe.Int64(2000)}
ch, err := charge.New(params)

// OpenAI
client := openai.NewClient(os.Getenv("OPENAI_API_KEY"))
resp, err := client.CreateChatCompletion(ctx, openai.ChatCompletionRequest{...})

// Google Cloud
client, err := storage.NewClient(ctx)
client, err := pubsub.NewClient(ctx, projectID)
```

```typescript
// packages/languages/go/src/analyzer.ts — SDK detection

const GO_SDK_PROVIDERS: Record<string, [string, string]> = {
  // import path prefix → [provider, sdk_package]
  "github.com/stripe/stripe-go": ["stripe", "stripe-go"],
  "github.com/aws/aws-sdk-go-v2": ["aws", "aws-sdk-go-v2"],
  "github.com/aws/aws-sdk-go": ["aws", "aws-sdk-go"],
  "github.com/sashabaranov/go-openai": ["openai", "go-openai"],
  "cloud.google.com/go": ["gcp", "google-cloud-go"],
  "github.com/twilio/twilio-go": ["twilio", "twilio-go"],
  "github.com/sendgrid/sendgrid-go": ["sendgrid", "sendgrid-go"],
  "github.com/slack-go/slack": ["slack", "slack-go"],
  "github.com/anthropics/anthropic-sdk-go": ["anthropic", "anthropic-sdk-go"],
};

// Constructor/factory patterns per SDK
const GO_SDK_CONSTRUCTORS: [RegExp, string, string][] = [
  // AWS: s3.NewFromConfig(cfg)
  [/(\w+)\.NewFromConfig\(/, "aws", "aws-sdk-go-v2"],
  // Stripe: charge.New(params), customer.New(params)
  [/(?:charge|customer|paymentintent|subscription|invoice)\.New\(/, "stripe", "stripe-go"],
  // OpenAI: openai.NewClient(...)
  [/openai\.NewClient\(/, "openai", "go-openai"],
  // GCP: storage.NewClient(ctx), pubsub.NewClient(ctx, ...)
  [/(storage|pubsub|bigquery|firestore|spanner)\.NewClient\(/, "gcp", "google-cloud-go"],
];
```

### Infrastructure Detection

```go
// database/sql + pgx
db, err := sql.Open("postgres", "postgresql://user:pass@host:5432/db")
conn, err := pgx.Connect(ctx, os.Getenv("DATABASE_URL"))
pool, err := pgxpool.New(ctx, connString)

// go-redis
rdb := redis.NewClient(&redis.Options{Addr: "localhost:6379"})
rdb := redis.NewClusterClient(&redis.ClusterOptions{...})

// MongoDB
client, err := mongo.Connect(ctx, options.Client().ApplyURI("mongodb://..."))

// RabbitMQ
conn, err := amqp.Dial("amqp://guest:guest@localhost:5672/")

// Kafka
writer := kafka.NewWriter(kafka.WriterConfig{Brokers: []string{"localhost:9092"}})
```

```typescript
const GO_INFRA_PATTERNS: [RegExp, string][] = [
  [/sql\.Open\(\s*"(postgres|pgx|mysql|sqlite3)"/, "match_group"],
  [/pgx\.Connect\(/, "postgresql"],
  [/pgxpool\.New\(/, "postgresql"],
  [/redis\.NewClient\(/, "redis"],
  [/redis\.NewClusterClient\(/, "redis"],
  [/mongo\.Connect\(/, "mongodb"],
  [/amqp\.Dial\(/, "rabbitmq"],
  [/kafka\.NewWriter\(/, "kafka"],
  [/kafka\.NewReader\(/, "kafka"],
  [/elasticsearch\.NewClient\(/, "elasticsearch"],
];
```

### Import Detection

Go imports identify which packages are used, enabling SDK provider mapping:

```typescript
function detectImports(source: string): Map<string, string> {
  const imports = new Map<string, string>(); // alias → full path

  // Single import: import "github.com/stripe/stripe-go/v78"
  const singleRe = /import\s+"([^"]+)"/g;
  for (const m of source.matchAll(singleRe)) {
    const fullPath = m[1]!;
    const alias = fullPath.split("/").pop()!;
    imports.set(alias, fullPath);
  }

  // Block import: import ( ... )
  const blockRe = /import\s*\(([\s\S]*?)\)/g;
  for (const block of source.matchAll(blockRe)) {
    const lines = block[1]!.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("//")) continue;
      // Named import: s3 "github.com/aws/aws-sdk-go-v2/service/s3"
      const named = trimmed.match(/^(\w+)\s+"([^"]+)"/);
      if (named) {
        imports.set(named[1]!, named[2]!);
        continue;
      }
      // Unnamed import: "github.com/stripe/stripe-go/v78"
      const unnamed = trimmed.match(/^"([^"]+)"/);
      if (unnamed) {
        const fullPath = unnamed[1]!;
        const alias = fullPath.split("/").pop()!;
        imports.set(alias, fullPath);
      }
    }
  }

  return imports;
}
```

### Registry Additions

New YAML files needed in `registries/sdks/`:

```yaml
# registries/sdks/aws.yml — add Go patterns
patterns:
  go:
    - package: "github.com/aws/aws-sdk-go-v2"
      import_patterns: ["aws-sdk-go-v2"]
    - package: "github.com/aws/aws-sdk-go-v2/service/s3"
    - package: "github.com/aws/aws-sdk-go-v2/service/sqs"
    - package: "github.com/aws/aws-sdk-go-v2/service/dynamodb"

# registries/sdks/stripe.yml — add Go patterns
patterns:
  go:
    - package: "github.com/stripe/stripe-go"
      import_patterns: ["stripe"]
```

## Implementation Phases

### Phase 12.1: Package Scaffold + Manifests
- Initialize `packages/languages/go` with package.json, tsconfig.json
- Implement `go.mod` parser (direct and indirect dependencies)
- Unit tests with fixture go.mod files
- Register `.go` extension in scanner core's manifest patterns

### Phase 12.2: Import Detection
- Implement Go import block parser (single and multi-line)
- Build import path → SDK provider mapping using registry
- Test with fixtures containing aliased imports, dot imports, blank imports

### Phase 12.3: HTTP Client Detection
- Implement `net/http` detection (Get, Post, NewRequest, NewRequestWithContext)
- Implement `resty` and `go-retryablehttp` patterns
- Variable URL detection (when URL is stored in a variable on a nearby line)
- Test against `fixtures/go-app/` HTTP patterns

### Phase 12.4: SDK + Infrastructure Detection
- Implement SDK constructor detection (NewFromConfig, NewClient, etc.)
- Implement infrastructure detection (sql.Open, pgx, go-redis, mongo, amqp)
- Connection string pattern matching
- Test: fixtures should produce entries for aws, stripe, postgresql, redis

### Phase 12.5: Integration + Registry
- Add Go patterns to all existing SDK registry YAML files
- Integration test: scan `fixtures/go-app/` → validate full TDM output
- Validate TDM against JSON Schema
- Benchmark: scan should complete in <5s for a 10K LOC Go project

## Acceptance Criteria

- [ ] `go.mod` direct dependencies are parsed with correct ecosystem `go` and module paths
- [ ] `go.mod` indirect dependencies are excluded by default
- [ ] `http.Get("https://api.stripe.com/v1/charges")` produces an API entry with method GET
- [ ] `http.NewRequest("POST", url, body)` produces an API entry with method POST
- [ ] `s3.NewFromConfig(cfg)` produces an SDK entry with provider `aws`, services_used `["s3"]`
- [ ] `sql.Open("postgres", connStr)` produces an infrastructure entry with type `postgresql`
- [ ] `redis.NewClient(...)` produces an infrastructure entry with type `redis`
- [ ] Import aliasing (`s3 "github.com/aws/..."`) is handled correctly
- [ ] Registry YAML files have `go:` patterns for all 14 existing providers
- [ ] Scan of `fixtures/go-app/` produces ≥5 distinct dependency entries across all kinds

## File Inventory

| File | Description |
|---|---|
| `packages/languages/go/package.json` | Package manifest |
| `packages/languages/go/tsconfig.json` | TypeScript config |
| `packages/languages/go/src/index.ts` | GoPlugin export |
| `packages/languages/go/src/analyzer.ts` | Source code analyzer (HTTP, SDK, infra) |
| `packages/languages/go/src/manifests.ts` | go.mod parser |
| `packages/languages/go/src/imports.ts` | Go import block parser |
| `packages/languages/go/src/__tests__/analyzer.test.ts` | Analyzer unit tests |
| `packages/languages/go/src/__tests__/manifests.test.ts` | Manifest parser tests |
| `fixtures/go-app/` | Go fixture project for integration tests |

## References

- [Go Modules Reference](https://go.dev/ref/mod)
- [go.mod file reference](https://go.dev/doc/modules/gomod-ref)
- [AWS SDK for Go v2](https://github.com/aws/aws-sdk-go-v2)
- [Stripe Go](https://github.com/stripe/stripe-go)
- [go-openai](https://github.com/sashabaranov/go-openai)
- PRD FR-1.2 (language support expansion)
