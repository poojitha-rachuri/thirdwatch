import type { ChangeCategory, Priority, TDM, TDMLocation } from "@thirdwatch/tdm";
import type { ChangeEvent, WatchedDependency } from "@thirdwatch/watcher";
import type { ScoreComponents } from "./types.js";

// ---------------------------------------------------------------------------
// Severity weights (from change category)
// ---------------------------------------------------------------------------

const SEVERITY_WEIGHTS: Record<ChangeCategory, number> = {
  breaking: 5,
  security: 5,
  deprecation: 3,
  "major-update": 2,
  "minor-update": 1,
  patch: 0.5,
  informational: 0,
};

// ---------------------------------------------------------------------------
// Criticality path patterns
// ---------------------------------------------------------------------------

const DEFAULT_CRITICAL = ["auth", "payment", "checkout", "billing", "security", "login"];
const DEFAULT_IMPORTANT = ["api", "service", "core", "handler", "middleware"];
const DEFAULT_LOW = ["test", "spec", "__test__", "fixture", "mock"];

// ---------------------------------------------------------------------------
// TDM entry lookup — finds all entries matching a dependency
// ---------------------------------------------------------------------------

interface TDMEntry {
  usage_count: number;
  locations: TDMLocation[];
}

export function findTDMEntries(
  dependency: WatchedDependency,
  tdm: TDM,
): TDMEntry[] {
  const entries: TDMEntry[] = [];
  const id = dependency.identifier.toLowerCase();
  const tdmId = dependency.tdmId?.toLowerCase() ?? "";

  for (const pkg of tdm.packages) {
    if (pkg.name.toLowerCase() === id || (tdmId && pkg.id?.toLowerCase() === tdmId)) {
      entries.push({ usage_count: pkg.usage_count, locations: pkg.locations });
    }
  }

  for (const sdk of tdm.sdks) {
    if (
      sdk.provider.toLowerCase() === id ||
      sdk.sdk_package.toLowerCase() === id ||
      (tdmId && sdk.id?.toLowerCase() === tdmId)
    ) {
      entries.push({ usage_count: sdk.usage_count, locations: sdk.locations });
    }
  }

  for (const api of tdm.apis) {
    if (
      api.provider?.toLowerCase() === id ||
      (tdmId && api.id?.toLowerCase() === tdmId)
    ) {
      entries.push({ usage_count: api.usage_count, locations: api.locations });
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Weight functions
// ---------------------------------------------------------------------------

export function usageWeight(totalUsage: number): number {
  if (totalUsage > 100) return 3;
  if (totalUsage > 20) return 2;
  if (totalUsage > 5) return 1.5;
  if (totalUsage > 0) return 1;
  return 1;
}

export function spreadWeight(uniqueFileCount: number): number {
  if (uniqueFileCount > 10) return 3;
  if (uniqueFileCount > 3) return 2;
  if (uniqueFileCount > 1) return 1;
  return 1;
}

export function criticalityPathWeight(
  files: string[],
  overrides: string[] = [],
): number {
  const criticalPatterns = [...DEFAULT_CRITICAL, ...overrides];

  if (files.some((f) => DEFAULT_LOW.some((p) => f.includes(p)))) return 0.3;
  if (files.some((f) => criticalPatterns.some((p) => f.toLowerCase().includes(p)))) return 3;
  if (files.some((f) => DEFAULT_IMPORTANT.some((p) => f.includes(p)))) return 2;
  return 1;
}

// ---------------------------------------------------------------------------
// Score → Priority mapping
// ---------------------------------------------------------------------------

export function scoreToPriority(score: number): Priority {
  if (score >= 30) return "P0";
  if (score >= 15) return "P1";
  if (score >= 7) return "P2";
  if (score >= 3) return "P3";
  return "P4";
}

// ---------------------------------------------------------------------------
// Main scoring function
// ---------------------------------------------------------------------------

export function computeImpactScore(
  change: ChangeEvent,
  tdm: TDM,
  criticalPaths: string[] = [],
): { score: number; priority: Priority; components: ScoreComponents } {
  const severity = SEVERITY_WEIGHTS[change.changeType];

  const tdmEntries = findTDMEntries(change.dependency, tdm);
  const totalUsage = tdmEntries.reduce((sum, e) => sum + e.usage_count, 0);
  const uniqueFiles = new Set(tdmEntries.flatMap((e) => e.locations.map((l) => l.file)));

  const usage = usageWeight(totalUsage);
  const spread = spreadWeight(uniqueFiles.size);
  const path = criticalityPathWeight([...uniqueFiles], criticalPaths);

  const score = severity * usage * spread * path;
  const priority = scoreToPriority(score);

  return { score, priority, components: { severity, usage, spread, path } };
}
