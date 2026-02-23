import type { Metadata } from "next";
import { GITHUB_SCHEMA_JSON_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Docs — Thirdwatch",
  description:
    "Thirdwatch documentation — CLI reference, commands, flags, configuration, and getting started.",
};

export default function DocsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-20">
      <h1 className="text-3xl font-bold text-white">Documentation</h1>
      <p className="mt-3 text-zinc-400">
        Everything you need to get started with Thirdwatch.
      </p>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-white">Quick Start</h2>
        <div className="mt-6 space-y-4 text-sm text-zinc-400 leading-relaxed">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <p className="font-medium text-zinc-300">1. Install</p>
            <code className="mt-2 block font-mono text-green-400">
              $ npm install -g thirdwatch
            </code>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <p className="font-medium text-zinc-300">2. Scan your repo</p>
            <code className="mt-2 block font-mono text-green-400">
              $ thirdwatch scan .
            </code>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <p className="font-medium text-zinc-300">3. View the manifest</p>
            <code className="mt-2 block font-mono text-green-400">
              $ cat thirdwatch.json
            </code>
          </div>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-xl font-semibold text-white">
          CLI Reference —{" "}
          <code className="rounded bg-zinc-800 px-2 py-1 text-brand-400">
            thirdwatch scan
          </code>
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          Scan a codebase and produce a Thirdwatch Dependency Manifest (TDM).
        </p>

        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <code className="font-mono text-sm text-green-400">
            $ thirdwatch scan [path] [options]
          </code>
        </div>

        <h3 className="mt-8 text-lg font-semibold text-white">Arguments</h3>
        <FlagTable
          rows={[
            {
              flag: "path",
              description:
                "Directory to scan. Defaults to current directory (.)",
            },
          ]}
        />

        <h3 className="mt-8 text-lg font-semibold text-white">Options</h3>
        <FlagTable
          rows={[
            {
              flag: "-o, --output <file>",
              description:
                "Output file path. Defaults to ./thirdwatch.json",
            },
            {
              flag: "-f, --format <format>",
              description: "Output format: json (default) or yaml",
            },
            {
              flag: "--languages <langs...>",
              description: "Languages to scan (default: auto-detect)",
            },
            {
              flag: "--ignore <patterns...>",
              description: "Glob patterns to ignore",
            },
            {
              flag: "--config <file>",
              description: "Path to .thirdwatch.yml config file",
            },
            {
              flag: "--no-resolve",
              description: "Skip environment variable resolution",
            },
            {
              flag: "--verbose",
              description: "Show detailed scan progress",
            },
            {
              flag: "--quiet",
              description: "Suppress all output except the TDM",
            },
            { flag: "--no-color", description: "Disable colored output" },
            { flag: "-h, --help", description: "Show help" },
            { flag: "-v, --version", description: "Show version" },
          ]}
        />
      </section>

      <section className="mt-16">
        <h2 className="text-xl font-semibold text-white">Configuration</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Thirdwatch can be configured via a{" "}
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-300">
            .thirdwatch.yml
          </code>{" "}
          file in your project root.
        </p>

        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <pre className="font-mono text-sm text-zinc-300">{`# .thirdwatch.yml
output: thirdwatch.json
format: json
exclude:
  - "node_modules/**"
  - "**/*.test.*"
  - "dist/**"`}</pre>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-xl font-semibold text-white">Ignore File</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Create a{" "}
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-300">
            .thirdwatchignore
          </code>{" "}
          file to exclude paths from scanning. Uses gitignore syntax.
        </p>

        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <pre className="font-mono text-sm text-zinc-300">{`# .thirdwatchignore
node_modules/
dist/
*.test.ts
fixtures/`}</pre>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-xl font-semibold text-white">Examples</h2>

        <div className="mt-6 space-y-4">
          <Example title="Scan current directory" command="thirdwatch scan" />
          <Example
            title="Scan with YAML output"
            command="thirdwatch scan . --format yaml -o deps.yaml"
          />
          <Example
            title="Verbose mode"
            command="thirdwatch scan . --verbose"
          />
          <Example
            title="Quiet mode (TDM only)"
            command="thirdwatch scan . --quiet"
          />
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-xl font-semibold text-white">TDM Schema</h2>
        <p className="mt-2 text-sm text-zinc-400">
          The canonical JSON Schema for the Thirdwatch Dependency Manifest is
          available at{" "}
          <a
            href={GITHUB_SCHEMA_JSON_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-400 hover:text-brand-300 underline"
          >
            schema/v1/tdm.schema.json
          </a>
          .
        </p>
      </section>
    </main>
  );
}

function FlagTable({
  rows,
}: {
  rows: { flag: string; description: string }[];
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-zinc-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900">
            <th className="px-4 py-2 text-left font-medium text-zinc-300">
              Flag
            </th>
            <th className="px-4 py-2 text-left font-medium text-zinc-300">
              Description
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.flag}
              className="border-b border-zinc-800 last:border-b-0"
            >
              <td className="px-4 py-2 font-mono text-xs text-green-400 whitespace-nowrap">
                {row.flag}
              </td>
              <td className="px-4 py-2 text-zinc-400">{row.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Example({ title, command }: { title: string; command: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-sm font-medium text-zinc-300">{title}</p>
      <code className="mt-2 block font-mono text-sm text-green-400">
        $ {command}
      </code>
    </div>
  );
}
