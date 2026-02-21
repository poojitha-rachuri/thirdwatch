---
title: "feat: Change Classification Engine"
type: feat
phase: 2 — The Pulse
date: 2026-02-21
priority: P0 (Phase 2)
dependencies: Plan 7 (Watcher Monitoring Engine)
package: packages/watcher (classification module)
---

# feat: Change Classification Engine

## Overview

Every raw change event emitted by the Watcher (new npm version, new GitHub release) must be classified before it's useful. A `6.0.0` semver bump is only a "breaking" event if the changelog says so — otherwise it might be a large refactor with no public API changes. This plan builds the Classification Engine: a two-tier system that uses structured rules for deterministic cases (semver, OpenAPI diffs) and an optional LLM classifier for unstructured changelog prose. The LLM tier is opt-in — the system must function correctly without it.

## Problem Statement

Without classification, every change event is noise. Routing every `patch` update to the same alert channel as a `breaking` API removal creates alert fatigue and destroys trust in the tool. The classifier's output directly determines what reaches the notifier — getting it wrong in either direction (false positive on critical, missed true positive on breaking) is the core failure mode of the product.

## Proposed Solution

A layered classification pipeline:
1. **Semver Classifier** — deterministic. `major` bump = potential breaking. `patch` = safe. Always runs.
2. **Keyword Heuristics Classifier** — fast regex/keyword scan of changelog text. Catches "BREAKING CHANGE", "deprecated", "removed", "end of life". Always runs.
3. **OpenAPI Diff Classifier** — if a provider has a known OpenAPI spec URL, diff old vs new spec. Always runs when applicable.
4. **LLM Classifier** — sends changelog prose to an AI model for nuanced analysis. Optional, off by default.

Final classification is the highest-severity result across all tiers that fired.

## Technical Approach

### Classification Types (from PRD)

```typescript
// Already defined in @thirdwatch/tdm
export type ChangeCategory =
  | "breaking"       // Removed endpoint, removed field, changed auth, incompatible schema
  | "deprecation"    // Announced deprecation timeline, sunset header, deprecated field
  | "major-update"   // Major version bump, significant new functionality
  | "minor-update"   // Minor version bump, non-breaking additions
  | "patch"          // Bug fix, security patch
  | "security"       // CVE, security advisory
  | "informational"; // Docs change, status update

export type Priority = "P0" | "P1" | "P2" | "P3" | "P4";
```

### Classification Pipeline (`packages/watcher/src/classification/pipeline.ts`)

```typescript
// packages/watcher/src/classification/pipeline.ts

export interface ClassificationInput {
  dependency: WatchedDependency;
  previousVersion?: string;
  newVersion?: string;
  changelogText?: string;       // Full release notes / changelog entry
  openApiDiff?: OpenApiDiff;    // If available
}

export interface ClassificationResult {
  category: ChangeCategory;
  confidence: "high" | "medium" | "low";
  reasoning: string;            // Human-readable explanation
  classifierUsed: "semver" | "keywords" | "openapi-diff" | "llm" | "combined";
}

export async function classifyChange(
  input: ClassificationInput,
  config: ClassificationConfig
): Promise<ClassificationResult> {
  const results: ClassificationResult[] = [];

  // Tier 1: always run semver
  results.push(classifyBySemver(input));

  // Tier 2: always run keywords if changelog text available
  if (input.changelogText) {
    results.push(classifyByKeywords(input.changelogText));
  }

  // Tier 3: OpenAPI diff if available
  if (input.openApiDiff) {
    results.push(classifyByOpenApiDiff(input.openApiDiff));
  }

  // Tier 4: LLM (optional, configured in .thirdwatch.yml)
  if (config.llm?.enabled && input.changelogText) {
    results.push(await classifyByLLM(input, config.llm));
  }

  // Return the highest-severity result
  return selectHighestSeverity(results);
}
```

### Tier 1: Semver Classifier

```typescript
// packages/watcher/src/classification/semver.ts
import semver from "semver";

export function classifyBySemver(input: ClassificationInput): ClassificationResult {
  const prev = input.previousVersion;
  const next = input.newVersion;
  if (!prev || !next) {
    return { category: "informational", confidence: "low", reasoning: "No version info", classifierUsed: "semver" };
  }

  const diff = semver.diff(prev, next);

  switch (diff) {
    case "major":
      return {
        category: "major-update",     // NOTE: semver alone can't confirm "breaking" — need keywords/LLM
        confidence: "medium",
        reasoning: `Major version bump: ${prev} → ${next}. Potential breaking changes.`,
        classifierUsed: "semver",
      };
    case "minor":
      return { category: "minor-update", confidence: "high", reasoning: `Minor: ${prev} → ${next}`, classifierUsed: "semver" };
    case "patch":
    case "prepatch":
    case "preminor":
      return { category: "patch", confidence: "high", reasoning: `Patch: ${prev} → ${next}`, classifierUsed: "semver" };
    default:
      return { category: "informational", confidence: "low", reasoning: "Could not parse semver diff", classifierUsed: "semver" };
  }
}
```

