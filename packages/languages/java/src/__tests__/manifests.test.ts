import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { JavaPlugin } from "../index.js";

const fixturesRoot = resolve(__dirname, "../../../../../fixtures/java-app");
const plugin = new JavaPlugin();

describe("JavaPlugin", () => {
  describe("analyzeManifests — pom.xml", () => {
    it("parses Maven dependencies with property interpolation", async () => {
      const manifestFile = resolve(fixturesRoot, "pom.xml");
      const entries = await plugin.analyzeManifests!([manifestFile], fixturesRoot);

      const stripe = entries.find(
        (e) => e.kind === "package" && e.name === "com.stripe:stripe-java",
      );
      expect(stripe).toBeDefined();
      if (stripe && stripe.kind === "package") {
        expect(stripe.ecosystem).toBe("maven");
        expect(stripe.current_version).toBe("24.0.0");
      }
    });

    it("interpolates ${property} version references", async () => {
      const manifestFile = resolve(fixturesRoot, "pom.xml");
      const entries = await plugin.analyzeManifests!([manifestFile], fixturesRoot);

      const aws = entries.find(
        (e) => e.kind === "package" && e.name === "software.amazon.awssdk:s3",
      );
      expect(aws).toBeDefined();
      if (aws && aws.kind === "package") {
        expect(aws.current_version).toBe("2.21.0");
      }
    });

    it("excludes test-scoped dependencies", async () => {
      const manifestFile = resolve(fixturesRoot, "pom.xml");
      const entries = await plugin.analyzeManifests!([manifestFile], fixturesRoot);

      const junit = entries.find(
        (e) => e.kind === "package" && e.name === "junit:junit",
      );
      expect(junit).toBeUndefined();
    });

    it("parses inline versions", async () => {
      const manifestFile = resolve(fixturesRoot, "pom.xml");
      const entries = await plugin.analyzeManifests!([manifestFile], fixturesRoot);

      const pg = entries.find(
        (e) => e.kind === "package" && e.name === "org.postgresql:postgresql",
      );
      expect(pg).toBeDefined();
      if (pg && pg.kind === "package") {
        expect(pg.current_version).toBe("42.7.1");
      }
    });
  });

  describe("analyzeManifests — build.gradle", () => {
    it("parses Groovy DSL string-notation dependencies", async () => {
      const manifestFile = resolve(fixturesRoot, "build.gradle");
      const entries = await plugin.analyzeManifests!([manifestFile], fixturesRoot);

      const stripe = entries.find(
        (e) => e.kind === "package" && e.name === "com.stripe:stripe-java",
      );
      expect(stripe).toBeDefined();
      if (stripe && stripe.kind === "package") {
        expect(stripe.current_version).toBe("24.0.0");
      }
    });

    it("parses Groovy map-notation dependencies", async () => {
      const manifestFile = resolve(fixturesRoot, "build.gradle");
      const entries = await plugin.analyzeManifests!([manifestFile], fixturesRoot);

      const pg = entries.find(
        (e) => e.kind === "package" && e.name === "org.postgresql:postgresql",
      );
      expect(pg).toBeDefined();
      if (pg && pg.kind === "package") {
        expect(pg.current_version).toBe("42.7.1");
      }
    });

    it("skips testImplementation dependencies", async () => {
      const manifestFile = resolve(fixturesRoot, "build.gradle");
      const entries = await plugin.analyzeManifests!([manifestFile], fixturesRoot);

      const junit = entries.find(
        (e) => e.kind === "package" && e.name === "junit:junit",
      );
      expect(junit).toBeUndefined();
    });
  });

  describe("analyzeManifests — libs.versions.toml", () => {
    it("parses version catalog with version.ref", async () => {
      const manifestFile = resolve(fixturesRoot, "gradle/libs.versions.toml");
      const entries = await plugin.analyzeManifests!([manifestFile], fixturesRoot);

      const stripe = entries.find(
        (e) => e.kind === "package" && e.name === "com.stripe:stripe-java",
      );
      expect(stripe).toBeDefined();
      if (stripe && stripe.kind === "package") {
        expect(stripe.current_version).toBe("24.0.0");
      }
    });

    it("parses version catalog with inline version", async () => {
      const manifestFile = resolve(fixturesRoot, "gradle/libs.versions.toml");
      const entries = await plugin.analyzeManifests!([manifestFile], fixturesRoot);

      const pg = entries.find(
        (e) => e.kind === "package" && e.name === "org.postgresql:postgresql",
      );
      expect(pg).toBeDefined();
      if (pg && pg.kind === "package") {
        expect(pg.current_version).toBe("42.7.1");
      }
    });
  });

  describe("analyzeManifests — ignores unrelated files", () => {
    it("ignores non-Java manifest files", async () => {
      const entries = await plugin.analyzeManifests!(
        [resolve(fixturesRoot, "requirements.txt")],
        fixturesRoot,
      );
      expect(entries.length).toBe(0);
    });
  });
});
