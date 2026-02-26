// @thirdwatch/language-php — PHP language analyzer plugin
import type { LanguageAnalyzerPlugin, AnalyzerContext, DependencyEntry } from "@thirdwatch/core";
import { analyzePhp } from "./analyzer.js";
import { parseManifests } from "./manifests.js";

export class PhpPlugin implements LanguageAnalyzerPlugin {
  readonly name = "PHP Analyzer";
  readonly language = "php";
  readonly extensions = [".php"];

  async analyze(context: AnalyzerContext): Promise<DependencyEntry[]> {
    return analyzePhp(context);
  }

  async analyzeManifests(
    manifestFiles: string[],
    scanRoot: string,
  ): Promise<DependencyEntry[]> {
    return parseManifests(manifestFiles, scanRoot);
  }
}
