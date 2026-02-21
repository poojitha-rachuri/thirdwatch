---
title: "feat: Scanner CLI Interface & Distribution"
type: feat
phase: 1 — The Map
date: 2026-02-21
priority: P0
dependencies: Plan 3 (Scanner Core), Plan 4 (Dependency Detectors)
package: apps/cli
---

# feat: Scanner CLI Interface & Distribution

## Overview

Build the `thirdwatch` CLI — the user-facing entry point for Phase 1. This wraps `@thirdwatch/core` in a polished command-line interface using `commander` and ships it as an npm package installable via `npm i -g thirdwatch`, `brew install thirdwatch`, and a Python wrapper. The CLI is the product that gets HN-front-paged, earns GitHub stars, and builds trust with developers.

## Problem Statement

The scanner core is a library. Developers need a CLI they can run in a terminal, drop in a Makefile, and pipe into CI. First impressions matter enormously for OSS adoption. A rough CLI that crashes on common inputs, has confusing output, or doesn't explain itself will kill momentum. A polished CLI that works on the first try gets bookmarked and shared.

## Proposed Solution

A `commander`-based CLI in `apps/cli` that:
1. Exposes `thirdwatch scan` as the primary command
2. Outputs beautifully formatted console output with `@clack/prompts` for spinners/progress
3. Writes a TDM JSON/YAML file to disk
4. Prints a human-readable summary table to stdout
5. Supports all options from FR-1.8
6. Is published to npm as `thirdwatch` (top-level, not scoped)

## Technical Approach

### CLI Structure

```
apps/cli/
├── src/
│   ├── index.ts           # Entry point — creates Commander program
│   ├── commands/
│   │   └── scan.ts        # `thirdwatch scan` command handler
│   ├── output/
│   │   ├── summary.ts     # Human-readable summary table
│   │   ├── json.ts        # JSON output formatter
│   │   └── yaml.ts        # YAML output formatter
│   ├── ui/
│   │   ├── spinner.ts     # Progress spinner wrapper
│   │   └── table.ts       # Summary table renderer
│   └── update-check.ts    # Check for newer CLI version
├── bin/
│   └── thirdwatch.js      # Shebang entry point
└── package.json
```

### `apps/cli/src/index.ts`

```typescript
// apps/cli/src/index.ts
import { Command } from "commander";
import { scanCommand } from "./commands/scan.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const { version } = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../package.json"), "utf8")
);

const program = new Command();

program
  .name("thirdwatch")
  .description("Know before you break — map every external dependency in your codebase.")
  .version(version, "-v, --version");

program.addCommand(scanCommand);

program.parse();
```

### `apps/cli/src/commands/scan.ts`

```typescript
// apps/cli/src/commands/scan.ts
import { Command } from "commander";
import { intro, outro, spinner, note, cancel } from "@clack/prompts";
import { scan } from "@thirdwatch/core";
import { PythonPlugin } from "@thirdwatch/language-python";
import { JavaScriptPlugin } from "@thirdwatch/language-javascript";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { printSummaryTable } from "../output/summary.js";
import yaml from "js-yaml";

export const scanCommand = new Command("scan")
  .description("Scan a codebase and produce a Thirdwatch Dependency Manifest (TDM).")
  .argument("[path]", "Path to scan (default: current directory)", ".")
  .option("-o, --output <file>", "Output file path", "./thirdwatch.json")
  .option("-f, --format <format>", "Output format: json or yaml", "json")
  .option("--languages <langs...>", "Languages to scan (default: auto-detect)")
  .option("--ignore <patterns...>", "Glob patterns to ignore")
  .option("--config <file>", "Path to .thirdwatch.yml config file")
  .option("--no-resolve", "Skip environment variable resolution")
  .option("--verbose", "Print detailed logs")
  .option("--quiet", "Suppress all output except the TDM")
  .action(async (scanPath: string, opts) => {
    if (!opts.quiet) {
      intro("thirdwatch scan");
    }

    const s = spinner();
    if (!opts.quiet) s.start("Discovering files…");

    const outputPath = resolve(opts.output);
    const root = resolve(scanPath);

    const plugins = [new PythonPlugin(), new JavaScriptPlugin()];

    try {
      const tdm = await scan({
        root,
        plugins,
        ignore: opts.ignore,
        configFile: opts.config,
        resolveEnv: opts.resolve !== false,
      });

      if (!opts.quiet) s.stop(`Scan complete — ${tdm.metadata.total_dependencies_found} dependencies found`);

      // Write output file
      const output =
        opts.format === "yaml"
          ? yaml.dump(tdm)
          : JSON.stringify(tdm, null, 2);
      await writeFile(outputPath, output, "utf8");

      if (!opts.quiet) {
        printSummaryTable(tdm);
        outro(`TDM written to ${outputPath}`);
      } else {
        process.stdout.write(output);
      }

      process.exitCode = 0;
    } catch (err) {
      if (!opts.quiet) {
        s.stop("Scan failed");
        cancel(String(err));
      }
      process.exitCode = 1;
    }
  });
```

