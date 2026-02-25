// @thirdwatch/language-java — Java language analyzer plugin
import type { LanguageAnalyzerPlugin, AnalyzerContext, DependencyEntry } from "@thirdwatch/core";
import { analyzeJava } from "./analyzer.js";
import { parseManifests } from "./manifests.js";

export class JavaPlugin implements LanguageAnalyzerPlugin {
  readonly name = "Java Analyzer";
  readonly language = "java";
  readonly extensions = [".java", ".kt"];

  async analyze(context: AnalyzerContext): Promise<DependencyEntry[]> {
    return analyzeJava(context);
  }

  async analyzeManifests(
    manifestFiles: string[],
    scanRoot: string,
  ): Promise<DependencyEntry[]> {
    return parseManifests(manifestFiles, scanRoot);
  }
}
