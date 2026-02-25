---
title: "feat: PHP Language Analyzer"
type: feat
phase: 1 — The Map (expansion)
date: 2026-02-24
priority: P2
dependencies: Plan 3 (Scanner Core), Plan 4 (Detectors)
package: packages/languages/php
---

# feat: PHP Language Analyzer

## Overview

Build `@thirdwatch/language-php` — a language analyzer plugin for PHP codebases. PHP powers over 75% of websites with a server-side language, including WordPress, Laravel, Symfony, and Drupal. Its package manager (Composer) is JSON-based and straightforward to parse. PHP code mixes global functions (`curl_init`), namespaced classes (`\Stripe\Charge::create`), and framework facades (`Http::get`), requiring multiple detection strategies.

## Problem Statement

PHP has the largest installed base of any server-side language. Laravel alone has millions of active installations. PHP applications commonly integrate with payment gateways (Stripe, PayPal), email providers (SendGrid, Mailgun), cloud storage (S3), and databases (MySQL, PostgreSQL, Redis). Without PHP support, Thirdwatch cannot serve the majority of web applications in production today.

## Proposed Solution

A `@thirdwatch/language-php` package implementing `LanguageAnalyzerPlugin` with:
1. `composer.json` and `composer.lock` manifest parsing
2. HTTP client detection (Guzzle, cURL, file_get_contents, Laravel Http, Symfony HttpClient)
3. SDK detection (Stripe PHP, AWS SDK PHP, Twilio PHP, Firebase PHP)
4. Infrastructure detection (PDO, Laravel DB, Predis, Doctrine, MongoDB)

## Technical Approach

### Plugin Entry Point

```typescript
// packages/languages/php/src/index.ts
import type { LanguageAnalyzerPlugin, AnalyzerContext, DependencyEntry } from "@thirdwatch/core";
import { analyzePhp } from "./analyzer.js";
import { parseManifests } from "./manifests.js";

export class PhpPlugin implements LanguageAnalyzerPlugin {
  readonly name = "PHP Analyzer";
  readonly language = "php";
  readonly extensions = [".php"];

  async analyze(context: AnalyzerContext): Promise<DependencyEntry[]> {
    return analyzePhp(context);
  }

  async analyzeManifests(
    manifestFiles: string[],
    scanRoot: string,
  ): Promise<DependencyEntry[]> {
    return parseManifests(manifestFiles, scanRoot);
  }
}
```

### Manifest Parsing — `composer.json`

```json
{
  "name": "acme/payments-service",
  "require": {
    "php": "^8.2",
    "guzzlehttp/guzzle": "^7.8",
    "stripe/stripe-php": "^13.0",
    "aws/aws-sdk-php": "^3.300",
    "predis/predis": "^2.2",
    "laravel/framework": "^11.0"
  },
  "require-dev": {
    "phpunit/phpunit": "^10.5"
  }
}
```

```typescript
// packages/languages/php/src/manifests.ts

export async function parseManifests(
  manifestFiles: string[],
  scanRoot: string,
): Promise<DependencyEntry[]> {
  const entries: DependencyEntry[] = [];

  for (const manifest of manifestFiles) {
    if (manifest.endsWith("composer.json")) {
      const content = await readFile(manifest, "utf-8");
      entries.push(...parseComposerJson(content, relative(scanRoot, manifest)));
    }
  }

  return entries;
}

function parseComposerJson(content: string, manifestFile: string): DependencyEntry[] {
  let composer: Record<string, unknown>;
  try {
    composer = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return [];
  }

  const entries: DependencyEntry[] = [];

  for (const section of ["require", "require-dev"]) {
    const deps = composer[section] as Record<string, string> | undefined;
    if (!deps) continue;

    for (const [name, constraint] of Object.entries(deps)) {
      // Skip PHP version constraint and extensions
      if (name === "php" || name.startsWith("ext-")) continue;

      entries.push({
        kind: "package",
        name,
        ecosystem: "packagist",
        current_version: resolveVersion(constraint),
        version_constraint: constraint,
        manifest_file: manifestFile,
        locations: [],
        usage_count: 0,
        confidence: "high",
      });
    }
  }

  return entries;
}

function resolveVersion(constraint: string): string {
  const cleaned = constraint.replace(/^[\^~>=<|*\s]+/, "");
  return cleaned || constraint;
}
```

### HTTP Client Detection

PHP HTTP patterns to detect:

