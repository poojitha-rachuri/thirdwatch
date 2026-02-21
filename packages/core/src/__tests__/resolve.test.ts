import { describe, it, expect } from "vitest";
import { resolveUrl, buildEnvMap } from "../resolve.js";

describe("resolveUrl", () => {
  const env: Record<string, string> = {
    STRIPE_API_BASE: "https://api.stripe.com",
    API_KEY: "sk_test_123",
  };

  it("returns high confidence for a literal URL (no env vars)", () => {
    const result = resolveUrl("https://api.stripe.com/v1/charges", env);
    expect(result.resolved).toBe("https://api.stripe.com/v1/charges");
    expect(result.confidence).toBe("high");
  });

  it("resolves a single env var with high confidence", () => {
    const result = resolveUrl("${STRIPE_API_BASE}/v1/charges", env);
    expect(result.resolved).toBe("https://api.stripe.com/v1/charges");
    expect(result.confidence).toBe("high");
  });

  it("resolves multiple env vars and redacts secrets in output", () => {
    const result = resolveUrl("${STRIPE_API_BASE}/v1?key=${API_KEY}", env);
    expect(result.resolved).toBe("https://api.stripe.com/v1?[REDACTED]");
    expect(result.confidence).toBe("high");
  });

  it("returns medium confidence when only some vars are resolved", () => {
    const result = resolveUrl("${STRIPE_API_BASE}/v1?secret=${SECRET}", env);
    expect(result.resolved).toBe("https://api.stripe.com/v1?secret=${SECRET}");
    expect(result.confidence).toBe("medium");
  });

  it("returns low confidence when no vars can be resolved", () => {
    const result = resolveUrl("${UNKNOWN_BASE}/v1/endpoint", env);
    expect(result.resolved).toBeNull();
    expect(result.confidence).toBe("low");
  });
});

describe("buildEnvMap", () => {
  it("merges known providers, dotenv, and config (config wins)", () => {
    const dotenvVars = { MY_VAR: "from-dotenv", STRIPE_API_BASE: "from-dotenv" };
    const configEnv = { STRIPE_API_BASE: "from-config" };
    const result = buildEnvMap(dotenvVars, configEnv, false);

    expect(result.MY_VAR).toBe("from-dotenv");
    expect(result.STRIPE_API_BASE).toBe("from-config");
    // Known provider should be present if not overridden
    expect(result.OPENAI_API_BASE).toBe("https://api.openai.com");
  });

  it("includes process.env when opted in", () => {
    process.env.__TW_TEST_VAR = "from-process";
    const result = buildEnvMap({}, undefined, true);
    expect(result.__TW_TEST_VAR).toBe("from-process");
    delete process.env.__TW_TEST_VAR;
  });
});
