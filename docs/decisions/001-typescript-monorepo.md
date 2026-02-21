# ADR 001 — TypeScript Monorepo (pnpm + Turborepo)

**Date:** 2026-02-21
**Status:** Accepted

## Context

Thirdwatch has four distinct layers (Scanner, Watcher, Analyzer, Notifier) and a website. We need a repo structure that:
- Allows all layers to share types without duplication
- Lets community contributors work on one part without understanding all parts
- Supports independent versioning of the CLI vs. the cloud packages
- Is familiar to the widest possible pool of contractors and contributors

## Decision

Use a **TypeScript monorepo** managed with **pnpm workspaces** and **Turborepo**.

All code — the CLI scanner, cloud services, and website — is TypeScript. No Go, no Rust, no Python for the tooling itself.

## Rationale

- **Single language** massively reduces onboarding friction for contractors. A Go scanner + TypeScript cloud services would require developers to context-switch mid-PR.
- **pnpm** is the fastest package manager for monorepos, with strict hoisting that prevents phantom dependency bugs.
- **Turborepo** provides build caching and parallel execution across packages. A fresh `pnpm build` after a `packages/core` change only rebuilds packages that depend on it.
- **TypeScript** has the best `web-tree-sitter` bindings, natural npm distribution, and strong typing for the TDM schema.
- Performance concern: a TypeScript/Node.js scanner processing 100K LOC in <60s is achievable with worker threads (Piscina) and WASM tree-sitter. Premature optimization toward Go/Rust is not warranted at Phase 1.

## Consequences

- All developers need Node.js ≥ 20 and pnpm ≥ 9.
- The `web-tree-sitter` WASM approach means no native compilation (`node-gyp`) on install — critical for a smooth install experience.
- If performance becomes a bottleneck at scale, the hot path in `packages/core` can be rewritten to a native addon without changing the public API.
