import { randomUUID } from "node:crypto";
import semver from "semver";
import type { WatchedDependency, ChangeEvent, ETagCache } from "./types.js";
import { NpmAdapter } from "./adapters/npm.js";
import { PyPIAdapter } from "./adapters/pypi.js";
import { GitHubAdapter } from "./adapters/github.js";
import { classifyChange } from "./classification/pipeline.js";
import type { ClassificationConfig } from "./classification/types.js";

function determineSemverType(
  oldVersion: string,
  newVersion: string,
): "major" | "minor" | "patch" | undefined {
  if (!semver.valid(oldVersion) || !semver.valid(newVersion)) return undefined;
  const diff = semver.diff(oldVersion, newVersion);
  if (!diff) return undefined;
  if (diff.startsWith("major") || diff === "premajor") return "major";
  if (diff.startsWith("minor") || diff === "preminor") return "minor";
  return "patch";
}

export const DEFAULT_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export class DependencyChecker {
  private readonly npmAdapter: NpmAdapter;
  private readonly pypiAdapter: PyPIAdapter;
  private readonly githubAdapter: GitHubAdapter;
  private readonly classificationConfig: ClassificationConfig;

  constructor(
    etagCache: ETagCache,
    githubToken?: string,
    classificationConfig?: ClassificationConfig,
  ) {
    this.npmAdapter = new NpmAdapter(etagCache);
    this.pypiAdapter = new PyPIAdapter(etagCache);
    this.githubAdapter = new GitHubAdapter(githubToken, etagCache);
    this.classificationConfig = classificationConfig ?? {};
  }

  async check(dependency: WatchedDependency): Promise<ChangeEvent[]> {
    if (dependency.kind === "package") {
      return this.checkPackage(dependency);
    }
    if (dependency.githubRepo) {
      return this.checkGitHub(dependency);
    }
    return [];
  }

  private async checkPackage(
    dep: WatchedDependency,
  ): Promise<ChangeEvent[]> {
    const adapter =
      dep.ecosystem === "pypi" ? this.pypiAdapter : this.npmAdapter;
    const result = await adapter.getLatestVersion(dep.identifier);
    if (!result) return [];

    const lastSeen = dep.lastSeenVersion ?? dep.currentVersion;
    if (!lastSeen || result.version === lastSeen) return [];

    const svType = determineSemverType(lastSeen, result.version);

    const classification = await classifyChange(
      {
        dependency: dep,
        previousVersion: lastSeen,
        newVersion: result.version,
      },
      this.classificationConfig,
    );

    return [
      {
        id: randomUUID(),
        dependency: dep,
        detectedAt: new Date(),
        changeType: classification.category,
        previousVersion: lastSeen,
        newVersion: result.version,
        title: `${dep.identifier} ${lastSeen} → ${result.version}`,
        semverType: svType,
        rawData: { source: dep.ecosystem ?? "npm", version: result.version },
      },
    ];
  }

  private async checkGitHub(
    dep: WatchedDependency,
  ): Promise<ChangeEvent[]> {
    const [owner, repo] = dep.githubRepo!.split("/");
    if (!owner || !repo) return [];

    const release = await this.githubAdapter.getLatestRelease(owner, repo);
    if (!release) return [];

    const lastSeen = dep.lastSeenVersion ?? dep.currentVersion;
    const tag = release.tagName.replace(/^v/, "");
    if (lastSeen && tag === lastSeen) return [];

    const svType = lastSeen
      ? determineSemverType(lastSeen, tag)
      : undefined;

    const changelogText = release.body || undefined;

    const classification = await classifyChange(
      {
        dependency: dep,
        previousVersion: lastSeen,
        newVersion: tag,
        changelogText,
      },
      this.classificationConfig,
    );

    return [
      {
        id: randomUUID(),
        dependency: dep,
        detectedAt: new Date(),
        changeType: classification.category,
        previousVersion: lastSeen,
        newVersion: tag,
        title: release.name || `${dep.identifier} ${tag}`,
        body: changelogText,
        url: release.htmlUrl,
        semverType: svType,
        rawData: {
          source: "github",
          tagName: release.tagName,
          prerelease: release.prerelease,
        },
      },
    ];
  }
}
