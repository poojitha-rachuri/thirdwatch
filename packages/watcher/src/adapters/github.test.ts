import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryETagCache } from "../etag-cache.js";
import { GitHubAdapter } from "./github.js";

const makeReleaseResponse = (overrides?: Record<string, unknown>) => ({
  tag_name: "v1.2.0",
  name: "Release v1.2.0",
  body: "## What's Changed\n- Bug fixes",
  published_at: "2024-06-01T12:00:00Z",
  html_url: "https://github.com/octocat/hello/releases/tag/v1.2.0",
  prerelease: false,
  draft: false,
  ...overrides,
});

describe("GitHubAdapter", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getLatestRelease", () => {
    it("fetches and parses the latest release", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ etag: '"gh-etag-1"' }),
        json: async () => makeReleaseResponse(),
      });

      const cache = new InMemoryETagCache();
      const adapter = new GitHubAdapter("ghp_token123", cache);
      const result = await adapter.getLatestRelease("octocat", "hello");

      expect(result).toEqual({
        tagName: "v1.2.0",
        name: "Release v1.2.0",
        body: "## What's Changed\n- Bug fixes",
        publishedAt: "2024-06-01T12:00:00Z",
        htmlUrl: "https://github.com/octocat/hello/releases/tag/v1.2.0",
        prerelease: false,
        draft: false,
      });
      expect(cache.get("github:octocat/hello:latest")).toBe('"gh-etag-1"');
    });

    it("returns null on 304 Not Modified", async () => {
      const cache = new InMemoryETagCache();
      cache.set("github:octocat/hello:latest", '"cached-etag"');

      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 304,
        headers: new Headers(),
      });

      const adapter = new GitHubAdapter("ghp_token123", cache);
      const result = await adapter.getLatestRelease("octocat", "hello");

      expect(result).toBeNull();
    });

    it("returns null on 404", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers(),
      });

      const cache = new InMemoryETagCache();
      const adapter = new GitHubAdapter("ghp_token123", cache);
      const result = await adapter.getLatestRelease("octocat", "hello");

      expect(result).toBeNull();
    });

    it("sends ETag on second request", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ etag: '"etag-1"' }),
        json: async () => makeReleaseResponse(),
      });

      const cache = new InMemoryETagCache();
      const adapter = new GitHubAdapter("ghp_token123", cache);

      await adapter.getLatestRelease("octocat", "hello");

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ etag: '"etag-2"' }),
        json: async () => makeReleaseResponse(),
      });

      await adapter.getLatestRelease("octocat", "hello");

      const secondCall = fetchSpy.mock.calls[1] as [string, RequestInit];
      const headers = secondCall[1].headers as Record<string, string>;
      expect(headers["If-None-Match"]).toBe('"etag-1"');
    });
  });

  describe("getRecentReleases", () => {
    it("filters releases by date", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => [
          makeReleaseResponse({
            tag_name: "v1.3.0",
            published_at: "2024-06-15T00:00:00Z",
          }),
          makeReleaseResponse({
            tag_name: "v1.2.0",
            published_at: "2024-06-01T00:00:00Z",
          }),
          makeReleaseResponse({
            tag_name: "v1.1.0",
            published_at: "2024-05-01T00:00:00Z",
          }),
        ],
      });

      const cache = new InMemoryETagCache();
      const adapter = new GitHubAdapter("ghp_token123", cache);
      const results = await adapter.getRecentReleases(
        "octocat",
        "hello",
        new Date("2024-05-15T00:00:00Z"),
      );

      expect(results.map((r) => r.tagName)).toEqual(["v1.3.0", "v1.2.0"]);
    });
  });

  describe("getChangelog", () => {
    it("decodes base64 content", async () => {
      const changelogText = "# Changelog\n\n## v1.2.0\n- Fixed bugs";
      const base64Content = Buffer.from(changelogText).toString("base64");

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          content: base64Content,
          encoding: "base64",
        }),
      });

      const cache = new InMemoryETagCache();
      const adapter = new GitHubAdapter("ghp_token123", cache);
      const result = await adapter.getChangelog("octocat", "hello");

      expect(result).toBe(changelogText);
    });

    it("returns null on 404", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers(),
      });

      const cache = new InMemoryETagCache();
      const adapter = new GitHubAdapter("ghp_token123", cache);
      const result = await adapter.getChangelog("octocat", "hello");

      expect(result).toBeNull();
    });
  });

  describe("Authorization header", () => {
    it("sets Authorization header when token is provided", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => makeReleaseResponse(),
      });

      const cache = new InMemoryETagCache();
      const adapter = new GitHubAdapter("ghp_my_token", cache);
      await adapter.getLatestRelease("octocat", "hello");

      const call = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = call[1].headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bearer ghp_my_token");
    });

    it("does not set Authorization header when token is undefined", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => makeReleaseResponse(),
      });

      const cache = new InMemoryETagCache();
      const adapter = new GitHubAdapter(undefined, cache);
      await adapter.getLatestRelease("octocat", "hello");

      const call = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = call[1].headers as Record<string, string>;
      expect(headers["Authorization"]).toBeUndefined();
    });
  });
});
