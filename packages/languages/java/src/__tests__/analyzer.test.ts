import { describe, it, expect, beforeAll } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { DependencyEntry } from "@thirdwatch/core";
import { JavaPlugin } from "../index.js";

const fixturesRoot = resolve(__dirname, "../../../../../fixtures/java-app");
const plugin = new JavaPlugin();

describe("JavaPlugin", () => {
  describe("analyze — App.java", () => {
    let entries: DependencyEntry[];

    beforeAll(async () => {
      const filePath = resolve(fixturesRoot, "src/main/java/com/example/App.java");
      const source = await readFile(filePath, "utf-8");
      entries = await plugin.analyze({
        filePath,
        source,
        scanRoot: fixturesRoot,
        resolvedEnv: {},
      });
    });

    it("detects HTTP call via URI.create", () => {
      const apiCall = entries.find(
        (e) => e.kind === "api" && e.url.includes("api.stripe.com"),
      );
      expect(apiCall).toBeDefined();
      expect(apiCall!.confidence).toBe("high");
    });

    it("detects AWS S3 SDK via S3Client.builder()", () => {
      const awsSDK = entries.find(
        (e) => e.kind === "sdk" && e.provider === "aws",
      );
      expect(awsSDK).toBeDefined();
      if (awsSDK && awsSDK.kind === "sdk") {
        expect(awsSDK.services_used).toContain("s3");
      }
    });

    it("detects Stripe SDK via Charge.create()", () => {
      const stripeSDK = entries.find(
        (e) => e.kind === "sdk" && e.provider === "stripe",
      );
      expect(stripeSDK).toBeDefined();
    });

    it("detects Firebase SDK via FirebaseApp.initializeApp()", () => {
      const firebaseSDK = entries.find(
        (e) => e.kind === "sdk" && e.provider === "firebase",
      );
      expect(firebaseSDK).toBeDefined();
    });

    it("detects PostgreSQL via DriverManager.getConnection with JDBC URL", () => {
      const pg = entries.find(
        (e) => e.kind === "infrastructure" && e.type === "postgresql",
      );
      expect(pg).toBeDefined();
    });

    it("detects Redis via new Jedis()", () => {
      const redis = entries.find(
        (e) => e.kind === "infrastructure" && e.type === "redis",
      );
      expect(redis).toBeDefined();
    });

    it("detects Kafka via KafkaProducer", () => {
      const kafka = entries.find(
        (e) => e.kind === "infrastructure" && e.type === "kafka",
      );
      expect(kafka).toBeDefined();
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

    it("produces ≥5 distinct dependency entries", () => {
      expect(entries.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe("analyze — ApiClient.java", () => {
    let entries: DependencyEntry[];

    beforeAll(async () => {
      const filePath = resolve(fixturesRoot, "src/main/java/com/example/ApiClient.java");
      const source = await readFile(filePath, "utf-8");
      entries = await plugin.analyze({
        filePath,
        source,
        scanRoot: fixturesRoot,
        resolvedEnv: {},
      });
    });

    it("detects RestTemplate GET call", () => {
      const getCall = entries.find(
        (e) => e.kind === "api" && e.method === "GET" && e.url.includes("api.example.com/users"),
      );
      expect(getCall).toBeDefined();
    });

    it("detects RestTemplate POST call", () => {
      const postCall = entries.find(
        (e) => e.kind === "api" && e.method === "POST" && e.url.includes("api.example.com/orders"),
      );
      expect(postCall).toBeDefined();
    });

    it("detects WebClient GET call", () => {
      const getCall = entries.find(
        (e) => e.kind === "api" && e.method === "GET" && e.url.includes("api.example.com/products"),
      );
      expect(getCall).toBeDefined();
    });

    it("detects WebClient POST call", () => {
      const postCall = entries.find(
        (e) => e.kind === "api" && e.method === "POST" && e.url.includes("api.example.com/checkout"),
      );
      expect(postCall).toBeDefined();
    });

    it("detects @FeignClient URL", () => {
      const feignCall = entries.find(
        (e) => e.kind === "api" && e.url.includes("api.stripe.com"),
      );
      expect(feignCall).toBeDefined();
    });

    it("detects @PostMapping annotation", () => {
      const postMapping = entries.find(
        (e) => e.kind === "api" && e.method === "POST" && e.url.includes("/v1/charges"),
      );
      expect(postMapping).toBeDefined();
    });

    it("detects @GetMapping annotation", () => {
      const getMapping = entries.find(
        (e) => e.kind === "api" && e.method === "GET" && e.url.includes("/v1/customers"),
      );
      expect(getMapping).toBeDefined();
    });
  });

  describe("handles .kt files", () => {
    it("reports .kt in extensions", () => {
      expect(plugin.extensions).toContain(".kt");
    });

    it("reports .java in extensions", () => {
      expect(plugin.extensions).toContain(".java");
    });
  });
});
