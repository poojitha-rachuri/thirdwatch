import { describe, it, expect, vi, beforeEach } from "vitest";
import { classifyChange, selectHighestSeverity } from "../pipeline.js";
import type {
  ClassificationInput,
  ClassificationResult,
  ClassificationConfig,
} from "../types.js";

function makeInput(
  overrides?: Partial<ClassificationInput>,
): ClassificationInput {
  return {
    dependency: {
      tdmId: "tdm-1",
      kind: "package",
      identifier: "test-pkg",
    },
    ...overrides,
  };
}

describe("selectHighestSeverity", () => {
  it("returns informational for empty results", () => {
    const result = selectHighestSeverity([]);
    expect(result.category).toBe("informational");
    expect(result.classifierUsed).toBe("combined");
  });

  it("returns the only result if single", () => {
    const single: ClassificationResult = {
      category: "patch",
      confidence: "high",
      reasoning: "Patch bump",
      classifierUsed: "semver",
    };
    const result = selectHighestSeverity([single]);
    expect(result.category).toBe("patch");
    expect(result.classifierUsed).toBe("semver");
  });

  it("picks breaking over minor-update", () => {
    const results: ClassificationResult[] = [
      { category: "minor-update", confidence: "high", reasoning: "minor", classifierUsed: "semver" },
      { category: "breaking", confidence: "medium", reasoning: "breaking keywords", classifierUsed: "keywords" },
    ];
    const result = selectHighestSeverity(results);
    expect(result.category).toBe("breaking");
    expect(result.classifierUsed).toBe("combined");
  });

  it("picks security over deprecation", () => {
    const results: ClassificationResult[] = [
      { category: "deprecation", confidence: "medium", reasoning: "deprecated", classifierUsed: "keywords" },
      { category: "security", confidence: "medium", reasoning: "CVE found", classifierUsed: "keywords" },
    ];
    const result = selectHighestSeverity(results);
    expect(result.category).toBe("security");
  });

  it("picks breaking over security", () => {
    const results: ClassificationResult[] = [
      { category: "security", confidence: "medium", reasoning: "CVE", classifierUsed: "keywords" },
      { category: "breaking", confidence: "high", reasoning: "removed paths", classifierUsed: "openapi-diff" },
    ];
    const result = selectHighestSeverity(results);
    expect(result.category).toBe("breaking");
  });
});

describe("classifyChange", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns breaking for 7.0.0 → 8.0.0 with BREAKING CHANGE in changelog", async () => {
    const result = await classifyChange(
      makeInput({
        previousVersion: "7.0.0",
        newVersion: "8.0.0",
        changelogText: "BREAKING CHANGE: removed legacy source parameter",
      }),
    );
    expect(result.category).toBe("breaking");
    expect(result.confidence).toBe("medium");
  });

  it("returns patch for 7.0.1 → 7.0.2 bug fix", async () => {
    const result = await classifyChange(
      makeInput({
        previousVersion: "7.0.1",
        newVersion: "7.0.2",
        changelogText: "Fixed edge case in pagination",
      }),
    );
    expect(result.category).toBe("patch");
  });

  it("returns security for changelog with CVE", async () => {
    const result = await classifyChange(
      makeInput({
        previousVersion: "1.0.0",
        newVersion: "1.0.1",
        changelogText: "Fixed CVE-2025-1234 in request parser",
      }),
    );
    expect(result.category).toBe("security");
  });

  it("returns breaking when OpenAPI diff has removed paths", async () => {
    const result = await classifyChange(
      makeInput({
        previousVersion: "2.0.0",
        newVersion: "3.0.0",
        openApiDiff: {
          removedPaths: ["/v1/charges"],
          addedPaths: [],
          changedSchemas: [],
          changedAuth: false,
          removedParameters: [],
        },
      }),
    );
    expect(result.category).toBe("breaking");
  });

  it("does not call LLM when disabled", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await classifyChange(
      makeInput({
        previousVersion: "1.0.0",
        newVersion: "2.0.0",
        changelogText: "Some changes happened",
      }),
      { llm: { enabled: false, provider: "openai", model: "gpt-4o", apiKeyEnv: "KEY" } },
    );

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not call LLM when no changelog text", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await classifyChange(
      makeInput({
        previousVersion: "1.0.0",
        newVersion: "2.0.0",
      }),
      { llm: { enabled: true, provider: "openai", model: "gpt-4o", apiKeyEnv: "KEY" } },
    );

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("respects triggerOn filter for LLM", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const config: ClassificationConfig = {
      llm: {
        enabled: true,
        provider: "openai",
        model: "gpt-4o",
        apiKeyEnv: "KEY",
        triggerOn: ["major-update"],
      },
    };

    // minor bump should NOT trigger LLM
    await classifyChange(
      makeInput({
        previousVersion: "1.0.0",
        newVersion: "1.1.0",
        changelogText: "Added new features",
      }),
      config,
    );

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("runs semver only when no changelog or openapi diff", async () => {
    const result = await classifyChange(
      makeInput({
        previousVersion: "1.0.0",
        newVersion: "1.1.0",
      }),
    );
    expect(result.category).toBe("minor-update");
    expect(result.classifierUsed).toBe("semver");
  });

  it("combines semver and keywords results", async () => {
    const result = await classifyChange(
      makeInput({
        previousVersion: "1.0.0",
        newVersion: "2.0.0",
        changelogText: "Added new streaming API. Performance improvements.",
      }),
    );
    // semver says major-update, keywords says informational → major-update wins
    expect(result.category).toBe("major-update");
    expect(result.classifierUsed).toBe("combined");
  });

  it("LLM failure falls back to keyword result silently", async () => {
    process.env["TEST_KEY"] = "test";

    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("timeout"),
    );

    const result = await classifyChange(
      makeInput({
        previousVersion: "1.0.0",
        newVersion: "2.0.0",
        changelogText: "BREAKING CHANGE: removed endpoint",
      }),
      {
        llm: {
          enabled: true,
          provider: "openai",
          model: "gpt-4o",
          apiKeyEnv: "TEST_KEY",
        },
      },
    );

    // Breaking from keywords should still be the result
    expect(result.category).toBe("breaking");

    delete process.env["TEST_KEY"];
  });
});
