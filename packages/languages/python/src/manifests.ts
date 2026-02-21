import { readFile } from "node:fs/promises";
import { relative } from "node:path";
import type { DependencyEntry } from "@thirdwatch/core";

export async function parseManifests(
  manifestFiles: string[],
  scanRoot: string,
): Promise<DependencyEntry[]> {
  const entries: DependencyEntry[] = [];

  for (const manifest of manifestFiles) {
    if (manifest.endsWith("requirements.txt")) {
      const content = await readFile(manifest, "utf-8");
      entries.push(...parseRequirementsTxt(content, relative(scanRoot, manifest)));
    }
  }

  return entries;
}

function parseRequirementsTxt(content: string, manifestFile: string): DependencyEntry[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("-"))
    .map((line) => {
      // Strip environment markers: "package; python_version < '3.10'" → "package"
      // Strip extras: "package[extra1,extra2]>=1.0" → "package>=1.0"
      let cleaned = line.replace(/;.*$/, "").trim();
      cleaned = cleaned.replace(/\[.*?\]/, "");
      const match = cleaned.match(/^([A-Za-z0-9_\-.]+)\s*([>=<!~^].+)?/);
      if (!match) return null;
      const name = match[1]!.toLowerCase().replace(/_/g, "-");
      const constraint = match[2]?.trim();
      const entry: DependencyEntry = {
        kind: "package",
        name,
        ecosystem: "pypi",
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
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);
}

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
  return constraint;
}
