export const TDM_SCHEMA_VERSION = "1.0" as const;

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export type Confidence = "high" | "medium" | "low";

export type ChangeCategory =
  | "breaking"
  | "deprecation"
  | "major-update"
  | "minor-update"
  | "patch"
  | "security"
  | "informational";

export type Priority = "P0" | "P1" | "P2" | "P3" | "P4";

// ---------------------------------------------------------------------------
// Location — where in the codebase a dependency was detected
// ---------------------------------------------------------------------------

export interface TDMLocation {
  /** Relative path from the scan root */
  file: string;
  /** 1-indexed line number */
  line: number;
  /** Short code snippet for human readability */
  context?: string;
  /** Usage kind, e.g. "import" or "method_call:stripe.Charge.create" */
  usage?: string;
}

// ---------------------------------------------------------------------------
// Metadata — top-level scan context
// ---------------------------------------------------------------------------

export interface TDMMetadata {
  /** TDM schema version, e.g. "1.0" */
  schema_version: string;
  /** ISO 8601 timestamp when the scan completed */
  scan_timestamp: string;
  /** thirdwatch CLI/scanner semver */
  scanner_version: string;
  /** Repository identifier, e.g. "github.com/acme/payments-service" */
  repository?: string;
  /** Languages detected during the scan */
  languages_detected: string[];
  /** Total number of unique dependency entries found */
  total_dependencies_found: number;
  /** Wall-clock scan time in milliseconds */
  scan_duration_ms: number;
}

// ---------------------------------------------------------------------------
// Package — a third-party library declared in a manifest
// ---------------------------------------------------------------------------

export interface TDMPackage {
  /** Package name, e.g. "stripe" or "@aws-sdk/client-s3" */
  name: string;
  /** Package ecosystem */
  ecosystem: "npm" | "pypi" | "go" | "maven" | "rubygems" | string;
  /** Installed / resolved version */
  current_version: string;
  /** Version constraint as written in the manifest, e.g. "^7.0.0" */
  version_constraint?: string;
  /** Path to the manifest file, e.g. "requirements.txt" */
  manifest_file: string;
  /** All locations where this package is imported or used */
  locations: TDMLocation[];
  /** Number of distinct usage sites */
  usage_count: number;
  /** Detection confidence */
  confidence: Confidence;
}

// ---------------------------------------------------------------------------
// API — an outbound HTTP call to an external endpoint
// ---------------------------------------------------------------------------

export interface TDMAPI {
  /** Literal URL or template, e.g. "${BASE_URL}/v2/users" */
  url: string;
  /** HTTP verb, e.g. "GET" or "POST" */
  method?: string;
  /** Auto-detected provider slug, e.g. "stripe"; null when unknown */
  provider?: string | null;
  /** URL after env var resolution attempt */
  resolved_url?: string;
  /** Header name patterns found at the call site */
  headers?: string[];
  /** All locations where this URL is referenced */
  locations: TDMLocation[];
  /** Number of distinct call sites */
  usage_count: number;
  /** Detection confidence */
  confidence: Confidence;
}

// ---------------------------------------------------------------------------
// SDK — usage of a provider SDK library
// ---------------------------------------------------------------------------

export interface TDMSDK {
  /** Provider slug, e.g. "aws", "stripe", "openai" */
  provider: string;
  /** The specific SDK package, e.g. "boto3" or "@aws-sdk/client-s3" */
  sdk_package: string;
  /** Sub-services used, e.g. ["s3", "sqs"] for AWS */
  services_used?: string[];
  /** Specific API methods called, e.g. ["stripe.Charge.create"] */
  api_methods?: string[];
  /** All locations where the SDK is used */
  locations: TDMLocation[];
  /** Number of distinct usage sites */
  usage_count: number;
  /** Detection confidence */
  confidence: Confidence;
}

// ---------------------------------------------------------------------------
// Infrastructure — direct connections to databases, queues, storage, etc.
// ---------------------------------------------------------------------------

export interface TDMInfrastructure {
  /** Infrastructure type */
  type:
    | "postgresql"
    | "mysql"
    | "mongodb"
    | "redis"
    | "elasticsearch"
    | "rabbitmq"
    | "kafka"
    | "sqs"
    | "s3"
    | "gcs"
    | "azure-blob"
    | string;
  /** Raw connection reference (may be an env var name like "DATABASE_URL") */
  connection_ref: string;
  /** Resolved hostname after env var lookup; null if unresolvable */
  resolved_host?: string | null;
  /** All locations where this connection is configured */
  locations: TDMLocation[];
  /** Detection confidence */
  confidence: Confidence;
}

// ---------------------------------------------------------------------------
// Webhook — inbound or outbound webhook registrations
// ---------------------------------------------------------------------------

export interface TDMWebhook {
  /** "outbound_registration" = code registers a URL with a provider;
   *  "inbound_callback" = code exposes an endpoint that receives events */
  direction: "outbound_registration" | "inbound_callback";
  /** Target URL (for outbound) or path pattern (for inbound) */
  target_url: string;
  /** Provider slug if known, e.g. "stripe" */
  provider?: string;
  /** All locations where this webhook is configured */
  locations: TDMLocation[];
  /** Detection confidence */
  confidence: Confidence;
}

// ---------------------------------------------------------------------------
// TDM — the top-level manifest
// ---------------------------------------------------------------------------

export interface TDM {
  /** TDM schema version, e.g. "1.0" */
  version: string;
  /** Scan context and statistics */
  metadata: TDMMetadata;
  /** Third-party library declarations */
  packages: TDMPackage[];
  /** Outbound HTTP API calls */
  apis: TDMAPI[];
  /** SDK usages */
  sdks: TDMSDK[];
  /** Direct infrastructure connections */
  infrastructure: TDMInfrastructure[];
  /** Webhook registrations and callbacks */
  webhooks: TDMWebhook[];
}
