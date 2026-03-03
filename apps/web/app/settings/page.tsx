import { DashboardShell } from "@/components/dashboard-shell";

export const metadata = { title: "Settings — Thirdwatch" };

export default function SettingsPage() {
  return (
    <DashboardShell>
      <div>
        <h1 className="mb-8 text-2xl font-bold text-white">Settings</h1>

        <div className="space-y-8">
          <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-200">
                API Keys
              </h2>
              <button className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-500">
                Create Key
              </button>
            </div>
            <p className="text-sm text-zinc-400">
              API keys are used to authenticate CLI and CI integrations.
            </p>
            <div className="mt-4 rounded-md border border-zinc-700 p-4">
              <p className="text-sm text-zinc-500">
                No API keys created yet.
              </p>
            </div>
          </section>

          <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-200">
                Notification Channels
              </h2>
              <button className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-500">
                Add Channel
              </button>
            </div>
            <p className="text-sm text-zinc-400">
              Configure where change alerts are delivered.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {["Slack", "GitHub Issues", "Jira", "Webhook"].map((ch) => (
                <div
                  key={ch}
                  className="rounded-md border border-zinc-700 p-4 text-center"
                >
                  <p className="text-sm font-medium text-zinc-300">{ch}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Not configured
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="mb-4 text-lg font-semibold text-zinc-200">
              Routing Rules
            </h2>
            <p className="text-sm text-zinc-400">
              Route notifications based on priority and change type.
            </p>
            <div className="mt-4 rounded-md border border-zinc-700 p-4">
              <p className="text-sm text-zinc-500">
                No routing rules configured. Default: all changes to all
                channels.
              </p>
            </div>
          </section>

          <section className="rounded-lg border border-red-900/50 bg-red-950/20 p-6">
            <h2 className="mb-4 text-lg font-semibold text-red-400">
              Danger Zone
            </h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-300">
                  Delete Organization
                </p>
                <p className="text-xs text-zinc-500">
                  Permanently delete all data, TDMs, change events, and API
                  keys.
                </p>
              </div>
              <button className="rounded-md border border-red-700 px-3 py-1.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-900/30">
                Delete Org
              </button>
            </div>
          </section>
        </div>
      </div>
    </DashboardShell>
  );
}
