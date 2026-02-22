// apps/cli/src/commands/scan.ts — `thirdwatch scan` command handler
import { Command } from "commander";
import { resolve, sep } from "node:path";
import { writeFile } from "node:fs/promises";
import { scan } from "@thirdwatch/core";
import { PythonPlugin } from "@thirdwatch/language-python";
import { JavaScriptPlugin } from "@thirdwatch/language-javascript";
import { createSpinner } from "../ui/spinner.js";
import { printSummaryTable } from "../output/summary.js";
import { formatJson } from "../output/json.js";
import { formatYaml } from "../output/yaml.js";

interface ScanCommandOpts {
  output: string;
  format: string;
  languages?: string[];
  ignore?: string[];
  config?: string;
  resolve: boolean;
  verbose?: boolean;
  quiet?: boolean;
  color: boolean;
}

export const scanCommand = new Command("scan")
  .description(
    "Scan a codebase and produce a Thirdwatch Dependency Manifest (TDM).",
  )
  .argument("[path]", "Path to scan (default: current directory)", ".")
  .option("-o, --output <file>", "Output file path (use - for stdout)", "./thirdwatch.json")
  .option("-f, --format <format>", "Output format: json or yaml", "json")
  .option("--languages <langs...>", "Languages to scan (default: auto-detect)")
  .option("--ignore <patterns...>", "Glob patterns to ignore")
  .option("--config <file>", "Path to .thirdwatch.yml config file")
  .option("--no-resolve", "Skip environment variable resolution")
  .option("--verbose", "Print detailed logs")
  .option("--quiet", "Suppress all output except the TDM")
  .option("--no-color", "Disable colored output")
  .action(async (scanPath: string, opts: ScanCommandOpts) => {
    const quiet = opts.quiet ?? false;
    const verbose = opts.verbose ?? false;
    const format = opts.format;
    const root = resolve(scanPath);
    const writeToStdout = opts.output === "-";

    if (format !== "json" && format !== "yaml") {
      console.error(`Error: Invalid format "${format}". Use "json" or "yaml".`);
      process.exitCode = 2;
      return;
    }

    // Validate output path is within cwd (unless writing to stdout)
    let outputPath = "";
    if (!writeToStdout) {
      outputPath = resolve(opts.output);
      const basePath = resolve(process.cwd());
      if (!outputPath.startsWith(basePath + sep) && outputPath !== basePath) {
        console.error(
          "Error: Output path must be within the current working directory.",
        );
        process.exitCode = 2;
        return;
      }
    }

    const s = createSpinner();
    if (!quiet) s.start("Discovering files…");

    // Build plugin list — filter by --languages if provided
    const allPlugins = [new PythonPlugin(), new JavaScriptPlugin()];
    const plugins =
      opts.languages && opts.languages.length > 0
        ? allPlugins.filter((p) => opts.languages!.includes(p.language))
        : allPlugins;

    if (plugins.length === 0) {
      s.fail("No matching language plugins found");
      process.exitCode = 2;
      return;
    }

    try {
      const scanOpts: Parameters<typeof scan>[0] = {
        root,
        plugins,
        resolveEnv: opts.resolve !== false,
      };
      if (opts.ignore) scanOpts.ignore = opts.ignore;
      if (opts.config) scanOpts.configFile = opts.config;

      const result = await scan(scanOpts);

      const { tdm } = result;
      const depCount = tdm.metadata.total_dependencies_found;

      if (!quiet) s.succeed(`Scan complete — ${depCount} dependencies found`);

      if (verbose && result.errors.length > 0) {
        console.error(`\n⚠  ${result.errors.length} file(s) had errors:`);
        for (const e of result.errors) {
          console.error(`   ${e.filePath}: ${e.error}`);
        }
      }

      // Format output
      const output = format === "yaml" ? formatYaml(tdm) : formatJson(tdm);

      if (writeToStdout) {
        process.stdout.write(output);
      } else {
        await writeFile(outputPath, output, "utf8");

        if (!quiet) {
          printSummaryTable(tdm, result.filesScanned);
          console.log(`\n✓ TDM written to ${outputPath}`);
        } else {
          process.stdout.write(output);
        }
      }

      process.exitCode = 0;
    } catch (err) {
      if (!quiet) s.fail("Scan failed");
      // Always write errors to stderr regardless of --quiet
      console.error(
        `\n${err instanceof Error ? err.message : String(err)}`,
      );
      process.exitCode = 1;
    }
  });
