---
title: "feat: Scanner Dependency Detectors — Language Analyzers & Registry"
type: feat
phase: 1 — The Map
date: 2026-02-21
priority: P0
dependencies: Plan 3 (Scanner Core)
packages: packages/languages/python, packages/languages/javascript, registries/
---

# feat: Scanner Dependency Detectors — Language Analyzers & Registry

## Overview

Implement the two Phase 1 language analyzer plugins (`@thirdwatch/language-python` and `@thirdwatch/language-javascript`) plus the community-extensible YAML registries. These plugins use tree-sitter to traverse ASTs and detect: outbound HTTP API calls, SDK client instantiations, package dependencies, infrastructure connection strings, and webhook registrations. This is the highest-value, most technically interesting part of Phase 1.

## Problem Statement

A scanner without detectors produces empty manifests. The quality of Thirdwatch's output — and its credibility at launch — depends entirely on how accurately the detectors find real external dependencies in real codebases. The detectors must be precise enough to be trustworthy and broad enough to cover the common patterns developers actually write.

## Proposed Solution

Each language package implements the `LanguageAnalyzerPlugin` interface from `@thirdwatch/core`. Detection is done via tree-sitter S-expression queries. The SDK and changelog registries are YAML files loaded at runtime, making them community-extensible without code changes.

---

## Python Analyzer (`packages/languages/python`)

### Approach

Use `tree-sitter-python` grammar. Write S-expression queries for each detection type.

### Package Manifest Detection (`analyzeManifests`)

Parse `requirements.txt`, `Pipfile`, `pyproject.toml`, `setup.py`, `poetry.lock` to extract package name + version.

```typescript
// packages/languages/python/src/manifests.ts (sketch)
export function parseRequirementsTxt(content: string): TDMPackage[] {
  return content
    .split("\n")
    .filter(line => line && !line.startsWith("#") && !line.startsWith("-"))
    .map(line => {
      const match = line.match(/^([A-Za-z0-9_\-\.]+)([>=<!^~].+)?/);
      if (!match) return null;
      return {
        kind: "package" as const,
        name: match[1].toLowerCase(),
        ecosystem: "pypi",
        current_version: resolveVersion(match[2]),
        version_constraint: match[2]?.trim() ?? undefined,
        manifest_file: "requirements.txt",
        locations: [],
        usage_count: 0,
        confidence: "high",
      };
    })
    .filter(Boolean);
}
```

### HTTP Client Detection (tree-sitter query)

Target libraries: `requests`, `httpx`, `urllib`, `aiohttp`, `http.client`

```scheme
; packages/languages/python/queries/http-calls.scm
; Matches: requests.get("https://..."), requests.post(url), httpx.get(...)

(call
  function: (attribute
    object: (identifier) @client
    attribute: (identifier) @method)
  arguments: (argument_list
    (string) @url)
  (#match? @client "^(requests|httpx|session|client)$")
  (#match? @method "^(get|post|put|patch|delete|head|options|request)$"))
```

```scheme
; Also match: requests.request("GET", url)
(call
  function: (attribute
    object: (identifier) @client
    attribute: (identifier) @method)
  arguments: (argument_list
    (string) @verb
    [(string)(identifier)(concatenated_string)] @url)
  (#eq? @method "request"))
```

### SDK Detection (tree-sitter query)

Target: `boto3`, `stripe`, `openai`, `twilio`, `firebase_admin`, etc.

```scheme
; packages/languages/python/queries/sdk-instantiation.scm
; Matches: client = boto3.client("s3"), openai.ChatCompletion.create(...)

(call
  function: (attribute
    object: (identifier) @sdk_module)
  (#match? @sdk_module "^(boto3|stripe|openai|twilio|firebase_admin|sendgrid|datadog|sentry_sdk)$"))
```

Registry-driven: the query captures the module name, and the YAML registry maps `boto3` → `provider: "aws"`.

### Infrastructure Detection (tree-sitter query)

```scheme
; packages/languages/python/queries/infrastructure.scm
; Matches: psycopg2.connect("postgresql://..."), redis.Redis(host="cache.internal")

(call
  function: [(attribute)(identifier)] @func
  arguments: (argument_list) @args
  (#match? @func "(connect|Redis|MongoClient|create_engine|Elasticsearch)"))
```

Also scan string literals matching known connection string patterns:
- `postgresql://`, `postgres://`, `mysql://`, `mongodb://`, `redis://`, `amqp://`

---

## JavaScript/TypeScript Analyzer (`packages/languages/javascript`)

### Approach

Use `tree-sitter-javascript` and `tree-sitter-typescript` grammars. The same queries work for both since TS is a superset.

### Package Manifest Detection (`analyzeManifests`)

Parse `package.json` (dependencies + devDependencies + peerDependencies):

```typescript
// packages/languages/javascript/src/manifests.ts (sketch)
export function parsePackageJson(content: string, filePath: string): TDMPackage[] {
  const pkg = JSON.parse(content);
  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.peerDependencies,
  };
  return Object.entries(allDeps).map(([name, version]) => ({
    kind: "package",
    name,
    ecosystem: "npm",
    current_version: resolveVersionFromConstraint(version as string),
    version_constraint: version as string,
    manifest_file: relative(scanRoot, filePath),
    locations: [],
    usage_count: 0,
    confidence: "high",
  }));
}
```

