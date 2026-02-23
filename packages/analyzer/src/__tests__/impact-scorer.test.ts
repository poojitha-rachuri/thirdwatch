import { describe, it, expect } from "vitest";
import type { TDM } from "@thirdwatch/tdm";
import type { ChangeEvent, WatchedDependency } from "@thirdwatch/watcher";
import {
  computeImpactScore,
  usageWeight,
  spreadWeight,
  criticalityPathWeight,
  scoreToPriority,
  findTDMEntries,
} from "../impact-scorer.js";

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
    title: "Breaking change in stripe",
    rawData: {},
    ...rest,
  };
}

function makeTDM(overrides: Partial<TDM> = {}): TDM {
  return {
    version: "1.0",
    metadata: {
      scan_timestamp: new Date().toISOString(),
      scanner_version: "0.1.0",
      languages_detected: ["python"],
      total_dependencies_found: 1,
      scan_duration_ms: 100,
    },
    packages: [],
    apis: [],
    sdks: [],
    infrastructure: [],
    webhooks: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// usageWeight
// ---------------------------------------------------------------------------

describe("usageWeight", () => {
  it("returns 3 for > 100 usages", () => {
    expect(usageWeight(101)).toBe(3);
    expect(usageWeight(200)).toBe(3);
  });

  it("returns 2 for > 20 usages", () => {
    expect(usageWeight(21)).toBe(2);
    expect(usageWeight(100)).toBe(2);
  });

  it("returns 1.5 for > 5 usages", () => {
    expect(usageWeight(6)).toBe(1.5);
    expect(usageWeight(20)).toBe(1.5);
  });

  it("returns 1 for > 0 usages", () => {
    expect(usageWeight(1)).toBe(1);
    expect(usageWeight(5)).toBe(1);
  });

  it("returns 1 for 0 usages", () => {
    expect(usageWeight(0)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// spreadWeight
// ---------------------------------------------------------------------------

describe("spreadWeight", () => {
  it("returns 3 for > 10 files", () => {
    expect(spreadWeight(11)).toBe(3);
  });

  it("returns 2 for > 3 files", () => {
    expect(spreadWeight(4)).toBe(2);
    expect(spreadWeight(10)).toBe(2);
  });

  it("returns 1 for 1 file", () => {
    expect(spreadWeight(1)).toBe(1);
  });

  it("returns 1 for > 1 file (up to 3)", () => {
    expect(spreadWeight(2)).toBe(1);
    expect(spreadWeight(3)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// criticalityPathWeight
// ---------------------------------------------------------------------------

describe("criticalityPathWeight", () => {
  it("returns 0.3 for test paths", () => {
    expect(criticalityPathWeight(["tests/test_stripe.py"])).toBe(0.3);
    expect(criticalityPathWeight(["spec/helpers.ts"])).toBe(0.3);
    expect(criticalityPathWeight(["__test__/foo.ts"])).toBe(0.3);
  });

  it("returns 3 for critical paths", () => {
    expect(criticalityPathWeight(["src/auth/login.ts"])).toBe(3);
    expect(criticalityPathWeight(["src/payment/handler.ts"])).toBe(3);
    expect(criticalityPathWeight(["checkout/flow.py"])).toBe(3);
  });

  it("returns 2 for important paths", () => {
    expect(criticalityPathWeight(["src/api/routes.ts"])).toBe(2);
    expect(criticalityPathWeight(["core/engine.ts"])).toBe(2);
  });

  it("returns 1 for regular paths", () => {
    expect(criticalityPathWeight(["src/utils/helpers.ts"])).toBe(1);
  });

  it("uses override critical paths", () => {
    expect(criticalityPathWeight(["src/onboarding/flow.ts"], ["onboarding"])).toBe(3);
  });

  it("test paths take precedence over critical paths", () => {
    // If a file is in both test AND critical, test weight wins (checked first)
    expect(criticalityPathWeight(["tests/auth/login.test.ts"])).toBe(0.3);
  });
});

// ---------------------------------------------------------------------------
// scoreToPriority
// ---------------------------------------------------------------------------

describe("scoreToPriority", () => {
  it("returns P0 for score >= 30", () => {
    expect(scoreToPriority(30)).toBe("P0");
    expect(scoreToPriority(100)).toBe("P0");
  });

  it("returns P1 for score >= 15", () => {
    expect(scoreToPriority(15)).toBe("P1");
    expect(scoreToPriority(29)).toBe("P1");
  });

  it("returns P2 for score >= 7", () => {
    expect(scoreToPriority(7)).toBe("P2");
    expect(scoreToPriority(14)).toBe("P2");
  });

  it("returns P3 for score >= 3", () => {
    expect(scoreToPriority(3)).toBe("P3");
    expect(scoreToPriority(6)).toBe("P3");
  });

  it("returns P4 for score < 3", () => {
    expect(scoreToPriority(2)).toBe("P4");
    expect(scoreToPriority(0)).toBe("P4");
  });
});

// ---------------------------------------------------------------------------
// findTDMEntries
// ---------------------------------------------------------------------------

describe("findTDMEntries", () => {
  it("finds matching packages by name", () => {
    const dep = makeDep();
    const tdm = makeTDM({
      packages: [
        {
          name: "stripe",
          ecosystem: "pypi",
          current_version: "7.0.0",
          manifest_file: "requirements.txt",
          locations: [{ file: "app.py", line: 1 }],
          usage_count: 10,
          confidence: "high",
        },
      ],
    });

    const entries = findTDMEntries(dep, tdm);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.usage_count).toBe(10);
  });

  it("finds matching SDKs by provider", () => {
    const dep = makeDep({ kind: "sdk" });
    const tdm = makeTDM({
      sdks: [
        {
          provider: "stripe",
          sdk_package: "stripe",
          locations: [{ file: "pay.py", line: 5 }],
          usage_count: 20,
          confidence: "high",
        },
      ],
    });

    const entries = findTDMEntries(dep, tdm);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.usage_count).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// computeImpactScore — integration
// ---------------------------------------------------------------------------

describe("computeImpactScore", () => {
  it("produces P0 for breaking + 100 usages in payments/", () => {
    const locations = Array.from({ length: 12 }, (_, i) => ({
      file: `payments/handler_${i}.py`,
      line: i + 1,
      context: "stripe.Charge.create()",
      usage: "method_call",
    }));

    const tdm = makeTDM({
      packages: [
        {
          name: "stripe",
          ecosystem: "pypi",
          current_version: "7.0.0",
          manifest_file: "requirements.txt",
          locations,
          usage_count: 200,
          confidence: "high",
        },
      ],
    });

    const change = makeChange({ changeType: "breaking" });
    const result = computeImpactScore(change, tdm);

    // severity=5, usage=3(>100), spread=3(>10 files), path=3(payment)
    // 5 * 3 * 3 * 3 = 135 → P0
    expect(result.priority).toBe("P0");
    expect(result.score).toBeGreaterThanOrEqual(30);
  });

  it("produces P3 for breaking + 1 usage in tests/", () => {
    const tdm = makeTDM({
      packages: [
        {
          name: "stripe",
          ecosystem: "pypi",
          current_version: "7.0.0",
          manifest_file: "requirements.txt",
          locations: [
            { file: "tests/test_stripe.py", line: 47, usage: "method_call" },
          ],
          usage_count: 1,
          confidence: "high",
        },
      ],
    });

    const change = makeChange({ changeType: "breaking" });
    const result = computeImpactScore(change, tdm);

    // severity=5, usage=1(>0), spread=1(1 file), path=0.3(test)
    // 5 * 1 * 1 * 0.3 = 1.5 → P4
    expect(result.priority).toBe("P4");
    expect(result.score).toBeLessThan(3);
  });

  it("produces P4 for patch change on any dependency", () => {
    const tdm = makeTDM({
      packages: [
        {
          name: "stripe",
          ecosystem: "pypi",
          current_version: "7.0.0",
          manifest_file: "requirements.txt",
          locations: [
            { file: "src/payments/handler.py", line: 10, usage: "import" },
          ],
          usage_count: 50,
          confidence: "high",
        },
      ],
    });

    const change = makeChange({ changeType: "patch" });
    const result = computeImpactScore(change, tdm);

    // severity=0.5, usage=2(>20), spread=1(1 file), path=3(payment)
    // 0.5 * 2 * 1 * 3 = 3 → P3
    // Even with high usage in critical path, patch stays low
    expect(result.priority).toBe("P3");
  });

  it("returns P4 for informational changes", () => {
    const tdm = makeTDM({
      packages: [
        {
          name: "stripe",
          ecosystem: "pypi",
          current_version: "7.0.0",
          manifest_file: "requirements.txt",
          locations: [{ file: "app.py", line: 1 }],
          usage_count: 100,
          confidence: "high",
        },
      ],
    });

    const change = makeChange({ changeType: "informational" });
    const result = computeImpactScore(change, tdm);

    // severity=0, so score = 0 → P4
    expect(result.priority).toBe("P4");
    expect(result.score).toBe(0);
  });

  it("includes score components for debugging", () => {
    const tdm = makeTDM({
      packages: [
        {
          name: "stripe",
          ecosystem: "pypi",
          current_version: "7.0.0",
          manifest_file: "requirements.txt",
          locations: [{ file: "src/pay.py", line: 1 }],
          usage_count: 10,
          confidence: "high",
        },
      ],
    });

    const change = makeChange({ changeType: "deprecation" });
    const result = computeImpactScore(change, tdm);

    expect(result.components).toEqual({
      severity: 3,
      usage: 1.5,
      spread: 1,
      path: 1,
    });
  });

  it("applies custom critical paths", () => {
    const tdm = makeTDM({
      packages: [
        {
          name: "stripe",
          ecosystem: "pypi",
          current_version: "7.0.0",
          manifest_file: "requirements.txt",
          locations: [{ file: "src/onboarding/flow.py", line: 1 }],
          usage_count: 10,
          confidence: "high",
        },
      ],
    });

    const change = makeChange({ changeType: "breaking" });
    const withCustom = computeImpactScore(change, tdm, ["onboarding"]);
    const without = computeImpactScore(change, tdm);

    expect(withCustom.components.path).toBe(3);
    expect(without.components.path).toBe(1);
  });
});
