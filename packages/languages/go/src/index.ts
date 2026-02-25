// @thirdwatch/language-go — Go language analyzer plugin
import type { LanguageAnalyzerPlugin, AnalyzerContext, DependencyEntry } from "@thirdwatch/core";
import { analyzeGo } from "./analyzer.js";
import { parseManifests } from "./manifests.js";

export class GoPlugin implements LanguageAnalyzerPlugin {
  readonly name = "Go Analyzer";
  readonly language = "go";
  readonly extensions = [".go"];

  async analyze(context: AnalyzerContext): Promise<DependencyEntry[]> {
    return analyzeGo(context);
  }

  async analyzeManifests(
    manifestFiles: string[],
    scanRoot: string,
  ): Promise<DependencyEntry[]> {
    return parseManifests(manifestFiles, scanRoot);
  }
}