```php
// Guzzle (most popular)
$client = new \GuzzleHttp\Client();
$response = $client->get('https://api.stripe.com/v1/charges');
$response = $client->post('https://api.example.com/orders', [
    'json' => $payload,
]);
$response = $client->request('POST', 'https://api.openai.com/v1/completions', $options);

// cURL
$ch = curl_init('https://api.example.com/users');
curl_setopt($ch, CURLOPT_URL, 'https://api.stripe.com/v1/charges');
curl_setopt($ch, CURLOPT_POST, true);

// file_get_contents
$response = file_get_contents('https://api.example.com/data');

// Laravel Http facade
$response = Http::get('https://api.example.com/users');
$response = Http::post('https://api.example.com/orders', $data);
$response = Http::withToken($token)->get('https://api.openai.com/v1/models');

// Symfony HttpClient
$response = $client->request('GET', 'https://api.example.com/users');
$client = HttpClient::create(['base_uri' => 'https://api.stripe.com']);
```

```typescript
// packages/languages/php/src/analyzer.ts — HTTP detection

const PHP_HTTP_PATTERNS: [RegExp, string | null][] = [
  // Guzzle: $client->get('url'), $client->post('url')
  [/->(get|post|put|patch|delete|head)\(\s*['"]([^'"]+)['"]/, null],
  // Guzzle: $client->request('METHOD', 'url')
  [/->request\(\s*['"](\w+)['"]\s*,\s*['"]([^'"]+)['"]/, "REQUEST"],
  // curl_init('url')
  [/curl_init\(\s*['"]([^'"]+)['"]/, "CURL_INIT"],
  // curl_setopt CURLOPT_URL
  [/CURLOPT_URL\s*,\s*['"]([^'"]+)['"]/, "CURL_URL"],
  // file_get_contents('url')
  [/file_get_contents\(\s*['"]([^'"]+)['"]/, "FGC"],
  // Laravel Http::get('url'), Http::post('url')
  [/Http::(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/, null],
  // Symfony HttpClient::request('METHOD', 'url')
  [/->request\(\s*['"](\w+)['"]\s*,\s*['"]([^'"]+)['"]/, "REQUEST"],
  // base_uri
  [/base_uri['"]\s*=>\s*['"]([^'"]+)['"]/, "BASE_URI"],
];
```

### SDK Detection

```php
// Stripe
\Stripe\Stripe::setApiKey($stripeKey);
$charge = \Stripe\Charge::create(['amount' => 2000, 'currency' => 'usd']);
$intent = \Stripe\PaymentIntent::create($params);

// AWS SDK
$s3 = new \Aws\S3\S3Client(['version' => 'latest', 'region' => 'us-east-1']);
$sqs = new \Aws\Sqs\SqsClient($config);
$result = $s3->putObject(['Bucket' => $bucket, 'Key' => $key, 'Body' => $body]);

// Twilio
$twilio = new \Twilio\Rest\Client($sid, $token);
$message = $twilio->messages->create($to, ['from' => $from, 'body' => $body]);

// Firebase
$factory = (new \Kreait\Firebase\Factory)->withServiceAccount($serviceAccount);
$messaging = $factory->createMessaging();

// SendGrid
$sg = new \SendGrid($apiKey);
$email = new \SendGrid\Mail\Mail();
```

```typescript
const PHP_SDK_PATTERNS: [RegExp, string, string][] = [
  // Stripe: \Stripe\Stripe::setApiKey, \Stripe\Charge::create
  [/\\?Stripe\\(Stripe::setApiKey|Charge|PaymentIntent|Customer|Subscription|Invoice)/, "stripe", "stripe-php"],
  // AWS: new \Aws\S3\S3Client, new \Aws\Sqs\SqsClient
  [/new\s+\\?Aws\\(\w+)\\(\w+Client)/, "aws", "aws-sdk-php"],
  // Twilio: new \Twilio\Rest\Client
  [/new\s+\\?Twilio\\Rest\\Client/, "twilio", "twilio-php"],
  // Firebase: \Kreait\Firebase\Factory
  [/\\?Kreait\\Firebase\\Factory/, "firebase", "kreait/firebase-php"],
  // SendGrid: new \SendGrid(
  [/new\s+\\?SendGrid\(/, "sendgrid", "sendgrid-php"],
  // Sentry: \Sentry\init
  [/\\?Sentry\\init\(/, "sentry", "sentry-php"],
];
```

### Infrastructure Detection

