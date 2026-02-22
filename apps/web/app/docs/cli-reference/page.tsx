import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CLI Reference — Thirdwatch",
  description: "Complete reference for the thirdwatch CLI — all commands, flags, and options.",
};

export default function CLIReferencePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-20">
      <h1 className="text-3xl font-bold text-white">CLI Reference</h1>
      <p className="mt-3 text-zinc-400">
        Complete reference for the <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-300">thirdwatch</code> command-line tool.
      </p>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-white">thirdwatch scan</h2>
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
            { flag: "path", description: "Directory to scan. Defaults to current directory (.)" },
          ]}
        />

        <h3 className="mt-8 text-lg font-semibold text-white">Options</h3>
        <FlagTable
          rows={[
            { flag: "-o, --output <file>", description: "Output file path. Defaults to ./thirdwatch.json" },
            { flag: "-f, --format <format>", description: "Output format: json (default) or yaml" },
            { flag: "--no-packages", description: "Skip package detection" },
            { flag: "--no-apis", description: "Skip API detection" },
            { flag: "--no-sdks", description: "Skip SDK detection" },
            { flag: "--no-infrastructure", description: "Skip infrastructure detection" },
            { flag: "--no-webhooks", description: "Skip webhook detection" },
            { flag: "--include <glob>", description: "Only scan files matching this glob pattern" },
            { flag: "--exclude <glob>", description: "Exclude files matching this glob pattern" },
            { flag: "--verbose", description: "Show detailed scan progress" },
            { flag: "--json", description: "Output scan summary as JSON (for CI)" },
            { flag: "-h, --help", description: "Show help" },
            { flag: "-V, --version", description: "Show version" },
          ]}
        />
      </section>

      <section className="mt-16">
        <h2 className="text-xl font-semibold text-white">Configuration</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Thirdwatch can be configured via a <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-300">.thirdwatch.yml</code> file in your project root.
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
          Create a <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-300">.thirdwatchignore</code> file to exclude paths from scanning. Uses gitignore syntax.
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
          <Example
            title="Scan current directory"
            command="thirdwatch scan"
          />
          <Example
            title="Scan with YAML output"
            command="thirdwatch scan . --format yaml -o deps.yaml"
          />
          <Example
            title="Scan only Python files"
            command='thirdwatch scan . --include "**/*.py"'
          />
          <Example
            title="Scan in CI (JSON summary to stdout)"
            command="thirdwatch scan . --json"
          />
        </div>
      </section>
    </main>
  );
}

function FlagTable({ rows }: { rows: { flag: string; description: string }[] }) {
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-zinc-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900">
            <th className="px-4 py-2 text-left font-medium text-zinc-300">Flag</th>
            <th className="px-4 py-2 text-left font-medium text-zinc-300">Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.flag} className="border-b border-zinc-800 last:border-b-0">
              <td className="px-4 py-2 font-mono text-xs text-green-400 whitespace-nowrap">{row.flag}</td>
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
      <code className="mt-2 block font-mono text-sm text-green-400">$ {command}</code>
    </div>
  );
}
