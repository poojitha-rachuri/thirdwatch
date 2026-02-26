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
        (e) => e.kind === "api" && e.method === "POST" && e.url === "https://api.example.com/orders",
      );
      expect(postCall).toBeDefined();
    });

    it("detects ->request() with PUT method", () => {
      const putCall = entries.find(
        (e) => e.kind === "api" && e.method === "PUT" && e.url.includes("openai.com"),
      );
      expect(putCall).toBeDefined();
    });

    it("detects base_uri config", () => {
      const baseUri = entries.find(
        (e) => e.kind === "api" && e.url === "https://api.payments.io",
      );
      expect(baseUri).toBeDefined();
    });

    it("detects curl_init URL", () => {
      const curlCall = entries.find(
        (e) => e.kind === "api" && e.url === "https://api.example.com/users",
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
        (e) => e.kind === "api" && e.url === "https://api.example.com/data",
      );
      expect(fgc).toBeDefined();
    });

    it("does NOT detect non-HTTP file_get_contents", () => {
      const localFgc = entries.find(
        (e) => e.kind === "api" && e.url === "/var/www/config.json",
      );
      expect(localFgc).toBeUndefined();
    });

    it("detects Laravel Http::get with distinct URL", () => {
      const laravelGet = entries.find(
        (e) => e.kind === "api" && e.method === "GET" && e.url === "https://api.laravel-users.io/list",
      );
      expect(laravelGet).toBeDefined();
    });

    it("detects Laravel Http::post with distinct URL", () => {
      const laravelPost = entries.find(
        (e) => e.kind === "api" && e.method === "POST" && e.url === "https://api.laravel-orders.io/submit",
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

    it("detects SendGrid SDK", () => {
      const sg = entries.find(
        (e) => e.kind === "sdk" && e.provider === "sendgrid",
      );
      expect(sg).toBeDefined();
    });

    it("detects Sentry SDK", () => {
      const sentry = entries.find(
        (e) => e.kind === "sdk" && e.provider === "sentry",
      );
      expect(sentry).toBeDefined();
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

    it("redacts credentials from MongoDB connection_ref", () => {
      const mongo = entries.find(
        (e) => e.kind === "infrastructure" && e.type === "mongodb",
      );
      expect(mongo).toBeDefined();
      if (mongo && mongo.kind === "infrastructure") {
        expect(mongo.connection_ref).not.toContain("user:pass");
        expect(mongo.connection_ref).toContain("<redacted>");
      }
    });

    it("redacts credentials from MongoDB context field", () => {
      const mongo = entries.find(
        (e) => e.kind === "infrastructure" && e.type === "mongodb",
      );
      expect(mongo).toBeDefined();
      if (mongo) {
        for (const loc of mongo.locations) {
          expect(loc.context).not.toContain("user:pass");
        }
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

    it("does not emit false SDK entries from commented-out use statements", async () => {
      const source = `<?php
// use Stripe\\Charge;
# use Aws\\S3\\S3Client;
/* use Twilio\\Rest\\Client; */
echo 'hello';`;
      const result = await plugin.analyze({
        filePath: resolve(fixturesRoot, "app.php"),
        source,
        scanRoot: fixturesRoot,
        resolvedEnv: {},
      });
      const sdks = result.filter((e) => e.kind === "sdk");
      expect(sdks).toHaveLength(0);
    });

    it("detects SDK from grouped use imports", async () => {
      const source = `<?php
use Stripe\\{Charge, PaymentIntent};
echo 'hello';`;
      const result = await plugin.analyze({
        filePath: resolve(fixturesRoot, "app.php"),
        source,
        scanRoot: fixturesRoot,
        resolvedEnv: {},
      });
      const stripe = result.find((e) => e.kind === "sdk" && e.provider === "stripe");
      expect(stripe).toBeDefined();
    });

    it("use import SDK entry has accurate line number (not always 1)", async () => {
      const source = `<?php
// line 2 is a comment
// line 3 is a comment
use Stripe\\Charge;
echo 'hello';`;
      const result = await plugin.analyze({
        filePath: resolve(fixturesRoot, "app.php"),
        source,
        scanRoot: fixturesRoot,
        resolvedEnv: {},
      });
      const stripe = result.find((e) => e.kind === "sdk" && e.provider === "stripe");
      expect(stripe).toBeDefined();
      if (stripe) {
        // use Stripe\Charge is on line 4
        expect(stripe.locations[0]?.line).toBe(4);
      }
    });
  });
});
