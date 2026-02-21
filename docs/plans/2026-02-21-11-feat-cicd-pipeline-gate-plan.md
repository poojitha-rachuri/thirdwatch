---
title: "feat: CI/CD Pipeline Gate — GitHub Action & Dependency Review"
type: feat
phase: 3 — The Brain
date: 2026-02-21
priority: P1 (Phase 3)
dependencies: Plan 5 (CLI Interface), Plan 2 (TDM Schema)
package: action/
---

# feat: CI/CD Pipeline Gate — GitHub Action & Dependency Review

## Overview

Build a GitHub Action that runs `thirdwatch scan` in CI, compares the resulting TDM against a previously stored baseline, and fails the build (or posts a warning) if new unmonitored external dependencies are detected. This is the "dependency review gate" — the equivalent of what `npm audit` does for security vulnerabilities, but for the entire external dependency surface. It also provides a GitLab CI template and a generic shell script for other CI systems.

## Problem Statement

Without a CI gate, new external dependencies are added to codebases silently. A developer adds a new third-party SDK or hardcodes a new API endpoint, and nobody registers it for monitoring. The CI gate creates a forcing function: every new external dependency must be explicitly acknowledged before it enters the codebase. This closes the loop between the scanner (producing TDMs) and the monitoring layer (watching dependencies).

## Proposed Solution

A GitHub Action (`action/`) that:
1. Runs `thirdwatch scan` on the current checkout
2. Downloads the stored baseline TDM from the Thirdwatch cloud or a specified artifact path
3. Computes a diff (new dependencies vs. removed dependencies)
4. Posts a PR comment summarizing the diff
5. Optionally fails the build if new unmonitored dependencies are detected

## Technical Approach

### Action Specification (`action/action.yml`)

```yaml
# action/action.yml
name: "Thirdwatch Dependency Gate"
description: "Scan for external dependencies and detect new unmonitored dependencies in your PR."
author: "Thirdwatch"
branding:
  icon: eye
  color: blue

inputs:
  path:
    description: "Path to the repository to scan"
    required: false
    default: "."
  baseline-tdm:
    description: "Path to a baseline TDM file, or 'cloud' to download from Thirdwatch cloud"
    required: false
    default: "cloud"
  token:
    description: "Thirdwatch API token (required for cloud baseline)"
    required: false
  github-token:
    description: "GitHub token for posting PR comments"
    required: false
    default: ${{ github.token }}
  fail-on-new-dependencies:
    description: "Fail the build if new external dependencies are detected"
    required: false
    default: "false"
  fail-on-breaking-changes:
    description: "Fail the build if known breaking changes affect new files in this PR"
    required: false
    default: "true"
  severity-threshold:
    description: "Minimum change severity to fail on: P0, P1, P2, P3"
    required: false
    default: "P1"
  format:
    description: "Output format for the TDM artifact: json or yaml"
    required: false
    default: "json"

outputs:
  new-dependencies:
    description: "JSON array of newly discovered dependencies"
  removed-dependencies:
    description: "JSON array of removed dependencies"
  tdm-path:
    description: "Path to the generated TDM file"
  scan-duration-ms:
    description: "Time taken to scan"

runs:
  using: "node20"
  main: "dist/index.js"
```

### Action Entry Point (`action/src/index.ts`)

