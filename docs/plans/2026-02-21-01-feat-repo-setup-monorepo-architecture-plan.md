---
title: "feat: Repo Setup & Monorepo Architecture"
type: feat
phase: 0 — Foundation
date: 2026-02-21
priority: P0
dependencies: none
---

# feat: Repo Setup & Monorepo Architecture

## Overview

Bootstrap the Thirdwatch monorepo with a structure designed for open-source community contribution and contractor hand-off. This plan establishes the skeleton that every subsequent feature plan builds on. Get this right once — every future PR, issue, and contributor experience flows from these decisions.

## Problem Statement

A new open-source project that skips repo scaffolding ends up with an inconsistent structure that confuses contributors, makes PR reviews painful, and slows outsourced work because contractors spend time figuring out conventions rather than building features. The goal is a monorepo where a new contributor can `git clone`, run one command, and have a working dev environment in under five minutes.

## Proposed Solution

A TypeScript-first pnpm monorepo using Turborepo, with clearly separated `apps/` and `packages/` directories, standardized tooling, and thorough contributor documentation. Everything is TypeScript — the scanner, cloud services, and website — which minimises the cognitive overhead for contributors and contractors.

## Technical Approach

### Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Language | TypeScript 5.x | Single language across all packages; strong types aid outsourcing |
| Runtime | Node.js 20 LTS | LTS stability; native tree-sitter bindings available |
| Package manager | pnpm 9 | Fast installs, strict hoisting, workspace support |
| Monorepo orchestration | Turborepo | Parallel task execution, build caching, per-package pipelines |
| Linting | ESLint 9 (flat config) + Prettier | Consistent code style enforced via CI |
| Testing | Vitest | Fast, ESM-native, compatible across all packages |
| CI/CD | GitHub Actions | Free for OSS, excellent ecosystem |
| Scanner distribution | npm (primary), Homebrew tap, pip wrapper | npm is native; Homebrew and pip wrappers delegate to npm |

### Repo Directory Structure

```
thirdwatch/                          # Root of the monorepo
│
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.yml           # Structured bug report form
│   │   ├── feature_request.yml      # Feature request form
│   │   └── language-analyzer.yml    # Community language analyzer proposal
│   ├── PULL_REQUEST_TEMPLATE.md     # PR checklist for contributors
│   ├── CODEOWNERS                   # Auto-assign reviewers by package
│   └── workflows/
│       ├── ci.yml                   # Lint, test, typecheck on every PR
│       ├── release.yml              # Changesets-driven release automation
│       └── scorecard.yml            # OpenSSF Scorecard for supply-chain health
│
├── apps/
│   ├── cli/                         # PLAN 5 — thirdwatch CLI (npm package)
│   ├── web/                         # PLAN 6 — thirdwatch.dev (Next.js 15)
│   ├── api/                         # PLAN 7+ — Cloud REST API (Fastify)
│   └── worker/                      # PLAN 7+ — Background watcher/analyzer
│
├── packages/
│   ├── core/                        # PLAN 3 — Tree-sitter engine + plugin interface
│   ├── tdm/                         # PLAN 2 — TDM types, schema, validation
│   ├── languages/
│   │   ├── python/                  # PLAN 4 — Python language analyzer
│   │   └── javascript/              # PLAN 4 — JS/TS language analyzer
│   ├── watcher/                     # PLAN 7 — Watcher logic
│   ├── analyzer/                    # PLAN 9 — Analyzer logic
│   ├── notifier/                    # PLAN 10 — Notification adapters
│   └── ui/                          # PLAN 6 — Shared React components
│
├── registries/                      # YAML community-extensible registries
│   ├── sdks/
│   │   ├── aws.yml
│   │   ├── stripe.yml
│   │   ├── openai.yml
│   │   ├── twilio.yml
│   │   └── README.md                # How to add a new SDK pattern
│   ├── apis/
│   │   └── known-providers.yml
│   └── changelogs/
│       ├── stripe.yml
│       ├── openai.yml
│       └── README.md                # How to add a new changelog source
│
├── schema/                          # TDM JSON Schema (language-agnostic artifact)
│   └── v1/
│       ├── tdm.schema.json
│       └── examples/
│           ├── payment-service.tdm.json
│           └── node-api.tdm.json
│
├── fixtures/                        # Sample codebases for integration tests
│   ├── python-app/                  # Realistic Python app with stripe, boto3, requests
│   ├── node-app/                    # Realistic Node.js app with openai, axios, pg
│   └── mixed-monorepo/              # Multi-language fixture
│
├── action/                          # PLAN 11 — GitHub Action source
│   ├── action.yml
│   └── src/
│
├── docker/
│   ├── watcher.Dockerfile
│   ├── analyzer.Dockerfile
│   └── compose.yml                  # Full local cloud stack for development
│
├── docs/
│   ├── plans/                       # Feature plans (this directory)
│   ├── decisions/                   # Architecture Decision Records (ADRs)
│   │   ├── 001-typescript-monorepo.md
│   │   ├── 002-treesitter-for-parsing.md
│   │   └── 003-tdm-as-core-artifact.md
│   ├── architecture/
│   │   ├── overview.md
│   │   └── tdm-spec.md
│   └── contributing/
│       ├── adding-language-analyzer.md
│       ├── adding-sdk-pattern.md
│       └── local-development.md
│
├── .thirdwatch.yml.example          # Example config file for the scanner
├── .thirdwatchignore.example        # Example ignore file
├── CHANGELOG.md                     # Human-readable changelog (managed by Changesets)
├── CLAUDE.md                        # AI assistant context for the project
├── CONTRIBUTING.md                  # Contribution guide
├── LICENSE                          # Apache 2.0 (scanner, TDM spec, CLI)
├── LICENSE-CLOUD                    # BSL 1.1 (cloud services only)
├── Makefile                         # Convenience commands (make dev, make test, etc.)
├── README.md                        # Project overview and quick start
├── package.json                     # Root pnpm workspace config
├── pnpm-workspace.yaml
├── turbo.json                       # Turborepo pipeline configuration
└── tsconfig.base.json               # Shared TypeScript config inherited by all packages
```

