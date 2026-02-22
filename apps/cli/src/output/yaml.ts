// apps/cli/src/output/yaml.ts — YAML output formatter
import type { TDM } from "@thirdwatch/tdm";
import yaml from "js-yaml";

export function formatYaml(tdm: TDM): string {
  const output = yaml.dump(tdm, { lineWidth: 120, noRefs: true });
  return output.endsWith("\n") ? output : output + "\n";
}
