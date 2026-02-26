import { relative } from "node:path";
import type { AnalyzerContext, DependencyEntry } from "@thirdwatch/core";
import type { Confidence } from "@thirdwatch/tdm";
import { detectUseStatements } from "./imports.js";

// ---------------------------------------------------------------------------
// SDK crate prefixes → [provider, sdk_package]
// ---------------------------------------------------------------------------

const SDK_CRATE_PREFIXES: Record<string, [string, string]> = {
  aws_sdk: ["aws", "aws-sdk-rust"],
  aws_config: ["aws", "aws-sdk-rust"],
  stripe: ["stripe", "stripe-rust"],
  async_openai: ["openai", "async-openai"],
};

// ---------------------------------------------------------------------------
// HTTP patterns: [regex, kind tag]
// ---------------------------------------------------------------------------

const HTTP_PATTERNS: [RegExp, string][] = [
  // reqwest::get("url")
  [/reqwest::get\(\s*"([^"]+)"/, "REQWEST_GET"],
  // client.get("url"), client.post("url"), etc.
  [/\.\s*(get|post|put|patch|delete|head)\(\s*"([^"]+)"/, "CLIENT_METHOD"],
  // ureq::get("url"), ureq::post("url")
  [/ureq::(get|post|put|patch|delete)\(\s*"([^"]+)"/, "UREQ"],
  // .uri("url") — hyper Request::builder()
  [/\.uri\(\s*"([^"]+)"/, "BUILDER_URI"],
];

// ---------------------------------------------------------------------------
// SDK constructor / factory patterns: [regex, provider, sdk_package]
// ---------------------------------------------------------------------------