### Package Naming Convention

All packages follow `@thirdwatch/<name>`:

| Package | npm name | Description |
|---|---|---|
| `packages/core` | `@thirdwatch/core` | Scanner engine (internal, not published standalone) |
| `packages/tdm` | `@thirdwatch/tdm` | TDM types + validation (published — useful standalone) |
| `packages/languages/python` | `@thirdwatch/language-python` | Python analyzer plugin |
| `packages/languages/javascript` | `@thirdwatch/language-javascript` | JS/TS analyzer plugin |
| `packages/watcher` | `@thirdwatch/watcher` | Watcher logic |
| `packages/analyzer` | `@thirdwatch/analyzer` | Analyzer logic |
| `packages/notifier` | `@thirdwatch/notifier` | Notifier adapters |
| `apps/cli` | `thirdwatch` | The CLI (top-level name, not scoped) |

### Root `package.json`

```json
// package.json
{
  "name": "thirdwatch-monorepo",
  "private": true,
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "dev": "turbo run dev --parallel",
    "clean": "turbo run clean && rm -rf node_modules"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "@changesets/cli": "^2.27.0",
    "typescript": "^5.4.0",
    "eslint": "^9.0.0",
    "prettier": "^3.0.0",
    "vitest": "^1.6.0"
  },
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  },
  "packageManager": "pnpm@9.1.0"
}
```

### `pnpm-workspace.yaml`

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
  - "packages/languages/*"
  - "action"
```

### `turbo.json`

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "inputs": ["src/**", "tests/**", "fixtures/**"]
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "dev": {
      "persistent": true,
      "cache": false
    }
  }
}
```

### `tsconfig.base.json`

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

### CI Pipeline (`.github/workflows/ci.yml`)

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run build lint typecheck test
      - name: Upload coverage
        uses: codecov/codecov-action@v4
```

### Makefile

```makefile
# Makefile
.PHONY: dev test lint build clean

dev:
	pnpm dev

test:
	pnpm test

lint:
	pnpm lint

build:
	pnpm build

clean:
	pnpm clean

# Bootstrap a fresh clone
setup:
	pnpm install
	pnpm build

# Local docker stack (Phase 2+)
docker-up:
	docker compose -f docker/compose.yml up -d

docker-down:
	docker compose -f docker/compose.yml down
```

### `CLAUDE.md` (AI Context File)

```markdown
# CLAUDE.md — Thirdwatch

## What is this?
Thirdwatch is an open-source CLI scanner that maps every external dependency
in a codebase (HTTP APIs, SDKs, packages, infra connections) and produces a
Thirdwatch Dependency Manifest (TDM). The cloud service monitors those
dependencies for breaking changes.

## Monorepo Layout
- `apps/cli` — the `thirdwatch` npm CLI (uses packages/core)
- `packages/core` — scanner engine + tree-sitter plugin system
- `packages/tdm` — TDM TypeScript types and JSON Schema validation
- `packages/languages/*` — language-specific analyzers (tree-sitter queries)
- `registries/` — YAML files defining SDK patterns and changelog sources

