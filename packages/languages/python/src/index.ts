// @thirdwatch/language-python — Python language analyzer plugin
import type { LanguageAnalyzerPlugin, AnalyzerContext, DependencyEntry } from "@thirdwatch/core";
import { analyzePython } from "./analyzer.js";
import { parseManifests } from "./manifests.js";

export class PythonPlugin implements LanguageAnalyzerPlugin {
  readonly name = "Python Analyzer";
  readonly language = "python";
  readonly extensions = [".py"];

  async analyze(context: AnalyzerContext): Promise<DependencyEntry[]> {
    return analyzePython(context);
  }

  async analyzeManifests(
    manifestFiles: string[],
    scanRoot: string,
  ): Promise<DependencyEntry[]> {
    return parseManifests(manifestFiles, scanRoot);
  }
}
