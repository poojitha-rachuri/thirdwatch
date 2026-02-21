import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { JavaScriptPlugin } from "../index.js";

const fixturesRoot = resolve(__dirname, "../../../../../fixtures/node-app");
const plugin = new JavaScriptPlugin();

describe("JavaScriptPlugin", () => {
  describe("analyzeManifests", () => {
    it("parses package.json dependencies", async () => {
      const manifestFile = resolve(fixturesRoot, "package.json");
      const entries = await plugin.analyzeManifests!(
        [manifestFile],
        fixturesRoot,
      );

      expect(entries.length).toBeGreaterThan(0);

      const stripe = entries.find(
        (e) => e.kind === "package" && e.name === "stripe",
      );
      expect(stripe).toBeDefined();
      if (stripe?.kind === "package") {
        expect(stripe.ecosystem).toBe("npm");
        expect(stripe.current_version).toBe("14.0.0");
      }

      const openai = entries.find(
        (e) => e.kind === "package" && e.name === "openai",
      );
      expect(openai).toBeDefined();
    });
  });

  describe("analyze", () => {
    it("detects fetch and axios HTTP calls in api-client.ts", async () => {
      const filePath = resolve(fixturesRoot, "src/api-client.ts");
      const source = await readFile(filePath, "utf-8");
      const entries = await plugin.analyze({
        filePath,
        source,
        scanRoot: fixturesRoot,
        resolvedEnv: {},
      });

      const apis = entries.filter((e) => e.kind === "api");
      expect(apis.length).toBeGreaterThanOrEqual(2);

      // Should detect fetch(OPENAI_URL, ...) — variable reference
      const fetchCall = apis.find(
        (e) => e.kind === "api" && e.method === "POST",
      );
      expect(fetchCall).toBeDefined();
    });

    it("detects SDK constructors in sdk-usage.ts", async () => {
      const filePath = resolve(fixturesRoot, "src/sdk-usage.ts");
      const source = await readFile(filePath, "utf-8");
      const entries = await plugin.analyze({
        filePath,
        source,
        scanRoot: fixturesRoot,
        resolvedEnv: {},
      });

      const sdks = entries.filter((e) => e.kind === "sdk");

      const stripe = sdks.find(
        (e) => e.kind === "sdk" && e.provider === "stripe",
      );
      expect(stripe).toBeDefined();

      const openai = sdks.find(
        (e) => e.kind === "sdk" && e.provider === "openai",
      );
      expect(openai).toBeDefined();

      const aws = sdks.filter(
        (e) => e.kind === "sdk" && e.provider === "aws",
      );
      expect(aws.length).toBeGreaterThanOrEqual(2); // S3Client + SQSClient
    });

    it("detects infrastructure connections in sdk-usage.ts", async () => {
      const filePath = resolve(fixturesRoot, "src/sdk-usage.ts");
      const source = await readFile(filePath, "utf-8");
      const entries = await plugin.analyze({
        filePath,
        source,
        scanRoot: fixturesRoot,
        resolvedEnv: {},
      });

      const infra = entries.filter((e) => e.kind === "infrastructure");

      const pg = infra.find(
        (e) => e.kind === "infrastructure" && e.type === "postgresql",
      );
      expect(pg).toBeDefined();

      const redis = infra.find(
        (e) => e.kind === "infrastructure" && e.type === "redis",
      );
      expect(redis).toBeDefined();
    });

    it("detects twilio SDK usage in sdk-usage.ts", async () => {
      const filePath = resolve(fixturesRoot, "src/sdk-usage.ts");
      const source = await readFile(filePath, "utf-8");
      const entries = await plugin.analyze({
        filePath,
        source,
        scanRoot: fixturesRoot,
        resolvedEnv: {},
      });

      const twilio = entries.find(
        (e) => e.kind === "sdk" && e.provider === "twilio",
      );
      expect(twilio).toBeDefined();
    });
  });
});
