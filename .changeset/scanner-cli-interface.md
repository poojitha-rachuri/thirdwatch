---
"thirdwatch": minor
"@thirdwatch/core": patch
---

feat: implement scanner CLI interface with `thirdwatch scan` command

- Full Commander-based CLI with scan command and all options (--output, --format, --languages, --ignore, --config, --quiet, --verbose, --no-color, --no-resolve)
- Support `-o -` for stdout-only output
- Colored summary table with confidence indicators
- Path traversal protection on --output
- Non-blocking update check (stderr only, skipped in CI/non-TTY)
- Fix fast-glob CJS import for Node 20 ESM compatibility
