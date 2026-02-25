import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { GoPlugin } from "../index.js";

const fixturesRoot = resolve(__dirname, "../../../../../fixtures/go-app");
const plugin = new GoPlugin();

describe("GoPlugin", () => {
  describe("analyzeManifests", () => {
    it("parses go.mod direct dependencies", async () => {
      const manifestFile = resolve(fixturesRoot, "go.mod");
      const entries = await plugin.analyzeManifests([manifestFile], fixturesRoot);

      expect(entries.length).toBe(6);
      const stripe = entries.find((e) => e.kind === "package" && e.name.includes("stripe-go"));
      expect(stripe).toBeDefined();
      if (stripe && stripe.kind === "package") {
        expect(stripe.ecosystem).toBe("go");
        expect(stripe.current_version).toBe("v78.1.0");
        expect(stripe.version_constraint).toBe(">= v78.1.0");
      }
    });

    it("excludes indirect dependencies", async () => {
      const manifestFile = resolve(fixturesRoot, "go.mod");
      const entries = await plugin.analyzeManifests([manifestFile], fixturesRoot);

      const jmespath = entries.find((e) => e.kind === "package" && e.name.includes("jmespath"));
      expect(jmespath).toBeUndefined();

      const xxhash = entries.find((e) => e.kind === "package" && e.name.includes("xxhash"));
      expect(xxhash).toBeUndefined();
    });

    it("sets ecosystem to go", async () => {
      const manifestFile = resolve(fixturesRoot, "go.mod");
      const entries = await plugin.analyzeManifests([manifestFile], fixturesRoot);

      for (const entry of entries) {
        if (entry.kind === "package") {
          expect(entry.ecosystem).toBe("go");
        }
      }
    });

    it("ignores non-go.mod files", async () => {
      const entries = await plugin.analyzeManifests(
        [resolve(fixturesRoot, "requirements.txt")],
        fixturesRoot,
      );
      expect(entries.length).toBe(0);
    });
  });
});
