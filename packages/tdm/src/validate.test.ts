import { describe, it, expect } from "vitest";
import { parseTDM, parseTDMFromString, TDMValidationError } from "./validate.js";
import type { TDM } from "./types.js";

// ---------------------------------------------------------------------------
// Minimal valid TDM fixture
// ---------------------------------------------------------------------------

const VALID_TDM: TDM = {
  version: "1.0",
  metadata: {
    schema_version: "1.0",
    scan_timestamp: "2026-02-21T10:00:00.000Z",
    scanner_version: "0.1.0",
    repository: "github.com/acme/payments",
    languages_detected: ["python"],
    total_dependencies_found: 2,
    scan_duration_ms: 450,
  },
  packages: [
    {
      name: "stripe",
      ecosystem: "pypi",
      current_version: "7.0.0",
      version_constraint: ">=7.0.0",
      manifest_file: "requirements.txt",
      locations: [{ file: "requirements.txt", line: 1 }],
      usage_count: 1,
      confidence: "high",
    },
  ],
  apis: [
    {
      url: "https://api.stripe.com/v1/charges",
      method: "POST",
      provider: "stripe",
      locations: [{ file: "payments/stripe_client.py", line: 42, context: "requests.post(...)", usage: "http_call" }],
      usage_count: 1,
      confidence: "high",
    },
  ],
  sdks: [
    {
      provider: "stripe",
      sdk_package: "stripe",
      services_used: [],
      api_methods: ["stripe.Charge.create"],
      locations: [{ file: "payments/stripe_client.py", line: 1, usage: "import" }],
      usage_count: 3,
      confidence: "high",
    },
  ],
  infrastructure: [],
  webhooks: [],
};

// ---------------------------------------------------------------------------
// parseTDM — happy path
// ---------------------------------------------------------------------------

describe("parseTDM", () => {
  it("returns a typed TDM for a valid manifest", () => {
    const result = parseTDM(VALID_TDM);
    expect(result.version).toBe("1.0");
    expect(result.metadata.repository).toBe("github.com/acme/payments");
    expect(result.packages).toHaveLength(1);
    expect(result.packages[0]?.name).toBe("stripe");
    expect(result.sdks[0]?.provider).toBe("stripe");
  });

  it("accepts a TDM with empty optional arrays", () => {
    const minimal: TDM = {
      ...VALID_TDM,
      packages: [],
      apis: [],
      sdks: [],
      infrastructure: [],
      webhooks: [],
      metadata: { ...VALID_TDM.metadata, total_dependencies_found: 0 },
    };
    expect(() => parseTDM(minimal)).not.toThrow();
  });

  it("accepts infrastructure entries", () => {
    const withInfra: TDM = {
      ...VALID_TDM,
      infrastructure: [
        {
          type: "postgresql",
          connection_ref: "DATABASE_URL",
          resolved_host: "db.acme.internal",
          locations: [{ file: "db/connection.py", line: 5 }],
          confidence: "high",
        },
      ],
    };
    expect(() => parseTDM(withInfra)).not.toThrow();
  });

  it("accepts webhook entries", () => {
    const withWebhook: TDM = {
      ...VALID_TDM,
      webhooks: [
        {
          direction: "outbound_registration",
          target_url: "https://api.stripe.com/v1/webhook_endpoints",
          provider: "stripe",
          locations: [{ file: "webhooks/register.py", line: 12 }],
          confidence: "medium",
        },
      ],
    };
    expect(() => parseTDM(withWebhook)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// parseTDM — failure cases
// ---------------------------------------------------------------------------

describe("parseTDM — validation errors", () => {
  it("throws TDMValidationError for null input", () => {
    expect(() => parseTDM(null)).toThrow(TDMValidationError);
  });

  it("throws TDMValidationError for a plain string", () => {
    expect(() => parseTDM("not a TDM")).toThrow(TDMValidationError);
  });

  it("throws TDMValidationError when version is missing", () => {
    const bad = { ...VALID_TDM } as Record<string, unknown>;
    delete bad["version"];
    expect(() => parseTDM(bad)).toThrow(TDMValidationError);
  });

  it("throws TDMValidationError when version has wrong format", () => {
    expect(() => parseTDM({ ...VALID_TDM, version: "v1" })).toThrow(TDMValidationError);
  });

  it("throws TDMValidationError when metadata is missing", () => {
    const bad = { ...VALID_TDM } as Record<string, unknown>;
    delete bad["metadata"];
    expect(() => parseTDM(bad)).toThrow(TDMValidationError);
  });

  it("throws TDMValidationError when scan_timestamp is not ISO 8601", () => {
    expect(() =>
      parseTDM({
        ...VALID_TDM,
        metadata: { ...VALID_TDM.metadata, scan_timestamp: "not-a-date" },
      }),
    ).toThrow(TDMValidationError);
  });

  it("throws TDMValidationError when a package has invalid confidence", () => {
    expect(() =>
      parseTDM({
        ...VALID_TDM,
        packages: [{ ...VALID_TDM.packages[0], confidence: "very-sure" }],
      }),
    ).toThrow(TDMValidationError);
  });

  it("throws TDMValidationError when a location has line < 1", () => {
    expect(() =>
      parseTDM({
        ...VALID_TDM,
        packages: [
          {
            ...VALID_TDM.packages[0],
            locations: [{ file: "foo.py", line: 0 }],
          },
        ],
      }),
    ).toThrow(TDMValidationError);
  });

  it("throws TDMValidationError when apis array is missing", () => {
    const bad = { ...VALID_TDM } as Record<string, unknown>;
    delete bad["apis"];
    expect(() => parseTDM(bad)).toThrow(TDMValidationError);
  });

  it("error message lists the failing field path", () => {
    try {
      parseTDM({ ...VALID_TDM, version: "bad" });
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TDMValidationError);
      expect((err as TDMValidationError).message).toContain("version");
    }
  });

  it("exposes structured errors array", () => {
    try {
      parseTDM(null);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TDMValidationError);
      expect((err as TDMValidationError).errors.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// parseTDMFromString
// ---------------------------------------------------------------------------

describe("parseTDMFromString", () => {
  it("parses a valid JSON string", () => {
    const result = parseTDMFromString(JSON.stringify(VALID_TDM));
    expect(result.version).toBe("1.0");
  });

  it("throws SyntaxError for malformed JSON", () => {
    expect(() => parseTDMFromString("{not json}")).toThrow(SyntaxError);
  });

  it("throws TDMValidationError for valid JSON but invalid TDM", () => {
    expect(() => parseTDMFromString('{"version":"1.0"}')).toThrow(TDMValidationError);
  });
});
