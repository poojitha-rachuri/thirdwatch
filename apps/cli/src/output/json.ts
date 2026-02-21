// apps/cli/src/output/json.ts — JSON output formatter
import type { TDM } from "@thirdwatch/tdm";

export function formatJson(tdm: TDM): string {
  return JSON.stringify(tdm, null, 2) + "\n";
}
