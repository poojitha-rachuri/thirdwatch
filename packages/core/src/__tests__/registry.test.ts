import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import {
  loadSDKRegistry,
  buildPackageProviderMap,
  buildConstructorProviderMap,
  buildFactoryProviderMap,
  buildUrlProviderMap,
  buildRegistryMaps,
} from "../registry.js";

const registriesDir = resolve(__dirname, "../../../../registries");

describe("loadSDKRegistry", () => {
  it("loads all YAML files from the registries directory", async () => {
    const entries = await loadSDKRegistry(registriesDir);
    expect(entries.length).toBeGreaterThanOrEqual(51);
    for (const entry of entries) {
      expect(entry.provider).toBeTruthy();
      expect(entry.display_name).toBeTruthy();
      expect(entry.patterns).toBeDefined();
    }
  });
});

describe("buildPackageProviderMap", () => {
  it("maps npm package names to providers", async () => {
    const registry = await loadSDKRegistry(registriesDir);
    const map = buildPackageProviderMap(registry, "npm");

    expect(map.get("stripe")).toBe("stripe");
    expect(map.get("@aws-sdk/*")).toBe("aws");
    expect(map.get("openai")).toBe("openai");
    expect(map.size).toBeGreaterThan(0);
  });

  it("maps pypi package names to providers", async () => {
    const registry = await loadSDKRegistry(registriesDir);
    const map = buildPackageProviderMap(registry, "pypi");

    expect(map.get("boto3")).toBe("aws");
    expect(map.get("stripe")).toBe("stripe");
    expect(map.size).toBeGreaterThan(0);
  });
});

describe("buildConstructorProviderMap", () => {
  it("maps npm constructor names to [provider, package] tuples", async () => {
    const registry = await loadSDKRegistry(registriesDir);
    const map = buildConstructorProviderMap(registry, "npm");

    expect(map.get("Stripe")).toEqual(["stripe", "stripe"]);
    const s3 = map.get("S3Client");
    expect(s3).toBeDefined();
    expect(s3![0]).toBe("aws");
    expect(map.size).toBeGreaterThan(0);
  });

  it("maps pypi constructor names to [provider, package] tuples", async () => {
    const registry = await loadSDKRegistry(registriesDir);
    const map = buildConstructorProviderMap(registry, "pypi");

    expect(map.get("OpenAI")).toEqual(["openai", "openai"]);
    expect(map.get("AsyncOpenAI")).toEqual(["openai", "openai"]);
    expect(map.size).toBeGreaterThan(0);
  });
});

describe("buildFactoryProviderMap", () => {
  it("maps npm factory names to [provider, package] tuples", async () => {
    const registry = await loadSDKRegistry(registriesDir);
    const map = buildFactoryProviderMap(registry, "npm");

    expect(map.get("createClient")).toEqual(["redis", "redis"]);
    expect(map.get("twilio")).toEqual(["twilio", "twilio"]);
    expect(map.size).toBeGreaterThan(0);
  });
});

describe("buildUrlProviderMap", () => {
  it("maps known API base URLs to providers", async () => {
    const registry = await loadSDKRegistry(registriesDir);
    const map = buildUrlProviderMap(registry);

    expect(map.get("https://api.stripe.com")).toBe("stripe");
    expect(map.get("https://api.openai.com")).toBe("openai");
    expect(map.size).toBeGreaterThan(0);
  });
});

describe("buildRegistryMaps", () => {
  it("returns all maps for a given ecosystem", async () => {
    const registry = await loadSDKRegistry(registriesDir);
    const maps = buildRegistryMaps(registry, "npm");

    expect(maps.packageProviders).toBeInstanceOf(Map);
    expect(maps.constructorProviders).toBeInstanceOf(Map);
    expect(maps.factoryProviders).toBeInstanceOf(Map);
    expect(maps.urlProviders).toBeInstanceOf(Map);

    expect(maps.packageProviders.get("stripe")).toBe("stripe");
    expect(maps.constructorProviders.get("Stripe")).toEqual([
      "stripe",
      "stripe",
    ]);
    expect(maps.urlProviders.get("https://api.stripe.com")).toBe("stripe");
  });
});
