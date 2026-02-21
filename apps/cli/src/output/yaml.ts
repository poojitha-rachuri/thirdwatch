// apps/cli/src/output/yaml.ts — YAML output formatter
import type { TDM } from "@thirdwatch/tdm";
import yaml from "js-yaml";

export function formatYaml(tdm: TDM): string {
  return yaml.dump(tdm, { lineWidth: 120, noRefs: true });
}
