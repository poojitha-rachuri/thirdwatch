// @thirdwatch/language-javascript — Plan 04 implements this
import type { LanguageAnalyzerPlugin } from "@thirdwatch/core";

export class JavaScriptPlugin implements LanguageAnalyzerPlugin {
  readonly name = "JavaScript/TypeScript Analyzer";
  readonly language = "javascript";
  readonly extensions = [".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx"];

  async analyze(): Promise<[]> {
    throw new Error("JavaScriptPlugin.analyze() not yet implemented — see Plan 04");
  }
}
