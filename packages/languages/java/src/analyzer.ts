import { relative } from "node:path";
import type { AnalyzerContext, DependencyEntry } from "@thirdwatch/core";
import type { Confidence } from "@thirdwatch/tdm";

// ---------------------------------------------------------------------------
// HTTP client patterns: [regex, kind tag]
// ---------------------------------------------------------------------------

const HTTP_PATTERNS: [RegExp, string][] = [
  // URI.create("url") — java.net.http.HttpClient
  [/URI\.create\(\s*"([^"]+)"/, "URI_CREATE"],
  // .url("url") — OkHttp
  [/\.url\(\s*"([^"]+)"/, "OKHTTP"],
  // restTemplate.getForEntity("url", ...) / .postForObject("url", ...)
  [/restTemplate\.(getForEntity|postForObject|exchange|getForObject)\(\s*"([^"]+)"/, "REST_TEMPLATE"],
  // webClient.get().uri("url") / .post().uri("url")
  [/webClient\.(get|post|put|patch|delete)\(\)\.uri\(\s*"([^"]+)"/, "WEBCLIENT"],
  // @FeignClient(url = "https://...")
  [/@FeignClient\([^)]*url\s*=\s*"([^"]+)"/, "FEIGN"],
];

// Annotation-based HTTP patterns (Retrofit only)
// NOTE: Spring @GetMapping/@PostMapping are intentionally excluded — they appear on both
// outgoing Feign client interface methods AND incoming Spring controller methods, making
// them ambiguous without AST-level context analysis. The @FeignClient(url=...) base URL
// is already captured via HTTP_PATTERNS (FEIGN kind). Retrofit @GET/@POST are always on
// outgoing client interfaces so they remain safe to detect.
const ANNOTATION_HTTP_PATTERNS: [RegExp, string][] = [
  // @GET("/path"), @POST("/path") — Retrofit (always outgoing client interface methods)
  [/@(GET|POST|PUT|PATCH|DELETE)\(\s*"([^"]+)"/, "RETROFIT"],
];

// ---------------------------------------------------------------------------
// SDK constructor / factory patterns: [regex, provider, sdk_package]
// ---------------------------------------------------------------------------

