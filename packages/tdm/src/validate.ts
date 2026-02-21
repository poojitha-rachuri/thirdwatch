import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type { ErrorObject } from "ajv";
import type { TDM, TDMValidationIssue } from "./types.js";

// ---------------------------------------------------------------------------
// Schema — embedded to avoid cross-package JSON import boundary issues.
// The canonical JSON file is at schema/v1/tdm.schema.json in the repo root.
// Both copies must be kept in sync (enforced by the schema-sync test).
//
// Full JSONSchemaType<TDM> annotation is not applied here because the schema
// uses $ref/$defs internally, which Ajv's JSONSchemaType cannot express in
// TypeScript. Type safety is instead achieved via ajv.compile<TDM>() which
// produces a ValidateFunction<TDM> type predicate.
// ---------------------------------------------------------------------------

const TDM_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://thirdwatch.dev/schema/v1/tdm.schema.json",
  title: "Thirdwatch Dependency Manifest (TDM)",
  type: "object",
  required: ["version", "metadata", "packages", "apis", "sdks", "infrastructure", "webhooks"],
  additionalProperties: false,
  properties: {
    version: { type: "string", pattern: "^\\d+\\.\\d+$", maxLength: 16 },
    metadata: { $ref: "#/$defs/TDMMetadata" },
    packages: { type: "array", items: { $ref: "#/$defs/TDMPackage" }, maxItems: 10000 },
    apis: { type: "array", items: { $ref: "#/$defs/TDMApi" }, maxItems: 10000 },
    sdks: { type: "array", items: { $ref: "#/$defs/TDMSdk" }, maxItems: 10000 },
    infrastructure: { type: "array", items: { $ref: "#/$defs/TDMInfrastructure" }, maxItems: 10000 },
    webhooks: { type: "array", items: { $ref: "#/$defs/TDMWebhook" }, maxItems: 10000 },
  },
  $defs: {
    Confidence: { type: "string", enum: ["high", "medium", "low"] },
    TDMLocation: {
      type: "object",
      required: ["file", "line"],
      additionalProperties: false,
      properties: {
        file: { type: "string", maxLength: 4096 },
        line: { type: "integer", minimum: 1 },
        context: { type: "string", maxLength: 512 },
        usage: { type: "string", maxLength: 256 },
      },
    },
    TDMMetadata: {
      type: "object",
      required: [
        "scan_timestamp",
        "scanner_version",
        "languages_detected",
        "total_dependencies_found",
        "scan_duration_ms",
      ],
      additionalProperties: false,
      properties: {
        scan_timestamp: { type: "string", format: "date-time", maxLength: 64 },
        scanner_version: { type: "string", maxLength: 64 },
        repository: { type: "string", maxLength: 512 },
        languages_detected: { type: "array", items: { type: "string", maxLength: 64 }, maxItems: 100 },
        total_dependencies_found: { type: "integer", minimum: 0 },
        scan_duration_ms: { type: "integer", minimum: 0 },
      },
    },
    TDMPackage: {
      type: "object",
      required: ["name", "ecosystem", "current_version", "manifest_file", "locations", "usage_count", "confidence"],
      additionalProperties: false,
      properties: {
        id: { type: "string", maxLength: 256 },
        name: { type: "string", maxLength: 256 },
        ecosystem: { type: "string", maxLength: 256 },
        current_version: { type: "string", maxLength: 128 },
        version_constraint: { type: "string", maxLength: 128 },
        manifest_file: { type: "string", maxLength: 4096 },
        locations: { type: "array", items: { $ref: "#/$defs/TDMLocation" }, minItems: 1, maxItems: 1000 },
        usage_count: { type: "integer", minimum: 0 },
        confidence: { $ref: "#/$defs/Confidence" },
      },
    },
    TDMApi: {
      type: "object",
      required: ["url", "locations", "usage_count", "confidence"],
      additionalProperties: false,
      properties: {
        id: { type: "string", maxLength: 256 },
        url: { type: "string", maxLength: 2048, pattern: "^(https?://|\\$\\{)" },
        method: {
          type: "string",
          enum: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "CONNECT", "TRACE"],
        },
        provider: { type: ["string", "null"], maxLength: 256 },
        resolved_url: { type: "string", maxLength: 2048 },
        headers: { type: "array", items: { type: "string", maxLength: 256 }, maxItems: 100 },
        locations: { type: "array", items: { $ref: "#/$defs/TDMLocation" }, minItems: 1, maxItems: 1000 },
        usage_count: { type: "integer", minimum: 0 },
        confidence: { $ref: "#/$defs/Confidence" },
      },
    },
    TDMSdk: {
      type: "object",
      required: ["provider", "sdk_package", "locations", "usage_count", "confidence"],
      additionalProperties: false,
      properties: {
        id: { type: "string", maxLength: 256 },
        provider: { type: "string", maxLength: 256 },
        sdk_package: { type: "string", maxLength: 256 },
        services_used: { type: "array", items: { type: "string", maxLength: 256 }, maxItems: 100 },
        api_methods: { type: "array", items: { type: "string", maxLength: 256 }, maxItems: 100 },
        locations: { type: "array", items: { $ref: "#/$defs/TDMLocation" }, minItems: 1, maxItems: 1000 },
        usage_count: { type: "integer", minimum: 0 },
        confidence: { $ref: "#/$defs/Confidence" },
      },
    },
    TDMInfrastructure: {
      type: "object",
      required: ["type", "connection_ref", "locations", "confidence"],
      additionalProperties: false,
      properties: {
        id: { type: "string", maxLength: 256 },
        type: { type: "string", maxLength: 256 },
        connection_ref: { type: "string", maxLength: 512 },
        resolved_host: { type: ["string", "null"], maxLength: 512 },
        locations: { type: "array", items: { $ref: "#/$defs/TDMLocation" }, minItems: 1, maxItems: 1000 },
        confidence: { $ref: "#/$defs/Confidence" },
      },
    },
    TDMWebhook: {
      type: "object",
      required: ["direction", "target_url", "locations", "confidence"],
      additionalProperties: false,
      properties: {
        id: { type: "string", maxLength: 256 },
        direction: { type: "string", enum: ["outbound_registration", "inbound_callback"] },
        target_url: { type: "string", maxLength: 2048, pattern: "^(https?://|\\$\\{|/)" },
        provider: { type: "string", maxLength: 256 },
        locations: { type: "array", items: { $ref: "#/$defs/TDMLocation" }, minItems: 1, maxItems: 1000 },
        confidence: { $ref: "#/$defs/Confidence" },
      },
    },
  },
} as const;

