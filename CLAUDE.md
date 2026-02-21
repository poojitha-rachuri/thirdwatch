# CLAUDE.md — Thirdwatch

## What is Thirdwatch?

Thirdwatch is an open-source CLI tool that scans any codebase, maps every
external dependency (HTTP APIs, SDKs, packages, database connections, webhooks),
and produces a **Thirdwatch Dependency Manifest (TDM)** — a structured JSON/YAML
artifact describing the entire external surface area of the codebase.

The cloud service (Phase 2+) monitors those dependencies continuously and alerts
teams before breaking changes reach production.

**Domain:** thirdwatch.dev
**One-liner:** Know before you break — continuous monitoring for every external dependency in your codebase.

---

## Monorepo Layout

```
apps/cli/                  → thirdwatch CLI (npm: "thirdwatch") — Apache 2.0
apps/web/                  → thirdwatch.dev marketing site (Next.js 15) — Apache 2.0
apps/api/                  → Cloud REST API (Fastify) — BSL 1.1
apps/worker/               → Background job worker (BullMQ) — BSL 1.1
packages/tdm/              → @thirdwatch/tdm — TDM types + JSON Schema validation
packages/core/             → @thirdwatch/core — tree-sitter scanner engine + plugin interface
packages/languages/python/ → @thirdwatch/language-python — Python analyzer
packages/languages/javascript/ → @thirdwatch/language-javascript — JS/TS analyzer
packages/watcher/          → @thirdwatch/watcher — polling + change detection
packages/analyzer/         → @thirdwatch/analyzer — impact scoring + code mapping
packages/notifier/         → @thirdwatch/notifier — notification adapters
plugins/analyzer-template/ → scaffold for community language analyzer plugins
registries/sdks/           → YAML SDK pattern registry (community-extensible)
registries/changelogs/     → YAML changelog source registry (community-extensible)
schema/v1/                 → tdm.schema.json — JSON Schema canonical spec
fixtures/                  → sample codebases for integration testing
action/                    → GitHub Action source
docker/                    → Dockerfiles + compose.yml for local cloud stack
docs/decisions/            → Architecture Decision Records (ADRs)
docs/plans/                → Feature plans (numbered 01–11)
```

---

## Key Conventions

- **TypeScript strict mode everywhere.** No `any` without a comment explaining why.
- **pnpm workspaces** — never `npm install` directly. Always use `pnpm install`.
- **Turborepo** orchestrates builds — `pnpm build` at root runs all packages in dependency order.
- **Package naming:** `@thirdwatch/<name>` for all packages except the CLI (which is `thirdwatch`).
- **Tests** live next to source in `*.test.ts` files. Integration tests use `fixtures/`.
- **Imports** use `.js` extensions even in TypeScript (NodeNext module resolution).
- **tree-sitter:** Use `web-tree-sitter` (WASM), not the native `tree-sitter` package. Line numbers from tree-sitter are 0-indexed — always add 1 before writing to TDM.
- **Plugin interface** (`LanguageAnalyzer` in `packages/core/src/plugin.ts`) is a stable public API from v0.1.0. Breaking it is a major version bump.
- Run `make setup` to bootstrap. Run `make test` to verify everything works.

---

## Licenses

| Path | License |
|---|---|
| `apps/cli`, `packages/*`, `plugins/*`, `schema/`, `registries/` | Apache 2.0 |
| `apps/api`, `apps/worker`, `packages/watcher`, `packages/analyzer`, `packages/notifier` | BSL 1.1 (converts to Apache 2.0 after 3 years) |
| `apps/web` | Apache 2.0 |

---

## Current Phase

**Phase 1 — "The Map"** (Weeks 1–6)

Building the open-source CLI scanner only. Goals:
- Ship `thirdwatch scan` that produces a valid TDM
- Support Python and JavaScript/TypeScript
- Publish to npm, Homebrew, pip
- Launch on Hacker News — target 500+ GitHub stars

Cloud services (`apps/api`, `apps/worker`) are directory stubs only. Do not implement them yet.

---

## Feature Plans

Plans are numbered `01–11` in `docs/plans/`. The execution order is:

```
01 (Repo Setup)   ← current
02 (TDM Schema)   ← next
03 (Scanner Core) → 04 (Detectors) → 05 (CLI)   [Track A]
06 (Website)                                      [Track B — parallel with Track A]
07 (Watcher) → 08 (Classification) → 09 (Analyzer) → 10 (Notifier)  [Track C — Phase 2]
11 (CI Gate)  ← after 05
```
