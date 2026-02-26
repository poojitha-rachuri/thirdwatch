import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { PythonPlugin } from "../index.js";

const fixturesRoot = resolve(__dirname, "../../../../../fixtures/python-app");
const plugin = new PythonPlugin();

describe("PythonPlugin", () => {
  describe("analyzeManifests", () => {
    // ----- requirements.txt -----

    it("parses requirements.txt", async () => {
      const manifestFile = resolve(fixturesRoot, "requirements.txt");
      const entries = await plugin.analyzeManifests!([manifestFile], fixturesRoot);

      expect(entries.length).toBe(10);
      const stripe = entries.find((e) => e.kind === "package" && e.name === "stripe");
      expect(stripe).toBeDefined();
      if (stripe && stripe.kind === "package") {
        expect(stripe.ecosystem).toBe("pypi");
        expect(stripe.current_version).toBe("7.9.0");
        expect(stripe.version_constraint).toBe("==7.9.0");
      }
    });

    // ----- pyproject.toml -----

    it("parses pyproject.toml PEP 621 [project.dependencies]", async () => {
      const manifestFile = resolve(fixturesRoot, "pyproject.toml");
      const entries = await plugin.analyzeManifests!([manifestFile], fixturesRoot);

      const stripe = entries.find((e) => e.kind === "package" && e.name === "stripe");
      expect(stripe).toBeDefined();
      if (stripe && stripe.kind === "package") {
        expect(stripe.ecosystem).toBe("pypi");
        expect(stripe.current_version).toBe("7.0.0");
        expect(stripe.version_constraint).toBe(">=7.0.0");
      }

      const boto3 = entries.find((e) => e.kind === "package" && e.name === "boto3");
      expect(boto3).toBeDefined();
      if (boto3 && boto3.kind === "package") {
        expect(boto3.version_constraint).toBe("~=1.34");
      }

      const redis = entries.find((e) => e.kind === "package" && e.name === "redis");
      expect(redis).toBeDefined();
      if (redis && redis.kind === "package") {
        expect(redis.version_constraint).toBe(">=5.0");
      }
    });

    it("parses pyproject.toml [project.optional-dependencies]", async () => {
      const manifestFile = resolve(fixturesRoot, "pyproject.toml");
      const entries = await plugin.analyzeManifests!([manifestFile], fixturesRoot);

      const pytest = entries.find((e) => e.kind === "package" && e.name === "pytest");
      expect(pytest).toBeDefined();
      if (pytest && pytest.kind === "package") {
        expect(pytest.version_constraint).toBe(">=7.0");
      }

      const black = entries.find((e) => e.kind === "package" && e.name === "black");
      expect(black).toBeDefined();
    });

    it("parses pyproject.toml Poetry [tool.poetry.dependencies] and skips python", async () => {
      const manifestFile = resolve(fixturesRoot, "pyproject.toml");
      const entries = await plugin.analyzeManifests!([manifestFile], fixturesRoot);

      const fastapi = entries.find((e) => e.kind === "package" && e.name === "fastapi");
      expect(fastapi).toBeDefined();
      if (fastapi && fastapi.kind === "package") {
        expect(fastapi.version_constraint).toBe("^0.104.0");
        expect(fastapi.current_version).toBe("0.104.0");
      }

      const uvicorn = entries.find((e) => e.kind === "package" && e.name === "uvicorn");
      expect(uvicorn).toBeDefined();
      if (uvicorn && uvicorn.kind === "package") {
        expect(uvicorn.version_constraint).toBe("^0.24.0");
      }

      const python = entries.find((e) => e.kind === "package" && e.name === "python");
      expect(python).toBeUndefined();
    });

    // ----- Pipfile -----

    it("parses Pipfile [packages] and [dev-packages]", async () => {
      const manifestFile = resolve(fixturesRoot, "Pipfile");
      const entries = await plugin.analyzeManifests!([manifestFile], fixturesRoot);

      expect(entries.length).toBe(6);

      const stripe = entries.find((e) => e.kind === "package" && e.name === "stripe");
      expect(stripe).toBeDefined();
      if (stripe && stripe.kind === "package") {
        expect(stripe.version_constraint).toBe(">=7.0");
      }

      const django = entries.find((e) => e.kind === "package" && e.name === "django");
      expect(django).toBeDefined();
      if (django && django.kind === "package") {
        expect(django.version_constraint).toBe("~=4.2");
      }

      const flake8 = entries.find((e) => e.kind === "package" && e.name === "flake8");
      expect(flake8).toBeDefined();
      if (flake8 && flake8.kind === "package") {
        expect(flake8.version_constraint).toBe(">=6.0");
      }
    });

    it("handles Pipfile wildcard '*' as unknown version", async () => {
      const manifestFile = resolve(fixturesRoot, "Pipfile");
      const entries = await plugin.analyzeManifests!([manifestFile], fixturesRoot);

      const boto3 = entries.find((e) => e.kind === "package" && e.name === "boto3");
      expect(boto3).toBeDefined();
      if (boto3 && boto3.kind === "package") {
        expect(boto3.current_version).toBe("unknown");
        expect(boto3.version_constraint).toBeUndefined();
      }
    });

    // ----- setup.py -----

    it("parses setup.py install_requires", async () => {
      const manifestFile = resolve(fixturesRoot, "setup.py");
      const entries = await plugin.analyzeManifests!([manifestFile], fixturesRoot);

      expect(entries.length).toBe(3);

      const stripe = entries.find((e) => e.kind === "package" && e.name === "stripe");
      expect(stripe).toBeDefined();
      if (stripe && stripe.kind === "package") {
        expect(stripe.version_constraint).toBe(">=7.0");
      }

      const requests = entries.find((e) => e.kind === "package" && e.name === "requests");
      expect(requests).toBeDefined();
    });

    // ----- setup.cfg -----

    it("parses setup.cfg install_requires", async () => {
      const manifestFile = resolve(fixturesRoot, "setup.cfg");
      const entries = await plugin.analyzeManifests!([manifestFile], fixturesRoot);

      expect(entries.length).toBe(3);

      const stripe = entries.find((e) => e.kind === "package" && e.name === "stripe");
      expect(stripe).toBeDefined();
      if (stripe && stripe.kind === "package") {
        expect(stripe.version_constraint).toBe(">=7.0");
      }

      const boto3 = entries.find((e) => e.kind === "package" && e.name === "boto3");
      expect(boto3).toBeDefined();
      if (boto3 && boto3.kind === "package") {
        expect(boto3.version_constraint).toBe("~=1.34");
      }
    });

    // ----- environment.yml -----

    it("parses conda environment.yml dependencies", async () => {
      const manifestFile = resolve(fixturesRoot, "environment.yml");
      const entries = await plugin.analyzeManifests!([manifestFile], fixturesRoot);

      const numpy = entries.find((e) => e.kind === "package" && e.name === "numpy");
      expect(numpy).toBeDefined();
      if (numpy && numpy.kind === "package") {
        expect(numpy.ecosystem).toBe("conda");
        expect(numpy.version_constraint).toBe("=1.26");
      }

      const pandas = entries.find((e) => e.kind === "package" && e.name === "pandas");
      expect(pandas).toBeDefined();
      if (pandas && pandas.kind === "package") {
        expect(pandas.ecosystem).toBe("conda");
        expect(pandas.version_constraint).toBe(">=2.0");
      }
    });

    it("parses conda environment.yml pip sub-deps with pypi ecosystem", async () => {
      const manifestFile = resolve(fixturesRoot, "environment.yml");
      const entries = await plugin.analyzeManifests!([manifestFile], fixturesRoot);

      const stripe = entries.find((e) => e.kind === "package" && e.name === "stripe");
      expect(stripe).toBeDefined();
      if (stripe && stripe.kind === "package") {
        expect(stripe.ecosystem).toBe("pypi");
        expect(stripe.version_constraint).toBe(">=7.0");
      }

      const boto3 = entries.find((e) => e.kind === "package" && e.name === "boto3");
      expect(boto3).toBeDefined();
      if (boto3 && boto3.kind === "package") {
        expect(boto3.ecosystem).toBe("pypi");
      }
    });

    it("skips python in conda environment.yml", async () => {
      const manifestFile = resolve(fixturesRoot, "environment.yml");
      const entries = await plugin.analyzeManifests!([manifestFile], fixturesRoot);

      const python = entries.find((e) => e.kind === "package" && e.name === "python");
      expect(python).toBeUndefined();
    });

    // ----- general -----

    it("ignores unknown manifest files", async () => {
      const entries = await plugin.analyzeManifests!(
        [resolve(fixturesRoot, "go.mod")],
        fixturesRoot,
      );
      expect(entries.length).toBe(0);
    });
  });
});
