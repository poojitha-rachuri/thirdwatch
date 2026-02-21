# TDM Specification

> The canonical machine-readable spec is `schema/v1/tdm.schema.json`.
> This document explains the design rationale and field semantics.

## What is a TDM?

A **Thirdwatch Dependency Manifest (TDM)** is a machine-readable inventory of every external
dependency detected in a codebase — packages declared in manifests, HTTP APIs called at runtime,
SDKs imported, infrastructure connections, and webhooks registered or received.

It is to external APIs what `package.json` / `requirements.txt` is to package dependencies:
a single, versionable, diffable source of truth.

## Design Goals

1. **Minimal required fields** — Every field that can be absent is optional. The scanner emits what it can detect; consumers handle missing fields gracefully.

2. **Confidence-first** — Every entry carries a `confidence` field (`high | medium | low`). Consumers must account for uncertainty.

3. **Location-anchored** — Every entry has a `locations` array pointing to the exact files and line numbers. This enables precise change attribution.

4. **Append-only additions** — New optional fields are non-breaking. Removals and type changes require a `MAJOR` version bump and a schema changelog entry.

5. **Open standard** — Schema is Apache 2.0 licensed. Any tool can produce or consume TDM files.

## Schema Version

The `version` field follows `MAJOR.MINOR` format (e.g., `"1.0"`). The current version is `1.0`.

- **MINOR** bump: new optional fields added (backwards-compatible)
- **MAJOR** bump: required fields added, fields removed, or type changes

## Top-Level Structure

```
TDM
├── version: "1.0"          — Schema version (MAJOR.MINOR)
├── metadata: TDMMetadata   — Scan context
├── packages: TDMPackage[]  — Manifest-declared packages
├── apis: TDMAPI[]          — Outbound HTTP API calls
├── sdks: TDMSDK[]          — Provider SDK usages
├── infrastructure: TDMInfrastructure[]  — DB/queue/storage connections
└── webhooks: TDMWebhook[]  — Webhook registrations and callbacks
```

## Entity Reference

### TDMMetadata

Describes the scan that produced this manifest.

| Field | Type | Required | Description |
|---|---|---|---|
| `schema_version` | string | ✅ | TDM schema version, e.g. `"1.0"` |
| `scan_timestamp` | string (ISO 8601) | ✅ | When the scan completed |
| `scanner_version` | string | ✅ | thirdwatch CLI semver |
| `repository` | string | — | Repository identifier, e.g. `"github.com/acme/payments"` |
| `languages_detected` | string[] | ✅ | Languages detected during scan |
| `total_dependencies_found` | integer ≥ 0 | ✅ | Total unique dependency entries |
| `scan_duration_ms` | integer ≥ 0 | ✅ | Wall-clock scan time |

### TDMLocation

Points to a specific file location where a dependency was detected.

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | string | ✅ | Relative path from scan root |
| `line` | integer ≥ 1 | ✅ | 1-indexed line number |
| `context` | string | — | Short code snippet for human readability |
| `usage` | string | — | Usage kind, e.g. `"import"`, `"method_call:stripe.Charge.create"` |

### TDMPackage

A third-party library declared in a package manifest (`package.json`, `requirements.txt`, etc.).

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | ✅ | Package name, e.g. `"stripe"` |
| `ecosystem` | string | ✅ | `npm`, `pypi`, `go`, `maven`, `rubygems`, or custom |
| `current_version` | string | ✅ | Installed / resolved version |
| `version_constraint` | string | — | Constraint as written in manifest, e.g. `"^7.0.0"` |
| `manifest_file` | string | ✅ | Path to the manifest, e.g. `"requirements.txt"` |
| `locations` | TDMLocation[] (min 1) | ✅ | Where this package is declared |
| `usage_count` | integer ≥ 0 | ✅ | Number of import/use sites detected |
| `confidence` | Confidence | ✅ | Detection confidence |

### TDMAPI

An outbound HTTP API call detected in source code.

| Field | Type | Required | Description |
|---|---|---|---|
| `url` | string | ✅ | Literal URL or template, e.g. `"${BASE_URL}/v2/users"` |
| `method` | string | — | HTTP verb, e.g. `"GET"`, `"POST"` |
| `provider` | string \| null | — | Auto-detected provider slug; `null` when unknown |
| `resolved_url` | string | — | URL after environment variable resolution |
| `headers` | string[] | — | Header name patterns found at the call site |
| `locations` | TDMLocation[] (min 1) | ✅ | Where this call appears |
| `usage_count` | integer ≥ 0 | ✅ | Number of call sites |
| `confidence` | Confidence | ✅ | Detection confidence |

