import { describe, it, expect, vi, beforeEach } from "vitest";
import { classifyByLLM } from "../llm.js";
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
    apiKeyEnv: "OPENAI_API_KEY",
    ...overrides,
  };
}

describe("classifyByLLM", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env["OPENAI_API_KEY"];
    delete process.env["ANTHROPIC_API_KEY"];
  });

  it("returns low-confidence result when API key missing", async () => {
    const result = await classifyByLLM(makeInput(), makeConfig());
    expect(result.category).toBe("informational");
    expect(result.confidence).toBe("low");
    expect(result.reasoning).toContain("not configured");
  });

  it("rejects non-whitelisted env var names", async () => {
    process.env["DATABASE_URL"] = "postgres://secret";

    const result = await classifyByLLM(
      makeInput(),
      makeConfig({ apiKeyEnv: "DATABASE_URL" as "OPENAI_API_KEY" }),
    );
    expect(result.category).toBe("informational");
    expect(result.confidence).toBe("low");

    delete process.env["DATABASE_URL"];
  });

  it("calls OpenAI and parses valid response", async () => {
    process.env["OPENAI_API_KEY"] = "test-key";

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
    process.env["ANTHROPIC_API_KEY"] = "test-key";

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
      makeConfig({ provider: "anthropic", apiKeyEnv: "ANTHROPIC_API_KEY" }),
    );
    expect(result.category).toBe("deprecation");
    expect(result.confidence).toBe("medium");
  });

  it("calls Ollama without needing an API key", async () => {
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
      makeConfig({ provider: "ollama", apiKeyEnv: "OPENAI_API_KEY" }),
    );
    expect(result.category).toBe("patch");
    expect(result.confidence).toBe("medium");
  });

  it("falls back on API error", async () => {
    process.env["OPENAI_API_KEY"] = "test-key";

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
    process.env["OPENAI_API_KEY"] = "test-key";

    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("Network error"),
    );

    const result = await classifyByLLM(makeInput(), makeConfig());
    expect(result.category).toBe("informational");
    expect(result.confidence).toBe("low");
  });

  it("falls back on invalid LLM category", async () => {
    process.env["OPENAI_API_KEY"] = "test-key";

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

  it("redacts secrets in LLM reasoning", async () => {
    process.env["OPENAI_API_KEY"] = "test-key";

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                category: "breaking",
                reasoning: "Found key sk_live_abc123def456 in changelog",
              }),
            },
          },
        ],
      }),
    } as Response);

    const result = await classifyByLLM(makeInput(), makeConfig());
    expect(result.category).toBe("breaking");
    expect(result.reasoning).not.toContain("sk_live_abc123def456");
    expect(result.reasoning).toContain("[REDACTED]");
  });

  it("uses fetch with AbortController signal", async () => {
    process.env["OPENAI_API_KEY"] = "test-key";

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                category: "patch",
                reasoning: "Minor fix",
              }),
            },
          },
        ],
      }),
    } as Response);

    await classifyByLLM(makeInput(), makeConfig());

    const callArgs = fetchSpy.mock.calls[0]!;
    const init = callArgs[1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
