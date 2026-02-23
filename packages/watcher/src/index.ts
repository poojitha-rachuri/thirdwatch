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
