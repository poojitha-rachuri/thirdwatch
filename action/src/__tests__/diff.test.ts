import { describe, it, expect } from "vitest";
import type { TDM } from "@thirdwatch/tdm";
import { diffTDMs, extractAllEntries, formatDiffAsMarkdown } from "../diff.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTDM(overrides: Partial<TDM> = {}): TDM {
  return {
    version: "1.0",
    metadata: {
      scan_timestamp: "2026-02-24T00:00:00Z",
      scanner_version: "0.1.0",
      languages_detected: ["python", "javascript"],
      total_dependencies_found: 0,
      scan_duration_ms: 100,
      ...overrides.metadata,
    },
    packages: overrides.packages ?? [],
    apis: overrides.apis ?? [],
    sdks: overrides.sdks ?? [],
    infrastructure: overrides.infrastructure ?? [],
    webhooks: overrides.webhooks ?? [],
  };
}

const stripePackage = {
  name: "stripe",
  ecosystem: "pypi" as const,
  current_version: "7.0.0",
  manifest_file: "requirements.txt",
  locations: [{ file: "app.py", line: 1 }],
  usage_count: 1,
  confidence: "high" as const,
};

const awsSdk = {
  provider: "aws",
  sdk_package: "boto3",
  locations: [{ file: "infra.py", line: 5 }],
  usage_count: 1,
  confidence: "high" as const,
};

const stripeApi = {
  url: "https://api.stripe.com/v1/charges",
  method: "POST" as const,
  provider: "stripe",
  locations: [{ file: "payments.py", line: 10 }],
  usage_count: 1,
  confidence: "high" as const,
};

const redisInfra = {
  type: "redis" as const,
  connection_ref: "REDIS_URL",
  locations: [{ file: "cache.py", line: 3 }],
  confidence: "medium" as const,
};

const stripeWebhook = {
  direction: "inbound_callback" as const,
  target_url: "/webhooks/stripe",
  provider: "stripe",
  locations: [{ file: "routes.py", line: 20 }],
  confidence: "high" as const,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("extractAllEntries", () => {
  it("extracts entries from all TDM sections", () => {
    const tdm = makeTDM({
      packages: [stripePackage],
      sdks: [awsSdk],
      apis: [stripeApi],
      infrastructure: [redisInfra],
      webhooks: [stripeWebhook],
    });

    const entries = extractAllEntries(tdm);
    expect(entries).toHaveLength(5);

    const keys = entries.map((e) => e.key);
    expect(keys).toContain("pkg:pypi/stripe");
    expect(keys).toContain("sdk:aws/boto3");
    expect(keys).toContain("api:POST:https://api.stripe.com/v1/charges");
    expect(keys).toContain("infra:redis/REDIS_URL");
    expect(keys).toContain("webhook:inbound_callback//webhooks/stripe");
  });

  it("returns empty array for empty TDM", () => {
    const entries = extractAllEntries(makeTDM());
    expect(entries).toHaveLength(0);
  });
});

describe("diffTDMs", () => {
  it("treats all entries as new when baseline is null", () => {
    const current = makeTDM({
      packages: [stripePackage],
      apis: [stripeApi],
    });

    const diff = diffTDMs(null, current);

    expect(diff.added).toHaveLength(2);
    expect(diff.removed).toHaveLength(0);
    expect(diff.unchanged).toHaveLength(0);
    expect(diff.summary.addedCount).toBe(2);
    expect(diff.summary.removedCount).toBe(0);
  });

  it("detects added dependencies", () => {
    const baseline = makeTDM({ packages: [stripePackage] });
    const current = makeTDM({
      packages: [stripePackage],
      apis: [stripeApi],
    });

    const diff = diffTDMs(baseline, current);

    expect(diff.added).toHaveLength(1);
    expect(diff.added[0]!.key).toBe(
      "api:POST:https://api.stripe.com/v1/charges",
    );
    expect(diff.removed).toHaveLength(0);
    expect(diff.unchanged).toHaveLength(1);
  });

  it("detects removed dependencies", () => {
    const baseline = makeTDM({
      packages: [stripePackage],
      apis: [stripeApi],
    });
    const current = makeTDM({ packages: [stripePackage] });

    const diff = diffTDMs(baseline, current);

    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(1);
    expect(diff.removed[0]!.key).toBe(
      "api:POST:https://api.stripe.com/v1/charges",
    );
    expect(diff.unchanged).toHaveLength(1);
  });

  it("handles no changes", () => {
    const baseline = makeTDM({ packages: [stripePackage] });
    const current = makeTDM({ packages: [stripePackage] });

    const diff = diffTDMs(baseline, current);

    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.unchanged).toHaveLength(1);
    expect(diff.summary.unchangedCount).toBe(1);
  });

  it("handles complete replacement", () => {
    const baseline = makeTDM({ packages: [stripePackage] });
    const current = makeTDM({ sdks: [awsSdk] });

    const diff = diffTDMs(baseline, current);

    expect(diff.added).toHaveLength(1);
    expect(diff.added[0]!.key).toBe("sdk:aws/boto3");
    expect(diff.removed).toHaveLength(1);
    expect(diff.removed[0]!.key).toBe("pkg:pypi/stripe");
    expect(diff.unchanged).toHaveLength(0);
  });

  it("handles both empty TDMs", () => {
    const diff = diffTDMs(makeTDM(), makeTDM());

    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.unchanged).toHaveLength(0);
  });
});

