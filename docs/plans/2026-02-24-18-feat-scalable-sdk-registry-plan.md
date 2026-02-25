---
title: "feat: Scalable SDK Registry — Thousands of Providers Without Manual Code"
type: feat
phase: 1–2 (Registry v2 in Phase 1, auto-generation in Phase 2)
date: 2026-02-24
priority: P0
dependencies: Plan 4 (Detectors), Plans 12–15 (Language Analyzers)
package: registries/, packages/core
---

# feat: Scalable SDK Registry — Thousands of Providers Without Manual Code

## Overview

Scale the Thirdwatch SDK registry from 14 hand-written YAML files to 1,000+ providers without writing code for each one. The core insight: **detection logic should be DATA-DRIVEN (registry YAML), not CODE-DRIVEN (hardcoded maps)**. Today, the Python analyzer has a hardcoded `SDK_PROVIDERS` map and the JS analyzer has a hardcoded `SDK_CONSTRUCTORS` map. Both must be replaced by a single registry-driven detection engine that reads patterns from YAML.

## Problem Statement

The current architecture has two fatal scaling problems:

1. **Hardcoded detection maps**: Every SDK requires code changes in the analyzer. Adding a new provider means editing `analyzer.ts` in every language plugin. This doesn't scale past ~20 providers.

2. **14 YAML files that are barely used**: The registry YAML files exist but the analyzers largely ignore them — they use their own hardcoded maps instead. The registry is decorative, not functional.

There are 500+ popular SaaS APIs (Stripe, Twilio, Plaid, Segment, LaunchDarkly, PagerDuty, ...) and 2,000+ widely-used packages across npm/PyPI/crates.io/Maven that should be auto-detected. Manual YAML authoring for each is unsustainable.

## Proposed Solution

A four-tier detection architecture where each tier catches providers the previous tier missed:

```
Tier 1: Curated YAML Registry (500+ providers)
  ↓ not found
Tier 2: Package Metadata Inference (auto-detect from npm/PyPI metadata)
  ↓ not found
Tier 3: Convention-Based Detection (pattern matching on names/URLs)
  ↓ not found
Tier 4: Generic dependency (captured without provider attribution)
```

## Technical Approach

### Step 0: Make Registry the SOLE Source of Truth

Remove ALL hardcoded SDK maps from analyzer code. Replace with a registry lookup:

```typescript
// packages/core/src/registry.ts — the single lookup interface

export interface SDKRegistryEntry {
  provider: string;
  display_name: string;
  homepage?: string;
  changelog_url?: string;
  patterns: {
    npm?: SDKPatternEntry[];
    pypi?: SDKPatternEntry[];
    go?: SDKPatternEntry[];
    maven?: SDKPatternEntry[];
    cargo?: SDKPatternEntry[];
    packagist?: SDKPatternEntry[];
  };
  constructors?: Record<string, ConstructorPattern[]>;
  factories?: Record<string, string[]>;
  known_api_base_urls?: string[];
  env_var_patterns?: string[];
}

export interface SDKPatternEntry {
  package: string;
  import_patterns?: string[];
}

export interface ConstructorPattern {
  name: string;
  services_field?: string; // e.g., first argument is service name
}

// Build lookup maps from registry at scan startup
export function buildPackageProviderMap(
  registry: SDKRegistryEntry[],
  ecosystem: string,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of registry) {
    const patterns = entry.patterns[ecosystem as keyof typeof entry.patterns];
    if (!patterns) continue;
    for (const p of patterns) {
      map.set(p.package, entry.provider);
    }
  }
  return map;
}

export function buildConstructorProviderMap(
  registry: SDKRegistryEntry[],
  ecosystem: string,
): Map<string, [string, string]> {
  const map = new Map<string, [string, string]>();
  for (const entry of registry) {
    const ctors = entry.constructors?.[ecosystem];
    if (!ctors) continue;
    for (const ctor of ctors) {
      map.set(ctor.name, [entry.provider, entry.patterns[ecosystem as keyof typeof entry.patterns]?.[0]?.package ?? entry.provider]);
    }
  }
  return map;
}
```

Then in each analyzer:

```typescript
// packages/languages/python/src/analyzer.ts — BEFORE (hardcoded)
const SDK_PROVIDERS: Record<string, string> = {
  boto3: "aws",
  stripe: "stripe",
  openai: "openai",
  // ... 11 more hardcoded entries
};

// packages/languages/python/src/analyzer.ts — AFTER (registry-driven)
import { loadSDKRegistry, buildPackageProviderMap } from "@thirdwatch/core";

const registry = await loadSDKRegistry();
const SDK_PROVIDERS = buildPackageProviderMap(registry, "pypi");
// Now contains 500+ mappings from YAML, zero hardcoded entries
```

