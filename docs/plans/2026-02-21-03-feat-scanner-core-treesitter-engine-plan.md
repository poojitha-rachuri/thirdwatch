---
title: "feat: Scanner Core — Tree-sitter Engine & Plugin Interface"
type: feat
phase: 1 — The Map
date: 2026-02-21
priority: P0
dependencies: Plan 1 (Repo Setup), Plan 2 (TDM Schema)
package: packages/core
---

# feat: Scanner Core — Tree-sitter Engine & Plugin Interface

## Overview

Build `@thirdwatch/core` — the parsing engine that drives everything in Phase 1. This package orchestrates file discovery, dispatches files to the appropriate language analyzer plugins, aggregates results into a TDM, and handles performance-critical concerns like parallelism and incremental scanning. All language-specific logic lives in the plugin packages (`@thirdwatch/language-python`, etc.) — this package only defines the plugin contract and the execution orchestration.

## Problem Statement

The scanner needs to process 100K LOC in under 60 seconds. It must support multiple languages without a monolithic if/else switch. Community contributors need a clean, documented interface to add new language support. None of this is achievable without a well-designed core engine that separates concerns properly.

## Proposed Solution

A TypeScript package that:
1. Accepts a scan root path and configuration
2. Discovers all source files using `fast-glob`
3. Loads language analyzer plugins (one per language)
4. Dispatches files to the correct plugin in worker threads for parallelism
5. Aggregates `DependencyEntry` arrays from all plugins into a final `TDM`
6. Outputs the TDM to JSON/YAML

## Technical Approach

### Plugin Interface

This is the public contract every language analyzer must implement:

```typescript
// packages/core/src/plugin.ts

import type { TDMPackage, TDMAPI, TDMSDK, TDMInfrastructure, TDMWebhook } from "@thirdwatch/tdm";

export type DependencyEntry =
  | ({ kind: "package" } & TDMPackage)
  | ({ kind: "api" } & TDMAPI)
  | ({ kind: "sdk" } & TDMSDK)
  | ({ kind: "infrastructure" } & TDMInfrastructure)
  | ({ kind: "webhook" } & TDMWebhook);

export interface AnalyzerContext {
  /** Absolute path to the file being analyzed */
  filePath: string;
  /** File contents as a UTF-8 string */
  source: string;
  /** Root of the scan (for computing relative paths) */
  scanRoot: string;
  /** Resolved env vars / config values available for URL resolution */
  resolvedEnv: Record<string, string>;
}

export interface LanguageAnalyzerPlugin {
  /** Human-readable name, e.g., "Python 3.x" */
  readonly name: string;
  /** Language slug, e.g., "python" — used in TDM metadata */
  readonly language: string;
  /** File extensions this analyzer handles, e.g., [".py"] */
  readonly extensions: string[];
  /**
   * Analyze a single file and return all discovered dependency entries.
   * Called once per file. Must NOT have side effects outside the return value.
   */
  analyze(context: AnalyzerContext): Promise<DependencyEntry[]>;
  /**
   * Optional: called once per scan with all manifest files found
   * (package.json, requirements.txt, go.mod, etc.).
   * Returns package dependency entries from manifest parsing.
   */
  analyzeManifests?(manifestFiles: string[], scanRoot: string): Promise<DependencyEntry[]>;
}
```

### Scanner Orchestrator (`packages/core/src/scanner.ts`)

```typescript
// packages/core/src/scanner.ts (sketch)

import { glob } from "fast-glob";
import { cpus } from "node:os";
import Piscina from "piscina"; // Worker thread pool
import type { TDM } from "@thirdwatch/tdm";
import type { LanguageAnalyzerPlugin, DependencyEntry } from "./plugin.js";
import { buildTDM } from "./build-tdm.js";

export interface ScanOptions {
  root: string;
  plugins: LanguageAnalyzerPlugin[];
  ignore?: string[];           // Glob patterns to skip
  configFile?: string;         // Path to .thirdwatch.yml
  previousTdm?: TDM;           // For incremental scanning
  resolveEnv?: boolean;        // Default true
  concurrency?: number;        // Default: CPU count
}

export async function scan(options: ScanOptions): Promise<TDM> {
  const startMs = Date.now();
  const { root, plugins, ignore = [], concurrency = cpus().length } = options;

  // Build extension → plugin map
  const pluginMap = new Map<string, LanguageAnalyzerPlugin>();
  for (const plugin of plugins) {
    for (const ext of plugin.extensions) {
      pluginMap.set(ext, plugin);
    }
  }

  // Discover files
  const files = await glob("**/*", {
    cwd: root,
    absolute: true,
    ignore: ["**/node_modules/**", "**/.git/**", ...ignore],
  });

  // Identify manifest files for package analysis
  const manifestPatterns = ["package.json", "requirements.txt", "pyproject.toml", "go.mod", "Pipfile"];
  const manifestFiles = files.filter(f => manifestPatterns.some(p => f.endsWith(p)));

  // Collect entries from manifests first (synchronous, fast)
  const manifestEntries: DependencyEntry[] = [];
  for (const plugin of plugins) {
    if (plugin.analyzeManifests) {
      const entries = await plugin.analyzeManifests(manifestFiles, root);
      manifestEntries.push(...entries);
    }
  }

  // Parallel analysis of source files via worker pool
  const pool = new Piscina({ maxThreads: concurrency });
  const sourceFiles = files.filter(f => pluginMap.has(extname(f)));
  const fileResults = await Promise.all(
    sourceFiles.map(filePath => {
      const plugin = pluginMap.get(extname(filePath))!;
      return pool.run({ filePath, plugin: plugin.language }, { name: "analyzeFile" });
    })
  );

  const allEntries: DependencyEntry[] = [...manifestEntries, ...fileResults.flat()];
  const duration = Date.now() - startMs;

  return buildTDM(allEntries, { root, plugins, duration });
}
```

