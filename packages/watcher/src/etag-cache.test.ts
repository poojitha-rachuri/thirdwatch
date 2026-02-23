import { describe, expect, it } from "vitest";
import { InMemoryETagCache } from "./etag-cache.js";

describe("InMemoryETagCache", () => {
  it("returns undefined for a cache miss", () => {
    const cache = new InMemoryETagCache();
    expect(cache.get("nonexistent")).toBeUndefined();
  });

  it("returns the stored value after set", () => {
    const cache = new InMemoryETagCache();
    cache.set("key-1", "etag-abc");
    expect(cache.get("key-1")).toBe("etag-abc");
  });

  it("overwrites a previous value", () => {
    const cache = new InMemoryETagCache();
    cache.set("key-1", "etag-abc");
    cache.set("key-1", "etag-def");
    expect(cache.get("key-1")).toBe("etag-def");
  });

  it("stores multiple keys independently", () => {
    const cache = new InMemoryETagCache();
    cache.set("a", "1");
    cache.set("b", "2");
    expect(cache.get("a")).toBe("1");
    expect(cache.get("b")).toBe("2");
  });
});
