import type { ChangeCategory } from "@thirdwatch/tdm";
import type {
  ClassificationConfig,
  ClassificationInput,
  ClassificationResult,
} from "./types.js";
import { classifyBySemver } from "./semver.js";
import { classifyByKeywords } from "./keywords.js";
import { classifyByOpenApiDiff } from "./openapi.js";
import { classifyByLLM } from "./llm.js";

const SEVERITY_ORDER: ChangeCategory[] = [
  "breaking",
  "security",
  "deprecation",
  "major-update",
  "minor-update",
  "patch",
  "informational",
];

function severityRank(category: ChangeCategory): number {
  const idx = SEVERITY_ORDER.indexOf(category);
  return idx === -1 ? SEVERITY_ORDER.length : idx;
}

export function selectHighestSeverity(
  results: ClassificationResult[],
): ClassificationResult {
  if (results.length === 0) {
    return {
      category: "informational",
      confidence: "low",
      reasoning: "No classifiers produced a result",
      classifierUsed: "combined",
    };
  }

  let best = results[0]!;
  for (let i = 1; i < results.length; i++) {
    const current = results[i]!;
    if (severityRank(current.category) < severityRank(best.category)) {
      best = current;
    }
  }

  if (results.length > 1) {
    return {
      ...best,
      classifierUsed: "combined",
    };
  }

  return best;
}

export async function classifyChange(
  input: ClassificationInput,
  config: ClassificationConfig = {},
): Promise<ClassificationResult> {
  const results: ClassificationResult[] = [];

  // Tier 1: always run semver
  results.push(classifyBySemver(input));

  // Tier 2: always run keywords if changelog text available
  if (input.changelogText) {
    results.push(classifyByKeywords(input.changelogText));
  }

  // Tier 3: OpenAPI diff if available
  if (input.openApiDiff) {
    results.push(classifyByOpenApiDiff(input.openApiDiff));
  }

  // Tier 4: LLM (optional, configured via ClassificationConfig)
  if (config.llm?.enabled && input.changelogText) {
    const semverResult = results[0]!;
    const shouldTrigger =
      !config.llm.triggerOn ||
      config.llm.triggerOn.length === 0 ||
      config.llm.triggerOn.includes(semverResult.category);

    if (shouldTrigger) {
      results.push(await classifyByLLM(input, config.llm));
    }
  }

  return selectHighestSeverity(results);
}
