# Contributing to Thirdwatch

Thank you for investing time in Thirdwatch. This guide covers everything from a fresh clone to a merged pull request.

## Table of Contents

- [Ways to Contribute](#ways-to-contribute)
- [Development Setup](#development-setup)
- [Repository Structure](#repository-structure)
- [How to Pick an Issue](#how-to-pick-an-issue)
- [Making a Change](#making-a-change)
- [Adding a Language Analyzer](#adding-a-language-analyzer)
- [Adding an SDK Registry Entry](#adding-an-sdk-registry-entry)
- [Commit Convention](#commit-convention)
- [Pull Request Process](#pull-request-process)
- [Licensing](#licensing)

---

## Ways to Contribute

| Label | What it means | Effort |
|---|---|---|
| `good first issue` | Self-contained, clear acceptance criteria | 1–4 hours |
| `help wanted` | Core team needs community help | 4–16 hours |
| `plugin: new language` | Add a tree-sitter language analyzer | 8–24 hours |
| `registry: new sdk` | Add SDK patterns to the YAML registry | 1–2 hours |
| `docs` | Documentation improvements | Any |
| `bug` | Confirmed bug with reproduction steps | Varies |

**Open an issue before starting work.** This prevents duplicate effort and validates the approach before you invest time.

---

## Development Setup

### Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | ≥ 20.0.0 | [nodejs.org](https://nodejs.org) |
| pnpm | ≥ 9.0.0 | `npm install -g pnpm` |
| Git | ≥ 2.40 | System package manager |

### Steps

```bash
git clone https://github.com/thirdwatch/thirdwatch.git
cd thirdwatch
make setup          # pnpm install + pnpm build
make test           # all tests should pass on a fresh clone
```

### Run the CLI locally

```bash
# After building:
node apps/cli/dist/index.js scan ./fixtures/python-app

# Or link globally:
cd apps/cli && pnpm link --global
thirdwatch scan ./fixtures/python-app
```

---

## Repository Structure

```
apps/cli/           CLI entry point (Apache 2.0, published to npm)
apps/web/           thirdwatch.dev website (Apache 2.0)
apps/api/           Cloud API — not open for external contributions (BSL 1.1)
apps/worker/        Cloud worker — not open for external contributions (BSL 1.1)
packages/core/      Scanner engine — plugin interface lives here
packages/tdm/       TDM types, JSON Schema, validation
packages/languages/ Language analyzer plugins (Python, JS/TS)
plugins/            Community analyzer plugins scaffold
registries/         YAML SDK and changelog registries ← great contribution target
schema/v1/          TDM JSON Schema specification
fixtures/           Sample codebases for integration testing
docs/               Architecture docs, ADRs, feature plans
```

Community contributions are welcome in `apps/cli`, `apps/web`, `packages/`, `plugins/`, and `registries/`.

`apps/api` and `apps/worker` are BSL-licensed and not open for external contributions.

---

## How to Pick an Issue

1. Browse [issues labeled `good first issue`](https://github.com/thirdwatch/thirdwatch/labels/good%20first%20issue)
2. Comment "I'd like to work on this" — a maintainer will assign it within 24h (Mon–Fri)
3. If an issue has an assignee inactive for 14+ days, comment asking if help is needed

---

## Making a Change

### Branch naming

```
feat/<issue-number>-short-description
fix/<issue-number>-short-description
docs/<issue-number>-short-description
plugin/<language-name>
registry/<sdk-name>
```

### Changesets (required for publishable packages)

If your change affects `packages/` or `apps/cli`, add a changeset:

```bash
pnpm changeset
# Select affected packages, bump type, write a summary
```

Missing changesets fail CI.

### Testing

```bash
pnpm --filter @thirdwatch/core test           # single package
pnpm --filter @thirdwatch/language-python test # language analyzer
pnpm test                                      # everything
```

Test coverage must not decrease. Minimum 80% line coverage on `packages/core` and `packages/languages/*`.

---

## Adding a Language Analyzer

The full guide is in [docs/contributing/adding-language-analyzer.md](docs/contributing/adding-language-analyzer.md).

Quick checklist:
- [ ] Copy `plugins/analyzer-template/` to `plugins/analyzer-<language>/`
- [ ] Rename package to `@thirdwatch/analyzer-<language>` in `package.json`
- [ ] Add `"keywords": ["thirdwatch-plugin"]` in `package.json`
- [ ] Locate the grammar: `npm show tree-sitter-<language>`
- [ ] Write `.scm` query files for HTTP calls, SDK instantiation, imports
- [ ] Add test fixtures to `plugins/analyzer-<language>/fixtures/`
- [ ] Achieve ≥ 90% recall on fixture test suite
- [ ] Open a draft PR early — maintainers review query design before you write tests

---

## Adding an SDK Registry Entry

Add a YAML file to `registries/sdks/`. See [registries/sdks/README.md](registries/sdks/README.md) for the format.

No code changes required. Merged entries are automatically picked up by all language analyzers.

---

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `perf`

Scopes: `cli`, `core`, `tdm`, `language-python`, `language-javascript`, `watcher`, `analyzer`, `notifier`, `registry`, `schema`, `web`

Examples:
```
feat(core): add incremental scanning via git diff
fix(language-javascript): handle template literals in axios URL detection
docs(contributing): add Ruby analyzer walkthrough
registry(stripe): add payment method patterns for Stripe SDK
```

---

## Pull Request Process

1. All CI checks must pass (lint, typecheck, test, changeset)
2. One approving review from a CODEOWNER required
3. Squash-merge is used — write descriptive commit messages
4. Do not merge your own PR
5. PRs inactive for 30 days will be closed (can be reopened)

---

## Licensing

By submitting a pull request you agree your contribution is licensed under the same license as the files you modify:

- `packages/`, `plugins/`, `apps/cli`, `apps/web`, `registries/`, `schema/` → **Apache 2.0**
- `apps/api`, `apps/worker` → **BSL 1.1** (not open for contributions)

No CLA required for individual contributors. Organizations with > 10 contributors contact legal@thirdwatch.dev.

Do not submit code under GPL, AGPL, or any copyleft license.
