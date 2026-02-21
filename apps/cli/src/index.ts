// apps/cli — Plan 05 implements the full CLI
// Stub: wire up Commander program

import { Command } from "commander";

const program = new Command();

program
  .name("thirdwatch")
  .description("Know before you break — map every external dependency in your codebase.")
  .version("0.1.0", "-v, --version");

program
  .command("scan [path]")
  .description("Scan a codebase and produce a Thirdwatch Dependency Manifest (TDM)")
  .option("-o, --output <file>", "Output file path", "./thirdwatch.json")
  .option("-f, --format <format>", "Output format: json or yaml", "json")
  .action((_path: string | undefined) => {
    console.error("thirdwatch scan is not yet implemented — see Plan 05");
    process.exitCode = 1;
  });

program.parse();
