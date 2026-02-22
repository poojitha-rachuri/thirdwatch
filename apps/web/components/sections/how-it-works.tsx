export function HowItWorksSection() {
  return (
    <section className="border-t border-zinc-800 bg-zinc-950 py-20">
      <div className="mx-auto max-w-5xl px-4">
        <h2 className="text-center text-3xl font-bold text-white">How It Works</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-zinc-400">
          Three steps. Zero configuration. Source code never leaves your machine.
        </p>
        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          <Step
            number={1}
            title="Scan"
            description="Run thirdwatch scan locally. It uses tree-sitter to parse your code and find every external dependency."
            badge={null}
          />
          <Step
            number={2}
            title="Map"
            description="Get a TDM — a structured JSON manifest of every API, SDK, package, database, and webhook your code touches."
            badge={null}
          />
          <Step
            number={3}
            title="Monitor"
            description="Upload the TDM. Thirdwatch watches for breaking changes across all your dependencies and alerts you."
            badge="Phase 2"
          />
        </div>
      </div>
    </section>
  );
}

function Step({
  number,
  title,
  description,
  badge,
}: {
  number: number;
  title: string;
  description: string;
  badge: string | null;
}) {
  return (
    <div className="relative rounded-lg border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
        {number}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-white">
        {title}
        {badge && (
          <span className="ml-2 rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
            {badge}
          </span>
        )}
      </h3>
      <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{description}</p>
    </div>
  );
}