```typescript
// action/src/index.ts
import * as core from "@actions/core";
import * as github from "@actions/github";
import { scan } from "@thirdwatch/core";
import { PythonPlugin } from "@thirdwatch/language-python";
import { JavaScriptPlugin } from "@thirdwatch/language-javascript";
import { diffTDMs, formatDiffAsMarkdown } from "./diff.js";
import { downloadBaselineTDM, uploadTDM } from "./cloud.js";
import { postPRComment } from "./github.js";
import { parseTDM } from "@thirdwatch/tdm";
import { writeFile, readFile } from "node:fs/promises";

async function run() {
  try {
    const scanPath = core.getInput("path");
    const baselineInput = core.getInput("baseline-tdm");
    const token = core.getInput("token");
    const githubToken = core.getInput("github-token");
    const failOnNew = core.getBooleanInput("fail-on-new-dependencies");
    const failOnBreaking = core.getBooleanInput("fail-on-breaking-changes");
    const severityThreshold = core.getInput("severity-threshold");

    // 1. Scan
    core.startGroup("Thirdwatch: Scanning dependencies");
    const tdm = await scan({
      root: scanPath,
      plugins: [new PythonPlugin(), new JavaScriptPlugin()],
    });
    const tdmJson = JSON.stringify(tdm, null, 2);
    await writeFile("thirdwatch.json", tdmJson);
    core.info(`Found ${tdm.metadata.total_dependencies_found} dependencies`);
    core.endGroup();

    core.setOutput("tdm-path", "thirdwatch.json");
    core.setOutput("scan-duration-ms", String(tdm.metadata.scan_duration_ms));

    // 2. Get baseline TDM
    let baselineTDM = null;
    if (baselineInput === "cloud" && token) {
      core.startGroup("Thirdwatch: Downloading baseline TDM");
      baselineTDM = await downloadBaselineTDM(token);
      core.endGroup();
    } else if (baselineInput !== "cloud") {
      try {
        baselineTDM = parseTDM(JSON.parse(await readFile(baselineInput, "utf8")));
      } catch {
        core.info("No baseline TDM found — treating all dependencies as new");
      }
    }

    // 3. Diff
    const diff = diffTDMs(baselineTDM, tdm);
    core.setOutput("new-dependencies", JSON.stringify(diff.added));
    core.setOutput("removed-dependencies", JSON.stringify(diff.removed));

    // 4. Post PR comment
    if (github.context.eventName === "pull_request" && githubToken) {
      const octokit = github.getOctokit(githubToken);
      const comment = formatDiffAsMarkdown(diff, tdm);
      await postPRComment(octokit, github.context, comment);
    }

    // 5. Upload new TDM to cloud (for future baseline)
    if (token) {
      await uploadTDM(token, tdm);
    }

    // 6. Fail check
    if (failOnNew && diff.added.length > 0) {
      core.setFailed(
        `${diff.added.length} new external dependencies detected. Review and register them for monitoring.`
      );
      return;
    }

    if (failOnBreaking && diff.breakingChangesAffectingPR.length > 0) {
      const highPriority = diff.breakingChangesAffectingPR.filter(
        c => priorityIndex(c.priority) <= priorityIndex(severityThreshold as Priority)
      );
      if (highPriority.length > 0) {
        core.setFailed(
          `${highPriority.length} known breaking changes affect files in this PR. See PR comment for details.`
        );
      }
    }

  } catch (err) {
    core.setFailed(String(err));
  }
}

run();
```

### TDM Diff (`action/src/diff.ts`)

```typescript
// action/src/diff.ts

export interface TDMDiff {
  added: DependencyEntry[];    // In new TDM, not in baseline
  removed: DependencyEntry[];  // In baseline, not in new TDM
  unchanged: DependencyEntry[];
  breakingChangesAffectingPR: BreakingChangeRef[]; // From cloud API
  summary: DiffSummary;
}

export function diffTDMs(baseline: TDM | null, current: TDM): TDMDiff {
  if (!baseline) {
    return {
      added: extractAllEntries(current),
      removed: [],
      unchanged: [],
      breakingChangesAffectingPR: [],
      summary: { addedCount: current.metadata.total_dependencies_found, removedCount: 0 },
    };
  }

  // Use identifier (name+ecosystem for packages, url+method for APIs) as key
  const baselineKeys = new Set(extractAllEntries(baseline).map(getKey));
  const currentEntries = extractAllEntries(current);

  return {
    added: currentEntries.filter(e => !baselineKeys.has(getKey(e))),
    removed: extractAllEntries(baseline).filter(e => !new Set(currentEntries.map(getKey)).has(getKey(e))),
    unchanged: currentEntries.filter(e => baselineKeys.has(getKey(e))),
    breakingChangesAffectingPR: [],
    summary: { addedCount: 0, removedCount: 0 }, // computed
  };
}
```

