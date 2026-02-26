import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { PhpPlugin } from "../index.js";

const fixturesRoot = resolve(__dirname, "../../../../../fixtures/php-app");
const plugin = new PhpPlugin();

describe("PhpPlugin", () => {
  describe("analyzeManifests", () => {
    it("parses composer.json require dependencies", async () => {
      const manifestFile = resolve(fixturesRoot, "composer.json");
      const entries = await plugin.analyzeManifests([manifestFile], fixturesRoot);

      // 5 from require + 1 from require-dev = 6 (php and ext-* are excluded)
      expect(entries.length).toBe(6);
    });

    it("detects Stripe PHP package", async () => {
      const manifestFile = resolve(fixturesRoot, "composer.json");
      const entries = await plugin.analyzeManifests([manifestFile], fixturesRoot);

      const stripe = entries.find((e) => e.kind === "package" && e.name === "stripe/stripe-php");
      expect(stripe).toBeDefined();
      if (stripe && stripe.kind === "package") {
        expect(stripe.ecosystem).toBe("packagist");
        expect(stripe.current_version).toBe("13.0");
        expect(stripe.version_constraint).toBe("^13.0");
      }
    });

    it("excludes php and ext-* entries", async () => {
      const manifestFile = resolve(fixturesRoot, "composer.json");
      const entries = await plugin.analyzeManifests([manifestFile], fixturesRoot);

      const php = entries.find((e) => e.kind === "package" && e.name === "php");
      expect(php).toBeUndefined();
    });

    it("sets ecosystem to packagist", async () => {
      const manifestFile = resolve(fixturesRoot, "composer.json");
      const entries = await plugin.analyzeManifests([manifestFile], fixturesRoot);

      for (const entry of entries) {
        if (entry.kind === "package") {
          expect(entry.ecosystem).toBe("packagist");
        }
      }
    });

    it("ignores non-composer.json files", async () => {
      const entries = await plugin.analyzeManifests(
        [resolve(fixturesRoot, "package.json")],
        fixturesRoot,
      );
      expect(entries.length).toBe(0);
    });
  });
});