### Registry Schema v2

Expanded schema to support all languages and detection patterns:

```yaml
# registries/sdks/stripe.yml (v2)
provider: stripe
display_name: "Stripe"
homepage: "https://stripe.com"
changelog_url: "https://stripe.com/docs/changelog"

patterns:
  npm:
    - package: "stripe"
      import_patterns: ["stripe", "Stripe"]
    - package: "@stripe/stripe-js"
  pypi:
    - package: "stripe"
      import_patterns: ["import stripe", "from stripe"]
  go:
    - package: "github.com/stripe/stripe-go"
  maven:
    - package: "com.stripe:stripe-java"
  cargo:
    - package: "stripe-rust"
  packagist:
    - package: "stripe/stripe-php"

constructors:
  npm:
    - name: "Stripe"
  pypi:
    - name: "stripe.Charge"
    - name: "stripe.PaymentIntent"
  java:
    - name: "Stripe.apiKey"
    - name: "Charge.create"
    - name: "PaymentIntent.create"

factories:
  go: ["stripe.New", "charge.New", "paymentintent.New"]

known_api_base_urls:
  - "https://api.stripe.com"
  - "https://files.stripe.com"

env_var_patterns:
  - "STRIPE_API_KEY"
  - "STRIPE_SECRET_KEY"
  - "STRIPE_PUBLISHABLE_KEY"
  - "STRIPE_WEBHOOK_SECRET"
```

### Registry JSON Schema Validation

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["provider", "display_name", "patterns"],
  "properties": {
    "provider": { "type": "string", "pattern": "^[a-z0-9-]+$" },
    "display_name": { "type": "string" },
    "patterns": {
      "type": "object",
      "properties": {
        "npm": { "$ref": "#/$defs/patternList" },
        "pypi": { "$ref": "#/$defs/patternList" },
        "go": { "$ref": "#/$defs/patternList" },
        "maven": { "$ref": "#/$defs/patternList" },
        "cargo": { "$ref": "#/$defs/patternList" },
        "packagist": { "$ref": "#/$defs/patternList" }
      }
    }
  }
}
```

### Tier 1: Curated Registry Expansion

Auto-generate the initial 500+ entries from a seed list:

```typescript
// scripts/generate-registry/seed-providers.ts

const SEED_PROVIDERS = [
  // Payments
  { provider: "stripe", npm: "stripe", pypi: "stripe" },
  { provider: "paypal", npm: "@paypal/checkout-server-sdk", pypi: "paypalrestsdk" },
  { provider: "square", npm: "square", pypi: "squareup" },
  { provider: "braintree", npm: "braintree", pypi: "braintree" },
  { provider: "adyen", npm: "@adyen/api-library", pypi: "Adyen" },
  { provider: "plaid", npm: "plaid", pypi: "plaid-python" },
  // Auth
  { provider: "auth0", npm: "auth0", pypi: "auth0-python" },
  { provider: "okta", npm: "@okta/okta-sdk-nodejs", pypi: "okta" },
  { provider: "clerk", npm: "@clerk/clerk-sdk-node" },
  // Monitoring
  { provider: "datadog", npm: "dd-trace", pypi: "ddtrace" },
  { provider: "newrelic", npm: "newrelic", pypi: "newrelic" },
  { provider: "pagerduty", npm: "@pagerduty/pdjs", pypi: "pdpyras" },
  // Analytics
  { provider: "segment", npm: "analytics-node", pypi: "analytics-python" },
  { provider: "mixpanel", npm: "mixpanel", pypi: "mixpanel" },
  { provider: "amplitude", npm: "@amplitude/analytics-node", pypi: "amplitude-analytics" },
  // Feature flags
  { provider: "launchdarkly", npm: "@launchdarkly/node-server-sdk", pypi: "launchdarkly-server-sdk" },
  { provider: "split", npm: "@splitsoftware/splitio", pypi: "splitio" },
  // ... 480+ more
];
```

### Tier 2: Package Metadata Inference

For packages NOT in the registry, fetch metadata from the package registry and infer a provider:

```typescript
// packages/core/src/registry-inference.ts

