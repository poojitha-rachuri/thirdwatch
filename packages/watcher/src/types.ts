import type { ChangeCategory } from "@thirdwatch/tdm";

// ---------------------------------------------------------------------------
// Core domain types
// ---------------------------------------------------------------------------

export interface WatchedDependency {
  tdmId: string;
  kind: "package" | "api" | "sdk";
  identifier: string;
  currentVersion?: string | undefined;
  ecosystem?: string | undefined;
  githubRepo?: string | undefined;
  changelogUrl?: string | undefined;
  lastCheckedAt?: Date | undefined;
  lastSeenVersion?: string | undefined;
}

export interface ChangeEvent {
  id: string;
  dependency: WatchedDependency;
  detectedAt: Date;
  changeType: ChangeCategory;
  previousVersion?: string | undefined;
  newVersion?: string | undefined;
  title: string;
  body?: string | undefined;
  url?: string | undefined;
  semverType?: "major" | "minor" | "patch" | undefined;
  rawData: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Adapter-specific types
// ---------------------------------------------------------------------------

export interface NpmVersionInfo {
  name: string;
  version: string;
  publishedAt: string;
  repository?: string | undefined;
  etag?: string | undefined;
}

export interface PyPIVersionInfo {
  name: string;
  version: string;
  publishedAt?: string | undefined;
  projectUrl?: string | undefined;
  sourceUrl?: string | undefined;
}

export interface RegistryAdapter {
  getLatestVersion(
    packageName: string,
  ): Promise<{ version: string; etag?: string | undefined } | null>;
}

export interface ETagCache {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
}
