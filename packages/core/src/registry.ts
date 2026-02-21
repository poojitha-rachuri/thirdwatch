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

export async function loadSDKRegistry(
  registriesDir: string,
): Promise<SDKRegistryEntry[]> {
  const files = await glob("sdks/*.yml", {
    cwd: registriesDir,
    absolute: true,
  });
  const entries = await Promise.all(
    files.map(
      async (f) =>
        yaml.load(await readFile(f, "utf8")) as SDKRegistryEntry,
    ),
  );
  return entries;
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
    if (!patterns) continue;
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
    if (!entry.known_api_base_urls) continue;
    for (const url of entry.known_api_base_urls) {
      map.set(url, entry.provider);
    }
  }
  return map;
}