export async function inferProvider(
  packageName: string,
  ecosystem: string,
): Promise<string | null> {
  const metadata = await fetchPackageMetadata(packageName, ecosystem);
  if (!metadata) return null;

  // Strategy 1: Extract domain from homepage URL
  if (metadata.homepage) {
    const domain = new URL(metadata.homepage).hostname.replace("www.", "");
    const slug = domain.split(".")[0]!;
    if (slug && slug.length > 2 && slug !== "github" && slug !== "npmjs") {
      return slug;
    }
  }

  // Strategy 2: Match keywords against known providers
  const keywords = metadata.keywords ?? [];
  for (const keyword of keywords) {
    if (KNOWN_PROVIDER_SLUGS.has(keyword.toLowerCase())) {
      return keyword.toLowerCase();
    }
  }

  // Strategy 3: Extract from package name
  // @stripe/stripe-js → stripe
  // @aws-sdk/client-s3 → aws
  // sendgrid-mail → sendgrid
  const nameSlug = extractProviderFromName(packageName);
  if (nameSlug) return nameSlug;

  return null;
}

function extractProviderFromName(name: string): string | null {
  // Scoped packages: @provider/package
  const scopeMatch = name.match(/^@([^/]+)\//);
  if (scopeMatch) {
    const scope = scopeMatch[1]!;
    if (KNOWN_PROVIDER_SLUGS.has(scope)) return scope;
  }

  // Hyphenated: provider-sdk, provider-client
  const parts = name.split(/[-_]/);
  if (parts.length >= 2) {
    const first = parts[0]!;
    if (KNOWN_PROVIDER_SLUGS.has(first)) return first;
  }

  return null;
}

async function fetchPackageMetadata(
  name: string,
  ecosystem: string,
): Promise<PackageMetadata | null> {
  switch (ecosystem) {
    case "npm": {
      const res = await fetch(`https://registry.npmjs.org/${name}`, {
        headers: { Accept: "application/vnd.npm.install-v1+json" },
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) return null;
      const data = await res.json() as Record<string, unknown>;
      return {
        homepage: data.homepage as string | undefined,
        keywords: data.keywords as string[] | undefined,
        description: data.description as string | undefined,
      };
    }
    case "pypi": {
      const res = await fetch(`https://pypi.org/pypi/${name}/json`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) return null;
      const data = await res.json() as Record<string, unknown>;
      const info = data.info as Record<string, unknown>;
      return {
        homepage: info.home_page as string | undefined,
        keywords: (info.keywords as string | undefined)?.split(",").map((k: string) => k.trim()),
        description: info.summary as string | undefined,
      };
    }
    default:
      return null;
  }
}
```

Caching strategy:

```typescript
// Cache inferred providers locally to avoid repeated API calls
// .thirdwatch-cache/providers.json
{
  "npm:@sendgrid/mail": { "provider": "sendgrid", "inferred_at": "2026-02-24T..." },
  "pypi:plaid-python": { "provider": "plaid", "inferred_at": "2026-02-24T..." }
}
```

### Tier 3: Convention-Based Detection

For packages with no registry entry and no fetchable metadata (offline mode, private packages), use naming conventions:

```typescript
// packages/core/src/registry-conventions.ts

export function detectByConvention(
  packageName: string,
  source: string,
): { provider: string; confidence: Confidence } | null {
  // Convention 1: Package name contains known brand
  for (const brand of KNOWN_BRANDS) {
    if (packageName.toLowerCase().includes(brand)) {
      return { provider: brand, confidence: "medium" };
    }
  }

  // Convention 2: Code references known API domains
  const domainMatch = source.match(/https?:\/\/([\w-]+\.)*(\w+)\.(com|io|dev|ai)\//g);
  if (domainMatch) {
    for (const url of domainMatch) {
      const domain = new URL(url).hostname;
      if (API_DOMAIN_TO_PROVIDER.has(domain)) {
        return { provider: API_DOMAIN_TO_PROVIDER.get(domain)!, confidence: "medium" };
      }
    }
  }

  // Convention 3: Client constructor pattern (any new XxxClient())
  const clientMatch = source.match(/new\s+(\w+)Client\s*\(/g);
  if (clientMatch) {
    // Captured as generic SDK with low confidence
    return { provider: "unknown", confidence: "low" };
  }

  return null;
}

const API_DOMAIN_TO_PROVIDER = new Map([
  ["api.stripe.com", "stripe"],
  ["api.openai.com", "openai"],
  ["api.anthropic.com", "anthropic"],
  ["api.twilio.com", "twilio"],
  ["api.sendgrid.com", "sendgrid"],
  ["s3.amazonaws.com", "aws"],
  ["sqs.amazonaws.com", "aws"],
  // ... 200+ domain mappings
]);
```

### Community Contribution Workflow

Make it trivial for anyone to add a provider:

1. **PR template**: `.github/PULL_REQUEST_TEMPLATE/add-sdk.md` with a checklist
2. **Validation CI**: GitHub Action validates every YAML against the JSON Schema
3. **Auto-test**: CI runs `thirdwatch scan` on fixture that uses the new SDK
4. **Auto-publish**: On merge to main, publish updated `@thirdwatch/registry` package

```yaml
# .github/workflows/validate-registry.yml
name: Validate SDK Registry
on:
  pull_request:
    paths: ['registries/sdks/*.yml']

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx ajv validate -s schema/registry.schema.json -d 'registries/sdks/*.yml'
      - run: pnpm test --filter @thirdwatch/core -- --grep "registry"
```

### Published Registry Package

```json
// packages/registry/package.json
{
  "name": "@thirdwatch/registry",
  "version": "0.1.0",
  "description": "SDK provider registry for Thirdwatch",
  "main": "dist/index.js",
  "files": ["dist", "sdks/*.yml"]
}
```

The CLI can use a bundled version (offline) and optionally fetch the latest:

```typescript
// packages/core/src/registry.ts
export async function loadSDKRegistry(): Promise<SDKRegistryEntry[]> {
  // 1. Try to load from @thirdwatch/registry (latest published)
  // 2. Fall back to bundled registries/sdks/ directory
  // 3. Never fail — return empty array if both fail
}
```

## Implementation Phases

### Phase 18.1: Registry-Driven Detection
- Remove ALL hardcoded `SDK_PROVIDERS`, `SDK_CONSTRUCTORS`, `SDK_FACTORIES` from Python and JS analyzers
- Replace with `buildPackageProviderMap()` and `buildConstructorProviderMap()` from registry
- Verify zero test regressions — same detection, driven by YAML instead of code
- This is the critical architectural change

### Phase 18.2: Registry Schema v2
- Define JSON Schema for registry v2 format
- Migrate all 14 existing YAML files to v2 (add `constructors`, `factories`, multi-ecosystem patterns)
- CI validation pipeline

### Phase 18.3: Curated Expansion (100 → 500)
- Write auto-generation script that takes seed list → produces YAML files
- Generate 500+ provider YAML files from seed list + npm/PyPI metadata
- Manual review of top 50 providers for accuracy

### Phase 18.4: Package Metadata Inference
- Implement `inferProvider()` with npm and PyPI fetchers
- Implement local cache (`.thirdwatch-cache/providers.json`)
- Wire into scan pipeline: when a manifest package isn't in registry, infer
- Test: unknown packages get provider inference

### Phase 18.5: Convention-Based Detection
- Implement `detectByConvention()` with brand matching and API domain matching
- Build `API_DOMAIN_TO_PROVIDER` map (200+ domains)
- Wire as lowest-priority fallback

### Phase 18.6: Community + Publishing
- Create PR template for SDK additions
- Create CI validation workflow
- Publish `@thirdwatch/registry` as independently versioned npm package
- Document contribution guide in `registries/sdks/README.md`

## Acceptance Criteria

- [ ] Zero hardcoded SDK maps remain in any analyzer — all driven by registry YAML
- [ ] Existing 14 providers produce identical detection results after migration (zero regression)
- [ ] 500+ provider YAML files exist and pass JSON Schema validation
- [ ] A new provider can be added with only a YAML file — no code changes required
- [ ] Package metadata inference correctly identifies `@sendgrid/mail` → `sendgrid`
- [ ] Convention detection catches `https://api.stripe.com` in code → provider `stripe`
- [ ] Offline mode works (bundled registry, no network calls)
- [ ] Registry CI validates YAML on every PR to `registries/sdks/`
- [ ] `@thirdwatch/registry` published to npm and usable independently

## File Inventory

| File | Description |
|---|---|
| `packages/core/src/registry.ts` | Registry loader + lookup maps (expanded) |
| `packages/core/src/registry-inference.ts` | Package metadata inference engine |
| `packages/core/src/registry-conventions.ts` | Convention-based fallback detection |
| `schema/registry.schema.json` | JSON Schema for registry v2 |
| `registries/sdks/*.yml` | 500+ provider YAML files |
| `registries/sdks/README.md` | Contribution guide |
| `scripts/generate-registry/seed-providers.ts` | Auto-generation seed list |
| `scripts/generate-registry/generate.ts` | YAML generator from seed + metadata |
| `.github/workflows/validate-registry.yml` | CI validation |
| `.github/PULL_REQUEST_TEMPLATE/add-sdk.md` | PR template for new providers |

## References

- [npm registry API](https://github.com/npm/registry/blob/main/docs/REGISTRY-API.md)
- [PyPI JSON API](https://warehouse.pypa.io/api-reference/json.html)
- [crates.io API](https://crates.io/policies)
- [JSON Schema](https://json-schema.org/)
- [AJV — JSON Schema validator](https://ajv.js.org/)
