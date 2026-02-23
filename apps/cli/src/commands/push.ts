import { Command } from "commander";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createSpinner } from "../ui/spinner.js";

const DEFAULT_API_URL = "https://api.thirdwatch.dev";

interface PushCommandOpts {
  token?: string;
  apiUrl?: string;
}

export const pushCommand = new Command("push")
  .description(
    "Upload a TDM to Thirdwatch cloud for continuous monitoring.",
  )
  .argument("[file]", "Path to TDM file", "./thirdwatch.json")
  .option(
    "--token <token>",
    "API token (or set THIRDWATCH_TOKEN env var)",
  )
  .option(
    "--api-url <url>",
    "API base URL (or set THIRDWATCH_API_URL env var)",
  )
  .action(async (file: string, opts: PushCommandOpts) => {
    const token =
      opts.token ?? process.env["THIRDWATCH_TOKEN"];
    if (!token) {
      console.error(
        "Error: API token required. Use --token or set THIRDWATCH_TOKEN.",
      );
      process.exitCode = 2;
      return;
    }

    const apiUrl =
      opts.apiUrl ??
      process.env["THIRDWATCH_API_URL"] ??
      DEFAULT_API_URL;

    const filePath = resolve(file);
    const s = createSpinner();

    try {
      s.start(`Reading ${filePath}…`);
      const content = await readFile(filePath, "utf8");
      const tdm: unknown = JSON.parse(content);

      s.start(`Uploading TDM to ${apiUrl}…`);
      const response = await fetch(`${apiUrl}/api/v1/tdm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": token,
        },
        body: JSON.stringify(tdm),
      });

      if (!response.ok) {
        const body = await response.text();
        s.fail(`Upload failed (HTTP ${response.status})`);
        console.error(body);
        process.exitCode = 1;
        return;
      }

      const result = (await response.json()) as {
        tdmId: string;
        dependenciesRegistered: number;
      };

      s.succeed(
        `Uploaded — ${result.dependenciesRegistered} dependencies registered for monitoring`,
      );
      console.log(`  TDM ID: ${result.tdmId}`);
    } catch (err) {
      s.fail("Push failed");
      console.error(
        err instanceof Error ? err.message : String(err),
      );
      process.exitCode = 1;
    }
  });
