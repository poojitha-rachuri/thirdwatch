import { describe, it, expect, vi, beforeEach } from "vitest";
import { DependencyChecker } from "./check-dependency.js";
import { InMemoryETagCache } from "./etag-cache.js";
import type { WatchedDependency } from "./types.js";

function npmResponse(version: string) {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => ({
      name: "express",
      "dist-tags": { latest: version },
      time: { [version]: "2026-01-15T00:00:00Z" },
      versions: { [version]: {} },
    }),
  };
}

function pypiResponse(version: string) {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => ({
      info: { name: "requests", version },
      releases: { [version]: [{ upload_time_iso_8601: "2026-01-15T00:00:00Z" }] },
    }),
  };
}

function githubRelease(tag: string, body = "changelog") {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => ({
      tag_name: tag,
      name: `Release ${tag}`,
      body,
      published_at: "2026-01-15T00:00:00Z",
      html_url: `https://github.com/owner/repo/releases/tag/${tag}`,
      prerelease: false,
      draft: false,
    }),
  };
}

describe("DependencyChecker", () => {
  let checker: DependencyChecker;

  beforeEach(() => {
    vi.restoreAllMocks();
    checker = new DependencyChecker(new InMemoryETagCache());
  });

  it("detects npm major version change as major-update", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      npmResponse("5.0.0") as Response,
    );

    const dep: WatchedDependency = {
      tdmId: "tdm-1",
      kind: "package",
      identifier: "express",
      ecosystem: "npm",
      currentVersion: "4.18.0",
    };

    const events = await checker.check(dep);
    expect(events).toHaveLength(1);
    expect(events[0]!.newVersion).toBe("5.0.0");
    expect(events[0]!.previousVersion).toBe("4.18.0");
    expect(events[0]!.semverType).toBe("major");
    expect(events[0]!.changeType).toBe("major-update");
  });

  it("returns empty when npm version unchanged", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      npmResponse("4.18.0") as Response,
    );

    const dep: WatchedDependency = {
      tdmId: "tdm-1",
      kind: "package",
      identifier: "express",
      ecosystem: "npm",
      currentVersion: "4.18.0",
    };

    const events = await checker.check(dep);
    expect(events).toHaveLength(0);
  });

  it("routes pypi to PyPIAdapter", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      pypiResponse("3.0.0") as Response,
    );

    const dep: WatchedDependency = {
      tdmId: "tdm-1",
      kind: "package",
      identifier: "requests",
      ecosystem: "pypi",
      currentVersion: "2.31.0",
    };

    const events = await checker.check(dep);
    expect(events).toHaveLength(1);
    expect(events[0]!.newVersion).toBe("3.0.0");
  });

  it("returns empty on 304", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 304,
      headers: new Headers(),
    } as Response);

    const dep: WatchedDependency = {
      tdmId: "tdm-1",
      kind: "package",
      identifier: "express",
      ecosystem: "npm",
      currentVersion: "4.18.0",
    };

    const events = await checker.check(dep);
    expect(events).toHaveLength(0);
  });

  it("checks github releases for sdk dependencies", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      githubRelease("v2.0.0") as Response,
    );

    const dep: WatchedDependency = {
      tdmId: "tdm-1",
      kind: "sdk",
      identifier: "stripe-python",
      githubRepo: "stripe/stripe-python",
      currentVersion: "1.5.0",
    };

    const events = await checker.check(dep);
    expect(events).toHaveLength(1);
    expect(events[0]!.newVersion).toBe("2.0.0");
    expect(events[0]!.semverType).toBe("major");
  });

  it("determines minor semver type", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      npmResponse("4.19.0") as Response,
    );

    const dep: WatchedDependency = {
      tdmId: "tdm-1",
      kind: "package",
      identifier: "express",
      ecosystem: "npm",
      currentVersion: "4.18.0",
    };

    const events = await checker.check(dep);
    expect(events).toHaveLength(1);
    expect(events[0]!.semverType).toBe("minor");
    expect(events[0]!.changeType).toBe("minor-update");
  });

  it("determines patch semver type", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      npmResponse("4.18.1") as Response,
    );

    const dep: WatchedDependency = {
      tdmId: "tdm-1",
      kind: "package",
      identifier: "express",
      ecosystem: "npm",
      currentVersion: "4.18.0",
    };

    const events = await checker.check(dep);
    expect(events).toHaveLength(1);
    expect(events[0]!.semverType).toBe("patch");
    expect(events[0]!.changeType).toBe("patch");
  });

  it("classifies github release with breaking changelog as breaking", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      githubRelease("v3.0.0", "BREAKING CHANGE: removed legacy API") as Response,
    );

    const dep: WatchedDependency = {
      tdmId: "tdm-1",
      kind: "sdk",
      identifier: "my-sdk",
      githubRepo: "owner/my-sdk",
      currentVersion: "2.0.0",
    };

    const events = await checker.check(dep);
    expect(events).toHaveLength(1);
    expect(events[0]!.changeType).toBe("breaking");
    expect(events[0]!.body).toBe("BREAKING CHANGE: removed legacy API");
  });

  it("classifies github release with CVE as security", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      githubRelease("v1.0.1", "Fixed CVE-2025-9999 in auth module") as Response,
    );

    const dep: WatchedDependency = {
      tdmId: "tdm-1",
      kind: "sdk",
      identifier: "auth-lib",
      githubRepo: "owner/auth-lib",
      currentVersion: "1.0.0",
    };

    const events = await checker.check(dep);
    expect(events).toHaveLength(1);
    expect(events[0]!.changeType).toBe("security");
  });
});
