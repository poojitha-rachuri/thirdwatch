import { describe, it, expect, beforeAll } from "vitest";
import { resolve } from "node:path";
import type { DependencyEntry } from "@thirdwatch/core";
import { PhpPlugin } from "../index.js";

const fixturesRoot = resolve(__dirname, "../../../../../fixtures/php-app");
const plugin = new PhpPlugin();

describe("PhpPlugin", () => {
  describe("analyzeManifests", () => {
    let entries: DependencyEntry[];

    beforeAll(async () => {
      const manifestFile = resolve(fixturesRoot, "composer.json");
      entries = await plugin.analyzeManifests([manifestFile], fixturesRoot);
    });

    it("parses composer.json require dependencies", () => {
      // 5 from require (php and ext-mbstring excluded) + 1 from require-dev = 6
      expect(entries.length).toBe(6);
    });

    it("detects Stripe PHP package", () => {
      const stripe = entries.find((e) => e.kind === "package" && e.name === "stripe/stripe-php");
      expect(stripe).toBeDefined();
      if (stripe && stripe.kind === "package") {
        expect(stripe.ecosystem).toBe("packagist");
        expect(stripe.current_version).toBe("13.0");
        expect(stripe.version_constraint).toBe("^13.0");
      }
    });

    it("excludes php version constraint entry", () => {
      const php = entries.find((e) => e.kind === "package" && e.name === "php");
      expect(php).toBeUndefined();
    });

    it("excludes ext-* entries (e.g. ext-mbstring)", () => {
      const ext = entries.find((e) => e.kind === "package" && e.name.startsWith("ext-"));
      expect(ext).toBeUndefined();
    });

    it("sets ecosystem to packagist", () => {
      for (const entry of entries) {
        if (entry.kind === "package") {
          expect(entry.ecosystem).toBe("packagist");
        }
      }
    });

    it("ignores non-composer.json files", async () => {
      const result = await plugin.analyzeManifests(
        [resolve(fixturesRoot, "package.json")],
        fixturesRoot,
      );
      expect(result.length).toBe(0);
    });
  });
});
