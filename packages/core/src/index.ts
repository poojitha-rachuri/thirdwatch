// @thirdwatch/core — Scanner engine & plugin interface

export type {
  LanguageAnalyzerPlugin,
  DependencyEntry,
  AnalyzerContext,
} from "./plugin.js";

export { scan } from "./scanner.js";
export type { ScanOptions, ScanResult, ScanError } from "./scanner.js";

export { buildTDM } from "./build-tdm.js";
export type { BuildContext } from "./build-tdm.js";

export { loadConfig, loadIgnore } from "./config.js";
export type { ThirdwatchConfig } from "./config.js";

export { resolveUrl, loadEnvFile, buildEnvMap } from "./resolve.js";