### Summary Table Output (example terminal output)

```
┌─────────────────────────────────────────────────────────────┐
│  thirdwatch scan — payments-service                          │
│  Scanned 847 files in 4.2s (Python, JavaScript)             │
└─────────────────────────────────────────────────────────────┘

📦 Packages (12)
  pypi  stripe          7.9.0   14 usages   ● high
  pypi  boto3           1.34.0  23 usages   ● high
  npm   openai          4.24.0   6 usages   ● high
  npm   pg              8.11.0   3 usages   ● high
  ...

🌐 External APIs (8)
  ● high    POST  https://api.openai.com/v1/chat/completions    6 calls
  ● high    POST  https://api.stripe.com/v1/charges             14 calls
  ● medium  GET   ${PARTNER_API_BASE}/v2/orders                  2 calls
  ...

🔧 SDKs (3)
  ● high    aws (boto3)       s3, sqs, dynamodb   23 usages
  ● high    stripe            payments/stripe_client.py:3
  ● high    openai            ai/completion_service.py:78

🗄️  Infrastructure (4)
  ● medium  postgresql  ${DATABASE_URL}
  ● high    redis       redis://cache.internal:6379
  ...

  TDM written to ./thirdwatch.json (47 dependencies, 4 sections)
```

### `apps/cli/package.json`

```json
// apps/cli/package.json
{
  "name": "thirdwatch",
  "version": "0.1.0",
  "description": "Know before you break — map every external dependency in your codebase.",
  "license": "Apache-2.0",
  "bin": {
    "thirdwatch": "./bin/thirdwatch.js"
  },
  "main": "./dist/index.js",
  "type": "module",
  "scripts": {
    "build": "tsc && chmod +x bin/thirdwatch.js",
    "test": "vitest run",
    "dev": "node --watch dist/index.js"
  },
  "dependencies": {
    "@thirdwatch/core": "workspace:*",
    "@thirdwatch/language-python": "workspace:*",
    "@thirdwatch/language-javascript": "workspace:*",
    "commander": "^12.0.0",
    "@clack/prompts": "^0.9.0",
    "js-yaml": "^4.1.0",
    "chalk": "^5.3.0",
    "cli-table3": "^0.6.3"
  },
  "engines": {
    "node": ">=20.0.0"
  },
  "keywords": [
    "api-monitoring",
    "dependency-scanning",
    "sbom",
    "code-analysis",
    "third-party-apis",
    "tree-sitter"
  ]
}
```

### `bin/thirdwatch.js`

```javascript
#!/usr/bin/env node
// bin/thirdwatch.js
import "../dist/index.js";
```

### Update Check (`apps/cli/src/update-check.ts`)

```typescript
// apps/cli/src/update-check.ts
// Non-blocking version check on startup — shows "Update available: 0.1.0 → 0.2.0"
import { execFileSync } from "node:child_process";
export async function checkForUpdates(currentVersion: string): Promise<void> {
  // Fetch latest from npm registry (with timeout + cache)
  // Show note() if newer version available
  // Never block the scan
}
```

### Distribution Channels

#### 1. npm (primary)
```bash
npm install -g thirdwatch
# or
npx thirdwatch scan
```

#### 2. Homebrew Tap
Create `github.com/thirdwatch/homebrew-thirdwatch`:
```ruby
# Formula/thirdwatch.rb
class Thirdwatch < Formula
  desc "Know before you break — map every external dependency in your codebase"
  homepage "https://thirdwatch.dev"
  url "https://registry.npmjs.org/thirdwatch/-/thirdwatch-0.1.0.tgz"
  sha256 "..."
  license "Apache-2.0"

  depends_on "node"

  def install
    system "npm", "install", *Language::Node.std_npm_install_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end
end
```

