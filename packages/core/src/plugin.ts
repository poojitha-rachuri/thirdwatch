// Plugin interface stub — Plan 03 implements the full version

export interface AnalyzerContext {
  filePath: string;
  source: string;
  scanRoot: string;
  resolvedEnv: Record<string, string>;
}

// Stub type — Plan 03 expands this into a discriminated union
export type DependencyEntry = Record<string, unknown> & { kind: string };

export interface LanguageAnalyzerPlugin {
  readonly name: string;
  readonly language: string;
  readonly extensions: string[];
  analyze(context: AnalyzerContext): Promise<DependencyEntry[]>;
  analyzeManifests?(manifestFiles: string[], scanRoot: string): Promise<DependencyEntry[]>;
}