describe("formatDiffAsMarkdown", () => {
  it("formats new dependencies correctly", () => {
    const current = makeTDM({
      metadata: {
        scan_timestamp: "2026-02-24T00:00:00Z",
        scanner_version: "0.1.0",
        languages_detected: ["python"],
        total_dependencies_found: 2,
        scan_duration_ms: 100,
      },
      packages: [stripePackage],
      apis: [stripeApi],
    });
    const diff = diffTDMs(null, current);
    const md = formatDiffAsMarkdown(diff, current);

    expect(md).toContain("## Thirdwatch Dependency Report");
    expect(md).toContain("**2 total external dependencies**");
    expect(md).toContain("### ✨ New Dependencies (2)");
    expect(md).toContain("`pkg:pypi/stripe`");
    expect(md).toContain("*(package)*");
    expect(md).toContain("*(api)*");
  });

  it("formats no changes correctly", () => {
    const baseline = makeTDM({ packages: [stripePackage] });
    const current = makeTDM({
      metadata: {
        scan_timestamp: "2026-02-24T00:00:00Z",
        scanner_version: "0.1.0",
        languages_detected: ["python"],
        total_dependencies_found: 1,
        scan_duration_ms: 100,
      },
      packages: [stripePackage],
    });
    const diff = diffTDMs(baseline, current);
    const md = formatDiffAsMarkdown(diff, current);

    expect(md).toContain("No dependency surface area changes detected");
    expect(md).not.toContain("### ✨ New Dependencies");
    expect(md).not.toContain("### 🗑️ Removed Dependencies");
  });

  it("includes TDM breakdown table", () => {
    const current = makeTDM({
      packages: [stripePackage],
      apis: [stripeApi],
    });
    const diff = diffTDMs(null, current);
    const md = formatDiffAsMarkdown(diff, current);

    expect(md).toContain("| 📦 Packages | 1 |");
    expect(md).toContain("| 🌐 External APIs | 1 |");
    expect(md).toContain("| 🔧 SDKs | 0 |");
  });

  it("truncates large lists", () => {
    const packages = Array.from({ length: 20 }, (_, i) => ({
      ...stripePackage,
      name: `package-${i}`,
    }));
    const current = makeTDM({ packages });
    const diff = diffTDMs(null, current);
    const md = formatDiffAsMarkdown(diff, current);

    expect(md).toContain("*...and 5 more*");
  });

  it("includes Thirdwatch footer", () => {
    const current = makeTDM();
    const diff = diffTDMs(null, current);
    const md = formatDiffAsMarkdown(diff, current);

    expect(md).toContain("[Thirdwatch](https://thirdwatch.dev)");
  });
});
