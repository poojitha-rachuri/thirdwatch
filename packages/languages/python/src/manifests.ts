import { readFile } from "node:fs/promises";
import { relative, basename } from "node:path";
import { parse as parseTOML } from "smol-toml";
import yaml from "js-yaml";
import type { DependencyEntry } from "@thirdwatch/core";

export async function parseManifests(
  manifestFiles: string[],
  scanRoot: string,
): Promise<DependencyEntry[]> {
  const entries: DependencyEntry[] = [];

  for (const manifest of manifestFiles) {
    const name = basename(manifest);
    const manifestFile = relative(scanRoot, manifest);

    try {
      const content = await readFile(manifest, "utf-8");

      if (name === "requirements.txt" || /^requirements-.*\.txt$/.test(name)) {
        entries.push(...parseRequirementsTxt(content, manifestFile));
      } else if (name === "pyproject.toml") {
        entries.push(...parsePyprojectToml(content, manifestFile));
      } else if (name === "Pipfile") {
        entries.push(...parsePipfile(content, manifestFile));
      } else if (name === "setup.py") {
        entries.push(...parseSetupPy(content, manifestFile));
      } else if (name === "setup.cfg") {
        entries.push(...parseSetupCfg(content, manifestFile));
      } else if (name === "environment.yml") {
        entries.push(...parseEnvironmentYml(content, manifestFile));
      }
    } catch {
      // Non-fatal: skip files that can't be read or parsed
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// PEP 508 helper — parses "stripe>=7.0.0" or "requests[security]>=2.31,<3.0"
// ---------------------------------------------------------------------------

function parsePep508(spec: string): { name: string; constraint: string | undefined } | null {
  // Strip environment markers: "package; python_version < '3.10'" → "package"
  let cleaned = spec.replace(/;.*$/, "").trim();
  // Strip extras: "package[extra1,extra2]>=1.0" → "package>=1.0"
  cleaned = cleaned.replace(/\[.*?\]/, "");
  const match = cleaned.match(/^([A-Za-z0-9_\-.]+)\s*([>=<!~^].+)?/);
  if (!match) return null;
  const name = match[1]!.toLowerCase().replace(/_/g, "-");
  const constraint = match[2]?.trim();
  return { name, constraint };
}

function makeEntry(
  name: string,
  constraint: string | undefined,
  manifestFile: string,
  ecosystem: string = "pypi",
): DependencyEntry {
  const entry: DependencyEntry = {
    kind: "package",
    name,
    ecosystem,
    current_version: resolveVersion(constraint),
    manifest_file: manifestFile,
    locations: [],
    usage_count: 0,
    confidence: "high",
  };
  if (constraint) {
    entry.version_constraint = constraint;
  }
  return entry;
}

// ---------------------------------------------------------------------------
// requirements.txt
// ---------------------------------------------------------------------------

function parseRequirementsTxt(content: string, manifestFile: string): DependencyEntry[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("-"))
    .map((line) => {
      const parsed = parsePep508(line);
      if (!parsed) return null;
      return makeEntry(parsed.name, parsed.constraint, manifestFile);
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);
}

// ---------------------------------------------------------------------------
// pyproject.toml — PEP 621 + Poetry + PDM
// ---------------------------------------------------------------------------

function parsePyprojectToml(content: string, manifestFile: string): DependencyEntry[] {
  const entries: DependencyEntry[] = [];
  const doc = parseTOML(content) as Record<string, unknown>;

  // PEP 621: [project.dependencies]
  const project = doc.project as Record<string, unknown> | undefined;
  if (project) {
    const deps = project.dependencies as string[] | undefined;
    if (Array.isArray(deps)) {
      for (const spec of deps) {
        const parsed = parsePep508(spec);
        if (parsed) {
          entries.push(makeEntry(parsed.name, parsed.constraint, manifestFile));
        }
      }
    }

    // PEP 621: [project.optional-dependencies]
    const optDeps = project["optional-dependencies"] as Record<string, string[]> | undefined;
    if (optDeps && typeof optDeps === "object") {
      for (const group of Object.values(optDeps)) {
        if (Array.isArray(group)) {
          for (const spec of group) {
            const parsed = parsePep508(spec);
            if (parsed) {
              entries.push(makeEntry(parsed.name, parsed.constraint, manifestFile));
            }
          }
        }
      }
    }
  }

  // Poetry: [tool.poetry.dependencies]
  const tool = doc.tool as Record<string, unknown> | undefined;
  if (tool) {
    const poetry = tool.poetry as Record<string, unknown> | undefined;
    if (poetry) {
      const poetryDeps = poetry.dependencies as Record<string, unknown> | undefined;
      if (poetryDeps && typeof poetryDeps === "object") {
        for (const [name, value] of Object.entries(poetryDeps)) {
          if (name.toLowerCase() === "python") continue;
          const constraint = typeof value === "string"
            ? value
            : (value as Record<string, unknown>)?.version as string | undefined;
          const normalized = name.toLowerCase().replace(/_/g, "-");
          entries.push(makeEntry(normalized, constraint, manifestFile));
        }
      }
    }

    // PDM: [tool.pdm.dependencies]
    const pdm = tool.pdm as Record<string, unknown> | undefined;
    if (pdm) {
      const pdmDeps = pdm.dependencies as string[] | undefined;
      if (Array.isArray(pdmDeps)) {
        for (const spec of pdmDeps) {
          const parsed = parsePep508(spec);
          if (parsed) {
            entries.push(makeEntry(parsed.name, parsed.constraint, manifestFile));
          }
        }
      }
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Pipfile — TOML with [packages] and [dev-packages]
// ---------------------------------------------------------------------------

function parsePipfile(content: string, manifestFile: string): DependencyEntry[] {
  const entries: DependencyEntry[] = [];
  const doc = parseTOML(content) as Record<string, unknown>;

  for (const section of ["packages", "dev-packages"] as const) {
    const deps = doc[section] as Record<string, unknown> | undefined;
    if (!deps || typeof deps !== "object") continue;

    for (const [name, value] of Object.entries(deps)) {
      let constraint: string | undefined;
      if (typeof value === "string") {
        constraint = value === "*" ? undefined : value;
      } else if (value && typeof value === "object") {
        const ver = (value as Record<string, unknown>).version as string | undefined;
        constraint = ver === "*" ? undefined : ver;
      }
      const normalized = name.toLowerCase().replace(/_/g, "-");
      entries.push(makeEntry(normalized, constraint, manifestFile));
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// setup.py — regex extraction of install_requires=[...]
// ---------------------------------------------------------------------------

function parseSetupPy(content: string, manifestFile: string): DependencyEntry[] {
  const entries: DependencyEntry[] = [];

  // Find the start of install_requires=[
  const startMatch = content.match(/install_requires\s*=\s*\[/);
  if (!startMatch || startMatch.index === undefined) return entries;

  const blockStart = startMatch.index + startMatch[0].length;
  let depth = 1;
  let inString: string | null = null;
  let i = blockStart;

  while (i < content.length && depth > 0) {
    const ch = content[i]!;
    if (inString) {
      if (ch === inString && content[i - 1] !== "\\") inString = null;
    } else {
      if (ch === '"' || ch === "'") inString = ch;
      else if (ch === "[") depth++;
      else if (ch === "]") depth--;
    }
    i++;
  }

  const block = content.slice(blockStart, i - 1);

  // Extract quoted strings from the block
  const stringPattern = /["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = stringPattern.exec(block)) !== null) {
    const parsed = parsePep508(m[1]!);
    if (parsed) {
      entries.push(makeEntry(parsed.name, parsed.constraint, manifestFile));
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// setup.cfg — INI-like with [options] install_requires
// ---------------------------------------------------------------------------

function parseSetupCfg(content: string, manifestFile: string): DependencyEntry[] {
  const entries: DependencyEntry[] = [];
  const lines = content.split("\n");

  let inOptions = false;
  let inInstallRequires = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.match(/^\[.+\]$/)) {
      inOptions = line === "[options]";
      inInstallRequires = false;
      continue;
    }

    if (!inOptions) continue;

    if (/^install_requires\s*=/.test(line)) {
      inInstallRequires = true;
      // Check if there's content on the same line after =
      const afterEq = line.replace(/^install_requires\s*=\s*/, "").trim();
      if (afterEq) {
        const parsed = parsePep508(afterEq);
        if (parsed) {
          entries.push(makeEntry(parsed.name, parsed.constraint, manifestFile));
        }
      }
      continue;
    }

    if (inInstallRequires) {
      // Continuation lines must be indented
      if (/^\s+/.test(rawLine) && line.trim()) {
        const parsed = parsePep508(line.trim());
        if (parsed) {
          entries.push(makeEntry(parsed.name, parsed.constraint, manifestFile));
        }
      } else {
        inInstallRequires = false;
      }
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// environment.yml — conda environment file
// ---------------------------------------------------------------------------

function parseEnvironmentYml(content: string, manifestFile: string): DependencyEntry[] {
  const entries: DependencyEntry[] = [];
  const doc = yaml.load(content) as Record<string, unknown> | null;
  if (!doc) return entries;

  const deps = doc.dependencies as unknown[] | undefined;
  if (!Array.isArray(deps)) return entries;

  for (const dep of deps) {
    if (typeof dep === "string") {
      // Conda package: "numpy=1.26" or "pandas>=2.0"
      const match = dep.match(/^([A-Za-z0-9_\-.]+)\s*([>=<!~=].+)?$/);
      if (!match) continue;
      const name = match[1]!.toLowerCase().replace(/_/g, "-");
      if (name === "python") continue;
      const constraint = match[2]?.trim();
      entries.push(makeEntry(name, constraint, manifestFile, "conda"));
    } else if (dep && typeof dep === "object") {
      // pip sub-list: { pip: ["stripe>=7.0", ...] }
      const pipDeps = (dep as Record<string, unknown>).pip as string[] | undefined;
      if (Array.isArray(pipDeps)) {
        for (const spec of pipDeps) {
          const parsed = parsePep508(spec);
          if (parsed) {
            if (parsed.name === "python") continue;
            entries.push(makeEntry(parsed.name, parsed.constraint, manifestFile, "pypi"));
          }
        }
      }
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Version resolver
// ---------------------------------------------------------------------------

function resolveVersion(constraint: string | undefined): string {
  if (!constraint) return "unknown";
  // ==X.Y.Z → exact version
  const exact = constraint.match(/^==\s*(.+)/);
  if (exact) return exact[1]!;
  // >=X.Y.Z → take the version
  const gte = constraint.match(/^>=\s*([^,\s]+)/);
  if (gte) return gte[1]!;
  // ~=X.Y.Z
  const compat = constraint.match(/^~=\s*(.+)/);
  if (compat) return compat[1]!;
  // ^X.Y.Z (Poetry style)
  const caret = constraint.match(/^\^\s*(.+)/);
  if (caret) return caret[1]!;
  return constraint;
}