### HTTP Client Detection (tree-sitter query)

Target: `fetch`, `axios`, `got`, `node-fetch`, `superagent`, `ky`, `undici`

```scheme
; packages/languages/javascript/queries/http-calls.scm
; Matches: fetch("https://api.example.com/v1/users")

(call_expression
  function: (identifier) @func
  arguments: (arguments
    (string) @url)
  (#match? @func "^fetch$"))

; Matches: axios.get("/v1/users"), axios.post(url)
(call_expression
  function: (member_expression
    object: (identifier) @client
    property: (property_identifier) @method)
  arguments: (arguments
    [(string)(template_string)(identifier)] @url)
  (#match? @client "^(axios|got|ky|superagent)$")
  (#match? @method "^(get|post|put|patch|delete|head|request)$"))

; Matches: new XMLHttpRequest()
(new_expression
  constructor: (identifier) @ctor
  (#eq? @ctor "XMLHttpRequest"))
```

### Template Literal URL Detection

```scheme
; Matches: fetch(`${BASE_URL}/v2/orders`)
(call_expression
  function: (identifier) @func
  arguments: (arguments
    (template_string) @url)
  (#eq? @func "fetch"))
```

### SDK Detection

```scheme
; Matches: new Stripe(key), new OpenAI({...}), new S3Client({...})
(new_expression
  constructor: [(identifier)(member_expression)] @ctor
  (#match? @ctor "^(Stripe|OpenAI|S3Client|DynamoDBClient|SQSClient|SNSClient|Twilio|Resend|SendGrid|Sentry|Datadog)$"))

; Matches: createClient(), initializeApp()
(call_expression
  function: (identifier) @func
  (#match? @func "^(createClient|initializeApp|createServer)$"))
```

### Environment Variable Tracing

```scheme
; Captures: const BASE_URL = process.env.STRIPE_API_BASE ?? "https://api.stripe.com"
(variable_declarator
  name: (identifier) @var_name
  value: [(member_expression)(binary_expression)(logical_expression)] @value
  (#match? @value "process\\.env\\."))
```

---

## SDK & Changelog Registries

### Registry Format (`registries/sdks/stripe.yml`)

```yaml
# registries/sdks/stripe.yml
provider: stripe
display_name: "Stripe"
homepage: "https://stripe.com"
changelog_url: "https://stripe.com/docs/changelog"
patterns:
  npm:
    - package: "stripe"
      import_patterns:
        - "Stripe"
        - "new Stripe"
    - package: "@stripe/stripe-js"
  pypi:
    - package: "stripe"
      import_patterns:
        - "import stripe"
        - "from stripe"
  go:
    - package: "github.com/stripe/stripe-go"
known_api_base_urls:
  - "https://api.stripe.com"
  - "https://files.stripe.com"
env_var_patterns:
  - "STRIPE_API_KEY"
  - "STRIPE_SECRET_KEY"
  - "STRIPE_PUBLISHABLE_KEY"
```

### Registry Loader (`packages/core/src/registry.ts`)

```typescript
// packages/core/src/registry.ts
import { glob } from "fast-glob";
import { readFile } from "node:fs/promises";
import yaml from "js-yaml";

export interface SDKRegistryEntry {
  provider: string;
  display_name: string;
  changelog_url?: string;
  patterns: {
    npm?: { package: string; import_patterns?: string[] }[];
    pypi?: { package: string; import_patterns?: string[] }[];
  };
  known_api_base_urls?: string[];
  env_var_patterns?: string[];
}

export async function loadSDKRegistry(registriesDir: string): Promise<SDKRegistryEntry[]> {
  const files = await glob("sdks/*.yml", { cwd: registriesDir, absolute: true });
  const entries = await Promise.all(
    files.map(async f => yaml.load(await readFile(f, "utf8")) as SDKRegistryEntry)
  );
  return entries;
}
```

### Initial Registry Contents (Phase 1)

Top 15 SDKs to ship at launch:

| Provider | npm package | PyPI package |
|---|---|---|
| AWS | `@aws-sdk/*` | `boto3` |
| Stripe | `stripe` | `stripe` |
| OpenAI | `openai` | `openai` |
| Twilio | `twilio` | `twilio` |
| Firebase | `firebase-admin` | `firebase-admin` |
| SendGrid | `@sendgrid/mail` | `sendgrid` |
| Datadog | `dd-trace` | `datadog` |
| Sentry | `@sentry/node` | `sentry-sdk` |
| Slack | `@slack/web-api` | `slack-sdk` |
| Google Cloud | `@google-cloud/*` | `google-cloud-*` |
| Supabase | `@supabase/supabase-js` | `supabase` |
| Resend | `resend` | `resend` |
| Anthropic | `@anthropic-ai/sdk` | `anthropic` |
| Pinecone | `@pinecone-database/pinecone` | `pinecone` |
| Cloudflare | `cloudflare` | `cloudflare` |

