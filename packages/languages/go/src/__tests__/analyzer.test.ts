import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { GoPlugin } from "../index.js";

const fixturesRoot = resolve(__dirname, "../../../../../fixtures/go-app");
const plugin = new GoPlugin();

describe("GoPlugin", () => {
  describe("analyze — main.go", () => {
    it("detects HTTP GET call", async () => {
      const filePath = resolve(fixturesRoot, "main.go");
      const source = await readFile(filePath, "utf-8");
      const entries = await plugin.analyze({
        filePath,
        source,
        scanRoot: fixturesRoot,
        resolvedEnv: {},
      });

      const apis = entries.filter((e) => e.kind === "api");
      const getCall = apis.find(
        (e) => e.kind === "api" && e.method === "GET" && e.url.includes("stripe.com"),
      );
      expect(getCall).toBeDefined();
      expect(getCall!.confidence).toBe("high");
    });

    it("detects HTTP POST via NewRequest", async () => {
      const filePath = resolve(fixturesRoot, "main.go");
      const source = await readFile(filePath, "utf-8");
      const entries = await plugin.analyze({
        filePath,
        source,
        scanRoot: fixturesRoot,
        resolvedEnv: {},
      });

      const apis = entries.filter((e) => e.kind === "api");
      const postCall = apis.find(
        (e) => e.kind === "api" && e.method === "POST" && e.url.includes("openai.com"),
      );
      expect(postCall).toBeDefined();
    });

    it("detects AWS S3 SDK via NewFromConfig", async () => {
      const filePath = resolve(fixturesRoot, "main.go");
      const source = await readFile(filePath, "utf-8");
      const entries = await plugin.analyze({
        filePath,
        source,
        scanRoot: fixturesRoot,
        resolvedEnv: {},
      });

      const sdks = entries.filter((e) => e.kind === "sdk");
      const awsSDK = sdks.find(
        (e) => e.kind === "sdk" && e.provider === "aws" && e.services_used?.includes("s3"),
      );
      expect(awsSDK).toBeDefined();
    });

    it("detects Stripe SDK via charge.New", async () => {
      const filePath = resolve(fixturesRoot, "main.go");
      const source = await readFile(filePath, "utf-8");
      const entries = await plugin.analyze({
        filePath,
        source,
        scanRoot: fixturesRoot,
        resolvedEnv: {},
      });

      const sdks = entries.filter((e) => e.kind === "sdk");
      const stripeSDK = sdks.find(
        (e) => e.kind === "sdk" && e.provider === "stripe",
      );
      expect(stripeSDK).toBeDefined();
    });

    it("detects OpenAI SDK via openai.NewClient", async () => {
      const filePath = resolve(fixturesRoot, "main.go");
      const source = await readFile(filePath, "utf-8");
      const entries = await plugin.analyze({
        filePath,
        source,
        scanRoot: fixturesRoot,
        resolvedEnv: {},
      });

      const sdks = entries.filter((e) => e.kind === "sdk");
      const openaiSDK = sdks.find(
        (e) => e.kind === "sdk" && e.provider === "openai",
      );
      expect(openaiSDK).toBeDefined();
    });

    it("detects PostgreSQL via pgx.Connect", async () => {
      const filePath = resolve(fixturesRoot, "main.go");
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
    });

    it("detects Redis via redis.NewClient", async () => {
      const filePath = resolve(fixturesRoot, "main.go");
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
    });

    it("detects SDK from imports", async () => {
      const filePath = resolve(fixturesRoot, "main.go");
      const source = await readFile(filePath, "utf-8");
      const entries = await plugin.analyze({
        filePath,
        source,
        scanRoot: fixturesRoot,
        resolvedEnv: {},
      });

      const sdks = entries.filter((e) => e.kind === "sdk");
      // Should detect aws, stripe, openai from imports
      const providers = new Set(sdks.map((e) => e.kind === "sdk" ? e.provider : ""));
      expect(providers.has("aws")).toBe(true);
      expect(providers.has("stripe")).toBe(true);
      expect(providers.has("openai")).toBe(true);
    });

    it("produces ≥5 distinct dependency entries", async () => {
      const filePath = resolve(fixturesRoot, "main.go");
      const source = await readFile(filePath, "utf-8");
      const entries = await plugin.analyze({
        filePath,
        source,
        scanRoot: fixturesRoot,
        resolvedEnv: {},
      });

      expect(entries.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe("analyze — server/handler.go", () => {
    it("detects HTTP GET call to external API", async () => {
      const filePath = resolve(fixturesRoot, "server/handler.go");
      const source = await readFile(filePath, "utf-8");
      const entries = await plugin.analyze({
        filePath,
        source,
        scanRoot: fixturesRoot,
        resolvedEnv: {},
      });

      const apis = entries.filter((e) => e.kind === "api");
      const getCall = apis.find(
        (e) => e.kind === "api" && e.url.includes("api.example.com"),
      );
      expect(getCall).toBeDefined();
    });

    it("detects PostgreSQL via sql.Open", async () => {
      const filePath = resolve(fixturesRoot, "server/handler.go");
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
    });
  });
});