// Exported for schema-sync testing only — not part of the stable public API.
export const TDM_SCHEMA_OBJECT: unknown = TDM_SCHEMA;

// ---------------------------------------------------------------------------
// Validator — compiled once at module load time.
// compile<TDM>() produces a ValidateFunction<TDM> type predicate, making the
// input as TDM cast in parseTDM sound rather than a blind trust assertion.
// ---------------------------------------------------------------------------

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const _validate = ajv.compile<TDM>(TDM_SCHEMA);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function toValidationIssue(e: ErrorObject): TDMValidationIssue {
  return {
    path: e.instancePath || "(root)",
    message: e.message ?? "unknown error",
    keyword: e.keyword,
  };
}

export class TDMValidationError extends Error {
  readonly issues: TDMValidationIssue[];

  constructor(rawErrors: ErrorObject[]) {
    const MAX_INLINE = 5;
    const shown = rawErrors.slice(0, MAX_INLINE);
    const rest = rawErrors.length - shown.length;
    const summary = shown
      .map((e) => `${e.instancePath || "(root)"}: ${e.message ?? "unknown error"}`)
      .join("; ");
    const suffix = rest > 0 ? `; ... and ${rest} more error(s)` : "";
    super(`TDM validation failed: ${summary}${suffix}`);
    this.name = "TDMValidationError";
    this.issues = rawErrors.map(toValidationIssue);
  }
}

/**
 * Validate and return a typed TDM object.
 * Throws {@link TDMValidationError} with readable messages if validation fails.
 */
export function parseTDM(input: unknown): TDM {
  if (!_validate(input)) {
    throw new TDMValidationError(_validate.errors ?? []);
  }
  return input as TDM;
}

/**
 * Parse a JSON string, validate, and return a typed TDM object.
 *
 * @param json - The JSON string to parse. Must not exceed `maxBytes` in UTF-8 byte length.
 * @param maxBytes - Maximum allowed input size in bytes (default: 50 MB). Callers
 *   handling untrusted input should keep this at the default or lower.
 * @throws {Error} if the input exceeds `maxBytes`
 * @throws {SyntaxError} if the string is not valid JSON
 * @throws {TDMValidationError} if validation fails
 */
export function parseTDMFromString(json: string, maxBytes = 50 * 1024 * 1024): TDM {
  const byteLength = Buffer.byteLength(json, "utf8");
  if (byteLength > maxBytes) {
    throw new Error(`TDM input exceeds maximum size of ${maxBytes} bytes (got ${byteLength} bytes)`);
  }
  return parseTDM(JSON.parse(json) as unknown);
}
