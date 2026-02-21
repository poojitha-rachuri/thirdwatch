import type {
  TDM,
  TDMPackage,
  TDMApi,
  TDMSdk,
  TDMInfrastructure,
  TDMWebhook,
  TDMLocation,
} from "@thirdwatch/tdm";
import { TDM_SCHEMA_VERSION } from "@thirdwatch/tdm";
import type { DependencyEntry, LanguageAnalyzerPlugin } from "./plugin.js";

const SCANNER_VERSION = "0.1.0";

// ---------------------------------------------------------------------------
// Build context passed from the scanner
// ---------------------------------------------------------------------------

export interface BuildContext {
  root: string;
  plugins: LanguageAnalyzerPlugin[];
  duration: number;
  repository?: string;
}

// ---------------------------------------------------------------------------
// Deduplication helpers
// ---------------------------------------------------------------------------

function mergeLocations(a: TDMLocation[], b: TDMLocation[]): TDMLocation[] {
  const seen = new Set<string>();
  const result: TDMLocation[] = [];
  for (const loc of [...a, ...b]) {
    const key = `${loc.file}:${loc.line}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(loc);
    }
  }
  return result;
}

function deduplicatePackages(entries: TDMPackage[]): TDMPackage[] {
  const map = new Map<string, TDMPackage>();
  for (const entry of entries) {
    const key = `${entry.ecosystem}:${entry.name}`;
    const existing = map.get(key);
    if (existing) {
      existing.locations = mergeLocations(existing.locations, entry.locations);
      existing.usage_count = existing.locations.length;
    } else {
      map.set(key, { ...entry });
    }
  }
  return [...map.values()];
}

function deduplicateApis(entries: TDMApi[]): TDMApi[] {
  const map = new Map<string, TDMApi>();
  for (const entry of entries) {
    const key = `${entry.method ?? "ANY"}:${entry.url}`;
    const existing = map.get(key);
    if (existing) {
      existing.locations = mergeLocations(existing.locations, entry.locations);
      existing.usage_count = existing.locations.length;
    } else {
      map.set(key, { ...entry });
    }
  }
  return [...map.values()];
}

function deduplicateSdks(entries: TDMSdk[]): TDMSdk[] {
  const map = new Map<string, TDMSdk>();
  for (const entry of entries) {
    const key = `${entry.provider}:${entry.sdk_package}`;
    const existing = map.get(key);
    if (existing) {
      existing.locations = mergeLocations(existing.locations, entry.locations);
      existing.usage_count = existing.locations.length;
      if (entry.services_used) {
        const services = new Set([
          ...(existing.services_used ?? []),
          ...entry.services_used,
        ]);
        existing.services_used = [...services];
      }
      if (entry.api_methods) {
        const methods = new Set([
          ...(existing.api_methods ?? []),
          ...entry.api_methods,
        ]);
        existing.api_methods = [...methods];
      }
    } else {
      map.set(key, { ...entry });
    }
  }
  return [...map.values()];
}

function deduplicateInfrastructure(
  entries: TDMInfrastructure[],
): TDMInfrastructure[] {
  const map = new Map<string, TDMInfrastructure>();
  for (const entry of entries) {
    const key = `${entry.type}:${entry.connection_ref}`;
    const existing = map.get(key);
    if (existing) {
      existing.locations = mergeLocations(existing.locations, entry.locations);
    } else {
      map.set(key, { ...entry });
    }
  }
  return [...map.values()];
}

function deduplicateWebhooks(entries: TDMWebhook[]): TDMWebhook[] {
  const map = new Map<string, TDMWebhook>();
  for (const entry of entries) {
    const key = `${entry.direction}:${entry.target_url}`;
    const existing = map.get(key);
    if (existing) {
      existing.locations = mergeLocations(existing.locations, entry.locations);
    } else {
      map.set(key, { ...entry });
    }
  }
  return [...map.values()];
}

// ---------------------------------------------------------------------------
// buildTDM — aggregate DependencyEntry[] into a final TDM
// ---------------------------------------------------------------------------

export function buildTDM(entries: DependencyEntry[], context: BuildContext): TDM {
  const packages = deduplicatePackages(
    entries
      .filter((e): e is DependencyEntry & { kind: "package" } => e.kind === "package")
      .map(({ kind: _, ...rest }) => rest),
  );

  const apis = deduplicateApis(
    entries
      .filter((e): e is DependencyEntry & { kind: "api" } => e.kind === "api")
      .map(({ kind: _, ...rest }) => rest),
  );

  const sdks = deduplicateSdks(
    entries
      .filter((e): e is DependencyEntry & { kind: "sdk" } => e.kind === "sdk")
      .map(({ kind: _, ...rest }) => rest),
  );

  const infrastructure = deduplicateInfrastructure(
    entries
      .filter(
        (e): e is DependencyEntry & { kind: "infrastructure" } =>
          e.kind === "infrastructure",
      )
      .map(({ kind: _, ...rest }) => rest),
  );

  const webhooks = deduplicateWebhooks(
    entries
      .filter((e): e is DependencyEntry & { kind: "webhook" } => e.kind === "webhook")
      .map(({ kind: _, ...rest }) => rest),
  );

  const totalDeps =
    packages.length +
    apis.length +
    sdks.length +
    infrastructure.length +
    webhooks.length;

  const metadata: TDM["metadata"] = {
    scan_timestamp: new Date().toISOString(),
    scanner_version: SCANNER_VERSION,
    languages_detected: context.plugins.map((p) => p.language),
    total_dependencies_found: totalDeps,
    scan_duration_ms: context.duration,
  };
  if (context.repository !== undefined) {
    metadata.repository = context.repository;
  }

  return {
    version: TDM_SCHEMA_VERSION,
    metadata,
    packages,
    apis,
    sdks,
    infrastructure,
    webhooks,
  };
}