### Tier 2: Keyword Heuristics

```typescript
// packages/watcher/src/classification/keywords.ts

const BREAKING_PATTERNS = [
  /\bBREAKING[\s_-]*CHANGE\b/i,
  /\bremoved?\b.{0,50}\bendpoint\b/i,
  /\bdeprecated?\b.{0,50}\bremoved?\b/i,
  /\bnow requires?\b/i,
  /\bno longer supported?\b/i,
  /\bauth(entication)? changed?\b/i,
  /\bincompatible\b/i,
];

const DEPRECATION_PATTERNS = [
  /\bdeprecated?\b/i,
  /\bsunset\b/i,
  /\bend[\s-]of[\s-]life\b/i,
  /\bwill be removed\b/i,
];

const SECURITY_PATTERNS = [
  /\bCVE-\d{4}-\d+\b/,
  /\bsecurity (fix|patch|advisory|vulnerability)\b/i,
  /\bsecurity\b/i,
];

export function classifyByKeywords(text: string): ClassificationResult {
  if (BREAKING_PATTERNS.some(p => p.test(text))) {
    return {
      category: "breaking",
      confidence: "medium",
      reasoning: "Changelog contains breaking change language",
      classifierUsed: "keywords",
    };
  }
  if (SECURITY_PATTERNS.some(p => p.test(text))) {
    return {
      category: "security",
      confidence: "medium",
      reasoning: "Changelog references security advisory or CVE",
      classifierUsed: "keywords",
    };
  }
  if (DEPRECATION_PATTERNS.some(p => p.test(text))) {
    return { category: "deprecation", confidence: "medium", reasoning: "Changelog mentions deprecation", classifierUsed: "keywords" };
  }
  return { category: "informational", confidence: "high", reasoning: "No breaking/security patterns found", classifierUsed: "keywords" };
}
```

### Tier 3: OpenAPI Diff Classifier

```typescript
// packages/watcher/src/classification/openapi.ts
// Uses `@readme/openapi-parser` and custom diff logic
// (oasdiff is a Go binary — we implement a JS equivalent for key checks)

export interface OpenApiDiff {
  removedPaths: string[];           // e.g., ["/v1/charges"]
  addedPaths: string[];
  changedSchemas: SchemaDiff[];     // Fields removed or type-changed
  changedAuth: boolean;
  removedParameters: ParamDiff[];
}

export function classifyByOpenApiDiff(diff: OpenApiDiff): ClassificationResult {
  if (
    diff.removedPaths.length > 0 ||
    diff.changedAuth ||
    diff.changedSchemas.some(s => s.removedRequired) ||
    diff.removedParameters.some(p => p.wasRequired)
  ) {
    return {
      category: "breaking",
      confidence: "high",
      reasoning: `Breaking: removed paths [${diff.removedPaths.join(", ")}]`,
      classifierUsed: "openapi-diff",
    };
  }
  if (diff.addedPaths.length > 0 || diff.changedSchemas.some(s => s.addedOptional)) {
    return { category: "minor-update", confidence: "high", reasoning: "Non-breaking additions", classifierUsed: "openapi-diff" };
  }
  return { category: "patch", confidence: "medium", reasoning: "Spec changed but no breaking diffs found", classifierUsed: "openapi-diff" };
}
```

### Tier 4: LLM Classifier (Optional)

```typescript
// packages/watcher/src/classification/llm.ts

export async function classifyByLLM(
  input: ClassificationInput,
  config: LLMConfig
): Promise<ClassificationResult> {
  const prompt = buildClassificationPrompt(input);

  // Supports: Anthropic Claude, OpenAI GPT-4o, Ollama (local)
  const client = createLLMClient(config);
  const response = await client.complete(prompt, {
    schema: ClassificationResultSchema, // Structured output / JSON mode
    maxTokens: 500,
  });

  return {
    ...response,
    confidence: "medium",  // LLM results are always "medium" confidence
    classifierUsed: "llm",
  };
}

function buildClassificationPrompt(input: ClassificationInput): string {
  return `You are analyzing a software changelog entry to classify the type of change.

Dependency: ${input.dependency.identifier}
Previous version: ${input.previousVersion ?? "unknown"}
New version: ${input.newVersion ?? "unknown"}

Changelog text:
---
${input.changelogText}
---

Classify this change as one of: breaking, deprecation, major-update, minor-update, patch, security, informational.

A change is "breaking" only if it removes or renames existing functionality, changes required parameters, or makes code that worked before stop working. Version bumps alone do not make a change breaking.

Respond with JSON: { "category": "...", "reasoning": "one sentence explanation" }`;
}
```

