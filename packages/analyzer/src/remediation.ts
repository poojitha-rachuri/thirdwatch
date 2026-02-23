import type { ChangeEvent } from "@thirdwatch/watcher";
import type { AffectedLocation, AnalyzerConfig, RemediationSuggestion } from "./types.js";

// ---------------------------------------------------------------------------
// Registry-based remediation — deterministic, from YAML registry
// ---------------------------------------------------------------------------

export interface RegistryRemediationMatch {
  change_type: string;
  version_range?: string | undefined;
  affected_parameter?: string | undefined;
  affected_endpoint?: string | undefined;
}

export interface RegistryRemediationEntry {
  match: RegistryRemediationMatch;
  suggestion: {
    type: RemediationSuggestion["type"];
    description: string;
    suggested_diff?: string | undefined;
    migration_guide_url?: string | undefined;
  };
}

export interface RegistryProvider {
  provider: string;
  remediations: RegistryRemediationEntry[];
}

/**
 * Look up a deterministic remediation from the remediation registry.
 */
export function lookupRegistryRemediation(
  change: ChangeEvent,
  registries: RegistryProvider[],
): RemediationSuggestion | undefined {
  const provider = change.dependency.identifier.toLowerCase();

  for (const registry of registries) {
    if (registry.provider.toLowerCase() !== provider) continue;

    for (const entry of registry.remediations) {
      if (entry.match.change_type !== change.changeType) continue;
      // Match found — return structured suggestion
      return {
        type: entry.suggestion.type,
        description: entry.suggestion.description,
        suggestedDiff: entry.suggestion.suggested_diff,
        migrationGuideUrl: entry.suggestion.migration_guide_url,
        isAIGenerated: false,
      };
    }
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// LLM-based remediation — opt-in, for breaking changes only
// ---------------------------------------------------------------------------

export async function generateLLMRemediation(
  _change: ChangeEvent,
  _locations: AffectedLocation[],
  _config: AnalyzerConfig["llm"],
): Promise<RemediationSuggestion> {
  // Placeholder: LLM integration will be implemented in Phase 9.4
  return {
    type: "manual",
    description: "LLM-based remediation suggestions are not yet implemented.",
    isAIGenerated: true,
  };
}

// ---------------------------------------------------------------------------
// Main remediation function
// ---------------------------------------------------------------------------

/**
 * For known breaking change patterns, generate structured remediation guidance.
 * All AI-generated code suggestions are flagged isAIGenerated: true.
 */
export async function generateRemediation(
  change: ChangeEvent,
  locations: AffectedLocation[],
  config: AnalyzerConfig,
  registries: RegistryProvider[] = [],
): Promise<RemediationSuggestion | undefined> {
  // First try: registry-based remediation (deterministic)
  const registryRemediation = lookupRegistryRemediation(change, registries);
  if (registryRemediation) return registryRemediation;

  // Second try: LLM-generated suggestion (opt-in)
  if (config.llm?.enableCodeSuggestions && change.changeType === "breaking") {
    return generateLLMRemediation(change, locations, config.llm);
  }

  // Fallback: link to migration guide if available
  if (change.url) {
    return {
      type: "manual",
      description: `Review the ${change.dependency.identifier} migration guide.`,
      migrationGuideUrl: change.url,
      isAIGenerated: false,
    };
  }

  return undefined;
}