#### 3. pip wrapper (Python ecosystem convenience)
```python
# pip install thirdwatch (a thin wrapper that runs the npm package)
# pyproject.toml for the pip wrapper
[project]
name = "thirdwatch"
description = "Python wrapper for the thirdwatch CLI"
# Uses subprocess to run 'npx thirdwatch' or falls back to npm install
```

#### 4. Direct binary download (via GitHub Releases)
Use `pkg` or `@vercel/ncc` + `caxa` to bundle a standalone binary for:
- `thirdwatch-linux-x64`
- `thirdwatch-macos-arm64`
- `thirdwatch-macos-x64`
- `thirdwatch-windows-x64.exe`

### Exit Codes

| Code | Meaning |
|---|---|
| 0 | Scan completed successfully |
| 1 | Scan failed (unrecoverable error) |
| 2 | Invalid arguments or configuration |
| 3 | New unmonitored dependencies detected (used by CI gate, Plan 11) |

### `.thirdwatchignore` Support

```
# .thirdwatchignore.example
# Same syntax as .gitignore
node_modules/
.git/
dist/
build/
*.min.js
*.generated.ts
vendor/
```

## Implementation Phases

### Phase 5.1: CLI Scaffold
- Initialize `apps/cli` package with correct `package.json`
- Set up `bin/thirdwatch.js` with shebang
- Wire Commander program with `scan` subcommand stub
- Verify `node bin/thirdwatch.js --help` works

### Phase 5.2: Scan Command
- Implement `scan.ts` calling `@thirdwatch/core`
- Connect PythonPlugin and JavaScriptPlugin
- Test: `thirdwatch scan fixtures/python-app` produces a valid TDM file

### Phase 5.3: Output Formatting
- Implement `printSummaryTable()` with colored terminal output
- Handle `--quiet` (raw JSON only), `--verbose` (file-by-file progress)
- Handle `--format yaml` output

### Phase 5.4: UX Polish
- Add version check on startup (non-blocking)
- Add descriptive error messages for common failures (no files found, no permissions, etc.)
- Add `--no-color` support for CI environments

### Phase 5.5: Distribution
- Set up npm publish in `release.yml` CI workflow
- Create `homebrew-thirdwatch` GitHub repo and formula
- Create standalone binary build script using `caxa`

## Acceptance Criteria

- [ ] `npm install -g thirdwatch && thirdwatch scan .` works on a clean machine
- [ ] `thirdwatch scan fixtures/python-app --output ./out.json` writes a valid TDM
- [ ] `thirdwatch scan . --format yaml` writes valid YAML
- [ ] `thirdwatch scan . --quiet` writes only the JSON to stdout (no spinner)
- [ ] `thirdwatch --help` and `thirdwatch scan --help` show complete, accurate docs
- [ ] `thirdwatch --version` prints the correct semver
- [ ] Summary table shows counts per section with confidence indicators
- [ ] Non-zero exit code on scan failure
- [ ] `.thirdwatchignore` patterns are respected
- [ ] Homebrew formula installs successfully on macOS

## File Inventory

| File | Description |
|---|---|
| `apps/cli/src/index.ts` | Commander program entry |
| `apps/cli/src/commands/scan.ts` | Scan command |
| `apps/cli/src/output/summary.ts` | Summary table |
| `apps/cli/src/output/json.ts` | JSON formatter |
| `apps/cli/src/output/yaml.ts` | YAML formatter |
| `apps/cli/src/ui/spinner.ts` | Spinner wrapper |
| `apps/cli/src/update-check.ts` | Version check |
| `apps/cli/bin/thirdwatch.js` | Shebang entry |
| `apps/cli/package.json` | Package manifest |
| `apps/cli/src/__tests__/scan.test.ts` | CLI integration tests |
| `.thirdwatchignore.example` | Ignore file example |

## References

- [Commander.js](https://github.com/tj/commander.js)
- [@clack/prompts](https://github.com/bombshell-dev/clack)
- [caxa — standalone binary bundler](https://github.com/leafac/caxa)
- [Homebrew formula development](https://docs.brew.sh/Formula-Cookbook)
- PRD FR-1.8, FR-1.9
