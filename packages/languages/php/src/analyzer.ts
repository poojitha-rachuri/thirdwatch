import { relative } from "node:path";
import type { AnalyzerContext, DependencyEntry } from "@thirdwatch/core";
import type { Confidence } from "@thirdwatch/tdm";

// ---------------------------------------------------------------------------
// PHP `use` import detection → map alias to fully qualified namespace
// Runs line-by-line to: (a) skip commented-out `use` statements, and
// (b) track the actual line number of each import.
// ---------------------------------------------------------------------------

function detectUseImports(source: string): Map<string, { fullPath: string; line: number }> {
  const imports = new Map<string, { fullPath: string; line: number }>();
  const lines = source.split("\n");
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const trimmed = raw.trim();

    // Skip single-line comments
    if (trimmed.startsWith("//") || trimmed.startsWith("#")) continue;

    // Track block comments
    if (inBlockComment) {
      if (trimmed.includes("*/")) inBlockComment = false;
      continue;
    }
    if (trimmed.startsWith("/*")) {
      if (!trimmed.includes("*/")) inBlockComment = true;
      continue;
    }

    // Simple: use Ns\Class; or use Ns\Class as Alias;
    const simpleMatch = raw.match(/^\s*use\s+([A-Za-z0-9_\\]+)(?:\s+as\s+(\w+))?\s*;/);
    if (simpleMatch) {
      const fullPath = simpleMatch[1]!;
      const alias = simpleMatch[2] ?? fullPath.split("\\").pop()!;
      imports.set(alias, { fullPath, line: i + 1 });
      continue;
    }

    // Grouped: use Ns\{ClassA, ClassB as Alias};
    const groupedMatch = raw.match(/^\s*use\s+([A-Za-z0-9_\\]+)\\\{([^}]+)\}\s*;/);
    if (groupedMatch) {
      const nsPrefix = groupedMatch[1]!;
      for (const item of groupedMatch[2]!.split(",").map((s) => s.trim()).filter(Boolean)) {
        const aliasMatch = item.match(/^(\w+)\s+as\s+(\w+)$/);
        if (aliasMatch) {
          const fullPath = `${nsPrefix}\\${aliasMatch[1]!}`;
          imports.set(aliasMatch[2]!, { fullPath, line: i + 1 });
        } else {
          const fullPath = `${nsPrefix}\\${item}`;
          const alias = item.split("\\").pop()!;
          imports.set(alias, { fullPath, line: i + 1 });
        }
      }
    }
  }

  return imports;
}

// Pre-computed for performance (avoid Object.entries in hot loop)
const SDK_IMPORT_PREFIX_ENTRIES = Object.entries({
  Stripe: ["stripe", "stripe/stripe-php"],
  Aws: ["aws", "aws/aws-sdk-php"],
  Twilio: ["twilio", "twilio/sdk"],
  "Kreait\\Firebase": ["firebase", "kreait/firebase-php"],
  SendGrid: ["sendgrid", "sendgrid/sendgrid"],
  Sentry: ["sentry", "sentry/sentry"],
} as Record<string, [string, string]>);

// ---------------------------------------------------------------------------
// HTTP client patterns: [regex, kind tag]
// ---------------------------------------------------------------------------

