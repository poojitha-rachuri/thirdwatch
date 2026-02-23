import type { ClassificationResult } from "./types.js";

const BREAKING_PATTERNS: RegExp[] = [
  /\bBREAKING[\s_-]*CHANGE\b/i,
  /\b(?:removed?\b.{0,50}\bendpoint|endpoint\b.{0,50}\bremoved?)\b/i,
  /\bdeprecated?\b.{0,50}\bremoved?\b/i,
  /\bnow requires?\b/i,
  /\bno longer supported?\b/i,
  /\bauth(?:entication)?\b.{0,50}\bchanged?\b/i,
  /\bincompatible\b/i,
];

const DEPRECATION_PATTERNS: RegExp[] = [
  /\bdeprecated?\b/i,
  /\bsunset\b/i,
  /\bend[\s-]of[\s-]life\b/i,
  /\bwill be removed\b/i,
];

const SECURITY_PATTERNS: RegExp[] = [
  /\bCVE-\d{4}-\d+\b/,
  /\bsecurity\s+(?:fix|patch|advisory|vulnerability)\b/i,
];

export function classifyByKeywords(text: string): ClassificationResult {
  if (BREAKING_PATTERNS.some((p) => p.test(text))) {
    return {
      category: "breaking",
      confidence: "medium",
      reasoning: "Changelog contains breaking change language",
      classifierUsed: "keywords",
    };
  }

  if (SECURITY_PATTERNS.some((p) => p.test(text))) {
    return {
      category: "security",
      confidence: "medium",
      reasoning: "Changelog references security advisory or CVE",
      classifierUsed: "keywords",
    };
  }

  if (DEPRECATION_PATTERNS.some((p) => p.test(text))) {
    return {
      category: "deprecation",
      confidence: "medium",
      reasoning: "Changelog mentions deprecation",
      classifierUsed: "keywords",
    };
  }

  return {
    category: "informational",
    confidence: "high",
    reasoning: "No breaking, security, or deprecation patterns found",
    classifierUsed: "keywords",
  };
}
