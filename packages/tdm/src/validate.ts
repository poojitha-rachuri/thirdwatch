import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type { ErrorObject } from "ajv";
import type { TDM } from "./types.js";

// ---------------------------------------------------------------------------
// Schema — embedded to avoid cross-package JSON import boundary issues.
// The canonical JSON file is at schema/v1/tdm.schema.json in the repo root.
// ---------------------------------------------------------------------------

const TDM_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://thirdwatch.dev/schema/v1/tdm.schema.json",
  title: "Thirdwatch Dependency Manifest (TDM)",
  type: "object",
  required: ["version", "metadata", "packages", "apis", "sdks", "infrastructure", "webhooks"],
  additionalProperties: false,
  properties: {
    version: { type: "string", pattern: "^\\d+\\.\\d+$" },
    metadata: { $ref: "#/$defs/TDMMetadata" },
    packages: { type: "array", items: { $ref: "#/$defs/TDMPackage" } },
    apis: { type: "array", items: { $ref: "#/$defs/TDMAPI" } },
    sdks: { type: "array", items: { $ref: "#/$defs/TDMSDK" } },
    infrastructure: { type: "array", items: { $ref: "#/$defs/TDMInfrastructure" } },
    webhooks: { type: "array", items: { $ref: "#/$defs/TDMWebhook" } },
  },
  $defs: {
    Confidence: { type: "string", enum: ["high", "medium", "low"] },
    TDMLocation: {
      type: "object",
      required: ["file", "line"],
      additionalProperties: false,
      properties: {
        file: { type: "string" },
        line: { type: "integer", minimum: 1 },
        context: { type: "string" },
        usage: { type: "string" },
      },
    },
    TDMMetadata: {
      type: "object",
      required: [
        "schema_version",
        "scan_timestamp",
        "scanner_version",
        "languages_detected",
        "total_dependencies_found",
        "scan_duration_ms",
      ],
      additionalProperties: false,
      properties: {
        schema_version: { type: "string" },
        scan_timestamp: { type: "string", format: "date-time" },
        scanner_version: { type: "string" },
        repository: { type: "string" },
        languages_detected: { type: "array", items: { type: "string" } },
        total_dependencies_found: { type: "integer", minimum: 0 },
        scan_duration_ms: { type: "integer", minimum: 0 },
      },
    },
    TDMPackage: {
      type: "object",
      required: ["name", "ecosystem", "current_version", "manifest_file", "locations", "usage_count", "confidence"],
      additionalProperties: false,
      properties: {
        name: { type: "string" },
        ecosystem: { type: "string" },
        current_version: { type: "string" },
        version_constraint: { type: "string" },
        manifest_file: { type: "string" },
        locations: { type: "array", items: { $ref: "#/$defs/TDMLocation" }, minItems: 1 },
        usage_count: { type: "integer", minimum: 0 },
        confidence: { $ref: "#/$defs/Confidence" },
      },
    },
    TDMAPI: {
      type: "object",
      required: ["url", "locations", "usage_count", "confidence"],
      additionalProperties: false,
      properties: {
        url: { type: "string" },
        method: { type: "string" },
        provider: { type: ["string", "null"] },
        resolved_url: { type: "string" },
        headers: { type: "array", items: { type: "string" } },
        locations: { type: "array", items: { $ref: "#/$defs/TDMLocation" }, minItems: 1 },
        usage_count: { type: "integer", minimum: 0 },
        confidence: { $ref: "#/$defs/Confidence" },
      },
    },
    TDMSDK: {
      type: "object",
      required: ["provider", "sdk_package", "locations", "usage_count", "confidence"],
      additionalProperties: false,
      properties: {
        provider: { type: "string" },
        sdk_package: { type: "string" },
        services_used: { type: "array", items: { type: "string" } },
        api_methods: { type: "array", items: { type: "string" } },
        locations: { type: "array", items: { $ref: "#/$defs/TDMLocation" }, minItems: 1 },
        usage_count: { type: "integer", minimum: 0 },
        confidence: { $ref: "#/$defs/Confidence" },
      },
    },
    TDMInfrastructure: {
      type: "object",
      required: ["type", "connection_ref", "locations", "confidence"],
      additionalProperties: false,
      properties: {
        type: { type: "string" },
        connection_ref: { type: "string" },
        resolved_host: { type: ["string", "null"] },
        locations: { type: "array", items: { $ref: "#/$defs/TDMLocation" }, minItems: 1 },
        confidence: { $ref: "#/$defs/Confidence" },
      },
    },
    TDMWebhook: {
      type: "object",
      required: ["direction", "target_url", "locations", "confidence"],
      additionalProperties: false,
      properties: {
        direction: { type: "string", enum: ["outbound_registration", "inbound_callback"] },
        target_url: { type: "string" },
        provider: { type: "string" },
        locations: { type: "array", items: { $ref: "#/$defs/TDMLocation" }, minItems: 1 },
        confidence: { $ref: "#/$defs/Confidence" },
      },
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Validator — compiled once at module load time
// ---------------------------------------------------------------------------

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const _validate = ajv.compile(TDM_SCHEMA);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export class TDMValidationError extends Error {
  readonly errors: NonNullable<typeof _validate.errors>;

  constructor(errors: NonNullable<typeof _validate.errors>) {
    const summary = errors
      .map((e: ErrorObject) => `${e.instancePath || "(root)"}: ${e.message ?? "unknown error"}`)
      .join("; ");
    super(`TDM validation failed: ${summary}`);
    this.name = "TDMValidationError";
    this.errors = errors;
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
 * Throws {@link TDMValidationError} if validation fails, or a SyntaxError if
 * the string is not valid JSON.
 */
export function parseTDMFromString(json: string): TDM {
  return parseTDM(JSON.parse(json) as unknown);
}
