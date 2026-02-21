import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { parseTDM, parseTDMFromString, TDMValidationError, TDM_SCHEMA_OBJECT } from "./validate.js";
import type { TDM } from "./types.js";

// ---------------------------------------------------------------------------
// Minimal valid TDM fixture
// ---------------------------------------------------------------------------

const VALID_TDM: TDM = {
  version: "1.0",
  metadata: {
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

  it("accepts inbound webhook with a path pattern target_url", () => {
    const withInbound: TDM = {
      ...VALID_TDM,
      webhooks: [
        {
          direction: "inbound_callback",
          target_url: "/webhooks/stripe",
          provider: "stripe",
          locations: [{ file: "webhooks/handler.py", line: 5 }],
          confidence: "high",
        },
      ],
    };
    expect(() => parseTDM(withInbound)).not.toThrow();
  });

  it("accepts entries with optional id fields", () => {
    const withIds: TDM = {
      ...VALID_TDM,
      packages: [{ ...VALID_TDM.packages[0]!, id: "pkg:pypi/stripe@7.0.0" }],
      apis: [{ ...VALID_TDM.apis[0]!, id: "api:stripe/charges-post" }],
    };
    expect(() => parseTDM(withIds)).not.toThrow();
  });

  it("accepts template URLs starting with ${", () => {
    const withTemplate: TDM = {
      ...VALID_TDM,
      apis: [
        {
          url: "${BASE_URL}/v2/users",
          method: "GET",
          locations: [{ file: "src/api.ts", line: 10 }],
          usage_count: 1,
          confidence: "medium",
        },
      ],
    };
    expect(() => parseTDM(withTemplate)).not.toThrow();
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

  it("exposes structured issues array", () => {
    try {
      parseTDM(null);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TDMValidationError);
      const e = err as TDMValidationError;
      expect(e.issues.length).toBeGreaterThan(0);
      expect(e.issues[0]).toHaveProperty("path");
      expect(e.issues[0]).toHaveProperty("message");
      expect(e.issues[0]).toHaveProperty("keyword");
    }
  });

  it("caps error message at 5 inline errors with trailing count", () => {
    // Force many errors by sending an object that fails every required field
    try {
      parseTDM({});
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TDMValidationError);
      const e = err as TDMValidationError;
      // Message should be bounded regardless of error count
      expect(e.message.length).toBeLessThan(2048);
      // Full list still accessible
      expect(e.issues.length).toBeGreaterThan(0);
    }
  });

  it("caps message string even with 1000 errors", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawErrors: any[] = Array.from({ length: 1000 }, (_, i) => ({
      instancePath: `/field${i}`,
      schemaPath: "#/required",
      keyword: "required",
      params: { missingProperty: `field${i}` },
      message: "is required",
    }));
    const err = new TDMValidationError(rawErrors);
    expect(err.message.length).toBeLessThan(2048);
    expect(err.message).toContain("more error(s)");
    expect(err.issues).toHaveLength(1000);
  });

  it("throws TDMValidationError for invalid HTTP method", () => {
    expect(() =>
      parseTDM({
        ...VALID_TDM,
        apis: [
          {
            ...VALID_TDM.apis[0],
            method: "INJECT\r\nHost: evil.com",
          },
        ],
      }),
    ).toThrow(TDMValidationError);
  });

  it("throws TDMValidationError for javascript: URL injection", () => {
    expect(() =>
      parseTDM({
        ...VALID_TDM,
        apis: [
          {
            ...VALID_TDM.apis[0],
            url: "javascript:alert(1)",
          },
        ],
      }),
    ).toThrow(TDMValidationError);
  });

  it("throws TDMValidationError when a string field exceeds maxLength", () => {
    expect(() =>
      parseTDM({
        ...VALID_TDM,
        packages: [
          {
            ...VALID_TDM.packages[0],
            name: "a".repeat(300), // maxLength is 256
          },
        ],
      }),
    ).toThrow(TDMValidationError);
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

  it("throws Error when input exceeds the size limit", () => {
    const oversized = "x".repeat(51 * 1024 * 1024); // 51 MB > 50 MB default
    expect(() => parseTDMFromString(oversized)).toThrow(/exceeds maximum size/);
  });

  it("accepts input below a custom size limit", () => {
    const small = JSON.stringify(VALID_TDM);
    expect(() => parseTDMFromString(small, 1024 * 1024)).not.toThrow();
  });

  it("throws Error when input exceeds a custom size limit", () => {
    const large = JSON.stringify(VALID_TDM);
    expect(() => parseTDMFromString(large, 1)).toThrow(/exceeds maximum size/);
  });
});

// ---------------------------------------------------------------------------
// Schema-sync: embedded TDM_SCHEMA_OBJECT must match schema/v1/tdm.schema.json
// ---------------------------------------------------------------------------

describe("schema sync", () => {
  it("embedded TDM_SCHEMA_OBJECT matches schema/v1/tdm.schema.json structurally", () => {
    const canonicalPath = resolve(__dirname, "../../../schema/v1/tdm.schema.json");
    const canonicalJson = JSON.parse(readFileSync(canonicalPath, "utf-8")) as unknown;

    // Strip description fields from canonical for structural comparison
    const strip = (obj: unknown): unknown => {
      if (typeof obj !== "object" || obj === null) return obj;
      if (Array.isArray(obj)) return obj.map(strip);
      const { description: _, ...rest } = obj as Record<string, unknown>;
      return Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, strip(v)]));
    };

    expect(TDM_SCHEMA_OBJECT).toMatchObject(strip(canonicalJson) as Record<string, unknown>);
  });
});
