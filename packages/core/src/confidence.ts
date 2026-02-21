import type { Confidence } from "@thirdwatch/tdm";

export type DetectionMethod = "literal" | "template" | "variable" | "heuristic";

function isAbsoluteUrl(url: string): boolean {
  return /^https?:\/\//.test(url);
}

export function scoreConfidence(
  url: string,
  detectionMethod: DetectionMethod,
): Confidence {
  if (detectionMethod === "literal" && isAbsoluteUrl(url)) return "high";
  if (detectionMethod === "template") return "medium";
  if (detectionMethod === "variable") return "medium";
  return "low";
}
