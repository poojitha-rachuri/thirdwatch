import { describe, it, expect, vi, beforeEach } from "vitest";
import { classifyByLLM, buildClassificationPrompt } from "../llm.js";
import type { ClassificationInput, LLMConfig } from "../types.js";

function makeInput(overrides?: Partial<ClassificationInput>): ClassificationInput {
  return {
    dependency: {
      tdmId: "tdm-1",
      kind: "package",
      identifier: "stripe",
    },
    previousVersion: "7.0.0",
    newVersion: "8.0.0",
    changelogText: "BREAKING CHANGE: removed source param",
    ...overrides,
  };
}

function makeConfig(overrides?: Partial<LLMConfig>): LLMConfig {
  return {
    enabled: true,
    provider: "openai",
    model: "gpt-4o-mini",
    apiKeyEnv: "TEST_LLM_KEY",
    ...overrides,
  };
}

describe("buildClassificationPrompt", () => {
  it("includes dependency info", () => {
    const prompt = buildClassificationPrompt(makeInput());
    expect(prompt).toContain("stripe");
    expect(prompt).toContain("7.0.0");
    expect(prompt).toContain("8.0.0");
  });

  it("includes changelog text", () => {
    const prompt = buildClassificationPrompt(makeInput());
    expect(prompt).toContain("BREAKING CHANGE: removed source param");
  });

  it("handles missing versions", () => {
    const prompt = buildClassificationPrompt(
      makeInput({ previousVersion: undefined, newVersion: undefined }),
    );
    expect(prompt).toContain("unknown");
  });

  it("handles missing changelog", () => {
    const prompt = buildClassificationPrompt(
      makeInput({ changelogText: undefined }),
    );
    expect(prompt).not.toContain("undefined");
  });
});

describe("classifyByLLM", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env["TEST_LLM_KEY"];
  });

  it("returns low-confidence result when API key missing", async () => {
    const result = await classifyByLLM(makeInput(), makeConfig());
    expect(result.category).toBe("informational");
    expect(result.confidence).toBe("low");
    expect(result.reasoning).toContain("API key not found");
  });

  it("calls OpenAI and parses valid response", async () => {
    process.env["TEST_LLM_KEY"] = "test-key";

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                category: "breaking",
                reasoning: "Removed source parameter",
              }),
            },
          },
        ],
      }),
    } as Response);

    const result = await classifyByLLM(makeInput(), makeConfig());
    expect(result.category).toBe("breaking");
    expect(result.confidence).toBe("medium");
    expect(result.classifierUsed).toBe("llm");
    expect(result.reasoning).toBe("Removed source parameter");
  });

  it("calls Anthropic and parses valid response", async () => {
    process.env["TEST_LLM_KEY"] = "test-key";

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        content: [
          {
            text: JSON.stringify({
              category: "deprecation",
              reasoning: "Model is being deprecated",
            }),
          },
        ],
      }),
    } as Response);

    const result = await classifyByLLM(
      makeInput(),
      makeConfig({ provider: "anthropic" }),
    );
    expect(result.category).toBe("deprecation");
    expect(result.confidence).toBe("medium");
  });

  it("calls Ollama and parses valid response", async () => {
    process.env["TEST_LLM_KEY"] = "test-key";

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        response: JSON.stringify({
          category: "patch",
          reasoning: "Bug fix only",
        }),
      }),
    } as Response);

    const result = await classifyByLLM(
      makeInput(),
      makeConfig({ provider: "ollama" }),
    );
    expect(result.category).toBe("patch");
    expect(result.confidence).toBe("medium");
  });

  it("falls back on API error", async () => {
    process.env["TEST_LLM_KEY"] = "test-key";

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    const result = await classifyByLLM(makeInput(), makeConfig());
    expect(result.category).toBe("informational");
    expect(result.confidence).toBe("low");
    expect(result.reasoning).toContain("failed");
  });

  it("falls back on network error", async () => {
    process.env["TEST_LLM_KEY"] = "test-key";

    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("Network error"),
    );

    const result = await classifyByLLM(makeInput(), makeConfig());
    expect(result.category).toBe("informational");
    expect(result.confidence).toBe("low");
  });

  it("falls back on invalid LLM category", async () => {
    process.env["TEST_LLM_KEY"] = "test-key";

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                category: "not-a-real-category",
                reasoning: "Bad data",
              }),
            },
          },
        ],
      }),
    } as Response);

    const result = await classifyByLLM(makeInput(), makeConfig());
    expect(result.category).toBe("informational");
    expect(result.confidence).toBe("low");
    expect(result.reasoning).toContain("invalid category");
  });
});
