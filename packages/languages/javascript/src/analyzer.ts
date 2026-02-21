import { relative } from "node:path";
import type { AnalyzerContext, DependencyEntry } from "@thirdwatch/core";

type Confidence = "high" | "medium" | "low";

// SDK constructors: new Stripe(key), new OpenAI({...}), new S3Client({...}), etc.
const SDK_CONSTRUCTORS: Record<string, [string, string]> = {
  Stripe: ["stripe", "stripe"],
  OpenAI: ["openai", "openai"],
  Anthropic: ["anthropic", "@anthropic-ai/sdk"],
  S3Client: ["aws", "@aws-sdk/client-s3"],
  SQSClient: ["aws", "@aws-sdk/client-sqs"],
  SNSClient: ["aws", "@aws-sdk/client-sns"],
  DynamoDBClient: ["aws", "@aws-sdk/client-dynamodb"],
  LambdaClient: ["aws", "@aws-sdk/client-lambda"],
  Resend: ["resend", "resend"],
  WebClient: ["slack", "@slack/web-api"],
  SlackClient: ["slack", "@slack/web-api"],
};

// Factory functions that create SDK clients
const SDK_FACTORIES: Record<string, [string, string]> = {
  createClient: ["redis", "redis"],
  createRedisClient: ["redis", "redis"],
  createSupabaseClient: ["supabase", "@supabase/supabase-js"],
};

// HTTP client objects: axios.get, got.post, etc.
const HTTP_CLIENTS = new Set(["axios", "got", "ky", "superagent"]);
const HTTP_METHODS = new Set([
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "request",
]);

// Infrastructure constructors
const INFRA_CONSTRUCTORS: Record<string, string> = {
  PgClient: "postgresql",
  Client: "postgresql", // pg Client
  Pool: "postgresql",
  MongoClient: "mongodb",
};

