# Thirdwatch

**Know before you break** — continuous monitoring for every external dependency in your codebase.

[![CI](https://github.com/thirdwatch/thirdwatch/actions/workflows/ci.yml/badge.svg)](https://github.com/thirdwatch/thirdwatch/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/thirdwatch)](https://www.npmjs.com/package/thirdwatch)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)

---

## The Problem

Your codebase silently depends on dozens of external services, APIs, packages, and endpoints you don't control. Dependabot watches your package versions. Nobody watches the Stripe API you call 200 times, the OpenAI endpoint you bill on, or the Redis connection string your auth service depends on.

When those change, you find out through production incidents — not proactive alerts.

## What Thirdwatch Does

Thirdwatch scans your codebase using [tree-sitter](https://tree-sitter.github.io/tree-sitter/) AST parsing and produces a **Thirdwatch Dependency Manifest (TDM)** — a structured JSON/YAML file cataloging every external dependency:

- 📦 **Packages** — npm, PyPI, Go modules
- 🌐 **External APIs** — every HTTP endpoint your code calls
- 🔧 **SDKs** — Stripe, AWS, OpenAI, Twilio, and more
- 🗄️ **Infrastructure** — databases, message queues, storage services
- 🔗 **Webhooks** — outbound registrations and callback URLs

The cloud service (coming in Phase 2) monitors these dependencies continuously and alerts you before breaking changes reach production.

## Quick Start

```bash
# Install
npm install -g thirdwatch

# Scan your codebase
thirdwatch scan /path/to/your/repo

# Output
# ✔ Scanning 847 files (Python, TypeScript)...
# 📦 12 packages  🌐 8 APIs  🔧 3 SDKs  🗄️ 4 infra
# TDM written to ./thirdwatch.json
```

## Installation

```bash
# npm (recommended)
npm install -g thirdwatch

# Homebrew
brew install thirdwatch/tap/thirdwatch

# pip (Python ecosystem convenience)
pip install thirdwatch
```

## CLI Reference

```
thirdwatch scan [path] [options]

Arguments:
  path                    Path to scan (default: current directory)

Options:
  -o, --output <file>     Output file path (default: ./thirdwatch.json)
  -f, --format <format>   Output format: json or yaml (default: json)
  --languages <langs...>  Languages to scan (default: auto-detect)
  --ignore <patterns...>  Glob patterns to ignore
  --config <file>         Path to .thirdwatch.yml config file
  --no-resolve            Skip environment variable resolution
  --verbose               Print detailed logs
  --quiet                 Suppress all output except the TDM
  -v, --version           Print version
  -h, --help              Show help
```

## Configuration

Create `.thirdwatch.yml` in your project root:

```yaml
version: "1"

ignore:
  - "tests/**"
  - "**/*.min.js"

env:
  STRIPE_API_BASE: "https://api.stripe.com"
```

Add `.thirdwatchignore` for file exclusions (same syntax as `.gitignore`).

## The TDM Format

The Thirdwatch Dependency Manifest is an open, versioned JSON format. See the [TDM specification](schema/v1/) and [JSON Schema](schema/v1/tdm.schema.json).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The highest-value contributions are:
- **Language analyzer plugins** — add support for Ruby, Java, Rust, etc.
- **SDK registry entries** — add patterns for SDKs not yet detected

## Architecture

Thirdwatch is a TypeScript monorepo with four layers:

1. **Scanner** (`packages/core` + `packages/languages/*`) — tree-sitter AST parsing
2. **Watcher** (`packages/watcher`) — registry polling + change detection
3. **Analyzer** (`packages/analyzer`) — impact scoring + code mapping
4. **Notifier** (`packages/notifier`) — GitHub, Slack, Jira, email, webhooks

## License

The CLI, scanner, and TDM format are [Apache 2.0](LICENSE).

Cloud features (watcher, analyzer, notifier services) use the [Business Source License 1.1](LICENSE-CLOUD), which converts to Apache 2.0 after 3 years.
