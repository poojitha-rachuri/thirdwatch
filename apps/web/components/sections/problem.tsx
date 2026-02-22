export function ProblemSection() {
  return (
    <section className="border-t border-zinc-800 bg-zinc-900 py-20">
      <div className="mx-auto max-w-5xl px-4">
        <h2 className="text-center text-3xl font-bold text-white">The Blind Spot</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-zinc-400">
          Your tools only cover part of your external surface area.
        </p>
        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          <Card
            title="Package Managers"
            description="Dependabot monitors your npm and pip packages. Your Stripe API version? Not covered."
            icon="📦"
          />
          <Card
            title="API Monitoring"
            description="Uptime tools watch your APIs. The APIs you call? Also not covered."
            icon="🌐"
          />
          <Card
            title="Contract Testing"
            description="Contract testing needs you to write tests first. Thirdwatch just reads your code."
            icon="🧪"
          />
        </div>
      </div>
    </section>
  );
}

function Card({ title, description, icon }: { title: string; description: string; icon: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
      <span className="text-2xl">{icon}</span>
      <h3 className="mt-3 text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{description}</p>
    </div>
  );
}
