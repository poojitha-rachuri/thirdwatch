export default function DashboardPage() {
  return (
    <div>
      <h1 className="mb-8 text-2xl font-bold text-white">Dashboard</h1>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Dependencies Monitored" value="—" />
        <StatCard label="Changes (30d)" value="—" />
        <StatCard label="P0/P1 Open" value="—" />
        <StatCard label="Repos Active" value="—" />
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-200">
            Recent Changes
          </h2>
          <a
            href="/changes"
            className="text-sm text-brand-400 transition-colors hover:text-brand-300"
          >
            View all →
          </a>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
          <p className="text-sm text-zinc-400">
            No changes detected yet. Push a TDM to start monitoring:
          </p>
          <pre className="mt-3 rounded-md bg-zinc-950 px-4 py-3 font-mono text-sm text-zinc-300">
            thirdwatch scan . && thirdwatch push
          </pre>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
