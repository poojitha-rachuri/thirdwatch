import { describe, it, expect } from "vitest";
import { classifyByOpenApiDiff } from "../openapi.js";
import type { OpenApiDiff } from "../types.js";

function emptyDiff(): OpenApiDiff {
  return {
    removedPaths: [],
    addedPaths: [],
    changedSchemas: [],
    changedAuth: false,
    removedParameters: [],
  };
}

describe("classifyByOpenApiDiff", () => {
  describe("breaking changes", () => {
    it("flags removed paths as breaking", () => {
      const diff: OpenApiDiff = {
        ...emptyDiff(),
        removedPaths: ["/v1/charges"],
      };
      const result = classifyByOpenApiDiff(diff);
      expect(result.category).toBe("breaking");
      expect(result.confidence).toBe("high");
      expect(result.reasoning).toContain("/v1/charges");
    });

    it("flags multiple removed paths as breaking", () => {
      const diff: OpenApiDiff = {
        ...emptyDiff(),
        removedPaths: ["/v1/charges", "/v1/tokens"],
      };
      const result = classifyByOpenApiDiff(diff);
      expect(result.category).toBe("breaking");
      expect(result.reasoning).toContain("/v1/charges");
      expect(result.reasoning).toContain("/v1/tokens");
    });

    it("flags auth change as breaking", () => {
      const diff: OpenApiDiff = {
        ...emptyDiff(),
        changedAuth: true,
      };
      const result = classifyByOpenApiDiff(diff);
      expect(result.category).toBe("breaking");
      expect(result.confidence).toBe("high");
      expect(result.reasoning).toContain("authentication");
    });

    it("flags removed required schema fields as breaking", () => {
      const diff: OpenApiDiff = {
        ...emptyDiff(),
        changedSchemas: [
          { path: "/v1/customers", removedRequired: true, addedOptional: false },
        ],
      };
      const result = classifyByOpenApiDiff(diff);
      expect(result.category).toBe("breaking");
      expect(result.confidence).toBe("high");
    });

    it("flags removed required parameters as breaking", () => {
      const diff: OpenApiDiff = {
        ...emptyDiff(),
        removedParameters: [
          { path: "/v1/search", name: "query", wasRequired: true },
        ],
      };
      const result = classifyByOpenApiDiff(diff);
      expect(result.category).toBe("breaking");
      expect(result.confidence).toBe("high");
    });

    it("combines multiple breaking indicators in reasoning", () => {
      const diff: OpenApiDiff = {
        removedPaths: ["/v1/old"],
        addedPaths: [],
        changedSchemas: [
          { path: "/v1/users", removedRequired: true, addedOptional: false },
        ],
        changedAuth: true,
        removedParameters: [
          { path: "/v1/items", name: "id", wasRequired: true },
        ],
      };
      const result = classifyByOpenApiDiff(diff);
      expect(result.category).toBe("breaking");
      expect(result.reasoning).toContain("removed paths");
      expect(result.reasoning).toContain("authentication");
    });
  });

  describe("minor updates", () => {
    it("flags added paths as minor-update", () => {
      const diff: OpenApiDiff = {
        ...emptyDiff(),
        addedPaths: ["/v1/subscriptions"],
      };
      const result = classifyByOpenApiDiff(diff);
      expect(result.category).toBe("minor-update");
      expect(result.confidence).toBe("high");
    });

    it("flags added optional schema fields as minor-update", () => {
      const diff: OpenApiDiff = {
        ...emptyDiff(),
        changedSchemas: [
          { path: "/v1/customers", removedRequired: false, addedOptional: true },
        ],
      };
      const result = classifyByOpenApiDiff(diff);
      expect(result.category).toBe("minor-update");
      expect(result.confidence).toBe("high");
    });
  });

  describe("patch", () => {
    it("returns patch for changes with no breaking/additive diffs", () => {
      const diff: OpenApiDiff = {
        ...emptyDiff(),
        removedParameters: [
          { path: "/v1/items", name: "debug", wasRequired: false },
        ],
      };
      const result = classifyByOpenApiDiff(diff);
      expect(result.category).toBe("patch");
      expect(result.confidence).toBe("medium");
    });

    it("returns patch for empty diff", () => {
      const result = classifyByOpenApiDiff(emptyDiff());
      expect(result.category).toBe("patch");
      expect(result.confidence).toBe("medium");
    });
  });
});
