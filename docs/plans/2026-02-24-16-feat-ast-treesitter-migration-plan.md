---
title: "feat: AST-Based Scanning — tree-sitter Migration"
type: feat
phase: 1 — The Map (foundational upgrade)
date: 2026-02-24
priority: P0
dependencies: Plan 3 (Scanner Core), Plan 4 (Detectors)
package: packages/core, packages/languages/*
---

# feat: AST-Based Scanning — tree-sitter Migration

## Overview

Migrate all language analyzers from regex-based line scanning to AST-based analysis using `web-tree-sitter` (WASM). This is a foundational upgrade that improves detection accuracy from ~70% to ~95%+ by enabling multi-line pattern matching, scope-aware variable tracing, and structural code understanding. The migration is incremental — each language can be upgraded independently, and regex remains as a fallback.

## Problem Statement

The current regex-based analyzers work by scanning source files line by line. This approach has fundamental limitations:

### What Regex Misses

1. **Multi-line function calls** — Very common in Go, Java, Rust:
   ```python
   response = requests.post(
       "https://api.stripe.com/v1/charges",
       headers={"Authorization": f"Bearer {key}"},
       json=payload,
   )
   ```
   Regex sees `requests.post(` on one line and `"https://api.stripe.com/..."` on the next — must use fragile multi-line lookahead.

2. **Template literal / f-string interpolation**:
   ```javascript
   const url = `${BASE_URL}/v1/users/${userId}`;
   fetch(url);
   ```
   Regex cannot connect the `fetch(url)` call to the template literal `url` definition.

3. **Variable indirection**:
   ```python
   endpoint = os.environ.get("STRIPE_API_BASE", "https://api.stripe.com")
   url = f"{endpoint}/v1/charges"
   response = requests.post(url, json=data)
   ```
   Three lines, three variables — regex cannot trace `url` back to `endpoint` back to the literal.

4. **Import aliasing**:
   ```javascript
   import { S3Client as StorageClient } from "@aws-sdk/client-s3";
   const client = new StorageClient({});
   ```
   Regex must track the alias mapping separately, which is error-prone.

5. **Decorator/annotation patterns**:
   ```java
   @FeignClient(name = "payments", url = "${stripe.api.url}")
   public interface PaymentClient {
       @PostMapping("/v1/charges")
       Charge createCharge(@RequestBody ChargeRequest request);
   }
   ```
   The URL and method are in annotations, not function calls.

6. **False positives** — Regex matches inside comments, strings, and dead code:
   ```python
   # requests.get("https://old-api.example.com/v1/users")  # commented out
   ```

### Quantified Impact

| Scenario | Regex Accuracy | AST Accuracy |
|---|---|---|
| Single-line literal URL calls | ~95% | ~99% |
| Multi-line calls | ~30% | ~98% |
| Variable-passed URLs | ~0% | ~80% |
| Aliased imports | ~60% | ~99% |
| Annotation-based patterns | ~40% | ~95% |
| False positives (comments) | ~15% FP rate | ~0% FP rate |

## Proposed Solution

A shared AST infrastructure in `@thirdwatch/core` (or a new `@thirdwatch/ast` package) that:
1. Initializes `web-tree-sitter` WASM for each supported language
2. Provides a query runner that executes S-expression queries against parsed ASTs
3. Provides node-to-location helpers (0-indexed → 1-indexed line conversion)
4. Each language plugin migrates from regex to `.scm` query files in a `queries/` directory
5. Regex remains as a fallback when WASM initialization fails

## Technical Approach

### AST Infrastructure (`packages/core/src/ast.ts`)

```typescript
// packages/core/src/ast.ts
import Parser from "web-tree-sitter";

// Grammar WASM files bundled per language
const GRAMMAR_PATHS: Record<string, string> = {
  python: "tree-sitter-python.wasm",
  javascript: "tree-sitter-javascript.wasm",
  typescript: "tree-sitter-typescript.wasm",
  go: "tree-sitter-go.wasm",
  java: "tree-sitter-java.wasm",
  rust: "tree-sitter-rust.wasm",
  php: "tree-sitter-php.wasm",
};

let initPromise: Promise<void> | null = null;

export async function initTreeSitter(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = Parser.init();
  return initPromise;
}

export async function createParser(language: string): Promise<Parser> {
  await initTreeSitter();
  const parser = new Parser();
  const grammarPath = GRAMMAR_PATHS[language];
  if (!grammarPath) throw new Error(`No grammar for language: ${language}`);
  const lang = await Parser.Language.load(grammarPath);
  parser.setLanguage(lang);
  return parser;
}

export interface QueryMatch {
  pattern: number;
  captures: QueryCapture[];
}

export interface QueryCapture {
  name: string;
  node: Parser.SyntaxNode;
  text: string;
  /** 1-indexed line number (tree-sitter is 0-indexed; we add 1) */
  line: number;
}

