import type { ChangeCategory, Priority } from "@thirdwatch/tdm";

export function assignPreliminaryPriority(
  category: ChangeCategory,
  usageCount: number,
): Priority {
  if (category === "security") return "P0";
  if (category === "breaking" && usageCount > 50) return "P0";
  if (category === "breaking") return "P1";
  if (category === "deprecation" && usageCount > 20) return "P1";
  if (category === "deprecation") return "P2";
  if (category === "major-update") return "P2";
  if (category === "minor-update") return "P3";
  return "P4";
}
