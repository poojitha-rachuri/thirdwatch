export type {
  ImpactAssessment,
  AffectedLocation,
  RemediationSuggestion,
  ScoreComponents,
  SuppressionRule,
  AnalyzerConfig,
  LLMAnalyzerConfig,
} from "./types.js";

export {
  computeImpactScore,
  findTDMEntries,
  usageWeight,
  spreadWeight,
  criticalityPathWeight,
  scoreToPriority,
} from "./impact-scorer.js";

export { mapAffectedCode, buildHumanSummary } from "./code-mapper.js";

export {
  generateRemediation,
  lookupRegistryRemediation,
  generateLLMRemediation,
} from "./remediation.js";
export type { RegistryProvider, RegistryRemediationEntry } from "./remediation.js";

export { shouldSuppress } from "./suppression.js";

export { loadRemediationRegistries } from "./load-registries.js";
