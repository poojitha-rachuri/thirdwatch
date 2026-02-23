import type { ETagCache } from "../types.js";

const GITHUB_API = "https://api.github.com";

export interface GitHubRelease {
  tagName: string;
  name: string;
  body: string;
  publishedAt: string;
  htmlUrl: string;
  prerelease: boolean;
  draft: boolean;
}

interface GitHubReleaseResponse {
  tag_name: string;
  name: string | null;
  body: string | null;
  published_at: string | null;
  html_url: string;
  prerelease: boolean;
  draft: boolean;
}

interface GitHubContentResponse {
  content: string;
  encoding: string;
}

function parseRelease(data: GitHubReleaseResponse): GitHubRelease {
  return {
    tagName: data.tag_name,
    name: data.name ?? "",
    body: data.body ?? "",
    publishedAt: data.published_at ?? "",
    htmlUrl: data.html_url,
    prerelease: data.prerelease,
    draft: data.draft,
  };
}

export class GitHubAdapter {
  constructor(
    private readonly token: string | undefined,
    private readonly etagCache: ETagCache,
  ) {}

  private authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
    };
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async getLatestRelease(
    owner: string,
    repo: string,
  ): Promise<GitHubRelease | null> {
    const cacheKey = `github:${owner}/${repo}:latest`;
    const headers = this.authHeaders();
    const cachedEtag = this.etagCache.get(cacheKey);
    if (cachedEtag) {
      headers["If-None-Match"] = cachedEtag;
    }

    const response = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/releases/latest`,
      { headers },
    );

    if (response.status === 304 || response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(
        `GitHub API returned ${response.status} for ${owner}/${repo}`,
      );
    }

    const etag = response.headers.get("etag") ?? undefined;
    if (etag) {
      this.etagCache.set(cacheKey, etag);
    }

    const data = (await response.json()) as GitHubReleaseResponse;
    return parseRelease(data);
  }

  async getRecentReleases(
    owner: string,
    repo: string,
    since: Date,
  ): Promise<GitHubRelease[]> {
    const headers = this.authHeaders();

    const response = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/releases?per_page=20`,
      { headers },
    );

    if (!response.ok) {
      throw new Error(
        `GitHub API returned ${response.status} for ${owner}/${repo} releases`,
      );
    }

    const data = (await response.json()) as GitHubReleaseResponse[];
    return data
      .map(parseRelease)
      .filter((r) => r.publishedAt !== "" && new Date(r.publishedAt) > since);
  }

  async getChangelog(
    owner: string,
    repo: string,
  ): Promise<string | null> {
    const headers = this.authHeaders();

    const response = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/contents/CHANGELOG.md`,
      { headers },
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(
        `GitHub API returned ${response.status} for ${owner}/${repo} CHANGELOG.md`,
      );
    }

    const data = (await response.json()) as GitHubContentResponse;
    return Buffer.from(data.content, "base64").toString("utf-8");
  }
}
