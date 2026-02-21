# TDM Specification

> Full specification lives in `schema/v1/tdm.schema.json`. This document explains the design rationale.

## What is a TDM?

A **Thirdwatch Dependency Manifest (TDM)** is a machine-readable inventory of all external dependencies
detected in a codebase — APIs called, SDKs used, infrastructure connected to, webhooks received, and
environment variables referencing third-party services.

It is to external APIs what `package.json` / `requirements.txt` is to package dependencies:
a single, versionable, diffable source of truth.

## Design Goals

1. **Stable IDs** — Every `Dependency` and `Usage` has an `id` field. This enables reliable diffing between scans (e.g., "what changed since last week?") even if line numbers shift.

2. **Open standard** — The schema is Apache 2.0 licensed. Any tool can produce or consume TDM files.

3. **Actionable** — Each usage pinpoints the exact file + line where a dependency is used.

4. **Extensible** — The `metadata` field on `Dependency` carries provider-specific data from the registry without breaking the core schema.

## Schema Summary

```
TDM
├── schemaVersion: "1.0"
├── generatedAt: ISO 8601 timestamp
├── scanner: { name, version }
├── project: { id, name, root, vcsRevision }
└── dependencies: Dependency[]

Dependency
├── id: string            (stable, e.g., "dep_stripe_sdk_python")
├── type: sdk | http_api | package | infrastructure | webhook
├── provider: string      (matches registries/sdks/<slug>.yml)
├── displayName: string
├── packageName: string
├── packageVersion: string
├── language: python | javascript | typescript | ...
├── confidence: 0.0–1.0
├── usages: Usage[]
└── metadata: object

Usage
├── id: string            (stable, e.g., "use_stripe_import_42")
├── file: string          (relative path)
├── line: integer         (1-indexed)
├── column: integer       (0-indexed)
├── kind: import | http_call | instantiation | env_var | config_key
├── snippet: string       (max 200 chars)
├── url?: string          (for http_call)
└── method?: string       (for http_call: GET, POST, ...)
```

## ID Generation

IDs must be:
- Deterministic (same inputs → same ID across runs)
- Human-readable (help debugging)
- Stable across minor code changes

Recommended format: `dep_<provider>_<type>_<language>` for dependencies,
`use_<provider>_<kind>_<line>` for usages. The scanner may use hashing for uniqueness
when multiple instances exist.

## Comparison with SBOM Standards

| Feature | SPDX | CycloneDX | TDM |
|---|---|---|---|
| Focus | Package inventory | Package + vulnerability | External API/SDK usage |
| Runtime behavior | No | No | Yes (usage location) |
| API call detection | No | No | Yes |
| HTTP URL tracking | No | No | Yes |
| Env var mapping | No | No | Yes |
| Diff-friendly IDs | No | No | Yes (by design) |

TDM complements SPDX/CycloneDX — it does not replace them. A future integration could
embed a TDM reference inside a CycloneDX manifest.

## Example

See `schema/v1/examples/stripe-python.tdm.json` for a complete example.
