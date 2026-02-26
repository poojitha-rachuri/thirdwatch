import type { DependencyEntry } from "./plugin.js";

/**
 * Merge manifest entries with lockfile entries.
 *
 * When both a manifest and its lockfile exist, the manifest provides the
 * version constraint (e.g. "^7.0.0") while the lockfile provides the
 * exact resolved version (e.g. "7.1.0"). This function enriches manifest
 * entries with resolved versions from lockfile entries.
 *
 * Strategy:
 *   1. If lockfile has a matching package → use lockfile version as current_version
 *   2. If only manifest exists → keep constraint as current_version (best effort)
 *   3. If only lockfile exists → use lockfile entry as-is
 */
export function mergeManifestAndLockfile(
  manifestEntries: DependencyEntry[],
  lockfileEntries: DependencyEntry[],
): DependencyEntry[] {
  const lockVersions = new Map<string, DependencyEntry>();
  for (const entry of lockfileEntries) {
    if (entry.kind === "package") {
      lockVersions.set(`${entry.ecosystem}:${entry.name}`, entry);
    }
  }

  const seen = new Set<string>();
  const merged: DependencyEntry[] = [];

  for (const entry of manifestEntries) {
    if (entry.kind !== "package") {
      merged.push(entry);
      continue;
    }

    const key = `${entry.ecosystem}:${entry.name}`;
    seen.add(key);

    const locked = lockVersions.get(key);
    if (locked && locked.kind === "package") {
      merged.push({ ...entry, current_version: locked.current_version });
    } else {
      merged.push(entry);
    }
  }

  // Add lockfile-only entries (packages not in manifests)
  for (const entry of lockfileEntries) {
    if (entry.kind !== "package") continue;
    const key = `${entry.ecosystem}:${entry.name}`;
    if (!seen.has(key)) {
      merged.push(entry);
    }
  }

  return merged;
}
