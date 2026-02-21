# Architecture Overview

Thirdwatch is structured as a TypeScript monorepo with four conceptual layers that map directly to the product's four delivery phases.

## System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Developer Tooling                     │
│                                                          │
│   ┌──────────────────┐    ┌──────────────────────────┐  │
│   │   thirdwatch CLI  │    │   GitHub Action          │  │
│   │   (apps/cli)      │    │   (action/)              │  │
│   └────────┬─────────┘    └────────────┬─────────────┘  │
└────────────┼─────────────────────────── ┼───────────────┘
             │ scans                       │ scans
             ▼                             ▼
┌─────────────────────────────────────────────────────────┐
│                 Layer 1: Scanner                         │
│                                                          │
│   packages/core   ←──  packages/languages/*             │
│   (orchestrator)        (tree-sitter analyzers)         │
│        │                                                 │
│        │  reads                                          │
│        ▼                                                 │
│   registries/sdks/*.yml                                  │
│   (provider patterns)                                    │
│        │                                                 │
│        │  produces                                       │
│        ▼                                                 │
│   TDM (thirdwatch.tdm.json)                              │
│   packages/tdm (types + schema)                         │
└─────────────────────────────────────────────────────────┘
             │ uploads (Phase 2+)
             ▼
┌─────────────────────────────────────────────────────────┐
│              Layer 2: Watcher  [BSL 1.1]                 │
│                                                          │
│   packages/watcher   ←── registries/changelogs/*.yml    │
│   (scheduler + adapters)                                 │
│        │                                                 │
│        │  detects new releases → emits ChangeEvents     │
│        ▼                                                 │
│   apps/worker  (BullMQ jobs)                             │
└─────────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│              Layer 3: Analyzer  [BSL 1.1]                │
│                                                          │
│   packages/analyzer                                      │
│   - Semver scoring                                       │
│   - Keyword classification                               │
│   - OpenAPI diff                                         │
│   - LLM classifier (optional)                            │
│        │                                                 │
│        │  produces ImpactReport                          │
└─────────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│              Layer 4: Notifier  [BSL 1.1]                │
│                                                          │
│   packages/notifier                                      │
│   - GitHub Issues/PRs                                    │
│   - Slack Block Kit                                      │
│   - Jira ADF                                             │
│   - Email (Resend)                                       │
│   - Webhooks                                             │
└─────────────────────────────────────────────────────────┘
```

## Key Design Decisions

See `docs/decisions/` for Architecture Decision Records (ADRs):

| ADR | Decision |
|---|---|
| [ADR-001](../decisions/001-typescript-monorepo.md) | TypeScript monorepo with pnpm + Turborepo |
| [ADR-002](../decisions/002-treesitter-for-parsing.md) | Tree-sitter via WASM (web-tree-sitter) for parsing |
| [ADR-003](../decisions/003-tdm-as-core-artifact.md) | TDM as the canonical, open-standard output format |

## Package Dependency Graph

```
apps/cli
  └── packages/core
        ├── packages/tdm
        └── packages/languages/python
        └── packages/languages/javascript
        └── plugins/thirdwatch-language-*  (auto-discovered)

apps/api  [BSL 1.1]
  ├── packages/watcher   [BSL 1.1]
  ├── packages/analyzer  [BSL 1.1]
  ├── packages/notifier  [BSL 1.1]
  └── packages/tdm

apps/worker  [BSL 1.1]
  └── (same as api)

apps/web
  └── packages/tdm  (for TDM type rendering)
```

## Data Flow: Single Scan

```
1. User runs: thirdwatch scan ./myapp

2. CLI (apps/cli)
   └── calls core.scan({ root: "./myapp", ... })

3. Core (packages/core)
   ├── walks files with fast-glob
   ├── loads web-tree-sitter WASM grammars
   ├── dispatches each file to a language plugin (via Piscina worker pool)
   └── aggregates DetectedDependency[] results

4. Language Plugin (packages/languages/python or /javascript)
   ├── parses file with tree-sitter
   ├── runs tree-sitter queries for imports, http calls, instantiations
   └── matches against registries/sdks/*.yml patterns

5. Core
   └── writes TDM → thirdwatch.tdm.json

6. CLI
   └── renders table / JSON / YAML to stdout
```

## Licensing Boundary

The Apache 2.0 / BSL 1.1 boundary runs between the CLI/Scanner layer and the cloud services:

- **Apache 2.0**: `packages/tdm`, `packages/core`, `packages/languages/*`, `apps/cli`, `apps/web`, `registries/`, `plugins/`, `action/`, `schema/`
- **BSL 1.1**: `packages/watcher`, `packages/analyzer`, `packages/notifier`, `apps/api`, `apps/worker`

The BSL converts to Apache 2.0 after **4 years** from each release date.