### TDMSDK

A provider SDK imported and used in source code.

| Field | Type | Required | Description |
|---|---|---|---|
| `provider` | string | ✅ | Provider slug, e.g. `"aws"`, `"stripe"`, `"openai"` |
| `sdk_package` | string | ✅ | Package name, e.g. `"boto3"`, `"@aws-sdk/client-s3"` |
| `services_used` | string[] | — | Sub-services, e.g. `["s3", "sqs"]` for AWS |
| `api_methods` | string[] | — | Specific API methods called |
| `locations` | TDMLocation[] (min 1) | ✅ | Import and instantiation locations |
| `usage_count` | integer ≥ 0 | ✅ | Total method call count |
| `confidence` | Confidence | ✅ | Detection confidence |

### TDMInfrastructure

A direct infrastructure connection (database, message queue, object storage).

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | string | ✅ | `postgresql`, `mysql`, `mongodb`, `redis`, `kafka`, `sqs`, `s3`, etc. |
| `connection_ref` | string | ✅ | Raw connection reference (often an env var name) |
| `resolved_host` | string \| null | — | Resolved hostname; `null` if unresolvable |
| `locations` | TDMLocation[] (min 1) | ✅ | Where the connection is established |
| `confidence` | Confidence | ✅ | Detection confidence |

### TDMWebhook

A webhook registration (outbound) or inbound callback endpoint.

| Field | Type | Required | Description |
|---|---|---|---|
| `direction` | `"outbound_registration"` \| `"inbound_callback"` | ✅ | Whether code registers a URL or exposes an endpoint |
| `target_url` | string | ✅ | Target URL (outbound) or path pattern (inbound) |
| `provider` | string | — | Provider slug if known, e.g. `"stripe"` |
| `locations` | TDMLocation[] (min 1) | ✅ | Where the webhook is registered or handled |
| `confidence` | Confidence | ✅ | Detection confidence |

### Confidence Enum

| Value | Meaning |
|---|---|
| `"high"` | Detected from a direct, unambiguous pattern (explicit import, literal URL) |
| `"medium"` | Inferred with reasonable certainty (env var pattern, known SDK method) |
| `"low"` | Heuristic or pattern-matched; manual verification recommended |

## Versioning Policy

| Change Type | Version Impact | Example |
|---|---|---|
| New optional field added | MINOR | Adding `resolved_url` to TDMAPI |
| Required field added | MAJOR | Adding `id` as required to all entities |
| Field removed | MAJOR | Removing `version_constraint` from TDMPackage |
| Type narrowed | MAJOR | Changing `provider: string` to `provider: ProviderSlug` |
| Enum value added | MINOR | Adding `"bun"` to ecosystem |
| Enum value removed | MAJOR | Removing `"inbound_callback"` from direction |

## Comparison with SBOM Standards

| Feature | SPDX | CycloneDX | TDM |
|---|---|---|---|
| Focus | Package inventory | Package + vulnerability | External API/SDK/infra usage |
| Runtime API call detection | No | No | ✅ |
| HTTP URL tracking | No | No | ✅ |
| Env var connection mapping | No | No | ✅ |
| Webhook detection | No | No | ✅ |
| Confidence scoring | No | Partial | ✅ |
| JSON Schema (2020-12) | No | Yes | ✅ |

TDM complements SPDX/CycloneDX — it does not replace them. A future integration could
embed a TDM reference inside a CycloneDX manifest.

## Examples

- `schema/v1/examples/payment-service.tdm.json` — Python payments service (Stripe + AWS + PostgreSQL + Redis)
- `schema/v1/examples/node-api.tdm.json` — Node.js API (AWS SDK v3 + OpenAI + PostgreSQL + Redis)

## Extending the Schema

To add fields for a future version:

1. Add the field as **optional** in `schema/v1/tdm.schema.json` (MINOR bump)
2. Add the field as **optional** in `packages/tdm/src/types.ts`
3. Update examples if the field is commonly populated
4. Document in this file under the relevant entity
5. Add a changelog entry in `schema/CHANGELOG.md`

To add a **required** field, create a new schema version directory (`schema/v2/`) and bump
`TDM_SCHEMA_VERSION` in `packages/tdm/src/types.ts`.
