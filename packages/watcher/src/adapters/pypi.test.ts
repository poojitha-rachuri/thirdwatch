import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryETagCache } from "../etag-cache.js";
import { PyPIAdapter } from "./pypi.js";

const makePyPIResponse = (overrides?: Record<string, unknown>) => ({
  info: {
    name: "requests",
    version: "2.31.0",
    project_urls: {
      Homepage: "https://requests.readthedocs.io",
      Source: "https://github.com/psf/requests",
    },
    package_url: "https://pypi.org/project/requests/",
  },
  releases: {
    "2.31.0": [
      { upload_time_iso_8601: "2024-01-10T12:00:00.000Z" },
    ],
  },
  ...overrides,
});

describe("PyPIAdapter", () => {
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
      headers: new Headers({ etag: '"pypi-etag"' }),
      json: async () => makePyPIResponse(),
    });

    const cache = new InMemoryETagCache();
    const adapter = new PyPIAdapter(cache);
    const result = await adapter.getLatestVersion("requests");

    expect(result).toEqual({
      name: "requests",
      version: "2.31.0",
      publishedAt: "2024-01-10T12:00:00.000Z",
      projectUrl: "https://pypi.org/project/requests/",
      sourceUrl: "https://github.com/psf/requests",
    });
    expect(cache.get("pypi:requests")).toBe('"pypi-etag"');
  });

  it("sends ETag on second request", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ etag: '"etag-1"' }),
      json: async () => makePyPIResponse(),
    });

    const cache = new InMemoryETagCache();
    const adapter = new PyPIAdapter(cache);

    await adapter.getLatestVersion("requests");

    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ etag: '"etag-2"' }),
      json: async () => makePyPIResponse(),
    });

    await adapter.getLatestVersion("requests");

    const secondCall = fetchSpy.mock.calls[1] as [string, RequestInit];
    const headers = secondCall[1].headers as Record<string, string>;
    expect(headers["If-None-Match"]).toBe('"etag-1"');
  });

  it("returns null on 304 Not Modified", async () => {
    const cache = new InMemoryETagCache();
    cache.set("pypi:requests", '"cached-etag"');

    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 304,
      headers: new Headers(),
    });

    const adapter = new PyPIAdapter(cache);
    const result = await adapter.getLatestVersion("requests");

    expect(result).toBeNull();
  });

  it("throws on non-OK, non-304 response", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers(),
    });

    const cache = new InMemoryETagCache();
    const adapter = new PyPIAdapter(cache);

    await expect(adapter.getLatestVersion("requests")).rejects.toThrow(
      "PyPI returned 500",
    );
  });

  it("handles missing project_urls gracefully", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () =>
        makePyPIResponse({
          info: {
            name: "some-pkg",
            version: "1.0.0",
            project_urls: null,
            package_url: "https://pypi.org/project/some-pkg/",
          },
        }),
    });

    const cache = new InMemoryETagCache();
    const adapter = new PyPIAdapter(cache);
    const result = await adapter.getLatestVersion("some-pkg");

    expect(result?.sourceUrl).toBeUndefined();
  });
});
