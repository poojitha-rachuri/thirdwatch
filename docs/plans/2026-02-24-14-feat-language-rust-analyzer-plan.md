---
title: "feat: Rust Language Analyzer"
type: feat
phase: 1 — The Map (expansion)
date: 2026-02-24
priority: P2
dependencies: Plan 3 (Scanner Core), Plan 4 (Detectors)
package: packages/languages/rust
---

# feat: Rust Language Analyzer

## Overview

Build `@thirdwatch/language-rust` — a language analyzer plugin for Rust codebases. Rust is the fastest-growing systems language, used extensively for CLI tools, WebAssembly, cloud infrastructure (AWS Lambda, Cloudflare Workers), and high-performance backends. Rust's `Cargo.toml` manifest is clean TOML, and its import system (`use` statements) is explicit and well-structured, making it one of the more straightforward languages to analyze.

## Problem Statement

Rust is the language of choice for new infrastructure tooling, and Rust developers are exactly the kind of engineers who care about dependency surface area. Rust's crate ecosystem (crates.io) is growing rapidly, and Rust projects frequently interface with databases, message queues, and external APIs. Without Rust support, Thirdwatch misses a growing and highly engaged developer community.

## Proposed Solution

A `@thirdwatch/language-rust` package implementing `LanguageAnalyzerPlugin` with:
1. `Cargo.toml` and `Cargo.lock` manifest parsing (TOML)
2. HTTP client detection (`reqwest`, `hyper`, `ureq`, `surf`)
3. SDK detection (`aws-sdk-*`, `stripe-rust`, `async-openai`)
4. Infrastructure detection (`sqlx`, `diesel`, `tokio-postgres`, `redis-rs`, `mongodb`, `rdkafka`)

## Technical Approach

### Plugin Entry Point

```typescript
// packages/languages/rust/src/index.ts
import type { LanguageAnalyzerPlugin, AnalyzerContext, DependencyEntry } from "@thirdwatch/core";
import { analyzeRust } from "./analyzer.js";
import { parseManifests } from "./manifests.js";

export class RustPlugin implements LanguageAnalyzerPlugin {
  readonly name = "Rust Analyzer";
  readonly language = "rust";
  readonly extensions = [".rs"];

  async analyze(context: AnalyzerContext): Promise<DependencyEntry[]> {
    return analyzeRust(context);
  }

  async analyzeManifests(
    manifestFiles: string[],
    scanRoot: string,
  ): Promise<DependencyEntry[]> {
    return parseManifests(manifestFiles, scanRoot);
  }
}
```

### Manifest Parsing — `Cargo.toml`

Cargo.toml is straightforward TOML with `[dependencies]`, `[dev-dependencies]`, and `[build-dependencies]` sections. Dependencies can be simple strings or inline tables.

```toml
# Example Cargo.toml
[package]
name = "payments-service"
version = "0.1.0"
edition = "2021"

[dependencies]
reqwest = { version = "0.11", features = ["json"] }
tokio = { version = "1", features = ["full"] }
sqlx = { version = "0.7", features = ["runtime-tokio", "postgres"] }
redis = "0.24"
serde = { version = "1.0", features = ["derive"] }
aws-sdk-s3 = "1.10"
stripe-rust = "0.26"
async-openai = "0.18"

[dev-dependencies]
tokio-test = "0.4"
```

```typescript
// packages/languages/rust/src/manifests.ts
import { parse as parseTOML } from "smol-toml";

export async function parseManifests(
  manifestFiles: string[],
  scanRoot: string,
): Promise<DependencyEntry[]> {
  const entries: DependencyEntry[] = [];

  for (const manifest of manifestFiles) {
    if (manifest.endsWith("Cargo.toml")) {
      const content = await readFile(manifest, "utf-8");
      entries.push(...parseCargoToml(content, relative(scanRoot, manifest)));
    }
  }

  return entries;
}

function parseCargoToml(content: string, manifestFile: string): DependencyEntry[] {
  const entries: DependencyEntry[] = [];
  let cargo: Record<string, unknown>;

  try {
    cargo = parseTOML(content) as Record<string, unknown>;
  } catch {
    return [];
  }

  for (const section of ["dependencies", "dev-dependencies", "build-dependencies"]) {
    const deps = cargo[section] as Record<string, unknown> | undefined;
    if (!deps) continue;

    for (const [name, value] of Object.entries(deps)) {
      let version = "unknown";

      if (typeof value === "string") {
        version = value;
      } else if (typeof value === "object" && value !== null) {
        const obj = value as Record<string, unknown>;
        if (typeof obj.version === "string") version = obj.version;
      }

      entries.push({
        kind: "package",
        name,
        ecosystem: "cargo",
        current_version: version,
        version_constraint: version,
        manifest_file: manifestFile,
        locations: [],
        usage_count: 0,
        confidence: "high",
      });
    }
  }

  return entries;
}
```