const SDK_CONSTRUCTORS: [RegExp, string, string][] = [
  // AWS: aws_sdk_s3::Client::new, aws_sdk_sqs::Client::new
  [/aws_sdk_(\w+)::Client::new\(/, "aws", "aws-sdk-rust"],
  // aws_config::load_defaults
  [/aws_config::load_defaults\(/, "aws", "aws-sdk-rust"],
  // stripe::Client::new
  [/stripe::Client::new\(/, "stripe", "stripe-rust"],
  // stripe resource operations: stripe::Charge::create, etc.
  [/stripe::(Charge|PaymentIntent|Customer|Subscription)/, "stripe", "stripe-rust"],
  // async_openai::Client::new
  [/async_openai::Client::new\(/, "openai", "async-openai"],
];

// ---------------------------------------------------------------------------
// Infrastructure patterns: [regex, infra type]
// ---------------------------------------------------------------------------

const INFRA_PATTERNS: [RegExp, string][] = [
  [/PgPool::connect\(/, "postgresql"],
  [/PgConnection::establish\(/, "postgresql"],
  [/PgPoolOptions/, "postgresql"],
  [/MySqlPool::connect\(/, "mysql"],
  [/redis::Client::open\(/, "redis"],
  [/mongodb::Client::with_uri_str\(/, "mongodb"],
  [/FutureProducer/, "kafka"],
  [/StreamConsumer/, "kafka"],
  [/Connection::connect\(\s*"amqp:\/\//, "rabbitmq"],
  [/elasticsearch::Elasticsearch::new\(/, "elasticsearch"],
];

// Connection string URL patterns
const CONN_STRING_PATTERNS: [RegExp, string][] = [
  [/postgresql:\/\/[^\s"']+/, "postgresql"],
  [/postgres:\/\/[^\s"']+/, "postgresql"],
  [/mysql:\/\/[^\s"']+/, "mysql"],
  [/mongodb(\+srv)?:\/\/[^\s"'`]+/, "mongodb"],
  [/redis:\/\/[^\s"']+/, "redis"],
  [/amqp:\/\/[^\s"']+/, "rabbitmq"],
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Scan nearby lines for `.set("bootstrap.servers", "<broker>")` to extract
 * the actual broker address rather than the config key name.
 */
function findRustKafkaBootstrapServers(lines: string[], lineIndex: number): string {
  const start = Math.max(0, lineIndex - 3);
  const end = Math.min(lines.length - 1, lineIndex + 10);
  for (let j = start; j <= end; j++) {
    const m = lines[j]!.match(/"bootstrap\.servers"\s*,\s*"([^"]+)"/);
    if (m) return m[1]!;
  }
  return "unknown";
}

// ---------------------------------------------------------------------------
// Main analyzer entry point
// ---------------------------------------------------------------------------

export function analyzeRust(context: AnalyzerContext): DependencyEntry[] {
  const entries: DependencyEntry[] = [];
  const lines = context.source.split("\n");
  const rel = relative(context.scanRoot, context.filePath);

  // Parse use statements to resolve SDK crate paths
  const imports = detectUseStatements(context.source);

  // Track emitted SDK providers to avoid duplicates
  const emittedSdkProviders = new Map<string, DependencyEntry>();

  // Detect SDK entries from use statements (deduplicated by provider)
  for (const [, usePath] of imports) {
    const crateRoot = usePath.split("::")[0]!;
    for (const [prefix, [provider, sdkPackage]] of Object.entries(SDK_CRATE_PREFIXES)) {
      if (crateRoot === prefix || crateRoot.startsWith(prefix + "_")) {
        if (!emittedSdkProviders.has(provider)) {
          const entry: DependencyEntry = {
            kind: "sdk",
            provider,
            sdk_package: sdkPackage,
            locations: [{ file: rel, line: 1, context: `use ${usePath}` }],
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

    // Skip single-line comments
    if (trimmed.startsWith("//")) continue;

    // Skip block comment content
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

      if (kind === "REQWEST_GET") {
        method = "GET";
        url = match[1] ?? "unknown";
      } else if (kind === "BUILDER_URI") {
        url = match[1] ?? "unknown";
        // Try to find Method:: on nearby lines for hyper builder pattern
        const nearby = lines.slice(Math.max(0, i - 3), i + 1).join(" ");
        const methodMatch = nearby.match(/Method::(GET|POST|PUT|PATCH|DELETE|HEAD)/);
        method = methodMatch?.[1] ?? "GET";
      } else {
        // CLIENT_METHOD and UREQ: method is match[1], url is match[2]
        method = match[1]?.toUpperCase() ?? "GET";
        url = match[2] ?? "unknown";
      }

      // Skip non-URL matches (e.g., .get on a HashMap)
      if (kind === "CLIENT_METHOD" && !/^https?:\/\//.test(url)) continue;

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

    // --- SDK constructor detection (deduplicated by provider) ---
    for (const [pattern, provider, sdkPackage] of SDK_CONSTRUCTORS) {
      const match = line.match(pattern);
      if (!match) continue;

      // Resolve service name for AWS (e.g., aws_sdk_s3 → s3)
      let serviceName: string | undefined;
      if (provider === "aws" && match[1] && pattern.source.includes("aws_sdk_")) {
        serviceName = match[1];
      }

      // Enrich existing entry or create a new one
      const existing = emittedSdkProviders.get(provider);
      if (existing && existing.kind === "sdk") {
        if (serviceName) {
          existing.services_used = [...(existing.services_used ?? []), serviceName];
        }
        existing.locations.push({ file: rel, line: lineNum, context: trimmed });
      } else {
        const entry: DependencyEntry = {
          kind: "sdk",
          provider,
          sdk_package: sdkPackage,
          ...(serviceName ? { services_used: [serviceName] } : {}),
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

      const envMatch = line.match(/env::var\(\s*["']([^"']+)["']\s*\)/);
      const allQuoted = [...line.matchAll(/["']([^"']+)["']/g)].map((m) => m[1]!);
      // For Kafka, find the actual broker address from nearby bootstrap.servers assignment
      // rather than using allQuoted[0] (which would be the config key name "bootstrap.servers")
      const connValue =
        infraType === "kafka" ? findRustKafkaBootstrapServers(lines, i) : (allQuoted[0] ?? "unknown");
      const connectionRef = envMatch?.[1] ?? redactConnString(connValue);

      entries.push({
        kind: "infrastructure",
        type: infraType,
        connection_ref: connectionRef,
        locations: [{ file: rel, line: lineNum, context: trimmed }],
        confidence: envMatch ? "medium" : "high",
      });
    }

    // --- Connection string URL patterns ---
    for (const [pattern, infraType] of CONN_STRING_PATTERNS) {
      const connMatch = line.match(pattern);
      if (connMatch) {
        const alreadyDetected = entries.some(
          (e) =>
            e.kind === "infrastructure" &&
            e.type === infraType &&
            e.locations.some((l) => l.line === lineNum),
        );
        if (!alreadyDetected) {
          entries.push({
            kind: "infrastructure",
            type: infraType,
            connection_ref: redactConnString(connMatch[0]),
            locations: [{ file: rel, line: lineNum, context: trimmed }],
            confidence: "high",
          });
        }
      }
    }
  }

  return entries;
}

/** Redact credentials from connection string URLs */
function redactConnString(raw: string): string {
  // Redact userinfo credentials: ://user:pass@host
  let result = raw.replaceAll(/:\/\/[^@]+@/g, "://<redacted>@");
  // Redact query-string credential params: ?password=secret&token=abc
  result = result.replaceAll(
    /([?&](?:password|passwd|pwd|secret|token|key|auth)=)[^&\s"']+/gi,
    "$1<redacted>",
  );
  return result;
}
