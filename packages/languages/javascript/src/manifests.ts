import { readFile } from "node:fs/promises";
import { relative } from "node:path";
import type { DependencyEntry } from "@thirdwatch/core";

export async function parseManifests(
  manifestFiles: string[],
  scanRoot: string,
): Promise<DependencyEntry[]> {
  const entries: DependencyEntry[] = [];

  for (const manifest of manifestFiles) {
    if (!manifest.endsWith("package.json")) continue;
    try {
      const content = await readFile(manifest, "utf-8");
      entries.push(...parsePackageJson(content, relative(scanRoot, manifest)));
    } catch {
      // Skip invalid JSON
    }
  }

  return entries;
}

function parsePackageJson(
  content: string,
  manifestFile: string,
): DependencyEntry[] {
  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return [];
  }

  const allDeps: Record<string, string> = {};

  for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
    const deps = pkg[field];
    if (deps && typeof deps === "object") {
      for (const [name, version] of Object.entries(
        deps as Record<string, string>,
      )) {
        allDeps[name] = version;
      }
    }
  }

  return Object.entries(allDeps).map(([name, version]) => ({
    kind: "package" as const,
    name,
    ecosystem: "npm" as const,
    current_version: resolveVersion(version),
    version_constraint: version,
    manifest_file: manifestFile,
    locations: [],
    usage_count: 0,
    confidence: "high" as const,
  }));
}

function resolveVersion(constraint: string): string {
  // Strip semver range prefixes: ^, ~, >=, etc.
  const cleaned = constraint.replace(/^[\^~>=<]*\s*/, "");
  return cleaned || constraint;
}
