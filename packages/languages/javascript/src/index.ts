// @thirdwatch/language-javascript — JavaScript/TypeScript language analyzer plugin
import type {
  LanguageAnalyzerPlugin,
  AnalyzerContext,
  DependencyEntry,
} from "@thirdwatch/core";
import { analyzeJavaScript } from "./analyzer.js";
import { parseManifests } from "./manifests.js";

export class JavaScriptPlugin implements LanguageAnalyzerPlugin {
  readonly name = "JavaScript/TypeScript Analyzer";
  readonly language = "javascript";
  readonly extensions = [".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx"];

  async analyze(context: AnalyzerContext): Promise<DependencyEntry[]> {
    return analyzeJavaScript(context);
  }

  async analyzeManifests(
    manifestFiles: string[],
    scanRoot: string,
  ): Promise<DependencyEntry[]> {
    return parseManifests(manifestFiles, scanRoot);
  }
}
