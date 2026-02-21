# Local Development Guide

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 20 LTS | [nodejs.org](https://nodejs.org) |
| pnpm | 9+ | `npm i -g pnpm@9` |
| Docker + Compose | Latest | [docker.com](https://docker.com) |
| Git | 2.40+ | system package manager |

## First-Time Setup

```bash
# 1. Clone the repo
git clone https://github.com/thirdwatch/thirdwatch.git
cd thirdwatch

# 2. Install all dependencies (pnpm workspaces)
pnpm install

# 3. Build all packages
pnpm build

# 4. (Optional) Start cloud services for Watcher/API dev
make docker-up
```

That's it. The monorepo is now ready for development.

## Project Structure

```
thirdwatch/
├── apps/
│   ├── cli/          # thirdwatch CLI (Apache 2.0)
│   ├── web/          # thirdwatch.dev website (Apache 2.0)
│   ├── api/          # Cloud REST API (BSL 1.1)
│   └── worker/       # Background job worker (BSL 1.1)
├── packages/
│   ├── tdm/          # TDM types + JSON Schema
│   ├── core/         # Scanner engine + plugin interface
│   ├── languages/
│   │   ├── python/   # Python language analyzer
│   │   └── javascript/ # JS/TS language analyzer
│   ├── watcher/      # Changelog watcher (BSL 1.1)
│   ├── analyzer/     # Impact analyzer (BSL 1.1)
│   └── notifier/     # Notification dispatch (BSL 1.1)
├── plugins/          # Community language analyzers
├── registries/       # SDK + changelog data (YAML)
└── fixtures/         # Real-world scan test targets
```

## Common Workflows

### Run the CLI against fixtures

```bash
# From repo root
pnpm --filter thirdwatch start scan ./fixtures/python-app
pnpm --filter thirdwatch start scan ./fixtures/node-app
```

### Run all tests

```bash
pnpm test
# or via turbo (parallel, incremental)
turbo run test
```

### Run tests for a specific package

```bash
pnpm --filter @thirdwatch/core test
pnpm --filter @thirdwatch/language-python test
```

### Type check everything

```bash
pnpm typecheck
```

### Lint + format

```bash
pnpm lint        # ESLint
pnpm format      # Prettier (write)
pnpm format:check  # Prettier (check only, used in CI)
```

### Watch mode (development)

```bash
# Build all packages in watch mode + run CLI dev server
pnpm dev
```

## Making Changes

### Modifying a Package

1. Make changes in `packages/<name>/src/`
2. `pnpm --filter @thirdwatch/<name> build` (or let Turborepo handle deps)
3. Tests: `pnpm --filter @thirdwatch/<name> test`

### Adding a Changeset

For any user-facing change, add a changeset before opening a PR:

```bash
pnpm changeset
# Follow the interactive prompts:
# - Select affected packages
# - Choose: patch / minor / major
# - Write a short human-readable description
```

The changeset file goes in `.changeset/`. Commit it with your PR.

### Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(core): add http_call detection for fetch()
fix(language-python): handle relative imports correctly
docs: update local-development guide
chore: bump pnpm to 9.1.1
```

Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`, `ci`

## Docker Services

The `docker/compose.yml` starts PostgreSQL and Redis for cloud service development:

```bash
make docker-up    # start services
make docker-down  # stop services
```

Connection strings (for `.env` files in `apps/api` and `apps/worker`):
- PostgreSQL: `postgresql://thirdwatch:thirdwatch@localhost:5432/thirdwatch_dev`
- Redis: `redis://localhost:6379`

## Troubleshooting

**`pnpm install` fails with workspace errors**
→ Make sure you're on pnpm 9+: `pnpm --version`

**TypeScript errors after pulling**
→ Rebuild from scratch: `pnpm clean && pnpm build`

**`web-tree-sitter` WASM not loading in tests**
→ Check that `tree-sitter-python.wasm` / `tree-sitter-javascript.wasm` are in the expected locations after build. See `packages/core/src/wasm-loader.ts`.
