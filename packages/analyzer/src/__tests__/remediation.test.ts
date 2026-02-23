import { describe, it, expect } from "vitest";
import type { ChangeEvent, WatchedDependency } from "@thirdwatch/watcher";
import {
  lookupRegistryRemediation,
  generateRemediation,
} from "../remediation.js";
import type { RegistryProvider } from "../remediation.js";
import type { AnalyzerConfig } from "../types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDep(overrides: Partial<WatchedDependency> = {}): WatchedDependency {
  return {
    tdmId: "pkg:pypi/stripe@7.0.0",
    kind: "package",
    identifier: "stripe",
    currentVersion: "7.0.0",
    ...overrides,
  };
}

function makeChange(
  overrides: Omit<Partial<ChangeEvent>, "dependency"> & { dependency?: Partial<WatchedDependency> } = {},
): ChangeEvent {
  const { dependency: depOverrides, ...rest } = overrides;
  return {
    id: "evt-1",
    dependency: makeDep(depOverrides),
    detectedAt: new Date(),
    changeType: "breaking",
    title: "Breaking change",
    rawData: {},
    ...rest,
  };
}

const stripeRegistry: RegistryProvider = {
  provider: "stripe",
  remediations: [
    {
      match: {
        change_type: "breaking",
        affected_parameter: "source",
        affected_endpoint: "/v1/charges",
      },
      suggestion: {
        type: "rename-parameter",
        description:
          "The `source` parameter was removed. Use `payment_method` instead.",
        suggested_diff: [
          "- stripe.Charge.create(amount=amount, currency=\"usd\", source=token)",
          "+ stripe.PaymentIntent.create(amount=amount, currency=\"usd\", payment_method=token)",
        ].join("\n"),
        migration_guide_url: "https://stripe.com/docs/upgrades#2023-10-16",
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// lookupRegistryRemediation
// ---------------------------------------------------------------------------

describe("lookupRegistryRemediation", () => {
  it("returns remediation for matching stripe breaking change", () => {
    const change = makeChange({ changeType: "breaking" });
    const result = lookupRegistryRemediation(change, [stripeRegistry]);

    expect(result).toBeDefined();
    expect(result!.type).toBe("rename-parameter");
    expect(result!.description).toContain("payment_method");
    expect(result!.isAIGenerated).toBe(false);
    expect(result!.migrationGuideUrl).toBe(
      "https://stripe.com/docs/upgrades#2023-10-16",
    );
  });

  it("returns undefined for non-matching provider", () => {
    const change = makeChange({
      dependency: { identifier: "openai" },
    });
    const result = lookupRegistryRemediation(change, [stripeRegistry]);
    expect(result).toBeUndefined();
  });

  it("returns undefined for non-matching change type", () => {
    const change = makeChange({ changeType: "patch" });
    const result = lookupRegistryRemediation(change, [stripeRegistry]);
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// generateRemediation
// ---------------------------------------------------------------------------

describe("generateRemediation", () => {
  const config: AnalyzerConfig = {};

  it("returns registry remediation when available", async () => {
    const change = makeChange({ changeType: "breaking" });
    const result = await generateRemediation(change, [], config, [stripeRegistry]);
    expect(result).toBeDefined();
    expect(result!.type).toBe("rename-parameter");
    expect(result!.isAIGenerated).toBe(false);
  });

  it("falls back to migration guide URL when no registry match", async () => {
    const change = makeChange({
      changeType: "breaking",
      url: "https://example.com/migration",
      dependency: { identifier: "openai" },
    });
    const result = await generateRemediation(change, [], config, [stripeRegistry]);
    expect(result).toBeDefined();
    expect(result!.type).toBe("manual");
    expect(result!.migrationGuideUrl).toBe("https://example.com/migration");
    expect(result!.isAIGenerated).toBe(false);
  });

  it("returns undefined when no remediation is available", async () => {
    const change = makeChange({
      changeType: "patch",
      dependency: { identifier: "openai" },
    });
    const result = await generateRemediation(change, [], config);
    expect(result).toBeUndefined();
  });

  it("does NOT call LLM when enableCodeSuggestions is false", async () => {
    const configNoLLM: AnalyzerConfig = {
      llm: { enableCodeSuggestions: false },
    };
    const change = makeChange({
      changeType: "breaking",
      dependency: { identifier: "openai" },
    });
    const result = await generateRemediation(change, [], configNoLLM);
    // No registry, no LLM, no URL → undefined
    expect(result).toBeUndefined();
  });

  it("calls LLM when enableCodeSuggestions is true and change is breaking", async () => {
    const configWithLLM: AnalyzerConfig = {
      llm: { enableCodeSuggestions: true },
    };
    const change = makeChange({
      changeType: "breaking",
      dependency: { identifier: "openai" },
    });
    const result = await generateRemediation(change, [], configWithLLM);
    expect(result).toBeDefined();
    expect(result!.isAIGenerated).toBe(true);
  });

  it("does NOT call LLM for non-breaking changes even when enabled", async () => {
    const configWithLLM: AnalyzerConfig = {
      llm: { enableCodeSuggestions: true },
    };
    const change = makeChange({
      changeType: "deprecation",
      dependency: { identifier: "openai" },
    });
    const result = await generateRemediation(change, [], configWithLLM);
    expect(result).toBeUndefined();
  });
});
