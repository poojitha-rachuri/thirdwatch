---
title: "feat: Extensive Manifest Support — Every Major Package Format"
type: feat
phase: 1 — The Map (expansion)
date: 2026-02-24
priority: P0
dependencies: Plan 3 (Scanner Core), Plans 12–15 (Language Analyzers)
package: packages/languages/*, packages/core
---

# feat: Extensive Manifest Support — Every Major Package Format

## Overview

Expand Thirdwatch's manifest file parsing from 2 formats (`package.json`, `requirements.txt`) to 25+ formats across all supported languages. Manifest parsing is the highest-confidence detection method — it provides exact package names, versions, and ecosystems with zero false positives. This is the single most impactful improvement for TDM completeness.

## Problem Statement

The current scanner misses the majority of declared dependencies because it only parses 2 out of 25+ common manifest formats:

| Language | Supported | Missing |
|---|---|---|
| Python | `requirements.txt` | `pyproject.toml`, `Pipfile`, `setup.py`, `setup.cfg`, `poetry.lock`, `conda environment.yml` |
| JavaScript | `package.json` | `yarn.lock`, `pnpm-lock.yaml`, `package-lock.json`, `deno.json` |
| Go | — | `go.mod`, `go.sum` |
| Java | — | `pom.xml`, `build.gradle`, `build.gradle.kts`, `libs.versions.toml` |
| Rust | — | `Cargo.toml`, `Cargo.lock` |
| PHP | — | `composer.json`, `composer.lock` |

A project using `pyproject.toml` instead of `requirements.txt` currently produces ZERO package entries — a critical gap.

## Proposed Solution

Implement parsers for every major manifest format, organized by language. Each parser implements a consistent interface and integrates with the existing `analyzeManifests()` plugin method. Complex formats use established npm libraries: `smol-toml` for TOML, `fast-xml-parser` for XML, custom parsers for go.mod and yarn.lock.

## Technical Approach

### Core Scanner Changes

The scanner's file discovery must recognize all manifest filenames:

```typescript
// packages/core/src/scanner.ts — expanded manifest patterns
const MANIFEST_PATTERNS = [
  // Python
  "requirements.txt", "requirements-*.txt", "requirements/*.txt",
  "pyproject.toml", "Pipfile", "setup.py", "setup.cfg",
  "poetry.lock", "environment.yml",
  // JavaScript/TypeScript
  "package.json", "package-lock.json", "yarn.lock",
  "pnpm-lock.yaml", "deno.json", "deno.lock",
  // Go
  "go.mod", "go.sum",
  // Java
  "pom.xml", "build.gradle", "build.gradle.kts",
  "gradle.properties", "libs.versions.toml",
  // Rust
  "Cargo.toml", "Cargo.lock",
  // PHP
  "composer.json", "composer.lock",
];
```

### Python — `pyproject.toml`

Supports PEP 621 (`[project.dependencies]`), Poetry (`[tool.poetry.dependencies]`), and PDM (`[tool.pdm.dependencies]`):

```toml
# PEP 621 format
[project]
dependencies = [
    "stripe>=7.0.0",
    "boto3~=1.34",
    "requests>=2.31,<3.0",
]

[project.optional-dependencies]
dev = ["pytest>=7.0"]

# Poetry format
[tool.poetry.dependencies]
python = "^3.11"
stripe = "^7.0.0"
boto3 = "~1.34"
redis = {version = "^5.0", optional = true}
```

```typescript
// packages/languages/python/src/manifests/pyproject.ts
import { parse as parseTOML } from "smol-toml";

export function parsePyprojectToml(content: string, manifestFile: string): DependencyEntry[] {
  const entries: DependencyEntry[] = [];
  const pyproject = parseTOML(content) as Record<string, unknown>;

  // PEP 621: [project.dependencies]
  const project = pyproject.project as Record<string, unknown> | undefined;
  if (project?.dependencies) {
    const deps = project.dependencies as string[];
    for (const dep of deps) {
      const parsed = parsePep508(dep);
      if (parsed) entries.push(makeEntry(parsed.name, parsed.constraint, manifestFile));
    }
  }

  // PEP 621: [project.optional-dependencies]
  const optDeps = project?.["optional-dependencies"] as Record<string, string[]> | undefined;
  if (optDeps) {
    for (const group of Object.values(optDeps)) {
      for (const dep of group) {
        const parsed = parsePep508(dep);
        if (parsed) entries.push(makeEntry(parsed.name, parsed.constraint, manifestFile));
      }
    }
  }

  // Poetry: [tool.poetry.dependencies]
  const tool = pyproject.tool as Record<string, unknown> | undefined;
  const poetry = tool?.poetry as Record<string, unknown> | undefined;
  if (poetry?.dependencies) {
    const deps = poetry.dependencies as Record<string, unknown>;
    for (const [name, value] of Object.entries(deps)) {
      if (name === "python") continue;
      let version = "unknown";
      if (typeof value === "string") version = value;
      else if (typeof value === "object" && value !== null) {
        version = (value as Record<string, unknown>).version as string ?? "unknown";
      }
      entries.push(makeEntry(name, version, manifestFile));
    }
  }

  return entries;
}

function parsePep508(spec: string): { name: string; constraint?: string } | null {
  const match = spec.match(/^([A-Za-z0-9_\-.]+)\s*(.*)$/);
  if (!match) return null;
  return {
    name: match[1]!.toLowerCase().replace(/_/g, "-"),
    constraint: match[2]?.replace(/;.*$/, "").trim() || undefined,
  };
}
```

### Python — `Pipfile`

```toml
[packages]
stripe = ">=7.0"
boto3 = "*"
requests = {version = ">=2.31", extras = ["security"]}

[dev-packages]
pytest = "*"
```

```typescript
export function parsePipfile(content: string, manifestFile: string): DependencyEntry[] {
  const pipfile = parseTOML(content) as Record<string, unknown>;
  const entries: DependencyEntry[] = [];

  for (const section of ["packages", "dev-packages"]) {
    const deps = pipfile[section] as Record<string, unknown> | undefined;
    if (!deps) continue;

    for (const [name, value] of Object.entries(deps)) {
      let version = "unknown";
      if (typeof value === "string") version = value === "*" ? "any" : value;
      else if (typeof value === "object" && value !== null) {
        version = (value as Record<string, unknown>).version as string ?? "unknown";
      }
      entries.push(makeEntry(name, version, manifestFile));
    }
  }

  return entries;
}
```

### Python — `setup.py` / `setup.cfg`

```python
# setup.py (regex extraction)
setup(
    install_requires=[
        "stripe>=7.0",
        "boto3~=1.34",
    ],
)
```

```typescript
export function parseSetupPy(content: string, manifestFile: string): DependencyEntry[] {
  const entries: DependencyEntry[] = [];

  // Extract install_requires list
  const requiresMatch = content.match(/install_requires\s*=\s*\[([\s\S]*?)\]/);
  if (requiresMatch) {
    const items = requiresMatch[1]!.match(/['"]([^'"]+)['"]/g);
    if (items) {
      for (const item of items) {
        const dep = item.replace(/['"]/g, "");
        const parsed = parsePep508(dep);
        if (parsed) entries.push(makeEntry(parsed.name, parsed.constraint, manifestFile));
      }
    }
  }

  return entries;
}
```

### JavaScript — `yarn.lock`

Yarn v1 uses a custom format (not YAML):

```
stripe@^7.0.0:
  version "7.1.0"
  resolved "https://registry.yarnpkg.com/stripe/-/stripe-7.1.0.tgz#..."
  integrity sha512-...
```

```typescript
export function parseYarnLock(content: string, manifestFile: string): DependencyEntry[] {
  const entries: DependencyEntry[] = [];

  // Parse yarn.lock v1 format
  const entryRe = /^"?([^@\s]+)@([^":\n]+)"?:\s*\n\s+version "([^"]+)"/gm;
  for (const match of content.matchAll(entryRe)) {
    const name = match[1]!;
    const constraint = match[2]!;
    const resolved = match[3]!;

    // Deduplicate — yarn.lock has one entry per constraint
    entries.push({
      kind: "package",
      name,
      ecosystem: "npm",
      current_version: resolved,
      version_constraint: constraint,
      manifest_file: manifestFile,
      locations: [],
      usage_count: 0,
      confidence: "high",
    });
  }

  return deduplicateByName(entries);
}
```

### Go — `go.mod`

```typescript
// (See Plan 12 for full go.mod parser)
export function parseGoMod(content: string, manifestFile: string): DependencyEntry[] {
  // Parse require blocks and single-line requires
  // Filter out indirect dependencies
  // Handle replace directives
}
```

### Java — `pom.xml`

```typescript
// (See Plan 13 for full pom.xml parser with property interpolation)
import { XMLParser } from "fast-xml-parser";

export function parsePomXml(content: string, manifestFile: string): DependencyEntry[] {
  // Parse XML, extract <dependencies>, interpolate ${properties}
  // Handle <dependencyManagement> for version inheritance
  // Skip <scope>test</scope> dependencies
}
```

### Java — `libs.versions.toml` (Gradle Version Catalogs)

```toml
[versions]
stripe = "24.0.0"
aws = "2.21.0"

[libraries]
stripe = { module = "com.stripe:stripe-java", version.ref = "stripe" }
aws-s3 = { module = "software.amazon.awssdk:s3", version.ref = "aws" }
```

```typescript
export function parseVersionCatalog(content: string, manifestFile: string): DependencyEntry[] {
  const catalog = parseTOML(content) as Record<string, unknown>;
  const entries: DependencyEntry[] = [];

  const versions = catalog.versions as Record<string, string> | undefined ?? {};
  const libraries = catalog.libraries as Record<string, unknown> | undefined ?? {};

  for (const [, lib] of Object.entries(libraries)) {
    if (typeof lib !== "object" || lib === null) continue;
    const obj = lib as Record<string, unknown>;
    const module = obj.module as string | undefined;
    if (!module) continue;

    let version = "unknown";
    if (typeof obj.version === "string") {
      version = obj.version;
    } else if (typeof obj.version === "object" && obj.version !== null) {
      const ref = (obj.version as Record<string, unknown>).ref as string | undefined;
      if (ref && versions[ref]) version = versions[ref]!;
    }

    entries.push({
      kind: "package",
      name: module,
      ecosystem: "maven",
      current_version: version,
      manifest_file: manifestFile,
      locations: [],
      usage_count: 0,
      confidence: "high",
    });
  }

  return entries;
}
```

### Rust — `Cargo.toml`

```typescript
// (See Plan 14 for full Cargo.toml parser)
import { parse as parseTOML } from "smol-toml";

export function parseCargoToml(content: string, manifestFile: string): DependencyEntry[] {
  // Parse [dependencies], [dev-dependencies], [build-dependencies]
  // Handle string format: name = "1.0"
  // Handle table format: name = { version = "1.0", features = [...] }
  // Handle git dependencies: name = { git = "..." }
}
```

### PHP — `composer.json`

```typescript
// (See Plan 15 for full composer.json parser)
export function parseComposerJson(content: string, manifestFile: string): DependencyEntry[] {
  // Parse "require" and "require-dev"
  // Skip "php" and "ext-*" entries
  // Ecosystem: "packagist"
}
```

### Python — `conda environment.yml`

```yaml
name: myenv
dependencies:
  - python=3.11
  - numpy=1.26
  - pandas>=2.0
  - pip:
    - stripe>=7.0
    - boto3
```

```typescript
import yaml from "js-yaml";

export function parseCondaEnv(content: string, manifestFile: string): DependencyEntry[] {
  const env = yaml.load(content) as Record<string, unknown>;
  const entries: DependencyEntry[] = [];
  const deps = env.dependencies as unknown[];
  if (!Array.isArray(deps)) return [];

  for (const dep of deps) {
    if (typeof dep === "string") {
      const match = dep.match(/^([a-zA-Z0-9_-]+)([=><~!].+)?$/);
      if (match && match[1] !== "python") {
        entries.push({
          kind: "package",
          name: match[1]!,
          ecosystem: "conda",
          current_version: match[2]?.replace(/^[=]+/, "") ?? "unknown",
          manifest_file: manifestFile,
          locations: [],
          usage_count: 0,
          confidence: "high",
        });
      }
    }
    // pip sub-dependencies
    if (typeof dep === "object" && dep !== null && "pip" in dep) {
      const pipDeps = (dep as Record<string, unknown>).pip as string[];
      for (const pipDep of pipDeps ?? []) {
        const parsed = parsePep508(pipDep);
        if (parsed) {
          entries.push(makeEntry(parsed.name, parsed.constraint, manifestFile));
        }
      }
    }
  }

  return entries;
}
```

### Lockfile Strategy

Lockfiles provide **resolved versions** (exact pinned versions) vs manifests which provide **constraints** (ranges). Strategy:

1. **If lockfile exists alongside manifest**: Use lockfile for `current_version` (exact), manifest for `version_constraint`
2. **If only manifest exists**: Use constraint as `current_version` (best effort)
3. **If only lockfile exists**: Use lockfile alone

```typescript
export function mergeManifestAndLockfile(
  manifestEntries: DependencyEntry[],
  lockfileEntries: DependencyEntry[],
): DependencyEntry[] {
  const lockVersions = new Map(
    lockfileEntries.map((e) => [e.kind === "package" ? e.name : "", e]),
  );

  return manifestEntries.map((entry) => {
    if (entry.kind !== "package") return entry;
    const locked = lockVersions.get(entry.name);
    if (locked && locked.kind === "package") {
      return { ...entry, current_version: locked.current_version };
    }
    return entry;
  });
}
```

### Dependencies Required

```json
{
  "smol-toml": "^1.3.0",
  "fast-xml-parser": "^4.3.0",
  "js-yaml": "^4.1.0"
}
```

`smol-toml` covers: pyproject.toml, Pipfile, Cargo.toml, libs.versions.toml
`fast-xml-parser` covers: pom.xml
`js-yaml` covers: pnpm-lock.yaml, environment.yml (already a dependency)
Custom parsers needed for: go.mod, yarn.lock, setup.py

## Implementation Phases

### Phase 17.1: Python Manifests
- `pyproject.toml` (PEP 621 + Poetry + PDM)
- `Pipfile` (TOML)
- `setup.py` / `setup.cfg` (regex extraction)
- `conda environment.yml` (YAML)
- Improve existing `requirements.txt` (recursive `-r` includes)
- Tests for each format

### Phase 17.2: JavaScript Lockfiles
- `yarn.lock` (custom parser)
- `pnpm-lock.yaml` (YAML)
- `package-lock.json` (JSON)
- `deno.json` imports map
- Lockfile ↔ manifest version merging
- Tests for each format

### Phase 17.3: Go Manifests
- `go.mod` (custom parser)
- Handle `replace` and `exclude` directives
- Tests with multi-module Go workspaces

### Phase 17.4: Java Manifests
- `pom.xml` (XML with property interpolation)
- `build.gradle` + `build.gradle.kts` (regex)
- `libs.versions.toml` (TOML)
- `gradle.properties` (key=value for version resolution)
- Tests for each format

### Phase 17.5: Rust Manifests
- `Cargo.toml` (TOML, all dependency formats)
- `Cargo.lock` (TOML, resolved versions)
- Tests for workspace Cargo.toml

### Phase 17.6: PHP Manifests
- `composer.json` (JSON)
- `composer.lock` (JSON, resolved versions)
- Tests with real-world Laravel/Symfony composer files

### Phase 17.7: Core Scanner Updates
- Update `MANIFEST_PATTERNS` in scanner.ts to recognize all new filenames
- Wire lockfile ↔ manifest merging into the scan pipeline
- Update documentation

### Phase 17.8: Integration Testing
- Scan `fixtures/mixed-monorepo/` with all manifest types
- Validate TDM output covers all formats
- Benchmark: manifest parsing should add <2s overhead

## Acceptance Criteria

- [ ] `pyproject.toml` with PEP 621 `[project.dependencies]` parsed correctly
- [ ] `pyproject.toml` with Poetry `[tool.poetry.dependencies]` parsed correctly
- [ ] `Pipfile` `[packages]` and `[dev-packages]` parsed correctly
- [ ] `setup.py` `install_requires` list extracted via regex
- [ ] `yarn.lock` v1 format parsed with resolved versions
- [ ] `pnpm-lock.yaml` parsed correctly
- [ ] `go.mod` direct require block parsed, indirect dependencies excluded
- [ ] `pom.xml` `<dependencies>` parsed with `${property}` interpolation
- [ ] `build.gradle` Groovy DSL `implementation 'g:a:v'` parsed
- [ ] `build.gradle.kts` Kotlin DSL `implementation("g:a:v")` parsed
- [ ] `libs.versions.toml` version catalog parsed with version refs
- [ ] `Cargo.toml` all dependency table formats parsed
- [ ] `composer.json` `require` and `require-dev` parsed, `ext-*` excluded
- [ ] `conda environment.yml` conda and pip sub-dependencies parsed
- [ ] Lockfile versions override manifest constraint versions when both exist
- [ ] Scanner discovers all new manifest filenames automatically
- [ ] Manifest parsing adds <2s overhead to scan of 100K LOC project

## File Inventory

| File | Description |
|---|---|
| `packages/languages/python/src/manifests/pyproject.ts` | pyproject.toml parser |
| `packages/languages/python/src/manifests/pipfile.ts` | Pipfile parser |
| `packages/languages/python/src/manifests/setup.ts` | setup.py/cfg parser |
| `packages/languages/python/src/manifests/conda.ts` | conda env parser |
| `packages/languages/javascript/src/manifests/yarn-lock.ts` | yarn.lock parser |
| `packages/languages/javascript/src/manifests/pnpm-lock.ts` | pnpm-lock.yaml parser |
| `packages/languages/javascript/src/manifests/package-lock.ts` | package-lock.json parser |
| `packages/languages/go/src/manifests.ts` | go.mod parser |
| `packages/languages/java/src/manifests/pom.ts` | pom.xml parser |
| `packages/languages/java/src/manifests/gradle.ts` | build.gradle parser |
| `packages/languages/java/src/manifests/version-catalog.ts` | libs.versions.toml |
| `packages/languages/rust/src/manifests.ts` | Cargo.toml parser |
| `packages/languages/php/src/manifests.ts` | composer.json parser |
| `packages/core/src/lockfile.ts` | Lockfile ↔ manifest merging |

## References

- [PEP 621 — project metadata](https://peps.python.org/pep-0621/)
- [Poetry pyproject.toml](https://python-poetry.org/docs/pyproject/)
- [go.mod reference](https://go.dev/doc/modules/gomod-ref)
- [Maven POM reference](https://maven.apache.org/pom.html)
- [Gradle version catalogs](https://docs.gradle.org/current/userguide/platforms.html)
- [Cargo.toml format](https://doc.rust-lang.org/cargo/reference/manifest.html)
- [Composer schema](https://getcomposer.org/doc/04-schema.md)
- [smol-toml](https://github.com/nicolo-ribaudo/smol-toml)
- [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser)
