import { describe, it, expect, beforeAll } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { DependencyEntry } from "@thirdwatch/core";
import { PhpPlugin } from "../index.js";

const fixturesRoot = resolve(__dirname, "../../../../../fixtures/php-app");
const plugin = new PhpPlugin();

describe("PhpPlugin", () => {
  describe("analyze — app.php", () => {
    let entries: DependencyEntry[];

    beforeAll(async () => {
      const filePath = resolve(fixturesRoot, "app.php");
      const source = await readFile(filePath, "utf-8");
      entries = await plugin.analyze({
        filePath,
        source,
        scanRoot: fixturesRoot,
        resolvedEnv: {},
      });
    });

    it("detects Guzzle GET call", () => {
      const getCall = entries.find(
        (e) => e.kind === "api" && e.method === "GET" && e.url.includes("stripe.com"),
      );
      expect(getCall).toBeDefined();
      expect(getCall!.confidence).toBe("high");
    });

    it("detects Guzzle POST call", () => {
      const postCall = entries.find(
        (e) => e.kind === "api" && e.method === "POST" && e.url.includes("example.com/orders"),
      );
      expect(postCall).toBeDefined();
    });

    it("detects ->request() with PUT method", () => {
      const putCall = entries.find(
        (e) => e.kind === "api" && e.method === "PUT" && e.url.includes("openai.com"),
      );
      expect(putCall).toBeDefined();
    });

    it("detects curl_init URL", () => {
      const curlCall = entries.find(
        (e) => e.kind === "api" && e.url.includes("api.example.com/users"),
      );
      expect(curlCall).toBeDefined();
    });

    it("detects curl_setopt CURLOPT_URL", () => {
      const curlUrl = entries.find(
        (e) => e.kind === "api" && e.url.includes("api.weather.io"),
      );
      expect(curlUrl).toBeDefined();
    });

    it("detects file_get_contents HTTP URL", () => {
      const fgc = entries.find(
        (e) => e.kind === "api" && e.url.includes("api.example.com/data"),
      );
      expect(fgc).toBeDefined();
    });

    it("detects Laravel Http::get", () => {
      const laravelGet = entries.find(
        (e) => e.kind === "api" && e.method === "GET" && e.url.includes("api.example.com/users"),
      );
      expect(laravelGet).toBeDefined();
    });

    it("detects Laravel Http::post", () => {
      const laravelPost = entries.find(
        (e) => e.kind === "api" && e.method === "POST" && e.url.includes("api.example.com/orders"),
      );
      expect(laravelPost).toBeDefined();
    });

    it("detects Stripe SDK", () => {
      const stripe = entries.find(
        (e) => e.kind === "sdk" && e.provider === "stripe",
      );
      expect(stripe).toBeDefined();
    });

    it("detects AWS SDK", () => {
      const aws = entries.find(
        (e) => e.kind === "sdk" && e.provider === "aws",
      );
      expect(aws).toBeDefined();
    });

    it("detects Twilio SDK from use import", () => {
      const twilio = entries.find(
        (e) => e.kind === "sdk" && e.provider === "twilio",
      );
      expect(twilio).toBeDefined();
    });

    it("detects MySQL via PDO", () => {
      const mysql = entries.find(
        (e) => e.kind === "infrastructure" && e.type === "mysql",
      );
      expect(mysql).toBeDefined();
    });

    it("detects PostgreSQL via PDO", () => {
      const pg = entries.find(
        (e) => e.kind === "infrastructure" && e.type === "postgresql",
      );
      expect(pg).toBeDefined();
    });

    it("detects Redis via Predis", () => {
      const redis = entries.find(
        (e) => e.kind === "infrastructure" && e.type === "redis",
      );
      expect(redis).toBeDefined();
    });

    it("detects MongoDB", () => {
      const mongo = entries.find(
        (e) => e.kind === "infrastructure" && e.type === "mongodb",
      );
      expect(mongo).toBeDefined();
    });

    it("redacts credentials from MongoDB connection string", () => {
      const mongo = entries.find(
        (e) => e.kind === "infrastructure" && e.type === "mongodb",
      );
      expect(mongo).toBeDefined();
      if (mongo && mongo.kind === "infrastructure") {
        expect(mongo.connection_ref).not.toContain("user:pass");
        expect(mongo.connection_ref).toContain("<redacted>");
      }
    });

    it("detects Laravel DB facade", () => {
      const db = entries.find(
        (e) => e.kind === "infrastructure" && e.type === "database",
      );
      expect(db).toBeDefined();
    });

    it("deduplicates SDK entries by provider", () => {
      const sdks = entries.filter((e) => e.kind === "sdk");
      const providerCounts = new Map<string, number>();
      for (const e of sdks) {
        if (e.kind === "sdk") {
          providerCounts.set(e.provider, (providerCounts.get(e.provider) ?? 0) + 1);
        }
      }
      for (const [provider, count] of providerCounts) {
        expect(count, `provider "${provider}" should appear once, got ${count}`).toBe(1);
      }
    });

    it("produces ≥10 distinct dependency entries", () => {
      expect(entries.length).toBeGreaterThanOrEqual(10);
    });
  });
});
