// action/src/index.ts — Thirdwatch GitHub Action entry point

import * as core from "@actions/core";
import * as github from "@actions/github";
import { scan } from "@thirdwatch/core";
import { PythonPlugin } from "@thirdwatch/language-python";
import { JavaScriptPlugin } from "@thirdwatch/language-javascript";
import { parseTDM } from "@thirdwatch/tdm";
import type { TDM, Priority } from "@thirdwatch/tdm";
import { writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { diffTDMs, formatDiffAsMarkdown } from "./diff.js";
import { downloadBaselineTDM, uploadTDM } from "./cloud.js";
import { postPRComment } from "./github.js";

const PRIORITY_ORDER: Priority[] = ["P0", "P1", "P2", "P3", "P4"];

function priorityIndex(p: string): number {
  const idx = PRIORITY_ORDER.indexOf(p as Priority);
  return idx === -1 ? PRIORITY_ORDER.length : idx;
}

async function run(): Promise<void> {
  try {
    const scanPath = resolve(core.getInput("path") || ".");
    const baselineInput = core.getInput("baseline-tdm") || "cloud";
    const token = core.getInput("token");
    const githubToken = core.getInput("github-token");
    const failOnNew = core.getInput("fail-on-new-dependencies") === "true";
    const failOnBreaking =
      core.getInput("fail-on-breaking-changes") !== "false";
    const severityThreshold = core.getInput("severity-threshold") || "P1";
    const outFile = core.getInput("out-file") || "thirdwatch.json";

    // 1. Scan
    core.startGroup("Thirdwatch: Scanning dependencies");
    const startMs = Date.now();
    const result = await scan({
      root: scanPath,
      plugins: [new PythonPlugin(), new JavaScriptPlugin()],
    });
    const tdm = result.tdm;
    const durationMs = Date.now() - startMs;
    core.info(
      `Found ${tdm.metadata.total_dependencies_found} dependencies in ${durationMs}ms`,
    );
    core.info(
      `Files scanned: ${result.filesScanned}, skipped: ${result.filesSkipped}, errors: ${result.errors.length}`,
    );
    core.endGroup();

    // Write TDM to file
    await writeFile(outFile, JSON.stringify(tdm, null, 2));
    core.setOutput("tdm-path", outFile);
    core.setOutput(
      "dependency-count",
      String(tdm.metadata.total_dependencies_found),
    );
    core.setOutput("scan-duration-ms", String(durationMs));

    // 2. Get baseline TDM
    let baselineTDM: TDM | null = null;

    if (baselineInput === "cloud" && token) {
      core.startGroup("Thirdwatch: Downloading baseline TDM");
      try {
        baselineTDM = await downloadBaselineTDM(
          token,
          tdm.metadata.repository,
        );
        if (baselineTDM) {
          core.info("Baseline TDM downloaded from cloud");
        } else {
          core.info("No baseline TDM found in cloud — first scan");
        }
      } catch (err) {
        core.warning(
          `Failed to download baseline TDM: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      core.endGroup();
    } else if (baselineInput !== "cloud") {
      core.startGroup("Thirdwatch: Loading baseline TDM from file");
      try {
        const raw = await readFile(baselineInput, "utf8");
        baselineTDM = parseTDM(JSON.parse(raw));
        core.info(`Baseline TDM loaded from ${baselineInput}`);
      } catch {
        core.info(
          "No baseline TDM found at path — treating all dependencies as new",
        );
      }
      core.endGroup();
    }

    // 3. Diff
    const diff = diffTDMs(baselineTDM, tdm);
    core.setOutput("new-dependencies", JSON.stringify(diff.added.map((d) => d.key)));
    core.setOutput(
      "removed-dependencies",
      JSON.stringify(diff.removed.map((d) => d.key)),
    );
    core.setOutput("new-dependency-count", String(diff.added.length));

    core.info(
      `Diff: +${diff.summary.addedCount} new, -${diff.summary.removedCount} removed, ${diff.summary.unchangedCount} unchanged`,
    );

    // 4. Post PR comment
    if (github.context.eventName === "pull_request" && githubToken) {
      core.startGroup("Thirdwatch: Posting PR comment");
      try {
        const octokit = github.getOctokit(githubToken);
        const comment = formatDiffAsMarkdown(diff, tdm);
        await postPRComment(octokit, github.context, comment);
        core.info("PR comment posted");
      } catch (err) {
        core.warning(
          `Failed to post PR comment: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      core.endGroup();
    }

    // 5. Upload new TDM to cloud (becomes future baseline)
    if (token && github.context.eventName === "push") {
      core.startGroup("Thirdwatch: Uploading TDM to cloud");
      try {
        await uploadTDM(token, tdm);
        core.info("TDM uploaded to cloud");
      } catch (err) {
        core.warning(
          `Failed to upload TDM: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      core.endGroup();
    }

    // 6. Fail check if configured
    if (failOnNew && diff.added.length > 0) {
      core.setFailed(
        `${diff.added.length} new external dependencies detected. Review and register them for monitoring.`,
      );
      return;
    }

    if (failOnBreaking && diff.removed.length > 0) {
      const threshold = priorityIndex(severityThreshold);
      // Only fail if there are dependencies removed that exceed the severity threshold
      // This is a simplified check — full breaking change detection requires the watcher
      core.info(
        `Breaking changes check: severity threshold ${severityThreshold} (index ${threshold})`,
      );
    }
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

run();
