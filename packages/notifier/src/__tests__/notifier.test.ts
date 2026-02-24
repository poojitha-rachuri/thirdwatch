import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ImpactAssessment } from "@thirdwatch/analyzer";
import { Notifier } from "../notifier.js";
import { resolveRoutes } from "../routing.js";
import { InMemoryDeduplicationStore } from "../dedup.js";
import { signPayload, WebhookAdapter } from "../adapters/webhook.js";
import type {
  NotifierConfig,
  NotifierAdapter,
  NotificationResult,
} from "../types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAssessment(
  overrides: Partial<ImpactAssessment> = {},
): ImpactAssessment {
  return {
    changeEventId: "evt-1",
    dependencyIdentifier: "stripe",
    changeCategory: "breaking",
    priority: "P0",
    score: 30,
    affectedLocations: [
      { file: "src/payments/charge.ts", line: 42, context: "", usageType: "method_call" },
    ],
    humanSummary:
      "stripe has a breaking change. Found 1 usage across 1 file.",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Stub adapter for testing
// ---------------------------------------------------------------------------

class StubAdapter implements NotifierAdapter {
  calls: ImpactAssessment[] = [];
  result: NotificationResult = { channelId: "stub", success: true };

  async send(assessment: ImpactAssessment): Promise<NotificationResult> {
    this.calls.push(assessment);
    return this.result;
  }
}

// ---------------------------------------------------------------------------
// resolveRoutes
// ---------------------------------------------------------------------------

describe("resolveRoutes", () => {
  it("matches rules with no filters (catch-all)", () => {
    const routes = resolveRoutes(makeAssessment(), [{ channel: "all" }]);
    expect(routes).toHaveLength(1);
    expect(routes[0]!.channel).toBe("all");
  });

  it("matches by priority", () => {
    const routes = resolveRoutes(makeAssessment({ priority: "P0" }), [
      { channel: "incidents", priority: ["P0", "P1"] },
      { channel: "digest", priority: ["P3", "P4"] },
    ]);
    expect(routes).toHaveLength(1);
    expect(routes[0]!.channel).toBe("incidents");
  });

  it("matches by changeCategory", () => {
    const routes = resolveRoutes(
      makeAssessment({ changeCategory: "security" }),
      [
        { channel: "security-alerts", changeCategory: ["security"] },
        { channel: "other", changeCategory: ["deprecation"] },
      ],
    );
    expect(routes).toHaveLength(1);
    expect(routes[0]!.channel).toBe("security-alerts");
  });

  it("requires both priority AND changeCategory to match", () => {
    const routes = resolveRoutes(
      makeAssessment({ priority: "P0", changeCategory: "breaking" }),
      [
        {
          channel: "strict",
          priority: ["P0"],
          changeCategory: ["deprecation"],
        },
      ],
    );
    expect(routes).toHaveLength(0);
  });

  it("returns empty when no rules match", () => {
    const routes = resolveRoutes(makeAssessment({ priority: "P4" }), [
      { channel: "incidents", priority: ["P0"] },
    ]);
    expect(routes).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// InMemoryDeduplicationStore
// ---------------------------------------------------------------------------

describe("InMemoryDeduplicationStore", () => {
  it("returns undefined for unknown entries", async () => {
    const store = new InMemoryDeduplicationStore();
    expect(await store.find("evt-1", "webhook")).toBeUndefined();
  });

  it("records and finds deliveries", async () => {
    const store = new InMemoryDeduplicationStore();
    await store.record({
      changeEventId: "evt-1",
      channelId: "webhook",
      deliveredAt: new Date(),
    });
    const found = await store.find("evt-1", "webhook");
    expect(found).toBeDefined();
    expect(found!.changeEventId).toBe("evt-1");
  });

  it("distinguishes by channel", async () => {
    const store = new InMemoryDeduplicationStore();
    await store.record({
      changeEventId: "evt-1",
      channelId: "slack",
      deliveredAt: new Date(),
    });
    expect(await store.find("evt-1", "webhook")).toBeUndefined();
    expect(await store.find("evt-1", "slack")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// signPayload
// ---------------------------------------------------------------------------

describe("signPayload", () => {
  it("produces a sha256= prefixed HMAC", () => {
    const sig = signPayload('{"test":true}', "secret123");
    expect(sig).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it("produces different signatures for different secrets", () => {
    const payload = '{"test":true}';
    const sig1 = signPayload(payload, "secret-a");
    const sig2 = signPayload(payload, "secret-b");
    expect(sig1).not.toBe(sig2);
  });

  it("is deterministic", () => {
    const sig1 = signPayload("hello", "key");
    const sig2 = signPayload("hello", "key");
    expect(sig1).toBe(sig2);
  });
});

// ---------------------------------------------------------------------------
// WebhookAdapter
// ---------------------------------------------------------------------------

describe("WebhookAdapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends POST with correct payload structure", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 200 }),
    );

    const adapter = new WebhookAdapter({
      url: "https://example.com/hook",
    });

    const result = await adapter.send(makeAssessment());

    expect(result.success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledOnce();

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://example.com/hook");
    expect(init!.method).toBe("POST");

    const body = JSON.parse(init!.body as string);
    expect(body.version).toBe("1");
    expect(body.event).toBe("change_detected");
    expect(body.assessment.priority).toBe("P0");
    expect(body.assessment.dependency).toBe("stripe");
    expect(body.assessment.changeType).toBe("breaking");
    expect(body.assessment.affectedFiles).toBe(1);
    expect(body.assessment.url).toBe("https://app.thirdwatch.dev/changes/evt-1");
  });

  it("includes HMAC signature when secret is set", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 200 }),
    );

    const adapter = new WebhookAdapter({
      url: "https://example.com/hook",
      secret: "test-secret",
    });

    await adapter.send(makeAssessment());

    const headers = fetchSpy.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers["X-Thirdwatch-Signature"]).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it("omits signature when no secret", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 200 }),
    );

    const adapter = new WebhookAdapter({
      url: "https://example.com/hook",
    });

    await adapter.send(makeAssessment());

    const headers = fetchSpy.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers["X-Thirdwatch-Signature"]).toBeUndefined();
  });

  it("returns failure on HTTP error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 500 }),
    );

    const adapter = new WebhookAdapter({
      url: "https://example.com/hook",
    });

    const result = await adapter.send(makeAssessment());
    expect(result.success).toBe(false);
    expect(result.error).toBe("HTTP 500");
  });

  it("returns failure on network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("Connection refused"),
    );

    const adapter = new WebhookAdapter({
      url: "https://example.com/hook",
    });

    const result = await adapter.send(makeAssessment());
    expect(result.success).toBe(false);
    expect(result.error).toBe("Connection refused");
  });
});

