// apps/cli/src/commands/scan.ts — `thirdwatch scan` command handler
import { Command } from "commander";
import { resolve } from "node:path";
import { writeFile } from "node:fs/promises";
import { scan } from "@thirdwatch/core";
import { PythonPlugin } from "@thirdwatch/language-python";
import { JavaScriptPlugin } from "@thirdwatch/language-javascript";
import yaml from "js-yaml";
import { createSpinner } from "../ui/spinner.js";
import { printSummaryTable } from "../output/summary.js";
import { formatJson } from "../output/json.js";
import { formatYaml } from "../output/yaml.js";

export const scanCommand = new Command("scan")
  .description(
    "Scan a codebase and produce a Thirdwatch Dependency Manifest (TDM).",
  )
  .argument("[path]", "Path to scan (default: current directory)", ".")
  .option("-o, --output <file>", "Output file path", "./thirdwatch.json")
  .option("-f, --format <format>", "Output format: json or yaml", "json")
  .option("--languages <langs...>", "Languages to scan (default: auto-detect)")
  .option("--ignore <patterns...>", "Glob patterns to ignore")
  .option("--config <file>", "Path to .thirdwatch.yml config file")
  .option("--no-resolve", "Skip environment variable resolution")
  .option("--verbose", "Print detailed logs")
  .option("--quiet", "Suppress all output except the TDM")
  .action(async (scanPath: string, opts) => {
    const quiet = opts.quiet as boolean;
    const verbose = opts.verbose as boolean;
    const format = opts.format as string;
    const outputPath = resolve(opts.output as string);
    const root = resolve(scanPath);

    if (format !== "json" && format !== "yaml") {
      console.error(`Error: Invalid format "${format}". Use "json" or "yaml".`);
      process.exitCode = 2;
      return;
    }

    const s = createSpinner();
    if (!quiet) s.start("Discovering files…");

    // Build plugin list — filter by --languages if provided
    const allPlugins = [new PythonPlugin(), new JavaScriptPlugin()];
    const languages = opts.languages as string[] | undefined;
    const plugins =
      languages && languages.length > 0
        ? allPlugins.filter((p) => languages.includes(p.language))
        : allPlugins;

    if (plugins.length === 0) {
      if (!quiet) s.fail("No matching language plugins found");
      process.exitCode = 2;
      return;
    }

    try {
      const ignorePatterns = opts.ignore as string[] | undefined;
      const configFile = opts.config as string | undefined;
      const scanOpts: Parameters<typeof scan>[0] = {
        root,
        plugins,
        resolveEnv: opts.resolve !== false,
      };
      if (ignorePatterns) scanOpts.ignore = ignorePatterns;
      if (configFile) scanOpts.configFile = configFile;

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

      // Write output file
      await writeFile(outputPath, output, "utf8");

      if (!quiet) {
        printSummaryTable(tdm, result.filesScanned);
        console.log(`\n✓ TDM written to ${outputPath}`);
      } else {
        process.stdout.write(output);
      }

      process.exitCode = 0;
    } catch (err) {
      if (!quiet) {
        s.fail("Scan failed");
        console.error(
          `\n${err instanceof Error ? err.message : String(err)}`,
        );
      }
      process.exitCode = 1;
    }
  });
