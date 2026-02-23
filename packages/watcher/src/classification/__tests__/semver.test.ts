import { describe, it, expect } from "vitest";
import { classifyBySemver } from "../semver.js";
import type { ClassificationInput } from "../types.js";

function input(prev?: string, next?: string): ClassificationInput {
  return {
    dependency: {
      tdmId: "tdm-1",
      kind: "package",
      identifier: "test-pkg",
    },
    previousVersion: prev,
    newVersion: next,
  };
}

describe("classifyBySemver", () => {
  it("returns major-update for major bump", () => {
    const result = classifyBySemver(input("1.0.0", "2.0.0"));
    expect(result.category).toBe("major-update");
    expect(result.confidence).toBe("medium");
    expect(result.classifierUsed).toBe("semver");
  });

  it("returns major-update for premajor bump", () => {
    const result = classifyBySemver(input("1.0.0", "2.0.0-alpha.1"));
    expect(result.category).toBe("major-update");
    expect(result.confidence).toBe("medium");
  });

  it("returns minor-update for minor bump", () => {
    const result = classifyBySemver(input("1.0.0", "1.1.0"));
    expect(result.category).toBe("minor-update");
    expect(result.confidence).toBe("high");
  });

  it("returns minor-update for preminor bump", () => {
    const result = classifyBySemver(input("1.0.0", "1.1.0-beta.1"));
    expect(result.category).toBe("minor-update");
    expect(result.confidence).toBe("high");
  });

  it("returns patch for patch bump", () => {
    const result = classifyBySemver(input("1.0.0", "1.0.1"));
    expect(result.category).toBe("patch");
    expect(result.confidence).toBe("high");
  });

  it("returns patch for prepatch bump", () => {
    const result = classifyBySemver(input("1.0.0", "1.0.1-rc.1"));
    expect(result.category).toBe("patch");
    expect(result.confidence).toBe("high");
  });

  it("returns patch for prerelease bump", () => {
    const result = classifyBySemver(input("1.0.0-alpha.1", "1.0.0-alpha.2"));
    expect(result.category).toBe("patch");
    expect(result.confidence).toBe("high");
  });

  it("returns informational when no previous version", () => {
    const result = classifyBySemver(input(undefined, "1.0.0"));
    expect(result.category).toBe("informational");
    expect(result.confidence).toBe("low");
  });

  it("returns informational when no new version", () => {
    const result = classifyBySemver(input("1.0.0", undefined));
    expect(result.category).toBe("informational");
    expect(result.confidence).toBe("low");
  });

  it("returns informational when both versions missing", () => {
    const result = classifyBySemver(input(undefined, undefined));
    expect(result.category).toBe("informational");
    expect(result.confidence).toBe("low");
  });

  it("returns informational for invalid semver", () => {
    const result = classifyBySemver(input("not-a-version", "2.0.0"));
    expect(result.category).toBe("informational");
    expect(result.confidence).toBe("low");
  });

  it("returns informational for same version", () => {
    const result = classifyBySemver(input("1.0.0", "1.0.0"));
    expect(result.category).toBe("informational");
    expect(result.confidence).toBe("low");
  });

  it("handles large version numbers", () => {
    const result = classifyBySemver(input("7.0.0", "8.0.0"));
    expect(result.category).toBe("major-update");
    expect(result.reasoning).toContain("7.0.0");
    expect(result.reasoning).toContain("8.0.0");
  });

  it("handles 0.x versions (minor = breaking by convention)", () => {
    const result = classifyBySemver(input("0.1.0", "0.2.0"));
    expect(result.category).toBe("minor-update");
    expect(result.confidence).toBe("high");
  });

  it("handles 0.0.x to 0.1.0 bump", () => {
    const result = classifyBySemver(input("0.0.1", "0.1.0"));
    expect(result.category).toBe("minor-update");
  });

  it("handles 0.x to 1.0.0 bump as major", () => {
    const result = classifyBySemver(input("0.9.0", "1.0.0"));
    expect(result.category).toBe("major-update");
  });

  it("includes version info in reasoning", () => {
    const result = classifyBySemver(input("4.18.0", "5.0.0"));
    expect(result.reasoning).toContain("4.18.0");
    expect(result.reasoning).toContain("5.0.0");
  });

  it("handles version with build metadata", () => {
    const result = classifyBySemver(input("1.0.0", "1.1.0+build.123"));
    expect(result.category).toBe("minor-update");
  });
});
