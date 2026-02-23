import type { TDM } from "@thirdwatch/tdm";
import type { ChangeEvent } from "@thirdwatch/watcher";
import type { AffectedLocation } from "./types.js";
import { findTDMEntries } from "./impact-scorer.js";

/**
 * Given a change event and TDM, returns precise file:line locations
 * with human-readable context.
 */
export function mapAffectedCode(
  change: ChangeEvent,
  tdm: TDM,
): AffectedLocation[] {
  const entries = findTDMEntries(change.dependency, tdm);
  return entries.flatMap((entry) =>
    entry.locations.map((loc) => ({
      file: loc.file,
      line: loc.line,
      context: loc.context ?? "",
      usageType: loc.usage ?? "unknown",
    })),
  );
}

/**
 * Builds a one-sentence human-readable summary of the impact.
 */
export function buildHumanSummary(
  change: ChangeEvent,
  locations: AffectedLocation[],
): string {
  const fileCount = new Set(locations.map((l) => l.file)).size;
  const callCount = locations.length;
  const dep = change.dependency.identifier;
  const version = change.newVersion ? ` (${change.newVersion})` : "";

  return (
    `${dep} has a ${change.changeType} change${version}. ` +
    `Found ${callCount} usage${callCount !== 1 ? "s" : ""} across ${fileCount} file${fileCount !== 1 ? "s" : ""}.`
  );
}
