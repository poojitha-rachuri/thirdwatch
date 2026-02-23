import { describe, it, expect } from "vitest";
import type { ImpactAssessment, SuppressionRule } from "../types.js";
import { shouldSuppress } from "../suppression.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAssessment(overrides: Partial<ImpactAssessment> = {}): ImpactAssessment {
  return {
    changeEventId: "evt-1",
    priority: "P1",
    score: 20,
    affectedLocations: [
      { file: "src/payments/handler.py", line: 10, context: "", usageType: "import" },
    ],
    humanSummary: "stripe has a breaking change",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// shouldSuppress
// ---------------------------------------------------------------------------

describe("shouldSuppress", () => {
  it("returns suppressed: false when no rules match", () => {
    const assessment = makeAssessment();
    const rules: SuppressionRule[] = [];
    const result = shouldSuppress(assessment, rules);
    expect(result.suppressed).toBe(false);
  });

  it("suppresses by dependency glob", () => {
    const assessment = makeAssessment();
    const rules: SuppressionRule[] = [
      { dependency: "eslint*", reason: "Dev tooling only" },
    ];

    // eslint doesn't match stripe
    expect(shouldSuppress(assessment, rules, "breaking", "stripe").suppressed).toBe(false);

    // eslint matches eslint
    expect(shouldSuppress(assessment, rules, "breaking", "eslint").suppressed).toBe(true);

    // eslint* matches eslint-plugin-foo
    expect(shouldSuppress(assessment, rules, "breaking", "eslint-plugin-foo").suppressed).toBe(true);
  });

  it("suppresses by change category", () => {
    const assessment = makeAssessment();
    const rules: SuppressionRule[] = [{ change_category: "patch" }];

    expect(shouldSuppress(assessment, rules, "patch").suppressed).toBe(true);
    expect(shouldSuppress(assessment, rules, "breaking").suppressed).toBe(false);
  });

  it("suppresses by min_priority (lower priorities are suppressed)", () => {
    const rules: SuppressionRule[] = [{ min_priority: "P3" }];

    // P4 is lower than P3 → suppressed
    const p4 = makeAssessment({ priority: "P4" });
    expect(shouldSuppress(p4, rules).suppressed).toBe(true);

    // P3 is NOT lower than P3 → not suppressed
    const p3 = makeAssessment({ priority: "P3" });
    expect(shouldSuppress(p3, rules).suppressed).toBe(false);

    // P1 is NOT lower than P3 → not suppressed
    const p1 = makeAssessment({ priority: "P1" });
    expect(shouldSuppress(p1, rules).suppressed).toBe(false);
  });

  it("suppresses by file_path glob when ALL files match", () => {
    const rules: SuppressionRule[] = [{ file_path: "tests/*" }];

    // All files in tests/ → suppressed
    const allTests = makeAssessment({
      affectedLocations: [
        { file: "tests/test_stripe.py", line: 1, context: "", usageType: "import" },
        { file: "tests/test_payments.py", line: 5, context: "", usageType: "import" },
      ],
    });
    expect(shouldSuppress(allTests, rules).suppressed).toBe(true);

    // Mixed files → not suppressed
    const mixed = makeAssessment({
      affectedLocations: [
        { file: "tests/test_stripe.py", line: 1, context: "", usageType: "import" },
        { file: "src/payments/handler.py", line: 10, context: "", usageType: "import" },
      ],
    });
    expect(shouldSuppress(mixed, rules).suppressed).toBe(false);
  });

  it("returns the matching rule", () => {
    const rules: SuppressionRule[] = [
      { dependency: "eslint", reason: "Dev tooling only" },
    ];

    const result = shouldSuppress(makeAssessment(), rules, "breaking", "eslint");
    expect(result.suppressed).toBe(true);
    expect(result.rule?.reason).toBe("Dev tooling only");
  });

  it("applies combined rule conditions (AND logic)", () => {
    const rules: SuppressionRule[] = [
      { change_category: "minor-update", min_priority: "P3" },
    ];

    // Matches category AND min_priority → suppressed
    const p4Minor = makeAssessment({ priority: "P4" });
    expect(shouldSuppress(p4Minor, rules, "minor-update").suppressed).toBe(true);

    // Matches category but NOT min_priority → not suppressed
    const p1Minor = makeAssessment({ priority: "P1" });
    expect(shouldSuppress(p1Minor, rules, "minor-update").suppressed).toBe(false);

    // Matches min_priority but NOT category → not suppressed
    const p4Breaking = makeAssessment({ priority: "P4" });
    expect(shouldSuppress(p4Breaking, rules, "breaking").suppressed).toBe(false);
  });
});
