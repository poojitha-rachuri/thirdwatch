import { readFile } from "node:fs/promises";
import { basename, relative } from "node:path";
import yaml from "js-yaml";
import type { DependencyEntry } from "@thirdwatch/core";

export async function parseManifests(
  manifestFiles: string[],
  scanRoot: string,
): Promise<DependencyEntry[]> {
  const entries: DependencyEntry[] = [];

  for (const manifest of manifestFiles) {
    const name = basename(manifest);
    try {
      const content = await readFile(manifest, "utf-8");
      const rel = relative(scanRoot, manifest);

      switch (name) {
        case "package.json":
          entries.push(...parsePackageJson(content, rel));
          break;
        case "yarn.lock":
          entries.push(...parseYarnLock(content, rel));
          break;
        case "pnpm-lock.yaml":
          entries.push(...parsePnpmLock(content, rel));
          break;
        case "package-lock.json":
          entries.push(...parsePackageLockJson(content, rel));
          break;
        case "deno.json":
          entries.push(...parseDenoJson(content, rel));
          break;
      }
    } catch {
      // Skip unreadable files
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
    if (deps && typeof deps === "object" && !Array.isArray(deps)) {
      for (const [name, version] of Object.entries(
        deps as Record<string, unknown>,
      )) {
        if (typeof version === "string") {
          allDeps[name] = version;
        }
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

function parseYarnLock(
  content: string,
  manifestFile: string,
): DependencyEntry[] {
  const seen = new Map<string, DependencyEntry>();

  // Match blocks: optional quotes around "name@constraint":
  //   version "x.y.z"
  const blockRe =
    /^"?(?:(@[^@\n]+?)@[^"\n]*|([^@\n]+?)@[^"\n]*)"?:\n\s+version "([^"]+)"/gm;

  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(content)) !== null) {
    const name = match[1] ?? match[2];
    const version = match[3];
    if (!name || !version) continue;
    if (seen.has(name)) continue;

    seen.set(name, {
      kind: "package" as const,
      name,
      ecosystem: "npm" as const,
      current_version: version,
      manifest_file: manifestFile,
      locations: [],
      usage_count: 0,
      confidence: "high" as const,
    });
  }

  return [...seen.values()];
}

function parsePnpmLock(
  content: string,
  manifestFile: string,
): DependencyEntry[] {
  try {
    const doc = yaml.load(content) as Record<string, unknown> | null;
    if (!doc || typeof doc !== "object") return [];

    const packages = doc.packages as Record<string, unknown> | undefined;
    if (!packages || typeof packages !== "object") return [];

    const entries: DependencyEntry[] = [];

    for (const key of Object.keys(packages)) {
      const parsed = parsePnpmPackageKey(key);
      if (!parsed) continue;

      entries.push({
        kind: "package" as const,
        name: parsed.name,
        ecosystem: "npm" as const,
        current_version: parsed.version,
        manifest_file: manifestFile,
        locations: [],
        usage_count: 0,
        confidence: "high" as const,
      });
    }

    return entries;
  } catch {
    return [];
  }
}

function parsePnpmPackageKey(
  key: string,
): { name: string; version: string } | null {
  // Scoped: @scope/name@version
  if (key.startsWith("@")) {
    const lastAt = key.lastIndexOf("@");
    if (lastAt <= 0) return null;
    return { name: key.slice(0, lastAt), version: key.slice(lastAt + 1) };
  }
  // Unscoped: name@version
  const atIndex = key.indexOf("@");
  if (atIndex < 0) return null;
  return { name: key.slice(0, atIndex), version: key.slice(atIndex + 1) };
}

function parsePackageLockJson(
  content: string,
  manifestFile: string,
): DependencyEntry[] {
  try {
    const doc = JSON.parse(content) as Record<string, unknown>;
    const packages = doc.packages as Record<string, unknown> | undefined;
    if (!packages || typeof packages !== "object") return [];

    const entries: DependencyEntry[] = [];

    for (const [key, value] of Object.entries(packages)) {
      // Skip root entry
      if (key === "") continue;
      if (!value || typeof value !== "object") continue;

      const pkg = value as Record<string, unknown>;
      const version = pkg.version;
      if (typeof version !== "string") continue;

      // Extract name from the path after the last "node_modules/"
      const nmPrefix = "node_modules/";
      const lastNm = key.lastIndexOf(nmPrefix);
      if (lastNm < 0) continue;
      const name = key.slice(lastNm + nmPrefix.length);
      if (!name) continue;

      entries.push({
        kind: "package" as const,
        name,
        ecosystem: "npm" as const,
        current_version: version,
        manifest_file: manifestFile,
        locations: [],
        usage_count: 0,
        confidence: "high" as const,
      });
    }

    return entries;
  } catch {
    return [];
  }
}

function parseDenoJson(
  content: string,
  manifestFile: string,
): DependencyEntry[] {
  try {
    const doc = JSON.parse(content) as Record<string, unknown>;
    const imports = doc.imports as Record<string, string> | undefined;
    if (!imports || typeof imports !== "object") return [];

    const entries: DependencyEntry[] = [];

    for (const [key, specifier] of Object.entries(imports)) {
      if (typeof specifier !== "string") continue;

      const parsed = parseDenoSpecifier(key, specifier);
      if (parsed) {
        entries.push({
          kind: "package" as const,
          name: parsed.name,
          ecosystem: parsed.ecosystem,
          current_version: resolveVersion(parsed.version),
          version_constraint: parsed.version,
          manifest_file: manifestFile,
          locations: [],
          usage_count: 0,
          confidence: "high" as const,
        });
      }
    }

    return entries;
  } catch {
    return [];
  }
}

function parseDenoSpecifier(
  _key: string,
  specifier: string,
): { name: string; version: string; ecosystem: string } | null {
  // npm:name@version or npm:@scope/name@version
  if (specifier.startsWith("npm:")) {
    const rest = specifier.slice(4);
    const parsed = splitNameVersion(rest);
    if (parsed) return { ...parsed, ecosystem: "npm" };
  }

  // jsr:name@version or jsr:@scope/name@version
  if (specifier.startsWith("jsr:")) {
    const rest = specifier.slice(4);
    const parsed = splitNameVersion(rest);
    if (parsed) return { ...parsed, ecosystem: "jsr" };
  }

  // https://deno.land/x/name@version/...
  const denoLandRe = /^https:\/\/deno\.land\/x\/([^@/]+)@([^/]+)/;
  const denoMatch = specifier.match(denoLandRe);
  if (denoMatch && denoMatch[1] && denoMatch[2]) {
    return {
      name: denoMatch[1],
      version: denoMatch[2],
      ecosystem: "deno",
    };
  }

  return null;
}

function splitNameVersion(
  ref: string,
): { name: string; version: string } | null {
  // Scoped: @scope/name@version
  if (ref.startsWith("@")) {
    const lastAt = ref.lastIndexOf("@");
    if (lastAt <= 0) return null;
    return { name: ref.slice(0, lastAt), version: ref.slice(lastAt + 1) };
  }
  // Unscoped: name@version
  const atIndex = ref.indexOf("@");
  if (atIndex < 0) return null;
  return { name: ref.slice(0, atIndex), version: ref.slice(atIndex + 1) };
}

function resolveVersion(constraint: string): string {
  // Strip semver range prefixes: ^, ~, >=, etc.
  const cleaned = constraint.replace(/^[\^~>=<]*\s*/, "");
  return cleaned || constraint;
}
