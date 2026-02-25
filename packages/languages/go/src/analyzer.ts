import { relative } from "node:path";
import type { AnalyzerContext, DependencyEntry } from "@thirdwatch/core";
import type { Confidence } from "@thirdwatch/tdm";
import { detectImports } from "./imports.js";

// ---------------------------------------------------------------------------
// SDK import path prefixes → [provider, sdk_package]
// ---------------------------------------------------------------------------

const SDK_PROVIDERS: Record<string, [string, string]> = {
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

// ---------------------------------------------------------------------------
// HTTP patterns: [regex, kind tag]
// ---------------------------------------------------------------------------

const HTTP_PATTERNS: [RegExp, string][] = [
  // http.Get("url"), http.Post("url", ...), http.Head("url")
  [/http\.(Get|Post|Head|PostForm)\(\s*"([^"]+)"/, "CALL"],
  // http.NewRequest("METHOD", "url", ...) / http.NewRequestWithContext(ctx, "METHOD", "url", ...)
  [/http\.NewRequest(?:WithContext)?\([^,]*,?\s*"(\w+)",\s*"([^"]+)"/, "NEW_REQUEST"],
  // resty: client.R().Get("url"), .Post("url")
  [/\.R\(\)\s*\.\s*(Get|Post|Put|Patch|Delete|Head)\(\s*"([^"]+)"/, "RESTY"],
  // retryablehttp: client.Get("url")
  [/retryablehttp\.\w+\.(Get|Post|Head)\(\s*"([^"]+)"/, "RETRYABLE"],
];

// ---------------------------------------------------------------------------
// SDK constructor / factory patterns: [regex, provider, sdk_package]
// ---------------------------------------------------------------------------

const SDK_CONSTRUCTORS: [RegExp, string, string][] = [
  // AWS: s3.NewFromConfig(cfg)
  [/(\w+)\.NewFromConfig\(/, "aws", "aws-sdk-go-v2"],
  // Stripe: charge.New(params), customer.New(params)
  [/(?:charge|customer|paymentintent|subscription|invoice)\.New\(/, "stripe", "stripe-go"],
  // OpenAI: openai.NewClient(...)
  [/openai\.NewClient\(/, "openai", "go-openai"],
  // GCP: storage.NewClient(ctx), pubsub.NewClient(ctx, ...)
  [/(storage|pubsub|bigquery|firestore|spanner)\.NewClient\(/, "gcp", "google-cloud-go"],
];

// ---------------------------------------------------------------------------
// Infrastructure patterns: [regex, infra type]
// ---------------------------------------------------------------------------

const INFRA_PATTERNS: [RegExp, string][] = [
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
// Main analyzer entry point
// ---------------------------------------------------------------------------

export function analyzeGo(context: AnalyzerContext): DependencyEntry[] {
  const entries: DependencyEntry[] = [];
  const lines = context.source.split("\n");
  const rel = relative(context.scanRoot, context.filePath);

  // Parse imports to resolve SDK providers
  const imports = detectImports(context.source);

  // Track emitted SDK providers to avoid duplicates (P1 #1)
  const emittedSdkProviders = new Map<string, DependencyEntry>();

  // Detect SDK entries from imports (deduplicated by provider)
  for (const [, importPath] of imports) {
    for (const [prefix, [provider, sdkPackage]] of Object.entries(SDK_PROVIDERS)) {
      if (importPath === prefix || importPath.startsWith(prefix + "/")) {
        if (!emittedSdkProviders.has(provider)) {
          const entry: DependencyEntry = {
            kind: "sdk",
            provider,
            sdk_package: sdkPackage,
            locations: [{ file: rel, line: 1, context: `import "${importPath}"` }],
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineNum = i + 1;
    const trimmed = line.trim();

    // Skip comments
    if (trimmed.startsWith("//")) continue;

    // --- HTTP detection ---
    for (const [pattern, kind] of HTTP_PATTERNS) {
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

      // Gate GCP constructor detection on actual GCP import presence (P3 #9)
      if (provider === "gcp") {
        const isGcpImported = [...imports.values()].some((p) => p.startsWith("cloud.google.com/go"));
        if (!isGcpImported) continue;
      }

      // Resolve alias to canonical service name via imports map (P1 #2)
      let serviceName: string | undefined;
      if ((provider === "aws" || provider === "gcp") && match[1]) {
        const resolvedPath = imports.get(match[1]) ?? match[1];
        serviceName = resolvedPath.split("/").pop() ?? match[1];
      }

      // Enrich existing entry or create a new one (P1 #1)
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

      // For sql.Open, the type comes from the match group
      const resolvedType = infraType === "match_group" ? mapDriverType(match[1]!) : infraType;

      // Try to extract connection string from the line (skip driver name for sql.Open)
      const allQuoted = [...line.matchAll(/["']([^"']+)["']/g)].map((m) => m[1]!);
      const envMatch = line.match(/os\.Getenv\(\s*["']([^"']+)["']\s*\)/);
      // For sql.Open("driver", "connStr"), pick the second quoted string as connection ref
      const connValue = allQuoted.length > 1 ? allQuoted[allQuoted.length - 1]! : allQuoted[0];
      const connectionRef = envMatch?.[1] ?? redactConnString(connValue ?? "unknown");

      entries.push({
        kind: "infrastructure",
        type: resolvedType,
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

function mapDriverType(driver: string): string {
  switch (driver) {
    case "postgres":
    case "pgx":
      return "postgresql";
    case "mysql":
      return "mysql";
    case "sqlite3":
      return "sqlite";
    default:
      return driver;
  }
}

/** Redact credentials from connection string URLs (P1 #3) */
function redactConnString(raw: string): string {
  return raw.replace(/:\/\/[^@]+@/, "://<redacted>@");
}
