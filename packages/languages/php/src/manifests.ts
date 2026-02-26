import { readFile } from "node:fs/promises";
import { relative } from "node:path";
import type { DependencyEntry } from "@thirdwatch/core";

export async function parseManifests(
  manifestFiles: string[],
  scanRoot: string,
): Promise<DependencyEntry[]> {
  const entries: DependencyEntry[] = [];

  for (const manifest of manifestFiles) {
    if (manifest.endsWith("composer.json")) {
      try {
        const content = await readFile(manifest, "utf-8");
        entries.push(...parseComposerJson(content, relative(scanRoot, manifest)));
      } catch (err) {
        console.error(
          `[php-analyzer] Failed to parse ${manifest}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } else if (manifest.endsWith("composer.lock")) {
      try {
        const content = await readFile(manifest, "utf-8");
        entries.push(...parseComposerLock(content, relative(scanRoot, manifest)));
      } catch (err) {
        console.error(
          `[php-analyzer] Failed to parse ${manifest}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  return entries;
}

function parseComposerLock(content: string, manifestFile: string): DependencyEntry[] {
  let lock: Record<string, unknown>;
  try {
    lock = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return [];
  }

  const entries: DependencyEntry[] = [];

  for (const section of ["packages", "packages-dev"]) {
    const pkgs = lock[section] as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(pkgs)) continue;

    for (const pkg of pkgs) {
      const name = pkg.name as string | undefined;
      const version = pkg.version as string | undefined;
      if (!name || !version) continue;
      if (name === "php" || name.startsWith("ext-")) continue;

      const cleanVersion = version.replace(/^v/, "");

      entries.push({
        kind: "package",
        name,
        ecosystem: "packagist",
        current_version: cleanVersion,
        version_constraint: `=${cleanVersion}`,
        manifest_file: manifestFile,
        locations: [],
        usage_count: 0,
        confidence: "high",
      });
    }
  }

  return entries;
}

function parseComposerJson(content: string, manifestFile: string): DependencyEntry[] {
  let composer: Record<string, unknown>;
  try {
    composer = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return [];
  }

  const entries: DependencyEntry[] = [];

  for (const section of ["require", "require-dev"]) {
    const deps = composer[section] as Record<string, string> | undefined;
    if (!deps) continue;

    for (const [name, constraint] of Object.entries(deps)) {
      // Skip PHP version constraint and extensions
      if (name === "php" || name.startsWith("ext-")) continue;

      entries.push({
        kind: "package",
        name,
        ecosystem: "packagist",
        current_version: resolveVersion(constraint),
        version_constraint: constraint,
        manifest_file: manifestFile,
        locations: [],
        usage_count: 0,
        confidence: "high",
      });
    }
  }

  return entries;
}

function resolveVersion(constraint: string): string {
  // Plain version: no prefix needed
  if (/^\d/.test(constraint)) return constraint;
  // ^X.Y or ~X.Y (Composer caret/tilde) → extract X.Y
  const caret = constraint.match(/^[~^]\s*([^\s,|]+)/);
  if (caret) return caret[1]!;
  // >=X.Y or >X.Y → extract first version token only (stop at space, comma, pipe, or </>)
  const gte = constraint.match(/^>=?\s*([^\s,|<>]+)/);
  if (gte) return gte[1]!;
  // Wildcard or unparseable — strip leading operators
  return constraint.replace(/^[\^~>=<|*\s]+/, "") || "unknown";
}