### TDM Builder (`packages/core/src/build-tdm.ts`)

```typescript
// packages/core/src/build-tdm.ts

import type { TDM } from "@thirdwatch/tdm";
import type { DependencyEntry } from "./plugin.js";

/**
 * Aggregates DependencyEntry[] into a final TDM.
 * Deduplicates entries by (kind + identifier) and merges their locations.
 */
export function buildTDM(entries: DependencyEntry[], context: BuildContext): TDM {
  // Group by kind
  const packages = deduplicateByKey(
    entries.filter(e => e.kind === "package"),
    e => `${e.ecosystem}:${e.name}`
  );
  // ... similar for apis, sdks, infrastructure, webhooks

  return {
    version: "1.0",
    metadata: {
      schema_version: "1.0",
      scan_timestamp: new Date().toISOString(),
      scanner_version: SCANNER_VERSION,
      languages_detected: context.plugins.map(p => p.language),
      total_dependencies_found: entries.length,
      scan_duration_ms: context.duration,
    },
    packages,
    apis,
    sdks,
    infrastructure,
    webhooks,
  };
}
```

### Incremental Scanning (`packages/core/src/incremental.ts`)

```typescript
// packages/core/src/incremental.ts

/**
 * Given a previous TDM and a list of changed files (from git diff or mtime),
 * returns only the files that need to be re-analyzed.
 *
 * Strategy:
 * 1. Use `git diff --name-only HEAD~1` if inside a git repo
 * 2. Fall back to mtime comparison against previousTdm.metadata.scan_timestamp
 * 3. Files not in changedFiles retain their entries from previousTdm
 */
export async function getChangedFiles(
  root: string,
  previousTdm: TDM
): Promise<{ changedFiles: string[]; unchangedEntries: DependencyEntry[] }> { ... }
```

### Environment Variable Resolution (`packages/core/src/resolve.ts`)

```typescript
// packages/core/src/resolve.ts

/**
 * Attempts to resolve environment variable references in URL strings.
 * E.g., "${STRIPE_API_BASE}/v1/charges" → "https://api.stripe.com/v1/charges"
 *
 * Resolution sources (in priority order):
 * 1. .env file at scan root
 * 2. .thirdwatch.yml [env] section
 * 3. Common naming patterns (e.g., STRIPE_API_BASE → known Stripe base URL)
 * 4. Current process.env (opt-in via --use-process-env flag)
 */
export function resolveUrl(urlTemplate: string, env: Record<string, string>): {
  resolved: string | null;
  confidence: "high" | "medium" | "low";
} { ... }
```

### Performance Architecture

| Concern | Solution |
|---|---|
| Parallel file processing | `piscina` worker thread pool (one thread per CPU) |
| Tree-sitter parsing cost | Each worker initializes its own tree-sitter parser (avoid serialization overhead) |
| Large files | Skip files >1MB (configurable) |
| Incremental scanning | Re-analyze only git-changed files; merge unchanged entries from previous TDM |
| Memory | Stream file reads; don't hold all file contents in memory at once |

### Configuration File (`.thirdwatch.yml`)

