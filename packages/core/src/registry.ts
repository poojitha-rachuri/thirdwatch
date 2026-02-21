import { glob } from "fast-glob";
import { readFile } from "node:fs/promises";
import * as yaml from "js-yaml";

export interface SDKPatternEntry {
  package: string;
  import_patterns?: string[];
}

export interface SDKRegistryEntry {
  provider: string;
  display_name: string;
  homepage?: string;
  changelog_url?: string;
  patterns: {
    npm?: SDKPatternEntry[];
    pypi?: SDKPatternEntry[];
    go?: SDKPatternEntry[];
  };
  known_api_base_urls?: string[];
  env_var_patterns?: string[];
}

function isValidRegistryEntry(value: unknown): value is SDKRegistryEntry {
  if (value == null || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj.provider !== "string") return false;
  if (typeof obj.display_name !== "string") return false;
  if (obj.patterns == null || typeof obj.patterns !== "object") return false;
  return true;
}

export async function loadSDKRegistry(
  registriesDir: string,
): Promise<SDKRegistryEntry[]> {
  const files = await glob("sdks/*.yml", {
    cwd: registriesDir,
    absolute: true,
  });
  const results = await Promise.all(
    files.map(async (f) => {
      const raw = yaml.load(await readFile(f, "utf8"));
      if (!isValidRegistryEntry(raw)) return null;
      return raw;
    }),
  );
  return results.filter((e): e is SDKRegistryEntry => e !== null);
}

/**
 * Build a lookup map from package name to provider for a given ecosystem.
 */
export function buildPackageProviderMap(
  registry: SDKRegistryEntry[],
  ecosystem: "npm" | "pypi",
): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of registry) {
    const patterns = entry.patterns[ecosystem];
    if (!Array.isArray(patterns)) continue;
    for (const p of patterns) {
      map.set(p.package, entry.provider);
    }
  }
  return map;
}

/**
 * Build a lookup map from known API base URL to provider.
 */
export function buildUrlProviderMap(
  registry: SDKRegistryEntry[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of registry) {
    if (!Array.isArray(entry.known_api_base_urls)) continue;
    for (const url of entry.known_api_base_urls) {
      map.set(url, entry.provider);
    }
  }
  return map;
}
