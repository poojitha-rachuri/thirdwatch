// apps/cli — thirdwatch CLI entry point
import { Command } from "commander";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { scanCommand } from "./commands/scan.js";
import { pushCommand } from "./commands/push.js";
import { checkForUpdates } from "./update-check.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
let version = "0.0.0";
try {
  const pkg = JSON.parse(
    readFileSync(join(__dirname, "../package.json"), "utf8"),
  ) as { version?: string };
  if (pkg.version) version = pkg.version;
} catch {
  // Fall back to "0.0.0" if package.json is unreadable
}

const program = new Command();

program
  .name("thirdwatch")
  .description(
    "Know before you break — map every external dependency in your codebase.",
  )
  .version(version, "-v, --version");

program.addCommand(scanCommand);
program.addCommand(pushCommand);

// Non-blocking update check (fire and forget)
void checkForUpdates(version);

program.parse();
