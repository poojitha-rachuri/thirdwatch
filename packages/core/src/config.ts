import { readFile } from "node:fs/promises";
import { resolve, join, sep } from "node:path";
import * as yaml from "js-yaml";
// ignore@5 is CJS (`module.exports = factory`) with a `export default` d.ts.
// Under NodeNext, tsc sees the namespace rather than the callable; vitest/vite
// may double-wrap it. This two-step cast handles both build and runtime.
import _ignoreImport from "ignore";
type Ignore = import("ignore").Ignore;
// At runtime the import may be the factory itself or `{ default: factory }`
const _raw = _ignoreImport as unknown;
const ignore: () => Ignore =
  typeof _raw === "function"
    ? (_raw as () => Ignore)
    : ((_raw as { default: () => Ignore }).default);
import { z } from "zod";

// ---------------------------------------------------------------------------
// Schema — Zod validation for .thirdwatch.yml
// ---------------------------------------------------------------------------

const SdkOverrideSchema = z.object({
  package: z.string(),
  provider: z.string(),
  patterns: z.array(z.string()).optional(),
});

const ConfigSchema = z.object({
  version: z.string().optional(),
  output: z.enum(["json", "yaml", "table"]).optional(),
  outFile: z.string().optional(),
  languages: z.array(z.string()).optional(),
  roots: z.array(z.string()).optional(),
  ignore: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  sdks: z.record(SdkOverrideSchema).optional(),
  min_confidence: z.enum(["high", "medium", "low"]).optional(),
  max_file_size_mb: z.number().positive().optional(),
});

export type ThirdwatchConfig = z.infer<typeof ConfigSchema>;

// ---------------------------------------------------------------------------
// Default config values
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: Required<
  Pick<ThirdwatchConfig, "output" | "max_file_size_mb">
> = {
  output: "json",
  max_file_size_mb: 1,
};

// ---------------------------------------------------------------------------
// loadConfig — reads and validates .thirdwatch.yml
// ---------------------------------------------------------------------------

export async function loadConfig(
  scanRoot: string,
  configPath?: string,
): Promise<ThirdwatchConfig> {
  const filePath = configPath
    ? resolve(configPath)
    : join(scanRoot, ".thirdwatch.yml");

  // Prevent path traversal: config must be within scan root
  const scanRootResolved = resolve(scanRoot);
  const filePathResolved = resolve(filePath);
  if (
    !filePathResolved.startsWith(scanRootResolved + sep) &&
    filePathResolved !== scanRootResolved
  ) {
    throw new Error(
      `Config path must be within scan root: ${filePath} is outside ${scanRoot}`,
    );
  }

  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch {
    // No config file — return defaults
    return { ...DEFAULT_CONFIG };
  }

  const parsed = yaml.load(raw, { schema: yaml.FAILSAFE_SCHEMA });
  if (parsed == null || typeof parsed !== "object") {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const result = ConfigSchema.parse(parsed);
    return { ...DEFAULT_CONFIG, ...result };
  } catch (err) {
    throw new Error(
      `Invalid .thirdwatch.yml: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// loadIgnore — reads .thirdwatchignore (gitignore syntax)
// ---------------------------------------------------------------------------

export async function loadIgnore(scanRoot: string): Promise<Ignore> {
  const ig = ignore();

  // Always ignore these
  ig.add(["node_modules", ".git", "dist", "build", ".next", "coverage"]);

  const ignorePath = join(scanRoot, ".thirdwatchignore");
  try {
    const raw = await readFile(ignorePath, "utf-8");
    const patterns = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (patterns.length > 0) {
      ig.add(patterns);
    }
  } catch {
    // No .thirdwatchignore — that's fine
  }

  return ig;
}
