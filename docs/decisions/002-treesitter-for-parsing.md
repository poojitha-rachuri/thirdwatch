# ADR 002 — tree-sitter for Code Parsing (via web-tree-sitter WASM)

**Date:** 2026-02-21
**Status:** Accepted

## Context

The scanner needs to detect patterns (HTTP calls, SDK instantiations, connection strings) across multiple programming languages. Options considered:

1. **Regex / text patterns** — fast to write, fragile, high false-positive rate
2. **Language-specific parsers** — accurate but requires implementing N parsers
3. **tree-sitter** — production-grade incremental parser supporting 40+ languages

## Decision

Use **tree-sitter** via the **`web-tree-sitter` WASM package** (not the native `tree-sitter` N-API binding).

## Rationale

**Why tree-sitter:**
- Used in production by Neovim, GitHub code search, Zed editor, and VS Code
- Supports 40+ languages with a single query engine (S-expressions)
- Incremental parsing: re-parsing only changed files is O(change size), not O(file size)
- Community-maintained grammars for every major language
- Enables pluggable language analyzers — adding Ruby doesn't touch the core

**Why WASM over native bindings:**
- No `node-gyp` compilation on `npm install` — the #1 source of install failures for developer CLIs
- Works in Node.js, browsers, Docker, CI environments without platform-specific builds
- The `web-tree-sitter` package is the same WASM build used by VS Code extensions

## Consequences

- Each language analyzer ships a `.wasm` grammar file in its npm package
- WASM initialization is async (`await Parser.init(...)`) — must happen once at scanner startup
- Slight performance penalty vs. native bindings — acceptable given the 60s budget for 100K LOC
- Community contributors add new languages by implementing the `LanguageAnalyzer` plugin interface and pointing at an existing tree-sitter grammar
