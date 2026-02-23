import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryETagCache } from "../etag-cache.js";
import { NpmAdapter } from "./npm.js";

const makeNpmResponse = (overrides?: Record<string, unknown>) => ({
  name: "express",
  "dist-tags": { latest: "4.19.2" },
  time: {
    "4.19.1": "2024-01-01T00:00:00.000Z",
    "4.19.2": "2024-03-15T00:00:00.000Z",
  },
  versions: {
    "4.19.1": {},
    "4.19.2": {},
  },
  repository: { url: "https://github.com/expressjs/express.git" },
  ...overrides,
});

describe("NpmAdapter", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches and parses the latest version", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ etag: '"abc123"' }),
      json: async () => makeNpmResponse(),
    });

    const cache = new InMemoryETagCache();
    const adapter = new NpmAdapter(cache);
    const result = await adapter.getLatestVersion("express");

    expect(result).toEqual({
      name: "express",
      version: "4.19.2",
      publishedAt: "2024-03-15T00:00:00.000Z",
      repository: "expressjs/express",
      etag: '"abc123"',
    });
    expect(cache.get("npm:express")).toBe('"abc123"');
  });

  it("sends ETag on second request", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ etag: '"etag-1"' }),
      json: async () => makeNpmResponse(),
    });

    const cache = new InMemoryETagCache();
    const adapter = new NpmAdapter(cache);

    await adapter.getLatestVersion("express");

    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ etag: '"etag-2"' }),
      json: async () => makeNpmResponse(),
    });

    await adapter.getLatestVersion("express");

    const secondCall = fetchSpy.mock.calls[1] as [string, RequestInit];
    const headers = secondCall[1].headers as Record<string, string>;
    expect(headers["If-None-Match"]).toBe('"etag-1"');
  });

  it("returns null on 304 Not Modified", async () => {
    const cache = new InMemoryETagCache();
    cache.set("npm:express", '"cached-etag"');

    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 304,
      headers: new Headers(),
    });

    const adapter = new NpmAdapter(cache);
    const result = await adapter.getLatestVersion("express");

    expect(result).toBeNull();
  });

  it("throws on non-OK, non-304 response", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: new Headers(),
    });

    const cache = new InMemoryETagCache();
    const adapter = new NpmAdapter(cache);

    await expect(adapter.getLatestVersion("no-such-pkg")).rejects.toThrow(
      "npm registry returned 404",
    );
  });

  it("extracts GitHub repo from string repository field", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () =>
        makeNpmResponse({
          repository: "git+https://github.com/lodash/lodash.git",
        }),
    });

    const cache = new InMemoryETagCache();
    const adapter = new NpmAdapter(cache);
    const result = await adapter.getLatestVersion("lodash");

    expect(result?.repository).toBe("lodash/lodash");
  });

  describe("getVersionsSince", () => {
    it("returns versions newer than the given version, sorted", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () =>
          makeNpmResponse({
            versions: {
              "4.18.0": {},
              "4.19.1": {},
              "4.19.2": {},
              "5.0.0-beta.1": {},
            },
          }),
      });

      const cache = new InMemoryETagCache();
      const adapter = new NpmAdapter(cache);
      const results = await adapter.getVersionsSince("express", "4.19.0");

      expect(results.map((r) => r.version)).toEqual([
        "4.19.1",
        "4.19.2",
        "5.0.0-beta.1",
      ]);
    });

    it("returns empty array when no newer versions exist", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () =>
          makeNpmResponse({
            versions: { "4.19.1": {}, "4.19.2": {} },
          }),
      });

      const cache = new InMemoryETagCache();
      const adapter = new NpmAdapter(cache);
      const results = await adapter.getVersionsSince("express", "4.19.2");

      expect(results).toEqual([]);
    });
  });
});
