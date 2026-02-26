// @thirdwatch/language-rust — Rust language analyzer plugin
import type { LanguageAnalyzerPlugin, AnalyzerContext, DependencyEntry } from "@thirdwatch/core";
import { analyzeRust } from "./analyzer.js";
import { parseManifests } from "./manifests.js";

export class RustPlugin implements LanguageAnalyzerPlugin {
  readonly name = "Rust Analyzer";
  readonly language = "rust";
  readonly extensions = [".rs"];

  async analyze(context: AnalyzerContext): Promise<DependencyEntry[]> {
    return analyzeRust(context);
  }

  async analyzeManifests(
    manifestFiles: string[],
    scanRoot: string,
  ): Promise<DependencyEntry[]> {
    return parseManifests(manifestFiles, scanRoot);
  }
}
