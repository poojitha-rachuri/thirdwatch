import type { ImpactAssessment } from "@thirdwatch/analyzer";
import type { RoutingRule } from "./types.js";

// ---------------------------------------------------------------------------
// Route resolution — given an assessment, find matching routing rules
// ---------------------------------------------------------------------------

export function resolveRoutes(
  assessment: ImpactAssessment,
  rules: RoutingRule[],
): RoutingRule[] {
  return rules.filter((rule) => matchesRule(assessment, rule));
}

function matchesRule(
  assessment: ImpactAssessment,
  rule: RoutingRule,
): boolean {
  if (rule.priority && !rule.priority.includes(assessment.priority)) {
    return false;
  }

  if (
    rule.changeCategory &&
    !rule.changeCategory.includes(assessment.changeCategory)
  ) {
    return false;
  }

  return true;
}