export function analyzeJavaScript(context: AnalyzerContext): DependencyEntry[] {
  const entries: DependencyEntry[] = [];
  const lines = context.source.split("\n");
  const rel = relative(context.scanRoot, context.filePath);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineNum = i + 1;

    // Detect fetch() calls
    const fetchMatch = line.match(/fetch\(\s*(?:["'`]([^"'`]+)["'`]|(\w+))/);
    if (fetchMatch) {
      const url = fetchMatch[1] ?? fetchMatch[2] ?? "unknown";
      const isLiteral = fetchMatch[1] !== undefined;
      const confidence: Confidence =
        isLiteral && /^https?:\/\//.test(url) ? "high" : "medium";

      // Try to detect method from options object on same/nearby lines
      let method:
        | "GET"
        | "POST"
        | "PUT"
        | "PATCH"
        | "DELETE"
        | "HEAD"
        | "OPTIONS" = "GET";
      const context5 = lines
        .slice(i, Math.min(i + 5, lines.length))
        .join(" ");
      const methodMatch = context5.match(/method:\s*["'](\w+)["']/);
      if (methodMatch) {
        method = methodMatch[1]!.toUpperCase() as typeof method;
      }

      entries.push({
        kind: "api",
        url,
        method,
        locations: [{ file: rel, line: lineNum, context: line.trim() }],
        usage_count: 1,
        confidence,
      });
    }

    // Detect axios.get/post/... calls with string or variable URLs
    const axiosMatch = line.match(
      /(\w+)\.(get|post|put|patch|delete|head|request)\(\s*(?:["']([^"']+)["']|(\w+))/,
    );
    if (axiosMatch) {
      const [, clientVar, method, literalUrl, varUrl] = axiosMatch;
      if (
        clientVar &&
        HTTP_CLIENTS.has(clientVar) &&
        method &&
        HTTP_METHODS.has(method)
      ) {
        const url = literalUrl ?? varUrl ?? "unknown";
        const isLiteral = literalUrl !== undefined;
        const confidence: Confidence =
          isLiteral && /^https?:\/\//.test(url) ? "high" : "medium";

        entries.push({
          kind: "api",
          url,
          method: method.toUpperCase() as
            | "GET"
            | "POST"
            | "PUT"
            | "PATCH"
            | "DELETE"
            | "HEAD",
          locations: [{ file: rel, line: lineNum, context: line.trim() }],
          usage_count: 1,
          confidence,
        });
      }
    }

    // Detect template literal HTTP calls: axios.get(`${BASE}/path`)
    if (!axiosMatch) {
      const templateMatch = line.match(
        /(\w+)\.(get|post|put|patch|delete|head|request)\(\s*`/,
      );
      if (templateMatch) {
        const [, clientVar, method] = templateMatch;
        if (
          clientVar &&
          HTTP_CLIENTS.has(clientVar) &&
          method &&
          HTTP_METHODS.has(method)
        ) {
          const templateContent = line.match(/`([^`]*)`/);
          const url = templateContent?.[1] ?? "unknown";

          entries.push({
            kind: "api",
            url,
            method: method.toUpperCase() as
              | "GET"
              | "POST"
              | "PUT"
              | "PATCH"
              | "DELETE"
              | "HEAD",
            locations: [{ file: rel, line: lineNum, context: line.trim() }],
            usage_count: 1,
            confidence: "medium",
          });
        }
      }
    }

    // Detect SDK constructor calls: new Stripe(key), new OpenAI({...})
    const newMatch = line.match(/new\s+(\w+)\s*\(/);
    if (newMatch) {
      const ctorName = newMatch[1]!;
      const sdk = SDK_CONSTRUCTORS[ctorName];
      if (sdk) {
        entries.push({
          kind: "sdk",
          provider: sdk[0],
          sdk_package: sdk[1],
          locations: [
            {
              file: rel,
              line: lineNum,
              context: line.trim(),
              usage: `constructor:${ctorName}`,
            },
          ],
          usage_count: 1,
          confidence: "high",
        });
      }

      // Infrastructure constructors: new PgClient({connectionString:...})
      const infraType = INFRA_CONSTRUCTORS[ctorName];
      if (infraType) {
        const connMatch = line.match(
          /connectionString:\s*(?:process\.env\[["']([^"']+)["']\]|["']([^"']+)["'])/,
        );
        const connection_ref =
          connMatch?.[1] ?? connMatch?.[2] ?? "unknown";
        entries.push({
          kind: "infrastructure",
          type: infraType,
          connection_ref,
          locations: [{ file: rel, line: lineNum, context: line.trim() }],
          confidence: connMatch?.[1] ? "medium" : "high",
        });
      }
    }

    // Detect factory function calls: createClient({url: ...}), createRedisClient(...)
    const factoryMatch = line.match(
      /(?:const|let|var)\s+\w+\s*=\s*(\w+)\s*\(/,
    );
    if (factoryMatch) {
      const funcName = factoryMatch[1]!;
      const sdk = SDK_FACTORIES[funcName];
      if (sdk) {
        const urlMatch = line.match(
          /url:\s*(?:process\.env\[["']([^"']+)["']\]|["']([^"']+)["'])/,
        );

        entries.push({
          kind: "sdk",
          provider: sdk[0],
          sdk_package: sdk[1],
          locations: [
            {
              file: rel,
              line: lineNum,
              context: line.trim(),
              usage: `factory:${funcName}`,
            },
          ],
          usage_count: 1,
          confidence: "high",
        });

        // Also detect as infrastructure if it's redis
        if (sdk[0] === "redis") {
          const connRef = urlMatch?.[1] ?? urlMatch?.[2] ?? "unknown";
          entries.push({
            kind: "infrastructure",
            type: "redis",
            connection_ref: connRef,
            locations: [{ file: rel, line: lineNum, context: line.trim() }],
            confidence: "medium",
          });
        }
      }
    }

    // Detect twilio factory call: twilio(sid, token)
    const twilioMatch = line.match(
      /(?:const|let|var)\s+\w+\s*=\s*twilio\s*\(/,
    );
    if (twilioMatch) {
      entries.push({
        kind: "sdk",
        provider: "twilio",
        sdk_package: "twilio",
        locations: [
          {
            file: rel,
            line: lineNum,
            context: line.trim(),
            usage: "factory:twilio",
          },
        ],
        usage_count: 1,
        confidence: "high",
      });
    }
  }

  return entries;
}
