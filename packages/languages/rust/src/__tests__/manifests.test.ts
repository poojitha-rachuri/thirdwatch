import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { RustPlugin } from "../index.js";

const fixturesRoot = resolve(__dirname, "../../../../../fixtures/rust-app");
const plugin = new RustPlugin();

describe("RustPlugin", () => {
  describe("analyzeManifests", () => {
    it("parses Cargo.toml dependencies", async () => {
      const manifestFile = resolve(fixturesRoot, "Cargo.toml");
      const entries = await plugin.analyzeManifests!([manifestFile], fixturesRoot);

      expect(entries.length).toBeGreaterThanOrEqual(8);
      const reqwest = entries.find((e) => e.kind === "package" && e.name === "reqwest");
      expect(reqwest).toBeDefined();
      if (reqwest && reqwest.kind === "package") {
        expect(reqwest.ecosystem).toBe("cargo");
        expect(reqwest.current_version).toBe("0.11");
      }
    });

    it("parses inline table dependencies with version", async () => {
      const manifestFile = resolve(fixturesRoot, "Cargo.toml");
      const entries = await plugin.analyzeManifests!([manifestFile], fixturesRoot);

      const sqlx = entries.find((e) => e.kind === "package" && e.name === "sqlx");
      expect(sqlx).toBeDefined();
      if (sqlx && sqlx.kind === "package") {
        expect(sqlx.current_version).toBe("0.7");
      }
    });

    it("parses simple string dependencies", async () => {
      const manifestFile = resolve(fixturesRoot, "Cargo.toml");
      const entries = await plugin.analyzeManifests!([manifestFile], fixturesRoot);

      const redis = entries.find((e) => e.kind === "package" && e.name === "redis");
      expect(redis).toBeDefined();
      if (redis && redis.kind === "package") {
        expect(redis.current_version).toBe("0.24");
      }
    });

    it("parses dev-dependencies", async () => {
      const manifestFile = resolve(fixturesRoot, "Cargo.toml");
      const entries = await plugin.analyzeManifests!([manifestFile], fixturesRoot);

      const tokioTest = entries.find((e) => e.kind === "package" && e.name === "tokio-test");
      expect(tokioTest).toBeDefined();
    });

    it("parses build-dependencies", async () => {
      const manifestFile = resolve(fixturesRoot, "Cargo.toml");
      const entries = await plugin.analyzeManifests!([manifestFile], fixturesRoot);

      const tonicBuild = entries.find((e) => e.kind === "package" && e.name === "tonic-build");
      expect(tonicBuild).toBeDefined();
    });

    it("sets ecosystem to cargo", async () => {
      const manifestFile = resolve(fixturesRoot, "Cargo.toml");
      const entries = await plugin.analyzeManifests!([manifestFile], fixturesRoot);

      for (const entry of entries) {
        if (entry.kind === "package") {
          expect(entry.ecosystem).toBe("cargo");
        }
      }
    });

    it("ignores non-Cargo.toml files", async () => {
      const entries = await plugin.analyzeManifests!(
        [resolve(fixturesRoot, "package.json")],
        fixturesRoot,
      );
      expect(entries.length).toBe(0);
    });
  });
});
