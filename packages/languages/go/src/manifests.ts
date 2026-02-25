import { readFile } from "node:fs/promises";
import { relative } from "node:path";
import type { DependencyEntry } from "@thirdwatch/core";

export async function parseManifests(
  manifestFiles: string[],
  scanRoot: string,
): Promise<DependencyEntry[]> {
  const entries: DependencyEntry[] = [];

  for (const manifest of manifestFiles) {
    if (manifest.endsWith("go.mod")) {
      const content = await readFile(manifest, "utf-8");
      entries.push(...parseGoMod(content, relative(scanRoot, manifest)));
    }
  }

  return entries;
}

function parseGoMod(content: string, manifestFile: string): DependencyEntry[] {
  const entries: DependencyEntry[] = [];
  const lines = content.split("\n");
  let inRequireBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("require (")) {
      inRequireBlock = true;
      continue;
    }
    if (trimmed === ")") {
      inRequireBlock = false;
      continue;
    }

    // Skip indirect dependencies
    if (trimmed.includes("// indirect")) continue;

    if (inRequireBlock) {
      const match = trimmed.match(/^([^\s]+)\s+(v[^\s]+)/);
      if (match) {
        entries.push(makeGoPackageEntry(match[1]!, match[2]!, manifestFile));
      }
    }

    // Single-line require
    const singleMatch = trimmed.match(/^require\s+([^\s]+)\s+(v[^\s]+)/);
    if (singleMatch) {
      entries.push(makeGoPackageEntry(singleMatch[1]!, singleMatch[2]!, manifestFile));
    }
  }

  return entries;
}

function makeGoPackageEntry(
  modulePath: string,
  version: string,
  manifestFile: string,
): DependencyEntry {
  return {
    kind: "package",
    name: modulePath,
    ecosystem: "go",
    current_version: version,
    version_constraint: `>= ${version}`,
    manifest_file: manifestFile,
    locations: [],
    usage_count: 0,
    confidence: "high",
  };
}
