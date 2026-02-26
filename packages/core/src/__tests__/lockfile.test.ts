import { describe, it, expect } from "vitest";
import { mergeManifestAndLockfile } from "../lockfile.js";
import type { DependencyEntry } from "../plugin.js";

function makePackage(
  name: string,
  version: string,
  ecosystem = "npm",
  constraint?: string,
): DependencyEntry {
  const entry: DependencyEntry = {
    kind: "package",
    name,
    ecosystem,
    current_version: version,
    manifest_file: "package.json",
    locations: [],
    usage_count: 0,
    confidence: "high",
  };
  if (constraint !== undefined) {
    entry.version_constraint = constraint;
  }
  return entry;
}

describe("mergeManifestAndLockfile", () => {
  it("overrides manifest version with lockfile resolved version", () => {
    const manifest = [makePackage("stripe", "7.0.0", "npm", "^7.0.0")];
    const lockfile = [makePackage("stripe", "7.1.0", "npm")];

    const merged = mergeManifestAndLockfile(manifest, lockfile);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.kind === "package" && merged[0]!.current_version).toBe("7.1.0");
    expect(merged[0]!.kind === "package" && merged[0]!.version_constraint).toBe("^7.0.0");
  });

  it("keeps manifest entry when no lockfile match", () => {
    const manifest = [makePackage("axios", "1.6.0", "npm", "^1.6.0")];
    const merged = mergeManifestAndLockfile(manifest, []);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.kind === "package" && merged[0]!.current_version).toBe("1.6.0");
  });

  it("includes lockfile-only entries", () => {
    const manifest = [makePackage("stripe", "7.0.0", "npm")];
    const lockfile = [
      makePackage("stripe", "7.1.0", "npm"),
      makePackage("transitive-dep", "2.0.0", "npm"),
    ];

    const merged = mergeManifestAndLockfile(manifest, lockfile);
    expect(merged).toHaveLength(2);
    const transitive = merged.find(
      (e) => e.kind === "package" && e.name === "transitive-dep",
    );
    expect(transitive).toBeDefined();
  });

  it("matches by ecosystem to avoid cross-ecosystem conflicts", () => {
    const manifest = [makePackage("redis", "5.0.0", "pypi", ">=5.0")];
    const lockfile = [makePackage("redis", "0.24.0", "cargo")];

    const merged = mergeManifestAndLockfile(manifest, lockfile);
    expect(merged).toHaveLength(2);
    const pypi = merged.find((e) => e.kind === "package" && e.ecosystem === "pypi");
    expect(pypi && pypi.kind === "package" && pypi.current_version).toBe("5.0.0");
  });

  it("passes through non-package entries unchanged", () => {
    const manifest: DependencyEntry[] = [
      {
        kind: "api",
        url: "https://api.stripe.com/v1/charges",
        method: "POST",
        locations: [],
        usage_count: 1,
        confidence: "high",
      },
    ];

    const merged = mergeManifestAndLockfile(manifest, []);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.kind).toBe("api");
  });
});