```yaml
# .thirdwatch.yml.example
version: "1"

# Languages to analyze (default: auto-detect)
languages:
  - python
  - javascript

# Glob patterns to ignore (on top of .thirdwatchignore)
ignore:
  - "tests/**"
  - "docs/**"
  - "**/*.min.js"

# Env var overrides for URL resolution
env:
  STRIPE_API_BASE: "https://api.stripe.com"
  PARTNER_API_BASE: "https://api.partner.com"

# SDK registry overrides (extend built-in patterns)
sdks:
  custom_crm:
    package: "our-crm-sdk"
    provider: "internal-crm"
    patterns:
      - "CRMClient"

# Confidence threshold for output (filter out low-confidence results)
min_confidence: "medium"

# Skip files larger than X MB
max_file_size_mb: 1
```

### Module Layout (`packages/core/src/`)

```
packages/core/src/
├── index.ts              # Public API: export { scan, ScanOptions }
├── plugin.ts             # LanguageAnalyzerPlugin interface + DependencyEntry types
├── scanner.ts            # Main scan() orchestrator
├── build-tdm.ts          # Aggregate DependencyEntry[] → TDM
├── incremental.ts        # Changed file detection
├── resolve.ts            # Env var / URL resolution
├── config.ts             # .thirdwatch.yml loader and validator
├── worker.ts             # Piscina worker thread entry point
└── __tests__/
    ├── scanner.test.ts   # Integration tests using fixtures/
    ├── build-tdm.test.ts # Unit tests for aggregation + deduplication
    └── resolve.test.ts   # URL resolution unit tests
```

## Implementation Phases

### Phase 3.1: Plugin Interface
- Define `LanguageAnalyzerPlugin` interface in `packages/core/src/plugin.ts`
- Define `DependencyEntry` discriminated union type
- Write `AnalyzerContext` interface
- No implementation yet — just the contract

### Phase 3.2: Config Loading
- Implement `.thirdwatch.yml` loader with Zod validation
- Implement `.thirdwatchignore` file reader (same syntax as .gitignore)
- Unit tests for config parsing edge cases

### Phase 3.3: File Discovery
- Implement glob-based file discovery using `fast-glob`
- Apply ignore patterns from both .thirdwatch.yml and .thirdwatchignore
- Separate manifest files from source files

### Phase 3.4: Orchestrator
- Implement `scan()` function with Piscina worker pool
- Wire plugin map (extension → plugin)
- Implement `buildTDM()` aggregation with deduplication logic
- Integration test: scan `fixtures/python-app/` → verify entries present

### Phase 3.5: Env Var Resolution
- Implement `resolveUrl()` with .env file reading
- Implement known-provider URL dictionary (Stripe, OpenAI, etc.)
- Unit tests with various URL template patterns

### Phase 3.6: Incremental Scanning
- Implement `getChangedFiles()` using `simple-git`
- Integration test: scan → mutate a fixture file → re-scan → verify only changed file was re-analyzed

## Acceptance Criteria

- [ ] `scan()` accepts a `root` path and a `plugins[]` array and returns a valid TDM
- [ ] `scan()` on `fixtures/python-app/` completes in <10 seconds
- [ ] `scan()` on a 100K LOC fixture completes in <60 seconds (benchmark test)
- [ ] The `LanguageAnalyzerPlugin` interface has JSDoc on every property and method
- [ ] Zero entries from a language that has no plugin registered
- [ ] Duplicate entries across files are merged (same URL found in 3 files → 1 entry with 3 locations)
- [ ] `--no-resolve` flag prevents any network or .env file reads
- [ ] Incremental scan correctly skips unchanged files
- [ ] Worker thread errors don't crash the entire scan (logged, file skipped)

## File Inventory

| File | Description |
|---|---|
| `packages/core/src/index.ts` | Public API |
| `packages/core/src/plugin.ts` | Plugin interface |
| `packages/core/src/scanner.ts` | Orchestrator |
| `packages/core/src/build-tdm.ts` | TDM aggregation |
| `packages/core/src/incremental.ts` | Incremental scan logic |
| `packages/core/src/resolve.ts` | Env var resolution |
| `packages/core/src/config.ts` | Config file loader |
| `packages/core/src/worker.ts` | Piscina worker entry |
| `packages/core/src/__tests__/scanner.test.ts` | Integration tests |
| `packages/core/package.json` | Package manifest |

## Dependencies

```json
// packages/core package.json dependencies
{
  "dependencies": {
    "@thirdwatch/tdm": "workspace:*",
    "fast-glob": "^3.3.0",
    "piscina": "^4.0.0",
    "simple-git": "^3.0.0",
    "js-yaml": "^4.1.0",
    "zod": "^3.22.0",
    "dotenv": "^16.0.0"
  }
}
```

## References

- [tree-sitter Node.js bindings](https://github.com/tree-sitter/node-tree-sitter)
- [Piscina — worker thread pool](https://github.com/piscinajs/piscina)
- [fast-glob](https://github.com/mrmlnc/fast-glob)
- PRD FR-1.1 through FR-1.10
