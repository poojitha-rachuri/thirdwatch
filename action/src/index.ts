import * as core from "@actions/core";

/**
 * Thirdwatch GitHub Action
 *
 * Phase 1 stub — full implementation in Plan 05 (CLI) + Plan 11 (CI/CD Gate).
 */
async function run(): Promise<void> {
  try {
    const path = core.getInput("path") || ".";
    const output = core.getInput("output") || "json";
    const outFile = core.getInput("out-file") || "thirdwatch.tdm.json";
    const failOnNew = core.getInput("fail-on-new") === "true";

    core.info(`Thirdwatch: scanning ${path}`);
    core.info(`Output: ${output} → ${outFile}`);

    // TODO: Phase 5 — invoke thirdwatch CLI programmatically
    // const result = await scan({ root: path, output, outFile });

    core.setOutput("tdm-path", outFile);
    core.setOutput("dependency-count", "0");
    core.setOutput("new-dependency-count", "0");

    if (failOnNew) {
      core.info("fail-on-new: enabled (no baseline found, skipping gate)");
    }
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

run();
