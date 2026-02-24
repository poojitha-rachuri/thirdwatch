// action/src/diff.ts — TDM diff computation + markdown formatting

import type {
  TDM,
  TDMPackage,
  TDMApi,
  TDMSdk,
  TDMInfrastructure,
  TDMWebhook,
} from "@thirdwatch/tdm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DependencyEntry =
  | TDMPackage
  | TDMApi
  | TDMSdk
  | TDMInfrastructure
  | TDMWebhook;

export interface DiffEntry {
  key: string;
  kind: "package" | "api" | "sdk" | "infrastructure" | "webhook";
  entry: DependencyEntry;
}

export interface DiffSummary {
  addedCount: number;
  removedCount: number;
  unchangedCount: number;
}

export interface TDMDiff {
  added: DiffEntry[];
  removed: DiffEntry[];
  unchanged: DiffEntry[];
  summary: DiffSummary;
}

// ---------------------------------------------------------------------------
// Key generation — stable identity for each dependency type
// ---------------------------------------------------------------------------

function packageKey(pkg: TDMPackage): string {
  return `pkg:${pkg.ecosystem}/${pkg.name}`;
}

function apiKey(api: TDMApi): string {
  const method = api.method ?? "GET";
  return `api:${method}:${api.url}`;
}

function sdkKey(sdk: TDMSdk): string {
  return `sdk:${sdk.provider}/${sdk.sdk_package}`;
}

function infraKey(infra: TDMInfrastructure): string {
  return `infra:${infra.type}/${infra.connection_ref}`;
}

function webhookKey(wh: TDMWebhook): string {
  return `webhook:${wh.direction}/${wh.target_url}`;
}

// ---------------------------------------------------------------------------
// Extract all entries from a TDM into a flat list with keys
// ---------------------------------------------------------------------------

export function extractAllEntries(tdm: TDM): DiffEntry[] {
  const entries: DiffEntry[] = [];

  for (const pkg of tdm.packages) {
    entries.push({ key: packageKey(pkg), kind: "package", entry: pkg });
  }
  for (const api of tdm.apis) {
    entries.push({ key: apiKey(api), kind: "api", entry: api });
  }
  for (const sdk of tdm.sdks) {
    entries.push({ key: sdkKey(sdk), kind: "sdk", entry: sdk });
  }
  for (const infra of tdm.infrastructure) {
    entries.push({ key: infraKey(infra), kind: "infrastructure", entry: infra });
  }
  for (const wh of tdm.webhooks) {
    entries.push({ key: webhookKey(wh), kind: "webhook", entry: wh });
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Diff two TDMs
// ---------------------------------------------------------------------------

export function diffTDMs(baseline: TDM | null, current: TDM): TDMDiff {
  const currentEntries = extractAllEntries(current);

  if (!baseline) {
    return {
      added: currentEntries,
      removed: [],
      unchanged: [],
      summary: {
        addedCount: currentEntries.length,
        removedCount: 0,
        unchangedCount: 0,
      },
    };
  }

  const baselineEntries = extractAllEntries(baseline);
  const baselineKeys = new Set(baselineEntries.map((e) => e.key));
  const currentKeys = new Set(currentEntries.map((e) => e.key));

  const added = currentEntries.filter((e) => !baselineKeys.has(e.key));
  const removed = baselineEntries.filter((e) => !currentKeys.has(e.key));
  const unchanged = currentEntries.filter((e) => baselineKeys.has(e.key));

  return {
    added,
    removed,
    unchanged,
    summary: {
      addedCount: added.length,
      removedCount: removed.length,
      unchangedCount: unchanged.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Format diff as a Markdown PR comment
// ---------------------------------------------------------------------------

const KIND_EMOJI: Record<string, string> = {
  package: "📦",
  api: "🌐",
  sdk: "🔧",
  infrastructure: "🗄️",
  webhook: "🔗",
};

export function formatDiffAsMarkdown(diff: TDMDiff, tdm: TDM): string {
  const { added, removed } = diff;
  const totalCount = tdm.metadata.total_dependencies_found;
  const languages = tdm.metadata.languages_detected.join(", ");

  const lines: string[] = [];

  lines.push("## Thirdwatch Dependency Report");
  lines.push("");
  lines.push(
    `**${totalCount} total external dependencies** scanned across ${languages}.`,
  );
  lines.push("");

  if (added.length > 0) {
    lines.push(`### ✨ New Dependencies (${added.length})`);
    lines.push(
      "These dependencies are new in this PR and are not yet registered for monitoring.",
    );
    const shown = added.slice(0, 15);
    for (const dep of shown) {
      lines.push(
        `- ${KIND_EMOJI[dep.kind] ?? ""} \`${dep.key}\` *(${dep.kind})*`,
      );
    }
    if (added.length > 15) {
      lines.push(`*...and ${added.length - 15} more*`);
    }
    lines.push("");
  }

  if (removed.length > 0) {
    lines.push(`### 🗑️ Removed Dependencies (${removed.length})`);
    const shown = removed.slice(0, 10);
    for (const dep of shown) {
      lines.push(`- \`${dep.key}\``);
    }
    if (removed.length > 10) {
      lines.push(`*...and ${removed.length - 10} more*`);
    }
    lines.push("");
  }

  if (added.length === 0 && removed.length === 0) {
    lines.push(
      "✅ No dependency surface area changes detected in this PR.",
    );
    lines.push("");
  }

  lines.push("<details>");
  lines.push("<summary>Full TDM breakdown</summary>");
  lines.push("");
  lines.push("| Section | Count |");
  lines.push("|---|---|");
  lines.push(`| 📦 Packages | ${tdm.packages.length} |`);
  lines.push(`| 🌐 External APIs | ${tdm.apis.length} |`);
  lines.push(`| 🔧 SDKs | ${tdm.sdks.length} |`);
  lines.push(`| 🗄️ Infrastructure | ${tdm.infrastructure.length} |`);
  lines.push(`| 🔗 Webhooks | ${tdm.webhooks.length} |`);
  lines.push("");
  lines.push("</details>");
  lines.push("");
  lines.push("---");
  lines.push(
    "*[Thirdwatch](https://thirdwatch.dev) · [View full report →](https://app.thirdwatch.dev)*",
  );

  return lines.join("\n");
}
