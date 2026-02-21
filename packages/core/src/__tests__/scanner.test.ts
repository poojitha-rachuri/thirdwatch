import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { scan } from "../scanner.js";
import type { LanguageAnalyzerPlugin, DependencyEntry } from "../plugin.js";

const fixturesRoot = resolve(__dirname, "../../../../fixtures");

/**
 * A minimal Python plugin that detects `import` statements and
 * `requests.get/post` calls — enough to validate scanner orchestration.
 */
const stubPythonPlugin: LanguageAnalyzerPlugin = {
  name: "Stub Python",
  language: "python",
  extensions: [".py"],
  async analyze(ctx): Promise<DependencyEntry[]> {
    const entries: DependencyEntry[] = [];
    const lines = ctx.source.split("\n");
    const rel = ctx.filePath.replace(ctx.scanRoot + "/", "");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;

      // Detect requests.get/post URL calls
      const urlMatch = line.match(
        /requests\.(get|post|put|delete)\(\s*["']([^"']+)["']/,
      );
      if (urlMatch) {
        entries.push({
          kind: "api",
          url: urlMatch[2]!,
          method: urlMatch[1]!.toUpperCase() as "GET" | "POST" | "PUT" | "DELETE",
          locations: [{ file: rel, line: i + 1 }],
          usage_count: 1,
          confidence: "medium",
        });
      }
    }

    return entries;
  },
  async analyzeManifests(manifestFiles, scanRoot): Promise<DependencyEntry[]> {
    const entries: DependencyEntry[] = [];
    const { readFile } = await import("node:fs/promises");

    for (const manifest of manifestFiles) {
      if (!manifest.endsWith("requirements.txt")) continue;
      const content = await readFile(manifest, "utf-8");
      const rel = manifest.replace(scanRoot + "/", "");

      for (const line of content.split("\n")) {
        const match = line.match(/^([a-zA-Z0-9_-]+)==([^\s]+)/);
        if (match) {
          entries.push({
            kind: "package",
            name: match[1]!,
            ecosystem: "pypi",
            current_version: match[2]!,
            manifest_file: rel,
            locations: [{ file: rel, line: 1 }],
            usage_count: 1,
            confidence: "high",
          });
        }
      }
    }

    return entries;
  },
};

describe("scan()", () => {
  it("scans fixtures/python-app and returns a valid TDM structure", async () => {
    const result = await scan({
      root: resolve(fixturesRoot, "python-app"),
      plugins: [stubPythonPlugin],
      resolveEnv: false,
    });

    expect(result.tdm.version).toBe("1.0");
    expect(result.tdm.metadata.languages_detected).toContain("python");
    expect(result.tdm.metadata.scan_duration_ms).toBeGreaterThanOrEqual(0);
    expect(result.errors).toEqual([]);

    // Should find packages from requirements.txt
    expect(result.tdm.packages.length).toBeGreaterThan(0);
    const stripePackage = result.tdm.packages.find((p) => p.name === "stripe");
    expect(stripePackage).toBeDefined();
    expect(stripePackage!.ecosystem).toBe("pypi");
    expect(stripePackage!.current_version).toBe("7.9.0");
  });

  it("returns filesScanned and filesSkipped counts", async () => {
    const result = await scan({
      root: resolve(fixturesRoot, "python-app"),
      plugins: [stubPythonPlugin],
      resolveEnv: false,
    });

    expect(result.filesScanned).toBeGreaterThan(0);
    expect(typeof result.filesSkipped).toBe("number");
  });

  it("produces zero entries for unregistered file types", async () => {
    const result = await scan({
      root: resolve(fixturesRoot, "python-app"),
      plugins: [], // no plugins
      resolveEnv: false,
    });

    expect(result.tdm.packages).toEqual([]);
    expect(result.tdm.apis).toEqual([]);
    expect(result.tdm.sdks).toEqual([]);
    expect(result.filesScanned).toBe(0);
  });

  it("respects ignore patterns", async () => {
    const result = await scan({
      root: resolve(fixturesRoot, "python-app"),
      plugins: [stubPythonPlugin],
      ignore: ["payments/**"],
      resolveEnv: false,
    });

    // payments/ dir files should be excluded, so no stripe API calls from there
    const paymentsLocations = result.tdm.apis.flatMap((a) =>
      a.locations.filter((l) => l.file.startsWith("payments/")),
    );
    expect(paymentsLocations).toEqual([]);
  });

  it("handles worker errors gracefully (file not crashed)", async () => {
    const crashPlugin: LanguageAnalyzerPlugin = {
      name: "Crasher",
      language: "python",
      extensions: [".py"],
      async analyze() {
        throw new Error("simulated crash");
      },
    };

    const result = await scan({
      root: resolve(fixturesRoot, "python-app"),
      plugins: [crashPlugin],
      resolveEnv: false,
    });

    // Should have errors logged but scan should complete
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!.error).toBe("simulated crash");
  });
});
