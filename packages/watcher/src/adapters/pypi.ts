import type { ETagCache, PyPIVersionInfo, RegistryAdapter } from "../types.js";

const PYPI_BASE = "https://pypi.org/pypi";

interface PyPIResponse {
  info: {
    name: string;
    version: string;
    project_urls?: Record<string, string> | null;
    package_url?: string;
  };
  releases: Record<
    string,
    Array<{ upload_time_iso_8601?: string }>
  >;
}

function findGithubUrl(
  projectUrls: Record<string, string> | null | undefined,
): string | undefined {
  if (!projectUrls) return undefined;
  for (const url of Object.values(projectUrls)) {
    if (url.includes("github.com")) {
      return url;
    }
  }
  return undefined;
}

export class PyPIAdapter implements RegistryAdapter {
  constructor(private readonly etagCache: ETagCache) {}

  async getLatestVersion(
    packageName: string,
  ): Promise<PyPIVersionInfo | null> {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    const cachedEtag = this.etagCache.get(`pypi:${packageName}`);
    if (cachedEtag) {
      headers["If-None-Match"] = cachedEtag;
    }

    const response = await fetch(`${PYPI_BASE}/${packageName}/json`, {
      headers,
    });

    if (response.status === 304) {
      return null;
    }

    if (!response.ok) {
      throw new Error(
        `PyPI returned ${response.status} for ${packageName}`,
      );
    }

    const etag = response.headers.get("etag") ?? undefined;
    if (etag) {
      this.etagCache.set(`pypi:${packageName}`, etag);
    }

    const data = (await response.json()) as PyPIResponse;
    const version = data.info.version;
    const releases = data.releases[version];
    const publishedAt = releases?.[0]?.upload_time_iso_8601;
    const sourceUrl = findGithubUrl(data.info.project_urls);

    return {
      name: data.info.name,
      version,
      publishedAt,
      projectUrl: data.info.package_url,
      sourceUrl,
    };
  }
}
