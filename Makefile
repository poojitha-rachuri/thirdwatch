.PHONY: setup dev build test lint typecheck validate-registry clean docker-up docker-down

## Bootstrap a fresh clone — run this first
setup:
	pnpm install
	pnpm build

## Start all dev servers in parallel
dev:
	pnpm dev

## Build all packages
build:
	pnpm build

## Run all tests
test:
	pnpm test

## Lint all packages
lint:
	pnpm lint

## Type-check all packages
typecheck:
	pnpm typecheck

## Validate SDK registry YAML files against schema
validate-registry:
	node scripts/validate-registry.mjs

## Remove all build artifacts and node_modules
clean:
	pnpm clean
	find . -name "node_modules" -type d -prune -exec rm -rf {} +
	find . -name "dist" -type d -prune -exec rm -rf {} +
	find . -name "*.tsbuildinfo" -delete

## Start the local Docker stack (Phase 2+: Postgres, Redis, API, Worker)
docker-up:
	docker compose -f docker/compose.yml up -d

## Stop the local Docker stack
docker-down:
	docker compose -f docker/compose.yml down

## Scan the fixtures directory (smoke test after first build)
scan-fixtures:
	node apps/cli/dist/index.js scan fixtures/python-app --output /tmp/thirdwatch-test.json
	@echo "TDM written to /tmp/thirdwatch-test.json"
