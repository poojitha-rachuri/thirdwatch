export type {
  WatchedDependency,
  ChangeEvent,
  NpmVersionInfo,
  PyPIVersionInfo,
  RegistryAdapter,
  ETagCache,
} from "./types.js";

export { InMemoryETagCache } from "./etag-cache.js";
export { NpmAdapter, PyPIAdapter, GitHubAdapter } from "./adapters/index.js";
export type { GitHubRelease } from "./adapters/index.js";
export { DependencyChecker, DEFAULT_CHECK_INTERVAL_MS } from "./check-dependency.js";

export {
  classifyChange,
  selectHighestSeverity,
  classifyBySemver,
  classifyByLLM,
  assignPreliminaryPriority,
} from "./classification/index.js";
export type {
  ClassificationInput,
  ClassificationResult,
  ClassificationConfig,
  OpenApiDiff,
  SchemaDiff,
  ParamDiff,
  LLMConfig,
} from "./classification/index.js";
