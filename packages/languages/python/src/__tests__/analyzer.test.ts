import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PythonPlugin } from "../index.js";

const fixturesRoot = resolve(__dirname, "../../../../../fixtures/python-app");
const plugin = new PythonPlugin();

describe("PythonPlugin", () => {
  describe("analyzeManifests", () => {
    it("parses requirements.txt", async () => {
      const manifestFile = resolve(fixturesRoot, "requirements.txt");
      const entries = await plugin.analyzeManifests([manifestFile], fixturesRoot);

      expect(entries.length).toBe(10);
      const stripe = entries.find((e) => e.kind === "package" && e.name === "stripe");
      expect(stripe).toBeDefined();
      expect(stripe!.kind).toBe("package");
      if (stripe!.kind === "package") {
        expect(stripe!.ecosystem).toBe("pypi");
        expect(stripe!.current_version).toBe("7.9.0");
        expect(stripe!.version_constraint).toBe("==7.9.0");
      }
    });

    it("normalizes package names", async () => {
      const manifestFile = resolve(fixturesRoot, "requirements.txt");
      const entries = await plugin.analyzeManifests([manifestFile], fixturesRoot);

      const psycopg2 = entries.find((e) => e.kind === "package" && e.name === "psycopg2-binary");
      expect(psycopg2).toBeDefined();

      const sentry = entries.find((e) => e.kind === "package" && e.name === "sentry-sdk");
      expect(sentry).toBeDefined();
    });
  });

  describe("analyze", () => {
    it("detects stripe SDK usage in stripe_client.py", async () => {
      const filePath = resolve(fixturesRoot, "payments/stripe_client.py");
      const source = await readFile(filePath, "utf-8");
      const entries = await plugin.analyze({
        filePath,
        source,
        scanRoot: fixturesRoot,
        resolvedEnv: {},
      });

      const sdks = entries.filter((e) => e.kind === "sdk");
      const stripeSDK = sdks.find((e) => e.kind === "sdk" && e.provider === "stripe");
      expect(stripeSDK).toBeDefined();
    });

    it("detects HTTP calls in stripe_client.py", async () => {
      const filePath = resolve(fixturesRoot, "payments/stripe_client.py");
      const source = await readFile(filePath, "utf-8");
      const entries = await plugin.analyze({
        filePath,
        source,
        scanRoot: fixturesRoot,
        resolvedEnv: {},
      });

      const apis = entries.filter((e) => e.kind === "api");
      const getCall = apis.find((e) => e.kind === "api" && e.method === "GET");
      expect(getCall).toBeDefined();
    });

    it("detects HTTP calls in completion_service.py", async () => {
      const filePath = resolve(fixturesRoot, "ai/completion_service.py");
      const source = await readFile(filePath, "utf-8");
      const entries = await plugin.analyze({
        filePath,
        source,
        scanRoot: fixturesRoot,
        resolvedEnv: {},
      });

      const apis = entries.filter((e) => e.kind === "api");
      expect(apis.length).toBeGreaterThan(0);
      const postCall = apis.find((e) => e.kind === "api" && e.method === "POST");
      expect(postCall).toBeDefined();
    });

    it("detects OpenAI SDK constructor in completion_service.py", async () => {
      const filePath = resolve(fixturesRoot, "ai/completion_service.py");
      const source = await readFile(filePath, "utf-8");
      const entries = await plugin.analyze({
        filePath,
        source,
        scanRoot: fixturesRoot,
        resolvedEnv: {},
      });

      const sdks = entries.filter((e) => e.kind === "sdk");
      const openaiSDK = sdks.find((e) => e.kind === "sdk" && e.provider === "openai");
      expect(openaiSDK).toBeDefined();
    });

    it("detects boto3 SDK usage with services in storage.py", async () => {
      const filePath = resolve(fixturesRoot, "infra/storage.py");
      const source = await readFile(filePath, "utf-8");
      const entries = await plugin.analyze({
        filePath,
        source,
        scanRoot: fixturesRoot,
        resolvedEnv: {},
      });

      const sdks = entries.filter((e) => e.kind === "sdk");
      const awsSDK = sdks.filter((e) => e.kind === "sdk" && e.provider === "aws");
      expect(awsSDK.length).toBeGreaterThanOrEqual(2);

      const s3 = awsSDK.find((e) => e.kind === "sdk" && e.services_used?.includes("s3"));
      expect(s3).toBeDefined();

      const sqs = awsSDK.find((e) => e.kind === "sdk" && e.services_used?.includes("sqs"));
      expect(sqs).toBeDefined();
    });

    it("detects redis infrastructure in storage.py", async () => {
      const filePath = resolve(fixturesRoot, "infra/storage.py");
      const source = await readFile(filePath, "utf-8");
      const entries = await plugin.analyze({
        filePath,
        source,
        scanRoot: fixturesRoot,
        resolvedEnv: {},
      });

      const infra = entries.filter((e) => e.kind === "infrastructure");
      const redis = infra.find((e) => e.kind === "infrastructure" && e.type === "redis");
      expect(redis).toBeDefined();
      if (redis && redis.kind === "infrastructure") {
        expect(redis.resolved_host).toBe("cache.internal");
      }
    });

    it("detects postgresql infrastructure in storage.py", async () => {
      const filePath = resolve(fixturesRoot, "infra/storage.py");
      const source = await readFile(filePath, "utf-8");
      const entries = await plugin.analyze({
        filePath,
        source,
        scanRoot: fixturesRoot,
        resolvedEnv: {},
      });

      const infra = entries.filter((e) => e.kind === "infrastructure");
      const pg = infra.find((e) => e.kind === "infrastructure" && e.type === "postgresql");
      expect(pg).toBeDefined();
      if (pg && pg.kind === "infrastructure") {
        expect(pg.connection_ref).toBe("DATABASE_URL");
      }
    });

    it("detects redis connection string URL in storage.py", async () => {
      const filePath = resolve(fixturesRoot, "infra/storage.py");
      const source = await readFile(filePath, "utf-8");
      const entries = await plugin.analyze({
        filePath,
        source,
        scanRoot: fixturesRoot,
        resolvedEnv: {},
      });

      const infra = entries.filter((e) => e.kind === "infrastructure");
      const redisUrl = infra.find(
        (e) =>
          e.kind === "infrastructure" &&
          e.type === "redis" &&
          e.connection_ref.startsWith("redis://"),
      );
      expect(redisUrl).toBeDefined();
    });
  });
});
