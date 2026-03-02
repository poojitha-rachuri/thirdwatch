import fg from "fast-glob";
import { readFile } from "node:fs/promises";
import * as yaml from "js-yaml";

export interface SDKPatternEntry {
  package: string;
  import_patterns?: string[];
}

export interface ConstructorPattern {
  name: string;
  services_field?: string;
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
    maven?: SDKPatternEntry[];
    cargo?: SDKPatternEntry[];
    packagist?: SDKPatternEntry[];
  };
  known_api_base_urls?: string[];
  env_var_patterns?: string[];
  constructors?: Record<string, ConstructorPattern[]>;
  factories?: Record<string, string[]>;
}

export interface RegistryMaps {
  packageProviders: Map<string, string>;
  constructorProviders: Map<string, [string, string]>;
  factoryProviders: Map<string, [string, string]>;
  urlProviders: Map<string, string>;
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
  const files = await fg.glob("sdks/*.yml", {
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
  ecosystem: string,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of registry) {
    const patterns = entry.patterns[ecosystem as keyof typeof entry.patterns];
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

/**
 * Build a lookup map from constructor name to [provider, firstPackageName] for a given ecosystem.
 */
export function buildConstructorProviderMap(
  registry: SDKRegistryEntry[],
  ecosystem: string,
): Map<string, [string, string]> {
  const map = new Map<string, [string, string]>();
  for (const entry of registry) {
    const ctors = entry.constructors?.[ecosystem];
    if (!Array.isArray(ctors)) continue;
    const firstPkg =
      entry.patterns[ecosystem as keyof typeof entry.patterns]?.[0]?.package ??
      entry.provider;
    for (const c of ctors) {
      map.set(c.name, [entry.provider, firstPkg]);
    }
  }
  return map;
}

/**
 * Build a lookup map from factory name to [provider, firstPackageName] for a given ecosystem.
 */
export function buildFactoryProviderMap(
  registry: SDKRegistryEntry[],
  ecosystem: string,
): Map<string, [string, string]> {
  const map = new Map<string, [string, string]>();
  for (const entry of registry) {
    const facs = entry.factories?.[ecosystem];
    if (!Array.isArray(facs)) continue;
    const firstPkg =
      entry.patterns[ecosystem as keyof typeof entry.patterns]?.[0]?.package ??
      entry.provider;
    for (const f of facs) {
      map.set(f, [entry.provider, firstPkg]);
    }
  }
  return map;
}

/**
 * Build all registry lookup maps for a given ecosystem.
 */
export function buildRegistryMaps(
  registry: SDKRegistryEntry[],
  ecosystem: string,
): RegistryMaps {
  return {
    packageProviders: buildPackageProviderMap(registry, ecosystem),
    constructorProviders: buildConstructorProviderMap(registry, ecosystem),
    factoryProviders: buildFactoryProviderMap(registry, ecosystem),
    urlProviders: buildUrlProviderMap(registry),
  };
}
