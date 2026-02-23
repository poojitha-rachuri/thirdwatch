import { describe, it, expect } from "vitest";
import type { TDM } from "@thirdwatch/tdm";
import type { ChangeEvent, WatchedDependency } from "@thirdwatch/watcher";
import { mapAffectedCode, buildHumanSummary } from "../code-mapper.js";

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
    newVersion: "8.0.0",
    title: "Breaking change",
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
// mapAffectedCode
// ---------------------------------------------------------------------------

describe("mapAffectedCode", () => {
  it("returns correct file + line numbers from the TDM", () => {
    const tdm = makeTDM({
      packages: [
        {
          name: "stripe",
          ecosystem: "pypi",
          current_version: "7.0.0",
          manifest_file: "requirements.txt",
          locations: [
            {
              file: "payments/stripe_client.py",
              line: 47,
              context: "stripe.Charge.create",
              usage: "method_call",
            },
            {
              file: "checkout/handler.py",
              line: 112,
              context: "stripe.PaymentIntent.create",
              usage: "method_call",
            },
          ],
          usage_count: 2,
          confidence: "high",
        },
      ],
    });

    const change = makeChange();
    const locations = mapAffectedCode(change, tdm);

    expect(locations).toHaveLength(2);
    expect(locations[0]).toEqual({
      file: "payments/stripe_client.py",
      line: 47,
      context: "stripe.Charge.create",
      usageType: "method_call",
    });
    expect(locations[1]).toEqual({
      file: "checkout/handler.py",
      line: 112,
      context: "stripe.PaymentIntent.create",
      usageType: "method_call",
    });
  });

  it("returns empty array when no TDM entries match", () => {
    const tdm = makeTDM();
    const change = makeChange();
    const locations = mapAffectedCode(change, tdm);
    expect(locations).toEqual([]);
  });

  it("defaults usageType to 'unknown' when usage is missing", () => {
    const tdm = makeTDM({
      packages: [
        {
          name: "stripe",
          ecosystem: "pypi",
          current_version: "7.0.0",
          manifest_file: "requirements.txt",
          locations: [{ file: "app.py", line: 1 }],
          usage_count: 1,
          confidence: "high",
        },
      ],
    });

    const change = makeChange();
    const locations = mapAffectedCode(change, tdm);
    expect(locations[0]!.usageType).toBe("unknown");
  });

  it("defaults context to empty string when missing", () => {
    const tdm = makeTDM({
      packages: [
        {
          name: "stripe",
          ecosystem: "pypi",
          current_version: "7.0.0",
          manifest_file: "requirements.txt",
          locations: [{ file: "app.py", line: 1 }],
          usage_count: 1,
          confidence: "high",
        },
      ],
    });

    const change = makeChange();
    const locations = mapAffectedCode(change, tdm);
    expect(locations[0]!.context).toBe("");
  });
});

// ---------------------------------------------------------------------------
// buildHumanSummary
// ---------------------------------------------------------------------------

describe("buildHumanSummary", () => {
  it("matches expected format with multiple usages across multiple files", () => {
    const change = makeChange({ changeType: "breaking", newVersion: "8.0.0" });
    const locations = [
      { file: "payments/stripe_client.py", line: 47, context: "", usageType: "method_call" },
      { file: "checkout/handler.py", line: 112, context: "", usageType: "method_call" },
    ];

    const summary = buildHumanSummary(change, locations);
    expect(summary).toBe(
      "stripe has a breaking change (8.0.0). Found 2 usages across 2 files.",
    );
  });

  it("uses singular form for 1 usage in 1 file", () => {
    const change = makeChange({ changeType: "deprecation", newVersion: "3.0.0" });
    const locations = [
      { file: "app.py", line: 1, context: "", usageType: "import" },
    ];

    const summary = buildHumanSummary(change, locations);
    expect(summary).toBe(
      "stripe has a deprecation change (3.0.0). Found 1 usage across 1 file.",
    );
  });

  it("omits version when newVersion is undefined", () => {
    const change = makeChange({ changeType: "breaking", newVersion: undefined });
    const locations = [
      { file: "app.py", line: 1, context: "", usageType: "import" },
    ];

    const summary = buildHumanSummary(change, locations);
    expect(summary).toBe(
      "stripe has a breaking change. Found 1 usage across 1 file.",
    );
  });
});