### PR Comment Format (`action/src/diff.ts`)

````typescript
export function formatDiffAsMarkdown(diff: TDMDiff, tdm: TDM): string {
  const { added, removed } = diff;
  const totalCount = tdm.metadata.total_dependencies_found;

  return `## Thirdwatch Dependency Report

**${totalCount} total external dependencies** scanned across ${tdm.metadata.languages_detected.join(", ")}.

${added.length > 0 ? `### ✨ New Dependencies (${added.length})
These dependencies are new in this PR and are not yet registered for monitoring.
${added.slice(0, 15).map(dep => `- \`${getKey(dep)}\` *(${dep.kind})*`).join("\n")}
${added.length > 15 ? `*...and ${added.length - 15} more*` : ""}

` : ""}${removed.length > 0 ? `### 🗑️ Removed Dependencies (${removed.length})
${removed.slice(0, 10).map(dep => `- \`${getKey(dep)}\``).join("\n")}

` : ""}${added.length === 0 && removed.length === 0 ? "✅ No dependency surface area changes detected in this PR.\n" : ""}
<details>
<summary>Full TDM breakdown</summary>

| Section | Count |
|---|---|
| 📦 Packages | ${tdm.packages.length} |
| 🌐 External APIs | ${tdm.apis.length} |
| 🔧 SDKs | ${tdm.sdks.length} |
| 🗄️ Infrastructure | ${tdm.infrastructure.length} |
| 🔗 Webhooks | ${tdm.webhooks.length} |

</details>

---
*[Thirdwatch](https://thirdwatch.dev) · [View full report →](https://app.thirdwatch.dev)*`;
}
````

### GitHub Actions Workflow Example

```yaml
# .github/workflows/thirdwatch.yml (example for users to copy)
name: Thirdwatch Dependency Gate

on:
  pull_request:
  push:
    branches: [main]

jobs:
  thirdwatch:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write  # For PR comments

    steps:
      - uses: actions/checkout@v4

      - uses: thirdwatch/action@v1
        with:
          token: ${{ secrets.THIRDWATCH_TOKEN }}
          fail-on-new-dependencies: false      # Warn only
          fail-on-breaking-changes: true        # Fail on P0/P1
          severity-threshold: P1

      # The TDM is available as an artifact for downstream steps
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: thirdwatch-tdm
          path: thirdwatch.json
```

### GitLab CI Template (`action/gitlab-ci-template.yml`)

```yaml
# .gitlab/ci/thirdwatch.yml — include in your .gitlab-ci.yml
thirdwatch:
  stage: test
  image: node:20-alpine
  script:
    - npm install -g thirdwatch
    - thirdwatch scan . --output thirdwatch.json
    - |
      if [ -n "$THIRDWATCH_TOKEN" ]; then
        thirdwatch push thirdwatch.json --token $THIRDWATCH_TOKEN
      fi
  artifacts:
    reports:
      # Expose TDM as a job artifact
    paths:
      - thirdwatch.json
    when: always
  allow_failure: true  # Change to false to make it a hard gate
```

### Generic Shell Script (`action/thirdwatch-gate.sh`)

```bash
#!/usr/bin/env bash
# thirdwatch-gate.sh — Generic CI gate script for any CI system
# Usage: THIRDWATCH_TOKEN=xxx ./thirdwatch-gate.sh [path]
set -euo pipefail

SCAN_PATH="${1:-.}"
OUTPUT="./thirdwatch.json"

echo "→ Running thirdwatch scan..."
npx thirdwatch@latest scan "$SCAN_PATH" --output "$OUTPUT"

FOUND=$(jq '.metadata.total_dependencies_found' "$OUTPUT")
echo "→ Found $FOUND external dependencies"

if [ -n "${THIRDWATCH_TOKEN:-}" ]; then
  echo "→ Uploading TDM for monitoring..."
  npx thirdwatch push "$OUTPUT" --token "$THIRDWATCH_TOKEN"
fi

echo "✓ Thirdwatch scan complete. TDM at: $OUTPUT"
```