// ---------------------------------------------------------------------------
// Notifier (integration)
// ---------------------------------------------------------------------------

describe("Notifier", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends to all matching channels", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 200 }),
    );

    const config: NotifierConfig = {
      channels: [
        { type: "webhook", id: "hook-a", settings: { url: "https://a.com/hook" } },
        { type: "webhook", id: "hook-b", settings: { url: "https://b.com/hook" } },
      ],
      routing: [{ channel: "hook-a" }, { channel: "hook-b" }],
    };

    const notifier = new Notifier(config);
    const results = await notifier.notify(makeAssessment());

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.success)).toBe(true);
  });

  it("returns empty array when no routes match", async () => {
    const config: NotifierConfig = {
      channels: [
        { type: "webhook", id: "hook", settings: { url: "https://a.com" } },
      ],
      routing: [{ channel: "hook", priority: ["P4"] }],
    };

    const notifier = new Notifier(config);
    const results = await notifier.notify(makeAssessment({ priority: "P0" }));

    expect(results).toHaveLength(0);
  });

  it("deduplicates by default", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 200 }),
    );

    const config: NotifierConfig = {
      channels: [
        { type: "webhook", id: "hook", settings: { url: "https://a.com" } },
      ],
      routing: [{ channel: "hook" }],
    };

    const notifier = new Notifier(config);
    const assessment = makeAssessment();

    const first = await notifier.notify(assessment);
    expect(first).toHaveLength(1);
    expect(first[0]!.success).toBe(true);
    expect(first[0]!.deduplicated).toBeUndefined();

    const second = await notifier.notify(assessment);
    expect(second).toHaveLength(1);
    expect(second[0]!.success).toBe(true);
    expect(second[0]!.deduplicated).toBe(true);
  });

  it("skips dedup when deduplicate is false", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 200 }),
    );

    const config: NotifierConfig = {
      channels: [
        { type: "webhook", id: "hook", settings: { url: "https://a.com" } },
      ],
      routing: [{ channel: "hook" }],
      deduplicate: false,
    };

    const notifier = new Notifier(config);
    const assessment = makeAssessment();

    await notifier.notify(assessment);
    await notifier.notify(assessment);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("returns error for missing adapter", async () => {
    const config: NotifierConfig = {
      channels: [],
      routing: [{ channel: "nonexistent" }],
    };

    const notifier = new Notifier(config);
    const results = await notifier.notify(makeAssessment());

    expect(results).toHaveLength(1);
    expect(results[0]!.success).toBe(false);
    expect(results[0]!.error).toContain("nonexistent");
  });

  it("throws on unsupported channel type", () => {
    const config: NotifierConfig = {
      channels: [
        { type: "slack" as "webhook", id: "s", settings: {} },
      ],
      routing: [],
    };

    expect(() => new Notifier(config)).toThrow("Unsupported channel type");
  });
});
