import semver from "semver";
import type { ClassificationInput, ClassificationResult } from "./types.js";

export function classifyBySemver(
  input: ClassificationInput,
): ClassificationResult {
  const prev = input.previousVersion;
  const next = input.newVersion;

  if (!prev || !next) {
    return {
      category: "informational",
      confidence: "low",
      reasoning: "No version info available",
      classifierUsed: "semver",
    };
  }

  if (!semver.valid(prev) || !semver.valid(next)) {
    return {
      category: "informational",
      confidence: "low",
      reasoning: `Invalid semver: ${prev} → ${next}`,
      classifierUsed: "semver",
    };
  }

  const diff = semver.diff(prev, next);

  switch (diff) {
    case "major":
    case "premajor":
      return {
        category: "major-update",
        confidence: "medium",
        reasoning: `Major version bump: ${prev} → ${next}. Potential breaking changes.`,
        classifierUsed: "semver",
      };
    case "minor":
    case "preminor":
      return {
        category: "minor-update",
        confidence: "high",
        reasoning: `Minor version bump: ${prev} → ${next}`,
        classifierUsed: "semver",
      };
    case "patch":
    case "prepatch":
    case "prerelease":
      return {
        category: "patch",
        confidence: "high",
        reasoning: `Patch version bump: ${prev} → ${next}`,
        classifierUsed: "semver",
      };
    default:
      return {
        category: "informational",
        confidence: "low",
        reasoning: "Could not determine semver diff",
        classifierUsed: "semver",
      };
  }
}
