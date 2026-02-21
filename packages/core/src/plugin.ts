import type {
  TDMPackage,
  TDMApi,
  TDMSdk,
  TDMInfrastructure,
  TDMWebhook,
} from "@thirdwatch/tdm";

// ---------------------------------------------------------------------------
// DependencyEntry — discriminated union of all TDM dependency kinds
// ---------------------------------------------------------------------------

export type DependencyEntry =
  | ({ kind: "package" } & TDMPackage)
  | ({ kind: "api" } & TDMApi)
  | ({ kind: "sdk" } & TDMSdk)
  | ({ kind: "infrastructure" } & TDMInfrastructure)
  | ({ kind: "webhook" } & TDMWebhook);

// ---------------------------------------------------------------------------
// AnalyzerContext — passed to each plugin's analyze() method
// ---------------------------------------------------------------------------

export interface AnalyzerContext {
  /** Absolute path to the file being analyzed */
  filePath: string;
  /** File contents as a UTF-8 string */
  source: string;
  /** Root of the scan (for computing relative paths) */
  scanRoot: string;
  /** Resolved env vars / config values available for URL resolution */
  resolvedEnv: Record<string, string>;
}

// ---------------------------------------------------------------------------
// LanguageAnalyzerPlugin — the public contract every language analyzer must
// implement. This is a stable public API from v0.1.0.
// ---------------------------------------------------------------------------

export interface LanguageAnalyzerPlugin {
  /** Human-readable name, e.g., "Python 3.x" */
  readonly name: string;
  /** Language slug, e.g., "python" — used in TDM metadata */
  readonly language: string;
  /** File extensions this analyzer handles, e.g., [".py"] */
  readonly extensions: string[];
  /**
   * Analyze a single file and return all discovered dependency entries.
   * Called once per file. Must NOT have side effects outside the return value.
   */
  analyze(context: AnalyzerContext): Promise<DependencyEntry[]>;
  /**
   * Optional: called once per scan with all manifest files found
   * (package.json, requirements.txt, go.mod, etc.).
   * Returns package dependency entries from manifest parsing.
   */
  analyzeManifests?(
    manifestFiles: string[],
    scanRoot: string,
  ): Promise<DependencyEntry[]>;
}
