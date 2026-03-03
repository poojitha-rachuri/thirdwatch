import { DashboardShell } from "@/components/dashboard-shell";

export const metadata = { title: "Changes — Thirdwatch" };

export default function ChangesPage() {
  return (
    <DashboardShell>
      <div>
        <h1 className="mb-6 text-2xl font-bold text-white">Changes</h1>

        <div className="mb-6 flex gap-2">
          {["All", "P0", "P1", "P2", "P3", "P4"].map((p) => (
            <button
              key={p}
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
            >
              {p}
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
          <p className="text-sm text-zinc-400">
            No changes detected yet. Changes will appear here once your
            dependencies are being monitored.
          </p>
        </div>
      </div>
    </DashboardShell>
  );
}
