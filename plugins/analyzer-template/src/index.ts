import type { LanguageAnalyzerPlugin, DependencyEntry, AnalyzerContext } from "@thirdwatch/core";

/**
 * Template for a Thirdwatch language analyzer plugin.
 *
 * Copy this directory to `plugins/thirdwatch-language-YOURNAME/`
 * and implement the methods below.
 *
 * See: docs/contributing/adding-language-analyzer.md
 */
export const plugin: LanguageAnalyzerPlugin = {
  /**
   * Human-readable name displayed in CLI output.
   */
  name: "YourLanguage Analyzer",

  /**
   * Language identifier (lowercase).
   * Example: "rust", "java", "go"
   */
  language: "yourlanguage",

  /**
   * File extensions this plugin handles.
   * Example: [".rs"] for Rust, [".java", ".kt"] for Java/Kotlin
   */
  extensions: [".yourlang"],

  /**
   * Main analysis entry point. Called once per file.
   *
   * @param context - Provides file path, source code, and scan root
   * @returns Array of detected dependency entries (may be empty)
   */
  async analyze(context: AnalyzerContext): Promise<DependencyEntry[]> {
    const dependencies: DependencyEntry[] = [];

    // TODO: Use web-tree-sitter to parse context.source into an AST
    // TODO: Query the AST for import statements, HTTP calls, instantiations
    // TODO: Match against SDK registry patterns

    // Example structure for a detected dependency:
    // dependencies.push({
    //   kind: "sdk",
    //   provider: "stripe",
    //   file: context.filePath,
    //   line: 1,
    //   snippet: "import stripe",
    // });

    return dependencies;
  },
};

export default plugin;
