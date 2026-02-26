import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { JavaScriptPlugin } from "../index.js";

const fixturesRoot = resolve(__dirname, "../../../../../fixtures/node-app");
const plugin = new JavaScriptPlugin();

describe("parseManifests", () => {
  describe("package.json", () => {
    it("parses dependencies from package.json", async () => {
      const entries = await plugin.analyzeManifests!(
        [resolve(fixturesRoot, "package.json")],
        fixturesRoot,
      );

      expect(entries.length).toBeGreaterThan(0);

      const stripe = entries.find(
        (e) => e.kind === "package" && e.name === "stripe",
      );
      expect(stripe).toBeDefined();
      if (stripe?.kind === "package") {
        expect(stripe.ecosystem).toBe("npm");
        expect(stripe.confidence).toBe("high");
      }
    });
  });

  describe("yarn.lock", () => {
    it("parses v1 format", async () => {
      const entries = await plugin.analyzeManifests!(
        [resolve(fixturesRoot, "yarn.lock")],
        fixturesRoot,
      );

      expect(entries).toHaveLength(3);

      const stripe = entries.find(
        (e) => e.kind === "package" && e.name === "stripe",
      );
      expect(stripe).toBeDefined();
      if (stripe?.kind === "package") {
        expect(stripe.current_version).toBe("7.1.0");
        expect(stripe.ecosystem).toBe("npm");
        expect(stripe.manifest_file).toBe("yarn.lock");
        expect(stripe.confidence).toBe("high");
      }
    });

    it("handles scoped packages", async () => {
      const entries = await plugin.analyzeManifests!(
        [resolve(fixturesRoot, "yarn.lock")],
        fixturesRoot,
      );

      const awsS3 = entries.find(
        (e) => e.kind === "package" && e.name === "@aws-sdk/client-s3",
      );
      expect(awsS3).toBeDefined();
      if (awsS3?.kind === "package") {
        expect(awsS3.current_version).toBe("3.500.0");
      }
    });

    it("deduplicates entries by name", async () => {
      const entries = await plugin.analyzeManifests!(
        [resolve(fixturesRoot, "yarn.lock")],
        fixturesRoot,
      );

      const names = entries
        .filter((e) => e.kind === "package")
        .map((e) => (e.kind === "package" ? e.name : ""));
      const unique = new Set(names);
      expect(names.length).toBe(unique.size);
    });
  });

  describe("pnpm-lock.yaml", () => {
    it("parses packages with name@version keys", async () => {
      const entries = await plugin.analyzeManifests!(
        [resolve(fixturesRoot, "pnpm-lock.yaml")],
        fixturesRoot,
      );

      expect(entries).toHaveLength(3);

      const stripe = entries.find(
        (e) => e.kind === "package" && e.name === "stripe",
      );
      expect(stripe).toBeDefined();
      if (stripe?.kind === "package") {
        expect(stripe.current_version).toBe("7.1.0");
        expect(stripe.ecosystem).toBe("npm");
        expect(stripe.manifest_file).toBe("pnpm-lock.yaml");
        expect(stripe.confidence).toBe("high");
      }
    });

    it("handles scoped packages", async () => {
      const entries = await plugin.analyzeManifests!(
        [resolve(fixturesRoot, "pnpm-lock.yaml")],
        fixturesRoot,
      );

      const awsS3 = entries.find(
        (e) => e.kind === "package" && e.name === "@aws-sdk/client-s3",
      );
      expect(awsS3).toBeDefined();
      if (awsS3?.kind === "package") {
        expect(awsS3.current_version).toBe("3.500.0");
      }
    });
  });

  describe("package-lock.json", () => {
    it("parses v3 format", async () => {
      const entries = await plugin.analyzeManifests!(
        [resolve(fixturesRoot, "package-lock.json")],
        fixturesRoot,
      );

      expect(entries).toHaveLength(3);

      const stripe = entries.find(
        (e) => e.kind === "package" && e.name === "stripe",
      );
      expect(stripe).toBeDefined();
      if (stripe?.kind === "package") {
        expect(stripe.current_version).toBe("7.1.0");
        expect(stripe.ecosystem).toBe("npm");
        expect(stripe.manifest_file).toBe("package-lock.json");
        expect(stripe.confidence).toBe("high");
      }
    });

    it("skips root entry", async () => {
      const entries = await plugin.analyzeManifests!(
        [resolve(fixturesRoot, "package-lock.json")],
        fixturesRoot,
      );

      const root = entries.find(
        (e) => e.kind === "package" && e.name === "node-app",
      );
      expect(root).toBeUndefined();
    });

    it("handles scoped packages", async () => {
      const entries = await plugin.analyzeManifests!(
        [resolve(fixturesRoot, "package-lock.json")],
        fixturesRoot,
      );

      const awsS3 = entries.find(
        (e) => e.kind === "package" && e.name === "@aws-sdk/client-s3",
      );
      expect(awsS3).toBeDefined();
      if (awsS3?.kind === "package") {
        expect(awsS3.current_version).toBe("3.500.0");
      }
    });
  });

  describe("deno.json", () => {
    it("parses npm: imports", async () => {
      const entries = await plugin.analyzeManifests!(
        [resolve(fixturesRoot, "deno.json")],
        fixturesRoot,
      );

      const stripe = entries.find(
        (e) => e.kind === "package" && e.name === "stripe",
      );
      expect(stripe).toBeDefined();
      if (stripe?.kind === "package") {
        expect(stripe.ecosystem).toBe("npm");
        expect(stripe.current_version).toBe("7.0.0");
        expect(stripe.version_constraint).toBe("^7.0.0");
        expect(stripe.manifest_file).toBe("deno.json");
        expect(stripe.confidence).toBe("high");
      }
    });

    it("parses jsr: imports", async () => {
      const entries = await plugin.analyzeManifests!(
        [resolve(fixturesRoot, "deno.json")],
        fixturesRoot,
      );

      const stdHttp = entries.find(
        (e) => e.kind === "package" && e.name === "@std/http",
      );
      expect(stdHttp).toBeDefined();
      if (stdHttp?.kind === "package") {
        expect(stdHttp.ecosystem).toBe("jsr");
        expect(stdHttp.current_version).toBe("0.224.0");
        expect(stdHttp.version_constraint).toBe("^0.224.0");
      }
    });

    it("parses deno.land URL imports", async () => {
      const entries = await plugin.analyzeManifests!(
        [resolve(fixturesRoot, "deno.json")],
        fixturesRoot,
      );

      const oak = entries.find(
        (e) => e.kind === "package" && e.name === "oak",
      );
      expect(oak).toBeDefined();
      if (oak?.kind === "package") {
        expect(oak.ecosystem).toBe("deno");
        expect(oak.current_version).toBe("v12.6.1");
        expect(oak.version_constraint).toBe("v12.6.1");
      }
    });
  });
});