const HTTP_PATTERNS: [RegExp, string][] = [
  // Guzzle: $client->get('url'), $client->post('url')
  [/->(get|post|put|patch|delete|head)\(\s*['"]([^'"]+)['"]/, "GUZZLE"],
  // Guzzle / Symfony: $client->request('METHOD', 'url')
  [/->request\(\s*['"](\w+)['"]\s*,\s*['"]([^'"]+)['"]/, "REQUEST"],
  // curl_init('url')
  [/curl_init\(\s*['"]([^'"]+)['"]/, "CURL_INIT"],
  // curl_setopt CURLOPT_URL
  [/CURLOPT_URL\s*,\s*['"]([^'"]+)['"]/, "CURL_URL"],
  // file_get_contents('url')
  [/file_get_contents\(\s*['"]([^'"]+)['"]/, "FGC"],
  // Laravel Http::get('url'), Http::post('url')
  [/Http::(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/, "LARAVEL_HTTP"],
  // base_uri / base_url config
  [/['"]base_uri['"]\s*=>\s*['"]([^'"]+)['"]/, "BASE_URI"],
];

// ---------------------------------------------------------------------------
// SDK patterns: [regex, provider, sdk_package]
// ---------------------------------------------------------------------------

const SDK_PATTERNS: [RegExp, string, string][] = [
  // Stripe: \Stripe\Stripe::setApiKey, \Stripe\Charge::create, etc.
  [/\\?Stripe\\(?:Stripe::setApiKey|Charge|PaymentIntent|Customer|Subscription|Invoice)/, "stripe", "stripe/stripe-php"],
  // AWS: new \Aws\S3\S3Client, new \Aws\Sqs\SqsClient, etc.
  [/new\s+\\?Aws\\\w+\\\w+Client/, "aws", "aws/aws-sdk-php"],
  // Twilio: new \Twilio\Rest\Client
  [/\\?Twilio\\Rest\\Client/, "twilio", "twilio/sdk"],
  // Firebase: \Kreait\Firebase\Factory
  [/\\?Kreait\\Firebase\\Factory/, "firebase", "kreait/firebase-php"],
  // SendGrid: new \SendGrid(
  [/new\s+\\?SendGrid\(/, "sendgrid", "sendgrid/sendgrid"],
  // Sentry: \Sentry\init
  [/\\?Sentry\\init\(/, "sentry", "sentry/sentry"],
];

// ---------------------------------------------------------------------------
// Infrastructure patterns: [regex, infra type]
// ---------------------------------------------------------------------------

const INFRA_PATTERNS: [RegExp, string][] = [
  // PDO with DSN
  [/new\s+\\?PDO\(\s*['"]mysql:/, "mysql"],
  [/new\s+\\?PDO\(\s*['"]pgsql:/, "postgresql"],
  [/new\s+\\?PDO\(\s*['"]sqlite:/, "sqlite"],
  // Predis
  [/new\s+\\?Predis\\Client\(/, "redis"],
  // PhpRedis — use negated class to avoid backtracking
  [/new\s+\\?Redis\(\)/, "redis"],
  [/->connect\(\s*["'][^"']+["']\s*,\s*6379/, "redis"],
  // MongoDB
  [/new\s+\\?MongoDB\\Client\(/, "mongodb"],
  // Doctrine DriverManager
  [/DriverManager::getConnection\(/, "database"],
  // Laravel DB facade
  [/DB::(connection|table|select|insert|update|delete)\(/, "database"],
];

// Connection string URL patterns
const CONN_STRING_PATTERNS: [RegExp, string][] = [
  [/mysql:\/\/[^\s"']+/, "mysql"],
  [/pgsql:\/\/[^\s"']+/, "postgresql"],
  [/mongodb(\+srv)?:\/\/[^\s"'`]+/, "mongodb"],
  [/redis:\/\/[^\s"']+/, "redis"],
];

// Pre-compiled for first quoted-string extraction (avoid per-line object alloc)
const FIRST_QUOTED_RE = /["']([^"']+)["']/;

// ---------------------------------------------------------------------------
// Main analyzer entry point
// ---------------------------------------------------------------------------

export function analyzePhp(context: AnalyzerContext): DependencyEntry[] {
  const entries: DependencyEntry[] = [];
  const lines = context.source.split("\n");
  const rel = relative(context.scanRoot, context.filePath);

  // Parse use imports (comment-aware, with line numbers)
  const imports = detectUseImports(context.source);

  // Track emitted SDK providers to deduplicate
  const emittedSdkProviders = new Map<string, DependencyEntry>();

  // Set for O(1) conn-string dedup
  const emittedConnStrings = new Set<string>();

  // Detect SDK from `use` imports
  for (const [, { fullPath, line: importLine }] of imports) {
    for (const [prefix, [provider, sdkPackage]] of SDK_IMPORT_PREFIX_ENTRIES) {
      if (fullPath === prefix || fullPath.startsWith(prefix + "\\")) {
        if (!emittedSdkProviders.has(provider)) {
          const entry: DependencyEntry = {
            kind: "sdk",
            provider,
            sdk_package: sdkPackage,
            locations: [{ file: rel, line: importLine, context: `use ${fullPath}` }],
            usage_count: 1,
            confidence: "high",
          };
          emittedSdkProviders.set(provider, entry);
          entries.push(entry);
        }
        break;
      }
    }
  }

  let inBlockComment = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineNum = i + 1;
    const trimmed = line.trim();

    // Skip comments
    if (trimmed.startsWith("//") || trimmed.startsWith("#")) continue;
    if (inBlockComment) {
      if (trimmed.includes("*/")) inBlockComment = false;
      continue;
    }
    if (trimmed.startsWith("/*")) {
      if (!trimmed.includes("*/")) inBlockComment = true;
      continue;
    }

    // --- HTTP detection ---
    for (const [pattern, kind] of HTTP_PATTERNS) {
      const match = line.match(pattern);
      if (!match) continue;

      let method = "GET";
      let url = "unknown";

      if (kind === "REQUEST") {
        method = match[1]?.toUpperCase() ?? "GET";
        url = match[2] ?? "unknown";
      } else if (kind === "CURL_INIT") {
        url = match[1] ?? "unknown";
      } else if (kind === "CURL_URL") {
        url = match[1] ?? "unknown";
      } else if (kind === "FGC") {
        url = match[1] ?? "unknown";
      } else if (kind === "BASE_URI") {
        url = match[1] ?? "unknown";
      } else if (kind === "GUZZLE" || kind === "LARAVEL_HTTP") {
        method = match[1]!.toUpperCase();
        url = match[2] ?? "unknown";
      }

      // Only emit for HTTP(S) URLs (skip local file paths, etc.)
      if (kind === "FGC" && !/^https?:\/\//.test(url)) continue;

      const confidence: Confidence = /^https?:\/\//.test(url) ? "high" : "medium";

      entries.push({
        kind: "api",
        url,
        method: method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD",
        locations: [{ file: rel, line: lineNum, context: trimmed }],
        usage_count: 1,
        confidence,
      });
    }

    // --- SDK detection (deduplicated by provider) ---
    for (const [pattern, provider, sdkPackage] of SDK_PATTERNS) {
      const match = line.match(pattern);
      if (!match) continue;

      const existing = emittedSdkProviders.get(provider);
      if (existing && existing.kind === "sdk") {
        existing.locations.push({ file: rel, line: lineNum, context: trimmed });
        existing.usage_count++;
      } else {
        const entry: DependencyEntry = {
          kind: "sdk",
          provider,
          sdk_package: sdkPackage,
          api_methods: [trimmed.slice(0, 80)],
          locations: [{ file: rel, line: lineNum, context: trimmed }],
          usage_count: 1,
          confidence: "high",
        };
        emittedSdkProviders.set(provider, entry);
        entries.push(entry);
      }
    }

    // --- Infrastructure detection ---
    for (const [pattern, infraType] of INFRA_PATTERNS) {
      const match = line.match(pattern);
      if (!match) continue;

      const firstQuoted = FIRST_QUOTED_RE.exec(line);
      const connectionRef = firstQuoted?.[1] ?? "unknown";

      entries.push({
        kind: "infrastructure",
        type: infraType,
        connection_ref: redactConnString(connectionRef),
        locations: [{ file: rel, line: lineNum, context: redactConnString(trimmed) }],
        confidence: "high",
      });
    }

    // --- Connection string URL patterns ---
    for (const [pattern, infraType] of CONN_STRING_PATTERNS) {
      const connMatch = line.match(pattern);
      if (!connMatch) continue;

      const connKey = `${lineNum}:${infraType}`;
      if (!emittedConnStrings.has(connKey)) {
        emittedConnStrings.add(connKey);
        entries.push({
          kind: "infrastructure",
          type: infraType,
          connection_ref: redactConnString(connMatch[0]),
          locations: [{ file: rel, line: lineNum, context: redactConnString(trimmed) }],
          confidence: "high",
        });
      }
    }
  }

  return entries;
}

/** Redact credentials from connection string URLs and query-string credential params */
function redactConnString(raw: string): string {
  // Redact user:pass@ style credentials in URL connection strings
  let result = raw.replace(/:\/\/[^@]+@/g, "://<redacted>@");
  // Redact ?key=val and &key=val credential params
  result = result.replace(
    /([?&;](?:password|passwd|pwd|secret|token|key|auth|user)\s*=\s*)[^&\s"';]+/gi,
    "$1<redacted>",
  );
  return result;
}