### HTTP Client Detection

Rust HTTP patterns to detect:

```rust
// reqwest (most popular)
let resp = reqwest::get("https://api.stripe.com/v1/charges").await?;
let resp = client.get("https://api.openai.com/v1/completions")
    .header("Authorization", format!("Bearer {}", api_key))
    .json(&body)
    .send().await?;
let resp = client.post("https://api.example.com/data")
    .body(payload)
    .send().await?;

// ureq (blocking)
let resp = ureq::get("https://api.example.com/users").call()?;
let resp = ureq::post("https://api.example.com/orders")
    .send_json(json)?;

// hyper (low-level)
let req = Request::builder()
    .method(Method::POST)
    .uri("https://api.example.com/webhook")
    .body(Body::from(payload))?;
```

```typescript
// packages/languages/rust/src/analyzer.ts — HTTP detection

const RUST_HTTP_PATTERNS: [RegExp, string][] = [
  // reqwest::get("url")
  [/reqwest::get\(\s*"([^"]+)"/, "GET"],
  // client.get("url"), client.post("url"), etc.
  [/client\.(get|post|put|patch|delete|head)\(\s*"([^"]+)"/, "CLIENT_METHOD"],
  // ureq::get("url"), ureq::post("url")
  [/ureq::(get|post|put|patch|delete)\(\s*"([^"]+)"/, "UREQ"],
  // Request::builder().method(Method::POST).uri("url")
  [/\.uri\(\s*"([^"]+)"/, "BUILDER"],
  // Method::POST, Method::GET (capture method from nearby)
  [/Method::(GET|POST|PUT|PATCH|DELETE|HEAD)/, "METHOD_ENUM"],
];
```

### SDK Detection

```rust
// AWS SDK for Rust
let config = aws_config::load_defaults(BehaviorVersion::latest()).await;
let s3_client = aws_sdk_s3::Client::new(&config);
let sqs_client = aws_sdk_sqs::Client::new(&config);

// stripe-rust
let client = stripe::Client::new(stripe_key);
let charge = stripe::Charge::create(&client, params).await?;

// async-openai
let client = async_openai::Client::new();
let response = client.chat().create(request).await?;
```

```typescript
const RUST_SDK_PATTERNS: [RegExp, string, string][] = [
  // AWS: aws_sdk_s3::Client::new, aws_sdk_sqs::Client::new
  [/aws_sdk_(\w+)::Client::new\(/, "aws", "aws-sdk-rust"],
  // aws_config::load_defaults
  [/aws_config::load_defaults\(/, "aws", "aws-sdk-rust"],
  // stripe::Client::new, stripe::Charge::create
  [/stripe::(Client::new|Charge|PaymentIntent|Customer|Subscription)/, "stripe", "stripe-rust"],
  // async_openai::Client::new
  [/async_openai::Client::new\(/, "openai", "async-openai"],
];
```

### Infrastructure Detection

```rust
// sqlx (PostgreSQL, MySQL, SQLite)
let pool = PgPool::connect("postgresql://user:pass@host/db").await?;
let pool = MySqlPool::connect("mysql://user:pass@host/db").await?;
let pool = sqlx::postgres::PgPoolOptions::new().connect(&database_url).await?;

// diesel
let conn = PgConnection::establish("postgresql://user:pass@host/db")?;

// redis-rs
let client = redis::Client::open("redis://127.0.0.1/")?;
let mut con = client.get_connection()?;

// mongodb
let client = mongodb::Client::with_uri_str("mongodb://localhost:27017").await?;

// rdkafka
let producer: FutureProducer = ClientConfig::new()
    .set("bootstrap.servers", "localhost:9092")
    .create()?;

// lapin (RabbitMQ)
let conn = Connection::connect("amqp://guest:guest@localhost:5672", ...).await?;
```

