import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import yaml from "js-yaml";
import type { RegistryProvider } from "./remediation.js";

/**
 * Load all remediation registry YAML files from a directory.
 * Each file should contain a `provider` and `remediations` array.
 */
export async function loadRemediationRegistries(
  registriesDir: string,
): Promise<RegistryProvider[]> {
  const entries = await readdir(registriesDir);
  const ymlFiles = entries.filter(
    (f) => f.endsWith(".yml") || f.endsWith(".yaml"),
  );

  const registries: RegistryProvider[] = [];

  for (const file of ymlFiles) {
    const content = await readFile(join(registriesDir, file), "utf-8");
    const parsed = yaml.load(content) as RegistryProvider;
    if (parsed && typeof parsed.provider === "string" && Array.isArray(parsed.remediations)) {
      registries.push(parsed);
    }
  }

  return registries;
}