## Key Conventions
- All packages use `@thirdwatch/` npm scope except the top-level CLI
- TypeScript strict mode everywhere; no `any` without a comment explaining why
- Tests live next to source in `*.test.ts` files
- Integration tests use fixtures in `/fixtures/`
- Run `make setup` to bootstrap; `make test` to run all tests

## Licenses
- `apps/cli`, `packages/*`, `schema/`, `registries/` → Apache 2.0
- `apps/api`, `apps/worker`, `packages/watcher`, `packages/analyzer`,
  `packages/notifier` → BSL 1.1 (converts to Apache 2.0 after 3 years)

## Phase
Currently in Phase 1 — "The Map". Only the scanner is being built.
Cloud services (apps/api, apps/worker) are stubs.
```

### `CONTRIBUTING.md` Key Sections

```markdown
# Contributing to Thirdwatch

## Quick Start (< 5 minutes)
1. Fork and clone the repo
2. Run `make setup` (installs dependencies, builds all packages)
3. Run `make test` (all tests should pass on a fresh clone)
4. Create a branch: `git checkout -b feat/your-feature`

## How the Codebase is Organized
(link to docs/architecture/overview.md)

## Adding a Language Analyzer
The highest-impact contribution. See docs/contributing/adding-language-analyzer.md.

## Adding an SDK Pattern
Add a YAML file to registries/sdks/. See registries/sdks/README.md.

## Adding a Changelog Source
Add a YAML file to registries/changelogs/. See registries/changelogs/README.md.

## Commit Convention
We use Conventional Commits: feat:, fix:, docs:, test:, refactor:, chore:.

## PR Process
- CI must be green
- One approving review required
- CODEOWNERS auto-assigns reviewers based on changed files
```

### `CODEOWNERS`

```
# .github/CODEOWNERS
# Default: core maintainers review everything
*                          @thirdwatch/core-maintainers

# Scanner engine — requires deep tree-sitter knowledge
/packages/core/            @thirdwatch/scanner-maintainers
/packages/languages/       @thirdwatch/scanner-maintainers

# Cloud services — BSL licensed
/apps/api/                 @thirdwatch/cloud-maintainers
/apps/worker/              @thirdwatch/cloud-maintainers

# Registries — lower bar, community contributions welcome
/registries/               @thirdwatch/registry-maintainers

# Website
/apps/web/                 @thirdwatch/web-maintainers
```

### GitHub Issue Templates

```yaml
# .github/ISSUE_TEMPLATE/bug_report.yml
name: Bug Report
description: Something isn't working
labels: ["bug", "needs-triage"]
body:
  - type: input
    id: version
    attributes:
      label: Thirdwatch version
      placeholder: "0.1.0"
    validations:
      required: true
  - type: textarea
    id: reproduction
    attributes:
      label: Reproduction steps
      description: Minimal steps to reproduce. A sample repo or snippet is ideal.
    validations:
      required: true
  - type: textarea
    id: expected
    attributes:
      label: Expected behavior
  - type: textarea
    id: actual
    attributes:
      label: Actual behavior
  - type: textarea
    id: tdm-output
    attributes:
      label: TDM output (if relevant)
      render: json
```

```yaml
# .github/ISSUE_TEMPLATE/language-analyzer.yml
name: New Language Analyzer Proposal
description: Propose support for a new programming language
labels: ["language-support", "community"]
body:
  - type: input
    id: language
    attributes:
      label: Language name
  - type: input
    id: treesitter-grammar
    attributes:
      label: tree-sitter grammar npm package
      placeholder: "tree-sitter-ruby"
  - type: textarea
    id: http-patterns
    attributes:
      label: Common HTTP client libraries for this language
  - type: checkboxes
    id: contribution
    attributes:
      label: Are you willing to implement this?
      options:
        - label: Yes, I will submit a PR
        - label: No, but I can provide test fixtures