### LLM Configuration (`.thirdwatch.yml`)

```yaml
# .thirdwatch.yml — LLM classification config
classification:
  llm:
    enabled: true
    provider: anthropic         # or "openai" or "ollama"
    model: claude-haiku-4-5-20251001  # Cheapest model for classification
    api_key_env: ANTHROPIC_API_KEY
    # Only call LLM for major version bumps (to reduce cost)
    trigger_on: ["major-update"]
```

### Priority Mapping (preliminary — full Analyzer in Plan 9)

```typescript
// packages/watcher/src/priority.ts
// Preliminary priority assignment before full Analyzer impact scoring

export function assignPreliminaryPriority(
  category: ChangeCategory,
  usageCount: number
): Priority {
  if (category === "security") return "P0";
  if (category === "breaking" && usageCount > 50) return "P0";
  if (category === "breaking") return "P1";
  if (category === "deprecation" && usageCount > 20) return "P1";
  if (category === "deprecation") return "P2";
  if (category === "major-update") return "P2";
  if (category === "minor-update") return "P3";
  return "P4";
}
```

### Test Strategy

Classification is a logic-heavy component — extensive unit tests with fixtures are essential for a correct, trustworthy system.

```
packages/watcher/src/classification/__tests__/
├── semver.test.ts          # 20+ test cases covering all semver diff types
├── keywords.test.ts        # Real changelog snippets from Stripe, AWS, OpenAI
├── openapi.test.ts         # Diff fixtures: removed endpoint, added field, etc.
├── llm.test.ts             # Mocked LLM calls (never real API in tests)
└── pipeline.test.ts        # End-to-end pipeline with all tiers
```

Changelog fixtures to include in `fixtures/changelogs/`:
- `stripe-2023-10-16-breaking.txt` — real Stripe breaking change announcement
- `openai-deprecation.txt` — OpenAI text-davinci deprecation notice
- `stripe-patch.txt` — typical minor Stripe patch release notes

## Implementation Phases

### Phase 8.1: Semver + Keywords
- Implement `classifyBySemver` with full test coverage
- Implement `classifyByKeywords` with real-world changelog fixtures as tests
- Wire both into `classifyChange` pipeline
- All tests passing

### Phase 8.2: OpenAPI Diff
- Implement `fetchOpenApiSpec(url)` with version tracking
- Implement `computeOpenApiDiff(prev, next)` covering removals, auth changes, schema changes
- Implement `classifyByOpenApiDiff`
- Test with fixture OpenAPI specs (Stripe, Petstore)

### Phase 8.3: LLM Classifier
- Implement multi-provider LLM client (Anthropic, OpenAI, Ollama)
- Implement structured output parsing with fallback to keyword parsing on failure
- Test: LLM tier is optional — system works without it
- Cost guardrail: only invoke LLM when other tiers return "medium" confidence on major+ changes

### Phase 8.4: Integration
- Wire classification into the Watcher job handler (after new version detected → classify → store result on `change_events.change_type`)
- Add `classification_confidence` and `classifier_used` columns to `change_events` table

## Acceptance Criteria

- [ ] `classifyChange` returns `"breaking"` with `"medium"` confidence for a `7.0.0 → 8.0.0` bump with "BREAKING CHANGE" in changelog
- [ ] `classifyChange` returns `"patch"` with `"high"` confidence for a `7.0.1 → 7.0.2` bug fix
- [ ] `classifyChange` returns `"security"` for a release notes containing "CVE-2025-1234"
- [ ] LLM tier is NOT called when `llm.enabled: false`
- [ ] LLM failure (API timeout, error) falls back to keyword result silently
- [ ] OpenAPI diff correctly flags removed path as `"breaking"` with `"high"` confidence
- [ ] 100% unit test coverage of semver and keyword classifiers
- [ ] All keyword patterns tested against real-world changelog fixtures

## File Inventory

| File | Description |
|---|---|
| `packages/watcher/src/classification/pipeline.ts` | Main classification orchestrator |
| `packages/watcher/src/classification/semver.ts` | Semver classifier |
| `packages/watcher/src/classification/keywords.ts` | Keyword heuristics |
| `packages/watcher/src/classification/openapi.ts` | OpenAPI diff classifier |
| `packages/watcher/src/classification/llm.ts` | LLM classifier |
| `packages/watcher/src/classification/priority.ts` | Preliminary priority mapping |
| `packages/watcher/src/classification/__tests__/*.test.ts` | All unit tests |
| `fixtures/changelogs/*.txt` | Real changelog fixture files |

## References

- [semver npm package](https://github.com/npm/node-semver)
- [Stripe API changelog](https://stripe.com/docs/changelog) — reference for test fixtures
- [oasdiff — OpenAPI diffing](https://github.com/Tufin/oasdiff) (Go, reference implementation)
- PRD FR-2.4
