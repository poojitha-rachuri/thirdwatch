import type { Priority } from "@thirdwatch/tdm";
import type { ImpactAssessment, SuppressionRule } from "./types.js";

// ---------------------------------------------------------------------------
// Priority comparison — lower P-number = higher priority
// ---------------------------------------------------------------------------

const PRIORITY_RANK: Record<Priority, number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
  P4: 4,
};

/**
 * Returns true if `a` is lower priority (higher P-number) than `b`.
 * e.g. isLowerPriority("P3", "P2") → true
 */
function isLowerPriority(a: Priority, b: Priority): boolean {
  return PRIORITY_RANK[a] > PRIORITY_RANK[b];
}

// ---------------------------------------------------------------------------
// Glob-like matching (simple: supports * wildcard)
// ---------------------------------------------------------------------------

function simpleGlobMatch(pattern: string, value: string): boolean {
  const regex = new RegExp(
    "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
    "i",
  );
  return regex.test(value);
}

// ---------------------------------------------------------------------------
// Rule matching
// ---------------------------------------------------------------------------

function matchesRule(
  assessment: ImpactAssessment,
  rule: SuppressionRule,
  changeCategory?: string,
  dependencyIdentifier?: string,
): boolean {
  // Dependency glob match
  if (rule.dependency !== undefined && dependencyIdentifier !== undefined) {
    if (!simpleGlobMatch(rule.dependency, dependencyIdentifier)) return false;
  } else if (rule.dependency !== undefined) {
    return false;
  }

  // Change category match
  if (rule.change_category !== undefined) {
    if (changeCategory !== rule.change_category) return false;
  }

  // Min priority: suppress if assessment priority is lower than threshold
  if (rule.min_priority !== undefined) {
    if (!isLowerPriority(assessment.priority, rule.min_priority)) return false;
  }

  // File path glob: suppress only if ALL affected files match the pattern
  if (rule.file_path !== undefined) {
    if (assessment.affectedLocations.length === 0) return false;
    const allMatch = assessment.affectedLocations.every((loc) =>
      simpleGlobMatch(rule.file_path!, loc.file),
    );
    if (!allMatch) return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether an assessment should be suppressed based on configured rules.
 */
export function shouldSuppress(
  assessment: ImpactAssessment,
  rules: SuppressionRule[],
  changeCategory?: string,
  dependencyIdentifier?: string,
): { suppressed: boolean; rule?: SuppressionRule } {
  for (const rule of rules) {
    if (matchesRule(assessment, rule, changeCategory, dependencyIdentifier)) {
      return { suppressed: true, rule };
    }
  }
  return { suppressed: false };
}
