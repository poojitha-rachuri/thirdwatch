import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, unlinkSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import type { TDM } from "@thirdwatch/tdm";

const __testdir = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(__testdir, "../../bin/thirdwatch.js");
const ROOT = resolve(__testdir, "../../../..");
const FIXTURES = join(ROOT, "fixtures");

function run(
  args: string[],
  cwd?: string,
): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execFileSync("node", [CLI, ...args], {
      encoding: "utf8",
      timeout: 30_000,
      cwd: cwd ?? ROOT,
      env: { ...process.env, NO_UPDATE_NOTIFICATION: "1" },
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
      exitCode: e.status ?? 1,
    };
  }
}

describe("thirdwatch CLI", () => {
  it("--help shows usage info", () => {
    const { stdout, exitCode } = run(["--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("thirdwatch");
    expect(stdout).toContain("scan");
  });

  it("--version prints the correct semver", () => {
    const { stdout, exitCode } = run(["--version"]);
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe("0.1.0");
  });

  it("scan --help shows scan options", () => {
    const { stdout, exitCode } = run(["scan", "--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("--output");
    expect(stdout).toContain("--format");
    expect(stdout).toContain("--quiet");
    expect(stdout).toContain("--verbose");
    expect(stdout).toContain("--languages");
    expect(stdout).toContain("--ignore");
    expect(stdout).toContain("--config");
    expect(stdout).toContain("--no-resolve");
    expect(stdout).toContain("--no-color");
  });
});

describe("thirdwatch scan", () => {
  const outputPath = resolve(ROOT, "thirdwatch-test-output.json");
  const yamlOutputPath = resolve(ROOT, "thirdwatch-test-output.yaml");

  afterEach(() => {
    for (const p of [outputPath, yamlOutputPath]) {
      if (existsSync(p)) unlinkSync(p);
    }
  });

  it("scans python-app and writes a valid TDM JSON file", () => {
    const { exitCode } = run([
      "scan",
      join(FIXTURES, "python-app"),
      "--output",
      outputPath,
    ]);
    expect(exitCode).toBe(0);
    expect(existsSync(outputPath)).toBe(true);

    const tdm = JSON.parse(readFileSync(outputPath, "utf8")) as TDM;
    expect(tdm.version).toBe("1.0");
    expect(tdm.metadata.total_dependencies_found).toBeGreaterThan(0);
    expect(tdm.packages.length).toBeGreaterThan(0);
  });

  it("scans node-app and writes a valid TDM JSON file", () => {
    const { exitCode } = run([
      "scan",
      join(FIXTURES, "node-app"),
      "--output",
      outputPath,
    ]);
    expect(exitCode).toBe(0);

    const tdm = JSON.parse(readFileSync(outputPath, "utf8")) as TDM;
    expect(tdm.version).toBe("1.0");
    expect(tdm.metadata.total_dependencies_found).toBeGreaterThan(0);
    expect(tdm.packages.length).toBeGreaterThan(0);
  });

  it("supports --format yaml with trailing newline", () => {
    const { exitCode } = run([
      "scan",
      join(FIXTURES, "python-app"),
      "--format",
      "yaml",
      "--output",
      yamlOutputPath,
    ]);
    expect(exitCode).toBe(0);

    const raw = readFileSync(yamlOutputPath, "utf8");
    expect(raw.endsWith("\n")).toBe(true);
    const tdm = yaml.load(raw) as TDM;
    expect(tdm.version).toBe("1.0");
    expect(tdm.metadata.total_dependencies_found).toBeGreaterThan(0);
  });

  it("--quiet outputs only JSON to stdout", () => {
    const { stdout, exitCode } = run([
      "scan",
      join(FIXTURES, "python-app"),
      "--quiet",
      "--output",
      outputPath,
    ]);
    expect(exitCode).toBe(0);

    // stdout should be parseable JSON
    const tdm = JSON.parse(stdout) as TDM;
    expect(tdm.version).toBe("1.0");
  });

  it("summary table includes dependency counts", () => {
    const { stdout, exitCode } = run([
      "scan",
      join(FIXTURES, "python-app"),
      "--output",
      outputPath,
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Packages");
    expect(stdout).toContain("dependencies");
    expect(stdout).toContain("TDM written to");
  });

  it("exits with code 2 on invalid format", () => {
    const { exitCode } = run([
      "scan",
      join(FIXTURES, "python-app"),
      "--format",
      "xml",
      "--output",
      outputPath,
    ]);
    expect(exitCode).toBe(2);
  });

  it("-o - writes TDM to stdout only (no file)", () => {
    const { stdout, exitCode } = run([
      "scan",
      join(FIXTURES, "python-app"),
      "-o",
      "-",
    ]);
    expect(exitCode).toBe(0);

    const tdm = JSON.parse(stdout) as TDM;
    expect(tdm.version).toBe("1.0");
    expect(tdm.metadata.total_dependencies_found).toBeGreaterThan(0);
  });

  it("rejects output path outside cwd", () => {
    const { exitCode, stderr } = run([
      "scan",
      join(FIXTURES, "python-app"),
      "--output",
      "/tmp/evil-output.json",
    ]);
    expect(exitCode).toBe(2);
    expect(stderr).toContain("Output path must be within");
  });
});