```php
// PDO
$pdo = new PDO('mysql:host=localhost;dbname=mydb', $user, $pass);
$pdo = new PDO('pgsql:host=localhost;dbname=mydb', $user, $pass);
$pdo = new \PDO("mysql:host={$host};dbname={$db}", $user, $pass);

// Laravel DB
DB::connection('mysql')->select('SELECT * FROM users');
DB::table('users')->where('email', $email)->first();

// Doctrine DBAL
$conn = DriverManager::getConnection(['url' => 'mysql://user:pass@host/db']);

// Predis (Redis)
$client = new \Predis\Client('tcp://127.0.0.1:6379');
$client = new \Predis\Client(['host' => 'redis.example.com']);

// PhpRedis extension
$redis = new \Redis();
$redis->connect('127.0.0.1', 6379);

// MongoDB
$client = new \MongoDB\Client('mongodb://localhost:27017');
```

```typescript
const PHP_INFRA_PATTERNS: [RegExp, string][] = [
  // PDO with DSN
  [/new\s+\\?PDO\(\s*['"]mysql:/, "mysql"],
  [/new\s+\\?PDO\(\s*['"]pgsql:/, "postgresql"],
  [/new\s+\\?PDO\(\s*['"]sqlite:/, "sqlite"],
  // Predis
  [/new\s+\\?Predis\\Client\(/, "redis"],
  // PhpRedis
  [/new\s+\\?Redis\(\)/, "redis"],
  [/->connect\(\s*['"][\w.]+['"]\s*,\s*6379/, "redis"],
  // MongoDB
  [/new\s+\\?MongoDB\\Client\(/, "mongodb"],
  // Doctrine DriverManager
  [/DriverManager::getConnection\(/, "mysql"],
  // Laravel DB facade
  [/DB::(connection|table|select|insert|update|delete)\(/, "mysql"],
];
```

## Implementation Phases

### Phase 15.1: Package Scaffold + Composer Parsing
- Initialize `packages/languages/php` with package.json, tsconfig.json
- Implement `composer.json` parser
- Skip `php` and `ext-*` constraints
- Unit tests with fixture composer.json files

### Phase 15.2: HTTP Client Detection
- Implement Guzzle detection (method calls, request method)
- Implement cURL detection (curl_init, curl_setopt)
- Implement file_get_contents, Laravel Http facade, Symfony HttpClient
- Test against `fixtures/php-app/`

### Phase 15.3: SDK Detection
- Implement namespaced class detection (\Stripe\, \Aws\, \Twilio\)
- Handle both namespaced (`\Stripe\Charge`) and imported (`use Stripe\Charge`) forms
- Map via registry

### Phase 15.4: Infrastructure Detection
- Implement PDO DSN detection (mysql, pgsql, sqlite)
- Implement Redis (Predis, PhpRedis), MongoDB, Doctrine patterns
- Laravel DB facade detection

### Phase 15.5: Integration + Registry
- Add PHP (`packagist:`) patterns to registry YAML files
- Integration test: scan `fixtures/php-app/` → validate full TDM
- Test with both Laravel-style and plain PHP code

## Acceptance Criteria

- [ ] `composer.json` `require` and `require-dev` parsed with ecosystem `packagist`
- [ ] `php` and `ext-*` entries excluded
- [ ] `$client->post('https://...')` produces API entry
- [ ] `Http::get('https://...')` (Laravel) produces API entry
- [ ] `curl_init('https://...')` produces API entry
- [ ] `\Stripe\Charge::create(...)` produces SDK entry with provider `stripe`
- [ ] `new \Aws\S3\S3Client(...)` produces SDK entry with provider `aws`
- [ ] `new PDO('mysql:host=...')` produces infrastructure entry with type `mysql`
- [ ] `new \Predis\Client(...)` produces infrastructure entry with type `redis`
- [ ] Both `\Fully\Qualified\Name` and `use`-imported names handled

## File Inventory

| File | Description |
|---|---|
| `packages/languages/php/package.json` | Package manifest |
| `packages/languages/php/tsconfig.json` | TypeScript config |
| `packages/languages/php/src/index.ts` | PhpPlugin export |
| `packages/languages/php/src/analyzer.ts` | Source code analyzer |
| `packages/languages/php/src/manifests.ts` | composer.json parser |
| `packages/languages/php/src/__tests__/analyzer.test.ts` | Analyzer unit tests |
| `packages/languages/php/src/__tests__/manifests.test.ts` | Manifest parser tests |
| `fixtures/php-app/` | PHP fixture project |

## References

- [Composer documentation](https://getcomposer.org/doc/)
- [Packagist](https://packagist.org/)
- [Guzzle](https://docs.guzzlephp.org/)
- [Stripe PHP](https://github.com/stripe/stripe-php)
- [AWS SDK for PHP](https://github.com/aws/aws-sdk-php)
- [Laravel HTTP Client](https://laravel.com/docs/11.x/http-client)
