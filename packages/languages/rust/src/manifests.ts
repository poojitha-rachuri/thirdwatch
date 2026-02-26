import { readFile } from "node:fs/promises";
import { relative } from "node:path";
import { parse as parseTOML } from "smol-toml";
import type { DependencyEntry } from "@thirdwatch/core";

export async function parseManifests(
  manifestFiles: string[],
  scanRoot: string,
): Promise<DependencyEntry[]> {
  const entries: DependencyEntry[] = [];

  for (const manifest of manifestFiles) {
    if (manifest.endsWith("Cargo.toml")) {
      try {
        const content = await readFile(manifest, "utf-8");
        entries.push(...parseCargoToml(content, relative(scanRoot, manifest)));
      } catch (err) {
        console.error(
          `[rust-analyzer] Failed to parse ${manifest}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } else if (manifest.endsWith("Cargo.lock")) {
      try {
        const content = await readFile(manifest, "utf-8");
        entries.push(...parseCargoLock(content, relative(scanRoot, manifest)));
      } catch (err) {
        console.error(
          `[rust-analyzer] Failed to parse ${manifest}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  return entries;
}

function parseCargoLock(content: string, manifestFile: string): DependencyEntry[] {
  let lock: Record<string, unknown>;
  try {
    lock = parseTOML(content) as Record<string, unknown>;
  } catch {
    return [];
  }

  const packages = lock.package as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(packages)) return [];

  const entries: DependencyEntry[] = [];

  for (const pkg of packages) {
    const name = pkg.name as string | undefined;
    const version = pkg.version as string | undefined;
    const source = pkg.source as string | undefined;

    if (!name || !version || !source) continue;

    entries.push({
      kind: "package",
      name,
      ecosystem: "cargo",
      current_version: version,
      version_constraint: `=${version}`,
      manifest_file: manifestFile,
      locations: [],
      usage_count: 0,
      confidence: "high",
    });
  }

  return entries;
}

function parseCargoToml(content: string, manifestFile: string): DependencyEntry[] {
  const entries: DependencyEntry[] = [];
  let cargo: Record<string, unknown>;

  try {
    cargo = parseTOML(content) as Record<string, unknown>;
  } catch {
    return [];
  }

  for (const section of ["dependencies", "dev-dependencies", "build-dependencies"]) {
    const deps = cargo[section] as Record<string, unknown> | undefined;
    if (!deps) continue;

    for (const [name, value] of Object.entries(deps)) {
      let version = "unknown";

      if (typeof value === "string") {
        version = value;
      } else if (typeof value === "object" && value !== null) {
        const obj = value as Record<string, unknown>;
        if (typeof obj.version === "string") version = obj.version;
      }

      entries.push({
        kind: "package",
        name,
        ecosystem: "cargo",
        current_version: version,
        version_constraint: version,
        manifest_file: manifestFile,
        locations: [],
        usage_count: 0,
        confidence: "high",
      });
    }
  }

  return entries;
}
