import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Docs — Thirdwatch",
  description: "Thirdwatch documentation — CLI reference, TDM schema specification, and getting started guides.",
};

export default function DocsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-20">
      <h1 className="text-3xl font-bold text-white">Documentation</h1>
      <p className="mt-3 text-zinc-400">
        Everything you need to get started with Thirdwatch.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <DocCard
          href="/docs/cli-reference"
          title="CLI Reference"
          description="All commands, flags, and options for the thirdwatch CLI."
          icon="⌨️"
        />
        <DocCard
          href="/tdm-spec"
          title="TDM Specification"
          description="The Thirdwatch Dependency Manifest schema — structure and field reference."
          icon="📋"
        />
      </div>

      <section className="mt-16">
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
    </main>
  );
}

function DocCard({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-lg border border-zinc-800 bg-zinc-900 p-6 transition-colors hover:border-zinc-700 hover:bg-zinc-800"
    >
      <span className="text-2xl">{icon}</span>
      <h3 className="mt-3 font-semibold text-white group-hover:text-brand-400 transition-colors">
        {title}
      </h3>
      <p className="mt-1 text-sm text-zinc-400">{description}</p>
    </Link>
  );
}
