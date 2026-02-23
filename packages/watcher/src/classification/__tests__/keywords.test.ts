import { describe, it, expect } from "vitest";
import { classifyByKeywords } from "../keywords.js";

describe("classifyByKeywords", () => {
  describe("breaking changes", () => {
    it("detects BREAKING CHANGE", () => {
      const result = classifyByKeywords("BREAKING CHANGE: removed legacy endpoint");
      expect(result.category).toBe("breaking");
      expect(result.confidence).toBe("medium");
    });

    it("detects BREAKING-CHANGE with hyphen", () => {
      const result = classifyByKeywords("BREAKING-CHANGE: auth flow updated");
      expect(result.category).toBe("breaking");
    });

    it("detects BREAKING_CHANGE with underscore", () => {
      const result = classifyByKeywords("BREAKING_CHANGE: schema modified");
      expect(result.category).toBe("breaking");
    });

    it("detects breaking change case-insensitively", () => {
      const result = classifyByKeywords("breaking change: removed field");
      expect(result.category).toBe("breaking");
    });

    it("detects removed endpoint", () => {
      const result = classifyByKeywords("The /v1/charges endpoint was removed in this release");
      expect(result.category).toBe("breaking");
    });

    it("detects deprecated and removed", () => {
      const result = classifyByKeywords("The deprecated create method has been removed");
      expect(result.category).toBe("breaking");
    });

    it("detects 'now requires'", () => {
      const result = classifyByKeywords("This version now requires Node.js 18+");
      expect(result.category).toBe("breaking");
    });

    it("detects 'no longer supported'", () => {
      const result = classifyByKeywords("Python 3.7 is no longer supported");
      expect(result.category).toBe("breaking");
    });

    it("detects authentication changed", () => {
      const result = classifyByKeywords("The authentication mechanism has changed to OAuth 2.0");
      expect(result.category).toBe("breaking");
    });

    it("detects incompatible", () => {
      const result = classifyByKeywords("This release introduces incompatible changes to the API");
      expect(result.category).toBe("breaking");
    });

    it("detects Stripe-style breaking change", () => {
      const text = `## 2023-10-16
BREAKING CHANGE: The \`source\` parameter on the Create Customer API has been removed.
Use \`payment_method\` instead. All integrations using \`source\` must migrate by 2024-01-01.`;
      const result = classifyByKeywords(text);
      expect(result.category).toBe("breaking");
    });
  });

  describe("security", () => {
    it("detects CVE identifier", () => {
      const result = classifyByKeywords("Fixed CVE-2025-1234 in request parsing");
      expect(result.category).toBe("security");
    });

    it("detects security fix", () => {
      const result = classifyByKeywords("This release includes a security fix for XSS vulnerability");
      expect(result.category).toBe("security");
    });

    it("detects security patch", () => {
      const result = classifyByKeywords("Applied security patch for input validation");
      expect(result.category).toBe("security");
    });

    it("detects security advisory", () => {
      const result = classifyByKeywords("Published security advisory for token handling");
      expect(result.category).toBe("security");
    });

    it("detects security vulnerability", () => {
      const result = classifyByKeywords("Resolved security vulnerability in auth module");
      expect(result.category).toBe("security");
    });
  });

  describe("deprecation", () => {
    it("detects deprecated", () => {
      const result = classifyByKeywords("The v2 API is now deprecated. Please migrate to v3.");
      expect(result.category).toBe("deprecation");
    });

    it("detects sunset", () => {
      const result = classifyByKeywords("Sunset date for /v1/tokens endpoint is March 2026");
      expect(result.category).toBe("deprecation");
    });

    it("detects end of life", () => {
      const result = classifyByKeywords("This version has reached end-of-life status");
      expect(result.category).toBe("deprecation");
    });

    it("detects end of life with spaces", () => {
      const result = classifyByKeywords("This version has reached end of life");
      expect(result.category).toBe("deprecation");
    });

    it("detects will be removed", () => {
      const result = classifyByKeywords("The legacy API will be removed in v3.0");
      expect(result.category).toBe("deprecation");
    });

    it("detects OpenAI-style deprecation", () => {
      const text = `We are announcing the deprecation of text-davinci-003.
This model will be removed on January 4, 2024.
Please migrate to gpt-3.5-turbo or gpt-4.`;
      const result = classifyByKeywords(text);
      expect(result.category).toBe("deprecation");
    });
  });

  describe("informational", () => {
    it("returns informational for plain changelog", () => {
      const result = classifyByKeywords("Fixed a typo in the documentation");
      expect(result.category).toBe("informational");
      expect(result.confidence).toBe("high");
    });

    it("returns informational for feature additions", () => {
      const result = classifyByKeywords("Added support for streaming responses");
      expect(result.category).toBe("informational");
    });

    it("returns informational for bug fixes", () => {
      const result = classifyByKeywords("Fixed edge case in pagination logic");
      expect(result.category).toBe("informational");
    });
  });

  describe("priority ordering", () => {
    it("breaking takes priority over deprecation", () => {
      const text = "BREAKING CHANGE: The deprecated v1 API has been removed";
      const result = classifyByKeywords(text);
      expect(result.category).toBe("breaking");
    });

    it("security takes priority over deprecation", () => {
      const text = "Security fix for the deprecated auth module. CVE-2025-5678";
      const result = classifyByKeywords(text);
      // Breaking patterns checked first, then security
      // "deprecated" + "removed" isn't matched here, but CVE is
      expect(result.category).toBe("security");
    });
  });
});