```

### Architecture Decision Records

Three initial ADRs to create in `docs/decisions/`:

**`001-typescript-monorepo.md`** — Why TypeScript over Go for the CLI scanner: contributor accessibility, single-language repo, tree-sitter has excellent Node.js bindings, npm distribution is natural.

**`002-treesitter-for-parsing.md`** — Why tree-sitter over regex: incremental parsing, language-agnostic, production battle-tested (Neovim, GitHub code search, Zed), community grammar ecosystem.

**`003-tdm-as-core-artifact.md`** — Why the manifest format is the primary deliverable: portable, versionable, committable, useful without the monitoring layer, positions Thirdwatch as a standard.

## Implementation Phases

### Phase 0.1: Scaffold (Day 1)
- Initialize pnpm workspace with `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`
- Create all directory stubs with `.gitkeep` files
- Add root `Makefile` and `.github/` scaffolding
- Write `CLAUDE.md`, `CONTRIBUTING.md`, `README.md` (v0 — minimal but accurate)
- Set up ESLint flat config and Prettier
- Add `CHANGELOG.md` with Changesets

### Phase 0.2: CI (Day 1–2)
- `ci.yml` passing on an empty repo (lint + typecheck on zero files = green)
- `release.yml` using Changesets for version bumping and npm publish
- Branch protection: require CI green + 1 review to merge to `main`

### Phase 0.3: Package Stubs (Day 2)
- Create `package.json` + `tsconfig.json` + `src/index.ts` (stub) for every package
- Verify `turbo run build` completes without error across the whole monorepo
- Add `vitest.config.ts` to each package

### Phase 0.4: Fixtures (Day 2–3)
- Create `fixtures/python-app/` with: `requirements.txt`, `app.py` (calling Stripe, requests to OpenAI, boto3 S3), `config.py`
- Create `fixtures/node-app/` with: `package.json`, `src/index.ts` (fetch to external URL, openai SDK, pg connection)
- These fixtures are used by scanner integration tests in Plan 3 onward

## Acceptance Criteria

- [ ] `git clone && make setup && make test` completes in under 5 minutes on a fresh machine
- [ ] `turbo run build` produces zero errors across all packages
- [ ] `turbo run lint` produces zero errors or warnings
- [ ] CI workflow is green on the initial commit
- [ ] Every package has a `package.json` with correct `name`, `version`, `main`, `types`, `license` fields
- [ ] `CLAUDE.md` accurately describes the repo structure
- [ ] `CONTRIBUTING.md` is tested by a first-time contributor (can be a contractor following it cold)
- [ ] Three ADRs exist in `docs/decisions/`
- [ ] GitHub branch protection is configured on `main`
- [ ] Issue templates are live and tested

## File Inventory

### Files to Create

| File | Description |
|---|---|
| `package.json` | Root workspace config |
| `pnpm-workspace.yaml` | Workspace glob patterns |
| `turbo.json` | Turborepo pipeline |
| `tsconfig.base.json` | Shared TypeScript config |
| `Makefile` | Convenience commands |
| `CLAUDE.md` | AI context |
| `CONTRIBUTING.md` | Contributor guide |
| `README.md` | Project overview |
| `CHANGELOG.md` | Release history |
| `LICENSE` | Apache 2.0 |
| `LICENSE-CLOUD` | BSL 1.1 |
| `.github/workflows/ci.yml` | CI pipeline |
| `.github/workflows/release.yml` | Release automation |
| `.github/CODEOWNERS` | Auto-assign reviewers |
| `.github/PULL_REQUEST_TEMPLATE.md` | PR checklist |
| `.github/ISSUE_TEMPLATE/bug_report.yml` | Bug template |
| `.github/ISSUE_TEMPLATE/feature_request.yml` | Feature template |
| `.github/ISSUE_TEMPLATE/language-analyzer.yml` | Language proposal template |
| `docs/decisions/001-typescript-monorepo.md` | ADR |
| `docs/decisions/002-treesitter-for-parsing.md` | ADR |
| `docs/decisions/003-tdm-as-core-artifact.md` | ADR |
| `fixtures/python-app/**` | Python fixture codebase |
| `fixtures/node-app/**` | Node.js fixture codebase |
| `registries/sdks/README.md` | How to add SDK patterns |
| `registries/changelogs/README.md` | How to add changelog sources |
| `docker/compose.yml` | Local cloud stack |
| `.thirdwatch.yml.example` | Config example |
| `.thirdwatchignore.example` | Ignore file example |
| `apps/cli/package.json` (stub) | CLI package stub |
| `packages/core/package.json` (stub) | Core package stub |
| `packages/tdm/package.json` (stub) | TDM package stub |
| `packages/languages/python/package.json` (stub) | Python analyzer stub |
| `packages/languages/javascript/package.json` (stub) | JS analyzer stub |

## References

- [Turborepo docs](https://turbo.build/repo/docs)
- [pnpm workspaces](https://pnpm.io/workspaces)
- [Changesets](https://github.com/changesets/changesets)
- [OpenSSF Scorecard](https://github.com/ossf/scorecard)
- [Conventional Commits](https://www.conventionalcommits.org/)
- Similar OSS monorepos: [Biome](https://github.com/biomejs/biome), [ESLint](https://github.com/eslint/eslint)
