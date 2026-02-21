// @thirdwatch/language-python — Plan 04 implements this
import type { LanguageAnalyzerPlugin } from "@thirdwatch/core";

export class PythonPlugin implements LanguageAnalyzerPlugin {
  readonly name = "Python Analyzer";
  readonly language = "python";
  readonly extensions = [".py"];

  async analyze(): Promise<[]> {
    throw new Error("PythonPlugin.analyze() not yet implemented — see Plan 04");
  }
}