const SDK_PATTERNS: [RegExp, string, string][] = [
  // AWS: S3Client.builder(), SqsClient.create()
  [/(S3|Sqs|Sns|DynamoDb|Lambda|Ses|Iam|Sts|Ec2|Ecs)Client\.(builder|create)\(/, "aws", "aws-sdk-java-v2"],
  // Stripe: Charge.create(), PaymentIntent.create()
  [/(?:Charge|PaymentIntent|Customer|Subscription|Invoice|Refund)\.create\(/, "stripe", "stripe-java"],
  // Firebase: FirebaseApp.initializeApp()
  [/FirebaseApp\.initializeApp\(/, "firebase", "firebase-admin-java"],
  // Twilio: Twilio.init()
  [/Twilio\.init\(/, "twilio", "twilio-java"],
  // SendGrid: new SendGrid()
  [/new\s+SendGrid\(/, "sendgrid", "sendgrid-java"],
];

// ---------------------------------------------------------------------------
// Infrastructure patterns: [regex, infra type]
// ---------------------------------------------------------------------------

const INFRA_PATTERNS: [RegExp, string][] = [
  [/DriverManager\.getConnection\(/, "jdbc"],
  [/setJdbcUrl\(/, "jdbc_config"],
  [/new\s+Jedis\(/, "redis"],
  [/JedisPool\(/, "redis"],
  [/RedisClient\.create\(/, "redis"],
  [/MongoClients\.create\(/, "mongodb"],
  [/KafkaProducer\s*</, "kafka"],
  [/KafkaConsumer\s*</, "kafka"],
];

// JDBC URL patterns → infra type
const JDBC_URL_PATTERNS: [RegExp, string][] = [
  [/jdbc:postgresql:\/\/[^\s"']+/, "postgresql"],
  [/jdbc:mysql:\/\/[^\s"']+/, "mysql"],
  [/jdbc:oracle:[^\s"']+/, "oracle"],
  [/jdbc:sqlserver:[^\s"']+/, "sqlserver"],
  [/jdbc:h2:[^\s"']+/, "h2"],
];

// Connection string URL patterns
const CONN_STRING_PATTERNS: [RegExp, string][] = [
  [/mongodb(\+srv)?:\/\/[^\s"']+/, "mongodb"],
  [/redis:\/\/[^\s"']+/, "redis"],
];

// SDK import patterns → [provider, sdk_package]
const SDK_IMPORT_PREFIXES: Record<string, [string, string]> = {
  "software.amazon.awssdk": ["aws", "aws-sdk-java-v2"],
  "com.stripe": ["stripe", "stripe-java"],
  "com.google.firebase": ["firebase", "firebase-admin-java"],
  "com.twilio": ["twilio", "twilio-java"],
  "com.sendgrid": ["sendgrid", "sendgrid-java"],
};

// ---------------------------------------------------------------------------
// Main analyzer entry point
// ---------------------------------------------------------------------------

export function analyzeJava(context: AnalyzerContext): DependencyEntry[] {
  const entries: DependencyEntry[] = [];
  const lines = context.source.split("\n");
  const rel = relative(context.scanRoot, context.filePath);

  // Track emitted SDK providers to deduplicate
  const emittedSdkProviders = new Map<string, DependencyEntry>();

  // Detect SDK from imports — track block comments to avoid matching commented-out imports
  let inBlockComment = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (trimmed.startsWith("//")) continue;
    if (inBlockComment) {
      if (trimmed.includes("*/")) inBlockComment = false;
      continue;
    }
    if (trimmed.startsWith("/*")) {
      if (!trimmed.includes("*/")) inBlockComment = true;
      continue;
    }

    const importMatch = trimmed.match(/^import\s+(?:static\s+)?([a-zA-Z0-9_.]+)\s*;/);
    if (importMatch) {
      const importPath = importMatch[1]!;
      for (const [prefix, [provider, sdkPackage]] of Object.entries(SDK_IMPORT_PREFIXES)) {
        if (importPath.startsWith(prefix)) {
          if (!emittedSdkProviders.has(provider)) {
            const entry: DependencyEntry = {
              kind: "sdk",
              provider,
              sdk_package: sdkPackage,
              locations: [{ file: rel, line: i + 1, context: trimmed }],
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
  }

  inBlockComment = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineNum = i + 1;
    const trimmed = line.trim();

    // Skip single-line comments
    if (trimmed.startsWith("//")) continue;

    // Track block comments — content inside /* ... */ blocks is not analyzed
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

      let method: string = "GET";
      let url: string;

      if (kind === "REST_TEMPLATE") {
        const methodName = match[1]!.toLowerCase();
        method = methodName.includes("post") ? "POST" : "GET";
        url = match[2] ?? "unknown";
      } else if (kind === "WEBCLIENT") {
        method = match[1]!.toUpperCase();
        url = match[2] ?? "unknown";
      } else if (kind === "FEIGN") {
        url = match[1] ?? "unknown";
        method = "GET"; // Feign clients define methods separately
      } else {
        url = match[1] ?? "unknown";
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

    // --- Annotation-based HTTP detection (Retrofit only) ---
    for (const [pattern] of ANNOTATION_HTTP_PATTERNS) {
      const match = line.match(pattern);
      if (!match) continue;

      const method = match[1]!.toUpperCase();
      const url = match[2] ?? "unknown";

      entries.push({
        kind: "api",
        url,
        method: method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
        locations: [{ file: rel, line: lineNum, context: trimmed }],
        usage_count: 1,
        confidence: "medium",
      });
    }

    // --- SDK constructor detection (deduplicated by provider) ---
    for (const [pattern, provider, sdkPackage] of SDK_PATTERNS) {
      const match = line.match(pattern);
      if (!match) continue;

      let serviceName: string | undefined;
      if (provider === "aws" && match[1]) {
        // Extract service from class name: S3Client → s3, DynamoDbClient → dynamodb
        serviceName = match[1].toLowerCase().replace(/client$/, "");
      }

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

      if (infraType === "jdbc" || infraType === "jdbc_config") {
        // Extract JDBC URL from the line to determine actual DB type
        for (const [jdbcPattern, dbType] of JDBC_URL_PATTERNS) {
          const jdbcMatch = line.match(jdbcPattern);
          if (jdbcMatch) {
            entries.push({
              kind: "infrastructure",
              type: dbType,
              connection_ref: redactConnString(jdbcMatch[0]),
              locations: [{ file: rel, line: lineNum, context: trimmed }],
              confidence: "high",
            });
            break;
          }
        }
        // If no JDBC URL found on this line, check for env var
        if (!entries.some((e) => e.kind === "infrastructure" && e.locations.some((l) => l.line === lineNum))) {
          const envMatch = line.match(/System\.getenv\(\s*"([^"]+)"\s*\)/);
          entries.push({
            kind: "infrastructure",
            type: "database",
            connection_ref: envMatch?.[1] ?? "unknown",
            locations: [{ file: rel, line: lineNum, context: trimmed }],
            confidence: envMatch ? "medium" : "high",
          });
        }
      } else if (infraType === "kafka") {
        // Kafka brokers are configured via Properties, not inline — scan nearby lines
        const bootstrapServers = findKafkaBootstrapServers(lines, i);
        entries.push({
          kind: "infrastructure",
          type: infraType,
          connection_ref: bootstrapServers,
          locations: [{ file: rel, line: lineNum, context: trimmed }],
          confidence: "high",
        });
      } else {
        // Redis, MongoDB
        const allQuoted = [...line.matchAll(/["']([^"']+)["']/g)].map((m) => m[1]!);
        const connectionRef = allQuoted[0] ?? "unknown";

        entries.push({
          kind: "infrastructure",
          type: infraType,
          connection_ref: redactConnString(connectionRef),
          locations: [{ file: rel, line: lineNum, context: trimmed }],
          confidence: "high",
        });
      }
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

    // --- JDBC URL patterns without DriverManager ---
    for (const [jdbcPattern, dbType] of JDBC_URL_PATTERNS) {
      const jdbcMatch = line.match(jdbcPattern);
      if (jdbcMatch) {
        const alreadyDetected = entries.some(
          (e) =>
            e.kind === "infrastructure" &&
            e.type === dbType &&
            e.locations.some((l) => l.line === lineNum),
        );
        if (!alreadyDetected) {
          entries.push({
            kind: "infrastructure",
            type: dbType,
            connection_ref: redactConnString(jdbcMatch[0]),
            locations: [{ file: rel, line: lineNum, context: trimmed }],
            confidence: "high",
          });
        }
      }
    }
  }

  return entries;
}

/**
 * Scan back up to 15 lines from the KafkaProducer/KafkaConsumer instantiation
 * to find a `bootstrap.servers` property assignment and return the broker address.
 * Returns "unknown" if no bootstrap.servers is found nearby.
 */
function findKafkaBootstrapServers(lines: string[], lineIndex: number): string {
  const searchStart = Math.max(0, lineIndex - 15);
  for (let j = lineIndex - 1; j >= searchStart; j--) {
    const m = lines[j]!.match(/"bootstrap\.servers"[^"]*"([^"]+)"/);
    if (m) return m[1]!;
  }
  return "unknown";
}

/** Redact credentials from connection string URLs */
function redactConnString(raw: string): string {
  return raw.replace(/:\/\/[^@]+@/, "://<redacted>@");
}
