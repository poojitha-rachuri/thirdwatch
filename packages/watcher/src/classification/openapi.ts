import type { ClassificationResult, OpenApiDiff } from "./types.js";

export function classifyByOpenApiDiff(
  diff: OpenApiDiff,
): ClassificationResult {
  if (
    diff.removedPaths.length > 0 ||
    diff.changedAuth ||
    diff.changedSchemas.some((s) => s.removedRequired) ||
    diff.removedParameters.some((p) => p.wasRequired)
  ) {
    const details: string[] = [];
    if (diff.removedPaths.length > 0) {
      details.push(`removed paths [${diff.removedPaths.join(", ")}]`);
    }
    if (diff.changedAuth) {
      details.push("authentication changed");
    }
    const removedSchemas = diff.changedSchemas.filter(
      (s) => s.removedRequired,
    );
    if (removedSchemas.length > 0) {
      details.push(`required fields removed in [${removedSchemas.map((s) => s.path).join(", ")}]`);
    }
    const removedParams = diff.removedParameters.filter((p) => p.wasRequired);
    if (removedParams.length > 0) {
      details.push(`required parameters removed [${removedParams.map((p) => `${p.path}:${p.name}`).join(", ")}]`);
    }

    return {
      category: "breaking",
      confidence: "high",
      reasoning: `Breaking: ${details.join("; ")}`,
      classifierUsed: "openapi-diff",
    };
  }

  if (
    diff.addedPaths.length > 0 ||
    diff.changedSchemas.some((s) => s.addedOptional)
  ) {
    return {
      category: "minor-update",
      confidence: "high",
      reasoning: "Non-breaking additions to the API",
      classifierUsed: "openapi-diff",
    };
  }

  return {
    category: "patch",
    confidence: "medium",
    reasoning: "Spec changed but no breaking diffs found",
    classifierUsed: "openapi-diff",
  };
}
