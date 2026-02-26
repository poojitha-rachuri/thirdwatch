import { readFile, stat } from "node:fs/promises";
import { availableParallelism } from "node:os";
import { basename, extname, relative } from "node:path";
import fg from "fast-glob";
import type { TDM } from "@thirdwatch/tdm";
import type { LanguageAnalyzerPlugin, DependencyEntry } from "./plugin.js";
import { buildTDM } from "./build-tdm.js";
import { mergeManifestAndLockfile } from "./lockfile.js";
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
  /** Whether to resolve env vars in URLs (default: true) */
  resolveEnv?: boolean;
  /** Use process.env for URL resolution (default: false) */
  useProcessEnv?: boolean;
  /** Max concurrent file analyses (default: os.availableParallelism() or 16) */
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
  // Python
  "requirements.txt",
  "pyproject.toml",
  "Pipfile",
  "setup.py",
  "setup.cfg",
  "environment.yml",
  // JavaScript/TypeScript
  "package.json",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "deno.json",
  // Go
  "go.mod",
  // Ruby
  "Gemfile",
  // Java
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "libs.versions.toml",
  // Rust
  "Cargo.toml",
  "Cargo.lock",
  // PHP
  "composer.json",
  "composer.lock",
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
    concurrency = Math.min(16, Math.max(8, availableParallelism?.() ?? 16)),
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
  const allFiles = await fg.glob("**/*", {
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

  // Separate manifest files from source files (match by basename to avoid false positives)
  const manifestFiles = filteredFiles.filter((f) => {
    const name = basename(f);
    return (
      MANIFEST_PATTERNS.includes(name) ||
      /^requirements(-[^/]+)?\.txt$/.test(name)
    );
  });

  // Source files: only files with extensions matching a registered plugin
  const sourceFiles = filteredFiles.filter((f) => pluginMap.has(extname(f)));

  // Collect entries from manifests (parallel across plugins)
  const manifestResults = await Promise.all(
    plugins
      .filter((p): p is LanguageAnalyzerPlugin & { analyzeManifests: NonNullable<LanguageAnalyzerPlugin["analyzeManifests"]> } =>
        p.analyzeManifests != null,
      )
      .map((p) => p.analyzeManifests!(manifestFiles, root)),
  );
  const manifestEntries = manifestResults.flat();

  // Merge lockfile resolved versions into manifest constraint entries
  const LOCKFILE_NAMES = new Set([
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "Cargo.lock",
    "composer.lock",
  ]);

  const manifestOnly = manifestEntries.filter(
    (e) => e.kind !== "package" || !LOCKFILE_NAMES.has(basename(e.manifest_file)),
  );
  const lockfileOnly = manifestEntries.filter(
    (e) => e.kind === "package" && LOCKFILE_NAMES.has(basename(e.manifest_file)),
  );

  const mergedManifestEntries = mergeManifestAndLockfile(manifestOnly, lockfileOnly);

  // Analyze source files with concurrency control
  const errors: ScanError[] = [];

  type TaskResult = { entries: DependencyEntry[]; skipped: boolean };
  const tasks = sourceFiles.map((filePath) => async (): Promise<TaskResult> => {
    // Skip files that are too large
    try {
      const fileStat = await stat(filePath);
      if (fileStat.size > maxFileSizeBytes) {
        return { entries: [], skipped: true };
      }
    } catch {
      return { entries: [], skipped: true };
    }

    const plugin = pluginMap.get(extname(filePath));
    if (!plugin) return { entries: [], skipped: false };

    try {
      const source = await readFile(filePath, "utf-8");
      const entries = await plugin.analyze({
        filePath,
        source,
        scanRoot: root,
        resolvedEnv,
      });
      return { entries, skipped: false };
    } catch (err) {
      errors.push({
        filePath,
        error: err instanceof Error ? err.message : String(err),
      });
      return { entries: [], skipped: false };
    }
  });

  const fileResults = await pLimit(tasks, concurrency);
  const filesSkipped = fileResults.filter((r) => r.skipped).length;
  const allEntries: DependencyEntry[] = [
    ...mergedManifestEntries,
    ...fileResults.flatMap((r) => r.entries),
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