### Action Build Pipeline

```json
// action/package.json
{
  "name": "@thirdwatch/action",
  "version": "1.0.0",
  "private": true,
  "license": "Apache-2.0",
  "main": "dist/index.js",
  "scripts": {
    "build": "ncc build src/index.ts --license licenses.txt",
    "test": "vitest run"
  },
  "dependencies": {
    "@actions/core": "^1.10.0",
    "@actions/github": "^6.0.0",
    "@thirdwatch/core": "workspace:*",
    "@thirdwatch/language-python": "workspace:*",
    "@thirdwatch/language-javascript": "workspace:*",
    "@thirdwatch/tdm": "workspace:*"
  },
  "devDependencies": {
    "@vercel/ncc": "^0.38.0"
  }
}
```

The action is bundled with `@vercel/ncc` into a single `dist/index.js` — no `node_modules` in the action repo.

## Implementation Phases

### Phase 11.1: Action Scaffold
- Create `action/` directory with `action.yml` and `package.json`
- Set up `@vercel/ncc` build pipeline
- Write minimal `src/index.ts` that logs "Thirdwatch gate running"
- Verify action runs in a test workflow

### Phase 11.2: Scan Integration
- Wire `@thirdwatch/core` scan into the action
- Write TDM to `thirdwatch.json`
- Upload as a job artifact

### Phase 11.3: TDM Diff
- Implement `diffTDMs()` with correct key matching
- Unit tests for diff: added/removed/unchanged cases
- Test with fixture TDMs

### Phase 11.4: PR Comments
- Implement `postPRComment()` with upsert (update existing comment if present)
- Implement `formatDiffAsMarkdown()`
- Test: PR with new dependency → comment appears

### Phase 11.5: Cloud Integration
- Implement `downloadBaselineTDM()` and `uploadTDM()`
- Implement fail-on-new-dependencies and fail-on-breaking-changes logic

### Phase 11.6: GitLab + Shell
- Write GitLab CI template
- Write shell script
- Document both in `docs/contributing/cicd-setup.md`

## Acceptance Criteria

- [ ] Action completes on a public repo in under 2 minutes
- [ ] PR comment is posted with correct new/removed counts
- [ ] PR comment is updated (not duplicated) on subsequent pushes to the same PR
- [ ] `fail-on-new-dependencies: true` causes action to exit with code 1 when new deps found
- [ ] `fail-on-new-dependencies: false` passes even with new dependencies (warning only)
- [ ] Action works without a `token` (offline mode — no cloud upload)
- [ ] TDM artifact is uploaded to GitHub Actions artifacts
- [ ] Shell script runs without errors on bash 3.x (macOS compatibility)
- [ ] Action is listed in the GitHub Marketplace

## File Inventory

| File | Description |
|---|---|
| `action/action.yml` | Action specification |
| `action/src/index.ts` | Main action entry point |
| `action/src/diff.ts` | TDM diff computation + markdown formatting |
| `action/src/cloud.ts` | Thirdwatch API client |
| `action/src/github.ts` | PR comment utilities |
| `action/package.json` | Action dependencies |
| `action/gitlab-ci-template.yml` | GitLab CI template |
| `action/thirdwatch-gate.sh` | Generic shell script |
| `action/src/__tests__/diff.test.ts` | Diff unit tests |
| `docs/contributing/cicd-setup.md` | CI setup documentation |

## References

- [GitHub Actions toolkit](https://github.com/actions/toolkit)
- [@vercel/ncc — bundle Actions](https://github.com/vercel/ncc)
- [GitHub Marketplace publishing guide](https://docs.github.com/en/actions/creating-actions/publishing-actions-in-github-marketplace)
- PRD FR-4.7
