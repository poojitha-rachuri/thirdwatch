import { describe, it, expect, beforeAll } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { DependencyEntry } from "@thirdwatch/core";
import { GoPlugin } from "../index.js";

const fixturesRoot = resolve(__dirname, "../../../../../fixtures/go-app");
const plugin = new GoPlugin();

describe("GoPlugin", () => {
  describe("analyze — main.go", () => {
    let entries: DependencyEntry[];

    beforeAll(async () => {
      const filePath = resolve(fixturesRoot, "main.go");
      const source = await readFile(filePath, "utf-8");
      entries = await plugin.analyze({
        filePath,
        source,
        scanRoot: fixturesRoot,
        resolvedEnv: {},
      });
    });

    it("detects HTTP GET call", () => {
      const getCall = entries.find(
        (e) => e.kind === "api" && e.method === "GET" && e.url.includes("stripe.com"),
      );
      expect(getCall).toBeDefined();
      expect(getCall!.confidence).toBe("high");
    });

    it("detects HTTP POST via NewRequest", () => {
      const postCall = entries.find(
        (e) => e.kind === "api" && e.method === "POST" && e.url.includes("openai.com"),
      );
      expect(postCall).toBeDefined();
    });

    it("detects AWS S3 SDK via NewFromConfig with canonical service name", () => {
      const sdks = entries.filter((e) => e.kind === "sdk");
      const awsSDK = sdks.find(
        (e) => e.kind === "sdk" && e.provider === "aws" && e.services_used?.includes("s3"),
      );
      expect(awsSDK).toBeDefined();
    });

    it("detects Stripe SDK via charge.New", () => {
      const stripeSDK = entries.find(
        (e) => e.kind === "sdk" && e.provider === "stripe",
      );
      expect(stripeSDK).toBeDefined();
    });

    it("detects OpenAI SDK via openai.NewClient", () => {
      const openaiSDK = entries.find(
        (e) => e.kind === "sdk" && e.provider === "openai",
      );
      expect(openaiSDK).toBeDefined();
    });

    it("detects PostgreSQL via pgx.Connect", () => {
      const pg = entries.find((e) => e.kind === "infrastructure" && e.type === "postgresql");
      expect(pg).toBeDefined();
    });

    it("detects Redis via redis.NewClient", () => {
      const redis = entries.find((e) => e.kind === "infrastructure" && e.type === "redis");
      expect(redis).toBeDefined();
    });

    it("deduplicates SDK entries by provider", () => {
      const sdks = entries.filter((e) => e.kind === "sdk");
      const providerCounts = new Map<string, number>();
      for (const e of sdks) {
        if (e.kind === "sdk") {
          providerCounts.set(e.provider, (providerCounts.get(e.provider) ?? 0) + 1);
        }
      }
      // Each provider should appear at most once
      for (const [provider, count] of providerCounts) {
        expect(count, `provider "${provider}" should appear once, got ${count}`).toBe(1);
      }
    });

    it("detects SDK from imports without duplicates", () => {
      const sdks = entries.filter((e) => e.kind === "sdk");
      const providers = new Set(sdks.map((e) => e.kind === "sdk" ? e.provider : ""));
      expect(providers.has("aws")).toBe(true);
      expect(providers.has("stripe")).toBe(true);
      expect(providers.has("openai")).toBe(true);
    });

    it("produces ≥5 distinct dependency entries", () => {
      expect(entries.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe("analyze — server/handler.go", () => {
    let entries: DependencyEntry[];

    beforeAll(async () => {
      const filePath = resolve(fixturesRoot, "server/handler.go");
      const source = await readFile(filePath, "utf-8");
      entries = await plugin.analyze({
        filePath,
        source,
        scanRoot: fixturesRoot,
        resolvedEnv: {},
      });
    });

    it("detects HTTP GET call to external API", () => {
      const getCall = entries.find(
        (e) => e.kind === "api" && e.url.includes("api.example.com"),
      );
      expect(getCall).toBeDefined();
    });

    it("detects PostgreSQL via sql.Open", () => {
      const pg = entries.find((e) => e.kind === "infrastructure" && e.type === "postgresql");
      expect(pg).toBeDefined();
    });

    it("redacts credentials from connection string", () => {
      const pg = entries.find((e) => e.kind === "infrastructure" && e.type === "postgresql");
      expect(pg).toBeDefined();
      if (pg && pg.kind === "infrastructure") {
        expect(pg.connection_ref).not.toContain("user:pass");
        expect(pg.connection_ref).toContain("<redacted>");
      }
    });
  });
});
