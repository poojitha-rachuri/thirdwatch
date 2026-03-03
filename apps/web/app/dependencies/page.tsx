import { DashboardShell } from "@/components/dashboard-shell";

export const metadata = { title: "Dependencies — Thirdwatch" };

export default function DependenciesPage() {
  return (
    <DashboardShell>
      <div>
        <h1 className="mb-6 text-2xl font-bold text-white">Dependencies</h1>

        <div className="mb-6 flex gap-2">
          {["All", "Packages", "SDKs", "APIs", "Infrastructure"].map(
            (tab) => (
              <button
                key={tab}
                className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
              >
                {tab}
              </button>
            ),
          )}
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-zinc-400">
                <th className="px-4 py-3 font-medium">Dependency</th>
                <th className="px-4 py-3 font-medium">Kind</th>
                <th className="px-4 py-3 font-medium">Ecosystem</th>
                <th className="px-4 py-3 font-medium">Current</th>
                <th className="px-4 py-3 font-medium">Latest</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Usages</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-zinc-500"
                >
                  No dependencies monitored yet. Push a TDM to start.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </DashboardShell>
  );
}
