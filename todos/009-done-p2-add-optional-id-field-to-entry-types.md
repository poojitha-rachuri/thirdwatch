---
status: pending
priority: p2
issue_id: "009"
tags: [code-review, architecture, schema, diffing]
dependencies: []
---

# Add Optional `id?: string` Field to All TDM Entry Types

## Problem Statement

Every TDM entry type (`TDMPackage`, `TDMAPI`, `TDMSDK`, `TDMInfrastructure`, `TDMWebhook`) lacks a **stable identifier**. The CI Gate (Plan 11) and Watcher (Plan 07) must diff TDMs across scans. Without IDs, they must reconstruct identity from composite natural keys:

- Package: `(name, ecosystem, manifest_file)` — breaks if package moves between manifest files
- API: `(url, method)` — breaks if URL template format changes
- SDK: `(provider, sdk_package)` — ambiguous when multiple SDK packages share a provider

The window for adding IDs as a non-breaking optional field is **closing**: once Plan 03 (Scanner) produces TDMs and Plan 07 (Watcher) is built around composite key diffing, retrofitting IDs requires a migration.

ADR 003 explicitly noted this requirement: "Adding an `id` field to every TDM entity makes `tdm diff old.json new.json` possible — the CI gate (Plan 11) depends on this."

The discarded `stripe-python.tdm.json` example (old design) had per-entry IDs like `"dep_stripe_sdk_python"` — this was a deliberate design choice that got dropped.

## Findings

- Architecture reviewer: "Waiting until Plan 11 (CI Gate) is too late"
- PURL spec (`pkg:pypi/stripe@7.0.0`) provides a community-standard format for packages
- Adding optional fields is a MINOR version change — non-breaking

## Proposed Solutions

### Option A — Add `id?: string` as optional to all five types (Recommended)

```typescript
// types.ts
export interface TDMPackage {
  id?: string;  // e.g., "pkg:pypi/stripe@7.0.0" (PURL format)
  name: string;
  // ...
}

export interface TDMAPI {
  id?: string;  // e.g., "api:stripe/https://api.stripe.com/v1/charges"
  url: string;
  // ...
}
```

Recommended ID formats per type:
| Type | Format | Example |
|---|---|---|
| TDMPackage | `pkg:{ecosystem}/{name}@{version}` (PURL) | `pkg:pypi/stripe@7.0.0` |
| TDMAPI | `api:{provider\|"unknown"}/{normalized_url_hash}` | `api:stripe/charges-post` |
| TDMSDK | `sdk:{provider}/{sdk_package}` | `sdk:aws/boto3` |
| TDMInfrastructure | `infra:{type}/{connection_ref}` | `infra:postgresql/DATABASE_URL` |
| TDMWebhook | `webhook:{direction}/{target_url_hash}` | `webhook:outbound/stripe-endpoint` |

- Pros: Non-breaking (optional); enables stable diffing; follows community standard (PURL) for packages
- Cons: Scanner must be updated to generate IDs (Plan 03 work)
- Effort: Small (schema change) + Medium (scanner) | Risk: Low

### Option B — Define IDs per type as deterministic compound keys
Encode the natural key deterministically as the ID. Simpler to implement in scanner.
- Effort: Small | Risk: Low

## Recommended Action

Option A. Add the field now as `id?: string` with documented format recommendations. Scanner implementation is a Plan 03 concern.

## Acceptance Criteria

- [ ] `id?: string` added to `TDMPackage`, `TDMAPI`, `TDMSDK`, `TDMInfrastructure`, `TDMWebhook` in `types.ts`
- [ ] `id` property added to all `$defs` in embedded `TDM_SCHEMA` and `tdm.schema.json`
- [ ] `tdm-spec.md` documents recommended ID format per entity type
- [ ] Example files updated with example IDs
- [ ] Test: TDM with `id` fields passes `parseTDM` validation

## Work Log

- 2026-02-21: Found during architecture review of PR #1; old stripe-python.tdm.json had this design