```typescript
const RUST_INFRA_PATTERNS: [RegExp, string][] = [
  [/PgPool::connect\(/, "postgresql"],
  [/PgConnection::establish\(/, "postgresql"],
  [/MySqlPool::connect\(/, "mysql"],
  [/redis::Client::open\(/, "redis"],
  [/mongodb::Client::with_uri_str\(/, "mongodb"],
  [/bootstrap\.servers/, "kafka"],
  [/FutureProducer/, "kafka"],
  [/StreamConsumer/, "kafka"],
  [/Connection::connect\(\s*"amqp:\/\//, "rabbitmq"],
];
```

### Use Statement Detection

```typescript
function detectUseStatements(source: string): Map<string, string> {
  const imports = new Map<string, string>();

  // use aws_sdk_s3::Client;
  const useRe = /use\s+([\w:]+(?:::\w+)*)\s*;/g;
  for (const m of source.matchAll(useRe)) {
    const fullPath = m[1]!;
    const parts = fullPath.split("::");
    const alias = parts[parts.length - 1]!;
    imports.set(alias, fullPath);
  }

  // use aws_sdk_s3::Client as S3Client;
  const aliasRe = /use\s+([\w:]+)\s+as\s+(\w+)\s*;/g;
  for (const m of source.matchAll(aliasRe)) {
    imports.set(m[2]!, m[1]!);
  }

  return imports;
}
```

## Implementation Phases

### Phase 14.1: Package Scaffold + Cargo.toml Parsing
- Initialize `packages/languages/rust` with package.json, tsconfig.json
- Add `smol-toml` dependency for TOML parsing
- Implement `Cargo.toml` parser (dependencies, dev-dependencies, build-dependencies)
- Handle inline table format (`{ version = "1.0", features = [...] }`)
- Unit tests with fixture Cargo.toml files

### Phase 14.2: Use Statement + HTTP Detection
- Implement `use` statement parser
- Implement reqwest, ureq, hyper HTTP detection patterns
- Variable URL detection
- Test against `fixtures/rust-app/`

### Phase 14.3: SDK Detection
- Implement AWS SDK for Rust detection (`aws_sdk_*::Client::new`)
- Implement stripe-rust, async-openai patterns
- Map via use statements and registry

### Phase 14.4: Infrastructure Detection
- Implement sqlx, diesel (PostgreSQL, MySQL), redis-rs, mongodb, rdkafka, lapin patterns
- Connection string pattern matching
- Test: fixtures should produce entries for postgresql, redis, kafka

### Phase 14.5: Integration + Registry
- Add Rust (`cargo:`) patterns to registry YAML files
- Integration test: full TDM validation
- Benchmark scan performance

## Acceptance Criteria

- [ ] `Cargo.toml` dependencies parsed with correct ecosystem `cargo`
- [ ] Inline table dependencies (`{ version = "1.0", features = [...] }`) parsed correctly
- [ ] `reqwest::get("https://...")` produces an API entry with method GET
- [ ] `client.post("https://...")` produces an API entry with method POST
- [ ] `aws_sdk_s3::Client::new(&config)` produces SDK entry with provider `aws`
- [ ] `PgPool::connect(url)` produces infrastructure entry with type `postgresql`
- [ ] `redis::Client::open("redis://...")` produces infrastructure entry with type `redis`
- [ ] `use aws_sdk_s3::Client as S3;` aliasing handled correctly
- [ ] Registry YAML files have `cargo:` patterns for all applicable providers

## File Inventory

| File | Description |
|---|---|
| `packages/languages/rust/package.json` | Package manifest (depends on smol-toml) |
| `packages/languages/rust/tsconfig.json` | TypeScript config |
| `packages/languages/rust/src/index.ts` | RustPlugin export |
| `packages/languages/rust/src/analyzer.ts` | Source code analyzer |
| `packages/languages/rust/src/manifests.ts` | Cargo.toml parser |
| `packages/languages/rust/src/__tests__/analyzer.test.ts` | Analyzer unit tests |
| `packages/languages/rust/src/__tests__/manifests.test.ts` | Manifest parser tests |
| `fixtures/rust-app/` | Rust fixture project |

## References

- [Cargo.toml format](https://doc.rust-lang.org/cargo/reference/manifest.html)
- [reqwest](https://docs.rs/reqwest)
- [AWS SDK for Rust](https://github.com/awslabs/aws-sdk-rust)
- [sqlx](https://github.com/launchbadge/sqlx)
- [smol-toml](https://github.com/nicolo-ribaudo/smol-toml)
