import { describe, it, expect, beforeAll } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { DependencyEntry } from "@thirdwatch/core";
import { RustPlugin } from "../index.js";

const fixturesRoot = resolve(__dirname, "../../../../../fixtures/rust-app");
const plugin = new RustPlugin();

describe("RustPlugin", () => {
  describe("analyze — src/main.rs", () => {
    let entries: DependencyEntry[];

    beforeAll(async () => {
      const filePath = resolve(fixturesRoot, "src/main.rs");
      const source = await readFile(filePath, "utf-8");
      entries = await plugin.analyze({
        filePath,
        source,
        scanRoot: fixturesRoot,
        resolvedEnv: {},
      });
    });

    it("detects reqwest::get HTTP call", () => {
      const getCall = entries.find(
        (e) => e.kind === "api" && e.method === "GET" && e.url.includes("stripe.com"),
      );
      expect(getCall).toBeDefined();
      expect(getCall!.confidence).toBe("high");
    });

    it("detects client.post HTTP call", () => {
      const postCall = entries.find(
        (e) => e.kind === "api" && e.method === "POST" && e.url.includes("openai.com"),
      );
      expect(postCall).toBeDefined();
    });

    it("detects AWS SDK via aws_sdk_s3::Client::new", () => {
      const awsSDK = entries.find(
        (e) => e.kind === "sdk" && e.provider === "aws" && e.services_used?.includes("s3"),
      );
      expect(awsSDK).toBeDefined();
    });

    it("detects Stripe SDK via stripe::Charge", () => {
      const stripeSDK = entries.find(
        (e) => e.kind === "sdk" && e.provider === "stripe",
      );
      expect(stripeSDK).toBeDefined();
    });

    it("detects OpenAI SDK via async_openai::Client::new", () => {
      const openaiSDK = entries.find(
        (e) => e.kind === "sdk" && e.provider === "openai",
      );
      expect(openaiSDK).toBeDefined();
    });

    it("detects PostgreSQL via PgPool::connect", () => {
      const pg = entries.find((e) => e.kind === "infrastructure" && e.type === "postgresql");
      expect(pg).toBeDefined();
    });

    it("detects Redis via redis::Client::open", () => {
      const redis = entries.find((e) => e.kind === "infrastructure" && e.type === "redis");
      expect(redis).toBeDefined();
    });

    it("redacts credentials from connection strings", () => {
      const pg = entries.find((e) => e.kind === "infrastructure" && e.type === "postgresql");
      expect(pg).toBeDefined();
      if (pg && pg.kind === "infrastructure") {
        expect(pg.connection_ref).not.toContain("user:pass");
        expect(pg.connection_ref).toContain("<redacted>");
      }
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

    it("handles use ... as aliasing", () => {
      // S3Client alias maps to aws_sdk_s3::Client, should trigger aws SDK
      const awsSDK = entries.find((e) => e.kind === "sdk" && e.provider === "aws");
      expect(awsSDK).toBeDefined();
    });

    it("produces ≥5 distinct dependency entries", () => {
      expect(entries.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe("analyze — src/handler.rs", () => {
    let entries: DependencyEntry[];

    beforeAll(async () => {
      const filePath = resolve(fixturesRoot, "src/handler.rs");
      const source = await readFile(filePath, "utf-8");
      entries = await plugin.analyze({
        filePath,
        source,
        scanRoot: fixturesRoot,
        resolvedEnv: {},
      });
    });

    it("detects ureq GET call", () => {
      const getCall = entries.find(
        (e) => e.kind === "api" && e.url.includes("api.example.com/users"),
      );
      expect(getCall).toBeDefined();
      if (getCall && getCall.kind === "api") {
        expect(getCall.method).toBe("GET");
      }
    });

    it("detects ureq POST call", () => {
      const postCall = entries.find(
        (e) => e.kind === "api" && e.url.includes("api.example.com/orders"),
      );
      expect(postCall).toBeDefined();
      if (postCall && postCall.kind === "api") {
        expect(postCall.method).toBe("POST");
      }
    });

    it("detects hyper builder URI", () => {
      const webhookCall = entries.find(
        (e) => e.kind === "api" && e.url.includes("api.example.com/webhook"),
      );
      expect(webhookCall).toBeDefined();
    });

    it("detects MongoDB via mongodb::Client::with_uri_str", () => {
      const mongo = entries.find((e) => e.kind === "infrastructure" && e.type === "mongodb");
      expect(mongo).toBeDefined();
    });

    it("detects Kafka via FutureProducer with correct broker address", () => {
      const kafka = entries.filter((e) => e.kind === "infrastructure" && e.type === "kafka");
      expect(kafka.length).toBe(1);
      if (kafka[0] && kafka[0].kind === "infrastructure") {
        expect(kafka[0].connection_ref).toBe("localhost:9092");
        expect(kafka[0].connection_ref).not.toBe("bootstrap.servers");
      }
    });

    it("redacts MongoDB credentials", () => {
      const mongo = entries.find((e) => e.kind === "infrastructure" && e.type === "mongodb");
      expect(mongo).toBeDefined();
      if (mongo && mongo.kind === "infrastructure") {
        expect(mongo.connection_ref).not.toContain("user:pass");
        expect(mongo.connection_ref).toContain("<redacted>");
      }
    });
  });
});
