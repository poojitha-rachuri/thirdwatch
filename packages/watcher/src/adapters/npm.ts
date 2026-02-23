import semver from "semver";
import type { ETagCache, NpmVersionInfo, RegistryAdapter } from "../types.js";

const NPM_REGISTRY = "https://registry.npmjs.org";

interface NpmRegistryResponse {
  name: string;
  "dist-tags": Record<string, string>;
  time: Record<string, string>;
  versions: Record<string, unknown>;
  repository?: { url?: string } | string;
}

function extractGithubRepo(
  repository: NpmRegistryResponse["repository"],
): string | undefined {
  if (!repository) return undefined;
  const url = typeof repository === "string" ? repository : repository.url;
  if (!url) return undefined;
  const match = url.match(/github\.com[/:]([^/]+\/[^/.]+)/);
  return match?.[1];
}

export class NpmAdapter implements RegistryAdapter {
  constructor(private readonly etagCache: ETagCache) {}

  async getLatestVersion(
    packageName: string,
  ): Promise<NpmVersionInfo | null> {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    const cachedEtag = this.etagCache.get(`npm:${packageName}`);
    if (cachedEtag) {
      headers["If-None-Match"] = cachedEtag;
    }

    const response = await fetch(`${NPM_REGISTRY}/${packageName}`, {
      headers,
    });

    if (response.status === 304) {
      return null;
    }

    if (!response.ok) {
      throw new Error(
        `npm registry returned ${response.status} for ${packageName}`,
      );
    }

    const etag = response.headers.get("etag") ?? undefined;
    if (etag) {
      this.etagCache.set(`npm:${packageName}`, etag);
    }

    const data = (await response.json()) as NpmRegistryResponse;
    const latest = data["dist-tags"]?.["latest"];
    if (!latest) {
      return null;
    }

    const publishedAt = data.time?.[latest] ?? "";
    const repository = extractGithubRepo(data.repository);

    return {
      name: data.name,
      version: latest,
      publishedAt,
      repository,
      etag,
    };
  }

  async getVersionsSince(
    packageName: string,
    sinceVersion: string,
  ): Promise<NpmVersionInfo[]> {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    const response = await fetch(`${NPM_REGISTRY}/${packageName}`, {
      headers,
    });

    if (!response.ok) {
      throw new Error(
        `npm registry returned ${response.status} for ${packageName}`,
      );
    }

    const data = (await response.json()) as NpmRegistryResponse;
    const repository = extractGithubRepo(data.repository);

    const allVersions = Object.keys(data.versions ?? {});
    const newerVersions = allVersions.filter(
      (v) => semver.valid(v) && semver.gt(v, sinceVersion),
    );

    newerVersions.sort((a, b) => semver.compare(a, b));

    return newerVersions.map((v) => ({
      name: data.name,
      version: v,
      publishedAt: data.time?.[v] ?? "",
      repository,
    }));
  }
}
