import type { ChangeCategory } from "@thirdwatch/tdm";
import type { WatchedDependency } from "../types.js";

export interface ClassificationInput {
  dependency: WatchedDependency;
  previousVersion?: string | undefined;
  newVersion?: string | undefined;
  changelogText?: string | undefined;
  openApiDiff?: OpenApiDiff | undefined;
}

export interface ClassificationResult {
  category: ChangeCategory;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  classifierUsed:
    | "semver"
    | "keywords"
    | "openapi-diff"
    | "llm"
    | "combined";
}

export interface OpenApiDiff {
  removedPaths: string[];
  addedPaths: string[];
  changedSchemas: SchemaDiff[];
  changedAuth: boolean;
  removedParameters: ParamDiff[];
}

export interface SchemaDiff {
  path: string;
  removedRequired: boolean;
  addedOptional: boolean;
}

export interface ParamDiff {
  path: string;
  name: string;
  wasRequired: boolean;
}

export interface LLMConfig {
  enabled: boolean;
  provider: "anthropic" | "openai" | "ollama";
  model: string;
  apiKeyEnv: string;
  triggerOn?: ChangeCategory[] | undefined;
}

export interface ClassificationConfig {
  llm?: LLMConfig | undefined;
}
