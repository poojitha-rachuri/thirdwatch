import type { ClassificationResult, OpenApiDiff } from "./types.js";

export function classifyByOpenApiDiff(
  diff: OpenApiDiff,
): ClassificationResult {
  const removedSchemas = diff.changedSchemas.filter((s) => s.removedRequired);
  const removedParams = diff.removedParameters.filter((p) => p.wasRequired);
  const hasAddedOptional = diff.changedSchemas.some((s) => s.addedOptional);

  const isBreaking =
    diff.removedPaths.length > 0 ||
    diff.changedAuth ||
    removedSchemas.length > 0 ||
    removedParams.length > 0;

  if (isBreaking) {
    const details: string[] = [];
    if (diff.removedPaths.length > 0) {
      details.push(`removed paths [${diff.removedPaths.join(", ")}]`);
    }
    if (diff.changedAuth) {
      details.push("authentication changed");
    }
    if (removedSchemas.length > 0) {
      details.push(`required fields removed in [${removedSchemas.map((s) => s.path).join(", ")}]`);
    }
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

  if (diff.addedPaths.length > 0 || hasAddedOptional) {
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
