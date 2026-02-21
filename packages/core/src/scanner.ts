import { readFile, stat } from "node:fs/promises";
import { extname, relative } from "node:path";
import { glob } from "fast-glob";
import type { TDM } from "@thirdwatch/tdm";
import type { LanguageAnalyzerPlugin, DependencyEntry } from "./plugin.js";
import { buildTDM } from "./build-tdm.js";
import { loadConfig, loadIgnore } from "./config.js";
import { loadEnvFile, buildEnvMap } from "./resolve.js";

// ---------------------------------------------------------------------------
// ScanOptions — public configuration for scan()
// ---------------------------------------------------------------------------

export interface ScanOptions {
  /** Absolute path to the directory to scan */
  root: string;
  /** Language analyzer plugins to use */
  plugins: LanguageAnalyzerPlugin[];
  /** Additional glob patterns to ignore */
  ignore?: string[];
  /** Path to .thirdwatch.yml (default: <root>/.thirdwatch.yml) */
  configFile?: string;
  /** Previous TDM for incremental scanning */
  previousTdm?: TDM;
  /** Whether to resolve env vars in URLs (default: true) */
  resolveEnv?: boolean;
  /** Use process.env for URL resolution (default: false) */
  useProcessEnv?: boolean;
  /** Max concurrent file analyses (default: 8) */
  concurrency?: number;
}

// ---------------------------------------------------------------------------
// ScanResult — returned from scan(), extends TDM with scan metadata
// ---------------------------------------------------------------------------

export interface ScanResult {
  tdm: TDM;
  filesScanned: number;
  filesSkipped: number;
  errors: ScanError[];
}

export interface ScanError {
  filePath: string;
  error: string;
}

// ---------------------------------------------------------------------------
// Manifest file patterns recognized across languages
// ---------------------------------------------------------------------------

const MANIFEST_PATTERNS = [
  "package.json",
  "requirements.txt",
  "pyproject.toml",
  "Pipfile",
  "go.mod",
  "Gemfile",
  "pom.xml",
  "build.gradle",
  "Cargo.toml",
];

// ---------------------------------------------------------------------------
// Concurrency limiter
// ---------------------------------------------------------------------------

async function pLimit<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < tasks.length) {
      const index = nextIndex++;
      results[index] = await tasks[index]!();
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// scan() — main entry point
// ---------------------------------------------------------------------------

export async function scan(options: ScanOptions): Promise<ScanResult> {
  const startMs = Date.now();
  const {
    root,
    plugins,
    ignore: extraIgnore = [],
    concurrency = 8,
    resolveEnv = true,
    useProcessEnv = false,
  } = options;

  // Load config
  const config = await loadConfig(root, options.configFile);
  const maxFileSizeBytes = (config.max_file_size_mb ?? 1) * 1024 * 1024;

  // Build extension → plugin map
  const pluginMap = new Map<string, LanguageAnalyzerPlugin>();
  for (const plugin of plugins) {
    for (const ext of plugin.extensions) {
      pluginMap.set(ext, plugin);
    }
  }

  // Load ignore patterns
  const ig = await loadIgnore(root);
  if (config.ignore) {
    ig.add(config.ignore);
  }
  if (extraIgnore.length > 0) {
    ig.add(extraIgnore);
  }

  // Resolve env vars
  let resolvedEnv: Record<string, string> = {};
  if (resolveEnv) {
    const dotenvVars = await loadEnvFile(root);
    resolvedEnv = buildEnvMap(dotenvVars, config.env, useProcessEnv);
  }

  // Discover all files
  const allFiles = await glob("**/*", {
    cwd: root,
    absolute: true,
    dot: false,
    onlyFiles: true,
    ignore: ["**/node_modules/**", "**/.git/**"],
  });

  // Apply ignore filter using relative paths
  const filteredFiles = allFiles.filter((f) => {
    const rel = relative(root, f);
    return !ig.ignores(rel);
  });

  // Separate manifest files from source files
  const manifestFiles = filteredFiles.filter((f) =>
    MANIFEST_PATTERNS.some((p) => f.endsWith(p)),
  );

  // Source files: only files with extensions matching a registered plugin
  const sourceFiles = filteredFiles.filter((f) => pluginMap.has(extname(f)));

  // Collect entries from manifests
  const manifestEntries: DependencyEntry[] = [];
  for (const plugin of plugins) {
    if (plugin.analyzeManifests) {
      const entries = await plugin.analyzeManifests(manifestFiles, root);
      manifestEntries.push(...entries);
    }
  }

  // Analyze source files with concurrency control
  const errors: ScanError[] = [];
  let filesSkipped = 0;

  const tasks = sourceFiles.map((filePath) => async (): Promise<DependencyEntry[]> => {
    // Skip files that are too large
    try {
      const fileStat = await stat(filePath);
      if (fileStat.size > maxFileSizeBytes) {
        filesSkipped++;
        return [];
      }
    } catch {
      filesSkipped++;
      return [];
    }

    const plugin = pluginMap.get(extname(filePath));
    if (!plugin) return [];

    try {
      const source = await readFile(filePath, "utf-8");
      return await plugin.analyze({
        filePath,
        source,
        scanRoot: root,
        resolvedEnv,
      });
    } catch (err) {
      errors.push({
        filePath,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  });

  const fileResults = await pLimit(tasks, concurrency);

  const allEntries: DependencyEntry[] = [
    ...manifestEntries,
    ...fileResults.flat(),
  ];

  const duration = Date.now() - startMs;

  const tdm = buildTDM(allEntries, {
    root,
    plugins,
    duration,
  });

  return {
    tdm,
    filesScanned: sourceFiles.length - filesSkipped,
    filesSkipped,
    errors,
  };
}
