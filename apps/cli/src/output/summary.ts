// apps/cli/src/output/summary.ts — Human-readable summary table for terminal
import type { TDM, Confidence } from "@thirdwatch/tdm";
import pc from "picocolors";

function confidenceDot(confidence: Confidence): string {
  switch (confidence) {
    case "high":
      return pc.green("●");
    case "medium":
      return pc.yellow("●");
    case "low":
      return pc.red("●");
  }
}

function pad(str: string, len: number): string {
  return str.length >= len ? str : str + " ".repeat(len - str.length);
}

function padStart(str: string, len: number): string {
  return str.length >= len ? str : " ".repeat(len - str.length) + str;
}

export function printSummaryTable(tdm: TDM, filesScanned: number): void {
  const { metadata, packages, apis, sdks, infrastructure, webhooks } = tdm;
  const durationSec = (metadata.scan_duration_ms / 1000).toFixed(1);
  const langs = metadata.languages_detected.join(", ");

  console.log("");
  console.log(
    pc.bold(
      `  thirdwatch scan — ${filesScanned} files in ${durationSec}s (${langs})`,
    ),
  );

  // Packages
  if (packages.length > 0) {
    console.log("");
    console.log(pc.bold(`  📦 Packages (${packages.length})`));
    for (const pkg of packages) {
      const eco = pad(pkg.ecosystem, 6);
      const name = pad(pkg.name, 24);
      const ver = pad(pkg.current_version, 10);
      const usage = padStart(`${pkg.usage_count} usages`, 10);
      console.log(
        `    ${eco} ${name} ${ver} ${usage}  ${confidenceDot(pkg.confidence)} ${pkg.confidence}`,
      );
    }
  }

  // APIs
  if (apis.length > 0) {
    console.log("");
    console.log(pc.bold(`  🌐 External APIs (${apis.length})`));
    for (const api of apis) {
      const method = pad(api.method ?? "ANY", 6);
      const url = pad(api.url, 48);
      const calls = padStart(`${api.usage_count} calls`, 9);
      console.log(
        `    ${confidenceDot(api.confidence)} ${pad(api.confidence, 8)} ${method} ${url} ${calls}`,
      );
    }
  }

  // SDKs
  if (sdks.length > 0) {
    console.log("");
    console.log(pc.bold(`  🔧 SDKs (${sdks.length})`));
    for (const sdk of sdks) {
      const services =
        sdk.services_used && sdk.services_used.length > 0
          ? sdk.services_used.join(", ")
          : "";
      const loc =
        sdk.locations.length > 0
          ? `${sdk.locations[0]!.file}:${sdk.locations[0]!.line}`
          : "";
      console.log(
        `    ${confidenceDot(sdk.confidence)} ${pad(sdk.confidence, 8)} ${pad(sdk.provider, 10)} (${sdk.sdk_package})  ${services || loc}  ${padStart(`${sdk.usage_count} usages`, 10)}`,
      );
    }
  }

  // Infrastructure
  if (infrastructure.length > 0) {
    console.log("");
    console.log(pc.bold(`  🗄️  Infrastructure (${infrastructure.length})`));
    for (const infra of infrastructure) {
      const host = infra.resolved_host ?? infra.connection_ref;
      console.log(
        `    ${confidenceDot(infra.confidence)} ${pad(infra.confidence, 8)} ${pad(infra.type, 14)} ${host}`,
      );
    }
  }

  // Webhooks
  if (webhooks.length > 0) {
    console.log("");
    console.log(pc.bold(`  🔗 Webhooks (${webhooks.length})`));
    for (const wh of webhooks) {
      const dir = wh.direction === "outbound_registration" ? "outbound" : "inbound";
      console.log(
        `    ${confidenceDot(wh.confidence)} ${pad(wh.confidence, 8)} ${pad(dir, 10)} ${wh.target_url}`,
      );
    }
  }

  // Summary line
  const sections: string[] = [];
  if (packages.length > 0) sections.push(`${packages.length} packages`);
  if (apis.length > 0) sections.push(`${apis.length} APIs`);
  if (sdks.length > 0) sections.push(`${sdks.length} SDKs`);
  if (infrastructure.length > 0)
    sections.push(`${infrastructure.length} infrastructure`);
  if (webhooks.length > 0) sections.push(`${webhooks.length} webhooks`);

  console.log("");
  console.log(
    pc.dim(
      `  ${metadata.total_dependencies_found} dependencies total (${sections.join(", ")})`,
    ),
  );
}
