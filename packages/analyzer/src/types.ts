import type { ChangeCategory, Priority } from "@thirdwatch/tdm";

// ---------------------------------------------------------------------------
// Impact Assessment — the primary output of the analyzer
// ---------------------------------------------------------------------------

export interface ImpactAssessment {
  changeEventId: string;
  priority: Priority;
  /** Raw computed score (for debugging) */
  score: number;
  affectedLocations: AffectedLocation[];
  /** One-sentence human-readable summary */
  humanSummary: string;
  remediationSuggestion?: RemediationSuggestion | undefined;
  /** If suppressed, which rule matched */
  suppressionRule?: string | undefined;
}

// ---------------------------------------------------------------------------
// Affected Location — precise file:line from the TDM
// ---------------------------------------------------------------------------

export interface AffectedLocation {
  /** Relative path from the scan root */
  file: string;
  /** 1-indexed line number */
  line: number;
  /** Code snippet */
  context: string;
  /** e.g. "method_call", "import", "instantiation" */
  usageType: string;
}

// ---------------------------------------------------------------------------
// Remediation Suggestion — migration guidance for breaking changes
// ---------------------------------------------------------------------------

export interface RemediationSuggestion {
  type:
    | "rename-parameter"
    | "update-endpoint"
    | "update-auth"
    | "update-import"
    | "manual";
  description: string;
  /** Unified diff format, flagged as AI-generated */
  suggestedDiff?: string | undefined;
  migrationGuideUrl?: string | undefined;
  isAIGenerated: boolean;
}

// ---------------------------------------------------------------------------
// Score components — for debugging / logging
// ---------------------------------------------------------------------------

export interface ScoreComponents {
  severity: number;
  usage: number;
  spread: number;
  path: number;
}

// ---------------------------------------------------------------------------
// Suppression rule — from .thirdwatch.yml
// ---------------------------------------------------------------------------

export interface SuppressionRule {
  reason?: string | undefined;
  /** Glob pattern, e.g. "stripe*" */
  dependency?: string | undefined;
  change_category?: ChangeCategory | undefined;
  /** Suppress if priority is lower (higher P-number) than this */
  min_priority?: Priority | undefined;
  /** Glob — suppress if ALL affected files match */
  file_path?: string | undefined;
}

// ---------------------------------------------------------------------------
// Analyzer configuration — from .thirdwatch.yml
// ---------------------------------------------------------------------------

export interface AnalyzerConfig {
  /** Paths to treat as high criticality */
  criticalPaths?: string[] | undefined;
  /** Suppression rules */
  suppressionRules?: SuppressionRule[] | undefined;
  /** LLM code suggestions (opt-in) */
  llm?: LLMAnalyzerConfig | undefined;
}

export interface LLMAnalyzerConfig {
  enableCodeSuggestions: boolean;
}
