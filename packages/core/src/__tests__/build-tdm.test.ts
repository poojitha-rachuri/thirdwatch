import { describe, it, expect } from "vitest";
import { buildTDM } from "../build-tdm.js";
import type { DependencyEntry, LanguageAnalyzerPlugin } from "../plugin.js";

const mockPlugin: LanguageAnalyzerPlugin = {
  name: "Test Plugin",
  language: "test",
  extensions: [".test"],
  analyze: async () => [],
};

describe("buildTDM", () => {
  it("produces a valid TDM from an empty entry list", () => {
    const tdm = buildTDM([], {
      root: "/tmp/test",
      plugins: [mockPlugin],
      duration: 42,
    });

    expect(tdm.version).toBe("1.0");
    expect(tdm.metadata.scan_duration_ms).toBe(42);
    expect(tdm.metadata.languages_detected).toEqual(["test"]);
    expect(tdm.metadata.total_dependencies_found).toBe(0);
    expect(tdm.packages).toEqual([]);
    expect(tdm.apis).toEqual([]);
    expect(tdm.sdks).toEqual([]);
    expect(tdm.infrastructure).toEqual([]);
    expect(tdm.webhooks).toEqual([]);
  });

  it("separates entries by kind", () => {
    const entries: DependencyEntry[] = [
      {
        kind: "package",
        name: "stripe",
        ecosystem: "pypi",
        current_version: "7.9.0",
        manifest_file: "requirements.txt",
        locations: [{ file: "payments/client.py", line: 1 }],
        usage_count: 1,
        confidence: "high",
      },
      {
        kind: "api",
        url: "https://api.stripe.com/v1/charges",
        method: "POST",
        locations: [{ file: "payments/client.py", line: 10 }],
        usage_count: 1,
        confidence: "high",
      },
    ];

    const tdm = buildTDM(entries, {
      root: "/tmp/test",
      plugins: [mockPlugin],
      duration: 100,
    });

    expect(tdm.packages).toHaveLength(1);
    expect(tdm.packages[0]!.name).toBe("stripe");
    expect(tdm.apis).toHaveLength(1);
    expect(tdm.apis[0]!.url).toBe("https://api.stripe.com/v1/charges");
    expect(tdm.metadata.total_dependencies_found).toBe(2);
  });

  it("deduplicates packages by ecosystem:name and merges locations", () => {
    const entries: DependencyEntry[] = [
      {
        kind: "package",
        name: "stripe",
        ecosystem: "pypi",
        current_version: "7.9.0",
        manifest_file: "requirements.txt",
        locations: [{ file: "a.py", line: 1 }],
        usage_count: 1,
        confidence: "high",
      },
      {
        kind: "package",
        name: "stripe",
        ecosystem: "pypi",
        current_version: "7.9.0",
        manifest_file: "requirements.txt",
        locations: [{ file: "b.py", line: 5 }],
        usage_count: 1,
        confidence: "high",
      },
    ];

    const tdm = buildTDM(entries, {
      root: "/tmp/test",
      plugins: [mockPlugin],
      duration: 50,
    });

    expect(tdm.packages).toHaveLength(1);
    expect(tdm.packages[0]!.locations).toHaveLength(2);
    expect(tdm.packages[0]!.usage_count).toBe(2);
  });

  it("deduplicates APIs by method:url", () => {
    const entries: DependencyEntry[] = [
      {
        kind: "api",
        url: "https://api.stripe.com/v1/charges",
        method: "POST",
        locations: [{ file: "a.py", line: 10 }],
        usage_count: 1,
        confidence: "high",
      },
      {
        kind: "api",
        url: "https://api.stripe.com/v1/charges",
        method: "POST",
        locations: [{ file: "b.py", line: 20 }],
        usage_count: 1,
        confidence: "high",
      },
    ];

    const tdm = buildTDM(entries, {
      root: "/tmp/test",
      plugins: [mockPlugin],
      duration: 50,
    });

    expect(tdm.apis).toHaveLength(1);
    expect(tdm.apis[0]!.locations).toHaveLength(2);
    expect(tdm.apis[0]!.usage_count).toBe(2);
  });

  it("deduplicates SDKs and merges services_used and api_methods", () => {
    const entries: DependencyEntry[] = [
      {
        kind: "sdk",
        provider: "aws",
        sdk_package: "boto3",
        services_used: ["s3"],
        api_methods: ["s3.upload_file"],
        locations: [{ file: "a.py", line: 1 }],
        usage_count: 1,
        confidence: "high",
      },
      {
        kind: "sdk",
        provider: "aws",
        sdk_package: "boto3",
        services_used: ["sqs"],
        api_methods: ["sqs.send_message"],
        locations: [{ file: "b.py", line: 5 }],
        usage_count: 1,
        confidence: "high",
      },
    ];

    const tdm = buildTDM(entries, {
      root: "/tmp/test",
      plugins: [mockPlugin],
      duration: 50,
    });

    expect(tdm.sdks).toHaveLength(1);
    expect(tdm.sdks[0]!.services_used).toEqual(
      expect.arrayContaining(["s3", "sqs"]),
    );
    expect(tdm.sdks[0]!.api_methods).toEqual(
      expect.arrayContaining(["s3.upload_file", "sqs.send_message"]),
    );
  });

  it("does not include repository in metadata when not provided", () => {
    const tdm = buildTDM([], {
      root: "/tmp/test",
      plugins: [mockPlugin],
      duration: 10,
    });

    expect(tdm.metadata).not.toHaveProperty("repository");
  });

  it("includes repository in metadata when provided", () => {
    const tdm = buildTDM([], {
      root: "/tmp/test",
      plugins: [mockPlugin],
      duration: 10,
      repository: "github.com/acme/app",
    });

    expect(tdm.metadata.repository).toBe("github.com/acme/app");
  });
});
