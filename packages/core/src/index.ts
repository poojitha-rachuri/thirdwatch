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

export { loadSDKRegistry, buildPackageProviderMap, buildUrlProviderMap, buildConstructorProviderMap, buildFactoryProviderMap, buildRegistryMaps } from "./registry.js";
export type { SDKRegistryEntry, SDKPatternEntry, ConstructorPattern, RegistryMaps } from "./registry.js";

export { inferProvider } from "./registry-inference.js";
export { detectByConvention } from "./registry-conventions.js";

export { scoreConfidence } from "./confidence.js";
export type { DetectionMethod } from "./confidence.js";

export { mergeManifestAndLockfile } from "./lockfile.js";
