import { relative } from "node:path";
import type { AnalyzerContext, DependencyEntry } from "@thirdwatch/core";
import type { Confidence } from "@thirdwatch/tdm";

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "head", "options", "request"]);

// Known SDK modules → provider mapping
const SDK_PROVIDERS: Record<string, string> = {
  boto3: "aws",
  stripe: "stripe",
  openai: "openai",
  twilio: "twilio",
  firebase_admin: "firebase",
  sendgrid: "sendgrid",
  sentry_sdk: "sentry",
  datadog: "datadog",
  anthropic: "anthropic",
  pinecone: "pinecone",
  supabase: "supabase",
};

// Infrastructure function patterns
const INFRA_FUNCS: Record<string, string> = {
  "psycopg2.connect": "postgresql",
  "psycopg.connect": "postgresql",
  "pymysql.connect": "mysql",
  "MySQLdb.connect": "mysql",
  "pymongo.MongoClient": "mongodb",
  "redis.Redis": "redis",
  "redis.StrictRedis": "redis",
  "elasticsearch.Elasticsearch": "elasticsearch",
  "create_engine": "postgresql",
};

// Connection string URL patterns
const CONN_STRING_PATTERNS: [RegExp, string][] = [
  [/postgresql:\/\/[^\s"']+/, "postgresql"],
  [/postgres:\/\/[^\s"']+/, "postgresql"],
  [/mysql:\/\/[^\s"']+/, "mysql"],
  [/mongodb(\+srv)?:\/\/[^\s"']+/, "mongodb"],
  [/redis:\/\/[^\s"']+/, "redis"],
  [/amqp:\/\/[^\s"']+/, "rabbitmq"],
];

// SDK constructor names → [provider, sdk_package]
const SDK_CONSTRUCTORS: Record<string, [string, string]> = {
  OpenAI: ["openai", "openai"],
  AsyncOpenAI: ["openai", "openai"],
  TwilioClient: ["twilio", "twilio"],
};

export function analyzePython(context: AnalyzerContext): DependencyEntry[] {
  const entries: DependencyEntry[] = [];
  const lines = context.source.split("\n");
  const rel = relative(context.scanRoot, context.filePath);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineNum = i + 1;

    // Detect HTTP calls: requests.get("url"), httpx.post("url"), etc.
    // Excludes os.environ.get() and similar non-HTTP calls
    const httpCallMatch = line.match(
      /(\w+)\.(get|post|put|patch|delete|head|options|request)\(\s*(?:["']([^"']+)["']|(\w+))?/i,
    );
    if (httpCallMatch) {
      const [, clientVar, method, literalUrl, varUrl] = httpCallMatch;
      const skipClients = new Set(["os", "environ", "dict", "list", "self", "cls", "response"]);
      if (
        clientVar &&
        method &&
        HTTP_METHODS.has(method.toLowerCase()) &&
        !skipClients.has(clientVar)
      ) {
        // If no URL argument on this line, peek at the next line
        let url = literalUrl ?? varUrl;
        let confidence: Confidence = "medium";
        if (!url && i + 1 < lines.length) {
          const nextLine = lines[i + 1]!.trim();
          const nextLiteralMatch = nextLine.match(/^["']([^"']+)["']/);
          const nextVarMatch = nextLine.match(/^(\w+)\s*,/);
          url = nextLiteralMatch?.[1] ?? nextVarMatch?.[1];
        }
        url = url ?? "unknown";
        const isLiteral = literalUrl !== undefined;
        confidence = isLiteral && /^https?:\/\//.test(url) ? "high" : "medium";

        entries.push({
          kind: "api",
          url,
          method: method.toUpperCase() as "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS",
          locations: [{ file: rel, line: lineNum, context: line.trim() }],
          usage_count: 1,
          confidence,
        });
      }
    }

    // Detect SDK usage: boto3.client("s3"), stripe.Charge.create(...), etc.
    for (const [module, provider] of Object.entries(SDK_PROVIDERS)) {
      // Match: boto3.client("s3"), boto3.resource("dynamodb")
      if (module === "boto3") {
        const boto3Match = line.match(/boto3\.(client|resource)\(\s*["']([^"']+)["']/);
        if (boto3Match) {
          entries.push({
            kind: "sdk",
            provider,
            sdk_package: module,
            services_used: [boto3Match[2]!],
            api_methods: [`boto3.${boto3Match[1]}("${boto3Match[2]}")`],
            locations: [{ file: rel, line: lineNum, context: line.trim() }],
            usage_count: 1,
            confidence: "high",
          });
        }
        continue;
      }

      // Match: stripe.Charge.create(...), openai.ChatCompletion.create(...)
      const modulePattern = module.replace(/_/g, "[_.]");
      const sdkCallMatch = line.match(new RegExp(`${modulePattern}\\.(\\w+(?:\\.\\w+)*)\\(`));
      if (sdkCallMatch) {
        const apiMethod = `${module}.${sdkCallMatch[1]}`;
        entries.push({
          kind: "sdk",
          provider,
          sdk_package: module,
          api_methods: [apiMethod],
          locations: [{ file: rel, line: lineNum, context: line.trim() }],
          usage_count: 1,
          confidence: "high",
        });
      }
    }

    // Detect SDK from constructor calls: OpenAI(...), TwilioClient(...)
    const constructorMatch = line.match(/(?:^|\s|=)\s*(\w+)\s*\(/);
    if (constructorMatch) {
      const ctorName = constructorMatch[1]!;
      const ctorMapping = SDK_CONSTRUCTORS[ctorName];
      if (ctorMapping) {
        entries.push({
          kind: "sdk",
          provider: ctorMapping[0],
          sdk_package: ctorMapping[1],
          locations: [{ file: rel, line: lineNum, context: line.trim(), usage: `constructor:${ctorName}` }],
          usage_count: 1,
          confidence: "high",
        });
      }
    }

    // Detect infrastructure: psycopg2.connect(...), redis.Redis(...), etc.
    for (const [func, infraType] of Object.entries(INFRA_FUNCS)) {
      if (line.includes(func)) {
        const envMatch = line.match(/os\.environ\[["']([^"']+)["']\]|os\.environ\.get\(["']([^"']+)["']\)/);
        const connRefMatch = line.match(/["']([^"']+)["']/);
        const connection_ref = envMatch?.[1] ?? envMatch?.[2] ?? connRefMatch?.[1] ?? "unknown";

        // Try to extract host from Redis-style calls: redis.Redis(host="cache.internal")
        const hostMatch = line.match(/host\s*=\s*["']([^"']+)["']/);

        const entry: DependencyEntry = {
          kind: "infrastructure",
          type: infraType,
          connection_ref,
          locations: [{ file: rel, line: lineNum, context: line.trim() }],
          confidence: envMatch ? "medium" : "high",
        };
        if (hostMatch) {
          entry.resolved_host = hostMatch[1]!;
        }
        entries.push(entry);
      }
    }

    // Detect connection string URLs in string literals
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
            connection_ref: connMatch[0],
            locations: [{ file: rel, line: lineNum, context: line.trim() }],
            confidence: "high",
          });
        }
      }
    }
  }

  return entries;
}