export function runQuery(
  tree: Parser.Tree,
  language: Parser.Language,
  querySource: string,
  source: string,
): QueryMatch[] {
  const query = language.query(querySource);
  const matches = query.matches(tree.rootNode);

  return matches.map((m) => ({
    pattern: m.pattern,
    captures: m.captures.map((c) => ({
      name: c.name,
      node: c.node,
      text: source.slice(c.node.startIndex, c.node.endIndex),
      line: c.node.startPosition.row + 1, // 0-indexed → 1-indexed
    })),
  }));
}
```

### Python Tree-Sitter Queries

```scheme
;; packages/languages/python/queries/http-calls.scm

;; Match: requests.get("url"), requests.post("url"), httpx.get("url")
(call
  function: (attribute
    object: (identifier) @client
    attribute: (identifier) @method)
  arguments: (argument_list
    (string (string_content) @url))
  (#match? @client "^(requests|httpx|session|client|http)$")
  (#match? @method "^(get|post|put|patch|delete|head|options)$"))

;; Match: requests.post(url, ...) where url is a variable
(call
  function: (attribute
    object: (identifier) @client
    attribute: (identifier) @method)
  arguments: (argument_list
    (identifier) @url_var)
  (#match? @client "^(requests|httpx)$")
  (#match? @method "^(get|post|put|patch|delete|head|options)$"))

;; Match: requests.request("POST", "url")
(call
  function: (attribute
    object: (identifier) @client
    attribute: (identifier) @method)
  arguments: (argument_list
    (string (string_content) @verb)
    (string (string_content) @url))
  (#eq? @method "request")
  (#match? @client "^(requests|httpx)$"))
```

```scheme
;; packages/languages/python/queries/sdk-instantiation.scm

;; Match: boto3.client("s3"), boto3.resource("dynamodb")
(call
  function: (attribute
    object: (identifier) @module
    attribute: (identifier) @factory)
  arguments: (argument_list
    (string (string_content) @service))
  (#eq? @module "boto3")
  (#match? @factory "^(client|resource)$"))

;; Match: stripe.Charge.create(...), openai.ChatCompletion.create(...)
(call
  function: (attribute
    object: (attribute
      object: (identifier) @module
      attribute: (identifier) @class)
    attribute: (identifier) @method)
  (#match? @module "^(stripe|openai|twilio|sentry_sdk)$"))

;; Match: OpenAI(...), Anthropic(...)
(call
  function: (identifier) @constructor
  (#match? @constructor "^(OpenAI|AsyncOpenAI|Anthropic|AsyncAnthropic|TwilioClient)$"))
```

```scheme
;; packages/languages/python/queries/infrastructure.scm

;; Match: psycopg2.connect("postgresql://..."), redis.Redis(host="...")
(call
  function: (attribute
    object: (identifier) @module
    attribute: (identifier) @func)
  (#match? @func "^(connect|Redis|StrictRedis|MongoClient|Elasticsearch)$"))

;; Match: create_engine("postgresql://...")
(call
  function: (identifier) @func
  arguments: (argument_list
    (string (string_content) @url))
  (#eq? @func "create_engine"))

;; Connection string literals anywhere in the file
(string (string_content) @conn_str
  (#match? @conn_str "^(postgresql|postgres|mysql|mongodb(\\+srv)?|redis|amqp)://"))
```

### JavaScript/TypeScript Tree-Sitter Queries

```scheme
;; packages/languages/javascript/queries/http-calls.scm

;; Match: fetch("url"), fetch(`template`)
(call_expression
  function: (identifier) @func
  arguments: (arguments
    [(string (string_fragment) @url)
     (template_string) @template_url])
  (#eq? @func "fetch"))

;; Match: axios.get("url"), got.post("url")
(call_expression
  function: (member_expression
    object: (identifier) @client
    property: (property_identifier) @method)
  arguments: (arguments
    [(string (string_fragment) @url)
     (template_string) @template_url
     (identifier) @url_var])
  (#match? @client "^(axios|got|ky|superagent)$")
  (#match? @method "^(get|post|put|patch|delete|head|request)$"))

;; Match: fetch(url, { method: "POST" })
(call_expression
  function: (identifier) @func
  arguments: (arguments
    (identifier) @url_var
    (object
      (pair
        key: (property_identifier) @key
        value: (string (string_fragment) @method_value))
      (#eq? @key "method")))
  (#eq? @func "fetch"))
```

```scheme
;; packages/languages/javascript/queries/sdk-instantiation.scm

;; Match: new Stripe(key), new OpenAI({...}), new S3Client({...})
(new_expression
  constructor: (identifier) @constructor
  (#match? @constructor "^(Stripe|OpenAI|Anthropic|S3Client|SQSClient|SNSClient|DynamoDBClient|LambdaClient|Resend|WebClient|SlackClient)$"))

;; Match: createClient(), createRedisClient()
(call_expression
  function: (identifier) @func
  (#match? @func "^(createClient|createRedisClient|createSupabaseClient|initializeApp)$"))
```

### Go Tree-Sitter Queries

```scheme
;; packages/languages/go/queries/http-calls.scm

;; Match: http.Get("url"), http.Post("url", ...)
(call_expression
  function: (selector_expression
    operand: (identifier) @pkg
    field: (field_identifier) @method)
  arguments: (argument_list
    (interpreted_string_literal) @url)
  (#eq? @pkg "http")
  (#match? @method "^(Get|Post|Head|PostForm)$"))

;; Match: http.NewRequest("METHOD", "url", body)
(call_expression
  function: (selector_expression
    operand: (identifier) @pkg
    field: (field_identifier) @func)
  arguments: (argument_list
    (interpreted_string_literal) @method_str
    (interpreted_string_literal) @url)
  (#eq? @pkg "http")
  (#match? @func "^(NewRequest|NewRequestWithContext)$"))
```

### Variable Tracing (Scope-Limited)

Full dataflow analysis is out of scope. Instead, implement scope-limited variable tracing: when a function call uses a variable as URL, look backward in the same function scope for the variable's assignment.

```typescript
// packages/core/src/ast-tracing.ts

export function traceVariable(
  node: Parser.SyntaxNode,
  variableName: string,
  source: string,
): string | null {
  // Walk up to the enclosing function/method
  let scope = node.parent;
  while (scope && !isFunctionScope(scope)) {
    scope = scope.parent;
  }
  if (!scope) scope = node.tree.rootNode;

  // Find assignment to this variable within the scope
  // Look for: const url = "..."; let url = `...`; url = "..."
  const assignments = findAssignments(scope, variableName, source);

  for (const assignment of assignments) {
    // If assigned a string literal, return it
    if (assignment.type === "string" || assignment.type === "string_fragment") {
      return source.slice(assignment.startIndex, assignment.endIndex);
    }
    // If assigned a template literal, try to resolve static parts
    if (assignment.type === "template_string") {
      return resolveTemplate(assignment, source);
    }
    // If assigned from process.env / os.environ, return the env var name
    if (isEnvAccess(assignment, source)) {
      return extractEnvVarName(assignment, source);
    }
  }

  return null;
}
```

### Dual-Mode Architecture (Migration Strategy)

During migration, each analyzer supports both regex and AST modes:

```typescript
// packages/languages/python/src/analyzer.ts

export async function analyzePython(context: AnalyzerContext): Promise<DependencyEntry[]> {
  // Try AST-based analysis first
  try {
    const parser = await createParser("python");
    const tree = parser.parse(context.source);
    return analyzeWithAST(tree, context);
  } catch {
    // Fall back to regex if WASM initialization fails
    return analyzeWithRegex(context);
  }
}
```

### Performance Considerations

| Concern | Strategy |
|---|---|
| WASM initialization | Initialize once per process, cache `Parser.Language` instances |
| Query compilation | Compile each `.scm` query once, reuse across files |
| Memory | tree-sitter uses a streaming parser — memory = O(tree depth), not O(file size) |
| Large files | Skip files >1MB even with AST (configurable) |
| Benchmark target | 100K LOC in <60s (same as regex target) |

```typescript
// packages/core/src/ast-cache.ts

const parserCache = new Map<string, Parser>();
const queryCache = new Map<string, Parser.Query>();

export async function getCachedParser(language: string): Promise<Parser> {
  if (parserCache.has(language)) return parserCache.get(language)!;
  const parser = await createParser(language);
  parserCache.set(language, parser);
  return parser;
}

export function getCachedQuery(
  language: Parser.Language,
  querySource: string,
): Parser.Query {
  const key = querySource.slice(0, 100); // Use prefix as cache key
  if (queryCache.has(key)) return queryCache.get(key)!;
  const query = language.query(querySource);
  queryCache.set(key, query);
  return query;
}
```

### WASM Grammar Packaging

Each language plugin bundles its tree-sitter WASM grammar:

```json
// packages/languages/python/package.json
{
  "dependencies": {
    "web-tree-sitter": "^0.22.0",
    "tree-sitter-python": "^0.21.0"
  },
  "files": ["dist", "wasm/*.wasm"]
}
```

Pre-build WASM from grammar repos:
```bash
# scripts/build-grammars.sh
npx tree-sitter build --wasm node_modules/tree-sitter-python
mv tree-sitter-python.wasm packages/languages/python/wasm/
```

## Implementation Phases

### Phase 16.1: AST Infrastructure
- Add `web-tree-sitter` to `@thirdwatch/core`
- Implement `createParser()`, `runQuery()`, `initTreeSitter()` in `packages/core/src/ast.ts`
- Implement query caching and parser caching
- Implement `nodeToLocation()` helper (0-indexed → 1-indexed)
- Unit test: parse a Python file, run a simple query, verify captures

### Phase 16.2: Python AST Migration
- Write `.scm` query files for Python HTTP, SDK, infrastructure detection
- Implement `analyzeWithAST()` in Python analyzer
- Implement dual-mode fallback (AST → regex)
- Test: verify AST mode catches multi-line calls that regex missed
- Benchmark: verify no regression on 100K LOC fixture

### Phase 16.3: JavaScript/TypeScript AST Migration
- Write `.scm` query files for JS/TS HTTP, SDK, infrastructure
- Handle both JavaScript and TypeScript grammars
- Implement template literal resolution
- Test: verify AST catches `fetch(variable)` patterns

### Phase 16.4: Variable Tracing
- Implement scope-limited variable tracing (`traceVariable()`)
- Trace: `const url = "..."; fetch(url)` → resolves URL
- Trace: `const url = process.env.API_BASE; fetch(url)` → captures env var
- Accuracy target: resolve 80%+ of single-hop variable references

### Phase 16.5: New Language Grammars
- Add tree-sitter grammars for Go, Java, Rust, PHP
- Write `.scm` query files for each language
- Build and bundle WASM files

### Phase 16.6: Deprecate Regex
- Run accuracy comparison: AST vs regex on fixture suite
- If AST accuracy ≥95% on all languages, mark regex as deprecated
- Keep regex as fallback for environments without WASM support
- Document the fallback behavior

## Acceptance Criteria

- [ ] `web-tree-sitter` initializes successfully in Node.js 20
- [ ] Python multi-line `requests.post(` call is detected (regex misses this)
- [ ] JavaScript `fetch(variable)` with nearby string assignment resolves the URL
- [ ] Go multi-line `http.NewRequest` is detected
- [ ] False positive rate drops below 2% (regex: ~15%)
- [ ] Detection recall improves to ≥95% (regex: ~70%)
- [ ] All existing tests continue to pass (backward compatible)
- [ ] WASM init failure gracefully falls back to regex with a warning
- [ ] 100K LOC benchmark completes in <60 seconds
- [ ] Query files (`.scm`) are loadable and editable without code changes
- [ ] Line numbers in TDM are 1-indexed (tree-sitter 0-indexed + 1)

## File Inventory

| File | Description |
|---|---|
| `packages/core/src/ast.ts` | Tree-sitter init, parser, query runner |
| `packages/core/src/ast-cache.ts` | Parser and query caching |
| `packages/core/src/ast-tracing.ts` | Scope-limited variable tracing |
| `packages/languages/python/queries/http-calls.scm` | Python HTTP queries |
| `packages/languages/python/queries/sdk-instantiation.scm` | Python SDK queries |
| `packages/languages/python/queries/infrastructure.scm` | Python infra queries |
| `packages/languages/javascript/queries/http-calls.scm` | JS/TS HTTP queries |
| `packages/languages/javascript/queries/sdk-instantiation.scm` | JS/TS SDK queries |
| `packages/languages/go/queries/http-calls.scm` | Go HTTP queries |
| `packages/languages/java/queries/http-calls.scm` | Java HTTP queries |
| `packages/languages/rust/queries/http-calls.scm` | Rust HTTP queries |
| `packages/languages/php/queries/http-calls.scm` | PHP HTTP queries |
| `scripts/build-grammars.sh` | WASM grammar build script |

## References

- [web-tree-sitter](https://github.com/nicolo-ribaudo/nicolo-ribaudo.github.io) (WASM bindings)
- [tree-sitter query syntax](https://tree-sitter.github.io/tree-sitter/using-parsers#pattern-matching-with-queries)
- [tree-sitter playground](https://tree-sitter.github.io/tree-sitter/playground)
- [tree-sitter-python](https://github.com/tree-sitter/tree-sitter-python)
- [tree-sitter-javascript](https://github.com/tree-sitter/tree-sitter-javascript)
- [tree-sitter-go](https://github.com/tree-sitter/tree-sitter-go)
- [tree-sitter-java](https://github.com/tree-sitter/tree-sitter-java)
- [tree-sitter-rust](https://github.com/tree-sitter/tree-sitter-rust)
- [tree-sitter-php](https://github.com/tree-sitter/tree-sitter-php)
- ADR-003: "Use web-tree-sitter WASM, not native tree-sitter"
