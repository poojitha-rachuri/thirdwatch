import type { ChangeCategory } from "@thirdwatch/tdm";
import type {
  ClassificationInput,
  ClassificationResult,
  LLMConfig,
} from "./types.js";

export function buildClassificationPrompt(
  input: ClassificationInput,
): string {
  return `You are analyzing a software changelog entry to classify the type of change.

Dependency: ${input.dependency.identifier}
Previous version: ${input.previousVersion ?? "unknown"}
New version: ${input.newVersion ?? "unknown"}

Changelog text:
---
${input.changelogText ?? ""}
---

Classify this change as one of: breaking, deprecation, major-update, minor-update, patch, security, informational.

A change is "breaking" only if it removes or renames existing functionality, changes required parameters, or makes code that worked before stop working. Version bumps alone do not make a change breaking.

Respond with JSON: { "category": "...", "reasoning": "one sentence explanation" }`;
}

const VALID_CATEGORIES = new Set<ChangeCategory>([
  "breaking",
  "deprecation",
  "major-update",
  "minor-update",
  "patch",
  "security",
  "informational",
]);

function parseCategory(value: unknown): ChangeCategory | undefined {
  if (typeof value === "string" && VALID_CATEGORIES.has(value as ChangeCategory)) {
    return value as ChangeCategory;
  }
  return undefined;
}

export async function classifyByLLM(
  input: ClassificationInput,
  config: LLMConfig,
): Promise<ClassificationResult> {
  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) {
    return {
      category: "informational",
      confidence: "low",
      reasoning: `LLM API key not found in env var ${config.apiKeyEnv}`,
      classifierUsed: "llm",
    };
  }

  const prompt = buildClassificationPrompt(input);

  try {
    const response = await callLLMProvider(config, apiKey, prompt);
    const category = parseCategory(response.category);

    if (!category) {
      return {
        category: "informational",
        confidence: "low",
        reasoning: `LLM returned invalid category: ${String(response.category)}`,
        classifierUsed: "llm",
      };
    }

    return {
      category,
      confidence: "medium",
      reasoning: typeof response.reasoning === "string"
        ? response.reasoning
        : "LLM classification",
      classifierUsed: "llm",
    };
  } catch {
    return {
      category: "informational",
      confidence: "low",
      reasoning: "LLM classification failed — falling back",
      classifierUsed: "llm",
    };
  }
}

interface LLMResponse {
  category?: unknown;
  reasoning?: unknown;
}

async function callLLMProvider(
  config: LLMConfig,
  apiKey: string,
  prompt: string,
): Promise<LLMResponse> {
  switch (config.provider) {
    case "anthropic":
      return callAnthropic(config.model, apiKey, prompt);
    case "openai":
      return callOpenAI(config.model, apiKey, prompt);
    case "ollama":
      return callOllama(config.model, prompt);
  }
}

async function callAnthropic(
  model: string,
  apiKey: string,
  prompt: string,
): Promise<LLMResponse> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API returned ${response.status}`);
  }

  const data = (await response.json()) as {
    content: Array<{ text: string }>;
  };
  const text = data.content[0]?.text ?? "";
  return JSON.parse(text) as LLMResponse;
}

async function callOpenAI(
  model: string,
  apiKey: string,
  prompt: string,
): Promise<LLMResponse> {
  const response = await fetch(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`OpenAI API returned ${response.status}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const text = data.choices[0]?.message.content ?? "";
  return JSON.parse(text) as LLMResponse;
}

async function callOllama(
  model: string,
  prompt: string,
): Promise<LLMResponse> {
  const response = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      format: "json",
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API returned ${response.status}`);
  }

  const data = (await response.json()) as { response: string };
  return JSON.parse(data.response) as LLMResponse;
}
