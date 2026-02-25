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

/**
 * Parse go.mod using a simple state machine:
 *
 *   1. Lines matching `require (` or `require(` open a require block.
 *   2. Inside a require block, each `module vX.Y.Z` line is a dependency.
 *   3. A bare `)` closes whichever block is open — since `inRequireBlock`
 *      is only set by `require`, this cannot mis-close a `replace` or
 *      `exclude` block.
 *   4. Single-line `require module vX.Y.Z` (no parens) is also handled
 *      outside any block. The regex cannot match `require (` because `(`
 *      is not a valid module path character followed by a version.
 *   5. Lines containing `// indirect` are always skipped.
 */
function parseGoMod(content: string, manifestFile: string): DependencyEntry[] {
  const entries: DependencyEntry[] = [];
  const lines = content.split("\n");
  let inRequireBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Open require block: `require (` or `require(`
    if (/^require\s*\(/.test(trimmed)) {
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

    // Single-line require (without parens)
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
