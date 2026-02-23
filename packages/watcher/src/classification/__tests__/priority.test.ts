import { describe, it, expect } from "vitest";
import { assignPreliminaryPriority } from "../priority.js";

describe("assignPreliminaryPriority", () => {
  it("returns P0 for security regardless of usage", () => {
    expect(assignPreliminaryPriority("security", 0)).toBe("P0");
    expect(assignPreliminaryPriority("security", 100)).toBe("P0");
  });

  it("returns P0 for breaking with high usage", () => {
    expect(assignPreliminaryPriority("breaking", 51)).toBe("P0");
    expect(assignPreliminaryPriority("breaking", 100)).toBe("P0");
  });

  it("returns P1 for breaking with low usage", () => {
    expect(assignPreliminaryPriority("breaking", 50)).toBe("P1");
    expect(assignPreliminaryPriority("breaking", 0)).toBe("P1");
  });

  it("returns P1 for deprecation with high usage", () => {
    expect(assignPreliminaryPriority("deprecation", 21)).toBe("P1");
    expect(assignPreliminaryPriority("deprecation", 100)).toBe("P1");
  });

  it("returns P2 for deprecation with low usage", () => {
    expect(assignPreliminaryPriority("deprecation", 20)).toBe("P2");
    expect(assignPreliminaryPriority("deprecation", 0)).toBe("P2");
  });

  it("returns P2 for major-update", () => {
    expect(assignPreliminaryPriority("major-update", 0)).toBe("P2");
    expect(assignPreliminaryPriority("major-update", 100)).toBe("P2");
  });

  it("returns P3 for minor-update", () => {
    expect(assignPreliminaryPriority("minor-update", 0)).toBe("P3");
    expect(assignPreliminaryPriority("minor-update", 100)).toBe("P3");
  });

  it("returns P4 for patch", () => {
    expect(assignPreliminaryPriority("patch", 0)).toBe("P4");
  });

  it("returns P4 for informational", () => {
    expect(assignPreliminaryPriority("informational", 0)).toBe("P4");
  });
});