---

## Confidence Scoring Logic

```typescript
// packages/core/src/confidence.ts

export function scoreConfidence(
  url: string,
  detectionMethod: "literal" | "template" | "variable" | "heuristic"
): Confidence {
  if (detectionMethod === "literal" && isAbsoluteUrl(url)) return "high";
  if (detectionMethod === "template" && hasResolvedBase(url)) return "medium";
  if (detectionMethod === "variable") return "medium";
  return "low";
}
```

---

## Implementation Phases

### Phase 4.1: Python Analyzer Foundation
- Initialize `packages/languages/python` package
- Install `tree-sitter` + `tree-sitter-python`
- Implement `analyzeManifests` for requirements.txt and pyproject.toml
- Unit test against `fixtures/python-app/`

### Phase 4.2: Python HTTP + SDK Detection
- Implement tree-sitter queries for HTTP clients
- Implement SDK detection using registry lookup
- Implement infrastructure connection string detection
- Test: `fixtures/python-app/` should produce entries for stripe, boto3, redis

### Phase 4.3: JavaScript Analyzer Foundation
- Initialize `packages/languages/javascript` package
- Install `tree-sitter-javascript` + `tree-sitter-typescript`
- Implement `analyzeManifests` for package.json
- Unit test against `fixtures/node-app/`

### Phase 4.4: JavaScript HTTP + SDK Detection
- Implement tree-sitter queries for fetch, axios, got
- Implement template literal URL tracing
- Implement env var variable tracing
- Test: `fixtures/node-app/` should produce OpenAI, pg, and fetch call entries

### Phase 4.5: Registries
- Create YAML files for top 15 SDKs in `registries/sdks/`
- Create `registries/sdks/README.md` explaining the format
- Wire registry loading into the analyzer plugins

### Phase 4.6: Integration Test
- Scan `fixtures/mixed-monorepo/` (has both Python and JS files)
- Verify TDM output contains correct entries from both languages
- Validate output against TDM JSON Schema

## Acceptance Criteria

### Python Analyzer
- [ ] Detects `import stripe` and `stripe.Charge.create()` in `fixtures/python-app/stripe_client.py`
- [ ] Detects `requests.get("https://api.openai.com/...")` and extracts URL + method
- [ ] Detects `boto3.client("s3")` and records provider as `aws`, services_used as `["s3"]`
- [ ] Detects `redis.Redis(host="cache.internal:6379")` as an infrastructure entry
- [ ] `requirements.txt` packages are parsed with correct ecosystem `pypi`

### JavaScript Analyzer
- [ ] Detects `new Stripe(key)` and records provider as `stripe`
- [ ] Detects `fetch("https://api.openai.com/v1/completions")` with method `GET`
- [ ] Detects `axios.post(url, data)` even when `url` is a variable
- [ ] Detects `new Client({ connectionString: process.env.DATABASE_URL })` as infrastructure
- [ ] `package.json` dependencies are parsed with correct ecosystem `npm`

### Registry
- [ ] All 15 initial SDK YAML files exist and are valid YAML
- [ ] `registries/sdks/README.md` explains how to add a new SDK
- [ ] Adding a new YAML file to `registries/sdks/` is picked up without code changes

## File Inventory

| File | Description |
|---|---|
| `packages/languages/python/src/index.ts` | Plugin export |
| `packages/languages/python/src/analyzer.ts` | Main analyzer class |
| `packages/languages/python/src/manifests.ts` | requirements.txt, pyproject.toml parser |
| `packages/languages/python/src/queries/http-calls.scm` | tree-sitter HTTP query |
| `packages/languages/python/src/queries/sdk-instantiation.scm` | tree-sitter SDK query |
| `packages/languages/python/src/queries/infrastructure.scm` | tree-sitter infra query |
| `packages/languages/python/src/__tests__/analyzer.test.ts` | Unit tests |
| `packages/languages/javascript/src/index.ts` | Plugin export |
| `packages/languages/javascript/src/analyzer.ts` | Main analyzer class |
| `packages/languages/javascript/src/manifests.ts` | package.json parser |
| `packages/languages/javascript/src/queries/http-calls.scm` | tree-sitter HTTP query |
| `packages/languages/javascript/src/queries/sdk-instantiation.scm` | tree-sitter SDK query |
| `packages/languages/javascript/src/__tests__/analyzer.test.ts` | Unit tests |
| `registries/sdks/aws.yml` | AWS SDK registry |
| `registries/sdks/stripe.yml` | Stripe registry |
| `registries/sdks/openai.yml` | OpenAI registry |
| `registries/sdks/README.md` | How to add SDK patterns |
| `packages/core/src/registry.ts` | Registry loader |

## References

- [tree-sitter S-expression queries](https://tree-sitter.github.io/tree-sitter/using-parsers#pattern-matching-with-queries)
- [tree-sitter-python grammar](https://github.com/tree-sitter/tree-sitter-python)
- [tree-sitter-javascript grammar](https://github.com/tree-sitter/tree-sitter-javascript)
- PRD FR-1.2 through FR-1.7, FR-1.10
